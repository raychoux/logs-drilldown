import React, { startTransition, Suspense, useState } from 'react';

import { css } from '@emotion/css';

import { t } from '@grafana/i18n';
import { Button, LinkButton, LoadingPlaceholder, Modal } from '@grafana/ui';

import { PodMonitorDashboard, PodMonitorDashboardTarget } from './PodMonitorDashboard';
import { testIds } from 'services/testIds';

interface Props {
  dashboardUrl: string;
  target: PodMonitorDashboardTarget;
}

export function PodMonitorAction({ dashboardUrl, target }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);
  const open = () => startTransition(() => setIsOpen(true));

  return (
    <>
      <Button
        data-dashboard-url={dashboardUrl}
        data-pod={target.pod}
        data-testid={testIds.logDetails.monitorPod}
        icon="apps"
        onClick={open}
        size="sm"
        variant="secondary"
      >
        {t('components.service-scene.pod-monitor-action.open', 'Monitor pod')}
      </Button>
      {isOpen && (
        <Modal
          aria-label={t('components.service-scene.pod-monitor-action.title', 'Pod monitoring: {{pod}}', {
            pod: target.pod,
          })}
          className={styles.modal}
          isOpen
          onDismiss={close}
          title={t('components.service-scene.pod-monitor-action.title', 'Pod monitoring: {{pod}}', {
            pod: target.pod,
          })}
        >
          <div className={styles.content} data-testid={testIds.logDetails.monitorPodDialog}>
            <Suspense
              fallback={
                <LoadingPlaceholder
                  text={t('components.service-scene.pod-monitor-action.loading', 'Loading pod dashboard...')}
                />
              }
            >
              <PodMonitorDashboard target={target} />
            </Suspense>
            <Modal.ButtonRow>
              <LinkButton href={dashboardUrl} target="_blank" rel="noreferrer" variant="secondary">
                {t('components.service-scene.pod-monitor-action.open-full', 'Open full dashboard')}
              </LinkButton>
              <Button onClick={close} variant="primary">
                {t('components.service-scene.pod-monitor-action.close', 'Close')}
              </Button>
            </Modal.ButtonRow>
          </div>
        </Modal>
      )}
    </>
  );
}

const styles = {
  content: css({ display: 'flex', flexDirection: 'column', minHeight: 0 }),
  modal: css({ maxWidth: 'none', width: 'min(1500px, 96vw)' }),
};
