#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const LOCK_FILE = path.join(FRONTEND_ROOT, "engineering-live-parameter-repaint-lock.css");
const STABLE_RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-live-parameter-stable-runtime.js");
const STYLE_FILE = path.join(FRONTEND_ROOT, "style.min.css");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const UPLOAD_READINESS_FILE = path.join(FRONTEND_ROOT, "UPLOAD_READINESS.md");

const LOCK_CACHE_KEY = "engineering-live-parameter-repaint-lock.css?v=20260702-object-status-clean1";
const STABLE_RUNTIME_CACHE_KEY = "engineering-live-parameter-stable-runtime-20260628-global-stable-values3.js?v=20260706-fast-preview-preserve1";

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

function cssBlocks(css, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(css.matchAll(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "gm"))).map((match) => match[1]);
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
const stableRuntime = read(STABLE_RUNTIME_FILE);
const styleCss = read(STYLE_FILE);
const indexHtml = read(INDEX_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const manifest = read(MANIFEST_FILE);
const uploadReadiness = read(UPLOAD_READINESS_FILE);

assert(indexHtml.includes(LOCK_CACHE_KEY), "index.html must load the live parameter repaint-lock CSS with the locked cache key.");
assert(indexHtml.includes(STABLE_RUNTIME_CACHE_KEY), "index.html must load the global live parameter stable runtime.");
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
    /loadShell\(\)\s*\.then\(scheduleInitialCanvasHydration\)\s*\.catch\(error => console\.warn\('Deferred app shell did not load\.', error\)\);/.test(indexHtml),
  "Passive initial shell load must still schedule the app shell and then hydrate canvas runtimes without a click."
);
assert(
  indexHtml.includes("const scheduleInitialCanvasHydration = () => {") &&
    indexHtml.includes("ensureStyles().catch(error => console.warn('Initial canvas stylesheet hydration did not load.', error));") &&
    indexHtml.includes("const initialCanvasHydrationScripts = [") &&
    indexHtml.includes("loadScripts(initialCanvasHydrationScripts)") &&
    indexHtml.includes("window.__npshInitialCanvasHydrationComplete = true"),
  "Initial canvas hydration must load styles and visual canvas runtimes without waiting for pointer/key input."
);
assert(manifest.includes(LOCK_CACHE_KEY), "FILE_MANIFEST.md must record the repaint-lock cache key.");
assert(manifest.includes(STABLE_RUNTIME_CACHE_KEY), "FILE_MANIFEST.md must record the stable live parameter runtime cache key.");
assert(uploadReadiness.includes("engineering-live-parameter-repaint-lock.css"), "UPLOAD_READINESS.md must list the repaint-lock CSS as a required public asset.");
assert(uploadReadiness.includes("engineering-live-parameter-stable-runtime.js"), "UPLOAD_READINESS.md must list the stable live parameter runtime as a required public asset.");
assert(
  packageJson.scripts?.["validate:live-parameter-repaint-lock"] === "node tools/validate-live-parameter-repaint-lock.cjs",
  "package.json must expose validate:live-parameter-repaint-lock."
);

assert(!/rgba\(/i.test(lockCss), "Repaint-lock CSS must use opaque backgrounds; rgba backgrounds can reveal grid repaint.");
assert(stableRuntime.includes('const VERSION = "2026.07-live-parameter-stable7"'), "Stable runtime must keep the global live parameter value-update version.");
assert(stableRuntime.includes("syncMatchingRows"), "Stable runtime must update matching row values in place.");
assert(stableRuntime.includes("stabilizePanelFromReplacement"), "Stable runtime must preserve panel shells when the app renderer supplies replacements.");
assert(stableRuntime.includes("shouldAllowStructureReplacement"), "Stable runtime must still allow intentional row-structure changes outside solve/drag lifecycle.");
assert(stableRuntime.includes("detachedPanels"), "Stable runtime must bridge remove/add replacement cycles.");
assert(stableRuntime.includes("restoreRemovedPanel"), "Stable runtime must immediately reinsert removed panels during solve/input/drag busy windows.");
assert(stableRuntime.includes("liveParameterStableRestored"), "Stable runtime must mark restored panels for QA.");
assert(stableRuntime.includes("freezeAllPanelGeometry"), "Stable runtime must freeze live panel geometry during input, drag, and solver busy windows.");
assert(stableRuntime.includes("restorePanelGeometry"), "Stable runtime must restore live panel geometry when renderers rewrite style/class attributes.");
assert(stableRuntime.includes("liveParameterStableGeometryRestored"), "Stable runtime must mark geometry restoration for QA.");
assert(stableRuntime.includes("frozenPanelNodes"), "Stable runtime must snapshot pump/SNK row structure during solve and drag busy windows.");
assert(stableRuntime.includes("restoreMissingPanelNodes"), "Stable runtime must restore status and canonical rows removed by transient renderer passes.");
assert(stableRuntime.includes("liveParameterStableNodesRestored"), "Stable runtime must mark restored row nodes for QA.");
assert(stableRuntime.includes("PUMP_PROTECTED_SECTIONS"), "Stable runtime must restore only protected pump sections, not hidden route/audit rows.");
assert(stableRuntime.includes("PUMP_PROTECTED_ROWS"), "Stable runtime must restore only protected pump canvas rows.");
assert(!stableRuntime.includes('"Pump Head"'), "Stable runtime must not restore the removed manufacturer Pump Head row.");
assert(stableRuntime.includes("SINK_PROTECTED_ROWS"), "Stable runtime must restore only protected sink canvas rows.");
assert(stableRuntime.includes("shouldSnapshotPanelNode"), "Stable runtime must filter row snapshots before restoring missing panel nodes.");
assert(stableRuntime.includes("stableSectionLabel"), "Stable runtime must normalize section labels with info-icon text before comparing snapshots.");
assert(stableRuntime.includes('text.startsWith("STATUS")'), "Stable runtime must treat STATUS and STATUS info-icon variants as the same section.");
assert(stableRuntime.includes("captureCanvasViewport"), "Stable runtime must capture canvas scroll position during solver/input busy windows.");
assert(stableRuntime.includes("restoreCanvasViewport"), "Stable runtime must restore canvas scroll position after solver/input busy windows.");
assert(stableRuntime.includes("liveParameterStableViewport"), "Stable runtime must tag viewport capture for QA.");
assert(stableRuntime.includes("liveParameterStableViewportRestored"), "Stable runtime must tag viewport restoration for QA.");
assert(stableRuntime.includes("pendingPanelAttributes"), "Stable runtime must defer visual shell attributes while busy so only values change live.");
assert(stableRuntime.includes("liveParameterStableAttributesFlushed"), "Stable runtime must apply pending shell attributes once after the busy window settles.");
assert(stableRuntime.includes('attributeFilter: ["style", "class"]'), "Stable runtime must watch style/class mutations without observing noisy global attributes.");
assert(stableRuntime.includes("skipTransientPlaceholder"), "Stable runtime must not overwrite visible values with transient solver placeholders.");
assert(stableRuntime.includes("setTextIfChanged(valueElement(targetRow)"), "Stable runtime must patch numeric value text without rebuilding panel rows.");
assert(stableRuntime.includes("FAST_PREVIEW_PROTECTED_PUMP_ROWS"), "Stable runtime must preserve fast-preview pump rows during active input.");
assert(stableRuntime.includes("shouldPreserveFastPreviewPumpRow"), "Stable runtime must guard NPSH preview rows from stale replacement panels.");
assert(stableRuntime.includes("liveParameterStableFastPreviewPreserved"), "Stable runtime must annotate preserved fast-preview rows for audit/debugging.");
assert(stableRuntime.includes("npsh:calculation-applying-results"), "Stable runtime must understand solver lifecycle events.");
assert(stableRuntime.includes("npsh:realtime-autosolve-start"), "Stable runtime must treat realtime autosolve start as a busy window.");
assert(stableRuntime.includes("npsh:realtime-autosolve-scheduled"), "Stable runtime must protect live panels while autosolve is queued.");
assert(stableRuntime.includes("npsh:calculation-dependency-changed"), "Stable runtime must protect live panels during dependency-triggered recalculation.");
assert(stableRuntime.includes("pointermove"), "Stable runtime must avoid repaint churn during canvas drag.");
assert(stableRuntime.includes("dragstart"), "Stable runtime must protect object cards during drag lifecycle events.");
assert(stableRuntime.includes("touchmove"), "Stable runtime must protect object cards during touch dragging.");
assert(stableRuntime.includes('"input", "change"'), "Stable runtime must protect canvas panels while users edit numeric inputs.");
assert(stableRuntime.includes("MutationObserver"), "Stable runtime must observe late panel insertions.");
assert(stableRuntime.includes("liveParameterStableOwnerId"), "Stable runtime must tag live panels with their owning canvas object id.");
assert(stableRuntime.includes("pruneOrphanPanels"), "Stable runtime must prune live parameter panels whose owner object has been deleted.");
assert(stableRuntime.includes("purgeOwnerPanels"), "Stable runtime must purge live parameter panels when a canvas object subtree is removed.");
assert(stableRuntime.includes("shouldDiscardPanelForMissingOwner"), "Stable runtime must refuse to restore panels from deleted object subtrees.");
assert(stableRuntime.includes("panelIsInsideRemovedObject"), "Stable runtime must detect panels removed together with their owner icon.");
assert(!stableRuntime.includes("innerHTML"), "Stable runtime must not use innerHTML for live canvas parameter panels.");

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

const sinkPanelBlock = cssBlocks(lockCss, ".sink-live-params").join("\n");
assert(sinkPanelBlock, "Missing CSS block for .sink-live-params.");
assertDeclaration(sinkPanelBlock, "min-width: 190px !important;", "sink live parameter card");
assertDeclaration(sinkPanelBlock, "max-width: 232px !important;", "sink live parameter card");
assertDeclaration(sinkPanelBlock, "min-height: 82px !important;", "sink live parameter card");
assertDeclaration(sinkPanelBlock, "transition: none !important;", "sink live parameter card");
assertDeclaration(sinkPanelBlock, "transform: translate3d(-50%, 0, 0) !important;", "sink live parameter card");

const pumpRowBlock = cssBlockPattern(
  lockCss,
  /\.pump-live-param-section,\s*\.pump-live-param-row,\s*\.sink-live-param-row\s*\{([^}]*)\}/m,
  "pump and sink canvas rows"
);
assertDeclaration(pumpRowBlock, "min-height: 13px !important;", "pump and sink canvas rows");
assertDeclaration(pumpRowBlock, "transition: none !important;", "pump and sink canvas rows");
assertDeclaration(pumpRowBlock, "contain: layout paint !important;", "pump and sink canvas rows");

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

const sourceIncompleteBlock = cssBlock(lockCss, '.object-type-source[data-operating-status="incomplete"] .object-icon');
assertDeclaration(sourceIncompleteBlock, "background: #f8fafc !important;", "disconnected source icon");
assertDeclaration(sourceIncompleteBlock, "box-shadow: 0 0 0 2px #94a3b8 !important;", "disconnected source icon");

assert(
  /\.pump-live-params,\s*\.tank-live-params,\s*\.source-live-params,\s*\.sink-live-params\{[^}]*box-shadow:none;/m.test(styleCss),
  "style.min.css base live parameter cards must keep box-shadow:none."
);
assert(
  /\.pump-live-params\{[^}]*min-height:173px;[^}]*transition:none/m.test(styleCss),
  "style.min.css pump live parameter card must keep the solved-state min-height and transition lock."
);

console.log("Live parameter repaint-lock validation passed.");
