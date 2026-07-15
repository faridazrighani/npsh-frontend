#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-excel-calculation-trace-runtime.js");
const RUNTIME_ALIAS_FILE = path.join(FRONTEND_ROOT, "engineering-excel-calculation-trace-runtime-20260715-water-only-ph-sheets1.js");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const UPLOAD_READINESS_FILE = path.join(FRONTEND_ROOT, "UPLOAD_READINESS.md");
const E2E_FILE = path.join(FRONTEND_ROOT, "tests", "e2e", "excel-calculation-trace.spec.cjs");

const CACHE_KEY = "engineering-excel-calculation-trace-runtime-20260715-water-only-ph-sheets1.js?v=20260715-excel-water-only-ph-sheets2";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function createPipe(name, length, diameter, fittingK) {
  return {
    type: "pipe",
    name,
    props: {
      segments: [
        {
          name: `${name}-Seg-1`,
          length,
          diameter,
          roughness: 0.000045,
          fittingType: "Custom K",
          fittingQuantity: 1,
          fittingK,
          minorLoss: 0
        }
      ]
    }
  };
}

function twoPipeProject() {
  return {
    model: {
      FLUID: { type: "fluid", name: "Fluid Basis", props: { fluidName: "Water", temp: 90 } },
      SRC: { type: "source", name: "SRC-100", props: { flow: 39.68, pressure: 2.024, pressureInputBasis: "Absolute", elevation: 1.4 } },
      "PIPE-1": createPipe("PIPE-1", 46, 0.0635, 1.2),
      "P-100": {
        type: "pump",
        name: "P-100",
        props: { designNpshr: 1, suctionElevation: 0 },
        results: {
          flow: 39.68,
          npsha: 15.3476,
          npshr: 1,
          npshMargin: 14.3476,
          npshRatio: 15.3476,
          suctionLoss: 0.014,
          dischargeLoss: 0.2,
          vaporPressureHead: 7.411,
          suctionPressure: 2.155,
          requiredSystemHead: 26.9,
          dischargePressure: 4.72,
          npshEvaluation: {
            npsha: 15.3476,
            npshr: 1,
            npshMargin: 14.3476,
            npshRatio: 15.3476,
            suctionLoss: 0.014,
            dischargeLoss: 0.2,
            vaporPressureHead: 7.411,
            suctionPressure: 2.155,
            dischargePressure: 4.72,
            requiredSystemHead: 26.9
          }
        }
      },
      "PIPE-2": createPipe("PIPE-2", 24, 0.05, 2.1),
      "SNK-100": { type: "sink", name: "SNK-100", props: { demandFlow: 39.68, pressure: 3.936, pressureInputBasis: "Absolute", elevation: 8 } }
    },
    connections: [
      { from: "SRC", to: "P-100", pipeId: "PIPE-1", connectionType: "hydraulic" },
      { from: "P-100", to: "SNK-100", pipeId: "PIPE-2", connectionType: "hydraulic" }
    ]
  };
}

function projectWithFluid(fluidName) {
  const project = twoPipeProject();
  project.model.FLUID.props.fluidName = fluidName;
  return project;
}

(async () => {
  const runtimeSource = read(RUNTIME_FILE);
  const runtimeAliasSource = read(RUNTIME_ALIAS_FILE);
  const indexHtml = read(INDEX_FILE);
  const packageJson = JSON.parse(read(PACKAGE_FILE));
  const manifest = read(MANIFEST_FILE);
  const uploadReadiness = read(UPLOAD_READINESS_FILE);
  const e2eSource = read(E2E_FILE);

  assert.equal(runtimeAliasSource, runtimeSource, "cache-busted Excel Calculation Trace alias must exactly match the canonical runtime.");

  [
    "engineering-excel-calculation-trace.v6-water-only-ph-sheets",
    "20260715-excel-water-only-ph-sheets1",
    "exportScenarioCalculationTraceToExcel",
    "shouldIncludePressureEnthalpySheets",
    "sheetNamesForScenario",
    "Calculation Trace Inputs - single editable source",
    "OUTPUT PUMP",
    "OUTPUT PFV (Suction)",
    "OUTPUT PFV (Discharge)",
    "Fluid_Basis_Calc",
    "PH_Phase_Data",
    "PH_Phase_Chart",
    "Pressure-Enthalpy Phase Chart Data - formula generated",
    "Suction_PFV_Calc",
    "Discharge_PFV_Calc",
    "Moody_Suction",
    "Moody_Discharge",
    "NPSH_Calc",
    "Pump_Discharge_Calc",
    "Calculation_Sequence",
    "Native Excel chart is inserted below",
    "Solved calculation basis",
    "active.npsha",
    "active.suction.loss",
    "remains sensitive to SRC, Fluid Basis, and suction PFV inputs",
    "result: cachedResult",
    "P_vap = P_vap,ref x P_corr(T) / P_corr(T_ref)",
    "Darcy-Weisbach",
    "LOG10(L${row}/3.7+5.74",
    "NPSHa = H_P,SRC + H_z - h_L,suction - H_vap",
    "If Pipe 2 exists, a dedicated discharge PFV and Moody chart are generated",
    "addNativeCharts"
  ].forEach((needle) => assert(runtimeSource.includes(needle), `runtime must include ${needle}`));

  assert(!runtimeSource.includes("exportScenarioCalculationTraceToPdf"), "Excel trace runtime must not wrap PDF export.");
  assert(!runtimeSource.includes("exportScenarioCalculationTraceToDocx"), "Excel trace runtime must not expose DOCX export.");
  assert(!runtimeSource.includes("Pump Performance Curve"), "Excel trace runtime must not restore Pump Performance Curve content.");
  assert(!runtimeSource.includes("fetch("), "Excel trace runtime must not call backend/network APIs.");
  assert(!runtimeSource.includes("updateSimulation("), "Excel trace runtime must not trigger solver recalculation.");

  assert(indexHtml.includes(CACHE_KEY), "index.html must load the Excel calculation trace runtime.");
  assert(indexHtml.indexOf("app.bundle.min.js") < indexHtml.indexOf(CACHE_KEY), "Excel runtime must load after the protected bundle.");
  assert(indexHtml.indexOf("engineering-pdf-export-progress-runtime.js") < indexHtml.indexOf(CACHE_KEY), "Excel runtime must load after PDF progress runtime.");

  assert.equal(
    packageJson.scripts?.["validate:excel-calculation-trace"],
    "node tools/validate-excel-calculation-trace-runtime.cjs",
    "package.json must expose validate:excel-calculation-trace."
  );
  assert.equal(
    packageJson.scripts?.["validate:excel-calculation-trace-sensitivity"],
    "node tools/validate-excel-calculation-trace-sensitivity.cjs",
    "package.json must expose validate:excel-calculation-trace-sensitivity."
  );
  assert.equal(
    packageJson.scripts?.["test:e2e:excel-calculation-trace"],
    "playwright test tests/e2e/excel-calculation-trace.spec.cjs",
    "package.json must expose test:e2e:excel-calculation-trace."
  );

  [
    "engineering-excel-calculation-trace-runtime.js public-safe",
    "engineering-excel-calculation-trace-runtime-20260715-water-only-ph-sheets1.js cache-busted production alias",
    `Excel calculation trace runtime cache key: ${CACHE_KEY}`,
    "Excel calculation trace validation: npm run validate:excel-calculation-trace",
    "Excel calculation trace sensitivity validation: npm run validate:excel-calculation-trace-sensitivity",
    "Excel calculation trace E2E: npm run test:e2e:excel-calculation-trace"
  ].forEach((needle) => assert(manifest.includes(needle), `FILE_MANIFEST must include ${needle}`));
  assert(uploadReadiness.includes("Excel calculation trace validation, Excel COM sensitivity validation, and E2E passed"), "UPLOAD_READINESS must lock Excel calculation trace verification.");

  [
    "Excel Calculation Trace (.xlsx)",
    "waitForEvent('download')",
    "PH_Phase_Chart",
    "omits both P-H sheets for non-Water Fluid Basis",
    "Moody_Discharge",
    "xl/charts/chart",
    "LOG10",
    "NPSHa"
  ].forEach((needle) => assert(e2eSource.includes(needle), `E2E must verify ${needle}`));

  const api = require(RUNTIME_FILE);
  assert.equal(api.version, "engineering-excel-calculation-trace.v6-water-only-ph-sheets", "runtime API version mismatch.");
  assert.equal(api.cacheKey, "20260715-excel-water-only-ph-sheets1", "runtime API cache key mismatch.");
  assert.equal(typeof api.createWorkbook, "function", "runtime must expose createWorkbook.");
  assert.equal(typeof api.buildXlsxBuffer, "function", "runtime must expose buildXlsxBuffer.");
  assert.equal(typeof api.shouldIncludePressureEnthalpySheets, "function", "runtime must expose the P-H sheet eligibility rule.");

  const JSZip = require(path.join(FRONTEND_ROOT, "vendor", "jszip.min.js"));
  const workbook = await api.createWorkbook(twoPipeProject());
  const sheetNames = workbook.worksheets.map((worksheet) => worksheet.name);
  [
    "Inputs",
    "Fluid_Basis_Calc",
    "PH_Phase_Data",
    "PH_Phase_Chart",
    "Suction_PFV_Calc",
    "Moody_Suction",
    "Discharge_PFV_Calc",
    "Moody_Discharge",
    "NPSH_Calc",
    "Pump_Discharge_Calc",
    "Calculation_Sequence"
  ].forEach((name) => assert(sheetNames.includes(name), `workbook must include ${name}`));
  assert.equal(workbook.__engineeringChartDefs.length, 3, "workbook must define P-H, suction Moody, and discharge Moody charts.");

  assert.equal(api.shouldIncludePressureEnthalpySheets(api.collectScenario(twoPipeProject())), true, "Water must include both P-H sheets.");
  for (const fluidName of ["Methanol", "Custom Fluid"]) {
    const nonWaterProject = projectWithFluid(fluidName);
    const nonWaterScenario = api.collectScenario(nonWaterProject);
    assert.equal(api.shouldIncludePressureEnthalpySheets(nonWaterScenario), false, `${fluidName} must not include P-H sheets.`);
    assert(!api.sheetNamesForScenario(nonWaterScenario).includes("PH_Phase_Data"), `${fluidName} metadata must omit PH_Phase_Data.`);
    assert(!api.sheetNamesForScenario(nonWaterScenario).includes("PH_Phase_Chart"), `${fluidName} metadata must omit PH_Phase_Chart.`);

    const nonWaterWorkbook = await api.createWorkbook(nonWaterProject);
    const nonWaterSheetNames = nonWaterWorkbook.worksheets.map((worksheet) => worksheet.name);
    assert(!nonWaterSheetNames.includes("PH_Phase_Data"), `${fluidName} workbook must not create PH_Phase_Data.`);
    assert(!nonWaterSheetNames.includes("PH_Phase_Chart"), `${fluidName} workbook must not create PH_Phase_Chart.`);
    assert.equal(nonWaterWorkbook.__engineeringChartDefs.length, 2, `${fluidName} workbook must define only suction and discharge Moody charts.`);

    const nonWaterBuffer = await api.buildXlsxBuffer(nonWaterProject);
    const nonWaterZip = await JSZip.loadAsync(nonWaterBuffer);
    const nonWaterWorkbookXml = await nonWaterZip.file("xl/workbook.xml").async("string");
    assert(!nonWaterWorkbookXml.includes("PH_Phase_Data"), `${fluidName} workbook XML must omit PH_Phase_Data.`);
    assert(!nonWaterWorkbookXml.includes("PH_Phase_Chart"), `${fluidName} workbook XML must omit PH_Phase_Chart.`);
    const nonWaterChartFiles = Object.keys(nonWaterZip.files).filter((file) => /^xl\/charts\/chart\d+\.xml$/.test(file));
    assert.equal(nonWaterChartFiles.length, 2, `${fluidName} xlsx must contain only two Moody chart XML parts.`);
    const nonWaterChartXml = (await Promise.all(nonWaterChartFiles.map((file) => nonWaterZip.file(file).async("string")))).join("\n");
    assert(!nonWaterChartXml.includes("Pressure-enthalpy phase chart"), `${fluidName} chart XML must omit the P-H chart.`);
    assert(!nonWaterChartXml.includes("PH_Phase_Data"), `${fluidName} chart XML must not reference P-H data.`);

    const exportResult = await api.exportScenarioCalculationTraceToExcel({ state: nonWaterProject, download: false });
    assert.equal(exportResult.chartCount, 2, `${fluidName} export metadata must report two charts.`);
    assert(!exportResult.sheets.includes("PH_Phase_Data"), `${fluidName} export metadata must omit PH_Phase_Data.`);
    assert(!exportResult.sheets.includes("PH_Phase_Chart"), `${fluidName} export metadata must omit PH_Phase_Chart.`);
  }

  const buffer = await api.buildXlsxBuffer(twoPipeProject());
  const zip = await JSZip.loadAsync(buffer);
  const chartFiles = Object.keys(zip.files).filter((file) => /^xl\/charts\/chart\d+\.xml$/.test(file));
  assert.equal(chartFiles.length, 3, "xlsx must contain three native chart XML parts.");

  const workbookXml = await zip.file("xl/workbook.xml").async("string");
  assert(workbookXml.includes("PH_Phase_Chart"), "workbook XML must contain PH_Phase_Chart.");
  assert(workbookXml.includes("Moody_Discharge"), "workbook XML must contain Moody_Discharge.");

  const sharedStringsXml = await zip.file("xl/sharedStrings.xml").async("string");
  assert(sharedStringsXml.includes("OUTPUT PUMP"), "Inputs sheet must include the pump output dashboard header.");
  assert(sharedStringsXml.includes("OUTPUT PFV (Suction)"), "Inputs sheet must include the suction PFV output dashboard header.");
  assert(sharedStringsXml.includes("OUTPUT PFV (Discharge)"), "Inputs sheet must include the discharge PFV output dashboard header.");

  const allSheetXml = (
    await Promise.all(
      Object.keys(zip.files)
        .filter((file) => /^xl\/worksheets\/sheet\d+\.xml$/.test(file))
        .map((file) => zip.file(file).async("string"))
    )
  ).join("\n");
  assert(allSheetXml.includes("LOG10"), "worksheet formulas must include log-scale and Darcy/Moody LOG10 equations.");
  assert(allSheetXml.includes("IF(C9&gt;0,C8/C9"), "worksheet formulas must include NPSH ratio.");
  assert(allSheetXml.includes("1000*(1-(((C4+288.9414)"), "worksheet formulas must include density correlation.");
  assert(allSheetXml.includes("ISNUMBER"), "worksheet formulas must include automatic resolved-value guards.");
  assert(allSheetXml.includes("C4+C5-C6-C7"), "worksheet formulas must retain component NPSHa recalculation fallback.");
  assert(allSheetXml.includes("<f>NPSH_Calc!C8</f>"), "Inputs dashboard must link NPSHa to the NPSH calculation sheet.");
  assert(allSheetXml.includes("<f>Suction_PFV_Calc!C8</f>"), "Inputs dashboard must link suction PFV total loss to the suction PFV sheet.");
  assert(allSheetXml.includes("<f>Discharge_PFV_Calc!C8</f>"), "Inputs dashboard must link discharge PFV total loss to the discharge PFV sheet.");
  assert(allSheetXml.includes("<f>Pump_Discharge_Calc!C6</f>"), "Inputs dashboard must link required pump head to the pump discharge sheet.");
  assert(!runtimeSource.includes("trace.useAppSolvedBasis"), "runtime must not expose non-engineering trace-control inputs.");
  assert(!runtimeSource.includes("Trace control"), "runtime must not write Trace control rows.");
  assert(!runtimeSource.includes("Use application solved/displayed basis"), "runtime must not expose application solved/displayed toggle copy.");
  assert(!runtimeSource.includes("trace-control toggle"), "runtime must not document a trace-control toggle.");
  [
    "<v>15.3476</v>",
    "<v>14.3476</v>",
    "<v>0.014</v>",
    "<v>0.2</v>",
    "<v>4.72</v>",
    "<v>26.9</v>"
  ].forEach((needle) => assert(allSheetXml.includes(needle), `xlsx must cache application result ${needle} for immediate display parity.`));

  const chartXml = (await Promise.all(chartFiles.map((file) => zip.file(file).async("string")))).join("\n");
  assert(chartXml.includes("Pressure-enthalpy phase chart"), "native charts must include P-H chart title.");
  assert(chartXml.includes("PH_Phase_Data"), "P-H native chart must reference formula-backed P-H data.");
  assert(chartXml.includes("Moody_Suction"), "native charts must reference suction Moody data.");
  assert(chartXml.includes("Moody_Discharge"), "native charts must reference discharge Moody data for Pipe 2.");
  assert(chartXml.includes("logBase"), "native charts must use log axes where required.");

  console.log("Excel calculation trace runtime validation passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
