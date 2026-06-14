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
assert.strictEqual(result.version, 'pump-performance-chart-audit.v11');
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
    pumpCurve: [
      [5, 30],
      [50, 24],
      [85, 12.5]
    ],
    sysCurve: [
      [5, 8.8],
      [50, 24],
      [85, 52]
    ],
    npshCurvePoints: [
      { flow: 5, npsha: 9, npshr: 2.1 },
      { flow: 50, npsha: 6.5, npshr: 2.4 },
      { flow: 85, npsha: 2.1, npshr: 2.2 }
    ],
    curveDataSource: 'Manufacturer datasheet curve',
    curveDataConfidence: 'Manufacturer test'
  }
});
result = audit.compute('P-100');
assert.strictEqual(result.series.pumpHead.allowed, true, 'Legacy [flow, head] pump curve points must be accepted when sourced.');
assert.strictEqual(result.series.system.allowed, true, 'Legacy [flow, head] system curve points must be accepted when route-derived.');
assert.strictEqual(result.series.npsha.allowed, true, 'Legacy npshCurvePoints must provide NPSHa.');
assert.strictEqual(result.series.npshr.allowed, true, 'Legacy npshCurvePoints must provide NPSHr.');
assert.strictEqual(result.visibleSeries.length, 4, 'Legacy simulation chart should draw the four continuous datasets when evidence is valid.');

setModel({
  props: {
    designFlow: 50,
    designHead: 24,
    designEfficiency: 62,
    designNpshr: 2.4,
    bepFlow: 50,
    curveData: [
      { flow: 0, head: 55, eff: 0, npshr: 1 },
      { flow: 50, head: 50, eff: 60, npshr: 1.5 },
      { flow: 100, head: 40, eff: 75, npshr: 2 },
      { flow: 150, head: 20, eff: 50, npshr: 4 }
    ],
    curveDataSource: 'Screening default'
  },
  results: {
    performanceChartData: {
      schemaVersion: 'pump-performance-chart-data.v1',
      sourceMode: 'Basic estimated curve',
      freshness: 'Current',
      sourceAudit: {
        pumpCurveSource: 'Basic estimated curve',
        curveDataSource: 'Basic estimated curve',
        curveDataConfidence: 'Generic sizing estimate',
        isDefaultCurveData: true
      },
      dutyPoint: { flow: 50, head: 24, npsha: 6.47, npshr: 2.4, margin: 4.07 },
      series: {
        pumpHead: [
          { flow: 5, value: 30 },
          { flow: 50, value: 24 },
          { flow: 85, value: 12 }
        ],
        systemHead: [
          { flow: 5, value: 8.8 },
          { flow: 50, value: 24 },
          { flow: 85, value: 52 }
        ],
        npsha: [
          { flow: 5, value: 9 },
          { flow: 50, value: 6.47 },
          { flow: 85, value: 2.1 }
        ],
        npshr: [
          { flow: 5, value: 2.4 },
          { flow: 50, value: 2.4 },
          { flow: 85, value: 2.4 }
        ]
      }
    }
  }
});
result = audit.compute('P-100');
assert.strictEqual(result.series.pumpHead.rawPointCount, 3, 'Canonical pumpHead must replace default props.curveData.');
assert.strictEqual(result.series.pumpHead.positivePointCount, 3, 'Canonical pumpHead should keep solved positive points.');
assert.strictEqual(result.series.system.allowed, true, 'Canonical system curve remains route-derived.');
assert.strictEqual(result.series.npsha.allowed, true, 'Canonical NPSHa remains route-derived.');
assert.notStrictEqual(result.series.pumpHead.points[0]?.value, 55, 'Default template head must not leak into visible chart points.');

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
assert(!auditSource.includes('[0, 40, 120, 320]'), 'Audit runtime must not repaint the pump chart in repeated timeout bursts.');
assert(
  auditSource.includes('if (ensureRuntimeGuards()) scheduleRefresh();'),
  'Audit guard loop must refresh only when a runtime guard actually changes.'
);
assert(
  auditSource.includes('__pumpFormulaDefenseLiveAuditVersion')
    && auditSource.includes('__pumpPerformanceCanonicalChartVersion'),
  'Audit wrappers must preserve formula-defense and canonical chart patch markers.'
);

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
  'pump-performance-chart-audit.v11',
  'Audit runtime must rewrap late caption chart overrides.'
);
globalThis.updatePumpChart('P-100');
assert.strictEqual(lateRendererCalls, 0, 'Audit chart draw must not call the old fallback renderer.');

assert(
  index.includes('engineering-pump-performance-chart-audit.js?v=20260614-pump-chart-audit13'),
  'Index must cache-bust the pump performance chart audit runtime.'
);
assert(
  auditSource.includes('engineering-pump-performance-canonical-chart.js?v=20260614-canonical-chart7'),
  'Audit runtime must load the canonical operational chart renderer after audit guards.'
);
assert.strictEqual(typeof audit.loadCanonicalChartRenderer, 'function', 'Audit runtime must expose canonical renderer loader.');
assert(
  auditSource.includes('function canonicalChartRendererActive'),
  'Audit runtime must detect the canonical renderer before drawing the audit canvas.'
);

const previousDocument = globalThis.document;
globalThis.document = {
  getElementById(id) {
    return id === 'pump-performance-canonical-chart-runtime' ? { id } : null;
  },
  querySelectorAll() {
    throw new Error('Audit renderer should not query chart canvases after canonical renderer is active.');
  }
};
assert.doesNotThrow(() => audit.refresh('P-100'), 'Audit refresh must not draw over the canonical chart renderer.');
assert.strictEqual(
  globalThis.__pumpPerformanceChartAuditLast?.version,
  'pump-performance-chart-audit.v11',
  'Audit refresh should still retain the latest computed audit model.'
);
if (previousDocument === undefined) delete globalThis.document;
else globalThis.document = previousDocument;

const canonicalPath = path.join(rootDir, 'engineering-pump-performance-canonical-chart.js');
const canonicalSource = fs.readFileSync(canonicalPath, 'utf8');
const canonical = require(canonicalPath);
assert(canonicalSource.includes('EngineeringPerformanceRefreshGovernor'), 'Canonical chart renderer must use the performance governor when available.');
assert(!canonicalSource.includes('[0, 40, 120, 260, 520, 900]'), 'Canonical chart renderer must not schedule six repeated renders per update.');
assert(canonicalSource.includes('hasRenderableCanvas'), 'Canonical chart renderer must skip scheduled renders when no chart canvas is visible.');
assert(canonicalSource.includes('buildFastLanePreviewModel'), 'Canonical chart renderer must build a local pump-edit preview model.');
assert(canonicalSource.includes('Local Pump Edit Preview'), 'Canonical chart renderer must label local pump-edit chart previews.');
assert(canonicalSource.includes('options.force && delayMs <= 32'), 'Canonical chart renderer must bypass governed latency for fast-lane preview frames.');
assert.strictEqual(canonical.version, 'pump-performance-canonical-chart.v5', 'Canonical chart runtime must expose the realtime-refresh version.');
assert.strictEqual(typeof canonical.ensureRuntimeGuards, 'function', 'Canonical chart runtime must expose self-healing realtime guards.');
assert(
  canonicalSource.includes('__pumpFormulaDefenseLiveAuditVersion')
    && canonicalSource.includes('__pumpPerformanceChartAuditVersion'),
  'Canonical chart wrappers must preserve formula-defense and chart-audit patch markers.'
);
const chartModel = canonical.buildChartModel('P-100');
assert.strictEqual(chartModel.canonical, false, 'Current test model without performanceChartData should use legacy fallback.');
const canonicalUpdatePumpChart = globalThis.updatePumpChart;
audit.ensureRuntimeGuards();
assert.strictEqual(globalThis.updatePumpChart, canonicalUpdatePumpChart, 'Audit guard must not rewrap the canonical chart renderer.');

globalThis.updatePumpChart = function overwrittenPumpChartRenderer() {
  return { stale: true };
};
canonical.ensureRuntimeGuards();
assert.strictEqual(
  globalThis.updatePumpChart.__pumpPerformanceCanonicalChartVersion,
  'pump-performance-canonical-chart.v5',
  'Canonical renderer must reclaim updatePumpChart after any late override.'
);

setModel({
  props: {
    designFlow: 50,
    designHead: 24,
    designEfficiency: 62,
    designNpshr: 2.4,
    bepFlow: 50
  },
  results: {
    performanceChartData: {
      schemaVersion: 'pump-performance-chart-data.v1',
      sourceMode: 'Backend solved chart',
      freshness: 'Current',
      sourceAudit: {
        curveDataSource: 'Backend solved chart',
        curveDataConfidence: 'Protected backend'
      },
      dutyPoint: { flow: 50, head: 24, npsha: 6.47, npshr: 2.4 },
      series: {
        pumpHead: [{ flow: 5, value: 30 }, { flow: 50, value: 24 }],
        systemHead: [{ flow: 5, value: 8.8 }, { flow: 50, value: 24 }],
        npsha: [{ flow: 5, value: 9 }, { flow: 50, value: 6.47 }],
        npshr: [{ flow: 5, value: 2.4 }, { flow: 50, value: 2.4 }]
      }
    }
  }
});
const liveBefore = globalThis.updatePumpChart('P-100');
const liveBeforeFlow = liveBefore.dutyPoint.flow;
globalThis.__npshGlobalModel['P-100'].results.performanceChartData.dutyPoint.flow = 72;
globalThis.__npshGlobalModel['P-100'].results.performanceChartData.dutyPoint.head = 31;
globalThis.__npshGlobalModel['P-100'].results.performanceChartData.series.pumpHead[1].flow = 72;
globalThis.__npshGlobalModel['P-100'].results.performanceChartData.series.pumpHead[1].value = 31;
const liveAfter = globalThis.updatePumpChart('P-100');
assert.strictEqual(liveBeforeFlow, 50, 'Initial chart render should read current backend duty flow.');
assert.strictEqual(liveAfter.dutyPoint.flow, 72, 'Pump chart render must refresh duty flow from the latest model data.');
assert.strictEqual(liveAfter.series.pumpHead[1].value, 31, 'Pump chart curve numbers must refresh from the latest model data.');

globalThis.__engineeringPumpEditFastLane = {
  version: 'engineering-pump-edit-fast-lane.v1',
  mode: 'chart',
  field: 'designHead',
  pumpId: 'P-100',
  backend: 'defer',
  activeUntil: Date.now() + 2000
};
globalThis.__npshGlobalModel['P-100'].props.designHead = 30;
globalThis.__npshGlobalModel['P-100'].results.head = 30;
globalThis.__npshGlobalModel['P-100'].results.pumpHeadAtFlow = 30;
globalThis.__npshGlobalModel['P-100'].results.calculationFreshness = 'Local preview';
globalThis.__npshGlobalModel['P-100'].results.npshEvaluation = {
  flow: 50,
  pumpHead: 30,
  npsha: 7,
  npshr: 5,
  npshMargin: 2,
  calculationFreshness: 'Local preview'
};
const previewChartModel = canonical.buildChartModel('P-100');
assert.strictEqual(previewChartModel.preview, true, 'Pump chart must use local preview while pump fast lane is active.');
assert.strictEqual(previewChartModel.sourceMode, 'Local Pump Edit Preview', 'Pump chart preview must declare its local source mode.');
assert.strictEqual(previewChartModel.dutyPoint.head, 30, 'Pump chart preview must read the edited design head immediately.');
assert.strictEqual(previewChartModel.series.pumpHead[1].value, 30, 'Pump chart preview curve must scale away from stale backend head.');
assert.strictEqual(previewChartModel.series.pumpHead[1].flow, 50, 'Pump chart preview curve must scale away from stale backend flow.');
delete globalThis.__engineeringPumpEditFastLane;

setModel({
  props: {
    designFlow: 50,
    designHead: 24,
    designEfficiency: 62,
    designNpshr: 2.4,
    bepFlow: 50,
    curveData: [
      { flow: 0, head: 55, eff: 0, npshr: 1 },
      { flow: 50, head: 50, eff: 60, npshr: 1.5 },
      { flow: 100, head: 40, eff: 75, npshr: 2 },
      { flow: 150, head: 20, eff: 50, npshr: 4 }
    ]
  },
  results: {
    performanceChartData: {
      schemaVersion: 'pump-performance-chart-data.v1',
      sourceMode: 'Basic estimated curve',
      freshness: 'Current',
      sourceAudit: {
        curveDataSource: 'Basic estimated curve',
        curveDataConfidence: 'Generic sizing estimate',
        isDefaultCurveData: true
      },
      dutyPoint: { flow: 50, head: 24, npsha: 6.47, npshr: 2.4 },
      series: {
        pumpHead: [{ flow: 5, value: 30 }, { flow: 50, value: 24 }, { flow: 85, value: 12 }],
        systemHead: [{ flow: 5, value: 8.8 }, { flow: 50, value: 24 }, { flow: 85, value: 52 }],
        npsha: [{ flow: 5, value: 9 }, { flow: 50, value: 6.47 }, { flow: 85, value: 2.1 }],
        npshr: [{ flow: 5, value: 2.4 }, { flow: 50, value: 2.4 }, { flow: 85, value: 2.4 }]
      }
    }
  }
});
const canonicalChartModel = canonical.buildChartModel('P-100');
assert.strictEqual(canonicalChartModel.canonical, true, 'Canonical renderer must use performanceChartData when available.');
assert.strictEqual(canonicalChartModel.series.pumpHead[0].value, 30, 'Canonical renderer must ignore default props.curveData.');
assert.strictEqual(canonicalChartModel.sourceAudit.isDefaultCurveData, true, 'Canonical renderer must retain default-curve audit flag.');

setModel({
  props: {
    designFlow: '',
    designHead: '',
    designEfficiency: '',
    designNpshr: '',
    bepFlow: '',
    curveData: [
      { flow: 0, head: 55, eff: 0, npshr: 1 },
      { flow: 50, head: 50, eff: 60, npshr: 1.5 },
      { flow: 100, head: 40, eff: 75, npshr: 2 },
      { flow: 150, head: 20, eff: 50, npshr: 4 }
    ]
  },
  results: {
    performanceChartData: {
      schemaVersion: 'pump-performance-chart-data.v1',
      sourceMode: 'Engineering Fit',
      freshness: 'Current',
      sourceAudit: {
        curveDataSource: 'Engineering Fit',
        curveDataConfidence: '-',
        isDefaultCurveData: true
      },
      series: {
        pumpHead: [{ flow: 5, value: 30 }, { flow: 50, value: 24 }]
      }
    }
  }
});
const blockedChartModel = canonical.buildChartModel('P-100');
assert.strictEqual(blockedChartModel.blocked, true, 'Canonical renderer must block estimated/template chart data when pump inputs are blank.');
assert.strictEqual(blockedChartModel.series.pumpHead.length, 0, 'Blocked chart model must not expose stale pump head points.');
assert(
  blockedChartModel.warnings.some((warning) => /complete pump duty inputs/i.test(warning)),
  'Blocked chart model must explain the missing input basis.'
);

console.log('Pump performance chart audit validation passed.');
