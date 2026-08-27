SHELL := /bin/bash

.DEFAULT_GOAL := help

PNPM ?= pnpm
DOCKER ?= docker
COMPOSE ?= docker compose
COMPOSE_FILE ?= docker-compose.local.yaml
HELM ?= helm
KUBECTL ?= kubectl
KUBE_CONTEXT ?= docker-desktop
KUBE_NAMESPACE ?= logs-drilldown-dev
KUBE_RELEASE ?= logs-drilldown-dev
KUBE_CHART ?= devenv/helm/logs-drilldown
KUBE_TIMEOUT ?= 8m
GRAFANA_URL ?= http://localhost:3001/grafana
GRAFANA_BASE_IMAGE ?= grafana/grafana
GRAFANA_VERSION ?= 13.1.3
GRAFANA_DEV_IMAGE ?= logs-drilldown-grafana:dev
GENERATOR_DEV_IMAGE ?= logs-drilldown-generator:dev
GOPROXY ?= https://goproxy.cn,direct
NODE_MIN_MAJOR := 24
SYNC_SCRIPT := devenv/scripts/sync-plugin.sh
DEV_SCRIPT := devenv/scripts/dev-plugin.sh

.PHONY: help check setup build images install start dev sync rebuild stop status logs test review compose-start compose-stop kube-check kube-start kube-status kube-test kube-stop

help: ## Show available local development commands
	@awk 'BEGIN {FS = ":.*## "; printf "Logs Drilldown Helm development\n\nUsage:\n  make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check: ## Verify Node, pnpm, Docker, Helm, kubectl, and the safe local context
	@command -v node >/dev/null || { echo "Error: Node.js is required (version $(NODE_MIN_MAJOR) or newer)." >&2; exit 1; }
	@node -e 'const major = Number(process.versions.node.split(".")[0]); if (major < $(NODE_MIN_MAJOR)) { console.error(`Error: Node.js $(NODE_MIN_MAJOR)+ is required; found $${process.version}.`); process.exit(1); }'
	@command -v $(PNPM) >/dev/null || { echo "Error: pnpm is required." >&2; exit 1; }
	@command -v $(DOCKER) >/dev/null || { echo "Error: Docker is required." >&2; exit 1; }
	@$(DOCKER) info >/dev/null 2>&1 || { echo "Error: the Docker daemon is not running or accessible." >&2; exit 1; }
	@command -v $(HELM) >/dev/null || { echo "Error: Helm 3 is required." >&2; exit 1; }
	@command -v $(KUBECTL) >/dev/null || { echo "Error: kubectl is required." >&2; exit 1; }
	@case "$(KUBE_CONTEXT)" in docker-desktop|minikube|kind-*|k3d-*) ;; *) echo "Error: refusing non-local Kubernetes context '$(KUBE_CONTEXT)'." >&2; exit 1 ;; esac
	@$(KUBECTL) config get-contexts "$(KUBE_CONTEXT)" >/dev/null 2>&1 || { echo "Error: Kubernetes context '$(KUBE_CONTEXT)' does not exist." >&2; exit 1; }
	@$(KUBECTL) --context "$(KUBE_CONTEXT)" cluster-info >/dev/null 2>&1 || { echo "Error: Kubernetes context '$(KUBE_CONTEXT)' is not reachable." >&2; exit 1; }

kube-check: check ## Alias for the local Kubernetes safety check

setup: check ## Install JavaScript dependencies from the lockfile
	$(PNPM) install --frozen-lockfile --ignore-scripts

build: ## Build one coherent production plugin bundle
	$(PNPM) run build

images: check build ## Build the two local images consumed by the chart
	$(DOCKER) build --file "$(KUBE_CHART)/images/grafana/Dockerfile" --build-arg "GRAFANA_IMAGE=$(GRAFANA_BASE_IMAGE)" --build-arg "GRAFANA_VERSION=$(GRAFANA_VERSION)" --tag "$(GRAFANA_DEV_IMAGE)" .
	$(DOCKER) build --build-arg "GOPROXY=$(GOPROXY)" --tag "$(GENERATOR_DEV_IMAGE)" generator

install: images ## Install or upgrade the complete stack in Docker Desktop Kubernetes
	@$(COMPOSE) -f "$(COMPOSE_FILE)" down --remove-orphans >/dev/null 2>&1 || true
	$(HELM) upgrade --install "$(KUBE_RELEASE)" "$(KUBE_CHART)" --kube-context "$(KUBE_CONTEXT)" --namespace "$(KUBE_NAMESPACE)" --create-namespace --wait --timeout "$(KUBE_TIMEOUT)"
	$(KUBECTL) --context "$(KUBE_CONTEXT)" --namespace "$(KUBE_NAMESPACE)" rollout restart deployment/"$(KUBE_RELEASE)"-grafana deployment/"$(KUBE_RELEASE)"-generator
	$(KUBECTL) --context "$(KUBE_CONTEXT)" --namespace "$(KUBE_NAMESPACE)" wait --for=condition=available deployment --all --timeout="$(KUBE_TIMEOUT)"
	@attempt=0; until curl -fsS "$(GRAFANA_URL)/api/health" >/dev/null; do attempt=$$((attempt + 1)); if [[ $$attempt -ge 30 ]]; then echo "Grafana did not become ready at $(GRAFANA_URL)." >&2; exit 1; fi; sleep 2; done
	@echo "Grafana: $(GRAFANA_URL)"
	@echo "Pod dashboard: $(GRAFANA_URL)/d/grafana-lokiexplore-pod-monitor/pod-monitor"

start: install ## Start the full Helm stack, then watch and synchronize plugin changes
	$(DEV_SCRIPT) "$(KUBE_CONTEXT)" "$(KUBE_NAMESPACE)" "$(KUBE_RELEASE)"

dev: check ## Watch the frontend and atomically sync completed bundles into Grafana
	$(DEV_SCRIPT) "$(KUBE_CONTEXT)" "$(KUBE_NAMESPACE)" "$(KUBE_RELEASE)"

sync: check build ## Build and synchronize the plugin into the running Grafana pod once
	$(SYNC_SCRIPT) "$(KUBE_CONTEXT)" "$(KUBE_NAMESPACE)" "$(KUBE_RELEASE)"

rebuild: install ## Rebuild local images and roll the Helm workloads

status: check ## Show Helm status, pods, services, and exposed local ports
	$(HELM) status "$(KUBE_RELEASE)" --kube-context "$(KUBE_CONTEXT)" --namespace "$(KUBE_NAMESPACE)"
	$(KUBECTL) --context "$(KUBE_CONTEXT)" --namespace "$(KUBE_NAMESPACE)" get pods,services

logs: check ## Follow all local-stack pod logs
	$(KUBECTL) --context "$(KUBE_CONTEXT)" --namespace "$(KUBE_NAMESPACE)" logs -l "app.kubernetes.io/instance=$(KUBE_RELEASE)" --all-containers --prefix --follow --max-log-requests=20

test: check ## Run the chart's end-to-end service, plugin, log, metric, and dashboard checks
	$(HELM) test "$(KUBE_RELEASE)" --kube-context "$(KUBE_CONTEXT)" --namespace "$(KUBE_NAMESPACE)" --logs --timeout "$(KUBE_TIMEOUT)"

review: ## Capture the current UI review screenshots
	$(PNPM) run ui-review:log-details

stop: ## Uninstall only the local Helm stack
	@if $(HELM) status "$(KUBE_RELEASE)" --kube-context "$(KUBE_CONTEXT)" --namespace "$(KUBE_NAMESPACE)" >/dev/null 2>&1; then $(HELM) uninstall "$(KUBE_RELEASE)" --kube-context "$(KUBE_CONTEXT)" --namespace "$(KUBE_NAMESPACE)" --wait; fi
	@$(KUBECTL) --context "$(KUBE_CONTEXT)" delete namespace "$(KUBE_NAMESPACE)" --ignore-not-found

compose-start: ## Explicit fallback: start the legacy Docker Compose stack
	$(PNPM) run start

compose-stop: ## Stop the legacy Docker Compose stack
	$(COMPOSE) -f "$(COMPOSE_FILE)" down --remove-orphans

kube-start: install ## Compatibility alias for installing the Helm stack
kube-status: status ## Compatibility alias for showing Helm stack status
kube-test: test ## Compatibility alias for running Helm acceptance tests
kube-stop: stop ## Compatibility alias for uninstalling the Helm stack
