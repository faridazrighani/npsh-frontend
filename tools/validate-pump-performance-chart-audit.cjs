const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const auditPath = path.join(rootDir, 'engineering-pump-performance-chart-audit.js');
const indexPath = path.join(rootDir, 'index.html');

globalThis.__npshGlobalModel = {};
globalThis.__npshConnections = [];

const audit = require(auditPath);

function setModel(pump, extras = {}) {
  globalThis.__npshGlobalModel = {
    FLUID: {
      type: 'fluid',
      props: { density: 997, vaporPressure: 0.0317 }
    },
    'SRC-100': { type: 'source', props: {} },
    'P-100': {
      type: 'pump',
      props: {
        designFlow: 50,
        designHead: 42,
        designNpshr: 5,
        ...(pump.props || {})
      },
      results: {
        flow: 50,
        head: 42,
        npsha: 7,
        npshr: 5,
        npshMargin: 2,
        calculationFreshness: 'Current',
        ...(pump.results || {})
      }
    },
    'SNK-100': { type: 'sink', props: {} },
    ...(extras.model || {})
  };
  globalThis.__npshConnections = extras.connections || [
    { from: 'SRC-100', to: 'P-100', connectionType: 'hydraulic' },
    { from: 'P-100', to: 'SNK-100', connectionType: 'hydraulic' }
  ];
}

setModel({ props: {}, results: {} });
let result = audit.compute('P-100');
assert.strictEqual(result.version, 'pump-performance-chart-audit.v7');
assert.strictEqual(result.axisMode, 'log-log');
assert.strictEqual(result.chartHasDrawableCurve, false);
assert.strictEqual(result.status, 'Curve Data Unavailable');
assert(result.dutyPoints.length >= 2, 'Duty point values should remain available as markers.');

setModel({
  props: {
    curveData: [
      { flow: 40, head: 48, npshr: 4.5 },
      { flow: 50, head: 42, npshr: 5 },
      { flow: 65, head: 31, npshr: 6.1 }
    ],
    curveDataSource: '-'
  }
});
result = audit.compute('P-100');
assert.strictEqual(result.chartHasDrawableCurve, false);
assert(
  result.blockedSeries.some((item) => item.name === 'pumpHead' && /missing documented/.test(item.reason)),
  'Pump head curve must be blocked when numeric points exist but source/confidence is missing.'
);

setModel({
  props: {
    curveData: [
      { flow: 40, head: 48, npshr: 4.5 },
      { flow: 50, head: 42, npshr: 5 },
      { flow: 65, head: 31, npshr: 6.1 }
    ],
    curveDataSource: 'Engineering Fit',
    curveDataConfidence: '-'
  },
  results: {
    curveDataSource: 'Engineering Fit',
    curveDataConfidence: '-'
  }
});
result = audit.compute('P-100');
assert.strictEqual(result.chartHasDrawableCurve, false, 'Engineering Fit without accepted confidence must not draw continuous curves.');
assert.strictEqual(result.status, 'Curve Data Unavailable');

setModel({
  props: {
    curveData: [
      { flow: 0, head: 55, npshr: 3.8 },
      { flow: 40, head: 48, npshr: 4.5 },
      { flow: 50, head: 42, npshr: 5 },
      { flow: 65, head: 31, npshr: 6.1 }
    ],
    curveDataSource: 'Manufacturer datasheet curve',
    curveDataConfidence: 'Manufacturer test'
  }
});
result = audit.compute('P-100');
assert.strictEqual(result.chartHasDrawableCurve, true);
assert.strictEqual(result.series.pumpHead.allowed, true);
assert.strictEqual(result.series.npshr.allowed, true);
assert(result.filteredNonPositiveCount >= 1, 'Log-log chart must record omitted zero-flow points.');

setModel({
  results: {
    systemCurvePoints: [
      { flow: 30, head: 30 },
      { flow: 50, head: 42 },
      { flow: 70, head: 58 }
    ],
    npshCurvePoints: [
      { flow: 30, npsha: 8 },
      { flow: 50, npsha: 7 },
      { flow: 70, npsha: 5.6 }
    ]
  }
});
result = audit.compute('P-100');
assert.strictEqual(result.series.system.allowed, true);
assert.strictEqual(result.series.npsha.allowed, true);

setModel({
  results: {
    systemCurvePoints: [
      { flow: 30, head: 30 },
      { flow: 50, head: 42 },
      { flow: 70, head: 58 }
    ]
  }
}, { connections: [] });
result = audit.compute('P-100');
assert.strictEqual(result.series.system.allowed, false);
assert.strictEqual(result.routeComplete, false);

const auditSource = fs.readFileSync(auditPath, 'utf8');
assert(auditSource.includes("const MIN_CURVE_POINTS = 3"), 'Minimum curve-point gate must stay explicit.');
assert(!auditSource.includes('Generated audit fit from duty point'), 'Audit chart must not generate duty-point fit curves.');
assert(!auditSource.includes('panel.innerHTML ='), 'Audit badge panel must not be rendered in the pump chart UI.');
assert(!auditSource.includes("panel.setAttribute('data-pump-performance-chart-audit-panel'"), 'Audit badge panel must not be injected.');
assert(!auditSource.includes('Curve data unavailable'), 'No-data pump chart must stay visually clean like the legacy chart.');
assert(!auditSource.includes('Continuous curve is intentionally not displayed'), 'No-data pump chart must not show advisor-facing audit warnings.');
assert(!auditSource.includes("document.createElement('div')"), 'No-data pump chart must not create a warning overlay.');
assert(!auditSource.includes('wrap.appendChild(overlay)'), 'No-data pump chart must not append a warning overlay.');

const index = fs.readFileSync(indexPath, 'utf8');
assert.strictEqual(typeof audit.ensureRuntimeGuards, 'function', 'Audit runtime must expose late override guard.');
let lateRendererCalls = 0;
globalThis.updatePumpChart = function lateCaptionChartOverride() {
  lateRendererCalls += 1;
  return 'late-renderer';
};
audit.ensureRuntimeGuards();
assert.strictEqual(
  globalThis.updatePumpChart.__pumpPerformanceChartAuditVersion,
  'pump-performance-chart-audit.v7',
  'Audit runtime must rewrap late caption chart overrides.'
);
globalThis.updatePumpChart('P-100');
assert.strictEqual(lateRendererCalls, 0, 'Audit chart draw must not call the old fallback renderer.');

assert(
  index.includes('engineering-pump-performance-chart-audit.js?v=20260602-pump-chart-audit7'),
  'Index must cache-bust the pump performance chart audit runtime.'
);

console.log('Pump performance chart audit validation passed.');
