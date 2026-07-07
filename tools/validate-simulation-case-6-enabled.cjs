const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');

const {
  CURRENT_LAYOUT_SCHEMA,
  cleanProject
} = require('./upgrade-simulation-untirta-current-layout.cjs');

const frontendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(frontendRoot, '..');
const apiRoot = path.join(workspaceRoot, 'npsh-api');
const caseId = 'simulation-case-6';
const caseFileName = 'Evaluasi_Pompa_Sentrifugal_P-2941A_sebagai_Pompa_Air_Panas.untirta';
const caseSampleFile = `journals/simulasi_6/${caseFileName}`;
const optionalPapahSource = process.env.NPSH_CASE6_SOURCE
  || path.join(os.homedir(), 'Downloads', 'Papah-sim-6.untirta');

const manifestPaths = [
  path.join(frontendRoot, 'journals', 'simulation-cases.json'),
  path.join(frontendRoot, 'npsh-frontend', 'journals', 'simulation-cases.json'),
  path.join(apiRoot, 'public', 'journals', 'simulation-cases.json'),
  path.join(apiRoot, 'public', 'npsh-frontend', 'journals', 'simulation-cases.json')
];

const casePaths = [
  path.join(frontendRoot, caseSampleFile),
  path.join(frontendRoot, 'npsh-frontend', caseSampleFile),
  path.join(apiRoot, 'public', caseSampleFile),
  path.join(apiRoot, 'public', 'npsh-frontend', caseSampleFile)
];

function readJson(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readUntirtaProject(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  const file = fs.readFileSync(filePath);
  const magic = Buffer.from('UNTIRTA-NPSH-V1\n', 'utf8');
  assert(file.subarray(0, magic.length).equals(magic), `${filePath} must use UNTIRTA magic header.`);
  const headerLength = Number.parseInt(file.subarray(magic.length, magic.length + 8).toString('ascii'), 16);
  assert(Number.isFinite(headerLength) && headerLength > 0, `${filePath} must have a valid header length.`);
  const headerStart = magic.length + 8;
  const payloadStart = headerStart + headerLength;
  const header = JSON.parse(file.subarray(headerStart, payloadStart).toString('utf8'));
  const payload = file.subarray(payloadStart, payloadStart + header.payloadBytes);
  assert.equal(header.fileFormat, 'untirta-npsh-simulation', `${filePath} must keep the official .untirta format.`);
  assert.equal(header.checksum, sha256(payload), `${filePath} must match its stored checksum.`);
  const payloadText = header.compression === 'gzip'
    ? zlib.gunzipSync(payload).toString('utf8')
    : payload.toString('utf8');
  const project = JSON.parse(payloadText);
  assert(project.model && typeof project.model === 'object', `${filePath} must contain a model.`);
  return { file, header, project };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertManifestEnabled(filePath) {
  const manifest = readJson(filePath);
  const entry = manifest.cases?.find((item) => item.id === caseId);
  assert(entry, `${filePath} must include ${caseId}.`);
  assert.equal(entry.sampleFile, caseSampleFile, `${filePath} must point case 6 to the P-2941A .untirta file.`);
  assert.equal(entry.disabled, undefined, `${filePath} must not disable case 6.`);
  assert.equal(entry.disabledReason, undefined, `${filePath} must not keep the case 6 disabled reason.`);
  assert.equal(entry.title, 'P-2941A Hot Water Pump Evaluation', `${filePath} must keep the English case 6 title.`);
}

function nodesByType(model, type) {
  return Object.entries(model || {}).filter(([, node]) => node?.type === type);
}

function finite(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function assertCaseProject(project, filePath) {
  assert.equal(
    project.projectFile?.currentLayoutMigration?.schemaVersion,
    CURRENT_LAYOUT_SCHEMA,
    `${filePath} must be migrated to ${CURRENT_LAYOUT_SCHEMA}.`
  );
  const model = project.model || {};
  const pumps = nodesByType(model, 'pump');
  const sources = nodesByType(model, 'source');
  const sinks = nodesByType(model, 'sink');
  const pipes = nodesByType(model, 'pipe');
  assert.equal(pumps.length, 1, `${filePath} must contain one pump.`);
  assert.equal(sources.length, 1, `${filePath} must contain one source.`);
  assert.equal(sinks.length, 1, `${filePath} must contain one sink.`);
  assert(pipes.length >= 1, `${filePath} must contain pipe objects.`);
  assert.equal(pumps[0][0], 'P-100', `${filePath} must keep the pump node used by the P-2941A case.`);
  assert.match(path.basename(filePath), /P-2941A.*Pompa_Air_Panas/i, `${filePath} must keep the P-2941A hot-water filename context.`);
  assert.match(pumps[0][1].name || '', /P-100/i, `${filePath} must keep the pump display tag used by the case.`);
  assert.equal(model.FLUID?.props?.fluidName, 'Water', `${filePath} must use Water as Fluid Basis.`);
  assert.equal(finite(model.FLUID?.props?.temperature), 90, `${filePath} must keep 90 deg C Fluid Basis.`);
  assert.equal(finite(model['SNK-100']?.props?.demandFlow), 39.68, `${filePath} must keep the 39.68 m3/h flow demand.`);
  assert(Array.isArray(project.connections) && project.connections.length >= 1, `${filePath} must keep hydraulic connections.`);
}

manifestPaths.forEach(assertManifestEnabled);

const decodedCases = casePaths.map((filePath) => {
  const decoded = readUntirtaProject(filePath);
  assertCaseProject(decoded.project, filePath);
  return { filePath, hash: sha256(decoded.file), project: decoded.project };
});

const [first] = decodedCases;
decodedCases.forEach((item) => {
  assert.equal(item.hash, first.hash, `${item.filePath} must be byte-identical to the frontend case 6 .untirta file.`);
});

let papahSourceCompared = false;
if (fs.existsSync(optionalPapahSource)) {
  const source = readUntirtaProject(optionalPapahSource);
  const migratedSourceProject = deepClone(source.project);
  cleanProject(migratedSourceProject);
  assert.deepEqual(
    first.project,
    migratedSourceProject,
    'Frontend case 6 must match Papah-sim-6.untirta after current-layout migration.'
  );
  papahSourceCompared = true;
}

console.log(JSON.stringify({
  ok: true,
  caseId,
  sampleFile: caseSampleFile,
  caseHash: first.hash,
  schemaVersion: CURRENT_LAYOUT_SCHEMA,
  manifestCount: manifestPaths.length,
  mirrorCount: decodedCases.length,
  papahSourceCompared
}, null, 2));
