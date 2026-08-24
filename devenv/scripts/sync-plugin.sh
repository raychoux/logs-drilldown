#!/usr/bin/env bash
set -euo pipefail

context="${1:-docker-desktop}"
namespace="${2:-logs-drilldown-dev}"
release="${3:-logs-drilldown-dev}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
dist_dir="${repo_root}/dist"

if [[ ! -f "${dist_dir}/plugin.json" || ! -f "${dist_dir}/module.js" ]]; then
  echo "Plugin bundle is missing; run pnpm build first." >&2
  exit 1
fi

pod="$(kubectl --context "${context}" --namespace "${namespace}" get pod -l "app.kubernetes.io/instance=${release},app.kubernetes.io/component=grafana" -o jsonpath='{.items[0].metadata.name}')"
if [[ -z "${pod}" ]]; then
  echo "Grafana pod was not found for release ${release}." >&2
  exit 1
fi

tar -C "${dist_dir}" -cf - . | kubectl --context "${context}" --namespace "${namespace}" exec -i "${pod}" -- sh -c '
  set -eu
  base=/var/lib/grafana/plugins
  current=${base}/grafana-lokiexplore-app
  next=${base}/.grafana-lokiexplore-app.next
  previous=${base}/.grafana-lokiexplore-app.previous
  rm -rf "${next}" "${previous}"
  mkdir -p "${next}"
  tar -xf - -C "${next}"
  mv "${current}" "${previous}"
  mv "${next}" "${current}"
  rm -rf "${previous}"
'

echo "Synchronized dist/ to ${pod}."
