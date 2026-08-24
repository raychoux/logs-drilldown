import React, { startTransition, Suspense, useState } from 'react';

import { css } from '@emotion/css';

import { textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, LinkButton, LoadingPlaceholder, Modal } from '@grafana/ui';

import { PodMonitorDashboard } from './PodMonitorDashboard';
import { DashboardTarget } from 'services/dashboardRules';
import { testIds } from 'services/testIds';

interface Props {
  isOpen?: boolean;
  onDismiss?: () => void;
  showTrigger?: boolean;
  target: DashboardTarget;
}

export function PodMonitorAction({ isOpen, onDismiss, showTrigger = true, target }: Props) {
  const [isInternallyOpen, setIsInternallyOpen] = useState(false);
  const modalIsOpen = isOpen ?? isInternallyOpen;
  const close = () => {
    if (isOpen === undefined) {
      setIsInternallyOpen(false);
    }
    onDismiss?.();
  };
  const open = () => startTransition(() => setIsInternallyOpen(true));

  return (
    <>
      {showTrigger ? (
        <Button
          data-dashboard-url={target.dashboardUrl}
          data-field={target.field}
          data-value={target.value}
          data-testid={testIds.logDetails.monitorPod}
          icon="apps"
          onClick={open}
          size="sm"
          variant="secondary"
        >
          {target.title}
        </Button>
      ) : null}
      {modalIsOpen && (
        <Modal
          aria-label={t('components.service-scene.pod-monitor-action.dashboard-title', '{{title}}: {{value}}', {
            title: target.title,
            value: target.value,
          })}
          className={styles.modal}
          isOpen
          onDismiss={close}
          title={t('components.service-scene.pod-monitor-action.dashboard-title', '{{title}}: {{value}}', {
            title: target.title,
            value: target.value,
          })}
        >
          <div className={styles.content} data-testid={testIds.logDetails.monitorPodDialog}>
            <Suspense
              fallback={
                <LoadingPlaceholder
                  text={t('components.service-scene.pod-monitor-action.loading', 'Loading dashboard...')}
                />
              }
            >
              <PodMonitorDashboard dashboardUrl={target.dashboardUrl} />
            </Suspense>
            <Modal.ButtonRow>
              <LinkButton
                href={textUtil.sanitizeUrl(target.dashboardUrl)}
                target="_blank"
                rel="noreferrer"
                variant="secondary"
              >
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
