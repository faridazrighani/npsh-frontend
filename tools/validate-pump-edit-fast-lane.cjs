const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-pump-edit-fast-lane.js');
const realtimePath = path.join(rootDir, 'engineering-realtime-calculation-defense.js');
const indexPath = path.join(rootDir, 'index.html');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');

class FakeInput {
  constructor({ key, value = '', tagName = 'INPUT', type = 'text' } = {}) {
    this.dataset = { key };
    this.value = value;
    this.tagName = tagName;
    this.type = type;
    this.disabled = false;
    this.readOnly = false;
  }

  matches(selector) {
    return selector === 'input, select, textarea';
  }

  getAttribute() {
    return '';
  }

  closest(selector) {
    if (selector.includes('persistent-object-properties-task-window') || selector.includes('[data-task-prop-body')) {
      return fakePumpWindow;
    }
    return null;
  }
}

const fakePumpWindow = {
  textContent: 'Pump Object Properties P-100 NPSH Evaluation Report Pump Datum Elev.',
  querySelector: () => null
};

let chartSchedules = 0;
globalThis.requestAnimationFrame = (callback) => {
  callback();
  return 1;
};
globalThis.cancelAnimationFrame = () => {};
globalThis.setTimeout = (callback) => {
  callback();
  return 1;
};
globalThis.clearTimeout = () => {};
globalThis.EngineeringPumpPerformanceCanonicalChart = {
  scheduleRender: (pumpId, options = {}) => {
    chartSchedules += 1;
    assert.equal(pumpId, 'P-100', 'Fast lane chart preview must target the active pump.');
    assert.equal(options.delayMs, 16, 'Fast lane chart preview should be near-immediate.');
    return true;
  }
};
globalThis.__npshGlobalModel = {
  FLUID: { type: 'fluid', props: { density: 958.348, viscosity: 0.803, vaporPressure: 1.01418 } },
  'P-100': {
    type: 'pump',
    props: {
      designFlow: 50,
      designHead: 24,
      designEfficiency: 62,
      designNpshr: 2.4002,
      bepFlow: 50,
      suctionElevation: -0.5,
      minNpshMarginRatio: 1.05,
      minNpshMargin: 0.6
    },
    results: {
      flow: 50,
      head: 24,
      npsha: 6.4656,
      npshr: 2.4002,
      npshMargin: 4.0654,
      npshRatio: 2.6938,
      npshEvaluation: {
        flow: 50,
        pumpHead: 24,
        npsha: 6.4656,
        npshr: 2.4002,
        npshMargin: 4.0654,
        npshRatio: 2.6938,
        calculationTrace: {
          boundary: { pressureHead: 18.35, elevation: -8.6894, velocityHead: 0 },
          pump: { elevation: -0.5 },
          basis: { vaporPressureHead: 1.08 },
          losses: { total: 2.615 }
        }
      }
    }
  }
};

const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const runtime = require(runtimePath);
assert.equal(runtime.version, 'engineering-pump-edit-fast-lane.v8', 'Pump edit fast lane runtime must expose v8.');
assert.equal(runtime.cacheKey, '20260706-pump-edit-status-matrix1', 'Pump edit fast lane cache key must match index.');
assert(runtimeSource.includes('pump-manual-npshr-task-window'), 'Fast lane must accept the compact Manual NPSHr task window as a pump edit surface.');
assert(runtimeSource.includes('\\bPUMP[-_]\\d+\\b'), 'Fast lane must recognize canonical PUMP-100 style pump ids in task titles.');
assert.equal(typeof runtime.classifyInput, 'function', 'Pump edit fast lane must expose classifyInput().');
assert.equal(typeof runtime.handleRealtimeInput, 'function', 'Pump edit fast lane must expose realtime input handler.');
assert.equal(typeof runtime.applyLocalNpsh, 'function', 'Pump edit fast lane must expose local NPSH recalculation.');

const manualNpshrInput = new FakeInput({ key: 'manualNpshr', value: '3.000' });
const manualClass = runtime.classifyInput(manualNpshrInput);
assert.equal(manualClass.backend, 'defer', 'Manual NPSHr edit should request backend/network recalculation after local preview.');
assert.equal(manualClass.delayMs, 90, 'Manual NPSHr backend recalculation should use the fast committed-input debounce.');

let backendRequests = 0;
let staleMarks = 0;
const manualResult = runtime.handleRealtimeInput({ target: manualNpshrInput, isTrusted: true }, {
  markUserCalculationIntent: () => true,
  markInputLatencyShield: () => true,
  markStale: () => { staleMarks += 1; },
  requestAutoSolve: (pumpId, reason, options = {}) => {
    backendRequests += 1;
    assert.equal(pumpId, 'P-100');
    assert.match(reason, /Manual NPSHr changed/i);
    assert.equal(options.delayMs, 90, 'Manual NPSHr autosolve should recalculate immediately after commit.');
  }
});
assert.equal(manualResult.handled, true, 'Manual NPSHr edit must be handled by the fast lane.');
assert.equal(manualResult.backend, 'defer', 'Manual NPSHr fast lane result must request backend autosolve.');
assert.equal(backendRequests, 1, 'Manual NPSHr fast lane must request one autosolve.');
assert.equal(staleMarks, 1, 'Manual NPSHr fast lane must mark the connected route stale before autosolve.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshr, 3, 'Manual NPSHr must update local NPSHr.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshMargin, 3.4656, 'Manual NPSHr must update local NPSH margin.');
assert(Math.abs(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshRatio - 2.1552) < 0.00001, 'Manual NPSHr must update local NPSH ratio.');
assert(chartSchedules >= 1, 'Manual NPSHr must schedule chart preview refresh.');

const invalidManualInput = new FakeInput({ key: 'manualNpshr', value: 'not-a-number' });
runtime.applyInputToPump(invalidManualInput, manualClass);
assert.equal(globalThis.__npshGlobalModel['P-100'].props.manualNpshr, 0, 'Non-numeric Manual NPSHr must normalize to zero.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshr, 0, 'Non-numeric Manual NPSHr must preview as zero NPSHr.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshMargin, 6.4656, 'Zero Manual NPSHr must still calculate margin.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshRatio, null, 'Zero Manual NPSHr must not create a finite NPSH ratio.');

const negativeManualInput = new FakeInput({ key: 'manualNpshr', value: '-2' });
runtime.applyInputToPump(negativeManualInput, manualClass);
assert.equal(globalThis.__npshGlobalModel['P-100'].props.manualNpshr, 0, 'Negative Manual NPSHr must clamp to zero.');

const blankManualInput = new FakeInput({ key: 'manualNpshr', value: '' });
runtime.applyInputToPump(blankManualInput, manualClass);
assert.equal(globalThis.__npshGlobalModel['P-100'].props.manualNpshr, '', 'Blank Manual NPSHr must remain blank rather than becoming zero.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshr, null, 'Blank Manual NPSHr must return to blank NPSHr.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshMargin, null, 'Blank Manual NPSHr must clear NPSH margin.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.status, 'NPSHa Calculated', 'Blank Manual NPSHr must keep NPSHa calculated while clearing the manual comparison.');
runtime.applyInputToPump(manualNpshrInput, manualClass);

const designHeadInput = new FakeInput({ key: 'designHead', value: '26' });
const designHeadClass = runtime.classifyInput(designHeadInput);
assert.equal(designHeadClass.backend, 'defer', 'Design Head edit should defer backend recalculation until typing settles.');
runtime.handleRealtimeInput({ target: designHeadInput, isTrusted: true, type: 'input' }, {
  markUserCalculationIntent: () => true,
  markInputLatencyShield: () => true,
  markStale: () => { staleMarks += 1; },
  requestAutoSolve: (pumpId, reason, options = {}) => {
    backendRequests += 1;
    assert.equal(pumpId, 'P-100');
    assert.equal(options.delayMs, 1100, 'Design Head backend recalculation should use the slower fast-lane debounce.');
  }
});
assert.equal(globalThis.__npshGlobalModel['P-100'].props.designHead, 26, 'Design Head must update pump props immediately.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.pumpHead, 26, 'Design Head must update local pump head immediately.');
assert.equal(backendRequests, 2, 'Design Head must request one additional deferred backend recalculation.');
assert.equal(staleMarks, 2, 'Design Head must mark backend result stale once after Manual NPSHr.');

const designFlowInput = new FakeInput({ key: 'designFlow', value: '70' });
const designFlowClass = runtime.classifyInput(designFlowInput);
assert.equal(designFlowClass.backend, 'defer', 'Design Flow edit should defer backend recalculation until typing settles.');
runtime.handleRealtimeInput({ target: designFlowInput, isTrusted: true, type: 'input' }, {
  markUserCalculationIntent: () => true,
  markInputLatencyShield: () => true,
  markStale: () => { staleMarks += 1; },
  requestAutoSolve: (pumpId, reason, options = {}) => {
    backendRequests += 1;
    assert.equal(pumpId, 'P-100');
    assert.equal(options.delayMs, 1100, 'Design Flow backend recalculation should use the slower fast-lane debounce.');
  }
});
assert.equal(globalThis.__npshGlobalModel['P-100'].props.designFlow, 70, 'Design Flow must update pump props immediately.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.flow, 70, 'Design Flow must move the local chart/evaluation duty point immediately.');

const inputModeInput = new FakeInput({ key: 'inputMode', value: 'Advanced', tagName: 'SELECT' });
const inputModeClass = runtime.classifyInput(inputModeInput);
assert.equal(inputModeClass.backend, 'defer', 'Input Mode edit should defer backend recalculation until typing settles.');

const speedInput = new FakeInput({ key: 'speed', value: '3600' });
const speedClass = runtime.classifyInput(speedInput);
assert.equal(speedClass.backend, 'defer', 'Pump speed edit should defer backend recalculation until typing settles.');
const backendRequestsBeforeUntrustedSpeed = backendRequests;
runtime.handleRealtimeInput({ target: speedInput, isTrusted: false, type: 'input' }, {
  markStale: () => { staleMarks += 1; },
  requestAutoSolve: () => { backendRequests += 1; }
});
assert.equal(globalThis.__npshGlobalModel['P-100'].props.speed, 3600, 'Pump speed must update pump props immediately.');
assert.equal(staleMarks, 4, 'Programmatic pump speed edits must mark backend result stale.');
assert.equal(backendRequests, backendRequestsBeforeUntrustedSpeed, 'Programmatic pump speed edits must not autosolve without trusted user input.');

const estimatedSourceInput = new FakeInput({ key: 'npshrSourceMode', value: 'Estimated', tagName: 'SELECT' });
const estimatedSourceClass = runtime.classifyInput(estimatedSourceInput);
assert.equal(estimatedSourceClass.backend, 'none', 'NPSHr Source mode should not trigger backend/network recalculation.');
runtime.handleRealtimeInput({ target: estimatedSourceInput, isTrusted: true, type: 'change' }, {
  markUserCalculationIntent: () => true,
  markInputLatencyShield: () => true,
  markStale: () => { staleMarks += 1; },
  requestAutoSolve: () => { backendRequests += 1; }
});
assert.equal(globalThis.__npshGlobalModel['P-100'].props.npshrSourceMode, 'Estimated', 'NPSHr Source must update pump props immediately.');
assert.equal(
  globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshr,
  3,
  'Estimated NPSHr source must not calculate NPSHr; manualNpshr remains the only preview source.'
);

const manualSourceInput = new FakeInput({ key: 'npshrSourceMode', value: 'Manual', tagName: 'SELECT' });
runtime.handleRealtimeInput({ target: manualSourceInput, isTrusted: true, type: 'change' }, {
  markUserCalculationIntent: () => true,
  markInputLatencyShield: () => true,
  markStale: () => { staleMarks += 1; },
  requestAutoSolve: () => { backendRequests += 1; }
});
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npshr, 3, 'Manual NPSHr source must restore a flat manual NPSHr value.');

const datumInput = new FakeInput({ key: 'suctionElevation', value: '0.5' });
runtime.handleRealtimeInput({ target: datumInput, isTrusted: true, type: 'input' }, {
  markUserCalculationIntent: () => true,
  markInputLatencyShield: () => true,
  markStale: () => { staleMarks += 1; },
  requestAutoSolve: () => { backendRequests += 1; }
});
assert.equal(globalThis.__npshGlobalModel['P-100'].props.suctionElevation, 0.5, 'Pump Datum Elev. must update pump props immediately.');
assert.equal(globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.npsha, 5.4656, 'Pump Datum Elev. must update local NPSHa from pressure/elevation/loss/vapor trace.');

const source = fs.readFileSync(runtimePath, 'utf8');
assert(!/\bcreateElement\s*\(/.test(source), 'Fast lane must not create new Pump Properties layout elements.');
assert(!/\binsertBefore\s*\(/.test(source), 'Fast lane must not insert Pump Properties layout elements.');
assert(!/\binsertAdjacent/.test(source), 'Fast lane must not insert adjacent layout elements.');
assert(!/\.innerHTML\s*=/.test(source), 'Fast lane must not rebuild Pump Properties layout via innerHTML.');

const realtimeSource = fs.readFileSync(realtimePath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');
assert(realtimeSource.includes('EngineeringPumpEditFastLane'), 'Realtime defense must delegate pump edits to the fast lane.');
assert(
  index.indexOf('engineering-pump-edit-fast-lane.js?v=20260706-pump-edit-status-matrix1')
    < index.indexOf('engineering-realtime-calculation-defense.js?v=20260703-snk-input-active1'),
  'Fast lane runtime must load before realtime defense.'
);
assert(manifest.includes('Pump edit fast lane cache key: engineering-pump-edit-fast-lane.js?v=20260706-pump-edit-status-matrix1'), 'Manifest must document Pump edit fast lane cache key.');

console.log('Pump edit fast lane validation passed.');
