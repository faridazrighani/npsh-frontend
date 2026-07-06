const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'engineering-suction-only-npsha-runtime.js');
const indexPath = path.join(root, 'index.html');

const runtime = fs.readFileSync(runtimePath, 'utf8');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

assert.match(indexHtml, /engineering-suction-only-npsha-runtime\.js\?v=20260706-suction-only-npsha2/, 'index.html must load the suction-only NPSHa runtime with a fresh cache key.');
assert.match(runtime, /const VERSION = "2026\.06-suction-only-npsha4"/, 'runtime version should match the cache key.');
assert.match(runtime, /runBackendProtectedPumpSimulation/, 'runtime must call the protected backend pump simulation.');
assert.match(runtime, /Suction Only/, 'runtime must recognize the suction-only route status.');
assert.match(runtime, /Downstream Required/, 'runtime must keep downstream required-head status separate.');
assert.match(runtime, /suctionOnlyFingerprint/, 'runtime must fingerprint suction-side inputs.');
assert.match(runtime, /state\.lastAppliedFingerprint === fingerprint/, 'runtime must avoid repeated solves for unchanged suction-only inputs.');
assert.match(runtime, /EngineeringPipeCanvasHydraulicLabelRuntime\.refresh/, 'runtime must refresh PFV canvas labels after backend results.');
assert.match(runtime, /buildPumpLiveParameterRowsWithSuctionOnly/, 'runtime must patch pump live rows for suction-only readout.');
assert.match(runtime, /fetchAndApplyBackendResult/, 'runtime must have a direct backend fallback when protected apply does not hydrate the model.');
assert.match(runtime, /applyLocalSuctionOnlyFallback/, 'runtime must locally hydrate SRC/PFV/Pump suction-side results when protected repaint does not hydrate the canvas.');
assert.match(runtime, /pressureCalculated = true/, 'runtime must mark suction PFV as pressure-calculated for canvas and properties windows.');
assert.match(runtime, /backendValidationStatus = "Connected"/, 'runtime must clear Calculating by marking backend validation Connected after usable NPSHa.');
assert.match(runtime, /npsh:calculation-current/, 'runtime must publish a current lifecycle event after suction-only results.');
assert.doesNotMatch(runtime, /interpolateNpshrFromCurve/, 'runtime must not interpolate NPSHr from curve data.');
assert.doesNotMatch(runtime, /props\.designNpshr,\s*interpolate|interpolate.*npshr/i, 'runtime must not fall back to design/curve NPSHr.');

function createModel() {
  return {
    FLUID: {
      type: 'fluid',
      props: { fluidName: 'Water', temp: 25, density: 997.047, viscosity: 0.893, vaporPressure: 0.0317 }
    },
    'SRC-100': {
      type: 'source',
      props: { pressure: 1.01325, pressureInputBasis: 'Absolute', elevation: 0, flow: 9.528 }
    },
    'PIPE-1': {
      type: 'pipe',
      props: {
        segments: [
          { diameter: 0.08, length: 8, roughness: 0.000045, fittingType: 'Custom K', fittingQuantity: 1, fittingK: 1 }
        ]
      },
      results: {}
    },
    'P-100': {
      type: 'pump',
      props: { inputMode: 'Advanced', designFlow: 9.528, manualNpshr: 1, suctionElevation: 0 },
      results: { status: 'Incomplete', hydraulicNpshStatus: 'Incomplete' }
    }
  };
}

async function runRuntimeSmoke() {
  const timers = [];
  const windowMock = {
    console,
    globalModel: createModel(),
    __npshGlobalModel: null,
    connections: [
      { from: 'SRC-100', to: 'P-100', pipeId: 'PIPE-1', connectionType: 'hydraulic' }
    ],
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {},
    addEventListener() {},
    dispatchEvent() {},
    EngineeringPipeCanvasHydraulicLabelRuntime: {
      refresh() {
        windowMock.pipeLabelRefreshed = true;
      }
    },
    refreshBackendProtectedSimulationUi() {
      windowMock.protectedUiRefreshed = true;
    },
    updateAllObjectOperatingStatusVisuals() {
      windowMock.statusRefreshed = true;
    },
    async runBackendProtectedPumpSimulation(pumpId) {
      const pump = windowMock.globalModel[pumpId];
      const pipe = windowMock.globalModel['PIPE-1'];
      pump.results = {
        ...pump.results,
        status: 'Safe',
        hydraulicNpshStatus: 'Safe',
        cavitationStatus: 'Safe',
        backendValidationStatus: 'Connected',
        routeCalculationStatus: 'Suction Only',
        requiredPumpHeadStatus: 'Downstream Required',
        suctionOnlyNpshaEvaluation: true,
        actualPumpHeadAvailable: false,
        flow: '9.53',
        npsha: '10.0216',
        npshr: '1.0000',
        suctionPressure: '1.012',
        dischargePressure: null,
        npshEvaluation: {
          routeCalculationStatus: 'Suction Only',
          requiredPumpHeadStatus: 'Downstream Required',
          flow: 9.528,
          npsha: 10.0216,
          npshr: 1,
          npshMargin: 9.0216,
          npshRatio: 10.0216,
          suctionPressureAbs: 1.012
        }
      };
      pipe.results = {
        ...pipe.results,
        pressureCalculated: true,
        flow: 9.528,
        inletPressure: 1.013,
        outletPressure: 1.012,
        calculationTrace: {
          basis: { flowM3H: 9.528 },
          totals: { totalLoss: 0.033 }
        }
      };
      return { primaryApplied: true };
    }
  };
  windowMock.__npshGlobalModel = windowMock.globalModel;

  vm.runInNewContext(runtime, {
    window: windowMock,
    console,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    }
  }, { filename: runtimePath });

  const api = windowMock.EngineeringSuctionOnlyNpshaRuntime;
  assert.ok(api, 'runtime API should be installed on window.');
  assert.ok(api.isSuctionOnlyEligiblePump(windowMock.globalModel, 'P-100'), 'runtime should detect SRC -> PFV -> Pump suction-only route.');
  await api.runRouteSolve('P-100');

  const pumpResults = windowMock.globalModel['P-100'].results;
  const pipeResults = windowMock.globalModel['PIPE-1'].results;
  assert.equal(pumpResults.routeCalculationStatus, 'Suction Only');
  assert.equal(pumpResults.requiredPumpHeadStatus, 'Downstream Required');
  assert.equal(pumpResults.backendValidationStatus, 'Connected');
  assert.equal(pumpResults.calculationFreshness, 'Current');
  assert.equal(pipeResults.pressureCalculated, true);
  assert.equal(windowMock.pipeLabelRefreshed, true);
  assert.equal(windowMock.protectedUiRefreshed, true);

  const fallbackMock = {
    console,
    globalModel: createModel(),
    __npshGlobalModel: null,
    connections: [
      { from: 'SRC-100', to: 'P-100', pipeId: 'PIPE-1', connectionType: 'hydraulic' }
    ],
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {},
    addEventListener() {},
    dispatchEvent() {},
    EngineeringPipeCanvasHydraulicLabelRuntime: { refresh() {} },
    refreshBackendProtectedSimulationUi() {},
    updateAllObjectOperatingStatusVisuals() {},
    async runBackendProtectedPumpSimulation() {
      return { primaryApplied: false };
    },
    async fetch(url, init) {
      fallbackMock.fetchCalled = { url, body: JSON.parse(init.body) };
      return {
        ok: true,
        async json() {
          return {
            ok: true,
            status: 'backend-engine-ready',
            cutover: { primaryEligible: true },
            results: {
              status: 'Safe',
              hydraulicStatus: 'Safe',
              engineeringStatus: 'Safe',
              routeCalculationStatus: 'Suction Only',
              requiredPumpHeadStatus: 'Downstream Required',
              flow: 9.528,
              npsha: 10.0216,
              npshr: 1,
              npshMargin: 9.0216,
              npshRatio: 10.0216,
              suctionPressureAbs: 1.012,
              suctionLoss: 0.033,
              actualPumpHeadAvailable: false
            },
            nodeResults: {
              'PIPE-1': {
                results: {
                  pressureCalculated: true,
                  flow: 9.528,
                  inletPressure: 1.013,
                  outletPressure: 1.012,
                  calculationTrace: {
                    basis: { flowM3H: 9.528 },
                    totals: { totalLoss: 0.033 }
                  }
                }
              }
            }
          };
        }
      };
    }
  };
  fallbackMock.__npshGlobalModel = fallbackMock.globalModel;
  vm.runInNewContext(runtime, {
    window: fallbackMock,
    console,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    }
  }, { filename: runtimePath });
  await fallbackMock.EngineeringSuctionOnlyNpshaRuntime.runRouteSolve('P-100');
  assert.ok(fallbackMock.fetchCalled, 'runtime should call direct /api/simulate fallback when protected apply has no NPSHa.');
  assert.equal(fallbackMock.globalModel['P-100'].results.routeCalculationStatus, 'Suction Only');
  assert.equal(fallbackMock.globalModel['P-100'].results.backendValidationStatus, 'Connected');
  assert.equal(fallbackMock.globalModel['P-100'].results.calculationFreshness, 'Current');
  assert.equal(fallbackMock.globalModel['PIPE-1'].results.pressureCalculated, true);

  const localHydrationMock = {
    console,
    globalModel: createModel(),
    __npshGlobalModel: null,
    connections: [
      { from: 'SRC-100', to: 'P-100', pipeId: 'PIPE-1', connectionType: 'hydraulic' }
    ],
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {},
    addEventListener() {},
    dispatchEvent() {},
    EngineeringPipeCanvasHydraulicLabelRuntime: {
      refresh() {
        localHydrationMock.pipeLabelRefreshed = true;
      }
    },
    refreshBackendProtectedSimulationUi() {
      localHydrationMock.protectedUiRefreshed = true;
    },
    updateAllObjectOperatingStatusVisuals() {
      localHydrationMock.statusRefreshed = true;
    },
    async runBackendProtectedPumpSimulation() {
      return { primaryApplied: false };
    }
  };
  localHydrationMock.__npshGlobalModel = localHydrationMock.globalModel;
  localHydrationMock.globalModel['SRC-100'].results = { evaluatedFlow: 0 };
  vm.runInNewContext(runtime, {
    window: localHydrationMock,
    console,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    }
  }, { filename: runtimePath });
  await localHydrationMock.EngineeringSuctionOnlyNpshaRuntime.runRouteSolve('P-100');
  assert.equal(localHydrationMock.globalModel['PIPE-1'].results.pressureCalculated, true, 'local hydration should mark suction PFV calculated.');
  assert.ok(Number(localHydrationMock.globalModel['PIPE-1'].results.flow) > 0, 'local hydration should put evaluated flow on the suction PFV.');
  assert.ok(Number(localHydrationMock.globalModel['SRC-100'].results.evaluatedFlow) > 0, 'local hydration should update SRC evaluated flow.');
  assert.ok(Number(localHydrationMock.globalModel['P-100'].results.npsha) > 0, 'local hydration should calculate pump NPSHa.');
  assert.equal(localHydrationMock.globalModel['P-100'].results.npshaCalculationStatus, 'Calculated');
  assert.equal(localHydrationMock.globalModel['P-100'].results.requiredPumpHeadStatus, 'Downstream Required');
  assert.equal(localHydrationMock.pipeLabelRefreshed, true);

  const noManualMock = {
    ...localHydrationMock,
    globalModel: createModel(),
    pipeLabelRefreshed: false,
    protectedUiRefreshed: false,
    statusRefreshed: false
  };
  noManualMock.__npshGlobalModel = noManualMock.globalModel;
  delete noManualMock.globalModel['P-100'].props.manualNpshr;
  noManualMock.globalModel['P-100'].props.designNpshr = 9.9;
  noManualMock.globalModel['P-100'].props.curveData = [
    { flow: 0, head: 15, eff: 0, npshr: 3 },
    { flow: 10, head: 12, eff: 70, npshr: 4 }
  ];
  vm.runInNewContext(runtime, {
    window: noManualMock,
    console,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    }
  }, { filename: runtimePath });
  await noManualMock.EngineeringSuctionOnlyNpshaRuntime.runRouteSolve('P-100');
  assert.ok(Number(noManualMock.globalModel['P-100'].results.npsha) > 0, 'local hydration should still calculate NPSHa without manual NPSHr.');
  assert.equal(noManualMock.globalModel['P-100'].results.npshr, null, 'NPSHr must remain blank without manualNpshr, even when design/curve NPSHr exists.');
  assert.equal(noManualMock.globalModel['P-100'].results.npshRequired, null, 'NPSH Required must remain blank without manualNpshr.');
  assert.equal(noManualMock.globalModel['P-100'].results.npshMargin, null, 'NPSH margin must remain blank without manualNpshr.');
}

runRuntimeSmoke().then(() => {
  console.log(JSON.stringify({
    passed: true,
    runtime: path.basename(runtimePath),
    cacheKey: '20260706-suction-only-npsha2',
    smoke: 'SRC -> PFV -> Pump calculated'
  }, null, 2));
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
