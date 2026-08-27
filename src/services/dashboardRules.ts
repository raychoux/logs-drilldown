import { DataFrame } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { LabelType } from './fieldsTypes';
import { parseLogsFrame } from './logsFrame';
import { getLabelTypeFromFrame } from './lokiQuery';

export type DashboardFieldMatch = 'contains' | 'exact' | 'regex';
export type DashboardFieldSource = 'indexed' | 'indexed-or-structured' | 'structured';

export interface DashboardValueTransform {
  regex: string;
  replacement: string;
}

export interface DashboardRule {
  dashboardUrl: string;
  field: string;
  fieldMatch: DashboardFieldMatch;
  requiredFields?: string[];
  source: DashboardFieldSource;
  title: string;
  valueRegex?: string;
  valueTransform?: DashboardValueTransform;
}

export interface DashboardTarget {
  dashboardUrl: string;
  datasourceUid: string;
  field: string;
  from: string;
  logQuery: string;
  title: string;
  to: string;
  value: string;
}

interface DataFrameRow {
  dataFrame: DataFrame;
  index: number;
}

interface TypedRowValue {
  key: string;
  type: LabelType;
  value: string;
}

interface DashboardTemplateContext {
  datasource: string;
  field: string;
  fields: Map<string, string>;
  from: string;
  logQuery: string;
  rawValue: string;
  tempoDatasource?: string;
  timezone: string;
  to: string;
  value: string;
}

interface DerivedField {
  datasourceUid?: unknown;
  matcherRegex?: unknown;
  name?: unknown;
}

export const DEFAULT_DASHBOARD_RULES: DashboardRule[] = [
  {
    dashboardUrl:
      '/d/grafana-lokiexplore-pod-monitor/pod-monitor?var-pod={{value}}&var-pod_query={{logQuery}}&var-namespace={{fields.namespace}}&var-cluster={{fields.cluster}}&var-ds={{datasource}}',
    field: 'pod',
    fieldMatch: 'contains',
    source: 'indexed-or-structured',
    title: 'Monitor pod',
  },
];

export function parseDashboardRules(value: unknown): DashboardRule[] {
  if (!Array.isArray(value)) {
    throw new Error('Dashboard rules must be a JSON array.');
  }

  return value.map((candidate, index) => parseDashboardRule(candidate, index));
}

export function parseDashboardRulesText(value: string): DashboardRule[] {
  try {
    return parseDashboardRules(JSON.parse(value));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Dashboard rules must be valid JSON.');
    }
    throw error;
  }
}

export function getDashboardTargets(
  dataFrames: DataFrame[],
  rowIndex: number,
  rules: DashboardRule[],
  currentSearch = '',
  rowText?: string,
  appSubUrl = ''
): DashboardTarget[] {
  const rows = getCandidateRows(dataFrames, rowIndex, rowText);
  const sourceParams = new URLSearchParams(currentSearch);
  const datasourceUid = sourceParams.get('var-ds') ?? '';
  const from = sourceParams.get('from') ?? 'now-15m';
  const to = sourceParams.get('to') ?? 'now';
  const timezone = sourceParams.get('timezone') ?? 'browser';
  const tempoDatasource = rules.some(usesTempoDatasourceTemplate) ? resolveTempoDatasource(datasourceUid) : undefined;
  const targets: DashboardTarget[] = [];

  for (const rule of rules) {
    for (const row of rows) {
      const values = getTypedRowValues(row);
      if (!hasRequiredFields(values, rule)) {
        continue;
      }
      const match = values.find((value) => matchesRule(value, rule));
      if (!match) {
        continue;
      }
      const transformedValue = transformValue(match.value, rule.valueTransform);
      if (transformedValue === undefined) {
        continue;
      }

      const logQuery = getFieldLogQuery(row, match);
      const context: DashboardTemplateContext = {
        datasource: datasourceUid,
        field: match.key,
        fields: new Map(values.map((value) => [value.key.toLowerCase(), value.value])),
        from,
        logQuery,
        rawValue: match.value,
        tempoDatasource,
        timezone,
        to,
        value: transformedValue,
      };
      const dashboardUrl = renderDashboardUrl(rule.dashboardUrl, context, sourceParams, appSubUrl);
      targets.push({
        dashboardUrl,
        datasourceUid,
        field: match.key,
        from,
        logQuery,
        title: renderTemplate(rule.title, context) ?? rule.title,
        to,
        value: transformedValue,
      });
      break;
    }
  }

  return targets;
}

function parseDashboardRule(value: unknown, index: number): DashboardRule {
  if (!isRecord(value)) {
    throw new Error(`Dashboard rule ${index + 1} must be an object.`);
  }

  const title = requiredString(value.title, index, 'title');
  const field = requiredString(value.field, index, 'field');
  const dashboardUrl = requiredString(value.dashboardUrl, index, 'dashboardUrl');
  const fieldMatch = value.fieldMatch ?? 'exact';
  const requiredFields = parseRequiredFields(value.requiredFields, index);
  const source = value.source ?? 'indexed-or-structured';
  const valueRegex = value.valueRegex;
  const valueTransform = parseValueTransform(value.valueTransform, index);

  if (!['contains', 'exact', 'regex'].includes(String(fieldMatch))) {
    throw new Error(`Dashboard rule ${index + 1} has an invalid fieldMatch.`);
  }
  if (!['indexed', 'indexed-or-structured', 'structured'].includes(String(source))) {
    throw new Error(`Dashboard rule ${index + 1} has an invalid source.`);
  }
  if (valueRegex !== undefined && typeof valueRegex !== 'string') {
    throw new Error(`Dashboard rule ${index + 1} valueRegex must be a string.`);
  }

  try {
    if (fieldMatch === 'regex') {
      new RegExp(field, 'i');
    }
    if (valueRegex) {
      new RegExp(valueRegex);
    }
    if (valueTransform) {
      new RegExp(valueTransform.regex);
    }
  } catch {
    throw new Error(`Dashboard rule ${index + 1} contains an invalid regular expression.`);
  }

  const url = new URL(dashboardUrl, 'http://grafana.local');
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const dashboardSegmentIndex = pathSegments.lastIndexOf('d');
  if (
    dashboardSegmentIndex < 0 ||
    !pathSegments[dashboardSegmentIndex + 1] ||
    !pathSegments[dashboardSegmentIndex + 2]
  ) {
    throw new Error(`Dashboard rule ${index + 1} dashboardUrl must be a Grafana /d/<uid>/<slug> URL.`);
  }

  return {
    dashboardUrl,
    field,
    fieldMatch: fieldMatch as DashboardFieldMatch,
    ...(requiredFields ? { requiredFields } : {}),
    source: source as DashboardFieldSource,
    title,
    ...(valueRegex ? { valueRegex } : {}),
    ...(valueTransform ? { valueTransform } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value: unknown, index: number, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Dashboard rule ${index + 1} ${field} is required.`);
  }
  return value.trim();
}

function parseRequiredFields(value: unknown, index: number): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Dashboard rule ${index + 1} requiredFields must be a non-empty string array.`);
  }

  const fields = value.map((field) => {
    if (typeof field !== 'string' || !field.trim()) {
      throw new Error(`Dashboard rule ${index + 1} requiredFields must contain non-empty strings.`);
    }
    return field.trim();
  });
  return Array.from(new Set(fields));
}

function parseValueTransform(value: unknown, index: number): DashboardValueTransform | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`Dashboard rule ${index + 1} valueTransform must be an object.`);
  }
  if (typeof value.regex !== 'string' || !value.regex.trim()) {
    throw new Error(`Dashboard rule ${index + 1} valueTransform regex is required.`);
  }
  if (typeof value.replacement !== 'string') {
    throw new Error(`Dashboard rule ${index + 1} valueTransform replacement must be a string.`);
  }

  return {
    regex: value.regex.trim(),
    replacement: value.replacement,
  };
}

function usesTempoDatasourceTemplate(rule: DashboardRule): boolean {
  return rule.dashboardUrl.includes('{{tempoDatasource}}') || rule.title.includes('{{tempoDatasource}}');
}

function resolveTempoDatasource(lokiDatasourceUid: string): string | undefined {
  if (!lokiDatasourceUid) {
    return undefined;
  }

  try {
    const settings = getDataSourceSrv().getInstanceSettings(lokiDatasourceUid);
    const derivedFields = isRecord(settings?.jsonData) ? settings.jsonData.derivedFields : undefined;
    if (!Array.isArray(derivedFields)) {
      return undefined;
    }

    const mappedFields = derivedFields.filter(isDerivedField).filter((field) => getDatasourceUid(field) !== undefined);
    const traceField = mappedFields.find((field) => {
      const searchableValues = [field.name, field.matcherRegex].filter(
        (value): value is string => typeof value === 'string'
      );
      return searchableValues.some((value) => /trace(?:[_-]?id)?/i.test(value));
    });
    if (traceField) {
      return getDatasourceUid(traceField);
    }

    const datasourceUidValues = Array.from(new Set(mappedFields.map(getDatasourceUid).filter(isDefined)));
    return datasourceUidValues.length === 1 ? datasourceUidValues[0] : undefined;
  } catch {
    return undefined;
  }
}

function isDerivedField(value: unknown): value is DerivedField {
  return isRecord(value);
}

function getDatasourceUid(field: DerivedField): string | undefined {
  return typeof field.datasourceUid === 'string' && field.datasourceUid.trim() ? field.datasourceUid.trim() : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function normalizeLogText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getCandidateRows(dataFrames: DataFrame[], rowIndex: number, rowText?: string): DataFrameRow[] {
  const indexedRows = dataFrames
    .filter((dataFrame) => rowIndex >= 0 && rowIndex < dataFrame.length)
    .map((dataFrame) => ({ dataFrame, index: rowIndex }));
  if (!rowText) {
    return indexedRows;
  }

  const normalizedRowText = normalizeLogText(rowText);
  const matchesRowText = ({ dataFrame, index }: DataFrameRow) => {
    const body = parseLogsFrame(dataFrame)?.bodyField.values[index];
    return body != null && normalizedRowText.includes(normalizeLogText(String(body)));
  };
  const indexedMatches = indexedRows.filter(matchesRowText);
  if (indexedMatches.length > 0) {
    return indexedMatches;
  }

  const textMatches: DataFrameRow[] = [];
  for (const dataFrame of dataFrames) {
    for (let index = 0; index < dataFrame.length; index++) {
      const candidate = { dataFrame, index };
      if (matchesRowText(candidate)) {
        textMatches.push(candidate);
      }
    }
  }
  return textMatches.length > 0 ? textMatches : indexedRows;
}

function getTypedRowValues(row: DataFrameRow): TypedRowValue[] {
  const labels = parseLogsFrame(row.dataFrame)?.getLogFrameLabelsAsLabels()?.[row.index] ?? {};
  const values: TypedRowValue[] = [];
  for (const [key, rawValue] of Object.entries(labels)) {
    const type = getLabelTypeFromFrame(key, row.dataFrame, row.index);
    const value = rawValue == null ? '' : String(rawValue).trim();
    if ((type === LabelType.Indexed || type === LabelType.StructuredMetadata) && value) {
      values.push({ key, type, value });
    }
  }
  return values;
}

function hasRequiredFields(values: TypedRowValue[], rule: DashboardRule): boolean {
  if (!rule.requiredFields) {
    return true;
  }

  return rule.requiredFields.every((requiredField) =>
    values.some((value) => value.key.toLowerCase() === requiredField.toLowerCase() && matchesSource(value, rule.source))
  );
}

function matchesSource(value: TypedRowValue, source: DashboardFieldSource): boolean {
  if (source === 'indexed') {
    return value.type === LabelType.Indexed;
  }
  if (source === 'structured') {
    return value.type === LabelType.StructuredMetadata;
  }
  return true;
}

function matchesRule(value: TypedRowValue, rule: DashboardRule): boolean {
  if (!matchesSource(value, rule.source)) {
    return false;
  }

  const key = value.key.toLowerCase();
  const configuredField = rule.field.toLowerCase();
  const fieldMatches =
    rule.fieldMatch === 'exact'
      ? key === configuredField
      : rule.fieldMatch === 'contains'
        ? key.includes(configuredField)
        : new RegExp(rule.field, 'i').test(value.key);
  return fieldMatches && (!rule.valueRegex || new RegExp(rule.valueRegex).test(value.value));
}

function transformValue(value: string, transform?: DashboardValueTransform): string | undefined {
  if (!transform) {
    return value;
  }

  const regex = new RegExp(transform.regex);
  if (!regex.test(value)) {
    return undefined;
  }

  const transformedValue = value.replace(regex, transform.replacement).trim();
  return transformedValue || undefined;
}

function toLogQLIdentifier(key: string): string {
  return key.replace(/[^a-zA-Z0-9_]/g, '_');
}

function getFieldLogQuery(row: DataFrameRow, match: TypedRowValue): string {
  const fieldMatcher = `${toLogQLIdentifier(match.key)}=${JSON.stringify(match.value)}`;
  if (match.type === LabelType.Indexed) {
    return `{${fieldMatcher}}`;
  }

  const preferredStreamLabels = ['service_name', 'service', 'cluster', 'namespace', 'env'];
  const values = getTypedRowValues(row);
  for (const preferredKey of preferredStreamLabels) {
    const streamLabel = values.find(
      (value) => value.key.toLowerCase() === preferredKey && value.type === LabelType.Indexed
    );
    if (streamLabel) {
      return `{${toLogQLIdentifier(streamLabel.key)}=${JSON.stringify(streamLabel.value)}} | ${fieldMatcher}`;
    }
  }

  return `{service_name=~".+"} | ${fieldMatcher}`;
}

function renderDashboardUrl(
  dashboardUrl: string,
  context: DashboardTemplateContext,
  sourceParams: URLSearchParams,
  appSubUrl: string
): string {
  const url = new URL(dashboardUrl, 'http://grafana.local');
  for (const [key, value] of Array.from(url.searchParams.entries())) {
    const rendered = renderTemplate(value, context);
    if (rendered === undefined) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, rendered);
    }
  }
  for (const key of ['from', 'to', 'timezone']) {
    const value = sourceParams.get(key);
    if (value && !url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }

  const route = `${url.pathname}${url.search}${url.hash}`;
  if (url.origin !== 'http://grafana.local') {
    return `${url.origin}${route}`;
  }
  if (!appSubUrl || url.pathname.startsWith(`${appSubUrl}/`) || url.pathname === appSubUrl) {
    return route;
  }
  return `${appSubUrl}${route}`;
}

function renderTemplate(template: string, context: DashboardTemplateContext): string | undefined {
  let unresolved = false;
  const rendered = template.replace(/\{\{([^}]+)\}\}/g, (_match, token: string) => {
    const value = resolveTemplateToken(token.trim(), context);
    if (value === undefined) {
      unresolved = true;
      return '';
    }
    return value;
  });
  return unresolved ? undefined : rendered;
}

function resolveTemplateToken(token: string, context: DashboardTemplateContext): string | undefined {
  if (token.startsWith('fields.')) {
    return context.fields.get(token.slice('fields.'.length).toLowerCase());
  }
  const values: Record<string, string | undefined> = {
    datasource: context.datasource,
    field: context.field,
    from: context.from,
    logQuery: context.logQuery,
    rawValue: context.rawValue,
    tempoDatasource: context.tempoDatasource,
    timezone: context.timezone,
    to: context.to,
    value: context.value,
  };
  return values[token];
}
