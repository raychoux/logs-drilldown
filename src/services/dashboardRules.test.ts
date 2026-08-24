import { FieldType, toDataFrame } from '@grafana/data';

import { DashboardRule, getDashboardTargets, parseDashboardRules, parseDashboardRulesText } from './dashboardRules';

function createLogsFrame(labelTypes: Record<string, string>, labels: Record<string, string>) {
  return toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [1_000] },
      { name: 'Line', type: FieldType.string, values: ['selected log body'] },
      { name: 'labels', type: FieldType.other, values: [labels] },
      { name: 'labelTypes', type: FieldType.other, values: [labelTypes] },
    ],
  });
}

const overviewRule: DashboardRule = {
  dashboardUrl:
    '/d/pod-overview/pods?view=overview&var-pod={{value}}&var-namespace={{fields.namespace}}&var-query={{logQuery}}&var-ds={{datasource}}',
  field: 'pod',
  fieldMatch: 'contains',
  source: 'indexed-or-structured',
  title: 'Pod overview',
};

const diagnosticsRule: DashboardRule = {
  ...overviewRule,
  dashboardUrl: '/d/pod-diagnostics/pods?var-pod={{value}}',
  title: 'Pod diagnostics',
};

describe('getDashboardTargets', () => {
  it('returns every matching rule in configured order with rendered URL context', () => {
    const frame = createLogsFrame(
      { cluster: 'I', namespace: 'S', pod_name: 'S' },
      { cluster: 'prod-us', namespace: 'observability', pod_name: 'tempo-ingester-0' }
    );

    const targets = getDashboardTargets(
      [frame],
      0,
      [overviewRule, diagnosticsRule],
      '?from=now-30m&to=now&timezone=browser&var-ds=prod-loki',
      'selected log body',
      '/grafana'
    );

    expect(targets.map((target) => target.title)).toEqual(['Pod overview', 'Pod diagnostics']);
    expect(targets[0]).toMatchObject({
      field: 'pod_name',
      value: 'tempo-ingester-0',
      logQuery: '{cluster="prod-us"} | pod_name="tempo-ingester-0"',
    });
    const overviewUrl = new URL(targets[0].dashboardUrl, 'http://localhost');
    expect(overviewUrl.pathname).toBe('/grafana/d/pod-overview/pods');
    expect(overviewUrl.searchParams.get('var-pod')).toBe('tempo-ingester-0');
    expect(overviewUrl.searchParams.get('var-namespace')).toBe('observability');
    expect(overviewUrl.searchParams.get('var-query')).toBe('{cluster="prod-us"} | pod_name="tempo-ingester-0"');
    expect(overviewUrl.searchParams.get('var-ds')).toBe('prod-loki');
    expect(overviewUrl.searchParams.get('from')).toBe('now-30m');
    expect(overviewUrl.searchParams.get('to')).toBe('now');
    expect(overviewUrl.searchParams.get('timezone')).toBe('browser');
  });

  it('honors field matching, source selection, and value regex', () => {
    const frame = createLogsFrame(
      { app: 'I', pod: 'P', workload: 'S' },
      { app: 'payments', pod: 'parsed-pod', workload: 'payments-api-7d9' }
    );
    const rules: DashboardRule[] = [
      {
        dashboardUrl: '/d/apps/apps?var-app={{value}}',
        field: '^app$',
        fieldMatch: 'regex',
        source: 'indexed',
        title: 'App dashboard',
        valueRegex: '^pay',
      },
      {
        dashboardUrl: '/d/workloads/workloads?var-workload={{value}}',
        field: 'workload',
        fieldMatch: 'exact',
        source: 'structured',
        title: 'Workload dashboard',
      },
      {
        dashboardUrl: '/d/pods/pods?var-pod={{value}}',
        field: 'pod',
        fieldMatch: 'exact',
        source: 'indexed-or-structured',
        title: 'Parsed pod must not match',
      },
    ];

    expect(getDashboardTargets([frame], 0, rules).map((target) => target.title)).toEqual([
      'App dashboard',
      'Workload dashboard',
    ]);
  });

  it('drops URL parameters whose field placeholders are unavailable', () => {
    const frame = createLogsFrame({ pod: 'I' }, { pod: 'api-0' });
    const target = getDashboardTargets([frame], 0, [overviewRule])[0];
    const url = new URL(target.dashboardUrl, 'http://localhost');

    expect(url.searchParams.has('var-namespace')).toBe(false);
  });
});

describe('dashboard rule validation', () => {
  it('applies defaults to valid persisted rules', () => {
    expect(parseDashboardRules([{ dashboardUrl: '/d/apps/apps', field: 'app', title: 'App dashboard' }])).toEqual([
      {
        dashboardUrl: '/d/apps/apps',
        field: 'app',
        fieldMatch: 'exact',
        source: 'indexed-or-structured',
        title: 'App dashboard',
      },
    ]);
  });

  it('rejects malformed JSON, invalid regex, and non-dashboard URLs', () => {
    expect(() => parseDashboardRulesText('{')).toThrow('Dashboard rules must be valid JSON.');
    expect(() =>
      parseDashboardRules([
        {
          dashboardUrl: '/d/apps/apps',
          field: '[',
          fieldMatch: 'regex',
          source: 'indexed',
          title: 'Invalid regex',
        },
      ])
    ).toThrow('contains an invalid regular expression');
    expect(() => parseDashboardRules([{ dashboardUrl: '/explore', field: 'app', title: 'Invalid URL' }])).toThrow(
      'must be a Grafana /d/<uid>/<slug> URL'
    );
  });
});
