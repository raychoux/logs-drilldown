import React from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';

import { testIds } from 'services/testIds';

interface Props {
  isFullscreen: boolean;
  onToggle: () => void;
}

export function LogDetailsFullscreenButton({ isFullscreen, onToggle }: Props) {
  const label = isFullscreen
    ? t('components.service-scene.log-details-fullscreen-button.exit', 'Exit fullscreen')
    : t('components.service-scene.log-details-fullscreen-button.enter', 'Enter fullscreen');

  return (
    <ToolbarButton
      aria-label={label}
      data-testid={testIds.logDetails.fullscreenToggle}
      icon={isFullscreen ? 'compress-arrows' : 'expand-arrows'}
      onClick={onToggle}
      tooltip={label}
      variant={isFullscreen ? 'active' : 'canvas'}
    />
  );
}
