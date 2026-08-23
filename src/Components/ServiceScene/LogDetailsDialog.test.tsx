import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { FieldType, toDataFrame } from '@grafana/data';

import { testIds } from '../../services/testIds';
import { getLogRowPermalink, getPluginLogRow, LogDetailsDialog } from './LogDetailsDialog';

const frame = toDataFrame({
  fields: [
    { name: 'timestamp', type: FieldType.time, values: [1700000000000] },
    { name: 'line', type: FieldType.string, values: ['a very long log line'] },
    { name: 'status', type: FieldType.string, values: ['error'] },
    { name: 'labels', type: FieldType.other, values: [{ service: 'api' }] },
  ],
});

describe('LogDetailsDialog', () => {
  test('creates a safe row snapshot and filters fields', () => {
    const row = getPluginLogRow(frame, 0);
    expect(row?.body).toBe('a very long log line');
    expect(row?.metadata).toEqual([{ name: 'service', value: 'api' }]);

    if (!row) {
      throw new Error('expected a log row');
    }
    render(<LogDetailsDialog row={row} onDismiss={jest.fn()} />);
    expect(screen.getByTestId(testIds.logDetails.logLine)).toHaveTextContent('a very long log line');
    fireEvent.change(screen.getByTestId(testIds.logDetails.search), { target: { value: 'status' } });
    expect(screen.getByTestId(testIds.logDetails.fields)).toHaveTextContent('status');
    expect(screen.getByTestId(testIds.logDetails.fields)).not.toHaveTextContent('service');
  });

  test('provides native copy actions and closes on escape', () => {
    const onDismiss = jest.fn();
    const row = getPluginLogRow(frame, 0);
    if (!row) {
      throw new Error('expected a log row');
    }
    render(<LogDetailsDialog row={row} onDismiss={onDismiss} />);
    expect(screen.getByTestId(testIds.logDetails.copyLogLine)).toHaveAccessibleName('Copy log line');
    expect(screen.getByTestId(testIds.logDetails.copyLink)).toHaveAccessibleName('Copy link to log line');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalled();
  });

  test('builds the permalink from the native row labels and timestamp', () => {
    window.history.pushState({}, '', '/a/grafana-lokiexplore-app/explore/service/api/logs?from=now-5m&to=now');
    const row = getPluginLogRow(frame, 0);
    if (!row) {
      throw new Error('expected a log row');
    }

    const url = new URL(getLogRowPermalink(row));

    expect(url.searchParams.get('selectedLine')).toEqual(JSON.stringify({ id: '0', row: 0 }));
    expect(url.searchParams.get('from')).toBeTruthy();
    expect(url.searchParams.get('to')).toBeTruthy();
  });
});
