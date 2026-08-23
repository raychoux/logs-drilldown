import React, { MouseEvent, useCallback } from 'react';

import { LogRowModel } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton } from '@grafana/ui';

import { testIds } from 'services/testIds';

interface Props {
  onClick(event: MouseEvent<HTMLElement>, row?: LogRowModel): void;
}

export const LogDetailsButton = ({ onClick }: Props) => {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>, row?: LogRowModel) => {
      onClick(event, row);
    },
    [onClick]
  );

  return (
    <IconButton
      aria-label={t('components.service-scene.log-details-button.aria-label', 'Open log details')}
      data-testid={testIds.logDetails.open}
      name="eye"
      onClick={handleClick}
      size="md"
      tooltip={t('components.service-scene.log-details-button.tooltip', 'Open log details')}
      tooltipPlacement="top"
      variant="secondary"
    />
  );
};
