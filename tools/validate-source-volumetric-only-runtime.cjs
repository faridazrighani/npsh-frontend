const fs = require('fs');
const path = require('path');
const assertStrict = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'engineering-source-volumetric-only-runtime.js');
const bilingualPath = path.join(root, 'engineering-bilingual-improvements.js');
const sourceTemperaturePath = path.join(root, 'engineering-source-temperature-runtime.js');
const srcCanvasPath = path.join(root, 'engineering-src-canvas-parameter-runtime.js');
const indexPath = path.join(root, 'index.html');
const manifestPath = path.join(root, 'FILE_MANIFEST.md');
const packagePath = path.join(root, 'package.json');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`Source volumetric-only validation failed: ${message}`);
    process.exit(1);
  }
}

const runtime = read(runtimePath);
const bilingual = read(bilingualPath);
const sourceTemperature = read(sourceTemperaturePath);
const srcCanvas = read(srcCanvasPath);
const index = read(indexPath);
const manifest = read(manifestPath);
const pkg = JSON.parse(read(packagePath));

const runtimeCacheKey = 'engineering-source-volumetric-only-runtime.js?v=20260706-source-snk-flow-sync1';
const bilingualCacheKey = 'engineering-bilingual-improvements.js?v=20260703-source-defense-refresh1';
const sourceTemperatureCacheKey = 'engineering-source-temperature-runtime.js?v=20260706-fluid-temperature-global1';
const srcCanvasCacheKey = 'engineering-src-canvas-parameter-runtime.js?v=20260702-object-status-clean1';
const sourceStandardSections = bilingual.match(/const SOURCE_STANDARD_FORM_SECTIONS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || '';

assert(runtime.includes('2026.07-source-boundary-snk-flow-sync1'), 'runtime version is missing');
assert(runtime.includes('EngineeringSourceVolumetricOnlyRuntime'), 'global API is missing');
assert(index.includes(runtimeCacheKey), 'index must load the volumetric-only runtime');
assert(index.includes(bilingualCacheKey), 'index must cache-bust bilingual source cleanup runtime');
assert(index.includes(sourceTemperatureCacheKey), 'index must cache-bust source temperature runtime');
assert(index.includes(srcCanvasCacheKey), 'index must cache-bust SRC canvas runtime');
assert(manifest.includes('engineering-source-volumetric-only-runtime.js public-safe'), 'manifest inventory entry is missing');
assert(manifest.includes(`Source volumetric-only runtime cache key: ${runtimeCacheKey}`), 'manifest cache key is missing');
assert(pkg.scripts['validate:source-volumetric-only'] === 'node tools/validate-source-volumetric-only-runtime.cjs', 'npm validation script is missing');

[
  'const FLOW_MODE = "Volumetric Flow"',
  'SOURCE_DEFINITION_LABELS',
  '"Source Definition"',
  '"sourceType"',
  '"source-type-meaning"',
  'HIDDEN_SOURCE_FIELD_KEYS',
  '"flowInputMode"',
  '"massFlow"',
  'FLOW_SPEC_LABELS',
  '"Flow Specification"',
  'BOUNDARY_LABELS',
  '"Boundary Data"',
  'SOURCE_ADVISOR_LABELS',
  '"Hydraulic Connection"',
  'moveFlowRowIntoBoundary',
  'removeSourceDefinitionBlock',
  'removeFlowSpecificationBlock',
  'removeSourceAdvisorBlocks',
  'removeDeprecatedRows',
  'syncModelFromFlowInput',
  'syncSinkDemandFromSourceFlow',
  'syncSourceFlowFromSinkDemand',
  'syncAllSinkDemandFromSourceFlow',
  'sinkIdsForSourceFlowSync',
  'sourceIdsForSinkFlowSync',
  'connectedSinkIdsForSource',
  'connectedSourceIdsForSink',
  'source.volumetric-flow/sink.flow-demand',
  'sink.flow-demand/source.volumetric-flow',
  'Flow Demand Boundary',
  'impactedSinkIds',
  'flowDemandSyncedFromSource',
  'flowSyncedFromSink',
  'cleanupSourceContextMenu',
  'startHydraulicConnectionFromSource',
  'Delete Source',
  'MutationObserver'
].forEach((token) => assert(runtime.includes(token), `runtime token is missing: ${token}`));

assert(runtime.includes('props.flowInputMode = FLOW_MODE'), 'source props must be locked to Volumetric Flow');
assert(runtime.includes('previousMode') && runtime.includes('/mass\\s+flow/i.test(previousMode)'), 'legacy Mass Flow mode must convert massFlow to volumetric flow once');
assert(runtime.includes('props.massFlow = derivedMassFlow'), 'mass flow may only be maintained as derived data');
assert(/const after = \(\) => \{\s*cleanupSourceTaskWindows\(document\);/m.test(runtime), 'source task cleanup must run synchronously after render to prevent Flow Specification flash');
assert(!/\bupdateSimulation\s*\(/.test(runtime), 'volumetric-only runtime must not call updateSimulation directly');
assert(!/\bfetch\s*\(/.test(runtime), 'volumetric-only runtime must not call network APIs');
assert(sourceStandardSections, 'bilingual standard form section list is missing');
assert(!sourceStandardSections.includes('Source Definition'), 'bilingual standard form must not require Source Definition');
assert(!sourceStandardSections.includes('Flow Specification'), 'bilingual standard form must not require Flow Specification');
assert(/function removeSourceTypeMeaningRows\(windowNode\) \{\s*if \(!isSourceObjectPropertiesWindow\(windowNode\)\) return 0;\s*let removed = 0;/m.test(bilingual), 'bilingual runtime must remove Type Meaning rows instead of restoring them');
assert(!bilingual.includes('keepSourceTypeMeaningRowsVisible'), 'bilingual runtime must not restore Type Meaning rows');

assert(sourceTemperature.includes("node.props.flowInputMode = 'Volumetric Flow'"), 'source temperature runtime must force Volumetric Flow');
assert(!sourceTemperature.includes("input[data-key=\"massFlow\"]"), 'source temperature runtime must not read Mass Flow input');
assert(!sourceTemperature.includes("setReadout(scope, 'source-mass-flow'"), 'source temperature runtime must not repaint source mass-flow readouts');
assert(srcCanvas.includes('props.flowInputMode = "Volumetric Flow"'), 'SRC canvas runtime must force Volumetric Flow');
assert(!srcCanvas.includes('/mass\\s+flow/i.test(flowMode)'), 'SRC canvas runtime must not use Mass Flow mode');

globalThis.globalModel = {
  'SRC-100': {
    type: 'source',
    props: {
      flowInputMode: 'Volumetric Flow',
      flow: 39.68,
      massFlow: 39500
    }
  },
  'PIPE-1': { type: 'pipe', props: {} },
  'P-100': { type: 'pump', props: {} },
  'PIPE-2': { type: 'pipe', props: {} },
  'SNK-100': {
    type: 'sink',
    props: {
      boundaryMode: 'Outlet Pressure Boundary',
      demandFlow: 0
    }
  },
  connections: [
    { from: 'SRC-100', to: 'P-100', pipeId: 'PIPE-1', connectionType: 'hydraulic' },
    { from: 'P-100', to: 'SNK-100', pipeId: 'PIPE-2', connectionType: 'hydraulic' }
  ]
};
delete require.cache[require.resolve(runtimePath)];
const runtimeModule = require(runtimePath);
assertStrict.equal(Number(globalThis.globalModel['SNK-100'].props.demandFlow), 39.68, 'SNK Flow Demand must sync from SRC Volumetric Flow during runtime install');
assertStrict.equal(Number(globalThis.globalModel['SNK-100'].props.flowDemand), 39.68, 'SNK flowDemand alias must sync from SRC Volumetric Flow');
assertStrict.equal(globalThis.globalModel['SNK-100'].props.boundaryMode, 'Flow Demand Boundary', 'SNK must remain an active Flow Demand Boundary when synced from SRC');
assertStrict.equal(globalThis.globalModel['SNK-100'].props.flowDemandSyncedFromSource, 'SRC-100', 'SNK sync metadata should identify the source');
globalThis.globalModel['SRC-100'].props.flow = 42.5;
const syncResult = runtimeModule.syncSinkDemandFromSourceFlow('SRC-100', globalThis.globalModel['SRC-100'], globalThis.globalModel, { refreshInputs: false });
assertStrict.deepEqual(syncResult.sinkIds, ['SNK-100'], 'SRC flow sync should target the connected SNK route');
assertStrict.equal(Number(globalThis.globalModel['SNK-100'].props.demandFlow), 42.5, 'SNK Flow Demand must follow revised SRC Volumetric Flow');
globalThis.globalModel['SNK-100'].props.demandFlow = 55.25;
const reverseSyncResult = runtimeModule.syncSourceFlowFromSinkDemand('SNK-100', globalThis.globalModel['SNK-100'], globalThis.globalModel, { refreshInputs: false });
assertStrict.deepEqual(reverseSyncResult.sourceIds, ['SRC-100'], 'SNK demand sync should target the connected SRC route');
assertStrict.equal(Number(globalThis.globalModel['SRC-100'].props.flow), 55.25, 'SRC Volumetric Flow must follow revised SNK Flow Demand when SNK is edited');
assertStrict.equal(Number(globalThis.globalModel['SNK-100'].props.demandFlow), 55.25, 'SNK Flow Demand should remain equal to the revised global route flow');

console.log('Source volumetric-only runtime validation passed.');
