(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'engineering-pump-edit-fast-lane.v4';
  const CACHE_KEY = '20260621-pump-edit-fast-lane4';
  const PUMP_WINDOW_SELECTOR = [
    '.persistent-object-properties-task-window',
    '#taskWindow',
    '.task-window',
    '[data-task-prop-body="true"]'
  ].join(',');
  const LIGHT_FIELDS = new Set([
    'designEfficiency',
    'designNpshr',
    'npshr',
    'npshrSourceMode',
    'npshMarginBasis',
    'minNpshMarginRatio',
    'minNpshMargin'
  ]);
  const CHART_FIELDS = new Set([
    'designFlow',
    'designHead',
    'bepFlow',
    'porMinPercent',
    'porMaxPercent',
    'aorMinPercent',
    'aorMaxPercent',
    'curveDataSource',
    'curveSourceNote',
    'curveData'
  ]);
  const NETWORK_DEFER_FIELDS = new Set([
    'suctionElevation',
    'pumpDatumElevation',
    'npshAssessmentMode',
    'optimizationMode'
  ]);
  const PUMP_NPSH_MARGIN_USER_DEFINED = 'User Defined';
  const PUMP_NPSH_MARGIN_GENERAL_PURPOSE = 'General Purpose';
  const PUMP_NPSH_MARGIN_PRESETS = {
    'General Purpose': { por: { ratio: 1.05, margin: 0.6 }, aor: { ratio: 1.1, margin: 1.0 } },
    'Petroleum/Hydrocarbon': { por: { ratio: 1.1, margin: 1.0 }, aor: { ratio: 1.1, margin: 1.0 } },
    'Chemical Process': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.2, margin: 1.0 } },
    'Water/Wastewater': { por: { ratio: 1.1, margin: 1.0 }, aor: { ratio: 1.2, margin: 1.5 } },
    'Building Services': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.1, margin: 0.6 } },
    'Irrigation': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.2, margin: 1.0 } }
  };
  let chartTimer = 0;
  let readoutTimer = 0;
  let previewSequence = 0;

  function runtimeModel() {
    try {
      if (typeof globalModel !== 'undefined' && globalModel) return globalModel;
    } catch (error) {
      // Protected builds may hide direct globals.
    }
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === '') return null;
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

  function round(value, digits = 6) {
    const number = finiteNumber(value);
    return number === null ? null : Number(number.toFixed(digits));
  }

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function tokenText(target) {
    const dataset = target?.dataset || {};
    const label = target?.closest?.('.prop-row, .form-row, label, .field-row, div, tr')
      ?.querySelector?.('label, .prop-label, .pump-live-param-label, th, td, span')
      ?.textContent;
    return [
      target?.name,
      target?.id,
      target?.getAttribute?.('aria-label'),
      target?.getAttribute?.('placeholder'),
      dataset.key,
      dataset.field,
      dataset.prop,
      dataset.name,
      dataset.metric,
      dataset.readoutKey,
      label
    ].filter(Boolean).join(' ');
  }

  function canonicalField(targetOrText) {
    const text = normalizeText(typeof targetOrText === 'string' ? targetOrText : tokenText(targetOrText));
    const lower = text.toLowerCase();
    if (/\bnpshr\s*source\b|\bnpshrsource/.test(lower)) return 'npshrSourceMode';
    if (/\bmanual\s*npsh\s*r\b|\bmanualnpshr\b/.test(lower)) return 'manualNpshr';
    if (/\bdesign\s*npsh\s*r\b|\bdesignnpshr\b|\bnpshr\b/.test(lower)) return 'designNpshr';
    if (/\bnpsh\s*margin\s*basis\b|\bnpshmarginbasis\b/.test(lower)) return 'npshMarginBasis';
    if (/\bmin\s*npsh\s*margin\s*ratio\b|\beffective\s*npsh\s*ratio\b|\bminnpshmarginratio\b/.test(lower)) return 'minNpshMarginRatio';
    if (/\bmin\s*npsh\s*margin\b|\beffective\s*npsh\s*margin\b|\bminnpshmargin\b/.test(lower)) return 'minNpshMargin';
    if (/\bdesign\s*eff\b|\bdesignefficiency\b|\befficiency\b/.test(lower)) return 'designEfficiency';
    if (/\bdesign\s*flow\b|\bdesignflow\b/.test(lower)) return 'designFlow';
    if (/\bdesign\s*head\b|\bdesignhead\b/.test(lower)) return 'designHead';
    if (/\bbep\s*flow\b|\bbepflow\b/.test(lower)) return 'bepFlow';
    if (/\bpor\s*min\b|\bporminpercent\b/.test(lower)) return 'porMinPercent';
    if (/\bpor\s*max\b|\bpormaxpercent\b/.test(lower)) return 'porMaxPercent';
    if (/\baor\s*min\b|\baorminpercent\b/.test(lower)) return 'aorMinPercent';
    if (/\baor\s*max\b|\baormaxpercent\b/.test(lower)) return 'aorMaxPercent';
    if (/\bpump\s*datum\b|\bsuctionelevation\b|\bsuction\s*nozzle\b/.test(lower)) return 'suctionElevation';
    if (/\bassessment\s*mode\b|\bnpshassessmentmode\b/.test(lower)) return 'npshAssessmentMode';
    if (/\boptimization\s*mode\b|\boptimizationmode\b/.test(lower)) return 'optimizationMode';
    if (/\bcurve\s*data\s*source\b|\bcurvedatasource\b/.test(lower)) return 'curveDataSource';
    if (/\bcurve\s*source\s*note\b|\bcurvesourcenote\b/.test(lower)) return 'curveSourceNote';
    if (/\bcurve\s*data\b|\bcurvedata\b/.test(lower)) return 'curveData';
    return '';
  }

  function isPumpPropertySurface(target) {
    const windowNode = target?.closest?.(PUMP_WINDOW_SELECTOR);
    if (!windowNode) return false;
    if (windowNode.classList?.contains?.('pump-manual-npshr-task-window') || windowNode.dataset?.kind === 'pump-manual-npshr') return true;
    const text = normalizeText(windowNode.querySelector?.('.task-window-header, #taskWindowTitle')?.textContent || windowNode.textContent || '');
    return /Pump Object Properties|\bP-\d+\b|\bPUMP[-_]\d+\b|NPSH Evaluation Report|Pump Datum Elev/i.test(text);
  }

  function firstPumpId(model = runtimeModel()) {
    return Object.keys(model || {}).find((id) => model[id]?.type === 'pump') || '';
  }

  function resolvePumpId(target = null) {
    const model = runtimeModel();
    const direct = target?.dataset?.pumpId || target?.dataset?.pumpNodeId || target?.dataset?.nodeId || target?.dataset?.node;
    if (direct && model[direct]?.type === 'pump') return direct;
    const holder = target?.closest?.('[data-pump-id], [data-pump-node-id], [data-node-id], [data-node]');
    const fromHolder = holder?.dataset?.pumpId || holder?.dataset?.pumpNodeId || holder?.dataset?.nodeId || holder?.dataset?.node;
    if (fromHolder && model[fromHolder]?.type === 'pump') return fromHolder;
    try {
      if (typeof currentSelectedNode !== 'undefined' && model[currentSelectedNode]?.type === 'pump') return currentSelectedNode;
    } catch (error) {
      // Fall through.
    }
    return firstPumpId(model);
  }

  function classifyInput(target) {
    if (!target || !target.matches?.('input, select, textarea')) return null;
    if (target.disabled || target.readOnly || target.type === 'file') return null;
    if (!isPumpPropertySurface(target)) return null;
    const field = canonicalField(target);
    if (!field) return null;
    if (field === 'manualNpshr') {
      return { field, className: 'network-defer', backend: 'defer', chart: true, delayMs: 90 };
    }
    if (LIGHT_FIELDS.has(field)) {
      return { field, className: 'light', backend: 'none', chart: true, delayMs: 0 };
    }
    if (CHART_FIELDS.has(field)) {
      return { field, className: 'chart', backend: field === 'designEfficiency' ? 'none' : 'defer', chart: true, delayMs: 1100 };
    }
    if (NETWORK_DEFER_FIELDS.has(field)) {
      return { field, className: 'network-defer', backend: 'defer', chart: true, delayMs: 1000 };
    }
    return null;
  }

  function inputValue(target, field) {
    if (target?.type === 'checkbox') return !!target.checked;
    if (target?.tagName === 'SELECT') return target.value;
    const numeric = finiteNumber(target?.value);
    if (numeric !== null && !/source|mode|basis|note|data/i.test(field)) return numeric;
    return target?.value;
  }

  function ensurePumpResults(pump) {
    if (!pump.results || typeof pump.results !== 'object') pump.results = {};
    if (!pump.results.npshEvaluation || typeof pump.results.npshEvaluation !== 'object') pump.results.npshEvaluation = {};
    return pump.results.npshEvaluation;
  }

  function recalcNpsha(pump, evaluation) {
    const trace = evaluation.calculationTrace || pump.results?.calculationTrace || {};
    const boundary = trace.boundary || {};
    const basis = trace.basis || {};
    const pressureHead = firstFinite(boundary.pressureHead);
    const sourceElevation = firstFinite(boundary.elevation);
    const pumpDatum = firstFinite(pump.props?.suctionElevation, pump.props?.elevation, trace.pump?.elevation);
    const velocityHead = firstFinite(boundary.velocityHead, 0) || 0;
    const suctionLoss = firstFinite(evaluation.suctionLoss, pump.results?.suctionLoss, trace.losses?.total, 0) || 0;
    const vaporHead = firstFinite(basis.vaporPressureHead, trace.vaporPressureHead, pump.results?.vaporPressureHead, 0) || 0;
    if (pressureHead === null || sourceElevation === null || pumpDatum === null) {
      return firstFinite(evaluation.npsha, pump.results?.npsha, pump.results?.npshAvailable);
    }
    return pressureHead + (sourceElevation - pumpDatum) + velocityHead - suctionLoss - vaporHead;
  }

  function pumpNpshRegionKey(pump, evaluation) {
    const status = normalizeText(
      evaluation?.operatingRegion
      || evaluation?.marginCriteria?.operatingRegionStatus
      || evaluation?.criteria?.operatingRegionStatus
      || pump?.results?.operatingRegion
      || pump?.results?.npshMarginBasisRegion
    ).toUpperCase();
    return status === 'POR' ? 'por' : 'aor';
  }

  function standardMarginCriteria(basis, pump, evaluation) {
    const preset = PUMP_NPSH_MARGIN_PRESETS[basis] || PUMP_NPSH_MARGIN_PRESETS[PUMP_NPSH_MARGIN_GENERAL_PURPOSE];
    const selected = preset?.[pumpNpshRegionKey(pump, evaluation)] || preset?.aor || preset?.por;
    return {
      basis: preset === PUMP_NPSH_MARGIN_PRESETS[PUMP_NPSH_MARGIN_GENERAL_PURPOSE] && !PUMP_NPSH_MARGIN_PRESETS[basis]
        ? PUMP_NPSH_MARGIN_GENERAL_PURPOSE
        : basis,
      ratio: firstFinite(selected?.ratio, 1.1) || 1.1,
      margin: firstFinite(selected?.margin, 1.0) || 1.0,
      valid: true
    };
  }

  function marginCriteria(pump, evaluation) {
    const criteria = evaluation.marginCriteria || evaluation.criteria || {};
    const basis = normalizeText(pump.props?.npshMarginBasis || criteria.basis || PUMP_NPSH_MARGIN_GENERAL_PURPOSE) || PUMP_NPSH_MARGIN_GENERAL_PURPOSE;
    if (basis !== PUMP_NPSH_MARGIN_USER_DEFINED) {
      return standardMarginCriteria(basis, pump, evaluation);
    }
    const ratio = firstFinite(pump.props?.minNpshMarginRatio, criteria.ratio);
    const margin = firstFinite(pump.props?.minNpshMargin, criteria.margin);
    if (ratio === null && margin === null) {
      return standardMarginCriteria(PUMP_NPSH_MARGIN_GENERAL_PURPOSE, pump, evaluation);
    }
    return {
      basis,
      ratio,
      margin,
      valid: ratio !== null && margin !== null
    };
  }

  function estimatedNpshrAtFlow(flow, bepFlow, designNpshr) {
    const q = finiteNumber(flow);
    const qbep = firstFinite(bepFlow, flow);
    const npshr = finiteNumber(designNpshr);
    if (q === null || qbep === null || npshr === null || qbep <= 0 || npshr <= 0) return npshr;
    const ratio = Math.max(0, q / qbep);
    return Math.max(0.01, npshr * (0.65 + 0.35 * Math.pow(ratio, 2.2)));
  }

  function resolvePreviewFlow(pump, evaluation, field) {
    if (field === 'designFlow') return firstFinite(pump.props?.designFlow, evaluation.flow, pump.results?.flow);
    return firstFinite(evaluation.flow, pump.results?.fixedFlow, pump.results?.flow, pump.props?.designFlow);
  }

  function resolvePreviewNpshr(pump, evaluation, flow, field) {
    const manualBasis = firstFinite(pump.props?.manualNpshr, pump.props?.designNpshr, evaluation.npshr, pump.results?.npshr);
    const designBasis = firstFinite(pump.props?.designNpshr, pump.props?.manualNpshr, evaluation.npshr, pump.results?.npshr);
    const source = String(pump.props?.npshrSourceMode || '').toLowerCase();
    if (field === 'manualNpshr' || field === 'npshr' || source.includes('manual')) return manualBasis;
    return estimatedNpshrAtFlow(flow, pump.props?.bepFlow || pump.props?.designFlow, designBasis);
  }

  function markPreviewMetadata(pump, field) {
    if (!pump.results || typeof pump.results !== 'object') return;
    previewSequence += 1;
    pump.results.calculationFreshness = 'Local preview';
    pump.results.chartPreviewSource = 'Pump Properties fast lane';
    pump.results.chartPreviewField = field || '';
    pump.results.chartPreviewSequence = previewSequence;
    if (pump.results.performanceChartData?.schemaVersion === 'pump-performance-chart-data.v1') {
      pump.results.performanceChartData = {
        ...pump.results.performanceChartData,
        freshness: 'Stale - local preview active',
        sourceAudit: {
          ...(pump.results.performanceChartData.sourceAudit || {}),
          staleBecausePumpFastLaneInputChanged: true,
          localPreviewField: field || ''
        }
      };
    }
  }

  function applyLocalNpsh(pump, options = {}) {
    const field = options.field || '';
    const evaluation = ensurePumpResults(pump);
    const criteria = marginCriteria(pump, evaluation);
    const flow = resolvePreviewFlow(pump, evaluation, field);
    const npsha = firstFinite(recalcNpsha(pump, evaluation), evaluation.npsha, pump.results.npsha);
    const npshr = resolvePreviewNpshr(pump, evaluation, flow, field);
    if (npsha !== null) {
      evaluation.npsha = round(npsha, 6);
      pump.results.npsha = evaluation.npsha;
      pump.results.npshAvailable = evaluation.npsha;
    }
    if (npshr !== null) {
      evaluation.npshr = round(npshr, 6);
      pump.results.npshr = evaluation.npshr;
      pump.results.npshRequired = evaluation.npshr;
    }
    if (npsha !== null && npshr !== null && criteria.valid) {
      const required = Math.max(npshr * criteria.ratio, npshr + criteria.margin);
      const margin = npsha - npshr;
      const ratio = npshr > 0 ? npsha / npshr : null;
      const excess = npsha - required;
      const maxNpshrByRatio = criteria.ratio > 0 ? npsha / criteria.ratio : null;
      const maxNpshrByMargin = npsha - criteria.margin;
      const maxAllowableNpshr = maxNpshrByRatio !== null ? Math.min(maxNpshrByRatio, maxNpshrByMargin) : null;
      const status = npsha < npshr ? 'Cavitation Risk' : (npsha < required ? 'Warning' : 'Safe');
      const manualStatus = maxAllowableNpshr !== null ? (npshr <= maxAllowableNpshr ? 'Safe' : 'Warning') : 'Review Required';
      evaluation.requiredNpsha = round(required, 6);
      evaluation.npshMargin = round(margin, 6);
      evaluation.npshRatio = round(ratio, 6);
      evaluation.npshExcess = round(excess, 6);
      evaluation.maxNpshrByRatio = round(maxNpshrByRatio, 6);
      evaluation.maxNpshrByMargin = round(maxNpshrByMargin, 6);
      evaluation.maxAllowableNpshr = round(maxAllowableNpshr, 6);
      evaluation.hydraulicStatus = status;
      evaluation.engineeringStatus = status;
      evaluation.status = status;
      evaluation.marginCriteria = criteria;
      evaluation.maxAllowableNpshrStatus = 'Calculated';
      evaluation.manualNpshrComparisonStatus = manualStatus;
      pump.results.requiredNpsha = evaluation.requiredNpsha;
      pump.results.npshMargin = evaluation.npshMargin;
      pump.results.npshRatio = evaluation.npshRatio;
      pump.results.npshExcess = evaluation.npshExcess;
      pump.results.maxNpshrByRatio = evaluation.maxNpshrByRatio;
      pump.results.maxNpshrByMargin = evaluation.maxNpshrByMargin;
      pump.results.maxAllowableNpshr = evaluation.maxAllowableNpshr;
      pump.results.hydraulicNpshStatus = status;
      pump.results.engineeringStatus = status;
      pump.results.cavitationStatus = status;
      pump.results.maxAllowableNpshrStatus = evaluation.maxAllowableNpshrStatus;
      pump.results.manualNpshrComparisonStatus = evaluation.manualNpshrComparisonStatus;
    } else if (npsha !== null && npshr !== null) {
      evaluation.marginCriteria = criteria;
      evaluation.maxAllowableNpshrStatus = 'Margin criteria required';
      evaluation.manualNpshrComparisonStatus = 'Margin criteria required';
      pump.results.maxAllowableNpshrStatus = evaluation.maxAllowableNpshrStatus;
      pump.results.manualNpshrComparisonStatus = evaluation.manualNpshrComparisonStatus;
    }
    const head = firstFinite(pump.props?.designHead, evaluation.pumpHead, pump.results.pumpHeadAtFlow, pump.results.head);
    if (flow !== null) {
      evaluation.flow = round(flow, 6);
      pump.results.flow = evaluation.flow;
    }
    if (head !== null) {
      evaluation.pumpHead = round(head, 6);
      pump.results.head = evaluation.pumpHead;
      pump.results.pumpHeadAtFlow = evaluation.pumpHead;
    }
    pump.results.efficiency = firstFinite(pump.props?.designEfficiency, pump.results.efficiency);
    evaluation.calculationFreshness = 'Local preview';
    markPreviewMetadata(pump, field);
    return evaluation;
  }

  function applyInputToPump(target, classification) {
    const model = runtimeModel();
    const pumpId = resolvePumpId(target);
    const pump = model[pumpId];
    if (!pump || pump.type !== 'pump') return null;
    if (!pump.props || typeof pump.props !== 'object') pump.props = {};
    const field = classification.field;
    let value = inputValue(target, field);
    if (field === 'manualNpshr' || field === 'npshr') {
      pump.props.designNpshr = value;
      pump.props.manualNpshr = value;
    } else if (field === 'pumpDatumElevation') {
      pump.props.suctionElevation = value;
    } else if (field === 'curveData' && typeof value === 'string') {
      pump.props.curveData = value;
    } else {
      pump.props[field] = value;
    }
    const evaluation = applyLocalNpsh(pump, { field });
    return { pumpId, pump, evaluation };
  }

  function formatNumber(value, digits = 4) {
    const number = finiteNumber(value);
    if (number === null) return '-';
    return Number(number.toFixed(digits)).toString();
  }

  function readoutValue(label, pump, evaluation) {
    const lower = String(label || '').toLowerCase();
    if (lower.includes('hydraulic npsh status')) return evaluation.hydraulicStatus || evaluation.status || '-';
    if (lower.includes('engineering status')) return evaluation.engineeringStatus || evaluation.status || '-';
    if (lower.includes('flow evaluated')) return `${formatNumber(evaluation.flow, 3)} m3/h`;
    if (lower.includes('pump head')) return `${formatNumber(evaluation.pumpHead, 3)} m`;
    if (lower === 'npsha' || /\bnpsha\b/.test(lower)) return `${formatNumber(evaluation.npsha, 4)} m`;
    if (lower === 'npshr' || /\bnpshr\b/.test(lower)) return `${formatNumber(evaluation.npshr, 4)} m`;
    if (lower.includes('npsh margin') && !lower.includes('basis')) return `${formatNumber(evaluation.npshMargin, 4)} m`;
    if (lower.includes('npsh ratio')) return formatNumber(evaluation.npshRatio, 4);
    if (lower.includes('effective npsh ratio')) return formatNumber(marginCriteria(pump, evaluation).ratio, 3);
    if (lower.includes('effective npsh margin')) return `${formatNumber(marginCriteria(pump, evaluation).margin, 3)} m`;
    if (lower.includes('maximum allowable npshr') || lower.includes('max allowable npshr')) return `${formatNumber(evaluation.maxAllowableNpshr, 4)} m`;
    if (lower.includes('manual npshr comparison')) return evaluation.manualNpshrComparisonStatus || '-';
    return null;
  }

  function maybeSetValueElement(element, text) {
    if (!element || text === null || text === undefined) return false;
    if (element.querySelector?.('input, select, textarea, button')) return false;
    const current = normalizeText(element.textContent);
    if (current === String(text)) return false;
    element.textContent = text;
    return true;
  }

  function refreshOpenReadouts(pumpId, pump, evaluation) {
    if (typeof document === 'undefined') return 0;
    let changed = 0;
    const windows = Array.from(document.querySelectorAll(PUMP_WINDOW_SELECTOR)).filter((windowNode) => {
      const text = normalizeText(windowNode.textContent || '');
      return /Pump Object Properties|\bP-\d+\b|NPSH Evaluation Report/i.test(text);
    });
    windows.forEach((windowNode) => {
      const rows = Array.from(windowNode.querySelectorAll('tr, .prop-row, .pump-live-param-row, div'));
      rows.forEach((row) => {
        const children = Array.from(row.children || []);
        if (children.length < 2) return;
        const label = normalizeText(children[0].textContent || '');
        if (!label || label.length > 60) return;
        const value = readoutValue(label, pump, evaluation);
        if (value === null) return;
        if (maybeSetValueElement(children[1], value)) changed += 1;
      });
    });
    root.__pumpEditFastLaneLastReadoutRefresh = {
      version: VERSION,
      pumpId,
      changed,
      refreshedAt: new Date().toISOString()
    };
    return changed;
  }

  function scheduleReadoutRefresh(pumpId, pump, evaluation) {
    if (!root.setTimeout) return refreshOpenReadouts(pumpId, pump, evaluation);
    root.clearTimeout?.(readoutTimer);
    readoutTimer = root.setTimeout(() => {
      readoutTimer = 0;
      refreshOpenReadouts(pumpId, pump, evaluation);
    }, 30);
    return true;
  }

  function scheduleFastChart(pumpId, reason = 'pump edit fast lane') {
    const run = () => {
      chartTimer = 0;
      try {
        if (typeof root.EngineeringPumpPerformanceCanonicalChart?.scheduleRender === 'function') {
          root.EngineeringPumpPerformanceCanonicalChart.scheduleRender(pumpId, { delayMs: 16, reason, force: true });
        } else if (typeof root.updatePumpChart === 'function') {
          root.updatePumpChart(pumpId, { forceImmediate: true, reason });
        }
      } catch (error) {
        // Chart preview is best-effort; backend apply will redraw later.
      }
    };
    if (chartTimer) root.cancelAnimationFrame?.(chartTimer) || root.clearTimeout?.(chartTimer);
    if (typeof root.requestAnimationFrame === 'function') {
      chartTimer = root.requestAnimationFrame(run);
    } else {
      chartTimer = root.setTimeout?.(run, 16) || 0;
    }
    return true;
  }

  function markFastLaneState(pumpId, classification, backendScheduled = false) {
    const now = Date.now();
    root.__engineeringPumpEditFastLane = {
      version: VERSION,
      mode: classification.className,
      field: classification.field,
      pumpId,
      backend: classification.backend,
      backendScheduled,
      activeUntil: now + 1600,
      updatedAt: new Date(now).toISOString()
    };
    return root.__engineeringPumpEditFastLane;
  }

  function isActiveFor(pumpId = '') {
    const state = root.__engineeringPumpEditFastLane;
    if (!state || Date.now() > Number(state.activeUntil || 0)) return false;
    return !pumpId || !state.pumpId || state.pumpId === pumpId;
  }

  function handleRealtimeInput(event, hooks = {}) {
    if (event?.isComposing) return { handled: false };
    const classification = classifyInput(event?.target);
    if (!classification) return { handled: false };
    const result = applyInputToPump(event.target, classification);
    if (!result) return { handled: false };
    const reason = `Pump fast lane: ${classification.field}`;
    if (event?.isTrusted) {
      hooks.markUserCalculationIntent?.('trusted-input', event.target);
      hooks.markInputLatencyShield?.(event.target, result.pumpId, reason);
    }
    scheduleFastChart(result.pumpId, reason);
    scheduleReadoutRefresh(result.pumpId, result.pump, result.evaluation);
    markFastLaneState(result.pumpId, classification, classification.backend === 'defer');
    if (classification.backend === 'defer' && event?.isTrusted && typeof hooks.requestAutoSolve === 'function') {
      const autosolveReason = classification.field === 'manualNpshr'
        ? 'Manual NPSHr changed; recalculating connected route for NPSHa and NPSH status.'
        : 'Pump input changed; backend recalculation deferred until typing settles.';
      hooks.markStale?.(result.pumpId, autosolveReason);
      hooks.requestAutoSolve(result.pumpId, autosolveReason, {
        sourceEvent: event.type,
        delayMs: classification.delayMs || 1000,
        fastLane: true
      });
    }
    return {
      handled: true,
      pumpId: result.pumpId,
      classification,
      backend: classification.backend,
      evaluation: result.evaluation
    };
  }

  function install() {
    root.__engineeringPumpEditFastLaneInstalled = true;
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    install,
    canonicalField,
    classifyInput,
    applyInputToPump,
    applyLocalNpsh,
    handleRealtimeInput,
    scheduleFastChart,
    refreshOpenReadouts,
    isActiveFor
  };

  root.EngineeringPumpEditFastLane = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  install();
})();
