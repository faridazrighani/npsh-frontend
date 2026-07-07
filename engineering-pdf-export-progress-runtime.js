((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringPdfExportProgressRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-pdf-export-progress.v1';
  const CACHE_KEY = '20260707-pdf-export-progress1';
  const EVENT_NAME = 'npsh:pdf-export-progress';
  const STYLE_ID = 'engineeringPdfExportProgressStyle';
  const OVERLAY_ID = 'engineeringPdfExportProgressOverlay';
  const ACTIVE_CLASS = 'npsh-pdf-export-progress-active';
  const PDF_COMMAND_SELECTOR = [
    '#menu-export-appendix-pdf',
    '#menu-tools-export-appendix-pdf'
  ].join(',');
  const MIN_VISIBLE_MS = 520;
  const AUTO_HIDE_MS = 820;
  const FAILURE_HIDE_MS = 5200;
  const STEPS = [
    { key: 'start', percent: 5, label: 'Starting PDF export' },
    { key: 'read', percent: 12, label: 'Reading active simulation state' },
    { key: 'validate', percent: 22, label: 'Validating report topology' },
    { key: 'snapshot', percent: 35, label: 'Capturing model snapshot' },
    { key: 'phase-chart', percent: 48, label: 'Rendering Fluid Basis phase chart' },
    { key: 'moody', percent: 60, label: 'Rendering Moody chart evidence' },
    { key: 'equations', percent: 74, label: 'Formatting Equation Professional sections' },
    { key: 'pages', percent: 88, label: 'Building PDF pages' },
    { key: 'finalizing', percent: 96, label: 'Finalizing report file' },
    { key: 'complete', percent: 100, label: 'PDF report completed' }
  ];

  let installed = false;
  let wrappedExport = false;
  let activeState = null;
  let disabledControls = [];
  let hideTimer = 0;
  let originalExportPdf = null;

  function hasDocument() {
    return typeof document !== 'undefined' && !!document.documentElement;
  }

  function nowMs() {
    return root.performance?.now?.() || Date.now();
  }

  function clampPercent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed)));
  }

  function stepByKey(stepKey) {
    return STEPS.find((step) => step.key === stepKey) || STEPS[0];
  }

  function stepIndex(stepKey) {
    return Math.max(0, STEPS.findIndex((step) => step.key === stepKey));
  }

  function clearHideTimer() {
    if (hideTimer) root.clearTimeout?.(hideTimer);
    hideTimer = 0;
  }

  function dispatch(detail) {
    root.__engineeringPdfExportProgressState = { ...detail };
    if (!hasDocument() || typeof root.CustomEvent !== 'function') return false;
    try {
      document.dispatchEvent(new root.CustomEvent(EVENT_NAME, { detail }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function installCss() {
    if (!hasDocument() || document.getElementById(STYLE_ID)) return false;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
body.${ACTIVE_CLASS} ${PDF_COMMAND_SELECTOR} {
  pointer-events: none !important;
}
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 6700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 140ms ease, visibility 140ms ease;
}
#${OVERLAY_ID}[data-visible="true"] {
  opacity: 1;
  visibility: visible;
}
#${OVERLAY_ID} .pdf-export-progress-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(248, 251, 255, 0.78);
}
#${OVERLAY_ID} .pdf-export-progress-dialog {
  position: relative;
  width: min(430px, calc(100vw - 36px));
  overflow: hidden;
  border: 1px solid #c4d8e8;
  border-radius: 7px;
  background: #ffffff;
  color: #123b5a;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18);
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  pointer-events: auto;
}
#${OVERLAY_ID} .pdf-export-progress-header {
  padding: 9px 12px;
  background: #123f60;
  color: #ffffff;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.25;
}
#${OVERLAY_ID}[data-state="failed"] .pdf-export-progress-header {
  background: #8a2f2b;
}
#${OVERLAY_ID}[data-state="complete"] .pdf-export-progress-header {
  background: #0f6848;
}
#${OVERLAY_ID} .pdf-export-progress-body {
  display: grid;
  gap: 9px;
  padding: 11px 12px 12px;
}
#${OVERLAY_ID} .pdf-export-progress-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
}
#${OVERLAY_ID} .pdf-export-progress-task {
  min-width: 0;
  color: #123b5a;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
}
#${OVERLAY_ID} .pdf-export-progress-percent {
  color: #0f314d;
  font-size: 12px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
#${OVERLAY_ID} .pdf-export-progress-track {
  height: 8px;
  overflow: hidden;
  border: 1px solid #cfe0ee;
  border-radius: 999px;
  background: #eef5fb;
}
#${OVERLAY_ID} .pdf-export-progress-fill {
  width: 0%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #1f6f9f, #28705a);
  transition: width 180ms ease;
}
#${OVERLAY_ID}[data-state="failed"] .pdf-export-progress-fill {
  background: #b42318;
}
#${OVERLAY_ID} .pdf-export-progress-steps {
  display: grid;
  gap: 3px;
  margin-top: 1px;
}
#${OVERLAY_ID} .pdf-export-progress-step {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: start;
  color: #526980;
  font-size: 11px;
  line-height: 1.25;
}
#${OVERLAY_ID} .pdf-export-progress-symbol {
  color: #8aa0b2;
  font-weight: 750;
}
#${OVERLAY_ID} .pdf-export-progress-step[data-status="done"] .pdf-export-progress-symbol {
  color: #15803d;
}
#${OVERLAY_ID} .pdf-export-progress-step[data-status="active"] {
  color: #0f314d;
  font-weight: 650;
}
#${OVERLAY_ID} .pdf-export-progress-step[data-status="active"] .pdf-export-progress-symbol {
  color: #0b74bd;
}
#${OVERLAY_ID} .pdf-export-progress-note {
  color: #64748b;
  font-size: 10.5px;
  line-height: 1.35;
}
@media (max-width: 520px) {
  #${OVERLAY_ID} {
    align-items: flex-start;
    padding-top: 72px;
  }
}
`;
    document.head.appendChild(style);
    return true;
  }

  function ensureOverlay() {
    if (!hasDocument()) return null;
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement('section');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-atomic', 'true');
    overlay.innerHTML = `
      <div class="pdf-export-progress-backdrop"></div>
      <div class="pdf-export-progress-dialog">
        <div class="pdf-export-progress-header" data-pdf-export-progress-title>Exporting PDF Report</div>
        <div class="pdf-export-progress-body">
          <div class="pdf-export-progress-line">
            <div class="pdf-export-progress-task" data-pdf-export-progress-task>Preparing professional engineering report</div>
            <div class="pdf-export-progress-percent" data-pdf-export-progress-percent>0%</div>
          </div>
          <div class="pdf-export-progress-track" aria-hidden="true">
            <div class="pdf-export-progress-fill" data-pdf-export-progress-fill></div>
          </div>
          <div class="pdf-export-progress-steps" data-pdf-export-progress-steps></div>
          <div class="pdf-export-progress-note" data-pdf-export-progress-note>Please wait while the PDF report is being generated.</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function disablePdfCommands() {
    if (!hasDocument()) return;
    restorePdfCommands();
    disabledControls = Array.from(document.querySelectorAll(PDF_COMMAND_SELECTOR)).map((element) => ({
      element,
      disabled: element.disabled,
      ariaDisabled: element.getAttribute('aria-disabled'),
      ariaBusy: element.getAttribute('aria-busy')
    }));
    disabledControls.forEach(({ element }) => {
      if ('disabled' in element) element.disabled = true;
      element.setAttribute('aria-disabled', 'true');
      element.setAttribute('aria-busy', 'true');
    });
  }

  function restorePdfCommands() {
    disabledControls.forEach(({ element, disabled, ariaDisabled, ariaBusy }) => {
      if ('disabled' in element) element.disabled = disabled;
      if (ariaDisabled === null) element.removeAttribute('aria-disabled');
      else element.setAttribute('aria-disabled', ariaDisabled);
      if (ariaBusy === null) element.removeAttribute('aria-busy');
      else element.setAttribute('aria-busy', ariaBusy);
    });
    disabledControls = [];
  }

  function renderOverlay() {
    if (!hasDocument() || !activeState) return;
    installCss();
    const overlay = ensureOverlay();
    if (!overlay) return;
    const percent = clampPercent(activeState.percent);
    const activeIndex = stepIndex(activeState.stepKey);
    overlay.dataset.visible = 'true';
    overlay.dataset.state = activeState.status || 'active';
    const title = overlay.querySelector('[data-pdf-export-progress-title]');
    const task = overlay.querySelector('[data-pdf-export-progress-task]');
    const percentNode = overlay.querySelector('[data-pdf-export-progress-percent]');
    const fill = overlay.querySelector('[data-pdf-export-progress-fill]');
    const note = overlay.querySelector('[data-pdf-export-progress-note]');
    const steps = overlay.querySelector('[data-pdf-export-progress-steps]');
    if (title) {
      title.textContent = activeState.status === 'complete'
        ? 'PDF Report Ready'
        : (activeState.status === 'failed' ? 'PDF Export Failed' : 'Exporting PDF Report');
    }
    if (task) task.textContent = activeState.message || stepByKey(activeState.stepKey).label;
    if (percentNode) percentNode.textContent = `${percent}%`;
    if (fill) fill.style.width = `${percent}%`;
    if (note) {
      note.textContent = activeState.status === 'failed'
        ? `Last completed step: ${activeState.lastCompletedLabel || 'Starting PDF export'}`
        : (activeState.status === 'complete'
          ? 'PDF report has been generated successfully.'
          : 'Please wait while the PDF report is being generated.');
    }
    if (steps) {
      steps.innerHTML = STEPS.filter((step) => step.key !== 'complete').map((step, index) => {
        const status = index < activeIndex || activeState.status === 'complete' ? 'done' : (index === activeIndex ? 'active' : 'pending');
        const symbol = status === 'done' ? 'OK' : (status === 'active' ? '>' : '.');
        const label = activeState.stepKey === step.key && activeState.message ? activeState.message : step.label;
        return `<div class="pdf-export-progress-step" data-status="${status}"><span class="pdf-export-progress-symbol">${symbol}</span><span>${escapeHtml(label)}</span></div>`;
      }).join('');
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function snapshot(extra = {}) {
    const state = activeState || {
      status: 'idle',
      stepKey: '',
      percent: 0,
      message: '',
      startedAt: '',
      updatedAt: ''
    };
    return {
      version: VERSION,
      cacheKey: CACHE_KEY,
      eventName: EVENT_NAME,
      ...state,
      ...extra
    };
  }

  function start(detail = {}) {
    clearHideTimer();
    const step = stepByKey(detail.stepKey || 'start');
    const startedAt = new Date().toISOString();
    activeState = {
      status: 'active',
      stepKey: step.key,
      percent: clampPercent(detail.percent ?? step.percent),
      message: detail.message || step.label,
      startedAt,
      updatedAt: startedAt,
      startedAtMs: nowMs(),
      lastCompletedKey: '',
      lastCompletedLabel: '',
      source: detail.source || 'pdf-export'
    };
    if (hasDocument()) {
      document.body.classList.add(ACTIVE_CLASS);
      disablePdfCommands();
      renderOverlay();
    }
    dispatch(snapshot({ phase: 'begin' }));
    return snapshot();
  }

  function ensureActive(detail = {}) {
    if (activeState?.status === 'active') return activeState;
    start(detail);
    return activeState;
  }

  function update(stepKeyOrDetail, detail = {}) {
    const updateDetail = typeof stepKeyOrDetail === 'object'
      ? stepKeyOrDetail
      : { ...detail, stepKey: stepKeyOrDetail };
    ensureActive(updateDetail);
    const step = stepByKey(updateDetail.stepKey || activeState.stepKey || 'start');
    const nextPercent = clampPercent(updateDetail.percent ?? step.percent);
    const currentIndex = stepIndex(activeState.stepKey);
    const nextIndex = stepIndex(step.key);
    if (nextIndex > currentIndex) {
      const previous = STEPS[currentIndex];
      activeState.lastCompletedKey = previous?.key || activeState.lastCompletedKey || '';
      activeState.lastCompletedLabel = previous?.label || activeState.lastCompletedLabel || '';
    }
    activeState.stepKey = step.key;
    activeState.percent = Math.max(clampPercent(activeState.percent), nextPercent);
    activeState.message = updateDetail.message || step.label;
    activeState.pipeId = updateDetail.pipeId || '';
    activeState.pipeIndex = Number.isFinite(Number(updateDetail.pipeIndex)) ? Number(updateDetail.pipeIndex) : null;
    activeState.pipeCount = Number.isFinite(Number(updateDetail.pipeCount)) ? Number(updateDetail.pipeCount) : null;
    activeState.updatedAt = new Date().toISOString();
    if (hasDocument()) renderOverlay();
    dispatch(snapshot({ phase: 'progress' }));
    return snapshot();
  }

  function complete(detail = {}) {
    ensureActive(detail);
    update({ stepKey: 'complete', percent: 100, message: detail.message || 'PDF report completed' });
    activeState.status = 'complete';
    activeState.percent = 100;
    activeState.completedAt = new Date().toISOString();
    activeState.updatedAt = activeState.completedAt;
    if (hasDocument()) {
      renderOverlay();
      const elapsed = nowMs() - (activeState.startedAtMs || nowMs());
      const delay = Math.max(0, MIN_VISIBLE_MS - elapsed) + AUTO_HIDE_MS;
      clearHideTimer();
      hideTimer = root.setTimeout?.(() => hide('complete'), delay) || 0;
    }
    dispatch(snapshot({ phase: 'complete' }));
    return snapshot();
  }

  function fail(errorOrDetail = {}) {
    ensureActive();
    const message = errorOrDetail?.message || errorOrDetail?.error || String(errorOrDetail || 'PDF export failed.');
    activeState.status = 'failed';
    activeState.message = 'The PDF report could not be completed.';
    activeState.error = message;
    activeState.updatedAt = new Date().toISOString();
    if (hasDocument()) {
      renderOverlay();
      clearHideTimer();
      hideTimer = root.setTimeout?.(() => hide('failed'), FAILURE_HIDE_MS) || 0;
    }
    dispatch(snapshot({ phase: 'failed', error: message }));
    return snapshot();
  }

  function hide(reason = 'hidden') {
    clearHideTimer();
    if (hasDocument()) {
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay) overlay.dataset.visible = 'false';
      document.body.classList.remove(ACTIVE_CLASS);
      restorePdfCommands();
    }
    const hidden = snapshot({ phase: reason });
    activeState = null;
    return hidden;
  }

  function wrapPdfExport() {
    if (wrappedExport || typeof root.exportScenarioCalculationTraceToPdf !== 'function') return false;
    originalExportPdf = root.exportScenarioCalculationTraceToPdf;
    if (originalExportPdf.__pdfExportProgressWrapped) {
      wrappedExport = true;
      return false;
    }
    const wrapped = function pdfExportProgressWrapped(...args) {
      if (!activeState || activeState.status !== 'active') {
        start({ source: 'pdf-export-command' });
      }
      let result;
      try {
        result = originalExportPdf.apply(this, args);
      } catch (error) {
        fail(error);
        throw error;
      }
      if (result && typeof result.then === 'function') {
        return result.then((value) => {
          if (activeState?.status === 'active') complete();
          return value;
        }, (error) => {
          fail(error);
          throw error;
        });
      }
      if (activeState?.status === 'active') complete();
      return result;
    };
    wrapped.__pdfExportProgressWrapped = true;
    wrapped.__pdfExportProgressOriginal = originalExportPdf;
    root.exportScenarioCalculationTraceToPdf = wrapped;
    wrappedExport = true;
    return true;
  }

  function handlePdfClick(event) {
    const target = event?.target?.closest?.(PDF_COMMAND_SELECTOR);
    if (!target) return false;
    if (activeState?.status === 'active') {
      event.preventDefault?.();
      event.stopPropagation?.();
      return true;
    }
    start({
      source: 'menu-click',
      message: 'Preparing professional engineering report'
    });
    return true;
  }

  function install() {
    if (installed) return false;
    installed = true;
    if (hasDocument()) {
      installCss();
      ensureOverlay();
      document.addEventListener('click', handlePdfClick, true);
    }
    wrapPdfExport();
    root.setTimeout?.(wrapPdfExport, 120);
    root.setTimeout?.(wrapPdfExport, 900);
    return true;
  }

  function uninstall() {
    if (!installed) return false;
    if (hasDocument()) {
      document.removeEventListener('click', handlePdfClick, true);
      document.body.classList.remove(ACTIVE_CLASS);
      restorePdfCommands();
    }
    if (wrappedExport && originalExportPdf && root.exportScenarioCalculationTraceToPdf?.__pdfExportProgressOriginal === originalExportPdf) {
      root.exportScenarioCalculationTraceToPdf = originalExportPdf;
    }
    wrappedExport = false;
    installed = false;
    activeState = null;
    clearHideTimer();
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    eventName: EVENT_NAME,
    steps: STEPS.map((step) => ({ ...step })),
    install,
    uninstall,
    start,
    update,
    complete,
    fail,
    hide,
    state: () => snapshot(),
    wrapPdfExport,
    isActive: () => activeState?.status === 'active'
  };

  if (hasDocument()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }

  return api;
});
