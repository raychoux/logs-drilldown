import React from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { PodMonitorAction } from './PodMonitorAction';
import { getPodMonitorDashboardConfig } from './PodMonitorDashboard';
import { DashboardTarget } from 'services/dashboardRules';
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

const dashboardUrl = '/grafana/d/existing-pod-dashboard/pod-overview?var-pod=tempo-0';
const target: DashboardTarget = {
  dashboardUrl,
  datasourceUid: 'loki',
  field: 'pod',
  from: 'now-15m',
  logQuery: '{service_name="tempo"} | pod="tempo-0"',
  title: 'Pod overview',
  to: 'now',
  value: 'tempo-0',
};

describe('getPodMonitorDashboardConfig', () => {
  it('derives the dashboard UID and state from an existing Grafana dashboard URL', () => {
    const dashboardUrl = '/grafana/d/existing-pod-dashboard/pod-overview?orgId=1&from=now-15m&to=now&var-pod=tempo-0';

    const dashboard = getPodMonitorDashboardConfig(dashboardUrl);

    expect(dashboard.uid).toBe('existing-pod-dashboard');
    const state = new URLSearchParams(dashboard.initialState);
    expect(state.get('orgId')).toBe('1');
    expect(state.get('from')).toBe('now-15m');
    expect(state.get('to')).toBe('now');
    expect(state.get('var-pod')).toBe('tempo-0');
  });

  it('rejects URLs that are not Grafana dashboard routes', () => {
    expect(() => getPodMonitorDashboardConfig('/grafana/explore')).toThrow('Invalid Grafana dashboard URL');
  });
});

describe('PodMonitorAction', () => {
  it('opens and closes an existing Grafana dashboard URL without navigating', () => {
    render(<PodMonitorAction target={target} />);

    fireEvent.click(screen.getByTestId(testIds.logDetails.monitorPod));

    expect(screen.getByTestId(testIds.logDetails.monitorPodDialog)).toBeVisible();
    expect(screen.getByTestId(testIds.logDetails.monitorPodDashboard)).toHaveAttribute(
      'data-dashboard-renderer',
      'grafana-embedded-dashboard-url'
    );
    expect(screen.getByTestId(testIds.logDetails.monitorPodDashboard)).toHaveAttribute(
      'data-dashboard-url',
      dashboardUrl
    );
    expect(screen.getByRole('dialog', { name: 'Pod overview: tempo-0' })).toBeVisible();
    const embeddedDashboard = screen.getByTestId('native-embedded-dashboard');
    const dashboard = getPodMonitorDashboardConfig(dashboardUrl);
    expect(embeddedDashboard).toHaveAttribute('data-uid', dashboard.uid);
    expect(embeddedDashboard).toHaveAttribute('data-initial-state', dashboard.initialState);

    fireEvent.click(
      within(screen.getByTestId(testIds.logDetails.monitorPodDialog)).getByRole('button', { name: 'Close' })
    );

    expect(screen.queryByTestId(testIds.logDetails.monitorPodDialog)).not.toBeInTheDocument();
  });
});
