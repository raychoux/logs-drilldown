import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DashboardActionsMenu } from './DashboardActionsMenu';
import { DashboardTarget } from 'services/dashboardRules';
import { testIds } from 'services/testIds';

jest.mock('./PodMonitorAction', () => ({
  PodMonitorAction: ({ target }: { target: DashboardTarget }) => (
    <div data-testid="selected-dashboard">{target.title}</div>
  ),
}));

const targets: DashboardTarget[] = [
  {
    dashboardUrl: '/d/pod-overview/pod-overview?var-pod=tempo-0',
    datasourceUid: 'loki',
    field: 'pod',
    from: 'now-15m',
    logQuery: '{pod="tempo-0"}',
    title: 'Pod overview',
    to: 'now',
    value: 'tempo-0',
  },
  {
    dashboardUrl: '/d/pod-diagnostics/pod-diagnostics?var-pod=tempo-0',
    datasourceUid: 'loki',
    field: 'pod',
    from: 'now-15m',
    logQuery: '{pod="tempo-0"}',
    title: 'Pod diagnostics',
    to: 'now',
    value: 'tempo-0',
  },
];

describe('DashboardActionsMenu', () => {
  it('groups dashboard targets under one icon and opens the selected dashboard', async () => {
    const user = userEvent.setup();
    render(<DashboardActionsMenu targets={targets} />);

    expect(screen.queryByTestId(testIds.logDetails.dashboardMenu)).not.toBeInTheDocument();
    await user.click(screen.getByTestId(testIds.logDetails.dashboardMenuButton));

    expect(screen.getByTestId(testIds.logDetails.dashboardMenu)).toBeVisible();
    expect(screen.getAllByTestId(testIds.logDetails.dashboardMenuItem)).toHaveLength(2);
    expect(screen.getAllByTestId(testIds.logDetails.dashboardMenuItem).map((item) => item.textContent)).toEqual([
      'Pod overview',
      'Pod diagnostics',
    ]);

    await user.click(screen.getByText('Pod diagnostics'));

    expect(screen.getByTestId('selected-dashboard')).toHaveTextContent('Pod diagnostics');
  });
});
