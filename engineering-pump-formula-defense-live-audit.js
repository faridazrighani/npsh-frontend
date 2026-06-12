(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'pump-formula-defense-live-audit.v2';
  const WINDOW_SELECTOR = '.pump-formula-defense-task-window';
  const BADGE_SELECTOR = '[data-pump-formula-defense-live-badges]';
  const SUMMARY_SELECTOR = '[data-pump-formula-defense-vendor-summary]';
  const REALTIME_EVENTS = [
    'npsh:calculation-stale',
    'npsh:calculation-calculating',
    'npsh:calculation-current',
    'npsh:linked-views-refreshed',
    'npsh:realtime-autosolve-complete'
  ];
  const LIVE_INPUT_PATTERN = /\b(inputMode|optimizationMode|npshrSourceMode|npshAssessmentMode|npshMarginBasis|designFlow|designHead|designEfficiency|designNpshr|bepFlow|porMinPercent|porMaxPercent|aorMinPercent|aorMaxPercent|minNpshMarginRatio|minNpshMargin|speed|curveDataSource|curveSourceNote|curveData|flow|head|eff|npshr|pressure|pressureInputBasis|pressureBasis|pressureEnergyBasis|elevation|suctionElevation|dischargeElevation|density|viscosity|kinematicViscosity|dynamicViscosity|vaporPressure|segments|length|diameter|roughness|fittingType|fittingQuantity|fittingK|minorLoss|additionalK|active|boundaryMode|demandFlow)\b/i;
  let backendRefreshTimer = null;
  let backendRefreshBusy = false;
  let windowRefreshTimer = null;
  let runtimeGuardTimer = null;
  let refreshingWindowContent = false;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function runtimeModel() {
    try {
      if (typeof globalModel !== 'undefined' && globalModel) return globalModel;
    } catch (error) {
      // Global model is not always attached to window in protected builds.
    }
    try {
      const state = typeof root.getSimulationState === 'function'
        ? JSON.parse(root.getSimulationState())
        : null;
      if (state?.model) return state.model;
    } catch (error) {
      // Fall through to legacy window-attached names.
    }
    return root.__npshGlobalModel || root.globalModel || {};
  }

  function hasDocument() {
    return typeof document !== 'undefined' && document?.querySelectorAll;
  }

  function firstPumpId(model) {
    return Object.keys(model || {}).find((id) => model[id]?.type === 'pump') || '';
  }

  function defenseInputSource(title) {
    const label = String(title || '').toLowerCase();
    if (label.includes('npshr')) return 'Pump datasheet/manual, engineering-fit curve, or manufacturer/test curve at evaluated flow.';
    if (label.includes('npsha')) return 'Current suction-side energy balance after source pressure, elevation, suction loss, and vapor pressure.';
    if (label.includes('suction loss')) return 'Current suction route pipe/fitting/valve loss trace.';
    if (label.includes('margin') || label.includes('required')) return 'Selected NPSH margin basis, NPSHa, and NPSHr.';
    if (label.includes('operating')) return 'Evaluated flow, BEP Flow, POR, and AOR settings.';
    if (label.includes('vapor')) return 'Active Fluid Basis vapor pressure and density.';
    return 'Current pump/network calculation trace.';
  }

  function defenseLiterature(title) {
    const label = String(title || '').toLowerCase();
    if (label.includes('npshr')) return 'ANSI/HI NPSHR definition and manufacturer/test curve preference.';
    if (label.includes('npsha') || label.includes('vapor')) return 'ANSI/HI NPSHA determination at the pump datum and Bernoulli energy balance.';
    if (label.includes('suction loss')) return 'Darcy-Weisbach major loss and K-method minor loss from fluid mechanics references.';
    if (label.includes('margin') || label.includes('required')) return 'ANSI/HI NPSH margin and ratio screening basis.';
    return 'Local thesis literature set: fluid mechanics, cavitation, and pump operating range references.';
  }

  function defenseNote(title) {
    const label = String(title || '').toLowerCase();
    if (label.includes('npshr')) return 'NPSHr is pump-derived; final validation should cite vendor, manufacturer/test, or justified journal curve data.';
    if (label.includes('npsha')) return 'NPSHa is system-derived and must move when SRC pressure, Fluid Basis, suction loss, or elevation changes.';
    if (label.includes('suction loss')) return 'Suction loss is a direct NPSHa subtraction and a practical engineering improvement lever.';
    if (label.includes('margin')) return 'The app separates raw margin from the stricter required-NPSHa acceptance check.';
    return 'Use this row as advisor-facing evidence for the live pump number.';
  }

  function ensureFormulaDefenseRows(evaluation = {}) {
    const trace = evaluation.calculationTrace || {};
    if (!Array.isArray(trace.steps)) return;
    const existingRows = Array.isArray(trace.academicFormulaDefenseRows) && trace.academicFormulaDefenseRows.length
      ? trace.academicFormulaDefenseRows
      : (Array.isArray(trace.formulaDefenseRows) && trace.formulaDefenseRows.length ? trace.formulaDefenseRows : []);
    if (existingRows.length && !existingRows.some((row) => row?.liveAuditFallback === true)) {
      trace.academicFormulaDefenseRows = existingRows;
      trace.formulaDefenseRows = existingRows;
      return;
    }
    const rows = trace.steps.map((step, index) => {
      const title = step.title || step.label || `Step ${index + 1}`;
      return {
        order: index + 1,
        liveAuditFallback: true,
        step: title,
        inputSource: defenseInputSource(title),
        formula: step.formula || '-',
        substitution: step.substitution || '-',
        result: step.result ?? null,
        unit: step.unit || '',
        literature: defenseLiterature(title),
        defenseNote: defenseNote(title)
      };
    });
    rows.push({
      order: rows.length + 1,
      liveAuditFallback: true,
      step: 'Data Confidence Gate',
      inputSource: 'Hydraulic NPSH status, NPSHr source quality, and selected assessment mode.',
      formula: 'Engineering status = hydraulic status + NPSHr data confidence',
      substitution: `Hydraulic: ${evaluation.hydraulicStatus || evaluation.status || '-'}; Data: ${evaluation.dataConfidence || '-'}; Engineering: ${evaluation.engineeringStatus || evaluation.status || '-'}`,
      result: evaluation.engineeringStatus || evaluation.status || '-',
      unit: '',
      literature: 'ANSI/HI distinguishes system NPSHA from pump/manufacturer NPSHR; manufacturer/test data is preferred for final validation.',
      defenseNote: 'This is the advisor-facing gate for why hydraulic safety and vendor/source confidence are separate.'
    });
    trace.formulaDefenseSchemaVersion = trace.formulaDefenseSchemaVersion || 'pump-formula-defense.v1';
    trace.academicFormulaDefenseRows = rows;
    trace.formulaDefenseRows = rows;
  }

  function resolvePumpId(pumpId) {
    const model = runtimeModel();
    if (pumpId && model[pumpId]?.type === 'pump') return pumpId;
    if (!hasDocument()) return firstPumpId(model);
    const visibleWindow = Array.from(document.querySelectorAll(WINDOW_SELECTOR))
      .find((node) => node.offsetParent !== null || node.getClientRects().length);
    return visibleWindow?.dataset?.pumpId || firstPumpId(model);
  }

  function pumpResult(pumpId) {
    const model = runtimeModel();
    const id = resolvePumpId(pumpId);
    const pump = model[id] || {};
    const results = pump.results || {};
    const evaluation = results.npshEvaluation || results;
    const trace = evaluation.calculationTrace || {};
    ensureFormulaDefenseRows(evaluation);
    const rows = Array.isArray(trace.academicFormulaDefenseRows)
      ? trace.academicFormulaDefenseRows
      : (Array.isArray(trace.formulaDefenseRows) ? trace.formulaDefenseRows : []);
    const steps = Array.isArray(trace.steps) ? trace.steps : [];
    return { id, pump, results, evaluation, trace, rows, steps };
  }

  function truthyText(value) {
    return value === true ? 'Yes' : value === false ? 'No' : (value || '-');
  }

  function buildSummary(pumpId) {
    const { pump, results, evaluation, trace, rows, steps } = pumpResult(pumpId);
    const props = pump.props || {};
    const action = results.actionReadinessBackend || results.backendActionReadiness || results.actionReadinessFrontend || {};
    const exportReady = root.EngineeringDefenseExportPackage ? 'Ready' : 'Unavailable';
    const releaseIntegrity = root.EngineeringLibraryGovernance ? 'Loaded' : 'Not loaded';
    const pageLock = trace.formulaDefenseSchemaVersion || rows.length ? 'Locked' : (steps.length ? 'Trace fallback' : 'Missing');
    const freshness = results.isCalculationStale || action.stale || action.isStale
      ? 'Stale'
      : (results.calculationFreshness || action.freshness || 'Fresh');
    const curveBasis = props.curveDataSource || props.curveBasis || evaluation.curveBasis || evaluation.npshrSource || '-';
    const npshrSource = evaluation.npshrSource || props.npshrSourceMode || '-';
    const manufacturerVerified = /manufacturer|test/i.test(String(npshrSource));
    const engineeringFit = /engineering/i.test(String(curveBasis)) || /engineering/i.test(String(npshrSource));
    const reviewRequired = !manufacturerVerified || /estimated|engineering/i.test(`${curveBasis} ${npshrSource}`);
    return {
      pageLock,
      releaseIntegrity,
      exportReady,
      freshness,
      curveBasis,
      npshrSource,
      manufacturerVerified,
      engineeringFit,
      reviewRequired,
      rowCount: rows.length,
      stepCount: steps.length
    };
  }

  function badge(label, value) {
    const text = String(value || '-');
    const lower = text.toLowerCase();
    const color = lower.includes('stale') || lower.includes('missing') || lower.includes('unavailable') || lower.includes('not loaded')
      ? '#92400e'
      : '#0f5132';
    const bg = lower.includes('stale') || lower.includes('missing') || lower.includes('unavailable') || lower.includes('not loaded')
      ? '#fff7ed'
      : '#ecfdf5';
    return `<span style="display:inline-flex;align-items:center;gap:4px;min-height:24px;padding:3px 8px;border:1px solid #cbd5e1;border-radius:6px;background:${bg};color:${color};font-size:11px;font-weight:700;line-height:1.2;"><span style="color:#475569;font-weight:600;">${escapeHtml(label)}</span>${escapeHtml(text)}</span>`;
  }

  function ensurePanel(windowNode, selector, attributeName, position) {
    let panel = windowNode.querySelector(selector);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.setAttribute(attributeName, 'true');
    panel.style.cssText = 'margin:8px 0;padding:8px;border:1px solid #d6e4f2;border-radius:6px;background:#f8fbff;color:#17395a;';
    const anchor = windowNode.querySelector('.task-window-body, .window-body, .task-content, .task-window-content, .modal-body') || windowNode;
    if (position === 'after-badges') {
      const badges = windowNode.querySelector(BADGE_SELECTOR);
      badges?.insertAdjacentElement('afterend', panel) || anchor.insertBefore(panel, anchor.firstChild);
    } else {
      anchor.insertBefore(panel, anchor.firstChild);
    }
    return panel;
  }

  function injectIntoWindow(windowNode, pumpId) {
    if (!windowNode) return;
    const summary = buildSummary(pumpId || windowNode.dataset?.pumpId);
    const badges = ensurePanel(windowNode, BADGE_SELECTOR, 'data-pump-formula-defense-live-badges');
    badges.innerHTML = [
      badge('Page Lock', summary.pageLock),
      badge('Release Integrity', summary.releaseIntegrity),
      badge('Defense Export', summary.exportReady),
      badge('Freshness', summary.freshness)
    ].join(' ');

    const vendor = ensurePanel(windowNode, SUMMARY_SELECTOR, 'data-pump-formula-defense-vendor-summary', 'after-badges');
    vendor.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;font-size:11px;line-height:1.3;">
        <div><span style="color:#64748b;">Curve Basis</span><strong style="display:block;">${escapeHtml(summary.curveBasis)}</strong></div>
        <div><span style="color:#64748b;">NPSHr Source</span><strong style="display:block;">${escapeHtml(summary.npshrSource)}</strong></div>
        <div><span style="color:#64748b;">Trace Rows</span><strong style="display:block;">${escapeHtml(summary.rowCount)} / ${escapeHtml(summary.stepCount)}</strong></div>
        <div><span style="color:#64748b;">Manufacturer/Test</span><strong style="display:block;">${escapeHtml(truthyText(summary.manufacturerVerified))}</strong></div>
        <div><span style="color:#64748b;">Engineering Fit</span><strong style="display:block;">${escapeHtml(truthyText(summary.engineeringFit))}</strong></div>
        <div><span style="color:#64748b;">Review Required</span><strong style="display:block;">${escapeHtml(truthyText(summary.reviewRequired))}</strong></div>
      </div>
    `;
  }

  function refreshPumpFormulaDefenseAudit(pumpId) {
    const id = resolvePumpId(pumpId);
    if (!hasDocument()) return 0;
    let refreshed = 0;
    document.querySelectorAll(WINDOW_SELECTOR).forEach((windowNode) => injectIntoWindow(windowNode, id));
    document.querySelectorAll(WINDOW_SELECTOR).forEach(() => { refreshed += 1; });
    return refreshed;
  }

  function refreshOpenFormulaDefenseWindows(pumpId = '', options = {}) {
    if (!hasDocument()) return 0;
    const windows = Array.from(document.querySelectorAll(WINDOW_SELECTOR));
    if (!windows.length) return 0;
    const ids = [...new Set(windows.map((windowNode) => resolvePumpId(pumpId || windowNode.dataset?.pumpId)).filter(Boolean))];
    let refreshed = 0;
    if (options.rebuild !== false && typeof root.refreshPumpFormulaDefenseWindowContent === 'function' && !refreshingWindowContent) {
      refreshingWindowContent = true;
      try {
        ids.forEach((id) => {
          root.refreshPumpFormulaDefenseWindowContent(id);
          refreshed += 1;
        });
      } catch (error) {
        console.warn(`${VERSION}: Pump Formula Defense content refresh failed; live badges will still refresh.`, error);
      } finally {
        refreshingWindowContent = false;
      }
    }
    refreshed += refreshPumpFormulaDefenseAudit(pumpId);
    root.__pumpFormulaDefenseLiveAuditLastRefresh = {
      version: VERSION,
      pumpIds: ids,
      refreshed,
      reason: options.reason || 'manual',
      refreshedAt: new Date().toISOString()
    };
    return refreshed;
  }

  function scheduleOpenFormulaDefenseWindowRefresh(pumpId = '', options = {}) {
    if (!root.setTimeout || !root.clearTimeout) {
      return refreshOpenFormulaDefenseWindows(pumpId, options);
    }
    root.clearTimeout(windowRefreshTimer);
    const delayMs = Number.isFinite(Number(options.delayMs)) ? Math.max(0, Number(options.delayMs)) : 40;
    windowRefreshTimer = root.setTimeout(() => {
      refreshOpenFormulaDefenseWindows(pumpId, options);
    }, delayMs);
    return true;
  }

  function visibleFormulaDefensePumpIds(pumpId) {
    if (!hasDocument()) return pumpId ? [resolvePumpId(pumpId)].filter(Boolean) : [];
    const windows = Array.from(document.querySelectorAll(WINDOW_SELECTOR))
      .filter((windowNode) => windowNode.offsetParent !== null || windowNode.getClientRects().length);
    if (!windows.length) return pumpId ? [resolvePumpId(pumpId)].filter(Boolean) : [];
    const ids = windows
      .map((windowNode) => resolvePumpId(pumpId || windowNode.dataset?.pumpId))
      .filter(Boolean);
    return [...new Set(ids.length ? ids : [resolvePumpId(pumpId)])].filter(Boolean);
  }

  function inputTokens(target) {
    if (!target) return '';
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
    ].filter(Boolean).join(' ');
  }

  function resolvePumpIdFromTarget(target) {
    const holder = target?.closest?.('[data-node], [data-node-id], [data-pump-node-id], [data-task-node-id]');
    const candidate = target?.dataset?.node
      || target?.dataset?.nodeId
      || target?.dataset?.pumpNodeId
      || holder?.dataset?.node
      || holder?.dataset?.nodeId
      || holder?.dataset?.pumpNodeId
      || holder?.dataset?.taskNodeId
      || '';
    return resolvePumpId(candidate);
  }

  function isFormulaDefenseLiveInput(target) {
    if (!target || !target.matches?.('input, select, textarea')) return false;
    if (target.disabled || target.readOnly || target.type === 'file') return false;
    if (target.closest?.('#pumpCurveTable') && /^(flow|head|eff|npshr)$/i.test(String(target.dataset?.field || ''))) return true;
    const insideLiveEditor = target.closest?.('.task-window, .full-editor-modal, .canvas-task-window, #taskWindowBody, [data-task-prop-body="true"]');
    return !!insideLiveEditor && LIVE_INPUT_PATTERN.test(inputTokens(target));
  }

  function bindRealtimeEvents() {
    if (!hasDocument() || document.__pumpFormulaDefenseLiveAuditRealtimeEventsBound) return false;
    const onRealtimeEvent = (event) => {
      const detail = event?.detail || {};
      const shouldRebuild = event.type === 'npsh:calculation-current'
        || event.type === 'npsh:linked-views-refreshed'
        || event.type === 'npsh:realtime-autosolve-complete';
      scheduleOpenFormulaDefenseWindowRefresh(detail.nodeId || detail.pumpId || detail.selectedNodeId || '', {
        reason: event.type,
        rebuild: shouldRebuild,
        delayMs: event.type === 'npsh:calculation-current' || event.type === 'npsh:linked-views-refreshed' ? 0 : 40
      });
    };
    REALTIME_EVENTS.forEach((name) => document.addEventListener(name, onRealtimeEvent));
    document.__pumpFormulaDefenseLiveAuditRealtimeEventsBound = true;
    return true;
  }

  function bindLiveInputRefresh() {
    if (!hasDocument() || document.__pumpFormulaDefenseLiveAuditInputBound) return false;
    const onInput = (event) => {
      if (event?.isComposing || !isFormulaDefenseLiveInput(event.target)) return;
      scheduleOpenFormulaDefenseWindowRefresh(resolvePumpIdFromTarget(event.target), {
        reason: 'live-input',
        rebuild: false,
        delayMs: 0
      });
    };
    document.addEventListener('input', onInput, true);
    document.addEventListener('change', onInput, true);
    document.__pumpFormulaDefenseLiveAuditInputBound = true;
    return true;
  }

  async function refreshBackendForFormulaDefense(pumpId) {
    const pumpIds = visibleFormulaDefensePumpIds(pumpId);
    if (!pumpIds.length || backendRefreshBusy) {
      refreshOpenFormulaDefenseWindows(pumpId, { reason: 'backend-refresh-skipped', rebuild: false });
      return;
    }
    backendRefreshBusy = true;
    try {
      let applied = false;
      if (typeof root.runBackendProtectedPumpSimulation === 'function') {
        for (const id of pumpIds) {
          const result = await root.runBackendProtectedPumpSimulation(id, {
            refreshReason: 'solve',
            force: true,
            allowExternalApiOnLocal: true,
            backendMode: 'primary',
            primaryBackend: true,
            useBackendPrimary: true,
            protectedFrontend: true
          });
          applied = applied || result?.primaryApplied === true;
        }
      }
      if (!applied) {
        for (const id of pumpIds) {
          applied = await directBackendFormulaDefenseRefresh(id) || applied;
        }
      }
      if (typeof root.refreshBackendProtectedRealtimeTaskWindows === 'function') {
        root.refreshBackendProtectedRealtimeTaskWindows('pump-formula-defense-live-audit', { renderSidebarAfter: false });
      }
    } catch (error) {
      console.warn(`${VERSION}: backend formula defense refresh failed.`, error);
    } finally {
      backendRefreshBusy = false;
      refreshOpenFormulaDefenseWindows(pumpId, { reason: 'backend-refresh-complete' });
    }
  }

  function scheduleBackendFormulaDefenseRefresh(pumpId) {
    root.clearTimeout(backendRefreshTimer);
    backendRefreshTimer = root.setTimeout(() => {
      refreshBackendForFormulaDefense(pumpId);
    }, 220);
  }

  async function directBackendFormulaDefenseRefresh(pumpId) {
    if (typeof root.fetch !== 'function' || typeof root.buildBackendSimulationPayload !== 'function') return false;
    const model = runtimeModel();
    const pump = model[pumpId];
    if (!pump || pump.type !== 'pump') return false;
    const payload = root.buildBackendSimulationPayload(pumpId, {
      backendMode: 'primary',
      primaryBackend: true,
      useBackendPrimary: true,
      protectedFrontend: true,
      model,
      connections: typeof connections !== 'undefined' ? connections : [],
      sourceLinks: typeof sourceLinks !== 'undefined' ? sourceLinks : [],
      instrumentLinks: typeof instrumentLinks !== 'undefined' ? instrumentLinks : []
    });
    payload.client = {
      ...(payload.client || {}),
      mode: 'primary',
      protectedFrontend: true,
      primaryCutoverRequested: true
    };
    const endpoint = typeof root.getBackendSimulationEndpoint === 'function'
      ? root.getBackendSimulationEndpoint()
      : '/api/simulate';
    const response = await root.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data?.results) return false;
    if (!pump.results || typeof pump.results !== 'object') pump.results = {};
    if (typeof root.applyBackendSimulationPrimaryResults === 'function') {
      root.applyBackendSimulationPrimaryResults(pump, data.results, { nodeResults: data.nodeResults || {} });
    } else {
      pump.results.npshEvaluation = data.results;
      pump.results.flow = data.results.flow;
      pump.results.head = data.results.pumpHead;
      pump.results.npsha = data.results.npsha;
      pump.results.npshr = data.results.npshr;
      pump.results.npshMargin = data.results.npshMargin;
    }
    pump.results.backendCalculationSource = 'backend-primary-direct-formula-defense';
    pump.results.backendValidationStatus = data.backendValidation?.status || 'Connected';
    pump.results.backendValidationMessage = data.backendValidation?.message || 'Private backend returned usable hydraulic/NPSH results for the current route.';
    pump.results.calculationFreshness = data.backendValidation?.freshness || 'Current';
    return true;
  }

  function copyRuntimePatchFlags(target, source) {
    [
      '__engineeringRealtimeCalculationDefenseUpdatePatched',
      '__engineeringRealtimeCalculationDefenseOriginal',
      '__analysisReportLivePatched',
      '__analysisReportLiveOriginal'
    ].forEach((key) => {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    });
  }

  function wrapFunction(name, after) {
    const original = root[name];
    if (typeof original !== 'function' || original.__pumpFormulaDefenseLiveAuditVersion === VERSION) return false;
    function wrapped(...args) {
      let result = null;
      try {
        result = original.apply(this, args);
      } catch (error) {
        console.warn(`${VERSION}: ${name} original refresh failed; live audit badges will still refresh.`, error);
      }
      const runAfter = () => root.setTimeout(() => after(...args), 0);
      if (result && typeof result.then === 'function') {
        result.finally(runAfter);
      } else {
        runAfter();
      }
      return result;
    }
    wrapped.__pumpFormulaDefenseLiveAuditPatched = true;
    wrapped.__pumpFormulaDefenseLiveAuditVersion = VERSION;
    wrapped.__pumpFormulaDefenseLiveAuditOriginal = original;
    copyRuntimePatchFlags(wrapped, original);
    root[name] = wrapped;
    return true;
  }

  function patchLocalBackendSkipGuard() {
    const original = root.shouldSkipBackendSimulationFetch;
    if (typeof original !== 'function' || original.__pumpFormulaDefenseLiveAuditVersion === VERSION) return false;
    function patched(endpoint, options = {}) {
      if (options && options.allowExternalApiOnLocal === true) return false;
      return original.apply(this, arguments);
    }
    patched.__pumpFormulaDefenseLiveAuditPatched = true;
    patched.__pumpFormulaDefenseLiveAuditVersion = VERSION;
    patched.__pumpFormulaDefenseLiveAuditOriginal = original;
    root.shouldSkipBackendSimulationFetch = patched;
    return true;
  }

  function ensureRuntimeGuards() {
    const changed = [
      patchLocalBackendSkipGuard(),
      wrapFunction('openPumpFormulaDefenseTaskWindow', (pumpId) => {
        scheduleOpenFormulaDefenseWindowRefresh(pumpId, { reason: 'open-window', rebuild: false, delayMs: 0 });
      }),
      wrapFunction('refreshPumpFormulaDefenseWindowContent', (pumpId) => {
        refreshPumpFormulaDefenseAudit(pumpId);
      }),
      wrapFunction('updateSimulation', (options = {}) => {
        const nodeId = options?.selectedNodeId || options?.nodeId || '';
        scheduleOpenFormulaDefenseWindowRefresh(nodeId, { reason: options?.refreshReason || options?.trigger || 'updateSimulation', delayMs: 0 });
      }),
      bindRealtimeEvents(),
      bindLiveInputRefresh()
    ].some(Boolean);
    if (changed) scheduleOpenFormulaDefenseWindowRefresh('', { reason: 'runtime-guards', rebuild: false, delayMs: 0 });
    return changed;
  }

  function startRuntimeGuardLoop() {
    ensureRuntimeGuards();
    if (!root.setTimeout) return;
    [0, 80, 220, 500, 900, 1400, 2200, 3600, 5200, 7600].forEach((delay) => {
      root.setTimeout(() => {
        ensureRuntimeGuards();
        scheduleOpenFormulaDefenseWindowRefresh('', { reason: 'guard-loop', rebuild: false, delayMs: 0 });
      }, delay);
    });
    if (typeof document !== 'undefined' && !runtimeGuardTimer && root.setInterval) {
      runtimeGuardTimer = root.setInterval(() => {
        ensureRuntimeGuards();
      }, 1600);
      root.__pumpFormulaDefenseLiveAuditGuardTimer = runtimeGuardTimer;
    }
  }

  root.EngineeringPumpFormulaDefenseLiveAudit = {
    version: VERSION,
    refresh: refreshPumpFormulaDefenseAudit,
    refreshOpenWindows: refreshOpenFormulaDefenseWindows,
    scheduleRefresh: scheduleOpenFormulaDefenseWindowRefresh,
    refreshBackend: refreshBackendForFormulaDefense,
    directRefresh: directBackendFormulaDefenseRefresh,
    ensureRuntimeGuards
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.EngineeringPumpFormulaDefenseLiveAudit;
  }

  startRuntimeGuardLoop();
})();
