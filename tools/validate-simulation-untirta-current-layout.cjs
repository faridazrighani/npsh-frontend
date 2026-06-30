const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const {
  CURRENT_LAYOUT_SCHEMA,
  REMOVED_PIPE_PROPERTY_KEYS,
  REMOVED_PIPE_SEGMENT_KEYS,
  REMOVED_PIPE_RESULT_KEYS
} = require('./upgrade-simulation-untirta-current-layout.cjs');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const CASE_MANIFEST_FILE = path.join(FRONTEND_ROOT, 'journals', 'simulation-cases.json');
const PACKAGE_FILE = path.join(FRONTEND_ROOT, 'package.json');
const MANIFEST_FILE = path.join(FRONTEND_ROOT, 'FILE_MANIFEST.md');
const UNTIRTA_MAGIC = 'UNTIRTA-NPSH-V1\n';

function readText(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readUntirtaProject(filePath) {
  const file = fs.readFileSync(filePath);
  const magic = Buffer.from(UNTIRTA_MAGIC, 'utf8');
  assert(file.subarray(0, magic.length).equals(magic), `${filePath} must use UNTIRTA magic header.`);

  const headerLength = Number.parseInt(file.subarray(magic.length, magic.length + 8).toString('ascii'), 16);
  assert(Number.isFinite(headerLength) && headerLength > 0, `${filePath} must have a valid header length.`);

  const headerStart = magic.length + 8;
  const payloadStart = headerStart + headerLength;
  const header = JSON.parse(file.subarray(headerStart, payloadStart).toString('utf8'));
  const payloadBuffer = file.subarray(payloadStart, payloadStart + header.payloadBytes);
  assert.equal(header.fileFormat, 'untirta-npsh-simulation', `${filePath} must keep the UNTIRTA file format.`);
  assert.equal(header.checksum, sha256(payloadBuffer), `${filePath} checksum must match the stored payload.`);

  const payloadText = header.compression === 'gzip'
    ? zlib.gunzipSync(payloadBuffer).toString('utf8')
    : payloadBuffer.toString('utf8');
  const project = JSON.parse(payloadText);
  assert(project.model && typeof project.model === 'object', `${filePath} must contain project.model.`);
  return { header, project };
}

function sampleFilesFromManifest() {
  const manifest = readJson(CASE_MANIFEST_FILE);
  return (manifest.cases || [])
    .map((entry) => entry.sampleFile)
    .filter(Boolean)
    .map((sampleFile) => path.join(FRONTEND_ROOT, sampleFile));
}

function assertMissingKeys(target, keys, scope) {
  if (!target || typeof target !== 'object') return;
  keys.forEach((key) => {
    assert(
      !Object.prototype.hasOwnProperty.call(target, key),
      `${scope}.${key} must not be persisted in current Pipe Properties layout files.`
    );
  });
}

function nodesByType(model, type) {
  return Object.entries(model || {}).filter(([, node]) => node?.type === type);
}

function finiteNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function validatePipeNode(fileName, nodeId, node) {
  assert(node.props && typeof node.props === 'object', `${fileName} ${nodeId} must keep pipe props.`);
  assert(Array.isArray(node.props.segments), `${fileName} ${nodeId} must keep pipe segment inputs.`);
  assertMissingKeys(node.props, REMOVED_PIPE_PROPERTY_KEYS, `${fileName} ${nodeId}.props`);
  node.props.segments.forEach((segment, index) => {
    assertMissingKeys(segment, REMOVED_PIPE_SEGMENT_KEYS, `${fileName} ${nodeId}.props.segments[${index}]`);
  });
  assertMissingKeys(node.results, REMOVED_PIPE_RESULT_KEYS, `${fileName} ${nodeId}.results`);
  (node.results?.segmentProfiles || []).forEach((profile, index) => {
    assertMissingKeys(profile, REMOVED_PIPE_RESULT_KEYS, `${fileName} ${nodeId}.results.segmentProfiles[${index}]`);
  });
}

function validateProject(filePath) {
  const fileName = path.basename(filePath);
  const { project } = readUntirtaProject(filePath);
  assert.equal(
    project.projectFile?.currentLayoutMigration?.schemaVersion,
    CURRENT_LAYOUT_SCHEMA,
    `${fileName} must record the current layout migration schema.`
  );

  const sources = nodesByType(project.model, 'source');
  const pumps = nodesByType(project.model, 'pump');
  const sinks = nodesByType(project.model, 'sink');
  const pipes = nodesByType(project.model, 'pipe');

  assert.equal(sources.length, 1, `${fileName} must keep one SRC/source object.`);
  assert.equal(pumps.length, 1, `${fileName} must keep one pump object.`);
  assert.equal(sinks.length, 1, `${fileName} must keep one SNK/sink object.`);
  assert(pipes.length >= 2, `${fileName} must keep suction and discharge pipe objects.`);

  pipes.forEach(([nodeId, node]) => validatePipeNode(fileName, nodeId, node));
  pumps.forEach(([pumpId, pump]) => {
    assert(pump.props && typeof pump.props === 'object', `${fileName} ${pumpId} must keep pump props.`);
    assert(
      firstFinite(pump.props.manualNpshr) !== null,
      `${fileName} ${pumpId} must persist explicit manualNpshr for protected backend calculations.`
    );
    assert(
      firstFinite(pump.results?.flow, pump.results?.npshEvaluation?.flow, pump.props.designFlow) !== null,
      `${fileName} ${pumpId} must keep a solved/design flow fallback.`
    );
  });
}

const packageJson = readJson(PACKAGE_FILE);
const manifest = readText(MANIFEST_FILE);

assert.equal(
  packageJson.scripts?.['upgrade:simulation-untirta-current-layout'],
  'node tools/upgrade-simulation-untirta-current-layout.cjs',
  'package.json must expose the simulation UNTIRTA current-layout upgrader.'
);
assert.equal(
  packageJson.scripts?.['validate:simulation-untirta-current-layout'],
  'node tools/validate-simulation-untirta-current-layout.cjs',
  'package.json must expose the simulation UNTIRTA current-layout validator.'
);
assert(manifest.includes('tools/upgrade-simulation-untirta-current-layout.cjs'), 'FILE_MANIFEST must mention the upgrader.');
assert(manifest.includes('tools/validate-simulation-untirta-current-layout.cjs'), 'FILE_MANIFEST must mention the validator.');
assert(manifest.includes('Simulation UNTIRTA current-layout validation'), 'FILE_MANIFEST must document the current-layout validation.');

const files = sampleFilesFromManifest();
assert.equal(files.length, 6, `Expected 6 simulation sample files; found ${files.length}.`);
files.forEach(validateProject);

console.log(`Simulation UNTIRTA current-layout validation passed for ${files.length} sample files.`);
