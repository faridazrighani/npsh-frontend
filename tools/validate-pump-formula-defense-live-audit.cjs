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
    this.textContent = '';
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
    if (selector === '[data-pump-calculation-matrix]') {
      return this.children.find((child) => child.attributes?.['data-pump-calculation-matrix'] === 'true') || null;
    }
    if (selector.includes('.task-window-body')) return this;
    return null;
  }

  querySelectorAll(selector) {
    const descendants = [];
    const visit = (node) => {
      (node.children || []).forEach((child) => {
        descendants.push(child);
        visit(child);
      });
    };
    visit(this);
    if (selector === 'tr') return descendants.filter((child) => child.tagName === 'TR');
    if (selector === 'td, th') return this.children.filter((child) => ['TD', 'TH'].includes(child.tagName));
    return [];
  }
}

const windowNode = new FakeElement('section');
windowNode.dataset.pumpId = 'P-100';
const routeTraceRow = new FakeElement('tr');
const routeStageCell = new FakeElement('td');
const routeValueCell = new FakeElement('td');
const routeSourceCell = new FakeElement('td');
routeStageCell.textContent = 'Pipe/Fitting/Valve discharge';
routeValueCell.textContent = '-';
routeSourceCell.textContent = '-';
routeTraceRow.textContent = 'Pipe/Fitting/Valve discharge - -';
routeTraceRow.children.push(routeStageCell, routeValueCell, routeSourceCell);
windowNode.children.push(routeTraceRow);
const snkRouteRow = new FakeElement('tr');
const snkStageCell = new FakeElement('td');
const snkValueCell = new FakeElement('td');
const snkSourceCell = new FakeElement('td');
snkStageCell.textContent = 'SNK';
snkValueCell.textContent = '-';
snkSourceCell.textContent = 'Downstream boundary from route trace';
snkRouteRow.textContent = 'SNK - Downstream boundary from route trace';
snkRouteRow.children.push(snkStageCell, snkValueCell, snkSourceCell);
windowNode.children.push(snkRouteRow);

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
      npshrSourceMode: 'Manual'
    },
    results: {
      calculationFreshness: 'Current',
      npshEvaluation: {
        flow: 50,
        pumpHead: 24,
        npsha: 7,
        npshr: 4,
        npshMargin: 3,
        npshRatio: 1.75,
        requiredNpsha: 4.6,
        npshExcess: 2.4,
        maxNpshrByRatio: 6.6667,
        maxNpshrByMargin: 6.4,
        maxAllowableNpshr: 6.4,
        suctionLoss: 1.25,
        routeCalculationStatus: 'Calculated',
        npshaCalculationStatus: 'Calculated',
        requiredPumpHeadStatus: 'Calculated',
        maxAllowableNpshrStatus: 'Calculated',
        manualNpshrComparisonStatus: 'Safe',
        vendorCurveVerificationStatus: 'Not Required for route calculation',
        hydraulicStatus: 'Safe',
        dataConfidence: 'Manual NPSHr',
        engineeringStatus: 'Safe',
        npshrSource: 'Manual',
        routeTrace: {
          steps: [
            {
              id: 'SNK-100',
              type: 'sink',
              stage: 'SNK',
              values: {
                hydraulicHeadM: 30.353,
                demandFlowM3H: 50,
                evaluatedFlowM3H: 50,
                pressureBarA: 1.744,
                elevationM: 29.085
              }
            }
          ],
          sections: {
            discharge: {
              text: 'P-100 -> PIPE-2 -> SNK-100',
              pressureDropBar: 0.244,
              directNpshImpact: false
            }
          },
        },
        marginCriteria: {
          basis: 'General Purpose',
          ratio: 1.05,
          margin: 0.6
        },
        calculationTrace: {
          boundary: {
            absolutePressureBar: 1.8,
            pressureHead: 18.35,
            elevation: 0,
            velocityHead: 0
          },
          pump: {
            elevation: 0,
            flow: 50,
            head: 24
          },
          losses: {
            major: 0.8,
            minor: 0.45,
            total: 1.25
          },
          interpretation: {
            marginRatioLimit: 1.05,
            absoluteMarginLimit: 0.6,
            requiredNpsha: 4.6,
            npshExcess: 2.4
          },
          systemHead: {
            dischargeLoss: 2.5
          },
          steps: [
            { title: 'Pressure Head', formula: 'Hp = Pabs x 100000 / (rho x g)', substitution: '1.800 x 100000 / (1000 x 9.81) = 18.350 m', result: 18.35, unit: 'm' },
            { title: 'Source Velocity Head', formula: 'Hvel = 0', substitution: '0.000 m', result: 0, unit: 'm' },
            { title: 'Suction Loss', formula: 'HL = pipe major + fitting/valve minor', substitution: '0.800 + 0.450 = 1.250 m', result: 1.25, unit: 'm' },
            { title: 'NPSHa', formula: 'NPSHa = Hs - Hv', substitution: '8.000 - 1.000', result: 7, unit: 'm' },
            { title: 'NPSHr', formula: 'NPSHr = manual input', substitution: 'Manual NPSHr = 4.000 m', result: 4, unit: 'm' },
            { title: 'Required NPSHa', formula: 'Required NPSHa = governing available ANSI/HI margin criterion', substitution: 'max(4.000 x 1.050, 4.000 + 0.600) = 4.600 m', result: 4.6, unit: 'm' },
            { title: 'Margin and Ratio', formula: 'Margin = NPSHa - NPSHr; Ratio = NPSHa / NPSHr; Excess = NPSHa - Required NPSHa', substitution: '7.000 - 4.000 = 3.000 m; 7.000 / 4.000 = 1.750; 7.000 - 4.600 = 2.400 m', result: 2.4, unit: 'm' }
          ]
        }
      }
    }
  }
};

let contentRefreshCalls = 0;
let lastContentRefreshTarget = null;
globalThis.refreshPumpFormulaDefenseWindowContent = (windowElement) => {
  assert.equal(typeof windowElement?.querySelector, 'function', 'Pump Formula Defense content refresh must be called with a task-window element, not a pump id string.');
  contentRefreshCalls += 1;
  lastContentRefreshTarget = windowElement;
  return { pumpId: windowElement?.dataset?.pumpId };
};
globalThis.openPumpFormulaDefenseTaskWindow = (pumpId) => ({ pumpId });
globalThis.updateSimulation = (options = {}) => ({ ok: true, options });
globalThis.shouldSkipBackendSimulationFetch = () => true;

const runtime = require(runtimePath);
assert.equal(runtime.version, 'pump-formula-defense-live-audit.v10', 'Pump Formula Defense live audit runtime must expose route-design v10.');
assert.equal(typeof runtime.refreshOpenWindows, 'function', 'Runtime must expose open-window refresh.');
assert.equal(typeof runtime.scheduleRefresh, 'function', 'Runtime must expose scheduled refresh.');
assert.equal(typeof runtime.ensureRuntimeGuards, 'function', 'Runtime must expose self-healing guard installer.');
assert.equal(typeof runtime.buildCalculationMatrixRows, 'function', 'Runtime must expose live calculation matrix rows for validation.');
assert.equal(globalThis.refreshPumpFormulaDefenseWindowContent.__pumpFormulaDefenseLiveAuditVersion, 'pump-formula-defense-live-audit.v10');

runtime.refreshOpenWindows('P-100', { reason: 'unit-test' });
assert(contentRefreshCalls > 0, 'Open Pump Formula Defense windows must rebuild their content when refreshed.');
assert.equal(lastContentRefreshTarget, windowNode, 'Open-window refresh must pass the task-window element into the protected content refresh.');
const contentRefreshCallsBeforeIdOnly = contentRefreshCalls;
globalThis.refreshPumpFormulaDefenseWindowContent('P-100');
assert.equal(contentRefreshCalls, contentRefreshCallsBeforeIdOnly, 'Pump-id-only refresh calls must not be forwarded to the DOM-element content refresher.');

const matrixPanel = windowNode.querySelector('[data-pump-calculation-matrix]');
assert(matrixPanel, 'Pump Formula Defense window must include a live input-to-output calculation matrix.');
assert(matrixPanel.innerHTML.includes('Matriks Kalkulasi Pump NPSH'), 'Matrix must have the requested calculation-matrix title.');
assert(matrixPanel.innerHTML.includes('Flow Evaluated'), 'Matrix must link input flow to the displayed flow output.');
assert(matrixPanel.innerHTML.includes('Required Pump Head'), 'Matrix must show route-calculated required pump head.');
assert(matrixPanel.innerHTML.includes('Discharge Loss'), 'Matrix must show the discharge PFV loss feeding system head.');
assert(matrixPanel.innerHTML.includes('2.5 m'), 'Matrix must display the live discharge PFV loss number.');
assert(matrixPanel.innerHTML.includes('reservoir/source boundary velocity is neglected'), 'Matrix must explain why reservoir/source velocity head can be zero.');
assert(matrixPanel.innerHTML.includes('NPSHa'), 'Matrix must include NPSHa formula and result rows.');
assert(matrixPanel.innerHTML.includes('Maximum Allowable NPSHr'), 'Matrix must include maximum allowable NPSHr formula and result rows.');
assert(matrixPanel.innerHTML.includes('Manual NPSHr Comparison'), 'Matrix must compare Manual NPSHr against maximum allowable NPSHr.');
assert(matrixPanel.innerHTML.includes('Not Required for route calculation'), 'Matrix must state that vendor curve verification does not block route calculation.');
assert(!matrixPanel.innerHTML.includes('Operating Region'), 'Matrix must not include pump-curve operating-region rows.');
assert(!matrixPanel.innerHTML.includes('Pump Performance Curve'), 'Matrix must not link pump route calculation to Pump Performance Curve.');
assert(matrixPanel.innerHTML.includes('Terhubung ke'), 'Matrix must show where each formula is connected.');
assert.equal(routeValueCell.textContent, '2.5 m', 'Existing Route Trace discharge row must be hydrated from live route data when it was blank.');
assert.equal(routeSourceCell.textContent, 'P-100 -> PIPE-2 -> SNK-100', 'Existing Route Trace discharge row must cite the discharge route source.');
assert.equal(snkValueCell.textContent, 'H=30.353 m; Q=50 m3/h; P=1.744 bar a; z=29.085 m', 'Existing Route Trace SNK row must be hydrated from live sink boundary data when it was blank.');
assert.equal(snkSourceCell.textContent, 'SNK-100 downstream boundary -> system head', 'Existing Route Trace SNK row must cite its downstream boundary source.');
const matrixRows = runtime.buildCalculationMatrixRows('P-100');
assert(matrixRows.some((row) => row.output === 'Required NPSHa' && /governing available ANSI\/HI margin criterion/.test(row.formula)), 'Matrix must include required NPSHa formula basis.');
assert(matrixRows.some((row) => row.output === 'Suction Loss' && /Suction Pipe\/Fitting\/Valve/.test(row.connectedTo)), 'Matrix must connect suction loss to the PFV path.');
assert(matrixRows.some((row) => row.output === 'Discharge Loss' && row.result === '2.5 m'), 'Matrix must include discharge loss as a live output row.');
assert(matrixRows.some((row) => row.output === 'Maximum Allowable NPSHr' && /governing route-calculated allowable NPSHr/.test(row.formula)), 'Matrix must include maximum allowable NPSHr as a design output.');
assert(matrixRows.some((row) => row.output === 'Manual NPSHr Comparison' && row.result === 'Safe'), 'Matrix must compare Manual NPSHr when available.');
assert(matrixRows.some((row) => row.output === 'Route Calculation Status' && row.result === 'Calculated'), 'Matrix must expose route calculation status.');
assert(!matrixRows.some((row) => /Operating Region|Pump Head Curve/i.test(row.output)), 'Matrix rows must drop pump-curve-only outputs.');

const trace = globalThis.__npshGlobalModel['P-100'].results.npshEvaluation.calculationTrace;
assert.equal(trace.formulaDefenseRows.length, 8, 'Pump Formula Defense rows must be rebuilt from live trace steps plus confidence gate.');
assert.equal(
  trace.formulaDefenseRows.find((row) => row.step === 'NPSHa')?.result,
  7,
  'Initial Pump Formula Defense NPSHa row must use the current live model value.'
);

const npshaStep = trace.steps.find((step) => step.title === 'NPSHa');
npshaStep.substitution = '9.000 - 1.000';
npshaStep.result = 8;
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
  'pump-formula-defense-live-audit.v10',
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
assert(runtimeSource.includes('hydrateRouteTraceDischargeReadout'), 'Runtime must hydrate blank discharge route trace readouts from live backend route data.');
assert(runtimeSource.includes('hydrateRouteTraceSinkReadout'), 'Runtime must hydrate blank SNK route trace readouts from live backend route data.');
assert(runtimeSource.includes('hydrateAllPumpTopLevelResults'), 'Runtime must hydrate nested backend NPSH results into top-level pump label fields.');
assert(runtimeSource.includes('Maximum Allowable NPSHr'), 'Runtime must expose maximum allowable NPSHr in Pump Formula Defense.');
assert(runtimeSource.includes('EngineeringPerformanceRefreshGovernor'), 'Runtime must delegate scheduled open-window refreshes to the performance governor when available.');
assert(!runtimeSource.includes("scheduleOpenFormulaDefenseWindowRefresh('', { reason: 'guard-loop'"), 'Runtime guard loop must not trigger repeated visual refreshes.');
assert(
  index.includes('engineering-pump-formula-defense-live-audit.js?v=20260621-pump-defense-route-design4'),
  'Index must cache-bust Pump Formula Defense live audit runtime.'
);
assert(
  manifest.includes('Pump formula defense live audit cache key: engineering-pump-formula-defense-live-audit.js?v=20260621-pump-defense-route-design4'),
  'Manifest must document Pump Formula Defense live audit cache key.'
);

console.log('Pump Formula Defense live audit validation passed.');
