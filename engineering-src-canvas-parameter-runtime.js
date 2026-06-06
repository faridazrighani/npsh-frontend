!function(root) {
  "use strict";

  const LOCK_VERSION = "2026.06-src-canvas-source-sink-terminology-lock1";
  const ALWAYS_HIDDEN_ROWS = new Set(["Suction Loss", "NPSH at Pump", "Pump NPSHa"]);
  const DYNAMIC_ROWS = new Set(["Dyn Mode", "Target", "Dyn Feed", "Target Net", "Dyn Net", "Target Trend", "Dyn Trend"]);
  const SOURCE_ROW_LABEL_RENAMES = new Map([
    ["Source Press.", "Source P abs"],
    ["Source Pressure", "Source P abs"]
  ]);
  const EXACT_SOURCE_VALUE_LABELS = new Set(["Source P abs", "Source Elev.", "Source Head"]);
  let realtimeMenuClickUnlocked = root.__srcDynamicInventoryDisplayUnlocked === true;
  let lastRealtimeMenuPointerAt = 0;
  let pendingRealtimeMenuUnlocked = null;

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
    const results = node.results || {};
    const traceBoundary = results.calculationTrace?.boundary || {};
    const traceInput = results.calculationTrace?.inputBasis || {};
    const pumpTraceBoundary = results.npshEvaluation?.calculationTrace?.boundary || {};
    const props = node.props || {};
    return {
      pressureAbsBar: firstFiniteValue(
        traceBoundary.pressureAbsBar,
        traceBoundary.absolutePressureBar,
        traceBoundary.pressureInput,
        traceInput.pressureAbsBar,
        pumpTraceBoundary.pressureAbsBar,
        pumpTraceBoundary.absolutePressureBar,
        results.pressure,
        results.boundaryPressure,
        props.pressure,
        props.pressureAbsBar,
        props.absolutePressureBar
      ),
      elevation: firstFiniteValue(
        traceBoundary.elevation,
        traceInput.elevation,
        pumpTraceBoundary.elevation,
        results.elevation,
        results.sourceElevation,
        props.elevation
      ),
      sourceHead: firstFiniteValue(
        traceBoundary.totalSourceHead,
        traceBoundary.hydraulicHead,
        traceInput.totalSourceHead,
        traceInput.hydraulicHead,
        pumpTraceBoundary.totalSourceHead,
        pumpTraceBoundary.hydraulicHead,
        results.hydraulicHead,
        results.sourceHead,
        results.boundaryHead
      )
    };
  }

  function canonicalSourceValueForLabel(label, canonical) {
    if (label === "Source P abs") return formatDisplayValue(canonical.pressureAbsBar, "pressureAbs", 3);
    if (label === "Source Elev.") return formatDisplayValue(canonical.elevation, "head", 3);
    if (label === "Source Head") return formatDisplayValue(canonical.sourceHead, "head", 3);
    return null;
  }

  function canonicalSourceTitleForLabel(label) {
    if (label === "Source P abs") return "Absolute source pressure used for suction-head calculation";
    if (label === "Source Elev.") return "Effective source elevation or inherited liquid surface elevation";
    if (label === "Source Head") return "Total source hydraulic head before suction losses";
    return "";
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

  function normalizeSourceRows(rows, sourceId, sourceNode) {
    if (!Array.isArray(rows)) return rows;
    const source = sourceNodeFromArgs([sourceId, sourceNode]);
    const canonical = sourceCanonicalValues(source);
    return rows.map((row) => {
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
          [/^Source pressure:.*$/i, `Source P abs: ${formatDisplayValue(canonical.pressureAbsBar, "pressureAbs", 3)} bar a`],
          [/^Source elevation:.*$/i, `Source Elev.: ${formatDisplayValue(canonical.elevation, "head", 3)} m`],
          [/^Source head:.*$/i, `Source Head: ${formatDisplayValue(canonical.sourceHead, "head", 3)} m`]
        ];
        return text.split("\n").map((line) => {
          for (const [pattern, replacement] of replacements) {
            if (pattern.test(line)) return replacement;
          }
          return formatTooltipParsedNumber(line, flowLabels, "m3/h", 3);
        }).join("\n");
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
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
          if (node && node.nodeType === 1) pruneRenderedSourceRows(node);
        }
        if (mutation.type === "characterData" && mutation.target?.parentElement) {
          pruneRenderedSourceRows(mutation.target.parentElement);
        }
      }
    });
    root.__srcCanvasParameterDefaultLockObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
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
