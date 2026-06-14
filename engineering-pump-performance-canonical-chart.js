(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'pump-performance-canonical-chart.v6';
  const CANVAS_SELECTORS = [
    '#pumpChart',
    '#captionAuditPumpChartCanvas',
    '.caption-audit-inline-chart-wrap canvas',
    '.modal-chart-wrap canvas'
  ];
  const REALTIME_EVENTS = [
    'npsh:calculation-stale',
    'npsh:calculation-calculating',
    'npsh:calculation-current',
    'npsh:linked-views-refreshed',
    'npsh:realtime-autosolve-complete'
  ];
  const PUMP_CHART_INPUT_PATTERN = /\b(inputMode|optimizationMode|npshrSourceMode|npshAssessmentMode|npshMarginBasis|designFlow|designHead|designEfficiency|designNpshr|bepFlow|porMinPercent|porMaxPercent|aorMinPercent|aorMaxPercent|minNpshMarginRatio|minNpshMargin|speed|curveDataSource|curveSourceNote|curveData|flow|head|eff|npshr|pressure|elevation|density|viscosity|vaporPressure|segments|length|diameter|roughness|fittingType|fittingQuantity|fittingK|minorLoss|additionalK)\b/i;
  const RUNTIME_PATCH_FLAG_KEYS = [
    '__engineeringRealtimeCalculationDefenseUpdatePatched',
    '__engineeringRealtimeCalculationDefenseOriginal',
    '__analysisReportLivePatched',
    '__analysisReportLiveOriginal',
    '__pumpFormulaDefenseLiveAuditPatched',
    '__pumpFormulaDefenseLiveAuditVersion',
    '__pumpFormulaDefenseLiveAuditOriginal',
    '__pumpPerformanceChartAuditPatched',
    '__pumpPerformanceChartAuditVersion',
    '__pumpPerformanceChartAuditOriginal'
  ];
  let renderGuardTimer = 0;
  let scheduledRenderTimer = 0;
  let pendingRenderPumpId = '';

  const STYLES = {
    pumpHead: { label: 'Pump Head', color: '#164a7a', width: 2.4 },
    systemHead: { label: 'System Curve', color: '#dc2626', width: 2, dash: [6, 5] },
    npsha: { label: 'NPSHa', color: '#0f766e', width: 1.8 },
    npshr: { label: 'NPSHr', color: '#b45309', width: 1.8 }
  };

  function runtimeModel() {
    try {
      if (typeof globalModel !== 'undefined' && globalModel) return globalModel;
    } catch (error) {
      // Protected builds can hide direct globals.
    }
    try {
      const state = typeof root.getSimulationState === 'function'
        ? JSON.parse(root.getSimulationState())
        : null;
      if (state?.model) return state.model;
    } catch (error) {
      // Fall through to aliases.
    }
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function connectionList() {
    try {
      if (typeof connections !== 'undefined' && Array.isArray(connections)) return connections;
    } catch (error) {
      // Protected builds can hide direct globals.
    }
    try {
      const state = typeof root.getSimulationState === 'function'
        ? JSON.parse(root.getSimulationState())
        : null;
      if (Array.isArray(state?.connections)) return state.connections;
    } catch (error) {
      // Fall through to aliases.
    }
    return root.connections || root.__npshConnections || [];
  }

  function runtimeFunction(name) {
    return typeof root[name] === 'function' ? root[name] : null;
  }

  function firstPumpId(model = runtimeModel()) {
    return Object.keys(model || {}).find((id) => model[id]?.type === 'pump') || '';
  }

  function resolvePumpId(pumpId) {
    const model = runtimeModel();
    if (pumpId && model[pumpId]?.type === 'pump') return pumpId;
    try {
      if (typeof activeChartPumpId !== 'undefined' && model[activeChartPumpId]?.type === 'pump') return activeChartPumpId;
    } catch (error) {
      // Ignore inaccessible state.
    }
    try {
      if (typeof currentSelectedNode !== 'undefined' && model[currentSelectedNode]?.type === 'pump') return currentSelectedNode;
    } catch (error) {
      // Ignore inaccessible state.
    }
    return firstPumpId(model);
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

  function isPumpChartLiveInput(target) {
    if (!target || !target.matches?.('input, select, textarea')) return false;
    if (target.disabled || target.readOnly || target.type === 'file') return false;
    if (target.closest?.('#pumpCurveTable') && /^(flow|head|eff|npshr)$/i.test(String(target.dataset?.field || ''))) return true;
    const insideLiveEditor = target.closest?.('.task-window, .full-editor-modal, .canvas-task-window, #taskWindowBody, [data-task-prop-body="true"]');
    return !!insideLiveEditor && PUMP_CHART_INPUT_PATTERN.test(inputTokens(target));
  }

  function toNumber(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function pointValue(point, keys) {
    if (!point || typeof point !== 'object') return null;
    for (const key of keys) {
      const value = toNumber(point[key]);
      if (value !== null) return value;
    }
    return null;
  }

  function normalizePoints(points, valueKeys) {
    if (!Array.isArray(points)) return [];
    return points
      .map((point) => {
        const flow = Array.isArray(point)
          ? toNumber(point[0])
          : pointValue(point, ['flow', 'q', 'x', 'flowM3H']);
        const value = Array.isArray(point)
          ? toNumber(point[1])
          : pointValue(point, [...valueKeys, 'value', 'y']);
        return flow !== null && value !== null ? { flow, value } : null;
      })
      .filter(Boolean)
      .sort((left, right) => left.flow - right.flow);
  }

  function isDefaultPumpCurve(points = []) {
    const normalized = normalizePoints(points, ['head']);
    const defaults = [
      { flow: 0, value: 55 },
      { flow: 50, value: 50 },
      { flow: 100, value: 40 },
      { flow: 150, value: 20 }
    ];
    if (normalized.length !== defaults.length) return false;
    return normalized.every((point, index) => (
      Math.abs(point.flow - defaults[index].flow) <= 1e-9
      && Math.abs(point.value - defaults[index].value) <= 1e-9
    ));
  }

  function canonicalSeries(chartData, key) {
    return normalizePoints(chartData?.series?.[key], ['value']);
  }

  function chartDataFreshness(pumpId, chartData) {
    if (!chartData) return { isFresh: false, freshness: 'Unavailable' };
    const freshness = runtimeFunction('getPumpPerformanceChartDataFreshness');
    if (freshness) {
      try {
        const result = freshness(pumpId, runtimeModel(), connectionList(), chartData);
        if (typeof result?.isFresh === 'boolean') return result;
      } catch (error) {
        root.__pumpPerformanceCanonicalChartFreshnessError = {
          version: VERSION,
          pumpId,
          message: error?.message || String(error)
        };
      }
    }

    const fingerprint = runtimeFunction('buildPumpPerformanceChartInputFingerprint');
    if (fingerprint && chartData?.inputFingerprint?.value) {
      try {
        const current = fingerprint(pumpId, runtimeModel(), connectionList());
        const isFresh = !!current?.value && current.value === chartData.inputFingerprint.value;
        return {
          isFresh,
          freshness: isFresh ? 'Current' : 'Stale',
          currentFingerprint: current,
          storedFingerprint: chartData.inputFingerprint
        };
      } catch (error) {
        root.__pumpPerformanceCanonicalChartFreshnessError = {
          version: VERSION,
          pumpId,
          message: error?.message || String(error)
        };
      }
    }

    return { isFresh: true, freshness: chartData.freshness || 'Current' };
  }

  function buildCurrentEngineChartData(pumpId, options = {}) {
    const buildChartData = runtimeFunction('buildPumpPerformanceChartData');
    if (!buildChartData) {
      return buildLightweightCurrentChartData(resolvePumpId(pumpId), options.chartData || null, options);
    }
    const model = runtimeModel();
    const id = resolvePumpId(pumpId);
    try {
      const chartData = buildChartData(id, model, connectionList(), {
        pointCount: options.pointCount || 18
      });
      if (chartData?.schemaVersion !== 'pump-performance-chart-data.v1') {
        return buildLightweightCurrentChartData(id, options.chartData || null, options);
      }
      const sourceAudit = {
        ...(chartData.sourceAudit || {}),
        frontendChartRebuilt: true,
        rebuildReason: options.reason || 'current pump chart input'
      };
      if (options.preview) sourceAudit.localPumpEditPreview = true;
      return {
        ...chartData,
        freshness: options.freshness || chartData.freshness || 'Current',
        sourceAudit
      };
    } catch (error) {
      root.__pumpPerformanceCanonicalChartLastError = {
        version: VERSION,
        pumpId: id,
        message: error?.message || String(error),
        reason: options.reason || 'build current engine chart data'
      };
      return null;
    }
  }

  function buildCanonicalModelFromChartData(pumpId, chartData, options = {}) {
    const sourceAudit = { ...(chartData.sourceAudit || {}) };
    if (options.preview) sourceAudit.localPumpEditPreview = true;
    if (options.rebuilt) sourceAudit.frontendChartRebuilt = true;
    if (options.stale) sourceAudit.staleInputFingerprint = true;
    return {
      pumpId,
      sourceMode: options.sourceMode || chartData.sourceMode || '-',
      sourceAudit,
      freshness: options.freshness || chartData.freshness || 'Current',
      warnings: Array.isArray(chartData.warnings) ? chartData.warnings : [],
      ranges: chartData.ranges || {},
      dutyPoint: chartData.dutyPoint || {},
      series: {
        pumpHead: canonicalSeries(chartData, 'pumpHead'),
        systemHead: canonicalSeries(chartData, 'systemHead'),
        npsha: canonicalSeries(chartData, 'npsha'),
        npshr: canonicalSeries(chartData, 'npshr')
      },
      canonical: true,
      preview: !!options.preview,
      rebuilt: !!options.rebuilt,
      stale: !!options.stale
    };
  }

  function roundChartNumber(value, digits = 6) {
    const number = toNumber(value);
    return number === null ? null : Number(number.toFixed(digits));
  }

  function canonicalPoint(flow, value) {
    const x = roundChartNumber(flow);
    const y = roundChartNumber(value);
    return x !== null && y !== null ? { flow: x, value: y } : null;
  }

  function interpolateSeriesValue(points, flow) {
    const q = toNumber(flow);
    const normalized = normalizePoints(points, ['head', 'pumpHead', 'npshr', 'value']);
    if (q === null || !normalized.length) return null;
    if (q <= normalized[0].flow) return normalized[0].value;
    if (q >= normalized[normalized.length - 1].flow) return normalized[normalized.length - 1].value;
    for (let index = 0; index < normalized.length - 1; index += 1) {
      const left = normalized[index];
      const right = normalized[index + 1];
      if (q >= left.flow && q <= right.flow) {
        const span = right.flow - left.flow;
        const ratio = span === 0 ? 0 : (q - left.flow) / span;
        return left.value + (right.value - left.value) * ratio;
      }
    }
    return null;
  }

  function engineeringFitHead(flow, designFlow, designHead) {
    const q = toNumber(flow);
    const qd = toNumber(designFlow);
    const hd = toNumber(designHead);
    if (q === null || qd === null || hd === null || qd <= 0 || hd <= 0) return null;
    const shutoffHead = 1.15 * hd;
    const curveA = (shutoffHead - hd) / Math.pow(qd, 2);
    return Math.max(0.1 * hd, shutoffHead - curveA * Math.pow(q, 2));
  }

  function engineeringFitNpshr(flow, designFlow, designNpshr) {
    const q = toNumber(flow);
    const qd = toNumber(designFlow);
    const npshr = toNumber(designNpshr);
    if (q === null || qd === null || npshr === null || qd <= 0 || npshr <= 0) return null;
    const fraction = Math.max(0, q / qd);
    return Math.max(0.01, npshr * (0.72 + 0.28 * Math.pow(fraction, 2.2)));
  }

  function buildFlowGrid(pump, chartData = null) {
    const props = pump.props || {};
    const results = pump.results || {};
    const duty = chartData?.dutyPoint || {};
    const designFlow = toNumber(props.designFlow);
    const bepFlow = toNumber(props.bepFlow);
    const dutyFlow = toNumber(results.npshEvaluation?.flow ?? results.flow ?? results.fixedFlow ?? duty.flow ?? props.designFlow);
    const maxFlow = Math.max(
      1,
      toNumber(props.aorMaxPercent) !== null && (bepFlow || designFlow)
        ? (bepFlow || designFlow) * toNumber(props.aorMaxPercent) / 100
        : 0,
      dutyFlow || 0,
      designFlow || 0,
      bepFlow || 0
    );
    const flows = new Set();
    for (let index = 0; index <= 12; index += 1) {
      flows.add(roundChartNumber(maxFlow * index / 12));
    }
    [dutyFlow, designFlow, bepFlow].forEach((value) => {
      const flow = roundChartNumber(value);
      if (flow !== null && flow >= 0 && flow <= maxFlow * 1.001) flows.add(flow);
    });
    return Array.from(flows).filter((value) => value !== null).sort((left, right) => left - right);
  }

  function buildLightweightCurrentChartData(pumpId, chartData = null, options = {}) {
    const model = runtimeModel();
    const pump = model[pumpId];
    if (!pump || pump.type !== 'pump') return null;
    const props = pump.props || {};
    const results = pump.results || {};
    const evaluation = npshEvaluation(pump);
    const duty = chartData?.dutyPoint || {};
    const designFlow = toNumber(props.designFlow ?? props.bepFlow);
    const designHead = toNumber(props.designHead);
    const designNpshr = toNumber(props.designNpshr ?? props.manualNpshr);
    const flow = toNumber(evaluation.flow ?? results.flow ?? results.fixedFlow ?? duty.flow ?? designFlow);
    const head = toNumber(evaluation.pumpHead ?? results.head ?? results.pumpHeadAtFlow ?? duty.head ?? designHead);
    const npsha = toNumber(evaluation.npsha ?? results.npsha ?? duty.npsha);
    const npshr = toNumber(evaluation.npshr ?? results.npshr ?? duty.npshr ?? designNpshr);
    if (flow === null || head === null) return null;

    const propsCurveIsDefault = isDefaultPumpCurve(props.curveData || []);
    const propsPumpHead = propsCurveIsDefault ? [] : normalizePoints(props.curveData, ['head', 'pumpHead', 'value']);
    const propsNpshr = propsCurveIsDefault ? [] : normalizePoints(props.curveData, ['npshr', 'requiredNpsh', 'value']);
    const baseSystemHead = canonicalSeries(chartData, 'systemHead');
    const baseNpsha = canonicalSeries(chartData, 'npsha');
    const systemPoints = normalizePoints(results.systemCurvePoints || results.sysCurve, ['head', 'systemHead', 'requiredHead']);
    const npshPoints = Array.isArray(results.npshCurvePoints) ? results.npshCurvePoints : [];
    const resultNpsha = normalizePoints(npshPoints, ['npsha', 'availableNpsh']);
    const flows = buildFlowGrid(pump, chartData);
    const pumpHeadSeries = flows.map((q) => {
      const fromCurve = propsPumpHead.length ? interpolateSeriesValue(propsPumpHead, q) : null;
      return canonicalPoint(q, fromCurve ?? engineeringFitHead(q, designFlow || flow, designHead || head));
    }).filter(Boolean);
    const npshrSeries = flows.map((q) => {
      const fromCurve = propsNpshr.length ? interpolateSeriesValue(propsNpshr, q) : null;
      const fallback = /manual/i.test(String(props.npshrSourceMode || ''))
        ? npshr
        : engineeringFitNpshr(q, designFlow || flow, designNpshr || npshr);
      return canonicalPoint(q, fromCurve ?? fallback);
    }).filter(Boolean);
    const systemHeadSeries = systemPoints.length
      ? systemPoints
      : (baseSystemHead.length ? scaleSeriesToDuty(baseSystemHead, head, duty.head, flow, duty.flow) : previewSystemSeries(flow, head));
    const npshaSeries = resultNpsha.length
      ? resultNpsha
      : (baseNpsha.length ? scaleSeriesToDuty(baseNpsha, npsha, duty.npsha, flow, duty.flow) : previewFlatSeries(flow, npsha));

    return {
      schemaVersion: 'pump-performance-chart-data.v1',
      pumpId,
      sourceMode: options.preview ? 'Local Pump Edit Preview' : 'Frontend current model',
      freshness: options.freshness || (options.preview ? 'Local preview' : 'Current'),
      sourceAudit: {
        ...(chartData?.sourceAudit || {}),
        curveDataSource: propsCurveIsDefault ? 'Engineering fit from Pump Properties' : (results.curveDataSource || props.curveDataSource || 'Pump Properties curve data'),
        curveDataConfidence: results.curveDataConfidence || results.dataConfidence || props.curveDataConfidence || 'Current frontend model',
        frontendChartRebuilt: true,
        lightweightFormulaPreview: true,
        rebuildReason: options.reason || 'current pump chart input'
      },
      ranges: {
        bepFlow: roundChartNumber(props.bepFlow ?? props.designFlow),
        porMinPercent: roundChartNumber(props.porMinPercent, 3),
        porMaxPercent: roundChartNumber(props.porMaxPercent, 3),
        aorMinPercent: roundChartNumber(props.aorMinPercent, 3),
        aorMaxPercent: roundChartNumber(props.aorMaxPercent, 3)
      },
      dutyPoint: {
        flow: roundChartNumber(flow),
        head: roundChartNumber(head),
        npsha: roundChartNumber(npsha),
        npshr: roundChartNumber(npshr),
        margin: roundChartNumber(toNumber(evaluation.npshMargin ?? results.npshMargin) ?? (npsha !== null && npshr !== null ? npsha - npshr : null))
      },
      series: {
        pumpHead: pumpHeadSeries,
        systemHead: systemHeadSeries,
        npsha: npshaSeries,
        npshr: npshrSeries
      },
      warnings: [
        ...(Array.isArray(chartData?.warnings) ? chartData.warnings : []),
        'Pump chart rebuilt from current frontend model; backend autosolve will replace it with protected canonical data when available.'
      ]
    };
  }

  function npshEvaluation(pump = {}) {
    const results = pump.results || {};
    return results.npshEvaluation || {};
  }

  const REQUIRED_ESTIMATED_CHART_INPUTS = [
    'designFlow',
    'designHead',
    'designEfficiency',
    'designNpshr',
    'bepFlow'
  ];

  function hasCompleteEstimatedChartInputs(props = {}) {
    return REQUIRED_ESTIMATED_CHART_INPUTS.every((key) => {
      const value = toNumber(props[key]);
      return value !== null && value > 0;
    });
  }

  function hasNonDefaultCurveData(props = {}) {
    return normalizePoints(props.curveData || [], ['head', 'pumpHead', 'value']).length >= 2
      && !isDefaultPumpCurve(props.curveData || []);
  }

  function chartDataNeedsEstimatedInputBasis(chartData) {
    const audit = chartData?.sourceAudit || {};
    const sourceText = [
      chartData?.sourceMode,
      audit.pumpCurveSource,
      audit.curveDataSource,
      audit.curveDataConfidence,
      audit.npshrSourceMode
    ].filter(Boolean).join(' ');
    return !!audit.isDefaultCurveData
      || !!audit.isEstimated
      || !!audit.npshrIsEstimated
      || /engineering\s*fit|basic\s*estimated|estimated|screening|default|template/i.test(sourceText);
  }

  function storedChartDataIsAllowed(pump, chartData) {
    if (!chartDataNeedsEstimatedInputBasis(chartData)) return true;
    const props = pump.props || {};
    return hasCompleteEstimatedChartInputs(props)
      || (props.curveGeneratedByEngineeringFit === true && hasNonDefaultCurveData(props));
  }

  function buildBlockedChartModel(pumpId, pump, chartData, reason) {
    const props = pump.props || {};
    const warnings = [
      reason,
      ...(Array.isArray(chartData?.warnings) ? chartData.warnings : [])
    ].filter(Boolean);
    return {
      pumpId,
      sourceMode: 'Input Required',
      sourceAudit: {
        ...(chartData?.sourceAudit || {}),
        chartDataBlocked: true
      },
      freshness: 'Input Required',
      warnings: [...new Set(warnings)],
      ranges: {
        bepFlow: toNumber(props.bepFlow ?? props.designFlow),
        porMinPercent: toNumber(props.porMinPercent),
        porMaxPercent: toNumber(props.porMaxPercent),
        aorMinPercent: toNumber(props.aorMinPercent),
        aorMaxPercent: toNumber(props.aorMaxPercent)
      },
      dutyPoint: {},
      series: {
        pumpHead: [],
        systemHead: [],
        npsha: [],
        npshr: []
      },
      canonical: true,
      blocked: true
    };
  }

  function buildFallbackModel(pumpId, pump) {
    const results = pump.results || {};
    const props = pump.props || {};
    const warnings = [];
    const defaultPropsCurve = isDefaultPumpCurve(props.curveData || []);
    if (defaultPropsCurve) {
      warnings.push('Default props.curveData ignored by canonical chart fallback.');
    }
    const pumpHead = normalizePoints(results.pumpCurve, ['head', 'pumpHead', 'value']);
    const propsPumpHead = defaultPropsCurve
      ? []
      : normalizePoints(props.curveData, ['head', 'pumpHead', 'value']);
    const npshPoints = Array.isArray(results.npshCurvePoints) ? results.npshCurvePoints : [];
    const systemPoints = results.systemCurvePoints || results.sysCurve;
    return {
      pumpId,
      sourceMode: results.curveSource || results.modelBasis || 'Legacy solver results',
      sourceAudit: {
        curveDataSource: results.curveDataSource || props.curveDataSource || '-',
        curveDataConfidence: results.curveDataConfidence || results.dataConfidence || props.curveDataConfidence || '-',
        isDefaultCurveData: defaultPropsCurve
      },
      freshness: results.calculationFreshness || 'Legacy',
      warnings,
      ranges: {
        bepFlow: toNumber(props.bepFlow ?? props.designFlow),
        porMinPercent: toNumber(props.porMinPercent),
        porMaxPercent: toNumber(props.porMaxPercent),
        aorMinPercent: toNumber(props.aorMinPercent),
        aorMaxPercent: toNumber(props.aorMaxPercent)
      },
      dutyPoint: {
        flow: toNumber(results.flow ?? props.designFlow),
        head: toNumber(results.head ?? props.designHead),
        npsha: toNumber(results.npsha),
        npshr: toNumber(results.npshr ?? props.designNpshr),
        margin: toNumber(results.npshMargin)
      },
      series: {
        pumpHead: pumpHead.length ? pumpHead : propsPumpHead,
        systemHead: normalizePoints(systemPoints, ['head', 'systemHead', 'requiredHead']),
        npsha: normalizePoints(npshPoints, ['npsha', 'availableNpsh']),
        npshr: normalizePoints(npshPoints, ['npshr', 'requiredNpsh'])
      },
      canonical: false
    };
  }

  function isPumpFastLanePreviewActive(pumpId, pump = {}) {
    const state = root.__engineeringPumpEditFastLane || {};
    if (root.EngineeringPumpEditFastLane && typeof root.EngineeringPumpEditFastLane.isActiveFor === 'function') {
      try {
        if (root.EngineeringPumpEditFastLane.isActiveFor(pumpId)) return true;
      } catch (error) {
        // Fall through to stored state checks.
      }
    }
    if (state && Number(state.activeUntil || 0) > Date.now() && (!state.pumpId || state.pumpId === pumpId)) {
      return true;
    }
    const results = pump.results || {};
    const evaluation = npshEvaluation(pump);
    return /local preview/i.test(String(results.calculationFreshness || evaluation.calculationFreshness || ''));
  }

  function scaleSeriesToDuty(points, currentValue, previousDutyValue, currentFlow, previousDutyFlow) {
    const numericCurrent = toNumber(currentValue);
    const numericPrevious = toNumber(previousDutyValue);
    const numericCurrentFlow = toNumber(currentFlow);
    const numericPreviousFlow = toNumber(previousDutyFlow);
    if (!points.length) return [];
    const valueRatio = numericCurrent !== null && numericPrevious !== null && numericPrevious > 0
      ? numericCurrent / numericPrevious
      : 1;
    const flowRatio = numericCurrentFlow !== null && numericPreviousFlow !== null && numericPreviousFlow > 0
      ? numericCurrentFlow / numericPreviousFlow
      : 1;
    return points.map((point) => {
      const value = toNumber(point.value);
      const flow = toNumber(point.flow);
      return {
        ...point,
        flow: flow === null ? point.flow : Number((flow * flowRatio).toFixed(6)),
        value: value === null ? point.value : Number((value * valueRatio).toFixed(6))
      };
    });
  }

  function interpolateAnchors(t, anchors) {
    return anchors.reduce((sum, anchor, anchorIndex) => {
      const basis = anchors.reduce((product, other, otherIndex) => (
        otherIndex === anchorIndex ? product : product * ((t - other.t) / (anchor.t - other.t))
      ), 1);
      return sum + anchor.value * basis;
    }, 0);
  }

  function previewHeadSeries(flow, head) {
    const q = toNumber(flow);
    const h = toNumber(head);
    if (q === null || h === null || q <= 0 || h <= 0) return [];
    const anchors = [
      { t: 0.2, value: h * 1.18 },
      { t: 1, value: h },
      { t: 1.7, value: h * 0.48 }
    ];
    return Array.from({ length: 11 }, (_, index) => {
      const t = 0.2 + (1.5 * index / 10);
      return {
        flow: Number(Math.max(q * t, 0.001).toFixed(6)),
        value: Number(Math.max(interpolateAnchors(t, anchors), 0.001).toFixed(6))
      };
    });
  }

  function previewSystemSeries(flow, head) {
    const q = toNumber(flow);
    const h = toNumber(head);
    if (q === null || h === null || q <= 0 || h <= 0) return [];
    return Array.from({ length: 11 }, (_, index) => {
      const t = 0.2 + (1.5 * index / 10);
      return {
        flow: Number(Math.max(q * t, 0.001).toFixed(6)),
        value: Number(Math.max(h * (0.25 + 0.75 * t * t), 0.001).toFixed(6))
      };
    });
  }

  function previewFlatSeries(flow, value) {
    const q = toNumber(flow);
    const y = toNumber(value);
    if (q === null || y === null || q <= 0 || y <= 0) return [];
    return [
      { flow: Math.max(q * 0.2, 0.001), value: y },
      { flow: q, value: y },
      { flow: q * 1.7, value: y }
    ].map((point) => ({
      flow: Number(point.flow.toFixed(6)),
      value: Number(point.value.toFixed(6))
    }));
  }

  function buildFastLanePreviewModel(pumpId, pump, chartData) {
    const results = pump.results || {};
    const props = pump.props || {};
    const evaluation = npshEvaluation(pump);
    const baseRanges = chartData?.ranges || {};
    const baseDuty = chartData?.dutyPoint || {};
    const localFlow = toNumber(evaluation.flow ?? results.flow ?? results.fixedFlow ?? props.designFlow ?? baseDuty.flow);
    const localHead = toNumber(evaluation.pumpHead ?? results.head ?? results.pumpHeadAtFlow ?? props.designHead ?? baseDuty.head);
    const localNpsha = toNumber(evaluation.npsha ?? results.npsha ?? results.npshAvailable ?? baseDuty.npsha);
    const localNpshr = toNumber(evaluation.npshr ?? results.npshr ?? results.npshRequired ?? props.designNpshr ?? baseDuty.npshr);
    const localMargin = localNpsha !== null && localNpshr !== null
      ? localNpsha - localNpshr
      : toNumber(evaluation.npshMargin ?? results.npshMargin ?? baseDuty.margin);
    const propsCurveIsDefault = isDefaultPumpCurve(props.curveData || []);
    const propsPumpHead = propsCurveIsDefault ? [] : normalizePoints(props.curveData, ['head', 'pumpHead', 'value']);
    const propsNpshr = propsCurveIsDefault ? [] : normalizePoints(props.curveData, ['npshr', 'requiredNpsh']);
    const basePumpHead = canonicalSeries(chartData, 'pumpHead');
    const baseNpshr = canonicalSeries(chartData, 'npshr');
    const baseNpsha = canonicalSeries(chartData, 'npsha');
    const baseSystemHead = canonicalSeries(chartData, 'systemHead');
    const systemPoints = results.systemCurvePoints || results.sysCurve;
    const fallbackSystemHead = normalizePoints(systemPoints, ['head', 'systemHead', 'requiredHead']);
    return {
      pumpId,
      sourceMode: 'Local Pump Edit Preview',
      sourceAudit: {
        ...(chartData?.sourceAudit || {}),
        localPumpEditPreview: true,
        backendChartSourceMode: chartData?.sourceMode || ''
      },
      freshness: 'Local preview',
      warnings: [
        'Preview curve follows current Pump Properties input; backend system curve refreshes after autosolve.',
        ...(Array.isArray(chartData?.warnings) ? chartData.warnings : [])
      ].filter(Boolean),
      ranges: {
        bepFlow: toNumber(props.bepFlow ?? props.designFlow ?? baseRanges.bepFlow),
        porMinPercent: toNumber(props.porMinPercent ?? baseRanges.porMinPercent),
        porMaxPercent: toNumber(props.porMaxPercent ?? baseRanges.porMaxPercent),
        aorMinPercent: toNumber(props.aorMinPercent ?? baseRanges.aorMinPercent),
        aorMaxPercent: toNumber(props.aorMaxPercent ?? baseRanges.aorMaxPercent)
      },
      dutyPoint: {
        flow: localFlow,
        head: localHead,
        npsha: localNpsha,
        npshr: localNpshr,
        margin: localMargin
      },
      series: {
        pumpHead: propsPumpHead.length
          ? propsPumpHead
          : (basePumpHead.length ? scaleSeriesToDuty(basePumpHead, localHead, baseDuty.head, localFlow, baseDuty.flow) : previewHeadSeries(localFlow, localHead)),
        systemHead: baseSystemHead.length
          ? scaleSeriesToDuty(baseSystemHead, localHead, baseDuty.head, localFlow, baseDuty.flow)
          : (fallbackSystemHead.length ? fallbackSystemHead : previewSystemSeries(localFlow, localHead)),
        npsha: baseNpsha.length ? scaleSeriesToDuty(baseNpsha, localNpsha, baseDuty.npsha, localFlow, baseDuty.flow) : previewFlatSeries(localFlow, localNpsha),
        npshr: propsNpshr.length
          ? propsNpshr
          : (baseNpshr.length ? scaleSeriesToDuty(baseNpshr, localNpshr, baseDuty.npshr, localFlow, baseDuty.flow) : previewFlatSeries(localFlow, localNpshr))
      },
      canonical: false,
      preview: true
    };
  }

  function buildChartModel(pumpId) {
    const model = runtimeModel();
    const id = resolvePumpId(pumpId);
    const pump = model[id] || {};
    const results = pump.results || {};
    let chartData = results.performanceChartData?.schemaVersion === 'pump-performance-chart-data.v1'
      ? results.performanceChartData
      : null;
    if (isPumpFastLanePreviewActive(id, pump)) {
      const currentChartData = buildCurrentEngineChartData(id, {
        preview: true,
        freshness: 'Local preview',
        reason: 'pump fast-lane input preview',
        chartData,
        pointCount: 18
      });
      if (currentChartData && storedChartDataIsAllowed(pump, currentChartData)) {
        return buildCanonicalModelFromChartData(id, currentChartData, {
          preview: true,
          rebuilt: true,
          sourceMode: 'Local Pump Edit Preview',
          freshness: 'Local preview'
        });
      }
      const chartDataAllowed = chartData ? storedChartDataIsAllowed(pump, chartData) : false;
      return buildFastLanePreviewModel(id, pump, chartDataAllowed ? chartData : null);
    }
    if (chartData) {
      if (!storedChartDataIsAllowed(pump, chartData)) {
        return buildBlockedChartModel(
          id,
          pump,
          chartData,
          'Stored pump performance chart data ignored: complete pump duty inputs or non-default sourced curve data are required.'
        );
      }
      const freshness = chartDataFreshness(id, chartData);
      if (!freshness.isFresh) {
        const currentChartData = buildCurrentEngineChartData(id, {
          reason: 'stale performance chart fingerprint',
          chartData,
          pointCount: 18
        });
        if (currentChartData && storedChartDataIsAllowed(pump, currentChartData)) {
          return buildCanonicalModelFromChartData(id, currentChartData, {
            rebuilt: true,
            freshness: currentChartData.freshness || 'Current'
          });
        }
        chartData = {
          ...chartData,
          freshness: freshness.freshness || 'Stale',
          sourceAudit: {
            ...(chartData.sourceAudit || {}),
            staleInputFingerprint: true
          }
        };
        return buildCanonicalModelFromChartData(id, chartData, {
          stale: true,
          freshness: chartData.freshness
        });
      }
      return buildCanonicalModelFromChartData(id, chartData);
    }
    return buildFallbackModel(id, pump);
  }

  function canvases() {
    if (typeof document === 'undefined') return [];
    return [...new Set(CANVAS_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector))))];
  }

  function setupCanvas(canvas) {
    const shell = canvas.parentElement;
    const cssWidth = Math.max(560, Math.floor(shell?.clientWidth || canvas.clientWidth || 760));
    const cssHeight = Math.max(380, Math.floor(shell?.clientHeight || canvas.clientHeight || 440));
    const ratio = Math.max(1, Math.min(2, root.devicePixelRatio || 1));
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * ratio);
    canvas.height = Math.floor(cssHeight * ratio);
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width: cssWidth, height: cssHeight };
  }

  function axisBounds(chartModel) {
    const points = Object.values(chartModel.series || {}).flat();
    const duty = chartModel.dutyPoint || {};
    if (toNumber(duty.flow) !== null && toNumber(duty.head) !== null) {
      points.push({ flow: toNumber(duty.flow), value: toNumber(duty.head) });
    }
    const flows = points.map((point) => toNumber(point.flow)).filter((value) => value !== null && value >= 0);
    const values = points.map((point) => toNumber(point.value)).filter((value) => value !== null && value >= 0);
    const maxFlow = Math.max(1, ...flows);
    const maxValue = Math.max(1, ...values);
    return {
      xMin: 0,
      xMax: maxFlow * 1.08,
      yMin: 0,
      yMax: maxValue * 1.12
    };
  }

  function ticks(max, count = 5) {
    if (!Number.isFinite(max) || max <= 0) return [0, 1];
    const stepRaw = max / count;
    const magnitude = Math.pow(10, Math.floor(Math.log10(stepRaw)));
    const normalized = stepRaw / magnitude;
    const multiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    const step = multiplier * magnitude;
    const values = [];
    for (let value = 0; value <= max + step * 0.5; value += step) {
      values.push(Number(value.toFixed(6)));
      if (values.length > 12) break;
    }
    return values;
  }

  function drawRegion(context, chart, bounds, xScale, range, color, label) {
    const start = toNumber(range?.start);
    const end = toNumber(range?.end);
    if (start === null || end === null || end <= start) return;
    const left = Math.max(chart.left, xScale(start));
    const right = Math.min(chart.right, xScale(end));
    if (right <= left) return;
    context.save();
    context.fillStyle = color;
    context.fillRect(left, chart.top, right - left, chart.bottom - chart.top);
    context.fillStyle = '#475569';
    context.font = '10px Arial, sans-serif';
    context.fillText(label, left + 4, chart.top + 14);
    context.restore();
  }

  function rangeFlow(ranges, percentKey) {
    const directKey = `${percentKey.replace('Percent', '')}Flow`;
    const direct = toNumber(ranges?.[directKey]);
    if (direct !== null) return direct;
    const bep = toNumber(ranges?.bepFlow);
    const percent = toNumber(ranges?.[percentKey]);
    return bep !== null && percent !== null ? bep * percent / 100 : null;
  }

  function drawSeries(context, points, style, xScale, yScale) {
    const drawable = (points || []).filter((point) => (
      toNumber(point.flow) !== null && toNumber(point.value) !== null
    ));
    if (drawable.length < 2) return;
    context.save();
    context.strokeStyle = style.color;
    context.lineWidth = style.width || 1.8;
    context.setLineDash(style.dash || []);
    context.beginPath();
    drawable.forEach((point, index) => {
      const x = xScale(point.flow);
      const y = yScale(point.value);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.restore();
  }

  function drawLegend(context, chartModel, chart) {
    const entries = Object.entries(STYLES);
    let x = chart.left + 370;
    let y = 26;
    context.save();
    context.font = '11px Arial, sans-serif';
    entries.forEach(([key, style], index) => {
      if (index === 2) {
        x = chart.left + 370;
        y += 20;
      }
      const itemX = x + (index % 2) * 108;
      context.strokeStyle = style.color;
      context.lineWidth = 2;
      context.setLineDash(style.dash || []);
      context.beginPath();
      context.moveTo(itemX, y - 4);
      context.lineTo(itemX + 22, y - 4);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = '#334155';
      context.fillText(style.label, itemX + 28, y);
    });
    context.fillStyle = '#123b5a';
    context.font = 'bold 12px Arial, sans-serif';
    context.fillText(`Pump Performance Chart - ${chartModel.pumpId || '-'}`, chart.left, 28);
    context.restore();
  }

  function renderCanvas(canvas, pumpId) {
    if (!canvas || canvas.tagName !== 'CANVAS') return null;
    const chartModel = buildChartModel(pumpId);
    const { context, width, height } = setupCanvas(canvas);
    const chart = {
      left: 72,
      top: 72,
      right: width - 42,
      bottom: height - 72
    };
    const bounds = axisBounds(chartModel);
    const xScale = value => chart.left + ((toNumber(value) || 0) - bounds.xMin) / (bounds.xMax - bounds.xMin || 1) * (chart.right - chart.left);
    const yScale = value => chart.bottom - ((toNumber(value) || 0) - bounds.yMin) / (bounds.yMax - bounds.yMin || 1) * (chart.bottom - chart.top);

    context.clearRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    const ranges = chartModel.ranges || {};
    drawRegion(context, chart, bounds, xScale, {
      start: rangeFlow(ranges, 'aorMinPercent'),
      end: rangeFlow(ranges, 'aorMaxPercent')
    }, 'rgba(148, 163, 184, 0.16)', 'AOR');
    drawRegion(context, chart, bounds, xScale, {
      start: rangeFlow(ranges, 'porMinPercent'),
      end: rangeFlow(ranges, 'porMaxPercent')
    }, 'rgba(16, 185, 129, 0.16)', 'POR');

    context.save();
    context.strokeStyle = '#dbe5ef';
    context.fillStyle = '#64748b';
    context.lineWidth = 1;
    context.font = '11px Arial, sans-serif';
    ticks(bounds.xMax, 5).forEach((tick) => {
      const x = xScale(tick);
      context.beginPath();
      context.moveTo(x, chart.top);
      context.lineTo(x, chart.bottom);
      context.stroke();
      context.fillText(Number(tick.toFixed(1)).toString(), x - 8, chart.bottom + 22);
    });
    ticks(bounds.yMax, 5).forEach((tick) => {
      const y = yScale(tick);
      context.beginPath();
      context.moveTo(chart.left, y);
      context.lineTo(chart.right, y);
      context.stroke();
      context.fillText(Number(tick.toFixed(1)).toString(), chart.left - 34, y + 4);
    });
    context.strokeStyle = '#cbd5e1';
    context.strokeRect(chart.left, chart.top, chart.right - chart.left, chart.bottom - chart.top);
    context.fillStyle = '#334155';
    context.fillText('Flow (m3/h)', chart.left + (chart.right - chart.left) / 2 - 28, height - 28);
    context.save();
    context.translate(28, chart.top + (chart.bottom - chart.top) / 2 + 38);
    context.rotate(-Math.PI / 2);
    context.fillText('Head / NPSH (m)', 0, 0);
    context.restore();
    context.restore();

    Object.entries(STYLES).forEach(([key, style]) => {
      drawSeries(context, chartModel.series?.[key], style, xScale, yScale);
    });

    const duty = chartModel.dutyPoint || {};
    const dutyFlow = toNumber(duty.flow);
    const dutyHead = toNumber(duty.head);
    if (dutyFlow !== null && dutyHead !== null) {
      const x = xScale(dutyFlow);
      const y = yScale(dutyHead);
      context.save();
      context.fillStyle = '#12a56b';
      context.beginPath();
      context.arc(x, y, 5, 0, Math.PI * 2);
      context.fill();
      context.font = 'bold 11px Arial, sans-serif';
      context.fillText('Duty Point', x + 9, y - 8);
      context.restore();
    }

    drawLegend(context, chartModel, chart);
    context.save();
    context.fillStyle = '#334155';
    context.font = '10px Arial, sans-serif';
    const audit = chartModel.sourceAudit || {};
    const source = audit.curveDataSource || audit.pumpCurveSource || chartModel.sourceMode || '-';
    const confidence = audit.curveDataConfidence || audit.npshrDataConfidence || '-';
    const lines = [
      `Source: ${source}`,
      `Confidence: ${confidence}`,
      `Freshness: ${chartModel.freshness || '-'}`,
      ...(audit.isDefaultCurveData ? ['Review: Default curve template ignored.'] : [])
    ];
    lines.slice(0, 5).forEach((line, index) => {
      context.fillText(line, chart.left, height - 44 + index * 11);
    });
    context.restore();

    canvas.dataset.pumpPerformanceCanonicalChartVersion = VERSION;
    canvas.dataset.pumpPerformanceCanonicalChartSource = chartModel.preview
      ? 'local-preview'
      : (chartModel.canonical ? 'performanceChartData' : 'legacy-fallback');
    root.__pumpPerformanceCanonicalChartLast = chartModel;
    return chartModel;
  }

  function render(pumpId) {
    const id = resolvePumpId(pumpId);
    const rendered = canvases().map((canvas) => renderCanvas(canvas, id)).filter(Boolean);
    return rendered[0] || buildChartModel(id);
  }

  function hasRenderableCanvas() {
    return canvases().length > 0;
  }

  function scheduleRender(pumpId, options = {}) {
    const id = resolvePumpId(pumpId);
    if (!hasRenderableCanvas() && !options.force) {
      return false;
    }
    pendingRenderPumpId = id || pendingRenderPumpId;
    const delayMs = options.delayMs === undefined ? 140 : options.delayMs;
    if (options.force && delayMs <= 32) {
      const runFast = () => {
        ensureRuntimeGuards();
        return render(pendingRenderPumpId);
      };
      if (typeof root.requestAnimationFrame === 'function') {
        root.requestAnimationFrame(runFast);
      } else {
        root.setTimeout?.(runFast, delayMs);
      }
      return true;
    }
    const governor = root.EngineeringPerformanceRefreshGovernor;
    if (governor && typeof governor.schedule === 'function') {
      return governor.schedule('pump-performance-chart', pendingRenderPumpId, {
        delayMs,
        reason: options.reason || 'canonical pump chart render',
        run: () => {
          ensureRuntimeGuards();
          return render(pendingRenderPumpId);
        }
      });
    }
    if (scheduledRenderTimer && root.clearTimeout) {
      root.clearTimeout(scheduledRenderTimer);
    }
    scheduledRenderTimer = root.setTimeout?.(() => {
      scheduledRenderTimer = 0;
      ensureRuntimeGuards();
      render(pendingRenderPumpId);
    }, delayMs) || 0;
    return true;
  }

  function ensureModal(pumpId) {
    if (typeof document === 'undefined') return null;
    const id = resolvePumpId(pumpId);
    let editor = document.getElementById('fullEditor');
    if (!editor) {
      editor = document.createElement('div');
      editor.id = 'fullEditor';
      editor.className = 'full-editor-modal';
      document.body.appendChild(editor);
    }
    editor.classList.add('full-editor-modal');
    editor.style.display = 'flex';
    editor.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'modal-header';
    const title = document.createElement('span');
    title.textContent = `Pump Performance Curve - ${id || '-'}`;
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const minimize = document.createElement('button');
    minimize.type = 'button';
    minimize.className = 'modal-minimize';
    minimize.textContent = '_';
    minimize.addEventListener('click', () => editor.classList.toggle('task-window-minimized'));
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'modal-close';
    close.textContent = 'X';
    close.addEventListener('click', () => {
      editor.style.display = 'none';
    });
    actions.append(minimize, close);
    header.append(title, actions);

    const body = document.createElement('div');
    body.className = 'modal-body';
    const wrap = document.createElement('div');
    wrap.className = 'modal-chart-wrap';
    const canvas = document.createElement('canvas');
    canvas.id = 'pumpChart';
    canvas.dataset.pumpId = id;
    wrap.appendChild(canvas);
    body.appendChild(wrap);
    editor.append(header, body);
    return canvas;
  }

  function markCanonicalFunction(fn, role) {
    fn.__pumpPerformanceCanonicalChartVersion = VERSION;
    fn.__pumpPerformanceCanonicalChartRole = role;
    return fn;
  }

  function copyRuntimePatchFlags(target, source) {
    RUNTIME_PATCH_FLAG_KEYS.forEach((key) => {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    });
  }

  function wrapFunctionAfter(name, after, role) {
    const current = root[name];
    if (typeof current !== 'function' || current.__pumpPerformanceCanonicalChartVersion === VERSION) return false;
    const wrapped = function canonicalChartFunctionWrapper(...args) {
      const result = current.apply(this, args);
      const runAfter = () => after(...args);
      if (result && typeof result.then === 'function') result.finally(runAfter);
      else runAfter();
      return result;
    };
    markCanonicalFunction(wrapped, role);
    wrapped.__pumpPerformanceCanonicalChartOriginal = current;
    copyRuntimePatchFlags(wrapped, current);
    root[name] = wrapped;
    return true;
  }

  function installChartEndpoints() {
    let changed = false;
    if (typeof root.updatePumpChart !== 'function' || root.updatePumpChart.__pumpPerformanceCanonicalChartVersion !== VERSION) {
      root.updatePumpChart = markCanonicalFunction(function updatePumpCanonicalChart(pumpId, options = {}) {
        if (options && options.forceImmediate) {
          return render(pumpId);
        }
        scheduleRender(pumpId, { delayMs: 140, reason: 'updatePumpChart' });
        return root.__pumpPerformanceCanonicalChartLast || buildChartModel(resolvePumpId(pumpId));
      }, 'updatePumpChart');
      changed = true;
    }

    if (typeof root.openPumpPerformanceCurveWindow !== 'function' || root.openPumpPerformanceCurveWindow.__pumpPerformanceCanonicalChartVersion !== VERSION) {
      root.openPumpPerformanceCurveWindow = markCanonicalFunction(function openPumpCanonicalPerformanceCurveWindow(pumpId) {
        const id = resolvePumpId(pumpId);
        ensureModal(id);
        const chartModel = render(id);
        scheduleRender(id, { force: true, delayMs: 140, reason: 'openPumpPerformanceCurveWindow' });
        return chartModel;
      }, 'openPumpPerformanceCurveWindow');
      changed = true;
    }
    return changed;
  }

  function bindRealtimeEvents() {
    if (typeof document === 'undefined' || root.__pumpPerformanceCanonicalRealtimeEventsBound) return false;
    const onRealtimeEvent = (event) => {
      const detail = event?.detail || {};
      const pumpId = detail.nodeId || detail.pumpId || detail.selectedNodeId || '';
      if ((event.type === 'npsh:calculation-stale' || event.type === 'npsh:calculation-calculating') && isInputLatencyShieldActive(pumpId)) {
        return;
      }
      scheduleRender(pumpId);
    };
    REALTIME_EVENTS.forEach((name) => document.addEventListener(name, onRealtimeEvent));
    root.__pumpPerformanceCanonicalRealtimeEventsBound = true;
    return true;
  }

  function bindLiveInputRefresh() {
    if (typeof document === 'undefined' || root.__pumpPerformanceCanonicalLiveInputBound) return false;
    const onInput = (event) => {
      if (event?.isComposing || !isPumpChartLiveInput(event.target)) return;
      const pumpId = resolvePumpIdFromTarget(event.target);
      if (isInputLatencyShieldActive(pumpId)) return;
      scheduleRender(pumpId, { delayMs: 180, reason: 'pump chart input' });
    };
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    root.__pumpPerformanceCanonicalLiveInputBound = true;
    return true;
  }

  function ensureRuntimeGuards() {
    const changed = [
      wrapFunctionAfter('updateSimulation', (options = {}) => {
        const opts = options && typeof options === 'object' ? options : {};
        const pumpId = opts.selectedNodeId || opts.nodeId || '';
        if (!opts.forceBackend && !opts.forceProtectedBackend && !opts.__engineeringRealtimeAutoSolve && isInputLatencyShieldActive(pumpId)) {
          return;
        }
        scheduleRender(pumpId, { reason: opts.refreshReason || opts.trigger || 'updateSimulation' });
      }, 'updateSimulation'),
      wrapFunctionAfter('updatePumpResultReadouts', () => scheduleRender(), 'updatePumpResultReadouts'),
      installChartEndpoints(),
      bindRealtimeEvents(),
      bindLiveInputRefresh()
    ].some(Boolean);
    if (changed) scheduleRender('', { reason: 'runtime guard changed' });
    return changed;
  }

  function startRenderGuardLoop() {
    if (!root.setTimeout) return;
    [0, 80, 220, 500, 900, 1400, 2200, 3600, 5200, 7600].forEach((delay) => {
      root.setTimeout(() => {
        ensureRuntimeGuards();
      }, delay);
    });
    if (typeof document !== 'undefined' && !renderGuardTimer && root.setInterval) {
      renderGuardTimer = root.setInterval(() => {
        ensureRuntimeGuards();
      }, 1600);
      root.__pumpPerformanceCanonicalChartGuardTimer = renderGuardTimer;
    }
  }

  function install() {
    if (root.__pumpPerformanceCanonicalChartInstalled) {
      ensureRuntimeGuards();
      scheduleRender('', { reason: 'canonical chart reinstall' });
      return false;
    }
    root.__pumpPerformanceCanonicalChartInstalled = true;

    ensureRuntimeGuards();

    if (typeof document !== 'undefined') {
      const observer = new MutationObserver((records) => {
        const hasChart = records.some((record) => Array.from(record.addedNodes || []).some((node) => (
          node.nodeType === 1
          && (node.matches?.('#pumpChart, #captionAuditPumpChartCanvas, .caption-audit-inline-chart-wrap, .modal-chart-wrap')
            || node.querySelector?.('#pumpChart, #captionAuditPumpChartCanvas, .caption-audit-inline-chart-wrap canvas, .modal-chart-wrap canvas'))
        )));
        if (hasChart) scheduleRender('', { force: true, reason: 'chart canvas added' });
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      root.__pumpPerformanceCanonicalChartObserver = observer;
    }

    startRenderGuardLoop();
    scheduleRender('', { reason: 'canonical chart install' });
    return true;
  }

  const api = {
    version: VERSION,
    install,
    render,
    buildChartModel,
    scheduleRender,
    ensureRuntimeGuards
  };

  root.EngineeringPumpPerformanceCanonicalChart = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document === 'undefined') {
    install();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
