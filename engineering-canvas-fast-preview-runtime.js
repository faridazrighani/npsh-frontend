!function registerEngineeringCanvasFastPreviewRuntime(root) {
  "use strict";

  const VERSION = "2026.07-canvas-fast-preview21";
  const GRAVITY_MS2 = 9.80665;
  const NPSHR_NOT_PROVIDED_STATUS = "NPSHr Not Provided";
  const SUCTION_VAPOR_WARNING_HEAD_M = 0.5;
  const SUCTION_VAPOR_WARNING_BAR = 0.05;
  const PUMP_PANEL_SELECTOR = ".pump-live-params";
  const SINK_PANEL_SELECTOR = ".sink-live-params";
  const CALCULATION_TARGET_SELECTOR = [
    "#fluid-task-temp",
    "input",
    "select",
    "textarea",
    "[contenteditable='true']"
  ].join(",");
  const PREVIEW_EVENTS = [
    "npsh:calculation-dependency-changed",
    "npsh:realtime-autosolve-scheduled",
    "npsh:input-lightweight-update"
  ];
  const AUTHORITATIVE_EVENTS = [
    "npsh:calculation-current",
    "npsh:realtime-autosolve-complete"
  ];

  const pumpBaselines = new Map();
  let previewFrame = 0;
  let previewPulseTimer = 0;
  let previewPulseUntil = 0;
  let immediatePanelStampTimer = 0;
  let panelStampDeferredUntil = 0;
  let installAttempts = 0;
  let installSupportSignature = "";

  function model() {
    return root.globalModel || root.__npshGlobalModel || {};
  }

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function finiteNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined || value === "") return null;
    const match = String(value).replace(",", ".").match(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/i);
    if (!match) return null;
    const number = Number.parseFloat(match[0]);
    return Number.isFinite(number) ? number : null;
  }

  function firstFiniteValue(...values) {
    for (const value of values) {
      const number = finiteNumber(value);
      if (number !== null) return number;
    }
    return null;
  }

  function isPreviewWindowOpen(now = Date.now()) {
    return now < previewPulseUntil;
  }

  function firstTextValue(...values) {
    for (const value of values) {
      const text = normalizeText(value);
      if (text && text !== "-") return text;
    }
    return "";
  }

  function normalizeBackendValidationStatusForMatrix(...values) {
    const raw = firstTextValue(...values);
    if (!raw) return "Unverified";
    if (/calculating|solv(?:e|ing)|pending|in\s*progress/i.test(raw)) return "Calculating";
    if (/stale|out[\s-]*of[\s-]*date|prior/i.test(raw)) return "Stale";
    if (/timeout|timed\s*out/i.test(raw)) return "Timeout";
    if (/unavailable|unusable|invalid|failed|error|unverified|not\s*usable|api/i.test(raw)) return "Unavailable";
    if (/connected|current|matched|usable|protected|backend/i.test(raw)) return "Connected";
    return raw;
  }

  function normalizeHydraulicNpshStatusForMatrix(...values) {
    const raw = firstTextValue(...values);
    if (!raw) return "";
    if (/incomplete|input\s*required|unknown|not\s*connected|incomplete\s*network|incomplete\s*calculation/i.test(raw)) return "Incomplete";
    if (/cavitation|npsh\s*risk|risk|unsafe|fail/i.test(raw)) return "Cavitation Risk";
    if (/warning|review|near\s*vapor/i.test(raw)) return "Warning";
    if (/not\s*provided|npshr\s*not\s*provided|manual\s*npshr|npsha\s*calculated/i.test(raw)) return NPSHR_NOT_PROVIDED_STATUS;
    if (/safe|ok|pass/i.test(raw)) return "OK";
    return raw;
  }

  function nonNegativeOrZero(value) {
    const number = finiteNumber(value);
    return number !== null && number >= 0 ? number : 0;
  }

  function optionalManualNpshr(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    return nonNegativeOrZero(value);
  }

  function fixed(value, digits = 3) {
    const number = finiteNumber(value);
    if (number === null) return "-";
    return number.toFixed(digits);
  }

  function withUnit(value, unit = "", digits = 3) {
    const text = fixed(value, digits);
    return text === "-" || !unit ? text : `${text} ${unit}`;
  }

  function signedWithUnit(value, unit = "", digits = 3) {
    const number = finiteNumber(value);
    if (number === null) return "-";
    const text = `${number > 0 ? "+" : ""}${number.toFixed(digits)}`;
    return unit ? `${text} ${unit}` : text;
  }

  function syncFluidBasisQuietly() {
    const fluidNode = model()?.FLUID;
    if (typeof root.syncFluidBasisPropertiesFromTemperature !== "function" || !fluidNode) return null;
    try {
      return root.syncFluidBasisPropertiesFromTemperature(fluidNode);
    } catch (error) {
      root.__engineeringCanvasFastPreviewFluidSyncError = error;
      return null;
    }
  }

  function syncFluidTemperatureInputToModel() {
    if (typeof document === "undefined") return false;
    const input = document.querySelector("#fluid-task-temp, input.prop-input-field[data-key='temp'][data-node='FLUID'], input[data-key='temp'][data-node='FLUID']");
    const temperature = finiteNumber(input?.value);
    const fluidNode = model()?.FLUID;
    if (temperature === null || !fluidNode?.props) return false;
    if (fluidNode.props.temp === temperature && fluidNode.props.temperature === temperature) return false;
    fluidNode.props.temp = temperature;
    fluidNode.props.temperature = temperature;
    fluidNode.props.temperaturePropertySyncRequested = true;
    return true;
  }

  function fluidProps() {
    const props = model()?.FLUID?.props || {};
    const resolved = typeof root.getTemperatureResolvedFluidBasisProps === "function"
      ? root.getTemperatureResolvedFluidBasisProps(props)
      : props;
    const density = firstFiniteValue(resolved?.density, props.density, 1000);
    const vaporPressureBarA = firstFiniteValue(resolved?.vaporPressure, props.vaporPressure, 0);
    const vaporPressureHead = firstFiniteValue(
      resolved?.vaporPressureHead,
      props.vaporPressureHead,
      density && density > 0 ? 100000 * Math.max(0, vaporPressureBarA || 0) / (density * GRAVITY_MS2) : null
    );
    return {
      density,
      vaporPressureBarA,
      vaporPressureHead,
      temperatureDegC: firstFiniteValue(resolved?.temp, resolved?.temperature, props.temp, props.temperature)
    };
  }

  function nodeIdForPanel(panel, type) {
    const modelRef = model();
    const object = panel?.closest?.(".pfd-object, [data-node-id], [data-object-id]");
    const candidates = [
      panel?.dataset?.nodeId,
      panel?.dataset?.objectId,
      panel?.dataset?.pumpId,
      panel?.dataset?.sinkId,
      object?.dataset?.nodeId,
      object?.dataset?.objectId,
      object?.dataset?.pumpId,
      object?.dataset?.sinkId,
      object?.id
    ].map(normalizeText).filter(Boolean);
    for (const id of candidates) {
      if (modelRef?.[id]?.type === type) return id;
    }
    const objectText = normalizeText(object?.textContent || panel?.textContent || "");
    const matches = Object.entries(modelRef || {}).filter(([id, node]) => (
      node?.type === type && (objectText.includes(id) || (node.name && objectText.includes(node.name)))
    ));
    if (matches.length === 1) return matches[0][0];
    const all = Object.entries(modelRef || {}).filter(([, node]) => node?.type === type);
    return all.length === 1 ? all[0][0] : "";
  }

  function connectionList(modelRef = model()) {
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

  function isHydraulicConnection(connection = {}) {
    const type = normalizeText(connection.connectionType || connection.type).toLowerCase();
    return !type || type === "hydraulic" || /process|pipe|flow/.test(type);
  }

  function connectionFrom(connection = {}) {
    return normalizeText(connection.from || connection.source || connection.fromNode || connection.rawFrom || connection.start || connection.sourceId);
  }

  function connectionTo(connection = {}) {
    return normalizeText(connection.to || connection.target || connection.toNode || connection.rawTo || connection.end || connection.targetId);
  }

  function connectionPipeId(connection = {}) {
    return normalizeText(connection.pipeId || connection.pipe || connection.lineId || connection.linkId || connection.edgeId);
  }

  function nodeType(modelRef, nodeId) {
    return normalizeText(modelRef?.[nodeId]?.type).toLowerCase();
  }

  function isSuctionBoundaryType(type) {
    return type === "source" || type === "tank" || type === "verticalvessel" || type === "horizontalvessel" || type === "separator";
  }

  function isDischargeBoundaryType(type) {
    return type === "sink";
  }

  function nodeIdForModelNode(node, type = "") {
    const modelRef = model();
    const matches = Object.entries(modelRef || {}).filter(([, candidate]) => (
      candidate === node || (
        candidate?.type === (type || candidate?.type)
        && node?.name
        && candidate?.name === node.name
      )
    ));
    return matches.length === 1 ? matches[0][0] : "";
  }

  function hasHydraulicConnectionForNode(nodeId, modelRef = model()) {
    if (!nodeId) return false;
    return connectionList(modelRef).some((connection) => (
      isHydraulicConnection(connection)
      && (connectionFrom(connection) === nodeId || connectionTo(connection) === nodeId)
    ));
  }

  function hasCompletePumpDischargeRoute(pumpId, modelRef = model()) {
    if (!pumpId) return false;
    const suctionConnection = connectionList(modelRef).find((connection) => (
      isHydraulicConnection(connection)
      && connectionTo(connection) === pumpId
      && isSuctionBoundaryType(nodeType(modelRef, connectionFrom(connection)))
      && modelRef?.[connectionPipeId(connection)]?.type === "pipe"
    ));
    const dischargeConnection = connectionList(modelRef).find((connection) => (
      isHydraulicConnection(connection)
      && connectionFrom(connection) === pumpId
      && isDischargeBoundaryType(nodeType(modelRef, connectionTo(connection)))
      && modelRef?.[connectionPipeId(connection)]?.type === "pipe"
    ));
    const dischargePipe = modelRef?.[connectionPipeId(dischargeConnection || {})];
    const dischargeBoundary = modelRef?.[connectionTo(dischargeConnection || {})];
    return !!(suctionConnection && dischargeConnection && dischargePipe && dischargeBoundary);
  }

  function pumpResultView(pump = {}) {
    const results = pump.results || {};
    const evaluation = results.npshEvaluation || {};
    const trace = results.calculationTrace || evaluation.calculationTrace || {};
    const basis = trace.basis || {};
    const props = pump.props || {};
    const pumpId = nodeIdForModelNode(pump, "pump");
    const propsNpshr = optionalManualNpshr(props.manualNpshr);
    const downstreamDutyAvailable = propsNpshr !== null && hasCompletePumpDischargeRoute(pumpId);
    const resultNpshr = propsNpshr === null
      ? null
      : firstFiniteValue(results.npshr, results.npshRequired, evaluation.npshr, evaluation.npshRequired);
    return {
      flow: firstFiniteValue(results.flow, results.flowM3H, evaluation.flow, evaluation.flowM3H, pump.props?.designFlow, pump.props?.flow),
      npsha: firstFiniteValue(results.npsha, results.npshAvailable, evaluation.npsha, evaluation.npshAvailable),
      npshr: firstFiniteValue(propsNpshr, resultNpshr),
      npshMargin: propsNpshr === null ? null : firstFiniteValue(results.npshMargin, evaluation.npshMargin),
      npshRatio: propsNpshr === null ? null : firstFiniteValue(results.npshRatio, evaluation.npshRatio),
      suctionPressure: firstFiniteValue(results.suctionPressure, evaluation.suctionPressure, trace.boundary?.suctionPressure),
      dischargePressure: !downstreamDutyAvailable
        ? null
        : firstFiniteValue(results.dischargePressure, evaluation.dischargePressure, trace.boundary?.dischargePressure),
      pumpHead: firstFiniteValue(results.pumpHead, results.head, evaluation.pumpHead, evaluation.head),
      requiredSystemHead: !downstreamDutyAvailable
        ? null
        : firstFiniteValue(
          results.requiredSystemHeadRaw,
          evaluation.requiredSystemHeadRaw,
          trace.systemHead?.requiredHeadRaw,
          results.requiredSystemHead,
          evaluation.requiredSystemHead,
          trace.systemHead?.requiredHead,
          results.systemHead?.requiredHead
        ),
      hydraulicStatus: firstTextValue(
        results.hydraulicNpshStatus,
        results.cavitationStatus,
        evaluation.hydraulicStatus,
        evaluation.status,
        trace.interpretation?.hydraulicStatus,
        results.status
      ),
      backendStatus: firstTextValue(
        results.backendValidationStatus,
        evaluation.backendValidationStatus,
        results.backendParity?.status === "matched" ? "Connected" : "",
        results.backendCalculationSource && !/unavailable|timeout/i.test(results.backendCalculationSource) ? "Connected" : ""
      ),
      vaporPressureHead: firstFiniteValue(
        results.vaporPressureHead,
        evaluation.vaporPressureHead,
        results.npshEvaluation?.vaporPressureHead,
        basis.vaporPressureHead,
        basis.vaporPressureHeadM,
        basis.vaporPressureHeadMeters,
        evaluation.calculationTrace?.basis?.vaporPressureHead,
        evaluation.calculationTrace?.basis?.vaporPressureHeadM
      )
    };
  }

  function capturePumpBaseline(pumpId, pumpNode, options = {}) {
    if (!pumpId || pumpNode?.type !== "pump") return false;
    if (options.preservePreviewFluidBasis && pumpNode?.results?.__canvasFastPreviewTransient) return false;
    const view = pumpResultView(pumpNode);
    const fluid = fluidProps();
    const prior = pumpBaselines.get(pumpId);
    const npsha = view.npsha;
    if (npsha === null) return false;
    const preservePreviewFluidBasis = !!options.preservePreviewFluidBasis;
    pumpBaselines.set(pumpId, {
      npsha,
      npshr: view.npshr,
      npshMargin: view.npshMargin,
      npshRatio: view.npshRatio,
      vaporPressureHead: firstFiniteValue(
        view.vaporPressureHead,
        preservePreviewFluidBasis ? prior?.vaporPressureHead : null,
        fluid.vaporPressureHead,
        prior?.vaporPressureHead,
        0
      ),
      flow: view.flow,
      suctionPressure: view.suctionPressure,
      dischargePressure: view.dischargePressure,
      pumpHead: view.pumpHead,
      requiredSystemHead: view.requiredSystemHead,
      hydraulicStatus: view.hydraulicStatus,
      backendStatus: view.backendStatus,
      capturedAt: Date.now()
    });
    return true;
  }

  function captureAuthoritativeBaselines(options = {}) {
    const modelRef = model();
    let captured = 0;
    Object.entries(modelRef || {}).forEach(([id, node]) => {
      if (node?.type === "pump" && capturePumpBaseline(id, node, options)) captured += 1;
    });
    return captured;
  }

  function pumpRowByLabel(panel, label) {
    const wanted = normalizeText(label);
    return Array.from(panel?.querySelectorAll?.(".pump-live-param-row") || []).find((row) => (
      normalizeText(row.querySelector?.(".pump-live-param-label")?.textContent) === wanted
    )) || null;
  }

  function setRowValue(row, formattedValue) {
    if (!row) return 0;
    const valueElement = row.querySelector?.(".pump-live-param-value, strong, .sink-live-param-value");
    if (!valueElement) return 0;
    const unitElement = row.querySelector?.(".pump-live-param-unit, .sink-live-param-unit");
    const unit = normalizeText(unitElement?.textContent);
    let next = normalizeText(formattedValue);
    if (unit && next.endsWith(` ${unit}`)) next = next.slice(0, -unit.length - 1);
    if (valueElement.textContent === next) return 0;
    valueElement.textContent = next;
    return 1;
  }

  function suctionVaporGuardForPreview(npsha, suctionPressureBarA, fluid = {}) {
    const vaporPressureBarA = finiteNumber(fluid.vaporPressureBarA);
    const density = firstFiniteValue(fluid.density, 1000);
    const pressure = finiteNumber(suctionPressureBarA);
    const marginBar = pressure !== null && vaporPressureBarA !== null ? pressure - vaporPressureBarA : null;
    const marginHeadByPressure = marginBar !== null && density > 0
      ? marginBar * 100000 / (density * GRAVITY_MS2)
      : null;
    const marginHead = firstFiniteValue(marginHeadByPressure, npsha);
    if (marginBar === null && marginHead === null) return { status: "Unknown", warning: false, risk: false };
    if ((marginBar !== null && marginBar <= 0) || (marginHead !== null && marginHead <= 0)) {
      return { status: "Cavitation Risk", warning: true, risk: true, marginBar, marginHead };
    }
    if ((marginBar !== null && marginBar <= SUCTION_VAPOR_WARNING_BAR) || (marginHead !== null && marginHead <= SUCTION_VAPOR_WARNING_HEAD_M)) {
      return { status: "Warning", warning: true, risk: false, marginBar, marginHead };
    }
    return { status: "Safe", warning: false, risk: false, marginBar, marginHead };
  }

  function isPanelStampDeferred(now = Date.now()) {
    return now < panelStampDeferredUntil;
  }

  function stampPumpPanelPreview(panel, pumpId) {
    if (!panel) return;
    if (isPanelStampDeferred()) {
      panel.dataset.canvasFastPreviewPending = VERSION;
      panel.dataset.canvasFastPreview = `${VERSION}-pending`;
      panel.closest?.(".pfd-object")?.setAttribute("data-canvas-fast-preview", `${VERSION}-pending`);
      return;
    }
    panel.dataset.canvasFastPreview = VERSION;
    delete panel.dataset.canvasFastPreviewPending;
    panel.dataset.canvasFastPreviewPumpId = pumpId;
    panel.closest?.(".pfd-object")?.setAttribute("data-canvas-fast-preview", VERSION);
  }

  function markPumpPanelsPreviewPending(scope = document) {
    let marked = 0;
    scope?.querySelectorAll?.(PUMP_PANEL_SELECTOR).forEach((panel) => {
      panel.dataset.canvasFastPreviewPending = VERSION;
      panel.dataset.canvasFastPreview = `${VERSION}-pending`;
      panel.closest?.(".pfd-object")?.setAttribute("data-canvas-fast-preview", `${VERSION}-pending`);
      marked += 1;
    });
    return marked;
  }

  function hydraulicStatusForPreview(npsha, npshr, fallback = "", suctionVaporGuard = null) {
    const required = finiteNumber(npshr);
    const available = finiteNumber(npsha);
    const normalizedFallback = normalizeHydraulicNpshStatusForMatrix(fallback);
    if (required === null) {
      if (available === null) return normalizedFallback || "-";
      if (suctionVaporGuard?.risk) return "Cavitation Risk";
      if (suctionVaporGuard?.warning) return "Warning";
      return NPSHR_NOT_PROVIDED_STATUS;
    }
    if (available === null) return normalizedFallback || "-";
    if (suctionVaporGuard?.risk) return "Cavitation Risk";
    if (available >= required) return suctionVaporGuard?.warning ? "Warning" : "OK";
    return "Cavitation Risk";
  }

  function isManualNpshrFastLaneActive(pumpId = "") {
    const state = root.__engineeringPumpEditFastLane || {};
    if (state.field !== "manualNpshr" && state.field !== "npshr") return false;
    if (Number(state.activeUntil || 0) && Date.now() > Number(state.activeUntil || 0)) return false;
    if (state.pumpId && pumpId && state.pumpId !== pumpId) return false;
    return true;
  }

  function applyTransientPumpPreview(pumpNode, preview = {}) {
    if (!pumpNode || typeof pumpNode !== "object") return false;
    const results = pumpNode.results && typeof pumpNode.results === "object"
      ? pumpNode.results
      : (pumpNode.results = {});
    const evaluation = results.npshEvaluation && typeof results.npshEvaluation === "object"
      ? results.npshEvaluation
      : (results.npshEvaluation = {});
    const npsha = finiteNumber(preview.npsha);
    if (npsha === null) return false;
    if (preview.writeNpsha !== false) {
      results.npsha = npsha;
      results.npshAvailable = npsha;
      evaluation.npsha = npsha;
      evaluation.npshAvailable = npsha;
    }
    if (preview.npshr === null) {
      results.npshr = null;
      results.npshRequired = null;
      results.npshMargin = null;
      results.npshRatio = null;
      evaluation.npshr = null;
      evaluation.npshRequired = null;
      evaluation.npshMargin = null;
      evaluation.npshRatio = null;
    } else {
      results.npshr = preview.npshr;
      results.npshRequired = preview.npshr;
      evaluation.npshr = preview.npshr;
      evaluation.npshRequired = preview.npshr;
      results.npshMargin = preview.margin;
      results.npshRatio = preview.ratio;
      evaluation.npshMargin = preview.margin;
      evaluation.npshRatio = preview.ratio;
    }
    if (preview.status) {
      results.hydraulicNpshStatus = preview.status;
      results.cavitationStatus = preview.status;
      evaluation.hydraulicStatus = preview.status;
      evaluation.status = preview.status;
    }
    results.__canvasFastPreviewTransient = {
      version: VERSION,
      npsha,
      npshr: preview.npshr,
      npshMargin: preview.margin,
      npshRatio: preview.ratio,
      vaporPressureHead: preview.currentVaporHead,
      appliedAt: Date.now()
    };
    return true;
  }

  function previewPumpPanel(panel) {
    const pumpId = nodeIdForPanel(panel, "pump");
    const pumpNode = pumpId ? model()?.[pumpId] : null;
    if (!pumpNode || pumpNode.type !== "pump") return 0;
    const view = pumpResultView(pumpNode);
    const fluid = fluidProps();
    const baseline = pumpBaselines.get(pumpId);
    const manualNpshrPreviewOnly = isManualNpshrFastLaneActive(pumpId);
    const baselineNpsha = firstFiniteValue(baseline?.npsha, view.npsha);
    const baselineVaporHead = firstFiniteValue(baseline?.vaporPressureHead, view.vaporPressureHead, fluid.vaporPressureHead, 0);
    const currentVaporHead = firstFiniteValue(fluid.vaporPressureHead, baselineVaporHead, 0);
    const previewNpsha = manualNpshrPreviewOnly
      ? firstFiniteValue(view.npsha, baseline?.npsha)
      : baselineNpsha === null
      ? view.npsha
      : baselineNpsha + baselineVaporHead - currentVaporHead;
    const npshrRaw = view.npshr;
    const npshr = npshrRaw === null ? null : nonNegativeOrZero(npshrRaw);
    const margin = previewNpsha === null || npshr === null ? null : previewNpsha - npshr;
    const ratio = previewNpsha === null || !npshr ? null : previewNpsha / npshr;
    const isHydraulicallyConnected = hasHydraulicConnectionForNode(pumpId);
    const downstreamDutyAvailable = npshr !== null && hasCompletePumpDischargeRoute(pumpId);
    const suctionPressure = firstFiniteValue(view.suctionPressure, baseline?.suctionPressure);
    const dischargePressure = downstreamDutyAvailable
      ? firstFiniteValue(view.dischargePressure, baseline?.dischargePressure)
      : null;
    const requiredSystemHead = downstreamDutyAvailable
      ? firstFiniteValue(view.requiredSystemHead, baseline?.requiredSystemHead)
      : null;
    const suctionVaporGuard = suctionVaporGuardForPreview(previewNpsha, suctionPressure, fluid);
    const status = isHydraulicallyConnected
      ? hydraulicStatusForPreview(previewNpsha, npshr, view.hydraulicStatus || baseline?.hydraulicStatus || "", suctionVaporGuard)
      : "Incomplete";
    const backendStatus = isHydraulicallyConnected
      ? normalizeBackendValidationStatusForMatrix(view.backendStatus, baseline?.backendStatus)
      : "Unverified";
    const transientApplied = applyTransientPumpPreview(pumpNode, {
      npsha: previewNpsha,
      npshr,
      margin,
      ratio,
      status,
      currentVaporHead,
      writeNpsha: !manualNpshrPreviewOnly
    });

    let changed = 0;
    stampPumpPanelPreview(panel, pumpId);
    changed += setRowValue(pumpRowByLabel(panel, "Flow"), withUnit(firstFiniteValue(view.flow, baseline?.flow), "m3/h", 2));
    changed += setRowValue(pumpRowByLabel(panel, "NPSH Available"), withUnit(previewNpsha, "m", 4));
    changed += setRowValue(pumpRowByLabel(panel, "NPSH Required"), npshr === null ? "-" : withUnit(npshr, "m", 4));
    changed += setRowValue(pumpRowByLabel(panel, "NPSH Margin"), margin === null ? "-" : signedWithUnit(margin, "m", 4));
    changed += setRowValue(pumpRowByLabel(panel, "NPSH Ratio"), ratio === null ? "-" : fixed(ratio, 4));
    changed += setRowValue(pumpRowByLabel(panel, "Hydraulic NPSH"), status);
    changed += setRowValue(pumpRowByLabel(panel, "Backend Valid."), backendStatus);
    changed += setRowValue(pumpRowByLabel(panel, "Suction Press."), withUnit(suctionPressure, "bar a", 3));
    changed += setRowValue(pumpRowByLabel(panel, "Discharge Press."), withUnit(dischargePressure, "bar a", 3));
    changed += setRowValue(pumpRowByLabel(panel, "Required Head"), withUnit(requiredSystemHead, "m", 3));

    root.__engineeringCanvasFastPreviewLastPumpPreview = {
      version: VERSION,
      pumpId,
      changed,
      baselineNpsha,
      baselineVaporHead,
      currentVaporHead,
      previewNpsha,
      npshr,
      margin,
      ratio,
      suctionPressure,
      status,
      transientApplied,
      manualNpshrPreviewOnly,
      previewWindowOpen: isPreviewWindowOpen(),
      previewedAt: Date.now()
    };
    return changed;
  }

  function refreshPumpPanels(scope = document) {
    let changed = 0;
    scope?.querySelectorAll?.(PUMP_PANEL_SELECTOR).forEach((panel) => {
      changed += previewPumpPanel(panel);
    });
    return changed;
  }

  function refreshPipeLabels(scope = document) {
    let changed = 0;
    const api = root.EngineeringPipeCanvasHydraulicLabelRuntime;
    try {
      if (typeof api?.runImmediateRefresh === "function") {
        changed += api.runImmediateRefresh({ force: true }) || 0;
      } else if (typeof api?.refresh === "function") {
        changed += api.refresh(scope) || 0;
      } else if (typeof root.refreshPipeCanvasHydraulicLabels === "function") {
        changed += root.refreshPipeCanvasHydraulicLabels(scope) || 0;
      }
      scope?.querySelectorAll?.("#svg-lines .pipe-hydraulic-label").forEach((label) => {
        label.dataset.canvasFastPreview = VERSION;
      });
    } catch (error) {
      root.__engineeringCanvasFastPreviewPipeError = error;
    }
    return changed;
  }

  function stampExistingPipeAndSinkPreview(scope = document) {
    let stamped = 0;
    let pipeLabels = 0;
    let sinkPanels = 0;
    try {
      scope?.querySelectorAll?.("#svg-lines .pipe-hydraulic-label, .pipe-hydraulic-label").forEach((label) => {
        pipeLabels += 1;
        if (label.getAttribute?.("data-canvas-fast-preview") !== VERSION) {
          label.setAttribute?.("data-canvas-fast-preview", VERSION);
          if (label.dataset) label.dataset.canvasFastPreview = VERSION;
          stamped += 1;
        }
      });
      scope?.querySelectorAll?.(SINK_PANEL_SELECTOR).forEach((panel) => {
        sinkPanels += 1;
        if (panel.getAttribute?.("data-canvas-fast-preview") !== VERSION) {
          panel.setAttribute?.("data-canvas-fast-preview", VERSION);
          if (panel.dataset) panel.dataset.canvasFastPreview = VERSION;
          stamped += 1;
        }
      });
      root.__engineeringCanvasFastPreviewLastStamp = {
        version: VERSION,
        stamped,
        pipeLabels,
        sinkPanels,
        stampedAt: Date.now()
      };
    } catch (error) {
      root.__engineeringCanvasFastPreviewStampError = error;
    }
    return stamped;
  }

  function refreshSinkPanels(scope = document) {
    const api = root.EngineeringRouteTraceAudit;
    let changed = 0;
    try {
      if (typeof api?.normalizeDefaultSinkCanvasRows === "function") changed += api.normalizeDefaultSinkCanvasRows(scope) || 0;
      if (typeof api?.ensureDefaultSinkCanvasRows === "function") changed += api.ensureDefaultSinkCanvasRows(scope) || 0;
      scope?.querySelectorAll?.(SINK_PANEL_SELECTOR).forEach((panel) => {
        panel.dataset.canvasFastPreview = VERSION;
      });
    } catch (error) {
      root.__engineeringCanvasFastPreviewSinkError = error;
    }
    return changed;
  }

  function runPreview(reason = "preview") {
    if (typeof document === "undefined") return { changed: 0, reason };
    syncFluidTemperatureInputToModel();
    syncFluidBasisQuietly();
    const changed = refreshPumpPanels(document) + refreshPipeLabels(document) + refreshSinkPanels(document);
    document.documentElement.dataset.canvasFastPreviewRuntime = VERSION;
    document.documentElement.dataset.canvasFastPreviewReason = String(reason || "preview");
    document.documentElement.dataset.canvasFastPreviewAt = String(Date.now());
    return { changed, reason, version: VERSION };
  }

  function finalizeImmediatePanelStamp(reason = "input:finalize") {
    if (typeof document === "undefined") return { changed: 0, reason };
    panelStampDeferredUntil = 0;
    const changed = stampExistingPipeAndSinkPreview(document);
    document.querySelectorAll?.(PUMP_PANEL_SELECTOR).forEach((panel) => {
      const pumpId = nodeIdForPanel(panel, "pump");
      stampPumpPanelPreview(panel, pumpId);
    });
    document.documentElement.dataset.canvasFastPreviewRuntime = VERSION;
    document.documentElement.dataset.canvasFastPreviewReason = String(reason || "input:finalize");
    document.documentElement.dataset.canvasFastPreviewAt = String(Date.now());
    return { changed, reason, version: VERSION, finalized: true };
  }

  function runImmediatePumpPreview(reason = "input") {
    if (typeof document === "undefined") return { changed: 0, reason };
    syncFluidTemperatureInputToModel();
    syncFluidBasisQuietly();
    panelStampDeferredUntil = Math.max(panelStampDeferredUntil, Date.now() + 100);
    markPumpPanelsPreviewPending(document);
    const changed = stampExistingPipeAndSinkPreview(document)
      + refreshPumpPanels(document)
      + stampExistingPipeAndSinkPreview(document);
    if (!immediatePanelStampTimer) {
      immediatePanelStampTimer = root.setTimeout?.(() => {
        immediatePanelStampTimer = 0;
        finalizeImmediatePanelStamp(`${reason}:finalize`);
      }, 90) || 0;
    }
    document.documentElement.dataset.canvasFastPreviewRuntime = VERSION;
    document.documentElement.dataset.canvasFastPreviewReason = String(reason || "input");
    document.documentElement.dataset.canvasFastPreviewAt = String(Date.now());
    return { changed, reason, version: VERSION, immediate: true };
  }

  function requestPreview(reason = "input") {
    if (typeof document === "undefined") return null;
    if (previewFrame && typeof root.cancelAnimationFrame === "function") {
      root.cancelAnimationFrame(previewFrame);
    }
    const schedule = typeof root.requestAnimationFrame === "function"
      ? root.requestAnimationFrame.bind(root)
      : (callback) => root.setTimeout(callback, 0);
    previewFrame = schedule(() => {
      previewFrame = 0;
      runPreview(reason);
    });
    return previewFrame;
  }

  function schedulePreviewPulse(reason) {
    if (typeof root.setTimeout !== "function") return;
    root.clearTimeout?.(previewPulseTimer);
    if (Date.now() >= previewPulseUntil) {
      previewPulseTimer = 0;
      return;
    }
    previewPulseTimer = root.setTimeout(() => {
      requestPreview(reason);
      schedulePreviewPulse(reason);
    }, 80);
  }

  function beginPreviewWindow(reason = "input", durationMs = 1800, immediate = false) {
    previewPulseUntil = Math.max(previewPulseUntil, Date.now() + durationMs);
    if (immediate) {
      panelStampDeferredUntil = Math.max(panelStampDeferredUntil, Date.now() + 100);
      markPumpPanelsPreviewPending(document);
    }
    if (immediate) runImmediatePumpPreview(`${reason}:immediate`);
    requestPreview(reason);
    schedulePreviewPulse(reason);
  }

  function isImmediateFluidTemperatureInput(target) {
    return !!target?.matches?.("#fluid-task-temp, input.prop-input-field[data-key='temp'][data-node='FLUID'], input[data-key='temp'][data-node='FLUID']");
  }

  function endPreviewWindow() {
    previewPulseUntil = 0;
    root.clearTimeout?.(previewPulseTimer);
    previewPulseTimer = 0;
  }

  function isCalculationTarget(target) {
    if (!target?.matches?.(CALCULATION_TARGET_SELECTOR)) return false;
    if (target.closest?.(".task-window, #taskWindow, .object-properties-task-body, .fluid-help-body")) return true;
    return target.matches?.("#fluid-task-temp, input[data-node], select[data-node], textarea[data-node], [data-key], [data-field]");
  }

  function installEvents() {
    if (typeof document === "undefined" || document.documentElement?.dataset.canvasFastPreviewEvents === VERSION) return false;
    document.documentElement.dataset.canvasFastPreviewEvents = VERSION;
    ["input", "change"].forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        if (isCalculationTarget(event.target)) beginPreviewWindow(eventName, 1800, isImmediateFluidTemperatureInput(event.target));
      }, true);
    });
    PREVIEW_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, (event) => {
        const immediate = eventName === "npsh:input-lightweight-update";
        beginPreviewWindow(event?.detail?.sourceEvent || eventName, 1800, immediate);
      }, true);
    });
    AUTHORITATIVE_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, () => {
        const preservePreviewFluidBasis = isPreviewWindowOpen();
        root.setTimeout?.(() => {
          captureAuthoritativeBaselines({ preservePreviewFluidBasis });
          endPreviewWindow();
          requestPreview(eventName);
        }, 0);
      }, true);
    });
    return true;
  }

  function install() {
    if (typeof document === "undefined") {
      captureAuthoritativeBaselines();
      return true;
    }
    installEvents();
    if (!pumpBaselines.size) captureAuthoritativeBaselines();
    const supportSignature = [
      root.EngineeringPipeCanvasHydraulicLabelRuntime?.version || "",
      root.EngineeringRouteTraceAudit?.version || ""
    ].join("|");
    if (supportSignature !== installSupportSignature) {
      installSupportSignature = supportSignature;
      requestPreview("install");
    }
    root.__engineeringCanvasFastPreviewRuntimeVersion = VERSION;
    return true;
  }

  function startInstallLoop() {
    installAttempts += 1;
    install();
    if (installAttempts < 60 && typeof root.setTimeout === "function") {
      root.setTimeout(startInstallLoop, installAttempts < 12 ? 250 : 1000);
    }
  }

  const api = {
    version: VERSION,
    install,
    requestPreview,
    runPreview,
    captureAuthoritativeBaselines,
    fluidProps,
    pumpResultView
  };

  root.EngineeringCanvasFastPreviewRuntime = api;
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
