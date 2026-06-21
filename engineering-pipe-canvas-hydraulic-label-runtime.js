!function(root) {
  "use strict";

  const VERSION = "2026.06-pipe-canvas-hydraulic-label7";
  const STYLE_ID = "engineeringPipeCanvasHydraulicLabelStyle";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const LABEL_SELECTOR = "#svg-lines .pipe-delta-label[data-pipe-id]";
  const DISPLAY_DIGITS = 3;
  const BLOCK_WIDTH = 178;
  const BLOCK_HEIGHT = 76;
  const BLOCK_TOP = -84;
  const ROW_TOP = -69;
  const ROW_GAP = 12.5;
  const KEY_X = -82;
  const VALUE_X = -34;
  const LABEL_OBSTACLE_SELECTOR = [
    ".pfd-object",
    ".canvas-status-legend",
    ".canvas-warning-panel:not([hidden])",
    ".source-canvas-parameter",
    ".sink-canvas-parameter",
    ".pipe-delta-label[data-pipe-id]",
    "#svg-lines path",
    "#svg-lines line",
    "#svg-lines polyline"
  ].join(",");

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

  function uprightLabelTransform(transformText = "") {
    const transform = String(transformText || "");
    const translate = transform.match(/translate\(\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*[, ]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)/i);
    if (!translate) return transform;
    return `translate(${translate[1]} ${translate[2]})`;
  }

  function parseLabelTransform(transformText = "") {
    const transform = String(transformText || "");
    const translate = transform.match(/translate\(\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*[, ]\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)/i);
    const rotate = transform.match(/rotate\(\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/i);
    return {
      x: translate ? Number.parseFloat(translate[1]) : null,
      y: translate ? Number.parseFloat(translate[2]) : null,
      angle: rotate ? Number.parseFloat(rotate[1]) : 0
    };
  }

  function formatTranslate(x, y) {
    return `translate(${Number(x).toFixed(1)} ${Number(y).toFixed(1)})`;
  }

  function labelAnchor(group) {
    if (!group) return null;
    const originalTransform = group.getAttribute("transform") || "";
    const parsed = parseLabelTransform(group.dataset.pipeHydraulicLabelSourceTransform || originalTransform);
    if (parsed.x === null || parsed.y === null) return null;
    if (!group.dataset.pipeHydraulicLabelAnchorX) group.dataset.pipeHydraulicLabelAnchorX = String(parsed.x);
    if (!group.dataset.pipeHydraulicLabelAnchorY) group.dataset.pipeHydraulicLabelAnchorY = String(parsed.y);
    if (!group.dataset.pipeHydraulicLabelAngle) group.dataset.pipeHydraulicLabelAngle = String(parsed.angle || 0);
    if (/rotate\(/i.test(originalTransform) && !group.dataset.pipeHydraulicLabelSourceTransform) {
      group.dataset.pipeHydraulicLabelSourceTransform = originalTransform;
    }
    return {
      x: firstFiniteValue(group.dataset.pipeHydraulicLabelAnchorX, parsed.x),
      y: firstFiniteValue(group.dataset.pipeHydraulicLabelAnchorY, parsed.y),
      angle: firstFiniteValue(group.dataset.pipeHydraulicLabelAngle, parsed.angle, 0) || 0
    };
  }

  function keepLabelUpright(group) {
    const anchor = labelAnchor(group);
    if (!anchor) return false;
    const uprightTransform = formatTranslate(anchor.x, anchor.y);
    if (group.getAttribute("transform") === uprightTransform) return false;
    group.setAttribute("transform", uprightTransform);
    return true;
  }

  function normalizeAngle(angle = 0) {
    let normalized = ((angle % 360) + 360) % 360;
    if (normalized > 180) normalized -= 360;
    return normalized;
  }

  function smartLabelCandidates(angle = 0) {
    const vertical = Math.abs(normalizeAngle(angle)) > 45;
    const side = Math.round(BLOCK_WIDTH / 2 + 42);
    const below = Math.round(Math.abs(BLOCK_TOP) + 18);
    const above = -14;
    const mid = Math.round(Math.abs(BLOCK_TOP) - BLOCK_HEIGHT / 2);
    const candidates = vertical
      ? [
        ["right", side, mid],
        ["left", -side, mid],
        ["upper-right", side, above],
        ["upper-left", -side, above],
        ["lower-right", side, below],
        ["lower-left", -side, below],
        ["above", 0, above],
        ["below", 0, below]
      ]
      : [
        ["above", 0, above],
        ["below", 0, below],
        ["upper-right", side, above],
        ["upper-left", -side, above],
        ["lower-right", side, below],
        ["lower-left", -side, below],
        ["right", side, mid],
        ["left", -side, mid]
      ];
    return candidates.map(([name, dx, dy], priority) => ({ name, dx, dy, priority }));
  }

  function visibleRect(node) {
    if (!node || node.nodeType !== 1 || node.hidden) return null;
    const style = typeof root.getComputedStyle === "function" ? root.getComputedStyle(node) : null;
    if (style && (style.display === "none" || style.visibility === "hidden" || Number.parseFloat(style.opacity || "1") <= 0.02)) return null;
    const rect = node.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return rect;
  }

  function inflateRect(rect, padding = 0) {
    return {
      left: rect.left - padding,
      top: rect.top - padding,
      right: rect.right + padding,
      bottom: rect.bottom + padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2
    };
  }

  function overlapArea(a, b) {
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return width * height;
  }

  function overflowArea(rect, bounds) {
    if (!bounds) return 0;
    const x = Math.max(0, bounds.left - rect.left) + Math.max(0, rect.right - bounds.right);
    const y = Math.max(0, bounds.top - rect.top) + Math.max(0, rect.bottom - bounds.bottom);
    return x * Math.max(1, rect.height) + y * Math.max(1, rect.width);
  }

  function rectContainsPoint(rect, x, y) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function collectLabelObstacleRects(group) {
    if (typeof document === "undefined" || !document.querySelectorAll) return [];
    return Array.from(document.querySelectorAll(LABEL_OBSTACLE_SELECTOR))
      .filter((node) => node !== group && !group.contains(node) && !node.contains?.(group))
      .map((node) => {
        const rect = visibleRect(node);
        if (!rect) return null;
        const isPipeLine = node.closest?.("#svg-lines") && !node.classList?.contains("pipe-delta-label");
        const isLabel = node.classList?.contains("pipe-delta-label") || node.classList?.contains("pipe-hydraulic-label");
        return {
          rect: inflateRect(rect, isPipeLine ? 8 : isLabel ? 5 : 4),
          weight: isPipeLine ? 2.2 : isLabel ? 8 : 6
        };
      })
      .filter(Boolean);
  }

  function placementBounds() {
    const canvas = document.querySelector?.(".pfd-canvas");
    const rect = visibleRect(canvas) || visibleRect(document.documentElement);
    return rect ? inflateRect(rect, -6) : null;
  }

  function scoreLabelPlacement(group, anchor, candidate, obstacles, bounds) {
    group.setAttribute("transform", formatTranslate(anchor.x + candidate.dx, anchor.y + candidate.dy));
    const rect = visibleRect(group);
    if (!rect) return Number.POSITIVE_INFINITY;
    let score = candidate.priority * 8 + Math.hypot(candidate.dx, candidate.dy) * 0.18;
    score += overflowArea(rect, bounds) * 12;
    obstacles.forEach((obstacle) => {
      score += overlapArea(rect, obstacle.rect) * obstacle.weight;
    });
    const svg = document.getElementById?.("svg-lines");
    const svgRect = visibleRect(svg);
    if (svgRect) {
      const anchorClientX = svgRect.left + anchor.x;
      const anchorClientY = svgRect.top + anchor.y;
      if (rectContainsPoint(inflateRect(rect, 8), anchorClientX, anchorClientY)) score += 7000;
    }
    return score;
  }

  function placeLabelSmartly(group) {
    const anchor = labelAnchor(group);
    if (!anchor || typeof document === "undefined") return keepLabelUpright(group);
    const obstacles = collectLabelObstacleRects(group);
    const bounds = placementBounds();
    let best = null;
    smartLabelCandidates(anchor.angle).forEach((candidate) => {
      const score = scoreLabelPlacement(group, anchor, candidate, obstacles, bounds);
      if (!best || score < best.score) best = { ...candidate, score };
    });
    if (!best) return keepLabelUpright(group);
    const transform = formatTranslate(anchor.x + best.dx, anchor.y + best.dy);
    const changed = group.getAttribute("transform") !== transform;
    group.setAttribute("transform", transform);
    group.dataset.pipeHydraulicLabelPlacement = best.name;
    group.dataset.pipeHydraulicLabelPlacementScore = String(Math.round(best.score));
    return changed;
  }

  function renderLabelGroup(group) {
    const pipeId = group?.dataset?.pipeId || "";
    const data = buildPipeHydraulicLabelData(pipeId);
    if (!data) return false;
    if (
      group.dataset.pipeHydraulicLabelVersion === VERSION
      && group.dataset.pipeHydraulicLabelSignature === data.signature
    ) {
      return placeLabelSmartly(group);
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
    placeLabelSmartly(group);
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
        font-size: 10px;
        font-family: var(--font-main, 'Segoe UI', system-ui, -apple-system, sans-serif);
        font-weight: 800;
      }
      #svg-lines .pipe-hydraulic-label .pipe-hydraulic-label-value {
        fill: #123b5a;
        font-size: 10px;
        font-family: var(--font-main, 'Segoe UI', system-ui, -apple-system, sans-serif);
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
    uprightLabelTransform,
    parseLabelTransform,
    smartLabelCandidates,
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
