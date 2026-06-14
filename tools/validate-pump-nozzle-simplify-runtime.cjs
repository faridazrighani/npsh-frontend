const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-pump-nozzle-simplify-runtime.js");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const CACHE_KEY = "engineering-pump-nozzle-simplify-runtime.js?v=20260614-pump-nozzle-simplify4";
const VERSION = "2026.06-pump-nozzle-simplify4";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const index = read(INDEX_FILE);
const runtime = read(RUNTIME_FILE);
const manifest = read(MANIFEST_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));

assert(index.includes(CACHE_KEY), "index.html must load the pump nozzle simplify runtime with its cache key.");
assert(runtime.includes(`const VERSION = "${VERSION}"`), "Pump nozzle simplify runtime version must match the cache key.");
assert(runtime.includes('const HIDDEN_MAIN_KEYS = new Set(["elevation", "dischargeElevation"])'), "Runtime must hide only deprecated pump elevation fields.");
assert(runtime.includes('const HIDDEN_STATUS_KEYS = new Set(["npshEvaluationMode", "pump-input-readiness"])'), "Runtime must hide non-actionable pump status rows from the main input form.");
assert(runtime.includes("HIDDEN_STATUS_KEYS.has(field.dataset.key)"), "Runtime must apply non-actionable status hiding by data-key.");
assert(!runtime.includes('"pump-core-validation-issues"'), "Runtime must not hide actionable Core Validation Issues.");
assert(runtime.includes('[data-key="suctionElevation"]'), "Runtime must still identify pump windows without hiding suction nozzle elevation.");
assert(!runtime.includes('"suctionElevation"]);'), "Runtime must not hide suction nozzle elevation.");
assert(runtime.includes('const PUMP_DATUM_LABEL = "Pump Datum Elev."'), "Runtime must relabel suctionElevation as Pump Datum Elev.");
assert(runtime.includes("renamePumpDatumLabel"), "Runtime must rename the visible pump datum label in pump property windows.");
assert(runtime.includes("data-pump-basic-nozzle-hidden"), "Runtime must mark hidden fields with a stable data attribute.");
assert(runtime.includes('container.setAttribute("aria-hidden", "true")'), "Runtime must hide deprecated fields from assistive traversal.");
assert(runtime.includes("root.simplifyPumpNozzleInputs"), "Runtime must expose a manual simplification hook.");
assert(
  packageJson.scripts?.["validate:pump-nozzle-simplify"] === "node tools/validate-pump-nozzle-simplify-runtime.cjs",
  "package.json must expose validate:pump-nozzle-simplify."
);
assert(
  manifest.includes(`Pump nozzle simplify runtime cache key: ${CACHE_KEY}`),
  "Manifest must document the pump nozzle simplify runtime cache key."
);
assert(
  manifest.includes("Pump nozzle simplify runtime validation: npm run validate:pump-nozzle-simplify"),
  "Manifest must document pump nozzle simplify runtime validation."
);

console.log("Pump nozzle simplify runtime validation passed.");
