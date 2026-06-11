!function(root) {
  "use strict";

  const VERSION = "2026.06-pipe-source-confidence-map1";
  const CACHE_KEY = "20260611-pipe-source-confidence-map1";
  const EMPTY_SOURCE_MAP_TEXT = "No pipe source map available.";
  const TABLE_SELECTOR = ".pipe-formula-defense-source-table, .pipe-formula-defense-task-window .pipe-source-map-table, .pipe-source-map-table";

  let installAttempts = 0;
  let observer = null;

  function runtimeModel() {
    try {
      if (typeof globalModel !== "undefined" && globalModel) return globalModel;
    } catch (error) {
      // Protected builds may not expose globalModel as a direct binding.
    }
    return root.globalModel || root.__npshGlobalModel || {};
  }

  function runtimeConnections(modelRef = runtimeModel()) {
    try {
      if (typeof connections !== "undefined" && Array.isArray(connections)) return connections;
    } catch (error) {
      // Protected builds may not expose connections as a direct binding.
    }
    const candidates = [
      root.connections,
      root.__npshConnections,
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

  function roundNumber(value, digits = 6) {
    const number = finiteNumber(value);
    return number === null ? null : Number(number.toFixed(digits));
  }

  function displayNumber(value, digits = 3) {
    const number = finiteNumber(value);
    if (number === null) return "-";
    if (Math.abs(number) > 0 && Math.abs(number) < 0.0001) return number.toExponential(5);
    return number.toFixed(digits);
  }

  function sourceMapItem(parameter, value, unit, status, method, formula, reference) {
    return { parameter, value, unit: unit || "", status, method, formula, reference };
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

  function buildSuctionSequence(pumpId, connections = []) {
    const sequence = [pumpId];
    const visited = new Set([pumpId]);
    let current = pumpId;
    for (let guard = 0; guard < 80; guard += 1) {
      const connection = hydraulicConnections(connections)
        .find((item) => connectionTo(item) === current && !visited.has(connectionFrom(item)));
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
    const sequence = [pumpId];
    const visited = new Set([pumpId]);
    let current = pumpId;
    for (let guard = 0; guard < 80; guard += 1) {
      const connection = hydraulicConnections(connections)
        .find((item) => connectionFrom(item) === current && !visited.has(connectionTo(item)));
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

  function inferPumpPathRole(pipeId, trace = {}, model = runtimeModel(), connections = runtimeConnections(model), results = {}) {
    if (typeof root.getPipePumpPathRole === "function") {
      try {
        const role = root.getPipePumpPathRole(pipeId, model, connections, results);
        if (role && role.role && role.role !== "-") return role;
      } catch (error) {
        // Fall back to local path inference.
      }
    }

    const existing = trace?.pumpPathRole || results?.calculationTrace?.pumpPathRole;
    if (existing && existing.role && existing.role !== "-") return existing;

    const pumps = Object.keys(model || {}).filter((id) => model?.[id]?.type === "pump");
    for (const pumpId of pumps) {
      if (buildSuctionSequence(pumpId, connections).includes(pipeId)) {
        return {
          role: "Suction path",
          pumpId,
          basis: "Solved hydraulic network state",
          impact: "Reduces NPSH.",
          calculationUse: "Total pipe loss is subtracted from suction boundary head before pump suction NPSHa is calculated."
        };
      }
      if (buildDischargeSequence(pumpId, connections).includes(pipeId)) {
        return {
          role: "Discharge path",
          pumpId,
          basis: "Solved hydraulic network state",
          impact: "Adds required pump head.",
          calculationUse: "Total pipe loss is added to required discharge/system head."
        };
      }
    }

    return {
      role: "Unknown",
      pumpId: "-",
      basis: "Path not resolved",
      impact: "-",
      calculationUse: "No pump calculation impact resolved."
    };
  }

  function fluidBasis(trace = {}, model = runtimeModel(), fluidInput = null) {
    const props = fluidInput || model?.FLUID?.props || {};
    const basis = trace?.basis || {};
    return {
      density: firstFiniteValue(props.density, basis.density, basis.densityKgM3, 1000),
      viscosityCSt: firstFiniteValue(props.viscosity, props.kinematicViscosity, basis.viscosityCSt, basis.viscosity, 1),
      vaporPressureBarA: firstFiniteValue(props.vaporPressure, basis.vaporPressureBarA, basis.vaporPressure, 0)
    };
  }

  function normalizedDiameter(value) {
    const number = finiteNumber(value);
    if (number === null || number <= 0) return null;
    return number > 5 ? number / 1000 : number;
  }

  function normalizedRoughness(value) {
    const number = finiteNumber(value);
    if (number === null || number < 0) return null;
    return number > 0.02 ? number / 1000 : number;
  }

  function calculatedSegments(flow, props, pipeId) {
    if (typeof root.calculatePipeHydraulicSegments !== "function" || firstFiniteValue(flow) === null || !props) {
      return [];
    }
    try {
      const segments = root.calculatePipeHydraulicSegments(flow, props || {}, null, pipeId);
      return Array.isArray(segments) ? segments : [];
    } catch (error) {
      return [];
    }
  }

  function segmentByIndex(segments = [], index = 0) {
    return (Array.isArray(segments) ? segments : []).find((segment) => Number(segment?.index) === Number(index))
      || (Array.isArray(segments) ? segments : [])[0]
      || {};
  }

  function propsSegment(props = {}, index = 0) {
    const segments = Array.isArray(props?.segments) ? props.segments : [];
    return segments[index] || segments[0] || {};
  }

  function sourceFrom(segmentSource, fallbackStatus, fallbackSource) {
    return {
      status: segmentSource?.status || fallbackStatus || "User",
      source: segmentSource?.source || fallbackSource || "Pipe Object Properties input"
    };
  }

  function pipePropsTotalK(props = {}) {
    const segments = Array.isArray(props?.segments) ? props.segments : [];
    if (!segments.length) return null;
    let hasValue = false;
    const total = segments.reduce((sum, segment) => {
      const quantity = Math.max(0, firstFiniteValue(segment.fittingQuantity, segment.quantity, 0) || 0);
      const fittingK = Math.max(0, firstFiniteValue(segment.fittingK, segment.k, 0) || 0);
      const additionalK = Math.max(0, firstFiniteValue(segment.additionalK, segment.minorLoss, 0) || 0);
      if (quantity || fittingK || additionalK) hasValue = true;
      return sum + quantity * fittingK + additionalK;
    }, 0);
    return hasValue ? total : null;
  }

  function sumSegmentValue(segments = [], key) {
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

  function tracePressure(trace = {}, key, fromEnd = false) {
    const segments = Array.isArray(trace?.segments) ? trace.segments : [];
    const ordered = fromEnd ? segments.slice().reverse() : segments;
    for (const segment of ordered) {
      const profile = segment?.profile || {};
      const value = firstFiniteValue(profile[key], segment?.[key]);
      if (value !== null) return value;
    }
    return null;
  }

  function pressureProfileStatus(results = {}, trace = {}) {
    return [
      results.pressure,
      results.inletPressure,
      results.outletPressure,
      results.highPointPressure,
      tracePressure(trace, "startPressure", false),
      tracePressure(trace, "endPressure", true),
      trace?.totals?.highPointPressure
    ].some((value) => finiteNumber(value) !== null);
  }

  function buildPipeSourceConfidenceMap(context = {}) {
    const model = runtimeModel();
    const pipeId = context.pipeId || "";
    const pipe = context.pipe || model?.[pipeId] || {};
    const props = context.props || pipe.props || {};
    const results = context.results || pipe.results || {};
    const trace = context.trace || results.calculationTrace || {};
    const flow = firstFiniteValue(context.flow, results.flow, trace?.basis?.flowM3H, props.flow);
    const flowM3S = flow === null ? null : flow / 3600;
    const basis = fluidBasis(trace, model, context.fluid);
    const segments = Array.isArray(trace?.segments) && trace.segments.length
      ? trace.segments
      : calculatedSegments(flow, props, pipeId);
    const firstTraceSegment = segmentByIndex(segments, 0);
    const firstPropsSegment = propsSegment(props, firstTraceSegment.index || 0);
    const profile = firstTraceSegment.profile || {};
    const sizeSource = sourceFrom(
      firstTraceSegment.sizeSource || firstTraceSegment.dataSources?.size,
      firstPropsSegment.pipeSize && firstPropsSegment.pipeSize !== "Custom diameter" ? "Standard" : "User",
      firstPropsSegment.pipeSize || "User-entered internal diameter"
    );
    const materialSource = sourceFrom(
      firstTraceSegment.materialSource || firstTraceSegment.dataSources?.material,
      firstPropsSegment.material && firstPropsSegment.material !== "Custom roughness" ? "Typical" : "User",
      firstPropsSegment.material || "User-entered roughness"
    );
    const fittingSource = sourceFrom(
      firstTraceSegment.fittingSource || firstTraceSegment.dataSources?.fitting,
      firstPropsSegment.fittingType && firstPropsSegment.fittingType !== "None" ? "Typical" : "All segments",
      firstPropsSegment.fittingType || "Sum of segment fitting/additional K values"
    );
    const diameter = firstFiniteValue(firstTraceSegment.diameter, normalizedDiameter(firstPropsSegment.diameter));
    const roughness = firstFiniteValue(firstTraceSegment.roughness, normalizedRoughness(firstPropsSegment.roughness));
    const totalK = firstFiniteValue(trace?.totals?.totalK, results.totalK, sumSegmentValue(segments, "minorLossK"), pipePropsTotalK(props));
    const pipePressure = firstFiniteValue(
      results.pressure,
      results.pipePressure,
      profile.pressure,
      profile.midPressure,
      (firstFiniteValue(results.inletPressure, profile.startPressure) !== null
        && firstFiniteValue(results.outletPressure, profile.endPressure) !== null)
        ? (firstFiniteValue(results.inletPressure, profile.startPressure) + firstFiniteValue(results.outletPressure, profile.endPressure)) / 2
        : null
    );
    const inletPressure = firstFiniteValue(results.inletPressure, results.pin, results.pressureIn, profile.startPressure, tracePressure(trace, "startPressure", false));
    const outletPressure = firstFiniteValue(results.outletPressure, results.pout, results.pressureOut, profile.endPressure, tracePressure(trace, "endPressure", true));
    const hasPressureProfile = pressureProfileStatus(results, trace);
    const role = inferPumpPathRole(pipeId, trace, model, runtimeConnections(model), results);
    const allowance = firstFiniteValue(props.headLossAllowancePercent, trace?.basis?.headLossAllowancePercent, 0);

    return [
      sourceMapItem("Flow", roundNumber(flow, 6), "m3/h", flow !== null && flow > 0 ? "Network-derived" : "Waiting for solved network", "Solved solid hydraulic pipe path", "Q_m3/s = Q_m3/h / 3600", "Hydraulic network flow balance"),
      sourceMapItem("Flow conversion", roundNumber(flowM3S, 8), "m3/s", flow !== null && flow > 0 ? "Formula verified" : "Waiting for solved network", "Unit conversion", "Q = flow / 3600", "SI unit conversion"),
      sourceMapItem("Density (rho)", roundNumber(basis.density, 4), "kg/m3", "Fluid Basis", "Active Fluid Basis property", "rho = Fluid Basis density", "Required for pressure/head conversion"),
      sourceMapItem("Kinematic viscosity (nu)", roundNumber(basis.viscosityCSt, 6), "cSt", "Fluid Basis", "Active Fluid Basis property", "nu = cSt x 1e-6 m2/s", "Required for Reynolds number"),
      sourceMapItem("Vapor pressure (P_v)", roundNumber(basis.vaporPressureBarA, 6), "bar a", "Fluid Basis", "Active Fluid Basis absolute vapor pressure", "Margin = P_high_point - P_vapor", "Required for high point and NPSH screening"),
      sourceMapItem("Pipe Pressure", roundNumber(pipePressure, 6), "bar a", pipePressure !== null ? "Network-derived realtime" : "Waiting for solved network", "Live pipe mid-point static pressure readout", "P_pipe = pressureHeadToBar(H_mid - z_mid - V^2/2g, rho)", "Same value source as Pipe Object Properties > Pipe Pressure"),
      sourceMapItem("Inlet Pressure", roundNumber(inletPressure, 6), "bar a", inletPressure !== null ? "Network-derived realtime" : "Waiting for solved network", "Live pipe inlet static pressure readout", "P_in = pressureHeadToBar(H_in - z_in - V^2/2g, rho)", "Same value source as Pipe Object Properties > Inlet Pressure"),
      sourceMapItem("Outlet Pressure", roundNumber(outletPressure, 6), "bar a", outletPressure !== null ? "Network-derived realtime" : "Waiting for solved network", "Live pipe outlet static pressure readout", "P_out = pressureHeadToBar(H_out - z_out - V^2/2g, rho)", "Same value source as Pipe Object Properties > Outlet Pressure"),
      sourceMapItem("Pump Path Role", role.role || "Unknown", "", role.pumpId && role.pumpId !== "-" ? role.pumpId : role.basis || "Path not resolved", role.basis || "Solved hydraulic network state", "role = pipeId in suctionPath.steps or dischargePath.steps", "Suction path reduces NPSHa; discharge path adds required pump head"),
      sourceMapItem("Pump Calculation Impact", role.impact || "-", "", role.role || "Unknown", role.calculationUse || "No pump calculation impact resolved.", role.role === "Suction path" ? "NPSHa = H_suction_boundary - hL_suction - z_pump - H_vapor" : role.role === "Discharge path" ? "H_required = delta boundary head + hL_suction + hL_discharge" : "No active pump equation contribution", "Pipe role interpretation from solved pump hydraulic path"),
      sourceMapItem("Endpoint elevation rule", "Start -> inlet/profile; End -> outlet", "", "Engineering interpretation", "Pipe endpoint elevations are pressure-profile terms, not independent boundary energy sources", "P_in uses z_start; P_out uses z_end; high point uses local z", "Bernoulli elevation head term; change SRC/tank/vessel elevation to change source head"),
      sourceMapItem("Pipe size / ID", roundNumber(diameter, 6), "m", sizeSource.status, sizeSource.source, "A = pi D^2 / 4", "ASME/custom diameter basis; verify project piping class"),
      sourceMapItem("Roughness", roundNumber(roughness, 8), "m", materialSource.status, materialSource.source, "eps_eff = eps x F_aging", "Moody/Colebrook roughness input"),
      sourceMapItem("Fitting K", roundNumber(totalK, 6), "", Array.isArray(props.segments) && props.segments.length > 1 ? "All segments" : fittingSource.status, Array.isArray(props.segments) && props.segments.length > 1 ? "Sum of segment fitting/additional K values" : fittingSource.source, "h_minor,total = sum(K_total,i x V_i^2/(2g))", "All Segment Calculation Trace shows segment-by-segment K; avoid double counting with valve objects"),
      sourceMapItem("Head loss allowance", roundNumber(allowance, 4), "%", allowance > 0 ? "User conservative factor" : "Not applied", "Optional design/fouling allowance", "h_allow = (h_major + h_minor) x F_allow", "Engineering screening factor"),
      sourceMapItem("Pressure profile", hasPressureProfile ? "Available" : "Not solved", "", hasPressureProfile ? "Network-derived" : "Waiting for endpoint pressure solution", "Static pressure from hydraulic head balance", "P = rho g (H - z - V^2/2g) / 100000", "Used for inlet/outlet and high point vapor margin")
    ];
  }

  function enrichPipeTrace(trace, context = {}) {
    if (!trace || typeof trace !== "object") return trace;
    if (Array.isArray(trace.sourceMap) && trace.sourceMap.length > 1) return trace;
    const sourceMap = buildPipeSourceConfidenceMap({ ...context, trace });
    if (sourceMap.length) {
      trace.sourceMap = sourceMap;
      trace.sourceMapSource = "pipe-source-confidence-map-runtime";
    }
    return trace;
  }

  function pipeFromWindowElement(windowElement) {
    const pipeId = windowElement?.dataset?.pipeNode
      || windowElement?.dataset?.nodeId
      || windowElement?.querySelector?.("[data-pipe-node]")?.dataset?.pipeNode
      || "";
    return pipeId;
  }

  function displaySourceValue(row) {
    if (row.value === null || typeof row.value === "undefined" || row.value === "") return "-";
    const value = typeof row.value === "number" ? displayNumber(row.value) : String(row.value);
    return row.unit && value !== "-" ? `${value} ${row.unit}` : value;
  }

  function replaceTableBody(table, rows) {
    const body = table.querySelector("tbody");
    if (!body || typeof document === "undefined") return false;
    body.replaceChildren();
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      [
        ["Parameter", row.parameter || "-"],
        ["Value", displaySourceValue(row)],
        ["Status", row.status || "-"],
        ["Method", row.method || "-"],
        ["Formula", row.formula || "-"],
        ["Reference", row.reference || "-"]
      ].forEach(([label, value]) => {
        const td = document.createElement("td");
        td.dataset.label = label;
        if (label === "Formula") {
          const code = document.createElement("code");
          code.textContent = value;
          td.appendChild(code);
        } else {
          td.textContent = value;
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    return true;
  }

  function refreshVisiblePipeSourceConfidenceMaps(rootNode = document) {
    if (typeof document === "undefined" || !rootNode?.querySelectorAll) return 0;
    let changed = 0;
    rootNode.querySelectorAll(TABLE_SELECTOR).forEach((table) => {
      if (!table.textContent.includes(EMPTY_SOURCE_MAP_TEXT)) return;
      const taskWindow = table.closest(".pipe-formula-defense-task-window");
      const pipeId = pipeFromWindowElement(taskWindow);
      const model = runtimeModel();
      const pipe = model?.[pipeId];
      if (!pipe || pipe.type !== "pipe") return;
      const results = pipe.results || {};
      const flow = firstFiniteValue(results.flow, results.calculationTrace?.basis?.flowM3H, pipe.props?.flow);
      const trace = enrichPipeTrace(results.calculationTrace || {}, {
        pipeId,
        pipe,
        props: pipe.props || {},
        results,
        flow
      });
      if (replaceTableBody(table, trace.sourceMap || [])) changed += 1;
    });
    return changed;
  }

  function refreshPipeTraceInModel(pipeId = "") {
    const model = runtimeModel();
    const pipe = model?.[pipeId];
    if (!pipe || pipe.type !== "pipe") return null;
    const results = pipe.results || {};
    const flow = firstFiniteValue(results.flow, results.calculationTrace?.basis?.flowM3H, pipe.props?.flow);
    const trace = typeof root.buildPipeCalculationTrace === "function"
      ? root.buildPipeCalculationTrace(flow, pipe.props || {}, results, null, pipeId)
      : results.calculationTrace;
    if (trace) {
      results.calculationTrace = enrichPipeTrace(trace, {
        pipeId,
        pipe,
        props: pipe.props || {},
        results,
        flow
      });
    }
    return results.calculationTrace || null;
  }

  function patchBuildPipeCalculationTrace() {
    const original = root.buildPipeCalculationTrace;
    if (typeof original !== "function" || original.__pipeSourceConfidenceMapPatched) return false;
    function patchedBuildPipeCalculationTrace(flow, props, results, fluid, pipeId, ...rest) {
      const trace = original.call(this, flow, props, results, fluid, pipeId, ...rest);
      return enrichPipeTrace(trace, { flow, props, results, fluid, pipeId });
    }
    patchedBuildPipeCalculationTrace.__pipeSourceConfidenceMapPatched = true;
    root.buildPipeCalculationTrace = patchedBuildPipeCalculationTrace;
    return true;
  }

  function patchPipeFormulaDefenseWindows() {
    let patched = false;
    if (typeof root.openPipeFormulaDefenseTaskWindow === "function" && !root.openPipeFormulaDefenseTaskWindow.__pipeSourceConfidenceMapPatched) {
      const originalOpen = root.openPipeFormulaDefenseTaskWindow;
      root.openPipeFormulaDefenseTaskWindow = function patchedOpenPipeFormulaDefenseTaskWindow(pipeId, ...rest) {
        refreshPipeTraceInModel(pipeId);
        const result = originalOpen.call(this, pipeId, ...rest);
        root.setTimeout?.(() => refreshVisiblePipeSourceConfidenceMaps(document), 0);
        return result;
      };
      root.openPipeFormulaDefenseTaskWindow.__pipeSourceConfidenceMapPatched = true;
      patched = true;
    }

    if (typeof root.refreshPipeFormulaDefenseWindowContent === "function" && !root.refreshPipeFormulaDefenseWindowContent.__pipeSourceConfidenceMapPatched) {
      const originalRefresh = root.refreshPipeFormulaDefenseWindowContent;
      root.refreshPipeFormulaDefenseWindowContent = function patchedRefreshPipeFormulaDefenseWindowContent(windowElement, ...rest) {
        refreshPipeTraceInModel(pipeFromWindowElement(windowElement));
        const result = originalRefresh.call(this, windowElement, ...rest);
        root.setTimeout?.(() => refreshVisiblePipeSourceConfidenceMaps(document), 0);
        return result;
      };
      root.refreshPipeFormulaDefenseWindowContent.__pipeSourceConfidenceMapPatched = true;
      patched = true;
    }
    return patched;
  }

  function installObserver() {
    if (observer || typeof document === "undefined" || typeof MutationObserver === "undefined") return false;
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => Array.from(mutation.addedNodes || []).some((node) => (
        node?.classList?.contains?.("pipe-formula-defense-task-window")
        || node?.querySelector?.(TABLE_SELECTOR)
      )))) {
        root.setTimeout?.(() => refreshVisiblePipeSourceConfidenceMaps(document), 0);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return true;
  }

  function install() {
    const changed = [
      patchBuildPipeCalculationTrace(),
      patchPipeFormulaDefenseWindows(),
      installObserver()
    ].some(Boolean);
    if (typeof document !== "undefined") refreshVisiblePipeSourceConfidenceMaps(document);
    return changed;
  }

  function startInstallLoop() {
    installAttempts += 1;
    install();
    if (installAttempts < 160 && typeof root.setTimeout === "function") {
      root.setTimeout(startInstallLoop, installAttempts < 30 ? 250 : 1000);
    }
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    install,
    enrichPipeTrace,
    buildPipeSourceConfidenceMap,
    refresh: refreshVisiblePipeSourceConfidenceMaps
  };

  root.EngineeringPipeSourceConfidenceMapRuntime = api;
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
}("undefined" != typeof window ? window : globalThis);
