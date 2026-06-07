const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-realtime-calculation-defense.js');
const indexPath = path.join(rootDir, 'index.html');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');

globalThis.__npshGlobalModel = {
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

const runtime = require(runtimePath);
assert.equal(runtime.version, 'engineering-realtime-calculation-defense.v2', 'Realtime defense runtime should expose v2.');

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
assert.equal(pumpChartRefreshes, 1, 'Chart refresh should be requested after stale marking.');

const sinkState = runtime.markStale('SNK-100', 'Sink boundary mode changed.');
const sinkResults = globalThis.__npshGlobalModel['SNK-100'].results;
assert.deepEqual(new Set(sinkState.nodeIds), new Set(['SNK-100', 'P-100']), 'A changed SNK boundary should mark both the SNK and dependent pump calculation stale.');
assert.equal(sinkResults.calculationFreshness, 'Stale', 'Sink results should be marked stale immediately after boundary mode change.');
assert.equal(results.calculationFreshness, 'Stale', 'Dependent pump calculation should remain stale after SNK boundary mode change.');
assert.equal(results.actionReadinessBackend.stale, true, 'Pump action readiness should not remain Current after SNK boundary mode change.');
assert.equal(pumpChartRefreshes, 2, 'Chart refresh should also be requested after dependent SNK stale marking.');

const current = runtime.markCurrentFromBackend({
  calculationId: 'calc-1',
  dependencyManifest: { dependencyFingerprint: 'dep-1' }
});
assert.equal(current.status, 'Current', 'Backend refresh state should mark realtime defense current.');
assert.equal(current.dependencyFingerprint, 'dep-1', 'Backend dependency fingerprint should be retained.');

runtime.install();
const calculating = runtime.markCalculating('P-100', 'Backend unit test recalculation.');
assert.equal(calculating.status, 'Calculating', 'markCalculating should expose backend refresh in progress.');
assert.equal(results.calculationFreshness, 'Calculating', 'Pump results should be marked calculating during backend refresh.');
assert.equal(results.backendValidationStatus, 'Calculating', 'Backend validation status should show calculating while the request is pending.');
assert.equal(results.routeTrace.lossFreshness, 'Calculating - backend refresh in progress', 'Route trace freshness should show pending backend refresh.');

globalThis.runBackendSimulationShadow('P-100');
assert.equal(backendRefreshes, 1, 'Wrapped backend refresh should still call the original backend runner.');
assert.equal(
  globalThis.__engineeringCalculationDefenseRealtimeState.status,
  'Calculating',
  'Wrapped backend runner should mark realtime state calculating before fetch.'
);

globalThis.applyBackendSimulationPrimaryResults(globalThis.__npshGlobalModel['P-100'], { flow: 50 }, {
  calculationAudit: { calculationId: 'calc-2' },
  dependencyManifest: { dependencyFingerprint: 'dep-2' },
  calculationDefenseContract: { status: 'Ready' }
});
assert.equal(globalThis.__engineeringCalculationDefenseRealtimeState.calculationId, 'calc-2', 'Wrapped backend apply should retain calculation id.');
assert.equal(globalThis.__engineeringCalculationDefenseRealtimeState.dependencyFingerprint, 'dep-2', 'Wrapped backend apply should retain dependency fingerprint.');
assert.equal(globalThis.__engineeringCalculationDefenseRealtimeState.calculationDefenseStatus, 'Ready', 'Wrapped backend apply should retain calculation defense status.');

const index = fs.readFileSync(indexPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');
assert(
  index.includes('engineering-realtime-calculation-defense.js?v=20260607-realtime-defense2'),
  'Index must load the realtime calculation defense runtime with cache key.'
);
assert(
  manifest.includes('Realtime calculation defense cache key: engineering-realtime-calculation-defense.js?v=20260607-realtime-defense2'),
  'Manifest must document the realtime calculation defense cache key.'
);

console.log('Realtime calculation defense validation passed.');
