!function (global) {
  "use strict";

  const panelSelector = '[data-caption-audit-pump-action-readiness="true"], .caption-audit-pump-action-readiness';
  const debugParams = ["debugPumpReadiness", "showPumpActionReadiness"];
  let readinessObserver = null;

  function readRuntimeConfig() {
    const existing = global.NPSH_RUNTIME_CONFIG && typeof global.NPSH_RUNTIME_CONFIG === "object"
      ? global.NPSH_RUNTIME_CONFIG
      : {};
    const element = typeof document !== "undefined"
      ? document.getElementById("npsh-runtime-config")
      : null;
    if (!element) return existing;
    try {
      return { ...JSON.parse(element.textContent || "{}"), ...existing };
    } catch (error) {
      console.warn("Unable to parse NPSH runtime config for pump readiness visibility.", error);
      return existing;
    }
  }

  function hasDebugParam() {
    if (typeof URLSearchParams === "undefined" || !global.location) return false;
    const params = new URLSearchParams(global.location.search || "");
    return debugParams.some((name) => params.get(name) === "1" || params.get(name) === "true");
  }

  function shouldShowPumpActionReadinessPanel() {
    const config = readRuntimeConfig();
    return config.showPumpActionReadinessPanel === true || hasDebugParam();
  }

  function removePumpActionReadinessPanels(root) {
    if (typeof document === "undefined") return;
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(panelSelector).forEach((element) => element.remove());
    if (root && root.matches && root.matches(panelSelector)) root.remove();
  }

  function addedPumpReadinessPanel(mutations) {
    return Array.from(mutations || []).some((mutation) => (
      Array.from(mutation.addedNodes || []).some((node) => (
        node?.nodeType === 1
        && (node.matches?.(panelSelector) || node.querySelector?.(panelSelector))
      ))
    ));
  }

  function installHiddenStyle() {
    if (typeof document === "undefined" || document.getElementById("pump-readiness-visibility-style")) return;
    const style = document.createElement("style");
    style.id = "pump-readiness-visibility-style";
    style.textContent = `${panelSelector}{display:none!important;visibility:hidden!important;}`;
    document.head.appendChild(style);
  }

  function scheduleGuardRefresh() {
    if (typeof document === "undefined" || shouldShowPumpActionReadinessPanel()) return;
    global.clearTimeout?.(global.__pumpReadinessVisibilityRefreshTimer);
    global.__pumpReadinessVisibilityRefreshTimer = global.setTimeout?.(() => {
      installHiddenStyle();
      removePumpActionReadinessPanels(document);
    }, 80);
  }

  function installMutationGuard() {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined" || readinessObserver) return;
    const target = document.body || document.documentElement;
    if (!target) return;
    readinessObserver = new MutationObserver((mutations) => {
      if (shouldShowPumpActionReadinessPanel()) return;
      if (addedPumpReadinessPanel(mutations)) scheduleGuardRefresh();
    });
    readinessObserver.observe(target, { childList: true, subtree: true });
  }

  function installGuard() {
    if (typeof document === "undefined") return false;
    if (shouldShowPumpActionReadinessPanel()) {
      document.documentElement.dataset.showPumpActionReadinessPanel = "true";
      readinessObserver?.disconnect?.();
      readinessObserver = null;
      return true;
    }

    delete document.documentElement.dataset.showPumpActionReadinessPanel;
    installHiddenStyle();
    removePumpActionReadinessPanels(document);
    installMutationGuard();
    return false;
  }

  global.shouldShowPumpActionReadinessPanel = shouldShowPumpActionReadinessPanel;
  global.removePumpActionReadinessPanels = removePumpActionReadinessPanels;

  if (typeof document !== "undefined") {
    installGuard();
    document.addEventListener("DOMContentLoaded", installGuard);
    global.addEventListener?.("load", installGuard);
    document.addEventListener("click", scheduleGuardRefresh, true);
    document.addEventListener("pointerup", scheduleGuardRefresh, true);
  }
}("undefined" != typeof window ? window : globalThis);
