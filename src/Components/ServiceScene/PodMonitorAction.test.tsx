import React from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { PodMonitorAction } from './PodMonitorAction';
import {
  getPodMonitorDashboardState,
  POD_MONITOR_DASHBOARD_UID,
  PodMonitorDashboardTarget,
} from './PodMonitorDashboard';
import { testIds } from 'services/testIds';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  const ReactModule = jest.requireActual<typeof React>('react');

  return {
    ...actual,
    EmbeddedDashboard: ({ initialState, uid }: { initialState?: string; uid?: string }) =>
      ReactModule.createElement('div', {
        'data-initial-state': initialState,
        'data-testid': 'native-embedded-dashboard',
        'data-uid': uid,
      }),
  };
});

const target: PodMonitorDashboardTarget = {
  datasourceUid: 'loki',
  from: 'now-15m',
  logQuery: '{service_name="tempo"} | pod="tempo-0"',
  pod: 'tempo-0',
  to: 'now',
};

describe('getPodMonitorDashboardState', () => {
  it('builds native dashboard time, datasource, pod, and query state', () => {
    const state = new URLSearchParams(getPodMonitorDashboardState(target));

    expect(state.get('from')).toBe('now-15m');
    expect(state.get('to')).toBe('now');
    expect(state.get('var-ds')).toBe('loki');
    expect(state.get('var-pod')).toBe('tempo-0');
    expect(state.get('var-pod_query')).toBe('{service_name="tempo"} | pod="tempo-0"');
  });
});

describe('PodMonitorAction', () => {
  it('opens and closes Grafana embedded dashboard without navigating', () => {
    const dashboardUrl = '/grafana/d/grafana-lokiexplore-pod-monitor/pod-monitor?var-pod=tempo-0';
    render(<PodMonitorAction dashboardUrl={dashboardUrl} target={target} />);

    fireEvent.click(screen.getByTestId(testIds.logDetails.monitorPod));

    expect(screen.getByTestId(testIds.logDetails.monitorPodDialog)).toBeVisible();
    expect(screen.getByTestId(testIds.logDetails.monitorPodDashboard)).toHaveAttribute(
      'data-dashboard-renderer',
      'grafana-embedded-dashboard'
    );
    expect(screen.getByRole('dialog', { name: 'Pod monitoring: tempo-0' })).toBeVisible();
    const embeddedDashboard = screen.getByTestId('native-embedded-dashboard');
    expect(embeddedDashboard).toHaveAttribute('data-uid', POD_MONITOR_DASHBOARD_UID);
    expect(embeddedDashboard).toHaveAttribute('data-initial-state', getPodMonitorDashboardState(target));

    fireEvent.click(
      within(screen.getByTestId(testIds.logDetails.monitorPodDialog)).getByRole('button', { name: 'Close' })
    );

    expect(screen.queryByTestId(testIds.logDetails.monitorPodDialog)).not.toBeInTheDocument();
  });
});
