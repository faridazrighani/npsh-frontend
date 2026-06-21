(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'pump-performance-chart-audit.v19';
  const MIN_CURVE_POINTS = 3;
  const PANEL_SELECTOR = '[data-pump-performance-chart-audit-panel]';
  const CHART_CANVAS_SELECTORS = [
    '#pumpChart',
    '#captionAuditPumpChartCanvas',
    '.caption-audit-inline-chart-wrap canvas'
  ];
  const RUNTIME_PATCH_FLAG_KEYS = [
    '__engineeringRealtimeCalculationDefenseUpdatePatched',
    '__engineeringRealtimeCalculationDefenseOriginal',
    '__analysisReportLivePatched',
    '__analysisReportLiveOriginal',
    '__pumpFormulaDefenseLiveAuditPatched',
    '__pumpFormulaDefenseLiveAuditVersion',
    '__pumpFormulaDefenseLiveAuditOriginal',
    '__pumpPerformanceCanonicalChartVersion',
    '__pumpPerformanceCanonicalChartOriginal',
    '__pumpPerformanceCanonicalChartRole'
  ];
  const scheduledRefreshTimers = new Map();

  const SERIES_STYLES = {
    pumpHead: { label: 'Pump Head', color: '#0070c0', width: 2.4 },
    system: { label: 'System Curve', color: '#dc2626', dash: [5, 5] },
    npsha: { label: 'NPSHa', color: '#0f766e' },
    npshr: { label: 'NPSHr', color: '#b45309' },
    operating: { label: 'Operating Point', color: '#12a56b' }
  };

  const DISALLOWED_SOURCE_PATTERN = /generated|fallback|placeholder|duty\s*point|screening\s*default|audit\s*fit|engineering\s*fit|estimated|manual|user|screening|typical|low|review/i;
  const DEFENSE_READY_SOURCE_PATTERN = /manufacturer|vendor|factory|test|datasheet|journal|digitized|literature|citation|published/i;
  const REVIEW_ONLY_PATTERN = /engineering\s*fit|estimated|manual|user|screening|typical|low|review/i;

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
      // Protected builds do not always expose globals directly.
    }
    try {
      const state = typeof root.getSimulationState === 'function'
        ? JSON.parse(root.getSimulationState())
        : null;
      if (state?.model) return state.model;
    } catch (error) {
      // Fall through to legacy aliases.
    }
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function connectionList() {
    try {
      if (typeof connections !== 'undefined' && Array.isArray(connections)) return connections;
    } catch (error) {
      // Fall through.
    }
    try {
      const state = typeof root.getSimulationState === 'function'
        ? JSON.parse(root.getSimulationState())
        : null;
      if (Array.isArray(state?.connections)) return state.connections;
    } catch (error) {
      // Fall through.
    }
    return root.connections || root.__npshConnections || [];
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
      // Ignore inaccessible active chart globals.
    }
    try {
      if (typeof currentSelectedNode !== 'undefined' && model[currentSelectedNode]?.type === 'pump') return currentSelectedNode;
    } catch (error) {
      // Ignore inaccessible selection globals.
    }
    return firstPumpId(model);
  }

  function toNumber(value) {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function meaningfulText(value) {
    const text = String(value ?? '').trim();
    return text && text !== '-' && !/^n\/?a$/i.test(text) && !/^unknown$/i.test(text) ? text : '';
  }

  function firstText(...values) {
    return values.map(meaningfulText).find(Boolean) || '-';
  }

  function pointNumber(point, keys) {
    if (!point || typeof point !== 'object') return null;
    for (const key of keys) {
      const numeric = toNumber(point[key]);
      if (numeric !== null) return numeric;
    }
    return null;
  }

  function normalizePoints(points, valueKeys) {
    if (!Array.isArray(points)) return [];
    return points
      .map((point) => {
        const flow = Array.isArray(point)
          ? toNumber(point[0])
          : pointNumber(point, ['flow', 'q', 'x', 'flowM3H']);
        const value = Array.isArray(point)
          ? toNumber(point[1])
          : pointNumber(point, [...valueKeys, 'y']);
        return flow !== null && value !== null ? { flow, value, raw: point } : null;
      })
      .filter(Boolean)
      .sort((left, right) => left.flow - right.flow);
  }

  function uniquePoints(points) {
    const seen = new Set();
    return points.filter((point) => {
      const key = `${point.flow.toFixed(9)}:${point.value.toFixed(9)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function positivePoints(points) {
    return uniquePoints(points).filter((point) => point.flow > 0 && point.value > 0);
  }

  function nonPositiveCount(points) {
    return uniquePoints(points).filter((point) => !(point.flow > 0 && point.value > 0)).length;
  }

  function documentedBasis(source, confidence) {
    const sourceText = meaningfulText(source);
    const confidenceText = meaningfulText(confidence);
    const combined = `${sourceText} ${confidenceText}`.trim();
    return !!sourceText
      && !!confidenceText
      && DEFENSE_READY_SOURCE_PATTERN.test(combined)
      && !DISALLOWED_SOURCE_PATTERN.test(combined)
      && !REVIEW_ONLY_PATTERN.test(combined);
  }

  function defenseReadyBasis(source, confidence) {
    const combined = `${meaningfulText(source)} ${meaningfulText(confidence)}`.trim();
    return DEFENSE_READY_SOURCE_PATTERN.test(combined) && !REVIEW_ONLY_PATTERN.test(combined);
  }

  function routeBoundary(model, pumpId) {
    const links = connectionList().filter((item) => !item.connectionType || item.connectionType === 'hydraulic');
    const suction = links.find((item) => item.to === pumpId || item.rawTo === pumpId);
    const discharge = links.find((item) => item.from === pumpId || item.rawFrom === pumpId);
    const sourceId = suction?.from || suction?.rawFrom || '';
    const sinkId = discharge?.to || discharge?.rawTo || '';
    const hasSource = !!sourceId && /source|tank|verticalVessel|horizontalVessel|separator/i.test(String(model[sourceId]?.type || ''));
    const hasSink = !!sinkId && /sink|tank|verticalVessel|horizontalVessel|separator/i.test(String(model[sinkId]?.type || ''));
    const trace = model[pumpId]?.results?.routeTrace || model[pumpId]?.results?.npshEvaluation?.routeTrace || null;
    const text = trace?.text || trace?.compactText || [sourceId, pumpId, sinkId].filter(Boolean).join(' -> ');
    const lossFreshness = firstText(trace?.lossFreshness, model[pumpId]?.results?.calculationFreshness);
    return {
      hasSource,
      hasSink,
      complete: !!(hasSource && hasSink),
      text: text || '-',
      lossFreshness
    };
  }

  function chartCanvases() {
    if (typeof document === 'undefined') return [];
    const canvases = CHART_CANVAS_SELECTORS
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .filter((canvas) => canvas?.tagName === 'CANVAS');
    return [...new Set(canvases)];
  }

  function chartShell(canvas) {
    if (!canvas) return null;
    return canvas.closest('.pump-chart-card, .modal-chart-wrap, .caption-audit-inline-pump-chart, .pump-performance-chart, .chart-container, .task-window-body, .modal-body')
      || canvas.parentElement
      || canvas;
  }

  function buildSeriesAudit(name, rawPoints, options = {}) {
    const points = uniquePoints(rawPoints);
    const positive = positivePoints(points);
    const minPoints = options.minPoints || MIN_CURVE_POINTS;
    const documented = options.systemDerived || documentedBasis(options.source, options.confidence);
    const enoughPoints = positive.length >= minPoints;
    const allowed = enoughPoints && documented && !options.blocked;
    const defenseReady = allowed && (options.systemDerived || defenseReadyBasis(options.source, options.confidence));
    const reason = allowed
      ? (defenseReady ? 'defense-ready data' : 'review-required data')
      : (!enoughPoints
        ? `needs at least ${minPoints} positive sourced points`
        : (!documented ? 'missing documented curve source/confidence' : (options.blockReason || 'blocked by route/data gate')));

    return {
      name,
      label: SERIES_STYLES[name]?.label || name,
      source: options.source || '-',
      confidence: options.confidence || '-',
      points: allowed ? positive : [],
      rawPointCount: points.length,
      positivePointCount: positive.length,
      filteredNonPositiveCount: nonPositiveCount(points),
      allowed,
      defenseReady,
      reason
    };
  }

  function computeAudit(pumpId) {
    const model = runtimeModel();
    const id = resolvePumpId(pumpId);
    const pump = model[id] || {};
    const results = pump.results || {};
    const evaluation = results.npshEvaluation || {};
    const props = pump.props || {};
    const chartData = results.performanceChartData?.schemaVersion === 'pump-performance-chart-data.v1'
      ? results.performanceChartData
      : null;
    const chartAudit = chartData?.sourceAudit || {};
    const route = routeBoundary(model, id);
    const backendLinked = /backend|primary|connected/i.test(String(results.backendCalculationSource || results.backendValidationStatus || ''));
    const stale = !!(
      results.isCalculationStale
      || results.actionReadinessBackend?.stale
      || results.actionReadinessFrontend?.stale
      || /stale/i.test(String(chartData?.freshness || ''))
    );
    const curveSource = firstText(
      chartAudit.curveDataSource,
      chartAudit.pumpCurveSource,
      results.curveDataSource,
      results.curveSource,
      evaluation.curveBasis,
      evaluation.npshrSource,
      props.curveDataSource,
      props.curveBasis,
      props.npshrSourceMode
    );
    const curveConfidence = firstText(
      chartAudit.curveDataConfidence,
      chartAudit.npshrDataConfidence,
      results.curveDataConfidence,
      results.dataConfidence,
      evaluation.dataConfidence,
      props.curveDataConfidence,
      props.curveFitCompleteness
    );

    const pumpCurvePoints = chartData
      ? normalizePoints(chartData.series?.pumpHead, ['value', 'head', 'pumpHead'])
      : [
        ...normalizePoints(props.curveData, ['head', 'pumpHead', 'value']),
        ...normalizePoints(results.pumpCurve, ['head', 'pumpHead', 'value'])
      ];
    const npshrCurvePoints = chartData
      ? normalizePoints(chartData.series?.npshr, ['value', 'npshr', 'requiredNpsh'])
      : [
        ...normalizePoints(props.curveData, ['npshr', 'requiredNpsh']),
        ...normalizePoints(results.npshrCurvePoints, ['npshr', 'requiredNpsh', 'value']),
        ...normalizePoints(results.npshCurvePoints, ['npshr', 'requiredNpsh'])
      ];
    const systemCurvePoints = chartData
      ? normalizePoints(chartData.series?.systemHead, ['value', 'head', 'systemHead', 'requiredHead'])
      : normalizePoints(
        results.systemCurvePoints || results.sysCurve,
        ['head', 'systemHead', 'requiredHead', 'value']
      );
    const npshaCurvePoints = chartData
      ? normalizePoints(chartData.series?.npsha, ['value', 'npsha', 'availableNpsh'])
      : normalizePoints(
        results.npshCurvePoints,
        ['npsha', 'availableNpsh', 'value']
      );

    const series = {
      pumpHead: buildSeriesAudit('pumpHead', pumpCurvePoints, {
        source: curveSource,
        confidence: curveConfidence
      }),
      system: buildSeriesAudit('system', systemCurvePoints, {
        source: route.complete ? 'Current route hydraulic solution' : '-',
        confidence: backendLinked ? 'Backend linked' : 'Frontend route trace',
        systemDerived: route.complete && systemCurvePoints.length >= MIN_CURVE_POINTS,
        blocked: !route.complete,
        blockReason: 'route boundary is incomplete'
      }),
      npsha: buildSeriesAudit('npsha', npshaCurvePoints, {
        source: route.complete ? 'Current suction energy balance' : '-',
        confidence: backendLinked ? 'Backend linked' : 'Frontend route trace',
        systemDerived: route.complete && npshaCurvePoints.length >= MIN_CURVE_POINTS,
        blocked: !route.complete,
        blockReason: 'suction route boundary is incomplete'
      }),
      npshr: buildSeriesAudit('npshr', npshrCurvePoints, {
        source: curveSource,
        confidence: curveConfidence
      })
    };

    const visibleSeries = Object.values(series).filter((item) => item.allowed && item.points.length >= 2);
    const blockedSeries = Object.values(series).filter((item) => !item.allowed && item.rawPointCount > 0);
    const hiddenFallback = Object.values(series).filter((item) => !item.allowed).length > 0;
    const flow = toNumber(results.flow ?? evaluation.flow ?? props.designFlow);
    const head = toNumber(results.head ?? evaluation.pumpHead ?? props.designHead);
    const npsha = toNumber(results.npsha ?? evaluation.npsha);
    const npshr = toNumber(results.npshr ?? evaluation.npshr ?? props.designNpshr);
    const margin = toNumber(results.npshMargin ?? evaluation.npshMargin);
    const dutyPoints = [
      flow > 0 && head > 0 ? { label: 'Duty Head', flow, value: head, color: '#12a56b' } : null,
      flow > 0 && npsha > 0 ? { label: 'Duty NPSHa', flow, value: npsha, color: '#0f766e' } : null,
      flow > 0 && npshr > 0 ? { label: 'Duty NPSHr', flow, value: npshr, color: '#b45309' } : null
    ].filter(Boolean);
    const hasDrawableCurve = visibleSeries.length > 0;
    const everyDisplayedDefenseReady = visibleSeries.length > 0 && visibleSeries.every((item) => item.defenseReady);
    const reviewRequired = !hasDrawableCurve || !everyDisplayedDefenseReady || stale || !route.complete;
    const filteredNonPositiveCount = Object.values(series)
      .reduce((total, item) => total + item.filteredNonPositiveCount, 0);
    const status = hasDrawableCurve
      ? (reviewRequired ? 'Curves Shown / Review Required' : 'Curves Shown / Defense Ready')
      : 'Curve Data Unavailable';
    const source = hasDrawableCurve
      ? (everyDisplayedDefenseReady ? 'Sourced Curve Data' : 'Sourced Data / Review')
      : 'Duty Point Only';
    const freshness = stale ? 'Stale' : firstText(results.calculationFreshness, route.lossFreshness, 'Current');
    const review = hasDrawableCurve
      ? (reviewRequired
        ? 'Continuous curves are shown only for available positive data with accepted source/confidence; route evidence still needs review.'
        : 'Displayed curves have documented source/confidence and complete route evidence.')
      : 'Continuous curves are hidden because accepted manufacturer/vendor/journal/digitized curve evidence is unavailable.';

    return {
      version: VERSION,
      pumpId: id,
      chartHasDrawableCurve: hasDrawableCurve,
      chartHasAnyRawCurveData: Object.values(series).some((item) => item.rawPointCount > 0),
      hiddenFallback,
      blockedSeries: blockedSeries.map((item) => ({
        name: item.name,
        rawPointCount: item.rawPointCount,
        positivePointCount: item.positivePointCount,
        reason: item.reason
      })),
      filteredNonPositiveCount,
      axisMode: 'log-log',
      routeTrace: route.text,
      routeComplete: route.complete,
      curveSource,
      curveConfidence,
      source,
      freshness,
      status,
      review,
      reviewRequired,
      backendLinked,
      stale,
      series,
      visibleSeries,
      dutyPoints,
      numbers: {
        flow,
        head,
        npsha,
        npshr,
        margin
      }
    };
  }

  function removeAuditPanel(canvas) {
    if (typeof document === 'undefined') return;
    const shell = chartShell(canvas);
    if (!shell) return;
    shell.querySelectorAll(PANEL_SELECTOR).forEach((panel) => panel.remove());
  }

  function canvasSize(canvas) {
    const shell = canvas.parentElement;
    const width = Math.max(520, Math.floor(shell?.clientWidth || canvas.clientWidth || 760));
    const height = Math.max(360, Math.floor(shell?.clientHeight || canvas.clientHeight || 440));
    const ratio = Math.max(1, Math.min(2, root.devicePixelRatio || 1));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    return { width, height, ratio };
  }

  function syncCurveVisibility(canvas) {
    if (typeof document === 'undefined' || !canvas) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;
    wrap.querySelectorAll('[data-pump-performance-chart-unavailable-overlay]').forEach((overlay) => overlay.remove());
    canvas.style.visibility = '';
  }

  function log10(value) {
    return Math.log(value) / Math.LN10;
  }

  function logDomain(values) {
    const positives = values.filter((value) => Number.isFinite(value) && value > 0);
    if (!positives.length) return { min: 0.1, max: 10 };
    const min = Math.min(...positives);
    const max = Math.max(...positives);
    const spreadMin = min === max ? min / 3 : min / 1.18;
    const spreadMax = min === max ? max * 3 : max * 1.18;
    return {
      min: Math.pow(10, Math.floor(log10(Math.max(spreadMin, 1e-9)))),
      max: Math.pow(10, Math.ceil(log10(Math.max(spreadMax, 1e-8))))
    };
  }

  function logTicks(min, max) {
    const ticks = [];
    const start = Math.floor(log10(min));
    const end = Math.ceil(log10(max));
    for (let exponent = start; exponent <= end; exponent += 1) {
      [1, 2, 5].forEach((factor) => {
        const value = factor * Math.pow(10, exponent);
        if (value >= min && value <= max) ticks.push({ value, major: factor === 1 });
      });
    }
    return ticks;
  }

  function formatTick(value) {
    if (value >= 100) return String(Math.round(value));
    if (value >= 10) return value.toFixed(value % 1 ? 1 : 0);
    if (value >= 1) return value.toFixed(value % 1 ? 2 : 0);
    return value.toPrecision(1);
  }

  function drawLine(ctx, points, mapPoint, color, dash = [], width = 2) {
    if (points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    points.forEach((point, index) => {
      const mapped = mapPoint(point);
      if (index === 0) ctx.moveTo(mapped.x, mapped.y);
      else ctx.lineTo(mapped.x, mapped.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawPointMarkers(ctx, points, mapPoint, color, radius = 2) {
    if (!points.length) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    points.forEach((point) => {
      const mapped = mapPoint(point);
      ctx.beginPath();
      ctx.arc(mapped.x, mapped.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  function renderAcademicChart(canvas, audit) {
    if (!canvas?.getContext) return audit;
    const { width, height, ratio } = canvasSize(canvas);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const chart = {
      left: 74,
      top: 80,
      width: Math.max(220, width - 112),
      height: Math.max(170, height - 190)
    };

    const seriesPoints = audit.visibleSeries.flatMap((series) => series.points);
    const markerPoints = audit.chartHasDrawableCurve ? audit.dutyPoints : [];
    const allPositive = [...seriesPoints, ...markerPoints];
    const xDomain = logDomain(allPositive.map((point) => point.flow));
    const yDomain = logDomain(allPositive.map((point) => point.value));
    const xMinLog = log10(xDomain.min);
    const xMaxLog = log10(xDomain.max);
    const yMinLog = log10(yDomain.min);
    const yMaxLog = log10(yDomain.max);
    const mapPoint = (point) => ({
      x: chart.left + (log10(point.flow) - xMinLog) / Math.max(xMaxLog - xMinLog, 1e-9) * chart.width,
      y: chart.top + chart.height - (log10(point.value) - yMinLog) / Math.max(yMaxLog - yMinLog, 1e-9) * chart.height
    });

    ctx.fillStyle = '#123b5a';
    ctx.font = '700 14px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Pump Performance Chart - ${audit.pumpId || '-'}`, 16, 24);

    if (audit.chartHasDrawableCurve) {
      ctx.fillStyle = '#475569';
      ctx.font = '11px Segoe UI, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${audit.source}; ${audit.status}; axis log-log`, width - 16, 24);
    }

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(chart.left, chart.top, chart.width, chart.height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(chart.left, chart.top, chart.width, chart.height);

    logTicks(xDomain.min, xDomain.max).forEach((tick) => {
      const x = chart.left + (log10(tick.value) - xMinLog) / Math.max(xMaxLog - xMinLog, 1e-9) * chart.width;
      ctx.strokeStyle = tick.major ? '#e2e8f0' : '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(x, chart.top);
      ctx.lineTo(x, chart.top + chart.height);
      ctx.stroke();
      if (tick.major) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formatTick(tick.value), x, chart.top + chart.height + 18);
      }
    });

    logTicks(yDomain.min, yDomain.max).forEach((tick) => {
      const y = chart.top + chart.height - (log10(tick.value) - yMinLog) / Math.max(yMaxLog - yMinLog, 1e-9) * chart.height;
      ctx.strokeStyle = tick.major ? '#e2e8f0' : '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(chart.left, y);
      ctx.lineTo(chart.left + chart.width, y);
      ctx.stroke();
      if (tick.major) {
        ctx.fillStyle = '#64748b';
        ctx.font = '10px Segoe UI, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(formatTick(tick.value), chart.left - 8, y + 3);
      }
    });

    audit.visibleSeries.forEach((series) => {
      const style = SERIES_STYLES[series.name] || {};
      drawLine(ctx, series.points, mapPoint, style.color || '#1c4568', style.dash || [], style.width || 2);
      drawPointMarkers(ctx, series.points, mapPoint, style.color || '#1c4568', series.name === 'pumpHead' ? 2.4 : 2);
    });

    if (audit.chartHasDrawableCurve) {
      audit.dutyPoints.forEach((point) => {
        if (!(point.flow > 0 && point.value > 0)) return;
        const mapped = mapPoint(point);
        ctx.fillStyle = point.color;
        ctx.beginPath();
        ctx.arc(mapped.x, mapped.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();

    const legendItems = [
      { label: SERIES_STYLES.pumpHead.label, color: SERIES_STYLES.pumpHead.color, dash: [] },
      { label: SERIES_STYLES.system.label, color: SERIES_STYLES.system.color, dash: SERIES_STYLES.system.dash },
      { label: SERIES_STYLES.operating.label, color: SERIES_STYLES.operating.color, markerOnly: true },
      { label: SERIES_STYLES.npsha.label, color: SERIES_STYLES.npsha.color, dash: [] },
      { label: SERIES_STYLES.npshr.label, color: SERIES_STYLES.npshr.color, dash: [] }
    ];
    let legendX = Math.max(260, width - 520);
    let legendY = 44;
    ctx.save();
    ctx.font = '10.5px Segoe UI, sans-serif';
    ctx.textBaseline = 'middle';
    legendItems.forEach((item) => {
      const textWidth = ctx.measureText(item.label).width;
      if (legendX + textWidth + 42 > width - 14) {
        legendX = Math.max(280, width - 460);
        legendY += 18;
      }
      if (item.markerOnly) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(legendX + 11, legendY, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        ctx.setLineDash(item.dash);
        ctx.beginPath();
        ctx.moveTo(legendX, legendY);
        ctx.lineTo(legendX + 22, legendY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#334155';
      ctx.fillText(item.label, legendX + 27, legendY);
      legendX += textWidth + 58;
    });
    ctx.restore();

    ctx.fillStyle = '#475569';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Flow Rate (m3/h)', chart.left + chart.width / 2, chart.top + chart.height + 48);
    ctx.save();
    ctx.translate(24, chart.top + chart.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Head / NPSH (m)', 0, 0);
    ctx.restore();

    if (audit.chartHasDrawableCurve) {
      const notes = [
        `Source: ${audit.source}`,
        `Confidence: ${audit.curveConfidence}`,
        `Freshness: ${audit.freshness}`,
        audit.reviewRequired ? 'Review: Required' : 'Review: OK',
        audit.filteredNonPositiveCount ? 'Log axis note: zero/non-positive curve points omitted.' : ''
      ].filter(Boolean);
      ctx.textAlign = 'left';
      ctx.font = '10px Segoe UI, sans-serif';
      notes.forEach((note, index) => {
        ctx.fillText(note, chart.left, height - 52 + index * 12);
      });
    }

    canvas.dataset.pumpPerformanceChartAuditVersion = VERSION;
    canvas.dataset.pumpPerformanceChartAuditStatus = audit.status;
    canvas.dataset.pumpPerformanceChartAxisMode = audit.axisMode;
    canvas.dataset.pumpPerformanceChartHasDrawableCurve = String(audit.chartHasDrawableCurve);
    syncCurveVisibility(canvas);
    return audit;
  }

  function canonicalChartRendererActive() {
    if (root.EngineeringPumpPerformanceCanonicalChart) return true;
    if (typeof document === 'undefined') return false;
    return !!document.getElementById('pump-performance-canonical-chart-runtime');
  }

  function refresh(pumpId) {
    const audit = computeAudit(pumpId);
    if (canonicalChartRendererActive()) {
      root.__pumpPerformanceChartAuditLast = audit;
      return audit;
    }
    chartCanvases().forEach((canvas) => {
      removeAuditPanel(canvas);
      renderAcademicChart(canvas, audit);
    });
    root.__pumpPerformanceChartAuditLast = audit;
    return audit;
  }

  function scheduleRefresh(pumpId) {
    const key = String(pumpId || '');
    const existing = scheduledRefreshTimers.get(key);
    if (existing && root.clearTimeout) root.clearTimeout(existing);
    if (!root.setTimeout) {
      refresh(pumpId);
      return;
    }
    const timer = root.setTimeout(() => {
      scheduledRefreshTimers.delete(key);
      refresh(pumpId);
    }, 140);
    scheduledRefreshTimers.set(key, timer);
  }

  function copyRuntimePatchFlags(target, source) {
    RUNTIME_PATCH_FLAG_KEYS.forEach((key) => {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    });
  }

  function wrapFunction(name, after, options = {}) {
    const original = root[name];
    if (typeof original !== 'function' || original.__pumpPerformanceChartAuditVersion === VERSION) return false;
    if (original.__pumpPerformanceCanonicalChartVersion) return false;
    function wrapped(...args) {
      const result = options.skipOriginal ? undefined : original.apply(this, args);
      const runAfter = () => after(...args);
      if (result && typeof result.then === 'function') result.finally(runAfter);
      else runAfter();
      return options.skipOriginal ? root.__pumpPerformanceChartAuditLast : result;
    }
    copyRuntimePatchFlags(wrapped, original);
    wrapped.__pumpPerformanceChartAuditPatched = true;
    wrapped.__pumpPerformanceChartAuditVersion = VERSION;
    wrapped.__pumpPerformanceChartAuditOriginal = original;
    root[name] = wrapped;
    return true;
  }

  function wrapCaptionAuditInstall() {
    const api = root.EngineeringCaptionAuditOverrides;
    if (!api || typeof api.install !== 'function' || api.install.__pumpPerformanceChartAuditVersion === VERSION) return false;
    const original = api.install;
    api.install = function wrappedCaptionAuditInstall(...args) {
      const result = original.apply(this, args);
      ensureRuntimeGuards();
      scheduleRefresh();
      return result;
    };
    api.install.__pumpPerformanceChartAuditVersion = VERSION;
    api.install.__pumpPerformanceChartAuditOriginal = original;
    return true;
  }

  function ensureRuntimeGuards() {
    const changed = [
      wrapFunction('updatePumpChart', (pumpId) => scheduleRefresh(pumpId), { skipOriginal: true }),
      wrapFunction('openPumpPerformanceCurveWindow', (pumpId) => scheduleRefresh(pumpId)),
      wrapFunction('updatePumpResultReadouts', () => scheduleRefresh()),
      wrapFunction('updateSimulation', () => scheduleRefresh()),
      wrapCaptionAuditInstall()
    ].some(Boolean);
    if (changed) scheduleRefresh();
    return changed;
  }

  function hasChartCandidate(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.matches?.('#pumpChart, #captionAuditPumpChartCanvas, .caption-audit-inline-pump-chart, .caption-audit-inline-chart-wrap, .modal-chart-wrap')) return true;
    return !!node.querySelector?.('#pumpChart, #captionAuditPumpChartCanvas, .caption-audit-inline-pump-chart, .caption-audit-inline-chart-wrap canvas, .modal-chart-wrap canvas');
  }

  function installDomObserver() {
    if (typeof document === 'undefined' || root.__pumpPerformanceChartAuditDomObserver) return false;
    try {
      let pending = null;
      root.__pumpPerformanceChartAuditDomObserver = new MutationObserver((records) => {
        const shouldRefresh = records.some((record) => Array.from(record.addedNodes || []).some(hasChartCandidate));
        if (!shouldRefresh) return;
        root.clearTimeout?.(pending);
        pending = root.setTimeout?.(() => {
          ensureRuntimeGuards();
          scheduleRefresh();
        }, 60);
      });
      root.__pumpPerformanceChartAuditDomObserver.observe(document.documentElement, { childList: true, subtree: true });
      return true;
    } catch (error) {
      return false;
    }
  }

  function startRuntimeGuardLoop() {
    ensureRuntimeGuards();
    installDomObserver();
    loadCanonicalChartRenderer();
    [0, 80, 220, 500, 900, 1400, 2200, 3600, 5200, 7600].forEach((delay) => {
      root.setTimeout?.(() => {
        if (ensureRuntimeGuards()) scheduleRefresh();
      }, delay);
    });
  }

  function loadCanonicalChartRenderer() {
    if (typeof document === 'undefined' || root.EngineeringPumpPerformanceCanonicalChart || document.getElementById('pump-performance-canonical-chart-runtime')) {
      return false;
    }
    try {
      const script = document.createElement('script');
      script.id = 'pump-performance-canonical-chart-runtime';
      script.src = 'engineering-pump-performance-canonical-chart.js?v=20260621-canonical-chart20';
      script.async = false;
      document.body.appendChild(script);
      return true;
    } catch (error) {
      console.warn('Unable to load canonical pump performance chart renderer.', error);
      return false;
    }
  }

  root.EngineeringPumpPerformanceChartAudit = {
    version: VERSION,
    minCurvePoints: MIN_CURVE_POINTS,
    refresh,
    compute: computeAudit,
    render: renderAcademicChart,
    ensureRuntimeGuards,
    loadCanonicalChartRenderer
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.EngineeringPumpPerformanceChartAudit;
  }

  startRuntimeGuardLoop();
  root.setTimeout?.(() => refresh(), 0);
})();
