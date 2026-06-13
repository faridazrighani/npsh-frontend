const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-pump-formula-defense-live-audit.js');
const indexPath = path.join(rootDir, 'index.html');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.innerHTML = '';
    this.offsetParent = {};
  }

  get firstChild() {
    return this.children[0] || null;
  }

  getClientRects() {
    return [1];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) {
      const key = name
        .slice(5)
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  insertBefore(node) {
    this.children.unshift(node);
    return node;
  }

  insertAdjacentElement(position, node) {
    if (position === 'afterend') {
      this.children.push(node);
      return node;
    }
    this.children.unshift(node);
    return node;
  }

  querySelector(selector) {
    if (selector === '[data-pump-formula-defense-live-badges]') {
      return this.children.find((child) => child.attributes?.['data-pump-formula-defense-live-badges'] === 'true') || null;
    }
    if (selector === '[data-pump-formula-defense-vendor-summary]') {
      return this.children.find((child) => child.attributes?.['data-pump-formula-defense-vendor-summary'] === 'true') || null;
    }
    if (selector.includes('.task-window-body')) return this;
    return null;
  }
}

const windowNode = new FakeElement('section');
windowNode.dataset.pumpId = 'P-100';

const listeners = [];
globalThis.window = globalThis;
globalThis.document = {
  createElement: (tagName) => new FakeElement(tagName),
  querySelectorAll: (selector) => (selector === '.pump-formula-defense-task-window' ? [windowNode] : []),
  addEventListener: (name) => listeners.push(name)
};
globalThis.setTimeout = (callback) => {
  callback();
  return 1;
};
globalThis.clearTimeout = () => {};
globalThis.setInterval = undefined;

globalThis.EngineeringDefenseExportPackage = {};
globalThis.EngineeringLibraryGovernance = {};
globalThis.__npshGlobalModel = {
  'P-100': {
    type: 'pump',
    props: {
      curveDataSource: 'Manufacturer/Test Verified',
      npshrSourceMode: 'Manufacturer/Test Curve'
    },
    results: {
      calculationFreshness: 'Current',
      npshEvaluation: {
        hydraulicStatus: 'Safe',
        dataConfidence: 'Manufacturer/Test',
        engineeringStatus: 'Safe',
        npshrSource: 'Manufacturer/Test Curve',
        calculationTrace: {
          steps: [
            { title: 'NPSHa', formula: 'NPSHa = Hs - Hv', substitution: '8.000 - 1.000', result: 7, unit: 'm' },
            { title: 'NPSHr', formula: 'NPSHr = curve(Q)', substitution: 'curve(50)', result: 4, unit: 'm' }
          ]
        }
      }
    }
  }
};

let contentRefreshCalls = 0;
globalThis.refreshPumpFormulaDefenseWindowContent = (pumpId) => {
  contentRefreshCalls += 1;
  return { pumpId };
};
globalThis.openPumpFormulaDefenseTaskWindow = (pumpId) => ({ pumpId });
globalThis.updateSimulation = (options = {}) => ({ ok: true, options });
globalThis.shouldSkipBackendSimulationFetch = () => true;

const runtime = require(runtimePath);
assert.equal(runtime.version, 'pump-formula-defense-live-audit.v2', 'Pump Formula Defense live audit runtime must expose realtime v2.');
assert.equal(typeof runtime.refreshOpenWindows, 'function', 'Runtime must expose open-window refresh.');
assert.equal(typeof runtime.scheduleRefresh, 'function', 'Runtime must expose scheduled refresh.');
assert.equal(typeof runtime.ensureRuntimeGuards, 'function', 'Runtime must expose self-healing guard installer.');
assert.equal(globalThis.refreshPumpFormulaDefenseWindowContent.__pumpFormulaDefenseLiveAuditVersion, 'pump-formula-defense-live-audit.v2');

runtime.refreshOpenWindows('P-100', { reason: 'unit-test' });
assert(contentRefreshCalls > 0, 'Open Pump Formula Defense windows must rebuild their content when refreshed.');

const trace = globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.calculationTrace;
assert.equal(trace.formulaDefenseRows.length, 3, 'Pump Formula Defense rows must be rebuilt from live trace steps plus confidence gate.');
assert.equal(
  trace.formulaDefenseRows.find((row) => row.step === 'NPSHa')?.result,
  7,
  'Initial Pump Formula Defense NPSHa row must use the current live model value.'
);

trace.steps[0].substitution = '9.000 - 1.000';
trace.steps[0].result = 8;
runtime.refreshOpenWindows('P-100', { reason: 'unit-test-changed' });
assert.equal(
  trace.formulaDefenseRows.find((row) => row.step === 'NPSHa')?.result,
  8,
  'Pump Formula Defense rows must refresh when related system calculation numbers change.'
);

globalThis.refreshPumpFormulaDefenseWindowContent = () => ({ stale: true });
runtime.ensureRuntimeGuards();
assert.equal(
  globalThis.refreshPumpFormulaDefenseWindowContent.__pumpFormulaDefenseLiveAuditVersion,
  'pump-formula-defense-live-audit.v2',
  'Runtime must reclaim Pump Formula Defense content refresh after late overrides.'
);

[
  'npsh:calculation-stale',
  'npsh:calculation-calculating',
  'npsh:calculation-current',
  'npsh:linked-views-refreshed',
  'npsh:realtime-autosolve-complete',
  'input',
  'change'
].forEach((eventName) => {
  assert(listeners.includes(eventName), `Runtime must listen for ${eventName}.`);
});

const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');
assert(runtimeSource.includes('refreshOpenFormulaDefenseWindows'), 'Runtime must keep explicit open-window refresh logic.');
assert(runtimeSource.includes('refreshPumpFormulaDefenseWindowContent'), 'Runtime must rebuild Pump Formula Defense window content, not only badges.');
assert(runtimeSource.includes('EngineeringPerformanceRefreshGovernor'), 'Runtime must delegate scheduled open-window refreshes to the performance governor when available.');
assert(!runtimeSource.includes("scheduleOpenFormulaDefenseWindowRefresh('', { reason: 'guard-loop'"), 'Runtime guard loop must not trigger repeated visual refreshes.');
assert(
  index.includes('engineering-pump-formula-defense-live-audit.js?v=20260613-pump-defense-live13'),
  'Index must cache-bust Pump Formula Defense live audit runtime.'
);
assert(
  manifest.includes('Pump formula defense live audit cache key: engineering-pump-formula-defense-live-audit.js?v=20260613-pump-defense-live13'),
  'Manifest must document Pump Formula Defense live audit cache key.'
);

console.log('Pump Formula Defense live audit validation passed.');
