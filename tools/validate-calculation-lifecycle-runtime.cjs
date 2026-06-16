const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const RUNTIME_FILE = path.join(FRONTEND_ROOT, 'engineering-calculation-lifecycle-runtime.js');
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
const runtime = require(RUNTIME_FILE);

assert.strictEqual(runtime.version, 'engineering-calculation-lifecycle.v1');
assert.strictEqual(runtime.cacheKey, '20260617-calculation-lifecycle-realtime1');
assert.strictEqual(runtime.eventName, 'npsh:calculation-lifecycle');
assert.strictEqual(typeof runtime.publish, 'function', 'Lifecycle runtime must expose publish().');
assert.strictEqual(typeof runtime.current, 'function', 'Lifecycle runtime must expose current().');
assert.strictEqual(typeof runtime.statusDefaults, 'function', 'Lifecycle runtime must expose statusDefaults().');
assert.strictEqual(typeof runtime.markCalculationActivity, 'function', 'Lifecycle runtime must expose markCalculationActivity().');
assert.strictEqual(typeof runtime.hasRecentCalculationActivity, 'function', 'Lifecycle runtime must expose recent activity guard for evidence refresh.');
assert.strictEqual(typeof runtime.currentCalculationMode, 'function', 'Lifecycle runtime must expose currentCalculationMode().');

assert.strictEqual(
  packageJson.scripts?.['validate:calculation-lifecycle'],
  'node tools/validate-calculation-lifecycle-runtime.cjs',
  'package.json must expose the calculation lifecycle validator.'
);

assert(
  indexHtml.includes('engineering-pump-edit-fast-lane.js?v=20260614-pump-edit-fast-lane2')
    && indexHtml.includes('engineering-realtime-calculation-defense.js?v=20260617-realtime-first1')
    && indexHtml.includes('engineering-calculation-lifecycle-runtime.js?v=20260617-calculation-lifecycle-realtime1')
    && indexHtml.includes('engineering-calculation-progress-overlay.js?v=20260617-calculation-progress-realtime1'),
  'index.html must load pump fast lane, realtime defense, lifecycle runtime, then progress overlay.'
);
assert(
  indexHtml.indexOf('engineering-pump-edit-fast-lane.js?v=20260614-pump-edit-fast-lane2')
    < indexHtml.indexOf('engineering-realtime-calculation-defense.js?v=20260617-realtime-first1')
    && indexHtml.indexOf('engineering-realtime-calculation-defense.js?v=20260617-realtime-first1')
      < indexHtml.indexOf('engineering-calculation-lifecycle-runtime.js?v=20260617-calculation-lifecycle-realtime1')
    && indexHtml.indexOf('engineering-calculation-lifecycle-runtime.js?v=20260617-calculation-lifecycle-realtime1')
      < indexHtml.indexOf('engineering-calculation-progress-overlay.js?v=20260617-calculation-progress-realtime1'),
  'Pump fast lane, realtime defense, lifecycle runtime, and progress overlay must load in dependency order.'
);

[
  'input-changed',
  'preparing',
  'waiting-debounce',
  'calculating',
  'applying-results',
  'refreshing-evidence',
  'current',
  'failed'
].forEach((status) => {
  const defaults = runtime.statusDefaults(status);
  assert(defaults.phase, `${status} must map to a lifecycle phase.`);
  assert(defaults.task, `${status} must map to a task label.`);
  assert(defaults.message, `${status} must map to a message.`);
  assert(runtimeSource.includes(status), `Runtime source must contain status ${status}.`);
});

[
  'npsh:calculation-stale',
  'npsh:realtime-autosolve-scheduled',
  'npsh:calculation-calculating',
  'npsh:realtime-autosolve-start',
  'npsh:calculation-applying-results',
  'npsh:linked-views-refreshed',
  'npsh:calculation-current',
  'npsh:realtime-autosolve-complete',
  'npsh:realtime-autosolve-error'
].forEach((eventName) => {
  assert(runtimeSource.includes(eventName), `Lifecycle runtime must listen to ${eventName}.`);
});

assert(runtimeSource.includes('lastCalculationActivityAt'), 'Lifecycle runtime must track real calculation activity.');
assert(runtimeSource.includes('__engineeringCalculationUserIntentAt'), 'Lifecycle runtime must share user calculation intent with realtime/overlay guards.');
assert(runtimeSource.includes('hasRecentCalculationActivity'), 'Lifecycle runtime must guard evidence refresh events.');
assert(runtimeSource.includes('SAMPLE_CASE_OPEN_SELECTOR'), 'Lifecycle runtime must distinguish Open Sample Case clicks from sample-menu browsing.');
assert(runtimeSource.includes('SAMPLE_CASE_BROWSE_SELECTOR'), 'Lifecycle runtime must show only Reading inputs for Simulation Case parent-menu browsing.');
assert(runtimeSource.includes('USER_CALCULATION_INTENT_SELECTOR'), 'Lifecycle runtime must only unlock calculation progress from explicit user intent.');
assert(runtimeSource.includes('sample-case-open'), 'Lifecycle runtime must record selected sample case open intent.');
assert(runtimeSource.includes('menu-browse'), 'Lifecycle runtime must track menu-browse mode separately from calculation modes.');
assert(runtimeSource.includes('sample-open'), 'Lifecycle runtime must track sample-open mode separately from manual solve.');
assert(runtimeSource.includes('manual-solve'), 'Lifecycle runtime must track manual-solve mode for full evidence refresh.');
assert(runtimeSource.includes('Validate / Refresh Evidence started.'), 'Lifecycle manual command copy must describe validation/evidence refresh, not primary solving.');
assert(runtimeSource.includes('Realtime results are already primary'), 'Lifecycle manual command message must declare realtime autosolve as primary.');
assert(runtimeSource.includes("isAllowedCalculationMode(['sample-open', 'manual-solve', 'realtime-input'])"), 'Bootstrap calculating/applying events must be suppressed unless calculation mode allows solving.');
assert(runtimeSource.includes("isAllowedCalculationMode(['manual-solve'])"), 'Orphan linked-view refreshes must only show Refreshing evidence during manual Solve.');

assert(runtimeSource.includes('#btn-solve'), 'Lifecycle runtime must observe ribbon Run command.');
assert(runtimeSource.includes('#menu-run-solve'), 'Lifecycle runtime must observe Tools Run command.');
assert(runtimeSource.includes('#menu-refresh-calculations'), 'Lifecycle runtime must observe Refresh Calculations command.');

const published = runtime.publish('waiting-debounce', { nodeId: 'PIPE-2', delayMs: 650, reason: 'test' });
assert.strictEqual(published.status, 'waiting-debounce');
assert.strictEqual(published.phase, 'inputs');
assert.strictEqual(published.nodeId, 'PIPE-2');
assert.strictEqual(published.delayMs, 650);
assert.strictEqual(runtime.current().status, 'waiting-debounce');
runtime.markCalculationActivity('simulation-menu-browse', { calculationMode: 'menu-browse', caseId: 'simulation-case-1' });
assert.strictEqual(runtime.currentCalculationMode(), 'menu-browse');
runtime.markCalculationActivity('sample-case-open', { calculationMode: 'sample-open', caseId: 'simulation-case-1' });
assert.strictEqual(runtime.currentCalculationMode(), 'sample-open');
runtime.markCalculationActivity('manual-command', { calculationMode: 'manual-solve', nodeId: 'btn-solve' });
assert.strictEqual(runtime.currentCalculationMode(), 'manual-solve');

const forbiddenPatterns = [
  /\bglobalModel\s*=/,
  /\b__npshGlobalModel\s*=/,
  /\bresults\s*=/,
  /\.results\s*=/,
  /\bcalculationTrace\s*=/,
  /\.calculationTrace\s*=/,
  /\bupdateSimulation\s*=/,
  /\brunBackendSimulationShadow\s*=/,
  /\bapplyBackendSimulationPrimaryResults\s*=/,
  /\bcalculatePumpSystemHead\b/,
  /\bcalculateDarcy\b/,
  /\bcalculateReynolds\b/
];
for (const pattern of forbiddenPatterns) {
  assert(!pattern.test(runtimeSource), `Lifecycle runtime must not mutate calculation systems or include formula logic: ${pattern}`);
}

if (manifest) {
  assert(manifest.includes('engineering-calculation-lifecycle-runtime.js'), 'FILE_MANIFEST must mention the calculation lifecycle runtime.');
  assert(manifest.includes('20260617-calculation-lifecycle-realtime1'), 'FILE_MANIFEST must mention the calculation lifecycle cache key.');
  assert(manifest.includes('validate:calculation-lifecycle'), 'FILE_MANIFEST must mention the calculation lifecycle validator.');
}

console.log('Calculation lifecycle validation passed: unified status events, command/input lifecycle mapping, and no-mutation contract are locked.');
