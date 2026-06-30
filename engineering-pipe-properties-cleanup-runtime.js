(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'engineering-pipe-properties-cleanup-runtime.v1';
  const CACHE_KEY = '20260630-pipe-properties-cleanup1';
  const STYLE_ID = 'engineering-pipe-properties-cleanup-style';
  const SURFACE_SELECTOR = [
    '.persistent-object-properties-task-window[data-kind="pipe"]',
    '#taskWindow[data-kind="pipe"]',
    '.task-window-pipe-active',
    '.task-window[data-kind="pipe"]'
  ].join(',');
  const REMOVED_PROPERTY_KEYS = [
    'routeStyle',
    'pressureClass',
    'endConnection',
    'elevationProfileMode',
    'startElevation',
    'endElevation',
    'headLossAllowancePercent',
    'roughnessAgingFactor'
  ];
  const REMOVED_PROPERTY_LABELS = [
    'Pipe Routing',
    'Pipe Rating/Class',
    'End Connection Basis',
    'Elevation Profile',
    'Start Elevation Override',
    'End Elevation Override',
    'Head Loss Allowance',
    'Aging Roughness Factor'
  ];
  const REMOVED_SEGMENT_KEYS = [
    'startElevation',
    'endElevation'
  ];
  const REMOVED_SEGMENT_LABELS = [
    'z in (m)',
    'z out (m)'
  ];
  const HIGH_POINT_PATTERN = /^(?:controlling\s+)?high\s+point/i;
  const ROW_SELECTOR = [
    '.object-property-row',
    '.pipe-task-field-row',
    '.object-task-field-row',
    '.field-card',
    '.object-field',
    '.task-field',
    '.prop-row',
    '.property-row',
    '.form-row',
    '.form-group',
    '.input-row',
    '.input-group',
    '.task-window-field',
    'label',
    'tr'
  ].join(',');
  const tableScrollMemory = new Map();
  const windowMemory = new Map();
  let observer = null;
  let cleaning = false;
  let scheduled = false;

  function hasDocument() {
    return typeof document !== 'undefined' && !!document.documentElement;
  }

  function cssEscape(value) {
    if (root.CSS?.escape) return root.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function normalizeKey(value) {
    return String(value ?? '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
  }

  function runtimeModel() {
    try {
      if (typeof globalModel !== 'undefined' && globalModel) return globalModel;
    } catch (error) {
      // Protected builds may only expose model through window.
    }
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function modelNodeType(id = '') {
    const node = runtimeModel()?.[id];
    return node?.type ? String(node.type).toLowerCase() : '';
  }

  function isPipeSurface(element) {
    if (!element || typeof element.matches !== 'function') return false;
    if (element.matches(SURFACE_SELECTOR)) return true;
    const dataset = element.dataset || {};
    const kind = String(dataset.kind || dataset.nodeType || dataset.taskNodeType || '').toLowerCase();
    const nodeId = dataset.nodeId || dataset.node || dataset.taskNodeId || '';
    return kind === 'pipe'
      || modelNodeType(nodeId) === 'pipe'
      || !!element.querySelector?.('#pipeSegmentTable, table.segment-table, .btn-add-segment[data-node]');
  }

  function pipeSurfaces(scope = document) {
    if (!hasDocument()) return [];
    const surfaces = [];
    const add = (candidate) => {
      if (candidate && isPipeSurface(candidate) && !surfaces.includes(candidate)) surfaces.push(candidate);
    };
    add(scope);
    scope?.querySelectorAll?.(SURFACE_SELECTOR).forEach(add);
    scope?.querySelectorAll?.('.task-window, .persistent-object-properties-task-window, #taskWindow').forEach(add);
    return surfaces;
  }

  function isInsideSegmentTable(element) {
    return !!element?.closest?.('#pipeSegmentTable, table.segment-table');
  }

  function matchesRemovedPropertyKey(value) {
    const key = normalizeKey(value);
    return REMOVED_PROPERTY_KEYS.some((removed) => normalizeKey(removed) === key)
      || HIGH_POINT_PATTERN.test(normalizeText(value));
  }

  function matchesRemovedPropertyLabel(value) {
    const text = normalizeText(value);
    if (!text) return false;
    return REMOVED_PROPERTY_LABELS.includes(text) || HIGH_POINT_PATTERN.test(text);
  }

  function rowForElement(element) {
    let row = element?.closest?.(ROW_SELECTOR) || element?.parentElement || null;
    while (row?.parentElement && row.matches?.('label') && !row.querySelector?.('input, select, textarea')) {
      row = row.parentElement.closest?.(ROW_SELECTOR) || row.parentElement;
    }
    return row || element || null;
  }

  function hideAndRemove(element) {
    if (!element || element.dataset?.pipeCleanupKeep === 'true') return false;
    const row = rowForElement(element);
    if (!row || row === document.body || row === document.documentElement) return false;
    if (row.querySelector?.('#pipeSegmentTable, table.segment-table')) return false;
    row.classList?.add('pipe-properties-cleanup-hidden');
    row.setAttribute?.('data-pipe-properties-cleaned', 'true');
    if (typeof row.remove === 'function') {
      row.remove();
      return true;
    }
    return false;
  }

  function tableCells(row) {
    return Array.from(row?.children || []).filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD');
  }

  function headerCells(table) {
    const headerRow = table.tHead?.rows?.[0]
      || Array.from(table.querySelectorAll('tr')).find((row) => tableCells(row).some((cell) => cell.tagName === 'TH'))
      || table.querySelector('tr');
    return tableCells(headerRow);
  }

  function removeTableColumn(table, index) {
    let removed = false;
    Array.from(table.querySelectorAll('tr')).forEach((row) => {
      const cells = tableCells(row);
      const cell = cells[index];
      if (cell) {
        cell.classList.add('pipe-properties-cleanup-hidden');
        cell.remove();
        removed = true;
      }
    });
    return removed;
  }

  function removeColumnForElement(table, element) {
    const cell = element?.closest?.('td, th');
    const row = cell?.parentElement;
    const index = tableCells(row).indexOf(cell);
    return index >= 0 ? removeTableColumn(table, index) : false;
  }

  function segmentTables(surface) {
    return Array.from(surface?.querySelectorAll?.('#pipeSegmentTable, table.segment-table, table') || [])
      .filter((table) => table.id === 'pipeSegmentTable'
        || table.classList?.contains('segment-table')
        || !!table.querySelector?.('.segment-input, [data-field="diameter"], [data-field="length"], [data-field="roughness"]'));
  }

  function scrollContainerForTable(table) {
    const explicit = table?.closest?.('.segment-table-scroll');
    if (explicit) return explicit;
    let current = table?.parentElement || null;
    while (current && current !== document.body) {
      const canScrollX = (Number(current.scrollWidth) || 0) > (Number(current.clientWidth) || 0) + 1;
      if (canScrollX) return current;
      current = current.parentElement;
    }
    return table || null;
  }

  function surfaceKey(surface) {
    const dataset = surface?.dataset || {};
    return dataset.nodeId || dataset.node || dataset.taskNodeId || surface?.id || 'pipe-properties';
  }

  function rememberStableState(scope = document) {
    if (!hasDocument()) return 0;
    let count = 0;
    pipeSurfaces(scope).forEach((surface) => {
      const key = surfaceKey(surface);
      const body = surface.querySelector?.('.task-window-body, [data-task-prop-body="true"], #taskWindowBody') || surface;
      const rect = surface.getBoundingClientRect?.();
      windowMemory.set(key, {
        left: surface.style?.left || '',
        top: surface.style?.top || '',
        right: surface.style?.right || '',
        bottom: surface.style?.bottom || '',
        width: surface.style?.width || '',
        height: surface.style?.height || '',
        rectLeft: rect?.left,
        rectTop: rect?.top,
        bodyScrollTop: Number(body?.scrollTop) || 0,
        capturedAt: Date.now()
      });
      segmentTables(surface).forEach((table) => {
        const scroll = scrollContainerForTable(table);
        if (!scroll) return;
        tableScrollMemory.set(`${key}:${table.id || table.className || 'segments'}`, {
          left: Number(scroll.scrollLeft) || 0,
          top: Number(scroll.scrollTop) || 0,
          capturedAt: Date.now()
        });
        count += 1;
      });
    });
    return count;
  }

  function restoreStableState(scope = document) {
    if (!hasDocument()) return 0;
    let count = 0;
    pipeSurfaces(scope).forEach((surface) => {
      const key = surfaceKey(surface);
      const state = windowMemory.get(key);
      if (state && Date.now() - state.capturedAt < 12000) {
        const body = surface.querySelector?.('.task-window-body, [data-task-prop-body="true"], #taskWindowBody') || surface;
        if (surface.classList?.contains('task-window-user-positioned')) {
          if (state.left) surface.style.left = state.left;
          if (state.top) surface.style.top = state.top;
          if (state.right) surface.style.right = state.right;
          if (state.bottom) surface.style.bottom = state.bottom;
          if (state.width) surface.style.width = state.width;
          if (state.height) surface.style.height = state.height;
        }
        if (body && Number.isFinite(state.bodyScrollTop)) body.scrollTop = state.bodyScrollTop;
      }
      segmentTables(surface).forEach((table) => {
        const scroll = scrollContainerForTable(table);
        if (!scroll) return;
        const memoryKey = `${key}:${table.id || table.className || 'segments'}`;
        const tableState = tableScrollMemory.get(memoryKey);
        if (!tableState || Date.now() - tableState.capturedAt > 12000) return;
        const maxLeft = Math.max(0, (Number(scroll.scrollWidth) || 0) - (Number(scroll.clientWidth) || 0));
        scroll.scrollLeft = Math.min(Math.max(0, tableState.left), maxLeft);
        scroll.scrollTop = tableState.top;
        count += 1;
      });
    });
    return count;
  }

  function cleanSegmentColumns(surface) {
    let count = 0;
    const removedHeaderText = new Set(REMOVED_SEGMENT_LABELS.map((label) => normalizeText(label).toLowerCase()));
    segmentTables(surface).forEach((table) => {
      const indexes = headerCells(table)
        .map((cell, index) => (removedHeaderText.has(normalizeText(cell.textContent).toLowerCase()) ? index : -1))
        .filter((index) => index >= 0)
        .sort((left, right) => right - left);
      indexes.forEach((index) => {
        if (removeTableColumn(table, index)) count += 1;
      });
      REMOVED_SEGMENT_KEYS.forEach((key) => {
        table.querySelectorAll(`[data-field="${cssEscape(key)}"], [data-key="${cssEscape(key)}"], [data-prop-key="${cssEscape(key)}"], [name="${cssEscape(key)}"]`)
          .forEach((element) => {
            if (removeColumnForElement(table, element)) count += 1;
          });
      });
    });
    return count;
  }

  function cleanPropertyFields(surface) {
    let count = 0;
    surface.querySelectorAll?.('.pipe-aging-roughness-help').forEach((help) => {
      help.classList.add('pipe-properties-cleanup-hidden');
      help.remove();
      count += 1;
    });
    REMOVED_PROPERTY_KEYS.forEach((key) => {
      surface.querySelectorAll?.(`[data-prop-key="${cssEscape(key)}"], [data-key="${cssEscape(key)}"], [name="${cssEscape(key)}"]`)
        .forEach((element) => {
          if (isInsideSegmentTable(element)) return;
          if (hideAndRemove(element)) count += 1;
        });
    });
    surface.querySelectorAll?.('[data-prop-key], [data-key], [name], [aria-label]')
      .forEach((element) => {
        if (isInsideSegmentTable(element)) return;
        const value = element.dataset?.propKey
          || element.dataset?.key
          || element.getAttribute?.('name')
          || element.getAttribute?.('aria-label')
          || '';
        if (matchesRemovedPropertyKey(value) && hideAndRemove(element)) count += 1;
      });
    surface.querySelectorAll?.('.prop-label, .field-label, .form-label, .input-label, label, th, span, div')
      .forEach((element) => {
        if (isInsideSegmentTable(element)) return;
        const text = normalizeText(element.textContent);
        if (!matchesRemovedPropertyLabel(text)) return;
        if (hideAndRemove(element)) count += 1;
      });
    Array.from(surface.querySelectorAll?.(ROW_SELECTOR) || [])
      .forEach((row) => {
        if (isInsideSegmentTable(row) || row.querySelector?.('#pipeSegmentTable, table.segment-table')) return;
        const text = normalizeText(row.textContent);
        const hasControl = !!row.querySelector?.('input, select, textarea, button');
        const hasRemovedLabel = REMOVED_PROPERTY_LABELS.some((label) => text.includes(label)) || HIGH_POINT_PATTERN.test(text);
        if (hasControl && hasRemovedLabel && hideAndRemove(row)) count += 1;
      });
    return count;
  }

  function clean(scope = document, options = {}) {
    if (!hasDocument() || cleaning) return { removedFields: 0, removedColumns: 0, restored: 0 };
    cleaning = true;
    try {
      if (options.capture !== false) rememberStableState(document);
      let removedFields = 0;
      let removedColumns = 0;
      pipeSurfaces(scope).forEach((surface) => {
        removedFields += cleanPropertyFields(surface);
        removedColumns += cleanSegmentColumns(surface);
      });
      const restored = restoreStableState(document);
      root.__pipePropertiesCleanupState = {
        version: VERSION,
        cacheKey: CACHE_KEY,
        removedFields,
        removedColumns,
        restored,
        updatedAt: new Date().toISOString()
      };
      return root.__pipePropertiesCleanupState;
    } finally {
      cleaning = false;
    }
  }

  function scheduleClean(scope = document) {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      clean(scope, { capture: false });
      root.requestAnimationFrame?.(() => {
        clean(document, { capture: false });
        restoreStableState(document);
      });
      [20, 80, 180, 360].forEach((delay) => {
        root.setTimeout?.(() => {
          clean(document, { capture: false });
          restoreStableState(document);
        }, delay);
      });
    };
    if (root.queueMicrotask) root.queueMicrotask(run);
    else root.setTimeout?.(run, 0);
  }

  function injectStyles() {
    if (!hasDocument() || document.getElementById(STYLE_ID)) return;
    const topLevelFieldRows = [
      '.object-property-row',
      '.pipe-task-field-row',
      '.object-task-field-row',
      '.field-card',
      '.object-field',
      '.task-field',
      '.prop-row',
      '.property-row',
      '.form-row',
      '.form-group',
      '.input-row',
      '.input-group',
      '.task-window-field'
    ].join(',');
    const pipeSurface = `:is(${SURFACE_SELECTOR})`;
    const keySelectors = REMOVED_PROPERTY_KEYS.flatMap((key) => [
      `${pipeSurface} :is(${topLevelFieldRows})[data-prop-key="${cssEscape(key)}"]`,
      `${pipeSurface} :is(${topLevelFieldRows})[data-key="${cssEscape(key)}"]`,
      `${pipeSurface} :is(${topLevelFieldRows}) [name="${cssEscape(key)}"]`,
      `${pipeSurface} :is(${topLevelFieldRows}) [data-prop-key="${cssEscape(key)}"]`,
      `${pipeSurface} :is(${topLevelFieldRows}) [data-key="${cssEscape(key)}"]`
    ]);
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.pipe-properties-cleanup-hidden,
${keySelectors.join(',\n')} {
  display: none !important;
  visibility: hidden !important;
}
.persistent-object-properties-task-window[data-kind="pipe"],
#taskWindow[data-kind="pipe"],
.task-window-pipe-active {
  overflow-anchor: none;
  contain: layout style;
}
.persistent-object-properties-task-window[data-kind="pipe"] .segment-table-scroll,
#taskWindow[data-kind="pipe"] .segment-table-scroll,
.task-window-pipe-active .segment-table-scroll {
  overflow-anchor: none;
  scroll-behavior: auto !important;
}
`;
    document.head.appendChild(style);
  }

  function attachRetentionListeners() {
    if (!hasDocument() || root.__pipePropertiesCleanupRetentionListeners) return;
    root.__pipePropertiesCleanupRetentionListeners = true;
    ['pointerdown', 'focusin', 'input', 'change', 'keydown', 'scroll'].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (!event.target?.closest?.(SURFACE_SELECTOR)) return;
        rememberStableState(document);
        scheduleClean(document);
      }, true);
    });
    [
      'npsh:calculation-stale',
      'npsh:calculation-calculating',
      'npsh:calculation-applying-results',
      'npsh:calculation-current',
      'npsh:linked-views-refreshed',
      'npsh:realtime-autosolve-start',
      'npsh:realtime-autosolve-complete',
      'npsh:calculation-lifecycle'
    ].forEach((eventName) => {
      document.addEventListener(eventName, () => scheduleClean(document), true);
    });
  }

  function installObserver() {
    if (!hasDocument() || observer) return;
    observer = new MutationObserver((mutations) => {
      let shouldClean = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes?.forEach((node) => {
          if (node?.nodeType !== 1) return;
          if (isPipeSurface(node) || node.querySelector?.(SURFACE_SELECTOR)) shouldClean = true;
          if (node.querySelector?.('#pipeSegmentTable, table.segment-table, .pipe-aging-roughness-help')) shouldClean = true;
        });
      });
      if (shouldClean) scheduleClean(document);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    root.__pipePropertiesCleanupObserver = true;
  }

  function install() {
    if (!hasDocument()) return false;
    injectStyles();
    attachRetentionListeners();
    installObserver();
    clean(document);
    root.__pipePropertiesCleanupInstalled = {
      version: VERSION,
      cacheKey: CACHE_KEY,
      installedAt: new Date().toISOString()
    };
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    install,
    clean,
    scheduleClean,
    rememberStableState,
    restoreStableState,
    removedPropertyKeys: REMOVED_PROPERTY_KEYS.slice(),
    removedPropertyLabels: REMOVED_PROPERTY_LABELS.slice(),
    removedSegmentKeys: REMOVED_SEGMENT_KEYS.slice(),
    removedSegmentLabels: REMOVED_SEGMENT_LABELS.slice()
  };

  root.EngineeringPipePropertiesCleanupRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (!hasDocument()) return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
