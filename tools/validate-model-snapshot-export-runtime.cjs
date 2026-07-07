#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-model-snapshot-export-runtime.js");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const UPLOAD_READINESS_FILE = path.join(FRONTEND_ROOT, "UPLOAD_READINESS.md");

const CACHE_KEY = "engineering-model-snapshot-export-runtime.js?v=20260707-fluid-basis-workspace-snapshot11";
const APP_BUNDLE_KEY = "app.bundle.min.js?v=20260707-pipe-canvas-loss-label1";
const VERSION = "2026.07-fluid-basis-workspace-snapshot11";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function loadRuntime(runtimeSource, model, connections) {
  const originalCapture = () => ({ dataUrl: "original-canvas", status: "captured-original-canvas" });
  const sandbox = {
    console,
    __npshGlobalModel: model,
    __npshConnections: connections,
    captureScenarioCanvasSnapshot: originalCapture,
    setTimeout: () => 1,
    clearTimeout: () => {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename: RUNTIME_FILE });
  return { api: sandbox.EngineeringModelSnapshotExportRuntime, sandbox, originalCapture };
}

const runtime = read(RUNTIME_FILE);
const index = read(INDEX_FILE);
const manifest = read(MANIFEST_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const uploadReadiness = read(UPLOAD_READINESS_FILE);

assert(runtime.includes(`const VERSION = "${VERSION}"`), "runtime version must match the cache key.");
assert(runtime.includes("Fluid Basis Model Snapshot export capture guard"), "runtime purpose header is missing.");
assert(runtime.includes("captured-readable-model-snapshot"), "runtime must expose the new export capture status.");
assert(runtime.includes("captured-fluid-basis-workspace-crop"), "runtime must expose the Fluid Basis workspace crop status.");
assert(runtime.includes("Fluid Basis"), "runtime must render the Fluid Basis top band.");
assert(runtime.includes("Route"), "runtime must render the route breadcrumb.");
assert(runtime.includes("Total hL"), "runtime must render pipe hydraulic summary bubbles.");
assert(runtime.includes("formatFixedValue(titleData.totalHeadLoss"), "runtime must keep tiny pipe losses readable instead of scientific notation.");
assert(runtime.includes("compactMode(props.boundaryMode"), "runtime must shorten long boundary mode text in snapshot panels.");
assert(runtime.includes("options.useReadableSnapshot === true"), "runtime must keep readable snapshot replacement opt-in only.");
assert(runtime.includes("captureFluidBasisWorkspaceSnapshot"), "runtime must wrap the native canvas snapshot with the Fluid Basis dock crop.");
assert(runtime.includes("captureVisibleWorkspaceDomSnapshot"), "runtime must first capture the visible DOM workspace crop.");
assert(runtime.includes("captured-visible-workspace-dom-crop"), "runtime must expose the visible workspace crop status.");
assert(runtime.includes("visible-canvas-dom-crop"), "runtime metadata must identify the real visible canvas DOM crop.");
assert(runtime.includes("renderCanvasViewportToDataUrl"), "runtime must render the actual scrolled canvas viewport.");
assert(runtime.includes("visiblePipeParameterLabelInfo"), "runtime must detect whether the real canvas label is visible in the crop.");
assert(runtime.includes("resolveVisibleWorkspaceCropRect"), "runtime must crop the visible workspace to the model content bounds.");
assert(runtime.includes("visibleWorkspaceCropCandidates"), "runtime must derive crop height from Fluid Basis, model objects, panels, SVG pipes, and pipe labels.");
assert(runtime.includes(".pump-live-params:not([hidden])"), "runtime must include the real pump live parameter panel in the crop bounds.");
assert(runtime.includes(".source-live-params:not([hidden])"), "runtime must include the real source live parameter panel in the crop bounds.");
assert(runtime.includes(".sink-live-params:not([hidden])"), "runtime must include the real sink live parameter panel in the crop bounds.");
assert(runtime.includes("contentCropPaddingBottom"), "runtime must keep a small professional bottom margin below the lowest visible model panel.");
assert(runtime.includes("contentCropPaddingRight"), "runtime must keep a compact right margin instead of exporting blank grid.");
assert(runtime.includes("contentRight: crop.cropRect.right"), "runtime metadata must record the right content bound used for crop width.");
assert(runtime.includes("excludeFluidBasisDock"), "runtime must remove the Fluid Basis dock from the main canvas clone.");
assert(runtime.includes("dockCompositedSeparately"), "runtime must composite the Fluid Basis dock as a separate layer to avoid full-canvas foreignObject artifacts.");
assert(runtime.includes("drawCompactFluidBasisDock"), "runtime must render the Fluid Basis dock with a deterministic compact canvas renderer.");
assert(runtime.includes("manual-fluid-basis-dock"), "runtime metadata must identify the manual Fluid Basis dock renderer.");
assert(runtime.includes("resolvePipeCaptionDataList"), "runtime must support suction and discharge pipe caption fallback overlays.");
assert(runtime.includes("pipeCaptionXs"), "runtime must place fallback pipe captions below the dock in pipe positions.");
assert(runtime.includes("pipeCaptionBoxes"), "runtime metadata must expose every fallback pipe caption box.");
assert(runtime.includes("cropSource: crop.cropRect.source"), "runtime metadata must record whether crop height came from content bounds.");
assert(runtime.includes("captureFluidBasisDockImage"), "runtime must capture the visible Fluid Basis dock.");
assert(runtime.includes("refreshPipeCanvasHydraulicLabels"), "runtime must refresh PFV canvas labels before snapshot capture.");
assert(runtime.includes("preparePipeParameterLabelsForSnapshot"), "runtime must prepare pipe parameter labels before native canvas capture.");
assert(runtime.includes("runImmediateRefresh?.({ force: true })"), "runtime must force the PFV label runtime before snapshot capture.");
assert(runtime.includes("resolvePipeCaptionData"), "runtime must resolve a final pipe parameter caption from the current model.");
assert(runtime.includes("drawPipeParameterCaption"), "runtime must draw the pipe parameter caption onto the final PDF snapshot crop.");
assert(runtime.includes("pipeCaptionOverlay"), "runtime metadata must prove the final pipe parameter overlay was drawn.");
assert(runtime.includes("buildPipeHydraulicLabelData"), "runtime must prefer the canonical PFV label data builder.");
assert(runtime.includes("calculation-trace"), "runtime must fall back to calculation trace values when the SVG label is absent.");
const workspaceCaptureIndex = runtime.indexOf("async function captureFluidBasisWorkspaceSnapshot");
const workspaceCaptureBody = runtime.slice(workspaceCaptureIndex, runtime.indexOf("function install", workspaceCaptureIndex));
assert(
  workspaceCaptureIndex >= 0
    && workspaceCaptureBody.indexOf("await preparePipeParameterLabelsForSnapshot()") >= 0
    && workspaceCaptureBody.indexOf("await preparePipeParameterLabelsForSnapshot()") < workspaceCaptureBody.indexOf("originalCapture.call(root, options)"),
  "PFV parameter labels must be refreshed before the native canvas snapshot is captured."
);
assert(
  workspaceCaptureIndex >= 0
    && workspaceCaptureBody.indexOf("captureVisibleWorkspaceDomSnapshot(options)") >= 0
    && workspaceCaptureBody.indexOf("captureVisibleWorkspaceDomSnapshot(options)") < workspaceCaptureBody.indexOf("originalCapture.call(root, options)"),
  "PDF Model Snapshot must attempt the real visible DOM crop before native canvas fallback."
);
assert(runtime.includes("fluid-basis-dock-plus-native-canvas"), "runtime metadata must identify the dock plus native canvas crop.");
assert(runtime.includes("drawCompositeWorkspaceGrid"), "runtime must keep the Fluid Basis-to-canvas crop on the same workspace grid background.");
assert(runtime.includes("workspaceTopPadding"), "runtime must reserve canvas-grid space below the Fluid Basis dock before pipe parameters.");
assert(runtime.includes("__npshFluidBasisWorkspaceSnapshotInstalled"), "runtime must mark Fluid Basis workspace snapshot as the default PDF path.");
assert(runtime.includes("captureScenarioReadableModelSnapshot"), "runtime must retain an explicit readable snapshot API.");
assert(runtime.includes("captureScenarioFluidBasisWorkspaceSnapshot"), "runtime must retain an explicit Fluid Basis workspace snapshot API.");
assert(runtime.includes("fluid-basis-route-diagram"), "runtime metadata must identify the readable diagram snapshot.");
assert(runtime.includes("collectScenarioExportData"), "runtime must prefer the bundle export data collector when available.");
assert(runtime.includes("pipeIdFromSourceData(sourceData"), "runtime must recover suction/discharge pipe IDs from collected export path state.");

assert(index.includes(CACHE_KEY), "index.html must load the original model snapshot capture guard runtime.");
assert(
  index.indexOf(CACHE_KEY) > index.indexOf(APP_BUNDLE_KEY),
  "model snapshot runtime must load after app.bundle.min.js so it can wrap the native export capture."
);

assert(manifest.includes("engineering-model-snapshot-export-runtime.js public-safe"), "manifest runtime inventory entry is missing.");
assert(manifest.includes(`Model snapshot export runtime cache key: ${CACHE_KEY}`), "manifest cache key is missing.");
assert(manifest.includes("Model snapshot export validation: npm run validate:model-snapshot-export"), "manifest validation command is missing.");
assert(uploadReadiness.includes("Fluid Basis workspace Model Snapshot export validation passed"), "upload readiness must record the snapshot export lock.");
assert(
  packageJson.scripts?.["validate:model-snapshot-export"] === "node tools/validate-model-snapshot-export-runtime.cjs",
  "package.json must expose validate:model-snapshot-export."
);

const model = {
  SETTINGS: { type: "settings", props: { unitStandard: "Metric / European Engineering" } },
  FLUID: {
    type: "fluid",
    props: {
      fluidName: "Water",
      temp: 25,
      density: 997.047,
      viscosity: 0.893,
      dynViscosity: 0.89,
      vaporPressure: 0.031698,
      vaporPressureHead: 0.324,
      specWeight: 9781.031
    }
  },
  "SRC-100": {
    type: "source",
    props: { flowInputMode: "Volumetric Flow", pressure: 1.013, elevation: 1 },
    results: { flow: 9.528, pressure: 1.013, calculationTrace: { boundary: { totalSourceHead: 11.359 } } }
  },
  "PIPE-1": {
    type: "pipe",
    results: {
      calculationTrace: {
        totals: { totalK: 2.095, totalLoss: 0.00086, minorLoss: 0.00072, majorLoss: 0.00014 },
        segments: [{ velocity: 0.08198 }]
      }
    }
  },
  "P-100": {
    type: "pump",
    results: {
      flow: 9.528,
      head: 0.021,
      suctionPressure: 1.111,
      dischargePressure: 1.113,
      npsha: 11.0342,
      npshr: 1,
      npshMargin: 10.0342,
      npshRatio: 11.0342,
      hydraulicNpshStatus: "Safe",
      backendValidationStatus: "Connected"
    }
  },
  "PIPE-2": {
    type: "pipe",
    results: {
      calculationTrace: {
        totals: { totalK: 11.061, totalLoss: 0.01868, minorLoss: 0.01136, majorLoss: 0.00732 },
        segments: [{ velocity: 0.14194 }]
      }
    }
  },
  "SNK-100": {
    type: "sink",
    props: { boundaryMode: "Flow Demand Boundary", pressure: 1.013, elevation: 1, demandFlow: 9.528 },
    results: { flow: 9.528, boundaryPressure: 1.013, requiredBoundaryHead: 11.36 }
  }
};

const connections = [
  { from: "SRC-100", to: "P-100", pipeId: "PIPE-1", connectionType: "hydraulic" },
  { from: "P-100", to: "SNK-100", pipeId: "PIPE-2", connectionType: "hydraulic" }
];

const { api, sandbox, originalCapture } = loadRuntime(runtime, model, connections);
assert.equal(api.version, VERSION, "runtime API must expose the version.");
assert.equal(typeof api.captureFluidBasisWorkspaceSnapshot, "function", "runtime API must expose captureFluidBasisWorkspaceSnapshot.");
assert.equal(typeof api.captureVisibleWorkspaceDomSnapshot, "function", "runtime API must expose captureVisibleWorkspaceDomSnapshot.");
assert.equal(typeof api.visiblePipeParameterLabelInfo, "function", "runtime API must expose visible label detection for smoke validation.");
assert.equal(typeof api.resolveVisibleWorkspaceCropRect, "function", "runtime API must expose visible workspace crop bounds for smoke validation.");
assert.equal(typeof api.captureReadableModelSnapshot, "function", "runtime API must expose captureReadableModelSnapshot.");
assert.equal(typeof api.resolvePipeCaptionData, "function", "runtime API must expose pipe caption data resolution for smoke validation.");
const captionData = api.resolvePipeCaptionData();
assert.equal(captionData.pipeId, "PIPE-1", "pipe caption must default to the active suction pipe.");
assert.equal(
  JSON.stringify(captionData.rows.map((row) => row.key)),
  JSON.stringify(["v", "Total K", "Total hL", "Minor", "Major"]),
  "pipe caption must use the compact PFV parameter rows requested for the PDF snapshot."
);
assert.equal(captionData.rows[2].value, "0.00086 m", "pipe caption must include the live Total hL value.");
assert.equal(sandbox.captureScenarioCanvasSnapshot, api.captureFluidBasisWorkspaceSnapshot, "PDF Model Snapshot must default to Fluid Basis workspace crop capture.");
assert.equal(typeof sandbox.captureScenarioFluidBasisWorkspaceSnapshot, "function", "Fluid Basis workspace snapshot must remain available as an explicit API.");
assert.equal(typeof sandbox.captureScenarioReadableModelSnapshot, "function", "readable snapshot must remain available as an explicit API.");
api.install({ useReadableSnapshot: true });
assert.equal(sandbox.captureScenarioCanvasSnapshot, api.captureReadableModelSnapshot, "readable replacement must be available only when explicitly requested.");
api.install();
assert.equal(sandbox.captureScenarioCanvasSnapshot, api.captureFluidBasisWorkspaceSnapshot, "default install must restore Fluid Basis workspace crop capture.");
const snapshot = api.buildSnapshotData();
assert.equal(
  JSON.stringify(snapshot.routeLabels),
  JSON.stringify(["FB", "SRC-100", "PIPE-1", "P-100", "PIPE-2", "SNK-100"]),
  "snapshot route breadcrumb must be digestible."
);
assert.equal(snapshot.fluid.title, "Water", "snapshot must include active fluid basis.");
assert.equal(snapshot.pump.hydraulicStatus, "Safe", "snapshot must include pump hydraulic status.");
assert.equal(snapshot.pump.backendStatus, "Connected", "snapshot must include backend validity.");
assert.equal(snapshot.suctionPipe.totalK, 2.095, "snapshot must include suction pipe total K.");
assert.equal(snapshot.dischargePipe.majorLoss, 0.00732, "snapshot must include discharge pipe major loss.");
const sourceDataSnapshot = api.buildSnapshotData({
  sourceData: {
    model,
    primary: {
      sourceId: "SRC-100",
      pumpId: "P-100",
      sinkId: "SNK-100",
      state: {
        suctionPath: { steps: [{ pipeId: "PIPE-1" }] },
        dischargePath: { steps: [{ pipeId: "PIPE-2" }] }
      }
    }
  },
  connections: []
});
assert.equal(sourceDataSnapshot.route.suctionPipeId, "PIPE-1", "snapshot must recover suction pipe from export source data.");
assert.equal(sourceDataSnapshot.route.dischargePipeId, "PIPE-2", "snapshot must recover discharge pipe from export source data.");
assert.equal(api.statusTone("NPSH Risk"), "risk", "status tone must identify NPSH risk.");
assert.equal(api.statusTone("Safe"), "safe", "status tone must identify safe state.");

console.log("Fluid Basis workspace Model Snapshot export validation passed.");
