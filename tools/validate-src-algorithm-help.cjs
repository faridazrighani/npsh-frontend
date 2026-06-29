const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-src-algorithm-help-runtime.js");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");

function read(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, "utf8");
}

const index = read(INDEX_FILE);
const runtimeSource = read(RUNTIME_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const manifest = read(MANIFEST_FILE);
const runtime = require(RUNTIME_FILE);

assert.strictEqual(runtime.version, "engineering-src-algorithm-help.v1");
assert.strictEqual(runtime.cacheKey, "2026.06-src-algorithm-help1");
assert.strictEqual(runtime.windowId, "srcAlgorithmTaskWindow");

assert(index.includes('id="menu-hydraulic-logic"'), "Help menu must include Hydraulic Logic.");
assert(index.includes('id="dropdown-hydraulic-logic"'), "Help menu must include the Hydraulic Logic flyout.");
assert(index.includes('id="menu-src-help"'), "Hydraulic Logic flyout must include SRC Boundary Guidance.");
assert(index.includes('id="menu-src-algorithm"'), "Hydraulic Logic flyout must include SRC Algorithm.");
assert(index.includes("dropdown-submenu-flyout hydraulic-logic-submenu"), "Hydraulic Logic must be a right-side flyout.");
assert(
  /id="dropdown-hydraulic-logic"[\s\S]*id="menu-src-help"[\s\S]*id="menu-src-algorithm"/.test(index),
  "SRC Boundary Guidance must be inside Help -> Hydraulic Logic before SRC Algorithm."
);
assert(
  !/id="dropdown-help"[\s\S]*id="menu-src-help"[\s\S]*id="menu-snk-help"/.test(index),
  "SRC Boundary Guidance must no longer be a root Help menu item before SNK Boundary Guidance."
);
assert(
  index.includes("engineering-src-algorithm-help-runtime.js?v=20260628-manual-npshr1"),
  "Index must load the cache-busted SRC Algorithm help runtime."
);

[
  "SRC Flow Input Mode",
  "Solve from Network",
  "Mass Flow",
  "Volumetric Flow",
  "P<sub>abs</sub> = P<sub>gauge</sub> + P<sub>atm</sub>",
  "H<sub>SRC</sub> = P<sub>abs,SRC</sub> / (rho g) + z<sub>SRC</sub> + H<sub>V,SRC</sub>",
  "NPSH<sub>a</sub> = H<sub>SRC</sub> - h<sub>L,s</sub>(Q) - z<sub>pump</sub> - H<sub>vap</sub>",
  "Tabel A.1",
  "Tabel A.2",
  "Tabel A.3",
  "[1][2]",
  "[3][4]"
].forEach(fragment => {
  assert(runtimeSource.includes(fragment), `Runtime must include appendix fragment: ${fragment}`);
});

assert(runtimeSource.includes("show-submenu"), "Runtime must support click/focus opening for the Hydraulic Logic flyout.");
assert(runtimeSource.includes(":focus-within"), "Runtime CSS must keep the Hydraulic Logic flyout open while focused.");
assert(runtimeSource.includes("resize:both"), "SRC Algorithm task window must be user-resizable on desktop.");
assert(runtimeSource.includes("task-window src-algorithm-window"), "Runtime must create a task-window shell.");
assert(runtimeSource.includes("bindDrag(windowElement, header)"), "Runtime must make the SRC Algorithm task window draggable.");
assert(runtimeSource.includes("openSrcAlgorithmWindow"), "Runtime must expose the SRC Algorithm window opener.");

assert.strictEqual(
  packageJson.scripts?.["validate:src-algorithm-help"],
  "node tools/validate-src-algorithm-help.cjs",
  "package.json must expose validate:src-algorithm-help."
);

assert(
  manifest.includes("SRC Algorithm help runtime cache key: engineering-src-algorithm-help-runtime.js?v=20260628-manual-npshr1"),
  "Manifest must document the SRC Algorithm help cache key."
);
assert(
  manifest.includes("SRC Algorithm help validation: npm run validate:src-algorithm-help"),
  "Manifest must document SRC Algorithm help validation."
);

console.log("SRC Algorithm help validation passed.");
