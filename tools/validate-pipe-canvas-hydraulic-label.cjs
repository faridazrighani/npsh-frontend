#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-pipe-canvas-hydraulic-label-runtime.js");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const UPLOAD_READINESS_FILE = path.join(FRONTEND_ROOT, "UPLOAD_READINESS.md");
const CACHE_KEY = "engineering-pipe-canvas-hydraulic-label-runtime-20260707-pfv-loss-summary-clean1.js?v=20260707-pfv-loss-summary-clean1";
const VERSION = "2026.07-pipe-canvas-loss-summary-clean1";
const REMOVED_STATIC_PRESSURE_LABEL = "P stat.";
const REMOVED_SCOPE_LABEL = ["d", "P", " loss"].join("");
const REMOVED_FORMATTER_TOKEN = ["format", "Pressure", "Drop"].join("");
const REMOVED_TITLE_TOKEN = ["Positive", " pressure", " drop"].join("");
const TOTAL_K_KEY = "Total K";
const TOTAL_HL_KEY = "Total hL";
const MINOR_KEY = "Minor";
const MAJOR_KEY = "Major";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadRuntime(runtimeSource, model) {
  const sandbox = {
    console,
    globalModel: model,
    __npshGlobalModel: model,
    setTimeout: () => 1,
    clearTimeout: () => {},
    MutationObserver: class {
      observe() {}
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename: RUNTIME_FILE });
  return sandbox.EngineeringPipeCanvasHydraulicLabelRuntime;
}

const index = read(INDEX_FILE);
const runtime = read(RUNTIME_FILE);
const manifest = read(MANIFEST_FILE);
const uploadReadiness = read(UPLOAD_READINESS_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));

assert(index.includes(CACHE_KEY), "index.html must load the cache-busted pipe canvas hydraulic label runtime.");
assert(manifest.includes(CACHE_KEY), "FILE_MANIFEST.md must record the pipe canvas hydraulic label cache key.");
assert(uploadReadiness.includes("engineering-pipe-canvas-hydraulic-label-runtime.js"), "UPLOAD_READINESS.md must list the pipe canvas hydraulic label runtime.");
assert(
  packageJson.scripts?.["validate:pipe-canvas-hydraulic-label"] === "node tools/validate-pipe-canvas-hydraulic-label.cjs",
  "package.json must expose validate:pipe-canvas-hydraulic-label."
);
assert(runtime.includes(`const VERSION = "${VERSION}"`), "Runtime version must match the cache key.");
assert(runtime.includes("DISPLAY_DIGITS = 5"), "Runtime must lock pipe canvas label head/velocity numbers to 5 decimals.");
assert(runtime.includes("BLOCK_WIDTH = 178"), "Runtime must keep the canvas hydraulic label readable at pump-label font size.");
assert(runtime.includes("BLOCK_HEIGHT = 75"), "Runtime must keep the five-row canvas hydraulic label compact at pump-label font size.");
assert(runtime.includes("BLOCK_TOP = -83"), "Runtime must keep the five-row canvas hydraulic label anchored near the pipe without extra blank space.");
assert(runtime.includes("ROW_TOP = -68"), "Runtime must align the five loss-summary rows inside the compact label.");
assert(runtime.includes("ROW_GAP = 12.5"), "Runtime must keep readable row spacing at pump-label font size.");
assert(runtime.includes("font-size: 10px"), "Runtime must keep pipe label text aligned with pump label size.");
assert(runtime.includes("var(--font-main"), "Runtime must use the same font family source as pump object labels.");
assert(runtime.includes(".pipe-delta-label:not(.pipe-hydraulic-label)"), "Runtime must suppress the legacy delta-P label before replacement.");
assert(!runtime.includes('class: "pipe-delta-label-text pipe-hydraulic-label-value"'), "Runtime must not render legacy delta-P text classes in the replacement label.");
assert(!runtime.includes(`"${REMOVED_STATIC_PRESSURE_LABEL}"`), "Runtime must not render the P stat. canvas row; pressure stays in Pipe Formula Defense.");
assert(!runtime.includes("Static endpoint pressure including elevation head"), "Runtime title must not keep removed P stat. tooltip text.");
assert(!runtime.includes("Static endpoint P"), "Runtime SVG title must not expose removed P stat. pressure text.");
assert(!runtime.includes(`"${REMOVED_SCOPE_LABEL}"`), "Runtime must not render the removed pressure-loss canvas row.");
assert(!runtime.includes(REMOVED_FORMATTER_TOKEN), "Runtime must not keep removed pressure-loss formatting logic.");
assert(!runtime.includes(REMOVED_TITLE_TOKEN), "Runtime must not keep removed pressure-loss tooltip/title text.");
assert(runtime.includes('"Total K"'), "Runtime must render total K with the requested full label.");
assert(runtime.includes('"Total hL"'), "Runtime must render total head loss with the requested full label.");
assert(runtime.includes('"Minor"'), "Runtime must render minor loss with the requested label.");
assert(runtime.includes('"Major"'), "Runtime must render major loss with the requested label.");
assert(runtime.includes("MutationObserver"), "Runtime must observe SVG label insertions.");
assert(runtime.includes("patchDrawConnections"), "Runtime must patch drawConnections refreshes.");
assert(runtime.includes("patchUpdateSimulation"), "Runtime must patch updateSimulation refreshes.");
assert(runtime.includes("SOLVER_REFRESH_HOOKS"), "Runtime must define solver refresh hooks for protected calculation repaint stability.");
assert(runtime.includes('"refreshBackendProtectedSimulationUi"'), "Runtime must refresh PFV labels after protected solver UI refresh.");
assert(runtime.includes('"refreshBackendProtectedRealtimeTaskWindows"'), "Runtime must refresh PFV labels after protected realtime refresh.");
assert(runtime.includes("queueSolverRefreshSweep"), "Runtime must sweep PFV labels after delayed solver repaints.");
assert(runtime.includes("runImmediateRefresh"), "Runtime must refresh PFV labels synchronously after canvas redraws.");
assert(runtime.includes("refreshAfterSolverMutation"), "Runtime must share the no-flicker solver refresh path.");
assert(runtime.includes("runImmediateRefresh({ force: true });"), "Runtime must avoid a setTimeout-only PFV label repaint after solver/canvas redraws.");
assert(runtime.includes("hasSiblingPipeLabel"), "Runtime must avoid restoring duplicate PFV labels after solver redraws.");
assert(runtime.includes("SOLVER_REFRESH_DEBOUNCE_MS = 220"), "Runtime must debounce solver-triggered PFV label refreshes.");
assert(!runtime.includes("[0, 80, 220, 650, 1200]"), "Runtime must not run the old multi-sweep PFV repaint schedule.");
assert(runtime.includes("CANVAS_INTERACTION_SETTLE_MS = 220"), "Runtime must defer PFV label repaint during active canvas drag interactions.");
assert(runtime.includes("installCanvasInteractionEvents"), "Runtime must observe canvas pointer/touch drag state.");
assert(runtime.includes("refreshDeferredByInteraction"), "Runtime must queue one trailing PFV label refresh after dragging settles.");
assert(runtime.includes("pipeHydraulicLabelRestored"), "Runtime must restore removed PFV labels during solver/input/drag busy windows.");
assert(runtime.includes("markPipeLabelBusy"), "Runtime must mark PFV labels busy before solver, input, and drag redraw paths.");
assert(runtime.includes("freezePipeLabelGeometry"), "Runtime must freeze PFV label transform during solver/input/drag busy windows.");
assert(runtime.includes("restorePipeLabelGeometry"), "Runtime must restore PFV label transform if the renderer rewrites it while busy.");
assert(runtime.includes("pipeHydraulicLabelGeometryRestored"), "Runtime must mark restored PFV label geometry for QA.");
assert(runtime.includes("pipeHydraulicLabelGeometryHeld"), "Runtime must hold geometry signatures until the busy window settles.");
assert(runtime.includes('attributeFilter: ["transform", "class"]'), "Runtime must watch PFV transform/class mutations without observing noisy global attributes.");
assert(runtime.includes("updateExistingLabelText"), "Runtime must update PFV label values in place instead of rebuilding every row.");
assert(runtime.includes("activeCanvasFastPreviewVersion"), "Runtime must detect active canvas fast-preview state.");
assert(runtime.includes("inheritCanvasFastPreviewStamp"), "Runtime must inherit canvas fast-preview stamps when PFV labels are rebuilt.");
assert(runtime.includes('group.setAttribute("data-canvas-fast-preview", version)'), "Runtime must stamp rebuilt SVG PFV labels for fast-preview readiness.");
assert(runtime.includes("pipeHydraulicLabelRenderedTransform"), "Runtime must track rendered transforms separately from source pipe geometry.");
assert(runtime.includes("initialRefreshDone"), "Runtime install loop must not refresh PFV labels on every retry tick.");
assert(runtime.includes('"npsh:linked-views-refreshed"'), "Runtime must refresh PFV labels after linked evidence refresh.");
assert(runtime.includes("uprightLabelTransform"), "Runtime must keep elbow pipe labels upright.");
assert(runtime.includes("placeLabelSmartly"), "Runtime must place PFV labels through the canonical canvas-anchor path.");
assert(runtime.includes("canonicalLabelPlacement"), "Runtime must keep PFV labels at the same canvas-relative placement on desktop and cellular viewports.");
assert(runtime.includes("const best = canonicalLabelPlacement(anchor);"), "Runtime must not let mobile viewport bounds choose a different PFV label placement.");
assert(!runtime.includes("const bounds = placementBounds();"), "Runtime must not score PFV label placement against the visible mobile viewport.");
assert(runtime.includes("sumCalculatedSegmentValue"), "Runtime must not coerce missing segment calculations to 0.000.");
assert(runtime.includes("aria-label"), "Runtime must expose a readable label title on the SVG group.");

const model = {
  "PIPE-1": {
    type: "pipe",
    name: "PIPE-1",
    props: {
      segments: [
        { diameter: 0.1, length: 10, fittingQuantity: 2, fittingK: 1.3, minorLoss: 2.0 }
      ]
    },
    results: {
      flow: 50,
      inletPressure: 5.2,
      outletPressure: 4.72,
      calculationTrace: {
        totals: {
          totalK: 4.6,
          majorLoss: 3.2,
          minorLoss: 1.6
        },
        segments: [
          { velocity: 2.8 }
        ]
      }
    }
  }
};

const api = loadRuntime(runtime, model);
assert(api?.version === VERSION, "Runtime API version must be exposed.");
assert(typeof api.runImmediateRefresh === "function", "Runtime API must expose the synchronous no-flicker refresh helper.");
assert(
  api.uprightLabelTransform("translate(118.5 92.25) rotate(-90.0)") === "translate(118.5 92.25)",
  "Runtime must strip rotation while preserving label anchor position."
);
assert(
  api.uprightLabelTransform("translate(118.5,92.25) rotate(90)") === "translate(118.5 92.25)",
  "Runtime must support comma-separated SVG translate transforms."
);
assert(api.parseLabelTransform("translate(118.5 92.25) rotate(-90)").angle === -90, "Runtime must parse source pipe angle.");
assert(api.smartLabelCandidates(90)[0].name === "right", "Vertical pipe labels should try side placement first.");
assert(api.smartLabelCandidates(0)[0].name === "above", "Horizontal pipe labels should try above placement first.");
assert(api.canonicalLabelPlacement({ x: 120, y: 80, angle: 0 }).transform === "translate(120.0 66.0)", "Horizontal PFV labels must keep the desktop above-pipe placement on cellular.");
assert(api.canonicalLabelPlacement({ x: 120, y: 80, angle: 90 }).transform === "translate(251.0 126.0)", "Vertical PFV labels must keep the desktop side placement on cellular.");
const label = api.buildPipeHydraulicLabelData("PIPE-1");
assert(label, "Runtime must build label data for a pipe.");
const values = Object.fromEntries(label.rows.map((row) => [row.key, row.value]));
assert(!Object.prototype.hasOwnProperty.call(values, REMOVED_STATIC_PRESSURE_LABEL), "PFV label data must not include P stat.; pressure belongs in Pipe Formula Defense.");
assert(!Object.prototype.hasOwnProperty.call(values, REMOVED_SCOPE_LABEL), "PFV label data must not include the removed pressure-loss canvas row.");
assert(values.v === "2.80000 m/s", "Velocity must be formatted with 5 decimals and m/s.");
assert(values[TOTAL_K_KEY] === "4.600", "Total K must be formatted with 3 decimals and no unit.");
assert(values[TOTAL_HL_KEY] === "4.80000 m", "Total hL must be formatted with 5 decimals and m.");
assert(values[MINOR_KEY] === "1.60000 m", "Minor loss must be formatted with 5 decimals and m.");
assert(values[MAJOR_KEY] === "3.20000 m", "Major loss must be formatted with 5 decimals and m.");

const emptyModel = {
  "PIPE-EMPTY": {
    type: "pipe",
    name: "PIPE-EMPTY",
    props: { segments: [] },
    results: {}
  }
};
const emptyApi = loadRuntime(runtime, emptyModel);
const emptyLabel = emptyApi.buildPipeHydraulicLabelData("PIPE-EMPTY");
const emptyValues = Object.fromEntries(emptyLabel.rows.map((row) => [row.key, row.value]));
assert(!Object.prototype.hasOwnProperty.call(emptyValues, REMOVED_SCOPE_LABEL), "Empty PFV label must not include the removed pressure-loss canvas row.");
assert(emptyValues[TOTAL_K_KEY] === "-", "Missing total K must stay blank instead of 0.00000.");
assert(emptyValues[TOTAL_HL_KEY] === "- m", "Missing total hL must stay blank instead of 0.00000 m.");
assert(emptyValues[MINOR_KEY] === "- m", "Missing minor loss must stay blank instead of 0.00000 m.");
assert(emptyValues[MAJOR_KEY] === "- m", "Missing major loss must stay blank instead of 0.00000 m.");

console.log("Pipe canvas hydraulic label validation passed.");
