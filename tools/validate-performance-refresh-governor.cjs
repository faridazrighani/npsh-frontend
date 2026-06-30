const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-performance-refresh-governor.js');
const bilingualPath = path.join(rootDir, 'engineering-bilingual-improvements.js');
const indexPath = path.join(rootDir, 'index.html');
const packagePath = path.join(rootDir, 'package.json');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');

const source = fs.readFileSync(runtimePath, 'utf8');
const bilingualSource = fs.readFileSync(bilingualPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const manifest = fs.readFileSync(manifestPath, 'utf8');

globalThis.document = undefined;
const governor = require(runtimePath);

assert.equal(governor.version, '2026.06-performance-refresh-governor5-head-power-audit', 'Governor must expose the locked runtime version.');
assert.equal(governor.cacheKey, '20260629-live-evidence1', 'Governor must expose the cache key used by index.html.');
assert.equal(typeof governor.schedule, 'function', 'Governor must expose schedule().');
assert.equal(typeof governor.flush, 'function', 'Governor must expose flush().');
assert.equal(typeof governor.patch, 'function', 'Governor must expose patch().');
assert.equal(typeof governor.scheduleEnhance, 'function', 'Governor must expose scheduleEnhance().');
assert.equal(typeof governor.traceSignature, 'function', 'Governor must expose traceSignature().');
assert.equal(typeof governor.buildPumpDependencyContract, 'function', 'Governor must expose the pump dependency contract builder.');
assert.equal(typeof governor.relatedNodeIds, 'function', 'Governor must expose related-node scoping for validation.');

globalThis.globalModel = {
  FLUID: { type: 'fluid', props: { density: 998, viscosity: 1, vaporPressure: 0.023 } },
  'SRC-100': { type: 'source', props: { pressure: 1.8, pressureInputBasis: 'Absolute', elevation: 10 } },
  'PIPE-1': { type: 'pipe', props: { segments: [{ length: 20, diameter: 0.1 }] }, results: { totalK: 1.2, totalHeadLoss: 2.6, majorHeadLoss: 1.1, minorHeadLoss: 1.5 } },
  'P-100': {
    type: 'pump',
    props: { suctionElevation: -0.5, designFlow: 50, designHead: 24, designNpshr: 2.4, curveDataSource: 'Manual' },
    results: { npshEvaluation: { flow: 50, pumpHead: 24, npsha: 6.46, npshr: 2.4, suctionLoss: 2.6, dischargeLoss: 11.7 } }
  },
  'PIPE-2': { type: 'pipe', props: { segments: [{ length: 40, diameter: 0.08 }] }, results: { totalK: 18, totalHeadLoss: 11.7, majorHeadLoss: 1.7, minorHeadLoss: 10 } },
  'SNK-100': { type: 'sink', props: { demandFlow: 50, elevation: 29.085, pressure: 1.744 } },
  'PIPE-99': { type: 'pipe', props: { segments: [{ length: 999, diameter: 0.5 }] }, results: { totalHeadLoss: 99 } },
};
globalThis.connections = [
  { from: 'SRC-100', to: 'P-100', pipeId: 'PIPE-1' },
  { from: 'P-100', to: 'SNK-100', pipeId: 'PIPE-2' },
];

const pumpContract = governor.buildPumpDependencyContract('P-100');
assert.equal(pumpContract.schemaVersion, 'pump-dependency-contract.v1', 'Pump contract must expose its schema.');
assert.equal(pumpContract.dependencyIds.source, 'SRC-100', 'Pump contract must link to the upstream SRC.');
assert.equal(pumpContract.dependencyIds.suctionPfv, 'PIPE-1', 'Pump contract must link to the suction PFV only.');
assert.equal(pumpContract.dependencyIds.dischargePfv, 'PIPE-2', 'Pump contract must link to the discharge PFV only.');
assert.equal(pumpContract.dependencyIds.sink, 'SNK-100', 'Pump contract must link to the downstream SNK.');
assert.equal(pumpContract.suctionPfv.totalLoss, 2.6, 'Pump contract must carry suction PFV total head loss.');
assert.equal(pumpContract.dischargePfv.totalLoss, 11.7, 'Pump contract must carry discharge PFV total head loss.');
assert.equal(pumpContract.npshEvaluation.npsha, 6.46, 'Pump contract must carry Pump Object NPSHa.');
assert(!stableStringifyForTest(pumpContract).includes('PIPE-99'), 'Pump contract must not touch unrelated pipes.');

const pipeRelated = governor.relatedNodeIds('PIPE-1');
assert(pipeRelated.has('P-100'), 'Suction PFV changes must relate to the pump using that PFV.');
assert(pipeRelated.has('PIPE-2'), 'Suction PFV relation should include the paired discharge PFV for the pump route contract.');
assert(!pipeRelated.has('PIPE-99'), 'Suction PFV changes must not relate to unrelated pipe objects.');

function stableStringifyForTest(value) {
  return JSON.stringify(value);
}

let ran = 0;
governor.schedule('unit-test', 'P-100', {
  delayMs: 1,
  run: () => {
    ran += 1;
    return ran;
  }
});
governor.schedule('unit-test', 'P-100', {
  delayMs: 1,
  run: () => {
    ran += 1;
    return ran;
  }
});
governor.flush();
assert.equal(ran, 1, 'Governor must coalesce duplicate refresh jobs into one run.');

[
  'refreshOpenRealtimeSecondaryTaskWindows',
  'refreshPipeFormulaDefenseWindowContent',
  'refreshPumpFormulaDefenseWindowContent',
  'updatePumpChart',
  'EngineeringFormulaDefenseUI'
].forEach((token) => {
  assert(source.includes(token), `Governor must patch or coordinate ${token}.`);
});

assert(source.includes('DEFAULT_DELAY_MS = 300'), 'Governor must debounce UI refreshes around 300 ms to keep input typing responsive.');
assert(source.includes('!getVisibleSecondaryWindows(nodeId).length'), 'Governor must skip full-document formula enhancement when no secondary defense window is visible.');
assert(source.includes('shouldSkipWindowBySignature'), 'Governor must skip formula defense rebuilds when signatures are unchanged.');
assert(source.includes('traceSignature'), 'Governor must compute trace signatures for formula defense windows.');
assert(source.includes('buildPumpDependencyContract'), 'Governor must sign Pump windows from the narrow pump dependency contract.');
assert(source.includes('findPumpDependencyIds'), 'Governor must discover pump dependencies from the hydraulic route.');
assert(source.includes('hasVisiblePumpChart'), 'Governor must skip Pump Chart work when no visible chart is present.');
assert(source.includes('isVisibleElement'), 'Governor must filter hidden/minimized windows.');
assert(source.includes('nodeMatchesWindow') || source.includes('isWindowRelatedToNode'), 'Governor must scope refreshes to windows related to the changed node.');
assert(source.includes('forceImmediate'), 'Governor must preserve an immediate refresh escape hatch for explicit chart renders.');

[
  /\bglobalModel\s*=/,
  /\b__npshGlobalModel\s*=/,
  /\.results\s*=/,
  /\.calculationTrace\s*=/,
  /\bcalculatePumpSystemHead\b/,
  /\bcalculateDarcy\b/,
  /\bcalculateReynolds\b/
].forEach((pattern) => {
  assert(!pattern.test(source), `Governor must not mutate calculation data or include formula logic: ${pattern}`);
});

assert(
  index.includes('engineering-route-trace-audit.js?v=20260628-solver-canvas-layout4')
    && index.includes('engineering-performance-refresh-governor.js?v=20260629-live-evidence1')
    && index.includes('engineering-pump-edit-fast-lane.js?v=20260629-live-evidence1')
    && index.includes('engineering-realtime-calculation-defense.js?v=20260630-pipe-properties-live1'),
  'index.html must keep route audit, governor, pump edit fast lane, and realtime defense cache-busted.'
);
assert(index.includes('engineering-bilingual-improvements.js?v=20260630-valve-trace-i18n1'), 'index.html must cache-bust the realtime-first bilingual runtime.');
assert(bilingualSource.includes('__NPSH_USE_LEGACY_BILINGUAL_AUTOSOLVE__ !== true'), 'Bilingual legacy autosolve bridge must be opt-in so realtime defense remains the only default autosolve owner.');
assert(bilingualSource.includes('disabled-by-realtime-defense'), 'Bilingual runtime must mark the legacy autosolve bridge as disabled by realtime defense.');
assert(bilingualSource.includes('REALTIME_FIRST_TEXT_KEYS'), 'Bilingual runtime must prune stale i18n entries for realtime-first labels.');
assert(bilingualSource.includes('REALTIME_FIRST_LEGACY_TEXT_OVERRIDES'), 'Bilingual runtime must normalize old Solve labels to realtime-first Validate labels.');
assert(
  index.indexOf('engineering-performance-refresh-governor.js?v=20260629-live-evidence1')
      < index.indexOf('engineering-pump-edit-fast-lane.js?v=20260629-live-evidence1')
    && index.indexOf('engineering-pump-edit-fast-lane.js?v=20260629-live-evidence1')
      < index.indexOf('engineering-realtime-calculation-defense.js?v=20260630-pipe-properties-live1'),
  'Performance Refresh Governor and Pump edit fast lane must load before realtime defense starts scheduling linked view refreshes.'
);
assert(
  index.indexOf('engineering-route-trace-audit.js?v=20260628-solver-canvas-layout4')
    > index.indexOf('const diagnosticScripts = [')
    && index.indexOf('engineering-route-trace-audit.js?v=20260628-solver-canvas-layout4')
      > index.indexOf('engineering-realtime-calculation-defense.js?v=20260630-pipe-properties-live1'),
  'Route trace audit must remain deferred with diagnostic scripts so PageSpeed critical-path work stays calculation-only.'
);
assert.equal(
  packageJson.scripts?.['validate:performance-refresh-governor'],
  'node tools/validate-performance-refresh-governor.cjs',
  'package.json must expose validate:performance-refresh-governor.'
);
assert(manifest.includes('engineering-performance-refresh-governor.js'), 'FILE_MANIFEST must mention the Performance Refresh Governor runtime.');
assert(manifest.includes('Performance refresh governor cache key: engineering-performance-refresh-governor.js?v=20260629-live-evidence1'), 'FILE_MANIFEST must document the governor cache key.');
assert(manifest.includes('Performance refresh governor validation: npm run validate:performance-refresh-governor'), 'FILE_MANIFEST must document the governor validator.');

console.log('Performance Refresh Governor validation passed.');
