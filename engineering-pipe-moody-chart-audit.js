(function registerEngineeringPipeMoodyChartAudit(root) {
  const VERSION = 'engineering-pipe-moody-chart-audit.v8';
  const CACHE_KEY = '20260707-pipe-moody-export-chart4';
  const PANEL_ID = 'engineeringPipeMoodyChartPanel';
  const BODY_ID = 'engineeringPipeMoodyChartPanelBody';
  const REMOVED_PIPE_PROPERTY_KEYS = [
    'routeStyle',
    'pressureClass',
    'endConnection',
    'elevationProfileMode',
    'startElevation',
    'endElevation',
    'headLossAllowancePercent',
    'roughnessAgingFactor'
  ];
  const REMOVED_PIPE_PROPERTY_KEY_PATTERNS = [
    new RegExp('^(?:controlling)?' + 'high.*' + 'point', 'i')
  ];
  const REMOVED_PIPE_PROPERTY_LABELS = [
    'Pipe Routing',
    'Pipe Rating/Class',
    'End Connection Basis',
    'Elevation Profile',
    'Start Elevation Override',
    'End Elevation Override',
    'Head Loss Allowance',
    'Aging Roughness Factor'
  ];
  const REMOVED_PIPE_PROPERTY_LABEL_PATTERNS = [
    new RegExp('^(?:Controlling\\s+)?' + 'High\\s+' + 'Point', 'i')
  ];
  const REMOVED_PIPE_SEGMENT_COLUMN_LABELS = [
    'z in (m)',
    'z out (m)'
  ];
  const REMOVED_PIPE_SEGMENT_COLUMN_KEYS = [
    'startElevation',
    'endElevation'
  ];

  function escapeText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function number(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function log10(value) {
    return Math.log(Math.max(Number(value) || 1, 1e-12)) / Math.LN10;
  }

  function activeModel() {
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function pipeIdsWithMoody(model = activeModel()) {
    return Object.keys(model || {}).filter((id) => {
      const node = model[id];
      return node?.type === 'pipe' && Array.isArray(node.results?.calculationTrace?.moody?.markers);
    });
  }

  function resolvePipeId(pipeId) {
    const model = activeModel();
    if (pipeId && model[pipeId]?.type === 'pipe') return pipeId;
    return pipeIdsWithMoody(model)[0] || '';
  }

  function pipeTrace(pipeId) {
    const id = resolvePipeId(pipeId);
    return {
      pipeId: id,
      trace: id ? activeModel()[id]?.results?.calculationTrace || null : null
    };
  }

  function markerGroupKey(marker = {}) {
    return marker.overlapGroupKey
      || [
        number(marker.reynolds, 0).toFixed(0),
        number(marker.relRoughness, 0).toFixed(8),
        number(marker.frictionFactor, 0).toFixed(6)
      ].join('|');
  }

  function normalizeMarkers(markers = []) {
    const groupCounts = new Map();
    markers.forEach((marker) => {
      const key = markerGroupKey(marker);
      groupCounts.set(key, (groupCounts.get(key) || 0) + 1);
    });

    const groupIndexes = new Map();
    return markers.map((marker, index) => {
      const key = markerGroupKey(marker);
      const count = number(marker.overlapCount, groupCounts.get(key) || 1);
      const indexInGroup = number(marker.overlapIndex, groupIndexes.get(key) || 0);
      groupIndexes.set(key, indexInGroup + 1);
      const offset = marker.visualOffset || {};
      const angle = count > 1 ? (Math.PI * 2 * indexInGroup) / count : 0;
      const radius = count > 1 ? 11 : 0;
      const dx = number(offset.dx, Math.cos(angle) * radius);
      const dy = number(offset.dy, Math.sin(angle) * radius);
      const names = Array.isArray(marker.overlappingMarkers) && marker.overlappingMarkers.length
        ? marker.overlappingMarkers
        : markers.filter((candidate) => markerGroupKey(candidate) === key).map((candidate) => candidate.name || `Segment ${(candidate.index ?? 0) + 1}`);
      const tooltip = marker.tooltipLabel || names.join(' | ');
      return {
        ...marker,
        key,
        index,
        overlapCount: count,
        overlapIndex: indexInGroup,
        overlappingMarkers: names,
        tooltipLabel: tooltip,
        visualOffset: { count, index: indexInGroup, dx, dy }
      };
    });
  }

  function axisScale(moody = {}) {
    const xMin = number(moody.xMin, 1e3);
    const xMax = number(moody.xMax, 1e8);
    const yMin = number(moody.yMin, 0.008);
    const yMax = number(moody.yMax, 0.12);
    const plot = { left: 62, top: 24, width: 610, height: 328 };
    return {
      plot,
      x(value) {
        const ratio = (log10(value) - log10(xMin)) / Math.max(log10(xMax) - log10(xMin), 1e-9);
        return plot.left + clamp(ratio, 0, 1) * plot.width;
      },
      y(value) {
        const ratio = (log10(yMax) - log10(value)) / Math.max(log10(yMax) - log10(yMin), 1e-9);
        return plot.top + clamp(ratio, 0, 1) * plot.height;
      }
    };
  }

  function polylinePoints(points = [], scale) {
    return points
      .map((point) => `${scale.x(point.reynolds).toFixed(1)},${scale.y(point.frictionFactor).toFixed(1)}`)
      .join(' ');
  }

  function formatDecimal(value, digits = 4, fallback = '-') {
    const parsed = number(value, null);
    return parsed === null ? fallback : parsed.toFixed(digits).replace(/\.?0+$/, '');
  }

  function formatScientific(value, mantissaDigits = 3, fallback = '-') {
    const parsed = number(value, null);
    if (parsed === null || parsed <= 0) return fallback;
    const exponent = Math.floor(Math.log(parsed) / Math.LN10);
    const mantissa = parsed / Math.pow(10, exponent);
    return `${mantissa.toFixed(mantissaDigits)}e${exponent >= 0 ? '+' : ''}${exponent}`;
  }

  function formatReynolds(value) {
    const parsed = number(value, null);
    if (parsed === null) return '-';
    return parsed >= 10000 ? formatScientific(parsed, 3) : formatDecimal(parsed, 0);
  }

  function formatFriction(value) {
    const parsed = number(value, null);
    if (parsed === null) return '-';
    return parsed < 0.01 ? parsed.toFixed(5) : parsed.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  }

  function formatRelRoughness(value) {
    const parsed = number(value, null);
    if (parsed === null) return '-';
    if (parsed > 0 && parsed < 0.0001) return formatScientific(parsed, 4);
    return parsed.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  }

  function classifyRegime(reynolds) {
    const re = number(reynolds, null);
    if (re === null) return 'Unverified';
    if (re < 2300) return 'Laminar';
    if (re < 4000) return 'Transition';
    return 'Turbulent';
  }

  function markerRegime(marker = {}) {
    return marker.regime || marker.flowRegime || marker.flow_regime || classifyRegime(marker.reynolds);
  }

  function markerName(marker = {}, index = 0) {
    return marker.name || marker.segmentName || marker.label || `Segment ${index + 1}`;
  }

  function traceFromPipeNode(pipeId, node) {
    if (!node || typeof node !== 'object') return null;
    const trace = node.results?.calculationTrace || node.calculationTrace || node.trace || null;
    if (trace?.moody) {
      return {
        pipeId: pipeId || node.id || '',
        pipeName: node.name || pipeId || node.id || 'Pipe',
        trace
      };
    }
    if (node.moody) {
      return {
        pipeId: pipeId || node.id || '',
        pipeName: node.name || pipeId || node.id || 'Pipe',
        trace: { moody: node.moody }
      };
    }
    return null;
  }

  function pushCandidateTrace(candidates, candidate) {
    if (!candidate?.trace?.moody) return;
    const markerCount = Array.isArray(candidate.trace.moody.markers) ? candidate.trace.moody.markers.length : 0;
    const signature = [
      candidate.pipeId || '',
      candidate.pipeName || '',
      markerCount,
      candidate.trace.moody.note || ''
    ].join('|');
    if (candidates.some((item) => item.signature === signature)) return;
    candidates.push({ ...candidate, markerCount, signature });
  }

  function collectMoodyTraceCandidates(report, options = {}) {
    const candidates = [];
    const models = [
      activeModel(),
      root.__npshGlobalModel,
      root.globalModel,
      report?.model,
      report?.sourceData?.model,
      report?.sourceData?.project?.model,
      report?.project?.model,
      report?.nodeResults
    ].filter((model, index, list) => model && list.indexOf(model) === index);

    models.forEach((model) => {
      Object.entries(model || {}).forEach(([pipeId, node]) => {
        if (options.pipeId && pipeId !== options.pipeId) return;
        pushCandidateTrace(candidates, traceFromPipeNode(pipeId, node));
      });
    });

    const seen = typeof WeakSet === 'function' ? new WeakSet() : null;
    function visit(value, path = []) {
      if (!value || typeof value !== 'object') return;
      if (seen) {
        if (seen.has(value)) return;
        seen.add(value);
      }
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, path.concat(String(index))));
        return;
      }
      const pipeId = value.id || value.pipeId || path.slice(-1)[0] || '';
      if (!options.pipeId || pipeId === options.pipeId) {
        pushCandidateTrace(candidates, traceFromPipeNode(pipeId, value));
      }
      Object.keys(value).forEach((key) => visit(value[key], path.concat(key)));
    }
    visit(report, []);

    return candidates.sort((left, right) => right.markerCount - left.markerCount);
  }

  function resolveMoodyExportTrace(report, options = {}) {
    return collectMoodyExportTraces(report, options)[0] || {
      pipeId: '',
      pipeName: 'Pipe',
      trace: { moody: {} },
      markerCount: 0
    };
  }

  function pushUniquePipeId(list, pipeId) {
    const normalized = String(pipeId || '').trim();
    if (!normalized || list.includes(normalized)) return;
    list.push(normalized);
  }

  function moodyConnectionSources(report) {
    const sources = [];
    try {
      if (typeof connections !== 'undefined' && Array.isArray(connections)) sources.push(connections);
    } catch (error) {
      // Some bundles expose connections only through the root object or report payload.
    }
    [
      root.connections,
      root.__npshConnections,
      report?.connections,
      report?.sourceData?.connections,
      report?.sourceData?.project?.connections,
      report?.project?.connections
    ].forEach((value) => {
      if (Array.isArray(value) && !sources.includes(value)) sources.push(value);
    });
    return sources;
  }

  function collectPipeIdsFromRows(rows, output) {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      pushUniquePipeId(output, row?.pipeId || row?.objectId || row?.id);
    });
  }

  function collectPipeIdsFromPathText(pathText, output, report) {
    const textValue = String(pathText || '').trim();
    if (!textValue) return;
    const models = [
      activeModel(),
      root.__npshGlobalModel,
      root.globalModel,
      report?.model,
      report?.sourceData?.model,
      report?.sourceData?.project?.model,
      report?.project?.model,
      report?.nodeResults
    ].filter(Boolean);
    textValue.split(/\s*->\s*|\s*>\s*/).forEach((token) => {
      const id = String(token || '').trim();
      if (!id) return;
      const isPipe = models.some((model) => model?.[id]?.type === 'pipe') || /^PIPE[-_\s]?\d+/i.test(id);
      if (isPipe) pushUniquePipeId(output, id);
    });
  }

  function collectMoodyPipeOrder(report, options = {}) {
    const explicitOrder = [];
    pushUniquePipeId(explicitOrder, options.pipeId);
    (Array.isArray(options.pipeIds) ? options.pipeIds : []).forEach((pipeId) => pushUniquePipeId(explicitOrder, pipeId));

    moodyConnectionSources(report).forEach((connectionsList) => {
      connectionsList
        .filter((connection) => !connection?.connectionType || connection.connectionType === 'hydraulic')
        .forEach((connection) => pushUniquePipeId(explicitOrder, connection?.pipeId || connection?.pipe || connection?.objectId));
    });
    collectPipeIdsFromRows(report?.routeRows, explicitOrder);
    collectPipeIdsFromRows(report?.moody?.rows, explicitOrder);
    collectPipeIdsFromRows(report?.sourceData?.routeRows, explicitOrder);
    collectPipeIdsFromRows(report?.sourceData?.primary?.routeRows, explicitOrder);
    collectPipeIdsFromPathText(report?.sourceData?.primary?.trace?.path?.text, explicitOrder, report);
    collectPipeIdsFromPathText(report?.pump?.calculationTrace?.path?.text, explicitOrder, report);
    collectPipeIdsFromPathText(report?.path?.text, explicitOrder, report);

    if (explicitOrder.length) return explicitOrder;

    const fallbackOrder = [];
    [
      activeModel(),
      root.__npshGlobalModel,
      root.globalModel,
      report?.model,
      report?.sourceData?.model,
      report?.sourceData?.project?.model,
      report?.project?.model,
      report?.nodeResults
    ].filter(Boolean).forEach((model) => {
      Object.entries(model || {}).forEach(([pipeId, node]) => {
        if (node?.type === 'pipe') pushUniquePipeId(fallbackOrder, pipeId);
      });
    });
    return fallbackOrder;
  }

  function pipeNodeFromSources(pipeId, report) {
    return [
      activeModel(),
      root.__npshGlobalModel,
      root.globalModel,
      report?.model,
      report?.sourceData?.model,
      report?.sourceData?.project?.model,
      report?.project?.model,
      report?.nodeResults
    ].filter(Boolean).map((model) => model?.[pipeId]).find((node) => node && typeof node === 'object') || null;
  }

  function placeholderMoodyCandidate(pipeId, report) {
    const normalized = String(pipeId || '').trim();
    if (!normalized) return null;
    const node = pipeNodeFromSources(normalized, report);
    return {
      pipeId: normalized,
      pipeName: node?.name || normalized,
      trace: { moody: {} },
      markerCount: 0,
      signature: `placeholder|${normalized}`
    };
  }

  function collectMoodyExportTraces(report, options = {}) {
    const candidates = collectMoodyTraceCandidates(report, options);
    const bestByPipe = new Map();
    candidates.forEach((candidate) => {
      const key = candidate.pipeId || candidate.pipeName || candidate.signature || `pipe-${bestByPipe.size + 1}`;
      const existing = bestByPipe.get(key);
      if (!existing || candidate.markerCount > existing.markerCount) {
        bestByPipe.set(key, candidate);
      }
    });

    const orderedPipeIds = collectMoodyPipeOrder(report, options);
    const output = [];
    const used = new Set();
    const append = (candidate) => {
      if (!candidate) return;
      const key = candidate.pipeId || candidate.pipeName || candidate.signature;
      if (key && used.has(key)) return;
      if (key) used.add(key);
      output.push(candidate);
    };

    orderedPipeIds.forEach((pipeId) => append(bestByPipe.get(pipeId) || placeholderMoodyCandidate(pipeId, report)));
    if (!orderedPipeIds.length) {
      Array.from(bestByPipe.values()).forEach(append);
    }

    return output.length ? output : [{
      pipeId: '',
      pipeName: 'Pipe',
      trace: { moody: {} },
      markerCount: 0,
      signature: 'empty'
    }];
  }

  function exportAxisScale(moody = {}) {
    const xMin = number(moody.xMin, 1e3);
    const xMax = number(moody.xMax, 1e8);
    const yMin = number(moody.yMin, 0.008);
    const yMax = number(moody.yMax, 0.12);
    const plot = { left: 88, top: 38, width: 770, height: 282 };
    return {
      plot,
      xMin,
      xMax,
      yMin,
      yMax,
      x(value) {
        const ratio = (log10(value) - log10(xMin)) / Math.max(log10(xMax) - log10(xMin), 1e-9);
        return plot.left + clamp(ratio, 0, 1) * plot.width;
      },
      y(value) {
        const ratio = (log10(yMax) - log10(value)) / Math.max(log10(yMax) - log10(yMin), 1e-9);
        return plot.top + clamp(ratio, 0, 1) * plot.height;
      }
    };
  }

  function sampleLogRange(min, max, count) {
    return Array.from({ length: count }, (_, index) => {
      const ratio = count <= 1 ? 0 : index / (count - 1);
      return Math.pow(10, log10(min) + ratio * (log10(max) - log10(min)));
    });
  }

  function swameeJainFrictionFactor(reynolds, relRoughness) {
    const re = Math.max(number(reynolds, 0), 1);
    if (re < 2300) return 64 / re;
    const rough = Math.max(number(relRoughness, 0), 0);
    const term = rough / 3.7 + 5.74 / Math.pow(re, 0.9);
    return 0.25 / Math.pow(log10(term), 2);
  }

  function defaultLaminarCurve() {
    return {
      label: 'Laminar Darcy relation',
      points: sampleLogRange(1000, 2300, 24).map((reynolds) => ({
        reynolds,
        frictionFactor: 64 / reynolds
      }))
    };
  }

  function defaultMoodyCurves() {
    return [
      { label: 'smooth pipe', relRoughness: 0, stroke: '#2563eb' },
      { label: 'eps/D 1.0000e-5', relRoughness: 0.00001, stroke: '#0ea5e9' },
      { label: 'eps/D 5.0000e-5', relRoughness: 0.00005, stroke: '#64748b' },
      { label: 'eps/D 0.0001', relRoughness: 0.0001, stroke: '#b45309' },
      { label: 'eps/D 0.0005', relRoughness: 0.0005, stroke: '#3f7d20' },
      { label: 'eps/D 0.001', relRoughness: 0.001, stroke: '#e11d48' },
      { label: 'eps/D 0.005', relRoughness: 0.005, stroke: '#7c3aed' }
    ].map((curve) => ({
      ...curve,
      points: sampleLogRange(4000, 1e8, 80).map((reynolds) => ({
        reynolds,
        frictionFactor: swameeJainFrictionFactor(reynolds, curve.relRoughness)
      }))
    }));
  }

  function curvePointsForExport(curve, scale) {
    return (curve?.points || [])
      .filter((point) => number(point.reynolds, null) !== null && number(point.frictionFactor, null) !== null)
      .map((point) => `${scale.x(point.reynolds).toFixed(1)},${scale.y(point.frictionFactor).toFixed(1)}`)
      .join(' ');
  }

  function exportCurveStroke(curve, index) {
    return curve?.stroke || curve?.color || ['#173f5f', '#2563eb', '#0ea5e9', '#64748b', '#b45309', '#3f7d20', '#e11d48', '#7c3aed'][index % 8];
  }

  function buildMoodyExportSvg(moody = {}, markers = []) {
    const scale = exportAxisScale(moody);
    const xTicks = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8];
    const yTicks = [0.01, 0.02, 0.03, 0.05, 0.08, 0.1];
    const laminarCurve = Array.isArray(moody.laminarCurve?.points) && moody.laminarCurve.points.length
      ? moody.laminarCurve
      : defaultLaminarCurve();
    const turbulentCurves = Array.isArray(moody.curves) && moody.curves.length
      ? moody.curves
      : defaultMoodyCurves();
    const curveLines = [laminarCurve, ...turbulentCurves].filter((curve) => curvePointsForExport(curve, scale));
    const markerPositions = normalizeMarkers(markers).map((marker, index) => {
      const x = scale.x(marker.reynolds) + marker.visualOffset.dx;
      const y = scale.y(marker.frictionFactor) + marker.visualOffset.dy;
      return {
        ...marker,
        name: markerName(marker, index),
        regime: markerRegime(marker),
        x,
        y
      };
    });
    const primary = markerPositions[0] || null;
    const minorGrid = xTicks.slice(0, -1).flatMap((tick) => (
      [2, 3, 4, 5, 6, 7, 8, 9].map((factor) => tick * factor)
    )).filter((tick) => tick >= scale.xMin && tick <= scale.xMax);
    const transitionX1 = scale.x(2300);
    const transitionX2 = scale.x(4000);
    const bottom = scale.plot.top + scale.plot.height;
    const right = scale.plot.left + scale.plot.width;

    return `
      <svg class="eqp-moody-chart-svg" viewBox="0 0 960 390" role="img" aria-label="Log-log Moody chart friction factor check">
        <rect x="0" y="0" width="960" height="390" rx="8" fill="#ffffff"></rect>
        <rect x="${scale.plot.left}" y="${scale.plot.top}" width="${scale.plot.width}" height="${scale.plot.height}" fill="#f8fbff" stroke="#cbd9e6"></rect>
        <rect x="${transitionX1.toFixed(1)}" y="${scale.plot.top}" width="${Math.max(transitionX2 - transitionX1, 1).toFixed(1)}" height="${scale.plot.height}" fill="#fde68a" opacity="0.48"></rect>
        ${minorGrid.map((tick) => `<line x1="${scale.x(tick).toFixed(1)}" y1="${scale.plot.top}" x2="${scale.x(tick).toFixed(1)}" y2="${bottom}" stroke="#e9f1f8" stroke-width="1"></line>`).join('')}
        ${xTicks.map((tick) => `<line x1="${scale.x(tick).toFixed(1)}" y1="${scale.plot.top}" x2="${scale.x(tick).toFixed(1)}" y2="${bottom}" stroke="#d7e5f0" stroke-width="1"></line>`).join('')}
        ${yTicks.map((tick) => `<line x1="${scale.plot.left}" y1="${scale.y(tick).toFixed(1)}" x2="${right}" y2="${scale.y(tick).toFixed(1)}" stroke="#d7e5f0" stroke-width="1"></line>`).join('')}
        <line x1="${scale.plot.left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#24435b" stroke-width="1.2"></line>
        <line x1="${scale.plot.left}" y1="${scale.plot.top}" x2="${scale.plot.left}" y2="${bottom}" stroke="#24435b" stroke-width="1.2"></line>
        ${xTicks.map((tick) => `<text x="${scale.x(tick).toFixed(1)}" y="${(bottom + 26).toFixed(1)}" text-anchor="middle" class="eqp-moody-tick">${formatScientific(tick, 0)}</text>`).join('')}
        ${yTicks.map((tick) => `<text x="${(scale.plot.left - 16).toFixed(1)}" y="${(scale.y(tick) + 4).toFixed(1)}" text-anchor="end" class="eqp-moody-tick">${formatDecimal(tick, tick < 0.1 ? 3 : 1)}</text>`).join('')}
        <text x="${(scale.plot.left + scale.plot.width / 2).toFixed(1)}" y="374" text-anchor="middle" class="eqp-moody-axis-label">Reynolds Number (log scale)</text>
        <text x="26" y="${(scale.plot.top + scale.plot.height / 2).toFixed(1)}" text-anchor="middle" transform="rotate(-90 26 ${(scale.plot.top + scale.plot.height / 2).toFixed(1)})" class="eqp-moody-axis-label">Darcy f (log scale)</text>
        <text x="${(scale.plot.left + 32).toFixed(1)}" y="${(scale.plot.top + 26).toFixed(1)}" class="eqp-moody-region-label">Laminar</text>
        <text x="${((transitionX1 + transitionX2) / 2).toFixed(1)}" y="${(scale.plot.top + 136).toFixed(1)}" text-anchor="middle" transform="rotate(-90 ${((transitionX1 + transitionX2) / 2).toFixed(1)} ${(scale.plot.top + 136).toFixed(1)})" class="eqp-moody-transition-label">Transition</text>
        <text x="${(scale.plot.left + scale.plot.width * 0.56).toFixed(1)}" y="${(scale.plot.top + 25).toFixed(1)}" text-anchor="middle" class="eqp-moody-region-label">Turbulent</text>
        ${curveLines.map((curve, index) => `<polyline points="${curvePointsForExport(curve, scale)}" fill="none" stroke="${exportCurveStroke(curve, index)}" stroke-width="${index === 0 ? '3' : '1.25'}" opacity="${index === 0 ? '0.95' : '0.58'}"><title>${escapeText(curve.label || 'Moody curve')}</title></polyline>`).join('')}
        ${primary ? `
          <line x1="${primary.x.toFixed(1)}" y1="${primary.y.toFixed(1)}" x2="${primary.x.toFixed(1)}" y2="${bottom}" stroke="#24435b" stroke-width="1" stroke-dasharray="5 5"></line>
          <line x1="${scale.plot.left}" y1="${primary.y.toFixed(1)}" x2="${primary.x.toFixed(1)}" y2="${primary.y.toFixed(1)}" stroke="#24435b" stroke-width="1" stroke-dasharray="5 5"></line>
        ` : ''}
        ${markerPositions.map((marker, index) => `
          <g class="eqp-moody-marker-group">
            <circle cx="${marker.x.toFixed(1)}" cy="${marker.y.toFixed(1)}" r="${marker.overlapCount > 1 ? '9' : '8'}" fill="#f8fafc" stroke="#8aa2b5" stroke-width="5" opacity="0.92"></circle>
            <circle cx="${marker.x.toFixed(1)}" cy="${marker.y.toFixed(1)}" r="5" fill="${['#e11d48', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0f766e'][index % 6]}" stroke="#ffffff" stroke-width="1.5">
              <title>${escapeText(`${marker.name}: Re ${formatReynolds(marker.reynolds)}, eps/D ${formatRelRoughness(marker.relRoughness)}, f ${formatFriction(marker.frictionFactor)}, ${marker.regime}`)}</title>
            </circle>
          </g>
        `).join('')}
      </svg>
    `;
  }

  function renderMoodyMetric(label, value) {
    return `<div class="eqp-moody-metric"><span>${escapeText(label)}</span><strong>${escapeText(value)}</strong></div>`;
  }

  function renderMoodySegmentCard(marker, index) {
    const name = markerName(marker, index);
    return `
      <div class="eqp-moody-segment-card">
        <span class="eqp-moody-segment-index">${index + 1}</span>
        <div class="eqp-moody-segment-copy">
          <strong>${escapeText(name)}</strong>
          <small>
            <span>Re ${escapeText(formatReynolds(marker.reynolds))}</span>
            <span>eps/D ${escapeText(formatRelRoughness(marker.relRoughness))}</span>
            <span>f ${escapeText(formatFriction(marker.frictionFactor))}</span>
            <span>${escapeText(markerRegime(marker))}</span>
          </small>
        </div>
      </div>
    `;
  }

  function renderMoodyExportFigure(resolved, figureIndex = 0, figureCount = 1) {
    const moody = resolved.trace?.moody || {};
    const markers = normalizeMarkers(Array.isArray(moody.markers) ? moody.markers : []);
    const primary = markers[0] || {};
    const primaryRegime = markerRegime(primary);
    const segmentCards = markers.length
      ? markers.slice(0, 6).map(renderMoodySegmentCard).join('')
      : '<div class="eqp-moody-segment-card eqp-moody-empty-card"><div class="eqp-moody-segment-copy"><strong>No solved pipe Moody data is available.</strong><small><span>Run the hydraulic calculation, then export the PDF again to populate Re, eps/D, Darcy f, and regime.</span></small></div></div>';
    const pipeLabel = [resolved.pipeName, resolved.pipeId && resolved.pipeId !== resolved.pipeName ? resolved.pipeId : '']
      .filter(Boolean)
      .join(' / ') || 'Pipe';
    const chartTitle = pipeLabel === 'Pipe' ? 'Log-Log Moody Chart' : `Log-Log Moody Chart - ${pipeLabel}`;

    return `
      <article class="eqp-moody-chart-figure" data-pipe-id="${escapeText(resolved.pipeId || '')}" data-pipe-order="${figureIndex + 1}" data-pipe-chart-count="${figureCount}">
        <div class="eqp-moody-topline">
          <div class="eqp-moody-title-badge">
            <span>FRICTION FACTOR AUDIT</span>
            <strong>${escapeText(chartTitle)}</strong>
          </div>
          <div class="eqp-moody-metrics">
            ${renderMoodyMetric('Primary Re', formatReynolds(primary.reynolds))}
            ${renderMoodyMetric('Darcy f', formatFriction(primary.frictionFactor))}
            ${renderMoodyMetric('eps/D', formatRelRoughness(primary.relRoughness))}
            ${renderMoodyMetric('Regime', primaryRegime)}
          </div>
        </div>
        <div class="eqp-moody-chip-row">
          <span>Log-log scale</span>
          <span>Darcy friction factor</span>
          <span>Relative roughness families</span>
          <span>Pipe: ${escapeText(pipeLabel)}</span>
        </div>
        <div class="eqp-moody-chart-wrap">
          ${buildMoodyExportSvg(moody, markers)}
        </div>
        <div class="eqp-moody-formula-block">
          <div class="formula">f_D = 64 / Re</div>
        </div>
        <div class="eqp-moody-segment-grid">
          ${segmentCards}
        </div>
        <p class="eqp-moody-note">Darcy friction factor chart. Fanning friction factor equals Darcy f / 4.</p>
        <div class="eqp-moody-legend">
          <span><i style="background:#173f5f"></i>Laminar Darcy relation</span>
          <span><i style="background:#2563eb"></i>smooth pipe</span>
          <span><i style="background:#0ea5e9"></i>eps/D 1.0000e-5</span>
          <span><i style="background:#64748b"></i>eps/D 5.0000e-5</span>
          <span><i style="background:#b45309"></i>eps/D 0.0001</span>
          <span><i style="background:#3f7d20"></i>eps/D 0.0005</span>
          <span><i style="background:#e11d48"></i>eps/D 0.001</span>
          <span><i style="background:#7c3aed"></i>eps/D 0.005</span>
        </div>
      </article>
    `;
  }

  function buildExportMarkup(report, options = {}) {
    const traces = collectMoodyExportTraces(report, options);
    return `
      <section class="eqp-moody-chart-pack" data-export-note="moody-friction-factor-chart" data-chart-count="${traces.length}">
        ${traces.map((resolved, index) => renderMoodyExportFigure(resolved, index, traces.length)).join('')}
      </section>
    `;
  }

  function renderMoodyChart(container, trace, options = {}) {
    if (!container || !trace?.moody) return null;
    const moody = trace.moody;
    const markers = normalizeMarkers(moody.markers || []);
    const scale = axisScale(moody);
    const markerPositions = markers.map((marker) => {
      const x = scale.x(marker.reynolds) + marker.visualOffset.dx;
      const y = scale.y(marker.frictionFactor) + marker.visualOffset.dy;
      return { ...marker, x, y };
    });
    const groups = [...new Map(markerPositions
      .filter((marker) => marker.overlapCount > 1)
      .map((marker) => [marker.key, marker])).values()];
    const curveLines = [
      moody.laminarCurve,
      ...(moody.curves || [])
    ].filter((curve) => Array.isArray(curve?.points) && curve.points.length);

    container.innerHTML = `
      <section class="pipe-moody-chart-audit" data-pipe-id="${escapeText(options.pipeId || '')}">
        <div class="pipe-moody-chart-head">
          <h3>Moody Chart Audit</h3>
          <span>${escapeText(moody.note || 'Darcy friction factor chart.')}</span>
        </div>
        <svg class="pipe-moody-chart-svg" viewBox="0 0 720 390" role="img" aria-label="Moody chart with separated overlapping markers">
          <rect x="0" y="0" width="720" height="390" fill="#ffffff"></rect>
          <rect x="${scale.plot.left}" y="${scale.plot.top}" width="${scale.plot.width}" height="${scale.plot.height}" fill="#fbfdff" stroke="#c9d7e4"></rect>
          <line x1="${scale.plot.left}" y1="${scale.plot.top + scale.plot.height}" x2="${scale.plot.left + scale.plot.width}" y2="${scale.plot.top + scale.plot.height}" stroke="#52687a" stroke-width="1"></line>
          <line x1="${scale.plot.left}" y1="${scale.plot.top}" x2="${scale.plot.left}" y2="${scale.plot.top + scale.plot.height}" stroke="#52687a" stroke-width="1"></line>
          <text x="320" y="380" text-anchor="middle" class="pipe-moody-axis-label">Reynolds number</text>
          <text x="18" y="192" text-anchor="middle" transform="rotate(-90 18 192)" class="pipe-moody-axis-label">Darcy f</text>
          ${curveLines.map((curve) => `
            <polyline class="pipe-moody-curve" points="${polylinePoints(curve.points, scale)}">
              <title>${escapeText(curve.label || 'Moody curve')}</title>
            </polyline>
          `).join('')}
          ${markerPositions.map((marker) => `
            <g class="pipe-moody-marker-group" data-overlap-group="${escapeText(marker.key)}">
              <circle class="pipe-moody-marker"
                data-marker-name="${escapeText(marker.name || '')}"
                data-overlap-count="${marker.overlapCount}"
                data-overlap-index="${marker.overlapIndex}"
                data-overlap-group="${escapeText(marker.key)}"
                data-tooltip="${escapeText(marker.tooltipLabel)}"
                aria-label="${escapeText(marker.tooltipLabel)}"
                cx="${marker.x.toFixed(2)}"
                cy="${marker.y.toFixed(2)}"
                r="${marker.overlapCount > 1 ? 6 : 5}">
                <title>${escapeText(marker.tooltipLabel)}</title>
              </circle>
            </g>
          `).join('')}
        </svg>
        <div class="pipe-moody-overlap-summary" data-overlap-groups="${groups.length}">
          ${groups.length ? groups.map((marker) => `
            <div class="pipe-moody-overlap-card" data-overlap-group="${escapeText(marker.key)}">
              <strong>${marker.overlapCount} overlapped elements separated visually</strong>
              <span>${escapeText(marker.overlappingMarkers.join(' | '))}</span>
            </div>
          `).join('') : '<div class="pipe-moody-overlap-card"><strong>No overlap group</strong><span>Markers are unique at this flow point.</span></div>'}
        </div>
      </section>
    `;

    const result = {
      pipeId: options.pipeId || '',
      markerCount: markerPositions.length,
      overlapGroupCount: groups.length,
      markers: markerPositions.map((marker) => ({
        name: marker.name,
        overlapGroupKey: marker.key,
        overlapCount: marker.overlapCount,
        overlapIndex: marker.overlapIndex,
        x: Number(marker.x.toFixed(2)),
        y: Number(marker.y.toFixed(2)),
        tooltipLabel: marker.tooltipLabel
      }))
    };
    root.__pipeMoodyChartAuditLastRender = result;
    return result;
  }

  function ensurePanel() {
    if (typeof document === 'undefined') return null;
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'task-window pipe-moody-chart-panel';
    panel.hidden = true;
    panel.setAttribute('hidden', '');
    panel.innerHTML = `
      <div class="task-window-header pipe-moody-chart-panel-header">
        <span>Moody Chart Audit</span>
        <span class="task-window-actions">
          <button class="task-window-close" type="button" data-pipe-moody-close aria-label="Close Moody chart audit">X</button>
        </span>
      </div>
      <div class="task-window-body pipe-moody-chart-panel-body" id="${BODY_ID}"></div>
    `;
    panel.addEventListener('click', (event) => {
      if (event.target?.matches?.('[data-pipe-moody-close]')) {
        panel.hidden = true;
        panel.setAttribute('hidden', '');
      }
    });
    document.body.appendChild(panel);
    return panel;
  }

  function openMoodyChartPanel(pipeId) {
    if (typeof document === 'undefined') return null;
    const resolved = pipeTrace(pipeId);
    const panel = ensurePanel();
    const body = document.getElementById(BODY_ID);
    if (!panel || !body) return null;
    panel.hidden = false;
    panel.removeAttribute('hidden');
    if (!resolved.trace?.moody?.markers?.length) {
      body.innerHTML = '<section class="pipe-moody-chart-audit"><div class="pipe-moody-chart-head"><h3>Moody Chart Audit</h3><span>No solved pipe Moody data is available.</span></div></section>';
      return null;
    }
    return renderMoodyChart(body, resolved.trace, { pipeId: resolved.pipeId });
  }

  function installStyles() {
    if (typeof document === 'undefined' || document.getElementById('engineering-pipe-moody-chart-audit-style')) return;
    const style = document.createElement('style');
    style.id = 'engineering-pipe-moody-chart-audit-style';
    style.textContent = [
      '.pipe-moody-chart-panel{left:clamp(16px,4vw,72px);top:94px;width:min(940px,calc(100vw - 32px));height:min(640px,calc(100dvh - 116px));}',
      '.pipe-moody-chart-panel[hidden]{display:none!important;}',
      '.pipe-moody-chart-panel-body{padding:12px;background:#f6f8fb;}',
      '.pipe-moody-chart-audit{display:grid;gap:10px;}',
      '.pipe-moody-chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}',
      '.pipe-moody-chart-head h3{margin:0;color:#123b5a;font-size:14px;line-height:1.25;}',
      '.pipe-moody-chart-head span{max-width:58%;color:#475569;font-size:11px;line-height:1.35;text-align:right;}',
      '.pipe-moody-chart-svg{width:100%;height:auto;min-height:390px;border:1px solid #d8e6f2;border-radius:6px;background:#fff;}',
      '.pipe-moody-curve{fill:none;stroke:#9fb4c5;stroke-width:1;opacity:.72;}',
      '.pipe-moody-marker{fill:#d14b3f;stroke:#ffffff;stroke-width:2;filter:drop-shadow(0 1px 2px rgba(15,23,42,.24));}',
      '.pipe-moody-marker[data-overlap-count="1"]{fill:#216f9c;}',
      '.pipe-moody-axis-label{fill:#334155;font-size:12px;font-weight:700;}',
      '.pipe-moody-overlap-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;}',
      '.pipe-moody-overlap-card{min-width:0;padding:8px;border:1px solid #d8e6f2;border-radius:6px;background:#fff;}',
      '.pipe-moody-overlap-card strong{display:block;color:#123b5a;font-size:12px;line-height:1.25;}',
      '.pipe-moody-overlap-card span{display:block;margin-top:3px;color:#334155;font-size:11px;line-height:1.35;}'
    ].join('');
    document.head.appendChild(style);
  }

  function isPipePropertySurface(element) {
    if (!element || typeof element.matches !== 'function') return false;
    return element.matches('.persistent-object-properties-task-window[data-kind="pipe"], #taskWindow[data-kind="pipe"], .task-window-pipe-active')
      || element.dataset?.kind === 'pipe';
  }

  function pipePropertySurfaces(scope = document) {
    if (typeof document === 'undefined') return [];
    if (isPipePropertySurface(scope)) return [scope];
    if (!scope?.querySelectorAll) return [];
    return Array.from(scope.querySelectorAll('.persistent-object-properties-task-window[data-kind="pipe"], #taskWindow[data-kind="pipe"], .task-window-pipe-active'));
  }

  function fieldRow(element) {
    return element?.closest?.(
      '[data-prop-key], tr, .object-property-row, .pipe-task-field-row, .object-task-field-row, .field-card, .object-field, .task-field, .prop-row'
    ) || element?.parentElement || null;
  }

  function isInsidePipeSegmentTable(element) {
    return !!element?.closest?.('#pipeSegmentTable, table.segment-table');
  }

  function removeFieldElement(element) {
    const row = fieldRow(element);
    if (row && typeof row.remove === 'function') {
      row.remove();
      return true;
    }
    if (element && typeof element.remove === 'function') {
      element.remove();
      return true;
    }
    return false;
  }

  function normalizeUiText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function matchesRemovedPipePropertyKey(value) {
    const key = String(value || '');
    return REMOVED_PIPE_PROPERTY_KEYS.includes(key)
      || REMOVED_PIPE_PROPERTY_KEY_PATTERNS.some((pattern) => pattern.test(key));
  }

  function matchesRemovedPipePropertyLabel(value) {
    const label = String(value || '').trim();
    return REMOVED_PIPE_PROPERTY_LABELS.includes(label)
      || REMOVED_PIPE_PROPERTY_LABEL_PATTERNS.some((pattern) => pattern.test(label));
  }

  function isTableCell(element) {
    return element?.tagName === 'TH' || element?.tagName === 'TD';
  }

  function pipeSegmentTables(surface) {
    return Array.from(surface.querySelectorAll('#pipeSegmentTable, table.segment-table, table'))
      .filter((table) => {
        if (table.id === 'pipeSegmentTable' || table.classList?.contains('segment-table')) return true;
        return !!table.querySelector?.('.segment-input, [data-field="name"], [data-field="diameter"], [data-field="length"]');
      });
  }

  function tableHeaderCells(table) {
    const headerRow = table.tHead?.rows?.[0]
      || Array.from(table.querySelectorAll('tr')).find((row) => Array.from(row.children).some((cell) => cell.tagName === 'TH'))
      || table.querySelector('tr');
    return headerRow ? Array.from(headerRow.children).filter(isTableCell) : [];
  }

  function removeTableColumn(table, columnIndex) {
    let removed = false;
    Array.from(table.querySelectorAll('tr')).forEach((row) => {
      const cells = Array.from(row.children).filter(isTableCell);
      const cell = cells[columnIndex];
      if (cell && typeof cell.remove === 'function') {
        cell.remove();
        removed = true;
      }
    });
    return removed;
  }

  function removeColumnForElement(table, element) {
    const cell = element?.closest?.('td, th');
    if (!cell) return false;
    const row = cell.parentElement;
    const cells = row ? Array.from(row.children).filter(isTableCell) : [];
    const index = cells.indexOf(cell);
    return index >= 0 ? removeTableColumn(table, index) : false;
  }

  function refreshRemovedPipeSegmentColumns(scope = document) {
    if (typeof document === 'undefined' || !scope?.querySelectorAll) return 0;
    let count = 0;
    const removedLabels = new Set(REMOVED_PIPE_SEGMENT_COLUMN_LABELS.map(normalizeUiText));
    pipePropertySurfaces(scope).forEach((surface) => {
      pipeSegmentTables(surface).forEach((table) => {
        const indexes = tableHeaderCells(table)
          .map((cell, index) => (removedLabels.has(normalizeUiText(cell.textContent)) ? index : -1))
          .filter((index) => index >= 0)
          .sort((left, right) => right - left);
        indexes.forEach((index) => {
          if (removeTableColumn(table, index)) count += 1;
        });
        REMOVED_PIPE_SEGMENT_COLUMN_KEYS.forEach((key) => {
          table.querySelectorAll(`[data-field="${key}"], [data-key="${key}"], [data-prop-key="${key}"], [name="${key}"]`)
            .forEach((element) => {
              if (removeColumnForElement(table, element)) count += 1;
            });
        });
      });
    });
    root.__pipeRemovedSegmentColumnCount = count;
    return count;
  }

  function refreshRemovedPipePropertyFields(scope = document) {
    if (typeof document === 'undefined' || !scope?.querySelectorAll) return 0;
    let count = 0;
    scope.querySelectorAll('.pipe-aging-roughness-help').forEach((help) => help.remove());
    pipePropertySurfaces(scope).forEach((surface) => {
      REMOVED_PIPE_PROPERTY_KEYS.forEach((key) => {
        surface.querySelectorAll(`[data-prop-key="${key}"], [data-key="${key}"], [name="${key}"]`).forEach((element) => {
          if (isInsidePipeSegmentTable(element)) return;
          if (removeFieldElement(element)) count += 1;
        });
      });
      Array.from(surface.querySelectorAll('[data-prop-key], [data-key], [name]'))
        .filter((element) => matchesRemovedPipePropertyKey(element.dataset?.propKey || element.dataset?.key || element.getAttribute('name')))
        .forEach((element) => {
          if (isInsidePipeSegmentTable(element)) return;
          if (removeFieldElement(element)) count += 1;
        });
      Array.from(surface.querySelectorAll('.prop-label, label, th, td, span, div'))
        .filter((element) => matchesRemovedPipePropertyLabel(element.textContent || ''))
        .forEach((element) => {
          if (removeFieldElement(element)) count += 1;
        });
    });
    root.__pipeAgingRoughnessHelpCount = count;
    root.__pipeAgingRoughnessFieldRemovedCount = count;
    root.__pipeRemovedPropertyFieldCount = count;
    return count + refreshRemovedPipeSegmentColumns(scope);
  }

  function refreshAgingRoughnessHelp(scope = document) {
    return refreshRemovedPipePropertyFields(scope);
  }

  function install() {
    installStyles();
    ensurePanel();
    refreshRemovedPipePropertyFields();
    root.__npshPipeMoodyChartAuditInstalled = {
      version: VERSION,
      panel: typeof document !== 'undefined' && !!document.getElementById(PANEL_ID),
      removedFieldCount: root.__pipeRemovedPropertyFieldCount || 0,
      removedSegmentColumnCount: root.__pipeRemovedSegmentColumnCount || 0
    };
    return root.__npshPipeMoodyChartAuditInstalled;
  }

  function startObserver() {
    if (typeof document === 'undefined' || root.__npshPipeMoodyChartAuditObserver) return;
    const observer = new MutationObserver(() => {
      root.setTimeout?.(() => refreshRemovedPipePropertyFields(document), 40);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    root.__npshPipeMoodyChartAuditObserver = true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    renderMoodyChart,
    buildExportMarkup,
    collectMoodyExportTraces,
    collectMoodyPipeOrder,
    openMoodyChartPanel,
    refreshRemovedPipePropertyFields,
    refreshRemovedPipeSegmentColumns,
    refreshAgingRoughnessHelp,
    pipeIdsWithMoody,
    install
  };

  root.EngineeringPipeMoodyChartAudit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document !== 'undefined') {
    const boot = () => {
      install();
      startObserver();
    };
    if (document.readyState === 'complete') root.setTimeout?.(boot, 250);
    else root.addEventListener?.('load', () => root.setTimeout?.(boot, 250), { once: true });
  }
})((typeof window !== 'undefined') ? window : globalThis);
