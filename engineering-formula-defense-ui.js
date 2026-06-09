((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringFormulaDefenseUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-formula-defense-ui.v1';
  const CACHE_KEY = '20260608-formula-defense-ui2';
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
        surface: '#0b1220',
        text: '#f8fafc',
        muted: '#cbd5e1',
        accent: '#7dd3fc',
        border: '#38bdf8'
      };
    }
    const body = document.body;
    const element = document.documentElement;
    const explicit = `${body?.dataset?.theme || ''} ${element?.dataset?.theme || ''} ${body?.className || ''}`;
    const dark = /\bdark\b|dark-mode|theme-dark/i.test(explicit)
      || root.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    return dark
      ? { surface: '#020617', text: '#f8fafc', muted: '#cbd5e1', accent: '#67e8f9', border: '#22d3ee' }
      : { surface: '#0b1220', text: '#f8fafc', muted: '#dbeafe', accent: '#7dd3fc', border: '#38bdf8' };
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
[data-theme="dark"],
.theme-dark,
.dark-mode {
  --formula-defense-panel: #0f172a;
  --formula-defense-panel-text: #e2e8f0;
  --formula-defense-row-alt: #111827;
  --formula-defense-row-hover: #16324a;
  --formula-defense-warning: #431407;
  --formula-defense-warning-text: #fed7aa;
}
@media (prefers-color-scheme: dark) {
  :root {
    --formula-defense-panel: #0f172a;
    --formula-defense-panel-text: #e2e8f0;
    --formula-defense-row-alt: #111827;
    --formula-defense-row-hover: #16324a;
  }
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
  color: #cbd5e1 !important;
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
.pipe-formula-defense-fitting-breakdown-table {
  width: max-content !important;
  min-width: min(920px, 100%) !important;
  table-layout: auto !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
}
.pipe-formula-defense-fitting-breakdown-table thead th {
  position: sticky !important;
  top: 0;
  z-index: 3;
  background: #123b5a !important;
  color: #ffffff !important;
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
  .formula-dependency-visualization {
    grid-template-columns: 1fr;
  }
  .pipe-formula-defense-fitting-breakdown-table {
    min-width: 860px !important;
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
    return /No character metrics for ' '\s+in style 'Main-Regular' and mode 'text'/i.test(args.map(String).join(' '));
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

  function formatResult(result) {
    if (typeof root.formatAcademicEquationResult === 'function') return root.formatAcademicEquationResult(result);
    if (!result || typeof result !== 'object') return '';
    const value = result.value ?? result.result ?? result.displayValue;
    const unit = result.unit ? ` ${result.unit}` : '';
    return value === undefined || value === null ? '' : `${value}${unit}`;
  }

  function buildEquationStepHtml(step = {}) {
    const context = step.contextLabel || step.label || step.name || 'Formula';
    const formula = step.formula || step.equation || step.substitution || step.rule || step.description || '';
    const rendered = renderFormulaMarkup(formula, context, { displayMode: true });
    const resultText = formatResult(step.result);
    const parts = [
      '<div class="academic-equation-step formula-defense-equation-step" data-formula-defense-equation="true">',
      `<div class="academic-equation-context">${escapeHtml(context)}</div>`,
      '<div class="academic-equation-display formula-defense-equation-surface">',
      `<span class="academic-equation-math" data-formula-source="${escapeHtml(formula)}" data-equation-renderer="${escapeHtml(rendered.renderer)}">${rendered.html}</span>`,
      '</div>'
    ];
    if (resultText) {
      parts.push(`<div class="academic-equation-result">Result: ${escapeHtml(resultText)}</div>`);
    }
    parts.push('</div>');
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
    root.renderAcademicEquationStepHtml = function formulaDefenseRenderAcademicEquationStepHtml(step) {
      try {
        return buildEquationStepHtml(step);
      } catch (error) {
        return typeof originalStepHtml === 'function' ? originalStepHtml.call(this, step) : '';
      }
    };
    root.renderAcademicEquationStepHtml.__formulaDefenseUiPatched = true;
    root.renderAcademicEquationStepHtml.__formulaDefenseUiOriginal = originalStepHtml || null;

    const originalCreateStep = root.createAcademicEquationStepElement;
    root.createAcademicEquationStepElement = function formulaDefenseCreateAcademicEquationStepElement(step) {
      if (!hasDocument()) {
        return typeof originalCreateStep === 'function' ? originalCreateStep.call(this, step) : null;
      }
      const template = document.createElement('template');
      template.innerHTML = buildEquationStepHtml(step);
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
    const container = node.closest?.('.academic-equation-display, .formula-defense-equation-surface, .pump-curve-formula-card code, .pipe-trace-table code') || node;
    container.dataset.formulaContrast = 'aa';
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

  function enhanceTables(scope = document) {
    if (!scope?.querySelectorAll) return;
    scope.querySelectorAll('.pipe-formula-defense-fitting-breakdown-table').forEach((table) => {
      table.dataset.formulaDefenseResponsive = 'true';
      const wrapper = table.closest('.pump-curve-explanation-table-wrap, .pipe-formula-defense-fitting-breakdown-wrap');
      wrapper?.classList.add('formula-defense-responsive-table-wrap');
      table.querySelectorAll('td[colspan]').forEach((cell) => {
        if (/no .*breakdown|no fittings|not available/i.test(cell.textContent || '')) {
          cell.classList.add('formula-defense-empty-state');
          cell.textContent = cell.textContent || 'No pipe/fitting/valve breakdown is available for the current route.';
        }
      });
    });
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

  function enhanceDocument(scope = document) {
    if (!hasDocument()) return;
    installCss();
    patchAcademicRenderer();
    enhanceFormulaNodes(scope);
    enhanceTables(scope);
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
      root.setTimeout?.(() => enhanceDocument(document), 0);
    }
  }

  function scheduleDebouncedRecalculation(target) {
    if (!hasDocument() || root.__NPSH_FORMULA_DEFENSE_UI_DISABLE_AUTOSOLVE__) return false;
    if (!isEngineeringInput(target)) return false;
    lastChangedInput = describeChangedInput(target);
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
      root.setTimeout?.(() => enhanceDocument(document), 0);
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
      if (shouldEnhance) root.requestAnimationFrame?.(() => enhanceDocument(document));
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
          enhanceDocument(document);
        }, 0);
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
    patchAcademicRenderer();
    patchRealtimeBridge();
    if (!root.__NPSH_FORMULA_DEFENSE_UI_DISABLE_AUTO_ENHANCE__ || options.force) {
      enhanceDocument(document);
      installObserver();
    }
    installRealtimeListeners();
    if (!installed || options.force) {
      installed = true;
      loadKatex().then(() => {
        if (!root.__NPSH_FORMULA_DEFENSE_UI_DISABLE_AUTO_ENHANCE__ || options.force) {
          enhanceDocument(document);
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
    scheduleDebouncedRecalculation,
    install,
    dependencyChainForInput
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
