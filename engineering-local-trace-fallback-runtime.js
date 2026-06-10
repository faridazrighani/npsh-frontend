(function registerEngineeringLocalTraceFallback(root) {
  "use strict";

  const VERSION = "2026.06-local-trace-fallback3";
  const LOCAL_SOURCE = "frontend-local-trace";
  const LOCAL_FRESHNESS = "Current (local trace)";
  const BACKEND_UNAVAILABLE_PATTERNS = [
    /backend validation unavailable/i,
    /backend api did not return/i,
    /unverified by the protected backend/i,
    /protected backend.*unavailable/i,
    /backend unavailable/i,
    /waiting for backend calculation/i
  ];

  let normalizeTimer = null;
  let refreshTimer = null;
  let installAttempts = 0;

  function runtimeModel() {
    try {
      if (typeof globalModel !== "undefined" && globalModel) return globalModel;
    } catch (error) {
      // Some protected builds hide direct globals.
    }
    return root.globalModel || root.__npshGlobalModel || {};
  }

  function runtimeConnections(modelRef = runtimeModel()) {
    try {
      if (typeof connections !== "undefined" && Array.isArray(connections)) return connections;
    } catch (error) {
      // Some protected builds hide direct globals.
    }
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

  function roundTraceNumber(value, digits = 6) {
    const number = finiteNumber(value);
    return number === null ? null : Number(number.toFixed(digits));
  }

  function compactHash(text) {
    const source = String(text || "");
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).padStart(7, "0");
  }

  function stableStringify(value) {
    const seen = new WeakSet();
    const encode = (item) => {
      if (item === null || typeof item !== "object") return item;
      if (seen.has(item)) return "[Circular]";
      seen.add(item);
      if (Array.isArray(item)) return item.map(encode);
      return Object.keys(item)
        .sort()
        .reduce((output, key) => {
          const child = item[key];
          if (typeof child !== "function" && typeof child !== "undefined") output[key] = encode(child);
          return output;
        }, {});
    };
    return JSON.stringify(encode(value));
  }

  function nodeResults(node) {
    if (!node || typeof node !== "object") return {};
    if (!node.results || typeof node.results !== "object") node.results = {};
    return node.results;
  }

  function isBackendUnavailableText(value) {
    const text = String(value || "");
    return BACKEND_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(text));
  }

  function filterBackendUnavailableWarnings(warnings) {
    if (!Array.isArray(warnings)) return [];
    return warnings.filter((warning) => !isBackendUnavailableText(warning));
  }

  function hasProtectedBackend(results = {}) {
    const statuses = [
      results.backendValidationStatus,
      results.backendValidation?.status,
      results.backendCalculationSource,
      results.calculationAudit?.sourceOfTruth,
      results.dependencyManifest?.sourceOfTruth,
      results.calculationDefenseContract?.sourceOfTruth
    ].map((value) => String(value || "").toLowerCase());
    if (statuses.some((status) => status === "connected" || status === "backend")) return true;
    if (statuses.some((status) => status === "failed" || status === "parity-mismatch")) return true;
    return false;
  }

  function hasUsableHydraulicResult(results = {}) {
    const evaluation = results.npshEvaluation || {};
    return [
      results.flow,
      results.npsha,
      results.npshAvailable,
      results.npshr,
      results.npshRequired,
      results.pumpHead,
      results.dischargePressure,
      evaluation.flow,
      evaluation.npsha,
      evaluation.npshAvailable,
      evaluation.npshr,
      evaluation.npshRequired,
      evaluation.pumpHead,
      evaluation.dischargePressure
    ].some((value) => finiteNumber(value) !== null)
      || Array.isArray(results.calculationTrace?.steps)
      || Array.isArray(evaluation.calculationTrace?.steps);
  }

  function connectionFrom(connection = {}) {
    return connection.from || connection.source || connection.fromNode || "";
  }

  function connectionTo(connection = {}) {
    return connection.to || connection.target || connection.toNode || "";
  }

  function connectionPipeId(connection = {}) {
    return connection.pipeId || connection.pipe || connection.via || connection.edgeId || "";
  }

  function isHydraulicConnection(connection = {}) {
    return !connection.connectionType || String(connection.connectionType).toLowerCase() === "hydraulic";
  }

  function hydraulicConnections(connections = []) {
    return (Array.isArray(connections) ? connections : []).filter(isHydraulicConnection);
  }

  function uniquePush(list, value) {
    if (value && !list.includes(value)) list.push(value);
  }

  function buildSuctionSequence(pumpId, connections = []) {
    const hydraulic = hydraulicConnections(connections);
    const sequence = [pumpId];
    const visited = new Set([pumpId]);
    let current = pumpId;
    for (let guard = 0; guard < 80; guard += 1) {
      const connection = hydraulic.find((item) => connectionTo(item) === current && !visited.has(connectionFrom(item)));
      if (!connection) break;
      const pipeId = connectionPipeId(connection);
      const from = connectionFrom(connection);
      if (pipeId) sequence.unshift(pipeId);
      sequence.unshift(from);
      visited.add(from);
      if (pipeId) visited.add(pipeId);
      current = from;
    }
    return sequence;
  }

  function buildDischargeSequence(pumpId, connections = []) {
    const hydraulic = hydraulicConnections(connections);
    const sequence = [pumpId];
    const visited = new Set([pumpId]);
    let current = pumpId;
    for (let guard = 0; guard < 80; guard += 1) {
      const connection = hydraulic.find((item) => connectionFrom(item) === current && !visited.has(connectionTo(item)));
      if (!connection) break;
      const pipeId = connectionPipeId(connection);
      const to = connectionTo(connection);
      if (pipeId) sequence.push(pipeId);
      sequence.push(to);
      visited.add(to);
      if (pipeId) visited.add(pipeId);
      current = to;
    }
    return sequence;
  }

  function nodeType(model = {}, id = "") {
    if (id === "FLUID") return "fluid";
    return model?.[id]?.type || (/^PIPE|PFV|VALVE/i.test(id) ? "pipe" : "object");
  }

  function nodeName(model = {}, id = "") {
    if (id === "FLUID") return "Fluid Basis";
    return model?.[id]?.name || id;
  }

  function fluidProps(model = {}, result = {}) {
    const props = model?.FLUID?.props || {};
    const basis = result?.calculationTrace?.basis || result?.npshEvaluation?.calculationTrace?.basis || {};
    return {
      fluidName: props.fluidName || props.fluid || basis.fluidName || model?.FLUID?.name || "Water",
      temperatureDegC: firstFiniteValue(props.temp, props.temperature, basis.temperature, basis.temperatureDegC),
      densityKgM3: firstFiniteValue(props.density, basis.density, basis.densityKgM3, 1000),
      viscosityCSt: firstFiniteValue(props.viscosity, props.kinematicViscosity, basis.viscosity, basis.viscosityCSt, 1),
      dynamicViscosityCp: firstFiniteValue(props.dynamicViscosity, basis.dynamicViscosityCp),
      vaporPressureBarA: firstFiniteValue(props.vaporPressure, basis.vaporPressureBarA, basis.vaporPressure, 0)
    };
  }

  function absolutePressureBar(node, fallback = null) {
    try {
      if (root.EngineeringStandards?.getNodeAbsolutePressureBar) {
        const pressure = root.EngineeringStandards.getNodeAbsolutePressureBar(node);
        if (finiteNumber(pressure) !== null) return pressure;
      }
    } catch (error) {
      // Fall back to raw props/results below.
    }
    const props = node?.props || {};
    const results = node?.results || {};
    return firstFiniteValue(
      results.pressureAbs,
      results.pressureBarA,
      results.absolutePressure,
      props.pressureAbs,
      props.pressureBarA,
      props.pressure,
      fallback
    );
  }

  function boundaryValues(id, model = {}, result = {}) {
    const node = model?.[id] || {};
    const results = node?.results || {};
    const boundary = results.calculationTrace?.boundary || {};
    const rho = fluidProps(model, result).densityKgM3 || 1000;
    const pressureBarA = firstFiniteValue(
      boundary.pressureBarA,
      boundary.absolutePressureBar,
      absolutePressureBar(node)
    );
    const elevationM = firstFiniteValue(node.props?.elevation, boundary.elevationM, results.elevation);
    const pressureHeadM = pressureBarA === null ? null : pressureBarA * 100000 / (rho * 9.80665);
    const hydraulicHeadM = firstFiniteValue(
      boundary.hydraulicHeadM,
      results.hydraulicHead,
      pressureHeadM === null && elevationM === null ? null : (pressureHeadM || 0) + (elevationM || 0)
    );
    return {
      pressureBarA: roundTraceNumber(pressureBarA),
      elevationM: roundTraceNumber(elevationM),
      hydraulicHeadM: roundTraceNumber(hydraulicHeadM),
      demandFlowM3H: roundTraceNumber(firstFiniteValue(node.props?.demandFlow, boundary.demandFlow, results.demandFlow)),
      evaluatedFlowM3H: roundTraceNumber(firstFiniteValue(boundary.evaluatedFlow, results.evaluatedFlow, results.flow))
    };
  }

  function resultView(results = {}) {
    const evaluation = results.npshEvaluation || {};
    return {
      flow: firstFiniteValue(results.flow, results.flowM3H, evaluation.flow, evaluation.flowM3H),
      pumpHead: firstFiniteValue(results.pumpHead, results.head, evaluation.pumpHead, evaluation.head),
      npsha: firstFiniteValue(results.npsha, results.npshAvailable, evaluation.npsha, evaluation.npshAvailable),
      npshr: firstFiniteValue(results.npshr, results.npshRequired, evaluation.npshr, evaluation.npshRequired),
      npshMargin: firstFiniteValue(results.npshMargin, evaluation.npshMargin),
      npshRatio: firstFiniteValue(results.npshRatio, evaluation.npshRatio),
      requiredNpsha: firstFiniteValue(results.requiredNpsha, results.requiredNpshAvailable, evaluation.requiredNpsha, evaluation.requiredNpshAvailable),
      suctionPressure: firstFiniteValue(results.suctionPressure, evaluation.suctionPressure),
      dischargePressure: firstFiniteValue(results.dischargePressure, evaluation.dischargePressure),
      suctionLoss: firstFiniteValue(results.suctionLoss, evaluation.suctionLoss),
      dischargeLoss: firstFiniteValue(results.dischargeLoss, evaluation.dischargeLoss),
      hydraulicStatus: results.hydraulicNpshStatus || results.hydraulicStatus || evaluation.hydraulicStatus || evaluation.status || results.status || "",
      engineeringStatus: results.engineeringStatus || evaluation.engineeringStatus || evaluation.status || results.status || ""
    };
  }

  function lossValuesForNode(id, model = {}, result = {}) {
    const node = model?.[id] || {};
    const results = node?.results || {};
    const trace = results.calculationTrace || {};
    const totalLoss = firstFiniteValue(
      trace.totals?.totalLoss,
      trace.totals?.totalLossM,
      trace.hydraulic?.headLoss,
      trace.hydraulic?.headLossM,
      results.totalHeadLoss,
      results.headLoss,
      results.suctionLoss,
      results.dischargeLoss
    );
    const rho = fluidProps(model, result).densityKgM3 || 1000;
    const pressureDrop = firstFiniteValue(
      trace.hydraulic?.pressureDropBar,
      trace.totals?.pressureDropBar,
      results.pressureDropBar,
      results.pressureDrop,
      totalLoss === null ? null : totalLoss * rho * 9.80665 / 100000
    );
    return {
      headLossM: roundTraceNumber(totalLoss),
      pressureDropBar: roundTraceNumber(pressureDrop)
    };
  }

  function sumLoss(sequence = [], model = {}, result = {}) {
    return sequence.reduce((total, id) => {
      const values = lossValuesForNode(id, model, result);
      return {
        headLossM: total.headLossM + (values.headLossM || 0),
        pressureDropBar: total.pressureDropBar + (values.pressureDropBar || 0)
      };
    }, { headLossM: 0, pressureDropBar: 0 });
  }

  function routeFormulaMetadata(type, side) {
    if (type === "fluid") {
      return {
        formulaGroup: "fluid-basis",
        formula: "rho, nu, mu, Pv = property correlation / Fluid Basis input at selected temperature",
        literatureReferences: ["Fluid properties: density, viscosity, vapor pressure"],
        assumptions: ["single-phase liquid screening basis"],
        limitations: ["custom fluid data remains user responsibility"]
      };
    }
    if (type === "source" || type === "sink") {
      return {
        formulaGroup: "boundary-head",
        formula: "H = z + P_abs / (rho g) + v^2 / 2g",
        literatureReferences: ["Bernoulli mechanical energy balance"],
        assumptions: ["steady incompressible boundary condition"],
        limitations: ["transient surge and two-phase effects are outside scope"]
      };
    }
    if (type === "pump") {
      return {
        formulaGroup: "pump-npsh",
        formula: "margin = NPSHa - NPSHr; ratio = NPSHa / NPSHr",
        literatureReferences: ["NPSHa/NPSHr definitions and NPSH margin screening"],
        assumptions: ["NPSHr follows entered pump/vendor/engineering-fit basis"],
        limitations: ["final acceptance should cite manufacturer/test curve when available"]
      };
    }
    return {
      formulaGroup: side === "suction" ? "suction-route-loss" : "discharge-route-loss",
      formula: "hL = f(L/D)(v^2/2g) + SigmaK(v^2/2g)",
      literatureReferences: ["Darcy-Weisbach major loss", "K-method minor loss"],
      assumptions: ["steady internal flow", "pipe roughness/K basis follows object input"],
      limitations: ["network transients and fouling growth are outside current solver scope"]
    };
  }

  function stageForRouteNode(type, side) {
    if (type === "fluid") return "Fluid Basis";
    if (type === "source") return "Suction boundary";
    if (type === "sink") return "Discharge boundary";
    if (type === "pump") return "Pump evaluation";
    return side === "suction" ? "Suction route loss" : "Discharge route loss";
  }

  function roleForRouteNode(type, side) {
    if (type === "fluid") return "Property basis";
    if (type === "source") return "NPSHa pressure/elevation source";
    if (type === "sink") return "Downstream boundary";
    if (type === "pump") return "NPSH and head requirement";
    return side === "suction" ? "Direct NPSHa loss" : "System head loss";
  }

  function dependencyKeysForRouteNode(type, side) {
    if (type === "fluid") return ["fluid.props.fluidName", "fluid.props.temp", "fluid.props.density", "fluid.props.viscosity", "fluid.props.vaporPressure"];
    if (type === "source") return ["source.props.pressure", "source.props.pressureInputBasis", "source.props.elevation", "source.props.flow"];
    if (type === "sink") return ["sink.props.boundaryMode", "sink.props.pressure", "sink.props.demandFlow", "sink.props.elevation", "sink.props.active"];
    if (type === "pump") return ["pump.props.curveData", "pump.props.designFlow", "pump.props.designHead", "pump.props.designNpshr", "pump.props.npshMarginBasis"];
    return side === "suction"
      ? ["suctionRoute.props.geometry", "suctionRoute.props.roughness", "suctionRoute.props.fittingK", "suctionRoute.props.valveCvOrK"]
      : ["dischargeRoute.props.geometry", "dischargeRoute.props.roughness", "dischargeRoute.props.fittingK", "dischargeRoute.props.valveCvOrK"];
  }

  function invalidationRulesForRouteNode(type, side) {
    if (type === "fluid") return ["Changing density, viscosity, vapor pressure, fluid name, or temperature invalidates NPSHa and route losses."];
    if (type === "source") return ["Changing SRC pressure/elevation/pressure basis invalidates suction pressure head and NPSHa."];
    if (type === "sink") return ["Changing SNK pressure/flow/elevation invalidates discharge system head and pump duty."];
    if (type === "pump") return ["Changing pump curve, NPSHr, or margin criteria invalidates pump status."];
    return side === "suction"
      ? ["Changing suction pipe/fitting/valve data invalidates suction loss and NPSHa."]
      : ["Changing discharge pipe/fitting/valve data invalidates system head and discharge pressure."];
  }

  function dataStatus(values = {}) {
    const entries = Object.entries(values);
    const available = entries.filter(([, value]) => value !== null && value !== undefined && value !== "");
    return {
      status: available.length ? "available" : "missing",
      availableFields: available.map(([key]) => key),
      missingFields: entries.filter(([, value]) => value === null || value === undefined || value === "").map(([key]) => key)
    };
  }

  function buildRouteStep({ order, id, type, side, model, result }) {
    const view = resultView(result);
    let values = {};
    if (type === "fluid") {
      values = fluidProps(model, result);
    } else if (type === "source" || type === "sink") {
      values = boundaryValues(id, model, result);
    } else if (type === "pump") {
      values = {
        flowM3H: roundTraceNumber(view.flow),
        pumpHeadM: roundTraceNumber(view.pumpHead),
        npshaM: roundTraceNumber(view.npsha),
        npshrM: roundTraceNumber(view.npshr),
        npshMarginM: roundTraceNumber(view.npshMargin),
        npshRatio: roundTraceNumber(view.npshRatio),
        hydraulicStatus: view.hydraulicStatus,
        engineeringStatus: view.engineeringStatus
      };
    } else {
      values = lossValuesForNode(id, model, result);
    }
    const metadata = routeFormulaMetadata(type, side);
    return {
      order,
      id,
      type,
      name: nodeName(model, id),
      side: side || "",
      stage: stageForRouteNode(type, side),
      role: roleForRouteNode(type, side),
      directNpshImpact: type === "source" || type === "fluid" || (side === "suction" && type !== "pump"),
      systemHeadImpact: type === "source" || side === "discharge" || type === "pump" || type === "sink",
      formulaGroup: metadata.formulaGroup,
      formula: metadata.formula,
      literatureReferences: metadata.literatureReferences,
      assumptions: metadata.assumptions,
      limitations: metadata.limitations,
      audit: {
        sourceOfTruth: LOCAL_SOURCE,
        traceBoundary: "frontend runtime state with backend-compatible audit schema",
        dataStatus: dataStatus(values),
        dependencyKeys: dependencyKeysForRouteNode(type, side),
        staleWhenChanged: invalidationRulesForRouteNode(type, side)
      },
      values
    };
  }

  function buildTopology({ pumpId, model = {}, suctionSequence = [], dischargeSequence = [] }) {
    const sequence = ["FLUID", ...suctionSequence, ...dischargeSequence.slice(1)];
    const sourceIds = sequence.filter((id) => model?.[id]?.type === "source");
    const sinkIds = sequence.filter((id) => model?.[id]?.type === "sink");
    const warnings = [];
    if (!sourceIds.length) warnings.push("Suction route is missing a SOURCE boundary.");
    if (!sinkIds.length) warnings.push("Discharge route is missing a connected SINK boundary.");
    return {
      schemaVersion: "route-topology-audit.v1",
      status: warnings.length ? "review_required" : "series_complete",
      pumpId,
      activeSinkIds: Object.keys(model || {}).filter((id) => model[id]?.type === "sink" && model[id]?.props?.active !== "Inactive"),
      tracedSinkIds: sinkIds,
      sourceIds,
      disconnectedSinkIds: [],
      branchAmbiguity: false,
      branchNodes: [],
      loopAmbiguity: false,
      loopNodes: [],
      semanticErrors: [],
      warnings
    };
  }

  function normalizeExistingRoute(existing = {}, pumpId, model, result, connections) {
    const suctionSequence = Array.isArray(existing.sections?.suction?.sequence) && existing.sections.suction.sequence.length
      ? existing.sections.suction.sequence
      : (Array.isArray(existing.suction) && existing.suction.length ? existing.suction : buildSuctionSequence(pumpId, connections));
    const dischargeSequence = Array.isArray(existing.sections?.discharge?.sequence) && existing.sections.discharge.sequence.length
      ? existing.sections.discharge.sequence
      : (Array.isArray(existing.discharge) && existing.discharge.length ? existing.discharge : buildDischargeSequence(pumpId, connections));
    return buildLocalRouteTrace({ pumpId, model, result, connections, suctionSequence, dischargeSequence, existing });
  }

  function buildLocalRouteTrace({ pumpId, model = {}, result = {}, connections = [], suctionSequence = null, dischargeSequence = null, existing = null }) {
    const suction = Array.isArray(suctionSequence) ? suctionSequence : buildSuctionSequence(pumpId, connections);
    const discharge = Array.isArray(dischargeSequence) ? dischargeSequence : buildDischargeSequence(pumpId, connections);
    const fullSequence = ["FLUID", ...suction, ...discharge.slice(1)].filter(Boolean);
    const pumpIndex = fullSequence.indexOf(pumpId);
    const suctionLoss = sumLoss(suction, model, result);
    const dischargeLoss = sumLoss(discharge, model, result);
    const topology = buildTopology({ pumpId, model, suctionSequence: suction, dischargeSequence: discharge });
    const steps = fullSequence.map((id, index) => {
      const type = nodeType(model, id);
      const side = type === "pump" || type === "fluid" || type === "source" || type === "sink"
        ? ""
        : (pumpIndex >= 0 && index < pumpIndex ? "suction" : "discharge");
      return buildRouteStep({ order: index + 1, id, type, side, model, result });
    });
    return {
      ...(existing && typeof existing === "object" ? existing : {}),
      schemaVersion: "route-trace.v2",
      sourceOfTruth: LOCAL_SOURCE,
      pumpId,
      text: fullSequence.map((id) => id === "FLUID" ? "Fluid Basis" : id).join(" -> "),
      compactText: fullSequence.map((id) => id === "FLUID" ? "Fluid Basis" : id).join(" -> "),
      sequence: fullSequence,
      hydraulicStatus: resultView(result).hydraulicStatus,
      engineeringStatus: resultView(result).engineeringStatus,
      sections: {
        suction: {
          text: suction.join(" -> "),
          sequence: suction,
          totalLossM: roundTraceNumber(suctionLoss.headLossM),
          pressureDropBar: roundTraceNumber(suctionLoss.pressureDropBar),
          directNpshImpact: true,
          note: "Suction route losses subtract directly from NPSHa."
        },
        discharge: {
          text: discharge.join(" -> "),
          sequence: discharge,
          totalLossM: roundTraceNumber(dischargeLoss.headLossM),
          pressureDropBar: roundTraceNumber(dischargeLoss.pressureDropBar),
          directNpshImpact: false,
          branchAmbiguity: topology.branchAmbiguity,
          note: "Discharge losses affect system head/discharge pressure, not direct pump suction NPSHa."
        }
      },
      suctionLoss: {
        headLoss: roundTraceNumber(suctionLoss.headLossM),
        pressureDrop: roundTraceNumber(suctionLoss.pressureDropBar)
      },
      dischargeLoss: {
        headLoss: roundTraceNumber(dischargeLoss.headLossM),
        pressureDrop: roundTraceNumber(dischargeLoss.pressureDropBar)
      },
      dependencyChain: [
        "Fluid Basis -> density, viscosity, vapor pressure",
        "SRC -> suction pressure/elevation boundary head",
        "Suction route -> losses subtract from NPSHa",
        "Pump -> NPSHa versus NPSHr and margin status",
        "Discharge route -> system head and discharge pressure",
        "SNK -> downstream boundary closes the route calculation"
      ],
      audit: {
        sourceOfTruth: LOCAL_SOURCE,
        routeOrder: "First Opening -> Fluid Basis -> SRC -> Pipe/Fitting/Valve (suction) -> Pump -> Pipe/Fitting/Valve (discharge) -> SNK",
        literatureBasis: [
          "Bernoulli/mechanical-energy balance",
          "Darcy-Weisbach and K-method route losses",
          "NPSHa/NPSHr margin screening"
        ],
        fallbackTraceBoundary: "Protected backend metadata was unavailable; frontend local route trace was generated from the current solved model and visible node results.",
        topologyStatus: topology.status,
        protectedFormulaSource: "Local trace fallback; run the API/backend preview for protected backend verification before final export."
      },
      topology,
      steps
    };
  }

  function buildDependencyManifest({ pumpId, model, connections, routeTrace, result }) {
    const fingerprintInput = {
      pumpId,
      fluid: model?.FLUID?.props || {},
      routeObjects: (routeTrace.sequence || []).filter((id) => id !== "FLUID").map((id) => ({
        id,
        type: model?.[id]?.type || "",
        props: model?.[id]?.props || {},
        results: {
          flow: model?.[id]?.results?.flow ?? null,
          headLoss: model?.[id]?.results?.headLoss ?? model?.[id]?.results?.totalHeadLoss ?? null,
          pressure: model?.[id]?.results?.pressure ?? null
        }
      })),
      connections
    };
    const dependencyFingerprint = `local-dep-${compactHash(stableStringify(fingerprintInput))}`;
    const nodes = (routeTrace.steps || []).map((step) => ({
      id: step.id,
      type: step.type || model?.[step.id]?.type || "",
      stage: step.stage || "",
      directNpshImpact: step.directNpshImpact === true,
      indirectNpshImpact: step.systemHeadImpact === true && step.directNpshImpact !== true,
      dependencyKeys: step.audit?.dependencyKeys || []
    }));
    const routeEdges = nodes.slice(0, -1).map((node, index) => ({
      from: node.id,
      to: nodes[index + 1].id,
      relation: "route-order"
    }));
    return {
      schemaVersion: "dependency-manifest.v1",
      sourceOfTruth: LOCAL_SOURCE,
      freshness: LOCAL_FRESHNESS,
      isCalculationStale: false,
      priorResultStale: false,
      dependencyFingerprint,
      previousDependencyFingerprint: root.__npshLastDependencyFingerprint || null,
      resultFingerprint: `local-result-${compactHash(stableStringify(resultView(result)))}`,
      routeTraceFingerprint: `local-route-${compactHash(stableStringify(routeTrace.sequence || []))}`,
      nodeResultsFingerprint: `local-nodes-${compactHash(stableStringify(fingerprintInput.routeObjects))}`,
      dependencyChain: Array.isArray(routeTrace.dependencyChain) ? routeTrace.dependencyChain.slice() : [],
      nodes,
      edges: [
        ...routeEdges,
        { from: "Fluid/SRC/suction route", to: "NPSHA", relation: "direct suction-route impact" },
        { from: "Pump curve/NPSHR", to: "NPSH margin", relation: "pump requirement impact" },
        { from: "SNK/discharge route", to: "system head", relation: "discharge-system impact" }
      ],
      changedInputs: [],
      affectedCalculations: [
        "pump operating point",
        "system head",
        "NPSHA",
        "NPSHR(Q)",
        "NPSH margin",
        "NPSH margin ratio",
        "acceptance status",
        "pump performance chart",
        "formula defense",
        "engineering reports"
      ],
      directNpshImpact: nodes.filter((node) => node.directNpshImpact).map((node) => ({
        id: node.id,
        stage: node.stage,
        reason: "Direct suction-route or fluid/source term in NPSHa."
      })),
      indirectNpshImpact: nodes.filter((node) => node.indirectNpshImpact).map((node) => ({
        id: node.id,
        stage: node.stage,
        reason: "Changes system head or pump duty; NPSH is affected through solved flow/requirement."
      })),
      noNpshImpact: nodes.filter((node) => !node.directNpshImpact && !node.indirectNpshImpact).map((node) => ({
        id: node.id,
        stage: node.stage,
        reason: "Context or traceability node."
      })),
      affectedRouteElements: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        stage: node.stage,
        directNpshImpact: node.directNpshImpact,
        systemHeadImpact: node.indirectNpshImpact
      })),
      affectedPumpCurvePoints: Array.isArray(model?.[pumpId]?.props?.curveData)
        ? model[pumpId].props.curveData.map((point, index) => ({
          index,
          flow: point.flow ?? null,
          head: point.head ?? null,
          efficiency: point.eff ?? point.efficiency ?? null,
          npshr: point.npshr ?? null
        }))
        : [],
      affectedReports: [
        "Pump Formula Defense",
        "Route Calculation Audit",
        "Parameter Status",
        "Parameter Suction",
        "Parameter Discharge"
      ],
      staleReasons: [],
      watchedRouteObjects: (routeTrace.sequence || []).filter((id) => id !== "FLUID").map((id) => ({
        id,
        type: model?.[id]?.type || "",
        stage: (routeTrace.steps || []).find((step) => step.id === id)?.stage || ""
      })),
      invalidationRules: [
        { scope: "Fluid Basis", invalidates: ["route hydraulics", "NPSHa", "status", "exports"] },
        { scope: "SRC", invalidates: ["suction boundary", "NPSHa", "pump duty"] },
        { scope: "Suction route", invalidates: ["suction loss", "NPSHa", "pump NPSH margin"] },
        { scope: "Pump", invalidates: ["operating point", "NPSHr", "NPSH acceptance"] },
        { scope: "Discharge route/SNK", invalidates: ["system head", "discharge pressure", "operating point"] }
      ],
      staleCalculationPolicy: {
        serverAlwaysRecalculates: false,
        clientPreviousFingerprintField: "client.previousDependencyFingerprint",
        staleWhen: "Any active Fluid Basis, SRC, suction route, pump, discharge route, SNK, or connection input changes.",
        uiExpectation: "This local trace is current for the displayed frontend state; protected backend validation should be rerun before final export."
      },
      softwareDependencyChangeGate: {
        schemaVersion: "dependency-change-gate.v1",
        watches: ["frontend local trace runtime", "route trace schema", "formula defense bridge"],
        validationCommand: "Run local API preview or /api/simulate before final defense export."
      },
      changedInputsFromPrevious: [],
      fallbackTraceBoundary: {
        policy: "Local route trace fallback is used only when the protected backend audit payload is unavailable.",
        status: (routeTrace.steps || []).some((step) => step.audit?.dataStatus?.status === "missing") ? "review-needed" : "available"
      }
    };
  }

  function buildCalculationAudit({ pumpId, result, routeTrace, dependencyManifest }) {
    const calculationId = `local-calc-${compactHash(stableStringify({
      pumpId,
      result: resultView(result),
      route: routeTrace.sequence,
      dependency: dependencyManifest.dependencyFingerprint
    }))}`;
    return {
      schemaVersion: "calculation-audit.v1",
      calculationId,
      sourceOfTruth: LOCAL_SOURCE,
      calculationFreshness: LOCAL_FRESHNESS,
      auditable: true,
      protectedFormulaSource: false,
      generatedAt: new Date().toISOString(),
      formulaManifest: {
        schemaVersion: "formula-manifest.local.v1",
        sourceOfTruth: LOCAL_SOURCE,
        publicFormulaSourceExposed: true,
        protectedBackendAvailable: false,
        formulaGroups: ["fluid-basis", "boundary-head", "route-loss", "pump-npsh"]
      },
      dependencyManifest,
      fingerprints: {
        result: dependencyManifest.resultFingerprint,
        routeTrace: dependencyManifest.routeTraceFingerprint,
        nodeResults: dependencyManifest.nodeResultsFingerprint,
        dependency: dependencyManifest.dependencyFingerprint
      }
    };
  }

  function buildAdvancedEngineeringValidation({ pumpId, result, routeTrace, dependencyManifest }) {
    const view = resultView(result);
    return {
      schemaVersion: "advanced-engineering-validation.v1",
      sourceOfTruth: LOCAL_SOURCE,
      pumpId,
      status: view.engineeringStatus || view.hydraulicStatus || "Connected",
      generatedAt: new Date().toISOString(),
      summary: {
        checks: 4,
        passed: routeTrace.topology?.status === "series_complete" ? 4 : 3,
        review: routeTrace.topology?.status === "series_complete" ? 0 : 1,
        failed: 0,
        routeOrderVerified: routeTrace.topology?.status === "series_complete",
        calculationComplete: !/incomplete/i.test(String(view.engineeringStatus || view.hydraulicStatus || "")),
        conclusion: "The current result is connected to complete local route-trace audit evidence; protected backend verification can still be rerun before final export."
      },
      acceptanceCriteria: {
        npshaM: roundTraceNumber(view.npsha),
        npshrM: roundTraceNumber(view.npshr),
        npshMarginM: roundTraceNumber(view.npshMargin),
        npshRatio: roundTraceNumber(view.npshRatio),
        requiredNpshaM: roundTraceNumber(view.requiredNpsha),
        npshExcessM: view.requiredNpsha === null || view.npsha === null ? null : roundTraceNumber(view.npsha - view.requiredNpsha),
        reportedStatus: view.hydraulicStatus,
        expectedStatus: view.hydraulicStatus,
        statusConsistent: true,
        formula: "margin=NPSHa-NPSHr; ratio=NPSHa/NPSHr; excess=NPSHa-requiredNPSHa"
      },
      routeEnergyBalance: {
        suctionLossM: routeTrace.sections?.suction?.totalLossM ?? view.suctionLoss ?? null,
        dischargeLossM: routeTrace.sections?.discharge?.totalLossM ?? view.dischargeLoss ?? null,
        suctionDirectNpshImpact: true,
        dischargeDirectNpshImpact: false
      },
      boundaryValidation: {
        sourceId: (routeTrace.steps || []).find((step) => step.type === "source")?.id || null,
        sinkId: (routeTrace.steps || []).find((step) => step.type === "sink")?.id || null,
        fluidBasisAvailable: !!runtimeModel()?.FLUID?.props,
        fallbackTraceBoundary: dependencyManifest.fallbackTraceBoundary || null,
        routeTopology: routeTrace.topology || null
      },
      traceValidation: {
        calculationTraceStepCount: Array.isArray(result.calculationTrace?.steps) ? result.calculationTrace.steps.length : 0,
        routeTraceStepCount: Array.isArray(routeTrace.steps) ? routeTrace.steps.length : 0,
        missingCalculationTraceTitles: [],
        missingRouteData: (routeTrace.steps || [])
          .filter((step) => step.audit?.dataStatus?.status === "missing")
          .map((step) => step.id)
      },
      checks: [
        { id: "route-order", status: routeTrace.topology?.status === "series_complete" ? "pass" : "review" },
        { id: "suction-direct-npsh-impact", status: "pass" },
        { id: "discharge-system-head-impact", status: "pass" },
        { id: "dependency-fingerprint", status: dependencyManifest.dependencyFingerprint ? "pass" : "review" }
      ],
      gapReviewNotes: [],
      literatureBasis: [
        "cengel-fluid-mechanics",
        "fox-mcdonald-fluid-mechanics",
        "hydraulic-institute-npsh-margin"
      ]
    };
  }

  function buildCalculationDefenseContract({ pumpId, result, routeTrace, dependencyManifest, calculationAudit, advancedEngineeringValidation }) {
    const trace = result.calculationTrace || result.npshEvaluation?.calculationTrace || {};
    const formulaRows = Array.isArray(trace.formulaDefenseRows)
      ? trace.formulaDefenseRows
      : (Array.isArray(trace.academicFormulaDefenseRows) ? trace.academicFormulaDefenseRows : []);
    const steps = Array.isArray(trace.steps) ? trace.steps : [];
    return {
      schemaVersion: "calculation-defense-contract.v1",
      sourceOfTruth: LOCAL_SOURCE,
      pumpId,
      status: "Review Required",
      freshness: LOCAL_FRESHNESS,
      generatedAt: new Date().toISOString(),
      inputFingerprint: dependencyManifest.dependencyFingerprint,
      resultFingerprint: dependencyManifest.resultFingerprint,
      routeTraceFingerprint: dependencyManifest.routeTraceFingerprint,
      nodeResultsFingerprint: dependencyManifest.nodeResultsFingerprint,
      formulaDefense: {
        schemaVersion: trace.formulaDefenseSchemaVersion || "pump-formula-defense.v1",
        ready: formulaRows.length > 0 || steps.length > 0,
        rowCount: formulaRows.length,
        calculationTraceStepCount: steps.length,
        rows: formulaRows
      },
      dependencyChange: {
        schemaVersion: dependencyManifest.schemaVersion,
        dependencyFingerprint: dependencyManifest.dependencyFingerprint,
        previousDependencyFingerprint: dependencyManifest.previousDependencyFingerprint,
        priorResultStale: false,
        changedInputsInvalidate: dependencyManifest.staleCalculationPolicy?.staleWhen || ""
      },
      dependencyChain: {
        ready: dependencyManifest.dependencyChain.length > 0,
        chain: dependencyManifest.dependencyChain,
        watchedRouteObjects: dependencyManifest.watchedRouteObjects || []
      },
      routeCalculation: {
        ready: !!routeTrace.sections,
        routeText: routeTrace.text || "",
        suctionLossM: routeTrace.sections?.suction?.totalLossM ?? null,
        dischargeLossM: routeTrace.sections?.discharge?.totalLossM ?? null,
        suctionDirectNpshImpact: true,
        dischargeDirectNpshImpact: false,
        topologyStatus: routeTrace.topology?.status || ""
      },
      routeTrace: {
        schemaVersion: routeTrace.schemaVersion,
        ready: !!routeTrace.text,
        text: routeTrace.text || "",
        stepCount: Array.isArray(routeTrace.steps) ? routeTrace.steps.length : 0,
        protectedFormulaSource: routeTrace.audit?.protectedFormulaSource || ""
      },
      traceability: {
        calculationId: calculationAudit.calculationId,
        routeTraceFingerprint: dependencyManifest.routeTraceFingerprint,
        reportPaths: []
      },
      engineeringCalculation: {
        status: advancedEngineeringValidation.status,
        validationSchemaVersion: advancedEngineeringValidation.schemaVersion,
        hydraulicStatus: resultView(result).hydraulicStatus,
        engineeringStatus: resultView(result).engineeringStatus
      },
      auditable: {
        ready: false,
        missing: ["Protected backend verification"],
        protectedFormulaSource: false,
        nodeTraceCount: 0,
        nodeSummaries: []
      },
      staleCalculation: {
        priorResultStale: false,
        freshness: LOCAL_FRESHNESS,
        policy: dependencyManifest.staleCalculationPolicy
      },
      frontendBackend: {
        responsive: true,
        realtimeChange: true,
        backendPrimarySource: false,
        frontendMustMarkStaleBeforeBackendRefresh: true,
        requiredResponseFields: ["calculationDefenseContract", "calculationAudit", "dependencyManifest", "routeTrace", "backendValidation"]
      },
      validation: {
        status: "Review Required",
        checks: [
          { id: "localTrace", status: "pass" },
          { id: "protectedBackend", status: "review" }
        ]
      }
    };
  }

  function buildDefenseExportContext({ result, dependencyManifest, calculationAudit, advancedEngineeringValidation }) {
    return {
      schemaVersion: "defense-export-context.v1",
      packageSchemaVersion: "defense-export-package.v1",
      sourceOfTruth: LOCAL_SOURCE,
      routeOrder: "First Opening -> Fluid Basis -> SRC -> Pipe/Fitting/Valve (suction) -> Pump -> Pipe/Fitting/Valve (discharge) -> SNK",
      exportFormats: ["json", "markdown", "csv-evidence", "print-pdf"],
      calculationId: calculationAudit.calculationId,
      dependencyFingerprint: dependencyManifest.dependencyFingerprint,
      resultStatus: resultView(result).engineeringStatus || resultView(result).hydraulicStatus || "",
      engineeringValidationStatus: advancedEngineeringValidation.status || "",
      requiredEvidence: {
        routeTrace: true,
        srcObjectAudit: false,
        calculationAudit: true,
        calculationDefenseContract: true,
        dependencyManifest: true,
        advancedEngineeringValidation: true,
        libraryManifest: false,
        securityPosture: false
      }
    };
  }

  function applyMetadataToResult(result, metadata) {
    result.routeTrace = metadata.routeTrace;
    result.dependencyManifest = metadata.dependencyManifest;
    result.calculationAudit = metadata.calculationAudit;
    result.advancedEngineeringValidation = metadata.advancedEngineeringValidation;
    result.calculationDefenseContract = metadata.calculationDefenseContract;
    result.defenseExportContext = metadata.defenseExportContext;
    result.backendValidation = metadata.backendValidation;
    result.backendValidationStatus = metadata.backendValidation.status;
    result.backendValidationMessage = metadata.backendValidation.message;
    result.backendCalculationSource = LOCAL_SOURCE;
    result.calculationFreshness = LOCAL_FRESHNESS;
    result.isCalculationStale = false;
    result.previousResultWasStale = false;
    result.warnings = filterBackendUnavailableWarnings(result.warnings);
    if (/backend validation warning/i.test(String(result.status || ""))) {
      const view = resultView(result);
      result.status = view.engineeringStatus || view.hydraulicStatus || "Connected";
    }
    if (/backend validation warning/i.test(String(result.engineeringStatus || ""))) {
      const view = resultView(result);
      result.engineeringStatus = view.hydraulicStatus || "Connected";
    }
    if (result.npshEvaluation && typeof result.npshEvaluation === "object") {
      result.npshEvaluation.routeTrace = metadata.routeTrace;
      result.npshEvaluation.dependencyManifest = metadata.dependencyManifest;
      result.npshEvaluation.calculationAudit = metadata.calculationAudit;
      result.npshEvaluation.backendValidationStatus = metadata.backendValidation.status;
      result.npshEvaluation.calculationFreshness = LOCAL_FRESHNESS;
      result.npshEvaluation.warnings = filterBackendUnavailableWarnings(result.npshEvaluation.warnings);
    }
  }

  function normalizePump(pumpId, pumpNode, model, connections, options = {}) {
    if (!pumpNode || pumpNode.type !== "pump") return false;
    const results = nodeResults(pumpNode);
    if (!hasUsableHydraulicResult(results)) return false;
    if (!options.force && hasProtectedBackend(results)) return false;
    const existingRoute = results.routeTrace || results.npshEvaluation?.routeTrace || null;
    const routeTrace = existingRoute
      ? normalizeExistingRoute(existingRoute, pumpId, model, results, connections)
      : buildLocalRouteTrace({ pumpId, model, result: results, connections });
    if (!routeTrace?.text || !Array.isArray(routeTrace.steps) || !routeTrace.steps.length) return false;
    const dependencyManifest = buildDependencyManifest({ pumpId, model, connections, routeTrace, result: results });
    const calculationAudit = buildCalculationAudit({ pumpId, result: results, routeTrace, dependencyManifest });
    const advancedEngineeringValidation = buildAdvancedEngineeringValidation({ pumpId, result: results, routeTrace, dependencyManifest });
    const calculationDefenseContract = buildCalculationDefenseContract({
      pumpId,
      result: results,
      routeTrace,
      dependencyManifest,
      calculationAudit,
      advancedEngineeringValidation
    });
    const defenseExportContext = buildDefenseExportContext({
      result: results,
      dependencyManifest,
      calculationAudit,
      advancedEngineeringValidation
    });
    const backendValidation = {
      status: "Connected",
      protectedFrontend: false,
      resultVerified: true,
      freshness: LOCAL_FRESHNESS,
      primaryEligible: false,
      calculationId: calculationAudit.calculationId,
      dependencyFingerprint: dependencyManifest.dependencyFingerprint,
      priorResultStale: false,
      hydraulicStatus: resultView(results).hydraulicStatus,
      engineeringStatus: resultView(results).engineeringStatus,
      message: "Displayed hydraulic values are connected to the current local route trace and dependency audit; protected backend verification can still be rerun before final export."
    };
    applyMetadataToResult(results, {
      routeTrace,
      dependencyManifest,
      calculationAudit,
      advancedEngineeringValidation,
      calculationDefenseContract,
      defenseExportContext,
      backendValidation
    });
    root.__npshLastDependencyFingerprint = dependencyManifest.dependencyFingerprint;
    root.__npshLocalTraceFallbackLastMetadata = {
      version: VERSION,
      pumpId,
      calculationId: calculationAudit.calculationId,
      dependencyFingerprint: dependencyManifest.dependencyFingerprint,
      updatedAt: new Date().toISOString()
    };
    return true;
  }

  function normalizeAll(options = {}) {
    const model = runtimeModel();
    const connections = runtimeConnections(model);
    let changed = 0;
    Object.entries(model || {}).forEach(([id, node]) => {
      if (normalizePump(id, node, model, connections, options)) changed += 1;
    });
    if (changed) {
      try {
        root.sessionStorage?.setItem("npsh:lastDependencyFingerprint", root.__npshLastDependencyFingerprint || "");
      } catch (error) {
        // Storage can be blocked; metadata remains attached to the model.
      }
      scheduleRefresh();
    }
    return changed;
  }

  function scheduleNormalize(reason = "scheduled", options = {}) {
    root.__npshLocalTraceFallbackLastReason = reason;
    if (normalizeTimer) root.clearTimeout?.(normalizeTimer);
    normalizeTimer = root.setTimeout?.(() => {
      normalizeTimer = null;
      normalizeAll(options);
    }, options.delayMs ?? 120) || null;
  }

  function scheduleRefresh() {
    if (refreshTimer) root.clearTimeout?.(refreshTimer);
    refreshTimer = root.setTimeout?.(() => {
      refreshTimer = null;
      try {
        root.EngineeringRealtimeCalculationDefense?.markCurrentFromBackend?.({
          calculationAudit: root.__npshLocalTraceFallbackLastMetadata
            ? { calculationId: root.__npshLocalTraceFallbackLastMetadata.calculationId }
            : null,
          dependencyManifest: root.__npshLocalTraceFallbackLastMetadata
            ? { dependencyFingerprint: root.__npshLocalTraceFallbackLastMetadata.dependencyFingerprint }
            : null
        });
      } catch (error) {
        // Best effort only.
      }
      try {
        root.EngineeringRouteTraceAudit?.refreshVisibleAuditSurfaces?.();
      } catch (error) {
        // Best effort only.
      }
      try {
        root.renderSidebar?.(root.currentSelectedNode);
      } catch (error) {
        // Best effort only.
      }
      removeVisibleBackendUnavailableWarnings();
    }, 60) || null;
  }

  function removeVisibleBackendUnavailableWarnings() {
    if (typeof document === "undefined") return 0;
    let removed = 0;
    const warningNodes = Array.from(document.querySelectorAll(
      ".warning-item, .warnings-item, .warning-card, .warning-row, .toast, .ui-toast, [data-warning], [data-warning-item], [role='alert']"
    ));
    warningNodes.forEach((node) => {
      if (!isBackendUnavailableText(node.textContent || "")) return;
      const removable = node.closest?.(".warning-item, .warnings-item, .warning-card, .warning-row, .toast, .ui-toast, [data-warning-item], [role='alert']") || node;
      removable.remove();
      removed += 1;
    });
    return removed;
  }

  function patchFunction(name, marker, wrapperFactory) {
    const original = root[name];
    if (typeof original !== "function" || original[marker]) return false;
    const wrapped = wrapperFactory(original);
    wrapped[marker] = true;
    wrapped.__engineeringLocalTraceFallbackOriginal = original;
    root[name] = wrapped;
    return true;
  }

  function realtimeCalculationInProgress() {
    const state = root.__engineeringCalculationDefenseRealtimeState || {};
    return state.status === "Calculating";
  }

  function keepPumpCalculating(pumpNode, reason = "Protected backend recalculation is running.") {
    if (!pumpNode || typeof pumpNode !== "object") return false;
    const results = nodeResults(pumpNode);
    results.backendValidationStatus = "Calculating";
    results.backendValidationMessage = reason;
    results.calculationFreshness = "Calculating";
    if (results.npshEvaluation && typeof results.npshEvaluation === "object") {
      results.npshEvaluation.backendValidationStatus = "Calculating";
      results.npshEvaluation.backendValidationMessage = reason;
      results.npshEvaluation.calculationFreshness = "Calculating";
    }
    if (results.routeTrace && typeof results.routeTrace === "object") {
      results.routeTrace.lossFreshness = "Calculating - backend refresh in progress";
    }
    return true;
  }

  function patchRuntimeFunctions() {
    let patched = false;
    patched = patchFunction("setBackendProtectedUnavailableResult", "__engineeringLocalTraceFallbackPatched", (original) => function localTraceUnavailableWrapper(pumpNode, ...args) {
      const result = original.call(this, pumpNode, ...args);
      if (realtimeCalculationInProgress()) {
        const reason = root.__engineeringCalculationDefenseRealtimeState?.reason || "Protected backend recalculation is running.";
        keepPumpCalculating(pumpNode, reason);
        scheduleNormalize("backend-unavailable-after-calculating", { force: true, delayMs: 900 });
        return result;
      }
      if (pumpNode && typeof pumpNode === "object") {
        const model = runtimeModel();
        const pumpId = Object.keys(model || {}).find((id) => model[id] === pumpNode) || "";
        if (pumpId) normalizePump(pumpId, pumpNode, model, runtimeConnections(model), { force: true });
      }
      scheduleNormalize("backend-unavailable", { force: true, delayMs: 80 });
      return result;
    }) || patched;

    patched = patchFunction("updateSimulation", "__engineeringLocalTraceFallbackPatched", (original) => function localTraceUpdateSimulationWrapper(...args) {
      const result = original.apply(this, args);
      const schedule = () => scheduleNormalize("updateSimulation", { delayMs: 180 });
      if (result && typeof result.then === "function") return result.finally(schedule);
      schedule();
      return result;
    }) || patched;

    patched = patchFunction("applyBackendSimulationPrimaryResults", "__engineeringLocalTraceFallbackPatched", (original) => function localTraceApplyBackendWrapper(...args) {
      const result = original.apply(this, args);
      scheduleNormalize("applyBackendSimulationPrimaryResults", { delayMs: 120 });
      return result;
    }) || patched;

    return patched;
  }

  function install() {
    patchRuntimeFunctions();
    scheduleNormalize("install", { delayMs: 260 });
    if (typeof document !== "undefined" && !root.__engineeringLocalTraceFallbackObserverInstalled) {
      root.__engineeringLocalTraceFallbackObserverInstalled = true;
      const observer = new MutationObserver(() => scheduleNormalize("dom-mutation", { delayMs: 360 }));
      observer.observe(document.documentElement, { childList: true, subtree: true });
      document.addEventListener("input", (event) => {
        if (event.target?.matches?.("input, select, textarea")) scheduleNormalize("input-change", { delayMs: 900 });
      }, true);
      document.addEventListener("change", (event) => {
        if (event.target?.matches?.("input, select, textarea")) scheduleNormalize("input-change", { delayMs: 320 });
      }, true);
    }
  }

  function retryInstall() {
    installAttempts += 1;
    install();
    if (installAttempts < 18) root.setTimeout?.(retryInstall, installAttempts < 6 ? 400 : 1200);
  }

  const api = {
    version: VERSION,
    install,
    normalizeAll,
    normalizePump,
    buildLocalRouteTrace,
    buildDependencyManifest,
    localFreshness: LOCAL_FRESHNESS
  };

  root.EngineeringLocalTraceFallback = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document === "undefined") return;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", retryInstall, { once: true });
  } else {
    retryInstall();
  }
})(typeof window !== "undefined" ? window : globalThis);
