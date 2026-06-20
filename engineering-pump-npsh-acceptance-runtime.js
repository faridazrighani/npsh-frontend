!function (global) {
  "use strict";

  const VERSION = "pump-npsh-acceptance.v1";
  const USER_DEFINED = "User Defined";
  const MARGIN_PDF = "book_pdf/Hydraulic_Institute_2024_Rotodynamic_Pumps_Guideline_for_NPSH_Margin.pdf";
  const DEFAULT_RANGE = Object.freeze({
    porMinPercent: 70,
    porMaxPercent: 120,
    aorMinPercent: 50,
    aorMaxPercent: 130
  });
  const PRESETS = Object.freeze({
    "General Purpose": {
      por: { ratio: 1.05, margin: 0.6 },
      aor: { ratio: 1.1, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.11.4 general purpose pumps; local page-lock: ${MARGIN_PDF} PDF p.31 / printed p.20`
    },
    "Petroleum/Hydrocarbon": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.1, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.1.4 petroleum/hydrocarbon process pumps; local page-lock: ${MARGIN_PDF} PDF p.21 / printed p.10`
    },
    "Chemical Process": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.3.4 chemical process pumps; local page-lock: ${MARGIN_PDF} PDF p.23 / printed p.12`
    },
    "Water/Wastewater": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 water/wastewater pumps; local page-lock: ${MARGIN_PDF} PDF p.26 / printed p.15`
    },
    "Building Services": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.8.4 building services pumps; local page-lock: ${MARGIN_PDF} PDF p.28 / printed p.17`
    },
    "Irrigation": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.10.4 irrigation pumps; local page-lock: ${MARGIN_PDF} PDF p.30 / printed p.19`
    }
  });

  function numberOrNull(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function firstPositive(...values) {
    for (const value of values) {
      const parsed = numberOrNull(value);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  function getModel() {
    return global.__npshGlobalModel || global.globalModel || {};
  }

  function normalizeRange(rawProps = {}) {
    if (typeof global.getEffectivePumpOperatingRange === "function") {
      try {
        return global.getEffectivePumpOperatingRange(rawProps);
      } catch (error) {
        console.warn("Pump NPSH acceptance range fallback is active.", error);
      }
    }

    const read = key => {
      const parsed = numberOrNull(rawProps[key]);
      return Number.isFinite(parsed) ? parsed : DEFAULT_RANGE[key];
    };
    const range = {
      porMinPercent: read("porMinPercent"),
      porMaxPercent: read("porMaxPercent"),
      aorMinPercent: read("aorMinPercent"),
      aorMaxPercent: read("aorMaxPercent")
    };
    if (range.porMinPercent > range.porMaxPercent) {
      [range.porMinPercent, range.porMaxPercent] = [range.porMaxPercent, range.porMinPercent];
    }
    if (range.aorMinPercent > range.aorMaxPercent) {
      [range.aorMinPercent, range.aorMaxPercent] = [range.aorMaxPercent, range.aorMinPercent];
    }
    range.aorMinPercent = Math.min(range.aorMinPercent, range.porMinPercent);
    range.aorMaxPercent = Math.max(range.aorMaxPercent, range.porMaxPercent);
    return range;
  }

  function classifyFromFlow(flow, rawProps = {}) {
    const q = numberOrNull(flow);
    const bepFlow = firstPositive(rawProps.bepFlow, rawProps.designFlow);
    if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(bepFlow) || bepFlow <= 0) {
      return { status: "Unknown", ratio: null, percent: null, message: "BEP Flow and positive flow are required." };
    }

    if (typeof global.classifyPumpOperatingRegion === "function") {
      try {
        const classified = global.classifyPumpOperatingRegion(q, rawProps);
        if (classified && classified.status) return classified;
      } catch (error) {
        console.warn("Pump NPSH acceptance classifier fallback is active.", error);
      }
    }

    const ratio = q / bepFlow;
    const percent = ratio * 100;
    const range = normalizeRange(rawProps);
    if (percent >= range.porMinPercent && percent <= range.porMaxPercent) {
      return { status: "POR", ratio, percent, message: "Within preferred operating region" };
    }
    if (percent >= range.aorMinPercent && percent <= range.aorMaxPercent) {
      return { status: "AOR", ratio, percent, message: "Within allowable operating region, outside POR" };
    }
    return { status: "Outside AOR", ratio, percent, message: "Outside configured allowable operating region" };
  }

  function getPumpEvaluatedFlow(pump) {
    return firstPositive(
      pump?.results?.flow,
      pump?.results?.npshEvaluation?.flow,
      pump?.results?.performanceChartData?.dutyPoint?.flow,
      pump?.results?.fixedFlow,
      pump?.props?.fixedFlow,
      pump?.props?.designFlow
    );
  }

  function syncPumpOperatingRegion(pump) {
    if (!pump || pump.type !== "pump") return null;
    const flow = getPumpEvaluatedFlow(pump);
    const region = classifyFromFlow(flow, pump.props || {});
    pump.results = pump.results || {};
    if (region.status !== "Unknown") {
      pump.results.operatingRegion = region.status;
      if (Number.isFinite(region.percent)) {
        pump.results.bepPercent = Number(region.percent.toFixed(6));
        pump.results.operatingPercentBep = Number(region.percent.toFixed(6));
      }
    }
    return region;
  }

  function syncPumpById(nodeId) {
    const pump = getModel()?.[nodeId];
    return syncPumpOperatingRegion(pump);
  }

  function syncAllPumps() {
    Object.values(getModel() || {}).forEach(node => syncPumpOperatingRegion(node));
  }

  function regionKey(regionStatus) {
    return String(regionStatus || "").trim().toUpperCase() === "POR" ? "por" : "aor";
  }

  function getEffectivePumpNpshMarginCriteria(rawProps = {}, regionStatus = "POR") {
    const configuredUserDefined = typeof global.PUMP_NPSH_MARGIN_USER_DEFINED === "string"
      ? global.PUMP_NPSH_MARGIN_USER_DEFINED
      : USER_DEFINED;
    const basis = rawProps.npshMarginBasis || configuredUserDefined;

    if (basis === configuredUserDefined) {
      const ratio = numberOrNull(rawProps.minNpshMarginRatio);
      const margin = numberOrNull(rawProps.minNpshMargin);
      const valid = Number.isFinite(ratio) && Number.isFinite(margin);
      return {
        basis,
        regionBasis: "user",
        operatingRegionStatus: String(regionStatus || "").trim() || "User Defined",
        ratio,
        margin,
        valid,
        source: "User configured limit",
        reference: "User-defined NPSH margin basis",
        warnings: valid ? [] : ["Min NPSH Ratio and Min NPSH Margin are required for user-defined margin basis."]
      };
    }

    const preset = PRESETS[basis];
    if (!preset) {
      return {
        basis,
        regionBasis: "-",
        operatingRegionStatus: String(regionStatus || "").trim() || "Unknown",
        ratio: "",
        margin: "",
        valid: false,
        source: "Unknown standard basis",
        reference: "-",
        warnings: [`NPSH margin basis "${basis}" is not available.`]
      };
    }

    const normalizedRegionStatus = String(regionStatus || "").trim() || "Unknown";
    const selectedRegion = regionKey(normalizedRegionStatus);
    const selected = preset[selectedRegion] || preset.aor || preset.por;
    return {
      basis,
      regionBasis: selectedRegion.toUpperCase(),
      operatingRegionStatus: normalizedRegionStatus,
      ratio: selected.ratio,
      margin: selected.margin,
      valid: true,
      source: "Standard margin preset",
      reference: preset.reference,
      warnings: []
    };
  }

  function installCriteriaGuard() {
    if (global.getEffectivePumpNpshMarginCriteria?.__pumpNpshAcceptanceVersion === VERSION) return false;
    const wrapped = function guardedPumpNpshCriteria(rawProps = {}, regionStatus = "POR") {
      return getEffectivePumpNpshMarginCriteria(rawProps, regionStatus);
    };
    wrapped.__pumpNpshAcceptanceVersion = VERSION;
    global.getEffectivePumpNpshMarginCriteria = wrapped;
    global.PUMP_NPSH_MARGIN_PRESETS = PRESETS;
    return true;
  }

  function installRenderSidebarGuard() {
    const current = global.renderSidebar;
    if (typeof current !== "function" || current.__pumpNpshAcceptanceVersion === VERSION) return false;
    const wrapped = function guardedPumpRenderSidebar(nodeId, ...args) {
      syncPumpById(nodeId);
      return current.call(this, nodeId, ...args);
    };
    wrapped.__pumpNpshAcceptanceVersion = VERSION;
    global.renderSidebar = wrapped;
    return true;
  }

  function installUpdateSimulationGuard() {
    const current = global.updateSimulation;
    if (typeof current !== "function" || current.__pumpNpshAcceptanceVersion === VERSION) return false;
    const wrapped = function guardedPumpUpdateSimulation(...args) {
      const result = current.apply(this, args);
      syncAllPumps();
      return result;
    };
    wrapped.__pumpNpshAcceptanceVersion = VERSION;
    global.updateSimulation = wrapped;
    return true;
  }

  function install() {
    const changed = [
      installCriteriaGuard(),
      installRenderSidebarGuard(),
      installUpdateSimulationGuard()
    ].some(Boolean);
    syncAllPumps();
    return changed;
  }

  global.EngineeringPumpNpshAcceptanceRuntime = {
    version: VERSION,
    presets: PRESETS,
    classifyFromFlow,
    getEffectivePumpNpshMarginCriteria,
    install,
    syncAllPumps,
    syncPumpById,
    syncPumpOperatingRegion
  };

  install();
  if (typeof global.setInterval === "function") {
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      install();
      if (attempts >= 20 && typeof global.clearInterval === "function") {
        global.clearInterval(timer);
      }
    }, 250);
  }
}("undefined" != typeof window ? window : globalThis);
