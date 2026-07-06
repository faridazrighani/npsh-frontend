const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const RUNTIME_FILE = path.join(FRONTEND_ROOT, 'engineering-pipe-segments-file-runtime.js');
const INDEX_FILE = path.join(FRONTEND_ROOT, 'index.html');
const PACKAGE_FILE = path.join(FRONTEND_ROOT, 'package.json');
const MANIFEST_FILE = path.join(FRONTEND_ROOT, 'FILE_MANIFEST.md');

function read(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, 'utf8');
}

const runtimeSource = read(RUNTIME_FILE);
const indexHtml = read(INDEX_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const manifest = fs.existsSync(MANIFEST_FILE) ? read(MANIFEST_FILE) : '';
const runtime = require(RUNTIME_FILE);
const CLEANUP_RUNTIME_URL = 'engineering-pipe-properties-cleanup-runtime.js?v=20260706-pipe-hl-allow-clean1';

assert.strictEqual(runtime.version, 'engineering-pipe-segments-file-runtime.v4');
assert.strictEqual(runtime.cacheKey, '20260630-pipe-properties-cleanup1');
assert.strictEqual(runtime.schemaType, 'pipe-segments-export.v1');
assert.strictEqual(
  packageJson.scripts?.['validate:pipe-segments-file-runtime'],
  'node tools/validate-pipe-segments-file-runtime.cjs',
  'package.json must expose the Pipe Segments file runtime validator.'
);
assert.strictEqual(
  packageJson.scripts?.['test:e2e:pipe-segments-file'],
  'playwright test tests/e2e/pipe-segments-file.spec.cjs',
  'package.json must expose the Pipe Segments browser E2E.'
);
assert(
  indexHtml.includes('engineering-pipe-segments-file-runtime.js?v=20260630-pipe-properties-cleanup1'),
  'index.html must cache-bust and load the Pipe Segments file runtime.'
);
assert(
  indexHtml.indexOf(CLEANUP_RUNTIME_URL)
    < indexHtml.indexOf('engineering-pipe-segments-file-runtime.js?v=20260630-pipe-properties-cleanup1'),
  'Pipe Properties cleanup runtime must load before Pipe Segments runtime.'
);
assert(
  runtimeSource.includes('pipe-segments-export_${formatTimestamp(date)}.v1'),
  'Export filename must use pipe-segments-export_YYYY-MM-DD_HH-mm-ss.v1.'
);
assert(runtimeSource.includes('dataset.pipeSegmentsImport'), 'Runtime must create an Import control.');
assert(runtimeSource.includes('dataset.pipeSegmentsExport'), 'Runtime must create an Export control.');
assert(runtimeSource.includes('EngineeringRealtimeCalculationDefense.markStale'), 'Import must mark the calculation stale through the realtime defense bridge.');
assert(runtimeSource.includes('engineering-pipe-segments-imported'), 'Import must dispatch a browser event for audit/E2E visibility.');
assert(runtimeSource.includes('application/json'), 'Exported local file must be JSON content.');
assert(runtimeSource.includes('REMOVED_SEGMENT_FIELDS'), 'Runtime must strip removed segment elevation fields from Pipe Segments files.');
assert(runtimeSource.includes('EngineeringPipePropertiesCleanupRuntime'), 'Pipe Segments runtime must integrate with Pipe Properties cleanup/scroll stability runtime.');
assert(runtimeSource.includes('[0, 16, 32, 64, 128, 240, 500]'), 'Pipe Segments runtime must restore horizontal scroll across render frames.');
assert(runtimeSource.includes('wrapRenderSidebarScrollRetention'), 'Pipe Segments runtime must wrap direct renderSidebar refreshes for scroll retention.');
assert(runtimeSource.includes('__pipeSegmentsScrollRetentionWrapped'), 'Pipe Segments renderSidebar wrapper must be idempotent.');
assert.strictEqual(typeof runtime.rememberSegmentScrollPositions, 'function', 'Runtime must expose Pipe Segments scroll memory capture.');
assert.strictEqual(typeof runtime.restoreSegmentScrollPositions, 'function', 'Runtime must expose Pipe Segments scroll restoration.');

const fixedDate = new Date(2026, 5, 8, 6, 49, 35);
assert.strictEqual(runtime.formatTimestamp(fixedDate), '2026-06-08_06-49-35');
assert.strictEqual(runtime.filenameForDate(fixedDate), 'pipe-segments-export_2026-06-08_06-49-35.v1');

global.__npshGlobalModel = {
  'PIPE-100': {
    type: 'pipe',
    name: 'PIPE-100',
    props: {
      segments: [
        {
          name: 'Journal pipe',
          pipeSize: 'Custom diameter',
          diameter: 0.0738,
          length: 10,
          material: 'Custom roughness',
          roughness: 0.00015,
          fittingType: 'Custom K',
          fittingQuantity: 1,
          fittingK: 18.448,
          minorLoss: 0,
          startElevation: 99,
          endElevation: 101
        }
      ]
    },
    results: { calculationFreshness: 'Current', backendValidationStatus: 'Current' }
  },
  PUMP: {
    type: 'pump',
    name: 'PUMP',
    results: { calculationFreshness: 'Current', backendValidationStatus: 'Current' }
  }
};

const exportPayload = runtime.buildExportPayload('PIPE-100', fixedDate);
assert.strictEqual(exportPayload.schemaType, 'pipe-segments-export.v1');
assert.strictEqual(exportPayload.schemaVersion, 1);
assert.strictEqual(exportPayload.pipeId, 'PIPE-100');
assert.strictEqual(exportPayload.segmentCount, 1);
assert.deepStrictEqual(exportPayload.segments[0].name, 'Journal pipe');
assert.strictEqual(Object.prototype.hasOwnProperty.call(exportPayload.segments[0], 'startElevation'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(exportPayload.segments[0], 'endElevation'), false);
assert.notStrictEqual(exportPayload.segments, global.__npshGlobalModel['PIPE-100'].props.segments, 'Export must clone segment data.');

const validImport = runtime.validateImportPayload({
  schemaType: 'pipe-segments-export.v1',
  schemaVersion: 1,
  segments: [
    {
      name: 'Imported segment',
      pipeSize: 'Custom diameter',
      diameter: '0.080',
      length: '12.5',
      material: 'Custom roughness',
      roughness: '0.00010',
      fittingType: 'None',
      fittingQuantity: '0',
      fittingK: '0',
      startElevation: '4',
      endElevation: '5'
    }
  ]
});
assert.strictEqual(validImport.ok, true);
assert.strictEqual(validImport.segments[0].diameter, 0.08);
assert.strictEqual(validImport.segments[0].length, 12.5);
assert.strictEqual(Object.prototype.hasOwnProperty.call(validImport.segments[0], 'startElevation'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(validImport.segments[0], 'endElevation'), false);

const invalidImport = runtime.validateImportPayload({
  schemaType: 'pipe-segments-export.v1',
  schemaVersion: 1,
  segments: [{ name: 'Bad diameter', diameter: 'not-a-number' }]
});
assert.strictEqual(invalidImport.ok, false);
assert(invalidImport.errors.join(' ').includes('diameter must be a finite number'));

const applyResult = runtime.applyImportedSegments('PIPE-100', {
  schemaType: 'pipe-segments-export.v1',
  schemaVersion: 1,
  segments: [
    {
      name: 'Imported active segment',
      pipeSize: 'Custom diameter',
      diameter: 0.05,
      length: 3,
      material: 'Custom roughness',
      roughness: 0.00005,
      fittingType: 'Custom K',
      fittingQuantity: 2,
      fittingK: 1.5
    }
  ]
});
assert.strictEqual(applyResult.ok, true);
assert.strictEqual(global.__npshGlobalModel['PIPE-100'].props.segments[0].name, 'Imported active segment');
assert.strictEqual(global.__npshGlobalModel.PUMP.results.calculationFreshness, 'Stale');
assert.strictEqual(global.__engineeringCalculationDefenseRealtimeState.status, 'Stale');

if (manifest) {
  assert(manifest.includes('engineering-pipe-segments-file-runtime.js'), 'FILE_MANIFEST must mention the Pipe Segments file runtime.');
  assert(manifest.includes('20260630-pipe-properties-cleanup1'), 'FILE_MANIFEST must mention the Pipe Segments file cache key.');
}

console.log('Pipe Segments file runtime validation passed: schema, filename, cache key, import/export controls, and stale marking are locked.');
