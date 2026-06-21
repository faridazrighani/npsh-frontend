const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-realtime-calculation-defense.js');
const indexPath = path.join(rootDir, 'index.html');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');

globalThis.__npshGlobalModel = {
  FLUID: {
    type: 'fluid',
    props: {
      fluidName: 'Water',
      density: 958.348,
      viscosity: 0.803,
      vaporPressure: 1.01418
    }
  },
  'PIPE-1': {
    type: 'pipe',
    props: {
      segments: [
        { name: 'Journal suction pipe 4 in', diameter: 0.098, length: 2, roughness: 0.00015, fittingType: 'None' },
        { name: 'Globe valve 4 in', diameter: 0.098, length: 0, roughness: 0.00015, fittingType: 'Custom K', fittingK: 5.8, fittingQuantity: 1 }
      ]
    },
    results: {
      flow: 50,
      calculationTrace: {
        basis: { flowM3H: 50, viscosityCSt: 0.803, density: 958.348 },
        totals: {}
      }
    }
  },
  'P-100': {
    type: 'pump',
    props: { designFlow: 50 },
    results: {
      calculationFreshness: 'Current',
      performanceChartData: {
        schemaVersion: 'pump-performance-chart-data.v1',
        freshness: 'Current',
        warnings: []
      },
      routeTrace: {
        lossFreshness: 'Current from backend route trace'
      },
      actionReadinessBackend: {
        status: 'Ready',
        stale: false
      },
      npshEvaluation: {
        calculationFreshness: 'Current'
      }
    }
  },
  'SNK-100': {
    type: 'sink',
    props: {
      boundaryMode: 'Flow Demand Boundary',
      elevation: 10
    },
    results: {
      calculationFreshness: 'Current',
      routeTrace: {
        lossFreshness: 'Current from backend route trace'
      }
    }
  }
};

let pumpChartRefreshes = 0;
globalThis.updatePumpChart = () => {
  pumpChartRefreshes += 1;
};
let governedRefreshes = 0;
globalThis.EngineeringPerformanceRefreshGovernor = {
  schedule: (type, nodeId, options = {}) => {
    governedRefreshes += 1;
    if (typeof options.run === 'function') options.run();
    return true;
  },
  scheduleEnhance: () => {
    governedRefreshes += 1;
    return true;
  }
};
globalThis.applyBackendSimulationPrimaryResults = (pumpNode, backendResult, response) => {
  pumpNode.results.calculationAudit = response.calculationAudit;
  pumpNode.results.dependencyManifest = response.dependencyManifest;
  pumpNode.results.calculationDefenseContract = response.calculationDefenseContract;
  pumpNode.results.npshEvaluation = backendResult;
  return true;
};
let backendRefreshes = 0;
globalThis.runBackendSimulationShadow = async () => {
  backendRefreshes += 1;
  return { primaryApplied: true };
};
let updateSimulationCalls = [];
let reportRefreshes = 0;
let parameterRefreshes = 0;
globalThis.updateSimulation = async (options = {}) => {
  updateSimulationCalls.push(options);
  return { ok: true, options };
};
globalThis.EngineeringAnalysisReportLiveRuntime = {
  refresh: () => {
    reportRefreshes += 1;
    return 1;
  },
  scheduleRefresh: () => {
    reportRefreshes += 1;
    return true;
  }
};
globalThis.EngineeringParameterTaskRuntime = {
  refreshOpenWindows: () => {
    parameterRefreshes += 1;
    return 1;
  }
};

const runtime = require(runtimePath);
assert.equal(runtime.version, 'engineering-realtime-calculation-defense.v10', 'Realtime defense runtime should expose v10.');
assert.equal(runtime.autosolvePolicy?.mode, 'realtime-autosolve-first', 'Realtime defense must declare realtime autosolve as the primary calculation policy.');
assert.equal(runtime.autosolvePolicy?.manualCommandRole, 'validate-refresh-evidence', 'Manual command must be treated as evidence validation/refresh.');
assert.equal(runtime.debounceForSourceEvent('input'), 240, 'Input debounce must keep numeric edits responsive.');
assert.equal(runtime.debounceForSourceEvent('change'), 90, 'Change debounce must refresh select/blur edits quickly.');
assert.equal(typeof runtime.markInputLatencyShield, 'function', 'Realtime defense must expose the input latency shield marker.');
assert.equal(typeof runtime.isInputLatencyShieldActive, 'function', 'Realtime defense must expose the input latency shield status reader.');
assert.equal(typeof runtime.buildPipeSegmentRows, 'function', 'Realtime defense runtime should expose canonical pipe segment row builder.');
assert.equal(typeof runtime.publishCanonicalCalculationState, 'function', 'Realtime defense runtime should expose canonical calculation state publisher.');
assert.equal(typeof runtime.scheduleLinkedViewRefresh, 'function', 'Realtime defense runtime should expose frame-batched linked view refresh.');
assert.equal(typeof runtime.currentCalculationTransaction, 'function', 'Realtime defense runtime should expose current calculation transaction.');
assert.equal(typeof runtime.markFailed, 'function', 'Realtime defense runtime should expose backend failure state marker.');

const realtimeSource = fs.readFileSync(runtimePath, 'utf8');
assert(
  realtimeSource.includes('requestAnimationFrame(() =>') && realtimeSource.includes('const delayMs = 360'),
  'Linked view refresh must be debounced after an animation frame and delayed enough to protect input typing.'
);
assert(realtimeSource.includes('AUTO_SOLVE_DEBOUNCE_MS = 240'), 'Autosolve debounce must be realtime-first for responsive numeric typing.');
assert(realtimeSource.includes('AUTO_SOLVE_CHANGE_DEBOUNCE_MS = 90'), 'Change-event autosolve debounce must be fast for selects and committed edits.');
assert(realtimeSource.includes('realtime-autosolve-first'), 'Realtime defense must declare the realtime-autosolve-first policy.');
assert(realtimeSource.includes('validate-refresh-evidence'), 'Realtime defense must document the manual command as validation/evidence refresh.');
assert(realtimeSource.includes('npsh:realtime-autosolve-superseded'), 'Realtime defense must emit a superseded event for stale autosolve results.');
assert(realtimeSource.includes('__engineeringRealtimeAutoSolveSequence'), 'Realtime autosolve calls must carry a sequence guard.');
assert(realtimeSource.includes('__engineeringRealtimeRequestId'), 'Realtime autosolve calls must carry a request id guard.');
assert(realtimeSource.includes('__engineeringCalculationTransaction'), 'Realtime defense must publish calculation transaction state.');
assert(realtimeSource.includes('initialDependencyFingerprint'), 'Realtime transaction must record the initial dependency fingerprint.');
assert(realtimeSource.includes('finalDependencyFingerprint'), 'Realtime transaction must record the final dependency fingerprint.');
assert(realtimeSource.includes('markFailed'), 'Realtime defense must expose a Failed state for backend failures.');
assert(realtimeSource.includes('USER_CALCULATION_INTENT_SELECTOR'), 'Realtime defense must distinguish user calculation intent from sample-menu browsing.');
assert(realtimeSource.includes('SAMPLE_CASE_OPEN_SELECTOR'), 'Realtime defense must treat only Open Sample Case clicks as sample calculation intent.');
assert(realtimeSource.includes('calculationMode'), 'Realtime defense must share calculation mode with lifecycle and overlay runtimes.');
assert(realtimeSource.includes('sample-open'), 'Realtime defense must mark Open Sample Case as sample-open mode.');
assert(realtimeSource.includes('manual-solve'), 'Realtime defense must mark Run/Solve commands as manual-solve mode.');
assert(realtimeSource.includes('realtime-input'), 'Realtime defense must mark input autosolve as realtime-input mode.');
assert(realtimeSource.includes('hasRecentUserCalculationIntent'), 'Realtime defense must suppress bootstrap Calculating status without recent user intent.');
assert(realtimeSource.includes('scheduleUiRefresh'), 'Realtime defense must route UI repaint work through a scheduler.');
assert(realtimeSource.includes('EngineeringPerformanceRefreshGovernor'), 'Realtime defense must use the performance refresh governor when available.');
assert(realtimeSource.includes('EngineeringPumpEditFastLane'), 'Realtime defense must delegate Pump Object Properties edits to the fast lane before scheduling backend autosolve.');
assert(realtimeSource.includes('CALCULATION_INPUT_SURFACE_SELECTOR'), 'Realtime defense must centralize calculation input surface coverage.');
assert(realtimeSource.includes('.persistent-object-properties-task-window'), 'Realtime defense must autosolve persistent Object Properties input edits.');
assert(realtimeSource.includes('manualNpshr'), 'Realtime defense must treat compact Manual NPSHr as a calculation input.');
assert(realtimeSource.includes("calculationMode: 'realtime-input'"), 'Realtime defense events must explicitly identify realtime-input mode.');
assert(realtimeSource.includes('publishCalculationStatusState'), 'Realtime defense must use a lightweight stale/calculating publisher before backend results are current.');
assert(realtimeSource.includes('statusOnly: true'), 'Stale/calculating calculation-state events must avoid rebuilding full canonical trace rows.');

const segmentRows = runtime.buildPipeSegmentRows('PIPE-1', globalThis.__npshGlobalModel['PIPE-1'], globalThis.__npshGlobalModel);
assert.equal(segmentRows.length, 2, 'Canonical segment builder should keep one row per configured pipe segment.');
assert.equal(segmentRows[0].diameter, 0.098, 'Canonical segment row should carry pipe diameter.');
assert.equal(segmentRows[0].length, 2, 'Canonical segment row should carry pipe length.');
assert(Math.abs(segmentRows[0].reynolds - 224717.037) < 1, 'Canonical segment row should calculate Reynolds number from live flow and Fluid Basis viscosity.');
assert(Math.abs(segmentRows[0].majorLoss - 0.08038) < 0.0002, 'Canonical segment row should calculate Darcy-Weisbach major loss.');
assert(Math.abs(segmentRows[1].minorLoss - 1.002259) < 0.0002, 'Canonical segment row should calculate K-method minor loss.');

const canonical = runtime.publishCanonicalCalculationState('unit-test', 'PIPE-1');
assert.equal(canonical.pipes['PIPE-1'].segments.length, 2, 'Canonical calculation state should distribute pipe segment rows globally.');
assert.equal(globalThis.__npshGlobalModel['PIPE-1'].results.calculationTrace.segmentRows.length, 2, 'Canonical pipe rows should be attached to the live pipe trace.');

const state = runtime.markStale('P-100', 'Unit test input changed.');
const results = globalThis.__npshGlobalModel['P-100'].results;

assert.equal(state.status, 'Stale', 'markStale should report stale status.');
assert.equal(results.calculationFreshness, 'Stale', 'Pump results should be marked stale immediately.');
assert.equal(results.backendValidationStatus, 'Stale', 'Backend validation status should be stale until refresh.');
assert.equal(results.performanceChartData.freshness, 'Stale', 'Stored chart data must not remain Current after input change.');
assert(results.performanceChartData.warnings.some((warning) => /Unit test input changed/i.test(warning)), 'Chart warnings should explain stale input change.');
assert.equal(results.routeTrace.lossFreshness, 'Stale - input changed before backend refresh', 'Route trace freshness should become stale.');
assert.equal(results.actionReadinessBackend.stale, true, 'Action readiness should be marked stale.');
assert.equal(results.npshEvaluation.calculationFreshness, 'Stale', 'NPSH evaluation should be marked stale.');
assert.equal(pumpChartRefreshes, 0, 'Stale marking must not force chart refresh while the user is typing.');
assert.equal(governedRefreshes, 0, 'Stale marking must not schedule heavy UI refresh work through the governor.');

const sinkState = runtime.markStale('SNK-100', 'Sink boundary mode changed.');
const sinkResults = globalThis.__npshGlobalModel['SNK-100'].results;
assert.deepEqual(new Set(sinkState.nodeIds), new Set(['SNK-100', 'P-100']), 'A changed SNK boundary should mark both the SNK and dependent pump calculation stale.');
assert.equal(sinkResults.calculationFreshness, 'Stale', 'Sink results should be marked stale immediately after boundary mode change.');
assert.equal(results.calculationFreshness, 'Stale', 'Dependent pump calculation should remain stale after SNK boundary mode change.');
assert.equal(results.actionReadinessBackend.stale, true, 'Pump action readiness should not remain Current after SNK boundary mode change.');
assert.equal(pumpChartRefreshes, 0, 'Dependent SNK stale marking must also avoid heavy chart refresh while input is settling.');

const current = runtime.markCurrentFromBackend({
  calculationId: 'calc-1',
  dependencyManifest: { dependencyFingerprint: 'dep-1' }
});
assert.equal(current.status, 'Current', 'Backend refresh state should mark realtime defense current.');
assert.equal(current.dependencyFingerprint, 'dep-1', 'Backend dependency fingerprint should be retained.');

runtime.install();
const callsBeforeShieldedInput = updateSimulationCalls.length;
runtime.markInputLatencyShield(null, 'P-100', 'Unit test pump input edit.');
globalThis.__engineeringCalculationUserIntentAt = Date.now();
globalThis.__engineeringCalculationUserIntent = { calculationMode: 'realtime-input', source: 'trusted-input' };
const shieldedInputResult = globalThis.updateSimulation({ selectedNodeId: 'P-100' });
assert(shieldedInputResult && typeof shieldedInputResult.then === 'function', 'Shielded input update should keep the updateSimulation Promise contract.');
assert.equal(
  updateSimulationCalls.length,
  callsBeforeShieldedInput,
  'Shielded realtime input must bypass the original updateSimulation refresh path so typing is not blocked by heavy UI refresh.'
);
assert.equal(
  globalThis.__engineeringInputLatencyShieldBypass?.nodeId,
  'P-100',
  'Shielded realtime input should record the bypassed node for diagnostics.'
);
globalThis.__engineeringInputLatencyShield.activeUntil = 0;
globalThis.__engineeringCalculationUserIntentAt = 0;
globalThis.__engineeringCalculationUserIntent = null;
const calculating = runtime.markCalculating('P-100', 'Backend unit test recalculation.');
assert.equal(calculating.status, 'Calculating', 'markCalculating should expose backend refresh in progress.');
assert.equal(results.calculationFreshness, 'Calculating', 'Pump results should be marked calculating during backend refresh.');
assert.equal(results.backendValidationStatus, 'Calculating', 'Backend validation status should show calculating while the request is pending.');
assert.equal(results.routeTrace.lossFreshness, 'Calculating - backend refresh in progress', 'Route trace freshness should show pending backend refresh.');

const failed = runtime.markFailed('P-100', 'Unit backend timeout.');
assert.equal(failed.status, 'Failed', 'markFailed should expose backend refresh failure.');
assert.equal(results.calculationFreshness, 'Failed', 'Pump results should be marked failed after backend refresh failure.');
assert.equal(results.backendValidationStatus, 'Failed', 'Backend validation status should show failed after backend refresh failure.');
assert.equal(results.routeTrace.lossFreshness, 'Failed - backend refresh did not complete', 'Route trace freshness should show failed backend refresh.');

globalThis.__engineeringCalculationDefenseRealtimeState = { status: 'BeforeBackendNoIntent' };
globalThis.runBackendSimulationShadow('P-100');
assert.equal(backendRefreshes, 1, 'Wrapped backend refresh should still call the original backend runner.');
assert.equal(
  globalThis.__engineeringCalculationDefenseRealtimeState.status,
  'BeforeBackendNoIntent',
  'Wrapped backend runner must not mark Calculating for bootstrap/sample-menu refresh without user intent.'
);
globalThis.__engineeringCalculationUserIntentAt = Date.now();
globalThis.__engineeringCalculationUserIntent = { calculationMode: 'menu-browse', source: 'simulation-menu-browse' };
globalThis.runBackendSimulationShadow('P-100');
assert.equal(backendRefreshes, 2, 'Menu-browse backend wrapper should still call the original backend runner.');
assert.equal(
  globalThis.__engineeringCalculationDefenseRealtimeState.status,
  'BeforeBackendNoIntent',
  'Menu-browse mode must not mark realtime state Calculating.'
);
globalThis.__engineeringCalculationUserIntentAt = Date.now();
globalThis.__engineeringCalculationUserIntent = { calculationMode: 'manual-solve', source: 'manual-command' };
globalThis.runBackendSimulationShadow('P-100');
assert.equal(backendRefreshes, 3, 'Wrapped backend refresh should continue to call the original backend runner after user intent.');
assert.equal(
  globalThis.__engineeringCalculationDefenseRealtimeState.status,
  'Calculating',
  'Wrapped backend runner should mark Calculating when user intent is recent.'
);

globalThis.applyBackendSimulationPrimaryResults(globalThis.__npshGlobalModel['P-100'], { flow: 50 }, {
  calculationAudit: { calculationId: 'calc-2' },
  dependencyManifest: { dependencyFingerprint: 'dep-2' },
  calculationDefenseContract: { status: 'Ready' }
});
assert.equal(globalThis.__engineeringCalculationDefenseRealtimeState.calculationId, 'calc-2', 'Wrapped backend apply should retain calculation id.');
assert.equal(globalThis.__engineeringCalculationDefenseRealtimeState.dependencyFingerprint, 'dep-2', 'Wrapped backend apply should retain dependency fingerprint.');
assert.equal(globalThis.__engineeringCalculationDefenseRealtimeState.calculationDefenseStatus, 'Ready', 'Wrapped backend apply should retain calculation defense status.');

const pendingAutoSolve = runtime.requestAutoSolve('P-100', 'Autosolve unit test.', { delayMs: 0 });
assert.match(pendingAutoSolve.requestId, /^rt-/, 'Autosolve should allocate a transaction request id.');
assert.equal(
  runtime.currentCalculationTransaction()?.requestId,
  pendingAutoSolve.requestId,
  'Autosolve should publish the active transaction before backend execution.'
);
runtime.flushAutoSolve().then(async () => {
  await new Promise((resolve) => setTimeout(resolve, 430));
  const autoCall = updateSimulationCalls.find((call) => call.__engineeringRealtimeAutoSolve);
  assert(autoCall, 'requestAutoSolve should call updateSimulation through the realtime autosolve path.');
  assert.equal(autoCall.refreshReason, 'solve', 'Autosolve must enter the same protected backend route as manual solve.');
  assert.equal(autoCall.trigger, 'solve', 'Autosolve must use the backend solve trigger while keeping realtime metadata.');
  assert.equal(autoCall.realtimeTrigger, 'realtime-input', 'Autosolve must keep realtime-input metadata for lifecycle UX.');
  assert.equal(autoCall.calculationMode, 'realtime-input', 'Autosolve must keep realtime-input calculation mode metadata.');
  assert.equal(autoCall.forceBackend, true, 'Autosolve should force the protected backend refresh.');
  assert.equal(autoCall.renderSidebarAfter, true, 'Autosolve should allow linked object windows to refresh after solving.');
  assert.equal(autoCall.__engineeringRealtimeAutoSolveSequence, 1, 'Autosolve should pass its sequence into updateSimulation options.');
  assert.equal(autoCall.__engineeringRealtimeRequestId, pendingAutoSolve.requestId, 'Autosolve should pass request id into updateSimulation options.');
  assert.equal(runtime.currentCalculationTransaction()?.finalState, 'Current', 'Autosolve should close its transaction as Current after backend completion.');
  assert.equal(reportRefreshes > 0, true, 'Autosolve should refresh live Analysis Report cells.');
  assert.equal(parameterRefreshes > 0, true, 'Autosolve should refresh open Parameter Task windows.');

const index = fs.readFileSync(indexPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');
assert(
  index.includes('engineering-realtime-calculation-defense.js?v=20260621-manual-npshr-autosolve1'),
  'Index must load the realtime calculation defense runtime with cache key.'
);
assert(
  index.indexOf('engineering-pump-edit-fast-lane.js?v=20260621-pump-edit-fast-lane5')
    < index.indexOf('engineering-realtime-calculation-defense.js?v=20260621-manual-npshr-autosolve1'),
  'Pump edit fast lane must load before realtime calculation defense.'
);
assert(
  manifest.includes('Realtime calculation defense cache key: engineering-realtime-calculation-defense.js?v=20260621-manual-npshr-autosolve1'),
  'Manifest must document the realtime calculation defense cache key.'
);
assert(
  index.includes('engineering-parameter-task-runtime.js?v=20260621-parameter-route-full-width3'),
  'Index must load the Parameter Task runtime with the refresh-capable cache key.'
);
assert(
  manifest.includes('Parameter Task runtime cache key: engineering-parameter-task-runtime.js?v=20260621-parameter-route-full-width3'),
  'Manifest must document the Parameter Task runtime cache key.'
);

console.log('Realtime calculation defense validation passed.');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
