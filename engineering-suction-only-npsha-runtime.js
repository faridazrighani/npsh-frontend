!function(root) {
  "use strict";

  const VERSION = "2026.06-suction-only-npsha4";
  const SOLVE_DELAY_MS = 420;
  const RETRY_DELAY_MS = 900;
  const MAX_RETRIES = 8;
  const GRAVITY = 9.81;
  const ATM_PRESSURE_BAR_A = 1.01325;
  const PIPE_FITTING_K = {
    "Sharp-edged entrance": 0.5,
    "Reentrant entrance": 0.8,
    "Well-rounded entrance": 0.03,
    "Submerged exit": 1,
    "90 smooth bend - flanged": 0.3,
    "90 elbow - threaded": 0.9,
    "90 miter bend - no vanes": 1.1,
    "90 miter bend - with vanes": 0.2,
    "45 elbow - threaded": 0.4,
    "180 return bend - flanged": 0.2,
    "Tee - line flow flanged": 0.2,
    "Tee - branch flow flanged": 1,
    "Threaded union": 0.08,
    "90 elbow - long radius flanged": 0.2,
    "90 elbow - short radius flanged": 0.5,
    "45 elbow - flanged": 0.2,
    "Concentric reducer - gradual": 0.15,
    "Sudden contraction": 0.5,
    "Sudden expansion": 1,
    "Y-strainer - clean": 2,
    "Basket strainer - clean": 1.5,
    "Gate valve - fully open": 0.2,
    "Globe valve - fully open": 10,
    "Angle valve - fully open": 5,
    "Ball valve - fully open": 0.05,
    "Butterfly valve - fully open": 0.4,
    "Plug valve - fully open": 0.4,
    "Control valve - generic open": 10,
    "Swing check valve": 2
  };

  const stateByPump = new Map();
  let observer = null;
  let installAttempts = 0;

  function runtimeModel() {
    try {
      if (typeof globalModel !== "undefined" && globalModel) return globalModel;
    } catch (error) {
      // Protected builds may keep the model behind runtime globals.
    }
    return root.globalModel || root.__npshGlobalModel || {};
  }

  function runtimeConnections() {
    try {
      if (typeof connections !== "undefined" && Array.isArray(connections)) return connections;
    } catch (error) {
      // Protected builds may keep connections behind runtime globals.
    }
    return Array.isArray(root.connections) ? root.connections : [];
  }

  function numberOrNull(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstFiniteValue(...values) {
    for (const value of values) {
      const number = numberOrNull(value);
      if (number !== null) return number;
    }
    return null;
  }

  function firstPositiveValue(...values) {
    for (const value of values) {
      const number = numberOrNull(value);
      if (number !== null && number > 0) return number;
    }
    return null;
  }

  function text(value) {
    return String(value ?? "").trim();
  }

  function cloneStable(value) {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(cloneStable);
    return Object.keys(value).sort().reduce((copy, key) => {
      if (typeof value[key] !== "function") copy[key] = cloneStable(value[key]);
      return copy;
    }, {});
  }

  function stableFingerprint(value) {
    try {
      return JSON.stringify(cloneStable(value));
    } catch (error) {
      return String(Date.now());
    }
  }

  function hydraulicConnections() {
    return runtimeConnections().filter((connection) => !connection?.connectionType || connection.connectionType === "hydraulic");
  }

  function nodeType(model, id) {
    return text(model?.[id]?.type).toLowerCase();
  }

  function isSuctionBoundaryType(type) {
    return type === "source" || type === "tank" || type === "verticalvessel" || type === "horizontalvessel" || type === "separator";
  }

  function incomingPumpRoute(model, pumpId) {
    const allConnections = hydraulicConnections();
    const pumpConnections = allConnections.filter((connection) => connection?.to === pumpId);
    for (const connection of pumpConnections) {
      const directType = nodeType(model, connection.from);
      if (isSuctionBoundaryType(directType) && connection.pipeId && model[connection.pipeId]?.type === "pipe") {
        return { sourceId: connection.from, pipeId: connection.pipeId };
      }

      const pipeId = connection.pipeId || (directType === "pipe" ? connection.from : "");
      if (!pipeId || model[pipeId]?.type !== "pipe") continue;
      const sourceConnection = allConnections.find((candidate) => {
        const fromType = nodeType(model, candidate?.from);
        return isSuctionBoundaryType(fromType)
          && (candidate?.to === pipeId || candidate?.pipeId === pipeId || candidate?.to === pumpId);
      });
      if (sourceConnection?.from) return { sourceId: sourceConnection.from, pipeId };
    }
    const singleSources = Object.keys(model || {}).filter((id) => isSuctionBoundaryType(nodeType(model, id)));
    const singlePipes = Object.keys(model || {}).filter((id) => model?.[id]?.type === "pipe");
    if (!allConnections.length && singleSources.length === 1 && singlePipes.length === 1) {
      return { sourceId: singleSources[0], pipeId: singlePipes[0] };
    }
    return null;
  }

  function downstreamHydraulicConnection(pumpId) {
    return hydraulicConnections().find((connection) => connection?.from === pumpId) || null;
  }

  function sourceFlow(source = {}) {
    const props = source.props || {};
    const results = source.results || {};
    const fluid = fluidProps();
    const massFlow = firstPositiveValue(props.massFlow, props.massFlowKgH);
    const massFlowAsVolume = massFlow !== null && fluid.density > 0 ? massFlow / fluid.density : null;
    return firstPositiveValue(
      results.flow,
      results.evaluatedFlow,
      results.outletFlow,
      results.sourceFlow,
      props.flow,
      props.flowM3h,
      props.volumetricFlow,
      props.demandFlow,
      massFlowAsVolume
    ) ?? firstFiniteValue(results.flow, results.evaluatedFlow, props.flow, props.demandFlow, massFlowAsVolume);
  }

  function pumpFlow(pump = {}, source = {}) {
    const props = pump.props || {};
    const results = pump.results || {};
    const evaluation = results.npshEvaluation || {};
    return firstFiniteValue(evaluation.flow, results.flow, results.fixedFlow, sourceFlow(source), props.designFlow, props.flow);
  }

  function isSuctionOnlyEligiblePump(model, pumpId) {
    const pump = model?.[pumpId];
    if (!pump || pump.type !== "pump") return null;
    const inlet = incomingPumpRoute(model, pumpId);
    if (!inlet) return null;
    const source = model[inlet.sourceId];
    const pipe = inlet.pipeId ? model[inlet.pipeId] : null;
    if (!source || !pipe || pipe.type !== "pipe") return null;
    if (downstreamHydraulicConnection(pumpId)) return null;
    const flow = pumpFlow(pump, source);
    if (!(flow > 0)) return null;
    return { pump, pumpId, source, sourceId: inlet.sourceId, pipe, pipeId: inlet.pipeId, flow };
  }

  function hasCurrentSuctionOnlyResult(pump = {}, pipe = {}) {
    const results = pump.results || {};
    const evaluation = results.npshEvaluation || {};
    const pipeResults = pipe.results || {};
    return (text(results.routeCalculationStatus) === "Suction Only"
      || text(evaluation.routeCalculationStatus) === "Suction Only"
      || results.suctionOnlyNpshaEvaluation === true
      || evaluation.suctionOnlyNpshaEvaluation === true)
      && firstFiniteValue(evaluation.npsha, results.npsha) !== null
      && (pipeResults.pressureCalculated === true || firstFiniteValue(pipeResults.flow, pipeResults.calculationTrace?.basis?.flowM3H) !== null);
  }

  function suctionOnlyFingerprint(model, route) {
    return stableFingerprint({
      version: VERSION,
      flow: route.flow,
      fluid: model?.FLUID?.props || null,
      source: route.source?.props || null,
      pipe: route.pipe?.props || null,
      pump: {
        inputMode: route.pump?.props?.inputMode,
        npshrSourceMode: route.pump?.props?.npshrSourceMode,
        npshAssessmentMode: route.pump?.props?.npshAssessmentMode,
        npshMarginBasis: route.pump?.props?.npshMarginBasis,
        manualNpshr: route.pump?.props?.manualNpshr,
        designFlow: route.pump?.props?.designFlow,
        bepFlow: route.pump?.props?.bepFlow,
        suctionElevation: route.pump?.props?.suctionElevation,
        elevation: route.pump?.props?.elevation,
        minNpshMargin: route.pump?.props?.minNpshMargin,
        minNpshMarginRatio: route.pump?.props?.minNpshMarginRatio,
        curveData: route.pump?.props?.curveData
      },
      connection: {
        sourceId: route.sourceId,
        pipeId: route.pipeId,
        pumpId: route.pumpId
      }
    });
  }

  function markPumpPending(route, reason) {
    const results = route.pump.results || (route.pump.results = {});
    if (hasCurrentSuctionOnlyResult(route.pump, route.pipe)) return;
    results.routeCalculationStatus = results.routeCalculationStatus || "Suction Pending";
    results.requiredPumpHeadStatus = "Downstream Required";
    results.backendValidationStatus = results.backendValidationStatus || "Calculating";
    results.backendValidationMessage = reason;
  }

  function markPumpCurrent(route, reason = "Suction-only NPSHa is current from protected backend.") {
    const pumpResults = route.pump.results || (route.pump.results = {});
    const evaluation = pumpResults.npshEvaluation || {};
    const now = new Date().toISOString();

    pumpResults.backendValidationStatus = "Connected";
    pumpResults.backendValidationMessage = reason;
    pumpResults.calculationFreshness = "Current";
    pumpResults.isCalculationStale = false;
    pumpResults.previousResultWasStale = false;
    pumpResults.backendCalculationSource = pumpResults.backendCalculationSource || "primary";
    pumpResults.backendCalculationAppliedAt = pumpResults.backendCalculationAppliedAt || now;

    evaluation.backendValidationStatus = "Connected";
    evaluation.backendValidationMessage = reason;
    evaluation.calculationFreshness = "Current";
    evaluation.routeCalculationStatus = evaluation.routeCalculationStatus || "Suction Only";
    evaluation.requiredPumpHeadStatus = evaluation.requiredPumpHeadStatus || "Downstream Required";
    pumpResults.npshEvaluation = evaluation;

    if (pumpResults.routeTrace && typeof pumpResults.routeTrace === "object") {
      pumpResults.routeTrace.lossFreshness = pumpResults.routeTrace.lossFreshness || "Current from backend route trace";
    }
  }

  function dispatchCurrent(route, reason = "suction-only-npsha-current") {
    const detail = {
      version: VERSION,
      status: "Current",
      nodeId: route.pumpId,
      pumpId: route.pumpId,
      pipeId: route.pipeId,
      calculationMode: "realtime-input",
      reason,
      updatedAt: new Date().toISOString()
    };
    try {
      root.EngineeringRealtimeCalculationDefense?.markCurrentFromBackend?.(detail);
    } catch (error) {
      // Realtime lifecycle bridge is optional.
    }
    try {
      if (typeof document !== "undefined" && typeof root.CustomEvent === "function") {
        document.dispatchEvent(new root.CustomEvent("npsh:calculation-current", { detail }));
        document.dispatchEvent(new root.CustomEvent("npsh:realtime-autosolve-complete", { detail }));
      }
    } catch (error) {
      // Event dispatch is best-effort.
    }
  }

  function endpointFromConfig() {
    try {
      const configScript = typeof document !== "undefined" ? document.getElementById("npsh-runtime-config") : null;
      const config = configScript?.textContent ? JSON.parse(configScript.textContent) : {};
      return config.simulationEndpoint || `${config.apiBaseUrl || ""}/api/simulate`;
    } catch (error) {
      return "/api/simulate";
    }
  }

  function backendPayload(route) {
    if (typeof root.buildBackendSimulationPayload === "function") {
      try {
        return root.buildBackendSimulationPayload(route.pumpId, {
          model: runtimeModel(),
          connections: runtimeConnections(),
          protectedFrontend: true,
          backendMode: "primary",
          primaryBackend: true,
          useBackendPrimary: true,
          refreshReason: "suction-only-npsha",
          trigger: "suction-only-npsha"
        });
      } catch (error) {
        // Fall through to direct payload.
      }
    }
    return {
      pumpId: route.pumpId,
      selectedPumpId: route.pumpId,
      model: runtimeModel(),
      connections: runtimeConnections(),
      sourceLinks: Array.isArray(root.sourceLinks) ? root.sourceLinks : [],
      instrumentLinks: Array.isArray(root.instrumentLinks) ? root.instrumentLinks : [],
      client: {
        mode: "primary",
        source: "frontend-suction-only-runtime",
        protectedFrontend: true,
        primaryCutoverRequested: true,
        requestedAt: new Date().toISOString()
      }
    };
  }

  function applyNodeResults(nodeResults = {}) {
    const model = runtimeModel();
    Object.keys(nodeResults || {}).forEach((nodeId) => {
      const node = model?.[nodeId];
      const incoming = nodeResults[nodeId];
      const results = incoming?.results && typeof incoming.results === "object"
        ? incoming.results
        : (incoming && typeof incoming === "object" ? incoming : null);
      if (!node || !results) return;
      node.results = {
        ...(node.results || {}),
        ...results
      };
    });
  }

  function applyBackendResult(route, payload = {}) {
    const result = payload.results || payload.result || payload;
    if (!result || typeof result !== "object") return false;
    applyNodeResults(payload.nodeResults || result.nodeResults || {});

    const refreshedRoute = isSuctionOnlyEligiblePump(runtimeModel(), route.pumpId) || route;
    const pumpResults = refreshedRoute.pump.results || (refreshedRoute.pump.results = {});
    const clone = JSON.parse(JSON.stringify(result));
    pumpResults.npshEvaluation = {
      ...(pumpResults.npshEvaluation || {}),
      ...clone
    };
    pumpResults.flow = firstFiniteValue(result.flow, pumpResults.flow);
    pumpResults.npsha = firstFiniteValue(result.npsha, pumpResults.npsha);
    const manualNpshr = firstPositiveValue(refreshedRoute.pump?.props?.manualNpshr);
    const resultNpshr = manualNpshr !== null ? firstPositiveValue(result.npshr, manualNpshr) : null;
    pumpResults.npshEvaluation.npshr = resultNpshr;
    pumpResults.npshEvaluation.npshRequired = resultNpshr;
    pumpResults.npshEvaluation.npshMargin = resultNpshr !== null ? firstFiniteValue(result.npshMargin) : null;
    pumpResults.npshEvaluation.npshRatio = resultNpshr !== null ? firstFiniteValue(result.npshRatio) : null;
    pumpResults.npshEvaluation.requiredNpsha = resultNpshr !== null ? firstFiniteValue(result.requiredNpsha) : null;
    pumpResults.npshr = resultNpshr;
    pumpResults.npshRequired = resultNpshr;
    pumpResults.npshMargin = resultNpshr !== null ? firstFiniteValue(result.npshMargin) : null;
    pumpResults.npshRatio = resultNpshr !== null ? firstFiniteValue(result.npshRatio) : null;
    pumpResults.requiredNpsha = resultNpshr !== null ? firstFiniteValue(result.requiredNpsha) : null;
    pumpResults.suctionPressure = firstFiniteValue(result.suctionPressureAbs, result.suctionPressure, pumpResults.suctionPressure);
    pumpResults.suctionLoss = firstFiniteValue(result.suctionLoss, pumpResults.suctionLoss);
    pumpResults.suctionVelocityHead = firstFiniteValue(result.suctionVelocityHead, pumpResults.suctionVelocityHead);
    pumpResults.vaporPressureHead = firstFiniteValue(result.vaporPressureHead, pumpResults.vaporPressureHead);
    pumpResults.routeCalculationStatus = result.routeCalculationStatus || pumpResults.routeCalculationStatus || "Suction Only";
    pumpResults.requiredPumpHeadStatus = result.requiredPumpHeadStatus || pumpResults.requiredPumpHeadStatus || "Downstream Required";
    pumpResults.status = result.status || result.hydraulicStatus || pumpResults.status || "Safe";
    pumpResults.hydraulicNpshStatus = result.hydraulicStatus || result.status || pumpResults.hydraulicNpshStatus || "Safe";
    pumpResults.engineeringStatus = result.engineeringStatus || result.status || pumpResults.engineeringStatus || "Safe";
    pumpResults.cavitationStatus = pumpResults.hydraulicNpshStatus;
    pumpResults.actualPumpHeadAvailable = false;
    pumpResults.pumpHead = null;
    pumpResults.head = null;
    pumpResults.dischargePressure = null;
    pumpResults.suctionOnlyNpshaEvaluation = true;
    pumpResults.routeOnlyNpshEvaluation = true;

    if (payload.routeTrace || result.routeTrace) pumpResults.routeTrace = payload.routeTrace || result.routeTrace;
    if (payload.calculationAudit || result.calculationAudit) pumpResults.calculationAudit = payload.calculationAudit || result.calculationAudit;
    if (payload.dependencyManifest || result.dependencyManifest) pumpResults.dependencyManifest = payload.dependencyManifest || result.dependencyManifest;
    if (payload.calculationDefenseContract || result.calculationDefenseContract) pumpResults.calculationDefenseContract = payload.calculationDefenseContract || result.calculationDefenseContract;

    return applySuctionOnlyReadoutFallback(refreshedRoute);
  }

  async function fetchAndApplyBackendResult(route) {
    if (typeof root.fetch !== "function") return false;
    const response = await root.fetch(endpointFromConfig(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backendPayload(route))
    });
    if (!response?.ok || typeof response.json !== "function") return false;
    const payload = await response.json();
    return applyBackendResult(route, payload);
  }

  function roundValue(value, digits = 6) {
    const number = numberOrNull(value);
    return number === null ? null : Number(number.toFixed(digits));
  }

  function fluidProps(model = runtimeModel()) {
    const props = model?.FLUID?.props || {};
    const density = firstPositiveValue(props.density, props.rho, 997.047) || 997.047;
    const viscosityCSt = firstPositiveValue(props.viscosity, props.kinematicViscosity, props.viscosityCSt, 0.893) || 0.893;
    const vaporPressureBarA = firstFiniteValue(props.vaporPressure, props.vaporPressureBarA, 0.0317) ?? 0.0317;
    return {
      fluidName: props.fluidName || props.name || "Water",
      density,
      viscosityCSt,
      vaporPressureBarA,
      vaporPressureHead: vaporPressureBarA * 100000 / (density * GRAVITY)
    };
  }

  function pressureHeadFromBar(pressureBarA, density) {
    const pressure = numberOrNull(pressureBarA);
    const rho = firstPositiveValue(density, 997.047) || 997.047;
    return pressure === null ? null : pressure * 100000 / (rho * GRAVITY);
  }

  function pressureBarFromHead(head, density) {
    const value = numberOrNull(head);
    const rho = firstPositiveValue(density, 997.047) || 997.047;
    return value === null ? null : value * rho * GRAVITY / 100000;
  }

  function sourceAbsolutePressureBar(source = {}) {
    const props = source.props || {};
    const results = source.results || {};
    const direct = firstFiniteValue(
      results.pressureAbsBar,
      results.absolutePressureBar,
      results.boundaryPressure,
      results.pressure,
      props.pressureAbsBar,
      props.absolutePressureBar
    );
    if (direct !== null && firstFiniteValue(props.pressure) === null) return direct;
    const pressure = firstFiniteValue(props.pressure, direct, ATM_PRESSURE_BAR_A);
    const basis = text(props.pressureInputBasis || props.pressureBasis || props.basis || "Absolute").toLowerCase();
    if (pressure === null) return null;
    return /gauge|bar\s*g|\bg\b/.test(basis) ? pressure + ATM_PRESSURE_BAR_A : pressure;
  }

  function nodeElevation(node = {}, fallback = 0) {
    const props = node.props || {};
    const results = node.results || {};
    return firstFiniteValue(
      props.elevation,
      props.levelElevation,
      props.suctionElevation,
      results.elevation,
      results.sourceElevation,
      results.boundaryElevation,
      fallback
    );
  }

  function pumpSuctionElevation(pump = {}) {
    const props = pump.props || {};
    const results = pump.results || {};
    return firstFiniteValue(
      props.suctionElevation,
      props.datumElevation,
      props.pumpDatumElevation,
      props.elevation,
      results.suctionElevation,
      results.pumpElevation,
      0
    );
  }

  function normaliseDiameter(value) {
    const number = numberOrNull(value);
    if (number === null || number <= 0) return null;
    return number > 5 ? number / 1000 : number;
  }

  function normaliseRoughness(value) {
    const number = firstFiniteValue(value, 0.000045);
    return number > 0.02 ? number / 1000 : Math.max(0, number);
  }

  function segmentEnabled(segment = {}) {
    const status = text([
      segment.connectivityStatus,
      segment.connectionStatus,
      segment.hydraulicConnectivity,
      segment.hydraulicStatus,
      segment.routeStatus,
      segment.status,
      segment.active
    ].filter(Boolean).join(" ")).toLowerCase();
    if (segment.connected === false || segment.disconnected === true) return false;
    if (segment.includedInHydraulicPath === false || segment.inHydraulicPath === false || segment.onRoute === false) return false;
    if (segment.enabled === false || segment.disabled === true || segment.bypassed === true) return false;
    return !/(^|\b)(disconnected|not connected|off route|not in route|outside route|bypassed|isolated|inactive|disabled)(\b|$)/i.test(status);
  }

  function turbulentFrictionFactor(reynolds, relRoughness) {
    let friction = 0.25 / Math.pow(Math.log10((relRoughness / 3.7) + (5.74 / Math.pow(reynolds, 0.9))), 2);
    for (let i = 0; i < 20; i += 1) {
      const next = 1 / Math.pow(-2 * Math.log10((relRoughness / 3.7) + (2.51 / (reynolds * Math.sqrt(friction)))), 2);
      if (Math.abs(next - friction) < 1e-7) return next;
      friction = next;
    }
    return friction;
  }

  function frictionFactor(reynolds, roughness, diameter) {
    if (!Number.isFinite(reynolds) || reynolds <= 0 || !Number.isFinite(diameter) || diameter <= 0) return 0;
    const laminar = 64 / reynolds;
    if (reynolds <= 2300) return laminar;
    const turbulent = turbulentFrictionFactor(Math.max(reynolds, 4000), Math.max(roughness, 0) / diameter);
    if (reynolds >= 4000) return turbulent;
    const blend = (reynolds - 2300) / 1700;
    return laminar + (turbulent - laminar) * blend;
  }

  function fittingK(segment = {}) {
    const type = text(segment.fittingType || segment.type || "None");
    if (/^custom\s*k$/i.test(type)) return Math.max(0, firstFiniteValue(segment.fittingK, segment.k, 0) || 0);
    return Math.max(0, firstFiniteValue(segment.fittingK, segment.k, PIPE_FITTING_K[type], 0) || 0);
  }

  function flowRegime(reynolds) {
    if (!Number.isFinite(reynolds) || reynolds <= 0) return "Not calculated";
    if (reynolds <= 2300) return "Laminar";
    if (reynolds < 4000) return "Transitional";
    return "Turbulent";
  }

  function componentType(segment = {}) {
    const label = [segment.name, segment.fittingType, segment.notes].filter(Boolean).join(" ").toLowerCase();
    if (/valve|check/.test(label)) return "Valve / inline component";
    if (/strainer|orifice|filter/.test(label)) return "Inline component";
    if (/elbow|bend|tee|reducer|contraction|expansion|entrance|exit|inlet|outlet/.test(label)) return "Fitting / local loss";
    if ((firstFiniteValue(segment.minorLossK, segment.additionalK, segment.minorLoss, 0) || 0) > 0) return "Equivalent K / residual";
    return "Pipe major loss";
  }

  function sourceCategory(segment = {}) {
    if (text(segment.notes)) return "User";
    if (/custom/i.test(text(segment.fittingType))) return "User";
    if (text(segment.fittingType) && !/^none$/i.test(text(segment.fittingType))) return "Typical";
    return "Geometry";
  }

  function localPipeSegments(flowM3H, pipe = {}, fluid = fluidProps()) {
    const flow = numberOrNull(flowM3H);
    const segments = Array.isArray(pipe?.props?.segments) ? pipe.props.segments : [];
    if (!(flow > 0) || !segments.length) return [];
    const qM3S = flow / 3600;
    const kinVisc = Math.max(fluid.viscosityCSt, 0.000001) * 1e-6;
    const roughnessAgingFactor = 1;
    const allowanceFraction = 0;
    return segments.map((segment, index) => {
      if (!segmentEnabled(segment)) return null;
      const diameter = normaliseDiameter(segment.diameter);
      if (!(diameter > 0)) return null;
      const length = Math.max(0, firstFiniteValue(segment.length, 0) || 0);
      const area = Math.PI * diameter * diameter / 4;
      const velocity = qM3S / area;
      const reynolds = velocity * diameter / kinVisc;
      const roughness = normaliseRoughness(segment.roughness);
      const effectiveRoughness = roughness * roughnessAgingFactor;
      const friction = frictionFactor(reynolds, effectiveRoughness, diameter);
      const velocityHead = velocity * velocity / (2 * GRAVITY);
      const quantity = Math.max(0, firstFiniteValue(
        segment.fittingQuantity,
        segment.quantity,
        text(segment.fittingType) && !/^none$/i.test(text(segment.fittingType)) ? 1 : 0
      ) || 0);
      const kEach = fittingK(segment);
      const fittingTotalK = quantity * kEach;
      const additionalK = Math.max(0, firstFiniteValue(segment.additionalK, segment.minorLoss, 0) || 0);
      const minorLossK = fittingTotalK + additionalK;
      const majorLoss = friction * (length / diameter) * velocityHead;
      const fittingLoss = fittingTotalK * velocityHead;
      const additionalLoss = additionalK * velocityHead;
      const minorLoss = minorLossK * velocityHead;
      const baseTotalLoss = majorLoss + minorLoss;
      const allowanceLoss = baseTotalLoss * allowanceFraction;
      const totalLoss = baseTotalLoss + allowanceLoss;
      const regime = flowRegime(reynolds);
      return {
        index,
        name: segment.name || `Segment ${index + 1}`,
        notes: segment.notes || "",
        pipeSize: segment.pipeSize || "Custom diameter",
        material: segment.material || "Custom roughness",
        length,
        diameter,
        roughness,
        effectiveRoughness,
        roughnessAgingFactor,
        fittingType: text(segment.fittingType || "None"),
        fittingQuantity: quantity,
        fittingK: kEach,
        fittingTotalK,
        additionalK,
        minorLossK,
        velocity,
        reynolds,
        flowRegime: regime,
        regimeWarning: regime === "Transitional" ? "Transitional pipe flow; friction factor is approximate." : "",
        frictionFactor: friction,
        velocityHead,
        majorLoss,
        fittingLoss,
        additionalLoss,
        minorLoss,
        baseTotalLoss,
        allowanceFraction,
        allowanceLoss,
        totalLoss,
        sourceCategory: sourceCategory(segment),
        componentType: componentType(segment)
      };
    }).filter(Boolean);
  }

  function buildLocalPipeTrace(route, flowM3H, fluid, pressures = {}) {
    if (typeof root.buildPipeCalculationTrace === "function") {
      try {
        const trace = root.buildPipeCalculationTrace(flowM3H, route.pipe.props || {}, route.pipe.results || {}, null, route.pipeId);
        if (trace && trace.isSolved !== false && firstFiniteValue(trace.totals?.totalLoss) !== null) return trace;
      } catch (error) {
        // Local Darcy fallback is used when protected helpers are unavailable or not hydrated yet.
      }
    }
    const segments = localPipeSegments(flowM3H, route.pipe, fluid);
    const totals = segments.reduce((sum, segment) => {
      sum.majorLoss += segment.majorLoss || 0;
      sum.minorLoss += segment.minorLoss || 0;
      sum.allowanceLoss += segment.allowanceLoss || 0;
      sum.totalLoss += segment.totalLoss || 0;
      sum.totalK += segment.minorLossK || 0;
      return sum;
    }, { majorLoss: 0, minorLoss: 0, allowanceLoss: 0, totalLoss: 0, totalK: 0 });
    const totalLoss = totals.totalLoss;
    const inletPressure = firstFiniteValue(pressures.inletPressure, sourceAbsolutePressureBar(route.source));
    const outletPressure = firstFiniteValue(pressures.outletPressure, inletPressure !== null ? inletPressure - pressureBarFromHead(totalLoss, fluid.density) : null);
    let accumulatedLoss = 0;
    const pressureProfileSegments = segments.map((segment) => {
      const startPressure = inletPressure !== null ? inletPressure - pressureBarFromHead(accumulatedLoss, fluid.density) : null;
      accumulatedLoss += segment.totalLoss || 0;
      const endPressure = inletPressure !== null ? inletPressure - pressureBarFromHead(accumulatedLoss, fluid.density) : null;
      const profile = {
        startElevation: firstFiniteValue(segment.zIn, segment.zin, segment.startElevation, route.source?.props?.elevation, 0),
        endElevation: firstFiniteValue(segment.zOut, segment.zout, segment.endElevation, pumpSuctionElevation(route.pump)),
        startPressure: roundValue(startPressure, 6),
        endPressure: roundValue(endPressure, 6)
      };
      return {
        index: segment.index,
        name: segment.name,
        componentType: segment.componentType,
        fittingType: segment.fittingType,
        fittingQuantity: roundValue(segment.fittingQuantity, 4),
        kEach: roundValue(segment.fittingK, 6),
        totalK: roundValue(segment.minorLossK, 6),
        sourceCategory: segment.sourceCategory,
        sourceNote: `[${segment.sourceCategory}] ${segment.notes || "Pipe Object Properties input"}`,
        notes: segment.notes || "",
        velocity: roundValue(segment.velocity, 6),
        reynolds: roundValue(segment.reynolds, 0),
        frictionFactor: roundValue(segment.frictionFactor, 8),
        flowRegime: segment.flowRegime,
        warning: segment.regimeWarning,
        profile,
        majorLoss: roundValue(segment.majorLoss, 6),
        minorLoss: roundValue(segment.minorLoss, 6),
        totalLoss: roundValue(segment.totalLoss, 6),
        minorLossK: roundValue(segment.minorLossK, 6),
        steps: [
          {
            title: "Reynolds Number",
            formula: "Re = vD/nu",
            substitution: `${roundValue(segment.velocity, 6)} x ${roundValue(segment.diameter, 6)} / ${roundValue(fluid.viscosityCSt * 1e-6, 10)}`,
            result: roundValue(segment.reynolds, 0),
            unit: ""
          },
          {
            title: "Segment Major Loss",
            formula: "h_f = f(L/D)v^2/(2g)",
            substitution: `${roundValue(segment.frictionFactor, 8)} x (${roundValue(segment.length, 3)} / ${roundValue(segment.diameter, 6)}) x ${roundValue(segment.velocityHead, 6)}`,
            result: roundValue(segment.majorLoss, 6),
            unit: "m"
          },
          {
            title: "Segment Minor Loss",
            formula: "h_m = K v^2/(2g)",
            substitution: `${roundValue(segment.minorLossK, 6)} x ${roundValue(segment.velocityHead, 6)}`,
            result: roundValue(segment.minorLoss, 6),
            unit: "m"
          },
          {
            title: "Segment Total Loss",
            formula: "h_total = h_f + h_m",
            substitution: `${roundValue(segment.majorLoss, 6)} + ${roundValue(segment.minorLoss, 6)} + ${roundValue(segment.allowanceLoss, 6)}`,
            result: roundValue(segment.totalLoss, 6),
            unit: "m"
          }
        ],
        pressureSteps: []
      };
    });

    return {
      isSolved: flowM3H > 0,
      message: flowM3H > 0 ? "Suction-only PFV trace calculated from current source flow." : "Pipe calculation trace needs positive flow.",
      basis: {
        flowM3H: roundValue(flowM3H, 6),
        flowM3S: roundValue(flowM3H / 3600, 8),
        density: roundValue(fluid.density, 4),
        viscosityCSt: roundValue(fluid.viscosityCSt, 6),
        kinematicViscosityM2S: roundValue(fluid.viscosityCSt * 1e-6, 10),
        vaporPressureBarA: roundValue(fluid.vaporPressureBarA, 6),
        roughnessAgingFactor: 1,
        headLossAllowancePercent: 0,
        elevationProfileMode: "Ignore"
      },
      totals: {
        majorLoss: roundValue(totals.majorLoss, 6),
        minorLoss: roundValue(totals.minorLoss, 6),
        allowanceLoss: roundValue(totals.allowanceLoss, 6),
        totalLoss: roundValue(totals.totalLoss, 6),
        totalK: roundValue(totals.totalK, 6)
      },
      hydraulic: {
        headLoss: roundValue(totals.totalLoss, 6),
        pressureDropBar: roundValue(pressureBarFromHead(totals.totalLoss, fluid.density), 6)
      },
      sourceMap: [
        { parameter: "Inlet Pressure", value: roundValue(inletPressure, 6), unit: "bar a", status: "Calculated", method: "SRC pressure basis" },
        { parameter: "Outlet Pressure", value: roundValue(outletPressure, 6), unit: "bar a", status: "Calculated", method: "SRC head minus suction loss" },
        { parameter: "Pipe Flow", value: roundValue(flowM3H, 6), unit: "m3/h", status: "Calculated", method: "SRC input flow in suction-only route" }
      ],
      segments: pressureProfileSegments,
      fittingValveBreakdown: pressureProfileSegments.map((segment) => ({
        index: segment.index,
        name: segment.name,
        componentType: segment.componentType,
        fittingType: segment.fittingType,
        quantity: segment.fittingQuantity,
        kEach: segment.kEach,
        fittingTotalK: roundValue((segment.fittingQuantity || 0) * (segment.kEach || 0), 6),
        additionalK: null,
        totalK: segment.totalK,
        majorLoss: segment.majorLoss,
        minorLoss: segment.minorLoss,
        totalLoss: segment.totalLoss,
        dataBasis: "Pipe Object Properties input",
        sourceCategory: segment.sourceCategory,
        sourceNote: segment.sourceNote
      })),
      pumpPathRole: {
        role: "Suction",
        impact: "Direct NPSHa reduction",
        calculationUse: "Total PFV loss subtracts from available NPSH at the pump suction."
      },
      dependencyChain: [
        "SRC input flow drives suction PFV velocity and Reynolds number.",
        "PFV major/minor losses subtract from source hydraulic head.",
        "NPSHa remains calculable even when downstream discharge/Sink is not connected."
      ],
      warnings: [...new Set(segments.map((segment) => segment.regimeWarning).filter(Boolean))],
      references: ["Bernoulli energy balance; Darcy-Weisbach major loss; K-method minor loss."]
    };
  }

  function routeNpshr(route) {
    const props = route.pump?.props || {};
    return firstPositiveValue(props.manualNpshr);
  }

  function npshStatus(npsha, npshr, route) {
    if (!(npshr > 0)) return { status: "NPSHa Calculated", margin: null, ratio: null };
    const margin = npsha - npshr;
    const ratio = npshr > 0 ? npsha / npshr : null;
    const minMargin = firstFiniteValue(route.pump?.props?.minNpshMargin, 0);
    const minRatio = firstFiniteValue(route.pump?.props?.minNpshMarginRatio, 1);
    if (npsha <= npshr) return { status: "NPSH Risk", margin, ratio };
    if ((minMargin !== null && margin < minMargin) || (minRatio !== null && ratio !== null && ratio < minRatio)) {
      return { status: "Warning", margin, ratio };
    }
    return { status: "Safe", margin, ratio };
  }

  function buildLocalPumpTrace(route, result) {
    const status = result.status;
    const steps = [
      {
        title: "Source Absolute Pressure",
        formula: "P_src,abs",
        substitution: `${roundValue(result.sourcePressureAbsBar, 6)} bar a`,
        result: roundValue(result.sourcePressureAbsBar, 6),
        unit: "bar a"
      },
      {
        title: "Pressure Head",
        formula: "H_p = P_abs x 100000 / (rho x g)",
        substitution: `${roundValue(result.sourcePressureAbsBar, 6)} x 100000 / (${roundValue(result.fluid.density, 4)} x ${GRAVITY})`,
        result: roundValue(result.sourcePressureHead, 6),
        unit: "m"
      },
      {
        title: "Suction Loss",
        formula: "h_L,suction = sum(h_f + h_m)",
        substitution: `${roundValue(result.suctionLoss, 6)} m from ${route.pipeId}`,
        result: roundValue(result.suctionLoss, 6),
        unit: "m"
      },
      {
        title: "Vapor Pressure Head",
        formula: "H_v = P_v x 100000 / (rho x g)",
        substitution: `${roundValue(result.fluid.vaporPressureBarA, 6)} x 100000 / (${roundValue(result.fluid.density, 4)} x ${GRAVITY})`,
        result: roundValue(result.vaporPressureHead, 6),
        unit: "m"
      },
      {
        title: "NPSHa",
        formula: "NPSHa = H_src - h_L,suction - z_pump - H_v",
        substitution: `${roundValue(result.sourceHead, 6)} - ${roundValue(result.suctionLoss, 6)} - ${roundValue(result.pumpElevation, 6)} - ${roundValue(result.vaporPressureHead, 6)}`,
        result: roundValue(result.npsha, 6),
        unit: "m"
      },
      {
        title: "NPSHr",
        formula: "NPSHr = vendor/manual/curve value at Q",
        substitution: result.npshr > 0 ? `${roundValue(result.npshr, 6)} m at ${roundValue(result.flow, 6)} m3/h` : "NPSHr evidence is not provided",
        result: result.npshr > 0 ? roundValue(result.npshr, 6) : null,
        unit: "m"
      },
      {
        title: "Margin and Ratio",
        formula: "Margin = NPSHa - NPSHr; Ratio = NPSHa / NPSHr",
        substitution: result.npshr > 0
          ? `${roundValue(result.npsha, 6)} - ${roundValue(result.npshr, 6)}; ${roundValue(result.npsha, 6)} / ${roundValue(result.npshr, 6)}`
          : "NPSHr not provided",
        result: result.npshr > 0 ? roundValue(result.npshMargin, 6) : null,
        unit: "m"
      }
    ];
    return {
      formulaDefenseSchemaVersion: "pump-formula-defense.suction-only-ui.v1",
      routeCalculationStatus: "Suction Only",
      npshaCalculationStatus: "Calculated",
      basis: {
        flowM3H: roundValue(result.flow, 6),
        density: roundValue(result.fluid.density, 4),
        vaporPressureBarA: roundValue(result.fluid.vaporPressureBarA, 6),
        vaporPressureHead: roundValue(result.vaporPressureHead, 6),
        sourcePressureAbsBar: roundValue(result.sourcePressureAbsBar, 6),
        sourceElevation: roundValue(result.sourceElevation, 6),
        pumpElevation: roundValue(result.pumpElevation, 6)
      },
      boundary: {
        sourceId: route.sourceId,
        pressureAbsBar: roundValue(result.sourcePressureAbsBar, 6),
        elevation: roundValue(result.sourceElevation, 6),
        totalSourceHead: roundValue(result.sourceHead, 6),
        flow: roundValue(result.flow, 6),
        sourceFlow: roundValue(result.flow, 6)
      },
      losses: {
        suctionLoss: roundValue(result.suctionLoss, 6),
        entries: [
          {
            id: route.pipeId,
            type: "pipe",
            role: "Suction",
            majorLoss: roundValue(result.pipeTrace?.totals?.majorLoss, 6),
            minorLoss: roundValue(result.pipeTrace?.totals?.minorLoss, 6),
            headLoss: roundValue(result.suctionLoss, 6),
            directNpshImpact: true
          }
        ]
      },
      systemHead: {
        suctionLoss: roundValue(result.suctionLoss, 6),
        dischargeLoss: null,
        requiredHead: null,
        requiredHeadRaw: null,
        requiredHeadPositive: null
      },
      interpretation: {
        hydraulicStatus: status,
        status,
        dataConfidence: result.npshr > 0 ? "NPSHr provided" : "NPSHr not provided",
        engineeringStatus: status,
        npshaCalculationStatus: "Calculated",
        requiredPumpHeadStatus: "Downstream Required"
      },
      steps,
      academicFormulaDefenseRows: steps.map((step, index) => ({
        order: index + 1,
        step: step.title,
        inputSource: step.title === "Suction Loss" ? "Suction PFV calculation trace" : "Suction-only source/pump input",
        formula: step.formula,
        substitution: step.substitution,
        result: step.result,
        unit: step.unit,
        literatureBasis: /loss/i.test(step.title)
          ? "Darcy-Weisbach and K-method minor loss."
          : "Bernoulli energy balance and NPSH available definition.",
        advisorDefenseNote: "Suction-only mode intentionally calculates NPSHa while keeping downstream required head unavailable."
      }))
    };
  }

  function calculateLocalSuctionOnlyResult(route) {
    const flow = firstPositiveValue(route.flow, pumpFlow(route.pump, route.source), sourceFlow(route.source));
    if (!(flow > 0)) return null;
    const fluid = fluidProps();
    const sourcePressureAbsBar = sourceAbsolutePressureBar(route.source);
    if (sourcePressureAbsBar === null) return null;
    const sourceElevation = firstFiniteValue(nodeElevation(route.source, 0), 0);
    const pumpElevation = firstFiniteValue(pumpSuctionElevation(route.pump), 0);
    const sourcePressureHead = pressureHeadFromBar(sourcePressureAbsBar, fluid.density);
    const sourceHead = sourcePressureHead + sourceElevation;
    const pipeTrace = buildLocalPipeTrace(route, flow, fluid, { inletPressure: sourcePressureAbsBar });
    const suctionLoss = firstFiniteValue(pipeTrace?.totals?.totalLoss, 0) || 0;
    const suctionHeadAtPump = sourceHead - suctionLoss;
    const suctionPressureAbsBar = pressureBarFromHead(suctionHeadAtPump - pumpElevation, fluid.density);
    const refreshedTrace = buildLocalPipeTrace(route, flow, fluid, {
      inletPressure: sourcePressureAbsBar,
      outletPressure: suctionPressureAbsBar
    });
    const npsha = suctionHeadAtPump - pumpElevation - fluid.vaporPressureHead;
    const npshr = routeNpshr(route);
    const statusResult = npshStatus(npsha, npshr, route);
    return {
      flow,
      fluid,
      sourcePressureAbsBar,
      sourcePressureHead,
      sourceElevation,
      sourceHead,
      pumpElevation,
      suctionLoss,
      suctionHeadAtPump,
      suctionPressureAbsBar,
      vaporPressureHead: fluid.vaporPressureHead,
      npsha,
      npshr,
      npshMargin: statusResult.margin,
      npshRatio: statusResult.ratio,
      status: statusResult.status,
      pipeTrace: refreshedTrace
    };
  }

  function applyLocalSourceResults(route, result) {
    const sourceResults = route.source.results || (route.source.results = {});
    sourceResults.sourceInputFlow = roundValue(result.flow, 3);
    sourceResults.evaluatedFlow = roundValue(result.flow, 3);
    sourceResults.flow = roundValue(result.flow, 3);
    sourceResults.outletFlow = roundValue(result.flow, 3);
    sourceResults.sourceFlow = roundValue(result.flow, 3);
    sourceResults.pressure = roundValue(result.sourcePressureAbsBar, 6);
    sourceResults.pressureAbsBar = roundValue(result.sourcePressureAbsBar, 6);
    sourceResults.boundaryPressure = roundValue(result.sourcePressureAbsBar, 6);
    sourceResults.elevation = roundValue(result.sourceElevation, 6);
    sourceResults.sourceElevation = roundValue(result.sourceElevation, 6);
    sourceResults.sourceHead = roundValue(result.sourceHead, 6);
    sourceResults.boundaryHead = roundValue(result.sourceHead, 6);
    sourceResults.hydraulicHead = roundValue(result.sourceHead, 6);
    sourceResults.sourceStatus = "OK";
    sourceResults.calculationTrace = {
      ...(sourceResults.calculationTrace || {}),
      mode: "Suction Only",
      boundary: {
        ...(sourceResults.calculationTrace?.boundary || {}),
        flow: roundValue(result.flow, 6),
        sourceFlow: roundValue(result.flow, 6),
        outletFlow: roundValue(result.flow, 6),
        pressureAbsBar: roundValue(result.sourcePressureAbsBar, 6),
        absolutePressureBar: roundValue(result.sourcePressureAbsBar, 6),
        elevation: roundValue(result.sourceElevation, 6),
        totalSourceHead: roundValue(result.sourceHead, 6),
        hydraulicHead: roundValue(result.sourceHead, 6)
      },
      inputBasis: {
        ...(sourceResults.calculationTrace?.inputBasis || {}),
        flow: roundValue(result.flow, 6),
        sourceFlow: roundValue(result.flow, 6),
        pressureAbsBar: roundValue(result.sourcePressureAbsBar, 6),
        elevation: roundValue(result.sourceElevation, 6),
        totalSourceHead: roundValue(result.sourceHead, 6)
      }
    };
  }

  function applyLocalPipeResults(route, result) {
    const pipeResults = route.pipe.results || (route.pipe.results = {});
    const trace = result.pipeTrace || {};
    const totals = trace.totals || {};
    const pressureDrop = pressureBarFromHead(result.suctionLoss, result.fluid.density);
    const velocity = firstFiniteValue(
      ...(Array.isArray(trace.segments) ? trace.segments.map((segment) => segment.velocity) : []),
      pipeResults.velocity
    );
    pipeResults.flow = roundValue(result.flow, 6);
    pipeResults.velocity = roundValue(velocity, 6);
    pipeResults.flowVelocity = roundValue(velocity, 6);
    pipeResults.pressureCalculated = true;
    pipeResults.inletPressure = roundValue(result.sourcePressureAbsBar, 6);
    pipeResults.outletPressure = roundValue(result.suctionPressureAbsBar, 6);
    pipeResults.pin = roundValue(result.sourcePressureAbsBar, 6);
    pipeResults.pout = roundValue(result.suctionPressureAbsBar, 6);
    pipeResults.pressureDrop = roundValue(pressureDrop, 6);
    pipeResults.staticPressureDelta = roundValue(pressureDrop, 6);
    pipeResults.majorLoss = roundValue(totals.majorLoss, 6);
    pipeResults.minorLoss = roundValue(totals.minorLoss, 6);
    pipeResults.fittingLoss = roundValue(totals.minorLoss, 6);
    pipeResults.totalK = roundValue(totals.totalK, 6);
    pipeResults.headLoss = roundValue(result.suctionLoss, 6);
    pipeResults.totalLoss = roundValue(result.suctionLoss, 6);
    pipeResults.totalHeadLoss = roundValue(result.suctionLoss, 6);
    pipeResults.suctionLoss = roundValue(result.suctionLoss, 6);
    pipeResults.hydraulicHead = roundValue(result.suctionHeadAtPump, 6);
    pipeResults.vaporPressure = roundValue(result.fluid.vaporPressureBarA, 6);
    pipeResults.calculationTrace = trace;
    pipeResults.segmentProfiles = Array.isArray(trace.segments)
      ? trace.segments.map((segment) => segment.profile || {})
      : [];
    pipeResults.warnings = [...new Set([...(Array.isArray(pipeResults.warnings) ? pipeResults.warnings : []), ...(trace.warnings || [])])];
  }

  function applyLocalPumpResults(route, result) {
    const pumpResults = route.pump.results || (route.pump.results = {});
    const calculationTrace = buildLocalPumpTrace(route, result);
    const npshrProvided = result.npshr > 0;
    const status = result.status;
    const statusForPanel = npshrProvided ? status : "NPSHa Calculated";
    const evaluation = {
      ...(pumpResults.npshEvaluation || {}),
      status: statusForPanel,
      hydraulicStatus: statusForPanel,
      engineeringStatus: statusForPanel,
      routeCalculationStatus: "Suction Only",
      npshaCalculationStatus: "Calculated",
      requiredPumpHeadStatus: "Downstream Required",
      actualPumpHeadAvailable: false,
      flow: roundValue(result.flow, 6),
      npsha: roundValue(result.npsha, 6),
      npshr: npshrProvided ? roundValue(result.npshr, 6) : null,
      npshMargin: npshrProvided ? roundValue(result.npshMargin, 6) : null,
      npshRatio: npshrProvided ? roundValue(result.npshRatio, 6) : null,
      requiredNpsha: null,
      suctionPressureAbs: roundValue(result.suctionPressureAbsBar, 6),
      suctionPressure: roundValue(result.suctionPressureAbsBar, 6),
      suctionLoss: roundValue(result.suctionLoss, 6),
      vaporPressureHead: roundValue(result.vaporPressureHead, 6),
      vaporPressureBarA: roundValue(result.fluid.vaporPressureBarA, 6),
      sourceInputFlow: roundValue(result.flow, 6),
      dischargePressure: null,
      pumpHead: null,
      head: null,
      calculationTrace,
      suctionOnlyNpshaEvaluation: true,
      routeOnlyNpshEvaluation: true,
      solveMode: npshrProvided ? "Suction-only Manual NPSHr at evaluated flow" : "Suction-only NPSHa at evaluated flow",
      flowBasis: `${route.sourceId || "SRC"} flow input`
    };
    pumpResults.npshEvaluation = evaluation;
    pumpResults.flow = roundValue(result.flow, 3);
    pumpResults.fixedFlow = roundValue(result.flow, 3);
    pumpResults.sourceInputFlow = roundValue(result.flow, 3);
    pumpResults.suctionPressure = roundValue(result.suctionPressureAbsBar, 6);
    pumpResults.suctionPressureAbs = roundValue(result.suctionPressureAbsBar, 6);
    pumpResults.npsha = roundValue(result.npsha, 6);
    pumpResults.npshr = npshrProvided ? roundValue(result.npshr, 6) : null;
    pumpResults.npshRequired = npshrProvided ? roundValue(result.npshr, 6) : null;
    pumpResults.npshMargin = npshrProvided ? roundValue(result.npshMargin, 6) : null;
    pumpResults.npshRatio = npshrProvided ? roundValue(result.npshRatio, 6) : null;
    pumpResults.suctionLoss = roundValue(result.suctionLoss, 6);
    pumpResults.vaporPressureHead = roundValue(result.vaporPressureHead, 6);
    pumpResults.status = statusForPanel;
    pumpResults.hydraulicNpshStatus = statusForPanel;
    pumpResults.engineeringStatus = statusForPanel;
    pumpResults.cavitationStatus = statusForPanel;
    pumpResults.routeCalculationStatus = "Suction Only";
    pumpResults.npshaCalculationStatus = "Calculated";
    pumpResults.requiredPumpHeadStatus = "Downstream Required";
    pumpResults.requiredSystemHead = null;
    pumpResults.requiredSystemHeadRaw = null;
    pumpResults.requiredSystemHeadPositive = null;
    pumpResults.actualPumpHeadAvailable = false;
    pumpResults.pumpHead = null;
    pumpResults.head = null;
    pumpResults.dischargePressure = null;
    pumpResults.power = null;
    pumpResults.powerBasis = "Not calculated: suction-only NPSHa has no actual pump head.";
    pumpResults.solveMode = evaluation.solveMode;
    pumpResults.flowBasis = evaluation.flowBasis;
    pumpResults.routeOnlyNpshEvaluation = true;
    pumpResults.suctionOnlyNpshaEvaluation = true;
    pumpResults.calculationTrace = calculationTrace;
    pumpResults.routeTrace = {
      ...(pumpResults.routeTrace || {}),
      schemaVersion: "route-trace.suction-only-ui.v1",
      pumpId: route.pumpId,
      text: ["Fluid Basis", route.sourceId, route.pipeId, route.pumpId].filter(Boolean).join(" -> "),
      compactText: [route.sourceId, route.pipeId, route.pumpId].filter(Boolean).join(" -> "),
      suction: [route.sourceId, route.pipeId, route.pumpId].filter(Boolean),
      discharge: [route.pumpId],
      suctionLoss: {
        headLoss: roundValue(result.suctionLoss, 6),
        pressureDrop: roundValue(pressureBarFromHead(result.suctionLoss, result.fluid.density), 6)
      },
      dischargeLoss: { headLoss: null, pressureDrop: null },
      lossFreshness: "Current from suction-only PFV trace"
    };
  }

  function applyLocalSuctionOnlyFallback(route) {
    const result = calculateLocalSuctionOnlyResult(route);
    if (!result || !Number.isFinite(result.npsha)) return false;
    applyLocalSourceResults(route, result);
    applyLocalPipeResults(route, result);
    applyLocalPumpResults(route, result);
    markPumpCurrent(route, "Suction-only NPSHa hydrated from current source and PFV inputs.");
    return applySuctionOnlyReadoutFallback(route);
  }

  function applySuctionOnlyReadoutFallback(route) {
    const pumpResults = route.pump.results || {};
    const evaluation = pumpResults.npshEvaluation || {};
    const pipeResults = route.pipe.results || {};
    if (firstFiniteValue(evaluation.npsha, pumpResults.npsha) === null) return false;

    pumpResults.routeCalculationStatus = "Suction Only";
    pumpResults.requiredPumpHeadStatus = pumpResults.requiredPumpHeadStatus || "Downstream Required";
    pumpResults.suctionOnlyNpshaEvaluation = true;
    pumpResults.actualPumpHeadAvailable = false;
    pumpResults.pumpHead = null;
    pumpResults.head = null;
    pumpResults.dischargePressure = null;
    pumpResults.status = text(pumpResults.status) && !/incomplete|input required/i.test(pumpResults.status)
      ? pumpResults.status
      : (evaluation.status || evaluation.hydraulicStatus || "Safe");
    pumpResults.hydraulicNpshStatus = pumpResults.hydraulicNpshStatus || evaluation.hydraulicStatus || pumpResults.status;
    pumpResults.cavitationStatus = pumpResults.cavitationStatus || pumpResults.hydraulicNpshStatus;
    markPumpCurrent(route);

    if (firstFiniteValue(pipeResults.flow, pipeResults.calculationTrace?.basis?.flowM3H) !== null) {
      pipeResults.pressureCalculated = true;
    }
    return true;
  }

  function refreshCanvas(route, reason = "suction-only-npsha") {
    try {
      if (typeof root.EngineeringPipeCanvasHydraulicLabelRuntime?.refresh === "function") {
        root.EngineeringPipeCanvasHydraulicLabelRuntime.refresh(reason);
      }
    } catch (error) {
      // Canvas label refresh is best-effort.
    }
    try {
      if (typeof root.updateAllObjectOperatingStatusVisuals === "function") root.updateAllObjectOperatingStatusVisuals();
    } catch (error) {
      // Visual badge refresh is best-effort.
    }
    try {
      if (typeof root.refreshBackendProtectedSimulationUi === "function") {
        root.refreshBackendProtectedSimulationUi(reason);
      }
    } catch (error) {
      // Task-window refresh is best-effort.
    }
    try {
      root.dispatchEvent?.(new CustomEvent("npsh:suction-only-npsha-current", {
        detail: {
          version: VERSION,
          pumpId: route.pumpId,
          pipeId: route.pipeId,
          reason,
          updatedAt: new Date().toISOString()
        }
      }));
    } catch (error) {
      // Event dispatch is best-effort.
    }
  }

  function scheduleForRoute(route, reason = "suction-only-npsha") {
    const fingerprint = suctionOnlyFingerprint(runtimeModel(), route);
    const state = stateByPump.get(route.pumpId) || {};
    if (state.inFlight) return false;
    if (state.lastAppliedFingerprint === fingerprint && hasCurrentSuctionOnlyResult(route.pump, route.pipe)) {
      applySuctionOnlyReadoutFallback(route);
      return false;
    }
    if (state.lastFailedFingerprint === fingerprint) return false;
    if (state.timer) root.clearTimeout?.(state.timer);
    state.fingerprint = fingerprint;
    state.reason = reason;
    state.timer = root.setTimeout?.(() => runRouteSolve(route.pumpId), SOLVE_DELAY_MS) || 0;
    stateByPump.set(route.pumpId, state);
    markPumpPending(route, "Suction-only NPSHa calculation is queued.");
    return true;
  }

  async function runRouteSolve(pumpId) {
    const model = runtimeModel();
    const route = isSuctionOnlyEligiblePump(model, pumpId);
    const state = stateByPump.get(pumpId) || {};
    if (!route) return false;
    const fingerprint = suctionOnlyFingerprint(model, route);
    if (state.lastAppliedFingerprint === fingerprint && hasCurrentSuctionOnlyResult(route.pump, route.pipe)) {
      applySuctionOnlyReadoutFallback(route);
      return true;
    }
    if (typeof root.runBackendProtectedPumpSimulation !== "function") {
      const localApplied = applyLocalSuctionOnlyFallback(route);
      if (localApplied) {
        markPumpCurrent(route, "Suction-only NPSHa calculated while protected backend is still loading.");
        dispatchCurrent(route, "suction-only-npsha-local");
        state.lastAppliedFingerprint = fingerprint;
        state.lastFailedFingerprint = "";
        state.retries = 0;
        refreshCanvas(route, "suction-only-npsha-local");
        stateByPump.set(pumpId, state);
        return true;
      }
      state.retries = (state.retries || 0) + 1;
      stateByPump.set(pumpId, state);
      if (state.retries <= MAX_RETRIES) {
        state.timer = root.setTimeout?.(() => runRouteSolve(pumpId), RETRY_DELAY_MS) || 0;
      }
      return false;
    }
    state.inFlight = true;
    state.timer = 0;
    stateByPump.set(pumpId, state);
    markPumpPending(route, "Calculating suction-only NPSHa from protected backend.");
    try {
      await root.runBackendProtectedPumpSimulation(pumpId, {
        forceBackend: true,
        forceProtectedBackend: true,
        refreshReason: "suction-only-npsha",
        trigger: "suction-only-npsha",
        renderSidebarAfter: false,
        timeoutMs: 9000
      });
      const refreshedModel = runtimeModel();
      const refreshedRoute = isSuctionOnlyEligiblePump(refreshedModel, pumpId) || route;
      let applied = applySuctionOnlyReadoutFallback(refreshedRoute);
      if (!applied) applied = await fetchAndApplyBackendResult(refreshedRoute);
      if (!applied) applied = applyLocalSuctionOnlyFallback(refreshedRoute);
      if (!applied) {
        const results = refreshedRoute.pump.results || (refreshedRoute.pump.results = {});
        results.backendValidationStatus = "Failed";
        results.backendValidationMessage = "Suction-only backend calculation finished without a usable NPSHa result.";
        results.calculationFreshness = "Failed";
        state.lastFailedFingerprint = fingerprint;
        dispatchCurrent(refreshedRoute, "suction-only-npsha-no-result");
        refreshCanvas(refreshedRoute, "suction-only-npsha-no-result");
        return false;
      }
      markPumpCurrent(refreshedRoute);
      dispatchCurrent(refreshedRoute, "suction-only-npsha");
      state.lastAppliedFingerprint = fingerprint;
      state.lastFailedFingerprint = "";
      state.retries = 0;
      refreshCanvas(refreshedRoute, "suction-only-npsha");
      return true;
    } catch (error) {
      if (applyLocalSuctionOnlyFallback(route)) {
        dispatchCurrent(route, "suction-only-npsha-local-after-backend-error");
        state.lastAppliedFingerprint = fingerprint;
        state.lastFailedFingerprint = "";
        refreshCanvas(route, "suction-only-npsha-local-after-backend-error");
        return true;
      }
      route.pump.results = route.pump.results || {};
      route.pump.results.backendValidationStatus = "Failed";
      route.pump.results.backendValidationMessage = error?.message || "Suction-only NPSHa backend calculation failed.";
      route.pump.results.calculationFreshness = "Failed";
      state.lastFailedFingerprint = fingerprint;
      dispatchCurrent(route, "suction-only-npsha-failed");
      return false;
    } finally {
      state.inFlight = false;
      stateByPump.set(pumpId, state);
    }
  }

  function scan(reason = "scan") {
    const model = runtimeModel();
    if (!model || typeof model !== "object") return 0;
    let queued = 0;
    Object.keys(model).forEach((pumpId) => {
      const route = isSuctionOnlyEligiblePump(model, pumpId);
      if (!route) return;
      if (scheduleForRoute(route, reason)) queued += 1;
    });
    return queued;
  }

  function patchPumpRows() {
    const original = root.buildPumpLiveParameterRows;
    if (typeof original !== "function" || original.__suctionOnlyNpshaPatched) return false;
    const format = (value, digits = 3, showSign = false) => {
      const number = numberOrNull(value);
      if (number === null) return "-";
      const rendered = number.toFixed(digits);
      return showSign && number > 0 ? `+${rendered}` : rendered;
    };
    const setRow = (rows, label, value, digits, showSign = false) => {
      const row = Array.isArray(rows) ? rows.find((item) => item?.label === label) : null;
      if (!row) return;
      row.value = format(value, digits, showSign);
    };
    function buildPumpLiveParameterRowsWithSuctionOnly(pump, ...args) {
      const rows = original.call(this, pump, ...args);
      const results = pump?.results || {};
      const evaluation = results.npshEvaluation || {};
      const routeFlag = text(pump?.results?.routeCalculationStatus || pump?.results?.npshEvaluation?.routeCalculationStatus);
      if (routeFlag !== "Suction Only") return rows;
      applySuctionOnlyReadoutFallback({ pump, pipe: {}, pumpId: "" });
      setRow(rows, "Flow", firstFiniteValue(evaluation.flow, results.flow), 1);
      setRow(rows, "Suction Press.", firstFiniteValue(evaluation.suctionPressureAbs, results.suctionPressure), 3);
      setRow(rows, "NPSH Available", firstFiniteValue(evaluation.npsha, results.npsha), 4);
      setRow(rows, "NPSH Required", firstPositiveValue(pump?.props?.manualNpshr), 4);
      setRow(rows, "NPSH Margin", firstFiniteValue(evaluation.npshMargin, results.npshMargin), 4, true);
      setRow(rows, "NPSH Ratio", firstFiniteValue(evaluation.npshRatio, results.npshRatio), 4);
      setRow(rows, "Pump Head", null, 1);
      setRow(rows, "Discharge Press.", null, 3);
      return rows;
    }
    buildPumpLiveParameterRowsWithSuctionOnly.__suctionOnlyNpshaPatched = true;
    buildPumpLiveParameterRowsWithSuctionOnly.__suctionOnlyNpshaOriginal = original;
    root.buildPumpLiveParameterRows = buildPumpLiveParameterRowsWithSuctionOnly;
    return true;
  }

  function installEventHooks() {
    if (root.__suctionOnlyNpshaEventsInstalled) return false;
    root.__suctionOnlyNpshaEventsInstalled = true;
    [
      "npsh:calculation-current",
      "npsh:linked-views-refreshed",
      "npsh:realtime-autosolve-complete",
      "npsh:simulation-updated"
    ].forEach((eventName) => {
      root.addEventListener?.(eventName, () => root.setTimeout?.(() => scan(eventName), 160));
    });
    root.addEventListener?.("load", () => root.setTimeout?.(() => scan("load"), 700), { once: true });
    root.setTimeout?.(() => scan("startup"), 900);
    root.setTimeout?.(() => scan("startup-late"), 1900);
    return true;
  }

  function installObserver() {
    if (observer || typeof MutationObserver !== "function" || typeof document === "undefined") return false;
    observer = new MutationObserver(() => {
      root.clearTimeout?.(root.__suctionOnlyNpshaMutationTimer || 0);
      root.__suctionOnlyNpshaMutationTimer = root.setTimeout?.(() => scan("canvas-mutation"), 520) || 0;
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-node-id", "data-object-id", "data-pipe-id", "class"]
    });
    return true;
  }

  function install() {
    installAttempts += 1;
    const patchedRows = patchPumpRows();
    const events = installEventHooks();
    const domObserver = installObserver();
    scan("install");
    const ready = typeof root.runBackendProtectedPumpSimulation === "function"
      || installAttempts < MAX_RETRIES;
    if (ready && typeof root.runBackendProtectedPumpSimulation !== "function") {
      root.setTimeout?.(install, RETRY_DELAY_MS);
    }
    return { version: VERSION, patchedRows, events, domObserver };
  }

  root.EngineeringSuctionOnlyNpshaRuntime = {
    version: VERSION,
    install,
    scan,
    runRouteSolve,
    isSuctionOnlyEligiblePump
  };

  if (typeof document === "undefined") {
    install();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
}("undefined" != typeof window ? window : globalThis);
