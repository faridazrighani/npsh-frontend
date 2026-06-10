(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'engineering-realtime-calculation-defense.v3';
  const AUTO_SOLVE_DEBOUNCE_MS = 650;
  const CALCULATION_FIELD_PATTERN = /\b(inputMode|optimizationMode|npshrSourceMode|npshAssessmentMode|npshMarginBasis|screeningDefaultsApplied|elevation|suctionElevation|dischargeElevation|designFlow|designHead|designEfficiency|designNpshr|bepFlow|porMinPercent|porMaxPercent|aorMinPercent|aorMaxPercent|minNpshMarginRatio|minNpshMargin|speed|curveDataSource|curveSourceNote|curveData|flow|demandFlow|massFlow|flowInputMode|boundaryMode|boundaryDataSource|pressure|pressureInputBasis|pressureBasis|pressureEnergyBasis|sourceType|temperatureMode|temp|temperature|fluidName|density|viscosity|kinematicViscosity|dynViscosity|dynamicViscosity|vaporPressure|specificWeight|vaporPressureHead|routeStyle|elevationProfileMode|startElevation|endElevation|highPointElevation|highPointLocationPercent|roughnessAgingFactor|headLossAllowancePercent|segments|length|diameter|roughness|fittingType|fittingQuantity|fittingK|minorLoss|additionalK|active|liquidLevel|level)\b/i;

  let autoSolveTimer = 0;
  let autoSolveSequence = 0;
  let pendingAutoSolve = null;
  let activeAutoSolve = null;

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

  function fieldTokens(target) {
    if (!target) return [];
    const dataset = target.dataset || {};
    return [
      target.name,
      target.id,
      target.getAttribute?.('aria-label'),
      target.getAttribute?.('placeholder'),
      dataset.key,
      dataset.field,
      dataset.prop,
      dataset.name,
      dataset.metric,
      dataset.readoutKey
    ].filter(Boolean).map((token) => String(token));
  }

  function isCalculationField(target) {
    const tokens = fieldTokens(target);
    if (!tokens.length) return false;
    if (target.closest?.('#pumpCurveTable') && /^(flow|head|eff|npshr)$/i.test(String(target.dataset?.field || ''))) {
      return true;
    }
    return CALCULATION_FIELD_PATTERN.test(tokens.join(' '));
  }

  function isCalculationInput(target) {
    if (!target || !target.matches?.('input, select, textarea')) return false;
    if (target.disabled || target.readOnly || target.type === 'file') return false;
    if (!isCalculationField(target)) return false;
    return !!target.closest?.('.task-window, .full-editor-modal, .canvas-task-window, #taskWindowBody, [data-task-prop-body="true"]');
  }

  function isTrustedUserEdit(event) {
    return event?.isTrusted === true || root.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve === true;
  }

  function dispatchRealtimeEvent(name, detail = {}) {
    if (typeof document === 'undefined' || typeof root.CustomEvent !== 'function') return;
    try {
      document.dispatchEvent(new root.CustomEvent(name, { detail }));
    } catch (error) {
      // Event dispatch is diagnostic only.
    }
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

  function markResultObjectCalculating(results, reason) {
    if (!results || typeof results !== 'object') return false;
    results.calculationFreshness = 'Calculating';
    results.backendValidationStatus = 'Calculating';
    results.backendValidationMessage = reason;
    if (results.performanceChartData?.schemaVersion === 'pump-performance-chart-data.v1') {
      results.performanceChartData.freshness = 'Calculating';
    }
    if (results.routeTrace && typeof results.routeTrace === 'object') {
      results.routeTrace.lossFreshness = 'Calculating - backend refresh in progress';
    }
    if (results.actionReadinessBackend && typeof results.actionReadinessBackend === 'object') {
      results.actionReadinessBackend.stale = true;
      results.actionReadinessBackend.status = 'Calculating';
      results.actionReadinessBackend.message = reason;
    }
    if (results.backendActionReadiness && typeof results.backendActionReadiness === 'object') {
      results.backendActionReadiness.stale = true;
      results.backendActionReadiness.status = 'Calculating';
      results.backendActionReadiness.message = reason;
    }
    if (results.npshEvaluation && typeof results.npshEvaluation === 'object') {
      results.npshEvaluation.calculationFreshness = 'Calculating';
      results.npshEvaluation.backendValidationStatus = 'Calculating';
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
    dispatchRealtimeEvent('npsh:calculation-stale', root.__engineeringCalculationDefenseRealtimeState);
    return root.__engineeringCalculationDefenseRealtimeState;
  }

  function markCalculating(nodeId = '', reason = 'Backend recalculation in progress.') {
    const model = runtimeModel();
    const ids = calculationAffectedNodeIds(model, nodeId);
    let touched = 0;
    ids.forEach((id) => {
      const node = model[id];
      if (!node || typeof node !== 'object') return;
      if (!node.results || typeof node.results !== 'object') node.results = {};
      if (markResultObjectCalculating(node.results, reason)) touched += 1;
    });
    root.__engineeringCalculationDefenseRealtimeState = {
      version: VERSION,
      status: touched ? 'Calculating' : 'No calculation result to refresh',
      reason,
      nodeIds: ids,
      startedAt: new Date().toISOString()
    };
    try {
      if (typeof root.updatePumpChart === 'function') root.updatePumpChart(nodeId || ids[0] || '');
    } catch (error) {
      // Chart refresh is best-effort; backend apply will redraw again.
    }
    dispatchRealtimeEvent('npsh:calculation-calculating', root.__engineeringCalculationDefenseRealtimeState);
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
    dispatchRealtimeEvent('npsh:calculation-current', root.__engineeringCalculationDefenseRealtimeState);
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

  function refreshLinkedViews(nodeId = '', reason = 'calculation refresh') {
    let refreshed = 0;
    try {
      refreshed += root.CanvasContextDock?.refresh?.() ? 1 : 0;
    } catch (error) {
      console.warn('Canvas context dock refresh failed after realtime solve.', error);
    }
    try {
      root.EngineeringAnalysisReportLiveRuntime?.scheduleRefresh?.();
      refreshed += root.EngineeringAnalysisReportLiveRuntime?.refresh?.() || 0;
    } catch (error) {
      console.warn('Analysis Report live refresh failed after realtime solve.', error);
    }
    try {
      const parameterRuntime = root.EngineeringParameterTaskRuntime;
      if (typeof parameterRuntime?.refreshOpenWindows === 'function') {
        refreshed += parameterRuntime.refreshOpenWindows(nodeId);
      } else if (typeof parameterRuntime?.windows === 'function' && typeof parameterRuntime?.openParameterTaskWindow === 'function') {
        parameterRuntime.windows().forEach((windowNode) => {
          const block = windowNode.dataset.parameterTaskBlock || String(windowNode.dataset.kind || '').replace(/^parameter-/, '') || 'status';
          parameterRuntime.openParameterTaskWindow(block, windowNode.dataset.pumpNodeId || nodeId);
          refreshed += 1;
        });
      }
    } catch (error) {
      console.warn('Parameter task window refresh failed after realtime solve.', error);
    }
    try {
      if (nodeId && typeof root.EngineeringPumpFormulaDefenseLiveAudit?.refresh === 'function') {
        root.EngineeringPumpFormulaDefenseLiveAudit.refresh(nodeId);
        refreshed += 1;
      }
    } catch (error) {
      console.warn('Pump formula defense refresh failed after realtime solve.', error);
    }
    try {
      root.EngineeringFormulaDefenseUI?.enhanceDocument?.(document);
    } catch (error) {
      // Enhancement is cosmetic; keep calculation flow alive.
    }
    dispatchRealtimeEvent('npsh:linked-views-refreshed', {
      version: VERSION,
      nodeId,
      reason,
      refreshed,
      refreshedAt: new Date().toISOString()
    });
    return refreshed;
  }

  function cancelAutoSolve(reason = 'cancelled') {
    if (autoSolveTimer) {
      root.clearTimeout(autoSolveTimer);
      autoSolveTimer = 0;
    }
    if (pendingAutoSolve) {
      pendingAutoSolve.cancelledAt = new Date().toISOString();
      pendingAutoSolve.cancelReason = reason;
    }
    pendingAutoSolve = null;
    return true;
  }

  function autoSolveOptions(nodeId, reason) {
    return {
      refreshReason: 'realtime-input',
      trigger: 'realtime-input',
      forceBackend: true,
      renderSidebarAfter: true,
      realtimeReason: reason,
      selectedNodeId: nodeId,
      __engineeringRealtimeAutoSolve: true
    };
  }

  function patchUpdateSimulation() {
    const current = root.updateSimulation;
    if (typeof current !== 'function' || current.__engineeringRealtimeCalculationDefenseUpdatePatched) return false;
    const wrapped = function realtimeDefenseUpdateSimulationWrapper(...args) {
      const options = args[0] && typeof args[0] === 'object' ? args[0] : {};
      if (options.forceBackend && !options.__engineeringRealtimeAutoSolve) {
        cancelAutoSolve('manual backend solve started');
      }
      const result = current.apply(this, args);
      const nodeId = options.selectedNodeId || options.nodeId || resolveNodeId(null);
      const after = () => refreshLinkedViews(nodeId, options.refreshReason || options.trigger || 'updateSimulation');
      if (result && typeof result.then === 'function') {
        result.then(after, after);
      } else {
        root.setTimeout(after, 0);
      }
      return result;
    };
    wrapped.__engineeringRealtimeCalculationDefenseUpdatePatched = true;
    wrapped.__engineeringRealtimeCalculationDefenseOriginal = current;
    if (current.__analysisReportLivePatched) {
      wrapped.__analysisReportLivePatched = true;
      wrapped.__analysisReportLiveOriginal = current.__analysisReportLiveOriginal || current;
    }
    root.updateSimulation = wrapped;
    return true;
  }

  function runAutoSolve(sequence, nodeId, reason) {
    if (sequence !== autoSolveSequence || root.__engineeringRealtimeCalculationDefenseAutoSolvePaused) {
      return Promise.resolve(null);
    }
    autoSolveTimer = 0;
    pendingAutoSolve = null;
    patchUpdateSimulation();
    if (typeof root.updateSimulation !== 'function') {
      return Promise.resolve(null);
    }
    const resolvedNodeId = nodeId || resolveNodeId(null);
    markCalculating(resolvedNodeId, 'Input changed; protected backend recalculation is running.');
    dispatchRealtimeEvent('npsh:realtime-autosolve-start', {
      version: VERSION,
      nodeId: resolvedNodeId,
      reason,
      sequence
    });
    activeAutoSolve = Promise.resolve()
      .then(() => root.updateSimulation(autoSolveOptions(resolvedNodeId, reason)))
      .then((result) => {
        refreshLinkedViews(resolvedNodeId, 'realtime autosolve complete');
        dispatchRealtimeEvent('npsh:realtime-autosolve-complete', {
          version: VERSION,
          nodeId: resolvedNodeId,
          sequence
        });
        return result;
      })
      .catch((error) => {
        const message = String(error?.message || error || 'Unknown backend refresh error');
        markStale(resolvedNodeId, `Realtime backend recalculation failed: ${message}`);
        console.warn('Realtime backend recalculation failed.', error);
        dispatchRealtimeEvent('npsh:realtime-autosolve-error', {
          version: VERSION,
          nodeId: resolvedNodeId,
          sequence,
          message
        });
        return { ok: false, error: message };
      })
      .finally(() => {
        if (sequence === autoSolveSequence) activeAutoSolve = null;
      });
    return activeAutoSolve;
  }

  function requestAutoSolve(nodeId = '', reason = 'Input changed; backend recalculation scheduled.', options = {}) {
    const delayMs = Number.isFinite(Number(options.delayMs)) ? Math.max(0, Number(options.delayMs)) : AUTO_SOLVE_DEBOUNCE_MS;
    autoSolveSequence += 1;
    const sequence = autoSolveSequence;
    const resolvedNodeId = nodeId || resolveNodeId(null);
    cancelAutoSolve('superseded by newer input');
    pendingAutoSolve = {
      version: VERSION,
      sequence,
      nodeId: resolvedNodeId,
      reason,
      delayMs,
      scheduledAt: new Date().toISOString()
    };
    autoSolveTimer = root.setTimeout(() => {
      runAutoSolve(sequence, resolvedNodeId, reason);
    }, delayMs);
    root.__engineeringCalculationDefenseRealtimeAutoSolve = pendingAutoSolve;
    dispatchRealtimeEvent('npsh:realtime-autosolve-scheduled', pendingAutoSolve);
    return pendingAutoSolve;
  }

  function flushAutoSolve() {
    if (autoSolveTimer && pendingAutoSolve) {
      const pending = pendingAutoSolve;
      root.clearTimeout(autoSolveTimer);
      autoSolveTimer = 0;
      return runAutoSolve(pending.sequence, pending.nodeId, pending.reason);
    }
    return activeAutoSolve || Promise.resolve(null);
  }

  function install() {
    if (root.__engineeringRealtimeCalculationDefenseInstalled) return false;
    root.__engineeringRealtimeCalculationDefenseInstalled = true;

    if (typeof document !== 'undefined') {
      const onInput = (event) => {
        if (!isCalculationInput(event.target) || event.isComposing) return;
        const nodeId = resolveNodeId(event.target);
        const reason = 'Input changed; waiting for protected backend recalculation.';
        markStale(nodeId, reason);
        refreshLinkedViews(nodeId, 'input changed');
        if (isTrustedUserEdit(event)) {
          requestAutoSolve(nodeId, reason, { sourceEvent: event.type });
        }
      };
      document.addEventListener('input', onInput, true);
      document.addEventListener('change', onInput, true);
    }

    patchUpdateSimulation();
    try {
      const patchInterval = root.setInterval(patchUpdateSimulation, 1000);
      patchInterval?.unref?.();
    } catch (error) {
      // Non-browser validation environments may not expose timers.
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
    const originalRunBackend = root.runBackendSimulationShadow;
    if (typeof originalRunBackend === 'function' && !originalRunBackend.__engineeringRealtimeCalculationDefenseCalculatingPatched) {
      root.runBackendSimulationShadow = function realtimeDefenseRunBackendWrapper(nodeId = '', options = {}, ...rest) {
        markCalculating(nodeId, options?.realtimeReason || 'Backend recalculation in progress.');
        return originalRunBackend.call(this, nodeId, options, ...rest);
      };
      root.runBackendSimulationShadow.__engineeringRealtimeCalculationDefenseCalculatingPatched = true;
      root.runBackendSimulationShadow.__engineeringRealtimeCalculationDefenseOriginal = originalRunBackend;
    }
    return true;
  }

  const api = {
    version: VERSION,
    install,
    markStale,
    markCalculating,
    markCurrentFromBackend,
    requestAutoSolve,
    flushAutoSolve,
    cancelAutoSolve,
    refreshLinkedViews,
    patchUpdateSimulation
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
