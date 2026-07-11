!function registerEngineeringSourceVolumetricOnlyRuntime(root) {
  "use strict";

  const VERSION = "2026.07-source-route-flow-lock4-src-input-flash-lock";
  const FLOW_MODE = "Volumetric Flow";
  const SOURCE_NUMERIC_FAST_LANE_KEYS = new Set(["pressure", "flow", "elevation"]);
  const FIELD_ROW_SELECTOR = ".object-task-field-row, .pipe-task-field-row, tr, .prop-row";
  const HIDDEN_SOURCE_FIELD_KEYS = new Set([
    "sourceType",
    "source-type-meaning",
    "source-boundary-role",
    "source-boundary-meaning",
    "flowInputMode",
    "massFlow"
  ]);
  const SOURCE_DEFINITION_LABELS = [
    "Source Definition",
    "Definisi Source"
  ];
  const FLOW_SPEC_LABELS = [
    "Flow Specification",
    "Spesifikasi Flow",
    "Spesifikasi Aliran"
  ];
  const BOUNDARY_LABELS = [
    "Boundary Data",
    "Data Boundary"
  ];
  const SOURCE_ADVISOR_LABELS = [
    "Hydraulic Connection",
    "Koneksi Hidrolik",
    "Semantic Attachment",
    "Attachment Semantik"
  ];
  const SOURCE_RENDER_HOOKS = [
    "renderSidebar",
    "openObjectPropertiesTaskWindow",
    "openSourcePropertiesTaskWindow",
    "renderObjectProperties",
    "refreshBackendProtectedSelectedObjectTaskWindow",
    "refreshBackendProtectedRealtimeTaskWindows",
    "updateSimulation",
    "applySimulationStateAtomic"
  ];
  const SOURCE_CONTEXT_MENU_REMOVED_LABELS = [
    "Open Tank / Reservoir",
    "Pressurized Vessel",
    "External Header / Pipe Tie-in",
    "Fixed Flow Source",
    "Standalone Boundary Source"
  ];

  const patchedFunctions = new Set();
  let observer = null;
  let cleanupTimer = 0;
  let cleanupFrame = 0;
  let pendingCleanupRoot = null;
  let contextMenuCleanupTimer = 0;
  let lastSourceMenuSourceId = "";
  let lastSourceMenuUntil = 0;
  let installAttempts = 0;
  let flowSyncSequence = 0;
  let activeFlowSync = null;
  let sourceNumericTaskLock = null;
  let sourceNumericTaskLockTimer = 0;

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function setDatasetValue(element, key, value) {
    if (!element?.dataset) return false;
    const nextValue = String(value);
    if (element.dataset[key] === nextValue) return false;
    element.dataset[key] = nextValue;
    return true;
  }

  function setAttributeValue(element, name, value) {
    if (!element?.setAttribute) return false;
    const nextValue = String(value);
    if (element.getAttribute(name) === nextValue) return false;
    element.setAttribute(name, nextValue);
    return true;
  }

  function finiteNumber(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function model() {
    return root.globalModel || root.__npshGlobalModel || {};
  }

  function activeDensity(modelRef = model()) {
    return finiteNumber(modelRef?.FLUID?.props?.density) || finiteNumber(root.globalModel?.FLUID?.props?.density) || 1000;
  }

  function sourceEntries(modelRef = model()) {
    return Object.entries(modelRef || {}).filter(([, node]) => node?.type === "source");
  }

  function sinkEntries(modelRef = model()) {
    return Object.entries(modelRef || {}).filter(([, node]) => node?.type === "sink");
  }

  function connectionList(modelRef = model()) {
    const candidates = [
      root.connections,
      root.__npshConnections,
      modelRef?.connections,
      root.globalModel?.connections
    ];
    return candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0)
      || candidates.find(Array.isArray)
      || [];
  }

  function connectionPipeId(connection = {}) {
    return normalizeText(connection.pipeId || connection.pipe || connection.via || connection.edgeId || "");
  }

  function connectionFrom(connection = {}) {
    return normalizeText(connection.from || connection.source || connection.fromNode || "");
  }

  function connectionTo(connection = {}) {
    return normalizeText(connection.to || connection.target || connection.toNode || "");
  }

  function isHydraulicConnection(connection = {}) {
    const kind = normalizeText(connection.connectionType || connection.type || "");
    return !kind || /^hydraulic$/i.test(kind);
  }

  function connectedSinkIdsForSource(sourceId, modelRef = model()) {
    if (!sourceId) return [];
    const hydraulicConnections = connectionList(modelRef).filter(isHydraulicConnection);
    if (!hydraulicConnections.length) return [];
    const visited = new Set([sourceId]);
    const queue = [sourceId];
    const sinkIds = new Set();

    while (queue.length) {
      const currentId = queue.shift();
      hydraulicConnections.forEach((connection) => {
        const ids = [
          connectionFrom(connection),
          connectionTo(connection),
          connectionPipeId(connection)
        ].filter(Boolean);
        if (!ids.includes(currentId)) return;
        ids.forEach((id) => {
          if (!id || visited.has(id)) return;
          visited.add(id);
          if (modelRef?.[id]?.type === "sink") sinkIds.add(id);
          queue.push(id);
        });
      });
    }

    return Array.from(sinkIds);
  }

  function connectedSourceIdsForSink(sinkId, modelRef = model()) {
    if (!sinkId) return [];
    const hydraulicConnections = connectionList(modelRef).filter(isHydraulicConnection);
    if (!hydraulicConnections.length) return [];
    const visited = new Set([sinkId]);
    const queue = [sinkId];
    const sourceIds = new Set();

    while (queue.length) {
      const currentId = queue.shift();
      hydraulicConnections.forEach((connection) => {
        const ids = [
          connectionFrom(connection),
          connectionTo(connection),
          connectionPipeId(connection)
        ].filter(Boolean);
        if (!ids.includes(currentId)) return;
        ids.forEach((id) => {
          if (!id || visited.has(id)) return;
          visited.add(id);
          if (modelRef?.[id]?.type === "source") sourceIds.add(id);
          queue.push(id);
        });
      });
    }

    return Array.from(sourceIds);
  }

  function sinkIdsForSourceFlowSync(sourceId, modelRef = model()) {
    return connectedSinkIdsForSource(sourceId, modelRef);
  }

  function sourceIdsForSinkFlowSync(sinkId, modelRef = model()) {
    return connectedSourceIdsForSink(sinkId, modelRef);
  }

  function beginFlowSync(direction, originId, flow) {
    if (activeFlowSync) return null;
    activeFlowSync = {
      id: `route-flow-${++flowSyncSequence}`,
      direction,
      originId,
      flow,
      startedAt: Date.now()
    };
    return activeFlowSync;
  }

  function endFlowSync(transaction) {
    if (activeFlowSync?.id === transaction?.id) activeFlowSync = null;
  }

  function formatFlowInputValue(value) {
    const number = finiteNumber(value);
    if (number === null) return "";
    return String(Number(number.toFixed(6)));
  }

  function syncSinkDemandInputControls(sinkIds, flow) {
    if (typeof document === "undefined" || !Array.isArray(sinkIds) || !sinkIds.length) return 0;
    const nextValue = formatFlowInputValue(flow);
    let changed = 0;
    sinkIds.forEach((sinkId) => {
      const escaped = cssEscape(sinkId);
      const selector = [
        `input[data-key="demandFlow"][data-node="${escaped}"]`,
        `input[data-key="demandFlow"][data-node-id="${escaped}"]`,
        `input[name="demandFlow"][data-node="${escaped}"]`,
        `input[name="demandFlow"][data-node-id="${escaped}"]`
      ].join(",");
      document.querySelectorAll(selector).forEach((input) => {
        if (document.activeElement === input) return;
        if (input.value === nextValue) return;
        input.value = nextValue;
        changed += 1;
      });
    });
    return changed;
  }

  function syncSourceFlowInputControls(sourceIds, flow) {
    if (typeof document === "undefined" || !Array.isArray(sourceIds) || !sourceIds.length) return 0;
    const nextValue = formatFlowInputValue(flow);
    let changed = 0;
    sourceIds.forEach((sourceId) => {
      const escaped = cssEscape(sourceId);
      const selector = [
        `input[data-key="flow"][data-node="${escaped}"]`,
        `input[data-key="flow"][data-node-id="${escaped}"]`,
        `input[name="flow"][data-node="${escaped}"]`,
        `input[name="flow"][data-node-id="${escaped}"]`
      ].join(",");
      document.querySelectorAll(selector).forEach((input) => {
        if (document.activeElement === input) return;
        if (input.value === nextValue) return;
        input.value = nextValue;
        changed += 1;
      });
    });
    return changed;
  }

  function refreshSinkDemandSurfaces(sinkIds, flow) {
    const inputChanges = syncSinkDemandInputControls(sinkIds, flow);
    if (typeof document !== "undefined" && typeof root.EngineeringRouteTraceAudit?.syncSinkPropertyWindowCanonicalReadouts === "function") {
      root.EngineeringRouteTraceAudit.syncSinkPropertyWindowCanonicalReadouts(document);
    }
    return inputChanges;
  }

  function syncSinkDemandFromSourceFlow(sourceId, sourceNode, modelRef = model(), options = {}) {
    const props = sourceNode?.props || {};
    const flow = finiteNumber(props.flow ?? props.flowM3h ?? props.volumetricFlow);
    if (flow === null || flow < 0) return { changed: 0, sinkIds: [] };
    const transaction = beginFlowSync("forward", sourceId, flow);
    if (!transaction) return { changed: 0, sinkIds: [], blockedBy: activeFlowSync?.id || "flow-sync-active" };
    const sinkIds = sinkIdsForSourceFlowSync(sourceId, modelRef);
    let changed = 0;
    const updatedSinkIds = [];
    try {
      sinkIds.forEach((sinkId) => {
        const sink = modelRef?.[sinkId];
        if (!sink || sink.type !== "sink") return;
        if (!sink.props || typeof sink.props !== "object") sink.props = {};
        let sinkChanged = false;
        const currentDemand = finiteNumber(sink.props.demandFlow);
        if (currentDemand === null || Math.abs(currentDemand - flow) > 1e-9) {
          sink.props.demandFlow = flow;
          sinkChanged = true;
        }
        const currentAlias = finiteNumber(sink.props.flowDemand);
        if (currentAlias === null || Math.abs(currentAlias - flow) > 1e-9) {
          sink.props.flowDemand = flow;
          sinkChanged = true;
        }
        if (sink.props.boundaryMode !== "Flow Demand Boundary") {
          sink.props.boundaryMode = "Flow Demand Boundary";
          sinkChanged = true;
        }
        if (sinkChanged) {
          sink.props.flowDemandSyncedFromSource = sourceId;
          sink.props.flowDemandSyncBasis = "SRC Volumetric Flow";
          sink.props.routeFlowSyncTransaction = transaction.id;
          updatedSinkIds.push(sinkId);
          changed += 1;
        }
      });

      if ((updatedSinkIds.length || options.refreshInputs) && options.refreshInputs !== false) {
        refreshSinkDemandSurfaces(sinkIds, flow);
      }

      return { changed, sinkIds: updatedSinkIds, transactionId: transaction.id };
    } finally {
      endFlowSync(transaction);
    }
  }

  function syncSourceFlowFromSinkDemand(sinkId, sinkNode, modelRef = model(), options = {}) {
    const props = sinkNode?.props || {};
    const flow = finiteNumber(props.demandFlow ?? props.flowDemand);
    if (flow === null || flow < 0) return { changed: 0, sourceIds: [] };
    const transaction = beginFlowSync("reverse", sinkId, flow);
    if (!transaction) return { changed: 0, sourceIds: [], blockedBy: activeFlowSync?.id || "flow-sync-active" };
    const sourceIds = sourceIdsForSinkFlowSync(sinkId, modelRef);
    let changed = 0;
    const updatedSourceIds = [];
    try {
      sourceIds.forEach((sourceId) => {
        const source = modelRef?.[sourceId];
        if (!source || source.type !== "source") return;
        if (!source.props || typeof source.props !== "object") source.props = {};
        let sourceChanged = false;
        const currentFlow = finiteNumber(source.props.flow);
        if (currentFlow === null || Math.abs(currentFlow - flow) > 1e-9) {
          source.props.flow = flow;
          sourceChanged = true;
        }
        const currentAlias = finiteNumber(source.props.volumetricFlow);
        if (currentAlias === null || Math.abs(currentAlias - flow) > 1e-9) {
          source.props.volumetricFlow = flow;
          sourceChanged = true;
        }
        if (source.props.flowInputMode !== FLOW_MODE) {
          source.props.flowInputMode = FLOW_MODE;
          sourceChanged = true;
        }
        const density = activeDensity(modelRef);
        if (density > 0) {
          const derivedMassFlow = flow * density;
          if (Math.abs((finiteNumber(source.props.massFlow) || 0) - derivedMassFlow) > 0.000001) {
            source.props.massFlow = derivedMassFlow;
            sourceChanged = true;
          }
          source.props.massFlowDerived = true;
        }
        if (sourceChanged) {
          source.props.flowSyncedFromSink = sinkId;
          source.props.flowSyncBasis = "SNK Flow Demand";
          source.props.routeFlowSyncTransaction = transaction.id;
          updatedSourceIds.push(sourceId);
          changed += 1;
        }
      });

      if ((updatedSourceIds.length || options.refreshInputs) && options.refreshInputs !== false) {
        syncSourceFlowInputControls(sourceIds, flow);
      }

      return { changed, sourceIds: updatedSourceIds, transactionId: transaction.id };
    } finally {
      endFlowSync(transaction);
    }
  }

  function syncAllSinkDemandFromSourceFlow(modelRef = model(), options = {}) {
    let changed = 0;
    const sinkIds = new Set();
    sourceEntries(modelRef).forEach(([id, node]) => {
      const result = syncSinkDemandFromSourceFlow(id, node, modelRef, options);
      changed += result.changed;
      result.sinkIds.forEach((sinkId) => sinkIds.add(sinkId));
    });
    return { changed, sinkIds: Array.from(sinkIds) };
  }

  function normalizeSourceNode(id, node, modelRef = model()) {
    if (!node || node.type !== "source") return false;
    if (!node.props || typeof node.props !== "object") node.props = {};
    const props = node.props;
    const previousMode = normalizeText(props.flowInputMode);
    const density = activeDensity(modelRef);
    const flow = finiteNumber(props.flow ?? props.flowM3h ?? props.volumetricFlow);
    const massFlow = finiteNumber(props.massFlow);
    let changed = false;

    if (/mass\s+flow/i.test(previousMode) && massFlow !== null && massFlow >= 0 && density > 0) {
      props.flow = massFlow / density;
      changed = true;
    } else if ((flow === null || flow < 0) && massFlow !== null && massFlow >= 0 && density > 0) {
      props.flow = massFlow / density;
      changed = true;
    } else if (flow !== null && flow >= 0 && props.flow !== flow) {
      props.flow = flow;
      changed = true;
    }

    if (props.flowInputMode !== FLOW_MODE) {
      props.flowInputMode = FLOW_MODE;
      changed = true;
    }

    const nextFlow = finiteNumber(props.flow);
    if (nextFlow !== null && nextFlow >= 0 && density > 0) {
      const derivedMassFlow = nextFlow * density;
      if (Math.abs((finiteNumber(props.massFlow) || 0) - derivedMassFlow) > 0.000001) {
        props.massFlow = derivedMassFlow;
        changed = true;
      }
      props.massFlowDerived = true;
      props.volumetricFlow = nextFlow;
    }

    if (id) props.flowInputModeLockedBy = VERSION;
    return changed;
  }

  function normalizeAllSourceNodes() {
    const modelRef = model();
    let changed = 0;
    sourceEntries(modelRef).forEach(([id, node]) => {
      if (normalizeSourceNode(id, node, modelRef)) changed += 1;
    });
    return changed;
  }

  function cssEscape(value) {
    if (root.CSS?.escape) return root.CSS.escape(String(value || ""));
    return String(value || "").replace(/["\\]/g, "\\$&");
  }

  function sourceIdFromScope(scope) {
    const modelRef = model();
    const explicit = [
      scope?.dataset?.nodeId,
      scope?.dataset?.objectId,
      scope?.dataset?.sourceId,
      scope?.querySelector?.("[data-node]")?.dataset?.node,
      scope?.querySelector?.("[data-source-id]")?.dataset?.sourceId
    ].map(normalizeText).filter(Boolean);
    for (const id of explicit) {
      if (modelRef[id]?.type === "source") return id;
    }
    const text = normalizeText(scope?.textContent || "");
    const matches = sourceEntries(modelRef).filter(([id, node]) => (
      text.includes(id) || (node.name && text.includes(node.name))
    ));
    if (matches.length === 1) return matches[0][0];
    const allSources = sourceEntries(modelRef);
    return allSources.length === 1 ? allSources[0][0] : "";
  }

  function sourceIdFromCanvasElement(element) {
    const object = element?.closest?.(".object-type-source, [data-type='source'], [data-node-type='source'], .pfd-object");
    if (!object) return "";
    const modelRef = model();
    const candidates = [
      object.dataset?.nodeId,
      object.dataset?.objectId,
      object.dataset?.sourceId,
      object.id
    ].map(normalizeText).filter(Boolean);
    for (const id of candidates) {
      if (modelRef[id]?.type === "source") return id;
    }
    const text = normalizeText(object.textContent || "");
    const matches = sourceEntries(modelRef).filter(([id, node]) => text.includes(id) || (node.name && text.includes(node.name)));
    return matches.length === 1 ? matches[0][0] : "";
  }

  function rememberSourceContextTarget(target) {
    const sourceId = sourceIdFromCanvasElement(target);
    if (!sourceId) return false;
    lastSourceMenuSourceId = sourceId;
    lastSourceMenuUntil = Date.now() + 2500;
    return true;
  }

  function isSourceScope(scope) {
    if (!scope?.querySelector) return false;
    const sourceId = sourceIdFromScope(scope);
    if (sourceId) return true;
    return !!scope.querySelector('[data-prop-key="source-fluid-basis"], [data-key="source-fluid-basis"], input[data-key="flow"], input[data-key="massFlow"], select[data-key="flowInputMode"]');
  }

  function sourceScopes(rootNode = document) {
    const scopes = new Set();
    const selectors = [
      "#taskWindow",
      ".task-window",
      ".object-properties-task-body",
      ".task-window-body",
      "[role='dialog']"
    ];
    selectors.forEach((selector) => {
      rootNode?.querySelectorAll?.(selector).forEach((scope) => {
        if (isSourceScope(scope)) scopes.add(scope);
      });
    });
    if (isSourceScope(rootNode)) scopes.add(rootNode);
    return Array.from(scopes);
  }

  function fieldRowForKey(scope, key) {
    const escaped = cssEscape(key);
    const direct = scope?.querySelector?.(`[data-prop-key="${escaped}"], [data-field-key="${escaped}"]`);
    if (direct) return direct.closest?.(FIELD_ROW_SELECTOR) || direct;
    const input = scope?.querySelector?.(`[data-key="${escaped}"], [name="${escaped}"]`);
    return input?.closest?.(FIELD_ROW_SELECTOR) || null;
  }

  function fieldLabelElement(row) {
    return row?.querySelector?.(".prop-label, label, th, td:first-child, div:first-child, span:first-child") || row?.firstElementChild || null;
  }

  function fieldValueElement(row) {
    return row?.querySelector?.(".prop-value, td:nth-child(2), div:nth-child(2)") || row?.children?.[1] || row || null;
  }

  function rowText(row) {
    return normalizeText(row?.textContent || "");
  }

  function isSectionHeaderRow(row) {
    if (!row) return false;
    if (row.matches?.(".task-section-title, .object-task-section-title, .object-task-section, .pipe-section-title")) return true;
    if (row.querySelector?.("input, select, textarea, button")) return false;
    const text = rowText(row);
    return !!text && text.length < 80 && (
      SOURCE_DEFINITION_LABELS.includes(text)
      || FLOW_SPEC_LABELS.includes(text)
      || SOURCE_ADVISOR_LABELS.includes(text)
      || BOUNDARY_LABELS.includes(text)
      || /definition|fluid basis|boundary/i.test(text)
    );
  }

  function findSectionHeader(scope, labels = [], anchorKey = "") {
    const normalizedLabels = labels.map((label) => normalizeText(label).toLowerCase());
    const candidates = Array.from(scope?.querySelectorAll?.("tr, div, section, h2, h3, h4, .task-section-title, .object-task-section-title") || []);
    const byLabel = candidates.find((candidate) => {
      if (candidate.querySelector?.("input, select, textarea")) return false;
      const text = rowText(candidate).toLowerCase();
      return normalizedLabels.some((label) => text === label || text.includes(label));
    });
    if (byLabel) return byLabel.closest?.("tr") || byLabel;
    const anchorRow = anchorKey ? fieldRowForKey(scope, anchorKey) : null;
    let row = anchorRow?.previousElementSibling || null;
    while (row) {
      if (isSectionHeaderRow(row)) return row;
      row = row.previousElementSibling;
    }
    return null;
  }

  function boundaryInsertAnchor(scope) {
    const preferred = ["velocityHead", "elevation", "pressure"].map((key) => fieldRowForKey(scope, key)).filter(Boolean);
    if (preferred.length) return preferred[preferred.length - 1];
    return findSectionHeader(scope, BOUNDARY_LABELS, "pressure");
  }

  function setFlowRowLabel(row) {
    const label = fieldLabelElement(row);
    if (label && normalizeText(label.textContent) !== "Volumetric Flow") {
      label.textContent = "Volumetric Flow";
      setAttributeValue(label, "data-i18n-fallback", "Volumetric Flow");
      setAttributeValue(label, "data-i18n-text", "task.source.volumetricFlow");
    }
    setDatasetValue(row, "propKey", "flow");
    setDatasetValue(row, "sourceVolumetricOnly", VERSION);
  }

  function ensureFlowInput(row, sourceId) {
    if (!row) return null;
    let input = row.querySelector?.('input[data-key="flow"], input[name="flow"]');
    if (!input) {
      const valueCell = fieldValueElement(row);
      if (!valueCell) return null;
      valueCell.replaceChildren?.();
      input = document.createElement("input");
      input.type = "number";
      input.className = "prop-input-field";
      input.dataset.key = "flow";
      input.dataset.node = sourceId;
      input.name = "flow";
      input.step = "0.001";
      input.min = "0";
      input.dataset.sourceVolumetricOnlyCreated = VERSION;
      const unit = document.createElement("span");
      unit.className = "input-unit";
      unit.textContent = "m3/h";
      valueCell.append(input, unit);
    }
    setDatasetValue(input, "key", "flow");
    if (sourceId) setDatasetValue(input, "node", sourceId);
    if (input.hasAttribute("readonly")) input.removeAttribute("readonly");
    if (input.disabled) input.disabled = false;
    setDatasetValue(input, "sourceVolumetricOnly", VERSION);
    const flow = finiteNumber(model()?.[sourceId]?.props?.flow);
    if (flow !== null && document.activeElement !== input) input.value = String(Number(flow.toFixed(6)));
    return input;
  }

  function createFlowRow(scope, sourceId) {
    const template = fieldRowForKey(scope, "pressure")
      || fieldRowForKey(scope, "elevation")
      || scope.querySelector?.(".object-task-field-row, .pipe-task-field-row, tr");
    const tag = template?.tagName?.toLowerCase() === "tr" ? "tr" : "div";
    const row = document.createElement(tag);
    row.className = template?.className || "object-task-field-row";
    row.dataset.propKey = "flow";
    row.dataset.sourceVolumetricOnlyCreated = VERSION;
    const labelTag = tag === "tr" ? "td" : "div";
    const label = document.createElement(labelTag);
    label.className = "prop-label";
    const value = document.createElement(labelTag);
    value.className = "prop-value";
    row.append(label, value);
    setFlowRowLabel(row);
    ensureFlowInput(row, sourceId);
    return row;
  }

  function moveFlowRowIntoBoundary(scope, sourceId) {
    let row = fieldRowForKey(scope, "flow");
    if (!row) row = createFlowRow(scope, sourceId);
    if (!row) return false;
    setFlowRowLabel(row);
    ensureFlowInput(row, sourceId);
    const anchor = boundaryInsertAnchor(scope);
    if (anchor?.parentNode && row.parentNode === anchor.parentNode && row !== anchor.nextElementSibling) {
      anchor.insertAdjacentElement("afterend", row);
    } else if (anchor?.parentNode && !row.parentNode) {
      anchor.insertAdjacentElement("afterend", row);
    }
    return true;
  }

  function removeElement(element) {
    if (!element) return false;
    element.dataset && (element.dataset.sourceVolumetricOnlyRemoved = VERSION);
    element.remove();
    return true;
  }

  function removeSourceDefinitionBlock(scope) {
    const header = findSectionHeader(scope, SOURCE_DEFINITION_LABELS, "sourceType");
    if (!header) return 0;
    let removed = 0;
    let row = header.nextElementSibling;
    while (row && !isSectionHeaderRow(row)) {
      const next = row.nextElementSibling;
      const key = normalizeText(row.dataset?.propKey || row.querySelector?.("[data-key]")?.dataset?.key || "");
      const text = rowText(row);
      if (
        HIDDEN_SOURCE_FIELD_KEYS.has(key)
        || /source type|type meaning|boundary role|^meaning\b|tipe source|makna tipe|peran boundary/i.test(text)
      ) {
        removeElement(row);
        removed += 1;
      }
      row = next;
    }
    removeElement(header);
    return removed + 1;
  }

  function removeFlowSpecificationBlock(scope) {
    const header = findSectionHeader(scope, FLOW_SPEC_LABELS, "flowInputMode");
    if (!header) return 0;
    let removed = 0;
    let row = header.nextElementSibling;
    while (row && !isSectionHeaderRow(row)) {
      const next = row.nextElementSibling;
      const key = normalizeText(row.dataset?.propKey || row.querySelector?.("[data-key]")?.dataset?.key || "");
      const text = rowText(row);
      if (
        HIDDEN_SOURCE_FIELD_KEYS.has(key)
        || /flow input mode|mass flow|volumetric flow\s*\(calculated\)/i.test(text)
        || row.querySelector?.('[data-key="source-flow"], [data-key="source-mass-flow"]')
      ) {
        removeElement(row);
        removed += 1;
      }
      row = next;
    }
    removeElement(header);
    return removed + 1;
  }

  function removeSourceAdvisorBlocks(scope) {
    let removed = 0;
    SOURCE_ADVISOR_LABELS.forEach((label) => {
      const header = findSectionHeader(scope, [label], "");
      if (!header) return;
      let row = header.nextElementSibling;
      while (row && !isSectionHeaderRow(row)) {
        const next = row.nextElementSibling;
        removeElement(row);
        removed += 1;
        row = next;
      }
      removeElement(header);
      removed += 1;
    });
    Array.from(scope?.querySelectorAll?.("tr, .object-task-field-row, .pipe-task-field-row, .prop-row") || []).forEach((row) => {
      const text = rowText(row);
      if (/advisor-ready src boundary explanation|connection role|solid pipe\(s\)|hydraulic requirement|hydraulic path to pump|suction path|path warnings|this source type is|start solid hydraulic pipe/i.test(text)) {
        removeElement(row);
        removed += 1;
      }
    });
    return removed;
  }

  function removeDeprecatedRows(scope) {
    let removed = 0;
    HIDDEN_SOURCE_FIELD_KEYS.forEach((key) => {
      let row = fieldRowForKey(scope, key);
      while (row) {
        removeElement(row);
        removed += 1;
        row = fieldRowForKey(scope, key);
      }
    });
    Array.from(scope?.querySelectorAll?.('[data-key="source-mass-flow"], [data-key="source-flow"]') || []).forEach((element) => {
      const row = element.closest?.(FIELD_ROW_SELECTOR) || element;
      if (row?.dataset?.propKey === "flow") return;
      if (/mass flow|volumetric flow\s*\(calculated\)/i.test(rowText(row))) {
        removeElement(row);
        removed += 1;
      }
    });
    return removed;
  }

  function syncModelFromFlowInput(input, notify = false) {
    const sourceId = input?.dataset?.node || "";
    const node = model()?.[sourceId];
    if (!node || node.type !== "source") return false;
    normalizeSourceNode(sourceId, node);
    const value = finiteNumber(input.value);
    if (value !== null && value >= 0) {
      node.props.flow = value;
      node.props.volumetricFlow = value;
      node.props.flowInputMode = FLOW_MODE;
      const density = activeDensity();
      if (density > 0) {
        node.props.massFlow = value * density;
        node.props.massFlowDerived = true;
      }
    }
    const synced = syncSinkDemandFromSourceFlow(sourceId, node, model(), { refreshInputs: true });
    if ((notify || synced.sinkIds.length) && typeof root.EngineeringRealtimeCalculationDefense?.notifyDependencyChanged === "function") {
      root.EngineeringRealtimeCalculationDefense.notifyDependencyChanged({
        dependency: "source.volumetric-flow/sink.flow-demand",
        nodeId: sourceId,
        reason: "Source Volumetric Flow changed; SNK Flow Demand synced and route hydraulic/NPSH results are recalculating.",
        sourceEvent: "source-volumetric-flow-input",
        target: input,
        impactedSinkIds: synced.sinkIds
      });
    }
    return true;
  }

  function sourceNumericInputContext(input) {
    const sourceId = normalizeText(input?.dataset?.node || input?.dataset?.nodeId || "");
    const key = normalizeText(input?.dataset?.key || input?.name || "");
    const source = sourceId ? model()?.[sourceId] : null;
    if (!input || !SOURCE_NUMERIC_FAST_LANE_KEYS.has(key) || source?.type !== "source") return null;
    return { input, sourceId, key, source };
  }

  function retainSourceNumericTaskWindow(context) {
    const taskWindow = context?.input?.closest?.('.persistent-object-properties-task-window, #taskWindow[data-kind="object"], .task-window[data-kind="object"]');
    if (!taskWindow) return false;
    sourceNumericTaskLock = {
      sourceId: context.sourceId,
      key: context.key,
      taskWindow,
      expiresAt: Date.now() + 12000
    };
    if (typeof root.clearTimeout === "function") root.clearTimeout(sourceNumericTaskLockTimer);
    if (typeof root.setTimeout === "function") {
      sourceNumericTaskLockTimer = root.setTimeout(() => {
        sourceNumericTaskLockTimer = 0;
        sourceNumericTaskLock = null;
      }, 12000);
    }
    return true;
  }

  function retainedSourceTaskWindow(nodeId = "", options = {}) {
    const lock = sourceNumericTaskLock;
    if (!lock || !lock.taskWindow?.isConnected) return null;
    const active = typeof document !== "undefined" ? document.activeElement : null;
    const activeKey = normalizeText(active?.dataset?.key || active?.name || "");
    const activeSourceId = normalizeText(active?.dataset?.node || active?.dataset?.nodeId || "");
    const activeSourceEdit = activeSourceId === lock.sourceId
      && SOURCE_NUMERIC_FAST_LANE_KEYS.has(activeKey)
      && active?.closest?.('.persistent-object-properties-task-window, #taskWindow[data-kind="object"], .task-window[data-kind="object"]') === lock.taskWindow;
    if (Date.now() > lock.expiresAt && !activeSourceEdit) return null;
    const requestedId = normalizeText(nodeId || options?.nodeId || options?.taskWindow?.dataset?.nodeId || "");
    if (requestedId && requestedId !== lock.sourceId) return null;
    if (model()?.[lock.sourceId]?.type !== "source") return null;
    return lock.taskWindow;
  }

  function updateSourceAbsolutePressureReadout(context) {
    if (context?.key !== "pressure") return false;
    const scope = context.input.closest?.(".persistent-object-properties-task-window, .task-window, #taskWindow, .object-properties-task-body") || document;
    const readout = scope?.querySelector?.('[data-key="source-absolute-pressure"]');
    if (!readout || typeof root.getNodeAbsolutePressureBar !== "function") return false;
    const absolutePressure = finiteNumber(root.getNodeAbsolutePressureBar(context.source));
    if (absolutePressure === null) return false;
    const nextText = `${absolutePressure.toFixed(3)} bar a`;
    if (normalizeText(readout.textContent) === nextText) return false;
    readout.textContent = nextText;
    return true;
  }

  function notifySourceNumericInputChanged(context) {
    const reason = context.key === "pressure"
      ? "Source pressure changed; route hydraulic/NPSH results are recalculating."
      : "Source elevation changed; route hydraulic/NPSH results are recalculating.";
    if (typeof root.EngineeringRealtimeCalculationDefense?.notifyDependencyChanged === "function") {
      root.EngineeringRealtimeCalculationDefense.notifyDependencyChanged({
        dependency: `source.${context.key}`,
        nodeId: context.sourceId,
        reason,
        sourceEvent: "source-numeric-input-fast-lane",
        target: context.input,
        initialStatus: "calculating"
      });
      return true;
    }
    return false;
  }

  function handleSourceNumericInput(event) {
    const input = event.target?.closest?.('input[data-key][data-node]');
    const context = sourceNumericInputContext(input);
    if (!context) return false;
    event.stopImmediatePropagation();
    event.stopPropagation();
    retainSourceNumericTaskWindow(context);
    if (context.key === "flow") {
      syncModelFromFlowInput(input, true);
    } else {
      const parsedValue = Number.parseFloat(input.value);
      context.source.props[context.key] = Number.isFinite(parsedValue) ? parsedValue : 0;
      normalizeSourceNode(context.sourceId, context.source);
      updateSourceAbsolutePressureReadout(context);
      notifySourceNumericInputChanged(context);
    }
    const scope = input.closest?.(".task-window, #taskWindow, .object-properties-task-body, [role='dialog']") || document;
    flushCleanup(scope);
    requestCleanup(scope);
    return true;
  }

  function cleanupSourceScope(scope) {
    const sourceId = sourceIdFromScope(scope);
    if (sourceId) normalizeSourceNode(sourceId, model()?.[sourceId]);
    moveFlowRowIntoBoundary(scope, sourceId);
    removeDeprecatedRows(scope);
    removeSourceDefinitionBlock(scope);
    removeFlowSpecificationBlock(scope);
    removeSourceAdvisorBlocks(scope);
    setDatasetValue(scope, "sourceVolumetricOnly", VERSION);
    return true;
  }

  function cleanupSourceTaskWindows(rootNode = document) {
    if (typeof document === "undefined") return;
    normalizeAllSourceNodes();
    sourceScopes(rootNode).forEach(cleanupSourceScope);
    cleanupSourceContextMenu(rootNode);
    setDatasetValue(document.documentElement, "sourceVolumetricOnlyRuntime", VERSION);
  }

  function contextMenuElement(rootNode = document) {
    if (rootNode?.id === "canvasContextMenu") return rootNode;
    return rootNode?.querySelector?.("#canvasContextMenu")
      || document.getElementById?.("canvasContextMenu")
      || null;
  }

  function menuItemCandidates(menu) {
    const candidates = Array.from(menu?.querySelectorAll?.("button, [role='menuitem'], a, li, .context-menu-item, .canvas-context-menu-item") || []);
    if (candidates.length) return candidates;
    return Array.from(menu?.children || []).filter((child) => normalizeText(child.textContent));
  }

  function contextMenuLooksLikeSource(menu) {
    if (!menu) return false;
    if (Date.now() <= lastSourceMenuUntil && lastSourceMenuSourceId) return true;
    const text = normalizeText(menu.textContent || "");
    return SOURCE_CONTEXT_MENU_REMOVED_LABELS.some((label) => text.includes(label));
  }

  function itemLabelText(item) {
    return normalizeText(item?.textContent || "");
  }

  function setMenuItemPrimaryText(item, text) {
    if (!item) return false;
    if (item.children?.length) {
      const textNode = Array.from(item.childNodes || []).find((node) => node.nodeType === 3 && normalizeText(node.textContent));
      if (textNode) {
        textNode.textContent = text;
        return true;
      }
      const first = item.firstElementChild;
      if (first && first.children.length <= 1) {
        first.textContent = text;
        return true;
      }
    }
    item.textContent = text;
    return true;
  }

  function runSourceConnectAction() {
    const sourceId = lastSourceMenuSourceId || sourceEntries()[0]?.[0] || "";
    try {
      if (typeof root.startHydraulicConnectionFromSource === "function") {
        root.startHydraulicConnectionFromSource(sourceId);
      } else if (typeof root.activateConnectTool === "function") {
        root.activateConnectTool("Straight");
      } else {
        root.document?.getElementById?.("btn-mode-connect")?.click?.();
      }
    } finally {
      const menu = document.getElementById("canvasContextMenu");
      if (menu) menu.classList.remove("show", "open", "visible");
      if (menu) menu.hidden = true;
    }
  }

  function addSourceConnectItem(menu, templateItem = null) {
    if (!menu || menu.querySelector?.('[data-source-volumetric-only-connect="true"]')) return 0;
    const item = templateItem?.cloneNode?.(false) || document.createElement("button");
    if (item.tagName === "BUTTON") item.type = "button";
    item.dataset.sourceVolumetricOnlyConnect = "true";
    item.textContent = "Connect";
    item.setAttribute("role", item.getAttribute("role") || "menuitem");
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      runSourceConnectAction();
    });
    const deleteItem = menuItemCandidates(menu).find((candidate) => /^Delete\s+Source$/i.test(itemLabelText(candidate)));
    if (deleteItem?.parentNode) deleteItem.parentNode.insertBefore(item, deleteItem);
    else menu.appendChild(item);
    return 1;
  }

  function cleanupSourceContextMenu(rootNode = document) {
    if (typeof document === "undefined") return 0;
    const menu = contextMenuElement(rootNode);
    if (!menu || !contextMenuLooksLikeSource(menu)) return 0;
    let changed = 0;
    const items = menuItemCandidates(menu);
    items.forEach((item) => {
      const text = itemLabelText(item);
      const remove = SOURCE_CONTEXT_MENU_REMOVED_LABELS.some((label) => text === label || text.startsWith(`${label} `));
      if (remove) {
        item.remove();
        changed += 1;
        return;
      }
      if (/^Delete(?:\s+Object)?$/i.test(text)) {
        setMenuItemPrimaryText(item, "Delete Source");
        item.dataset.sourceVolumetricOnlyDeleteLabel = VERSION;
        changed += 1;
      }
    });
    const refreshedItems = menuItemCandidates(menu);
    const hasConnect = refreshedItems.some((item) => /^Connect$/i.test(itemLabelText(item)));
    if (!hasConnect) changed += addSourceConnectItem(menu, refreshedItems[0] || null);
    const allowedPattern = /^(User Task Object Properties|Object Properties|Connect|Delete Source)$/i;
    menuItemCandidates(menu).forEach((item) => {
      const text = itemLabelText(item);
      if (!text || allowedPattern.test(text)) return;
      if (SOURCE_CONTEXT_MENU_REMOVED_LABELS.some((label) => text.includes(label))) {
        item.remove();
        changed += 1;
      }
    });
    menu.dataset.sourceVolumetricOnlyMenuClean = VERSION;
    return changed;
  }

  function runPendingCleanup(rootNode = null) {
    if (typeof document === "undefined") return;
    const target = rootNode || pendingCleanupRoot || document;
    pendingCleanupRoot = null;
    cleanupSourceTaskWindows(target);
  }

  function requestCleanup(rootNode = document) {
    if (typeof document === "undefined") return;
    pendingCleanupRoot = rootNode || pendingCleanupRoot || document;
    if (cleanupFrame) return;
    if (typeof root.requestAnimationFrame === "function") {
      cleanupFrame = root.requestAnimationFrame(() => {
        cleanupFrame = 0;
        runPendingCleanup();
      });
      return;
    }
    if (typeof root.setTimeout !== "function") return;
    root.clearTimeout?.(cleanupTimer);
    cleanupTimer = root.setTimeout(() => {
      cleanupTimer = 0;
      runPendingCleanup();
    }, 0);
  }

  function flushCleanup(rootNode = document) {
    if (typeof document === "undefined") return;
    if (cleanupFrame && typeof root.cancelAnimationFrame === "function") {
      root.cancelAnimationFrame(cleanupFrame);
    }
    cleanupFrame = 0;
    pendingCleanupRoot = rootNode || pendingCleanupRoot || document;
    runPendingCleanup();
  }

  function scheduleCleanup(rootNode = document, delayMs = 0) {
    if (typeof document === "undefined") return;
    if (Math.max(0, delayMs) <= 0) {
      requestCleanup(rootNode);
      return;
    }
    if (typeof root.setTimeout !== "function") return;
    root.clearTimeout?.(cleanupTimer);
    cleanupTimer = root.setTimeout(() => {
      cleanupTimer = 0;
      requestCleanup(rootNode);
    }, Math.max(0, delayMs));
  }

  function scheduleContextMenuCleanup(rootNode = document, delayMs = 0) {
    if (typeof document === "undefined" || typeof root.setTimeout !== "function") return;
    root.clearTimeout?.(contextMenuCleanupTimer);
    contextMenuCleanupTimer = root.setTimeout(() => {
      contextMenuCleanupTimer = 0;
      cleanupSourceContextMenu(rootNode);
    }, Math.max(0, delayMs));
  }

  function patchFunction(functionName) {
    if (patchedFunctions.has(functionName)) return false;
    const original = root[functionName];
    if (typeof original !== "function" || original.__sourceVolumetricOnlyRuntime) return false;
    function sourceVolumetricOnlyWrapper(...args) {
      if (functionName === "renderSidebar") {
        const retainedTaskWindow = retainedSourceTaskWindow(args[0], args[1]);
        if (retainedTaskWindow) {
          flushCleanup(retainedTaskWindow);
          requestCleanup(retainedTaskWindow);
          return retainedTaskWindow;
        }
      }
      normalizeAllSourceNodes();
      const result = original.apply(this, args);
      const after = () => {
        flushCleanup(document);
        requestCleanup(document);
        scheduleCleanup(document, 20);
      };
      after();
      if (result && typeof result.then === "function") return result.finally(after);
      return result;
    }
    sourceVolumetricOnlyWrapper.__sourceVolumetricOnlyRuntime = VERSION;
    sourceVolumetricOnlyWrapper.__sourceVolumetricOnlyOriginal = original;
    root[functionName] = sourceVolumetricOnlyWrapper;
    patchedFunctions.add(functionName);
    return true;
  }

  function installStyles() {
    if (typeof document === "undefined" || document.getElementById("source-volumetric-only-style")) return false;
    const style = document.createElement("style");
    style.id = "source-volumetric-only-style";
    const sourceTaskScopes = [
      '#taskWindow[data-kind="object"]',
      '.task-window[data-kind="object"]',
      '.persistent-object-properties-task-window[data-kind="object"]',
      '.object-properties-task-body',
      '.pipe-properties-task.object-properties-task'
    ];
    const sourceTaskHiddenSelectors = [
      'tr.source-defense-toolbar-row',
      'tr:has(> .prop-section-header[data-i18n-text="sidebar.section.sourceDefinition"])',
      'tr:has(> .prop-section-header[data-i18n-fallback="Source Definition"])',
      'tr:has(> .prop-section-header[data-i18n-text="sidebar.section.flowSpecification"])',
      'tr:has(> .prop-section-header[data-i18n-fallback="Flow Specification"])',
      'tr:has(> .prop-section-header[data-i18n-text="sidebar.section.semanticAttachment"])',
      'tr:has(> .prop-section-header[data-i18n-fallback="Semantic Attachment"])',
      'tr:has(> .prop-section-header[data-i18n-text="sidebar.section.hydraulicConnection"])',
      'tr:has(> .prop-section-header[data-i18n-fallback="Hydraulic Connection"])',
      'tr:has([data-key="sourceType"])',
      'tr:has([data-key="source-type-meaning"])',
      'tr:has([data-key="source-boundary-role"])',
      'tr:has([data-key="source-boundary-meaning"])',
      'tr:has([data-key="flowInputMode"])',
      'tr:has([data-key="massFlow"])',
      'tr:has([data-key="source-flow"])',
      'tr:has([data-key="source-mass-flow"])',
      '[data-prop-key="flowInputMode"]',
      '[data-prop-key="massFlow"]',
      '[data-prop-key="sourceType"]',
      '[data-prop-key="source-boundary-role"]',
      '[data-prop-key="source-boundary-meaning"]',
      '[data-prop-key="source-flow"]',
      '[data-prop-key="source-mass-flow"]',
      '[data-prop-key="source-type-meaning"]'
    ];
    const sourceTaskRules = sourceTaskScopes.flatMap((scope) => (
      sourceTaskHiddenSelectors.map((selector) => `${scope} ${selector}`)
    ));
    style.textContent = [
      `${sourceTaskRules.join(",\n")}{display:none!important;}`,
      `[data-source-volumetric-only-removed="${VERSION}"]{display:none!important;}`,
      '.source-volumetric-only-hidden{display:none!important;}'
    ].join("\n");
    document.head.appendChild(style);
    return true;
  }

  function installEvents() {
    if (typeof document === "undefined" || document.documentElement.dataset.sourceVolumetricOnlyEvents === VERSION) return false;
    document.documentElement.dataset.sourceVolumetricOnlyEvents = VERSION;
    ["pointerdown", "contextmenu", "click"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (!rememberSourceContextTarget(event.target)) return;
        scheduleContextMenuCleanup(document, eventName === "contextmenu" ? 0 : 20);
      }, true);
    });
    document.addEventListener("input", handleSourceNumericInput, true);
    document.addEventListener("input", (event) => {
      const input = event.target?.closest?.('input[data-key="demandFlow"][data-node], input[name="demandFlow"][data-node]');
      const sinkId = input?.dataset?.node || input?.dataset?.nodeId || "";
      const sink = model()?.[sinkId];
      if (!input || !sink || sink.type !== "sink") return;
      const value = finiteNumber(input.value);
      if (value !== null && value >= 0) {
        if (!sink.props || typeof sink.props !== "object") sink.props = {};
        sink.props.demandFlow = value;
        sink.props.flowDemand = value;
      }
      const synced = syncSourceFlowFromSinkDemand(sinkId, sink, model(), { refreshInputs: true });
      if (synced.sourceIds.length && typeof root.EngineeringRealtimeCalculationDefense?.notifyDependencyChanged === "function") {
        root.EngineeringRealtimeCalculationDefense.notifyDependencyChanged({
          dependency: "sink.flow-demand/source.volumetric-flow",
          nodeId: synced.sourceIds[0],
          reason: "SNK Flow Demand changed; SRC Volumetric Flow synced and route hydraulic/NPSH results are recalculating.",
          sourceEvent: "sink-flow-demand-input",
          target: input,
          impactedSinkIds: [sinkId]
        });
      }
    }, true);
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (target?.matches?.('select[data-key="flowInputMode"], select[name="flowInputMode"]')) {
        target.value = FLOW_MODE;
        const scope = target.closest(".task-window, #taskWindow, .object-properties-task-body, [role='dialog']") || document;
        flushCleanup(scope);
        requestCleanup(scope);
      }
    }, true);
    [
      "npsh:calculation-current",
      "npsh:realtime-autosolve-complete",
      "npsh:linked-views-refreshed"
    ].forEach((eventName) => document.addEventListener(eventName, () => {
      flushCleanup(document);
      scheduleCleanup(document, 20);
    }, true));
    return true;
  }

  function installObserver() {
    if (observer || typeof MutationObserver === "undefined" || typeof document === "undefined") return false;
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => (
        Array.from(mutation.addedNodes || []).some((node) => node?.nodeType === 1 && (
          node.matches?.(".task-window, #taskWindow, .object-properties-task-body")
          || node.querySelector?.("[data-prop-key='flowInputMode'], [data-key='massFlow'], [data-key='flow']")
          || node.matches?.("#canvasContextMenu")
          || node.querySelector?.("#canvasContextMenu")
        ))
      ))) {
        flushCleanup(document);
        requestCleanup(document);
        scheduleCleanup(document, 20);
        scheduleContextMenuCleanup(document, 0);
      }
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    return true;
  }

  function install() {
    normalizeAllSourceNodes();
    if (typeof document !== "undefined") {
      installStyles();
      installEvents();
      installObserver();
      SOURCE_RENDER_HOOKS.forEach(patchFunction);
      cleanupSourceTaskWindows(document);
    }
    root.__engineeringSourceVolumetricOnlyRuntimeVersion = VERSION;
    return true;
  }

  function startInstallLoop() {
    installAttempts += 1;
    install();
    if (installAttempts < 40 && typeof root.setTimeout === "function") {
      root.setTimeout(startInstallLoop, installAttempts < 12 ? 250 : 1000);
    }
  }

  const api = {
    version: VERSION,
    install,
    cleanup: cleanupSourceTaskWindows,
    normalizeAllSourceNodes,
    syncAllSinkDemandFromSourceFlow,
    syncSinkDemandFromSourceFlow,
    syncSourceFlowFromSinkDemand,
    syncModelFromFlowInput,
    handleSourceNumericInput
  };

  root.EngineeringSourceVolumetricOnlyRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startInstallLoop, { once: true });
    } else {
      startInstallLoop();
    }
  } else {
    install();
  }
}("undefined" !== typeof window ? window : globalThis);
