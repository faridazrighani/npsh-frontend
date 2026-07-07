((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringSimulationLoadTransaction = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-simulation-load-transaction-manager.v1';
  const CACHE_KEY = '20260707-simulation-load-transaction1';
  const ACTIVE_CLASS = 'npsh-simulation-load-transaction-active';
  const CASE_OPEN_SELECTOR = '[data-simulation-case-action="open"][data-simulation-case-id]';
  const FILE_INPUT_SELECTOR = 'input[type="file"]';
  const SIMULATION_MANIFEST_URL = 'journals/simulation-cases.json';
  const SESSION_HEADER = 'X-NPSH-Load-Session';
  const TRANSACTION_IDLE_COMPLETE_MS = 15000;
  const FINAL_CLEANUP_DELAY_MS = 180;
  const WARM_CASE_IDS = ['simulation-case-1', 'simulation-case-4', 'simulation-case-6'];
  const WARM_RUNTIME_SOURCES = [
    'engineering-pipe-canvas-hydraulic-label-runtime-20260707-pfv-loss-summary-clean1.js?v=20260707-pfv-loss-summary-clean1',
    'engineering-route-trace-audit-20260704-sink-pabs-dedupe1.js?v=20260707-pump-panel-clean6',
    'engineering-pump-envelope-warning-cleanup-runtime.js?v=20260707-pump-envelope-warning-clean1',
    'engineering-open-file-readiness-gate.js?v=20260707-open-file-readiness-gate7'
  ];
  const EVENT_NAMES = {
    begin: 'npsh:simulation-load-transaction-begin',
    abort: 'npsh:simulation-load-transaction-abort',
    stale: 'npsh:simulation-load-transaction-stale-result',
    complete: 'npsh:simulation-load-transaction-complete',
    failed: 'npsh:simulation-load-transaction-failed'
  };

  let installed = false;
  let sequence = 0;
  let activeSession = null;
  let originalFetch = null;
  const warmScriptPromises = new Map();
  const warmCaseCache = new Map();
  const fileSessionIds = typeof WeakMap === 'function' ? new WeakMap() : null;
  const responseSessionIds = typeof WeakMap === 'function' ? new WeakMap() : null;

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
      cleanupCount: session.cleanupFns.length,
      controllerCount: session.controllers.length
    };
  }

  function isCurrent(sessionId) {
    return Boolean(activeSession && activeSession.sessionId === sessionId && activeSession.status !== 'aborted');
  }

  function clearSessionTimer(session) {
    if (session?.idleTimer) root.clearTimeout?.(session.idleTimer);
    if (session) session.idleTimer = 0;
  }

  function abortSession(session, reason = 'superseded') {
    if (!session || session.status === 'aborted') return false;
    session.status = 'aborted';
    session.reason = reason;
    session.abortedAt = wallTimeIso();
    session.updatedAt = session.abortedAt;
    clearSessionTimer(session);
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

  function scheduleIdleComplete(session) {
    clearSessionTimer(session);
    session.idleTimer = root.setTimeout?.(() => {
      if (activeSession !== session || session.status !== 'active') return;
      complete(session.sessionId, {
        reason: 'idle-complete',
        message: 'Simulation load transaction settled without a pending load event.'
      });
    }, TRANSACTION_IDLE_COMPLETE_MS) || 0;
  }

  function beginTransaction(source = 'simulation-load', detail = {}) {
    if (activeSession && activeSession.status === 'active') abortSession(activeSession, 'superseded-by-new-load');
    const startedAt = wallTimeIso();
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
      controllers: [],
      idleTimer: 0
    };
    activeSession = session;
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
      runDisplayCleanup({ force: true });
      if (hasDocument()) document.body.classList.remove(ACTIVE_CLASS);
    }, FINAL_CLEANUP_DELAY_MS);
    dispatch(EVENT_NAMES.complete, Object.assign(snapshot, cloneDetail(detail)));
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
    if (hasDocument()) document.body.classList.remove(ACTIVE_CLASS);
    const snapshot = sessionSnapshot(activeSession);
    dispatch(EVENT_NAMES.failed, snapshot);
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

  function assertSessionStillCurrent(sessionId, label = 'simulation-load') {
    if (!sessionId || isCurrent(sessionId)) return true;
    dispatch(EVENT_NAMES.stale, {
      version: VERSION,
      cacheKey: CACHE_KEY,
      sessionId,
      currentSessionId: activeSession?.sessionId || '',
      label,
      ignoredAt: wallTimeIso()
    });
    throw createAbortError(`Ignored stale ${label} result from a previous simulation load.`);
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
      let controller = null;
      if (session && typeof root.AbortController === 'function' && !nextInit.signal) {
        controller = registerController(new root.AbortController(), urlText);
        nextInit = Object.assign({}, nextInit, { signal: controller.signal });
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

  function patchApplySimulationStateAtomic() {
    const original = root.applySimulationStateAtomic;
    if (typeof original !== 'function' || original.__simulationLoadTransactionPatched) return false;
    const patched = function patchedApplySimulationStateAtomic(...args) {
      const session = activeSession && activeSession.status === 'active'
        ? activeSession
        : beginTransaction('atomic-project-apply', { reason: 'applySimulationStateAtomic called directly' });
      assertSessionStillCurrent(session.sessionId, 'applySimulationStateAtomic');
      try {
        const result = original.apply(this, args);
        markApplied(session.sessionId, { appliedBy: 'applySimulationStateAtomic' });
        root.setTimeout?.(() => complete(session.sessionId, { reason: 'project-state-applied' }), FINAL_CLEANUP_DELAY_MS);
        return result;
      } catch (error) {
        fail(session.sessionId, error);
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
        if (isCurrent(session.sessionId)) complete(session.sessionId, { reason: 'simulation-case-opened' });
        return result;
      }, (error) => {
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

  function cleanTransientCanvasArtifacts() {
    if (!hasDocument()) return false;
    const canvas = document.getElementById('canvas') || document;
    [
      '[data-route-trace-overlay]',
      '.route-trace-overlay',
      '.route-trace-default-overlay',
      '.engineering-route-trace-default-overlay'
    ].forEach((selector) => {
      canvas.querySelectorAll?.(selector)?.forEach((node) => node.remove?.());
    });
    return true;
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
      root.refreshPipeCanvasHydraulicLabels?.(document);
    } catch (error) {
      console.warn('Simulation load transaction could not refresh pipe labels.', error);
    }
    if (options.force) {
      try {
        root.updateCanvasWarningPanel?.();
      } catch (error) {
        // Warning panel refresh is presentational and must not block a load.
      }
    }
    return true;
  }

  function cleanWorkspaceForLoad(detail = {}) {
    root.__npshWorkspaceResetAt = wallTimeIso();
    root.__npshWorkspaceResetReason = detail.source || 'simulation-load';
    cleanWarningPanel();
    cleanTransientCanvasArtifacts();
    runDisplayCleanup();
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
        Promise.resolve(loader()).catch((error) => {
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
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return false;
    const caseId = target.dataset?.simulationCaseId || '';
    beginTransaction('simulation-case', { caseId });
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
    patchApplySimulationStateAtomic();
    patchOpenSimulationCaseSample();
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
    isCurrent,
    current: () => sessionSnapshot(activeSession),
    complete,
    fail,
    markApplied,
    cleanWorkspaceForLoad,
    runDisplayCleanup,
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
