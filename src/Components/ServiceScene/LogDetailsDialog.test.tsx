import React from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { FieldType, toDataFrame } from '@grafana/data';

import { testIds } from '../../services/testIds';
import { getPluginLogRow, LogDetailsDialog } from './LogDetailsDialog';

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

  test('exposes the display-only Monitor action and close callback', () => {
    const onDismiss = jest.fn();
    const row = getPluginLogRow(frame, 0);
    if (!row) {
      throw new Error('expected a log row');
    }
    render(<LogDetailsDialog row={row} onDismiss={onDismiss} />);
    expect(screen.getByTestId(testIds.logDetails.monitor)).toHaveAccessibleName('Monitor log line');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalled();
  });
});
