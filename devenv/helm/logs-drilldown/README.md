# Helm local development environment

This chart replaces `docker-compose.local.yaml` for normal local development. One Docker Desktop Kubernetes release owns:

- Grafana with the current local Logs Drilldown plugin bundle;
- Loki, Tempo, Prometheus, and Alloy;
- the repository's rich log and trace generator;
- a real Kubernetes demo pod with pod-labelled logs;
- kubelet/cAdvisor scraping for real pod CPU, memory, and throttling metrics;
- Grafana datasource, app, and pod-monitor dashboard provisioning;
- a Helm test that verifies the whole path end to end.

All Make targets pin `--context docker-desktop` and reject non-local contexts. The ambient context is never used.

## Start

```bash
make setup        # first checkout only
make start
```

`make start` builds the plugin and two local images, installs the chart, exposes the historical local ports through Docker Desktop `LoadBalancer` services, and enters webpack watch mode. Open <http://localhost:3001/grafana>.

Use `Ctrl+C` to stop the frontend watcher; Kubernetes services continue running. Restart the watcher with `make dev`.

## Plugin development

Webpack writes changes to `dist/`. The development wrapper synchronizes each stable bundle into the Grafana pod with an atomic directory swap. To build and synchronize once:

```bash
make sync
```

Changes to `plugin.json`, provisioning, or the Grafana base version require a local image rebuild:

```bash
make rebuild
```

## Inspect and verify

```bash
make status
make logs
make test
```

The acceptance test requires real cAdvisor metric series, pod-labelled Loki logs, the loaded plugin, and the pod-monitor dashboard.

## Stop

```bash
make stop
```

This uninstalls only the `logs-drilldown-dev` release from the `logs-drilldown-dev` namespace.

## Images and mirrors

All public repositories and tags are configurable in `values.yaml`. The two project images are built locally with `imagePullPolicy: Never`:

- `logs-drilldown-grafana:dev`
- `logs-drilldown-generator:dev`

Override public images in a restricted network with a values file or `--set`, for example:

```bash
helm upgrade --install logs-drilldown-dev devenv/helm/logs-drilldown \
  --kube-context docker-desktop \
  --namespace logs-drilldown-dev \
  --set loki.image.repository=docker.m.daocloud.io/grafana/loki \
  --set tempo.image.repository=docker.m.daocloud.io/grafana/tempo \
  --set prometheus.image.repository=docker.m.daocloud.io/prom/prometheus
```
