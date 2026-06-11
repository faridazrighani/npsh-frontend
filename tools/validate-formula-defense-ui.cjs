const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const RUNTIME_FILE = path.join(FRONTEND_ROOT, 'engineering-formula-defense-ui.js');
const INDEX_FILE = path.join(FRONTEND_ROOT, 'index.html');
const PACKAGE_FILE = path.join(FRONTEND_ROOT, 'package.json');
const MANIFEST_FILE = path.join(FRONTEND_ROOT, 'FILE_MANIFEST.md');
const KATEX_JS_FILE = path.join(FRONTEND_ROOT, 'vendor', 'katex', 'katex.min.js');
const KATEX_CSS_FILE = path.join(FRONTEND_ROOT, 'vendor', 'katex', 'katex.min.css');

function read(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, 'utf8');
}

global.katex = require('katex');

const runtimeSource = read(RUNTIME_FILE);
const indexHtml = read(INDEX_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const manifest = fs.existsSync(MANIFEST_FILE) ? read(MANIFEST_FILE) : '';
const runtime = require(RUNTIME_FILE);

assert.strictEqual(runtime.version, 'engineering-formula-defense-ui.v1');
assert.strictEqual(runtime.cacheKey, '20260611-formula-defense-ui4');
assert.strictEqual(runtime.debounceMs, 120);
assert.strictEqual(
  packageJson.scripts?.['validate:formula-defense-ui'],
  'node tools/validate-formula-defense-ui.cjs',
  'package.json must expose the Formula Defense UI validator.'
);
assert.strictEqual(
  packageJson.scripts?.['test:e2e:formula-defense-ui'],
  'playwright test tests/e2e/formula-defense-ui.spec.cjs',
  'package.json must expose the Formula Defense browser E2E.'
);
assert.strictEqual(packageJson.devDependencies?.katex, '^0.17.0', 'KaTeX must be tracked as a local dev dependency.');

assert(indexHtml.includes('vendor/katex/katex.min.css?v=20260611-formula-defense-ui4'), 'index.html must cache-bust local KaTeX CSS.');
assert(indexHtml.includes('engineering-formula-defense-ui.js?v=20260611-formula-defense-ui4'), 'index.html must cache-bust Formula Defense UI runtime.');
assert(fs.existsSync(KATEX_JS_FILE), 'Local KaTeX JS asset must be vendored for static deployment.');
assert(fs.existsSync(KATEX_CSS_FILE), 'Local KaTeX CSS asset must be vendored for static deployment.');

assert(runtimeSource.includes('katex.renderToString'), 'Formula runtime must render equations through KaTeX.');
assert(runtimeSource.includes('sanitizeTexForKatex'), 'Formula runtime must sanitize text-mode spacing before KaTeX rendering.');
assert(runtimeSource.includes('isBenignKatexSpaceMetricWarning'), 'Formula runtime must suppress the known benign KaTeX text-space metric warning.');
assert(runtimeSource.includes('wcagContrastRatio'), 'Formula runtime must expose WCAG contrast validation logic.');
assert(runtimeSource.includes('dataset.formulaContrast'), 'Formula runtime must mark enhanced formula nodes with contrast evidence.');
assert(runtimeSource.includes("surface: '#ffffff'"), 'Formula runtime must keep equation surfaces on a normal light background.');
assert(runtimeSource.includes("text: '#0f172a'"), 'Formula runtime must keep equation text dark.');
assert(!runtimeSource.includes('@media (prefers-color-scheme: dark)'), 'Formula runtime must not auto-darken equations from OS dark mode.');
assert(runtimeSource.includes('.pipe-formula-defense-fitting-breakdown-table thead th'), 'Formula runtime must style the fitting/valve breakdown sticky header.');
assert(runtimeSource.includes('data-pipe-formula-defense-layout="compact-v2"'), 'Formula runtime CSS must target the compact Pipe Formula Defense layout.');
assert(runtimeSource.includes('dataset.pipeFormulaDefenseLayout = \'compact-v2\''), 'Formula runtime must mark Pipe Formula Defense windows as compact.');
assert(runtimeSource.includes('.pipe-formula-defense-source-table'), 'Formula runtime must style the Source & Confidence Map table.');
assert(runtimeSource.includes('pipe-source-map-formula-cell'), 'Formula runtime must restore Source & Confidence Map formulas as normal light code text.');
assert(runtimeSource.includes('restorePipeSourceMapFormulaCells'), 'Formula runtime must normalize Source & Confidence Map formula cells after KaTeX enhancement.');
assert(runtimeSource.includes('refreshOpenPipeFormulaDefenseWindows'), 'Formula runtime must refresh open Pipe Formula Defense windows after recalculation.');
assert(runtimeSource.includes('__formulaDefensePipeRefreshPatched'), 'Formula runtime must patch updateSimulation for realtime Pipe Formula Defense refresh.');
assert(runtimeSource.includes('nth-child(even)'), 'Formula runtime must provide zebra row styling.');
assert(runtimeSource.includes('overflow-x: auto'), 'Formula runtime must keep fitting/valve tables horizontally scrollable.');
assert(runtimeSource.includes('formula-dependency-visualization'), 'Formula runtime must render dependency chain visualization.');
assert(runtimeSource.includes('Changed Input'), 'Dependency visualization must identify the changed input.');
assert(runtimeSource.includes('Affected Variables'), 'Dependency visualization must identify affected variables.');
assert(runtimeSource.includes('Recalculated Variables'), 'Dependency visualization must identify recalculated variables.');
assert(runtimeSource.includes('Final Result'), 'Dependency visualization must identify final results.');
assert(runtimeSource.includes('scheduleDebouncedRecalculation'), 'Formula runtime must schedule debounced recalculation.');
assert(runtimeSource.includes('document.contains(target)'), 'Autosolve must ignore removed temporary E2E inputs.');
assert(runtimeSource.includes("refreshReason: 'realtime-input'"), 'Autosolve must identify realtime recalculation calls.');
assert(runtimeSource.includes('formula-defense-calculation-banner'), 'Formula runtime must expose stale/calculating/current loading state.');

const headFormula = runtime.formulaToTex('H = Hstatic + Hmajor + Hminor');
assert(headFormula.includes('H_{\\mathrm{static}}'), 'System head formula must use subscripts.');
assert(headFormula.includes('H_{\\mathrm{major}}'), 'System head formula must use major-loss subscript.');

const darcyFormula = runtime.formulaToTex('hf = f (L/D) (V^2/(2g))');
assert(darcyFormula.includes('\\frac{L}{D}'), 'Darcy-Weisbach formula must render L/D as a fraction.');
assert(darcyFormula.includes('\\frac{V^2}{2g}'), 'Darcy-Weisbach formula must render velocity head as a fraction with superscript.');

const renderedDarcy = runtime.renderFormulaMarkup('hf = f (L/D) (V^2/(2g))', 'Darcy-Weisbach');
assert.strictEqual(renderedDarcy.renderer, 'katex', 'Rendered Darcy-Weisbach equation must use KaTeX.');
assert(renderedDarcy.html.includes('katex'), 'Rendered formula HTML must contain KaTeX markup.');
assert(renderedDarcy.html.includes('data-equation-renderer="katex"'), 'Rendered formula must carry renderer evidence.');

const sanitizedPressure = runtime.sanitizeTexForKatex('\\mathrm{bar a}');
assert.strictEqual(sanitizedPressure, '\\mathrm{bar\\,a}', 'Text-mode unit spacing must be converted to KaTeX-safe thin spacing.');

const originalWarn = console.warn;
let benignSpaceMetricWarnings = 0;
let unrelatedWarnings = 0;
console.warn = (...args) => {
  if (/No character metrics for ' ' in style 'Main-Regular' and mode 'text'/i.test(args.join(' '))) {
    benignSpaceMetricWarnings += 1;
    return;
  }
  unrelatedWarnings += 1;
};
const renderedPressure = runtime.renderFormulaMarkup('P = 1.744 bar a', 'Pressure');
console.warn = originalWarn;
assert.strictEqual(renderedPressure.renderer, 'katex', 'Pressure units must still render through KaTeX.');
assert.strictEqual(benignSpaceMetricWarnings, 0, 'KaTeX text-space metric warnings must not leak to the console.');
assert.strictEqual(unrelatedWarnings, 0, 'Formula renderer must not introduce unrelated console warnings.');

const contrast = runtime.wcagContrastRatio(
  { r: 15, g: 23, b: 42 },
  { r: 255, g: 255, b: 255 }
);
assert(contrast >= 4.5, `Light formula surface with dark text must meet WCAG AA contrast, got ${contrast}.`);

const pipeChain = runtime.dependencyChainForInput('PIPE-1 diameter = 0.0738');
assert(/velocity/i.test(pipeChain.affected), 'Pipe diameter changes must affect velocity.');
assert(/route loss/i.test(pipeChain.recalculated), 'Pipe diameter changes must recalculate route loss.');

if (manifest) {
  assert(manifest.includes('engineering-formula-defense-ui.js'), 'FILE_MANIFEST must mention Formula Defense UI runtime.');
  assert(manifest.includes('20260611-formula-defense-ui4'), 'FILE_MANIFEST must mention Formula Defense UI cache key.');
  assert(manifest.includes('validate:formula-defense-ui'), 'FILE_MANIFEST must mention Formula Defense UI validation.');
}

console.log('Formula Defense UI validation passed: compact Pipe Formula Defense layout, KaTeX rendering, WCAG contrast, responsive tables, and realtime refresh are locked.');
