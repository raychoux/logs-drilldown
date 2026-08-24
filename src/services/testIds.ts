export const testIds = {
  appConfig: {
    apiKey: 'data-testid ac-api-key',
    apiUrl: 'data-testid ac-api-url',
    container: 'data-testid ac-container',
    dashboardRules: 'data-testid ac-dashboard-rules',
    defaultTimeRangeEnabled: 'data-testid ac-default-time-range-enabled',
    defaultTimeRangeFrom: 'data-testid ac-default-time-range-from',
    defaultTimeRangeTo: 'data-testid ac-default-time-range-to',
    interval: 'data-testid ac-interval-input',
    pattern: 'data-testid ac-patterns-disabled',
    submit: 'data-testid ac-submit-form',
    defaultColumns: {
      labels: {
        key: 'data-testid ac-dc-label-name-input',
        value: 'ac-dc-labels-value-input',
      },
    },
  },
  breakdowns: {
    common: {
      filterButton: 'data-testid filter-button',
      filterButtonGroup: 'data-testid filter-button-group',
      filterNumericPopover: {
        cancelButton: 'data-testid filter-numeric-cancel',
        inputGreaterThan: 'data-testid filter-numeric-gt',
        inputGreaterThanInclusive: 'data-testid filter-numeric-gte',
        inputGreaterThanUnit: 'data-testid filter-numeric-gtu',
        inputLessThan: 'data-testid filter-numeric-lt',
        inputLessThanInclusive: 'data-testid filter-numeric-lte',

        inputLessThanUnit: 'data-testid filter-numeric-ltu',
        removeButton: 'data-testid filter-numeric-remove',
        submitButton: 'data-testid filter-numeric-submit',
      },
      filterSelect: 'data-testid filter-select',
      /** Primary CTAs that drill into label/field value breakdown (Labels & Fields tabs). */
      selectValueBreakdown: 'data-testid breakdown-select-value',
      sortByDirection: 'data-testid SortBy direction',
      sortByFunction: 'data-testid SortBy function',
    },
    labelFieldSearch: 'data-testid search-label-field',
    fields: {},
    labels: {},
  },
  exploreServiceDetails: {
    buttonFilterExclude: 'data-testid button-filter-exclude',
    buttonFilterInclude: 'data-testid button-filter-include',
    buttonRemovePattern: 'data-testid button-remove-pattern',
    openExplore: 'data-testid open-explore',
    searchLogs: 'data-testid search-logs',
    tabFields: 'data-testid tab-fields',
    tabLabels: 'data-testid tab-labels',
    tabLogs: 'data-testid tab-logs',
    tabPatterns: 'data-testid tab-patterns',
  },
  exploreServiceSearch: {
    search: 'data-testid search-services',
  },
  header: {
    pluginHeaderToolbar: 'data-testid plugin-header-toolbar',
    pluginInfoButton: 'data-testid plugin-info-button',
    refreshPicker: 'data-testid RefreshPicker run button',
  },

  index: {
    addNewLabelTab: 'data-testid Tab Add label tab',
    aggregatedMetricsMenu: 'data-testid aggregated-metrics-menu',
    aggregatedMetricsToggle: 'data-testid aggregated-metrics-toggle',
    header: {
      showLogsButton: 'data-testid Show logs header',
    },
    searchLabelValueInput: 'data-testid search-services-input',
    selectServiceButton: 'data-testid button-select-service',
    showLogsButton: 'data-testid button-filter-include',
  },

  logsPanelHeader: {
    header: 'data-testid Panel header Logs',
    radio: 'data-testid radio-button',
  },
  logDetails: {
    copyLink: 'data-testid log-details-copy-link',
    monitorPod: 'data-testid log-details-monitor-pod',
    monitorPodDialog: 'data-testid log-details-monitor-pod-dialog',
    monitorPodDashboard: 'data-testid log-details-monitor-pod-dashboard',
    copyLogLine: 'data-testid log-details-copy-log-line',
    dialog: 'data-testid log-details-dialog',
    fields: 'data-testid log-details-fields',
    logLine: 'data-testid log-details-log-line',
    metadata: 'data-testid log-details-metadata',
    open: 'data-testid log-details-open',
    search: 'data-testid log-details-search',
  },
  patterns: {
    buttonExcludedPattern: 'data-testid button-excluded-pattern',
    buttonIncludedPattern: 'data-testid button-included-pattern',
    tableWrapper: 'data-testid table-wrapper',
  },
  table: {
    inspectLine: 'data-testid inspect',
    rawLogLine: 'data-testid raw-log-line',
    wrapper: 'data-testid table-wrapper',
  },
  variables: {
    combobox: {},
    datasource: {
      label: 'data-testid Dashboard template variables submenu Label Data source',
    },
    lineFilters: {
      addButton: 'data-testid line-filter-add',
    },
    levels: {
      inputWrap: 'data-testid detected_level filter variable',
    },
    serviceName: {
      label: 'data-testid Dashboard template variables submenu Label Labels',
    },
  },
};
