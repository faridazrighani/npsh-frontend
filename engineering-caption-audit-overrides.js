(function registerEngineeringCaptionAuditOverrides(root) {
  'use strict';

  const VERSION = '2026.05-caption-audit-10';
  const BACKEND_OLD_WARNING = 'Backend API did not return a usable protected calculation result. Check API deployment and CORS settings.';
  const BACKEND_UNVERIFIED_WARNING = 'Backend validation unavailable; displayed hydraulic results are unverified by the protected backend.';
  const pumpActionOriginals = {};
  const PUMP_OPTIMIZATION_INPUT_SNAPSHOT_KEYS = [
    'inputMode',
    'optimizationMode',
    'npshrSourceMode',
    'npshAssessmentMode',
    'npshMarginBasis',
    'screeningDefaultsApplied',
    'elevation',
    'suctionElevation',
    'dischargeElevation',
    'designFlow',
    'designHead',
    'designEfficiency',
    'designNpshr',
    'bepFlow',
    'porMinPercent',
    'porMaxPercent',
    'aorMinPercent',
    'aorMaxPercent',
    'minNpshMarginRatio',
    'minNpshMargin'
  ];

  function toNumber(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function round(value, digits = 3) {
    const number = toNumber(value);
    if (number === null) return null;
    return Number(number.toFixed(digits));
  }

  function formatNumber(value, digits = 3) {
    const number = round(value, digits);
    return number === null ? '-' : String(number);
  }

  function positiveNumber(value, fallback = 0) {
    const number = toNumber(value);
    return number !== null && number > 0 ? number : fallback;
  }

  function pipeDisplaySafeNumber(value, fallback = 0) {
    const number = toNumber(value);
    return number === null ? fallback : number;
  }

  function normalizePipeDiameter(value) {
    const number = positiveNumber(value, 0);
    return number > 5 ? number / 1000 : number;
  }

  function normalizePipeRoughness(value) {
    const number = positiveNumber(value, 0.000045);
    return number > 0.02 ? number / 1000 : number;
  }

  function parseFluidMetricFromDom(labelPattern, fallback) {
    if (typeof document === 'undefined') return fallback;
    const lines = String(document.body?.innerText || '')
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);
    for (let index = 0; index < lines.length; index += 1) {
      if (!labelPattern.test(lines[index])) continue;
      for (let offset = 1; offset <= 3 && index + offset < lines.length; offset += 1) {
        const candidate = lines[index + offset];
        const match = candidate.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
        if (match) return pipeDisplaySafeNumber(match[0], fallback);
      }
    }
    const blocks = Array.from(document.querySelectorAll('.fluid-help-metric, .fluid-trace-metric, .prop-value, strong'));
    for (const block of blocks) {
      const text = String(block.parentElement?.textContent || block.textContent || '');
      if (!labelPattern.test(text)) continue;
      const match = text.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
      if (match) return pipeDisplaySafeNumber(match[0], fallback);
    }
    return fallback;
  }

  function getPipeFallbackFluidProps(fluidPropsOverride = null) {
    if (fluidPropsOverride && typeof fluidPropsOverride === 'object') {
      return {
        density: positiveNumber(fluidPropsOverride.density, 1000),
        viscosityCSt: positiveNumber(fluidPropsOverride.viscosity, 1),
        vaporPressureBarA: pipeDisplaySafeNumber(fluidPropsOverride.vaporPressure, 0)
      };
    }
    const modelFluid = (root.__npshGlobalModel || root.globalModel || {}).FLUID?.props || {};
    if (modelFluid && Object.keys(modelFluid).length) {
      return {
        density: positiveNumber(modelFluid.density, 1000),
        viscosityCSt: positiveNumber(modelFluid.viscosity, 1),
        vaporPressureBarA: pipeDisplaySafeNumber(modelFluid.vaporPressure, 0)
      };
    }
    return {
      density: parseFluidMetricFromDom(/density/i, 1000),
      viscosityCSt: parseFluidMetricFromDom(/kinematic\s+viscosity|viscosity/i, 1),
      vaporPressureBarA: parseFluidMetricFromDom(/vapor\s+pressure/i, 0)
    };
  }

  function pipeRegime(reynolds) {
    if (!Number.isFinite(reynolds) || reynolds <= 0) return 'Not calculated';
    if (reynolds <= 2300) return 'Laminar';
    if (reynolds < 4000) return 'Transitional';
    return 'Turbulent';
  }

  function turbulentDarcyFriction(reynolds, relRoughness) {
    let friction = 0.25 / Math.pow(Math.log10((relRoughness / 3.7) + (5.74 / Math.pow(reynolds, 0.9))), 2);
    for (let i = 0; i < 20; i += 1) {
      const next = 1 / Math.pow(-2 * Math.log10((relRoughness / 3.7) + (2.51 / (reynolds * Math.sqrt(friction)))), 2);
      if (Math.abs(next - friction) < 1e-7) return next;
      friction = next;
    }
    return friction;
  }

  function darcyFrictionFactor(reynolds, roughness, diameter) {
    if (!Number.isFinite(reynolds) || reynolds <= 0 || diameter <= 0) return 0;
    const laminar = 64 / reynolds;
    if (reynolds <= 2300) return laminar;
    const turbulent = turbulentDarcyFriction(Math.max(reynolds, 4000), Math.max(roughness, 0) / diameter);
    if (reynolds >= 4000) return turbulent;
    const blend = (reynolds - 2300) / 1700;
    return laminar + ((turbulent - laminar) * blend);
  }

  const PIPE_FITTING_K_FALLBACKS = {
    'Sharp-edged entrance': 0.5,
    'Reentrant entrance': 0.8,
    'Well-rounded entrance': 0.03,
    'Submerged exit': 1.0,
    '90 smooth bend - flanged': 0.3,
    '90 elbow - threaded': 0.9,
    '90 miter bend - no vanes': 1.1,
    '90 miter bend - with vanes': 0.2,
    '45 elbow - threaded': 0.4,
    '180 return bend - flanged': 0.2,
    'Tee - line flow flanged': 0.2,
    'Tee - branch flow flanged': 1.0,
    'Threaded union': 0.08,
    '90 elbow - long radius flanged': 0.2,
    '90 elbow - short radius flanged': 0.5,
    '45 elbow - flanged': 0.2,
    'Concentric reducer - gradual': 0.15,
    'Sudden contraction': 0.5,
    'Sudden expansion': 1.0,
    'Y-strainer - clean': 2.0,
    'Basket strainer - clean': 1.5,
    'Gate valve - fully open': 0.2,
    'Globe valve - fully open': 10.0,
    'Angle valve - fully open': 5.0,
    'Ball valve - fully open': 0.05,
    'Butterfly valve - fully open': 0.4,
    'Plug valve - fully open': 0.4,
    'Control valve - generic open': 10.0,
    'Swing check valve': 2.0
  };

  function fallbackFittingK(segment = {}) {
    if (positiveNumber(segment.minorLoss, 0) > 0) return 0;
    if (String(segment.fittingType || '') === 'Custom K') return positiveNumber(segment.fittingK, 0);
    return positiveNumber(PIPE_FITTING_K_FALLBACKS[segment.fittingType], 0);
  }

  function pipeBreakdownType(detail = {}) {
    const text = [detail.name, detail.fittingType, detail.notes].filter(Boolean).join(' ').toLowerCase();
    if (/valve|check/.test(text)) return 'Valve / inline component';
    if (/strainer|orifice|filter/.test(text)) return 'Inline component';
    if (/elbow|bend|tee|reducer|contraction|expansion|entrance|exit|inlet|outlet/.test(text)) return 'Fitting / local loss';
    if (positiveNumber(detail.minorLossK, 0) > 0 && positiveNumber(detail.length, 0) > 0) return 'Pipe + fitting K';
    if (positiveNumber(detail.minorLossK, 0) > 0) return 'Equivalent K / residual';
    return 'Pipe major loss';
  }

  function classifyKValueSource(detail = {}) {
    const text = [detail.name, detail.fittingType, detail.notes].filter(Boolean).join(' ').toLowerCase();
    if (/calibrat|equivalent|adjusted|derived|matching|residual/.test(text)) {
      return {
        status: 'Calibrated',
        source: 'Equivalent K calibrated to literature/design loss',
        review: 'Verify the calibration basis and duty flow.'
      };
    }
    if (/journal|published|paper|literature|table\s*\d|case\s*\d/.test(text)) {
      return {
        status: 'Journal',
        source: 'Journal / literature value',
        review: ''
      };
    }
    if (String(detail.fittingType || '') === 'Custom K' || positiveNumber(detail.additionalK, 0) > 0) {
      return {
        status: 'User',
        source: 'User-entered custom K',
        review: detail.notes ? '' : 'Add a note/source for this custom K value.'
      };
    }
    if (detail.fittingType && detail.fittingType !== 'None') {
      return {
        status: 'Typical',
        source: 'Typical handbook/table K value',
        review: 'Confirm against project standard or vendor data for final validation.'
      };
    }
    if (positiveNumber(detail.length, 0) > 0) {
      return {
        status: 'Geometry',
        source: 'Pipe geometry, roughness, and Darcy friction',
        review: ''
      };
    }
    return {
      status: 'Input',
      source: 'Pipe Object Properties input',
      review: ''
    };
  }

  function sourceNoteWithProvenance(detail = {}) {
    const source = classifyKValueSource(detail);
    const note = detail.notes || 'Pipe Object Properties input';
    return `[${source.status}] ${note}${source.review ? ` Review: ${source.review}` : ''}`;
  }

  function buildPipeBreakdownFallback(details = []) {
    return details.map(detail => ({
      index: detail.index,
      name: detail.name || `Segment ${(detail.index ?? 0) + 1}`,
      componentType: pipeBreakdownType(detail),
      fittingType: detail.fittingType || 'None',
      quantity: round(detail.fittingQuantity, 4),
      kEach: round(detail.fittingK, 6),
      fittingTotalK: round(detail.fittingTotalK, 6),
      additionalK: round(detail.additionalK, 6),
      totalK: round(detail.minorLossK, 6),
      majorLoss: round(detail.majorLoss, 6),
      fittingLoss: round(detail.fittingLoss, 6),
      additionalLoss: round(detail.additionalLoss, 6),
      minorLoss: round(detail.minorLoss, 6),
      allowanceLoss: round(detail.allowanceLoss, 6),
      totalLoss: round(detail.totalLoss, 6),
      dataBasis: classifyKValueSource(detail).source,
      sourceCategory: classifyKValueSource(detail).status,
      sourceReview: classifyKValueSource(detail).review,
      sourceNote: sourceNoteWithProvenance(detail)
    }));
  }

  function buildPipeMoodyFallback(details = []) {
    const reMin = 1000;
    const reMax = 100000000;
    const roughnessCurves = [0, 0.00001, 0.00005, 0.0001, 0.0005, 0.001, 0.005];
    const curve = (label, relRoughness, start, end, points = 48) => {
      const rows = [];
      const logStart = Math.log10(start);
      const logEnd = Math.log10(end);
      for (let i = 0; i < points; i += 1) {
        const reynolds = Math.pow(10, logStart + ((logEnd - logStart) * (i / Math.max(points - 1, 1))));
        const frictionFactor = relRoughness === null ? 64 / reynolds : turbulentDarcyFriction(reynolds, relRoughness);
        rows.push({ reynolds: round(reynolds, 0), frictionFactor: round(frictionFactor, 6) });
      }
      return { label, relRoughness, points: rows };
    };
    const markers = details
      .filter(detail => positiveNumber(detail.reynolds, 0) > 0 && positiveNumber(detail.frictionFactor, 0) > 0)
      .map(detail => ({
        index: detail.index,
        name: detail.name || `Segment ${detail.index + 1}`,
        reynolds: round(detail.reynolds, 0),
        frictionFactor: round(detail.frictionFactor, 6),
        relRoughness: round(detail.diameter > 0 ? detail.effectiveRoughness / detail.diameter : 0, 8),
        flowRegime: detail.flowRegime,
        diameter: round(detail.diameter, 6),
        effectiveRoughness: round(detail.effectiveRoughness, 10)
      }));
    return {
      xMin: reMin,
      xMax: reMax,
      yMin: 0.008,
      yMax: 0.12,
      laminarLimit: 2300,
      turbulentLimit: 4000,
      laminarCurve: curve('Laminar f = 64/Re', null, reMin, 2300, 28),
      curves: roughnessCurves.map(value => curve(value === 0 ? 'smooth pipe' : `eps/D ${formatNumber(value, 6)}`, value, 4000, reMax)),
      markers,
      isSolved: markers.length > 0,
      note: 'Darcy friction factor chart. Fanning friction factor equals Darcy f / 4.'
    };
  }

  function calculatePipeHydraulicSegmentsFallback(flowRateM3H, pipeProps = {}, fluidPropsOverride = null) {
    const flow = positiveNumber(flowRateM3H, 0);
    const segments = Array.isArray(pipeProps.segments) ? pipeProps.segments : [];
    if (flow <= 0 || !segments.length) return [];
    const fluid = getPipeFallbackFluidProps(fluidPropsOverride);
    const qM3S = flow / 3600;
    const nuM2S = Math.max(fluid.viscosityCSt, 0.000001) * 1e-6;
    const aging = Math.max(0, pipeDisplaySafeNumber(pipeProps.roughnessAgingFactor, 1));
    const allowanceFraction = Math.max(0, pipeDisplaySafeNumber(pipeProps.headLossAllowancePercent, 0)) / 100;

    return segments.map((segment, index) => {
      const diameter = normalizePipeDiameter(segment.diameter);
      if (diameter <= 0) return null;
      const length = Math.max(0, pipeDisplaySafeNumber(segment.length, 0));
      const area = Math.PI * diameter * diameter / 4;
      const velocity = qM3S / area;
      const reynolds = velocity * diameter / nuM2S;
      const roughness = normalizePipeRoughness(segment.roughness);
      const effectiveRoughness = roughness * aging;
      const frictionFactor = darcyFrictionFactor(reynolds, effectiveRoughness, diameter);
      const velocityHead = velocity * velocity / (2 * 9.81);
      const fittingK = fallbackFittingK(segment);
      const fittingQuantity = Math.max(0, pipeDisplaySafeNumber(segment.fittingQuantity, segment.fittingType && segment.fittingType !== 'None' ? 1 : 0));
      const fittingTotalK = fittingK * fittingQuantity;
      const additionalK = positiveNumber(segment.minorLoss, 0);
      const minorLossK = fittingTotalK + additionalK;
      const majorLoss = frictionFactor * (length / diameter) * velocityHead;
      const fittingLoss = fittingTotalK * velocityHead;
      const additionalLoss = additionalK * velocityHead;
      const minorLoss = minorLossK * velocityHead;
      const baseTotalLoss = majorLoss + minorLoss;
      const allowanceLoss = baseTotalLoss * allowanceFraction;
      const flowRegime = pipeRegime(reynolds);
      return {
        index,
        name: segment.name || `Segment ${index + 1}`,
        notes: segment.notes || '',
        pipeSize: segment.pipeSize || 'Custom diameter',
        material: segment.material || 'Custom roughness',
        length,
        diameter,
        roughness,
        effectiveRoughness,
        roughnessAgingFactor: aging,
        fittingType: segment.fittingType || 'None',
        fittingQuantity,
        fittingK,
        fittingTotalK,
        additionalK,
        minorLossK,
        velocity,
        reynolds,
        flowRegime,
        regimeWarning: flowRegime === 'Transitional' ? 'Transitional pipe flow; friction factor is approximate.' : '',
        frictionFactor,
        majorLoss,
        fittingLoss,
        additionalLoss,
        minorLoss,
        baseTotalLoss,
        allowanceFraction,
        allowanceLoss,
        totalLoss: baseTotalLoss + allowanceLoss,
        sizeSource: { status: segment.pipeSize && segment.pipeSize !== 'Custom diameter' ? 'Standard' : 'User', source: 'Pipe Object Properties input' },
        materialSource: { status: segment.material && segment.material !== 'Custom roughness' ? 'Typical' : 'User', source: 'Pipe Object Properties input' },
        fittingSource: { status: segment.fittingType === 'Custom K' ? 'User' : 'Typical', source: 'Pipe Object Properties input' }
      };
    }).filter(Boolean);
  }

  function buildPipeCalculationTraceFallback(flowRateM3H, pipeProps = {}, pipeResults = {}, fluidPropsOverride = null) {
    const flow = positiveNumber(flowRateM3H, 0);
    const details = calculatePipeHydraulicSegmentsFallback(flow, pipeProps, fluidPropsOverride);
    const totals = details.reduce((sum, detail) => {
      sum.majorLoss += detail.majorLoss || 0;
      sum.minorLoss += detail.minorLoss || 0;
      sum.allowanceLoss += detail.allowanceLoss || 0;
      sum.totalLoss += detail.totalLoss || 0;
      sum.totalK += detail.minorLossK || 0;
      return sum;
    }, { majorLoss: 0, minorLoss: 0, allowanceLoss: 0, totalLoss: 0, totalK: 0 });
    const fluid = getPipeFallbackFluidProps(fluidPropsOverride);
    const provenanceWarnings = details
      .map(detail => classifyKValueSource(detail))
      .filter(source => source.review)
      .map(source => `${source.status} K-value source review: ${source.review}`);
    return {
      isSolved: flow > 0 && details.length > 0,
      message: flow > 0 && details.length > 0
        ? 'Pipe calculation trace is based on current solved/displayed pipe flow.'
        : 'Pipe calculation trace needs positive pipe flow.',
      basis: {
        flowM3H: round(flow, 6),
        flowM3S: round(flow / 3600, 8),
        density: round(fluid.density, 4),
        viscosityCSt: round(fluid.viscosityCSt, 6),
        kinematicViscosityM2S: round(fluid.viscosityCSt * 1e-6, 10),
        vaporPressureBarA: round(fluid.vaporPressureBarA, 6),
        roughnessAgingFactor: round(pipeDisplaySafeNumber(pipeProps.roughnessAgingFactor, 1), 4),
        headLossAllowancePercent: round(pipeDisplaySafeNumber(pipeProps.headLossAllowancePercent, 0), 4),
        elevationProfileMode: pipeProps.elevationProfileMode || 'End Elevations'
      },
      totals: {
        majorLoss: round(totals.majorLoss, 6),
        minorLoss: round(totals.minorLoss, 6),
        allowanceLoss: round(totals.allowanceLoss, 6),
        totalLoss: round(totals.totalLoss, 6),
        totalK: round(totals.totalK, 6),
        controllingHighPointSegment: pipeResults.highPointSegment || '',
        highPointPressure: pipeResults.highPointPressure ?? null,
        highPointVaporMargin: pipeResults.highPointVaporMargin ?? null
      },
      moody: buildPipeMoodyFallback(details),
      segments: details.map(detail => ({
        index: detail.index,
        name: detail.name,
        componentType: pipeBreakdownType(detail),
        fittingType: detail.fittingType,
        fittingQuantity: round(detail.fittingQuantity, 4),
        kEach: round(detail.fittingK, 6),
        totalK: round(detail.minorLossK, 6),
        sourceCategory: classifyKValueSource(detail).status,
        sourceNote: sourceNoteWithProvenance(detail),
        notes: detail.notes || '',
        flowRegime: detail.flowRegime,
        warning: detail.regimeWarning,
        dataSources: {
          size: detail.sizeSource,
          material: detail.materialSource,
          fitting: detail.fittingSource
        },
        profile: (pipeResults.segmentProfiles || []).find(profile => profile.index === detail.index) || {},
        steps: [],
        pressureSteps: []
      })),
      fittingValveBreakdown: buildPipeBreakdownFallback(details),
      pumpPathRole: { role: '-', impact: '-' },
      dependencyChain: [
        'Solved/displayed pipe flow drives segment velocity and Reynolds number.',
        'Pipe roughness and Reynolds number determine Darcy friction factor.',
        'Pipe length gives major loss; fitting/valve K gives minor loss.',
        'Total pipe loss is used by suction NPSHa or discharge system-head calculation depending on pipe location.'
      ],
      sourceMap: [],
      warnings: [...new Set([...(pipeResults.warnings || []), ...details.map(detail => detail.regimeWarning).filter(Boolean), ...provenanceWarnings])],
      references: ['Darcy-Weisbach major loss and K-method minor loss.'],
      notes: ['Fallback UI trace uses Pipe Object Properties segment inputs when the protected bundle does not expose pipe formula helpers.'],
      engineeringLimitations: ['Verify K values and roughness against project/vendor/literature data for final validation.']
    };
  }

  function cloneRow(row) {
    return row && typeof row === 'object' ? { ...row } : row;
  }

  function cloneRows(rows) {
    return Array.isArray(rows) ? rows.map(cloneRow) : rows;
  }

  function ensureResults(node) {
    if (!node) return {};
    if (!node.results || typeof node.results !== 'object') node.results = {};
    return node.results;
  }

  function meaningfulStatus(...values) {
    return values
      .map(value => String(value || '').trim())
      .find(value => value && !/^backend unavailable$/i.test(value) && !/^backend timeout$/i.test(value))
      || '';
  }

  function normalizedBackendStatus(results = {}) {
    if (results.backendValidationStatus) return results.backendValidationStatus;
    if (results.backendCalculationSource === 'primary') return 'Connected';
    if (results.backendCalculationSource === 'backend-unavailable') return 'Unavailable';
    const parityStatus = String(results.backendParity?.status || '').toLowerCase();
    if (parityStatus === 'skipped-local-preview') return 'Skipped local';
    if (parityStatus === 'timeout') return 'Timeout';
    if (parityStatus === 'unavailable') return 'Unavailable';
    if (parityStatus === 'matched' || parityStatus === 'protected-primary') return 'Connected';
    return '';
  }

  function normalizeWarnings(warnings) {
    const current = Array.isArray(warnings) ? warnings.filter(Boolean) : [];
    const filtered = current.filter(warning => warning !== BACKEND_OLD_WARNING && warning !== BACKEND_UNVERIFIED_WARNING);
    filtered.push(BACKEND_UNVERIFIED_WARNING);
    return filtered;
  }

  function installUnavailableStatusPatch() {
    const original = root.setBackendProtectedUnavailableResult;
    if (typeof original !== 'function' || original.__captionAuditPatched) return false;
    function patchedSetBackendProtectedUnavailableResult(node, context = {}) {
      const results = ensureResults(node);
      const priorHydraulicStatus = meaningfulStatus(
        results.hydraulicNpshStatus,
        results.cavitationStatus,
        results.npshEvaluation?.hydraulicStatus,
        results.npshEvaluation?.status
      );
      const priorEngineeringStatus = meaningfulStatus(
        results.engineeringStatus,
        results.npshEvaluation?.engineeringStatus,
        results.npshEvaluation?.status
      );
      results.backendCalculationSource = 'backend-unavailable';
      results.backendValidationStatus = context.status === 'timeout' ? 'Timeout' : 'Unavailable';
      results.backendValidationMessage = BACKEND_UNVERIFIED_WARNING;
      results.calculationFreshness = 'Unverified';
      results.status = 'Backend Validation Warning';
      results.hydraulicNpshStatus = priorHydraulicStatus || 'Unverified';
      results.cavitationStatus = results.hydraulicNpshStatus;
      results.engineeringStatus = priorEngineeringStatus || 'Backend Validation Warning';
      results.warnings = normalizeWarnings(results.warnings);
      return results;
    }
    patchedSetBackendProtectedUnavailableResult.__captionAuditPatched = true;
    root.setBackendProtectedUnavailableResult = patchedSetBackendProtectedUnavailableResult;
    return true;
  }

  function installPrimaryResultPatch() {
    const original = root.applyBackendSimulationPrimaryResults;
    if (typeof original !== 'function' || original.__captionAuditPatched) return false;
    function patchedApplyBackendSimulationPrimaryResults(node, result, options = {}) {
      const applied = original.apply(this, arguments);
      if (applied && node?.results) {
        node.results.backendValidationStatus = 'Connected';
        node.results.backendValidationMessage = 'Private backend returned usable hydraulic/NPSH results for the current route.';
        node.results.calculationFreshness = 'Current';
        node.results.routeTrace = mergeRouteTraceLosses(options.routeTrace || result?.routeTrace || node.results.routeTrace, buildRuntimeRouteTrace(node));
        const backendActionReadiness = options.actionReadiness || result?.actionReadiness || result?.pumpActionReadiness || null;
        if (backendActionReadiness) {
          node.results.actionReadinessBackend = backendActionReadiness;
        }
      }
      return applied;
    }
    patchedApplyBackendSimulationPrimaryResults.__captionAuditPatched = true;
    root.applyBackendSimulationPrimaryResults = patchedApplyBackendSimulationPrimaryResults;
    return true;
  }

  function modelEntries() {
    const model = currentModel();
    return Object.keys(model).map(id => [id, model[id]]);
  }

  function nodeIdFor(node) {
    const entry = modelEntries().find(([, value]) => value === node);
    return entry ? entry[0] : '';
  }

  function hydraulicConnections() {
    const links = currentConnections();
    return Array.isArray(links)
      ? links.filter(connection => !connection.connectionType || connection.connectionType === 'hydraulic')
      : [];
  }

  function buildSuctionSequence(pumpId) {
    const sequence = [pumpId];
    const visited = new Set([pumpId]);
    let current = pumpId;
    for (let guard = 0; guard < 60; guard += 1) {
      const connection = hydraulicConnections().find(candidate => candidate?.to === current && !visited.has(candidate.from));
      if (!connection) break;
      if (connection.pipeId) sequence.unshift(connection.pipeId);
      sequence.unshift(connection.from);
      visited.add(connection.from);
      if (connection.pipeId) visited.add(connection.pipeId);
      current = connection.from;
    }
    return sequence;
  }

  function buildDischargeSequence(pumpId) {
    const sequence = [pumpId];
    const visited = new Set([pumpId]);
    let current = pumpId;
    for (let guard = 0; guard < 60; guard += 1) {
      const connection = hydraulicConnections().find(candidate => candidate?.from === current && !visited.has(candidate.to));
      if (!connection) break;
      if (connection.pipeId) sequence.push(connection.pipeId);
      sequence.push(connection.to);
      visited.add(connection.to);
      if (connection.pipeId) visited.add(connection.pipeId);
      current = connection.to;
    }
    return sequence;
  }

  function compactRoute(sequence = []) {
    if (sequence.length <= 6) return sequence.join(' -> ');
    const pumpIndex = sequence.findIndex(id => /^P[-_]/i.test(id));
    const pumpId = pumpIndex >= 0 ? sequence[pumpIndex] : sequence[Math.floor(sequence.length / 2)];
    return `${sequence[0]} -> ... -> ${pumpId} -> ... -> ${sequence[sequence.length - 1]}`;
  }

  function firstFiniteNumber(...values) {
    for (const value of values) {
      const number = toNumber(value);
      if (number !== null) return number;
    }
    return null;
  }

  function getPumpFallbackFlowM3H(pumpId) {
    const model = currentModel();
    const pump = model[pumpId];
    return firstFiniteNumber(
      pump?.results?.flow,
      pump?.results?.npshEvaluation?.flow,
      pump?.props?.designFlow,
      pump?.props?.flow
    ) || 0;
  }

  function getPipeSolvedFlowM3H(pipeNode, fallbackFlowM3H = 0) {
    return firstFiniteNumber(
      pipeNode?.results?.flow,
      pipeNode?.results?.calculationTrace?.basis?.flowM3H,
      pipeNode?.props?.flow,
      fallbackFlowM3H
    ) || 0;
  }

  function getMetricPipeTrace(pipeId, pipeNode, fallbackFlowM3H = 0) {
    const existingTrace = pipeNode?.results?.calculationTrace;
    const existingLoss = firstFiniteNumber(existingTrace?.totals?.totalLoss, existingTrace?.hydraulic?.headLoss);
    if (existingTrace && existingLoss !== null && existingLoss > 0) return existingTrace;
    if (typeof root.buildPipeCalculationTrace !== 'function') return existingTrace || null;
    const flow = getPipeSolvedFlowM3H(pipeNode, fallbackFlowM3H);
    if (flow <= 0 || !pipeNode?.props) return existingTrace || null;
    try {
      const trace = root.buildPipeCalculationTrace(flow, pipeNode.props || {}, pipeNode.results || {}, null, pipeId);
      if (trace?.isSolved && trace?.totals?.totalLoss > 0) {
        ensureResults(pipeNode).calculationTrace = trace;
        return trace;
      }
    } catch (error) {
      console.warn('Unable to rebuild pipe calculation trace for route audit.', pipeId, error);
    }
    return existingTrace || null;
  }

  function nodeMetricHeadLoss(nodeId, fallbackFlowM3H = 0) {
    const model = currentModel();
    const node = model[nodeId];
    if (!node) return null;
    if (['pump', 'source', 'sink', 'tank', 'verticalVessel', 'horizontalVessel', 'separator', 'fluid', 'settings'].includes(String(node.type || ''))) {
      return null;
    }
    const results = node.results || {};
    let trace = results.calculationTrace || null;
    if (node.type === 'pipe') trace = getMetricPipeTrace(nodeId, node, fallbackFlowM3H);
    const headLoss = firstFiniteNumber(
      trace?.totals?.totalLoss,
      trace?.hydraulic?.headLoss,
      results.totalHeadLoss,
      results.headLoss,
      results.suctionLoss,
      results.dischargeLoss
    );
    if (headLoss === null || headLoss <= 0) return null;
    const density = positiveNumber(model.FLUID?.props?.density, 1000);
    const pressureDrop = firstFiniteNumber(
      trace?.hydraulic?.pressureDropBar,
      results.pressureDrop
    ) ?? (headLoss * density * 9.81 / 100000);
    return { headLoss, pressureDrop };
  }

  function sideLoss(sequence = [], fallbackFlowM3H = 0) {
    const model = currentModel();
    let headLoss = 0;
    let pressureDrop = 0;
    sequence.forEach(id => {
      const loss = nodeMetricHeadLoss(id, fallbackFlowM3H);
      if (loss) {
        headLoss += loss.headLoss;
        pressureDrop += loss.pressureDrop;
      }
    });
    return { headLoss, pressureDrop };
  }

  function hasPositiveRouteLoss(loss = {}) {
    return positiveNumber(loss.headLoss, 0) > 1e-9 || positiveNumber(loss.pressureDrop, 0) > 1e-9;
  }

  function mergeRouteTraceLosses(existingTrace, runtimeTrace) {
    if (!existingTrace && !runtimeTrace) return null;
    const merged = { ...(runtimeTrace || {}), ...(existingTrace || {}) };
    if (!hasPositiveRouteLoss(existingTrace?.suctionLoss) && hasPositiveRouteLoss(runtimeTrace?.suctionLoss)) {
      merged.suctionLoss = runtimeTrace.suctionLoss;
    }
    if (!hasPositiveRouteLoss(existingTrace?.dischargeLoss) && hasPositiveRouteLoss(runtimeTrace?.dischargeLoss)) {
      merged.dischargeLoss = runtimeTrace.dischargeLoss;
    }
    merged.text = existingTrace?.text || runtimeTrace?.text || merged.text || '';
    merged.compactText = existingTrace?.compactText || runtimeTrace?.compactText || compactRoute((runtimeTrace?.text || existingTrace?.text || '').split(' -> '));
    merged.lossFreshness = hasPositiveRouteLoss(merged.suctionLoss) || hasPositiveRouteLoss(merged.dischargeLoss)
      ? 'Current from pipe trace'
      : 'Missing pipe loss trace';
    merged.schemaVersion = 'route-trace.ui.v2';
    return merged;
  }

  function getAuditableRouteTrace(node) {
    const results = node?.results || {};
    return mergeRouteTraceLosses(results.routeTrace, buildRuntimeRouteTrace(node));
  }

  function getDisplayUnit(quantity, fallback) {
    try {
      return root.EngineeringUnits?.getDisplayUnit?.(quantity) || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function toDisplayQuantity(value, quantity) {
    const number = toNumber(value);
    if (number === null) return null;
    try {
      const display = root.EngineeringUnits?.toDisplay?.(number, quantity);
      return toNumber(display) ?? number;
    } catch (error) {
      return number;
    }
  }

  function formatRouteLossPair(loss = {}) {
    const head = toDisplayQuantity(loss.headLoss, 'head');
    const pressure = toDisplayQuantity(loss.pressureDrop, 'pressureDelta');
    return {
      value: `${formatNumber(head, 3)} / ${formatNumber(pressure, 3)}`,
      unit: `${getDisplayUnit('head', 'm')}/${getDisplayUnit('pressureDelta', 'bar')}`
    };
  }

  function buildRuntimeRouteTrace(node) {
    const pumpId = nodeIdFor(node);
    if (!pumpId) return null;
    const suction = buildSuctionSequence(pumpId);
    const discharge = buildDischargeSequence(pumpId);
    if (suction.length <= 1 && discharge.length <= 1) return null;
    const sequence = ['Fluid Basis', ...suction, ...discharge.slice(1)];
    const pumpFlowM3H = getPumpFallbackFlowM3H(pumpId);
    return {
      schemaVersion: 'route-trace.ui.v1',
      pumpId,
      text: sequence.join(' -> '),
      compactText: compactRoute(sequence),
      suction,
      discharge,
      suctionLoss: sideLoss(suction, pumpFlowM3H),
      dischargeLoss: sideLoss(discharge, pumpFlowM3H)
    };
  }

  function resolvePumpId(pumpId = '') {
    const model = currentModel();
    const explicit = String(pumpId || '').trim();
    if (explicit && model[explicit]?.type === 'pump') return explicit;
    return Object.entries(model).find(([, node]) => node?.type === 'pump')?.[0] || explicit;
  }

  function firstRouteNodeId(sequence = [], typePattern = /.*/) {
    const model = currentModel();
    return (sequence || []).find(id => typePattern.test(String(model[id]?.type || ''))) || '';
  }

  function fallbackAbsolutePressureBar(node = {}) {
    try {
      const standardsValue = root.EngineeringStandards?.getNodeAbsolutePressureBar?.(node);
      const number = toNumber(standardsValue);
      if (number !== null) return number;
    } catch (error) {
      // Continue with local fallback below.
    }
    const props = node.props || {};
    const pressure = pipeDisplaySafeNumber(props.pressure, 1.01325);
    const basis = String(props.pressureInputBasis || props.pressureBasis || 'Absolute').toLowerCase();
    return basis.includes('gauge') || basis === 'g' ? pressure + 1.01325 : pressure;
  }

  function fallbackHydraulicElevation(node = {}) {
    try {
      const elevation = root.getNodeHydraulicElevation?.(node);
      const number = toNumber(elevation);
      if (number !== null) return number;
    } catch (error) {
      // Continue with local fallback below.
    }
    return pipeDisplaySafeNumber(node.props?.elevation, 0);
  }

  function classifyFallbackPumpOperatingRegion(flow, props = {}) {
    const bepFlow = positiveNumber(props.bepFlow, positiveNumber(props.designFlow, flow));
    if (!bepFlow || !flow) return { percent: null, status: 'Unknown' };
    const percent = (flow / bepFlow) * 100;
    const porMin = positiveNumber(props.porMinPercent, 70);
    const porMax = positiveNumber(props.porMaxPercent, 120);
    const aorMin = positiveNumber(props.aorMinPercent, 50);
    const aorMax = positiveNumber(props.aorMaxPercent, 130);
    const status = percent >= porMin && percent <= porMax
      ? 'POR'
      : (percent >= aorMin && percent <= aorMax ? 'AOR' : 'Outside AOR');
    return { percent, status };
  }

  function fallbackPumpAcademicInputSource(stepTitle = '') {
    const label = String(stepTitle || '').toLowerCase();
    if (label.includes('system')) return 'SRC/SNK boundary heads, suction PFV, and discharge PFV route losses.';
    if (label.includes('source')) return 'SRC pressure basis and Fluid Basis density.';
    if (label.includes('pressure head')) return 'SRC absolute pressure and Fluid Basis density.';
    if (label.includes('elevation')) return 'SRC elevation and pump suction elevation.';
    if (label.includes('velocity')) return 'Source pressure energy basis / inlet velocity head.';
    if (label.includes('suction loss')) return 'Suction Pipe/Fitting/Valve calculation trace.';
    if (label.includes('vapor')) return 'Fluid Basis vapor pressure and density.';
    if (label.includes('npsha')) return 'Source energy balance minus suction loss and vapor pressure head.';
    if (label.includes('npshr')) return 'Pump vendor/journal/manual/engineering-fit NPSHr basis.';
    if (label.includes('operating')) return 'Pump BEP/POR/AOR settings and evaluated flow.';
    if (label.includes('margin')) return 'Selected NPSH margin criteria and evaluated NPSHa/NPSHr.';
    return 'Current solved pump, route, and Fluid Basis state.';
  }

  function fallbackPumpAcademicLiterature(stepTitle = '') {
    const label = String(stepTitle || '').toLowerCase();
    if (label.includes('suction loss') || label.includes('system')) return 'Darcy-Weisbach major loss and K-method minor loss from local fluid mechanics literature.';
    if (label.includes('npsh') || label.includes('vapor') || label.includes('margin')) return 'ANSI/HI NPSH margin guidance and NPSH available/required definitions.';
    if (label.includes('pressure') || label.includes('elevation') || label.includes('velocity')) return 'Bernoulli mechanical energy balance.';
    if (label.includes('operating')) return 'Pump operating range uses BEP/POR/AOR screening basis.';
    return 'Local thesis literature set in book_pdf / pdf_ref.';
  }

  function fallbackPumpAcademicDefenseNote(stepTitle = '') {
    const label = String(stepTitle || '').toLowerCase();
    if (label.includes('npsha')) return 'NPSHa is system-derived, so it must move when SRC, Fluid Basis, suction PFV, or pump elevation changes.';
    if (label.includes('npshr')) return 'NPSHr is pump-derived; final acceptance should cite vendor, test, or justified journal data.';
    if (label.includes('suction loss')) return 'Suction PFV loss is one of the main controllable terms for improving NPSHa.';
    if (label.includes('system')) return 'System head uses the same flow basis as the pump duty/chart point.';
    if (label.includes('margin')) return 'The app separates raw NPSHa minus NPSHr from the stricter required-NPSHa margin check.';
    return 'Use this row as the traceable advisor-facing explanation for the live pump number.';
  }

  function buildFallbackPumpAcademicDefenseRows(trace = {}) {
    const steps = Array.isArray(trace.steps) ? trace.steps : [];
    const rows = steps.map((step, index) => ({
      order: index + 1,
      step: step.title || step.label || `Step ${index + 1}`,
      inputSource: fallbackPumpAcademicInputSource(step.title || step.label),
      formula: step.formula || '-',
      substitution: step.substitution || '-',
      result: step.result,
      unit: step.unit || '',
      literature: fallbackPumpAcademicLiterature(step.title || step.label),
      defenseNote: fallbackPumpAcademicDefenseNote(step.title || step.label)
    }));
    if (trace.interpretation) {
      rows.push({
        order: rows.length + 1,
        step: 'Data Confidence Gate',
        inputSource: 'Hydraulic NPSH status, NPSHr source quality, and selected assessment mode.',
        formula: 'Engineering status = hydraulic status + NPSHr data confidence',
        substitution: `Hydraulic: ${trace.interpretation.hydraulicStatus || '-'}; Data: ${trace.interpretation.dataConfidence || '-'}; Engineering: ${trace.interpretation.engineeringStatus || '-'}`,
        result: trace.interpretation.engineeringStatus || trace.interpretation.status || '-',
        unit: '',
        literature: 'ANSI/HI NPSH guidance separates system NPSHa from pump/vendor NPSHr.',
        defenseNote: 'This explains why a hydraulically acceptable pump can still require source-confidence review.'
      });
    }
    return rows;
  }

  function buildFallbackPumpCalculationTrace(pumpId = '', model = currentModel(), connectionList = currentConnections()) {
    const resolvedPumpId = resolvePumpId(pumpId);
    const pump = model?.[resolvedPumpId];
    if (!pump || pump.type !== 'pump') return null;
    const results = ensureResults(pump);
    const evaluation = results.npshEvaluation || {};
    const routeTrace = getAuditableRouteTrace(pump);
    const hasSolvedNpshReadout = firstFiniteNumber(results.npsha, evaluation.npsha, results.npshMargin, evaluation.npshMargin) !== null;
    if (!routeHasCompletePumpPath(routeTrace) && !hasSolvedNpshReadout) return null;
    const flow = firstFiniteNumber(results.flow, evaluation.flow, pump.props?.designFlow, pump.props?.flow);
    const sourceId = firstRouteNodeId(routeTrace?.suction, /^(source|tank|verticalVessel|horizontalVessel|separator)$/i);
    const sinkId = firstRouteNodeId(routeTrace?.discharge, /^(sink|tank|verticalVessel|horizontalVessel|separator)$/i);
    const source = model?.[sourceId] || {};
    const sink = model?.[sinkId] || {};
    const fluid = model?.FLUID?.props || {};
    const density = positiveNumber(fluid.density, 1000);
    const gravity = 9.81;
    const vaporPressureBarA = pipeDisplaySafeNumber(fluid.vaporPressure, firstFiniteNumber(evaluation.vaporPressureBarA, results.vaporPressureBarA, 0) || 0);
    const vaporPressureHead = vaporPressureBarA * 100000 / (density * gravity);
    const boundaryPressureAbs = fallbackAbsolutePressureBar(source);
    const pressureHead = boundaryPressureAbs * 100000 / (density * gravity);
    const sourceElevation = fallbackHydraulicElevation(source);
    const pumpElevation = pipeDisplaySafeNumber(pump.props?.elevation, pipeDisplaySafeNumber(pump.props?.suctionElevation, 0));
    const sourceVelocityHead = pipeDisplaySafeNumber(evaluation.suctionVelocityHead, pipeDisplaySafeNumber(results.suctionVelocityHead, 0));
    const suctionLoss = firstFiniteNumber(evaluation.suctionLoss, results.suctionLoss, routeTrace?.suctionLoss?.headLoss, 0) || 0;
    const dischargeLoss = firstFiniteNumber(evaluation.dischargeLoss, results.dischargeLoss, routeTrace?.dischargeLoss?.headLoss, 0) || 0;
    const pumpHead = firstFiniteNumber(results.head, results.pumpHead, evaluation.pumpHead, pump.props?.designHead, 0) || 0;
    const npshr = firstFiniteNumber(results.npshr, evaluation.npshr, pump.props?.designNpshr, 0) || 0;
    const npsha = firstFiniteNumber(
      results.npsha,
      evaluation.npsha,
      pressureHead + sourceElevation + sourceVelocityHead - pumpElevation - suctionLoss - vaporPressureHead
    );
    const staticSystemHead = firstFiniteNumber(
      results.staticSystemHead,
      evaluation.staticSystemHead,
      Math.max(0, pumpHead - suctionLoss - dischargeLoss)
    ) || 0;
    const requiredSystemHead = firstFiniteNumber(
      results.requiredSystemHead,
      evaluation.requiredSystemHead,
      staticSystemHead + suctionLoss + dischargeLoss
    ) || 0;
    const headResidual = pumpHead - requiredSystemHead;
    const marginRatio = firstFiniteNumber(evaluation.marginCriteria?.ratio, pump.props?.minNpshMarginRatio, 1.1) || 1.1;
    const absoluteMargin = firstFiniteNumber(evaluation.marginCriteria?.margin, pump.props?.minNpshMargin, 0.6) || 0.6;
    const requiredNpsha = firstFiniteNumber(
      evaluation.requiredNpsha,
      npshr > 0 ? Math.max(npshr * marginRatio, npshr + absoluteMargin) : null
    );
    const npshMargin = firstFiniteNumber(evaluation.npshMargin, results.npshMargin, npsha !== null ? npsha - npshr : null);
    const npshRatio = firstFiniteNumber(evaluation.npshRatio, results.npshRatio, npshr > 0 && npsha !== null ? npsha / npshr : null);
    const npshExcess = firstFiniteNumber(evaluation.npshExcess, npsha !== null && requiredNpsha !== null ? npsha - requiredNpsha : null);
    const operating = classifyFallbackPumpOperatingRegion(flow || 0, pump.props || {});
    const npshrSource = results.npshrSource || evaluation.npshrSource || pump.props?.npshrSourceMode || pump.props?.curveDataSource || 'Pump input / engineering fit';
    const hydraulicStatus = evaluation.hydraulicStatus || (npshMargin !== null && npshMargin >= 0 ? 'Safe' : 'Warning');
    const engineeringStatus = evaluation.engineeringStatus || evaluation.status || (npshExcess !== null && npshExcess >= 0 ? 'Safe' : hydraulicStatus);
    const steps = [
      {
        title: 'System Static Head',
        formula: 'H_static = H_discharge boundary - H_suction boundary',
        substitution: `${formatNumber(staticSystemHead, 3)} m from current SRC/SNK route boundary closure`,
        result: round(staticSystemHead, 3),
        unit: 'm'
      },
      {
        title: 'System Curve Head',
        formula: 'H_system(Q) = H_static + hL_suction(Q) + hL_discharge(Q)',
        substitution: `${formatNumber(staticSystemHead, 3)} + ${formatNumber(suctionLoss, 3)} + ${formatNumber(dischargeLoss, 3)} = ${formatNumber(requiredSystemHead, 3)} m`,
        result: round(requiredSystemHead, 3),
        unit: 'm'
      },
      {
        title: 'Head Residual',
        formula: 'Head residual = H_pump(Q) - H_system(Q)',
        substitution: `${formatNumber(pumpHead, 3)} - ${formatNumber(requiredSystemHead, 3)} = ${formatNumber(headResidual, 3)} m`,
        result: round(headResidual, 3),
        unit: 'm'
      },
      {
        title: 'Source Absolute Pressure',
        formula: 'Pabs = pressure basis converted to absolute pressure',
        substitution: `${formatNumber(pipeDisplaySafeNumber(source.props?.pressure, boundaryPressureAbs), 6)} ${source.props?.pressureInputBasis || 'Absolute'} -> ${formatNumber(boundaryPressureAbs, 6)} bar a`,
        result: round(boundaryPressureAbs, 6),
        unit: 'bar a'
      },
      {
        title: 'Pressure Head',
        formula: 'Hp = Pabs x 100000 / (rho x g)',
        substitution: `${formatNumber(boundaryPressureAbs, 6)} x 100000 / (${formatNumber(density, 3)} x ${formatNumber(gravity, 3)}) = ${formatNumber(pressureHead, 3)} m`,
        result: round(pressureHead, 3),
        unit: 'm'
      },
      {
        title: 'Elevation Head',
        formula: 'Hz = z_source - z_pump',
        substitution: `${formatNumber(sourceElevation, 3)} - ${formatNumber(pumpElevation, 3)} = ${formatNumber(sourceElevation - pumpElevation, 3)} m`,
        result: round(sourceElevation - pumpElevation, 3),
        unit: 'm'
      },
      {
        title: 'Source Velocity Head',
        formula: 'Hvel = v^2 / (2g) or 0 when reservoir velocity is neglected',
        substitution: `${formatNumber(sourceVelocityHead, 3)} m`,
        result: round(sourceVelocityHead, 3),
        unit: 'm'
      },
      {
        title: 'Suction Loss',
        formula: 'HL = pipe major + fitting/valve minor',
        substitution: `${formatNumber(suctionLoss, 3)} m from suction PFV route trace`,
        result: round(suctionLoss, 3),
        unit: 'm'
      },
      {
        title: 'Vapor Pressure Head',
        formula: 'Hv = Pv x 100000 / (rho x g)',
        substitution: `${formatNumber(vaporPressureBarA, 6)} x 100000 / (${formatNumber(density, 3)} x ${formatNumber(gravity, 3)}) = ${formatNumber(vaporPressureHead, 3)} m`,
        result: round(vaporPressureHead, 3),
        unit: 'm'
      },
      {
        title: 'NPSHa',
        formula: 'NPSHa = Hp + z_source + Hvel - z_pump - HL - Hv',
        substitution: `${formatNumber(pressureHead, 3)} + ${formatNumber(sourceElevation, 3)} + ${formatNumber(sourceVelocityHead, 3)} - ${formatNumber(pumpElevation, 3)} - ${formatNumber(suctionLoss, 3)} - ${formatNumber(vaporPressureHead, 3)} = ${formatNumber(npsha, 3)} m`,
        result: round(npsha, 3),
        unit: 'm'
      },
      {
        title: 'NPSHr',
        formula: 'NPSHr = pump required NPSH at operating flow',
        substitution: `${formatNumber(flow, 3)} m3/h -> ${formatNumber(npshr, 3)} m (${npshrSource})`,
        result: round(npshr, 3),
        unit: 'm'
      },
      {
        title: 'Operating Region',
        formula: 'Flow %BEP = Q / Q_BEP x 100',
        substitution: `${formatNumber(flow, 3)} / ${formatNumber(positiveNumber(pump.props?.bepFlow, positiveNumber(pump.props?.designFlow, flow || 0)), 3)} x 100 = ${formatNumber(operating.percent, 3)} % BEP`,
        result: round(operating.percent, 3),
        unit: '% BEP'
      },
      {
        title: 'Required NPSHa',
        formula: 'Required NPSHa = max(NPSHr x margin ratio, NPSHr + absolute margin)',
        substitution: `max(${formatNumber(npshr, 3)} x ${formatNumber(marginRatio, 3)}, ${formatNumber(npshr, 3)} + ${formatNumber(absoluteMargin, 3)}) = ${formatNumber(requiredNpsha, 3)} m`,
        result: round(requiredNpsha, 3),
        unit: 'm'
      },
      {
        title: 'Margin and Ratio',
        formula: 'Margin = NPSHa - NPSHr; Ratio = NPSHa / NPSHr; Excess = NPSHa - Required NPSHa',
        substitution: `${formatNumber(npsha, 3)} - ${formatNumber(npshr, 3)} = ${formatNumber(npshMargin, 3)} m; ratio ${formatNumber(npshRatio, 3)}; excess ${formatNumber(npshExcess, 3)} m`,
        result: round(npshExcess, 3),
        unit: 'm'
      }
    ];
    const trace = {
      schemaVersion: 'pump-npsh-calculation-trace.ui-fallback.v1',
      basis: {
        fluidName: fluid.fluidName || model?.FLUID?.name || '-',
        temperature: round(fluid.temp, 3),
        density: round(density, 3),
        viscosity: round(fluid.viscosity, 3),
        vaporPressureBarA: round(vaporPressureBarA, 6),
        gravity: round(gravity, 3)
      },
      boundary: {
        id: sourceId || '-',
        name: source.name || sourceId || '-',
        type: source.type || '-',
        pressureInput: round(source.props?.pressure, 6),
        pressureInputBasis: source.props?.pressureInputBasis || source.props?.pressureBasis || 'Absolute',
        pressureInputUnit: /gauge/i.test(String(source.props?.pressureInputBasis || '')) ? 'bar g' : 'bar a',
        absolutePressureBar: round(boundaryPressureAbs, 6),
        pressureHead: round(pressureHead, 3),
        velocityHead: round(sourceVelocityHead, 3),
        totalHead: round(pressureHead + sourceElevation + sourceVelocityHead, 3),
        elevation: round(sourceElevation, 3),
        boundaryDataSource: source.props?.boundaryDataSource || 'Manual',
        attachedEquipment: source.props?.attachedTo || '-',
        flow: round(flow, 3)
      },
      pump: {
        id: resolvedPumpId,
        name: pump.name || resolvedPumpId,
        elevation: round(pumpElevation, 3),
        flow: round(flow, 3),
        head: round(pumpHead, 3),
        npshrSource,
        bepFlow: round(positiveNumber(pump.props?.bepFlow, positiveNumber(pump.props?.designFlow, flow || 0)), 3),
        porMinPercent: round(positiveNumber(pump.props?.porMinPercent, 70), 3),
        porMaxPercent: round(positiveNumber(pump.props?.porMaxPercent, 120), 3),
        aorMinPercent: round(positiveNumber(pump.props?.aorMinPercent, 50), 3),
        aorMaxPercent: round(positiveNumber(pump.props?.aorMaxPercent, 130), 3),
        operatingRangeSource: pump.props?.operatingRangeSource || 'Pump properties / default screening range',
        operatingPercentBep: round(operating.percent, 3),
        operatingRegion: operating.status
      },
      dependencyChain: [
        'Fluid Basis -> density, viscosity, vapor pressure',
        'SRC -> absolute pressure head and static elevation',
        'Suction Pipe/Fitting/Valve -> Darcy/K-method suction loss',
        'Pump -> head, NPSHr source, BEP/POR/AOR operating basis',
        'Discharge Pipe/Fitting/Valve -> system curve loss',
        'SNK -> downstream boundary demand/pressure',
        'NPSHa -> suction energy above vapor pressure',
        'Engineering status -> hydraulic result plus NPSHr source confidence'
      ],
      path: {
        sequence: routeTrace?.text ? routeTrace.text.split(' -> ') : ['Fluid Basis', ...(routeTrace?.suction || []), ...(routeTrace?.discharge || []).slice(1)],
        text: routeTrace?.text || routeTrace?.compactText || '-',
        dominantLoss: suctionLoss >= dischargeLoss ? `Suction route ${formatNumber(suctionLoss, 3)} m` : `Discharge route ${formatNumber(dischargeLoss, 3)} m`,
        sinkId: sinkId || '-',
        sinkName: sink.name || sinkId || '-'
      },
      losses: {
        major: null,
        minor: null,
        total: round(suctionLoss, 3),
        suction: round(suctionLoss, 3),
        discharge: round(dischargeLoss, 3),
        entries: (routeTrace?.suction || [])
          .map(id => ({ id, node: model?.[id], loss: nodeMetricHeadLoss(id, flow || 0) }))
          .filter(entry => entry.loss)
          .map(entry => ({
            component: entry.id,
            headLoss: round(entry.loss.headLoss, 6),
            pressureDrop: round(entry.loss.pressureDrop, 6)
          }))
      },
      steps,
      interpretation: {
        status: evaluation.status || engineeringStatus,
        hydraulicStatus,
        dataConfidence: evaluation.dataConfidence || results.dataConfidence || results.curveDataConfidence || '-',
        dataConfidenceStatus: evaluation.dataConfidenceStatus || results.dataConfidenceStatus || '-',
        engineeringStatus,
        margin: round(npshMargin, 3),
        ratio: round(npshRatio, 3),
        requiredNpsha: round(requiredNpsha, 3),
        npshExcess: round(npshExcess, 3),
        marginBasis: evaluation.marginCriteria?.basis || pump.props?.npshMarginBasis || 'Ratio + absolute margin',
        marginRegionBasis: evaluation.marginCriteria?.regionBasis || operating.status,
        marginRatioLimit: round(marginRatio, 3),
        absoluteMarginLimit: round(absoluteMargin, 3),
        hydraulicMessage: evaluation.hydraulicMessage || (hydraulicStatus === 'Safe' ? 'NPSHa is above NPSHr.' : 'Review NPSHa against NPSHr.'),
        engineeringMessage: evaluation.engineeringMessage || evaluation.message || 'Trace rebuilt from current frontend route and pump state.',
        message: evaluation.message || 'Pump formula defense trace is available from current route.'
      },
      references: [
        'Bernoulli energy balance',
        'Darcy-Weisbach pipe friction',
        'Minor loss coefficient K for fittings and valves',
        'ANSI/HI NPSH margin guidance',
        'NPSH available versus required NPSH',
        'book_pdf / pdf_ref local literature set'
      ],
      limitations: [
        'Frontend fallback rebuilds the trace from current route state when the protected bundle/backend does not expose calculationTrace.',
        'Final engineering validation still needs verified pump/vendor/test or justified journal NPSHr data.'
      ],
      assumptions: [
        'Fallback trace boundary uses current SRC -> suction PFV -> Pump -> discharge PFV -> SNK route and live pump readouts.'
      ]
    };
    trace.academicDefense = buildFallbackPumpAcademicDefenseRows(trace);
    return trace;
  }

  function attachPumpCalculationTrace(pump, evaluation = {}, trace = null) {
    if (!pump || !trace) return null;
    const results = ensureResults(pump);
    const existing = results.npshEvaluation && typeof results.npshEvaluation === 'object'
      ? results.npshEvaluation
      : {};
    const interpretation = trace.interpretation || {};
    results.npshEvaluation = {
      ok: interpretation.engineeringStatus === 'Safe',
      hydraulicOk: interpretation.hydraulicStatus === 'Safe',
      status: interpretation.status || interpretation.engineeringStatus || existing.status || 'Trace available',
      hydraulicStatus: interpretation.hydraulicStatus || existing.hydraulicStatus,
      engineeringStatus: interpretation.engineeringStatus || existing.engineeringStatus,
      dataConfidence: interpretation.dataConfidence || existing.dataConfidence,
      dataConfidenceStatus: interpretation.dataConfidenceStatus || existing.dataConfidenceStatus,
      flow: trace.pump?.flow ?? existing.flow,
      pumpHead: trace.pump?.head ?? existing.pumpHead,
      npsha: trace.steps?.find(step => step.title === 'NPSHa')?.result ?? existing.npsha,
      npshr: trace.steps?.find(step => step.title === 'NPSHr')?.result ?? existing.npshr,
      npshMargin: interpretation.margin ?? existing.npshMargin,
      npshRatio: interpretation.ratio ?? existing.npshRatio,
      requiredNpsha: interpretation.requiredNpsha ?? existing.requiredNpsha,
      npshExcess: interpretation.npshExcess ?? existing.npshExcess,
      marginCriteria: existing.marginCriteria || {
        basis: interpretation.marginBasis,
        regionBasis: interpretation.marginRegionBasis,
        ratio: interpretation.marginRatioLimit,
        margin: interpretation.absoluteMarginLimit
      },
      operatingRegion: trace.pump?.operatingRegion ?? existing.operatingRegion,
      operatingPercentBep: trace.pump?.operatingPercentBep ?? existing.operatingPercentBep,
      npshrSource: trace.pump?.npshrSource ?? existing.npshrSource,
      suctionPressureAbs: trace.boundary?.absolutePressureBar ?? existing.suctionPressureAbs,
      suctionLoss: trace.losses?.suction ?? trace.losses?.total ?? existing.suctionLoss,
      dischargeLoss: trace.losses?.discharge ?? existing.dischargeLoss,
      vaporPressureHead: trace.steps?.find(step => step.title === 'Vapor Pressure Head')?.result ?? existing.vaporPressureHead,
      notes: existing.notes || evaluation.notes || [],
      warnings: existing.warnings || evaluation.warnings || [],
      envelope: existing.envelope || evaluation.envelope || null,
      calculationTrace: trace,
      ...existing,
      ...evaluation,
      calculationTrace: trace
    };
    if (results.npsha === undefined && results.npshEvaluation.npsha !== undefined) results.npsha = results.npshEvaluation.npsha;
    if (results.npshr === undefined && results.npshEvaluation.npshr !== undefined) results.npshr = results.npshEvaluation.npshr;
    if (results.npshMargin === undefined && results.npshEvaluation.npshMargin !== undefined) results.npshMargin = results.npshEvaluation.npshMargin;
    if (results.suctionLoss === undefined && results.npshEvaluation.suctionLoss !== undefined) results.suctionLoss = results.npshEvaluation.suctionLoss;
    if (results.dischargeLoss === undefined && results.npshEvaluation.dischargeLoss !== undefined) results.dischargeLoss = results.npshEvaluation.dischargeLoss;
    return trace;
  }

  function ensurePumpNpshCalculationTrace(pumpId = '', model = currentModel(), connectionList = currentConnections(), options = {}) {
    const resolvedPumpId = resolvePumpId(pumpId);
    const pump = model?.[resolvedPumpId];
    if (!pump || pump.type !== 'pump') return null;
    const existingTrace = pump.results?.npshEvaluation?.calculationTrace;
    if (existingTrace && !options.force) return existingTrace;
    if (!options.skipEngine && typeof root.runPumpNpshEvaluation === 'function' && !root.__captionAuditEnsuringPumpTrace) {
      try {
        root.__captionAuditEnsuringPumpTrace = true;
        const evaluation = root.runPumpNpshEvaluation(resolvedPumpId, model, connectionList);
        const trace = evaluation?.calculationTrace;
        if (trace) return attachPumpCalculationTrace(pump, evaluation, trace);
      } catch (error) {
        console.warn('Unable to rebuild pump formula defense trace from engine.', error);
      } finally {
        root.__captionAuditEnsuringPumpTrace = false;
      }
    }
    const fallbackTrace = buildFallbackPumpCalculationTrace(resolvedPumpId, model, connectionList);
    return attachPumpCalculationTrace(pump, pump.results?.npshEvaluation || {}, fallbackTrace);
  }

  function ensureAllPumpNpshCalculationTraces(options = {}) {
    const model = currentModel();
    Object.entries(model || {}).forEach(([pumpId, node]) => {
      if (node?.type === 'pump') ensurePumpNpshCalculationTrace(pumpId, model, currentConnections(), options);
    });
  }

  function currentSimulationState() {
    if (typeof root.getSimulationState !== 'function') return null;
    try {
      const state = root.getSimulationState();
      return typeof state === 'string' ? JSON.parse(state) : state;
    } catch (error) {
      return null;
    }
  }

  function hasModelEntries(model) {
    return !!model && typeof model === 'object' && Object.keys(model).some(id => id !== 'SETTINGS' && id !== 'FLUID');
  }

  function currentModel() {
    const directModel = root.__npshGlobalModel || root.globalModel;
    if (hasModelEntries(directModel)) return directModel;
    return currentSimulationState()?.model || directModel || {};
  }

  function currentConnections() {
    const list = root.__npshConnections || root.connections;
    if (Array.isArray(list) && list.length) return list;
    const stateConnections = currentSimulationState()?.connections;
    return Array.isArray(stateConnections) ? stateConnections : (Array.isArray(list) ? list : []);
  }

  function typedSimulationNodes(type) {
    const normalizedType = String(type || '').trim().toLowerCase();
    if (!normalizedType) return [];
    return Object.entries(currentModel())
      .filter(([, node]) => String(node?.type || '').trim().toLowerCase() === normalizedType)
      .map(([id, node]) => ({ ...(node || {}), id }));
  }

  function installSimulationStateHelperPatch() {
    if (root.__captionAuditSimulationStateHelperPatch) return false;
    root.__captionAuditSimulationStateHelperPatch = true;
    const originalNodesByType = root.getSimulationNodesByType;
    const originalFirstNodeByType = root.getFirstSimulationNodeByType;
    const originalPathInfo = root.getSourcePumpPathInfo;

    root.getSimulationNodesByType = function getSimulationNodesByTypePatched(type, ...args) {
      let nodes = [];
      if (typeof originalNodesByType === 'function') {
        try {
          const original = originalNodesByType.call(this, type, ...args);
          if (Array.isArray(original)) nodes = original;
        } catch (error) {
          nodes = [];
        }
      }
      return nodes.length ? nodes : typedSimulationNodes(type);
    };

    root.getFirstSimulationNodeByType = function getFirstSimulationNodeByTypePatched(type, ...args) {
      if (typeof originalFirstNodeByType === 'function') {
        try {
          const original = originalFirstNodeByType.call(this, type, ...args);
          if (original) return original;
        } catch (error) {
          // fall back to current simulation state below
        }
      }
      return root.getSimulationNodesByType(type)[0] || null;
    };

    root.getSourcePumpPathInfo = function getSourcePumpPathInfoPatched(pumpId = '', ...args) {
      if (typeof originalPathInfo === 'function') {
        try {
          const original = originalPathInfo.call(this, pumpId, ...args);
          if (original && original.status !== 'Not evaluated' && original.pathText && original.pathText !== '-') {
            return original;
          }
        } catch (error) {
          // fall back to auditable route trace below
        }
      }
      const pumps = root.getSimulationNodesByType('pump');
      const pump = pumpId ? currentModel()[pumpId] : pumps[0];
      const resolvedPumpId = pumpId || pump?.id || nodeIdFor(pump);
      const trace = getAuditableRouteTrace(currentModel()[resolvedPumpId] || pump);
      if (!routeHasCompletePumpPath(trace)) {
        return { status: 'Not evaluated', pumpId: resolvedPumpId || '', pathText: '-', warnings: ['No complete SRC -> pump -> SNK hydraulic path is available.'] };
      }
      return {
        status: trace.lossFreshness || 'Route available',
        pumpId: resolvedPumpId,
        pathText: trace.text || trace.compactText,
        warnings: []
      };
    };
    return true;
  }

  function uniqueStrings(values = []) {
    return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
  }

  function clonePumpOptimizationValue(value) {
    if (Array.isArray(value)) return value.map(item => clonePumpOptimizationValue(item));
    if (value && typeof value === 'object') {
      return Object.keys(value).reduce((copy, key) => {
        copy[key] = clonePumpOptimizationValue(value[key]);
        return copy;
      }, {});
    }
    return value;
  }

  function captureFallbackPumpOptimizationInputSnapshot(props = {}) {
    return PUMP_OPTIMIZATION_INPUT_SNAPSHOT_KEYS.reduce((snapshot, key) => {
      snapshot[key] = props[key] === undefined ? '' : clonePumpOptimizationValue(props[key]);
      return snapshot;
    }, {});
  }

  function restoreFallbackPumpOptimizationInputSnapshot(props = {}, snapshot = {}) {
    PUMP_OPTIMIZATION_INPUT_SNAPSHOT_KEYS.forEach(key => {
      props[key] = snapshot[key] === undefined ? '' : clonePumpOptimizationValue(snapshot[key]);
    });
    return props;
  }

  function stablePumpOptimizationValue(value) {
    if (Array.isArray(value)) return value.map(item => stablePumpOptimizationValue(item));
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((copy, key) => {
        if (value[key] !== undefined) copy[key] = stablePumpOptimizationValue(value[key]);
        return copy;
      }, {});
    }
    return value;
  }

  function pumpOptimizationSnapshotText(value) {
    try {
      return JSON.stringify(stablePumpOptimizationValue(value ?? ''));
    } catch (error) {
      return String(value ?? '');
    }
  }

  function areFallbackPumpOptimizationSnapshotsEqual(a = {}, b = {}) {
    return PUMP_OPTIMIZATION_INPUT_SNAPSHOT_KEYS.every(key => (
      pumpOptimizationSnapshotText(a?.[key]) === pumpOptimizationSnapshotText(b?.[key])
    ));
  }

  function getFallbackPumpOptimizationModelSignature(pumpId, model = currentModel(), connectionList = currentConnections()) {
    const modelSnapshot = Object.keys(model || {})
      .sort()
      .filter(nodeId => nodeId !== pumpId)
      .map(nodeId => {
        const node = model[nodeId] || {};
        return {
          id: nodeId,
          type: node.type || '',
          props: stablePumpOptimizationValue(node.props || {})
        };
      });
    const connectionSnapshot = (connectionList || [])
      .map(connection => ({
        from: connection.from || '',
        fromPort: connection.fromPort || '',
        to: connection.to || '',
        toPort: connection.toPort || '',
        pipeId: connection.pipeId || ''
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify(stablePumpOptimizationValue({
      model: modelSnapshot,
      connections: connectionSnapshot
    }));
  }

  function getFallbackPumpOptimizationProposalFreshness(pumpId, model = currentModel(), connectionList = currentConnections(), proposal = null) {
    const pump = model?.[pumpId];
    const currentInputs = captureFallbackPumpOptimizationInputSnapshot(pump?.props || {});
    const currentModelSignature = getFallbackPumpOptimizationModelSignature(pumpId, model, connectionList);
    const networkOutdated = !!(proposal?.modelSignature && proposal.modelSignature !== currentModelSignature);
    const inputOutdated = !!(!proposal?.applied
      && proposal?.sourcePumpInputs
      && !areFallbackPumpOptimizationSnapshotsEqual(currentInputs, proposal.sourcePumpInputs));
    return {
      currentInputs,
      currentModelSignature,
      networkOutdated,
      inputOutdated,
      outdated: networkOutdated || inputOutdated
    };
  }

  function getFallbackPumpOptimizationProposalView(pumpId, model = currentModel(), connectionList = currentConnections(), proposal = null) {
    if (!proposal) return null;
    const pump = model?.[pumpId];
    const results = pump?.results || {};
    const view = {
      ...proposal,
      previousInputsAvailable: !!(
        results.pumpOptimizationRestoreSnapshot
        || proposal.restoreSnapshot
        || proposal.previousInputsAvailable
      )
    };
    const freshness = getFallbackPumpOptimizationProposalFreshness(pumpId, model, connectionList, proposal);
    view.networkOutdated = freshness.networkOutdated;
    view.inputOutdated = freshness.inputOutdated;
    view.outdated = freshness.outdated;
    view.currentModelSignature = freshness.currentModelSignature;

    if (view.outdated) {
      view.status = 'Proposal Outdated';
      view.message = freshness.networkOutdated
        ? 'Network or boundary data changed after this report was calculated. Recalculate before applying.'
        : 'Pump inputs changed after this report was calculated. Recalculate before applying.';
      view.canApply = false;
      view.warnings = uniqueStrings([view.message, ...(proposal.warnings || [])]);
      return view;
    }

    if (view.applied) {
      view.status = 'Applied';
      view.message = view.previousInputsAvailable
        ? 'Proposal has been applied. Previous inputs are available to restore.'
        : 'Proposal has been applied.';
      view.canApply = false;
      return view;
    }

    if (view.restored) {
      view.status = 'Restored';
      view.message = 'Previous pump inputs were restored. Recalculate if a new duty proposal is needed.';
      view.previousInputsAvailable = false;
      view.canApply = !!view.proposedProps;
    }

    return view;
  }

  function readBackendActionContract(pump = {}) {
    const results = pump.results || {};
    return results.actionReadinessBackend
      || results.backendActionReadiness
      || results.pumpActionReadiness
      || null;
  }

  function proposalViewForPump(pumpId, pump, model = currentModel(), connectionList = currentConnections()) {
    const proposal = pump?.results?.pumpOptimizationProposal || null;
    if (!proposal) return null;
    try {
      if (typeof root.getPumpOptimizationProposalView === 'function') {
        return root.getPumpOptimizationProposalView(pumpId, model, connectionList, proposal);
      }
    } catch (error) {
      console.warn('Unable to read pump optimization proposal view.', error);
    }
    return proposal;
  }

  function isProposalUsable(view) {
    if (!view || view.outdated) return false;
    return !!view.canApply || /proposal ready|ready|applied/i.test(String(view.status || ''));
  }

  function hasFluidBasis(model = currentModel()) {
    const props = model.FLUID?.props || {};
    return positiveNumber(props.density, 0) > 0 && toNumber(props.vaporPressure) !== null;
  }

  function routeHasCompletePumpPath(routeTrace) {
    return !!routeTrace
      && Array.isArray(routeTrace.suction)
      && Array.isArray(routeTrace.discharge)
      && routeTrace.suction.length > 1
      && routeTrace.discharge.length > 1;
  }

  function getPumpTargetFlowBasis(pump = {}, proposal = null) {
    return firstFiniteNumber(
      pump.results?.flow,
      pump.results?.npshEvaluation?.flow,
      proposal?.targetFlow,
      pump.props?.designFlow,
      pump.props?.flow
    );
  }

  function getPumpHeadBasis(pump = {}, proposal = null) {
    return firstFiniteNumber(
      pump.props?.designHead,
      proposal?.requiredSystemHead,
      proposal?.designHead,
      pump.results?.requiredSystemHead,
      pump.results?.npshEvaluation?.requiredSystemHead,
      pump.results?.head
    );
  }

  function buildPumpProposalActionReadiness(pumpId, model = currentModel(), connectionList = currentConnections()) {
    const pump = model?.[pumpId];
    const results = pump?.results || {};
    const rawProposal = results.pumpOptimizationProposal || results.pumpNetworkOptimizationWorkflow?.proposal || null;
    const proposal = rawProposal ? proposalViewForPump(pumpId, pump, model, connectionList) || rawProposal : null;
    const hasProposalState = !!(proposal || results.pumpNetworkOptimizationWorkflow);
    const previousInputsAvailable = !!(!proposal?.restored && (
      results.pumpOptimizationRestoreSnapshot
      || proposal?.restoreSnapshot
      || proposal?.previousInputsAvailable
    ));
    const applyBlockedReasons = [];
    if (!pump || pump.type !== 'pump') applyBlockedReasons.push('Select a pump before applying proposal inputs.');
    if (!proposal) applyBlockedReasons.push('Run Evaluate NPSH from Network before applying a proposal.');
    if (proposal?.applied) applyBlockedReasons.push('Proposal has already been applied.');
    if (proposal?.outdated) applyBlockedReasons.push('Proposal is stale; recalculate it from the network first.');
    if (proposal && !proposal.proposedProps) applyBlockedReasons.push('Proposal does not include pump input changes.');
    if (proposal && proposal.canApply === false && !proposal.restored && !proposal.applied && !proposal.outdated) {
      applyBlockedReasons.push(proposal.message || proposal.status || 'Proposal is not applicable yet.');
    }
    const applyCanRun = !!(
      pump?.type === 'pump'
      && proposal
      && proposal.proposedProps
      && proposal.canApply !== false
      && !proposal.applied
      && !proposal.outdated
    );

    const restoreBlockedReasons = [];
    if (!pump || pump.type !== 'pump') restoreBlockedReasons.push('Select a pump before restoring previous inputs.');
    if (!previousInputsAvailable) restoreBlockedReasons.push('No previous pump inputs are available until Apply Proposal has been used.');
    const restoreCanRun = !!(pump?.type === 'pump' && previousInputsAvailable);

    const clearBlockedReasons = [];
    if (!pump || pump.type !== 'pump') clearBlockedReasons.push('Select a pump before clearing proposal state.');
    if (!hasProposalState) clearBlockedReasons.push('No proposal or workflow state is available to clear.');
    const clearCanRun = !!(pump?.type === 'pump' && hasProposalState);

    return {
      apply: {
        canRun: applyCanRun,
        status: applyCanRun ? 'Ready' : (proposal?.status || 'Waiting for proposal'),
        label: 'Apply Proposal',
        blockedReasons: uniqueStrings(applyBlockedReasons),
        warnings: uniqueStrings(proposal?.warnings || []),
        source: 'pump-optimization-proposal',
        proposalStatus: proposal?.status || null
      },
      restore: {
        canRun: restoreCanRun,
        status: restoreCanRun ? 'Previous inputs available' : 'No previous inputs',
        label: 'Restore Previous Inputs',
        blockedReasons: uniqueStrings(restoreBlockedReasons),
        warnings: [],
        source: 'pump-optimization-proposal',
        previousInputsAvailable
      },
      clear: {
        canRun: clearCanRun,
        status: clearCanRun ? 'Ready' : 'Nothing to clear',
        label: 'Clear Proposal',
        blockedReasons: uniqueStrings(clearBlockedReasons),
        warnings: [],
        source: 'pump-optimization-proposal'
      }
    };
  }

  function callOriginalReadiness(name, args, fallback) {
    const original = pumpActionOriginals[name];
    if (typeof original !== 'function') return fallback;
    try {
      return original.apply(root, args);
    } catch (error) {
      console.warn(`Unable to evaluate ${name}.`, error);
      return fallback;
    }
  }

  function buildPumpActionReadinessContract(pumpId, model = currentModel(), connectionList = currentConnections(), options = {}) {
    const pump = model?.[pumpId];
    const base = {
      schemaVersion: 'pump-action-readiness.v1',
      pumpId,
      source: 'frontend-runtime',
      generatedAt: new Date().toISOString(),
      calculationId: null,
      backendValidationStatus: pump?.results?.backendValidationStatus || pump?.results?.backendParity?.status || null,
      frontendFallbackAvailable: true,
      actions: {}
    };
    if (!pump || pump.type !== 'pump') {
      const blocked = ['Select a pump before evaluating NPSH or building an engineering-fit curve.'];
      return {
        ...base,
        actions: {
          evaluateNpshFromNetwork: {
            canRun: false,
            status: 'Invalid pump',
            label: 'Evaluate NPSH from Network',
            blockedReasons: blocked,
            warnings: blocked,
            requiredInputs: ['Pump'],
            source: 'frontend-runtime'
          },
          buildEngineeringFitFromVendorJournalDutyData: {
            canRun: false,
            status: 'Invalid pump',
            label: 'Build Engineering Fit From Vendor/Journal Duty Data',
            blockedReasons: blocked,
            warnings: blocked,
            requiredInputs: ['Pump'],
            source: 'frontend-runtime'
          }
        }
      };
    }

    const backend = readBackendActionContract(pump);
    const routeTrace = getAuditableRouteTrace(pump);
    const proposal = proposalViewForPump(pumpId, pump, model, connectionList);
    const proposalActions = buildPumpProposalActionReadiness(pumpId, model, connectionList);
    const proposalReady = isProposalUsable(proposal);
    const optimizationReadiness = options.optimizationReadiness || callOriginalReadiness(
      'getPumpOptimizationReadiness',
      [pumpId, model, connectionList],
      { canRun: false, status: 'Frontend fallback', warnings: [] }
    );
    const targetFlow = getPumpTargetFlowBasis(pump, proposal);
    const routeReady = routeHasCompletePumpPath(routeTrace);
    const solvedNpsh = firstFiniteNumber(
      pump.results?.npsha,
      pump.results?.npshEvaluation?.npsha,
      proposal?.npshaAtDesign
    );
    const evaluateCanRun = !!optimizationReadiness.canRun
      || proposalReady
      || (hasFluidBasis(model) && routeReady && targetFlow !== null && targetFlow > 0);
    const evaluateStale = !!proposal?.outdated || /stale|outdated/i.test(String(optimizationReadiness.status || ''));
    const evaluateBlocked = evaluateCanRun
      ? []
      : uniqueStrings([
          ...(optimizationReadiness.warnings || []),
          'Complete Fluid Basis -> SRC -> suction Pipe/Fitting/Valve -> Pump -> discharge Pipe/Fitting/Valve -> SNK route before network NPSH evaluation.'
        ]);
    const evaluateWarnings = uniqueStrings([
      ...(optimizationReadiness.warnings || []),
      ...(proposalReady && !optimizationReadiness.canRun ? ['Using the current proposal/route trace because live readiness is not green.'] : []),
      ...(solvedNpsh === null && evaluateCanRun ? ['NPSHa will be refreshed from the route during evaluation.'] : [])
    ]);

    const engineeringReadiness = options.engineeringFitReadiness || callOriginalReadiness(
      'getPumpEngineeringFitReadiness',
      [pumpId, model, connectionList],
      { canRun: false, status: 'Frontend fallback', warnings: [] }
    );
    const designFlow = firstFiniteNumber(pump.props?.designFlow, targetFlow, pump.results?.flow, proposal?.targetFlow);
    const designHead = getPumpHeadBasis(pump, proposal);
    const fitCanRun = (designFlow !== null && designFlow > 0) && (designHead !== null && designHead > 0);
    const requiresAdvancedMode = String(pump.props?.inputMode || 'Basic') !== 'Advanced';
    const fitBlocked = fitCanRun
      ? []
      : uniqueStrings([
          ...(engineeringReadiness.blockedReasons || engineeringReadiness.warnings || []),
          ...(designFlow !== null && designFlow > 0 ? [] : ['Design Flow or network flow demand is missing.']),
          ...(designHead !== null && designHead > 0 ? [] : ['Design Head or network system head is missing.'])
        ]);
    const fitWarnings = uniqueStrings([
      ...(engineeringReadiness.warnings || []).filter(warning => !/available only in advanced mode/i.test(String(warning))),
      ...(fitCanRun && requiresAdvancedMode ? ['Pump is in Basic Mode; applying the fit will switch it to Advanced Mode and preserve the duty inputs as curve basis.'] : [])
    ]);

    const frontend = {
      ...base,
      source: backend ? 'backend-contract + frontend-runtime' : 'frontend-runtime',
      backendContract: backend || null,
      inputMode: pump.props?.inputMode || 'Basic',
      isCalculationStale: evaluateStale,
      routeTraceStatus: routeReady ? (routeTrace.lossFreshness || 'Route available') : 'Route incomplete',
      actions: {
        evaluateNpshFromNetwork: {
          canRun: evaluateCanRun,
          status: evaluateStale
            ? 'Stale - recalculate from network'
            : (evaluateCanRun ? (optimizationReadiness.canRun ? 'Ready' : 'Ready from route/proposal') : (optimizationReadiness.status || 'Blocked')),
          label: evaluateStale ? 'Recalculate & Evaluate NPSH from Network' : 'Evaluate NPSH from Network',
          blockedReasons: evaluateBlocked,
          warnings: evaluateWarnings,
          requiredInputs: evaluateCanRun ? [] : ['Fluid Basis', 'SRC', 'suction PFV', 'Pump', 'discharge PFV', 'SNK'],
          stale: evaluateStale,
          source: optimizationReadiness.canRun ? 'frontend-readiness' : (proposalReady ? 'frontend-proposal-view' : 'frontend-route-trace')
        },
        buildEngineeringFitFromVendorJournalDutyData: {
          canRun: fitCanRun,
          status: fitCanRun
            ? (requiresAdvancedMode ? 'Ready - Advanced mode will be enabled' : 'Ready')
            : (engineeringReadiness.status || 'Need flow/head basis'),
          label: requiresAdvancedMode ? 'Switch to Advanced & Build Engineering Fit' : 'Build Engineering Fit From Vendor/Journal Duty Data',
          blockedReasons: fitBlocked,
          warnings: fitWarnings,
          requiredInputs: fitCanRun ? [] : ['Design Flow or network flow demand', 'Design Head or network system head'],
          requiresAdvancedMode,
          source: fitCanRun ? 'frontend-duty-basis' : 'frontend-readiness'
        },
        applyPumpOptimizationProposal: proposalActions.apply,
        restorePumpOptimizationPreviousInputs: proposalActions.restore,
        clearPumpOptimizationProposal: proposalActions.clear
      }
    };

    if (!backend?.actions) return frontend;
    Object.keys(frontend.actions).forEach(key => {
      const backendAction = backend.actions[key];
      if (!backendAction) return;
      const localAction = frontend.actions[key];
      frontend.actions[key] = {
        ...backendAction,
        ...localAction,
        canRun: !!backendAction.canRun || !!localAction.canRun,
        status: backendAction.canRun ? backendAction.status : localAction.status,
        blockedReasons: localAction.canRun ? [] : uniqueStrings([...(backendAction.blockedReasons || []), ...(localAction.blockedReasons || [])]),
        warnings: uniqueStrings([...(backendAction.warnings || []), ...(localAction.warnings || [])]),
        source: backendAction.canRun ? 'backend-contract' : localAction.source,
        backendStatus: backendAction.status
      };
    });
    return frontend;
  }

  function buildFallbackPumpEngineeringFitCurveFromVendorData(pumpId, model = currentModel(), connectionList = currentConnections(), options = {}) {
    const pump = model?.[pumpId];
    if (!pump || pump.type !== 'pump') {
      return { ok: false, status: 'Invalid pump', warnings: ['Select a pump before building a curve.'] };
    }
    const proposal = proposalViewForPump(pumpId, pump, model, connectionList);
    const targetFlow = getPumpTargetFlowBasis(pump, proposal);
    const designHead = getPumpHeadBasis(pump, proposal);
    if (targetFlow === null || targetFlow <= 0) {
      return { ok: false, status: 'Missing flow basis', warnings: ['Design Flow or network flow demand is required.'] };
    }
    if (designHead === null || designHead <= 0) {
      return { ok: false, status: 'Missing head basis', warnings: ['Design Head or network system head is required.'] };
    }
    const designEfficiency = positiveNumber(pump.props?.designEfficiency, positiveNumber(options.defaultEfficiency, 75));
    const npsha = firstFiniteNumber(pump.results?.npsha, pump.results?.npshEvaluation?.npsha, proposal?.npshaAtDesign);
    const proposedNpshr = firstFiniteNumber(pump.props?.designNpshr, proposal?.proposedNpshr, proposal?.maxAllowableNpshr);
    const designNpshr = positiveNumber(proposedNpshr, Math.max(0.01, designHead * 0.06));
    const shutoffHead = Math.max(designHead * 1.15, designHead + 0.001);
    const curveA = (shutoffHead - designHead) / Math.pow(targetFlow, 2);
    const fractions = [0, 0.5, 0.7, 1, 1.2, 1.3];
    const curveData = fractions.map(fraction => {
      const flow = targetFlow * fraction;
      const effShape = fraction <= 0 ? 0 : Math.max(0.15, 1 - 1.6 * Math.pow(fraction - 1, 2));
      const npshrShape = 0.72 + 0.28 * Math.pow(Math.max(0, fraction), 2.2);
      return {
        flow: round(flow, 6),
        head: round(Math.max(designHead * 0.1, shutoffHead - curveA * Math.pow(flow, 2)), 6),
        eff: round(designEfficiency * effShape, 6),
        npshr: round(Math.max(0.01, designNpshr * npshrShape), 6)
      };
    });
    const warnings = [];
    if (npsha === null) warnings.push('NPSHa is not available from backend action readiness; fit uses pump duty inputs only.');
    if (!positiveNumber(pump.props?.designNpshr, 0)) warnings.push('NPSHr is a screening value until vendor/journal duty NPSHr is entered.');
    return {
      ok: true,
      status: warnings.length ? 'Engineering Fit Ready - Review' : 'Engineering Fit Ready',
      targetFlow: round(targetFlow, 6),
      designHead: round(designHead, 6),
      designEfficiency: round(designEfficiency, 6),
      designNpshr: round(designNpshr, 6),
      flowBasis: positiveNumber(pump.props?.designFlow, 0) ? 'Vendor/Journal Design Flow' : 'Network/proposal flow basis',
      headBasis: positiveNumber(pump.props?.designHead, 0) ? 'Vendor/Journal Design Head' : 'Network/proposal system head',
      efficiencyBasis: positiveNumber(pump.props?.designEfficiency, 0) ? 'Vendor/Journal Design Eff.' : 'Screening efficiency',
      npshrBasis: positiveNumber(pump.props?.designNpshr, 0) ? 'Vendor/Journal duty NPSHr' : 'Screening placeholder NPSHr',
      npshaAtDesign: npsha === null ? null : round(npsha, 6),
      completeness: {
        isComplete: positiveNumber(pump.props?.designFlow, 0) > 0
          && positiveNumber(pump.props?.designHead, 0) > 0
          && positiveNumber(pump.props?.designEfficiency, 0) > 0
          && positiveNumber(pump.props?.designNpshr, 0) > 0,
        count: ['designFlow', 'designHead', 'designEfficiency', 'designNpshr'].filter(key => positiveNumber(pump.props?.[key], 0) > 0).length,
        missing: ['designFlow', 'designHead', 'designEfficiency', 'designNpshr'].filter(key => !(positiveNumber(pump.props?.[key], 0) > 0))
      },
      curveData,
      warnings: uniqueStrings(warnings),
      assumptions: [
        'Protected frontend fallback stores an engineering fit from current duty/proposal data while backend calculation remains the source of truth.',
        'Pump was switched from Basic Mode to Advanced Mode so the engineering-fit curve can be stored and audited.',
        'Pump head fit uses H(Q)=H0-AQ^2 with H0=1.15 x duty head.'
      ]
    };
  }

  function applyFallbackPumpEngineeringFitCurveFromVendorData(pumpId, model = currentModel(), connectionList = currentConnections()) {
    const pump = model?.[pumpId];
    if (!pump || pump.type !== 'pump') {
      return { ok: false, status: 'Invalid pump', warnings: ['Select a pump before building a curve.'] };
    }
    const fit = buildFallbackPumpEngineeringFitCurveFromVendorData(pumpId, model, connectionList);
    if (!fit.ok) return fit;
    const engineeringFitSource = 'Engineering Fit';
    pump.props = {
      ...(pump.props || {}),
      inputMode: 'Advanced',
      npshrSourceMode: 'Manufacturer/Test Curve',
      curveDataSource: engineeringFitSource,
      curveGeneratedByEngineeringFit: true,
      curveFitCompleteness: fit.completeness.isComplete
        ? 'Engineering fit - complete vendor/journal duty data'
        : (fit.completeness.count > 0 ? 'Engineering fit - partial vendor/journal duty data' : 'Engineering fit - network/screening basis'),
      curveFitAssumptions: fit.assumptions.join(' | '),
      curveFitFlowBasis: fit.flowBasis,
      curveFitHeadBasis: fit.headBasis,
      curveFitEfficiencyBasis: fit.efficiencyBasis,
      curveFitNpshrBasis: fit.npshrBasis,
      curveSourceNote: fit.assumptions.join(' '),
      designFlow: fit.targetFlow,
      designHead: fit.designHead,
      designEfficiency: fit.designEfficiency,
      designNpshr: fit.designNpshr,
      bepFlow: fit.targetFlow,
      curveData: fit.curveData.map(point => ({ ...point }))
    };
    const results = ensureResults(pump);
    results.engineeringFitCurve = {
      ...fit,
      applied: true,
      appliedAt: new Date().toISOString(),
      status: 'Engineering Fit Applied'
    };
    results.curveDataSource = engineeringFitSource;
    results.curveDataConfidence = fit.completeness.isComplete ? 'Engineering Fit - duty data complete' : 'Engineering Fit - review source data';
    return {
      ...fit,
      ok: true,
      status: 'Engineering Fit Applied',
      warnings: fit.warnings
    };
  }

  function buildFallbackPumpNetworkProposal(pumpId, model = currentModel(), connectionList = currentConnections()) {
    const pump = model?.[pumpId];
    if (!pump || pump.type !== 'pump') return null;
    const existing = proposalViewForPump(pumpId, pump, model, connectionList);
    if (existing) return existing;
    const sourcePumpInputs = captureFallbackPumpOptimizationInputSnapshot(pump.props || {});
    const targetFlow = getPumpTargetFlowBasis(pump, null);
    const requiredSystemHead = getPumpHeadBasis(pump, null);
    const npshaAtDesign = firstFiniteNumber(pump.results?.npsha, pump.results?.npshEvaluation?.npsha);
    const maxAllowableNpshr = npshaAtDesign === null ? null : Math.max(0.01, Math.min(npshaAtDesign / 1.1, npshaAtDesign - 0.6));
    const canApply = targetFlow !== null && targetFlow > 0 && requiredSystemHead !== null && requiredSystemHead > 0;
    return {
      ok: canApply,
      canApply,
      status: canApply ? 'Proposal Ready' : 'Review Network',
      message: canApply ? 'Pump parameter proposal is ready from current route/proposal data.' : 'Network proposal needs flow and head basis.',
      targetFlow: targetFlow === null ? null : round(targetFlow, 3),
      requiredSystemHead: requiredSystemHead === null ? null : round(requiredSystemHead, 3),
      npshaAtDesign: npshaAtDesign === null ? null : round(npshaAtDesign, 3),
      maxAllowableNpshr: maxAllowableNpshr === null ? null : round(maxAllowableNpshr, 3),
      proposedProps: canApply ? {
        ...(pump.props || {}),
        designFlow: round(targetFlow, 3),
        designHead: round(requiredSystemHead, 3),
        designNpshr: maxAllowableNpshr === null ? pump.props?.designNpshr : round(maxAllowableNpshr * 0.95, 3)
      } : null,
      warnings: [],
      notes: ['Protected frontend fallback uses current route/proposal data; backend /api/simulate remains the protected calculation source.'],
      proposalVersion: 'ui-fallback-1',
      modelSignature: getFallbackPumpOptimizationModelSignature(pumpId, model, connectionList),
      sourcePumpInputs,
      createdAt: new Date().toISOString()
    };
  }

  function runFallbackPumpNetworkOptimization(pumpId, model = currentModel(), connectionList = currentConnections()) {
    const pump = model?.[pumpId];
    if (!pump || pump.type !== 'pump') {
      return { ok: false, status: 'Invalid pump', proposal: null, warnings: ['Select a pump before calculating duty from the network.'] };
    }
    const contract = buildPumpActionReadinessContract(pumpId, model, connectionList);
    const action = contract.actions.evaluateNpshFromNetwork;
    const proposal = buildFallbackPumpNetworkProposal(pumpId, model, connectionList);
    const results = ensureResults(pump);
    if (proposal) results.pumpOptimizationProposal = proposal;
    const workflow = {
      ok: !!action.canRun && !!proposal?.canApply,
      status: proposal?.status || action.status || 'Review Network',
      proposal,
      applyResult: null,
      npshEvaluation: pump.results?.npshEvaluation || null,
      actionReadiness: action,
      readinessContract: contract,
      warnings: uniqueStrings([...(proposal?.warnings || []), ...(action.warnings || [])])
    };
    results.pumpNetworkOptimizationWorkflow = workflow;
    results.actionReadinessFrontend = contract;
    return workflow;
  }

  function normalizePumpPropsIfAvailable(props = {}) {
    if (typeof root.normalizePumpProps === 'function') {
      try {
        root.normalizePumpProps(props);
      } catch (error) {
        console.warn('Unable to normalize pump props after proposal action.', error);
      }
    }
    return props;
  }

  function applyFallbackPumpOptimizationProposal(pumpId, model = currentModel(), proposal = null) {
    const connectionList = currentConnections();
    const pump = model?.[pumpId];
    if (!pump || pump.type !== 'pump') {
      return { ok: false, status: 'Invalid pump', warnings: ['Select a pump before applying the pump duty sizing proposal.'] };
    }

    const results = ensureResults(pump);
    const activeProposal = getFallbackPumpOptimizationProposalView(
      pumpId,
      model,
      connectionList,
      proposal || results.pumpOptimizationProposal || buildFallbackPumpNetworkProposal(pumpId, model, connectionList)
    );

    if (activeProposal?.applied) {
      return { ok: false, status: 'Already Applied', warnings: ['This pump duty sizing proposal has already been applied.'] };
    }
    if (activeProposal?.outdated) {
      return { ok: false, status: 'Proposal Outdated', warnings: activeProposal.warnings || ['Recalculate the pump duty proposal before applying.'] };
    }
    if (!activeProposal?.canApply || !activeProposal.proposedProps) {
      return {
        ok: false,
        status: activeProposal?.status || 'Cannot Apply',
        warnings: activeProposal?.warnings || ['No applicable pump duty sizing proposal is available.']
      };
    }

    const previousInputs = results.pumpOptimizationRestoreSnapshot
      || captureFallbackPumpOptimizationInputSnapshot(pump.props || {});
    const existingCurveData = Array.isArray(pump.props?.curveData)
      ? pump.props.curveData.map(point => clonePumpOptimizationValue(point))
      : null;
    pump.props = {
      ...(pump.props || {}),
      ...clonePumpOptimizationValue(activeProposal.proposedProps || {})
    };
    if (!Array.isArray(pump.props.curveData) && existingCurveData) pump.props.curveData = existingCurveData;
    normalizePumpPropsIfAvailable(pump.props);

    const appliedInputs = captureFallbackPumpOptimizationInputSnapshot(pump.props);
    results.pumpOptimizationRestoreSnapshot = previousInputs;
    results.pumpOptimizationAppliedInputs = appliedInputs;
    results.pumpOptimizationProposal = {
      ...activeProposal,
      canApply: false,
      applied: true,
      restored: false,
      appliedAt: new Date().toISOString(),
      status: 'Applied',
      previousInputsAvailable: true,
      restoreSnapshot: previousInputs,
      appliedInputs
    };
    results.pumpOptimizationApplyResult = {
      ok: true,
      status: 'Applied',
      appliedAt: results.pumpOptimizationProposal.appliedAt
    };
    results.actionReadinessFrontend = buildPumpActionReadinessContract(pumpId, model, connectionList);

    return {
      ok: true,
      status: 'Applied',
      proposal: activeProposal,
      warnings: ['Verify proposed Manual NPSHr and Design Efficiency against vendor/manufacturer data before final Engineering Validation.']
    };
  }

  function hasFallbackPumpOptimizationManualEditsAfterApply(pumpId, model = currentModel()) {
    const pump = model?.[pumpId];
    const appliedInputs = pump?.results?.pumpOptimizationAppliedInputs;
    if (!pump || !appliedInputs) return false;
    return !areFallbackPumpOptimizationSnapshotsEqual(
      captureFallbackPumpOptimizationInputSnapshot(pump.props || {}),
      appliedInputs
    );
  }

  function restoreFallbackPumpOptimizationPreviousInputs(pumpId, model = currentModel(), options = {}) {
    const pump = model?.[pumpId];
    if (!pump || pump.type !== 'pump') {
      return { ok: false, status: 'Invalid pump', warnings: ['Select a pump before restoring previous pump inputs.'] };
    }
    const results = ensureResults(pump);
    const snapshot = results.pumpOptimizationRestoreSnapshot || results.pumpOptimizationProposal?.restoreSnapshot;
    if (!snapshot) {
      return { ok: false, status: 'No Previous Inputs', warnings: ['No previous pump input snapshot is available to restore.'] };
    }
    if (!options.force && hasFallbackPumpOptimizationManualEditsAfterApply(pumpId, model)) {
      return {
        ok: false,
        status: 'Confirm Restore',
        requiresConfirmation: true,
        warnings: ['Current pump inputs changed after applying the proposal. Confirm restore before replacing them.']
      };
    }

    if (!pump.props || typeof pump.props !== 'object') pump.props = {};
    restoreFallbackPumpOptimizationInputSnapshot(pump.props, snapshot);
    normalizePumpPropsIfAvailable(pump.props);
    const proposal = results.pumpOptimizationProposal;
    if (proposal) {
      const { restoreSnapshot, appliedInputs, ...restoredProposal } = proposal;
      results.pumpOptimizationProposal = {
        ...restoredProposal,
        canApply: !!proposal.proposedProps && !proposal.outdated,
        applied: false,
        restored: true,
        restoredAt: new Date().toISOString(),
        status: 'Restored',
        message: 'Previous pump inputs were restored. Recalculate if a new duty proposal is needed.',
        previousInputsAvailable: false
      };
    }
    delete results.pumpOptimizationRestoreSnapshot;
    delete results.pumpOptimizationAppliedInputs;
    delete results.pumpOptimizationApplyResult;
    results.actionReadinessFrontend = buildPumpActionReadinessContract(pumpId, model, currentConnections());

    return { ok: true, status: 'Restored', warnings: [] };
  }

  function clearFallbackPumpOptimizationProposal(pumpId, model = currentModel()) {
    const pump = model?.[pumpId];
    if (!pump || pump.type !== 'pump') {
      return { ok: false, status: 'Invalid pump', warnings: ['Select a pump before clearing the pump duty proposal.'] };
    }
    const results = ensureResults(pump);
    delete results.pumpOptimizationProposal;
    delete results.pumpNetworkOptimizationWorkflow;
    delete results.pumpOptimizationApplyResult;
    delete results.pumpOptimizationRestoreSnapshot;
    delete results.pumpOptimizationAppliedInputs;
    results.actionReadinessFrontend = buildPumpActionReadinessContract(pumpId, model, currentConnections());
    return { ok: true, status: 'Cleared', warnings: [] };
  }

  function installPumpActionReadinessPatch() {
    let installed = false;

    if (typeof root.getPumpOptimizationReadiness !== 'function') {
      root.getPumpOptimizationReadiness = function fallbackPumpOptimizationReadiness(pumpId, model = currentModel(), connectionList = currentConnections()) {
        const contract = buildPumpActionReadinessContract(pumpId, model, connectionList, {
          optimizationReadiness: { canRun: false, status: 'Frontend fallback', warnings: [] }
        });
        const action = contract.actions.evaluateNpshFromNetwork;
        return {
          canRun: !!action.canRun,
          status: action.status,
          warnings: action.blockedReasons.length ? action.blockedReasons : action.warnings,
          blockedReasons: action.blockedReasons,
          requiredInputs: action.requiredInputs,
          actionReadiness: action,
          readinessContract: contract
        };
      };
      root.getPumpOptimizationReadiness.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.getPumpEngineeringFitReadiness !== 'function') {
      root.getPumpEngineeringFitReadiness = function fallbackPumpEngineeringFitReadiness(pumpId, model = currentModel(), connectionList = currentConnections()) {
        const contract = buildPumpActionReadinessContract(pumpId, model, connectionList, {
          engineeringFitReadiness: { canRun: false, status: 'Frontend fallback', warnings: [] }
        });
        const action = contract.actions.buildEngineeringFitFromVendorJournalDutyData;
        return {
          canRun: !!action.canRun,
          status: action.status,
          warnings: action.blockedReasons.length ? action.blockedReasons : action.warnings,
          blockedReasons: action.blockedReasons,
          requiredInputs: action.requiredInputs,
          requiresAdvancedMode: !!action.requiresAdvancedMode,
          actionReadiness: action,
          readinessContract: contract
        };
      };
      root.getPumpEngineeringFitReadiness.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.buildPumpEngineeringFitCurveFromVendorData !== 'function') {
      root.buildPumpEngineeringFitCurveFromVendorData = buildFallbackPumpEngineeringFitCurveFromVendorData;
      root.buildPumpEngineeringFitCurveFromVendorData.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.applyPumpEngineeringFitCurveFromVendorData !== 'function') {
      root.applyPumpEngineeringFitCurveFromVendorData = applyFallbackPumpEngineeringFitCurveFromVendorData;
      root.applyPumpEngineeringFitCurveFromVendorData.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.runPumpNetworkOptimization !== 'function') {
      root.runPumpNetworkOptimization = runFallbackPumpNetworkOptimization;
      root.runPumpNetworkOptimization.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.getPumpOptimizationProposalView !== 'function') {
      root.getPumpOptimizationProposalView = getFallbackPumpOptimizationProposalView;
      root.getPumpOptimizationProposalView.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.applyPumpOptimizationProposal !== 'function') {
      root.applyPumpOptimizationProposal = applyFallbackPumpOptimizationProposal;
      root.applyPumpOptimizationProposal.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.hasPumpOptimizationManualEditsAfterApply !== 'function') {
      root.hasPumpOptimizationManualEditsAfterApply = hasFallbackPumpOptimizationManualEditsAfterApply;
      root.hasPumpOptimizationManualEditsAfterApply.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.restorePumpOptimizationPreviousInputs !== 'function') {
      root.restorePumpOptimizationPreviousInputs = restoreFallbackPumpOptimizationPreviousInputs;
      root.restorePumpOptimizationPreviousInputs.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.clearPumpOptimizationProposal !== 'function') {
      root.clearPumpOptimizationProposal = clearFallbackPumpOptimizationProposal;
      root.clearPumpOptimizationProposal.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.getPumpOptimizationReadiness === 'function' && !root.getPumpOptimizationReadiness.__captionAuditPatched) {
      pumpActionOriginals.getPumpOptimizationReadiness = root.getPumpOptimizationReadiness;
      root.getPumpOptimizationReadiness = function patchedPumpOptimizationReadiness(pumpId, model = currentModel(), connectionList = currentConnections()) {
        const originalResult = callOriginalReadiness('getPumpOptimizationReadiness', [pumpId, model, connectionList], { canRun: false, warnings: [] });
        const contract = buildPumpActionReadinessContract(pumpId, model, connectionList, { optimizationReadiness: originalResult });
        const action = contract.actions.evaluateNpshFromNetwork;
        return {
          ...originalResult,
          canRun: !!action.canRun,
          status: action.status,
          warnings: action.blockedReasons.length ? action.blockedReasons : action.warnings,
          blockedReasons: action.blockedReasons,
          requiredInputs: action.requiredInputs,
          actionReadiness: action,
          readinessContract: contract
        };
      };
      root.getPumpOptimizationReadiness.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.getPumpEngineeringFitReadiness === 'function' && !root.getPumpEngineeringFitReadiness.__captionAuditPatched) {
      pumpActionOriginals.getPumpEngineeringFitReadiness = root.getPumpEngineeringFitReadiness;
      root.getPumpEngineeringFitReadiness = function patchedPumpEngineeringFitReadiness(pumpId, model = currentModel(), connectionList = currentConnections()) {
        const originalResult = callOriginalReadiness('getPumpEngineeringFitReadiness', [pumpId, model, connectionList], { canRun: false, warnings: [] });
        const contract = buildPumpActionReadinessContract(pumpId, model, connectionList, { engineeringFitReadiness: originalResult });
        const action = contract.actions.buildEngineeringFitFromVendorJournalDutyData;
        return {
          ...originalResult,
          canRun: !!action.canRun,
          status: action.status,
          warnings: action.blockedReasons.length ? action.blockedReasons : action.warnings,
          blockedReasons: action.blockedReasons,
          requiredInputs: action.requiredInputs,
          requiresAdvancedMode: !!action.requiresAdvancedMode,
          actionReadiness: action,
          readinessContract: contract
        };
      };
      root.getPumpEngineeringFitReadiness.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.buildPumpEngineeringFitCurveFromVendorData === 'function' && !root.buildPumpEngineeringFitCurveFromVendorData.__captionAuditPatched) {
      pumpActionOriginals.buildPumpEngineeringFitCurveFromVendorData = root.buildPumpEngineeringFitCurveFromVendorData;
      root.buildPumpEngineeringFitCurveFromVendorData = function patchedBuildPumpEngineeringFitCurveFromVendorData(pumpId, model = currentModel(), connectionList = currentConnections(), options = {}) {
        const pump = model?.[pumpId];
        const previousMode = pump?.props?.inputMode;
        const shouldTemporarilyPromote = pump?.type === 'pump' && previousMode !== 'Advanced' && options.allowBasicMode !== false;
        if (shouldTemporarilyPromote) pump.props.inputMode = 'Advanced';
        try {
          const result = pumpActionOriginals.buildPumpEngineeringFitCurveFromVendorData.call(this, pumpId, model, connectionList, options);
          if (result?.ok && shouldTemporarilyPromote) {
            result.assumptions = uniqueStrings([
              ...(result.assumptions || []),
              'Pump can be promoted from Basic Mode to Advanced Mode when the fit is applied.'
            ]);
          }
          return result;
        } finally {
          if (shouldTemporarilyPromote && pump?.props) pump.props.inputMode = previousMode;
        }
      };
      root.buildPumpEngineeringFitCurveFromVendorData.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.applyPumpEngineeringFitCurveFromVendorData === 'function' && !root.applyPumpEngineeringFitCurveFromVendorData.__captionAuditPatched) {
      pumpActionOriginals.applyPumpEngineeringFitCurveFromVendorData = root.applyPumpEngineeringFitCurveFromVendorData;
      root.applyPumpEngineeringFitCurveFromVendorData = function patchedApplyPumpEngineeringFitCurveFromVendorData(pumpId, model = currentModel(), connectionList = currentConnections()) {
        const pump = model?.[pumpId];
        const previousMode = pump?.props?.inputMode;
        const action = buildPumpActionReadinessContract(pumpId, model, connectionList).actions.buildEngineeringFitFromVendorJournalDutyData;
        const shouldPromote = pump?.type === 'pump' && previousMode !== 'Advanced' && action.canRun;
        if (shouldPromote) pump.props.inputMode = 'Advanced';
        const result = pumpActionOriginals.applyPumpEngineeringFitCurveFromVendorData.call(this, pumpId, model, connectionList);
        if (!result?.ok && shouldPromote && pump?.props) pump.props.inputMode = previousMode;
        if (result?.ok && pump?.results) {
          pump.results.actionReadinessFrontend = buildPumpActionReadinessContract(pumpId, model, connectionList);
        }
        return result;
      };
      root.applyPumpEngineeringFitCurveFromVendorData.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.runPumpNetworkOptimization === 'function' && !root.runPumpNetworkOptimization.__captionAuditPatched) {
      pumpActionOriginals.runPumpNetworkOptimization = root.runPumpNetworkOptimization;
      root.runPumpNetworkOptimization = function patchedRunPumpNetworkOptimization(pumpId, model = currentModel(), connectionList = currentConnections()) {
        const result = pumpActionOriginals.runPumpNetworkOptimization.call(this, pumpId, model, connectionList);
        const pump = model?.[pumpId];
        const contract = buildPumpActionReadinessContract(pumpId, model, connectionList);
        const action = contract.actions.evaluateNpshFromNetwork;
        if (result?.ok || result?.proposal?.canApply || !action.canRun || !pump) {
          if (pump?.results) pump.results.actionReadinessFrontend = contract;
          return { ...result, actionReadiness: action, readinessContract: contract };
        }
        let npshEvaluation = null;
        try {
          if (typeof root.runPumpNpshEvaluation === 'function') {
            npshEvaluation = root.runPumpNpshEvaluation(pumpId, model, connectionList);
            if (!pump.results) pump.results = {};
            pump.results.npshEvaluation = npshEvaluation;
          }
        } catch (error) {
          console.warn('Unable to refresh NPSH evaluation from network.', error);
        }
        const proposal = proposalViewForPump(pumpId, pump, model, connectionList) || result?.proposal || null;
        const fallbackResult = {
          ...result,
          ok: !!(proposal?.canApply || npshEvaluation?.ok || action.canRun),
          status: proposal?.status || npshEvaluation?.status || 'Network NPSH Evaluation Ready',
          proposal,
          npshEvaluation,
          actionReadiness: action,
          readinessContract: contract,
          warnings: uniqueStrings([
            ...(result?.warnings || []),
            ...(action.warnings || [])
          ])
        };
        if (!pump.results) pump.results = {};
        pump.results.pumpNetworkOptimizationWorkflow = fallbackResult;
        pump.results.actionReadinessFrontend = contract;
        return fallbackResult;
      };
      root.runPumpNetworkOptimization.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.applyPumpOptimizationProposal === 'function' && !root.applyPumpOptimizationProposal.__captionAuditPatched) {
      pumpActionOriginals.applyPumpOptimizationProposal = root.applyPumpOptimizationProposal;
      root.applyPumpOptimizationProposal = function patchedApplyPumpOptimizationProposal(pumpId, model = currentModel(), proposal = null) {
        const result = pumpActionOriginals.applyPumpOptimizationProposal.call(this, pumpId, model, proposal);
        const pump = model?.[pumpId];
        if (pump?.results) {
          pump.results.actionReadinessFrontend = buildPumpActionReadinessContract(pumpId, model, currentConnections());
        }
        return result;
      };
      root.applyPumpOptimizationProposal.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.restorePumpOptimizationPreviousInputs === 'function' && !root.restorePumpOptimizationPreviousInputs.__captionAuditPatched) {
      pumpActionOriginals.restorePumpOptimizationPreviousInputs = root.restorePumpOptimizationPreviousInputs;
      root.restorePumpOptimizationPreviousInputs = function patchedRestorePumpOptimizationPreviousInputs(pumpId, model = currentModel(), options = {}) {
        const result = pumpActionOriginals.restorePumpOptimizationPreviousInputs.call(this, pumpId, model, options);
        const pump = model?.[pumpId];
        if (pump?.results) {
          if (result?.ok || /restored/i.test(String(result?.status || ''))) {
            const proposal = pump.results.pumpOptimizationProposal;
            if (proposal) {
              delete proposal.restoreSnapshot;
              delete proposal.appliedInputs;
              proposal.previousInputsAvailable = false;
              proposal.applied = false;
              proposal.restored = true;
            }
          }
          pump.results.actionReadinessFrontend = buildPumpActionReadinessContract(pumpId, model, currentConnections());
        }
        return result;
      };
      root.restorePumpOptimizationPreviousInputs.__captionAuditPatched = true;
      installed = true;
    }

    if (typeof root.clearPumpOptimizationProposal === 'function' && !root.clearPumpOptimizationProposal.__captionAuditPatched) {
      pumpActionOriginals.clearPumpOptimizationProposal = root.clearPumpOptimizationProposal;
      root.clearPumpOptimizationProposal = function patchedClearPumpOptimizationProposal(pumpId, model = currentModel()) {
        const result = pumpActionOriginals.clearPumpOptimizationProposal.call(this, pumpId, model);
        const pump = model?.[pumpId];
        if (pump?.results) {
          pump.results.actionReadinessFrontend = buildPumpActionReadinessContract(pumpId, model, currentConnections());
        }
        return result;
      };
      root.clearPumpOptimizationProposal.__captionAuditPatched = true;
      installed = true;
    }

    root.getPumpActionReadinessContract = function getPumpActionReadinessContractPublic(pumpId, model = currentModel(), connectionList = currentConnections()) {
      return buildPumpActionReadinessContract(pumpId, model, connectionList);
    };
    return installed;
  }

  function normalizePumpRows(rows, node) {
    const normalized = cloneRows(rows);
    if (!Array.isArray(normalized)) return rows;
    normalized.forEach(row => {
      if (!row || typeof row !== 'object') return;
      if (row.label === 'Fluid Vapor Press.') {
        row.label = 'Basis Vapor Press.';
        row.title = 'Fluid Basis vapor pressure.';
      }
      if (row.label === 'NPSH Vapor Press.') {
        row.label = 'Vapor Press. Used';
        row.title = 'Fluid vapor pressure used in the NPSH calculation.';
      }
    });

    const results = node?.results || {};
    const backendStatus = normalizedBackendStatus(results);
    const hydraulicStatus = meaningfulStatus(
      results.hydraulicNpshStatus,
      results.cavitationStatus,
      results.npshEvaluation?.hydraulicStatus,
      results.npshEvaluation?.status
    ) || '-';
    const statusRows = backendStatus ? [
      { type: 'section', label: 'Status' },
      { label: 'Hydraulic NPSH', title: 'Hydraulic cavitation/NPSH status only.', value: hydraulicStatus, unit: '' },
      { label: 'Backend Valid.', title: 'Protected backend validation status.', value: backendStatus, unit: '' }
    ] : [];

    const routeTrace = getAuditableRouteTrace(node);
    const suctionLossDisplay = formatRouteLossPair(routeTrace?.suctionLoss);
    const dischargeLossDisplay = formatRouteLossPair(routeTrace?.dischargeLoss);
    const routeRows = routeTrace ? [
      { type: 'section', label: 'Route Trace' },
      { label: 'Route', title: routeTrace.text || routeTrace.compactText, value: routeTrace.compactText || routeTrace.text, unit: '' },
      {
        label: 'Suction Loss',
        title: 'Suction loss subtracts directly from pump NPSHa.',
        value: suctionLossDisplay.value,
        unit: suctionLossDisplay.unit
      },
      {
        label: 'Disch. Loss',
        title: 'Discharge loss affects system head and outlet pressure, not direct pump suction NPSHa.',
        value: dischargeLossDisplay.value,
        unit: dischargeLossDisplay.unit
      }
    ] : [];

    return [...statusRows, ...normalized, ...routeRows];
  }

  function normalizeSourceRows(rows) {
    const normalized = cloneRows(rows);
    if (!Array.isArray(normalized)) return rows;
    normalized.forEach(row => {
      if (row?.label === 'Pump NPSHa') {
        row.label = 'NPSH at Pump';
        row.title = 'NPSH available at the connected pump suction.';
      }
    });
    return normalized;
  }

  function normalizeSinkRows(rows) {
    const normalized = cloneRows(rows);
    if (!Array.isArray(normalized)) return rows;
    normalized.forEach(row => {
      if (row?.label === 'NPSH Margin') {
        row.label = 'Pump NPSH Margin';
        row.title = 'Pump NPSH margin; this is a pump result shown at the downstream boundary for route closure.';
      }
      if (row?.label === 'NPSH Ratio') {
        row.label = 'Pump NPSH Ratio';
        row.title = 'Pump NPSH ratio; this is a pump result shown at the downstream boundary for route closure.';
      }
    });
    return normalized;
  }

  function patchRowBuilder(name, normalizer) {
    const original = root[name];
    if (typeof original !== 'function' || original.__captionAuditPatched) return false;
    function patchedRowBuilder() {
      return normalizer(original.apply(this, arguments), ...arguments);
    }
    patchedRowBuilder.__captionAuditPatched = true;
    root[name] = patchedRowBuilder;
    return true;
  }

  function installPipeCalculationFallbacks() {
    let installed = false;
    if (typeof root.calculatePipeHydraulicSegments !== 'function') {
      root.calculatePipeHydraulicSegments = calculatePipeHydraulicSegmentsFallback;
      installed = true;
    }
    if (typeof root.buildPipeCalculationTrace !== 'function') {
      root.buildPipeCalculationTrace = buildPipeCalculationTraceFallback;
      installed = true;
    }
    return installed;
  }

  function normalizeTextNode(node) {
    if (!node || node.nodeType !== 3 || !node.nodeValue) return;
    if (node.nodeValue.includes(BACKEND_OLD_WARNING)) {
      node.nodeValue = node.nodeValue.replace(BACKEND_OLD_WARNING, BACKEND_UNVERIFIED_WARNING);
    }
    node.nodeValue = node.nodeValue
      .replace(/\bNPSH Vapor Press\./g, 'Vapor Press. Used')
      .replace(/\bFluid Vapor Press\./g, 'Basis Vapor Press.');
  }

  function normalizeTextTree(rootNode) {
    if (!rootNode || typeof document === 'undefined') return;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      normalizeTextNode(node);
      node = walker.nextNode();
    }
  }

  function isIndonesianPumpDefenseUi() {
    if (typeof document === 'undefined') return false;
    return /Defense Formula Pompa|Jalankan atau refresh evaluasi NPSH/i.test(document.body?.innerText || '');
  }

  function pumpDefenseText(en, id) {
    return isIndonesianPumpDefenseUi() ? id : en;
  }

  function isPumpFormulaDefenseFallbackText(text = '') {
    return /Run or refresh the pump NPSH evaluation|Jalankan atau refresh evaluasi NPSH/i.test(String(text || ''));
  }

  function appendTextElement(parent, tagName, text, className = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text == null || text === '' ? '-' : String(text);
    parent.appendChild(element);
    return element;
  }

  function createPumpDefenseFallbackCard(title, child) {
    const card = document.createElement('section');
    card.className = 'fluid-help-card caption-audit-pump-defense-card';
    appendTextElement(card, 'h3', title);
    if (child) card.appendChild(child);
    return card;
  }

  function createPumpDefenseFallbackList(items = []) {
    const list = document.createElement('ul');
    list.className = 'fluid-help-list caption-audit-pump-defense-list';
    (items.length ? items : ['-']).forEach(item => appendTextElement(list, 'li', item));
    return list;
  }

  function formatPumpDefenseCell(value, unit = '', digits = 3) {
    if (value === null || value === undefined || value === '') return '-';
    const number = toNumber(value);
    const text = number === null ? String(value) : formatNumber(number, digits);
    return unit ? `${text} ${unit}` : text;
  }

  function createPumpDefenseFallbackTable(headers = [], rows = []) {
    const wrap = document.createElement('div');
    wrap.className = 'caption-audit-defense-table-wrap';
    const table = document.createElement('table');
    table.className = 'caption-audit-defense-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headers.forEach(header => appendTextElement(headRow, 'th', header));
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    (rows.length ? rows : [['-', '-', '-']]).forEach(row => {
      const tr = document.createElement('tr');
      row.forEach((cell, index) => {
        const td = document.createElement('td');
        td.dataset.label = headers[index] || '';
        td.textContent = cell == null || cell === '' ? '-' : String(cell);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function createPumpDefenseFallbackStepList(trace = {}) {
    const list = document.createElement('div');
    list.className = 'pump-formula-defense-formula-list academic-equation-list caption-audit-defense-step-list';
    const rows = Array.isArray(trace.academicDefense) && trace.academicDefense.length
      ? trace.academicDefense
      : buildFallbackPumpAcademicDefenseRows(trace);
    rows.forEach((row, index) => {
      const card = document.createElement('section');
      card.className = 'pump-curve-formula-card pump-formula-defense-card caption-audit-defense-step-card';
      appendTextElement(card, 'h4', `${index + 1}. ${row.step || 'Pump Calculation Step'}`);
      appendTextElement(card, 'code', row.formula || '-');
      appendTextElement(card, 'p', row.substitution || '-', 'pump-curve-formula-substitution');
      appendTextElement(card, 'p', `${formatPumpDefenseCell(row.result, row.unit || '')}`, 'pump-curve-formula-result');
      appendTextElement(card, 'p', `${row.literature || '-'} | Input: ${row.inputSource || '-'}`, 'pump-formula-defense-note');
      appendTextElement(card, 'p', row.defenseNote || '-', 'pump-formula-defense-note');
      list.appendChild(card);
    });
    return list;
  }

  function createPumpDefenseFallbackContent(pumpId = '') {
    const model = currentModel();
    const resolvedPumpId = resolvePumpId(pumpId);
    const pump = model?.[resolvedPumpId];
    const trace = ensurePumpNpshCalculationTrace(resolvedPumpId, model, currentConnections(), { skipEngine: true })
      || buildFallbackPumpCalculationTrace(resolvedPumpId, model, currentConnections());
    const evaluation = pump?.results?.npshEvaluation || {};
    const layout = document.createElement('div');
    layout.className = 'fluid-help-layout src-help-layout pump-formula-defense-layout caption-audit-pump-defense-fallback';
    if (!pump || !trace) {
      layout.appendChild(createPumpDefenseFallbackCard(
        pumpDefenseText('Pump Formula Defense', 'Defense Formula Pompa'),
        createPumpDefenseFallbackList([pumpDefenseText('Pump object or solved trace is not available.', 'Objek pompa atau trace hasil hitung belum tersedia.')])
      ));
      return layout;
    }

    layout.appendChild(createPumpDefenseFallbackCard(
      pumpDefenseText('Short Answer for Advisor', 'Jawaban Singkat untuk Penguji'),
      createPumpDefenseFallbackList([
        pumpDefenseText(
          'The previous placeholder appeared because the pump defense window could not find npshEvaluation.calculationTrace in the active frontend state.',
          'Placeholder sebelumnya muncul karena window defense pompa tidak menemukan npshEvaluation.calculationTrace pada state frontend aktif.'
        ),
        pumpDefenseText(
          'The trace below is rebuilt from the current Fluid Basis -> SRC -> suction PFV -> Pump -> discharge PFV -> SNK route and attached back to the pump result.',
          'Trace di bawah ini dibangun ulang dari route aktif Fluid Basis -> SRC -> PFV suction -> Pump -> PFV discharge -> SNK dan ditempelkan kembali ke hasil pompa.'
        )
      ])
    ));

    layout.appendChild(createPumpDefenseFallbackCard(
      pumpDefenseText('Route Trace', 'Route Trace'),
      createPumpDefenseFallbackTable(
        [
          pumpDefenseText('Stage', 'Tahap'),
          pumpDefenseText('Live Value', 'Nilai Aktif'),
          pumpDefenseText('Audit Source', 'Sumber Audit')
        ],
        [
          ['Fluid Basis', `${formatPumpDefenseCell(trace.basis?.density, 'kg/m3')} / ${formatPumpDefenseCell(trace.basis?.vaporPressureBarA, 'bar a', 6)}`, trace.basis?.fluidName || '-'],
          ['SRC', `${trace.boundary?.id || '-'} / ${formatPumpDefenseCell(trace.boundary?.absolutePressureBar, 'bar a', 6)}`, trace.boundary?.pressureInputBasis || '-'],
          ['Pipe/Fitting/Valve suction', formatPumpDefenseCell(trace.losses?.suction ?? trace.losses?.total, 'm'), trace.path?.text || '-'],
          ['Pump', `${formatPumpDefenseCell(trace.pump?.flow, 'm3/h')} / ${formatPumpDefenseCell(trace.pump?.head, 'm')}`, trace.pump?.npshrSource || '-'],
          ['Pipe/Fitting/Valve discharge', formatPumpDefenseCell(trace.losses?.discharge, 'm'), trace.path?.sinkId || '-'],
          ['SNK', trace.path?.sinkName || trace.path?.sinkId || '-', pumpDefenseText('Downstream boundary from route trace', 'Boundary downstream dari route trace')]
        ]
      )
    ));

    layout.appendChild(createPumpDefenseFallbackCard(
      pumpDefenseText('Current Calculation Summary', 'Ringkasan Perhitungan Aktif'),
      createPumpDefenseFallbackTable(
        [
          pumpDefenseText('Item', 'Item'),
          pumpDefenseText('Current Value', 'Nilai Aktif'),
          pumpDefenseText('Meaning', 'Makna')
        ],
        [
          ['NPSHa', formatPumpDefenseCell(evaluation.npsha ?? trace.steps?.find(step => step.title === 'NPSHa')?.result, 'm'), pumpDefenseText('System-derived available suction head.', 'Available suction head dari sistem.')],
          ['NPSHr', formatPumpDefenseCell(evaluation.npshr ?? trace.steps?.find(step => step.title === 'NPSHr')?.result, 'm'), pumpDefenseText('Pump-derived required NPSH.', 'Required NPSH dari data pompa.')],
          ['NPSH Margin', formatPumpDefenseCell(evaluation.npshMargin ?? trace.interpretation?.margin, 'm'), 'NPSHa - NPSHr'],
          ['Required NPSHa', formatPumpDefenseCell(evaluation.requiredNpsha ?? trace.interpretation?.requiredNpsha, 'm'), 'max(NPSHr x ratio, NPSHr + margin)'],
          ['Engineering Status', trace.interpretation?.engineeringStatus || evaluation.engineeringStatus || evaluation.status || '-', trace.interpretation?.engineeringMessage || evaluation.engineeringMessage || '-']
        ]
      )
    ));

    layout.appendChild(createPumpDefenseFallbackCard(
      pumpDefenseText('Formula Sequence & Active Substitution', 'Urutan Formula & Substitusi Aktif'),
      createPumpDefenseFallbackStepList(trace)
    ));

    layout.appendChild(createPumpDefenseFallbackCard(
      pumpDefenseText('Source & Confidence Map', 'Peta Sumber & Confidence'),
      createPumpDefenseFallbackTable(
        [
          pumpDefenseText('Parameter', 'Parameter'),
          pumpDefenseText('Current Value', 'Nilai Aktif'),
          pumpDefenseText('Source / Note', 'Sumber / Catatan')
        ],
        [
          ['Density', formatPumpDefenseCell(trace.basis?.density, 'kg/m3'), 'Fluid Basis'],
          ['Vapor Pressure', formatPumpDefenseCell(trace.basis?.vaporPressureBarA, 'bar a', 6), 'Fluid Basis'],
          ['Suction Loss', formatPumpDefenseCell(trace.losses?.suction ?? trace.losses?.total, 'm'), 'Pipe Object Properties / PFV trace'],
          ['Discharge Loss', formatPumpDefenseCell(trace.losses?.discharge, 'm'), 'Pipe Object Properties / PFV trace'],
          ['NPSHr Source', trace.pump?.npshrSource || '-', trace.interpretation?.dataConfidence || '-'],
          ['Margin Criteria', `${formatPumpDefenseCell(trace.interpretation?.marginRatioLimit)} ratio / ${formatPumpDefenseCell(trace.interpretation?.absoluteMarginLimit, 'm')}`, trace.interpretation?.marginBasis || '-']
        ]
      )
    ));

    layout.appendChild(createPumpDefenseFallbackCard(
      pumpDefenseText('Review Notes / Warnings', 'Catatan Review / Warning'),
      createPumpDefenseFallbackList(uniqueStrings([
        ...(Array.isArray(evaluation.notes) ? evaluation.notes : []),
        ...(Array.isArray(evaluation.warnings) ? evaluation.warnings : []),
        ...(Array.isArray(trace.limitations) ? trace.limitations : []),
        ...(Array.isArray(trace.assumptions) ? trace.assumptions : [])
      ]))
    ));
    return layout;
  }

  function replacePumpFormulaDefenseFallbackBody(body, pumpId = '') {
    if (!body || body.dataset.captionAuditPumpDefenseRefreshing === 'true') return false;
    const resolvedPumpId = resolvePumpId(pumpId || body.closest('.pump-formula-defense-task-window')?.dataset?.pumpNodeId || taskWindowPumpId());
    if (!resolvedPumpId) return false;
    body.dataset.captionAuditPumpDefenseRefreshing = 'true';
    try {
      ensurePumpNpshCalculationTrace(resolvedPumpId);
      let content = null;
      if (typeof root.createPumpFormulaDefenseContent === 'function' && !root.__captionAuditRenderingPumpDefenseFallback) {
        try {
          root.__captionAuditRenderingPumpDefenseFallback = true;
          content = root.createPumpFormulaDefenseContent(resolvedPumpId);
        } catch (error) {
          console.warn('Unable to render original pump formula defense content.', error);
        } finally {
          root.__captionAuditRenderingPumpDefenseFallback = false;
        }
      }
      if (!content || isPumpFormulaDefenseFallbackText(content.textContent || '')) {
        content = createPumpDefenseFallbackContent(resolvedPumpId);
      }
      body.replaceChildren(content);
      body.dataset.captionAuditPumpDefenseFallback = 'resolved';
      return true;
    } finally {
      delete body.dataset.captionAuditPumpDefenseRefreshing;
    }
  }

  function ensurePumpFormulaDefenseFallback(rootNode = document) {
    if (!rootNode || typeof document === 'undefined' || typeof rootNode.querySelectorAll !== 'function') return;
    const bodies = Array.from(document.querySelectorAll('.pump-formula-defense-task-window .pump-formula-defense-body, .pump-formula-defense-task-window .task-window-body'));
    bodies.forEach(body => {
      if (isPumpFormulaDefenseFallbackText(body.textContent || '')) {
        replacePumpFormulaDefenseFallbackBody(body);
      }
    });
  }

  function markAuditRows(rootNode = document) {
    if (!rootNode || typeof rootNode.querySelectorAll !== 'function') return;
    rootNode.querySelectorAll('.pump-live-param-row, .sink-live-param-row, .source-live-param-row').forEach(row => {
      const label = row.querySelector('.pump-live-param-label, .sink-live-param-label, .source-live-param-label')?.textContent || '';
      if (/Route|Backend Valid\.|Hydraulic NPSH|Suction Loss|Disch\. Loss|Pump NPSH/.test(label)) {
        row.classList.add('caption-audit-row');
      }
    });
    ensureDomRouteTraceRows(rootNode);
    ensureRouteSolvedVisualStatus(rootNode);
    ensureSourcePumpBridge(document);
    ensurePumpChartControls(rootNode);
    ensureInlinePumpPerformanceChart(rootNode);
    ensurePumpActionReadinessUi(rootNode);
    ensurePumpOptimizationProposalActionUi(rootNode);
    ensurePumpFormulaDefenseFallback(rootNode);
    hideEmptyCanvasWarningPanel();
  }

  function liveParamClass(panel, suffix) {
    if (panel.classList.contains('pump-live-params')) return `pump-live-param-${suffix}`;
    if (panel.classList.contains('source-live-params')) return `source-live-param-${suffix}`;
    if (panel.classList.contains('sink-live-params')) return `sink-live-param-${suffix}`;
    return `pump-live-param-${suffix}`;
  }

  function createLiveParamSection(panel, label) {
    const section = document.createElement('div');
    section.className = liveParamClass(panel, 'section');
    section.dataset.captionAuditRoute = 'true';
    section.textContent = label;
    return section;
  }

  function createLiveParamRow(panel, label, value, unit, title) {
    const row = document.createElement('div');
    row.className = `${liveParamClass(panel, 'row')} caption-audit-row`;
    row.dataset.captionAuditRoute = 'true';
    row.title = title || '';

    const labelNode = document.createElement('span');
    labelNode.className = liveParamClass(panel, 'label');
    labelNode.textContent = label;

    const valueNode = document.createElement('strong');
    valueNode.className = liveParamClass(panel, 'value');
    valueNode.textContent = value || '-';

    const unitNode = document.createElement('span');
    unitNode.className = liveParamClass(panel, 'unit');
    unitNode.textContent = unit || '';

    row.append(labelNode, valueNode, unitNode);
    return row;
  }

  function findLiveParamRow(panel, labelText) {
    if (!panel) return null;
    const rows = Array.from(panel.querySelectorAll('.pump-live-param-row, .source-live-param-row, .sink-live-param-row'));
    return rows.find(candidate => candidate.querySelector('[class$="-label"]')?.textContent?.trim() === labelText) || null;
  }

  function updateLiveParamRow(panel, labelText, value, unit, title) {
    const row = findLiveParamRow(panel, labelText);
    if (!row) return false;
    const valueNode = row.querySelector('[class$="-value"]');
    const unitNode = row.querySelector('[class$="-unit"]');
    if (valueNode && valueNode.textContent !== String(value || '-')) valueNode.textContent = value || '-';
    if (unitNode && unitNode.textContent !== String(unit || '')) unitNode.textContent = unit || '';
    if (title !== undefined) row.title = title || '';
    row.classList.add('caption-audit-row');
    row.dataset.captionAuditRoute = 'true';
    return true;
  }

  function upsertLiveParamRow(panel, label, value, unit, title) {
    if (updateLiveParamRow(panel, label, value, unit, title)) return;
    panel.append(createLiveParamRow(panel, label, value, unit, title));
  }

  function firstCanvasObjectId(type) {
    return document.querySelector(`.pfd-object.object-type-${type}`)?.dataset?.id || '';
  }

  function ensureDomRouteTraceRows(rootNode = document) {
    removeCanvasAuditRows(rootNode);
  }

  function canvasPumpStatus(pumpElement) {
    if (!pumpElement) return '';
    if (pumpElement.classList.contains('pump-status-risk')) return 'risk';
    if (pumpElement.classList.contains('pump-status-warning')) return 'warning';
    if (pumpElement.classList.contains('pump-status-safe')) return 'safe';
    return String(pumpElement.dataset.operatingStatus || '').toLowerCase();
  }

  function findLiveParamValue(panel, labelText) {
    if (!panel) return { value: '', unit: '' };
    const row = findLiveParamRow(panel, labelText);
    return {
      value: row?.querySelector('[class$="-value"]')?.textContent?.trim() || '',
      unit: row?.querySelector('[class$="-unit"]')?.textContent?.trim() || ''
    };
  }

  function setLiveParamValue(panel, labelText, value, unit, force = false) {
    if (!panel || !value || value === '-') return false;
    const rows = Array.from(panel.querySelectorAll('.pump-live-param-row, .source-live-param-row, .sink-live-param-row'));
    const row = rows.find(candidate => candidate.querySelector('[class$="-label"]')?.textContent?.trim() === labelText);
    if (!row) return false;
    const valueNode = row.querySelector('[class$="-value"]');
    const unitNode = row.querySelector('[class$="-unit"]');
    if (valueNode && (force || !valueNode.textContent.trim() || valueNode.textContent.trim() === '-')) valueNode.textContent = value;
    if (unitNode && unit && (force || !unitNode.textContent.trim() || unitNode.textContent.trim() === '-')) unitNode.textContent = unit;
    row.classList.add('caption-audit-row');
    return true;
  }

  function renameLiveParamRow(panel, fromLabel, toLabel, title = '') {
    const row = findLiveParamRow(panel, fromLabel);
    if (!row) return false;
    const labelNode = row.querySelector('[class$="-label"]');
    if (labelNode) labelNode.textContent = toLabel;
    if (title) row.title = title;
    return true;
  }

  function removeCanvasAuditRows(rootNode = document) {
    if (!rootNode || typeof rootNode.querySelectorAll !== 'function') return;
    rootNode
      .querySelectorAll('.object-type-pump .pump-live-params [data-caption-audit-route="true"], .object-type-pump .pump-live-params [data-caption-audit-chart-control="true"]')
      .forEach(row => row.remove());
    const removableLabels = new Set(['Route', 'Suction Loss', 'Disch. Loss', 'Suction Side', 'Disch. Side', 'Pump Chart']);
    rootNode.querySelectorAll('.object-type-pump .pump-live-params').forEach(panel => {
      panel.querySelectorAll('.pump-live-param-section').forEach(section => {
        if (/^route trace$/i.test(section.textContent?.trim() || '')) section.remove();
      });
      panel.querySelectorAll('.pump-live-param-row').forEach(row => {
        const label = row.querySelector('.pump-live-param-label')?.textContent?.trim() || '';
        if (removableLabels.has(label)) row.remove();
      });
    });
  }

  function pumpHydraulicVisualStatus(pump = {}) {
    const results = pump.results || {};
    const margin = firstFiniteNumber(results.npshMargin, results.npshEvaluation?.npshMargin);
    const statusText = [
      results.hydraulicNpshStatus,
      results.npshEvaluation?.hydraulicStatus,
      results.npshEvaluation?.status,
      results.cavitationStatus
    ].map(value => String(value || '').toLowerCase()).join(' ');
    if (/risk|cavitation|fail|unsafe/.test(statusText) || (margin !== null && margin < 0)) return 'risk';
    if (/warning|review/.test(statusText)) return 'warning';
    if (/safe|ok/.test(statusText) || results.npshEvaluation?.hydraulicOk === true || (margin !== null && margin >= 0)) return 'safe';
    return '';
  }

  function setLivePanelStatus(panel, type, status) {
    if (!panel || !type || !status) return;
    panel.classList.remove(
      `${type}-live-params-incomplete`,
      `${type}-live-params-safe`,
      `${type}-live-params-warning`,
      `${type}-live-params-risk`
    );
    panel.classList.add(`${type}-live-params-${status}`);
  }

  function setObjectVisualStatus(element, type, status) {
    if (!element || !type || !status) return;
    element.dataset.operatingStatus = status;
    element.classList.remove(
      `${type}-status-incomplete`,
      `${type}-status-safe`,
      `${type}-status-warning`,
      `${type}-status-risk`
    );
    element.classList.add(`${type}-status-${status}`);
    setLivePanelStatus(element.querySelector(`.${type}-live-params`), type, status);
    const badge = element.querySelector('.pump-status-badge');
    if (badge && type === 'pump') {
      badge.classList.remove('pump-status-badge-incomplete', 'pump-status-badge-safe', 'pump-status-badge-warning', 'pump-status-badge-risk');
      badge.classList.add(`pump-status-badge-${status}`);
      badge.textContent = status === 'risk' ? 'Risk' : (status === 'warning' ? 'Warning' : 'Safe');
    }
  }

  function selectorEscape(value) {
    if (root.CSS && typeof root.CSS.escape === 'function') return root.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function ensureRouteSolvedVisualStatus(rootNode = document) {
    if (!rootNode || typeof document === 'undefined') return;
    const model = currentModel();
    Object.keys(model || {}).forEach(pumpId => {
      const pump = model[pumpId];
      if (!pump || pump.type !== 'pump') return;
      const status = pumpHydraulicVisualStatus(pump);
      if (!status) return;
      const routeTrace = getAuditableRouteTrace(pump);
      if (!routeHasCompletePumpPath(routeTrace)) return;
      const objectIds = uniqueStrings([...(routeTrace.suction || []), ...(routeTrace.discharge || [])]);
      objectIds.forEach(objectId => {
        const node = model[objectId];
        const element = document.querySelector(`.pfd-object[data-id="${selectorEscape(objectId)}"]`);
        if (!node || !element) return;
        if (['source', 'pump', 'sink'].includes(node.type)) {
          setObjectVisualStatus(element, node.type, status);
        }
      });
    });
  }

  function hideEmptyCanvasWarningPanel() {
    if (typeof document === 'undefined') return;
    const panel = document.querySelector('.canvas-warning-panel');
    if (!panel) return;
    const text = String(panel.innerText || '').replace(/\s+/g, ' ').trim();
    const isEmpty = /^Warnings\s*0\s*-?$/i.test(text) || /^Peringatan\s*0\s*-?$/i.test(text);
    if (isEmpty) {
      panel.dataset.captionAuditEmpty = 'true';
      panel.style.display = 'none';
    } else if (panel.dataset.captionAuditEmpty === 'true') {
      delete panel.dataset.captionAuditEmpty;
      panel.style.display = '';
    }
  }

  function ensureSourcePumpBridge(rootNode = document) {
    if (!rootNode || typeof document === 'undefined') return;
    const pumpElement = document.querySelector('.pfd-object.object-type-pump');
    const pumpPanel = pumpElement?.querySelector('.pump-live-params');
    const pumpStatus = canvasPumpStatus(pumpElement);
    const pumpId = pumpElement?.dataset?.id || 'pump';
    if (!pumpElement || !pumpPanel || !['safe', 'warning', 'risk'].includes(pumpStatus)) return;
    const npsha = findLiveParamValue(pumpPanel, 'NPSH Available');
    const routeTrace = getAuditableRouteTrace(currentModel()[pumpId]);
    const suctionLossHead = routeTrace?.suctionLoss?.headLoss;
    const suctionLossValue = suctionLossHead === null || suctionLossHead === undefined ? '' : formatNumber(suctionLossHead, 1);
    const suctionLossUnit = getDisplayUnit('head', 'm');

    rootNode.querySelectorAll?.('.pfd-object.object-type-source').forEach(sourceElement => {
      const sourcePanel = sourceElement.querySelector('.source-live-params');
      if (!sourcePanel) return;

      sourceElement.dataset.operatingStatus = pumpStatus;
      sourcePanel.classList.remove(
        'source-live-params-incomplete',
        'source-live-params-safe',
        'source-live-params-warning',
        'source-live-params-risk'
      );
      sourcePanel.classList.add(`source-live-params-${pumpStatus}`);
      sourcePanel.dataset.captionAuditPumpBridge = 'true';
      renameLiveParamRow(sourcePanel, 'Pump NPSHa', 'NPSH at Pump', 'NPSH available at the connected pump suction.');
      if (suctionLossValue) setLiveParamValue(sourcePanel, 'Suction Loss', suctionLossValue, suctionLossUnit, true);
      if (!setLiveParamValue(sourcePanel, 'NPSH at Pump', npsha.value, npsha.unit, true)) {
        upsertLiveParamRow(sourcePanel, 'NPSH at Pump', npsha.value, npsha.unit, 'NPSH available at the connected pump suction.');
      }

      const currentTitle = sourceElement.getAttribute('title') || '';
      if (/No solved pump suction path/.test(currentTitle)) {
        sourceElement.setAttribute(
          'title',
          currentTitle
            .replace('No solved pump suction path', `Contributing to ${pumpId}`)
            .replace(/\nAdd a valid hydraulic path from SRC or attached equipment to pump suction to solve NPSHa@P\./, '')
        );
      }
    });
  }

  function validPumpCurvePoints(pump = {}) {
    const points = Array.isArray(pump.props?.curveData) ? pump.props.curveData : [];
    return points
      .map(point => ({
        flow: toNumber(point.flow),
        head: toNumber(point.head),
        eff: toNumber(point.eff),
        npshr: toNumber(point.npshr)
      }))
      .filter(point => point.flow !== null && point.head !== null)
      .sort((a, b) => a.flow - b.flow);
  }

  function fallbackPumpCurvePoints(pump = {}) {
    const results = pump.results || {};
    const props = pump.props || {};
    const flow = positiveNumber(results.flow, positiveNumber(props.designFlow, 50));
    const head = positiveNumber(results.head, positiveNumber(props.designHead, 10));
    const eff = positiveNumber(results.efficiency, positiveNumber(props.designEfficiency, 60));
    const npshr = positiveNumber(results.npshr, positiveNumber(props.designNpshr, 1));
    return [
      { flow: 0, head: head * 1.15, eff: 0, npshr: Math.max(0.1, npshr * 0.65) },
      { flow: flow * 0.7, head: head * 1.08, eff: Math.max(1, eff * 0.9), npshr: Math.max(0.1, npshr * 0.85) },
      { flow, head, eff, npshr },
      { flow: flow * 1.3, head: head * 0.82, eff: Math.max(1, eff * 0.85), npshr: npshr * 1.35 }
    ];
  }

  function normalizeCurveSeries(points = [], valueKeys = ['head']) {
    return points
      .map(point => {
        const flow = firstFiniteNumber(point.flow, point.q, point.x, point.flowM3H);
        const value = valueKeys.reduce((found, key) => found ?? firstFiniteNumber(point[key]), null);
        return flow !== null && value !== null ? { flow, value } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.flow - b.flow);
  }

  function generatedSystemCurve(pump = {}, maxFlow = 100) {
    const results = pump.results || {};
    const opFlow = positiveNumber(results.flow, positiveNumber(pump.props?.designFlow, maxFlow * 0.75));
    const dutyHead = positiveNumber(results.requiredSystemHead, positiveNumber(results.head, positiveNumber(pump.props?.designHead, 10)));
    const staticHead = Math.max(0, Math.min(dutyHead * 0.6, dutyHead - 0.001));
    const dynamic = Math.max(0, dutyHead - staticHead);
    const points = [];
    for (let i = 0; i <= 8; i += 1) {
      const flow = (maxFlow * i) / 8;
      const ratio = opFlow > 0 ? flow / opFlow : 0;
      points.push({ flow, value: staticHead + dynamic * ratio * ratio });
    }
    return points;
  }

  function generatedNpshaCurve(pump = {}, maxFlow = 100) {
    const results = pump.results || {};
    const opFlow = positiveNumber(results.flow, positiveNumber(pump.props?.designFlow, maxFlow * 0.75));
    const npsha = positiveNumber(results.npsha, 0);
    const suctionLoss = positiveNumber(getAuditableRouteTrace(pump)?.suctionLoss?.headLoss, positiveNumber(results.suctionLoss, 0));
    const points = [];
    for (let i = 0; i <= 8; i += 1) {
      const flow = (maxFlow * i) / 8;
      const ratio = opFlow > 0 ? flow / opFlow : 0;
      points.push({ flow, value: Math.max(0, npsha + suctionLoss - suctionLoss * ratio * ratio) });
    }
    return points;
  }

  function buildPumpPerformanceAuditData(pumpId) {
    const model = root.__npshGlobalModel || root.globalModel || {};
    const pump = model[pumpId];
    if (!pump || pump.type !== 'pump') return null;
    const results = pump.results || {};
    const props = pump.props || {};
    const rawCurve = validPumpCurvePoints(pump);
    const curve = rawCurve.length >= 2 ? rawCurve : fallbackPumpCurvePoints(pump);
    const opFlow = positiveNumber(results.flow, positiveNumber(props.designFlow, curve[1]?.flow || curve[0]?.flow || 0));
    const opHead = positiveNumber(results.head, positiveNumber(props.designHead, curve.find(point => point.flow >= opFlow)?.head || curve[0]?.head || 0));
    const maxFlow = Math.max(opFlow * 1.35, ...curve.map(point => point.flow), 1);
    const pumpHead = normalizeCurveSeries(curve, ['head']);
    const npshr = normalizeCurveSeries(curve, ['npshr']).filter(point => point.value > 0);
    const system = normalizeCurveSeries(results.systemCurvePoints || results.sysCurve || [], ['head', 'systemHead', 'requiredHead', 'value'])
      .concat([])
      .filter(Boolean);
    const npsha = normalizeCurveSeries(results.npshCurvePoints || [], ['npsha', 'availableNpsh', 'value']);
    const routeTrace = getAuditableRouteTrace(pump);
    return {
      pumpId,
      pump,
      source: rawCurve.length >= 2 ? (props.curveDataSource || results.curveDataSource || 'Pump curve data') : 'Generated audit fit from duty point',
      confidence: results.curveDataConfidence || results.dataConfidence || props.curveFitCompleteness || '-',
      freshness: results.calculationFreshness || routeTrace?.lossFreshness || '-',
      flowUnit: getDisplayUnit('flow', 'm3/h'),
      headUnit: getDisplayUnit('head', 'm'),
      op: {
        flow: opFlow,
        head: opHead,
        npsha: positiveNumber(results.npsha, 0),
        npshr: positiveNumber(results.npshr, positiveNumber(props.designNpshr, 0)),
        margin: toNumber(results.npshMargin)
      },
      regions: {
        bepFlow: positiveNumber(props.bepFlow, positiveNumber(props.designFlow, opFlow)),
        porMin: positiveNumber(props.porMinPercent, 0),
        porMax: positiveNumber(props.porMaxPercent, 0),
        aorMin: positiveNumber(props.aorMinPercent, 0),
        aorMax: positiveNumber(props.aorMaxPercent, 0)
      },
      series: {
        pumpHead,
        system: system.length >= 2 ? system : generatedSystemCurve(pump, maxFlow),
        npsha: npsha.length >= 2 ? npsha : generatedNpshaCurve(pump, maxFlow),
        npshr
      },
      warnings: [
        ...(rawCurve.length >= 2 ? [] : ['Pump curve is generated from duty point because curve data is incomplete.']),
        ...(Array.isArray(results.modelWarnings) ? results.modelWarnings : []),
        ...(Array.isArray(results.warnings) ? results.warnings : [])
      ].filter(Boolean)
    };
  }

  function canvasPoint(point, scale) {
    return {
      x: scale.left + ((point.flow - scale.xMin) / Math.max(scale.xMax - scale.xMin, 1e-9)) * scale.width,
      y: scale.top + scale.height - ((point.value - scale.yMin) / Math.max(scale.yMax - scale.yMin, 1e-9)) * scale.height
    };
  }

  function uniqueSortedChartPoints(points = []) {
    const rows = points
      .map(point => ({ flow: toNumber(point.flow), value: toNumber(point.value) }))
      .filter(point => point.flow !== null && point.value !== null)
      .sort((a, b) => a.flow - b.flow);
    return rows.filter((point, index) => index === 0 || Math.abs(point.flow - rows[index - 1].flow) > 1e-9);
  }

  function pchipEndpointSlope(h0, h1, d0, d1) {
    if (!Number.isFinite(h1) || !Number.isFinite(d1)) return d0;
    let slope = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (Math.sign(slope) !== Math.sign(d0)) slope = 0;
    else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(slope) > Math.abs(3 * d0)) slope = 3 * d0;
    return slope;
  }

  function smoothChartSeries(points = [], samplesPerSegment = 18) {
    const rows = uniqueSortedChartPoints(points);
    if (rows.length < 3) return rows;
    const h = [];
    const delta = [];
    for (let i = 0; i < rows.length - 1; i += 1) {
      const width = rows[i + 1].flow - rows[i].flow;
      if (!(width > 0)) return rows;
      h.push(width);
      delta.push((rows[i + 1].value - rows[i].value) / width);
    }

    const slopes = new Array(rows.length).fill(0);
    slopes[0] = pchipEndpointSlope(h[0], h[1], delta[0], delta[1]);
    slopes[rows.length - 1] = pchipEndpointSlope(h[h.length - 1], h[h.length - 2], delta[delta.length - 1], delta[delta.length - 2]);
    for (let i = 1; i < rows.length - 1; i += 1) {
      if (delta[i - 1] === 0 || delta[i] === 0 || Math.sign(delta[i - 1]) !== Math.sign(delta[i])) {
        slopes[i] = 0;
      } else {
        const w1 = 2 * h[i] + h[i - 1];
        const w2 = h[i] + 2 * h[i - 1];
        slopes[i] = (w1 + w2) / ((w1 / delta[i - 1]) + (w2 / delta[i]));
      }
    }

    const smooth = [];
    for (let segment = 0; segment < rows.length - 1; segment += 1) {
      const start = rows[segment];
      const end = rows[segment + 1];
      const width = h[segment];
      const localMin = Math.min(start.value, end.value);
      const localMax = Math.max(start.value, end.value);
      for (let sample = segment === 0 ? 0 : 1; sample <= samplesPerSegment; sample += 1) {
        const t = sample / samplesPerSegment;
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;
        const value = h00 * start.value
          + h10 * width * slopes[segment]
          + h01 * end.value
          + h11 * width * slopes[segment + 1];
        smooth.push({
          flow: start.flow + t * width,
          value: clampChartText(value, localMin, localMax)
        });
      }
    }
    return smooth;
  }

  function drawSeries(ctx, scale, points, color, label, dash = []) {
    const displayPoints = smoothChartSeries(points);
    if (!displayPoints || displayPoints.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(scale.left, scale.top, scale.width, scale.height);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    displayPoints.forEach((point, index) => {
      const p = canvasPoint(point, scale);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function niceChartMax(value) {
    const number = positiveNumber(value, 1);
    const exponent = Math.floor(Math.log10(number));
    const base = Math.pow(10, exponent);
    const normalized = number / base;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * base;
  }

  function clampChartText(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function drawChartLegend(ctx, items, x, y) {
    ctx.save();
    ctx.font = '10.5px Segoe UI, sans-serif';
    ctx.textBaseline = 'middle';
    let cursorX = x;
    let cursorY = y;
    items.forEach((item, index) => {
      const textWidth = ctx.measureText(item.label).width;
      if (index > 0 && cursorX + textWidth + 34 > x + 290) {
        cursorX = x;
        cursorY += 18;
      }
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(item.dash || []);
      ctx.beginPath();
      ctx.moveTo(cursorX, cursorY);
      ctx.lineTo(cursorX + 22, cursorY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#334155';
      ctx.fillText(item.label, cursorX + 27, cursorY);
      cursorX += textWidth + 56;
    });
    ctx.restore();
  }

  function drawChartFooter(ctx, lines, x, y, maxWidth) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 4, y - 12, maxWidth + 8, 52);
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#334155';
    lines.forEach((line, index) => {
      let text = String(line || '-');
      while (ctx.measureText(text).width > maxWidth && text.length > 16) {
        text = `${text.slice(0, -4)}...`;
      }
      ctx.fillText(text, x, y + index * 12);
    });
    ctx.restore();
  }

  function drawRegionBand(ctx, scale, minFlow, maxFlow, color, label) {
    if (!(minFlow > 0) || !(maxFlow > minFlow)) return;
    const x1 = scale.left + ((minFlow - scale.xMin) / Math.max(scale.xMax - scale.xMin, 1e-9)) * scale.width;
    const x2 = scale.left + ((maxFlow - scale.xMin) / Math.max(scale.xMax - scale.xMin, 1e-9)) * scale.width;
    const left = Math.max(scale.left, Math.min(x1, x2));
    const right = Math.min(scale.left + scale.width, Math.max(x1, x2));
    if (right <= scale.left || left >= scale.left + scale.width) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(left, scale.top, right - left, scale.height);
    ctx.fillStyle = '#475569';
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.fillText(label, left + 4, scale.top + 12);
    ctx.restore();
  }

  function drawPumpPerformanceCanvas(pumpId, canvasOverride = null) {
    const canvas = typeof canvasOverride === 'string'
      ? document.getElementById(canvasOverride)
      : (canvasOverride || document.getElementById('pumpChart'));
    const data = buildPumpPerformanceAuditData(pumpId);
    if (!canvas || !data) return false;
    const wrap = canvas.parentElement;
    const cssWidth = Math.max(520, Math.floor(wrap?.clientWidth || 760));
    const cssHeight = Math.max(360, Math.floor(wrap?.clientHeight || 440));
    const dpr = Math.max(1, Math.min(2, root.devicePixelRatio || 1));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const legendItems = [
      { label: 'Pump Head', color: '#1c4568' },
      { label: 'System Curve', color: '#dc2626', dash: [5, 5] },
      { label: 'NPSHa', color: '#0f766e' },
      { label: 'NPSHr', color: '#b45309' }
    ];
    const allValues = [
      ...data.series.pumpHead.map(point => point.value),
      ...data.series.system.map(point => point.value),
      ...data.series.npsha.map(point => point.value),
      ...data.series.npshr.map(point => point.value),
      data.op.head,
      data.op.npsha,
      data.op.npshr
    ].filter(value => Number.isFinite(value));
    const allFlows = [
      ...data.series.pumpHead.map(point => point.flow),
      ...data.series.system.map(point => point.flow),
      ...data.series.npsha.map(point => point.flow),
      ...data.series.npshr.map(point => point.flow),
      data.op.flow
    ].filter(value => Number.isFinite(value));
    const footerLines = [
      `Source: ${data.source}`,
      `Confidence: ${data.confidence}`,
      `Freshness: ${data.freshness}`,
      data.warnings.length ? `Review: ${data.warnings[0]}` : 'Review: OK'
    ];
    const plotBottom = Math.max(104, Math.min(112, cssHeight * 0.26));
    const scale = {
      left: 72,
      top: 78,
      width: cssWidth - 104,
      height: cssHeight - 78 - plotBottom,
      xMin: 0,
      xMax: Math.max(...allFlows, 1) * 1.08,
      yMin: 0,
      yMax: niceChartMax(Math.max(...allValues, 1) * 1.08)
    };

    ctx.fillStyle = '#123b5a';
    ctx.font = '700 14px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Pump Performance Chart - ${data.pumpId}`, 16, 24);
    drawChartLegend(ctx, legendItems, Math.max(320, cssWidth - 392), 20);

    drawRegionBand(ctx, scale, data.regions.bepFlow * data.regions.aorMin / 100, data.regions.bepFlow * data.regions.aorMax / 100, 'rgba(148,163,184,.12)', 'AOR');
    drawRegionBand(ctx, scale, data.regions.bepFlow * data.regions.porMin / 100, data.regions.bepFlow * data.regions.porMax / 100, 'rgba(18,165,107,.12)', 'POR');

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scale.left, scale.top);
    ctx.lineTo(scale.left, scale.top + scale.height);
    ctx.lineTo(scale.left + scale.width, scale.top + scale.height);
    ctx.stroke();
    ctx.fillStyle = '#334155';
    ctx.font = '12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i <= 5; i += 1) {
      const flow = scale.xMax * i / 5;
      const x = scale.left + scale.width * i / 5;
      ctx.strokeStyle = '#eef2f7';
      ctx.beginPath();
      ctx.moveTo(x, scale.top);
      ctx.lineTo(x, scale.top + scale.height);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.fillText(formatNumber(toDisplayQuantity(flow, 'flow'), 1), x, scale.top + scale.height + 18);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i += 1) {
      const value = scale.yMax * i / 5;
      const y = scale.top + scale.height - scale.height * i / 5;
      ctx.strokeStyle = '#eef2f7';
      ctx.beginPath();
      ctx.moveTo(scale.left, y);
      ctx.lineTo(scale.left + scale.width, y);
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.fillText(formatNumber(toDisplayQuantity(value, 'head'), 1), scale.left - 10, y);
    }

    drawSeries(ctx, scale, data.series.pumpHead, '#1c4568', 'Pump Head');
    drawSeries(ctx, scale, data.series.system, '#dc2626', 'System Curve', [5, 5]);
    drawSeries(ctx, scale, data.series.npsha, '#0f766e', 'NPSHa');
    drawSeries(ctx, scale, data.series.npshr, '#b45309', 'NPSHr');

    const op = canvasPoint({ flow: data.op.flow, value: data.op.head }, scale);
    ctx.fillStyle = '#12A56B';
    ctx.beginPath();
    ctx.arc(op.x, op.y, 5, 0, Math.PI * 2);
    ctx.fill();
    const dutyLabelX = clampChartText(op.x + 10, scale.left + 8, scale.left + scale.width - 72);
    const dutyLabelY = clampChartText(op.y - 10, scale.top + 14, scale.top + scale.height - 10);
    ctx.font = '700 11px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,.86)';
    ctx.fillRect(dutyLabelX - 3, dutyLabelY - 8, 68, 16);
    ctx.fillStyle = '#12A56B';
    ctx.fillText('Duty Point', dutyLabelX, dutyLabelY);

    ctx.fillStyle = '#475569';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Flow (${data.flowUnit})`, scale.left + scale.width / 2, scale.top + scale.height + 48);
    ctx.save();
    ctx.translate(24, scale.top + scale.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Head / NPSH (${data.headUnit})`, 0, 0);
    ctx.restore();

    drawChartFooter(ctx, footerLines, scale.left, cssHeight - 48, Math.max(260, scale.width - 8));
    return true;
  }

  function openPumpPerformanceAuditChart(pumpId) {
    const editor = document.getElementById('fullEditor');
    if (!editor || !pumpId) return null;
    root.__captionAuditActivePumpChartId = pumpId;
    editor.style.display = 'flex';
    editor.classList.remove('task-window-minimized');
    editor.setAttribute('aria-expanded', 'true');
    const title = document.getElementById('editorTitle');
    if (title) title.textContent = `Pump Performance Curve - ${pumpId}`;
    bindPumpPerformanceAuditWindowControls();
    drawPumpPerformanceCanvas(pumpId);
    return editor;
  }

  function bindPumpPerformanceAuditWindowControls() {
    if (root.__captionAuditPumpChartWindowBound || typeof document === 'undefined') return;
    root.__captionAuditPumpChartWindowBound = true;
    document.addEventListener('pointerdown', event => {
      if (!event.target?.closest?.('.caption-audit-chart-btn')) return;
      event.stopPropagation();
    }, true);
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('.caption-audit-chart-btn');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const pumpId = button.closest('.pfd-object.object-type-pump')?.dataset?.id || firstCanvasObjectId('pump');
      openPumpPerformanceAuditChart(pumpId);
    }, true);
    document.getElementById('closeEditor')?.addEventListener('click', event => {
      event.preventDefault();
      const editor = document.getElementById('fullEditor');
      if (editor) editor.style.display = 'none';
    });
    document.getElementById('minimizeEditor')?.addEventListener('click', event => {
      event.preventDefault();
      const editor = document.getElementById('fullEditor');
      if (!editor) return;
      editor.classList.toggle('task-window-minimized');
    });
    root.addEventListener?.('resize', () => {
      if (document.getElementById('fullEditor')?.style.display !== 'none' && root.__captionAuditActivePumpChartId) {
        root.setTimeout?.(() => drawPumpPerformanceCanvas(root.__captionAuditActivePumpChartId), 80);
      }
    });
  }

  function ensurePumpChartControls(rootNode = document) {
    removeCanvasAuditRows(rootNode);
  }

  function taskWindowPumpId() {
    const bodyText = document.getElementById('taskWindowBody')?.innerText || '';
    const explicit = bodyText.match(/\bP-\d+\b/i)?.[0];
    return explicit || firstCanvasObjectId('pump') || '';
  }

  function pumpActionReason(action = {}) {
    const reasons = action.blockedReasons?.length ? action.blockedReasons : action.warnings;
    return uniqueStrings(reasons || []).join(' | ') || action.status || 'Ready';
  }

  function createReadinessRow(label, value, detail) {
    const row = document.createElement('div');
    row.className = 'caption-audit-action-row';
    if (detail) row.title = detail;
    const labelNode = document.createElement('span');
    labelNode.textContent = label;
    const valueNode = document.createElement('strong');
    valueNode.textContent = value || '-';
    row.append(labelNode, valueNode);
    return row;
  }

  function proposalButtonReadiness(contract = {}, actionName = '') {
    const actions = contract.actions || {};
    if (actionName === 'apply') return actions.applyPumpOptimizationProposal || {};
    if (actionName === 'restore') return actions.restorePumpOptimizationPreviousInputs || {};
    if (actionName === 'clear') return actions.clearPumpOptimizationProposal || {};
    return {};
  }

  function updatePumpProposalActionButtons(body, pumpId, contract) {
    if (!body || !contract?.actions) return;
    body.querySelectorAll('[data-pump-optimization-action]').forEach(button => {
      const actionName = button.dataset.pumpOptimizationAction || '';
      const readiness = proposalButtonReadiness(contract, actionName);
      if (!readiness.label) return;
      button.dataset.node = pumpId;
      button.disabled = !readiness.canRun;
      button.toggleAttribute('disabled', !readiness.canRun);
      button.title = pumpActionReason(readiness);
      button.textContent = readiness.label;
      button.dataset.captionAuditReadiness = readiness.canRun ? 'ready' : 'blocked';
    });
  }

  function updatePumpActionButtons(body, pumpId, contract) {
    if (!body || !contract?.actions) return;
    const evaluate = contract.actions.evaluateNpshFromNetwork || {};
    const fit = contract.actions.buildEngineeringFitFromVendorJournalDutyData || {};

    const networkButton = body.querySelector('#btnOptimizePumpFromNetwork');
    if (networkButton) {
      networkButton.disabled = !evaluate.canRun;
      networkButton.toggleAttribute('disabled', !evaluate.canRun);
      networkButton.title = pumpActionReason(evaluate);
      if (evaluate.label) networkButton.textContent = evaluate.label;
      networkButton.dataset.captionAuditReadiness = evaluate.canRun ? 'ready' : 'blocked';
    }

    const buildButton = body.querySelector('#btnBuildPumpEngineeringFit');
    if (buildButton) {
      buildButton.disabled = !fit.canRun;
      buildButton.toggleAttribute('disabled', !fit.canRun);
      buildButton.title = pumpActionReason(fit);
      if (fit.label) buildButton.textContent = fit.label;
      buildButton.dataset.captionAuditReadiness = fit.canRun ? 'ready' : 'blocked';
    }

    const supplemental = body.querySelector('[data-caption-audit-action="engineering-fit"]');
    if (supplemental) {
      supplemental.dataset.node = pumpId;
      supplemental.disabled = !fit.canRun;
      supplemental.toggleAttribute('disabled', !fit.canRun);
      supplemental.title = pumpActionReason(fit);
      supplemental.textContent = fit.label || 'Build Engineering Fit From Vendor/Journal Duty Data';
      supplemental.dataset.captionAuditReadiness = fit.canRun ? 'ready' : 'blocked';
      supplemental.hidden = !!buildButton;
    }

    updatePumpProposalActionButtons(body, pumpId, contract);
  }

  function renderPumpActionReadinessPanel(panel, pumpId, contract) {
    const evaluate = contract.actions.evaluateNpshFromNetwork || {};
    const fit = contract.actions.buildEngineeringFitFromVendorJournalDutyData || {};
    const applyProposal = contract.actions.applyPumpOptimizationProposal || {};
    const restoreInputs = contract.actions.restorePumpOptimizationPreviousInputs || {};
    const clearProposal = contract.actions.clearPumpOptimizationProposal || {};
    const header = document.createElement('div');
    header.className = 'caption-audit-action-head';
    const title = document.createElement('h3');
    title.textContent = 'Pump Action Readiness';
    const meta = document.createElement('span');
    meta.textContent = contract.source || 'frontend-runtime';
    header.append(title, meta);

    const rows = document.createElement('div');
    rows.className = 'caption-audit-action-grid';
    rows.append(
      createReadinessRow('Backend Contract', contract.backendContract ? 'Connected' : 'Fallback runtime', contract.backendContract ? 'Backend action readiness was received or retained on pump results.' : 'Frontend runtime is using visible route/results until backend action readiness is returned.'),
      createReadinessRow('Route Trace', contract.routeTraceStatus || '-', ''),
      createReadinessRow('Evaluate Network', evaluate.status || '-', pumpActionReason(evaluate)),
      createReadinessRow('Engineering Fit', fit.status || '-', pumpActionReason(fit)),
      createReadinessRow('Apply Proposal', applyProposal.status || '-', pumpActionReason(applyProposal)),
      createReadinessRow('Restore Inputs', restoreInputs.status || '-', pumpActionReason(restoreInputs)),
      createReadinessRow('Clear Proposal', clearProposal.status || '-', pumpActionReason(clearProposal)),
      createReadinessRow('Stale', contract.isCalculationStale ? 'Yes' : 'No', contract.isCalculationStale ? 'Proposal/result should be recalculated from the network.' : 'No stale proposal flag is active.')
    );

    const actions = document.createElement('div');
    actions.className = 'caption-audit-action-buttons';
    const fitButton = document.createElement('button');
    fitButton.type = 'button';
    fitButton.className = 'caption-audit-action-btn';
    fitButton.dataset.captionAuditAction = 'engineering-fit';
    fitButton.dataset.node = pumpId;
    fitButton.textContent = fit.label || 'Build Engineering Fit From Vendor/Journal Duty Data';
    fitButton.title = pumpActionReason(fit);
    fitButton.disabled = !fit.canRun;
    fitButton.toggleAttribute('disabled', !fit.canRun);
    actions.append(fitButton);

    panel.replaceChildren(header, rows, actions);
  }

  function ensurePumpActionReadinessUi(rootNode = document) {
    if (!rootNode || typeof document === 'undefined') return;
    const taskWindows = [
      document.getElementById('taskWindow'),
      ...Array.from(document.querySelectorAll('.persistent-object-properties-task-window'))
    ].filter(Boolean);
    taskWindows.forEach(task => {
      if (getComputedStyle(task).display === 'none') return;
      const body = task.querySelector('.object-properties-task-body, .task-window-body');
      const title = task.querySelector('.task-window-header, #taskWindowTitle')?.textContent || document.getElementById('taskWindowTitle')?.textContent || '';
      if (!body || (!/Pump Object Properties/i.test(title) && !/\bP-\d+\b/i.test(body.innerText || ''))) return;
      const pumpId = (body.innerText || '').match(/\bP-\d+\b/i)?.[0] || taskWindowPumpId();
      if (!pumpId) return;
      const contract = buildPumpActionReadinessContract(pumpId, currentModel(), currentConnections());
      let panel = body.querySelector('[data-caption-audit-pump-action-readiness="true"]');
      if (!panel) {
        panel = document.createElement('section');
        panel.className = 'caption-audit-pump-action-readiness';
        panel.dataset.captionAuditPumpActionReadiness = 'true';
        const afterChart = body.querySelector('[data-caption-audit-inline-pump-chart="true"]');
        if (afterChart?.nextSibling) body.insertBefore(panel, afterChart.nextSibling);
        else body.insertBefore(panel, body.firstElementChild || null);
      }
      const evaluate = contract.actions.evaluateNpshFromNetwork || {};
      const fit = contract.actions.buildEngineeringFitFromVendorJournalDutyData || {};
      const applyProposal = contract.actions.applyPumpOptimizationProposal || {};
      const restoreInputs = contract.actions.restorePumpOptimizationPreviousInputs || {};
      const clearProposal = contract.actions.clearPumpOptimizationProposal || {};
      const signature = JSON.stringify({
        pumpId,
        source: contract.source,
        backend: !!contract.backendContract,
        route: contract.routeTraceStatus,
        stale: !!contract.isCalculationStale,
        evaluate: [!!evaluate.canRun, evaluate.status, evaluate.label, pumpActionReason(evaluate)],
        fit: [!!fit.canRun, fit.status, fit.label, pumpActionReason(fit)],
        applyProposal: [!!applyProposal.canRun, applyProposal.status, pumpActionReason(applyProposal)],
        restoreInputs: [!!restoreInputs.canRun, restoreInputs.status, pumpActionReason(restoreInputs)],
        clearProposal: [!!clearProposal.canRun, clearProposal.status, pumpActionReason(clearProposal)]
      });
      if (panel.dataset.captionAuditSignature !== signature) {
        renderPumpActionReadinessPanel(panel, pumpId, contract);
        panel.dataset.captionAuditSignature = signature;
      }
      updatePumpActionButtons(body, pumpId, contract);
    });
  }

  function ensurePumpOptimizationProposalActionUi(rootNode = document) {
    if (!rootNode || typeof document === 'undefined') return;
    const buttons = [
      ...(rootNode.matches?.('[data-pump-optimization-action]') ? [rootNode] : []),
      ...Array.from(rootNode.querySelectorAll?.('[data-pump-optimization-action]') || [])
    ];
    const bodies = uniqueStrings(buttons.map(button => {
      const body = button.closest?.('.object-properties-task-body, .task-window-body');
      return body ? String(Array.from(document.querySelectorAll('.object-properties-task-body, .task-window-body')).indexOf(body)) : '';
    }))
      .map(index => Array.from(document.querySelectorAll('.object-properties-task-body, .task-window-body'))[Number(index)])
      .filter(Boolean);
    bodies.forEach(body => {
      const pumpId = body.querySelector('[data-pump-optimization-action]')?.dataset?.node
        || (body.innerText || '').match(/\bP-\d+\b/i)?.[0]
        || taskWindowPumpId();
      if (!pumpId) return;
      const contract = buildPumpActionReadinessContract(pumpId, currentModel(), currentConnections());
      updatePumpProposalActionButtons(body, pumpId, contract);

      const actionWrap = body.querySelector('[data-pump-optimization-action]')?.parentElement;
      if (!actionWrap) return;
      let summary = actionWrap.parentElement?.querySelector('[data-caption-audit-proposal-action-status="true"]');
      if (!summary) {
        summary = document.createElement('div');
        summary.className = 'caption-audit-proposal-action-status';
        summary.dataset.captionAuditProposalActionStatus = 'true';
        actionWrap.insertAdjacentElement('afterend', summary);
      }
      const applyProposal = contract.actions.applyPumpOptimizationProposal || {};
      const restoreInputs = contract.actions.restorePumpOptimizationPreviousInputs || {};
      const clearProposal = contract.actions.clearPumpOptimizationProposal || {};
      const signature = JSON.stringify([
        !!applyProposal.canRun,
        applyProposal.status,
        !!restoreInputs.canRun,
        restoreInputs.status,
        !!clearProposal.canRun,
        clearProposal.status
      ]);
      if (summary.dataset.captionAuditSignature === signature) return;
      summary.textContent = [
        `Apply: ${applyProposal.status || '-'}`,
        `Restore: ${restoreInputs.status || '-'}`,
        `Clear: ${clearProposal.status || '-'}`
      ].join(' | ');
      summary.title = [
        pumpActionReason(applyProposal),
        pumpActionReason(restoreInputs),
        pumpActionReason(clearProposal)
      ].filter(Boolean).join(' | ');
      summary.dataset.captionAuditSignature = signature;
    });
  }

  function installPumpActionDomEvents() {
    if (root.__captionAuditPumpActionDomEventsBound || typeof document === 'undefined') return false;
    root.__captionAuditPumpActionDomEventsBound = true;
    document.addEventListener('click', async event => {
      const button = event.target?.closest?.('[data-pump-optimization-action]');
      if (!button) return;
      const actionName = button.dataset.pumpOptimizationAction || '';
      if (!['apply', 'restore', 'clear'].includes(actionName)) return;
      event.preventDefault();
      event.stopPropagation();

      const pumpId = button.dataset.node || button.closest('.object-properties-task-body, .task-window-body')?.innerText?.match(/\bP-\d+\b/i)?.[0] || taskWindowPumpId();
      const model = currentModel();
      const contract = buildPumpActionReadinessContract(pumpId, model, currentConnections());
      const readiness = proposalButtonReadiness(contract, actionName);
      if (!readiness?.canRun) {
        if (typeof root.showUiToast === 'function') {
          root.showUiToast(pumpActionReason(readiness), { title: 'Proposal action blocked', variant: 'warning', duration: 6200 });
        }
        updatePumpProposalActionButtons(button.closest('.object-properties-task-body, .task-window-body') || document, pumpId, contract);
        return;
      }

      if (typeof root.captureState === 'function') root.captureState();
      let result = { ok: false, status: 'Unavailable', warnings: ['Proposal action handler is unavailable.'] };
      if (actionName === 'apply' && typeof root.applyPumpOptimizationProposal === 'function') {
        result = root.applyPumpOptimizationProposal(pumpId, model);
      }
      if (actionName === 'restore' && typeof root.restorePumpOptimizationPreviousInputs === 'function') {
        result = root.restorePumpOptimizationPreviousInputs(pumpId, model);
        if (result?.requiresConfirmation) {
          const message = (result.warnings || []).join(' ') || 'Current pump inputs changed after applying the proposal. Restore previous inputs?';
          const confirmed = typeof root.showUiConfirm === 'function'
            ? await root.showUiConfirm({
                title: 'Restore Previous Inputs',
                message,
                confirmLabel: 'Restore',
                cancelLabel: 'Cancel',
                variant: 'warning'
              })
            : root.confirm?.(message);
          if (confirmed) result = root.restorePumpOptimizationPreviousInputs(pumpId, model, { force: true });
        }
      }
      if (actionName === 'clear' && typeof root.clearPumpOptimizationProposal === 'function') {
        result = root.clearPumpOptimizationProposal(pumpId, model);
      }

      if (typeof root.updateSimulation === 'function') root.updateSimulation({ renderSidebarAfter: false });
      if (typeof root.renderSidebar === 'function') root.renderSidebar(pumpId);
      if (typeof root.showUiToast === 'function') {
        root.showUiToast(
          result.ok ? `${readiness.label} completed.` : ((result.warnings || []).join(' | ') || result.status || 'Proposal action did not complete.'),
          { title: readiness.label || 'Proposal Action', variant: result.ok ? 'success' : 'warning', duration: 6200 }
        );
      }
      root.setTimeout?.(() => {
        ensurePumpActionReadinessUi(document);
        ensurePumpOptimizationProposalActionUi(document);
      }, 80);
    }, true);

    document.addEventListener('click', event => {
      const button = event.target?.closest?.('[data-caption-audit-action="engineering-fit"]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const pumpId = button.dataset.node || taskWindowPumpId();
      const model = currentModel();
      const contract = buildPumpActionReadinessContract(pumpId, model, currentConnections());
      const action = contract.actions.buildEngineeringFitFromVendorJournalDutyData;
      if (!action?.canRun) {
        if (typeof root.showUiToast === 'function') {
          root.showUiToast(pumpActionReason(action), { title: 'Engineering fit blocked', variant: 'warning', duration: 6200 });
        }
        return;
      }
      if (typeof root.captureState === 'function') root.captureState();
      if (typeof root.updateSimulation === 'function') root.updateSimulation({ renderSidebarAfter: false });
      const result = typeof root.applyPumpEngineeringFitCurveFromVendorData === 'function'
        ? root.applyPumpEngineeringFitCurveFromVendorData(pumpId, model, currentConnections())
        : { ok: false, warnings: ['Engineering-fit curve builder is unavailable.'] };
      if (typeof root.updateSimulation === 'function') root.updateSimulation({ renderSidebarAfter: false });
      if (typeof root.showUiToast === 'function') {
        root.showUiToast(
          result.ok ? 'Engineering-fit pump curve built from available vendor/journal duty data.' : (result.warnings || []).join(' | '),
          { title: result.ok ? 'Curve Builder' : 'Curve builder needs input', variant: result.ok && !(result.warnings || []).length ? 'success' : 'warning', duration: 6200 }
        );
      }
      if (typeof root.renderSidebar === 'function') root.renderSidebar(pumpId);
      root.setTimeout?.(() => ensurePumpActionReadinessUi(document), 60);
    }, true);
    return true;
  }

  function ensureInlinePumpPerformanceChart(rootNode = document) {
    if (!rootNode || typeof document === 'undefined') return;
    const taskWindows = [
      document.getElementById('taskWindow'),
      ...Array.from(document.querySelectorAll('.persistent-object-properties-task-window'))
    ].filter(Boolean);
    taskWindows.forEach(task => {
      if (getComputedStyle(task).display === 'none') return;
      const body = task.querySelector('.object-properties-task-body, .task-window-body');
      const title = task.querySelector('.task-window-header, #taskWindowTitle')?.textContent || document.getElementById('taskWindowTitle')?.textContent || '';
      if (!body || (!/Pump Object Properties/i.test(title) && !/Network NPSH Evaluation Report/i.test(body.innerText || ''))) return;
      const bodyText = body.innerText || '';
      const pumpId = bodyText.match(/\bP-\d+\b/i)?.[0] || taskWindowPumpId();
      if (!pumpId) return;
      let panel = body.querySelector('[data-caption-audit-inline-pump-chart="true"]');
      if (!panel) {
        panel = document.createElement('section');
        panel.className = 'caption-audit-inline-pump-chart';
        panel.dataset.captionAuditInlinePumpChart = 'true';
        panel.innerHTML = [
          '<div class="caption-audit-inline-chart-head">',
          '<h3>Pump Performance Chart</h3>',
          '<span data-caption-audit-pump-chart-meta>Curve, system head, NPSHa/NPSHr, duty point</span>',
          '</div>',
          '<div class="caption-audit-inline-chart-wrap"><canvas></canvas></div>'
        ].join('');
        body.insertBefore(panel, body.firstElementChild || null);
      }
      const data = buildPumpPerformanceAuditData(pumpId);
      const meta = panel.querySelector('[data-caption-audit-pump-chart-meta]');
      if (data && meta) {
        meta.textContent = `${data.source}; confidence ${data.confidence}; freshness ${data.freshness}`;
      }
      const canvas = panel.querySelector('canvas');
      root.requestAnimationFrame?.(() => drawPumpPerformanceCanvas(pumpId, canvas));
    });
  }

  function schedulePumpFormulaDefenseRefresh() {
    if (typeof document === 'undefined') return;
    root.setTimeout?.(() => {
      ensureAllPumpNpshCalculationTraces();
      ensurePumpFormulaDefenseFallback(document);
    }, 30);
  }

  function installPumpFormulaDefenseTracePatch() {
    if (root.__captionAuditPumpFormulaDefenseTracePatch) return false;
    root.__captionAuditPumpFormulaDefenseTracePatch = true;
    let installed = false;

    if (typeof root.runPumpNpshEvaluation === 'function' && !root.runPumpNpshEvaluation.__captionAuditPumpDefensePatched) {
      const originalRunPumpNpshEvaluation = root.runPumpNpshEvaluation;
      root.runPumpNpshEvaluation = function patchedRunPumpNpshEvaluation(pumpId, model = currentModel(), connectionList = currentConnections(), ...rest) {
        const result = originalRunPumpNpshEvaluation.call(this, pumpId, model, connectionList, ...rest);
        const pump = model?.[pumpId];
        if (pump?.type === 'pump') {
          if (result?.calculationTrace) {
            attachPumpCalculationTrace(pump, result, result.calculationTrace);
          } else if (!root.__captionAuditEnsuringPumpTrace) {
            ensurePumpNpshCalculationTrace(pumpId, model, connectionList, { skipEngine: true, force: true });
          }
        }
        return result;
      };
      root.runPumpNpshEvaluation.__captionAuditPumpDefensePatched = true;
      installed = true;
    }

    if (typeof root.updateSimulation === 'function' && !root.updateSimulation.__captionAuditPumpDefensePatched) {
      const originalUpdateSimulation = root.updateSimulation;
      root.updateSimulation = function patchedUpdateSimulation(...args) {
        const result = originalUpdateSimulation.apply(this, args);
        const afterUpdate = () => schedulePumpFormulaDefenseRefresh();
        if (result && typeof result.then === 'function') {
          return result.finally(afterUpdate);
        }
        afterUpdate();
        return result;
      };
      root.updateSimulation.__captionAuditPumpDefensePatched = true;
      installed = true;
    }

    if (typeof root.createPumpFormulaDefenseContent === 'function' && !root.createPumpFormulaDefenseContent.__captionAuditPumpDefensePatched) {
      const originalCreatePumpFormulaDefenseContent = root.createPumpFormulaDefenseContent;
      root.createPumpFormulaDefenseContent = function patchedCreatePumpFormulaDefenseContent(pumpId, ...args) {
        if (!root.__captionAuditRenderingPumpDefenseFallback) {
          ensurePumpNpshCalculationTrace(resolvePumpId(pumpId));
        }
        const content = originalCreatePumpFormulaDefenseContent.call(this, pumpId, ...args);
        if (content && isPumpFormulaDefenseFallbackText(content.textContent || '')) {
          root.setTimeout?.(() => ensurePumpFormulaDefenseFallback(document), 0);
        }
        return content;
      };
      root.createPumpFormulaDefenseContent.__captionAuditPumpDefensePatched = true;
      installed = true;
    }

    if (typeof root.openPumpFormulaDefenseTaskWindow === 'function' && !root.openPumpFormulaDefenseTaskWindow.__captionAuditPumpDefensePatched) {
      const originalOpenPumpFormulaDefenseTaskWindow = root.openPumpFormulaDefenseTaskWindow;
      root.openPumpFormulaDefenseTaskWindow = function patchedOpenPumpFormulaDefenseTaskWindow(pumpId, ...args) {
        const resolvedPumpId = resolvePumpId(pumpId);
        ensurePumpNpshCalculationTrace(resolvedPumpId);
        const result = originalOpenPumpFormulaDefenseTaskWindow.call(this, resolvedPumpId || pumpId, ...args);
        schedulePumpFormulaDefenseRefresh();
        return result;
      };
      root.openPumpFormulaDefenseTaskWindow.__captionAuditPumpDefensePatched = true;
      installed = true;
    }

    if (typeof root.refreshPumpFormulaDefenseWindowContent === 'function' && !root.refreshPumpFormulaDefenseWindowContent.__captionAuditPumpDefensePatched) {
      const originalRefreshPumpFormulaDefenseWindowContent = root.refreshPumpFormulaDefenseWindowContent;
      root.refreshPumpFormulaDefenseWindowContent = function patchedRefreshPumpFormulaDefenseWindowContent(element, options = {}) {
        const pumpId = element?.dataset?.pumpNodeId || element?.dataset?.nodeId || taskWindowPumpId();
        ensurePumpNpshCalculationTrace(resolvePumpId(pumpId));
        const result = originalRefreshPumpFormulaDefenseWindowContent.call(this, element, options);
        schedulePumpFormulaDefenseRefresh();
        return result;
      };
      root.refreshPumpFormulaDefenseWindowContent.__captionAuditPumpDefensePatched = true;
      installed = true;
    }

    if (installed) schedulePumpFormulaDefenseRefresh();
    return installed;
  }

  function installPumpChartAuditPatch() {
    if (typeof root !== 'object') return false;
    root.updatePumpChart = function updatePumpChartAudit(pumpId) {
      return drawPumpPerformanceCanvas(pumpId || root.__captionAuditActivePumpChartId || firstCanvasObjectId('pump'));
    };
    root.openPumpPerformanceCurveWindow = function openPumpPerformanceCurveWindowAudit(pumpId) {
      return openPumpPerformanceAuditChart(pumpId || firstCanvasObjectId('pump'));
    };
    root.closePumpPerformanceCurveWindow = function closePumpPerformanceCurveWindowAudit() {
      const editor = document.getElementById('fullEditor');
      if (editor) editor.style.display = 'none';
    };
    if (typeof document !== 'undefined') bindPumpPerformanceAuditWindowControls();
    return true;
  }

  function installDomNormalizer() {
    if (typeof document === 'undefined' || root.__captionAuditObserverInstalled) return false;
    root.__captionAuditObserverInstalled = true;
    normalizeTextTree(document.body || document.documentElement);
    markAuditRows(document);
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 3) normalizeTextNode(node);
          if (node.nodeType === 1) {
            normalizeTextTree(node);
            markAuditRows(node);
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return true;
  }

  function injectStyle() {
    if (typeof document === 'undefined' || document.getElementById('caption-audit-overrides-style')) return;
    const style = document.createElement('style');
    style.id = 'caption-audit-overrides-style';
    style.textContent = [
      '.caption-audit-row .pump-live-param-value,',
      '.caption-audit-row .source-live-param-value,',
      '.caption-audit-row .sink-live-param-value{overflow:hidden;text-overflow:ellipsis;}',
      '.caption-audit-row[title] .pump-live-param-value{max-width:128px;}',
      '.object-type-pump .pump-live-params{pointer-events:auto!important;}',
      '.caption-audit-chart-row{align-items:center;pointer-events:auto!important;}',
      '.caption-audit-chart-btn{max-width:122px;padding:2px 6px;border:1px solid #1c4568;border-radius:4px;background:#eef6fc;color:#123b5a;font-size:9.5px;font-weight:700;line-height:1.2;cursor:pointer;white-space:normal;pointer-events:auto!important;}',
      '.caption-audit-chart-btn:hover,.caption-audit-chart-btn:focus-visible{background:#dbeafe;outline:2px solid rgba(28,69,104,.25);outline-offset:1px;}',
      '#fullEditor.full-editor-modal{position:fixed;right:18px;top:112px;z-index:1450;width:min(860px,calc(100vw - 36px));height:min(660px,calc(100dvh - 132px));max-width:calc(100vw - 16px);max-height:calc(100dvh - 24px);flex-direction:column;border:1px solid rgba(28,69,104,.82);border-radius:8px;background:#fff;box-shadow:0 18px 46px rgba(15,23,42,.24);overflow:hidden;}',
      '#fullEditor .modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:42px;padding:8px 10px 8px 14px;background:#123b5a;color:#fff;}',
      '#fullEditor .modal-header span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:700;}',
      '#fullEditor .modal-actions{display:flex;align-items:center;gap:4px;}',
      '#fullEditor .modal-close,#fullEditor .modal-minimize{width:28px;height:28px;border:0;border-radius:4px;background:transparent;color:#fff;font-weight:700;cursor:pointer;}',
      '#fullEditor .modal-body{flex:1 1 auto;min-height:0;padding:12px;background:#f6f8fb;}',
      '#fullEditor .modal-chart-wrap{width:100%;height:100%;min-height:420px;border:1px solid #d8e6f2;border-radius:6px;background:#fff;overflow:hidden;}',
      '#pumpChart{display:block;width:100%;height:100%;}',
      '#fullEditor.task-window-minimized{height:42px!important;min-height:42px;}',
      '#fullEditor.task-window-minimized .modal-body{display:none;}',
      '.caption-audit-inline-pump-chart{margin:0 0 12px;padding:10px;border:1px solid #d8e6f2;border-radius:8px;background:#fff;}',
      '.caption-audit-inline-chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;}',
      '.caption-audit-inline-chart-head h3{margin:0;color:#123b5a;font-size:13px;line-height:1.2;}',
      '.caption-audit-inline-chart-head span{max-width:58%;color:#475569;font-size:10.5px;line-height:1.25;text-align:right;}',
      '.caption-audit-inline-chart-wrap{height:clamp(380px,48vh,460px);min-height:380px;border:1px solid #edf2f7;border-radius:6px;background:#fff;overflow:hidden;}',
      '#captionAuditPumpChartCanvas,.caption-audit-inline-chart-wrap canvas{display:block;width:100%;height:100%;}',
      '.caption-audit-pump-action-readiness{margin:0 0 12px;padding:10px;border:1px solid #d8e6f2;border-radius:8px;background:#f8fbff;}',
      '.caption-audit-action-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;}',
      '.caption-audit-action-head h3{margin:0;color:#123b5a;font-size:13px;line-height:1.2;}',
      '.caption-audit-action-head span{max-width:56%;color:#475569;font-size:10.5px;line-height:1.25;text-align:right;}',
      '.caption-audit-action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}',
      '.caption-audit-action-row{min-width:0;padding:6px;border:1px solid #e2edf7;border-radius:6px;background:#fff;}',
      '.caption-audit-action-row span{display:block;color:#64748b;font-size:10px;line-height:1.2;}',
      '.caption-audit-action-row strong{display:block;min-width:0;margin-top:2px;color:#123b5a;font-size:11px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;}',
      '.caption-audit-action-buttons{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}',
      '.caption-audit-action-btn{padding:6px 8px;border:1px solid #1c4568;border-radius:6px;background:#eef6fc;color:#123b5a;font-size:11px;font-weight:700;line-height:1.2;cursor:pointer;}',
      '.caption-audit-action-btn:hover,.caption-audit-action-btn:focus-visible{background:#dbeafe;outline:2px solid rgba(28,69,104,.25);outline-offset:1px;}',
      '.caption-audit-action-btn:disabled,.pump-network-optimize-btn[data-caption-audit-readiness=\"blocked\"],.pump-engineering-fit-btn[data-caption-audit-readiness=\"blocked\"],button[data-pump-optimization-action][data-caption-audit-readiness=\"blocked\"]{opacity:.62;cursor:not-allowed;}',
      '.caption-audit-proposal-action-status{margin:7px 0 0;color:#475569;font-size:10.5px;line-height:1.35;}',
      '.caption-audit-pump-defense-fallback{gap:10px;}',
      '.caption-audit-pump-defense-card{border-color:#d8e6f2;background:#fff;}',
      '.caption-audit-pump-defense-card h3{margin:0 0 8px;color:#123b5a;font-size:13px;line-height:1.25;}',
      '.caption-audit-pump-defense-list{margin:0;padding-left:18px;color:#334155;font-size:11px;line-height:1.45;}',
      '.caption-audit-defense-table-wrap{width:100%;overflow:auto;border:1px solid #e2edf7;border-radius:6px;background:#fff;}',
      '.caption-audit-defense-table{width:100%;border-collapse:collapse;font-size:10.5px;line-height:1.35;}',
      '.caption-audit-defense-table th{padding:6px 7px;border-bottom:1px solid #d8e6f2;background:#eef6fc;color:#123b5a;text-align:left;font-weight:700;white-space:nowrap;}',
      '.caption-audit-defense-table td{padding:6px 7px;border-bottom:1px solid #edf2f7;color:#334155;vertical-align:top;}',
      '.caption-audit-defense-table tr:last-child td{border-bottom:0;}',
      '.caption-audit-defense-step-list{display:grid;gap:7px;}',
      '.caption-audit-defense-step-card{margin:0;border:1px solid #e2edf7;border-radius:6px;background:#fbfdff;}',
      '.caption-audit-defense-step-card h4{margin:0 0 5px;color:#123b5a;font-size:11.5px;line-height:1.25;}',
      '.caption-audit-defense-step-card code{display:block;white-space:normal;color:#0f172a;font-size:10.5px;}',
      '@media (max-width:720px){.caption-audit-inline-chart-wrap{height:340px;min-height:340px;}.caption-audit-action-grid{grid-template-columns:1fr;}.caption-audit-action-head{display:block;}.caption-audit-action-head span{display:block;max-width:none;margin-top:4px;text-align:left;}.caption-audit-defense-table{font-size:10px;}}'
    ].join('');
    document.head.appendChild(style);
  }

  function install() {
    const installed = [
      installUnavailableStatusPatch(),
      installPrimaryResultPatch(),
      installSimulationStateHelperPatch(),
      installPipeCalculationFallbacks(),
      installPumpFormulaDefenseTracePatch(),
      installPumpChartAuditPatch(),
      installPumpActionReadinessPatch(),
      patchRowBuilder('buildPumpLiveParameterRows', normalizePumpRows),
      patchRowBuilder('buildSourceLiveParameterRows', normalizeSourceRows),
      patchRowBuilder('buildSinkLiveParameterRows', normalizeSinkRows)
    ];
    injectStyle();
    installPumpActionDomEvents();
    installDomNormalizer();
    return installed.some(Boolean);
  }

  const api = {
    version: VERSION,
    backendUnavailableWarning: BACKEND_UNVERIFIED_WARNING,
    install,
    buildRuntimeRouteTrace,
    buildPumpActionReadinessContract,
    ensurePumpNpshCalculationTrace,
    buildFallbackPumpCalculationTrace
  };

  root.EngineeringCaptionAuditOverrides = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  function safeInstall() {
    try {
      return install();
    } catch (error) {
      root.__captionAuditInstallError = error;
      console.warn('Engineering caption audit overrides did not fully install.', error);
      return false;
    }
  }

  safeInstall();
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', safeInstall, { once: true });
    root.setTimeout?.(safeInstall, 250);
  }
})(typeof window !== 'undefined' ? window : globalThis);
