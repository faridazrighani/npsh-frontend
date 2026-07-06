const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'engineering-canvas-fast-preview-runtime.js');
const indexPath = path.join(root, 'index.html');
const manifestPath = path.join(root, 'FILE_MANIFEST.md');
const packagePath = path.join(root, 'package.json');

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

const cacheKey = 'engineering-canvas-fast-preview-runtime.js?v=20260706-canvas-fast-preview5';
const cacheKeyCount = (index.match(new RegExp(cacheKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

assert(runtime.includes('2026.07-canvas-fast-preview5'), 'runtime version is missing');
assert(runtime.includes('EngineeringCanvasFastPreviewRuntime'), 'global API is missing');
assert(cacheKeyCount >= 2, 'runtime must load in feature and initial canvas hydration paths');
assert(
  index.indexOf(cacheKey) >= 0
    && index.indexOf(cacheKey) < index.indexOf('engineering-source-temperature-runtime.js?v=20260706-fluid-temperature-global1'),
  'fast preview runtime must load before Source Temperature runtime so input previews are not delayed by autosolve handlers'
);
assert(manifest.includes('engineering-canvas-fast-preview-runtime.js public-safe'), 'manifest inventory entry is missing');
assert(manifest.includes(`Canvas fast preview runtime cache key: ${cacheKey}`), 'manifest cache key is missing');
assert(pkg.scripts['validate:canvas-fast-preview'] === 'node tools/validate-canvas-fast-preview-runtime.cjs', 'npm validation script is missing');

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
  'vaporPressureHead'
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
assert(!runtime.includes('props.designNpshr') || !/propsNpshr[\s\S]{0,220}designNpshr/.test(runtime), 'fast preview must not fall back to legacy designNpshr for NPSHr display.');
assert(runtime.includes('npshMargin: propsNpshr === null ? null'), 'fast preview must keep NPSH margin blank without Manual NPSHr.');

console.log('Canvas fast preview runtime validation passed.');
