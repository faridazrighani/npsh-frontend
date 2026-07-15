const fs = require('node:fs');
const path = require('node:path');

const {
  readUntirtaProject,
  writeUntirtaProject
} = require('./upgrade-simulation-untirta-current-layout.cjs');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(FRONTEND_ROOT, '..');
const CASE_MANIFEST_FILE = path.join(FRONTEND_ROOT, 'journals', 'simulation-cases.json');
const ASSET_ROOTS = Object.freeze([
  path.join(FRONTEND_ROOT, 'npsh-frontend'),
  path.join(WORKSPACE_ROOT, 'npsh-api', 'public'),
  path.join(WORKSPACE_ROOT, 'npsh-api', 'public', 'npsh-frontend')
]);
const ACTIVE_CASE_IDS = Object.freeze([
  'simulation-case-1',
  'simulation-case-4',
  'simulation-case-5',
  'simulation-case-6'
]);
const GLOBAL_RUNTIME_SCHEMA = 'simulation-case-global-runtime.v1';
const LAYOUT_PROFILE = 'global-forward-route.v1';
const CALCULATION_AUTHORITY = 'protected-backend';

const CANONICAL_POSITIONS = Object.freeze({
  source: Object.freeze({ left: '115px', top: '228px' }),
  pump: Object.freeze({ left: '461px', top: '228px' }),
  sink: Object.freeze({ left: '808px', top: '228px' })
});

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function finiteNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function nodesByType(model, type) {
  return Object.entries(model || {}).filter(([, node]) => node?.type === type);
}

function oneNode(model, type, caseId) {
  const nodes = nodesByType(model, type);
  if (nodes.length !== 1) {
    throw new Error(`${caseId} must contain exactly one ${type} node; found ${nodes.length}.`);
  }
  return nodes[0];
}

function normalizeSettings(settings) {
  settings.props = settings.props || {};
  Object.assign(settings.props, {
    language: 'en',
    unitStandard: settings.props.unitStandard || 'Metric',
    basisConfirmed: true,
    basisDirty: false,
    sourceFormat: 'sample-case',
    scenarioActive: true,
    dynamicSimulationTimeSeconds: 0,
    dynamicInventoryEnabled: false,
    lastDynamicStepStatus: 'Ready'
  });
  delete settings.props.dirtyReason;
}

function normalizeFluid(fluid) {
  fluid.props = fluid.props || {};
  const props = fluid.props;
  const temperature = finiteNumber(props.temp ?? props.temperature);
  const kinematicViscosity = finiteNumber(props.viscosity ?? props.kinematicViscosity);
  const dynamicViscosity = finiteNumber(props.dynViscosity ?? props.dynamicViscosity);
  if (temperature === null || kinematicViscosity === null || dynamicViscosity === null) {
    throw new Error('Fluid Basis temperature and viscosity inputs must be finite before migration.');
  }
  Object.assign(props, {
    temp: temperature,
    temperature,
    viscosity: kinematicViscosity,
    kinematicViscosity,
    dynViscosity: dynamicViscosity,
    dynamicViscosity,
    sourceTemperatureBasis: 'Fluid Basis temperature',
    fluidPropertySource: 'Fluid Basis property calculation',
    temperaturePropertySynced: true,
    temperaturePropertySyncRequested: false
  });
}

function normalizeSource(source, fluid) {
  source.props = source.props || {};
  const props = source.props;
  const flow = finiteNumber(props.volumetricFlow ?? props.flow);
  const density = finiteNumber(fluid.props?.density);
  const temperature = finiteNumber(fluid.props?.temp);
  if (flow === null || flow < 0 || density === null || density <= 0 || temperature === null) {
    throw new Error('SRC flow, Fluid Basis density, and temperature must be valid before migration.');
  }
  Object.assign(props, {
    boundaryDataSource: 'Manual',
    temperatureMode: 'Use Fluid Basis',
    temp: temperature,
    flowInputMode: 'Volumetric Flow',
    flow,
    volumetricFlow: flow,
    massFlow: flow * density,
    massFlowDerived: true,
    flowInputModeLockedBy: 'global-workflow'
  });
}

function normalizeSink(sink, source) {
  sink.props = sink.props || {};
  const props = sink.props;
  const flow = finiteNumber(props.flowDemand ?? props.demandFlow ?? source.props?.flow);
  if (flow === null || flow < 0) throw new Error('SNK flow demand must be valid before migration.');
  Object.assign(props, {
    active: 'Active',
    boundaryMode: 'Flow Demand Boundary',
    pressureBasis: props.pressureBasis || 'Static',
    demandFlow: flow,
    flowDemand: flow,
    flowDemandSyncedFromSource: true,
    flowDemandSyncBasis: 'Volumetric Flow'
  });
}

function normalizePump(pump) {
  pump.props = pump.props || {};
  const props = pump.props;
  const manualNpshr = finiteNumber(props.manualNpshr ?? props.designNpshr);
  if (manualNpshr === null || manualNpshr < 0) {
    throw new Error('Pump manual NPSHr must be a non-negative number before migration.');
  }
  Object.assign(props, {
    inputMode: props.inputMode || 'Manual',
    npshrSourceMode: 'Manual',
    manualNpshr
  });
}

function normalizeConnections(project, sourceId, pumpId, sinkId, pipeIds) {
  const [suctionPipeId, dischargePipeId] = pipeIds;
  project.connections = [
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
  ];
}

function normalizeVisuals(project, sourceId, pumpId, sinkId) {
  project.visuals = {
    ...(project.visuals || {}),
    [sourceId]: { ...CANONICAL_POSITIONS.source },
    [pumpId]: { ...CANONICAL_POSITIONS.pump },
    [sinkId]: { ...CANONICAL_POSITIONS.sink }
  };
}

function clearPersistedRuntimeResults(model) {
  for (const node of Object.values(model || {})) {
    node.results = {};
  }
}

function migrateProject(caseId, project) {
  const model = project.model || {};
  const [, settings] = oneNode(model, 'settings', caseId);
  const [, fluid] = oneNode(model, 'fluid', caseId);
  const [sourceId, source] = oneNode(model, 'source', caseId);
  const [pumpId, pump] = oneNode(model, 'pump', caseId);
  const [sinkId, sink] = oneNode(model, 'sink', caseId);
  const pipes = nodesByType(model, 'pipe');
  if (pipes.length !== 2) throw new Error(`${caseId} must contain exactly two pipe nodes; found ${pipes.length}.`);

  normalizeSettings(settings);
  normalizeFluid(fluid);
  normalizeSource(source, fluid);
  normalizeSink(sink, source);
  normalizePump(pump);
  normalizeConnections(project, sourceId, pumpId, sinkId, pipes.map(([id]) => id));
  normalizeVisuals(project, sourceId, pumpId, sinkId);
  clearPersistedRuntimeResults(model);

  project.projectFile = project.projectFile || {};
  Object.assign(project.projectFile, {
    sourceFormat: 'sample-case',
    globalRuntimeMigration: {
      schemaVersion: GLOBAL_RUNTIME_SCHEMA,
      layoutProfile: LAYOUT_PROFILE,
      calculationAuthority: CALCULATION_AUTHORITY,
      persistedResultPolicy: 'input-only-recalculate-on-open-and-validate',
      forwardWorkflow: 'Fluid Basis -> SRC -> Pipe/Fitting/Valve suction -> Pump -> Pipe/Fitting/Valve discharge -> SNK',
      reverseWorkflow: 'SNK -> Pipe/Fitting/Valve discharge -> Pump -> Pipe/Fitting/Valve suction -> SRC -> Fluid Basis',
      note: 'Sample-case files persist engineering inputs and layout only. The current global backend recalculates all runtime results.'
    }
  });
}

function updateManifest(manifest) {
  for (const caseId of ACTIVE_CASE_IDS) {
    const entry = (manifest.cases || []).find((item) => item.id === caseId);
    if (!entry) throw new Error(`${caseId} is missing from the simulation-case manifest.`);
    delete entry.disabled;
    delete entry.disabledReason;
    delete entry.disabledReasonI18n;
    Object.assign(entry, {
      runtimeSchemaVersion: GLOBAL_RUNTIME_SCHEMA,
      layoutProfile: LAYOUT_PROFILE,
      calculationAuthority: CALCULATION_AUTHORITY
    });
  }
}

function writeJson(filePath, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== next) {
    fs.writeFileSync(filePath, next, 'utf8');
  }
}

function main() {
  const manifest = readJson(CASE_MANIFEST_FILE);
  updateManifest(manifest);
  writeJson(CASE_MANIFEST_FILE, manifest);

  const summaries = [];
  for (const caseId of ACTIVE_CASE_IDS) {
    const entry = manifest.cases.find((item) => item.id === caseId);
    const filePath = path.join(FRONTEND_ROOT, entry.sampleFile);
    const { header, project } = readUntirtaProject(filePath);
    const before = JSON.stringify(project);
    migrateProject(caseId, project);
    if (before !== JSON.stringify(project)) writeUntirtaProject(filePath, header, project);

    ASSET_ROOTS.forEach((assetRoot) => {
      const mirrorPath = path.join(assetRoot, entry.sampleFile);
      fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
      fs.copyFileSync(filePath, mirrorPath);
    });
    summaries.push({ id: caseId, file: entry.sampleFile });
  }

  ASSET_ROOTS.forEach((assetRoot) => {
    const mirrorManifest = path.join(assetRoot, 'journals', 'simulation-cases.json');
    fs.mkdirSync(path.dirname(mirrorManifest), { recursive: true });
    fs.copyFileSync(CASE_MANIFEST_FILE, mirrorManifest);
  });

  console.log(JSON.stringify({
    ok: true,
    schemaVersion: GLOBAL_RUNTIME_SCHEMA,
    calculationAuthority: CALCULATION_AUTHORITY,
    cases: summaries
  }, null, 2));
}

if (require.main === module) main();

module.exports = {
  ACTIVE_CASE_IDS,
  GLOBAL_RUNTIME_SCHEMA,
  LAYOUT_PROFILE,
  CALCULATION_AUTHORITY,
  CANONICAL_POSITIONS,
  ASSET_ROOTS,
  migrateProject,
  updateManifest
};
