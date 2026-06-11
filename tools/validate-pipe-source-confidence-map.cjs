#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-pipe-source-confidence-map-runtime.js");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const UPLOAD_READINESS_FILE = path.join(FRONTEND_ROOT, "UPLOAD_READINESS.md");
const CACHE_KEY = "engineering-pipe-source-confidence-map-runtime.js?v=20260611-pipe-source-confidence-map1";
const VERSION = "2026.06-pipe-source-confidence-map1";

function read(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, "utf8");
}

const runtime = read(RUNTIME_FILE);
const index = read(INDEX_FILE);
const manifest = read(MANIFEST_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const uploadReadiness = read(UPLOAD_READINESS_FILE);

assert(index.includes(CACHE_KEY), "index.html must load the pipe source confidence map runtime.");
assert(manifest.includes(CACHE_KEY), "FILE_MANIFEST.md must record the pipe source confidence map cache key.");
assert(manifest.includes("Pipe source confidence map validation: npm run validate:pipe-source-confidence-map"), "FILE_MANIFEST.md must record the validator.");
assert(uploadReadiness.includes("engineering-pipe-source-confidence-map-runtime.js"), "UPLOAD_READINESS.md must list the pipe source confidence map runtime.");
assert.strictEqual(
  packageJson.scripts?.["validate:pipe-source-confidence-map"],
  "node tools/validate-pipe-source-confidence-map.cjs",
  "package.json must expose validate:pipe-source-confidence-map."
);
assert(runtime.includes(`const VERSION = "${VERSION}"`), "Runtime version must match validation.");
assert(runtime.includes("buildPipeSourceConfidenceMap"), "Runtime must expose the source map builder.");
assert(runtime.includes("Endpoint elevation rule"), "Runtime must restore the endpoint elevation rule row.");
assert(runtime.includes("Pressure profile"), "Runtime must restore the pressure profile row.");
assert(runtime.includes("patchBuildPipeCalculationTrace"), "Runtime must patch buildPipeCalculationTrace.");
assert(runtime.includes(".pipe-formula-defense-source-table"), "Runtime DOM repair must target the actual pipe formula defense source table.");
assert(runtime.includes("No pipe source map available."), "Runtime must repair the empty source map table state.");

const model = {
  FLUID: {
    type: "fluid",
    props: {
      density: 958.348,
      viscosity: 0.803,
      vaporPressure: 1.01418
    }
  },
  "SRC-100": { type: "source", name: "SRC-100", props: {}, results: {} },
  "PIPE-1": {
    type: "pipe",
    name: "PIPE-1",
    props: {
      headLossAllowancePercent: 0,
      segments: [
        {
          diameter: 0.098,
          roughness: 0.00015,
          fittingQuantity: 2,
          fittingK: 6,
          additionalK: 2.671,
          pipeSize: "Custom diameter",
          material: "Custom roughness",
          fittingType: "Custom K"
        }
      ]
    },
    results: {
      flow: 50,
      pressure: 1.705,
      inletPressure: 1.805,
      outletPressure: 1.606
    }
  },
  "P-100": { type: "pump", name: "P-100", props: {}, results: {} },
  "SNK-100": { type: "sink", name: "SNK-100", props: {}, results: {} }
};

const sandbox = {
  console,
  globalModel: model,
  __npshGlobalModel: model,
  connections: [
    { from: "SRC-100", to: "P-100", pipeId: "PIPE-1", connectionType: "hydraulic" },
    { from: "P-100", to: "SNK-100", pipeId: "PIPE-2", connectionType: "hydraulic" }
  ],
  setTimeout: () => 1,
  buildPipeCalculationTrace(flow, props, results) {
    return {
      isSolved: true,
      basis: {
        flowM3H: flow,
        flowM3S: flow / 3600,
        density: 958.348,
        viscosityCSt: 0.803,
        vaporPressureBarA: 1.01418
      },
      totals: {
        totalK: 14.671,
        majorLoss: 0.08,
        minorLoss: 2.535
      },
      segments: [
        {
          index: 0,
          diameter: 0.098,
          roughness: 0.00015,
          minorLossK: 14.671,
          profile: {
            startPressure: results.inletPressure,
            endPressure: results.outletPressure,
            pressure: results.pressure
          },
          sizeSource: { status: "User", source: "User-entered internal diameter" },
          materialSource: { status: "User", source: "User-entered roughness" },
          fittingSource: { status: "All segments", source: "Sum of segment fitting/additional K values" }
        }
      ],
      sourceMap: []
    };
  },
  calculatePipeHydraulicSegments() {
    return [
      {
        index: 0,
        diameter: 0.098,
        roughness: 0.00015,
        minorLossK: 14.671,
        sizeSource: { status: "User", source: "User-entered internal diameter" },
        materialSource: { status: "User", source: "User-entered roughness" },
        fittingSource: { status: "All segments", source: "Sum of segment fitting/additional K values" },
        profile: { startPressure: 1.805, endPressure: 1.606, pressure: 1.705 }
      }
    ];
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.runInNewContext(runtime, sandbox, { filename: RUNTIME_FILE });
const api = sandbox.EngineeringPipeSourceConfidenceMapRuntime;
assert(api, "Runtime API must be exposed.");
assert.strictEqual(api.version, VERSION, "Runtime API version must match.");
assert.strictEqual(api.cacheKey, "20260611-pipe-source-confidence-map1", "Runtime cache key must match.");

const trace = sandbox.buildPipeCalculationTrace(50, model["PIPE-1"].props, model["PIPE-1"].results, null, "PIPE-1");
assert(Array.isArray(trace.sourceMap), "Patched pipe trace must expose sourceMap.");
assert(trace.sourceMap.length >= 15, "Pipe source confidence map must contain the restored advisor rows.");
const rows = Object.fromEntries(trace.sourceMap.map((row) => [row.parameter, row]));
assert.strictEqual(rows.Flow.status, "Network-derived", "Flow row must be network-derived.");
assert.strictEqual(rows["Pump Path Role"].value, "Suction path", "Pump Path Role must infer suction path.");
assert.strictEqual(rows["Pump Path Role"].status, "P-100", "Pump Path Role must reference the pump id.");
assert.strictEqual(rows["Pump Calculation Impact"].value, "Reduces NPSH.", "Pump impact must explain suction loss effect.");
assert.strictEqual(rows["Endpoint elevation rule"].status, "Engineering interpretation", "Endpoint elevation rule row must be restored.");
assert.strictEqual(rows["Fitting K"].value, 14.671, "Fitting K row must use current trace total K.");
assert.strictEqual(rows["Pressure profile"].value, "Available", "Pressure profile row must reflect available pipe pressures.");

console.log("Pipe source confidence map validation passed.");
