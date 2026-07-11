((rootFactory) => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const api = rootFactory(root);
  root.EngineeringRuntimeHealthAudit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})((root) => {
  'use strict';

  const VERSION = 'engineering-runtime-health-audit.v1';
  const CACHE_KEY = '20260710-runtime-health-audit-phase10-1';
  const AUDIT_EVENT = 'npsh:runtime-health-audit';
  const MAINTENANCE_EVENT = 'npsh:runtime-idle-maintenance';
  const FOOTPRINT_EVENT = 'npsh:runtime-load-footprint';
  const EVIDENCE_EVENT = 'npsh:runtime-reliability-evidence';
  const EVIDENCE_PANEL_ID = 'npshReliabilityEvidencePanel';
  const EVIDENCE_PANEL_STYLE_ID = 'npshReliabilityEvidencePanelStyle';
  const MAX_AUDITS = 80;
  const MAX_LOAD_HISTORY = 24;
  const MAX_FOOTPRINTS = 18;
  const IDLE_AUDIT_RETAIN = 36;
  const IDLE_LOAD_HISTORY_RETAIN = 12;
  const RECENT_LOAD_WINDOW_MS = 120000;
  const SETTLE_DEDUPE_MS = 450;
  const POST_LOAD_AUDIT_DELAYS_MS = [650, 2400, 6200];
  const IDLE_MAINTENANCE_DELAYS_MS = [9000, 22000];
  const FOOTPRINT_SAMPLE_DELAYS_MS = [1600, 7000];
  const FOOTPRINT_GROWTH_LIMITS = {
    bodyDomNodes: 120,
    canvasDomNodes: 80,
    taskWindows: 2,
    jsHeapUsedMB: 24
  };
  const BUSY_LABEL_PATTERN = /\b(calculating|applying|refreshing|opening|loading|validating)\b/i;
  const LOAD_EVENT_NAMES = {
    complete: 'npsh:simulation-load-transaction-complete',
    abort: 'npsh:simulation-load-transaction-abort',
    failed: 'npsh:simulation-load-transaction-failed',
    stale: 'npsh:simulation-load-transaction-stale-result'
  };
  const BASELINE_EVENT = 'npsh:performance-baseline-sample';
  const BODY_DOM_NODE_WARNING = 4200;
  const CANVAS_DOM_NODE_WARNING = 1200;
  const TASK_WINDOW_WARNING = 5;
  const LOAD_BURST_WARNING = 6;

  let installed = false;
  let sequence = 0;
  let evidenceSequence = 0;
  let lastSettleSignature = '';
  let lastSettleAtMs = 0;
  let lastEvidence = null;
  const audits = [];
  const loadHistory = [];
  const footprints = [];
  const timers = [];
  const maintenanceTimers = [];
  const footprintTimers = [];
  const stats = {
    scheduled: 0,
    audits: 0,
    warnings: 0,
    critical: 0,
    actions: 0,
    loadSettles: 0,
    lastStatus: 'unknown',
    lastReason: ''
  };
  const maintenanceStats = {
    scheduled: 0,
    runs: 0,
    skipped: 0,
    actions: 0,
    auditsTrimmed: 0,
    loadHistoryTrimmed: 0,
    visualQueueFlushed: 0,
    settleWatchdogsCleared: 0,
    displayCleanupRequests: 0,
    lastReason: '',
    lastActions: []
  };
  const footprintStats = {
    scheduled: 0,
    samples: 0,
    warnings: 0,
    selfHeals: 0,
    trimmed: 0,
    lastReason: '',
    lastStatus: 'unknown',
    lastDeltas: {}
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

  function round(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
  }

  function clonePlain(value = {}) {
    const clone = {};
    Object.entries(value || {}).forEach(([key, item]) => {
      if (item == null) return;
      if (['string', 'number', 'boolean'].includes(typeof item)) clone[key] = item;
      else if (Array.isArray(item)) clone[key] = item.slice(0, 8).map((entry) => String(entry));
    });
    return clone;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function baselineApi() {
    return root.EngineeringPerformanceBaselineRuntime || null;
  }

  function transactionApi() {
    return root.EngineeringSimulationLoadTransaction || null;
  }

  function safeCall(callback, fallback = null) {
    try {
      return callback();
    } catch (_) {
      return fallback;
    }
  }

  function commandState() {
    if (!hasDocument()) return {};
    const solve = document.getElementById('btn-solve');
    const label = normalizeText(solve?.querySelector?.('.ribbon-label, [data-command-label]')?.textContent || '');
    return {
      validateLabel: label,
      validateDisabled: !!solve?.disabled,
      validateBusy: solve?.dataset?.calculationBusy === 'true' || solve?.getAttribute?.('aria-busy') === 'true',
      validateAriaBusy: solve?.getAttribute?.('aria-busy') || '',
      validateAriaDisabled: solve?.getAttribute?.('aria-disabled') || '',
      validateBusyLabel: BUSY_LABEL_PATTERN.test(label)
    };
  }

  function domMetrics() {
    if (!hasDocument()) return {};
    const canvas = document.getElementById('canvas');
    const visibleTaskWindows = Array.from(document.querySelectorAll?.('.task-window') || []).filter((element) => {
      if (element.hidden) return false;
      const style = root.getComputedStyle?.(element);
      return style?.display !== 'none' && style?.visibility !== 'hidden';
    });
    return {
      bodyDomNodes: document.body?.querySelectorAll?.('*')?.length || 0,
      canvasDomNodes: canvas?.querySelectorAll?.('*')?.length || 0,
      canvasObjects: canvas?.querySelectorAll?.('.pfd-object')?.length || 0,
      pipeLabels: canvas?.querySelectorAll?.('.pipe-hydraulic-label, .pipe-delta-label')?.length || 0,
      taskWindows: visibleTaskWindows.length,
      loadActiveClass: !!document.body?.classList?.contains?.('npsh-simulation-load-transaction-active')
    };
  }

  function baselineSnapshot() {
    return safeCall(() => baselineApi()?.snapshot?.(), {}) || {};
  }

  function transactionSnapshot() {
    return safeCall(() => transactionApi()?.current?.(), null);
  }

  function visualRefreshSnapshot() {
    return safeCall(() => transactionApi()?.visualRefreshSummary?.(), null);
  }

  function recentLoadCount() {
    const cutoff = nowMs() - RECENT_LOAD_WINDOW_MS;
    while (loadHistory.length && loadHistory[0].atMs < cutoff) loadHistory.shift();
    return loadHistory.length;
  }

  function normalizeSettleOutcome(reason = '') {
    const text = String(reason || '').toLowerCase();
    if (text.includes('complete')) return 'complete';
    if (text.includes('failed')) return 'failed';
    if (text.includes('abort')) return 'abort';
    if (text.includes('stale')) return 'stale';
    return text || 'settled';
  }

  function loadSettleSignature(detail = {}, reason = '') {
    const caseId = detail.caseId || detail.detail?.caseId || '';
    const sessionId = detail.sessionId || detail.detail?.sessionId || '';
    const source = detail.source || '';
    return [normalizeSettleOutcome(reason), sessionId, caseId, source].join('|');
  }

  function snapshot(extra = {}) {
    const baseline = baselineSnapshot();
    const transaction = transactionSnapshot();
    const visualRefresh = visualRefreshSnapshot();
    const dom = domMetrics();
    const command = commandState();
    return {
      version: VERSION,
      cacheKey: CACHE_KEY,
      sequence: sequence + 1,
      wallTime: wallTimeIso(),
      nowMs: round(nowMs()),
      baselineCacheKey: baseline.cacheKey || '',
      transactionCacheKey: transaction?.cacheKey || '',
      transactionStatus: transaction?.status || '',
      jsHeapUsedMB: Number.isFinite(baseline.jsHeapUsedMB) ? baseline.jsHeapUsedMB : null,
      jsHeapTotalMB: Number.isFinite(baseline.jsHeapTotalMB) ? baseline.jsHeapTotalMB : null,
      visualRefreshQueueSize: Number(visualRefresh?.queueSize || 0),
      settleWatchdogPending: Number(transaction?.settleWatchdog?.pendingTimers || 0),
      recentLoadCount: recentLoadCount(),
      counters: clonePlain(baseline.counters || {}),
      ...dom,
      ...command,
      ...extra
    };
  }

  function classify(snapshotValue = {}) {
    const reasons = [];
    const settled = snapshotValue.transactionStatus !== 'active';
    if (settled && (snapshotValue.validateDisabled || snapshotValue.validateBusy || snapshotValue.validateAriaBusy === 'true' || snapshotValue.validateAriaDisabled === 'true' || snapshotValue.validateBusyLabel)) {
      reasons.push('validate-command-stale-busy');
    }
    if (settled && snapshotValue.loadActiveClass) reasons.push('load-active-class-stale');
    if (settled && snapshotValue.visualRefreshQueueSize > 0) reasons.push('visual-refresh-queue-stale');
    if (snapshotValue.bodyDomNodes > BODY_DOM_NODE_WARNING) reasons.push('body-dom-node-budget');
    if (snapshotValue.canvasDomNodes > CANVAS_DOM_NODE_WARNING) reasons.push('canvas-dom-node-budget');
    if (snapshotValue.taskWindows > TASK_WINDOW_WARNING) reasons.push('task-window-budget');
    if (snapshotValue.recentLoadCount >= LOAD_BURST_WARNING) reasons.push('rapid-load-burst');
    const criticalReasons = ['validate-command-stale-busy', 'load-active-class-stale'];
    const status = reasons.some((reason) => criticalReasons.includes(reason))
      ? 'critical'
      : reasons.length ? 'warning' : 'healthy';
    return { status, reasons };
  }

  function dispatchAudit(audit) {
    if (!hasDocument() || typeof root.CustomEvent !== 'function') return false;
    try {
      document.dispatchEvent(new root.CustomEvent(AUDIT_EVENT, { detail: audit }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function recordBaseline(audit) {
    const baseline = baselineApi();
    if (!baseline?.record) return false;
    safeCall(() => baseline.record('runtime-health-audit', {
      status: audit.status,
      reason: audit.reason,
      reasons: audit.reasons,
      actions: audit.actions,
      silent: true
    }));
    return true;
  }

  function rememberAudit(audit) {
    audits.push(audit);
    if (audits.length > MAX_AUDITS) audits.splice(0, audits.length - MAX_AUDITS);
    stats.audits += 1;
    stats.warnings += audit.status === 'warning' ? 1 : 0;
    stats.critical += audit.status === 'critical' ? 1 : 0;
    stats.actions += audit.actions.length;
    stats.lastStatus = audit.status;
    stats.lastReason = audit.reason;
    dispatchAudit(audit);
    recordBaseline(audit);
    return audit;
  }

  function dispatchMaintenance(entry) {
    if (!hasDocument() || typeof root.CustomEvent !== 'function') return false;
    try {
      document.dispatchEvent(new root.CustomEvent(MAINTENANCE_EVENT, { detail: entry }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function dispatchFootprint(entry) {
    if (!hasDocument() || typeof root.CustomEvent !== 'function') return false;
    try {
      document.dispatchEvent(new root.CustomEvent(FOOTPRINT_EVENT, { detail: entry }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function recordMaintenanceBaseline(entry) {
    const baseline = baselineApi();
    if (!baseline?.record) return false;
    safeCall(() => baseline.record('runtime-idle-maintenance', {
      reason: entry.reason,
      status: entry.status,
      actions: entry.actions,
      auditsTrimmed: entry.auditsTrimmed,
      loadHistoryTrimmed: entry.loadHistoryTrimmed,
      silent: true
    }));
    return true;
  }

  function recordFootprintBaseline(entry) {
    const baseline = baselineApi();
    if (!baseline?.record) return false;
    safeCall(() => baseline.record('runtime-load-footprint', {
      reason: entry.reason,
      status: entry.status,
      warnings: entry.warnings,
      deltas: entry.deltas,
      silent: true
    }));
    return true;
  }

  function trimTail(list, retain) {
    if (!Array.isArray(list) || list.length <= retain) return 0;
    const removed = list.length - retain;
    list.splice(0, removed);
    return removed;
  }

  function transactionSettled(snapshotValue = snapshot()) {
    return snapshotValue.transactionStatus !== 'active';
  }

  function lastFootprint() {
    return footprints[footprints.length - 1] || null;
  }

  function footprintDeltas(current = {}, previous = {}) {
    if (!previous) return {};
    const fields = ['bodyDomNodes', 'canvasDomNodes', 'taskWindows', 'pipeLabels', 'jsHeapUsedMB'];
    const deltas = {};
    fields.forEach((field) => {
      const currentValue = Number(current[field]);
      const previousValue = Number(previous[field]);
      if (Number.isFinite(currentValue) && Number.isFinite(previousValue)) {
        deltas[field] = round(currentValue - previousValue);
      }
    });
    return deltas;
  }

  function classifyFootprintGrowth(deltas = {}) {
    const warnings = [];
    Object.entries(FOOTPRINT_GROWTH_LIMITS).forEach(([field, limit]) => {
      const delta = Number(deltas[field]);
      if (Number.isFinite(delta) && delta > limit) warnings.push(`${field}-growth`);
    });
    return {
      status: warnings.length ? 'warning' : 'stable',
      warnings
    };
  }

  function rememberFootprint(entry) {
    footprints.push(entry);
    if (footprints.length > MAX_FOOTPRINTS) {
      const removed = footprints.length - MAX_FOOTPRINTS;
      footprints.splice(0, removed);
      footprintStats.trimmed += removed;
    }
    footprintStats.samples += 1;
    footprintStats.warnings += entry.status === 'warning' ? 1 : 0;
    footprintStats.lastReason = entry.reason;
    footprintStats.lastStatus = entry.status;
    footprintStats.lastDeltas = clonePlain(entry.deltas || {});
    dispatchFootprint(entry);
    recordFootprintBaseline(entry);
    return entry;
  }

  function recordFootprint(reason = 'runtime-load-footprint', options = {}) {
    const snap = snapshot({ reason });
    const previous = lastFootprint();
    const deltas = footprintDeltas(snap, previous);
    const classification = classifyFootprintGrowth(deltas);
    const entry = {
      ...snap,
      footprintSequence: footprints.length + 1,
      reason,
      status: classification.status,
      warnings: classification.warnings,
      deltas,
      thresholds: clonePlain(FOOTPRINT_GROWTH_LIMITS)
    };
    const remembered = rememberFootprint(entry);
    if (classification.status === 'warning' && options.selfHeal) {
      footprintStats.selfHeals += 1;
      runIdleMaintenance(`runtime-load-footprint:${reason}`, {
        force: true,
        forceDisplayCleanup: true,
        pruneLoadArtifacts: true,
        forceReadiness: !!options.forceReadiness
      });
    }
    return remembered;
  }

  function runIdleMaintenance(reason = 'runtime-idle-maintenance', options = {}) {
    const snap = snapshot({ reason });
    if (!options.force && !transactionSettled(snap)) {
      maintenanceStats.skipped += 1;
      maintenanceStats.lastReason = reason;
      const skipped = {
        ...snap,
        reason,
        status: 'skipped-active-transaction',
        actions: []
      };
      dispatchMaintenance(skipped);
      return skipped;
    }

    const actions = [];
    const transaction = transactionApi();
    const retainAudits = Number(options.retainAudits || IDLE_AUDIT_RETAIN);
    const retainLoads = Number(options.retainLoads || IDLE_LOAD_HISTORY_RETAIN);
    const auditsTrimmed = trimTail(audits, retainAudits);
    const loadHistoryTrimmed = trimTail(loadHistory, retainLoads);
    if (auditsTrimmed) actions.push(`trim-health-audits:${auditsTrimmed}`);
    if (loadHistoryTrimmed) actions.push(`trim-load-history:${loadHistoryTrimmed}`);

    if (transaction && snap.visualRefreshQueueSize > 0) {
      safeCall(() => transaction.flushVisualRefreshQueue?.(`runtime-idle-maintenance:${reason}`));
      actions.push('visual-refresh-queue-flush');
      maintenanceStats.visualQueueFlushed += 1;
    }

    if (transaction && snap.settleWatchdogPending > 0) {
      const cleared = Number(safeCall(() => transaction.clearSettleWatchdogs?.(`runtime-idle-maintenance:${reason}`), 0) || 0);
      if (cleared > 0) {
        actions.push(`settle-watchdogs-cleared:${cleared}`);
        maintenanceStats.settleWatchdogsCleared += cleared;
      }
    }

    if (transaction && options.pruneLoadArtifacts) {
      const removed = Number(safeCall(() => transaction.cleanLoadArtifacts?.(), 0) || 0);
      if (removed > 0) actions.push(`load-artifacts-pruned:${removed}`);
    }

    if (transaction && (snap.validateDisabled || snap.validateBusy || snap.validateAriaBusy === 'true' || snap.validateAriaDisabled === 'true' || snap.validateBusyLabel || snap.loadActiveClass)) {
      const result = safeCall(() => transaction.auditSettledUi?.(`runtime-idle-maintenance:${reason}`, { forceReadiness: !!options.forceReadiness }), null);
      if (result && !result.skipped) actions.push('transaction-settle-audit');
    }

    if (transaction && (actions.length || options.forceDisplayCleanup)) {
      safeCall(() => transaction.requestDisplayCleanup?.({ force: !!options.forceDisplayCleanup }, `runtime-idle-maintenance:${reason}`));
      actions.push('display-cleanup-request');
      maintenanceStats.displayCleanupRequests += 1;
    }

    maintenanceStats.runs += 1;
    maintenanceStats.actions += actions.length;
    maintenanceStats.auditsTrimmed += auditsTrimmed;
    maintenanceStats.loadHistoryTrimmed += loadHistoryTrimmed;
    maintenanceStats.lastReason = reason;
    maintenanceStats.lastActions = actions.slice();

    const entry = {
      ...snap,
      reason,
      status: actions.length ? 'maintained' : 'clean',
      actions,
      auditsTrimmed,
      loadHistoryTrimmed,
      retainedAudits: audits.length,
      retainedLoadHistory: loadHistory.length
    };
    dispatchMaintenance(entry);
    recordMaintenanceBaseline(entry);
    return entry;
  }

  function applySelfHealing(snapshotValue, classification, reason, options = {}) {
    const actions = [];
    const transaction = transactionApi();
    const settled = snapshotValue.transactionStatus !== 'active';
    if (!settled || !transaction) return actions;

    if (classification.reasons.includes('validate-command-stale-busy') || classification.reasons.includes('load-active-class-stale')) {
      const result = safeCall(() => transaction.auditSettledUi?.(`runtime-health-audit:${reason}`, { forceReadiness: !!options.forceReadiness }), null);
      if (result && !result.skipped) actions.push('transaction-settle-audit');
    }

    if (classification.reasons.includes('visual-refresh-queue-stale')) {
      safeCall(() => transaction.flushVisualRefreshQueue?.(`runtime-health-audit:${reason}`));
      actions.push('visual-refresh-queue-flush');
    }

    if (classification.reasons.includes('visual-refresh-queue-stale') || classification.reasons.includes('rapid-load-burst') || options.forceDisplayCleanup) {
      safeCall(() => transaction.requestDisplayCleanup?.({ force: false }, `runtime-health-audit:${reason}`));
      actions.push('display-cleanup-request');
    }

    return Array.from(new Set(actions));
  }

  function audit(reason = 'runtime-health-audit', options = {}) {
    const snap = snapshot({ reason });
    const classification = classify(snap);
    const actions = applySelfHealing(snap, classification, reason, options);
    const auditRecord = {
      ...snap,
      sequence: ++sequence,
      reason,
      status: classification.status,
      reasons: classification.reasons,
      actions,
      thresholds: {
        bodyDomNodes: BODY_DOM_NODE_WARNING,
        canvasDomNodes: CANVAS_DOM_NODE_WARNING,
        taskWindows: TASK_WINDOW_WARNING,
        recentLoadBurst: LOAD_BURST_WARNING
      }
    };
    return rememberAudit(auditRecord);
  }

  function clearTimers(reason = 'runtime-health-audit-clear') {
    const count = timers.splice(0).reduce((total, timer) => {
      root.clearTimeout?.(timer);
      return total + 1;
    }, 0);
    if (count) stats.lastReason = reason;
    return count;
  }

  function clearMaintenanceTimers(reason = 'runtime-idle-maintenance-clear') {
    const count = maintenanceTimers.splice(0).reduce((total, timer) => {
      root.clearTimeout?.(timer);
      return total + 1;
    }, 0);
    if (count) maintenanceStats.lastReason = reason;
    return count;
  }

  function clearFootprintTimers(reason = 'runtime-load-footprint-clear') {
    const count = footprintTimers.splice(0).reduce((total, timer) => {
      root.clearTimeout?.(timer);
      return total + 1;
    }, 0);
    if (count) footprintStats.lastReason = reason;
    return count;
  }

  function scheduleAudit(reason = 'runtime-health-audit-scheduled', delays = POST_LOAD_AUDIT_DELAYS_MS) {
    clearTimers('runtime-health-audit-reschedule');
    delays.forEach((delay, index) => {
      const timer = root.setTimeout?.(() => {
        const timerIndex = timers.indexOf(timer);
        if (timerIndex >= 0) timers.splice(timerIndex, 1);
        audit(`${reason}:${delay}`, {
          forceReadiness: index === delays.length - 1,
          forceDisplayCleanup: index === delays.length - 1
        });
      }, delay);
      if (timer) timers.push(timer);
    });
    stats.scheduled += delays.length;
    stats.lastReason = reason;
    return timers.length;
  }

  function scheduleIdleMaintenance(reason = 'runtime-idle-maintenance-scheduled', delays = IDLE_MAINTENANCE_DELAYS_MS) {
    clearMaintenanceTimers('runtime-idle-maintenance-reschedule');
    delays.forEach((delay, index) => {
      const timer = root.setTimeout?.(() => {
        const timerIndex = maintenanceTimers.indexOf(timer);
        if (timerIndex >= 0) maintenanceTimers.splice(timerIndex, 1);
        runIdleMaintenance(`${reason}:${delay}`, {
          forceReadiness: index === delays.length - 1,
          forceDisplayCleanup: index === delays.length - 1
        });
      }, delay);
      if (timer) maintenanceTimers.push(timer);
    });
    maintenanceStats.scheduled += delays.length;
    maintenanceStats.lastReason = reason;
    return maintenanceTimers.length;
  }

  function scheduleFootprintSample(reason = 'runtime-load-footprint-scheduled', delays = FOOTPRINT_SAMPLE_DELAYS_MS) {
    clearFootprintTimers('runtime-load-footprint-reschedule');
    delays.forEach((delay, index) => {
      const timer = root.setTimeout?.(() => {
        const timerIndex = footprintTimers.indexOf(timer);
        if (timerIndex >= 0) footprintTimers.splice(timerIndex, 1);
        recordFootprint(`${reason}:${delay}`, {
          selfHeal: index === delays.length - 1,
          forceReadiness: index === delays.length - 1
        });
      }, delay);
      if (timer) footprintTimers.push(timer);
    });
    footprintStats.scheduled += delays.length;
    footprintStats.lastReason = reason;
    return footprintTimers.length;
  }

  function noteLoadSettle(detail = {}, reason = 'simulation-load-settled') {
    const currentMs = nowMs();
    const signature = loadSettleSignature(detail, reason);
    if (signature === lastSettleSignature && currentMs - lastSettleAtMs < SETTLE_DEDUPE_MS) {
      return loadHistory.length;
    }
    lastSettleSignature = signature;
    lastSettleAtMs = currentMs;
    loadHistory.push({
      atMs: currentMs,
      at: wallTimeIso(),
      reason,
      source: detail.source || '',
      caseId: detail.caseId || detail.detail?.caseId || ''
    });
    while (loadHistory.length > MAX_LOAD_HISTORY) loadHistory.shift();
    stats.loadSettles += 1;
    scheduleAudit(reason);
    scheduleIdleMaintenance(reason);
    scheduleFootprintSample(reason);
    return loadHistory.length;
  }

  function handleBaselineSample(event) {
    const detail = event?.detail || {};
    const type = String(detail.type || '');
    if (type === 'simulation-load-complete' || type === 'simulation-load-failed' || type === 'simulation-load-abort' || type === 'simulation-load-stale-result') {
      noteLoadSettle(detail, `baseline:${type}`);
      return;
    }
    if (type === 'simulation-load-stuck' || type === 'calculation-stuck' || type === 'long-task') {
      scheduleAudit(`baseline:${type}`, [300, 1400]);
      scheduleIdleMaintenance(`baseline:${type}`, [2600, 9000]);
      scheduleFootprintSample(`baseline:${type}`, [1800, 7200]);
    }
  }

  function handleTransactionSettle(event) {
    noteLoadSettle(event?.detail || {}, event?.type || 'transaction-settled');
  }

  function handleVisibilityChange() {
    if (!hasDocument() || document.hidden !== true) return;
    scheduleIdleMaintenance('document-hidden', [600]);
  }

  function install() {
    if (installed) return true;
    installed = true;
    if (hasDocument()) {
      document.addEventListener(BASELINE_EVENT, handleBaselineSample);
      Object.values(LOAD_EVENT_NAMES).forEach((name) => document.addEventListener(name, handleTransactionSettle));
      document.addEventListener('visibilitychange', handleVisibilityChange);
      if (document.readyState === 'complete') audit('app-ready', { forceDisplayCleanup: false });
      else root.addEventListener?.('load', () => audit('app-ready', { forceDisplayCleanup: false }), { once: true });
    }
    return true;
  }

  function uninstall() {
    if (!installed) return false;
    if (hasDocument()) {
      document.removeEventListener(BASELINE_EVENT, handleBaselineSample);
      Object.values(LOAD_EVENT_NAMES).forEach((name) => document.removeEventListener(name, handleTransactionSettle));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    clearTimers('runtime-health-audit-uninstall');
    clearMaintenanceTimers('runtime-idle-maintenance-uninstall');
    clearFootprintTimers('runtime-load-footprint-uninstall');
    installed = false;
    return true;
  }

  function history() {
    return audits.map((entry) => ({
      ...entry,
      reasons: entry.reasons.slice(),
      actions: entry.actions.slice(),
      counters: clonePlain(entry.counters || {})
    }));
  }

  function summary() {
    const last = audits[audits.length - 1] || null;
    return {
      version: VERSION,
      cacheKey: CACHE_KEY,
      installed,
      pendingTimers: timers.length,
      pendingMaintenanceTimers: maintenanceTimers.length,
      pendingFootprintTimers: footprintTimers.length,
      loadHistory: loadHistory.length,
      footprints: footprints.length,
      lastAudit: last ? {
        sequence: last.sequence,
        status: last.status,
        reason: last.reason,
        reasons: last.reasons.slice(),
        actions: last.actions.slice()
      } : null,
      stats: clonePlain(stats),
      maintenance: clonePlain(maintenanceStats),
      footprint: clonePlain(footprintStats)
    };
  }

  function maintenanceSummary() {
    return {
      version: VERSION,
      cacheKey: CACHE_KEY,
      pendingTimers: maintenanceTimers.length,
      retainedAudits: audits.length,
      retainedLoadHistory: loadHistory.length,
      stats: clonePlain(maintenanceStats)
    };
  }

  function footprintSummary() {
    const last = footprints[footprints.length - 1] || null;
    return {
      version: VERSION,
      cacheKey: CACHE_KEY,
      pendingTimers: footprintTimers.length,
      retainedFootprints: footprints.length,
      lastFootprint: last ? {
        footprintSequence: last.footprintSequence,
        status: last.status,
        reason: last.reason,
        warnings: last.warnings.slice(),
        deltas: clonePlain(last.deltas || {})
      } : null,
      stats: clonePlain(footprintStats)
    };
  }

  function recentBaselineSamples(limit = 8) {
    const samples = safeCall(() => baselineApi()?.samples?.(), []) || [];
    return samples.slice(Math.max(0, samples.length - limit)).map((sample) => ({
      type: sample.type || '',
      durationMs: sample.durationMs == null ? null : sample.durationMs,
      status: sample.status || sample.detail?.status || '',
      reason: sample.reason || sample.detail?.reason || '',
      caseId: sample.caseId || sample.detail?.caseId || '',
      source: sample.source || sample.detail?.source || '',
      canvasObjects: sample.canvasObjects,
      canvasDomNodes: sample.canvasDomNodes,
      bodyDomNodes: sample.bodyDomNodes,
      taskWindows: sample.taskWindows,
      validateDisabled: !!sample.validateDisabled,
      validateBusy: !!sample.validateBusy,
      consoleErrors: sample.counters?.consoleErrors,
      staleResultsRejected: sample.counters?.staleResultsRejected
    }));
  }

  function recentLoadHistory(limit = 8) {
    return loadHistory.slice(Math.max(0, loadHistory.length - limit)).map((entry) => clonePlain(entry));
  }

  function recentFootprints(limit = 6) {
    return footprints.slice(Math.max(0, footprints.length - limit)).map((entry) => ({
      footprintSequence: entry.footprintSequence,
      wallTime: entry.wallTime,
      reason: entry.reason,
      status: entry.status,
      warnings: entry.warnings.slice(),
      deltas: clonePlain(entry.deltas || {}),
      bodyDomNodes: entry.bodyDomNodes,
      canvasDomNodes: entry.canvasDomNodes,
      taskWindows: entry.taskWindows,
      jsHeapUsedMB: entry.jsHeapUsedMB
    }));
  }

  function recentAudits(limit = 6) {
    return audits.slice(Math.max(0, audits.length - limit)).map((entry) => ({
      sequence: entry.sequence,
      wallTime: entry.wallTime,
      reason: entry.reason,
      status: entry.status,
      reasons: entry.reasons.slice(),
      actions: entry.actions.slice(),
      validateDisabled: !!entry.validateDisabled,
      validateBusy: !!entry.validateBusy,
      transactionStatus: entry.transactionStatus || ''
    }));
  }

  function evidenceStatus(evidence) {
    const snap = evidence.snapshot || {};
    const health = evidence.health?.lastAudit || {};
    const footprint = evidence.footprint?.lastFootprint || {};
    if (snap.validateDisabled || snap.validateBusy || snap.validateAriaBusy === 'true' || snap.validateAriaDisabled === 'true' || snap.loadActiveClass) {
      return 'attention';
    }
    if (health.status === 'critical') return 'attention';
    if (footprint.status === 'warning' || health.status === 'warning') return 'watch';
    return 'healthy';
  }

  function dispatchEvidence(evidence) {
    if (!hasDocument() || typeof root.CustomEvent !== 'function') return false;
    try {
      document.dispatchEvent(new root.CustomEvent(EVIDENCE_EVENT, { detail: evidence }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function recordEvidenceBaseline(evidence) {
    const baseline = baselineApi();
    if (!baseline?.record) return false;
    safeCall(() => baseline.record('runtime-reliability-evidence', {
      reason: evidence.reason,
      status: evidence.status,
      silent: true
    }));
    return true;
  }

  function captureReliabilityEvidence(reason = 'manual-evidence-capture') {
    const transaction = transactionApi();
    const evidence = {
      version: VERSION,
      cacheKey: CACHE_KEY,
      evidenceSequence: ++evidenceSequence,
      reason,
      capturedAt: wallTimeIso(),
      snapshot: snapshot({ reason }),
      health: summary(),
      maintenance: maintenanceSummary(),
      footprint: footprintSummary(),
      transaction: {
        current: transactionSnapshot(),
        cleanup: safeCall(() => transaction?.cleanupSummary?.(), null),
        visualRefresh: safeCall(() => transaction?.visualRefreshSummary?.(), null),
        settleWatchdog: safeCall(() => transaction?.settleWatchdogSummary?.(), null),
        warmCache: safeCall(() => transaction?.warmCacheSummary?.(), [])
      },
      lifecycle: safeCall(() => root.EngineeringCalculationLifecycle?.current?.(), null),
      readinessGate: safeCall(() => root.EngineeringOpenFileReadinessGate?.state?.(), null),
      baseline: {
        snapshot: baselineSnapshot(),
        recentSamples: recentBaselineSamples()
      },
      recent: {
        loads: recentLoadHistory(),
        audits: recentAudits(),
        footprints: recentFootprints()
      }
    };
    evidence.status = evidenceStatus(evidence);
    lastEvidence = evidence;
    dispatchEvidence(evidence);
    recordEvidenceBaseline(evidence);
    return evidence;
  }

  function reliabilityEvidenceJson(reason = 'manual-evidence-json') {
    return JSON.stringify(captureReliabilityEvidence(reason), null, 2);
  }

  function ensureEvidencePanelStyle() {
    if (!hasDocument() || document.getElementById(EVIDENCE_PANEL_STYLE_ID)) return false;
    const style = document.createElement('style');
    style.id = EVIDENCE_PANEL_STYLE_ID;
    style.textContent = `
      #${EVIDENCE_PANEL_ID} {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 3800;
        width: min(560px, calc(100vw - 28px));
        max-height: min(620px, calc(100vh - 28px));
        display: grid;
        grid-template-rows: auto auto minmax(180px, 1fr);
        border: 1px solid #b8d2e8;
        border-radius: 8px;
        background: #f8fbfe;
        box-shadow: 0 16px 36px rgba(10, 38, 64, 0.22);
        color: #0d3555;
        font: 12px/1.35 Arial, sans-serif;
        overflow: hidden;
      }
      #${EVIDENCE_PANEL_ID}[hidden] { display: none; }
      #${EVIDENCE_PANEL_ID} .npsh-evidence-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        background: #0d4b70;
        color: #fff;
      }
      #${EVIDENCE_PANEL_ID} .npsh-evidence-title { font-weight: 700; }
      #${EVIDENCE_PANEL_ID} .npsh-evidence-actions { display: flex; gap: 6px; }
      #${EVIDENCE_PANEL_ID} button {
        border: 1px solid #9ec1dd;
        border-radius: 6px;
        background: #fff;
        color: #0d3555;
        font: inherit;
        padding: 4px 8px;
        cursor: pointer;
      }
      #${EVIDENCE_PANEL_ID} .npsh-evidence-summary {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        padding: 10px 12px;
        border-bottom: 1px solid #d8e8f5;
      }
      #${EVIDENCE_PANEL_ID} .npsh-evidence-metric {
        min-width: 0;
        border: 1px solid #d8e8f5;
        border-radius: 6px;
        background: #fff;
        padding: 6px;
      }
      #${EVIDENCE_PANEL_ID} .npsh-evidence-metric span {
        display: block;
        color: #50708a;
        font-size: 10px;
      }
      #${EVIDENCE_PANEL_ID} .npsh-evidence-metric strong {
        display: block;
        overflow-wrap: anywhere;
      }
      #${EVIDENCE_PANEL_ID} pre {
        margin: 0;
        padding: 10px 12px;
        overflow: auto;
        background: #0b1720;
        color: #d8f1ff;
        font: 11px/1.4 Consolas, monospace;
      }
    `;
    document.head.appendChild(style);
    return true;
  }

  function evidenceMetric(label, value) {
    const item = document.createElement('div');
    item.className = 'npsh-evidence-metric';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.textContent = value == null || value === '' ? '-' : String(value);
    item.append(labelEl, valueEl);
    return item;
  }

  function renderEvidencePanel(panel, evidence) {
    const summaryEl = panel.querySelector('[data-evidence-summary]');
    const pre = panel.querySelector('[data-evidence-json]');
    summaryEl.replaceChildren(
      evidenceMetric('Status', evidence.status),
      evidenceMetric('Validate', evidence.snapshot?.validateLabel || '-'),
      evidenceMetric('Transaction', evidence.snapshot?.transactionStatus || '-'),
      evidenceMetric('DOM nodes', evidence.snapshot?.bodyDomNodes ?? '-'),
      evidenceMetric('Canvas nodes', evidence.snapshot?.canvasDomNodes ?? '-'),
      evidenceMetric('Task windows', evidence.snapshot?.taskWindows ?? '-'),
      evidenceMetric('Footprint', evidence.footprint?.lastFootprint?.status || '-'),
      evidenceMetric('Stale rejected', evidence.snapshot?.counters?.staleResultsRejected ?? 0)
    );
    pre.textContent = JSON.stringify(evidence, null, 2);
    panel.dataset.evidenceStatus = evidence.status;
    panel.dataset.evidenceSequence = String(evidence.evidenceSequence);
    return panel;
  }

  function ensureEvidencePanel() {
    if (!hasDocument()) return null;
    ensureEvidencePanelStyle();
    let panel = document.getElementById(EVIDENCE_PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = EVIDENCE_PANEL_ID;
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Reliability evidence snapshot');
    panel.innerHTML = `
      <div class="npsh-evidence-header">
        <div class="npsh-evidence-title">Reliability Evidence</div>
        <div class="npsh-evidence-actions">
          <button type="button" data-evidence-refresh>Refresh</button>
          <button type="button" data-evidence-copy>Copy JSON</button>
          <button type="button" data-evidence-close>Close</button>
        </div>
      </div>
      <div class="npsh-evidence-summary" data-evidence-summary></div>
      <pre data-evidence-json></pre>
    `;
    panel.querySelector('[data-evidence-refresh]')?.addEventListener('click', () => {
      renderEvidencePanel(panel, captureReliabilityEvidence('panel-refresh'));
    });
    panel.querySelector('[data-evidence-copy]')?.addEventListener('click', () => {
      copyReliabilityEvidence('panel-copy');
    });
    panel.querySelector('[data-evidence-close]')?.addEventListener('click', () => {
      closeReliabilityEvidencePanel();
    });
    document.body.appendChild(panel);
    return panel;
  }

  function openReliabilityEvidencePanel(reason = 'panel-open') {
    const panel = ensureEvidencePanel();
    if (!panel) return null;
    const evidence = captureReliabilityEvidence(reason);
    renderEvidencePanel(panel, evidence);
    panel.hidden = false;
    return evidence;
  }

  function closeReliabilityEvidencePanel() {
    const panel = hasDocument() ? document.getElementById(EVIDENCE_PANEL_ID) : null;
    if (!panel) return false;
    panel.hidden = true;
    return true;
  }

  function toggleReliabilityEvidencePanel(reason = 'panel-toggle') {
    const panel = ensureEvidencePanel();
    if (!panel) return null;
    if (panel.hidden) return openReliabilityEvidencePanel(reason);
    closeReliabilityEvidencePanel();
    return lastEvidence;
  }

  async function copyReliabilityEvidence(reason = 'manual-copy') {
    const text = reliabilityEvidenceJson(reason);
    if (root.navigator?.clipboard?.writeText) {
      await root.navigator.clipboard.writeText(text);
      return { ok: true, method: 'clipboard', length: text.length };
    }
    return { ok: false, method: 'text-return', text, length: text.length };
  }

  function lastReliabilityEvidence() {
    return lastEvidence ? JSON.parse(JSON.stringify(lastEvidence)) : null;
  }

  function reset() {
    clearTimers('runtime-health-audit-reset');
    clearMaintenanceTimers('runtime-idle-maintenance-reset');
    clearFootprintTimers('runtime-load-footprint-reset');
    audits.splice(0);
    loadHistory.splice(0);
    footprints.splice(0);
    sequence = 0;
    evidenceSequence = 0;
    lastSettleSignature = '';
    lastSettleAtMs = 0;
    lastEvidence = null;
    Object.assign(stats, {
      scheduled: 0,
      audits: 0,
      warnings: 0,
      critical: 0,
      actions: 0,
      loadSettles: 0,
      lastStatus: 'unknown',
      lastReason: ''
    });
    Object.assign(maintenanceStats, {
      scheduled: 0,
      runs: 0,
      skipped: 0,
      actions: 0,
      auditsTrimmed: 0,
      loadHistoryTrimmed: 0,
      visualQueueFlushed: 0,
      settleWatchdogsCleared: 0,
      displayCleanupRequests: 0,
      lastReason: '',
      lastActions: []
    });
    Object.assign(footprintStats, {
      scheduled: 0,
      samples: 0,
      warnings: 0,
      selfHeals: 0,
      trimmed: 0,
      lastReason: '',
      lastStatus: 'unknown',
      lastDeltas: {}
    });
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    auditEvent: AUDIT_EVENT,
    maintenanceEvent: MAINTENANCE_EVENT,
    footprintEvent: FOOTPRINT_EVENT,
    evidenceEvent: EVIDENCE_EVENT,
    install,
    uninstall,
    audit,
    scheduleAudit,
    scheduleIdleMaintenance,
    runIdleMaintenance,
    clearMaintenanceTimers,
    recordFootprint,
    scheduleFootprintSample,
    clearFootprintTimers,
    captureReliabilityEvidence,
    reliabilityEvidenceJson,
    copyReliabilityEvidence,
    openReliabilityEvidencePanel,
    closeReliabilityEvidencePanel,
    toggleReliabilityEvidencePanel,
    lastReliabilityEvidence,
    noteLoadSettle,
    snapshot,
    summary,
    maintenanceSummary,
    footprintSummary,
    history,
    reset
  };

  if (hasDocument()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
  }

  return api;
});
