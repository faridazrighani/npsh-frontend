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

assert.equal(runtime.version, '2026.06-route-trace-audit-v27', 'Route trace audit runtime should expose the locked v27 version.');
assert.equal(typeof runtime.openRouteAuditPanel, 'function', 'Dedicated route audit panel should remain available.');
assert.equal(typeof runtime.pruneDefaultCanvasRouteTraceOverlays, 'function', 'Canvas route trace overlay pruning should be exposed for audit tests.');
assert.equal(typeof runtime.pruneDefaultPumpRouteTraceRows, 'function', 'Pump route trace row pruning should be exposed for audit tests.');
assert.equal(typeof runtime.pruneDefaultSinkCanvasRows, 'function', 'SNK canvas row pruning should be exposed for audit tests.');
assert.equal(typeof runtime.normalizeDefaultSinkCanvasRows, 'function', 'SNK canvas Source/Sink terminology normalizer should be exposed for audit tests.');
assert.equal(typeof runtime.ensureDefaultSinkCanvasRows, 'function', 'SNK canvas Sink Flow/Sink Elev./Sink Head injection should be exposed for audit tests.');
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
assert(runtimeSource.includes("'Vapor Press. Used'"), 'Pump live panel lock should hide Vapor Press. Used rows.');
assert(runtimeSource.includes('const SINK_CANVAS_HIDDEN_ROW_LABELS = new Set(['), 'SNK canvas panel lock should use the locked hidden-row allowlist.');
assert(runtimeSource.includes("'Flow Demand'"), 'SNK canvas panel lock should hide the old Flow Demand display row.');
assert(runtimeSource.includes("'Outlet Flow'"), 'SNK canvas panel lock should hide the old Outlet Flow display row.');
assert(runtimeSource.includes("'Vapor Press.'"), 'SNK canvas panel lock should hide Vapor Press. rows.');
assert(runtimeSource.includes("'Vapor Margin'"), 'SNK canvas panel lock should hide Vapor Margin rows.');
assert(runtimeSource.includes("'Pump NPSH Margin'"), 'SNK canvas panel lock should hide Pump NPSH Margin rows.');
assert(runtimeSource.includes("upsertSinkCanvasRow(panel, 'Sink Flow'"), 'SNK canvas panel lock should add Sink Flow rows.');
assert(runtimeSource.includes("upsertSinkCanvasRow(panel, 'Sink Elev.'"), 'SNK canvas panel lock should add Sink Elev. rows.');
assert(runtimeSource.includes("upsertSinkCanvasRow(panel, 'Sink Head'"), 'SNK canvas panel lock should add Sink Head rows.');
assert(runtimeSource.includes("upsertSinkCanvasRow(panel, 'Sink P abs'"), 'SNK canvas panel lock should add Sink P abs rows.');
assert(runtimeSource.includes("label === 'Required Press.' || label === 'Outlet Press.'"), 'SNK canvas panel lock should normalize legacy pressure labels.');
assert(runtimeSource.includes('function patchSinkStatusTooltip'), 'SNK hover tooltip should use the Source/Sink terminology and decimal lock.');
assert(runtimeSource.includes('function syncSinkObjectTooltip'), 'SNK object hover/title should stay synchronized with canonical Sink Flow/P abs/Elev./Head values.');
assert(runtimeSource.includes('function syncPumpObjectTooltip'), 'Pump object hover/title should stay synchronized with current pump live-panel values.');
assert(runtimeSource.includes("routeTraceSinkObjectTooltipLock"), 'SNK object hover/title synchronization should be marked for QA.');
assert(runtimeSource.includes("routeTracePumpObjectTooltipLock"), 'Pump object hover/title synchronization should be marked for QA.');
assert(runtimeSource.includes("data-engineering-runtime-originaltitle"), 'Pump/SNK object hover/title synchronization should update the hover bridge backup title.');
assert(runtimeSource.includes('refreshVisibleAuditSurfaces, delayMs'), 'Backend result application should schedule route presentation refresh after repaint.');
assert(runtimeSource.includes('Sink Elev.:'), 'SNK hover tooltip should include Sink Elev. in the canonical display.');
assert(runtimeSource.includes('Mode: ${mode'), 'SNK hover tooltip should normalize Flow mode to Flow Demand where applicable.');
assert(runtimeSource.includes('const corePatterns = [/^Mode:/i, /^Sink Flow:/i, /^Sink P abs:/i, /^Sink Elev\\.:/i, /^Sink Head:/i];'), 'SNK hover tooltip should order canonical rows like the canvas card.');
assert(runtimeSource.includes('.route-trace-canvas-overlay-hidden{display:none!important;}'), 'Canvas overlay hidden class should be enforced by runtime CSS.');
assert(runtimeSource.includes('.route-trace-sink-mode-hidden{display:none!important;}'), 'SNK mode-ignored property rows should be hidden by runtime CSS.');
assert(runtimeSource.includes('function pruneDefaultPumpRouteTraceRows'), 'Runtime should prune legacy route/loss and hidden pump rows inside pump live panels.');
assert(runtimeSource.includes('function pruneDefaultSinkCanvasRows'), 'Runtime should prune hidden SNK rows inside sink live panels.');
assert(runtimeSource.includes('function ensureDefaultSinkCanvasRows'), 'Runtime should ensure Sink Flow/Sink Elev./Sink Head rows inside sink live panels.');
assert(runtimeSource.includes('function pruneDefaultCanvasRouteTraceOverlays'), 'Runtime should prune route trace canvas overlays by default.');
assert(runtimeSource.includes('function watchDefaultCanvasRouteTraceOverlays'), 'Runtime should watch future canvas overlay insertions.');
assert(runtimeSource.includes('characterData: true'), 'Canvas overlay lock should observe text updates in existing panels.');
assert(runtimeSource.includes('attributes: true'), 'Canvas overlay lock should observe attribute-driven redraws.');
assert(runtimeSource.includes('routeSurfaceRefreshPending'), 'Route surface refreshes should be throttled for performance.');
assert(runtimeSource.includes("observer.observe(document.getElementById('canvas') || document.body || document.documentElement, { childList: true, subtree: true })"), 'Global route observer should be scoped and childList-only.');
assert(!runtimeSource.includes("observer.observe(document.documentElement, { attributes: true, characterData: true, childList: true, subtree: true })"), 'Global route observer must not watch every document attribute/text mutation.');
assert(runtimeSource.includes('function patchCanvasOverlayRenderHooks'), 'Canvas overlay lock should run after canvas render/update functions.');
assert(runtimeSource.includes("'drawConnections'"), 'Canvas overlay lock should hook drawConnections redraws.');
assert(runtimeSource.includes("'updateSimulation'"), 'Canvas overlay lock should hook updateSimulation redraws.');
assert(runtimeSource.includes('function startDefaultCanvasRouteTraceRetryLoop'), 'Canvas overlay lock should retry while delayed overlays settle.');
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

  addEventListener() {}

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
  globalModel: global.globalModel
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

  const legacySinkPanel = new FakeElement('div');
  legacySinkPanel.classList.add('sink-live-params');
  legacySinkPanel.dataset.nodeId = 'SNK-100';
  legacySinkPanel.appendChild(sinkRow('Mode', 'Flow'));
  legacySinkPanel.appendChild(sinkRow('Flow Demand', '50.000'));
  legacySinkPanel.appendChild(sinkRow('Outlet Flow', '50.000'));
  legacySinkPanel.appendChild(sinkRow('Required Press.', '1.744'));
  legacySinkPanel.appendChild(sinkRow('Discharge Loss', '11.700'));
  legacySinkPanel.appendChild(sinkRow('Vapor Press.', '1.014'));
  legacySinkPanel.appendChild(sinkRow('Vapor Margin', '+0.730'));
  legacySinkPanel.appendChild(sinkRow('Pump NPSH Margin', '+4.100'));
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
    'SNK-100': {
      type: 'sink',
      name: 'SNK-100',
      props: { elevation: 10 },
      results: { boundaryPressure: 1.743707129, calculatedPressure: 1.743707129, hydraulicHead: 20.345 }
    }
  };
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

  delete require.cache[require.resolve(runtimePath)];
  const browserRuntime = require(runtimePath);
  browserRuntime.install();

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
    ['Flow', 'Suction Press.', 'Pump Head', 'Discharge Press.'],
    'Legacy loaded pump panels should keep normal pump readouts while removing Route/Suction Loss/Disch. Loss and vapor-pressure rows.'
  );
  assert.deepEqual(
    sectionsIn(legacyPumpPanel),
    ['Suction', 'Discharge'],
    'Legacy loaded pump panels should keep SUCTION/DISCHARGE sections and remove Route Trace section.'
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
  delete require.cache[require.resolve(runtimePath)];
}

assert(
  index.includes('engineering-route-trace-audit.js?v=20260616-snk-flow-demand-mode-aware1'),
  'Index must load the route trace audit runtime with the default-lock cache key.'
);
assert(
  manifest.includes('Route audit cache key: engineering-route-trace-audit.js?v=20260616-snk-flow-demand-mode-aware1'),
  'Manifest must document the route trace default-lock cache key.'
);

console.log('Route trace default lock validation passed.');
