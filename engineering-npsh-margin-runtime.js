!function (global) {
  "use strict";

  const userDefined = "User Defined";
  const presets = Object.freeze({
    "General Purpose": {
      por: { ratio: 1.05, margin: 0.6 },
      aor: { ratio: 1.1, margin: 1.0 },
      reference: "ANSI/HI 9.6.1-2024 NPSH margin guidance; local page-lock: book_pdf/Hydraulic_Institute_2024_Rotodynamic_Pumps_Guideline_for_NPSH_Margin.pdf p.12"
    },
    "Petroleum/Hydrocarbon": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.1, margin: 1.0 },
      reference: "ANSI/HI 9.6.1-2024 petroleum/hydrocarbon NPSH margin guidance; local page-lock: book_pdf/Hydraulic_Institute_2024_Rotodynamic_Pumps_Guideline_for_NPSH_Margin.pdf p.12"
    },
    "Chemical Process": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: "ANSI/HI 9.6.1-2024 chemical process NPSH margin guidance; local page-lock: book_pdf/Hydraulic_Institute_2024_Rotodynamic_Pumps_Guideline_for_NPSH_Margin.pdf p.12"
    },
    "Water/Wastewater": {
      por: { ratio: 1.1, margin: 1.0 },
      aor: { ratio: 1.2, margin: 1.5 },
      reference: "ANSI/HI 9.6.1-2024 water/wastewater NPSH margin guidance; local page-lock: book_pdf/Hydraulic_Institute_2024_Rotodynamic_Pumps_Guideline_for_NPSH_Margin.pdf p.12"
    },
    "Building Services": {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.1, margin: 0.6 },
      reference: "ANSI/HI 9.6.1-2024 building services NPSH margin guidance; local page-lock: book_pdf/Hydraulic_Institute_2024_Rotodynamic_Pumps_Guideline_for_NPSH_Margin.pdf p.12"
    },
    Irrigation: {
      por: { ratio: 1.1, margin: 0.6 },
      aor: { ratio: 1.2, margin: 1.0 },
      reference: "ANSI/HI 9.6.1-2024 irrigation NPSH margin guidance; local page-lock: book_pdf/Hydraulic_Institute_2024_Rotodynamic_Pumps_Guideline_for_NPSH_Margin.pdf p.12"
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

    const selectedRegion = regionKey(regionStatus);
    const selected = preset[selectedRegion] || preset.aor || preset.por;
    return {
      basis,
      regionBasis: selectedRegion.toUpperCase(),
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
