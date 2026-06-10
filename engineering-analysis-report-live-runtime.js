(function installEngineeringAnalysisReportLiveRuntime(root) {
  'use strict';

  const VERSION = '2026.06-analysis-report-live4';
  const REFRESH_MS = 1000;
  const ACTIVE_SELECTOR = '.journal-analysis-task-window, .journal-analysis-report-panel, .task-window';
  const RESPONSIVE_STYLE_ID = 'engineeringAnalysisReportLiveResponsiveStyle';

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
`;
    document.head.appendChild(style);
    return true;
  };

  const normalizeMetric = (value) => String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\/\s+/g, ' / ')
    .trim()
    .toLowerCase();

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

    const pumpFlow = firstNumber(npsh.flow, pumpResults.fixedFlow, pumpResults.flow, pumpProps.designFlow);
    const pumpHead = firstNumber(npsh.pumpHead, pumpResults.requiredSystemHead, pumpResults.pumpHeadAtFlow, pumpResults.head, pumpProps.designHead);
    const npsha = firstNumber(npsh.npsha, pumpResults.npsha);
    const npshr = firstNumber(npsh.npshr, pumpResults.npshr, pumpProps.designNpshr);
    const npshMargin = firstNumber(npsh.npshMargin, pumpResults.npshMargin, npsha !== null && npshr !== null ? npsha - npshr : null);
    const npshRatio = firstNumber(npsh.npshRatio, pumpResults.npshRatio, npsha !== null && npshr ? npsha / npshr : null);
    const requiredNpsha = firstNumber(npsh.requiredNpsha, pumpResults.requiredNpsha);
    const npshExcess = firstNumber(npsh.npshExcess, pumpResults.npshExcess);
    const suctionLoss = firstNumber(npsh.suctionLoss, pipeMetric(suctionPipe, 'totalLoss'), pumpResults.suctionLoss);
    const dischargeLoss = firstNumber(npsh.dischargeLoss, pipeMetric(dischargePipe, 'totalLoss'), pumpResults.dischargeLoss);
    const hydraulicStatus = cleanText(npsh.hydraulicStatus || pumpResults.hydraulicNpshStatus || npsh.status || pumpResults.cavitationStatus || 'Incomplete');
    const engineeringStatus = cleanText(npsh.engineeringStatus || pumpResults.engineeringStatus || pumpResults.status || '-');
    const dataConfidence = [pumpResults.dataConfidenceStatus, pumpResults.dataConfidence || npsh.dataConfidence]
      .filter(Boolean)
      .join(': ');
    const suctionPressure = firstNumber(npsh.suctionPressureAbs, pumpResults.suctionPressure);
    const dischargePressure = firstNumber(pumpResults.dischargePressure);
    const shaftPower = firstNumber(pumpResults.power);
    const efficiency = firstNumber(pumpResults.efficiency, pumpProps.designEfficiency);

    set('Pump - Elevation', withUnit(pumpProps.elevation, 'm', 6), firstNumber(pumpProps.elevation));
    set('Pump - Suction Nozzle Elev.', withUnit(pumpProps.suctionElevation, 'm', 6), firstNumber(pumpProps.suctionElevation));
    set('Pump - Suction nozzle elevation', withUnit(pumpProps.suctionElevation, 'm', 6), firstNumber(pumpProps.suctionElevation));
    set('Pump - Discharge Nozzle Elev.', withUnit(pumpProps.dischargeElevation, 'm', 6), firstNumber(pumpProps.dischargeElevation));
    set('Pump - Discharge nozzle elevation', withUnit(pumpProps.dischargeElevation, 'm', 6), firstNumber(pumpProps.dischargeElevation));
    set('Pump - Elevation / Nozzle Elevations', `${withUnit(pumpProps.elevation, 'm', 3)} / ${withUnit(pumpProps.suctionElevation, 'm', 3)} / ${withUnit(pumpProps.dischargeElevation, 'm', 3)}`, firstNumber(pumpProps.elevation));
    set('Pump - Hydraulic NPSH Status', hydraulicStatus, null);
    set('Pump - Engineering Status', engineeringStatus, null);
    set('Pump - Data Confidence', dataConfidence || '-', null);
    set('Pump - Flow Evaluated', withUnit(pumpFlow, 'm3/h', 6), pumpFlow);
    set('Pump - Flow evaluated', withUnit(pumpFlow, 'm3/h', 6), pumpFlow);
    set('Pump - Pump Head', withUnit(pumpHead, 'm', 6), pumpHead);
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
    set('Pump - Suction Pressure', withUnit(suctionPressure, 'bar a', 9), suctionPressure);
    set('Pump - Suction pressure', withUnit(suctionPressure, 'bar a', 9), suctionPressure);
    set('Pump - Suction Loss', withUnit(suctionLoss, 'm', 9), suctionLoss);
    set('Pump - Suction loss', withUnit(suctionLoss, 'm', 9), suctionLoss);
    set('Pump - Discharge Pressure', withUnit(dischargePressure, 'bar a', 9), dischargePressure);
    set('Pump - Shaft power', withUnit(shaftPower, 'kW', 9), shaftPower);
    set('Pump - Efficiency / Power', `${withUnit(efficiency, '%', 6)} / ${withUnit(shaftPower, 'kW', 6)}`, efficiency);
    set('Pump - Dominant Loss', cleanText(npsh.dominantLoss || pumpResults.dominantSuctionLoss), null);

    const targetFlow = firstNumber(proposal.targetFlow, proposal.targetFlowM3H, pumpFlow);
    const requiredHead = firstNumber(proposal.requiredSystemHead, pumpResults.requiredSystemHead, pumpHead);
    const proposalNpsha = firstNumber(proposal.npshaAtDesign, npsha);
    const maxAllowableNpshr = firstNumber(proposal.maxAllowableNpshr, proposal.allowableNpshrAtDesign);
    const proposedNpshr = firstNumber(proposal.proposedNpshr, proposal.proposedProps?.designNpshr);
    const worst = proposal.worstCase || {};

    set('Optimize Pump From Network - Workflow Status', `${cleanText(proposal.status || 'Not ready')}; readiness ${cleanText(readiness.status || proposal.readinessStatus || '-')}`, null);
    set('Optimize Pump From Network - Readiness', cleanText(readiness.status || proposal.readinessStatus || proposal.status || '-'), null);
    set('Optimize Pump From Network - Target Flow', withUnit(targetFlow, 'm3/h', 6), targetFlow);
    set('Optimize Pump From Network - Target flow', withUnit(targetFlow, 'm3/h', 6), targetFlow);
    set('Optimize Pump From Network - Required System Head', withUnit(requiredHead, 'm', 6), requiredHead);
    set('Optimize Pump From Network - Required system head', withUnit(requiredHead, 'm', 6), requiredHead);
    set('Optimize Pump From Network - NPSHa at Design', withUnit(proposalNpsha, 'm', 6), proposalNpsha);
    set('Optimize Pump From Network - NPSHa at design', withUnit(proposalNpsha, 'm', 6), proposalNpsha);
    set('Optimize Pump From Network - Max Allowable NPSHr', withUnit(maxAllowableNpshr, 'm', 6), maxAllowableNpshr);
    set('Optimize Pump From Network - Max allowable NPSHr', withUnit(maxAllowableNpshr, 'm', 6), maxAllowableNpshr);
    set('Optimize Pump From Network - Proposed NPSHr', withUnit(proposedNpshr, 'm', 6), proposedNpshr);
    set('Optimize Pump From Network - Worst AOR Flow', withUnit(worst.flow, 'm3/h', 6), firstNumber(worst.flow));
    set('Optimize Pump From Network - Worst AOR flow', withUnit(worst.flow, 'm3/h', 6), firstNumber(worst.flow));
    set('Optimize Pump From Network - Worst AOR Point', `${withUnit(worst.flow, 'm3/h', 3)}, ${withUnit(worst.percentBep, '% BEP', 1)}, NPSHa ${withUnit(worst.npsha, 'm', 3)}`, firstNumber(worst.flow));

    const sinkPressure = firstNumber(sinkProps.pressure, sinkResults.requiredBoundaryPressure, sinkResults.boundaryPressure, sinkResults.calculatedPressure, sinkResults.staticPressure);
    const sinkPressureInput = firstNumber(sinkProps.pressure, sinkResults.boundaryPressureInput);
    const sinkFlow = firstNumber(sinkResults.flow, sinkProps.demandFlow, pumpFlow);
    const sinkMassFlow = firstNumber(sinkResults.massFlow, massFlowKgH(sinkFlow, density));
    const sinkElevation = firstNumber(sinkProps.elevation);
    const sinkHydraulicHead = firstNumber(sinkResults.hydraulicHead, pressureHeadM(sinkPressure, density) !== null && sinkElevation !== null ? pressureHeadM(sinkPressure, density) + sinkElevation : null);
    const outletPressureHead = pressureHeadM(sinkPressure, density);
    const terminalVelocityHead = firstNumber(dischargePipe.object?.results?.velocityHead, sinkResults.terminalVelocityHead);
    const vaporMarginM = vaporMarginHeadM(sinkPressure, vaporPressure, density);
    const vaporMarginBar = firstNumber(sinkPressure !== null && vaporPressure !== null ? sinkPressure - vaporPressure : null);

    set('SNK - Flow Demand', withUnit(sinkFlow, 'm3/h', 6), sinkFlow);
    set('SNK - Flow demand', withUnit(sinkFlow, 'm3/h', 6), sinkFlow);
    set('SNK - Flow Demand / Elevation', `${withUnit(sinkFlow, 'm3/h', 6)} / ${withUnit(sinkElevation, 'm', 6)}`, sinkFlow);
    set('SNK - Pressure Basis', cleanText(sinkProps.pressureBasis || sinkResults.pressureBasis || 'Static'), null);
    set('SNK - Reference Pressure', withUnit(sinkPressure, 'bar a', 11), sinkPressure);
    set('SNK - Reference pressure', withUnit(sinkPressure, 'bar a', 11), sinkPressure);
    set('SNK - SNK Elevation', withUnit(sinkElevation, 'm', 6), sinkElevation);
    set('SNK - Elevation', withUnit(sinkElevation, 'm', 6), sinkElevation);

    set('Outlet Readout - Boundary Mode', cleanText(sinkResults.boundaryMode || sinkProps.boundaryMode || 'Flow Demand Boundary'), null);
    set('Outlet Readout - Boundary Pressure Input', withUnit(sinkPressureInput, 'bar a', 9), sinkPressureInput);
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
      const liveEntry = metrics.get(normalizeMetric(metricCell.textContent));
      if (!liveEntry) return;
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
      const liveEntry = metrics.get(normalizeMetric(metricCell.textContent));
      if (liveEntry && setCellText(valueCell, liveEntry.valueText)) changed += 1;
    });
    return changed;
  };

  const refresh = () => {
    installResponsiveCss();
    const metrics = collectLiveMetrics();
    if (!metrics.size) return 0;
    let changed = 0;
    const candidates = Array.from(document.querySelectorAll(ACTIVE_SELECTOR))
      .filter((element) => element.classList?.contains?.('journal-analysis-task-window')
        || /analysis report|journal|comparison|application|laporan analisis|jurnal|perbandingan|aplikasi/i.test(element.textContent || ''));
    const roots = candidates.length ? candidates : [document.body];
    roots.forEach((rootNode) => {
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
  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = root.setTimeout(() => {
      scheduled = 0;
      refresh();
    }, 60);
  };

  const patchUpdateSimulation = () => {
    const current = root.updateSimulation;
    if (typeof current !== 'function' || current.__analysisReportLivePatched) return;
    const wrapped = function updateSimulationAnalysisReportLiveWrapper(...args) {
      const result = current.apply(this, args);
      scheduleRefresh();
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
    scheduleRefresh
  };

  try {
    if (root.MutationObserver) {
      new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.addedNodes?.length || mutation.type === 'characterData')) {
          scheduleRefresh();
        }
      }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }
  } catch (error) {
    console.warn('Analysis Report live runtime observer could not be installed.', error);
  }

  try {
    ['input', 'change', 'click', 'npsh:simulation-updated', 'npsh:backend-response', 'npsh:calculation-state-updated'].forEach((eventName) => {
      document.addEventListener(eventName, scheduleRefresh, true);
    });
  } catch (error) {
    console.warn('Analysis Report live runtime event hooks could not be installed.', error);
  }

  try {
    root.setInterval(() => {
      patchUpdateSimulation();
      refresh();
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
