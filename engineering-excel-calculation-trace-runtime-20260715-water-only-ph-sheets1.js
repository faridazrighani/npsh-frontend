/*
 * Engineering Excel Calculation Trace Runtime
 * Public-safe Menu -> File -> Export Excel Calculation Trace (.xlsx) override.
 * Builds a compact, formula-driven engineering workbook from the active model state.
 */
(function installEngineeringExcelCalculationTraceRuntime(rootFactory) {
  const root = typeof window !== "undefined" ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringExcelCalculationTraceRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(function createEngineeringExcelCalculationTraceRuntime(root) {
  "use strict";

  const VERSION = "engineering-excel-calculation-trace.v6-water-only-ph-sheets";
  const CACHE_KEY = "20260715-excel-water-only-ph-sheets1";
  const G = 9.80665;
  const ATM_BAR = 1.01325;
  const MAX_SEGMENTS = 6;
  const INPUT_SHEET = "Inputs";
  const SHEETS = Object.freeze({
    inputs: INPUT_SHEET,
    fluid: "Fluid_Basis_Calc",
    phData: "PH_Phase_Data",
    phChart: "PH_Phase_Chart",
    suction: "Suction_PFV_Calc",
    moodySuction: "Moody_Suction",
    npsh: "NPSH_Calc",
    discharge: "Discharge_PFV_Calc",
    moodyDischarge: "Moody_Discharge",
    pumpDischarge: "Pump_Discharge_Calc",
    sequence: "Calculation_Sequence"
  });

  const DEFAULT_SEGMENT = {
    name: "Segment 1",
    length: 10,
    diameter: 0.05,
    roughness: 0.000045,
    fittingQuantity: 0,
    fittingK: 0,
    minorLoss: 0
  };

  const FITTING_K = Object.freeze({
    "Sharp-edged entrance": 0.5,
    "Reentrant entrance": 0.8,
    "Well-rounded entrance": 0.03,
    "Submerged exit": 1,
    "90 smooth bend - flanged": 0.3,
    "90 elbow - threaded": 0.9,
    "90 miter bend - no vanes": 1.1,
    "90 miter bend - with vanes": 0.2,
    "45 elbow - threaded": 0.4,
    "180 return bend - flanged": 0.2,
    "Tee - line flow flanged": 0.2,
    "Tee - branch flow flanged": 1,
    "Threaded union": 0.08,
    "90 elbow - long radius flanged": 0.2,
    "90 elbow - short radius flanged": 0.5,
    "45 elbow - flanged": 0.2,
    "Concentric reducer - gradual": 0.15,
    "Sudden contraction": 0.5,
    "Sudden expansion": 1,
    "Y-strainer - clean": 2,
    "Basket strainer - clean": 1.5,
    "Gate valve - fully open": 0.2,
    "Globe valve - fully open": 10,
    "Angle valve - fully open": 5,
    "Ball valve - fully open": 0.05,
    "Butterfly valve - fully open": 0.4,
    "Plug valve - fully open": 0.4,
    "Control valve - generic open": 10,
    "Swing check valve": 2
  });

  let originalExport = null;

  function toNumber(value, fallback = 0) {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function firstNumber(values, fallback = 0) {
    for (const value of values) {
      const numeric = Number.parseFloat(value);
      if (Number.isFinite(numeric)) return numeric;
    }
    return fallback;
  }

  function firstFiniteOrNull(...values) {
    for (const value of values) {
      const numeric = Number.parseFloat(value);
      if (Number.isFinite(numeric)) return numeric;
    }
    return null;
  }

  function safeName(value, fallback = "Model") {
    const text = String(value || fallback).trim();
    return text || fallback;
  }

  function shouldIncludePressureEnthalpySheets(scenario) {
    return String(scenario?.fluid?.name || "").trim().toLowerCase() === "water";
  }

  function sheetNamesForScenario(scenario) {
    const includePressureEnthalpy = shouldIncludePressureEnthalpySheets(scenario);
    return Object.values(SHEETS).filter((sheetName) => (
      includePressureEnthalpy || (sheetName !== SHEETS.phData && sheetName !== SHEETS.phChart)
    ));
  }

  function normalizeDiameter(value, fallback = 0.05) {
    const numeric = toNumber(value, fallback);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return numeric > 5 ? numeric / 1000 : numeric;
  }

  function normalizeRoughness(value, fallback = 0.000045) {
    const numeric = toNumber(value, fallback);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    return numeric > 0.02 ? numeric / 1000 : numeric;
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value || null));
    } catch (error) {
      return value;
    }
  }

  function quoteSheet(name) {
    return `'${String(name).replace(/'/g, "''")}'`;
  }

  function ref(sheet, cell) {
    return `${quoteSheet(sheet)}!${cell}`;
  }

  function xmlEscape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function colLetter(index) {
    let n = index;
    let letters = "";
    while (n > 0) {
      const mod = (n - 1) % 26;
      letters = String.fromCharCode(65 + mod) + letters;
      n = Math.floor((n - mod) / 26);
    }
    return letters;
  }

  function absoluteRange(sheet, startCol, startRow, endCol, endRow) {
    return `${quoteSheet(sheet)}!$${startCol}$${startRow}:$${endCol}$${endRow}`;
  }

  function getModelState(explicitState = null) {
    const state = explicitState || root.__npshLastLoadedProject || root.__npshProjectState || null;
    const model = state?.model || state?.globalModel || root.__npshGlobalModel || root.globalModel || {};
    const connections = state?.connections || root.connections || root.__npshConnections || [];
    return { model: model || {}, connections: Array.isArray(connections) ? connections : [] };
  }

  function findNode(model, predicate) {
    return Object.entries(model || {}).find(([, node]) => predicate(node || {})) || [null, null];
  }

  function nodeId(model, node) {
    if (!node) return "";
    const entry = Object.entries(model || {}).find(([, candidate]) => candidate === node);
    return entry ? entry[0] : "";
  }

  function hydraulicConnections(connections) {
    return (connections || []).filter((connection) => !connection.connectionType || connection.connectionType === "hydraulic");
  }

  function toAbsolutePressureBar(node, key = "pressure", fallback = ATM_BAR) {
    const props = node?.props || {};
    const pressure = toNumber(props[key], fallback);
    const basis = String(props.pressureInputBasis || props.pressureBasis || "").toLowerCase();
    return basis.includes("gauge") || basis === "g" ? pressure + ATM_BAR : pressure;
  }

  function resolveFluidBasisProps(fluidProps = {}) {
    if (typeof root.getTemperatureResolvedFluidBasisProps === "function") {
      try {
        return root.getTemperatureResolvedFluidBasisProps(fluidProps) || fluidProps;
      } catch (error) {
        return fluidProps;
      }
    }
    return fluidProps;
  }

  function nodeCalculationTrace(node) {
    return node?.results?.calculationTrace || node?.results?.npshEvaluation?.calculationTrace || {};
  }

  function pipeTotalLoss(pipe) {
    const results = pipe?.results || {};
    const trace = nodeCalculationTrace(pipe);
    return firstFiniteOrNull(
      trace?.totals?.totalLoss,
      trace?.hydraulic?.headLoss,
      results.totalLoss,
      results.headLoss,
      results.totalHeadLoss,
      results.suctionLoss,
      results.dischargeLoss
    );
  }

  function normalizeSegment(segment = {}, index = 0) {
    const fittingType = segment.fittingType || "None";
    const fittedK = fittingType === "Custom K"
      ? toNumber(segment.fittingK, 0)
      : toNumber(segment.fittingK, FITTING_K[fittingType] || 0);
    return {
      name: safeName(segment.name, `Segment ${index + 1}`),
      length: Math.max(0, toNumber(segment.length, DEFAULT_SEGMENT.length)),
      diameter: normalizeDiameter(segment.diameter, DEFAULT_SEGMENT.diameter),
      roughness: normalizeRoughness(segment.roughness, DEFAULT_SEGMENT.roughness),
      fittingType,
      fittingQuantity: Math.max(0, toNumber(segment.fittingQuantity, fittedK > 0 ? 1 : 0)),
      fittingK: Math.max(0, fittedK),
      minorLoss: Math.max(0, toNumber(segment.minorLoss ?? segment.additionalK, 0)),
      notes: safeName(segment.notes, "")
    };
  }

  function normalizePipeSegments(pipe) {
    const props = pipe?.props || {};
    const sourceSegments = Array.isArray(props.segments) && props.segments.length
      ? props.segments
      : [{
        ...DEFAULT_SEGMENT,
        name: pipe?.name || DEFAULT_SEGMENT.name,
        length: props.length,
        diameter: props.diameter,
        roughness: props.roughness,
        fittingType: props.fittingType,
        fittingQuantity: props.fittingQuantity,
        fittingK: props.fittingK,
        minorLoss: props.minorLoss
      }];
    return sourceSegments.slice(0, MAX_SEGMENTS).map(normalizeSegment);
  }

  function waterDensityAt(tempC) {
    const t = toNumber(tempC, 25);
    return 1000 * (1 - (((t + 288.9414) / (508929.2 * (t + 68.12963))) * ((t - 3.9863) ** 2)));
  }

  function waterDynamicViscosityCpAt(tempC) {
    const t = toNumber(tempC, 25);
    return 2.414E-5 * (10 ** (247.8 / (t + 133.15))) * 1000;
  }

  function waterKinematicViscosityCStAt(tempC) {
    const density = waterDensityAt(tempC);
    return density > 0 ? waterDynamicViscosityCpAt(tempC) / density * 1000 : 0;
  }

  function waterVaporPressureBarAt(tempC) {
    const t = toNumber(tempC, 25);
    return (10 ** (8.07131 - 1730.63 / (233.426 + t))) * 0.00133322;
  }

  function waterSpecificHeatAt(tempC) {
    const t = toNumber(tempC, 25);
    return 4.2174 - 0.003720283 * t + 0.0001412855 * (t ** 2) - 0.000002654387 * (t ** 3) + 0.0000000209383 * (t ** 4);
  }

  function waterBulkModulusAt(tempC) {
    const t = toNumber(tempC, 25);
    return 2.15 + 0.004 * t - 0.000035 * (t ** 2);
  }

  function waterSpeedOfSoundAt(tempC) {
    const density = waterDensityAt(tempC);
    const bulk = waterBulkModulusAt(tempC);
    return density > 0 && bulk > 0 ? Math.sqrt(bulk * 1000000000 / density) : 0;
  }

  function pipeFormulaLoss(segments = [], flowM3H = 0, kinematicViscosityCSt = 1) {
    const flowM3S = Math.max(0, toNumber(flowM3H, 0)) / 3600;
    const nu = Math.max(kinematicViscosityCSt, 1E-9) * 1E-6;
    return (segments || []).slice(0, MAX_SEGMENTS).reduce((sum, segment) => {
      const diameter = normalizeDiameter(segment.diameter, DEFAULT_SEGMENT.diameter);
      const area = diameter > 0 ? Math.PI * (diameter ** 2) / 4 : 0;
      const velocity = area > 0 ? flowM3S / area : 0;
      const reynolds = velocity > 0 && diameter > 0 ? velocity * diameter / nu : 0;
      const epsD = diameter > 0 ? normalizeRoughness(segment.roughness, DEFAULT_SEGMENT.roughness) / diameter : 0;
      const friction = reynolds <= 0
        ? 0
        : reynolds < 2300
          ? 64 / reynolds
          : 0.25 / ((Math.log10(epsD / 3.7 + 5.74 / (reynolds ** 0.9))) ** 2);
      const velocityHead = velocity ** 2 / (2 * G);
      const major = diameter > 0 ? friction * (Math.max(0, toNumber(segment.length, 0)) / diameter) * velocityHead : 0;
      const minorK = Math.max(0, toNumber(segment.fittingQuantity, 0)) * toNumber(segment.fittingK, 0) + toNumber(segment.minorLoss, 0);
      return sum + major + minorK * velocityHead;
    }, 0);
  }

  function collectScenario(explicitState = null) {
    const { model, connections } = getModelState(explicitState);
    const [, fluid] = findNode(model, (node) => node.type === "fluid");
    const [pumpId, pump] = findNode(model, (node) => node.type === "pump");
    const links = hydraulicConnections(connections);
    const suctionLink = links.find((link) => link.to === pumpId && link.pipeId) || null;
    const dischargeLink = links.find((link) => link.from === pumpId && link.pipeId) || null;
    const [fallbackPipe1Id, fallbackPipe1] = findNode(model, (node) => node.type === "pipe");
    const fallbackPipeEntries = Object.entries(model || {}).filter(([, node]) => node?.type === "pipe");
    const fallbackPipe2Id = fallbackPipeEntries[1]?.[0] || "";
    const fallbackPipe2 = fallbackPipeEntries[1]?.[1] || null;
    const sourceId = suctionLink?.from || findNode(model, (node) => node.type === "source" || node.type === "tank")[0] || "";
    const sinkId = dischargeLink?.to || findNode(model, (node) => node.type === "sink")[0] || "";
    const source = model[sourceId] || null;
    const sink = model[sinkId] || null;
    const suctionPipeId = suctionLink?.pipeId || fallbackPipe1Id || "PIPE-1";
    const dischargePipeId = dischargeLink?.pipeId || (fallbackPipe2 ? fallbackPipe2Id : "");
    const suctionPipe = model[suctionPipeId] || fallbackPipe1 || null;
    const dischargePipe = dischargePipeId ? (model[dischargePipeId] || fallbackPipe2) : null;
    const fluidProps = fluid?.props || {};
    const resolvedFluidProps = resolveFluidBasisProps(fluidProps);
    const sourceProps = source?.props || {};
    const pumpProps = pump?.props || {};
    const pumpResults = pump?.results || {};
    const npshEvaluation = pumpResults.npshEvaluation || {};
    const pumpTrace = nodeCalculationTrace(pump);
    const pumpTraceBasis = pumpTrace?.basis || {};
    const pumpTraceBoundary = pumpTrace?.boundary || {};
    const sinkProps = sink?.props || {};
    const temperature = firstNumber([
      fluidProps.temperature,
      fluidProps.temp,
      sourceProps.temperature
    ], 25);
    const flow = firstNumber([
      sourceProps.flow,
      sourceProps.volumetricFlow,
      sourceProps.designFlow,
      pump?.results?.flow,
      pumpProps.designFlow,
      sinkProps.demandFlow,
      sinkProps.flow
    ], 0);
    const sinkFlow = firstNumber([
      sinkProps.demandFlow,
      sinkProps.flow,
      flow
    ], flow);
    const npshr = firstNumber([
      npshEvaluation.npshr,
      npshEvaluation.npshRequired,
      pumpResults.npshr,
      pumpResults.npshRequired,
      pumpProps.manualNpshr,
      pumpProps.npshr,
      pumpProps.designNpshr,
    ], 1);
    const sourcePressure = toAbsolutePressureBar(source, "pressure", ATM_BAR);
    const sinkPressure = toAbsolutePressureBar(sink, "pressure", ATM_BAR);
    const pumpElevation = firstNumber([
      pumpProps.suctionElevation,
      pumpProps.elevation,
      pumpProps.datumElevation
    ], 0);
    const sourceElevation = firstNumber([sourceProps.elevation, sourceProps.level], 0);
    const sinkElevation = firstNumber([sinkProps.elevation, sinkProps.level], 0);
    const suctionSegments = normalizePipeSegments(suctionPipe);
    const dischargeSegments = dischargePipe ? normalizePipeSegments(dischargePipe) : [];
    const activeDensity = firstFiniteOrNull(resolvedFluidProps.density, fluidProps.density, pumpTraceBasis.density) ?? waterDensityAt(temperature);
    const activeDynamicViscosity = firstFiniteOrNull(resolvedFluidProps.dynamicViscosity, resolvedFluidProps.dynViscosity, fluidProps.dynamicViscosity, fluidProps.dynViscosity, pumpTraceBasis.dynamicViscosityCp) ?? waterDynamicViscosityCpAt(temperature);
    const activeKinematicViscosity = firstFiniteOrNull(resolvedFluidProps.kinematicViscosity, resolvedFluidProps.viscosity, fluidProps.kinematicViscosity, fluidProps.viscosity, pumpTraceBasis.viscosityCSt, pumpTraceBasis.viscosity) ?? waterKinematicViscosityCStAt(temperature);
    const activeVaporPressure = firstFiniteOrNull(resolvedFluidProps.vaporPressure, resolvedFluidProps.vaporPressureBarA, fluidProps.vaporPressure, fluidProps.vaporPressureBarA, pumpTraceBasis.vaporPressureBarA, pumpTraceBasis.vaporPressure) ?? waterVaporPressureBarAt(temperature);
    const activeSpecificWeight = firstFiniteOrNull(resolvedFluidProps.specificWeight, fluidProps.specificWeight, pumpTraceBasis.specificWeight) ?? activeDensity * G;
    const activeVaporPressureHead = firstFiniteOrNull(resolvedFluidProps.vaporPressureHead, fluidProps.vaporPressureHead, pumpResults.vaporPressureHead, npshEvaluation.vaporPressureHead, pumpTraceBasis.vaporPressureHead) ?? (activeSpecificWeight > 0 ? activeVaporPressure * 100000 / activeSpecificWeight : 0);
    const suctionFormulaLoss = pipeFormulaLoss(suctionSegments, flow, activeKinematicViscosity);
    const dischargeFormulaLoss = pipeFormulaLoss(dischargeSegments, sinkFlow, activeKinematicViscosity);
    const activeSuctionLoss = firstFiniteOrNull(npshEvaluation.suctionLoss, pumpResults.suctionLoss, pipeTotalLoss(suctionPipe)) ?? suctionFormulaLoss;
    const activeDischargeLoss = firstFiniteOrNull(npshEvaluation.dischargeLoss, pumpResults.dischargeLoss, pipeTotalLoss(dischargePipe)) ?? dischargeFormulaLoss;
    const npshaComponentReference = activeSpecificWeight > 0
      ? sourcePressure * 100000 / activeSpecificWeight + (sourceElevation - pumpElevation) - activeSuctionLoss - activeVaporPressureHead
      : null;
    const suctionPressureComponentReference = activeSpecificWeight > 0
      ? sourcePressure + activeSpecificWeight * (sourceElevation - pumpElevation - activeSuctionLoss) / 100000
      : null;
    const dischargePressureComponentReference = activeSpecificWeight > 0
      ? sinkPressure + activeSpecificWeight * (sinkElevation - pumpElevation + activeDischargeLoss) / 100000
      : null;
    const requiredHeadComponentReference = activeSpecificWeight > 0
      ? (sinkPressure - sourcePressure) * 100000 / activeSpecificWeight + (sinkElevation - sourceElevation) + activeSuctionLoss + activeDischargeLoss
      : null;

    return {
      generatedAt: new Date().toISOString(),
      model,
      route: {
        fluidId: nodeId(model, fluid) || "FLUID",
        sourceId: sourceId || "SRC",
        suctionPipeId,
        pumpId: pumpId || "PUMP",
        dischargePipeId,
        sinkId: sinkId || "SNK",
        labels: [
          "Fluid Basis",
          safeName(source?.name, sourceId || "SRC"),
          safeName(suctionPipe?.name, suctionPipeId || "PIPE-1"),
          safeName(pump?.name, pumpId || "PUMP"),
          dischargePipe ? safeName(dischargePipe.name, dischargePipeId) : "",
          sink ? safeName(sink.name, sinkId || "SNK") : ""
        ].filter(Boolean)
      },
      fluid: {
        name: safeName(fluidProps.fluidName || fluid?.name, "Water"),
        temperature
      },
      source: {
        name: safeName(source?.name, sourceId || "SRC"),
        flow,
        pressure: sourcePressure,
        elevation: sourceElevation
      },
      pump: {
        name: safeName(pump?.name, pumpId || "PUMP"),
        elevation: pumpElevation,
        npshr
      },
      sink: {
        name: safeName(sink?.name, sinkId || "SNK"),
        flow: sinkFlow,
        pressure: sinkPressure,
        elevation: sinkElevation
      },
      suctionPipe: {
        id: suctionPipeId,
        name: safeName(suctionPipe?.name, suctionPipeId || "PIPE-1"),
        exists: Boolean(suctionPipe),
        segments: suctionSegments
      },
      dischargePipe: {
        id: dischargePipeId,
        name: safeName(dischargePipe?.name, dischargePipeId || "PIPE-2"),
        exists: Boolean(dischargePipe),
        segments: dischargeSegments
      },
      activeBasis: {
        referenceTemperature: temperature,
        density: activeDensity,
        dynamicViscosity: activeDynamicViscosity,
        kinematicViscosity: activeKinematicViscosity,
        vaporPressure: activeVaporPressure,
        specificWeight: activeSpecificWeight,
        vaporPressureHead: activeVaporPressureHead,
        specificHeat: firstFiniteOrNull(resolvedFluidProps.specificHeat, fluidProps.specificHeat, pumpTraceBasis.specificHeat) ?? waterSpecificHeatAt(temperature),
        bulkModulus: firstFiniteOrNull(resolvedFluidProps.bulkModulus, fluidProps.bulkModulus, pumpTraceBasis.bulkModulus) ?? waterBulkModulusAt(temperature),
        speedOfSound: firstFiniteOrNull(resolvedFluidProps.speedOfSound, fluidProps.speedOfSound, pumpTraceBasis.speedOfSound) ?? waterSpeedOfSoundAt(temperature),
        suctionLoss: activeSuctionLoss,
        dischargeLoss: activeDischargeLoss,
        suctionReferenceFormulaLoss: suctionFormulaLoss,
        dischargeReferenceFormulaLoss: dischargeFormulaLoss,
        npsha: firstFiniteOrNull(npshEvaluation.npsha, npshEvaluation.npshAvailable, pumpResults.npsha, pumpResults.npshAvailable),
        npshaReferenceComponent: npshaComponentReference,
        npshMargin: firstFiniteOrNull(npshEvaluation.npshMargin, pumpResults.npshMargin),
        npshRatio: firstFiniteOrNull(npshEvaluation.npshRatio, pumpResults.npshRatio),
        suctionPressure: firstFiniteOrNull(npshEvaluation.suctionPressure, pumpResults.suctionPressure),
        suctionPressureReferenceComponent: suctionPressureComponentReference,
        dischargePressure: firstFiniteOrNull(npshEvaluation.dischargePressure, pumpResults.dischargePressure),
        dischargePressureReferenceComponent: dischargePressureComponentReference,
        requiredHead: firstFiniteOrNull(npshEvaluation.requiredSystemHead, pumpResults.requiredSystemHead, pumpResults.requiredHead, pumpTrace?.systemHead?.requiredHead),
        requiredHeadReferenceComponent: requiredHeadComponentReference,
        sourceHead: firstFiniteOrNull(pumpTraceBoundary.totalSourceHead, pumpTraceBoundary.hydraulicHead, source?.results?.sourceHead, source?.results?.hydraulicHead)
      }
    };
  }

  function ensureExcelJSLoaded() {
    if (root.ExcelJS?.Workbook) return Promise.resolve(root.ExcelJS);
    if (typeof require === "function") {
      try {
        root.ExcelJS = require("./vendor/exceljs.min.js");
        return Promise.resolve(root.ExcelJS);
      } catch (error) {
        // Browser path below.
      }
    }
    return loadScript("vendor/exceljs.min.js").then(() => {
      if (!root.ExcelJS?.Workbook) throw new Error("ExcelJS failed to load.");
      return root.ExcelJS;
    });
  }

  function ensureJSZipLoaded() {
    if (root.JSZip) return Promise.resolve(root.JSZip);
    if (typeof require === "function") {
      try {
        root.JSZip = require("./vendor/jszip.min.js");
        return Promise.resolve(root.JSZip);
      } catch (error) {
        // Browser path below.
      }
    }
    return loadScript("vendor/jszip.min.js").then(() => {
      if (!root.JSZip) throw new Error("JSZip failed to load.");
      return root.JSZip;
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (typeof document === "undefined") {
        reject(new Error(`Cannot load ${src} without a document.`));
        return;
      }
      const existing = Array.from(document.scripts).find((script) => (script.src || "").includes(src));
      if (existing?.dataset.loaded === "true") {
        resolve();
        return;
      }
      const script = existing || document.createElement("script");
      script.src = script.src || src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      if (!existing) document.head.appendChild(script);
    });
  }

  function argb(hex) {
    return `FF${String(hex).replace(/^#/, "").toUpperCase()}`;
  }

  function styleWorkbook(workbook) {
    workbook.creator = "NPSH UNTIRTA Engineering Export";
    workbook.lastModifiedBy = "NPSH UNTIRTA Engineering Export";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;
    workbook.calcProperties.forceFullCalc = true;
    workbook.views = [{ x: 0, y: 0, width: 14000, height: 9000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  }

  function setColumns(ws, widths) {
    ws.columns = widths.map((width) => ({ width }));
  }

  function title(ws, text, endCol = 6) {
    ws.mergeCells(1, 1, 1, endCol);
    const cell = ws.getCell(1, 1);
    cell.value = text;
    cell.font = { bold: true, size: 14, color: { argb: argb("0B3558") } };
    cell.alignment = { vertical: "middle" };
    ws.getRow(1).height = 24;
  }

  function headerRow(row) {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: argb("FFFFFF") } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb("134866") } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = thinBorder();
    });
  }

  function thinBorder() {
    return {
      top: { style: "thin", color: { argb: argb("CFE0EE") } },
      left: { style: "thin", color: { argb: argb("CFE0EE") } },
      bottom: { style: "thin", color: { argb: argb("CFE0EE") } },
      right: { style: "thin", color: { argb: argb("CFE0EE") } }
    };
  }

  function styleSheet(ws) {
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = cell.border || thinBorder();
        cell.alignment = cell.alignment || { vertical: "top", wrapText: true };
      });
    });
    ws.views = [{ state: "frozen", ySplit: 3 }];
  }

  function writeFormula(cell, formula, numFmt = "0.000", cachedResult = undefined) {
    if (cachedResult !== undefined && cachedResult !== null && cachedResult !== "") {
      cell.value = { formula, result: cachedResult };
    } else {
      cell.value = { formula };
    }
    cell.numFmt = numFmt;
  }

  function writeTextFormula(cell, formula, cachedResult = undefined) {
    if (cachedResult !== undefined && cachedResult !== null && cachedResult !== "") {
      cell.value = { formula, result: cachedResult };
    } else {
      cell.value = { formula };
    }
    cell.alignment = { vertical: "top", wrapText: true };
  }

  function protectInputCell(cell) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb("FFF8DB") } };
    cell.border = thinBorder();
  }

  function bandCell(cell, text, fill = "00B050") {
    cell.value = text;
    cell.font = { bold: true, size: 12, color: { argb: argb("0B3558") } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(fill) } };
    cell.alignment = { horizontal: "centerContinuous", vertical: "middle" };
    cell.border = thinBorder();
  }

  function styleBandRange(ws, row, startCol, endCol, text, fill = "00B050") {
    for (let col = startCol; col <= endCol; col += 1) {
      const cell = ws.getCell(row, col);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(fill) } };
      cell.border = thinBorder();
      cell.alignment = { horizontal: "centerContinuous", vertical: "middle" };
    }
    bandCell(ws.getCell(row, startCol), text, fill);
    ws.getRow(row).height = 18;
  }

  function styleSummaryLabel(cell) {
    cell.font = { color: { argb: argb("0B3558") } };
    cell.alignment = { vertical: "top", wrapText: true };
    cell.border = thinBorder();
  }

  function styleSummaryUnit(cell) {
    cell.font = { color: { argb: argb("365B74") } };
    cell.alignment = { vertical: "top", wrapText: true };
    cell.border = thinBorder();
  }

  async function createWorkbook(explicitState = null) {
    const ExcelJS = await ensureExcelJSLoaded();
    const scenario = explicitState?.route && explicitState?.fluid ? clone(explicitState) : collectScenario(explicitState);
    const workbook = new ExcelJS.Workbook();
    styleWorkbook(workbook);
    const ctx = {
      workbook,
      scenario,
      inputRefs: {},
      calcRefs: { fluid: {}, suction: {}, discharge: {}, npsh: {}, pump: {} },
      chartDefs: []
    };

    buildInputSheet(ctx);
    buildFluidBasisSheet(ctx);
    if (shouldIncludePressureEnthalpySheets(scenario)) {
      buildPressureEnthalpySheets(ctx);
    }
    buildPipeCalculationSheet(ctx, "suction");
    buildMoodySheet(ctx, "suction");
    buildPipeCalculationSheet(ctx, "discharge");
    buildMoodySheet(ctx, "discharge");
    buildNpshSheet(ctx);
    buildPumpDischargeSheet(ctx);
    buildCalculationSequenceSheet(ctx);

    workbook.__engineeringChartDefs = ctx.chartDefs;
    return workbook;
  }

  function addWorksheet(ctx, name, widths, titleText, endCol = widths.length) {
    const ws = ctx.workbook.addWorksheet(name, {
      properties: { defaultRowHeight: 18 },
      pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    setColumns(ws, widths);
    title(ws, titleText, endCol);
    return ws;
  }

  function buildInputSheet(ctx) {
    const ws = addWorksheet(ctx, SHEETS.inputs, [18, 34, 16, 12, 58, 13, 35.3, 17.3, 11.8], "Calculation Trace Inputs - single editable source", 5);
    styleBandRange(ws, 2, 1, 5, "INPUT");
    styleBandRange(ws, 2, 7, 9, "OUTPUT PUMP");
    ws.getRow(3).values = ["Section", "Input parameter", "Value", "Unit", "Engineering role / effect"];
    ws.getCell("G3").value = "Step";
    ws.getCell("H3").value = "Formula result";
    ws.getCell("I3").value = "Unit";
    ws.getRow(3).height = 30;
    headerRow(ws.getRow(3));
    let rowIndex = 4;
    const addInput = (key, section, parameter, value, unit, role) => {
      const row = ws.getRow(rowIndex);
      row.values = [section, parameter, value, unit, role];
      protectInputCell(row.getCell(3));
      row.getCell(2).font = { bold: true, color: { argb: argb("0B3558") } };
      row.getCell(5).font = { color: { argb: argb("365B74") } };
      ctx.inputRefs[key] = ref(SHEETS.inputs, `$C$${rowIndex}`);
      rowIndex += 1;
    };
    const addActiveBasis = (key, section, parameter, value, unit, role) => {
      const row = ws.getRow(rowIndex);
      row.values = [section, parameter, value ?? null, unit, role];
      row.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb("EAF4FF") } };
      row.getCell(2).font = { bold: true, color: { argb: argb("0B3558") } };
      row.getCell(5).font = { color: { argb: argb("365B74") } };
      ctx.inputRefs[key] = ref(SHEETS.inputs, `$C$${rowIndex}`);
      rowIndex += 1;
    };

    const s = ctx.scenario;
    addInput("fluid.temperature", "Fluid Basis", "Temperature", s.fluid.temperature, "deg C", "Primary input for water-property correlations and phase visualization.");
    addInput("source.flow", "SRC", "SRC input flow", s.source.flow, "m3/h", "Flow basis for suction PFV velocity, Reynolds number, Moody chart, and NPSHa.");
    addInput("source.pressure", "SRC", "Source absolute pressure", s.source.pressure, "bar a", "Converted to pressure head for NPSHa and required head.");
    addInput("source.elevation", "SRC", "Source elevation", s.source.elevation, "m", "Static head contribution from source datum to pump datum.");
    addInput("pump.elevation", "Pump", "Pump datum elevation", s.pump.elevation, "m", "Pump suction datum used for suction pressure and NPSHa.");
    addInput("pump.npshr", "Pump", "Manual NPSHr", s.pump.npshr, "m", "User/vendor NPSHr input for cavitation margin and NPSH ratio.");
    addInput("sink.flow", "SNK", "Sink flow demand", s.sink.flow, "m3/h", "Discharge-side flow basis when a downstream pipe and sink are present.");
    addInput("sink.pressure", "SNK", "Sink absolute pressure", s.sink.pressure, "bar a", "Downstream pressure boundary for pump discharge pressure and required head.");
    addInput("sink.elevation", "SNK", "Sink elevation", s.sink.elevation, "m", "Downstream static elevation for Stage 2 required head.");

    buildInputsDashboard(ws);

    rowIndex = 35;
    addInput("discharge.exists", "Topology", "Discharge Pipe/Fitting/Valve present", s.dischargePipe.exists ? 1 : 0, "1/0", "1 enables Stage 2 discharge PFV, SNK, discharge pressure, and Pipe 2 Moody chart logic.");

    rowIndex += 1;
    addActiveBasis("active.fluid.referenceTemperature", "Solved calculation basis", "Reference Fluid Basis temperature", s.activeBasis.referenceTemperature, "deg C", "Export reference temperature used so property formulas match the initial solved case and still respond when Temperature changes.");
    addActiveBasis("active.fluid.density", "Solved calculation basis", "Resolved Fluid Basis density", s.activeBasis.density, "kg/m3", "Resolved value used for pressure-head conversion.");
    addActiveBasis("active.fluid.dynamicViscosity", "Solved calculation basis", "Resolved dynamic viscosity", s.activeBasis.dynamicViscosity, "cP", "Resolved value used by the exported calculation trace.");
    addActiveBasis("active.fluid.kinematicViscosity", "Solved calculation basis", "Resolved kinematic viscosity", s.activeBasis.kinematicViscosity, "cSt", "Resolved value used for pipe Reynolds number.");
    addActiveBasis("active.fluid.vaporPressure", "Solved calculation basis", "Resolved vapor pressure", s.activeBasis.vaporPressure, "bar a", "Resolved vapor pressure used for NPSH and phase evaluation.");
    addActiveBasis("active.fluid.specificWeight", "Solved calculation basis", "Resolved specific weight", s.activeBasis.specificWeight, "N/m3", "Resolved specific weight used to convert pressure into hydraulic head.");
    addActiveBasis("active.fluid.vaporPressureHead", "Solved calculation basis", "Resolved vapor pressure head", s.activeBasis.vaporPressureHead, "m", "Resolved vapor pressure head prevents NPSHa mismatch from property-correlation drift.");
    addActiveBasis("active.fluid.specificHeat", "Solved calculation basis", "Resolved specific heat", s.activeBasis.specificHeat, "kJ/kg.K", "Resolved thermophysical property if available.");
    addActiveBasis("active.fluid.bulkModulus", "Solved calculation basis", "Resolved bulk modulus", s.activeBasis.bulkModulus, "GPa", "Resolved thermophysical property if available.");
    addActiveBasis("active.fluid.speedOfSound", "Solved calculation basis", "Resolved speed of sound", s.activeBasis.speedOfSound, "m/s", "Resolved thermophysical property if available.");
    addActiveBasis("active.suction.loss", "Solved calculation basis", "Resolved suction PFV loss", s.activeBasis.suctionLoss, "m", "Current solver/pipe-trace suction loss used by NPSHa.");
    addActiveBasis("active.suction.referenceFormulaLoss", "Solved calculation basis", "Reference suction PFV formula loss", s.activeBasis.suctionReferenceFormulaLoss, "m", "Formula loss at export conditions; used only as a sensitivity baseline.");
    addActiveBasis("active.discharge.loss", "Solved calculation basis", "Resolved discharge PFV loss", s.activeBasis.dischargeLoss, "m", "Current solver/pipe-trace discharge loss used by required head when available.");
    addActiveBasis("active.discharge.referenceFormulaLoss", "Solved calculation basis", "Reference discharge PFV formula loss", s.activeBasis.dischargeReferenceFormulaLoss, "m", "Formula loss at export conditions; used only as a sensitivity baseline.");
    addActiveBasis("active.npsha", "Solved calculation basis", "Resolved NPSHa", s.activeBasis.npsha, "m", "Displayed NPSHa used to match the canvas/pump panel.");
    addActiveBasis("active.npsha.referenceComponent", "Solved calculation basis", "Reference component NPSHa", s.activeBasis.npshaReferenceComponent, "m", "Component NPSHa at export conditions; current NPSHa moves by the component delta.");
    addActiveBasis("active.npsh.margin", "Solved calculation basis", "Resolved NPSH margin", s.activeBasis.npshMargin, "m", "Solved margin when supplied by solver.");
    addActiveBasis("active.npsh.ratio", "Solved calculation basis", "Resolved NPSH ratio", s.activeBasis.npshRatio, "-", "Solved ratio when supplied by solver.");
    addActiveBasis("active.suction.pressure", "Solved calculation basis", "Resolved suction pressure", s.activeBasis.suctionPressure, "bar a", "Pump suction pressure when supplied by solver.");
    addActiveBasis("active.suction.pressureReferenceComponent", "Solved calculation basis", "Reference component suction pressure", s.activeBasis.suctionPressureReferenceComponent, "bar a", "Component suction pressure at export conditions; current suction pressure moves by the component delta.");
    addActiveBasis("active.discharge.pressure", "Solved calculation basis", "Resolved discharge pressure", s.activeBasis.dischargePressure, "bar a", "Pump discharge pressure when supplied by solver.");
    addActiveBasis("active.discharge.pressureReferenceComponent", "Solved calculation basis", "Reference component discharge pressure", s.activeBasis.dischargePressureReferenceComponent, "bar a", "Component discharge pressure at export conditions; current discharge pressure moves by the component delta.");
    addActiveBasis("active.required.head", "Solved calculation basis", "Resolved required head", s.activeBasis.requiredHead, "m", "Required/system head when supplied by solver.");
    addActiveBasis("active.required.headReferenceComponent", "Solved calculation basis", "Reference component required head", s.activeBasis.requiredHeadReferenceComponent, "m", "Component required head at export conditions; current required head moves by the component delta.");

    rowIndex += 1;
    addSegmentInputs("suction", "Pipe Fitting Valve (suction)", s.suctionPipe);
    rowIndex += 1;
    addSegmentInputs("discharge", "Pipe Fitting Valve (discharge)", s.dischargePipe);

    function addSegmentInputs(side, section, pipe) {
      const rows = pipe.segments.length ? pipe.segments : [DEFAULT_SEGMENT];
      for (let index = 0; index < MAX_SEGMENTS; index += 1) {
        const segment = rows[index] || { ...DEFAULT_SEGMENT, length: 0, diameter: DEFAULT_SEGMENT.diameter, roughness: DEFAULT_SEGMENT.roughness };
        const prefix = `${side}.seg${index + 1}`;
        const label = `${pipe.name || side.toUpperCase()} ${index + 1}`;
        addInput(`${prefix}.length`, section, `${label} length`, segment.length, "m", "Pipe length for Darcy-Weisbach major head loss.");
        addInput(`${prefix}.diameter`, section, `${label} inside diameter`, segment.diameter, "m", "Pipe inside diameter; changes area, velocity, Re, f, and head loss.");
        addInput(`${prefix}.roughness`, section, `${label} absolute roughness`, segment.roughness, "m", "Material/aging roughness used in eps/D and Moody friction factor.");
        addInput(`${prefix}.qty`, section, `${label} fitting/valve quantity`, segment.fittingQuantity, "-", "Quantity multiplier for fitting/valve K.");
        addInput(`${prefix}.k`, section, `${label} K each`, segment.fittingK, "-", "Fitting/valve K coefficient per item.");
        addInput(`${prefix}.additionalK`, section, `${label} additional K`, segment.minorLoss, "-", "User residual K for fittings, strainers, valves, and calibrated local losses.");
      }
    }

    ws.autoFilter = { from: "A3", to: "E3" };
    styleSheet(ws);
  }

  function buildInputsDashboard(ws) {
    const addPumpOutput = (row, label, formula, unit, format = "0.0000", text = false) => {
      ws.getCell(row, 7).value = label;
      styleSummaryLabel(ws.getCell(row, 7));
      if (text) writeTextFormula(ws.getCell(row, 8), formula);
      else writeFormula(ws.getCell(row, 8), formula, format);
      ws.getCell(row, 9).value = unit;
      styleSummaryUnit(ws.getCell(row, 9));
    };
    const addPfvOutput = (row, label, suctionFormula, dischargeFormula, unit, format = "0.0000") => {
      ws.getCell(row, 1).value = label;
      styleSummaryLabel(ws.getCell(row, 1));
      writeFormula(ws.getCell(row, 2), suctionFormula, format);
      ws.getCell(row, 3).value = unit;
      styleSummaryUnit(ws.getCell(row, 3));
      writeFormula(ws.getCell(row, 4), dischargeFormula, format);
      ws.getCell(row, 5).value = unit;
      styleSummaryUnit(ws.getCell(row, 5));
    };

    addPumpOutput(4, "SRC pressure head", `${SHEETS.npsh}!C4`, "m");
    addPumpOutput(5, "Static elevation head", `${SHEETS.npsh}!C5`, "m");
    addPumpOutput(6, "Suction PFV loss", `${SHEETS.npsh}!C6`, "m");
    addPumpOutput(7, "Vapor pressure head", `${SHEETS.npsh}!C7`, "m");
    addPumpOutput(8, "NPSHa", `${SHEETS.npsh}!C8`, "m");
    addPumpOutput(9, "Manual NPSHr", `${SHEETS.npsh}!C9`, "m");
    addPumpOutput(10, "NPSH margin", `${SHEETS.npsh}!C10`, "m");
    addPumpOutput(11, "NPSH ratio", `${SHEETS.npsh}!C11`, "-");
    addPumpOutput(12, "Cavitation status", `${SHEETS.npsh}!C12`, "-", "General", true);
    addPumpOutput(13, "Pump suction pressure", `${SHEETS.npsh}!C13`, "bar a");
    addPumpOutput(14, "Discharge PFV loss", `${SHEETS.pumpDischarge}!C4`, "m");
    addPumpOutput(15, "Pump discharge pressure", `${SHEETS.pumpDischarge}!C5`, "bar a");
    addPumpOutput(16, "Required pump head", `${SHEETS.pumpDischarge}!C6`, "m");
    addPumpOutput(17, "Pump differential pressure", `${SHEETS.pumpDischarge}!C7`, "bar");
    addPumpOutput(18, "Stage 2 status", `${SHEETS.pumpDischarge}!C8`, "-", "General", true);

    styleBandRange(ws, 14, 1, 3, "OUTPUT PFV (Suction)");
    styleBandRange(ws, 14, 4, 5, "OUTPUT PFV (Discharge)", "7030A0");
    addPfvOutput(15, "Flow", `${SHEETS.suction}!C4`, `${SHEETS.discharge}!C4`, "m3/h", "0.000");
    addPfvOutput(16, "Flow", `${SHEETS.suction}!C5`, `${SHEETS.discharge}!C5`, "m3/s", "0.000000");
    addPfvOutput(17, "Total major loss", `${SHEETS.suction}!C6`, `${SHEETS.discharge}!C6`, "m", "0.00000");
    addPfvOutput(18, "Total minor loss", `${SHEETS.suction}!C7`, `${SHEETS.discharge}!C7`, "m", "0.00000");
    addPfvOutput(19, "Total pipe loss", `${SHEETS.suction}!C8`, `${SHEETS.discharge}!C8`, "m", "0.00000");
    addPfvOutput(20, "Pressure drop", `${SHEETS.suction}!C9`, `${SHEETS.discharge}!C9`, "bar", "0.00000");
    addPfvOutput(21, "Primary velocity", `${SHEETS.suction}!C10`, `${SHEETS.discharge}!C10`, "m/s", "0.00000");
    addPfvOutput(22, "Primary Reynolds number", `${SHEETS.suction}!C11`, `${SHEETS.discharge}!C11`, "-", "0");
    addPfvOutput(23, "Primary Darcy friction factor", `${SHEETS.suction}!C12`, `${SHEETS.discharge}!C12`, "-", "0.000000");
  }

  function buildFluidBasisSheet(ctx) {
    const ws = addWorksheet(ctx, SHEETS.fluid, [28, 54, 18, 14, 58], "Fluid Basis Calculation - temperature driven water properties", 5);
    ws.getRow(3).values = ["Property", "Equation / correlation", "Formula result", "Unit", "Professional engineering note"];
    headerRow(ws.getRow(3));
    const refs = ctx.calcRefs.fluid;
    const add = (row, key, property, equation, formula, unit, note, format = "0.000", cachedResult = undefined) => {
      ws.getRow(row).values = [property, equation, null, unit, note];
      writeFormula(ws.getCell(row, 3), formula, format, cachedResult);
      refs[key] = ref(SHEETS.fluid, `$C$${row}`);
    };
    const inputT = ctx.inputRefs["fluid.temperature"];
    const refT = ctx.inputRefs["active.fluid.referenceTemperature"];
    const appDensity = ctx.inputRefs["active.fluid.density"];
    const appDynamicViscosity = ctx.inputRefs["active.fluid.dynamicViscosity"];
    const appKinematicViscosity = ctx.inputRefs["active.fluid.kinematicViscosity"];
    const appVaporPressure = ctx.inputRefs["active.fluid.vaporPressure"];
    const appSpecificWeight = ctx.inputRefs["active.fluid.specificWeight"];
    const appVaporPressureHead = ctx.inputRefs["active.fluid.vaporPressureHead"];
    const appSpecificHeat = ctx.inputRefs["active.fluid.specificHeat"];
    const appBulkModulus = ctx.inputRefs["active.fluid.bulkModulus"];
    const appSpeedOfSound = ctx.inputRefs["active.fluid.speedOfSound"];
    const densityCorr = (t) => `1000*(1-(((${t}+288.9414)/(508929.2*(${t}+68.12963)))*(${t}-3.9863)^2))`;
    const dynamicCorr = (t) => `2.414E-5*10^(247.8/(${t}+133.15))*1000`;
    const vaporCorr = (t) => `10^(8.07131-1730.63/(233.426+${t}))*0.00133322`;
    const specificHeatCorr = (t) => `4.2174-0.003720283*${t}+0.0001412855*${t}^2-0.000002654387*${t}^3+0.0000000209383*${t}^4`;
    const bulkCorr = (t) => `2.15+0.004*${t}-0.000035*${t}^2`;
    const speedCorr = (t) => `SQRT((${bulkCorr(t)})*1000000000/(${densityCorr(t)}))`;
    const kinematicCorr = (t) => `(${dynamicCorr(t)})/(${densityCorr(t)})`;
    add(4, "temperature", "Temperature", "T = Fluid Basis temperature input", inputT, "deg C", "Single temperature input used by all Fluid Basis property correlations.", "0.000");
    add(5, "temperatureK", "Absolute temperature", "T_K = T + 273.15", "C4+273.15", "K", "Absolute temperature for thermodynamic correlations.", "0.000");
    add(6, "density", "Density", "rho = rho_ref x rho_corr(T) / rho_corr(T_ref)", `IF(AND(ISNUMBER(${appDensity}),${appDensity}>0,ISNUMBER(${refT})),${appDensity}*(${densityCorr("C4")})/(${densityCorr(refT)}),${densityCorr("C4")})`, "kg/m3", "Matches the solved Fluid Basis at export and remains sensitive to Temperature changes.", "0.000", ctx.scenario.activeBasis.density);
    add(7, "dynamicViscosity", "Dynamic viscosity", "mu = mu_ref x mu_corr(T) / mu_corr(T_ref)", `IF(AND(ISNUMBER(${appDynamicViscosity}),${appDynamicViscosity}>0,ISNUMBER(${refT})),${appDynamicViscosity}*(${dynamicCorr("C4")})/(${dynamicCorr(refT)}),${dynamicCorr("C4")})`, "cP", "Dynamic viscosity remains tied to Temperature while matching the solved export basis.", "0.0000", ctx.scenario.activeBasis.dynamicViscosity);
    add(8, "kinematicViscosity", "Kinematic viscosity", "nu = nu_ref x [mu_corr(T)/rho_corr(T)] / [mu_corr(T_ref)/rho_corr(T_ref)]", `IF(AND(ISNUMBER(${appKinematicViscosity}),${appKinematicViscosity}>0,ISNUMBER(${refT})),${appKinematicViscosity}*((${kinematicCorr("C4")})/(${kinematicCorr(refT)})),C7/C6*1000)`, "cSt", "Kinematic viscosity drives Reynolds number and updates when Temperature changes.", "0.0000", ctx.scenario.activeBasis.kinematicViscosity);
    add(9, "vaporPressure", "Vapor pressure", "P_vap = P_vap,ref x P_corr(T) / P_corr(T_ref)", `IF(AND(ISNUMBER(${appVaporPressure}),${appVaporPressure}>=0,ISNUMBER(${refT})),${appVaporPressure}*(${vaporCorr("C4")})/(${vaporCorr(refT)}),${vaporCorr("C4")})`, "bar a", "Vapor pressure follows Temperature so NPSHa responds to fluid-basis edits.", "0.000000", ctx.scenario.activeBasis.vaporPressure);
    add(10, "specificWeight", "Specific weight", "gamma = gamma_ref x rho / rho_ref", `IF(AND(ISNUMBER(${appSpecificWeight}),${appSpecificWeight}>0,ISNUMBER(${appDensity}),${appDensity}>0),${appSpecificWeight}*(C6/${appDensity}),C6*9.80665)`, "N/m3", "Specific weight converts absolute pressure to hydraulic head and updates with density.", "0.000", ctx.scenario.activeBasis.specificWeight);
    add(11, "vaporPressureHead", "Vapor pressure head", "H_vap = H_vap,ref x [(P_vap/gamma)/(P_vap,ref/gamma_ref)]", `IF(AND(ISNUMBER(${appVaporPressureHead}),${appVaporPressureHead}>=0,ISNUMBER(${appVaporPressure}),${appVaporPressure}>0,ISNUMBER(${appSpecificWeight}),${appSpecificWeight}>0),${appVaporPressureHead}*((C9*100000/C10)/(${appVaporPressure}*100000/${appSpecificWeight})),C9*100000/C10)`, "m", "This head is subtracted in the NPSHa equation and updates when Temperature changes.", "0.0000", ctx.scenario.activeBasis.vaporPressureHead);
    add(12, "specificGravity", "Specific gravity", "SG = rho / rho_water_ref", "C6/1000", "-", "Dimensionless density ratio for quick engineering review.", "0.0000");
    add(13, "specificVolume", "Specific volume", "v = 1 / rho", "1/C6", "m3/kg", "Useful for thermodynamic interpretation and volume/mass conversion.", "0.000000");
    add(14, "specificHeat", "Specific heat", "Cp = Cp_ref x Cp_corr(T) / Cp_corr(T_ref)", `IF(AND(ISNUMBER(${appSpecificHeat}),${appSpecificHeat}>0,ISNUMBER(${refT})),${appSpecificHeat}*(${specificHeatCorr("C4")})/(${specificHeatCorr(refT)}),${specificHeatCorr("C4")})`, "kJ/kg.K", "Approximate liquid-water heat capacity used for h estimate on the P-h chart.", "0.0000", ctx.scenario.activeBasis.specificHeat);
    add(15, "bulkModulus", "Bulk modulus", "K = K_ref x K_corr(T) / K_corr(T_ref)", `IF(AND(ISNUMBER(${appBulkModulus}),${appBulkModulus}>0,ISNUMBER(${refT})),${appBulkModulus}*(${bulkCorr("C4")})/(${bulkCorr(refT)}),${bulkCorr("C4")})`, "GPa", "Screening correlation for liquid compressibility.", "0.0000", ctx.scenario.activeBasis.bulkModulus);
    add(16, "speedOfSound", "Speed of sound", "a = a_ref x a_corr(T) / a_corr(T_ref)", `IF(AND(ISNUMBER(${appSpeedOfSound}),${appSpeedOfSound}>0,ISNUMBER(${refT})),${appSpeedOfSound}*(${speedCorr("C4")})/(${speedCorr(refT)}),SQRT(C15*1000000000/C6))`, "m/s", "Compressibility indicator for hydraulic-transient awareness.", "0.000", ctx.scenario.activeBasis.speedOfSound);
    ws.autoFilter = { from: "A3", to: "E3" };
    styleSheet(ws);
  }

  function buildPressureEnthalpySheets(ctx) {
    const data = addWorksheet(ctx, SHEETS.phData, [14, 16, 16, 16, 16, 16, 18, 18, 16], "Pressure-Enthalpy Phase Chart Data - formula generated", 9);
    data.getRow(3).values = ["P (bar a)", "h sat liq", "h sat vap", "x = 0.1", "x = 0.5", "x = 0.9", "T sat", "h evaluated", "P evaluated"];
    headerRow(data.getRow(3));
    const first = 5;
    const last = 64;
    for (let row = first; row <= last; row += 1) {
      const fraction = `(ROW()-${first})*(LOG10(220)-LOG10(0.006))/${last - first}`;
      writeFormula(data.getCell(row, 1), `10^(LOG10(0.006)+${fraction})`, "0.0000");
      writeFormula(data.getCell(row, 7), `1730.63/(8.07131-LOG10(A${row}/0.00133322))-233.426`, "0.000");
      writeFormula(data.getCell(row, 2), `4.18*G${row}`, "0.000");
      writeFormula(data.getCell(row, 3), `2500+1.86*G${row}`, "0.000");
      writeFormula(data.getCell(row, 4), `B${row}+0.1*(C${row}-B${row})`, "0.000");
      writeFormula(data.getCell(row, 5), `B${row}+0.5*(C${row}-B${row})`, "0.000");
      writeFormula(data.getCell(row, 6), `B${row}+0.9*(C${row}-B${row})`, "0.000");
      if (row === first) {
        writeFormula(data.getCell(row, 8), `${ctx.calcRefs.fluid.specificHeat}*${ctx.calcRefs.fluid.temperature}`, "0.000");
        writeFormula(data.getCell(row, 9), ctx.calcRefs.fluid.vaporPressure, "0.000000");
      }
    }
    data.getCell("A66").value = "Note";
    data.getCell("B66").value = "P-h curves are generated from formula tables. The evaluated point uses Fluid Basis vapor pressure and a relative liquid enthalpy estimate, so changing Temperature updates the plot source data.";
    data.mergeCells("B66:I66");
    styleSheet(data);

    const chart = addWorksheet(ctx, SHEETS.phChart, [20, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18, 18], "Pressure-enthalpy phase chart", 12);
    chart.getRow(3).values = ["Temperature", null, "Fluid Basis Vapor Pressure", null, "Phase Status"];
    chart.getCell("A4").value = { formula: ctx.calcRefs.fluid.temperature };
    chart.getCell("B4").value = "deg C";
    chart.getCell("C4").value = { formula: ctx.calcRefs.fluid.vaporPressure };
    chart.getCell("D4").value = "bar a";
    writeTextFormula(chart.getCell("E4"), `IF(ABS(${ctx.calcRefs.fluid.vaporPressure}-${ctx.calcRefs.fluid.vaporPressure})<0.0001,"Saturated boundary","Review Fluid Basis pressure")`);
    chart.getCell("A6").value = "Native Excel chart is inserted below from PH_Phase_Data. Source ranges remain formula-backed and recalculate when Inputs change.";
    chart.mergeCells("A6:L6");
    ctx.chartDefs.push({
      sheetName: SHEETS.phChart,
      title: "Pressure-enthalpy phase chart",
      xTitle: "Specific enthalpy, h (kJ/kg)",
      yTitle: "Absolute pressure, P (bar a)",
      logX: false,
      logY: true,
      anchor: { fromCol: 0, fromRow: 7, toCol: 12, toRow: 31 },
      series: [
        { name: "Saturated liquid", x: absoluteRange(SHEETS.phData, "B", first, "B", last), y: absoluteRange(SHEETS.phData, "A", first, "A", last), color: "1F5AA6" },
        { name: "Saturated vapor", x: absoluteRange(SHEETS.phData, "C", first, "C", last), y: absoluteRange(SHEETS.phData, "A", first, "A", last), color: "A23B28" },
        { name: "Quality x = 0.1", x: absoluteRange(SHEETS.phData, "D", first, "D", last), y: absoluteRange(SHEETS.phData, "A", first, "A", last), color: "5B8DEF" },
        { name: "Quality x = 0.5", x: absoluteRange(SHEETS.phData, "E", first, "E", last), y: absoluteRange(SHEETS.phData, "A", first, "A", last), color: "7AA7FF" },
        { name: "Quality x = 0.9", x: absoluteRange(SHEETS.phData, "F", first, "F", last), y: absoluteRange(SHEETS.phData, "A", first, "A", last), color: "A3C3FF" },
        { name: "Evaluated point", x: absoluteRange(SHEETS.phData, "H", first, "H", first), y: absoluteRange(SHEETS.phData, "I", first, "I", first), color: "E11D48", markerOnly: true }
      ]
    });
    styleSheet(chart);
  }

  function pipeConfig(ctx, side) {
    const isSuction = side === "suction";
    return {
      side,
      title: isSuction ? "Suction Pipe/Fitting/Valve Calculation" : "Discharge Pipe/Fitting/Valve Calculation",
      sheet: isSuction ? SHEETS.suction : SHEETS.discharge,
      moodySheet: isSuction ? SHEETS.moodySuction : SHEETS.moodyDischarge,
      pipe: isSuction ? ctx.scenario.suctionPipe : ctx.scenario.dischargePipe,
      flowRef: isSuction ? ctx.inputRefs["source.flow"] : ctx.inputRefs["sink.flow"],
      prefix: isSuction ? "suction" : "discharge",
      calcBucket: isSuction ? ctx.calcRefs.suction : ctx.calcRefs.discharge,
      activeLossRef: isSuction ? ctx.inputRefs["active.suction.loss"] : ctx.inputRefs["active.discharge.loss"],
      referenceFormulaLossRef: isSuction ? ctx.inputRefs["active.suction.referenceFormulaLoss"] : ctx.inputRefs["active.discharge.referenceFormulaLoss"],
      activeLossValue: isSuction ? ctx.scenario.activeBasis.suctionLoss : ctx.scenario.activeBasis.dischargeLoss
    };
  }

  function segmentInputRefs(ctx, prefix, index) {
    return {
      length: ctx.inputRefs[`${prefix}.seg${index}.length`],
      diameter: ctx.inputRefs[`${prefix}.seg${index}.diameter`],
      roughness: ctx.inputRefs[`${prefix}.seg${index}.roughness`],
      qty: ctx.inputRefs[`${prefix}.seg${index}.qty`],
      k: ctx.inputRefs[`${prefix}.seg${index}.k`],
      additionalK: ctx.inputRefs[`${prefix}.seg${index}.additionalK`]
    };
  }

  function buildPipeCalculationSheet(ctx, side) {
    const cfg = pipeConfig(ctx, side);
    const ws = addWorksheet(ctx, cfg.sheet, [20, 18, 18, 16, 14, 14, 14, 16, 14, 14, 16, 14, 14, 14, 14, 14, 14, 16], cfg.title, 18);
    ws.getRow(3).values = ["Parameter", "Equation / source", "Formula result", "Unit", "Engineering role"];
    headerRow(ws.getRow(3));
    const addSummary = (row, key, parameter, equation, formula, unit, role, format = "0.0000", cachedResult = undefined) => {
      ws.getRow(row).values = [parameter, equation, null, unit, role];
      writeFormula(ws.getCell(row, 3), formula, format, cachedResult);
      cfg.calcBucket[key] = ref(cfg.sheet, `$C$${row}`);
    };
    addSummary(4, "flow", "Flow", "Q = selected boundary volumetric flow", cfg.flowRef, "m3/h", side === "suction" ? "SRC flow drives suction velocity and NPSHa loss." : "SNK flow demand drives discharge velocity and required head.", "0.000");
    addSummary(5, "flowM3S", "Flow", "Q_s = Q / 3600", "C4/3600", "m3/s", "SI flow basis for area, velocity, and Reynolds number.", "0.000000");
    addSummary(6, "majorLoss", "Total major loss", "Sum of f(L/D)(v^2/2g)", "SUM(N14:N19)", "m", "Straight-pipe Darcy-Weisbach loss roll-up.", "0.00000");
    addSummary(7, "minorLoss", "Total minor loss", "Sum of K(v^2/2g)", "SUM(O14:O19)", "m", "Fitting/valve/local-loss roll-up.", "0.00000");
    addSummary(8, "totalLoss", "Total pipe loss", "hL = hL_solved,ref x hL_formula,current / hL_formula,ref", `IF(AND(ISNUMBER(${cfg.activeLossRef}),${cfg.activeLossRef}>=0,ISNUMBER(${cfg.referenceFormulaLossRef}),${cfg.referenceFormulaLossRef}>0),${cfg.activeLossRef}*SUM(P14:P19)/${cfg.referenceFormulaLossRef},SUM(P14:P19))`, "m", side === "suction" ? "Subtracts directly from NPSHa and remains sensitive to flow, viscosity, pipe, fitting, and valve inputs." : "Adds to Stage 2 required pump head and remains sensitive to flow, viscosity, pipe, fitting, and valve inputs.", "0.00000", cfg.activeLossValue);
    addSummary(9, "pressureDrop", "Pressure drop", "DeltaP = rho g hL / 100000", `C8*${ctx.calcRefs.fluid.specificWeight}/100000`, "bar", "Pressure-loss equivalent of the pipe/fitting/valve hydraulic head.", "0.00000");
    addSummary(10, "primaryVelocity", "Primary velocity", "First active segment v", "J14", "m/s", "Displayed for engineering sanity check.", "0.00000");
    addSummary(11, "primaryRe", "Primary Reynolds number", "First active segment Re", "K14", "-", "Primary point plotted on the Moody chart.", "0");
    addSummary(12, "primaryF", "Primary Darcy friction factor", "First active segment f", "M14", "-", "Primary Darcy f reported for friction-factor audit.", "0.000000");

    ws.getRow(13).values = ["Segment", "Length", "Diameter", "Roughness", "Qty", "K each", "Additional K", "Q", "Area", "Velocity", "Reynolds", "eps/D", "Darcy f", "Major hL", "Minor hL", "Total hL", "dP", "Regime"];
    headerRow(ws.getRow(13));
    for (let i = 1; i <= MAX_SEGMENTS; i += 1) {
      const row = 13 + i;
      const refs = segmentInputRefs(ctx, cfg.prefix, i);
      const segment = cfg.pipe.segments[i - 1];
      ws.getCell(row, 1).value = segment?.name || `${cfg.pipe.name || cfg.prefix} Segment ${i}`;
      writeFormula(ws.getCell(row, 2), refs.length, "0.000");
      writeFormula(ws.getCell(row, 3), refs.diameter, "0.000000");
      writeFormula(ws.getCell(row, 4), refs.roughness, "0.0000000");
      writeFormula(ws.getCell(row, 5), refs.qty, "0.000");
      writeFormula(ws.getCell(row, 6), refs.k, "0.000000");
      writeFormula(ws.getCell(row, 7), refs.additionalK, "0.000000");
      writeFormula(ws.getCell(row, 8), "$C$5", "0.000000");
      writeFormula(ws.getCell(row, 9), `IF(C${row}>0,PI()*C${row}^2/4,0)`, "0.000000");
      writeFormula(ws.getCell(row, 10), `IF(I${row}>0,H${row}/I${row},0)`, "0.000000");
      writeFormula(ws.getCell(row, 11), `IF(AND(J${row}>0,C${row}>0),J${row}*C${row}/(${ctx.calcRefs.fluid.kinematicViscosity}*1E-6),0)`, "0");
      writeFormula(ws.getCell(row, 12), `IF(C${row}>0,D${row}/C${row},0)`, "0.000000");
      writeFormula(ws.getCell(row, 13), `IF(K${row}<=0,0,IF(K${row}<2300,64/K${row},0.25/(LOG10(L${row}/3.7+5.74/(K${row}^0.9))^2)))`, "0.000000");
      writeFormula(ws.getCell(row, 14), `IF(C${row}>0,M${row}*(B${row}/C${row})*(J${row}^2/(2*${G})),0)`, "0.00000");
      writeFormula(ws.getCell(row, 15), `(E${row}*F${row}+G${row})*(J${row}^2/(2*${G}))`, "0.00000");
      writeFormula(ws.getCell(row, 16), `N${row}+O${row}`, "0.00000");
      writeFormula(ws.getCell(row, 17), `${ctx.calcRefs.fluid.density}*${G}*P${row}/100000`, "0.00000");
      writeTextFormula(ws.getCell(row, 18), `IF(K${row}<1,"Not active",IF(K${row}<2300,"Laminar",IF(K${row}<4000,"Transitional","Turbulent")))`);
    }
    ws.autoFilter = { from: "A13", to: "R13" };
    styleSheet(ws);
  }

  function buildMoodySheet(ctx, side) {
    const cfg = pipeConfig(ctx, side);
    const ws = addWorksheet(ctx, cfg.moodySheet, [14, 14, 14, 14, 14, 14, 14, 14, 14, 16, 18, 16, 16, 16, 16], `${cfg.pipe.name || cfg.prefix} Log-Log Moody Chart / Friction Factor Check`, 15);
    ws.getRow(3).values = ["Primary Re", null, "Darcy f", null, "eps/D", null, "Regime"];
    writeFormula(ws.getCell("A4"), cfg.calcBucket.primaryRe, "0.000E+00");
    writeFormula(ws.getCell("C4"), cfg.calcBucket.primaryF, "0.000000");
    writeFormula(ws.getCell("E4"), `${cfg.sheet}!$L$14`, "0.000000");
    writeTextFormula(ws.getCell("G4"), `${cfg.sheet}!$R$14`);
    ws.getRow(7).values = ["Re", "Laminar f = 64/Re", "smooth pipe", "eps/D 1.0000e-5", "eps/D 5.0000e-5", "eps/D 0.0001", "eps/D 0.0005", "eps/D 0.001", "eps/D 0.005", null, "Segment", "Segment Re", "Segment f", "Segment eps/D", "Regime"];
    headerRow(ws.getRow(7));
    const first = 8;
    const last = 67;
    const roughnessFamilies = [0, 0.00001, 0.00005, 0.0001, 0.0005, 0.001, 0.005];
    for (let row = first; row <= last; row += 1) {
      writeFormula(ws.getCell(row, 1), `10^(LOG10(1000)+(ROW()-${first})*(LOG10(100000000)-LOG10(1000))/${last - first})`, "0.000E+00");
      writeFormula(ws.getCell(row, 2), `IF(A${row}<=2300,64/A${row},NA())`, "0.000000");
      roughnessFamilies.forEach((epsD, index) => {
        writeFormula(ws.getCell(row, 3 + index), `0.25/(LOG10(${epsD}/3.7+5.74/(A${row}^0.9))^2)`, "0.000000");
      });
    }
    for (let i = 1; i <= MAX_SEGMENTS; i += 1) {
      const row = first + i - 1;
      const sourceRow = 13 + i;
      ws.getCell(row, 11).value = `${cfg.pipe.name || cfg.prefix}-Seg-${i}`;
      writeFormula(ws.getCell(row, 12), `${cfg.sheet}!$K$${sourceRow}`, "0.000E+00");
      writeFormula(ws.getCell(row, 13), `${cfg.sheet}!$M$${sourceRow}`, "0.000000");
      writeFormula(ws.getCell(row, 14), `${cfg.sheet}!$L$${sourceRow}`, "0.000000");
      writeTextFormula(ws.getCell(row, 15), `${cfg.sheet}!$R$${sourceRow}`);
    }
    ws.getCell("A70").value = "Darcy friction factor chart. Fanning friction factor equals Darcy f / 4. All lines are calculated from the worksheet table, not from a static image.";
    ws.mergeCells("A70:O70");
    ctx.chartDefs.push({
      sheetName: cfg.moodySheet,
      title: `${cfg.pipe.name || cfg.prefix} Log-Log Moody Chart`,
      xTitle: "Reynolds Number (log scale)",
      yTitle: "Darcy f (log scale)",
      logX: true,
      logY: true,
      anchor: { fromCol: 0, fromRow: 72, toCol: 15, toRow: 96 },
      series: [
        { name: "Laminar f = 64/Re", x: absoluteRange(cfg.moodySheet, "A", first, "A", last), y: absoluteRange(cfg.moodySheet, "B", first, "B", last), color: "173B5C" },
        { name: "smooth pipe", x: absoluteRange(cfg.moodySheet, "A", first, "A", last), y: absoluteRange(cfg.moodySheet, "C", first, "C", last), color: "1D4ED8" },
        { name: "eps/D 1.0000e-5", x: absoluteRange(cfg.moodySheet, "A", first, "A", last), y: absoluteRange(cfg.moodySheet, "D", first, "D", last), color: "0284C7" },
        { name: "eps/D 5.0000e-5", x: absoluteRange(cfg.moodySheet, "A", first, "A", last), y: absoluteRange(cfg.moodySheet, "E", first, "E", last), color: "475569" },
        { name: "eps/D 0.0001", x: absoluteRange(cfg.moodySheet, "A", first, "A", last), y: absoluteRange(cfg.moodySheet, "F", first, "F", last), color: "B45309" },
        { name: "eps/D 0.0005", x: absoluteRange(cfg.moodySheet, "A", first, "A", last), y: absoluteRange(cfg.moodySheet, "G", first, "G", last), color: "3F7E0A" },
        { name: "eps/D 0.001", x: absoluteRange(cfg.moodySheet, "A", first, "A", last), y: absoluteRange(cfg.moodySheet, "H", first, "H", last), color: "E11D48" },
        { name: "eps/D 0.005", x: absoluteRange(cfg.moodySheet, "A", first, "A", last), y: absoluteRange(cfg.moodySheet, "I", first, "I", last), color: "7C3AED" },
        { name: "Calculated segment markers", x: absoluteRange(cfg.moodySheet, "L", first, "L", first + MAX_SEGMENTS - 1), y: absoluteRange(cfg.moodySheet, "M", first, "M", first + MAX_SEGMENTS - 1), color: side === "suction" ? "F97316" : "0F766E", markerOnly: true }
      ]
    });
    styleSheet(ws);
  }

  function buildNpshSheet(ctx) {
    const ws = addWorksheet(ctx, SHEETS.npsh, [28, 52, 18, 12, 68], "Stage 1 - SRC to Pump NPSHa and NPSHr Margin", 5);
    ws.getRow(3).values = ["Step", "Equation Professional", "Formula result", "Unit", "Engineering explanation"];
    headerRow(ws.getRow(3));
    const refs = ctx.calcRefs.npsh;
    const appNpsha = ctx.inputRefs["active.npsha"];
    const refNpshaComponent = ctx.inputRefs["active.npsha.referenceComponent"];
    const appSuctionPressure = ctx.inputRefs["active.suction.pressure"];
    const refSuctionPressureComponent = ctx.inputRefs["active.suction.pressureReferenceComponent"];
    const add = (row, key, step, equation, formula, unit, explanation, format = "0.0000", cachedResult = undefined) => {
      ws.getRow(row).values = [step, equation, null, unit, explanation];
      if (typeof formula === "string" && formula.startsWith("TEXT:")) writeTextFormula(ws.getCell(row, 3), formula.slice(5), cachedResult);
      else writeFormula(ws.getCell(row, 3), formula, format, cachedResult);
      refs[key] = ref(SHEETS.npsh, `$C$${row}`);
    };
    add(4, "sourcePressureHead", "SRC pressure head", "H_P,SRC = P_SRC,abs x 100000 / gamma", `${ctx.inputRefs["source.pressure"]}*100000/${ctx.calcRefs.fluid.specificWeight}`, "m", "Converts absolute source pressure into available hydraulic head.");
    add(5, "elevationHead", "Static elevation head", "H_z = z_SRC - z_pump", `${ctx.inputRefs["source.elevation"]}-${ctx.inputRefs["pump.elevation"]}`, "m", "Static head from source datum to pump suction datum.");
    add(6, "suctionLoss", "Suction PFV loss", "h_L,suction = Sum(major + minor)", ctx.calcRefs.suction.totalLoss, "m", "Pipe/Fitting/Valve suction loss subtracts from NPSHa.", "0.0000", ctx.scenario.activeBasis.suctionLoss);
    add(7, "vaporHead", "Vapor pressure head", "H_vap = P_vap x 100000 / gamma", ctx.calcRefs.fluid.vaporPressureHead, "m", "Fluid vapor pressure head is subtracted to assess cavitation potential.", "0.0000", ctx.scenario.activeBasis.vaporPressureHead);
    add(8, "npsha", "NPSHa", "NPSHa = NPSHa_ref + [(H_P,SRC + H_z - h_L,suction - H_vap)_current - component_ref]", `IF(AND(ISNUMBER(${appNpsha}),ISNUMBER(${refNpshaComponent})),${appNpsha}+((C4+C5-C6-C7)-${refNpshaComponent}),C4+C5-C6-C7)`, "m", "Matches the solved NPSHa at export and remains sensitive to SRC, Fluid Basis, and suction PFV inputs.", "0.0000", ctx.scenario.activeBasis.npsha);
    add(9, "npshr", "Manual NPSHr", "NPSHr = user/vendor manual input", ctx.inputRefs["pump.npshr"], "m", "Required NPSH from pump data or manual engineering input.");
    add(10, "margin", "NPSH margin", "Margin = NPSHa - NPSHr", "C8-C9", "m", "Positive margin means NPSHa exceeds NPSHr.", "0.0000", ctx.scenario.activeBasis.npshMargin);
    add(11, "ratio", "NPSH ratio", "Ratio = NPSHa / NPSHr", `IF(C9>0,C8/C9,"")`, "-", "Ratio screening for cavitation acceptance.", "0.0000", ctx.scenario.activeBasis.npshRatio);
    add(12, "status", "Cavitation status", "Status = IF(NPSHa < NPSHr, Cavitation Risk, OK)", "TEXT:IF(C9<=0,\"NPSHr input required\",IF(C8<C9,\"Cavitation Risk\",IF(C11<1.1,\"Warning\",\"OK\")))", "-", "Professional screening status based on NPSHa, NPSHr, and ratio.");
    add(13, "suctionPressure", "Pump suction pressure", "P_suction = P_suction,ref + [P_SRC + gamma(z_SRC - z_pump - h_L,suction)/100000 - component_ref]", `IF(AND(ISNUMBER(${appSuctionPressure}),ISNUMBER(${refSuctionPressureComponent})),${appSuctionPressure}+((${ctx.inputRefs["source.pressure"]}+${ctx.calcRefs.fluid.specificWeight}*(${ctx.inputRefs["source.elevation"]}-${ctx.inputRefs["pump.elevation"]}-C6)/100000)-${refSuctionPressureComponent}),${ctx.inputRefs["source.pressure"]}+${ctx.calcRefs.fluid.specificWeight}*(${ctx.inputRefs["source.elevation"]}-${ctx.inputRefs["pump.elevation"]}-C6)/100000)`, "bar a", "Estimated pump suction absolute pressure after suction PFV loss.", "0.0000", ctx.scenario.activeBasis.suctionPressure);
    styleSheet(ws);
  }

  function buildPumpDischargeSheet(ctx) {
    const ws = addWorksheet(ctx, SHEETS.pumpDischarge, [30, 58, 18, 12, 70], "Stage 2 - Pump Discharge Pressure and Required Head", 5);
    ws.getRow(3).values = ["Step", "Equation Professional", "Formula result", "Unit", "Engineering explanation"];
    headerRow(ws.getRow(3));
    const refs = ctx.calcRefs.pump;
    const appDischargePressure = ctx.inputRefs["active.discharge.pressure"];
    const appRequiredHead = ctx.inputRefs["active.required.head"];
    const refDischargePressureComponent = ctx.inputRefs["active.discharge.pressureReferenceComponent"];
    const refRequiredHeadComponent = ctx.inputRefs["active.required.headReferenceComponent"];
    const add = (row, key, step, equation, formula, unit, explanation, format = "0.0000", cachedResult = undefined) => {
      ws.getRow(row).values = [step, equation, null, unit, explanation];
      if (typeof formula === "string" && formula.startsWith("TEXT:")) writeTextFormula(ws.getCell(row, 3), formula.slice(5), cachedResult);
      else writeFormula(ws.getCell(row, 3), formula, format, cachedResult);
      refs[key] = ref(SHEETS.pumpDischarge, `$C$${row}`);
    };
    const npshr = ctx.inputRefs["pump.npshr"];
    add(4, "dischargeLoss", "Discharge PFV loss", "h_L,discharge = Sum(major + minor)", ctx.calcRefs.discharge.totalLoss, "m", "Downstream PFV hydraulic loss from pump discharge to SNK.", "0.0000", ctx.scenario.activeBasis.dischargeLoss);
    add(5, "dischargePressure", "Pump discharge pressure", "P_discharge = P_discharge,ref + [P_SNK + gamma(z_SNK - z_pump + h_L,discharge)/100000 - component_ref]", `IF(AND(ISNUMBER(${appDischargePressure}),ISNUMBER(${refDischargePressureComponent})),${appDischargePressure}+((IF(${npshr}>0,${ctx.inputRefs["sink.pressure"]}+${ctx.calcRefs.fluid.specificWeight}*(${ctx.inputRefs["sink.elevation"]}-${ctx.inputRefs["pump.elevation"]}+C4)/100000,""))-${refDischargePressureComponent}),IF(${npshr}>0,${ctx.inputRefs["sink.pressure"]}+${ctx.calcRefs.fluid.specificWeight}*(${ctx.inputRefs["sink.elevation"]}-${ctx.inputRefs["pump.elevation"]}+C4)/100000,""))`, "bar a", "Calculated after NPSHr is entered, using SNK pressure/elevation and discharge PFV loss.", "0.0000", ctx.scenario.activeBasis.dischargePressure);
    add(6, "requiredHead", "Required pump head", "H_req = H_req,ref + [boundary pressure head + static head + PFV losses - component_ref]", `IF(AND(ISNUMBER(${appRequiredHead}),ISNUMBER(${refRequiredHeadComponent})),${appRequiredHead}+((IF(${npshr}>0,(${ctx.inputRefs["sink.pressure"]}-${ctx.inputRefs["source.pressure"]})*100000/${ctx.calcRefs.fluid.specificWeight}+(${ctx.inputRefs["sink.elevation"]}-${ctx.inputRefs["source.elevation"]})+${ctx.calcRefs.suction.totalLoss}+C4,""))-${refRequiredHeadComponent}),IF(${npshr}>0,(${ctx.inputRefs["sink.pressure"]}-${ctx.inputRefs["source.pressure"]})*100000/${ctx.calcRefs.fluid.specificWeight}+(${ctx.inputRefs["sink.elevation"]}-${ctx.inputRefs["source.elevation"]})+${ctx.calcRefs.suction.totalLoss}+C4,""))`, "m", "System head required from SRC boundary through PFV suction, pump, PFV discharge, and SNK.", "0.0000", ctx.scenario.activeBasis.requiredHead);
    add(7, "differentialPressure", "Pump differential pressure", "DeltaP_pump = gamma H_req / 100000", `IF(C6=\"\",\"\",${ctx.calcRefs.fluid.specificWeight}*C6/100000)`, "bar", "Pressure equivalent of required pump head.");
    add(8, "stageStatus", "Stage 2 status", "IF NPSHr and discharge route exist, Stage 2 is ready", `TEXT:IF(${npshr}<=0,\"Waiting for NPSHr input\",IF(${ctx.inputRefs["discharge.exists"]}<1,\"No discharge PFV/SNK route\",IF(C6>0,\"Ready\",\"Review downstream inputs\")))`, "-", "Discharge calculations are intentionally gated by NPSHr and downstream route availability.");
    styleSheet(ws);
  }

  function buildCalculationSequenceSheet(ctx) {
    const ws = addWorksheet(ctx, SHEETS.sequence, [22, 36, 56, 66, 18, 12, 68], "Calculation Sequence - Fluid Basis -> SRC -> Suction PFV -> Pump -> Discharge PFV -> SNK", 7);
    ws.getRow(3).values = ["Stage", "Calculation", "Equation Professional", "Numerical substitution", "Linked result", "Unit", "Professional mechanical / chemical engineering interpretation"];
    headerRow(ws.getRow(3));
    let row = 4;
    const add = (stage, calculation, equation, substitutionFormula, resultRef, unit, interpretation, format = "0.0000") => {
      ws.getRow(row).values = [stage, calculation, equation, null, null, unit, interpretation];
      writeTextFormula(ws.getCell(row, 4), substitutionFormula);
      writeFormula(ws.getCell(row, 5), resultRef, format);
      row += 1;
    };
    add("Fluid Basis", "Density from temperature", "rho = f(T)", `"T = "&TEXT(${ctx.calcRefs.fluid.temperature},"0.000")&" deg C -> rho = "&TEXT(${ctx.calcRefs.fluid.density},"0.000")&" kg/m3"`, ctx.calcRefs.fluid.density, "kg/m3", "Density is the bridge between pressure boundary input and hydraulic head.");
    add("Fluid Basis", "Vapor pressure head", "H_vap = P_vap x 100000 / gamma", `"P_vap = "&TEXT(${ctx.calcRefs.fluid.vaporPressure},"0.000000")&" bar a; gamma = "&TEXT(${ctx.calcRefs.fluid.specificWeight},"0.0")&" N/m3; H_vap = "&TEXT(${ctx.calcRefs.fluid.vaporPressureHead},"0.0000")&" m"`, ctx.calcRefs.fluid.vaporPressureHead, "m", "Vapor pressure head is the cavitation reference deducted from available suction head.");
    add("SRC", "Source pressure head", "H_P,SRC = P_SRC,abs x 100000 / gamma", `"P_SRC = "&TEXT(${ctx.inputRefs["source.pressure"]},"0.000")&" bar a; H_P,SRC = "&TEXT(${ctx.calcRefs.npsh.sourcePressureHead},"0.000")&" m"`, ctx.calcRefs.npsh.sourcePressureHead, "m", "Absolute source pressure is converted to available suction energy.");
    add("Suction PFV", "Darcy-Weisbach and K-method loss", "h_L = f(L/D)(v^2/2g) + K(v^2/2g)", `"v = "&TEXT(${ctx.calcRefs.suction.primaryVelocity},"0.00000")&" m/s; Re = "&TEXT(${ctx.calcRefs.suction.primaryRe},"0.000E+00")&"; f = "&TEXT(${ctx.calcRefs.suction.primaryF},"0.000000")&"; h_L = "&TEXT(${ctx.calcRefs.suction.totalLoss},"0.00000")&" m"`, ctx.calcRefs.suction.totalLoss, "m", "Suction PFV loss is calculated segment-by-segment and then subtracted from NPSHa.");
    add("Pump", "Available NPSH", "NPSHa = H_P,SRC + H_z - h_L,suction - H_vap", `"NPSHa = "&TEXT(${ctx.calcRefs.npsh.sourcePressureHead},"0.000")&" + "&TEXT(${ctx.calcRefs.npsh.elevationHead},"0.000")&" - "&TEXT(${ctx.calcRefs.npsh.suctionLoss},"0.000")&" - "&TEXT(${ctx.calcRefs.npsh.vaporHead},"0.000")&" = "&TEXT(${ctx.calcRefs.npsh.npsha},"0.0000")&" m"`, ctx.calcRefs.npsh.npsha, "m", "This is the system-derived available suction head at the pump datum.");
    add("Pump", "NPSH margin", "Margin = NPSHa - NPSHr; Ratio = NPSHa/NPSHr", `"NPSHr = "&TEXT(${ctx.calcRefs.npsh.npshr},"0.000")&" m; Margin = "&TEXT(${ctx.calcRefs.npsh.margin},"0.000")&" m; Ratio = "&TEXT(${ctx.calcRefs.npsh.ratio},"0.000")`, ctx.calcRefs.npsh.margin, "m", "Manual/vendor NPSHr is compared to system NPSHa for cavitation screening.");
    add("Discharge PFV", "Discharge pipe/fitting/valve loss", "h_L,discharge = Sum(major + minor)", `"h_L,discharge = "&TEXT(${ctx.calcRefs.discharge.totalLoss},"0.00000")&" m; DeltaP = "&TEXT(${ctx.calcRefs.discharge.pressureDrop},"0.00000")&" bar"`, ctx.calcRefs.discharge.totalLoss, "m", "If Pipe 2 exists, a dedicated discharge PFV and Moody chart are generated.");
    add("SNK / Pump", "Required pump head", "H_req = boundary pressure head + static head + PFV losses", `"H_req = "&TEXT(${ctx.calcRefs.pump.requiredHead},"0.000")&" m; P_discharge = "&TEXT(${ctx.calcRefs.pump.dischargePressure},"0.000")&" bar a"`, ctx.calcRefs.pump.requiredHead, "m", "SNK pressure, flow demand, elevation, suction PFV, and discharge PFV jointly determine Stage 2 head.");
    ws.autoFilter = { from: "A3", to: "G3" };
    styleSheet(ws);
  }

  async function buildXlsxBuffer(explicitState = null, options = {}) {
    const workbook = await createWorkbook(explicitState);
    const rawBuffer = await workbook.xlsx.writeBuffer();
    if (options.nativeCharts === false) return rawBuffer;
    const sheetOrder = workbook.worksheets.map((worksheet) => worksheet.name);
    return addNativeCharts(rawBuffer, workbook.__engineeringChartDefs || [], sheetOrder);
  }

  async function exportScenarioCalculationTraceToExcel(options = {}) {
    try {
      const scenario = collectScenario(options.state || null);
      const buffer = await buildXlsxBuffer(scenario, options);
      const filename = makeFilename(scenario);
      if (options.download !== false) downloadBuffer(buffer, filename);
      return {
        ok: true,
        filename,
        version: VERSION,
        chartCount: shouldIncludePressureEnthalpySheets(scenario) ? 3 : 2,
        sheets: sheetNamesForScenario(scenario)
      };
    } catch (error) {
      console.error("Excel Calculation Trace export failed.", error);
      if (options.fallbackToOriginal !== false && originalExport && originalExport !== exportScenarioCalculationTraceToExcel) {
        return originalExport.apply(root, arguments);
      }
      if (typeof root.alert === "function") {
        root.alert(`Excel Calculation Trace export failed: ${error.message || error}`);
      }
      throw error;
    }
  }

  function makeFilename(scenario) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const route = [scenario.route.sourceId, scenario.route.suctionPipeId, scenario.route.pumpId, scenario.route.dischargePipeId, scenario.route.sinkId]
      .filter(Boolean)
      .join("_")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_");
    return `Calculation_Trace_${route || "NPSH"}_${date}.xlsx`;
  }

  function downloadBuffer(buffer, filename) {
    if (typeof document === "undefined" || typeof Blob === "undefined") return;
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function addNativeCharts(buffer, chartDefs, sheetOrder) {
    if (!chartDefs.length) return buffer;
    const JSZip = await ensureJSZipLoaded();
    const zip = await JSZip.loadAsync(buffer);
    let contentTypes = await zip.file("[Content_Types].xml").async("string");
    let nextDrawing = nextPartIndex(zip, /^xl\/drawings\/drawing(\d+)\.xml$/);
    let nextChart = nextPartIndex(zip, /^xl\/charts\/chart(\d+)\.xml$/);
    let installed = 0;

    for (const def of chartDefs) {
      const sheetIndex = sheetOrder.indexOf(def.sheetName) + 1;
      if (sheetIndex <= 0) continue;
      const sheetPath = `xl/worksheets/sheet${sheetIndex}.xml`;
      const sheetFile = zip.file(sheetPath);
      if (!sheetFile) continue;
      let sheetXml = await sheetFile.async("string");
      if (/<drawing\s/.test(sheetXml)) continue;

      const drawingIndex = nextDrawing;
      const chartIndex = nextChart;
      nextDrawing += 1;
      nextChart += 1;
      const drawingPath = `xl/drawings/drawing${drawingIndex}.xml`;
      const chartPath = `xl/charts/chart${chartIndex}.xml`;
      const sheetRelsPath = `xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`;
      const drawingRelsPath = `xl/drawings/_rels/drawing${drawingIndex}.xml.rels`;
      const sheetRelId = `rId${drawingIndex + 50}`;

      sheetXml = ensureWorksheetRelationshipNamespace(sheetXml);
      sheetXml = sheetXml.replace("</worksheet>", `<drawing r:id="${sheetRelId}"/></worksheet>`);
      zip.file(sheetPath, sheetXml);

      const existingSheetRels = zip.file(sheetRelsPath)
        ? await zip.file(sheetRelsPath).async("string")
        : relationshipsXml();
      zip.file(sheetRelsPath, appendRelationship(
        existingSheetRels,
        sheetRelId,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing",
        `../drawings/drawing${drawingIndex}.xml`
      ));
      zip.file(drawingPath, buildDrawingXml(def, "rId1", drawingIndex));
      zip.file(drawingRelsPath, appendRelationship(
        relationshipsXml(),
        "rId1",
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart",
        `../charts/chart${chartIndex}.xml`
      ));
      zip.file(chartPath, buildScatterChartXml(def, chartIndex));
      contentTypes = appendContentType(contentTypes, `/xl/drawings/drawing${drawingIndex}.xml`, "application/vnd.openxmlformats-officedocument.drawing+xml");
      contentTypes = appendContentType(contentTypes, `/xl/charts/chart${chartIndex}.xml`, "application/vnd.openxmlformats-officedocument.drawingml.chart+xml");
      installed += 1;
    }

    if (!installed) return buffer;
    zip.file("[Content_Types].xml", contentTypes);
    return zip.generateAsync({ type: buffer instanceof Uint8Array ? "uint8array" : "arraybuffer" });
  }

  function nextPartIndex(zip, matcher) {
    let max = 0;
    zip.forEach((relativePath) => {
      const match = relativePath.match(matcher);
      if (match) max = Math.max(max, Number.parseInt(match[1], 10));
    });
    return max + 1;
  }

  function relationshipsXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  }

  function appendRelationship(xml, id, type, target) {
    if (xml.includes(`Id="${id}"`)) return xml;
    return xml.replace("</Relationships>", `<Relationship Id="${xmlEscape(id)}" Type="${xmlEscape(type)}" Target="${xmlEscape(target)}"/></Relationships>`);
  }

  function ensureWorksheetRelationshipNamespace(xml) {
    if (/\sxmlns:r=/.test(xml)) return xml;
    return xml.replace("<worksheet", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');
  }

  function appendContentType(xml, partName, contentType) {
    if (xml.includes(`PartName="${partName}"`)) return xml;
    return xml.replace("</Types>", `<Override PartName="${xmlEscape(partName)}" ContentType="${xmlEscape(contentType)}"/></Types>`);
  }

  function buildDrawingXml(def, chartRelId, drawingIndex) {
    const anchor = def.anchor || { fromCol: 0, fromRow: 5, toCol: 12, toRow: 29 };
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:twoCellAnchor editAs="oneCell">
    <xdr:from><xdr:col>${anchor.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>${anchor.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="${drawingIndex}" name="${xmlEscape(def.title)}"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm>
        <a:off x="0" y="0"/>
        <a:ext cx="0" cy="0"/>
      </xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${chartRelId}"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
  }

  function buildScatterChartXml(def, chartIndex) {
    const xAxisId = 50000000 + chartIndex * 2;
    const yAxisId = xAxisId + 1;
    const seriesXml = (def.series || []).map((series, index) => buildSeriesXml(series, index)).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:date1904 val="0"/>
  <c:lang val="en-US"/>
  <c:roundedCorners val="0"/>
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1200" b="1"/><a:t>${xmlEscape(def.title)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>
    <c:plotArea>
      <c:layout/>
      <c:scatterChart>
        <c:scatterStyle val="smoothMarker"/>
        <c:varyColors val="0"/>
        ${seriesXml}
        <c:axId val="${xAxisId}"/>
        <c:axId val="${yAxisId}"/>
      </c:scatterChart>
      ${buildAxisXml(xAxisId, yAxisId, "b", def.xTitle, def.logX, "General")}
      ${buildAxisXml(yAxisId, xAxisId, "l", def.yTitle, def.logY, "General")}
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:layout/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
    <c:dispBlanksAs val="gap"/>
  </c:chart>
  <c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings>
</c:chartSpace>`;
  }

  function buildSeriesXml(series, index) {
    const color = String(series.color || "1F5AA6").replace(/^#/, "");
    const line = series.markerOnly
      ? '<a:ln><a:noFill/></a:ln>'
      : `<a:ln w="19050"><a:solidFill><a:srgbClr val="${xmlEscape(color)}"/></a:solidFill></a:ln>`;
    const marker = series.markerOnly
      ? `<c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr><a:solidFill><a:srgbClr val="${xmlEscape(color)}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="${xmlEscape(color)}"/></a:solidFill></a:ln></c:spPr></c:marker>`
      : '<c:marker><c:symbol val="none"/></c:marker>';
    return `<c:ser>
      <c:idx val="${index}"/>
      <c:order val="${index}"/>
      <c:tx><c:v>${xmlEscape(series.name)}</c:v></c:tx>
      <c:spPr>${line}</c:spPr>
      ${marker}
      <c:xVal><c:numRef><c:f>${xmlEscape(series.x)}</c:f></c:numRef></c:xVal>
      <c:yVal><c:numRef><c:f>${xmlEscape(series.y)}</c:f></c:numRef></c:yVal>
      <c:smooth val="${series.markerOnly ? 0 : 1}"/>
    </c:ser>`;
  }

  function buildAxisXml(axisId, crossAxisId, position, titleText, logScale, numberFormat) {
    const scaling = `<c:scaling>${logScale ? '<c:logBase val="10"/>' : ""}<c:orientation val="minMax"/></c:scaling>`;
    return `<c:valAx>
      <c:axId val="${axisId}"/>
      ${scaling}
      <c:delete val="0"/>
      <c:axPos val="${position}"/>
      <c:majorGridlines/>
      <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1000" b="1"/><a:t>${xmlEscape(titleText)}</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>
      <c:numFmt formatCode="${xmlEscape(numberFormat || "General")}" sourceLinked="0"/>
      <c:majorTickMark val="out"/>
      <c:minorTickMark val="none"/>
      <c:tickLblPos val="nextTo"/>
      <c:crossAx val="${crossAxisId}"/>
      <c:crosses val="autoZero"/>
      <c:crossBetween val="midCat"/>
    </c:valAx>`;
  }

  function install() {
    if (root.exportScenarioCalculationTraceToExcel !== exportScenarioCalculationTraceToExcel) {
      if (typeof root.exportScenarioCalculationTraceToExcel === "function") {
        originalExport = root.exportScenarioCalculationTraceToExcel;
      }
      root.exportScenarioCalculationTraceToExcel = exportScenarioCalculationTraceToExcel;
      root.exportScenarioCalculationTraceToExcel.__engineeringExcelTraceRuntime = VERSION;
    }
    return true;
  }

  function uninstall() {
    if (root.exportScenarioCalculationTraceToExcel === exportScenarioCalculationTraceToExcel && originalExport) {
      root.exportScenarioCalculationTraceToExcel = originalExport;
    }
    return true;
  }

  if (typeof document !== "undefined") {
    install();
    setTimeout(install, 0);
    setTimeout(install, 750);
    document.addEventListener("DOMContentLoaded", install, { once: true });
  }

  return {
    version: VERSION,
    cacheKey: CACHE_KEY,
    sheetNames: SHEETS,
    shouldIncludePressureEnthalpySheets,
    sheetNamesForScenario,
    collectScenario,
    createWorkbook,
    buildXlsxBuffer,
    exportScenarioCalculationTraceToExcel,
    install,
    uninstall
  };
});
