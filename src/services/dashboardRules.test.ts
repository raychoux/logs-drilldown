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

  it('requires all configured structured metadata and maps Kubernetes values to the common resource dashboard', () => {
    const commonResourceRule: DashboardRule = {
      dashboardUrl:
        '/d/common-k8s-resources/kubernetes-resource-usage-tf?orgId=3&from=now-1h&to=now&timezone=browser&var-cluster={{fields.cluster}}&var-namespace={{fields.namespace}}&var-pod={{fields.pod_name}}&var-container={{fields.container_name}}&refresh=30s',
      field: 'pod_name',
      fieldMatch: 'exact',
      requiredFields: ['container_name', 'namespace', 'pod_name', 'cluster'],
      source: 'structured',
      title: 'Kubernetes resource usage',
    };
    const completeFrame = createLogsFrame(
      { cluster: 'S', container_name: 'S', namespace: 'S', pod_name: 'S' },
      {
        cluster: 'iess-sit',
        container_name: 'customer-server',
        namespace: 'iot-essential-env-sit',
        pod_name: 'customer-server-6c6c8dff68-s27lc',
      }
    );

    const [target] = getDashboardTargets([completeFrame], 0, [commonResourceRule]);
    const dashboardUrl = new URL(target.dashboardUrl, 'http://localhost');

    expect(target).toMatchObject({
      field: 'pod_name',
      title: 'Kubernetes resource usage',
      value: 'customer-server-6c6c8dff68-s27lc',
    });
    expect(dashboardUrl.pathname).toBe('/d/common-k8s-resources/kubernetes-resource-usage-tf');
    expect(Object.fromEntries(dashboardUrl.searchParams)).toEqual({
      orgId: '3',
      from: 'now-1h',
      to: 'now',
      timezone: 'browser',
      'var-cluster': 'iess-sit',
      'var-namespace': 'iot-essential-env-sit',
      'var-pod': 'customer-server-6c6c8dff68-s27lc',
      'var-container': 'customer-server',
      refresh: '30s',
    });

    const missingContainerFrame = createLogsFrame(
      { cluster: 'S', namespace: 'S', pod_name: 'S' },
      {
        cluster: 'iess-sit',
        namespace: 'iot-essential-env-sit',
        pod_name: 'customer-server-6c6c8dff68-s27lc',
      }
    );
    const indexedContainerFrame = createLogsFrame(
      { cluster: 'S', container_name: 'I', namespace: 'S', pod_name: 'S' },
      {
        cluster: 'iess-sit',
        container_name: 'customer-server',
        namespace: 'iot-essential-env-sit',
        pod_name: 'customer-server-6c6c8dff68-s27lc',
      }
    );

    expect(getDashboardTargets([missingContainerFrame], 0, [commonResourceRule])).toEqual([]);
    expect(getDashboardTargets([indexedContainerFrame], 0, [commonResourceRule])).toEqual([]);
  });

  it('extracts a node IP from structured metadata for the Node Exporter dashboard', () => {
    const nodeExporterRule: DashboardRule = {
      dashboardUrl:
        '/d/dvplat-7d5771asa7f451fb7753/node-exporter-nodes?orgId=3&from=now-1h&to=now&timezone=browser&var-datasource=cfggs9cj1ajuoa&var-cluster=dvplat&var-instance={{value}}:9100&refresh=30s',
      field: 'node_name',
      fieldMatch: 'exact',
      source: 'structured',
      title: 'Node Exporter',
      valueTransform: {
        regex: '^[^.]+\\.(\\d{1,3}(?:\\.\\d{1,3}){3})$',
        replacement: '$1',
      },
    };
    const frame = createLogsFrame(
      { node_name: 'S', service_name: 'I' },
      { node_name: 'cn-shanghai.10.131.116.71', service_name: 'node-exporter' }
    );

    const [target] = getDashboardTargets([frame], 0, [nodeExporterRule]);
    const dashboardUrl = new URL(target.dashboardUrl, 'http://localhost');

    expect(target).toMatchObject({
      field: 'node_name',
      logQuery: '{service_name="node-exporter"} | node_name="cn-shanghai.10.131.116.71"',
      title: 'Node Exporter',
      value: '10.131.116.71',
    });
    expect(dashboardUrl.pathname).toBe('/d/dvplat-7d5771asa7f451fb7753/node-exporter-nodes');
    expect(Object.fromEntries(dashboardUrl.searchParams)).toEqual({
      orgId: '3',
      from: 'now-1h',
      to: 'now',
      timezone: 'browser',
      'var-datasource': 'cfggs9cj1ajuoa',
      'var-cluster': 'dvplat',
      'var-instance': '10.131.116.71:9100',
      refresh: '30s',
    });

    const malformedNodeFrame = createLogsFrame({ node_name: 'S' }, { node_name: 'cn-shanghai.node-a' });
    const indexedNodeFrame = createLogsFrame({ node_name: 'I' }, { node_name: 'cn-shanghai.10.131.116.71' });

    expect(getDashboardTargets([malformedNodeFrame], 0, [nodeExporterRule])).toEqual([]);
    expect(getDashboardTargets([indexedNodeFrame], 0, [nodeExporterRule])).toEqual([]);
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
    expect(
      parseDashboardRules([
        {
          dashboardUrl: '/d/apps/apps',
          field: 'app',
          requiredFields: ['namespace', 'cluster'],
          title: 'App dashboard',
        },
      ])
    ).toEqual([
      {
        dashboardUrl: '/d/apps/apps',
        field: 'app',
        fieldMatch: 'exact',
        requiredFields: ['namespace', 'cluster'],
        source: 'indexed-or-structured',
        title: 'App dashboard',
      },
    ]);
  });

  it('validates and preserves value transformations', () => {
    expect(
      parseDashboardRules([
        {
          dashboardUrl: '/d/nodes/nodes?var-instance={{value}}:9100&var-node={{rawValue}}',
          field: 'node_name',
          source: 'structured',
          title: 'Node Exporter',
          valueTransform: {
            regex: '^[^.]+\\.(\\d{1,3}(?:\\.\\d{1,3}){3})$',
            replacement: '$1',
          },
        },
      ])
    ).toEqual([
      {
        dashboardUrl: '/d/nodes/nodes?var-instance={{value}}:9100&var-node={{rawValue}}',
        field: 'node_name',
        fieldMatch: 'exact',
        source: 'structured',
        title: 'Node Exporter',
        valueTransform: {
          regex: '^[^.]+\\.(\\d{1,3}(?:\\.\\d{1,3}){3})$',
          replacement: '$1',
        },
      },
    ]);

    expect(() =>
      parseDashboardRules([
        {
          dashboardUrl: '/d/nodes/nodes',
          field: 'node_name',
          title: 'Invalid transform',
          valueTransform: { regex: '[', replacement: '$1' },
        },
      ])
    ).toThrow('contains an invalid regular expression');
    expect(() =>
      parseDashboardRules([
        {
          dashboardUrl: '/d/nodes/nodes',
          field: 'node_name',
          title: 'Invalid transform',
          valueTransform: { regex: '^node\\.(.+)$' },
        },
      ])
    ).toThrow('valueTransform replacement must be a string');
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
    expect(() =>
      parseDashboardRules([
        {
          dashboardUrl: '/d/apps/apps',
          field: 'app',
          requiredFields: ['namespace', ''],
          title: 'Invalid required fields',
        },
      ])
    ).toThrow('requiredFields must contain non-empty strings');
  });
});
