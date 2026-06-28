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
const CACHE_KEY = "engineering-pipe-canvas-hydraulic-label-runtime-20260628-pfv-canvas-anchor1.js?v=20260628-pfv-canvas-anchor1";
const VERSION = "2026.06-pipe-canvas-hydraulic-label12";
const P_PAIR_KEY = "P\u2081\u2192P\u2082";
const SIGMA_K_KEY = "\u03a3K";

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
assert(runtime.includes("DISPLAY_DIGITS = 3"), "Runtime must lock pipe canvas label numbers to 3 decimals.");
assert(runtime.includes("BLOCK_WIDTH = 178"), "Runtime must keep the canvas hydraulic label readable at pump-label font size.");
assert(runtime.includes("BLOCK_HEIGHT = 76"), "Runtime must keep the canvas hydraulic label readable at pump-label font size.");
assert(runtime.includes("ROW_GAP = 12.5"), "Runtime must keep readable row spacing at pump-label font size.");
assert(runtime.includes("font-size: 10px"), "Runtime must keep pipe label text aligned with pump label size.");
assert(runtime.includes("var(--font-main"), "Runtime must use the same font family source as pump object labels.");
assert(runtime.includes(".pipe-delta-label:not(.pipe-hydraulic-label)"), "Runtime must suppress the legacy delta-P label before replacement.");
assert(!runtime.includes('class: "pipe-delta-label-text pipe-hydraulic-label-value"'), "Runtime must not render legacy delta-P text classes in the replacement label.");
assert(runtime.includes("P\\u2081\\u2192P\\u2082"), "Runtime must render P1-to-P2 with symbolic label.");
assert(runtime.includes("\\u03a3K"), "Runtime must render total K with sigma symbol.");
assert(runtime.includes("h_f"), "Runtime must render major loss as h_f.");
assert(runtime.includes("h_m"), "Runtime must render minor loss as h_m.");
assert(runtime.includes("MutationObserver"), "Runtime must observe SVG label insertions.");
assert(runtime.includes("patchDrawConnections"), "Runtime must patch drawConnections refreshes.");
assert(runtime.includes("patchUpdateSimulation"), "Runtime must patch updateSimulation refreshes.");
assert(runtime.includes("SOLVER_REFRESH_HOOKS"), "Runtime must define solver refresh hooks for protected calculation repaint stability.");
assert(runtime.includes('"refreshBackendProtectedSimulationUi"'), "Runtime must refresh PFV labels after protected solver UI refresh.");
assert(runtime.includes('"refreshBackendProtectedRealtimeTaskWindows"'), "Runtime must refresh PFV labels after protected realtime refresh.");
assert(runtime.includes("queueSolverRefreshSweep"), "Runtime must sweep PFV labels after delayed solver repaints.");
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
assert(values[P_PAIR_KEY] === "5.200 \u2192 4.720 bar", "Pressure pair must be formatted with 3 decimals and bar.");
assert(values.v === "2.800 m/s", "Velocity must be formatted with 3 decimals and m/s.");
assert(values[SIGMA_K_KEY] === "4.600", "Total K must be formatted with 3 decimals and no unit.");
assert(values.h_f === "3.200 m", "Major loss must be formatted with 3 decimals and m.");
assert(values.h_m === "1.600 m", "Minor loss must be formatted with 3 decimals and m.");

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
assert(emptyValues[SIGMA_K_KEY] === "-", "Missing total K must stay blank instead of 0.000.");
assert(emptyValues.h_f === "- m", "Missing major loss must stay blank instead of 0.000 m.");
assert(emptyValues.h_m === "- m", "Missing minor loss must stay blank instead of 0.000 m.");

console.log("Pipe canvas hydraulic label validation passed.");
