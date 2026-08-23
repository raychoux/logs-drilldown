SHELL := /bin/bash

.DEFAULT_GOAL := help

PNPM ?= pnpm
COMPOSE ?= docker compose
COMPOSE_FILE ?= docker-compose.local.yaml
GRAFANA_URL ?= http://localhost:3001/grafana
NODE_MIN_MAJOR := 24

.PHONY: help check setup start dev server stop status logs review

help: ## Show available local development commands
	@awk 'BEGIN {FS = ":.*## "; printf "Logs Drilldown local development\n\nUsage:\n  make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-10s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check: ## Verify required local development tools
	@command -v node >/dev/null || { echo "Error: Node.js is required (version $(NODE_MIN_MAJOR) or newer)." >&2; exit 1; }
	@node -e 'const major = Number(process.versions.node.split(".")[0]); if (major < $(NODE_MIN_MAJOR)) { console.error(`Error: Node.js $(NODE_MIN_MAJOR)+ is required; found $${process.version}.`); process.exit(1); }'
	@command -v $(PNPM) >/dev/null || { echo "Error: pnpm is required." >&2; exit 1; }
	@$(COMPOSE) version >/dev/null || { echo "Error: Docker Compose is required." >&2; exit 1; }
	@docker info >/dev/null 2>&1 || { echo "Error: the Docker daemon is not running or is not accessible." >&2; exit 1; }

setup: check ## Install dependencies from the lockfile
	$(PNPM) install --frozen-lockfile --ignore-scripts

start: check ## Build the plugin, start Grafana and Loki, then watch for changes
	@echo "Starting Logs Drilldown at $(GRAFANA_URL)"
	$(PNPM) run start

dev: check ## Watch and rebuild the plugin (use with make server)
	$(PNPM) run dev

server: check ## Run the local Grafana and Loki stack in the foreground
	$(PNPM) run server

stop: ## Stop and remove the local Grafana and Loki containers
	$(COMPOSE) -f $(COMPOSE_FILE) down

status: ## Show local development container status
	$(COMPOSE) -f $(COMPOSE_FILE) ps

logs: ## Follow local development container logs
	$(COMPOSE) -f $(COMPOSE_FILE) logs --follow

review: ## Capture Logs and Table dialog screenshots from the running stack
	$(PNPM) run ui-review:log-details
