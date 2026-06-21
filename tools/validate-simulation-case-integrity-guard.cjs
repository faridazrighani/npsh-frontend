const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-simulation-case-integrity-guard.js');
const indexPath = path.join(rootDir, 'index.html');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');
const packagePath = path.join(rootDir, 'package.json');

const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const manifestSource = fs.readFileSync(manifestPath, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

global.globalModel = { SETTINGS: { type: 'settings' }, FLUID: { type: 'fluid', props: { fluidName: 'Water' } } };
const guard = require(runtimePath);

assert.strictEqual(guard.version, 'engineering-simulation-case-integrity-guard.v1', 'Integrity guard must expose version v1.');
assert.strictEqual(guard.cacheKey, '20260614-simulation-case-integrity3', 'Integrity guard must expose the cache key.');
assert.strictEqual(typeof guard.isSimulationCase4PartialModel, 'function', 'Integrity guard must expose partial-model detection.');
assert.strictEqual(typeof guard.needsCanvasObjectRepair, 'function', 'Integrity guard must expose canvas-object repair detection.');

assert(runtimeSource.includes('Methanol_Analisa_NPSH_Kerusakan_Impeller.untirta'), 'Integrity guard must restore from the validated Simulasi 4 .untirta sample.');
assert(runtimeSource.includes('decodeUntirtaProjectBuffer'), 'Integrity guard must use the app .untirta decoder.');
assert(runtimeSource.includes('applySimulationStateAtomic'), 'Integrity guard must apply the restored sample through the app atomic state loader.');
assert(runtimeSource.includes("getAppFunction('getSimulationState')"), 'Integrity guard must read the app state through the function resolver.');
assert(runtimeSource.includes('repairRenderedObjectsFromState'), 'Integrity guard must repair missing rendered canvas objects from current state.');
assert(runtimeSource.includes('npsh:simulation-case-integrity-restored'), 'Integrity guard must emit a restore event for diagnostics.');

const partialSim4 = {
  SETTINGS: { type: 'settings' },
  FLUID: { type: 'fluid', props: { fluidName: 'Methanol' } },
  'SRC-100': { type: 'source', props: { flow: 280, pressure: 0.368 } },
  'SNK-100': { type: 'sink', props: { demandFlow: 280, pressure: 3.336 } }
};
assert.strictEqual(
  guard.isSimulationCase4PartialModel(partialSim4),
  true,
  'Integrity guard must detect the partial Simulasi 4 state with Methanol SRC/SNK but missing pump/PFV route.'
);

const completeSim4 = {
  ...partialSim4,
  'PIPE-1': { type: 'pipe' },
  'PUMP-100': { type: 'pump' },
  'PIPE-2': { type: 'pipe' },
  connections: [
    { from: 'SRC-100', to: 'PUMP-100', pipeId: 'PIPE-1' },
    { from: 'PUMP-100', to: 'SNK-100', pipeId: 'PIPE-2' }
  ]
};
assert.strictEqual(
  guard.isSimulationCase4PartialModel(completeSim4),
  false,
  'Integrity guard must not restore when Simulasi 4 already has pump, PFV pipes, and connections.'
);

const unrelatedMethanol = {
  SETTINGS: { type: 'settings' },
  FLUID: { type: 'fluid', props: { fluidName: 'Methanol' } },
  'SRC-100': { type: 'source', props: { flow: 12, pressure: 0.368 } },
  'SNK-100': { type: 'sink', props: { demandFlow: 12, pressure: 3.336 } }
};
assert.strictEqual(
  guard.isSimulationCase4PartialModel(unrelatedMethanol),
  false,
  'Integrity guard must not restore an unrelated user-created Methanol model.'
);

global.document = {
  getElementById(id) {
    return id === 'canvas' ? this : null;
  },
  querySelector(selector) {
    return selector.includes('SRC-100') ? { id: 'obj-src100' } : null;
  }
};
assert.strictEqual(
  guard.needsCanvasObjectRepair({
    'SRC-100': { type: 'source' },
    'PUMP-100': { type: 'pump' }
  }),
  true,
  'Integrity guard must detect missing rendered pump objects when model state still contains the pump.'
);
delete global.document;

assert(
  indexSource.includes('engineering-simulation-case-integrity-guard.js?v=20260614-simulation-case-integrity3'),
  'Index must load the simulation case integrity guard with cache busting.'
);
assert(
  indexSource.indexOf('engineering-route-trace-audit.js?v=20260616-snk-outlet-feasibility1')
    < indexSource.indexOf('engineering-simulation-case-integrity-guard.js?v=20260614-simulation-case-integrity3')
    && indexSource.indexOf('engineering-simulation-case-integrity-guard.js?v=20260614-simulation-case-integrity3')
    > indexSource.indexOf('engineering-realtime-calculation-defense.js?v=20260621-manual-npshr-autosolve1')
    && indexSource.indexOf('engineering-simulation-case-integrity-guard.js?v=20260614-simulation-case-integrity3')
    > indexSource.indexOf('const diagnosticScripts = ['),
  'Integrity guard must remain deferred with diagnostics after the realtime path so PageSpeed critical-path work stays calculation-only.'
);
assert(
  manifestSource.includes('Simulation case integrity guard cache key: engineering-simulation-case-integrity-guard.js?v=20260614-simulation-case-integrity3'),
  'Manifest must lock the simulation case integrity cache key.'
);
assert(
  manifestSource.includes('Simulation case integrity validation: npm run validate:simulation-case-integrity'),
  'Manifest must document the simulation case integrity validation command.'
);
assert.strictEqual(
  packageJson.scripts['validate:simulation-case-integrity'],
  'node tools/validate-simulation-case-integrity-guard.cjs',
  'package.json must expose the integrity guard validator.'
);

console.log('Simulation case integrity guard validation passed.');
