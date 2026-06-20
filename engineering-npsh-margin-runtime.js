!function (global) {
  "use strict";

  const userDefined = "User Defined";
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
    "Chemical Process": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.3.4 chemical process pumps; local page-lock: ${marginPdf} PDF p.23 / printed p.12`
    },
    "Water/Wastewater": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.6.4 water/wastewater pumps; local page-lock: ${marginPdf} PDF p.26 / printed p.15`
    },
    "Building Services": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: `ANSI/HI 9.6.1-2024 Table 9.6.1.4.8.4 building services pumps; local page-lock: ${marginPdf} PDF p.28 / printed p.17`
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
    return String(regionStatus || "").trim().toUpperCase() === "POR" ? "por" : "aor";
  }

  function getEffectivePumpNpshMarginCriteria(rawProps = {}, regionStatus = "POR") {
    const configuredUserDefined = typeof global.PUMP_NPSH_MARGIN_USER_DEFINED === "string"
      ? global.PUMP_NPSH_MARGIN_USER_DEFINED
      : userDefined;
    const basis = rawProps.npshMarginBasis || configuredUserDefined;

    if (basis === configuredUserDefined) {
      const ratio = numberOrNull(rawProps.minNpshMarginRatio);
      const margin = numberOrNull(rawProps.minNpshMargin);
      const valid = Number.isFinite(ratio) && Number.isFinite(margin);
      return {
        basis,
        regionBasis: "user",
        ratio,
        margin,
        valid,
        source: "User configured limit",
        reference: "User-defined NPSH margin basis",
        warnings: valid ? [] : ["Min NPSH Ratio and Min NPSH Margin are required for user-defined margin basis."]
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

  global.PUMP_NPSH_MARGIN_PRESETS = global.PUMP_NPSH_MARGIN_PRESETS || presets;
  global.getEffectivePumpNpshMarginCriteria = global.getEffectivePumpNpshMarginCriteria || getEffectivePumpNpshMarginCriteria;
}("undefined" != typeof window ? window : globalThis);
