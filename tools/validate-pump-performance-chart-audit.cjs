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
assert.strictEqual(result.version, 'pump-performance-chart-audit.v19');
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
  'pump-performance-chart-audit.v19',
  'Audit runtime must rewrap late caption chart overrides.'
);
globalThis.updatePumpChart('P-100');
assert.strictEqual(lateRendererCalls, 0, 'Audit chart draw must not call the old fallback renderer.');

assert(
  index.includes('engineering-pump-performance-chart-audit.js?v=20260621-pump-chart-audit22'),
  'Index must cache-bust the pump performance chart audit runtime.'
);
assert(
  auditSource.includes('engineering-pump-performance-canonical-chart.js?v=20260621-canonical-chart16'),
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
  'pump-performance-chart-audit.v19',
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
assert(canonicalSource.includes('.pump-performance-chart-task-window canvas'), 'Canonical chart renderer must render canvases inside the separate Pump Performance Chart task window.');
assert(canonicalSource.includes('openPumpPerformanceChartTaskWindow'), 'Canonical chart renderer must expose a Pump Performance Chart task-window opener.');
assert(canonicalSource.includes('data-pump-performance-chart-task-menu'), 'Pump context menu must gain a Pump Performance Chart task-window menu item.');
assert(canonicalSource.includes('createFormulaDefenseMenuButton'), 'Pump context menu must gain a Pump Formula Defense task-window menu item.');
assert(canonicalSource.includes('data-pump-formula-defense-task-menu'), 'Pump Formula Defense must be exposed from the pump context menu.');
assert(canonicalSource.includes('openPumpFormulaDefenseTaskWindow'), 'Pump Formula Defense context menu item must reuse the existing task-window opener.');
assert(canonicalSource.includes('hidePumpFormulaDefensePropertiesButtons'), 'Pump Object Properties must hide the relocated Pump Formula Defense button.');
assert(canonicalSource.includes('#taskWindow [data-pump-formula-defense]'), 'Relocated Pump Formula Defense button must be hidden from the task window properties surface.');
assert(canonicalSource.includes('.object-properties-task [data-pump-formula-defense]'), 'Relocated Pump Formula Defense button must be hidden from the object-properties task surface.');
assert(!canonicalSource.includes('pump-performance-chart-task-btn'), 'Pump Object Properties must not show a duplicate Pump Performance Chart button.');
assert(!canonicalSource.includes('injectPumpPropertiesChartButtons'), 'Pump Properties chart-button injection must stay removed.');
assert(!canonicalSource.includes('data-pump-performance-chart-task-button'), 'Pump Properties must not carry a duplicate chart button data hook.');
assert(canonicalSource.includes('const canvasPumpId = canvas.dataset?.pumpId || pumpId'), 'Each chart canvas must keep its own pump id when multiple chart windows are visible.');
assert(canonicalSource.includes('function isChartTaskWindowCanvas'), 'Canonical chart renderer must detect compact chart task-window canvases.');
assert(canonicalSource.includes('const minWidth = compactTaskWindow ? 300 : 560'), 'Task-window charts must be allowed to shrink below the legacy 560px canvas width.');
assert(canonicalSource.includes('ResizeObserver'), 'Task-window charts must redraw from element resize events, not only window resize.');
assert(canonicalSource.includes('min-width: min(320px'), 'Pump Performance Chart task window must allow compact resizing.');
assert(canonicalSource.includes('min-width: 0'), 'Pump Performance Chart wrapper must not force horizontal width while resizing.');
assert(canonicalSource.includes('function drawFooterMetadata'), 'Canonical chart renderer must draw source/freshness metadata through the footer layout helper.');
assert(canonicalSource.includes('Chart Basis:'), 'Canonical footer metadata must include chart basis.');
assert(canonicalSource.includes('Curve Mode:'), 'Canonical footer metadata must include curve mode.');
assert(canonicalSource.includes('chart.bottom + (compact ? 38 : 44)'), 'X-axis label must be positioned from the plot footer, not absolute canvas bottom.');
assert(canonicalSource.includes('chart.bottom + 58'), 'Compact footer metadata must be below the x-axis label.');
assert(!canonicalSource.includes('height - 44 + index * 11'), 'Footer metadata must not return to the old axis-overlap position.');
assert.strictEqual(canonical.version, 'pump-performance-canonical-chart.v14', 'Canonical chart runtime must expose the smart engineering chart version.');
assert.strictEqual(typeof canonical.ensureRuntimeGuards, 'function', 'Canonical chart runtime must expose self-healing realtime guards.');
assert.strictEqual(typeof canonical.openTaskWindow, 'function', 'Canonical chart runtime must expose task-window creation for Pump Performance Chart.');
assert.strictEqual(typeof canonical.syncEntryPoints, 'function', 'Canonical chart runtime must expose entry-point synchronization for menu/buttons.');
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
  'pump-performance-canonical-chart.v14',
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
assert.strictEqual(liveAfter.dutyPoint.flow, 50, 'Mismatched backend chart data must not override Pump Properties design flow.');
assert.strictEqual(liveAfter.dutyPoint.head, 24, 'Mismatched backend chart data must not override Pump Properties design head.');
assert.strictEqual(liveAfter.rebuilt, true, 'Mismatched backend chart data must rebuild from live Pump Properties.');
globalThis.__npshGlobalModel['P-100'].props.designFlow = 72;
globalThis.__npshGlobalModel['P-100'].props.designHead = 31;
globalThis.__npshGlobalModel['P-100'].props.bepFlow = 72;
const liveAligned = globalThis.updatePumpChart('P-100');
assert.strictEqual(liveAligned.dutyPoint.flow, 72, 'Aligned backend chart data may follow the latest Pump Properties design flow.');
assert.strictEqual(liveAligned.series.pumpHead[1].value, 31, 'Aligned backend chart curve numbers may be reused.');
globalThis.__npshGlobalModel['P-100'].props.designFlow = 50;
globalThis.__npshGlobalModel['P-100'].props.designHead = 24;
globalThis.__npshGlobalModel['P-100'].props.bepFlow = 50;
globalThis.__npshGlobalModel['P-100'].results.flow = 50;
globalThis.__npshGlobalModel['P-100'].results.head = 24;

globalThis.__engineeringPumpEditFastLane = {
  version: 'engineering-pump-edit-fast-lane.v2',
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
const previewDutyPumpPoint = previewChartModel.series.pumpHead.find((point) => point.flow === 50);
assert.strictEqual(previewChartModel.preview, true, 'Pump chart must use local preview while pump fast lane is active.');
assert.strictEqual(previewChartModel.sourceMode, 'Local Pump Edit Preview', 'Pump chart preview must declare its local source mode.');
assert.strictEqual(previewChartModel.dutyPoint.head, 30, 'Pump chart preview must read the edited design head immediately.');
assert.strictEqual(previewDutyPumpPoint?.value, 30, 'Pump chart preview curve must follow the edited duty head.');
assert.strictEqual(previewDutyPumpPoint?.flow, 50, 'Pump chart preview curve must retain the edited duty flow.');
delete globalThis.__engineeringPumpEditFastLane;

let chartRebuildCalls = 0;
globalThis.getPumpPerformanceChartDataFreshness = () => ({ isFresh: false, freshness: 'Stale' });
globalThis.buildPumpPerformanceChartData = (pumpId, model) => {
  chartRebuildCalls += 1;
  const pump = model[pumpId] || {};
  const props = pump.props || {};
  const results = pump.results || {};
  const flow = Number(props.designFlow || results.flow || 50);
  const head = Number(props.designHead || results.head || 24);
  const npshr = Number(props.designNpshr || results.npshr || 2.4);
  const npsha = Number(results.npsha || 6.47);
  return {
    schemaVersion: 'pump-performance-chart-data.v1',
    sourceMode: 'Frontend formula engine',
    freshness: 'Current',
    sourceAudit: {
      curveDataSource: 'Frontend formula engine',
      curveDataConfidence: 'Current formula inputs'
    },
    dutyPoint: { flow, head, npsha, npshr, margin: npsha - npshr },
    series: {
      pumpHead: [
        { flow: flow * 0.5, value: head * 1.12 },
        { flow, value: head },
        { flow: flow * 1.5, value: head * 0.62 }
      ],
      systemHead: [
        { flow: flow * 0.5, value: head * 0.62 },
        { flow, value: head },
        { flow: flow * 1.5, value: head * 1.48 }
      ],
      npsha: [
        { flow: flow * 0.5, value: npsha * 1.08 },
        { flow, value: npsha },
        { flow: flow * 1.5, value: npsha * 0.72 }
      ],
      npshr: [
        { flow: flow * 0.5, value: npshr * 0.82 },
        { flow, value: npshr },
        { flow: flow * 1.5, value: npshr * 1.36 }
      ]
    }
  };
};

setModel({
  props: {
    designFlow: 50,
    designHead: 33,
    designEfficiency: 62,
    designNpshr: 2.4,
    bepFlow: 50
  },
  results: {
    flow: 50,
    head: 33,
    npsha: 6.47,
    npshr: 2.4,
    performanceChartData: {
      schemaVersion: 'pump-performance-chart-data.v1',
      sourceMode: 'Old backend chart',
      freshness: 'Current',
      inputFingerprint: { value: 'old-fingerprint' },
      sourceAudit: {
        curveDataSource: 'Old backend chart',
        curveDataConfidence: 'Stale test'
      },
      dutyPoint: { flow: 50, head: 24, npsha: 6.47, npshr: 2.4 },
      series: {
        pumpHead: [{ flow: 25, value: 26 }, { flow: 50, value: 24 }],
        systemHead: [{ flow: 25, value: 12 }, { flow: 50, value: 24 }],
        npsha: [{ flow: 25, value: 7 }, { flow: 50, value: 6.47 }],
        npshr: [{ flow: 25, value: 2 }, { flow: 50, value: 2.4 }]
      }
    }
  }
});
const staleRebuiltChartModel = canonical.buildChartModel('P-100');
assert.strictEqual(staleRebuiltChartModel.rebuilt, true, 'Stale performanceChartData must be rebuilt from current formula inputs.');
assert.strictEqual(staleRebuiltChartModel.dutyPoint.head, 33, 'Rebuilt chart duty head must follow edited pump input.');
assert.strictEqual(staleRebuiltChartModel.series.pumpHead[1].value, 33, 'Rebuilt pump head curve must replace stale stored values.');
assert.strictEqual(staleRebuiltChartModel.sourceAudit.frontendChartRebuilt, true, 'Rebuilt chart must retain audit evidence.');

globalThis.__engineeringPumpEditFastLane = {
  version: 'engineering-pump-edit-fast-lane.v2',
  mode: 'chart',
  field: 'designHead',
  pumpId: 'P-100',
  backend: 'defer',
  activeUntil: Date.now() + 2000
};
globalThis.__npshGlobalModel['P-100'].props.designHead = 36;
globalThis.__npshGlobalModel['P-100'].results.head = 36;
globalThis.__npshGlobalModel['P-100'].results.pumpHeadAtFlow = 36;
globalThis.__npshGlobalModel['P-100'].results.calculationFreshness = 'Local preview';
const enginePreviewChartModel = canonical.buildChartModel('P-100');
assert.strictEqual(enginePreviewChartModel.preview, true, 'Fast-lane chart must expose preview state.');
assert.strictEqual(enginePreviewChartModel.canonical, true, 'Fast-lane chart should prefer the formula-engine chart payload when available.');
assert.strictEqual(enginePreviewChartModel.sourceMode, 'Local Pump Edit Preview', 'Fast-lane formula preview must use the local preview source label.');
assert.strictEqual(enginePreviewChartModel.dutyPoint.head, 36, 'Fast-lane formula preview must follow the newest edited head.');
assert.strictEqual(enginePreviewChartModel.series.pumpHead[1].value, 36, 'Fast-lane formula preview must not reuse stale backend curve values.');
assert.strictEqual(enginePreviewChartModel.sourceAudit.localPumpEditPreview, true, 'Fast-lane formula preview must retain local preview audit evidence.');
assert(chartRebuildCalls >= 2, 'Stale and fast-lane paths must call the formula-engine chart builder.');
delete globalThis.__engineeringPumpEditFastLane;
delete globalThis.getPumpPerformanceChartDataFreshness;
delete globalThis.buildPumpPerformanceChartData;

setModel({
  props: {
    designFlow: 50,
    designHead: 24,
    designEfficiency: 62,
    designNpshr: 2.4,
    bepFlow: 50,
    npshrSourceMode: 'Estimated'
  },
  results: {
    flow: 50,
    head: 24,
    npsha: 7,
    npshr: 2.4,
    npshEvaluation: {
      flow: 50,
      pumpHead: 24,
      npsha: 7,
      npshr: 2.4,
      calculationFreshness: 'Local preview'
    }
  }
});
globalThis.__engineeringPumpEditFastLane = {
  version: 'engineering-pump-edit-fast-lane.v2',
  mode: 'chart',
  field: 'bepFlow',
  pumpId: 'P-100',
  backend: 'defer',
  activeUntil: Date.now() + 2000
};
const bep50Preview = canonical.buildChartModel('P-100');
const bep50HighFlowHead = bep50Preview.series.pumpHead.at(-1)?.value;
globalThis.__npshGlobalModel['P-100'].props.bepFlow = 80;
const bep80Preview = canonical.buildChartModel('P-100');
const bep80HighFlowHead = bep80Preview.series.pumpHead.at(-1)?.value;
assert.notStrictEqual(bep50HighFlowHead, bep80HighFlowHead, 'BEP Flow edit must reshape the local pump head curve away from the duty point immediately.');
assert.strictEqual(bep80Preview.series.pumpHead.find((point) => point.flow === 50)?.value, 24, 'BEP Flow edit must not move the design-flow/design-head duty anchor.');
assert.strictEqual(bep80Preview.ranges.bepFlow, 80, 'BEP Flow edit must update POR/AOR range basis immediately.');

globalThis.__engineeringPumpEditFastLane.field = 'designFlow';
globalThis.__npshGlobalModel['P-100'].props.designFlow = 70;
globalThis.__npshGlobalModel['P-100'].results.flow = 70;
globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.flow = 70;
const designFlowPreview = canonical.buildChartModel('P-100');
assert.strictEqual(designFlowPreview.dutyPoint.flow, 70, 'Design Flow edit must move the duty point immediately.');
assert(designFlowPreview.series.pumpHead.some((point) => point.flow === 70), 'Design Flow edit must add the edited duty flow to the chart grid.');

globalThis.__engineeringPumpEditFastLane.field = 'designHead';
globalThis.__npshGlobalModel['P-100'].props.designHead = 30;
globalThis.__npshGlobalModel['P-100'].results.head = 30;
globalThis.__npshGlobalModel['P-100'].results.pumpHeadAtFlow = 30;
globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.pumpHead = 30;
const designHeadPreview = canonical.buildChartModel('P-100');
const designHeadPoint = designHeadPreview.series.pumpHead.find((point) => point.flow === 70);
assert(designHeadPoint?.value > designFlowPreview.series.pumpHead.find((point) => point.flow === 70)?.value, 'Design Head edit must raise/lower the local pump head curve immediately.');

globalThis.__engineeringPumpEditFastLane.field = 'npshrSourceMode';
globalThis.__npshGlobalModel['P-100'].props.designNpshr = 3;
globalThis.__npshGlobalModel['P-100'].props.manualNpshr = 3;
globalThis.__npshGlobalModel['P-100'].props.npshrSourceMode = 'Manual';
globalThis.__npshGlobalModel['P-100'].results.npshr = 3;
globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshr = 3;
const manualNpshrPreview = canonical.buildChartModel('P-100');
assert(
  manualNpshrPreview.series.npshr.every((point) => point.value === 3),
  'Manual NPSHr source must render a flat local NPSHr curve.'
);
globalThis.__npshGlobalModel['P-100'].props.npshrSourceMode = 'Estimated';
const estimatedNpshrPreview = canonical.buildChartModel('P-100');
assert(
  estimatedNpshrPreview.series.npshr.some((point) => point.value !== 3),
  'Estimated NPSHr source must render a shaped local NPSHr curve.'
);
delete globalThis.__engineeringPumpEditFastLane;

setModel({
  props: {
    designFlow: 70,
    designHead: 35,
    designEfficiency: 62,
    designNpshr: 4,
    manualNpshr: 4,
    npshrSourceMode: 'Manual',
    bepFlow: 57,
    porMinPercent: 70,
    porMaxPercent: 120,
    aorMinPercent: 50,
    aorMaxPercent: 130
  },
  results: {
    flow: 50,
    head: 24,
    npsha: 6.4566,
    npshr: 2.4,
    npshEvaluation: {
      flow: 50,
      pumpHead: 24,
      npsha: 6.4566,
      npshr: 2.4,
      calculationFreshness: 'Current'
    },
    performanceChartData: {
      schemaVersion: 'pump-performance-chart-data.v1',
      sourceMode: 'Old backend chart',
      freshness: 'Current',
      sourceAudit: {
        curveDataSource: 'Old backend chart',
        curveDataConfidence: 'Protected backend',
        npshrSourceMode: 'Estimated'
      },
      ranges: { bepFlow: 50 },
      dutyPoint: { flow: 50, head: 24, npsha: 6.4566, npshr: 2.4 },
      series: {
        pumpHead: [{ flow: 5, value: 30 }, { flow: 50, value: 24 }, { flow: 85, value: 12 }],
        systemHead: [{ flow: 5, value: 8.8 }, { flow: 50, value: 24 }, { flow: 85, value: 52 }],
        npsha: [{ flow: 5, value: 9 }, { flow: 50, value: 6.4566 }, { flow: 85, value: 2.1 }],
        npshr: [{ flow: 5, value: 2.4 }, { flow: 50, value: 2.4 }, { flow: 85, value: 2.4 }]
      }
    }
  }
});
const smartEngineeringChartModel = canonical.buildChartModel('P-100');
assert.strictEqual(smartEngineeringChartModel.rebuilt, true, 'Smart chart must rebuild when old chart data conflicts with Pump Properties.');
assert.strictEqual(smartEngineeringChartModel.dutyPoint.flow, 70, 'Smart chart duty point must follow current Design Flow.');
assert.strictEqual(smartEngineeringChartModel.dutyPoint.head, 35, 'Smart chart duty point must follow current Design Head.');
assert.strictEqual(smartEngineeringChartModel.dutyPoint.npshr, 4, 'Smart chart duty NPSHr must follow current Manual NPSHr.');
assert.strictEqual(smartEngineeringChartModel.ranges.bepFlow, 57, 'Smart chart range basis must follow current BEP Flow.');
assert.strictEqual(
  smartEngineeringChartModel.series.pumpHead.find((point) => point.flow === 70)?.value,
  35,
  'Smart chart pump head curve must pass through the current design-flow/design-head anchor.'
);
assert.strictEqual(
  smartEngineeringChartModel.series.systemHead.find((point) => point.flow === 70)?.value,
  35,
  'Smart chart system curve must pass through the current design-flow/design-head target in preview mode.'
);
assert.strictEqual(smartEngineeringChartModel.primaryMarker.flow, 70, 'Preview primary marker must use current Design Flow.');
assert.strictEqual(smartEngineeringChartModel.primaryMarker.head, 35, 'Preview primary marker must use current Design Head.');
assert.strictEqual(smartEngineeringChartModel.markerLabel, 'Design Duty Target', 'Preview marker must clearly label the design-duty target.');
assert.strictEqual(smartEngineeringChartModel.chartMode, 'Preview', 'Mismatched non-vendor chart data must enter Preview mode.');
assert.strictEqual(smartEngineeringChartModel.sourceAudit.chartBasis, 'Design Duty Target', 'Preview chart basis must be auditable.');
assert.strictEqual(smartEngineeringChartModel.sourceAudit.systemCurveFormula, 'Hsystem(Q) = Hstatic + R*Q^2, constrained by Hsystem(Qd)=Hd');
assert.strictEqual(smartEngineeringChartModel.sourceAudit.npshaCurveFormula, 'NPSHa(Q) = suction energy - suction loss at duty*(Q/Qd)^2');
assert(
  smartEngineeringChartModel.series.npshr.every((point) => point.value === 4),
  'Smart chart Manual NPSHr mode must render a flat current manual NPSHr curve.'
);
assert.strictEqual(
  smartEngineeringChartModel.sourceAudit.smartEngineeringChart,
  true,
  'Smart chart must retain auditable smart-engineering metadata.'
);

setModel({
  props: {
    designFlow: 65,
    designHead: 43,
    designEfficiency: 69,
    designNpshr: 6,
    manualNpshr: 6,
    npshrSourceMode: 'Manual',
    bepFlow: 65
  },
  results: {
    flow: 50,
    head: 24,
    npsha: 6.4566,
    npshr: 2.4,
    performanceChartData: {
      schemaVersion: 'pump-performance-chart-data.v1',
      sourceMode: 'Manufacturer datasheet curve',
      freshness: 'Current',
      sourceAudit: {
        curveDataSource: 'Manufacturer datasheet curve',
        curveDataConfidence: 'Manufacturer test',
        chartMode: 'Vendor'
      },
      dutyPoint: { flow: 50, head: 24, npsha: 6.4566, npshr: 2.4 },
      series: {
        pumpHead: [{ flow: 30, value: 29 }, { flow: 50, value: 24 }, { flow: 80, value: 20 }],
        systemHead: [{ flow: 30, value: 12 }, { flow: 50, value: 24 }, { flow: 80, value: 48 }],
        npsha: [{ flow: 30, value: 7.2 }, { flow: 50, value: 6.4566 }, { flow: 80, value: 4.8 }],
        npshr: [{ flow: 30, value: 1.8 }, { flow: 50, value: 2.4 }, { flow: 80, value: 3.2 }]
      }
    }
  }
});
const vendorProtectedChartModel = canonical.buildChartModel('P-100');
assert.strictEqual(vendorProtectedChartModel.vendorProtected, true, 'Vendor chart data must be protected when live pump inputs no longer match.');
assert.strictEqual(vendorProtectedChartModel.chartMode, 'Vendor', 'Vendor curve protection must keep Vendor mode.');
assert.strictEqual(vendorProtectedChartModel.markerLabel, 'Operating Point', 'Vendor mode must keep the operating-point marker label.');
assert.strictEqual(vendorProtectedChartModel.showDesignTarget, true, 'Vendor mode must show the edited design target separately when it differs from the vendor operating point.');
assert.strictEqual(vendorProtectedChartModel.designTarget.flow, 65, 'Vendor mode design target overlay must read current Design Flow.');
assert.strictEqual(vendorProtectedChartModel.designTarget.head, 43, 'Vendor mode design target overlay must read current Design Head.');
assert.notStrictEqual(
  vendorProtectedChartModel.series.pumpHead.find((point) => point.flow === 65)?.value,
  43,
  'Vendor pump curve must not be forced through a changed design target.'
);
assert.strictEqual(vendorProtectedChartModel.sourceAudit.vendorCurveProtected, true, 'Vendor protection must be visible in source audit metadata.');

setModel({
  props: {
    designFlow: 60,
    designHead: 30,
    designEfficiency: 70,
    designNpshr: 3,
    bepFlow: 60
  },
  results: {
    flow: 60,
    head: 30,
    npsha: 6,
    npshr: 3,
    performanceChartData: {
      schemaVersion: 'pump-performance-chart-data.v1',
      sourceMode: 'Backend solved chart',
      freshness: 'Current',
      sourceAudit: {
        curveDataSource: 'Backend solved chart',
        curveDataConfidence: 'Solver output',
        chartMode: 'Solved'
      },
      dutyPoint: { flow: 60, head: 30, npsha: 6, npshr: 3 },
      series: {
        pumpHead: [{ flow: 40, value: 40 }, { flow: 60, value: 30 }, { flow: 80, value: 20 }],
        systemHead: [{ flow: 40, value: 20 }, { flow: 60, value: 30 }, { flow: 80, value: 45 }],
        npsha: [{ flow: 40, value: 7 }, { flow: 60, value: 6 }, { flow: 80, value: 4.8 }],
        npshr: [{ flow: 40, value: 2.5 }, { flow: 60, value: 3 }, { flow: 80, value: 3.8 }]
      }
    }
  }
});
const solvedChartModel = canonical.buildChartModel('P-100');
assert.strictEqual(solvedChartModel.chartMode, 'Solved', 'Fresh backend solved chart must remain in Solved mode.');
assert.strictEqual(solvedChartModel.operatingPoint.flow, 60, 'Solved mode operating point must come from pump/system curve intersection.');
assert.strictEqual(solvedChartModel.operatingPoint.head, 30, 'Solved mode operating head must come from pump/system curve intersection.');
assert.strictEqual(solvedChartModel.markerLabel, 'Operating Point', 'Solved mode marker must label the true operating point.');
assert.strictEqual(solvedChartModel.showDesignTarget, false, 'Solved mode must not duplicate the design target when it matches the operating point.');

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
