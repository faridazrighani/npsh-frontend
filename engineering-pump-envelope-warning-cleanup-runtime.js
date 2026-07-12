((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringPumpEnvelopeWarningCleanup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = '2026.07-warning-lifecycle-cleanup3-current-request-lock';
  const CACHE_KEY = '20260712-warning-lifecycle-current-request-lock1';
  const PANEL_ID = 'canvasWarningPanel';
  const LIST_ID = 'canvasWarningList';
  const COUNT_ID = 'canvasWarningCount';
  const EMPTY_CLASS = 'canvas-warning-empty';
  const SUPPRESSED_PUMP_INPUT_FIELDS = new Set([
    'designFlow',
    'designHead',
    'designEfficiency',
    'bepFlow',
    'porMinPercent',
    'porMaxPercent',
    'aorMinPercent',
    'aorMaxPercent'
  ]);
  const DEPRECATED_WARNING_PATTERNS = [
    /\benvelope\s+scan\b/i,
    /\boperating\s+envelope\b/i,
    /\bcomplete\s+inputs?\b.*\b(design\s+flow|design\s+head|design\s+eff|bep|por|aor)\b/i,
    /\bdesign\s+flow\b.*\bdesign\s+head\b.*\bdesign\s+eff/i,
    /\bdesign\s+efficiency\b/i,
    /\bbep\s+flow\b/i,
    /\bpump\s+duty\s+sizing\b/i,
    /\bpor\s+(min|max)\b/i,
    /\baor\s+(min|max)\b/i
  ];
  const BACKEND_UNAVAILABLE_WARNING_PATTERNS = [
    /\bbackend\s+api\s+did\s+not\s+return\s+a\s+usable\s+protected\s+calculation\s+result\b/i,
    /\bbackend\s+validation\s+unavailable\b.*\bdisplayed\s+hydraulic\s+results\s+are\s+unverified\b/i,
    /\bdisplayed\s+hydraulic\s+results\s+are\s+unverified\s+by\s+the\s+protected\s+backend\b/i
  ];
  const BACKEND_UNAVAILABLE_WARNING = 'Backend validation unavailable; displayed hydraulic results are unverified by the protected backend.';
  const WARNING_ARRAY_KEYS = new Set(['warnings', 'validationWarnings']);
  const CONNECTED_STATUSES = new Set(['connected', 'current', 'verified']);
  const TRANSITIONAL_STATUSES = new Set(['calculating', 'pending', 'stale', 'superseded', 'aborted']);

  let installed = false;
  let canvasWarningPanelPatchInstalled = false;
  let observer = null;
  let pruneTimer = 0;
  let lifecycleEventsInstalled = false;

  function hasDocument() {
    return typeof document !== 'undefined' && !!document.documentElement;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function warningText(value) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    return [
      value.message,
      value.label,
      value.title,
      value.detail,
      value.fullDetail,
      value.field,
      value.key,
      value.id
    ].map(normalizeText).filter(Boolean).join(' ');
  }

  function isSuppressedPumpEnvelopeWarning(value) {
    const field = typeof value === 'object' && value ? normalizeText(value.field || value.key) : '';
    if (field && SUPPRESSED_PUMP_INPUT_FIELDS.has(field)) return true;
    const text = warningText(value);
    if (!text) return false;
    return DEPRECATED_WARNING_PATTERNS.some((pattern) => pattern.test(text));
  }

  function isBackendUnavailableWarning(value) {
    const text = warningText(value);
    return Boolean(text && BACKEND_UNAVAILABLE_WARNING_PATTERNS.some((pattern) => pattern.test(text)));
  }

  function nodeResults(node) {
    return node?.results && typeof node.results === 'object' ? node.results : {};
  }

  function backendState(node) {
    const results = nodeResults(node);
    const evaluation = results.npshEvaluation && typeof results.npshEvaluation === 'object'
      ? results.npshEvaluation
      : {};
    const parity = results.backendParity && typeof results.backendParity === 'object'
      ? results.backendParity
      : {};
    const validationStatus = normalizeText(
      evaluation.backendValidationStatus || results.backendValidationStatus
    ).toLowerCase();
    const freshness = normalizeText(
      evaluation.calculationFreshness || results.calculationFreshness
    ).toLowerCase();
    const parityStatus = normalizeText(parity.status).toLowerCase();
    const source = normalizeText(results.backendCalculationSource).toLowerCase();
    const npsha = Number(evaluation.npsha ?? results.npsha);
    return {
      results,
      evaluation,
      parity,
      validationStatus,
      freshness,
      parityStatus,
      source,
      hasHydraulicResult: Number.isFinite(npsha)
    };
  }

  function activeLoadTransaction() {
    try {
      const transaction = root.EngineeringSimulationLoadTransaction?.current?.();
      return transaction?.status === 'active' || transaction?.awaitingAuthoritativeCalculation === true;
    } catch (error) {
      return false;
    }
  }

  function realtimeCalculationInProgress() {
    const state = root.__engineeringCalculationDefenseRealtimeState || {};
    const transaction = root.EngineeringRealtimeCalculationDefense?.currentCalculationTransaction?.();
    return normalizeText(state.status).toLowerCase() === 'calculating'
      || normalizeText(transaction?.status).toLowerCase() === 'calculating';
  }

  function isCurrentVerifiedBackendResult(node) {
    const state = backendState(node);
    const hasProtectedBackendEvidence = /backend|primary|protected/.test(state.source)
      || state.parity.primaryApplied === true;
    return state.hasHydraulicResult
      && CONNECTED_STATUSES.has(state.validationStatus)
      && CONNECTED_STATUSES.has(state.freshness)
      && hasProtectedBackendEvidence
      && !/unavailable|timeout|failed/.test(state.source);
  }

  function shouldExpireBackendWarning(node, details = {}) {
    const state = backendState(node);
    const detailStatus = normalizeText(details.status).toLowerCase();
    const terminalFailure = isTerminalBackendFailure(details, state);
    if (details.primaryApplied === true) return true;
    if (state.parityStatus === 'pending') return true;
    if (/^(aborted|superseded|stale)$/.test(detailStatus)) return true;
    if (terminalFailure) return false;
    if (activeLoadTransaction() || realtimeCalculationInProgress()) return true;
    if (isCurrentVerifiedBackendResult(node)) return true;
    if (TRANSITIONAL_STATUSES.has(state.validationStatus)
      || TRANSITIONAL_STATUSES.has(state.freshness)
      || TRANSITIONAL_STATUSES.has(state.parityStatus)
      || TRANSITIONAL_STATUSES.has(detailStatus)) return true;
    return false;
  }

  function isTerminalBackendFailure(details = {}, state = {}) {
    const detailStatus = normalizeText(details.status).toLowerCase();
    const parityStatus = normalizeText(state.parityStatus).toLowerCase();
    return /^(unavailable|timeout|failed|error)$/.test(detailStatus)
      || /^(unavailable|timeout|failed|error)$/.test(parityStatus);
  }

  function shouldSuppressWarning(value, context = {}) {
    if (isSuppressedPumpEnvelopeWarning(value)) return true;
    if (!isBackendUnavailableWarning(value)) return false;
    return shouldExpireBackendWarning(context.node, context.details || {});
  }

  function filterWarningList(list, context = {}) {
    if (!Array.isArray(list)) return [];
    return list.filter((warning) => !shouldSuppressWarning(warning, context));
  }

  function getActiveModel() {
    if (root.globalModel && typeof root.globalModel === 'object') return root.globalModel;
    try {
      if (typeof globalModel !== 'undefined' && globalModel && typeof globalModel === 'object') return globalModel;
    } catch (error) {
      return null;
    }
    return null;
  }

  function cleanWarningArray(owner, key, context = {}) {
    if (!owner || !Array.isArray(owner[key])) return false;
    const cleaned = filterWarningList(owner[key], context);
    if (cleaned.length === owner[key].length) return false;
    owner[key] = cleaned;
    return true;
  }

  function sanitizeWarningContainers(value, context = {}, seen = new Set(), depth = 0) {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 7) return 0;
    seen.add(value);
    let cleanedCount = 0;
    Object.entries(value).forEach(([key, child]) => {
      if (WARNING_ARRAY_KEYS.has(key) && Array.isArray(child)) {
        if (cleanWarningArray(value, key, context)) cleanedCount += 1;
        return;
      }
      if (child && typeof child === 'object') {
        cleanedCount += sanitizeWarningContainers(child, context, seen, depth + 1);
      }
    });
    return cleanedCount;
  }

  function sanitizeModelWarnings(model = getActiveModel()) {
    if (!model || typeof model !== 'object') return 0;
    let cleanedCount = 0;
    Object.values(model).forEach((node) => {
      if (!node || node.type !== 'pump') return;
      cleanedCount += sanitizeWarningContainers(node, { node });
    });
    return cleanedCount;
  }

  function patchWarningSource(name) {
    const original = root[name];
    if (typeof original !== 'function' || original.__pumpEnvelopeWarningCleanupPatched) return false;
    const patched = function patchedPumpEnvelopeWarningCleanup(...args) {
      const result = original.apply(this, args);
      return filterWarningList(result, { node: args[0] });
    };
    patched.__pumpEnvelopeWarningCleanupPatched = true;
    patched.__pumpEnvelopeWarningCleanupOriginal = original;
    root[name] = patched;
    return true;
  }

  function patchWarningSources() {
    const patchedOperating = patchWarningSource('getPumpOperatingWarnings');
    const patchedValidation = patchWarningSource('getPumpValidationWarnings');
    return patchedOperating || patchedValidation;
  }

  function preserveCalculatingBackendState(pumpNode, details = {}) {
    if (!pumpNode || typeof pumpNode !== 'object') return nodeResults(pumpNode);
    const results = nodeResults(pumpNode);
    if (isCurrentVerifiedBackendResult(pumpNode) && backendState(pumpNode).parityStatus !== 'pending') {
      sanitizeWarningContainers(pumpNode, { node: pumpNode, details });
      return results;
    }
    const message = activeLoadTransaction()
      ? 'Authoritative backend calculation is being applied for the current simulation.'
      : 'Protected backend recalculation is running.';
    results.backendValidationStatus = 'Calculating';
    results.backendValidationMessage = message;
    results.calculationFreshness = 'Calculating';
    if (results.npshEvaluation && typeof results.npshEvaluation === 'object') {
      results.npshEvaluation.backendValidationStatus = 'Calculating';
      results.npshEvaluation.backendValidationMessage = message;
      results.npshEvaluation.calculationFreshness = 'Calculating';
    }
    sanitizeWarningContainers(pumpNode, { node: pumpNode, details });
    return results;
  }

  function enforceTerminalBackendFailure(pumpNode, details = {}) {
    if (!pumpNode || typeof pumpNode !== 'object') return nodeResults(pumpNode);
    const results = nodeResults(pumpNode);
    const state = backendState(pumpNode);
    const detailStatus = normalizeText(details.status || state.parityStatus).toLowerCase();
    const status = detailStatus === 'timeout' ? 'Timeout' : 'Unavailable';
    results.backendCalculationSource = 'backend-unavailable';
    results.backendValidationStatus = status;
    results.backendValidationMessage = BACKEND_UNAVAILABLE_WARNING;
    results.calculationFreshness = 'Unverified';
    const retained = (Array.isArray(results.warnings) ? results.warnings : [])
      .filter((warning) => !isBackendUnavailableWarning(warning));
    results.warnings = [...retained, BACKEND_UNAVAILABLE_WARNING];
    if (results.npshEvaluation && typeof results.npshEvaluation === 'object') {
      results.npshEvaluation.backendValidationStatus = status;
      results.npshEvaluation.backendValidationMessage = BACKEND_UNAVAILABLE_WARNING;
      results.npshEvaluation.calculationFreshness = 'Unverified';
    }
    return results;
  }

  function patchBackendUnavailableResult() {
    const original = root.setBackendProtectedUnavailableResult;
    if (typeof original !== 'function' || original.__warningLifecycleCleanupPatched) return false;
    const patched = function warningLifecycleUnavailableWrapper(pumpNode, details = {}) {
      if (shouldExpireBackendWarning(pumpNode, details)) {
        return preserveCalculatingBackendState(pumpNode, details);
      }
      const result = original.apply(this, arguments);
      if (isTerminalBackendFailure(details, backendState(pumpNode))) {
        enforceTerminalBackendFailure(pumpNode, details);
      }
      sanitizeWarningContainers(pumpNode, { node: pumpNode, details });
      return result;
    };
    patched.__warningLifecycleCleanupPatched = true;
    patched.__warningLifecycleCleanupOriginal = original;
    root.setBackendProtectedUnavailableResult = patched;
    return true;
  }

  function patchBackendPrimaryApply() {
    const original = root.applyBackendSimulationPrimaryResults;
    if (typeof original !== 'function' || original.__warningLifecycleCleanupPatched) return false;
    const patched = function warningLifecyclePrimaryApplyWrapper(pumpNode, ...args) {
      const result = original.call(this, pumpNode, ...args);
      if (result && pumpNode && typeof pumpNode === 'object') {
        sanitizeWarningContainers(pumpNode, { node: pumpNode, details: { primaryApplied: true } });
      }
      return result;
    };
    patched.__warningLifecycleCleanupPatched = true;
    patched.__warningLifecycleCleanupOriginal = original;
    root.applyBackendSimulationPrimaryResults = patched;
    return true;
  }

  function patchBackendLifecycle() {
    return [patchBackendUnavailableResult(), patchBackendPrimaryApply()].some(Boolean);
  }

  function patchCanvasWarningPanel() {
    if (canvasWarningPanelPatchInstalled || root.__engineeringPumpWarningPanelPatchInstalled === true) {
      return false;
    }
    const original = root.updateCanvasWarningPanel;
    if (typeof original !== 'function' || original.__pumpEnvelopeWarningCleanupPatched) return false;
    const patched = function patchedUpdateCanvasWarningPanel(...args) {
      sanitizeModelWarnings();
      patchWarningSources();
      const result = original.apply(this, args);
      pruneCanvasWarningPanel();
      return result;
    };
    patched.__pumpEnvelopeWarningCleanupPatched = true;
    patched.__pumpEnvelopeWarningCleanupOriginal = original;
    root.updateCanvasWarningPanel = patched;
    canvasWarningPanelPatchInstalled = true;
    root.__engineeringPumpWarningPanelPatchInstalled = true;
    return true;
  }

  function ensureEmptyState(list) {
    if (!list || list.children.length) return;
    const empty = document.createElement('div');
    empty.className = EMPTY_CLASS;
    empty.textContent = 'No active warnings';
    list.appendChild(empty);
  }

  function pruneCanvasWarningPanel() {
    if (!hasDocument()) return 0;
    const panel = document.getElementById(PANEL_ID);
    const list = document.getElementById(LIST_ID);
    const count = document.getElementById(COUNT_ID);
    if (!panel || !list || !count) return 0;
    const items = Array.from(list.querySelectorAll('.canvas-warning-item'));
    let removed = 0;
    items.forEach((item) => {
      const text = [
        item.textContent,
        item.getAttribute('title'),
        item.dataset.fullDetail
      ].map(normalizeText).filter(Boolean).join(' ');
      const nodeId = item.dataset.nodeId || '';
      const node = getActiveModel()?.[nodeId] || null;
      if (!shouldSuppressWarning(text, { node })) return;
      item.remove();
      removed += 1;
    });
    const remaining = Array.from(list.querySelectorAll('.canvas-warning-item'));
    count.textContent = String(remaining.length);
    panel.classList.toggle('has-warnings', remaining.length > 0);
    if (!remaining.length) {
      panel.hidden = true;
      list.replaceChildren();
      ensureEmptyState(list);
    }
    return removed;
  }

  function queuePrune() {
    if (!hasDocument()) return;
    root.clearTimeout?.(pruneTimer);
    pruneTimer = root.setTimeout?.(() => {
      pruneTimer = 0;
      sanitizeModelWarnings();
      patchWarningSources();
      patchBackendLifecycle();
      patchCanvasWarningPanel();
      pruneCanvasWarningPanel();
    }, 40) || 0;
  }

  function installLifecycleEvents() {
    if (!hasDocument() || lifecycleEventsInstalled) return false;
    lifecycleEventsInstalled = true;
    [
      'npsh:simulation-load-transaction-begin',
      'npsh:simulation-load-workspace-cleanup',
      'npsh:simulation-load-transaction-complete',
      'npsh:calculation-calculating',
      'npsh:calculation-current',
      'npsh:realtime-autosolve-superseded'
    ].forEach((eventName) => document.addEventListener(eventName, queuePrune));
    return true;
  }

  function installObserver() {
    if (!hasDocument() || observer || typeof root.MutationObserver !== 'function') return false;
    observer = new root.MutationObserver((mutations) => {
      if (mutations.some((mutation) => {
        const target = mutation.target;
        return target?.id === PANEL_ID
          || target?.id === LIST_ID
          || Array.from(mutation.addedNodes || []).some((node) => (
            node?.id === PANEL_ID
            || node?.id === LIST_ID
            || node?.querySelector?.(`#${PANEL_ID}, #${LIST_ID}, .canvas-warning-item`)
          ));
      })) {
        queuePrune();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    return true;
  }

  function install() {
    if (!hasDocument()) return false;
    const patched = [
      sanitizeModelWarnings() > 0,
      patchWarningSources(),
      patchBackendLifecycle(),
      patchCanvasWarningPanel(),
      installObserver(),
      installLifecycleEvents()
    ].some(Boolean);
    pruneCanvasWarningPanel();
    if (!installed || patched) {
      installed = true;
      root.setTimeout?.(queuePrune, 120);
      root.setTimeout?.(queuePrune, 600);
      root.setTimeout?.(queuePrune, 1800);
    }
    return patched;
  }

  if (hasDocument()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }

  return {
    version: VERSION,
    cacheKey: CACHE_KEY,
    suppressedFields: Array.from(SUPPRESSED_PUMP_INPUT_FIELDS),
    install,
    filterWarningList,
    isSuppressedPumpEnvelopeWarning,
    isBackendUnavailableWarning,
    shouldExpireBackendWarning,
    shouldSuppressWarning,
    isCurrentVerifiedBackendResult,
    enforceTerminalBackendFailure,
    sanitizeModelWarnings,
    pruneCanvasWarningPanel
  };
});
