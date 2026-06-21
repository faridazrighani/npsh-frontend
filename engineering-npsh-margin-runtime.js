!function (global) {
  "use strict";

  const userDefined = "User Defined";
  const generalPurpose = "General Purpose";
  const marginPdf = "book_pdf/Hydraulic_Institute_2024_Rotodynamic_Pumps_Guideline_for_NPSH_Margin.pdf";
  const presets = Object.freeze({
    "General Purpose": {
      por: { ratio: 1.05, margin: 0.6 },
      aor: { ratio: 1.1, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.11.4 general purpose pumps; local page-lock: ${marginPdf} PDF p.31 / printed p.20`
    },
    "Petroleum/Hydrocarbon": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.1, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.1.4 petroleum/hydrocarbon process pumps; local page-lock: ${marginPdf} PDF p.21 / printed p.10`
    },
    "Oil & Gas - Consult Manufacturer": {
      por: {},
      aor: {},
      consultManufacturer: true,
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.2.4 oil and gas pumps; local page-lock: ${marginPdf} PDF p.22 / printed p.11`
    },
    "Chemical Process": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.3.4 chemical process pumps, conservative high suction-specific-speed row; local page-lock: ${marginPdf} PDF p.23 / printed p.12`
    },
    "Chemical Process - S < 210": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.3.4 chemical process pumps, S < 210 (Nss < 11,000); local page-lock: ${marginPdf} PDF p.23 / printed p.12`
    },
    "Chemical Process - S >= 210": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.3.4 chemical process pumps, S >= 210 (Nss >= 11,000); local page-lock: ${marginPdf} PDF p.23 / printed p.12`
    },
    "Power Plant - Boiler Feed <225 kW": {
      por: { ratio: 1.1 },
      aor: { ratio: 1.3 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.4.4 electric power plant non-nuclear boiler feed pumps <225 kW; local page-lock: ${marginPdf} PDF p.24 / printed p.13`
    },
    "Power Plant - Boiler Feed 225-500 kW": {
      por: { ratio: 1.2 },
      aor: { ratio: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.4.4 electric power plant non-nuclear boiler feed pumps >=225 and <500 kW; local page-lock: ${marginPdf} PDF p.24 / printed p.13`
    },
    "Power Plant - Condensate": {
      por: { ratio: 1.0 },
      aor: { ratio: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.4.4 electric power plant non-nuclear condensate pumps; local page-lock: ${marginPdf} PDF p.24 / printed p.13`
    },
    "Power Plant - Circulation/Cooling Water": {
      por: { ratio: 1.05 },
      aor: { margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.4.4 electric power plant non-nuclear circulation/cooling water pumps; local page-lock: ${marginPdf} PDF p.24 / printed p.13`
    },
    "Power Plant - Cooling Tower/Other": {
      por: { ratio: 1.1 },
      aor: { ratio: 1.3 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.4.4 electric power plant non-nuclear cooling tower/other services; local page-lock: ${marginPdf} PDF p.24 / printed p.13`
    },
    "Water/Wastewater": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 water/wastewater pumps, generic existing basis; local page-lock: ${marginPdf} PDF p.26 / printed p.15`
    },
    "Wastewater - Cast Iron <45 kW": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 wastewater cast iron impeller <45 kW; local page-lock: ${marginPdf} PDF p.26 / printed p.15`
    },
    "Wastewater - Stainless Steel <45 kW": {
      por: { ratio: 1.05, margin: 1.0 },
      aor: { ratio: 1.1, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 wastewater stainless steel impeller <45 kW; local page-lock: ${marginPdf} PDF p.26 / printed p.15`
    },
    "Wastewater - Cast Iron >=45 kW": {
      por: { ratio: 1.2, margin: 1.0 },
      aor: { ratio: 1.3, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 wastewater cast iron impeller >=45 kW; local page-lock: ${marginPdf} PDF p.26 / printed p.15`
    },
    "Wastewater - Stainless Steel >=45 kW": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 wastewater stainless steel impeller >=45 kW; local page-lock: ${marginPdf} PDF p.26 / printed p.15`
    },
    "Water - Stainless/Al Bronze <75 kW": {
      por: { ratio: 1.05, margin: 1.0 },
      aor: { ratio: 1.1, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 water stainless or aluminum bronze impeller <75 kW; local page-lock: ${marginPdf} PDF p.26 / printed p.15`
    },
    "Water - Stainless/Al Bronze >=75 kW": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 water stainless or aluminum bronze impeller >=75 kW; local page-lock: ${marginPdf} PDF p.26 / printed p.15`
    },
    "Pulp & Paper Stock <6% - S <145": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.7.4 pulp and paper stock pumps <6% solids, S <145 (Nss <7,500); local page-lock: ${marginPdf} PDF p.27 / printed p.16`
    },
    "Pulp & Paper Stock <6% - S >=145": {
      por: { ratio: 1.2, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.7.4 pulp and paper stock pumps <6% solids, S >=145 (Nss >=7,500); local page-lock: ${marginPdf} PDF p.27 / printed p.16`
    },
    "Building Services": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.8.4 building services pumps, generic high suction-specific-speed row; local page-lock: ${marginPdf} PDF p.28 / printed p.17`
    },
    "Building Services - S <145": {
      por: { ratio: 1.0 },
      aor: { ratio: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.8.4 building services pumps, S <145 (Nss <7,500); local page-lock: ${marginPdf} PDF p.28 / printed p.17`
    },
    "Building Services - S >=145": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.8.4 building services pumps, S >=145 (Nss >=7,500); local page-lock: ${marginPdf} PDF p.28 / printed p.17`
    },
    Slurry: {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.9.4 slurry pumps; local page-lock: ${marginPdf} PDF p.29 / printed p.18`
    },
    Irrigation: {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.10.4 irrigation pumps; local page-lock: ${marginPdf} PDF p.30 / printed p.19`
    }
  });

  function numberOrNull(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
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
      : userDefined;
    const basis = rawProps.npshMarginBasis || generalPurpose;

    if (basis === configuredUserDefined) {
      const ratio = numberOrNull(rawProps.minNpshMarginRatio);
      const margin = numberOrNull(rawProps.minNpshMargin);
      const terms = criteriaTerms({ ratio, margin });
      const valid = terms.valid;
      if (!valid && !Number.isFinite(ratio) && !Number.isFinite(margin)) {
        return getEffectivePumpNpshMarginCriteria({ ...rawProps, npshMarginBasis: generalPurpose }, regionStatus);
      }
      return {
        basis,
        regionBasis: "user",
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

    const preset = presets[basis];
    if (!preset) {
      return {
        basis,
        regionBasis: "-",
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

  global.PUMP_NPSH_MARGIN_PRESETS = global.PUMP_NPSH_MARGIN_PRESETS || presets;
  global.getEffectivePumpNpshMarginCriteria = global.getEffectivePumpNpshMarginCriteria || getEffectivePumpNpshMarginCriteria;
}("undefined" != typeof window ? window : globalThis);
