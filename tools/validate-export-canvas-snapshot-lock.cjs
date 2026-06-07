#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const BUNDLE_FILE = path.join(FRONTEND_ROOT, "app.bundle.min.js");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");

const BENIGN_FALLBACK_WARNING = "Canvas DOM snapshot was rejected; using manual canvas renderer fallback.";
const SNAPSHOT_FAILURE_WARNING = "Canvas snapshot could not be captured for Excel export.";
const BUNDLE_CACHE_KEY = "app.bundle.min.js?v=20260608-placement-menu-lock2";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const bundle = read(BUNDLE_FILE);
const indexHtml = read(INDEX_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const manifest = read(MANIFEST_FILE);

assert(
  !bundle.includes(BENIGN_FALLBACK_WARNING),
  "Export canvas snapshot must not log a warning when the normal manual fallback path is used."
);
assert(
  bundle.includes(SNAPSHOT_FAILURE_WARNING),
  "Export canvas snapshot must still warn when every snapshot path really fails."
);
assert(
  bundle.includes('return{dataUrl:renderScenarioCanvasSnapshotFallback(e,t,a,n,i,{drawNativeImages:!0}),status:"captured-fallback"'),
  "Export canvas snapshot must use the manual renderer fallback as the stable capture path."
);
assert(
  indexHtml.includes(BUNDLE_CACHE_KEY),
  "index.html must load app.bundle.min.js with the export canvas snapshot lock cache key."
);
assert(
  packageJson.scripts?.["validate:export-canvas-snapshot-lock"] === "node tools/validate-export-canvas-snapshot-lock.cjs",
  "package.json must expose validate:export-canvas-snapshot-lock."
);
assert(
  manifest.includes("Export canvas snapshot validation: npm run validate:export-canvas-snapshot-lock"),
  "FILE_MANIFEST.md must document the export canvas snapshot validation."
);
assert(
  manifest.includes(`App bundle cache key: ${BUNDLE_CACHE_KEY}`),
  "FILE_MANIFEST.md must document the app bundle export snapshot cache key."
);

console.log("Export canvas snapshot lock validation passed.");
