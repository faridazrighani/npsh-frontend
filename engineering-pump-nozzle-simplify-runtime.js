!function(root) {
  "use strict";

  const VERSION = "2026.06-pump-nozzle-simplify5";
  const STYLE_ID = "pumpNozzleSimplifyRuntimeStyle";
  const HIDDEN_MAIN_KEYS = new Set(["elevation", "dischargeElevation"]);
  const HIDDEN_STATUS_KEYS = new Set(["npshEvaluationMode", "pump-input-readiness"]);
  const HIDDEN_PROPOSAL_SELECTORS = [
    ".pump-optimization-proposal",
    ".caption-audit-proposal-action-status"
  ];
  const PUMP_DATUM_KEY = "suctionElevation";
  const PUMP_DATUM_LABEL = "Pump Datum Elev.";
  const PUMP_DATUM_LONG_LABEL = "Pump datum elevation";
  const PUMP_WINDOW_SELECTOR = [
    "#taskWindow",
    ".persistent-object-properties-task-window"
  ].join(",");
  let observer = null;

  function installStyle() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-pump-basic-nozzle-hidden="true"] {
        display: none !important;
        visibility: hidden !important;
      }
      [data-pump-optimization-summary-hidden="true"] {
        display: none !important;
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
  }

  function findFieldContainer(field) {
    if (!field) return null;
    const direct = field.closest([
      ".pipe-task-field-row",
      ".tank-task-field-row",
      ".object-task-field-row",
      ".prop-row",
      ".property-row",
      ".field-row",
      ".form-row",
      ".task-field-row",
      "tr"
    ].join(","));
    if (direct) return direct;

    let node = field.parentElement;
    for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
      const inputCount = node.querySelectorAll?.("input, select, textarea")?.length || 0;
      if (inputCount <= 1) return node;
    }
    return field.parentElement;
  }

  function replacePumpDatumText(value) {
    if (value === null || value === undefined) return value;
    return String(value)
      .replace(/Suction\s+Nozzle\s+Elevation/gi, PUMP_DATUM_LONG_LABEL)
      .replace(/Suction\s+Nozzle\s+Elev\.(?![A-Za-z])/gi, PUMP_DATUM_LABEL);
  }

  function updatePumpDatumAttributes(element) {
    if (!element?.getAttribute || !element?.setAttribute) return;
    ["aria-label", "title", "placeholder", "data-i18n-fallback", "data-i18n-text-fallback"].forEach((attribute) => {
      const current = element.getAttribute(attribute);
      const next = replacePumpDatumText(current);
      if (next !== current) element.setAttribute(attribute, next);
    });
  }

  function renamePumpDatumLabel(field) {
    const container = findFieldContainer(field);
    if (!container) return;
    container.dataset.pumpDatumLabel = "true";
    updatePumpDatumAttributes(field);
    updatePumpDatumAttributes(container);

    const labels = Array.from(field.labels || []);
    const candidates = [
      ...labels,
      ...Array.from(container.querySelectorAll?.("span, label, div, th, td") || [])
    ];
    candidates.forEach((candidate) => {
      updatePumpDatumAttributes(candidate);
      if (candidate.querySelector?.("input, select, textarea")) return;
      const current = candidate.textContent;
      const next = replacePumpDatumText(current);
      if (next !== current) candidate.textContent = next;
    });

    Array.from(container.childNodes || []).forEach((node) => {
      if (node.nodeType !== 3) return;
      const next = replacePumpDatumText(node.textContent);
      if (next !== node.textContent) node.textContent = next;
    });
  }

  function isPumpPropertiesWindow(windowNode) {
    if (!windowNode) return false;
    const kind = String(windowNode.dataset?.kind || "").toLowerCase();
    if (kind === "object") {
      const nodeId = windowNode.dataset?.nodeId || "";
      const model = root.__npshGlobalModel || root.globalModel || {};
      if (nodeId && model?.[nodeId]?.type && model[nodeId].type !== "pump") return false;
    }
    return !!windowNode.querySelector?.('[data-key="suctionElevation"], [data-key="designNpshr"], [data-key="bepFlow"]');
  }

  function hideRedundantPumpProposalSummary(windowNode) {
    if (!windowNode) return;
    HIDDEN_PROPOSAL_SELECTORS.forEach((selector) => {
      windowNode.querySelectorAll?.(selector)?.forEach((element) => {
        element.dataset.pumpOptimizationSummaryHidden = "true";
        element.setAttribute("aria-hidden", "true");
      });
    });
  }

  function simplifyPumpNozzleInputs(scope = document) {
    if (typeof document === "undefined") return;
    installStyle();
    const rootScope = scope?.querySelectorAll ? scope : document;
    rootScope.querySelectorAll(PUMP_WINDOW_SELECTOR).forEach((windowNode) => {
      if (!isPumpPropertiesWindow(windowNode)) return;
      hideRedundantPumpProposalSummary(windowNode);
      windowNode.querySelectorAll("[data-key]").forEach((field) => {
        if (field.dataset.key === PUMP_DATUM_KEY) {
          renamePumpDatumLabel(field);
          return;
        }
        if (!HIDDEN_MAIN_KEYS.has(field.dataset.key) && !HIDDEN_STATUS_KEYS.has(field.dataset.key)) return;
        const container = findFieldContainer(field);
        if (container) {
          container.dataset.pumpBasicNozzleHidden = "true";
          container.setAttribute("aria-hidden", "true");
        }
      });
    });
  }

  function scheduleSimplify(scope) {
    root.clearTimeout?.(root.__pumpNozzleSimplifyTimer);
    root.__pumpNozzleSimplifyTimer = root.setTimeout?.(() => simplifyPumpNozzleInputs(scope || document), 40);
  }

  function installObserver() {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined" || observer) return;
    const target = document.body || document.documentElement;
    if (!target) return;
    observer = new MutationObserver((mutations) => {
      if ((mutations || []).some((mutation) => (
        mutation.type === "childList"
        || (mutation.type === "attributes" && mutation.target?.matches?.(PUMP_WINDOW_SELECTOR))
      ))) {
        scheduleSimplify(document);
      }
    });
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-kind", "data-node-id", "hidden", "class"]
    });
  }

  root.simplifyPumpNozzleInputs = simplifyPumpNozzleInputs;
  root.__pumpNozzleSimplifyRuntimeVersion = VERSION;

  if (typeof document !== "undefined") {
    installStyle();
    scheduleSimplify(document);
    installObserver();
    document.addEventListener("DOMContentLoaded", () => scheduleSimplify(document));
    document.addEventListener("click", () => scheduleSimplify(document), true);
    document.addEventListener("input", () => scheduleSimplify(document), true);
  }
}("undefined" != typeof window ? window : globalThis);
