const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const runtimePath = path.join(repoRoot, 'engineering-simulation-load-transaction-manager.js');
const indexPath = path.join(repoRoot, 'index.html');
const packagePath = path.join(repoRoot, 'package.json');
const manifestPath = path.join(repoRoot, 'FILE_MANIFEST.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} is missing: ${needle}`);
}

const runtimeSource = read(runtimePath);
const indexSource = read(indexPath);
const packageJson = JSON.parse(read(packagePath));
const manifestSource = read(manifestPath);

[
  'engineering-simulation-load-transaction-manager.v1',
  '20260707-simulation-load-transaction1',
  'AbortController',
  'beginTransaction',
  'abortPrevious',
  'registerCleanup',
  'registerController',
  'prefetchSimulationCases',
  'cleanWorkspaceForLoad',
  'input[type="file"]',
  '[data-simulation-case-action="open"][data-simulation-case-id]',
  'X-NPSH-Load-Session',
  'npsh:simulation-load-transaction-begin',
  'npsh:simulation-load-transaction-stale-result',
  'patchFetch',
  'patchFileArrayBuffer',
  'patchResponseBodyMethod',
  'applySimulationStateAtomic',
  'openSimulationCaseSample',
  'simulation-case-6'
].forEach((needle) => assertIncludes(runtimeSource, needle, 'runtime'));

assertIncludes(
  indexSource,
  'engineering-simulation-load-transaction-manager.js?v=20260707-simulation-load-transaction1',
  'index.html'
);

const appIndex = indexSource.indexOf('app.bundle.min.js?v=20260707-pipe-canvas-loss-label1');
const managerIndex = indexSource.indexOf('engineering-simulation-load-transaction-manager.js?v=20260707-simulation-load-transaction1');
const readinessIndex = indexSource.indexOf('engineering-open-file-readiness-gate.js?v=20260707-open-file-readiness-gate7');
assert(appIndex >= 0 && managerIndex > appIndex, 'simulation load transaction manager must load after app.bundle.min.js');
assert(readinessIndex > managerIndex, 'open-file readiness gate must load after simulation load transaction manager');

assert(
  packageJson.scripts?.['validate:simulation-load-transaction-manager'] === 'node tools/validate-simulation-load-transaction-manager.cjs',
  'package.json script validate:simulation-load-transaction-manager is missing'
);

assertIncludes(manifestSource, 'engineering-simulation-load-transaction-manager.js', 'FILE_MANIFEST.md');
assertIncludes(manifestSource, 'Simulation load transaction manager cache key', 'FILE_MANIFEST.md');

const runtime = require(runtimePath);
assert(runtime.version === 'engineering-simulation-load-transaction-manager.v1', 'runtime version mismatch');
assert(runtime.cacheKey === '20260707-simulation-load-transaction1', 'runtime cache key mismatch');
[
  'install',
  'beginTransaction',
  'abortPrevious',
  'registerCleanup',
  'registerController',
  'isCurrent',
  'current',
  'complete',
  'fail',
  'warmRuntime',
  'prefetchSimulationCases',
  'cleanWorkspaceForLoad'
].forEach((name) => assert(typeof runtime[name] === 'function', `runtime API missing ${name}`));

let aborted = false;
let cleaned = false;
const first = runtime.beginTransaction('validator-first', { caseId: 'simulation-case-4' });
runtime.registerController({ abort: () => { aborted = true; } }, 'validator-controller');
runtime.registerCleanup(() => { cleaned = true; }, 'validator-cleanup');
assert(runtime.isCurrent(first.sessionId), 'first transaction should be current before supersede');

const second = runtime.beginTransaction('validator-second', { caseId: 'simulation-case-6' });
assert(aborted, 'previous controller was not aborted');
assert(cleaned, 'previous cleanup callback was not called');
assert(!runtime.isCurrent(first.sessionId), 'first transaction should not be current after supersede');
assert(runtime.isCurrent(second.sessionId), 'second transaction should be current');
assert(runtime.complete(second.sessionId, { reason: 'validator-complete' }), 'second transaction did not complete');
assert(runtime.current().status === 'completed', 'completed transaction status not reflected');
runtime.abortPrevious('validator-finish');

console.log('Simulation load transaction manager validation passed.');
