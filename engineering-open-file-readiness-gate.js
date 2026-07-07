((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringOpenFileReadinessGate = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-open-file-readiness-gate.v7';
  const CACHE_KEY = '20260707-open-file-readiness-gate8';
  const STYLE_ID = 'engineeringOpenFileReadinessGateStyle';
  const OVERLAY_ID = 'engineeringOpenFileReadinessGate';
  const ACTIVE_CLASS = 'npsh-open-file-readiness-active';
  const WARNING_CLASS = 'npsh-open-file-readiness-warning';
  const MAX_WAIT_MS = 12000;
  const MIN_VISIBLE_MS = 720;
  const QUIET_MS = 180;
  const LOOP_MS = 90;
  const CLEAN_FRAME_COUNT = 2;
  const FILE_INPUT_SELECTOR = 'input[type="file"]';
  const PIPE_HYDRAULIC_LABEL_SELECTOR = '#svg-lines .pipe-hydraulic-label[data-pipe-id]';
  const PIPE_LABEL_REFRESH_THROTTLE_MS = 360;
  const FINAL_CLEANUP_THROTTLE_MS = 640;
  const STABLE_READY_EVIDENCE_MS = 520;
  const POST_CLEANUP_READY_MS = 2400;
  const PIPE_LABEL_RUNTIME_SRC = 'engineering-pipe-canvas-hydraulic-label-runtime-20260707-pfv-loss-summary-clean1.js?v=20260707-pfv-loss-summary-clean1';
  const ROUTE_TRACE_RUNTIME_SRC = 'engineering-route-trace-audit-20260704-sink-pabs-dedupe1.js?v=20260707-pump-panel-clean6';
  const DISABLED_DURING_OPEN_SELECTOR = [
    '#btn-solve',
    '#menu-run-solve',
    '#menu-refresh-calculations',
    '#menu-tools-export-excel',
    '#menu-tools-export-appendix-pdf',
    '#menu-export-excel-trace',
    '#menu-export-appendix-pdf',
    '#menu-file-export'
  ].join(',');
  const STEPS = [
    { key: 'reading', label: 'Reading file' },
    { key: 'validating', label: 'Validating model' },
    { key: 'solving', label: 'Solving hydraulic network' },
    { key: 'updating', label: 'Updating canvas' },
    { key: 'finalizing', label: 'Finalizing display' }
  ];

  let installed = false;
  let activeSession = null;
  let observer = null;
  let loopTimer = 0;
  let disabledElements = [];
  let lastRuntimeRequestAt = 0;
  const readinessScriptPromises = new Map();

  function hasDocument() {
    return typeof document !== 'undefined' && document?.documentElement;
  }

  function nowMs() {
    return (root.performance?.now?.() || Date.now());
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function clearTimer(timer) {
    if (timer) root.clearTimeout?.(timer);
    return 0;
  }

  function isUntirtaFile(file) {
    return /\.untirta$/i.test(String(file?.name || ''));
  }

  function installCss() {
    if (!hasDocument() || document.getElementById(STYLE_ID)) return false;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
body.${ACTIVE_CLASS} #canvas {
  visibility: hidden !important;
}
body.${ACTIVE_CLASS} #canvas,
body.${ACTIVE_CLASS} #canvas * {
  pointer-events: none !important;
}
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  z-index: 6500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  pointer-events: auto;
  opacity: 0;
  visibility: hidden;
  transition: opacity 120ms ease, visibility 120ms ease;
}
#${OVERLAY_ID}[data-visible="true"] {
  opacity: 1;
  visibility: visible;
}
#${OVERLAY_ID} .open-file-readiness-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(248, 251, 255, 0.88);
}
#${OVERLAY_ID} .open-file-readiness-dialog {
  position: relative;
  width: min(390px, calc(100vw - 32px));
  overflow: hidden;
  border: 1px solid #c5d8e8;
  border-radius: 7px;
  background: #ffffff;
  color: #123b5a;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
}
#${OVERLAY_ID} .open-file-readiness-header {
  padding: 9px 12px;
  background: #123f60;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}
#${OVERLAY_ID} .open-file-readiness-body {
  display: grid;
  gap: 9px;
  padding: 10px 12px 12px;
}
#${OVERLAY_ID} .open-file-readiness-task {
  color: #123b5a;
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
}
#${OVERLAY_ID} .open-file-readiness-steps {
  display: grid;
  gap: 4px;
}
#${OVERLAY_ID} .open-file-readiness-step {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  color: #475569;
  font-size: 11.5px;
  line-height: 1.25;
}
#${OVERLAY_ID} .open-file-readiness-symbol {
  color: #94a3b8;
  font-weight: 700;
}
#${OVERLAY_ID} .open-file-readiness-step[data-status="done"] .open-file-readiness-symbol {
  color: #15803d;
}
#${OVERLAY_ID} .open-file-readiness-step[data-status="active"] {
  color: #0f314d;
  font-weight: 650;
}
#${OVERLAY_ID} .open-file-readiness-step[data-status="active"] .open-file-readiness-symbol {
  color: #0b74bd;
}
#${OVERLAY_ID} .open-file-readiness-note {
  color: #64748b;
  font-size: 10.5px;
  line-height: 1.35;
}
#${OVERLAY_ID}[data-state="warning"] .open-file-readiness-header {
  background: #7c4a03;
}
@media (max-width: 520px) {
  #${OVERLAY_ID} {
    align-items: flex-start;
    padding-top: 74px;
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
      <div class="open-file-readiness-backdrop"></div>
      <div class="open-file-readiness-dialog">
        <div class="open-file-readiness-header">Opening Simulation</div>
        <div class="open-file-readiness-body">
          <div class="open-file-readiness-task" data-open-readiness-task>Reading file</div>
          <div class="open-file-readiness-steps" data-open-readiness-steps></div>
          <div class="open-file-readiness-note" data-open-readiness-note>Preparing the simulation canvas.</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function stepStatus(stepKey) {
    if (!activeSession) return 'pending';
    const activeIndex = STEPS.findIndex((step) => step.key === activeSession.phase);
    const stepIndex = STEPS.findIndex((step) => step.key === stepKey);
    if (activeSession.phase === 'ready') return 'done';
    if (stepIndex < activeIndex) return 'done';
    if (stepIndex === activeIndex) return 'active';
    return 'pending';
  }

  function renderOverlay() {
    const overlay = ensureOverlay();
    if (!overlay || !activeSession) return;
    overlay.dataset.visible = 'true';
    overlay.dataset.state = activeSession.warning ? 'warning' : 'preparing';
    const task = overlay.querySelector('[data-open-readiness-task]');
    const note = overlay.querySelector('[data-open-readiness-note]');
    const list = overlay.querySelector('[data-open-readiness-steps]');
    const activeStep = STEPS.find((step) => step.key === activeSession.phase) || STEPS[0];
    if (task) task.textContent = activeStep.label;
    if (note) {
      note.textContent = activeSession.warning
        ? 'Opening completed with calculation warning. Display cleanup is being finalized.'
        : activeSession.note || 'Preparing the simulation canvas.';
    }
    if (list) {
      list.innerHTML = STEPS.map((step) => {
        const status = stepStatus(step.key);
        const symbol = status === 'done' ? 'OK' : (status === 'active' ? '>' : '.');
        return `<div class="open-file-readiness-step" data-status="${status}"><span class="open-file-readiness-symbol">${symbol}</span><span>${step.label}</span></div>`;
      }).join('');
    }
  }

  function setPhase(phase, note = '') {
    if (!activeSession || activeSession.phase === 'ready') return;
    activeSession.phase = phase;
    if (note) activeSession.note = note;
    renderOverlay();
  }

  function disableOpenSensitiveControls() {
    if (!hasDocument()) return;
    disabledElements = Array.from(document.querySelectorAll(DISABLED_DURING_OPEN_SELECTOR)).map((element) => ({
      element,
      disabled: element.disabled,
      ariaDisabled: element.getAttribute('aria-disabled')
    }));
    disabledElements.forEach(({ element }) => {
      if ('disabled' in element) element.disabled = true;
      element.setAttribute('aria-disabled', 'true');
    });
  }

  function restoreOpenSensitiveControls() {
    disabledElements.forEach(({ element, disabled, ariaDisabled }) => {
      if ('disabled' in element) element.disabled = disabled;
      if (ariaDisabled === null) element.removeAttribute('aria-disabled');
      else element.setAttribute('aria-disabled', ariaDisabled);
    });
    disabledElements = [];
  }

  function dispatchGateEvent(phase, extra = {}) {
    if (!hasDocument()) return;
    document.dispatchEvent(new CustomEvent('npsh:open-file-readiness', {
      detail: {
        phase,
        fileName: activeSession?.fileName || '',
        sessionId: activeSession?.id || 0,
        ...extra
      }
    }));
  }

  function observeCanvas() {
    if (!hasDocument() || typeof root.MutationObserver !== 'function') return false;
    observer?.disconnect?.();
    const canvas = document.getElementById('canvas') || document.documentElement;
    observer = new root.MutationObserver(() => {
      if (!activeSession) return;
      activeSession.lastMutationAt = nowMs();
      if (activeSession.phase === 'reading' || activeSession.phase === 'validating') setPhase('updating', 'Applying the loaded model to the canvas.');
    });
    observer.observe(canvas, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true
    });
    return true;
  }

  function getCurrentModel() {
    return root.globalModel || root.__npshGlobalModel || {};
  }

  function getModelPipeIds() {
    const model = getCurrentModel();
    return Object.entries(model || {})
      .filter(([, object]) => String(object?.type || '').toLowerCase() === 'pipe')
      .map(([id]) => id)
      .filter(Boolean);
  }

  function canvasHasLoadedModel() {
    if (!hasDocument()) return false;
    const canvas = document.getElementById('canvas');
    const model = getCurrentModel();
    return Boolean(
      canvas?.querySelector?.('.pfd-object, .pump-live-params, .sink-live-params, .pipe-live-params')
      || Object.keys(model || {}).some((key) => key !== 'SETTINGS' && key !== 'FLUID')
    );
  }

  function requestReadinessRuntimes() {
    const elapsedSinceRequest = nowMs() - lastRuntimeRequestAt;
    if (elapsedSinceRequest < 350) return false;
    lastRuntimeRequestAt = nowMs();
    [PIPE_LABEL_RUNTIME_SRC, ROUTE_TRACE_RUNTIME_SRC].forEach((src) => {
      ensureReadinessScript(src).catch((error) => {
        console.warn('Open file readiness could not load a required display runtime.', error);
      });
    });
    ['__npshLoadRealtime', '__npshLoadSupport'].forEach((loaderName) => {
      const loader = root[loaderName];
      if (typeof loader !== 'function') return;
      try {
        Promise.resolve(loader()).catch((error) => {
          console.warn('Open file readiness could not accelerate deferred runtime loading.', error);
        });
      } catch (error) {
        console.warn('Open file readiness could not request deferred runtime loading.', error);
      }
    });
    return true;
  }

  function ensureReadinessScript(src) {
    if (!hasDocument()) return Promise.resolve(false);
    if (readinessScriptPromises.has(src)) return readinessScriptPromises.get(src);
    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts || []).find((script) => String(script.getAttribute('src') || '') === src);
      if (existing) {
        if (existing.dataset.npshLoaded === 'true' || existing.dataset.openFileReadinessLoaded === 'true') {
          resolve(true);
          return;
        }
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.npshDeferredScript = 'true';
      script.dataset.openFileReadinessScript = 'true';
      script.addEventListener('load', () => {
        script.dataset.npshLoaded = 'true';
        script.dataset.openFileReadinessLoaded = 'true';
        resolve(true);
      }, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.body.appendChild(script);
    });
    readinessScriptPromises.set(src, promise);
    return promise;
  }

  function pipeHydraulicLabelsReady() {
    if (!hasDocument()) return true;
    const pipeIds = getModelPipeIds();
    if (!pipeIds.length) return true;
    if (currentPipeHydraulicLabelsReady(pipeIds)) return true;
    if (typeof root.refreshPipeCanvasHydraulicLabels !== 'function') {
      requestReadinessRuntimes();
      return false;
    }
    const now = nowMs();
    if (activeSession && now - (activeSession.lastPipeLabelRefreshAt || 0) < PIPE_LABEL_REFRESH_THROTTLE_MS) return false;
    if (activeSession) activeSession.lastPipeLabelRefreshAt = now;
    try {
      root.refreshPipeCanvasHydraulicLabels(document);
    } catch (error) {
      console.warn('Open file readiness could not refresh pipe hydraulic labels.', error);
      return false;
    }
    return currentPipeHydraulicLabelsReady(pipeIds);
  }

  function currentPipeHydraulicLabelsReady(pipeIds = getModelPipeIds()) {
    if (!hasDocument()) return true;
    if (!pipeIds.length) return true;
    const labels = Array.from(document.querySelectorAll(PIPE_HYDRAULIC_LABEL_SELECTOR));
    const readyPipeIds = new Set(labels.filter((label) => {
      const text = normalizeText(label.textContent);
      return /Total\s*K/i.test(text)
        && /Total\s*hL/i.test(text)
        && /Minor/i.test(text)
        && /Major/i.test(text)
        && !(/Total\s*K\s*0(?:\.0+)?\b/i.test(text) && /Total\s*hL\s*0(?:\.0+)?\s*m\b/i.test(text));
    }).map((label) => label.dataset.pipeId).filter(Boolean));
    return pipeIds.every((pipeId) => readyPipeIds.has(pipeId));
  }

  function hasDirtyPumpPanel(panel) {
    const sections = Array.from(panel?.querySelectorAll?.('.pump-live-param-section') || []).map((node) => normalizeText(node.textContent));
    const labels = Array.from(panel?.querySelectorAll?.('.pump-live-param-label') || []).map((node) => normalizeText(node.textContent));
    const canonicalSections = sections.map((section) => {
      const upper = section.toUpperCase();
      if (upper.startsWith('STATUS')) return 'STATUS';
      if (upper.startsWith('SUCTION')) return 'SUCTION';
      if (upper.startsWith('DISCHARGE')) return 'DISCHARGE';
      return upper;
    });
    const duplicateSection = canonicalSections.some((section, index) => canonicalSections.indexOf(section) !== index);
    const duplicateStatusRows = labels.filter((label) => label === 'Hydraulic NPSH' || label === 'Backend Valid.')
      .some((label, index, all) => all.indexOf(label) !== index);
    const dirtyLabel = labels.some((label) => /^(Route|Suction Loss|Disch\.? Loss|Discharge Loss|Basis Vapor Press\.?|Fluid Vapor Press\.?|NPSH Vapor Press\.?|Vapor Press\.?|Vapor Press\. Used|Pump Head)$/i.test(label));
    const dirtySection = sections.some((section) => /ROUTE\s*TRACE/i.test(section));
    return duplicateSection || duplicateStatusRows || dirtyLabel || dirtySection;
  }

  function canvasIsDisplayClean() {
    if (!hasDocument()) return true;
    const canvas = document.getElementById('canvas') || document;
    return Array.from(canvas.querySelectorAll?.('.pump-live-params') || []).every((panel) => !hasDirtyPumpPanel(panel));
  }

  function runFinalCleanup(options = {}) {
    if (!hasDocument()) return;
    const force = options.force === true;
    const now = nowMs();
    if (activeSession && !force && now - (activeSession.lastFinalCleanupAt || 0) < FINAL_CLEANUP_THROTTLE_MS) return;
    if (activeSession) activeSession.lastFinalCleanupAt = now;
    requestReadinessRuntimes();
    const canvas = document.getElementById('canvas') || document;
    try {
      root.EngineeringRouteTraceAudit?.pruneDefaultCanvasRouteTraceOverlays?.(canvas);
    } catch (error) {
      console.warn('Open file readiness cleanup could not prune route trace overlays.', error);
    }
    try {
      root.refreshPipeCanvasHydraulicLabels?.(document);
    } catch (error) {
      console.warn('Open file readiness cleanup could not refresh pipe canvas labels.', error);
    }
  }

  function cleanFrames(count = CLEAN_FRAME_COUNT) {
    return new Promise((resolve) => {
      const step = (remaining) => {
        if (remaining <= 0) return resolve();
        root.requestAnimationFrame?.(() => step(remaining - 1)) || root.setTimeout?.(() => step(remaining - 1), 16);
      };
      step(count);
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => root.setTimeout?.(resolve, ms) || resolve());
  }

  async function waitForPostCleanupReadiness(session) {
    const startedAt = nowMs();
    while (activeSession === session && nowMs() - startedAt < POST_CLEANUP_READY_MS) {
      if (canvasIsDisplayClean() && pipeHydraulicLabelsReady()) return true;
      await cleanFrames(1);
      await sleep(80);
    }
    return canvasIsDisplayClean() && pipeHydraulicLabelsReady();
  }

  async function finishSession(status = 'ready') {
    if (!activeSession || activeSession.finishing) return;
    activeSession.finishing = true;
    setPhase('finalizing', status === 'warning' ? 'Finalizing display with calculation warning.' : 'Finalizing display.');
    activeSession.warning = status === 'warning';
    runFinalCleanup({ force: true });
    await cleanFrames();
    runFinalCleanup({ force: true });
    await cleanFrames();
    const session = activeSession;
    if (!session || session !== activeSession) return;
    const postCleanupReady = await waitForPostCleanupReadiness(session);
    if (activeSession !== session) return;
    if (status === 'ready' && !postCleanupReady) {
      status = 'warning';
      activeSession.warning = true;
      renderOverlay();
    }
    activeSession.phase = 'ready';
    renderOverlay();
    dispatchGateEvent(status, { status });
    root.setTimeout?.(() => {
      if (activeSession !== session) return;
      observer?.disconnect?.();
      observer = null;
      activeSession = null;
      loopTimer = clearTimer(loopTimer);
      restoreOpenSensitiveControls();
      document.body.classList.remove(ACTIVE_CLASS, WARNING_CLASS);
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay) {
        overlay.dataset.visible = 'false';
        overlay.dataset.state = status;
      }
    }, 80);
  }

  function readinessLoop() {
    if (!activeSession) return;
    const elapsed = nowMs() - activeSession.startedAt;
    if (elapsed > MAX_WAIT_MS) {
      activeSession.warning = true;
      finishSession('warning');
      return;
    }
    if (elapsed > 120 && activeSession.phase === 'reading') setPhase('validating', 'Checking the simulation file structure.');
    if (elapsed > 260 && activeSession.phase === 'validating') setPhase('solving', 'Refreshing hydraulic calculation evidence.');
    if (canvasHasLoadedModel() && ['reading', 'validating', 'solving'].includes(activeSession.phase)) {
      setPhase('updating', 'Updating canvas readouts.');
    }
    if (elapsed > 420) runFinalCleanup();
    const pipeLabelsReady = pipeHydraulicLabelsReady();
    if (!pipeLabelsReady && elapsed > 520 && activeSession.phase === 'updating') {
      activeSession.note = 'Preparing pipe/fitting/valve parameter labels.';
      renderOverlay();
    }
    const quiet = nowMs() - activeSession.lastMutationAt >= QUIET_MS;
    const readyEvidence = elapsed >= MIN_VISIBLE_MS
      && canvasHasLoadedModel()
      && canvasIsDisplayClean()
      && pipeLabelsReady;
    if (readyEvidence) {
      if (!activeSession.firstReadyEvidenceAt) activeSession.firstReadyEvidenceAt = nowMs();
    } else {
      activeSession.firstReadyEvidenceAt = 0;
    }
    const stableEvidence = readyEvidence
      && activeSession.firstReadyEvidenceAt
      && nowMs() - activeSession.firstReadyEvidenceAt >= STABLE_READY_EVIDENCE_MS;
    const ready = readyEvidence && (quiet || stableEvidence);
    if (ready) {
      finishSession('ready');
      return;
    }
    loopTimer = root.setTimeout?.(readinessLoop, LOOP_MS) || 0;
  }

  function beginOpenGate(fileName = '') {
    if (!hasDocument()) return null;
    installCss();
    ensureOverlay();
    observer?.disconnect?.();
    loopTimer = clearTimer(loopTimer);
    restoreOpenSensitiveControls();
    const startedAt = nowMs();
    activeSession = {
      id: Date.now(),
      fileName,
      startedAt,
      lastMutationAt: startedAt,
      phase: 'reading',
      note: 'Reading selected simulation file.',
      warning: false,
      finishing: false,
      lastPipeLabelRefreshAt: 0,
      lastFinalCleanupAt: 0,
      firstReadyEvidenceAt: 0
    };
    document.body.classList.add(ACTIVE_CLASS);
    document.body.classList.remove(WARNING_CLASS);
    disableOpenSensitiveControls();
    renderOverlay();
    observeCanvas();
    requestReadinessRuntimes();
    dispatchGateEvent('reading');
    loopTimer = root.setTimeout?.(readinessLoop, LOOP_MS) || 0;
    return activeSession;
  }

  function handleFileChange(event) {
    const input = event.target;
    if (!input?.matches?.(FILE_INPUT_SELECTOR)) return;
    const file = input.files?.[0];
    if (!isUntirtaFile(file)) return;
    beginOpenGate(file.name || 'simulation.untirta');
  }

  function handleLifecycleEvent(event) {
    if (!activeSession) return;
    const detail = event?.detail || {};
    const status = String(detail.status || detail.phase || '').toLowerCase();
    if (/applying|result|linked|current|complete/.test(status) || event.type === 'npsh:linked-views-refreshed') {
      activeSession.lastMutationAt = nowMs();
      if (activeSession.phase !== 'finalizing') setPhase('updating', 'Applying latest calculation results.');
    }
    if (/error|failed|warning/.test(status) || /error/i.test(event.type)) {
      activeSession.warning = true;
    }
  }

  function install() {
    if (installed || !hasDocument()) return false;
    installed = true;
    installCss();
    ensureOverlay();
    document.addEventListener('change', handleFileChange, true);
    [
      'npsh:calculation-applying-results',
      'npsh:linked-views-refreshed',
      'npsh:calculation-current',
      'npsh:realtime-autosolve-complete',
      'npsh:realtime-autosolve-error'
    ].forEach((eventName) => document.addEventListener(eventName, handleLifecycleEvent, true));
    return true;
  }

  if (hasDocument()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }

  return {
    version: VERSION,
    cacheKey: CACHE_KEY,
    maxWaitMs: MAX_WAIT_MS,
    minVisibleMs: MIN_VISIBLE_MS,
    quietMs: QUIET_MS,
    steps: STEPS.map((step) => ({ ...step })),
    install,
    beginOpenGate,
    finishSession,
    canvasIsDisplayClean,
    pipeHydraulicLabelsReady,
    getModelPipeIds,
    hasDirtyPumpPanel,
    isPreparing: () => Boolean(activeSession),
    state: () => activeSession ? { ...activeSession } : null
  };
});
