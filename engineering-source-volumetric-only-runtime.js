!function registerEngineeringSourceVolumetricOnlyRuntime(root) {
  "use strict";

  const VERSION = "2026.07-source-boundary-clean1";
  const FLOW_MODE = "Volumetric Flow";
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
    "refreshBackendProtectedSelectedObjectTaskWindow",
    "refreshBackendProtectedRealtimeTaskWindows",
    "updateSimulation",
    "applySimulationStateAtomic"
  ];

  const patchedFunctions = new Set();
  let observer = null;
  let cleanupTimer = 0;
  let installAttempts = 0;

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
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
      label.setAttribute?.("data-i18n-fallback", "Volumetric Flow");
      label.setAttribute?.("data-i18n-text", "task.source.volumetricFlow");
    }
    if (row?.dataset) {
      row.dataset.propKey = "flow";
      row.dataset.sourceVolumetricOnly = VERSION;
    }
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
    input.dataset.key = "flow";
    if (sourceId) input.dataset.node = sourceId;
    input.removeAttribute("readonly");
    input.disabled = false;
    input.dataset.sourceVolumetricOnly = VERSION;
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
    if (notify && typeof root.EngineeringRealtimeCalculationDefense?.notifyDependencyChanged === "function") {
      root.EngineeringRealtimeCalculationDefense.notifyDependencyChanged({
        dependency: "source.volumetric-flow",
        nodeId: sourceId,
        reason: "Source Volumetric Flow changed; recalculating route hydraulic/NPSH results.",
        sourceEvent: "source-volumetric-flow-input",
        target: input
      });
    }
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
    scope.dataset && (scope.dataset.sourceVolumetricOnly = VERSION);
    return true;
  }

  function cleanupSourceTaskWindows(rootNode = document) {
    normalizeAllSourceNodes();
    sourceScopes(rootNode).forEach(cleanupSourceScope);
    document.documentElement.dataset.sourceVolumetricOnlyRuntime = VERSION;
  }

  function scheduleCleanup(rootNode = document, delayMs = 0) {
    if (typeof document === "undefined" || typeof root.setTimeout !== "function") return;
    root.clearTimeout?.(cleanupTimer);
    cleanupTimer = root.setTimeout(() => {
      cleanupTimer = 0;
      cleanupSourceTaskWindows(rootNode);
    }, Math.max(0, delayMs));
  }

  function patchFunction(functionName) {
    if (patchedFunctions.has(functionName)) return false;
    const original = root[functionName];
    if (typeof original !== "function" || original.__sourceVolumetricOnlyRuntime) return false;
    function sourceVolumetricOnlyWrapper(...args) {
      normalizeAllSourceNodes();
      const result = original.apply(this, args);
      const after = () => {
        cleanupSourceTaskWindows(document);
        scheduleCleanup(document, 20);
      };
      if (result && typeof result.then === "function") return result.finally(after);
      after();
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
    style.textContent = [
      '[data-prop-key="flowInputMode"],',
      '[data-prop-key="massFlow"],',
      '[data-prop-key="sourceType"],',
      '[data-prop-key="source-type-meaning"],',
      '[data-source-volumetric-only-removed="2026.07-source-boundary-clean1"]{display:none!important;}',
      '.source-volumetric-only-hidden{display:none!important;}'
    ].join("\n");
    document.head.appendChild(style);
    return true;
  }

  function installEvents() {
    if (typeof document === "undefined" || document.documentElement.dataset.sourceVolumetricOnlyEvents === VERSION) return false;
    document.documentElement.dataset.sourceVolumetricOnlyEvents = VERSION;
    document.addEventListener("input", (event) => {
      const input = event.target?.closest?.('input[data-key="flow"][data-node]');
      if (!input || model()?.[input.dataset.node]?.type !== "source") return;
      syncModelFromFlowInput(input, input.dataset.sourceVolumetricOnlyCreated === VERSION);
      scheduleCleanup(input.closest(".task-window, #taskWindow, .object-properties-task-body, [role='dialog']") || document, 0);
    }, true);
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (target?.matches?.('select[data-key="flowInputMode"], select[name="flowInputMode"]')) {
        target.value = FLOW_MODE;
        scheduleCleanup(target.closest(".task-window, #taskWindow, .object-properties-task-body, [role='dialog']") || document, 0);
      }
    }, true);
    [
      "npsh:calculation-current",
      "npsh:realtime-autosolve-complete",
      "npsh:linked-views-refreshed"
    ].forEach((eventName) => document.addEventListener(eventName, () => scheduleCleanup(document, 20), true));
    return true;
  }

  function installObserver() {
    if (observer || typeof MutationObserver === "undefined" || typeof document === "undefined") return false;
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => (
        Array.from(mutation.addedNodes || []).some((node) => node?.nodeType === 1 && (
          node.matches?.(".task-window, #taskWindow, .object-properties-task-body")
          || node.querySelector?.("[data-prop-key='flowInputMode'], [data-key='massFlow'], [data-key='flow']")
        ))
      ))) {
        cleanupSourceTaskWindows(document);
        scheduleCleanup(document, 20);
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
    syncModelFromFlowInput
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
