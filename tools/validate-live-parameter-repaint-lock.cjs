#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const LOCK_FILE = path.join(FRONTEND_ROOT, "engineering-live-parameter-repaint-lock.css");
const STYLE_FILE = path.join(FRONTEND_ROOT, "style.min.css");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const UPLOAD_READINESS_FILE = path.join(FRONTEND_ROOT, "UPLOAD_READINESS.md");

const LOCK_CACHE_KEY = "engineering-live-parameter-repaint-lock.css?v=20260620-render-blocking-fix1";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function cssBlock(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "m"));
  assert(match, `Missing CSS block for ${selector}.`);
  return match[1];
}

function cssBlockPattern(css, pattern, label) {
  const match = css.match(pattern);
  assert(match, `Missing CSS block for ${label}.`);
  return match[1];
}

function assertDeclaration(block, declaration, context) {
  assert(block.includes(declaration), `${context} must include "${declaration}".`);
}

const lockCss = read(LOCK_FILE);
const styleCss = read(STYLE_FILE);
const indexHtml = read(INDEX_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const manifest = read(MANIFEST_FILE);
const uploadReadiness = read(UPLOAD_READINESS_FILE);

assert(indexHtml.includes(LOCK_CACHE_KEY), "index.html must load the live parameter repaint-lock CSS with the locked cache key.");
assert(
  !indexHtml.includes('<link rel="stylesheet" href="engineering-live-parameter-repaint-lock.css'),
  "Live parameter repaint-lock CSS must not appear as an initial HTML stylesheet."
);
assert(
  indexHtml.includes(`const LIVE_PARAMETER_REPAINT_LOCK_HREF = '${LOCK_CACHE_KEY}';`),
  "index.html must defer the live parameter repaint-lock CSS through the stylesheet loader."
);
assert(
  indexHtml.includes("loadStylesheet('npsh-main-style', MAIN_STYLE_HREF)") &&
    indexHtml.includes("loadStylesheet('npsh-live-parameter-repaint-lock-style', LIVE_PARAMETER_REPAINT_LOCK_HREF)"),
  "Deferred stylesheet loader must load main CSS before the live parameter repaint-lock override."
);
assert(
  indexHtml.indexOf("loadStylesheet('npsh-main-style', MAIN_STYLE_HREF)") <
    indexHtml.indexOf("loadStylesheet('npsh-live-parameter-repaint-lock-style', LIVE_PARAMETER_REPAINT_LOCK_HREF)"),
  "Live parameter repaint-lock override must be appended after the main stylesheet."
);
assert(
  indexHtml.includes("const ensureMainStyles = () => mainStylePromise") &&
    indexHtml.includes("const ensureStyles = () => stylePromise || (stylePromise = ensureMainStyles()"),
  "Main stylesheet and live repaint-lock stylesheet must have separate loading gates."
);
assert(
  indexHtml.includes("startInitialShellLoad") &&
    indexHtml.includes("loadShell().catch(error => console.warn('Deferred app shell did not load.', error));"),
  "Passive initial shell load must still schedule the app shell."
);
assert(
  !/startInitialShellLoad\s*=\s*\(\)\s*=>\s*\{[\s\S]*?ensureMainStyles\(\)/.test(indexHtml),
  "Passive initial shell load must not request the full main stylesheet before LCP."
);
assert(manifest.includes(LOCK_CACHE_KEY), "FILE_MANIFEST.md must record the repaint-lock cache key.");
assert(uploadReadiness.includes("engineering-live-parameter-repaint-lock.css"), "UPLOAD_READINESS.md must list the repaint-lock CSS as a required public asset.");
assert(
  packageJson.scripts?.["validate:live-parameter-repaint-lock"] === "node tools/validate-live-parameter-repaint-lock.cjs",
  "package.json must expose validate:live-parameter-repaint-lock."
);

assert(!/rgba\(/i.test(lockCss), "Repaint-lock CSS must use opaque backgrounds; rgba backgrounds can reveal grid repaint.");

const livePanelBlock = cssBlockPattern(
  lockCss,
  /\.pump-live-params,\s*\.tank-live-params,\s*\.source-live-params,\s*\.sink-live-params\s*\{([^}]*)\}/m,
  "live parameter cards"
);
assertDeclaration(livePanelBlock, "box-shadow: none !important;", "live parameter cards");
assertDeclaration(livePanelBlock, "filter: none !important;", "live parameter cards");
assertDeclaration(livePanelBlock, "overflow: hidden !important;", "live parameter cards");
assertDeclaration(livePanelBlock, "contain: layout paint !important;", "live parameter cards");
assertDeclaration(livePanelBlock, "isolation: isolate !important;", "live parameter cards");
assertDeclaration(livePanelBlock, "clip-path: inset(0 round 6px);", "live parameter cards");
assertDeclaration(livePanelBlock, "background: #ffffff !important;", "live parameter cards");

const pumpPanelBlock = cssBlock(lockCss, ".pump-live-params");
assertDeclaration(pumpPanelBlock, "min-height: 173px !important;", "pump live parameter card");
assertDeclaration(pumpPanelBlock, "transition: none !important;", "pump live parameter card");
assertDeclaration(pumpPanelBlock, "transform: translate3d(-50%, 0, 0) !important;", "pump live parameter card");

const badgeBlock = cssBlock(lockCss, ".pump-status-badge");
assertDeclaration(badgeBlock, "box-shadow: none !important;", "pump status badge");
assertDeclaration(badgeBlock, "filter: none !important;", "pump status badge");

const selectedPumpIconBlock = cssBlock(lockCss, ".pfd-object.object-type-pump.selected .object-icon");
assertDeclaration(selectedPumpIconBlock, "filter: none !important;", "selected pump icon");

const pumpStatusOutlines = [
  [".object-type-pump.pump-status-safe .object-icon", "background: #f0fdf4 !important;", "box-shadow: 0 0 0 2px #16a34a !important;"],
  [".object-type-pump.pump-status-warning .object-icon", "background: #fff7ed !important;", "box-shadow: 0 0 0 2px #f97316 !important;"],
  [".object-type-pump.pump-status-risk .object-icon", "background: #fef2f2 !important;", "box-shadow: 0 0 0 2px #dc2626 !important;"],
  [".object-type-pump.pump-status-incomplete .object-icon", "background: #f8fafc !important;", "box-shadow: 0 0 0 2px #94a3b8 !important;"],
];

for (const [selector, background, boxShadow] of pumpStatusOutlines) {
  const block = cssBlock(lockCss, selector);
  assertDeclaration(block, background, selector);
  assertDeclaration(block, boxShadow, selector);
}

assert(
  /\.pump-live-params,\s*\.tank-live-params,\s*\.source-live-params,\s*\.sink-live-params\{[^}]*box-shadow:none;/m.test(styleCss),
  "style.min.css base live parameter cards must keep box-shadow:none."
);
assert(
  /\.pump-live-params\{[^}]*min-height:173px;[^}]*transition:none/m.test(styleCss),
  "style.min.css pump live parameter card must keep the solved-state min-height and transition lock."
);

console.log("Live parameter repaint-lock validation passed.");
