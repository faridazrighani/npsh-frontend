const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-src-canvas-parameter-runtime.js");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const JOURNALS_DIR = path.join(FRONTEND_ROOT, "journals");
const UNTIRTA_MAGIC = "UNTIRTA-NPSH-V1\n";

const DEFAULT_ROW_LABELS = ["Mode", "Outlet Flow", "Contribution", "Source Press.", "Source Elev.", "Source Head"];
const ALWAYS_HIDDEN_ROWS = new Set(["Suction Loss", "NPSH at Pump", "Pump NPSHa"]);
const DYNAMIC_ROWS = new Set(["Dyn Mode", "Target", "Dyn Feed", "Target Net", "Dyn Net", "Target Trend", "Dyn Trend"]);
const SOURCE_ROW_LABELS = [
  "Mode",
  "Dyn Mode",
  "Outlet Flow",
  "Target",
  "Contribution",
  "Dyn Feed",
  "Target Net",
  "Dyn Net",
  "Target Trend",
  "Dyn Trend",
  "Source Press.",
  "Source Elev.",
  "Source Head",
  "Suction Loss",
  "NPSH at Pump"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeRowLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function filterRows(labels, unlocked) {
  return labels.filter((label) => {
    const normalized = normalizeRowLabel(label);
    return !ALWAYS_HIDDEN_ROWS.has(normalized) && (unlocked || !DYNAMIC_ROWS.has(normalized));
  });
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

const runtime = fs.readFileSync(RUNTIME_FILE, "utf8");
assert(runtime.includes("isSourceLiveDynamicDisplayActive = isRealtimeDynamicUnlocked"), "Runtime must override the SRC dynamic display gate.");
assert(runtime.includes("setRealtimeDynamicUnlocked(true)"), "Runtime must unlock SRC dynamic rows when realtime dynamic starts.");
assert(runtime.includes("setRealtimeDynamicUnlocked(false)"), "Runtime must lock SRC dynamic rows when realtime dynamic stops.");
assert(runtime.includes("dataset.srcCanvasParameterDefaultLock"), "Runtime must expose its SRC canvas parameter lock version in the DOM for QA.");
for (const label of DYNAMIC_ROWS) {
  assert(runtime.includes(`"${label}"`), `Runtime must recognize dynamic SRC row "${label}".`);
}
assert(!DYNAMIC_ROWS.has("Contribution"), "Contribution must remain visible in the default SRC canvas parameter card.");

const indexHtml = fs.readFileSync(INDEX_FILE, "utf8");
assert(
  indexHtml.includes("engineering-src-canvas-parameter-runtime.js?v=20260604-src-param-default-lock5"),
  "index.html must load the SRC canvas parameter lock runtime."
);

const defaultRows = filterRows(SOURCE_ROW_LABELS, false);
assert(
  JSON.stringify(defaultRows) === JSON.stringify(DEFAULT_ROW_LABELS),
  `Default SRC canvas rows must be ${DEFAULT_ROW_LABELS.join(", ")}; got ${defaultRows.join(", ")}.`
);

const dynamicRows = filterRows(SOURCE_ROW_LABELS, true);
for (const label of DYNAMIC_ROWS) {
  assert(dynamicRows.includes(label), `Unlocked realtime SRC canvas rows must include "${label}".`);
}
for (const label of ALWAYS_HIDDEN_ROWS) {
  assert(!dynamicRows.includes(label), `SRC canvas rows must always hide "${label}".`);
}

const simulationFiles = listSimulationUntirtaFiles();
assert(simulationFiles.length === 6, `Expected 6 simulation UNTIRTA files; found ${simulationFiles.length}.`);

for (const filePath of simulationFiles) {
  const projectFile = readUntirtaProject(filePath);
  const sourceIds = Object.entries(projectFile.model)
    .filter(([, node]) => node && node.type === "source")
    .map(([id]) => id);
  assert(sourceIds.length > 0, `${filePath} must include at least one SRC/source object.`);
  assert(
    JSON.stringify(filterRows(SOURCE_ROW_LABELS, false)) === JSON.stringify(DEFAULT_ROW_LABELS),
    `${path.basename(filePath)} must use the default SRC canvas row contract until realtime dynamic is started.`
  );
}

console.log(`SRC canvas parameter lock validation passed for default state and ${simulationFiles.length} UNTIRTA simulations.`);
