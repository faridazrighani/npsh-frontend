#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const rootDir = path.resolve(__dirname, "..");
const runtimePath = path.join(rootDir, "engineering-runtime-health-audit.js");
const indexPath = path.join(rootDir, "index.html");
const manifestPath = path.join(rootDir, "FILE_MANIFEST.md");
const packagePath = path.join(rootDir, "package.json");

const runtimeSource = fs.readFileSync(runtimePath, "utf8");
const indexHtml = fs.readFileSync(indexPath, "utf8");
const manifest = fs.readFileSync(manifestPath, "utf8");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const cacheKey = "engineering-runtime-health-audit.js?v=20260710-runtime-health-audit-phase10-1";

assert.ok(indexHtml.includes(cacheKey), "index.html must load the runtime health audit with its cache key.");
assert.ok(
  indexHtml.indexOf("engineering-performance-baseline-runtime.js?v=20260712-performance-console-clean1") <
    indexHtml.indexOf(cacheKey),
  "Runtime health audit must load after the performance baseline runtime."
);
assert.ok(
  indexHtml.indexOf("engineering-simulation-load-transaction-manager.js?v=20260712-simulation-load-stale-promise-clean2") <
    indexHtml.indexOf(cacheKey),
  "Runtime health audit must load after the Simulation Load Transaction Manager."
);
assert.equal(
  packageJson.scripts?.["validate:runtime-health-audit"],
  "node tools/validate-runtime-health-audit.cjs",
  "package.json must expose validate:runtime-health-audit."
);
assert.equal(
  packageJson.scripts?.["test:e2e:runtime-health-audit"],
  "playwright test tests/e2e/runtime-health-audit.spec.cjs",
  "package.json must expose test:e2e:runtime-health-audit."
);
assert.ok(manifest.includes(cacheKey), "FILE_MANIFEST.md must record the runtime health audit cache key.");
assert.ok(
  manifest.includes("Runtime health audit validation: npm run validate:runtime-health-audit"),
  "FILE_MANIFEST.md must record the runtime health audit validator."
);
assert.ok(
  manifest.includes("Runtime health audit E2E: npm run test:e2e:runtime-health-audit"),
  "FILE_MANIFEST.md must record the runtime health audit E2E command."
);

[
  "EngineeringRuntimeHealthAudit",
  "engineering-runtime-health-audit.v1",
  "20260710-runtime-health-audit-phase10-1",
  "npsh:runtime-health-audit",
  "npsh:runtime-idle-maintenance",
  "npsh:runtime-load-footprint",
  "npsh:runtime-reliability-evidence",
  "npsh:performance-baseline-sample",
  "npsh:simulation-load-transaction-complete",
  "validate-command-stale-busy",
  "load-active-class-stale",
  "visual-refresh-queue-stale",
  "rapid-load-burst",
  "transaction.auditSettledUi",
  "transaction.flushVisualRefreshQueue",
  "transaction.requestDisplayCleanup",
  "MAX_AUDITS",
  "MAX_LOAD_HISTORY",
  "SETTLE_DEDUPE_MS",
  "loadSettleSignature",
  "IDLE_MAINTENANCE_DELAYS_MS",
  "IDLE_AUDIT_RETAIN",
  "IDLE_LOAD_HISTORY_RETAIN",
  "MAX_FOOTPRINTS",
  "FOOTPRINT_SAMPLE_DELAYS_MS",
  "FOOTPRINT_GROWTH_LIMITS",
  "recordFootprint",
  "scheduleFootprintSample",
  "clearFootprintTimers",
  "footprintSummary",
  "classifyFootprintGrowth",
  "captureReliabilityEvidence",
  "reliabilityEvidenceJson",
  "copyReliabilityEvidence",
  "openReliabilityEvidencePanel",
  "closeReliabilityEvidencePanel",
  "toggleReliabilityEvidencePanel",
  "lastReliabilityEvidence",
  "Reliability Evidence",
  "EVIDENCE_PANEL_ID",
  "POST_LOAD_AUDIT_DELAYS_MS",
  "runIdleMaintenance",
  "scheduleIdleMaintenance",
  "clearMaintenanceTimers",
  "maintenanceSummary",
  "summary",
  "history",
  "reset"
].forEach((token) => {
  assert.ok(runtimeSource.includes(token), `Runtime health audit must include ${token}.`);
});

[
  "fetch(",
  "XMLHttpRequest",
  "navigator.sendBeacon",
  "localStorage.setItem",
  "sessionStorage.setItem",
  "/api/simulate",
  "applySimulationStateAtomic("
].forEach((forbidden) => {
  assert.ok(!runtimeSource.includes(forbidden), `Runtime health audit must not use ${forbidden}.`);
});

delete require.cache[require.resolve(runtimePath)];
const api = require(runtimePath);
assert.equal(api.version, "engineering-runtime-health-audit.v1", "Runtime API version mismatch.");
assert.equal(api.cacheKey, "20260710-runtime-health-audit-phase10-1", "Runtime API cache key mismatch.");
assert.equal(api.auditEvent, "npsh:runtime-health-audit", "Runtime must expose the audit event.");
assert.equal(api.maintenanceEvent, "npsh:runtime-idle-maintenance", "Runtime must expose the maintenance event.");
assert.equal(api.footprintEvent, "npsh:runtime-load-footprint", "Runtime must expose the footprint event.");
assert.equal(api.evidenceEvent, "npsh:runtime-reliability-evidence", "Runtime must expose the evidence event.");
["install", "uninstall", "audit", "scheduleAudit", "scheduleIdleMaintenance", "runIdleMaintenance", "clearMaintenanceTimers", "recordFootprint", "scheduleFootprintSample", "clearFootprintTimers", "captureReliabilityEvidence", "reliabilityEvidenceJson", "copyReliabilityEvidence", "openReliabilityEvidencePanel", "closeReliabilityEvidencePanel", "toggleReliabilityEvidencePanel", "lastReliabilityEvidence", "noteLoadSettle", "snapshot", "summary", "maintenanceSummary", "footprintSummary", "history", "reset"].forEach((method) => {
  assert.equal(typeof api[method], "function", `Runtime API must expose ${method}.`);
});

api.reset();
const audit = api.audit("validator-runtime-health-audit");
assert.equal(audit.status, "healthy", "Runtime audit should be healthy without a DOM or active warnings.");
assert.equal(api.history().length, 1, "Runtime must retain health audit history.");
assert.equal(api.summary().lastAudit.status, "healthy", "Runtime summary must expose the last audit status.");
api.noteLoadSettle({ caseId: "simulation-case-6" }, "npsh:simulation-load-transaction-complete");
api.noteLoadSettle({ caseId: "simulation-case-6" }, "baseline:simulation-load-complete");
assert.equal(api.summary().loadHistory, 1, "Runtime must dedupe transaction/baseline settle pairs.");
assert.ok(api.summary().pendingTimers >= 1, "Runtime must schedule post-load audit timers.");
assert.ok(api.summary().pendingMaintenanceTimers >= 1, "Runtime must schedule post-load idle maintenance timers.");
assert.ok(api.summary().pendingFootprintTimers >= 1, "Runtime must schedule post-load footprint timers.");
const maintenance = api.runIdleMaintenance("validator-idle-maintenance", { force: true, retainAudits: 0, retainLoads: 0 });
assert.ok(["maintained", "clean"].includes(maintenance.status), "Runtime idle maintenance must return a stable status.");
assert.equal(api.maintenanceSummary().stats.runs, 1, "Runtime must count idle maintenance runs.");
const firstFootprint = api.recordFootprint("validator-footprint-1");
const secondFootprint = api.recordFootprint("validator-footprint-2");
assert.equal(firstFootprint.status, "stable", "First runtime footprint should be stable.");
assert.equal(secondFootprint.status, "stable", "Second runtime footprint should be stable without DOM growth.");
assert.equal(api.footprintSummary().stats.samples, 2, "Runtime must count footprint samples.");
const evidence = api.captureReliabilityEvidence("validator-evidence");
assert.equal(evidence.cacheKey, "20260710-runtime-health-audit-phase10-1", "Evidence must include the active cache key.");
assert.ok(["healthy", "watch", "attention"].includes(evidence.status), "Evidence must include a stable status.");
assert.equal(evidence.health.cacheKey, "20260710-runtime-health-audit-phase10-1", "Evidence must include health summary.");
assert.ok(Array.isArray(evidence.recent.audits), "Evidence must include recent audit history.");
const evidenceJson = api.reliabilityEvidenceJson("validator-evidence-json");
assert.ok(evidenceJson.includes("\"runtime-reliability-evidence\"") || evidenceJson.includes("\"validator-evidence-json\""), "Evidence JSON must serialize the diagnostic snapshot.");
api.reset();

console.log("Runtime health audit validation passed.");
