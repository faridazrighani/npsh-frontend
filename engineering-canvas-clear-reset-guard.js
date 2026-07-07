(function installCanvasClearResetGuard(root) {
  "use strict";

  const VERSION = "2026.07-canvas-clear-reset-guard2";
  const CLEAR_IN_PROGRESS_FLAG = "__npshCanvasClearInProgress";
  const CLEAR_EMPTY_FLAG = "__npshCanvasClearEmpty";
  const PATCH_FLAG = "__canvasClearResetGuard";
  const INSTALL_RETRY_LIMIT = 80;
  const INSTALL_RETRY_MS = 80;

  const REMOVABLE_CANVAS_SELECTORS = [
    ".pfd-object",
    ".pump-live-params",
    ".source-live-params",
    ".sink-live-params",
    ".tank-live-params",
    ".source-canvas-parameter",
    ".sink-canvas-parameter",
    ".tank-canvas-parameter",
    ".pipe-hydraulic-label",
    ".pipe-delta-label",
    ".route-trace-canvas-overlay",
    ".route-trace-canvas-overlay-hidden"
  ];

  function getDocument() {
    return root.document || null;
  }

  function getCanvas() {
    return getDocument()?.getElementById?.("canvas") || null;
  }

  function getScrollableTargets() {
    const documentRef = getDocument();
    const canvas = getCanvas();
    return [
      canvas,
      canvas?.parentElement,
      documentRef?.querySelector?.(".main-workspace"),
      documentRef?.scrollingElement,
      documentRef?.documentElement,
      documentRef?.body
    ].filter(Boolean);
  }

  function setScrollOrigin(element) {
    if (!element) return;
    try {
      if (typeof element.scrollTo === "function") element.scrollTo({ left: 0, top: 0, behavior: "auto" });
    } catch (error) {
      try {
        element.scrollTo(0, 0);
      } catch (_) {
        // Keep clearing even if one browser rejects scroll options.
      }
    }
    if ("scrollLeft" in element) element.scrollLeft = 0;
    if ("scrollTop" in element) element.scrollTop = 0;
  }

  function resetCanvasWarningPanel(options = {}) {
    const documentRef = getDocument();
    const warningPanel = documentRef?.getElementById?.("canvasWarningPanel");
    if (!warningPanel) return;
    delete warningPanel.dataset.userMoved;
    delete warningPanel.dataset.viewportLeft;
    delete warningPanel.dataset.viewportTop;
    warningPanel.style.left = "";
    warningPanel.style.top = "";
    warningPanel.style.right = "";
    warningPanel.style.bottom = "";
    warningPanel.style.transform = "";
    if (options.hideWarnings) {
      warningPanel.hidden = true;
      warningPanel.classList.remove("has-warnings", "is-collapsed");
      warningPanel.setAttribute("aria-expanded", "true");
      const count = documentRef.getElementById("canvasWarningCount");
      if (count) count.textContent = "0";
      const list = documentRef.getElementById("canvasWarningList");
      if (list) {
        list.replaceChildren();
        const empty = documentRef.createElement("div");
        empty.className = "canvas-warning-empty";
        empty.dataset.i18nText = "canvas.noActiveWarnings";
        empty.textContent = "No active warnings";
        list.appendChild(empty);
      }
    }
    try {
      root.positionCanvasWarningPanelDefault?.();
    } catch (error) {
      console.warn("Canvas warning panel reset failed.", error);
    }
  }

  function closeCanvasContextMenu() {
    const menu = getDocument()?.getElementById?.("canvasContextMenu");
    if (!menu) return;
    menu.hidden = true;
    menu.classList.remove("show", "is-open", "open");
    menu.style.left = "";
    menu.style.top = "";
  }

  function clearSvgLines() {
    const svg = getDocument()?.getElementById?.("svg-lines");
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function removeCanvasArtifacts() {
    const documentRef = getDocument();
    const canvas = getCanvas();
    if (!documentRef || !canvas) return;
    const stableRuntime = root.EngineeringLiveParameterStableRuntime;
    try {
      stableRuntime?.clearTrackedPanels?.(canvas);
      stableRuntime?.clearTrackedPanels?.(documentRef);
    } catch (error) {
      console.warn("Live parameter clear hook failed.", error);
    }
    REMOVABLE_CANVAS_SELECTORS.forEach((selector) => {
      canvas.querySelectorAll?.(selector).forEach((node) => node.remove());
    });
    clearSvgLines();
    const connectHint = documentRef.getElementById("canvasConnectHint");
    if (connectHint) connectHint.hidden = true;
    closeCanvasContextMenu();
  }

  function refreshCanvasOverlays(options = {}) {
    const canvas = getCanvas();
    try {
      if (typeof root.drawConnections === "function" && !options.skipConnections) root.drawConnections();
    } catch (error) {
      console.warn("Canvas connection redraw after reset failed.", error);
    }
    try {
      root.refreshPipeCanvasHydraulicLabels?.(getDocument());
    } catch (error) {
      console.warn("Pipe label refresh after reset failed.", error);
    }
    try {
      const contextDock = root.CanvasContextDock || root.EngineeringCanvasContextDock;
      contextDock?.syncDockViewportAnchor?.(null, canvas);
      if (options.refreshDock !== false) contextDock?.refresh?.();
    } catch (error) {
      console.warn("Canvas context dock refresh after reset failed.", error);
    }
  }

  function resetCanvasView(options = {}) {
    getScrollableTargets().forEach(setScrollOrigin);
    resetCanvasWarningPanel(options);
    refreshCanvasOverlays(options);
    return true;
  }

  function clearTransientCanvasArtifacts(options = {}) {
    const previousClearFlag = root[CLEAR_IN_PROGRESS_FLAG] === true;
    root[CLEAR_IN_PROGRESS_FLAG] = true;
    root[CLEAR_EMPTY_FLAG] = true;
    removeCanvasArtifacts();
    resetCanvasWarningPanel({ hideWarnings: true });
    resetCanvasView({ hideWarnings: true, refreshDock: true, skipConnections: true });
    const documentRef = getDocument();
    try {
      documentRef?.dispatchEvent?.(
        new CustomEvent("npsh:canvas-cleared", {
          detail: { source: "canvas-clear-reset-guard", version: VERSION, options }
        })
      );
    } catch (_) {
      // CustomEvent is best-effort for older embedded webviews.
    }
    if (!options.keepClearInProgress) root[CLEAR_IN_PROGRESS_FLAG] = previousClearFlag;
    return true;
  }

  function scheduleRepeatedCleanup() {
    [0, 60, 180, 420, 900, 1600].forEach((delay) => {
      root.setTimeout?.(() => {
        if (root[CLEAR_EMPTY_FLAG] === true) clearTransientCanvasArtifacts({ scheduled: true, delay, keepClearInProgress: true });
      }, delay);
    });
  }

  function finishClear(success, previousEmptyFlag) {
    if (success) {
      root[CLEAR_EMPTY_FLAG] = true;
      clearTransientCanvasArtifacts({ final: true, keepClearInProgress: true });
      refreshCanvasOverlays({ skipConnections: true, refreshDock: true });
      scheduleRepeatedCleanup();
      root.setTimeout?.(() => {
        root[CLEAR_IN_PROGRESS_FLAG] = false;
      }, 1700);
      return;
    }
    root[CLEAR_EMPTY_FLAG] = previousEmptyFlag;
    root[CLEAR_IN_PROGRESS_FLAG] = false;
  }

  function patchClearSimulationCanvas() {
    const original = root.clearSimulationCanvas;
    if (typeof original !== "function" || original[PATCH_FLAG]) return false;
    function guardedClearSimulationCanvas(...args) {
      const previousEmptyFlag = root[CLEAR_EMPTY_FLAG] === true;
      root[CLEAR_IN_PROGRESS_FLAG] = true;
      root[CLEAR_EMPTY_FLAG] = true;
      let result;
      try {
        result = original.apply(this, args);
      } catch (error) {
        root[CLEAR_EMPTY_FLAG] = previousEmptyFlag;
        root[CLEAR_IN_PROGRESS_FLAG] = false;
        throw error;
      }
      if (result && typeof result.then === "function") {
        return result.then(
          (success) => {
            finishClear(success !== false, previousEmptyFlag);
            return success;
          },
          (error) => {
            root[CLEAR_EMPTY_FLAG] = previousEmptyFlag;
            root[CLEAR_IN_PROGRESS_FLAG] = false;
            throw error;
          }
        );
      }
      finishClear(result !== false, previousEmptyFlag);
      return result;
    }
    guardedClearSimulationCanvas[PATCH_FLAG] = VERSION;
    guardedClearSimulationCanvas.__canvasClearResetOriginal = original;
    root.clearSimulationCanvas = guardedClearSimulationCanvas;
    return true;
  }

  function patchResetCanvasViewFromMenu() {
    const original = root.resetCanvasViewFromMenu;
    if (typeof original !== "function" || original[PATCH_FLAG]) return false;
    function guardedResetCanvasViewFromMenu(...args) {
      const result = original.apply(this, args);
      resetCanvasView();
      [0, 60, 180].forEach((delay) => root.setTimeout?.(() => resetCanvasView(), delay));
      return result;
    }
    guardedResetCanvasViewFromMenu[PATCH_FLAG] = VERSION;
    guardedResetCanvasViewFromMenu.__canvasClearResetOriginal = original;
    root.resetCanvasViewFromMenu = guardedResetCanvasViewFromMenu;
    return true;
  }

  function bindMenuFallbacks() {
    const documentRef = getDocument();
    if (!documentRef || documentRef.documentElement?.dataset.canvasClearResetGuardBound === VERSION) return;
    documentRef.documentElement.dataset.canvasClearResetGuardBound = VERSION;
    documentRef.getElementById("menu-view-reset-canvas")?.addEventListener("click", () => {
      [0, 80, 180].forEach((delay) => root.setTimeout?.(() => resetCanvasView(), delay));
    });
    ["menu-clear-file", "menu-clear"].forEach((id) => {
      documentRef.getElementById(id)?.addEventListener("click", () => {
        root.setTimeout?.(() => {
          if (root[CLEAR_EMPTY_FLAG] === true) {
            clearTransientCanvasArtifacts({ menuFallback: id, keepClearInProgress: true });
            scheduleRepeatedCleanup();
          }
        }, 120);
      });
    });
  }

  function install(attempt = 0) {
    bindMenuFallbacks();
    const clearPatched = patchClearSimulationCanvas();
    const resetPatched = patchResetCanvasViewFromMenu();
    if ((!clearPatched || !resetPatched) && attempt < INSTALL_RETRY_LIMIT) {
      root.setTimeout?.(() => install(attempt + 1), INSTALL_RETRY_MS);
    }
    return clearPatched || resetPatched;
  }

  const api = {
    version: VERSION,
    clearTransientCanvasArtifacts,
    resetCanvasView,
    install
  };

  root.EngineeringCanvasClearResetGuard = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (getDocument()?.readyState === "loading") {
    getDocument().addEventListener("DOMContentLoaded", () => install(), { once: true });
  } else {
    install();
  }
})(typeof window !== "undefined" ? window : globalThis);
