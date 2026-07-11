!function registerEngineeringSinkInputStabilityRuntime(root) {
  "use strict";

  const VERSION = "engineering-sink-input-stability-runtime.v1";
  const EDIT_KEYS = new Set(["demandFlow", "pressure", "elevation"]);
  const INPUT_IDLE_MS = 3000;
  const editStates = new Map();
  const previews = new Map();
  let activeTaskLock = null;
  let renderSidebarPatched = false;
  let patchAttempts = 0;

  function model() {
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function finiteNumber(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function inputContext(target) {
    const input = target?.closest?.('input[data-key][data-node], input[data-key][data-node-id]');
    const key = String(input?.dataset?.key || input?.name || "").trim();
    const sinkId = String(input?.dataset?.node || input?.dataset?.nodeId || "").trim();
    const sink = sinkId ? model()?.[sinkId] : null;
    if (!input || !EDIT_KEYS.has(key) || sink?.type !== "sink") return null;
    return { input, key, sinkId, sink };
  }

  function setPreview(context, value) {
    const previous = previews.get(context.sinkId) || {};
    previews.set(context.sinkId, {
      ...previous,
      [context.key]: value,
      updatedAt: Date.now()
    });
  }

  function retainTaskWindow(context) {
    const taskWindow = context.input.closest?.('.persistent-object-properties-task-window, #taskWindow[data-kind="object"], .task-window[data-kind="object"]');
    if (!taskWindow) return false;
    activeTaskLock = {
      sinkId: context.sinkId,
      taskWindow,
      expiresAt: Date.now() + 12000
    };
    return true;
  }

  function retainedTaskWindow(nodeId = "", options = {}) {
    const lock = activeTaskLock;
    if (!lock?.taskWindow?.isConnected) return null;
    const requestedId = String(nodeId || options?.nodeId || options?.taskWindow?.dataset?.nodeId || "").trim();
    if (requestedId && requestedId !== lock.sinkId) return null;
    const active = typeof document !== "undefined" ? document.activeElement : null;
    const activeKey = String(active?.dataset?.key || active?.name || "").trim();
    const activeSinkId = String(active?.dataset?.node || active?.dataset?.nodeId || "").trim();
    const activeEdit = activeSinkId === lock.sinkId
      && EDIT_KEYS.has(activeKey)
      && active?.closest?.('.persistent-object-properties-task-window, #taskWindow[data-kind="object"], .task-window[data-kind="object"]') === lock.taskWindow;
    if (Date.now() > lock.expiresAt && !activeEdit) return null;
    return lock.taskWindow;
  }

  function patchRenderSidebar() {
    if (renderSidebarPatched || typeof root.renderSidebar !== "function") return false;
    const original = root.renderSidebar;
    if (original.__sinkInputStabilityRuntime) {
      renderSidebarPatched = true;
      return true;
    }
    function sinkInputStableRenderSidebar(...args) {
      const retained = retainedTaskWindow(args[0], args[1]);
      if (retained) {
        root.EngineeringRouteTraceAudit?.syncSinkPropertyWindowCanonicalReadouts?.(retained);
        return retained;
      }
      return original.apply(this, args);
    }
    sinkInputStableRenderSidebar.__sinkInputStabilityRuntime = VERSION;
    sinkInputStableRenderSidebar.__sinkInputStabilityOriginal = original;
    root.renderSidebar = sinkInputStableRenderSidebar;
    renderSidebarPatched = true;
    return true;
  }

  function ensureRenderSidebarPatch() {
    patchAttempts += 1;
    if (patchRenderSidebar() || patchAttempts >= 40) return;
    root.setTimeout?.(ensureRenderSidebarPatch, patchAttempts < 12 ? 100 : 500);
  }

  function previewForNode(node) {
    const entry = Object.entries(model()).find(([, candidate]) => candidate === node && candidate?.type === "sink");
    return entry ? previews.get(entry[0]) || null : null;
  }

  function syncSinkModel(context) {
    const value = finiteNumber(context.input.value);
    const normalized = value === null ? 0 : value;
    context.sink.props ||= {};
    context.sink.props[context.key] = normalized;
    if (context.key === "demandFlow") {
      context.sink.props.flowDemand = normalized;
      context.sink.props.boundaryMode = "Flow Demand Boundary";
      root.EngineeringSourceVolumetricOnlyRuntime?.syncSourceFlowFromSinkDemand?.(
        context.sinkId,
        context.sink,
        model(),
        { refreshInputs: true }
      );
    }
    if (context.key === "pressure") context.sink.props.pressureInputBasis = "Gauge";
    setPreview(context, normalized);
    return normalized;
  }

  function refreshPreview(context) {
    const scope = context.input.closest?.('.persistent-object-properties-task-window, #taskWindow, .task-window') || document;
    root.EngineeringRouteTraceAudit?.syncSinkPropertyWindowCanonicalReadouts?.(scope);
    root.EngineeringRouteTraceAudit?.refreshVisibleAuditSurfaces?.();
  }

  function notifyBackend(context, value) {
    const key = `${context.sinkId}:${context.key}`;
    const state = editStates.get(key) || {};
    if (state.notifiedValue === value) return false;
    state.notifiedValue = value;
    state.timer = 0;
    editStates.set(key, state);
    root.EngineeringRealtimeCalculationDefense?.notifyDependencyChanged?.({
      dependency: `sink.${context.key}`,
      nodeId: context.sinkId,
      reason: `SNK ${context.key} changed; route hydraulic results are recalculating.`,
      sourceEvent: "sink-input-stability",
      target: context.input,
      delayMs: 0,
      initialStatus: "stale"
    });
    return true;
  }

  function scheduleBackend(context, value, immediate = false) {
    const key = `${context.sinkId}:${context.key}`;
    const state = editStates.get(key) || {};
    if (state.timer) root.clearTimeout?.(state.timer);
    state.pendingValue = value;
    state.timer = 0;
    editStates.set(key, state);
    if (immediate) {
      notifyBackend(context, value);
      return;
    }
    state.timer = root.setTimeout?.(() => notifyBackend(context, value), INPUT_IDLE_MS) || 0;
  }

  function handleInputEvent(event) {
    const context = inputContext(event.target);
    if (!context) return false;
    event.stopImmediatePropagation();
    event.stopPropagation();
    retainTaskWindow(context);
    const value = syncSinkModel(context);
    root.EngineeringRealtimeCalculationDefense?.markStale?.(context.sinkId, "SNK boundary input changed; waiting for the final typed value.");
    refreshPreview(context);
    scheduleBackend(
      context,
      value,
      event.type === "change" || root.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve === true
    );
    return true;
  }

  function clearSettledPreviews() {
    if (!previews.size) return;
    previews.clear();
    root.setTimeout?.(() => root.EngineeringRouteTraceAudit?.refreshVisibleAuditSurfaces?.(), 0);
  }

  function install() {
    if (typeof document === "undefined" || document.documentElement.dataset.sinkInputStabilityRuntime === VERSION) return false;
    document.documentElement.dataset.sinkInputStabilityRuntime = VERSION;
    document.addEventListener("input", handleInputEvent, true);
    document.addEventListener("change", handleInputEvent, true);
    document.addEventListener("npsh:calculation-current", clearSettledPreviews, true);
    ensureRenderSidebarPatch();
    return true;
  }

  const api = {
    version: VERSION,
    install,
    handleInputEvent,
    previewForNode,
    clearSettledPreviews
  };

  root.EngineeringSinkInputStabilityRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
  }
}("undefined" !== typeof window ? window : globalThis);
