(function registerEngineeringPipeMoodyChartAudit(root) {
  const VERSION = 'engineering-pipe-moody-chart-audit.v7';
  const CACHE_KEY = '20260630-pipe-moody-audit-clean-unused-pipe-fields1';
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
