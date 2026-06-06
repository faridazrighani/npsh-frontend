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

assert.equal(runtime.version, '2026.06-route-trace-audit-v20', 'Route trace runtime should expose the SNK boundary mode canvas lock version.');
assert.equal(typeof runtime.sinkCanonicalValues, 'function', 'SNK canonical value helper should be exported for audit completeness checks.');
assert.equal(typeof runtime.sinkModeDisplayValue, 'function', 'SNK mode display helper should be exported for audit completeness checks.');
assert.equal(typeof runtime.syncSinkPropertyWindowCanonicalReadouts, 'function', 'SNK properties readout sync should be exported for audit completeness checks.');

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

assert(runtimeSource.includes('if (!panel?.querySelectorAll) return null;'), 'SNK panel row lookup must be null-safe.');
assert(runtimeSource.includes('function sinkBoundaryModeRaw'), 'Runtime should have an explicit selected SNK boundary mode resolver.');
assert(runtimeSource.includes("if (kind === 'free-outlet') return firstFiniteValue(tracePressureAbs, ATM_PRESSURE_BAR_A);"), 'Free Outlet pressure must not fall back to stale Flow Demand pressure.');
assert(runtimeSource.includes('sinkHeadForSelectedSinkMode'), 'SNK head should be mode-aware instead of always using stale solved head first.');
assert(runtimeSource.includes('function syncSinkPropertyWindowCanonicalReadouts'), 'SNK properties panel should sync compact readouts from the same canonical values as canvas.');
assert(runtimeSource.includes("sinkPropertyRowByLabel(windowNode, 'Calculated Abs. Pressure')"), 'SNK compact Calculated Abs. Pressure row should be explicitly synchronized.');
assert(runtimeSource.includes("formatCanvasValue(canonical.pressureAbsBar, 'bar a')"), 'SNK compact pressure readout should use canonical selected-boundary pressure.');
assert(
  index.includes('engineering-route-trace-audit.js?v=20260607-snk-boundary-mode-lock2'),
  'Index must load the route trace audit runtime with the SNK boundary mode lock cache key.'
);
assert(
  manifest.includes('SNK boundary mode canvas lock validation: npm run validate:sink-boundary-mode-canvas-lock'),
  'Manifest must document the SNK boundary mode canvas lock validator.'
);

console.log('SNK boundary mode canvas lock validation passed.');
