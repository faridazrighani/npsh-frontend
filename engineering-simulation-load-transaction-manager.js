((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringSimulationLoadTransaction = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-simulation-load-transaction-manager.v6-stale-promise-clean';
  const CACHE_KEY = '20260712-simulation-load-stale-promise-clean1';
  const ACTIVE_CLASS = 'npsh-simulation-load-transaction-active';
  const CASE_OPEN_SELECTOR = '[data-simulation-case-action="open"][data-simulation-case-id]';
  const SAMPLE_DIALOG_OPEN_TEXT = /open\s+sample\s+case/i;
  const FILE_INPUT_SELECTOR = 'input[type="file"]';
  const SIMULATION_MANIFEST_URL = 'journals/simulation-cases.json';
  const SESSION_HEADER = 'X-NPSH-Load-Session';
  const TRANSACTION_IDLE_COMPLETE_MS = 7000;
  const FINAL_CLEANUP_DELAY_MS = 180;
  const RETAINED_SESSION_SIGNAL_LIMIT = 8;
  const SETTLE_WATCHDOG_DELAYS_MS = [220, 900, 2200, 5200];
  const BUSY_LABEL_PATTERN = /\b(calculating|applying|refreshing|opening|loading|validating)\b/i;
  const VISUAL_REFRESH_FUNCTIONS = [
    'refreshPipeCanvasHydraulicLabels',
    'updateCanvasWarningPanel',
    'refreshBackendProtectedSimulationUi',
    'refreshBackendProtectedRealtimeTaskWindows',
    'refreshBackendProtectedSelectedObjectTaskWindow',
    'refreshBackendProtectedPumpChart'
  ];
  const SINGLE_INSTALL_VISUAL_REFRESH_FUNCTIONS = new Set(['updateCanvasWarningPanel']);
  const VISUAL_REFRESH_PATCH_RETRY_DELAYS_MS = [400, 1200, 3000, 6000];
  const WARM_CASE_IDS = ['simulation-case-1', 'simulation-case-4', 'simulation-case-6'];
  const WARM_RUNTIME_SOURCES = [
    'engineering-pipe-canvas-hydraulic-label-runtime-20260707-pfv-loss-summary-clean1.js?v=20260711-reynolds-darcy-flash-lock1',
    'engineering-route-trace-audit-20260704-sink-pabs-dedupe1.js?v=20260712-sink-canvas-template-lock1',
    'engineering-pump-envelope-warning-cleanup-runtime.js?v=20260712-warning-lifecycle-current-request-lock1',
    'engineering-open-file-readiness-gate.js?v=20260711-open-file-hard-release1'
  ];
  const EVENT_NAMES = {
    begin: 'npsh:simulation-load-transaction-begin',
    abort: 'npsh:simulation-load-transaction-abort',
    stale: 'npsh:simulation-load-transaction-stale-result',
    cleanup: 'npsh:simulation-load-workspace-cleanup',
    watchdog: 'npsh:simulation-load-settle-watchdog',
    complete: 'npsh:simulation-load-transaction-complete',
    failed: 'npsh:simulation-load-transaction-failed'
  };

  let installed = false;
  let sequence = 0;
  let activeSession = null;
  let originalFetch = null;
  let displayCleanupFrame = 0;
  let visualRefreshFlushFrame = 0;
  let visualRefreshFlushing = false;
  let pendingDisplayCleanupOptions = null;
  let visualRefreshPatchRetriesScheduled = false;
  let settleWatchdogTimers = [];
  const warmScriptPromises = new Map();
  const warmCaseCache = new Map();
  const fileSessionIds = typeof WeakMap === 'function' ? new WeakMap() : null;
  const responseSessionIds = typeof WeakMap === 'function' ? new WeakMap() : null;
  const fileReaderSessionIds = typeof WeakMap === 'function' ? new WeakMap() : null;
  const fileReaderListenerWrappers = typeof WeakMap === 'function' ? new WeakMap() : null;
  const sessionSignals = new Map();
  const visualRefreshOriginals = new Map();
  const visualRefreshPatchedNames = new Set();
  const visualRefreshQueue = new Map();
  const cleanupStats = {
    sequence: 0,
    lastCleanupAt: '',
    lastReason: '',
    taskWindowsClosed: 0,
    artifactsRemoved: 0,
    sessionSignalsPruned: 0,
    displayCleanupRuns: 0
  };
  const visualRefreshStats = {
    patched: 0,
    deferred: 0,
    flushed: 0,
    cleared: 0,
    flushes: 0,
    lastReason: ''
  };
  const settleWatchdogStats = {
    scheduled: 0,
    audits: 0,
    releases: 0,
    activeClassCleared: 0,
    visualQueueFlushed: 0,
    readinessForced: 0,
    lastReason: '',
    lastActions: []
  };

  function hasDocument() {
    return typeof document !== 'undefined' && !!document.documentElement;
  }

  function nowMs() {
    return root.performance?.now?.() || Date.now();
  }

  function wallTimeIso() {
    return new Date().toISOString();
  }

  function cloneDetail(detail = {}) {
    return Object.assign({}, detail || {});
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function dispatch(name, detail = {}) {
    if (!hasDocument() || typeof root.CustomEvent !== 'function') return false;
    try {
      document.dispatchEvent(new root.CustomEvent(name, { detail }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function createAbortError(message = 'Simulation load transaction was superseded.') {
    if (typeof root.DOMException === 'function') {
      return new root.DOMException(message, 'AbortError');
    }
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
  }

  function sessionSnapshot(session = activeSession) {
    if (!session) return null;
    return {
      version: VERSION,
      cacheKey: CACHE_KEY,
      sessionId: session.sessionId,
      source: session.source,
      detail: cloneDetail(session.detail),
      status: session.status,
      reason: session.reason || '',
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt || '',
      abortedAt: session.abortedAt || '',
      appliedAt: session.appliedAt || '',
      signalAborted: !!session.signal?.aborted,
      cleanupCount: session.cleanupFns.length,
      controllerCount: session.controllers.length,
      timerCount: session.timers.length,
      fileReaderCount: session.fileReaders.length,
      awaitingAuthoritativeCalculation: !!session.awaitingAuthoritativeCalculation,
      cleanup: cleanupSummary(),
      visualRefresh: visualRefreshSummary(),
      settleWatchdog: settleWatchdogSummary()
    };
  }

  function isCurrent(sessionId) {
    return Boolean(activeSession && activeSession.sessionId === sessionId && activeSession.status !== 'aborted');
  }

  function sessionSignal(sessionId = activeSession?.sessionId) {
    return sessionId ? sessionSignals.get(sessionId) || null : null;
  }

  function sessionById(sessionId = activeSession?.sessionId) {
    return activeSession && activeSession.sessionId === sessionId ? activeSession : null;
  }

  function cleanupSummary() {
    return Object.assign({}, cleanupStats, {
      visualRefresh: visualRefreshSummary()
    });
  }

  function noteCleanup(detail = {}) {
    cleanupStats.sequence += 1;
    cleanupStats.lastCleanupAt = wallTimeIso();
    cleanupStats.lastReason = String(detail.reason || detail.source || cleanupStats.lastReason || 'simulation-load');
    cleanupStats.taskWindowsClosed += Number(detail.taskWindowsClosed || 0);
    cleanupStats.artifactsRemoved += Number(detail.artifactsRemoved || 0);
    cleanupStats.sessionSignalsPruned += Number(detail.sessionSignalsPruned || 0);
    cleanupStats.displayCleanupRuns += Number(detail.displayCleanupRuns || 0);
    dispatch(EVENT_NAMES.cleanup, Object.assign({
      version: VERSION,
      cacheKey: CACHE_KEY,
      sequence: cleanupStats.sequence,
      at: cleanupStats.lastCleanupAt
    }, detail, cleanupSummary()));
    return cleanupSummary();
  }

  function pruneSessionSignalCache(retainSessionId = activeSession?.sessionId) {
    if (!sessionSignals.size) return 0;
    let pruned = 0;
    Array.from(sessionSignals.keys()).forEach((sessionId) => {
      if (sessionId === retainSessionId) return;
      if (sessionSignals.size <= RETAINED_SESSION_SIGNAL_LIMIT) return;
      sessionSignals.delete(sessionId);
      pruned += 1;
    });
    return pruned;
  }

  function visualRefreshSummary() {
    return {
      queueSize: visualRefreshQueue.size,
      patched: Array.from(visualRefreshOriginals.keys()),
      stats: Object.assign({}, visualRefreshStats)
    };
  }

  function settleWatchdogSummary() {
    return Object.assign({}, settleWatchdogStats, {
      pendingTimers: settleWatchdogTimers.length
    });
  }

  function clearSettleWatchdogs(reason = 'settle-watchdog-clear') {
    const timers = settleWatchdogTimers.splice(0);
    timers.forEach((timer) => root.clearTimeout?.(timer));
    if (timers.length) settleWatchdogStats.lastReason = reason;
    return timers.length;
  }

  function commandReleaseNeeded() {
    return runCommandElements().some((element) => {
      const label = normalizeText(element.querySelector?.('.ribbon-label, [data-command-label], .menu-item-label')?.textContent || '');
      return !!element.disabled
        || element.dataset?.calculationBusy === 'true'
        || element.getAttribute?.('aria-busy') === 'true'
        || element.getAttribute?.('aria-disabled') === 'true'
        || BUSY_LABEL_PATTERN.test(label);
    });
  }

  function forceReadinessGateRelease(reason = 'simulation-load-settle-watchdog') {
    const gate = root.EngineeringOpenFileReadinessGate;
    if (!gate?.state?.()) return false;
    try {
      gate.finishSession?.('warning');
      settleWatchdogStats.readinessForced += 1;
      return true;
    } catch (error) {
      console.warn('Simulation load settle watchdog could not release open-file readiness gate.', reason, error);
      return false;
    }
  }

  function auditSettledUi(reason = 'simulation-load-settle-watchdog', options = {}) {
    const stillActive = activeSession?.status === 'active';
    if (stillActive) return { skipped: true, reason, actions: ['active-session'] };
    const actions = [];
    settleWatchdogStats.audits += 1;
    settleWatchdogStats.lastReason = reason;

    if (commandReleaseNeeded()) {
      releaseRunCommandLocks(reason);
      settleWatchdogStats.releases += 1;
      actions.push('release-run-command');
    }

    if (hasDocument() && document.body.classList.contains(ACTIVE_CLASS)) {
      document.body.classList.remove(ACTIVE_CLASS);
      settleWatchdogStats.activeClassCleared += 1;
      actions.push('clear-simulation-load-active-class');
    }

    if (visualRefreshQueue.size) {
      const flushed = flushVisualRefreshQueue(reason);
      if (flushed) {
        settleWatchdogStats.visualQueueFlushed += flushed;
        actions.push('flush-visual-refresh');
      }
    }

    if (options.forceReadiness && forceReadinessGateRelease(reason)) {
      actions.push('force-open-file-readiness-release');
    }

    if (actions.length) {
      settleWatchdogStats.lastActions = actions.slice();
      dispatch(EVENT_NAMES.watchdog, {
        version: VERSION,
        cacheKey: CACHE_KEY,
        reason,
        actions,
        at: wallTimeIso(),
        summary: settleWatchdogSummary()
      });
    }
    return { skipped: false, reason, actions };
  }

  function scheduleSettleWatchdogs(reason = 'simulation-load-settled') {
    clearSettleWatchdogs('settle-watchdog-reschedule');
    settleWatchdogStats.scheduled += 1;
    settleWatchdogStats.lastReason = reason;
    SETTLE_WATCHDOG_DELAYS_MS.forEach((delay, index) => {
      const timer = root.setTimeout?.(() => {
        settleWatchdogTimers = settleWatchdogTimers.filter((item) => item !== timer);
        auditSettledUi(`${reason}:watchdog-${delay}`, {
          forceReadiness: index === SETTLE_WATCHDOG_DELAYS_MS.length - 1
        });
      }, delay);
      if (timer) settleWatchdogTimers.push(timer);
    });
    return settleWatchdogTimers.length;
  }

  function shouldDeferVisualRefresh() {
    return Boolean(activeSession && activeSession.status === 'active' && !visualRefreshFlushing);
  }

  function clearVisualRefreshQueue(reason = 'visual-refresh-cleared') {
    const count = visualRefreshQueue.size;
    if (count) {
      visualRefreshQueue.clear();
      visualRefreshStats.cleared += count;
      visualRefreshStats.lastReason = reason;
    }
    return count;
  }

  function discardQueuedVisualRefresh(name, reason = 'visual-refresh-covered-by-display-cleanup') {
    if (!visualRefreshQueue.has(name)) return false;
    visualRefreshQueue.delete(name);
    visualRefreshStats.cleared += 1;
    visualRefreshStats.lastReason = reason;
    return true;
  }

  function flushVisualRefreshQueue(reason = 'visual-refresh-flush') {
    if (!visualRefreshQueue.size || shouldDeferVisualRefresh()) return 0;
    const jobs = Array.from(visualRefreshQueue.values());
    visualRefreshQueue.clear();
    let flushed = 0;
    visualRefreshFlushing = true;
    visualRefreshStats.flushes += 1;
    visualRefreshStats.lastReason = reason;
    jobs.forEach((job) => {
      const original = visualRefreshOriginals.get(job.name)
        || root[job.name]?.__simulationLoadVisualRefreshOriginal;
      if (typeof original !== 'function') return;
      try {
        original.apply(job.thisArg || root, job.args || []);
        flushed += 1;
      } catch (error) {
        console.warn('Simulation load transaction visual refresh flush failed.', job.name, error);
      }
    });
    visualRefreshStats.flushed += flushed;
    visualRefreshFlushing = false;
    if (flushed) {
      noteCleanup({
        reason,
        visualRefreshFlushed: flushed
      });
    }
    return flushed;
  }

  function requestVisualRefreshFlush(reason = 'visual-refresh-flush') {
    if (!visualRefreshQueue.size || shouldDeferVisualRefresh()) return false;
    if (visualRefreshFlushFrame) return true;
    const schedule = root.requestAnimationFrame || ((fn) => root.setTimeout?.(fn, 16));
    visualRefreshFlushFrame = schedule(() => {
      visualRefreshFlushFrame = 0;
      flushVisualRefreshQueue(reason);
    });
    return true;
  }

  function patchVisualRefreshFunction(name) {
    const singleInstall = SINGLE_INSTALL_VISUAL_REFRESH_FUNCTIONS.has(name);
    if (singleInstall && visualRefreshPatchedNames.has(name)) return false;
    const original = root[name];
    if (typeof original !== 'function' || original.__simulationLoadVisualRefreshPatched) return false;
    const patched = function patchedSimulationLoadVisualRefresh(...args) {
      if (!shouldDeferVisualRefresh()) return original.apply(this, args);
      const sessionId = activeSession?.sessionId || '';
      visualRefreshQueue.set(name, {
        name,
        args,
        thisArg: this,
        sessionId,
        queuedAt: wallTimeIso()
      });
      visualRefreshStats.deferred += 1;
      visualRefreshStats.lastReason = 'simulation-load-active';
      return 0;
    };
    patched.__simulationLoadVisualRefreshPatched = true;
    patched.__simulationLoadVisualRefreshOriginal = original;
    visualRefreshOriginals.set(name, original);
    if (singleInstall) visualRefreshPatchedNames.add(name);
    root[name] = patched;
    visualRefreshStats.patched += 1;
    return true;
  }

  function patchVisualRefreshFunctions() {
    let patched = 0;
    VISUAL_REFRESH_FUNCTIONS.forEach((name) => {
      if (patchVisualRefreshFunction(name)) patched += 1;
    });
    return patched;
  }

  function scheduleVisualRefreshPatchRetries() {
    if (visualRefreshPatchRetriesScheduled) return false;
    visualRefreshPatchRetriesScheduled = true;
    VISUAL_REFRESH_PATCH_RETRY_DELAYS_MS.forEach((delay) => {
      root.setTimeout?.(() => patchVisualRefreshFunctions(), delay);
    });
    return true;
  }

  function clearSessionTimerEntry(session, timer) {
    if (!session || !timer) return false;
    root.clearTimeout?.(timer);
    session.timers = session.timers.filter((entry) => entry.timer !== timer);
    if (session.idleTimer === timer) session.idleTimer = 0;
    return true;
  }

  function clearSessionTimer(session) {
    if (session?.idleTimer) clearSessionTimerEntry(session, session.idleTimer);
  }

  function clearAllSessionTimers(session) {
    if (!session?.timers?.length) return false;
    session.timers.splice(0).forEach((entry) => {
      root.clearTimeout?.(entry.timer);
    });
    session.idleTimer = 0;
    return true;
  }

  function abortSessionFileReaders(session) {
    if (!session?.fileReaders?.length) return false;
    session.fileReaders.splice(0).forEach((entry) => {
      try {
        if (entry.reader?.readyState === 1) entry.reader.abort?.();
      } catch (error) {
        // FileReader abort is best-effort; stale event guards still block results.
      }
    });
    return true;
  }

  function runCommandElements() {
    if (!hasDocument()) return [];
    try {
      return Array.from(document.querySelectorAll([
        '#btn-solve',
        '#menu-run-solve',
        '#menu-refresh-calculations',
        '[data-i18n-text="menu.runHydraulicNpshEvaluation"]',
        '[data-i18n-text="menu.refreshCalculationsConnections"]'
      ].join(',')));
    } catch (error) {
      return [];
    }
  }

  function closeLoadDropdowns(reason = 'simulation-load-settled') {
    if (!hasDocument()) return false;
    const active = document.activeElement;
    let changed = false;
    const guardedRelease = root.EngineeringDropdownFocusGuardRuntime?.releaseFocusBeforeHide;
    Array.from(document.querySelectorAll('.dropdown-content, .dropdown-submenu-content, [role="menu"]')).forEach((element) => {
      try {
        guardedRelease?.(element);
      } catch (error) {
        // Dropdown focus cleanup is defensive only.
      }
      element.setAttribute?.('aria-hidden', 'true');
      changed = true;
    });
    Array.from(document.querySelectorAll('.menu-dropdown.show, .dropdown-submenu.show-submenu')).forEach((element) => {
      element.classList.remove('show', 'show-submenu');
      changed = true;
    });
    Array.from(document.querySelectorAll('.dropdown-submenu-trigger[aria-expanded="true"], .menu-item[aria-expanded="true"]')).forEach((element) => {
      element.setAttribute('aria-expanded', 'false');
      changed = true;
    });
    if (active?.closest?.('.dropdown-content, .dropdown-submenu-content, .menu-dropdown')) {
      try {
        active.blur?.();
      } catch (error) {
        // Focus release should never block loading cleanup.
      }
    }
    document.body.dataset.simulationLoadMenusClosedAt = wallTimeIso();
    document.body.dataset.simulationLoadMenusClosedReason = reason;
    return changed;
  }

  function releaseRunCommandLocks(reason = 'simulation-load-transaction-settled') {
    const detail = {
      calculationMode: 'sample-open',
      reason,
      sourceEvent: reason,
      message: 'Simulation load transaction settled; Validate is ready.'
    };
    try {
      root.EngineeringCalculationLifecycle?.releaseRunCommand?.(reason, detail);
    } catch (error) {
      // Lifecycle runtime is optional during early startup.
    }
    try {
      root.EngineeringCalculationLifecycle?.setRunCommandBusy?.(false, {
        status: 'current',
        task: 'Current',
        calculationMode: 'sample-open',
        updatedAt: wallTimeIso()
      });
    } catch (error) {
      // Direct DOM fallback below still releases the visible command.
    }
    runCommandElements().forEach((element) => {
      const label = element.querySelector?.('.ribbon-label, [data-command-label], .menu-item-label');
      if ('disabled' in element) element.disabled = false;
      element.removeAttribute?.('disabled');
      element.setAttribute?.('aria-busy', 'false');
      element.setAttribute?.('aria-disabled', 'false');
      element.dataset.calculationBusy = 'false';
      if (label) {
        label.textContent = element.dataset.calculationLifecycleOriginalLabel
          || (element.id === 'btn-solve' ? 'Validate' : label.textContent || 'Validate');
      }
    });
    return true;
  }

  function abortSession(session, reason = 'superseded') {
    if (!session || session.status === 'aborted') return false;
    session.status = 'aborted';
    session.reason = reason;
    session.abortedAt = wallTimeIso();
    session.updatedAt = session.abortedAt;
    clearSessionTimer(session);
    clearAllSessionTimers(session);
    abortSessionFileReaders(session);
    clearVisualRefreshQueue(`simulation-load-transaction-abort:${reason}`);
    session.controllers.splice(0).forEach((entry) => {
      try {
        entry.controller?.abort?.();
      } catch (error) {
        // Abort hooks are best-effort cleanup only.
      }
    });
    session.cleanupFns.splice(0).forEach((entry) => {
      try {
        entry.fn();
      } catch (error) {
        console.warn('Simulation load transaction cleanup failed.', entry.label || error);
      }
    });
    dispatch(EVENT_NAMES.abort, sessionSnapshot(session));
    closeLoadDropdowns('simulation-load-transaction-abort');
    releaseRunCommandLocks('simulation-load-transaction-abort');
    scheduleSettleWatchdogs(`simulation-load-transaction-abort:${reason}`);
    return true;
  }

  function abortPrevious(reason = 'superseded') {
    const previous = activeSession;
    if (!previous) return false;
    const aborted = abortSession(previous, reason);
    if (activeSession === previous) activeSession = null;
    root.__npshActiveSimulationLoadSessionId = '';
    if (hasDocument()) document.body.classList.remove(ACTIVE_CLASS);
    return aborted;
  }

  function registerCleanup(fn, label = '') {
    if (!activeSession || typeof fn !== 'function') return false;
    activeSession.cleanupFns.push({ fn, label: String(label || '') });
    return true;
  }

  function registerController(controller, label = '') {
    if (!activeSession || !controller || typeof controller.abort !== 'function') return controller;
    activeSession.controllers.push({ controller, label: String(label || '') });
    return controller;
  }

  function createSessionAbortController(label = 'session-controller') {
    if (typeof root.AbortController !== 'function') return null;
    const controller = new root.AbortController();
    return { controller, label };
  }

  function createAbortSignalForSession(session, label = 'simulation-load', externalSignal = null) {
    if (!session || typeof root.AbortController !== 'function') return externalSignal || undefined;
    if (!externalSignal) {
      const controller = registerController(new root.AbortController(), label);
      return controller?.signal || undefined;
    }
    if (root.AbortSignal?.any && session.signal) {
      try {
        return root.AbortSignal.any([externalSignal, session.signal]);
      } catch (error) {
        // Fall back to a linked controller below.
      }
    }
    const controller = registerController(new root.AbortController(), `${label}:linked-signal`);
    const abortLinked = () => {
      try {
        controller.abort?.();
      } catch (error) {
        // AbortController is best-effort when external signals are unusual.
      }
    };
    if (externalSignal.aborted || session.signal?.aborted) {
      abortLinked();
    } else {
      externalSignal.addEventListener?.('abort', abortLinked, { once: true });
      session.signal?.addEventListener?.('abort', abortLinked, { once: true });
      session.cleanupFns.push({
        label: `${label}:linked-signal-cleanup`,
        fn: () => {
          externalSignal.removeEventListener?.('abort', abortLinked);
          session.signal?.removeEventListener?.('abort', abortLinked);
        }
      });
    }
    return controller.signal;
  }

  function setSessionTimeout(fn, delay = 0, label = 'session-timeout', sessionId = activeSession?.sessionId) {
    const session = sessionById(sessionId);
    if (!session || typeof fn !== 'function') return 0;
    const timer = root.setTimeout?.(() => {
      clearSessionTimerEntry(session, timer);
      if (!isCurrent(sessionId)) {
        dispatch(EVENT_NAMES.stale, {
          version: VERSION,
          cacheKey: CACHE_KEY,
          sessionId,
          currentSessionId: activeSession?.sessionId || '',
          label,
          ignoredAt: wallTimeIso()
        });
        return;
      }
      fn(sessionSnapshot(session));
    }, Math.max(0, Number(delay) || 0)) || 0;
    if (timer) session.timers.push({ timer, label: String(label || '') });
    return timer;
  }

  function scheduleIdleComplete(session) {
    clearSessionTimer(session);
    session.idleTimer = setSessionTimeout(() => {
      complete(session.sessionId, {
        reason: 'idle-complete',
        message: 'Simulation load transaction settled without a pending load event.'
      });
    }, TRANSACTION_IDLE_COMPLETE_MS, 'transaction-idle-complete', session.sessionId);
  }

  function beginTransaction(source = 'simulation-load', detail = {}) {
    if (activeSession && activeSession.status === 'active') abortSession(activeSession, 'superseded-by-new-load');
    clearSettleWatchdogs('simulation-load-transaction-begin');
    clearVisualRefreshQueue('simulation-load-transaction-begin');
    const startedAt = wallTimeIso();
    const primaryAbort = createSessionAbortController('session-primary');
    const session = {
      sessionId: `simload-${Date.now().toString(36)}-${++sequence}`,
      source: String(source || 'simulation-load'),
      detail: cloneDetail(detail),
      status: 'active',
      reason: '',
      startedAt,
      updatedAt: startedAt,
      completedAt: '',
      abortedAt: '',
      appliedAt: '',
      startedAtMs: nowMs(),
      cleanupFns: [],
      controllers: primaryAbort ? [primaryAbort] : [],
      signal: primaryAbort?.controller?.signal || null,
      timers: [],
      fileReaders: [],
      idleTimer: 0,
      awaitingAuthoritativeCalculation: false
    };
    activeSession = session;
    if (session.signal) sessionSignals.set(session.sessionId, session.signal);
    root.__npshActiveSimulationLoadSessionId = session.sessionId;
    if (hasDocument()) document.body.classList.add(ACTIVE_CLASS);
    cleanWorkspaceForLoad({ source: session.source, sessionId: session.sessionId });
    scheduleIdleComplete(session);
    dispatch(EVENT_NAMES.begin, sessionSnapshot(session));
    warmRuntime();
    return sessionSnapshot(session);
  }

  function markApplied(sessionId = activeSession?.sessionId, detail = {}) {
    if (!isCurrent(sessionId)) return false;
    activeSession.appliedAt = wallTimeIso();
    activeSession.updatedAt = activeSession.appliedAt;
    activeSession.detail = Object.assign({}, activeSession.detail, cloneDetail(detail));
    return true;
  }

  function complete(sessionId = activeSession?.sessionId, detail = {}) {
    if (!isCurrent(sessionId)) return false;
    if (activeSession.status === 'completed') return sessionSnapshot(activeSession);
    if (activeSession.status !== 'active') return false;
    activeSession.status = 'completed';
    activeSession.reason = detail.reason || 'completed';
    activeSession.completedAt = wallTimeIso();
    activeSession.updatedAt = activeSession.completedAt;
    clearSessionTimer(activeSession);
    const snapshot = sessionSnapshot(activeSession);
    root.setTimeout?.(() => {
      if (activeSession?.sessionId !== sessionId) return;
      requestDisplayCleanup({ force: true }, detail.reason || 'simulation-load-transaction-complete');
      if (hasDocument()) document.body.classList.remove(ACTIVE_CLASS);
      closeLoadDropdowns(detail.reason || 'simulation-load-transaction-complete');
    }, FINAL_CLEANUP_DELAY_MS);
    dispatch(EVENT_NAMES.complete, Object.assign(snapshot, cloneDetail(detail)));
    closeLoadDropdowns(detail.reason || 'simulation-load-transaction-complete');
    releaseRunCommandLocks(detail.reason || 'simulation-load-transaction-complete');
    scheduleSettleWatchdogs(detail.reason || 'simulation-load-transaction-complete');
    return snapshot;
  }

  function fail(sessionId = activeSession?.sessionId, error = null) {
    if (!isCurrent(sessionId)) return false;
    if (activeSession.status !== 'active') return false;
    activeSession.status = 'failed';
    activeSession.reason = error?.message || String(error || 'failed');
    activeSession.completedAt = wallTimeIso();
    activeSession.updatedAt = activeSession.completedAt;
    clearSessionTimer(activeSession);
    clearVisualRefreshQueue('simulation-load-transaction-failed');
    if (hasDocument()) document.body.classList.remove(ACTIVE_CLASS);
    const snapshot = sessionSnapshot(activeSession);
    dispatch(EVENT_NAMES.failed, snapshot);
    closeLoadDropdowns('simulation-load-transaction-failed');
    releaseRunCommandLocks('simulation-load-transaction-failed');
    scheduleSettleWatchdogs('simulation-load-transaction-failed');
    return snapshot;
  }

  function bindFileToSession(file, sessionId = activeSession?.sessionId) {
    if (!file || !fileSessionIds || !sessionId) return false;
    try {
      fileSessionIds.set(file, sessionId);
      return true;
    } catch (error) {
      return false;
    }
  }

  function markStaleResultIgnored(sessionId, label = 'simulation-load') {
    const detail = {
      version: VERSION,
      cacheKey: CACHE_KEY,
      sessionId,
      currentSessionId: activeSession?.sessionId || '',
      label,
      ignoredAt: wallTimeIso(),
      ignored: true,
      stale: true,
      aborted: true
    };
    dispatch(EVENT_NAMES.stale, {
      ...detail
    });
    releaseRunCommandLocks('simulation-load-transaction-stale-result');
    scheduleSettleWatchdogs('simulation-load-transaction-stale-result');
    root.__npshLastIgnoredSimulationLoadResult = detail;
    return detail;
  }

  function assertSessionStillCurrent(sessionId, label = 'simulation-load') {
    if (!sessionId || isCurrent(sessionId)) return true;
    markStaleResultIgnored(sessionId, label);
    throw createAbortError(`Ignored stale ${label} result from a previous simulation load.`);
  }

  function guardAsyncResult(sessionId, label = 'simulation-load', value) {
    const signal = sessionSignal(sessionId);
    if (value && typeof value.then === 'function') {
      return new Promise((resolve, reject) => {
        let settled = false;
        const onAbort = () => {
          if (settled) return;
          settled = true;
          dispatch(EVENT_NAMES.stale, {
            version: VERSION,
            cacheKey: CACHE_KEY,
            sessionId,
            currentSessionId: activeSession?.sessionId || '',
            label,
            ignoredAt: wallTimeIso()
          });
          releaseRunCommandLocks('simulation-load-transaction-abort-async-result');
          reject(createAbortError(`Aborted stale ${label} from a previous simulation load.`));
        };
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener?.('abort', onAbort, { once: true });
        Promise.resolve(value).then((resolved) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener?.('abort', onAbort);
          try {
            assertSessionStillCurrent(sessionId, label);
            resolve(resolved);
          } catch (error) {
            reject(error);
          }
        }, (error) => {
          if (settled) return;
          settled = true;
          signal?.removeEventListener?.('abort', onAbort);
          reject(error);
        });
      });
    }
    assertSessionStillCurrent(sessionId, label);
    return value;
  }

  function requestUrlString(resource) {
    if (!resource) return '';
    if (typeof resource === 'string') return resource;
    if (typeof URL !== 'undefined' && resource instanceof URL) return resource.href;
    return String(resource.url || resource.href || '');
  }

  function isSameOriginPath(urlText) {
    if (!urlText) return false;
    if (/^(?:https?:)?\/\//i.test(urlText)) {
      try {
        return new URL(urlText, root.location?.href || 'http://localhost/').origin === root.location?.origin;
      } catch (error) {
        return false;
      }
    }
    return true;
  }

  function isSimulationLoadResource(urlText) {
    const text = String(urlText || '');
    if (!isSameOriginPath(text)) return false;
    return /\/api\/simulate(?:[?#]|$)/i.test(text)
      || /(?:^|\/)api\/simulate(?:[?#]|$)/i.test(text)
      || /\.untirta(?:[?#]|$)/i.test(text)
      || /journals\/simulation-cases\.json(?:[?#]|$)/i.test(text)
      || /journals\/simulasi_\d+\//i.test(text);
  }

  function isApiSimulationResource(urlText) {
    const text = String(urlText || '');
    return /\/api\/simulate(?:[?#]|$)/i.test(text) || /(?:^|\/)api\/simulate(?:[?#]|$)/i.test(text);
  }

  function shouldAutoBeginFromFetch(urlText) {
    if (activeSession || !/\.untirta(?:[?#]|$)/i.test(String(urlText || ''))) return false;
    const intent = root.__engineeringCalculationUserIntent || {};
    const intentAge = Date.now() - Number(root.__engineeringCalculationUserIntentAt || 0);
    return intent.calculationMode === 'sample-open' && intentAge >= 0 && intentAge < 30000;
  }

  function mergeSessionHeader(init = {}, sessionId = '') {
    if (!sessionId || !isApiSimulationResource(init.__npshRequestUrl || '')) return init;
    try {
      const headers = new root.Headers(init.headers || {});
      headers.set(SESSION_HEADER, sessionId);
      return Object.assign({}, init, { headers });
    } catch (error) {
      return init;
    }
  }

  function patchFetch() {
    if (typeof root.fetch !== 'function' || root.fetch.__simulationLoadTransactionPatched) return false;
    originalFetch = root.fetch;
    const patchedFetch = function patchedSimulationLoadFetch(resource, init = {}) {
      const urlText = requestUrlString(resource);
      if (shouldAutoBeginFromFetch(urlText)) {
        beginTransaction('simulation-case-fetch', { url: urlText });
      }
      const session = activeSession && activeSession.status === 'active' && isSimulationLoadResource(urlText)
        ? activeSession
        : null;
      let nextInit = init || {};
      if (session && typeof root.AbortController === 'function' && !nextInit.signal) {
        const signal = createAbortSignalForSession(session, urlText, nextInit.signal);
        if (signal) nextInit = Object.assign({}, nextInit, { signal });
      } else if (session && nextInit.signal) {
        const signal = createAbortSignalForSession(session, urlText, nextInit.signal);
        if (signal) nextInit = Object.assign({}, nextInit, { signal });
      }
      if (session && isApiSimulationResource(urlText)) {
        nextInit = mergeSessionHeader(Object.assign({}, nextInit, { __npshRequestUrl: urlText }), session.sessionId);
        delete nextInit.__npshRequestUrl;
      }
      const boundSessionId = session?.sessionId || '';
      return originalFetch.call(this, resource, nextInit).then((response) => {
        if (boundSessionId && responseSessionIds && response && typeof response === 'object') {
          try {
            responseSessionIds.set(response, boundSessionId);
          } catch (error) {
            // WeakMap binding is a guard optimization only.
          }
        }
        if (boundSessionId) assertSessionStillCurrent(boundSessionId, urlText || 'fetch');
        return response;
      }, (error) => {
        if (boundSessionId && error?.name === 'AbortError') {
          dispatch(EVENT_NAMES.stale, {
            version: VERSION,
            cacheKey: CACHE_KEY,
            sessionId: boundSessionId,
            currentSessionId: activeSession?.sessionId || '',
            label: urlText || 'fetch',
            ignoredAt: wallTimeIso()
          });
        }
        throw error;
      });
    };
    patchedFetch.__simulationLoadTransactionPatched = true;
    patchedFetch.__simulationLoadTransactionOriginal = originalFetch;
    root.fetch = patchedFetch;
    return true;
  }

  function patchResponseBodyMethod(name) {
    const proto = root.Response?.prototype;
    const original = proto?.[name];
    if (!proto || typeof original !== 'function' || original.__simulationLoadTransactionPatched) return false;
    const patched = function patchedSimulationLoadResponseBody(...args) {
      const sessionId = responseSessionIds?.get?.(this) || '';
      return Promise.resolve(original.apply(this, args)).then((value) => {
        if (sessionId) assertSessionStillCurrent(sessionId, `response.${name}`);
        return value;
      });
    };
    patched.__simulationLoadTransactionPatched = true;
    patched.__simulationLoadTransactionOriginal = original;
    proto[name] = patched;
    return true;
  }

  function patchFileArrayBuffer() {
    const proto = root.File?.prototype;
    const original = proto?.arrayBuffer;
    if (!proto || typeof original !== 'function' || original.__simulationLoadTransactionPatched) return false;
    const patched = function patchedSimulationLoadFileArrayBuffer(...args) {
      const sessionId = fileSessionIds?.get?.(this) || '';
      return Promise.resolve(original.apply(this, args)).then((buffer) => {
        if (sessionId) assertSessionStillCurrent(sessionId, this?.name || 'file.arrayBuffer');
        return buffer;
      });
    };
    patched.__simulationLoadTransactionPatched = true;
    patched.__simulationLoadTransactionOriginal = original;
    proto.arrayBuffer = patched;
    return true;
  }

  function bindFileReaderToSession(reader, sessionId = '') {
    if (!reader || !fileReaderSessionIds || !sessionId) return false;
    try {
      fileReaderSessionIds.set(reader, sessionId);
      const session = sessionById(sessionId);
      if (session && !session.fileReaders.some((entry) => entry.reader === reader)) {
        session.fileReaders.push({ reader, label: 'FileReader' });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function blockStaleFileReaderEvent(event, sessionId, label = 'FileReader') {
    if (!sessionId || isCurrent(sessionId)) return false;
    dispatch(EVENT_NAMES.stale, {
      version: VERSION,
      cacheKey: CACHE_KEY,
      sessionId,
      currentSessionId: activeSession?.sessionId || '',
      label,
      ignoredAt: wallTimeIso()
    });
    releaseRunCommandLocks('simulation-load-transaction-stale-filereader');
    scheduleSettleWatchdogs('simulation-load-transaction-stale-filereader');
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    try {
      if (event?.target?.readyState === 1) event.target.abort?.();
    } catch (error) {
      // A finished FileReader cannot always be aborted; blocking the event is the guard.
    }
    return true;
  }

  function patchFileReaderMethod(name) {
    const proto = root.FileReader?.prototype;
    const original = proto?.[name];
    if (!proto || typeof original !== 'function' || original.__simulationLoadTransactionPatched) return false;
    const patched = function patchedSimulationLoadFileReaderRead(file, ...args) {
      const sessionId = fileSessionIds?.get?.(file) || activeSession?.sessionId || '';
      if (sessionId) {
        assertSessionStillCurrent(sessionId, `FileReader.${name}`);
        bindFileReaderToSession(this, sessionId);
        wrapFileReaderHandlerProperty(this, 'onload', 'load');
        wrapFileReaderHandlerProperty(this, 'onloadend', 'loadend');
        const guard = (event) => {
          const boundSessionId = fileReaderSessionIds?.get?.(this) || sessionId;
          blockStaleFileReaderEvent(event, boundSessionId, `FileReader.${name}`);
        };
        this.addEventListener?.('load', guard, { capture: true, once: true });
        this.addEventListener?.('loadend', guard, { capture: true, once: true });
      }
      return original.call(this, file, ...args);
    };
    patched.__simulationLoadTransactionPatched = true;
    patched.__simulationLoadTransactionOriginal = original;
    proto[name] = patched;
    return true;
  }

  function isGuardedFileReaderEventType(type) {
    return ['load', 'loadend'].includes(String(type || '').toLowerCase());
  }

  function getFileReaderListenerMap(reader) {
    if (!fileReaderListenerWrappers || !reader) return null;
    let map = fileReaderListenerWrappers.get(reader);
    if (!map) {
      map = new Map();
      fileReaderListenerWrappers.set(reader, map);
    }
    return map;
  }

  function fileReaderListenerKey(type, listener) {
    return `${String(type || '').toLowerCase()}::${String(listener && typeof listener === 'object' ? 'object' : 'function')}`;
  }

  function wrapFileReaderListener(reader, type, listener) {
    if (!isGuardedFileReaderEventType(type) || !listener) return listener;
    const map = getFileReaderListenerMap(reader);
    if (!map) return listener;
    const key = fileReaderListenerKey(type, listener);
    let listenerMap = map.get(key);
    if (!listenerMap) {
      listenerMap = typeof WeakMap === 'function' ? new WeakMap() : new Map();
      map.set(key, listenerMap);
    }
    if (listenerMap.has(listener)) return listenerMap.get(listener);
    const wrapped = typeof listener === 'function'
      ? function guardedFileReaderListener(event) {
        const sessionId = fileReaderSessionIds?.get?.(this) || '';
        if (blockStaleFileReaderEvent(event, sessionId, `FileReader.${type}`)) return undefined;
        return listener.call(this, event);
      }
      : {
        handleEvent(event) {
          const sessionId = fileReaderSessionIds?.get?.(reader) || '';
          if (blockStaleFileReaderEvent(event, sessionId, `FileReader.${type}`)) return undefined;
          return listener.handleEvent?.call?.(listener, event);
        }
      };
    listenerMap.set(listener, wrapped);
    return wrapped;
  }

  function unwrapFileReaderListener(reader, type, listener) {
    if (!isGuardedFileReaderEventType(type) || !listener || !fileReaderListenerWrappers) return listener;
    const map = fileReaderListenerWrappers.get(reader);
    const listenerMap = map?.get?.(fileReaderListenerKey(type, listener));
    return listenerMap?.get?.(listener) || listener;
  }

  function patchFileReaderEventListeners() {
    const proto = root.FileReader?.prototype;
    if (!proto || proto.__simulationLoadTransactionEventListenersPatched) return false;
    const originalAdd = proto.addEventListener;
    const originalRemove = proto.removeEventListener;
    if (typeof originalAdd === 'function') {
      proto.addEventListener = function patchedFileReaderAddEventListener(type, listener, options) {
        return originalAdd.call(this, type, wrapFileReaderListener(this, type, listener), options);
      };
    }
    if (typeof originalRemove === 'function') {
      proto.removeEventListener = function patchedFileReaderRemoveEventListener(type, listener, options) {
        return originalRemove.call(this, type, unwrapFileReaderListener(this, type, listener), options);
      };
    }
    proto.__simulationLoadTransactionEventListenersPatched = true;
    return true;
  }

  function wrapFileReaderHandlerProperty(reader, propName, eventType) {
    const handler = reader?.[propName];
    if (typeof handler !== 'function' || handler.__simulationLoadTransactionHandlerWrapped) return false;
    const wrapped = function guardedFileReaderHandler(event) {
      const sessionId = fileReaderSessionIds?.get?.(this) || '';
      if (blockStaleFileReaderEvent(event, sessionId, `FileReader.${eventType}`)) return undefined;
      return handler.call(this, event);
    };
    wrapped.__simulationLoadTransactionHandlerWrapped = true;
    wrapped.__simulationLoadTransactionOriginal = handler;
    try {
      reader[propName] = wrapped;
      return true;
    } catch (error) {
      return false;
    }
  }

  function patchFileReaderMethods() {
    patchFileReaderEventListeners();
    ['readAsText', 'readAsArrayBuffer', 'readAsBinaryString', 'readAsDataURL'].forEach(patchFileReaderMethod);
    return true;
  }

  function patchApplySimulationStateAtomic() {
    const original = root.applySimulationStateAtomic;
    if (typeof original !== 'function' || original.__simulationLoadTransactionPatched) return false;
    const patched = function patchedApplySimulationStateAtomic(...args) {
      const session = activeSession && activeSession.status === 'active'
        ? activeSession
        : beginTransaction('atomic-project-apply', { reason: 'applySimulationStateAtomic called directly' });
      assertSessionStillCurrent(session.sessionId, 'applySimulationStateAtomic');
      const active = sessionById(session.sessionId);
      if (active) active.awaitingAuthoritativeCalculation = true;
      const originalUpdateSimulation = root.updateSimulation;
      let calculationPromise = null;
      function captureLoadedSimulationCalculation(...updateArgs) {
        const options = updateArgs[0] && typeof updateArgs[0] === 'object'
          ? { ...updateArgs[0] }
          : {};
        options.forceBackend = true;
        options.trigger = 'solve';
        options.refreshReason = 'solve';
        options.calculationMode = 'sample-open';
        options.simulationLoadReason = 'simulation-load-authoritative';
        calculationPromise = originalUpdateSimulation.call(this, options, ...updateArgs.slice(1));
        return calculationPromise;
      }
      if (typeof originalUpdateSimulation === 'function') {
        root.updateSimulation = captureLoadedSimulationCalculation;
      }
      const restoreUpdateSimulation = () => {
        if (root.updateSimulation === captureLoadedSimulationCalculation) {
          root.updateSimulation = originalUpdateSimulation;
        }
      };
      const ensureAuthoritativeCalculation = () => {
        if (calculationPromise || typeof originalUpdateSimulation !== 'function') return calculationPromise;
        calculationPromise = originalUpdateSimulation.call(root, {
          forceBackend: true,
          trigger: 'solve',
          refreshReason: 'solve',
          calculationMode: 'sample-open',
          simulationLoadReason: 'simulation-load-authoritative',
          renderSidebarAfter: false
        });
        return calculationPromise;
      };
      const hasPrimaryApplyEvidence = (outcome) => {
        if (outcome?.primaryApplied === true) return true;
        if (!Array.isArray(outcome)) return false;
        return outcome.some((entry) => (
          entry?.primaryApplied === true
          || entry?.value?.primaryApplied === true
          || entry?.status === 'fulfilled' && entry?.value?.primaryApplied === true
        ));
      };
      const runDirectAuthoritativeCalculation = () => {
        if (typeof root.runBackendProtectedPumpSimulation !== 'function') return Promise.resolve([]);
        const pumpIds = typeof root.getBackendProtectedPumpIds === 'function'
          ? root.getBackendProtectedPumpIds()
          : [];
        const current = sessionById(session.sessionId);
        if (current) {
          current.detail.authoritativeFallbackUsed = true;
          current.detail.authoritativePumpIds = Array.isArray(pumpIds) ? pumpIds.slice() : [];
        }
        if (!Array.isArray(pumpIds) || !pumpIds.length) return Promise.resolve([]);
        return Promise.allSettled(pumpIds.map((pumpId) => root.runBackendProtectedPumpSimulation(pumpId, {
          forceBackend: true,
          trigger: 'solve',
          refreshReason: 'solve',
          calculationMode: 'sample-open',
          simulationLoadReason: 'simulation-load-authoritative-fallback',
          renderSidebarAfter: false
        })));
      };
      const requirePrimaryApplyEvidence = (outcome) => {
        if (hasPrimaryApplyEvidence(outcome)) return outcome;
        return runDirectAuthoritativeCalculation();
      };
      const finalizeAppliedState = (value) => Promise.resolve(calculationPromise)
        .then(requirePrimaryApplyEvidence)
        .then((calculationOutcome) => {
        assertSessionStillCurrent(session.sessionId, 'applySimulationStateAtomic.calculation');
        const current = sessionById(session.sessionId);
        if (current) current.awaitingAuthoritativeCalculation = false;
        markApplied(session.sessionId, {
          appliedBy: 'applySimulationStateAtomic',
          calculationAwaited: true,
          primaryApplied: hasPrimaryApplyEvidence(calculationOutcome)
        });
        complete(session.sessionId, { reason: 'project-state-calculated' });
        return value;
      });
      try {
        const result = original.apply(this, args);
        restoreUpdateSimulation();
        ensureAuthoritativeCalculation();
        if (result && typeof result.then === 'function') {
          return Promise.resolve(result).then((value) => finalizeAppliedState(value)).catch((error) => {
            if (isCurrent(session.sessionId)) fail(session.sessionId, error);
            throw error;
          });
        }
        return finalizeAppliedState(result).catch((error) => {
          if (isCurrent(session.sessionId)) fail(session.sessionId, error);
          throw error;
        });
      } catch (error) {
        restoreUpdateSimulation();
        if (isCurrent(session.sessionId)) fail(session.sessionId, error);
        throw error;
      }
    };
    patched.__simulationLoadTransactionPatched = true;
    patched.__simulationLoadTransactionOriginal = original;
    root.applySimulationStateAtomic = patched;
    return true;
  }

  function patchOpenSimulationCaseSample() {
    const original = root.openSimulationCaseSample;
    if (typeof original !== 'function' || original.__simulationLoadTransactionPatched) return false;
    const patched = function patchedOpenSimulationCaseSample(entry, ...args) {
      const detail = {
        caseId: entry?.id || '',
        title: entry?.title || entry?.menuTitle || '',
        sampleFile: entry?.sampleFile || ''
      };
      const session = activeSession && activeSession.status === 'active'
        ? activeSession
        : beginTransaction('simulation-case', detail);
      return Promise.resolve(original.call(this, entry, ...args)).then((result) => {
        if (!isCurrent(session.sessionId)) {
          return markStaleResultIgnored(session.sessionId, 'openSimulationCaseSample.resolve');
        }
        if (isCurrent(session.sessionId) && !sessionById(session.sessionId)?.awaitingAuthoritativeCalculation) {
          complete(session.sessionId, { reason: 'simulation-case-opened' });
        }
        return result;
      }, (error) => {
        if (!isCurrent(session.sessionId) && error?.name === 'AbortError') {
          return markStaleResultIgnored(session.sessionId, 'openSimulationCaseSample.reject');
        }
        if (isCurrent(session.sessionId)) fail(session.sessionId, error);
        throw error;
      });
    };
    patched.__simulationLoadTransactionPatched = true;
    patched.__simulationLoadTransactionOriginal = original;
    root.openSimulationCaseSample = patched;
    return true;
  }

  function cleanWarningPanel() {
    if (!hasDocument()) return false;
    const panel = document.getElementById('canvasWarningPanel');
    const list = document.getElementById('canvasWarningList');
    const count = document.getElementById('canvasWarningCount');
    if (list) {
      list.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'canvas-warning-empty';
      empty.textContent = 'No active warnings';
      list.appendChild(empty);
    }
    if (count) count.textContent = '0';
    if (panel) {
      panel.hidden = true;
      panel.classList.remove('has-warnings');
    }
    return true;
  }

  function blurIfContainsFocus(element) {
    const active = hasDocument() ? document.activeElement : null;
    if (active && element?.contains?.(active)) {
      try {
        active.blur?.();
      } catch (error) {
        // Focus cleanup is defensive only.
      }
    }
  }

  function removeElementSafely(element) {
    if (!element?.parentNode) return 0;
    blurIfContainsFocus(element);
    try {
      element.hidden = true;
    } catch (error) {
      // Some elements may not expose a writable hidden property.
    }
    element.remove?.();
    return 1;
  }

  function clearObjectTaskMinimizedDock() {
    if (!hasDocument()) return 0;
    const dock = document.getElementById('objectTaskMinimizedDock');
    if (!dock) return 0;
    const hadChildren = dock.children?.length || 0;
    dock.replaceChildren?.();
    dock.hidden = true;
    return hadChildren ? 1 : 0;
  }

  function closePrimaryTaskWindowForLoad() {
    if (!hasDocument()) return 0;
    const primary = document.getElementById('taskWindow');
    if (!primary) return 0;
    const kind = String(primary.dataset?.kind || '').trim().toLowerCase();
    if (!kind || kind === 'fluid') return 0;
    blurIfContainsFocus(primary);
    try {
      root.closeTaskWindow?.({ focusReturn: false, reason: 'simulation-load-workspace-cleanup' });
    } catch (error) {
      // Direct fallback below keeps stale object windows from staying visible.
    }
    primary.hidden = true;
    primary.classList.remove('task-window-minimized', 'task-window-user-positioned', 'task-window-resized');
    primary.dataset.simulationLoadClosedAt = wallTimeIso();
    const body = primary.querySelector?.('.task-window-body');
    body?.replaceChildren?.();
    return 1;
  }

  function cleanTaskWindowsForLoad() {
    if (!hasDocument()) return 0;
    let removed = closePrimaryTaskWindowForLoad();
    const selectors = [
      '.task-window:not(#taskWindow)',
      '.persistent-object-properties-task-window',
      '.pump-manual-npshr-task-window',
      '.route-trace-audit-panel',
      '.pipe-moody-chart-panel',
      '.pump-curve-explanation-task-window',
      '.pipe-formula-defense-task-window',
      '.pump-formula-defense-task-window',
      '.source-formula-defense-task-window',
      '.fluid-formula-defense-task-window',
      '.journal-analysis-task-window'
    ];
    const elements = new Set();
    selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((element) => elements.add(element));
      } catch (error) {
        // Invalid selector in older browsers should not block simulation loading.
      }
    });
    elements.forEach((element) => {
      if (element?.id === 'taskWindow') return;
      removed += removeElementSafely(element);
    });
    removed += clearObjectTaskMinimizedDock();
    return removed;
  }

  function cleanLoadArtifacts() {
    if (!hasDocument()) return 0;
    let removed = 0;
    const selectors = [
      '#engineeringRouteTraceAuditPanel',
      '#engineeringPipeMoodyChartPanel',
      '[data-route-audit-pump-summary="true"]',
      '[data-simulation-load-transient="true"]',
      '.simulation-load-transient',
      '.route-audit-pump-summary',
      '.pipe-moody-chart-panel',
      '.route-trace-audit-panel'
    ];
    const elements = new Set();
    selectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((element) => elements.add(element));
      } catch (error) {
        // Keep cleanup best-effort and non-blocking.
      }
    });
    elements.forEach((element) => {
      if (element?.id === 'taskWindow' || element?.id === 'canvasWarningPanel') return;
      removed += removeElementSafely(element);
    });
    return removed;
  }

  function cleanTransientCanvasArtifacts() {
    if (!hasDocument()) return 0;
    const canvas = document.getElementById('canvas') || document;
    let removed = 0;
    [
      '[data-route-trace-overlay]',
      '.route-trace-overlay',
      '.route-trace-default-overlay',
      '.engineering-route-trace-default-overlay'
    ].forEach((selector) => {
      canvas.querySelectorAll?.(selector)?.forEach((node) => {
        removed += removeElementSafely(node);
      });
    });
    return removed;
  }

  function runDisplayCleanup(options = {}) {
    if (!hasDocument()) return false;
    try {
      root.EngineeringPumpEnvelopeWarningCleanup?.sanitizeModelWarnings?.();
      root.EngineeringPumpEnvelopeWarningCleanup?.pruneCanvasWarningPanel?.();
    } catch (error) {
      console.warn('Simulation load transaction could not sanitize warning panel.', error);
    }
    try {
      root.EngineeringRouteTraceAudit?.pruneDefaultCanvasRouteTraceOverlays?.(document.getElementById('canvas') || document);
    } catch (error) {
      console.warn('Simulation load transaction could not prune route trace overlays.', error);
    }
    try {
      discardQueuedVisualRefresh('refreshPipeCanvasHydraulicLabels');
      root.refreshPipeCanvasHydraulicLabels?.(document);
    } catch (error) {
      console.warn('Simulation load transaction could not refresh pipe labels.', error);
    }
    if (options.force) {
      try {
        discardQueuedVisualRefresh('updateCanvasWarningPanel');
        root.updateCanvasWarningPanel?.();
      } catch (error) {
        // Warning panel refresh is presentational and must not block a load.
      }
    }
    flushVisualRefreshQueue(options.reason || 'display-cleanup-visual-refresh-flush');
    noteCleanup({
      reason: options.reason || 'display-cleanup',
      displayCleanupRuns: 1
    });
    return true;
  }

  function requestDisplayCleanup(options = {}, reason = 'display-cleanup') {
    if (!hasDocument()) return false;
    pendingDisplayCleanupOptions = Object.assign({}, pendingDisplayCleanupOptions || {}, options, {
      reason,
      force: !!(pendingDisplayCleanupOptions?.force || options.force)
    });
    if (displayCleanupFrame) return true;
    const schedule = root.requestAnimationFrame || ((fn) => root.setTimeout?.(fn, 16));
    displayCleanupFrame = schedule(() => {
      displayCleanupFrame = 0;
      const nextOptions = pendingDisplayCleanupOptions || {};
      pendingDisplayCleanupOptions = null;
      runDisplayCleanup(nextOptions);
    });
    return true;
  }

  function cleanWorkspaceForLoad(detail = {}) {
    root.__npshWorkspaceResetAt = wallTimeIso();
    root.__npshWorkspaceResetReason = detail.source || 'simulation-load';
    const taskWindowsClosed = cleanTaskWindowsForLoad();
    const artifactsRemoved = cleanLoadArtifacts() + cleanTransientCanvasArtifacts();
    const sessionSignalsPruned = pruneSessionSignalCache(detail.sessionId || activeSession?.sessionId);
    cleanWarningPanel();
    requestDisplayCleanup({ force: false }, detail.source || 'simulation-load-workspace-cleanup');
    noteCleanup({
      source: detail.source || 'simulation-load',
      reason: 'workspace-cleanup-before-load',
      sessionId: detail.sessionId || '',
      taskWindowsClosed,
      artifactsRemoved,
      sessionSignalsPruned
    });
    return true;
  }

  function ensureWarmScript(src) {
    if (!hasDocument() || !src) return Promise.resolve(false);
    if (warmScriptPromises.has(src)) return warmScriptPromises.get(src);
    const promise = new Promise((resolve, reject) => {
      const existing = Array.from(document.scripts || []).find((script) => String(script.getAttribute('src') || '') === src);
      if (existing) {
        if (existing.dataset.npshLoaded === 'true' || existing.readyState === 'complete') {
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
      script.dataset.simulationLoadWarmRuntime = 'true';
      script.addEventListener('load', () => {
        script.dataset.npshLoaded = 'true';
        resolve(true);
      }, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.body.appendChild(script);
    });
    warmScriptPromises.set(src, promise);
    return promise;
  }

  async function prefetchSimulationCases() {
    if (!hasDocument() || typeof root.fetch !== 'function') return warmCaseCache;
    try {
      const manifestResponse = await root.fetch(SIMULATION_MANIFEST_URL, { cache: 'force-cache' });
      if (!manifestResponse.ok) return warmCaseCache;
      const manifest = await manifestResponse.json();
      const cases = Array.isArray(manifest?.cases) ? manifest.cases : [];
      const warmCases = cases.filter((entry) => WARM_CASE_IDS.includes(String(entry?.id || '')) && entry?.sampleFile);
      await Promise.all(warmCases.map(async (entry) => {
        if (warmCaseCache.has(entry.id)) return;
        const response = await root.fetch(entry.sampleFile, { cache: 'force-cache' });
        if (!response.ok) return;
        const buffer = await response.arrayBuffer();
        warmCaseCache.set(entry.id, {
          id: entry.id,
          sampleFile: entry.sampleFile,
          bytes: buffer.byteLength,
          cachedAt: wallTimeIso()
        });
      }));
    } catch (error) {
      // Warm cache improves perceived speed but must never block simulation use.
    }
    return warmCaseCache;
  }

  function warmRuntime() {
    if (!hasDocument()) return false;
    WARM_RUNTIME_SOURCES.forEach((src) => {
      ensureWarmScript(src).catch((error) => {
        console.warn('Simulation load transaction could not warm runtime script.', error);
      });
    });
    ['__npshLoadRealtime', '__npshLoadSupport'].forEach((loaderName) => {
      const loader = root[loaderName];
      if (typeof loader !== 'function') return;
      try {
        Promise.resolve(loader()).then(() => {
          patchVisualRefreshFunctions();
        }).catch((error) => {
          console.warn('Simulation load transaction could not warm deferred runtime.', error);
        });
      } catch (error) {
        console.warn('Simulation load transaction could not start deferred runtime.', error);
      }
    });
    const idle = root.requestIdleCallback || ((fn) => root.setTimeout?.(fn, 1200));
    idle(() => prefetchSimulationCases());
    return true;
  }

  function handleSimulationCaseOpen(event) {
    const target = event?.target?.closest?.(CASE_OPEN_SELECTOR);
    const dialogButton = event?.target?.closest?.('button');
    const isDialogOpenButton = dialogButton
      && SAMPLE_DIALOG_OPEN_TEXT.test(normalizeText(dialogButton.textContent))
      && !!dialogButton.closest?.('[role="dialog"], .modal, .simulation-case-dialog, .sample-case-dialog');
    const openTarget = target || (isDialogOpenButton ? dialogButton : null);
    if (!openTarget || openTarget.disabled || openTarget.getAttribute('aria-disabled') === 'true') return false;
    const caseId = target?.dataset?.simulationCaseId
      || root.__engineeringCalculationUserIntent?.caseId
      || '';
    beginTransaction(isDialogOpenButton ? 'simulation-case-dialog-open' : 'simulation-case', {
      caseId,
      action: isDialogOpenButton ? 'open-sample-case-confirmed' : 'open-simulation-case-menu'
    });
    return true;
  }

  function handleFileChange(event) {
    const input = event?.target;
    if (!input?.matches?.(FILE_INPUT_SELECTOR)) return false;
    const file = input.files?.[0];
    if (!/\.untirta$/i.test(String(file?.name || ''))) return false;
    const session = beginTransaction('external-file', {
      fileName: file.name || 'simulation.untirta',
      fileSize: Number(file.size || 0)
    });
    bindFileToSession(file, session.sessionId);
    return true;
  }

  function handleLifecycleComplete(event) {
    if (!activeSession || activeSession.status !== 'active') return false;
    if (activeSession.awaitingAuthoritativeCalculation) return false;
    const status = String(event?.detail?.status || event?.detail?.phase || '').toLowerCase();
    if (event.type === 'npsh:calculation-current'
      || event.type === 'npsh:realtime-autosolve-complete'
      || /current|complete/.test(status)) {
      complete(activeSession.sessionId, { reason: event.type || 'calculation-current' });
      return true;
    }
    return false;
  }

  function handleLifecycleFailed(event) {
    if (!activeSession || activeSession.status !== 'active') return false;
    fail(activeSession.sessionId, event?.detail?.error || event?.detail?.message || event?.type || 'calculation-failed');
    return true;
  }

  function install() {
    if (installed) return false;
    installed = true;
    patchFetch();
    ['arrayBuffer', 'json', 'text', 'blob'].forEach(patchResponseBodyMethod);
    patchFileArrayBuffer();
    patchFileReaderMethods();
    patchApplySimulationStateAtomic();
    patchOpenSimulationCaseSample();
    patchVisualRefreshFunctions();
    scheduleVisualRefreshPatchRetries();
    if (hasDocument()) {
      document.addEventListener('click', handleSimulationCaseOpen, true);
      document.addEventListener('change', handleFileChange, true);
      document.addEventListener('npsh:calculation-current', handleLifecycleComplete, true);
      document.addEventListener('npsh:realtime-autosolve-complete', handleLifecycleComplete, true);
      document.addEventListener('npsh:open-file-readiness', handleLifecycleComplete, true);
      document.addEventListener('npsh:calculation-failed', handleLifecycleFailed, true);
      document.addEventListener('npsh:realtime-autosolve-error', handleLifecycleFailed, true);
      const idle = root.requestIdleCallback || ((fn) => root.setTimeout?.(fn, 900));
      idle(() => warmRuntime());
    }
    return true;
  }

  function uninstall() {
    if (!installed) return false;
    if (hasDocument()) {
      document.removeEventListener('click', handleSimulationCaseOpen, true);
      document.removeEventListener('change', handleFileChange, true);
      document.removeEventListener('npsh:calculation-current', handleLifecycleComplete, true);
      document.removeEventListener('npsh:realtime-autosolve-complete', handleLifecycleComplete, true);
      document.removeEventListener('npsh:open-file-readiness', handleLifecycleComplete, true);
      document.removeEventListener('npsh:calculation-failed', handleLifecycleFailed, true);
      document.removeEventListener('npsh:realtime-autosolve-error', handleLifecycleFailed, true);
      document.body.classList.remove(ACTIVE_CLASS);
    }
    abortPrevious('uninstalled');
    clearSettleWatchdogs('simulation-load-transaction-uninstalled');
    clearVisualRefreshQueue('simulation-load-transaction-uninstalled');
    installed = false;
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    eventNames: Object.assign({}, EVENT_NAMES),
    warmCaseIds: WARM_CASE_IDS.slice(),
    warmRuntimeSources: WARM_RUNTIME_SOURCES.slice(),
    sessionHeader: SESSION_HEADER,
    install,
    uninstall,
    beginTransaction,
    abortPrevious,
    registerCleanup,
    registerController,
    bindFileToSession,
    signal: sessionSignal,
    setSessionTimeout,
    isCurrent,
    assertCurrent: assertSessionStillCurrent,
    guardAsyncResult,
    current: () => sessionSnapshot(activeSession),
    complete,
    fail,
    releaseRunCommandLocks,
    markApplied,
    cleanWorkspaceForLoad,
    cleanTaskWindowsForLoad,
    cleanLoadArtifacts,
    runDisplayCleanup,
    requestDisplayCleanup,
    cleanupSummary,
    settleWatchdogSummary,
    auditSettledUi,
    scheduleSettleWatchdogs,
    clearSettleWatchdogs,
    visualRefreshSummary,
    patchVisualRefreshFunctions,
    flushVisualRefreshQueue,
    requestVisualRefreshFlush,
    clearVisualRefreshQueue,
    warmRuntime,
    prefetchSimulationCases,
    warmCacheSummary: () => Array.from(warmCaseCache.values())
  };

  if (hasDocument()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }

  return api;
});
