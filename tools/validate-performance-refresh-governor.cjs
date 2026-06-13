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

assert.equal(governor.version, '2026.06-performance-refresh-governor2', 'Governor must expose the locked runtime version.');
assert.equal(governor.cacheKey, '20260613-refresh-governor2', 'Governor must expose the cache key used by index.html.');
assert.equal(typeof governor.schedule, 'function', 'Governor must expose schedule().');
assert.equal(typeof governor.flush, 'function', 'Governor must expose flush().');
assert.equal(typeof governor.patch, 'function', 'Governor must expose patch().');
assert.equal(typeof governor.scheduleEnhance, 'function', 'Governor must expose scheduleEnhance().');
assert.equal(typeof governor.traceSignature, 'function', 'Governor must expose traceSignature().');

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
  index.includes('engineering-route-trace-audit.js?v=20260607-snk-boundary-mode-lock8')
    && index.includes('engineering-performance-refresh-governor.js?v=20260613-refresh-governor2')
    && index.includes('engineering-realtime-calculation-defense.js?v=20260613-realtime-global6'),
  'index.html must load route audit, governor, then realtime defense.'
);
assert(index.includes('engineering-bilingual-improvements.js?v=20260613-bilingual-autosolve2'), 'index.html must cache-bust the duplicate-autosolve-safe bilingual runtime.');
assert(bilingualSource.includes('__NPSH_USE_LEGACY_BILINGUAL_AUTOSOLVE__ !== true'), 'Bilingual legacy autosolve bridge must be opt-in so realtime defense remains the only default autosolve owner.');
assert(bilingualSource.includes('disabled-by-realtime-defense'), 'Bilingual runtime must mark the legacy autosolve bridge as disabled by realtime defense.');
assert(
  index.indexOf('engineering-route-trace-audit.js?v=20260607-snk-boundary-mode-lock8')
    < index.indexOf('engineering-performance-refresh-governor.js?v=20260613-refresh-governor2')
    && index.indexOf('engineering-performance-refresh-governor.js?v=20260613-refresh-governor2')
      < index.indexOf('engineering-realtime-calculation-defense.js?v=20260613-realtime-global6'),
  'Performance Refresh Governor must load before realtime defense starts scheduling linked view refreshes.'
);
assert.equal(
  packageJson.scripts?.['validate:performance-refresh-governor'],
  'node tools/validate-performance-refresh-governor.cjs',
  'package.json must expose validate:performance-refresh-governor.'
);
assert(manifest.includes('engineering-performance-refresh-governor.js'), 'FILE_MANIFEST must mention the Performance Refresh Governor runtime.');
assert(manifest.includes('Performance refresh governor cache key: engineering-performance-refresh-governor.js?v=20260613-refresh-governor2'), 'FILE_MANIFEST must document the governor cache key.');
assert(manifest.includes('Performance refresh governor validation: npm run validate:performance-refresh-governor'), 'FILE_MANIFEST must document the governor validator.');

console.log('Performance Refresh Governor validation passed.');
