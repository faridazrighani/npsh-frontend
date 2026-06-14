(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'engineering-simulation-case-integrity-guard.v1';
  const CACHE_KEY = '20260614-simulation-case-integrity3';
  const CASE4_SAMPLE_FILE = 'journals/simulasi_4/Methanol_Analisa_NPSH_Kerusakan_Impeller.untirta';
  const RESTORE_COOLDOWN_MS = 8000;
  let scheduledTimer = 0;
  let observer = null;

  function getAppFunction(name) {
    if (typeof root[name] === 'function') return root[name];
    try {
      if (name === 'getSimulationState' && typeof getSimulationState === 'function') return getSimulationState;
      if (name === 'decodeUntirtaProjectBuffer' && typeof decodeUntirtaProjectBuffer === 'function') return decodeUntirtaProjectBuffer;
      if (name === 'applySimulationStateAtomic' && typeof applySimulationStateAtomic === 'function') return applySimulationStateAtomic;
      if (name === 'captureState' && typeof captureState === 'function') return captureState;
      if (name === 'drawConnections' && typeof drawConnections === 'function') return drawConnections;
      if (name === 'updateSimulation' && typeof updateSimulation === 'function') return updateSimulation;
      if (name === 'updateBasisStatusPill' && typeof updateBasisStatusPill === 'function') return updateBasisStatusPill;
      if (name === 'refreshFluidBasisReadouts' && typeof refreshFluidBasisReadouts === 'function') return refreshFluidBasisReadouts;
      if (name === 'refreshOpenRealtimeSecondaryTaskWindows' && typeof refreshOpenRealtimeSecondaryTaskWindows === 'function') return refreshOpenRealtimeSecondaryTaskWindows;
      if (name === 'showUiToast' && typeof showUiToast === 'function') return showUiToast;
    } catch (error) {
      // Fall through.
    }
    return null;
  }

  function readSimulationState() {
    const getState = getAppFunction('getSimulationState');
    if (typeof getState !== 'function') return null;
    try {
      return JSON.parse(getState());
    } catch (error) {
      return null;
    }
  }

  function getModel() {
    const state = readSimulationState();
    if (state && state.model) return state.model;
    try {
      if (typeof globalModel !== 'undefined' && globalModel) return globalModel;
    } catch (error) {
      // Protected builds may hide direct globals.
    }
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function getConnections() {
    const state = readSimulationState();
    if (Array.isArray(state?.connections)) return state.connections;
    try {
      if (typeof connections !== 'undefined' && Array.isArray(connections)) return connections;
    } catch (error) {
      // Protected builds may hide direct globals.
    }
    return Array.isArray(root.connections) ? root.connections : [];
  }

  function finiteNumber(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function near(value, target, tolerance) {
    const number = finiteNumber(value);
    return number !== null && Math.abs(number - target) <= tolerance;
  }

  function nodeIdsByType(model, type) {
    return Object.entries(model || {})
      .filter(([, node]) => node && String(node.type || '').toLowerCase() === type)
      .map(([id]) => id);
  }

  function hasCanvasObject(nodeId) {
    if (typeof document === 'undefined' || !nodeId) return true;
    const canvas = document.getElementById('canvas');
    if (!canvas) return true;
    const normalized = String(nodeId);
    const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(normalized)
      : normalized.replace(/["\\]/g, '\\$&');
    const compact = escaped.toLowerCase().replace(/-/g, '');
    return !!canvas.querySelector(
      `.pfd-object[data-id="${escaped}"], .pfd-object[data-node-id="${escaped}"], #obj-${compact}`
    );
  }

  function looksLikeSimulation4Boundary(model = getModel()) {
    const fluid = model.FLUID || {};
    const source = model['SRC-100'] || {};
    const sink = model['SNK-100'] || {};
    const fluidName = String(fluid.props?.fluidName || fluid.name || '').toLowerCase();
    return fluidName.includes('methanol')
      && source.type === 'source'
      && sink.type === 'sink'
      && near(source.props?.pressure ?? source.results?.pressure, 0.368, 0.02)
      && near(sink.props?.demandFlow ?? sink.results?.flow, 280, 0.25)
      && near(sink.props?.pressure ?? sink.results?.boundaryPressure, 3.336, 0.05);
  }

  function isSimulationCase4PartialModel(model = getModel()) {
    if (!looksLikeSimulation4Boundary(model)) return false;
    const pumpCount = nodeIdsByType(model, 'pump').length;
    const pipeCount = nodeIdsByType(model, 'pipe').length;
    const connectionCount = Array.isArray(model.connections) ? model.connections.length : getConnections().length;
    return pumpCount < 1 || pipeCount < 2 || connectionCount < 2;
  }

  function needsCanvasObjectRepair(model = getModel()) {
    if (typeof document === 'undefined') return false;
    const equipmentIds = Object.entries(model || {})
      .filter(([, node]) => node && node.type && !['settings', 'fluid', 'pipe'].includes(String(node.type).toLowerCase()))
      .map(([id]) => id);
    if (!equipmentIds.length) return false;
    return equipmentIds.some((id) => !hasCanvasObject(id));
  }

  function refreshCanvasAndReadouts() {
    try { getAppFunction('drawConnections')?.(); } catch (error) {}
    try { getAppFunction('updateSimulation')?.({ renderSidebarAfter: false }); } catch (error) {}
    try { getAppFunction('updateBasisStatusPill')?.(); } catch (error) {}
    try { getAppFunction('refreshFluidBasisReadouts')?.(); } catch (error) {}
    try { getAppFunction('refreshOpenRealtimeSecondaryTaskWindows')?.(); } catch (error) {}
    try { document.dispatchEvent(new CustomEvent('npsh:simulation-case-integrity-restored', { detail: { version: VERSION } })); } catch (error) {}
  }

  async function restoreSimulation4FromSample(reason = 'partial simulation case 4') {
    const now = Date.now();
    const last = Number(root.__simulationCaseIntegrityGuardLastRestoreAt || 0);
    if (root.__simulationCaseIntegrityGuardRestoring || now - last < RESTORE_COOLDOWN_MS) return false;
    const decodeUntirta = getAppFunction('decodeUntirtaProjectBuffer');
    const applyState = getAppFunction('applySimulationStateAtomic');
    if (typeof decodeUntirta !== 'function' || typeof applyState !== 'function') {
      root.__simulationCaseIntegrityGuardLastError = 'Sample restore skipped: project decoder/apply function is not ready.';
      return false;
    }
    root.__simulationCaseIntegrityGuardRestoring = true;
    root.__simulationCaseIntegrityGuardLastRestoreAt = now;
    try {
      const response = await fetch(CASE4_SAMPLE_FILE, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Unable to restore Simulasi 4 sample (${response.status}).`);
      const decoded = await decodeUntirta(await response.arrayBuffer());
      getAppFunction('captureState')?.();
      applyState(decoded.jsonString);
      refreshCanvasAndReadouts();
      root.__simulationCaseIntegrityGuardLastRestore = {
        version: VERSION,
        reason,
        sampleFile: CASE4_SAMPLE_FILE,
        restoredAt: new Date().toISOString()
      };
      getAppFunction('showUiToast')?.('Simulasi 4 route restored from the validated sample file.', {
        title: 'Canvas restored',
        variant: 'info',
        duration: 3600
      });
      return true;
    } catch (error) {
      root.__simulationCaseIntegrityGuardLastError = error?.message || String(error);
      getAppFunction('showUiToast')?.(root.__simulationCaseIntegrityGuardLastError, {
        title: 'Canvas restore failed',
        variant: 'error',
        duration: 6000
      });
      return false;
    } finally {
      root.__simulationCaseIntegrityGuardRestoring = false;
    }
  }

  function repairRenderedObjectsFromState(reason = 'missing canvas object') {
    const getState = getAppFunction('getSimulationState');
    const applyState = getAppFunction('applySimulationStateAtomic');
    if (typeof getState !== 'function' || typeof applyState !== 'function') return false;
    if (!needsCanvasObjectRepair()) return false;
    try {
      applyState(getState());
      refreshCanvasAndReadouts();
      root.__simulationCaseIntegrityGuardLastRepair = {
        version: VERSION,
        reason,
        repairedAt: new Date().toISOString()
      };
      return true;
    } catch (error) {
      root.__simulationCaseIntegrityGuardLastError = error?.message || String(error);
      return false;
    }
  }

  async function audit(reason = 'scheduled audit') {
    if (isSimulationCase4PartialModel()) {
      return restoreSimulation4FromSample(reason);
    }
    return repairRenderedObjectsFromState(reason);
  }

  function scheduleAudit(reason = 'model changed') {
    if (!root.setTimeout) return audit(reason);
    root.clearTimeout?.(scheduledTimer);
    scheduledTimer = root.setTimeout(() => {
      scheduledTimer = 0;
      audit(reason);
    }, 220);
    return true;
  }

  function installObserver() {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || observer) return false;
    const canvas = document.getElementById('canvas');
    if (!canvas) return false;
    observer = new MutationObserver(() => scheduleAudit('canvas mutation'));
    observer.observe(canvas, { childList: true, subtree: false });
    return true;
  }

  function install() {
    scheduleAudit('runtime install');
    installObserver();
    root.document?.addEventListener?.('npsh:realtime-autosolve-complete', () => scheduleAudit('autosolve complete'));
    root.document?.addEventListener?.('npsh:linked-views-refreshed', () => scheduleAudit('linked views refreshed'));
    root.addEventListener?.('load', () => scheduleAudit('window load'));
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    install,
    audit,
    scheduleAudit,
    isSimulationCase4PartialModel,
    looksLikeSimulation4Boundary,
    needsCanvasObjectRepair,
    restoreSimulation4FromSample,
    repairRenderedObjectsFromState
  };

  root.EngineeringSimulationCaseIntegrityGuard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  install();
})();
