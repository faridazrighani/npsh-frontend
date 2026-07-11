((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringCalculationLifecycle = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-calculation-lifecycle.v1';
  const CACHE_KEY = '20260711-solver-always-calculates1';
  const LIFECYCLE_EVENT = 'npsh:calculation-lifecycle';
  const EVIDENCE_REFRESH_RELEASE_MS = 650;
  const SAMPLE_OPEN_RELEASE_MS = 900;
  const COMMAND_BUSY_WATCHDOG_MS = 5200;
  const SAMPLE_OPEN_BUSY_WATCHDOG_MS = 7600;
  const MANUAL_BUSY_WATCHDOG_MS = 8200;
  const RUN_COMMAND_SELECTOR = [
    '#btn-solve',
    '#menu-run-solve',
    '#menu-refresh-calculations',
    '[data-i18n-text="menu.runHydraulicNpshEvaluation"]',
    '[data-i18n-text="menu.refreshCalculationsConnections"]'
  ].join(',');
  const EXPLICIT_EVIDENCE_REFRESH_SELECTOR = '#menu-refresh-calculations';
  const SAMPLE_CASE_OPEN_SELECTOR = '[data-simulation-case-action="open"][data-simulation-case-id]';
  const SAMPLE_CASE_BROWSE_SELECTOR = '.simulation-case-menu-item:not(.simulation-case-menu-item-disabled), [data-simulation-case-id]:not([data-simulation-case-action])';
  const USER_CALCULATION_INTENT_SELECTOR = `${RUN_COMMAND_SELECTOR}, ${SAMPLE_CASE_OPEN_SELECTOR}, ${SAMPLE_CASE_BROWSE_SELECTOR}`;
  const BUSY_STATUSES = new Set([
    'waiting-debounce',
    'calculating',
    'applying-results',
    'refreshing-evidence'
  ]);

  let installed = false;
  let sequence = 0;
  let lastCalculationActivityAt = 0;
  let evidenceRefreshReleaseTimer = 0;
  let sampleOpenReleaseTimer = 0;
  let commandBusyWatchdogTimer = 0;
  let commandAvailabilityObserver = null;
  let commandAvailabilityObserverElement = null;
  let commandAvailabilityObserverTimer = 0;
  let commandAvailabilityHeartbeatTimer = 0;
  let commandAvailabilityAuditTimers = [];
  let currentState = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    status: 'current',
    phase: 'complete',
    task: 'Current',
    message: 'Calculation result is current.',
    sequence: 0,
    updatedAt: new Date(0).toISOString()
  };

  function hasDocument() {
    return typeof document !== 'undefined' && document?.documentElement;
  }

  function eventDetail(eventOrDetail = {}) {
    return eventOrDetail?.detail && typeof eventOrDetail.detail === 'object'
      ? eventOrDetail.detail
      : (eventOrDetail && typeof eventOrDetail === 'object' ? eventOrDetail : {});
  }

  function normalizeNodeIds(detail = {}) {
    const nodeIds = Array.isArray(detail.nodeIds) ? detail.nodeIds : [];
    const nodeId = detail.nodeId || detail.selectedNodeId || nodeIds[0] || '';
    return {
      nodeId,
      nodeIds: nodeIds.length ? nodeIds : (nodeId ? [nodeId] : [])
    };
  }

  function statusDefaults(status) {
    switch (status) {
      case 'input-changed':
        return {
          phase: 'inputs',
          task: 'Preparing recalculation',
          message: 'Input changed. Marking previous result stale.'
        };
      case 'preparing':
        return {
          phase: 'inputs',
          task: 'Preparing recalculation',
          message: 'Preparing hydraulic recalculation.'
        };
      case 'waiting-debounce':
        return {
          phase: 'inputs',
          task: 'Waiting for input to settle',
          message: 'Waiting briefly before recalculation starts.'
        };
      case 'calculating':
        return {
          phase: 'solving',
          task: 'Solving hydraulic network',
          message: 'Backend hydraulic/NPSH calculation is running.'
        };
      case 'applying-results':
        return {
          phase: 'results',
          task: 'Applying results',
          message: 'Applying latest calculation results.'
        };
      case 'refreshing-evidence':
        return {
          phase: 'evidence',
          task: 'Refreshing evidence',
          message: 'Refreshing linked defense panels and charts.'
        };
      case 'failed':
        return {
          phase: 'error',
          task: 'Calculation failed',
          message: 'Last valid result is still shown.'
        };
      case 'current':
      default:
        return {
          phase: 'complete',
          task: 'Current',
          message: 'Calculation result is current.'
        };
    }
  }

  function isBusyStatus(status, detail = {}) {
    const normalized = String(status || '');
    const mode = detail.calculationMode || currentState.calculationMode || '';
    if (mode === 'realtime-input') return false;
    if (normalized === 'preparing') {
      return ['manual-solve', 'sample-open'].includes(mode);
    }
    return BUSY_STATUSES.has(normalized);
  }

  function runCommandElements() {
    if (!hasDocument()) return [];
    try {
      return Array.from(document.querySelectorAll(RUN_COMMAND_SELECTOR));
    } catch (error) {
      return [];
    }
  }

  function solveCommandElement() {
    if (!hasDocument()) return null;
    return document.getElementById?.('btn-solve') || null;
  }

  function commandLabelElement(element) {
    return element?.querySelector?.('.ribbon-label, [data-command-label], .menu-item-label') || null;
  }

  function busyLabelForStatus(status) {
    if (status === 'refreshing-evidence') return 'Refreshing...';
    if (status === 'waiting-debounce' || status === 'preparing') return 'Preparing...';
    return 'Calculating...';
  }

  function clearEvidenceRefreshReleaseTimer() {
    if (!evidenceRefreshReleaseTimer) return;
    const clearTimer = root.clearTimeout || clearTimeout;
    clearTimer(evidenceRefreshReleaseTimer);
    evidenceRefreshReleaseTimer = 0;
  }

  function clearSampleOpenReleaseTimer() {
    if (!sampleOpenReleaseTimer) return;
    const clearTimer = root.clearTimeout || clearTimeout;
    clearTimer(sampleOpenReleaseTimer);
    sampleOpenReleaseTimer = 0;
  }

  function clearCommandBusyWatchdogTimer() {
    if (!commandBusyWatchdogTimer) return;
    const clearTimer = root.clearTimeout || clearTimeout;
    clearTimer(commandBusyWatchdogTimer);
    commandBusyWatchdogTimer = 0;
  }

  function clearCommandAvailabilityAudits() {
    const clearTimer = root.clearTimeout || clearTimeout;
    commandAvailabilityAuditTimers.splice(0).forEach((timer) => clearTimer(timer));
  }

  function clearCommandAvailabilityObserver() {
    const clearTimer = root.clearTimeout || clearTimeout;
    const clearIntervalFn = root.clearInterval || clearInterval;
    if (commandAvailabilityObserverTimer) {
      clearTimer(commandAvailabilityObserverTimer);
      commandAvailabilityObserverTimer = 0;
    }
    if (commandAvailabilityHeartbeatTimer) {
      clearIntervalFn(commandAvailabilityHeartbeatTimer);
      commandAvailabilityHeartbeatTimer = 0;
    }
    try {
      commandAvailabilityObserver?.disconnect?.();
    } catch (error) {
      // Observer cleanup is best effort.
    }
    commandAvailabilityObserver = null;
    commandAvailabilityObserverElement = null;
  }

  function commandNeedsAvailabilityRelease(element) {
    if (!element) return false;
    const labelText = commandLabelElement(element)?.textContent || '';
    return Boolean(
      element.disabled
        || element.hasAttribute?.('disabled')
        || element.dataset?.calculationBusy === 'true'
        || element.getAttribute?.('aria-busy') === 'true'
        || element.getAttribute?.('aria-disabled') === 'true'
        || /calculating|refreshing|preparing/i.test(labelText)
    );
  }

  function hasActiveLoadGuard() {
    const transaction = root.EngineeringSimulationLoadTransaction?.current?.();
    const readiness = root.EngineeringOpenFileReadinessGate?.state?.();
    return transaction?.status === 'active' || !!readiness;
  }

  function hasCurrentVerifiedPumpResult() {
    const model = root.__npshGlobalModel || root.globalModel || {};
    return Object.values(model || {}).some((node) => {
      if (!node || node.type !== 'pump') return false;
      const outcome = node.results || {};
      const evaluation = outcome.npshEvaluation || {};
      const npsha = Number(evaluation.npsha ?? outcome.npsha);
      const backendStatus = String(evaluation.backendValidationStatus || outcome.backendValidationStatus || '').toLowerCase();
      const freshness = String(evaluation.calculationFreshness || outcome.calculationFreshness || '').toLowerCase();
      return Number.isFinite(npsha)
        && backendStatus === 'connected'
        && freshness === 'current'
        && outcome.isCalculationStale !== true
        && outcome.previousResultWasStale !== true;
    });
  }

  function runManualValidateFastLane(detail = {}) {
    try {
      root.EngineeringPumpEnvelopeWarningCleanup?.sanitizeModelWarnings?.();
      root.EngineeringPumpEnvelopeWarningCleanup?.pruneCanvasWarningPanel?.();
      root.EngineeringRouteTraceAudit?.pruneDefaultCanvasRouteTraceOverlays?.(document.getElementById('canvas') || document);
      root.refreshPipeCanvasHydraulicLabels?.(document);
      root.updateCanvasWarningPanel?.();
    } catch (error) {
      // Fast-lane validation refresh is presentational and must never block the command.
    }
    const state = publish('refreshing-evidence', detail, {
      calculationMode: 'manual-solve',
      sourceEvent: 'manual-validate-fast-lane',
      message: 'Realtime results are current; refreshing visible validation evidence.'
    });
    scheduleEvidenceRefreshRelease(detail, state);
    return state;
  }

  function shouldUseManualValidateFastLane(target) {
    const command = target?.closest?.(RUN_COMMAND_SELECTOR);
    if (!command?.matches?.(EXPLICIT_EVIDENCE_REFRESH_SELECTOR)) return false;
    if (root.__NPSH_DISABLE_MANUAL_VALIDATE_FAST_LANE__ === true) return false;
    if (hasActiveLoadGuard()) return false;
    if (isBusyStatus(currentState.status, currentState)) return false;
    return hasCurrentVerifiedPumpResult();
  }

  function ensureRunCommandAvailableIfSettled(reason = 'availability-audit') {
    if (hasActiveLoadGuard()) return false;
    if (isBusyStatus(currentState.status, currentState)) return false;
    const commands = runCommandElements();
    const lifecycleBusy = root.__engineeringCalculationLifecycleCommandBusy?.busy === true;
    if (!lifecycleBusy && !commands.some(commandNeedsAvailabilityRelease)) return false;
    setRunCommandBusy(false, {
      ...currentState,
      status: 'current',
      task: 'Current',
      sourceEvent: reason
    });
    return true;
  }

  function scheduleCommandAvailabilityObserverCheck(reason = 'solve-command-attribute-observer') {
    const clearTimer = root.clearTimeout || clearTimeout;
    const setTimer = root.setTimeout || setTimeout;
    if (commandAvailabilityObserverTimer) clearTimer(commandAvailabilityObserverTimer);
    commandAvailabilityObserverTimer = setTimer(() => {
      commandAvailabilityObserverTimer = 0;
      bindCommandAvailabilityObserver();
      ensureRunCommandAvailableIfSettled(reason);
    }, 80);
  }

  function bindCommandAvailabilityObserver() {
    if (!hasDocument()) return false;
    const solve = solveCommandElement();
    if (commandAvailabilityObserver && commandAvailabilityObserverElement === solve) return true;
    try {
      commandAvailabilityObserver?.disconnect?.();
    } catch (error) {
      // Rebinding is best effort.
    }
    commandAvailabilityObserver = null;
    commandAvailabilityObserverElement = solve;
    if (!solve || typeof root.MutationObserver !== 'function') return false;
    commandAvailabilityObserver = new root.MutationObserver(() => {
      scheduleCommandAvailabilityObserverCheck('solve-command-attribute-observer');
    });
    commandAvailabilityObserver.observe(solve, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['disabled', 'aria-busy', 'aria-disabled', 'data-calculation-busy', 'class']
    });
    return true;
  }

  function installCommandAvailabilityHeartbeat() {
    if (!hasDocument() || commandAvailabilityHeartbeatTimer) return false;
    bindCommandAvailabilityObserver();
    const setIntervalFn = root.setInterval || setInterval;
    commandAvailabilityHeartbeatTimer = setIntervalFn(() => {
      bindCommandAvailabilityObserver();
      ensureRunCommandAvailableIfSettled('solve-command-settled-heartbeat');
    }, 950);
    commandAvailabilityHeartbeatTimer?.unref?.();
    return true;
  }

  function scheduleCommandAvailabilityAudit(reason = 'availability-audit') {
    clearCommandAvailabilityAudits();
    const setTimer = root.setTimeout || setTimeout;
    [120, 650, 1800, 4200, 8600].forEach((delay) => {
      const timer = setTimer(() => {
        commandAvailabilityAuditTimers = commandAvailabilityAuditTimers.filter((item) => item !== timer);
        ensureRunCommandAvailableIfSettled(reason);
      }, delay);
      commandAvailabilityAuditTimers.push(timer);
    });
  }

  function busyWatchdogDelayForState(state = currentState) {
    const mode = state.calculationMode || currentCalculationMode();
    if (mode === 'sample-open') return SAMPLE_OPEN_BUSY_WATCHDOG_MS;
    if (mode === 'manual-solve') return MANUAL_BUSY_WATCHDOG_MS;
    return COMMAND_BUSY_WATCHDOG_MS;
  }

  function releaseRunCommand(reason = 'command-release-watchdog', detail = {}) {
    clearCommandBusyWatchdogTimer();
    const state = publish('current', {
      ...detail,
      calculationMode: detail.calculationMode || currentState.calculationMode || currentCalculationMode(),
      reason
    }, {
      sourceEvent: reason,
      message: detail.message || 'Run/Validate command released after the calculation lifecycle settled.'
    });
    setRunCommandBusy(false, state);
    scheduleCommandAvailabilityAudit(reason);
    return state;
  }

  function scheduleCommandBusyWatchdog(isBusy, state = currentState) {
    clearCommandBusyWatchdogTimer();
    if (!isBusy) return;
    const setTimer = root.setTimeout || setTimeout;
    const sequenceAtSchedule = state.sequence;
    commandBusyWatchdogTimer = setTimer(() => {
      commandBusyWatchdogTimer = 0;
      if (currentState.sequence !== sequenceAtSchedule) return;
      if (!isBusyStatus(currentState.status, currentState)) return;
      releaseRunCommand('command-busy-watchdog', {
        ...currentState,
        message: 'Calculation command was released by the reliability watchdog.'
      });
    }, busyWatchdogDelayForState(state));
  }

  function hasSettledSampleCaseResults() {
    const transaction = root.EngineeringSimulationLoadTransaction?.current?.();
    if (transaction?.status === 'active') return false;
    const model = root.__npshGlobalModel || root.globalModel || {};
    return Object.values(model || {}).some((node) => {
      if (!node || node.type !== 'pump') return false;
      const outcome = node.results || {};
      const validationStatus = String(outcome.backendValidationStatus || '').toLowerCase();
      return validationStatus === 'connected'
        || !!outcome.calculationAudit?.calculationId
        || Number.isFinite(Number(outcome.npsha))
        || Number.isFinite(Number(outcome.requiredHead));
    });
  }

  function scheduleSampleOpenRelease(detail = {}, state = currentState) {
    clearSampleOpenReleaseTimer();
    const mode = detail.calculationMode || state.calculationMode || currentCalculationMode();
    if (mode !== 'sample-open') return;
    const setTimer = root.setTimeout || setTimeout;
    sampleOpenReleaseTimer = setTimer(() => {
      sampleOpenReleaseTimer = 0;
      if (currentState.sequence !== state.sequence) return;
      if (currentState.calculationMode !== 'sample-open') return;
      if (!['calculating', 'applying-results'].includes(currentState.status)) return;
      if (!hasSettledSampleCaseResults()) return;
      publish('current', detail, {
        calculationMode: 'sample-open',
        sourceEvent: 'sample-case-results-applied',
        message: 'Sample case calculation results applied.'
      });
    }, SAMPLE_OPEN_RELEASE_MS);
  }

  function scheduleEvidenceRefreshRelease(detail = {}, state = currentState) {
    clearEvidenceRefreshReleaseTimer();
    const setTimer = root.setTimeout || setTimeout;
    evidenceRefreshReleaseTimer = setTimer(() => {
      evidenceRefreshReleaseTimer = 0;
      if (currentState.sequence !== state.sequence || currentState.status !== 'refreshing-evidence') return;
      publish('current', detail, {
        sourceEvent: 'linked-views-refresh-complete',
        message: 'Validation evidence refreshed.'
      });
    }, EVIDENCE_REFRESH_RELEASE_MS);
  }

  function setRunCommandBusy(isBusy, detail = {}) {
    const busy = !!isBusy;
    const state = {
      version: VERSION,
      busy,
      status: detail.status || currentState.status,
      task: detail.task || currentState.task,
      calculationMode: detail.calculationMode || currentState.calculationMode || '',
      updatedAt: new Date().toISOString()
    };
    root.__engineeringCalculationLifecycleCommandBusy = state;
    runCommandElements().forEach((element) => {
      if (!element || typeof element !== 'object') return;
      const label = commandLabelElement(element);
      if (label && !element.dataset.calculationLifecycleOriginalLabel) {
        element.dataset.calculationLifecycleOriginalLabel = label.textContent || '';
      }
      element.toggleAttribute?.('disabled', busy);
      if ('disabled' in element) element.disabled = busy;
      element.setAttribute?.('aria-busy', busy ? 'true' : 'false');
      element.setAttribute?.('aria-disabled', busy ? 'true' : 'false');
      element.dataset.calculationBusy = busy ? 'true' : 'false';
      if (label) {
        label.textContent = busy
          ? busyLabelForStatus(state.status)
          : (element.dataset.calculationLifecycleOriginalLabel || label.textContent || '');
      }
    });
    if (!busy) clearCommandBusyWatchdogTimer();
    return state;
  }

  function publish(status, detail = {}, overrides = {}) {
    if (status !== 'refreshing-evidence') clearEvidenceRefreshReleaseTimer();
    if (!['calculating', 'applying-results'].includes(status)) clearSampleOpenReleaseTimer();
    const base = statusDefaults(status);
    const ids = normalizeNodeIds(detail);
    sequence += 1;
    currentState = {
      version: VERSION,
      cacheKey: CACHE_KEY,
      status,
      phase: overrides.phase || detail.phase || base.phase,
      task: overrides.task || detail.task || base.task,
      message: overrides.message || detail.message || base.message,
      reason: detail.reason || '',
      nodeId: ids.nodeId,
      nodeIds: ids.nodeIds,
      calculationId: detail.calculationId || null,
      dependencyFingerprint: detail.dependencyFingerprint || null,
      delayMs: Number.isFinite(Number(detail.delayMs)) ? Number(detail.delayMs) : null,
      calculationMode: overrides.calculationMode || detail.calculationMode || root.__engineeringCalculationUserIntent?.calculationMode || '',
      sourceEvent: overrides.sourceEvent || detail.sourceEvent || '',
      sequence,
      updatedAt: new Date().toISOString()
    };
    root.__engineeringCalculationLifecycleState = currentState;
    const commandBusy = isBusyStatus(status, currentState);
    setRunCommandBusy(commandBusy, currentState);
    scheduleCommandBusyWatchdog(commandBusy, currentState);
    if (!commandBusy) scheduleCommandAvailabilityAudit(overrides.sourceEvent || detail.sourceEvent || status);
    if (hasDocument() && typeof root.CustomEvent === 'function') {
      try {
        document.dispatchEvent(new root.CustomEvent(LIFECYCLE_EVENT, { detail: currentState }));
      } catch (error) {
        // Lifecycle is presentational telemetry only.
      }
    }
    if (['calculating', 'applying-results'].includes(status) && currentState.calculationMode === 'sample-open') {
      scheduleSampleOpenRelease(detail, currentState);
    }
    return currentState;
  }

  function modeFromSource(source = '') {
    if (source === 'manual-command') return 'manual-solve';
    if (source === 'sample-case-open') return 'sample-open';
    if (source === 'simulation-menu-browse') return 'menu-browse';
    if (source === 'trusted-input' || source === 'input-stale' || source === 'autosolve-scheduled') return 'realtime-input';
    return root.__engineeringCalculationUserIntent?.calculationMode || '';
  }

  function markCalculationActivity(source = 'calculation-event', detail = {}) {
    lastCalculationActivityAt = Date.now();
    root.__engineeringCalculationUserIntentAt = lastCalculationActivityAt;
    root.__engineeringCalculationUserIntent = {
      source,
      calculationMode: detail.calculationMode || modeFromSource(source),
      nodeId: detail.nodeId || detail.selectedNodeId || '',
      caseId: detail.caseId || detail.simulationCaseId || '',
      updatedAt: new Date(lastCalculationActivityAt).toISOString()
    };
  }

  function hasRecentCalculationActivity(windowMs = 3500) {
    const globalIntentAt = Number(root.__engineeringCalculationUserIntentAt || 0);
    const latestActivityAt = Math.max(lastCalculationActivityAt || 0, Number.isFinite(globalIntentAt) ? globalIntentAt : 0);
    return latestActivityAt > 0 && Date.now() - latestActivityAt <= windowMs;
  }

  function currentCalculationMode() {
    return root.__engineeringCalculationUserIntent?.calculationMode || currentState.calculationMode || '';
  }

  function isAllowedCalculationMode(allowedModes = []) {
    if (!hasRecentCalculationActivity(8000)) return false;
    const mode = currentCalculationMode();
    return !allowedModes.length || allowedModes.includes(mode);
  }

  function handleStale(event) {
    const detail = eventDetail(event);
    markCalculationActivity('input-stale', detail);
    return publish('input-changed', detail, { sourceEvent: 'npsh:calculation-stale' });
  }

  function handleScheduled(event) {
    const detail = eventDetail(event);
    markCalculationActivity('autosolve-scheduled', detail);
    const delay = Number.isFinite(Number(detail.delayMs)) ? Number(detail.delayMs) : null;
    return publish('waiting-debounce', detail, {
      sourceEvent: 'npsh:realtime-autosolve-scheduled',
      message: delay === null
        ? 'Waiting briefly before recalculation starts.'
        : `Waiting ${Math.round(delay)} ms for input to settle.`
    });
  }

  function handleCalculating(event) {
    if (!isAllowedCalculationMode(['sample-open', 'manual-solve', 'realtime-input'])) return false;
    return publish('calculating', eventDetail(event), { sourceEvent: event?.type || 'calculating' });
  }

  function handleApplying(event) {
    if (!isAllowedCalculationMode(['sample-open', 'manual-solve', 'realtime-input'])) return false;
    return publish('applying-results', eventDetail(event), { sourceEvent: event?.type || 'applying-results' });
  }

  function handleRefreshing(event) {
    if (!isAllowedCalculationMode(['manual-solve'])) return false;
    const detail = eventDetail(event);
    const state = publish('refreshing-evidence', detail, {
      calculationMode: 'manual-solve',
      sourceEvent: 'npsh:linked-views-refreshed'
    });
    scheduleEvidenceRefreshRelease(detail, state);
    return state;
  }

  function handleCurrent(event) {
    return publish('current', eventDetail(event), { sourceEvent: event?.type || 'current' });
  }

  function handleFailed(event) {
    const detail = eventDetail(event);
    if (!isAllowedCalculationMode(['sample-open', 'manual-solve', 'realtime-input'])) return false;
    return publish('failed', detail, {
      sourceEvent: event?.type || 'failed',
      message: detail.message || detail.reason || 'Last valid result is still shown.'
    });
  }

  function loadModeFromDetail(detail = {}) {
    const source = String(detail.source || detail.detail?.source || '').toLowerCase();
    if (/external|file|simulation-case|sample/.test(source)) return 'sample-open';
    return detail.calculationMode || currentCalculationMode() || 'sample-open';
  }

  function handleSimulationLoadBegin(event) {
    const detail = eventDetail(event);
    const calculationMode = loadModeFromDetail(detail);
    markCalculationActivity('sample-case-open', {
      calculationMode,
      caseId: detail.detail?.caseId || detail.caseId || '',
      nodeId: ''
    });
    return publish('preparing', {
      ...detail,
      calculationMode,
      reason: detail.reason || 'Simulation load transaction started.'
    }, {
      calculationMode,
      sourceEvent: event?.type || 'simulation-load-begin',
      task: 'Reading inputs',
      message: 'Reading selected simulation inputs.'
    });
  }

  function handleSimulationLoadSettled(event) {
    const detail = eventDetail(event);
    if (event?.type === 'npsh:open-file-readiness') {
      const phase = String(detail.phase || detail.status || '').toLowerCase();
      if (!/ready|warning|failed|error|complete|current/.test(phase)) return false;
    }
    return releaseRunCommand(event?.type || 'simulation-load-settled', {
      ...detail,
      calculationMode: currentState.calculationMode || loadModeFromDetail(detail),
      message: 'Simulation load settled and Validate is ready.'
    });
  }

  function handleUserCalculationIntent(event) {
    const target = event?.target?.closest?.(USER_CALCULATION_INTENT_SELECTOR);
    if (!target) return false;
    const isSampleCaseOpen = target.matches?.(SAMPLE_CASE_OPEN_SELECTOR);
    const isRunCommand = !!target.closest?.(RUN_COMMAND_SELECTOR);
    const isSampleBrowse = !isSampleCaseOpen && !isRunCommand && !!target.closest?.(SAMPLE_CASE_BROWSE_SELECTOR);
    const source = isSampleCaseOpen ? 'sample-case-open' : (isSampleBrowse ? 'simulation-menu-browse' : 'manual-command');
    const calculationMode = modeFromSource(source);
    markCalculationActivity(source, {
      nodeId: target.id || '',
      caseId: target.dataset?.simulationCaseId || target.closest?.('[data-simulation-case-id]')?.dataset?.simulationCaseId || '',
      calculationMode
    });
    if (isSampleCaseOpen) {
      return publish('preparing', {
        calculationMode,
        caseId: target.dataset?.simulationCaseId || '',
        reason: 'Open Sample Case selected.'
      }, {
        calculationMode,
        sourceEvent: 'sample-case-open',
        task: 'Reading inputs',
        message: 'Reading selected sample case inputs.'
      });
    }
    if (isSampleBrowse) {
      return publish('preparing', {
        calculationMode,
        caseId: target.closest?.('[data-simulation-case-id]')?.dataset?.simulationCaseId || '',
        reason: 'Simulation case menu selected.'
      }, {
        calculationMode,
        sourceEvent: 'simulation-menu-browse',
        task: 'Reading inputs',
        message: 'Reading simulation case menu.'
      });
    }
    if (shouldUseManualValidateFastLane(target)) {
      event?.preventDefault?.();
      event?.stopImmediatePropagation?.();
      return runManualValidateFastLane({
        calculationMode,
        nodeId: target.id || '',
        reason: target.id === 'menu-refresh-calculations'
          ? 'Refresh Realtime Views & Connections fast lane.'
          : 'Validate / Refresh Evidence fast lane.'
      });
    }
    return publish('preparing', {
      calculationMode,
      nodeId: target.id || '',
      reason: target.id === 'menu-refresh-calculations'
        ? 'Refreshing calculations and connections.'
        : 'Validate calculation started.'
    }, {
      calculationMode,
      sourceEvent: 'manual-command',
      message: 'Command received. Running the hydraulic and NPSH calculation.'
    });
  }

  function install() {
    if (!hasDocument() || installed) return false;
    installed = true;
    document.addEventListener('click', handleUserCalculationIntent, true);
    document.addEventListener('npsh:calculation-stale', handleStale);
    document.addEventListener('npsh:realtime-autosolve-scheduled', handleScheduled);
    document.addEventListener('npsh:calculation-calculating', handleCalculating);
    document.addEventListener('npsh:realtime-autosolve-start', handleCalculating);
    document.addEventListener('npsh:calculation-applying-results', handleApplying);
    document.addEventListener('npsh:linked-views-refreshed', handleRefreshing);
    document.addEventListener('npsh:calculation-current', handleCurrent);
    document.addEventListener('npsh:realtime-autosolve-complete', handleCurrent);
    document.addEventListener('npsh:calculation-failed', handleFailed);
    document.addEventListener('npsh:realtime-autosolve-error', handleFailed);
    document.addEventListener('npsh:simulation-load-transaction-begin', handleSimulationLoadBegin);
    document.addEventListener('npsh:simulation-load-transaction-abort', handleSimulationLoadSettled);
    document.addEventListener('npsh:simulation-load-transaction-complete', handleSimulationLoadSettled);
    document.addEventListener('npsh:simulation-load-transaction-failed', handleSimulationLoadSettled);
    document.addEventListener('npsh:simulation-load-transaction-stale-result', handleSimulationLoadSettled);
    document.addEventListener('npsh:open-file-readiness', handleSimulationLoadSettled);
    installCommandAvailabilityHeartbeat();
    return true;
  }

  function uninstall() {
    if (!hasDocument() || !installed) return false;
    document.removeEventListener('click', handleUserCalculationIntent, true);
    document.removeEventListener('npsh:calculation-stale', handleStale);
    document.removeEventListener('npsh:realtime-autosolve-scheduled', handleScheduled);
    document.removeEventListener('npsh:calculation-calculating', handleCalculating);
    document.removeEventListener('npsh:realtime-autosolve-start', handleCalculating);
    document.removeEventListener('npsh:calculation-applying-results', handleApplying);
    document.removeEventListener('npsh:linked-views-refreshed', handleRefreshing);
    document.removeEventListener('npsh:calculation-current', handleCurrent);
    document.removeEventListener('npsh:realtime-autosolve-complete', handleCurrent);
    document.removeEventListener('npsh:calculation-failed', handleFailed);
    document.removeEventListener('npsh:realtime-autosolve-error', handleFailed);
    document.removeEventListener('npsh:simulation-load-transaction-begin', handleSimulationLoadBegin);
    document.removeEventListener('npsh:simulation-load-transaction-abort', handleSimulationLoadSettled);
    document.removeEventListener('npsh:simulation-load-transaction-complete', handleSimulationLoadSettled);
    document.removeEventListener('npsh:simulation-load-transaction-failed', handleSimulationLoadSettled);
    document.removeEventListener('npsh:simulation-load-transaction-stale-result', handleSimulationLoadSettled);
    document.removeEventListener('npsh:open-file-readiness', handleSimulationLoadSettled);
    clearCommandAvailabilityAudits();
    clearCommandAvailabilityObserver();
    installed = false;
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    evidenceRefreshReleaseMs: EVIDENCE_REFRESH_RELEASE_MS,
    sampleOpenReleaseMs: SAMPLE_OPEN_RELEASE_MS,
    commandBusyWatchdogMs: COMMAND_BUSY_WATCHDOG_MS,
    sampleOpenBusyWatchdogMs: SAMPLE_OPEN_BUSY_WATCHDOG_MS,
    manualBusyWatchdogMs: MANUAL_BUSY_WATCHDOG_MS,
    eventName: LIFECYCLE_EVENT,
    current: () => ({ ...currentState, nodeIds: [...(currentState.nodeIds || [])] }),
    publish,
    install,
    uninstall,
    statusDefaults,
    isBusyStatus,
    setRunCommandBusy,
    releaseRunCommand,
    ensureRunCommandAvailableIfSettled,
    markCalculationActivity,
    hasRecentCalculationActivity,
    currentCalculationMode
  };

  if (hasDocument()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
      install();
    }
  }

  return api;
});
