!function(root) {
  "use strict";

  const VERSION = "2026.07-pipe-canvas-reynolds-darcy3-smooth-drag";
  const STYLE_ID = "engineeringPipeCanvasHydraulicLabelStyle";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const LABEL_SELECTOR = "#svg-lines .pipe-delta-label[data-pipe-id]";
  const DISPLAY_DIGITS = 5;
  const BLOCK_WIDTH = 178;
  const BLOCK_HEIGHT = 100;
  const BLOCK_TOP = -108;
  const ROW_TOP = -93;
  const ROW_GAP = 12.5;
  const KEY_X = -82;
  const VALUE_X = -34;
  const VERTICAL_SIDE_OFFSET_Y = 46;
  const SOLVER_REFRESH_HOOKS = [
    "refreshBackendProtectedSimulationUi",
    "refreshBackendProtectedRealtimeTaskWindows",
    "refreshBackendProtectedSelectedObjectTaskWindow",
    "refreshBackendProtectedPumpChart"
  ];
  const SOLVER_REFRESH_EVENTS = [
    "npsh:calculation-applying-results",
    "npsh:linked-views-refreshed",
    "npsh:calculation-current",
    "npsh:realtime-autosolve-complete"
  ];
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
  let solverRefreshTimer = null;
  let initialRefreshDone = false;
  let canvasPointerActive = false;
  let canvasInteractionUntil = 0;
  let refreshDeferredByInteraction = false;
  let interactionFlushTimer = null;
  let pipeLabelBusyUntil = 0;
  let pipeLabelBusyFlushTimer = null;
  let solverRefreshEventsInstalled = false;
  let canvasInteractionEventsInstalled = false;
  let canvasDrawFrame = null;
  let canvasDrawPending = null;
  let canvasDrawOriginal = null;
  let canvasFullDrawTimer = null;
  let installAttempts = 0;
  const solverRefreshWrappedFunctions = new Set();
  const stableLabelDataByPipe = new Map();
  const CANVAS_INTERACTION_SETTLE_MS = 220;
  const SOLVER_REFRESH_DEBOUNCE_MS = 220;
  const PIPE_LABEL_BUSY_SETTLE_MS = 700;
  const CANVAS_INTERACTION_SELECTOR = [
    ".pfd-object",
    ".pipe-delta-label",
    ".pipe-hydraulic-label",
    "#svg-lines",
    "[data-node-id]",
    "[data-object-id]",
    "[data-pipe-id]"
  ].join(",");

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

  function formatVelocity(value) {
    return `${formatFixed(value)} m/s`;
  }

  function formatTotalK(value) {
    return formatFixed(value, 3);
  }

  function formatHead(value) {
    return `${formatFixed(value)} m`;
  }

  function formatMoodyDecimal(value, digits = 4) {
    const number = finiteNumber(value);
    return number === null ? "-" : number.toFixed(digits).replace(/\.?0+$/, "");
  }

  function formatMoodyScientific(value, mantissaDigits = 3) {
    const number = finiteNumber(value);
    if (number === null || number <= 0) return "-";
    const exponent = Math.floor(Math.log(number) / Math.LN10);
    const mantissa = number / Math.pow(10, exponent);
    return `${mantissa.toFixed(mantissaDigits)}e${exponent >= 0 ? "+" : ""}${exponent}`;
  }

  function formatReynolds(value) {
    const number = finiteNumber(value);
    if (number === null) return "-";
    return number >= 10000 ? formatMoodyScientific(number, 3) : formatMoodyDecimal(number, 0);
  }

  function formatDarcyF(value) {
    const number = finiteNumber(value);
    if (number === null) return "-";
    return number < 0.01 ? number.toFixed(5) : number.toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
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

  function selectBusySafeMetric(traceValue, segmentValue) {
    const traceNumber = firstFiniteValue(traceValue);
    const segmentNumber = firstFiniteValue(segmentValue);
    if (!isPipeLabelBusy() || traceNumber === null || segmentNumber === null) {
      return firstFiniteValue(traceNumber, segmentNumber);
    }
    const tolerance = Math.max(1e-9, Math.abs(segmentNumber) * 1e-6);
    return Math.abs(traceNumber - segmentNumber) > tolerance ? segmentNumber : traceNumber;
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
    const calculatedMajorLoss = sumCalculatedSegmentValue(calculatedSegments, "majorLoss");
    const calculatedMinorLoss = sumCalculatedSegmentValue(calculatedSegments, "minorLoss");
    const calculatedTotalLoss = sumCalculatedSegmentValue(calculatedSegments, "totalLoss");
    const calculatedTotalK = sumCalculatedSegmentValue(calculatedSegments, "minorLossK");

    const majorLoss = firstFiniteValue(
      selectBusySafeMetric(totals.majorLoss, calculatedMajorLoss),
      results.majorLoss,
      calculatedMajorLoss
    );
    const minorLoss = firstFiniteValue(
      selectBusySafeMetric(totals.minorLoss, calculatedMinorLoss),
      results.minorLoss,
      results.fittingLoss,
      calculatedMinorLoss
    );
    const totalLoss = firstFiniteValue(
      selectBusySafeMetric(totals.totalLoss, calculatedTotalLoss),
      results.headLoss,
      results.totalLoss,
      calculatedTotalLoss,
      majorLoss !== null || minorLoss !== null ? (majorLoss || 0) + (minorLoss || 0) : null
    );
    const totalK = firstFiniteValue(
      selectBusySafeMetric(totals.totalK, calculatedTotalK),
      results.totalK,
      calculatedTotalK,
      pipePropsTotalK(pipe)
    );
    const velocity = representativeVelocity({ pipe, flow, trace, calculatedSegments });
    const primaryMoodyMarker = Array.isArray(trace?.moody?.markers) ? trace.moody.markers[0] : null;
    const primarySegment = primaryMoodyMarker || calculatedSegments[0] || trace?.segments?.[0] || {};
    const reynolds = firstFiniteValue(primarySegment.reynolds, primarySegment.reynoldsNumber);
    const darcyF = firstFiniteValue(primarySegment.frictionFactor, primarySegment.darcyF);

    const rows = [
      { key: "v", value: formatVelocity(velocity), title: "Flow velocity" },
      { key: "Total K", value: formatTotalK(totalK), title: "Total loss coefficient" },
      { key: "Total hL", value: formatHead(totalLoss), title: "Total pipe/fitting/valve head loss" },
      { key: "Minor", value: formatHead(minorLoss), title: "Minor/local head loss" },
      { key: "Major", value: formatHead(majorLoss), title: "Major/friction head loss" },
      { key: "Reynolds", value: formatReynolds(reynolds), title: "Primary Reynolds number from Moody Chart / Friction Factor Check" },
      { key: "Darcy f", value: formatDarcyF(darcyF), title: "Primary Darcy friction factor from Moody Chart / Friction Factor Check" }
    ];

    const title = [
      `${pipe.name || pipeId} Pipe/Fitting/Valve`,
      `v ${formatVelocity(velocity)}`,
      `Total K ${formatTotalK(totalK)}`,
      `Total hL ${formatHead(totalLoss)}`,
      `Minor loss ${formatHead(minorLoss)}`,
      `Major loss ${formatHead(majorLoss)}`,
      `Reynolds ${formatReynolds(reynolds)}`,
      `Darcy f ${formatDarcyF(darcyF)}`
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

  function nowMs() {
    const value = root.performance?.now?.();
    return Number.isFinite(value) ? value : Date.now();
  }

  function markPipeLabelBusy() {
    freezePipeLabelGeometry();
    pipeLabelBusyUntil = Math.max(pipeLabelBusyUntil, nowMs() + PIPE_LABEL_BUSY_SETTLE_MS);
    schedulePipeLabelBusyFlush();
  }

  function isPipeLabelBusy() {
    return nowMs() < pipeLabelBusyUntil;
  }

  function freezePipeLabelGeometry(scope = document) {
    if (!scope?.querySelectorAll) return;
    scope.querySelectorAll(LABEL_SELECTOR).forEach((label) => {
      const transform = label.getAttribute("transform") || "";
      if (transform) label.dataset.pipeHydraulicLabelFrozenTransform = transform;
    });
  }

  function restorePipeLabelGeometry(group) {
    const frozenTransform = group?.dataset?.pipeHydraulicLabelFrozenTransform || group?.dataset?.pipeHydraulicLabelRenderedTransform || "";
    if (!isPipeLabelBusy() || !group || !frozenTransform) return false;
    if (group.getAttribute("transform") === frozenTransform) return false;
    group.setAttribute("transform", frozenTransform);
    group.dataset.pipeHydraulicLabelRenderedTransform = frozenTransform;
    group.dataset.pipeHydraulicLabelGeometryRestored = VERSION;
    return true;
  }

  function flushPipeLabelBusyGeometry() {
    pipeLabelBusyFlushTimer = null;
    if (isPipeLabelBusy()) {
      schedulePipeLabelBusyFlush();
      return;
    }
    queueRefresh(0, { force: true });
  }

  function schedulePipeLabelBusyFlush() {
    if (typeof root.setTimeout !== "function") return;
    root.clearTimeout?.(pipeLabelBusyFlushTimer);
    pipeLabelBusyFlushTimer = root.setTimeout(flushPipeLabelBusyGeometry, PIPE_LABEL_BUSY_SETTLE_MS + 80);
  }

  function expectedTextNodes(group, selector, rowCount) {
    const nodes = Array.from(group.querySelectorAll(selector));
    return nodes.length === rowCount ? nodes : [];
  }

  function hasStableLabelStructure(group, rowCount) {
    return !!group.querySelector("title")
      && !!group.querySelector(".pipe-hydraulic-label-bg")
      && expectedTextNodes(group, ".pipe-hydraulic-label-key", rowCount).length === rowCount
      && expectedTextNodes(group, ".pipe-hydraulic-label-value", rowCount).length === rowCount;
  }

  function updateExistingLabelText(group, data) {
    const title = group.querySelector("title");
    if (title && title.textContent !== data.title) title.textContent = data.title;
    const keyNodes = expectedTextNodes(group, ".pipe-hydraulic-label-key", data.rows.length);
    const valueNodes = expectedTextNodes(group, ".pipe-hydraulic-label-value", data.rows.length);
    data.rows.forEach((row, index) => {
      const keyNode = keyNodes[index];
      const valueNode = valueNodes[index];
      if (keyNode) {
        if (keyNode.textContent !== row.key) keyNode.textContent = row.key;
        if (keyNode.getAttribute("data-label") !== row.title) keyNode.setAttribute("data-label", row.title);
      }
      if (valueNode) {
        if (valueNode.textContent !== row.value) valueNode.textContent = row.value;
        if (valueNode.getAttribute("data-label") !== row.title) valueNode.setAttribute("data-label", row.title);
      }
    });
  }

  function activeCanvasFastPreviewVersion() {
    const version = root.EngineeringCanvasFastPreviewRuntime?.version
      || root.__engineeringCanvasFastPreviewRuntimeVersion
      || document?.documentElement?.dataset?.canvasFastPreviewRuntime
      || "";
    const reason = String(document?.documentElement?.dataset?.canvasFastPreviewReason || "");
    if (!version || /complete|current/i.test(reason)) return "";
    return version;
  }

  function inheritCanvasFastPreviewStamp(group) {
    const version = activeCanvasFastPreviewVersion();
    if (!version || !group?.setAttribute) return false;
    group.setAttribute("data-canvas-fast-preview", version);
    if (group.dataset) group.dataset.canvasFastPreview = version;
    return true;
  }

  function currentLabelSourceTransform(group) {
    const transform = group?.getAttribute?.("transform") || "";
    const rendered = group?.dataset?.pipeHydraulicLabelRenderedTransform || "";
    if (transform && transform !== rendered) return transform;
    return group?.dataset?.pipeHydraulicLabelSourceTransform || transform || "";
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
    const originalTransform = currentLabelSourceTransform(group);
    const parsed = parseLabelTransform(group.dataset.pipeHydraulicLabelSourceTransform || originalTransform);
    if (parsed.x === null || parsed.y === null) return null;
    const previousSource = group.dataset.pipeHydraulicLabelSourceTransform || "";
    if (originalTransform && originalTransform !== previousSource) {
      group.dataset.pipeHydraulicLabelSourceTransform = originalTransform;
      group.dataset.pipeHydraulicLabelAnchorX = String(parsed.x);
      group.dataset.pipeHydraulicLabelAnchorY = String(parsed.y);
      group.dataset.pipeHydraulicLabelAngle = String(parsed.angle || 0);
    }
    if (!group.dataset.pipeHydraulicLabelAnchorX) group.dataset.pipeHydraulicLabelAnchorX = String(parsed.x);
    if (!group.dataset.pipeHydraulicLabelAnchorY) group.dataset.pipeHydraulicLabelAnchorY = String(parsed.y);
    if (!group.dataset.pipeHydraulicLabelAngle) group.dataset.pipeHydraulicLabelAngle = String(parsed.angle || 0);
    return {
      x: firstFiniteValue(group.dataset.pipeHydraulicLabelAnchorX, parsed.x),
      y: firstFiniteValue(group.dataset.pipeHydraulicLabelAnchorY, parsed.y),
      angle: firstFiniteValue(group.dataset.pipeHydraulicLabelAngle, parsed.angle, 0) || 0
    };
  }

  function labelGeometrySignature(group) {
    const anchor = labelAnchor(group);
    if (!anchor) return "";
    return [
      Number(anchor.x).toFixed(1),
      Number(anchor.y).toFixed(1),
      Number(anchor.angle || 0).toFixed(1)
    ].join("|");
  }

  function keepLabelUpright(group) {
    const anchor = labelAnchor(group);
    if (!anchor) return false;
    const uprightTransform = formatTranslate(anchor.x, anchor.y);
    if (group.getAttribute("transform") === uprightTransform) return false;
    group.setAttribute("transform", uprightTransform);
    group.dataset.pipeHydraulicLabelRenderedTransform = uprightTransform;
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
    const mid = VERTICAL_SIDE_OFFSET_Y;
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

  function canonicalLabelPlacement(anchor) {
    const candidate = smartLabelCandidates(anchor?.angle || 0)[0];
    if (!candidate) return null;
    return {
      ...candidate,
      score: 0,
      transform: formatTranslate(anchor.x + candidate.dx, anchor.y + candidate.dy)
    };
  }

  function placeLabelSmartly(group) {
    if (restorePipeLabelGeometry(group)) return false;
    if (isPipeLabelBusy() && group?.dataset?.pipeHydraulicLabelRenderedTransform) return false;
    const anchor = labelAnchor(group);
    if (!anchor || typeof document === "undefined") return keepLabelUpright(group);
    const best = canonicalLabelPlacement(anchor);
    if (!best) return keepLabelUpright(group);
    const transform = best.transform;
    const changed = group.getAttribute("transform") !== transform;
    group.setAttribute("transform", transform);
    group.dataset.pipeHydraulicLabelRenderedTransform = transform;
    group.dataset.pipeHydraulicLabelPlacement = best.name;
    group.dataset.pipeHydraulicLabelPlacementScore = String(Math.round(best.score));
    return changed;
  }

  function renderLabelGroup(group) {
    const pipeId = group?.dataset?.pipeId || "";
    const pipe = runtimeModel()?.[pipeId];
    const computedData = buildPipeHydraulicLabelData(pipeId);
    const cached = stableLabelDataByPipe.get(pipeId);
    if (cached && cached.pipe !== pipe) stableLabelDataByPipe.delete(pipeId);
    const currentCache = cached?.pipe === pipe ? cached : null;
    const data = isPipeLabelBusy() && currentCache ? currentCache.data : computedData;
    if (!data) {
      if (group?.dataset?.pipeHydraulicLabelRestored === VERSION && group.parentNode) group.remove();
      return false;
    }
    if (!isPipeLabelBusy() && computedData) {
      stableLabelDataByPipe.set(pipeId, { pipe, data: computedData });
    }
    const geometrySignature = labelGeometrySignature(group);
    const hasCurrentData = group.dataset.pipeHydraulicLabelVersion === VERSION
      && group.dataset.pipeHydraulicLabelSignature === data.signature;
    const hasCurrentGeometry = group.dataset.pipeHydraulicLabelGeometrySignature === geometrySignature;
    const hasStructure = hasStableLabelStructure(group, data.rows.length);
    const holdGeometry = isPipeLabelBusy() && !!group.dataset.pipeHydraulicLabelRenderedTransform;
    if (hasCurrentData && hasCurrentGeometry && hasStructure) return false;

    group.classList.add("pipe-hydraulic-label");
    group.dataset.pipeHydraulicLabel = "true";
    group.dataset.pipeHydraulicLabelVersion = VERSION;
    group.dataset.pipeHydraulicLabelSignature = data.signature;
    inheritCanvasFastPreviewStamp(group);
    if (!holdGeometry) group.dataset.pipeHydraulicLabelGeometrySignature = geometrySignature;
    group.setAttribute("role", "img");
    group.setAttribute("aria-label", data.title);

    if (hasStructure) {
      updateExistingLabelText(group, data);
    } else {
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
    }
    if (holdGeometry) {
      restorePipeLabelGeometry(group);
      group.dataset.pipeHydraulicLabelGeometryHeld = VERSION;
    }
    const placed = !holdGeometry && !hasCurrentGeometry ? placeLabelSmartly(group) : false;
    return !hasCurrentData || !hasStructure || placed;
  }

  function refreshPipeCanvasHydraulicLabels(rootNode = document) {
    if (typeof document === "undefined" || !rootNode?.querySelectorAll) return 0;
    let changed = 0;
    rootNode.querySelectorAll(LABEL_SELECTOR).forEach((group) => {
      if (renderLabelGroup(group)) changed += 1;
    });
    return changed;
  }

  function runQueuedRefresh() {
    refreshPipeCanvasHydraulicLabels(document);
  }

  function hasSiblingPipeLabel(parent, label) {
    const pipeId = label?.dataset?.pipeId || "";
    if (!pipeId || !parent?.querySelectorAll) return false;
    return Array.from(parent.querySelectorAll(LABEL_SELECTOR)).some((existing) => (
      existing !== label && existing.dataset?.pipeId === pipeId
    ));
  }

  function isCanvasInteractionActive() {
    return canvasPointerActive || Date.now() < canvasInteractionUntil;
  }

  function runImmediateRefresh(options = {}) {
    if (typeof document === "undefined") return 0;
    if (!options.force && isCanvasInteractionActive()) {
      deferRefreshUntilInteractionSettles();
      return 0;
    }
    refreshQueued = false;
    return refreshPipeCanvasHydraulicLabels(document);
  }

  function flushInteractionRefresh() {
    interactionFlushTimer = null;
    if (!refreshDeferredByInteraction || isCanvasInteractionActive()) {
      if (refreshDeferredByInteraction && typeof root.setTimeout === "function") {
        interactionFlushTimer = root.setTimeout(flushInteractionRefresh, CANVAS_INTERACTION_SETTLE_MS);
      }
      return;
    }
    refreshDeferredByInteraction = false;
    queueRefresh(0, { force: true });
  }

  function deferRefreshUntilInteractionSettles() {
    refreshDeferredByInteraction = true;
    if (interactionFlushTimer || typeof root.setTimeout !== "function") return;
    interactionFlushTimer = root.setTimeout(flushInteractionRefresh, CANVAS_INTERACTION_SETTLE_MS);
  }

  function queueRefresh(delayMs = 0) {
    if (typeof root.setTimeout !== "function") return;
    const delay = Math.max(0, Number.parseInt(delayMs, 10) || 0);
    const options = arguments[1] || {};
    if (delay > 0) {
      root.setTimeout(() => queueRefresh(0, options), delay);
      return;
    }
    if (!options.force && isCanvasInteractionActive()) {
      deferRefreshUntilInteractionSettles();
      return;
    }
    if (refreshQueued) return;
    refreshQueued = true;
    root.setTimeout(() => {
      refreshQueued = false;
      runQueuedRefresh();
    }, 0);
  }

  function queueSolverRefreshSweep() {
    if (solverRefreshTimer && typeof root.clearTimeout === "function") {
      root.clearTimeout(solverRefreshTimer);
    }
    if (typeof root.setTimeout !== "function") return;
    solverRefreshTimer = root.setTimeout(() => {
      solverRefreshTimer = null;
      queueRefresh(0, { force: true });
    }, SOLVER_REFRESH_DEBOUNCE_MS);
  }

  function refreshAfterSolverMutation() {
    markPipeLabelBusy();
    runImmediateRefresh({ force: true });
    queueSolverRefreshSweep();
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

  function captureHydraulicLabelNodes() {
    if (typeof document === "undefined") return new Map();
    return new Map(Array.from(document.querySelectorAll(LABEL_SELECTOR))
      .filter((label) => label.classList?.contains("pipe-hydraulic-label") && label.dataset?.pipeId)
      .map((label) => [label.dataset.pipeId, label]));
  }

  function retainHydraulicLabelNodes(previousLabels) {
    if (!previousLabels?.size || typeof document === "undefined") return 0;
    let retained = 0;
    Array.from(document.querySelectorAll(LABEL_SELECTOR)).forEach((replacement) => {
      const pipeId = replacement.dataset?.pipeId || "";
      const previous = previousLabels.get(pipeId);
      if (!previous || previous === replacement) return;
      const sourceTransform = replacement.getAttribute("transform") || "";
      const anchor = parseLabelTransform(sourceTransform);
      previous.dataset.pipeHydraulicLabelSourceTransform = sourceTransform;
      if (anchor.x !== null) previous.dataset.pipeHydraulicLabelAnchorX = String(anchor.x);
      if (anchor.y !== null) previous.dataset.pipeHydraulicLabelAnchorY = String(anchor.y);
      previous.dataset.pipeHydraulicLabelAngle = String(anchor.angle || 0);
      previous.dataset.pipeHydraulicLabelGeometrySignature = "";
      replacement.replaceWith(previous);
      retained += 1;
    });
    return retained;
  }

  function refreshConnectionGeometryDuringDrag() {
    if (typeof document === "undefined") return false;
    const routePoints = root.getPipeRoutePoints;
    const pathData = root.pointsToPath;
    const svg = document.getElementById("svg-lines");
    if (!svg || typeof routePoints !== "function" || typeof pathData !== "function") return false;
    svg.querySelectorAll(".pipe-line[data-pipe-id]").forEach((path) => {
      const points = routePoints(path.dataset.pipeId);
      if (Array.isArray(points) && points.length > 1) path.setAttribute("d", pathData(points));
    });
    return true;
  }

  function runFullCanvasDraw(context = root, args = []) {
    if (typeof canvasDrawOriginal !== "function") return undefined;
    const previousLabels = captureHydraulicLabelNodes();
    markPipeLabelBusy();
    const result = canvasDrawOriginal.apply(context, args);
    retainHydraulicLabelNodes(previousLabels);
    runImmediateRefresh({ force: true });
    queueRefresh(0, { force: true });
    return result;
  }

  function scheduleFullCanvasDrawAfterInteraction() {
    if (canvasFullDrawTimer && typeof root.clearTimeout === "function") root.clearTimeout(canvasFullDrawTimer);
    if (typeof root.setTimeout !== "function") return;
    canvasFullDrawTimer = root.setTimeout(() => {
      canvasFullDrawTimer = null;
      if (isCanvasInteractionActive()) {
        scheduleFullCanvasDrawAfterInteraction();
        return;
      }
      runFullCanvasDraw();
    }, CANVAS_INTERACTION_SETTLE_MS);
  }

  function hasPipeCanvasDrawPatch(functionRef) {
    const candidates = [functionRef];
    const visited = new Set();
    while (candidates.length && visited.size < 48) {
      const candidate = candidates.shift();
      if (typeof candidate !== "function" || visited.has(candidate)) continue;
      visited.add(candidate);
      if (candidate.__pipeCanvasHydraulicLabelPatched) return true;
      Object.getOwnPropertyNames(candidate).forEach((propertyName) => {
        if (!/original/i.test(propertyName)) return;
        let nested = null;
        try {
          nested = candidate[propertyName];
        } catch (error) {
          nested = null;
        }
        if (typeof nested === "function" && !visited.has(nested)) candidates.push(nested);
      });
    }
    return false;
  }

  function queueCanvasGeometryDraw(context, args) {
    canvasDrawPending = { context, args };
    if (canvasDrawFrame !== null) return undefined;
    canvasDrawFrame = root.requestAnimationFrame(() => {
      canvasDrawFrame = null;
      const pending = canvasDrawPending;
      canvasDrawPending = null;
      if (!pending) return;
      markPipeLabelBusy();
      if (!refreshConnectionGeometryDuringDrag() && typeof canvasDrawOriginal === "function") {
        canvasDrawOriginal.apply(pending.context, pending.args);
      }
      deferRefreshUntilInteractionSettles();
    });
    return undefined;
  }

  function patchDrawConnections() {
    const original = root.drawConnections;
    if (typeof original !== "function" || original.__pipeCanvasHydraulicDragGate) return false;
    if (hasPipeCanvasDrawPatch(original)) {
      function pipeCanvasHydraulicDragGate(...args) {
        if (isCanvasInteractionActive() && typeof root.requestAnimationFrame === "function") {
          return queueCanvasGeometryDraw(this, args);
        }
        return original.apply(this, args);
      }
      pipeCanvasHydraulicDragGate.__pipeCanvasHydraulicDragGate = VERSION;
      pipeCanvasHydraulicDragGate.__pipeCanvasHydraulicDragGateOriginal = original;
      root.drawConnections = pipeCanvasHydraulicDragGate;
      return true;
    }
    canvasDrawOriginal = original;
    function patchedDrawConnections(...args) {
      if (isCanvasInteractionActive() && typeof root.requestAnimationFrame === "function") {
        return queueCanvasGeometryDraw(this, args);
      }
      return runFullCanvasDraw(this, args);
    }
    patchedDrawConnections.__pipeCanvasHydraulicLabelPatched = true;
    root.drawConnections = patchedDrawConnections;
    return true;
  }

  function patchUpdateSimulation() {
    const original = root.updateSimulation;
    if (typeof original !== "function" || original.__pipeCanvasHydraulicLabelPatched) return false;
    function patchedUpdateSimulation(...args) {
      markPipeLabelBusy();
      const result = original.apply(this, args);
      const refresh = () => refreshAfterSolverMutation();
      if (result && typeof result.then === "function") return result.finally(refresh);
      refresh();
      return result;
    }
    patchedUpdateSimulation.__pipeCanvasHydraulicLabelPatched = true;
    root.updateSimulation = patchedUpdateSimulation;
    return true;
  }

  function patchSolverRefreshFunction(functionName) {
    if (solverRefreshWrappedFunctions.has(functionName)) return false;
    const original = root[functionName];
    if (typeof original !== "function" || original.__pipeCanvasSolverRefreshPatched) return false;
    function patchedSolverRefreshFunction(...args) {
      markPipeLabelBusy();
      const result = original.apply(this, args);
      const refresh = () => refreshAfterSolverMutation();
      if (result && typeof result.then === "function") return result.finally(refresh);
      refresh();
      return result;
    }
    patchedSolverRefreshFunction.__pipeCanvasSolverRefreshPatched = true;
    patchedSolverRefreshFunction.__pipeCanvasSolverRefreshOriginal = original;
    root[functionName] = patchedSolverRefreshFunction;
    solverRefreshWrappedFunctions.add(functionName);
    return true;
  }

  function patchSolverRefreshHooks() {
    return SOLVER_REFRESH_HOOKS.map((functionName) => patchSolverRefreshFunction(functionName)).some(Boolean);
  }

  function installSolverRefreshEvents() {
    if (solverRefreshEventsInstalled || typeof document === "undefined") return false;
    solverRefreshEventsInstalled = true;
    SOLVER_REFRESH_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, () => {
        refreshAfterSolverMutation();
      });
    });
    return true;
  }

  function isCanvasInteractionTarget(target) {
    return !!target?.closest?.(CANVAS_INTERACTION_SELECTOR);
  }

  function startCanvasInteraction(event) {
    if (!isCanvasInteractionTarget(event.target)) return;
    canvasPointerActive = true;
    markPipeLabelBusy();
    canvasInteractionUntil = Date.now() + CANVAS_INTERACTION_SETTLE_MS;
  }

  function continueCanvasInteraction() {
    if (!canvasPointerActive) return;
    pipeLabelBusyUntil = Math.max(pipeLabelBusyUntil, nowMs() + PIPE_LABEL_BUSY_SETTLE_MS);
    canvasInteractionUntil = Date.now() + CANVAS_INTERACTION_SETTLE_MS;
  }

  function endCanvasInteraction() {
    if (!canvasPointerActive) return;
    markPipeLabelBusy();
    canvasPointerActive = false;
    canvasInteractionUntil = Date.now() + CANVAS_INTERACTION_SETTLE_MS;
    deferRefreshUntilInteractionSettles();
    scheduleFullCanvasDrawAfterInteraction();
  }

  function installCanvasInteractionEvents() {
    if (canvasInteractionEventsInstalled || typeof document === "undefined") return false;
    canvasInteractionEventsInstalled = true;
    document.addEventListener("pointerdown", startCanvasInteraction, true);
    document.addEventListener("pointermove", continueCanvasInteraction, true);
    document.addEventListener("pointerup", endCanvasInteraction, true);
    document.addEventListener("pointercancel", endCanvasInteraction, true);
    document.addEventListener("mousedown", startCanvasInteraction, true);
    document.addEventListener("mousemove", continueCanvasInteraction, true);
    document.addEventListener("mouseup", endCanvasInteraction, true);
    document.addEventListener("touchstart", startCanvasInteraction, true);
    document.addEventListener("touchmove", continueCanvasInteraction, true);
    document.addEventListener("touchend", endCanvasInteraction, true);
    document.addEventListener("touchcancel", endCanvasInteraction, true);
    ["input", "change"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (event.target?.matches?.("input, select, textarea, [contenteditable='true']")) markPipeLabelBusy();
      }, true);
    });
    return true;
  }

  function installObserver() {
    if (observer || typeof document === "undefined" || typeof MutationObserver === "undefined") return false;
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.target?.matches?.(LABEL_SELECTOR)) {
          restorePipeLabelGeometry(mutation.target);
        }
        Array.from(mutation.removedNodes || []).forEach((node) => {
          const labels = [];
          if (node?.matches?.(LABEL_SELECTOR)) labels.push(node);
          node?.querySelectorAll?.(LABEL_SELECTOR).forEach((label) => labels.push(label));
          labels.forEach((label) => {
            const parent = mutation.target;
            if (!isPipeLabelBusy() || label.isConnected || !parent?.isConnected || typeof parent.insertBefore !== "function") return;
            if (hasSiblingPipeLabel(parent, label)) return;
            const nextSibling = mutation.nextSibling?.parentNode === parent ? mutation.nextSibling : null;
            parent.insertBefore(label, nextSibling);
            label.dataset.pipeHydraulicLabelRestored = VERSION;
          });
        });
      });
      if (mutations.some((mutation) => {
        const target = mutation.target;
        return target?.id === "svg-lines"
          || target?.classList?.contains("pipe-delta-label")
          || Array.from(mutation.addedNodes || []).some((node) => (
            node?.classList?.contains?.("pipe-delta-label")
            || node?.querySelector?.(".pipe-delta-label")
          ));
      })) {
        if (isCanvasInteractionActive()) deferRefreshUntilInteractionSettles();
        else if (isPipeLabelBusy()) runImmediateRefresh({ force: true });
        else queueRefresh(0);
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["transform", "class"],
      childList: true,
      subtree: true
    });
    return true;
  }

  function install() {
    if (typeof document === "undefined") return false;
    injectStyle();
    const patched = [
      patchDrawConnections(),
      patchUpdateSimulation(),
      patchSolverRefreshHooks(),
      installSolverRefreshEvents(),
      installCanvasInteractionEvents(),
      installObserver()
    ].some(Boolean);
    if (!initialRefreshDone || patched) {
      initialRefreshDone = true;
      queueRefresh(0, { force: true });
    }
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
    runImmediateRefresh,
    buildPipeHydraulicLabelData,
    canonicalLabelPlacement,
    uprightLabelTransform,
    parseLabelTransform,
    smartLabelCandidates,
    formatFixed,
    formatReynolds,
    formatDarcyF,
    captureHydraulicLabelNodes,
    retainHydraulicLabelNodes
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
