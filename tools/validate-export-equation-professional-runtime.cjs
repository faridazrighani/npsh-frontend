#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-export-equation-professional-runtime.js");
const MOODY_RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-pipe-moody-chart-audit.js");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const UPLOAD_READINESS_FILE = path.join(FRONTEND_ROOT, "UPLOAD_READINESS.md");

const CACHE_KEY = "engineering-export-equation-professional-runtime.js?v=20260712-pdf-fluid-phase-visibility1";
const MOODY_CACHE_KEY = "engineering-pipe-moody-chart-audit.js?v=20260708-pipe-moody-export-chart5";
const SNAPSHOT_KEY = "engineering-model-snapshot-export-runtime.js?v=20260707-fluid-basis-workspace-snapshot11";
const APP_BUNDLE_KEY = "app.bundle.min.js?v=20260707-pipe-canvas-loss-label1";
const VERSION = "2026.07-pdf-equation-professional11-fluid-phase-visibility";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function loadRuntime(runtimeSource) {
  const sandbox = {
    console,
    setTimeout: callback => {
      if (typeof callback === "function") callback();
      return 1;
    },
    clearTimeout: () => {},
    globalModel: {
      FLUID: { type: "fluid", props: { fluidName: "Water", density: 965.309, vaporPressure: 0.701827 } },
      "SRC-100": { type: "source", props: { flow: 39.68, pressure: 2.024 } },
      "PIPE-1": { type: "pipe", props: { segments: [] }, results: { calculationTrace: { totals: { totalLoss: 0.014 }, moody: { markers: [] } } } },
      "P-100": {
        type: "pump",
        results: {
          flow: 39.68,
          npsha: 15.3479,
          npshEvaluation: {
            calculationTrace: {
              path: { text: "Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 -> PIPE-2 -> SNK-100" },
              steps: [
                {
                  title: "Old downstream step",
                  formula: "H_system = H_suction + H_discharge",
                  substitution: "Includes PIPE-2 and SNK-100",
                  result: "old"
                }
              ]
            }
          }
        }
      },
      "SNK-100": { type: "sink", props: {} }
    },
    connections: [
      { from: "SRC-100", to: "P-100", pipeId: "PIPE-1", connectionType: "hydraulic" }
    ],
    collectScenarioAppendixData: async options => ({
      language: "id",
      exportOptions: options,
      fluid: {
        steps: [
          {
            step: "Pressure Head",
            formula: "H = P_abs x 100000 / (rho x g)",
            substitution: "H = 1.013 x 100000 / (997.047 x 9.80665)",
            result: "10.360 m",
            reference: "Mechanical energy balance"
          }
        ]
      }
    }),
    buildScenarioAppendixHtml: report => `<!doctype html><html lang="id"><head><style>.appendix{}</style></head><body><main><h1>Appendix</h1><section><h2>Calculation Integrity Statement</h2><table><tr><td>Pump Performance Chart</td><td>Legacy section</td></tr><tr><td>SNK Boundary Calculation</td><td>Stale required row</td></tr></table></section><section><h2>Application Calculation Workflow</h2><p>The application solves the route from Fluid Basis, SRC boundary, suction pipe/fitting/valve elements, pump performance and NPSH, discharge pipe/fitting/valve elements, and finally the SNK boundary. The exported appendix therefore follows the same hydraulic sequence used by the calculation engine.</p><table><tbody><tr><td>Discharge</td><td>PIPE-2</td></tr></tbody></table></section><section><h2>Fluid Basis Calculation</h2><div class="formula-block"><div class="formula">Formula: H = P/(rho g)</div></div><div class="formula-block"><div class="formula">Formula: Pv = Psat(T)</div></div><table><thead><tr><th>Step</th><th>Formula</th><th>Substitution</th><th>Result</th><th>Reference</th></tr></thead><tbody><tr><td>Pressure Head</td><td>H = P_abs x 100000 / (rho x g)</td><td>H = 1.013 x 100000 / (997.047 x 9.80665)</td><td>10.360 m</td><td>Mechanical energy balance</td></tr></tbody></table></section><section><h2>Moody Chart</h2><p>Legacy placeholder.</p><figure><img alt="Moody chart with calculated route points" src="data:image/png;base64,old"><figcaption>Legacy Moody chart with calculated route points.</figcaption></figure><table><tbody><tr><td>Legacy Moody Curve Data</td><td>old</td></tr></tbody></table></section><section><h2>Discharge Pipe, Fitting, and Valve Calculation</h2><p>PIPE-2 old downstream calculation.</p></section><section><h2>SNK Boundary Calculation</h2><p>SNK-100 old sink calculation.</p></section><section><h2>Pump Performance Chart</h2><p>This chart is no longer used.</p></section><p>${report.language}</p></main></body></html>`,
    exportScenarioCalculationTraceToExcel: () => "original-excel",
    exportScenarioCalculationTraceToPdf: () => "original-pdf",
    exportScenarioCalculationTraceToDocx: () => "original-docx",
    EngineeringFluidBasisPhaseChartRuntime: {
      shouldDisplayPhaseChart: () => String(sandbox.globalModel?.FLUID?.props?.fluidName || "Water") === "Water",
      buildExportMarkup: () => `
        <section class="eqp-fluid-phase-chart-figure" data-export-note="pressure-enthalpy-phase-chart">
          <h3>Pressure-enthalpy phase chart</h3>
          <div class="fluid-basis-phase-chart-meta"><div>Temperature<strong>90.000 deg C</strong></div><div>Fluid Basis Vapor Pressure<strong>0.7018 bar A</strong></div><div>Phase Status<strong>Saturated boundary</strong></div></div>
          <div class="fluid-basis-phase-chart-wrap"><svg class="fluid-basis-phase-chart-svg" viewBox="0 0 960 620"></svg></div>
          <p class="eqp-fluid-phase-chart-caption">The P-h chart visualizes whether the selected process fluid is in the liquid, mixed-phase, or vapor region before it flows through the pumping system.</p>
        </section>`
    },
    EngineeringPipeMoodyChartAudit: {
      buildExportMarkup: report => {
        const rows = Array.isArray(report?.moody?.rows) && report.moody.rows.length
          ? report.moody.rows
          : [{ pipeId: "PIPE-1" }];
        return `
          <section class="eqp-moody-chart-pack" data-export-note="moody-friction-factor-chart" data-chart-count="${rows.length}">
            ${rows.map((row, index) => `
              <article class="eqp-moody-chart-figure" data-pipe-id="${row.pipeId}" data-pipe-order="${index + 1}">
                <div class="eqp-moody-title-badge"><span>FRICTION FACTOR AUDIT</span><strong>Log-Log Moody Chart - ${row.pipeId}</strong></div>
                <div class="eqp-moody-metric"><span>Primary Re</span><strong>2.127e+5</strong></div>
                <div class="eqp-moody-metric"><span>Darcy f</span><strong>0.01713</strong></div>
                <div class="eqp-moody-metric"><span>eps/D</span><strong>0.000225</strong></div>
                <div class="eqp-moody-metric"><span>Regime</span><strong>Turbulent</strong></div>
                <div class="eqp-moody-chip-row"><span>Log-log scale</span><span>Darcy friction factor</span><span>Relative roughness families</span><span>Pipe: ${row.pipeId}</span></div>
                <svg class="eqp-moody-chart-svg" viewBox="0 0 960 390"></svg>
                <div class="eqp-moody-formula-block"><div class="formula">f_D = 64 / Re</div></div>
                <div class="eqp-moody-segment-card"><span class="eqp-moody-segment-index">1</span><div class="eqp-moody-segment-copy"><strong>${row.pipeId}-Seg-1</strong><small><span>Re 2.127e+5</span><span>eps/D 0.000225</span><span>f 0.01713</span><span>Turbulent</span></small></div></div>
                <p class="eqp-moody-note">Darcy friction factor chart. Fanning friction factor equals Darcy f / 4.</p>
              </article>
            `).join("")}
          </section>`;
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename: RUNTIME_FILE });
  return sandbox;
}

function moodyPipe(name, reynolds) {
  return {
    type: "pipe",
    name,
    results: {
      calculationTrace: {
        moody: {
          markers: [{
            name: `${name}-Seg-1`,
            reynolds,
            relRoughness: 0.000225,
            frictionFactor: 0.01713,
            flowRegime: "Turbulent"
          }]
        }
      }
    }
  };
}

const runtime = read(RUNTIME_FILE);
const moodyRuntime = read(MOODY_RUNTIME_FILE);
const index = read(INDEX_FILE);
const manifest = read(MANIFEST_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const uploadReadiness = read(UPLOAD_READINESS_FILE);

assert(runtime.includes(`const VERSION = "${VERSION}"`), "runtime version must match the cache key.");
assert(runtime.includes("Menu -> File -> Export PDF professional equation layout bridge"), "runtime purpose header must be PDF-only.");
assert(runtime.includes("Mode: Equation Professional"), "runtime must declare the professional equation mode.");
assert(runtime.includes("Professional English for Mechanical and Chemical Engineering"), "runtime must lock English engineering phrasing.");
assert(runtime.includes("Layout: Compact"), "runtime must lock the compact export layout.");
assert(runtime.includes("compact-equation-sequence"), "runtime must render compact sequential calculation blocks.");
assert(runtime.includes("Numerical substitution"), "runtime must show numeric substitution directly below each equation.");
assert(runtime.includes("ensureFormulaLineModes"), "runtime must force every formula line into Equation Professional mode.");
assert(runtime.includes("Pressure-enthalpy phase chart"), "runtime must add the Fluid Basis P-h phase chart discussion.");
assert(runtime.includes("liquid, mixed-phase, or vapor"), "Fluid Basis discussion must explain fluid-state visualization.");
assert(runtime.includes("EngineeringFluidBasisPhaseChartRuntime"), "runtime must consume the Fluid Basis P-h chart export API.");
assert(runtime.includes("eqp-fluid-phase-chart-figure"), "runtime must style the exported P-h chart figure.");
assert(runtime.includes("EngineeringPipeMoodyChartAudit"), "runtime must consume the Pipe Moody chart export API.");
assert(runtime.includes("eqp-moody-chart-figure"), "runtime must style the exported Moody chart figure.");
assert(runtime.includes("Log-Log Moody Chart"), "runtime must render the requested log-log Moody chart title.");
assert(runtime.includes("Fanning friction factor equals Darcy f / 4"), "runtime must document Darcy-to-Fanning friction factor relation.");
assert(runtime.includes("sanitizeReportForActiveTopology"), "runtime must sanitize stale report data against the active topology.");
assert(runtime.includes("refreshActiveCalculationBeforeExport"), "runtime must refresh current calculation data before PDF export.");
assert(runtime.includes("removeInactiveTopologySections"), "runtime must remove inactive discharge/SNK sections from suction-only PDF exports.");
assert(runtime.includes("isSuctionBoundaryType"), "runtime must classify source/tank suction endpoints before trusting export route data.");
assert(runtime.includes("isDischargeBoundaryType"), "runtime must classify SNK endpoints before trusting export route data.");
assert(runtime.includes("Current hydraulic route is incomplete or reversed"), "runtime must explain incomplete/reversed route exports without leaking stale downstream duty.");
assert(runtime.includes("DOMParser"), "runtime must use DOM parsing for reliable Fluid Basis insertion and pump curve removal.");
assert(runtime.includes("removePumpPerformanceChartDiscussion"), "runtime must remove the unused Pump Performance Chart discussion.");
assert(runtime.includes("Pump Performance (?:Chart|Curve)"), "runtime must remove both Pump Performance Chart and Curve wording.");
assert(runtime.includes("removeLegacyMoodyChartDiscussion"), "runtime must remove the old native Moody chart image/table from the PDF section.");
assert(runtime.includes(".eqp-moody-segment-copy small span"), "runtime must keep Moody segment facts grouped instead of wrapping per character.");
assert(runtime.includes("white-space: nowrap"), "runtime must prevent Moody metric tokens from splitting across narrow card columns.");
assert(runtime.includes("includePumpChart: false"), "PDF collector must not request the unused pump chart.");
assert(runtime.includes("root.exportScenarioCalculationTraceToPdf = exportProfessionalPdf"), "runtime must override PDF appendix export.");
assert(!runtime.includes("root.exportScenarioCalculationTraceToExcel ="), "runtime must not wrap Excel export.");
assert(!runtime.includes("root.exportScenarioCalculationTraceToDocx ="), "runtime must not wrap DOCX export.");
assert(!runtime.includes("exportProfessionalExcel"), "runtime must not include the temporary Excel professional wrapper.");
assert(!runtime.includes("exportProfessionalDocx"), "runtime must not include DOCX export logic.");
assert(!runtime.includes("Eq Professional Trace"), "runtime must not add an XLSX sheet while Excel rules are deferred.");

assert(index.includes(CACHE_KEY), "index.html must load the PDF equation professional export runtime.");
assert(index.includes(MOODY_CACHE_KEY), "index.html must load the Moody chart export provider with a fresh cache key.");
assert(index.indexOf(CACHE_KEY) > index.indexOf(APP_BUNDLE_KEY), "equation runtime must load after app.bundle.min.js.");
assert(index.indexOf(CACHE_KEY) > index.indexOf(SNAPSHOT_KEY), "equation runtime must load after the model snapshot runtime.");
assert(!index.includes("menu-export-appendix-docx"), "File -> Export DOCX button must be removed.");
assert(!index.includes("menu-tools-export-appendix-docx"), "Tools DOCX export button must be removed.");
assert(index.includes("menu-export-excel-trace"), "Excel export button must remain available for its separate future rules.");
assert(index.includes("menu-export-appendix-pdf"), "PDF export button must remain available.");

assert(manifest.includes("engineering-export-equation-professional-runtime.js public-safe"), "manifest runtime inventory entry is missing.");
assert(manifest.includes(`Export equation professional runtime cache key: ${CACHE_KEY}`), "manifest cache key is missing.");
assert(manifest.includes(`Pipe Moody chart audit cache key: ${MOODY_CACHE_KEY}`), "manifest must record the Moody chart export provider cache key.");
assert(manifest.includes("PDF-only"), "manifest must document the PDF-only export scope.");
assert(manifest.includes("Export equation professional validation: npm run validate:export-equation-professional"), "manifest validation command is missing.");
assert(uploadReadiness.includes("Export equation professional PDF-only validation passed"), "upload readiness must record the PDF-only professional export lock.");
assert(
  packageJson.scripts?.["validate:export-equation-professional"] === "node tools/validate-export-equation-professional-runtime.cjs",
  "package.json must expose validate:export-equation-professional."
);
assert(moodyRuntime.includes("buildExportMarkup"), "Moody chart audit runtime must expose PDF export markup.");
assert(moodyRuntime.includes("collectMoodyExportTraces"), "Moody chart audit runtime must expose multi-pipe export traces.");
assert(moodyRuntime.includes("collectMoodyPipeOrder"), "Moody chart audit runtime must resolve pipe chart order from active route data.");
assert(moodyRuntime.includes("eqp-moody-chart-pack"), "Moody chart export markup must wrap multiple pipe charts in one report block.");
assert(moodyRuntime.includes("data-pipe-order"), "Moody chart export markup must label each pipe chart with a deterministic order.");
assert(moodyRuntime.includes("data-export-note=\"moody-friction-factor-chart\""), "Moody chart export markup must use the expected report marker.");
assert(moodyRuntime.includes("Log-Log Moody Chart"), "Moody chart export markup must use the requested title.");
assert(moodyRuntime.includes("Darcy friction factor chart. Fanning friction factor equals Darcy f / 4."), "Moody chart export markup must include the Darcy/Fanning note.");
assert(moodyRuntime.includes("eqp-moody-segment-copy"), "Moody chart segment cards must wrap copy in a full-width content column.");

const previousGlobalModel = global.globalModel;
const previousConnections = global.connections;
const previousMoodyApi = global.EngineeringPipeMoodyChartAudit;
try {
  global.globalModel = {
    "PIPE-1": moodyPipe("PIPE-1", 212700),
    "PIPE-2": moodyPipe("PIPE-2", 314100)
  };
  global.connections = [
    { from: "SRC-100", to: "P-100", pipeId: "PIPE-1", connectionType: "hydraulic" },
    { from: "P-100", to: "SNK-100", pipeId: "PIPE-2", connectionType: "hydraulic" }
  ];
  delete require.cache[require.resolve(MOODY_RUNTIME_FILE)];
  const moodyApi = require(MOODY_RUNTIME_FILE);
  const multiPipeTraces = moodyApi.collectMoodyExportTraces({});
  const multiPipeMarkup = moodyApi.buildExportMarkup({});
  const noisyReport = {
    moody: {
      rows: [
        { pipeId: "PIPE-1" },
        { pipeId: "PIPE-2" },
        { pipeId: "SRC-100 -> PIPE-1 -> P-100" }
      ]
    },
    sourceData: {
      primary: {
        trace: {
          path: { text: "Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 -> PIPE-2 -> SNK-100" }
        }
      }
    }
  };
  const noisyMarkup = moodyApi.buildExportMarkup(noisyReport);
  assert.equal(moodyApi.version, "engineering-pipe-moody-chart-audit.v9", "Moody runtime API version must be updated.");
  assert.equal(moodyApi.cacheKey, "20260708-pipe-moody-export-chart5", "Moody runtime cache key must be updated.");
  assert.deepEqual(multiPipeTraces.map(trace => trace.pipeId), ["PIPE-1", "PIPE-2"], "Moody export traces must follow active PIPE-1 then PIPE-2 route order.");
  assert.equal((multiPipeMarkup.match(/class="eqp-moody-chart-figure"/g) || []).length, 2, "Moody export markup must render one chart figure for each active pipe.");
  assert(multiPipeMarkup.includes('data-chart-count="2"'), "Moody export markup must report the active pipe chart count.");
  assert(multiPipeMarkup.indexOf('data-pipe-id="PIPE-1"') < multiPipeMarkup.indexOf('data-pipe-id="PIPE-2"'), "PIPE-1 chart must appear before PIPE-2 chart.");
  assert(multiPipeMarkup.includes("Log-Log Moody Chart - PIPE-2"), "PIPE-2 Moody chart title must be visible in the PDF markup.");
  assert.equal((noisyMarkup.match(/class="eqp-moody-chart-figure"/g) || []).length, 2, "Route-level Moody rows must not create an extra third chart.");
  assert(!noisyMarkup.includes("SRC-100 -&gt; PIPE-1 -&gt; P-100"), "Route-level Moody chart labels must be filtered out.");
} finally {
  global.globalModel = previousGlobalModel;
  global.connections = previousConnections;
  global.EngineeringPipeMoodyChartAudit = previousMoodyApi;
  delete require.cache[require.resolve(MOODY_RUNTIME_FILE)];
}

const sandbox = loadRuntime(runtime);
const api = sandbox.EngineeringExportEquationProfessionalRuntime;
assert.equal(api.version, VERSION, "runtime API must expose the version.");
assert.equal(sandbox.buildScenarioAppendixHtml, api.original.buildScenarioAppendixHtml, "runtime must not globally override the shared HTML builder.");
assert.equal(sandbox.exportScenarioCalculationTraceToExcel(), "original-excel", "Excel export must remain on the original path.");
assert.equal(sandbox.exportScenarioCalculationTraceToDocx(), "original-docx", "DOCX runtime path must not be wrapped even though menu buttons are removed.");
assert.equal(typeof sandbox.exportScenarioCalculationTraceToPdf, "function", "PDF export override must be callable.");
assert.equal(api.labels.mode, "Mode: Equation Professional", "mode label must be explicit.");

const rawHtml = api.original.buildScenarioAppendixHtml({ language: "id" });
const transformed = api.professionalizeAppendixHtml(rawHtml, { language: "id" });
assert(transformed.includes('lang="en"'), "professionalized HTML must force English language metadata.");
assert(transformed.includes("equation-professional-export"), "professionalized HTML must mark the compact professional body.");
assert(transformed.includes("eqp-export-contract"), "professionalized HTML must include an export contract band.");
assert(transformed.includes("compact-equation-sequence"), "step table must be replaced by compact equation sequence blocks.");
assert(transformed.includes("Pressure-enthalpy phase chart"), "Fluid Basis PDF section must discuss the P-h phase chart.");
assert(transformed.includes("fluid-basis-phase-chart-svg"), "Fluid Basis PDF section must include the P-h chart SVG markup.");
assert(transformed.includes("liquid, mixed-phase, or vapor"), "P-h discussion must state the fluid-region visualization purpose.");
const waterFluidName = sandbox.globalModel.FLUID.props.fluidName;
sandbox.globalModel.FLUID.props.fluidName = "Methanol";
const methanolTransformed = api.professionalizeAppendixHtml(rawHtml, { language: "id" });
assert(!methanolTransformed.includes("Pressure-enthalpy phase chart"), "Methanol PDF must not include the Water P-h chart.");
assert(!methanolTransformed.includes('<svg class="fluid-basis-phase-chart-svg"'), "Methanol PDF must not include the Water P-h chart SVG element.");
sandbox.globalModel.FLUID.props.fluidName = "Custom";
const customTransformed = api.professionalizeAppendixHtml(rawHtml, { language: "id" });
assert(!customTransformed.includes("Pressure-enthalpy phase chart"), "Custom Fluid PDF must not include the Water P-h chart.");
sandbox.globalModel.FLUID.props.fluidName = waterFluidName;
assert(transformed.includes('data-export-note="moody-friction-factor-chart"'), "Moody Chart PDF section must include the visual friction-factor chart.");
assert(transformed.includes("Log-Log Moody Chart"), "Moody Chart PDF section must use the requested log-log chart title.");
assert(transformed.includes("eqp-moody-chart-svg"), "Moody Chart PDF section must include SVG chart markup.");
assert(transformed.includes("Primary Re"), "Moody Chart PDF section must include the Primary Re metric.");
assert(transformed.includes("Darcy f"), "Moody Chart PDF section must include the Darcy friction-factor metric.");
assert(transformed.includes("eps/D"), "Moody Chart PDF section must include the relative roughness metric.");
assert(transformed.includes("Regime"), "Moody Chart PDF section must include the flow-regime metric.");
assert(transformed.includes("PIPE-1-Seg-1"), "Moody Chart PDF section must include segment cards.");
assert(transformed.includes("eqp-moody-segment-copy"), "Moody Chart PDF segment cards must use the fixed copy column.");
assert(transformed.includes("Fanning friction factor equals Darcy f / 4"), "Moody Chart PDF section must include Darcy-to-Fanning note.");
assert(!transformed.includes("Legacy placeholder"), "old Moody placeholder text must be removed from the PDF HTML.");
assert(!transformed.includes("Moody chart with calculated route points"), "old native Moody image must be removed from the PDF HTML.");
assert(!transformed.includes("Legacy Moody Curve Data"), "old native Moody table must be removed from the PDF HTML.");
assert(transformed.includes('data-export-note="active-topology-suction-only"'), "suction-only export must include an active-topology notice.");
assert(!transformed.includes("Discharge Pipe, Fitting, and Valve Calculation"), "stale discharge calculation section must be removed when no downstream connection exists.");
assert(!transformed.includes("SNK Boundary Calculation"), "stale SNK boundary section must be removed when no downstream connection exists.");
assert(!transformed.includes("PIPE-2 old downstream calculation"), "stale downstream pipe content must not remain in the PDF HTML.");
assert(!transformed.includes("SNK-100 old sink calculation"), "stale sink content must not remain in the PDF HTML.");
assert(!transformed.includes("The application solves the route from Fluid Basis"), "static full-route workflow text must be replaced for suction-only exports.");
assert(!transformed.includes("Pump Performance Chart"), "unused Pump Performance Chart discussion must be removed from the PDF HTML.");
const curveHtml = api.professionalizeAppendixHtml('<html><body><main><section><h2>Pump Performance Curve</h2><figure><figcaption>Pump performance curve, system curve, operating point, and NPSH relationship</figcaption></figure></section><section><h2>Fluid Basis Calculation</h2></section></main></body></html>', {});
assert(!curveHtml.includes("Pump Performance Curve"), "unused Pump Performance Curve section must be removed from the PDF HTML.");
assert(!curveHtml.includes("pump performance curve"), "unused Pump Performance Curve caption must be removed from the PDF HTML.");
assert(transformed.includes("Equation"), "formula label must be converted to Equation.");
assert(transformed.includes("Numerical substitution"), "numeric substitution label must be present.");
assert(transformed.includes("10.360 m"), "result must remain immediately available in the sequence block.");
assert(!transformed.includes("<th>Formula</th>"), "wide Step/Formula/Substitution/Result table header must not remain.");
const formulaLineCount = (transformed.match(/class="formula"/g) || []).length;
const sequenceStepCount = (transformed.match(/class="eqp-step"/g) || []).length;
const modeCount = (transformed.match(/Mode: Equation Professional/g) || []).length;
assert.equal(formulaLineCount, 3, "sample must contain the two Fluid Basis equations plus the Moody equation line.");
assert(modeCount >= formulaLineCount + sequenceStepCount, "every standalone equation and sequential equation step must carry Equation Professional mode.");

const suctionOnlyConnections = sandbox.connections;
sandbox.globalModel["PIPE-2"] = { type: "pipe", props: { segments: [] }, results: { calculationTrace: { moody: { markers: [] } } } };
sandbox.connections = [
  { from: "SRC-100", to: "P-100", pipeId: "PIPE-1", connectionType: "hydraulic" },
  { from: "P-100", to: "SNK-100", pipeId: "PIPE-2", connectionType: "hydraulic" }
];
const fullTopologyHtml = api.professionalizeAppendixHtml(
  '<html><body><main><section><h2>Moody Chart</h2><p>Legacy placeholder.</p><figure><figcaption>Legacy Moody chart with calculated route points.</figcaption></figure></section></main></body></html>',
  { language: "id", moody: { rows: [{ pipeId: "PIPE-1" }, { pipeId: "PIPE-2" }] } }
);
assert(fullTopologyHtml.includes('data-chart-count="2"'), "full-topology PDF must keep both active pipe Moody charts.");
assert(fullTopologyHtml.includes('data-pipe-id="PIPE-1"'), "full-topology PDF must include the PIPE-1 Moody chart.");
assert(fullTopologyHtml.includes('data-pipe-id="PIPE-2"'), "full-topology PDF must include the PIPE-2 Moody chart.");
assert(fullTopologyHtml.indexOf('data-pipe-id="PIPE-1"') < fullTopologyHtml.indexOf('data-pipe-id="PIPE-2"'), "full-topology PDF must preserve PIPE-1 then PIPE-2 chart order.");
assert(!fullTopologyHtml.includes("Legacy placeholder"), "full-topology PDF must still remove the old Moody placeholder.");
sandbox.connections = suctionOnlyConnections;
delete sandbox.globalModel["PIPE-2"];

const staleReport = {
  language: "id",
  sourceData: {
    primary: {
      pumpId: "P-100",
      sourceId: "SRC-100",
      sinkId: "SNK-100",
      trace: { path: { text: "Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 -> PIPE-2 -> SNK-100" } }
    }
  },
  passport: [["Primary sink", "SNK-100", "-", "Old sink"], ["Pump head", "32", "m", "Old head"]],
  discharge: { rows: [{ pipeId: "PIPE-2", role: "discharge path", totalLoss: 1.2 }], totalLoss: 1.2 },
  sink: { id: "SNK-100", status: "Old", readouts: ["old"], steps: ["old"], warnings: [] },
  pump: {
    steps: [{ title: "Old SNK system head", formula: "H_system = H_suction + H_discharge", substitution: "PIPE-2 + SNK-100", result: "old" }],
    results: { pumpHead: 32, dischargePressure: 4.2 },
    curveRows: [{ flow: 1 }]
  },
  routeRows: [
    { side: "Suction", objectId: "PIPE-1", from: "SRC-100", to: "P-100", loss: 0.014 },
    { side: "Discharge", objectId: "PIPE-2", from: "P-100", to: "SNK-100", loss: 1.2 }
  ],
  moody: { rows: [{ pipeId: "PIPE-1", role: "suction path" }, { pipeId: "PIPE-2", role: "discharge path" }] },
  requiredSections: ["Suction Pipe, Fitting, and Valve Calculation", "Discharge Pipe, Fitting, and Valve Calculation", "SNK Boundary Calculation"]
};
const sanitized = api.sanitizeReportForActiveTopology(staleReport);
assert.equal(sanitized.exportTopology.mode, "suction-only", "sanitized report must be marked suction-only.");
assert.equal(sanitized.sourceData.primary.sinkId, "", "stale primary sink id must be cleared.");
assert.equal(sanitized.discharge.rows.length, 0, "stale discharge rows must be cleared.");
assert.equal(sanitized.sink.id, "-", "stale sink report object must be cleared.");
assert.equal(sanitized.routeRows.length, 1, "route rows must contain only the active suction row.");
assert.equal(sanitized.moody.rows.length, 1, "Moody rows must contain only active suction pipe rows.");
assert.equal(sanitized.pump.steps.length, 0, "stale pump sequence steps that mention inactive objects must be removed.");
assert.equal(sanitized.pump.results.routeCalculationStatus, "Suction Only", "pump results must declare suction-only export status.");

const reversedDischargeReport = JSON.parse(JSON.stringify(staleReport));
sandbox.connections = [
  { from: "SRC-100", to: "P-100", pipeId: "PIPE-1", connectionType: "hydraulic" },
  { from: "SNK-100", to: "P-100", pipeId: "PIPE-2", connectionType: "hydraulic", hydraulicReversed: true }
];
const sanitizedReversedDischarge = api.sanitizeReportForActiveTopology(reversedDischargeReport);
assert.equal(sanitizedReversedDischarge.exportTopology.mode, "suction-only", "reversed discharge must be exported as suction-only, not full-route.");
assert.equal(sanitizedReversedDischarge.discharge.rows.length, 0, "reversed discharge must clear stale discharge rows.");
assert.equal(sanitizedReversedDischarge.sink.id, "-", "reversed discharge must clear stale sink report object.");
assert.deepEqual(sanitizedReversedDischarge.moody.rows.map(row => row.pipeId), ["PIPE-1"], "reversed discharge PDF must keep only suction Moody chart rows.");
const reversedDischargeHtml = api.professionalizeAppendixHtml(rawHtml, sanitizedReversedDischarge);
assert(!reversedDischargeHtml.includes("Discharge Pipe, Fitting, and Valve Calculation"), "reversed discharge PDF HTML must remove discharge section.");
assert(!reversedDischargeHtml.includes("SNK Boundary Calculation"), "reversed discharge PDF HTML must remove SNK section.");

const reversedSuctionReport = JSON.parse(JSON.stringify(staleReport));
sandbox.connections = [
  { from: "P-100", to: "SRC-100", pipeId: "PIPE-1", connectionType: "hydraulic", hydraulicReversed: true },
  { from: "P-100", to: "SNK-100", pipeId: "PIPE-2", connectionType: "hydraulic" }
];
const sanitizedReversedSuction = api.sanitizeReportForActiveTopology(reversedSuctionReport);
assert.equal(sanitizedReversedSuction.exportTopology.mode, "incomplete-route", "reversed suction must be exported as incomplete-route, not full-route.");
assert.equal(sanitizedReversedSuction.discharge.rows.length, 0, "reversed suction must clear stale discharge rows.");
assert.equal(sanitizedReversedSuction.routeRows.length, 0, "reversed suction must not keep stale route rows.");
assert.equal(sanitizedReversedSuction.moody.rows.length, 0, "reversed suction must not keep stale Moody rows.");
const reversedSuctionHtml = api.professionalizeAppendixHtml(rawHtml, sanitizedReversedSuction);
assert(reversedSuctionHtml.includes("hydraulic route is incomplete or reversed"), "reversed suction PDF must explain why downstream duty is omitted.");
assert(!reversedSuctionHtml.includes("PIPE-2 old downstream calculation"), "reversed suction PDF HTML must not leak stale discharge content.");
assert(!reversedSuctionHtml.includes("SNK-100 old sink calculation"), "reversed suction PDF HTML must not leak stale sink content.");

console.log("Export equation professional validation passed.");
