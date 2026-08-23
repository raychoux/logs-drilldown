import { FieldType, toDataFrame } from '@grafana/data';

import { getPodMonitorTarget, initializeNativeLogContextWrap } from './LogsListScene';

function createLogContextDialog(checked: boolean): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.innerHTML = `
    <button data-testid="revert-button" type="button"></button>
    <input role="switch" type="checkbox" ${checked ? 'checked' : ''} />
  `;
  document.body.append(dialog);
  return dialog;
}

describe('initializeNativeLogContextWrap', () => {
  afterEach(() => document.body.replaceChildren());

  it('turns wrapping off once and preserves later user changes in the same dialog', () => {
    const dialog = createLogContextDialog(true);
    const wrapToggle = dialog.querySelector<HTMLInputElement>('input[role="switch"]');

    const initializedDialog = initializeNativeLogContextWrap(document);

    expect(initializedDialog).toBe(dialog);
    expect(wrapToggle).not.toBeChecked();

    wrapToggle?.click();
    initializeNativeLogContextWrap(document, initializedDialog);

    expect(wrapToggle).toBeChecked();
  });

  it('initializes a newly opened dialog and ignores unrelated switches', () => {
    const unrelatedDialog = document.createElement('div');
    unrelatedDialog.setAttribute('role', 'dialog');
    unrelatedDialog.innerHTML = '<input role="switch" type="checkbox" checked />';
    document.body.append(unrelatedDialog);

    expect(initializeNativeLogContextWrap(document)).toBeUndefined();
    expect(unrelatedDialog.querySelector('input')).toBeChecked();

    const firstDialog = createLogContextDialog(false);
    const initializedDialog = initializeNativeLogContextWrap(document);
    firstDialog.remove();
    const nextDialog = createLogContextDialog(true);

    const nextInitializedDialog = initializeNativeLogContextWrap(document, initializedDialog);

    expect(nextInitializedDialog).toBe(nextDialog);
    expect(nextDialog.querySelector('input')).not.toBeChecked();
  });
});

describe('getPodMonitorTarget', () => {
  const createLogsFrame = (labelTypes: Record<string, string>, labels: Record<string, string>) =>
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1_000] },
        { name: 'Line', type: FieldType.string, values: ['selected log body'] },
        { name: 'labels', type: FieldType.other, values: [labels] },
        { name: 'labelTypes', type: FieldType.other, values: [labelTypes] },
      ],
    });

  it.each(['I', 'S'])('builds a pod dashboard target for %s pod metadata', (podType) => {
    const frame = createLogsFrame(
      { cluster: 'I', namespace: 'S', pod: podType },
      { cluster: 'prod-us', namespace: 'observability', pod: 'tempo-ingester-abc123' }
    );

    const target = getPodMonitorTarget(
      [frame],
      0,
      '?from=now-30m&to=now&timezone=browser',
      '12:00 selected log body',
      '/grafana'
    );

    expect(target?.pod).toBe('tempo-ingester-abc123');
    const url = new URL(target?.dashboardUrl ?? '', 'http://localhost');
    expect(url.pathname).toBe('/grafana/d/k8s_views_pods/kubernetes-views-pods');
    expect(url.searchParams.get('var-pod')).toBe('tempo-ingester-abc123');
    expect(url.searchParams.get('var-namespace')).toBe('observability');
    expect(url.searchParams.get('var-cluster')).toBe('prod-us');
    expect(url.searchParams.get('from')).toBe('now-30m');
    expect(url.searchParams.get('to')).toBe('now');
    expect(url.searchParams.get('timezone')).toBe('browser');
  });

  it('accepts pod-like keys but ignores parsed pod fields', () => {
    const structuredFrame = createLogsFrame({ 'k8s.pod.name': 'S' }, { 'k8s.pod.name': 'querier-0' });
    const parsedFrame = createLogsFrame({ pod_name: 'P' }, { pod_name: 'untrusted-parser-value' });

    expect(getPodMonitorTarget([structuredFrame], 0)?.pod).toBe('querier-0');
    expect(getPodMonitorTarget([parsedFrame], 0)).toBeUndefined();
  });
});
