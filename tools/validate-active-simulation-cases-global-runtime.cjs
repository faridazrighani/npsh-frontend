const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  readUntirtaProject
} = require('./upgrade-simulation-untirta-current-layout.cjs');
const {
  ACTIVE_CASE_IDS,
  GLOBAL_RUNTIME_SCHEMA,
  LAYOUT_PROFILE,
  CALCULATION_AUTHORITY,
  CANONICAL_POSITIONS,
  ASSET_ROOTS
} = require('./upgrade-active-simulation-cases-global-runtime.cjs');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const MANIFEST_FILE = path.join(FRONTEND_ROOT, 'journals', 'simulation-cases.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function finiteNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function oneNode(model, type, caseId) {
  const nodes = Object.entries(model || {}).filter(([, node]) => node?.type === type);
  assert.equal(nodes.length, 1, `${caseId} must contain exactly one ${type} node.`);
  return nodes[0];
}

function assertSameNumber(actual, expected, label) {
  assert.notEqual(finiteNumber(actual), null, `${label} must be finite.`);
  assert.equal(Number(actual), Number(expected), `${label} must stay synchronized.`);
}

function assertInputOnlyResults(caseId, model) {
  for (const [nodeId, node] of Object.entries(model)) {
    assert.deepEqual(
      node.results || {},
      {},
      `${caseId} ${nodeId} must not persist stale runtime results; the global backend recalculates them.`
    );
  }
}

function validateCase(entry) {
  assert(!entry.disabled, `${entry.id} must remain enabled.`);
  assert.equal(entry.runtimeSchemaVersion, GLOBAL_RUNTIME_SCHEMA, `${entry.id} manifest runtime schema mismatch.`);
  assert.equal(entry.layoutProfile, LAYOUT_PROFILE, `${entry.id} manifest layout profile mismatch.`);
  assert.equal(entry.calculationAuthority, CALCULATION_AUTHORITY, `${entry.id} manifest calculation authority mismatch.`);

  const filePath = path.join(FRONTEND_ROOT, entry.sampleFile);
  assert(fs.existsSync(filePath), `${entry.id} main sample file must exist.`);
  ASSET_ROOTS.forEach((assetRoot) => {
    const mirrorPath = path.join(assetRoot, entry.sampleFile);
    assert(fs.existsSync(mirrorPath), `${entry.id} mirrored sample file must exist: ${mirrorPath}`);
    assert.equal(hashFile(mirrorPath), hashFile(filePath), `${entry.id} mirrored sample must be byte-identical: ${mirrorPath}`);
  });

  const { project } = readUntirtaProject(filePath);
  const migration = project.projectFile?.globalRuntimeMigration;
  assert.equal(migration?.schemaVersion, GLOBAL_RUNTIME_SCHEMA, `${entry.id} project runtime schema mismatch.`);
  assert.equal(migration?.layoutProfile, LAYOUT_PROFILE, `${entry.id} project layout profile mismatch.`);
  assert.equal(migration?.calculationAuthority, CALCULATION_AUTHORITY, `${entry.id} project calculation authority mismatch.`);
  assert.equal(
    migration?.persistedResultPolicy,
    'input-only-recalculate-on-open-and-validate',
    `${entry.id} must use the input-only result policy.`
  );

  const model = project.model || {};
  const [, settings] = oneNode(model, 'settings', entry.id);
  const [, fluid] = oneNode(model, 'fluid', entry.id);
  const [sourceId, source] = oneNode(model, 'source', entry.id);
  const [pumpId, pump] = oneNode(model, 'pump', entry.id);
  const [sinkId, sink] = oneNode(model, 'sink', entry.id);
  const pipes = Object.entries(model).filter(([, node]) => node?.type === 'pipe');
  assert.equal(pipes.length, 2, `${entry.id} must contain suction and discharge pipes.`);

  assert.equal(settings.props?.language, 'en', `${entry.id} must open in English.`);
  assert.equal(settings.props?.sourceFormat, 'sample-case', `${entry.id} must be identified as a sample case.`);
  assert.equal(settings.props?.scenarioActive, true, `${entry.id} scenario must be active.`);
  assert.equal(settings.props?.basisConfirmed, true, `${entry.id} Fluid Basis must be confirmed.`);
  assert.equal(settings.props?.basisDirty, false, `${entry.id} Fluid Basis must not open dirty.`);

  assertSameNumber(fluid.props?.temperature, fluid.props?.temp, `${entry.id} Fluid Basis temperature aliases`);
  assertSameNumber(fluid.props?.kinematicViscosity, fluid.props?.viscosity, `${entry.id} kinematic-viscosity aliases`);
  assertSameNumber(fluid.props?.dynamicViscosity, fluid.props?.dynViscosity, `${entry.id} dynamic-viscosity aliases`);
  assert.equal(fluid.props?.temperaturePropertySynced, true, `${entry.id} temperature properties must be synchronized.`);

  assert.equal(source.props?.flowInputMode, 'Volumetric Flow', `${entry.id} SRC must use volumetric flow input.`);
  assertSameNumber(source.props?.volumetricFlow, source.props?.flow, `${entry.id} SRC flow aliases`);
  assertSameNumber(source.props?.temp, fluid.props?.temp, `${entry.id} SRC temperature basis`);
  const expectedMassFlow = Number(source.props.flow) * Number(fluid.props.density);
  assert(Math.abs(Number(source.props.massFlow) - expectedMassFlow) < 1e-7, `${entry.id} SRC mass flow must derive from Q x density.`);

  assert.equal(sink.props?.boundaryMode, 'Flow Demand Boundary', `${entry.id} SNK must use flow-demand boundary mode.`);
  assertSameNumber(sink.props?.flowDemand, sink.props?.demandFlow, `${entry.id} SNK flow-demand aliases`);
  assert.equal(pump.props?.npshrSourceMode, 'Manual', `${entry.id} pump must use manual NPSHr mode.`);
  assert(finiteNumber(pump.props?.manualNpshr) >= 0, `${entry.id} pump manual NPSHr must be non-negative.`);

  pipes.forEach(([pipeId, pipe]) => {
    assert(Array.isArray(pipe.props?.segments) && pipe.props.segments.length > 0, `${entry.id} ${pipeId} must keep PFV inputs.`);
    pipe.props.segments.forEach((segment, index) => {
      assert(finiteNumber(segment.diameter) > 0, `${entry.id} ${pipeId} segment ${index + 1} diameter must be positive.`);
      assert(finiteNumber(segment.length) >= 0, `${entry.id} ${pipeId} segment ${index + 1} length must be non-negative.`);
      assert(finiteNumber(segment.roughness) >= 0, `${entry.id} ${pipeId} segment ${index + 1} roughness must be non-negative.`);
    });
  });

  const [suctionPipeId, dischargePipeId] = pipes.map(([id]) => id);
  assert.deepEqual(project.connections, [
    {
      from: sourceId,
      fromPort: '.port.outlet',
      to: pumpId,
      toPort: '.port.inlet',
      pipeId: suctionPipeId,
      connectionType: 'hydraulic'
    },
    {
      from: pumpId,
      fromPort: '.port.outlet',
      to: sinkId,
      toPort: '.port.inlet',
      pipeId: dischargePipeId,
      connectionType: 'hydraulic'
    }
  ], `${entry.id} must use the canonical forward hydraulic route.`);

  assert.deepEqual(project.visuals?.[sourceId], CANONICAL_POSITIONS.source, `${entry.id} SRC canvas position mismatch.`);
  assert.deepEqual(project.visuals?.[pumpId], CANONICAL_POSITIONS.pump, `${entry.id} pump canvas position mismatch.`);
  assert.deepEqual(project.visuals?.[sinkId], CANONICAL_POSITIONS.sink, `${entry.id} SNK canvas position mismatch.`);
  assertInputOnlyResults(entry.id, model);

  return {
    id: entry.id,
    file: entry.sampleFile,
    fluid: fluid.props.fluidName,
    flow: source.props.flow,
    manualNpshr: pump.props.manualNpshr,
    route: `${sourceId} -> ${suctionPipeId} -> ${pumpId} -> ${dischargePipeId} -> ${sinkId}`,
    mirrorCount: ASSET_ROOTS.length
  };
}

function main() {
  const manifest = readJson(MANIFEST_FILE);
  ASSET_ROOTS.forEach((assetRoot) => {
    const mirrorManifest = path.join(assetRoot, 'journals', 'simulation-cases.json');
    assert(fs.existsSync(mirrorManifest), `Mirrored simulation-case manifest must exist: ${mirrorManifest}`);
    assert.equal(hashFile(mirrorManifest), hashFile(MANIFEST_FILE), `Manifest must be byte-identical: ${mirrorManifest}`);
  });

  const summaries = ACTIVE_CASE_IDS.map((caseId) => {
    const entry = (manifest.cases || []).find((item) => item.id === caseId);
    assert(entry, `${caseId} must exist in the manifest.`);
    return validateCase(entry);
  });

  console.log(JSON.stringify({
    ok: true,
    schemaVersion: GLOBAL_RUNTIME_SCHEMA,
    cases: summaries
  }, null, 2));
}

if (require.main === module) main();

module.exports = { validateCase };
