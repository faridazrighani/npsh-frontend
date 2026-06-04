const fs = require("fs");
const path = require("path");
const vm = require("vm");
const zlib = require("zlib");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(FRONTEND_ROOT, "..");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-decimal-display-runtime.js");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const JOURNALS_DIR = path.join(FRONTEND_ROOT, "journals");
const API_ROOT = path.join(WORKSPACE_ROOT, "npsh-api");
const UNTIRTA_MAGIC = "UNTIRTA-NPSH-V1\n";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readFile(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, "utf8");
}

function readUntirtaProject(filePath) {
  const file = fs.readFileSync(filePath);
  const magic = Buffer.from(UNTIRTA_MAGIC, "utf8");
  assert(file.subarray(0, magic.length).equals(magic), `${filePath} is not an UNTIRTA project file.`);

  const headerLength = Number.parseInt(file.subarray(magic.length, magic.length + 8).toString("ascii"), 16);
  assert(Number.isFinite(headerLength) && headerLength > 0, `${filePath} has an invalid UNTIRTA header length.`);

  const payloadOffset = magic.length + 8 + headerLength;
  const header = JSON.parse(file.subarray(magic.length + 8, payloadOffset).toString("utf8"));
  const payloadBuffer = file.subarray(payloadOffset, payloadOffset + header.payloadBytes);
  const payloadText = header.compression === "gzip"
    ? zlib.gunzipSync(payloadBuffer).toString("utf8")
    : payloadBuffer.toString("utf8");
  const payload = JSON.parse(payloadText);
  assert(header.fileFormat === "untirta-npsh-simulation", `${filePath} has an unexpected header format.`);
  assert(payload.model, `${filePath} does not contain a project model.`);
  return payload;
}

function listSimulationUntirtaFiles() {
  return fs.readdirSync(JOURNALS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^simulasi_\d+$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .flatMap((entry) => {
      const dir = path.join(JOURNALS_DIR, entry.name);
      return fs.readdirSync(dir)
        .filter((fileName) => fileName.endsWith(".untirta"))
        .map((fileName) => path.join(dir, fileName));
    });
}

function loadRuntimeApi(runtimeSource) {
  const fakeDocumentElement = { dataset: {} };
  const fakeDocument = {
    documentElement: fakeDocumentElement,
    body: null,
    querySelectorAll: () => []
  };
  const sandbox = {
    console,
    document: fakeDocument,
    MutationObserver: class {
      observe() {}
    },
    setTimeout: (callback) => {
      if (typeof callback === "function") callback();
      return 1;
    },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    addEventListener: () => {},
    requestAnimationFrame: (callback) => {
      if (typeof callback === "function") callback();
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename: RUNTIME_FILE });
  return { api: sandbox.EngineeringDecimalDisplayRuntime, documentElement: fakeDocumentElement };
}

const runtime = readFile(RUNTIME_FILE);
assert(runtime.includes("const ENGINEERING_DISPLAY_DECIMALS = 3"), "Runtime must define 3 display decimals.");
assert(runtime.includes("MutationObserver"), "Runtime must watch DOM mutations for realtime recalculation displays.");
assert(runtime.includes('"input"'), "Runtime must react to input changes.");
assert(runtime.includes('"change"'), "Runtime must react to committed input changes.");
assert(runtime.includes("dataset.engineeringDecimalDisplayLock"), "Runtime must expose a QA/audit DOM lock marker.");
assert(runtime.includes("shouldFormatValue"), "Runtime must expose numeric label gating for audit validation.");
assert(runtime.includes('"Dyn Feed"') && runtime.includes('"Dyn Net"'), "Runtime must include dynamic SRC labels after realtime start.");

const indexHtml = readFile(INDEX_FILE);
assert(
  indexHtml.includes("engineering-decimal-display-runtime.js?v=20260604-decimal-display-lock1"),
  "index.html must load the engineering decimal display runtime."
);

const { api, documentElement } = loadRuntimeApi(runtime);
assert(api && api.decimals === 3, "Runtime API must report 3 display decimals.");
assert(documentElement.dataset.engineeringDecimalDisplayLock === api.version, "Runtime must stamp its lock version into the document element.");

const formatCases = [
  ["Flow", "50.0", "m3/h", "50.000"],
  ["Suction Press.", "1.622", "bar a", "1.622"],
  ["NPSH Available", "6.5", "m", "6.500"],
  ["NPSH Required", "2.4", "m", "2.400"],
  ["NPSH Margin", "+4.1", "m", "+4.100"],
  ["NPSH Ratio", "2.69", "", "2.690"],
  ["Basis Vapor Press.", "1.014", "bar a", "1.014"],
  ["Vapor Press. Used", "1.014", "bar a", "1.014"],
  ["Pump Head", "24.0", "m", "24.000"],
  ["Suction Loss", "2.616 / 0.246", "m/bar", "2.616 / 0.246"],
  ["Dyn Feed", "11.7", "m3/h", "11.700"],
  ["Dyn Net", "-0.25", "m3/h", "-0.250"]
];

for (const [label, value, unit, expected] of formatCases) {
  assert(api.shouldFormatValue(label, value, unit), `${label} must be a protected numeric engineering display.`);
  assert(api.formatNumericExpression(value) === expected, `${label} must format ${value} as ${expected}.`);
}

const skipCases = [
  ["Mode", "Fixed"],
  ["Route", "Fluid Basis -> SRC-100 -> P-100"],
  ["Status", "Safe"],
  ["Target Trend", "Rising"]
];
for (const [label, value] of skipCases) {
  assert(!api.shouldFormatValue(label, value, ""), `${label} must not be treated as a numeric decimal display.`);
  assert(api.formatNumericExpression(value) === value, `${label} value must remain unchanged.`);
}

const simulationFiles = listSimulationUntirtaFiles();
assert(simulationFiles.length === 6, `Expected 6 simulation UNTIRTA files; found ${simulationFiles.length}.`);
for (const filePath of simulationFiles) {
  const projectFile = readUntirtaProject(filePath);
  const nodes = Object.entries(projectFile.model || {});
  assert(nodes.some(([, node]) => node && node.type === "source"), `${filePath} must include at least one SRC/source object.`);
  assert(nodes.some(([, node]) => node && node.type === "pump"), `${filePath} must include at least one pump object.`);
}

const backendFiles = [
  path.join(API_ROOT, "core", "simulation-engine.js"),
  path.join(API_ROOT, "server", "src", "engine", "bundled-npsh-engine.mjs"),
  path.join(API_ROOT, "server", "src", "engine", "bundled-npsh-engine.cjs")
];
const forbiddenBackendPatterns = [
  /pump\.results\.(?:flow|head|power|npsha|npshr|npshMargin|npshRatio|requiredNpsha|npshExcess|bepPercent|efficiency|suctionLoss|dischargeLoss|requiredSystemHead|pumpHeadAtFlow|headResidual)\s*=.*toFixed\((?:1|2|4|6)\)/,
  /function formatCanvasReadoutValue\(value, digits = 2\)/,
  /if \(key === 'temperature'\) return 1;/,
  /if \(key === 'flow' && unit === 'm3\/s'\) return 4;/,
  /Required NPSHa by selected basis: \$\{requiredNpsha\.toFixed\(2\)\}/,
  /Worst-case AOR excess NPSH: \$\{envelope\.worstCase\.npshExcess\.toFixed\(2\)\}/,
  /formattedResidual = Math\.abs\(residual\)\.toFixed\(2\)/
];

for (const filePath of backendFiles) {
  const source = readFile(filePath);
  for (const pattern of forbiddenBackendPatterns) {
    assert(!pattern.test(source), `${path.basename(filePath)} still contains a stale non-3-decimal display formatter: ${pattern}`);
  }
  if (filePath.endsWith("simulation-engine.js")) {
    assert(source.includes("const ENGINEERING_DISPLAY_DECIMALS = 3"), "Core engine must define the shared engineering display decimal lock.");
    assert(source.includes("function formatEngineeringDisplayNumber"), "Core engine must use an auditable display formatter.");
    assert(source.includes("function formatCanvasReadoutValue(value, digits = ENGINEERING_DISPLAY_DECIMALS)"), "Core canvas readout must default to the shared 3-decimal lock.");
  }
  assert(source.includes("const ENGINEERING_DISPLAY_DECIMALS = 3"), `${path.basename(filePath)} must define the shared engineering display decimal lock.`);
  assert(source.includes("function formatEngineeringDisplayNumber"), `${path.basename(filePath)} must use an auditable display formatter.`);
  assert(
    source.includes("function formatCanvasReadoutValue(value, digits = ENGINEERING_DISPLAY_DECIMALS)"),
    `${path.basename(filePath)} canvas readout must default to the shared 3-decimal lock.`
  );
}

console.log(`Engineering decimal display lock validation passed for ${formatCases.length} display samples and ${simulationFiles.length} UNTIRTA simulations.`);
