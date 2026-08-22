import React, { useMemo } from 'react';

import { css } from '@emotion/css';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelChrome, useStyles2 } from '@grafana/ui';

import { testIds } from '../../services/testIds';
import { getPluginLogRow, LogDetailsDialog, PluginLogRow } from './LogDetailsDialog';

interface Props {
  dataFrame?: DataFrame;
  onDismiss: () => void;
  onSelect: (row: PluginLogRow) => void;
  selectedRow?: PluginLogRow;
  title: string;
}

export function PluginLogsList({ dataFrame, onDismiss, onSelect, selectedRow, title }: Props) {
  const styles = useStyles2(getStyles);
  const rows = useMemo(() => {
    if (!dataFrame) {
      return [];
    }
    return Array.from({ length: dataFrame.length }, (_, index) => getPluginLogRow(dataFrame, index)).filter(
      (row): row is PluginLogRow => row !== undefined
    );
  }, [dataFrame]);

  return (
    <PanelChrome title={title}>
      <div className={styles.list} data-testid="data-testid plugin-logs-list">
        {!rows.length && (
          <div className={styles.empty}>{t('components.service-scene.logs.empty', 'No logs found')}</div>
        )}
        {rows.map((row) => (
          <button
            key={`${row.index}-${row.time}`}
            type="button"
            className={styles.row}
            data-testid={testIds.logDetails.row}
            onClick={() => onSelect(row)}
          >
            <time className={styles.time}>{row.time}</time>
            <span className={styles.line}>{row.body}</span>
          </button>
        ))}
      </div>
      {selectedRow && <LogDetailsDialog row={selectedRow} onDismiss={onDismiss} />}
    </PanelChrome>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({ background: theme.colors.background.primary, height: '100%', overflow: 'auto' }),
  row: css({
    alignItems: 'baseline',
    background: 'transparent',
    border: 0,
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    display: 'flex',
    font: 'inherit',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1),
    textAlign: 'left',
    width: '100%',
    '&:hover': { background: theme.colors.action.hover },
  }),
  time: css({ color: theme.colors.text.secondary, flex: '0 0 auto', fontSize: theme.typography.bodySmall.fontSize }),
  line: css({
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  empty: css({ color: theme.colors.text.secondary, padding: theme.spacing(2) }),
});
