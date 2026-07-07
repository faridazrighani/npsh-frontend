const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'engineering-fluid-basis-phase-chart-runtime.js');
const indexPath = path.join(root, 'index.html');
const manifestPath = path.join(root, 'FILE_MANIFEST.md');
const packagePath = path.join(root, 'package.json');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

const runtimeSource = read(runtimePath);
const indexHtml = read(indexPath);
const manifest = read(manifestPath);
const pkg = JSON.parse(read(packagePath));
const cacheKey = 'engineering-fluid-basis-phase-chart-runtime.js?v=20260707-fluid-phase-chart3';

assert(runtimeSource.includes('2026.07-fluid-basis-phase-chart3'), 'runtime version must be present');
assert(runtimeSource.includes('EngineeringFluidBasisPhaseChartRuntime'), 'global runtime API must be exposed');
assert(runtimeSource.includes('Pressure-enthalpy phase chart'), 'chart title must match the requested P-h chart placement');
assert(runtimeSource.includes('buildExportMarkup'), 'runtime must expose export markup for PDF Fluid Basis discussion');
assert(runtimeSource.includes('Fluid Basis Vapor Pressure'), 'chart must label Fluid Basis Vapor Pressure as the pressure source');
assert(!runtimeSource.includes('SRC Calculated Abs. Pressure'), 'chart must not label SRC Calculated Abs. Pressure as the pressure source');
assert(runtimeSource.includes('readFluidTemperature'), 'runtime must read temperature from Fluid Basis');
assert(runtimeSource.includes('readFluidChartPressure'), 'runtime must read chart pressure from Fluid Basis vapor pressure');
assert(!runtimeSource.includes('readSourceAbsPressureBar'), 'runtime must not read pressure from SRC');
assert(!runtimeSource.includes('getNodeAbsolutePressureBar'), 'runtime must not use SRC pressure-basis conversion helpers');
assert(runtimeSource.includes('saturationPressureBar'), 'runtime must include the P_sat(T) calculation path');
assert(runtimeSource.includes('MutationObserver'), 'runtime must self-heal after Fluid Basis task-window rerenders');
assert(runtimeSource.includes('drawDiagram'), 'runtime must draw the SVG chart');
assert(!runtimeSource.includes("input[data-key='pressure'][data-node]"), 'runtime must not listen to SRC pressure input changes');
assert(!runtimeSource.includes("pressureInputBasis"), 'runtime must not listen to SRC pressure basis changes');
assert(!/\bfetch\s*\(/.test(runtimeSource), 'phase chart runtime must not call network APIs');
assert(!/\bupdateSimulation\s*\(/.test(runtimeSource), 'phase chart runtime must not trigger calculations');

assert(indexHtml.includes(cacheKey), 'index.html must load the Fluid Basis phase chart runtime');
assert(indexHtml.indexOf(cacheKey) < indexHtml.indexOf('engineering-pump-status-visual-lock.js?v=20260706-pump-incomplete-badge1'), 'phase chart must load in the critical shell before later visual guards');
assert(manifest.includes('engineering-fluid-basis-phase-chart-runtime.js public-safe'), 'manifest runtime inventory entry is missing');
assert(manifest.includes(`Fluid Basis phase chart runtime cache key: ${cacheKey}`), 'manifest cache key entry is missing');
assert.equal(pkg.scripts['validate:fluid-basis-phase-chart'], 'node tools/validate-fluid-basis-phase-chart-runtime.cjs', 'npm validation script is missing');

globalThis.globalModel = {
  FLUID: {
    type: 'fluid',
    name: 'Fluid Basis',
    props: {
      fluidName: 'Water',
      temp: 90,
      vaporPressure: 0.701827
    }
  },
  'SRC-100': {
    type: 'source',
    name: 'SRC-100',
    props: {
      pressureInputBasis: 'Absolute',
      pressure: 2.024
    },
    results: {
      calculationTrace: {
        boundary: {
          absolutePressureBar: 2.024
        }
      }
    }
  }
};

delete require.cache[require.resolve(runtimePath)];
const runtime = require(runtimePath);
assert.equal(runtime.version, '2026.07-fluid-basis-phase-chart3', 'runtime API version mismatch');
assert.equal(runtime.cacheKey, '20260707-fluid-phase-chart3', 'runtime API cache key mismatch');

const calculation = runtime.buildCalculation(globalThis.globalModel);
assert.equal(calculation.temperatureC, 90, 'calculation must use Fluid Basis temperature');
assert.equal(calculation.actualPressureBar, 0.701827, 'calculation must use Fluid Basis vapor pressure as chart pressure');
assert.equal(calculation.psatBar, 0.701827, 'calculation must use Fluid Basis vapor pressure when available');
assert.equal(calculation.sourceId, 'FLUID', 'calculation must identify Fluid Basis as the pressure source');
assert.equal(calculation.actualPressureSource, 'Fluid Basis vapor pressure', 'pressure source label must be Fluid Basis vapor pressure');
assert(Math.abs(calculation.deltaPBar) < 1e-12, 'phase pressure difference should be zero at Fluid Basis vapor pressure');
assert.equal(calculation.statusTitle, 'Saturated boundary', 'sample point should classify as the saturation boundary');
assert(calculation.hMarker > 0 && calculation.hMarker < 2100, 'enthalpy marker must be a finite chart coordinate');
assert(runtime.saturationPressureBar(90) > 0.69 && runtime.saturationPressureBar(90) < 0.72, 'IAPWS P_sat fallback should be correct near 90 deg C');
const exportMarkup = runtime.buildExportMarkup(globalThis.globalModel);
assert(exportMarkup.includes('Pressure-enthalpy phase chart'), 'export markup must include the chart title');
assert(exportMarkup.includes('Temperature'), 'export markup must include chart metadata');
assert(exportMarkup.includes('liquid, mixed-phase, or vapor'), 'export markup must explain phase-region visualization');

globalThis.globalModel['SRC-100'].results = {};
globalThis.globalModel['SRC-100'].props.pressureInputBasis = 'Gauge';
globalThis.globalModel['SRC-100'].props.pressure = 1;
const gaugeCalculation = runtime.buildCalculation(globalThis.globalModel);
assert.equal(gaugeCalculation.actualPressureBar, 0.701827, 'SRC pressure edits must not change the Fluid Basis phase chart pressure');

console.log(JSON.stringify({
  passed: true,
  runtime: path.basename(runtimePath),
  cacheKey,
  sample: {
    temperatureC: calculation.temperatureC,
    pAbsBar: calculation.actualPressureBar,
    pSatBar: calculation.psatBar,
    status: calculation.statusTitle
  }
}, null, 2));
