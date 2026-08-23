import React from 'react';

import { EmbeddedDashboard } from '@grafana/runtime';

import { testIds } from 'services/testIds';

export const POD_MONITOR_DASHBOARD_UID = 'grafana-lokiexplore-pod-monitor';

export interface PodMonitorDashboardTarget {
  datasourceUid: string;
  from: string;
  logQuery: string;
  pod: string;
  to: string;
}

export function getPodMonitorDashboardState(target: PodMonitorDashboardTarget): string {
  const state = new URLSearchParams({
    from: target.from,
    to: target.to,
    'var-ds': target.datasourceUid,
    'var-pod': target.pod,
    'var-pod_query': target.logQuery,
  });

  return `?${state.toString()}`;
}

export function PodMonitorDashboard({ target }: { target: PodMonitorDashboardTarget }) {
  return (
    <div
      data-dashboard-renderer="grafana-embedded-dashboard"
      data-testid={testIds.logDetails.monitorPodDashboard}
      style={{ height: 'min(76vh, 840px)', minHeight: 520, overflow: 'auto' }}
    >
      <EmbeddedDashboard initialState={getPodMonitorDashboardState(target)} uid={POD_MONITOR_DASHBOARD_UID} />
    </div>
  );
}
