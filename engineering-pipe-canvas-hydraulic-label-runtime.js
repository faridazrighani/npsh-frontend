!function(root) {
  "use strict";

  const VERSION = "2026.06-pipe-canvas-hydraulic-label4";
  const STYLE_ID = "engineeringPipeCanvasHydraulicLabelStyle";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const LABEL_SELECTOR = "#svg-lines .pipe-delta-label[data-pipe-id]";
  const DISPLAY_DIGITS = 3;
  const BLOCK_WIDTH = 132;
  const BLOCK_HEIGHT = 57;
  const BLOCK_TOP = -63;
  const ROW_TOP = -51.5;
  const ROW_GAP = 9.5;
  const KEY_X = -60;
  const VALUE_X = -24;

  let observer = null;
  let refreshQueued = false;
  let installAttempts = 0;

  function runtimeModel() {
    try {
      if (typeof globalModel !== "undefined" && globalModel) return globalModel;
    } catch (error) {
      // Protected builds may not expose globalModel as a direct binding.
    }
    return root.globalModel || root.__npshGlobalModel || {};
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

  function formatFixed(value, digits = DISPLAY_DIGITS) {
    const number = finiteNumber(value);
    return number === null ? "-" : number.toFixed(digits);
  }

  function formatPressurePair(pin, pout) {
    return `${formatFixed(pin)} \u2192 ${formatFixed(pout)} bar`;
  }

  function formatVelocity(value) {
    return `${formatFixed(value)} m/s`;
  }

  function formatTotalK(value) {
    return formatFixed(value);
  }

  function formatHead(value) {
    return `${formatFixed(value)} m`;
  }

  function traceSourceValue(trace, patterns = []) {
    const sourceMap = Array.isArray(trace?.sourceMap) ? trace.sourceMap : [];
    for (const pattern of patterns) {
      const entry = sourceMap.find((item) => pattern.test(String(item?.parameter || item?.label || "")));
      const value = firstFiniteValue(entry?.value, entry?.rawValue, entry?.result);
      if (value !== null) return value;
    }
    return null;
  }

  function tracePressureProfileValue(trace, key, fromEnd = false) {
    const segments = Array.isArray(trace?.segments) ? trace.segments : [];
    const ordered = fromEnd ? segments.slice().reverse() : segments;
    for (const segment of ordered) {
      const profile = segment?.profile || {};
      const value = firstFiniteValue(profile[key], segment?.[key]);
      if (value !== null) return value;
    }
    return null;
  }

  function getTrace(pipeId, pipe, flow) {
    const results = pipe?.results || {};
    const existing = results.calculationTrace || null;
    if (typeof root.buildPipeCalculationTrace !== "function" || !pipe?.props || firstFiniteValue(flow) === null) {
      return existing;
    }
    try {
      return root.buildPipeCalculationTrace(flow, pipe.props || {}, results, null, pipeId) || existing;
    } catch (error) {
      return existing;
    }
  }

  function getCalculatedSegments(pipeId, pipe, flow) {
    if (typeof root.calculatePipeHydraulicSegments !== "function" || !pipe?.props || firstFiniteValue(flow) === null) {
      return [];
    }
    try {
      const segments = root.calculatePipeHydraulicSegments(flow, pipe.props || {}, null, pipeId);
      return Array.isArray(segments) ? segments : [];
    } catch (error) {
      return [];
    }
  }

  function pipePropsTotalK(pipe) {
    const segments = Array.isArray(pipe?.props?.segments) ? pipe.props.segments : [];
    if (!segments.length) return null;
    return segments.reduce((total, segment) => {
      const quantity = Math.max(0, firstFiniteValue(segment.fittingQuantity, segment.quantity, 0) || 0);
      const fittingK = Math.max(0, firstFiniteValue(segment.fittingK, segment.k, 0) || 0);
      const additionalK = Math.max(0, firstFiniteValue(segment.minorLoss, segment.additionalK, 0) || 0);
      return total + quantity * fittingK + additionalK;
    }, 0);
  }

  function sumCalculatedSegmentValue(segments, key) {
    if (!Array.isArray(segments) || !segments.length) return null;
    let hasValue = false;
    const total = segments.reduce((sum, segment) => {
      const value = firstFiniteValue(segment?.[key]);
      if (value === null) return sum;
      hasValue = true;
      return sum + value;
    }, 0);
    return hasValue ? total : null;
  }

  function fallbackVelocityFromProps(pipe, flow) {
    const flowNumber = firstFiniteValue(flow);
    const segments = Array.isArray(pipe?.props?.segments) ? pipe.props.segments : [];
    const segment = segments.find((item) => firstFiniteValue(item?.diameter) !== null);
    const diameterRaw = firstFiniteValue(segment?.diameter);
    if (flowNumber === null || diameterRaw === null || diameterRaw <= 0) return null;
    const diameter = diameterRaw > 5 ? diameterRaw / 1000 : diameterRaw;
    const area = Math.PI * diameter * diameter / 4;
    return area > 0 ? (flowNumber / 3600) / area : null;
  }

  function representativeVelocity({ pipe, flow, trace, calculatedSegments }) {
    const segmentVelocities = calculatedSegments
      .map((segment) => firstFiniteValue(segment.velocity))
      .filter((value) => value !== null);
    if (segmentVelocities.length) return Math.max(...segmentVelocities);

    const traceVelocities = [
      ...(Array.isArray(trace?.segments) ? trace.segments : []),
      ...(Array.isArray(trace?.fittingValveBreakdown) ? trace.fittingValveBreakdown : [])
    ]
      .map((segment) => firstFiniteValue(segment.velocity))
      .filter((value) => value !== null);
    if (traceVelocities.length) return Math.max(...traceVelocities);

    return firstFiniteValue(
      pipe?.results?.velocity,
      pipe?.results?.flowVelocity,
      trace?.basis?.velocity,
      fallbackVelocityFromProps(pipe, flow)
    );
  }

  function buildPipeHydraulicLabelData(pipeId, pipeInput = null) {
    const model = runtimeModel();
    const pipe = pipeInput || model?.[pipeId];
    if (!pipe || pipe.type !== "pipe") return null;

    const results = pipe.results || {};
    const flow = firstFiniteValue(results.flow, results.calculationTrace?.basis?.flowM3H, pipe.props?.flow);
    const trace = getTrace(pipeId, pipe, flow) || {};
    const calculatedSegments = getCalculatedSegments(pipeId, pipe, flow);
    const totals = trace.totals || {};

    const pin = firstFiniteValue(
      results.inletPressure,
      results.pin,
      results.pressureIn,
      traceSourceValue(trace, [/^inlet pressure$/i, /^pin$/i, /pipe.*in/i]),
      tracePressureProfileValue(trace, "startPressure", false)
    );
    const pout = firstFiniteValue(
      results.outletPressure,
      results.pout,
      results.pressureOut,
      traceSourceValue(trace, [/^outlet pressure$/i, /^pout$/i, /pipe.*out/i]),
      tracePressureProfileValue(trace, "endPressure", true)
    );

    const majorLoss = firstFiniteValue(
      totals.majorLoss,
      results.majorLoss,
      sumCalculatedSegmentValue(calculatedSegments, "majorLoss")
    );
    const minorLoss = firstFiniteValue(
      totals.minorLoss,
      results.minorLoss,
      results.fittingLoss,
      sumCalculatedSegmentValue(calculatedSegments, "minorLoss")
    );
    const totalK = firstFiniteValue(
      totals.totalK,
      results.totalK,
      sumCalculatedSegmentValue(calculatedSegments, "minorLossK"),
      pipePropsTotalK(pipe)
    );
    const velocity = representativeVelocity({ pipe, flow, trace, calculatedSegments });

    const rows = [
      { key: "P\u2081\u2192P\u2082", value: formatPressurePair(pin, pout), title: "Inlet pressure to outlet pressure" },
      { key: "v", value: formatVelocity(velocity), title: "Flow velocity" },
      { key: "\u03a3K", value: formatTotalK(totalK), title: "Total loss coefficient" },
      { key: "h_f", value: formatHead(majorLoss), title: "Major/friction head loss" },
      { key: "h_m", value: formatHead(minorLoss), title: "Minor/local head loss" }
    ];

    const title = [
      `${pipe.name || pipeId} Pipe/Fitting/Valve`,
      `P1 to P2 ${formatPressurePair(pin, pout)}`,
      `v ${formatVelocity(velocity)}`,
      `Total K ${formatTotalK(totalK)}`,
      `Major loss h_f ${formatHead(majorLoss)}`,
      `Minor loss h_m ${formatHead(minorLoss)}`
    ].join(" | ");

    return {
      pipeId,
      rows,
      title,
      signature: JSON.stringify(rows.map((row) => [row.key, row.value]))
    };
  }

  function createSvgNode(tag, attributes = {}, text = "") {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text) node.textContent = text;
    return node;
  }

  function replaceChildren(node, children) {
    while (node.firstChild) node.removeChild(node.firstChild);
    children.forEach((child) => node.appendChild(child));
  }

  function renderLabelGroup(group) {
    const pipeId = group?.dataset?.pipeId || "";
    const data = buildPipeHydraulicLabelData(pipeId);
    if (!data) return false;
    if (
      group.dataset.pipeHydraulicLabelVersion === VERSION
      && group.dataset.pipeHydraulicLabelSignature === data.signature
    ) {
      return false;
    }

    group.classList.add("pipe-hydraulic-label");
    group.dataset.pipeHydraulicLabel = "true";
    group.dataset.pipeHydraulicLabelVersion = VERSION;
    group.dataset.pipeHydraulicLabelSignature = data.signature;
    group.setAttribute("role", "img");
    group.setAttribute("aria-label", data.title);

    const children = [
      createSvgNode("title", {}, data.title),
      createSvgNode("rect", {
        class: "pipe-hydraulic-label-bg",
        x: (-BLOCK_WIDTH / 2).toFixed(1),
        y: BLOCK_TOP,
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        rx: 4,
        ry: 4
      })
    ];

    data.rows.forEach((row, index) => {
      const y = ROW_TOP + index * ROW_GAP;
      children.push(createSvgNode("text", {
        class: "pipe-hydraulic-label-key",
        x: KEY_X,
        y,
        "data-label": row.title
      }, row.key));
      children.push(createSvgNode("text", {
        class: "pipe-hydraulic-label-value",
        x: VALUE_X,
        y,
        "data-label": row.title
      }, row.value));
    });

    replaceChildren(group, children);
    return true;
  }

  function refreshPipeCanvasHydraulicLabels(rootNode = document) {
    if (typeof document === "undefined" || !rootNode?.querySelectorAll) return 0;
    let changed = 0;
    rootNode.querySelectorAll(LABEL_SELECTOR).forEach((group) => {
      if (renderLabelGroup(group)) changed += 1;
    });
    return changed;
  }

  function queueRefresh() {
    if (refreshQueued || typeof root.setTimeout !== "function") return;
    refreshQueued = true;
    root.setTimeout(() => {
      refreshQueued = false;
      refreshPipeCanvasHydraulicLabels(document);
    }, 0);
  }

  function injectStyle() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #svg-lines .pipe-delta-label:not(.pipe-hydraulic-label) {
        opacity: 0;
      }
      #svg-lines .pipe-hydraulic-label .pipe-hydraulic-label-bg {
        fill: #ffffff;
        stroke: #8fbde8;
        stroke-width: 1;
        filter: drop-shadow(0 1px 1px rgba(15, 23, 42, 0.14));
      }
      #svg-lines .pipe-hydraulic-label .pipe-hydraulic-label-key,
      #svg-lines .pipe-hydraulic-label .pipe-hydraulic-label-value {
        dominant-baseline: middle;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0;
        pointer-events: none;
        text-anchor: start;
      }
      #svg-lines .pipe-hydraulic-label .pipe-hydraulic-label-key {
        fill: #486176;
        font-size: 7.4px;
        font-weight: 800;
      }
      #svg-lines .pipe-hydraulic-label .pipe-hydraulic-label-value {
        fill: #123b5a;
        font-size: 7.6px;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }

  function patchDrawConnections() {
    const original = root.drawConnections;
    if (typeof original !== "function" || original.__pipeCanvasHydraulicLabelPatched) return false;
    function patchedDrawConnections(...args) {
      const result = original.apply(this, args);
      queueRefresh();
      return result;
    }
    patchedDrawConnections.__pipeCanvasHydraulicLabelPatched = true;
    root.drawConnections = patchedDrawConnections;
    return true;
  }

  function patchUpdateSimulation() {
    const original = root.updateSimulation;
    if (typeof original !== "function" || original.__pipeCanvasHydraulicLabelPatched) return false;
    function patchedUpdateSimulation(...args) {
      const result = original.apply(this, args);
      const refresh = () => queueRefresh();
      if (result && typeof result.then === "function") return result.finally(refresh);
      refresh();
      return result;
    }
    patchedUpdateSimulation.__pipeCanvasHydraulicLabelPatched = true;
    root.updateSimulation = patchedUpdateSimulation;
    return true;
  }

  function installObserver() {
    if (observer || typeof document === "undefined" || typeof MutationObserver === "undefined") return false;
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => {
        const target = mutation.target;
        return target?.id === "svg-lines"
          || target?.classList?.contains("pipe-delta-label")
          || Array.from(mutation.addedNodes || []).some((node) => (
            node?.classList?.contains?.("pipe-delta-label")
            || node?.querySelector?.(".pipe-delta-label")
          ));
      })) {
        queueRefresh();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return true;
  }

  function install() {
    if (typeof document === "undefined") return false;
    injectStyle();
    const patched = [patchDrawConnections(), patchUpdateSimulation(), installObserver()].some(Boolean);
    queueRefresh();
    return patched;
  }

  function startInstallLoop() {
    installAttempts += 1;
    install();
    if (installAttempts < 120 && typeof root.setTimeout === "function") {
      root.setTimeout(startInstallLoop, installAttempts < 20 ? 250 : 1000);
    }
  }

  const api = {
    version: VERSION,
    install,
    refresh: refreshPipeCanvasHydraulicLabels,
    buildPipeHydraulicLabelData,
    formatFixed
  };

  root.EngineeringPipeCanvasHydraulicLabelRuntime = api;
  root.refreshPipeCanvasHydraulicLabels = refreshPipeCanvasHydraulicLabels;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startInstallLoop, { once: true });
    } else {
      startInstallLoop();
    }
  }
}("undefined" != typeof window ? window : globalThis);
