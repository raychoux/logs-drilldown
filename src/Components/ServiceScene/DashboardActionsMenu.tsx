import React, { startTransition, useState } from 'react';

import { t } from '@grafana/i18n';
import { Dropdown, Menu, ToolbarButton } from '@grafana/ui';

import { PodMonitorAction } from './PodMonitorAction';
import { DashboardTarget } from 'services/dashboardRules';
import { testIds } from 'services/testIds';

interface Props {
  targets: DashboardTarget[];
}

export function DashboardActionsMenu({ targets }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<DashboardTarget>();
  const label = t('components.service-scene.dashboard-actions-menu.label', 'Dashboards');

  const menu = (
    <Menu ariaLabel={label} data-testid={testIds.logDetails.dashboardMenu}>
      {targets.map((target) => (
        <Menu.Item
          icon="apps"
          key={`${target.title}:${target.dashboardUrl}`}
          label={target.title}
          onClick={() => {
            setIsMenuOpen(false);
            startTransition(() => setSelectedTarget(target));
          }}
          testId={testIds.logDetails.dashboardMenuItem}
        />
      ))}
    </Menu>
  );

  return (
    <>
      <Dropdown onVisibleChange={setIsMenuOpen} overlay={menu} placement="bottom-end">
        <ToolbarButton
          aria-label={label}
          data-testid={testIds.logDetails.dashboardMenuButton}
          icon="apps"
          isOpen={isMenuOpen}
          tooltip={label}
          variant="canvas"
        />
      </Dropdown>
      {selectedTarget ? (
        <PodMonitorAction
          isOpen
          onDismiss={() => setSelectedTarget(undefined)}
          showTrigger={false}
          target={selectedTarget}
        />
      ) : null}
    </>
  );
}
