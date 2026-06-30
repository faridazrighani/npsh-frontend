(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'engineering-realtime-calculation-defense.v12';
  const AUTO_SOLVE_DEBOUNCE_MS = 240;
  const AUTO_SOLVE_CHANGE_DEBOUNCE_MS = 90;
  const INPUT_LATENCY_SHIELD_MS = 1250;
  const USER_INTENT_WINDOW_MS = 8000;
  const RUN_COMMAND_SELECTOR = [
    '#btn-solve',
    '#menu-run-solve',
    '#menu-refresh-calculations',
    '[data-i18n-text="menu.runHydraulicNpshEvaluation"]',
    '[data-i18n-text="menu.refreshCalculationsConnections"]'
  ].join(',');
  const SAMPLE_CASE_OPEN_SELECTOR = '[data-simulation-case-action="open"][data-simulation-case-id]';
  const USER_CALCULATION_INTENT_SELECTOR = `${RUN_COMMAND_SELECTOR}, ${SAMPLE_CASE_OPEN_SELECTOR}`;
  const CALCULATION_FIELD_PATTERN = /\b(inputMode|optimizationMode|npshrSourceMode|npshAssessmentMode|npshMarginBasis|screeningDefaultsApplied|elevation|suctionElevation|dischargeElevation|designFlow|designHead|designEfficiency|designNpshr|manualNpshr|bepFlow|porMinPercent|porMaxPercent|aorMinPercent|aorMaxPercent|minNpshMarginRatio|minNpshMargin|speed|curveDataSource|curveSourceNote|curveData|flow|demandFlow|massFlow|flowInputMode|boundaryMode|boundaryDataSource|pressure|pressureInputBasis|pressureBasis|pressureEnergyBasis|sourceType|temperatureMode|temp|temperature|fluidName|density|viscosity|kinematicViscosity|dynViscosity|dynamicViscosity|vaporPressure|specificWeight|vaporPressureHead|segments|length|diameter|roughness|fittingType|fittingQuantity|fittingK|minorLoss|additionalK|active|liquidLevel|level)\b/i;
  const ROUTE_ONLY_PUMP_CALCULATION_FIELDS = Object.freeze([
    'suctionelevation',
    'pumpdatumelev',
    'pumpdatumelevation',
    'manualnpshr',
    'npshmarginbasis',
    'minnpshratio',
    'minnpshmarginratio',
    'minnpshmargin'
  ]);
  const LEGACY_PUMP_PERFORMANCE_FIELDS = Object.freeze([
    'inputmode',
    'optimizationmode',
    'npshrourcemode',
    'npshassessmentmode',
    'screeningdefaultsapplied',
    'dischargeelevation',
    'designflow',
    'designhead',
    'designefficiency',
    'designnpshr',
    'bepflow',
    'porminpercent',
    'pormaxpercent',
    'aorminpercent',
    'aormaxpercent',
    'speed',
    'curvedatasource',
    'curvesourcenote',
    'curvedata'
  ]);
  const CALCULATION_INPUT_SURFACE_SELECTOR = [
    '.task-window',
    '.full-editor-modal',
    '.canvas-task-window',
    '.persistent-object-properties-task-window',
    '#taskWindowBody',
    '[data-task-prop-body="true"]',
    '[data-task-node-id]',
    '[data-node-id][data-kind]'
  ].join(',');

  let autoSolveTimer = 0;
  let autoSolveSequence = 0;
  let pendingAutoSolve = null;
  let activeAutoSolve = null;
  let activeCalculationTransaction = null;
  let completedCalculationTransaction = null;
  let linkedViewRefreshFrame = 0;
  let linkedViewRefreshTimer = 0;
  let pendingLinkedViewRefresh = null;

  const AUTOSOLVE_POLICY = Object.freeze({
    mode: 'realtime-autosolve-first',
    manualCommandRole: 'validate-refresh-evidence',
    debounceMs: AUTO_SOLVE_DEBOUNCE_MS,
    changeDebounceMs: AUTO_SOLVE_CHANGE_DEBOUNCE_MS,
    legacyAutosolveRole: 'fallback-only'
  });

  function runtimeModel() {
    try {
      if (typeof globalModel !== 'undefined' && globalModel) return globalModel;
    } catch (error) {
      // Protected runtime can hide direct globals.
    }
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function resolveNodeId(target) {
    const direct = target?.dataset?.node || target?.dataset?.nodeId || target?.dataset?.pumpNodeId;
    if (direct) return direct;
    const holder = target?.closest?.('[data-node], [data-node-id], [data-pump-node-id], [data-task-node-id]');
    const fromHolder = holder?.dataset?.node || holder?.dataset?.nodeId || holder?.dataset?.pumpNodeId || holder?.dataset?.taskNodeId;
    if (fromHolder) return fromHolder;
    try {
      if (typeof currentSelectedNode !== 'undefined' && currentSelectedNode) return currentSelectedNode;
    } catch (error) {
      // Fall through to first pump.
    }
    const model = runtimeModel();
    return Object.keys(model || {}).find((id) => model[id]?.type === 'pump') || '';
  }

  function fieldTokens(target) {
    if (!target) return [];
    const dataset = target.dataset || {};
    return [
      target.name,
      target.id,
      target.getAttribute?.('aria-label'),
      target.getAttribute?.('placeholder'),
      dataset.key,
      dataset.field,
      dataset.prop,
      dataset.name,
      dataset.metric,
      dataset.readoutKey
    ].filter(Boolean).map((token) => String(token));
  }

  function normalizedFieldText(tokens = []) {
    return tokens.join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function nodeTypeForTarget(target, nodeId = resolveNodeId(target)) {
    const modelType = runtimeModel()?.[nodeId]?.type || '';
    if (modelType) return String(modelType);
    const holder = target?.closest?.('[data-kind], [data-node-type], [data-task-node-type]');
    return holder?.dataset?.kind || holder?.dataset?.nodeType || holder?.dataset?.taskNodeType || '';
  }

  function hasNormalizedField(normalizedText, fields = []) {
    return fields.some((field) => normalizedText.includes(field));
  }

  function sinkModeKindForTarget(nodeId) {
    const mode = String(runtimeModel()?.[nodeId]?.props?.boundaryMode || '').toLowerCase();
    if (/flow\s*demand/.test(mode)) return 'flow-demand';
    if (/free\s*outlet|atmospheric/.test(mode)) return 'free-outlet';
    if (/outlet\s*pressure|pressure\s*boundary|specified\s*pressure/.test(mode)) return 'outlet-pressure';
    return mode ? 'unknown' : 'free-outlet';
  }

  function sinkFieldKey(normalizedText) {
    if (normalizedText.includes('boundarymode')) return 'boundaryMode';
    if (normalizedText.includes('active')) return 'active';
    if (normalizedText.includes('elevation')) return 'elevation';
    if (normalizedText.includes('pressureinputbasis')) return 'pressureInputBasis';
    if (normalizedText.includes('pressurebasis')) return 'pressureBasis';
    if (normalizedText.includes('demandflow')) return 'demandFlow';
    if (normalizedText.includes('outletpressure') || normalizedText.includes('pressure')) return 'pressure';
    return '';
  }

  function sourceFlowModeKind(nodeId) {
    const mode = String(runtimeModel()?.[nodeId]?.props?.flowInputMode || '').toLowerCase();
    return /mass/.test(mode) ? 'mass-flow' : 'volumetric-flow';
  }

  function sourceFieldKey(normalizedText) {
    if (normalizedText.includes('flowinputmode')) return 'flowInputMode';
    if (normalizedText.includes('massflow')) return 'massFlow';
    if (normalizedText.includes('flow')) return 'flow';
    return '';
  }

  function isCalculationField(target) {
    const tokens = fieldTokens(target);
    if (!tokens.length) return false;
    const normalizedText = normalizedFieldText(tokens);
    const nodeId = resolveNodeId(target);
    const type = String(nodeTypeForTarget(target, nodeId) || '').toLowerCase();
    if (target.closest?.('#pumpCurveTable')) {
      return false;
    }
    if (type === 'pump') {
      if (hasNormalizedField(normalizedText, ROUTE_ONLY_PUMP_CALCULATION_FIELDS)) return true;
      if (hasNormalizedField(normalizedText, LEGACY_PUMP_PERFORMANCE_FIELDS)) return false;
      return false;
    }
    if (type === 'sink') {
      const fieldKey = sinkFieldKey(normalizedText);
      const modeKind = sinkModeKindForTarget(nodeId);
      if (['active', 'boundaryMode', 'elevation', 'pressureBasis'].includes(fieldKey)) return true;
      if (fieldKey === 'demandFlow') return modeKind === 'flow-demand';
      if (fieldKey === 'pressure' || fieldKey === 'pressureInputBasis') return modeKind === 'outlet-pressure';
      return CALCULATION_FIELD_PATTERN.test(tokens.join(' '));
    }
    if (type === 'source') {
      const fieldKey = sourceFieldKey(normalizedText);
      if (fieldKey === 'flowInputMode') return true;
      if (fieldKey === 'flow') return sourceFlowModeKind(nodeId) === 'volumetric-flow';
      if (fieldKey === 'massFlow') return sourceFlowModeKind(nodeId) === 'mass-flow';
    }
    return CALCULATION_FIELD_PATTERN.test(tokens.join(' '));
  }

  function isCalculationInput(target) {
    if (!target || !target.matches?.('input, select, textarea')) return false;
    if (target.disabled || target.readOnly || target.type === 'file') return false;
    if (!isCalculationField(target)) return false;
    return !!target.closest?.(CALCULATION_INPUT_SURFACE_SELECTOR);
  }

  function markInputLatencyShield(target, nodeId = '', reason = 'realtime input edit') {
    const now = Date.now();
    const tokens = fieldTokens(target).join(' ');
    root.__engineeringInputLatencyShield = {
      version: VERSION,
      mode: 'realtime-input',
      nodeId: nodeId || resolveNodeId(target),
      field: tokens,
      activeUntil: now + INPUT_LATENCY_SHIELD_MS,
      reason,
      updatedAt: new Date(now).toISOString()
    };
    return root.__engineeringInputLatencyShield;
  }

  function getInputLatencyShield() {
    const shield = root.__engineeringInputLatencyShield;
    if (!shield || !Number.isFinite(Number(shield.activeUntil))) return null;
    if (Date.now() > Number(shield.activeUntil)) return null;
    return shield;
  }

  function isInputLatencyShieldActive(nodeId = '') {
    const shield = getInputLatencyShield();
    if (!shield) return false;
    const requested = String(nodeId || '').trim();
    if (!requested || !shield.nodeId) return true;
    return String(shield.nodeId) === requested;
  }

  function shouldBypassImmediateInputUpdate(options = {}, nodeId = '') {
    if (!isInputLatencyShieldActive(nodeId)) return false;
    if (options.__engineeringRealtimeAutoSolve) return false;
    if (options.forceBackend || options.forceProtectedBackend) return false;
    if (options.refreshReason === 'solve' || options.trigger === 'solve') return false;
    return currentCalculationMode() === 'realtime-input';
  }

  function isTrustedUserEdit(event) {
    return event?.isTrusted === true || root.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve === true;
  }

  function markUserCalculationIntent(source = 'user-calculation-intent', target = null) {
    const now = Date.now();
    const calculationMode = source === 'manual-command'
      ? 'manual-solve'
      : source === 'sample-case-open'
        ? 'sample-open'
        : 'realtime-input';
    root.__engineeringCalculationUserIntentAt = now;
    root.__engineeringCalculationUserIntent = {
      source,
      calculationMode,
      nodeId: target?.id || target?.dataset?.nodeId || target?.dataset?.pumpNodeId || '',
      caseId: target?.dataset?.simulationCaseId || '',
      updatedAt: new Date(now).toISOString()
    };
    return root.__engineeringCalculationUserIntent;
  }

  function currentCalculationMode() {
    return root.__engineeringCalculationUserIntent?.calculationMode
      || root.EngineeringCalculationLifecycle?.current?.()?.calculationMode
      || '';
  }

  function hasRecentUserCalculationIntent(windowMs = USER_INTENT_WINDOW_MS, allowedModes = ['sample-open', 'manual-solve', 'realtime-input']) {
    const lifecycle = root.EngineeringCalculationLifecycle;
    const mode = currentCalculationMode();
    if (allowedModes.length && !allowedModes.includes(mode)) return false;
    if (typeof lifecycle?.hasRecentCalculationActivity === 'function') {
      return lifecycle.hasRecentCalculationActivity(windowMs);
    }
    const intentAt = Number(root.__engineeringCalculationUserIntentAt || 0);
    return Number.isFinite(intentAt) && intentAt > 0 && Date.now() - intentAt <= windowMs;
  }

  function dispatchRealtimeEvent(name, detail = {}) {
    if (typeof document === 'undefined' || typeof root.CustomEvent !== 'function') return;
    try {
      document.dispatchEvent(new root.CustomEvent(name, { detail }));
    } catch (error) {
      // Event dispatch is diagnostic only.
    }
  }

  function debounceForSourceEvent(sourceEvent = 'input') {
    return String(sourceEvent || '').toLowerCase() === 'change'
      ? AUTO_SOLVE_CHANGE_DEBOUNCE_MS
      : AUTO_SOLVE_DEBOUNCE_MS;
  }

  function isAutoSolveSuperseded(sequence) {
    return sequence !== autoSolveSequence || root.__engineeringRealtimeCalculationDefenseAutoSolvePaused;
  }

  function markAutoSolveSuperseded(sequence, nodeId, reason) {
    const detail = {
      version: VERSION,
      nodeId,
      reason,
      calculationMode: 'realtime-input',
      sequence,
      latestSequence: autoSolveSequence,
      status: 'Superseded',
      updatedAt: new Date().toISOString()
    };
    root.__engineeringCalculationDefenseRealtimeAutoSolveSuperseded = detail;
    updateCalculationTransaction(sequence, {
      status: 'superseded',
      finalState: 'Superseded',
      finalMessage: 'Newer input superseded this realtime backend result.',
      supersededAt: detail.updatedAt,
      completedAt: detail.updatedAt
    });
    dispatchRealtimeEvent('npsh:realtime-autosolve-superseded', detail);
    return detail;
  }

  function dispatchLifecycleApplying(detail = {}) {
    dispatchRealtimeEvent('npsh:calculation-applying-results', {
      version: VERSION,
      ...detail
    });
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const match = String(value).replace(',', '.').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
    if (!match) return null;
    const number = Number(match[0]);
    return Number.isFinite(number) ? number : null;
  }

  function firstFinite(...values) {
    for (const value of values) {
      const number = finiteNumber(value);
      if (number !== null) return number;
    }
    return null;
  }

  function actualPumpHeadFromResults(results = {}, evaluation = {}) {
    if (evaluation.actualPumpHeadAvailable === false || results.actualPumpHeadAvailable === false) return null;
    if (evaluation.actualPumpHeadAvailable === true || results.actualPumpHeadAvailable === true) {
      return firstFinite(evaluation.actualPumpHead, results.actualPumpHead, evaluation.pumpHead, results.pumpHeadAtFlow, results.head);
    }
    return firstFinite(evaluation.actualPumpHead, results.actualPumpHead, evaluation.pumpHead, results.pumpHeadAtFlow, results.head);
  }

  function roundTraceNumber(value, digits = 6) {
    const number = finiteNumber(value);
    if (number === null) return null;
    return Number(number.toFixed(digits));
  }

  function objectEntries(model = runtimeModel()) {
    return Object.entries(model || {}).filter(([, node]) => node && typeof node === 'object');
  }

  function runtimeConnections(model = runtimeModel()) {
    try {
      if (typeof connections !== 'undefined' && Array.isArray(connections)) return connections;
    } catch (error) {
      // Protected runtime can hide direct globals.
    }
    if (Array.isArray(root.__npshConnections)) return root.__npshConnections;
    if (Array.isArray(root.connections)) return root.connections;
    try {
      if (typeof root.getSimulationState === 'function') {
        const state = JSON.parse(root.getSimulationState());
        if (Array.isArray(state?.connections)) return state.connections;
      }
    } catch (error) {
      // Fall through to empty topology.
    }
    return [];
  }

  function normalizeDiameterM(value) {
    const number = finiteNumber(value);
    if (number === null || number <= 0) return null;
    return number > 5 ? number / 1000 : number;
  }

  function normalizeRoughnessM(value) {
    const number = finiteNumber(value);
    if (number === null || number < 0) return 45e-6;
    return number > 0.02 ? number / 1000 : number;
  }

  function fluidProps(model = runtimeModel()) {
    const fluid = model?.FLUID?.props || {};
    const density = firstFinite(fluid.density, 1000);
    const viscosityCSt = firstFinite(fluid.viscosity, fluid.kinematicViscosity, 1);
    return {
      density,
      viscosityCSt,
      vaporPressureBarA: firstFinite(fluid.vaporPressure, 0),
      fluidName: fluid.fluidName || fluid.name || ''
    };
  }

  const FITTING_K = {
    'Sharp-edged entrance': 0.5,
    'Reentrant entrance': 0.8,
    'Well-rounded entrance': 0.03,
    'Submerged exit': 1,
    '90 smooth bend - flanged': 0.3,
    '90 elbow - threaded': 0.9,
    '90 miter bend - no vanes': 1.1,
    '90 miter bend - with vanes': 0.2,
    '45 elbow - threaded': 0.4,
    '180 return bend - flanged': 0.2,
    'Tee - line flow flanged': 0.2,
    'Tee - branch flow flanged': 1,
    'Threaded union': 0.08,
    '90 elbow - long radius flanged': 0.2,
    '90 elbow - short radius flanged': 0.5,
    '45 elbow - flanged': 0.2,
    'Concentric reducer - gradual': 0.15,
    'Sudden contraction': 0.5,
    'Sudden expansion': 1,
    'Y-strainer - clean': 2,
    'Basket strainer - clean': 1.5,
    'Gate valve - fully open': 0.2,
    'Globe valve - fully open': 10,
    'Angle valve - fully open': 5,
    'Ball valve - fully open': 0.05,
    'Butterfly valve - fully open': 0.4,
    'Plug valve - fully open': 0.4,
    'Control valve - generic open': 10,
    'Swing check valve': 2
  };

  function frictionFactorTurbulent(reynolds, relativeRoughness) {
    let friction = 0.25 / Math.pow(Math.log10(Math.max(relativeRoughness, 0) / 3.7 + 5.74 / Math.pow(reynolds, 0.9)), 2);
    for (let index = 0; index < 20; index += 1) {
      const next = 1 / Math.pow(-2 * Math.log10(Math.max(relativeRoughness, 0) / 3.7 + 2.51 / (reynolds * Math.sqrt(friction))), 2);
      if (Math.abs(next - friction) < 1e-7) return next;
      friction = next;
    }
    return friction;
  }

  function darcyFrictionFactor(reynolds, relativeRoughness) {
    if (!Number.isFinite(reynolds) || reynolds <= 0) return null;
    const laminar = 64 / reynolds;
    if (reynolds <= 2300) return laminar;
    const turbulent = frictionFactorTurbulent(Math.max(reynolds, 4000), relativeRoughness);
    if (reynolds >= 4000) return turbulent;
    return laminar + ((reynolds - 2300) / 1700) * (turbulent - laminar);
  }

  function flowRegime(reynolds) {
    if (!Number.isFinite(reynolds) || reynolds <= 0) return 'Not calculated';
    if (reynolds <= 2300) return 'Laminar';
    if (reynolds < 4000) return 'Transitional';
    return 'Turbulent';
  }

  function segmentK(segment = {}) {
    const fittingType = String(segment.fittingType || 'None');
    const kEach = fittingType === 'Custom K'
      ? firstFinite(segment.fittingK, segment.kEach, 0)
      : firstFinite(segment.fittingK, FITTING_K[fittingType], 0);
    const defaultQuantity = fittingType && fittingType !== 'None' ? 1 : 0;
    const quantity = Math.max(0, firstFinite(segment.fittingQuantity, segment.quantity, defaultQuantity) || 0);
    const fittingTotalK = Math.max(0, (kEach || 0) * quantity);
    const additionalK = Math.max(0, firstFinite(segment.additionalK, segment.minorLoss, segment.minorLossK, 0) || 0);
    return {
      kEach,
      quantity,
      fittingTotalK,
      additionalK,
      totalK: fittingTotalK + additionalK
    };
  }

  function pipeFlowM3H(pipeNode = {}, model = runtimeModel()) {
    const results = pipeNode.results || {};
    const trace = results.calculationTrace || {};
    const fromPipe = firstFinite(results.flow, trace.basis?.flowM3H, pipeNode.props?.flow, pipeNode.props?.designFlow);
    if (fromPipe !== null) return fromPipe;
    const pump = objectEntries(model).find(([, node]) => node.type === 'pump')?.[1] || {};
    return firstFinite(
      pump.results?.flow,
      pump.results?.npshEvaluation?.flow,
      pump.results?.fixedFlow,
      pump.props?.designFlow,
      0
    ) || 0;
  }

  function existingTraceRows(trace = {}) {
    const segments = Array.isArray(trace.segments) ? trace.segments : [];
    const breakdown = Array.isArray(trace.fittingValveBreakdown) ? trace.fittingValveBreakdown : [];
    return { segments, breakdown };
  }

  function buildPipeSegmentRows(pipeId = '', pipeNode = {}, model = runtimeModel()) {
    const props = pipeNode?.props || {};
    const results = pipeNode?.results || {};
    const trace = results.calculationTrace || {};
    const { segments: existingSegments, breakdown } = existingTraceRows(trace);
    const configuredSegments = Array.isArray(props.segments) ? props.segments : [];
    if (!configuredSegments.length && existingSegments.length) {
      return existingSegments.map((segment, index) => ({ index, ...segment }));
    }

    const flowM3H = pipeFlowM3H(pipeNode, model);
    const flowM3S = flowM3H / 3600;
    const fluid = fluidProps(model);
    const kinematicViscosityM2S = Math.max((firstFinite(trace.basis?.viscosityCSt, fluid.viscosityCSt, 1) || 1) * 1e-6, 1e-12);
    const roughnessAgingFactor = 1;
    const allowanceFraction = 0;

    return configuredSegments.map((segment, index) => {
      const existing = existingSegments[index] || {};
      const existingBreakdown = breakdown[index] || {};
      const diameter = normalizeDiameterM(firstFinite(segment.diameter, existing.diameter));
      const length = Math.max(0, firstFinite(segment.length, existing.length, 0) || 0);
      const area = diameter ? Math.PI * diameter * diameter / 4 : null;
      const velocity = area && flowM3S > 0 ? flowM3S / area : null;
      const roughness = normalizeRoughnessM(firstFinite(segment.roughness, existing.roughness, props.roughness));
      const effectiveRoughness = roughness * roughnessAgingFactor;
      const reynolds = velocity && diameter ? velocity * diameter / kinematicViscosityM2S : null;
      const relativeRoughness = diameter ? effectiveRoughness / diameter : null;
      const frictionFactor = reynolds ? darcyFrictionFactor(reynolds, relativeRoughness || 0) : null;
      const velocityHead = velocity ? velocity * velocity / (2 * 9.81) : null;
      const k = segmentK(segment);
      const computedMajorLoss = frictionFactor && diameter && velocityHead ? frictionFactor * (length / diameter) * velocityHead : 0;
      const fittingLoss = velocityHead ? k.fittingTotalK * velocityHead : 0;
      const additionalLoss = velocityHead ? k.additionalK * velocityHead : 0;
      const computedMinorLoss = fittingLoss + additionalLoss;
      const baseTotalLoss = computedMajorLoss + computedMinorLoss;
      const allowanceLoss = baseTotalLoss * allowanceFraction;
      const computedTotalLoss = baseTotalLoss + allowanceLoss;

      return {
        ...existing,
        index,
        pipeId,
        name: segment.name || existing.name || existingBreakdown.name || `Segment ${index + 1}`,
        componentType: existingBreakdown.componentType || existing.componentType || '',
        fittingType: segment.fittingType || existing.fittingType || 'None',
        fittingQuantity: roundTraceNumber(k.quantity, 4),
        kEach: roundTraceNumber(k.kEach, 6),
        fittingTotalK: roundTraceNumber(k.fittingTotalK, 6),
        additionalK: roundTraceNumber(k.additionalK, 6),
        totalK: roundTraceNumber(firstFinite(existingBreakdown.totalK, existing.totalK, k.totalK), 6),
        minorLossK: roundTraceNumber(firstFinite(existingBreakdown.totalK, existing.minorLossK, k.totalK), 6),
        length: roundTraceNumber(length, 6),
        diameter: roundTraceNumber(diameter, 6),
        roughness: roundTraceNumber(roughness, 10),
        effectiveRoughness: roundTraceNumber(effectiveRoughness, 10),
        velocity: roundTraceNumber(velocity, 6),
        reynolds: roundTraceNumber(reynolds, 3),
        flowRegime: existing.flowRegime || flowRegime(reynolds),
        frictionFactor: roundTraceNumber(frictionFactor, 9),
        majorLoss: roundTraceNumber(firstFinite(existingBreakdown.majorLoss, existing.majorLoss, computedMajorLoss), 6),
        fittingLoss: roundTraceNumber(firstFinite(existing.fittingLoss, fittingLoss), 6),
        additionalLoss: roundTraceNumber(firstFinite(existing.additionalLoss, additionalLoss), 6),
        minorLoss: roundTraceNumber(firstFinite(existingBreakdown.minorLoss, existing.minorLoss, computedMinorLoss), 6),
        allowanceLoss: roundTraceNumber(firstFinite(existing.allowanceLoss, allowanceLoss), 6),
        totalLoss: roundTraceNumber(firstFinite(existingBreakdown.totalLoss, existing.totalLoss, computedTotalLoss), 6),
        profile: existing.profile || {},
        steps: Array.isArray(existing.steps) ? existing.steps : [],
        pressureSteps: Array.isArray(existing.pressureSteps) ? existing.pressureSteps : []
      };
    }).filter((segment) => segment.diameter !== null || segment.totalLoss !== null || segment.totalK !== null);
  }

  function enrichPipeCalculationTrace(pipeId = '', pipeNode = {}, model = runtimeModel()) {
    if (!pipeNode || typeof pipeNode !== 'object' || pipeNode.type !== 'pipe') return null;
    if (!pipeNode.results || typeof pipeNode.results !== 'object') pipeNode.results = {};
    if (!pipeNode.results.calculationTrace || typeof pipeNode.results.calculationTrace !== 'object') {
      pipeNode.results.calculationTrace = {};
    }
    const trace = pipeNode.results.calculationTrace;
    const rows = buildPipeSegmentRows(pipeId, pipeNode, model);
    if (!rows.length) return trace;
    const flowM3H = pipeFlowM3H(pipeNode, model);
    const fluid = fluidProps(model);
    const totals = rows.reduce((sum, segment) => {
      sum.majorLoss += firstFinite(segment.majorLoss, 0) || 0;
      sum.minorLoss += firstFinite(segment.minorLoss, 0) || 0;
      sum.allowanceLoss += firstFinite(segment.allowanceLoss, 0) || 0;
      sum.totalLoss += firstFinite(segment.totalLoss, 0) || 0;
      sum.totalK += firstFinite(segment.totalK, segment.minorLossK, 0) || 0;
      return sum;
    }, { majorLoss: 0, minorLoss: 0, allowanceLoss: 0, totalLoss: 0, totalK: 0 });
    trace.segmentRows = rows;
    trace.segments = rows;
    trace.basis = {
      ...(trace.basis || {}),
      flowM3H: roundTraceNumber(firstFinite(trace.basis?.flowM3H, flowM3H), 6),
      flowM3S: roundTraceNumber(firstFinite(trace.basis?.flowM3S, flowM3H / 3600), 8),
      density: roundTraceNumber(firstFinite(trace.basis?.density, fluid.density), 4),
      viscosityCSt: roundTraceNumber(firstFinite(trace.basis?.viscosityCSt, fluid.viscosityCSt), 6),
      vaporPressureBarA: roundTraceNumber(firstFinite(trace.basis?.vaporPressureBarA, fluid.vaporPressureBarA), 6)
    };
    trace.totals = {
      ...(trace.totals || {}),
      majorLoss: roundTraceNumber(totals.majorLoss, 6),
      minorLoss: roundTraceNumber(totals.minorLoss, 6),
      allowanceLoss: roundTraceNumber(totals.allowanceLoss, 6),
      totalLoss: roundTraceNumber(totals.totalLoss, 6),
      totalK: roundTraceNumber(totals.totalK, 6)
    };
    return trace;
  }

  function buildCanonicalCalculationState(model = runtimeModel()) {
    const pipes = {};
    objectEntries(model)
      .filter(([, node]) => node.type === 'pipe')
      .forEach(([id, node]) => {
        const trace = enrichPipeCalculationTrace(id, node, model);
        pipes[id] = {
          id,
          flowM3H: pipeFlowM3H(node, model),
          basis: { ...(trace?.basis || {}) },
          totals: { ...(trace?.totals || {}) },
          segments: Array.isArray(trace?.segmentRows) ? trace.segmentRows.map((segment) => ({ ...segment })) : []
        };
      });
    const pumps = {};
    objectEntries(model)
      .filter(([, node]) => node.type === 'pump')
      .forEach(([id, node]) => {
        const results = node.results || {};
        const evaluation = results.npshEvaluation || {};
        const actualPumpHead = actualPumpHeadFromResults(results, evaluation);
        const requiredSystemHead = firstFinite(evaluation.requiredSystemHead, results.requiredSystemHead, results.systemHead?.requiredHead);
        pumps[id] = {
          id,
          flow: firstFinite(evaluation.flow, results.flow, results.fixedFlow),
          npsha: firstFinite(evaluation.npsha, results.npsha),
          npshr: firstFinite(evaluation.npshr, results.npshr),
          npshMargin: firstFinite(evaluation.npshMargin, results.npshMargin),
          npshRatio: firstFinite(evaluation.npshRatio, results.npshRatio),
          pumpHead: actualPumpHead,
          actualPumpHead,
          actualPumpHeadAvailable: actualPumpHead !== null
            && evaluation.actualPumpHeadAvailable !== false
            && results.actualPumpHeadAvailable !== false,
          requiredSystemHead,
          backendValidationStatus: results.backendValidationStatus || evaluation.backendValidationStatus || '',
          calculationFreshness: results.calculationFreshness || evaluation.calculationFreshness || ''
        };
      });
    return {
      version: VERSION,
      source: 'engineering-realtime-calculation-defense',
      generatedAt: new Date().toISOString(),
      fluid: fluidProps(model),
      pipes,
      pumps,
      connections: runtimeConnections(model).map((connection) => ({ ...connection }))
    };
  }

  function publishCanonicalCalculationState(reason = 'calculation-state-refresh', nodeId = '', model = runtimeModel()) {
    const state = buildCanonicalCalculationState(model);
    state.reason = reason;
    state.nodeId = nodeId;
    root.__npshCanonicalCalculationState = state;
    dispatchRealtimeEvent('npsh:calculation-state-updated', state);
    return state;
  }

  function publishCalculationStatusState(reason = 'calculation-status-refresh', nodeId = '', status = 'Stale') {
    const previous = root.__npshCanonicalCalculationState || {};
    const state = {
      ...previous,
      version: VERSION,
      source: 'engineering-realtime-calculation-defense',
      generatedAt: new Date().toISOString(),
      reason,
      nodeId,
      statusOnly: true,
      calculationFreshness: status,
      pipes: previous.pipes || {},
      pumps: previous.pumps || {}
    };
    root.__npshCanonicalCalculationState = state;
    dispatchRealtimeEvent('npsh:calculation-state-updated', state);
    return state;
  }

  function markResultObjectStale(results, reason) {
    if (!results || typeof results !== 'object') return false;
    results.calculationFreshness = 'Stale';
    results.backendValidationStatus = 'Stale';
    results.backendValidationMessage = reason;
    if (results.performanceChartData?.schemaVersion === 'pump-performance-chart-data.v1') {
      results.performanceChartData.freshness = 'Stale';
      results.performanceChartData.warnings = [
        reason,
        ...((Array.isArray(results.performanceChartData.warnings) ? results.performanceChartData.warnings : []))
      ].filter(Boolean);
    }
    if (results.routeTrace && typeof results.routeTrace === 'object') {
      results.routeTrace.lossFreshness = 'Stale - input changed before backend refresh';
    }
    if (results.actionReadinessBackend && typeof results.actionReadinessBackend === 'object') {
      results.actionReadinessBackend.stale = true;
      results.actionReadinessBackend.status = 'Stale';
      results.actionReadinessBackend.message = reason;
    }
    if (results.backendActionReadiness && typeof results.backendActionReadiness === 'object') {
      results.backendActionReadiness.stale = true;
      results.backendActionReadiness.status = 'Stale';
      results.backendActionReadiness.message = reason;
    }
    if (results.npshEvaluation && typeof results.npshEvaluation === 'object') {
      results.npshEvaluation.calculationFreshness = 'Stale';
      results.npshEvaluation.backendValidationStatus = 'Stale';
    }
    return true;
  }

  function markResultObjectCalculating(results, reason) {
    if (!results || typeof results !== 'object') return false;
    results.calculationFreshness = 'Calculating';
    results.backendValidationStatus = 'Calculating';
    results.backendValidationMessage = reason;
    if (results.performanceChartData?.schemaVersion === 'pump-performance-chart-data.v1') {
      results.performanceChartData.freshness = 'Calculating';
    }
    if (results.routeTrace && typeof results.routeTrace === 'object') {
      results.routeTrace.lossFreshness = 'Calculating - backend refresh in progress';
    }
    if (results.actionReadinessBackend && typeof results.actionReadinessBackend === 'object') {
      results.actionReadinessBackend.stale = true;
      results.actionReadinessBackend.status = 'Calculating';
      results.actionReadinessBackend.message = reason;
    }
    if (results.backendActionReadiness && typeof results.backendActionReadiness === 'object') {
      results.backendActionReadiness.stale = true;
      results.backendActionReadiness.status = 'Calculating';
      results.backendActionReadiness.message = reason;
    }
    if (results.npshEvaluation && typeof results.npshEvaluation === 'object') {
      results.npshEvaluation.calculationFreshness = 'Calculating';
      results.npshEvaluation.backendValidationStatus = 'Calculating';
    }
    return true;
  }

  function markResultObjectFailed(results, reason) {
    if (!results || typeof results !== 'object') return false;
    results.calculationFreshness = 'Failed';
    results.backendValidationStatus = 'Failed';
    results.backendValidationMessage = reason;
    if (results.performanceChartData?.schemaVersion === 'pump-performance-chart-data.v1') {
      results.performanceChartData.freshness = 'Failed';
      results.performanceChartData.warnings = [
        reason,
        ...((Array.isArray(results.performanceChartData.warnings) ? results.performanceChartData.warnings : []))
      ].filter(Boolean);
    }
    if (results.routeTrace && typeof results.routeTrace === 'object') {
      results.routeTrace.lossFreshness = 'Failed - backend refresh did not complete';
    }
    if (results.actionReadinessBackend && typeof results.actionReadinessBackend === 'object') {
      results.actionReadinessBackend.stale = true;
      results.actionReadinessBackend.status = 'Failed';
      results.actionReadinessBackend.message = reason;
    }
    if (results.backendActionReadiness && typeof results.backendActionReadiness === 'object') {
      results.backendActionReadiness.stale = true;
      results.backendActionReadiness.status = 'Failed';
      results.backendActionReadiness.message = reason;
    }
    if (results.npshEvaluation && typeof results.npshEvaluation === 'object') {
      results.npshEvaluation.calculationFreshness = 'Failed';
      results.npshEvaluation.backendValidationStatus = 'Failed';
      results.npshEvaluation.backendValidationMessage = reason;
    }
    return true;
  }

  function calculationAffectedNodeIds(model, nodeId = '') {
    const ids = new Set();
    if (nodeId && model[nodeId]) ids.add(nodeId);
    const pumpIds = Object.keys(model || {}).filter((id) => model[id]?.type === 'pump');
    if (!nodeId || !model[nodeId]) {
      pumpIds.forEach((id) => ids.add(id));
      return [...ids];
    }
    if (model[nodeId]?.type === 'pump') return [...ids];
    pumpIds.forEach((id) => ids.add(id));
    return [...ids];
  }

  function cloneCalculationTransaction(transaction) {
    if (!transaction || typeof transaction !== 'object') return null;
    return {
      ...transaction,
      nodeIds: Array.isArray(transaction.nodeIds) ? [...transaction.nodeIds] : []
    };
  }

  function resultDependencyFingerprint(results = {}) {
    if (!results || typeof results !== 'object') return null;
    return results.dependencyManifest?.dependencyFingerprint
      || results.npshEvaluation?.dependencyManifest?.dependencyFingerprint
      || results.calculationAudit?.dependencyFingerprint
      || results.calculationDefenseContract?.dependencyFingerprint
      || results.actionReadinessBackend?.dependencyFingerprint
      || results.backendActionReadiness?.dependencyFingerprint
      || null;
  }

  function currentDependencyFingerprint(nodeId = '') {
    const model = runtimeModel();
    const ids = calculationAffectedNodeIds(model, nodeId);
    for (const id of ids) {
      const fingerprint = resultDependencyFingerprint(model[id]?.results);
      if (fingerprint) return fingerprint;
    }
    return root.__engineeringCalculationDefenseRealtimeState?.dependencyFingerprint || null;
  }

  function buildCalculationRequestId(sequence) {
    const serial = Number.isFinite(Number(sequence)) ? Number(sequence) : autoSolveSequence;
    return `rt-${Date.now().toString(36)}-${serial}`;
  }

  function publishCalculationTransaction(transaction) {
    const snapshot = cloneCalculationTransaction(transaction);
    root.__engineeringCalculationTransaction = snapshot;
    dispatchRealtimeEvent('npsh:calculation-transaction', snapshot || {});
    return snapshot;
  }

  function startCalculationTransaction(nodeId = '', reason = 'Input changed; backend recalculation scheduled.', options = {}) {
    const sequence = Number.isFinite(Number(options.sequence)) ? Number(options.sequence) : autoSolveSequence;
    const model = runtimeModel();
    const ids = calculationAffectedNodeIds(model, nodeId);
    const now = new Date().toISOString();
    activeCalculationTransaction = {
      version: VERSION,
      requestId: options.requestId || buildCalculationRequestId(sequence),
      sequence,
      nodeId,
      nodeIds: ids,
      reason,
      sourceEvent: options.sourceEvent || '',
      delayMs: Number.isFinite(Number(options.delayMs)) ? Number(options.delayMs) : null,
      status: options.status || 'waiting-debounce',
      initialDependencyFingerprint: currentDependencyFingerprint(nodeId),
      finalDependencyFingerprint: null,
      finalState: null,
      finalMessage: '',
      scheduledAt: now,
      startedAt: null,
      completedAt: null,
      updatedAt: now
    };
    return publishCalculationTransaction(activeCalculationTransaction);
  }

  function updateCalculationTransaction(sequence, updates = {}) {
    const normalizedSequence = Number.isFinite(Number(sequence)) ? Number(sequence) : null;
    const matches = (transaction) => transaction
      && (normalizedSequence === null || Number(transaction.sequence) === normalizedSequence);
    const target = matches(activeCalculationTransaction)
      ? activeCalculationTransaction
      : (matches(completedCalculationTransaction) ? completedCalculationTransaction : null);
    if (!target) return null;
    Object.assign(target, updates, { updatedAt: new Date().toISOString() });
    if (updates.status && ['current', 'failed', 'superseded'].includes(String(updates.status))) {
      target.finalState = updates.finalState || (updates.status === 'current' ? 'Current' : updates.status === 'failed' ? 'Failed' : 'Superseded');
      target.completedAt = updates.completedAt || target.updatedAt;
      completedCalculationTransaction = target;
      if (activeCalculationTransaction?.requestId === target.requestId) activeCalculationTransaction = null;
    }
    return publishCalculationTransaction(target);
  }

  function currentCalculationTransaction() {
    return cloneCalculationTransaction(activeCalculationTransaction || completedCalculationTransaction);
  }

  function scheduleUiRefresh(type, nodeId, run, delayMs = 220, reason = 'calculation refresh') {
    const governor = root.EngineeringPerformanceRefreshGovernor;
    if (governor && typeof governor.schedule === 'function') {
      return governor.schedule(type, nodeId || '', {
        delayMs,
        reason,
        run
      });
    }
    root.setTimeout(run, delayMs);
    return true;
  }

  function schedulePumpChartRefresh(nodeId = '', reason = 'calculation refresh') {
    const model = runtimeModel();
    const ids = calculationAffectedNodeIds(model, nodeId);
    const pumpId = ids.find((id) => model[id]?.type === 'pump') || nodeId || ids[0] || '';
    const governor = root.EngineeringPerformanceRefreshGovernor;
    if (typeof governor?.hasVisiblePumpChart === 'function' && !governor.hasVisiblePumpChart(pumpId)) {
      return false;
    }
    return scheduleUiRefresh('pump-performance-chart', pumpId, () => {
      try {
        if (typeof root.updatePumpChart === 'function') {
          root.updatePumpChart(pumpId, { forceImmediate: true, reason });
        }
      } catch (error) {
        // Chart refresh is best-effort; backend apply will redraw again.
      }
    }, 140, reason);
  }

  function markStale(nodeId = '', reason = 'Input changed; waiting for backend recalculation.') {
    const model = runtimeModel();
    const ids = calculationAffectedNodeIds(model, nodeId);
    let touched = 0;
    ids.forEach((id) => {
      const node = model[id];
      if (!node || typeof node !== 'object') return;
      if (!node.results || typeof node.results !== 'object') node.results = {};
      if (markResultObjectStale(node.results, reason)) touched += 1;
    });
    root.__engineeringCalculationDefenseRealtimeState = {
      version: VERSION,
      status: touched ? 'Stale' : 'No calculation result to mark',
      reason,
      calculationMode: currentCalculationMode() || 'realtime-input',
      nodeIds: ids,
      markedAt: new Date().toISOString()
    };
    publishCalculationStatusState('mark-stale', nodeId, 'Stale');
    dispatchRealtimeEvent('npsh:calculation-stale', root.__engineeringCalculationDefenseRealtimeState);
    return root.__engineeringCalculationDefenseRealtimeState;
  }

  function markCalculating(nodeId = '', reason = 'Backend recalculation in progress.', transaction = activeCalculationTransaction) {
    const model = runtimeModel();
    const ids = calculationAffectedNodeIds(model, nodeId);
    let touched = 0;
    ids.forEach((id) => {
      const node = model[id];
      if (!node || typeof node !== 'object') return;
      if (!node.results || typeof node.results !== 'object') node.results = {};
      if (markResultObjectCalculating(node.results, reason)) touched += 1;
    });
    root.__engineeringCalculationDefenseRealtimeState = {
      version: VERSION,
      status: touched ? 'Calculating' : 'No calculation result to refresh',
      reason,
      calculationMode: currentCalculationMode() || '',
      nodeIds: ids,
      requestId: transaction?.requestId || null,
      sequence: transaction?.sequence || null,
      transactionStatus: transaction?.status || 'calculating',
      startedAt: new Date().toISOString()
    };
    publishCalculationStatusState('mark-calculating', nodeId, 'Calculating');
    dispatchRealtimeEvent('npsh:calculation-calculating', root.__engineeringCalculationDefenseRealtimeState);
    return root.__engineeringCalculationDefenseRealtimeState;
  }

  function markFailed(nodeId = '', reason = 'Backend recalculation failed.', transaction = activeCalculationTransaction) {
    const model = runtimeModel();
    const ids = calculationAffectedNodeIds(model, nodeId);
    let touched = 0;
    ids.forEach((id) => {
      const node = model[id];
      if (!node || typeof node !== 'object') return;
      if (!node.results || typeof node.results !== 'object') node.results = {};
      if (markResultObjectFailed(node.results, reason)) touched += 1;
    });
    const updatedAt = new Date().toISOString();
    const finalTransaction = updateCalculationTransaction(transaction?.sequence, {
      status: 'failed',
      finalState: 'Failed',
      finalMessage: reason,
      completedAt: updatedAt
    }) || cloneCalculationTransaction(transaction);
    root.__engineeringCalculationDefenseRealtimeState = {
      version: VERSION,
      status: touched ? 'Failed' : 'Failed',
      reason,
      message: reason,
      calculationMode: currentCalculationMode() || '',
      nodeIds: ids,
      requestId: finalTransaction?.requestId || null,
      sequence: finalTransaction?.sequence || null,
      transactionStatus: finalTransaction?.status || 'failed',
      failedAt: updatedAt
    };
    publishCalculationStatusState('mark-failed', nodeId, 'Failed');
    dispatchRealtimeEvent('npsh:calculation-failed', root.__engineeringCalculationDefenseRealtimeState);
    return root.__engineeringCalculationDefenseRealtimeState;
  }

  function markCurrentFromBackend(payload = {}) {
    const activeApply = root.__engineeringRealtimeActiveBackendApply || {};
    const sequence = Number(payload.__engineeringRealtimeAutoSolveSequence || payload.sequence || activeApply.sequence || 0);
    const nodeId = payload.nodeId || activeApply.nodeId || '';
    if (sequence && isAutoSolveSuperseded(sequence)) {
      const superseded = markAutoSolveSuperseded(sequence, nodeId, payload.realtimeReason || 'superseded backend apply');
      return {
        ...(root.__engineeringCalculationDefenseRealtimeState || {}),
        superseded: true,
        supersededState: superseded
      };
    }
    const calculationId = payload.calculationId || payload.calculationAudit?.calculationId || null;
    const dependencyFingerprint = payload.dependencyManifest?.dependencyFingerprint || currentDependencyFingerprint(nodeId);
    const requestId = payload.__engineeringRealtimeRequestId || payload.requestId || activeApply.requestId || activeCalculationTransaction?.requestId || null;
    const transactionSequence = sequence || activeCalculationTransaction?.sequence || null;
    const transaction = transactionSequence ? updateCalculationTransaction(transactionSequence, {
      status: 'current',
      finalState: 'Current',
      finalDependencyFingerprint: dependencyFingerprint || null,
      calculationId,
      completedAt: new Date().toISOString()
    }) : null;
    root.__engineeringCalculationDefenseRealtimeState = {
      version: VERSION,
      status: 'Current',
      calculationId,
      dependencyFingerprint: dependencyFingerprint || null,
      calculationDefenseStatus: payload.calculationDefenseContract?.status || null,
      calculationMode: payload.calculationMode || activeApply.calculationMode || currentCalculationMode() || '',
      requestId: requestId || transaction?.requestId || null,
      sequence: sequence || transaction?.sequence || null,
      transactionStatus: 'current',
      updatedAt: new Date().toISOString()
    };
    publishCanonicalCalculationState('backend-current', nodeId);
    dispatchRealtimeEvent('npsh:calculation-current', root.__engineeringCalculationDefenseRealtimeState);
    return root.__engineeringCalculationDefenseRealtimeState;
  }

  function currentPayloadFromApplyArgs(args = []) {
    const activeApply = root.__engineeringRealtimeActiveBackendApply || {};
    const response = args[2] || {};
    const results = args[0]?.results || {};
    const evaluation = results.npshEvaluation || {};
    return {
      ...(args[1] || {}),
      ...(response || {}),
      calculationId: response.calculationId || results.calculationId || evaluation.calculationId || null,
      calculationAudit: response.calculationAudit || results.calculationAudit || evaluation.calculationAudit || null,
      dependencyManifest: response.dependencyManifest || results.dependencyManifest || evaluation.dependencyManifest || null,
      calculationDefenseContract: response.calculationDefenseContract || results.calculationDefenseContract || evaluation.calculationDefenseContract || null,
      nodeId: response.nodeId || activeApply.nodeId || '',
      sequence: response.__engineeringRealtimeAutoSolveSequence || response.sequence || activeApply.sequence || null,
      requestId: response.__engineeringRealtimeRequestId || response.requestId || activeApply.requestId || null
    };
  }

  function refreshLinkedViews(nodeId = '', reason = 'calculation refresh') {
    let refreshed = 0;
    publishCanonicalCalculationState(reason, nodeId);
    refreshed += schedulePumpChartRefresh(nodeId, reason) ? 1 : 0;
    try {
      refreshed += root.CanvasContextDock?.refresh?.() ? 1 : 0;
    } catch (error) {
      console.warn('Canvas context dock refresh failed after realtime solve.', error);
    }
    try {
      root.EngineeringAnalysisReportLiveRuntime?.scheduleRefresh?.();
    } catch (error) {
      console.warn('Analysis Report live refresh failed after realtime solve.', error);
    }
    try {
      const parameterRuntime = root.EngineeringParameterTaskRuntime;
      if (typeof parameterRuntime?.refreshOpenWindows === 'function') {
        refreshed += parameterRuntime.refreshOpenWindows(nodeId);
      } else if (typeof parameterRuntime?.windows === 'function' && typeof parameterRuntime?.openParameterTaskWindow === 'function') {
        parameterRuntime.windows().forEach((windowNode) => {
          const block = windowNode.dataset.parameterTaskBlock || String(windowNode.dataset.kind || '').replace(/^parameter-/, '') || 'status';
          parameterRuntime.openParameterTaskWindow(block, windowNode.dataset.pumpNodeId || nodeId);
          refreshed += 1;
        });
      }
    } catch (error) {
      console.warn('Parameter task window refresh failed after realtime solve.', error);
    }
    try {
      if (nodeId && typeof root.EngineeringPumpFormulaDefenseLiveAudit?.scheduleRefresh === 'function') {
        root.EngineeringPumpFormulaDefenseLiveAudit.scheduleRefresh(nodeId, { reason, delayMs: 180 });
        refreshed += 1;
      } else if (nodeId && typeof root.EngineeringPumpFormulaDefenseLiveAudit?.refresh === 'function') {
        scheduleUiRefresh('pump-formula-audit', nodeId, () => root.EngineeringPumpFormulaDefenseLiveAudit.refresh(nodeId), 180, reason);
        refreshed += 1;
      }
    } catch (error) {
      console.warn('Pump formula defense refresh failed after realtime solve.', error);
    }
    try {
      if (typeof root.refreshOpenRealtimeSecondaryTaskWindows === 'function') {
        root.refreshOpenRealtimeSecondaryTaskWindows({ nodeId, reason, delayMs: 220 });
      }
    } catch (error) {
      console.warn('Realtime secondary task window refresh failed after realtime solve.', error);
    }
    try {
      if (typeof root.EngineeringPerformanceRefreshGovernor?.scheduleEnhance === 'function') {
        root.EngineeringPerformanceRefreshGovernor.scheduleEnhance(document, { nodeId, reason, delayMs: 220 });
      } else {
        root.EngineeringFormulaDefenseUI?.enhanceDocument?.(document);
      }
    } catch (error) {
      // Enhancement is cosmetic; keep calculation flow alive.
    }
    dispatchRealtimeEvent('npsh:linked-views-refreshed', {
      version: VERSION,
      nodeId,
      reason,
      refreshed,
      refreshedAt: new Date().toISOString()
    });
    return refreshed;
  }

  function scheduleLinkedViewRefresh(nodeId = '', reason = 'calculation refresh') {
    pendingLinkedViewRefresh = { nodeId, reason };
    if (linkedViewRefreshFrame || linkedViewRefreshTimer) return true;
    const run = () => {
      linkedViewRefreshFrame = 0;
      linkedViewRefreshTimer = 0;
      const pending = pendingLinkedViewRefresh || { nodeId, reason };
      pendingLinkedViewRefresh = null;
      refreshLinkedViews(pending.nodeId, pending.reason);
    };
    const delayMs = 360;
    if (typeof root.requestAnimationFrame === 'function') {
      linkedViewRefreshFrame = root.requestAnimationFrame(() => {
        linkedViewRefreshFrame = 0;
        linkedViewRefreshTimer = root.setTimeout(run, delayMs);
      });
    } else {
      linkedViewRefreshFrame = root.setTimeout(run, delayMs);
    }
    return true;
  }

  function cancelAutoSolve(reason = 'cancelled') {
    if (autoSolveTimer) {
      root.clearTimeout(autoSolveTimer);
      autoSolveTimer = 0;
    }
    if (pendingAutoSolve) {
      pendingAutoSolve.cancelledAt = new Date().toISOString();
      pendingAutoSolve.cancelReason = reason;
      updateCalculationTransaction(pendingAutoSolve.sequence, {
        status: 'superseded',
        finalState: 'Superseded',
        finalMessage: reason,
        completedAt: pendingAutoSolve.cancelledAt
      });
    }
    pendingAutoSolve = null;
    return true;
  }

  function autoSolveOptions(nodeId, reason, transactionOrSequence) {
    const transaction = transactionOrSequence && typeof transactionOrSequence === 'object' ? transactionOrSequence : null;
    const sequence = transaction ? transaction.sequence : transactionOrSequence;
    return {
      refreshReason: 'solve',
      trigger: 'solve',
      forceBackend: true,
      renderSidebarAfter: true,
      realtimeReason: reason,
      realtimeTrigger: 'realtime-input',
      calculationMode: 'realtime-input',
      selectedNodeId: nodeId,
      __engineeringRealtimeAutoSolveSequence: sequence,
      __engineeringRealtimeRequestId: transaction?.requestId || '',
      __engineeringRealtimeAutoSolve: true
    };
  }

  function patchUpdateSimulation() {
    const current = root.updateSimulation;
    if (typeof current !== 'function' || current.__engineeringRealtimeCalculationDefenseUpdatePatched) return false;
    const wrapped = function realtimeDefenseUpdateSimulationWrapper(...args) {
      const options = args[0] && typeof args[0] === 'object' ? args[0] : {};
      const nodeId = options.selectedNodeId || options.nodeId || resolveNodeId(null);
      const reason = options.refreshReason || options.trigger || 'updateSimulation';
      if (shouldBypassImmediateInputUpdate(options, nodeId)) {
        root.__engineeringInputLatencyShieldBypass = {
          version: VERSION,
          nodeId,
          reason,
          bypassedAt: new Date().toISOString()
        };
        dispatchRealtimeEvent('npsh:input-lightweight-update', root.__engineeringInputLatencyShieldBypass);
        return Promise.resolve([]);
      }
      if (options.forceBackend && !options.__engineeringRealtimeAutoSolve) {
        cancelAutoSolve('manual backend solve started');
      }
      const result = current.apply(this, args);
      const after = () => refreshLinkedViews(nodeId, reason);
      const shouldRefreshAfterUpdate = !options.__engineeringRealtimeAutoSolve
        && !shouldBypassImmediateInputUpdate(options, nodeId)
        && hasRecentUserCalculationIntent(10000, ['manual-solve', 'sample-open']);
      if (result && typeof result.then === 'function') {
        result.then((value) => {
          dispatchLifecycleApplying({ nodeId, reason: options.refreshReason || options.trigger || 'updateSimulation' });
          if (shouldRefreshAfterUpdate) after();
          return value;
        }, (error) => {
          if (shouldRefreshAfterUpdate) after();
          return error;
        });
      } else {
        if (shouldRefreshAfterUpdate) root.setTimeout(after, 0);
      }
      return result;
    };
    wrapped.__engineeringRealtimeCalculationDefenseUpdatePatched = true;
    wrapped.__engineeringRealtimeCalculationDefenseOriginal = current;
    if (current.__analysisReportLivePatched) {
      wrapped.__analysisReportLivePatched = true;
      wrapped.__analysisReportLiveOriginal = current.__analysisReportLiveOriginal || current;
    }
    root.updateSimulation = wrapped;
    return true;
  }

  function runAutoSolve(sequence, nodeId, reason) {
    if (isAutoSolveSuperseded(sequence)) {
      return Promise.resolve(null);
    }
    autoSolveTimer = 0;
    pendingAutoSolve = null;
    patchUpdateSimulation();
    if (typeof root.updateSimulation !== 'function') {
      return Promise.resolve(null);
    }
    const resolvedNodeId = nodeId || resolveNodeId(null);
    const existingTransaction = activeCalculationTransaction?.sequence === sequence ? activeCalculationTransaction : null;
    const transaction = existingTransaction || startCalculationTransaction(resolvedNodeId, reason, {
      sequence,
      sourceEvent: 'autosolve-run',
      status: 'calculating'
    });
    updateCalculationTransaction(sequence, {
      status: 'calculating',
      startedAt: new Date().toISOString()
    });
    const activeApply = {
      version: VERSION,
      requestId: transaction.requestId,
      sequence,
      nodeId: resolvedNodeId,
      reason,
      calculationMode: 'realtime-input',
      startedAt: new Date().toISOString()
    };
    root.__engineeringRealtimeActiveBackendApply = activeApply;
    markCalculating(resolvedNodeId, 'Input changed; protected backend recalculation is running.', transaction);
    dispatchRealtimeEvent('npsh:realtime-autosolve-start', {
      version: VERSION,
      nodeId: resolvedNodeId,
      reason,
      calculationMode: 'realtime-input',
      sequence,
      requestId: transaction.requestId
    });
    activeAutoSolve = Promise.resolve()
      .then(() => root.updateSimulation(autoSolveOptions(resolvedNodeId, reason, transaction)))
      .then((result) => {
        if (isAutoSolveSuperseded(sequence)) {
          const superseded = markAutoSolveSuperseded(sequence, resolvedNodeId, reason);
          return { ok: false, superseded: true, result, supersededState: superseded };
        }
        if (
          root.__engineeringCalculationDefenseRealtimeState?.status !== 'Current'
          || root.__engineeringCalculationDefenseRealtimeState?.requestId !== transaction.requestId
        ) {
          markCurrentFromBackend({
            nodeId: resolvedNodeId,
            calculationMode: 'realtime-input',
            sequence,
            requestId: transaction.requestId
          });
        }
        scheduleLinkedViewRefresh(resolvedNodeId, 'realtime autosolve complete');
        dispatchRealtimeEvent('npsh:realtime-autosolve-complete', {
          version: VERSION,
          nodeId: resolvedNodeId,
          calculationMode: 'realtime-input',
          sequence,
          requestId: transaction.requestId
        });
        return result;
      })
      .catch((error) => {
        const message = String(error?.message || error || 'Unknown backend refresh error');
        markFailed(resolvedNodeId, `Realtime backend recalculation failed: ${message}`, transaction);
        console.warn('Realtime backend recalculation failed.', error);
        dispatchRealtimeEvent('npsh:realtime-autosolve-error', {
          version: VERSION,
          nodeId: resolvedNodeId,
          sequence,
          requestId: transaction.requestId,
          message
        });
        return { ok: false, error: message };
      })
      .finally(() => {
        if (root.__engineeringRealtimeActiveBackendApply?.requestId === activeApply.requestId) {
          root.__engineeringRealtimeActiveBackendApply = null;
        }
        if (sequence === autoSolveSequence) activeAutoSolve = null;
      });
    return activeAutoSolve;
  }

  function requestAutoSolve(nodeId = '', reason = 'Input changed; backend recalculation scheduled.', options = {}) {
    const delayMs = Number.isFinite(Number(options.delayMs)) ? Math.max(0, Number(options.delayMs)) : debounceForSourceEvent(options.sourceEvent);
    autoSolveSequence += 1;
    const sequence = autoSolveSequence;
    const resolvedNodeId = nodeId || resolveNodeId(null);
    cancelAutoSolve('superseded by newer input');
    const transaction = startCalculationTransaction(resolvedNodeId, reason, {
      sequence,
      delayMs,
      sourceEvent: options.sourceEvent || 'input',
      status: 'waiting-debounce'
    });
    pendingAutoSolve = {
      version: VERSION,
      sequence,
      requestId: transaction.requestId,
      nodeId: resolvedNodeId,
      reason,
      delayMs,
      sourceEvent: options.sourceEvent || 'input',
      calculationMode: 'realtime-input',
      policy: AUTOSOLVE_POLICY,
      initialDependencyFingerprint: transaction.initialDependencyFingerprint,
      scheduledAt: new Date().toISOString()
    };
    autoSolveTimer = root.setTimeout(() => {
      runAutoSolve(sequence, resolvedNodeId, reason);
    }, delayMs);
    root.__engineeringCalculationDefenseRealtimeAutoSolve = pendingAutoSolve;
    dispatchRealtimeEvent('npsh:realtime-autosolve-scheduled', pendingAutoSolve);
    return pendingAutoSolve;
  }

  function notifyDependencyChanged(detail = {}) {
    const options = detail && typeof detail === 'object' ? detail : { dependency: String(detail || '') };
    const dependency = String(options.dependency || options.field || 'calculation dependency').trim() || 'calculation dependency';
    const model = runtimeModel();
    const requestedNodeId = String(options.nodeId || '').trim();
    const resolvedNodeId = requestedNodeId
      || Object.keys(model || {}).find((id) => model[id]?.type === 'pump')
      || '';
    const markNodeId = Object.prototype.hasOwnProperty.call(options, 'markNodeId')
      ? String(options.markNodeId || '')
      : requestedNodeId;
    const reason = String(options.reason || `${dependency} changed; protected backend recalculation is required.`);
    const sourceEvent = options.sourceEvent || 'dependency-change';
    markUserCalculationIntent(options.intentSource || 'dependency-change', options.target || null);
    if (options.target) markInputLatencyShield(options.target, resolvedNodeId, reason);
    const state = options.initialStatus === 'stale'
      ? markStale(markNodeId, reason)
      : markCalculating(markNodeId, reason);
    dispatchRealtimeEvent('npsh:calculation-dependency-changed', {
      version: VERSION,
      dependency,
      nodeId: resolvedNodeId,
      markedNodeId: markNodeId,
      reason,
      sourceEvent,
      status: state.status,
      calculationMode: 'realtime-input',
      updatedAt: new Date().toISOString()
    });
    scheduleLinkedViewRefresh(resolvedNodeId, reason);
    const pending = options.autoSolve === false
      ? null
      : requestAutoSolve(resolvedNodeId, reason, {
        sourceEvent,
        delayMs: options.delayMs
      });
    return {
      version: VERSION,
      dependency,
      nodeId: resolvedNodeId,
      markedNodeId: markNodeId,
      state,
      pending,
      reason
    };
  }

  function flushAutoSolve() {
    if (autoSolveTimer && pendingAutoSolve) {
      const pending = pendingAutoSolve;
      root.clearTimeout(autoSolveTimer);
      autoSolveTimer = 0;
      return runAutoSolve(pending.sequence, pending.nodeId, pending.reason);
    }
    return activeAutoSolve || Promise.resolve(null);
  }

  function install() {
    if (root.__engineeringRealtimeCalculationDefenseInstalled) return false;
    root.__engineeringRealtimeCalculationDefenseInstalled = true;
    root.__engineeringRealtimeAutosolvePolicy = AUTOSOLVE_POLICY;

    if (typeof document !== 'undefined') {
      const onInput = (event) => {
        const target = event?.target;
        if (event?.isComposing) return;
        const fastLane = root.EngineeringPumpEditFastLane;
        if (target?.matches?.('input, select, textarea')
          && !target.disabled
          && !target.readOnly
          && target.type !== 'file'
          && typeof fastLane?.handleRealtimeInput === 'function') {
          const handled = fastLane.handleRealtimeInput(event, {
            markUserCalculationIntent,
            markInputLatencyShield,
            markStale,
            requestAutoSolve
          });
          if (handled?.handled) return;
        }
        if (!isCalculationInput(target)) return;
        const nodeId = resolveNodeId(target);
        const reason = 'Input changed; waiting for protected backend recalculation.';
        if (isTrustedUserEdit(event)) {
          markUserCalculationIntent('trusted-input', target);
          markInputLatencyShield(target, nodeId, reason);
        }
        markStale(nodeId, reason);
        if (isTrustedUserEdit(event)) {
          requestAutoSolve(nodeId, reason, { sourceEvent: event.type });
        }
      };
      const onCalculationIntentClick = (event) => {
        const target = event?.target?.closest?.(USER_CALCULATION_INTENT_SELECTOR);
        if (!target) return;
        markUserCalculationIntent(target.matches?.(SAMPLE_CASE_OPEN_SELECTOR) ? 'sample-case-open' : 'manual-command', target);
      };
      document.addEventListener('input', onInput, true);
      document.addEventListener('change', onInput, true);
      document.addEventListener('click', onCalculationIntentClick, true);
    }

    patchUpdateSimulation();
    try {
      const patchInterval = root.setInterval(patchUpdateSimulation, 1000);
      patchInterval?.unref?.();
    } catch (error) {
      // Non-browser validation environments may not expose timers.
    }

    const originalApplyBackend = root.applyBackendSimulationPrimaryResults;
    if (typeof originalApplyBackend === 'function' && !originalApplyBackend.__engineeringRealtimeCalculationDefensePatched) {
      root.applyBackendSimulationPrimaryResults = function realtimeDefenseApplyBackendWrapper(...args) {
        const result = originalApplyBackend.apply(this, args);
        markCurrentFromBackend(currentPayloadFromApplyArgs(args));
        return result;
      };
      root.applyBackendSimulationPrimaryResults.__engineeringRealtimeCalculationDefensePatched = true;
    }
    const originalRunBackend = root.runBackendSimulationShadow;
    if (typeof originalRunBackend === 'function' && !originalRunBackend.__engineeringRealtimeCalculationDefenseCalculatingPatched) {
      root.runBackendSimulationShadow = function realtimeDefenseRunBackendWrapper(nodeId = '', options = {}, ...rest) {
        if (options?.__engineeringRealtimeAutoSolve || hasRecentUserCalculationIntent()) {
          markCalculating(nodeId, options?.realtimeReason || 'Backend recalculation in progress.');
        }
        return originalRunBackend.call(this, nodeId, options, ...rest);
      };
      root.runBackendSimulationShadow.__engineeringRealtimeCalculationDefenseCalculatingPatched = true;
      root.runBackendSimulationShadow.__engineeringRealtimeCalculationDefenseOriginal = originalRunBackend;
    }
    return true;
  }

  const api = {
    version: VERSION,
    autosolvePolicy: AUTOSOLVE_POLICY,
    debounceForSourceEvent,
    install,
    markStale,
    markCalculating,
    markFailed,
    markCurrentFromBackend,
    currentCalculationTransaction,
    requestAutoSolve,
    notifyDependencyChanged,
    flushAutoSolve,
    cancelAutoSolve,
    isCalculationField,
    isCalculationInput,
    refreshLinkedViews,
    scheduleLinkedViewRefresh,
    patchUpdateSimulation,
    markInputLatencyShield,
    getInputLatencyShield,
    isInputLatencyShieldActive,
    buildPipeSegmentRows,
    enrichPipeCalculationTrace,
    buildCanonicalCalculationState,
    publishCanonicalCalculationState
  };

  root.EngineeringRealtimeCalculationDefense = api;
  root.EngineeringInputLatencyShield = {
    version: VERSION,
    current: getInputLatencyShield,
    isActive: isInputLatencyShieldActive,
    markEdit: markInputLatencyShield
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
