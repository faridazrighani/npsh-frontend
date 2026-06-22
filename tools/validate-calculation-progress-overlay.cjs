const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const RUNTIME_FILE = path.join(FRONTEND_ROOT, 'engineering-calculation-progress-overlay.js');
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

assert.strictEqual(runtime.version, 'engineering-calculation-progress-overlay.v1');
assert.strictEqual(runtime.cacheKey, '20260617-calculation-progress-manual-only1');
assert.strictEqual(runtime.showDelayMs, 90, 'Overlay must use a short delay so visible calculations are not missed.');
assert.strictEqual(runtime.currentHideDelayMs, 520, 'Overlay must auto-hide shortly after Current state.');
assert.strictEqual(runtime.errorHideDelayMs, 3200, 'Error state must not remain permanently blocking.');
assert.strictEqual(runtime.commandFallbackHideMs, 8000, 'Manual run command fallback must prevent a stuck overlay if no completion event arrives.');

assert.strictEqual(
  packageJson.scripts?.['validate:calculation-progress-overlay'],
  'node tools/validate-calculation-progress-overlay.cjs',
  'package.json must expose the calculation progress overlay validator.'
);
assert.strictEqual(
  packageJson.scripts?.['test:e2e:calculation-progress-overlay'],
  'playwright test tests/e2e/calculation-progress-overlay.spec.cjs',
  'package.json must expose the calculation progress overlay E2E.'
);

assert(
  indexHtml.includes('engineering-pump-edit-fast-lane.js?v=20260621-pump-edit-fast-lane5')
    && indexHtml.includes('engineering-realtime-calculation-defense.js?v=20260622-route-only-manual-npshr1')
    && indexHtml.includes('engineering-calculation-lifecycle-runtime.js?v=20260618-calculation-lifecycle-refresh-release1')
    && indexHtml.includes('engineering-calculation-progress-overlay.js?v=20260617-calculation-progress-manual-only1'),
  'index.html must load pump fast lane, realtime defense, lifecycle runtime, and progress overlay.'
);
assert(
  indexHtml.indexOf('engineering-pump-edit-fast-lane.js?v=20260621-pump-edit-fast-lane5')
    < indexHtml.indexOf('engineering-realtime-calculation-defense.js?v=20260622-route-only-manual-npshr1')
    && indexHtml.indexOf('engineering-realtime-calculation-defense.js?v=20260622-route-only-manual-npshr1')
      < indexHtml.indexOf('engineering-calculation-lifecycle-runtime.js?v=20260618-calculation-lifecycle-refresh-release1')
    && indexHtml.indexOf('engineering-calculation-lifecycle-runtime.js?v=20260618-calculation-lifecycle-refresh-release1')
      < indexHtml.indexOf('engineering-calculation-progress-overlay.js?v=20260617-calculation-progress-manual-only1'),
  'Pump fast lane, realtime defense, lifecycle runtime, and overlay runtime must be loaded in dependency order.'
);

[
  'npsh:calculation-lifecycle',
  'npsh:calculation-calculating',
  'npsh:realtime-autosolve-start',
  'npsh:calculation-current',
  'npsh:calculation-stale',
  'npsh:linked-views-refreshed',
  'npsh:realtime-autosolve-complete',
  'npsh:realtime-autosolve-error'
].forEach((eventName) => {
  assert(runtimeSource.includes(eventName), `Runtime must listen to ${eventName}.`);
});

assert(runtimeSource.includes('Calculation in Progress'), 'Overlay must expose the academic calculation-progress title.');
assert(runtimeSource.includes('Solving hydraulic network'), 'Overlay must expose the hydraulic-network task text.');
assert(runtimeSource.includes('Reading inputs'), 'Overlay must include compact input-reading step.');
assert(runtimeSource.includes('Solving network'), 'Overlay must include compact network-solving step.');
assert(runtimeSource.includes('Updating results'), 'Overlay must include compact results-refresh step.');
assert(runtimeSource.includes('Refreshing evidence'), 'Overlay must include compact evidence-refresh step.');
assert(runtimeSource.includes('Last valid result is still shown.'), 'Overlay must explain failed-calculation fallback behavior.');
assert(runtimeSource.includes('pointer-events: none'), 'Overlay must be non-blocking for audit-safe UI behavior.');
assert(runtimeSource.includes('#btn-solve'), 'Overlay must show for the ribbon Run command.');
assert(runtimeSource.includes('#menu-run-solve'), 'Overlay must show for the Tools Run command.');
assert(runtimeSource.includes('#menu-refresh-calculations'), 'Overlay must show for the Refresh Calculations command.');
assert(runtimeSource.includes("document.addEventListener('click', handleRunCommand, true)"), 'Overlay must observe manual run commands in capture phase.');
assert(runtimeSource.includes("document.addEventListener(LIFECYCLE_EVENT, handleLifecycle)"), 'Overlay must observe lifecycle status events.');
assert(runtimeSource.includes('ignoreEvidenceUntil'), 'Overlay must ignore late evidence-refresh events briefly after Current.');
assert(runtimeSource.includes('Date.now() < ignoreEvidenceUntil'), 'Both lifecycle and legacy evidence paths must honor the post-Current ignore window.');
assert(runtimeSource.includes("state !== 'calculating' && state !== 'refreshing'"), 'Orphan linked-view refreshes must not show the overlay while the sample-case chooser is idle.');
assert(runtimeSource.includes('hasRecentCalculationIntent'), 'Raw calculating/autosolve events must be gated by explicit user calculation intent.');
assert(runtimeSource.includes('isRealtimeInputMode'), 'Overlay runtime must identify realtime input mode.');
assert(runtimeSource.includes('if (isRealtimeInputMode(detail)) return hideOverlay();'), 'Realtime input autosolve must not show the progress overlay.');
assert(runtimeSource.includes('SAMPLE_CASE_OPEN_SELECTOR'), 'Overlay must record Open Sample Case clicks without treating sample-menu browsing as calculation progress.');
assert(runtimeSource.includes('SAMPLE_CASE_BROWSE_SELECTOR'), 'Overlay must show only Reading inputs when browsing Simulation Case parent menus.');
assert(runtimeSource.includes('sample-case-open'), 'Overlay must share selected sample case intent with realtime/lifecycle guards.');
assert(runtimeSource.includes('menu-browse'), 'Overlay must track menu-browse mode separately.');
assert(runtimeSource.includes('sample-open'), 'Overlay must track sample-open mode separately.');
assert(runtimeSource.includes('manual-solve'), 'Overlay must track manual-solve mode separately.');
assert(runtimeSource.includes('Validate / Refresh Evidence started.'), 'Overlay manual command copy must describe validation/evidence refresh, not primary solving.');
assert(runtimeSource.includes('hasRecentCalculationActivity'), 'Linked-view refreshes must be guarded by recent calculation activity.');
assert(
  runtimeSource.includes("setAttribute('role', 'status')")
    || runtimeSource.includes('setAttribute("role", "status")'),
  'Overlay must be announced as a status region.'
);

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
  assert(!pattern.test(runtimeSource), `Overlay runtime must not mutate calculation systems or include formula logic: ${pattern}`);
}

assert.strictEqual(
  runtime.currentTaskFromDetail({ reason: 'PIPE-2 diameter changed' }),
  'Recalculating pipe losses',
  'Pipe edits must produce pipe-loss task text.'
);
assert.strictEqual(
  runtime.currentTaskFromDetail({ reason: 'density and vapor pressure changed' }),
  'Updating fluid properties',
  'Fluid Basis edits must produce fluid task text.'
);
assert.strictEqual(
  runtime.currentTaskFromDetail({ reason: 'Pump curve NPSHr changed' }),
  'Updating pump NPSH and performance',
  'Pump edits must produce pump task text.'
);
assert.strictEqual(
  runtime.currentTaskFromDetail({ reason: 'Backend recalculation in progress.' }),
  'Solving hydraulic network',
  'Generic calculation events must produce the hydraulic-network task text.'
);
assert.deepStrictEqual(
  runtime.stepRows('solving').map((step) => step.status),
  ['done', 'active', 'pending', 'pending'],
  'Solving phase must show Reading inputs done and Solving network active.'
);
assert.deepStrictEqual(
  runtime.stepRows('inputs', 'menu-browse').map((step) => step.label),
  ['Reading inputs'],
  'Menu browse phase must show only Reading inputs.'
);
assert.deepStrictEqual(
  runtime.stepRows('results', 'sample-open').map((step) => step.label),
  ['Reading inputs', 'Solving network', 'Updating results'],
  'Open Sample Case must stop at Updating results and must not include Refreshing evidence.'
);
assert.deepStrictEqual(
  runtime.stepRows('evidence').map((step) => step.status),
  ['done', 'done', 'done', 'active'],
  'Evidence phase must show Refreshing evidence active.'
);
assert(runtimeSource.includes("detail.status === 'refreshing-evidence' || phase === 'evidence'"), 'Evidence refresh lifecycle must auto-hide even when no later Current event arrives.');
assert(runtimeSource.includes("mode === 'manual-solve' && (detail.status === 'applying-results' || phase === 'results')"), 'Manual Solve applying-results must auto-hide through the evidence step if no later Current event arrives.');
assert(runtimeSource.includes("!isManualSolveMode(latestDetail)") && runtimeSource.includes("calculationMode: 'manual-solve'"), 'Linked-view evidence refresh must only render during manual Solve mode.');
assert(runtimeSource.includes("showEvidence: false"), 'Sample-open and menu-browse hide paths must not turn Current into Refreshing evidence.');
const scheduleShowSource = runtimeSource.slice(
  runtimeSource.indexOf('function scheduleShow'),
  runtimeSource.indexOf('function showImmediate')
);
const showImmediateSource = runtimeSource.slice(
  runtimeSource.indexOf('function showImmediate'),
  runtimeSource.indexOf('function hasRecentCalculationIntent')
);
assert(!scheduleShowSource.includes('commandFallbackTimer = clearTimer(commandFallbackTimer);'), 'Scheduled progress events must not clear the manual Solve fallback timer.');
assert(!showImmediateSource.includes('commandFallbackTimer = clearTimer(commandFallbackTimer);'), 'Immediate progress events must not clear the manual Solve fallback timer.');

if (manifest) {
  assert(manifest.includes('engineering-calculation-progress-overlay.js'), 'FILE_MANIFEST must mention the calculation progress overlay runtime.');
  assert(manifest.includes('20260617-calculation-progress-manual-only1'), 'FILE_MANIFEST must mention the calculation progress overlay cache key.');
  assert(manifest.includes('validate:calculation-progress-overlay'), 'FILE_MANIFEST must mention the calculation progress overlay validator.');
}

console.log('Calculation progress overlay validation passed: isolated compact UI, realtime event handling, auto-hide, and audit-safe no-mutation contract are locked.');
