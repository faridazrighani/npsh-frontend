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

const cacheKey = "engineering-canvas-clear-reset-guard.js?v=20260709-clear-canvas-browser-reload1";
const dockCacheKey = "engineering-canvas-context-dock-20260628-canvas-dock-scroll-anchor1.js?v=20260707-clear-keeps-fluid-basis1";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const indexHtml = read(indexPath);
const manifest = read(manifestPath);
const guard = read(guardPath);
const stableRuntime = read(stableRuntimePath);
const contextDock = read(contextDockPath);
const packageJson = JSON.parse(read(packagePath));
const removableSelectorBlock = guard.match(/const REMOVABLE_CANVAS_SELECTORS = \[[\s\S]*?\];/)?.[0] || "";

assert.ok(indexHtml.includes(cacheKey), "index.html must load the canvas clear/reset guard with the locked cache key.");
assert.ok(indexHtml.includes(dockCacheKey), "index.html must load the canvas context dock with the clear-safe cache key.");
assert.ok(
  indexHtml.indexOf("engineering-live-parameter-stable-runtime-20260628-global-stable-values3.js") <
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
  "CanvasContextDock",
  "pipe-hydraulic-label",
  "pipe-delta-label",
  "scheduleRepeatedCleanup",
  "CLEAN_RELOAD_MENU_IDS",
  "handleCleanReloadMenuClick",
  "requestCleanWorkspaceReload",
  "__npshCleanWorkspaceReload",
  'documentRef.addEventListener("click", handleCleanReloadMenuClick, true)',
  "root.location?.reload?.()",
  "stopImmediatePropagation"
].forEach((token) => {
  assert.ok(guard.includes(token), `Canvas clear/reset guard must include ${token}.`);
});

assert.ok(
  guard.includes('const CACHE_KEY = "20260709-clear-canvas-browser-reload1"'),
  "Canvas clear/reset guard must expose the clean workspace reload cache key."
);
assert.ok(
  guard.includes('"menu-clear-file"') && guard.includes('"menu-clear"'),
  "Canvas clear/reset guard must bind both File and Edit Clear Canvas commands."
);

assert.ok(
  !removableSelectorBlock.includes("canvasContextDock") &&
    !removableSelectorBlock.includes("canvas-context-dock"),
  "Canvas clear/reset guard must never remove the Fluid Basis context dock."
);
assert.ok(
  guard.includes("refreshDock: true"),
  "Canvas clear/reset guard must refresh the Fluid Basis context dock after clearing transient artifacts."
);

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
    contextDock.includes("hasCanvasEquipment") &&
    contextDock.includes("return false;"),
  "Canvas context dock must keep Fluid Basis visible after an empty clear."
);
assert.ok(
  !contextDock.includes("documentRef.getElementById(DOCK_ID)?.remove()"),
  "Canvas context dock must not remove itself after Clear Canvas."
);

console.log("Canvas clear/reset guard validation passed.");
