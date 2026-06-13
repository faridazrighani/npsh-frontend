(function initEngineeringPerformanceRefreshGovernor(root) {
  'use strict';

  const VERSION = '2026.06-performance-refresh-governor2';
  const DEFAULT_DELAY_MS = 300;
  const FAST_DELAY_MS = 180;
  const MAX_DELAY_MS = 750;
  const SECONDARY_WINDOW_SELECTOR = [
    '.pipe-formula-defense-task-window',
    '.pump-formula-defense-task-window',
    '.source-formula-defense-task-window',
    '.fluid-formula-defense-task-window',
    '.pump-curve-explanation-task-window',
  ].join(',');

  const state = {
    queue: new Map(),
    timer: null,
    raf: null,
    flushing: false,
    patched: new Set(),
    lastFlush: null,
    stats: {
      scheduled: 0,
      flushed: 0,
      skippedBySignature: 0,
      skippedHidden: 0,
      patched: 0,
    },
  };

  function now() {
    if (root.performance && typeof root.performance.now === 'function') {
      return root.performance.now();
    }
    return Date.now();
  }

  function getDocument() {
    return root.document || null;
  }

  function asSafeDelay(delayMs) {
    const value = Number(delayMs);
    if (!Number.isFinite(value)) {
      return DEFAULT_DELAY_MS;
    }
    return Math.max(0, Math.min(MAX_DELAY_MS, value));
  }

  function normalizeNodeId(nodeId) {
    if (nodeId === null || nodeId === undefined) {
      return '';
    }
    return String(nodeId).trim();
  }

  function getModel() {
    return root.NPSH_PROJECT_MODEL || root.projectModel || root.currentProject || null;
  }

  function getNodes() {
    const model = getModel();
    if (!model) {
      return {};
    }
    return model.nodes || model.nodeMap || {};
  }

  function getNode(nodeId) {
    const id = normalizeNodeId(nodeId);
    if (!id) {
      return null;
    }
    const nodes = getNodes();
    if (nodes && !Array.isArray(nodes) && nodes[id]) {
      return nodes[id];
    }
    if (Array.isArray(nodes)) {
      return nodes.find((node) => normalizeNodeId(node && (node.id || node.nodeId)) === id) || null;
    }
    return null;
  }

  function getAllNodeIdsByType(typeList) {
    const wanted = new Set(typeList.map((item) => String(item).toLowerCase()));
    const nodes = getNodes();
    const values = Array.isArray(nodes) ? nodes : Object.values(nodes || {});
    return values
      .filter(Boolean)
      .filter((node) => wanted.has(String(node.type || node.kind || node.category || '').toLowerCase()))
      .map((node) => normalizeNodeId(node.id || node.nodeId))
      .filter(Boolean);
  }

  function readNodeType(nodeId) {
    const node = getNode(nodeId);
    return String(node && (node.type || node.kind || node.category) || '').toLowerCase();
  }

  function relatedNodeIds(nodeId) {
    const id = normalizeNodeId(nodeId);
    if (!id) {
      return null;
    }
    const type = readNodeType(id);
    if (!type) {
      return new Set([id]);
    }
    const related = new Set([id]);
    if (type === 'pump') {
      getAllNodeIdsByType(['pipe']).forEach((pipeId) => related.add(pipeId));
      return related;
    }
    if (type === 'pipe') {
      getAllNodeIdsByType(['pump']).forEach((pumpId) => related.add(pumpId));
      return related;
    }
    if (type === 'source' || type === 'sink' || type === 'fluid' || type === 'tank' || type === 'vessel') {
      return null;
    }
    return related;
  }

  function getWindowNodeId(element) {
    if (!element || !element.dataset) {
      return '';
    }
    return normalizeNodeId(
      element.dataset.nodeId ||
      element.dataset.pipeNodeId ||
      element.dataset.pipeId ||
      element.dataset.pumpNodeId ||
      element.dataset.pumpId ||
      element.dataset.sourceNodeId ||
      element.dataset.sourceId ||
      element.dataset.fluidNodeId ||
      element.dataset.targetNodeId
    );
  }

  function getWindowKind(element) {
    if (!element || !element.classList) {
      return '';
    }
    if (element.classList.contains('pipe-formula-defense-task-window')) {
      return 'pipeFormulaDefense';
    }
    if (element.classList.contains('pump-formula-defense-task-window')) {
      return 'pumpFormulaDefense';
    }
    if (element.classList.contains('source-formula-defense-task-window')) {
      return 'sourceFormulaDefense';
    }
    if (element.classList.contains('fluid-formula-defense-task-window')) {
      return 'fluidFormulaDefense';
    }
    if (element.classList.contains('pump-curve-explanation-task-window')) {
      return 'pumpCurveExplanation';
    }
    return '';
  }

  function isVisibleElement(element) {
    const documentRef = getDocument();
    if (!element || !documentRef || !documentRef.documentElement.contains(element)) {
      return false;
    }
    if (documentRef.visibilityState === 'hidden') {
      return false;
    }
    const style = root.getComputedStyle ? root.getComputedStyle(element) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) {
      return false;
    }
    if (element.classList && element.classList.contains('minimized')) {
      return false;
    }
    if (element.offsetParent !== null || (typeof element.getClientRects === 'function' && element.getClientRects().length > 0)) {
      return true;
    }
    return element === documentRef.body || element === documentRef.documentElement;
  }

  function isWindowRelatedToNode(element, nodeId) {
    const id = normalizeNodeId(nodeId);
    if (!id) {
      return true;
    }
    const related = relatedNodeIds(id);
    if (!related) {
      return true;
    }
    const windowId = getWindowNodeId(element);
    if (!windowId) {
      return true;
    }
    return related.has(windowId);
  }

  function sortValue(value, depth) {
    if (depth > 6) {
      return '[depth]';
    }
    if (value === null || value === undefined) {
      return value;
    }
    const type = typeof value;
    if (type === 'number') {
      return Number.isFinite(value) ? Number(value.toPrecision(12)) : String(value);
    }
    if (type === 'string') {
      return value.length > 1000 ? value.slice(0, 1000) : value;
    }
    if (type === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.slice(0, 80).map((item) => sortValue(item, depth + 1));
    }
    if (type === 'object') {
      const output = {};
      Object.keys(value)
        .sort()
        .slice(0, 120)
        .forEach((key) => {
          if (typeof value[key] !== 'function') {
            output[key] = sortValue(value[key], depth + 1);
          }
        });
      return output;
    }
    return String(value);
  }

  function stableStringify(value) {
    try {
      return JSON.stringify(sortValue(value, 0));
    } catch (error) {
      return String(value);
    }
  }

  function hashString(input) {
    const text = String(input || '');
    let hash = 5381;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
      hash >>>= 0;
    }
    return hash.toString(36);
  }

  function getPipeSignaturePayload(nodeId) {
    const node = getNode(nodeId);
    const fluid = root.FluidBasisStore && typeof root.FluidBasisStore.getActive === 'function'
      ? root.FluidBasisStore.getActive()
      : null;
    return {
      nodeId: normalizeNodeId(nodeId),
      type: node && node.type,
      props: node && node.props,
      results: node && {
        flow: node.results && node.results.flow,
        flowM3h: node.results && node.results.flowM3h,
        velocity: node.results && node.results.velocity,
        reynolds: node.results && node.results.reynolds,
        pressureInBar: node.results && node.results.pressureInBar,
        pressureOutBar: node.results && node.results.pressureOutBar,
        pressureBar: node.results && node.results.pressureBar,
        totalK: node.results && node.results.totalK,
        totalHeadLoss: node.results && node.results.totalHeadLoss,
        majorHeadLoss: node.results && node.results.majorHeadLoss,
        minorHeadLoss: node.results && node.results.minorHeadLoss,
        calculationTrace: node.results && node.results.calculationTrace,
        segmentTrace: node.results && node.results.segmentTrace,
      },
      freshness: root.__engineeringCalculationFreshness && root.__engineeringCalculationFreshness.byNode
        ? root.__engineeringCalculationFreshness.byNode[normalizeNodeId(nodeId)]
        : null,
      fluid,
    };
  }

  function getPumpSignaturePayload(nodeId) {
    const node = getNode(nodeId);
    return {
      nodeId: normalizeNodeId(nodeId),
      type: node && node.type,
      props: node && node.props,
      results: node && {
        head: node.results && node.results.head,
        flow: node.results && node.results.flow,
        flowM3h: node.results && node.results.flowM3h,
        npshAvailable: node.results && node.results.npshAvailable,
        npshRequired: node.results && node.results.npshRequired,
        npshMargin: node.results && node.results.npshMargin,
        npshEvaluation: node.results && node.results.npshEvaluation,
        routeTrace: node.results && node.results.routeTrace,
        performanceChartData: node.results && node.results.performanceChartData,
        actionReadiness: node.results && node.results.actionReadiness,
      },
      freshness: root.__engineeringCalculationFreshness && root.__engineeringCalculationFreshness.byNode
        ? root.__engineeringCalculationFreshness.byNode[normalizeNodeId(nodeId)]
        : null,
    };
  }

  function traceSignature(kind, nodeId) {
    const normalizedKind = String(kind || '');
    const id = normalizeNodeId(nodeId);
    let payload = null;
    if (normalizedKind.indexOf('pipe') === 0) {
      payload = getPipeSignaturePayload(id);
    } else if (normalizedKind.indexOf('pump') === 0) {
      payload = getPumpSignaturePayload(id);
    } else {
      payload = {
        kind: normalizedKind,
        nodeId: id,
        node: getNode(id),
        fluid: root.FluidBasisStore && typeof root.FluidBasisStore.getActive === 'function'
          ? root.FluidBasisStore.getActive()
          : null,
      };
    }
    return hashString(stableStringify(payload));
  }

  function signatureKey(kind) {
    return `performanceRefreshSignature${String(kind || 'window')}`;
  }

  function readStoredSignature(element, kind) {
    if (!element || !element.dataset) {
      return '';
    }
    return element.dataset[signatureKey(kind)] || '';
  }

  function writeStoredSignature(element, kind, signature) {
    if (element && element.dataset) {
      element.dataset[signatureKey(kind)] = signature || '';
    }
  }

  function shouldSkipWindowBySignature(element, kind, nodeId, options) {
    if (options && options.force) {
      return false;
    }
    const id = normalizeNodeId(nodeId || getWindowNodeId(element));
    if (!kind || !id) {
      return false;
    }
    const signature = traceSignature(kind, id);
    if (!signature) {
      return false;
    }
    const previous = readStoredSignature(element, kind);
    if (previous && previous === signature) {
      state.stats.skippedBySignature += 1;
      return true;
    }
    return false;
  }

  function rememberWindowSignature(element, kind, nodeId) {
    const id = normalizeNodeId(nodeId || getWindowNodeId(element));
    if (!kind || !id) {
      return;
    }
    writeStoredSignature(element, kind, traceSignature(kind, id));
  }

  function getVisibleSecondaryWindows(nodeId) {
    const documentRef = getDocument();
    if (!documentRef) {
      return [];
    }
    return Array.from(documentRef.querySelectorAll(SECONDARY_WINDOW_SELECTOR))
      .filter((element) => {
        if (!isVisibleElement(element)) {
          state.stats.skippedHidden += 1;
          return false;
        }
        return isWindowRelatedToNode(element, nodeId);
      });
  }

  function schedule(keyType, nodeId, options) {
    const type = String(keyType || 'refresh');
    const id = normalizeNodeId(nodeId);
    const opts = options || {};
    const key = `${type}:${id || 'all'}`;
    const delayMs = asSafeDelay(opts.delayMs);
    state.queue.set(key, {
      key,
      type,
      nodeId: id,
      reason: opts.reason || '',
      createdAt: now(),
      run: typeof opts.run === 'function' ? opts.run : null,
      context: opts.context || null,
    });
    state.stats.scheduled += 1;
    armFlush(delayMs);
    return true;
  }

  function armFlush(delayMs) {
    if (state.timer) {
      root.clearTimeout(state.timer);
    }
    state.timer = root.setTimeout(() => {
      state.timer = null;
      if (root.requestAnimationFrame) {
        if (state.raf) {
          root.cancelAnimationFrame(state.raf);
        }
        state.raf = root.requestAnimationFrame(() => {
          state.raf = null;
          flush();
        });
      } else {
        flush();
      }
    }, delayMs);
    state.timer?.unref?.();
  }

  function flush() {
    if (state.flushing) {
      return false;
    }
    const jobs = Array.from(state.queue.values());
    state.queue.clear();
    if (!jobs.length) {
      return false;
    }
    state.flushing = true;
    const startedAt = now();
    const results = [];
    jobs.forEach((job) => {
      try {
        if (job && typeof job.run === 'function') {
          results.push({ key: job.key, value: job.run(job) });
        }
      } catch (error) {
        console.warn('[PerformanceRefreshGovernor] refresh job failed', job.key, error);
      }
    });
    state.flushing = false;
    state.stats.flushed += jobs.length;
    state.lastFlush = {
      at: Date.now(),
      durationMs: Number((now() - startedAt).toFixed(2)),
      jobs: jobs.map((job) => job.key),
      results,
    };
    root.__engineeringPerformanceRefreshGovernorLastFlush = state.lastFlush;
    return true;
  }

  function scheduleEnhance(scope, options) {
    const ui = root.EngineeringFormulaDefenseUI;
    if (!ui || typeof ui.enhanceDocument !== 'function') {
      return false;
    }
    const opts = options || {};
    const targetScope = scope || getDocument();
    const nodeId = opts.nodeId || (targetScope && typeof targetScope.closest === 'function'
      ? getWindowNodeId(targetScope.closest(SECONDARY_WINDOW_SELECTOR))
      : '');
    return schedule('formula-enhance', nodeId || 'document', {
      delayMs: opts.delayMs === undefined ? DEFAULT_DELAY_MS : opts.delayMs,
      reason: opts.reason || 'formula-enhance',
      run: () => {
        if (targetScope === getDocument() && !getVisibleSecondaryWindows(nodeId).length) {
          state.stats.skippedHidden += 1;
          return false;
        }
        const current = root.EngineeringFormulaDefenseUI;
        if (!current || typeof current.enhanceDocument !== 'function') {
          return false;
        }
        return current.enhanceDocument.__performanceRefreshGovernorOriginal
          ? current.enhanceDocument.__performanceRefreshGovernorOriginal.call(current, targetScope)
          : current.enhanceDocument.call(current, targetScope);
      },
    });
  }

  function refreshRelevantSecondaryWindows(context) {
    const detail = context || {};
    const nodeId = normalizeNodeId(detail.nodeId || detail.selectedNodeId || detail.targetNodeId);
    const windows = getVisibleSecondaryWindows(nodeId);
    let refreshed = 0;
    windows.forEach((element) => {
      const kind = getWindowKind(element);
      const elementNodeId = getWindowNodeId(element);
      if (shouldSkipWindowBySignature(element, kind, elementNodeId, detail)) {
        return;
      }
      if (typeof root.refreshRealtimeTaskWindowElement === 'function') {
        root.refreshRealtimeTaskWindowElement(element, detail);
        rememberWindowSignature(element, kind, elementNodeId);
        refreshed += 1;
      }
    });
    return refreshed;
  }

  function hasVisiblePumpChart(pumpId) {
    const documentRef = getDocument();
    if (!documentRef) {
      return false;
    }
    const selector = [
      '.pump-performance-chart-task-window',
      '.pump-performance-chart-window',
      '#fullEditor .caption-audit-inline-chart-wrap',
      '#fullEditor canvas',
      '#pumpChart',
      '#captionAuditPumpChartCanvas',
    ].join(',');
    return Array.from(documentRef.querySelectorAll(selector)).some((element) => {
      if (!isVisibleElement(element)) {
        return false;
      }
      if (!pumpId) {
        return true;
      }
      const container = element.closest ? element.closest('[data-node-id], [data-pump-id], .task-window, #fullEditor') : element;
      const id = getWindowNodeId(container) || normalizeNodeId(container && container.dataset && container.dataset.pumpId);
      return !id || id === normalizeNodeId(pumpId);
    });
  }

  function copyFunctionProperties(target, source) {
    try {
      Object.keys(source).forEach((key) => {
        try {
          target[key] = source[key];
        } catch (error) {
          /* ignore read-only compatibility properties */
        }
      });
    } catch (error) {
      /* ignore */
    }
  }

  function patchGlobalFunction(name, marker, wrapperFactory) {
    const original = root[name];
    if (typeof original !== 'function' || original[marker]) {
      return false;
    }
    const wrapped = wrapperFactory(original);
    if (typeof wrapped !== 'function') {
      return false;
    }
    copyFunctionProperties(wrapped, original);
    wrapped[marker] = VERSION;
    wrapped.__performanceRefreshGovernorOriginal = original;
    root[name] = wrapped;
    state.patched.add(name);
    state.stats.patched += 1;
    return true;
  }

  function patchObjectFunction(object, name, marker, wrapperFactory, label) {
    if (!object || typeof object[name] !== 'function' || object[name][marker]) {
      return false;
    }
    const original = object[name];
    const wrapped = wrapperFactory(original);
    if (typeof wrapped !== 'function') {
      return false;
    }
    copyFunctionProperties(wrapped, original);
    wrapped[marker] = VERSION;
    wrapped.__performanceRefreshGovernorOriginal = original;
    object[name] = wrapped;
    state.patched.add(label || name);
    state.stats.patched += 1;
    return true;
  }

  function patchRefreshFunctions() {
    patchGlobalFunction('refreshOpenRealtimeSecondaryTaskWindows', '__performanceRefreshGovernorPatched', (original) => {
      return function governedRefreshOpenRealtimeSecondaryTaskWindows(context) {
        const detail = context && typeof context === 'object' ? Object.assign({}, context) : {};
        const nodeId = normalizeNodeId(detail.nodeId || detail.selectedNodeId || detail.targetNodeId);
        return schedule('secondary-task-windows', nodeId, {
          delayMs: detail.delayMs === undefined ? DEFAULT_DELAY_MS : detail.delayMs,
          reason: detail.reason || 'secondary-task-windows',
          context: detail,
          run: () => refreshRelevantSecondaryWindows(detail),
        });
      };
    });

    patchGlobalFunction('refreshPipeFormulaDefenseWindowContent', '__performanceRefreshGovernorPatched', (original) => {
      return function governedRefreshPipeFormulaDefenseWindowContent(windowElement, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const kind = 'pipeFormulaDefense';
        const nodeId = getWindowNodeId(windowElement);
        if (windowElement && shouldSkipWindowBySignature(windowElement, kind, nodeId, opts)) {
          return false;
        }
        const result = original.apply(this, arguments);
        if (windowElement && typeof windowElement.querySelector === 'function') {
          rememberWindowSignature(windowElement, kind, nodeId);
          scheduleEnhance(windowElement, { nodeId, delayMs: FAST_DELAY_MS, reason: 'pipe-formula-content' });
        }
        return result;
      };
    });

    patchGlobalFunction('refreshPumpFormulaDefenseWindowContent', '__performanceRefreshGovernorPatched', (original) => {
      return function governedRefreshPumpFormulaDefenseWindowContent(windowElement, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const kind = 'pumpFormulaDefense';
        const nodeId = getWindowNodeId(windowElement);
        if (windowElement && shouldSkipWindowBySignature(windowElement, kind, nodeId, opts)) {
          return false;
        }
        const result = original.apply(this, arguments);
        if (windowElement && typeof windowElement.querySelector === 'function') {
          rememberWindowSignature(windowElement, kind, nodeId);
          scheduleEnhance(windowElement, { nodeId, delayMs: FAST_DELAY_MS, reason: 'pump-formula-content' });
        }
        return result;
      };
    });

    patchGlobalFunction('updatePumpChart', '__performanceRefreshGovernorPatched', (original) => {
      return function governedUpdatePumpChart(pumpId, options) {
        const id = normalizeNodeId(pumpId);
        const opts = options && typeof options === 'object' ? options : {};
        if (opts.forceImmediate) {
          return original.apply(this, arguments);
        }
        if (!hasVisiblePumpChart(id) && !opts.force) {
          state.stats.skippedHidden += 1;
          return root.__pumpPerformanceCanonicalChartLast || root.__pumpPerformanceChartAuditLast || null;
        }
        schedule('pump-performance-chart', id, {
          delayMs: opts.delayMs === undefined ? FAST_DELAY_MS : opts.delayMs,
          reason: opts.reason || 'pump-performance-chart',
          run: () => original.call(this, id, { forceImmediate: true }),
        });
        return root.__pumpPerformanceCanonicalChartLast || root.__pumpPerformanceChartAuditLast || null;
      };
    });

    const formulaUi = root.EngineeringFormulaDefenseUI;
    patchObjectFunction(formulaUi, 'enhanceDocument', '__performanceRefreshGovernorPatched', (original) => {
      return function governedEnhanceDocument(scope, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const documentRef = getDocument();
        if (!opts.forceImmediate && (!scope || scope === documentRef)) {
          return schedule('formula-enhance', 'document', {
            delayMs: opts.delayMs === undefined ? DEFAULT_DELAY_MS : opts.delayMs,
            reason: opts.reason || 'formula-enhance-document',
            run: () => original.call(this, documentRef),
          });
        }
        return original.call(this, scope || documentRef);
      };
    }, 'EngineeringFormulaDefenseUI.enhanceDocument');
  }

  function patch() {
    patchRefreshFunctions();
    return Array.from(state.patched);
  }

  function installPatchLoop() {
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      patch();
      if (attempts < 40) {
        const timer = root.setTimeout(tick, attempts < 10 ? 80 : 250);
        timer?.unref?.();
      }
    };
    tick();
  }

  const api = {
    version: VERSION,
    cacheKey: '20260613-refresh-governor2',
    VERSION,
    schedule,
    flush,
    patch,
    scheduleEnhance,
    refreshRelevantSecondaryWindows,
    hasVisiblePumpChart,
    isVisibleElement,
    traceSignature,
    getStats: () => Object.assign({}, state.stats, {
      pending: state.queue.size,
      patched: Array.from(state.patched),
      lastFlush: state.lastFlush,
    }),
  };

  root.EngineeringPerformanceRefreshGovernor = api;
  installPatchLoop();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
