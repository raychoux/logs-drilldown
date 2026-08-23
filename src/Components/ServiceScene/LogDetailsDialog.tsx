import React, { useMemo, useState } from 'react';

import { css } from '@emotion/css';

import { DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ClipboardButton, IconButton, Input, Modal, useStyles2 } from '@grafana/ui';

import { getBodyName, getTimeName, parseLogsFrame } from '../../services/logsFrame';
import { testIds } from '../../services/testIds';
import { copyText, generateLogRowShortlink, getPermalinkLogRowFromDataFrame } from '../../services/text';

export interface PluginLogRow {
  body: string;
  dataFrame: DataFrame;
  fields: Array<{ name: string; value: string }>;
  index: number;
  metadata: Array<{ name: string; value: string }>;
  rowId?: string;
  time: string;
}

interface Props {
  onDismiss: () => void;
  row: PluginLogRow;
}

const toDisplayString = (value: unknown) => {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const getFieldValue = (field: Field, index: number) => toDisplayString(field.values[index]);

export function getPluginLogRow(dataFrame: DataFrame, index: number): PluginLogRow | undefined {
  const frame = parseLogsFrame(dataFrame);
  const timeField = frame?.timeField;
  const bodyField = frame?.bodyField;
  if (!frame || !timeField || !bodyField || index < 0 || index >= dataFrame.length) {
    return undefined;
  }

  const excluded = new Set([getBodyName(frame), getTimeName(frame), frame.getLabelFieldName() ?? 'labels']);
  const fields: Array<{ name: string; value: string }> = [];
  const metadata: Array<{ name: string; value: string }> = [];

  for (const field of dataFrame.fields) {
    if (excluded.has(field.name)) {
      continue;
    }
    const value = getFieldValue(field, index);
    if (!value) {
      continue;
    }
    const item = { name: field.name, value };
    if (field.labels || field.name.toLowerCase().includes('metadata')) {
      metadata.push(item);
    } else {
      fields.push(item);
    }
  }

  const labels = frame.getLogFrameLabelsAsLabels()?.[index] ?? {};
  for (const [name, value] of Object.entries(labels)) {
    if (!fields.some((field) => field.name === name) && !metadata.some((field) => field.name === name)) {
      metadata.push({ name, value: toDisplayString(value) });
    }
  }

  return {
    dataFrame,
    index,
    rowId: frame.idField ? getFieldValue(frame.idField, index) || undefined : undefined,
    body: getFieldValue(bodyField, index),
    time: getFieldValue(timeField, index),
    fields,
    metadata,
  };
}

export function getLogRowPermalink(row: PluginLogRow): string {
  const permalinkRow = getPermalinkLogRowFromDataFrame(row.dataFrame, row.index);
  if (!permalinkRow) {
    return '';
  }

  return generateLogRowShortlink(permalinkRow, { id: row.rowId ?? String(row.index), row: row.index }, 'selectedLine');
}

export function LogDetailsDialog({ onDismiss, row }: Props) {
  const [search, setSearch] = useState('');
  const styles = useStyles2(getStyles);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredFields = useMemo(
    () =>
      row.fields.filter(
        ({ name, value }) =>
          !normalizedSearch ||
          name.toLowerCase().includes(normalizedSearch) ||
          value.toLowerCase().includes(normalizedSearch)
      ),
    [normalizedSearch, row.fields]
  );
  const filteredMetadata = useMemo(
    () =>
      row.metadata.filter(
        ({ name, value }) =>
          !normalizedSearch ||
          name.toLowerCase().includes(normalizedSearch) ||
          value.toLowerCase().includes(normalizedSearch)
      ),
    [normalizedSearch, row.metadata]
  );

  return (
    <Modal
      isOpen
      onDismiss={onDismiss}
      title={t('components.service-scene.log-details.title', 'Log details')}
      aria-label={t('components.service-scene.log-details.title', 'Log details')}
      className={styles.modal}
    >
      <div data-testid={testIds.logDetails.dialog} className={styles.content}>
        <div className={styles.toolbar}>
          <Input
            data-testid={testIds.logDetails.search}
            aria-label={t('components.service-scene.log-details.search', 'Search fields and values')}
            placeholder={t('components.service-scene.log-details.search-placeholder', 'Search fields and values')}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <ClipboardButton
            aria-label={t('components.service-scene.log-details.copy-log-line', 'Copy log line')}
            data-testid={testIds.logDetails.copyLogLine}
            getText={() => row.body}
            icon="copy"
          >
            {t('components.service-scene.log-details.copy-log-line', 'Copy log line')}
          </ClipboardButton>
          <IconButton
            aria-label={t('components.service-scene.log-details.copy-link', 'Copy link to log line')}
            data-testid={testIds.logDetails.copyLink}
            tooltip={t('components.service-scene.log-details.copy-link', 'Copy link to log line')}
            name="share-alt"
            onClick={() => {
              const permalink = getLogRowPermalink(row);
              if (permalink) {
                copyText(permalink);
              }
            }}
          />
        </div>
        <section data-testid={testIds.logDetails.logLine}>
          <h3>{t('components.service-scene.log-details.log-line', 'Log line')}</h3>
          <pre className={styles.logLine}>{row.body}</pre>
          <small>{row.time}</small>
        </section>
        <section data-testid={testIds.logDetails.fields}>
          <h3>{t('components.service-scene.log-details.parsed-fields', 'Parsed fields')}</h3>
          <FieldList fields={filteredFields} empty={normalizedSearch.length > 0} />
        </section>
        <section data-testid={testIds.logDetails.metadata}>
          <h3>{t('components.service-scene.log-details.structured-metadata', 'Structured metadata')}</h3>
          <FieldList fields={filteredMetadata} empty={normalizedSearch.length > 0} />
        </section>
      </div>
    </Modal>
  );
}

function FieldList({ fields, empty }: { empty: boolean; fields: Array<{ name: string; value: string }> }) {
  if (!fields.length) {
    return (
      <div>
        {empty
          ? t('components.service-scene.log-details.no-matches', 'No matching fields')
          : t('components.service-scene.log-details.empty-value', '—')}
      </div>
    );
  }
  return (
    <dl>
      {fields.map(({ name, value }) => (
        <React.Fragment key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({ width: 'min(900px, 95vw)' }),
  content: css({ maxHeight: '70vh', overflowY: 'auto', padding: theme.spacing(1) }),
  toolbar: css({ alignItems: 'center', display: 'flex', gap: theme.spacing(1), marginBottom: theme.spacing(2) }),
  logLine: css({
    background: theme.colors.background.secondary,
    overflowX: 'auto',
    padding: theme.spacing(1),
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
});
