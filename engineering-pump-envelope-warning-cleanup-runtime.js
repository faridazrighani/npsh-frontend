((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringPumpEnvelopeWarningCleanup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = '2026.07-pump-envelope-warning-cleanup1';
  const CACHE_KEY = '20260707-pump-envelope-warning-clean1';
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

  let installed = false;
  let observer = null;
  let pruneTimer = 0;

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

  function filterWarningList(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((warning) => !isSuppressedPumpEnvelopeWarning(warning));
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

  function cleanWarningArray(owner, key) {
    if (!owner || !Array.isArray(owner[key])) return false;
    const cleaned = filterWarningList(owner[key]);
    if (cleaned.length === owner[key].length) return false;
    owner[key] = cleaned;
    return true;
  }

  function sanitizeModelWarnings(model = getActiveModel()) {
    if (!model || typeof model !== 'object') return 0;
    let cleanedCount = 0;
    Object.values(model).forEach((node) => {
      if (!node || node.type !== 'pump') return;
      if (cleanWarningArray(node.results, 'warnings')) cleanedCount += 1;
      if (cleanWarningArray(node.results, 'validationWarnings')) cleanedCount += 1;
      if (cleanWarningArray(node, 'warnings')) cleanedCount += 1;
      if (cleanWarningArray(node, 'validationWarnings')) cleanedCount += 1;
    });
    return cleanedCount;
  }

  function patchFunction(name, filterResult = true) {
    const original = root[name];
    if (typeof original !== 'function' || original.__pumpEnvelopeWarningCleanupPatched) return false;
    const patched = function patchedPumpEnvelopeWarningCleanup(...args) {
      const result = original.apply(this, args);
      return filterResult ? filterWarningList(result) : result;
    };
    patched.__pumpEnvelopeWarningCleanupPatched = true;
    patched.__pumpEnvelopeWarningCleanupOriginal = original;
    root[name] = patched;
    return true;
  }

  function patchWarningSources() {
    const patchedOperating = patchFunction('getPumpOperatingWarnings');
    const patchedValidation = patchFunction('getPumpValidationWarnings');
    return patchedOperating || patchedValidation;
  }

  function patchCanvasWarningPanel() {
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
      if (!isSuppressedPumpEnvelopeWarning(text)) return;
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
      patchCanvasWarningPanel();
      pruneCanvasWarningPanel();
    }, 40) || 0;
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
      patchCanvasWarningPanel(),
      installObserver()
    ].some(Boolean);
    pruneCanvasWarningPanel();
    if (!installed || patched) {
      installed = true;
      root.setTimeout?.(queuePrune, 120);
      root.setTimeout?.(queuePrune, 600);
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
    sanitizeModelWarnings,
    pruneCanvasWarningPanel
  };
});
