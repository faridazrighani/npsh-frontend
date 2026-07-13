#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-pdf-export-progress-runtime.js");
const EXPORT_RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-export-equation-professional-runtime.js");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const UPLOAD_READINESS_FILE = path.join(FRONTEND_ROOT, "UPLOAD_READINESS.md");
const E2E_FILE = path.join(FRONTEND_ROOT, "tests", "e2e", "pdf-export-progress.spec.cjs");

const PROGRESS_CACHE_KEY = "engineering-pdf-export-progress-runtime.js?v=20260707-pdf-export-progress1";
const EXPORT_CACHE_KEY = "engineering-export-equation-professional-runtime.js?v=20260712-pdf-fluid-phase-visibility1";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

const runtimeSource = read(RUNTIME_FILE);
const exportRuntimeSource = read(EXPORT_RUNTIME_FILE);
const indexHtml = read(INDEX_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const manifest = read(MANIFEST_FILE);
const uploadReadiness = read(UPLOAD_READINESS_FILE);
const e2eSource = read(E2E_FILE);

[
  "engineering-pdf-export-progress.v1",
  "20260707-pdf-export-progress1",
  "npsh:pdf-export-progress",
  "Exporting PDF Report",
  "PDF Report Ready",
  "PDF Export Failed",
  "Preparing professional engineering report",
  "Reading active simulation state",
  "Validating report topology",
  "Capturing model snapshot",
  "Rendering Fluid Basis phase chart",
  "Rendering Moody chart evidence",
  "Formatting Equation Professional sections",
  "Building PDF pages",
  "Finalizing report file",
  "PDF report completed",
  "#menu-export-appendix-pdf",
  "#menu-tools-export-appendix-pdf",
  "aria-busy",
  "aria-disabled",
  "wrapPdfExport",
  "exportScenarioCalculationTraceToPdf",
  "MIN_VISIBLE_MS",
  "AUTO_HIDE_MS",
  "FAILURE_HIDE_MS"
].forEach((needle) => assert(runtimeSource.includes(needle), `progress runtime must include ${needle}`));

[5, 12, 22, 35, 48, 60, 74, 88, 96, 100].forEach((percent) => {
  assert(runtimeSource.includes(`percent: ${percent}`), `progress runtime must lock ${percent}% milestone`);
});

assert(!runtimeSource.includes("menu-export-excel-trace"), "PDF progress runtime must not bind Excel export.");
assert(!runtimeSource.includes("exportScenarioCalculationTraceToExcel"), "PDF progress runtime must not wrap Excel export.");
assert(!runtimeSource.includes("updateSimulation("), "PDF progress runtime must not trigger solver/backend recalculation.");
assert(!runtimeSource.includes("fetch("), "PDF progress runtime must not call network APIs.");

[
  "EngineeringPdfExportProgressRuntime",
  "publishPdfProgress",
  "startPdfProgress",
  "completePdfProgress",
  "failPdfProgress",
  "Rendering Moody chart ${index + 1} of ${count}: ${pipeId}",
  "pipeIndex",
  "pipeCount",
  "phase-chart",
  "moody",
  "equations",
  "pages",
  "finalizing"
].forEach((needle) => assert(exportRuntimeSource.includes(needle), `PDF export runtime must publish progress: ${needle}`));

assert(indexHtml.includes(PROGRESS_CACHE_KEY), "index.html must load the PDF export progress runtime.");
assert(indexHtml.includes(EXPORT_CACHE_KEY), "index.html must load the bumped PDF equation runtime.");
assert(
  indexHtml.indexOf(EXPORT_CACHE_KEY) < indexHtml.indexOf(PROGRESS_CACHE_KEY),
  "PDF export progress runtime must load after the professional PDF export runtime."
);
assert(
  indexHtml.indexOf(PROGRESS_CACHE_KEY) < indexHtml.indexOf("engineering-src-connect-context-runtime.js"),
  "PDF export progress runtime must stay in the critical export script group."
);

assert.equal(
  packageJson.scripts?.["validate:pdf-export-progress"],
  "node tools/validate-pdf-export-progress-runtime.cjs",
  "package.json must expose validate:pdf-export-progress."
);
assert.equal(
  packageJson.scripts?.["test:e2e:pdf-export-progress"],
  "playwright test tests/e2e/pdf-export-progress.spec.cjs",
  "package.json must expose test:e2e:pdf-export-progress."
);

[
  "npsh:pdf-export-progress",
  "menu-export-appendix-pdf",
  "Mode: Equation Professional",
  "Pressure-enthalpy phase chart",
  "Log-Log Moody Chart",
  "Pump Performance Curve",
  "PIPE-2",
  "moodyChartCount"
].forEach((needle) => assert(e2eSource.includes(needle), `PDF export progress E2E must verify ${needle}`));

assert(manifest.includes("engineering-pdf-export-progress-runtime.js public-safe"), "FILE_MANIFEST must document the progress runtime.");
assert(manifest.includes(`PDF export progress runtime cache key: ${PROGRESS_CACHE_KEY}`), "FILE_MANIFEST must document the progress cache key.");
assert(manifest.includes("PDF export progress validation: npm run validate:pdf-export-progress"), "FILE_MANIFEST must document the validation command.");
assert(manifest.includes("PDF export progress E2E: npm run test:e2e:pdf-export-progress"), "FILE_MANIFEST must document the PDF export progress E2E command.");
assert(uploadReadiness.includes("PDF export progress validation and E2E passed"), "UPLOAD_READINESS must lock the PDF progress validation and E2E.");

global.exportScenarioCalculationTraceToPdf = async () => ({ ok: true, mode: "validator" });
delete require.cache[require.resolve(RUNTIME_FILE)];
const api = require(RUNTIME_FILE);
assert.equal(api.version, "engineering-pdf-export-progress.v1", "runtime API version mismatch.");
assert.equal(api.cacheKey, "20260707-pdf-export-progress1", "runtime API cache key mismatch.");
assert.equal(api.eventName, "npsh:pdf-export-progress", "runtime API event name mismatch.");
assert.equal(api.steps.length, 10, "runtime API must expose ten progress milestones.");

api.start({ message: "Validator start" });
assert.equal(api.state().status, "active", "start() must activate progress state.");
api.update("moody", {
  percent: 64,
  pipeId: "PIPE-2",
  pipeIndex: 2,
  pipeCount: 2,
  message: "Rendering Moody chart 2 of 2: PIPE-2"
});
assert.equal(api.state().stepKey, "moody", "update() must set active milestone.");
assert.equal(api.state().pipeId, "PIPE-2", "update() must preserve active pipe id.");
api.complete();
assert.equal(api.state().status, "complete", "complete() must mark the state complete.");
assert.equal(api.state().percent, 100, "complete() must reach 100%.");
api.hide("validator-reset");

api.install();
assert.equal(typeof global.exportScenarioCalculationTraceToPdf, "function", "install() must keep the PDF export function callable.");
assert(global.exportScenarioCalculationTraceToPdf.__pdfExportProgressWrapped, "install() must wrap the PDF export function.");
global.exportScenarioCalculationTraceToPdf().then((result) => {
  assert.equal(result.ok, true, "wrapped PDF export must return the original result.");
  assert.equal(api.state().status, "complete", "wrapped PDF export must complete the progress state.");
  api.uninstall();
  console.log("PDF export progress runtime validation passed.");
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
