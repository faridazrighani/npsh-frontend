#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const rootDir = path.resolve(__dirname, "..");
const indexPath = path.join(rootDir, "index.html");
const manifestPath = path.join(rootDir, "FILE_MANIFEST.md");
const packagePath = path.join(rootDir, "package.json");
const guardPath = path.join(rootDir, "engineering-canvas-clear-reset-guard.js");
const stableRuntimePath = path.join(rootDir, "engineering-live-parameter-stable-runtime-20260628-global-stable-values3.js");
const contextDockPath = path.join(rootDir, "engineering-canvas-context-dock-20260628-canvas-dock-scroll-anchor1.js");

const cacheKey = "engineering-canvas-clear-reset-guard.js?v=20260629-canvas-clear-reset1";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const indexHtml = read(indexPath);
const manifest = read(manifestPath);
const guard = read(guardPath);
const stableRuntime = read(stableRuntimePath);
const contextDock = read(contextDockPath);
const packageJson = JSON.parse(read(packagePath));

assert.ok(indexHtml.includes(cacheKey), "index.html must load the canvas clear/reset guard with the locked cache key.");
assert.ok(
  indexHtml.indexOf("engineering-live-parameter-stable-runtime-20260628-global-stable-values3.js?v=20260701-object-card-stability1") <
    indexHtml.indexOf(cacheKey),
  "Canvas clear/reset guard must load after the live parameter stable runtime."
);
assert.ok(manifest.includes(cacheKey), "FILE_MANIFEST.md must record the canvas clear/reset guard cache key.");
assert.equal(
  packageJson.scripts?.["validate:canvas-clear-reset-guard"],
  "node tools/validate-canvas-clear-reset-guard.cjs",
  "package.json must expose validate:canvas-clear-reset-guard."
);

[
  "__npshCanvasClearInProgress",
  "__npshCanvasClearEmpty",
  "clearSimulationCanvas",
  "resetCanvasViewFromMenu",
  "clearTransientCanvasArtifacts",
  "resetCanvasView",
  "EngineeringLiveParameterStableRuntime",
  "clearTrackedPanels",
  "canvasWarningPanel",
  "canvasWarningCount",
  "canvasConnectHint",
  "svg-lines",
  "canvasContextDock",
  "pipe-hydraulic-label",
  "pipe-delta-label",
  "scheduleRepeatedCleanup"
].forEach((token) => {
  assert.ok(guard.includes(token), `Canvas clear/reset guard must include ${token}.`);
});

assert.ok(
  stableRuntime.includes("__npshCanvasClearInProgress") &&
    stableRuntime.includes("clearTrackedPanels") &&
    stableRuntime.includes("restoreRemovedPanel") &&
    stableRuntime.includes("captureRemovedPanel") &&
    stableRuntime.includes("reconcilePanels"),
  "Live parameter stable runtime must support clear-in-progress suppression and explicit panel cleanup."
);

assert.ok(
  contextDock.includes("__npshCanvasClearEmpty") &&
    contextDock.includes("isSuppressedAfterClear") &&
    contextDock.includes("hasCanvasEquipment"),
  "Canvas context dock must suppress Fluid Basis dock after an empty clear until equipment exists."
);

console.log("Canvas clear/reset guard validation passed.");
