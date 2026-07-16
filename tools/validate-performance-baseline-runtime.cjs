#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const rootDir = path.resolve(__dirname, "..");
const runtimePath = path.join(rootDir, "engineering-performance-baseline-runtime.js");
const indexPath = path.join(rootDir, "index.html");
const manifestPath = path.join(rootDir, "FILE_MANIFEST.md");
const packagePath = path.join(rootDir, "package.json");

const runtimeSource = fs.readFileSync(runtimePath, "utf8");
const indexHtml = fs.readFileSync(indexPath, "utf8");
const manifest = fs.readFileSync(manifestPath, "utf8");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const cacheKey = "engineering-performance-baseline-runtime.js?v=20260712-performance-console-clean1";

assert.ok(indexHtml.includes(cacheKey), "index.html must load the performance baseline runtime with its cache key.");
assert.ok(
  indexHtml.indexOf("engineering-simulation-load-transaction-manager-20260715-export-lock-dedupe1.js?v=20260716-canvas-object-smooth-drag1") <
    indexHtml.indexOf(cacheKey),
  "Performance baseline must load after the Simulation Load Transaction Manager."
);
assert.equal(
  packageJson.scripts?.["validate:performance-baseline"],
  "node tools/validate-performance-baseline-runtime.cjs",
  "package.json must expose validate:performance-baseline."
);
assert.equal(
  packageJson.scripts?.["test:e2e:performance-baseline"],
  "playwright test tests/e2e/performance-baseline-runtime.spec.cjs",
  "package.json must expose test:e2e:performance-baseline."
);
assert.ok(manifest.includes(cacheKey), "FILE_MANIFEST.md must record the performance baseline cache key.");
assert.ok(
  manifest.includes("Performance baseline validation: npm run validate:performance-baseline"),
  "FILE_MANIFEST.md must record the performance baseline validator."
);
assert.ok(
  manifest.includes("Performance baseline E2E: npm run test:e2e:performance-baseline"),
  "FILE_MANIFEST.md must record the performance baseline E2E command."
);

[
  "EngineeringPerformanceBaselineRuntime",
  "engineering-performance-baseline.v2-console-clean",
  "20260712-performance-console-clean1",
  "npsh:performance-baseline-sample",
  "npsh:simulation-load-transaction-begin",
  "npsh:simulation-load-transaction-complete",
  "npsh:simulation-load-transaction-stale-result",
  "npsh:calculation-lifecycle",
  "applySimulationStateAtomic",
  "updateSimulation",
  "snapshot",
  "samples",
  "canvasObjects",
  "canvasDomNodes",
  "taskWindows",
  "consoleWarnings",
  "consoleErrors",
  "staleResultsRejected",
  "CALCULATION_STUCK_MS",
  "LOAD_STUCK_MS",
  "PerformanceObserver"
].forEach((token) => {
  assert.ok(runtimeSource.includes(token), `Performance baseline runtime must include ${token}.`);
});

[
  "fetch(",
  "XMLHttpRequest",
  "navigator.sendBeacon",
  "localStorage.setItem",
  "sessionStorage.setItem"
].forEach((forbidden) => {
  assert.ok(!runtimeSource.includes(forbidden), `Performance baseline runtime must not use ${forbidden}.`);
});

delete require.cache[require.resolve(runtimePath)];
const api = require(runtimePath);
assert.equal(api.version, "engineering-performance-baseline.v2-console-clean", "Runtime API version mismatch.");
assert.equal(api.cacheKey, "20260712-performance-console-clean1", "Runtime API cache key mismatch.");
assert.equal(api.sampleEvent, "npsh:performance-baseline-sample", "Runtime must expose the sample event.");
["install", "record", "snapshot", "samples", "reset", "beginLoad", "finishLoad"].forEach((method) => {
  assert.equal(typeof api[method], "function", `Runtime API must expose ${method}.`);
});

api.reset();
const before = api.snapshot();
api.record("validator-sample", { caseId: "simulation-case-6", silent: true }, { durationMs: 12.34 });
const afterSamples = api.samples();
assert.equal(afterSamples.length, 1, "Runtime must store baseline samples.");
assert.equal(afterSamples[0].type, "validator-sample", "Runtime sample type must be retained.");
assert.equal(afterSamples[0].durationMs, 12.3, "Runtime must normalize sample durations.");
assert.equal(afterSamples[0].caseId, "simulation-case-6", "Runtime must retain simple sample detail.");
assert.equal(before.version, "engineering-performance-baseline.v2-console-clean", "Snapshot must include runtime version.");

api.reset();
for (let index = 0; index < 12; index += 1) api.handleCalculationLifecycle({ status: "current" });
assert.equal(api.samples().length, 0, "Orphan Current pulses must not create calculation-complete samples.");
assert.equal(api.snapshot().counters.orphanCalculationCompletionsIgnored, 12, "Orphan Current pulses must be counted without console/sample spam.");
api.handleCalculationLifecycle({ status: "calculating", calculationMode: "validator" });
api.handleCalculationLifecycle({ status: "current", calculationMode: "validator" });
api.handleCalculationLifecycle({ status: "current", calculationMode: "validator" });
assert.equal(api.samples().filter((sample) => sample.type === "calculation-complete").length, 1, "One active calculation must create exactly one completion sample.");

console.log("Performance baseline runtime validation passed.");
