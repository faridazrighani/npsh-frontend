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

assert.strictEqual(runtime.version, '2026.07-pump-envelope-warning-cleanup1');
assert.strictEqual(runtime.cacheKey, '20260707-pump-envelope-warning-clean2');
assert.strictEqual(
  packageJson.scripts?.['validate:pump-envelope-warning-cleanup'],
  'node tools/validate-pump-envelope-warning-cleanup-runtime.cjs',
  'package.json must expose the pump envelope warning cleanup validator.'
);

const scriptSrc = 'engineering-pump-envelope-warning-cleanup-runtime.js?v=20260707-pump-envelope-warning-clean2';
assert(indexHtml.includes(scriptSrc), 'index.html must load the pump envelope warning cleanup runtime.');
assert(
  indexHtml.indexOf('app.bundle.min.js?v=20260707-pipe-canvas-loss-label1') < indexHtml.indexOf(scriptSrc),
  'Pump envelope warning cleanup should load after the protected app bundle.'
);
assert(
  indexHtml.indexOf(scriptSrc) < indexHtml.indexOf('engineering-open-file-readiness-gate.js?v=20260707-open-file-readiness-gate8'),
  'Pump envelope warning cleanup should run before open-file readiness checks.'
);

[
  'SUPPRESSED_PUMP_INPUT_FIELDS',
  'DEPRECATED_WARNING_PATTERNS',
  'getPumpOperatingWarnings',
  'getPumpValidationWarnings',
  'updateCanvasWarningPanel',
  'getActiveModel',
  'sanitizeModelWarnings',
  'canvasWarningPanel',
  'canvasWarningList',
  'canvasWarningCount',
  'MutationObserver',
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

[
  /\bcalculatePumpSystemHead\b/,
  /\bcalculateDarcy\b/,
  /\bcalculateReynolds\b/,
  /\bfetch\s*\(/
].forEach((pattern) => {
  assert(!pattern.test(runtimeSource), `Runtime must not call calculation/backend systems: ${pattern}`);
});

if (manifest) {
  assert(manifest.includes(`Pump envelope warning cleanup cache key: ${scriptSrc}`), 'FILE_MANIFEST must document the pump envelope warning cleanup cache key.');
  assert(manifest.includes('validate:pump-envelope-warning-cleanup'), 'FILE_MANIFEST must mention the pump envelope warning cleanup validator.');
}
if (uploadReadiness) {
  assert(uploadReadiness.includes('Pump envelope warning cleanup validation passed'), 'UPLOAD_READINESS must mention the pump envelope warning cleanup validation.');
}

console.log('Pump envelope warning cleanup validation passed.');
