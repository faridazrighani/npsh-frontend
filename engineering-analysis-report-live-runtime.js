(function installEngineeringAnalysisReportLiveRuntime(root) {
  'use strict';

  const VERSION = '2026.06-analysis-report-live17-head-power-audit';
  const REFRESH_MS = 3000;
  const ACTIVE_SELECTOR = '.journal-analysis-task-window, .journal-analysis-report-panel';
  const RESPONSIVE_STYLE_ID = 'engineeringAnalysisReportLiveResponsiveStyle';
  const ANALYSIS_REPORT_LOGO_PATH = 'png/untirta-universitas-sultanagengtirtayasa880x870.png';

  root.__npshAnalysisReportLiveBoot = VERSION;
  try {
    document.documentElement.dataset.engineeringAnalysisReportLiveRuntime = VERSION;
  } catch (error) {
    console.warn('Analysis Report live runtime marker could not be installed.', error);
  }

  const installResponsiveCss = () => {
    if (typeof document === 'undefined'
      || !document.getElementById
      || !document.createElement
      || !document.head?.appendChild) {
      return false;
    }
    if (document.getElementById(RESPONSIVE_STYLE_ID)) return false;

    const style = document.createElement('style');
    style.id = RESPONSIVE_STYLE_ID;
    style.textContent = `
.journal-analysis-task-window,
.journal-analysis-report-panel {
  max-width: calc(100vw - 16px);
  min-width: 0;
}
.journal-analysis-task-window .task-window-body,
.journal-analysis-report-panel {
  min-width: 0;
  overflow-x: hidden;
}
.journal-analysis-task-window .journal-analysis-report-panel,
.journal-analysis-task-window .journal-analysis-card,
.journal-analysis-task-window section,
.journal-analysis-task-window article,
.journal-analysis-report-panel .journal-analysis-card,
.journal-analysis-report-panel section,
.journal-analysis-report-panel article {
  max-width: 100%;
  min-width: 0;
}
.journal-analysis-task-window .academic-equation-step,
.journal-analysis-task-window .academic-equation-display,
.journal-analysis-task-window .formula-defense-equation-surface,
.journal-analysis-task-window .pump-optimization-equation-wrap,
.journal-analysis-task-window .journal-analysis-formula-list,
.journal-analysis-report-panel .academic-equation-step,
.journal-analysis-report-panel .academic-equation-display,
.journal-analysis-report-panel .formula-defense-equation-surface,
.journal-analysis-report-panel .pump-optimization-equation-wrap,
.journal-analysis-report-panel .journal-analysis-formula-list {
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.journal-analysis-task-window .academic-equation-display,
.journal-analysis-task-window .formula-defense-equation-surface,
.journal-analysis-task-window .academic-equation-math,
.journal-analysis-task-window .academic-inline-formula,
.journal-analysis-task-window .formula-defense-inline-equation,
.journal-analysis-task-window .formula-defense-fallback-equation,
.journal-analysis-report-panel .academic-equation-display,
.journal-analysis-report-panel .formula-defense-equation-surface,
.journal-analysis-report-panel .academic-equation-math,
.journal-analysis-report-panel .academic-inline-formula,
.journal-analysis-report-panel .formula-defense-inline-equation,
.journal-analysis-report-panel .formula-defense-fallback-equation {
  max-width: 100% !important;
  min-width: 0 !important;
  box-sizing: border-box !important;
  white-space: normal !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
}
.journal-analysis-task-window .academic-equation-math,
.journal-analysis-task-window .formula-defense-inline-equation,
.journal-analysis-report-panel .academic-equation-math,
.journal-analysis-report-panel .formula-defense-inline-equation {
  display: block !important;
  width: 100% !important;
  overflow-x: hidden !important;
}
.journal-analysis-task-window .katex,
.journal-analysis-task-window .katex *,
.journal-analysis-report-panel .katex,
.journal-analysis-report-panel .katex * {
  max-width: 100% !important;
  white-space: normal !important;
  overflow-wrap: anywhere !important;
}
.journal-analysis-task-window .katex-display,
.journal-analysis-report-panel .katex-display {
  overflow: visible !important;
  margin: 0 !important;
}
.journal-analysis-task-window .katex-html,
.journal-analysis-report-panel .katex-html {
  white-space: normal !important;
}
.journal-analysis-task-window .katex .base,
.journal-analysis-report-panel .katex .base {
  display: inline !important;
  white-space: normal !important;
}
.journal-analysis-task-window table,
.journal-analysis-report-panel table {
  max-width: 100%;
}
.analysis-report-xlsx-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
.analysis-report-xlsx-title-row > :first-child {
  min-width: 0;
}
.analysis-report-xlsx-export-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 4px 9px;
  border: 1px solid #9bc4dd;
  border-radius: 5px;
  background: #f4fbff;
  color: #103d5f;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  cursor: pointer;
}
.analysis-report-xlsx-export-btn:hover,
.analysis-report-xlsx-export-btn:focus-visible {
  border-color: #1f6fa9;
  background: #e8f5ff;
  outline: 2px solid rgba(31, 111, 169, 0.25);
  outline-offset: 1px;
}
.analysis-report-xlsx-export-btn:disabled {
  cursor: wait;
  opacity: 0.72;
}
`;
    document.head.appendChild(style);
    return true;
  };

  const normalizeMetric = (value) => String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\/\s+/g, ' / ')
    .trim()
    .toLowerCase();

  const METRIC_LABEL_RENAMES = new Map([
    [normalizeMetric('Pump - Suction Nozzle Elev.'), 'Pump - Pump Datum Elev.'],
    [normalizeMetric('Pump - Suction nozzle elevation'), 'Pump - Pump datum elevation']
  ]);

  const canonicalMetricLabel = (metric) => METRIC_LABEL_RENAMES.get(normalizeMetric(metric)) || metric;

  const toNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined) return null;
    const match = String(value).replace(/,/g, '').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const firstNumber = (...values) => {
    for (const value of values) {
      const parsed = toNumber(value);
      if (parsed !== null) return parsed;
    }
    return null;
  };

  const trimZeros = (text) => String(text)
    .replace(/(\.\d*?[1-9])0+$/u, '$1')
    .replace(/\.0+$/u, '');

  const fixed = (value, digits = 3) => {
    const parsed = toNumber(value);
    if (parsed === null) return '-';
    if (Object.is(parsed, -0) || Math.abs(parsed) < 10 ** -(digits + 1)) return digits > 0 ? '0' : '0';
    return trimZeros(parsed.toFixed(digits));
  };

  const exp = (value, digits = 4) => {
    const parsed = toNumber(value);
    if (parsed === null) return '-';
    return parsed.toExponential(digits).replace(/e([+-])0+(\d+)/u, 'e$1$2');
  };

  const withUnit = (value, unit, digits = 3) => {
    const text = fixed(value, digits);
    return text === '-' ? '-' : `${text}${unit ? ` ${unit}` : ''}`;
  };

  const sciUnit = (value, unit, digits = 4) => {
    const text = exp(value, digits);
    return text === '-' ? '-' : `${text}${unit ? ` ${unit}` : ''}`;
  };

  const cleanText = (value, fallback = '-') => {
    if (value === null || value === undefined || value === '') return fallback;
    return String(value);
  };

  const statusNeedsCalculatedFallback = (value) => /input\s*required|incomplete|unknown/i.test(String(value || ''));

  const calculatedNpshStatus = (npsha, npshr, requiredNpsha) => {
    if (npsha === null || npshr === null) return null;
    if (npsha <= npshr) return 'Cavitation Risk';
    if (requiredNpsha !== null && npsha < requiredNpsha) return 'Warning';
    return 'Safe';
  };

  const chooseCalculatedStatus = (rawStatus, calculatedStatus, fallback = '-') => {
    const raw = cleanText(rawStatus, '');
    if (statusNeedsCalculatedFallback(raw) && calculatedStatus) return calculatedStatus;
    return raw || calculatedStatus || fallback;
  };

  const getModel = () => {
    let lexicalModel = null;
    try {
      lexicalModel = typeof globalModel !== 'undefined' ? globalModel : null;
    } catch (error) {
      lexicalModel = null;
    }
    const candidates = [
      root.globalModel,
      root.__npshGlobalModel,
      lexicalModel,
      root.model,
      root.__npshLastBackendSimulationResponse?.response?.model,
      root.__npshLastBackendSimulationResponse?.model
    ];
    return candidates.find((candidate) => candidate && typeof candidate === 'object') || null;
  };

  const getObjectContainer = (model) => {
    if (!model || typeof model !== 'object') return {};
    if (model.objects && typeof model.objects === 'object') return model.objects;
    return model;
  };

  const objectEntries = (model) => Object.entries(getObjectContainer(model))
    .filter(([, object]) => object && typeof object === 'object' && typeof object.type === 'string');

  const objectById = (model, id) => {
    if (!model || !id) return null;
    const container = getObjectContainer(model);
    return container[id] || null;
  };

  const firstByType = (model, type) => {
    const normalized = String(type || '').toLowerCase();
    const entry = objectEntries(model).find(([, object]) => String(object.type || '').toLowerCase() === normalized);
    return entry ? { id: entry[0], object: entry[1] } : { id: '', object: null };
  };

  const getConnections = (model) => {
    let lexicalConnections = null;
    try {
      lexicalConnections = typeof connections !== 'undefined' ? connections : null;
    } catch (error) {
      lexicalConnections = null;
    }
    const candidates = [
      model?.connections,
      root.connections,
      root.__npshConnections,
      lexicalConnections,
      root.__npshLastBackendSimulationResponse?.response?.connections
    ];
    const connections = candidates.find(Array.isArray);
    return connections || [];
  };

  const connectionEndpoint = (connection, key) => (
    connection?.[key]
    || connection?.[`raw${key.charAt(0).toUpperCase()}${key.slice(1)}`]
    || connection?.[`${key}Node`]
    || ''
  );

  const findNetworkObjects = (model) => {
    const pump = firstByType(model, 'pump');
    const source = firstByType(model, 'source');
    const sink = firstByType(model, 'sink');
    const pipes = objectEntries(model)
      .filter(([, object]) => String(object.type || '').toLowerCase() === 'pipe')
      .map(([id, object]) => ({ id, object }));
    const connections = getConnections(model);
    const pumpId = pump.id;
    const suctionConnection = connections.find((connection) => connectionEndpoint(connection, 'to') === pumpId);
    const dischargeConnection = connections.find((connection) => connectionEndpoint(connection, 'from') === pumpId);
    const suctionPipeId = suctionConnection?.pipeId || suctionConnection?.pipe || '';
    const dischargePipeId = dischargeConnection?.pipeId || dischargeConnection?.pipe || '';
    const suctionPipe = suctionPipeId
      ? { id: suctionPipeId, object: objectById(model, suctionPipeId) }
      : (pipes.find((entry) => /suction|pipe-?1/i.test(`${entry.id} ${entry.object?.name || ''}`)) || pipes[0] || { id: '', object: null });
    const dischargePipe = dischargePipeId
      ? { id: dischargePipeId, object: objectById(model, dischargePipeId) }
      : (pipes.find((entry) => /discharge|pipe-?2/i.test(`${entry.id} ${entry.object?.name || ''}`)) || pipes.find((entry) => entry.id !== suctionPipe.id) || { id: '', object: null });
    return {
      fluid: firstByType(model, 'fluid'),
      source: source.object ? source : { id: connectionEndpoint(suctionConnection, 'from'), object: objectById(model, connectionEndpoint(suctionConnection, 'from')) },
      pump,
      sink: sink.object ? sink : { id: connectionEndpoint(dischargeConnection, 'to'), object: objectById(model, connectionEndpoint(dischargeConnection, 'to')) },
      suctionPipe,
      dischargePipe
    };
  };

  const pipeTrace = (pipeEntry) => {
    const pipe = pipeEntry?.object || pipeEntry;
    return pipe?.results?.calculationTrace || {};
  };

  const pipeTotals = (pipeEntry) => pipeTrace(pipeEntry).totals || {};
  const pipeBasis = (pipeEntry) => pipeTrace(pipeEntry).basis || {};
  const pipeMarker = (pipeEntry) => {
    const markers = pipeTrace(pipeEntry).moody?.markers || [];
    return markers.find((marker) => firstNumber(marker?.reynolds) !== null) || {};
  };

  const traceStepResult = (pipeEntry, title) => {
    const desired = normalizeMetric(title);
    const trace = pipeTrace(pipeEntry);
    const segments = trace.segmentRows || trace.segments || [];
    for (const segment of segments) {
      const steps = [...(segment.steps || []), ...(segment.pressureSteps || [])];
      const step = steps.find((item) => normalizeMetric(item?.title) === desired);
      const parsed = firstNumber(step?.result, step?.value);
      if (parsed !== null) return parsed;
    }
    return null;
  };

  const pipeMetric = (pipeEntry, key) => {
    const totals = pipeTotals(pipeEntry);
    const basis = pipeBasis(pipeEntry);
    const marker = pipeMarker(pipeEntry);
    const results = pipeEntry?.object?.results || {};
    if (key === 'majorLoss') return firstNumber(totals.majorLoss, results.majorLoss, traceStepResult(pipeEntry, 'Major Loss'));
    if (key === 'minorLoss') return firstNumber(totals.minorLoss, results.minorLoss, traceStepResult(pipeEntry, 'Minor Loss'));
    if (key === 'totalLoss') return firstNumber(totals.totalLoss, results.headLoss, results.totalLoss, traceStepResult(pipeEntry, 'Segment Total Loss'));
    if (key === 'totalK') return firstNumber(totals.totalK, traceStepResult(pipeEntry, 'Total K'));
    if (key === 'reynolds') return firstNumber(marker.reynolds, traceStepResult(pipeEntry, 'Reynolds Number'));
    if (key === 'frictionFactor') return firstNumber(marker.frictionFactor, traceStepResult(pipeEntry, 'Darcy Friction Factor'));
    if (key === 'epsD') return firstNumber(marker.relRoughness, marker.relativeRoughness, traceStepResult(pipeEntry, 'Relative Roughness'));
    if (key === 'flow') return firstNumber(basis.flowM3H, results.flow);
    return null;
  };

  const routeDischargeLoss = (pumpResults = {}, npsh = {}) => {
    const route = pumpResults.routeTrace || npsh.routeTrace || {};
    const trace = npsh.calculationTrace || pumpResults.calculationTrace || {};
    return firstNumber(
      route.dischargeLoss?.headLoss,
      route.sections?.discharge?.totalLossM,
      trace.systemHead?.dischargeLoss,
      npsh.dischargeLoss,
      pumpResults.dischargeLoss,
      pumpResults.requiredSystemHeadTrace?.dischargeLoss,
      pumpResults.systemHead?.dischargeLoss
    );
  };

  const pipeEndpointElevation = (pipeEntry, endpointKey) => {
    if (!pipeEntry || !endpointKey) return null;
    const props = pipeEntry.object?.props || {};
    const direct = firstNumber(props[endpointKey]);
    if (direct !== null) return direct;

    const trace = pipeTrace(pipeEntry);
    const segments = trace.segmentRows || trace.segments || [];
    const orderedSegments = endpointKey === 'endElevation' ? [...segments].reverse() : segments;
    for (const segment of orderedSegments) {
      const profile = segment?.profile || {};
      const value = firstNumber(profile[endpointKey], segment?.[endpointKey]);
      if (value !== null) return value;
    }
    return null;
  };

  const pressureHeadM = (pressureBarA, densityKgM3) => {
    const pressure = firstNumber(pressureBarA);
    const density = firstNumber(densityKgM3);
    if (pressure === null || density === null || density <= 0) return null;
    return pressure * 100000 / (density * 9.81);
  };

  const vaporMarginHeadM = (pressureBarA, vaporPressureBarA, densityKgM3) => {
    const pressure = firstNumber(pressureBarA);
    const vapor = firstNumber(vaporPressureBarA);
    if (pressure === null || vapor === null) return null;
    return pressureHeadM(pressure - vapor, densityKgM3);
  };

  const massFlowKgH = (flowM3H, densityKgM3) => {
    const flow = firstNumber(flowM3H);
    const density = firstNumber(densityKgM3);
    if (flow === null || density === null) return null;
    return flow * density;
  };

  const collectLiveMetrics = () => {
    const model = getModel();
    if (!model) return new Map();
    const entries = new Map();
    const set = (metric, text, numeric = null, valueText = null) => {
      if (!metric || text === null || text === undefined || text === '-') return;
      entries.set(normalizeMetric(metric), {
        metric,
        text: String(text),
        valueText: valueText === null || valueText === undefined ? String(text) : String(valueText),
        numeric: numeric === null ? firstNumber(text) : firstNumber(numeric)
      });
    };

    const { fluid, source, pump, suctionPipe, dischargePipe, sink } = findNetworkObjects(model);
    const fluidProps = fluid.object?.props || {};
    const sourceProps = source.object?.props || {};
    const sourceResults = source.object?.results || {};
    const pumpProps = pump.object?.props || {};
    const pumpResults = pump.object?.results || {};
    const npsh = pumpResults.npshEvaluation || {};
    const proposal = pumpResults.pumpOptimizationProposal || pumpResults.optimization || {};
    const readiness = pumpResults.pumpOptimizationReadiness || {};
    const sinkProps = sink.object?.props || {};
    const sinkResults = sink.object?.results || {};

    const density = firstNumber(fluidProps.density, pipeBasis(suctionPipe).density);
    const viscosityCSt = firstNumber(fluidProps.viscosity, fluidProps.kinematicViscosity, pipeBasis(suctionPipe).viscosityCSt);
    const kinematicM2S = viscosityCSt === null ? null : viscosityCSt * 1e-6;
    const dynamicCps = firstNumber(fluidProps.dynViscosity, density !== null && viscosityCSt !== null ? density * viscosityCSt / 1000 : null);
    const vaporPressure = firstNumber(fluidProps.vaporPressure, pipeBasis(suctionPipe).vaporPressureBarA);
    const specWeight = firstNumber(fluidProps.specWeight, density !== null ? density * 9.81 : null);
    const vaporHead = firstNumber(fluidProps.vaporPressureHead, pressureHeadM(vaporPressure, density));
    const sg = firstNumber(fluidProps.sg, density !== null ? density / 1000 : null);

    set('Fluid Basis - Fluid Name', cleanText(fluidProps.fluidName || fluid.object?.name || 'Fluid Basis'), null);
    set('Fluid Basis - Temperature', withUnit(fluidProps.temp, 'deg C', 3), firstNumber(fluidProps.temp));
    set('Fluid Basis - Density rho', withUnit(density, 'kg/m3', 9), density);
    set('Fluid Basis - Specific gravity', withUnit(sg, '-', 12), sg);
    set('Fluid Basis - Specific weight', withUnit(specWeight, 'N/m3', 9), specWeight);
    set('Fluid Basis - Kinematic viscosity', sciUnit(kinematicM2S, 'm2/s', 4), kinematicM2S, withUnit(viscosityCSt, 'cSt', 6));
    set('Fluid Basis - Dynamic viscosity', withUnit(dynamicCps, 'cP', 12), dynamicCps);
    set('Fluid Basis - Vapor pressure', withUnit(vaporPressure, 'bar a', 12), vaporPressure);
    set('Fluid Basis - Vapor pressure head', withUnit(vaporHead, 'm', 9), vaporHead);

    const sourcePressure = firstNumber(sourceProps.pressure, sourceResults.calculationTrace?.boundary?.absolutePressureBar, sourceResults.pressure);
    const sourceElevation = firstNumber(sourceProps.elevation, sourceResults.calculationTrace?.boundary?.elevation);
    const pumpSuctionElevation = firstNumber(pumpProps.suctionElevation, pumpProps.elevation);
    const sourceFlow = firstNumber(sourceResults.flow, sourceProps.flow, pumpResults.fixedFlow, pumpResults.flow, pipeMetric(suctionPipe, 'flow'));
    const sourceMassFlow = firstNumber(sourceProps.massFlow, sourceResults.massFlow, massFlowKgH(sourceFlow, density));
    const staticHeadToSuction = sourceElevation !== null && pumpSuctionElevation !== null ? sourceElevation - pumpSuctionElevation : null;

    set('SRC - Source Type', cleanText(sourceProps.sourceType || source.object?.type || 'Source'), null);
    set('SRC - Boundary Pressure', withUnit(sourcePressure, 'bar a', 11), sourcePressure);
    set('SRC - Boundary pressure', withUnit(sourcePressure, 'bar a', 11), sourcePressure);
    set('SRC - Source Elevation', withUnit(sourceElevation, 'm', 6), sourceElevation);
    set('SRC - Source elevation datum', withUnit(sourceElevation, 'm', 6), sourceElevation);
    set('SRC - Static head to pump suction', withUnit(staticHeadToSuction, 'm', 6), staticHeadToSuction);
    set('SRC - Volumetric Flow / Mass Flow', `${withUnit(sourceFlow, 'm3/h', 6)} / ${withUnit(sourceMassFlow, 'kg/h', 6)}`, sourceFlow);
    set('SRC - Volumetric flow', withUnit(sourceFlow, 'm3/h', 6), sourceFlow);
    set('SRC - Mass flow', withUnit(sourceMassFlow, 'kg/h', 6), sourceMassFlow);
    set('SRC - Volumetric Flow Calculated', withUnit(sourceFlow, 'm3/h', 6), sourceFlow);
    set('SRC - Volumetric flow calculated', withUnit(sourceFlow, 'm3/h', 6), sourceFlow);

    const setPipeGroup = (prefix, pipeEntry) => {
      const major = pipeMetric(pipeEntry, 'majorLoss');
      const minor = pipeMetric(pipeEntry, 'minorLoss');
      const total = pipeMetric(pipeEntry, 'totalLoss');
      const totalK = pipeMetric(pipeEntry, 'totalK');
      const reynolds = pipeMetric(pipeEntry, 'reynolds');
      const friction = pipeMetric(pipeEntry, 'frictionFactor');
      const epsD = pipeMetric(pipeEntry, 'epsD');
      set(`${prefix} - Major Loss`, withUnit(major, 'm', 9), major);
      set(`${prefix} - Major loss`, withUnit(major, 'm', 9), major);
      set(`${prefix} - Minor Loss`, withUnit(minor, 'm', 9), minor);
      set(`${prefix} - Minor loss`, withUnit(minor, 'm', 9), minor);
      set(`${prefix} - Total Head Loss`, withUnit(total, 'm', 9), total);
      set(`${prefix} - Total head loss`, withUnit(total, 'm', 9), total);
      set(`${prefix} - Major / Minor / Total Loss`, `${withUnit(major, 'm', 6)} / ${withUnit(minor, 'm', 6)} / ${withUnit(total, 'm', 6)}`, total);
      set(`${prefix} - Total K`, withUnit(totalK, '-', 9), totalK);
      set(`${prefix} - Primary Re`, withUnit(reynolds, '-', 3), reynolds);
      set(`${prefix} - Darcy f`, withUnit(friction, '-', 9), friction);
      set(`${prefix} - eps/D`, withUnit(epsD, '-', 9), epsD);
      set(`${prefix} - Total K / Re / Darcy f / epsD`, `${fixed(totalK, 6)} / ${fixed(reynolds, 1)} / ${fixed(friction, 8)} / ${fixed(epsD, 8)}`, totalK);
    };

    setPipeGroup('Pipe Suction', suctionPipe);
    setPipeGroup('Pipe Discharge', dischargePipe);
    const suctionPfvStartElevation = pipeEndpointElevation(suctionPipe, 'startElevation');
    const suctionPfvEndElevation = pipeEndpointElevation(suctionPipe, 'endElevation');
    const dischargePfvStartElevation = pipeEndpointElevation(dischargePipe, 'startElevation');
    const dischargePfvEndElevation = pipeEndpointElevation(dischargePipe, 'endElevation');
    set('Pipe Suction - PFV Start Elevation', withUnit(suctionPfvStartElevation, 'm', 6), suctionPfvStartElevation);
    set('Pipe Suction - PFV End Elevation', withUnit(suctionPfvEndElevation, 'm', 6), suctionPfvEndElevation);
    set('Pipe Discharge - PFV Start Elevation', withUnit(dischargePfvStartElevation, 'm', 6), dischargePfvStartElevation);
    set('Pipe Discharge - PFV End Elevation', withUnit(dischargePfvEndElevation, 'm', 6), dischargePfvEndElevation);

    const npshTraceInterpretation = npsh.calculationTrace?.interpretation || {};
    const pumpFlow = firstNumber(npsh.flow, pumpResults.fixedFlow, pumpResults.flow);
    const pumpModeText = [
      pumpResults.solveMode,
      pumpResults.flowBasis,
      npsh.solveMode,
      npsh.flowBasis
    ].filter(Boolean).join(' ');
    const routeOnlyPump = pumpResults.routeOnlyNpshEvaluation === true
      || npsh.routeOnlyNpshEvaluation === true
      || /route-only/i.test(pumpModeText);
    const actualPumpHeadAvailable = npsh.actualPumpHeadAvailable === true
      || pumpResults.actualPumpHeadAvailable === true;
    const pumpHead = actualPumpHeadAvailable
      ? firstNumber(npsh.actualPumpHead, pumpResults.actualPumpHead, npsh.pumpHead, pumpResults.pumpHeadAtFlow, pumpResults.head)
      : (routeOnlyPump ? null : firstNumber(npsh.actualPumpHead, pumpResults.actualPumpHead, npsh.pumpHead, pumpResults.pumpHeadAtFlow, pumpResults.head));
    const pumpRequiredSystemHead = firstNumber(npsh.requiredSystemHead, pumpResults.requiredSystemHead, routeOnlyPump ? null : pumpHead);
    const npsha = firstNumber(npsh.npsha, pumpResults.npsha);
    const npshr = firstNumber(npsh.npshr, pumpResults.npshr, pumpProps.manualNpshr, pumpProps.designNpshr);
    const marginRatioLimit = firstNumber(
      npsh.marginCriteria?.ratio,
      npsh.criteria?.ratio,
      npshTraceInterpretation.marginRatioLimit,
      pumpResults.npshMarginRatioLimit,
      pumpProps.minNpshMarginRatio,
      1.05
    );
    const absoluteMarginLimit = firstNumber(
      npsh.marginCriteria?.margin,
      npsh.criteria?.margin,
      npshTraceInterpretation.absoluteMarginLimit,
      pumpResults.npshMarginLimit,
      pumpProps.minNpshMargin,
      0.6
    );
    const requiredCandidates = [];
    if (npshr !== null && marginRatioLimit !== null && marginRatioLimit > 0) requiredCandidates.push(npshr * marginRatioLimit);
    if (npshr !== null && absoluteMarginLimit !== null && absoluteMarginLimit >= 0) requiredCandidates.push(npshr + absoluteMarginLimit);
    const computedRequiredNpsha = requiredCandidates.length ? Math.max(...requiredCandidates) : null;
    const npshMargin = firstNumber(npsh.npshMargin, pumpResults.npshMargin, npsha !== null && npshr !== null ? npsha - npshr : null);
    const npshRatio = firstNumber(npsh.npshRatio, pumpResults.npshRatio, npsha !== null && npshr ? npsha / npshr : null);
    const requiredNpsha = firstNumber(npsh.requiredNpsha, pumpResults.requiredNpsha, computedRequiredNpsha);
    const npshExcess = firstNumber(npsh.npshExcess, pumpResults.npshExcess, npsha !== null && requiredNpsha !== null ? npsha - requiredNpsha : null);
    const computedMaxNpshrByRatio = npsha !== null && marginRatioLimit !== null && marginRatioLimit > 0
      ? npsha / marginRatioLimit
      : null;
    const computedMaxNpshrByMargin = npsha !== null && absoluteMarginLimit !== null
      ? npsha - absoluteMarginLimit
      : null;
    const maxNpshrByRatio = firstNumber(npsh.maxNpshrByRatio, pumpResults.maxNpshrByRatio, npshTraceInterpretation.maxNpshrByRatio, computedMaxNpshrByRatio);
    const maxNpshrByMargin = firstNumber(npsh.maxNpshrByMargin, pumpResults.maxNpshrByMargin, npshTraceInterpretation.maxNpshrByMargin, computedMaxNpshrByMargin);
    const maxAllowableNpshr = firstNumber(
      npsh.maxAllowableNpshr,
      pumpResults.maxAllowableNpshr,
      npshTraceInterpretation.maxAllowableNpshr,
      [maxNpshrByRatio, maxNpshrByMargin].filter(value => value !== null).length
        ? Math.min(...[maxNpshrByRatio, maxNpshrByMargin].filter(value => value !== null))
        : null
    );
    const suctionLoss = firstNumber(npsh.suctionLoss, pipeMetric(suctionPipe, 'totalLoss'), pumpResults.suctionLoss);
    const dischargeLoss = firstNumber(routeDischargeLoss(pumpResults, npsh), pipeMetric(dischargePipe, 'totalLoss'));
    const computedHydraulicStatus = calculatedNpshStatus(npsha, npshr, requiredNpsha);
    const rawHydraulicStatus = npsh.hydraulicStatus || pumpResults.hydraulicNpshStatus || npsh.status || pumpResults.cavitationStatus || 'Incomplete';
    const hydraulicStatus = chooseCalculatedStatus(rawHydraulicStatus, computedHydraulicStatus, 'Incomplete');
    const dataConfidence = [pumpResults.dataConfidenceStatus || npsh.dataConfidenceStatus, pumpResults.dataConfidence || npsh.dataConfidence]
      .filter(Boolean)
      .join(': ');
    const rawEngineeringStatus = cleanText(npsh.engineeringStatus || pumpResults.engineeringStatus || pumpResults.status || '', '');
    const computedEngineeringStatus = (statusNeedsCalculatedFallback(rawEngineeringStatus) || rawEngineeringStatus === '-' || !rawEngineeringStatus) && computedHydraulicStatus
      ? (/warning|review|manual|without locked|verify/i.test(dataConfidence) ? 'Review Required' : computedHydraulicStatus)
      : null;
    const engineeringStatus = chooseCalculatedStatus(rawEngineeringStatus, computedEngineeringStatus, '-');
    const routeCalculationStatus = cleanText(npsh.routeCalculationStatus || pumpResults.routeCalculationStatus || npshTraceInterpretation.routeCalculationStatus || (pumpFlow !== null ? 'Calculated' : 'Input Required'));
    const npshaCalculationStatus = cleanText(npsh.npshaCalculationStatus || pumpResults.npshaCalculationStatus || npshTraceInterpretation.npshaCalculationStatus || (npsha !== null ? 'Calculated' : 'Input Required'));
    const requiredPumpHeadStatus = cleanText(npsh.requiredPumpHeadStatus || pumpResults.requiredPumpHeadStatus || npshTraceInterpretation.requiredPumpHeadStatus || (pumpRequiredSystemHead !== null ? 'Calculated' : 'Input Required'));
    const rawMaxAllowableNpshrStatus = cleanText(npsh.maxAllowableNpshrStatus || pumpResults.maxAllowableNpshrStatus || npshTraceInterpretation.maxAllowableNpshrStatus || '');
    const maxAllowableNpshrStatus = maxAllowableNpshr !== null
      ? (/review|required|input/i.test(rawMaxAllowableNpshrStatus) ? 'Calculated' : (rawMaxAllowableNpshrStatus || 'Calculated'))
      : (rawMaxAllowableNpshrStatus || 'Review Required');
    const computedManualComparisonStatus = npshr !== null
      ? (maxAllowableNpshr !== null ? (npshr <= maxAllowableNpshr ? 'Safe' : 'Warning') : 'Review Required')
      : 'Not Provided';
    const rawManualNpshrComparisonStatus = cleanText(npsh.manualNpshrComparisonStatus || pumpResults.manualNpshrComparisonStatus || npshTraceInterpretation.manualNpshrComparisonStatus || '');
    const manualNpshrComparisonStatus = maxAllowableNpshr !== null && npshr !== null
      ? computedManualComparisonStatus
      : (rawManualNpshrComparisonStatus || computedManualComparisonStatus);
    const vendorCurveVerificationStatus = cleanText(npsh.vendorCurveVerificationStatus || pumpResults.vendorCurveVerificationStatus || npshTraceInterpretation.vendorCurveVerificationStatus || 'Not Required for route calculation');
    const suctionPressure = firstNumber(npsh.suctionPressureAbs, pumpResults.suctionPressure);
    const dischargePressure = firstNumber(pumpResults.dischargePressure);
    const shaftPower = routeOnlyPump && !actualPumpHeadAvailable ? null : firstNumber(pumpResults.power);
    const efficiency = firstNumber(pumpResults.efficiency, pumpProps.designEfficiency);

    set('Pump - Pump Datum Elev.', withUnit(pumpProps.suctionElevation, 'm', 6), firstNumber(pumpProps.suctionElevation));
    set('Pump - Pump datum elevation', withUnit(pumpProps.suctionElevation, 'm', 6), firstNumber(pumpProps.suctionElevation));
    set('Pump - Hydraulic NPSH Status', hydraulicStatus, null);
    set('Hydraulic NPSH Status', hydraulicStatus, null);
    set('Pump - Engineering Status', engineeringStatus, null);
    set('Engineering Status', engineeringStatus, null);
    set('Pump - Data Confidence', dataConfidence || '-', null);
    set('Pump - Route Calculation Status', routeCalculationStatus, null);
    set('Pump - NPSHa Calculation Status', npshaCalculationStatus, null);
    set('Pump - Required Pump Head Status', requiredPumpHeadStatus, null);
    set('Pump - Max Allowable NPSHr Status', maxAllowableNpshrStatus, null);
    set('Pump - Manual NPSHr Comparison', manualNpshrComparisonStatus, null);
    set('Pump - Vendor Curve Verification', vendorCurveVerificationStatus, null);
    set('Pump - Flow Evaluated', withUnit(pumpFlow, 'm3/h', 6), pumpFlow);
    set('Pump - Flow evaluated', withUnit(pumpFlow, 'm3/h', 6), pumpFlow);
    set('Pump - Pump Head', withUnit(pumpHead, 'm', 6), pumpHead);
    set('Pump - Required System Head', withUnit(pumpRequiredSystemHead, 'm', 6), pumpRequiredSystemHead);
    set('Pump - Required Head', withUnit(pumpRequiredSystemHead, 'm', 6), pumpRequiredSystemHead);
    set('Pump - Pump head design', withUnit(pumpProps.designHead, 'm', 6), firstNumber(pumpProps.designHead));
    set('Pump - Pump head evaluated', withUnit(pumpHead, 'm', 6), pumpHead);
    set('Pump - Head / Flow', `${withUnit(pumpHead, 'm', 6)} / ${withUnit(pumpFlow, 'm3/h', 6)}`, pumpHead);
    set('Pump - NPSHa', withUnit(npsha, 'm', 9), npsha);
    set('Pump - NPSHr', withUnit(npshr, 'm', 9), npshr);
    set('Pump - NPSHa / NPSHr', `${withUnit(npsha, 'm', 6)} / ${withUnit(npshr, 'm', 6)}`, npsha);
    set('Pump - NPSHr Source', cleanText(npsh.npshrSource || pumpResults.npshrSource || 'Manual input'), null);
    set('Pump - NPSH Margin', withUnit(npshMargin, 'm', 9), npshMargin);
    set('Pump - NPSH ratio', withUnit(npshRatio, '-', 9), npshRatio);
    set('Pump - NPSH Ratio', withUnit(npshRatio, '-', 9), npshRatio);
    set('Pump - NPSH Margin / Ratio', `${withUnit(npshMargin, 'm', 6)} / ${fixed(npshRatio, 6)}`, npshMargin);
    set('Pump - Required NPSHa', withUnit(requiredNpsha, 'm', 9), requiredNpsha);
    set('Pump - NPSH excess', withUnit(npshExcess, 'm', 9), npshExcess);
    set('Pump - NPSH Excess', withUnit(npshExcess, 'm', 9), npshExcess);
    set('Pump - Required NPSHa / NPSH Excess', `${withUnit(requiredNpsha, 'm', 6)} / ${withUnit(npshExcess, 'm', 6)}`, requiredNpsha);
    set('Pump - Maximum Allowable NPSHr', withUnit(maxAllowableNpshr, 'm', 9), maxAllowableNpshr);
    set('Pump - Max Allowable NPSHr', withUnit(maxAllowableNpshr, 'm', 9), maxAllowableNpshr);
    set('Pump - Maximum Allowable NPSHr Formula', 'NPSHr,max = governing allowable NPSHr from selected ANSI/HI margin criterion', null);
    set('Pump - Max NPSHr by Ratio', withUnit(maxNpshrByRatio, 'm', 9), maxNpshrByRatio);
    set('Pump - Max NPSHr by Margin', withUnit(maxNpshrByMargin, 'm', 9), maxNpshrByMargin);
    set('NPSHa, NPSHr, Required NPSHa, and NPSH Excess', `NPSHa=${withUnit(npsha, 'm', 6)}; NPSHr=${withUnit(npshr, 'm', 6)}; Required=${withUnit(requiredNpsha, 'm', 6)}; Excess=${withUnit(npshExcess, 'm', 6)}`, npsha);
    set('NPSHa, NPSHr, Required NPSHa, and NPSH Excess Status', hydraulicStatus, null);
    set('Pump - Suction Pressure', withUnit(suctionPressure, 'bar a', 9), suctionPressure);
    set('Pump - Suction pressure', withUnit(suctionPressure, 'bar a', 9), suctionPressure);
    set('Pump - Suction Loss', withUnit(suctionLoss, 'm', 9), suctionLoss);
    set('Pump - Suction loss', withUnit(suctionLoss, 'm', 9), suctionLoss);
    set('Pump - Discharge Pressure', withUnit(dischargePressure, 'bar a', 9), dischargePressure);
    set('Pump - Shaft power', withUnit(shaftPower, 'kW', 9), shaftPower);
    set('Pump - Efficiency / Power', `${withUnit(efficiency, '%', 6)} / ${withUnit(shaftPower, 'kW', 6)}`, efficiency);
    set('Pump - Dominant Loss', cleanText(npsh.dominantLoss || pumpResults.dominantSuctionLoss), null);

    const targetFlow = firstNumber(proposal.targetFlow, proposal.targetFlowM3H, pumpFlow);
    const requiredHead = firstNumber(proposal.requiredSystemHead, pumpResults.requiredSystemHead, pumpRequiredSystemHead, pumpHead);
    const proposalNpsha = firstNumber(proposal.npshaAtDesign, npsha);
    const proposalMaxAllowableNpshr = firstNumber(proposal.maxAllowableNpshr, proposal.allowableNpshrAtDesign, maxAllowableNpshr);
    const proposedNpshr = firstNumber(proposal.proposedNpshr, proposal.proposedProps?.manualNpshr, proposal.proposedProps?.designNpshr);
    const worst = proposal.worstCase || {};

    set('Optimize Pump From Network - Workflow Status', `${cleanText(proposal.status || 'Not ready')}; readiness ${cleanText(readiness.status || proposal.readinessStatus || '-')}`, null);
    set('Optimize Pump From Network - Readiness', cleanText(readiness.status || proposal.readinessStatus || proposal.status || '-'), null);
    set('Optimize Pump From Network - Target Flow', withUnit(targetFlow, 'm3/h', 6), targetFlow);
    set('Optimize Pump From Network - Target flow', withUnit(targetFlow, 'm3/h', 6), targetFlow);
    set('Optimize Pump From Network - Required System Head', withUnit(requiredHead, 'm', 6), requiredHead);
    set('Optimize Pump From Network - Required system head', withUnit(requiredHead, 'm', 6), requiredHead);
    set('Optimize Pump From Network - NPSHa at Design', withUnit(proposalNpsha, 'm', 6), proposalNpsha);
    set('Optimize Pump From Network - NPSHa at design', withUnit(proposalNpsha, 'm', 6), proposalNpsha);
    set('Optimize Pump From Network - Max Allowable NPSHr', withUnit(proposalMaxAllowableNpshr, 'm', 6), proposalMaxAllowableNpshr);
    set('Optimize Pump From Network - Max allowable NPSHr', withUnit(proposalMaxAllowableNpshr, 'm', 6), proposalMaxAllowableNpshr);
    set('Optimize Pump From Network - Proposed NPSHr', withUnit(proposedNpshr, 'm', 6), proposedNpshr);
    set('Optimize Pump From Network - Worst AOR Flow', withUnit(worst.flow, 'm3/h', 6), firstNumber(worst.flow));
    set('Optimize Pump From Network - Worst AOR flow', withUnit(worst.flow, 'm3/h', 6), firstNumber(worst.flow));
    set('Optimize Pump From Network - Worst AOR Point', `${withUnit(worst.flow, 'm3/h', 3)}, ${withUnit(worst.percentBep, '% BEP', 1)}, NPSHa ${withUnit(worst.npsha, 'm', 3)}`, firstNumber(worst.flow));

    const sinkMode = cleanText(sinkResults.boundaryMode || sinkProps.boundaryMode || 'Flow Demand Boundary');
    const isSinkFlowDemand = /flow\s*demand/i.test(sinkMode);
    const configuredSinkDemand = firstNumber(sinkResults.configuredDemandFlow, sinkProps.demandFlow);
    const sinkPressure = isSinkFlowDemand
      ? firstNumber(sinkResults.requiredBoundaryPressure, sinkResults.calculatedPressure, sinkResults.boundaryPressure, sinkResults.staticPressure)
      : firstNumber(sinkProps.pressure, sinkResults.boundaryPressure, sinkResults.calculatedPressure, sinkResults.staticPressure);
    const sinkPressureInput = isSinkFlowDemand ? null : firstNumber(sinkProps.pressure, sinkResults.boundaryPressureInput);
    const sinkFlow = firstNumber(sinkResults.flow, pumpFlow, configuredSinkDemand);
    const sinkMassFlow = firstNumber(sinkResults.massFlow, massFlowKgH(sinkFlow, density));
    const sinkElevation = firstNumber(sinkProps.elevation);
    const sinkHydraulicHead = firstNumber(sinkResults.hydraulicHead, pressureHeadM(sinkPressure, density) !== null && sinkElevation !== null ? pressureHeadM(sinkPressure, density) + sinkElevation : null);
    const outletPressureHead = pressureHeadM(sinkPressure, density);
    const terminalVelocityHead = firstNumber(dischargePipe.object?.results?.velocityHead, sinkResults.terminalVelocityHead);
    const vaporMarginM = vaporMarginHeadM(sinkPressure, vaporPressure, density);
    const vaporMarginBar = firstNumber(sinkPressure !== null && vaporPressure !== null ? sinkPressure - vaporPressure : null);

    set('SNK - Flow Demand', withUnit(isSinkFlowDemand ? configuredSinkDemand : sinkFlow, 'm3/h', 6), isSinkFlowDemand ? configuredSinkDemand : sinkFlow);
    set('SNK - Flow demand', withUnit(isSinkFlowDemand ? configuredSinkDemand : sinkFlow, 'm3/h', 6), isSinkFlowDemand ? configuredSinkDemand : sinkFlow);
    set('SNK - Flow Demand / Elevation', `${withUnit(isSinkFlowDemand ? configuredSinkDemand : sinkFlow, 'm3/h', 6)} / ${withUnit(sinkElevation, 'm', 6)}`, isSinkFlowDemand ? configuredSinkDemand : sinkFlow);
    set('SNK - Pressure Basis', cleanText(sinkProps.pressureBasis || sinkResults.pressureBasis || 'Static'), null);
    set('SNK - Reference Pressure', isSinkFlowDemand ? 'Ignored in Flow Demand Boundary' : withUnit(sinkPressure, 'bar a', 11), isSinkFlowDemand ? null : sinkPressure);
    set('SNK - Reference pressure', isSinkFlowDemand ? 'Ignored in Flow Demand Boundary' : withUnit(sinkPressure, 'bar a', 11), isSinkFlowDemand ? null : sinkPressure);
    set('SNK - SNK Elevation', withUnit(sinkElevation, 'm', 6), sinkElevation);
    set('SNK - Elevation', withUnit(sinkElevation, 'm', 6), sinkElevation);

    set('Outlet Readout - Boundary Mode', sinkMode, null);
    set('Outlet Readout - Boundary Pressure Input', isSinkFlowDemand ? 'Ignored in Flow Demand Boundary' : withUnit(sinkPressureInput, 'bar a', 9), isSinkFlowDemand ? null : sinkPressureInput);
    set('Outlet Readout - Boundary Abs. Pressure', withUnit(sinkPressure, 'bar a', 9), sinkPressure);
    set('Outlet Readout - Boundary abs pressure', withUnit(sinkPressure, 'bar a', 9), sinkPressure);
    set('Outlet Readout - Pressure Head', withUnit(outletPressureHead, 'm', 9), outletPressureHead);
    set('Outlet Readout - Pressure head', withUnit(outletPressureHead, 'm', 9), outletPressureHead);
    set('Outlet Readout - Discharge Loss', withUnit(dischargeLoss, 'm', 9), dischargeLoss);
    set('Outlet Readout - Discharge loss', withUnit(dischargeLoss, 'm', 9), dischargeLoss);
    set('Outlet Readout - Terminal Velocity Head', withUnit(terminalVelocityHead, 'm', 9), terminalVelocityHead);
    set('Outlet Readout - Terminal velocity head', withUnit(terminalVelocityHead, 'm', 9), terminalVelocityHead);
    set('Outlet Readout - SNK Hydraulic Head', withUnit(sinkHydraulicHead, 'm', 9), sinkHydraulicHead);
    set('Outlet Readout - SNK hydraulic head', withUnit(sinkHydraulicHead, 'm', 9), sinkHydraulicHead);
    set('Outlet Readout - Flow Rate', withUnit(sinkFlow, 'm3/h', 6), sinkFlow);
    set('Outlet Readout - Flow rate', withUnit(sinkFlow, 'm3/h', 6), sinkFlow);
    set('Outlet Readout - Mass Flow', withUnit(sinkMassFlow, 'kg/h', 6), sinkMassFlow);
    set('Outlet Readout - Mass flow', withUnit(sinkMassFlow, 'kg/h', 6), sinkMassFlow);
    set('Outlet Readout - Pipe Endpoint Static P', withUnit(firstNumber(sinkResults.pipeEndpointPressure, sinkResults.staticPressure, sinkPressure), 'bar a', 9), firstNumber(sinkResults.pipeEndpointPressure, sinkResults.staticPressure, sinkPressure));
    set('Outlet Readout - Pipe endpoint static P', withUnit(firstNumber(sinkResults.pipeEndpointPressure, sinkResults.staticPressure, sinkPressure), 'bar a', 9), firstNumber(sinkResults.pipeEndpointPressure, sinkResults.staticPressure, sinkPressure));
    set('Outlet Readout - Pipe Endpoint Stagnation P', withUnit(firstNumber(sinkResults.stagnationPressure), 'bar a', 9), firstNumber(sinkResults.stagnationPressure));
    set('Outlet Readout - Pipe endpoint stagnation P', withUnit(firstNumber(sinkResults.stagnationPressure), 'bar a', 9), firstNumber(sinkResults.stagnationPressure));
    set('Outlet Readout - Required Boundary P', withUnit(firstNumber(sinkResults.requiredBoundaryPressure, sinkPressure), 'bar a', 9), firstNumber(sinkResults.requiredBoundaryPressure, sinkPressure));
    set('Outlet Readout - Required boundary P', withUnit(firstNumber(sinkResults.requiredBoundaryPressure, sinkPressure), 'bar a', 9), firstNumber(sinkResults.requiredBoundaryPressure, sinkPressure));
    set('Outlet Readout - Vapor Pressure', withUnit(vaporPressure, 'bar a', 12), vaporPressure);
    set('Outlet Readout - Vapor pressure', withUnit(vaporPressure, 'bar a', 12), vaporPressure);
    set('Outlet Readout - Vapor Margin', withUnit(vaporMarginM, 'm', 9), vaporMarginM, `${withUnit(vaporMarginBar, 'bar', 9)} (${withUnit(vaporMarginM, 'm', 9)})`);
    set('Outlet Readout - Vapor margin', withUnit(vaporMarginM, 'm', 9), vaporMarginM, `${withUnit(vaporMarginBar, 'bar', 9)} (${withUnit(vaporMarginM, 'm', 9)})`);

    return entries;
  };

  const tableHeaders = (table) => {
    const row = table.tHead?.rows?.[0] || table.querySelector('tr');
    if (!row) return null;
    const labels = Array.from(row.cells || []).map((cell) => normalizeMetric([
      cell.textContent,
      cell.dataset?.label,
      cell.dataset?.i18nDataLabelFallback,
      cell.dataset?.i18nFallback,
      cell.dataset?.i18nTextFallback
    ].filter(Boolean).join(' ')));
    const indexOfAny = (...needles) => labels.findIndex((label) => needles.some((needle) => label.includes(needle)));
    const metricIndex = indexOfAny('metric', 'metrik');
    const applicationIndex = indexOfAny('application', 'aplikasi');
    const journalIndex = indexOfAny('journal', 'jurnal');
    const errorIndex = indexOfAny('error');
    const valueIndex = indexOfAny('value', 'nilai');
    return { labels, metricIndex, applicationIndex, journalIndex, errorIndex, valueIndex };
  };

  const computeError = (journalText, liveEntry) => {
    const journal = firstNumber(journalText);
    const application = liveEntry?.numeric;
    if (journal === null || application === null || Math.abs(journal) < 1e-12) return '-';
    return `${fixed(Math.abs((application - journal) / journal) * 100, 2)}%`;
  };

  const setCellText = (cell, text) => {
    if (!cell || text === null || text === undefined || text === '') return false;
    const next = String(text);
    if (cell.textContent.trim() === next) return false;
    cell.textContent = next;
    cell.dataset.analysisReportLive = VERSION;
    cell.title = 'Live from current simulation calculation result';
    return true;
  };

  const updateComparisonTable = (table, metrics) => {
    const headers = tableHeaders(table);
    if (!headers || headers.metricIndex < 0 || headers.applicationIndex < 0) return 0;
    let changed = 0;
    Array.from(table.querySelectorAll('tbody tr, tr')).forEach((row) => {
      if (row.closest?.('thead')) return;
      const cells = Array.from(row.cells || []);
      const metricCell = cells[headers.metricIndex];
      const appCell = cells[headers.applicationIndex];
      if (!metricCell || !appCell) return;
      const canonicalLabel = canonicalMetricLabel(metricCell.textContent);
      const liveEntry = metrics.get(normalizeMetric(canonicalLabel));
      if (!liveEntry) return;
      if (canonicalLabel !== metricCell.textContent && setCellText(metricCell, liveEntry.metric)) changed += 1;
      if (setCellText(appCell, liveEntry.text)) changed += 1;
      if (headers.errorIndex >= 0 && headers.journalIndex >= 0) {
        const errorCell = cells[headers.errorIndex];
        const journalCell = cells[headers.journalIndex];
        if (errorCell && journalCell && setCellText(errorCell, computeError(journalCell.textContent, liveEntry))) changed += 1;
      }
    });
    return changed;
  };

  const isApplicationValueTable = (table) => {
    const headers = tableHeaders(table);
    if (!headers || headers.metricIndex < 0 || headers.valueIndex < 0 || headers.applicationIndex >= 0) return false;
    const containerText = String(table.closest('section, article, .journal-analysis-card, .fluid-help-card, .task-window-body')?.textContent || '').slice(0, 3000);
    return /application input\s*&\s*result data|application data|application recalculation|calculated outlet|app recalculation|data input\s*&\s*hasil aplikasi|hasil aplikasi/i.test(containerText)
      && !/journal data|ekstraksi data jurnal/i.test(containerText.slice(0, 500));
  };

  const updateApplicationValueTable = (table, metrics) => {
    const headers = tableHeaders(table);
    if (!headers || headers.metricIndex < 0 || headers.valueIndex < 0 || !isApplicationValueTable(table)) return 0;
    let changed = 0;
    Array.from(table.querySelectorAll('tbody tr, tr')).forEach((row) => {
      if (row.closest?.('thead')) return;
      const cells = Array.from(row.cells || []);
      const metricCell = cells[headers.metricIndex];
      const valueCell = cells[headers.valueIndex];
      if (!metricCell || !valueCell) return;
      const canonicalLabel = canonicalMetricLabel(metricCell.textContent);
      const liveEntry = metrics.get(normalizeMetric(canonicalLabel));
      if (liveEntry && canonicalLabel !== metricCell.textContent && setCellText(metricCell, liveEntry.metric)) changed += 1;
      if (liveEntry && setCellText(valueCell, liveEntry.valueText)) changed += 1;
    });
    return changed;
  };

  const isVisibleElement = (element) => {
    if (!element) return false;
    if (document.documentElement?.contains && !document.documentElement.contains(element)) return false;
    const style = root.getComputedStyle ? root.getComputedStyle(element) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    if (element.classList?.contains?.('task-window-minimized') || element.classList?.contains?.('minimized')) return false;
    return element.offsetParent !== null || element.getClientRects?.().length > 0;
  };

  const activeReportSurfaces = () => Array.from(document.querySelectorAll(ACTIVE_SELECTOR))
    .filter((element) => isVisibleElement(element)
      && (element.classList?.contains?.('journal-analysis-task-window')
        || /analysis report|journal|comparison|application|laporan analisis|jurnal|perbandingan|aplikasi/i.test(element.textContent || '')));

  const hasActiveReportSurface = () => activeReportSurfaces().length > 0;

  const reportScope = (surface) => {
    if (!surface) return null;
    return surface.classList?.contains?.('journal-analysis-report-panel')
      ? surface
      : (surface.querySelector?.('.journal-analysis-report-panel')
        || surface.querySelector?.('.task-window-body')
        || surface);
  };

  const visibleText = (element) => String(element?.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();

  const sheetName = (name, usedNames = new Set()) => {
    const base = String(name || 'Sheet')
      .replace(/[\\/?*[\]:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet';
    let candidate = base;
    let suffix = 2;
    while (usedNames.has(candidate.toLowerCase())) {
      const tail = ` ${suffix}`;
      candidate = `${base.slice(0, Math.max(1, 31 - tail.length))}${tail}`;
      suffix += 1;
    }
    usedNames.add(candidate.toLowerCase());
    return candidate;
  };

  const findNearestSectionHeading = (element) => {
    const host = element?.closest?.('section, article, .journal-analysis-card, .fluid-help-card, .task-window-body');
    const heading = host?.querySelector?.('h1, h2, h3, h4, h5, h6, caption');
    return visibleText(heading) || 'Analysis Report';
  };

  const tableRows = (table) => Array.from(table?.rows || [])
    .map((row) => Array.from(row.cells || []).map((cell) => visibleText(cell)))
    .filter((row) => row.some(Boolean));

  const findCaseStatusSummaryHeading = (surface) => {
    const scope = reportScope(surface);
    if (!scope?.querySelectorAll) return null;
    const headings = Array.from(scope.querySelectorAll('h1, h2, h3, h4, h5, h6, .journal-analysis-section-title, .fluid-help-card-title, summary, caption'));
    return headings.find((heading) => {
      const text = normalizeMetric(heading.textContent);
      return text.includes('case status summary')
        || text.includes('status summary')
        || text.includes('ringkasan status kasus')
        || text.includes('ringkasan status');
    }) || null;
  };

  const findSectionHeading = (scope, patterns) => {
    if (!scope?.querySelectorAll) return null;
    const headings = Array.from(scope.querySelectorAll('h1, h2, h3, h4, h5, h6, .journal-analysis-section-title, .fluid-help-card-title, summary, caption'));
    return headings.find((heading) => {
      const text = normalizeMetric(heading.textContent);
      return patterns.some((pattern) => text.includes(pattern));
    }) || null;
  };

  const sectionHost = (heading) => heading?.closest?.('section, article, .journal-analysis-card, .fluid-help-card') || heading?.parentElement || null;

  const textRowTag = (element) => {
    const tag = String(element?.tagName || '').toUpperCase();
    if (/^H[1-6]$/.test(tag)) return 'H3';
    if (tag === 'LI') return 'LI';
    if (tag === 'SUMMARY') return 'H3';
    if (tag === 'CAPTION') return 'H3';
    return tag || 'TEXT';
  };

  const collectSectionTextRows = (scope, title, patterns) => {
    const heading = findSectionHeading(scope, patterns);
    if (!heading) return [[`H3`, title], ['LI', `${title} section is not visible in this Analysis Report.`]];
    const host = sectionHost(heading);
    const elements = [heading, ...Array.from(host?.querySelectorAll?.('h1, h2, h3, h4, h5, h6, p, li, summary, caption') || [])];
    const seen = new Set();
    const rows = [];
    elements.forEach((element) => {
      if (!element || seen.has(element)) return;
      seen.add(element);
      if (element.closest?.('table') || element.closest?.('[data-analysis-report-xlsx-export]')) return;
      const text = visibleText(element);
      if (!text || text === 'XLSX') return;
      rows.push([textRowTag(element), text]);
    });
    if (!rows.length || normalizeMetric(rows[0][1]) !== normalizeMetric(visibleText(heading))) {
      rows.unshift(['H3', visibleText(heading) || title]);
    }
    return rows;
  };

  const collectReportTextSheetRows = (surface) => {
    const scope = reportScope(surface);
    const rows = [];
    rows.push(...collectSectionTextRows(scope, 'Case Status Summary', [
      'case status summary',
      'status summary',
      'ringkasan status kasus',
      'ringkasan status'
    ]));
    rows.push([]);
    rows.push(...collectSectionTextRows(scope, 'Findings', [
      'findings',
      'finding',
      'temuan'
    ]));
    return rows.filter((row, index, list) => row.some(Boolean) || (index > 0 && index < list.length - 1));
  };

  const collectReportTextRows = (scope) => {
    if (!scope?.querySelectorAll) return [];
    return Array.from(scope.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, summary, caption, pre, code'))
      .filter((element) => !element.closest?.('table') && !element.closest?.('[data-analysis-report-xlsx-export]'))
      .map((element) => [element.tagName || 'TEXT', visibleText(element)])
      .filter((row) => row[1]);
  };

  const collectCaseStatusSummaryRows = (surface) => {
    const heading = findCaseStatusSummaryHeading(surface);
    const host = heading?.closest?.('section, article, .journal-analysis-card, .fluid-help-card') || heading?.parentElement;
    if (!host) return [];
    const rows = [];
    const title = visibleText(heading);
    if (title) rows.push([title]);
    const tables = Array.from(host.querySelectorAll?.('table') || []);
    tables.forEach((table, index) => {
      if (index > 0 || rows.length) rows.push([]);
      rows.push([visibleText(table.caption) || `${title || 'Case Status Summary'} Table ${index + 1}`]);
      rows.push(...tableRows(table));
    });
    if (!tables.length) {
      Array.from(host.querySelectorAll?.('p, li') || [])
        .map((element) => visibleText(element))
        .filter(Boolean)
        .forEach((text) => rows.push([text]));
    }
    return rows.filter((row) => row.some(Boolean));
  };

  const inferExportUnit = (...texts) => {
    for (const text of texts) {
      const value = normalizeExportNumericText(text);
      const percent = value.match(/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*%$/i);
      if (percent) return '%';
      const match = value.match(/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?\s*([A-Za-z%][A-Za-z0-9%/.\- ^]*)$/i);
      if (match && match[1]) return match[1].replace(/\s+/g, ' ').trim();
    }
    return '';
  };

  const normalizeExportNumericText = (text) => {
    let value = String(text || '').replace(/,/g, '').trim();
    if (!value || value === '-') return value;
    value = value.replace(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(\s+[A-Za-z%][A-Za-z0-9%/.\- ^]*)?\s+-$/i, '$1$2');
    value = value.replace(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)\s*-\s+([A-Za-z%][A-Za-z0-9%/.\- ^]*)$/i, '$1 $2');
    value = value.replace(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)-$/i, '$1');
    return value.trim();
  };

  const exportComparableValue = (text, unit = '') => {
    const value = normalizeExportNumericText(text);
    if (!value) return '';
    const percent = value.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*%$/i);
    if (percent && unit === '%') {
      const number = Number(percent[1]);
      return Number.isFinite(number) ? number / 100 : text;
    }
    const numericWithUnit = value.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)(?:\s+[A-Za-z%][A-Za-z0-9%/.\- ^]*)?$/i);
    if (numericWithUnit) {
      const number = Number(numericWithUnit[1]);
      return Number.isFinite(number) ? number : text;
    }
    return text;
  };

  const comparableNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

  const percentErrorValue = (journalValue, applicationValue) => {
    const journalNumber = comparableNumber(journalValue);
    const applicationNumber = comparableNumber(applicationValue);
    if (journalNumber === null || applicationNumber === null || journalNumber === 0) return '';
    return Math.abs(applicationNumber - journalNumber) / Math.abs(journalNumber);
  };

  const findJournalComparisonTable = (scope) => {
    const tables = Array.from(scope?.querySelectorAll?.('table') || []);
    return tables.find((table) => {
      const headers = tableHeaders(table);
      if (!headers || headers.metricIndex < 0 || headers.journalIndex < 0 || headers.applicationIndex < 0) return false;
      const title = normalizeMetric(visibleText(table.caption) || findNearestSectionHeading(table));
      const nearby = normalizeMetric(table.closest?.('section, article, .journal-analysis-card, .fluid-help-card, .task-window-body')?.textContent || '');
      return title.includes('journal vs application')
        || title.includes('comparison')
        || nearby.includes('journal vs application')
        || nearby.includes('perbandingan jurnal');
    }) || null;
  };

  const collectJournalComparisonSheetRows = (surface) => {
    const scope = reportScope(surface);
    const table = findJournalComparisonTable(scope);
    const headers = tableHeaders(table);
    const rows = [['Metric', 'unit', 'Journal', 'Application', 'Error', 'Status']];
    if (!table || !headers || headers.metricIndex < 0 || headers.journalIndex < 0 || headers.applicationIndex < 0) {
      return rows;
    }
    const statusIndex = headers.labels.findIndex((label) => label.includes('status'));
    const unitIndex = headers.labels.findIndex((label) => label === 'unit' || label.includes('satuan'));
    Array.from(table.querySelectorAll('tbody tr, tr')).forEach((row) => {
      if (row.closest?.('thead')) return;
      const cells = Array.from(row.cells || []);
      const metric = visibleText(cells[headers.metricIndex]);
      const journalText = visibleText(cells[headers.journalIndex]);
      const appText = visibleText(cells[headers.applicationIndex]);
      if (!metric) return;
      const unit = unitIndex >= 0
        ? visibleText(cells[unitIndex])
        : inferExportUnit(journalText, appText);
      const journalValue = exportComparableValue(journalText, unit);
      const applicationValue = exportComparableValue(appText, unit);
      const rowNumber = rows.length + 8;
      rows.push([
        metric,
        unit,
        journalValue,
        applicationValue,
        {
          formula: `IFERROR(ABS(D${rowNumber}-C${rowNumber})/ABS(C${rowNumber}),"")`,
          value: percentErrorValue(journalValue, applicationValue),
          style: 'error'
        },
        statusIndex >= 0 ? visibleText(cells[statusIndex]) : ''
      ]);
    });
    return rows;
  };

  const collectAnalysisReportWorkbook = (surface) => {
    return {
      title: 'Analysis Report',
      sheets: [
        {
          name: 'Report Text',
          type: 'reportText',
          columns: [{ min: 1, max: 1, width: 12.28515625 }, { min: 2, max: 2, width: 118 }],
          merges: ['A1:A4'],
          rows: collectReportTextSheetRows(surface)
        },
        {
          name: 'Journal vs Application Comparis',
          type: 'comparison',
          columns: [
            { min: 1, max: 1, width: 50.85546875 },
            { min: 2, max: 2, width: 9.85546875 },
            { min: 3, max: 4, width: 20 },
            { min: 5, max: 5, width: 14.85546875 },
            { min: 6, max: 6, width: 46.7109375 }
          ],
          merges: ['A1:A4', 'A6:F6'],
          rows: collectJournalComparisonSheetRows(surface)
        }
      ]
    };
  };

  const xmlEscape = (value) => String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const columnName = (index) => {
    let name = '';
    let value = index + 1;
    while (value > 0) {
      const mod = (value - 1) % 26;
      name = String.fromCharCode(65 + mod) + name;
      value = Math.floor((value - mod) / 26);
    }
    return name;
  };

  const isNumericCell = (value) => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(String(value || '').trim());

  const STYLE_IDS = {
    reportBand: 1,
    reportTitle: 2,
    reportTag: 3,
    reportText: 4,
    comparisonTitle: 5,
    header: 6,
    dataA: 7,
    errorA: 8,
    statusA: 9,
    dataB: 10,
    errorB: 11,
    statusB: 12
  };

  const styleId = (style) => {
    if (typeof style === 'number') return style;
    if (!style) return null;
    return STYLE_IDS[style] ?? null;
  };

  const cellPayload = (cell) => (cell && typeof cell === 'object' && !Array.isArray(cell) ? cell : { value: cell });

  const styledReportRow = (row) => {
    if (!row?.some?.(Boolean)) return [];
    const tag = row[0] || '';
    const text = row[1] || '';
    const heading = tag === 'H3';
    return [
      { value: tag, style: heading ? 'reportTag' : 'reportTag' },
      { value: text, style: heading ? 'reportTitle' : 'reportText' }
    ];
  };

  const styledComparisonRow = (row, index) => {
    if (index === 0) {
      return row.map((value) => ({ value, style: 'header' }));
    }
    const band = Math.floor((index - 1) / 7) % 2 === 0 ? 'A' : 'B';
    const dataStyle = band === 'A' ? 'dataA' : 'dataB';
    const errorStyle = band === 'A' ? 'errorA' : 'errorB';
    const statusStyle = band === 'A' ? 'statusA' : 'statusB';
    return row.map((value, columnIndex) => {
      if (columnIndex === 4) return { ...cellPayload(value), style: errorStyle };
      if (columnIndex === 5) return { ...cellPayload(value), style: statusStyle };
      return { ...cellPayload(value), style: dataStyle };
    });
  };

  const sheetRowsForXml = (sheet) => {
    if (sheet?.type === 'reportText') {
      const topRows = Array.from({ length: 4 }, () => [
        { value: '', style: 'reportBand' },
        { value: '', style: 'reportText' }
      ]);
      const bodyRows = (sheet.rows || []).map(styledReportRow);
      return [...topRows, ...bodyRows];
    }
    if (sheet?.type === 'comparison') {
      const topRows = Array.from({ length: 4 }, () => [
        { value: '', style: 'reportBand' },
        { value: '', style: 'reportText' }
      ]);
      const titleRows = [
        [],
        [{ value: 'Journal vs Application Comparison', style: 'comparisonTitle' }],
        [],
        ...((sheet.rows || []).map(styledComparisonRow))
      ];
      return [...topRows, ...titleRows];
    }
    return sheet?.rows || [];
  };

  const analysisReportDrawingXml = (sheetIndex) => {
    const comparisonSheet = sheetIndex > 0;
    const textFromCol = comparisonSheet ? 0 : 1;
    const textFromColOff = comparisonSheet ? 790575 : 47624;
    const textToCol = comparisonSheet ? 3 : 11;
    const textToColOff = comparisonSheet ? 914400 : 190499;
    const brandLines = [
      {
        text: 'Sultan Ageng Tirtayasa University - Mechanical Engineering',
        size: 1600,
        bold: true,
        color: '7A2E00'
      },
      {
        text: 'Simulation & Modeling of a Pumping System for Evaluating',
        size: 1100,
        bold: true
      },
      {
        text: 'Cavitation Potential in Centrifugal Pumps Based on NPSH Analysis',
        size: 1100,
        bold: true
      },
      {
        text: "Bachelor's Thesis - Farid Azrighani",
        size: 1100,
        italic: true
      }
    ];
    const paragraphXml = brandLines.map((line) => {
      const bold = line.bold ? ' b="1"' : '';
      const italic = line.italic ? ' i="1"' : '';
      const color = line.color ? `<a:solidFill><a:srgbClr val="${xmlEscape(line.color)}"/></a:solidFill>` : '';
      return `<a:p><a:r><a:rPr lang="en-ID" sz="${line.size}"${bold}${italic}>${color}<a:latin typeface="Calibri"/><a:ea typeface="Calibri"/><a:cs typeface="Calibri"/></a:rPr><a:t>${xmlEscape(line.text)}</a:t></a:r></a:p>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>7200</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>32400</xdr:rowOff></xdr:from><xdr:ext cx="771525" cy="771525"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="UNTIRTA Logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1" cstate="print"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="7200" y="32400"/><a:ext cx="771525" cy="771525"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor><xdr:twoCellAnchor><xdr:from><xdr:col>${textFromCol}</xdr:col><xdr:colOff>${textFromColOff}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${textToCol}</xdr:col><xdr:colOff>${textToColOff}</xdr:colOff><xdr:row>3</xdr:row><xdr:rowOff>190500</xdr:rowOff></xdr:to><xdr:sp macro="" textlink=""><xdr:nvSpPr><xdr:cNvPr id="3" name="Report Header"/><xdr:cNvSpPr txBox="1"/></xdr:nvSpPr><xdr:spPr><a:xfrm><a:off x="${comparisonSheet ? 790575 : 866774}" y="0"/><a:ext cx="${comparisonSheet ? 5505450 : 6238875}" cy="923925"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></xdr:spPr><xdr:txBody><a:bodyPr vertOverflow="clip" horzOverflow="clip" wrap="square" rtlCol="0" anchor="t"/><a:lstStyle/>${paragraphXml}</xdr:txBody></xdr:sp><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`;
  };

  const worksheetXml = (sheet, sheetIndex = 0, includeBranding = false) => {
    const rows = sheetRowsForXml(sheet);
    const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const dimension = rows.length && maxColumns
      ? `A1:${columnName(maxColumns - 1)}${rows.length}`
      : 'A1';
    const columnXml = (sheet.columns || [])
      .map((column) => `<col min="${column.min}" max="${column.max}" width="${column.width}" customWidth="1"/>`)
      .join('');
    const rowXml = rows.map((row, rowIndex) => {
      if (!row?.length) return `<row r="${rowIndex + 1}"/>`;
      const cells = row.map((rawCell, columnIndex) => {
        const cell = cellPayload(rawCell);
        const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
        const resolvedStyle = styleId(cell.style);
        const styleAttr = resolvedStyle === null ? '' : ` s="${resolvedStyle}"`;
        if (cell.formula) {
          const cachedValue = cell.value;
          const cachedXml = typeof cachedValue === 'number' || (String(cachedValue ?? '').trim() && isNumericCell(cachedValue))
            ? `<v>${xmlEscape(cachedValue)}</v>`
            : '';
          return `<c r="${ref}"${styleAttr}><f>${xmlEscape(cell.formula)}</f>${cachedXml}</c>`;
        }
        const value = cell.value;
        const text = String(value ?? '').trim();
        if (typeof value === 'number' || (text && isNumericCell(text))) {
          return `<c r="${ref}"${styleAttr}><v>${xmlEscape(value)}</v></c>`;
        }
        return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join('');
    const mergeXml = (sheet.merges || []).length
      ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${xmlEscape(ref)}"/>`).join('')}</mergeCells>`
      : '';
    const rowHeightXml = '<sheetFormatPr defaultRowHeight="15"/>';
    const pageMarginsXml = '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>';
    const drawingXml = includeBranding ? '<drawing r:id="rId1"/>' : '';
    const namespaceXml = includeBranding
      ? ' xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
      : ' xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet${namespaceXml}><dimension ref="${dimension}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews>${rowHeightXml}${columnXml ? `<cols>${columnXml}</cols>` : ''}<sheetData>${rowXml}</sheetData>${mergeXml}${pageMarginsXml}${drawingXml}</worksheet>`;
  };

  const stylesXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.00%"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="13"/><color rgb="FF1F4E78"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF3F8"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F9FC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFCE4D6"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9E2EA"/></left><right style="thin"><color rgb="FFD9E2EA"/></right><top style="thin"><color rgb="FFD9E2EA"/></top><bottom style="thin"><color rgb="FFD9E2EA"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="13"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  const crc32 = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[index] = value >>> 0;
    }
    return (bytes) => {
      let crc = 0xFFFFFFFF;
      for (let index = 0; index < bytes.length; index += 1) {
        crc = table[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8);
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    };
  })();

  const encodeText = (text) => new TextEncoder().encode(String(text));

  const writeUint16 = (view, offset, value) => view.setUint16(offset, value, true);
  const writeUint32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);

  const concatBytes = (parts) => {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => {
      output.set(part, offset);
      offset += part.length;
    });
    return output;
  };

  const zipFiles = (files) => {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    files.forEach((file) => {
      const nameBytes = encodeText(file.path);
      const dataBytes = file.data instanceof Uint8Array ? file.data : encodeText(file.data);
      const crc = crc32(dataBytes);
      const localHeader = new Uint8Array(30);
      const localView = new DataView(localHeader.buffer);
      writeUint32(localView, 0, 0x04034b50);
      writeUint16(localView, 4, 20);
      writeUint16(localView, 6, 0);
      writeUint16(localView, 8, 0);
      writeUint16(localView, 10, 0);
      writeUint16(localView, 12, 0);
      writeUint32(localView, 14, crc);
      writeUint32(localView, 18, dataBytes.length);
      writeUint32(localView, 22, dataBytes.length);
      writeUint16(localView, 26, nameBytes.length);
      writeUint16(localView, 28, 0);
      localParts.push(localHeader, nameBytes, dataBytes);

      const centralHeader = new Uint8Array(46);
      const centralView = new DataView(centralHeader.buffer);
      writeUint32(centralView, 0, 0x02014b50);
      writeUint16(centralView, 4, 20);
      writeUint16(centralView, 6, 20);
      writeUint16(centralView, 8, 0);
      writeUint16(centralView, 10, 0);
      writeUint16(centralView, 12, 0);
      writeUint16(centralView, 14, 0);
      writeUint32(centralView, 16, crc);
      writeUint32(centralView, 20, dataBytes.length);
      writeUint32(centralView, 24, dataBytes.length);
      writeUint16(centralView, 28, nameBytes.length);
      writeUint16(centralView, 30, 0);
      writeUint16(centralView, 32, 0);
      writeUint16(centralView, 34, 0);
      writeUint16(centralView, 36, 0);
      writeUint32(centralView, 38, 0);
      writeUint32(centralView, 42, offset);
      centralParts.push(centralHeader, nameBytes);
      offset += localHeader.length + nameBytes.length + dataBytes.length;
    });
    const centralDirectory = concatBytes(centralParts);
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);
    writeUint32(endView, 0, 0x06054b50);
    writeUint16(endView, 4, 0);
    writeUint16(endView, 6, 0);
    writeUint16(endView, 8, files.length);
    writeUint16(endView, 10, files.length);
    writeUint32(endView, 12, centralDirectory.length);
    writeUint32(endView, 16, offset);
    writeUint16(endView, 20, 0);
    return concatBytes([...localParts, centralDirectory, endRecord]);
  };

  const asUint8Array = (value) => {
    if (!value) return null;
    if (value instanceof Uint8Array) return value;
    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return new Uint8Array(value);
    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView?.(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    return null;
  };

  const buildXlsxBytes = (workbook) => {
    const sheets = workbook?.sheets?.length ? workbook.sheets : [{ name: 'Report Text', rows: [['H3', 'No report data available']] }];
    const logoBytes = asUint8Array(workbook?.logoBytes);
    const includeBranding = Boolean(logoBytes?.length);
    const workbookSheets = sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('');
    const workbookRels = sheets.map((sheet, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('');
    const worksheetOverrides = sheets.map((sheet, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    const drawingOverrides = includeBranding
      ? sheets.map((sheet, index) => `<Override PartName="/xl/drawings/drawing${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('')
      : '';
    const worksheetRelationshipFiles = includeBranding
      ? sheets.map((sheet, index) => ({
        path: `xl/worksheets/_rels/sheet${index + 1}.xml.rels`,
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${index + 1}.xml"/></Relationships>`
      }))
      : [];
    const drawingFiles = includeBranding
      ? sheets.map((sheet, index) => ({
        path: `xl/drawings/drawing${index + 1}.xml`,
        data: analysisReportDrawingXml(index)
      }))
      : [];
    const drawingRelationshipFiles = includeBranding
      ? sheets.map((sheet, index) => ({
        path: `xl/drawings/_rels/drawing${index + 1}.xml.rels`,
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>'
      }))
      : [];
    const files = [
      {
        path: '[Content_Types].xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${includeBranding ? '<Default Extension="png" ContentType="image/png"/>' : ''}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${worksheetOverrides}${drawingOverrides}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
      },
      {
        path: '_rels/.rels',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'
      },
      {
        path: 'xl/workbook.xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets><calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`
      },
      {
        path: 'xl/_rels/workbook.xml.rels',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
      },
      {
        path: 'xl/styles.xml',
        data: stylesXml()
      },
      {
        path: 'docProps/core.xml',
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(workbook.title || 'Analysis Report')}</dc:title><dc:creator>NPSH Simulation</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`
      },
      {
        path: 'docProps/app.xml',
        data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>NPSH Simulation</Application></Properties>'
      },
      ...sheets.map((sheet, index) => ({
        path: `xl/worksheets/sheet${index + 1}.xml`,
        data: worksheetXml(sheet, index, includeBranding)
      })),
      ...worksheetRelationshipFiles,
      ...drawingFiles,
      ...drawingRelationshipFiles,
      ...(includeBranding ? [{ path: 'xl/media/image1.png', data: logoBytes }] : [])
    ];
    return zipFiles(files);
  };

  const downloadBytes = (filename, bytes, mimeType) => {
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    root.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  };

  const exportFilename = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    return `analysis-report-${stamp}.xlsx`;
  };

  const loadAnalysisReportLogoBytes = async () => {
    if (typeof root.fetch !== 'function') return null;
    try {
      const response = await root.fetch(ANALYSIS_REPORT_LOGO_PATH, { cache: 'force-cache' });
      if (!response?.ok || typeof response.arrayBuffer !== 'function') return null;
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      console.warn('Analysis Report XLSX logo could not be loaded.', error);
      return null;
    }
  };

  const downloadAnalysisReportXlsx = async (surface) => {
    refresh();
    const workbook = collectAnalysisReportWorkbook(surface);
    workbook.logoBytes = await loadAnalysisReportLogoBytes();
    const bytes = buildXlsxBytes(workbook);
    return downloadBytes(exportFilename(), bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const installAnalysisReportExportButtons = (surface = null) => {
    if (typeof document === 'undefined' || !document.createElement) return 0;
    const surfaces = surface ? [surface] : activeReportSurfaces();
    let installed = 0;
    surfaces.forEach((item) => {
      const heading = findCaseStatusSummaryHeading(item);
      if (!heading || heading.closest?.('[data-analysis-report-xlsx-title-row]')) return;
      if (/^(caption|summary)$/i.test(String(heading.tagName || ''))) return;
      const parent = heading.parentElement;
      if (!parent?.insertBefore) return;
      const row = document.createElement('div');
      row.className = 'analysis-report-xlsx-title-row';
      row.dataset.analysisReportXlsxTitleRow = 'true';
      parent.insertBefore(row, heading);
      row.appendChild(heading);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'analysis-report-xlsx-export-btn';
      button.dataset.analysisReportXlsxExport = 'true';
      button.textContent = 'XLSX';
      button.title = 'Export Analysis Report to Excel spreadsheet';
      button.setAttribute('aria-label', 'Export Analysis Report to Excel spreadsheet');
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const previousText = button.textContent;
        button.disabled = true;
        button.textContent = 'Saving...';
        try {
          await downloadAnalysisReportXlsx(item);
          if (typeof root.showUiToast === 'function') {
            root.showUiToast('Analysis Report XLSX export has started.', {
              title: 'Export XLSX',
              variant: 'success',
              duration: 3200
            });
          }
        } catch (error) {
          console.warn('Analysis Report XLSX export failed.', error);
          if (typeof root.showUiToast === 'function') {
            root.showUiToast('Analysis Report XLSX export failed. Please try again.', {
              title: 'Export XLSX',
              variant: 'error',
              duration: 5000
            });
          }
        } finally {
          button.disabled = false;
          button.textContent = previousText;
        }
      });
      row.appendChild(button);
      installed += 1;
    });
    return installed;
  };

  const currentInputLatencyShield = () => {
    try {
      if (typeof root.EngineeringInputLatencyShield?.current === 'function') {
        return root.EngineeringInputLatencyShield.current();
      }
      const shield = root.__engineeringInputLatencyShield;
      return shield && Number(shield.activeUntil) > Date.now() ? shield : null;
    } catch (error) {
      return null;
    }
  };

  const shieldedRefreshDelay = (delayMs) => {
    const shield = currentInputLatencyShield();
    if (!shield) return delayMs;
    const remaining = Math.max(0, Number(shield.activeUntil) - Date.now());
    return Math.max(delayMs, Math.min(1500, remaining + 120));
  };

  const refresh = () => {
    const candidates = activeReportSurfaces();
    if (!candidates.length) return 0;
    installResponsiveCss();
    installAnalysisReportExportButtons();
    const metrics = collectLiveMetrics();
    if (!metrics.size) return 0;
    let changed = 0;
    candidates.forEach((rootNode) => {
      rootNode.querySelectorAll('table').forEach((table) => {
        changed += updateComparisonTable(table, metrics);
        changed += updateApplicationValueTable(table, metrics);
      });
    });
    if (changed > 0) {
      root.__npshAnalysisReportLiveLastRefresh = {
        version: VERSION,
        changed,
        refreshedAt: new Date().toISOString()
      };
    }
    return changed;
  };

  let scheduled = 0;
  const scheduleRefresh = (delayMs = 120) => {
    if (!hasActiveReportSurface()) return false;
    if (scheduled) return true;
    delayMs = shieldedRefreshDelay(delayMs);
    scheduled = root.setTimeout(() => {
      scheduled = 0;
      refresh();
    }, delayMs);
    return true;
  };

  const patchUpdateSimulation = () => {
    const current = root.updateSimulation;
    if (typeof current !== 'function' || current.__analysisReportLivePatched) return;
    const wrapped = function updateSimulationAnalysisReportLiveWrapper(...args) {
      const result = current.apply(this, args);
      const options = args[0] && typeof args[0] === 'object' ? args[0] : {};
      if (options.forceBackend || options.forceProtectedBackend || options.__engineeringRealtimeAutoSolve || !currentInputLatencyShield()) {
        scheduleRefresh();
      }
      if (result && typeof result.then === 'function') {
        result.then(scheduleRefresh, scheduleRefresh);
      }
      return result;
    };
    wrapped.__analysisReportLivePatched = true;
    wrapped.__analysisReportLiveOriginal = current;
    root.updateSimulation = wrapped;
  };

  root.EngineeringAnalysisReportLiveRuntime = {
    version: VERSION,
    refresh,
    collectLiveMetrics,
    installResponsiveCss,
    installAnalysisReportExportButtons,
    collectAnalysisReportWorkbook,
    buildXlsxBytes,
    loadAnalysisReportLogoBytes,
    downloadAnalysisReportXlsx,
    scheduleRefresh,
    hasActiveReportSurface
  };

  const nodeTouchesReportSurface = (node) => {
    if (!node) return false;
    if (node.nodeType === 3) return !!node.parentElement?.closest?.(ACTIVE_SELECTOR);
    if (node.nodeType !== 1) return false;
    return !!(node.matches?.(ACTIVE_SELECTOR)
      || node.closest?.(ACTIVE_SELECTOR)
      || node.querySelector?.(ACTIVE_SELECTOR));
  };

  try {
    if (root.MutationObserver) {
      new MutationObserver((mutations) => {
        if (mutations.some((mutation) => (
          nodeTouchesReportSurface(mutation.target)
          || Array.from(mutation.addedNodes || []).some(nodeTouchesReportSurface)
        ))) {
          scheduleRefresh();
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    }
  } catch (error) {
    console.warn('Analysis Report live runtime observer could not be installed.', error);
  }

  try {
    ['input', 'change', 'npsh:simulation-updated', 'npsh:backend-response', 'npsh:calculation-state-updated'].forEach((eventName) => {
      document.addEventListener(eventName, () => scheduleRefresh(), true);
    });
  } catch (error) {
    console.warn('Analysis Report live runtime event hooks could not be installed.', error);
  }

  try {
    root.setInterval(() => {
      patchUpdateSimulation();
      scheduleRefresh(180);
    }, REFRESH_MS);
  } catch (error) {
    console.warn('Analysis Report live runtime interval could not be installed.', error);
  }

  try {
    installResponsiveCss();
    patchUpdateSimulation();
    scheduleRefresh();
  } catch (error) {
    console.warn('Analysis Report live runtime initial refresh could not be scheduled.', error);
  }
})(typeof window !== 'undefined' ? window : globalThis);
