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

assert.equal(runtime.version, '2026.06-route-trace-audit-v36', 'Route trace runtime should expose the SNK boundary mode canvas lock version.');
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
assert(runtimeSource.includes("setSinkPropertyRowValue(windowNode, 'Calculated Abs. Pressure'"), 'SNK compact Calculated Abs. Pressure row should be explicitly synchronized.');
assert(runtimeSource.includes("formatCanvasValue(canonical.pressureAbsBar, 'bar a')"), 'SNK compact pressure readout should use canonical selected-boundary pressure.');
assert(runtimeSource.includes("hideSinkPropertyRows("), 'SNK property window should hide mode-ignored rows.');
assert(runtimeSource.includes("'ignored-when-not-flow-demand'"), 'SNK Flow Demand property row should be hidden when the selected mode is not Flow Demand.');
assert(runtimeSource.includes("'only-outlet-pressure-boundary'"), 'SNK pressure input rows should be hidden unless Outlet Pressure Boundary is selected.');
assert(!runtimeSource.includes("'flow-demand-elevation-inherited'"), 'SNK Elevation row must not be hidden as inherited/internal in Flow Demand mode.');
assert(runtimeSource.includes("'active-boundary-elevation'"), 'SNK Elevation row should be explicitly kept visible for all selected sink boundary modes.');
assert(runtimeSource.includes("setSinkPropertyRowValues(windowNode, ['Required Boundary P', 'Required Sink P abs']"), 'Flow Demand properties should sync required boundary pressure readouts.');
assert(runtimeSource.includes("setSinkPropertyRowValues(windowNode, ['Required Boundary Head', 'Required Sink Head']"), 'Flow Demand properties should sync required boundary head readouts.');
assert(runtimeSource.includes('function removeLegacyGeneratedSinkPropertyRows'), 'SNK property window sync should remove old generated rows that changed the original SINK layout.');
assert(runtimeSource.includes("const labels = ['Evaluated Flow', 'Outlet Pressure Assumption'];"), 'SNK property window should remove previous generated Evaluated Flow and Outlet Pressure Assumption rows.');
assert(!runtimeSource.includes("upsertSinkPropertyReadout(windowNode, 'Evaluated Flow'"), 'SNK property window should not inject Evaluated Flow into the old SINK conditions layout.');
assert(!runtimeSource.includes('function upsertSinkPropertyReadout'), 'SNK task window layout lock should not retain generated row insertion helpers.');
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
  index.includes('engineering-route-trace-audit.js?v=20260628-discharge-duty-status2'),
  'Index must load the route trace audit runtime with the SNK boundary mode lock cache key.'
);
assert(
  manifest.includes('SNK boundary mode canvas lock validation: npm run validate:sink-boundary-mode-canvas-lock'),
  'Manifest must document the SNK boundary mode canvas lock validator.'
);

console.log('SNK boundary mode canvas lock validation passed.');
