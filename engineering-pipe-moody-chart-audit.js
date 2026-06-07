(function registerEngineeringPipeMoodyChartAudit(root) {
  const VERSION = 'engineering-pipe-moody-chart-audit.v1';
  const CACHE_KEY = '20260607-pipe-moody-audit2';
  const PANEL_ID = 'engineeringPipeMoodyChartPanel';
  const BODY_ID = 'engineeringPipeMoodyChartPanelBody';
  const AGING_HELP_ID_PREFIX = 'pipe-aging-roughness-help';
  const AGING_HELP_TEXT = 'Dimensionless multiplier for effective roughness: eps_eff = eps x aging factor. Use 1.0 for clean/as-entered roughness; values above 1 model fouling, corrosion, or aging. Unit: x.';

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
      '.pipe-moody-overlap-card span{display:block;margin-top:3px;color:#334155;font-size:11px;line-height:1.35;}',
      '.pipe-aging-roughness-help{margin-top:4px;color:#475569;font-size:10.5px;line-height:1.35;}',
      '.pipe-aging-roughness-help strong{color:#123b5a;}'
    ].join('');
    document.head.appendChild(style);
  }

  function refreshAgingRoughnessHelp(scope = document) {
    if (typeof document === 'undefined' || !scope?.querySelectorAll) return 0;
    let count = 0;
    scope.querySelectorAll('input[data-key="roughnessAgingFactor"]').forEach((input, index) => {
      const row = input.closest('tr') || input.parentElement;
      const valueCell = input.closest('td') || input.parentElement;
      if (!row || !valueCell) return;
      const helpId = `${AGING_HELP_ID_PREFIX}-${index}`;
      const labelCell = row.querySelector('.prop-label');
      if (labelCell) labelCell.setAttribute('title', AGING_HELP_TEXT);
      input.setAttribute('title', AGING_HELP_TEXT);
      input.setAttribute('aria-describedby', helpId);
      let help = valueCell.querySelector('.pipe-aging-roughness-help');
      if (!help) {
        help = document.createElement('div');
        help.className = 'pipe-aging-roughness-help';
        help.id = helpId;
        valueCell.appendChild(help);
      }
      const helpHtml = `<strong>eps_eff = eps x aging factor.</strong> ${escapeText(AGING_HELP_TEXT)}`;
      if (help.innerHTML !== helpHtml) help.innerHTML = helpHtml;
      count += 1;
    });
    root.__pipeAgingRoughnessHelpCount = count;
    return count;
  }

  function install() {
    installStyles();
    ensurePanel();
    refreshAgingRoughnessHelp();
    root.__npshPipeMoodyChartAuditInstalled = {
      version: VERSION,
      panel: typeof document !== 'undefined' && !!document.getElementById(PANEL_ID),
      agingHelpCount: root.__pipeAgingRoughnessHelpCount || 0
    };
    return root.__npshPipeMoodyChartAuditInstalled;
  }

  function startObserver() {
    if (typeof document === 'undefined' || root.__npshPipeMoodyChartAuditObserver) return;
    const observer = new MutationObserver(() => {
      root.setTimeout?.(() => refreshAgingRoughnessHelp(document), 40);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    root.__npshPipeMoodyChartAuditObserver = true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    renderMoodyChart,
    openMoodyChartPanel,
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
