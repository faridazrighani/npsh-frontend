/*
 * Simulation Case Menu Cleanup Runtime
 * Removes the retired Journal & Analysis Report action from every sample case menu.
 */
(function simulationCaseMenuCleanupFactory(root, factory) {
  const api = factory(root || globalThis);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EngineeringSimulationCaseMenuCleanup = api;
})(typeof window !== "undefined" ? window : globalThis, function createSimulationCaseMenuCleanup(root) {
  "use strict";

  const VERSION = "engineering-simulation-case-menu-cleanup.v1";
  const CACHE_KEY = "20260716-simulation-case-report-action-remove2";
  const MENU_SELECTOR = "#dropdown-simulate";
  const REPORT_ACTION_SELECTOR = '[data-simulation-case-action="report"]';
  const STYLE_ID = "engineering-simulation-case-menu-cleanup-style";

  let observer = null;

  function installStyle(documentRef = root.document) {
    if (!documentRef?.head || documentRef.getElementById?.(STYLE_ID)) return;
    const style = documentRef.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `${MENU_SELECTOR} ${REPORT_ACTION_SELECTOR}{display:none!important}`;
    documentRef.head.appendChild(style);
  }

  function removeReportActions(scope = root.document) {
    if (!scope) return 0;
    const actions = [];
    if (scope.matches?.(REPORT_ACTION_SELECTOR)) actions.push(scope);
    scope.querySelectorAll?.(REPORT_ACTION_SELECTOR)?.forEach((action) => actions.push(action));
    actions.forEach((action) => action.remove?.());
    return actions.length;
  }

  function blockRetiredAction(event) {
    const action = event.target?.closest?.(REPORT_ACTION_SELECTOR);
    if (!action?.closest?.(MENU_SELECTOR)) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    action.remove?.();
  }

  function observeMenu(menu) {
    if (!root.MutationObserver || observer) return;
    observer = new root.MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes?.forEach((node) => removeReportActions(node));
      });
    });
    observer.observe(menu, { childList: true, subtree: true });
  }

  function install(documentRef = root.document) {
    if (!documentRef) return false;
    installStyle(documentRef);
    const menu = documentRef.querySelector?.(MENU_SELECTOR);
    if (!menu) return false;
    removeReportActions(menu);
    observeMenu(menu);
    if (!documentRef.__engineeringSimulationCaseReportActionBlocked) {
      documentRef.addEventListener?.("click", blockRetiredAction, true);
      Object.defineProperty(documentRef, "__engineeringSimulationCaseReportActionBlocked", {
        value: true,
        configurable: true
      });
    }
    return true;
  }

  if (root.document?.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", () => install(), { once: true });
  } else {
    install();
  }

  return {
    VERSION,
    CACHE_KEY,
    MENU_SELECTOR,
    REPORT_ACTION_SELECTOR,
    install,
    removeReportActions
  };
});
