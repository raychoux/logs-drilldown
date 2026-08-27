# UI screenshot review

Capture screenshots after changing user-facing UI so the review includes both behavior and appearance.

## Start the local stack

Use the locally cached Grafana 13.1.3 image:

```bash
GRAFANA_IMAGE=grafana GRAFANA_VERSION=13.1.3 make start
```

Wait until Grafana is available at `http://localhost:3001/grafana` and the live generator has produced logs.

## Capture the log-details UI

```bash
make review
```

The command opens the same custom dialog from both native Grafana renderers and writes:

- `artifacts/ui-review/log-details-native-anchored.png`
- `artifacts/ui-review/log-details-native-inline-half.png`
- `artifacts/ui-review/log-details-native-logs.png`
- `artifacts/ui-review/log-details-native-table.png`
- `artifacts/ui-review/report/index.html`

The default review window is `now-15m` to `now`. To review against the static Loki E2E snapshot instead, start the static E2E stack and run:

```bash
UI_REVIEW_FROM=2026-04-26T11:00:00.000Z \
UI_REVIEW_TO=2026-04-26T12:05:00.000Z \
pnpm ui-review:log-details
```

The generated artifacts are intentionally ignored by Git. Attach the PNG files to the change review rather than committing them.
