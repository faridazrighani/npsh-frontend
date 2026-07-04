const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-route-trace-audit.js');
const indexPath = path.join(rootDir, 'index.html');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');

globalThis.globalModel = {
  FLUID: {
    type: 'fluid',
    props: { density: 958.3483835924421 }
  },
  'PIPE-2': {
    type: 'pipe',
    results: {
      velocityHead: 0.537
    }
  },
  'SNK-100': {
    type: 'sink',
    props: {
      active: 'Active',
      boundaryMode: 'Free Outlet / Atmospheric Discharge',
      pressureInputBasis: 'Gauge',
      pressure: 1.743707129,
      elevation: 10,
      demandFlow: 50
    },
    results: {
      boundaryMode: 'Flow Demand Boundary',
      calculatedPressure: 1.743707129,
      requiredBoundaryPressure: 1.743707129,
      boundaryPressure: 1.743707129,
      requiredBoundaryHead: 29.084635,
      hydraulicHead: 29.084635,
      flow: 50
    }
  },
  connections: [
    {
      from: 'P-100',
      to: 'SNK-100',
      pipeId: 'PIPE-2',
      connectionType: 'hydraulic'
    }
  ]
};

delete require.cache[require.resolve(runtimePath)];
const runtime = require(runtimePath);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');

assert.equal(runtime.version, '2026.07-route-trace-audit-v41', 'Route trace runtime should expose the SNK editable four-field boundary layout version.');
assert.equal(typeof runtime.sinkCanonicalValues, 'function', 'SNK canonical value helper should be exported for audit completeness checks.');
assert.equal(typeof runtime.sinkModeDisplayValue, 'function', 'SNK mode display helper should be exported for audit completeness checks.');
assert.equal(typeof runtime.syncSinkPropertyWindowCanonicalReadouts, 'function', 'SNK properties readout sync should be exported for audit completeness checks.');
assert.equal(typeof runtime.collapseSinkTraceSections, 'function', 'SNK trace collapse helper should be exported for layout lock validation.');
assert.equal(typeof runtime.lockSinkPropertyWindowLayout, 'function', 'SNK task-window layout lock helper should be exported for validation.');

const staleSolvedSink = globalThis.globalModel['SNK-100'];
assert.equal(
  runtime.sinkModeDisplayValue(staleSolvedSink, null),
  'Free Outlet',
  'SNK canvas/tooltip mode must follow the selected Boundary Mode even when solved results still contain Flow Demand.'
);

const canonical = runtime.sinkCanonicalValues(staleSolvedSink);
assert.equal(canonical.mode, 'Free Outlet / Atmospheric Discharge', 'Canonical SNK state should retain the current selected boundary mode.');
assert(Math.abs(canonical.pressureAbsBar - 1.01325) < 1e-9, 'Free Outlet canonical pressure must resolve to atmospheric pressure, not stale flow-demand pressure.');
assert(Math.abs(canonical.elevation - 10) < 1e-9, 'SNK elevation should stay tied to the current properties value.');
assert(Math.abs(canonical.sinkHead - 21.3154) < 0.002, 'Free Outlet sink head should be pressure head + elevation + terminal velocity head.');
assert(Math.abs(canonical.sinkFlow - 50) < 1e-9, 'SNK accepted flow should remain visible while the boundary mode changes.');

globalThis.globalModel['SNK-200'] = {
  type: 'sink',
  props: {
    boundaryMode: 'Outlet Pressure Boundary',
    pressureInputBasis: 'Gauge',
    pressure: 0.25,
    elevation: 4
  },
  results: {
    boundaryMode: 'Flow Demand Boundary',
    calculatedPressure: 9.9,
    requiredBoundaryHead: 99
  }
};
assert.equal(
  runtime.sinkModeDisplayValue(globalThis.globalModel['SNK-200'], null),
  'Outlet Pressure',
  'SNK mode display must prefer selected Outlet Pressure mode over stale solved Flow Demand results.'
);
assert(Math.abs(runtime.sinkCanonicalValues(globalThis.globalModel['SNK-200']).pressureAbsBar - 1.26325) < 1e-9, 'Gauge outlet pressure should convert to absolute pressure for canvas readout.');

globalThis.globalModel['SNK-300'] = {
  type: 'sink',
  props: {
    boundaryMode: 'Flow Demand Boundary',
    elevation: 7,
    demandFlow: 12
  },
  results: {
    boundaryMode: 'Flow Demand Boundary',
    requiredBoundaryPressure: 2.5,
    requiredBoundaryHead: 33,
    flow: 12
  }
};
assert.equal(runtime.sinkModeDisplayValue(globalThis.globalModel['SNK-300'], null), 'Flow Demand', 'Flow Demand mode should keep the concise canvas label.');
assert.equal(runtime.sinkCanonicalValues(globalThis.globalModel['SNK-300']).pressureAbsBar, 2.5, 'Flow Demand mode should keep required solved pressure as the canvas pressure.');
assert.equal(runtime.sinkCanonicalValues(globalThis.globalModel['SNK-300']).elevation, 7, 'Flow Demand mode should keep SNK elevation as an active visible boundary input.');

globalThis.globalModel['SNK-400'] = {
  type: 'sink',
  props: {
    boundaryMode: 'Outlet Pressure Boundary',
    pressureInputBasis: 'Absolute',
    pressure: 10,
    elevation: 200
  },
  results: {
    calculationTrace: {
      status: 'Discharge Boundary Infeasible',
      boundary: {
        operatingFeasibilityStatus: 'Discharge Boundary Infeasible',
        boundaryFeasible: false,
        headResidual: -261.57,
        maxAllowableSnkElevation: -61.57,
        hydraulicHead: 302.357,
        absolutePressureBar: 10,
        elevation: 200
      },
      pumpImpact: {
        engineeringStatus: 'Discharge Boundary Infeasible'
      }
    }
  }
};
const riskCanonical = runtime.sinkCanonicalValues(globalThis.globalModel['SNK-400']);
assert.equal(riskCanonical.engineeringStatus, 'Discharge Boundary Infeasible', 'SNK canonical state should expose infeasible outlet pressure/elevation as discharge boundary infeasible.');
assert.equal(riskCanonical.operatingFeasibilityStatus, 'Discharge Boundary Infeasible', 'SNK canonical state should expose boundary feasibility status.');
assert.equal(riskCanonical.boundaryFeasible, false, 'SNK canonical state should expose infeasible boundary boolean.');
assert.equal(riskCanonical.headResidual, -261.57, 'SNK canonical state should expose pump head residual.');
assert.equal(riskCanonical.maxAllowableSnkElevation, -61.57, 'SNK canonical state should expose maximum allowable SNK elevation.');

globalThis.globalModel['SNK-500'] = {
  type: 'sink',
  props: {
    boundaryMode: 'Outlet Pressure Boundary',
    pressureInputBasis: 'Absolute',
    pressure: 4.936,
    elevation: 8
  },
  results: {
    operatingFeasibilityStatus: 'Unknown',
    boundaryPressure: 4.936,
    hydraulicHead: 60.112,
    flow: 39.68
  }
};
const unknownCanonical = runtime.sinkCanonicalValues(globalThis.globalModel['SNK-500']);
assert.equal(unknownCanonical.operatingFeasibilityStatus, '', 'SNK canonical state should not expose Unknown as a displayable boundary status.');
assert.equal(unknownCanonical.engineeringStatus, '', 'SNK canonical state should not promote Unknown boundary status into engineering status.');

assert(runtimeSource.includes('if (!panel?.querySelectorAll) return null;'), 'SNK panel row lookup must be null-safe.');
assert(runtimeSource.includes('function sinkBoundaryModeRaw'), 'Runtime should have an explicit selected SNK boundary mode resolver.');
assert(runtimeSource.includes('function firstMeaningfulStatusValue'), 'Runtime should filter placeholder status values such as Unknown before canvas display.');
assert(runtimeSource.includes("if (kind === 'free-outlet') return firstFiniteValue(tracePressureAbs, ATM_PRESSURE_BAR_A);"), 'Free Outlet pressure must not fall back to stale Flow Demand pressure.');
assert(runtimeSource.includes('sinkHeadForSelectedSinkMode'), 'SNK head should be mode-aware instead of always using stale solved head first.');
assert(runtimeSource.includes('firstBooleanValue'), 'SNK canonical helper should preserve boundary feasibility booleans.');
assert(runtimeSource.includes("upsertSinkCanvasRow(panel, 'Head Res.'"), 'SNK canvas should add head residual readout when backend feasibility data exists.');
assert(runtimeSource.includes("upsertSinkCanvasRow(panel, 'Max Elev.'"), 'SNK canvas should add maximum elevation readout when backend feasibility data exists.');
assert(runtimeSource.includes('function syncSinkPropertyWindowCanonicalReadouts'), 'SNK properties panel should sync compact readouts from the same canonical values as canvas.');
assert(runtimeSource.includes('function isSinkPropertyWindowCandidate'), 'SNK property sync should guard candidate windows before canonical row injection.');
assert(runtimeSource.includes('Matriks Kalkulasi Pump NPSH') && runtimeSource.includes('Pump Formula Defense'), 'SNK property sync must skip Pump Formula Defense windows so duplicate sink rows cannot appear there.');
assert(runtimeSource.includes("setSinkPropertyRowValue(windowNode, 'Calculated Abs. Pressure'"), 'SNK compact Calculated Abs. Pressure row should be explicitly synchronized.');
assert(runtimeSource.includes("formatCanvasValue(sinkReferencePressureAbsBar(sinkNode), 'bar a')"), 'SNK compact pressure readout should use Reference Pressure + atmospheric pressure.');
assert(runtimeSource.includes('function ensureSinkPropertyInputRow'), 'SNK compact properties should create editable input rows when the core renderer omits them.');
assert(runtimeSource.includes('function commitSinkInputControlValue'), 'SNK compact input rows should write Flow Demand, Reference Pressure, and Elevation back to sink.props.');
assert(runtimeSource.includes('function compactSinkPropertyWindowRows'), 'SNK property window should use a compact allowlist cleanup.');
assert(runtimeSource.includes("const orderedLabels = ['Flow Demand', 'Elevation', 'Reference Pressure', 'Calculated Abs. Pressure'];"), 'SNK compact properties should keep the requested four visible rows in order.');
assert(runtimeSource.includes('const allowed = new Set(orderedLabels);'), 'SNK compact properties should derive the visible allowlist from the ordered four-field layout.');
assert(runtimeSource.includes("'sink-compact-hidden'"), 'SNK compact properties should hide removed mode/pressure rows without flashing.');
assert(runtimeSource.includes("'sink-compact-readout-hidden'"), 'SNK compact properties should hide the lower calculated readout block.');
assert(runtimeSource.includes('function markSinkBoundaryConditionsHeader'), 'SNK Fluid Out Boundary Conditions header should be explicitly marked for the Source Boundary Data layout.');
assert(runtimeSource.includes('function markSinkBoundaryDataCardRow'), 'SNK compact rows should be marked as Boundary Data cards.');
assert(runtimeSource.includes('function removeGeneratedSinkPropertyRowsByLabel'), 'SNK compact rows should remove old generated rows before rebuilding the Source-style layout.');
assert(runtimeSource.includes('function normalizeSinkPropertyLabelFirst'), 'SNK compact rows should relabel original editable rows without cloning them.');
assert(runtimeSource.includes('function normalizeSinkCompactInputLabels'), 'SNK compact rows should relabel keyed inputs to Flow Demand, Elevation, and Reference Pressure.');
assert(runtimeSource.includes('function normalizeSinkReferencePressureBasis'), 'SNK compact rows should lock hidden reference pressure basis to Gauge for the visible bar g input.');
assert(runtimeSource.includes('function setSinkPropertyRowUnit'), 'SNK compact rows should force Reference Pressure units to bar g.');
assert(runtimeSource.includes('function demoteLegacySinkVolumetricFlowRows'), 'SNK compact rows should hide the legacy flow row so demandFlow becomes the visible Flow Demand input.');
assert(runtimeSource.includes('function sinkPropertyRowControlKey'), 'SNK compact rows should inspect field keys before deciding which Volumetric Flow row is visible.');
assert(runtimeSource.includes('function orderSinkBoundaryDataRows'), 'SNK compact rows should be physically ordered under the Fluid Out Boundary Conditions header.');
assert(runtimeSource.includes('function patchRenderSidebarSinkCleanup'), 'SNK renderSidebar cleanup should run synchronously after Sink task-window renders.');
assert(runtimeSource.includes('syncSinkPropertyWindowCanonicalReadouts(document);'), 'SNK solver/task-window hooks should sync compact readouts before delayed refresh sweeps.');
assert(runtimeSource.includes('function hideLegacySinkCalculatedReadoutBlocks'), 'SNK compact cleanup should have a dedicated legacy calculated readout sweep.');
assert(runtimeSource.includes('data-route-trace-sink-boundary-card'), 'SNK compact row markup should expose a Boundary Data card marker for layout and tests.');
assert(runtimeSource.includes('grid-template-columns:minmax(132px,.9fr) minmax(180px,1.1fr) auto'), 'SNK compact rows should use the Source-like label/value/unit grid.');
assert(runtimeSource.includes('Calculated Outlet Readout|Attached Pipe'), 'SNK compact cleanup should target the old calculated outlet readout block.');
assert(runtimeSource.includes('readoutBodyPattern'), 'SNK compact cleanup should hide calculated outlet readout body rows, not only the section title.');
assert(runtimeSource.includes("document.addEventListener('input', onChange, false)"), 'SNK property changes should run cleanup after application input handlers to prevent flash.');
assert(runtimeSource.includes('observer.observe(body, { childList: true, subtree: true })'), 'SNK task-window mutations should be observed outside the canvas.');
assert(runtimeSource.includes('.object-task-field-row:has([data-key="active"]'), 'SNK layout CSS should hide old dropdown rows before JS cleanup runs.');
assert(runtimeSource.includes('[data-key="pressureBasis"],[name="pressureBasis"]'), 'SNK layout CSS should pre-hide the old Pressure Basis row.');
assert(runtimeSource.includes('[data-key="flow"],[name="flow"]'), 'SNK layout CSS should pre-hide the legacy Volumetric Flow row.');
assert(!runtimeSource.includes('[data-key="pressure"],[name="pressure"]){display:none'), 'SNK layout CSS must not hide the visible Reference Pressure row.');
assert(!runtimeSource.includes("'flow-demand-elevation-inherited'"), 'SNK Elevation row must not be hidden as inherited/internal in Flow Demand mode.');
assert(runtimeSource.includes("ensureSinkPropertyInputRow(windowNode, 'Flow Demand'"), 'SNK compact properties should add/keep Flow Demand as an editable input.');
assert(runtimeSource.includes("ensureSinkPropertyInputRow(windowNode, 'Elevation'"), 'SNK compact properties should add/keep Elevation as an editable input.');
assert(runtimeSource.includes("ensureSinkPropertyInputRow(windowNode, 'Reference Pressure'"), 'SNK compact properties should add/keep Reference Pressure as an editable input.');
assert(runtimeSource.includes("ensureSinkPropertyReadoutRow(windowNode, 'Calculated Abs. Pressure'"), 'SNK compact properties should keep Calculated Abs. Pressure visible.');
assert(!runtimeSource.includes("ensureSinkPropertyReadoutRow(windowNode, 'Boundary Data Source'"), 'SNK compact properties should not add Boundary Data Source.');
assert(!runtimeSource.includes("ensureSinkPropertyReadoutRow(windowNode, 'Pressure Basis'"), 'SNK compact properties should not add Pressure Basis.');
assert(!runtimeSource.includes("ensureSinkPropertyReadoutRow(windowNode, 'Boundary Pressure'"), 'SNK compact properties should not add Boundary Pressure.');
assert(!runtimeSource.includes("ensureSinkPropertyReadoutRow(windowNode, 'Volumetric Flow'"), 'SNK compact properties should not add Volumetric Flow.');
assert(!runtimeSource.includes("ensureSinkPropertyReadoutRow(windowNode, 'Sink Elevation'"), 'SNK compact properties should not add Sink Elevation.');
assert(runtimeSource.includes('function removeLegacyGeneratedSinkPropertyRows'), 'SNK property window sync should remove old generated rows that changed the original SINK layout.');
assert(runtimeSource.includes("const labels = ['Evaluated Flow', 'Outlet Pressure Assumption'];"), 'SNK property window should remove previous generated Evaluated Flow and Outlet Pressure Assumption rows.');
assert(!runtimeSource.includes("upsertSinkPropertyReadout(windowNode, 'Evaluated Flow'"), 'SNK property window should not inject Evaluated Flow into the old SINK conditions layout.');
assert(!runtimeSource.includes('function upsertSinkPropertyReadout'), 'SNK task window layout lock should not retain old generated row insertion helpers.');
assert(runtimeSource.includes('function collapseSinkTraceSections'), 'SNK Calculation Trace section should be collapsed by the route trace lock.');
assert(runtimeSource.includes('function lockSinkPropertyWindowLayout'), 'SNK property window should have an explicit layout lock.');
assert(runtimeSource.includes('route-trace-sink-layout-locked'), 'SNK layout lock CSS/class marker should be present.');
assert(runtimeSource.includes('route-trace-sink-trace-collapsed'), 'SNK trace body rows should have a collapsed-state marker.');
assert(runtimeSource.includes('Step-by-step Report') && runtimeSource.includes('Trace Perhitungan'), 'SNK trace collapse should match Calculation Trace / Step-by-step Report labels.');
assert(runtimeSource.includes("const control = row?.querySelector?.('select, input, textarea');"), 'SNK property sync should detect existing form controls before changing row values.');
assert(runtimeSource.includes("if (control.tagName === 'SELECT')"), 'SNK Boundary Mode sync should preserve existing dropdown controls.');
assert(runtimeSource.includes('control.value = option.value;'), 'SNK Boundary Mode sync should update dropdown value without replacing the select element.');
assert(runtimeSource.includes('function sinkBoundaryModeFormLabel'), 'SNK Boundary Mode property window should use form labels separately from compact canvas labels.');
assert(runtimeSource.includes('Free Outlet / Atmospheric Discharge'), 'SNK Boundary Mode dropdown should retain the old Free Outlet / Atmospheric Discharge caption.');
assert(runtimeSource.includes('Outlet Pressure Boundary'), 'SNK Boundary Mode dropdown should retain the old Outlet Pressure Boundary caption.');
assert(runtimeSource.includes('Flow Demand Boundary'), 'SNK Boundary Mode dropdown should retain the old Flow Demand Boundary caption.');
assert(runtimeSource.includes('function syncSinkBoundaryModeOptions'), 'SNK Boundary Mode dropdown options should be normalized when the bridge runs.');
assert(!runtimeSource.includes('cloneNode'), 'SNK task window layout lock should not clone property rows.');
assert(!runtimeSource.includes('sinkPropertyReadoutContainer'), 'SNK task window layout lock should not search for insertion containers.');
assert(
  index.includes('engineering-route-trace-audit.js?v=20260704-sink-pabs-dedupe1'),
  'Index must load the route trace audit runtime with the SNK boundary mode lock cache key.'
);
assert(
  manifest.includes('SNK boundary mode canvas lock validation: npm run validate:sink-boundary-mode-canvas-lock'),
  'Manifest must document the SNK boundary mode canvas lock validator.'
);

console.log('SNK boundary mode canvas lock validation passed.');
