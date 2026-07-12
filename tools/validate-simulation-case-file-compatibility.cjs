const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const CASE_MANIFEST_FILE = path.join(FRONTEND_ROOT, 'journals', 'simulation-cases.json');
const CASE_IDS = ['simulation-case-1', 'simulation-case-4', 'simulation-case-6'];
const UNTIRTA_MAGIC = Buffer.from('UNTIRTA-NPSH-V1\n', 'utf8');
const MAX_DECODE_MS = 500;
const MAX_STORED_BYTES = 250 * 1024;
const MAX_PAYLOAD_BYTES = 1024 * 1024;

const DEPRECATED_PIPE_PROPERTY_KEYS = [
  'routeStyle',
  'pressureClass',
  'endConnection',
  'elevationProfileMode',
  'startElevation',
  'endElevation',
  'headLossAllowancePercent',
  'roughnessAgingFactor',
  'highPointElevation',
  'highPointLocationPercent'
];

const DEPRECATED_PIPE_SEGMENT_KEYS = [
  'startElevation',
  'endElevation',
  'zIn',
  'zOut',
  'highPointElevation',
  'highPointLocationPercent'
];

const SUPPRESSED_PUMP_WARNING_PATTERNS = [
  /\benvelope\s+scan\b/i,
  /\boperating\s+envelope\b/i,
  /\bcomplete\s+inputs?\b.*\b(design\s+flow|design\s+head|design\s+eff|bep|por|aor)\b/i,
  /\bdesign\s+flow\b.*\bdesign\s+head\b.*\bdesign\s+eff/i,
  /\bdesign\s+efficiency\b/i,
  /\bbep\s+flow\b/i,
  /\bpump\s+duty\s+sizing\b/i,
  /\bpor\s+(min|max)\b/i,
  /\baor\s+(min|max)\b/i
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function finiteNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function assertFinite(value, label, min = null) {
  const number = finiteNumber(value);
  assert(number !== null, `${label} must be a finite number.`);
  if (min !== null) assert(number >= min, `${label} must be >= ${min}.`);
  return number;
}

function readUntirtaProject(filePath) {
  const startedAt = process.hrtime.bigint();
  const file = fs.readFileSync(filePath);
  assert(
    file.subarray(0, UNTIRTA_MAGIC.length).equals(UNTIRTA_MAGIC),
    `${filePath} must use the current UNTIRTA magic header.`
  );

  const headerLength = Number.parseInt(file.subarray(UNTIRTA_MAGIC.length, UNTIRTA_MAGIC.length + 8).toString('ascii'), 16);
  assert(Number.isFinite(headerLength) && headerLength > 0, `${filePath} must have a valid header length.`);

  const headerStart = UNTIRTA_MAGIC.length + 8;
  const payloadStart = headerStart + headerLength;
  const header = JSON.parse(file.subarray(headerStart, payloadStart).toString('utf8'));
  const storedPayload = file.subarray(payloadStart, payloadStart + header.payloadBytes);
  assert.strictEqual(storedPayload.length, header.payloadBytes, `${filePath} payloadBytes must match the stored payload length.`);
  assert.strictEqual(sha256(storedPayload), header.checksum, `${filePath} checksum must match the stored payload.`);

  const payload = header.compression === 'gzip'
    ? zlib.gunzipSync(storedPayload)
    : storedPayload;
  const project = JSON.parse(payload.toString('utf8'));
  const decodeMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  return {
    header,
    project,
    fileBytes: file.length,
    storedBytes: storedPayload.length,
    payloadBytes: payload.length,
    decodeMs
  };
}

function idsByType(model, type) {
  return Object.entries(model || {})
    .filter(([, node]) => String(node?.type || '').toLowerCase() === type)
    .map(([id]) => id);
}

function assertNoDeprecatedPipeFields(caseId, pipeId, pipeNode) {
  const props = pipeNode.props || {};
  DEPRECATED_PIPE_PROPERTY_KEYS.forEach((key) => {
    assert(
      !Object.prototype.hasOwnProperty.call(props, key),
      `${caseId} ${pipeId}.props.${key} is deprecated and must not be persisted in current-layout sample files.`
    );
  });
  (props.segments || []).forEach((segment, index) => {
    DEPRECATED_PIPE_SEGMENT_KEYS.forEach((key) => {
      assert(
        !Object.prototype.hasOwnProperty.call(segment, key),
        `${caseId} ${pipeId}.props.segments[${index}].${key} is deprecated and must not be persisted.`
      );
    });
  });
}

function assertPipeSegments(caseId, pipeId, pipeNode) {
  const segments = pipeNode.props?.segments;
  assert(Array.isArray(segments) && segments.length > 0, `${caseId} ${pipeId} must have persisted pipe/fitting/valve segments.`);
  segments.forEach((segment, index) => {
    assertFinite(segment.diameter, `${caseId} ${pipeId}.segments[${index}].diameter`, 0);
    assertFinite(segment.roughness, `${caseId} ${pipeId}.segments[${index}].roughness`, 0);
    assertFinite(segment.length ?? 0, `${caseId} ${pipeId}.segments[${index}].length`, 0);
    assertFinite(segment.fittingQuantity ?? 0, `${caseId} ${pipeId}.segments[${index}].fittingQuantity`, 0);
    assertFinite(segment.fittingK ?? 0, `${caseId} ${pipeId}.segments[${index}].fittingK`, 0);
  });
  assert.deepEqual(
    pipeNode.results || {},
    {},
    `${caseId} ${pipeId} must persist inputs only; pipe results are recalculated by the global backend.`
  );
}

function assertFluid(caseId, fluidNode) {
  assert.strictEqual(fluidNode?.type, 'fluid', `${caseId} FLUID node must have type "fluid".`);
  const props = fluidNode.props || {};
  assert(String(props.fluidName || '').trim(), `${caseId} FLUID.props.fluidName must be present.`);
  assertFinite(props.temp, `${caseId} FLUID.props.temp`);
  assertFinite(props.density, `${caseId} FLUID.props.density`, 1);
  assertFinite(props.viscosity, `${caseId} FLUID.props.viscosity`, 0);
  assertFinite(props.dynViscosity, `${caseId} FLUID.props.dynViscosity`, 0);
  assertFinite(props.vaporPressure, `${caseId} FLUID.props.vaporPressure`, 0);
  assertFinite(props.vaporPressureHead, `${caseId} FLUID.props.vaporPressureHead`, 0);
  assertFinite(props.specWeight, `${caseId} FLUID.props.specWeight`, 0);
}

function assertPump(caseId, pumpId, pumpNode, sourceFlow) {
  assert.strictEqual(pumpNode?.type, 'pump', `${caseId} ${pumpId} must have type "pump".`);
  assertFinite(sourceFlow, `${caseId} ${pumpId} route operating flow`, 0);
  assertFinite(
    pumpNode.props?.manualNpshr,
    `${caseId} ${pumpId} NPSHr basis`,
    0
  );
  assert.strictEqual(pumpNode.props?.npshrSourceMode, 'Manual', `${caseId} ${pumpId} must use manual NPSHr mode.`);
  assert.deepEqual(
    pumpNode.results || {},
    {},
    `${caseId} ${pumpId} must persist inputs only; pump results are recalculated by the global backend.`
  );
}

function warningText(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return [value.message, value.label, value.title, value.detail, value.field, value.key, value.id]
    .filter(Boolean)
    .join(' ');
}

function assertNoSuppressedPumpWarnings(caseId, pumpId, pumpNode) {
  [
    ['results.warnings', pumpNode.results?.warnings],
    ['results.validationWarnings', pumpNode.results?.validationWarnings],
    ['results.npshEvaluation.warnings', pumpNode.results?.npshEvaluation?.warnings],
    ['warnings', pumpNode.warnings],
    ['validationWarnings', pumpNode.validationWarnings]
  ].forEach(([label, list]) => {
    if (!Array.isArray(list)) return;
    list.forEach((warning, index) => {
      const text = warningText(warning);
      assert(
        !SUPPRESSED_PUMP_WARNING_PATTERNS.some((pattern) => pattern.test(text)),
        `${caseId} ${pumpId}.${label}[${index}] persists a deprecated pump envelope warning: ${text}`
      );
    });
  });
}

function validateCase(entry) {
  assert(!entry.disabled, `${entry.id} must be enabled in journals/simulation-cases.json.`);
  assert(entry.sampleFile, `${entry.id} must define sampleFile.`);
  const filePath = path.join(FRONTEND_ROOT, entry.sampleFile);
  assert(fs.existsSync(filePath), `${entry.id} sample file must exist: ${entry.sampleFile}`);

  const { header, project, fileBytes, storedBytes, payloadBytes, decodeMs } = readUntirtaProject(filePath);
  assert.strictEqual(header.fileFormat, 'untirta-npsh-simulation', `${entry.id} header.fileFormat mismatch.`);
  assert.strictEqual(header.fileVersion, 1, `${entry.id} header.fileVersion mismatch.`);
  assert.strictEqual(header.compression, 'gzip', `${entry.id} should use gzip compression for fast local transfer.`);
  assert(storedBytes <= MAX_STORED_BYTES, `${entry.id} stored payload is too large for a sample case: ${storedBytes} bytes.`);
  assert(payloadBytes <= MAX_PAYLOAD_BYTES, `${entry.id} JSON payload is too large for a sample case: ${payloadBytes} bytes.`);
  assert(decodeMs <= MAX_DECODE_MS, `${entry.id} decode took ${decodeMs.toFixed(1)} ms, which indicates file-side load risk.`);
  assert.strictEqual(project.projectFile?.fileFormat, 'untirta-npsh-simulation', `${entry.id} projectFile.fileFormat mismatch.`);
  assert.strictEqual(project.projectFile?.fileVersion, 1, `${entry.id} projectFile.fileVersion mismatch.`);

  const model = project.model || {};
  assert.strictEqual(model.SETTINGS?.type, 'settings', `${entry.id} SETTINGS node must be present.`);
  assert(model.SETTINGS?.props?.unitStandard, `${entry.id} SETTINGS.props.unitStandard must be present.`);
  assertFluid(entry.id, model.FLUID);

  const sourceIds = idsByType(model, 'source');
  const pumpIds = idsByType(model, 'pump');
  const pipeIds = idsByType(model, 'pipe');
  const sinkIds = idsByType(model, 'sink');
  assert.strictEqual(sourceIds.length, 1, `${entry.id} must have exactly one source boundary.`);
  assert.strictEqual(pumpIds.length, 1, `${entry.id} must have exactly one pump.`);
  assert.strictEqual(pipeIds.length, 2, `${entry.id} must have exactly two pipe/fitting/valve objects.`);
  assert.strictEqual(sinkIds.length, 1, `${entry.id} must have exactly one sink boundary.`);

  const [sourceId] = sourceIds;
  const [pumpId] = pumpIds;
  const [sinkId] = sinkIds;
  assertFinite(model[sourceId].props?.flow ?? model[sourceId].results?.flow, `${entry.id} ${sourceId} flow`, 0);
  assertFinite(model[sourceId].props?.pressure ?? model[sourceId].results?.pressure, `${entry.id} ${sourceId} pressure`, 0);
  assertFinite(model[sourceId].props?.elevation, `${entry.id} ${sourceId} elevation`);
  assertFinite(model[sinkId].props?.demandFlow ?? model[sinkId].results?.flow, `${entry.id} ${sinkId} demand flow`, 0);
  assertFinite(model[sinkId].props?.pressure ?? model[sinkId].results?.boundaryPressure, `${entry.id} ${sinkId} pressure`, 0);
  assertFinite(model[sinkId].props?.elevation, `${entry.id} ${sinkId} elevation`);
  assertPump(entry.id, pumpId, model[pumpId], model[sourceId].props?.flow);
  assertNoSuppressedPumpWarnings(entry.id, pumpId, model[pumpId]);

  pipeIds.forEach((pipeId) => {
    assertNoDeprecatedPipeFields(entry.id, pipeId, model[pipeId]);
    assertPipeSegments(entry.id, pipeId, model[pipeId]);
  });

  const connections = Array.isArray(project.connections) ? project.connections : [];
  assert.strictEqual(connections.length, 2, `${entry.id} must persist exactly two hydraulic connections.`);
  const sourceToPump = connections.find((connection) => connection.from === sourceId && connection.to === pumpId);
  const pumpToSink = connections.find((connection) => connection.from === pumpId && connection.to === sinkId);
  assert(sourceToPump, `${entry.id} must connect source -> pump.`);
  assert(pumpToSink, `${entry.id} must connect pump -> sink.`);
  [sourceToPump, pumpToSink].forEach((connection) => {
    assert(pipeIds.includes(connection.pipeId), `${entry.id} connection pipeId must reference a persisted pipe.`);
    assert(!connection.connectionType || connection.connectionType === 'hydraulic', `${entry.id} connections must be hydraulic.`);
  });

  const visuals = project.visuals || {};
  [sourceId, pumpId, sinkId].forEach((nodeId) => {
    assert(visuals[nodeId]?.left && visuals[nodeId]?.top, `${entry.id} visuals must include ${nodeId} canvas placement.`);
  });

  return {
    id: entry.id,
    file: entry.sampleFile,
    fileBytes,
    storedBytes,
    payloadBytes,
    decodeMs: Number(decodeMs.toFixed(3)),
    fluid: model.FLUID.props.fluidName,
    sourceId,
    pumpId,
    sinkId,
    pipeIds
  };
}

function main() {
  const manifest = readJson(CASE_MANIFEST_FILE);
  const entries = CASE_IDS.map((caseId) => {
    const entry = (manifest.cases || []).find((item) => item.id === caseId);
    assert(entry, `${caseId} must exist in journals/simulation-cases.json.`);
    return entry;
  });
  const summaries = entries.map(validateCase);
  console.log(JSON.stringify({
    ok: true,
    schemaVersion: 'simulation-case-file-compatibility.v1',
    maxDecodeMs: MAX_DECODE_MS,
    cases: summaries
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  CASE_IDS,
  validateCase,
  readUntirtaProject
};
