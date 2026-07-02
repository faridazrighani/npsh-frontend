const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-src-canvas-parameter-runtime.js");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const JOURNALS_DIR = path.join(FRONTEND_ROOT, "journals");
const UNTIRTA_MAGIC = "UNTIRTA-NPSH-V1\n";

const RUNTIME_CACHE_KEY = "engineering-src-canvas-parameter-runtime.js?v=20260702-object-status-clean1";
const DEFAULT_ROW_LABELS = ["Mode", "SRC Input Flow", "Source P abs", "Source Elev.", "Source Head"];
const ALWAYS_HIDDEN_ROWS = new Set(["Contribution", "Suction Loss", "NPSH at Pump", "Pump NPSHa"]);
const DYNAMIC_ROWS = new Set(["Dyn Mode", "Target", "Dyn Feed", "Target Net", "Dyn Net", "Target Trend", "Dyn Trend"]);
const ROW_LABEL_RENAMES = new Map([
  ["Outlet Flow", "SRC Input Flow"],
  ["Source Flow", "SRC Input Flow"],
  ["Source Press.", "Source P abs"],
  ["Source Pressure", "Source P abs"]
]);
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

function normalizeSourceLabel(value) {
  const label = normalizeRowLabel(value);
  return ROW_LABEL_RENAMES.get(label) || label;
}

function filterRows(labels, unlocked) {
  return labels.map(normalizeSourceLabel).filter((label) => {
    const normalized = normalizeRowLabel(label);
    return !ALWAYS_HIDDEN_ROWS.has(normalized) && (unlocked || !DYNAMIC_ROWS.has(normalized));
  });
}

function formatDisplayValue(value, digits = 3) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric.toFixed(digits) : null;
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
assert(runtime.includes('2026.07-src-canvas-flow-basis-lock5'), "Runtime must keep the source flow canvas basis lock version.");
assert(runtime.includes("isSourceLiveDynamicDisplayActive = isRealtimeDynamicUnlocked"), "Runtime must override the SRC dynamic display gate.");
assert(runtime.includes("setRealtimeDynamicUnlocked(true)"), "Runtime must unlock SRC dynamic rows when realtime dynamic starts.");
assert(runtime.includes("setRealtimeDynamicUnlocked(false)"), "Runtime must lock SRC dynamic rows when realtime dynamic stops.");
assert(runtime.includes("dataset.srcCanvasParameterDefaultLock"), "Runtime must expose its SRC canvas parameter lock version in the DOM for QA.");
assert(runtime.includes("canonicalSourceValueForLabel"), "Runtime must recover exact source pressure/elevation/head values before display rounding.");
assert(runtime.includes("sourceHeadFromLiveInputs"), "Runtime must derive Source Head from live pressure/elevation when backend trace is still stale.");
assert(runtime.includes("pressureAbsBarFromSourceProps"), "Runtime must derive absolute source pressure from live SRC props before fallback display.");
assert(runtime.includes("sourceInputFlowForNode"), "Runtime must preserve fixed SRC input flow separately from evaluated route flow.");
assert(runtime.includes('props.flowInputMode = "Volumetric Flow"'), "Runtime must lock SRC Flow Input Mode to Volumetric Flow.");
assert(!runtime.includes("/mass\\s+flow/i.test(flowMode)"), "Runtime must not recover SRC input flow from Mass Flow mode.");
assert(runtime.includes("shouldShowEvaluatedFlow"), "Runtime must show evaluated route flow only when it differs from SRC input flow.");
assert(runtime.includes("solvedOperatingFlowForSource"), "Runtime must still recover solved operating route flow for the Evaluated Flow row.");
assert(runtime.includes("connectedRouteFlowForSource"), "Runtime must read connected pipe/pump flow for SRC canvas realtime flow parity.");
assert(runtime.includes("singleRouteSolvedFlowForSource"), "Runtime must safely fall back to single-route solved pump/sink flow before using static source input.");
assert(runtime.includes("syncSourceObjectTooltip"), "Runtime must keep SRC object hover/title synchronized with canonical canvas values.");
assert(runtime.includes("sourceHasHydraulicConnection"), "Runtime must keep disconnected SRC objects Incomplete instead of green/OK.");
assert(runtime.includes("source-status-incomplete"), "Runtime must mark disconnected SRC object icons with the incomplete class.");
assert(runtime.includes("dataset.sourceObjectTooltipLock"), "Runtime must mark SRC object hover/title synchronization for QA.");
assert(runtime.includes('data-engineering-runtime-originaltitle'), "Runtime must update the SRC hover title backup used by the hover bridge.");
assert(runtime.includes("patchSourceRenderFunction"), "Runtime must refresh SRC canvas/hover after render and backend-result hooks.");
assert(runtime.includes('"SRC Input Flow"'), "Runtime must normalize source outlet flow labels to SRC Input Flow.");
assert(runtime.includes('"Evaluated Flow"'), "Runtime must expose evaluated route flow when it differs from SRC input.");
assert(runtime.includes('"Source P abs"'), "Runtime must normalize source pressure labels to Source P abs.");
assert(runtime.includes("normalizeBoundaryTerminology"), "Runtime must normalize pump property boundary cards to Source/Sink terminology.");
assert(runtime.includes('"Flow Demand Sink"'), "Runtime must normalize visible SNK type subtitles away from generic Boundary wording.");
assert(runtime.includes("formatTooltipParsedNumber"), "Runtime must format SRC hover flow metrics to the global 3-decimal display lock.");
assert(runtime.includes("SOURCE_TOOLTIP_HIDDEN_ROWS"), "Runtime must hide non-core SRC contribution rows from the default tooltip.");
assert(runtime.includes('"Contribution to tank"'), "Runtime must remove SRC contribution rows from the default hover format.");
assert(runtime.includes("sourceObserverNormalizePending"), "SRC observer must throttle normalize passes for performance.");
assert(runtime.includes("sourcePresentationRefreshTimer"), "SRC presentation refreshes must be debounced for stable canvas value updates.");
assert(!runtime.includes("[0, 80, 240, 700, 1400]"), "SRC presentation refresh must not use the old repeated sweep schedule.");
assert(runtime.includes('observe(document.getElementById("canvas") || document.body, { childList: true, subtree: true, characterData: true })'), "SRC observer must stay scoped to canvas/body child/text changes.");
assert(!runtime.includes("observe(document.body, { attributes: true, childList: true, subtree: true, characterData: true })"), "SRC observer must not watch all body attribute changes.");
assert(runtime.includes("attempts >= 32"), "SRC install retry loop must stay short for performance.");
for (const label of DYNAMIC_ROWS) {
  assert(runtime.includes(`"${label}"`), `Runtime must recognize dynamic SRC row "${label}".`);
}
assert(ALWAYS_HIDDEN_ROWS.has("Contribution"), "Contribution must stay hidden from the default SRC canvas parameter card.");

const indexHtml = fs.readFileSync(INDEX_FILE, "utf8");
assert(
  indexHtml.includes(RUNTIME_CACHE_KEY),
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
  for (const sourceId of sourceIds) {
    const source = projectFile.model[sourceId] || {};
    const trace = source.results?.calculationTrace?.boundary || {};
    const sourceHead = formatDisplayValue(trace.totalSourceHead);
    if (sourceHead) {
      assert(
        sourceHead !== "19.400",
        `${path.basename(filePath)} ${sourceId} must not preserve stale 1-decimal source head 19.400.`
      );
    }
    if (path.basename(filePath) === "simulasi_performansi_pompa_air_umpan_tangki_deaerator.untirta") {
      assert(sourceHead === "19.369", "Simulasi 1 SRC-100 Source Head must render from exact trace as 19.369 m.");
    }
  }
}

console.log(`SRC canvas parameter lock validation passed for default state and ${simulationFiles.length} UNTIRTA simulations.`);
