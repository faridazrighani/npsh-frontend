const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-analysis-report-live-runtime.js");
const MANIFEST_FILE = path.join(FRONTEND_ROOT, "FILE_MANIFEST.md");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const CASE_FILE = path.join(FRONTEND_ROOT, "journals", "simulasi_1", "simulasi_performansi_pompa_air_umpan_tangki_deaerator.untirta");
const LOGO_FILE = path.join(FRONTEND_ROOT, "png", "untirta-universitas-sultanagengtirtayasa880x870.png");
const CACHE_KEY = "engineering-analysis-report-live-runtime.js?v=20260621-analysis-report-design-contract1";
const VERSION = "2026.06-analysis-report-live13";
const UNTIRTA_MAGIC = "UNTIRTA-NPSH-V1\n";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(filePath, encoding = "utf8") {
  return fs.readFileSync(filePath, encoding);
}

function readUntirtaProject(filePath) {
  const file = read(filePath, null);
  const magic = Buffer.from(UNTIRTA_MAGIC, "utf8");
  assert(file.subarray(0, magic.length).equals(magic), `${filePath} is not an UNTIRTA project file.`);
  const headerLength = Number.parseInt(file.subarray(magic.length, magic.length + 8).toString("ascii"), 16);
  assert(Number.isFinite(headerLength) && headerLength > 0, `${filePath} has an invalid UNTIRTA header length.`);
  const headerOffset = magic.length + 8;
  const payloadOffset = headerOffset + headerLength;
  const header = JSON.parse(file.subarray(headerOffset, payloadOffset).toString("utf8"));
  let payload = file.subarray(payloadOffset, payloadOffset + header.payloadBytes);
  if (header.compression === "gzip") payload = zlib.gunzipSync(payload);
  const project = JSON.parse(payload.toString("utf8"));
  assert(project.model, `${filePath} does not contain a project model.`);
  return project;
}

function loadRuntime(runtimeSource, model, documentOverride = null) {
  const fakeBody = { querySelectorAll: () => [] };
  const fakeDocument = documentOverride || {
    documentElement: { dataset: {} },
    body: fakeBody,
    addEventListener: () => {},
    querySelectorAll: () => []
  };
  const sandbox = {
    console,
    document: fakeDocument,
    globalModel: model,
    __npshGlobalModel: model,
    MutationObserver: class {
      observe() {}
    },
    TextEncoder,
    Uint8Array,
    Uint32Array,
    DataView,
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    addEventListener: () => {}
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(runtimeSource, sandbox, { filename: RUNTIME_FILE });
  return sandbox.EngineeringAnalysisReportLiveRuntime;
}

function normalizeMetric(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+\/\s+/g, " / ")
    .trim()
    .toLowerCase();
}

class FakeClassList {
  constructor(classes = []) {
    this.classes = new Set(classes);
  }

  contains(className) {
    return this.classes.has(className);
  }
}

class FakeCell {
  constructor(text, tagName = "td", dataset = {}) {
    this.textContent = text;
    this.tagName = tagName.toUpperCase();
    this.dataset = { ...dataset };
    this.title = "";
  }
}

class FakeRow {
  constructor(cells, parentName = "tbody") {
    this.cells = cells;
    this.parentName = parentName;
  }

  querySelector(selector) {
    return selector === "th" && this.cells.some((cell) => cell.tagName === "TH") ? this.cells.find((cell) => cell.tagName === "TH") : null;
  }

  closest(selector) {
    return selector === "thead" && this.parentName === "thead" ? this : null;
  }
}

class FakeTable {
  constructor({ headers, rows, section }) {
    this.section = section;
    this.headerRow = new FakeRow(headers.map((header) => new FakeCell(header.text, "th", header.dataset || {})), "thead");
    this.tHead = { rows: [this.headerRow] };
    this.rows = rows.map((row) => new FakeRow(row, "tbody"));
  }

  querySelector(selector) {
    return selector === "tr" ? this.headerRow : null;
  }

  querySelectorAll(selector) {
    if (selector === "tbody tr, tr") return [...this.rows, this.headerRow];
    return [];
  }

  closest(selector) {
    return /section|article|journal-analysis-card|fluid-help-card|task-window-body/.test(selector) ? this.section : null;
  }
}

class FakeSection {
  constructor(textContent) {
    this.textContent = textContent;
    this.tables = [];
  }

  querySelectorAll(selector) {
    return selector === "table" ? this.tables : [];
  }
}

function createReportDocument() {
  const section = new FakeSection("Laporan Analisis Data Input & Hasil Aplikasi Perbandingan Jurnal vs Aplikasi");
  const comparisonTable = new FakeTable({
    section,
    headers: [
      { text: "Metrik", dataset: { i18nDataLabelFallback: "Metric" } },
      { text: "Jurnal", dataset: { i18nDataLabelFallback: "Journal" } },
      { text: "Aplikasi", dataset: { i18nDataLabelFallback: "Application" } },
      { text: "Error", dataset: { i18nDataLabelFallback: "Error" } },
      { text: "Status", dataset: { i18nDataLabelFallback: "Status" } }
    ],
    rows: [
      [
        new FakeCell("Fluid Basis - Temperature"),
        new FakeCell("100 deg C"),
        new FakeCell("100 deg C"),
        new FakeCell("0.00%"),
        new FakeCell("OK")
      ],
      [
        new FakeCell("Pump - Pump head evaluated"),
        new FakeCell("24 m"),
        new FakeCell("24 m"),
        new FakeCell("0.00%"),
        new FakeCell("OK")
      ],
      [
        new FakeCell("Pump - Suction Nozzle Elev."),
        new FakeCell("-0.5 m"),
        new FakeCell("legacy label"),
        new FakeCell("-"),
        new FakeCell("OK")
      ],
      [
        new FakeCell("Trailing Dash Numeric"),
        new FakeCell("12.5 m -"),
        new FakeCell("12.625 m -"),
        new FakeCell("-"),
        new FakeCell("OK")
      ]
    ]
  });
  const applicationTable = new FakeTable({
    section,
    headers: [
      { text: "Metrik", dataset: { i18nDataLabelFallback: "Metric" } },
      { text: "Nilai", dataset: { i18nDataLabelFallback: "Value" } },
      { text: "Sumber", dataset: { i18nDataLabelFallback: "Source" } }
    ],
    rows: [
      [
        new FakeCell("Fluid Basis - Kinematic viscosity", "th"),
        new FakeCell("0.803 cSt"),
        new FakeCell("Static report")
      ],
      [
        new FakeCell("Pump - NPSHa", "th"),
        new FakeCell("6.4656 m"),
        new FakeCell("Static report")
      ]
    ]
  });
  section.tables.push(comparisonTable, applicationTable);
  return {
    documentElement: { dataset: {} },
    body: section,
    addEventListener: () => {},
    querySelectorAll: () => [section],
    comparisonTable,
    applicationTable
  };
}

function metricText(metrics, label) {
  const value = metrics.get(label.toLowerCase());
  assert(value, `Missing live metric: ${label}`);
  return value.text;
}

const index = read(INDEX_FILE);
const runtime = read(RUNTIME_FILE);
const manifest = read(MANIFEST_FILE);
const packageJson = JSON.parse(read(PACKAGE_FILE));
const project = readUntirtaProject(CASE_FILE);
const api = loadRuntime(runtime, project.model);

assert(index.includes(CACHE_KEY), "index.html must load the cache-busted Analysis Report live runtime.");
assert(runtime.includes(`const VERSION = '${VERSION}'`), "Analysis Report live runtime version must match the cache key.");
assert(runtime.includes("collectLiveMetrics"), "Runtime must collect live model metrics.");
assert(runtime.includes("__npshLastBackendSimulationResponse"), "Runtime must be able to read latest backend response context.");
assert(runtime.includes("MutationObserver"), "Runtime must refresh when report windows are inserted.");
assert(runtime.includes("patchUpdateSimulation"), "Runtime must hook updateSimulation for realtime calculation refreshes.");
assert(runtime.includes("npsh:calculation-state-updated"), "Runtime must refresh when canonical calculation state changes.");
assert(runtime.includes("const REFRESH_MS = 3000"), "Analysis Report runtime interval must be reduced for lower background load.");
assert(runtime.includes("const ACTIVE_SELECTOR = '.journal-analysis-task-window, .journal-analysis-report-panel'"), "Analysis Report runtime must not scan every generic task window.");
assert(runtime.includes("hasActiveReportSurface"), "Runtime must avoid refreshing when no Analysis Report surface is visible.");
assert(!runtime.includes("ACTIVE_SELECTOR = '.journal-analysis-task-window, .journal-analysis-report-panel, .task-window'"), "Runtime must not target broad .task-window surfaces.");
assert(runtime.includes("trace.segmentRows || trace.segments"), "Runtime must prefer canonical pipe segment rows when reading pipe trace steps.");
assert(runtime.includes("pipeEndpointElevation"), "Runtime must expose PFV endpoint elevation mapping for pipe-managed elevations.");
assert(runtime.includes("updateComparisonTable"), "Runtime must update existing comparison table cells.");
assert(runtime.includes("updateApplicationValueTable"), "Runtime must update existing application value table cells when present.");
assert(runtime.includes("setCellText"), "Runtime must patch cell text instead of rebuilding report layout.");
assert(runtime.includes("row.closest?.('thead')"), "Runtime must update data rows that use TH metric cells and only skip THEAD rows.");
assert(runtime.includes("installResponsiveCss"), "Runtime must install scoped Analysis Report responsive CSS.");
assert(runtime.includes("engineeringAnalysisReportLiveResponsiveStyle"), "Runtime must use a stable responsive CSS marker.");
assert(runtime.includes("installAnalysisReportExportButtons"), "Runtime must install Analysis Report XLSX export controls.");
assert(runtime.includes("downloadAnalysisReportXlsx"), "Runtime must expose Analysis Report XLSX download behavior.");
assert(runtime.includes("collectAnalysisReportWorkbook"), "Runtime must collect visible Analysis Report DOM content for export.");
assert(runtime.includes("buildXlsxBytes"), "Runtime must build XLSX bytes without adding an eager spreadsheet dependency.");
assert(runtime.includes("button.dataset.analysisReportXlsxExport"), "Runtime must mark the Analysis Report export button for browser validation.");
assert(runtime.includes("Case Status Summary"), "Runtime must preserve a dedicated Case Status Summary export sheet.");
assert(runtime.includes("Journal vs Application Comparis"), "Runtime must use the Excel-safe Journal vs Application sheet name.");
assert(runtime.includes("const rowNumber = rows.length + 8"), "Runtime must align XLSX Error formulas with the exported table row numbers.");
assert(runtime.includes("IFERROR(ABS(D${rowNumber}-C${rowNumber})/ABS(C${rowNumber})"), "Runtime must use the % Error formula pattern in the Error column.");
assert(runtime.includes("ANALYSIS_REPORT_LOGO_PATH"), "Runtime must resolve the Analysis Report XLSX logo from the frontend png folder.");
assert(runtime.includes("untirta-universitas-sultanagengtirtayasa880x870.png"), "Runtime must use the UNTIRTA logo asset for XLSX branding.");
assert(runtime.includes("loadAnalysisReportLogoBytes"), "Runtime must lazy-load the XLSX logo only during export.");
assert(runtime.includes("xl/media/image1.png"), "Runtime must package the UNTIRTA logo in the XLSX media folder.");
assert(runtime.includes("xl/drawings/drawing"), "Runtime must package XLSX drawing anchors for logo/header branding.");
assert(runtime.includes("normalizeExportNumericText"), "Runtime must normalize trailing-dash numeric export values.");
assert(runtime.includes("styles.xml"), "Runtime must include workbook styles for XLSX layout formatting.");
assert(runtime.includes(".journal-analysis-task-window .academic-equation-math"), "Runtime responsive CSS must target Analysis Report formula nodes.");
assert(runtime.includes("white-space: normal !important"), "Runtime responsive CSS must allow long report formulas to wrap.");
assert(runtime.includes("overflow-wrap: anywhere"), "Runtime responsive CSS must break long report route/formula traces inside the panel.");
assert(runtime.includes("data input\\s*&\\s*hasil aplikasi"), "Runtime must recognize Indonesian Analysis Report application-data headings.");
assert(runtime.includes("setPipeGroup('Pipe Suction'") && runtime.includes("${prefix} - Total Head Loss"), "Runtime must include suction pipe total-loss metric mapping.");
assert(runtime.includes("setPipeGroup('Pipe Discharge'") && runtime.includes("${prefix} - Total Head Loss"), "Runtime must include discharge pipe total-loss metric mapping.");
assert(runtime.includes("Pipe Discharge - PFV Start Elevation"), "Runtime must report discharge elevation from PFV start endpoint.");
assert(runtime.includes("Pipe Discharge - PFV End Elevation"), "Runtime must report discharge elevation from PFV end endpoint.");
assert(runtime.includes("METRIC_LABEL_RENAMES"), "Runtime must rename legacy report labels to current engineering labels.");
assert(runtime.includes("Pump - Pump Datum Elev."), "Runtime must expose Pump Datum Elev. as the pump NPSH datum metric.");
assert(!runtime.includes("set('Pump - Elevation'"), "Runtime must not expose deprecated pump Elevation in live report metrics.");
assert(!runtime.includes("Pump - Discharge Nozzle Elev."), "Runtime must not expose deprecated pump Discharge Nozzle Elev. in live report metrics.");
assert(!runtime.includes("Pump - Elevation / Nozzle Elevations"), "Runtime must not expose deprecated combined pump elevation metric.");
assert(runtime.includes("Pump - NPSHa"), "Runtime must include pump NPSHa metric mapping.");
assert(runtime.includes("Pump - Maximum Allowable NPSHr"), "Runtime must include maximum allowable NPSHr metric mapping.");
assert(runtime.includes("calculatedNpshStatus"), "Runtime must derive hydraulic NPSH status when stale backend status says Input Required.");
assert(runtime.includes("NPSHr,max"), "Runtime must document the maximum allowable NPSHr concept in report metric mapping.");
assert(runtime.includes("Outlet Readout - Boundary Abs. Pressure"), "Runtime must include outlet boundary readout mapping.");
assert(!runtime.includes("innerHTML ="), "Runtime must not replace table/report layout through innerHTML.");

assert(api && api.version === VERSION, "Runtime API must expose the Analysis Report live version.");
assert(typeof api.collectLiveMetrics === "function", "Runtime API must expose live metric collection.");
assert(typeof api.refresh === "function", "Runtime API must expose a refresh function.");
assert(typeof api.installResponsiveCss === "function", "Runtime API must expose responsive CSS installation for browser checks.");
assert(typeof api.installAnalysisReportExportButtons === "function", "Runtime API must expose XLSX export button installation.");
assert(typeof api.collectAnalysisReportWorkbook === "function", "Runtime API must expose Analysis Report workbook collection.");
assert(typeof api.buildXlsxBytes === "function", "Runtime API must expose XLSX byte generation for validation.");
assert(typeof api.loadAnalysisReportLogoBytes === "function", "Runtime API must expose lazy logo loading for branded XLSX export.");
assert(typeof api.downloadAnalysisReportXlsx === "function", "Runtime API must expose Analysis Report XLSX download.");
assert(typeof api.hasActiveReportSurface === "function", "Runtime API must expose visible Analysis Report surface detection.");

const metrics = api.collectLiveMetrics();
assert(metrics && typeof metrics.get === "function" && metrics.size > 40, "Runtime must collect a broad live metric set from the current case.");

assert(metricText(metrics, "Fluid Basis - Temperature").includes("100 deg C"), "Temperature must come from Fluid Basis.");
assert(metricText(metrics, "Fluid Basis - Kinematic viscosity").includes("8.0300e-7 m2/s"), "Comparison kinematic viscosity must use m2/s.");
assert(metrics.get("fluid basis - kinematic viscosity").valueText.includes("0.803 cSt"), "Application value view must retain cSt viscosity.");
assert(metricText(metrics, "Pipe Suction - Total head loss").includes("2.615534 m"), "Suction total loss must come from pipe trace totals.");
assert(metricText(metrics, "Pipe Discharge - Total head loss").includes("11.668509 m"), "Discharge total loss must come from pipe trace totals.");
assert(metricText(metrics, "Pipe Suction - PFV Start Elevation").includes("0 m"), "Suction PFV start elevation must come from the pipe endpoint.");
assert(metricText(metrics, "Pipe Suction - PFV End Elevation").includes("-0.5 m"), "Suction PFV end elevation must come from the pipe endpoint.");
assert(metricText(metrics, "Pipe Discharge - PFV Start Elevation").includes("0 m"), "Discharge PFV start elevation must come from the pipe endpoint.");
assert(metricText(metrics, "Pipe Discharge - PFV End Elevation").includes("10 m"), "Discharge PFV end elevation must come from the pipe endpoint.");
assert(metricText(metrics, "Pump - Pump Datum Elev.").includes("-0.5 m"), "Pump datum elevation must remain available for NPSH datum checks.");
assert(!metrics.has("pump - elevation"), "Live metrics must omit deprecated Pump - Elevation.");
assert(!metrics.has("pump - suction nozzle elev."), "Live metrics must omit old Pump - Suction Nozzle Elev. as an active metric.");
assert(!metrics.has("pump - discharge nozzle elev."), "Live metrics must omit deprecated Pump - Discharge Nozzle Elev.");
assert(metricText(metrics, "Pump - NPSHa").includes("6.4656 m"), "Pump NPSHa must come from pump NPSH results.");
assert(metricText(metrics, "Pump - Required NPSHa").includes("3.0002 m"), "Pump required NPSHa must be available from live or computed NPSH criteria.");
assert(metricText(metrics, "Pump - Maximum Allowable NPSHr").includes("5.8656 m"), "Pump maximum allowable NPSHr must be calculated from NPSHa and margin basis.");
assert(metricText(metrics, "Pump - Route Calculation Status") === "Calculated", "Pump route calculation status must not be blocked by pump curve development.");
assert(metricText(metrics, "Pump - Pump head evaluated").includes("24 m"), "Pump evaluated head must come from solved pump/system head.");
assert(metricText(metrics, "SNK - Reference pressure").includes("Ignored in Flow Demand Boundary"), "SNK reference pressure must be marked ignored when Flow Demand Boundary is active.");
assert(metricText(metrics, "Outlet Readout - Vapor margin").includes("7.76"), "Outlet vapor margin must be recalculated from live pressure and Fluid Basis.");

const changedProject = JSON.parse(JSON.stringify(project));
changedProject.model.FLUID.props.temp = 80;
changedProject.model.FLUID.props.viscosity = 0.355;
changedProject.model.FLUID.props.dynViscosity = 0.344;
changedProject.model["P-100"].results.npshEvaluation.npsha = 7.123456;
changedProject.model["P-100"].results.npshEvaluation.pumpHead = 31.127;
changedProject.model["P-100"].results.requiredSystemHead = 31.127;
const reportDocument = createReportDocument();
const liveDomApi = loadRuntime(runtime, changedProject.model, reportDocument);
const changedCells = liveDomApi.refresh();
assert(changedCells >= 4, "Refresh must update comparison and application-value table cells in an open Analysis Report.");
assert(
  reportDocument.comparisonTable.rows[0].cells[2].textContent === "80 deg C",
  "Comparison table Application cell must refresh from current Fluid Basis temperature."
);
assert(
  reportDocument.comparisonTable.rows[1].cells[2].textContent === "31.127 m",
  "Comparison table Application cell must refresh from current pump calculation result."
);
assert(
  reportDocument.comparisonTable.rows[2].cells[0].textContent === "Pump - Pump Datum Elev.",
  "Comparison table legacy suction-nozzle label must be renamed to Pump Datum Elev."
);
assert(
  reportDocument.comparisonTable.rows[2].cells[2].textContent === "-0.5 m",
  "Comparison table legacy suction-nozzle value must refresh from the pump datum elevation."
);
assert(
  reportDocument.applicationTable.rows[0].cells[1].textContent === "0.355 cSt",
  "Application Input & Result Data table must refresh rows that use TH metric cells."
);
assert(
  reportDocument.applicationTable.rows[1].cells[1].textContent === "7.123456 m",
  "Application Input & Result Data table must refresh NPSHa from current pump calculation result."
);
const collectedWorkbook = liveDomApi.collectAnalysisReportWorkbook(reportDocument.body);
const trailingDashRow = collectedWorkbook.sheets[1].rows.find((row) => row[0] === "Trailing Dash Numeric");
assert(trailingDashRow, "Workbook collection must include the trailing-dash numeric validation row.");
assert(trailingDashRow[2] === 12.5, "Journal trailing-dash numeric values must export as numbers.");
assert(trailingDashRow[3] === 12.625, "Application trailing-dash numeric values must export as numbers.");
assert(
  trailingDashRow[4]?.formula && /IFERROR\(ABS\(D\d+-C\d+\)\/ABS\(C\d+\)/.test(trailingDashRow[4].formula),
  "Trailing-dash numeric rows must retain the % Error formula."
);

const workbookBytes = api.buildXlsxBytes({
  title: "Analysis Report",
  logoBytes: read(LOGO_FILE, null),
  sheets: [
    {
      name: "Report Text",
      type: "reportText",
      rows: [
        ["H3", "Case Status Summary"],
        ["LI", "Application recalculation gives required head and NPSH values."],
        [],
        ["H3", "Findings"],
        ["LI", "NPSHr remains manual journal input."]
      ]
    },
    {
      name: "Journal vs Application Comparis",
      type: "comparison",
      rows: [
        ["Metric", "unit", "Journal", "Application", "Error", "Status"],
        ["Pump - NPSHa", "m", 6.4656, 7.123456, { formula: 'IFERROR(ABS(D9-C9)/ABS(C9),"")', style: "error" }, "Review"]
      ]
    }
  ]
});
assert(workbookBytes instanceof Uint8Array, "XLSX builder must return Uint8Array bytes.");
assert(workbookBytes.length > 70000, "XLSX builder must produce a branded workbook archive with the logo media.");
assert(Buffer.from(workbookBytes.subarray(0, 4)).toString("hex") === "504b0304", "XLSX export must be a ZIP/OpenXML workbook.");
const workbookZipBytes = Buffer.from(workbookBytes);
assert(workbookZipBytes.includes(Buffer.from("xl/media/image1.png")), "XLSX export must include the UNTIRTA logo media file.");
assert(workbookZipBytes.includes(Buffer.from("xl/drawings/drawing1.xml")), "XLSX export must include the first worksheet drawing.");
assert(workbookZipBytes.includes(Buffer.from("xl/worksheets/_rels/sheet1.xml.rels")), "XLSX export must include worksheet drawing relationships.");
assert(workbookZipBytes.includes(Buffer.from("fullCalcOnLoad")), "XLSX export must ask spreadsheet apps to recalculate formulas on open.");

assert(
  packageJson.scripts?.["validate:analysis-report-live-runtime"] === "node tools/validate-analysis-report-live-runtime.cjs",
  "package.json must expose validate:analysis-report-live-runtime."
);
assert(
  manifest.includes(`Analysis Report live runtime cache key: ${CACHE_KEY}`),
  "Manifest must document the Analysis Report live runtime cache key."
);
assert(
  manifest.includes("Analysis Report live runtime validation: npm run validate:analysis-report-live-runtime"),
  "Manifest must document Analysis Report live runtime validation."
);

console.log("Analysis Report live runtime validation passed.");
