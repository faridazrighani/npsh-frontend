((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringFormulaDefenseUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-formula-defense-ui.v1';
  const CACHE_KEY = '20260613-formula-defense-ui15';
  const DEBOUNCE_MS = 120;
  const KATEX_SCRIPT = `vendor/katex/katex.min.js?v=${CACHE_KEY}`;
  const KATEX_CSS = `vendor/katex/katex.min.css?v=${CACHE_KEY}`;
  const FORMULA_SELECTOR = [
    '.academic-equation-math',
    '.academic-inline-formula',
    '.pump-curve-formula-card code',
    '.pipe-trace-table code'
  ].join(',');
  const DEFENSE_WINDOW_SELECTOR = [
    '.fluid-formula-defense-task-window',
    '.pipe-formula-defense-task-window',
    '.pump-formula-defense-task-window',
    '.source-formula-defense-task-window',
    '[data-formula-defense-window]'
  ].join(',');

  let installed = false;
  let rendererPatched = false;
  let observer = null;
  let katexPromise = null;
  let recalcTimer = null;
  let recalcSequence = 0;
  let lastChangedInput = null;
  let pipeRefreshPatched = false;
  let pipeTraceBuilderPatched = false;
  let katexWarnFilterInstalled = false;

  function hasDocument() {
    return typeof document !== 'undefined' && document.documentElement;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function numberOrNull(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function luminanceFromRgb({ r, g, b }) {
    const toLinear = (channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return (0.2126 * toLinear(r)) + (0.7152 * toLinear(g)) + (0.0722 * toLinear(b));
  }

  function parseCssColor(value) {
    if (!value || value === 'transparent') return null;
    const rgb = String(value).match(/rgba?\(([^)]+)\)/i);
    if (!rgb) return null;
    const parts = rgb[1].split(',').map((part) => numberOrNull(part.trim()));
    if (parts.length < 3 || parts.slice(0, 3).some((part) => part === null)) return null;
    return { r: parts[0], g: parts[1], b: parts[2] };
  }

  function wcagContrastRatio(foreground, background) {
    const fg = typeof foreground === 'string' ? parseCssColor(foreground) : foreground;
    const bg = typeof background === 'string' ? parseCssColor(background) : background;
    if (!fg || !bg) return 0;
    const high = Math.max(luminanceFromRgb(fg), luminanceFromRgb(bg));
    const low = Math.min(luminanceFromRgb(fg), luminanceFromRgb(bg));
    return (high + 0.05) / (low + 0.05);
  }

  function colorForTheme() {
    if (!hasDocument()) {
      return {
        surface: '#ffffff',
        text: '#0f172a',
        muted: '#475569',
        accent: '#1f6fa9',
        border: '#cbd5e1'
      };
    }
    const body = document.body;
    const element = document.documentElement;
    const explicit = `${body?.dataset?.theme || ''} ${element?.dataset?.theme || ''} ${body?.className || ''}`;
    const dark = /\bdark\b|dark-mode|theme-dark/i.test(explicit);
    return dark
      ? { surface: '#ffffff', text: '#0f172a', muted: '#475569', accent: '#1f6fa9', border: '#cbd5e1' }
      : { surface: '#ffffff', text: '#0f172a', muted: '#475569', accent: '#1f6fa9', border: '#cbd5e1' };
  }

  function ensureKatexCss() {
    if (!hasDocument()) return;
    if (document.querySelector('link[data-formula-defense-katex-css]')) return;
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => String(link.href).includes('vendor/katex/katex.min.css'))) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = KATEX_CSS;
    link.dataset.formulaDefenseKatexCss = 'true';
    document.head.appendChild(link);
  }

  function loadKatex() {
    if (root.katex?.renderToString) return Promise.resolve(root.katex);
    if (!hasDocument()) return Promise.resolve(null);
    if (katexPromise) return katexPromise;
    ensureKatexCss();
    katexPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[data-formula-defense-katex-script], script[src*="vendor/katex/katex.min.js"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(root.katex || null), { once: true });
        existing.addEventListener('error', () => resolve(null), { once: true });
        if (root.katex?.renderToString) resolve(root.katex);
        return;
      }
      const script = document.createElement('script');
      script.src = KATEX_SCRIPT;
      script.async = true;
      script.dataset.formulaDefenseKatexScript = 'true';
      script.onload = () => resolve(root.katex || null);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
    return katexPromise;
  }

  function installCss() {
    if (!hasDocument() || document.getElementById('engineeringFormulaDefenseUiStyles')) return;
    const colors = colorForTheme();
    const style = document.createElement('style');
    style.id = 'engineeringFormulaDefenseUiStyles';
    style.textContent = `
:root {
  --formula-defense-surface: ${colors.surface};
  --formula-defense-text: ${colors.text};
  --formula-defense-muted: ${colors.muted};
  --formula-defense-accent: ${colors.accent};
  --formula-defense-border: ${colors.border};
  --formula-defense-panel: #ffffff;
  --formula-defense-panel-text: #102a43;
  --formula-defense-row-alt: #f5f8fb;
  --formula-defense-row-hover: #eaf5ff;
  --formula-defense-warning: #fff7ed;
  --formula-defense-warning-text: #7c2d12;
}
.academic-equation-display,
.formula-defense-equation-surface,
.pump-curve-formula-card code,
.pipe-trace-table code[data-formula-defense-equation="true"] {
  background: var(--formula-defense-surface) !important;
  color: var(--formula-defense-text) !important;
  border: 1px solid var(--formula-defense-border) !important;
}
.academic-equation-display *,
.formula-defense-equation-surface *,
.academic-equation-math,
.academic-inline-formula,
.pump-curve-formula-card code *,
.pipe-trace-table code[data-formula-defense-equation="true"] *,
.formula-defense-katex,
.formula-defense-katex * {
  color: var(--formula-defense-text) !important;
  opacity: 1 !important;
  text-shadow: none !important;
}
.academic-equation-context,
.academic-equation-result,
.formula-defense-equation-muted {
  color: #334155 !important;
}
[data-theme="dark"] .academic-equation-context,
[data-theme="dark"] .academic-equation-result,
[data-theme="dark"] .formula-defense-equation-muted,
.theme-dark .academic-equation-context,
.theme-dark .academic-equation-result,
.theme-dark .formula-defense-equation-muted,
.dark-mode .academic-equation-context,
.dark-mode .academic-equation-result,
.dark-mode .formula-defense-equation-muted {
  color: #475569 !important;
}
.academic-equation-display .academic-equation-context,
.academic-equation-display .academic-equation-result,
.formula-defense-equation-surface .formula-defense-equation-muted {
  color: var(--formula-defense-muted) !important;
}
.academic-inline-formula,
.formula-defense-inline-equation {
  background: var(--formula-defense-surface) !important;
  color: var(--formula-defense-text) !important;
  border: 1px solid var(--formula-defense-border) !important;
  border-radius: 6px;
  padding: 0.1rem 0.32rem;
  white-space: nowrap;
}
.formula-defense-fallback-equation {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  letter-spacing: 0;
  white-space: normal;
}
.formula-defense-calculation-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0 0 0.75rem;
  padding: 0.56rem 0.72rem;
  border-radius: 8px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #123b5a;
  font-size: 0.78rem;
  font-weight: 700;
}
.formula-defense-calculation-banner[data-state="Stale"],
.formula-defense-calculation-banner[data-state="Calculating"] {
  border-color: #fed7aa;
  background: var(--formula-defense-warning);
  color: var(--formula-defense-warning-text);
}
.formula-defense-calculation-banner[data-state="Current"] {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #14532d;
}
.formula-defense-loading-dot {
  width: 0.56rem;
  height: 0.56rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: currentColor;
  animation: formulaDefensePulse 0.8s ease-in-out infinite alternate;
}
@keyframes formulaDefensePulse {
  from { opacity: 0.35; transform: scale(0.82); }
  to { opacity: 1; transform: scale(1); }
}
.pipe-formula-defense-task-window[data-pipe-formula-defense-layout="compact-v2"] {
  width: min(700px, calc(100vw - 24px));
  height: min(700px, calc(100dvh - 128px));
  min-width: min(360px, calc(100vw - 24px));
  min-height: min(300px, calc(100dvh - 18px));
  max-width: calc(100vw - 16px);
  max-height: calc(100dvh - 24px);
}
.pipe-formula-defense-task-window[data-pipe-formula-defense-layout="compact-v2"] .task-window-body,
.pipe-formula-defense-task-window[data-pipe-formula-defense-layout="compact-v2"] .pipe-formula-defense-body {
  padding: 14px !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  background: #f6f8fb !important;
}
.pipe-formula-defense-layout {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr);
  gap: 9px !important;
  align-content: start;
  container-type: inline-size;
  container-name: pipe-formula-defense;
}
.pipe-formula-defense-layout .fluid-help-card {
  margin: 0 !important;
  overflow: hidden;
  border: 1px solid #d8e6f2 !important;
  border-radius: 8px !important;
  background: #ffffff !important;
  box-shadow: none !important;
}
.pipe-formula-defense-layout .fluid-help-card > h3,
.pipe-formula-defense-layout .fluid-help-card > summary {
  display: flex;
  align-items: center;
  margin: 0 !important;
  padding: 10px 12px !important;
  border-bottom: 1px solid #edf2f7;
  background: #eef6fc !important;
  color: #123b5a !important;
  font-size: 13px !important;
  line-height: 1.2;
  font-weight: 700 !important;
  letter-spacing: 0;
}
.pipe-formula-defense-layout .fluid-help-card > summary {
  cursor: pointer;
}
.pipe-formula-defense-layout .fluid-help-card > :not(h3):not(summary) {
  margin: 0 !important;
}
.pipe-formula-defense-layout .src-help-text,
.pipe-formula-defense-layout .fluid-help-list {
  color: #334155 !important;
  font-size: 12px !important;
}
.pipe-formula-defense-layout .src-help-text {
  padding: 10px 12px !important;
  line-height: 1.38 !important;
}
.pipe-formula-defense-layout .fluid-help-list {
  margin: 0 !important;
  padding: 10px 13px 10px 28px !important;
  line-height: 1.36 !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-note {
  margin: 8px 0 0 !important;
  padding: 0 !important;
  color: #334155 !important;
  font-size: 10.5px !important;
  line-height: 1.35 !important;
}
.pipe-formula-defense-layout .src-help-text p,
.pipe-formula-defense-layout .fluid-help-list li {
  margin: 0 0 5px !important;
}
.pipe-formula-defense-layout .src-help-text p:last-child,
.pipe-formula-defense-layout .fluid-help-list li:last-child {
  margin-bottom: 0 !important;
}
.pipe-formula-defense-layout .fluid-formula-defense-table-wrap,
.pipe-formula-defense-layout .pipe-formula-defense-table-wrap,
.pipe-formula-defense-layout .pump-curve-explanation-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto !important;
  overflow-y: auto;
  border-radius: 0 !important;
  border: 0 !important;
}
.pipe-formula-defense-layout .fluid-formula-defense-table,
.pipe-formula-defense-layout .pump-curve-explanation-table {
  width: 100% !important;
  min-width: 520px;
  border-collapse: collapse !important;
  table-layout: fixed;
  background: #ffffff !important;
  color: #333333 !important;
  font-size: 11px !important;
  line-height: 1.35 !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-source-table {
  min-width: min(760px, 100%) !important;
  font-size: 10.5px !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table,
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table {
  table-layout: fixed !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table {
  width: 100% !important;
  min-width: min(760px, 100%) !important;
  font-size: 10.6px !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table {
  width: max(100%, 860px) !important;
  min-width: 860px !important;
  font-size: 10.6px !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table th:nth-child(1),
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table td:nth-child(1) {
  width: 24%;
}
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table th:nth-child(2),
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table td:nth-child(2) {
  width: 28%;
  color: #0b4778 !important;
  font-weight: 400 !important;
  font-variant-numeric: tabular-nums;
}
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table th:nth-child(3),
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table td:nth-child(3) {
  width: 48%;
}
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th:nth-child(1),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(1) {
  width: 24%;
}
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th:nth-child(2),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(2) {
  width: 15%;
}
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th:nth-child(3),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(3) {
  width: 58px;
}
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th:nth-child(4),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(4) {
  width: 74px;
}
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th:nth-child(5),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(5),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th:nth-child(6),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(6),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th:nth-child(7),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(7) {
  width: 84px;
}
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th:nth-child(8),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(8) {
  width: auto;
}
.pipe-formula-defense-layout .pipe-formula-defense-summary-table,
.pipe-formula-defense-layout .pipe-formula-defense-rollup-table,
.pipe-formula-defense-layout .pipe-formula-defense-moody-table {
  min-width: min(760px, 100%) !important;
}
.pipe-formula-defense-layout .fluid-formula-defense-table thead th,
.pipe-formula-defense-layout .pump-curve-explanation-table thead th {
  position: static;
  top: 0;
  z-index: 2;
  padding: 7px 8px !important;
  border-bottom: 1px solid #edf2f7 !important;
  background: #eef6fc !important;
  color: #123b5a !important;
  font-weight: 700 !important;
  text-align: left !important;
  white-space: normal;
  overflow-wrap: normal;
  word-break: break-word;
}
.pipe-formula-defense-layout .fluid-formula-defense-table td,
.pipe-formula-defense-layout .pump-curve-explanation-table td {
  padding: 7px 8px !important;
  border-top: 0 !important;
  border-bottom: 1px solid #edf2f7 !important;
  background: transparent !important;
  color: #333333 !important;
  font-weight: 400 !important;
  vertical-align: top !important;
  white-space: normal !important;
  overflow-wrap: normal;
  word-break: break-word;
}
.pipe-formula-defense-layout .fluid-formula-defense-table tbody tr:nth-child(even) td,
.pipe-formula-defense-layout .pump-curve-explanation-table tbody tr:nth-child(even) td {
  background: #f8fbfe !important;
}
.pipe-formula-defense-layout .fluid-formula-defense-table tbody tr:hover td,
.pipe-formula-defense-layout .pump-curve-explanation-table tbody tr:hover td {
  background: #eef7ff !important;
}
.pipe-formula-defense-layout .fluid-formula-defense-table td:nth-child(2),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(n+3),
.pipe-formula-defense-layout .pipe-formula-defense-rollup-table td:nth-child(2),
.pipe-formula-defense-layout .pipe-formula-defense-moody-table td:nth-child(n+2) {
  color: #0f314d !important;
  font-weight: 400 !important;
  font-variant-numeric: tabular-nums;
}
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th:nth-child(n+3),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(n+3),
.pipe-formula-defense-layout .pipe-formula-defense-moody-table th:nth-child(n+2),
.pipe-formula-defense-layout .pipe-formula-defense-moody-table td:nth-child(n+2) {
  text-align: right !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table th,
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table td,
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th,
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td {
  white-space: normal !important;
  overflow-wrap: anywhere;
}
.pipe-formula-defense-layout .pipe-formula-defense-role-path-table th,
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th,
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(3),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(4),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(5),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(6),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(7) {
  word-break: normal !important;
  overflow-wrap: normal !important;
  white-space: nowrap !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table th:nth-child(8),
.pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:nth-child(8) {
  text-align: left !important;
  font-weight: 400 !important;
}
.pipe-formula-defense-target-table-wrap {
  max-width: 100%;
  overflow-x: auto !important;
  scrollbar-gutter: stable;
}
.pipe-formula-defense-layout .fluid-formula-defense-table code,
.pipe-formula-defense-layout .pump-curve-formula-card code,
.pipe-formula-defense-layout .academic-equation-display,
.pipe-formula-defense-layout .formula-defense-equation-surface {
  background: #ffffff !important;
  color: #0f172a !important;
  border-color: #cbd5e1 !important;
  text-shadow: none !important;
}
.pipe-formula-defense-layout .fluid-formula-defense-table code,
.pipe-formula-defense-layout .fluid-formula-defense-table .academic-inline-formula {
  display: inline-block;
  max-width: 100%;
  padding: 2px 5px !important;
  border: 1px solid #d6e3ef !important;
  border-radius: 4px !important;
  background: #ffffff !important;
  color: #0f172a !important;
  white-space: normal !important;
  overflow-wrap: anywhere;
}
.pipe-formula-defense-layout .pipe-source-map-formula-cell,
.pipe-formula-defense-layout .pipe-source-map-formula-cell code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace !important;
  font-size: 11px !important;
  line-height: 1.35 !important;
  font-weight: 500 !important;
  background: #ffffff !important;
  color: #0f172a !important;
  border-color: #d6e3ef !important;
  letter-spacing: 0;
  white-space: normal !important;
  overflow-wrap: anywhere;
}
.pipe-formula-defense-layout .pipe-formula-defense-formula-list,
.pipe-formula-defense-layout .pipe-formula-defense-segment-steps {
  display: grid;
  gap: 7px;
  padding: 8px 10px !important;
}
.pipe-formula-defense-layout .academic-equation-step,
.pipe-formula-defense-layout .pump-curve-formula-card {
  margin: 0 !important;
  padding: 8px 9px !important;
  border: 1px solid #d6e3ef !important;
  border-radius: 6px !important;
  background: #ffffff !important;
}
.pipe-formula-defense-layout .academic-equation-context,
.pipe-formula-defense-layout .pump-curve-formula-card h4 {
  margin: 0 0 5px !important;
  color: #0f314d !important;
  font-size: 11.5px !important;
  line-height: 1.25 !important;
  font-weight: 800 !important;
}
.pipe-formula-defense-layout .academic-equation-display {
  margin: 4px 0 !important;
  padding: 7px 8px !important;
  border-radius: 5px !important;
  min-height: 0 !important;
}
.pipe-formula-defense-layout .academic-equation-result,
.pipe-formula-defense-layout .pump-curve-formula-substitution,
.pipe-formula-defense-layout .pump-curve-formula-result {
  margin: 5px 0 0 !important;
  color: #334155 !important;
  font-size: 11px !important;
  line-height: 1.35 !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-segment-list {
  display: grid;
  gap: 8px;
  padding: 8px 10px !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-segment-card {
  overflow: hidden;
  border: 1px solid #cfe3f5 !important;
  border-radius: 6px !important;
  background: #ffffff !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-segment-card > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 9px !important;
  border-bottom: 1px solid #dbeaf7;
  background: #eaf4fc !important;
  color: #003a5d !important;
  font-size: 12px !important;
  font-weight: 800 !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-segment-card > summary strong {
  color: #003a5d !important;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pipe-formula-defense-layout .pipe-formula-defense-segment-metrics {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 6px !important;
  padding: 8px 9px !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-segment-metric {
  min-width: 0;
  padding: 6px 7px !important;
  border: 1px solid #d8e6f2 !important;
  border-radius: 5px !important;
  background: #f8fbfe !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-segment-metric span {
  display: block;
  color: #64748b !important;
  font-size: 10.5px !important;
  line-height: 1.15 !important;
}
.pipe-formula-defense-layout .pipe-formula-defense-segment-metric strong {
  display: block;
  margin-top: 2px;
  color: #0f314d !important;
  font-size: 11px !important;
  font-weight: 400 !important;
  line-height: 1.2 !important;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.pipe-formula-defense-fitting-breakdown-table {
  width: max-content !important;
  min-width: min(920px, 100%) !important;
  table-layout: auto !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
}
.pipe-formula-defense-fitting-breakdown-table thead th {
  position: static !important;
  top: 0;
  z-index: 3;
  background: #eef6fc !important;
  color: #123b5a !important;
  white-space: nowrap;
}
.pipe-formula-defense-fitting-breakdown-table tbody tr:nth-child(even) td {
  background: var(--formula-defense-row-alt) !important;
}
.pipe-formula-defense-fitting-breakdown-table tbody tr:hover td {
  background: var(--formula-defense-row-hover) !important;
}
.pipe-formula-defense-fitting-breakdown-table th,
.pipe-formula-defense-fitting-breakdown-table td {
  vertical-align: middle !important;
  white-space: nowrap;
}
.pipe-formula-defense-fitting-breakdown-table th:nth-child(n+3),
.pipe-formula-defense-fitting-breakdown-table td:nth-child(n+3) {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}
.pipe-formula-defense-fitting-breakdown-table th:first-child,
.pipe-formula-defense-fitting-breakdown-table td:first-child,
.pipe-formula-defense-fitting-breakdown-table th:nth-child(2),
.pipe-formula-defense-fitting-breakdown-table td:nth-child(2) {
  text-align: left !important;
}
.pipe-formula-defense-fitting-breakdown-table .formula-defense-empty-state,
.pipe-formula-defense-fitting-breakdown-table td[colspan] {
  text-align: center !important;
  color: #475569 !important;
  background: #f8fafc !important;
  white-space: normal !important;
}
.pipe-formula-defense-fitting-breakdown-wrap,
.formula-defense-responsive-table-wrap {
  max-width: 100%;
  overflow-x: auto !important;
  overflow-y: auto;
  border-radius: 8px;
}
.formula-dependency-visualization {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 0.55rem;
  margin: 0.52rem 0 0.7rem;
}
.formula-dependency-node {
  min-width: 0;
  padding: 0.52rem 0.58rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: var(--formula-defense-panel);
  color: var(--formula-defense-panel-text);
}
.formula-dependency-node strong {
  display: block;
  margin-bottom: 0.18rem;
  color: inherit;
  font-size: 0.72rem;
}
.formula-dependency-node span {
  display: block;
  overflow-wrap: anywhere;
  font-size: 0.72rem;
}
@media (max-width: 760px) {
  .pipe-formula-defense-task-window[data-pipe-formula-defense-layout="compact-v2"] {
    inset: 6px !important;
    width: calc(100vw - 12px);
    max-width: calc(100vw - 12px) !important;
    max-height: calc(100dvh - 12px) !important;
  }
  .pipe-formula-defense-task-window[data-pipe-formula-defense-layout="compact-v2"] .task-window-body,
  .pipe-formula-defense-task-window[data-pipe-formula-defense-layout="compact-v2"] .pipe-formula-defense-body {
    padding: 7px !important;
  }
  .pipe-formula-defense-layout {
    gap: 6px !important;
  }
  .pipe-formula-defense-layout .fluid-help-card > h3,
  .pipe-formula-defense-layout .fluid-help-card > summary {
    padding: 7px 8px !important;
    font-size: 12px !important;
  }
  .pipe-formula-defense-layout .src-help-text,
  .pipe-formula-defense-layout .fluid-help-list,
  .pipe-formula-defense-layout .pipe-formula-defense-note {
    padding: 8px !important;
  }
  .pipe-formula-defense-layout .fluid-formula-defense-table,
  .pipe-formula-defense-layout .pump-curve-explanation-table {
    min-width: 520px;
  }
  .pipe-formula-defense-layout .pipe-formula-defense-source-table {
    min-width: min(760px, 100%) !important;
  }
  .pipe-formula-defense-layout .pipe-formula-defense-segment-metrics {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
  .formula-dependency-visualization {
    grid-template-columns: 1fr;
  }
  .pipe-formula-defense-fitting-breakdown-table {
    min-width: 860px !important;
  }
}
@media (min-width: 761px) and (max-width: 960px) {
  .pipe-formula-defense-task-window[data-pipe-formula-defense-layout="compact-v2"] .task-window-body,
  .pipe-formula-defense-task-window[data-pipe-formula-defense-layout="compact-v2"] .pipe-formula-defense-body {
    padding: 9px !important;
  }
}
@container pipe-formula-defense (max-width: 540px) {
  .pipe-formula-defense-layout .pipe-formula-defense-role-path-table,
  .pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table {
    width: 100% !important;
    min-width: 0 !important;
  }
  .pipe-formula-defense-layout .pipe-formula-defense-role-path-table thead,
  .pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table thead {
    display: none !important;
  }
  .pipe-formula-defense-layout .pipe-formula-defense-role-path-table tbody,
  .pipe-formula-defense-layout .pipe-formula-defense-role-path-table tr,
  .pipe-formula-defense-layout .pipe-formula-defense-role-path-table td,
  .pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table tbody,
  .pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table tr,
  .pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td {
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
  }
  .pipe-formula-defense-layout .pipe-formula-defense-role-path-table tr,
  .pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table tr {
    margin: 7px 8px !important;
    overflow: hidden;
    border: 1px solid #d6e3ef !important;
    border-radius: 6px !important;
    background: #ffffff !important;
  }
  .pipe-formula-defense-layout .pipe-formula-defense-role-path-table td,
  .pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td {
    display: grid !important;
    grid-template-columns: minmax(112px, 34%) minmax(0, 1fr);
    gap: 8px;
    align-items: start;
    padding: 7px 8px !important;
    border-top: 1px solid #e3eef7 !important;
    background: #ffffff !important;
    text-align: left !important;
    white-space: normal !important;
    overflow-wrap: anywhere;
  }
  .pipe-formula-defense-layout .pipe-formula-defense-role-path-table td:first-child,
  .pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td:first-child {
    border-top: 0 !important;
  }
  .pipe-formula-defense-layout .pipe-formula-defense-role-path-table td::before,
  .pipe-formula-defense-layout .pipe-formula-defense-fitting-breakdown-table td::before {
    content: attr(data-label);
    color: #475569;
    font-size: 10.5px;
    font-weight: 800;
    line-height: 1.25;
  }
}
`;
    document.head.appendChild(style);
  }

  function normalizeFormulaText(value) {
    return String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function applyIdentifierMappings(value) {
    const replacements = new Map([
      ['H_static', 'H_{\\mathrm{static}}'],
      ['Hstatic', 'H_{\\mathrm{static}}'],
      ['H_major', 'H_{\\mathrm{major}}'],
      ['Hmajor', 'H_{\\mathrm{major}}'],
      ['H_minor', 'H_{\\mathrm{minor}}'],
      ['Hminor', 'H_{\\mathrm{minor}}'],
      ['H_system', 'H_{\\mathrm{system}}'],
      ['Hsystem', 'H_{\\mathrm{system}}'],
      ['H_pump_curve', 'H_{\\mathrm{pump\\ curve}}'],
      ['h_loss_suction', 'h_{\\mathrm{loss,suction}}'],
      ['h_loss_discharge', 'h_{\\mathrm{loss,discharge}}'],
      ['h_minor', 'h_{\\mathrm{minor}}'],
      ['hf', 'h_f'],
      ['Reynolds Number', '\\mathrm{Re}'],
      ['Reynolds', '\\mathrm{Re}'],
      ['Re', '\\mathrm{Re}'],
      ['eps/D', '\\varepsilon/D'],
      ['epsilon/D', '\\varepsilon/D'],
      ['epsD', '\\varepsilon/D'],
      ['NPSHA', '\\mathrm{NPSH}_{A}'],
      ['NPSHa', '\\mathrm{NPSH}_{A}'],
      ['NPSHR', '\\mathrm{NPSH}_{R}'],
      ['NPSHr', '\\mathrm{NPSH}_{R}'],
      ['TDH', '\\mathrm{TDH}'],
      ['DeltaP', '\\Delta P'],
      ['deltaP', '\\Delta P'],
      ['rho', '\\rho'],
      ['mu', '\\mu'],
      ['nu', '\\nu'],
      ['pi', '\\pi'],
      ['sqrt', '\\sqrt']
    ]);
    let output = value;
    [...replacements.entries()]
      .sort((a, b) => b[0].length - a[0].length)
      .forEach(([from, to]) => {
        output = output.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), to);
      });
    return output;
  }

  function formulaToTex(rawValue) {
    let value = normalizeFormulaText(rawValue)
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/\u00d7/g, '\\times')
      .replace(/\*/g, '\\times')
      .replace(/\u00f7/g, '/')
      .replace(/\u0394/g, '\\Delta ')
      .replace(/\u03b5/g, '\\varepsilon')
      .replace(/\u03c1/g, '\\rho')
      .replace(/\u03bc/g, '\\mu')
      .replace(/\u03bd/g, '\\nu')
      .replace(/->/g, '\\rightarrow');

    if (!value) return '';
    if (/^H\s*=\s*Hstatic\s*\+\s*Hmajor\s*\+\s*Hminor$/i.test(value)) {
      return 'H = H_{\\mathrm{static}} + H_{\\mathrm{major}} + H_{\\mathrm{minor}}';
    }
    if (/^h\s*f?\s*=\s*f\s*\(?L\s*\/\s*D\)?\s*\(?V\^?2\s*\/\s*\(?2\s*(?:\\times)?\s*g\)?\)?$/i.test(value.replace(/\s+/g, ''))) {
      return 'h_f = f \\left(\\frac{L}{D}\\right)\\left(\\frac{V^2}{2g}\\right)';
    }

    value = value
      .replace(/\(([^()]+)\s*\/\s*([^()]+)\)/g, (_match, numerator, denominator) => `\\left(\\frac{${numerator.trim()}}{${denominator.trim()}}\\right)`)
      .replace(/\bL\s*\/\s*D\b/g, '\\frac{L}{D}')
      .replace(/\bV\^2\s*\/\s*\(?2\s*(?:\\times)?\s*g\)?/g, '\\frac{V^2}{2g}')
      .replace(/\bQ\s*\/\s*A\b/g, '\\frac{Q}{A}')
      .replace(/\b4\s*Q\s*\/\s*\(?pi\s*D\^2\)?/gi, '\\frac{4Q}{\\pi D^2}')
      .replace(/\brho\s*g\b/gi, '\\rho g')
      .replace(/\bbar\s*a\b/gi, '\\ \\mathrm{bar\\ a}')
      .replace(/\bm3\/h\b/gi, '\\ \\mathrm{m^3/h}')
      .replace(/\bm\/s\b/gi, '\\ \\mathrm{m/s}')
      .replace(/\bN\/m3\b/gi, '\\ \\mathrm{N/m^3}')
      .replace(/\bmm\b/gi, '\\ \\mathrm{mm}');

    value = applyIdentifierMappings(value);

    return value;
  }

  function sanitizeTextCommandBody(value) {
    return String(value || '')
      .replace(/\s+/g, '\\,')
      .replace(/\\\s+/g, '\\,')
      .replace(/\\,/g, '\\,');
  }

  function sanitizeTexForKatex(rawTex) {
    return String(rawTex || '')
      .replace(/\r?\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\\(?:mathrm|text|operatorname)\{[^{}]*\}/g, (match) => {
        const command = match.match(/^\\([a-z]+)\{/i)?.[1] || 'text';
        const body = match.slice(command.length + 2, -1);
        return `\\${command}{${sanitizeTextCommandBody(body)}}`;
      })
      .replace(/\\\s+(?=\\mathrm|\\text|\\operatorname)/g, '\\,')
      .trim();
  }

  function isBenignKatexSpaceMetricWarning(args) {
    return /No character metrics\b.*Main-Regular\b.*mode\s+['"]?text/i.test(args.map(String).join(' '));
  }

  function installKatexWarningFilter() {
    const consoleObject = root.console;
    if (katexWarnFilterInstalled || !consoleObject?.warn || consoleObject.warn.__formulaDefenseKatexWarnFilter) return false;
    const originalWarn = consoleObject.warn;
    consoleObject.warn = function formulaDefenseGlobalKatexWarnFilter(...args) {
      if (isBenignKatexSpaceMetricWarning(args)) return;
      return originalWarn.apply(consoleObject, args);
    };
    consoleObject.warn.__formulaDefenseKatexWarnFilter = true;
    consoleObject.warn.__formulaDefenseKatexWarnOriginal = originalWarn;
    katexWarnFilterInstalled = true;
    return true;
  }

  function renderKatexToString(katex, tex, options) {
    const consoleObject = root.console;
    if (!consoleObject?.warn) return katex.renderToString(tex, options);
    const originalWarn = consoleObject.warn;
    const deferredWarnings = [];
    consoleObject.warn = function formulaDefenseKatexWarnFilter(...args) {
      if (isBenignKatexSpaceMetricWarning(args)) return;
      deferredWarnings.push(args);
    };
    try {
      return katex.renderToString(tex, options);
    } finally {
      consoleObject.warn = originalWarn;
      deferredWarnings.forEach((args) => originalWarn.apply(consoleObject, args));
    }
  }

  function fallbackFormulaHtml(rawValue, tex, reason = '') {
    return {
      html: `<span class="formula-defense-fallback-equation" data-formula-defense-fallback="${escapeHtml(reason)}">${escapeHtml(normalizeFormulaText(rawValue) || tex)}</span>`,
      mapped: false,
      renderer: 'fallback',
      tex,
      source: String(rawValue ?? '')
    };
  }

  function renderFormulaMarkup(rawValue, context = '', options = {}) {
    const source = normalizeFormulaText(rawValue);
    const tex = sanitizeTexForKatex(formulaToTex(source));
    if (!tex) return fallbackFormulaHtml(source, tex, 'empty');
    const katex = root.katex;
    if (!katex?.renderToString) return fallbackFormulaHtml(source, tex, 'katex-not-loaded');
    try {
      const html = renderKatexToString(katex, tex, {
        displayMode: options.displayMode === true,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
        output: 'html'
      });
      return {
        html: `<span class="formula-defense-katex" data-equation-renderer="katex" data-formula-tex="${escapeHtml(tex)}" data-formula-context="${escapeHtml(context)}">${html}</span>`,
        mapped: true,
        renderer: 'katex',
        tex,
        source
      };
    } catch (error) {
      return fallbackFormulaHtml(source, tex, error?.message || 'katex-render-error');
    }
  }

  function formatEquationResult(step = {}, resultText = '') {
    if (resultText) return String(resultText);
    if (typeof root.formatAcademicEquationResult === 'function') return root.formatAcademicEquationResult(step, resultText);
    const value = step.result ?? step.value ?? step.displayValue;
    const unit = step.unit ? ` ${step.unit}` : '';
    if (value === undefined || value === null || value === '') return '-';
    if (typeof value === 'number') {
      const digits = Number.isFinite(step.digits) ? step.digits : 3;
      return `${Number.isInteger(value) ? String(value) : Number(value.toFixed(digits)).toString()}${unit}`;
    }
    return `${value}${unit && value !== '-' ? unit : ''}`;
  }

  function buildEquationStepHtml(step = {}, index = 0, options = {}) {
    const context = step.title || step.contextLabel || step.label || step.name || options.titleFallback || 'Calculation Step';
    const reference = step.reference || step.source || step.basis || '';
    const formula = step.formula || step.equation || step.substitution || step.rule || step.description || '';
    const rendered = renderFormulaMarkup(formula, context, { displayMode: true });
    const substitution = step.substitution || step.sample || '';
    const resultText = formatEquationResult(step, options.resultText || '');
    const compactClass = options.compact ? ' academic-equation-step-compact' : '';
    const visibleSourceClass = rendered.mapped ? '' : ' academic-equation-source-visible';
    const parts = [
      `<article class="academic-equation-step${compactClass} formula-defense-equation-step" data-formula-defense-equation="true">`,
      `<div class="academic-equation-title">${index + 1}. ${escapeHtml(context)}</div>`
    ];
    if (reference) parts.push(`<div class="academic-equation-reference">${escapeHtml(reference)}</div>`);
    parts.push(
      '<div class="academic-equation-display formula-defense-equation-surface">',
      `<div class="academic-equation-math" data-formula-source="${escapeHtml(formula)}" data-equation-renderer="${escapeHtml(rendered.renderer)}">${rendered.html}</div>`,
      rendered.mapped ? '' : `<div class="academic-equation-source${visibleSourceClass}">${escapeHtml(formula || '-')}</div>`,
      '</div>'
    );
    if (substitution) parts.push(`<div class="academic-equation-substitution">${escapeHtml(substitution)}</div>`);
    parts.push(`<strong class="academic-equation-result">${escapeHtml(resultText)}</strong>`);
    parts.push('</article>');
    return parts.join('');
  }

  function patchAcademicRenderer() {
    if (rendererPatched) return;
    rendererPatched = true;

    const originalFormula = root.renderAcademicFormulaMarkup;
    root.renderAcademicFormulaMarkup = function formulaDefenseRenderAcademicFormulaMarkup(formula, context, options) {
      const rendered = renderFormulaMarkup(formula, context, options);
      if (rendered.renderer === 'fallback' && typeof originalFormula === 'function') {
        const fallback = originalFormula.call(this, formula, context, options);
        if (fallback?.html) {
          fallback.html = `<span class="formula-defense-fallback-equation" data-equation-renderer="fallback">${fallback.html}</span>`;
          fallback.renderer = 'fallback';
          fallback.tex = rendered.tex;
          return fallback;
        }
      }
      return rendered;
    };
    root.renderAcademicFormulaMarkup.__formulaDefenseUiPatched = true;
    root.renderAcademicFormulaMarkup.__formulaDefenseUiOriginal = originalFormula || null;

    const originalStepHtml = root.renderAcademicEquationStepHtml;
    root.renderAcademicEquationStepHtml = function formulaDefenseRenderAcademicEquationStepHtml(step, index = 0, options = {}) {
      try {
        return buildEquationStepHtml(step, index, options);
      } catch (error) {
        return typeof originalStepHtml === 'function' ? originalStepHtml.call(this, step, index, options) : '';
      }
    };
    root.renderAcademicEquationStepHtml.__formulaDefenseUiPatched = true;
    root.renderAcademicEquationStepHtml.__formulaDefenseUiOriginal = originalStepHtml || null;

    const originalCreateStep = root.createAcademicEquationStepElement;
    root.createAcademicEquationStepElement = function formulaDefenseCreateAcademicEquationStepElement(step, index = 0, options = {}) {
      if (!hasDocument()) {
        return typeof originalCreateStep === 'function' ? originalCreateStep.call(this, step, index, options) : null;
      }
      const template = document.createElement('template');
      template.innerHTML = buildEquationStepHtml(step, index, options);
      return template.content.firstElementChild;
    };
    root.createAcademicEquationStepElement.__formulaDefenseUiPatched = true;
    root.createAcademicEquationStepElement.__formulaDefenseUiOriginal = originalCreateStep || null;
  }

  function sourceFromFormulaNode(node) {
    const source = node.dataset?.formulaSource || node.dataset?.rawFormula || node.getAttribute?.('data-formula-source');
    if (source) return normalizeFormulaText(source);
    const text = normalizeFormulaText(node.textContent);
    node.dataset.formulaSource = text;
    return text;
  }

  function ensureNodeContrast(node) {
    if (!node?.classList) return;
    node.dataset.formulaContrast = 'aa';
    if (node.matches('.academic-equation-display, code')) node.classList.add('formula-defense-equation-surface');
    const container = node.closest?.('.academic-equation-display, .formula-defense-equation-surface, .pump-curve-formula-card code, .pipe-trace-table code, .pipe-formula-defense-layout code') || node;
    container.dataset.formulaContrast = 'aa';
  }

  function scopedMatches(scope, selector) {
    if (!scope?.querySelectorAll) return [];
    const matches = [...scope.querySelectorAll(selector)];
    if (scope.matches?.(selector)) matches.unshift(scope);
    return matches;
  }

  function enhanceFormulaNode(node) {
    if (!node || node.dataset?.formulaDefenseEnhanced === 'true') {
      ensureNodeContrast(node);
      return;
    }
    const raw = sourceFromFormulaNode(node);
    if (!raw || raw.length > 600) {
      ensureNodeContrast(node);
      return;
    }
    const rendered = renderFormulaMarkup(raw, node.dataset?.formulaContext || '');
    node.dataset.formulaDefenseEnhanced = 'true';
    node.dataset.equationRenderer = rendered.renderer;
    node.dataset.formulaTex = rendered.tex || '';
    node.dataset.formulaSource = raw;
    node.innerHTML = rendered.html;
    node.classList.add('formula-defense-inline-equation');
    ensureNodeContrast(node);
  }

  function enhanceFormulaNodes(scope = document) {
    if (!scope?.querySelectorAll) return;
    scope.querySelectorAll(FORMULA_SELECTOR).forEach(enhanceFormulaNode);
  }

  function enhancePipeFormulaDefenseLayout(scope = document) {
    if (!scope?.querySelectorAll) return;
    scopedMatches(scope, '.pipe-formula-defense-task-window').forEach((windowNode) => {
      windowNode.dataset.pipeFormulaDefenseLayout = 'compact-v2';
      const body = windowNode.querySelector('.pipe-formula-defense-body, .task-window-body');
      body?.classList.add('pipe-formula-defense-compact-body');
    });
    scopedMatches(scope, '.pipe-formula-defense-layout').forEach((layout) => {
      layout.dataset.pipeFormulaDefenseLayout = 'compact-v2';
    });
  }

  function restorePipeSourceMapFormulaCells(scope = document) {
    if (!scope?.querySelectorAll || !hasDocument()) return;
    scopedMatches(scope, '.pipe-formula-defense-source-table td.academic-inline-formula, .pipe-formula-defense-source-table td.formula-defense-inline-equation').forEach((cell) => {
      const source = normalizeFormulaText(cell.dataset?.formulaSource || cell.getAttribute('title') || cell.textContent || '');
      if (!source) return;
      cell.dataset.formulaSource = source;
      cell.dataset.formulaDefensePlain = 'true';
      cell.classList.remove('academic-inline-formula', 'formula-defense-inline-equation');
      cell.classList.add('pipe-source-map-formula-cell');
      cell.textContent = '';
      const code = document.createElement('code');
      code.textContent = source;
      cell.appendChild(code);
      ensureNodeContrast(code);
    });
  }

  function ensureTableDataLabels(table) {
    if (!table?.querySelectorAll) return;
    const labels = [...table.querySelectorAll('thead th')].map((cell) => normalizeFormulaText(cell.textContent));
    if (!labels.length) return;
    table.querySelectorAll('tbody tr').forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (cell?.tagName === 'TD' && !cell.dataset.label) {
          cell.dataset.label = labels[index] || '';
        }
      });
    });
  }

  function enhanceTables(scope = document) {
    if (!scope?.querySelectorAll) return;
    const pipeFormulaTables = [
      '.pipe-formula-defense-layout .fluid-formula-defense-table',
      '.pipe-formula-defense-layout .pump-curve-explanation-table',
      '.pipe-formula-defense-source-table',
      '.pipe-formula-defense-fitting-breakdown-table'
    ].join(',');
    scopedMatches(scope, pipeFormulaTables).forEach((table) => {
      table.dataset.formulaDefenseResponsive = 'true';
      const wrapper = table.closest('.pump-curve-explanation-table-wrap, .pipe-formula-defense-fitting-breakdown-wrap, .fluid-formula-defense-table-wrap');
      wrapper?.classList.add('formula-defense-responsive-table-wrap');
      ensureTableDataLabels(table);
      if (table.classList.contains('pipe-formula-defense-role-path-table') || table.classList.contains('pipe-formula-defense-fitting-breakdown-table')) {
        wrapper?.classList.add('pipe-formula-defense-target-table-wrap');
        wrapper?.classList.toggle('pipe-formula-defense-role-path-wrap', table.classList.contains('pipe-formula-defense-role-path-table'));
        wrapper?.classList.toggle('pipe-formula-defense-fitting-breakdown-wrap', table.classList.contains('pipe-formula-defense-fitting-breakdown-table'));
      }
      table.querySelectorAll('td[colspan]').forEach((cell) => {
        if (/no .*breakdown|no fittings|not available/i.test(cell.textContent || '')) {
          cell.classList.add('formula-defense-empty-state');
          cell.textContent = cell.textContent || 'No pipe/fitting/valve breakdown is available for the current route.';
        }
      });
      table.querySelectorAll('code, .academic-inline-formula, .academic-equation-math').forEach(ensureNodeContrast);
    });
    restorePipeSourceMapFormulaCells(scope);
  }

  function describeChangedInput(target) {
    if (!target) return lastChangedInput || 'Current input change';
    const labels = [];
    const id = target.id;
    if (id && hasDocument()) {
      const escapeSelector = root.CSS?.escape || ((value) => String(value).replace(/["\\]/g, '\\$&'));
      const label = document.querySelector(`label[for="${escapeSelector(id)}"]`);
      if (label?.textContent) labels.push(label.textContent);
    }
    const aria = target.getAttribute?.('aria-label') || target.getAttribute?.('title');
    const name = target.name || target.dataset?.field || target.dataset?.property || target.dataset?.prop;
    [aria, name, id].forEach((value) => {
      if (value && !labels.includes(value)) labels.push(value);
    });
    const holder = target.closest?.('[data-task-node-id], [data-node-id], [data-node]');
    const nodeId = holder?.dataset?.taskNodeId || holder?.dataset?.nodeId || holder?.dataset?.node;
    const value = target.value !== undefined ? ` = ${target.value}` : '';
    return `${nodeId ? `${nodeId}: ` : ''}${labels[0] || target.tagName || 'Input'}${value}`;
  }

  function dependencyChainForInput(description) {
    const lower = String(description || '').toLowerCase();
    if (/diam|pipe|fitting|valve|segment|rough|length|k\b/.test(lower)) {
      return {
        affected: 'Route Velocity, Reynolds Number, Friction Factor, Major Loss, Minor Loss',
        recalculated: 'Route Loss, System Head, Pump Duty, Trace Tables',
        final: 'TDH and pump operating status'
      };
    }
    if (/flow|q\b|rate/.test(lower)) {
      return {
        affected: 'Velocity, Reynolds Number, Friction Factor, NPSHR lookup',
        recalculated: 'Major Loss, Minor Loss, TDH, NPSH Margin',
        final: 'Pump Duty and cavitation risk'
      };
    }
    if (/pressure|elev|source|sink/.test(lower)) {
      return {
        affected: 'Static Head, Boundary Head, Route Loss dependency fingerprint',
        recalculated: 'System Head, NPSHA context, Pump Duty',
        final: 'Operating Point and risk status'
      };
    }
    return {
      affected: 'Velocity, Reynolds Number, Friction Factor, Route Losses',
      recalculated: 'TDH, Pump Duty, NPSH Margin, traceability records',
      final: 'Calculation status and engineering warnings'
    };
  }

  function renderDependencyVisualization(description) {
    const chain = dependencyChainForInput(description);
    const nodes = [
      ['Changed Input', description || 'Current input change'],
      ['Affected Variables', chain.affected],
      ['Recalculated Variables', chain.recalculated],
      ['Final Result', chain.final]
    ];
    return `<div class="formula-dependency-visualization" data-formula-dependency-graph="true">${nodes.map(([title, body]) => (
      `<div class="formula-dependency-node"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span></div>`
    )).join('')}</div>`;
  }

  function enhanceDependencyPanels(scope = document) {
    if (!scope?.querySelectorAll) return;
    scope.querySelectorAll(DEFENSE_WINDOW_SELECTOR).forEach((windowNode) => {
      const headings = [...windowNode.querySelectorAll('h2,h3,h4,strong,summary')]
        .filter((heading) => /dependency chain|calculation traceability|input .* process .* output/i.test(heading.textContent || ''));
      const heading = headings[0];
      if (!heading) return;
      const card = heading.closest('section, article, details, .fluid-help-card, .pipe-trace-block, .pump-curve-explanation-card, div') || windowNode;
      if (card.querySelector('.formula-dependency-visualization')) return;
      const template = document.createElement('template');
      template.innerHTML = renderDependencyVisualization(lastChangedInput || 'Current formula-defense context');
      heading.insertAdjacentElement('afterend', template.content.firstElementChild);
    });
  }

  function setCalculationUiState(state = 'Current', reason = '') {
    if (!hasDocument()) return;
    document.querySelectorAll(DEFENSE_WINDOW_SELECTOR).forEach((windowNode) => {
      let banner = windowNode.querySelector('.formula-defense-calculation-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'formula-defense-calculation-banner';
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        const body = windowNode.querySelector('.fluid-formula-defense-body, .pipe-formula-defense-body, .pump-formula-defense-body, .source-formula-defense-body') || windowNode;
        body.prepend(banner);
      }
      banner.dataset.state = state;
      const label = state === 'Calculating' ? 'Calculating' : state === 'Stale' ? 'Stale' : 'Current';
      banner.innerHTML = `<span>${escapeHtml(label)} calculation${reason ? ` - ${escapeHtml(reason)}` : ''}</span>${state === 'Calculating' ? '<span class="formula-defense-loading-dot" aria-hidden="true"></span>' : ''}`;
    });
  }

  function syncRealtimeState() {
    const state = root.__engineeringCalculationDefenseRealtimeState;
    if (!state?.status) return;
    if (/calculating/i.test(state.status)) setCalculationUiState('Calculating', state.reason || 'backend refresh in progress');
    else if (/stale/i.test(state.status)) setCalculationUiState('Stale', state.reason || 'input changed');
    else if (/current/i.test(state.status)) setCalculationUiState('Current', state.calculationId ? `calculationId ${state.calculationId}` : 'backend current');
  }

  function runtimeModel() {
    try {
      if (typeof globalModel !== 'undefined' && globalModel) return globalModel;
    } catch (error) {
      // Protected builds may not expose globalModel as a direct binding.
    }
    return root.globalModel || root.__npshGlobalModel || {};
  }

  function runtimeConnections() {
    try {
      if (typeof connections !== 'undefined' && Array.isArray(connections)) return connections;
    } catch (error) {
      // Protected builds may not expose connections as a direct binding.
    }
    return Array.isArray(root.connections) ? root.connections : [];
  }

  function finiteNumber(value, fallback = null) {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function roundPipeTraceNumber(value, digits = 4) {
    const numeric = finiteNumber(value);
    return numeric === null ? null : Number(numeric.toFixed(digits));
  }

  function formatPipeTraceNumber(value, digits = 4) {
    const numeric = finiteNumber(value);
    if (numeric === null) return '-';
    const absolute = Math.abs(numeric);
    if (absolute >= 10000 || (absolute > 0 && absolute < 0.0001)) return numeric.toExponential(4);
    return Number(numeric.toFixed(digits)).toString();
  }

  function getPipeTraceFluidProps(fluidInput = null) {
    const model = runtimeModel();
    const props = fluidInput || model?.FLUID?.props || {};
    return {
      density: finiteNumber(props.density, 1000),
      viscosityCSt: finiteNumber(props.viscosity, finiteNumber(props.kinematicViscosity, 1)),
      vaporPressureBarA: finiteNumber(props.vaporPressure, 0)
    };
  }

  function getPipeRoughnessAgingFactor(props = {}) {
    return Math.max(0, finiteNumber(props.roughnessAgingFactor, 1));
  }

  function createPipeTraceStep(title, formula, substitution, result, unit = '', reference = '') {
    return {
      title,
      formula,
      substitution,
      result: roundPipeTraceNumber(result, 6),
      unit,
      reference
    };
  }

  function getPipeFrictionFactorFormula(segment = {}) {
    const regime = segment.flowRegime || '';
    if (regime === 'Laminar') return 'f = 64 / Re';
    if (regime === 'Transitional') return 'f = blend(64/Re, Colebrook f) between Re 2300 and 4000';
    if (regime === 'Turbulent') return '1/sqrt(f) = -2 log10(eps/(3.7D) + 2.51/(Re sqrt(f)))';
    return 'f = Darcy friction factor from Reynolds number and eps/D';
  }

  function pipeFormulaDefenseStep(segment = {}, title) {
    const match = String(title || '').toLowerCase();
    return [...(segment.steps || []), ...(segment.pressureSteps || [])]
      .find((step) => String(step.title || '').toLowerCase() === match) || null;
  }

  function buildPipeFormulaDefenseRows(trace) {
    if (!trace) return [];
    const basis = trace.basis || {};
    const totals = trace.totals || {};
    const firstSegment = (trace.segments || [])[0] || {};
    const steps = [...(firstSegment.steps || []), ...(firstSegment.pressureSteps || [])];
    const stepByTitle = (title) => steps.find((step) => step.title === title) || {};
    const profile = firstSegment.profile || {};
    const formatStep = (step) => (step && step.result !== null && step.result !== undefined)
      ? `${formatPipeTraceNumber(step.result, step.unit === '' ? 6 : 4)}${step.unit ? ` ${step.unit}` : ''}`
      : '-';
    const formatLoss = (value) => Number.isFinite(Number.parseFloat(value)) ? `${formatPipeTraceNumber(value)} m` : '-';
    const segmentLossSubstitution = (title, total) => {
      const values = (trace.segments || [])
        .map((segment) => Number.parseFloat(pipeFormulaDefenseStep(segment, title)?.result))
        .filter((value) => Number.isFinite(value));
      return values.length
        ? `${values.map((value) => formatPipeTraceNumber(value)).join(' + ')} = ${formatPipeTraceNumber(total)} m`
        : 'Segment trace is not available until this pipe has solved flow.';
    };
    const hasHighPoint = Number.isFinite(totals.highPointPressure)
      && Number.isFinite(totals.highPointVaporMargin);
    const segmentName = firstSegment.name || 'active pipe segment';
    return [
      {
        step: 'Short Answer for Advisor',
        inputSource: 'Current Pipe Object Properties and solved hydraulic network.',
        formula: 'Darcy-Weisbach major loss + K-method minor loss',
        substitution: 'The pipe uses solved flow, active Fluid Basis, pipe ID, roughness, length, fittings, and elevation profile.',
        result: trace.isSolved ? 'Pipe hydraulic loss trace is available.' : 'Pipe needs solved network flow.',
        literatureBasis: 'Fluid mechanics pipe-flow literature and ANSI/HI NPSH suction-loss context.',
        advisorDefenseNote: 'The pipe model is a steady-state, single-phase, incompressible hydraulic calculation, not a transient/two-phase model.'
      },
      {
        step: 'Flow Conversion',
        inputSource: 'Solved network flow through the solid hydraulic pipe path.',
        formula: 'Q = flow / 3600',
        substitution: `${formatPipeTraceNumber(basis.flowM3H, 6)} / 3600 = ${formatPipeTraceNumber(basis.flowM3S, 8)}`,
        result: `${formatPipeTraceNumber(basis.flowM3S, 8)} m3/s`,
        literatureBasis: 'SI flow-unit conversion before velocity and Reynolds number.',
        advisorDefenseNote: 'All subsequent pipe equations use SI base units.'
      },
      {
        step: 'Pipe Area',
        inputSource: `${segmentName}: pipe size/custom ID source.`,
        formula: stepByTitle('Area').formula || 'A = pi D^2 / 4',
        substitution: stepByTitle('Area').substitution || '-',
        result: formatStep(stepByTitle('Area')),
        literatureBasis: 'Circular pipe geometry.',
        advisorDefenseNote: 'Diameter must follow project piping class or documented custom internal diameter.'
      },
      {
        step: 'Velocity',
        inputSource: 'Converted flow and pipe area.',
        formula: stepByTitle('Velocity').formula || 'V = Q / A',
        substitution: stepByTitle('Velocity').substitution || '-',
        result: formatStep(stepByTitle('Velocity')),
        literatureBasis: 'Continuity equation.',
        advisorDefenseNote: 'Velocity drives dynamic head, Reynolds number, major loss, and minor loss.'
      },
      {
        step: 'Reynolds Number',
        inputSource: 'Velocity, pipe ID, and Fluid Basis kinematic viscosity.',
        formula: stepByTitle('Reynolds Number').formula || 'Re = V D / nu',
        substitution: stepByTitle('Reynolds Number').substitution || '-',
        result: formatStep(stepByTitle('Reynolds Number')),
        literatureBasis: 'Internal-flow regime criterion.',
        advisorDefenseNote: 'Laminar, transitional, or turbulent regime determines how friction factor is defended.'
      },
      {
        step: 'Darcy Friction Factor',
        inputSource: 'Reynolds number plus effective relative roughness.',
        formula: stepByTitle('Darcy Friction Factor').formula || 'f = Darcy friction factor from Re and eps/D',
        substitution: stepByTitle('Darcy Friction Factor').substitution || '-',
        result: formatStep(stepByTitle('Darcy Friction Factor')),
        literatureBasis: 'Laminar f=64/Re; turbulent Colebrook/Moody; transitional warning band.',
        advisorDefenseNote: 'The application reports Darcy f, not Fanning f.'
      },
      {
        step: 'Major Loss',
        inputSource: 'All pipe segments: friction factor, length, diameter, and velocity head.',
        formula: 'h_major,total = sum[f_i x (L_i / D_i) x V_i^2/(2g)]',
        substitution: segmentLossSubstitution('Major Loss', totals.majorLoss),
        result: formatLoss(totals.majorLoss),
        literatureBasis: 'Darcy-Weisbach equation.',
        advisorDefenseNote: 'This total matches Pipe Object Properties > Major Loss; segment-level details remain in All Segment Calculation Trace.'
      },
      {
        step: 'Minor Loss',
        inputSource: 'All pipe segments: fitting/valve K, quantity, and Add K entries.',
        formula: 'h_minor,total = sum(K_total,i x V_i^2/(2g))',
        substitution: segmentLossSubstitution('Minor Loss', totals.minorLoss),
        result: formatLoss(totals.minorLoss),
        literatureBasis: 'K-method for fittings, entrances, exits, reducers, strainers, and valve-like losses.',
        advisorDefenseNote: 'This total matches Pipe Object Properties > Minor Loss; K values are typical/user/vendor data depending on source, and separate Valve Object losses must not be counted again here.'
      },
      {
        step: 'Allowance and Total Loss',
        inputSource: 'Major loss, minor loss, and optional head-loss allowance.',
        formula: 'h_total = h_major + h_minor + h_allow',
        substitution: `${formatPipeTraceNumber(totals.majorLoss)} + ${formatPipeTraceNumber(totals.minorLoss)} + ${formatPipeTraceNumber(totals.allowanceLoss)} = ${formatPipeTraceNumber(totals.totalLoss)} m`,
        result: `${formatPipeTraceNumber(totals.totalLoss)} m`,
        literatureBasis: 'Total line loss used by hydraulic energy balance.',
        advisorDefenseNote: 'Suction-side total loss subtracts from NPSHa; discharge-side total loss increases required pump head/system curve.'
      },
      ...(hasHighPoint ? [{
        step: 'Pressure and High Point Check',
        inputSource: 'Solved pressure profile, elevation profile, and Fluid Basis vapor pressure.',
        formula: 'P_static = rho g (H - z - V^2/2g) / 100000; margin = P_high - P_vapor',
        substitution: `${formatPipeTraceNumber(totals.highPointPressure)} - ${formatPipeTraceNumber(basis.vaporPressureBarA)} = ${formatPipeTraceNumber(totals.highPointVaporMargin)} bar`,
        result: `${formatPipeTraceNumber(totals.highPointVaporMargin)} bar`,
        literatureBasis: 'Energy/head balance and vapor-pressure screening.',
        advisorDefenseNote: 'This is a steady-state vapor-margin screen, not water hammer, flashing, or two-phase transient analysis.'
      }] : []),
      {
        step: 'Endpoint Pressure Elevation Rule',
        inputSource: 'Pipe endpoint elevations, solved hydraulic heads, and velocity heads.',
        formula: 'P_in = rho g(H_in - z_start - V_in^2/2g)/100000; P_out = rho g(H_out - z_end - V_out^2/2g)/100000',
        substitution: Number.isFinite(profile.startElevation) || Number.isFinite(profile.endElevation)
          ? `z_start=${formatPipeTraceNumber(profile.startElevation)} m, z_end=${formatPipeTraceNumber(profile.endElevation)} m, P_in=${formatPipeTraceNumber(profile.startPressure)} bar a, P_out=${formatPipeTraceNumber(profile.endPressure)} bar a`
          : 'Endpoint pressure profile is available after the pipe has solved inlet and outlet head.',
        result: Number.isFinite(profile.endPressure) ? `Outlet pressure follows z_end and solved H_out: ${formatPipeTraceNumber(profile.endPressure)} bar a` : '-',
        literatureBasis: 'Bernoulli equation: static pressure is hydraulic head minus elevation head and velocity head.',
        advisorDefenseNote: 'Changing Start Elevation Override affects inlet/profile pressure. Outlet Pressure changes when End Elevation Override, outlet hydraulic head, flow/velocity, or boundary conditions change.'
      }
    ];
  }

  function classifyPipeSegmentComponent(segment = {}) {
    const text = [segment.name, segment.fittingType, segment.notes].filter(Boolean).join(' ').toLowerCase();
    if (/valve|check/.test(text)) return 'Valve / inline component';
    if (/strainer|orifice|filter/.test(text)) return 'Inline component';
    if (/elbow|bend|tee|reducer|contraction|expansion|entrance|exit|inlet|outlet/.test(text)) return 'Fitting / local loss';
    if (finiteNumber(segment.minorLossK, 0) > 0 && finiteNumber(segment.length, 0) > 0) return 'Pipe + fitting K';
    if (finiteNumber(segment.minorLossK, 0) > 0) return 'Equivalent K / residual';
    return 'Pipe major loss';
  }

  function classifyPipeSegmentSource(segment = {}) {
    const text = [segment.name, segment.fittingType, segment.notes].filter(Boolean).join(' ').toLowerCase();
    if (/calibrat|equivalent|adjusted|derived|matching|residual/.test(text)) {
      return { status: 'Calibrated', source: 'Equivalent K calibrated to literature/design loss', review: 'Verify the calibration basis and duty flow.' };
    }
    if (/journal|published|paper|literature|table\s*\d|case\s*\d/.test(text)) {
      return { status: 'Journal', source: 'Journal / literature value', review: '' };
    }
    if (String(segment.fittingType || '') === 'Custom K' || finiteNumber(segment.additionalK, 0) > 0) {
      return { status: 'User', source: 'User-entered custom K', review: segment.notes ? '' : 'Add a note/source for this custom K value.' };
    }
    if (segment.fittingType && segment.fittingType !== 'None') {
      return { status: 'Typical', source: 'Typical handbook/table K value', review: 'Confirm against project standard or vendor data for final validation.' };
    }
    if (finiteNumber(segment.length, 0) > 0) return { status: 'Geometry', source: 'Pipe geometry, roughness, and Darcy friction', review: '' };
    return { status: 'Input', source: 'Pipe Object Properties input', review: '' };
  }

  function pipeSegmentSourceNote(segment = {}) {
    const source = classifyPipeSegmentSource(segment);
    const note = segment.notes || 'Pipe Object Properties input';
    return `[${source.status}] ${note}${source.review ? ` Review: ${source.review}` : ''}`;
  }

  function firstMeaningfulText(...values) {
    const genericStatus = /^(user|exact|typical|journal|calibrated|geometry|input|standard|estimate)$/i;
    for (const value of values) {
      const text = String(value ?? '').trim().replace(/\s+/g, ' ');
      if (!text || genericStatus.test(text)) continue;
      return text;
    }
    return '';
  }

  function formatPipeBasisCompactNumber(value, digits = 3) {
    const numeric = finiteNumber(value);
    if (numeric === null) return '-';
    const absolute = Math.abs(numeric);
    if (absolute >= 10000 || (absolute > 0 && absolute < 0.0001)) return numeric.toExponential(4);
    return Number(numeric.toFixed(digits)).toString();
  }

  function formatPipeBasisFixedNumber(value, digits = 3) {
    const numeric = finiteNumber(value);
    if (numeric === null) return '-';
    return numeric.toFixed(digits);
  }

  function shortPipeSizeBasisLabel(label) {
    const text = firstMeaningfulText(label) || 'Custom diameter';
    if (/custom\s+diam/i.test(text)) return 'Custom dia';
    return text
      .replace(/\s*-\s*Sch(?:edule)?\s*/i, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function shortPipeMaterialBasisLabel(label) {
    const text = firstMeaningfulText(label) || 'Custom roughness';
    if (/custom\s+rough/i.test(text)) return 'Custom ε';
    return text;
  }

  function shortPipeFittingBasisLabel(label) {
    const text = firstMeaningfulText(label) || 'None';
    if (/^none$/i.test(text)) return 'None';
    if (/^custom\s+k$/i.test(text)) return 'Custom K';
    return text
      .replace(/\s*-\s*fully\s+open\b/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildPipeSegmentBasisSource(source, display) {
    const original = source && typeof source === 'object'
      ? { ...source }
      : { status: firstMeaningfulText(source) || '' };
    return {
      ...original,
      sourceStatus: original.status || '',
      status: display.caption,
      caption: display.caption,
      tooltip: display.tooltip,
      selection: display.selection,
      numericValue: display.numericValue,
      unit: display.unit
    };
  }

  function buildPipeSegmentBasisDisplay(segment = {}, propSegment = {}) {
    const pipeSizeSelection = firstMeaningfulText(
      segment.pipeSize,
      propSegment.pipeSize,
      segment.npsSchedule,
      propSegment.npsSchedule,
      segment.sizeBasis,
      propSegment.sizeBasis,
      segment.sizeSource?.label,
      propSegment.sizeSource?.label
    ) || 'Custom diameter';
    const materialSelection = firstMeaningfulText(
      segment.material,
      propSegment.material,
      segment.materialBasis,
      propSegment.materialBasis,
      segment.materialSource?.label,
      propSegment.materialSource?.label
    ) || 'Custom roughness';
    const fittingSelection = firstMeaningfulText(
      segment.fittingType,
      propSegment.fittingType,
      segment.fittingBasis,
      propSegment.fittingBasis,
      segment.fittingSource?.label,
      propSegment.fittingSource?.label
    ) || 'None';
    const diameter = finiteNumber(segment.diameter, finiteNumber(propSegment.diameter));
    const roughness = finiteNumber(segment.roughness, finiteNumber(propSegment.roughness));
    const fittingK = finiteNumber(segment.fittingK, finiteNumber(propSegment.fittingK, 0)) || 0;
    const totalK = finiteNumber(segment.minorLossK, finiteNumber(segment.fittingTotalK, finiteNumber(propSegment.fittingTotalK, fittingK))) || 0;
    const quantity = finiteNumber(segment.fittingQuantity, finiteNumber(propSegment.fittingQuantity, /^none$/i.test(fittingSelection) ? 0 : 1)) || 0;
    const diameterMm = diameter === null ? null : diameter * 1000;
    const roughnessMm = roughness === null ? null : roughness * 1000;
    const pipeSizeLabel = shortPipeSizeBasisLabel(pipeSizeSelection);
    const materialLabel = shortPipeMaterialBasisLabel(materialSelection);
    const fittingLabel = shortPipeFittingBasisLabel(fittingSelection);
    const pipeSizeValue = `${formatPipeBasisCompactNumber(diameterMm)} mm`;
    const roughnessValue = `${materialLabel.includes('ε') ? '' : 'ε '}${formatPipeBasisFixedNumber(roughnessMm)} mm`;
    const fittingValue = /^custom\s+k$/i.test(fittingLabel)
      ? formatPipeBasisCompactNumber(fittingK)
      : `K ${formatPipeBasisCompactNumber(fittingK)}`;
    return {
      size: {
        caption: `${pipeSizeLabel} · ${pipeSizeValue}`,
        tooltip: `Selected NPS / Schedule: ${pipeSizeSelection}; internal diameter = ${formatPipeBasisFixedNumber(diameterMm)} mm.`,
        selection: pipeSizeSelection,
        numericValue: diameter,
        unit: 'm'
      },
      material: {
        caption: `${materialLabel} · ${roughnessValue}`,
        tooltip: `Selected material: ${materialSelection}; roughness ε = ${formatPipeBasisFixedNumber(roughnessMm)} mm.`,
        selection: materialSelection,
        numericValue: roughness,
        unit: 'm'
      },
      fitting: {
        caption: `${fittingLabel} · ${fittingValue}`,
        tooltip: `Selected fitting: ${fittingSelection}; K each = ${formatPipeBasisCompactNumber(fittingK, 4)}; qty = ${formatPipeBasisCompactNumber(quantity, 4)}; total K = ${formatPipeBasisCompactNumber(totalK, 4)}.`,
        selection: fittingSelection,
        numericValue: totalK,
        unit: ''
      }
    };
  }

  function buildPipeFittingValveBreakdown(segments = []) {
    return segments.map((segment) => {
      const source = classifyPipeSegmentSource(segment);
      return {
        index: segment.index,
        name: segment.name || `Segment ${(segment.index ?? 0) + 1}`,
        componentType: classifyPipeSegmentComponent(segment),
        fittingType: segment.fittingType || 'None',
        quantity: roundPipeTraceNumber(segment.fittingQuantity, 4),
        kEach: roundPipeTraceNumber(segment.fittingK, 6),
        fittingTotalK: roundPipeTraceNumber(segment.fittingTotalK, 6),
        additionalK: roundPipeTraceNumber(segment.additionalK, 6),
        totalK: roundPipeTraceNumber(segment.minorLossK, 6),
        majorLoss: roundPipeTraceNumber(segment.majorLoss, 6),
        fittingLoss: roundPipeTraceNumber(segment.fittingLoss, 6),
        additionalLoss: roundPipeTraceNumber(segment.additionalLoss, 6),
        minorLoss: roundPipeTraceNumber(segment.minorLoss, 6),
        allowanceLoss: roundPipeTraceNumber(segment.allowanceLoss, 6),
        totalLoss: roundPipeTraceNumber(segment.totalLoss, 6),
        dataBasis: source.source,
        sourceCategory: source.status,
        sourceReview: source.review,
        sourceNote: pipeSegmentSourceNote(segment)
      };
    });
  }

  function buildPipeMoodyTrace(segments = []) {
    const markers = segments
      .filter((segment) => finiteNumber(segment.reynolds, 0) > 0 && finiteNumber(segment.frictionFactor, 0) > 0)
      .map((segment) => ({
        index: segment.index,
        name: segment.name || `Segment ${segment.index + 1}`,
        reynolds: roundPipeTraceNumber(segment.reynolds, 0),
        frictionFactor: roundPipeTraceNumber(segment.frictionFactor, 6),
        relRoughness: roundPipeTraceNumber(segment.diameter > 0 ? segment.effectiveRoughness / segment.diameter : 0, 8),
        flowRegime: segment.flowRegime,
        diameter: roundPipeTraceNumber(segment.diameter, 6),
        effectiveRoughness: roundPipeTraceNumber(segment.effectiveRoughness, 10)
      }));
    return {
      markers,
      isSolved: markers.length > 0,
      note: 'Darcy friction factor chart. Fanning friction factor equals Darcy f / 4.'
    };
  }

  function getPipeTracePumpPathRole(pipeId, results = {}) {
    if (typeof root.getPipePumpPathRole === 'function') {
      try {
        const role = root.getPipePumpPathRole(pipeId, runtimeModel(), runtimeConnections(), results);
        if (role) return role;
      } catch (error) {
        // Fall back to existing trace role below.
      }
    }
    return results?.calculationTrace?.pumpPathRole || { role: '-', impact: '-' };
  }

  function getSegmentProfiles(results = {}) {
    return new Map((results.segmentProfiles || []).map((profile) => [profile.index, profile]));
  }

  function buildPipeSourceMap(trace, context = {}) {
    const api = root.EngineeringPipeSourceConfidenceMapRuntime;
    if (typeof api?.buildPipeSourceConfidenceMap === 'function') {
      try {
        return api.buildPipeSourceConfidenceMap({ ...context, trace });
      } catch (error) {
        return trace?.sourceMap || [];
      }
    }
    return trace?.sourceMap || [];
  }

  function buildAcademicPipeCalculationTrace(flow, props = {}, results = {}, fluid = null, pipeId = '', baseTrace = null) {
    if (typeof root.normalizePipeProps === 'function') {
      try {
        root.normalizePipeProps(props, pipeId);
      } catch (error) {
        // Normalization is best-effort; calculation helpers may already handle props.
      }
    }
    const flowM3H = Math.max(0, finiteNumber(flow, finiteNumber(results?.flow, finiteNumber(baseTrace?.basis?.flowM3H, 0))) || 0);
    const flowM3S = flowM3H / 3600;
    const fluidProps = getPipeTraceFluidProps(fluid);
    const nuM2S = 1e-6 * Math.max(fluidProps.viscosityCSt, 0.000001);
    const agingFactor = getPipeRoughnessAgingFactor(props);
    const allowancePercent = Math.max(0, finiteNumber(props.headLossAllowancePercent, baseTrace?.basis?.headLossAllowancePercent ?? 0) || 0);
    const allowanceFraction = allowancePercent / 100;
    const rawSegments = typeof root.calculatePipeHydraulicSegments === 'function'
      ? root.calculatePipeHydraulicSegments(flowM3H, props, fluid, pipeId)
      : [];
    const segments = Array.isArray(rawSegments) ? rawSegments : [];
    const profileMap = getSegmentProfiles(results);
    const pumpPathRole = getPipeTracePumpPathRole(pipeId, results);
    const totals = segments.reduce((sum, segment) => {
      sum.majorLoss += segment.majorLoss || 0;
      sum.minorLoss += segment.minorLoss || 0;
      sum.allowanceLoss += segment.allowanceLoss || 0;
      sum.totalLoss += segment.totalLoss || 0;
      sum.totalK += segment.minorLossK || 0;
      return sum;
    }, { majorLoss: 0, minorLoss: 0, allowanceLoss: 0, totalLoss: 0, totalK: 0 });
    const propSegments = Array.isArray(props?.segments) ? props.segments : [];
    const traceSegments = segments.map((segment, segmentIndex) => {
      const propSegmentIndex = finiteNumber(segment.index, segmentIndex);
      const propSegment = propSegments[propSegmentIndex] || {};
      const basisDisplay = buildPipeSegmentBasisDisplay(segment, propSegment);
      const profile = profileMap.get(segment.index) || {};
      const area = Math.PI * Math.pow(segment.diameter, 2) / 4;
      const relativeRoughness = segment.diameter > 0 ? segment.effectiveRoughness / segment.diameter : 0;
      const velocityHead = Math.pow(segment.velocity, 2) / 19.62;
      const steps = [
        createPipeTraceStep('Area', 'A = pi x D^2 / 4', `pi x ${formatPipeTraceNumber(segment.diameter)}^2 / 4 = ${formatPipeTraceNumber(area)} m2`, area, 'm2', 'Circular pipe cross-sectional area'),
        createPipeTraceStep('Velocity', 'V = Q / A', `${formatPipeTraceNumber(flowM3S, 6)} / ${formatPipeTraceNumber(area, 6)} = ${formatPipeTraceNumber(segment.velocity)} m/s`, segment.velocity, 'm/s', 'Average pipe velocity'),
        createPipeTraceStep('Reynolds Number', 'Re = V x D / nu', `${formatPipeTraceNumber(segment.velocity)} x ${formatPipeTraceNumber(segment.diameter)} / ${formatPipeTraceNumber(nuM2S, 8)} = ${formatPipeTraceNumber(segment.reynolds, 0)}`, segment.reynolds, '', 'Pipe flow regime basis'),
        createPipeTraceStep('Effective Roughness', 'eps_eff = eps x aging factor', `${formatPipeTraceNumber(segment.roughness, 8)} x ${formatPipeTraceNumber(agingFactor)} = ${formatPipeTraceNumber(segment.effectiveRoughness, 8)} m`, segment.effectiveRoughness, 'm', 'Aging/degradation screening'),
        createPipeTraceStep('Relative Roughness', 'eps_eff / D', `${formatPipeTraceNumber(segment.effectiveRoughness, 8)} / ${formatPipeTraceNumber(segment.diameter)} = ${formatPipeTraceNumber(relativeRoughness, 6)}`, relativeRoughness, '', 'Moody/Colebrook roughness input'),
        createPipeTraceStep('Darcy Friction Factor', getPipeFrictionFactorFormula(segment), `Re = ${formatPipeTraceNumber(segment.reynolds, 0)}; eps/D = ${formatPipeTraceNumber(relativeRoughness, 6)}; regime = ${segment.flowRegime || '-'}; f = ${formatPipeTraceNumber(segment.frictionFactor, 6)}`, segment.frictionFactor, '', 'Darcy f from laminar equation, Colebrook/Moody turbulent basis, or transitional blend warning'),
        createPipeTraceStep('Velocity Head', 'hv = V^2 / (2g)', `${formatPipeTraceNumber(segment.velocity)}^2 / (2 x ${formatPipeTraceNumber(9.81)}) = ${formatPipeTraceNumber(velocityHead)} m`, velocityHead, 'm', 'Dynamic head term'),
        createPipeTraceStep('Major Loss', 'h_major = f x (L / D) x hv', `${formatPipeTraceNumber(segment.frictionFactor, 6)} x (${formatPipeTraceNumber(segment.length)} / ${formatPipeTraceNumber(segment.diameter)}) x ${formatPipeTraceNumber(velocityHead)} = ${formatPipeTraceNumber(segment.majorLoss)} m`, segment.majorLoss, 'm', 'Darcy-Weisbach pipe friction'),
        createPipeTraceStep('Minor Loss', 'h_minor = K_total x hv', `${formatPipeTraceNumber(segment.minorLossK)} x ${formatPipeTraceNumber(velocityHead)} = ${formatPipeTraceNumber(segment.minorLoss)} m`, segment.minorLoss, 'm', 'Fitting and additional K loss'),
        createPipeTraceStep('Allowance Loss', 'h_allow = (h_major + h_minor) x allowance', `(${formatPipeTraceNumber(segment.majorLoss)} + ${formatPipeTraceNumber(segment.minorLoss)}) x ${formatPipeTraceNumber(allowanceFraction, 4)} = ${formatPipeTraceNumber(segment.allowanceLoss)} m`, segment.allowanceLoss, 'm', 'Fouling/design allowance'),
        createPipeTraceStep('Segment Total Loss', 'h_total = h_major + h_minor + h_allow', `${formatPipeTraceNumber(segment.majorLoss)} + ${formatPipeTraceNumber(segment.minorLoss)} + ${formatPipeTraceNumber(segment.allowanceLoss)} = ${formatPipeTraceNumber(segment.totalLoss)} m`, segment.totalLoss, 'm', 'Segment loss contribution')
      ];
      const pressureSteps = [];
      if (Number.isFinite(profile.startPressure)) {
        pressureSteps.push(createPipeTraceStep('Segment Inlet Pressure', 'P_in = rho x g x (H_in - z_in - hv) / 100000', `${formatPipeTraceNumber(profile.startPressure)} bar a`, profile.startPressure, 'bar a', 'Static pressure from hydraulic head'));
      }
      if (Number.isFinite(profile.endPressure)) {
        pressureSteps.push(createPipeTraceStep('Segment Outlet Pressure', 'P_out = rho x g x (H_out - z_out - hv) / 100000', `${formatPipeTraceNumber(profile.endPressure)} bar a`, profile.endPressure, 'bar a', 'Static pressure after segment loss'));
      }
      if (Number.isFinite(profile.highPointPressure)) {
        pressureSteps.push(createPipeTraceStep('High Point Vapor Margin', 'Margin = P_high_point - P_vapor', `${formatPipeTraceNumber(profile.highPointPressure)} - ${formatPipeTraceNumber(fluidProps.vaporPressureBarA)} = ${formatPipeTraceNumber(profile.highPointVaporMargin)} bar`, profile.highPointVaporMargin, 'bar', 'High point cavitation screening'));
      }
      return {
        index: segment.index,
        name: segment.name || `Segment ${segment.index + 1}`,
        componentType: classifyPipeSegmentComponent(segment),
        fittingType: segment.fittingType,
        fittingQuantity: roundPipeTraceNumber(segment.fittingQuantity, 4),
        kEach: roundPipeTraceNumber(segment.fittingK, 6),
        totalK: roundPipeTraceNumber(segment.minorLossK, 6),
        sourceCategory: classifyPipeSegmentSource(segment).status,
        sourceNote: pipeSegmentSourceNote(segment),
        notes: segment.notes || '',
        flowRegime: segment.flowRegime,
        warning: segment.regimeWarning,
        dataSources: {
          size: buildPipeSegmentBasisSource(segment.sizeSource || propSegment.sizeSource, basisDisplay.size),
          material: buildPipeSegmentBasisSource(segment.materialSource || propSegment.materialSource, basisDisplay.material),
          fitting: buildPipeSegmentBasisSource(segment.fittingSource || propSegment.fittingSource, basisDisplay.fitting)
        },
        basisDisplay,
        profile,
        steps,
        pressureSteps
      };
    });
    const trace = {
      ...(baseTrace && typeof baseTrace === 'object' ? baseTrace : {}),
      isSolved: flowM3H > 0 && segments.length > 0,
      message: flowM3H > 0 && segments.length > 0
        ? 'Pipe calculation trace is based on the current solved hydraulic flow.'
        : 'Pipe calculation trace needs solved pipe flow. Connect the pipe in a hydraulic path and run the simulation.',
      basis: {
        ...(baseTrace?.basis || {}),
        flowM3H: roundPipeTraceNumber(flowM3H, 6),
        flowM3S: roundPipeTraceNumber(flowM3S, 8),
        density: roundPipeTraceNumber(fluidProps.density, 4),
        viscosityCSt: roundPipeTraceNumber(fluidProps.viscosityCSt, 6),
        kinematicViscosityM2S: roundPipeTraceNumber(nuM2S, 10),
        vaporPressureBarA: roundPipeTraceNumber(fluidProps.vaporPressureBarA, 6),
        roughnessAgingFactor: roundPipeTraceNumber(agingFactor, 4),
        headLossAllowancePercent: roundPipeTraceNumber(allowancePercent, 4),
        elevationProfileMode: props.elevationProfileMode || 'End Elevations'
      },
      totals: {
        ...(baseTrace?.totals || {}),
        majorLoss: roundPipeTraceNumber(totals.majorLoss, 6),
        minorLoss: roundPipeTraceNumber(totals.minorLoss, 6),
        allowanceLoss: roundPipeTraceNumber(totals.allowanceLoss, 6),
        totalLoss: roundPipeTraceNumber(totals.totalLoss, 6),
        totalK: roundPipeTraceNumber(totals.totalK, 6),
        controllingHighPointSegment: results?.highPointSegment || baseTrace?.totals?.controllingHighPointSegment || '',
        highPointPressure: results?.highPointPressure ?? baseTrace?.totals?.highPointPressure ?? null,
        highPointVaporMargin: results?.highPointVaporMargin ?? baseTrace?.totals?.highPointVaporMargin ?? null
      },
      moody: baseTrace?.moody || buildPipeMoodyTrace(segments),
      segments: traceSegments,
      fittingValveBreakdown: buildPipeFittingValveBreakdown(segments),
      pumpPathRole,
      dependencyChain: [
        'Connected hydraulic path provides the solved flow for each pipe segment.',
        'Pipe geometry and flow determine cross-sectional area, velocity, and velocity head.',
        'Fluid basis and pipe geometry determine Reynolds number and flow regime.',
        'Pipe roughness and flow regime determine friction factor.',
        'Pipe length and friction factor determine major loss.',
        'Fittings, valves, strainers, and custom K values determine minor loss.',
        'Major and minor losses are combined into segment loss.',
        'Segment losses are summed into total pipe/path loss.',
        'Suction path loss affects pump suction pressure and NPSHa.',
        'Discharge path loss affects required system head and downstream pressure.'
      ],
      warnings: [...new Set([...(results?.warnings || []), ...traceSegments.map((segment) => segment.warning).filter(Boolean)])],
      references: baseTrace?.references || [
        'Fluid mechanics internal pipe flow, Reynolds number, Darcy-Weisbach loss, Moody/Colebrook friction, and minor-loss coefficients.',
        'Steady-flow energy equation, pipe friction, and head-loss terms.',
        'ANSI/HI NPSH suction-line loss and NPSHa margin context.'
      ],
      notes: baseTrace?.notes || [
        'Friction factor shown is Darcy f, not Fanning f.',
        'Fluid viscosity basis is kinematic viscosity in cSt.',
        'Pipe size, roughness, and fitting K defaults are reference/typical engineering values unless marked User or Estimate.'
      ],
      engineeringLimitations: baseTrace?.engineeringLimitations || [
        'Pressure used for NPSH and vapor-pressure checks must be absolute pressure (bar a). Gauge inputs must be converted at the boundary.',
        'Elevation datum must be consistent between source/sink boundaries, pipe endpoints, high points, and pump nozzles.',
        'Roughness, aging factor, and head-loss allowance are engineering inputs that can materially change the system curve and NPSHa.',
        'Fitting K values can vary by geometry and vendor; typical values are screening inputs until replaced by project/vendor data.',
        'Valve Object losses and valve-like pipe fitting K values should not be counted twice.',
        'Transitional Reynolds-number results are approximate and should be treated as review/warning conditions.',
        'High point vapor margin is a steady-state single-phase screen; it does not model transient, water hammer, flashing, two-phase flow, or gas entrainment.'
      ]
    };
    trace.sourceMap = buildPipeSourceMap(trace, {
      pipeId,
      pipe: runtimeModel()?.[pipeId],
      props,
      results,
      flow: flowM3H,
      fluid
    });
    trace.formulaDefenseRows = buildPipeFormulaDefenseRows(trace);
    return trace;
  }

  function patchPipeFormulaDefenseTraceBuilders() {
    if (pipeTraceBuilderPatched) return false;
    pipeTraceBuilderPatched = true;
    const originalBuildTrace = root.buildPipeCalculationTrace;
    if (typeof originalBuildTrace !== 'function' || !originalBuildTrace.__formulaDefenseAcademicTracePatched) {
      root.buildPipeCalculationTrace = function formulaDefenseBuildPipeCalculationTrace(flow, props = {}, results = {}, fluid = null, pipeId = '', ...rest) {
        let baseTrace = null;
        if (typeof originalBuildTrace === 'function') {
          try {
            baseTrace = originalBuildTrace.call(this, flow, props, results, fluid, pipeId, ...rest);
          } catch (error) {
            baseTrace = results?.calculationTrace || null;
          }
        } else {
          baseTrace = results?.calculationTrace || null;
        }
        return buildAcademicPipeCalculationTrace(flow, props, results, fluid, pipeId, baseTrace);
      };
      root.buildPipeCalculationTrace.__formulaDefenseAcademicTracePatched = true;
      root.buildPipeCalculationTrace.__formulaDefenseAcademicTraceOriginal = originalBuildTrace || null;
    }
    root.buildPipeFormulaDefenseRows = buildPipeFormulaDefenseRows;
    return true;
  }

  function pipeIdFromFormulaDefenseWindow(windowNode) {
    return windowNode?.dataset?.pipeNode
      || windowNode?.dataset?.nodeId
      || windowNode?.dataset?.taskNodeId
      || windowNode?.querySelector?.('[data-pipe-node]')?.dataset?.pipeNode
      || '';
  }

  function pipeTraceForFormulaDefenseWindow(windowNode) {
    const pipeId = pipeIdFromFormulaDefenseWindow(windowNode);
    const pipe = pipeId ? runtimeModel()?.[pipeId] : null;
    if (!pipe || pipe.type !== 'pipe') return null;
    const results = pipe.results || {};
    const flow = finiteNumber(
      results.flow,
      finiteNumber(results.calculationTrace?.basis?.flowM3H, finiteNumber(results.calculationTrace?.basis?.flow, 0))
    );
    try {
      if (typeof root.buildPipeCalculationTrace === 'function') {
        return root.buildPipeCalculationTrace(flow, pipe.props || {}, results, null, pipeId);
      }
    } catch (error) {
      // Fall back to any existing trace snapshot below.
    }
    return results.calculationTrace || null;
  }

  function applyPipeSegmentBasisTooltips(scope = document) {
    if (!hasDocument()) return 0;
    let updated = 0;
    const windows = scope?.matches?.('.pipe-formula-defense-task-window')
      ? [scope]
      : [...(scope?.querySelectorAll?.('.pipe-formula-defense-task-window') || [])];
    windows.forEach((windowNode) => {
      const trace = pipeTraceForFormulaDefenseWindow(windowNode);
      const segments = trace?.segments || [];
      if (!segments.length) return;
      windowNode.querySelectorAll('.pipe-formula-defense-segment-card').forEach((card, index) => {
        const dataSources = segments[index]?.dataSources || {};
        const entries = [
          ['Pipe size basis', dataSources.size],
          ['Material basis', dataSources.material],
          ['Fitting basis', dataSources.fitting]
        ];
        entries.forEach(([label, source]) => {
          if (!source?.caption && !source?.tooltip) return;
          const metric = [...card.querySelectorAll('.pipe-formula-defense-segment-metric')]
            .find((node) => node.querySelector('span')?.textContent.trim() === label);
          const valueNode = metric?.querySelector('strong');
          if (!metric || !valueNode) return;
          if (source.caption) valueNode.textContent = source.caption;
          if (source.tooltip) {
            metric.title = source.tooltip;
            valueNode.title = source.tooltip;
            metric.dataset.pipeBasisTooltip = 'true';
          }
          updated += 1;
        });
      });
    });
    return updated;
  }

  function scheduleEnhanceDocument(scope = document, options = {}) {
    if (!hasDocument()) return false;
    const targetScope = scope || document;
    const governor = root.EngineeringPerformanceRefreshGovernor;
    if (governor && typeof governor.scheduleEnhance === 'function') {
      return governor.scheduleEnhance(targetScope, options);
    }
    root.setTimeout?.(() => enhanceDocument(targetScope), options.delayMs || 0);
    return true;
  }

  function enhanceScopeForTarget(target) {
    return target?.closest?.(DEFENSE_WINDOW_SELECTOR)
      || target?.closest?.('.task-window, .full-editor-modal, .canvas-task-window, #taskWindowBody')
      || document;
  }

  function refreshOpenPipeFormulaDefenseWindows() {
    if (!hasDocument()) return 0;
    patchPipeFormulaDefenseTraceBuilders();
    let refreshed = 0;
    document.querySelectorAll('.pipe-formula-defense-task-window').forEach((windowNode) => {
      const pipeId = pipeIdFromFormulaDefenseWindow(windowNode);
      if (!pipeId || typeof root.refreshPipeFormulaDefenseWindowContent !== 'function') {
        enhancePipeFormulaDefenseLayout(windowNode);
        enhanceTables(windowNode);
        return;
      }
      try {
        root.refreshPipeFormulaDefenseWindowContent(windowNode);
        refreshed += 1;
      } catch (error) {
        // The source model remains authoritative; UI refresh is best-effort.
      }
      enhancePipeFormulaDefenseLayout(windowNode);
      enhanceTables(windowNode);
      applyPipeSegmentBasisTooltips(windowNode);
    });
    return refreshed;
  }

  function patchPipeFormulaDefenseRealtimeRefresh() {
    if (pipeRefreshPatched) return false;
    pipeRefreshPatched = true;
    patchPipeFormulaDefenseTraceBuilders();

    const originalUpdateSimulation = root.updateSimulation;
    if (typeof originalUpdateSimulation === 'function' && !originalUpdateSimulation.__formulaDefensePipeRefreshPatched) {
      root.updateSimulation = function formulaDefenseUpdateSimulationWrapper(...args) {
        const scheduleRefresh = () => {
          root.setTimeout?.(() => {
            refreshOpenPipeFormulaDefenseWindows();
            scheduleEnhanceDocument(document, { reason: 'pipe formula updateSimulation', delayMs: 180 });
          }, 120);
        };
        const result = originalUpdateSimulation.apply(this, args);
        if (result && typeof result.then === 'function') {
          return result.then(
            (value) => {
              scheduleRefresh();
              return value;
            },
            (error) => {
              scheduleRefresh();
              throw error;
            }
          );
        }
        scheduleRefresh();
        return result;
      };
      root.updateSimulation.__formulaDefensePipeRefreshPatched = true;
      root.updateSimulation.__formulaDefensePipeRefreshOriginal = originalUpdateSimulation;
    }

    const originalOpen = root.openPipeFormulaDefenseTaskWindow;
    if (typeof originalOpen === 'function' && !originalOpen.__formulaDefensePipeUiPatched) {
      root.openPipeFormulaDefenseTaskWindow = function formulaDefenseOpenPipeWindowWrapper(...args) {
        const result = originalOpen.apply(this, args);
        root.setTimeout?.(() => {
          refreshOpenPipeFormulaDefenseWindows();
          scheduleEnhanceDocument(document, { reason: 'pipe formula window opened', delayMs: 120 });
        }, 60);
        return result;
      };
      root.openPipeFormulaDefenseTaskWindow.__formulaDefensePipeUiPatched = true;
      root.openPipeFormulaDefenseTaskWindow.__formulaDefensePipeUiOriginal = originalOpen;
    }

    const originalRefresh = root.refreshPipeFormulaDefenseWindowContent;
    if (typeof originalRefresh === 'function' && !originalRefresh.__formulaDefensePipeUiPatched) {
      root.refreshPipeFormulaDefenseWindowContent = function formulaDefenseRefreshPipeWindowWrapper(...args) {
        const result = originalRefresh.apply(this, args);
        root.setTimeout?.(() => {
          enhancePipeFormulaDefenseLayout(args[0] || document);
          enhanceTables(args[0] || document);
          enhanceFormulaNodes(args[0] || document);
          applyPipeSegmentBasisTooltips(args[0] || document);
        }, 0);
        return result;
      };
      root.refreshPipeFormulaDefenseWindowContent.__formulaDefensePipeUiPatched = true;
      root.refreshPipeFormulaDefenseWindowContent.__formulaDefensePipeUiOriginal = originalRefresh;
    }

    return true;
  }

  function enhanceDocument(scope = document) {
    if (!hasDocument()) return;
    installCss();
    installKatexWarningFilter();
    patchAcademicRenderer();
    patchPipeFormulaDefenseTraceBuilders();
    enhancePipeFormulaDefenseLayout(scope);
    enhanceFormulaNodes(scope);
    enhanceTables(scope);
    applyPipeSegmentBasisTooltips(scope);
    enhanceDependencyPanels(scope);
    syncRealtimeState();
  }

  function resolveNodeId(target) {
    const direct = target?.dataset?.node || target?.dataset?.nodeId || target?.dataset?.pumpNodeId;
    if (direct) return direct;
    const holder = target?.closest?.('[data-node], [data-node-id], [data-pump-node-id], [data-task-node-id]');
    return holder?.dataset?.node || holder?.dataset?.nodeId || holder?.dataset?.pumpNodeId || holder?.dataset?.taskNodeId || '';
  }

  function isEngineeringInput(target) {
    if (!target?.matches?.('input, select, textarea')) return false;
    if (target.disabled || target.readOnly || target.type === 'file') return false;
    return !!target.closest?.('.task-window, .full-editor-modal, .canvas-task-window, #taskWindowBody, [data-task-prop-body="true"]');
  }

  function hasRealtimeAutosolveOwner() {
    const realtime = root.EngineeringRealtimeCalculationDefense;
    return root.__NPSH_FORMULA_DEFENSE_UI_USE_LEGACY_AUTOSOLVE__ !== true
      && (typeof realtime?.requestAutoSolve === 'function' || typeof realtime?.markStale === 'function');
  }

  async function runDebouncedRecalculation(target, sequence) {
    if (!hasDocument() || sequence !== recalcSequence) return false;
    if (!target || !document.contains(target)) return false;
    const nodeId = resolveNodeId(target);
    const reason = `Realtime input changed: ${lastChangedInput || 'engineering input'}`;
    setCalculationUiState('Calculating', reason);
    try {
      root.EngineeringRealtimeCalculationDefense?.markCalculating?.(nodeId, reason);
    } catch (error) {
      // Realtime bridge is best-effort; updateSimulation remains authoritative.
    }
    try {
      if (typeof root.updateSimulation === 'function') {
        await root.updateSimulation({
          refreshReason: 'realtime-input',
          trigger: 'input',
          forceBackend: true,
          renderSidebarAfter: false,
          realtimeReason: reason
        });
      } else if (typeof root.runBackendSimulationShadow === 'function') {
        await root.runBackendSimulationShadow(nodeId, {
          refreshReason: 'realtime-input',
          trigger: 'input',
          forceBackend: true,
          realtimeReason: reason
        });
      } else {
        return false;
      }
      setCalculationUiState('Current', root.__engineeringCalculationDefenseRealtimeState?.calculationId ? `calculationId ${root.__engineeringCalculationDefenseRealtimeState.calculationId}` : 'recalculated');
      return true;
    } catch (error) {
      setCalculationUiState('Stale', error?.message || 'backend recalculation failed');
      return false;
    } finally {
      scheduleEnhanceDocument(enhanceScopeForTarget(target), { reason: 'formula defense recalculation finished', delayMs: 160 });
    }
  }

  function scheduleDebouncedRecalculation(target) {
    if (!hasDocument() || root.__NPSH_FORMULA_DEFENSE_UI_DISABLE_AUTOSOLVE__) return false;
    if (!isEngineeringInput(target)) return false;
    lastChangedInput = describeChangedInput(target);
    if (hasRealtimeAutosolveOwner()) {
      root.clearTimeout?.(recalcTimer);
      recalcSequence += 1;
      setCalculationUiState('Stale', `changed ${lastChangedInput}`);
      root.__formulaDefenseUiAutosolveBypass = {
        version: VERSION,
        reason: 'RealtimeCalculationDefense owns autosolve; Formula Defense UI did not call updateSimulation.',
        changedInput: lastChangedInput,
        bypassedAt: new Date().toISOString()
      };
      return true;
    }
    const sequence = ++recalcSequence;
    root.clearTimeout?.(recalcTimer);
    setCalculationUiState('Stale', `changed ${lastChangedInput}`);
    recalcTimer = root.setTimeout?.(() => {
      runDebouncedRecalculation(target, sequence);
    }, DEBOUNCE_MS);
    return true;
  }

  function installRealtimeListeners() {
    if (!hasDocument() || document.__formulaDefenseRealtimeListenerInstalled) return;
    document.__formulaDefenseRealtimeListenerInstalled = true;
    const onChange = (event) => {
      if (event.isComposing || !isEngineeringInput(event.target)) return;
      scheduleDebouncedRecalculation(event.target);
      const defenseScope = event.target.closest?.(DEFENSE_WINDOW_SELECTOR);
      if (defenseScope) {
        scheduleEnhanceDocument(defenseScope, { reason: 'formula defense input changed', delayMs: 180 });
      }
    };
    document.addEventListener('input', onChange, true);
    document.addEventListener('change', onChange, true);
  }

  function installObserver() {
    if (!hasDocument() || observer || root.__NPSH_FORMULA_DEFENSE_UI_DISABLE_AUTO_ENHANCE__) return;
    observer = new MutationObserver((mutations) => {
      let shouldEnhance = false;
      for (const mutation of mutations) {
        if ([...mutation.addedNodes].some((node) => node.nodeType === 1 && (
          node.matches?.(FORMULA_SELECTOR)
          || node.matches?.(DEFENSE_WINDOW_SELECTOR)
          || node.querySelector?.(`${FORMULA_SELECTOR}, ${DEFENSE_WINDOW_SELECTOR}, .pipe-formula-defense-fitting-breakdown-table`)
        ))) {
          shouldEnhance = true;
          break;
        }
      }
      if (shouldEnhance) scheduleEnhanceDocument(document, { reason: 'formula node added', delayMs: 180 });
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  function patchRealtimeBridge() {
    const realtime = root.EngineeringRealtimeCalculationDefense;
    if (!realtime || realtime.__formulaDefenseUiPatched) return;
    ['markStale', 'markCalculating', 'markCurrentFromBackend'].forEach((key) => {
      const original = realtime[key];
      if (typeof original !== 'function') return;
      realtime[key] = function formulaDefenseRealtimeWrapper(...args) {
        const result = original.apply(this, args);
        root.setTimeout?.(() => {
          syncRealtimeState();
          scheduleEnhanceDocument(document, { reason: `realtime ${key}`, delayMs: 180 });
        }, 60);
        return result;
      };
      realtime[key].__formulaDefenseUiOriginal = original;
    });
    realtime.__formulaDefenseUiPatched = true;
  }

  function install(options = {}) {
    if (!hasDocument()) return false;
    installCss();
    ensureKatexCss();
    installKatexWarningFilter();
    patchAcademicRenderer();
    patchPipeFormulaDefenseTraceBuilders();
    patchRealtimeBridge();
    patchPipeFormulaDefenseRealtimeRefresh();
    if (!root.__NPSH_FORMULA_DEFENSE_UI_DISABLE_AUTO_ENHANCE__ || options.force) {
      scheduleEnhanceDocument(document, { reason: 'formula defense install', delayMs: options.force ? 0 : 160 });
      installObserver();
    }
    installRealtimeListeners();
    if (!installed || options.force) {
      installed = true;
      loadKatex().then(() => {
        if (!root.__NPSH_FORMULA_DEFENSE_UI_DISABLE_AUTO_ENHANCE__ || options.force) {
          scheduleEnhanceDocument(document, { reason: 'katex loaded', delayMs: options.force ? 0 : 160 });
        }
      });
    }
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    debounceMs: DEBOUNCE_MS,
    formulaToTex,
    sanitizeTexForKatex,
    renderFormulaMarkup,
    wcagContrastRatio,
    colorForTheme,
    enhanceDocument,
    scheduleEnhanceDocument,
    scheduleDebouncedRecalculation,
    install,
    dependencyChainForInput,
    refreshOpenPipeFormulaDefenseWindows,
    buildPipeFormulaDefenseRows,
    buildAcademicPipeCalculationTrace
  };

  if (hasDocument()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => install(), { once: true });
    } else {
      install();
    }
  }

  return api;
});
