const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-pump-npsh-acceptance-runtime.js');
const marginRuntimePath = path.join(rootDir, 'engineering-npsh-margin-runtime.js');
const indexPath = path.join(rootDir, 'index.html');

function assertClose(actual, expected, message, tolerance = 1e-9) {
  const delta = Math.abs(Number(actual) - expected);
  assert(
    Number.isFinite(delta) && delta <= tolerance,
    `${message}: expected ${expected}, got ${actual}`
  );
}

const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const marginRuntimeSource = fs.readFileSync(marginRuntimePath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');

assert(
  index.includes('engineering-pump-npsh-acceptance-runtime.js?v=20260621-pump-npsh-acceptance3'),
  'Pump NPSH acceptance runtime must be loaded from index.html.'
);
assert(
  !index.includes('<script src="engineering-npsh-margin-runtime.js'),
  'NPSH margin bridge must not block the initial HTML parse as a synchronous script.'
);
assert(
  index.indexOf("'engineering-npsh-margin-runtime.js?v=20260621-npsh-margin3'") >
    index.indexOf('const realtimeScripts = [') &&
    index.indexOf("'engineering-npsh-margin-runtime.js?v=20260621-npsh-margin3'") <
    index.indexOf("'engineering-pump-npsh-acceptance-runtime.js?v=20260621-pump-npsh-acceptance3'"),
  'NPSH margin bridge must load through realtimeScripts before Pump NPSH Acceptance.'
);
assert(
  runtimeSource.includes('PDF p.31 / printed p.20')
    && marginRuntimeSource.includes('PDF p.31 / printed p.20'),
  'General Purpose NPSH margin reference must point to the page-locked ANSI/HI table.'
);

const context = {
  console,
  Number,
  Math,
  Object,
  String,
  Array,
  JSON,
  renderSidebarCalls: []
};
context.globalThis = context;
context.globalModel = {
  'P-100': {
    type: 'pump',
    props: {
      npshMarginBasis: 'General Purpose',
      designFlow: 50,
      designHead: 29,
      designEfficiency: 62,
      designNpshr: 2.4002,
      bepFlow: 50,
      porMinPercent: 70,
      porMaxPercent: 120,
      aorMinPercent: 50,
      aorMaxPercent: 130
    },
    results: {
      flow: 65,
      npshr: 2.4002,
      operatingRegion: 'POR'
    }
  }
};
context.__npshGlobalModel = context.globalModel;
context.renderSidebar = function renderSidebar(nodeId) {
  context.renderSidebarCalls.push({
    nodeId,
    operatingRegion: context.globalModel[nodeId]?.results?.operatingRegion,
    percentBep: context.globalModel[nodeId]?.results?.bepPercent
  });
};

vm.createContext(context);
vm.runInContext(runtimeSource, context, { filename: runtimePath });

assert.strictEqual(
  context.EngineeringPumpNpshAcceptanceRuntime.version,
  'pump-npsh-acceptance.v3',
  'Runtime should expose its locked version.'
);
assert.strictEqual(
  context.getEffectivePumpNpshMarginCriteria.__pumpNpshAcceptanceVersion,
  'pump-npsh-acceptance.v3',
  'Runtime should guard getEffectivePumpNpshMarginCriteria.'
);

context.renderSidebar('P-100');
assert.strictEqual(
  context.globalModel['P-100'].results.operatingRegion,
  'AOR',
  'Sidebar render should sync live 130% BEP flow to AOR before reading margin criteria.'
);
assertClose(context.globalModel['P-100'].results.bepPercent, 130, 'Live operating percent should be 130% BEP.');

let criteria = context.getEffectivePumpNpshMarginCriteria(
  context.globalModel['P-100'].props,
  context.globalModel['P-100'].results.operatingRegion
);
assert.strictEqual(criteria.regionBasis, 'AOR', 'AOR flow should select AOR margin row.');
assertClose(criteria.ratio, 1.1, 'AOR General Purpose ratio should be 1.10.');
assertClose(criteria.margin, 1.0, 'AOR General Purpose margin should be 1.0 m.');
assert(/Table 9\.6\.1\.4\.11\.4/.test(criteria.reference), 'Criteria reference should name the General Purpose table.');

context.globalModel['P-100'].results.flow = 50;
context.renderSidebar('P-100');
assert.strictEqual(
  context.globalModel['P-100'].results.operatingRegion,
  'POR',
  'Sidebar render should resync BEP flow to POR.'
);
criteria = context.getEffectivePumpNpshMarginCriteria(
  context.globalModel['P-100'].props,
  context.globalModel['P-100'].results.operatingRegion
);
assertClose(criteria.ratio, 1.05, 'POR General Purpose ratio should be 1.05.');
assertClose(criteria.margin, 0.6, 'POR General Purpose margin should be 0.6 m.');

criteria = context.getEffectivePumpNpshMarginCriteria(
  { npshMarginBasis: 'User Defined', minNpshMarginRatio: '', minNpshMargin: '' },
  'AOR'
);
assert.strictEqual(criteria.basis, 'General Purpose', 'Blank User Defined basis should fall back to General Purpose.');
assert.strictEqual(criteria.regionBasis, 'AOR', 'Blank User Defined fallback should still respect operating region.');
assertClose(criteria.ratio, 1.1, 'Blank User Defined fallback should use General Purpose AOR ratio.');
assertClose(criteria.margin, 1.0, 'Blank User Defined fallback should use General Purpose AOR margin.');

console.log(JSON.stringify({
  passed: true,
  runtimeVersion: context.EngineeringPumpNpshAcceptanceRuntime.version,
  renderSidebarCalls: context.renderSidebarCalls,
  finalCriteria: criteria
}, null, 2));
