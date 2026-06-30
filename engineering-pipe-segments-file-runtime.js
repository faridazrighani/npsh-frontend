(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'engineering-pipe-segments-file-runtime.v3';
  const CACHE_KEY = '20260630-pipe-segments-clean-legacy-fields1';
  const SCHEMA_TYPE = 'pipe-segments-export.v1';
  const STYLE_ID = 'engineering-pipe-segments-file-style';
  const ACTIONS_CLASS = 'pipe-segments-file-actions';
  const STATUS_CLASS = 'pipe-segments-file-status';
  const SCROLL_GUARD_ATTR = 'pipeSegmentsScrollGuard';
  const segmentScrollMemory = new Map();
  const REMOVED_SEGMENT_FIELDS = new Set([
    'startElevation',
    'endElevation'
  ]);

  const NUMERIC_FIELDS = new Set([
    'diameter',
    'length',
    'roughness',
    'fittingQuantity',
    'fittingK',
    'minorLoss',
    'equivalentLength'
  ]);
  const STRING_FIELDS = new Set([
    'name',
    'pipeSize',
    'material',
    'fittingType'
  ]);
  const NON_NEGATIVE_FIELDS = new Set([
    'diameter',
    'length',
    'roughness',
    'fittingQuantity',
    'fittingK',
    'minorLoss',
    'equivalentLength'
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  function stripRemovedSegmentFields(segment) {
    const normalized = clone(segment);
    if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) return normalized;
    Object.keys(normalized).forEach((field) => {
      const compact = field.replace(/[^a-z]/gi, '').toLowerCase();
      if (REMOVED_SEGMENT_FIELDS.has(field) || (compact.startsWith('high') && compact.includes('point'))) {
        delete normalized[field];
      }
    });
    return normalized;
  }

  function runtimeModel() {
    try {
      if (typeof globalModel !== 'undefined' && globalModel) return globalModel;
    } catch (error) {
      // Some protected contexts only expose the bridge object.
    }
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function formatTimestamp(date = new Date()) {
    return [
      `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
      `${pad2(date.getHours())}-${pad2(date.getMinutes())}-${pad2(date.getSeconds())}`
    ].join('_');
  }

  function filenameForDate(date = new Date()) {
    return `pipe-segments-export_${formatTimestamp(date)}.v1`;
  }

  function getPipeNode(pipeId) {
    const model = runtimeModel();
    const node = model?.[pipeId];
    return node?.type === 'pipe' ? node : null;
  }

  function resolvePipeId(preferredPipeId = '', context = null) {
    if (preferredPipeId && getPipeNode(preferredPipeId)) return preferredPipeId;
    const holder = context?.closest?.('[data-node], [data-node-id], [data-task-node-id]');
    const holderId = holder?.dataset?.node || holder?.dataset?.nodeId || holder?.dataset?.taskNodeId;
    if (holderId && getPipeNode(holderId)) return holderId;
    const addButton = context?.querySelector?.('.btn-add-segment[data-node]')
      || context?.closest?.('.task-window, .persistent-object-properties-task-window')?.querySelector?.('.btn-add-segment[data-node]')
      || (typeof document !== 'undefined' ? document.querySelector('.btn-add-segment[data-node]') : null);
    const addButtonId = addButton?.dataset?.node;
    if (addButtonId && getPipeNode(addButtonId)) return addButtonId;
    try {
      if (typeof currentSelectedNode !== 'undefined' && getPipeNode(currentSelectedNode)) return currentSelectedNode;
    } catch (error) {
      // Fall through to first pipe in model.
    }
    const model = runtimeModel();
    return Object.keys(model || {}).find((id) => model[id]?.type === 'pipe') || '';
  }

  function buildExportPayload(pipeId, now = new Date()) {
    const resolvedPipeId = resolvePipeId(pipeId);
    const pipeNode = getPipeNode(resolvedPipeId);
    if (!pipeNode) {
      throw new Error('Pipe Segments export requires an active Pipe object.');
    }
    const segments = Array.isArray(pipeNode.props?.segments)
      ? pipeNode.props.segments.map(stripRemovedSegmentFields)
      : [];
    return {
      schemaType: SCHEMA_TYPE,
      schemaVersion: 1,
      app: 'Untirta Ghani PIPE NPSH',
      exportedAt: now.toISOString(),
      pipeId: resolvedPipeId,
      pipeName: pipeNode.name || resolvedPipeId,
      segmentCount: segments.length,
      segments
    };
  }

  function validateNumberField(name, value, errors, index) {
    if (value === '' || value === null || typeof value === 'undefined') return value;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      errors.push(`Segment ${index + 1}: ${name} must be a finite number.`);
      return value;
    }
    if (name === 'diameter' && numeric <= 0) {
      errors.push(`Segment ${index + 1}: diameter must be greater than zero.`);
    }
    if (NON_NEGATIVE_FIELDS.has(name) && numeric < 0) {
      errors.push(`Segment ${index + 1}: ${name} cannot be negative.`);
    }
    return numeric;
  }

  function normalizeSegment(segment, index, errors) {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
      errors.push(`Segment ${index + 1}: segment must be an object.`);
      return null;
    }
    const normalized = stripRemovedSegmentFields(segment);
    Object.keys(normalized).forEach((field) => {
      if (NUMERIC_FIELDS.has(field)) {
        normalized[field] = validateNumberField(field, normalized[field], errors, index);
      } else if (STRING_FIELDS.has(field) && normalized[field] !== null && typeof normalized[field] !== 'undefined') {
        normalized[field] = String(normalized[field]);
      }
    });
    if (!String(normalized.name || '').trim()) {
      normalized.name = `Imported Segment ${index + 1}`;
    }
    return normalized;
  }

  function validateImportPayload(payload) {
    const errors = [];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, errors: ['Import file must contain a JSON object.'], segments: [] };
    }
    if (payload.schemaType !== SCHEMA_TYPE || payload.schemaVersion !== 1) {
      errors.push(`Import schema must be ${SCHEMA_TYPE} version 1.`);
    }
    if (!Array.isArray(payload.segments)) {
      errors.push('Import file must contain a segments array.');
    }
    const segments = Array.isArray(payload.segments)
      ? payload.segments.map((segment, index) => normalizeSegment(segment, index, errors)).filter(Boolean)
      : [];
    if (!segments.length) {
      errors.push('Import file must contain at least one Pipe Segment.');
    }
    return {
      ok: errors.length === 0,
      errors,
      payload,
      segments
    };
  }

  function parseImportText(text) {
    try {
      return validateImportPayload(JSON.parse(text));
    } catch (error) {
      return { ok: false, errors: [`Import file is not valid JSON: ${error.message}`], segments: [] };
    }
  }

  function setStatus(container, message, mode = 'info') {
    const status = container?.querySelector?.(`.${STATUS_CLASS}`);
    if (!status) return;
    status.textContent = message || '';
    status.dataset.status = mode;
  }

  function markSegmentsStale(pipeId) {
    const reason = 'Pipe Segments imported from local file; rerun Solve for current backend results.';
    if (root.EngineeringRealtimeCalculationDefense?.markStale) {
      return root.EngineeringRealtimeCalculationDefense.markStale(pipeId, reason);
    }
    const model = runtimeModel();
    const ids = Object.keys(model || {}).filter((id) => model[id]?.type === 'pump' || id === pipeId);
    ids.forEach((id) => {
      const node = model[id];
      if (!node) return;
      if (!node.results || typeof node.results !== 'object') node.results = {};
      node.results.calculationFreshness = 'Stale';
      node.results.backendValidationStatus = 'Stale';
      node.results.backendValidationMessage = reason;
      node.results.isCalculationStale = true;
    });
    root.__engineeringCalculationDefenseRealtimeState = {
      version: VERSION,
      status: 'Stale',
      reason,
      nodeIds: ids,
      markedAt: new Date().toISOString()
    };
    return root.__engineeringCalculationDefenseRealtimeState;
  }

  function findPipeTaskWindows(pipeId) {
    if (typeof document === 'undefined') return [];
    return Array.from(document.querySelectorAll('.task-window, .persistent-object-properties-task-window'))
      .filter((taskWindow) => {
        const dataset = taskWindow.dataset || {};
        return dataset.node === pipeId
          || dataset.nodeId === pipeId
          || dataset.taskNodeId === pipeId
          || taskWindow.querySelector?.(`.btn-add-segment[data-node="${pipeId}"]`);
      });
  }

  function pipeSegmentTables(scope = document) {
    if (typeof document === 'undefined') return [];
    return Array.from((scope || document).querySelectorAll?.('#pipeSegmentTable, table.segment-table') || [])
      .filter((table) => table.id === 'pipeSegmentTable' || table.querySelector?.('.segment-input'));
  }

  function segmentScrollContainer(table) {
    const explicit = table?.closest?.('.segment-table-scroll');
    if (explicit && (Number(explicit.scrollWidth) || 0) > (Number(explicit.clientWidth) || 0) + 1) return explicit;
    let current = table?.parentElement || null;
    while (current) {
      if ((Number(current.scrollWidth) || 0) > (Number(current.clientWidth) || 0) + 1) return current;
      current = current.parentElement;
    }
    return table || null;
  }

  function segmentScrollKey(table) {
    const context = table?.closest?.('.task-window, .persistent-object-properties-task-window') || table?.parentElement || null;
    return resolvePipeId('', context) || context?.dataset?.nodeId || context?.dataset?.taskNodeId || table?.id || 'pipe-segments';
  }

  function rememberSegmentScroll(table) {
    const scroll = segmentScrollContainer(table);
    if (!scroll) return null;
    const key = segmentScrollKey(table);
    const state = {
      left: Number(scroll.scrollLeft) || 0,
      top: Number(scroll.scrollTop) || 0,
      capturedAt: Date.now()
    };
    segmentScrollMemory.set(key, state);
    root.__pipeSegmentsScrollRetentionState = { key, ...state };
    return state;
  }

  function rememberSegmentScrollPositions(scope = document) {
    let count = 0;
    pipeSegmentTables(scope).forEach((table) => {
      if (rememberSegmentScroll(table)) count += 1;
    });
    return count;
  }

  function restoreSegmentScroll(table) {
    const scroll = segmentScrollContainer(table);
    if (!scroll) return false;
    const state = segmentScrollMemory.get(segmentScrollKey(table));
    if (!state) return false;
    const maxLeft = Math.max(0, (Number(scroll.scrollWidth) || 0) - (Number(scroll.clientWidth) || 0));
    const nextLeft = Math.min(Math.max(0, state.left), maxLeft);
    scroll.scrollLeft = nextLeft;
    scroll.scrollTop = state.top;
    return Math.abs((Number(scroll.scrollLeft) || 0) - nextLeft) <= 2;
  }

  function restoreSegmentScrollPositions(scope = document) {
    let count = 0;
    pipeSegmentTables(scope).forEach((table) => {
      if (restoreSegmentScroll(table)) count += 1;
    });
    return count;
  }

  function scheduleSegmentScrollRestore(table) {
    rememberSegmentScroll(table);
    const key = segmentScrollKey(table);
    [0, 32, 96, 180].forEach((delay) => {
      window.setTimeout(() => {
        const currentTable = pipeSegmentTables(document).find((candidate) => segmentScrollKey(candidate) === key) || table;
        restoreSegmentScroll(currentTable);
      }, delay);
    });
  }

  function attachSegmentScrollGuard(table) {
    const scroll = segmentScrollContainer(table);
    if (!scroll) {
      restoreSegmentScroll(table);
      return;
    }
    if (scroll.dataset?.[SCROLL_GUARD_ATTR] !== 'true') {
      scroll.dataset[SCROLL_GUARD_ATTR] = 'true';
      scroll.addEventListener('scroll', () => rememberSegmentScroll(table), { passive: true });
    }
    if (table.dataset?.[SCROLL_GUARD_ATTR] !== 'true') {
      table.dataset[SCROLL_GUARD_ATTR] = 'true';
      ['focusin', 'input', 'change', 'pointerdown', 'keydown'].forEach((eventName) => {
        table.addEventListener(eventName, () => scheduleSegmentScrollRestore(table), true);
      });
    }
    restoreSegmentScroll(table);
  }

  function rerenderPipeProperties(pipeId) {
    if (typeof document !== 'undefined') rememberSegmentScrollPositions(document);
    if (typeof root.renderSidebar !== 'function') return;
    const taskWindows = findPipeTaskWindows(pipeId);
    if (!taskWindows.length) {
      root.renderSidebar(pipeId, { skipDismissedGuard: true });
      if (typeof document !== 'undefined') window.setTimeout(() => restoreSegmentScrollPositions(document), 0);
      return;
    }
    taskWindows.forEach((taskWindow) => {
      root.renderSidebar(pipeId, { taskWindow, skipDismissedGuard: true });
    });
    if (typeof document !== 'undefined') window.setTimeout(() => restoreSegmentScrollPositions(document), 0);
  }

  function applyImportedSegments(pipeId, payloadOrSegments) {
    const resolvedPipeId = resolvePipeId(pipeId);
    const pipeNode = getPipeNode(resolvedPipeId);
    if (!pipeNode) throw new Error('Import requires an active Pipe object.');
    const validation = Array.isArray(payloadOrSegments)
      ? validateImportPayload({ schemaType: SCHEMA_TYPE, schemaVersion: 1, segments: payloadOrSegments })
      : validateImportPayload(payloadOrSegments);
    if (!validation.ok) throw new Error(validation.errors.join(' '));

    if (!pipeNode.props || typeof pipeNode.props !== 'object') pipeNode.props = {};
    pipeNode.props.segments = clone(validation.segments);
    const staleState = markSegmentsStale(resolvedPipeId);
    rerenderPipeProperties(resolvedPipeId);
    if (typeof document !== 'undefined') {
      syncControls(document);
      document.dispatchEvent(new CustomEvent('engineering-pipe-segments-imported', {
        detail: {
          pipeId: resolvedPipeId,
          segmentCount: validation.segments.length,
          staleState
        }
      }));
      window.setTimeout(() => syncControls(document), 0);
    }
    return {
      ok: true,
      pipeId: resolvedPipeId,
      segmentCount: validation.segments.length,
      staleState
    };
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = root.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
  }

  function exportPipeSegments(pipeId, container = null) {
    const payload = buildExportPayload(pipeId);
    const filename = filenameForDate();
    downloadTextFile(filename, `${JSON.stringify(payload, null, 2)}\n`);
    setStatus(container, `Exported ${payload.segmentCount} segment(s).`, 'success');
    return { filename, payload };
  }

  async function importSegmentsFromFile(pipeId, file, container = null) {
    if (!file) throw new Error('No import file selected.');
    const text = await file.text();
    const validation = parseImportText(text);
    if (!validation.ok) {
      const message = validation.errors.join(' ');
      setStatus(container, message, 'error');
      throw new Error(message);
    }
    const result = applyImportedSegments(pipeId, validation.payload);
    const activeContainer = (typeof document !== 'undefined'
      ? document.querySelector(`.${ACTIONS_CLASS}[data-pipe-id="${result.pipeId}"]`)
      : null) || container;
    setStatus(activeContainer, `Imported ${result.segmentCount} segment(s). Solve is stale.`, 'success');
    return result;
  }

  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.pipe-segments-file-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0 auto;
  min-height: 26px;
}
.pipe-segments-file-btn {
  min-height: 24px;
  padding: 3px 8px;
  border: 1px solid #b7cce0;
  border-radius: 4px;
  background: #ffffff;
  color: #123b5a;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.1;
  cursor: pointer;
}
.pipe-segments-file-btn:hover,
.pipe-segments-file-btn:focus-visible {
  border-color: #2d6fa3;
  background: #eef6fc;
  outline: none;
}
.pipe-segments-file-status {
  max-width: min(360px, 52vw);
  color: #64748b;
  font-size: 10.5px;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pipe-segments-file-status[data-status="success"] { color: #146c43; }
.pipe-segments-file-status[data-status="error"] { color: #b42318; }
`;
    document.head.appendChild(style);
  }

  function createControls(table) {
    const scroll = table.closest?.('.segment-table-scroll') || table;
    const parent = scroll.parentElement;
    if (!parent || parent.querySelector(`.${ACTIONS_CLASS}`)) return;
    const context = table.closest?.('.task-window, .persistent-object-properties-task-window') || parent;
    const pipeId = resolvePipeId('', context);

    const actions = document.createElement('div');
    actions.className = ACTIONS_CLASS;
    actions.dataset.pipeId = pipeId;

    const status = document.createElement('span');
    status.className = STATUS_CLASS;
    status.setAttribute('aria-live', 'polite');

    const importButton = document.createElement('button');
    importButton.type = 'button';
    importButton.className = 'pipe-segments-file-btn';
    importButton.dataset.pipeSegmentsImport = 'true';
    importButton.textContent = 'Import';
    importButton.title = 'Import Pipe Segments from a local .v1 file';

    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'pipe-segments-file-btn';
    exportButton.dataset.pipeSegmentsExport = 'true';
    exportButton.textContent = 'Export';
    exportButton.title = 'Export current Pipe Segments to a local .v1 file';

    const input = document.createElement('input');
    input.type = 'file';
    input.className = 'pipe-segments-file-input';
    input.accept = '.v1,application/json,text/json,text/plain';
    input.hidden = true;

    exportButton.addEventListener('click', () => {
      try {
        exportPipeSegments(resolvePipeId(pipeId, context), actions);
      } catch (error) {
        setStatus(actions, error.message, 'error');
      }
    });
    importButton.addEventListener('click', () => {
      input.click();
    });
    input.addEventListener('change', async () => {
      try {
        await importSegmentsFromFile(resolvePipeId(pipeId, context), input.files?.[0], actions);
      } catch (error) {
        setStatus(actions, error.message, 'error');
      } finally {
        input.value = '';
      }
    });

    actions.append(status, importButton, exportButton, input);
    scroll.insertAdjacentElement('afterend', actions);
  }

  function syncControls(scope = document) {
    if (typeof document === 'undefined') return 0;
    injectStyles();
    const pipeTables = pipeSegmentTables(scope);
    pipeTables.forEach(attachSegmentScrollGuard);
    pipeTables.forEach(createControls);
    restoreSegmentScrollPositions(scope);
    return pipeTables.length;
  }

  function install() {
    if (typeof document === 'undefined') return false;
    if (root.__engineeringPipeSegmentsFileRuntimeInstalled) {
      syncControls(document);
      return false;
    }
    root.__engineeringPipeSegmentsFileRuntimeInstalled = true;
    syncControls(document);
    let pending = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => syncControls(document), 80);
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    root.__engineeringPipeSegmentsFileRuntimeObserver = observer;
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    schemaType: SCHEMA_TYPE,
    formatTimestamp,
    filenameForDate,
    buildExportPayload,
    validateImportPayload,
    parseImportText,
    applyImportedSegments,
    exportPipeSegments,
    importSegmentsFromFile,
    syncControls,
    rememberSegmentScrollPositions,
    restoreSegmentScrollPositions,
    install
  };

  root.EngineeringPipeSegmentsFileRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
