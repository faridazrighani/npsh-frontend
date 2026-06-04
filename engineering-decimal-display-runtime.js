!function(root) {
  "use strict";

  const LOCK_VERSION = "2026.06-engineering-decimal-display-lock1";
  const ENGINEERING_DISPLAY_DECIMALS = 3;
  const NUMERIC_TOKEN_PATTERN = /[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[-+]?\d+)?/gi;
  const NUMERIC_EXPRESSION_PATTERN = /^\s*[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[-+]?\d+)?(?:\s*\/\s*[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[-+]?\d+)?)*\s*$/i;
  const ENGINEERING_UNIT_PATTERN = /\b(?:m3\/h|m3\/s|m\/s|bar\s*a|bar\s*g|bar|mbar|kpa|pa|m|deg\s*c|kg\/m3|cst|kw|%|ratio)\b/i;
  const LIVE_ROW_SELECTOR = [
    ".pump-live-param-row",
    ".source-live-param-row",
    ".sink-live-param-row",
    ".tank-live-param-row",
    ".line-monitor-readout-row"
  ].join(", ");
  const LABEL_SELECTOR = [
    ".pump-live-param-label",
    ".source-live-param-label",
    ".sink-live-param-label",
    ".tank-live-param-label",
    ".line-monitor-readout-label",
    "[class*='live-param-label']",
    "[class*='readout-label']"
  ].join(", ");
  const VALUE_SELECTOR = [
    "strong",
    "[data-readout-key]",
    "[class*='live-param-value']",
    "[class*='readout-value']"
  ].join(", ");
  const NUMERIC_LABELS = new Set([
    "AOR Max",
    "AOR Min",
    "Basis Vapor Press.",
    "Boundary Press.",
    "Calculated Press.",
    "Contribution",
    "Density",
    "Design Flow",
    "Design Head",
    "Design NPSHr",
    "Disch. Loss",
    "Discharge Loss",
    "Discharge Press.",
    "Dyn Feed",
    "Dyn Net",
    "Dynamic Inlet",
    "Dynamic Level Rate",
    "Dynamic Net",
    "Eff.",
    "Efficiency",
    "Fill",
    "Flow",
    "Flow Demand",
    "Head",
    "Head Residual",
    "Level",
    "Mass Flow",
    "NPSH Available",
    "NPSH Margin",
    "NPSH Ratio",
    "NPSH Required",
    "Outlet Flow",
    "POR Max",
    "POR Min",
    "Pipe Endpoint Press.",
    "Power",
    "Pressure",
    "Pressure Residual",
    "Pump Head",
    "Pump NPSH Margin",
    "Required Head",
    "Required Press.",
    "Required System Head",
    "SNK Flow",
    "Source Elev.",
    "Source Head",
    "Source Press.",
    "Stagnation Press.",
    "Static Press.",
    "Suction Loss",
    "Suction Press.",
    "Target",
    "Target Net",
    "Temperature",
    "Velocity Head",
    "Vapor Margin",
    "Vapor Press.",
    "Vapor Press. Used",
    "Viscosity"
  ]);
  const NON_NUMERIC_LABELS = new Set([
    "Basis",
    "Boundary",
    "Data Confidence",
    "Dominant Loss",
    "Dyn Mode",
    "Mode",
    "NPSHr Source",
    "Operating Region",
    "Route",
    "Source",
    "Status",
    "Target Trend",
    "Trend"
  ]);

  let pendingNormalize = false;

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function formatNumber(value) {
    const raw = String(value ?? "").trim();
    const number = Number(raw.replace(",", "."));
    if (!Number.isFinite(number)) return raw;
    const fixed = number.toFixed(ENGINEERING_DISPLAY_DECIMALS);
    return raw.startsWith("+") && number >= 0 ? `+${fixed}` : fixed;
  }

  function isNumericExpression(value) {
    return NUMERIC_EXPRESSION_PATTERN.test(String(value ?? ""));
  }

  function formatNumericExpression(value) {
    const text = String(value ?? "");
    if (!isNumericExpression(text)) return text;
    return text.replace(NUMERIC_TOKEN_PATTERN, (token) => formatNumber(token));
  }

  function getRowLabel(row) {
    const labelEl = row?.querySelector?.(LABEL_SELECTOR);
    if (labelEl) return normalizeText(labelEl.textContent);
    const text = normalizeText(row?.textContent);
    const valueEl = row?.querySelector?.(VALUE_SELECTOR);
    const valueText = normalizeText(valueEl?.textContent);
    return valueText ? normalizeText(text.replace(valueText, "")) : text;
  }

  function getRowUnit(row, valueEl) {
    const explicit = row?.querySelector?.("[class*='unit'], [data-readout-unit]");
    const unitText = normalizeText(explicit?.textContent);
    if (unitText) return unitText;
    const rowText = normalizeText(row?.textContent);
    const valueText = normalizeText(valueEl?.textContent);
    return valueText ? normalizeText(rowText.replace(getRowLabel(row), "").replace(valueText, "")) : "";
  }

  function shouldFormatValue(label, value, unit) {
    const normalizedLabel = normalizeText(label);
    if (!isNumericExpression(value)) return false;
    if (NON_NUMERIC_LABELS.has(normalizedLabel)) return false;
    if (NUMERIC_LABELS.has(normalizedLabel)) return true;
    if (ENGINEERING_UNIT_PATTERN.test(unit)) return true;
    return /(?:flow|head|press|pressure|loss|npsh|margin|ratio|vapor|temp|eff|power|level|residual|density|viscosity)/i.test(normalizedLabel);
  }

  function formatElementValue(element, label, unit) {
    if (!element) return false;
    const before = normalizeText(element.textContent);
    if (!shouldFormatValue(label, before, unit)) return false;
    const after = formatNumericExpression(before);
    if (after === before) return false;
    element.textContent = after;
    element.dataset.engineeringDecimalDisplayLock = LOCK_VERSION;
    return true;
  }

  function normalizeRow(row) {
    const valueEl = row?.querySelector?.(VALUE_SELECTOR);
    if (!valueEl) return false;
    const label = getRowLabel(row);
    const unit = getRowUnit(row, valueEl);
    return formatElementValue(valueEl, label, unit);
  }

  function normalizeCanvasReadout(readout) {
    const key = normalizeText(readout?.getAttribute?.("data-readout-key"));
    return formatElementValue(readout, key, "canvas-readout");
  }

  function normalizeScope(scope) {
    if (typeof document === "undefined") return 0;
    const rootNode = scope && scope.querySelectorAll ? scope : document;
    let changed = 0;
    rootNode.querySelectorAll?.(LIVE_ROW_SELECTOR).forEach((row) => {
      if (normalizeRow(row)) changed += 1;
    });
    rootNode.querySelectorAll?.("[data-readout-key]").forEach((readout) => {
      if (normalizeCanvasReadout(readout)) changed += 1;
    });
    if (document.documentElement) {
      document.documentElement.dataset.engineeringDecimalDisplayLock = LOCK_VERSION;
      document.documentElement.dataset.engineeringDecimalDisplayDecimals = String(ENGINEERING_DISPLAY_DECIMALS);
      document.documentElement.dataset.engineeringDecimalDisplayLastChanges = String(changed);
    }
    return changed;
  }

  function scheduleNormalize(scope) {
    if (pendingNormalize) return;
    pendingNormalize = true;
    const run = () => {
      pendingNormalize = false;
      normalizeScope(scope || document);
    };
    if (typeof root.requestAnimationFrame === "function") {
      root.requestAnimationFrame(() => root.setTimeout(run, 0));
    } else {
      root.setTimeout(run, 0);
    }
  }

  function watchRealtimeChanges() {
    if (typeof MutationObserver === "undefined" || typeof document === "undefined" || !document.body) return;
    if (root.__engineeringDecimalDisplayObserver) return;
    root.__engineeringDecimalDisplayObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          scheduleNormalize(document);
          return;
        }
        for (const node of mutation.addedNodes || []) {
          if (node && node.nodeType === 1) {
            scheduleNormalize(node);
            return;
          }
        }
      }
    });
    root.__engineeringDecimalDisplayObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function install() {
    root.__engineeringDecimalDisplayLock = LOCK_VERSION;
    normalizeScope(document);
    watchRealtimeChanges();
  }

  root.EngineeringDecimalDisplayRuntime = {
    version: LOCK_VERSION,
    decimals: ENGINEERING_DISPLAY_DECIMALS,
    formatNumber,
    formatNumericExpression,
    shouldFormatValue,
    normalize: normalizeScope,
    scheduleNormalize
  };

  if (typeof document !== "undefined") {
    install();
    let attempts = 0;
    const installTimer = root.setInterval(() => {
      attempts += 1;
      install();
      if (attempts >= 240) root.clearInterval(installTimer);
    }, 250);

    ["DOMContentLoaded", "load", "input", "change", "click", "keyup", "pointerup"].forEach((eventName) => {
      root.addEventListener?.(eventName, () => scheduleNormalize(document), { passive: true, capture: true });
    });
  }
}(typeof window !== "undefined" ? window : globalThis);
