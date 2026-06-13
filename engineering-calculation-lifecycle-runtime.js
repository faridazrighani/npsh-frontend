((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringCalculationLifecycle = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-calculation-lifecycle.v1';
  const CACHE_KEY = '20260613-calculation-lifecycle4';
  const LIFECYCLE_EVENT = 'npsh:calculation-lifecycle';
  const RUN_COMMAND_SELECTOR = [
    '#btn-solve',
    '#menu-run-solve',
    '#menu-refresh-calculations',
    '[data-i18n-text="menu.runHydraulicNpshEvaluation"]',
    '[data-i18n-text="menu.refreshCalculationsConnections"]'
  ].join(',');
  const SAMPLE_CASE_OPEN_SELECTOR = '[data-simulation-case-action="open"][data-simulation-case-id]';
  const SAMPLE_CASE_BROWSE_SELECTOR = '.simulation-case-menu-item:not(.simulation-case-menu-item-disabled), [data-simulation-case-id]:not([data-simulation-case-action])';
  const USER_CALCULATION_INTENT_SELECTOR = `${RUN_COMMAND_SELECTOR}, ${SAMPLE_CASE_OPEN_SELECTOR}, ${SAMPLE_CASE_BROWSE_SELECTOR}`;

  let installed = false;
  let sequence = 0;
  let lastCalculationActivityAt = 0;
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

  function publish(status, detail = {}, overrides = {}) {
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
    if (hasDocument() && typeof root.CustomEvent === 'function') {
      try {
        document.dispatchEvent(new root.CustomEvent(LIFECYCLE_EVENT, { detail: currentState }));
      } catch (error) {
        // Lifecycle is presentational telemetry only.
      }
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
    return publish('refreshing-evidence', eventDetail(event), {
      calculationMode: 'manual-solve',
      sourceEvent: 'npsh:linked-views-refreshed'
    });
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
    return publish('preparing', {
      calculationMode,
      nodeId: target.id || '',
      reason: target.id === 'menu-refresh-calculations'
        ? 'Refreshing calculations and connections.'
        : 'Run Hydraulic / NPSH Evaluation started.'
    }, {
      calculationMode,
      sourceEvent: 'manual-command',
      message: 'Command received. Preparing calculation lifecycle.'
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
    document.addEventListener('npsh:realtime-autosolve-error', handleFailed);
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
    document.removeEventListener('npsh:realtime-autosolve-error', handleFailed);
    installed = false;
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    eventName: LIFECYCLE_EVENT,
    current: () => ({ ...currentState, nodeIds: [...(currentState.nodeIds || [])] }),
    publish,
    install,
    uninstall,
    statusDefaults,
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
