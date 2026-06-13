((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringCalculationProgressOverlay = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-calculation-progress-overlay.v1';
  const CACHE_KEY = '20260613-calculation-progress7';
  const STYLE_ID = 'engineeringCalculationProgressOverlayStyle';
  const OVERLAY_ID = 'engineeringCalculationProgressOverlay';
  const LIFECYCLE_EVENT = 'npsh:calculation-lifecycle';
  const SHOW_DELAY_MS = 90;
  const CURRENT_HIDE_DELAY_MS = 520;
  const ERROR_HIDE_DELAY_MS = 3200;
  const LONG_RUNNING_MS = 15000;
  const COMMAND_FALLBACK_HIDE_MS = 8000;
  const RUN_COMMAND_SELECTOR = [
    '#btn-solve',
    '#menu-run-solve',
    '#menu-refresh-calculations',
    '[data-i18n-text="menu.runHydraulicNpshEvaluation"]',
    '[data-i18n-text="menu.refreshCalculationsConnections"]'
  ].join(',');
  const SAMPLE_CASE_OPEN_SELECTOR = '[data-simulation-case-action="open"][data-simulation-case-id]';
  const SAMPLE_CASE_BROWSE_SELECTOR = '.simulation-case-menu-item:not(.simulation-case-menu-item-disabled), [data-simulation-case-id]:not([data-simulation-case-action])';

  let installed = false;
  let state = 'idle';
  let showTimer = 0;
  let hideTimer = 0;
  let longRunningTimer = 0;
  let commandFallbackTimer = 0;
  let ignoreEvidenceUntil = 0;
  let latestDetail = {};

  function hasDocument() {
    return typeof document !== 'undefined' && document?.documentElement;
  }

  function clearTimer(timer) {
    if (timer) root.clearTimeout?.(timer);
    return 0;
  }

  function eventDetail(eventOrDetail = {}) {
    return eventOrDetail?.detail && typeof eventOrDetail.detail === 'object'
      ? eventOrDetail.detail
      : (eventOrDetail && typeof eventOrDetail === 'object' ? eventOrDetail : {});
  }

  function detailText(detail = {}) {
    return [
      detail.reason,
      detail.message,
      detail.nodeId,
      ...(Array.isArray(detail.nodeIds) ? detail.nodeIds : [])
    ].filter(Boolean).join(' ');
  }

  function currentTaskFromDetail(detail = {}) {
    if (detail.task) return String(detail.task);
    const text = detailText(detail).toLowerCase();
    if (/\b(fluid|density|viscosity|vapor|vapour|temperature|specific gravity)\b/.test(text)) {
      return 'Updating fluid properties';
    }
    if (/\b(src|snk|source|sink|boundary|pressure|elevation|liquid level|tank|vessel)\b/.test(text)) {
      return 'Updating boundary conditions';
    }
    if (/\b(pipe|fitting|valve|segment|diameter|roughness|reynolds|darcy|\bk\b|minor|major|loss)\b/.test(text)) {
      return 'Recalculating pipe losses';
    }
    if (/\b(pump|npsh|npsha|npshr|curve|chart|bep|por|aor|head|efficiency|speed)\b/.test(text)) {
      return 'Updating pump NPSH and performance';
    }
    return 'Solving hydraulic network';
  }

  function calculationModeFromDetail(detail = {}) {
    return detail.calculationMode || root.__engineeringCalculationUserIntent?.calculationMode || '';
  }

  function isManualSolveMode(detail = {}) {
    return calculationModeFromDetail(detail) === 'manual-solve';
  }

  function stepRows(phase = 'solving', calculationMode = 'manual-solve') {
    const allSteps = [
      { key: 'inputs', label: 'Reading inputs' },
      { key: 'network', label: 'Solving network' },
      { key: 'results', label: 'Updating results' },
      { key: 'evidence', label: 'Refreshing evidence' }
    ];
    const steps = calculationMode === 'menu-browse'
      ? allSteps.slice(0, 1)
      : calculationMode === 'sample-open'
        ? allSteps.slice(0, 3)
        : allSteps;
    const activeIndex = phase === 'inputs' ? 0
      : phase === 'results' ? 2
        : phase === 'evidence' || phase === 'complete' ? 3
          : 1;
    return steps.map((step, index) => ({
      ...step,
      status: phase === 'complete' || index < activeIndex ? 'done' : (index === activeIndex ? 'active' : 'pending')
    }));
  }

  function installCss() {
    if (!hasDocument() || document.getElementById(STYLE_ID)) return false;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#engineeringCalculationProgressOverlay {
  position: fixed;
  inset: 0;
  z-index: 5400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 140ms ease, visibility 140ms ease;
}
#engineeringCalculationProgressOverlay[data-visible="true"] {
  opacity: 1;
  visibility: visible;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.12);
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-dialog {
  position: relative;
  width: min(360px, calc(100vw - 32px));
  border: 1px solid #c9dced;
  border-radius: 7px;
  background: #ffffff;
  color: #0f314d;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-header {
  padding: 9px 12px;
  background: #123f60;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-body {
  display: grid;
  gap: 8px;
  padding: 10px 12px 11px;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-task {
  color: #123b5a;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-steps {
  display: grid;
  gap: 4px;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-step {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  color: #475569;
  font-size: 11.5px;
  line-height: 1.25;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-symbol {
  color: #94a3b8;
  font-weight: 700;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-step[data-status="done"] .engineering-calculation-progress-symbol {
  color: #15803d;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-step[data-status="active"] {
  color: #0f314d;
  font-weight: 600;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-step[data-status="active"] .engineering-calculation-progress-symbol {
  color: #0b74bd;
}
#engineeringCalculationProgressOverlay .engineering-calculation-progress-note {
  color: #64748b;
  font-size: 10.5px;
  line-height: 1.35;
}
#engineeringCalculationProgressOverlay[data-state="error"] .engineering-calculation-progress-header {
  background: #7c2d12;
}
#engineeringCalculationProgressOverlay[data-state="error"] .engineering-calculation-progress-task {
  color: #7c2d12;
}
@media (max-width: 420px) {
  #engineeringCalculationProgressOverlay {
    align-items: flex-start;
    padding-top: 72px;
  }
  #engineeringCalculationProgressOverlay .engineering-calculation-progress-dialog {
    width: min(320px, calc(100vw - 24px));
  }
}
`;
    document.head.appendChild(style);
    return true;
  }

  function ensureOverlay() {
    if (!hasDocument()) return null;
    installCss();
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('role', 'status');
    overlay.dataset.visible = 'false';
    overlay.dataset.state = 'idle';
    overlay.innerHTML = `
      <div class="engineering-calculation-progress-backdrop" aria-hidden="true"></div>
      <section class="engineering-calculation-progress-dialog" aria-label="Calculation progress">
        <div class="engineering-calculation-progress-header">Calculation in Progress</div>
        <div class="engineering-calculation-progress-body">
          <div class="engineering-calculation-progress-task">Solving hydraulic network</div>
          <div class="engineering-calculation-progress-steps"></div>
          <div class="engineering-calculation-progress-note">Results will refresh automatically.</div>
        </div>
      </section>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderOverlay({ phase = 'solving', detail = latestDetail, errorMessage = '' } = {}) {
    const overlay = ensureOverlay();
    if (!overlay) return null;
    const isError = phase === 'error';
    overlay.dataset.state = isError ? 'error' : state;
    const header = overlay.querySelector('.engineering-calculation-progress-header');
    const task = overlay.querySelector('.engineering-calculation-progress-task');
    const steps = overlay.querySelector('.engineering-calculation-progress-steps');
    const note = overlay.querySelector('.engineering-calculation-progress-note');
    if (header) header.textContent = isError ? 'Calculation Failed' : 'Calculation in Progress';
    if (task) task.textContent = isError ? (errorMessage || 'Backend recalculation failed') : currentTaskFromDetail(detail);
    if (steps) {
      steps.innerHTML = stepRows(isError ? 'complete' : phase, calculationModeFromDetail(detail)).map((step) => {
        const symbol = step.status === 'done' ? '\u2713' : (step.status === 'active' ? '\u25cf' : '\u25cb');
        return `<div class="engineering-calculation-progress-step" data-status="${step.status}">
          <span class="engineering-calculation-progress-symbol">${symbol}</span>
          <span>${step.label}</span>
        </div>`;
      }).join('');
    }
    if (note) note.textContent = isError ? 'Last valid result is still shown.' : (detail.message || 'Results will refresh automatically.');
    return overlay;
  }

  function showOverlay(phase = 'solving', detail = latestDetail) {
    state = phase === 'error' ? 'error' : (phase === 'evidence' ? 'refreshing' : 'calculating');
    const overlay = renderOverlay({ phase, detail });
    if (!overlay) return false;
    overlay.dataset.visible = 'true';
    return true;
  }

  function hideOverlay() {
    state = 'idle';
    showTimer = clearTimer(showTimer);
    hideTimer = clearTimer(hideTimer);
    longRunningTimer = clearTimer(longRunningTimer);
    commandFallbackTimer = clearTimer(commandFallbackTimer);
    const overlay = hasDocument() ? document.getElementById(OVERLAY_ID) : null;
    if (overlay) {
      overlay.dataset.visible = 'false';
      overlay.dataset.state = 'idle';
    }
    return true;
  }

  function scheduleShow(detail = {}, phase = 'solving') {
    latestDetail = detail;
    state = 'calculating';
    showTimer = clearTimer(showTimer);
    hideTimer = clearTimer(hideTimer);
    renderOverlay({ phase, detail });
    showTimer = root.setTimeout?.(() => {
      showTimer = 0;
      if (state === 'calculating') showOverlay(phase, detail);
    }, SHOW_DELAY_MS) || 0;
    longRunningTimer = clearTimer(longRunningTimer);
    longRunningTimer = root.setTimeout?.(() => {
      if (state === 'calculating') {
        showOverlay('solving', {
          ...latestDetail,
          reason: `${latestDetail.reason || 'Backend recalculation is still running.'} This is taking longer than usual.`
        });
      }
    }, LONG_RUNNING_MS) || 0;
    return true;
  }

  function showImmediate(detail = {}, phase = 'solving') {
    latestDetail = detail;
    showTimer = clearTimer(showTimer);
    hideTimer = clearTimer(hideTimer);
    showOverlay(phase, detail);
    longRunningTimer = clearTimer(longRunningTimer);
    longRunningTimer = root.setTimeout?.(() => {
      if (state === 'calculating') {
        showOverlay('solving', {
          ...latestDetail,
          reason: `${latestDetail.reason || 'Backend recalculation is still running.'} This is taking longer than usual.`
        });
      }
    }, LONG_RUNNING_MS) || 0;
    return true;
  }

  function hasRecentCalculationIntent(windowMs = 8000) {
    const lifecycle = root.EngineeringCalculationLifecycle;
    if (typeof lifecycle?.hasRecentCalculationActivity === 'function') {
      return lifecycle.hasRecentCalculationActivity(windowMs);
    }
    const intentAt = Number(root.__engineeringCalculationUserIntentAt || 0);
    return Number.isFinite(intentAt) && intentAt > 0 && Date.now() - intentAt <= windowMs;
  }

  function scheduleHide(delayMs = CURRENT_HIDE_DELAY_MS, options = {}) {
    ignoreEvidenceUntil = Date.now() + delayMs + 260;
    const overlay = hasDocument() ? document.getElementById(OVERLAY_ID) : null;
    const wasVisible = overlay?.dataset.visible === 'true';
    const showEvidence = options.showEvidence === undefined ? isManualSolveMode(latestDetail) : !!options.showEvidence;
    showTimer = clearTimer(showTimer);
    longRunningTimer = clearTimer(longRunningTimer);
    hideTimer = clearTimer(hideTimer);
    commandFallbackTimer = clearTimer(commandFallbackTimer);
    if (wasVisible && state === 'calculating' && showEvidence) {
      state = 'refreshing';
      showOverlay('evidence', { ...latestDetail, calculationMode: 'manual-solve' });
    } else if (!wasVisible) {
      hideOverlay();
      return true;
    }
    hideTimer = root.setTimeout?.(() => hideOverlay(), delayMs) || 0;
    return true;
  }

  function handleCalculating(event) {
    if (!hasRecentCalculationIntent()) return false;
    if (calculationModeFromDetail(eventDetail(event)) === 'menu-browse') return false;
    return scheduleShow(eventDetail(event), 'solving');
  }

  function handleAutoSolveStart(event) {
    if (!hasRecentCalculationIntent()) return false;
    if (calculationModeFromDetail(eventDetail(event)) === 'menu-browse') return false;
    return showImmediate(eventDetail(event), 'solving');
  }

  function phaseFromLifecycle(detail = {}) {
    if (detail.phase) return detail.phase === 'complete' ? 'evidence' : detail.phase;
    switch (detail.status) {
      case 'input-changed':
      case 'preparing':
      case 'waiting-debounce':
        return 'inputs';
      case 'applying-results':
        return 'results';
      case 'refreshing-evidence':
        return 'evidence';
      case 'failed':
        return 'error';
      case 'calculating':
      default:
        return 'solving';
    }
  }

  function handleLifecycle(event) {
    const detail = eventDetail(event);
    if ((detail.status === 'refreshing-evidence' || detail.phase === 'evidence') && Date.now() < ignoreEvidenceUntil) {
      return true;
    }
    if (detail.status === 'failed' || detail.phase === 'error') {
      return handleError({ detail });
    }
    if (detail.status === 'current') {
      return scheduleHide(CURRENT_HIDE_DELAY_MS, { showEvidence: isManualSolveMode(detail) });
    }
    const phase = phaseFromLifecycle(detail);
    showImmediate(detail, phase);
    const mode = calculationModeFromDetail(detail);
    if (mode === 'menu-browse') {
      return scheduleHide(650, { showEvidence: false });
    }
    if (mode === 'sample-open' && (detail.status === 'applying-results' || phase === 'results')) {
      return scheduleHide(900, { showEvidence: false });
    }
    if (mode === 'manual-solve' && (detail.status === 'applying-results' || phase === 'results')) {
      return scheduleHide(900, { showEvidence: true });
    }
    if (detail.status === 'refreshing-evidence' || phase === 'evidence') {
      return scheduleHide(CURRENT_HIDE_DELAY_MS, { showEvidence: false });
    }
    if (detail.status === 'input-changed' || detail.status === 'preparing' || detail.status === 'waiting-debounce') {
      commandFallbackTimer = root.setTimeout?.(() => {
        if (state === 'calculating' || state === 'refreshing') scheduleHide(CURRENT_HIDE_DELAY_MS);
      }, COMMAND_FALLBACK_HIDE_MS) || 0;
    }
    return true;
  }

  function handleLinkedViews(event) {
    if (Date.now() < ignoreEvidenceUntil) return true;
    if (state !== 'calculating' && state !== 'refreshing') return false;
    if (!isManualSolveMode(latestDetail)) return false;
    const lifecycle = root.EngineeringCalculationLifecycle;
    if (lifecycle?.hasRecentCalculationActivity && !lifecycle.hasRecentCalculationActivity()) return false;
    latestDetail = { ...latestDetail, ...eventDetail(event), calculationMode: 'manual-solve' };
    showOverlay('evidence', latestDetail);
    scheduleHide(CURRENT_HIDE_DELAY_MS, { showEvidence: false });
    return true;
  }

  function handleCurrent() {
    return scheduleHide(CURRENT_HIDE_DELAY_MS, { showEvidence: isManualSolveMode(latestDetail) });
  }

  function handleStale(event) {
    const detail = eventDetail(event);
    const text = detailText(detail);
    if (/failed|error/i.test(text)) return handleError(event);
    showTimer = clearTimer(showTimer);
    if (state !== 'calculating' && state !== 'refreshing') hideOverlay();
    return true;
  }

  function handleError(event) {
    if (!hasRecentCalculationIntent()) return false;
    const detail = eventDetail(event);
    const message = detail.message || detail.reason || 'Backend recalculation failed';
    showTimer = clearTimer(showTimer);
    longRunningTimer = clearTimer(longRunningTimer);
    state = 'error';
    renderOverlay({ phase: 'error', detail, errorMessage: message });
    const overlay = ensureOverlay();
    if (overlay) overlay.dataset.visible = 'true';
    hideTimer = clearTimer(hideTimer);
    hideTimer = root.setTimeout?.(() => hideOverlay(), ERROR_HIDE_DELAY_MS) || 0;
    return true;
  }

  function handleRunCommand(event) {
    const target = event?.target?.closest?.(`${RUN_COMMAND_SELECTOR}, ${SAMPLE_CASE_OPEN_SELECTOR}, ${SAMPLE_CASE_BROWSE_SELECTOR}`);
    if (!target) return false;
    if (target.matches?.(SAMPLE_CASE_OPEN_SELECTOR)) {
      root.__engineeringCalculationUserIntentAt = Date.now();
      root.__engineeringCalculationUserIntent = {
        source: 'sample-case-open',
        calculationMode: 'sample-open',
        caseId: target.dataset?.simulationCaseId || '',
        updatedAt: new Date().toISOString()
      };
      return true;
    }
    if (!target.closest?.(RUN_COMMAND_SELECTOR) && target.closest?.(SAMPLE_CASE_BROWSE_SELECTOR)) {
      root.__engineeringCalculationUserIntentAt = Date.now();
      root.__engineeringCalculationUserIntent = {
        source: 'simulation-menu-browse',
        calculationMode: 'menu-browse',
        caseId: target.closest?.('[data-simulation-case-id]')?.dataset?.simulationCaseId || '',
        updatedAt: new Date().toISOString()
      };
      showImmediate({
        calculationMode: 'menu-browse',
        task: 'Reading inputs',
        message: 'Reading simulation case menu.'
      }, 'inputs');
      return scheduleHide(650, { showEvidence: false });
    }
    root.__engineeringCalculationUserIntentAt = Date.now();
    root.__engineeringCalculationUserIntent = {
      source: 'manual-command',
      calculationMode: 'manual-solve',
      nodeId: target.id || '',
      updatedAt: new Date().toISOString()
    };
    showImmediate({
      calculationMode: 'manual-solve',
      reason: target.id === 'menu-refresh-calculations'
        ? 'Refreshing calculations and connections.'
        : 'Run Hydraulic / NPSH Evaluation started.',
      nodeId: target.id || ''
    }, 'inputs');
    commandFallbackTimer = root.setTimeout?.(() => {
      if (state === 'calculating' || state === 'refreshing') scheduleHide(CURRENT_HIDE_DELAY_MS);
    }, COMMAND_FALLBACK_HIDE_MS) || 0;
    return true;
  }

  function install() {
    if (!hasDocument() || installed) return false;
    installed = true;
    installCss();
    document.addEventListener('click', handleRunCommand, true);
    document.addEventListener(LIFECYCLE_EVENT, handleLifecycle);
    document.addEventListener('npsh:calculation-calculating', handleCalculating);
    document.addEventListener('npsh:realtime-autosolve-start', handleAutoSolveStart);
    document.addEventListener('npsh:linked-views-refreshed', handleLinkedViews);
    document.addEventListener('npsh:calculation-current', handleCurrent);
    document.addEventListener('npsh:realtime-autosolve-complete', handleCurrent);
    document.addEventListener('npsh:calculation-stale', handleStale);
    document.addEventListener('npsh:realtime-autosolve-error', handleError);
    return true;
  }

  function uninstall() {
    if (!hasDocument() || !installed) return false;
    document.removeEventListener('click', handleRunCommand, true);
    document.removeEventListener(LIFECYCLE_EVENT, handleLifecycle);
    document.removeEventListener('npsh:calculation-calculating', handleCalculating);
    document.removeEventListener('npsh:realtime-autosolve-start', handleAutoSolveStart);
    document.removeEventListener('npsh:linked-views-refreshed', handleLinkedViews);
    document.removeEventListener('npsh:calculation-current', handleCurrent);
    document.removeEventListener('npsh:realtime-autosolve-complete', handleCurrent);
    document.removeEventListener('npsh:calculation-stale', handleStale);
    document.removeEventListener('npsh:realtime-autosolve-error', handleError);
    installed = false;
    hideOverlay();
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    showDelayMs: SHOW_DELAY_MS,
    currentHideDelayMs: CURRENT_HIDE_DELAY_MS,
    errorHideDelayMs: ERROR_HIDE_DELAY_MS,
    commandFallbackHideMs: COMMAND_FALLBACK_HIDE_MS,
    install,
    uninstall,
    showOverlay,
    hideOverlay,
    currentTaskFromDetail,
    stepRows
  };

  if (hasDocument()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
      install();
    }
  }

  return api;
});
