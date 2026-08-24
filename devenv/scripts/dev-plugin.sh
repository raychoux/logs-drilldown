#!/usr/bin/env bash
set -euo pipefail

context="${1:-docker-desktop}"
namespace="${2:-logs-drilldown-dev}"
release="${3:-logs-drilldown-dev}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
sync_script="${repo_root}/devenv/scripts/sync-plugin.sh"

cd "${repo_root}"
pnpm run dev &
watcher_pid=$!
trap 'kill "${watcher_pid}" 2>/dev/null || true' EXIT INT TERM

last_fingerprint=""
stable_fingerprint=""
stable_count=0
while kill -0 "${watcher_pid}" 2>/dev/null; do
  if [[ -d dist ]]; then
    fingerprint="$(find dist -type f -printf '%P %s %T@\n' | sort | sha256sum | cut -d' ' -f1)"
    if [[ "${fingerprint}" == "${stable_fingerprint}" ]]; then
      stable_count=$((stable_count + 1))
    else
      stable_fingerprint="${fingerprint}"
      stable_count=0
    fi
    if [[ "${stable_count}" -ge 2 && "${fingerprint}" != "${last_fingerprint}" && -f dist/plugin.json && -f dist/module.js ]]; then
      "${sync_script}" "${context}" "${namespace}" "${release}"
      last_fingerprint="${fingerprint}"
    fi
  fi
  sleep 1
done

wait "${watcher_pid}"
