/*
 * Pump canvas badge lock.
 *
 * The core canvas badge used to read cavitationStatus first. A freshly dragged
 * or incomplete pump can carry stale/default "Safe" values in legacy fields
 * while hydraulicNpshStatus correctly says Incomplete. This guard makes the
 * badge follow the current hydraulic calculation state.
 */
(function installPumpStatusVisualLock(root) {
  "use strict";

  const VERSION = "2026.07-pump-status-visual-lock2";
  const STATUS_CLASSES = [
    "pump-status-safe",
    "pump-status-warning",
    "pump-status-risk",
    "pump-status-incomplete"
  ];
  const BADGE_CLASSES = [
    "pump-status-badge-safe",
    "pump-status-badge-warning",
    "pump-status-badge-risk",
    "pump-status-badge-incomplete"
  ];
  const BADGE_LABELS = {
    safe: "Safe",
    warning: "Warning",
    risk: "NPSH Risk",
    incomplete: "Incomplete"
  };
  let pumpStatusObserver = null;
  let pumpStatusSyncQueued = false;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function lower(value) {
    return text(value).toLowerCase();
  }

  function finite(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function runtimeModel() {
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function runtimeConnections() {
    const direct = root.__npshConnections || root.connections || [];
    const modelConnections = runtimeModel().connections || [];
    return Array.isArray(direct) ? direct : (Array.isArray(modelConnections) ? modelConnections : []);
  }

  function isHydraulicConnection(connection) {
    return !connection?.connectionType || connection.connectionType === "hydraulic";
  }

  function pumpHasHydraulicRoute(pumpId) {
    if (!pumpId) return true;
    return runtimeConnections().some((connection) => (
      isHydraulicConnection(connection)
      && (connection.from === pumpId || connection.to === pumpId)
    ));
  }

  function statusValues(pump) {
    const results = pump?.results || {};
    const evaluation = results.npshEvaluation || {};
    return [
      results.hydraulicNpshStatus,
      evaluation.hydraulicStatus,
      evaluation.status,
      results.cavitationStatus,
      results.engineeringStatus,
      results.status,
      results.backendValidationStatus,
      results.calculationFreshness
    ].map(text).filter(Boolean);
  }

  function statusText(pump) {
    return statusValues(pump).join(" ").toLowerCase();
  }

  function firstResultNumber(pump, key) {
    const results = pump?.results || {};
    const evaluation = results.npshEvaluation || {};
    return finite(evaluation[key]) ?? finite(results[key]);
  }

  function hasCalculatedNpsha(pump) {
    return firstResultNumber(pump, "npsha") !== null;
  }

  function statusContains(values, pattern) {
    return values.some((value) => pattern.test(lower(value)));
  }

  function resolvePumpOperatingVisualStatus(pump, pumpId = "") {
    if (!pump || pump.type !== "pump") return "normal";

    const values = statusValues(pump);
    const joined = values.join(" ").toLowerCase();
    const hasNpsha = hasCalculatedNpsha(pump);
    const hasRoute = pumpHasHydraulicRoute(pumpId);
    const hardIncomplete = (
      statusContains(values, /\b(incomplete|input required|invalid|unknown|no operating solution)\b/i)
      || joined.includes("not connected")
    );
    const warnings = Array.isArray(pump.results?.warnings)
      ? pump.results.warnings.filter(Boolean)
      : [];

    if (!hasRoute) return "incomplete";
    if (statusContains(values, /\b(risk|cavitation risk|npsh risk)\b/i)) return "risk";
    if (hardIncomplete) return "incomplete";

    if (!hasNpsha && (
      !values.length
      || statusContains(values, /\b(unverified)\b/i)
      || joined.includes("not connected")
      || values.includes("-")
    )) {
      return "incomplete";
    }

    if (!hasNpsha) return "incomplete";

    if (
      warnings.length > 0
      || statusContains(values, /\b(warning|review|required|not provided|npsha calculated|stale|unverified|unavailable|timeout)\b/i)
    ) {
      return "warning";
    }

    if (statusContains(values, /\bsafe\b|\bok\b/i)) return "safe";
    return "warning";
  }

  function getObjectElement(pumpId) {
    if (typeof root.getObjectElement === "function") {
      const element = root.getObjectElement(pumpId);
      if (element) return element;
    }
    if (!root.document || !pumpId) return null;
    const elementId = `obj-${String(pumpId).toLowerCase().replace(/-/g, "")}`;
    return root.document.getElementById(elementId);
  }

  function syncPumpBadge(element, status) {
    const badge = element?.querySelector?.(".pump-status-badge");
    if (!badge) return;
    const label = BADGE_LABELS[status] || "";
    const nextClass = label ? `pump-status-badge-${status}` : "";
    const hasWrongClass = BADGE_CLASSES.some((className) => (
      badge.classList.contains(className) && className !== nextClass
    ));
    if (hasWrongClass || (nextClass && !badge.classList.contains(nextClass))) {
      badge.classList.remove(...BADGE_CLASSES);
      if (nextClass) badge.classList.add(nextClass);
    }
    if (badge.hidden === !!label) badge.hidden = !label;
    if (badge.textContent !== label) badge.textContent = label;
  }

  function syncPumpElement(pumpId, pump) {
    const element = getObjectElement(pumpId);
    if (!element) return false;
    const status = resolvePumpOperatingVisualStatus(pump, pumpId);
    const nextClass = status !== "normal" ? `pump-status-${status}` : "";
    const hasWrongClass = STATUS_CLASSES.some((className) => (
      element.classList.contains(className) && className !== nextClass
    ));
    if (hasWrongClass || (nextClass && !element.classList.contains(nextClass))) {
      element.classList.remove(...STATUS_CLASSES);
      if (nextClass) element.classList.add(nextClass);
    }
    if (element.dataset.operatingStatus !== status) element.dataset.operatingStatus = status;
    if (typeof root.getPumpOperatingStatusTooltip === "function") {
      element.title = root.getPumpOperatingStatusTooltip(pump, status);
    } else {
      element.title = `Hydraulic NPSH status: ${pump?.results?.hydraulicNpshStatus || status}`;
    }
    syncPumpBadge(element, status);
    if (typeof root.updatePumpLiveParameterPanel === "function") {
      root.updatePumpLiveParameterPanel(element, pump, status);
    }
    return true;
  }

  function syncAllPumpElements() {
    try {
      Object.entries(runtimeModel()).forEach(([nodeId, node]) => {
        if (node?.type === "pump") syncPumpElement(nodeId, node);
      });
    } catch (error) {
      // Best-effort visual refresh only.
    }
  }

  function schedulePumpStatusSync() {
    if (pumpStatusSyncQueued) return;
    pumpStatusSyncQueued = true;
    const flush = () => {
      pumpStatusSyncQueued = false;
      syncAllPumpElements();
    };
    if (typeof root.requestAnimationFrame === "function") {
      root.requestAnimationFrame(flush);
    } else {
      root.setTimeout?.(flush, 0);
    }
  }

  function installDomObserver() {
    if (!root.document || typeof root.MutationObserver !== "function" || pumpStatusObserver) return;
    const target = root.document.getElementById("pfdCanvas") || root.document.body;
    if (!target) return;
    pumpStatusObserver = new root.MutationObserver((mutations) => {
      const shouldSync = mutations.some((mutation) => {
        const node = mutation.target;
        if (node?.classList?.contains?.("pump-status-badge")) return true;
        if (node?.querySelector?.(".pump-status-badge")) return true;
        return Array.from(mutation.addedNodes || []).some((added) => (
          added?.classList?.contains?.("pump-status-badge")
          || added?.querySelector?.(".pump-status-badge")
        ));
      });
      if (shouldSync) schedulePumpStatusSync();
    });
    pumpStatusObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-operating-status"]
    });
  }

  function install() {
    const originalGet = root.getPumpOperatingVisualStatus;
    const originalUpdate = root.updateObjectOperatingStatusVisual;

    function lockedPumpOperatingVisualStatus(pump) {
      const model = runtimeModel();
      const pumpId = Object.keys(model).find((id) => model[id] === pump) || "";
      return resolvePumpOperatingVisualStatus(pump, pumpId);
    }

    lockedPumpOperatingVisualStatus.__pumpStatusVisualLock = true;
    root.getPumpOperatingVisualStatus = lockedPumpOperatingVisualStatus;

    if (typeof originalUpdate === "function" && !originalUpdate.__pumpStatusVisualLock) {
      const lockedUpdate = function lockedUpdateObjectOperatingStatusVisual(nodeId) {
        const node = runtimeModel()[nodeId];
        if (node?.type === "pump" && syncPumpElement(nodeId, node)) return;
        return originalUpdate.apply(this, arguments);
      };
      lockedUpdate.__pumpStatusVisualLock = true;
      root.updateObjectOperatingStatusVisual = lockedUpdate;
    }

    syncAllPumpElements();
    installDomObserver();
  }

  const api = {
    VERSION,
    resolvePumpOperatingVisualStatus,
    syncAllPumpElements,
    install
  };

  root.NpshPumpStatusVisualLock = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (typeof root.window !== "undefined") {
    install();
    root.document?.addEventListener?.("DOMContentLoaded", install, { once: true });
    root.setTimeout?.(install, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
