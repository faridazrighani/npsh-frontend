!function(root) {
  "use strict";

  const VERSION = "2026.07-live-parameter-stable6";
  const OBJECT_SELECTOR = ".pfd-object";
  const PANEL_SELECTOR = ".pump-live-params, .tank-live-params, .source-live-params, .sink-live-params";
  const ROW_SELECTOR = ".pump-live-param-row, .tank-live-param-row, .source-live-param-row, .sink-live-param-row";
  const SECTION_SELECTOR = ".pump-live-param-section, .tank-live-param-section, .source-live-param-section, .sink-live-param-section";
  const LABEL_SELECTOR = ".pump-live-param-label, .tank-live-param-label, .source-live-param-label, .sink-live-param-label";
  const VALUE_SELECTOR = ".pump-live-param-value, .tank-live-param-value, .source-live-param-value, .sink-live-param-value, strong";
  const UNIT_SELECTOR = ".pump-live-param-unit, .tank-live-param-unit, .source-live-param-unit, .sink-live-param-unit";
  const SOLVER_EVENTS = [
    "npsh:calculation-start",
    "npsh:calculation-applying-results",
    "npsh:calculation-dependency-changed",
    "npsh:realtime-autosolve-scheduled",
    "npsh:realtime-autosolve-start",
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
  const CLEAR_IN_PROGRESS_FLAG = "__npshCanvasClearInProgress";
  const PUMP_PROTECTED_SECTIONS = new Set(["STATUS", "SUCTION", "DISCHARGE"]);
  const PUMP_PROTECTED_ROWS = new Set([
    "Hydraulic NPSH",
    "Backend Valid.",
    "Flow",
    "Suction Press.",
    "NPSH Available",
    "NPSH Required",
    "NPSH Margin",
    "NPSH Ratio",
    "Required Head",
    "Discharge Press."
  ]);
  const SINK_PROTECTED_ROWS = new Set([
    "Mode",
    "Sink Flow",
    "Sink P abs",
    "Sink Elev.",
    "Sink Head",
    "Boundary",
    "Head Res.",
    "Max Elev."
  ]);

  const registry = new Map();
  const detachedPanels = new Map();
  const frozenGeometry = new WeakMap();
  const frozenPanelNodes = new WeakMap();
  const pendingPanelAttributes = new WeakMap();
  const pendingAttributePanels = new Set();
  const patchedFunctions = new Set();
  let observer = null;
  let reconcileTimer = null;
  let busyFlushTimer = null;
  let orphanCleanupTimer = null;
  let busyUntil = 0;
  let installAttempts = 0;
  let canvasViewportSnapshot = null;

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
      panel?.dataset?.liveParameterStableOwnerId,
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

  function objectIdForObject(object) {
    if (!object || object.nodeType !== 1) return "";
    const candidates = [
      object.dataset?.nodeId,
      object.dataset?.objectId,
      object.dataset?.pumpId,
      object.dataset?.sourceId,
      object.dataset?.sinkId,
      object.id
    ].map(normalizeText).filter(Boolean);
    if (candidates.length) return candidates[0];
    const label = normalizeText(object.querySelector?.(".object-label, .node-label, .equipment-label")?.textContent);
    return label || normalizeText(object.textContent).slice(0, 80);
  }

  function getCanvas() {
    return root.document?.getElementById?.("canvas") || null;
  }

  function modelHasOwner(ownerId) {
    const normalizedOwnerId = normalizeText(ownerId);
    if (!normalizedOwnerId) return false;
    const model = root.globalModel || root.__npshGlobalModel || {};
    if (model?.[normalizedOwnerId] && typeof model[normalizedOwnerId] === "object") return true;
    return Object.entries(model || {}).some(([id, node]) => {
      if (!node || typeof node !== "object") return false;
      return [id, node.id, node.name, node.props?.id, node.props?.name]
        .map(normalizeText)
        .some((value) => value === normalizedOwnerId);
    });
  }

  function canvasHasOwner(ownerId) {
    const normalizedOwnerId = normalizeText(ownerId);
    if (!normalizedOwnerId) return false;
    const canvas = getCanvas();
    if (!canvas?.querySelectorAll) return false;
    return Array.from(canvas.querySelectorAll(OBJECT_SELECTOR)).some((object) => objectIdForObject(object) === normalizedOwnerId);
  }

  function panelIsInsideRemovedObject(panel) {
    const object = panel?.closest?.(OBJECT_SELECTOR);
    return !!object && !object.isConnected;
  }

  function shouldDiscardPanelForMissingOwner(panel) {
    const ownerId = objectIdForPanel(panel);
    if (!ownerId) return false;
    if (panelIsInsideRemovedObject(panel)) return true;
    return panel.isConnected && !canvasHasOwner(ownerId) && !modelHasOwner(ownerId);
  }

  function purgePanelRecord(panel) {
    const key = panel?.dataset?.liveParameterStableKey || panelKey(panel);
    if (key) {
      registry.delete(key);
      detachedPanels.delete(key);
    }
    if (panel?.isConnected) panel.remove();
    return true;
  }

  function purgeOwnerPanels(ownerId, scope = document) {
    const normalizedOwnerId = normalizeText(ownerId);
    if (!normalizedOwnerId) return 0;
    let removed = 0;
    for (const [key, panel] of Array.from(registry.entries())) {
      if (objectIdForPanel(panel) === normalizedOwnerId) {
        registry.delete(key);
        detachedPanels.delete(key);
        if (panel?.isConnected) {
          panel.remove();
          removed += 1;
        }
      }
    }
    for (const [key, panel] of Array.from(detachedPanels.entries())) {
      if (objectIdForPanel(panel) === normalizedOwnerId) detachedPanels.delete(key);
    }
    scope?.querySelectorAll?.(PANEL_SELECTOR).forEach((panel) => {
      if (objectIdForPanel(panel) === normalizedOwnerId) {
        purgePanelRecord(panel);
        removed += 1;
      }
    });
    return removed;
  }

  function pruneOrphanPanels(scope = document) {
    if (!scope?.querySelectorAll) return 0;
    let removed = 0;
    scope.querySelectorAll(PANEL_SELECTOR).forEach((panel) => {
      if (shouldDiscardPanelForMissingOwner(panel)) {
        purgePanelRecord(panel);
        removed += 1;
      }
    });
    return removed;
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

  function stableSectionLabel(node) {
    const text = normalizeText(node?.textContent || "").toUpperCase();
    if (text.startsWith("STATUS")) return "STATUS";
    if (text.startsWith("SUCTION")) return "SUCTION";
    if (text.startsWith("DISCHARGE")) return "DISCHARGE";
    return text;
  }

  function stableNodeLabel(node) {
    if (node?.matches?.(SECTION_SELECTOR)) return stableSectionLabel(node);
    if (node?.matches?.(ROW_SELECTOR)) return rowLabel(node);
    return "";
  }

  function stableNodeKey(node) {
    if (node?.matches?.(SECTION_SELECTOR)) return `section:${stableNodeLabel(node)}`;
    if (node?.matches?.(ROW_SELECTOR)) return `row:${stableNodeLabel(node)}`;
    return "";
  }

  function shouldSnapshotPanelNode(panel, node) {
    const label = stableNodeLabel(node);
    if (!label) return false;
    if (panel?.classList?.contains("pump-live-params")) {
      if (node?.matches?.(SECTION_SELECTOR)) return PUMP_PROTECTED_SECTIONS.has(label.toUpperCase());
      return PUMP_PROTECTED_ROWS.has(label);
    }
    if (panel?.classList?.contains("sink-live-params")) {
      return node?.matches?.(ROW_SELECTOR) && SINK_PROTECTED_ROWS.has(label);
    }
    return true;
  }

  function structureSignature(panel) {
    const parts = [];
    Array.from(panel?.children || []).forEach((child) => {
      if (child?.matches?.(SECTION_SELECTOR)) {
        parts.push(`section:${stableSectionLabel(child)}`);
      } else if (child?.matches?.(ROW_SELECTOR)) {
        parts.push(`row:${rowLabel(child)}`);
      }
    });
    return parts.join("||");
  }

  function capturePanelNodeSnapshots(panel) {
    if (!panel?.matches?.(PANEL_SELECTOR)) return;
    const snapshots = Array.from(panel.querySelectorAll?.(`${SECTION_SELECTOR}, ${ROW_SELECTOR}`) || [])
      .filter((node) => shouldSnapshotPanelNode(panel, node))
      .map((node) => ({ key: stableNodeKey(node), node: node.cloneNode(true) }))
      .filter((item) => item.key);
    frozenPanelNodes.set(panel, snapshots);
    if (snapshots.length) panel.dataset.liveParameterStableNodeSnapshot = VERSION;
  }

  function currentPanelNodeKeys(panel) {
    return new Set(
      Array.from(panel?.querySelectorAll?.(`${SECTION_SELECTOR}, ${ROW_SELECTOR}`) || [])
        .map(stableNodeKey)
        .filter(Boolean)
    );
  }

  function insertRestoredPanelNode(panel, restoredNode, snapshotIndex, snapshots) {
    const followingKeys = new Set(snapshots.slice(snapshotIndex + 1).map((item) => item.key));
    const followingNode = Array.from(panel.children || []).find((child) => followingKeys.has(stableNodeKey(child))) || null;
    panel.insertBefore(restoredNode, followingNode);
  }

  function restoreMissingPanelNodes(panel) {
    if (!isBusy() || !panel?.matches?.(PANEL_SELECTOR)) return 0;
    const snapshots = frozenPanelNodes.get(panel);
    if (!snapshots?.length) return 0;
    let changed = 0;
    const existingKeys = currentPanelNodeKeys(panel);
    snapshots.forEach((snapshot, index) => {
      if (existingKeys.has(snapshot.key)) return;
      const restoredNode = snapshot.node.cloneNode(true);
      insertRestoredPanelNode(panel, restoredNode, index, snapshots);
      existingKeys.add(snapshot.key);
      changed += 1;
    });
    if (changed) panel.dataset.liveParameterStableNodesRestored = VERSION;
    return changed;
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

  function isCanvasClearInProgress() {
    return !!root[CLEAR_IN_PROGRESS_FLAG];
  }

  function captureCanvasViewport() {
    const canvas = getCanvas();
    if (!canvas) return null;
    canvasViewportSnapshot = {
      canvas,
      scrollLeft: canvas.scrollLeft || 0,
      scrollTop: canvas.scrollTop || 0
    };
    canvas.dataset.liveParameterStableViewport = VERSION;
    return canvasViewportSnapshot;
  }

  function restoreCanvasViewport() {
    const snapshot = canvasViewportSnapshot;
    if (!snapshot?.canvas?.isConnected) return false;
    snapshot.canvas.scrollLeft = snapshot.scrollLeft;
    snapshot.canvas.scrollTop = snapshot.scrollTop;
    snapshot.canvas.dataset.liveParameterStableViewportRestored = VERSION;
    return true;
  }

  function markBusy() {
    if (isCanvasClearInProgress()) return;
    captureCanvasViewport();
    freezeAllPanelGeometry();
    busyUntil = Math.max(busyUntil, nowMs() + BUSY_SETTLE_MS);
    scheduleBusyFlush();
  }

  function freezePanelGeometry(panel) {
    if (!panel?.matches?.(PANEL_SELECTOR)) return;
    const rect = typeof panel.getBoundingClientRect === "function" ? panel.getBoundingClientRect() : null;
    const rectWidth = Math.ceil(rect?.width || 0);
    const rectHeight = Math.ceil(rect?.height || 0);
    if (rectWidth > 0 && !panel.style?.minWidth) panel.style.minWidth = `${rectWidth}px`;
    if (rectHeight > 0 && !panel.style?.minHeight) panel.style.minHeight = `${rectHeight}px`;
    frozenGeometry.set(panel, {
      style: panel.getAttribute("style") || "",
      transform: panel.style?.transform || "",
      left: panel.style?.left || "",
      top: panel.style?.top || "",
      right: panel.style?.right || "",
      bottom: panel.style?.bottom || "",
      width: panel.style?.width || "",
      height: panel.style?.height || "",
      minWidth: panel.style?.minWidth || "",
      minHeight: panel.style?.minHeight || ""
    });
    capturePanelNodeSnapshots(panel);
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
    ["transform", "left", "top", "right", "bottom", "width", "height", "minWidth", "minHeight"].forEach((property) => {
      if (panel.style?.[property] !== frozen[property]) {
        panel.style[property] = frozen[property];
        changed += 1;
      }
    });
    changed += restoreMissingPanelNodes(panel);
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
    restoreCanvasViewport();
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
    const ownerId = objectIdForPanel(panel);
    panel.dataset.liveParameterStableShell = VERSION;
    panel.dataset.liveParameterStableKey = key;
    panel.dataset.liveParameterStableSignature = structureSignature(panel);
    if (ownerId) panel.dataset.liveParameterStableOwnerId = ownerId;
    registry.set(key, panel);
    if (!frozenGeometry.has(panel)) freezePanelGeometry(panel);
    return key;
  }

  function stabilizeAddedPanel(panel) {
    if (!panel?.matches?.(PANEL_SELECTOR)) return 0;
    if (shouldDiscardPanelForMissingOwner(panel)) {
      purgePanelRecord(panel);
      return 1;
    }
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
    if (isCanvasClearInProgress()) return false;
    if (shouldDiscardPanelForMissingOwner(panel)) {
      purgePanelRecord(panel);
      return false;
    }
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
    if (isCanvasClearInProgress()) {
      registry.delete(key);
      detachedPanels.delete(key);
      return;
    }
    if (shouldDiscardPanelForMissingOwner(panel)) {
      purgePanelRecord(panel);
      return;
    }
    if (restoreRemovedPanel(panel, mutation)) return;
    detachedPanels.set(key, panel);
    root.setTimeout?.(() => {
      if (detachedPanels.get(key) === panel) detachedPanels.delete(key);
    }, 2500);
  }

  function reconcilePanels(scope = document) {
    if (isCanvasClearInProgress()) return 0;
    if (!scope?.querySelectorAll) return 0;
    let changed = 0;
    changed += pruneOrphanPanels(scope);
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

  function scheduleOrphanCleanup(delayMs = 0) {
    if (typeof root.setTimeout !== "function") return;
    root.clearTimeout?.(orphanCleanupTimer);
    orphanCleanupTimer = root.setTimeout(() => {
      orphanCleanupTimer = null;
      pruneOrphanPanels(document);
    }, Math.max(0, Number(delayMs) || 0));
  }

  function handleMutations(mutations) {
    let shouldReconcile = false;
    mutations.forEach((mutation) => {
      Array.from(mutation.removedNodes || []).forEach((node) => {
        if (node?.nodeType === 1) {
          const removedObjects = [];
          if (node.matches?.(OBJECT_SELECTOR)) removedObjects.push(node);
          node.querySelectorAll?.(OBJECT_SELECTOR).forEach((object) => removedObjects.push(object));
          removedObjects.forEach((object) => purgeOwnerPanels(objectIdForObject(object), document));
          if (removedObjects.length) scheduleOrphanCleanup(0);
        }
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
        if (mutation.target === getCanvas()) restoreCanvasViewport();
      } else if (mutation.type === "childList") {
        const panel = mutation.target?.matches?.(PANEL_SELECTOR)
          ? mutation.target
          : mutation.target?.closest?.(PANEL_SELECTOR);
        if (panel) {
          restoreMissingPanelNodes(panel);
          registerPanel(panel);
        }
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

  function clearTrackedPanels(scope = document) {
    registry.clear();
    detachedPanels.clear();
    pendingAttributePanels.clear();
    if (scope?.querySelectorAll) {
      scope.querySelectorAll(PANEL_SELECTOR).forEach((panel) => panel.remove());
    }
    root.clearTimeout?.(reconcileTimer);
    root.clearTimeout?.(busyFlushTimer);
    root.clearTimeout?.(orphanCleanupTimer);
    reconcileTimer = null;
    busyFlushTimer = null;
    orphanCleanupTimer = null;
    busyUntil = 0;
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
    ["pointerdown", "pointermove", "pointerup", "pointercancel", "mousedown", "mousemove", "mouseup", "dragstart", "drag", "dragend", "touchstart", "touchmove", "touchend", "touchcancel"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (event.target?.closest?.(`.pfd-object, #svg-lines, .pfd-canvas, ${PANEL_SELECTOR}`)) {
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
    clearTrackedPanels,
    pruneOrphanPanels,
    purgeOwnerPanels,
    panelKey,
    structureSignature,
    stabilizePanelFromReplacement,
    syncMatchingRows,
    captureCanvasViewport,
    restoreCanvasViewport
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
