!function (global) {
  "use strict";

  const VERSION = "pump-npsh-acceptance.v3";
  const USER_DEFINED = "User Defined";
  const GENERAL_PURPOSE = "General Purpose";
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
    "Oil & Gas - Consult Manufacturer": {
      por: {},
      aor: {},
      consultManufacturer: true,
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.2.4 oil and gas pumps; local page-lock: ${MARGIN_PDF} PDF p.22 / printed p.11`
    },
    "Chemical Process": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.3.4 chemical process pumps, conservative high suction-specific-speed row; local page-lock: ${MARGIN_PDF} PDF p.23 / printed p.12`
    },
    "Chemical Process - S < 210": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.3.4 chemical process pumps, S < 210 (Nss < 11,000); local page-lock: ${MARGIN_PDF} PDF p.23 / printed p.12`
    },
    "Chemical Process - S >= 210": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.3.4 chemical process pumps, S >= 210 (Nss >= 11,000); local page-lock: ${MARGIN_PDF} PDF p.23 / printed p.12`
    },
    "Power Plant - Boiler Feed <225 kW": {
      por: { ratio: 1.1 },
      aor: { ratio: 1.3 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.4.4 electric power plant non-nuclear boiler feed pumps <225 kW; local page-lock: ${MARGIN_PDF} PDF p.24 / printed p.13`
    },
    "Power Plant - Boiler Feed 225-500 kW": {
      por: { ratio: 1.2 },
      aor: { ratio: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.4.4 electric power plant non-nuclear boiler feed pumps >=225 and <500 kW; local page-lock: ${MARGIN_PDF} PDF p.24 / printed p.13`
    },
    "Power Plant - Condensate": {
      por: { ratio: 1.0 },
      aor: { ratio: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.4.4 electric power plant non-nuclear condensate pumps; local page-lock: ${MARGIN_PDF} PDF p.24 / printed p.13`
    },
    "Power Plant - Circulation/Cooling Water": {
      por: { ratio: 1.05 },
      aor: { margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.4.4 electric power plant non-nuclear circulation/cooling water pumps; local page-lock: ${MARGIN_PDF} PDF p.24 / printed p.13`
    },
    "Power Plant - Cooling Tower/Other": {
      por: { ratio: 1.1 },
      aor: { ratio: 1.3 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.4.4 electric power plant non-nuclear cooling tower/other services; local page-lock: ${MARGIN_PDF} PDF p.24 / printed p.13`
    },
    "Water/Wastewater": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 water/wastewater pumps, generic existing basis; local page-lock: ${MARGIN_PDF} PDF p.26 / printed p.15`
    },
    "Wastewater - Cast Iron <45 kW": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 wastewater cast iron impeller <45 kW; local page-lock: ${MARGIN_PDF} PDF p.26 / printed p.15`
    },
    "Wastewater - Stainless Steel <45 kW": {
      por: { ratio: 1.05, margin: 1.0 },
      aor: { ratio: 1.1, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 wastewater stainless steel impeller <45 kW; local page-lock: ${MARGIN_PDF} PDF p.26 / printed p.15`
    },
    "Wastewater - Cast Iron >=45 kW": {
      por: { ratio: 1.2, margin: 1.0 },
      aor: { ratio: 1.3, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 wastewater cast iron impeller >=45 kW; local page-lock: ${MARGIN_PDF} PDF p.26 / printed p.15`
    },
    "Wastewater - Stainless Steel >=45 kW": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 wastewater stainless steel impeller >=45 kW; local page-lock: ${MARGIN_PDF} PDF p.26 / printed p.15`
    },
    "Water - Stainless/Al Bronze <75 kW": {
      por: { ratio: 1.05, margin: 1.0 },
      aor: { ratio: 1.1, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 water stainless or aluminum bronze impeller <75 kW; local page-lock: ${MARGIN_PDF} PDF p.26 / printed p.15`
    },
    "Water - Stainless/Al Bronze >=75 kW": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 water stainless or aluminum bronze impeller >=75 kW; local page-lock: ${MARGIN_PDF} PDF p.26 / printed p.15`
    },
    "Pulp & Paper Stock <6% - S <145": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.7.4 pulp and paper stock pumps <6% solids, S <145 (Nss <7,500); local page-lock: ${MARGIN_PDF} PDF p.27 / printed p.16`
    },
    "Pulp & Paper Stock <6% - S >=145": {
      por: { ratio: 1.2, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.7.4 pulp and paper stock pumps <6% solids, S >=145 (Nss >=7,500); local page-lock: ${MARGIN_PDF} PDF p.27 / printed p.16`
    },
    "Building Services": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.8.4 building services pumps, generic high suction-specific-speed row; local page-lock: ${MARGIN_PDF} PDF p.28 / printed p.17`
    },
    "Building Services - S <145": {
      por: { ratio: 1.0 },
      aor: { ratio: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.8.4 building services pumps, S <145 (Nss <7,500); local page-lock: ${MARGIN_PDF} PDF p.28 / printed p.17`
    },
    "Building Services - S >=145": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.8.4 building services pumps, S >=145 (Nss >=7,500); local page-lock: ${MARGIN_PDF} PDF p.28 / printed p.17`
    },
    Slurry: {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.9.4 slurry pumps; local page-lock: ${MARGIN_PDF} PDF p.29 / printed p.18`
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
    return String(regionStatus || "").trim().toUpperCase() === "AOR" ? "aor" : "por";
  }

  function criteriaTerms(criteria = {}) {
    const ratio = numberOrNull(criteria.ratio);
    const margin = numberOrNull(criteria.margin);
    const hasRatio = Number.isFinite(ratio) && ratio > 0;
    const hasMargin = Number.isFinite(margin) && margin >= 0;
    return { ratio: hasRatio ? ratio : null, margin: hasMargin ? margin : null, hasRatio, hasMargin, valid: hasRatio || hasMargin };
  }

  function getEffectivePumpNpshMarginCriteria(rawProps = {}, regionStatus = "POR") {
    const configuredUserDefined = typeof global.PUMP_NPSH_MARGIN_USER_DEFINED === "string"
      ? global.PUMP_NPSH_MARGIN_USER_DEFINED
      : USER_DEFINED;
    const basis = rawProps.npshMarginBasis || GENERAL_PURPOSE;

    if (basis === configuredUserDefined) {
      const ratio = numberOrNull(rawProps.minNpshMarginRatio);
      const margin = numberOrNull(rawProps.minNpshMargin);
      const terms = criteriaTerms({ ratio, margin });
      const valid = terms.valid;
      if (!valid && !Number.isFinite(ratio) && !Number.isFinite(margin)) {
        return getEffectivePumpNpshMarginCriteria({ ...rawProps, npshMarginBasis: GENERAL_PURPOSE }, regionStatus);
      }
      return {
        basis,
        regionBasis: "user",
        operatingRegionStatus: String(regionStatus || "").trim() || "User Defined",
        ratio: terms.hasRatio ? terms.ratio : "",
        margin: terms.hasMargin ? terms.margin : "",
        hasRatioCriterion: terms.hasRatio,
        hasAbsoluteMarginCriterion: terms.hasMargin,
        valid,
        source: "User configured limit",
        reference: "User-defined NPSH margin basis",
        warnings: valid ? [] : ["At least one NPSH margin criterion is required for user-defined margin basis."]
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

    const normalizedRegionStatus = String(regionStatus || "").trim();
    const selectedRegion = regionKey(normalizedRegionStatus);
    const selected = preset[selectedRegion] || preset.aor || preset.por;
    const terms = criteriaTerms(selected);
    const warnings = [];
    if (preset.consultManufacturer) {
      warnings.push(`${basis} requires manufacturer/project-specific NPSH margin criteria per ANSI/HI.`);
    } else if (!terms.valid) {
      warnings.push(`${basis} does not provide a numeric NPSH margin criterion for ${selectedRegion.toUpperCase()}.`);
    }
    return {
      basis,
      regionBasis: selectedRegion.toUpperCase(),
      operatingRegionStatus: normalizedRegionStatus || "POR (route-only default)",
      ratio: terms.hasRatio ? terms.ratio : "",
      margin: terms.hasMargin ? terms.margin : "",
      hasRatioCriterion: terms.hasRatio,
      hasAbsoluteMarginCriterion: terms.hasMargin,
      valid: !preset.consultManufacturer && terms.valid,
      source: "Standard margin preset",
      reference: preset.reference,
      warnings
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
