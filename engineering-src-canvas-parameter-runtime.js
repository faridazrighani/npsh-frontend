!function(root) {
  "use strict";

  const LOCK_VERSION = "2026.06-src-canvas-parameter-default-lock5";
  const ALWAYS_HIDDEN_ROWS = new Set(["Suction Loss", "NPSH at Pump", "Pump NPSHa"]);
  const DYNAMIC_ROWS = new Set(["Dyn Mode", "Target", "Dyn Feed", "Target Net", "Dyn Net", "Target Trend", "Dyn Trend"]);
  let realtimeMenuClickUnlocked = root.__srcDynamicInventoryDisplayUnlocked === true;
  let lastRealtimeMenuPointerAt = 0;
  let pendingRealtimeMenuUnlocked = null;

  function normalizeRowLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isRealtimeDynamicUnlocked() {
    return root.__srcDynamicInventoryDisplayUnlocked === true;
  }

  function setRealtimeDynamicUnlocked(value) {
    root.__srcDynamicInventoryDisplayUnlocked = value === true;
    realtimeMenuClickUnlocked = root.__srcDynamicInventoryDisplayUnlocked;
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.dataset.srcDynamicRowsUnlocked = root.__srcDynamicInventoryDisplayUnlocked ? "true" : "false";
    }
  }

  function filterSourceRows(rows) {
    if (!Array.isArray(rows)) return rows;
    const unlocked = isRealtimeDynamicUnlocked();
    return rows.filter((row) => {
      const label = normalizeRowLabel(row && row.label);
      return !ALWAYS_HIDDEN_ROWS.has(label) && (unlocked || !DYNAMIC_ROWS.has(label));
    });
  }

  function pruneRenderedSourceRows(scope) {
    if (isRealtimeDynamicUnlocked() || typeof document === "undefined") return;
    const rootNode = scope && scope.querySelectorAll ? scope : document;
    rootNode.querySelectorAll(".source-live-params .source-live-param-row").forEach((row) => {
      const label = normalizeRowLabel(row.querySelector(".source-live-param-label")?.textContent);
      if (ALWAYS_HIDDEN_ROWS.has(label) || DYNAMIC_ROWS.has(label)) row.remove();
    });
  }

  function requestSourceRefresh() {
    if (typeof root.updateSimulation === "function") {
      root.setTimeout(() => root.updateSimulation({ renderSidebarAfter: false }), 0);
      return;
    }
    root.setTimeout(() => pruneRenderedSourceRows(document), 0);
  }

  function installFunctionLocks() {
    root.__srcCanvasParameterDefaultLock = LOCK_VERSION;
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.dataset.srcCanvasParameterDefaultLock = LOCK_VERSION;
    }
    root.isSourceLiveDynamicDisplayActive = isRealtimeDynamicUnlocked;
    root.filterSourceLiveParameterRows = filterSourceRows;

    if (
      typeof root.buildSourceLiveParameterRows === "function"
      && root.buildSourceLiveParameterRows.__srcCanvasParameterDefaultLock !== LOCK_VERSION
    ) {
      const originalBuildSourceRows = root.buildSourceLiveParameterRows;
      const lockedBuildSourceRows = function(...args) {
        return filterSourceRows(originalBuildSourceRows.apply(this, args));
      };
      lockedBuildSourceRows.__srcCanvasParameterDefaultLock = LOCK_VERSION;
      lockedBuildSourceRows.__srcOriginalBuildSourceLiveParameterRows = originalBuildSourceRows;
      root.buildSourceLiveParameterRows = lockedBuildSourceRows;
    }

    if (
      typeof root.startDynamicInventoryRealtime === "function"
      && root.startDynamicInventoryRealtime.__srcCanvasParameterDefaultLock !== LOCK_VERSION
    ) {
      const originalStartRealtime = root.startDynamicInventoryRealtime;
      const lockedStartRealtime = function(...args) {
        setRealtimeDynamicUnlocked(true);
        const result = originalStartRealtime.apply(this, args);
        requestSourceRefresh();
        return result;
      };
      lockedStartRealtime.__srcCanvasParameterDefaultLock = LOCK_VERSION;
      root.startDynamicInventoryRealtime = lockedStartRealtime;
    }

    if (
      typeof root.stopDynamicInventoryRealtime === "function"
      && root.stopDynamicInventoryRealtime.__srcCanvasParameterDefaultLock !== LOCK_VERSION
    ) {
      const originalStopRealtime = root.stopDynamicInventoryRealtime;
      const lockedStopRealtime = function(...args) {
        const result = originalStopRealtime.apply(this, args);
        setRealtimeDynamicUnlocked(false);
        requestSourceRefresh();
        return result;
      };
      lockedStopRealtime.__srcCanvasParameterDefaultLock = LOCK_VERSION;
      root.stopDynamicInventoryRealtime = lockedStopRealtime;
    }

    pruneRenderedSourceRows(document);
  }

  function watchRealtimeMenuClicks() {
    if (typeof document === "undefined" || root.__srcCanvasParameterMenuClickLock) return;
    root.__srcCanvasParameterMenuClickLock = true;
    const handleRealtimeMenuEvent = (event) => {
      if (event.type === "click" && Date.now() - lastRealtimeMenuPointerAt < 500) {
        if (pendingRealtimeMenuUnlocked !== null) {
          root.setTimeout(() => {
            setRealtimeDynamicUnlocked(pendingRealtimeMenuUnlocked);
            pendingRealtimeMenuUnlocked = null;
            requestSourceRefresh();
          }, 0);
        }
        return;
      }
      const eventElement = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
      const button = eventElement?.closest?.("#menu-toggle-dynamic-realtime")
        || document.elementFromPoint?.(event.clientX, event.clientY)?.closest?.("#menu-toggle-dynamic-realtime");
      if (!button) return;
      if (event.type === "pointerdown") lastRealtimeMenuPointerAt = Date.now();

      const labelBeforeClick = normalizeRowLabel(button.textContent).toLowerCase();
      if (document.documentElement) {
        document.documentElement.dataset.srcRealtimeMenuEvent = `${event.type}:${labelBeforeClick}`;
      }
      root.setTimeout(() => {
        const labelAfterClick = normalizeRowLabel(button.textContent).toLowerCase();
        let nextUnlocked = isRealtimeDynamicUnlocked();
        if (labelAfterClick.includes("stop")) {
          nextUnlocked = true;
        } else if (labelBeforeClick.includes("stop")) {
          nextUnlocked = false;
        } else if (labelBeforeClick.includes("start")) {
          nextUnlocked = !realtimeMenuClickUnlocked;
        }
        pendingRealtimeMenuUnlocked = event.type === "pointerdown" ? nextUnlocked : null;
        setRealtimeDynamicUnlocked(nextUnlocked);
        requestSourceRefresh();
      }, 0);
    };
    document.addEventListener("pointerdown", handleRealtimeMenuEvent, true);
    document.addEventListener("click", handleRealtimeMenuEvent, true);
  }

  function watchRenderedRows() {
    if (typeof MutationObserver === "undefined" || typeof document === "undefined" || !document.body) return;
    if (root.__srcCanvasParameterDefaultLockObserver) return;
    root.__srcCanvasParameterDefaultLockObserver = new MutationObserver((mutations) => {
      if (isRealtimeDynamicUnlocked()) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
          if (node && node.nodeType === 1) pruneRenderedSourceRows(node);
        }
      }
    });
    root.__srcCanvasParameterDefaultLockObserver.observe(document.body, { childList: true, subtree: true });
  }

  function install() {
    installFunctionLocks();
    watchRealtimeMenuClicks();
    watchRenderedRows();
  }

  setRealtimeDynamicUnlocked(root.__srcDynamicInventoryDisplayUnlocked === true);
  install();

  let attempts = 0;
  const installTimer = root.setInterval(() => {
    attempts += 1;
    install();
    if (attempts >= 240) root.clearInterval(installTimer);
  }, 250);

  ["DOMContentLoaded", "load", "pointerdown", "keydown"].forEach((eventName) => {
    root.addEventListener?.(eventName, () => root.setTimeout(install, 0), { passive: true });
  });
}(typeof window !== "undefined" ? window : globalThis);
