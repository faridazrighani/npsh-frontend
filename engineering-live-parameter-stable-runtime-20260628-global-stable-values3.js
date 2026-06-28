!function(root) {
  "use strict";

  const VERSION = "2026.06-live-parameter-stable3";
  const PANEL_SELECTOR = ".pump-live-params, .tank-live-params, .source-live-params, .sink-live-params";
  const ROW_SELECTOR = ".pump-live-param-row, .tank-live-param-row, .source-live-param-row, .sink-live-param-row";
  const SECTION_SELECTOR = ".pump-live-param-section, .tank-live-param-section, .source-live-param-section, .sink-live-param-section";
  const LABEL_SELECTOR = ".pump-live-param-label, .tank-live-param-label, .source-live-param-label, .sink-live-param-label";
  const VALUE_SELECTOR = ".pump-live-param-value, .tank-live-param-value, .source-live-param-value, .sink-live-param-value, strong";
  const UNIT_SELECTOR = ".pump-live-param-unit, .tank-live-param-unit, .source-live-param-unit, .sink-live-param-unit";
  const SOLVER_EVENTS = [
    "npsh:calculation-start",
    "npsh:calculation-applying-results",
    "npsh:linked-views-refreshed",
    "npsh:calculation-current",
    "npsh:realtime-autosolve-complete"
  ];
  const PATCH_FUNCTIONS = [
    "updateSimulation",
    "drawConnections",
    "refreshBackendProtectedSimulationUi",
    "refreshBackendProtectedRealtimeTaskWindows",
    "refreshBackendProtectedSelectedObjectTaskWindow",
    "updateAllObjectOperatingStatusVisuals"
  ];
  const PLACEHOLDER_TEXT = new Set(["", "-", "–", "—"]);
  const BUSY_SETTLE_MS = 700;
  const RECONCILE_DELAY_MS = 90;

  const registry = new Map();
  const detachedPanels = new Map();
  const frozenGeometry = new WeakMap();
  const pendingPanelAttributes = new WeakMap();
  const pendingAttributePanels = new Set();
  const patchedFunctions = new Set();
  let observer = null;
  let reconcileTimer = null;
  let busyFlushTimer = null;
  let busyUntil = 0;
  let installAttempts = 0;

  function nowMs() {
    const value = root.performance?.now?.();
    return Number.isFinite(value) ? value : Date.now();
  }

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function panelKind(panel) {
    if (panel?.classList?.contains("pump-live-params")) return "pump";
    if (panel?.classList?.contains("source-live-params")) return "source";
    if (panel?.classList?.contains("sink-live-params")) return "sink";
    if (panel?.classList?.contains("tank-live-params")) return "tank";
    return "live";
  }

  function objectIdForPanel(panel) {
    const object = panel?.closest?.(".pfd-object, [data-node-id], [data-object-id]");
    const candidates = [
      panel?.dataset?.nodeId,
      panel?.dataset?.objectId,
      panel?.dataset?.pumpId,
      panel?.dataset?.sourceId,
      panel?.dataset?.sinkId,
      object?.dataset?.nodeId,
      object?.dataset?.objectId,
      object?.dataset?.pumpId,
      object?.dataset?.sourceId,
      object?.dataset?.sinkId,
      object?.id
    ].map(normalizeText).filter(Boolean);
    if (candidates.length) return candidates[0];
    const label = normalizeText(object?.querySelector?.(".object-label, .node-label, .equipment-label")?.textContent);
    return label || normalizeText(object?.textContent).slice(0, 80);
  }

  function panelKey(panel) {
    const kind = panelKind(panel);
    const objectId = objectIdForPanel(panel);
    if (objectId) return `${kind}:${objectId}`;
    const labels = rowLabels(panel).slice(0, 8).join("|");
    return `${kind}:anonymous:${labels}`;
  }

  function rowLabel(row) {
    return normalizeText(row?.querySelector?.(LABEL_SELECTOR)?.textContent);
  }

  function rowLabels(panel) {
    return Array.from(panel?.querySelectorAll?.(ROW_SELECTOR) || []).map(rowLabel).filter(Boolean);
  }

  function structureSignature(panel) {
    const parts = [];
    Array.from(panel?.children || []).forEach((child) => {
      if (child?.matches?.(SECTION_SELECTOR)) {
        parts.push(`section:${normalizeText(child.textContent).toUpperCase()}`);
      } else if (child?.matches?.(ROW_SELECTOR)) {
        parts.push(`row:${rowLabel(child)}`);
      }
    });
    return parts.join("||");
  }

  function panelRowsByLabel(panel) {
    const rows = new Map();
    Array.from(panel?.querySelectorAll?.(ROW_SELECTOR) || []).forEach((row) => {
      const label = rowLabel(row);
      if (label && !rows.has(label)) rows.set(label, row);
    });
    return rows;
  }

  function valueElement(row) {
    return row?.querySelector?.(VALUE_SELECTOR) || null;
  }

  function unitElement(row) {
    return row?.querySelector?.(UNIT_SELECTOR) || null;
  }

  function textIsPlaceholder(value) {
    return PLACEHOLDER_TEXT.has(normalizeText(value));
  }

  function hasMeaningfulValue(value) {
    return !textIsPlaceholder(value);
  }

  function isBusy() {
    return nowMs() < busyUntil;
  }

  function markBusy() {
    freezeAllPanelGeometry();
    busyUntil = Math.max(busyUntil, nowMs() + BUSY_SETTLE_MS);
    scheduleBusyFlush();
  }

  function freezePanelGeometry(panel) {
    if (!panel?.matches?.(PANEL_SELECTOR)) return;
    frozenGeometry.set(panel, {
      style: panel.getAttribute("style") || "",
      transform: panel.style?.transform || "",
      left: panel.style?.left || "",
      top: panel.style?.top || "",
      right: panel.style?.right || "",
      bottom: panel.style?.bottom || "",
      width: panel.style?.width || "",
      height: panel.style?.height || ""
    });
    panel.dataset.liveParameterStableGeometry = VERSION;
  }

  function freezeAllPanelGeometry(scope = document) {
    if (!scope?.querySelectorAll) return;
    scope.querySelectorAll(PANEL_SELECTOR).forEach(freezePanelGeometry);
  }

  function restorePanelGeometry(panel) {
    const frozen = frozenGeometry.get(panel);
    if (!isBusy() || !panel || !frozen) return 0;
    let changed = 0;
    const currentStyle = panel.getAttribute("style") || "";
    if (currentStyle !== frozen.style) {
      if (frozen.style) panel.setAttribute("style", frozen.style);
      else panel.removeAttribute("style");
      changed += 1;
    }
    ["transform", "left", "top", "right", "bottom", "width", "height"].forEach((property) => {
      if (panel.style?.[property] !== frozen[property]) {
        panel.style[property] = frozen[property];
        changed += 1;
      }
    });
    if (changed) panel.dataset.liveParameterStableGeometryRestored = VERSION;
    return changed;
  }

  function capturePanelAttributes(panel) {
    return {
      className: panel.className,
      style: panel.getAttribute("style"),
      title: panel.title || "",
      dataset: Object.fromEntries(Object.keys(panel.dataset || {}).map((key) => [key, panel.dataset[key]]))
    };
  }

  function applyPanelAttributes(target, attributes) {
    if (!target || !attributes) return 0;
    let changed = 0;
    const preserved = {
      liveParameterStableShell: target.dataset.liveParameterStableShell,
      liveParameterStableKey: target.dataset.liveParameterStableKey,
      liveParameterStableSignature: target.dataset.liveParameterStableSignature
    };
    if (target.className !== attributes.className) {
      target.className = attributes.className;
      changed += 1;
    }
    if (target.getAttribute("style") !== attributes.style) {
      if (attributes.style === null) target.removeAttribute("style");
      else target.setAttribute("style", attributes.style);
      changed += 1;
    }
    if (target.title !== attributes.title) {
      target.title = attributes.title || "";
      changed += 1;
    }
    Object.keys(attributes.dataset || {}).forEach((key) => {
      if (target.dataset[key] !== attributes.dataset[key]) {
        target.dataset[key] = attributes.dataset[key];
        changed += 1;
      }
    });
    Object.entries(preserved).forEach(([key, value]) => {
      if (value) target.dataset[key] = value;
    });
    if (changed) target.dataset.liveParameterStableAttributesFlushed = VERSION;
    return changed;
  }

  function rememberPendingPanelAttributes(target, source) {
    if (!target || !source) return;
    pendingPanelAttributes.set(target, capturePanelAttributes(source));
    pendingAttributePanels.add(target);
  }

  function flushPendingPanelAttributes() {
    busyFlushTimer = null;
    if (isBusy()) {
      scheduleBusyFlush();
      return;
    }
    pendingAttributePanels.forEach((panel) => {
      const attributes = pendingPanelAttributes.get(panel);
      pendingPanelAttributes.delete(panel);
      pendingAttributePanels.delete(panel);
      if (!panel?.isConnected || !attributes) return;
      applyPanelAttributes(panel, attributes);
      registerPanel(panel);
    });
  }

  function scheduleBusyFlush() {
    if (typeof root.setTimeout !== "function") return;
    root.clearTimeout?.(busyFlushTimer);
    busyFlushTimer = root.setTimeout(flushPendingPanelAttributes, BUSY_SETTLE_MS + 80);
  }

  function setTextIfChanged(element, value, options = {}) {
    if (!element) return 0;
    const next = String(value ?? "");
    if (options.skipTransientPlaceholder && textIsPlaceholder(next) && hasMeaningfulValue(element.textContent)) return 0;
    if (element.textContent === next) return 0;
    element.textContent = next;
    element.dataset.liveParameterStableValue = VERSION;
    return 1;
  }

  function copyPanelAttributes(target, source) {
    if (!target || !source) return 0;
    let changed = 0;
    if (isBusy()) rememberPendingPanelAttributes(target, source);
    else changed += applyPanelAttributes(target, capturePanelAttributes(source));
    changed += restorePanelGeometry(target);
    return changed;
  }

  function syncMatchingRows(target, source) {
    const targetRows = panelRowsByLabel(target);
    const sourceRows = panelRowsByLabel(source);
    let changed = 0;
    const skipTransientPlaceholder = isBusy();
    sourceRows.forEach((sourceRow, label) => {
      const targetRow = targetRows.get(label);
      if (!targetRow) return;
      const sourceValue = normalizeText(valueElement(sourceRow)?.textContent);
      const sourceUnit = normalizeText(unitElement(sourceRow)?.textContent);
      changed += setTextIfChanged(valueElement(targetRow), sourceValue, { skipTransientPlaceholder });
      changed += setTextIfChanged(unitElement(targetRow), sourceUnit);
      if (targetRow.title !== sourceRow.title) {
        targetRow.title = sourceRow.title || "";
        changed += 1;
      }
      targetRow.dataset.liveParameterStableRow = VERSION;
    });
    return changed;
  }

  function syncSections(target, source) {
    const targetSections = Array.from(target?.querySelectorAll?.(SECTION_SELECTOR) || []);
    const sourceSections = Array.from(source?.querySelectorAll?.(SECTION_SELECTOR) || []);
    if (targetSections.length !== sourceSections.length) return 0;
    let changed = 0;
    sourceSections.forEach((sourceSection, index) => {
      changed += setTextIfChanged(targetSections[index], sourceSection.textContent);
    });
    return changed;
  }

  function stabilizePanelFromReplacement(target, replacement) {
    if (!target || !replacement || target === replacement) return 0;
    const targetSignature = structureSignature(target);
    const replacementSignature = structureSignature(replacement);
    let changed = copyPanelAttributes(target, replacement);
    changed += syncSections(target, replacement);
    changed += syncMatchingRows(target, replacement);
    target.dataset.liveParameterStableShell = VERSION;
    target.dataset.liveParameterStableSignature = targetSignature || replacementSignature;
    if (targetSignature && replacementSignature && targetSignature !== replacementSignature && !isBusy()) {
      target.dataset.liveParameterStableStructureDrift = replacementSignature;
    }
    return changed;
  }

  function shouldAllowStructureReplacement(target, replacement) {
    const targetSignature = structureSignature(target);
    const replacementSignature = structureSignature(replacement);
    return !isBusy()
      && targetSignature
      && replacementSignature
      && targetSignature !== replacementSignature;
  }

  function removeReplacementPanel(panel) {
    if (!panel || !panel.parentNode) return false;
    panel.remove();
    return true;
  }

  function registerPanel(panel) {
    if (!panel?.matches?.(PANEL_SELECTOR)) return null;
    const key = panelKey(panel);
    panel.dataset.liveParameterStableShell = VERSION;
    panel.dataset.liveParameterStableKey = key;
    panel.dataset.liveParameterStableSignature = structureSignature(panel);
    registry.set(key, panel);
    if (!frozenGeometry.has(panel)) freezePanelGeometry(panel);
    return key;
  }

  function stabilizeAddedPanel(panel) {
    if (!panel?.matches?.(PANEL_SELECTOR)) return 0;
    const key = panelKey(panel);
    const existing = registry.get(key);
    if (existing && existing !== panel && existing.isConnected) {
      if (shouldAllowStructureReplacement(existing, panel)) {
        existing.replaceWith(panel);
        registerPanel(panel);
        return 1;
      }
      const changed = stabilizePanelFromReplacement(existing, panel);
      removeReplacementPanel(panel);
      registry.set(key, existing);
      return changed + 1;
    }
    const detached = detachedPanels.get(key);
    if (detached && detached !== panel && !detached.isConnected && panel.parentNode) {
      if (shouldAllowStructureReplacement(detached, panel)) {
        registerPanel(panel);
        detachedPanels.delete(key);
        return 0;
      }
      const changed = stabilizePanelFromReplacement(detached, panel);
      panel.replaceWith(detached);
      registry.set(key, detached);
      detachedPanels.delete(key);
      return changed + 1;
    }
    registerPanel(panel);
    return 0;
  }

  function panelNodesFromMutationNode(node) {
    if (!node || node.nodeType !== 1) return [];
    const panels = [];
    if (node.matches?.(PANEL_SELECTOR)) panels.push(node);
    node.querySelectorAll?.(PANEL_SELECTOR).forEach((panel) => panels.push(panel));
    return panels;
  }

  function restoreRemovedPanel(panel, mutation) {
    const parent = mutation?.target;
    if (!isBusy() || !panel || panel.isConnected || !parent?.isConnected || typeof parent.insertBefore !== "function") return false;
    const nextSibling = mutation.nextSibling?.parentNode === parent ? mutation.nextSibling : null;
    parent.insertBefore(panel, nextSibling);
    panel.dataset.liveParameterStableRestored = VERSION;
    restorePanelGeometry(panel);
    registerPanel(panel);
    scheduleReconcile(0);
    return true;
  }

  function captureRemovedPanel(panel, mutation) {
    const key = panel?.dataset?.liveParameterStableKey || panelKey(panel);
    if (!key) return;
    if (restoreRemovedPanel(panel, mutation)) return;
    detachedPanels.set(key, panel);
    root.setTimeout?.(() => {
      if (detachedPanels.get(key) === panel) detachedPanels.delete(key);
    }, 2500);
  }

  function reconcilePanels(scope = document) {
    if (!scope?.querySelectorAll) return 0;
    let changed = 0;
    scope.querySelectorAll(PANEL_SELECTOR).forEach((panel) => {
      changed += stabilizeAddedPanel(panel);
    });
    return changed;
  }

  function scheduleReconcile(delayMs = RECONCILE_DELAY_MS) {
    if (typeof root.setTimeout !== "function") return;
    root.clearTimeout?.(reconcileTimer);
    reconcileTimer = root.setTimeout(() => {
      reconcileTimer = null;
      reconcilePanels(document);
    }, Math.max(0, Number(delayMs) || 0));
  }

  function handleMutations(mutations) {
    let shouldReconcile = false;
    mutations.forEach((mutation) => {
      Array.from(mutation.removedNodes || []).forEach((node) => {
        panelNodesFromMutationNode(node).forEach((panel) => captureRemovedPanel(panel, mutation));
      });
      Array.from(mutation.addedNodes || []).forEach((node) => {
        const panels = panelNodesFromMutationNode(node);
        if (panels.length) shouldReconcile = true;
        panels.forEach((panel) => stabilizeAddedPanel(panel));
      });
      if (mutation.type === "characterData") {
        const panel = mutation.target?.parentElement?.closest?.(PANEL_SELECTOR);
        if (panel) registerPanel(panel);
      } else if (mutation.type === "attributes") {
        const panel = mutation.target?.matches?.(PANEL_SELECTOR)
          ? mutation.target
          : mutation.target?.closest?.(PANEL_SELECTOR);
        if (panel) restorePanelGeometry(panel);
      }
    });
    if (shouldReconcile) scheduleReconcile();
  }

  function installObserver() {
    if (observer || typeof MutationObserver === "undefined" || typeof document === "undefined" || !document.body) return false;
    observer = new MutationObserver(handleMutations);
    observer.observe(document.getElementById("canvas") || document.body, {
      attributes: true,
      attributeFilter: ["style", "class"],
      childList: true,
      subtree: true,
      characterData: true
    });
    return true;
  }

  function patchFunction(functionName) {
    if (patchedFunctions.has(functionName)) return false;
    const original = root[functionName];
    if (typeof original !== "function" || original.__liveParameterStableRuntime) return false;
    function stableCanvasFunctionWrapper(...args) {
      markBusy();
      reconcilePanels(document);
      const result = original.apply(this, args);
      const done = () => {
        markBusy();
        scheduleReconcile(0);
        scheduleReconcile(RECONCILE_DELAY_MS);
      };
      if (result && typeof result.then === "function") return result.finally(done);
      done();
      return result;
    }
    stableCanvasFunctionWrapper.__liveParameterStableRuntime = VERSION;
    stableCanvasFunctionWrapper.__liveParameterStableOriginal = original;
    root[functionName] = stableCanvasFunctionWrapper;
    patchedFunctions.add(functionName);
    return true;
  }

  function installEventLocks() {
    if (root.__liveParameterStableEventsInstalled === VERSION || typeof document === "undefined") return false;
    root.__liveParameterStableEventsInstalled = VERSION;
    SOLVER_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, () => {
        markBusy();
        scheduleReconcile(eventName === "npsh:calculation-current" ? 0 : RECONCILE_DELAY_MS);
      }, true);
    });
    ["pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (event.target?.closest?.(".pfd-object, #svg-lines, .pfd-canvas")) {
          markBusy();
          scheduleReconcile(eventName === "pointerup" ? RECONCILE_DELAY_MS : 160);
        }
      }, true);
    });
    ["input", "change"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (event.target?.matches?.("input, select, textarea, [contenteditable='true']")) {
          markBusy();
          scheduleReconcile(RECONCILE_DELAY_MS);
        }
      }, true);
    });
    return true;
  }

  function install() {
    if (typeof document === "undefined") return false;
    PATCH_FUNCTIONS.forEach(patchFunction);
    installEventLocks();
    installObserver();
    reconcilePanels(document);
    if (document.documentElement) document.documentElement.dataset.liveParameterStableRuntime = VERSION;
    root.__liveParameterStableRuntimeVersion = VERSION;
    return true;
  }

  const api = {
    version: VERSION,
    install,
    reconcile: reconcilePanels,
    panelKey,
    structureSignature,
    stabilizePanelFromReplacement,
    syncMatchingRows
  };

  root.EngineeringLiveParameterStableRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
    const installTimer = root.setInterval?.(() => {
      installAttempts += 1;
      install();
      if (installAttempts >= 32) root.clearInterval?.(installTimer);
    }, 250);
  }
}("undefined" != typeof window ? window : globalThis);
