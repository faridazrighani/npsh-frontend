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
assert.strictEqual(runtime.cacheKey, '20260612-formula-defense-ui9');
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

assert(indexHtml.includes('vendor/katex/katex.min.css?v=20260612-formula-defense-ui9'), 'index.html must cache-bust local KaTeX CSS.');
assert(indexHtml.includes('engineering-formula-defense-ui.js?v=20260612-formula-defense-ui9'), 'index.html must cache-bust Formula Defense UI runtime.');
assert(fs.existsSync(KATEX_JS_FILE), 'Local KaTeX JS asset must be vendored for static deployment.');
assert(fs.existsSync(KATEX_CSS_FILE), 'Local KaTeX CSS asset must be vendored for static deployment.');

assert(runtimeSource.includes('katex.renderToString'), 'Formula runtime must render equations through KaTeX.');
assert(runtimeSource.includes('sanitizeTexForKatex'), 'Formula runtime must sanitize text-mode spacing before KaTeX rendering.');
assert(runtimeSource.includes('isBenignKatexSpaceMetricWarning'), 'Formula runtime must suppress the known benign KaTeX text-space metric warning.');
assert(runtimeSource.includes('installKatexWarningFilter'), 'Formula runtime must globally filter benign KaTeX text-space metric warnings.');
assert(runtimeSource.includes('__formulaDefenseKatexWarnFilter'), 'Formula runtime must mark the installed KaTeX warning filter.');
assert(runtimeSource.includes('wcagContrastRatio'), 'Formula runtime must expose WCAG contrast validation logic.');
assert(runtimeSource.includes('dataset.formulaContrast'), 'Formula runtime must mark enhanced formula nodes with contrast evidence.');
assert(runtimeSource.includes("surface: '#ffffff'"), 'Formula runtime must keep equation surfaces on a normal light background.');
assert(runtimeSource.includes("text: '#0f172a'"), 'Formula runtime must keep equation text dark.');
assert(!runtimeSource.includes('@media (prefers-color-scheme: dark)'), 'Formula runtime must not auto-darken equations from OS dark mode.');
assert(runtimeSource.includes('.pipe-formula-defense-fitting-breakdown-table thead th'), 'Formula runtime must style the fitting/valve breakdown sticky header.');
assert(runtimeSource.includes('data-pipe-formula-defense-layout="compact-v2"'), 'Formula runtime CSS must target the compact Pipe Formula Defense layout.');
assert(runtimeSource.includes('dataset.pipeFormulaDefenseLayout = \'compact-v2\''), 'Formula runtime must mark Pipe Formula Defense windows as compact.');
assert(runtimeSource.includes('container-type: inline-size'), 'Pipe Formula Defense layout must support container-based responsive behavior after user resizing.');
assert(runtimeSource.includes('width: min(700px, calc(100vw - 24px))'), 'Pipe Formula Defense default width must match the npsh-untirta 700px reference window.');
assert(runtimeSource.includes('height: min(700px, calc(100dvh - 128px))'), 'Pipe Formula Defense default height must match the npsh-untirta 700px reference window.');
assert(runtimeSource.includes('padding: 14px !important'), 'Pipe Formula Defense body padding must match the npsh-untirta desktop reference.');
assert(runtimeSource.includes('font-size: 13px !important'), 'Pipe Formula Defense card heading font size must match the npsh-untirta reference.');
assert(runtimeSource.includes('@container pipe-formula-defense (max-width: 540px)'), 'Pipe Formula Defense target tables must switch to card rows only inside narrow resized windows.');
assert(runtimeSource.includes('.pipe-formula-defense-role-path-table'), 'Formula runtime must explicitly target Realtime Role Path responsiveness.');
assert(runtimeSource.includes('min-width: min(760px, 100%) !important'), 'Realtime Role Path and Source Map tables must use the npsh-untirta compact reference width.');
assert(runtimeSource.includes('min-width: 860px !important'), 'Pipe Fitting Valve Breakdown table must keep numeric columns readable without widening the task window.');
assert(runtimeSource.includes('table-layout: fixed !important'), 'Target Pipe Formula Defense tables must use fixed layout for stable column widths.');
assert(runtimeSource.includes('white-space: nowrap !important'), 'Pipe Fitting Valve Breakdown numeric headers and values must not wrap vertically.');
assert(runtimeSource.includes('overflow-wrap: normal !important'), 'Pipe Fitting Valve Breakdown numeric headers and values must avoid per-character wrapping.');
assert(runtimeSource.includes('.pipe-formula-defense-fitting-breakdown-table th:nth-child(8)'), 'Pipe Fitting Valve Breakdown Source / Note header must be styled independently from numeric columns.');
assert(runtimeSource.includes('pipe-formula-defense-target-table-wrap'), 'Formula runtime must mark target table wrappers for responsive overflow.');
assert(runtimeSource.includes('ensureTableDataLabels'), 'Formula runtime must provide cell labels for responsive card-row tables.');
assert(runtimeSource.includes('.pipe-formula-defense-source-table'), 'Formula runtime must style the Source & Confidence Map table.');
assert(runtimeSource.includes('pipe-source-map-formula-cell'), 'Formula runtime must restore Source & Confidence Map formulas as normal light code text.');
assert(runtimeSource.includes('restorePipeSourceMapFormulaCells'), 'Formula runtime must normalize Source & Confidence Map formula cells after KaTeX enhancement.');
assert(runtimeSource.includes('refreshOpenPipeFormulaDefenseWindows'), 'Formula runtime must refresh open Pipe Formula Defense windows after recalculation.');
assert(runtimeSource.includes('__formulaDefensePipeRefreshPatched'), 'Formula runtime must patch updateSimulation for realtime Pipe Formula Defense refresh.');
assert(runtimeSource.includes('buildAcademicPipeCalculationTrace'), 'Formula runtime must rebuild academic pipe trace rows from live calculation results.');
assert(runtimeSource.includes('buildPipeFormulaDefenseRows'), 'Formula runtime must provide Formula Sequence & Active Substitution rows.');
assert(runtimeSource.includes('__formulaDefenseAcademicTracePatched'), 'Formula runtime must patch buildPipeCalculationTrace with academic trace content.');
assert(runtimeSource.includes('fittingValveBreakdown'), 'Formula runtime must preserve Pipe Fitting Valve Breakdown data while enriching segment steps.');
assert(!runtimeSource.includes('width: min(96vw, 1740px)'), 'Pipe Formula Defense window must not default to the oversized 1740px layout.');
assert(!runtimeSource.includes('min-width: 1120px !important'), 'Pipe Fitting Valve Breakdown table must not use the oversized 1120px table width.');
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
  if (/No character metrics\b.*Main-Regular\b.*mode\s+['"]?text/i.test(args.join(' '))) {
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

const originalCalculatePipeHydraulicSegments = global.calculatePipeHydraulicSegments;
global.calculatePipeHydraulicSegments = () => ([{
  index: 0,
  name: 'PIPE-2-Seg-1 Journal discharge pipe 3 in',
  notes: 'Journal Case 6 discharge pipe: internal diameter 0.0738 m, length 10 m.',
  length: 10,
  diameter: 0.0738,
  roughness: 0.00015,
  effectiveRoughness: 0.00015,
  fittingType: 'None',
  fittingQuantity: 0,
  fittingK: 0,
  fittingTotalK: 0,
  additionalK: 0,
  minorLossK: 0,
  velocity: 3.2469,
  reynolds: 298400,
  flowRegime: 'Turbulent',
  frictionFactor: 0.024122,
  majorLoss: 1.7562,
  fittingLoss: 0,
  additionalLoss: 0,
  minorLoss: 0,
  allowanceLoss: 0,
  totalLoss: 1.7562,
  sizeSource: { status: 'User' },
  materialSource: { status: 'User' },
  fittingSource: { status: 'Exact' }
}, {
  index: 1,
  name: 'PIPE-2-Seg-2 Globe valve 3 in',
  notes: 'Journal discharge minor loss: globe valve 3 in, K = 6.1.',
  length: 0,
  diameter: 0.0738,
  roughness: 0.00015,
  effectiveRoughness: 0.00015,
  fittingType: 'Globe valve',
  fittingQuantity: 1,
  fittingK: 6.1,
  fittingTotalK: 6.1,
  additionalK: 0,
  minorLossK: 6.1,
  velocity: 3.2469,
  reynolds: 298400,
  flowRegime: 'Turbulent',
  frictionFactor: 0.024122,
  majorLoss: 0,
  fittingLoss: 3.2776,
  additionalLoss: 0,
  minorLoss: 3.2776,
  allowanceLoss: 0,
  totalLoss: 3.2776,
  sizeSource: { status: 'User' },
  materialSource: { status: 'User' },
  fittingSource: { status: 'Journal' }
}]);
const academicTrace = runtime.buildAcademicPipeCalculationTrace(
  50,
  { headLossAllowancePercent: 0, roughnessAgingFactor: 1, elevationProfileMode: 'End Elevations' },
  {
    segmentProfiles: [
      { index: 0, startElevation: 0, endElevation: 10, startPressure: 3.781, endPressure: 2.676 }
    ]
  },
  { density: 958.348, viscosity: 0.803, vaporPressure: 1.014 },
  'PIPE-2'
);
if (originalCalculatePipeHydraulicSegments) global.calculatePipeHydraulicSegments = originalCalculatePipeHydraulicSegments;
else delete global.calculatePipeHydraulicSegments;
assert(academicTrace.formulaDefenseRows.length >= 10, 'Formula Sequence & Active Substitution must include the reference row set.');
assert(academicTrace.formulaDefenseRows.some((row) => row.step === 'Flow Conversion' && /50/.test(row.substitution)), 'Formula Sequence must include live flow conversion substitution.');
assert(academicTrace.formulaDefenseRows.some((row) => row.step === 'Major Loss' && row.substitution.includes('1.7562')), 'Formula Sequence must aggregate segment major loss substitutions.');
assert.strictEqual(academicTrace.segments.length, 2, 'All Segment Calculation Trace must expose every segment from live hydraulics.');
assert(academicTrace.segments[0].steps.some((step) => step.title === 'Area'), 'Segment trace must include Area step.');
assert(academicTrace.segments[0].steps.some((step) => step.title === 'Darcy Friction Factor'), 'Segment trace must include Darcy friction factor step.');
assert(academicTrace.segments[0].pressureSteps.some((step) => step.title === 'Segment Inlet Pressure'), 'Segment trace must include pressure profile steps when available.');
assert.strictEqual(academicTrace.fittingValveBreakdown.length, 2, 'Fitting/valve breakdown must be preserved from live segment data.');

if (manifest) {
  assert(manifest.includes('engineering-formula-defense-ui.js'), 'FILE_MANIFEST must mention Formula Defense UI runtime.');
  assert(manifest.includes('20260612-formula-defense-ui9'), 'FILE_MANIFEST must mention Formula Defense UI cache key.');
  assert(manifest.includes('validate:formula-defense-ui'), 'FILE_MANIFEST must mention Formula Defense UI validation.');
}

console.log('Formula Defense UI validation passed: compact Pipe Formula Defense layout, KaTeX rendering, WCAG contrast, responsive tables, and realtime refresh are locked.');
