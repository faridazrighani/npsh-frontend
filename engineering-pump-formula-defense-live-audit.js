(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'pump-formula-defense-live-audit.v13-idempotent-refresh';
  const WINDOW_SELECTOR = '.pump-formula-defense-task-window';
  const BADGE_SELECTOR = '[data-pump-formula-defense-live-badges]';
  const SUMMARY_SELECTOR = '[data-pump-formula-defense-vendor-summary]';
  const MATRIX_SELECTOR = '[data-pump-calculation-matrix]';
  const CLEAN_REMOVED_FORMULA_DEFENSE_OUTPUTS = new Set([
    'required npsha',
    'maximum allowable npshr',
    'maximum allowable npshr status',
    'manual npshr comparison',
    'vendor curve verification',
    'npsh excess'
  ]);
  const REALTIME_EVENTS = [
    'npsh:calculation-stale',
    'npsh:calculation-calculating',
    'npsh:calculation-current',
    'npsh:linked-views-refreshed',
    'npsh:realtime-autosolve-complete'
  ];
  const LIVE_INPUT_PATTERN = /\b(inputMode|optimizationMode|npshrSourceMode|npshAssessmentMode|npshMarginBasis|designFlow|designHead|designNpshr|manualNpshr|minNpshMarginRatio|minNpshMargin|speed|flow|head|npshr|pressure|pressureInputBasis|pressureBasis|pressureEnergyBasis|elevation|suctionElevation|dischargeElevation|density|viscosity|kinematicViscosity|dynamicViscosity|vaporPressure|segments|length|diameter|roughness|fittingType|fittingQuantity|fittingK|minorLoss|additionalK|active|boundaryMode|demandFlow|requiredSystemHead)\b/i;
  const RUNTIME_PATCH_FLAG_KEYS = [
    '__engineeringRealtimeCalculationDefenseUpdatePatched',
    '__engineeringRealtimeCalculationDefenseOriginal',
    '__analysisReportLivePatched',
    '__analysisReportLiveOriginal',
    '__pumpPerformanceChartAuditPatched',
    '__pumpPerformanceChartAuditVersion',
    '__pumpPerformanceChartAuditOriginal',
    '__pumpPerformanceCanonicalChartVersion',
    '__pumpPerformanceCanonicalChartOriginal',
    '__pumpPerformanceCanonicalChartRole'
  ];
  let backendRefreshTimer = null;
  let backendRefreshBusy = false;
  let windowRefreshTimer = null;
  let runtimeGuardTimer = null;
  let refreshingWindowContent = false;
  let canvasPumpReadoutRefreshTimer = 0;
  let localBackendSkipGuardInstalled = false;
  const wrappedFunctionNames = new Set();

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function runtimeModel() {
    try {
      if (typeof globalModel !== 'undefined' && globalModel) return globalModel;
    } catch (error) {
      // Global model is not always attached to window in protected builds.
    }
    try {
      const state = typeof root.getSimulationState === 'function'
        ? JSON.parse(root.getSimulationState())
        : null;
      if (state?.model) return state.model;
    } catch (error) {
      // Fall through to legacy window-attached names.
    }
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function hasDocument() {
    return typeof document !== 'undefined' && document?.querySelectorAll;
  }

  function firstPumpId(model) {
    return Object.keys(model || {}).find((id) => model[id]?.type === 'pump') || '';
  }

  function defenseInputSource(title) {
    const label = String(title || '').toLowerCase();
    if (label.includes('npshr')) return 'Manual NPSHr input or verified vendor/journal NPSHr value at evaluated duty.';
    if (label.includes('npsha')) return 'Current suction-side energy balance after source pressure, elevation, suction loss, and vapor pressure.';
    if (label.includes('suction loss')) return 'Current suction route pipe/fitting/valve loss trace.';
    if (label.includes('margin') || label.includes('required')) return 'Selected NPSH margin basis, NPSHa, and NPSHr.';
    if (label.includes('operating')) return 'Evaluated route flow and upstream/downstream boundary conditions.';
    if (label.includes('vapor')) return 'Active Fluid Basis vapor pressure and density.';
    return 'Current pump/network calculation trace.';
  }

  function defenseLiterature(title) {
    const label = String(title || '').toLowerCase();
    if (label.includes('npshr')) return 'ANSI/HI NPSHR definition and documented vendor/journal/manual NPSHr basis.';
    if (label.includes('npsha') || label.includes('vapor')) return 'ANSI/HI NPSHA determination at the pump datum and Bernoulli energy balance.';
    if (label.includes('suction loss')) return 'Darcy-Weisbach major loss and K-method minor loss from fluid mechanics references.';
    if (label.includes('margin') || label.includes('required')) return 'ANSI/HI NPSH margin and ratio screening basis.';
    return 'Local thesis literature set: fluid mechanics, cavitation, and pump operating range references.';
  }

  function defenseNote(title) {
    const label = String(title || '').toLowerCase();
    if (label.includes('npshr')) return 'NPSHr is pump-side input; the route calculation checks whether the entered value is allowable for the current NPSHa.';
    if (label.includes('npsha')) return 'NPSHa is system-derived and must move when SRC pressure, Fluid Basis, suction loss, or elevation changes.';
    if (label.includes('suction loss')) return 'Suction loss is a direct NPSHa subtraction and a practical engineering improvement lever.';
    if (label.includes('margin')) return 'The app separates raw margin from the stricter required-NPSHa acceptance check.';
    return 'Use this row as advisor-facing evidence for the live pump number.';
  }

  function isDeprecatedPumpCurveDefenseText(value) {
    return /\b(pump\s+head\s+curve|pump\s+performance\s+curve|interpolated\s+h\s+from\s+pump\s+curve|bep|por|aor|operating\s+region|head\s+residual)\b/i
      .test(String(value || ''));
  }

  function isCleanRemovedFormulaDefenseRow(row) {
    const label = normalizeLabel(row?.step || row?.title || row?.output || row?.formulaName || '');
    return CLEAN_REMOVED_FORMULA_DEFENSE_OUTPUTS.has(label);
  }

  function sanitizeFormulaDefenseRowForCleanLayout(row, evaluation = {}) {
    if (!row || typeof row !== 'object') return row;
    const clean = { ...row };
    const label = normalizeLabel(clean.step || clean.title || clean.output || clean.formulaName || '');
    if (label === 'margin and ratio') {
      const margin = firstNumber(evaluation.npshMargin, evaluation.calculationTrace?.interpretation?.margin);
      const ratio = firstNumber(evaluation.npshRatio, evaluation.calculationTrace?.interpretation?.ratio);
      clean.formula = 'Margin = NPSHa - NPSHr; Ratio = NPSHa / NPSHr';
      clean.equation = clean.formula;
      clean.substitution = `${formatNumber(evaluation.npsha, 4)} - ${formatNumber(evaluation.npshr, 4)} = ${formatNumber(margin, 4)} m; ${formatNumber(evaluation.npsha, 4)} / ${formatNumber(evaluation.npshr, 4)} = ${formatNumber(ratio, 4)}`;
      clean.substitutedValues = clean.substitution;
      clean.result = margin ?? clean.result;
      clean.unit = 'm';
      clean.units = 'm';
    }
    return clean;
  }

  function cleanFormulaDefenseRows(rows = [], evaluation = {}) {
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => !isCleanRemovedFormulaDefenseRow(row))
      .map((row) => sanitizeFormulaDefenseRowForCleanLayout(row, evaluation))
      .map((row, index) => ({ ...row, order: index + 1 }));
  }

  function ensureActualPumpHeadFormulaDefenseRow(rows = [], evaluation = {}) {
    if (!Array.isArray(rows)) return false;
    if (rows.some((row) => normalizeLabel(row?.step || row?.title || row?.output) === 'actual pump head')) return false;
    const actualPumpHead = firstNumber(evaluation.actualPumpHead, evaluation.pumpHead);
    const requiredSystemHead = firstNumber(evaluation.requiredSystemHead, evaluation.requiredPumpHead, evaluation.systemHead?.requiredHead);
    const actualAvailable = evaluation.actualPumpHeadAvailable === true && actualPumpHead !== null;
    const explicitUnavailable = evaluation.actualPumpHeadAvailable === false;
    if (!actualAvailable && !explicitUnavailable && requiredSystemHead === null) return false;
    const insertAfter = rows.findIndex((row) => /required\s+pump\s+head|system\s+curve\s+head/i.test(String(row?.step || row?.title || row?.output || '')));
    rows.splice(insertAfter >= 0 ? insertAfter + 1 : rows.length, 0, {
      order: 0,
      liveAuditFallback: true,
      step: 'Actual Pump Head',
      inputSource: 'Pump curve, vendor curve, or test curve at the evaluated duty flow.',
      formula: 'H_actual(Q) = H_pump(Q) from verified pump performance data',
      substitution: actualAvailable
        ? `H_actual=${formatWithUnit(actualPumpHead, 'm', 3)}`
        : `Not available; H_required=${formatWithUnit(requiredSystemHead, 'm', 3)} is system demand and must not be used as actual pump performance.`,
      result: actualAvailable ? actualPumpHead : 'Not available',
      unit: actualAvailable ? 'm' : '',
      literature: 'ANSI/HI separates system-derived requirements from pump/vendor/test performance data.',
      defenseNote: 'Pump power and head residual require Actual Pump Head; route-only Required Head can be negative in pressure-assisted duty.'
    });
    rows.forEach((row, index) => {
      row.order = index + 1;
    });
    return true;
  }

  function ensureFormulaDefenseRows(evaluation = {}) {
    const trace = evaluation.calculationTrace || {};
    if (!Array.isArray(trace.steps)) return;
    const existingRows = Array.isArray(trace.academicFormulaDefenseRows) && trace.academicFormulaDefenseRows.length
      ? trace.academicFormulaDefenseRows
      : (Array.isArray(trace.formulaDefenseRows) && trace.formulaDefenseRows.length ? trace.formulaDefenseRows : []);
    const existingHasDeprecatedCurveRows = existingRows.some((row) => isDeprecatedPumpCurveDefenseText([
      row?.step,
      row?.formula,
      row?.equation,
      row?.inputSource,
      row?.substitution,
      row?.connectedTo,
      row?.defenseNote
    ].join(' ')));
    if (existingRows.length && !existingRows.some((row) => row?.liveAuditFallback === true) && !existingHasDeprecatedCurveRows) {
      const cleanRows = cleanFormulaDefenseRows(existingRows, evaluation);
      ensureActualPumpHeadFormulaDefenseRow(cleanRows, evaluation);
      trace.academicFormulaDefenseRows = cleanRows;
      trace.formulaDefenseRows = cleanRows;
      return;
    }
    const liveSteps = trace.steps.filter((step) => {
      if (isCleanRemovedFormulaDefenseRow({ step: step?.title || step?.label || '' })) return false;
      return !isDeprecatedPumpCurveDefenseText(`${step?.title || step?.label || ''} ${step?.reference || ''} ${step?.formula || ''}`);
    });
    const rows = liveSteps.map((step, index) => {
      const title = step.title || step.label || `Step ${index + 1}`;
      const formula = String(step.formula || '');
      const substitution = String(step.substitution || '');
      return sanitizeFormulaDefenseRowForCleanLayout({
        order: index + 1,
        liveAuditFallback: true,
        step: title,
        inputSource: defenseInputSource(title),
        formula: normalizeLabel(title).includes('npshr') && /curve/i.test(formula)
          ? 'NPSHr = entered/manual required NPSH at evaluated duty'
          : (formula || '-'),
        substitution: normalizeLabel(title).includes('npshr') && /curve/i.test(substitution)
          ? `NPSHr=${formatWithUnit(evaluation.npshr, 'm', 4)}`
          : (substitution || '-'),
        result: step.result ?? null,
        unit: step.unit || '',
        literature: defenseLiterature(title),
        defenseNote: defenseNote(title)
      }, evaluation);
    });
    ensureActualPumpHeadFormulaDefenseRow(rows, evaluation);
    rows.push({
      order: rows.length + 1,
      liveAuditFallback: true,
      step: 'Data Confidence Gate',
      inputSource: 'Hydraulic NPSH status, NPSHr source quality, and selected assessment mode.',
      formula: 'Engineering status = hydraulic status + NPSHr data confidence',
      substitution: `Hydraulic: ${evaluation.hydraulicStatus || evaluation.status || '-'}; Data: ${evaluation.dataConfidence || '-'}; Engineering: ${evaluation.engineeringStatus || evaluation.status || '-'}`,
      result: evaluation.engineeringStatus || evaluation.status || '-',
      unit: '',
      literature: 'ANSI/HI distinguishes system NPSHA from pump/manufacturer NPSHR; manufacturer/test data is preferred for final validation.',
      defenseNote: 'This is the advisor-facing gate for why hydraulic safety and vendor/source confidence are separate.'
    });
    trace.formulaDefenseSchemaVersion = trace.formulaDefenseSchemaVersion || 'pump-formula-defense.v1';
    const cleanRows = cleanFormulaDefenseRows(rows, evaluation);
    trace.academicFormulaDefenseRows = cleanRows;
    trace.formulaDefenseRows = cleanRows;
  }

  function datasetPumpId(target) {
    if (!target || typeof target !== 'object') return '';
    return firstText(target.dataset?.pumpId, target.dataset?.pumpNodeId, target.dataset?.nodeId);
  }

  function isFormulaDefenseWindowElement(target) {
    return !!target && typeof target === 'object' && (
      typeof target.querySelector === 'function' ||
      typeof target.querySelectorAll === 'function' ||
      typeof target.classList?.contains === 'function'
    );
  }

  function resolvePumpId(pumpId) {
    const model = runtimeModel();
    const datasetId = datasetPumpId(pumpId);
    if (datasetId && model[datasetId]?.type === 'pump') return datasetId;
    if (pumpId && model[pumpId]?.type === 'pump') return pumpId;
    if (!hasDocument()) return firstPumpId(model);
    const visibleWindow = Array.from(document.querySelectorAll(WINDOW_SELECTOR))
      .find((node) => node.offsetParent !== null || node.getClientRects().length);
    return datasetPumpId(visibleWindow) || firstPumpId(model);
  }

  function isInputLatencyShieldActive(pumpId = '') {
    try {
      if (typeof root.EngineeringInputLatencyShield?.isActive === 'function') {
        return !!root.EngineeringInputLatencyShield.isActive(resolvePumpId(pumpId));
      }
      if (typeof root.EngineeringRealtimeCalculationDefense?.isInputLatencyShieldActive === 'function') {
        return !!root.EngineeringRealtimeCalculationDefense.isInputLatencyShieldActive(resolvePumpId(pumpId));
      }
      const shield = root.__engineeringInputLatencyShield;
      return !!(shield && Number(shield.activeUntil) > Date.now());
    } catch (error) {
      return false;
    }
  }

  function pumpResult(pumpId) {
    const model = runtimeModel();
    const id = resolvePumpId(pumpId);
    const pump = model[id] || {};
    hydratePumpTopLevelResults(pump);
    const results = pump.results || {};
    const evaluation = results.npshEvaluation || results;
    const trace = evaluation.calculationTrace || {};
    ensureFormulaDefenseRows(evaluation);
    const rows = Array.isArray(trace.academicFormulaDefenseRows)
      ? trace.academicFormulaDefenseRows
      : (Array.isArray(trace.formulaDefenseRows) ? trace.formulaDefenseRows : []);
    const steps = Array.isArray(trace.steps) ? trace.steps : [];
    return { id, pump, results, evaluation, trace, rows, steps };
  }

  function truthyText(value) {
    return value === true ? 'Yes' : value === false ? 'No' : (value || '-');
  }

  function toFiniteNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined || value === '') return null;
    const match = String(value).replace(/,/g, '').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function firstNumber(...values) {
    for (const value of values) {
      const parsed = toFiniteNumber(value);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  function firstText(...values) {
    return values
      .map((value) => value === null || value === undefined ? '' : String(value).trim())
      .find((value) => value && value !== '-') || '';
  }

  function isIncompleteStatus(value) {
    return /\b(input\s*required|incomplete|invalid|unknown|no\s+operating)\b/i.test(String(value || ''));
  }

  function firstCompleteStatus(...values) {
    return values
      .map((value) => value === null || value === undefined ? '' : String(value).trim())
      .find((value) => value && value !== '-' && !isIncompleteStatus(value)) || '';
  }

  function statusFromNpshNumbers(npsha, npshr, requiredNpsha) {
    if (npsha === null || npshr === null || npshr <= 0) return '';
    if (npsha <= npshr) return 'Cavitation Risk';
    if (requiredNpsha !== null && npsha < requiredNpsha) return 'Warning';
    return 'OK';
  }

  function criteriaAvailabilityStatus(ratioLimit, absoluteMarginLimit) {
    return ratioLimit !== null || absoluteMarginLimit !== null
      ? 'Calculated'
      : 'Margin criteria required';
  }

  function requiredNpshaCandidates(npshr, ratioLimit, absoluteMarginLimit) {
    const candidates = [];
    if (npshr !== null && ratioLimit !== null && ratioLimit > 0) {
      candidates.push({ label: `${formatNumber(npshr, 3)} x ${formatNumber(ratioLimit, 3)}`, value: npshr * ratioLimit });
    }
    if (npshr !== null && absoluteMarginLimit !== null && absoluteMarginLimit >= 0) {
      candidates.push({ label: `${formatNumber(npshr, 3)} + ${formatNumber(absoluteMarginLimit, 3)}`, value: npshr + absoluteMarginLimit });
    }
    return candidates;
  }

  function allowableNpshrCandidates(npsha, ratioLimit, absoluteMarginLimit) {
    const candidates = [];
    if (npsha !== null && ratioLimit !== null && ratioLimit > 0) {
      candidates.push({ label: `${formatNumber(npsha, 4)} / ${formatNumber(ratioLimit, 3)}`, value: npsha / ratioLimit });
    }
    if (npsha !== null && absoluteMarginLimit !== null && absoluteMarginLimit >= 0) {
      candidates.push({ label: `${formatNumber(npsha, 4)} - ${formatNumber(absoluteMarginLimit, 3)}`, value: npsha - absoluteMarginLimit });
    }
    return candidates;
  }

  function formatGoverningExpression(candidates, result, mode) {
    if (!candidates.length) return 'Margin criteria required';
    const lhs = candidates.length > 1
      ? `${mode}(${candidates.map((candidate) => candidate.label).join(', ')})`
      : candidates[0].label;
    return result !== null ? `${lhs} = ${formatNumber(result, 4)} m` : lhs;
  }

  function writeResultIfUseful(results, key, value, overwriteIncomplete = false) {
    if (!results || value === null || value === undefined || value === '') return false;
    const current = results[key];
    if (Object.is(current, value)) return false;
    const empty = current === null || current === undefined || current === '';
    if (empty || overwriteIncomplete || isIncompleteStatus(current)) {
      results[key] = value;
      return true;
    }
    return false;
  }

  function actualPumpHeadAvailability(results = {}, evaluation = {}) {
    if (evaluation.actualPumpHeadAvailable === false || results.actualPumpHeadAvailable === false) return false;
    if (evaluation.actualPumpHeadAvailable === true || results.actualPumpHeadAvailable === true) return true;
    return null;
  }

  function actualPumpHeadFromEvaluation(results = {}, evaluation = {}) {
    const availability = actualPumpHeadAvailability(results, evaluation);
    if (availability === false) return null;
    const actualHead = firstNumber(evaluation.actualPumpHead, results.actualPumpHead);
    if (availability === true) return actualHead;
    return firstNumber(evaluation.pumpHead, results.pumpHeadAtFlow, results.head);
  }

  function hydratePumpTopLevelResults(pump = {}) {
    const results = pump.results || {};
    const evaluation = results.npshEvaluation || {};
    if (!evaluation || typeof evaluation !== 'object' || evaluation === results) return false;
    const trace = evaluation.calculationTrace || results.calculationTrace || {};
    const route = results.routeTrace || evaluation.routeTrace || {};
    const npsha = firstNumber(evaluation.npsha, results.npsha);
    const npshr = firstNumber(evaluation.npshr, results.npshr, pump.props?.manualNpshr, pump.props?.designNpshr);
    const requiredNpsha = firstNumber(evaluation.requiredNpsha, results.requiredNpsha);
    const actualPumpHeadAvailabilityStatus = actualPumpHeadAvailability(results, evaluation);
    const actualPumpHead = actualPumpHeadFromEvaluation(results, evaluation);
    const actualPumpHeadAvailable = actualPumpHeadAvailabilityStatus === null
      ? (actualPumpHead !== null ? true : null)
      : actualPumpHeadAvailabilityStatus;
    const hydraulicFromNumbers = statusFromNpshNumbers(npsha, npshr, requiredNpsha);
    const hydraulicStatus = firstCompleteStatus(
      evaluation.hydraulicStatus,
      evaluation.hydraulicNpshStatus,
      results.hydraulicNpshStatus,
      results.cavitationStatus,
      hydraulicFromNumbers
    ) || hydraulicFromNumbers;
    const engineeringStatus = firstCompleteStatus(
      evaluation.engineeringStatus,
      results.engineeringStatus,
      evaluation.status,
      results.status,
      hydraulicStatus
    ) || hydraulicStatus;
    let changed = false;
    [
      ['flow', evaluation.flow],
      ['fixedFlow', evaluation.flow],
      ['head', actualPumpHead],
      ['actualPumpHead', actualPumpHead],
      ['pumpHeadAtFlow', actualPumpHead],
      ['actualPumpHeadAvailable', actualPumpHeadAvailable],
      ['requiredSystemHead', evaluation.requiredSystemHead],
      ['requiredSystemHeadRaw', evaluation.requiredSystemHeadRaw],
      ['requiredSystemHeadPositive', evaluation.requiredSystemHeadPositive],
      ['npsha', evaluation.npsha],
      ['npshr', evaluation.npshr],
      ['npshMargin', evaluation.npshMargin],
      ['npshRatio', evaluation.npshRatio],
      ['requiredNpsha', evaluation.requiredNpsha],
      ['npshExcess', evaluation.npshExcess],
      ['maxNpshrByRatio', evaluation.maxNpshrByRatio],
      ['maxNpshrByMargin', evaluation.maxNpshrByMargin],
      ['maxAllowableNpshr', evaluation.maxAllowableNpshr],
      ['suctionPressure', firstNumber(evaluation.suctionPressure, evaluation.suctionPressureAbs)],
      ['dischargePressure', firstNumber(evaluation.dischargePressure, evaluation.dischargePressureAbs)],
      ['suctionLoss', evaluation.suctionLoss],
      ['dischargeLoss', firstNumber(
        route.dischargeLoss?.headLoss,
        route.sections?.discharge?.totalLossM,
        trace.systemHead?.dischargeLoss,
        evaluation.dischargeLoss,
        results.dischargeLoss,
        results.requiredSystemHeadTrace?.dischargeLoss,
        results.systemHead?.dischargeLoss
      )],
      ['vaporPressureHead', evaluation.vaporPressureHead],
      ['suctionVelocityHead', evaluation.suctionVelocityHead]
    ].forEach(([key, value]) => {
      changed = writeResultIfUseful(results, key, value) || changed;
    });
    if (actualPumpHeadAvailable === false) {
      ['head', 'actualPumpHead', 'pumpHeadAtFlow', 'power', 'hydraulicPower'].forEach((key) => {
        if (results[key] !== null) {
          results[key] = null;
          changed = true;
        }
      });
      if (results.actualPumpHeadAvailable !== false) {
        results.actualPumpHeadAvailable = false;
        changed = true;
      }
    }
    [
      ['routeCalculationStatus', evaluation.routeCalculationStatus],
      ['npshaCalculationStatus', evaluation.npshaCalculationStatus],
      ['requiredPumpHeadStatus', evaluation.requiredPumpHeadStatus],
      ['maxAllowableNpshrStatus', evaluation.maxAllowableNpshrStatus],
      ['manualNpshrComparisonStatus', evaluation.manualNpshrComparisonStatus],
      ['vendorCurveVerificationStatus', evaluation.vendorCurveVerificationStatus],
      ['dataConfidence', evaluation.dataConfidence],
      ['npshrSource', evaluation.npshrSource],
      ['engineeringMessage', evaluation.engineeringMessage || evaluation.message],
      ['hydraulicMessage', evaluation.hydraulicMessage || evaluation.message]
    ].forEach(([key, value]) => {
      changed = writeResultIfUseful(results, key, value) || changed;
    });
    if (hydraulicStatus) {
      changed = writeResultIfUseful(results, 'hydraulicNpshStatus', hydraulicStatus, true) || changed;
      changed = writeResultIfUseful(results, 'cavitationStatus', hydraulicStatus, true) || changed;
    }
    if (engineeringStatus) {
      changed = writeResultIfUseful(results, 'engineeringStatus', engineeringStatus, true) || changed;
      changed = writeResultIfUseful(results, 'status', engineeringStatus, true) || changed;
    }
    pump.results = results;
    return changed;
  }

  function hydrateAllPumpTopLevelResults() {
    const model = runtimeModel();
    return Object.keys(model || {}).reduce((changed, id) => {
      const node = model[id];
      return node?.type === 'pump' ? (hydratePumpTopLevelResults(node) || changed) : changed;
    }, false);
  }

  function refreshCanvasPumpReadoutsIfNeeded(changed) {
    if (!changed || typeof root.setTimeout !== 'function') return false;
    if (canvasPumpReadoutRefreshTimer) return true;
    canvasPumpReadoutRefreshTimer = root.setTimeout(() => {
      canvasPumpReadoutRefreshTimer = 0;
      try {
        if (typeof root.drawConnections === 'function') root.drawConnections();
        if (typeof root.updateAllObjectOperatingStatusVisuals === 'function') {
          root.updateAllObjectOperatingStatusVisuals();
        } else if (typeof root.updateCanvasWarningPanel === 'function') {
          root.updateCanvasWarningPanel();
        }
      } catch (error) {
        console.warn(`${VERSION}: pump readout refresh failed.`, error);
      }
    }, 0);
    return true;
  }

  function trimZeros(text) {
    return String(text)
      .replace(/(\.\d*?[1-9])0+$/u, '$1')
      .replace(/\.0+$/u, '');
  }

  function formatNumber(value, digits = 3) {
    const parsed = toFiniteNumber(value);
    if (parsed === null) return '-';
    if (Object.is(parsed, -0) || Math.abs(parsed) < 10 ** -(digits + 1)) return '0';
    return trimZeros(parsed.toFixed(digits));
  }

  function formatWithUnit(value, unit = '', digits = 3) {
    const parsed = toFiniteNumber(value);
    if (parsed === null) {
      const text = firstText(value);
      return text || '-';
    }
    const numberText = formatNumber(parsed, digits);
    return unit ? `${numberText} ${unit}` : numberText;
  }

  function normalizeLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function findTraceStep(steps = [], title = '') {
    const desired = normalizeLabel(title);
    if (!desired) return null;
    return steps.find((step) => normalizeLabel(step?.title || step?.step || step?.label) === desired)
      || steps.find((step) => normalizeLabel(step?.title || step?.step || step?.label).includes(desired))
      || null;
  }

  function formatTraceResult(step, fallbackValue, fallbackUnit = '', digits = 3) {
    if (step && (step.result !== null && step.result !== undefined && step.result !== '')) {
      return formatWithUnit(step.result, step.unit || fallbackUnit, digits);
    }
    return formatWithUnit(fallbackValue, fallbackUnit, digits);
  }

  function parseSystemCurveDischargeLoss(steps = []) {
    const step = findTraceStep(steps, 'System Curve Head');
    const numbers = String(step?.substitution || '')
      .match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)
      ?.map((value) => Number(value))
      .filter(Number.isFinite) || [];
    return numbers.length >= 4 ? numbers[2] : null;
  }

  function routeTraceModel(results = {}, evaluation = {}) {
    return results.routeTrace || evaluation.routeTrace || {};
  }

  function routeSequenceText(route = {}, side = '') {
    const section = route.sections?.[side] || {};
    const sequence = Array.isArray(section.sequence)
      ? section.sequence
      : (Array.isArray(route[side]) ? route[side] : []);
    return firstText(section.text, sequence.join(' -> '), route.compactText, route.text);
  }

  function resolveDischargeLoss(results = {}, evaluation = {}, trace = {}, steps = []) {
    const route = routeTraceModel(results, evaluation);
    return firstNumber(
      route.dischargeLoss?.headLoss,
      route.sections?.discharge?.totalLossM,
      evaluation.dischargeLoss,
      evaluation.calculationTrace?.systemHead?.dischargeLoss,
      results.dischargeLoss,
      trace.systemHead?.dischargeLoss,
      results.requiredSystemHeadTrace?.dischargeLoss,
      results.systemHead?.dischargeLoss,
      parseSystemCurveDischargeLoss(steps)
    );
  }

  function resolveDischargePressureDrop(results = {}, evaluation = {}, trace = {}) {
    const route = routeTraceModel(results, evaluation);
    return firstNumber(
      route.dischargeLoss?.pressureDrop,
      route.sections?.discharge?.pressureDropBar,
      evaluation.dischargePressureDropBar,
      results.dischargePressureDropBar,
      trace.systemHead?.dischargePressureDropBar
    );
  }

  function dischargeRouteSourceText(results = {}, evaluation = {}) {
    const route = routeTraceModel(results, evaluation);
    return firstText(
      routeSequenceText(route, 'discharge'),
      'Backend route trace discharge section'
    );
  }

  function routeStepByType(results = {}, evaluation = {}, type = '') {
    const route = routeTraceModel(results, evaluation);
    return (Array.isArray(route.steps) ? route.steps : [])
      .find((step) => String(step?.type || '').toLowerCase() === String(type || '').toLowerCase()) || null;
  }

  function sinkRouteReadout(results = {}, evaluation = {}) {
    const step = routeStepByType(results, evaluation, 'sink') || {};
    const values = step.values || {};
    const hydraulicHead = firstNumber(values.hydraulicHeadM);
    const demandFlow = firstNumber(values.demandFlowM3H);
    const evaluatedFlow = firstNumber(values.evaluatedFlowM3H);
    const pressure = firstNumber(values.pressureBarA);
    const elevation = firstNumber(values.elevationM);
    const parts = [];
    if (hydraulicHead !== null) parts.push(`H=${formatWithUnit(hydraulicHead, 'm', 3)}`);
    if (evaluatedFlow !== null || demandFlow !== null) parts.push(`Q=${formatWithUnit(evaluatedFlow ?? demandFlow, 'm3/h', 3)}`);
    if (pressure !== null) parts.push(`P=${formatWithUnit(pressure, 'bar a', 3)}`);
    if (elevation !== null) parts.push(`z=${formatWithUnit(elevation, 'm', 3)}`);
    return {
      value: parts.join('; '),
      source: firstText(step.id, step.name, 'SNK') + ' downstream boundary -> system head'
    };
  }

  function sourceVelocityHeadExplanation(step, value) {
    const numeric = firstNumber(step?.result, value);
    const substitution = firstText(step?.substitution, formatWithUnit(value, 'm'));
    if (numeric === 0) {
      return `${substitution}; reservoir/source boundary velocity is neglected. v^2/(2g) is only added for External Header / Pipe Tie-in with static-pressure basis.`;
    }
    return substitution;
  }

  function addCalculationMatrixRow(rows, {
    output,
    input,
    formula,
    substitution,
    result,
    connectedTo,
    step = null
  }) {
    rows.push({
      output: output || '-',
      input: input || '-',
      formula: firstText(formula, step?.formula, '-'),
      substitution: firstText(substitution, step?.substitution, '-'),
      result: result || '-',
      connectedTo: connectedTo || '-'
    });
  }

  function buildCalculationMatrixRows(pumpId) {
    const { pump, results, evaluation, trace, steps } = pumpResult(pumpId);
    const props = pump.props || {};
    const interpretation = trace.interpretation || {};
    const boundary = trace.boundary || {};
    const tracePump = trace.pump || {};
    const losses = trace.losses || {};
    const criteria = evaluation.marginCriteria || evaluation.criteria || {};
    const rows = [];

    const systemCurveStep = findTraceStep(steps, 'Required Pump Head') || findTraceStep(steps, 'System Curve Head');
    const sourcePressureStep = findTraceStep(steps, 'Source Absolute Pressure');
    const pressureHeadStep = findTraceStep(steps, 'Pressure Head');
    const elevationHeadStep = findTraceStep(steps, 'Elevation Head');
    const suctionLossStep = findTraceStep(steps, 'Suction Loss');
    const sourceVelocityHeadStep = findTraceStep(steps, 'Source Velocity Head');
    const vaporHeadStep = findTraceStep(steps, 'Vapor Pressure Head');
    const npshaStep = findTraceStep(steps, 'NPSHa');
    const npshrStep = findTraceStep(steps, 'NPSHr');
    const marginRatioStep = findTraceStep(steps, 'Margin and Ratio');

    const flow = firstNumber(evaluation.flow, results.fixedFlow, results.flow, tracePump.flow, props.designFlow);
    const actualPumpHead = actualPumpHeadFromEvaluation(results, evaluation);
    const requiredPumpHead = firstNumber(evaluation.requiredSystemHead, results.requiredSystemHead, trace.systemHead?.requiredHead);
    const npsha = firstNumber(evaluation.npsha, results.npsha);
    const npshr = firstNumber(evaluation.npshr, results.npshr, props.manualNpshr, props.designNpshr);
    const npshMargin = firstNumber(evaluation.npshMargin, results.npshMargin, interpretation.margin, npsha !== null && npshr !== null ? npsha - npshr : null);
    const npshRatio = firstNumber(evaluation.npshRatio, results.npshRatio, interpretation.ratio, npsha !== null && npshr ? npsha / npshr : null);
    let requiredNpsha = firstNumber(evaluation.requiredNpsha, results.requiredNpsha, interpretation.requiredNpsha);
    let npshExcess = firstNumber(evaluation.npshExcess, results.npshExcess, interpretation.npshExcess);
    const suctionLoss = firstNumber(evaluation.suctionLoss, results.suctionLoss, losses.total);
    const suctionMajor = firstNumber(losses.major);
    const suctionMinor = firstNumber(losses.minor);
    const dischargeLoss = resolveDischargeLoss(results, evaluation, trace, steps);
    const dischargePressureDrop = resolveDischargePressureDrop(results, evaluation, trace);
    const dischargeRouteSource = dischargeRouteSourceText(results, evaluation);
    const pumpDatum = firstNumber(props.suctionElevation, props.elevation, tracePump.elevation);
    const sourcePressure = firstNumber(boundary.absolutePressureBar, boundary.pressureInput);
    const pressureHead = firstNumber(boundary.pressureHead);
    const sourceElevation = firstNumber(boundary.elevation);
    const sourceVelocityHead = firstNumber(boundary.velocityHead);
    const vaporPressureHead = firstNumber(trace.basis?.vaporPressureHead, vaporHeadStep?.result);
    const ratioLimit = firstNumber(criteria.ratio, interpretation.marginRatioLimit, props.minNpshMarginRatio);
    const absoluteMarginLimit = firstNumber(criteria.margin, interpretation.absoluteMarginLimit, props.minNpshMargin);
    const marginCriteriaStatus = criteriaAvailabilityStatus(ratioLimit, absoluteMarginLimit);
    const computedRequiredCandidates = requiredNpshaCandidates(npshr, ratioLimit, absoluteMarginLimit).map((candidate) => candidate.value);
    if (requiredNpsha === null && computedRequiredCandidates.length) {
      requiredNpsha = Math.max(...computedRequiredCandidates);
    }
    if (npshExcess === null && npsha !== null && requiredNpsha !== null) {
      npshExcess = npsha - requiredNpsha;
    }
    const hydraulicStatus = firstCompleteStatus(evaluation.hydraulicStatus, evaluation.status, results.hydraulicNpshStatus, results.cavitationStatus, interpretation.hydraulicStatus, statusFromNpshNumbers(npsha, npshr, requiredNpsha));
    const engineeringStatus = firstCompleteStatus(evaluation.engineeringStatus, results.engineeringStatus, results.status, interpretation.engineeringStatus, hydraulicStatus);
    const dataConfidence = firstText(evaluation.dataConfidence, results.dataConfidence, interpretation.dataConfidence);
    const suctionPressure = firstNumber(evaluation.suctionPressureAbs, results.suctionPressure);
    const dominantLoss = firstText(evaluation.dominantLoss, results.dominantSuctionLoss, trace.path?.dominantLoss);
    const reviewAction = firstText(evaluation.reviewAction, results.reviewAction, evaluation.engineeringMessage, evaluation.message, interpretation.engineeringMessage);
    const routeCalculationStatus = firstCompleteStatus(evaluation.routeCalculationStatus, results.routeCalculationStatus, interpretation.routeCalculationStatus)
      || (flow !== null && requiredPumpHead !== null ? 'Calculated' : 'Input Required');
    const npshaCalculationStatus = firstCompleteStatus(evaluation.npshaCalculationStatus, results.npshaCalculationStatus, interpretation.npshaCalculationStatus)
      || (npsha !== null ? 'Calculated' : 'Input Required');
    const requiredPumpHeadStatus = firstCompleteStatus(evaluation.requiredPumpHeadStatus, results.requiredPumpHeadStatus, interpretation.requiredPumpHeadStatus)
      || (requiredPumpHead !== null ? 'Calculated' : 'Input Required');
    addCalculationMatrixRow(rows, {
      output: 'Flow Evaluated',
      input: 'SNK demand flow / pump fixed-flow result / pump design flow',
      formula: 'Q_eval = solved network flow at pump',
      substitution: `results.fixedFlow=${formatWithUnit(results.fixedFlow, 'm3/h')}; results.flow=${formatWithUnit(results.flow, 'm3/h')}; props.designFlow=${formatWithUnit(props.designFlow, 'm3/h')}`,
      result: formatWithUnit(flow, 'm3/h', 3),
      connectedTo: 'Sink demand -> pump evaluated flow -> suction/discharge PFV velocity and loss'
    });
    addCalculationMatrixRow(rows, {
      output: 'Pump Datum Elev.',
      input: 'Pump input props.suctionElevation',
      formula: 'z_pump = Pump Datum Elev.',
      substitution: `props.suctionElevation=${formatWithUnit(props.suctionElevation, 'm')}; props.elevation fallback=${formatWithUnit(props.elevation, 'm')}`,
      result: formatWithUnit(pumpDatum, 'm', 3),
      connectedTo: 'Pump input -> Elevation Head -> NPSHa',
      step: elevationHeadStep
    });
    addCalculationMatrixRow(rows, {
      output: 'Required Pump Head',
      input: 'Route flow, SRC/SNK boundary heads, suction loss, and discharge PFV loss',
      formula: 'H_required(Q) = H_discharge boundary - H_suction boundary + hL_suction(Q) + hL_discharge(Q)',
      substitution: systemCurveStep?.substitution || `Q=${formatWithUnit(flow, 'm3/h')}; H_required=${formatWithUnit(requiredPumpHead, 'm')}`,
      result: formatWithUnit(requiredPumpHead, 'm', 3),
      connectedTo: 'Route calculation -> pump selection/design head',
      step: systemCurveStep
    });
    addCalculationMatrixRow(rows, {
      output: 'Actual Pump Head',
      input: 'Pump curve, vendor curve, or test curve at the evaluated duty flow',
      formula: 'H_actual(Q) = H_pump(Q) from verified pump performance data',
      substitution: actualPumpHead === null ? 'No actual pump performance curve/data is active for this route-only duty.' : `H_actual=${formatWithUnit(actualPumpHead, 'm')}`,
      result: actualPumpHead === null ? 'Not available' : formatWithUnit(actualPumpHead, 'm', 3),
      connectedTo: 'Actual Pump Head -> pump power and head residual'
    });
    addCalculationMatrixRow(rows, {
      output: 'Route System Head',
      input: 'SRC/SNK boundary heads plus suction and discharge PFV losses',
      formula: 'H_system(Q) = H_static + hL_suction(Q) + hL_discharge(Q)',
      substitution: systemCurveStep?.substitution,
      result: formatTraceResult(systemCurveStep, requiredPumpHead, 'm', 3),
      connectedTo: 'Source -> PFV suction -> pump -> PFV discharge -> sink',
      step: systemCurveStep
    });
    addCalculationMatrixRow(rows, {
      output: 'Route Calculation Status',
      input: 'Complete suction/discharge route, Fluid Basis, and boundary flow',
      formula: 'Route status = Calculated when the route trace has flow and boundary heads',
      substitution: `Flow=${formatWithUnit(flow, 'm3/h')}; Required head=${formatWithUnit(requiredPumpHead, 'm')}`,
      result: routeCalculationStatus,
      connectedTo: 'Backend route calculation -> canvas pump label/report live'
    });
    addCalculationMatrixRow(rows, {
      output: 'Required Pump Head Status',
      input: 'Route system-head result',
      formula: 'Required pump head status = Calculated when H_required is available',
      substitution: `H_required=${formatWithUnit(requiredPumpHead, 'm')}`,
      result: requiredPumpHeadStatus,
      connectedTo: 'Required Pump Head -> pump design selection'
    });
    addCalculationMatrixRow(rows, {
      output: 'Discharge Loss',
      input: 'Discharge PFV major and minor loss trace',
      formula: 'hL_discharge = sum major hL + sum minor hL + allowance',
      substitution: `routeTrace discharge=${formatWithUnit(dischargeLoss, 'm')}; pressureDrop=${formatWithUnit(dischargePressureDrop, 'bar', 4)}`,
      result: formatWithUnit(dischargeLoss, 'm', 3),
      connectedTo: `${dischargeRouteSource} -> system head/outlet pressure`
    });
    addCalculationMatrixRow(rows, {
      output: 'Source Absolute Pressure',
      input: 'SRC pressure input and pressure basis',
      formula: 'Pabs = Pgauge + Patm, or Pabs input when basis is absolute',
      substitution: sourcePressureStep?.substitution || `boundary.absolutePressureBar=${formatWithUnit(sourcePressure, 'bar a')}`,
      result: formatTraceResult(sourcePressureStep, sourcePressure, 'bar a', 3),
      connectedTo: 'Source boundary -> Pressure Head -> NPSHa',
      step: sourcePressureStep
    });
    addCalculationMatrixRow(rows, {
      output: 'Pressure Head',
      input: 'Source absolute pressure and Fluid Basis density',
      formula: 'Hp = Pabs x 100000 / (rho x g)',
      substitution: pressureHeadStep?.substitution,
      result: formatTraceResult(pressureHeadStep, pressureHead, 'm', 3),
      connectedTo: 'Fluid Basis density + SRC pressure -> NPSHa',
      step: pressureHeadStep
    });
    addCalculationMatrixRow(rows, {
      output: 'Elevation Head',
      input: 'SRC elevation and Pump Datum Elev.',
      formula: 'Hz = z_source - z_pump',
      substitution: elevationHeadStep?.substitution || `${formatWithUnit(sourceElevation, 'm')} - ${formatWithUnit(pumpDatum, 'm')}`,
      result: formatTraceResult(elevationHeadStep, sourceElevation !== null && pumpDatum !== null ? sourceElevation - pumpDatum : null, 'm', 3),
      connectedTo: 'Source/PFV elevation profile + Pump Datum Elev. -> NPSHa',
      step: elevationHeadStep
    });
    addCalculationMatrixRow(rows, {
      output: 'Source Velocity Head',
      input: 'Source pressure-energy basis and inlet velocity',
      formula: 'Hvel = 0 for reservoir/source pressure boundary; Hvel = v^2 / (2g) only for external pipe tie-in static pressure',
      substitution: sourceVelocityHeadExplanation(sourceVelocityHeadStep, sourceVelocityHead),
      result: formatTraceResult(sourceVelocityHeadStep, sourceVelocityHead, 'm', 3),
      connectedTo: 'Source boundary basis -> NPSHa'
    });
    addCalculationMatrixRow(rows, {
      output: 'Suction Loss',
      input: 'Suction PFV major and minor loss trace',
      formula: 'hL_suction = sum major hL + sum minor hL + allowance',
      substitution: suctionLossStep?.substitution || `${formatWithUnit(suctionMajor, 'm')} + ${formatWithUnit(suctionMinor, 'm')} = ${formatWithUnit(suctionLoss, 'm')}`,
      result: formatWithUnit(suctionLoss, 'm', 3),
      connectedTo: 'Suction Pipe/Fitting/Valve -> NPSHa subtraction and dominant loss',
      step: suctionLossStep
    });
    addCalculationMatrixRow(rows, {
      output: 'Vapor Pressure Head',
      input: 'Fluid Basis vapor pressure and density',
      formula: 'Hv = Pv x 100000 / (rho x g)',
      substitution: vaporHeadStep?.substitution,
      result: formatTraceResult(vaporHeadStep, vaporPressureHead, 'm', 3),
      connectedTo: 'Fluid Basis -> NPSHa subtraction',
      step: vaporHeadStep
    });
    addCalculationMatrixRow(rows, {
      output: 'NPSHa',
      input: 'Source pressure head, source elevation, source velocity head, Pump Datum Elev., suction loss, vapor pressure head',
      formula: 'NPSHa = Hp + z_source + Hvel - z_pump - hL_suction - Hv',
      substitution: npshaStep?.substitution,
      result: formatTraceResult(npshaStep, npsha, 'm', 4),
      connectedTo: 'SRC + Fluid Basis + suction PFV + Pump Datum Elev. -> NPSH Evaluation Report',
      step: npshaStep
    });
    addCalculationMatrixRow(rows, {
      output: 'NPSHa Calculation Status',
      input: 'Pressure head, elevation head, suction loss, and vapor pressure head',
      formula: 'NPSHa status = Calculated when every NPSHa term is available',
      substitution: `NPSHa=${formatWithUnit(npsha, 'm', 4)}`,
      result: npshaCalculationStatus,
      connectedTo: 'NPSHa -> NPSH margin, ratio, and hydraulic status'
    });
    addCalculationMatrixRow(rows, {
      output: 'NPSHr',
      input: 'Manual NPSHr input or verified vendor/journal NPSHr value if provided',
      formula: 'NPSHr = entered pump-side required NPSH for the evaluated duty',
      substitution: npshrStep?.substitution || `Q=${formatWithUnit(flow, 'm3/h')} -> NPSHr=${formatWithUnit(npshr, 'm')}`,
      result: formatTraceResult(npshrStep, npshr, 'm', 4),
      connectedTo: 'Manual NPSHr -> NPSH margin and ratio comparison',
      step: npshrStep
    });
    addCalculationMatrixRow(rows, {
      output: 'Effective NPSH Ratio',
      input: 'Selected NPSH Margin Basis',
      formula: 'Ratio limit = selected ANSI/HI/user basis',
      substitution: `basis=${firstText(criteria.basis, interpretation.marginBasis, props.npshMarginBasis, '-')}; ratio=${formatNumber(ratioLimit, 3)}`,
      result: formatNumber(ratioLimit, 3),
      connectedTo: 'NPSH Acceptance Criteria -> cavitation-risk comparison'
    });
    addCalculationMatrixRow(rows, {
      output: 'Effective NPSH Margin',
      input: 'Selected NPSH Margin Basis',
      formula: 'Absolute margin limit = selected ANSI/HI/user basis',
      substitution: `basis=${firstText(criteria.basis, interpretation.marginBasis, props.npshMarginBasis, '-')}; margin=${formatWithUnit(absoluteMarginLimit, 'm', 3)}`,
      result: formatWithUnit(absoluteMarginLimit, 'm', 3),
      connectedTo: 'NPSH Acceptance Criteria -> cavitation-risk comparison'
    });
    addCalculationMatrixRow(rows, {
      output: 'NPSH Margin',
      input: 'NPSHa and NPSHr',
      formula: 'Margin = NPSHa - NPSHr',
      substitution: `${formatNumber(npsha, 4)} - ${formatNumber(npshr, 4)} = ${formatNumber(npshMargin, 4)} m`,
      result: formatWithUnit(npshMargin, 'm', 4),
      connectedTo: 'NPSHa/NPSHr -> NPSH Evaluation Report',
      step: marginRatioStep
    });
    addCalculationMatrixRow(rows, {
      output: 'NPSH Ratio',
      input: 'NPSHa and NPSHr',
      formula: 'Ratio = NPSHa / NPSHr',
      substitution: `${formatNumber(npsha, 4)} / ${formatNumber(npshr, 4)} = ${formatNumber(npshRatio, 4)}`,
      result: formatNumber(npshRatio, 4),
      connectedTo: 'NPSHa/NPSHr -> acceptance screening',
      step: marginRatioStep
    });
    addCalculationMatrixRow(rows, {
      output: 'Hydraulic NPSH Status',
      input: 'NPSHa, NPSHr, NPSH margin, and NPSH ratio',
      formula: 'Status = OK when the live NPSH margin and ratio satisfy the selected acceptance criteria; Warning/Risk otherwise',
      substitution: `NPSHa=${formatWithUnit(npsha, 'm')}; NPSHr=${formatWithUnit(npshr, 'm')}; Margin=${formatWithUnit(npshMargin, 'm')}; Ratio=${formatNumber(npshRatio, 4)}`,
      result: hydraulicStatus || '-',
      connectedTo: 'Acceptance criteria -> NPSH Evaluation Report'
    });
    addCalculationMatrixRow(rows, {
      output: 'Engineering Status',
      input: 'Hydraulic status and NPSHr source/data confidence',
      formula: 'Engineering status = hydraulic status + NPSHr data confidence gate',
      substitution: `Hydraulic=${hydraulicStatus || '-'}; Data confidence=${dataConfidence || '-'}`,
      result: engineeringStatus || '-',
      connectedTo: 'Pump Formula Defense + NPSH Evaluation Report'
    });
    addCalculationMatrixRow(rows, {
      output: 'Suction Pressure',
      input: 'Pump suction-side hydraulic solution',
      formula: 'P_suction = pressure at pump inlet after suction PFV pressure drop',
      substitution: `results.suctionPressure=${formatWithUnit(results.suctionPressure, 'bar a')}; evaluation.suctionPressureAbs=${formatWithUnit(evaluation.suctionPressureAbs, 'bar a')}`,
      result: formatWithUnit(suctionPressure, 'bar a', 4),
      connectedTo: 'Suction PFV outlet -> Pump inlet readout'
    });
    addCalculationMatrixRow(rows, {
      output: 'Dominant Loss',
      input: 'Suction loss breakdown',
      formula: 'Dominant loss = max(item total hL) on suction path',
      substitution: dominantLoss || '-',
      result: dominantLoss || '-',
      connectedTo: 'Suction PFV breakdown -> review action'
    });
    addCalculationMatrixRow(rows, {
      output: 'Review Action',
      input: 'Engineering status, hydraulic status, and source confidence',
      formula: 'Review action = message from status gate and source confidence',
      substitution: reviewAction || '-',
      result: reviewAction || '-',
      connectedTo: 'NPSH Evaluation Report advisor text'
    });

    return rows;
  }

  function renderCalculationMatrix(pumpId) {
    const rows = buildCalculationMatrixRows(pumpId);
    const body = rows.map((row, index) => `
      <tr>
        <td style="vertical-align:top;padding:6px;border-top:1px solid #dbeafe;font-weight:700;color:#0f365d;">${index + 1}. ${escapeHtml(row.output)}</td>
        <td style="vertical-align:top;padding:6px;border-top:1px solid #dbeafe;">${escapeHtml(row.input)}</td>
        <td style="vertical-align:top;padding:6px;border-top:1px solid #dbeafe;font-family:Consolas,monospace;color:#0f172a;">${escapeHtml(row.formula)}</td>
        <td style="vertical-align:top;padding:6px;border-top:1px solid #dbeafe;">${escapeHtml(row.substitution)}</td>
        <td style="vertical-align:top;padding:6px;border-top:1px solid #dbeafe;font-weight:800;color:#075985;white-space:nowrap;">${escapeHtml(row.result)}</td>
        <td style="vertical-align:top;padding:6px;border-top:1px solid #dbeafe;">${escapeHtml(row.connectedTo)}</td>
      </tr>
    `).join('');
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
        <div>
          <div style="font-size:12px;font-weight:800;color:#0f365d;">Matriks Kalkulasi Pump NPSH</div>
          <div style="font-size:11px;color:#475569;">Input -> formula sistem -> output angka; semua baris membaca model dan calculation trace aktif.</div>
        </div>
        <span style="font-size:10px;font-weight:700;color:#0f5132;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:5px;padding:3px 6px;">Live linked</span>
      </div>
      <div style="overflow-x:auto;">
        <table data-pump-calculation-matrix-table style="width:100%;border-collapse:collapse;min-width:980px;font-size:11px;line-height:1.35;background:#fff;">
          <thead>
            <tr style="background:#eaf5ff;color:#17395a;text-align:left;">
              <th style="padding:6px;">Output angka</th>
              <th style="padding:6px;">Input/link sumber</th>
              <th style="padding:6px;">Rumus sistem</th>
              <th style="padding:6px;">Substitusi aktif</th>
              <th style="padding:6px;">Hasil</th>
              <th style="padding:6px;">Terhubung ke</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function buildSummary(pumpId) {
    const { pump, results, evaluation, trace, rows, steps } = pumpResult(pumpId);
    const props = pump.props || {};
    const criteria = evaluation.marginCriteria || evaluation.criteria || trace.interpretation?.criteria || {};
    const ratioLimit = firstNumber(criteria.ratio, trace.interpretation?.marginRatioLimit, props.minNpshMarginRatio);
    const absoluteMarginLimit = firstNumber(criteria.margin, trace.interpretation?.absoluteMarginLimit, props.minNpshMargin);
    const marginCriteriaStatus = criteriaAvailabilityStatus(ratioLimit, absoluteMarginLimit);
    const action = results.actionReadinessBackend || results.backendActionReadiness || results.actionReadinessFrontend || {};
    const exportReady = root.EngineeringDefenseExportPackage ? 'Ready' : 'Unavailable';
    const releaseIntegrity = root.EngineeringLibraryGovernance ? 'Loaded' : 'Not loaded';
    const pageLock = trace.formulaDefenseSchemaVersion || rows.length ? 'Locked' : (steps.length ? 'Trace fallback' : 'Missing');
    const freshness = results.isCalculationStale || action.stale || action.isStale
      ? 'Stale'
      : (results.calculationFreshness || action.freshness || 'Fresh');
    const calculationBasis = firstText(results.solveMode, evaluation.solveMode, results.flowBasis, evaluation.flowBasis, 'Route/design calculation');
    const npshrSource = firstText(evaluation.npshrSource, results.npshrSource, props.npshrSourceMode, 'Manual NPSHr');
    const curveBasis = firstText(
      evaluation.curveBasis,
      results.curveBasis,
      results.curveDataSource,
      props.curveDataSource,
      props.npshrSourceMode,
      npshrSource
    );
    const routeStatus = firstCompleteStatus(evaluation.routeCalculationStatus, results.routeCalculationStatus, trace.interpretation?.routeCalculationStatus) || '-';
    const marginBasis = firstText(criteria.basis, trace.interpretation?.marginBasis, props.npshMarginBasis, 'General Purpose');
    return {
      pageLock,
      releaseIntegrity,
      exportReady,
      freshness,
      calculationBasis,
      npshrSource,
      curveBasis,
      routeStatus,
      marginBasis,
      marginCriteriaStatus,
      rowCount: rows.length,
      stepCount: steps.length
    };
  }

  function badge(label, value) {
    const text = String(value || '-');
    const lower = text.toLowerCase();
    const color = lower.includes('stale') || lower.includes('missing') || lower.includes('unavailable') || lower.includes('not loaded')
      ? '#92400e'
      : '#0f5132';
    const bg = lower.includes('stale') || lower.includes('missing') || lower.includes('unavailable') || lower.includes('not loaded')
      ? '#fff7ed'
      : '#ecfdf5';
    return `<span style="display:inline-flex;align-items:center;gap:4px;min-height:24px;padding:3px 8px;border:1px solid #cbd5e1;border-radius:6px;background:${bg};color:${color};font-size:11px;font-weight:700;line-height:1.2;"><span style="color:#475569;font-weight:600;">${escapeHtml(label)}</span>${escapeHtml(text)}</span>`;
  }

  function ensurePanel(windowNode, selector, attributeName, position) {
    let panel = windowNode.querySelector(selector);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.setAttribute(attributeName, 'true');
    panel.style.cssText = 'margin:8px 0;padding:8px;border:1px solid #d6e4f2;border-radius:6px;background:#f8fbff;color:#17395a;';
    const anchor = windowNode.querySelector('.task-window-body, .window-body, .task-content, .task-window-content, .modal-body') || windowNode;
    if (position === 'after-badges') {
      const badges = windowNode.querySelector(BADGE_SELECTOR);
      badges?.insertAdjacentElement('afterend', panel) || anchor.insertBefore(panel, anchor.firstChild);
    } else if (position === 'after-summary') {
      const summary = windowNode.querySelector(SUMMARY_SELECTOR);
      summary?.insertAdjacentElement('afterend', panel) || anchor.insertBefore(panel, anchor.firstChild);
    } else {
      anchor.insertBefore(panel, anchor.firstChild);
    }
    return panel;
  }

  function pruneLegacyPumpFormulaDefenseContent(windowNode) {
    if (!windowNode?.querySelectorAll) return 0;
    const anchor = windowNode.querySelector('.task-window-body, .window-body, .task-content, .task-window-content, .modal-body') || windowNode;
    const protectedSelector = [
      BADGE_SELECTOR,
      SUMMARY_SELECTOR,
      MATRIX_SELECTOR,
      '.task-window-header',
      '[data-pump-formula-defense-live-badges]',
      '[data-pump-formula-defense-vendor-summary]',
      '[data-pump-calculation-matrix]'
    ].join(',');
    const legacyPattern = /Short Answer for Advisor|Current Calculation Summary|Formula Sequence|Source & Confidence Map|Review Notes\s*\/\s*Warnings|Required NPSHa|Maximum Allowable NPSHr|Manual NPSHr Comparison|Vendor Curve Verification|NPSH Excess|Route NPSHa and maximum allowable NPSHr|Volumetric Flow\s*Volumetric Flow/i;
    let changed = 0;
    Array.from(anchor.children || []).forEach((element) => {
      if (!element || element.matches?.(protectedSelector) || element.querySelector?.(protectedSelector)) return;
      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!legacyPattern.test(text)) return;
      element.remove();
      changed += 1;
    });
    Array.from(anchor.querySelectorAll?.('section, article, details, table, tr, .formula-defense-card, .pump-formula-defense-card, .pump-defense-section, .fluid-help-metric, .prop-card') || []).forEach((element) => {
      if (!element || element.matches?.(protectedSelector) || element.querySelector?.(protectedSelector)) return;
      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!legacyPattern.test(text)) return;
      element.remove();
      changed += 1;
    });
    if (changed && windowNode.dataset) windowNode.dataset.pumpFormulaDefenseLegacyPruned = VERSION;
    return changed;
  }

  function hydrateRouteTraceDischargeReadout(windowNode, pumpId) {
    if (!windowNode?.querySelectorAll) return false;
    const { results, evaluation, trace, steps } = pumpResult(pumpId);
    const dischargeLoss = resolveDischargeLoss(results, evaluation, trace, steps);
    if (dischargeLoss === null) return false;
    const valueText = formatWithUnit(dischargeLoss, 'm', 3);
    const sourceText = dischargeRouteSourceText(results, evaluation);
    let changed = false;
    Array.from(windowNode.querySelectorAll('tr')).forEach((row) => {
      if (!/Pipe\/Fitting\/Valve\s+discharge/i.test(String(row.textContent || ''))) return;
      const cells = Array.from(row.querySelectorAll?.('td, th') || row.children || []);
      if (cells.length < 2) return;
      const liveValueCell = cells[1];
      const sourceCell = cells[2] || null;
      const currentValue = String(liveValueCell.textContent || '').trim();
      if (!currentValue || currentValue === '-') {
        liveValueCell.textContent = valueText;
        changed = true;
      }
      if (sourceCell) {
        const currentSource = String(sourceCell.textContent || '').trim();
        if (!currentSource || currentSource === '-') {
          sourceCell.textContent = sourceText;
          changed = true;
        }
      }
      row.dataset.pumpDischargeRouteTraceHydrated = VERSION;
      liveValueCell.title = 'Discharge PFV loss affects system head and outlet pressure; it is not subtracted directly from NPSHa.';
    });
    return changed;
  }

  function hydrateRouteTraceSinkReadout(windowNode, pumpId) {
    if (!windowNode?.querySelectorAll) return false;
    const { results, evaluation } = pumpResult(pumpId);
    const readout = sinkRouteReadout(results, evaluation);
    if (!readout.value) return false;
    let changed = false;
    Array.from(windowNode.querySelectorAll('tr')).forEach((row) => {
      const cells = Array.from(row.querySelectorAll?.('td, th') || row.children || []);
      const label = String(cells[0]?.textContent || row.textContent || '').trim();
      if (!/^SNK\b/i.test(label) || cells.length < 2) return;
      const liveValueCell = cells[1];
      const sourceCell = cells[2] || null;
      const currentValue = String(liveValueCell.textContent || '').trim();
      if (!currentValue || currentValue === '-') {
        liveValueCell.textContent = readout.value;
        changed = true;
      }
      if (sourceCell) {
        const currentSource = String(sourceCell.textContent || '').trim();
        if (!currentSource || currentSource === '-' || /Downstream boundary from route trace/i.test(currentSource)) {
          sourceCell.textContent = readout.source;
          changed = true;
        }
      }
      row.dataset.pumpSinkRouteTraceHydrated = VERSION;
      liveValueCell.title = 'SNK closes the downstream boundary for system head and pump duty; it is not a direct NPSHa term.';
    });
    return changed;
  }

  function injectIntoWindow(windowNode, pumpId) {
    if (!windowNode) return;
    const summary = buildSummary(pumpId || windowNode.dataset?.pumpId);
    const badges = ensurePanel(windowNode, BADGE_SELECTOR, 'data-pump-formula-defense-live-badges');
    badges.innerHTML = [
      badge('Page Lock', summary.pageLock),
      badge('Release Integrity', summary.releaseIntegrity),
      badge('Defense Export', summary.exportReady),
      badge('Freshness', summary.freshness)
    ].join(' ');

    const vendor = ensurePanel(windowNode, SUMMARY_SELECTOR, 'data-pump-formula-defense-vendor-summary', 'after-badges');
    vendor.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;font-size:11px;line-height:1.3;">
        <div><span style="color:#64748b;">Calculation Basis</span><strong style="display:block;">${escapeHtml(summary.calculationBasis)}</strong></div>
        <div><span style="color:#64748b;">NPSHr Source</span><strong style="display:block;">${escapeHtml(summary.npshrSource)}</strong></div>
        <div><span style="color:#64748b;">Trace Rows</span><strong style="display:block;">${escapeHtml(summary.rowCount)} / ${escapeHtml(summary.stepCount)}</strong></div>
        <div><span style="color:#64748b;">Route Status</span><strong style="display:block;">${escapeHtml(summary.routeStatus)}</strong></div>
        <div><span style="color:#64748b;">Curve Basis</span><strong style="display:block;">${escapeHtml(summary.curveBasis)}</strong></div>
        <div><span style="color:#64748b;">NPSH Margin Basis</span><strong style="display:block;">${escapeHtml(summary.marginBasis)}</strong></div>
      </div>
    `;

    const matrix = ensurePanel(windowNode, MATRIX_SELECTOR, 'data-pump-calculation-matrix', 'after-summary');
    matrix.innerHTML = renderCalculationMatrix(pumpId || windowNode.dataset?.pumpId);
    hydrateRouteTraceDischargeReadout(windowNode, pumpId || windowNode.dataset?.pumpId);
    hydrateRouteTraceSinkReadout(windowNode, pumpId || windowNode.dataset?.pumpId);
    pruneLegacyPumpFormulaDefenseContent(windowNode);
  }

  function refreshPumpFormulaDefenseAudit(pumpId) {
    const id = resolvePumpId(pumpId);
    if (!hasDocument()) return 0;
    let refreshed = 0;
    document.querySelectorAll(WINDOW_SELECTOR).forEach((windowNode) => injectIntoWindow(windowNode, id));
    document.querySelectorAll(WINDOW_SELECTOR).forEach(() => { refreshed += 1; });
    return refreshed;
  }

  function refreshOpenFormulaDefenseWindows(pumpId = '', options = {}) {
    if (!hasDocument()) return 0;
    const windows = Array.from(document.querySelectorAll(WINDOW_SELECTOR));
    if (!windows.length) return 0;
    const ids = [...new Set(windows.map((windowNode) => resolvePumpId(pumpId || datasetPumpId(windowNode))).filter(Boolean))];
    let refreshed = 0;
    if (options.rebuild !== false && typeof root.refreshPumpFormulaDefenseWindowContent === 'function' && !refreshingWindowContent) {
      refreshingWindowContent = true;
      try {
        windows.forEach((windowNode) => {
          root.refreshPumpFormulaDefenseWindowContent(windowNode, options);
          refreshed += 1;
        });
      } catch (error) {
        console.warn(`${VERSION}: Pump Formula Defense content refresh failed; live badges will still refresh.`, error);
      } finally {
        refreshingWindowContent = false;
      }
    }
    refreshed += refreshPumpFormulaDefenseAudit(pumpId);
    root.__pumpFormulaDefenseLiveAuditLastRefresh = {
      version: VERSION,
      pumpIds: ids,
      refreshed,
      reason: options.reason || 'manual',
      refreshedAt: new Date().toISOString()
    };
    return refreshed;
  }

  function scheduleOpenFormulaDefenseWindowRefresh(pumpId = '', options = {}) {
    if (!root.setTimeout || !root.clearTimeout) {
      return refreshOpenFormulaDefenseWindows(pumpId, options);
    }
    const delayMs = Number.isFinite(Number(options.delayMs)) ? Math.max(0, Number(options.delayMs)) : 180;
    const governedDelayMs = options.forceImmediate ? delayMs : Math.max(140, delayMs);
    const governor = root.EngineeringPerformanceRefreshGovernor;
    if (governor && typeof governor.schedule === 'function') {
      return governor.schedule('pump-formula-defense-window', pumpId || '', {
        delayMs: governedDelayMs,
        reason: options.reason || 'pump formula defense refresh',
        run: () => refreshOpenFormulaDefenseWindows(pumpId, options)
      });
    }
    root.clearTimeout(windowRefreshTimer);
    windowRefreshTimer = root.setTimeout(() => {
      refreshOpenFormulaDefenseWindows(pumpId, options);
    }, governedDelayMs);
    return true;
  }

  function visibleFormulaDefenseWindows() {
    if (!hasDocument()) return [];
    return Array.from(document.querySelectorAll(WINDOW_SELECTOR))
      .filter((windowNode) => windowNode.offsetParent !== null || windowNode.getClientRects().length);
  }

  function visibleFormulaDefensePumpIds(pumpId) {
    if (!hasDocument()) return pumpId ? [resolvePumpId(pumpId)].filter(Boolean) : [];
    const windows = visibleFormulaDefenseWindows();
    if (!windows.length) return [];
    const ids = windows
      .map((windowNode) => resolvePumpId(pumpId || datasetPumpId(windowNode)))
      .filter(Boolean);
    return [...new Set(ids.length ? ids : [resolvePumpId(pumpId)])].filter(Boolean);
  }

  function inputTokens(target) {
    if (!target) return '';
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
    ].filter(Boolean).join(' ');
  }

  function resolvePumpIdFromTarget(target) {
    const holder = target?.closest?.('[data-node], [data-node-id], [data-pump-node-id], [data-task-node-id]');
    const candidate = target?.dataset?.node
      || target?.dataset?.nodeId
      || target?.dataset?.pumpNodeId
      || holder?.dataset?.node
      || holder?.dataset?.nodeId
      || holder?.dataset?.pumpNodeId
      || holder?.dataset?.taskNodeId
      || '';
    return resolvePumpId(candidate);
  }

  function isFormulaDefenseLiveInput(target) {
    if (!target || !target.matches?.('input, select, textarea')) return false;
    if (target.disabled || target.readOnly || target.type === 'file') return false;
    if (target.closest?.('#pumpCurveTable') && /^(flow|head|eff|npshr)$/i.test(String(target.dataset?.field || ''))) return true;
    const insideLiveEditor = target.closest?.('.task-window, .full-editor-modal, .canvas-task-window, #taskWindowBody, [data-task-prop-body="true"]');
    return !!insideLiveEditor && LIVE_INPUT_PATTERN.test(inputTokens(target));
  }

  function bindRealtimeEvents() {
    if (!hasDocument() || document.__pumpFormulaDefenseLiveAuditRealtimeEventsBound) return false;
    const onRealtimeEvent = (event) => {
      const detail = event?.detail || {};
      const pumpId = detail.nodeId || detail.pumpId || detail.selectedNodeId || '';
      refreshCanvasPumpReadoutsIfNeeded(hydrateAllPumpTopLevelResults());
      if ((event.type === 'npsh:calculation-stale' || event.type === 'npsh:calculation-calculating') && isInputLatencyShieldActive(pumpId)) {
        return;
      }
      const shouldRebuild = event.type === 'npsh:calculation-current'
        || event.type === 'npsh:linked-views-refreshed'
        || event.type === 'npsh:realtime-autosolve-complete';
      scheduleOpenFormulaDefenseWindowRefresh(pumpId, {
        reason: event.type,
        rebuild: shouldRebuild,
        delayMs: event.type === 'npsh:calculation-current' || event.type === 'npsh:linked-views-refreshed' ? 180 : 220
      });
    };
    REALTIME_EVENTS.forEach((name) => document.addEventListener(name, onRealtimeEvent));
    document.__pumpFormulaDefenseLiveAuditRealtimeEventsBound = true;
    return true;
  }

  function bindLiveInputRefresh() {
    if (!hasDocument() || document.__pumpFormulaDefenseLiveAuditInputBound) return false;
    const onInput = (event) => {
      if (event?.isComposing || !isFormulaDefenseLiveInput(event.target)) return;
      const pumpId = resolvePumpIdFromTarget(event.target);
      if (isInputLatencyShieldActive(pumpId)) return;
      scheduleOpenFormulaDefenseWindowRefresh(pumpId, {
        reason: 'live-input',
        rebuild: false,
        delayMs: 180
      });
    };
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    document.__pumpFormulaDefenseLiveAuditInputBound = true;
    return true;
  }

  async function refreshBackendForFormulaDefense(pumpId) {
    const pumpIds = visibleFormulaDefensePumpIds(pumpId);
    if (!pumpIds.length || backendRefreshBusy) {
      refreshOpenFormulaDefenseWindows(pumpId, { reason: 'backend-refresh-skipped', rebuild: false });
      return;
    }
    backendRefreshBusy = true;
    try {
      let applied = false;
      if (typeof root.runBackendProtectedPumpSimulation === 'function') {
        for (const id of pumpIds) {
          const result = await root.runBackendProtectedPumpSimulation(id, {
            refreshReason: 'solve',
            force: true,
            allowExternalApiOnLocal: true,
            backendMode: 'primary',
            primaryBackend: true,
            useBackendPrimary: true,
            protectedFrontend: true
          });
          applied = applied || result?.primaryApplied === true;
        }
      }
      if (!applied) {
        for (const id of pumpIds) {
          applied = await directBackendFormulaDefenseRefresh(id) || applied;
        }
      }
      if (typeof root.refreshBackendProtectedRealtimeTaskWindows === 'function') {
        root.refreshBackendProtectedRealtimeTaskWindows('pump-formula-defense-live-audit', { renderSidebarAfter: false });
      }
    } catch (error) {
      console.warn(`${VERSION}: backend formula defense refresh failed.`, error);
    } finally {
      backendRefreshBusy = false;
      refreshOpenFormulaDefenseWindows(pumpId, { reason: 'backend-refresh-complete' });
    }
  }

  function scheduleBackendFormulaDefenseRefresh(pumpId) {
    root.clearTimeout(backendRefreshTimer);
    backendRefreshTimer = root.setTimeout(() => {
      refreshBackendForFormulaDefense(pumpId);
    }, 220);
  }

  async function directBackendFormulaDefenseRefresh(pumpId) {
    if (typeof root.fetch !== 'function' || typeof root.buildBackendSimulationPayload !== 'function') return false;
    const model = runtimeModel();
    const pump = model[pumpId];
    if (!pump || pump.type !== 'pump') return false;
    const payload = root.buildBackendSimulationPayload(pumpId, {
      backendMode: 'primary',
      primaryBackend: true,
      useBackendPrimary: true,
      protectedFrontend: true,
      model,
      connections: typeof connections !== 'undefined' ? connections : [],
      sourceLinks: typeof sourceLinks !== 'undefined' ? sourceLinks : [],
      instrumentLinks: typeof instrumentLinks !== 'undefined' ? instrumentLinks : []
    });
    payload.client = {
      ...(payload.client || {}),
      mode: 'primary',
      protectedFrontend: true,
      primaryCutoverRequested: true
    };
    const endpoint = typeof root.getBackendSimulationEndpoint === 'function'
      ? root.getBackendSimulationEndpoint()
      : '/api/simulate';
    const response = await root.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data?.results) return false;
    if (!pump.results || typeof pump.results !== 'object') pump.results = {};
    if (typeof root.applyBackendSimulationPrimaryResults === 'function') {
      root.applyBackendSimulationPrimaryResults(pump, data.results, { nodeResults: data.nodeResults || {} });
    } else {
      const actualPumpHeadAvailable = data.results.actualPumpHeadAvailable === true;
      const actualPumpHead = actualPumpHeadAvailable ? firstNumber(data.results.actualPumpHead, data.results.pumpHead) : null;
      pump.results.npshEvaluation = data.results;
      pump.results.flow = data.results.flow;
      pump.results.head = actualPumpHead;
      pump.results.actualPumpHead = actualPumpHead;
      pump.results.actualPumpHeadAvailable = actualPumpHeadAvailable;
      pump.results.pumpHeadAtFlow = actualPumpHead;
      pump.results.requiredSystemHead = data.results.requiredSystemHead ?? null;
      pump.results.power = actualPumpHeadAvailable ? data.results.power : null;
      pump.results.hydraulicPower = actualPumpHeadAvailable ? data.results.hydraulicPower : null;
      pump.results.npsha = data.results.npsha;
      pump.results.npshr = data.results.npshr;
      pump.results.npshMargin = data.results.npshMargin;
    }
    pump.results.backendCalculationSource = 'backend-primary-direct-formula-defense';
    pump.results.backendValidationStatus = data.backendValidation?.status || 'Connected';
    pump.results.backendValidationMessage = data.backendValidation?.message || 'Private backend returned usable hydraulic/NPSH results for the current route.';
    pump.results.calculationFreshness = data.backendValidation?.freshness || 'Current';
    return true;
  }

  function copyRuntimePatchFlags(target, source) {
    RUNTIME_PATCH_FLAG_KEYS.forEach((key) => {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    });
  }

  function wrapFunction(name, after, options = {}) {
    const singleInstall = name === 'updateSimulation';
    if (singleInstall && wrappedFunctionNames.has(name)) return false;
    const original = root[name];
    if (typeof original !== 'function' || original.__pumpFormulaDefenseLiveAuditVersion === VERSION) return false;
    function wrapped(...args) {
      let result = null;
      const shouldRunOriginal = typeof options.shouldRunOriginal === 'function'
        ? options.shouldRunOriginal(args)
        : true;
      if (shouldRunOriginal) {
        try {
          result = original.apply(this, args);
        } catch (error) {
          console.warn(`${VERSION}: ${name} original refresh failed; live audit badges will still refresh.`, error);
        }
      }
      const runAfter = () => root.setTimeout(() => after(...args), 0);
      if (result && typeof result.then === 'function') {
        result.finally(runAfter);
      } else {
        runAfter();
      }
      return result;
    }
    wrapped.__pumpFormulaDefenseLiveAuditPatched = true;
    wrapped.__pumpFormulaDefenseLiveAuditVersion = VERSION;
    wrapped.__pumpFormulaDefenseLiveAuditOriginal = original;
    copyRuntimePatchFlags(wrapped, original);
    root[name] = wrapped;
    if (singleInstall) wrappedFunctionNames.add(name);
    return true;
  }

  function patchLocalBackendSkipGuard() {
    if (localBackendSkipGuardInstalled) return false;
    const original = root.shouldSkipBackendSimulationFetch;
    if (typeof original !== 'function' || original.__pumpFormulaDefenseLiveAuditVersion === VERSION) return false;
    function patched(endpoint, options = {}) {
      if (options && options.allowExternalApiOnLocal === true) return false;
      return original.apply(this, arguments);
    }
    patched.__pumpFormulaDefenseLiveAuditPatched = true;
    patched.__pumpFormulaDefenseLiveAuditVersion = VERSION;
    patched.__pumpFormulaDefenseLiveAuditOriginal = original;
    root.shouldSkipBackendSimulationFetch = patched;
    localBackendSkipGuardInstalled = true;
    return true;
  }

  function ensureRuntimeGuards() {
    const changed = [
      patchLocalBackendSkipGuard(),
      wrapFunction('openPumpFormulaDefenseTaskWindow', (pumpId) => {
        scheduleOpenFormulaDefenseWindowRefresh(pumpId, { reason: 'open-window', rebuild: false, delayMs: 120 });
      }),
      wrapFunction('refreshPumpFormulaDefenseWindowContent', (target) => {
        refreshPumpFormulaDefenseAudit(target);
      }, {
        shouldRunOriginal: (args) => isFormulaDefenseWindowElement(args[0])
      }),
      wrapFunction('updateSimulation', (options = {}) => {
        const nodeId = options?.selectedNodeId || options?.nodeId || '';
        if (!options?.forceBackend && !options?.forceProtectedBackend && !options?.__engineeringRealtimeAutoSolve && isInputLatencyShieldActive(nodeId)) {
          return;
        }
        refreshCanvasPumpReadoutsIfNeeded(hydrateAllPumpTopLevelResults());
        scheduleOpenFormulaDefenseWindowRefresh(nodeId, { reason: options?.refreshReason || options?.trigger || 'updateSimulation', delayMs: 180 });
      }),
      bindRealtimeEvents(),
      bindLiveInputRefresh()
    ].some(Boolean);
    if (changed) scheduleOpenFormulaDefenseWindowRefresh('', { reason: 'runtime-guards', rebuild: false, delayMs: 180 });
    return changed;
  }

  function startRuntimeGuardLoop() {
    refreshCanvasPumpReadoutsIfNeeded(hydrateAllPumpTopLevelResults());
    ensureRuntimeGuards();
    if (!root.setTimeout) return;
    [0, 80, 220, 500, 900, 1400, 2200, 3600, 5200, 7600].forEach((delay) => {
      root.setTimeout(() => {
        ensureRuntimeGuards();
      }, delay);
    });
    if (typeof document !== 'undefined' && !runtimeGuardTimer && root.setInterval) {
      runtimeGuardTimer = root.setInterval(() => {
        ensureRuntimeGuards();
      }, 1600);
      root.__pumpFormulaDefenseLiveAuditGuardTimer = runtimeGuardTimer;
    }
  }

  root.EngineeringPumpFormulaDefenseLiveAudit = {
    version: VERSION,
    refresh: refreshPumpFormulaDefenseAudit,
    refreshOpenWindows: refreshOpenFormulaDefenseWindows,
    scheduleRefresh: scheduleOpenFormulaDefenseWindowRefresh,
    refreshBackend: refreshBackendForFormulaDefense,
    directRefresh: directBackendFormulaDefenseRefresh,
    ensureRuntimeGuards,
    buildCalculationMatrixRows,
    hydrateAllPumpTopLevelResults
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.EngineeringPumpFormulaDefenseLiveAudit;
  }

  startRuntimeGuardLoop();
})();
