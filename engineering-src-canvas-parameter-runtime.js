!function(root) {
  "use strict";

  const LOCK_VERSION = "2026.07-src-canvas-flow-basis-lock5";
  const ALWAYS_HIDDEN_ROWS = new Set(["Contribution", "Suction Loss", "NPSH at Pump", "Pump NPSHa"]);
  const DYNAMIC_ROWS = new Set(["Dyn Mode", "Target", "Dyn Feed", "Target Net", "Dyn Net", "Target Trend", "Dyn Trend"]);
  const SOURCE_TOOLTIP_HIDDEN_ROWS = new Set(["Contribution to tank", "Dynamic contribution"]);
  const SOURCE_TOOLTIP_DYNAMIC_ROWS = new Set(["Target net flow", "Target dynamic net flow"]);
  const SOURCE_ROW_LABEL_RENAMES = new Map([
    ["Outlet Flow", "SRC Input Flow"],
    ["Source Flow", "SRC Input Flow"],
    ["Source Press.", "Source P abs"],
    ["Source Pressure", "Source P abs"]
  ]);
  const EXACT_SOURCE_VALUE_LABELS = new Set(["SRC Input Flow", "Evaluated Flow", "Source P abs", "Source Elev.", "Source Head"]);
  const FLOW_MISMATCH_TOLERANCE_M3H = 0.001;
  let realtimeMenuClickUnlocked = root.__srcDynamicInventoryDisplayUnlocked === true;
  let lastRealtimeMenuPointerAt = 0;
  let pendingRealtimeMenuUnlocked = null;
  let sourceObserverNormalizePending = false;
  let sourcePresentationRefreshTimer = null;
  const SOURCE_RENDER_HOOKS = new Set();

  function normalizeRowLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function finiteNumber(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstFiniteValue(...values) {
    for (const value of values) {
      const number = finiteNumber(value);
      if (number !== null) return number;
    }
    return null;
  }

  function convertDisplayValue(value, quantity) {
    const number = finiteNumber(value);
    if (number === null) return null;
    if (typeof root.convertToDisplay !== "function") return number;
    const converted = finiteNumber(root.convertToDisplay(number, quantity));
    return converted === null ? number : converted;
  }

  function formatDisplayValue(value, quantity, digits = 3, options = {}) {
    const number = convertDisplayValue(value, quantity);
    if (number === null) return "-";
    const formatted = number.toFixed(digits);
    return options.showSign && number > 0 ? `+${formatted}` : formatted;
  }

  function model() {
    return root.globalModel || root.__npshGlobalModel || {};
  }

  function sourceIdForNode(source, node, modelRef) {
    if (source?.id) return String(source.id);
    const entries = Object.entries(modelRef || {}).filter(([, candidate]) => candidate === node);
    if (entries.length === 1) return entries[0][0];
    const sources = Object.entries(modelRef || {}).filter(([, candidate]) => candidate?.type === "source");
    return sources.length === 1 ? sources[0][0] : "";
  }

  function connectionList(modelRef) {
    const candidates = [
      root.__npshConnections,
      root.connections,
      modelRef?.connections,
      modelRef?.__connections
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  function isHydraulicConnection(connection) {
    const type = normalizeRowLabel(connection?.connectionType || connection?.type);
    return !type || /hydraulic|process|pipe|flow/i.test(type) || Boolean(connection?.pipeId || connection?.via || connection?.linkId);
  }

  function connectionFrom(connection) {
    return normalizeRowLabel(connection?.from || connection?.rawFrom || connection?.source || connection?.start || connection?.sourceId);
  }

  function connectionTo(connection) {
    return normalizeRowLabel(connection?.to || connection?.rawTo || connection?.target || connection?.end || connection?.targetId);
  }

  function connectionPipeId(connection) {
    return normalizeRowLabel(connection?.pipeId || connection?.via || connection?.linkId || connection?.pipe);
  }

  function nodeSolvedFlow(node) {
    const results = node?.results || {};
    return firstFiniteValue(
      results.flow,
      results.outletFlow,
      results.inletFlow,
      results.sourceFlow,
      results.sinkFlow,
      results.flowDemand,
      results.calculationTrace?.basis?.flowM3H,
      results.calculationTrace?.boundary?.flow,
      results.calculationTrace?.boundary?.sourceFlow,
      results.calculationTrace?.boundary?.outletFlow,
      results.calculationTrace?.inputBasis?.flow,
      results.npshEvaluation?.flow,
      results.npshEvaluation?.calculationTrace?.basis?.flowM3H,
      results.npshEvaluation?.calculationTrace?.boundary?.flow,
      results.npshEvaluation?.calculationTrace?.boundary?.sourceFlow
    );
  }

  function connectedRouteFlowForSource(sourceId, modelRef) {
    if (!sourceId) return null;
    const hydraulicConnections = connectionList(modelRef).filter(isHydraulicConnection);
    for (const connection of hydraulicConnections) {
      const from = connectionFrom(connection);
      const to = connectionTo(connection);
      if (from !== sourceId && to !== sourceId) continue;
      const pipeFlow = nodeSolvedFlow(modelRef[connectionPipeId(connection)]);
      if (pipeFlow !== null) return pipeFlow;
      const neighborId = from === sourceId ? to : from;
      const neighborFlow = nodeSolvedFlow(modelRef[neighborId]);
      if (neighborFlow !== null) return neighborFlow;
    }
    return null;
  }

  function sourceHasHydraulicConnection(sourceId, modelRef = model()) {
    if (!sourceId) return false;
    return connectionList(modelRef).some((connection) => (
      isHydraulicConnection(connection)
      && (connectionFrom(connection) === sourceId || connectionTo(connection) === sourceId)
    ));
  }

  function singleRouteSolvedFlowForSource(sourceId, modelRef) {
    const sources = Object.entries(modelRef || {}).filter(([, candidate]) => candidate?.type === "source");
    if (sources.length !== 1 || (sourceId && sourceId !== sources[0][0])) return null;
    const flows = Object.values(modelRef || {})
      .filter((candidate) => candidate?.type === "pump" || candidate?.type === "sink")
      .map(nodeSolvedFlow)
      .filter((flow) => flow !== null);
    if (!flows.length) return null;
    const unique = new Set(flows.map((flow) => Number(flow).toFixed(9)));
    return unique.size === 1 ? flows[0] : null;
  }

  function solvedOperatingFlowForSource(sourceId, modelRef) {
    return firstFiniteValue(
      connectedRouteFlowForSource(sourceId, modelRef),
      singleRouteSolvedFlowForSource(sourceId, modelRef)
    );
  }

  function activeDensity(modelRef) {
    return firstFiniteValue(modelRef?.FLUID?.props?.density, root.globalModel?.FLUID?.props?.density, 1000) || 1000;
  }

  function pressureAbsBarFromSourceProps(props = {}, fallback = null) {
    const pressure = finiteNumber(props.pressure);
    if (pressure === null) return fallback;
    const basis = normalizeRowLabel(props.pressureInputBasis || props.pressureBasis || "Absolute");
    return /gauge/i.test(basis) ? pressure + 1.01325 : pressure;
  }

  function sourceHeadFromLiveInputs(pressureAbsBar, elevation, velocityHead, modelRef) {
    const pressure = finiteNumber(pressureAbsBar);
    const z = finiteNumber(elevation);
    if (pressure === null || z === null) return null;
    const density = activeDensity(modelRef);
    const velocity = finiteNumber(velocityHead) || 0;
    return pressure * 100000 / (density * 9.81) + z + velocity;
  }

  function sourceInputFlowForNode(node, modelRef) {
    const props = node?.props || {};
    props.flowInputMode = "Volumetric Flow";
    return firstFiniteValue(props.flow, props.flowM3h, props.volumetricFlow);
  }

  function flowsDiffer(a, b) {
    const left = finiteNumber(a);
    const right = finiteNumber(b);
    if (left === null || right === null) return false;
    return Math.abs(left - right) > FLOW_MISMATCH_TOLERANCE_M3H;
  }

  function sourceNodeFromArgs(args) {
    const [sourceId, sourceNode] = args || [];
    if (sourceNode && sourceNode.type === "source") return { id: sourceId, node: sourceNode };
    const modelRef = model();
    if (sourceId && modelRef[sourceId]?.type === "source") return { id: sourceId, node: modelRef[sourceId] };
    const allSources = Object.entries(modelRef).filter(([, node]) => node?.type === "source");
    return allSources.length === 1 ? { id: allSources[0][0], node: allSources[0][1] } : null;
  }

  function sourceNodeForCanvasPanel(panel) {
    const modelRef = model();
    const candidates = [
      panel?.dataset?.nodeId,
      panel?.dataset?.objectId,
      panel?.closest?.("[data-node-id]")?.dataset?.nodeId,
      panel?.closest?.("[data-object-id]")?.dataset?.objectId,
      panel?.closest?.(".pfd-object")?.dataset?.nodeId,
      panel?.closest?.(".pfd-object")?.dataset?.objectId
    ].filter(Boolean);
    for (const id of candidates) {
      if (modelRef[id]?.type === "source") return { id, node: modelRef[id] };
    }
    const objectText = normalizeRowLabel(panel?.closest?.(".pfd-object")?.textContent || panel?.textContent || "");
    const matching = Object.entries(modelRef).filter(([id, node]) => {
      if (node?.type !== "source") return false;
      return objectText.includes(id) || (node.name && objectText.includes(node.name));
    });
    if (matching.length === 1) return { id: matching[0][0], node: matching[0][1] };
    const allSources = Object.entries(modelRef).filter(([, node]) => node?.type === "source");
    return allSources.length === 1 ? { id: allSources[0][0], node: allSources[0][1] } : null;
  }

  function sourceCanonicalValues(source) {
    const node = source?.node || source || {};
    const modelRef = model();
    const sourceId = sourceIdForNode(source, node, modelRef);
    const results = node.results || {};
    const traceBoundary = results.calculationTrace?.boundary || {};
    const traceInput = results.calculationTrace?.inputBasis || {};
    const pumpTraceBoundary = results.npshEvaluation?.calculationTrace?.boundary || {};
    const props = node.props || {};
    const solvedFlow = solvedOperatingFlowForSource(sourceId, modelRef);
    const sourceInputFlow = firstFiniteValue(
      sourceInputFlowForNode(node, modelRef),
      traceInput.flow,
      traceInput.sourceFlow,
      traceBoundary.sourceInputFlow,
      results.sourceInputFlow
    );
    const tracePressureAbsBar = firstFiniteValue(
        traceBoundary.pressureAbsBar,
        traceBoundary.absolutePressureBar,
        traceBoundary.pressureInput,
        traceInput.pressureAbsBar,
        pumpTraceBoundary.pressureAbsBar,
        pumpTraceBoundary.absolutePressureBar,
        results.pressure,
        results.boundaryPressure,
        props.pressureAbsBar,
        props.absolutePressureBar
      );
    const livePressureAbsBar = pressureAbsBarFromSourceProps(props, tracePressureAbsBar);
    const liveElevation = firstFiniteValue(
        props.elevation,
        traceBoundary.elevation,
        traceInput.elevation,
        pumpTraceBoundary.elevation,
        results.elevation,
        results.sourceElevation
      );
    const traceVelocityHead = firstFiniteValue(
        traceBoundary.velocityHead,
        traceInput.velocityHead,
        pumpTraceBoundary.velocityHead,
        results.velocityHead,
        results.sourceVelocityHead
      );
    const liveSourceHead = sourceHeadFromLiveInputs(livePressureAbsBar, liveElevation, traceVelocityHead, modelRef);
    return {
      pressureAbsBar: livePressureAbsBar,
      elevation: liveElevation,
      sourceHead: firstFiniteValue(
        liveSourceHead,
        traceBoundary.totalSourceHead,
        traceBoundary.hydraulicHead,
        traceInput.totalSourceHead,
        traceInput.hydraulicHead,
        pumpTraceBoundary.totalSourceHead,
        pumpTraceBoundary.hydraulicHead,
        results.hydraulicHead,
        results.sourceHead,
        results.boundaryHead
      ),
      sourceInputFlow,
      evaluatedFlow: firstFiniteValue(
        solvedFlow,
        results.evaluatedFlow,
        results.flow,
        results.outletFlow,
        results.sourceFlow,
        traceBoundary.flow,
        traceBoundary.outletFlow,
        pumpTraceBoundary.flow,
        pumpTraceBoundary.sourceFlow
      ),
      sourceFlow: sourceInputFlow,
      flowMismatch: flowsDiffer(sourceInputFlow, solvedFlow)
    };
  }

  function canonicalSourceValueForLabel(label, canonical) {
    if (label === "SRC Input Flow" && finiteNumber(canonical.sourceInputFlow) !== null) return formatDisplayValue(canonical.sourceInputFlow, "flow", 3);
    if (label === "Evaluated Flow" && finiteNumber(canonical.evaluatedFlow) !== null) return formatDisplayValue(canonical.evaluatedFlow, "flow", 3);
    if (label === "Source P abs" && finiteNumber(canonical.pressureAbsBar) !== null) return formatDisplayValue(canonical.pressureAbsBar, "pressureAbs", 3);
    if (label === "Source Elev." && finiteNumber(canonical.elevation) !== null) return formatDisplayValue(canonical.elevation, "head", 3);
    if (label === "Source Head" && finiteNumber(canonical.sourceHead) !== null) return formatDisplayValue(canonical.sourceHead, "head", 3);
    return null;
  }

  function canonicalSourceTitleForLabel(label) {
    if (label === "SRC Input Flow") return "Fixed SRC flow input; this remains the source-side boundary value even when downstream demand differs";
    if (label === "Evaluated Flow") return "Solved/evaluated route flow used by the current hydraulic or NPSH result";
    if (label === "Source P abs") return "Absolute source pressure used for suction-head calculation";
    if (label === "Source Elev.") return "Effective source elevation or inherited liquid surface elevation";
    if (label === "Source Head") return "Total source hydraulic head before suction losses";
    return "";
  }

  function sourcePanelRowValue(panel, label) {
    const target = normalizeRowLabel(label);
    const row = Array.from(panel?.querySelectorAll?.(".source-live-param-row") || []).find((candidate) => (
      normalizeRowLabel(candidate.querySelector(".source-live-param-label")?.textContent) === target
    ));
    return normalizeRowLabel(row?.querySelector?.(".source-live-param-value, strong")?.textContent);
  }

  function sourceModeDisplayValue(node = {}, panel = null) {
    const panelMode = sourcePanelRowValue(panel, "Mode");
    if (panelMode) return panelMode;
    const rawMode = normalizeRowLabel(node.results?.boundaryMode || node.props?.sourceType || node.props?.mode || node.props?.boundaryMode);
    if (/fixed/i.test(rawMode)) return "Fixed";
    if (/dynamic/i.test(rawMode)) return "Dynamic";
    if (/manual/i.test(rawMode)) return "Manual";
    return rawMode.replace(/\s*Source$/i, "").replace(/\s*Boundary$/i, "") || "-";
  }

  function sourceStatusDisplayValue(node = {}, canonical = {}) {
    const modelRef = model();
    const sourceId = sourceIdForNode({ node }, node, modelRef);
    if (!sourceHasHydraulicConnection(sourceId, modelRef)) return "Incomplete";
    const rawStatus = normalizeRowLabel(
      node.results?.sourceStatus
      || node.results?.status
      || node.results?.hydraulicStatus
      || node.results?.operatingStatus
    );
    if (rawStatus && !/no solved pump suction path/i.test(rawStatus)) return rawStatus;
    if (
      finiteNumber(canonical.sourceFlow) !== null
      && finiteNumber(canonical.pressureAbsBar) !== null
      && finiteNumber(canonical.sourceHead) !== null
    ) {
      return "OK";
    }
    return rawStatus || "No solved source route";
  }

  function syncSourcePresentationStatus(panel, source) {
    const object = panel?.closest?.(".pfd-object");
    const sourceId = source?.id || sourceIdForNode(source, source?.node || source || {}, model());
    const connected = sourceHasHydraulicConnection(sourceId, model());
    let changed = 0;
    if (panel?.classList) {
      if (panel.classList.contains("source-live-params-incomplete") !== !connected) {
        if (!connected) panel.classList.add("source-live-params-incomplete");
        else panel.classList.remove("source-live-params-incomplete");
        changed += 1;
      }
      if (panel.classList.contains("source-live-params-safe") !== connected) {
        if (connected) panel.classList.add("source-live-params-safe");
        else panel.classList.remove("source-live-params-safe");
        changed += 1;
      }
    }
    if (object?.classList) {
      if (object.classList.contains("source-status-incomplete") !== !connected) {
        if (!connected) object.classList.add("source-status-incomplete");
        else object.classList.remove("source-status-incomplete");
        changed += 1;
      }
      if (object.classList.contains("source-status-safe") !== connected) {
        if (connected) object.classList.add("source-status-safe");
        else object.classList.remove("source-status-safe");
        changed += 1;
      }
      const targetStatus = connected ? "normal" : "incomplete";
      if (object.dataset.operatingStatus !== targetStatus) {
        object.dataset.operatingStatus = targetStatus;
        changed += 1;
      }
    }
    return changed;
  }

  function sourceObjectTooltip(source, panel = null) {
    const node = source?.node || source || {};
    const canonical = sourceCanonicalValues(source);
    const sourceFlow = sourcePanelRowValue(panel, "SRC Input Flow") || formatDisplayValue(canonical.sourceInputFlow, "flow", 3);
    const evaluatedFlow = sourcePanelRowValue(panel, "Evaluated Flow") || formatDisplayValue(canonical.evaluatedFlow, "flow", 3);
    const pressureAbsBar = sourcePanelRowValue(panel, "Source P abs") || formatDisplayValue(canonical.pressureAbsBar, "pressureAbs", 3);
    const elevation = sourcePanelRowValue(panel, "Source Elev.") || formatDisplayValue(canonical.elevation, "head", 3);
    const sourceHead = sourcePanelRowValue(panel, "Source Head") || formatDisplayValue(canonical.sourceHead, "head", 3);
    const lines = [
      `SRC status: ${sourceStatusDisplayValue(node, canonical)}`,
      `Mode: ${sourceModeDisplayValue(node, panel)}`,
      `SRC Input Flow: ${sourceFlow} m3/h`,
      `Source P abs: ${pressureAbsBar} bar a`,
      `Source Elev.: ${elevation} m`,
      `Source Head: ${sourceHead} m`
    ];
    if (canonical.flowMismatch) lines.splice(3, 0, `Evaluated Flow: ${evaluatedFlow} m3/h`);
    return lines.join("\n");
  }

  function syncSourceObjectTooltip(panel, source) {
    const object = panel?.closest?.(".pfd-object");
    if (!object) return 0;
    const title = sourceObjectTooltip(source, panel);
    const storedTitle = object.getAttribute("data-engineering-runtime-originaltitle") || "";
    if (object.title === title && storedTitle === title) return 0;
    object.title = title;
    object.setAttribute("data-engineering-runtime-originaltitle", title);
    object.dataset.sourceObjectTooltipLock = LOCK_VERSION;
    return 1;
  }

  function formatTooltipParsedNumber(line, metricLabels, unit, digits = 3) {
    const match = String(line || "").match(/^([^:]+):\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)(?:\s+.*)?$/i);
    if (!match) return line;
    const label = normalizeRowLabel(match[1]);
    if (!metricLabels.has(label)) return line;
    const number = finiteNumber(match[2]);
    if (number === null) return line;
    return `${label}: ${number.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
  }

  function normalizeSourceFlowTooltipLine(line, canonical) {
    const exactValue = canonicalSourceValueForLabel("SRC Input Flow", canonical);
    if (exactValue !== null) return `SRC Input Flow: ${exactValue} m3/h`;
    return formatTooltipParsedNumber(line, new Set(["Flow to suction network"]), "m3/h", 3)
      .replace(/^Flow to suction network:/i, "SRC Input Flow:");
  }

  function shouldShowEvaluatedFlow(canonical) {
    return finiteNumber(canonical.evaluatedFlow) !== null && flowsDiffer(canonical.sourceInputFlow, canonical.evaluatedFlow);
  }

  function shouldHideSourceTooltipLine(line) {
    const label = normalizeRowLabel(String(line || "").split(":")[0]);
    return SOURCE_TOOLTIP_HIDDEN_ROWS.has(label) || (!isRealtimeDynamicUnlocked() && SOURCE_TOOLTIP_DYNAMIC_ROWS.has(label));
  }

  function normalizeSourceRows(rows, sourceId, sourceNode) {
    if (!Array.isArray(rows)) return rows;
    const source = sourceNodeFromArgs([sourceId, sourceNode]);
    const canonical = sourceCanonicalValues(source);
    const normalizedRows = rows.map((row) => {
      if (!row || typeof row !== "object") return row;
      const oldLabel = normalizeRowLabel(row.label);
      const label = SOURCE_ROW_LABEL_RENAMES.get(oldLabel) || oldLabel;
      if (!EXACT_SOURCE_VALUE_LABELS.has(label)) return oldLabel === label ? row : { ...row, label };
      const exactValue = canonicalSourceValueForLabel(label, canonical);
      return {
        ...row,
        label,
        title: canonicalSourceTitleForLabel(label) || row.title,
        value: exactValue === null ? row.value : exactValue
      };
    });
    if (shouldShowEvaluatedFlow(canonical) && !normalizedRows.some((row) => normalizeRowLabel(row?.label) === "Evaluated Flow")) {
      const sourceIndex = normalizedRows.findIndex((row) => normalizeRowLabel(row?.label) === "SRC Input Flow");
      const evaluatedRow = {
        label: "Evaluated Flow",
        value: canonicalSourceValueForLabel("Evaluated Flow", canonical),
        unit: "m3/h",
        title: canonicalSourceTitleForLabel("Evaluated Flow")
      };
      normalizedRows.splice(sourceIndex >= 0 ? sourceIndex + 1 : 1, 0, evaluatedRow);
    }
    return normalizedRows;
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

  function setTextIfChanged(element, value) {
    if (!element || value === null || value === undefined) return false;
    const text = String(value);
    if (element.textContent === text) return false;
    element.textContent = text;
    return true;
  }

  function sourceRowByLabel(panel, label) {
    const target = normalizeRowLabel(label);
    return Array.from(panel?.querySelectorAll?.(".source-live-param-row") || []).find((candidate) => (
      normalizeRowLabel(candidate.querySelector(".source-live-param-label")?.textContent) === target
    ));
  }

  function createSourceCanvasRow(label, value, title = "") {
    const row = document.createElement("div");
    row.className = "source-live-param-row";
    const labelElement = document.createElement("span");
    labelElement.className = "source-live-param-label";
    const valueElement = document.createElement("strong");
    valueElement.className = "source-live-param-value";
    labelElement.textContent = label;
    valueElement.textContent = value;
    if (title) row.title = title;
    row.dataset.sourceSinkTerminologyLock = LOCK_VERSION;
    row.append(labelElement, valueElement);
    return row;
  }

  function upsertSourceCanvasRow(panel, label, value, anchorLabels = []) {
    const existing = sourceRowByLabel(panel, label);
    if (existing) {
      const valueElement = existing.querySelector(".source-live-param-value, strong");
      const title = canonicalSourceTitleForLabel(label);
      let changed = setTextIfChanged(valueElement, value) ? 1 : 0;
      if (title && existing.title !== title) {
        existing.title = title;
        changed += 1;
      }
      existing.dataset.sourceSinkTerminologyLock = LOCK_VERSION;
      return changed;
    }
    const row = createSourceCanvasRow(label, value, canonicalSourceTitleForLabel(label));
    const rows = Array.from(panel?.querySelectorAll?.(".source-live-param-row") || []);
    const anchor = anchorLabels
      .map((candidate) => sourceRowByLabel(panel, candidate))
      .find(Boolean);
    if (anchor && anchor.parentNode === panel) {
      panel.insertBefore(row, anchor.nextSibling);
    } else if (rows.length) {
      rows[0].parentNode.insertBefore(row, rows[0].nextSibling);
    } else {
      panel.appendChild(row);
    }
    return 1;
  }

  function normalizeRenderedSourceRows(scope) {
    if (typeof document === "undefined") return 0;
    const rootNode = scope && scope.querySelectorAll ? scope : document;
    let changed = 0;
    const panels = new Set();
    if (rootNode.matches?.(".source-live-params")) panels.add(rootNode);
    rootNode.closest?.(".source-live-params") && panels.add(rootNode.closest(".source-live-params"));
    rootNode.querySelectorAll?.(".source-live-params").forEach((panel) => panels.add(panel));
    panels.forEach((panel) => {
      const source = sourceNodeForCanvasPanel(panel);
      const canonical = sourceCanonicalValues(source);
      panel.querySelectorAll(".source-live-param-row").forEach((row) => {
        const labelElement = row.querySelector(".source-live-param-label");
        const valueElement = row.querySelector(".source-live-param-value, strong");
        const oldLabel = normalizeRowLabel(labelElement?.textContent);
        const label = SOURCE_ROW_LABEL_RENAMES.get(oldLabel) || oldLabel;
        if (oldLabel !== label) changed += setTextIfChanged(labelElement, label) ? 1 : 0;
        if (EXACT_SOURCE_VALUE_LABELS.has(label)) {
          const exactValue = canonicalSourceValueForLabel(label, canonical);
          if (exactValue !== null) changed += setTextIfChanged(valueElement, exactValue) ? 1 : 0;
          const title = canonicalSourceTitleForLabel(label);
          if (title && row.title !== title) {
            row.title = title;
            changed += 1;
          }
          row.dataset.sourceSinkTerminologyLock = LOCK_VERSION;
        }
      });
      if (shouldShowEvaluatedFlow(canonical)) {
        changed += upsertSourceCanvasRow(
          panel,
          "Evaluated Flow",
          canonicalSourceValueForLabel("Evaluated Flow", canonical),
          ["SRC Input Flow", "Mode"]
        );
      }
      changed += syncSourcePresentationStatus(panel, source);
      changed += syncSourceObjectTooltip(panel, source);
    });
    return changed;
  }

  function roleFromBoundaryCard(card) {
    const title = normalizeRowLabel(card?.querySelector?.("strong")?.textContent || card?.textContent || "");
    const idLine = normalizeRowLabel(card?.querySelector?.("span")?.textContent || "");
    if (/suction|source|\bSRC-/i.test(`${title} ${idLine}`)) return "source";
    if (/discharge|sink|\bSNK-/i.test(`${title} ${idLine}`)) return "sink";
    return "";
  }

  function normalizeBoundaryTerminology(scope) {
    if (typeof document === "undefined") return 0;
    const rootNode = scope && scope.querySelectorAll ? scope : document;
    let changed = 0;
    rootNode.querySelectorAll?.(".pump-optimization-boundary-card").forEach((card) => {
      const role = roleFromBoundaryCard(card);
      const title = card.querySelector("strong");
      const subtitle = card.querySelector("span");
      if (role === "source") changed += setTextIfChanged(title, "Suction Source") ? 1 : 0;
      if (role === "sink") changed += setTextIfChanged(title, "Discharge Sink") ? 1 : 0;
      if (subtitle) {
        const normalizedSubtitle = String(subtitle.textContent || "")
          .replace(/\bStandalone Boundary Source\b/g, "Standalone Source")
          .replace(/\bFlow Demand Boundary\b/g, "Flow Demand Sink")
          .replace(/\bOutlet Pressure Boundary\b/g, "Outlet Pressure Sink");
        changed += setTextIfChanged(subtitle, normalizedSubtitle) ? 1 : 0;
      }
      card.querySelectorAll("dt").forEach((term) => {
        const label = normalizeRowLabel(term.textContent);
        if (label === "P abs") {
          changed += setTextIfChanged(term, role === "sink" ? "Sink P abs" : "Source P abs") ? 1 : 0;
        } else if (label === "Boundary Head") {
          changed += setTextIfChanged(term, role === "sink" ? "Sink Head" : "Source Head") ? 1 : 0;
        }
      });
      card.dataset.sourceSinkTerminologyLock = LOCK_VERSION;
    });
    return changed;
  }

  function normalizeRenderedTerminology(scope) {
    return normalizeRenderedSourceRows(scope) + normalizeBoundaryTerminology(scope);
  }

  function pruneRenderedSourceRows(scope) {
    if (typeof document === "undefined") return;
    const rootNode = scope && scope.querySelectorAll ? scope : document;
    normalizeRenderedTerminology(rootNode);
    if (isRealtimeDynamicUnlocked()) return;
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

  function scheduleSourcePresentationRefresh() {
    if (typeof document === "undefined") return;
    root.clearTimeout?.(sourcePresentationRefreshTimer);
    sourcePresentationRefreshTimer = root.setTimeout(() => {
      sourcePresentationRefreshTimer = null;
      normalizeRenderedTerminology(document);
    }, 160);
  }

  function patchSourceRenderFunction(functionName) {
    if (SOURCE_RENDER_HOOKS.has(functionName)) return false;
    const original = root[functionName];
    if (typeof original !== "function" || original.__srcCanvasParameterPresentationLock) return false;
    function sourceCanvasParameterPresentationLockedFunction(...args) {
      const result = original.apply(this, args);
      const refresh = () => scheduleSourcePresentationRefresh();
      if (result && typeof result.then === "function") return result.finally(refresh);
      refresh();
      return result;
    }
    sourceCanvasParameterPresentationLockedFunction.__srcCanvasParameterPresentationLock = LOCK_VERSION;
    sourceCanvasParameterPresentationLockedFunction.__srcOriginalPresentationFunction = original;
    root[functionName] = sourceCanvasParameterPresentationLockedFunction;
    SOURCE_RENDER_HOOKS.add(functionName);
    return true;
  }

  function installFunctionLocks() {
    root.__srcCanvasParameterDefaultLock = LOCK_VERSION;
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.dataset.srcCanvasParameterDefaultLock = LOCK_VERSION;
    }
    root.isSourceLiveDynamicDisplayActive = isRealtimeDynamicUnlocked;
    root.filterSourceLiveParameterRows = filterSourceRows;
    [
      "updateSimulation",
      "applyBackendSimulationPrimaryResults",
      "updateAllObjectOperatingStatusVisuals",
      "drawConnections"
    ].forEach((functionName) => patchSourceRenderFunction(functionName));

    if (
      typeof root.buildSourceLiveParameterRows === "function"
      && root.buildSourceLiveParameterRows.__srcCanvasParameterDefaultLock !== LOCK_VERSION
    ) {
      const originalBuildSourceRows = root.buildSourceLiveParameterRows;
      const lockedBuildSourceRows = function(...args) {
        return filterSourceRows(normalizeSourceRows(originalBuildSourceRows.apply(this, args), args[0], args[1]));
      };
      lockedBuildSourceRows.__srcCanvasParameterDefaultLock = LOCK_VERSION;
      lockedBuildSourceRows.__srcOriginalBuildSourceLiveParameterRows = originalBuildSourceRows;
      root.buildSourceLiveParameterRows = lockedBuildSourceRows;
    }

    if (
      typeof root.getSourceOperatingStatusTooltip === "function"
      && root.getSourceOperatingStatusTooltip.__srcCanvasParameterDefaultLock !== LOCK_VERSION
    ) {
      const originalSourceTooltip = root.getSourceOperatingStatusTooltip;
      const lockedSourceTooltip = function(...args) {
        const text = String(originalSourceTooltip.apply(this, args) || "");
        const source = sourceNodeFromArgs([args[0], args[1]]);
        const canonical = sourceCanonicalValues(source);
        const flowLabels = new Set(["Flow to suction network", "Contribution to tank", "Dynamic contribution", "Target net flow", "Target dynamic net flow"]);
        const replacements = [
          [/^Flow to suction network:.*$/i, null],
          [/^Source pressure:.*$/i, `Source P abs: ${formatDisplayValue(canonical.pressureAbsBar, "pressureAbs", 3)} bar a`],
          [/^Source elevation:.*$/i, `Source Elev.: ${formatDisplayValue(canonical.elevation, "head", 3)} m`],
          [/^Source head:.*$/i, `Source Head: ${formatDisplayValue(canonical.sourceHead, "head", 3)} m`]
        ];
        return text.split("\n").map((line) => {
          for (const [pattern, replacement] of replacements) {
            if (pattern.test(line)) return replacement === null ? normalizeSourceFlowTooltipLine(line, canonical) : replacement;
          }
          return formatTooltipParsedNumber(line, flowLabels, "m3/h", 3);
        }).filter((line) => !shouldHideSourceTooltipLine(line)).join("\n");
      };
      lockedSourceTooltip.__srcCanvasParameterDefaultLock = LOCK_VERSION;
      root.getSourceOperatingStatusTooltip = lockedSourceTooltip;
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
      let shouldRefreshAll = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
          if (node && node.nodeType === 1) pruneRenderedSourceRows(node);
          if (node && (node.nodeType === 1 || node.nodeType === 3)) shouldRefreshAll = true;
        }
        if (mutation.type === "characterData" && mutation.target?.parentElement) {
          pruneRenderedSourceRows(mutation.target.parentElement);
          shouldRefreshAll = true;
        }
      }
      if (shouldRefreshAll && !sourceObserverNormalizePending) {
        sourceObserverNormalizePending = true;
        root.setTimeout(() => {
          sourceObserverNormalizePending = false;
          normalizeRenderedSourceRows(document.getElementById("canvas") || document);
        }, 120);
      }
    });
    root.__srcCanvasParameterDefaultLockObserver.observe(document.getElementById("canvas") || document.body, { childList: true, subtree: true, characterData: true });
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
    if (attempts >= 32) root.clearInterval(installTimer);
  }, 250);

  ["DOMContentLoaded", "load", "pointerdown", "keydown"].forEach((eventName) => {
    root.addEventListener?.(eventName, () => root.setTimeout(install, 0), { passive: true });
  });
}(typeof window !== "undefined" ? window : globalThis);
