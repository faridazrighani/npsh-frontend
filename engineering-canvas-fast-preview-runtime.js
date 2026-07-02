!function registerEngineeringCanvasFastPreviewRuntime(root) {
  "use strict";

  const VERSION = "2026.07-canvas-fast-preview3";
  const GRAVITY_MS2 = 9.80665;
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

  function firstTextValue(...values) {
    for (const value of values) {
      const text = normalizeText(value);
      if (text && text !== "-") return text;
    }
    return "";
  }

  function nonNegativeOrZero(value) {
    const number = finiteNumber(value);
    return number !== null && number >= 0 ? number : 0;
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

  function hasHydraulicConnectionForNode(nodeId, modelRef = model()) {
    if (!nodeId) return false;
    return connectionList(modelRef).some((connection) => (
      isHydraulicConnection(connection)
      && (connectionFrom(connection) === nodeId || connectionTo(connection) === nodeId)
    ));
  }

  function pumpResultView(pump = {}) {
    const results = pump.results || {};
    const evaluation = results.npshEvaluation || {};
    const trace = results.calculationTrace || evaluation.calculationTrace || {};
    const basis = trace.basis || {};
    const props = pump.props || {};
    const propsNpshr = Object.prototype.hasOwnProperty.call(props, "manualNpshr")
      ? nonNegativeOrZero(props.manualNpshr)
      : Object.prototype.hasOwnProperty.call(props, "designNpshr")
      ? nonNegativeOrZero(props.designNpshr)
      : null;
    return {
      flow: firstFiniteValue(results.flow, results.flowM3H, evaluation.flow, evaluation.flowM3H, pump.props?.designFlow, pump.props?.flow),
      npsha: firstFiniteValue(results.npsha, results.npshAvailable, evaluation.npsha, evaluation.npshAvailable),
      npshr: firstFiniteValue(
        propsNpshr,
        results.npshr,
        results.npshRequired,
        evaluation.npshr,
        evaluation.npshRequired
      ),
      npshMargin: firstFiniteValue(results.npshMargin, evaluation.npshMargin),
      npshRatio: firstFiniteValue(results.npshRatio, evaluation.npshRatio),
      suctionPressure: firstFiniteValue(results.suctionPressure, evaluation.suctionPressure, trace.boundary?.suctionPressure),
      dischargePressure: firstFiniteValue(results.dischargePressure, evaluation.dischargePressure, trace.boundary?.dischargePressure),
      pumpHead: firstFiniteValue(results.pumpHead, results.head, evaluation.pumpHead, evaluation.head),
      requiredSystemHead: firstFiniteValue(
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
        basis.vaporPressureHead,
        basis.vaporPressureHeadM,
        basis.vaporPressureHeadMeters,
        evaluation.calculationTrace?.basis?.vaporPressureHead,
        evaluation.calculationTrace?.basis?.vaporPressureHeadM
      )
    };
  }

  function capturePumpBaseline(pumpId, pumpNode) {
    if (!pumpId || pumpNode?.type !== "pump") return false;
    const view = pumpResultView(pumpNode);
    const fluid = fluidProps();
    const npsha = view.npsha;
    if (npsha === null) return false;
    pumpBaselines.set(pumpId, {
      npsha,
      npshr: view.npshr,
      npshMargin: view.npshMargin,
      npshRatio: view.npshRatio,
      vaporPressureHead: firstFiniteValue(view.vaporPressureHead, fluid.vaporPressureHead, 0),
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

  function captureAuthoritativeBaselines() {
    const modelRef = model();
    let captured = 0;
    Object.entries(modelRef || {}).forEach(([id, node]) => {
      if (node?.type === "pump" && capturePumpBaseline(id, node)) captured += 1;
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

  function hydraulicStatusForPreview(npsha, npshr, fallback = "") {
    const required = finiteNumber(npshr);
    if (required === null || required <= 0) return "NPSHr Not Provided";
    const available = finiteNumber(npsha);
    if (available === null) return fallback || "-";
    return available >= required ? "OK" : "Cavitation Risk";
  }

  function previewPumpPanel(panel) {
    const pumpId = nodeIdForPanel(panel, "pump");
    const pumpNode = pumpId ? model()?.[pumpId] : null;
    if (!pumpNode || pumpNode.type !== "pump") return 0;
    const view = pumpResultView(pumpNode);
    const fluid = fluidProps();
    const baseline = pumpBaselines.get(pumpId);
    const baselineNpsha = firstFiniteValue(baseline?.npsha, view.npsha);
    const baselineVaporHead = firstFiniteValue(baseline?.vaporPressureHead, view.vaporPressureHead, fluid.vaporPressureHead, 0);
    const currentVaporHead = firstFiniteValue(fluid.vaporPressureHead, baselineVaporHead, 0);
    const previewNpsha = baselineNpsha === null
      ? view.npsha
      : baselineNpsha + baselineVaporHead - currentVaporHead;
    const npshrRaw = firstFiniteValue(view.npshr, baseline?.npshr);
    const npshr = npshrRaw === null ? null : nonNegativeOrZero(npshrRaw);
    const margin = previewNpsha === null || npshr === null ? null : previewNpsha - npshr;
    const ratio = previewNpsha === null || !npshr ? null : previewNpsha / npshr;
    const isHydraulicallyConnected = hasHydraulicConnectionForNode(pumpId);
    const status = isHydraulicallyConnected
      ? hydraulicStatusForPreview(previewNpsha, npshr, view.hydraulicStatus || baseline?.hydraulicStatus || "")
      : "Incomplete";
    const backendStatus = isHydraulicallyConnected
      ? (view.backendStatus || baseline?.backendStatus || "Unverified")
      : "Unverified";

    let changed = 0;
    changed += setRowValue(pumpRowByLabel(panel, "Flow"), withUnit(firstFiniteValue(view.flow, baseline?.flow), "m3/h", 2));
    changed += setRowValue(pumpRowByLabel(panel, "NPSH Available"), withUnit(previewNpsha, "m", 4));
    changed += setRowValue(pumpRowByLabel(panel, "NPSH Required"), npshr === null ? "-" : withUnit(npshr, "m", 4));
    changed += setRowValue(pumpRowByLabel(panel, "NPSH Margin"), margin === null ? "-" : signedWithUnit(margin, "m", 4));
    changed += setRowValue(pumpRowByLabel(panel, "NPSH Ratio"), ratio === null ? "-" : fixed(ratio, 4));
    changed += setRowValue(pumpRowByLabel(panel, "Hydraulic NPSH"), status);
    changed += setRowValue(pumpRowByLabel(panel, "Backend Valid."), backendStatus);
    changed += setRowValue(pumpRowByLabel(panel, "Suction Press."), withUnit(firstFiniteValue(view.suctionPressure, baseline?.suctionPressure), "bar a", 3));
    changed += setRowValue(pumpRowByLabel(panel, "Discharge Press."), withUnit(firstFiniteValue(view.dischargePressure, baseline?.dischargePressure), "bar a", 3));
    changed += setRowValue(pumpRowByLabel(panel, "Required Head"), withUnit(firstFiniteValue(view.requiredSystemHead, baseline?.requiredSystemHead), "m", 3));

    if (changed) {
      panel.dataset.canvasFastPreview = VERSION;
      panel.dataset.canvasFastPreviewPumpId = pumpId;
      panel.closest?.(".pfd-object")?.setAttribute("data-canvas-fast-preview", VERSION);
    }
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

  function runImmediatePumpPreview(reason = "input") {
    if (typeof document === "undefined") return { changed: 0, reason };
    syncFluidTemperatureInputToModel();
    syncFluidBasisQuietly();
    const changed = refreshPumpPanels(document);
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
        beginPreviewWindow(event?.detail?.sourceEvent || eventName);
      }, true);
    });
    AUTHORITATIVE_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, () => {
        root.setTimeout?.(() => {
          endPreviewWindow();
          captureAuthoritativeBaselines();
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
