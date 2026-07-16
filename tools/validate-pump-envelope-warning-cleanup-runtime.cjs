const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-pump-envelope-warning-cleanup-runtime.js');
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

assert.strictEqual(runtime.version, '2026.07-warning-lifecycle-cleanup3-current-request-lock');
assert.strictEqual(runtime.cacheKey, '20260712-warning-lifecycle-current-request-lock1');
assert.strictEqual(
  packageJson.scripts?.['validate:pump-envelope-warning-cleanup'],
  'node tools/validate-pump-envelope-warning-cleanup-runtime.cjs',
  'package.json must expose the pump envelope warning cleanup validator.'
);

const scriptSrc = 'engineering-pump-envelope-warning-cleanup-runtime.js?v=20260712-warning-lifecycle-current-request-lock1';
assert(indexHtml.includes(scriptSrc), 'index.html must load the pump envelope warning cleanup runtime.');
assert(
  indexHtml.indexOf('app.bundle.min.js?v=20260707-pipe-canvas-loss-label1') < indexHtml.indexOf(scriptSrc),
  'Pump envelope warning cleanup should load after the protected app bundle.'
);
assert(
  indexHtml.indexOf(scriptSrc) < indexHtml.indexOf('engineering-open-file-readiness-gate.js?v=20260716-canvas-object-smooth-drag1'),
  'Pump envelope warning cleanup should run before open-file readiness checks.'
);

[
  'SUPPRESSED_PUMP_INPUT_FIELDS',
  'DEPRECATED_WARNING_PATTERNS',
  'BACKEND_UNAVAILABLE_WARNING_PATTERNS',
  'WARNING_ARRAY_KEYS',
  'getPumpOperatingWarnings',
  'getPumpValidationWarnings',
  'setBackendProtectedUnavailableResult',
  'applyBackendSimulationPrimaryResults',
  'shouldExpireBackendWarning',
  'isCurrentVerifiedBackendResult',
  'npsh:realtime-autosolve-superseded',
  'updateCanvasWarningPanel',
  'getActiveModel',
  'sanitizeModelWarnings',
  'canvasWarningPanel',
  'canvasWarningList',
  'canvasWarningCount',
  'MutationObserver',
  '__engineeringPumpWarningPanelPatchInstalled',
  'pruneCanvasWarningPanel'
].forEach((text) => {
  assert(runtimeSource.includes(text), `Runtime must include ${text}.`);
});

assert(runtime.suppressedFields.includes('designFlow'), 'Design Flow must be suppressed.');
assert(runtime.suppressedFields.includes('designHead'), 'Design Head must be suppressed.');
assert(runtime.suppressedFields.includes('designEfficiency'), 'Design Efficiency must be suppressed.');
assert(runtime.suppressedFields.includes('bepFlow'), 'BEP Flow must be suppressed.');
assert(!runtime.suppressedFields.includes('designNpshr'), 'Manual NPSHr/designNpshr must remain available for real NPSH checks.');

assert(
  runtime.isSuppressedPumpEnvelopeWarning('Envelope scan requires complete inputs: Design Flow, Design Head, Design Efficiency, BEP Flow.'),
  'Envelope scan design/BEP warning must be suppressed.'
);
assert(
  runtime.isSuppressedPumpEnvelopeWarning({ field: 'designEfficiency', message: 'Design Efficiency is missing.' }),
  'Design efficiency field warning must be suppressed.'
);
assert(
  !runtime.isSuppressedPumpEnvelopeWarning('Hydraulic NPSH margin is below the required value.'),
  'Hydraulic NPSH warnings must not be suppressed.'
);
assert(
  !runtime.isSuppressedPumpEnvelopeWarning({ field: 'designNpshr', message: 'Manual NPSHr must be greater than zero.' }),
  'Manual NPSHr validation must not be suppressed.'
);

const filtered = runtime.filterWarningList([
  'Envelope scan requires complete inputs: Design Flow, Design Head, Design Efficiency, BEP Flow.',
  'Hydraulic NPSH margin is below the required value.'
]);
assert.deepStrictEqual(filtered, ['Hydraulic NPSH margin is below the required value.']);

const backendWarning = 'Backend validation unavailable; displayed hydraulic results are unverified by the protected backend.';
const connectedPump = {
  type: 'pump',
  results: {
    npsha: '15.3482',
    backendValidationStatus: 'Connected',
    calculationFreshness: 'Current',
    backendCalculationSource: 'backend-primary-protected',
    warnings: [backendWarning, 'NPSHr Not Provided'],
    npshEvaluation: {
      npsha: 15.3482,
      backendValidationStatus: 'Connected',
      calculationFreshness: 'Current',
      warnings: [backendWarning, 'Hydraulic NPSH margin is below the required value.']
    }
  }
};
assert(runtime.isBackendUnavailableWarning(backendWarning), 'Protected-backend warning must be classified explicitly.');
assert(runtime.isCurrentVerifiedBackendResult(connectedPump), 'Connected/current backend result must be recognized.');
assert(runtime.shouldExpireBackendWarning(connectedPump), 'Backend warning must expire after a connected/current result.');
assert.deepStrictEqual(
  runtime.filterWarningList(connectedPump.results.warnings, { node: connectedPump }),
  ['NPSHr Not Provided'],
  'Connected result must clear stale backend warning and preserve NPSHr warning.'
);

const pendingPump = {
  type: 'pump',
  results: {
    backendValidationStatus: 'Calculating',
    calculationFreshness: 'Calculating',
    backendParity: { status: 'pending', requestId: 22 },
    warnings: [backendWarning]
  }
};
assert(
  runtime.shouldExpireBackendWarning(pendingPump, { status: 'timeout' }),
  'An older timeout must not create a warning while a newer backend request is pending.'
);

const failedPump = {
  type: 'pump',
  results: {
    backendValidationStatus: 'Timeout',
    calculationFreshness: 'Failed',
    backendCalculationSource: 'backend-unavailable',
    backendParity: { status: 'timeout', requestId: 23 },
    warnings: [backendWarning]
  }
};
assert(
  !runtime.shouldExpireBackendWarning(failedPump, { status: 'timeout' }),
  'A real terminal failure for the active request must remain visible.'
);
assert.deepStrictEqual(
  runtime.filterWarningList(failedPump.results.warnings, { node: failedPump }),
  [backendWarning],
  'True active backend outage warning must not be hidden.'
);

const localTraceOnlyPump = {
  type: 'pump',
  results: {
    npsha: 15.3479,
    backendValidationStatus: 'Connected',
    calculationFreshness: 'Current',
    backendCalculationSource: 'frontend-local-trace',
    warnings: [backendWarning]
  }
};
assert(
  !runtime.isCurrentVerifiedBackendResult(localTraceOnlyPump),
  'Frontend local trace must never be mislabeled as a protected-backend verification.'
);
assert.deepStrictEqual(
  runtime.filterWarningList(localTraceOnlyPump.results.warnings, { node: localTraceOnlyPump }),
  [backendWarning],
  'A real unverified local trace must retain its backend validation warning.'
);

const model = {
  'P-100': {
    type: 'pump',
    results: {
      warnings: [
        'Envelope scan requires complete inputs: Design Flow, Design Head, Design Efficiency, BEP Flow.',
        'Hydraulic NPSH margin is below the required value.'
      ],
      validationWarnings: [
        { field: 'designEfficiency', message: 'Design Efficiency is missing.' },
        { field: 'designNpshr', message: 'Manual NPSHr must be greater than zero.' }
      ]
    }
  }
};
assert.strictEqual(runtime.sanitizeModelWarnings(model), 2, 'Model sanitation must remove deprecated pump warning arrays.');
assert.deepStrictEqual(model['P-100'].results.warnings, ['Hydraulic NPSH margin is below the required value.']);
assert.deepStrictEqual(model['P-100'].results.validationWarnings, [
  { field: 'designNpshr', message: 'Manual NPSHr must be greater than zero.' }
]);

const connectedModel = { 'P-200': connectedPump };
assert.strictEqual(
  runtime.sanitizeModelWarnings(connectedModel),
  2,
  'Lifecycle sanitation must clear expired backend warnings from nested warning containers.'
);
assert.deepStrictEqual(connectedPump.results.warnings, ['NPSHr Not Provided']);
assert.deepStrictEqual(
  connectedPump.results.npshEvaluation.warnings,
  ['Hydraulic NPSH margin is below the required value.']
);

[
  /\bcalculatePumpSystemHead\b/,
  /\bcalculateDarcy\b/,
  /\bcalculateReynolds\b/,
  /\bfetch\s*\(/
].forEach((pattern) => {
  assert(!pattern.test(runtimeSource), `Runtime must not call calculation/backend systems: ${pattern}`);
});

if (manifest) {
  assert(manifest.includes(`Pump warning lifecycle cleanup cache key: ${scriptSrc}`), 'FILE_MANIFEST must document the warning lifecycle cleanup cache key.');
  assert(manifest.includes('validate:pump-envelope-warning-cleanup'), 'FILE_MANIFEST must mention the pump envelope warning cleanup validator.');
}
if (uploadReadiness) {
  assert(uploadReadiness.includes('Pump envelope warning cleanup validation passed'), 'UPLOAD_READINESS must mention the pump envelope warning cleanup validation.');
}

console.log('Pump envelope warning cleanup validation passed.');
