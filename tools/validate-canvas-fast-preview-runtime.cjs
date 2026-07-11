const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'engineering-canvas-fast-preview-runtime.js');
const indexPath = path.join(root, 'index.html');
const manifestPath = path.join(root, 'FILE_MANIFEST.md');
const packagePath = path.join(root, 'package.json');
const publishPath = path.join(root, 'tools', 'publish-local-live.cjs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Canvas fast preview validation failed: ${message}`);
    process.exit(1);
  }
}

const runtime = read(runtimePath);
const index = read(indexPath);
const manifest = read(manifestPath);
const pkg = JSON.parse(read(packagePath));
const publish = read(publishPath);

const cacheKey = 'engineering-canvas-fast-preview-runtime.js?v=20260710-canvas-fast-preview21';
const cacheKeyCount = (index.match(new RegExp(cacheKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

assert(runtime.includes('2026.07-canvas-fast-preview21'), 'runtime version is missing');
assert(runtime.includes('EngineeringCanvasFastPreviewRuntime'), 'global API is missing');
assert(cacheKeyCount >= 2, 'runtime must load in feature and initial canvas hydration paths');
assert(
  index.indexOf(cacheKey) >= 0
    && index.indexOf(cacheKey) < index.indexOf('engineering-source-temperature-runtime.js?v=20260711-src-input-flash-lock1'),
  'fast preview runtime must load before Source Temperature runtime so input previews are not delayed by autosolve handlers'
);
assert(manifest.includes('engineering-canvas-fast-preview-runtime.js public-safe'), 'manifest inventory entry is missing');
assert(manifest.includes(`Canvas fast preview runtime cache key: ${cacheKey}`), 'manifest cache key is missing');
assert(pkg.scripts['validate:canvas-fast-preview'] === 'node tools/validate-canvas-fast-preview-runtime.cjs', 'npm validation script is missing');
assert(publish.includes("['run', 'validate:canvas-fast-preview']"), 'publish flow must run the canvas fast-preview regression lock before deploy.');
assert(publish.includes("['run', 'validate:live-parameter-repaint-lock']"), 'publish flow must run the live-parameter repaint lock before deploy.');
assert(publish.includes("['run', 'validate:pipe-canvas-hydraulic-label']"), 'publish flow must run the pipe canvas label lock before deploy.');
assert(manifest.includes('Canvas fast preview validation: npm run validate:canvas-fast-preview'), 'FILE_MANIFEST must document the canvas fast-preview validator.');

[
  'requestAnimationFrame',
  'npsh:calculation-dependency-changed',
  'npsh:realtime-autosolve-scheduled',
  'npsh:input-lightweight-update',
  'npsh:calculation-current',
  'npsh:realtime-autosolve-complete',
  'syncFluidTemperatureInputToModel',
  'isImmediateFluidTemperatureInput',
  'runImmediatePumpPreview',
  'temperaturePropertySyncRequested',
  'refreshPipeCanvasHydraulicLabels',
  'normalizeDefaultSinkCanvasRows',
  'ensureDefaultSinkCanvasRows',
  'NPSH Available',
  'NPSH Required',
  'NPSH Margin',
  'NPSH Ratio',
  'Hydraulic NPSH',
  'Required Head',
  'hasHydraulicConnectionForNode',
  'Unverified',
  'vaporPressureHead',
  'normalizeBackendValidationStatusForMatrix',
  'normalizeHydraulicNpshStatusForMatrix'
].forEach((token) => {
  assert(runtime.includes(token), `runtime token is missing: ${token}`);
});

assert(!/\bupdateSimulation\s*\(/.test(runtime), 'fast preview runtime must not call updateSimulation');
assert(!/\bnotifyDependencyChanged\s*\(/.test(runtime), 'fast preview runtime must not schedule backend solves');
assert(!/\bfetch\s*\(/.test(runtime), 'fast preview runtime must not call network APIs');
assert(!/setRowValue\([^)]*"Pump Head"/s.test(runtime), 'fast preview runtime must not repaint manufacturer Pump Head');
assert(/requestPreview\([^)]*input/.test(runtime), 'input-triggered requestPreview path is missing');
assert(/beginPreviewWindow\(eventName,\s*1800,\s*isImmediateFluidTemperatureInput\(event\.target\)\)/.test(runtime), 'Fluid Basis temperature input must trigger immediate canvas preview before autosolve handlers');
assert(/if \(immediate\) runImmediatePumpPreview/.test(runtime), 'Immediate input preview must repaint pump panel before heavier pipe/SNK refresh work');
assert(/setRowValue\([^)]*NPSH Available/s.test(runtime), 'pump NPSHa row repaint is missing');
assert(runtime.includes('function optionalManualNpshr'), 'fast preview must distinguish blank Manual NPSHr from explicit zero.');
assert(runtime.includes('const propsNpshr = optionalManualNpshr(props.manualNpshr);'), 'fast preview NPSHr source must be Manual NPSHr only.');
assert(runtime.includes('function isSuctionBoundaryType'), 'fast preview must classify valid SRC/tank/vessel suction boundaries before showing downstream duty.');
assert(runtime.includes('function isDischargeBoundaryType'), 'fast preview must require a valid SNK discharge boundary before showing downstream duty.');
assert(runtime.includes('connectionTo(connection) === pumpId') && runtime.includes('isSuctionBoundaryType(nodeType(modelRef, connectionFrom(connection)))'), 'fast preview downstream duty must require a live suction route into the pump.');
assert(runtime.includes('connectionFrom(connection) === pumpId') && runtime.includes('isDischargeBoundaryType(nodeType(modelRef, connectionTo(connection)))'), 'fast preview downstream duty must require a live pump-to-SNK discharge route.');
assert(!runtime.includes('props.designNpshr') || !/propsNpshr[\s\S]{0,220}designNpshr/.test(runtime), 'fast preview must not fall back to legacy designNpshr for NPSHr display.');
assert(runtime.includes('npshMargin: propsNpshr === null ? null'), 'fast preview must keep NPSH margin blank without Manual NPSHr.');
assert(runtime.includes('results.vaporPressureHead'), 'fast preview must use the last authoritative pump vaporPressureHead as its baseline.');
assert(runtime.indexOf('results.vaporPressureHead') < runtime.indexOf('basis.vaporPressureHead'), 'pump vaporPressureHead result must be preferred over current Fluid Basis trace fallback.');
assert(runtime.includes('preservePreviewFluidBasis ? prior?.vaporPressureHead : null'), 'baseline capture must preserve the previous vapor head while temperature preview is active.');
assert(runtime.includes('const preservePreviewFluidBasis = isPreviewWindowOpen();'), 'authoritative events must not erase fast-preview baselines during active input.');
assert(runtime.includes('panel.dataset.canvasFastPreview = VERSION;'), 'pump panel must be stamped whenever fast preview runs.');
assert(runtime.includes('__engineeringCanvasFastPreviewLastPumpPreview'), 'fast preview must expose last pump preview diagnostics for E2E/debug verification.');
assert(runtime.includes('eventName === "npsh:input-lightweight-update"'), 'lightweight input events must trigger immediate pump preview.');
assert(/beginPreviewWindow\(event\?\.detail\?\.sourceEvent \|\| eventName,\s*1800,\s*immediate\)/.test(runtime), 'preview events must pass the immediate flag through beginPreviewWindow.');
assert(runtime.includes('function applyTransientPumpPreview'), 'fast preview must publish transient pump result values so renderer rebuilds cannot restore stale NPSHa rows.');
assert(runtime.includes('__canvasFastPreviewTransient'), 'transient pump preview results must be tagged for audit and baseline guards.');
assert(runtime.includes('function isManualNpshrFastLaneActive'), 'fast preview must detect Manual NPSHr-only local previews.');
assert(runtime.includes('writeNpsha: !manualNpshrPreviewOnly'), 'Manual NPSHr-only previews must not write transient NPSHa into pump results.');
assert(runtime.includes('if (preview.writeNpsha !== false)'), 'transient pump preview must guard model writes to NPSHa.');
assert(runtime.includes('options.preservePreviewFluidBasis && pumpNode?.results?.__canvasFastPreviewTransient'), 'baseline capture must not treat transient preview values as authoritative results.');
assert(runtime.includes('return "NPSHr Not Provided";') || runtime.includes('return NPSHR_NOT_PROVIDED_STATUS;'), 'fast preview must keep blank Manual NPSHr pumps in the canonical NPSHr Not Provided status.');
assert(runtime.includes('return "Cavitation Risk";'), 'fast preview must keep cavitation-risk status canonical.');
assert(runtime.includes('return "Warning";'), 'fast preview must keep warning status canonical.');
assert(runtime.includes('return "OK";'), 'fast preview must keep satisfied Manual NPSHr comparison canonical as OK.');
assert(runtime.includes('normalizeBackendValidationStatusForMatrix(view.backendStatus, baseline?.backendStatus)'), 'fast preview backend row must be normalized to the Backend Valid. matrix before repaint.');
assert(runtime.includes('function stampExistingPipeAndSinkPreview'), 'immediate preview must stamp existing pipe/SNK readouts after the lightweight refresh.');
assert(runtime.includes('stampExistingPipeAndSinkPreview(document)\n      + refreshPumpPanels(document)\n      + stampExistingPipeAndSinkPreview(document)'), 'immediate pump preview must stamp pipe/SNK readouts before and after pump repaint.');
assert(runtime.includes('requestPreview(reason);'), 'the full pipe/SNK refresh must remain scheduled on the normal preview frame.');
assert(runtime.includes('setAttribute?.("data-canvas-fast-preview", VERSION)'), 'SVG pipe labels must be stamped with data-canvas-fast-preview via setAttribute.');
assert(runtime.includes('__engineeringCanvasFastPreviewLastStamp'), 'fast preview must expose pipe/SNK stamp diagnostics.');
assert(runtime.includes('function finalizeImmediatePanelStamp'), 'immediate preview must finalize pump panel stamp after pipe/SNK labels stabilize.');
assert(runtime.includes('canvasFastPreviewPending'), 'pump panel preview stamp must have a pending state while pipe/SNK labels settle.');
assert(runtime.includes('panelStampDeferredUntil'), 'immediate pump preview must defer the ready stamp briefly to avoid half-updated canvas state.');
assert(/if \(immediate\) \{\s*panelStampDeferredUntil/.test(runtime), 'beginPreviewWindow must set the panel-ready defer before immediate preview runs.');
assert(runtime.includes('function markPumpPanelsPreviewPending'), 'input preview must mark existing pump panels pending before any transient row changes.');
assert(runtime.includes('markPumpPanelsPreviewPending(document);'), 'immediate preview must clear the previous ready stamp before repainting pump values.');
assert(!runtime.includes('clearTimeout?.(immediatePanelStampTimer)'), 'immediate preview finalize timer must not be reset by repeated lightweight events.');

console.log('Canvas fast preview runtime validation passed.');
