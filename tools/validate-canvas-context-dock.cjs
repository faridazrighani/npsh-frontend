const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-canvas-context-dock.js');
const bundlePath = path.join(rootDir, 'app.bundle.min.js');
const indexPath = path.join(rootDir, 'index.html');
const stylePath = path.join(rootDir, 'style.min.css');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');

const runtime = require(runtimePath);

assert.equal(runtime.version, 'engineering-canvas-context-dock.v3', 'Canvas context dock runtime should expose v3.');
assert.equal(runtime.cacheKey, '20260621-pipe-left-click-menu1', 'Canvas context dock cache key should stay locked.');
assert.equal(typeof runtime.buildDockState, 'function', 'Canvas context dock should expose buildDockState for audit tests.');
assert.equal(typeof runtime.allowCanvasPropertiesCommandOpen, 'function', 'Canvas context dock should expose the explicit command-open hook for object properties.');
assert.equal(typeof runtime.clearSelectedPipeOnCanvasBackgroundClick, 'function', 'Canvas context dock should expose selected pipe background-clear behavior for tests.');
assert.equal(typeof runtime.clearCanvasSelectionOnly, 'function', 'Canvas context dock should expose the explicit clear hook for canvas properties policy tests.');
assert.equal(typeof runtime.resolveRouteNodes, 'function', 'Canvas context dock should expose route resolution for audit tests.');
assert.equal(typeof runtime.rectsOverlapOrTooClose, 'function', 'Canvas context dock should expose legend collision geometry for audit tests.');
assert.equal(typeof runtime.syncCanvasStatusLegendVisibility, 'function', 'Canvas context dock should expose Pump Status visibility sync for audit tests.');
assert.equal(typeof runtime.getStoredExpandedState, 'function', 'Canvas context dock should expose stored expanded state for audit tests.');
assert.equal(typeof runtime.getEffectiveExpandedState, 'function', 'Canvas context dock should expose effective expanded state for audit tests.');
assert.equal(typeof runtime.isCanvasSelectionOnlyActive, 'function', 'Canvas context dock should expose canvas select-only active state for audit tests.');
assert.equal(typeof runtime.isPriorStaleOnlyToken, 'function', 'Canvas context dock should expose prior-stale token classification for audit tests.');
assert.equal(typeof runtime.isActiveStaleToken, 'function', 'Canvas context dock should expose active-stale token classification for audit tests.');
assert.equal(typeof runtime.markCanvasSelectionOnly, 'function', 'Canvas context dock should expose canvas select-only marker for audit tests.');
assert.equal(typeof runtime.setExpanded, 'function', 'Canvas context dock should expose expand/collapse setter for audit tests.');
assert.equal(typeof runtime.isMobileViewport, 'function', 'Canvas context dock should expose mobile viewport detection for audit tests.');

const simulationCase1Like = {
  __npshGlobalModel: {
    FLUID: {
      type: 'fluid',
      name: 'Fluid Basis',
      props: {
        fluidName: 'Methanol',
        temp: 40,
        density: 774,
        viscosity: 0.607,
        dynViscosity: 0.47,
        vaporPressure: 0.354303
      }
    },
    'SRC-100': { type: 'source', props: {} },
    'PIPE-1': { type: 'pipe', props: {} },
    'PUMP-100': {
      type: 'pump',
      props: {},
      results: {
        calculationFreshness: 'Current',
        actionReadinessBackend: { status: 'Ready', stale: false },
        calculationAudit: { calculationId: 'case-1-calc' },
        dependencyManifest: { dependencyFingerprint: 'case-1-dep' }
      }
    },
    'PIPE-2': { type: 'pipe', props: {} },
    'SNK-100': { type: 'sink', props: {} }
  },
  __npshConnections: [
    { from: 'SRC-100', to: 'PUMP-100', pipeId: 'PIPE-1', connectionType: 'hydraulic' },
    { from: 'PUMP-100', to: 'SNK-100', pipeId: 'PIPE-2', connectionType: 'hydraulic' }
  ],
  activeChartPumpId: 'PUMP-100'
};

let state = runtime.buildDockState(simulationCase1Like);
assert.equal(state.status, 'Current', 'Current backend result should render as Current.');
assert.equal(state.statusTone, 'current', 'Current backend result should use the current tone.');
assert.deepEqual(
  state.routeNodes,
  ['Fluid Basis', 'SRC-100', 'PIPE-1', 'PUMP-100', 'PIPE-2', 'SNK-100'],
  'Canvas connection route should include Fluid Basis, source, pipe, pump, discharge pipe, and sink.'
);
assert.equal(state.routeSource, 'canvas connections', 'Connection-built route should document its source.');
assert.equal(state.audit.calculationId, 'case-1-calc', 'Calculation id should be surfaced in the dock audit strip.');
assert.equal(state.audit.dependencyFingerprint, 'case-1-dep', 'Dependency fingerprint should be surfaced in the dock audit strip.');

const density = state.fluidCells.find((cell) => cell.id === 'density');
const kinematicViscosity = state.fluidCells.find((cell) => cell.id === 'kinematicViscosity');
const dynamicViscosity = state.fluidCells.find((cell) => cell.id === 'dynamicViscosity');
const vaporPressureHead = state.fluidCells.find((cell) => cell.id === 'vaporPressureHead');
const specificWeight = state.fluidCells.find((cell) => cell.id === 'specificWeight');
assert.equal(density.value, '774.000 kg/m3', 'Density should be rendered with engineering precision.');
assert.equal(kinematicViscosity.value, '0.607 cSt', 'Legacy viscosity should render as kinematic viscosity.');
assert.equal(dynamicViscosity.value, '0.470 cP', 'Legacy dynViscosity should render as dynamic viscosity.');
assert.equal(specificWeight.value, '7592.940 N/m3', 'Specific weight should be computed from density when not stored.');
assert.equal(vaporPressureHead.value, '4.666 m', 'Vapor pressure head should be computed from vapor pressure and density.');

const derivedViscosityState = runtime.buildDockState({
  __npshGlobalModel: {
    FLUID: {
      type: 'fluid',
      props: {
        fluidName: 'Water',
        temp: 100,
        density: 958.348,
        viscosity: 0.294,
        vaporPressure: 1.01418
      }
    }
  }
});
assert.equal(
  derivedViscosityState.fluidCells.find((cell) => cell.id === 'dynamicViscosity').value,
  '0.282 cP',
  'Dynamic viscosity should be derived from kinematic viscosity and density when dynViscosity is absent.'
);

assert.equal(
  runtime.rectsOverlapOrTooClose(
    { left: 0, top: 0, right: 100, bottom: 60 },
    { left: 111, top: 12, right: 210, bottom: 80 },
    12
  ),
  true,
  'Pump Status should hide when it is inside the protected Fluid Basis collision margin.'
);
assert.equal(
  runtime.rectsOverlapOrTooClose(
    { left: 0, top: 0, right: 100, bottom: 60 },
    { left: 113, top: 12, right: 210, bottom: 80 },
    12
  ),
  false,
  'Pump Status may remain visible when it is outside the protected Fluid Basis collision margin.'
);
assert.equal(
  runtime.rectsOverlapOrTooClose(
    { left: 0, top: 0, right: 100, bottom: 60 },
    { left: 20, top: 90, right: 120, bottom: 140 },
    12
  ),
  false,
  'Pump Status should not hide when horizontal ranges overlap but vertical ranges are safely separated.'
);

const simulationCase4Like = {
  ...simulationCase1Like,
  __engineeringCalculationDefenseRealtimeState: {
    status: 'Stale',
    calculationId: 'old-calc',
    dependencyFingerprint: 'old-dep',
    calculationDefenseStatus: 'Blocked'
  },
  __npshGlobalModel: {
    ...simulationCase1Like.__npshGlobalModel,
    'PUMP-100': {
      ...simulationCase1Like.__npshGlobalModel['PUMP-100'],
      results: {
        ...simulationCase1Like.__npshGlobalModel['PUMP-100'].results,
        routeTrace: {
          text: 'Fluid Basis -> SRC-100 -> PIPE-1 -> PUMP-100 -> PIPE-2 -> SNK-100'
        },
        performanceChartData: { freshness: 'Stale' }
      }
    }
  }
};

state = runtime.buildDockState(simulationCase4Like);
assert.equal(state.status, 'Stale', 'Realtime stale state should override old current results.');
assert.equal(state.statusTone, 'stale', 'Stale result should use the stale tone.');
assert.equal(state.statusNote, 'Input changed before backend refresh.', 'Stale note should explain pending backend refresh.');
assert.equal(state.routeSource, 'backend route trace', 'Backend route trace should be preferred over reconstructed canvas route.');
assert.deepEqual(
  state.routeNodes,
  ['Fluid Basis', 'SRC-100', 'PIPE-1', 'PUMP-100', 'PIPE-2', 'SNK-100'],
  'Backend route trace should be normalized without changing route order.'
);

const recalculatedAfterPriorStaleLike = {
  ...simulationCase1Like,
  __engineeringCalculationDefenseRealtimeState: {
    status: 'Current',
    calculationId: 'new-calc',
    dependencyFingerprint: 'new-dep',
    calculationDefenseStatus: 'Current backend calculation; prior result stale'
  },
  __npshGlobalModel: {
    ...simulationCase1Like.__npshGlobalModel,
    'PUMP-100': {
      ...simulationCase1Like.__npshGlobalModel['PUMP-100'],
      results: {
        ...simulationCase1Like.__npshGlobalModel['PUMP-100'].results,
        calculationFreshness: 'Recalculated after stale input change',
        calculationDefenseContract: { status: 'Stale Prior Result' },
        actionReadinessBackend: { status: 'Ready', stale: false },
        calculationAudit: { calculationId: 'new-calc' },
        dependencyManifest: { dependencyFingerprint: 'new-dep', priorResultStale: true }
      }
    }
  }
};

state = runtime.buildDockState(recalculatedAfterPriorStaleLike);
assert.equal(state.status, 'Current', 'Prior stale that was recalculated by backend should render as Current.');
assert.equal(state.statusTone, 'current', 'Recalculated prior-stale result should use current tone.');
assert.equal(
  state.statusNote,
  'Recalculated after stale input change',
  'Recalculated prior-stale result should keep the explanatory note instead of showing active Stale.'
);
assert.equal(runtime.isPriorStaleOnlyToken('Stale Prior Result'), true, 'Stale Prior Result should be classified as prior-stale-only.');
assert.equal(runtime.isActiveStaleToken('Stale Prior Result'), false, 'Stale Prior Result should not be treated as active stale.');
assert.equal(runtime.isActiveStaleToken('Stale'), true, 'Plain Stale should remain active stale.');

const symbols = Object.fromEntries(state.fluidCells.map((cell) => [cell.id, cell.mobileSymbol]));
assert.equal(symbols.density, 'ρ', 'Mobile density symbol should be available.');
assert.equal(symbols.kinematicViscosity, 'ν', 'Mobile kinematic viscosity symbol should be available.');
assert.equal(symbols.dynamicViscosity, 'μ', 'Mobile dynamic viscosity symbol should be available.');
assert.equal(symbols.specificWeight, 'γ', 'Mobile specific-weight symbol should be available.');

const savedMatchMedia = global.matchMedia;
const savedLocalStorage = global.localStorage;
const storedValues = new Map();
try {
  global.localStorage = {
    getItem: (key) => storedValues.has(key) ? storedValues.get(key) : null,
    setItem: (key, value) => storedValues.set(key, String(value))
  };
  global.matchMedia = () => ({ matches: false });
  assert.equal(runtime.getEffectiveExpandedState(), false, 'First desktop/tablet load should default to collapsed.');
  assert.equal(runtime.setExpanded(true), true, 'Desktop/tablet toggle should allow expanded state.');
  assert.equal(storedValues.get('npsh.canvasContextDock.expanded'), 'true', 'Desktop/tablet expanded preference should be persisted.');
  assert.equal(runtime.getEffectiveExpandedState(), true, 'Desktop/tablet should honor the stored expanded preference.');

  global.matchMedia = (query) => ({ matches: query === '(max-width: 639px)' });
  assert.equal(runtime.isMobileViewport(), true, 'Cellular viewport should be detected by the runtime.');
  assert.equal(runtime.getEffectiveExpandedState(), false, 'Cellular viewport should force compact/collapsed display.');
  assert.equal(runtime.setExpanded(false), false, 'Cellular toggle should not change expanded state.');
  assert.equal(storedValues.get('npsh.canvasContextDock.expanded'), 'true', 'Cellular toggle should not overwrite the desktop/tablet preference.');

  global.matchMedia = () => ({ matches: false });
  assert.equal(runtime.getEffectiveExpandedState(), true, 'Returning to desktop/tablet should restore the saved expanded preference.');
  assert.equal(runtime.setExpanded(false), false, 'Desktop/tablet collapse should be allowed.');
  assert.equal(storedValues.get('npsh.canvasContextDock.expanded'), 'false', 'Desktop/tablet collapsed preference should be persisted.');
} finally {
  global.matchMedia = savedMatchMedia;
  global.localStorage = savedLocalStorage;
}

runtime.markCanvasSelectionOnly('unit-test', 1000);
assert.equal(runtime.isCanvasSelectionOnlyActive(), true, 'Canvas select-only state should be settable for object click policy.');
runtime.allowCanvasPropertiesCommandOpen();
assert.equal(runtime.isCanvasSelectionOnlyActive(), false, 'Canvas select-only state should clear only when the explicit User Task Object Properties command is invoked.');

const normalizeLineEndings = (source) => source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const runtimeSource = normalizeLineEndings(fs.readFileSync(runtimePath, 'utf8'));
const bundleSource = normalizeLineEndings(fs.readFileSync(bundlePath, 'utf8'));
assert(runtimeSource.includes('@media (max-width: 639px)'), 'Runtime CSS must include a cellular breakpoint.');
assert(runtimeSource.includes('position: absolute'), 'Fluid Basis dock should overlay the canvas without contributing to layout shift.');
assert(runtimeSource.includes('margin: 0;'), 'Fluid Basis dock should not push canvas content during startup.');
assert(runtimeSource.includes('width: min(940px, calc(100% - 182px));'), 'Desktop dock width should preserve the existing left/right visual footprint.');
assert(runtimeSource.includes('return false;\n  }\n\n  function getEffectiveExpandedState()'), 'Dock should default to collapsed on first load when no user preference is stored.');
assert(runtimeSource.includes('if (isMobileViewport()) return false;'), 'Mobile viewports should force the dock into compact/collapsed mode.');
assert(runtimeSource.includes('if (isMobileViewport()) {\n      scheduleRender(\'mobile-locked-toggle\');\n      return false;'), 'Mobile toggle should not change or persist expanded state.');
assert(runtimeSource.includes("toggle.setAttribute('aria-disabled', String(mobileLocked));"), 'Mobile toggle should advertise that expand/collapse is disabled.');
assert(runtimeSource.includes('dock.dataset.mobileLocked = mobileLocked ? \'true\' : \'false\';'), 'Dock should expose mobile lock state in the DOM for QA.');
assert(runtimeSource.includes('.canvas-context-dock[data-mobile-locked="true"] .context-dock-expanded { display: none; }'), 'Mobile dock should hide expanded audit content even if a stale expanded class appears.');
assert(!runtimeSource.includes('.canvas-context-dock.is-expanded {\n    position: fixed;'), 'Mobile dock must not become a bottom sheet because expand is disabled on cellular screens.');
assert(runtimeSource.includes('.context-dock-cell[data-cell-id="fluid"] .context-dock-value'), 'Only the active fluid value should keep bold value emphasis.');
assert(runtimeSource.includes('item.dataset.cellId = cell.id'), 'Summary cells should expose data-cell-id for typography lock.');
assert(runtimeSource.includes("const LEGEND_SELECTOR = '.canvas-status-legend'"), 'Pump Status collision lock should target the canvas status legend.');
assert(runtimeSource.includes('isPriorStaleOnlyToken'), 'Dock must distinguish prior-stale audit evidence from active stale state.');
assert(runtimeSource.includes('recalculated after stale input change'), 'Dock must recognize backend-recalculated prior stale evidence.');
assert(runtimeSource.includes("const LEGEND_HIDDEN_CLASS = 'canvas-status-legend-hidden'"), 'Pump Status collision lock should use a stable hidden class.');
assert(runtimeSource.includes('const LEGEND_COLLISION_MARGIN_PX = 12'), 'Pump Status collision lock should keep the protected 12px margin explicit.');
assert(runtimeSource.includes('.canvas-status-legend.canvas-status-legend-hidden'), 'Pump Status hidden class should be styled by the dock runtime.');
assert(runtimeSource.includes('visibility: hidden !important'), 'Pump Status should hide visually without losing its measurable layout rectangle.');
assert(runtimeSource.includes('legend.classList.toggle(LEGEND_HIDDEN_CLASS, shouldHide)'), 'Pump Status visibility should be driven by collision detection.');
assert(runtimeSource.includes("legend.setAttribute('aria-hidden', shouldHide ? 'true' : 'false')"), 'Hidden Pump Status should also update aria-hidden.');
assert(runtimeSource.includes('syncCanvasStatusLegendVisibility();\n    scheduleLegendVisibilitySync();'), 'Pump Status collision lock should run immediate and scheduled sync after dock render.');
assert(runtimeSource.includes('function observeLegendVisibilityLayout()'), 'Pump Status collision lock should observe dock and legend layout changes.');
assert(runtimeSource.includes("typeof root.ResizeObserver !== 'function'"), 'Pump Status collision lock should use ResizeObserver when available.');
assert(runtimeSource.includes('legendVisibilityObserver.observe(dock)'), 'Pump Status collision lock should observe the Fluid Basis dock rectangle.');
assert(runtimeSource.includes('legendVisibilityObserver.observe(legend)'), 'Pump Status collision lock should observe the Pump Status rectangle.');
assert(runtimeSource.includes('function scheduleSettledLegendVisibilitySync'), 'Pump Status collision lock should retry after viewport/layout settling.');
assert(runtimeSource.includes("const CANVAS_PROPERTIES_POLICY_STATE_KEY = '__npshCanvasSelectionOnly'"), 'Canvas properties open policy should share the select-only flag with the core bundle.');
assert(runtimeSource.includes("const CANVAS_OBJECT_SELECTOR = '.pfd-object'"), 'Canvas properties open policy should target equipment/boundary/instrument canvas objects.');
assert(runtimeSource.includes("const CANVAS_PIPE_SELECTOR = '.pipe-line'"), 'Canvas properties open policy should also cover hydraulic pipe-line selection.');
assert(runtimeSource.includes("pipeId: kind === 'pipe' ? asString(selectable.dataset?.pipeId) : ''"), 'Pipe pointerdown should preserve pipeId before drawConnections can replace the SVG path.');
assert(runtimeSource.includes('getCanvasSelectableElement(event) || getPointerStartSelectableElement()'), 'Left-click context menu bridge should recover the current pipe path from pointer-start state after redraw.');
assert(runtimeSource.includes('function handlePipePointerEndContextMenu(event)'), 'Pipe left-click context menu should open on pointerup when drawConnections replaces the clicked SVG path before click.');
assert(runtimeSource.includes("documentRef.addEventListener(eventName, handlePipePointerEndContextMenu, true)"), 'Pipe pointerup context menu bridge should be installed in capture phase.');
assert(runtimeSource.includes('state.pointerStart.contextMenuDispatched = true'), 'Pipe pointerup context menu bridge should prevent duplicate click-phase menu dispatch.');
assert(runtimeSource.includes('function clearSelectedPipeOnCanvasBackgroundClick(event)'), 'Canvas background click should clear selected pipe highlighting.');
assert(runtimeSource.includes("documentRef.addEventListener('click', handleCanvasBackgroundClick, true)"), 'Canvas background clear should be installed in capture phase.');
assert(runtimeSource.includes("stroke === '#ffb703' || strokeWidth === 8"), 'Selected pipe clear should detect the protected yellow pipe highlight without changing engineering data.');
assert(runtimeSource.includes("const TOOLBAR_PLACEMENT_SELECTOR = '.toolbar-tool-draggable'"), 'Canvas properties open policy should cover ribbon placement from draggable tools.');
assert(runtimeSource.includes("const EXPLICIT_PROPERTIES_OPEN_TICKET_KEY = '__npshExplicitObjectPropertiesOpenUntil'"), 'Canvas policy should issue an explicit properties-open ticket only from the menu command.');
assert(runtimeSource.includes('root[EXPLICIT_PROPERTIES_OPEN_TICKET_KEY] = Date.now() + EXPLICIT_PROPERTIES_OPEN_TICKET_MS'), 'Explicit User Task Object Properties command should create the only allowed properties-open ticket.');
assert(runtimeSource.includes('function installCanvasPropertiesOpenPolicyEventBridge()'), 'Canvas properties open policy should install an event bridge.');
assert(runtimeSource.includes("documentRef.addEventListener(eventName, handleCanvasPropertiesPolicyPointerStart, true)"), 'Canvas properties open policy should mark selection-only before app click handlers run.');
assert(runtimeSource.includes('function allowCanvasPropertiesCommandOpen()'), 'Only the explicit User Task Object Properties command should clear canvas select-only mode.');
assert(runtimeSource.includes("root.__npshAllowCanvasPropertiesCommandOpen = allowCanvasPropertiesCommandOpen"), 'Canvas policy should expose a global explicit command-open hook for the protected app bundle.');
assert(runtimeSource.includes("documentRef.addEventListener('contextmenu', handleCanvasPropertiesPolicyContextMenu, true)"), 'Right-click context menu should keep select-only mode active instead of opening properties automatically.');
assert(!runtimeSource.includes("documentRef.addEventListener('contextmenu', clearCanvasSelectionOnly, true)"), 'Right-click context menu must not clear select-only mode by itself.');
assert(runtimeSource.includes('const CANVAS_OBJECT_DRAG_SETTLE_MS = 1200'), 'Canvas object drag should keep select-only state long enough to suppress post-drag properties windows.');
assert(runtimeSource.includes('function handleCanvasPropertiesPolicyPointerMove(event)'), 'Canvas properties open policy should detect object drag/move gestures.');
assert(runtimeSource.includes("markCanvasSelectionOnly('canvas-object-drag', CANVAS_OBJECT_DRAG_SETTLE_MS)"), 'Canvas object move should mark drag-only mode before app click handlers can open properties.');
assert(runtimeSource.includes("markCanvasSelectionOnly('canvas-object-drag-settle', CANVAS_OBJECT_DRAG_SETTLE_MS)"), 'Canvas object move should keep properties suppressed after drag release.');
assert(runtimeSource.includes("documentRef.addEventListener(eventName, handleCanvasPropertiesPolicyPointerMove, true)"), 'Canvas object move guard should be installed in capture phase.');
assert(runtimeSource.includes('event.preventDefault?.();\n    event.stopPropagation?.();\n    event.stopImmediatePropagation?.();\n    dispatchLeftClickCanvasContextMenu(event);'), 'Left-click context menu bridge should suppress the core object click handler after opening the context menu.');
assert(runtimeSource.includes("documentRef.addEventListener('click', handleCanvasPropertiesPolicyClickForContextMenu, true)"), 'Left-click canvas object selection should open the existing context menu before core object click handlers can start a connection.');
assert(runtimeSource.includes("new root.MouseEvent('contextmenu'"), 'Left-click context menu bridge should reuse the existing object/pipe context-menu handlers.');
assert(bundleSource.includes('window.__npshCanvasSelectionOnly?.active)&&renderSidebar(e)'), 'Core selectNode should suppress renderSidebar while canvas select-only mode is active.');
assert(bundleSource.includes('window.__npshAllowCanvasPropertiesCommandOpen'), 'Core User Task Object Properties command should explicitly clear the canvas select-only guard before opening.');
assert(bundleSource.includes('label:"User Task Object Properties"'), 'Context menu must retain the explicit User Task Object Properties action.');
assert(bundleSource.includes('label:"Elbow"===n?"Use elbow":"Use straight"'), 'Pipe context menu must retain the Use elbow / Use straight action.');
assert(bundleSource.includes('label:"Disconnect pipe"'), 'Pipe context menu must retain the Disconnect pipe action.');
assert(bundleSource.includes('reason="canvas-left-select"'), 'Core canvas object pointerdown should mark select-only before selecting an existing object.');
assert(bundleSource.includes('reason="canvas-object-drag"'), 'Core canvas object move should mark drag-only before updating object position.');
assert(bundleSource.includes('reason="canvas-object-drag-settle"'), 'Core canvas object move release should keep properties suppressed after movement.');
assert(bundleSource.includes('window.__npshCanvasSelectionOnly?.active)){activeChartPumpId='), 'Pump double-click chart window should be suppressed while object selection or drag policy is active.');
assert(bundleSource.includes('Number(window.__npshExplicitObjectPropertiesOpenUntil||0)>=Date.now()))return pipePropertiesTaskRequestedNodeId=null,!1'), 'Pipe properties window should open only with the explicit User Task Object Properties ticket.');
assert(bundleSource.includes('Number(window.__npshExplicitObjectPropertiesOpenUntil||0)>=Date.now()))return tankPropertiesTaskRequestedNodeId=null,!1'), 'Tank properties window should open only with the explicit User Task Object Properties ticket.');
assert(bundleSource.includes('Number(window.__npshExplicitObjectPropertiesOpenUntil||0)>=Date.now()))return objectPropertiesTaskRequestedNodeId=null,!1'), 'Object properties window should open only with the explicit User Task Object Properties ticket.');
assert(bundleSource.includes('reason="equipment-placement"'), 'Core addEquipment should mark newly placed objects as equipment-placement select-only before selecting them.');
assert(bundleSource.indexOf('reason="equipment-placement"') < bundleSource.indexOf('selectNode(r,o)'), 'Core addEquipment should set the equipment-placement guard before selectNode runs.');
assert(bundleSource.includes('setTimeout(()=>{"equipment-placement"===e.reason'), 'Core addEquipment should auto-clear the equipment-placement guard after placement settles.');
assert(bundleSource.includes('.persistent-object-properties-task-window[data-node-id="${e}"]'), 'Core addEquipment cleanup should remove persistent object properties windows opened as a placement side effect.');
assert(bundleSource.includes('setTimeout(a,250)'), 'Core addEquipment cleanup should retry after async render effects before explicit properties opens are allowed.');
assert(/\.context-dock-title\s*\{[\s\S]*?font-weight:\s*800;/.test(runtimeSource), 'Typography lock: Fluid Basis title must stay bold.');
assert(/\.context-dock-route-label\s*\{[\s\S]*?font-weight:\s*800;/.test(runtimeSource), 'Typography lock: Route label must stay bold.');
assert(/\.context-dock-cell\[data-cell-id="fluid"\]\s+\.context-dock-value\s*\{[\s\S]*?font-weight:\s*800;/.test(runtimeSource), 'Typography lock: active fluid value must stay bold.');
assert(/\.context-dock-value\s*\{[\s\S]*?font-weight:\s*400;/.test(runtimeSource), 'Typography lock: property values other than active fluid must stay normal weight.');
assert(/\.context-dock-route-button\s*\{[\s\S]*?font-weight:\s*400;/.test(runtimeSource), 'Typography lock: route node chips must stay normal weight.');
assert(/\.context-dock-pill\s*\{[\s\S]*?font-weight:\s*400;/.test(runtimeSource), 'Typography lock: freshness pill must stay normal weight.');
assert(/\.context-dock-audit-value\s*\{[\s\S]*?font-weight:\s*400;/.test(runtimeSource), 'Typography lock: expanded audit values must stay normal weight.');
assert(!runtimeSource.includes('innerHTML ='), 'Runtime should not render model-derived data with innerHTML.');

const index = fs.readFileSync(indexPath, 'utf8');
const style = fs.readFileSync(stylePath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');
const ribbonTools = [
  { group: 'Equipment', title: 'Pump', aria: 'Add Pump' },
  { group: 'Equipment', title: 'Tank', aria: 'Add Tank' },
  { group: 'Equipment', title: 'Vessel H', aria: 'Add Vessel H' },
  { group: 'Equipment', title: 'Vessel V', aria: 'Add Vessel V' },
  { group: 'Equipment', title: 'Exchanger', aria: 'Add Exchanger' },
  { group: 'Boundary', title: 'Source', aria: 'Add Source' },
  { group: 'Boundary', title: 'Sink', aria: 'Add Sink' },
  { group: 'Piping', title: 'Valve', aria: 'Add Valve' },
  { group: 'Instruments', title: 'PTF', aria: 'Add PTF' },
  { group: 'Instruments', title: 'LIC', aria: 'Add LIC' }
];
ribbonTools.forEach((tool) => {
  assert(
    index.includes(`class="toolbar-tool toolbar-tool-draggable" title="${tool.title}" aria-label="${tool.aria}"`),
    `${tool.group} ribbon tool ${tool.title} must remain a draggable placement-only canvas tool.`
  );
});
assert(
  index.includes('app.bundle.min.js?v=20260608-global-ribbon-placement-lock5'),
  'Index must load the core app bundle with the canvas properties policy cache key.'
);
assert(
  index.includes('engineering-canvas-context-dock.js?v=20260621-pipe-left-click-menu1'),
  'Index must load the canvas context dock runtime with cache key.'
);
assert(
  index.includes('style.min.css?v=20260608-browser-issues1'),
  'Index must load the main stylesheet with the global ribbon placement cache key.'
);
assert(
  index.includes('.toolbar-palette{display:flex;align-items:stretch;gap:6px;overflow-x:visible;padding-bottom:2px;min-height:54px;min-width:0;flex:0 0 auto;position:relative;z-index:3}') &&
    style.includes('.toolbar-palette{display:flex;align-items:stretch;gap:6px;overflow-x:visible;padding-bottom:2px;min-height:54px;min-width:0;flex:0 0 auto;position:relative;z-index:3;'),
  'Toolbar palette must stay above thesis branding for global drag hit-testing.'
);
assert(
  index.includes('@media (min-width:768px) and (orientation:landscape){.ribbon{overflow-x:auto}.toolbar-palette{flex:0 0 auto;max-width:none;overflow:visible;') &&
    style.includes('@media (min-width:768px) and (orientation:landscape){.ribbon{overflow-x:auto}.toolbar-palette{flex:0 0 auto;max-width:none;overflow:visible;'),
  'Landscape toolbar must not clip Piping or Instrument drag targets behind responsive scroll masks.'
);
assert(
  index.includes('.academic-identity *{pointer-events:none}') &&
    style.includes('.academic-identity *{pointer-events:none}'),
  'Thesis branding must not intercept pointer events from toolbar placement tools.'
);
assert(
  manifest.includes('Canvas context dock cache key: engineering-canvas-context-dock.js?v=20260621-pipe-left-click-menu1'),
  'Manifest must document the canvas context dock cache key.'
);
assert(
  manifest.includes('Main style cache key: style.min.css?v=20260608-browser-issues1'),
  'Manifest must document the main stylesheet cache key.'
);

console.log('Canvas context dock validation passed.');
