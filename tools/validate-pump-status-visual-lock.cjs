const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-pump-status-visual-lock.js');
const indexPath = path.join(rootDir, 'index.html');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');
const packagePath = path.join(rootDir, 'package.json');

const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const cacheKey = 'engineering-pump-status-visual-lock.js?v=20260706-pump-incomplete-badge1';

assert(runtimeSource.includes('2026.07-pump-status-visual-lock2'), 'runtime version is missing');
assert(runtimeSource.includes('NpshPumpStatusVisualLock'), 'runtime global API is missing');
assert(runtimeSource.includes('MutationObserver'), 'runtime must watch newly rendered pump badges');
assert(runtimeSource.includes('attributeFilter: ["class", "data-operating-status"]'), 'observer must be scoped to pump status visual churn');
assert(runtimeSource.includes('hardIncomplete'), 'hydraulic incomplete must override stale Safe status fields');
assert(runtimeSource.includes('syncAllPumpElements'), 'runtime must expose all-pump resync for validation and late render repair');
assert(index.includes(cacheKey), 'index must load the cache-busted pump visual lock');
assert(
  index.indexOf(cacheKey) > index.indexOf('app.bundle.min.js?v=20260621-npsh-margin-options1'),
  'pump visual lock must load after app.bundle.min.js so it can patch app status functions'
);
assert(
  index.indexOf(cacheKey) < index.indexOf('engineering-pipe-properties-cleanup-runtime.js?v=20260630-pipe-properties-cleanup1'),
  'pump visual lock must load in the critical script pack before later UI guards'
);
assert(manifest.includes('engineering-pump-status-visual-lock.js public-safe'), 'manifest runtime inventory entry is missing');
assert(manifest.includes(`Pump status visual lock cache key: ${cacheKey}`), 'manifest cache key is missing');
assert(manifest.includes('Pump status visual lock validation: npm run validate:pump-status-visual-lock'), 'manifest validation command is missing');
assert(
  pkg.scripts['validate:pump-status-visual-lock'] === 'node tools/validate-pump-status-visual-lock.cjs',
  'npm validation script is missing'
);

const runtime = require(runtimePath);

function pump(results = {}) {
  return { type: 'pump', props: {}, results };
}

function setRuntimeState(model, connections) {
  globalThis.__npshGlobalModel = model;
  globalThis.__npshConnections = connections;
}

const disconnectedPump = pump({
  hydraulicNpshStatus: 'Incomplete',
  backendValidationStatus: 'Unverified',
  cavitationStatus: 'Safe',
  npsha: 0
});
setRuntimeState({ 'P-100': disconnectedPump }, []);
assert.equal(
  runtime.resolvePumpOperatingVisualStatus(disconnectedPump, 'P-100'),
  'incomplete',
  'freshly dragged disconnected pump must display Incomplete, not stale Safe'
);

const hardIncompletePump = pump({
  hydraulicNpshStatus: 'Incomplete',
  cavitationStatus: 'Safe',
  npsha: 0
});
setRuntimeState({ 'P-100': hardIncompletePump }, [{ from: 'SRC-100', to: 'P-100', connectionType: 'hydraulic' }]);
assert.equal(
  runtime.resolvePumpOperatingVisualStatus(hardIncompletePump, 'P-100'),
  'incomplete',
  'hydraulic incomplete must override Safe even when a zero NPSHa placeholder is present'
);

const npshaOnlyPump = pump({
  hydraulicNpshStatus: 'NPSHr Not Provided',
  backendValidationStatus: 'Connected',
  cavitationStatus: 'Safe',
  npsha: 9.9289,
  warnings: []
});
setRuntimeState({ 'P-100': npshaOnlyPump }, [{ from: 'SRC-100', to: 'P-100', connectionType: 'hydraulic' }]);
assert.equal(
  runtime.resolvePumpOperatingVisualStatus(npshaOnlyPump, 'P-100'),
  'warning',
  'NPSHa-only route without NPSHr must display Warning/NPSHr Not Provided, not Safe'
);

const safePump = pump({
  hydraulicNpshStatus: 'Safe',
  backendValidationStatus: 'Connected',
  cavitationStatus: 'Safe',
  npsha: 15.1,
  npshr: 1,
  npshMargin: 14.1,
  warnings: []
});
setRuntimeState({ 'P-100': safePump }, [{ from: 'SRC-100', to: 'P-100', connectionType: 'hydraulic' }]);
assert.equal(runtime.resolvePumpOperatingVisualStatus(safePump, 'P-100'), 'safe', 'valid connected safe pump must remain Safe');

const riskPump = pump({
  hydraulicNpshStatus: 'NPSH Risk',
  backendValidationStatus: 'Connected',
  cavitationStatus: 'Risk',
  npsha: 0.8,
  npshr: 1
});
setRuntimeState({ 'P-100': riskPump }, [{ from: 'SRC-100', to: 'P-100', connectionType: 'hydraulic' }]);
assert.equal(runtime.resolvePumpOperatingVisualStatus(riskPump, 'P-100'), 'risk', 'risk status must still display NPSH Risk');

console.log('Pump status visual lock validation passed.');
