const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-open-file-readiness-gate.js');
const indexPath = path.join(rootDir, 'index.html');
const packagePath = path.join(rootDir, 'package.json');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');
const uploadReadinessPath = path.join(rootDir, 'UPLOAD_READINESS.md');

function read(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, 'utf8');
}

const runtimeSource = read(runtimePath);
const indexHtml = read(indexPath);
const packageJson = JSON.parse(read(packagePath));
const manifest = fs.existsSync(manifestPath) ? read(manifestPath) : '';
const uploadReadiness = fs.existsSync(uploadReadinessPath) ? read(uploadReadinessPath) : '';
const runtime = require(runtimePath);

assert.strictEqual(runtime.version, 'engineering-open-file-readiness-gate.v7');
assert.strictEqual(runtime.cacheKey, '20260707-open-file-readiness-gate9');
assert.strictEqual(runtime.maxWaitMs, 8200, 'Open-file gate must have a bounded fallback timeout.');
assert.strictEqual(runtime.minVisibleMs, 720, 'Open-file gate should stay visible long enough to mask initial canvas churn.');
assert.strictEqual(runtime.quietMs, 180, 'Open-file gate should wait for a quiet canvas window before release.');
assert.deepStrictEqual(
  runtime.steps.map((step) => step.label),
  ['Reading file', 'Validating model', 'Solving hydraulic network', 'Updating canvas', 'Finalizing display'],
  'Open-file gate must expose the agreed professional progress sequence.'
);
assert.strictEqual(
  packageJson.scripts?.['validate:open-file-readiness-gate'],
  'node tools/validate-open-file-readiness-gate.cjs',
  'package.json must expose the open-file readiness gate validator.'
);

assert(indexHtml.includes('engineering-open-file-readiness-gate.js?v=20260707-open-file-readiness-gate9'), 'index.html must load the open-file readiness gate runtime.');
assert(
  indexHtml.indexOf('app.bundle.min.js?v=20260707-pipe-canvas-loss-label1')
    < indexHtml.indexOf('engineering-open-file-readiness-gate.js?v=20260707-open-file-readiness-gate9'),
  'Open-file gate should load after the app bundle.'
);
assert(
  indexHtml.indexOf('engineering-open-file-readiness-gate.js?v=20260707-open-file-readiness-gate9')
    < indexHtml.indexOf('engineering-model-snapshot-export-runtime.js?v=20260707-fluid-basis-workspace-snapshot11'),
  'Open-file gate should load early in the critical runtime pack.'
);

[
  'Opening Simulation',
  'Reading file',
  'Validating model',
  'Solving hydraulic network',
  'Updating canvas',
  'Finalizing display',
  'Opening completed with calculation warning'
].forEach((text) => assert(runtimeSource.includes(text), `Runtime must include "${text}".`));

assert(runtimeSource.includes("body.${ACTIVE_CLASS} #canvas"), 'Open-file gate must hide the canvas while preparing.');
assert(runtimeSource.includes('visibility: hidden !important;'), 'Preparing canvas must be hidden, not merely dimmed.');
assert(runtimeSource.includes('pointer-events: none !important;'), 'Canvas interactions must be blocked while preparing.');
assert(runtimeSource.includes('DISABLED_DURING_OPEN_SELECTOR'), 'Open-file gate must disable solve/export commands while preparing.');
assert(runtimeSource.includes("document.addEventListener('change', handleFileChange, true)"), 'Open-file gate must catch file selection in capture phase.');
assert(runtimeSource.includes('input[type="file"]'), 'Open-file gate must detect file input changes.');
assert(runtimeSource.includes('/\\.untirta$/i'), 'Open-file gate should activate only for .untirta files.');
assert(runtimeSource.includes('npsh:open-file-readiness'), 'Open-file gate must dispatch readiness lifecycle events.');
assert(runtimeSource.includes('MutationObserver'), 'Open-file gate must observe canvas mutations for readiness.');
assert(runtimeSource.includes('canvasHasLoadedModel'), 'Open-file gate must require evidence that the model reached memory/canvas.');
assert(runtimeSource.includes('canvasIsDisplayClean'), 'Open-file gate must require clean display panels before release.');
assert(runtimeSource.includes('pipeHydraulicLabelsReady'), 'Open-file gate must require pipe hydraulic parameter labels before release.');
assert(runtimeSource.includes('currentPipeHydraulicLabelsReady'), 'Open-file gate must check existing pipe labels before forcing a refresh.');
assert(runtimeSource.includes('PIPE_LABEL_REFRESH_THROTTLE_MS'), 'Open-file gate must throttle pipe-label refreshes so the quiet window can complete.');
assert(runtimeSource.includes('FINAL_CLEANUP_THROTTLE_MS'), 'Open-file gate must throttle display cleanup while waiting so the quiet window can complete.');
assert(runtimeSource.includes('STABLE_READY_EVIDENCE_MS'), 'Open-file gate must allow stable ready evidence to release despite benign canvas mutations.');
assert(runtimeSource.includes('firstReadyEvidenceAt'), 'Open-file gate must track sustained clean readiness before release.');
assert(runtimeSource.includes('POST_CLEANUP_READY_MS'), 'Open-file gate must verify display readiness after forced cleanup before release.');
assert(runtimeSource.includes('waitForPostCleanupReadiness'), 'Open-file gate must wait for post-cleanup pipe labels before showing the canvas.');
assert(runtimeSource.includes('handleSimulationLoadSettled'), 'Open-file gate must release from transaction completion instead of waiting for stale timeouts.');
assert(runtimeSource.includes('npsh:simulation-load-transaction-complete'), 'Open-file gate must listen for completed load transactions.');
assert(runtimeSource.includes('Applying loaded simulation state'), 'Open-file gate must present a clear updating state when transaction data is applied.');
assert(runtimeSource.includes('PIPE_HYDRAULIC_LABEL_SELECTOR'), 'Open-file gate must inspect pipe hydraulic labels before release.');
assert(runtimeSource.includes('PIPE_LABEL_RUNTIME_SRC'), 'Open-file gate must directly load the pipe label runtime needed for file-open readiness.');
assert(runtimeSource.includes('ROUTE_TRACE_RUNTIME_SRC'), 'Open-file gate must directly load the route cleanup runtime needed for file-open readiness.');
assert(runtimeSource.includes('ensureReadinessScript'), 'Open-file gate must include a direct readiness script loader.');
assert(runtimeSource.includes('__npshLoadSupport'), 'Open-file gate must accelerate deferred feature runtimes for file open readiness.');
assert(runtimeSource.includes('__npshLoadRealtime'), 'Open-file gate must accelerate realtime runtimes for file open readiness.');
assert(runtimeSource.includes('runFinalCleanup'), 'Open-file gate must run final display cleanup before showing the canvas.');
assert(runtimeSource.includes('EngineeringRouteTraceAudit?.pruneDefaultCanvasRouteTraceOverlays'), 'Open-file gate must use route-trace cleanup before release.');
assert(runtimeSource.includes('refreshPipeCanvasHydraulicLabels'), 'Open-file gate must refresh pipe hydraulic labels before release.');
assert(runtimeSource.includes('cleanFrames'), 'Open-file gate must wait for clean animation frames before release.');
assert(runtimeSource.includes('MAX_WAIT_MS'), 'Open-file gate must have a timeout fallback.');
assert(runtimeSource.includes("finishSession('warning')"), 'Open-file gate must release with warning instead of sticking forever.');
assert(runtimeSource.includes('restoreOpenSensitiveControls'), 'Open-file gate must restore disabled controls after release.');
assert(runtimeSource.includes('document.body.classList.remove(ACTIVE_CLASS, WARNING_CLASS)'), 'Open-file gate must remove body lock classes after release.');

[
  /\bglobalModel\s*=/,
  /\b__npshGlobalModel\s*=/,
  /\.results\s*=/,
  /\bcalculatePumpSystemHead\b/,
  /\bcalculateDarcy\b/,
  /\bcalculateReynolds\b/,
  /\bfetch\s*\(/
].forEach((pattern) => {
  assert(!pattern.test(runtimeSource), `Open-file gate must not mutate calculation systems or call backend directly: ${pattern}`);
});

if (manifest) {
  assert(manifest.includes('Open file readiness gate cache key: engineering-open-file-readiness-gate.js?v=20260707-open-file-readiness-gate9'), 'FILE_MANIFEST must document the open-file readiness gate cache key.');
  assert(manifest.includes('validate:open-file-readiness-gate'), 'FILE_MANIFEST must mention the open-file readiness gate validator.');
}
if (uploadReadiness) {
  assert(uploadReadiness.includes('Open-file readiness gate validation passed'), 'UPLOAD_READINESS must mention the open-file readiness gate validation.');
}

console.log('Open file readiness gate validation passed.');
