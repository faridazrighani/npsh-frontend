((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringPerformanceBaselineRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-performance-baseline.v1';
  const CACHE_KEY = '20260709-performance-baseline1';
  const SAMPLE_EVENT = 'npsh:performance-baseline-sample';
  const MAX_SAMPLES = 120;
  const LOAD_STUCK_MS = 15000;
  const CALCULATION_STUCK_MS = 10000;
  const LONG_TASK_THRESHOLD_MS = 120;
  const LOAD_EVENT_NAMES = {
    begin: 'npsh:simulation-load-transaction-begin',
    abort: 'npsh:simulation-load-transaction-abort',
    stale: 'npsh:simulation-load-transaction-stale-result',
    complete: 'npsh:simulation-load-transaction-complete',
    failed: 'npsh:simulation-load-transaction-failed'
  };
  const CALCULATION_EVENT = 'npsh:calculation-lifecycle';
  const OBSERVED_COMMAND_SELECTOR = [
    '#btn-solve',
    '#menu-run-solve',
    '#menu-refresh-calculations',
    '[data-simulation-case-action="open"][data-simulation-case-id]',
    '#menu-open-file',
    '#fileInput'
  ].join(',');
  const BUSY_CALCULATION_STATUSES = new Set([
    'preparing',
    'waiting-debounce',
    'calculating',
    'applying-results',
    'refreshing-evidence'
  ]);
  const DONE_CALCULATION_STATUSES = new Set(['current', 'failed']);

  let installed = false;
  let sampleSequence = 0;
  let activeCalculation = null;
  let loadStuckTimer = 0;
  let calculationStuckTimer = 0;
  let pendingApplyStartMs = 0;
  let pendingUpdateStartMs = 0;
  let originalApplySimulationStateAtomic = null;
  let originalUpdateSimulation = null;
  let functionPatchTimer = 0;
  let consolePatched = false;
  let originalConsoleWarn = null;
  let originalConsoleError = null;
  const samples = [];
  const activeLoads = new Map();
  const counters = {
    consoleWarnings: 0,
    consoleErrors: 0,
    windowErrors: 0,
    unhandledRejections: 0,
    longTasks: 0,
    staleResultsRejected: 0,
    commandClicks: 0
  };

  function hasDocument() {
    return typeof document !== 'undefined' && !!document.documentElement;
  }

  function nowMs() {
    return root.performance?.now?.() || Date.now();
  }

  function wallTimeIso() {
    return new Date().toISOString();
  }

  function roundMs(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
  }

  function eventDetail(eventOrDetail = {}) {
    return eventOrDetail?.detail && typeof eventOrDetail.detail === 'object'
      ? eventOrDetail.detail
      : (eventOrDetail && typeof eventOrDetail === 'object' ? eventOrDetail : {});
  }

  function shallowClone(detail = {}) {
    const clone = {};
    Object.entries(detail || {}).forEach(([key, value]) => {
      if (value == null) return;
      if (['string', 'number', 'boolean'].includes(typeof value)) {
        clone[key] = value;
      } else if (Array.isArray(value)) {
        clone[key] = value.slice(0, 8).map((item) => String(item));
      }
    });
    return clone;
  }

  function commandState() {
    if (!hasDocument()) return {};
    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label, [data-command-label]')?.textContent?.trim() || '';
    return {
      validateLabel: label,
      validateDisabled: !!solve?.disabled,
      validateBusy: solve?.dataset?.calculationBusy === 'true' || solve?.getAttribute?.('aria-busy') === 'true',
      validateAriaBusy: solve?.getAttribute?.('aria-busy') || '',
      validateAriaDisabled: solve?.getAttribute?.('aria-disabled') || ''
    };
  }

  function countCanvasMetrics() {
    if (!hasDocument()) return {};
    const canvas = document.getElementById('canvas');
    const warningPanel = document.getElementById('canvasWarningPanel');
    const warningCountText = document.getElementById('canvasWarningCount')?.textContent || '';
    const warningCount = Number.parseInt(warningCountText, 10);
    const taskWindows = Array.from(document.querySelectorAll('.task-window')).filter((element) => {
      if (element.hidden) return false;
      const style = root.getComputedStyle?.(element);
      return style?.display !== 'none' && style?.visibility !== 'hidden';
    });
    return {
      canvasObjects: canvas?.querySelectorAll?.('.pfd-object')?.length || 0,
      canvasDomNodes: canvas?.querySelectorAll?.('*')?.length || 0,
      pipeLabels: canvas?.querySelectorAll?.('.pipe-hydraulic-label, .pipe-delta-label')?.length || 0,
      taskWindows: taskWindows.length,
      warningPanelVisible: Boolean(warningPanel && !warningPanel.hidden),
      warningCount: Number.isFinite(warningCount) ? warningCount : 0,
      bodyDomNodes: document.body?.querySelectorAll?.('*')?.length || 0
    };
  }

  function currentLifecycleState() {
    try {
      return root.EngineeringCalculationLifecycle?.current?.() || null;
    } catch (_) {
      return null;
    }
  }

  function currentLoadState() {
    try {
      return root.EngineeringSimulationLoadTransaction?.current?.() || null;
    } catch (_) {
      return null;
    }
  }

  function snapshot(extra = {}) {
    const navigation = root.performance?.getEntriesByType?.('navigation')?.[0] || null;
    const memory = root.performance?.memory || null;
    return {
      version: VERSION,
      cacheKey: CACHE_KEY,
      wallTime: wallTimeIso(),
      nowMs: roundMs(nowMs()),
      navigationType: navigation?.type || '',
      domContentLoadedMs: roundMs(navigation?.domContentLoadedEventEnd),
      loadEventMs: roundMs(navigation?.loadEventEnd),
      jsHeapUsedMB: Number.isFinite(memory?.usedJSHeapSize) ? roundMs(memory.usedJSHeapSize / 1048576) : null,
      jsHeapTotalMB: Number.isFinite(memory?.totalJSHeapSize) ? roundMs(memory.totalJSHeapSize / 1048576) : null,
      lifecycle: currentLifecycleState(),
      transaction: currentLoadState(),
      activeLoads: activeLoads.size,
      activeCalculation: activeCalculation ? shallowClone(activeCalculation) : null,
      counters: { ...counters },
      ...commandState(),
      ...countCanvasMetrics(),
      ...extra
    };
  }

  function shouldLog(type, detail = {}) {
    if (root.__NPSH_PERFORMANCE_BASELINE_SILENT__ === true) return false;
    if (detail?.silent === true) return false;
    return [
      'app-ready',
      'simulation-load-complete',
      'simulation-load-failed',
      'simulation-load-abort',
      'simulation-load-stuck',
      'calculation-complete',
      'calculation-failed',
      'calculation-stuck',
      'apply-simulation-state',
      'update-simulation'
    ].includes(type);
  }

  function compactLogPayload(sample) {
    return {
      durationMs: sample.durationMs,
      caseId: sample.caseId || sample.detail?.caseId || '',
      source: sample.source || sample.detail?.source || '',
      status: sample.status || sample.detail?.status || '',
      calculationMode: sample.calculationMode || sample.detail?.calculationMode || '',
      canvasObjects: sample.canvasObjects,
      canvasDomNodes: sample.canvasDomNodes,
      taskWindows: sample.taskWindows,
      warningCount: sample.warningCount,
      validateDisabled: sample.validateDisabled,
      validateBusy: sample.validateBusy,
      consoleWarnings: sample.counters?.consoleWarnings,
      consoleErrors: sample.counters?.consoleErrors,
      staleResultsRejected: sample.counters?.staleResultsRejected
    };
  }

  function dispatchSample(sample) {
    if (!hasDocument() || typeof root.CustomEvent !== 'function') return false;
    try {
      document.dispatchEvent(new root.CustomEvent(SAMPLE_EVENT, { detail: sample }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function record(type, detail = {}, options = {}) {
    const base = snapshot();
    const sample = {
      ...base,
      sequence: ++sampleSequence,
      type,
      durationMs: options.durationMs == null ? null : roundMs(options.durationMs),
      startedAt: options.startedAt || '',
      completedAt: wallTimeIso(),
      detail: shallowClone(detail),
      ...shallowClone(detail)
    };
    samples.push(sample);
    if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
    dispatchSample(sample);
    if (shouldLog(type, detail)) {
      try {
        root.console?.info?.(`[PERF] ${type}`, compactLogPayload(sample));
      } catch (_) {
        // Console logging is diagnostic only.
      }
    }
    return sample;
  }

  function clearLoadStuckTimer() {
    if (loadStuckTimer) root.clearTimeout?.(loadStuckTimer);
    loadStuckTimer = 0;
  }

  function clearCalculationStuckTimer() {
    if (calculationStuckTimer) root.clearTimeout?.(calculationStuckTimer);
    calculationStuckTimer = 0;
  }

  function loadKey(detail = {}) {
    return detail.sessionId || detail.caseId || detail.source || `load-${sampleSequence + 1}`;
  }

  function beginLoad(eventOrDetail = {}) {
    const detail = eventDetail(eventOrDetail);
    const key = loadKey(detail);
    activeLoads.set(key, {
      key,
      detail: shallowClone(detail),
      source: detail.source || '',
      caseId: detail.detail?.caseId || detail.caseId || '',
      startedAtMs: nowMs(),
      startedAt: wallTimeIso()
    });
    clearLoadStuckTimer();
    loadStuckTimer = root.setTimeout?.(() => {
      if (!activeLoads.size) return;
      const oldest = Array.from(activeLoads.values())[0];
      record('simulation-load-stuck', {
        ...oldest.detail,
        source: oldest.source,
        caseId: oldest.caseId,
        thresholdMs: LOAD_STUCK_MS
      }, { durationMs: nowMs() - oldest.startedAtMs, startedAt: oldest.startedAt });
    }, LOAD_STUCK_MS) || 0;
    record('simulation-load-start', detail, { startedAt: wallTimeIso() });
  }

  function finishLoad(type, eventOrDetail = {}) {
    const detail = eventDetail(eventOrDetail);
    const key = loadKey(detail);
    const active = activeLoads.get(key) || Array.from(activeLoads.values())[0] || null;
    if (active) activeLoads.delete(active.key);
    if (!activeLoads.size) clearLoadStuckTimer();
    const normalizedType = type === 'complete' ? 'simulation-load-complete'
      : type === 'failed' ? 'simulation-load-failed'
        : type === 'abort' ? 'simulation-load-abort'
          : `simulation-load-${type}`;
    record(normalizedType, detail, {
      durationMs: active ? nowMs() - active.startedAtMs : null,
      startedAt: active?.startedAt || ''
    });
  }

  function handleStaleLoadResult(eventOrDetail = {}) {
    counters.staleResultsRejected += 1;
    record('simulation-load-stale-result', eventDetail(eventOrDetail));
  }

  function beginCalculation(detail = {}) {
    if (activeCalculation) {
      activeCalculation.detail = { ...activeCalculation.detail, ...shallowClone(detail) };
      activeCalculation.status = detail.status || activeCalculation.status;
      return;
    }
    activeCalculation = {
      startedAtMs: nowMs(),
      startedAt: wallTimeIso(),
      status: detail.status || '',
      calculationMode: detail.calculationMode || '',
      detail: shallowClone(detail)
    };
    clearCalculationStuckTimer();
    calculationStuckTimer = root.setTimeout?.(() => {
      if (!activeCalculation) return;
      record('calculation-stuck', {
        ...activeCalculation.detail,
        thresholdMs: CALCULATION_STUCK_MS
      }, {
        durationMs: nowMs() - activeCalculation.startedAtMs,
        startedAt: activeCalculation.startedAt
      });
    }, CALCULATION_STUCK_MS) || 0;
    record('calculation-start', detail, { startedAt: activeCalculation.startedAt });
  }

  function finishCalculation(detail = {}) {
    if (!activeCalculation) {
      record(detail.status === 'failed' ? 'calculation-failed' : 'calculation-complete', detail);
      return;
    }
    const current = activeCalculation;
    activeCalculation = null;
    clearCalculationStuckTimer();
    record(detail.status === 'failed' ? 'calculation-failed' : 'calculation-complete', detail, {
      durationMs: nowMs() - current.startedAtMs,
      startedAt: current.startedAt
    });
  }

  function handleCalculationLifecycle(eventOrDetail = {}) {
    const detail = eventDetail(eventOrDetail);
    const status = String(detail.status || '').toLowerCase();
    if (BUSY_CALCULATION_STATUSES.has(status)) {
      beginCalculation(detail);
      return;
    }
    if (DONE_CALCULATION_STATUSES.has(status)) {
      finishCalculation(detail);
    }
  }

  function scheduleCanvasReadySample(reason = 'canvas-ready') {
    const startedAtMs = nowMs();
    root.requestAnimationFrame?.(() => {
      root.requestAnimationFrame?.(() => {
        record(reason, {}, { durationMs: nowMs() - startedAtMs });
      });
    });
  }

  function wrapApplySimulationStateAtomic() {
    if (typeof root.applySimulationStateAtomic !== 'function') return false;
    if (root.applySimulationStateAtomic.__performanceBaselineWrapped === VERSION) return true;
    originalApplySimulationStateAtomic = root.applySimulationStateAtomic;
    function measuredApplySimulationStateAtomic(...args) {
      pendingApplyStartMs = nowMs();
      let result;
      try {
        result = originalApplySimulationStateAtomic.apply(this, args);
      } catch (error) {
        record('apply-simulation-state-error', { message: error?.message || String(error) }, {
          durationMs: nowMs() - pendingApplyStartMs
        });
        throw error;
      }
      const finish = () => {
        record('apply-simulation-state', {}, { durationMs: nowMs() - pendingApplyStartMs });
        scheduleCanvasReadySample('canvas-ready-after-apply');
      };
      if (result && typeof result.then === 'function') {
        return result.then(
          (value) => {
            finish();
            return value;
          },
          (error) => {
            record('apply-simulation-state-error', { message: error?.message || String(error) }, {
              durationMs: nowMs() - pendingApplyStartMs
            });
            throw error;
          }
        );
      }
      finish();
      return result;
    }
    measuredApplySimulationStateAtomic.__performanceBaselineWrapped = VERSION;
    measuredApplySimulationStateAtomic.__performanceBaselineOriginal = originalApplySimulationStateAtomic;
    root.applySimulationStateAtomic = measuredApplySimulationStateAtomic;
    return true;
  }

  function wrapUpdateSimulation() {
    if (typeof root.updateSimulation !== 'function') return false;
    if (root.updateSimulation.__performanceBaselineWrapped === VERSION) return true;
    originalUpdateSimulation = root.updateSimulation;
    function measuredUpdateSimulation(...args) {
      pendingUpdateStartMs = nowMs();
      let result;
      try {
        result = originalUpdateSimulation.apply(this, args);
      } catch (error) {
        record('update-simulation-error', { message: error?.message || String(error) }, {
          durationMs: nowMs() - pendingUpdateStartMs
        });
        throw error;
      }
      const finish = () => {
        record('update-simulation', {}, { durationMs: nowMs() - pendingUpdateStartMs });
        scheduleCanvasReadySample('canvas-ready-after-update');
      };
      if (result && typeof result.then === 'function') {
        return result.then(
          (value) => {
            finish();
            return value;
          },
          (error) => {
            record('update-simulation-error', { message: error?.message || String(error) }, {
              durationMs: nowMs() - pendingUpdateStartMs
            });
            throw error;
          }
        );
      }
      finish();
      return result;
    }
    measuredUpdateSimulation.__performanceBaselineWrapped = VERSION;
    measuredUpdateSimulation.__performanceBaselineOriginal = originalUpdateSimulation;
    root.updateSimulation = measuredUpdateSimulation;
    return true;
  }

  function installFunctionPatches(attempt = 0) {
    wrapApplySimulationStateAtomic();
    wrapUpdateSimulation();
    if ((!root.applySimulationStateAtomic || !root.updateSimulation) && attempt < 80) {
      functionPatchTimer = root.setTimeout?.(() => installFunctionPatches(attempt + 1), 80) || 0;
    }
  }

  function patchConsoleCounters() {
    if (consolePatched || root.__NPSH_PERFORMANCE_BASELINE_NO_CONSOLE_PATCH__ === true) return false;
    if (!root.console) return false;
    originalConsoleWarn = root.console.warn;
    originalConsoleError = root.console.error;
    root.console.warn = function performanceBaselineWarn(...args) {
      counters.consoleWarnings += 1;
      return originalConsoleWarn?.apply?.(this, args);
    };
    root.console.error = function performanceBaselineError(...args) {
      counters.consoleErrors += 1;
      return originalConsoleError?.apply?.(this, args);
    };
    consolePatched = true;
    return true;
  }

  function installLongTaskObserver() {
    if (typeof root.PerformanceObserver !== 'function') return false;
    try {
      const observer = new root.PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (Number(entry.duration) >= LONG_TASK_THRESHOLD_MS) {
            counters.longTasks += 1;
            record('long-task', { durationMs: roundMs(entry.duration), name: entry.name || 'longtask' });
          }
        });
      });
      observer.observe({ entryTypes: ['longtask'] });
      return true;
    } catch (_) {
      return false;
    }
  }

  function handleCommandClick(event) {
    const target = event?.target?.closest?.(OBSERVED_COMMAND_SELECTOR);
    if (!target) return;
    counters.commandClicks += 1;
    record('command-click', {
      id: target.id || '',
      caseId: target.dataset?.simulationCaseId || '',
      action: target.dataset?.simulationCaseAction || '',
      text: target.textContent?.trim?.().slice(0, 80) || ''
    });
  }

  function installEventListeners() {
    if (!hasDocument()) return false;
    document.addEventListener(LOAD_EVENT_NAMES.begin, beginLoad);
    document.addEventListener(LOAD_EVENT_NAMES.complete, (event) => finishLoad('complete', event));
    document.addEventListener(LOAD_EVENT_NAMES.failed, (event) => finishLoad('failed', event));
    document.addEventListener(LOAD_EVENT_NAMES.abort, (event) => finishLoad('abort', event));
    document.addEventListener(LOAD_EVENT_NAMES.stale, handleStaleLoadResult);
    document.addEventListener(CALCULATION_EVENT, handleCalculationLifecycle);
    document.addEventListener('click', handleCommandClick, true);
    root.addEventListener?.('error', () => {
      counters.windowErrors += 1;
    });
    root.addEventListener?.('unhandledrejection', () => {
      counters.unhandledRejections += 1;
    });
    return true;
  }

  function install() {
    if (installed) return true;
    installed = true;
    patchConsoleCounters();
    installLongTaskObserver();
    installEventListeners();
    installFunctionPatches();
    if (hasDocument()) {
      if (document.readyState === 'complete') {
        record('app-ready', { readyState: document.readyState });
      } else {
        root.addEventListener?.('load', () => record('app-ready', { readyState: document.readyState }), { once: true });
      }
    }
    return true;
  }

  function samplesCopy() {
    return samples.map((sample) => ({ ...sample, counters: { ...sample.counters } }));
  }

  function reset() {
    samples.splice(0);
    activeLoads.clear();
    activeCalculation = null;
    clearLoadStuckTimer();
    clearCalculationStuckTimer();
    Object.keys(counters).forEach((key) => {
      counters[key] = 0;
    });
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    sampleEvent: SAMPLE_EVENT,
    maxSamples: MAX_SAMPLES,
    install,
    record,
    snapshot,
    samples: samplesCopy,
    reset,
    beginLoad,
    finishLoad,
    handleCalculationLifecycle,
    wrapApplySimulationStateAtomic,
    wrapUpdateSimulation
  };

  if (hasDocument()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => install(), { once: true });
    } else {
      install();
    }
  } else {
    install();
  }

  return api;
});
