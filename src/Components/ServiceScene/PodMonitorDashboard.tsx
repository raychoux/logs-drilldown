import React from 'react';

import { EmbeddedDashboard } from '@grafana/runtime';

import { testIds } from 'services/testIds';

export interface PodMonitorDashboardTarget {
  datasourceUid: string;
  from: string;
  logQuery: string;
  pod: string;
  to: string;
}

export interface PodMonitorDashboardConfig {
  initialState: string;
  uid: string;
}

export function getPodMonitorDashboardConfig(dashboardUrl: string): PodMonitorDashboardConfig {
  try {
    const url = new URL(dashboardUrl, 'http://grafana.local');
    const pathSegments = url.pathname.split('/').filter(Boolean);
    const dashboardSegmentIndex = pathSegments.lastIndexOf('d');
    const uid = pathSegments[dashboardSegmentIndex + 1];
    const slug = pathSegments[dashboardSegmentIndex + 2];

    if (dashboardSegmentIndex < 0 || !uid || !slug) {
      throw new Error('Invalid Grafana dashboard URL');
    }

    return {
      initialState: url.search,
      uid: decodeURIComponent(uid),
    };
  } catch {
    throw new Error('Invalid Grafana dashboard URL');
  }
}

export function PodMonitorDashboard({ dashboardUrl }: { dashboardUrl: string }) {
  const dashboard = getPodMonitorDashboardConfig(dashboardUrl);

  return (
    <div
      data-dashboard-renderer="grafana-embedded-dashboard-url"
      data-dashboard-url={dashboardUrl}
      data-testid={testIds.logDetails.monitorPodDashboard}
      style={{ height: 'min(76vh, 840px)', minHeight: 520, overflow: 'auto' }}
    >
      <EmbeddedDashboard initialState={dashboard.initialState} uid={dashboard.uid} />
    </div>
  );
}
