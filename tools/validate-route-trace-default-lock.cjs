const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-route-trace-audit.js');
const indexPath = path.join(rootDir, 'index.html');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');

const runtime = require(runtimePath);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');
const repaintLockCss = fs.readFileSync(path.join(rootDir, 'engineering-live-parameter-repaint-lock.css'), 'utf8');
const publish = fs.readFileSync(path.join(rootDir, 'tools', 'publish-local-live.cjs'), 'utf8');

assert.equal(runtime.version, '2026.07-route-trace-audit-v54-route-warning-color-lock', 'Route trace audit runtime should expose the forward/reverse route warning-color lock version.');
assert.equal(typeof runtime.openRouteAuditPanel, 'function', 'Dedicated route audit panel should remain available.');
assert.equal(typeof runtime.pruneDefaultCanvasRouteTraceOverlays, 'function', 'Canvas route trace overlay pruning should be exposed for audit tests.');
assert.equal(typeof runtime.pruneDefaultPumpRouteTraceRows, 'function', 'Pump route trace row pruning should be exposed for audit tests.');
assert.equal(typeof runtime.pruneDefaultSinkCanvasRows, 'function', 'SNK canvas row pruning should be exposed for audit tests.');
assert.equal(typeof runtime.normalizeDefaultSinkCanvasRows, 'function', 'SNK canvas Source/Sink terminology normalizer should be exposed for audit tests.');
assert.equal(typeof runtime.ensureDefaultSinkCanvasRows, 'function', 'SNK canvas Sink Flow/Sink Elev./Sink Head injection should be exposed for audit tests.');
assert.equal(typeof runtime.routePresentationStatuses, 'function', 'Route warning-color status resolution should be exposed for forward/reverse validation.');
assert.equal(typeof runtime.syncRoutePresentationColors, 'function', 'Route warning-color canvas synchronization should be exposed for validation.');
assert.equal(typeof runtime.setRouteTraceCanvasOverlayVisible, 'function', 'Audit/debug unlock should be explicit for canvas overlays.');
assert.equal(typeof runtime.setRouteTracePumpSummaryVisible, 'function', 'Audit/debug unlock should be explicit for pump summary injection.');
assert.equal(typeof runtime.isRouteTraceCanvasOverlayUnlocked, 'function', 'Canvas overlay lock status should be auditable.');
assert.equal(typeof runtime.isRouteTracePumpSummaryUnlocked, 'function', 'Pump summary lock status should be auditable.');

assert(runtimeSource.includes("const CANVAS_OVERLAY_UNLOCK_KEY = 'npsh.routeTraceCanvasOverlayVisible'"), 'Canvas overlay unlock key should be stable and explicit.');
assert(runtimeSource.includes("const PUMP_SUMMARY_UNLOCK_KEY = 'npsh.routeTracePumpSummaryVisible'"), 'Pump summary unlock key should be stable and explicit.');
assert(runtimeSource.includes("const CANVAS_OVERLAY_HIDDEN_CLASS = 'route-trace-canvas-overlay-hidden'"), 'Canvas overlay should use a stable hidden class.');
assert(runtimeSource.includes('const ROUTE_TRACE_CANVAS_TEXT_PATTERN = /\\broute\\s+trace\\b/i;'), 'Canvas overlay lock should only target explicit ROUTE TRACE text.');
assert(runtimeSource.includes('const ROUTE_LOSS_TRACE_CANVAS_TEXT_PATTERN = /\\broute\\b[\\s\\S]*suction\\s+loss[\\s\\S]*disch(?:arge)?\\.?\\s+loss/i;'), 'Canvas overlay lock should target Route/Suction Loss/Disch. Loss trace panels.');
assert(runtimeSource.includes('const PUMP_CANVAS_HIDDEN_ROW_LABELS = new Set(['), 'Pump live panel lock should use the locked hidden-row allowlist.');
assert(runtimeSource.includes("'Basis Vapor Press.'"), 'Pump live panel lock should hide Basis Vapor Press. rows.');
assert(runtimeSource.includes("'Fluid Vapor Press.'"), 'Pump live panel lock should hide Fluid Vapor Press. rows.');
assert(runtimeSource.includes("'NPSH Vapor Press.'"), 'Pump live panel lock should hide NPSH Vapor Press. rows.');
assert(runtimeSource.includes("'Vapor Press. Used'"), 'Pump live panel lock should hide Vapor Press. Used rows.');
assert(runtimeSource.includes('function isHiddenPumpCanvasSectionText'), 'Pump live panel lock should remove ROUTE TRACE sections with info/help suffixes.');
assert(runtimeSource.includes('function isHiddenPumpCanvasRowLabel'), 'Pump live panel lock should normalize route/vapor row labels before hiding them.');
assert(runtimeSource.includes('function dedupePumpCanvasPanelRows'), 'Pump live panel lock should remove duplicated STATUS sections and duplicated status rows.');
assert(runtimeSource.includes("upsertPumpCanvasRow(panel, 'Hydraulic NPSH'"), 'Pump canvas panel lock should add a stable Hydraulic NPSH status row when available.');
assert(runtimeSource.includes("upsertPumpCanvasRow(panel, 'Backend Valid.'"), 'Pump canvas panel lock should add a stable backend validation row when available.');
assert(publish.includes("['run', 'validate:route-trace-default-lock']"), 'Publish flow must run the route-trace/default canvas status lock before deploy.');
assert(runtimeSource.includes('function normalizeHydraulicNpshStatusForMatrix'), 'Pump canvas panel lock should normalize Hydraulic NPSH into the approved matrix labels.');
assert(runtimeSource.includes('isSuctionBoundaryType'), 'Route trace pump route lock must classify valid suction boundaries before showing downstream duty.');
assert(runtimeSource.includes('function orientHydraulicConnection'), 'Route trace must canonicalize reverse construction connections before resolving pump routes.');
assert(runtimeSource.includes('const ROUTE_PRESENTATION_PRIORITY = Object.freeze({'), 'Route warning colors must use one explicit risk/warning/incomplete/safe priority matrix.');
assert(runtimeSource.includes('routeNodeIds.forEach((nodeId) => setWorst(nodeId, routeStatus));'), 'Route warning status must propagate consistently across connected SRC/PFV/Pump/PFV/SNK objects.');
assert(repaintLockCss.includes('.pipe-hydraulic-label-warning .pipe-hydraulic-label-bg'), 'PFV parameter labels must expose warning color styling.');
assert(repaintLockCss.includes('.object-type-sink.sink-status-warning .object-icon'), 'SNK object icons must expose warning color styling.');
assert(repaintLockCss.includes('.object-type-source.source-status-warning .object-icon'), 'SRC object icons must expose warning color styling.');
assert(runtimeSource.includes('isDischargeBoundaryType'), 'Route trace pump route lock must classify valid SNK discharge boundaries before showing downstream duty.');
assert(runtimeSource.includes('route.suctionConnection && route.suctionPipe && route.suctionBoundary'), 'Route trace downstream duty must require a complete live suction route.');
assert(runtimeSource.includes("return 'NPSHr Not Provided';"), 'Pump canvas panel lock should expose the canonical missing-NPSHr status when Manual NPSHr is blank.');
assert(runtimeSource.includes("return 'Cavitation Risk';"), 'Pump canvas panel lock should preserve cavitation risk as a canonical status.');
assert(runtimeSource.includes("return 'Warning';"), 'Pump canvas panel lock should preserve suction-vapor warning as a canonical status.');
assert(runtimeSource.includes("return 'OK';"), 'Pump canvas panel lock should normalize legacy Safe/pass values to OK.');
assert(runtimeSource.includes('const SINK_CANVAS_HIDDEN_ROW_LABELS = new Set(['), 'SNK canvas panel lock should use the locked hidden-row allowlist.');
assert(runtimeSource.includes("'Flow Demand'"), 'SNK canvas panel lock should hide the old Flow Demand display row.');
assert(runtimeSource.includes("'Outlet Flow'"), 'SNK canvas panel lock should hide the old Outlet Flow display row.');
assert(runtimeSource.includes("'Vapor Press.'"), 'SNK canvas panel lock should hide Vapor Press. rows.');
assert(runtimeSource.includes("'Vapor Margin'"), 'SNK canvas panel lock should hide Vapor Margin rows.');
assert(runtimeSource.includes("'Pump NPSH Margin'"), 'SNK canvas panel lock should hide Pump NPSH Margin rows.');
assert(runtimeSource.includes("'NPSH Margin'"), 'SNK canvas panel lock should hide legacy NPSH Margin rows owned by the pump ribbon.');
assert(runtimeSource.includes("upsertSinkCanvasRow(panel, 'Sink Flow'"), 'SNK canvas panel lock should add Sink Flow rows.');
assert(runtimeSource.includes("upsertSinkCanvasRow(panel, 'Sink Elev.'"), 'SNK canvas panel lock should add Sink Elev. rows.');
assert(runtimeSource.includes("upsertSinkCanvasRow(panel, 'Sink Head'"), 'SNK canvas panel lock should add Sink Head rows.');
assert(runtimeSource.includes("upsertSinkCanvasRow(panel, 'Sink P abs'"), 'SNK canvas panel lock should add Sink P abs rows.');
assert(!runtimeSource.includes("upsertSinkCanvasRow(panel, 'Boundary'"), 'SNK canvas panel must not add boundary feasibility audit rows.');
assert(!runtimeSource.includes("upsertSinkCanvasRow(panel, 'Head Res.'"), 'SNK canvas panel must not add head residual audit rows.');
assert(!runtimeSource.includes("upsertSinkCanvasRow(panel, 'Max Elev.'"), 'SNK canvas panel must not add maximum elevation audit rows.');
assert(runtimeSource.includes("label === 'Required Press.' || label === 'Outlet Press.'"), 'SNK canvas panel lock should normalize legacy pressure labels.');
assert(runtimeSource.includes('function patchSinkStatusTooltip'), 'SNK hover tooltip should use the Source/Sink terminology and decimal lock.');
assert(runtimeSource.includes('function syncSinkObjectTooltip'), 'SNK object hover/title should stay synchronized with canonical Sink Flow/P abs/Elev./Head values.');
assert(runtimeSource.includes('function syncPumpObjectTooltip'), 'Pump object hover/title should stay synchronized with current pump live-panel values.');
assert(runtimeSource.includes("routeTraceSinkObjectTooltipLock"), 'SNK object hover/title synchronization should be marked for QA.');
assert(runtimeSource.includes("routeTracePumpObjectTooltipLock"), 'Pump object hover/title synchronization should be marked for QA.');
assert(runtimeSource.includes("data-engineering-runtime-originaltitle"), 'Pump/SNK object hover/title synchronization should update the hover bridge backup title.');
assert(runtimeSource.includes('refreshVisibleAuditSurfaces, delayMs'), 'Backend result application should schedule route presentation refresh after repaint.');
assert(runtimeSource.includes('Sink Elev.:'), 'SNK hover tooltip should include Sink Elev. in the canonical display.');
assert(runtimeSource.includes('const auditLinePattern = /^(Boundary Feasibility|Boundary|Head Residual|Head Res\\.|Max SNK elevation|Max Elev\\.|(?:Pump )?NPSH Margin):/i;'), 'SNK hover tooltip must filter engineering audit and pump-owned NPSH rows from the compact global template.');
assert(runtimeSource.includes('Mode: ${mode'), 'SNK hover tooltip should normalize Flow mode to Flow Demand where applicable.');
assert(runtimeSource.includes('const corePatterns = [/^Mode:/i, /^Sink Flow:/i, /^Sink P abs:/i, /^Sink Elev\\.:/i, /^Sink Head:/i];'), 'SNK hover tooltip should use the same five-row global template as the canvas card.');
assert(runtimeSource.includes('.route-trace-canvas-overlay-hidden{display:none!important;}'), 'Canvas overlay hidden class should be enforced by runtime CSS.');
assert(runtimeSource.includes('.route-trace-sink-mode-hidden{display:none!important;}'), 'SNK mode-ignored property rows should be hidden by runtime CSS.');
assert(runtimeSource.includes('function pruneDefaultPumpRouteTraceRows'), 'Runtime should prune legacy route/loss and hidden pump rows inside pump live panels.');
assert(runtimeSource.includes('function pruneDefaultSinkCanvasRows'), 'Runtime should prune hidden SNK rows inside sink live panels.');
assert(runtimeSource.includes('function ensureDefaultSinkCanvasRows'), 'Runtime should ensure Sink Flow/Sink Elev./Sink Head rows inside sink live panels.');
assert(runtimeSource.includes('function pruneDefaultCanvasRouteTraceOverlays'), 'Runtime should prune route trace canvas overlays by default.');
assert(runtimeSource.includes('function watchDefaultCanvasRouteTraceOverlays'), 'Runtime should watch future canvas overlay insertions.');
assert(runtimeSource.includes('const SOLVER_CANVAS_LAYOUT_REFRESH_HOOKS = ['), 'Canvas layout lock should hook protected solver refresh functions.');
assert(runtimeSource.includes("'refreshBackendProtectedSimulationUi'"), 'Canvas layout lock should run after protected solver UI refresh.');
assert(runtimeSource.includes("'refreshBackendProtectedRealtimeTaskWindows'"), 'Canvas layout lock should run after protected realtime task-window refresh.');
assert(runtimeSource.includes('function canonicalPumpLiveParameterRows'), 'Pump live row builder should filter hidden rows before the canvas panel is rendered.');
assert(runtimeSource.includes('function canonicalPumpCanvasSectionLabel'), 'Pump canvas section lookup should normalize info-icon text before inserting status sections.');
assert(runtimeSource.includes("text.startsWith('STATUS')"), 'Pump canvas section lookup should treat STATUS and STATUS info-icon variants as the same section.');
assert(runtimeSource.includes('function canonicalSinkLiveParameterRows'), 'SNK live row builder should filter hidden rows before the canvas panel is rendered.');
assert(runtimeSource.includes('function syncPumpCanvasFlowRow'), 'Pump canvas Flow row should be synchronized to the route duty flow after solver repaints.');
assert(runtimeSource.includes('function pumpRouteDutyFlow'), 'Pump route duty flow should prefer matching connected SRC/SNK boundary flow before rounded pump result flow.');
assert(runtimeSource.includes("patchCanonicalLiveParameterRowBuilder('buildPumpLiveParameterRows'"), 'Pump live row builder should be wrapped by the canonical canvas contract.');
assert(runtimeSource.includes("patchCanonicalLiveParameterRowBuilder('buildSinkLiveParameterRows'"), 'SNK live row builder should be wrapped by the canonical canvas contract.');
assert(runtimeSource.includes('function startCanonicalLiveParameterRowBuilderRetryLoop'), 'Canonical row-builder guard should retry after delayed caption-audit installation.');
assert(runtimeSource.includes('const SOLVER_CANVAS_LAYOUT_SWEEP_DELAYS = [120, 720];'), 'Solver canvas stabilization should be limited to two calm post-result sweeps.');
assert(runtimeSource.includes('const CANVAS_PRUNE_MIN_INTERVAL_MS = 140;'), 'Canvas pruning should be throttled during drag/attribute churn.');
assert(runtimeSource.includes('function isHydraulicCanvasMutation'), 'Canvas observer should ignore drag-only mutations and react only to hydraulic panel changes.');
assert(runtimeSource.includes("['style', 'class', 'transform', 'data-x', 'data-y'].includes(attr)"), 'Canvas observer should ignore style/class drag mutations outside live hydraulic panels.');
assert(!runtimeSource.includes('[0, 80, 220, 650, 1200]'), 'Solver stabilization must not schedule five repeated layout refreshes.');
assert(!runtimeSource.includes('canonicalLiveParameterRowBuilderRetryCount >= 80'), 'Canonical row-builder retry loop must not run for 20 seconds.');
assert(!runtimeSource.includes('[0, 120, 420, 1000].forEach'), 'Backend result application must not schedule four visible audit refreshes.');
assert(runtimeSource.includes('function scheduleSolverCanvasLayoutStabilitySweep'), 'Canvas layout lock should sweep after delayed solver repaints.');
assert(runtimeSource.includes('root.refreshPipeCanvasHydraulicLabels'), 'Canvas layout lock should refresh PFV labels after solver repaints when the pipe runtime is present.');
assert(runtimeSource.includes('characterData: true'), 'Canvas overlay lock should observe text updates in existing panels.');
assert(runtimeSource.includes('attributes: true'), 'Canvas overlay lock should observe attribute-driven redraws.');
assert(runtimeSource.includes('routeSurfaceRefreshPending'), 'Route surface refreshes should be throttled for performance.');
assert(runtimeSource.includes("if (canvas) observer.observe(canvas, { childList: true, subtree: true });"), 'Global route observer should watch canvas mutations with childList-only scope.');
assert(runtimeSource.includes("if (body && body !== canvas) observer.observe(body, { childList: true, subtree: true });"), 'Global route observer should also watch task-window body mutations with childList-only scope.');
assert(!runtimeSource.includes("observer.observe(document.documentElement, { attributes: true, characterData: true, childList: true, subtree: true })"), 'Global route observer must not watch every document attribute/text mutation.');
assert(runtimeSource.includes('function patchCanvasOverlayRenderHooks'), 'Canvas overlay lock should run after canvas render/update functions.');
assert(runtimeSource.includes("'drawConnections'"), 'Canvas overlay lock should hook drawConnections redraws.');
assert(runtimeSource.includes("'updateSimulation'"), 'Canvas overlay lock should hook updateSimulation redraws.');
assert(runtimeSource.includes('function startDefaultCanvasRouteTraceRetryLoop'), 'Canvas overlay lock should retry while delayed overlays settle.');
assert(runtimeSource.includes('const CANVAS_INTERACTION_PRUNE_DELAYS = [0, 60, 180, 420, 900, 1500, 2300, 3200];'), 'Canvas interaction cleanup should sweep immediately and after delayed click-driven panel repaints.');
assert(runtimeSource.includes('function installCanvasInteractionPanelCleanup'), 'Canvas clicks after opening a file should reinstall the pump-panel cleanup sweep.');
assert(runtimeSource.includes("['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].forEach"), 'Canvas interaction cleanup should cover pointer and mouse click paths.');
assert(runtimeSource.includes('root.addEventListener?.(eventName, handler, true);'), 'Canvas interaction cleanup should listen at window capture phase before document-level event blockers.');
assert(runtimeSource.includes("const handledEvents = typeof WeakSet === 'function' ? new WeakSet() : null;"), 'Canvas interaction cleanup should avoid duplicate window/document sweeps for the same click event.');
assert(runtimeSource.includes('let canvasOverlayImmediatePruneActive = false;'), 'Canvas mutation cleanup should use a re-entrancy guard for immediate pre-paint pruning.');
assert(runtimeSource.includes('function runImmediateDefaultCanvasRouteTracePrune'), 'Canvas mutation cleanup should prune live panels immediately before the next browser frame.');
assert(runtimeSource.includes('function immediateCanvasPruneScopeForMutation'), 'Canvas mutation cleanup should target only the changed live panel to avoid file-open churn.');
assert(runtimeSource.includes('function hasImmediateDirtyPumpPanelContent'), 'Immediate canvas cleanup should only run when a changed panel actually contains dirty route/duplicate rows.');
assert(runtimeSource.includes('const immediateScopes = new Set();'), 'Hydraulic canvas mutations should collect targeted immediate cleanup scopes.');
assert(runtimeSource.includes('if (hasImmediateDirtyPumpPanelContent(scope)) runImmediateDefaultCanvasRouteTracePrune(scope);'), 'Hydraulic canvas mutations should trigger targeted immediate cleanup only for dirty panels.');
assert(runtimeSource.includes('canvasInteractionPanelCleanup'), 'Install status should report the canvas interaction panel cleanup guard.');
assert(runtimeSource.includes('let canvasOverlayPrunePending = false;'), 'Canvas overlay pruning should coalesce mutation bursts to avoid UI lockups while loading .untirta files.');
assert(runtimeSource.includes("if (valueElement && valueElement.textContent !== existingValue)"), 'SNK Sink Flow/P abs/Elev./Head updates should avoid writing identical text on every observer pass.');
assert(runtimeSource.includes("if (element.dataset.routeTraceDefaultLock !== 'hidden-default')"), 'Canvas overlay lock metadata should be idempotent to avoid observer self-trigger loops.');
assert(runtimeSource.includes("if (!isRouteTracePumpSummaryUnlocked())"), 'Pump route trace summary should be hidden unless explicitly unlocked.');
assert(runtimeSource.includes("body.querySelector('[data-route-audit-pump-summary=\"true\"]')?.remove();"), 'Existing pump route trace summaries should be removed by the default lock.');
assert(runtimeSource.includes("body.dataset.routeTracePumpSummaryDefaultLock = 'hidden-default';"), 'Pump summary lock state should be visible for audit/QA.');
assert(runtimeSource.includes("element.dataset.routeTraceDefaultLock = 'hidden-default';"), 'Canvas overlay lock state should be visible for audit/QA.');
assert(runtimeSource.includes('routeTraceCanvasOverlayDefaultHidden: !isRouteTraceCanvasOverlayUnlocked()'), 'Install status should report canvas overlay default-hidden state.');
assert(runtimeSource.includes('routeTracePumpSummaryDefaultHidden: !isRouteTracePumpSummaryUnlocked()'), 'Install status should report pump summary default-hidden state.');
assert(runtimeSource.includes('watchDefaultCanvasRouteTraceOverlays();'), 'Install should activate canvas overlay pruning.');
assert(runtimeSource.includes('refreshVisibleAuditSurfaces();'), 'Runtime should keep route audit surfaces refreshed without showing pump summary by default.');
assert(runtimeSource.includes('Open Route Calculation Audit'), 'Dedicated audit access should remain available.');

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.items = new Set();
  }

  add(value) {
    this.items.add(value);
    this.owner.className = [...this.items].join(' ');
  }

  remove(value) {
    this.items.delete(value);
    this.owner.className = [...this.items].join(' ');
  }

  contains(value) {
    return this.items.has(value);
  }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.nodeType = 1;
    this.id = '';
    this.className = '';
    this.dataset = {};
    this.attributes = {};
    this.hidden = false;
    this.textContent = '';
    this.style = {};
    this.classList = new FakeClassList(this);
    this.rect = { left: 0, top: 0, width: 260, height: 76 };
    this.eventListeners = {};
  }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  insertBefore(child, before) {
    const index = this.children.indexOf(before);
    if (index >= 0) this.children.splice(index, 0, child);
    else this.children.unshift(child);
    child.parentElement = this;
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  addEventListener(eventName, handler) {
    if (!this.eventListeners[eventName]) this.eventListeners[eventName] = [];
    this.eventListeners[eventName].push(handler);
  }

  dispatchEvent(event) {
    const payload = { target: this, ...event };
    (this.eventListeners[payload.type] || []).forEach((handler) => handler(payload));
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'class') this.className = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'data-route-trace-default-lock') delete this.dataset.routeTraceDefaultLock;
  }

  getBoundingClientRect() {
    return {
      ...this.rect,
      right: this.rect.left + this.rect.width,
      bottom: this.rect.top + this.rect.height
    };
  }

  contains(node) {
    let cursor = node;
    while (cursor) {
      if (cursor === this) return true;
      cursor = cursor.parentElement;
    }
    return false;
  }

  matches(selector) {
    if (selector === '*') return true;
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector === '[data-node-id]') return this.dataset.nodeId !== undefined;
    if (selector === '[data-object-id]') return this.dataset.objectId !== undefined;
    if (selector === '[data-route-audit-pump-summary="true"]') return this.dataset.routeAuditPumpSummary === 'true';
    return false;
  }

  closest(selectorList) {
    const selectors = String(selectorList).split(',').map((value) => value.trim()).filter(Boolean);
    let cursor = this;
    while (cursor) {
      if (selectors.some((selector) => cursor.matches(selector))) return cursor;
      cursor = cursor.parentElement;
    }
    return null;
  }

  querySelectorAll(selector) {
    const selectors = String(selector).split(',').map((value) => value.trim()).filter(Boolean);
    const results = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        if (selectors.some((item) => child.matches(item))) results.push(child);
        visit(child);
      });
    };
    visit(this);
    return results;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super('#document');
    this.readyState = 'loading';
    this.documentElement = new FakeElement('html');
    this.head = new FakeElement('head');
    this.body = new FakeElement('body');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }
}

function section(label) {
  const element = new FakeElement('div');
  element.classList.add('pump-live-param-section');
  element.textContent = label;
  return element;
}

function row(label, value) {
  const element = new FakeElement('div');
  element.classList.add('pump-live-param-row');
  const labelElement = new FakeElement('span');
  labelElement.classList.add('pump-live-param-label');
  labelElement.textContent = label;
  const valueElement = new FakeElement('strong');
  valueElement.classList.add('pump-live-param-value');
  valueElement.textContent = value;
  element.appendChild(labelElement);
  element.appendChild(valueElement);
  return element;
}

function sinkRow(label, value) {
  const element = new FakeElement('div');
  element.classList.add('sink-live-param-row');
  const labelElement = new FakeElement('span');
  labelElement.classList.add('sink-live-param-label');
  labelElement.textContent = label;
  const valueElement = new FakeElement('strong');
  valueElement.classList.add('sink-live-param-value');
  valueElement.textContent = value;
  element.appendChild(labelElement);
  element.appendChild(valueElement);
  return element;
}

function labelsIn(panel, rowSelector = '.pump-live-param-row', labelSelector = '.pump-live-param-label') {
  return panel
    .querySelectorAll(rowSelector)
    .map((element) => element.querySelector(labelSelector)?.textContent || '');
}

function valuesByLabelIn(panel, rowSelector, labelSelector, valueSelector) {
  const values = {};
  panel.querySelectorAll(rowSelector).forEach((element) => {
    const label = element.querySelector(labelSelector)?.textContent || '';
    values[label] = element.querySelector(valueSelector)?.textContent || '';
  });
  return values;
}

function sectionsIn(panel) {
  return panel
    .querySelectorAll('.pump-live-param-section')
    .map((element) => element.textContent || '');
}

const savedGlobals = {
  document: global.document,
  MutationObserver: global.MutationObserver,
  getComputedStyle: global.getComputedStyle,
  localStorage: global.localStorage,
  addEventListener: global.addEventListener,
  clearInterval: global.clearInterval,
  clearTimeout: global.clearTimeout,
  setInterval: global.setInterval,
  setTimeout: global.setTimeout,
  globalModel: global.globalModel,
  connections: global.connections,
  buildPumpLiveParameterRows: global.buildPumpLiveParameterRows,
  buildSinkLiveParameterRows: global.buildSinkLiveParameterRows
};

try {
  const fakeDocument = new FakeDocument();
  const canvas = new FakeElement('div');
  canvas.id = 'canvas';
  fakeDocument.body.appendChild(canvas);

  const routeOverlay = new FakeElement('div');
  routeOverlay.textContent = 'ROUTE TRACE Route Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 Suction Loss 2.616 / 0.246 m/bar Disch. Loss 11.669 / 1.097 m/bar';
  routeOverlay.rect = { left: 8, top: 10, width: 310, height: 82 };
  routeOverlay.style = { position: 'absolute', borderTopStyle: 'solid', borderRightStyle: 'solid', boxShadow: 'none', backgroundColor: 'rgb(255, 255, 255)' };
  canvas.appendChild(routeOverlay);

  const routeLossTracePanel = new FakeElement('div');
  routeLossTracePanel.textContent = 'Route Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 -> PIPE-2 -> SNK-100 Suction Loss 2.616 / 0.246 m/bar Disch. Loss 11.669 / 1.097 m/bar';
  routeLossTracePanel.rect = { left: 8, top: 110, width: 310, height: 82 };
  routeLossTracePanel.style = { position: 'absolute', borderTopStyle: 'solid', borderRightStyle: 'solid', boxShadow: 'none', backgroundColor: 'rgb(255, 255, 255)' };
  canvas.appendChild(routeLossTracePanel);

  const protectedPump = new FakeElement('div');
  protectedPump.className = 'pfd-object';
  protectedPump.classList.add('pfd-object');
  protectedPump.textContent = 'ROUTE TRACE should not hide a pump object container';
  canvas.appendChild(protectedPump);

  const lossOnlyPanel = new FakeElement('div');
  lossOnlyPanel.textContent = 'Mode Flow Demand Outlet Flow Required Press. Discharge Loss Pump NPSH';
  lossOnlyPanel.rect = { left: 420, top: 120, width: 260, height: 120 };
  lossOnlyPanel.style = { position: 'absolute', borderTopStyle: 'solid', borderRightStyle: 'solid', boxShadow: 'none', backgroundColor: 'rgb(255, 255, 255)' };
  canvas.appendChild(lossOnlyPanel);

  const staleHiddenPanel = new FakeElement('div');
  staleHiddenPanel.textContent = 'Suction Loss and Disch. Loss readout should remain visible as an ordinary canvas panel';
  staleHiddenPanel.classList.add('route-trace-canvas-overlay-hidden');
  staleHiddenPanel.dataset.routeTraceDefaultLock = 'hidden-default';
  staleHiddenPanel.setAttribute('aria-hidden', 'true');
  canvas.appendChild(staleHiddenPanel);

  const legacyPumpPanel = new FakeElement('div');
  legacyPumpPanel.classList.add('pump-live-params');
  legacyPumpPanel.appendChild(section('Suction'));
  legacyPumpPanel.appendChild(row('Flow', '50.000'));
  legacyPumpPanel.appendChild(row('Suction Press.', '1.622'));
  legacyPumpPanel.appendChild(row('Basis Vapor Press.', '1.014'));
  legacyPumpPanel.appendChild(row('Vapor Press. Used', '1.014'));
  legacyPumpPanel.appendChild(section('Discharge'));
  legacyPumpPanel.appendChild(row('Pump Head', '24.000'));
  legacyPumpPanel.appendChild(row('Discharge Press.', '3.878'));
  legacyPumpPanel.appendChild(section('Route Trace'));
  legacyPumpPanel.appendChild(row('Route', 'Fluid Basis -> SRC-100 -> PIPE-1 -> P-100'));
  legacyPumpPanel.appendChild(row('Suction Loss', '2.616 / 0.246'));
  legacyPumpPanel.appendChild(row('Disch. Loss', '11.669 / 1.097'));
  canvas.appendChild(legacyPumpPanel);

  const pressureAssistedPumpPanel = new FakeElement('div');
  pressureAssistedPumpPanel.classList.add('pump-live-params');
  pressureAssistedPumpPanel.dataset.nodeId = 'P-ASSIST';
  pressureAssistedPumpPanel.appendChild(section('Discharge'));
  pressureAssistedPumpPanel.appendChild(row('Pump Head', '-3.600'));
  pressureAssistedPumpPanel.appendChild(row('Discharge Press.', '1.799'));
  canvas.appendChild(pressureAssistedPumpPanel);

  const blankRequiredHeadPumpPanel = new FakeElement('div');
  blankRequiredHeadPumpPanel.classList.add('pump-live-params');
  blankRequiredHeadPumpPanel.dataset.nodeId = 'P-REQ';
  blankRequiredHeadPumpPanel.appendChild(section('Discharge'));
  blankRequiredHeadPumpPanel.appendChild(row('Required Head', '-'));
  blankRequiredHeadPumpPanel.appendChild(row('Discharge Press.', '5.722'));
  canvas.appendChild(blankRequiredHeadPumpPanel);

  const canonicalPumpPanel = new FakeElement('div');
  canonicalPumpPanel.classList.add('pump-live-params');
  canonicalPumpPanel.dataset.nodeId = 'P-CANON';
  canonicalPumpPanel.appendChild(section('STATUS i'));
  canonicalPumpPanel.appendChild(row('Hydraulic NPSH', 'OK'));
  canonicalPumpPanel.appendChild(row('Backend Valid.', 'Connected'));
  canonicalPumpPanel.appendChild(section('STATUS i'));
  canonicalPumpPanel.appendChild(row('Hydraulic NPSH', 'OK'));
  canonicalPumpPanel.appendChild(row('Backend Valid.', 'Connected'));
  canonicalPumpPanel.appendChild(section('SUCTION'));
  canonicalPumpPanel.appendChild(row('Flow', '39.700'));
  canonicalPumpPanel.appendChild(row('Suction Press.', '2.155'));
  canonicalPumpPanel.appendChild(row('NPSH Available', '15.3482'));
  canonicalPumpPanel.appendChild(row('NPSH Required', '1.0000'));
  canonicalPumpPanel.appendChild(row('NPSH Margin', '+14.3482'));
  canonicalPumpPanel.appendChild(row('NPSH Ratio', '15.3482'));
  canonicalPumpPanel.appendChild(row('Fluid Vapor Press.', '0.702'));
  canonicalPumpPanel.appendChild(row('NPSH Vapor Press.', '0.702'));
  canonicalPumpPanel.appendChild(section('DISCHARGE'));
  canonicalPumpPanel.appendChild(row('Pump Head', '-'));
  canonicalPumpPanel.appendChild(row('Discharge Press.', '5.722'));
  canonicalPumpPanel.appendChild(section('ROUTE TRACE i'));
  canonicalPumpPanel.appendChild(row('Route:', 'Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 -> PIPE-2 -> SNK-100'));
  canonicalPumpPanel.appendChild(row('Suction Loss', '0.014 / 0.001'));
  canonicalPumpPanel.appendChild(row('Discharge Loss', '0.282 / 0.027'));
  canvas.appendChild(canonicalPumpPanel);

  const legacySinkPanel = new FakeElement('div');
  legacySinkPanel.classList.add('sink-live-params');
  legacySinkPanel.dataset.nodeId = 'SNK-100';
  legacySinkPanel.appendChild(sinkRow('Mode', 'Flow'));
  legacySinkPanel.appendChild(sinkRow('Flow Demand', '50.000'));
  legacySinkPanel.appendChild(sinkRow('Outlet Flow', '50.000'));
  legacySinkPanel.appendChild(sinkRow('Sink P abs', '99.999'));
  legacySinkPanel.appendChild(sinkRow('Required Press.', '1.744'));
  legacySinkPanel.appendChild(sinkRow('Discharge Loss', '11.700'));
  legacySinkPanel.appendChild(sinkRow('Vapor Press.', '1.014'));
  legacySinkPanel.appendChild(sinkRow('Vapor Margin', '+0.730'));
  legacySinkPanel.appendChild(sinkRow('Pump NPSH Margin', '+4.100'));
  legacySinkPanel.appendChild(sinkRow('Boundary', 'Unknown'));
  canvas.appendChild(legacySinkPanel);

  const delayedRouteLossTracePanel = new FakeElement('div');
  delayedRouteLossTracePanel.textContent = 'Route pending backend text';
  delayedRouteLossTracePanel.rect = { left: 8, top: 210, width: 310, height: 82 };
  delayedRouteLossTracePanel.style = { position: 'absolute', borderTopStyle: 'solid', borderRightStyle: 'solid', boxShadow: 'none', backgroundColor: 'rgb(255, 255, 255)' };
  canvas.appendChild(delayedRouteLossTracePanel);

  class FakeMutationObserver {
    static last = null;

    constructor(callback) {
      this.callback = callback;
      FakeMutationObserver.last = this;
    }

    observe(target, options) {
      this.target = target;
      this.options = options;
    }

    disconnect() {}
  }

  global.document = fakeDocument;
  global.globalModel = {
    'P-ASSIST': {
      type: 'pump',
      name: 'P-ASSIST',
      results: {
        routeOnlyNpshEvaluation: true,
        requiredSystemHead: -3.6,
        requiredSystemHeadRaw: -3.6,
        pressureAssistedSystemHead: true,
        solveMode: 'Route-only NPSH design ceiling at fixed route flow'
      }
    },
    'P-REQ': {
      type: 'pump',
      name: 'P-REQ',
      results: {
        routeOnlyNpshEvaluation: true,
        requiredSystemHead: 37.664,
        requiredSystemHeadRaw: 37.664,
        solveMode: 'Route-only NPSH design ceiling at fixed route flow'
      }
    },
    'P-CANON': {
      type: 'pump',
      name: 'P-CANON',
      props: { manualNpshr: 4 },
      results: {
        flow: 39.7,
        npshEvaluation: { flow: 39.7 },
        routeOnlyNpshEvaluation: true,
        requiredSystemHead: 37.664,
        requiredSystemHeadRaw: 37.664,
        hydraulicNpshStatus: 'Safe',
        backendValidationStatus: 'Connected',
        solveMode: 'Route-only NPSH design ceiling at fixed route flow'
      }
    },
    'SRC-CANON': {
      type: 'source',
      name: 'SRC-CANON',
      props: { flow: 39.68 },
      results: { sourceInputFlow: 39.68 }
    },
    'PIPE-SUC-CANON': {
      type: 'pipe',
      name: 'PIPE-SUC-CANON',
      results: { flow: 39.7 }
    },
    'PIPE-DIS-CANON': {
      type: 'pipe',
      name: 'PIPE-DIS-CANON',
      results: { flow: 39.7 }
    },
    'SNK-CANON': {
      type: 'sink',
      name: 'SNK-CANON',
      props: { demandFlow: 39.68 },
      results: {
        flow: 39.68,
        operatingFeasibilityStatus: 'Safe',
        headResidual: 0.029,
        maxAllowableSnkElevation: 10.029
      }
    },
    'SNK-100': {
      type: 'sink',
      name: 'SNK-100',
      props: { elevation: 10 },
      results: { boundaryPressure: 1.743707129, calculatedPressure: 1.743707129, hydraulicHead: 20.345, operatingFeasibilityStatus: 'Unknown' }
    }
  };
  global.connections = [
    { from: 'SRC-CANON', to: 'P-CANON', pipeId: 'PIPE-SUC-CANON', connectionType: 'hydraulic' },
    { from: 'P-CANON', to: 'SNK-CANON', pipeId: 'PIPE-DIS-CANON', connectionType: 'hydraulic' }
  ];
  fakeDocument.readyState = 'complete';
  global.MutationObserver = FakeMutationObserver;
  global.getComputedStyle = (element) => ({
    position: element.style.position || 'static',
    borderTopStyle: element.style.borderTopStyle || 'none',
    borderRightStyle: element.style.borderRightStyle || 'none',
    boxShadow: element.style.boxShadow || 'none',
    backgroundColor: element.style.backgroundColor || 'rgba(0, 0, 0, 0)'
  });
  global.localStorage = {
    store: new Map(),
    getItem(key) { return this.store.get(key) || null; },
    setItem(key, value) { this.store.set(key, String(value)); }
  };
  global.addEventListener = () => {};
  global.clearInterval = () => {};
  global.clearTimeout = () => {};
  global.setInterval = () => 1;
  global.setTimeout = (callback) => {
    callback();
    return 1;
  };
  global.buildPumpLiveParameterRows = () => [
    { type: 'section', label: 'Status' },
    { label: 'Hydraulic NPSH', value: 'OK' },
    { type: 'section', label: 'Suction' },
    { label: 'Flow', value: '39.700' },
    { label: 'Basis Vapor Press.', value: '0.702' },
    { label: 'Vapor Press. Used', value: '0.702' },
    { type: 'section', label: 'Discharge' },
    { label: 'Required Head', value: '37.664' },
    { type: 'section', label: 'Route Trace' },
    { label: 'Route', value: 'Fluid Basis -> SRC-100 -> P-100 -> SNK-100' },
    { label: 'Suction Loss', value: '0.014 / 0.001' },
    { label: 'Disch. Loss', value: '0.282 / 0.027' }
  ];
  global.buildSinkLiveParameterRows = () => [
    { label: 'Mode', value: 'Outlet Pressure' },
    { label: 'Outlet Flow', value: '39.700' },
    { label: 'Sink Flow', value: '39.700' },
    { label: 'Sink P abs', value: '4.936' },
    { label: 'Required Press.', value: '4.936' },
    { label: 'Required Sink P abs', value: '4.936' },
    { label: 'Discharge Loss', value: '0.300' },
    { label: 'Vapor Press.', value: '0.702' },
    { label: 'Vapor Margin', value: '+4.234' }
  ];

  delete require.cache[require.resolve(runtimePath)];
  const browserRuntime = require(runtimePath);
  browserRuntime.install();
  const canonicalBuilderRows = global.buildPumpLiveParameterRows(global.globalModel['P-CANON']);
  assert.deepEqual(
    canonicalBuilderRows.map((row) => row.label),
    ['STATUS', 'Hydraulic NPSH', 'Backend Valid.', 'SUCTION', 'Flow', 'DISCHARGE', 'Required Head'],
    'Pump row-builder wrapper should remove vapor-pressure/route-trace rows and render stable status rows before canvas paint.'
  );
  assert.deepEqual(
    canonicalBuilderRows.slice(0, 3),
    [
      { type: 'section', label: 'STATUS' },
      { label: 'Hydraulic NPSH', value: 'OK' },
      { label: 'Backend Valid.', value: 'Connected' }
    ],
    'Pump row-builder wrapper should render Hydraulic NPSH and Backend Valid. before route-trace cleanup sweeps.'
  );
  assert.deepEqual(
    canonicalBuilderRows.find((row) => row.label === 'Flow'),
    { label: 'Flow', value: '39.680', unit: 'm3/h', title: 'Route duty flow synchronized with the connected SRC/SNK boundary flow.' },
    'Pump row-builder wrapper should synchronize Flow with the connected SRC/SNK boundary duty flow before canvas render.'
  );
  const canonicalConnections = global.connections;
  global.connections = [
    { from: 'P-CANON', to: 'SRC-CANON', pipeId: 'PIPE-SUC-CANON', connectionType: 'hydraulic', hydraulicReversed: true },
    { from: 'P-CANON', to: 'SNK-CANON', pipeId: 'PIPE-DIS-CANON', connectionType: 'hydraulic' }
  ];
  const reversedSuctionRows = global.buildPumpLiveParameterRows(global.globalModel['P-CANON']);
  assert.deepEqual(
    reversedSuctionRows.find((row) => row.label === 'Required Head'),
    { label: 'Required Head', value: '37.664', unit: 'm', title: 'Route-required head from the solved hydraulic system.' },
    'Reverse construction order must resolve to the same complete hydraulic route and preserve current downstream duty.'
  );
  global.connections = canonicalConnections;
  assert.deepEqual(
    global.buildSinkLiveParameterRows().map((row) => row.label),
    ['Mode', 'Sink Flow', 'Sink P abs'],
    'SNK row-builder wrapper should remove transient outlet/loss/vapor rows before canvas render.'
  );
  assert.deepEqual(
    global.buildSinkLiveParameterRows(global.globalModel['SNK-CANON']).map((row) => row.label),
    ['Mode', 'Sink Flow', 'Sink P abs', 'Sink Elev.', 'Sink Head'],
    'SNK row-builder wrapper should render only the five-row global template even when backend audit metrics are available.'
  );

  const pumpWarningState = {
    hydraulicNpshStatus: global.globalModel['P-CANON'].results.hydraulicNpshStatus,
    backendValidationStatus: global.globalModel['P-CANON'].results.backendValidationStatus,
    status: global.globalModel['P-CANON'].results.status
  };
  global.globalModel['P-CANON'].results.hydraulicNpshStatus = 'Warning';
  global.globalModel['P-CANON'].results.backendValidationStatus = 'Connected';
  global.globalModel['P-CANON'].results.status = 'Warning';
  const forwardWarningStatuses = browserRuntime.routePresentationStatuses(global.globalModel);
  ['SRC-CANON', 'PIPE-SUC-CANON', 'P-CANON', 'PIPE-DIS-CANON', 'SNK-CANON'].forEach((nodeId) => {
    assert.equal(forwardWarningStatuses[nodeId], 'warning', `Forward workflow ${nodeId} must inherit the active route warning color.`);
  });
  global.connections = [
    { from: 'P-CANON', fromPort: '.port.inlet', to: 'SRC-CANON', toPort: '.port.outlet', pipeId: 'PIPE-SUC-CANON', connectionType: 'hydraulic' },
    { from: 'SNK-CANON', fromPort: '.port.inlet', to: 'P-CANON', toPort: '.port.outlet', pipeId: 'PIPE-DIS-CANON', connectionType: 'hydraulic' }
  ];
  const reverseWarningStatuses = browserRuntime.routePresentationStatuses(global.globalModel);
  ['SRC-CANON', 'PIPE-SUC-CANON', 'P-CANON', 'PIPE-DIS-CANON', 'SNK-CANON'].forEach((nodeId) => {
    assert.equal(reverseWarningStatuses[nodeId], 'warning', `Reverse workflow ${nodeId} must inherit the same active route warning color.`);
  });
  global.connections = canonicalConnections;
  Object.assign(global.globalModel['P-CANON'].results, pumpWarningState);

  assert(routeOverlay.classList.contains('route-trace-canvas-overlay-hidden'), 'Canvas ROUTE TRACE overlay should be hidden by default.');
  assert.equal(routeOverlay.dataset.routeTraceDefaultLock, 'hidden-default', 'Canvas ROUTE TRACE overlay should carry audit-visible lock metadata.');
  assert.equal(routeOverlay.getAttribute('aria-hidden'), 'true', 'Hidden canvas ROUTE TRACE overlay should also be aria-hidden.');
  assert(routeLossTracePanel.classList.contains('route-trace-canvas-overlay-hidden'), 'Canvas Route/Suction Loss/Disch. Loss panel should be hidden by default.');
  assert.equal(routeLossTracePanel.dataset.routeTraceDefaultLock, 'hidden-default', 'Route/Suction Loss/Disch. Loss panel should carry audit-visible lock metadata.');
  assert(!protectedPump.classList.contains('route-trace-canvas-overlay-hidden'), 'Default lock must not hide the pump PFD object itself.');
  assert(!lossOnlyPanel.classList.contains('route-trace-canvas-overlay-hidden'), 'Default lock must not hide ordinary loss/readout panels without a ROUTE TRACE heading.');
  assert(!staleHiddenPanel.classList.contains('route-trace-canvas-overlay-hidden'), 'Default lock should restore any previously hidden non-ROUTE TRACE panel.');
  assert.equal(staleHiddenPanel.dataset.routeTraceDefaultLock, undefined, 'Restored non-ROUTE TRACE panels should not keep stale route-trace lock metadata.');
  assert.deepEqual(
    labelsIn(legacyPumpPanel),
    ['Flow', 'Suction Press.', 'Required Head', 'Discharge Press.'],
    'Legacy loaded pump panels should migrate Pump Head to Required Head while removing Route/Suction Loss/Disch. Loss and vapor-pressure rows.'
  );
  assert.deepEqual(
    labelsIn(pressureAssistedPumpPanel),
    ['Hydraulic NPSH', 'Backend Valid.', 'Required Head', 'Discharge Press.'],
    'Disconnected pressure-assisted pump panels should show Incomplete/Unverified status and label signed negative head as Required Head, not actual Pump Head.'
  );
  assert.deepEqual(
    valuesByLabelIn(blankRequiredHeadPumpPanel, '.pump-live-param-row', '.pump-live-param-label', '.pump-live-param-value'),
    {
      'Hydraulic NPSH': 'Incomplete',
      'Backend Valid.': 'Unverified',
      'Required Head': '-',
      'Discharge Press.': '-'
    },
    'Route-only pump canvas panels should keep Required Head and Discharge Press blank and avoid claiming backend validity when disconnected.'
  );
  assert.deepEqual(
    sectionsIn(canonicalPumpPanel),
    ['STATUS', 'SUCTION', 'DISCHARGE'],
    'Canonical pump canvas panel should keep a stable STATUS/SUCTION/DISCHARGE layout after open and solve refreshes.'
  );
  assert.deepEqual(
    labelsIn(canonicalPumpPanel),
    [
      'Hydraulic NPSH',
      'Backend Valid.',
      'Flow',
      'Suction Press.',
      'NPSH Available',
      'NPSH Required',
      'NPSH Margin',
      'NPSH Ratio',
      'Required Head',
      'Discharge Press.'
    ],
    'Canonical pump canvas panel should hide vapor-pressure internals and route trace rows while keeping final visible calculation rows.'
  );
  assert.deepEqual(
    valuesByLabelIn(canonicalPumpPanel, '.pump-live-param-row', '.pump-live-param-label', '.pump-live-param-value'),
    {
      'Hydraulic NPSH': 'OK',
      'Backend Valid.': 'Connected',
      Flow: '39.680 m3/h',
      'Suction Press.': '2.155',
      'NPSH Available': '15.3482',
      'NPSH Required': '1.0000',
      'NPSH Margin': '+14.3482',
      'NPSH Ratio': '15.3482',
      'Required Head': '37.664 m',
      'Discharge Press.': '5.722'
    },
    'Canonical pump canvas values should remain stable from file open through delayed route-trace cleanup.'
  );

  const clickRepaintPumpPanel = new FakeElement('div');
  clickRepaintPumpPanel.classList.add('pump-live-params');
  clickRepaintPumpPanel.dataset.nodeId = 'P-CANON';
  clickRepaintPumpPanel.appendChild(section('STATUS i'));
  clickRepaintPumpPanel.appendChild(row('Hydraulic NPSH', 'OK'));
  clickRepaintPumpPanel.appendChild(row('Backend Valid.', 'Connected'));
  clickRepaintPumpPanel.appendChild(section('STATUS i'));
  clickRepaintPumpPanel.appendChild(row('Hydraulic NPSH', 'OK'));
  clickRepaintPumpPanel.appendChild(row('Backend Valid.', 'Connected'));
  clickRepaintPumpPanel.appendChild(section('SUCTION i'));
  clickRepaintPumpPanel.appendChild(row('Flow', '39.700'));
  clickRepaintPumpPanel.appendChild(row('NPSH Vapor Press.', '0.702'));
  clickRepaintPumpPanel.appendChild(section('DISCHARGE i'));
  clickRepaintPumpPanel.appendChild(row('Pump Head', '37.664'));
  clickRepaintPumpPanel.appendChild(section('ROUTE TRACE i'));
  clickRepaintPumpPanel.appendChild(row('Route', 'Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 -> PIPE-2 -> SNK-100'));
  clickRepaintPumpPanel.appendChild(row('Suction Loss', '0.014 / 0.001'));
  clickRepaintPumpPanel.appendChild(row('Disch. Loss', '0.282 / 0.027'));
  canvas.appendChild(clickRepaintPumpPanel);
  fakeDocument.dispatchEvent({ type: 'click', target: canvas });
  assert.deepEqual(
    sectionsIn(clickRepaintPumpPanel),
    ['STATUS', 'SUCTION', 'DISCHARGE'],
    'Open-file canvas clicks should immediately clean duplicate STATUS and ROUTE TRACE sections created by delayed pump-panel repaint.'
  );
  assert.deepEqual(
    labelsIn(clickRepaintPumpPanel),
    ['Hydraulic NPSH', 'Backend Valid.', 'Flow', 'Required Head'],
    'Open-file canvas clicks should remove route/loss/vapor rows from newly repainted pump panels.'
  );
  assert.deepEqual(
    sectionsIn(legacyPumpPanel),
    ['SUCTION', 'DISCHARGE'],
    'Legacy loaded pump panels should normalize SUCTION/DISCHARGE sections and remove Route Trace section.'
  );
  assert.deepEqual(
    labelsIn(legacySinkPanel, '.sink-live-param-row', '.sink-live-param-label'),
    ['Mode', 'Sink Flow', 'Sink P abs', 'Sink Elev.', 'Sink Head'],
    'Legacy loaded SNK panels should normalize flow/pressure labels, add Sink Elev./Sink Head, and remove duplicate Flow Demand/Outlet Flow plus Discharge Loss/Vapor Press./Vapor Margin/Pump NPSH Margin rows.'
  );
  assert.deepEqual(
    valuesByLabelIn(legacySinkPanel, '.sink-live-param-row', '.sink-live-param-label', '.sink-live-param-value'),
    {
      Mode: 'Flow Demand',
      'Sink Flow': '50.000 m3/h',
      'Sink P abs': '1.744 bar a',
      'Sink Elev.': '10.000 m',
      'Sink Head': '20.345 m'
    },
    'SNK Sink Flow/P abs/Elev./Head values should come from the current SNK model/results.'
  );
  assert(!delayedRouteLossTracePanel.classList.contains('route-trace-canvas-overlay-hidden'), 'Incomplete delayed route panel should remain visible before loss text is written.');

  delayedRouteLossTracePanel.textContent = 'Route Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 -> PIPE-2 -> SNK-100 Suction Loss 2.616 / 0.246 m/bar Disch. Loss 11.669 / 1.097 m/bar';
  FakeMutationObserver.last.callback([
    { type: 'characterData', target: delayedRouteLossTracePanel, addedNodes: [] }
  ]);
  assert(delayedRouteLossTracePanel.classList.contains('route-trace-canvas-overlay-hidden'), 'Delayed text update should hide Route/Suction Loss/Disch. Loss panels.');

  browserRuntime.setRouteTraceCanvasOverlayVisible(true);
  assert(!routeOverlay.classList.contains('route-trace-canvas-overlay-hidden'), 'Explicit audit/debug unlock should reveal hidden canvas ROUTE TRACE overlays.');
  assert(!routeLossTracePanel.classList.contains('route-trace-canvas-overlay-hidden'), 'Explicit audit/debug unlock should reveal hidden Route/Suction Loss/Disch. Loss panels.');
  assert(!delayedRouteLossTracePanel.classList.contains('route-trace-canvas-overlay-hidden'), 'Explicit audit/debug unlock should reveal delayed Route/Suction Loss/Disch. Loss panels.');
} finally {
  global.document = savedGlobals.document;
  global.MutationObserver = savedGlobals.MutationObserver;
  global.getComputedStyle = savedGlobals.getComputedStyle;
  global.localStorage = savedGlobals.localStorage;
  global.addEventListener = savedGlobals.addEventListener;
  global.clearInterval = savedGlobals.clearInterval;
  global.clearTimeout = savedGlobals.clearTimeout;
  global.setInterval = savedGlobals.setInterval;
  global.setTimeout = savedGlobals.setTimeout;
  global.globalModel = savedGlobals.globalModel;
  global.connections = savedGlobals.connections;
  global.buildPumpLiveParameterRows = savedGlobals.buildPumpLiveParameterRows;
  global.buildSinkLiveParameterRows = savedGlobals.buildSinkLiveParameterRows;
  delete require.cache[require.resolve(runtimePath)];
}

assert(
  index.includes('engineering-route-trace-audit-20260704-sink-pabs-dedupe1.js?v=20260712-sink-solver-flash-lock1'),
  'Index must load the route trace audit runtime with the default-lock cache key.'
);
assert(
  manifest.includes('Route audit cache key: engineering-route-trace-audit-20260704-sink-pabs-dedupe1.js?v=20260712-sink-solver-flash-lock1'),
  'Manifest must document the route trace default-lock cache key.'
);

console.log('Route trace default lock validation passed.');
