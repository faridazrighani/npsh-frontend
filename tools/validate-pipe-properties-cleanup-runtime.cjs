const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const RUNTIME_FILE = path.join(FRONTEND_ROOT, 'engineering-pipe-properties-cleanup-runtime.js');
const INDEX_FILE = path.join(FRONTEND_ROOT, 'index.html');
const PACKAGE_FILE = path.join(FRONTEND_ROOT, 'package.json');
const MANIFEST_FILE = path.join(FRONTEND_ROOT, 'FILE_MANIFEST.md');

function read(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, 'utf8');
}

const runtimeSource = read(RUNTIME_FILE);
const indexHtml = read(INDEX_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const manifest = fs.existsSync(MANIFEST_FILE) ? read(MANIFEST_FILE) : '';
const CLEANUP_CACHE_KEY = '20260706-pipe-hl-allow-clean1';
const CLEANUP_RUNTIME_URL = `engineering-pipe-properties-cleanup-runtime.js?v=${CLEANUP_CACHE_KEY}`;
const SEGMENTS_RUNTIME_URL = 'engineering-pipe-segments-file-runtime.js?v=20260630-pipe-properties-cleanup1';

const sandbox = {
  document: undefined,
  window: undefined,
  globalThis: undefined
};
sandbox.globalThis = sandbox;

const runtime = require(RUNTIME_FILE);

assert.strictEqual(runtime.version, 'engineering-pipe-properties-cleanup-runtime.v1');
assert.strictEqual(runtime.cacheKey, CLEANUP_CACHE_KEY);
assert.strictEqual(typeof runtime.clean, 'function', 'Cleanup runtime must expose a synchronous clean() API.');
assert.strictEqual(typeof runtime.scheduleClean, 'function', 'Cleanup runtime must expose a scheduled cleanup API.');
assert.strictEqual(typeof runtime.rememberStableState, 'function', 'Cleanup runtime must expose Pipe Properties state capture.');
assert.strictEqual(typeof runtime.restoreStableState, 'function', 'Cleanup runtime must expose Pipe Properties state restore.');
assert.deepStrictEqual(
  runtime.removedSegmentLabels,
  ['z in (m)', 'z out (m)', 'hL Allow (m)'],
  'Cleanup runtime must remove segment z and optional hL Allow columns.'
);
[
  'Pipe Routing',
  'Pipe Rating/Class',
  'End Connection Basis',
  'Elevation Profile',
  'Start Elevation Override',
  'End Elevation Override',
  'Head Loss Allowance',
  'Aging Roughness Factor'
].forEach((label) => {
  assert(runtime.removedPropertyLabels.includes(label), `Cleanup runtime must remove ${label}.`);
});
[
  'routeStyle',
  'pressureClass',
  'endConnection',
  'elevationProfileMode',
  'startElevation',
  'endElevation',
  'headLossAllowancePercent',
  'roughnessAgingFactor'
].forEach((key) => {
  assert(runtime.removedPropertyKeys.includes(key), `Cleanup runtime must remove ${key}.`);
});

assert(
  indexHtml.includes(CLEANUP_RUNTIME_URL),
  'index.html must load the Pipe Properties cleanup runtime with a fresh cache key.'
);
assert(
  indexHtml.indexOf(CLEANUP_RUNTIME_URL) < indexHtml.indexOf(SEGMENTS_RUNTIME_URL),
  'Cleanup runtime must load before Pipe Segments runtime to prevent first-paint flashes.'
);
assert(
  indexHtml.indexOf(CLEANUP_RUNTIME_URL)
    < indexHtml.indexOf('engineering-pipe-moody-chart-audit.js?v=20260707-pipe-moody-export-chart4'),
  'Cleanup runtime must load before the diagnostic Moody cleanup fallback.'
);
assert(
  packageJson.scripts?.['validate:pipe-properties-cleanup-runtime'] === 'node tools/validate-pipe-properties-cleanup-runtime.cjs',
  'package.json must expose the cleanup runtime validator.'
);
assert(runtimeSource.includes('MutationObserver'), 'Cleanup runtime must watch re-rendered Pipe Properties windows.');
assert(runtimeSource.includes('npsh:calculation-applying-results'), 'Cleanup runtime must hook calculation render phases.');
assert(runtimeSource.includes('overflow-anchor: none'), 'Cleanup runtime must disable scroll anchoring on Pipe Properties surfaces.');
assert(runtimeSource.includes('pipe-properties-cleanup-hidden'), 'Cleanup runtime must apply a hard hidden class before removal.');
if (manifest) {
  assert(manifest.includes('engineering-pipe-properties-cleanup-runtime.js'), 'FILE_MANIFEST must mention the cleanup runtime.');
  assert(manifest.includes(CLEANUP_CACHE_KEY), 'FILE_MANIFEST must mention the cleanup runtime cache key.');
}

console.log('Pipe Properties cleanup runtime validation passed: early load, removed fields, segment z/hL Allow columns, and scroll stability hooks are locked.');
