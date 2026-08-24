import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { css } from '@emotion/css';
import { useResizeObserver } from '@react-aria/utils';
import { createPortal } from 'react-dom';

import { DataFrame, LoadingState, PanelData, shallowCompare } from '@grafana/data';
import { config, locationService, useChromeHeaderHeight } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneTimeRangeLike,
} from '@grafana/scenes';
import { Options } from '@grafana/schema/dist/esm/raw/composable/logs/panelcfg/x/LogsPanelCfg_types.gen';

import { plugin } from '../../module';
import { ActionBarScene } from './ActionBarScene';
import { JSONLogsScene } from './JSONLogsScene';
import { ErrorType } from './LogsPanelError';
import { LogsPanelScene } from './LogsPanelScene';
import { LogsTablePanelScene } from './LogsTablePanelScene';
import { LogsTableScene } from './LogsTableScene';
import { LogsVolumePanel, logsVolumePanelKey } from './LogsVolume/LogsVolumePanel';
import { PodMonitorAction } from './PodMonitorAction';
import { ServiceScene } from './ServiceScene';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { DEFAULT_URL_COLUMNS, DEFAULT_URL_COLUMNS_LEVELS } from 'Components/Table/constants';
import { LogLineState } from 'Components/Table/Context/TableColumnsContext';
import { SelectedTableRow } from 'Components/Table/LogLineCellComponent';
import { getFeatureFlag } from 'featureFlags/openFeature';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { areArraysEqual, areArraysStrictlyEqual } from 'services/comparison';
import {
  DEFAULT_DASHBOARD_RULES,
  DashboardRule,
  DashboardTarget,
  getDashboardTargets,
  parseDashboardRules,
} from 'services/dashboardRules';
import { logger } from 'services/logger';
import { isEmptyLogsResult } from 'services/logsFrame';
import { narrowLogsVisualizationType, narrowSelectedTableRow, unknownToStrings } from 'services/narrowing';
import { getRouteParams } from 'services/routing';
import {
  getBooleanLogOption,
  getDisplayedFieldsInStorage,
  getExpandedLogsView,
  getExplorationPrefixForLabelValue,
  getLogsVisualizationType,
  getLogsVolumeOption,
  LogsVisualizationType,
  setDisplayedFieldsInStorage,
  setLogsVisualizationType,
} from 'services/store';
import { getLabelsVariable } from 'services/variableGetters';
import { getVariablesThatCanBeCleared } from 'services/variableHelpers';

export interface LogsListSceneState extends SceneObjectState {
  $timeRange?: SceneTimeRangeLike;
  canClearFilters?: boolean;
  controlsExpanded: boolean;
  // The currently displayed fields currently in the logs panel
  displayedFields: string[];
  error?: string;
  errorType?: ErrorType;
  headerHeight: number;
  loading?: boolean;
  logsVolumeCollapsedByError?: boolean;
  // Displayed fields set by the otelLogsFormatting feature
  otelDisplayedFields: string[];
  panel?: SceneFlexLayout;
  selectedLine?: SelectedTableRow;
  tableLogLineState?: LogLineState;
  urlColumns?: string[];
  // Are the displayed fields set by the user
  userDisplayedFields: boolean;
  visualizationType: LogsVisualizationType;
}

const nativeLogDetailsAnchorSelector = 'button[aria-label="Anchor to the right"]';
const nativeLogDetailsSelector =
  'section > div[class$="panel-content"] div:has(> div > div > [data-testid="input-wrapper"]):has(button)';
const nativeLogDetailsTopOffset = 72;
const nativeLogDetailsBottomOffset = 8;
const nativeLogDetailsInlineWidth = '50%';
const nativeLogContextDialogSelector = '[role="dialog"]:has([data-testid="revert-button"])';
const nativeLogContextWrapSelector = 'input[role="switch"]';
const nativeLogDetailsCloseSelector = 'button[aria-label^="Close log details"]';
export function getConfiguredDashboardRules(): DashboardRule[] {
  const configuredRules = plugin.meta.jsonData?.dashboardRules;
  if (configuredRules === undefined) {
    return DEFAULT_DASHBOARD_RULES;
  }

  try {
    return parseDashboardRules(configuredRules);
  } catch (error) {
    logger.error(error, { msg: 'Invalid dashboard matching rules configuration' });
    return [];
  }
}

export function initializeNativeLogContextWrap(
  root: ParentNode,
  initializedDialog?: HTMLElement
): HTMLElement | undefined {
  const dialog = root.querySelector<HTMLElement>(nativeLogContextDialogSelector) ?? undefined;
  if (!dialog || dialog === initializedDialog) {
    return dialog;
  }

  const wrapToggle = dialog.querySelector<HTMLInputElement>(nativeLogContextWrapSelector);
  if (!wrapToggle) {
    return initializedDialog;
  }

  if (wrapToggle.checked) {
    wrapToggle.click();
  }
  return dialog;
}

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  panelHeight: undefined | string = undefined;
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: [
      'urlColumns',
      'selectedLine',
      'visualizationType',
      'displayedFields',
      'tableLogLineState',
      'userDisplayedFields',
    ],
  });

  private logsPanelScene?: LogsPanelScene = undefined;

  private panelWrapperEl: HTMLDivElement | null = null;

  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      displayedFields: [],
      headerHeight: 48,
      userDisplayedFields: false,
      otelDisplayedFields: [],
      visualizationType: getLogsVisualizationType(),
      // @todo true when over 1200? getDefaultControlsExpandedMode(containerElement ?? null)
      controlsExpanded: getBooleanLogOption('controlsExpanded', false),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public setPanelWrapperEl(el: HTMLDivElement | null) {
    if (el === this.panelWrapperEl) {
      return;
    }
    this.panelWrapperEl = el;
  }

  public getPanelWrapperEl(): HTMLDivElement | null {
    return this.panelWrapperEl;
  }

  public getVisibleLogSeries(): DataFrame[] {
    return sceneGraph.getData(this).state.data?.series ?? this.logsPanelScene?.state.series ?? [];
  }

  public syncPanelHeightFromWrapper = () => {
    if (!this.state.panel || !this.panelWrapperEl) {
      return;
    }
    if (getExpandedLogsView(this)) {
      this.extendPanelHeight();
      return;
    }
    const dimensions = this.panelWrapperEl.getBoundingClientRect();
    if (dimensions.height === 0) {
      return;
    }
    const offset = dimensions.y + window.scrollY;
    this.panelHeight = `calc(100vh - ${offset + 16}px)`;
    this.state.panel.state.children?.[0].setState({
      height: this.panelHeight,
    });
  };

  public extendPanelHeight = () => {
    if (!this.state.panel) {
      return;
    }
    this.state.panel.state.children?.[0].setState({
      height: `calc(100vh - ${this.state.headerHeight + 16}px)`,
    });
  };

  public static Component = ({ model }: SceneComponentProps<LogsListScene>) => {
    const { panel } = model.useState();
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [dashboardPortal, setDashboardPortal] = useState<{
      container: HTMLSpanElement;
      targets: DashboardTarget[];
    }>();
    const height = useChromeHeaderHeight();

    useEffect(() => {
      if (height) {
        model.setState({
          headerHeight: height,
        });
      }
    }, [height, model]);

    useLayoutEffect(() => {
      model.setPanelWrapperEl(wrapperRef.current);
      return () => model.setPanelWrapperEl(null);
    }, [model, panel]);

    useEffect(() => {
      const root = wrapperRef.current;
      if (!root) {
        return;
      }

      const ownerDocument = root.ownerDocument;
      const dashboardRules = getConfiguredDashboardRules();
      let anchoredCurrentPane = false;
      let initializedLogContextDialog: HTMLElement | undefined;
      let resetAnchorTimer: ReturnType<typeof setTimeout> | undefined;
      let styledPane: HTMLElement | undefined;
      let originalPaneStyle: string | null = null;
      let selectedLogIndex: number | undefined;
      let selectedLogText: string | undefined;
      let dashboardActionsContainer: HTMLSpanElement | undefined;
      let renderedDashboardTargetsKey: string | undefined;

      const removeDashboardActions = () => {
        setDashboardPortal(undefined);
        dashboardActionsContainer?.remove();
        dashboardActionsContainer = undefined;
        renderedDashboardTargetsKey = undefined;
      };

      const applyOriginalPaneStyle = () => {
        if (!styledPane) {
          return;
        }
        if (originalPaneStyle === null) {
          styledPane.removeAttribute('style');
        } else {
          styledPane.setAttribute('style', originalPaneStyle);
        }
      };

      const restorePaneStyle = () => {
        applyOriginalPaneStyle();
        styledPane = undefined;
        originalPaneStyle = null;
      };

      const preparePaneStyle = (pane: HTMLElement) => {
        if (styledPane !== pane) {
          restorePaneStyle();
          styledPane = pane;
          originalPaneStyle = pane.getAttribute('style');
        }
        applyOriginalPaneStyle();
      };

      const sizeAnchoredPane = (pane: HTMLElement) => {
        const slot = pane.parentElement;
        if (!slot) {
          return;
        }

        preparePaneStyle(pane);
        const slotBounds = slot.getBoundingClientRect();
        Object.assign(pane.style, {
          bottom: `${nativeLogDetailsBottomOffset}px`,
          height: 'auto',
          left: `${slotBounds.left}px`,
          marginLeft: '0',
          maxHeight: 'none',
          maxWidth: 'none',
          minWidth: '0',
          position: 'fixed',
          right: 'auto',
          top: `${nativeLogDetailsTopOffset}px`,
          width: `${slotBounds.width}px`,
          zIndex: '2',
        });
      };

      const sizeInlinePane = (pane: HTMLElement) => {
        preparePaneStyle(pane);
        Object.assign(pane.style, {
          marginLeft: 'auto',
          maxWidth: nativeLogDetailsInlineWidth,
          minWidth: nativeLogDetailsInlineWidth,
          width: nativeLogDetailsInlineWidth,
        });
      };

      const updateDashboardActions = (pane: HTMLElement) => {
        const visibleLogSeries = model.getVisibleLogSeries();
        const targets =
          selectedLogIndex === undefined
            ? []
            : getDashboardTargets(
                visibleLogSeries,
                selectedLogIndex,
                dashboardRules,
                locationService.getLocation().search,
                selectedLogText,
                config.appSubUrl ?? ''
              );
        const closeButton = pane.querySelector<HTMLButtonElement>(nativeLogDetailsCloseSelector);
        const buttonGroup = closeButton?.parentElement;
        const toolbar = buttonGroup?.parentElement;
        if (targets.length === 0 || !buttonGroup || !toolbar) {
          removeDashboardActions();
          return;
        }

        if (!dashboardActionsContainer || dashboardActionsContainer.parentElement !== toolbar) {
          removeDashboardActions();
          dashboardActionsContainer = ownerDocument.createElement('span');
          toolbar.insertBefore(dashboardActionsContainer, buttonGroup);
        }
        const targetsKey = targets.map((target) => `${target.title}:${target.dashboardUrl}`).join('|');
        if (renderedDashboardTargetsKey === targetsKey) {
          return;
        }

        renderedDashboardTargetsKey = targetsKey;
        setDashboardPortal({ container: dashboardActionsContainer, targets });
      };

      const updateDetailsPane = () => {
        const pane = ownerDocument.querySelector<HTMLElement>(nativeLogDetailsSelector);
        if (!pane) {
          removeDashboardActions();
          restorePaneStyle();
          if (resetAnchorTimer === undefined) {
            resetAnchorTimer = setTimeout(() => {
              anchoredCurrentPane = false;
              resetAnchorTimer = undefined;
            }, 50);
          }
          return;
        }

        if (resetAnchorTimer !== undefined) {
          clearTimeout(resetAnchorTimer);
          resetAnchorTimer = undefined;
        }

        const anchorButton = pane.querySelector<HTMLButtonElement>(nativeLogDetailsAnchorSelector);
        if (!anchoredCurrentPane && anchorButton) {
          anchoredCurrentPane = true;
          anchorButton.click();
          requestAnimationFrame(updateDetailsPane);
          return;
        }

        if (anchoredCurrentPane && !anchorButton) {
          sizeAnchoredPane(pane);
        } else if (anchorButton) {
          sizeInlinePane(pane);
        } else {
          restorePaneStyle();
        }
        updateDashboardActions(pane);
      };

      const updateNativeOverlays = () => {
        initializedLogContextDialog = initializeNativeLogContextWrap(ownerDocument, initializedLogContextDialog);
        updateDetailsPane();
      };

      const handleLogRowClick = (event: Event) => {
        const ElementConstructor = ownerDocument.defaultView?.Element;
        if (!ElementConstructor || !(event.target instanceof ElementConstructor)) {
          return;
        }
        const logRow = event.target.closest<HTMLElement>('[data-log-index]');
        if (!logRow || !root.contains(logRow)) {
          return;
        }
        const rowIndex = Number(logRow.dataset.logIndex);
        if (!Number.isInteger(rowIndex) || rowIndex < 0) {
          return;
        }
        selectedLogIndex = rowIndex;
        selectedLogText = logRow.textContent ?? undefined;
      };

      // Default each newly opened context dialog to unwrapped and each details pane to Grafana's right anchor.
      const observer = new MutationObserver(updateNativeOverlays);
      root.addEventListener('click', handleLogRowClick, true);
      observer.observe(ownerDocument.body, { childList: true, subtree: true });
      ownerDocument.defaultView?.addEventListener('resize', updateDetailsPane);
      updateNativeOverlays();

      return () => {
        observer.disconnect();
        root.removeEventListener('click', handleLogRowClick, true);
        ownerDocument.defaultView?.removeEventListener('resize', updateDetailsPane);
        if (resetAnchorTimer !== undefined) {
          clearTimeout(resetAnchorTimer);
        }
        removeDashboardActions();
        restorePaneStyle();
      };
    }, [model, panel]);

    useResizeObserver({
      onResize: () => {
        if (!panel) {
          return;
        }
        model.syncPanelHeightFromWrapper();
      },
      ref: wrapperRef,
    });

    if (!panel) {
      return;
    }

    return (
      <>
        <div className={styles.panelWrapper} ref={wrapperRef}>
          <panel.Component model={panel} />
        </div>
        {dashboardPortal
          ? createPortal(
              <div className={styles.dashboardActions}>
                {dashboardPortal.targets.map((target) => (
                  <PodMonitorAction key={`${target.title}:${target.dashboardUrl}`} target={target} />
                ))}
              </div>,
              dashboardPortal.container
            )
          : null}
      </>
    );
  };

  getUrlState() {
    const urlColumns = this.state.urlColumns ?? [];
    const selectedLine = this.state.selectedLine;
    const visualizationType = this.state.visualizationType;

    const previousUserAddedDisplayedFields = getDisplayedFieldsInStorage(this, true);
    const previousDisplayedFields = getDisplayedFieldsInStorage(this);
    const displayedFields =
      this.state.displayedFields ?? previousUserAddedDisplayedFields ?? previousDisplayedFields ?? [];
    const userDisplayedFields = this.state.userDisplayedFields;
    return {
      userDisplayedFields: JSON.stringify(userDisplayedFields),
      displayedFields: JSON.stringify(displayedFields),
      selectedLine: JSON.stringify(selectedLine),
      tableLogLineState: JSON.stringify(this.state.tableLogLineState),
      urlColumns: JSON.stringify(urlColumns),
      visualizationType: JSON.stringify(visualizationType),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LogsListSceneState> = {};
    try {
      if (typeof values.urlColumns === 'string') {
        const decodedUrlColumns: string[] = unknownToStrings(JSON.parse(values.urlColumns));
        if (decodedUrlColumns !== this.state.urlColumns) {
          stateUpdate.urlColumns = decodedUrlColumns;
        }
      }
      if (typeof values.selectedLine === 'string') {
        const unknownTableRow = narrowSelectedTableRow(JSON.parse(values.selectedLine));
        if (unknownTableRow) {
          const decodedSelectedTableRow: SelectedTableRow = unknownTableRow;
          if (decodedSelectedTableRow !== this.state.selectedLine) {
            stateUpdate.selectedLine = decodedSelectedTableRow;
          }
        }
      }

      if (typeof values.visualizationType === 'string') {
        const decodedVisualizationType = narrowLogsVisualizationType(JSON.parse(values.visualizationType));
        if (decodedVisualizationType && decodedVisualizationType !== this.state.visualizationType) {
          stateUpdate.visualizationType = decodedVisualizationType;
        }
      }

      if (typeof values.displayedFields === 'string') {
        const displayedFields = unknownToStrings(JSON.parse(values.displayedFields));
        if (displayedFields && displayedFields.length) {
          stateUpdate.displayedFields = displayedFields;
        }
      }
      if (typeof values.tableLogLineState === 'string') {
        const tableLogLineState = JSON.parse(values.tableLogLineState);
        if (tableLogLineState === LogLineState.labels || tableLogLineState === LogLineState.text) {
          stateUpdate.tableLogLineState = tableLogLineState;
        }
      }

      if (typeof values.userDisplayedFields === 'string') {
        stateUpdate.userDisplayedFields = values.userDisplayedFields === 'true';
      }
    } catch (e) {
      // URL Params can be manually changed and it will make JSON.parse() fail.
      logger.error(e, { msg: 'LogsListScene: updateFromUrl unexpected error' });
    }

    if (Object.keys(stateUpdate).length) {
      this.setState(stateUpdate);
    }
  }

  clearSelectedLine() {
    this.setState({
      selectedLine: undefined,
    });
  }

  clearDisplayedFields = () => {
    // Clearing the defaults is a user action
    this.setState({ displayedFields: [], userDisplayedFields: true });
    if (this.logsPanelScene) {
      this.logsPanelScene.clearDisplayedFields();
    }
  };

  showBackendFields = () => {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const backendDisplayedFields = serviceScene.state.backendDisplayedFields ?? [];

    setDisplayedFieldsInStorage(this, backendDisplayedFields);
    setDisplayedFieldsInStorage(this, null, true);

    const urlColumns =
      backendDisplayedFields.filter(
        (column) => DEFAULT_URL_COLUMNS.includes(column) || DEFAULT_URL_COLUMNS_LEVELS.includes(column)
      ) || [];

    this.setState({
      displayedFields: backendDisplayedFields,
      userDisplayedFields: false,
      urlColumns,
    });

    if (this.logsPanelScene?.state.body) {
      this.logsPanelScene.setLogsVizOption({
        displayedFields: backendDisplayedFields,
      });
    }
  };

  public onActivate() {
    const searchParams = new URLSearchParams(locationService.getLocation().search);
    this.setStateFromUrl(searchParams);

    if (!this.state.panel) {
      this.updateLogsPanel();
    }

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.visualizationType !== prevState.visualizationType) {
          this.updateLogsPanel();
          // Re-render the tabs to ensure the visualizationType type is set in the url
          const tabs = sceneGraph.findObject(this, (scene) => scene instanceof ActionBarScene);
          tabs?.forceRender();
        }
      })
    );

    this._subs.add(this.subscribeToLabelsVar(getLabelsVariable(this)));

    this.setDisplayedFieldsFromBackend();

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this._subs.add(
      serviceScene.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.backendDisplayedFields, prevState.backendDisplayedFields)) {
          this.setDisplayedFieldsFromBackend();
        }
      })
    );

    // Subscribe to logs query runner for error handling (all visualization types)
    const logsQueryRunner = serviceScene.state.$data;
    if (logsQueryRunner) {
      this._subs.add(
        logsQueryRunner.subscribeToState((newState, prevState) => {
          if (newState.data?.state === LoadingState.Error) {
            this.handleLogsError(newState.data);
          } else if (newState.data?.state === LoadingState.Done && isEmptyLogsResult(newState.data.series)) {
            this.handleNoData();
          } else if (this.state.error) {
            this.clearLogsError();
          }
        })
      );
    }
  }

  /**
   * On primary route change, we want to set displayed fields from local storage if the user has displayed fields configured for the new key/value
   * We cannot subscribe to the actual route parameters as if the route is cached the prevState is wrong and just shows a duplicate of the newState,
   * so we must subscribe to the variable that triggers the route change
   * @param labelsVar
   */
  private subscribeToLabelsVar = (labelsVar: AdHocFiltersVariable) => {
    return labelsVar.subscribeToState((newState, prevState) => {
      if (
        newState.filters?.[0]?.value !== prevState.filters?.[0]?.value ||
        newState.filters?.[0]?.keyLabel !== prevState.filters?.[0]?.keyLabel
      ) {
        const { labelName, labelValue } = getRouteParams(this);
        const newLabelHasUserDisplayFields = getDisplayedFieldsInStorage(this, true, {
          prefix: getExplorationPrefixForLabelValue(this, labelName, labelValue),
        });
        // Overwrite the current url state if we're switching to another label that the user already configured fields for
        if (newLabelHasUserDisplayFields) {
          this.setState({
            displayedFields: newLabelHasUserDisplayFields,
            urlColumns: newLabelHasUserDisplayFields,
            userDisplayedFields: true,
          });
        }
      }
    });
  };

  setDisplayedFieldsFromBackend() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    // If the user has configured default columns for this query
    if (serviceScene.state.backendDisplayedFields && serviceScene.state.backendDisplayedFields.length > 0) {
      // No user displayed fields
      if (
        !this.state.userDisplayedFields &&
        !areArraysStrictlyEqual(serviceScene.state.backendDisplayedFields, this.state.displayedFields)
      ) {
        // Set default columns as displayed fields
        this.setState({ displayedFields: serviceScene.state.backendDisplayedFields });
        this.updateLogsPanel();
      }
    }
  }

  handleLogsError(data: PanelData) {
    /* eslint-disable-next-line @typescript-eslint/no-deprecated */
    const error = data.errors?.length ? data.errors[0] : data.error;
    const errorResponse = error?.message;
    if (errorResponse) {
      logger.error(new Error('Logs Panel error'), {
        msg: errorResponse,
        status: error.statusText ?? 'N/A',
        type: error.type ?? 'N/A',
      });
    }

    let errorMessage = 'Unexpected error response. Please review your filters or try a different time range.';
    if (errorResponse?.includes('parse error')) {
      errorMessage =
        'Logs could not be retrieved due to invalid filter parameters. Please review your filters and try again.';
    } else if (errorResponse?.includes('response larger than the max message size')) {
      errorMessage =
        'The response is too large to process. Try narrowing your search or using filters to reduce the data size.';
    } else if (errorResponse?.toLowerCase().includes('max entries limit')) {
      errorMessage = 'Max entries limit per query exceeded. Please review your "Line limit" setting and try again.';
    }

    this.showLogsError(errorMessage);
  }

  handleNoData() {
    if (this.state.canClearFilters) {
      this.showLogsError(
        'No logs match your search. Please review your filters or try a different time range.',
        'no-logs'
      );
    } else {
      this.showLogsError(
        'No logs match your search. Please try again with different labels or an alternative time range.',
        'no-logs'
      );
    }
  }

  showLogsError(error: string, errorType: ErrorType = 'other') {
    const logsVolumeCollapsedByError = this.state.logsVolumeCollapsedByError ?? !getLogsVolumeOption('collapsed');
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    const clearableVariables = getVariablesThatCanBeCleared(indexScene);
    const canClearFilters = clearableVariables.length > 0;

    this.setState({ canClearFilters, error, errorType, logsVolumeCollapsedByError });

    // Recreate the panel with the new error state
    this.updateLogsPanel();

    if (logsVolumeCollapsedByError) {
      const logsVolume = sceneGraph.findByKeyAndType(this, logsVolumePanelKey, LogsVolumePanel);
      logsVolume?.state.panel?.setState({ collapsed: true });
    }
  }

  clearLogsError() {
    if (this.state.logsVolumeCollapsedByError) {
      const logsVolume = sceneGraph.findByKeyAndType(this, logsVolumePanelKey, LogsVolumePanel);
      logsVolume?.state.panel?.setState({ collapsed: false });
    }

    this.setState({ error: undefined, errorType: undefined, logsVolumeCollapsedByError: undefined });

    // Recreate the panel with the cleared error state
    this.updateLogsPanel();
  }

  /**
   * Sets the initial state from url params
   * @param searchParams
   * @private
   */
  private setStateFromUrl(searchParams: URLSearchParams) {
    const selectedLineUrl = searchParams.get('selectedLine');
    const urlColumnsUrl = searchParams.get('urlColumns');
    const vizTypeUrl = searchParams.get('visualizationType');

    /**
     * Ordering
     * 1. If the user has ever made an action for this
     * 2. Results from the backend
     * 3. URL state
     */
    const userDisplayFieldsFromStorage = getDisplayedFieldsInStorage(this, true);
    const userDisplayFieldsFromStorageString = userDisplayFieldsFromStorage
      ? JSON.stringify(userDisplayFieldsFromStorage)
      : null;
    const displayFieldsFromStorage = getDisplayedFieldsInStorage(this);
    const displayFieldsFromStorageString = displayFieldsFromStorage ? JSON.stringify(displayFieldsFromStorage) : null;

    // @todo need to clear displayedFields when changing primary label slug so we grab defaults from local storage
    const displayedFieldsUrl =
      searchParams.get('displayedFields') ?? userDisplayFieldsFromStorageString ?? displayFieldsFromStorageString;

    const userDisplayedFieldsUrl =
      searchParams.get('userDisplayedFields') ?? (userDisplayFieldsFromStorage ? 'true' : 'false');

    const tableLogLineState = searchParams.get('tableLogLineState');

    this.updateFromUrl({
      displayedFields: displayedFieldsUrl,
      userDisplayedFields: userDisplayedFieldsUrl,
      selectedLine: selectedLineUrl,
      tableLogLineState,
      urlColumns: urlColumnsUrl,
      visualizationType: vizTypeUrl,
    });
  }

  public setLogsVizOption = (options: Partial<Options> = {}) => {
    if (this.logsPanelScene) {
      this.logsPanelScene.setLogsVizOption(options);
    }
  };

  public updateLogsPanel = () => {
    this.setState({
      panel: this.getVizPanel(),
    });
  };

  public setVisualizationType = (type: LogsVisualizationType) => {
    let extraStateChanges: Partial<LogsListSceneState> = {};

    // Clean up default displayed fields
    if (getFeatureFlag('otelLogsFormatting') && this.state.displayedFields.length > 0) {
      if (shallowCompare(this.state.displayedFields, this.state.otelDisplayedFields)) {
        extraStateChanges = {
          displayedFields: [],
          otelDisplayedFields: [],
        };
      }
    }

    this.setState({
      visualizationType: type,
      ...extraStateChanges,
    });

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_visualization_toggle,
      {
        visualisationType: type,
      }
    );
    setLogsVisualizationType(type);
  };

  private getVizPanel() {
    const { error, errorType, canClearFilters } = this.state;

    this.logsPanelScene = new LogsPanelScene({ error, errorType, canClearFilters });
    const logsTablePanelNG = getFeatureFlag('logsTablePanelNG');

    const panelHeight = this.panelHeight ?? 'calc(100vh - 48px)';
    const children =
      this.state.visualizationType === 'logs'
        ? [
            new SceneFlexItem({
              body: this.logsPanelScene,
              height: panelHeight,
            }),
          ]
        : this.state.visualizationType === 'json'
          ? [
              new SceneFlexItem({
                body: new JSONLogsScene({ error, canClearFilters }),
                height: panelHeight,
              }),
            ]
          : [
              new SceneFlexItem({
                body: logsTablePanelNG
                  ? new LogsTablePanelScene({ error, canClearFilters })
                  : new LogsTableScene({ error, canClearFilters }),
                height: panelHeight,
              }),
            ];

    return new SceneFlexLayout({
      children,
      direction: 'column',
      ySizing: 'fill',
    });
  }
}

const styles = {
  dashboardActions: css({
    display: 'inline-flex',
    gap: 4,
    marginRight: 4,
  }),
  panelWrapper: css({
    // Hack to select internal div
    'section > div[class$="panel-content"]': css({
      // A components withing the Logs viz sets contain, which creates a new containing block that is not body which breaks the popover menu
      contain: 'none',
      // Prevent overflow from spilling out of parent container
      overflow: 'auto',
    }),
  }),
};
