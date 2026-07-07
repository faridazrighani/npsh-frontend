/*
 * Fluid Basis Model Snapshot export capture guard.
 *
 * PDF appendices must use the current workspace image. This runtime wraps the
 * native canvas snapshot with the visible Fluid Basis dock above it so Pipe /
 * Fitting / Valve parameter labels remain part of the same Model Snapshot.
 */
(function modelSnapshotExportFactory(root, factory) {
  const api = factory(root || globalThis);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EngineeringModelSnapshotExportRuntime = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createModelSnapshotExportRuntime(root) {
  "use strict";

  const VERSION = "2026.07-fluid-basis-workspace-snapshot10";
  const SNAPSHOT_WIDTH = 1280;
  const SNAPSHOT_HEIGHT = 690;
  const COLORS = Object.freeze({
    navy: "#123b5a",
    pipe: "#1c4568",
    grid: "#d8e3ec",
    canvas: "#f4f7f9",
    panel: "#f2fff7",
    panelBorder: "#21a366",
    cardBorder: "#8fc2ff",
    text: "#102a43",
    muted: "#526b7f",
    green: "#16a34a",
    yellow: "#fde047",
    red: "#e11d48",
    white: "#ffffff"
  });

  let installed = false;
  let originalCapture = null;

  function text(value, fallback = "-") {
    const normalized = String(value == null ? "" : value).trim();
    return normalized || fallback;
  }

  function lower(value) {
    return text(value, "").toLowerCase();
  }

  function finite(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstFinite(...values) {
    for (const value of values) {
      const number = finite(value);
      if (number !== null) return number;
    }
    return null;
  }

  function formatNumber(value, digits = 3) {
    const number = finite(value);
    if (number === null) return "-";
    const abs = Math.abs(number);
    if (abs > 0 && abs < 0.001) return number.toExponential(4);
    return number.toFixed(digits);
  }

  function formatValue(value, unit = "", digits = 3) {
    const formatted = formatNumber(value, digits);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  function formatFixedValue(value, unit = "", digits = 5) {
    const number = finite(value);
    const formatted = number === null ? "-" : number.toFixed(digits);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  function compactMode(value, fallback) {
    return text(value, fallback)
      .replace(/\s+Boundary$/i, "")
      .replace(/^Standalone\s+Boundary\s+/i, "")
      .replace(/\s+/g, " ");
  }

  function runtimeModel(rootLike = root) {
    return rootLike.__npshGlobalModel || rootLike.globalModel || {};
  }

  function runtimeConnections(model = runtimeModel(root), rootLike = root) {
    const direct = rootLike.__npshConnections || rootLike.connections;
    if (Array.isArray(direct)) return direct;
    return Array.isArray(model.connections) ? model.connections : [];
  }

  function isHydraulicConnection(connection) {
    return !connection?.connectionType || connection.connectionType === "hydraulic";
  }

  function nodeType(model, id) {
    return lower(model?.[id]?.type);
  }

  function idsByType(model, type) {
    return Object.keys(model || {}).filter((id) => lower(model[id]?.type) === type);
  }

  function firstObjectId(model, types = []) {
    return Object.keys(model || {}).find((id) => types.includes(nodeType(model, id))) || "";
  }

  function getPrimaryPumpId(model, preferred = "") {
    if (preferred && nodeType(model, preferred) === "pump") return preferred;
    const pumpIds = idsByType(model, "pump");
    return pumpIds.find((id) => {
      const results = model[id]?.results || {};
      return firstFinite(results.flow, results.npsha, results.head) !== null;
    }) || pumpIds[0] || "";
  }

  function connectionEndpoint(connection, side) {
    return text(connection?.[side] || connection?.[`raw${side[0].toUpperCase()}${side.slice(1)}`], "");
  }

  function resolveRouteIds(model, connections, pumpId) {
    const hydraulic = (connections || []).filter(isHydraulicConnection);
    const upstream = hydraulic.find((connection) => connectionEndpoint(connection, "to") === pumpId)
      || hydraulic.find((connection) => connectionEndpoint(connection, "rawTo") === pumpId);
    const downstream = hydraulic.find((connection) => connectionEndpoint(connection, "from") === pumpId)
      || hydraulic.find((connection) => connectionEndpoint(connection, "rawFrom") === pumpId);

    const sourceId = connectionEndpoint(upstream, "from")
      || firstObjectId(model, ["source", "tank", "verticalvessel", "horizontalvessel", "separator"]);
    const sinkId = connectionEndpoint(downstream, "to")
      || firstObjectId(model, ["sink", "tank", "verticalvessel", "horizontalvessel", "separator"]);

    return {
      sourceId,
      suctionPipeId: text(upstream?.pipeId, ""),
      pumpId,
      dischargePipeId: text(downstream?.pipeId, ""),
      sinkId
    };
  }

  function getPipeTrace(pipe) {
    return pipe?.results?.calculationTrace || pipe?.results?.trace || {};
  }

  function valueFromTrace(trace, ...paths) {
    for (const path of paths) {
      const parts = String(path).split(".");
      let current = trace;
      for (const part of parts) current = current?.[part];
      const number = finite(current);
      if (number !== null) return number;
    }
    return null;
  }

  function pipeVelocity(pipe, trace) {
    return firstFinite(
      valueFromTrace(trace, "segments.0.velocity"),
      valueFromTrace(trace, "basis.velocity"),
      pipe?.results?.velocity
    );
  }

  function pipeBubbleData(pipeId, model) {
    const pipe = model?.[pipeId] || {};
    const trace = getPipeTrace(pipe);
    const totals = trace.totals || {};
    return {
      pipeId: text(pipeId),
      velocity: pipeVelocity(pipe, trace),
      totalK: firstFinite(totals.totalK, totals.kTotal, pipe.results?.totalK),
      totalHeadLoss: firstFinite(totals.totalLoss, totals.headLoss, pipe.results?.totalHeadLoss, pipe.results?.headLoss),
      minorLoss: firstFinite(totals.minorLoss, pipe.results?.minorLoss),
      majorLoss: firstFinite(totals.majorLoss, pipe.results?.majorLoss)
    };
  }

  function fluidSnapshot(fluid = {}) {
    const density = firstFinite(fluid.density, 997.047);
    const vaporPressure = firstFinite(fluid.vaporPressure, 0);
    const vaporPressureHead = firstFinite(
      fluid.vaporPressureHead,
      density && vaporPressure !== null ? vaporPressure * 100000 / (density * 9.81) : null
    );
    return {
      title: text(fluid.fluidName || fluid.name, "Water"),
      temp: firstFinite(fluid.temp, fluid.temperature, 25),
      density,
      viscosity: firstFinite(fluid.viscosity, fluid.kinematicViscosity),
      dynViscosity: firstFinite(fluid.dynViscosity, fluid.dynamicViscosity),
      vaporPressure,
      vaporPressureHead,
      specificWeight: firstFinite(fluid.specWeight, density !== null ? density * 9.81 : null)
    };
  }

  function sourceSnapshot(source = {}) {
    const props = source.props || {};
    const results = source.results || {};
    const boundary = results.calculationTrace?.boundary || {};
    return {
      mode: compactMode(props.flowInputMode || props.sourceType || source.name, "Source"),
      role: text(source.type, "Source"),
      flow: firstFinite(results.flow, props.flow, props.demandFlow),
      pressure: firstFinite(results.pressure, boundary.absolutePressureBar, props.pressure),
      elevation: firstFinite(props.elevation, results.elevation, boundary.elevation),
      head: firstFinite(boundary.totalSourceHead, results.hydraulicHead, results.head, boundary.boundaryHead)
    };
  }

  function sinkSnapshot(sink = {}) {
    const props = sink.props || {};
    const results = sink.results || {};
    return {
      mode: compactMode(props.boundaryMode || props.flowInputMode || sink.name, "Sink"),
      role: text(sink.type, "Sink"),
      flow: firstFinite(results.flow, props.demandFlow, props.flow),
      pressure: firstFinite(results.boundaryPressureInput, results.boundaryPressure, results.calculatedPressure, props.pressure),
      elevation: firstFinite(props.elevation, results.elevation),
      head: firstFinite(results.requiredBoundaryHead, results.hydraulicHead, results.head)
    };
  }

  function pumpSnapshot(pump = {}) {
    const results = pump.results || {};
    const evaluation = results.npshEvaluation || {};
    return {
      flow: firstFinite(results.flow, evaluation.flow, pump.props?.designFlow),
      head: firstFinite(results.head, results.requiredHead, results.requiredSystemHead),
      suctionPressure: firstFinite(results.suctionPressure, evaluation.suctionPressure),
      dischargePressure: firstFinite(results.dischargePressure, evaluation.dischargePressure),
      npsha: firstFinite(results.npsha, evaluation.npsha),
      npshr: firstFinite(results.npshr, evaluation.npshr, pump.props?.designNpshr),
      npshMargin: firstFinite(results.npshMargin, evaluation.margin, evaluation.npshMargin),
      npshRatio: firstFinite(results.npshRatio, evaluation.ratio, evaluation.npshRatio),
      requiredNpsha: firstFinite(results.requiredNpsha, evaluation.requiredNpsha),
      hydraulicStatus: text(results.hydraulicNpshStatus || evaluation.hydraulicStatus || results.cavitationStatus || results.status, "Incomplete"),
      backendStatus: text(results.backendValidationStatus || results.backendValid || results.calculationFreshness, "Unverified"),
      status: text(results.engineeringStatus || evaluation.engineeringStatus || results.status || results.hydraulicNpshStatus, "Incomplete")
    };
  }

  function statusTone(status) {
    const value = lower(status);
    if (/risk|cavitation|fail|invalid/.test(value)) return "risk";
    if (/warning|review|stale|unverified|timeout|required/.test(value)) return "warning";
    if (/safe|ok|current|connected|pass/.test(value)) return "safe";
    return "incomplete";
  }

  function compactRoute(route) {
    return [
      "FB",
      route.sourceId,
      route.suctionPipeId,
      route.pumpId,
      route.dischargePipeId,
      route.sinkId
    ].filter(Boolean);
  }

  function firstPipeIdFromSteps(model, steps = []) {
    for (const step of Array.isArray(steps) ? steps : []) {
      const id = text(step?.pipeId || step?.objectId || step?.id, "");
      if (id && nodeType(model, id) === "pipe") return id;
    }
    return "";
  }

  function pipeIdFromSourceData(sourceData, role, model) {
    const primary = sourceData?.primary || {};
    const state = primary.state || {};
    const context = state.context || primary.context || {};
    const path = role === "suction"
      ? (state.suctionPath || context.suctionPath || {})
      : (state.dischargePath || context.dischargePath || {});
    const fromSteps = firstPipeIdFromSteps(model, path.steps);
    if (fromSteps) return fromSteps;
    const lossEntry = (primary.trace?.losses?.entries || []).find((entry) => {
      const label = lower(`${entry?.role || ""} ${entry?.side || ""} ${entry?.pathRole || ""}`);
      return role === "suction" ? label.includes("suction") : label.includes("discharge");
    });
    const lossPipeId = text(lossEntry?.pipeId || lossEntry?.objectId, "");
    return nodeType(model, lossPipeId) === "pipe" ? lossPipeId : "";
  }

  function collectScenarioSourceData(options = {}) {
    if (options.sourceData) return options.sourceData;
    if (options.model) return null;
    if (typeof root.collectScenarioExportData !== "function") return null;
    try {
      return root.collectScenarioExportData();
    } catch (error) {
      return null;
    }
  }

  function buildSnapshotData(options = {}) {
    const rootLike = options.root || root;
    const sourceData = collectScenarioSourceData(options);
    const model = options.model || sourceData?.model || runtimeModel(rootLike);
    const connections = options.connections || runtimeConnections(model, rootLike);
    const pumpId = getPrimaryPumpId(model, options.pumpId || sourceData?.primary?.pumpId || "");
    const resolvedRoute = resolveRouteIds(model, connections, pumpId);
    const route = {
      ...resolvedRoute,
      sourceId: sourceData?.primary?.sourceId || resolvedRoute.sourceId,
      suctionPipeId: resolvedRoute.suctionPipeId || pipeIdFromSourceData(sourceData, "suction", model),
      dischargePipeId: resolvedRoute.dischargePipeId || pipeIdFromSourceData(sourceData, "discharge", model),
      sinkId: sourceData?.primary?.sinkId || resolvedRoute.sinkId
    };
    const pump = model?.[route.pumpId] || {};
    const source = model?.[route.sourceId] || {};
    const sink = model?.[route.sinkId] || {};

    return {
      version: VERSION,
      route,
      routeLabels: compactRoute(route),
      fluid: fluidSnapshot(model?.FLUID?.props || {}),
      source: sourceSnapshot(source),
      pump: pumpSnapshot(pump),
      sink: sinkSnapshot(sink),
      suctionPipe: pipeBubbleData(route.suctionPipeId, model),
      dischargePipe: pipeBubbleData(route.dischargePipeId, model)
    };
  }

  function createCanvas(width, height) {
    const documentRef = root.document;
    if (!documentRef?.createElement) return null;
    const canvas = documentRef.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function clampNumber(value, min, max) {
    const number = finite(value);
    if (number === null) return min;
    return Math.max(min, Math.min(max, number));
  }

  function xmlEscape(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function collectDocumentCss() {
    const documentRef = root.document;
    if (!documentRef) return "";
    const chunks = [];
    Array.from(documentRef.styleSheets || []).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule?.cssText) chunks.push(rule.cssText);
        });
      } catch (error) {
        // Cross-origin styles are intentionally skipped; inline app styles are sufficient for the dock.
      }
    });
    return chunks.join("\n");
  }

  function canvasToDataUrl(canvas) {
    try {
      return canvas?.toDataURL?.("image/png") || "";
    } catch (error) {
      return "";
    }
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const ImageCtor = root.Image;
      if (typeof ImageCtor !== "function" || !dataUrl) {
        reject(new Error("Image API or data URL is unavailable."));
        return;
      }
      const image = new ImageCtor();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Snapshot image could not be loaded."));
      image.src = dataUrl;
    });
  }

  async function renderElementToDataUrl(element, options = {}) {
    const rect = element?.getBoundingClientRect?.();
    const width = Math.max(1, Math.ceil(options.width || rect?.width || element?.offsetWidth || 0));
    const height = Math.max(1, Math.ceil(options.height || rect?.height || element?.offsetHeight || 0));
    if (!element || width < 2 || height < 2 || typeof root.XMLSerializer !== "function") return "";
    const clone = element.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    clone.style.position = "static";
    clone.style.left = "0";
    clone.style.top = "0";
    clone.style.width = `${width}px`;
    clone.style.maxWidth = `${width}px`;
    clone.style.minWidth = "0";
    clone.style.margin = "0";
    clone.style.boxSizing = "border-box";
    const serialized = new root.XMLSerializer().serializeToString(clone);
    const styleText = collectDocumentCss();
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject x="0" y="0" width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden;background:#f4f7f9;">
            <style>${xmlEscape(styleText)}</style>
            ${serialized}
          </div>
        </foreignObject>
      </svg>`;
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const image = await loadImage(svgUrl);
    const canvas = createCanvas(width, height);
    const ctx = canvas?.getContext?.("2d");
    if (!canvas || !ctx) return "";
    ctx.fillStyle = "#f4f7f9";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvasToDataUrl(canvas);
  }

  function findFluidBasisDock() {
    const documentRef = root.document;
    if (!documentRef) return null;
    root.CanvasContextDock?.refresh?.();
    const dock = documentRef.getElementById?.("canvasContextDock") || documentRef.querySelector?.(".canvas-context-dock");
    if (!dock || dock.hidden) return null;
    try {
      const style = root.getComputedStyle?.(dock);
      if (style && (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)) return null;
    } catch (error) {
      // Keep the dock if style inspection is unavailable.
    }
    return dock;
  }

  async function captureFluidBasisDockImage(options = {}) {
    const dock = findFluidBasisDock();
    if (!dock) return null;
    const rect = dock.getBoundingClientRect?.();
    const width = Math.max(1, Math.ceil(rect?.width || dock.offsetWidth || 0));
    const height = Math.max(1, Math.ceil(rect?.height || dock.offsetHeight || 0));
    if (width < 80 || height < 24) return null;
    const dataUrl = await renderElementToDataUrl(dock, {
      width,
      height: Math.min(height, options.maxDockHeight || 180)
    });
    return dataUrl ? { dataUrl, width, height: Math.min(height, options.maxDockHeight || 180) } : null;
  }

  function drawCompactFluidBasisDock(ctx, rect, options = {}) {
    const data = buildSnapshotData(options);
    const x = rect.x;
    const y = rect.y;
    const width = rect.width;
    const height = rect.height;
    const sx = width / 940;
    const sy = height / 106;
    const scale = Math.max(0.72, Math.min(1.2, Math.min(sx, sy)));
    const headerH = Math.round(32 * sy);
    const summaryH = Math.round(36 * sy);
    const routeH = Math.max(24, height - headerH - summaryH);
    const fieldY = y + headerH;
    const routeY = fieldY + summaryH;

    ctx.save();
    fillStrokeRoundRect(ctx, { x, y, width, height }, {
      radius: 4 * scale,
      fill: "rgba(255,255,255,0.97)",
      stroke: "#2ca58d",
      lineWidth: 1
    });

    drawText(ctx, "Fluid Basis", x + 8 * sx, y + 8 * sy, {
      size: 12 * scale,
      bold: true,
      color: COLORS.navy,
      maxWidth: width * 0.45
    });
    fillStrokeRoundRect(ctx, { x: x + width - 92 * sx, y: y + 8 * sy, width: 46 * sx, height: 18 * sy }, {
      radius: 9 * scale,
      fill: "#f7fffb",
      stroke: COLORS.panelBorder
    });
    drawText(ctx, "Current", x + width - 69 * sx, y + 11 * sy, {
      size: 9 * scale,
      align: "center",
      color: "#166534",
      maxWidth: 42 * sx
    });
    fillStrokeRoundRect(ctx, { x: x + width - 34 * sx, y: y + 7 * sy, width: 24 * sx, height: 21 * sy }, {
      radius: 5 * scale,
      fill: "#f8fbff",
      stroke: "#9db9d5"
    });
    drawText(ctx, "+", x + width - 22 * sx, y + 10 * sy, {
      size: 12 * scale,
      bold: true,
      align: "center",
      color: COLORS.navy
    });

    ctx.strokeStyle = "#d8e5ee";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, fieldY);
    ctx.lineTo(x + width, fieldY);
    ctx.moveTo(x, routeY);
    ctx.lineTo(x + width, routeY);
    ctx.stroke();

    const f = data.fluid;
    const fields = [
      ["Active Fluid Basis", f.title],
      ["Temperature", formatValue(f.temp, "deg C", 0)],
      ["Density", formatValue(f.density, "kg/m3", 3)],
      ["Kinematic Visc.", formatValue(f.viscosity, "cSt", 3)],
      ["Dynamic Visc.", formatValue(f.dynViscosity, "cP", 3)],
      ["Vapor Pressure", formatValue(f.vaporPressure, "bar a", 6)],
      ["Vapor Pressure Head", formatValue(f.vaporPressureHead, "m", 3)],
      ["Specific Weight", formatValue(f.specificWeight, "N/m3", 3)]
    ];
    const fieldW = width / fields.length;
    fields.forEach((field, index) => {
      const fx = x + index * fieldW;
      if (index > 0) {
        ctx.beginPath();
        ctx.moveTo(fx, fieldY);
        ctx.lineTo(fx, routeY);
        ctx.stroke();
      }
      drawText(ctx, field[0], fx + 7 * sx, fieldY + 6 * sy, {
        size: 9 * scale,
        color: COLORS.muted,
        maxWidth: fieldW - 12 * sx
      });
      drawText(ctx, field[1], fx + 7 * sx, fieldY + 19 * sy, {
        size: 10 * scale,
        bold: true,
        color: COLORS.navy,
        maxWidth: fieldW - 12 * sx
      });
    });

    drawText(ctx, "Route", x + 8 * sx, routeY + 9 * sy, {
      size: 11 * scale,
      bold: true,
      color: COLORS.navy
    });
    let pillX = x + 50 * sx;
    const pillY = routeY + Math.max(4 * sy, (routeH - 20 * sy) / 2);
    data.routeLabels.forEach((label, index) => {
      if (index > 0) {
        drawText(ctx, ">", pillX, pillY + 4 * sy, {
          size: 10 * scale,
          bold: true,
          color: COLORS.muted
        });
        pillX += 13 * sx;
      }
      const pillW = Math.max(24 * sx, Math.min(84 * sx, 14 * sx + label.length * 7 * sx));
      fillStrokeRoundRect(ctx, { x: pillX, y: pillY, width: pillW, height: 20 * sy }, {
        radius: 4 * scale,
        fill: label === "FB" ? "#f7fffb" : "#f8fbff",
        stroke: label === "FB" ? COLORS.panelBorder : "#9ec8f5"
      });
      drawText(ctx, label, pillX + pillW / 2, pillY + 5 * sy, {
        size: 10 * scale,
        align: "center",
        color: label === "FB" ? "#166534" : COLORS.navy,
        maxWidth: pillW - 6 * sx
      });
      pillX += pillW + 8 * sx;
    });
    ctx.restore();
  }

  function findCanvasWorkspace() {
    const documentRef = root.document;
    if (!documentRef) return null;
    return documentRef.getElementById?.("canvas") || documentRef.querySelector?.(".pfd-canvas");
  }

  function elementIsVisible(element) {
    if (!element || element.hidden) return false;
    try {
      const style = root.getComputedStyle?.(element);
      if (style && (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)) {
        return false;
      }
    } catch (error) {
      // Treat the element as visible if computed style inspection is unavailable.
    }
    const rect = element.getBoundingClientRect?.();
    return !!rect && rect.width > 0 && rect.height > 0;
  }

  function rectsIntersect(a, b) {
    return !!a && !!b
      && a.right > b.left
      && a.left < b.right
      && a.bottom > b.top
      && a.top < b.bottom;
  }

  function visiblePipeParameterLabelInfo() {
    const documentRef = root.document;
    const canvas = findCanvasWorkspace();
    if (!documentRef || !canvas) return null;
    const canvasRect = canvas.getBoundingClientRect?.();
    if (!canvasRect || canvasRect.width < 2 || canvasRect.height < 2) return null;
    const labels = Array.from(documentRef.querySelectorAll?.(
      "#svg-lines .pipe-delta-label[data-pipe-id], #svg-lines .pipe-hydraulic-label[data-pipe-id]"
    ) || []);
    for (const label of labels) {
      if (!elementIsVisible(label)) continue;
      const labelText = text(label.textContent, "");
      const normalized = lower(labelText);
      if (!normalized.includes("total hl") || !normalized.includes("minor") || !normalized.includes("major")) continue;
      const rect = label.getBoundingClientRect?.();
      if (!rectsIntersect(rect, canvasRect)) continue;
      return {
        pipeId: text(label.getAttribute?.("data-pipe-id"), ""),
        text: labelText,
        box: {
          x: Math.round(rect.left - canvasRect.left),
          y: Math.round(rect.top - canvasRect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };
    }
    return null;
  }

  function visibleWorkspaceCropCandidates(canvasElement) {
    if (!canvasElement?.querySelectorAll) return [];
    const selectors = [
      "#canvasContextDock",
      ".canvas-context-dock",
      ".pfd-object",
      ".source-canvas-parameter",
      ".sink-canvas-parameter",
      ".source-live-params:not([hidden])",
      ".sink-live-params:not([hidden])",
      ".pump-live-params:not([hidden])",
      ".tank-live-params:not([hidden])",
      ".lic-canvas-trend-panel:not([hidden])",
      ".line-monitor-readout",
      ".pipe-delta-label[data-pipe-id]",
      ".pipe-hydraulic-label[data-pipe-id]",
      "[class*='canvas-parameter']",
      "[class*='canvas-readout']",
      "[class*='pump-canvas']",
      "[class*='source-canvas']",
      "[class*='sink-canvas']",
      "#svg-lines path",
      "#svg-lines line",
      "#svg-lines polyline",
      "#svg-lines circle",
      "#svg-lines rect",
      "#svg-lines text"
    ];
    const seen = new Set();
    const candidates = [];
    selectors.forEach((selector) => {
      canvasElement.querySelectorAll(selector).forEach((node) => {
        if (seen.has(node)) return;
        seen.add(node);
        candidates.push(node);
      });
    });
    const dock = findFluidBasisDock();
    if (dock && !seen.has(dock)) candidates.push(dock);
    return candidates;
  }

  function isIgnoredWorkspaceCropElement(element) {
    return !!element?.closest?.(
      ".canvas-status-legend, .canvas-warning-panel, .canvas-connect-hint, .tablet-landscape-notice, .full-editor-modal"
    );
  }

  function resolveVisibleWorkspaceCropRect(canvasElement, options = {}) {
    const canvasRect = canvasElement?.getBoundingClientRect?.();
    const viewportWidth = Math.max(1, Math.ceil(options.width || canvasElement?.clientWidth || canvasRect?.width || 0));
    const viewportHeight = Math.max(1, Math.ceil(options.height || canvasElement?.clientHeight || canvasRect?.height || 0));
    const fallbackHeight = clampNumber(options.defaultCropHeight || 520, 320, viewportHeight);
    if (!canvasElement || !canvasRect || viewportWidth < 80 || viewportHeight < 80) {
      return { left: 0, top: 0, width: viewportWidth, height: fallbackHeight, bottom: fallbackHeight, source: "fallback" };
    }

    let right = 0;
    let bottom = 0;
    let hasContent = false;
    const viewportRect = {
      left: canvasRect.left,
      top: canvasRect.top,
      right: canvasRect.left + viewportWidth,
      bottom: canvasRect.top + viewportHeight
    };

    visibleWorkspaceCropCandidates(canvasElement).forEach((element) => {
      if (!elementIsVisible(element) || isIgnoredWorkspaceCropElement(element)) return;
      const rect = element.getBoundingClientRect?.();
      if (!rect || !rectsIntersect(rect, viewportRect)) return;
      const localBottom = Math.min(viewportHeight, Math.max(0, rect.bottom - canvasRect.top));
      const localRight = Math.min(viewportWidth, Math.max(0, rect.right - canvasRect.left));
      if (localRight > 0) {
        right = Math.max(right, localRight);
        hasContent = true;
      }
      if (localBottom > 0) {
        bottom = Math.max(bottom, localBottom);
        hasContent = true;
      }
    });

    const paddingBottom = clampNumber(options.contentCropPaddingBottom || 18, 8, 80);
    const paddingRight = clampNumber(options.contentCropPaddingRight || 16, 8, 96);
    const minWidth = clampNumber(options.minVisibleWorkspaceCropWidth || 720, 480, viewportWidth);
    const minHeight = clampNumber(options.minVisibleWorkspaceCropHeight || 360, 260, viewportHeight);
    const wantedWidth = hasContent
      ? Math.ceil(Math.max(minWidth, right + paddingRight))
      : viewportWidth;
    const wantedHeight = hasContent
      ? Math.ceil(Math.max(minHeight, bottom + paddingBottom))
      : fallbackHeight;
    const width = Math.min(viewportWidth, Math.max(1, wantedWidth));
    const height = Math.min(viewportHeight, Math.max(1, wantedHeight));
    return {
      left: 0,
      top: 0,
      width,
      height,
      right: Math.round(right),
      bottom: Math.round(bottom),
      source: hasContent ? "content-bounds" : "fallback"
    };
  }

  function cloneForDomSnapshot(element, options = {}) {
    const clone = element.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    clone.querySelectorAll?.("script").forEach((node) => node.remove());
    if (options.excludeFluidBasisDock) {
      clone.querySelectorAll?.("#canvasContextDock, .canvas-context-dock").forEach((node) => node.remove());
    }
    return clone;
  }

  async function renderCanvasViewportToDataUrl(canvasElement, options = {}) {
    const rect = canvasElement?.getBoundingClientRect?.();
    const viewportWidth = Math.max(1, Math.ceil(options.width || canvasElement?.clientWidth || rect?.width || 0));
    const viewportHeight = Math.max(1, Math.ceil(options.height || canvasElement?.clientHeight || rect?.height || 0));
    const cropRect = resolveVisibleWorkspaceCropRect(canvasElement, {
      ...options,
      width: viewportWidth,
      height: viewportHeight
    });
    const rawWidth = cropRect.width;
    const rawHeight = cropRect.height;
    if (!canvasElement || rawWidth < 80 || rawHeight < 80 || typeof root.XMLSerializer !== "function") return null;

    const maxWidth = clampNumber(options.maxWidth || 1600, 720, 2400);
    const outputScale = Math.min(1, maxWidth / rawWidth);
    const outputWidth = Math.max(1, Math.round(rawWidth * outputScale));
    const outputHeight = Math.max(1, Math.round(rawHeight * outputScale));
    const scrollLeft = finite(canvasElement.scrollLeft) || 0;
    const scrollTop = finite(canvasElement.scrollTop) || 0;
    const contentWidth = Math.max(rawWidth + scrollLeft + cropRect.left, canvasElement.scrollWidth || 0, rect?.width || 0, 1200);
    const contentHeight = Math.max(rawHeight + scrollTop + cropRect.top, canvasElement.scrollHeight || 0, rect?.height || 0, 760);

    const documentRef = root.document;
    const wrapper = documentRef.createElement("div");
    wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    wrapper.style.position = "relative";
    wrapper.style.width = `${rawWidth}px`;
    wrapper.style.height = `${rawHeight}px`;
    wrapper.style.overflow = "hidden";
    wrapper.style.background = COLORS.canvas;
    wrapper.style.margin = "0";

    const styleNode = documentRef.createElement("style");
    styleNode.textContent = collectDocumentCss();
    wrapper.appendChild(styleNode);

    const canvasClone = cloneForDomSnapshot(canvasElement, { excludeFluidBasisDock: true });
    canvasClone.style.position = "absolute";
    canvasClone.style.left = `${-(scrollLeft + cropRect.left)}px`;
    canvasClone.style.top = `${-(scrollTop + cropRect.top)}px`;
    canvasClone.style.width = `${contentWidth}px`;
    canvasClone.style.height = `${contentHeight}px`;
    canvasClone.style.maxWidth = "none";
    canvasClone.style.maxHeight = "none";
    canvasClone.style.minWidth = "0";
    canvasClone.style.overflow = "visible";
    canvasClone.style.margin = "0";
    canvasClone.style.transform = "none";
    canvasClone.style.boxSizing = "border-box";
    wrapper.appendChild(canvasClone);

    const serialized = new root.XMLSerializer().serializeToString(wrapper);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${rawWidth}" height="${rawHeight}" viewBox="0 0 ${rawWidth} ${rawHeight}">
        <foreignObject x="0" y="0" width="${rawWidth}" height="${rawHeight}">
          ${serialized}
        </foreignObject>
      </svg>`;
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const image = await loadImage(svgUrl);
    const canvas = createCanvas(outputWidth, outputHeight);
    const ctx = canvas?.getContext?.("2d");
    if (!canvas || !ctx) return null;
    ctx.fillStyle = COLORS.canvas;
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(image, 0, 0, outputWidth, outputHeight);
    let dockCompositedSeparately = false;
    let dockCompositeMode = "";
    const dock = findFluidBasisDock();
    if (dock && elementIsVisible(dock)) {
      const canvasRect = canvasElement.getBoundingClientRect?.();
      const dockRect = dock.getBoundingClientRect?.();
      const dockWidth = Math.round(dockRect?.width || dock.offsetWidth || 0);
      const dockHeight = Math.round(dockRect?.height || dock.offsetHeight || 0);
      const dockLeft = Math.round(((dockRect?.left || 0) - (canvasRect?.left || 0) - cropRect.left) * outputScale);
      const dockTop = Math.round(((dockRect?.top || 0) - (canvasRect?.top || 0) - cropRect.top) * outputScale);
      if (dockWidth > 20 && dockHeight > 20) {
        try {
          drawCompactFluidBasisDock(ctx, {
            x: dockLeft,
            y: dockTop,
            width: Math.round(dockWidth * outputScale),
            height: Math.round(Math.min(dockHeight, options.maxDockHeight || 180) * outputScale)
          }, options);
          dockCompositedSeparately = true;
          dockCompositeMode = "manual-fluid-basis-dock";
        } catch (error) {
          const dockDataUrl = await renderElementToDataUrl(dock, {
            width: dockWidth,
            height: Math.min(dockHeight, options.maxDockHeight || 180)
          });
          const dockImage = await loadImage(dockDataUrl);
          ctx.drawImage(
            dockImage,
            dockLeft,
            dockTop,
            Math.round(dockWidth * outputScale),
            Math.round(Math.min(dockHeight, options.maxDockHeight || 180) * outputScale)
          );
          dockCompositedSeparately = true;
          dockCompositeMode = "foreign-object-dock-fallback";
        }
      }
    }
    return {
      dataUrl: canvasToDataUrl(canvas),
      width: outputWidth,
      height: outputHeight,
      rawWidth,
      rawHeight,
      cropRect,
      dockCompositedSeparately,
      dockCompositeMode,
      outputScale,
      scrollLeft,
      scrollTop
    };
  }

  async function overlayPipeCaptionOnSnapshot(snapshot, options = {}) {
    if (!snapshot?.dataUrl || options.includePipeCaptionOverlay === false) return snapshot;
    const pipeCaptions = resolvePipeCaptionDataList(options);
    if (!pipeCaptions.length) return snapshot;
    const image = await loadImage(snapshot.dataUrl);
    const width = image.naturalWidth || image.width || snapshot.width || 1;
    const height = image.naturalHeight || image.height || snapshot.height || 1;
    const canvas = createCanvas(width, height);
    const ctx = canvas?.getContext?.("2d");
    if (!canvas || !ctx) return snapshot;
    ctx.drawImage(image, 0, 0, width, height);
    const fallbackXs = Array.isArray(options.pipeCaptionXs) && options.pipeCaptionXs.length
      ? options.pipeCaptionXs
      : [width * 0.2, width * 0.5, width * 0.34];
    const pipeCaptionBoxes = pipeCaptions
      .map((pipeCaption, index) => ({
        pipeCaption,
        box: drawPipeParameterCaption(ctx, pipeCaption, {
          targetWidth: width,
          targetHeight: height,
          x: fallbackXs[Math.min(index, fallbackXs.length - 1)],
          y: options.pipeCaptionY
        })
      }))
      .filter((entry) => entry.box);
    if (!pipeCaptionBoxes.length) return snapshot;
    return {
      ...snapshot,
      dataUrl: canvasToDataUrl(canvas),
      width,
      height,
      meta: {
        ...(snapshot.meta || {}),
        includesPipeFittingValveParameters: true,
        pipeCaptionCaptureMode: "trace-overlay-fallback",
        pipeCaptionOverlay: true,
        pipeCaptionPipeId: pipeCaptionBoxes[0].pipeCaption.pipeId,
        pipeCaptionPipeIds: pipeCaptionBoxes.map((entry) => entry.pipeCaption.pipeId),
        pipeCaptionSource: pipeCaptionBoxes[0].pipeCaption.source,
        pipeCaptionBox: pipeCaptionBoxes[0].box,
        pipeCaptionBoxes: pipeCaptionBoxes.map((entry) => ({
          pipeId: entry.pipeCaption.pipeId,
          box: entry.box
        }))
      }
    };
  }

  async function captureVisibleWorkspaceDomSnapshot(options = {}) {
    const canvasElement = findCanvasWorkspace();
    if (!canvasElement) return null;
    root.CanvasContextDock?.refresh?.();
    const labelInfo = visiblePipeParameterLabelInfo();
    const crop = await renderCanvasViewportToDataUrl(canvasElement, options);
    if (!crop?.dataUrl) return null;
    const dock = findFluidBasisDock();
    const snapshot = {
      dataUrl: crop.dataUrl,
      status: "captured-visible-workspace-dom-crop",
      width: crop.width,
      height: crop.height,
      meta: {
        version: VERSION,
        cropMode: "visible-canvas-dom-crop",
        includesFluidBasis: !!dock,
        includesPipeFittingValveParameters: !!labelInfo,
        pipeCaptionCaptureMode: labelInfo ? "visible-dom" : "missing-visible-label",
        pipeCaptionOverlay: false,
        pipeCaptionPipeId: labelInfo?.pipeId || "",
        pipeCaptionBox: labelInfo?.box ? {
          x: Math.round((labelInfo.box.x - crop.cropRect.left) * crop.outputScale),
          y: Math.round((labelInfo.box.y - crop.cropRect.top) * crop.outputScale),
          width: Math.round(labelInfo.box.width * crop.outputScale),
          height: Math.round(labelInfo.box.height * crop.outputScale)
        } : null,
        visibleCanvasCrop: {
          width: crop.rawWidth,
          height: crop.rawHeight,
          contentRight: crop.cropRect.right,
          contentBottom: crop.cropRect.bottom,
          cropSource: crop.cropRect.source,
          dockCompositedSeparately: crop.dockCompositedSeparately,
          dockCompositeMode: crop.dockCompositeMode,
          scrollLeft: crop.scrollLeft,
          scrollTop: crop.scrollTop,
          outputScale: crop.outputScale
        }
      }
    };
    if (labelInfo) return snapshot;
    const canvasRect = canvasElement.getBoundingClientRect?.();
    const dockRect = dock?.getBoundingClientRect?.();
    const dockBottom = dockRect && canvasRect
      ? Math.round(((dockRect.bottom || 0) - (canvasRect.top || 0) - crop.cropRect.top + 24) * crop.outputScale)
      : Math.round(crop.height * 0.25);
    return overlayPipeCaptionOnSnapshot(snapshot, {
      ...options,
      pipeCaptionY: Math.max(8, dockBottom),
      pipeCaptionXs: [crop.width * 0.2, crop.width * 0.5]
    });
  }

  function canonicalPipeCaptionKey(value) {
    const normalized = lower(value).replace(/\s+/g, " ");
    if (normalized === "v" || normalized.includes("velocity")) return "v";
    if (normalized.includes("total k")) return "Total K";
    if (normalized.includes("total hl") || normalized.includes("total head") || normalized.includes("total loss")) return "Total hL";
    if (normalized.includes("minor")) return "Minor";
    if (normalized.includes("major")) return "Major";
    return text(value, "");
  }

  function pipeCaptionRowsFromBubbleData(pipeData = {}) {
    return [
      { key: "v", value: formatValue(pipeData.velocity, "m/s", 5) },
      { key: "Total K", value: formatNumber(pipeData.totalK, 3) },
      { key: "Total hL", value: formatFixedValue(pipeData.totalHeadLoss, "m", 5) },
      { key: "Minor", value: formatFixedValue(pipeData.minorLoss, "m", 5) },
      { key: "Major", value: formatFixedValue(pipeData.majorLoss, "m", 5) }
    ];
  }

  function normalizePipeCaptionRows(rows = []) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const wanted = ["v", "Total K", "Total hL", "Minor", "Major"];
    return wanted.map((key) => {
      const row = sourceRows.find((entry) => canonicalPipeCaptionKey(entry?.key || entry?.label || entry?.title) === key);
      return {
        key,
        value: text(row?.value, "-")
      };
    });
  }

  function hasPipeCaptionValue(rows = []) {
    return rows.some((row) => {
      const value = text(row?.value, "-");
      return value !== "-" && value !== "NaN" && !/^nan\b/i.test(value);
    });
  }

  function pipeHasTraceValues(pipeId, model) {
    if (!pipeId || nodeType(model, pipeId) !== "pipe") return false;
    return hasPipeCaptionValue(pipeCaptionRowsFromBubbleData(pipeBubbleData(pipeId, model)));
  }

  function firstTracePipeId(model = {}) {
    return Object.keys(model || {}).find((id) => pipeHasTraceValues(id, model)) || "";
  }

  function resolvePipeCaptionData(options = {}) {
    const rootLike = options.root || root;
    const sourceData = collectScenarioSourceData(options);
    const model = options.model || sourceData?.model || runtimeModel(rootLike);
    const snapshotData = buildSnapshotData({ ...options, sourceData, model });
    const pipeIds = [
      ...(Array.isArray(options.preferredPipeIds) ? options.preferredPipeIds : []),
      snapshotData.route?.suctionPipeId,
      snapshotData.route?.dischargePipeId,
      firstTracePipeId(model)
    ].filter(Boolean);
    const uniquePipeIds = [...new Set(pipeIds)];

    for (const pipeId of uniquePipeIds) {
      try {
        const runtimeRows = root.EngineeringPipeCanvasHydraulicLabelRuntime
          ?.buildPipeHydraulicLabelData?.(pipeId)?.rows;
        const normalizedRows = normalizePipeCaptionRows(runtimeRows);
        if (hasPipeCaptionValue(normalizedRows)) {
          return { pipeId, rows: normalizedRows, source: "pipe-label-runtime" };
        }
      } catch (error) {
        // Fall back to the exported calculation trace below.
      }

      const fallbackRows = pipeCaptionRowsFromBubbleData(pipeBubbleData(pipeId, model));
      if (hasPipeCaptionValue(fallbackRows)) {
        return { pipeId, rows: fallbackRows, source: "calculation-trace" };
      }
    }

    return null;
  }

  function resolvePipeCaptionDataList(options = {}) {
    const rootLike = options.root || root;
    const sourceData = collectScenarioSourceData(options);
    const model = options.model || sourceData?.model || runtimeModel(rootLike);
    const snapshotData = buildSnapshotData({ ...options, sourceData, model });
    const pipeIds = [
      snapshotData.route?.suctionPipeId,
      snapshotData.route?.dischargePipeId
    ].filter(Boolean);
    const captions = [...new Set(pipeIds)]
      .map((pipeId) => resolvePipeCaptionData({ ...options, sourceData, model, preferredPipeIds: [pipeId] }))
      .filter((caption, index, list) => (
        caption?.pipeId && list.findIndex((candidate) => candidate?.pipeId === caption.pipeId) === index
      ));
    if (captions.length) return captions;
    const fallback = resolvePipeCaptionData({ ...options, sourceData, model });
    return fallback ? [fallback] : [];
  }

  function drawPipeParameterCaption(ctx, captionData, layout = {}) {
    const rows = normalizePipeCaptionRows(captionData?.rows || []);
    if (!ctx || !hasPipeCaptionValue(rows)) return null;
    const targetWidth = layout.targetWidth || SNAPSHOT_WIDTH;
    const targetHeight = layout.targetHeight || SNAPSHOT_HEIGHT;
    const targetDockHeight = layout.targetDockHeight || 0;
    const workspaceTopPadding = layout.workspaceTopPadding || 0;
    const scale = clampNumber(targetWidth / 960, 0.9, 1.18);
    const width = Math.round(clampNumber(182 * scale, 170, 230));
    const height = Math.round(clampNumber(75 * scale, 72, 88));
    const x = Math.round(clampNumber(layout.x || targetWidth * 0.34, 18, targetWidth - width - 18));
    const y = Math.round(clampNumber(
      layout.y || targetDockHeight + workspaceTopPadding + 22,
      targetDockHeight + 8,
      targetHeight - height - 18
    ));
    const box = { x, y, width, height };

    ctx.save();
    ctx.shadowColor = "rgba(20, 66, 104, 0.08)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    fillStrokeRoundRect(ctx, box, {
      radius: 5,
      fill: "rgba(255,255,255,0.98)",
      stroke: "#7db8ff",
      lineWidth: 1.4
    });
    ctx.shadowColor = "transparent";

    const fontSize = Math.max(9, Math.round(10.5 * scale));
    const rowGap = (height - 17) / rows.length;
    rows.forEach((row, index) => {
      const yy = y + 8 + index * rowGap;
      drawText(ctx, row.key, x + 10, yy, {
        size: fontSize,
        mono: true,
        bold: true,
        color: COLORS.navy,
        maxWidth: width * 0.36
      });
      drawText(ctx, row.value, x + Math.round(width * 0.42), yy, {
        size: fontSize,
        mono: true,
        bold: true,
        color: COLORS.navy,
        maxWidth: width * 0.52
      });
    });
    ctx.restore();
    return box;
  }

  function drawCompositeWorkspaceGrid(ctx, width, height) {
    ctx.fillStyle = COLORS.canvas;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 0.5; x <= width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0.5; y <= height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  async function composeFluidBasisWorkspaceSnapshot(baseSnapshot, dockSnapshot, options = {}) {
    if (!baseSnapshot?.dataUrl || !dockSnapshot?.dataUrl) return baseSnapshot;
    const [canvasImage, dockImage] = await Promise.all([
      loadImage(baseSnapshot.dataUrl),
      loadImage(dockSnapshot.dataUrl)
    ]);
    const maxWidth = clampNumber(options.maxWidth || 1600, 720, 2400);
    const baseWidth = canvasImage.naturalWidth || canvasImage.width || baseSnapshot.width || 1;
    const baseHeight = canvasImage.naturalHeight || canvasImage.height || baseSnapshot.height || 1;
    const dockWidth = dockImage.naturalWidth || dockImage.width || dockSnapshot.width || baseWidth;
    const dockHeight = dockImage.naturalHeight || dockImage.height || dockSnapshot.height || 1;
    const targetWidth = Math.min(maxWidth, Math.max(baseWidth, dockWidth, 960));
    const dockScale = targetWidth / Math.max(dockWidth, 1);
    const baseScale = targetWidth / Math.max(baseWidth, 1);
    const workspaceTopPadding = Math.round(clampNumber(
      options.workspaceTopPadding || 58 * Math.min(Math.max(targetWidth / 1280, 0.75), 1.15),
      28,
      96
    ));
    const targetDockHeight = Math.max(28, Math.round(dockHeight * dockScale));
    const targetBaseHeight = Math.max(1, Math.round(baseHeight * baseScale));
    const targetHeight = targetDockHeight + workspaceTopPadding + targetBaseHeight;
    const canvas = createCanvas(targetWidth, targetHeight);
    const ctx = canvas?.getContext?.("2d");
    if (!canvas || !ctx) return baseSnapshot;
    drawCompositeWorkspaceGrid(ctx, targetWidth, targetHeight);
    ctx.drawImage(dockImage, 0, 0, targetWidth, targetDockHeight);
    ctx.drawImage(canvasImage, 0, targetDockHeight + workspaceTopPadding, targetWidth, targetBaseHeight);
    const pipeCaption = options.includePipeCaptionOverlay === false ? null : resolvePipeCaptionData(options);
    const pipeCaptionBox = pipeCaption
      ? drawPipeParameterCaption(ctx, pipeCaption, {
        targetWidth,
        targetHeight,
        targetDockHeight,
        workspaceTopPadding
      })
      : null;
    return {
      ...baseSnapshot,
      dataUrl: canvasToDataUrl(canvas),
      status: "captured-fluid-basis-workspace-crop",
      width: targetWidth,
      height: targetHeight,
      meta: {
        ...(baseSnapshot.meta || {}),
        version: VERSION,
        baseStatus: baseSnapshot.status || "",
        cropMode: "fluid-basis-dock-plus-native-canvas",
        includesFluidBasis: true,
        includesPipeFittingValveParameters: true,
        workspaceTopPadding,
        pipeCaptionOverlay: !!pipeCaptionBox,
        pipeCaptionPipeId: pipeCaptionBox ? pipeCaption.pipeId : "",
        pipeCaptionSource: pipeCaptionBox ? pipeCaption.source : "",
        pipeCaptionBox
      }
    };
  }

  function waitForSnapshotFrame() {
    return new Promise(resolve => {
      if (typeof root.requestAnimationFrame === "function") {
        root.requestAnimationFrame(() => resolve());
        return;
      }
      if (typeof root.setTimeout === "function") {
        root.setTimeout(resolve, 0);
        return;
      }
      resolve();
    });
  }

  async function preparePipeParameterLabelsForSnapshot() {
    const labelRuntime = root.EngineeringPipeCanvasHydraulicLabelRuntime;
    try {
      labelRuntime?.install?.();
      root.drawConnections?.();
      labelRuntime?.runImmediateRefresh?.({ force: true });
      root.refreshPipeCanvasHydraulicLabels?.(root.document);
      await waitForSnapshotFrame();
      labelRuntime?.runImmediateRefresh?.({ force: true });
      root.refreshPipeCanvasHydraulicLabels?.(root.document);
    } catch (error) {
      root.console?.warn?.("Pipe/Fitting/Valve snapshot labels could not be refreshed before capture.", error);
    }
  }

  function roundedRect(ctx, x, y, width, height, radius = 6) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function fillStrokeRoundRect(ctx, rect, options = {}) {
    roundedRect(ctx, rect.x, rect.y, rect.width, rect.height, options.radius ?? 6);
    if (options.fill) {
      ctx.fillStyle = options.fill;
      ctx.fill();
    }
    if (options.stroke) {
      ctx.strokeStyle = options.stroke;
      ctx.lineWidth = options.lineWidth || 1;
      ctx.stroke();
    }
  }

  function drawGrid(ctx) {
    ctx.fillStyle = COLORS.canvas;
    ctx.fillRect(0, 0, SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= SNAPSHOT_WIDTH; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, SNAPSHOT_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= SNAPSHOT_HEIGHT; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(SNAPSHOT_WIDTH, y + 0.5);
      ctx.stroke();
    }
  }

  function fitText(ctx, value, maxWidth) {
    const raw = text(value, "");
    if (ctx.measureText(raw).width <= maxWidth) return raw;
    let clipped = raw;
    while (clipped.length > 1 && ctx.measureText(`${clipped}...`).width > maxWidth) {
      clipped = clipped.slice(0, -1);
    }
    return `${clipped.trim()}...`;
  }

  function drawText(ctx, value, x, y, options = {}) {
    const size = options.size || 14;
    const weight = options.bold ? "700" : options.weight || "500";
    const family = options.mono ? "Consolas, 'Courier New', monospace" : "'Segoe UI', Arial, sans-serif";
    ctx.save();
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = options.color || COLORS.text;
    ctx.textAlign = options.align || "left";
    ctx.textBaseline = options.baseline || "top";
    const rendered = options.maxWidth ? fitText(ctx, value, options.maxWidth) : text(value, "");
    ctx.fillText(rendered, x, y);
    ctx.restore();
  }

  function drawField(ctx, label, value, x, y, width) {
    ctx.strokeStyle = "#d8e5ee";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 42);
    ctx.stroke();
    drawText(ctx, label, x + 10, y, { size: 11, color: COLORS.muted, maxWidth: width - 16 });
    drawText(ctx, value, x + 10, y + 18, { size: 13, bold: true, color: COLORS.navy, maxWidth: width - 16 });
  }

  function drawRoutePill(ctx, label, x, y) {
    const width = Math.max(50, Math.min(108, 18 + label.length * 8));
    fillStrokeRoundRect(ctx, { x, y, width, height: 28 }, {
      radius: 5,
      fill: label === "FB" ? "#f7fffb" : "#f8fbff",
      stroke: label === "FB" ? COLORS.panelBorder : "#9ec8f5"
    });
    drawText(ctx, label, x + width / 2, y + 6, {
      size: 12,
      bold: true,
      align: "center",
      color: label === "FB" ? "#166534" : COLORS.navy,
      maxWidth: width - 10
    });
    return width;
  }

  function drawFluidHeader(ctx, data) {
    fillStrokeRoundRect(ctx, { x: 16, y: 12, width: 1248, height: 138 }, {
      radius: 4,
      fill: "rgba(255,255,255,0.96)",
      stroke: "#2ca58d",
      lineWidth: 1.5
    });
    drawText(ctx, "Fluid Basis", 28, 26, { size: 15, bold: true, color: COLORS.navy });
    fillStrokeRoundRect(ctx, { x: 1144, y: 24, width: 64, height: 25 }, {
      radius: 13,
      fill: "#f7fffb",
      stroke: COLORS.panelBorder
    });
    drawText(ctx, "Current", 1176, 30, { size: 11, align: "center", color: "#166534" });
    fillStrokeRoundRect(ctx, { x: 1220, y: 24, width: 32, height: 28 }, {
      radius: 6,
      fill: "#f8fbff",
      stroke: "#9db9d5"
    });
    drawText(ctx, "+", 1236, 29, { size: 14, bold: true, align: "center", color: COLORS.navy });

    const f = data.fluid;
    const fields = [
      ["Active Fluid Basis", f.title],
      ["Temperature", formatValue(f.temp, "deg C", 1)],
      ["Density", formatValue(f.density, "kg/m3", 3)],
      ["Kinematic Visc.", formatValue(f.viscosity, "cSt", 3)],
      ["Dynamic Visc.", formatValue(f.dynViscosity, "cP", 3)],
      ["Vapor Pressure", formatValue(f.vaporPressure, "bar a", 6)],
      ["Vapor Pressure Head", formatValue(f.vaporPressureHead, "m", 3)],
      ["Specific Weight", formatValue(f.specificWeight, "N/m3", 3)]
    ];
    const startX = 16;
    const fieldY = 68;
    const fieldW = 1248 / fields.length;
    fields.forEach((field, index) => drawField(ctx, field[0], field[1], startX + index * fieldW, fieldY, fieldW));

    drawText(ctx, "Route", 28, 122, { size: 13, bold: true, color: COLORS.navy });
    let x = 84;
    data.routeLabels.forEach((label, index) => {
      if (index > 0) {
        drawText(ctx, ">", x, 126, { size: 13, bold: true, color: COLORS.muted });
        x += 18;
      }
      x += drawRoutePill(ctx, label, x, 114) + 10;
    });
  }

  function drawMetricBubble(ctx, titleData, x, y) {
    fillStrokeRoundRect(ctx, { x, y, width: 238, height: 100 }, {
      radius: 5,
      fill: "rgba(255,255,255,0.98)",
      stroke: "#7db8ff",
      lineWidth: 1.4
    });
    const rows = [
      ["v", formatValue(titleData.velocity, "m/s", 5)],
      ["Total K", formatNumber(titleData.totalK, 3)],
      ["Total hL", formatFixedValue(titleData.totalHeadLoss, "m", 5)],
      ["Minor", formatFixedValue(titleData.minorLoss, "m", 5)],
      ["Major", formatFixedValue(titleData.majorLoss, "m", 5)]
    ];
    rows.forEach((row, index) => {
      const yy = y + 12 + index * 17;
      drawText(ctx, row[0], x + 12, yy, { size: 12, mono: true, bold: true, color: COLORS.navy });
      drawText(ctx, row[1], x + 72, yy, { size: 12, mono: true, bold: true, color: COLORS.navy, maxWidth: 154 });
    });
  }

  function drawPanel(ctx, x, y, width, rows, options = {}) {
    fillStrokeRoundRect(ctx, { x, y, width, height: options.height || rows.length * 17 + 30 }, {
      radius: 5,
      fill: COLORS.panel,
      stroke: COLORS.panelBorder,
      lineWidth: 1.5
    });
    rows.forEach((row, index) => {
      const yy = y + 10 + index * 17;
      drawText(ctx, row[0], x + 12, yy, {
        size: 12,
        mono: true,
        bold: true,
        color: COLORS.navy,
        maxWidth: width * 0.48
      });
      drawText(ctx, row[1], x + width - 12, yy, {
        size: 12,
        mono: true,
        bold: true,
        align: "right",
        color: COLORS.navy,
        maxWidth: width * 0.5
      });
    });
  }

  function drawSourceIcon(ctx, x, y, id) {
    fillStrokeRoundRect(ctx, { x: x - 40, y: y - 31, width: 80, height: 58 }, {
      radius: 0,
      fill: "#e8fff1",
      stroke: "#00a651",
      lineWidth: 3
    });
    ctx.beginPath();
    ctx.arc(x - 10, y - 2, 17, 0, Math.PI * 2);
    ctx.fillStyle = "#d7ecff";
    ctx.fill();
    ctx.strokeStyle = COLORS.pipe;
    ctx.lineWidth = 3;
    ctx.stroke();
    drawText(ctx, "S", x - 10, y - 10, { size: 17, bold: true, align: "center", color: COLORS.navy });
    ctx.beginPath();
    ctx.arc(x + 27, y - 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.yellow;
    ctx.fill();
    ctx.strokeStyle = COLORS.navy;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawText(ctx, id, x, y + 36, { size: 12, bold: true, align: "center", color: "#111827", maxWidth: 90 });
  }

  function drawPumpIcon(ctx, x, y, id, status) {
    const tone = statusTone(status);
    const fill = tone === "risk" ? "#ffe4e6" : tone === "warning" ? "#fff7ed" : tone === "safe" ? "#dcfce7" : "#f1f5f9";
    const stroke = tone === "risk" ? COLORS.red : tone === "warning" ? "#f97316" : tone === "safe" ? "#00a651" : "#94a3b8";
    fillStrokeRoundRect(ctx, { x: x - 45, y: y - 31, width: 90, height: 58 }, {
      radius: 9,
      fill,
      stroke,
      lineWidth: 3
    });
    ctx.beginPath();
    ctx.arc(x, y - 2, 18, 0, Math.PI * 2);
    ctx.fillStyle = "#e8fff1";
    ctx.fill();
    ctx.strokeStyle = "#166534";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 2, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#166534";
    ctx.fill();
    ctx.fillRect(x - 22, y + 16, 44, 8);
    drawText(ctx, id, x, y + 36, { size: 12, bold: true, align: "center", color: "#111827", maxWidth: 96 });
    fillStrokeRoundRect(ctx, { x: x - 27, y: y - 61, width: 54, height: 24 }, {
      radius: 12,
      fill: "#dcfce7",
      stroke: "#86efac"
    });
    drawText(ctx, text(status, "OK"), x, y - 56, { size: 11, bold: true, align: "center", color: "#166534", maxWidth: 48 });
  }

  function drawSinkIcon(ctx, x, y, id) {
    ctx.beginPath();
    ctx.arc(x, y - 2, 19, 0, Math.PI * 2);
    ctx.fillStyle = "#eff6ff";
    ctx.fill();
    ctx.strokeStyle = COLORS.pipe;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 23, y - 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();
    drawText(ctx, "K", x, y - 10, { size: 17, bold: true, align: "center", color: COLORS.navy });
    drawText(ctx, id, x, y + 36, { size: 12, bold: true, align: "center", color: "#111827", maxWidth: 90 });
  }

  function drawNetwork(ctx, data) {
    const y = 334;
    const sourceX = 145;
    const pumpX = 575;
    const sinkX = 965;

    ctx.strokeStyle = COLORS.pipe;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sourceX + 40, y);
    ctx.lineTo(pumpX - 45, y);
    ctx.moveTo(pumpX + 45, y);
    ctx.lineTo(sinkX - 26, y);
    ctx.stroke();

    [sourceX + 40, pumpX - 45, pumpX + 45, sinkX - 26].forEach((x) => {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.white;
      ctx.fill();
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    drawSourceIcon(ctx, sourceX, y, data.route.sourceId || "SRC");
    drawPumpIcon(ctx, pumpX, y, data.route.pumpId || "PUMP", data.pump.hydraulicStatus);
    drawSinkIcon(ctx, sinkX, y, data.route.sinkId || "SNK");

    drawMetricBubble(ctx, data.suctionPipe, 234, 194);
    drawMetricBubble(ctx, data.dischargePipe, 656, 194);
  }

  function drawReadoutPanels(ctx, data) {
    drawPanel(ctx, 18, 394, 250, [
      ["Mode", data.source.mode],
      ["SRC Input Flow", formatValue(data.source.flow, "m3/h", 3)],
      ["Source P abs", formatValue(data.source.pressure, "bar a", 3)],
      ["Source Elev.", formatValue(data.source.elevation, "m", 3)],
      ["Source Head", formatValue(data.source.head, "m", 3)]
    ], { height: 108 });

    drawPanel(ctx, 432, 392, 286, [
      ["STATUS", `${data.pump.hydraulicStatus}`],
      ["Hydraulic NPSH", statusTone(data.pump.hydraulicStatus) === "safe" ? "OK" : data.pump.hydraulicStatus],
      ["Backend Valid.", data.pump.backendStatus],
      ["", ""],
      ["SUCTION", ""],
      ["Flow", formatValue(data.pump.flow, "m3/h", 3)],
      ["Suction Press.", formatValue(data.pump.suctionPressure, "bar a", 3)],
      ["NPSH Available", formatValue(data.pump.npsha, "m", 4)],
      ["NPSH Required", formatValue(data.pump.npshr, "m", 4)],
      ["NPSH Margin", formatValue(data.pump.npshMargin, "m", 4)],
      ["NPSH Ratio", formatNumber(data.pump.npshRatio, 4)],
      ["", ""],
      ["DISCHARGE", ""],
      ["Discharge Press.", formatValue(data.pump.dischargePressure, "bar a", 3)],
      ["Required Head", formatValue(data.pump.head, "m", 3)]
    ], { height: 262 });

    drawPanel(ctx, 834, 396, 250, [
      ["Mode", data.sink.mode],
      ["Sink Flow", formatValue(data.sink.flow, "m3/h", 3)],
      ["Sink P abs", formatValue(data.sink.pressure, "bar a", 3)],
      ["Sink Elev.", formatValue(data.sink.elevation, "m", 3)],
      ["Sink Head", formatValue(data.sink.head, "m", 3)]
    ], { height: 108 });
  }

  function renderReadableModelSnapshot(data, options = {}) {
    const width = options.width || SNAPSHOT_WIDTH;
    const height = options.height || SNAPSHOT_HEIGHT;
    const canvas = createCanvas(width, height);
    const ctx = canvas?.getContext?.("2d");
    if (!canvas || !ctx) throw new Error("Canvas 2D context is unavailable.");
    ctx.save();
    if (width !== SNAPSHOT_WIDTH || height !== SNAPSHOT_HEIGHT) {
      ctx.scale(width / SNAPSHOT_WIDTH, height / SNAPSHOT_HEIGHT);
    }
    drawGrid(ctx);
    drawFluidHeader(ctx, data);
    drawNetwork(ctx, data);
    drawReadoutPanels(ctx, data);
    ctx.restore();
    return canvas.toDataURL("image/png");
  }

  async function captureReadableModelSnapshot(options = {}) {
    try {
      const data = buildSnapshotData(options);
      const dataUrl = renderReadableModelSnapshot(data, options);
      return {
        dataUrl,
        status: "captured-readable-model-snapshot",
        width: options.width || SNAPSHOT_WIDTH,
        height: options.height || SNAPSHOT_HEIGHT,
        meta: {
          version: VERSION,
          route: data.route,
          display: "fluid-basis-route-diagram"
        }
      };
    } catch (error) {
      if (typeof originalCapture === "function" && originalCapture !== captureReadableModelSnapshot) {
        return originalCapture.call(root, options);
      }
      if (root.console?.warn) {
        root.console.warn("Readable model snapshot could not be captured for export.", error);
      }
      return {
        dataUrl: "",
        status: "failed",
        reason: error?.message || "Readable model snapshot failed."
      };
    }
  }

  async function captureFluidBasisWorkspaceSnapshot(options = {}) {
    await preparePipeParameterLabelsForSnapshot();
    try {
      const domSnapshot = await captureVisibleWorkspaceDomSnapshot(options);
      if (domSnapshot?.dataUrl) return domSnapshot;
    } catch (error) {
      root.console?.warn?.("Visible workspace DOM crop could not be captured; using native canvas fallback.", error);
    }
    if (typeof originalCapture !== "function" || originalCapture === captureFluidBasisWorkspaceSnapshot) {
      return captureReadableModelSnapshot(options);
    }
    const baseSnapshot = await originalCapture.call(root, options);
    if (!baseSnapshot?.dataUrl || typeof root.document === "undefined") {
      return baseSnapshot;
    }
    try {
      const dockSnapshot = await captureFluidBasisDockImage(options);
      if (!dockSnapshot?.dataUrl) return baseSnapshot;
      return await composeFluidBasisWorkspaceSnapshot(baseSnapshot, dockSnapshot, options);
    } catch (error) {
      root.console?.warn?.("Fluid Basis workspace snapshot crop could not be composed; using native canvas snapshot.", error);
      return baseSnapshot;
    }
  }

  function install(options = {}) {
    if (!installed) {
      originalCapture = typeof root.captureScenarioCanvasSnapshot === "function"
        ? root.captureScenarioCanvasSnapshot
        : null;
      root.captureScenarioReadableModelSnapshot = captureReadableModelSnapshot;
      root.captureScenarioFluidBasisWorkspaceSnapshot = captureFluidBasisWorkspaceSnapshot;
      root.__npshFluidBasisWorkspaceSnapshotInstalled = VERSION;
      installed = true;
    }
    if (options.useReadableSnapshot === true) {
      root.captureScenarioCanvasSnapshot = captureReadableModelSnapshot;
      root.__npshReadableModelSnapshotInstalled = VERSION;
    } else {
      root.captureScenarioCanvasSnapshot = captureFluidBasisWorkspaceSnapshot;
    }
    return api;
  }

  const api = {
    version: VERSION,
    buildSnapshotData,
    captureFluidBasisWorkspaceSnapshot,
    captureVisibleWorkspaceDomSnapshot,
    captureReadableModelSnapshot,
    renderReadableModelSnapshot,
    visiblePipeParameterLabelInfo,
    resolveVisibleWorkspaceCropRect,
    resolvePipeCaptionData,
    drawPipeParameterCaption,
    resolveRouteIds,
    statusTone,
    install
  };

  install();
  return api;
});
