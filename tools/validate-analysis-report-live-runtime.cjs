const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-analysis-report-live-runtime.js");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const CASE_FILE = path.join(FRONTEND_ROOT, "journals", "simulasi_1", "simulasi_performansi_pompa_air_umpan_tangki_deaerator.untirta");
const CACHE_KEY = "engineering-analysis-report-live-runtime.js?v=20260609-analysis-report-live1";
const VERSION = "2026.06-analysis-report-live1";
const UNTIRTA_MAGIC = "UNTIRTA-NPSH-V1\n";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(filePath, encoding = "utf8") {
  return fs.readFileSync(filePath, encoding);
}

function readUntirtaProject(filePath) {
  const file = read(filePath, null);
  const magic = Buffer.from(UNTIRTA_MAGIC, "utf8");
  assert(file.subarray(0, magic.length).equals(magic), `${filePath} is not an UNTIRTA project file.`);
  const headerLength = Number.parseInt(file.subarray(magic.length, magic.length + 8).toString("ascii"), 16);
  assert(Number.isFinite(headerLength) && headerLength > 0, `${filePath} has an invalid UNTIRTA header length.`);
  const headerOffset = magic.length + 8;
  const payloadOffset = headerOffset + headerLength;
  const header = JSON.parse(file.subarray(headerOffset, payloadOffset).toString("utf8"));
  let payload = file.subarray(payloadOffset, payloadOffset + header.payloadBytes);
  if (header.compression === "gzip") payload = zlib.gunzipSync(payload);
  const project = JSON.parse(payload.toString("utf8"));
  assert(project.model, `${filePath} does not contain a project model.`);
  return project;
}

function loadRuntime(runtimeSource, model) {
  const fakeBody = { querySelectorAll: () => [] };
  const fakeDocument = {
    documentElement: { dataset: {} },
    body: fakeBody,
    addEventListener: () => {},
    querySelectorAll: () => []
  };
  const sandbox = {
    console,
    document: fakeDocument,
    globalModel: model,
    __npshGlobalModel: model,
    MutationObserver: class {
      observe() {}
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    addEventListener: () => {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename: RUNTIME_FILE });
  return sandbox.EngineeringAnalysisReportLiveRuntime;
}

function metricText(metrics, label) {
  const value = metrics.get(label.toLowerCase());
  assert(value, `Missing live metric: ${label}`);
  return value.text;
}

const index = read(INDEX_FILE);
const runtime = read(RUNTIME_FILE);
const manifest = read(MANIFEST_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const project = readUntirtaProject(CASE_FILE);
const api = loadRuntime(runtime, project.model);

assert(index.includes(CACHE_KEY), "index.html must load the cache-busted Analysis Report live runtime.");
assert(runtime.includes(`const VERSION = '${VERSION}'`), "Analysis Report live runtime version must match the cache key.");
assert(runtime.includes("collectLiveMetrics"), "Runtime must collect live model metrics.");
assert(runtime.includes("__npshLastBackendSimulationResponse"), "Runtime must be able to read latest backend response context.");
assert(runtime.includes("MutationObserver"), "Runtime must refresh when report windows are inserted.");
assert(runtime.includes("patchUpdateSimulation"), "Runtime must hook updateSimulation for realtime calculation refreshes.");
assert(runtime.includes("updateComparisonTable"), "Runtime must update existing comparison table cells.");
assert(runtime.includes("updateApplicationValueTable"), "Runtime must update existing application value table cells when present.");
assert(runtime.includes("setCellText"), "Runtime must patch cell text instead of rebuilding report layout.");
assert(runtime.includes("setPipeGroup('Pipe Suction'") && runtime.includes("${prefix} - Total Head Loss"), "Runtime must include suction pipe total-loss metric mapping.");
assert(runtime.includes("setPipeGroup('Pipe Discharge'") && runtime.includes("${prefix} - Total Head Loss"), "Runtime must include discharge pipe total-loss metric mapping.");
assert(runtime.includes("Pump - NPSHa"), "Runtime must include pump NPSHa metric mapping.");
assert(runtime.includes("Outlet Readout - Boundary Abs. Pressure"), "Runtime must include outlet boundary readout mapping.");
assert(!runtime.includes("innerHTML ="), "Runtime must not replace table/report layout through innerHTML.");

assert(api && api.version === VERSION, "Runtime API must expose the Analysis Report live version.");
assert(typeof api.collectLiveMetrics === "function", "Runtime API must expose live metric collection.");
assert(typeof api.refresh === "function", "Runtime API must expose a refresh function.");

const metrics = api.collectLiveMetrics();
assert(metrics && typeof metrics.get === "function" && metrics.size > 40, "Runtime must collect a broad live metric set from the current case.");

assert(metricText(metrics, "Fluid Basis - Temperature").includes("100 deg C"), "Temperature must come from Fluid Basis.");
assert(metricText(metrics, "Fluid Basis - Kinematic viscosity").includes("8.0300e-7 m2/s"), "Comparison kinematic viscosity must use m2/s.");
assert(metrics.get("fluid basis - kinematic viscosity").valueText.includes("0.803 cSt"), "Application value view must retain cSt viscosity.");
assert(metricText(metrics, "Pipe Suction - Total head loss").includes("2.615534 m"), "Suction total loss must come from pipe trace totals.");
assert(metricText(metrics, "Pipe Discharge - Total head loss").includes("11.668509 m"), "Discharge total loss must come from pipe trace totals.");
assert(metricText(metrics, "Pump - NPSHa").includes("6.4656 m"), "Pump NPSHa must come from pump NPSH results.");
assert(metricText(metrics, "Pump - Pump head evaluated").includes("24 m"), "Pump evaluated head must come from solved pump/system head.");
assert(metricText(metrics, "SNK - Reference pressure").includes("1.74370712905 bar a"), "SNK reference pressure must come from sink boundary result.");
assert(metricText(metrics, "Outlet Readout - Vapor margin").includes("7.759"), "Outlet vapor margin must be recalculated from live pressure and Fluid Basis.");

assert(
  packageJson.scripts?.["validate:analysis-report-live-runtime"] === "node tools/validate-analysis-report-live-runtime.cjs",
  "package.json must expose validate:analysis-report-live-runtime."
);
assert(
  manifest.includes(`Analysis Report live runtime cache key: ${CACHE_KEY}`),
  "Manifest must document the Analysis Report live runtime cache key."
);
assert(
  manifest.includes("Analysis Report live runtime validation: npm run validate:analysis-report-live-runtime"),
  "Manifest must document Analysis Report live runtime validation."
);

console.log("Analysis Report live runtime validation passed.");
