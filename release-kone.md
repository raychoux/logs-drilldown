# Logs Drilldown KONE release `v2.5.1-kone-20260826-01`

<!-- cspell:words KONE kone raychoux devenv journalctl dvplat cfggs ajuoa -->

- Release date: 2026-08-26
- Source branch: `backup/plugin-logs-list`
- Plugin ID: `grafana-lokiexplore-app`
- Packaged plugin version: `2.5.1`

> [!IMPORTANT]
> `v2.5.1-kone-20260826-01` is the KONE release tag, but the plugin archive and
> `plugin.json` still report version `2.5.1`. Do not install the upstream
> `2.5.1` and this KONE build together: they use the same plugin ID and version.

## Release summary

This release keeps Grafana's native Logs and Table renderers and extends the
native log-details experience. It does not replace the core log renderer.

### Log-details improvements

- Opens the enhanced details view from the native Logs and Table renderers.
- Anchors details to the right by default so log rows remain visible and
  clickable.
- Constrains **Display inline** mode to half of the Logs area.
- Adds full-screen details mode with `Escape` and toolbar-button exit paths.
- Restores the previous anchored or inline layout after leaving full screen.
- Keeps dashboard menus and dashboard modals interactive in full-screen mode.
- Initializes **Wrap lines** as disabled whenever a new **Show context** dialog
  opens, without preventing users from enabling it afterward.
- Preserves Grafana's native filtering, context, deduplication, sorting,
  infinite scrolling, row actions, display options, and live updates.

### Data-driven dashboards

- Adds ordered, configurable dashboard rules for indexed labels and Loki
  structured metadata.
- Supports `exact`, `contains`, and `regex` field-name matching.
- Supports optional `valueRegex` filtering.
- Supports optional `valueTransform` extraction or rewriting before `{{value}}`
  is rendered, while `{{rawValue}}` retains the original field value.
- Supports optional `requiredFields`; all required values must be non-empty and
  must come from the rule's configured source.
- Groups all matching dashboards under one compact **Dashboards** toolbar menu.
- Renders the selected dashboard in an in-app Grafana modal using Grafana's
  native `EmbeddedDashboard` component.
- Supports URL templates using the matched field, related row fields, current
  datasource, LogQL selector, time range, and timezone.
- Keeps the Logs Drilldown route open while a dashboard is displayed.

### Development and release tooling

- Adds a complete Helm-based local environment with Grafana, Loki, Tempo,
  Prometheus, Alloy, generated logs/traces, and real Kubernetes pod metrics.
- Adds atomic plugin synchronization into the local Grafana pod.
- Adds visual review screenshots and browser coverage for native details,
  dashboard menus, dashboard modals, and full-screen behavior.
- Adds fork release packaging, provenance attestation, ZIP/SHA1 assets, and
  optional plugin signing.
- Updates `nanoid` to `3.3.18` to address CVE-2026-67213.

## Compatibility and release constraints

The custom UI was exercised during development with Grafana 12.3.1 and the
Helm environment uses Grafana 13.1.3. However, the current source manifest still
contains this dependency range:

```text
>=11.6.11-0 <12 || >=12.0.10-0 <12.1 || >=12.1.7-0 <12.2 || >=12.2.5-0
```

That declaration does **not** include Grafana 12.3.1 or 13.x. Before production
deployment, use one of these approaches:

1. **Recommended:** update `src/plugin.json`, rebuild, sign, and publish a new
   archive whose dependency range explicitly includes the Grafana versions you
   support.
2. **Internal unsigned deployment only:** extract the release archive and patch
   its `plugin.json` dependency range before installation.

Example internal-only patch for Grafana 12.3.1:

```bash
jq '.dependencies.grafanaDependency = ">=12.3.1-0 <12.4.0-0"' \
  grafana-lokiexplore-app/plugin.json > plugin.json.tmp
mv plugin.json.tmp grafana-lokiexplore-app/plugin.json
```

Changing `plugin.json` invalidates an existing plugin signature. A patched
archive must therefore be treated as unsigned or rebuilt and signed again.

## Download and verify

When the GitHub release is published, download the ZIP and checksum from:

```text
https://github.com/raychoux/logs-drilldown/releases/tag/v2.5.1-kone-20260826-01
```

Using GitHub CLI:

```bash
mkdir -p /tmp/logs-drilldown-kone
cd /tmp/logs-drilldown-kone

gh release download v2.5.1-kone-20260826-01 \
  --repo raychoux/logs-drilldown \
  --pattern 'grafana-lokiexplore-app-2.5.1.zip*'
```

The release workflow writes only the hexadecimal digest to the `.sha1` file,
so compare it manually:

```bash
actual=$(sha1sum grafana-lokiexplore-app-2.5.1.zip | awk '{print $1}')
expected=$(tr -d '[:space:]' < grafana-lokiexplore-app-2.5.1.zip.sha1)
test "$actual" = "$expected" && echo 'Checksum OK'
```

Extract and inspect the archive:

```bash
unzip grafana-lokiexplore-app-2.5.1.zip
jq '{id, version: .info.version, grafana: .dependencies.grafanaDependency}' \
  grafana-lokiexplore-app/plugin.json
```

Expected plugin ID: `grafana-lokiexplore-app`.

## Deploy to Grafana 12.3.1 with Docker

Because the current GitHub package is unsigned, Grafana must explicitly allow
this plugin ID. Build a small internal Grafana image so every container starts
with the same plugin files.

```dockerfile
FROM grafana/grafana:12.3.1

USER root
COPY --chown=grafana:root grafana-lokiexplore-app \
  /var/lib/grafana/plugins/grafana-lokiexplore-app
USER grafana

ENV GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=grafana-lokiexplore-app
ENV GF_PLUGINS_PREINSTALL_DISABLED=true
```

Build and start it:

```bash
docker build -t grafana-with-logs-drilldown-kone:2.5.1 .

docker run --name grafana-kone --rm \
  -p 3000:3000 \
  -e GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=grafana-lokiexplore-app \
  -e GF_PLUGINS_PREINSTALL_DISABLED=true \
  -v "$PWD/provisioning:/etc/grafana/provisioning:ro" \
  grafana-with-logs-drilldown-kone:2.5.1
```

`GF_PLUGINS_PREINSTALL_DISABLED=true` prevents Grafana's preinstall mechanism
from replacing the KONE build with the public plugin that has the same ID.

## Configure dashboard rendering

The target dashboard must already exist in the **same Grafana instance**. The
popup resolves a local `/d/<uid>/<slug>` route and renders that dashboard with
Grafana's native component; it does not embed a dashboard from another Grafana
server.

For the Kubernetes resource dashboard, the selected log row must contain these
four non-empty Loki structured-metadata fields:

- `container_name`
- `namespace`
- `pod_name`
- `cluster`

A parsed field or indexed label with the same name does not satisfy a rule whose
`source` is `structured`.

### Configure in the Grafana UI

1. Open **Administration > Plugins and data > Plugins**.
2. Open **Grafana Logs Drilldown**.
3. Select **Configuration**.
4. Set **Log field dashboard rules** to the JSON below.
5. Save settings and reload Logs Drilldown.

```json
[
  {
    "title": "Kubernetes resource usage",
    "field": "pod_name",
    "fieldMatch": "exact",
    "requiredFields": ["container_name", "namespace", "pod_name", "cluster"],
    "source": "structured",
    "dashboardUrl": "/d/common-k8s-resources/kubernetes-resource-usage-tf?orgId=3&from={{from}}&to={{to}}&timezone={{timezone}}&var-cluster={{fields.cluster}}&var-namespace={{fields.namespace}}&var-pod={{fields.pod_name}}&var-container={{fields.container_name}}&refresh=30s"
  },
  {
    "title": "Node Exporter",
    "field": "node_name",
    "fieldMatch": "exact",
    "requiredFields": ["cluster"],
    "source": "structured",
    "valueTransform": {
      "regex": "^[^.]+\\.(\\d{1,3}(?:\\.\\d{1,3}){3})$",
      "replacement": "$1"
    },
    "dashboardUrl": "/d/dvplat-7d5771asa7f451fb7753/node-exporter-nodes?orgId=3&from=now-1h&to=now&timezone=browser&var-datasource=cfggs9cj1ajuoa&var-cluster={{fields.cluster}}&var-instance={{value}}:9100&refresh=30s"
  }
]
```

To always open the dashboard at the last hour instead of using the current Logs
Drilldown range, replace `from={{from}}&to={{to}}` with
`from=now-1h&to=now`.

### Provision the plugin configuration

Create `/etc/grafana/provisioning/plugins/logs-drilldown.yaml`:

```yaml
apiVersion: 1

apps:
  - type: grafana-lokiexplore-app
    org_id: 1
    org_name: Main Org.
    disabled: false
    jsonData:
      dataSource: loki
      dashboardRules:
        - title: Kubernetes resource usage
          field: pod_name
          fieldMatch: exact
          requiredFields:
            - container_name
            - namespace
            - pod_name
            - cluster
          source: structured
          dashboardUrl: /d/common-k8s-resources/kubernetes-resource-usage-tf?orgId=3&from={{from}}&to={{to}}&timezone={{timezone}}&var-cluster={{fields.cluster}}&var-namespace={{fields.namespace}}&var-pod={{fields.pod_name}}&var-container={{fields.container_name}}&refresh=30s
        - title: Node Exporter
          field: node_name
          fieldMatch: exact
          requiredFields:
            - cluster
          source: structured
          valueTransform:
            regex: '^[^.]+\.(\d{1,3}(?:\.\d{1,3}){3})$'
            replacement: '$1'
          dashboardUrl: /d/dvplat-7d5771asa7f451fb7753/node-exporter-nodes?orgId=3&from=now-1h&to=now&timezone=browser&var-datasource=cfggs9cj1ajuoa&var-cluster={{fields.cluster}}&var-instance={{value}}:9100&refresh=30s
```

If the Loki datasource UID is not `loki`, set `dataSource` to the real UID.

## Kubernetes deployment

For Kubernetes, use an internal image based on `grafana/grafana:12.3.1` that
already contains the patched plugin directory. This is more reliable than
copying the plugin into a running pod.

Minimum container configuration:

```yaml
env:
  - name: GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS
    value: grafana-lokiexplore-app
  - name: GF_PLUGINS_PREINSTALL_DISABLED
    value: 'true'
volumeMounts:
  - name: logs-drilldown-provisioning
    mountPath: /etc/grafana/provisioning/plugins/logs-drilldown.yaml
    subPath: logs-drilldown.yaml
    readOnly: true
```

Mount the provisioning YAML from a ConfigMap, then restart the Grafana workload:

```bash
kubectl -n <grafana-namespace> rollout restart deployment/<grafana-deployment>
kubectl -n <grafana-namespace> rollout status deployment/<grafana-deployment>
```

The chart under `devenv/helm/logs-drilldown` is intended for local development,
not as a production Grafana chart.

## Bare-metal deployment

Stop Grafana, back up the old plugin, and copy the extracted KONE directory:

```bash
sudo systemctl stop grafana-server
sudo mv /var/lib/grafana/plugins/grafana-lokiexplore-app \
  /var/lib/grafana/plugins/grafana-lokiexplore-app.backup 2>/dev/null || true
sudo cp -a grafana-lokiexplore-app \
  /var/lib/grafana/plugins/grafana-lokiexplore-app
sudo chown -R grafana:grafana \
  /var/lib/grafana/plugins/grafana-lokiexplore-app
```

Configure `/etc/grafana/grafana.ini`:

```ini
[plugins]
allow_loading_unsigned_plugins = grafana-lokiexplore-app
preinstall_disabled = true
```

Install the provisioning YAML, then restart Grafana:

```bash
sudo systemctl restart grafana-server
sudo journalctl -u grafana-server -f
```

## Post-deployment verification

Check Grafana health, plugin registration, and the target dashboard:

```bash
curl -fsS http://localhost:3000/api/health
curl -fsS -u admin:admin \
  http://localhost:3000/api/plugins/grafana-lokiexplore-app/settings
curl -fsS -u admin:admin \
  http://localhost:3000/api/dashboards/uid/common-k8s-resources
```

Then verify the user flow:

1. Open Logs Drilldown with a Loki stream containing the four required
   structured-metadata fields.
2. Open a log row's details.
3. Confirm the **Dashboards** icon appears in the details toolbar.
4. Select **Kubernetes resource usage**.
5. Confirm the dashboard opens in a modal without leaving Logs Drilldown.
6. Confirm cluster, namespace, pod, and container variables match the log row.
7. Enter full-screen details, open the dashboard menu, and verify the dashboard
   modal remains interactive.
8. Open **Show context** and confirm **Wrap lines** starts disabled.

After replacing an existing plugin build, restart Grafana and hard-refresh the
browser (`Ctrl+Shift+R`) to discard old lazy-loaded plugin chunks.

## Rollback

Docker or Kubernetes:

1. Redeploy the previous Grafana image containing the previous plugin build.
2. Restore the previous plugin provisioning ConfigMap.
3. Restart Grafana and hard-refresh the browser.

Bare metal:

```bash
sudo systemctl stop grafana-server
sudo rm -rf /var/lib/grafana/plugins/grafana-lokiexplore-app
sudo mv /var/lib/grafana/plugins/grafana-lokiexplore-app.backup \
  /var/lib/grafana/plugins/grafana-lokiexplore-app
sudo systemctl start grafana-server
```

## Known limitations

- The current artifact is unsigned unless `GRAFANA_ACCESS_POLICY_TOKEN` is set
  during release packaging.
- The packaged version is still `2.5.1`; the KONE date is represented by the Git
  tag, not `plugin.json`.
- The current manifest does not declare Grafana 12.3.1 or 13.x compatibility;
  update and rebuild it for a clean production release.
- Dashboard routes must refer to dashboards installed in the same Grafana
  instance.
- Dashboard rules match indexed labels and/or structured metadata, never parsed
  fields.
- An empty `dashboardRules` array disables all dashboard actions.
