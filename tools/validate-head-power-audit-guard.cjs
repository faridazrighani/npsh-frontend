const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-head-power-audit-guard.js');
const indexPath = path.join(rootDir, 'index.html');
const packagePath = path.join(rootDir, 'package.json');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');

const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const manifest = fs.readFileSync(manifestPath, 'utf8');

const guard = require(runtimePath);

assert.equal(guard.version, '2026.06-head-power-audit-guard2', 'Head power audit guard must expose the locked version.');
assert.equal(typeof guard.clearRequiredHeadFromActualFields, 'function', 'Guard must expose the route-only cleanup helper.');
assert.equal(typeof guard.sanitizeAllPumps, 'function', 'Guard must expose model-wide sanitization.');
assert(runtimeSource.includes('Required/System Head is not Actual Pump Head'), 'Guard must document the required-vs-actual reason.');

const pressureAssistedRouteOnly = {
  requiredSystemHead: '-3.649',
  requiredSystemHeadRaw: '-3.649',
  requiredSystemHeadPositive: '0.001',
  head: '-3.649',
  pumpHead: '-3.649',
  pumpHeadAtFlow: '-3.649',
  actualPumpHead: null,
  actualPumpHeadAvailable: false,
  headResidual: '-',
  power: '-0.390',
  hydraulicPower: '-0.200',
  efficiency: '30.0',
  npshEvaluation: {
    requiredSystemHead: -3.649,
    pumpHead: null,
    actualPumpHead: null,
    actualPumpHeadAvailable: false,
    pumpHeadBasis: 'Not available: route-only required system head is not actual pump head'
  }
};

assert.equal(guard.clearRequiredHeadFromActualFields(pressureAssistedRouteOnly), true, 'Guard must clean route-only required head leaks.');
assert.equal(pressureAssistedRouteOnly.head, null, 'Legacy head must not carry Required Head.');
assert.equal(pressureAssistedRouteOnly.pumpHead, null, 'Legacy pumpHead must not carry Required Head.');
assert.equal(pressureAssistedRouteOnly.pumpHeadAtFlow, null, 'Pump Head @ Flow must stay empty without actual pump head.');
assert.equal(pressureAssistedRouteOnly.power, null, 'Power must not be calculated from negative Required Head.');
assert.equal(pressureAssistedRouteOnly.hydraulicPower, null, 'Hydraulic power must not be calculated from negative Required Head.');
assert.equal(pressureAssistedRouteOnly.npshEvaluation.pumpHead, null, 'Nested NPSH pumpHead must remain null.');
assert.equal(pressureAssistedRouteOnly.npshEvaluation.actualPumpHeadAvailable, false, 'Nested actual head availability must remain false.');
assert.equal(pressureAssistedRouteOnly.requiredSystemHead, '-3.649', 'Required System Head must remain available for system-head trace.');

const frontendLocalTraceLeak = {
  backendCalculationSource: 'frontend-local-trace',
  calculationFreshness: 'Current (local trace)',
  requiredSystemHead: null,
  head: '0',
  pumpHead: '0',
  pumpHeadAtFlow: '0',
  actualPumpHead: '0',
  actualPumpHeadAvailable: true,
  power: '0',
  hydraulicPower: '0',
  npshEvaluation: {
    pumpHead: 0,
    actualPumpHead: 0,
    actualPumpHeadAvailable: true
  }
};
const frontendLocalTracePump = {
  type: 'pump',
  props: {
    designHead: '22.6',
    designFlow: '39.7',
    curveData: []
  },
  results: frontendLocalTraceLeak
};

assert.equal(
  guard.clearRequiredHeadFromActualFields(frontendLocalTraceLeak, frontendLocalTracePump),
  true,
  'Guard must clean frontend local trace actual-head/power leaks without pump performance evidence.'
);
assert.equal(frontendLocalTraceLeak.head, null, 'Local trace fallback must not invent legacy head.');
assert.equal(frontendLocalTraceLeak.pumpHeadAtFlow, null, 'Local trace fallback must not invent Pump Head @ Flow.');
assert.equal(frontendLocalTraceLeak.actualPumpHeadAvailable, false, 'Local trace fallback actual head must be unavailable without evidence.');
assert.equal(frontendLocalTraceLeak.power, null, 'Local trace fallback must not invent pump power.');
assert.match(frontendLocalTraceLeak.headPowerAuditGuard.reason, /Frontend local trace/, 'Local trace cleanup reason must be explicit.');
assert.match(frontendLocalTraceLeak.headBasis, /frontend local trace/i, 'Local trace cleanup must leave an explicit head basis.');

const frontendLocalTraceWithCurve = {
  backendCalculationSource: 'frontend-local-trace',
  calculationFreshness: 'Current (local trace)',
  head: '26.400',
  pumpHeadAtFlow: '26.400',
  actualPumpHead: '26.400',
  actualPumpHeadAvailable: true,
  power: '4.200',
  npshEvaluation: {
    pumpHead: 26.4,
    actualPumpHead: 26.4,
    actualPumpHeadAvailable: true,
    pumpHeadBasis: 'Pump curve interpolation'
  }
};
const localTracePumpWithCurve = {
  type: 'pump',
  props: {
    curveDataSource: 'Vendor datasheet digitized curve',
    curveData: [
      { flow: 20, head: 32 },
      { flow: 40, head: 26 }
    ]
  },
  results: frontendLocalTraceWithCurve
};

assert.equal(
  guard.clearRequiredHeadFromActualFields(frontendLocalTraceWithCurve, localTracePumpWithCurve),
  false,
  'Guard must preserve local actual pump head when a pump curve evidence basis is present.'
);
assert.equal(frontendLocalTraceWithCurve.actualPumpHead, '26.400', 'Curve-backed local trace actual head must stay intact.');
assert.equal(frontendLocalTraceWithCurve.power, '4.200', 'Curve-backed local trace power must stay intact.');

const actualPumpCurveResult = {
  requiredSystemHead: '25.000',
  head: '27.500',
  pumpHeadAtFlow: '27.500',
  actualPumpHead: '27.500',
  actualPumpHeadAvailable: true,
  power: '5.000',
  npshEvaluation: {
    requiredSystemHead: 25,
    pumpHead: 27.5,
    actualPumpHead: 27.5,
    actualPumpHeadAvailable: true
  }
};

assert.equal(guard.clearRequiredHeadFromActualFields(actualPumpCurveResult), false, 'Guard must not clear valid actual pump curve results.');
assert.equal(actualPumpCurveResult.head, '27.500', 'Valid actual pump head must stay intact.');
assert.equal(actualPumpCurveResult.power, '5.000', 'Valid pump power must stay intact.');

globalThis.__npshGlobalModel = {
  'P-ROUTE': { type: 'pump', results: pressureAssistedRouteOnly },
  'P-CURVE': { type: 'pump', results: actualPumpCurveResult }
};
assert.equal(guard.sanitizeAllPumps(), true, 'Model-wide sanitizer should report a cleaned route-only pump.');
assert.equal(globalThis.__npshGlobalModel['P-ROUTE'].results.head, null, 'Model-wide sanitizer must keep route-only head cleaned.');
assert.equal(globalThis.__npshGlobalModel['P-CURVE'].results.head, '27.500', 'Model-wide sanitizer must not alter valid actual pump head.');

const cacheKey = 'engineering-head-power-audit-guard.js?v=20260627-head-power-audit2';
assert(index.includes(cacheKey), 'index.html must load the Head Power Audit Guard cache key.');
assert(
  index.indexOf('engineering-caption-audit-overrides.js?v=20260630-pipe-properties-live1') < index.indexOf(cacheKey)
    && index.indexOf(cacheKey) < index.indexOf('engineering-route-trace-audit-20260704-sink-pabs-dedupe1.js?v=20260704-sink-pabs-dedupe1'),
  'Head Power Audit Guard must load after caption overrides and before route trace audit diagnostics.'
);
assert.equal(
  packageJson.scripts?.['validate:head-power-audit-guard'],
  'node tools/validate-head-power-audit-guard.cjs',
  'package.json must expose validate:head-power-audit-guard.'
);
assert(manifest.includes('engineering-head-power-audit-guard.js'), 'FILE_MANIFEST must mention the Head Power Audit Guard runtime.');
assert(manifest.includes(`Head Power Audit Guard cache key: ${cacheKey}`), 'FILE_MANIFEST must document the guard cache key.');
assert(manifest.includes('Head Power Audit Guard validation: npm run validate:head-power-audit-guard'), 'FILE_MANIFEST must document the guard validator.');

console.log('Head Power Audit Guard validation passed.');
