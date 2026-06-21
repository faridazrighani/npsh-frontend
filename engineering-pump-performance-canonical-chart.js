(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'pump-performance-canonical-chart.v23';
  const PUMP_FORMULA_DEFENSE_RELOCATION_STYLE_ID = 'pump-formula-defense-relocation-style';
  const PUMP_MANUAL_NPSHR_RELOCATION_STYLE_ID = 'pump-manual-npshr-relocation-style';
  const PUMP_DEVELOPMENT_UI_SUPPRESSION_STYLE_ID = 'pump-development-ui-suppression-style';
  const CANVAS_SELECTORS = [
    '#pumpChart',
    '#captionAuditPumpChartCanvas',
    '.caption-audit-inline-chart-wrap canvas',
    '.modal-chart-wrap canvas',
    '.pump-performance-chart-task-window canvas'
  ];
  const REALTIME_EVENTS = [
    'npsh:calculation-stale',
    'npsh:calculation-calculating',
    'npsh:calculation-current',
    'npsh:linked-views-refreshed',
    'npsh:realtime-autosolve-complete'
  ];
  const PUMP_CHART_INPUT_PATTERN = /\b(inputMode|optimizationMode|npshrSourceMode|npshAssessmentMode|npshMarginBasis|designFlow|designHead|designEfficiency|designNpshr|manualNpshr|suctionElevation|pumpDatumElevation|bepFlow|porMinPercent|porMaxPercent|aorMinPercent|aorMaxPercent|minNpshMarginRatio|minNpshMargin|speed|curveDataSource|curveSourceNote|curveData|flow|head|eff|npshr|pressure|elevation|density|viscosity|vaporPressure|segments|length|diameter|roughness|fittingType|fittingQuantity|fittingK|minorLoss|additionalK)\b/i;
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
  let chartTaskWindowCounter = 0;
  let manualNpshrTaskWindowCounter = 0;
  let lastPumpContextMenuId = '';

  const STYLES = {
    pumpHead: { label: 'Pump Head', color: '#164a7a', width: 2.4 },
    systemHead: { label: 'System Curve', color: '#dc2626', width: 2, dash: [6, 5] },
    npsha: { label: 'NPSHa', color: '#0f766e', width: 1.8 },
    npshr: { label: 'NPSHr', color: '#b45309', width: 1.8 }
  };
  const PUMP_NPSH_MARGIN_USER_DEFINED = 'User Defined';
  const PUMP_NPSH_MARGIN_GENERAL_PURPOSE = 'General Purpose';
  const PUMP_NPSH_MARGIN_BASIS_OPTIONS = [
    'General Purpose',
    'Petroleum/Hydrocarbon',
    'Oil & Gas - Consult Manufacturer',
    'Chemical Process',
    'Chemical Process - S < 210',
    'Chemical Process - S >= 210',
    'Power Plant - Boiler Feed <225 kW',
    'Power Plant - Boiler Feed 225-500 kW',
    'Power Plant - Condensate',
    'Power Plant - Circulation/Cooling Water',
    'Power Plant - Cooling Tower/Other',
    'Water/Wastewater',
    'Wastewater - Cast Iron <45 kW',
    'Wastewater - Stainless Steel <45 kW',
    'Wastewater - Cast Iron >=45 kW',
    'Wastewater - Stainless Steel >=45 kW',
    'Water - Stainless/Al Bronze <75 kW',
    'Water - Stainless/Al Bronze >=75 kW',
    'Pulp & Paper Stock <6% - S <145',
    'Pulp & Paper Stock <6% - S >=145',
    'Building Services',
    'Building Services - S <145',
    'Building Services - S >=145',
    'Slurry',
    'Irrigation',
    'User Defined'
  ];
  const PUMP_NPSH_MARGIN_PRESETS = {
    'General Purpose': { por: { ratio: 1.05, margin: 0.6 }, aor: { ratio: 1.1, margin: 1.0 } },
    'Petroleum/Hydrocarbon': { por: { ratio: 1.1, margin: 1.0 }, aor: { ratio: 1.1, margin: 1.0 } },
    'Oil & Gas - Consult Manufacturer': { por: {}, aor: {}, consultManufacturer: true },
    'Chemical Process': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.2, margin: 1.0 } },
    'Chemical Process - S < 210': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.1, margin: 0.6 } },
    'Chemical Process - S >= 210': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.2, margin: 1.0 } },
    'Power Plant - Boiler Feed <225 kW': { por: { ratio: 1.1 }, aor: { ratio: 1.3 } },
    'Power Plant - Boiler Feed 225-500 kW': { por: { ratio: 1.2 }, aor: { ratio: 1.5 } },
    'Power Plant - Condensate': { por: { ratio: 1.0 }, aor: { ratio: 1.0 } },
    'Power Plant - Circulation/Cooling Water': { por: { ratio: 1.05 }, aor: { margin: 1.0 } },
    'Power Plant - Cooling Tower/Other': { por: { ratio: 1.1 }, aor: { ratio: 1.3 } },
    'Water/Wastewater': { por: { ratio: 1.1, margin: 1.0 }, aor: { ratio: 1.2, margin: 1.5 } },
    'Wastewater - Cast Iron <45 kW': { por: { ratio: 1.1, margin: 1.0 }, aor: { ratio: 1.2, margin: 1.5 } },
    'Wastewater - Stainless Steel <45 kW': { por: { ratio: 1.05, margin: 1.0 }, aor: { ratio: 1.1, margin: 1.5 } },
    'Wastewater - Cast Iron >=45 kW': { por: { ratio: 1.2, margin: 1.0 }, aor: { ratio: 1.3, margin: 1.5 } },
    'Wastewater - Stainless Steel >=45 kW': { por: { ratio: 1.1, margin: 1.0 }, aor: { ratio: 1.2, margin: 1.5 } },
    'Water - Stainless/Al Bronze <75 kW': { por: { ratio: 1.05, margin: 1.0 }, aor: { ratio: 1.1, margin: 1.5 } },
    'Water - Stainless/Al Bronze >=75 kW': { por: { ratio: 1.1, margin: 1.0 }, aor: { ratio: 1.2, margin: 1.5 } },
    'Pulp & Paper Stock <6% - S <145': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.1, margin: 0.6 } },
    'Pulp & Paper Stock <6% - S >=145': { por: { ratio: 1.2, margin: 1.0 }, aor: { ratio: 1.2, margin: 1.0 } },
    'Building Services': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.1, margin: 0.6 } },
    'Building Services - S <145': { por: { ratio: 1.0 }, aor: { ratio: 1.0 } },
    'Building Services - S >=145': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.1, margin: 0.6 } },
    'Slurry': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.1, margin: 0.6 } },
    'Irrigation': { por: { ratio: 1.1, margin: 0.6 }, aor: { ratio: 1.2, margin: 1.0 } }
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

  function firstNumber(...values) {
    for (const value of values) {
      const number = toNumber(value);
      if (number !== null) return number;
    }
    return null;
  }

  function numbersDiffer(left, right, tolerance = 1e-5) {
    const a = toNumber(left);
    const b = toNumber(right);
    return a !== null && b !== null && Math.abs(a - b) > tolerance;
  }

  function normalizeMode(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function isVendorSourceText(value) {
    return /vendor|manufacturer|factory|datasheet|certified|tested|test\s*curve|oem/i.test(String(value || ''));
  }

  function isVendorChartData(chartData = null) {
    const audit = chartData?.sourceAudit || {};
    return !!(
      audit.vendorCurve
      || audit.manufacturerCurve
      || isVendorSourceText(chartData?.sourceMode)
      || isVendorSourceText(audit.pumpCurveSource)
      || isVendorSourceText(audit.curveDataSource)
      || isVendorSourceText(audit.curveDataConfidence)
    );
  }

  function livePumpChartInputs(pump = {}) {
    const props = pump.props || {};
    const sourceMode = String(props.npshrSourceMode || '');
    const designFlow = toNumber(props.designFlow);
    const designHead = toNumber(props.designHead);
    const bepFlow = firstNumber(props.bepFlow, props.designFlow);
    const designNpshr = firstNumber(props.designNpshr, props.manualNpshr);
    const manualNpshr = firstNumber(props.manualNpshr, props.designNpshr);
    const manualNpshrMode = /manual/i.test(sourceMode);
    return {
      designFlow,
      designHead,
      bepFlow,
      designNpshr,
      manualNpshr,
      npshrSourceMode: sourceMode,
      manualNpshrMode,
      npshrBasis: manualNpshrMode ? manualNpshr : designNpshr
    };
  }

  function livePumpInputFingerprint(pump = {}) {
    const live = livePumpChartInputs(pump);
    const encode = value => {
      const number = toNumber(value);
      return number === null ? '-' : Number(number.toFixed(6)).toString();
    };
    return [
      `designFlow=${encode(live.designFlow)}`,
      `designHead=${encode(live.designHead)}`,
      `bepFlow=${encode(live.bepFlow)}`,
      `designNpshr=${encode(live.designNpshr)}`,
      `manualNpshr=${encode(live.manualNpshr)}`,
      `npshrSourceMode=${normalizeMode(live.npshrSourceMode) || '-'}`
    ].join('|');
  }

  function designTargetFromPump(pump = {}) {
    const live = livePumpChartInputs(pump);
    return {
      flow: roundChartNumber(live.designFlow),
      head: roundChartNumber(live.designHead),
      npshr: roundChartNumber(live.manualNpshrMode ? live.manualNpshr : live.designNpshr),
      bepFlow: roundChartNumber(live.bepFlow),
      npshrSourceMode: live.npshrSourceMode || ''
    };
  }

  function markerPointsDiffer(left = {}, right = {}) {
    return numbersDiffer(left.flow, right.flow, 1e-4) || numbersDiffer(left.head, right.head, 1e-4);
  }

  function chartDataLiveInputMismatch(pump = {}, chartData = null) {
    const reasons = [];
    if (!chartData) return { mismatch: false, reasons };
    const live = livePumpChartInputs(pump);
    const duty = chartData.dutyPoint || {};
    const ranges = chartData.ranges || {};
    const audit = chartData.sourceAudit || {};
    const compare = (label, liveValue, storedValue) => {
      if (numbersDiffer(liveValue, storedValue)) reasons.push(`${label} changed`);
    };
    compare('Design Flow', live.designFlow, duty.flow);
    compare('Design Head', live.designHead, duty.head);
    compare('BEP Flow', live.bepFlow, ranges.bepFlow);
    if (live.manualNpshrMode) compare('Manual NPSHr', live.manualNpshr, duty.npshr);
    if (audit.staleBecausePumpFastLaneInputChanged) reasons.push('pump fast-lane input changed');
    if (
      live.npshrSourceMode
      && audit.npshrSourceMode
      && normalizeMode(live.npshrSourceMode) !== normalizeMode(audit.npshrSourceMode)
    ) {
      reasons.push('NPSHr Source changed');
    }
    return {
      mismatch: reasons.length > 0,
      reasons,
      fingerprint: livePumpInputFingerprint(pump)
    };
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
    if (/stale/i.test(String(chartData.freshness || ''))) {
      return { isFresh: false, freshness: chartData.freshness || 'Stale' };
    }
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
        smartEngineeringChart: true,
        liveInputFingerprint: livePumpInputFingerprint(model[id] || {}),
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

  function buildSmartCurrentChartData(pumpId, pump, chartData = null, options = {}) {
    const id = resolvePumpId(pumpId);
    const engineData = buildCurrentEngineChartData(id, {
      ...options,
      chartData
    });
    if (engineData) {
      const mismatch = chartDataLiveInputMismatch(pump, engineData);
      if (!mismatch.mismatch) return engineData;
      const lightweight = buildLightweightCurrentChartData(id, chartData, {
        ...options,
        reason: options.reason || `live pump input mismatch: ${mismatch.reasons.join(', ')}`
      });
      if (lightweight) return lightweight;
      return {
        ...engineData,
        freshness: options.freshness || engineData.freshness || 'Current',
        sourceAudit: {
          ...(engineData.sourceAudit || {}),
          frontendChartRebuilt: true,
          smartEngineeringChart: true,
          liveInputMismatch: mismatch.reasons.join(', '),
          liveInputFingerprint: mismatch.fingerprint
        }
      };
    }
    return buildLightweightCurrentChartData(id, chartData, options);
  }

  function buildCanonicalModelFromChartData(pumpId, chartData, options = {}) {
    const sourceAudit = { ...(chartData.sourceAudit || {}) };
    if (options.preview) sourceAudit.localPumpEditPreview = true;
    if (options.rebuilt) sourceAudit.frontendChartRebuilt = true;
    if (options.stale) sourceAudit.staleInputFingerprint = true;
    const series = {
      pumpHead: canonicalSeries(chartData, 'pumpHead'),
      systemHead: canonicalSeries(chartData, 'systemHead'),
      npsha: canonicalSeries(chartData, 'npsha'),
      npshr: canonicalSeries(chartData, 'npshr')
    };
    const chartMode = sourceAudit.chartMode
      || (options.preview || sourceAudit.lightweightFormulaPreview || /preview/i.test(String(chartData.sourceMode || '')) ? 'Preview' : (isVendorChartData(chartData) ? 'Vendor' : 'Solved'));
    const designTarget = options.designTarget || chartData.designTarget || null;
    const intersection = findSeriesIntersection(series.pumpHead, series.systemHead);
    const operatingPoint = {
      ...(chartData.operatingPoint || intersection || chartData.dutyPoint || {}),
      npsha: chartData.operatingPoint?.npsha ?? chartData.dutyPoint?.npsha,
      npshr: chartData.operatingPoint?.npshr ?? chartData.dutyPoint?.npshr,
      margin: chartData.operatingPoint?.margin ?? chartData.dutyPoint?.margin
    };
    const previewMarker = chartData.dutyPoint || designTarget || {};
    const primaryMarker = /^preview$/i.test(chartMode)
      ? previewMarker
      : operatingPoint;
    const markerLabel = sourceAudit.markerLabel
      || (/^preview$/i.test(chartMode) ? 'Design Duty Target' : 'Operating Point');
    const showDesignTarget = designTarget
      && !/^preview$/i.test(chartMode)
      && markerPointsDiffer(designTarget, primaryMarker);
    return {
      pumpId,
      sourceMode: options.sourceMode || chartData.sourceMode || '-',
      sourceAudit: {
        ...sourceAudit,
        chartMode,
        chartBasis: sourceAudit.chartBasis || (/^preview$/i.test(chartMode) ? 'Design Duty Target' : 'Operating Point'),
        markerLabel
      },
      freshness: options.freshness || chartData.freshness || 'Current',
      warnings: Array.isArray(chartData.warnings) ? chartData.warnings : [],
      ranges: chartData.ranges || {},
      dutyPoint: chartData.dutyPoint || {},
      designTarget,
      operatingPoint,
      primaryMarker,
      markerLabel,
      showDesignTarget,
      chartMode,
      series,
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

  function valueAtSeries(points, flow) {
    return interpolateSeriesValue(points, flow);
  }

  function findSeriesIntersection(leftPoints, rightPoints) {
    const left = normalizePoints(leftPoints || [], ['value']);
    const right = normalizePoints(rightPoints || [], ['value']);
    if (left.length < 2 || right.length < 2) return null;
    const flows = Array.from(new Set([
      ...left.map(point => roundChartNumber(point.flow)),
      ...right.map(point => roundChartNumber(point.flow))
    ])).filter((value) => value !== null).sort((a, b) => a - b);
    for (let index = 0; index < flows.length - 1; index += 1) {
      const q1 = flows[index];
      const q2 = flows[index + 1];
      const l1 = valueAtSeries(left, q1);
      const r1 = valueAtSeries(right, q1);
      const l2 = valueAtSeries(left, q2);
      const r2 = valueAtSeries(right, q2);
      if ([l1, r1, l2, r2].some((value) => value === null)) continue;
      const d1 = l1 - r1;
      const d2 = l2 - r2;
      if (Math.abs(d1) <= 1e-6) return { flow: roundChartNumber(q1), head: roundChartNumber(l1) };
      if (d1 * d2 > 0) continue;
      const ratio = d1 === d2 ? 0 : d1 / (d1 - d2);
      const flow = q1 + (q2 - q1) * Math.max(0, Math.min(1, ratio));
      const head = valueAtSeries(left, flow);
      if (head !== null) return { flow: roundChartNumber(flow), head: roundChartNumber(head) };
    }
    const lastFlow = flows[flows.length - 1];
    const lastLeft = valueAtSeries(left, lastFlow);
    const lastRight = valueAtSeries(right, lastFlow);
    if (lastLeft !== null && lastRight !== null && Math.abs(lastLeft - lastRight) <= 1e-6) {
      return { flow: roundChartNumber(lastFlow), head: roundChartNumber(lastLeft) };
    }
    return null;
  }

  function engineeringFitHead(flow, bepFlow, designHead, designFlow = null) {
    const q = toNumber(flow);
    const qbep = toNumber(bepFlow);
    const qd = firstNumber(designFlow, bepFlow);
    const hd = toNumber(designHead);
    if (q === null || qd === null || hd === null || qd <= 0 || hd <= 0) return null;
    const shapeBasis = Math.max(0.001, qbep || qd);
    const bepRatio = qbep && qd ? Math.max(0.3, Math.min(2.2, qbep / qd)) : 1;
    const riseFraction = Math.max(0.14, Math.min(0.34, 0.22 + (1 - bepRatio) * 0.05));
    const curvature = hd * riseFraction / Math.pow(shapeBasis, 2);
    return Math.max(0.001, hd + curvature * (Math.pow(qd, 2) - Math.pow(q, 2)));
  }

  function sumHeadLoss(...values) {
    return values.reduce((sum, value) => {
      const number = toNumber(value);
      return number !== null && number > 0 ? sum + number : sum;
    }, 0);
  }

  function previewSystemBasis(pump, flow, head) {
    const q = toNumber(flow);
    const h = toNumber(head);
    const results = pump?.results || {};
    const evaluation = npshEvaluation(pump);
    const trace = results.routeTrace || evaluation.routeTrace || {};
    const traceSuction = trace.suctionLoss || {};
    const traceDischarge = trace.dischargeLoss || {};
    const knownLoss = sumHeadLoss(
      evaluation.suctionLoss,
      evaluation.dischargeLoss,
      results.suctionLoss,
      results.dischargeLoss,
      results.suctionHeadLoss,
      results.dischargeHeadLoss,
      traceSuction.headLoss,
      traceDischarge.headLoss
    );
    if (q === null || h === null || q <= 0 || h <= 0) {
      return { staticHead: null, lossAtDuty: null, exponent: 2, source: 'unavailable' };
    }
    if (knownLoss > 0 && knownLoss < h * 0.98) {
      return {
        staticHead: roundChartNumber(h - knownLoss),
        lossAtDuty: roundChartNumber(knownLoss),
        exponent: 2,
        source: 'PFV/network head loss scaled as Q^2'
      };
    }
    const staticHead = h * 0.25;
    return {
      staticHead: roundChartNumber(staticHead),
      lossAtDuty: roundChartNumber(h - staticHead),
      exponent: 2,
      source: 'estimated static head fraction'
    };
  }

  function engineeringSystemHead(flow, designFlow, designHead, basis = {}) {
    const q = toNumber(flow);
    const qd = toNumber(designFlow);
    const hd = toNumber(designHead);
    if (q === null || qd === null || hd === null || qd <= 0 || hd <= 0) return null;
    const staticHead = Math.max(0, Math.min(hd * 0.98, firstNumber(basis.staticHead, hd * 0.25)));
    const lossAtDuty = Math.max(0.001, firstNumber(basis.lossAtDuty, hd - staticHead));
    const exponent = firstNumber(basis.exponent, 2) || 2;
    return Math.max(0.001, staticHead + lossAtDuty * Math.pow(Math.max(q, 0) / qd, exponent));
  }

  function previewSystemSeriesFromFlows(flows, designFlow, designHead, basis = {}) {
    return (flows || []).map((flow) => canonicalPoint(
      flow,
      engineeringSystemHead(flow, designFlow, designHead, basis)
    )).filter(Boolean);
  }

  function suctionLossAtDuty(pump = {}) {
    const results = pump.results || {};
    const evaluation = npshEvaluation(pump);
    const trace = results.routeTrace || evaluation.routeTrace || {};
    return firstNumber(
      evaluation.suctionLoss,
      results.suctionLoss,
      results.suctionHeadLoss,
      trace.suctionLoss?.headLoss
    );
  }

  function previewNpshaSeriesFromFlows(flows, designFlow, npsha, suctionLoss) {
    const qd = toNumber(designFlow);
    const available = toNumber(npsha);
    const loss = toNumber(suctionLoss);
    if (qd === null || qd <= 0 || available === null || available <= 0) return [];
    if (loss === null || loss <= 0) {
      return (flows || []).map((flow) => canonicalPoint(flow, available)).filter(Boolean);
    }
    const suctionEnergy = available + loss;
    return (flows || []).map((flow) => {
      const q = Math.max(0, toNumber(flow) || 0);
      return canonicalPoint(flow, Math.max(0.001, suctionEnergy - loss * Math.pow(q / qd, 2)));
    }).filter(Boolean);
  }

  function engineeringFitNpshr(flow, bepFlow, designNpshr) {
    const q = toNumber(flow);
    const qd = toNumber(bepFlow);
    const npshr = toNumber(designNpshr);
    if (q === null || qd === null || npshr === null || qd <= 0 || npshr <= 0) return null;
    const fraction = Math.max(0, q / qd);
    return Math.max(0.01, npshr * (0.65 + 0.35 * Math.pow(fraction, 2.2)));
  }

  function buildFlowGrid(pump, chartData = null) {
    const props = pump.props || {};
    const results = pump.results || {};
    const live = livePumpChartInputs(pump);
    const duty = chartData?.dutyPoint || {};
    const designFlow = live.designFlow;
    const bepFlow = live.bepFlow;
    const dutyFlow = firstNumber(designFlow, results.npshEvaluation?.flow, results.flow, results.fixedFlow, duty.flow);
    const curveFlowBasis = bepFlow || designFlow || dutyFlow;
    const maxFlow = Math.max(
      1,
      toNumber(props.aorMaxPercent) !== null && (bepFlow || designFlow)
        ? (bepFlow || designFlow) * toNumber(props.aorMaxPercent) / 100
        : 0,
      curveFlowBasis ? curveFlowBasis * 1.7 : 0,
      dutyFlow || 0,
      designFlow || 0,
      bepFlow || 0
    );
    const flows = new Set();
    for (let index = 0; index <= 12; index += 1) {
      flows.add(roundChartNumber(maxFlow * index / 12));
    }
    [dutyFlow, designFlow, bepFlow, curveFlowBasis ? curveFlowBasis * 1.7 : null].forEach((value) => {
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
    const live = livePumpChartInputs(pump);
    const duty = chartData?.dutyPoint || {};
    const designFlow = live.designFlow;
    const bepFlow = live.bepFlow;
    const designHead = live.designHead;
    const designNpshr = live.designNpshr;
    const flow = firstNumber(designFlow, evaluation.flow, results.flow, results.fixedFlow, duty.flow);
    const head = firstNumber(designHead, evaluation.pumpHead, results.head, results.pumpHeadAtFlow, duty.head);
    const npsha = firstNumber(evaluation.npsha, results.npsha, duty.npsha);
    if (flow === null || head === null) return null;

    const propsCurveIsDefault = isDefaultPumpCurve(props.curveData || []);
    const propsPumpHead = propsCurveIsDefault ? [] : normalizePoints(props.curveData, ['head', 'pumpHead', 'value']);
    const propsNpshr = propsCurveIsDefault ? [] : normalizePoints(props.curveData, ['npshr', 'requiredNpsh', 'value']);
    const propsCurveIsVendor = isVendorSourceText(results.curveDataSource || props.curveDataSource || props.curveSourceNote);
    const curveFlowBasis = bepFlow || designFlow || flow;
    const manualNpshrMode = live.manualNpshrMode;
    const estimatedDutyNpshr = engineeringFitNpshr(flow, curveFlowBasis, designNpshr ?? live.manualNpshr);
    const npshr = manualNpshrMode
      ? firstNumber(live.manualNpshr, designNpshr, evaluation.npshr, results.npshr, duty.npshr)
      : firstNumber(estimatedDutyNpshr, evaluation.npshr, results.npshr, duty.npshr, designNpshr);
    const flows = buildFlowGrid(pump, chartData);
    const systemBasis = previewSystemBasis(pump, flow, head);
    const designTarget = designTargetFromPump(pump);
    const pumpHeadSeries = flows.map((q) => {
      const fromCurve = propsCurveIsVendor && propsPumpHead.length ? interpolateSeriesValue(propsPumpHead, q) : null;
      return canonicalPoint(q, fromCurve ?? engineeringFitHead(q, curveFlowBasis, head, flow));
    }).filter(Boolean);
    const npshrSeries = flows.map((q) => {
      const fromCurve = !manualNpshrMode && propsNpshr.length ? interpolateSeriesValue(propsNpshr, q) : null;
      const fallback = manualNpshrMode
        ? npshr
        : engineeringFitNpshr(q, curveFlowBasis, designNpshr || npshr);
      return canonicalPoint(q, fromCurve ?? fallback);
    }).filter(Boolean);
    const systemHeadSeries = previewSystemSeriesFromFlows(flows, flow, head, systemBasis);
    const npshaSeries = previewNpshaSeriesFromFlows(flows, flow, npsha, suctionLossAtDuty(pump));

    return {
      schemaVersion: 'pump-performance-chart-data.v1',
      pumpId,
      sourceMode: 'Engineering Fit Preview',
      freshness: options.freshness || (options.preview ? 'Local preview' : 'Current'),
      sourceAudit: {
        ...(chartData?.sourceAudit || {}),
        curveDataSource: propsCurveIsVendor ? (results.curveDataSource || props.curveDataSource || 'Vendor Pump Properties curve data') : 'Engineering fit from Pump Properties',
        curveDataConfidence: propsCurveIsVendor ? (results.curveDataConfidence || props.curveDataConfidence || 'Vendor/manufacturer curve protected') : 'Estimated, not vendor-certified',
        chartMode: propsCurveIsVendor ? 'Vendor' : 'Preview',
        chartBasis: propsCurveIsVendor ? 'Vendor curve with design target overlay' : 'Design Duty Target',
        markerLabel: propsCurveIsVendor ? 'Operating Point' : 'Design Duty Target',
        frontendChartRebuilt: true,
        lightweightFormulaPreview: true,
        smartEngineeringChart: true,
        vendorCurveProtected: propsCurveIsVendor,
        npshrSourceMode: props.npshrSourceMode || '-',
        curveFlowBasis,
        pumpCurveFormula: propsCurveIsVendor ? 'Vendor/manufacturer H-Q data, not forced through design point' : 'Hpump(Q) = H0 - A*Q^2, constrained by Hpump(Qd)=Hd',
        systemCurveFormula: 'Hsystem(Q) = Hstatic + R*Q^2, constrained by Hsystem(Qd)=Hd',
        npshaCurveFormula: 'NPSHa(Q) = suction energy - suction loss at duty*(Q/Qd)^2',
        systemStaticHead: systemBasis.staticHead,
        systemLossAtDuty: systemBasis.lossAtDuty,
        systemCurveBasis: systemBasis.source,
        liveInputFingerprint: livePumpInputFingerprint(pump),
        rebuildReason: options.reason || 'current pump chart input'
      },
      designTarget,
      inputFingerprint: {
        value: livePumpInputFingerprint(pump),
        source: 'frontend-live-pump-properties'
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
        options.preview
          ? 'Preview curve follows current Pump Properties input; backend autosolve will replace it with protected canonical data when available.'
          : 'Pump chart rebuilt from current frontend model; backend autosolve will replace it with protected canonical data when available.'
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
    const currentChartData = buildLightweightCurrentChartData(pumpId, chartData, {
      preview: true,
      freshness: 'Local preview',
      reason: 'pump fast-lane fallback preview'
    });
    if (currentChartData) {
      return buildCanonicalModelFromChartData(pumpId, currentChartData, {
        preview: true,
        rebuilt: true,
        sourceMode: 'Local Pump Edit Preview',
        freshness: 'Local preview'
      });
    }
    const results = pump.results || {};
    const props = pump.props || {};
    const evaluation = npshEvaluation(pump);
    const live = livePumpChartInputs(pump);
    const baseRanges = chartData?.ranges || {};
    const baseDuty = chartData?.dutyPoint || {};
    const localFlow = firstNumber(live.designFlow, evaluation.flow, results.flow, results.fixedFlow, baseDuty.flow);
    const localHead = firstNumber(live.designHead, evaluation.pumpHead, results.head, results.pumpHeadAtFlow, baseDuty.head);
    const localNpsha = firstNumber(evaluation.npsha, results.npsha, results.npshAvailable, baseDuty.npsha);
    const propsCurveIsDefault = isDefaultPumpCurve(props.curveData || []);
    const propsPumpHead = propsCurveIsDefault ? [] : normalizePoints(props.curveData, ['head', 'pumpHead', 'value']);
    const propsNpshr = propsCurveIsDefault ? [] : normalizePoints(props.curveData, ['npshr', 'requiredNpsh']);
    const manualNpshrMode = live.manualNpshrMode;
    const curveFlowBasis = firstNumber(live.bepFlow, live.designFlow, localFlow);
    const estimatedLocalNpshr = engineeringFitNpshr(localFlow, curveFlowBasis, live.designNpshr ?? live.manualNpshr);
    const localNpshr = manualNpshrMode
      ? firstNumber(live.manualNpshr, live.designNpshr, evaluation.npshr, results.npshr, results.npshRequired, baseDuty.npshr)
      : firstNumber(estimatedLocalNpshr, evaluation.npshr, results.npshr, results.npshRequired, baseDuty.npshr, live.designNpshr);
    const localMargin = localNpsha !== null && localNpshr !== null
      ? localNpsha - localNpshr
      : toNumber(evaluation.npshMargin ?? results.npshMargin ?? baseDuty.margin);
    const fallbackFlows = buildFlowGrid(pump, chartData);
    const fallbackPumpHead = fallbackFlows.map((flow) => {
      const fromCurve = propsPumpHead.length ? interpolateSeriesValue(propsPumpHead, flow) : null;
      return canonicalPoint(flow, fromCurve ?? engineeringFitHead(flow, curveFlowBasis, localHead, localFlow));
    }).filter(Boolean);
    const fallbackNpshr = fallbackFlows.map((flow) => {
      const fromCurve = !manualNpshrMode && propsNpshr.length ? interpolateSeriesValue(propsNpshr, flow) : null;
      const fallback = manualNpshrMode
        ? localNpshr
        : engineeringFitNpshr(flow, curveFlowBasis, firstNumber(live.designNpshr, live.manualNpshr, localNpshr));
      return canonicalPoint(flow, fromCurve ?? fallback);
    }).filter(Boolean);
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
        backendChartSourceMode: chartData?.sourceMode || '',
        curveFlowBasis,
        npshrSourceMode: props.npshrSourceMode || '-',
        smartEngineeringChart: true,
        liveInputFingerprint: livePumpInputFingerprint(pump)
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
          : (fallbackPumpHead.length ? fallbackPumpHead : (basePumpHead.length ? scaleSeriesToDuty(basePumpHead, localHead, baseDuty.head, localFlow, baseDuty.flow) : previewHeadSeries(localFlow, localHead))),
        systemHead: baseSystemHead.length
          ? scaleSeriesToDuty(baseSystemHead, localHead, baseDuty.head, localFlow, baseDuty.flow)
          : (fallbackSystemHead.length ? fallbackSystemHead : previewSystemSeries(localFlow, localHead)),
        npsha: baseNpsha.length ? scaleSeriesToDuty(baseNpsha, localNpsha, baseDuty.npsha, localFlow, baseDuty.flow) : previewFlatSeries(localFlow, localNpsha),
        npshr: !manualNpshrMode && propsNpshr.length
          ? propsNpshr
          : (fallbackNpshr.length ? fallbackNpshr : (baseNpshr.length ? scaleSeriesToDuty(baseNpshr, localNpshr, baseDuty.npshr, localFlow, baseDuty.flow) : previewFlatSeries(localFlow, localNpshr)))
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
    const designTarget = designTargetFromPump(pump);
    if (isPumpFastLanePreviewActive(id, pump)) {
      const currentChartData = buildSmartCurrentChartData(id, pump, chartData, {
        preview: true,
        freshness: 'Local preview',
        reason: 'pump fast-lane input preview',
        pointCount: 18
      });
      if (currentChartData && storedChartDataIsAllowed(pump, currentChartData)) {
        return buildCanonicalModelFromChartData(id, currentChartData, {
          preview: true,
          rebuilt: true,
          sourceMode: 'Local Pump Edit Preview',
          freshness: 'Local preview',
          designTarget
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
      const liveMismatch = chartDataLiveInputMismatch(pump, chartData);
      if (liveMismatch.mismatch) {
        if (isVendorChartData(chartData)) {
          const vendorModel = buildCanonicalModelFromChartData(id, {
            ...chartData,
            sourceAudit: {
              ...(chartData.sourceAudit || {}),
              chartMode: 'Vendor',
              chartBasis: 'Vendor curve protected; design target is not forced',
              markerLabel: 'Operating Point',
              vendorCurveProtected: true,
              liveInputMismatch: liveMismatch.reasons.join(', ')
            },
            warnings: [
              ...(Array.isArray(chartData.warnings) ? chartData.warnings : []),
              'Vendor/manufacturer pump curve is protected; design target is shown separately when it does not match the operating point.'
            ]
          }, {
            designTarget
          });
          return {
            ...vendorModel,
            vendorProtected: true
          };
        }
        const currentChartData = buildSmartCurrentChartData(id, pump, chartData, {
          reason: `live pump input changed: ${liveMismatch.reasons.join(', ')}`,
          pointCount: 18
        });
        if (currentChartData && storedChartDataIsAllowed(pump, currentChartData)) {
          return buildCanonicalModelFromChartData(id, currentChartData, {
            rebuilt: true,
            freshness: currentChartData.freshness || 'Current',
            designTarget
          });
        }
      }
      const freshness = chartDataFreshness(id, chartData);
      if (!freshness.isFresh) {
        const currentChartData = buildSmartCurrentChartData(id, pump, chartData, {
          reason: 'stale performance chart fingerprint',
          pointCount: 18
        });
        if (currentChartData && storedChartDataIsAllowed(pump, currentChartData)) {
          return buildCanonicalModelFromChartData(id, currentChartData, {
            rebuilt: true,
            freshness: currentChartData.freshness || 'Current',
            designTarget
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
          freshness: chartData.freshness,
          designTarget
        });
      }
      return buildCanonicalModelFromChartData(id, chartData, { designTarget });
    }
    return buildFallbackModel(id, pump);
  }

  function canvases() {
    if (typeof document === 'undefined') return [];
    return [...new Set(CANVAS_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector))))];
  }

  function isChartTaskWindowCanvas(canvas) {
    return !!canvas?.closest?.('.pump-performance-chart-task-window');
  }

  function setupCanvas(canvas) {
    const shell = canvas.parentElement;
    const compactTaskWindow = isChartTaskWindowCanvas(canvas);
    const minWidth = compactTaskWindow ? 300 : 560;
    const minHeight = compactTaskWindow ? 240 : 380;
    const fallbackWidth = compactTaskWindow ? 420 : 760;
    const fallbackHeight = compactTaskWindow ? 300 : 440;
    const cssWidth = Math.max(minWidth, Math.floor(shell?.clientWidth || canvas.clientWidth || fallbackWidth));
    const cssHeight = Math.max(minHeight, Math.floor(shell?.clientHeight || canvas.clientHeight || fallbackHeight));
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
    [chartModel.primaryMarker, chartModel.dutyPoint, chartModel.designTarget, chartModel.operatingPoint]
      .filter(Boolean)
      .forEach((marker) => {
        if (toNumber(marker.flow) !== null && toNumber(marker.head) !== null) {
          points.push({ flow: toNumber(marker.flow), value: toNumber(marker.head) });
        }
        if (toNumber(marker.flow) !== null && toNumber(marker.npsha) !== null) {
          points.push({ flow: toNumber(marker.flow), value: toNumber(marker.npsha) });
        }
        if (toNumber(marker.flow) !== null && toNumber(marker.npshr) !== null) {
          points.push({ flow: toNumber(marker.flow), value: toNumber(marker.npshr) });
        }
      });
    const ranges = chartModel.ranges || {};
    ['porMinPercent', 'porMaxPercent', 'aorMinPercent', 'aorMaxPercent'].forEach((key) => {
      const flow = rangeFlow(ranges, key);
      if (flow !== null) points.push({ flow, value: 0 });
    });
    const flows = points.map((point) => toNumber(point.flow)).filter((value) => value !== null && value >= 0);
    const values = points.map((point) => toNumber(point.value)).filter((value) => value !== null && value >= 0);
    const maxFlow = Math.max(1, ...flows);
    const maxValue = Math.max(1, ...values);
    return {
      xMin: 0,
      xMax: maxFlow * 1.14,
      yMin: 0,
      yMax: maxValue * 1.18
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

  function drawLegend(context, chartModel, chart, width) {
    const entries = Object.entries(STYLES);
    const compact = width < 620;
    let x = compact ? chart.left : chart.left + 370;
    let y = compact ? 42 : 26;
    context.save();
    context.font = `${compact ? 10 : 11}px Arial, sans-serif`;
    entries.forEach(([key, style], index) => {
      if (index === 2) y += compact ? 15 : 20;
      const itemX = x + (index % 2) * (compact ? 132 : 108);
      context.strokeStyle = style.color;
      context.lineWidth = 2;
      context.setLineDash(style.dash || []);
      context.beginPath();
      context.moveTo(itemX, y - 4);
      context.lineTo(itemX + (compact ? 18 : 22), y - 4);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = '#334155';
      context.fillText(style.label, itemX + (compact ? 23 : 28), y);
    });
    context.fillStyle = '#123b5a';
    context.font = `bold ${compact ? 11 : 12}px Arial, sans-serif`;
    context.fillText(`Pump Performance Chart - ${chartModel.pumpId || '-'}`, chart.left, 28);
    context.restore();
  }

  function truncateCanvasText(context, text, maxWidth) {
    const value = String(text || '');
    if (!Number.isFinite(maxWidth) || maxWidth <= 0 || context.measureText(value).width <= maxWidth) return value;
    const ellipsis = '...';
    let low = 0;
    let high = value.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (context.measureText(`${value.slice(0, mid)}${ellipsis}`).width <= maxWidth) low = mid;
      else high = mid - 1;
    }
    return `${value.slice(0, Math.max(0, low))}${ellipsis}`;
  }

  function buildFooterMetadataLines(chartModel) {
    const audit = chartModel.sourceAudit || {};
    const source = audit.curveDataSource || audit.pumpCurveSource || chartModel.sourceMode || '-';
    const confidence = audit.curveDataConfidence || audit.npshrDataConfidence || '-';
    return [
      `Source: ${source}`,
      `Confidence: ${confidence}`,
      `Freshness: ${chartModel.freshness || '-'}`,
      `Chart Basis: ${audit.chartBasis || chartModel.markerLabel || '-'}`,
      `Curve Mode: ${audit.chartMode || chartModel.chartMode || '-'}`,
      ...(audit.isDefaultCurveData ? ['Review: Default curve template ignored.'] : [])
    ];
  }

  function footerMetadataLinesForLayout(lines, compact) {
    if (compact) {
      return [
        lines.slice(0, 2).join(' | '),
        lines.slice(2).join(' | ')
      ].filter(Boolean);
    }
    return lines.slice(0, 6);
  }

  function drawFooterMetadata(context, lines, chart, compact) {
    const maxWidth = Math.max(80, chart.right - chart.left);
    const lineHeight = compact ? 10 : 11;
    const startY = compact ? chart.bottom + 58 : chart.bottom + 64;
    context.save();
    context.fillStyle = '#334155';
    context.font = `${compact ? 9 : 10}px Arial, sans-serif`;
    lines.forEach((line, index) => {
      context.fillText(truncateCanvasText(context, line, maxWidth), chart.left, startY + index * lineHeight);
    });
    context.restore();
  }

  function renderCanvas(canvas, pumpId) {
    if (!canvas || canvas.tagName !== 'CANVAS') return null;
    const canvasPumpId = canvas.dataset?.pumpId || pumpId;
    const chartModel = buildChartModel(canvasPumpId);
    const { context, width, height } = setupCanvas(canvas);
    const compact = width < 620 || height < 360;
    const footerLines = footerMetadataLinesForLayout(buildFooterMetadataLines(chartModel), compact);
    const footerLineHeight = compact ? 10 : 11;
    const bottomMargin = compact
      ? Math.max(80, 60 + footerLines.length * footerLineHeight)
      : Math.max(92, 70 + footerLines.length * footerLineHeight);
    const chart = {
      left: compact ? 54 : 72,
      top: compact ? 66 : 72,
      right: width - (compact ? 18 : 42),
      bottom: height - bottomMargin
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
    context.font = `${compact ? 10 : 11}px Arial, sans-serif`;
    ticks(bounds.xMax, compact ? 4 : 5).forEach((tick) => {
      const x = xScale(tick);
      context.beginPath();
      context.moveTo(x, chart.top);
      context.lineTo(x, chart.bottom);
      context.stroke();
      context.fillText(Number(tick.toFixed(1)).toString(), x - 8, chart.bottom + (compact ? 18 : 22));
    });
    ticks(bounds.yMax, compact ? 4 : 5).forEach((tick) => {
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
    context.fillText('Flow (m3/h)', chart.left + (chart.right - chart.left) / 2 - 28, chart.bottom + (compact ? 38 : 44));
    context.save();
    context.translate(28, chart.top + (chart.bottom - chart.top) / 2 + 38);
    context.rotate(-Math.PI / 2);
    context.fillText('Head / NPSH (m)', 0, 0);
    context.restore();
    context.restore();

    Object.entries(STYLES).forEach(([key, style]) => {
      drawSeries(context, chartModel.series?.[key], style, xScale, yScale);
    });

    const primaryMarker = chartModel.primaryMarker || chartModel.dutyPoint || {};
    const markerFlow = toNumber(primaryMarker.flow);
    const markerHead = toNumber(primaryMarker.head);
    if (markerFlow !== null && markerHead !== null) {
      const x = xScale(markerFlow);
      const y = yScale(markerHead);
      context.save();
      context.fillStyle = '#12a56b';
      context.beginPath();
      context.arc(x, y, 5, 0, Math.PI * 2);
      context.fill();
      context.font = 'bold 11px Arial, sans-serif';
      const label = chartModel.markerLabel || chartModel.sourceAudit?.markerLabel || 'Operating Point';
      const labelWidth = context.measureText(label).width;
      const labelX = x + labelWidth + 12 > chart.right ? x - labelWidth - 9 : x + 9;
      const labelY = y - 10 < chart.top ? y + 16 : y - 8;
      context.fillText(label, Math.max(chart.left + 2, labelX), Math.min(chart.bottom - 4, labelY));
      context.restore();
    }

    const target = chartModel.showDesignTarget ? chartModel.designTarget : null;
    const targetFlow = toNumber(target?.flow);
    const targetHead = toNumber(target?.head);
    if (targetFlow !== null && targetHead !== null) {
      const x = xScale(targetFlow);
      const y = yScale(targetHead);
      context.save();
      context.strokeStyle = '#7c3aed';
      context.fillStyle = '#7c3aed';
      context.lineWidth = 2;
      context.strokeRect(x - 5, y - 5, 10, 10);
      context.font = 'bold 10px Arial, sans-serif';
      const label = 'Design Target';
      const labelWidth = context.measureText(label).width;
      const labelX = x + labelWidth + 12 > chart.right ? x - labelWidth - 9 : x + 9;
      const labelY = y + 18 > chart.bottom ? y - 10 : y + 16;
      context.fillText(label, Math.max(chart.left + 2, labelX), Math.min(chart.bottom - 4, labelY));
      context.restore();
    }

    drawLegend(context, chartModel, chart, width);
    drawFooterMetadata(context, footerLines, chart, compact);

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

  function cssEscape(value) {
    const text = String(value || '');
    if (typeof root.CSS !== 'undefined' && typeof root.CSS.escape === 'function') {
      return root.CSS.escape(text);
    }
    return text.replace(/["\\]/g, '\\$&');
  }

  function installChartTaskWindowStyles() {
    if (typeof document === 'undefined' || document.getElementById('pump-performance-chart-task-window-style')) return false;
    const style = document.createElement('style');
    style.id = 'pump-performance-chart-task-window-style';
    style.textContent = `
.pump-performance-chart-task-window {
  width: min(840px, calc(100vw - 24px));
  min-width: min(320px, calc(100vw - 24px));
  height: min(620px, calc(100vh - 32px));
  min-height: 300px;
  resize: both;
  overflow: hidden;
}
.pump-performance-chart-task-window .task-window-header {
  cursor: move;
}
.pump-performance-chart-task-body {
  height: calc(100% - 42px);
  overflow: auto;
  padding: 10px;
}
.pump-performance-chart-task-wrap {
  width: 100%;
  min-width: 0;
  height: calc(100% - 2px);
  min-height: 240px;
  border: 1px solid #d9e8f6;
  border-radius: 6px;
  background: #ffffff;
  overflow: hidden;
}
.pump-performance-chart-task-wrap canvas {
  display: block;
  max-width: 100%;
  max-height: 100%;
}
.pump-performance-chart-task-window.task-window-minimized {
  height: auto !important;
  min-height: 0;
  resize: none;
}
.pump-performance-chart-task-window.task-window-minimized .task-window-body {
  display: none;
}
.pump-manual-npshr-task-window {
  width: min(360px, calc(100vw - 24px));
  min-width: min(300px, calc(100vw - 24px));
  min-height: 0;
  height: auto;
  resize: none;
  overflow: hidden;
}
.pump-manual-npshr-task-window .task-window-header {
  cursor: move;
}
.pump-manual-npshr-task-body {
  padding: 12px;
  background: #f8fbff;
}
.pump-manual-npshr-field {
  display: grid;
  grid-template-columns: minmax(104px, 1fr) minmax(120px, 1.4fr) auto;
  gap: 10px;
  align-items: center;
  margin: 0;
  color: #25455f;
  font-size: 12px;
  line-height: 1.3;
}
.pump-manual-npshr-field + .pump-manual-npshr-field {
  margin-top: 10px;
}
.pump-manual-npshr-field input,
.pump-manual-npshr-field select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 4px 8px;
  border: 1px solid #c8d7e5;
  border-radius: 4px;
  background: #ffffff;
  color: #14283a;
  font: inherit;
}
.pump-manual-npshr-field input:read-only {
  background: #eef6ff;
  color: #31536d;
}
.pump-manual-npshr-field input:focus,
.pump-manual-npshr-field select:focus {
  border-color: #2879b8;
  box-shadow: 0 0 0 2px rgba(40, 121, 184, 0.16);
  outline: none;
}
.pump-manual-npshr-unit {
  color: #355c76;
  white-space: nowrap;
}
.pump-manual-npshr-criteria-note {
  margin: 10px 0 0;
  padding: 8px 10px;
  border: 1px solid #cfddea;
  border-radius: 4px;
  background: #ffffff;
  color: #274963;
  font-size: 11.5px;
  line-height: 1.35;
}
.pump-manual-npshr-criteria-note[data-state="partial"] {
  border-color: #e8d8a8;
  background: #fff9e8;
  color: #5b4a14;
}
.pump-manual-npshr-criteria-note[data-state="consult"],
.pump-manual-npshr-criteria-note[data-state="missing"] {
  border-color: #e6b8b8;
  background: #fff6f6;
  color: #74312f;
}
@media (max-width: 760px) {
  .pump-performance-chart-task-window {
    left: 8px !important;
    right: 8px !important;
    width: calc(100vw - 16px);
    min-width: 0;
    height: min(560px, calc(100vh - 24px));
  }
  .pump-manual-npshr-task-window {
    left: 8px !important;
    right: 8px !important;
    width: calc(100vw - 16px);
    min-width: 0;
  }
  .pump-manual-npshr-field {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
`;
    document.head?.appendChild(style);
    return true;
  }

  function bringChartTaskWindowToFront(windowNode) {
    if (!windowNode) return;
    if (typeof root.bringTaskWindowToFront === 'function') {
      root.bringTaskWindowToFront(windowNode);
      return;
    }
    const nextZ = (Number(root.__pumpPerformanceChartTaskWindowZ || 1300) + 1);
    root.__pumpPerformanceChartTaskWindowZ = nextZ;
    windowNode.style.zIndex = String(nextZ);
  }

  function clampChartTaskWindowToViewport(windowNode) {
    if (!windowNode || typeof window === 'undefined') return;
    const rect = windowNode.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - Math.min(rect.width || 0, window.innerWidth - 16) - 8);
    const maxTop = Math.max(8, window.innerHeight - Math.min(rect.height || 0, window.innerHeight - 16) - 8);
    const left = Math.max(8, Math.min(parseFloat(windowNode.style.left) || rect.left || 8, maxLeft));
    const top = Math.max(8, Math.min(parseFloat(windowNode.style.top) || rect.top || 8, maxTop));
    windowNode.style.left = `${left}px`;
    windowNode.style.top = `${top}px`;
    windowNode.style.right = 'auto';
  }

  function initializeChartTaskWindowDrag(windowNode, header) {
    if (!windowNode || !header || windowNode.dataset.pumpPerformanceChartDragBound === 'true') return false;
    windowNode.dataset.pumpPerformanceChartDragBound = 'true';
    let drag = null;
    header.addEventListener('pointerdown', (event) => {
      if (event.target?.closest?.('button, input, select, textarea, a')) return;
      const rect = windowNode.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      header.setPointerCapture?.(event.pointerId);
      bringChartTaskWindowToFront(windowNode);
      event.preventDefault?.();
    });
    header.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      windowNode.style.left = `${drag.left + event.clientX - drag.startX}px`;
      windowNode.style.top = `${drag.top + event.clientY - drag.startY}px`;
      windowNode.style.right = 'auto';
      clampChartTaskWindowToViewport(windowNode);
    });
    const stopDrag = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      header.releasePointerCapture?.(event.pointerId);
      drag = null;
      clampChartTaskWindowToViewport(windowNode);
    };
    header.addEventListener('pointerup', stopDrag);
    header.addEventListener('pointercancel', stopDrag);
    return true;
  }

  function updateChartTaskWindowMinimizeButton(windowNode) {
    const button = windowNode?.querySelector?.('.task-window-minimize');
    if (!button) return;
    const minimized = windowNode.classList.contains('task-window-minimized');
    button.textContent = minimized ? '□' : '_';
    button.setAttribute('aria-label', minimized ? 'Restore pump performance chart window' : 'Minimize pump performance chart window');
  }

  function bindChartTaskWindowResizeObserver(windowNode, pumpId) {
    if (!windowNode || windowNode.dataset.pumpPerformanceChartResizeObserverBound === 'true') return false;
    windowNode.dataset.pumpPerformanceChartResizeObserverBound = 'true';
    let pending = 0;
    const renderAfterResize = () => {
      if (pending) root.cancelAnimationFrame?.(pending);
      const run = () => {
        pending = 0;
        scheduleRender(pumpId, { force: true, delayMs: 16, reason: 'pump performance chart task window element resize' });
      };
      if (typeof root.requestAnimationFrame === 'function') pending = root.requestAnimationFrame(run);
      else pending = root.setTimeout?.(run, 16) || 0;
    };
    if (typeof root.ResizeObserver === 'function') {
      const observer = new root.ResizeObserver(renderAfterResize);
      observer.observe(windowNode);
      const body = windowNode.querySelector?.('.pump-performance-chart-task-body');
      const wrap = windowNode.querySelector?.('.pump-performance-chart-task-wrap');
      if (body) observer.observe(body);
      if (wrap) observer.observe(wrap);
      windowNode.__pumpPerformanceChartResizeObserver = observer;
      return true;
    }
    const interval = root.setInterval?.(renderAfterResize, 500) || 0;
    windowNode.__pumpPerformanceChartResizeInterval = interval;
    return !!interval;
  }

  function disconnectChartTaskWindowResizeObserver(windowNode) {
    windowNode?.__pumpPerformanceChartResizeObserver?.disconnect?.();
    if (windowNode?.__pumpPerformanceChartResizeInterval && root.clearInterval) {
      root.clearInterval(windowNode.__pumpPerformanceChartResizeInterval);
    }
  }

  function ensureTaskWindow(pumpId) {
    if (typeof document === 'undefined') return null;
    installChartTaskWindowStyles();
    const id = resolvePumpId(pumpId);
    const selector = `.pump-performance-chart-task-window[data-pump-node-id="${cssEscape(id)}"]`;
    const existing = document.querySelector(selector);
    if (existing) {
      existing.classList.remove('task-window-minimized');
      updateChartTaskWindowMinimizeButton(existing);
      bringChartTaskWindowToFront(existing);
      clampChartTaskWindowToViewport(existing);
      const existingCanvas = existing.querySelector('canvas');
      if (existingCanvas) existingCanvas.dataset.pumpId = id;
      bindChartTaskWindowResizeObserver(existing, id);
      render(id);
      scheduleRender(id, { force: true, delayMs: 16, reason: 'open pump performance chart task window' });
      existing.focus?.({ preventScroll: true });
      return existingCanvas;
    }

    chartTaskWindowCounter += 1;
    const offset = (chartTaskWindowCounter - 1) % 4 * 24;
    const taskWindow = document.createElement('section');
    taskWindow.className = 'task-window pump-performance-chart-task-window task-window-user-positioned';
    taskWindow.dataset.kind = 'pump-performance-chart';
    taskWindow.dataset.pumpNodeId = id;
    taskWindow.setAttribute('role', 'dialog');
    taskWindow.setAttribute('aria-modal', 'false');
    taskWindow.setAttribute('aria-label', 'Pump Performance Chart');
    taskWindow.setAttribute('tabindex', '-1');

    const pumpProperties = document.getElementById('taskWindow');
    const anchor = pumpProperties && !pumpProperties.hidden ? pumpProperties.getBoundingClientRect() : null;
    const width = Math.min(840, Math.max(540, window.innerWidth - 24));
    const fallbackLeft = window.innerWidth <= 760 ? 8 : 70 + offset;
    const left = anchor ? anchor.left - width - 14 : fallbackLeft;
    taskWindow.style.left = `${Math.max(8, left > 8 ? left : fallbackLeft)}px`;
    taskWindow.style.top = `${Math.max(8, (anchor?.top || 112) + offset)}px`;
    taskWindow.style.right = 'auto';

    const header = document.createElement('div');
    header.className = 'task-window-header pump-performance-chart-window-header';
    const title = document.createElement('span');
    title.textContent = `Pump Performance Chart - ${id || '-'}`;
    const actions = document.createElement('div');
    actions.className = 'task-window-actions';
    const minimize = document.createElement('button');
    minimize.type = 'button';
    minimize.className = 'task-window-minimize';
    minimize.textContent = '_';
    minimize.setAttribute('aria-label', 'Minimize pump performance chart window');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'task-window-close';
    close.textContent = 'X';
    close.setAttribute('aria-label', 'Close pump performance chart window');
    actions.append(minimize, close);
    header.append(title, actions);

    const body = document.createElement('div');
    body.className = 'task-window-body pump-performance-chart-task-body';
    const wrap = document.createElement('div');
    wrap.className = 'pump-performance-chart-task-wrap';
    const canvas = document.createElement('canvas');
    canvas.dataset.pumpId = id;
    canvas.setAttribute('aria-label', `Pump Performance Chart - ${id || '-'}`);
    wrap.appendChild(canvas);
    body.appendChild(wrap);

    const onResize = () => {
      clampChartTaskWindowToViewport(taskWindow);
      scheduleRender(id, { force: true, delayMs: 16, reason: 'pump performance chart task window resize' });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    minimize.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      taskWindow.classList.toggle('task-window-minimized');
      updateChartTaskWindowMinimizeButton(taskWindow);
      if (!taskWindow.classList.contains('task-window-minimized')) {
        scheduleRender(id, { force: true, delayMs: 16, reason: 'restore pump performance chart task window' });
      }
    });
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      disconnectChartTaskWindowResizeObserver(taskWindow);
      taskWindow.remove();
    });

    taskWindow.append(header, body);
    document.body.appendChild(taskWindow);
    initializeChartTaskWindowDrag(taskWindow, header);
    bindChartTaskWindowResizeObserver(taskWindow, id);
    bringChartTaskWindowToFront(taskWindow);
    clampChartTaskWindowToViewport(taskWindow);
    render(id);
    scheduleRender(id, { force: true, delayMs: 16, reason: 'open pump performance chart task window' });
    taskWindow.focus?.({ preventScroll: true });
    return canvas;
  }

  function cleanText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function formatNumericInputValue(value, digits = 6) {
    const number = toNumber(value);
    return number === null ? '' : Number(number.toFixed(digits)).toString();
  }

  function marginRegionKey(pump = {}) {
    const props = pump.props || {};
    const status = cleanText(
      props.npshMarginRegionBasis
      || props.npshMarginOperatingRegion
      || props.marginRegionBasis
      || ''
    ).toUpperCase();
    return status === 'AOR' ? 'aor' : 'por';
  }

  function pumpHasUserDefinedMarginValues(props = {}) {
    return firstNumber(props.minNpshMarginRatio) !== null || firstNumber(props.minNpshMargin) !== null;
  }

  function marginBasisForPump(pump = {}) {
    const props = pump.props || {};
    const raw = cleanText(props.npshMarginBasis);
    if (!raw) return PUMP_NPSH_MARGIN_GENERAL_PURPOSE;
    if (raw === PUMP_NPSH_MARGIN_USER_DEFINED && !pumpHasUserDefinedMarginValues(props)) {
      return PUMP_NPSH_MARGIN_GENERAL_PURPOSE;
    }
    return PUMP_NPSH_MARGIN_BASIS_OPTIONS.includes(raw) ? raw : PUMP_NPSH_MARGIN_GENERAL_PURPOSE;
  }

  function marginPresetDefinitionForBasis(basis = '') {
    const selectedBasis = basis || PUMP_NPSH_MARGIN_GENERAL_PURPOSE;
    return PUMP_NPSH_MARGIN_PRESETS[selectedBasis] || PUMP_NPSH_MARGIN_PRESETS[PUMP_NPSH_MARGIN_GENERAL_PURPOSE];
  }

  function marginPresetForPump(pump = {}, basis = '') {
    const selectedBasis = basis || marginBasisForPump(pump);
    if (selectedBasis === PUMP_NPSH_MARGIN_USER_DEFINED) return null;
    const preset = marginPresetDefinitionForBasis(selectedBasis);
    return preset?.[marginRegionKey(pump)] || preset?.aor || preset?.por || null;
  }

  function marginCriteriaDetailsForPump(pump = {}, basis = '') {
    const selectedBasis = basis || marginBasisForPump(pump);
    const props = pump.props || {};
    const regionKey = marginRegionKey(pump);
    if (selectedBasis === PUMP_NPSH_MARGIN_USER_DEFINED) {
      const ratio = firstNumber(props.minNpshMarginRatio);
      const margin = firstNumber(props.minNpshMargin);
      return {
        basis: selectedBasis,
        regionKey: 'user',
        userDefined: true,
        consultManufacturer: false,
        ratio,
        margin,
        hasRatio: ratio !== null,
        hasMargin: margin !== null
      };
    }
    const preset = marginPresetDefinitionForBasis(selectedBasis);
    const criteria = preset?.[regionKey] || preset?.aor || preset?.por || {};
    const ratio = firstNumber(criteria?.ratio);
    const margin = firstNumber(criteria?.margin);
    return {
      basis: PUMP_NPSH_MARGIN_PRESETS[selectedBasis] ? selectedBasis : PUMP_NPSH_MARGIN_GENERAL_PURPOSE,
      regionKey,
      userDefined: false,
      consultManufacturer: !!preset?.consultManufacturer,
      ratio,
      margin,
      hasRatio: ratio !== null,
      hasMargin: margin !== null
    };
  }

  function describeMarginCriteria(details = {}) {
    const region = details.regionKey === 'aor' ? 'AOR' : details.regionKey === 'por' ? 'POR' : 'user';
    if (details.userDefined) {
      if (!details.hasRatio && !details.hasMargin) {
        return 'User Defined basis requires at least Min NPSH Ratio or Min NPSH Margin before margin acceptance can be calculated.';
      }
      if (details.hasRatio && details.hasMargin) {
        return 'User Defined basis will use the larger required NPSHa from ratio and absolute margin criteria.';
      }
      return details.hasRatio
        ? 'User Defined basis will use the Min NPSH Ratio criterion only.'
        : 'User Defined basis will use the Min NPSH Margin criterion only.';
    }
    if (details.consultManufacturer) {
      return `${details.basis}: ANSI/HI lists this service as Consult manufacturer for ${region}; no numeric default is published. Use manufacturer/project-specific criteria or select User Defined when numeric evidence is available.`;
    }
    if (details.hasRatio && details.hasMargin) {
      return `${details.basis}: ${region} criteria include both Min NPSH Ratio and Min NPSH Margin. The calculation uses the more conservative requirement.`;
    }
    if (details.hasRatio) {
      return `${details.basis}: ${region} criteria specify Min NPSH Ratio only; Min NPSH Margin is not specified by the ANSI/HI table.`;
    }
    if (details.hasMargin) {
      return `${details.basis}: ${region} criteria specify Min NPSH Margin only; Min NPSH Ratio is not specified by the ANSI/HI table.`;
    }
    return `${details.basis || 'Selected basis'}: no numeric NPSH margin criterion is available for ${region}; review the selected service basis.`;
  }

  function updateMarginCriteriaPresentation(taskWindow, pumpId) {
    if (!taskWindow?.querySelector) return false;
    const id = resolvePumpId(pumpId);
    const pump = runtimeModel()?.[id] || {};
    const select = taskWindow.querySelector('select[data-field="npshMarginBasis"]');
    const basis = cleanText(select?.value) || marginBasisForPump(pump);
    const pseudoPump = { ...pump, props: { ...(pump.props || {}), npshMarginBasis: basis } };
    const details = marginCriteriaDetailsForPump(pseudoPump, basis);
    const ratioInput = taskWindow.querySelector('input[data-field="minNpshMarginRatio"]');
    const marginInput = taskWindow.querySelector('input[data-field="minNpshMargin"]');
    const note = taskWindow.querySelector('[data-npsh-margin-criteria-note="true"]');
    const missingText = details.consultManufacturer ? 'Consult manufacturer' : 'Not specified';
    let changed = false;
    [
      [ratioInput, details.hasRatio, 'Min NPSH Ratio'],
      [marginInput, details.hasMargin, 'Min NPSH Margin']
    ].forEach(([input, hasValue, label]) => {
      if (!input) return;
      const nextPlaceholder = details.userDefined ? '' : (hasValue ? '' : missingText);
      const nextTitle = details.userDefined
        ? `${label} is editable for User Defined basis.`
        : hasValue
          ? `${label} is specified by the selected ANSI/HI basis.`
          : `${label} is ${missingText.toLowerCase()} for the selected ANSI/HI basis.`;
      if (input.placeholder !== nextPlaceholder) {
        input.placeholder = nextPlaceholder;
        changed = true;
      }
      if (input.title !== nextTitle) {
        input.title = nextTitle;
        changed = true;
      }
    });
    if (note) {
      const nextState = details.consultManufacturer
        ? 'consult'
        : details.hasRatio && details.hasMargin
          ? 'complete'
          : details.hasRatio || details.hasMargin
            ? 'partial'
            : 'missing';
      const nextText = describeMarginCriteria(details);
      if (note.dataset.state !== nextState) {
        note.dataset.state = nextState;
        changed = true;
      }
      if (note.textContent !== nextText) {
        note.textContent = nextText;
        changed = true;
      }
    }
    return changed;
  }

  function formatMarginRatioInputValue(pumpId) {
    const pump = runtimeModel()?.[resolvePumpId(pumpId)] || {};
    const basis = marginBasisForPump(pump);
    const value = basis === PUMP_NPSH_MARGIN_USER_DEFINED
      ? firstNumber(pump.props?.minNpshMarginRatio)
      : firstNumber(marginPresetForPump(pump, basis)?.ratio);
    return formatNumericInputValue(value, 6);
  }

  function formatMarginAbsoluteInputValue(pumpId) {
    const pump = runtimeModel()?.[resolvePumpId(pumpId)] || {};
    const basis = marginBasisForPump(pump);
    const value = basis === PUMP_NPSH_MARGIN_USER_DEFINED
      ? firstNumber(pump.props?.minNpshMargin)
      : firstNumber(marginPresetForPump(pump, basis)?.margin);
    return formatNumericInputValue(value, 6);
  }

  function formatManualNpshrInputValue(pumpId) {
    const pump = runtimeModel()?.[resolvePumpId(pumpId)] || {};
    const evaluation = pump.results?.npshEvaluation || {};
    const value = firstNumber(
      pump.props?.manualNpshr,
      pump.props?.designNpshr,
      evaluation.npshr,
      pump.results?.npshr,
      pump.results?.npshRequired
    );
    return formatNumericInputValue(value, 6);
  }

  function formatPumpDatumInputValue(pumpId) {
    const pump = runtimeModel()?.[resolvePumpId(pumpId)] || {};
    const evaluation = pump.results?.npshEvaluation || {};
    const tracePump = evaluation.calculationTrace?.pump || {};
    const value = firstNumber(
      pump.props?.suctionElevation,
      pump.props?.elevation,
      tracePump.elevation
    );
    return formatNumericInputValue(value, 6);
  }

  function refreshManualNpshrTaskWindow(taskWindow, pumpId) {
    if (!taskWindow?.querySelector) return false;
    let changed = false;
    [
      ['manualNpshr', formatManualNpshrInputValue(pumpId)],
      ['suctionElevation', formatPumpDatumInputValue(pumpId)],
      ['minNpshMarginRatio', formatMarginRatioInputValue(pumpId)],
      ['minNpshMargin', formatMarginAbsoluteInputValue(pumpId)]
    ].forEach(([field, nextValue]) => {
      const input = taskWindow.querySelector(`input[data-field="${field}"]`);
      if (!input || document.activeElement === input || input.value === nextValue) return;
      input.value = nextValue;
      changed = true;
    });
    const pump = runtimeModel()?.[resolvePumpId(pumpId)] || {};
    const basis = marginBasisForPump(pump);
    const select = taskWindow.querySelector('select[data-field="npshMarginBasis"]');
    if (select && document.activeElement !== select && select.value !== basis) {
      select.value = basis;
      changed = true;
    }
    const userDefined = basis === PUMP_NPSH_MARGIN_USER_DEFINED;
    ['minNpshMarginRatio', 'minNpshMargin'].forEach((field) => {
      const input = taskWindow.querySelector(`input[data-field="${field}"]`);
      if (!input) return;
      if (input.readOnly === userDefined) {
        input.readOnly = !userDefined;
        changed = true;
      }
    });
    changed = updateMarginCriteriaPresentation(taskWindow, pumpId) || changed;
    return changed;
  }

  function scheduleManualNpshrLinkedRefresh(pumpId, eventType = 'input') {
    scheduleRender(pumpId, { force: true, delayMs: eventType === 'change' ? 80 : 16, reason: 'manual npshr task input' });
    try {
      root.EngineeringAnalysisReportLiveRuntime?.scheduleRefresh?.(80);
    } catch (error) {
      // Analysis report refresh is best-effort.
    }
    try {
      root.EngineeringPumpFormulaDefenseLiveAudit?.scheduleRefresh?.(pumpId);
    } catch (error) {
      // Formula Defense refresh is best-effort.
    }
  }

  function ensureManualNpshrTaskWindow(pumpId) {
    if (typeof document === 'undefined') return null;
    installChartTaskWindowStyles();
    const id = resolvePumpId(pumpId);
    const selector = `.pump-manual-npshr-task-window[data-pump-node-id="${cssEscape(id)}"]`;
    const existing = document.querySelector(selector);
    if (existing) {
      refreshManualNpshrTaskWindow(existing, id);
      bringChartTaskWindowToFront(existing);
      clampChartTaskWindowToViewport(existing);
      existing.focus?.({ preventScroll: true });
      const existingInput = existing.querySelector('input[data-field="manualNpshr"]');
      existingInput?.focus?.({ preventScroll: true });
      existingInput?.select?.();
      return existing;
    }

    manualNpshrTaskWindowCounter += 1;
    const offset = (manualNpshrTaskWindowCounter - 1) % 4 * 20;
    const taskWindow = document.createElement('section');
    taskWindow.className = 'task-window pump-manual-npshr-task-window task-window-user-positioned';
    taskWindow.dataset.kind = 'pump-manual-npshr';
    taskWindow.dataset.pumpNodeId = id;
    taskWindow.dataset.nodeId = id;
    taskWindow.setAttribute('role', 'dialog');
    taskWindow.setAttribute('aria-modal', 'false');
    taskWindow.setAttribute('aria-label', 'Pump Datum - NPSHR');
    taskWindow.setAttribute('tabindex', '-1');

    const pumpProperties = document.getElementById('taskWindow');
    const anchor = pumpProperties && !pumpProperties.hidden ? pumpProperties.getBoundingClientRect() : null;
    const width = Math.min(360, Math.max(300, window.innerWidth - 24));
    const fallbackLeft = window.innerWidth <= 760 ? 8 : 96 + offset;
    const left = anchor ? Math.min(anchor.right + 14, window.innerWidth - width - 8) : fallbackLeft;
    taskWindow.style.left = `${Math.max(8, left > 8 ? left : fallbackLeft)}px`;
    taskWindow.style.top = `${Math.max(8, (anchor?.top || 112) + offset)}px`;
    taskWindow.style.right = 'auto';

    const header = document.createElement('div');
    header.className = 'task-window-header pump-manual-npshr-window-header';
    const title = document.createElement('span');
    title.textContent = `Pump Datum - NPSHR - ${id || '-'}`;
    const actions = document.createElement('div');
    actions.className = 'task-window-actions';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'task-window-close';
    close.textContent = 'X';
    close.setAttribute('aria-label', 'Close Pump Datum - NPSHR window');
    actions.append(close);
    header.append(title, actions);

    const body = document.createElement('div');
    body.className = 'task-window-body pump-manual-npshr-task-body';
    const createNumericField = ({ label, field, key, name, value, unitText = 'm', min = '', step = '0.001', readOnly = false, ariaLabel = label }) => {
      const fieldNode = document.createElement('label');
      fieldNode.className = 'pump-manual-npshr-field';
      const labelText = document.createElement('span');
      labelText.textContent = label;
      const inputNode = document.createElement('input');
      inputNode.type = 'number';
      inputNode.inputMode = 'decimal';
      if (min !== '') inputNode.min = min;
      inputNode.step = step;
      inputNode.name = name;
      inputNode.dataset.key = key;
      inputNode.dataset.field = field;
      inputNode.dataset.node = id;
      inputNode.dataset.nodeId = id;
      inputNode.dataset.pumpNodeId = id;
      inputNode.value = value;
      inputNode.readOnly = !!readOnly;
      inputNode.setAttribute('aria-label', ariaLabel);
      const unit = document.createElement('span');
      unit.className = 'pump-manual-npshr-unit';
      unit.textContent = unitText;
      fieldNode.append(labelText, inputNode, unit);
      return { fieldNode, inputNode };
    };
    const createSelectField = ({ label, field, key, name, value, options, ariaLabel = label }) => {
      const fieldNode = document.createElement('label');
      fieldNode.className = 'pump-manual-npshr-field';
      const labelText = document.createElement('span');
      labelText.textContent = label;
      const selectNode = document.createElement('select');
      selectNode.name = name;
      selectNode.dataset.key = key;
      selectNode.dataset.field = field;
      selectNode.dataset.node = id;
      selectNode.dataset.nodeId = id;
      selectNode.dataset.pumpNodeId = id;
      selectNode.setAttribute('aria-label', ariaLabel);
      options.forEach((optionValue) => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        selectNode.appendChild(option);
      });
      selectNode.value = value;
      const unit = document.createElement('span');
      unit.className = 'pump-manual-npshr-unit';
      unit.textContent = '';
      fieldNode.append(labelText, selectNode, unit);
      return { fieldNode, selectNode };
    };
    const pump = runtimeModel()?.[id] || {};
    const marginBasis = marginBasisForPump(pump);
    const manualField = createNumericField({
      label: 'Manual NPSHr',
      field: 'manualNpshr',
      key: 'designNpshr',
      name: 'design-npshr',
      value: formatManualNpshrInputValue(id),
      min: '0',
      ariaLabel: 'Manual NPSHr'
    });
    const datumField = createNumericField({
      label: 'Pump Datum Elev.',
      field: 'suctionElevation',
      key: 'suctionElevation',
      name: 'pump-datum-elevation',
      value: formatPumpDatumInputValue(id),
      ariaLabel: 'Pump Datum Elev.'
    });
    const marginBasisField = createSelectField({
      label: 'NPSH Margin Basis',
      field: 'npshMarginBasis',
      key: 'npshMarginBasis',
      name: 'npsh-margin-basis',
      value: marginBasis,
      options: PUMP_NPSH_MARGIN_BASIS_OPTIONS,
      ariaLabel: 'NPSH Margin Basis'
    });
    const ratioField = createNumericField({
      label: 'Min NPSH Ratio',
      field: 'minNpshMarginRatio',
      key: 'minNpshMarginRatio',
      name: 'min-npsh-margin-ratio',
      value: formatMarginRatioInputValue(id),
      unitText: '-',
      min: '1',
      step: '0.001',
      readOnly: marginBasis !== PUMP_NPSH_MARGIN_USER_DEFINED,
      ariaLabel: 'Min NPSH Ratio'
    });
    const marginField = createNumericField({
      label: 'Min NPSH Margin',
      field: 'minNpshMargin',
      key: 'minNpshMargin',
      name: 'min-npsh-margin',
      value: formatMarginAbsoluteInputValue(id),
      min: '0',
      step: '0.001',
      readOnly: marginBasis !== PUMP_NPSH_MARGIN_USER_DEFINED,
      ariaLabel: 'Min NPSH Margin'
    });
    const criteriaNote = document.createElement('p');
    criteriaNote.className = 'pump-manual-npshr-criteria-note';
    criteriaNote.dataset.npshMarginCriteriaNote = 'true';
    body.append(
      manualField.fieldNode,
      datumField.fieldNode,
      marginBasisField.fieldNode,
      ratioField.fieldNode,
      marginField.fieldNode,
      criteriaNote
    );

    const onResize = () => clampChartTaskWindowToViewport(taskWindow);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      taskWindow.remove();
    });
    const updateMarginFieldsFromBasis = () => {
      const basis = marginBasisField.selectNode.value || PUMP_NPSH_MARGIN_GENERAL_PURPOSE;
      const userDefined = basis === PUMP_NPSH_MARGIN_USER_DEFINED;
      ratioField.inputNode.readOnly = !userDefined;
      marginField.inputNode.readOnly = !userDefined;
      if (!userDefined) {
        const pseudoPump = { ...(runtimeModel()?.[id] || {}), props: { ...((runtimeModel()?.[id] || {}).props || {}), npshMarginBasis: basis } };
        ratioField.inputNode.value = formatNumericInputValue(firstNumber(marginPresetForPump(pseudoPump, basis)?.ratio), 6);
        marginField.inputNode.value = formatNumericInputValue(firstNumber(marginPresetForPump(pseudoPump, basis)?.margin), 6);
      }
      updateMarginCriteriaPresentation(taskWindow, id);
    };
    [manualField.inputNode, datumField.inputNode, ratioField.inputNode, marginField.inputNode].forEach((inputNode) => {
      inputNode.addEventListener('input', () => scheduleManualNpshrLinkedRefresh(id, 'input'));
      inputNode.addEventListener('change', () => scheduleManualNpshrLinkedRefresh(id, 'change'));
    });
    marginBasisField.selectNode.addEventListener('input', () => {
      updateMarginFieldsFromBasis();
      scheduleManualNpshrLinkedRefresh(id, 'input');
    });
    marginBasisField.selectNode.addEventListener('change', () => {
      updateMarginFieldsFromBasis();
      scheduleManualNpshrLinkedRefresh(id, 'change');
    });

    taskWindow.append(header, body);
    document.body.appendChild(taskWindow);
    updateMarginCriteriaPresentation(taskWindow, id);
    initializeChartTaskWindowDrag(taskWindow, header);
    bringChartTaskWindowToFront(taskWindow);
    clampChartTaskWindowToViewport(taskWindow);
    taskWindow.focus?.({ preventScroll: true });
    manualField.inputNode.focus?.({ preventScroll: true });
    manualField.inputNode.select?.();
    return taskWindow;
  }

  function hideCanvasContextMenu() {
    const menu = document.getElementById('canvasContextMenu');
    if (!menu) return;
    releaseCanvasContextMenuFocus(menu);
    menu.style.display = 'none';
    menu.setAttribute('aria-hidden', 'true');
    document.body?.classList?.remove('context-menu-open');
  }

  function releaseCanvasContextMenuFocus(menu) {
    if (typeof document === 'undefined' || !menu) return false;
    const active = document.activeElement;
    if (!active || active === document.body || !menu.contains(active)) return false;
    active.blur?.();
    return true;
  }

  function capturePumpContextMenuTarget(event) {
    const holder = event.target?.closest?.('.pfd-object[data-id], [data-id]');
    const id = holder?.dataset?.id || holder?.dataset?.nodeId || '';
    lastPumpContextMenuId = runtimeModel()?.[id]?.type === 'pump' ? id : '';
  }

  function createManualNpshrMenuButton(pumpId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.tabIndex = -1;
    button.textContent = 'Pump Datum - NPSHR';
    button.dataset.pumpManualNpshrTaskMenu = 'true';
    button.dataset.pumpNodeId = pumpId;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideCanvasContextMenu();
      root.openPumpManualNpshrTaskWindow?.(pumpId);
    });
    return button;
  }

  function createFormulaDefenseMenuButton(pumpId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.tabIndex = -1;
    button.textContent = 'Pump Formula Defense';
    button.dataset.pumpFormulaDefenseTaskMenu = 'true';
    button.dataset.pumpNodeId = pumpId;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideCanvasContextMenu();
      root.openPumpFormulaDefenseTaskWindow?.(pumpId);
    });
    return button;
  }

  function insertMenuButtonAfter(menu, button, anchor) {
    if (!menu || !button) return false;
    if (anchor?.nextSibling) menu.insertBefore(button, anchor.nextSibling);
    else menu.appendChild(button);
    return true;
  }

  function insertMenuButtonBefore(menu, button, anchor) {
    if (!menu || !button) return false;
    if (anchor) menu.insertBefore(button, anchor);
    else menu.appendChild(button);
    return true;
  }

  function installPumpDevelopmentUiSuppressionStyles() {
    if (typeof document === 'undefined' || document.getElementById(PUMP_DEVELOPMENT_UI_SUPPRESSION_STYLE_ID)) return false;
    const style = document.createElement('style');
    style.id = PUMP_DEVELOPMENT_UI_SUPPRESSION_STYLE_ID;
    style.textContent = `
#canvasContextMenu [data-pump-performance-chart-task-menu="true"],
#canvasContextMenu [data-pump-object-properties-suppressed="true"],
.pump-performance-chart-task-window {
  display: none !important;
}
`;
    document.head?.appendChild(style);
    return true;
  }

  function pumpIdFromOpenArgs(args = []) {
    const model = runtimeModel();
    const first = args[0];
    const direct = typeof first === 'string'
      ? first
      : (first?.dataset?.nodeId || first?.dataset?.node || first?.dataset?.pumpNodeId || first?.nodeId || first?.id || '');
    if (direct && model?.[direct]?.type === 'pump') return direct;
    if (direct) return '';
    try {
      if (typeof currentSelectedNode !== 'undefined' && model?.[currentSelectedNode]?.type === 'pump') return currentSelectedNode;
    } catch (error) {
      // Protected builds can hide direct globals.
    }
    return '';
  }

  function closePumpObjectPropertiesTaskWindows(pumpId = '') {
    if (typeof document === 'undefined') return false;
    const model = runtimeModel();
    let changed = false;
    const windows = Array.from(document.querySelectorAll('#taskWindow, .persistent-object-properties-task-window, .object-properties-task'));
    windows.forEach((windowNode) => {
      const id = windowNode.dataset?.nodeId || windowNode.dataset?.taskNodeId || windowNode.dataset?.pumpNodeId || '';
      if (!id || model?.[id]?.type !== 'pump') return;
      if (pumpId && id !== pumpId) return;
      const title = windowNode.querySelector?.('.task-window-header, #taskWindowTitle')?.textContent || windowNode.textContent || '';
      if (!/Pump Object Properties/i.test(title)) return;
      if (windowNode.id === 'taskWindow') {
        windowNode.hidden = true;
        windowNode.setAttribute('aria-hidden', 'true');
      } else {
        windowNode.remove();
      }
      changed = true;
    });
    return changed;
  }

  function closePumpPerformanceChartTaskWindows(pumpId = '') {
    if (typeof document === 'undefined') return false;
    const selector = pumpId
      ? `.pump-performance-chart-task-window[data-pump-node-id="${cssEscape(pumpId)}"]`
      : '.pump-performance-chart-task-window';
    const windows = Array.from(document.querySelectorAll(selector));
    windows.forEach((windowNode) => {
      disconnectChartTaskWindowResizeObserver(windowNode);
      windowNode.remove();
    });
    const modal = document.getElementById('fullEditor');
    const modalCanvas = modal?.querySelector?.('.modal-chart-wrap canvas');
    const modalPumpId = modalCanvas?.dataset?.pumpId || '';
    const shouldCloseModal = !!(modal && modalCanvas && (!pumpId || !modalPumpId || modalPumpId === pumpId));
    if (shouldCloseModal) {
      modal.style.display = 'none';
      modal.innerHTML = '';
    }
    return windows.length > 0 || shouldCloseModal;
  }

  function suppressPumpObjectPropertiesMenuButton(menu) {
    if (!menu) return false;
    const buttons = Array.from(menu.querySelectorAll('button[role="menuitem"]'));
    let changed = false;
    buttons.forEach((button) => {
      if (!/User Task Object Properties/i.test(button.textContent || '')) return;
      if (document.activeElement === button || button.contains?.(document.activeElement)) releaseCanvasContextMenuFocus(menu);
      button.dataset.pumpObjectPropertiesSuppressed = 'true';
      button.hidden = true;
      button.disabled = true;
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
      button.remove();
      changed = true;
    });
    return changed;
  }

  function suppressPumpPerformanceChartMenuButtons(menu) {
    if (!menu) return false;
    const buttons = Array.from(menu.querySelectorAll('button[role="menuitem"]'));
    let changed = false;
    buttons.forEach((button) => {
      if (button.dataset?.pumpPerformanceChartTaskMenu !== 'true' && !/^Pump Performance Chart$/i.test((button.textContent || '').trim())) return;
      if (document.activeElement === button || button.contains?.(document.activeElement)) releaseCanvasContextMenuFocus(menu);
      button.hidden = true;
      button.disabled = true;
      button.tabIndex = -1;
      button.setAttribute('aria-hidden', 'true');
      button.remove();
      changed = true;
    });
    return changed;
  }

  function installPumpManualNpshrRelocationStyles() {
    if (typeof document === 'undefined' || document.getElementById(PUMP_MANUAL_NPSHR_RELOCATION_STYLE_ID)) return false;
    const style = document.createElement('style');
    style.id = PUMP_MANUAL_NPSHR_RELOCATION_STYLE_ID;
    style.textContent = `
#taskWindow [data-pump-manual-npshr-relocated-row="true"],
.object-properties-task [data-pump-manual-npshr-relocated-row="true"],
.persistent-object-properties-task-window [data-pump-manual-npshr-relocated-row="true"],
#taskWindow input[data-key="manualNpshr"],
.object-properties-task input[data-key="manualNpshr"],
.persistent-object-properties-task-window input[data-key="manualNpshr"],
#taskWindow input[data-key="designNpshr"],
.object-properties-task input[data-key="designNpshr"],
.persistent-object-properties-task-window input[data-key="designNpshr"],
#taskWindow input[name="design-npshr"],
.object-properties-task input[name="design-npshr"],
.persistent-object-properties-task-window input[name="design-npshr"] {
  display: none !important;
}
`;
    document.head?.appendChild(style);
    return true;
  }

  function hideManualNpshrPropertiesInputs(scope = null) {
    if (typeof document === 'undefined') return false;
    const selector = [
      '#taskWindow input[data-key="manualNpshr"]',
      '.object-properties-task input[data-key="manualNpshr"]',
      '.persistent-object-properties-task-window input[data-key="manualNpshr"]',
      '#taskWindow input[data-key="designNpshr"]',
      '.object-properties-task input[data-key="designNpshr"]',
      '.persistent-object-properties-task-window input[data-key="designNpshr"]',
      '#taskWindow input[name="design-npshr"]',
      '.object-properties-task input[name="design-npshr"]',
      '.persistent-object-properties-task-window input[name="design-npshr"]'
    ].join(', ');
    const searchRoot = scope || document;
    const candidates = [];
    if (searchRoot?.nodeType === 1 && searchRoot.matches?.(selector)) candidates.push(searchRoot);
    candidates.push(...Array.from(searchRoot?.querySelectorAll?.(selector) || []));
    let changed = false;
    candidates.forEach((input) => {
      if (input.closest?.('.pump-manual-npshr-task-window')) return;
      const row = input.closest?.('tr, .prop-row, .form-row, .field-row, .pump-live-param-row, label')
        || input.closest?.('div');
      const target = row || input;
      if (target.dataset?.pumpManualNpshrRelocatedRow !== 'true') {
        if (target.dataset) target.dataset.pumpManualNpshrRelocatedRow = 'true';
        changed = true;
      }
      if (!target.hidden || target.getAttribute('aria-hidden') !== 'true') {
        target.hidden = true;
        target.setAttribute('aria-hidden', 'true');
        changed = true;
      }
      if (!input.hidden || input.getAttribute('aria-hidden') !== 'true' || input.tabIndex !== -1) {
        input.hidden = true;
        input.tabIndex = -1;
        input.setAttribute('aria-hidden', 'true');
        input.dataset.pumpManualNpshrRelocatedFromProperties = 'true';
        changed = true;
      }
    });
    return changed;
  }

  function installPumpFormulaDefenseRelocationStyles() {
    if (typeof document === 'undefined' || document.getElementById(PUMP_FORMULA_DEFENSE_RELOCATION_STYLE_ID)) return false;
    const style = document.createElement('style');
    style.id = PUMP_FORMULA_DEFENSE_RELOCATION_STYLE_ID;
    style.textContent = `
#taskWindow [data-pump-formula-defense],
.object-properties-task [data-pump-formula-defense],
.persistent-object-properties-task-window [data-pump-formula-defense] {
  display: none !important;
}
`;
    document.head?.appendChild(style);
    return true;
  }

  function hidePumpFormulaDefensePropertiesButtons(scope = null) {
    if (typeof document === 'undefined') return false;
    const selector = '#taskWindow [data-pump-formula-defense], .object-properties-task [data-pump-formula-defense], .persistent-object-properties-task-window [data-pump-formula-defense]';
    const searchRoot = scope || document;
    const candidates = [];
    if (searchRoot?.nodeType === 1 && searchRoot.matches?.(selector)) candidates.push(searchRoot);
    candidates.push(...Array.from(searchRoot?.querySelectorAll?.(selector) || []));
    let changed = false;
    candidates.forEach((button) => {
      if (button.dataset?.pumpFormulaDefenseTaskMenu === 'true') return;
      if (!button.hidden || button.getAttribute('aria-hidden') !== 'true' || button.tabIndex !== -1) {
        button.hidden = true;
        button.tabIndex = -1;
        button.setAttribute('aria-hidden', 'true');
        button.dataset.pumpFormulaDefenseRelocatedFromProperties = 'true';
        changed = true;
      }
    });
    return changed;
  }

  function syncPumpContextMenuAnalysisButtons() {
    if (typeof document === 'undefined') return false;
    if (!lastPumpContextMenuId) return false;
    const pumpId = resolvePumpId(lastPumpContextMenuId);
    if (!pumpId || runtimeModel()?.[pumpId]?.type !== 'pump') return false;
    const menu = document.getElementById('canvasContextMenu');
    if (!menu || menu.getAttribute('aria-hidden') === 'true' || menu.style.display === 'none') return false;
    let changed = false;
    changed = suppressPumpObjectPropertiesMenuButton(menu) || changed;
    changed = suppressPumpPerformanceChartMenuButtons(menu) || changed;

    let manualNpshrButton = menu.querySelector('[data-pump-manual-npshr-task-menu="true"]');
    if (manualNpshrButton) {
      manualNpshrButton.dataset.pumpNodeId = pumpId;
    } else {
      manualNpshrButton = createManualNpshrMenuButton(pumpId);
      const firstStandardButton = Array.from(menu.querySelectorAll('button[role="menuitem"]'))
        .find((item) => item !== manualNpshrButton && !item.dataset?.pumpFormulaDefenseTaskMenu);
      insertMenuButtonBefore(menu, manualNpshrButton, firstStandardButton || null);
      changed = true;
    }

    let defenseButton = menu.querySelector('[data-pump-formula-defense-task-menu="true"]');
    if (defenseButton) {
      defenseButton.dataset.pumpNodeId = pumpId;
    } else {
      defenseButton = createFormulaDefenseMenuButton(pumpId);
      insertMenuButtonAfter(menu, defenseButton, manualNpshrButton);
      changed = true;
    }

    const orderedButtons = Array.from(menu.querySelectorAll('button[role="menuitem"]'));
    const firstStandardButton = orderedButtons.find((item) => (
      item !== manualNpshrButton
      && item !== defenseButton
      && item.dataset?.pumpFormulaDefenseTaskMenu !== 'true'
      && item.dataset?.pumpManualNpshrTaskMenu !== 'true'
    ));
    if (firstStandardButton && orderedButtons.indexOf(manualNpshrButton) > orderedButtons.indexOf(firstStandardButton)) {
      insertMenuButtonBefore(menu, manualNpshrButton, firstStandardButton);
      changed = true;
    }
    const reorderedButtons = Array.from(menu.querySelectorAll('button[role="menuitem"]'));
    if (reorderedButtons.indexOf(defenseButton) !== reorderedButtons.indexOf(manualNpshrButton) + 1) {
      insertMenuButtonAfter(menu, defenseButton, manualNpshrButton);
      changed = true;
    }
    return changed;
  }

  function syncPumpPerformanceChartEntryPoints() {
    const changed = [
      installChartTaskWindowStyles(),
      installPumpDevelopmentUiSuppressionStyles(),
      installPumpManualNpshrRelocationStyles(),
      installPumpFormulaDefenseRelocationStyles(),
      hideManualNpshrPropertiesInputs(),
      hidePumpFormulaDefensePropertiesButtons(),
      closePumpObjectPropertiesTaskWindows(),
      closePumpPerformanceChartTaskWindows(),
      syncPumpContextMenuAnalysisButtons()
    ].some(Boolean);
    return changed;
  }

  function bindChartTaskEntryPoints() {
    if (typeof document === 'undefined' || root.__pumpPerformanceChartTaskEntryPointsBound) return false;
    document.addEventListener('contextmenu', capturePumpContextMenuTarget, true);
    document.addEventListener('click', () => {
      lastPumpContextMenuId = '';
    }, true);
    let pending = 0;
    const scheduleSync = () => {
      if (pending) root.clearTimeout?.(pending);
      pending = root.setTimeout?.(() => {
        pending = 0;
        syncPumpPerformanceChartEntryPoints();
      }, 20) || 0;
    };
    const observer = new MutationObserver((records) => {
      const shouldSync = records.some((record) => Array.from(record.addedNodes || []).some((node) => (
        node.nodeType === 1
        && (node.matches?.('#canvasContextMenu')
          || node.matches?.('#taskWindow, .object-properties-task, .persistent-object-properties-task-window, .pump-performance-chart-task-window, [data-pump-formula-defense], input[data-key="designNpshr"], input[data-key="manualNpshr"], input[name="design-npshr"]')
          || node.querySelector?.('#canvasContextMenu, #taskWindow, .object-properties-task, .persistent-object-properties-task-window, .pump-performance-chart-task-window, [data-pump-formula-defense], input[data-key="designNpshr"], input[data-key="manualNpshr"], input[name="design-npshr"]'))
      )));
      if (shouldSync) scheduleSync();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    root.__pumpPerformanceChartTaskEntryObserver = observer;
    root.__pumpPerformanceChartTaskEntryPointsBound = true;
    scheduleSync();
    return true;
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

  function wrapPumpObjectPropertiesOpener(name) {
    const current = root[name];
    if (typeof current !== 'function' || current.__pumpObjectPropertiesSuppressedVersion === VERSION) return false;
    const wrapped = function pumpObjectPropertiesSuppressedWrapper(...args) {
      const pumpId = pumpIdFromOpenArgs(args);
      if (pumpId) {
        closePumpObjectPropertiesTaskWindows(pumpId);
        return null;
      }
      return current.apply(this, args);
    };
    markCanonicalFunction(wrapped, `${name}PumpSuppressed`);
    wrapped.__pumpObjectPropertiesSuppressedVersion = VERSION;
    wrapped.__pumpPerformanceCanonicalChartOriginal = current;
    copyRuntimePatchFlags(wrapped, current);
    root[name] = wrapped;
    return true;
  }

  function wrapPumpObjectPropertiesOpeners() {
    return [
      wrapPumpObjectPropertiesOpener('requestObjectPropertiesTaskWindowOpen'),
      wrapPumpObjectPropertiesOpener('openObjectPropertiesTaskWindow')
    ].some(Boolean);
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
      root.openPumpPerformanceCurveWindow = markCanonicalFunction(function openPumpCanonicalPerformanceCurveWindowDisabled(pumpId) {
        const id = resolvePumpId(pumpId);
        closePumpPerformanceChartTaskWindows(id);
        return null;
      }, 'openPumpPerformanceCurveWindowDisabled');
      changed = true;
    }

    if (typeof root.openPumpPerformanceChartTaskWindow !== 'function' || root.openPumpPerformanceChartTaskWindow.__pumpPerformanceCanonicalChartVersion !== VERSION) {
      root.openPumpPerformanceChartTaskWindow = markCanonicalFunction(function openPumpCanonicalPerformanceChartTaskWindowDisabled(pumpId) {
        const id = resolvePumpId(pumpId);
        closePumpPerformanceChartTaskWindows(id);
        return null;
      }, 'openPumpPerformanceChartTaskWindowDisabled');
      changed = true;
    }

    if (typeof root.openPumpManualNpshrTaskWindow !== 'function' || root.openPumpManualNpshrTaskWindow.__pumpPerformanceCanonicalChartVersion !== VERSION) {
      root.openPumpManualNpshrTaskWindow = markCanonicalFunction(function openPumpCanonicalManualNpshrTaskWindow(pumpId) {
        const id = resolvePumpId(pumpId);
        return ensureManualNpshrTaskWindow(id);
      }, 'openPumpManualNpshrTaskWindow');
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
      wrapPumpObjectPropertiesOpeners(),
      bindRealtimeEvents(),
      bindLiveInputRefresh(),
      bindChartTaskEntryPoints()
    ].some(Boolean);
    syncPumpPerformanceChartEntryPoints();
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
            || node.querySelector?.('#pumpChart, #captionAuditPumpChartCanvas, .caption-audit-inline-chart-wrap canvas, .modal-chart-wrap canvas, .pump-performance-chart-task-window canvas'))
        )));
        if (hasChart) scheduleRender('', { force: true, reason: 'chart canvas added' });
        syncPumpPerformanceChartEntryPoints();
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
    ensureRuntimeGuards,
    openTaskWindow: (pumpId) => {
      closePumpPerformanceChartTaskWindows(resolvePumpId(pumpId));
      return null;
    },
    openManualNpshrWindow: ensureManualNpshrTaskWindow,
    syncEntryPoints: syncPumpPerformanceChartEntryPoints
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
