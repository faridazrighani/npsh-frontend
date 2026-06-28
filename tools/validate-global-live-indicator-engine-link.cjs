const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const JOURNALS_DIR = path.join(FRONTEND_ROOT, "journals");
const UNTIRTA_MAGIC = "UNTIRTA-NPSH-V1\n";

const SRC_RUNTIME = path.join(FRONTEND_ROOT, "engineering-src-canvas-parameter-runtime.js");
const ROUTE_RUNTIME = path.join(FRONTEND_ROOT, "engineering-route-trace-audit.js");
const DECIMAL_RUNTIME = path.join(FRONTEND_ROOT, "engineering-decimal-display-runtime.js");
const STABLE_RUNTIME = path.join(FRONTEND_ROOT, "engineering-live-parameter-stable-runtime.js");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");

function readText(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, "utf8");
}

function finiteNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
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
  assert(payload.model && typeof payload.model === "object", `${filePath} must contain a project model.`);
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

function nodesByType(model, type) {
  return Object.entries(model || {}).filter(([, node]) => node && node.type === type);
}

function firstFinite(...values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function sourceHead(node) {
  const results = node.results || {};
  return firstFinite(
    results.calculationTrace?.boundary?.totalSourceHead,
    results.calculationTrace?.boundary?.hydraulicHead,
    results.calculationTrace?.inputBasis?.totalSourceHead,
    results.hydraulicHead,
    results.sourceHead,
    results.boundaryHead
  );
}

function sinkHead(node) {
  const results = node.results || {};
  return firstFinite(
    results.requiredBoundaryHead,
    results.hydraulicHead,
    results.sinkHead,
    results.boundaryHead,
    results.calculationTrace?.boundary?.hydraulicHead,
    results.calculationTrace?.inputBasis?.hydraulicHead
  );
}

const srcRuntime = readText(SRC_RUNTIME);
const routeRuntime = readText(ROUTE_RUNTIME);
const decimalRuntime = readText(DECIMAL_RUNTIME);
const stableRuntime = readText(STABLE_RUNTIME);
const indexHtml = readText(INDEX_FILE);
const manifest = readText(MANIFEST_FILE);

assert(srcRuntime.includes("sourceInputFlowForNode"), "SRC indicator must keep fixed SRC input flow as the displayed source boundary.");
assert(srcRuntime.includes("solvedOperatingFlowForSource"), "SRC indicator must recover solved operating route flow for the Evaluated Flow row.");
assert(srcRuntime.includes("connectedRouteFlowForSource"), "SRC indicator must read connected route flow before static source input.");
assert(srcRuntime.includes("patchSourceRenderFunction"), "SRC presentation must refresh after render/backend hooks.");
assert(srcRuntime.includes('"updateSimulation"'), "SRC presentation must hook updateSimulation globally.");
assert(srcRuntime.includes('"applyBackendSimulationPrimaryResults"'), "SRC presentation must hook backend result application globally.");
assert(srcRuntime.includes("data-engineering-runtime-originaltitle"), "SRC hover backup title must be synchronized with current canvas values.");
assert(srcRuntime.includes("sourcePresentationRefreshTimer"), "SRC presentation refresh must debounce value-only updates.");
assert(!srcRuntime.includes("[0, 80, 240, 700, 1400]"), "SRC presentation must not use repeated value-refresh sweeps.");

assert(routeRuntime.includes("syncRouteObjectTooltips"), "Route runtime must sync pump/SNK object hover titles globally.");
assert(routeRuntime.includes("syncPumpObjectTooltip"), "Pump hover title must be rebuilt from current live-panel values.");
assert(routeRuntime.includes("syncSinkObjectTooltip"), "SNK hover title must be rebuilt from current canonical/live-panel values.");
assert(routeRuntime.includes("data-engineering-runtime-originaltitle"), "Pump/SNK hover backup title must be synchronized with current canvas values.");
assert(routeRuntime.includes("scheduleRouteObjectTooltipSync(canvas, 360)"), "Route runtime must schedule a bounded solver hover sync after backend repaint.");
assert(routeRuntime.includes("scheduleRouteObjectTooltipSync(canvas, 420)"), "Route runtime must schedule lightweight post-render hover sync after ordinary canvas repaint.");
assert(routeRuntime.includes("refreshVisibleAuditSurfaces, delayMs"), "Backend result application must schedule presentation refresh after engine results land.");
assert(routeRuntime.includes("routeSurfaceRefreshPending"), "Route runtime must throttle global surface refreshes so canvas updates do not stack.");
assert(routeRuntime.includes("observer.observe(document.getElementById('canvas') || document.body || document.documentElement, { childList: true, subtree: true })"), "Global route observer must stay scoped and childList-only for performance.");
assert(!routeRuntime.includes("observer.observe(document.documentElement, { attributes: true, characterData: true, childList: true, subtree: true })"), "Global route observer must not watch attributes/characterData across the whole document.");
assert(routeRuntime.includes("function scheduleDefaultCanvasRouteTracePrune(scope, delayMs = 40)"), "Presentation lock scheduler must remain installed.");
assert(routeRuntime.includes("canvasOverlayPruneScope = canvasOverlayPruneScope === document ? document : (scope || document);"), "Presentation lock must not stop when audit overlay unlock is enabled.");

assert(decimalRuntime.includes("MutationObserver"), "Decimal display lock must observe realtime DOM updates globally.");
assert(decimalRuntime.includes('"input"'), "Decimal display lock must react while users edit inputs.");
assert(decimalRuntime.includes('"change"'), "Decimal display lock must react after users commit inputs.");
assert(decimalRuntime.includes('"SRC Input Flow"'), "Decimal display lock must protect SRC input flow formatting globally.");
assert(decimalRuntime.includes('"Evaluated Flow"'), "Decimal display lock must protect evaluated route flow formatting globally.");
assert(decimalRuntime.includes('"Sink Flow"'), "Decimal display lock must protect SNK flow formatting globally.");
assert(decimalRuntime.includes("attempts >= 32"), "Decimal display lock retry loop must stay short for performance.");

assert(stableRuntime.includes('const VERSION = "2026.06-live-parameter-stable3"'), "Stable live parameter runtime must expose the global stable-shell version.");
assert(stableRuntime.includes('PANEL_SELECTOR = ".pump-live-params, .tank-live-params, .source-live-params, .sink-live-params"'), "Stable runtime must cover pump, tank, source, and sink canvas panels.");
assert(stableRuntime.includes("syncMatchingRows"), "Stable runtime must update matching live rows in place.");
assert(stableRuntime.includes("setTextIfChanged(valueElement(targetRow)"), "Stable runtime must patch numeric values through textContent.");
assert(stableRuntime.includes("stabilizePanelFromReplacement"), "Stable runtime must absorb replacement panels into the existing canvas shell.");
assert(stableRuntime.includes("shouldAllowStructureReplacement"), "Stable runtime must still allow intentional row-structure changes outside solve/drag lifecycle.");
assert(stableRuntime.includes("detachedPanels"), "Stable runtime must restore a detached panel shell when the renderer replaces it.");
assert(stableRuntime.includes("restoreRemovedPanel"), "Stable runtime must immediately reinsert removed panels during solve/input/drag busy windows.");
assert(stableRuntime.includes("liveParameterStableRestored"), "Stable runtime must mark restored panels for QA.");
assert(stableRuntime.includes("freezeAllPanelGeometry"), "Stable runtime must freeze live panel geometry during solver/input/drag updates.");
assert(stableRuntime.includes("restorePanelGeometry"), "Stable runtime must restore panel geometry if the renderer rewrites style/class during a busy window.");
assert(stableRuntime.includes("pendingPanelAttributes"), "Stable runtime must defer visual shell attribute changes so values can update without panel flicker.");
assert(stableRuntime.includes("liveParameterStableAttributesFlushed"), "Stable runtime must flush deferred visual shell attributes once the busy window settles.");
assert(stableRuntime.includes("skipTransientPlaceholder"), "Stable runtime must prevent transient solver placeholders from erasing visible values.");
assert(stableRuntime.includes("PATCH_FUNCTIONS"), "Stable runtime must hook solver/render functions globally.");
assert(stableRuntime.includes("npsh:calculation-applying-results"), "Stable runtime must listen to solver applying-results events.");
assert(stableRuntime.includes("pointermove"), "Stable runtime must stay stable during canvas dragging.");
assert(stableRuntime.includes('"input", "change"'), "Stable runtime must protect canvas panels while users edit numeric inputs.");
assert(stableRuntime.includes("MutationObserver"), "Stable runtime must watch late live-parameter panel insertions.");
assert(stableRuntime.includes("dataset.liveParameterStableShell"), "Stable runtime must mark stable shell panels for QA.");
assert(!stableRuntime.includes("innerHTML"), "Stable runtime must not rebuild live parameter panels via innerHTML.");

assert(indexHtml.includes("engineering-src-canvas-parameter-runtime.js?v=20260628-src-stable-values1"), "Index must load the global SRC realtime indicator runtime.");
assert(indexHtml.includes("engineering-live-parameter-stable-runtime-20260628-global-stable-values3.js?v=20260628-global-stable-values3"), "Index must load the global stable live-parameter runtime with a physical filename cache-bust.");
assert(indexHtml.includes("engineering-route-trace-audit.js?v=20260628-discharge-duty-status1"), "Index must load the global SNK/pump hover-sync runtime.");
assert(indexHtml.includes("engineering-decimal-display-runtime.js?v=20260609-pump-live-readout-click-lock2"), "Index must load the global decimal display lock.");

assert(manifest.includes("Global live indicator engine-link validation"), "Manifest must document the global live indicator engine-link validation.");

const simulationFiles = listSimulationUntirtaFiles();
assert(simulationFiles.length === 6, `Expected 6 simulation UNTIRTA files; found ${simulationFiles.length}.`);

for (const filePath of simulationFiles) {
  const project = readUntirtaProject(filePath);
  const fileName = path.basename(filePath);
  const sources = nodesByType(project.model, "source");
  const pumps = nodesByType(project.model, "pump");
  const sinks = nodesByType(project.model, "sink");
  const pipes = nodesByType(project.model, "pipe");

  assert(sources.length === 1, `${fileName} must keep one canonical SRC/source object for global readout parity.`);
  assert(pumps.length === 1, `${fileName} must keep one canonical pump object for global readout parity.`);
  assert(sinks.length === 1, `${fileName} must keep one canonical SNK/sink object for global readout parity.`);
  assert(pipes.length >= 2, `${fileName} must keep connected suction/discharge pipe objects for solved route flow.`);

  for (const [sourceId, source] of sources) {
    assert(source.results && typeof source.results === "object", `${fileName} ${sourceId} must keep source results for indicator fallback.`);
    assert(source.props && typeof source.props === "object", `${fileName} ${sourceId} must keep source props for pre-solve fallback.`);
    assert(sourceHead(source) !== null, `${fileName} ${sourceId} must expose source head trace/results for Source Head.`);
  }

  for (const [sinkId, sink] of sinks) {
    assert(sink.results && typeof sink.results === "object", `${fileName} ${sinkId} must keep sink results for realtime Sink readouts.`);
    assert(sink.props && typeof sink.props === "object", `${fileName} ${sinkId} must keep sink props for pre-solve fallback.`);
    assert(sinkHead(sink) !== null, `${fileName} ${sinkId} must expose sink head trace/results for Sink Head.`);
  }

  for (const [pumpId, pump] of pumps) {
    const results = pump.results || {};
    assert(results && typeof results === "object", `${fileName} ${pumpId} must keep pump results for live pump indicators.`);
    assert(firstFinite(results.flow, results.npshEvaluation?.flow, pump.props?.designFlow) !== null, `${fileName} ${pumpId} must expose solved/design flow for pump/SRC/SNK parity.`);
    assert(firstFinite(results.npsha, results.npshEvaluation?.npsha) !== null, `${fileName} ${pumpId} must expose NPSHa for pump live indicators.`);
    assert(firstFinite(results.npshr, results.npshEvaluation?.npshr) !== null, `${fileName} ${pumpId} must expose NPSHr for pump live indicators.`);
  }
}

console.log(`Global live indicator engine-link validation passed for ${simulationFiles.length} UNTIRTA simulations.`);
