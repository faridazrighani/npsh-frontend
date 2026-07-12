!function registerEngineeringSinkInputStabilityRuntime(root) {
  "use strict";

  const VERSION = "engineering-sink-input-stability-runtime.v13-canonical-control-sync";
  const EDIT_KEYS = new Set(["demandFlow", "pressure", "elevation"]);
  const INPUT_IDLE_MS = 3000;
  const sharedState = root.__engineeringSinkInputStabilitySharedState || {
    editStates: new Map(),
    previews: new Map()
  };
  root.__engineeringSinkInputStabilitySharedState = sharedState;
  const editStates = sharedState.editStates;
  const previews = sharedState.previews;
  let activeTaskLock = null;
  let activeTaskObserver = null;
  let taskHostObserver = null;
  let observedTaskWindow = null;
  let draftRestorePending = false;
  let renderSidebarPatched = false;
  let patchAttempts = 0;
  const canonicalSyncFrames = new Map();

  function model() {
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function finiteNumber(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function inputContext(target) {
    const input = target?.closest?.('input[data-key]');
    const key = String(input?.dataset?.key || input?.name || "").trim();
    const taskWindow = input?.closest?.('.persistent-object-properties-task-window, #taskWindow[data-kind="object"], .task-window[data-kind="object"]');
    const selectedNodeId = String(root.currentSelectedNode || root.__npshCurrentSelectedNode || "").trim();
    const sinkId = String(
      input?.dataset?.node
      || input?.dataset?.nodeId
      || taskWindow?.dataset?.nodeId
      || (model()?.[selectedNodeId]?.type === "sink" ? selectedNodeId : "")
    ).trim();
    const sink = sinkId ? model()?.[sinkId] : null;
    if (!input || !EDIT_KEYS.has(key) || sink?.type !== "sink") return null;
    return { input, key, sinkId, sink };
  }

  function setPreview(context, value, textOverride = undefined) {
    const previous = previews.get(context.sinkId) || {};
    previews.set(context.sinkId, {
      ...previous,
      [context.key]: value,
      [`${context.key}Text`]: textOverride === undefined ? context.input.value : String(textOverride),
      updatedAt: Date.now()
    });
  }

  function restoreDraftInputs(taskWindow, sinkId, options = {}) {
    if (!taskWindow?.isConnected || !sinkId) return 0;
    const preview = previews.get(sinkId) || {};
    let changed = 0;
    EDIT_KEYS.forEach((key) => {
      const input = taskWindow.querySelector?.(`input[data-key="${key}"]`);
      if (!input) return;
      const draftText = preview[`${key}Text`];
      if (draftText !== undefined && input.value !== String(draftText)) {
        input.value = String(draftText);
        changed += 1;
      }
    });
    const activeKey = activeTaskLock?.taskWindow === taskWindow ? activeTaskLock.activeKey : "";
    const activeInput = activeKey ? taskWindow.querySelector?.(`input[data-key="${activeKey}"]`) : null;
    const currentActive = typeof document !== "undefined" ? document.activeElement : null;
    const focusWasLost = activeInput && (
      currentActive === document?.body
      || currentActive === taskWindow
      || !taskWindow.contains?.(currentActive)
    );
    if (focusWasLost && options.restoreFocus !== false) {
      activeInput.focus?.({ preventScroll: true });
      const draftLength = String(activeInput.value || "").length;
      const start = Math.min(Number(activeTaskLock.selectionStart ?? draftLength), draftLength);
      const end = Math.min(Number(activeTaskLock.selectionEnd ?? start), draftLength);
      try {
        activeInput.setSelectionRange?.(start, end);
      } catch (error) {
        // Number inputs do not expose a writable text selection in some browsers.
      }
    }
    return changed;
  }

  function liveTaskWindow(sinkId) {
    if (typeof document === "undefined" || !sinkId) return null;
    const escaped = root.CSS?.escape ? root.CSS.escape(String(sinkId)) : String(sinkId).replace(/["\\]/g, "\\$&");
    return document.querySelector(`.persistent-object-properties-task-window[data-node-id="${escaped}"]`)
      || Array.from(document.querySelectorAll('.persistent-object-properties-task-window[data-kind="object"]')).find((taskWindow) => (
        taskWindow.dataset?.nodeId === sinkId || taskWindow.textContent?.includes?.(sinkId)
      ))
      || null;
  }

  function canonicalInputValue(sink, key) {
    const props = sink?.props || {};
    const value = key === "demandFlow"
      ? finiteNumber(props.demandFlow ?? props.flowDemand)
      : finiteNumber(props[key]);
    return value === null ? "0" : String(value);
  }

  function syncTaskInputsFromModel(taskWindow, sinkId) {
    const sink = model()?.[sinkId];
    if (!taskWindow?.isConnected || sink?.type !== "sink") return 0;
    const preview = previews.get(sinkId) || {};
    const active = typeof document !== "undefined" ? document.activeElement : null;
    let changed = 0;
    EDIT_KEYS.forEach((key) => {
      const input = taskWindow.querySelector?.(`input[data-key="${key}"]`);
      if (!input) return;
      const activeDraft = active === input && preview[key] !== undefined;
      const nextValue = activeDraft ? String(preview[`${key}Text`] ?? input.value) : canonicalInputValue(sink, key);
      if (input.value !== nextValue) {
        input.value = nextValue;
        changed += 1;
      }
    });
    return changed;
  }

  function stabilizeCanonicalTaskInputs(sinkId, durationMs = 900) {
    const previousFrame = canonicalSyncFrames.get(sinkId);
    if (previousFrame) root.cancelAnimationFrame?.(previousFrame);
    const startedAt = Date.now();
    const run = () => {
      const taskWindow = liveTaskWindow(sinkId);
      if (taskWindow) {
        if (activeTaskLock?.sinkId === sinkId && taskWindow !== activeTaskLock.taskWindow) {
          activeTaskLock.taskWindow = taskWindow;
          observeTaskWindow(taskWindow);
        }
        syncTaskInputsFromModel(taskWindow, sinkId);
        restoreDraftInputs(taskWindow, sinkId);
      }
      if (Date.now() - startedAt >= durationMs) {
        canonicalSyncFrames.delete(sinkId);
        return;
      }
      const frame = root.requestAnimationFrame?.(run) || root.setTimeout?.(run, 16);
      if (frame) canonicalSyncFrames.set(sinkId, frame);
    };
    run();
    return true;
  }

  function scheduleDraftRestore() {
    if (draftRestorePending) return;
    draftRestorePending = true;
    const run = () => {
      draftRestorePending = false;
      if (!activeTaskLock?.sinkId) return;
      const liveTask = liveTaskWindow(activeTaskLock.sinkId);
      if (liveTask && liveTask !== activeTaskLock.taskWindow) {
        activeTaskLock.taskWindow = liveTask;
        activeTaskLock.expiresAt = Date.now() + 12000;
        observeTaskWindow(liveTask);
      }
      if (activeTaskLock.taskWindow?.isConnected) restoreDraftInputs(activeTaskLock.taskWindow, activeTaskLock.sinkId);
    };
    if (typeof root.queueMicrotask === "function") root.queueMicrotask(run);
    else Promise.resolve().then(run);
  }

  function observeTaskWindow(taskWindow) {
    if (!taskWindow || typeof root.MutationObserver !== "function") return false;
    if (observedTaskWindow === taskWindow && activeTaskObserver) return true;
    activeTaskObserver?.disconnect?.();
    observedTaskWindow = taskWindow;
    activeTaskObserver = new root.MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "childList")) scheduleDraftRestore();
    });
    activeTaskObserver.observe(taskWindow, { childList: true, subtree: true });
    return true;
  }

  function observeTaskHost() {
    if (taskHostObserver || typeof document === "undefined" || typeof root.MutationObserver !== "function") return !!taskHostObserver;
    const host = document.body || document.documentElement;
    if (!host) return false;
    taskHostObserver = new root.MutationObserver((mutations) => {
      if (!activeTaskLock?.sinkId) return;
      const taskMutation = mutations.some((mutation) => Array.from(mutation.addedNodes || []).some((node) => (
        node?.nodeType === 1 && (
          node.matches?.('.persistent-object-properties-task-window')
          || node.querySelector?.('.persistent-object-properties-task-window')
        )
      )));
      if (taskMutation || !activeTaskLock.taskWindow?.isConnected) scheduleDraftRestore();
    });
    taskHostObserver.observe(host, { childList: true, subtree: true });
    return true;
  }

  function retainTaskWindow(context) {
    const taskWindow = context.input.closest?.('.persistent-object-properties-task-window, #taskWindow[data-kind="object"], .task-window[data-kind="object"]');
    if (!taskWindow) return false;
    activeTaskLock = {
      sinkId: context.sinkId,
      taskWindow,
      activeKey: context.key,
      selectionStart: context.input.selectionStart,
      selectionEnd: context.input.selectionEnd,
      expiresAt: Date.now() + 12000
    };
    observeTaskWindow(taskWindow);
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
        syncTaskInputsFromModel(retained, activeTaskLock?.sinkId || "");
        restoreDraftInputs(retained, activeTaskLock?.sinkId || "");
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

  function syncSinkModel(context, preferredValue = undefined) {
    const value = preferredValue === undefined ? finiteNumber(context.input.value) : finiteNumber(preferredValue);
    const normalized = value === null ? 0 : value;
    context.sink.props ||= {};
    context.sink.props[context.key] = normalized;
    if (context.key === "demandFlow") {
      context.sink.props.flowDemand = normalized;
      context.sink.props.boundaryMode = "Flow Demand Boundary";
    }
    if (context.key === "pressure") context.sink.props.pressureInputBasis = "Gauge";
    const previousPreview = previews.get(context.sinkId) || {};
    const preferredText = preferredValue === undefined
      ? undefined
      : (previousPreview[`${context.key}Text`] ?? String(normalized));
    setPreview(context, normalized, preferredText);
    if (activeTaskLock?.taskWindow === context.input.closest?.('.persistent-object-properties-task-window, #taskWindow[data-kind="object"], .task-window[data-kind="object"]')) {
      activeTaskLock.activeKey = context.key;
      activeTaskLock.selectionStart = context.input.selectionStart;
      activeTaskLock.selectionEnd = context.input.selectionEnd;
      activeTaskLock.expiresAt = Date.now() + 12000;
    }
    return normalized;
  }

  function notifyBackend(context, value) {
    const key = `${context.sinkId}:${context.key}`;
    const state = editStates.get(key) || {};
    if (state.notifiedValue === value) return false;
    state.notifiedValue = value;
    state.timer = 0;
    editStates.set(key, state);
    if (context.key === "demandFlow") {
      root.EngineeringSourceVolumetricOnlyRuntime?.syncSourceFlowFromSinkDemand?.(
        context.sinkId,
        context.sink,
        model(),
        { refreshInputs: false }
      );
    }
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
    const commitWhenUnfocused = () => {
      if (typeof document !== "undefined" && document.activeElement === context.input) {
        const current = editStates.get(key) || state;
        current.timer = root.setTimeout?.(commitWhenUnfocused, INPUT_IDLE_MS) || 0;
        editStates.set(key, current);
        return;
      }
      notifyBackend(context, value);
    };
    state.timer = root.setTimeout?.(commitWhenUnfocused, INPUT_IDLE_MS) || 0;
  }

  function handleInputEvent(event) {
    const context = inputContext(event.target);
    if (!context) return false;
    event.stopImmediatePropagation();
    event.stopPropagation();
    retainTaskWindow(context);
    if (event.type === "change") {
      const preview = previews.get(context.sinkId) || {};
      const draftText = preview[`${context.key}Text`];
      if (draftText !== undefined && context.input.value !== String(draftText)) {
        context.input.value = String(draftText);
        return true;
      }
    }
    const value = syncSinkModel(context);
    scheduleBackend(
      context,
      value,
      root.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve === true
    );
    scheduleDraftRestore();
    return true;
  }

  function handleEditFocus(event) {
    const context = inputContext(event.target);
    if (!context) return false;
    retainTaskWindow(context);
    return true;
  }

  function handleEditCommit(event) {
    const context = inputContext(event.target);
    if (!context) return false;
    if (event.type === "keydown" && event.key !== "Enter") return false;
    const preview = previews.get(context.sinkId) || {};
    const value = syncSinkModel(context, preview[context.key]);
    restoreDraftInputs(activeTaskLock?.taskWindow, context.sinkId, { restoreFocus: false });
    scheduleBackend(context, value, true);
    return true;
  }

  function clearSettledPreviews() {
    if (!previews.size) return;
    const sinkIds = new Set(previews.keys());
    if (activeTaskLock?.sinkId) sinkIds.add(activeTaskLock.sinkId);
    const active = typeof document !== "undefined" ? document.activeElement : null;
    const activeContext = inputContext(active);
    previews.forEach((preview, sinkId) => {
      if (activeContext?.sinkId === sinkId && preview[activeContext.key] !== undefined) return;
      const settled = Array.from(EDIT_KEYS).every((key) => {
        if (preview[key] === undefined) return true;
        const state = editStates.get(`${sinkId}:${key}`) || {};
        return !state.timer && state.notifiedValue === preview[key];
      });
      if (settled) previews.delete(sinkId);
    });
    sinkIds.forEach((sinkId) => stabilizeCanonicalTaskInputs(sinkId));
  }

  function install() {
    if (typeof document === "undefined" || document.documentElement.dataset.sinkInputStabilityRuntime === VERSION) return false;
    document.documentElement.dataset.sinkInputStabilityRuntime = VERSION;
    document.addEventListener("pointerdown", handleEditFocus, true);
    document.addEventListener("focusin", handleEditFocus, true);
    document.addEventListener("focusout", handleEditCommit, true);
    document.addEventListener("keydown", handleEditCommit, true);
    document.addEventListener("input", handleInputEvent, true);
    document.addEventListener("change", handleInputEvent, true);
    document.addEventListener("npsh:calculation-current", clearSettledPreviews, true);
    observeTaskHost();
    ensureRenderSidebarPatch();
    return true;
  }

  const api = {
    version: VERSION,
    install,
    handleInputEvent,
    handleEditFocus,
    handleEditCommit,
    previewForNode,
    syncTaskInputsFromModel,
    stabilizeCanonicalTaskInputs,
    clearSettledPreviews
  };

  root.EngineeringSinkInputStabilityRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
    else install();
  }
}("undefined" !== typeof window ? window : globalThis);
