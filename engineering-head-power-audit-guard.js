;(function installHeadPowerAuditGuard(root) {
  "use strict";

  const VERSION = "2026.06-head-power-audit-guard2";
  const REQUIRED_ONLY_HEAD_BASIS = "Not available: route-only required system head is not actual pump head";
  const REQUIRED_ONLY_POWER_BASIS = "Not calculated: route-only mode has required system head but no actual pump head/efficiency curve.";
  const LOCAL_TRACE_HEAD_BASIS = "Not available: frontend local trace has no pump curve or performance evidence for actual pump head";
  const LOCAL_TRACE_POWER_BASIS = "Not calculated: frontend local trace cannot calculate pump power without actual pump head evidence.";

  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstFiniteNumber(...values) {
    for (const value of values) {
      const number = finiteNumber(value);
      if (number !== null) return number;
    }
    return null;
  }

  function hasRequiredOnlyBasis(results, evaluation) {
    const basisText = [
      results?.headBasis,
      results?.powerBasis,
      evaluation?.pumpHeadBasis,
      evaluation?.calculationTrace?.systemHead?.condition
    ].filter(Boolean).join(" ");
    return /route-only|required system head is not actual pump head|pressure\/gravity assisted/i.test(basisText);
  }

  function hasFiniteCurveValue(point, valueKeys = []) {
    if (!point || typeof point !== "object") return false;
    const hasFlow = firstFiniteNumber(point.flow, point.q, point.x, point.flowM3H) !== null;
    const hasValue = valueKeys.some((key) => finiteNumber(point[key]) !== null);
    return hasFlow && hasValue;
  }

  function countCurvePoints(value, valueKeys = []) {
    if (!value) return 0;
    if (Array.isArray(value)) {
      return value.filter((point) => {
        if (Array.isArray(point)) return point.filter((entry) => finiteNumber(entry) !== null).length >= 2;
        return hasFiniteCurveValue(point, valueKeys);
      }).length;
    }
    if (typeof value === "string") {
      const text = value.trim();
      if (!text) return 0;
      if (text[0] === "[" || text[0] === "{") {
        try {
          return countCurvePoints(JSON.parse(text), valueKeys);
        } catch {
          return 0;
        }
      }
      return text.split(/\r?\n/).filter((line) => {
        const numbers = String(line).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
        return numbers.length >= 2;
      }).length;
    }
    if (typeof value === "object") {
      return countCurvePoints(Object.values(value), valueKeys);
    }
    return 0;
  }

  function hasPumpPerformanceEvidence(pumpNode = {}, results = {}) {
    const props = pumpNode.props || {};
    const evaluation = results.npshEvaluation || {};
    const chartData = results.performanceChartData?.schemaVersion === "pump-performance-chart-data.v1"
      ? results.performanceChartData
      : null;
    const sourceText = [
      results.chartPreviewSource,
      results.curveDataSource,
      results.curveDataConfidence,
      results.curveSource,
      results.headBasis,
      evaluation.pumpHeadBasis,
      evaluation.curveBasis,
      props.curveDataSource,
      props.curveDataConfidence,
      props.curveSourceNote,
      chartData?.sourceMode,
      chartData?.sourceAudit?.chartBasis,
      chartData?.sourceAudit?.curveDataSource,
      chartData?.sourceAudit?.curveDataConfidence
    ].filter(Boolean).join(" ");
    if (/pump properties fast lane|vendor|manufacturer|factory|test\s*curve|datasheet|digitized|published|journal|engineering\s*fit|pump\s*curve|performance\s*chart/i.test(sourceText)) {
      return true;
    }
    if (countCurvePoints(props.curveData, ["head", "pumpHead", "value"]) >= 2) return true;
    if (countCurvePoints(results.pumpCurve, ["head", "pumpHead", "value"]) >= 2) return true;
    if (countCurvePoints(chartData?.series?.pumpHead, ["value", "head", "pumpHead"]) >= 2) return true;
    return false;
  }

  function isFrontendLocalTrace(results = {}) {
    const evaluation = results.npshEvaluation || {};
    const sourceText = [
      results.backendCalculationSource,
      results.calculationFreshness,
      results.sourceOfTruth,
      results.traceSource,
      evaluation.backendCalculationSource,
      evaluation.calculationFreshness,
      evaluation.sourceOfTruth
    ].filter(Boolean).join(" ");
    return /frontend-local-trace|local route-trace fallback|\blocal trace\b/i.test(sourceText);
  }

  function hasLocalTraceActualLeak(results = {}, pumpNode = {}) {
    if (!isFrontendLocalTrace(results)) return false;
    if (hasPumpPerformanceEvidence(pumpNode, results)) return false;
    const evaluation = results.npshEvaluation || {};
    const actualHead = firstFiniteNumber(
      evaluation.actualPumpHead,
      evaluation.pumpHead,
      results.actualPumpHead,
      results.pumpHeadAtFlow,
      results.pumpHead,
      results.head
    );
    const actualAvailable = evaluation.actualPumpHeadAvailable === true || results.actualPumpHeadAvailable === true;
    const power = firstFiniteNumber(results.power, results.hydraulicPower);
    return actualAvailable || actualHead !== null || power !== null;
  }

  function getActualHeadClearReason(results = {}, pumpNode = {}) {
    const evaluation = results.npshEvaluation || {};
    if (hasLocalTraceActualLeak(results, pumpNode)) {
      return "Frontend local trace cannot provide Actual Pump Head or pump power without pump curve/performance evidence.";
    }
    const requiredHead = firstFiniteNumber(
      evaluation.requiredSystemHead,
      evaluation.requiredSystemHeadRaw,
      results.requiredSystemHead,
      results.requiredSystemHeadRaw
    );
    const actualHead = firstFiniteNumber(evaluation.actualPumpHead, evaluation.pumpHead, results.actualPumpHead);
    const actualAvailable = evaluation.actualPumpHeadAvailable === true || results.actualPumpHeadAvailable === true;
    if (actualAvailable && actualHead !== null) return null;
    if (evaluation.actualPumpHeadAvailable === false || results.actualPumpHeadAvailable === false) {
      return "Required/System Head is not Actual Pump Head in route-only pressure-assisted mode.";
    }
    if (requiredHead !== null && actualHead === null && hasRequiredOnlyBasis(results, evaluation)) {
      return "Required/System Head is not Actual Pump Head in route-only pressure-assisted mode.";
    }
    return null;
  }

  function shouldClearActualHead(results = {}, pumpNode = {}) {
    return !!getActualHeadClearReason(results, pumpNode);
  }

  function clearRequiredHeadFromActualFields(results = {}, pumpNode = {}) {
    const reason = getActualHeadClearReason(results, pumpNode);
    if (!reason) return false;

    results.head = null;
    results.pumpHead = null;
    results.actualPumpHead = null;
    results.actualPumpHeadAvailable = false;
    results.pumpHeadAtFlow = null;
    results.headResidual = null;
    results.power = null;
    results.hydraulicPower = null;
    results.efficiency = null;
    const localTrace = /^Frontend local trace/.test(reason);
    results.headBasis = results.headBasis || (localTrace ? LOCAL_TRACE_HEAD_BASIS : REQUIRED_ONLY_HEAD_BASIS);
    results.powerBasis = results.powerBasis || (localTrace ? LOCAL_TRACE_POWER_BASIS : REQUIRED_ONLY_POWER_BASIS);

    if (results.npshEvaluation && typeof results.npshEvaluation === "object") {
      results.npshEvaluation.pumpHead = null;
      results.npshEvaluation.actualPumpHead = null;
      results.npshEvaluation.actualPumpHeadAvailable = false;
      results.npshEvaluation.pumpHeadBasis = results.npshEvaluation.pumpHeadBasis || results.headBasis;
    }

    results.headPowerAuditGuard = {
      version: VERSION,
      applied: true,
      reason
    };
    return true;
  }

  function getModel() {
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function sanitizePumpNode(pumpNode) {
    if (!pumpNode || pumpNode.type !== "pump" || !pumpNode.results) return false;
    return clearRequiredHeadFromActualFields(pumpNode.results, pumpNode);
  }

  function sanitizeAllPumps(model = getModel()) {
    let changed = false;
    Object.values(model || {}).forEach((node) => {
      if (sanitizePumpNode(node)) changed = true;
    });
    return changed;
  }

  function wrapPrimaryResultApplier() {
    const current = root.applyBackendSimulationPrimaryResults;
    if (typeof current !== "function" || current.__headPowerAuditGuardWrapped) return false;

    function guardedApplyBackendSimulationPrimaryResults(pumpNode, result, options = {}) {
      const applied = current.apply(this, arguments);
      if (applied && pumpNode?.results) {
        clearRequiredHeadFromActualFields(pumpNode.results, pumpNode);
      }
      return applied;
    }

    guardedApplyBackendSimulationPrimaryResults.__headPowerAuditGuardWrapped = true;
    root.applyBackendSimulationPrimaryResults = guardedApplyBackendSimulationPrimaryResults;
    return true;
  }

  function wrapUpdateSimulation() {
    const current = root.updateSimulation;
    if (typeof current !== "function" || current.__headPowerAuditGuardWrapped) return false;

    function guardedUpdateSimulation(...args) {
      const result = current.apply(this, args);
      const sanitize = () => sanitizeAllPumps();
      if (result && typeof result.then === "function") {
        return result.finally(sanitize);
      }
      sanitize();
      return result;
    }

    guardedUpdateSimulation.__headPowerAuditGuardWrapped = true;
    root.updateSimulation = guardedUpdateSimulation;
    return true;
  }

  function install() {
    const wrapped = [wrapPrimaryResultApplier(), wrapUpdateSimulation()].some(Boolean);
    sanitizeAllPumps();
    return wrapped;
  }

  root.EngineeringHeadPowerAuditGuard = {
    version: VERSION,
    install,
    sanitizeAllPumps,
    sanitizePumpNode,
    clearRequiredHeadFromActualFields,
    shouldClearActualHead
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.EngineeringHeadPowerAuditGuard;
  }

  install();
  if (typeof root.setTimeout === "function") {
    root.setTimeout(install, 500);
    root.setTimeout(sanitizeAllPumps, 1500);
  }
})("undefined" !== typeof window ? window : globalThis);
