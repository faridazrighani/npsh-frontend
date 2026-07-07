const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const CASE_MANIFEST_FILE = path.join(FRONTEND_ROOT, 'journals', 'simulation-cases.json');
const UNTIRTA_MAGIC = 'UNTIRTA-NPSH-V1\n';
const CURRENT_LAYOUT_SCHEMA = 'pipe-properties-current-layout.v1';

const REMOVED_PIPE_PROPERTY_KEYS = Object.freeze([
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
]);

const REMOVED_PIPE_SEGMENT_KEYS = Object.freeze([
  'startElevation',
  'endElevation',
  'zIn',
  'zOut',
  'highPointElevation',
  'highPointLocationPercent'
]);

const REMOVED_PIPE_RESULT_KEYS = Object.freeze([
  'highPointElevation',
  'highPointPressure',
  'highPointVaporMargin',
  'highPointSegment',
  'highPointLocationPercent'
]);

const SUPPRESSED_PUMP_WARNING_PATTERNS = Object.freeze([
  /\benvelope\s+scan\b/i,
  /\boperating\s+envelope\b/i,
  /\bcomplete\s+inputs?\b.*\b(design\s+flow|design\s+head|design\s+eff|bep|por|aor)\b/i,
  /\bdesign\s+flow\b.*\bdesign\s+head\b.*\bdesign\s+eff/i,
  /\bdesign\s+efficiency\b/i,
  /\bbep\s+flow\b/i,
  /\bpump\s+duty\s+sizing\b/i,
  /\bpor\s+(min|max)\b/i,
  /\baor\s+(min|max)\b/i
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readUntirtaProject(filePath) {
  const file = fs.readFileSync(filePath);
  const magic = Buffer.from(UNTIRTA_MAGIC, 'utf8');
  if (!file.subarray(0, magic.length).equals(magic)) {
    throw new Error(`${filePath} is not an UNTIRTA project file.`);
  }

  const headerLength = Number.parseInt(file.subarray(magic.length, magic.length + 8).toString('ascii'), 16);
  if (!Number.isFinite(headerLength) || headerLength <= 0) {
    throw new Error(`${filePath} has an invalid UNTIRTA header length.`);
  }

  const headerStart = magic.length + 8;
  const payloadStart = headerStart + headerLength;
  const header = JSON.parse(file.subarray(headerStart, payloadStart).toString('utf8'));
  const payloadBuffer = file.subarray(payloadStart, payloadStart + header.payloadBytes);
  const payloadText = header.compression === 'gzip'
    ? zlib.gunzipSync(payloadBuffer).toString('utf8')
    : payloadBuffer.toString('utf8');

  return {
    header,
    project: JSON.parse(payloadText)
  };
}

function writeUntirtaProject(filePath, originalHeader, project) {
  const payloadBuffer = Buffer.from(JSON.stringify(project), 'utf8');
  const compression = originalHeader.compression === 'gzip' ? 'gzip' : 'none';
  const storedPayload = compression === 'gzip'
    ? zlib.gzipSync(payloadBuffer, { level: 9, mtime: 0 })
    : payloadBuffer;
  const header = {
    ...originalHeader,
    fileFormat: 'untirta-npsh-simulation',
    fileVersion: originalHeader.fileVersion || 1,
    compression,
    checksum: sha256(storedPayload),
    payloadBytes: storedPayload.length,
    savedAt: new Date().toISOString()
  };
  const headerBuffer = Buffer.from(JSON.stringify(header), 'utf8');
  const headerLength = Buffer.from(headerBuffer.length.toString(16).padStart(8, '0'), 'ascii');
  fs.writeFileSync(filePath, Buffer.concat([
    Buffer.from(UNTIRTA_MAGIC, 'utf8'),
    headerLength,
    headerBuffer,
    storedPayload
  ]));
}

function listSimulationFiles() {
  const manifest = readJson(CASE_MANIFEST_FILE);
  return (manifest.cases || [])
    .map((entry) => entry.sampleFile)
    .filter(Boolean)
    .map((sampleFile) => path.join(FRONTEND_ROOT, sampleFile));
}

function removeKeys(target, keys, audit, scope) {
  if (!target || typeof target !== 'object') return;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      delete target[key];
      audit.changes.push(`removed ${scope}.${key}`);
    }
  }
}

function finiteNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function firstFinite(...values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== null && number > 0) return number;
  }
  return null;
}

function warningText(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return [
    value.message,
    value.label,
    value.title,
    value.detail,
    value.fullDetail,
    value.field,
    value.key,
    value.id
  ].filter(Boolean).join(' ');
}

function isSuppressedPumpWarning(value) {
  const text = warningText(value);
  return text && SUPPRESSED_PUMP_WARNING_PATTERNS.some((pattern) => pattern.test(text));
}

function cleanPumpWarningArrays(target, audit, scope) {
  if (!target || typeof target !== 'object') return;
  if (Array.isArray(target)) {
    target.forEach((item, index) => cleanPumpWarningArrays(item, audit, `${scope}[${index}]`));
    return;
  }
  for (const [key, value] of Object.entries(target)) {
    if (Array.isArray(value) && /^(warnings|validationWarnings)$/i.test(key)) {
      const filtered = value.filter((warning) => !isSuppressedPumpWarning(warning));
      if (filtered.length !== value.length) {
        target[key] = filtered;
        audit.changes.push(`removed deprecated pump envelope warnings from ${scope}.${key}`);
      }
    }
    cleanPumpWarningArrays(target[key], audit, `${scope}.${key}`);
  }
}

function curveNpshrAtActiveFlow(props = {}, results = {}) {
  const activeFlow = firstFinite(results.flow, results.npshEvaluation?.flow, props.designFlow);
  if (activeFlow === null || !Array.isArray(props.curveData)) return null;
  const match = props.curveData.find((point) => {
    const pointFlow = finiteNumber(point?.flow);
    return pointFlow !== null && Math.abs(pointFlow - activeFlow) <= 1e-6;
  });
  return finiteNumber(match?.npshr);
}

function cleanPumpNode(nodeId, node, audit) {
  const props = node.props || {};
  const results = node.results || {};
  cleanPumpWarningArrays(node, audit, nodeId);
  if (firstFinite(props.manualNpshr) !== null) return;

  const manualNpshr = firstFinite(
    results.npshr,
    results.npshEvaluation?.npshr,
    curveNpshrAtActiveFlow(props, results),
    props.designNpshr
  );
  if (manualNpshr === null) return;

  props.manualNpshr = manualNpshr;
  if (!props.npshrEvidenceReference) {
    props.npshrEvidenceReference = props.curveFitNpshrBasis
      || props.curveSourceNote
      || 'Migrated from persisted journal NPSHr so protected backend calculations can use explicit current Manual NPSHr.';
  }
  node.props = props;
  audit.changes.push(`added ${nodeId}.props.manualNpshr`);
}

function cleanPipeNode(nodeId, node, audit) {
  removeKeys(node.props, REMOVED_PIPE_PROPERTY_KEYS, audit, `${nodeId}.props`);

  if (Array.isArray(node.props?.segments)) {
    node.props.segments.forEach((segment, index) => {
      removeKeys(segment, REMOVED_PIPE_SEGMENT_KEYS, audit, `${nodeId}.props.segments[${index}]`);
    });
  }

  removeKeys(node.results, REMOVED_PIPE_RESULT_KEYS, audit, `${nodeId}.results`);

  if (Array.isArray(node.results?.segmentProfiles)) {
    node.results.segmentProfiles.forEach((profile, index) => {
      removeKeys(profile, REMOVED_PIPE_RESULT_KEYS, audit, `${nodeId}.results.segmentProfiles[${index}]`);
    });
  }
}

function cleanProject(project) {
  const audit = { changes: [] };
  for (const [nodeId, node] of Object.entries(project.model || {})) {
    if (node?.type === 'pipe') cleanPipeNode(nodeId, node, audit);
    if (node?.type === 'pump') cleanPumpNode(nodeId, node, audit);
  }

  project.projectFile = project.projectFile || {};
  project.projectFile.currentLayoutMigration = {
    schemaVersion: CURRENT_LAYOUT_SCHEMA,
    removedPipePropertyKeys: REMOVED_PIPE_PROPERTY_KEYS,
    removedPipeSegmentKeys: REMOVED_PIPE_SEGMENT_KEYS,
    removedPipeResultKeys: REMOVED_PIPE_RESULT_KEYS,
    note: 'Persisted sample files remove deprecated Pipe Properties fields hidden by the current UI layout.'
  };

  return audit;
}

function main() {
  const files = listSimulationFiles();
  if (files.length !== 6) {
    throw new Error(`Expected 6 simulation .untirta files; found ${files.length}.`);
  }

  const summaries = files.map((filePath) => {
    const { header, project } = readUntirtaProject(filePath);
    const before = JSON.stringify(project);
    const audit = cleanProject(project);
    const after = JSON.stringify(project);
    const changed = before !== after;
    if (changed) writeUntirtaProject(filePath, header, project);
    return {
      file: path.relative(FRONTEND_ROOT, filePath).replace(/\\/g, '/'),
      changed,
      changeCount: audit.changes.length
    };
  });

  console.log(JSON.stringify({
    ok: true,
    schemaVersion: CURRENT_LAYOUT_SCHEMA,
    files: summaries
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  CURRENT_LAYOUT_SCHEMA,
  REMOVED_PIPE_PROPERTY_KEYS,
  REMOVED_PIPE_SEGMENT_KEYS,
  REMOVED_PIPE_RESULT_KEYS,
  cleanProject,
  listSimulationFiles,
  readUntirtaProject
};
