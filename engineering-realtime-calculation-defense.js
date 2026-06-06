(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'engineering-realtime-calculation-defense.v1';

  function runtimeModel() {
    try {
      if (typeof globalModel !== 'undefined' && globalModel) return globalModel;
    } catch (error) {
      // Protected runtime can hide direct globals.
    }
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function resolveNodeId(target) {
    const direct = target?.dataset?.node || target?.dataset?.nodeId || target?.dataset?.pumpNodeId;
    if (direct) return direct;
    const holder = target?.closest?.('[data-node], [data-node-id], [data-pump-node-id], [data-task-node-id]');
    const fromHolder = holder?.dataset?.node || holder?.dataset?.nodeId || holder?.dataset?.pumpNodeId || holder?.dataset?.taskNodeId;
    if (fromHolder) return fromHolder;
    try {
      if (typeof currentSelectedNode !== 'undefined' && currentSelectedNode) return currentSelectedNode;
    } catch (error) {
      // Fall through to first pump.
    }
    const model = runtimeModel();
    return Object.keys(model || {}).find((id) => model[id]?.type === 'pump') || '';
  }

  function isCalculationInput(target) {
    if (!target || !target.matches?.('input, select, textarea')) return false;
    if (target.disabled || target.readOnly || target.type === 'file') return false;
    return !!target.closest?.('.task-window, .full-editor-modal, .canvas-task-window, #taskWindowBody, [data-task-prop-body="true"]');
  }

  function markResultObjectStale(results, reason) {
    if (!results || typeof results !== 'object') return false;
    results.calculationFreshness = 'Stale';
    results.backendValidationStatus = 'Stale';
    results.backendValidationMessage = reason;
    if (results.performanceChartData?.schemaVersion === 'pump-performance-chart-data.v1') {
      results.performanceChartData.freshness = 'Stale';
      results.performanceChartData.warnings = [
        reason,
        ...((Array.isArray(results.performanceChartData.warnings) ? results.performanceChartData.warnings : []))
      ].filter(Boolean);
    }
    if (results.routeTrace && typeof results.routeTrace === 'object') {
      results.routeTrace.lossFreshness = 'Stale - input changed before backend refresh';
    }
    if (results.actionReadinessBackend && typeof results.actionReadinessBackend === 'object') {
      results.actionReadinessBackend.stale = true;
      results.actionReadinessBackend.status = 'Stale';
      results.actionReadinessBackend.message = reason;
    }
    if (results.backendActionReadiness && typeof results.backendActionReadiness === 'object') {
      results.backendActionReadiness.stale = true;
      results.backendActionReadiness.status = 'Stale';
      results.backendActionReadiness.message = reason;
    }
    if (results.npshEvaluation && typeof results.npshEvaluation === 'object') {
      results.npshEvaluation.calculationFreshness = 'Stale';
      results.npshEvaluation.backendValidationStatus = 'Stale';
    }
    return true;
  }

  function calculationAffectedNodeIds(model, nodeId = '') {
    const ids = new Set();
    if (nodeId && model[nodeId]) ids.add(nodeId);
    const pumpIds = Object.keys(model || {}).filter((id) => model[id]?.type === 'pump');
    if (!nodeId || !model[nodeId]) {
      pumpIds.forEach((id) => ids.add(id));
      return [...ids];
    }
    if (model[nodeId]?.type === 'pump') return [...ids];
    pumpIds.forEach((id) => ids.add(id));
    return [...ids];
  }

  function markStale(nodeId = '', reason = 'Input changed; waiting for backend recalculation.') {
    const model = runtimeModel();
    const ids = calculationAffectedNodeIds(model, nodeId);
    let touched = 0;
    ids.forEach((id) => {
      const node = model[id];
      if (!node || typeof node !== 'object') return;
      if (!node.results || typeof node.results !== 'object') node.results = {};
      if (markResultObjectStale(node.results, reason)) touched += 1;
    });
    root.__engineeringCalculationDefenseRealtimeState = {
      version: VERSION,
      status: touched ? 'Stale' : 'No calculation result to mark',
      reason,
      nodeIds: ids,
      markedAt: new Date().toISOString()
    };
    try {
      if (typeof root.updatePumpChart === 'function') root.updatePumpChart(nodeId || ids[0] || '');
    } catch (error) {
      // Chart refresh is best-effort; autosolve will recalculate.
    }
    return root.__engineeringCalculationDefenseRealtimeState;
  }

  function markCurrentFromBackend(payload = {}) {
    root.__engineeringCalculationDefenseRealtimeState = {
      version: VERSION,
      status: 'Current',
      calculationId: payload.calculationId || payload.calculationAudit?.calculationId || null,
      dependencyFingerprint: payload.dependencyManifest?.dependencyFingerprint || null,
      calculationDefenseStatus: payload.calculationDefenseContract?.status || null,
      updatedAt: new Date().toISOString()
    };
    return root.__engineeringCalculationDefenseRealtimeState;
  }

  function currentPayloadFromApplyArgs(args = []) {
    const response = args[2] || {};
    const results = args[0]?.results || {};
    const evaluation = results.npshEvaluation || {};
    return {
      ...(args[1] || {}),
      ...(response || {}),
      calculationId: response.calculationId || results.calculationId || evaluation.calculationId || null,
      calculationAudit: response.calculationAudit || results.calculationAudit || evaluation.calculationAudit || null,
      dependencyManifest: response.dependencyManifest || results.dependencyManifest || evaluation.dependencyManifest || null,
      calculationDefenseContract: response.calculationDefenseContract || results.calculationDefenseContract || evaluation.calculationDefenseContract || null
    };
  }

  function install() {
    if (root.__engineeringRealtimeCalculationDefenseInstalled) return false;
    root.__engineeringRealtimeCalculationDefenseInstalled = true;

    if (typeof document !== 'undefined') {
      const onInput = (event) => {
        if (!isCalculationInput(event.target) || event.isComposing) return;
        markStale(resolveNodeId(event.target));
      };
      document.addEventListener('input', onInput, true);
      document.addEventListener('change', onInput, true);
    }

    const originalApplyBackend = root.applyBackendSimulationPrimaryResults;
    if (typeof originalApplyBackend === 'function' && !originalApplyBackend.__engineeringRealtimeCalculationDefensePatched) {
      root.applyBackendSimulationPrimaryResults = function realtimeDefenseApplyBackendWrapper(...args) {
        const result = originalApplyBackend.apply(this, args);
        markCurrentFromBackend(currentPayloadFromApplyArgs(args));
        return result;
      };
      root.applyBackendSimulationPrimaryResults.__engineeringRealtimeCalculationDefensePatched = true;
    }
    return true;
  }

  const api = {
    version: VERSION,
    install,
    markStale,
    markCurrentFromBackend
  };

  root.EngineeringRealtimeCalculationDefense = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
