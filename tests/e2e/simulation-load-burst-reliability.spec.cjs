const path = require('node:path');
const { test, expect } = require('@playwright/test');

test.setTimeout(360000);

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.updateSimulation === 'function'
    && window.EngineeringCalculationLifecycle?.version === 'engineering-calculation-lifecycle.v1'
    && window.EngineeringSimulationLoadTransaction?.version === 'engineering-simulation-load-transaction-manager.v7-export-lock-dedupe'
    && window.EngineeringSimulationLoadTransaction?.cacheKey === '20260716-canvas-object-smooth-drag1'
    && window.EngineeringCalculationLifecycle?.cacheKey === '20260711-solver-always-calculates1'
  ), null, { timeout: 30000 });
}

async function openSimulationCase(page, caseId) {
  await page.click('#menu-simulate');
  await page.waitForSelector(`#dropdown-simulate [data-simulation-case-id="${caseId}"]`, { timeout: 15000 });
  await page.evaluate((id) => {
    const root = document.querySelector(`#dropdown-simulate [data-simulation-case-id="${id}"]`);
    const openTarget = root?.querySelector?.('[data-simulation-case-action="open"]')
      || root?.querySelector?.('button, [role="menuitem"], .dropdown-submenu-trigger')
      || root;
    openTarget?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }, caseId);
  const dialog = page.getByRole('dialog', { name: /Simulation Cases/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Open Sample Case' }).click();
}

async function openExternalUntirta(page, filePath) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.click('#menu-file');
  await page.click('#menu-open');
  const chooser = await chooserPromise;
  await chooser.setFiles(filePath);
}

async function waitForReady(page, label = 'simulation') {
  try {
    await page.waitForFunction((contextLabel) => {
      const solve = document.getElementById('btn-solve');
      const solveLabel = solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '';
      const lifecycle = window.EngineeringCalculationLifecycle?.current?.();
      const transaction = window.EngineeringSimulationLoadTransaction?.current?.();
      const readiness = window.EngineeringOpenFileReadinessGate?.state?.();
      const model = window.__npshGlobalModel || window.globalModel || {};
      const hasPump = Object.values(model).some((node) => node?.type === 'pump');
      const canvas = document.getElementById('canvas');
      const hasCanvasObject = !!canvas?.querySelector?.('.pfd-object, .pump-live-params, .pipe-live-params, .sink-live-params');
      return {
        contextLabel,
        ready: solveLabel === 'Validate'
          && !!solve
          && !solve.disabled
          && solve.dataset.calculationBusy !== 'true'
          && solve.getAttribute('aria-busy') !== 'true'
          && lifecycle?.status !== 'calculating'
          && lifecycle?.status !== 'applying-results'
          && lifecycle?.status !== 'preparing'
          && lifecycle?.status !== 'refreshing-evidence'
          && transaction?.status !== 'active'
          && !readiness
          && hasPump
          && hasCanvasObject
      }.ready;
    }, label, { timeout: 30000 });
  } catch (error) {
    console.log('waitForReady timeout', label, await stateSnapshot(page));
    throw error;
  }
}

async function assertValidateClickable(page) {
  await expect(page.locator('#btn-solve')).toBeEnabled();
  await page.locator('#btn-solve').click();
  await waitForReady(page, 'after Validate click');
  return expectReadySnapshot(page, 'after Validate click');
}

async function stateSnapshot(page) {
  return page.evaluate(() => {
    const solve = document.getElementById('btn-solve');
    const model = window.__npshGlobalModel || window.globalModel || {};
    const canvas = document.getElementById('canvas');
    return {
      label: solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '',
      disabled: !!solve?.disabled,
      calculationBusy: solve?.dataset?.calculationBusy || '',
      ariaBusy: solve?.getAttribute('aria-busy') || '',
      lifecycle: window.EngineeringCalculationLifecycle?.current?.() || null,
      transaction: window.EngineeringSimulationLoadTransaction?.current?.() || null,
      readiness: window.EngineeringOpenFileReadinessGate?.state?.() || null,
      pumpCount: Object.values(model).filter((node) => node?.type === 'pump').length,
      pipeCount: Object.values(model).filter((node) => node?.type === 'pipe').length,
      objectCount: canvas?.querySelectorAll?.('.pfd-object')?.length || 0,
      pipeLabelCount: canvas?.querySelectorAll?.('.pipe-hydraulic-label')?.length || 0
    };
  });
}

async function expectReadySnapshot(page, label = 'simulation') {
  const state = await stateSnapshot(page);
  expect(state.label, `${label} Validate label`).toBe('Validate');
  expect(state.disabled, `${label} Validate disabled`).toBe(false);
  expect(state.calculationBusy, `${label} calculationBusy`).toBe('false');
  expect(state.ariaBusy, `${label} ariaBusy`).toBe('false');
  expect(state.lifecycle?.status, `${label} lifecycle`).toBe('current');
  expect(state.transaction?.status, `${label} transaction`).not.toBe('active');
  expect(state.readiness, `${label} open-file readiness`).toBe(null);
  expect(state.pumpCount, `${label} pump count`).toBeGreaterThan(0);
  expect(state.objectCount, `${label} canvas object count`).toBeGreaterThan(0);
  return state;
}

test('repeated case and external file loads keep Validate responsive', async ({ page }) => {
  await waitForNpshApp(page);
  await page.evaluate(() => {
    window.__loadBurstEventCounts = {};
    [
      'npsh:calculation-transaction',
      'npsh:calculation-stale',
      'npsh:calculation-calculating',
      'npsh:calculation-applying-results',
      'npsh:calculation-current',
      'npsh:linked-views-refreshed',
      'npsh:realtime-autosolve-scheduled',
      'npsh:realtime-autosolve-start',
      'npsh:realtime-autosolve-complete',
      'npsh:simulation-updated'
    ].forEach((eventName) => {
      document.addEventListener(eventName, () => {
        window.__loadBurstEventCounts[eventName] = (window.__loadBurstEventCounts[eventName] || 0) + 1;
      });
    });
    window.__loadBurstVisualCallCounts = {};
    [
      'refreshPipeCanvasHydraulicLabels',
      'updateCanvasWarningPanel',
      'refreshBackendProtectedSimulationUi',
      'refreshBackendProtectedRealtimeTaskWindows',
      'refreshBackendProtectedSelectedObjectTaskWindow',
      'refreshBackendProtectedPumpChart'
    ].forEach((name) => {
      const original = window[name];
      if (typeof original !== 'function') return;
      const counter = function loadBurstVisualCounter(...args) {
        window.__loadBurstVisualCallCounts[name] = (window.__loadBurstVisualCallCounts[name] || 0) + 1;
        return original.apply(this, args);
      };
      counter.__loadBurstVisualCounterOriginal = original;
      window[name] = counter;
    });
  });
  const externalFile = path.join(process.cwd(), 'journals', 'simulasi_6', 'Evaluasi_Pompa_Sentrifugal_P-2941A_sebagai_Pompa_Air_Panas.untirta');

  const sequence = [
    ['case', 'simulation-case-1'],
    ['case', 'simulation-case-4'],
    ['case', 'simulation-case-6'],
    ['external', externalFile],
    ['case', 'simulation-case-1'],
    ['case', 'simulation-case-4'],
    ['case', 'simulation-case-6']
  ];

  const timings = [];
  for (const [kind, target] of sequence) {
    const loadStartedAt = Date.now();
    if (kind === 'case') await openSimulationCase(page, target);
    else await openExternalUntirta(page, target);
    await waitForReady(page, target);
    await expectReadySnapshot(page, target);
    const loadDurationMs = Date.now() - loadStartedAt;
    const validateStartedAt = Date.now();
    await assertValidateClickable(page);
    const validateDurationMs = Date.now() - validateStartedAt;
    timings.push({ kind, target, loadDurationMs, validateDurationMs });
  }

  const runtimeMetrics = await page.evaluate(() => {
    const visual = window.EngineeringSimulationLoadTransaction?.visualRefreshSummary?.() || {};
    const scriptSources = Array.from(document.scripts).map((script) => script.src).filter(Boolean);
    const scriptPathCounts = scriptSources.reduce((counts, src) => {
      let pathname = src;
      try {
        pathname = new URL(src, document.baseURI).pathname;
      } catch (error) {
        pathname = String(src).split(/[?#]/)[0];
      }
      counts[pathname] = (counts[pathname] || 0) + 1;
      return counts;
    }, {});
    const countWrapperOwners = (start) => {
      const seen = new Set();
      const counts = { warningCleanup: 0, loadTransaction: 0 };
      let current = start;
      while (typeof current === 'function' && !seen.has(current)) {
        seen.add(current);
        if (current.__pumpEnvelopeWarningCleanupPatched) counts.warningCleanup += 1;
        if (current.__simulationLoadVisualRefreshPatched) counts.loadTransaction += 1;
        current = current.__loadBurstVisualCounterOriginal
          || current.__pumpEnvelopeWarningCleanupOriginal
          || current.__simulationLoadVisualRefreshOriginal;
      }
      return counts;
    };
    return {
      bodyDomNodes: document.body?.querySelectorAll?.('*')?.length || 0,
      scripts: document.scripts?.length || 0,
      duplicateScriptPathnames: Object.entries(scriptPathCounts).filter(([, count]) => count > 1),
      taskWindows: document.querySelectorAll('.task-window, .persistent-object-properties-task-window').length,
      visualQueueSize: visual.queueSize || 0,
      lifecycleSequence: window.EngineeringCalculationLifecycle?.current?.()?.sequence || 0,
      eventCounts: { ...(window.__loadBurstEventCounts || {}) },
      visualCallCounts: { ...(window.__loadBurstVisualCallCounts || {}) },
      warningWrapperOwners: countWrapperOwners(window.updateCanvasWarningPanel)
    };
  });

  expect(Math.max(...timings.map((entry) => entry.loadDurationMs))).toBeLessThan(20000);
  expect(Math.max(...timings.map((entry) => entry.validateDurationMs))).toBeLessThan(10000);
  expect(runtimeMetrics.bodyDomNodes).toBeLessThan(1000);
  expect(runtimeMetrics.scripts).toBe(61);
  expect(runtimeMetrics.duplicateScriptPathnames).toEqual([]);
  expect(runtimeMetrics.taskWindows).toBeLessThanOrEqual(1);
  expect(runtimeMetrics.visualQueueSize).toBe(0);
  expect(runtimeMetrics.lifecycleSequence).toBeLessThan(180);
  expect(runtimeMetrics.eventCounts['npsh:calculation-applying-results'] || 0).toBeLessThan(40);
  expect(runtimeMetrics.eventCounts['npsh:linked-views-refreshed'] || 0).toBeLessThan(40);
  expect(runtimeMetrics.visualCallCounts.updateCanvasWarningPanel || 0).toBeLessThan(120);
  expect(runtimeMetrics.warningWrapperOwners).toEqual({ warningCleanup: 1, loadTransaction: 1 });

  const finalState = await stateSnapshot(page);
  expect(finalState.label).toBe('Validate');
  expect(finalState.disabled).toBe(false);
  expect(finalState.calculationBusy).toBe('false');
  expect(finalState.ariaBusy).toBe('false');
  expect(finalState.lifecycle.status).toBe('current');
  expect(finalState.transaction.status).not.toBe('active');
  expect(finalState.readiness).toBe(null);
  expect(finalState.pumpCount).toBeGreaterThan(0);
  expect(finalState.objectCount).toBeGreaterThan(0);
});

test('rapid simulation case switching does not leave stale Calculating state', async ({ page }) => {
  await waitForNpshApp(page);
  const pageErrors = [];
  const consoleErrors = [];
  const routinePerfLogs = [];
  page.on('pageerror', (error) => pageErrors.push(`${error?.name || 'Error'}: ${error?.message || String(error)}`));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') consoleErrors.push(text);
    if (/^\[PERF\]\s+(calculation-complete|update-simulation|simulation-load-abort)\b/.test(text)) routinePerfLogs.push(text);
  });

  for (const caseId of ['simulation-case-1', 'simulation-case-4', 'simulation-case-6']) {
    await openSimulationCase(page, caseId);
    await page.waitForTimeout(250);
  }

  await waitForReady(page, 'rapid case burst');
  await page.waitForTimeout(1200);
  await expectReadySnapshot(page, 'rapid case burst');
  const finalState = await assertValidateClickable(page);
  expect(finalState.lifecycle.status).toBe('current');
  expect(finalState.transaction.status).not.toBe('active');
  expect(finalState.disabled).toBe(false);
  expect(finalState.calculationBusy).toBe('false');
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter((text) => /AbortError|openSimulationCaseSample|stale/i.test(text))).toEqual([]);
  expect(routinePerfLogs).toEqual([]);
});

test('external file readiness releases from the completed canonical load transaction', async ({ page }) => {
  await waitForNpshApp(page);
  const externalFile = path.join(process.cwd(), 'journals', 'simulasi_6', 'Evaluasi_Pompa_Sentrifugal_P-2941A_sebagai_Pompa_Air_Panas.untirta');

  await openSimulationCase(page, 'simulation-case-6');
  await waitForReady(page, 'case before external file');
  await openExternalUntirta(page, externalFile);
  await waitForReady(page, 'external file canonical transaction release');

  const finalState = await expectReadySnapshot(page, 'external file canonical transaction release');
  expect(finalState.transaction?.status).toBe('completed');
  expect(finalState.readiness).toBe(null);
});

test('external file load restores the File Export submenu and keeps one readiness runtime', async ({ page }) => {
  await waitForNpshApp(page);
  const externalFile = path.join(process.cwd(), 'journals', 'simulasi_6', 'Evaluasi_Pompa_Sentrifugal_P-2941A_sebagai_Pompa_Air_Panas.untirta');

  await openExternalUntirta(page, externalFile);
  await waitForReady(page, 'external file export unlock');
  await expectReadySnapshot(page, 'external file export unlock');

  const runtimeScriptState = await page.evaluate(() => {
    const sources = Array.from(document.scripts).map((script) => script.src).filter(Boolean);
    const pathCounts = sources.reduce((counts, src) => {
      const pathname = new URL(src, document.baseURI).pathname;
      counts[pathname] = (counts[pathname] || 0) + 1;
      return counts;
    }, {});
    return {
      readinessSources: sources.filter((src) => new URL(src, document.baseURI).pathname.endsWith('/engineering-open-file-readiness-gate.js')),
      duplicatePathnames: Object.entries(pathCounts).filter(([, count]) => count > 1)
    };
  });
  expect(runtimeScriptState.readinessSources).toHaveLength(1);
  expect(runtimeScriptState.duplicatePathnames).toEqual([]);

  await page.locator('#menu-file').click();
  const exportTrigger = page.locator('#menu-file-export');
  const excelExport = page.locator('#menu-export-excel-trace');
  const pdfExport = page.locator('#menu-export-appendix-pdf');
  await expect(exportTrigger).toBeEnabled();
  await expect(excelExport).toBeEnabled();
  await expect(pdfExport).toBeEnabled();
  await expect(exportTrigger).not.toHaveAttribute('aria-disabled', 'true');

  await exportTrigger.click();
  await expect(exportTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#dropdown-file-export')).toBeVisible();
});

test('repeated Validate timing remains bounded on one loaded case', async ({ page }) => {
  await waitForNpshApp(page);
  await openSimulationCase(page, 'simulation-case-6');
  await waitForReady(page, 'case before repeated Validate timing');

  const timings = [];
  for (let iteration = 1; iteration <= 3; iteration += 1) {
    const startedAt = Date.now();
    const state = await assertValidateClickable(page);
    timings.push({
      iteration,
      durationMs: Date.now() - startedAt,
      lifecycle: state.lifecycle?.status || '',
      transaction: state.transaction?.status || '',
      readiness: state.readiness?.phase || state.readiness?.status || ''
    });
  }

  console.log('repeated Validate timings', timings);
  expect(timings.every((entry) => entry.durationMs < 30000)).toBe(true);
});

test('session token guard rejects stale async and FileReader results', async ({ page }) => {
  await waitForNpshApp(page);

  const guardState = await page.evaluate(async () => {
    const api = window.EngineeringSimulationLoadTransaction;
    const staleEvents = [];
    document.addEventListener('npsh:simulation-load-transaction-stale-result', (event) => {
      staleEvents.push({
        label: event.detail?.label || '',
        sessionId: event.detail?.sessionId || '',
        currentSessionId: event.detail?.currentSessionId || ''
      });
    });

    const first = api.beginTransaction('e2e-stale-async-first', { caseId: 'simulation-case-1' });
    let firstSignalAborted = false;
    const firstSignal = api.signal(first.sessionId);
    firstSignal?.addEventListener?.('abort', () => {
      firstSignalAborted = true;
    }, { once: true });
    let staleTimeoutRan = false;
    api.setSessionTimeout(() => {
      staleTimeoutRan = true;
    }, 120, 'e2e-stale-timeout', first.sessionId);
    const pending = api.guardAsyncResult(
      first.sessionId,
      'e2e-stale-async-result',
      new Promise((resolve) => window.setTimeout(() => resolve('old-result'), 80))
    );
    const second = api.beginTransaction('e2e-stale-async-second', { caseId: 'simulation-case-6' });

    let asyncRejected = false;
    try {
      await pending;
    } catch (error) {
      asyncRejected = error?.name === 'AbortError';
    }

    const fileSession = api.beginTransaction('e2e-stale-file-first', { fileName: 'old.untirta' });
    const file = new File([JSON.stringify({ stale: true })], 'old.untirta', { type: 'application/json' });
    api.bindFileToSession(file, fileSession.sessionId);
    const reader = new FileReader();
    let staleFileLoadReachedApp = false;
    reader.addEventListener('load', () => {
      staleFileLoadReachedApp = true;
    });
    reader.readAsText(file);
    const finalSession = api.beginTransaction('e2e-stale-file-second', { caseId: 'simulation-case-4' });
    await new Promise((resolve) => window.setTimeout(resolve, 160));
    api.abortPrevious('e2e-stale-guard-test-complete');

    return {
      asyncRejected,
      firstSignalAborted: firstSignalAborted || !!firstSignal?.aborted,
      staleTimeoutRan,
      staleFileLoadReachedApp,
      secondCurrentBeforeFile: second.status === 'active' || api.isCurrent(second.sessionId) === false,
      finalSessionId: finalSession.sessionId,
      staleEventLabels: staleEvents.map((event) => event.label),
      staleEventCount: staleEvents.length
    };
  });

  expect(guardState.asyncRejected).toBe(true);
  expect(guardState.firstSignalAborted).toBe(true);
  expect(guardState.staleTimeoutRan).toBe(false);
  expect(guardState.staleFileLoadReachedApp).toBe(false);
  expect(guardState.staleEventCount).toBeGreaterThanOrEqual(2);
  expect(guardState.staleEventLabels.some((label) => label.includes('e2e-stale-async-result'))).toBe(true);
  expect(guardState.staleEventLabels.some((label) => label.includes('FileReader.'))).toBe(true);
});

test('workspace cleanup removes stale task windows and visual artifacts before a new load', async ({ page }) => {
  await waitForNpshApp(page);

  const cleanupState = await page.evaluate(async () => {
    const api = window.EngineeringSimulationLoadTransaction;
    const before = api.cleanupSummary();

    const primary = document.getElementById('taskWindow');
    const primaryBody = document.getElementById('taskWindowBody') || primary?.querySelector?.('.task-window-body');
    if (primary) {
      primary.hidden = false;
      primary.dataset.kind = 'pipe';
      primary.dataset.nodeId = 'PIPE-OLD';
    }
    if (primaryBody) {
      primaryBody.replaceChildren();
      const stale = document.createElement('div');
      stale.textContent = 'stale pipe task body';
      primaryBody.appendChild(stale);
    }

    const staleTask = document.createElement('section');
    staleTask.id = 'staleSecondaryTaskWindow';
    staleTask.className = 'task-window pipe-formula-defense-task-window';
    staleTask.innerHTML = '<div class="task-window-body">stale formula defense</div>';
    document.body.appendChild(staleTask);

    const routePanel = document.createElement('section');
    routePanel.id = 'engineeringRouteTraceAuditPanel';
    routePanel.className = 'task-window route-trace-audit-panel';
    routePanel.innerHTML = '<div class="task-window-body">stale route audit</div>';
    document.body.appendChild(routePanel);

    const dock = document.getElementById('objectTaskMinimizedDock') || document.createElement('section');
    dock.id = 'objectTaskMinimizedDock';
    dock.innerHTML = '<button type="button">PIPE-OLD</button>';
    if (!dock.parentNode) document.body.appendChild(dock);

    const warningPanel = document.getElementById('canvasWarningPanel');
    const warningList = document.getElementById('canvasWarningList');
    const warningCount = document.getElementById('canvasWarningCount');
    if (warningPanel) {
      warningPanel.hidden = false;
      warningPanel.classList.add('has-warnings');
    }
    if (warningList) warningList.innerHTML = '<div class="canvas-warning-item">stale warning</div>';
    if (warningCount) warningCount.textContent = '1';

    const cleanupEvents = [];
    document.addEventListener('npsh:simulation-load-workspace-cleanup', (event) => {
      cleanupEvents.push(event.detail || {});
    });

    const session = api.beginTransaction('e2e-workspace-cleanup', { caseId: 'simulation-case-6' });
    await new Promise((resolve) => window.setTimeout(resolve, 60));
    api.abortPrevious('e2e-workspace-cleanup-complete');
    const after = api.cleanupSummary();

    return {
      sessionId: session.sessionId,
      sequenceIncreased: after.sequence > before.sequence,
      taskWindowsClosed: after.taskWindowsClosed - before.taskWindowsClosed,
      artifactsRemoved: after.artifactsRemoved - before.artifactsRemoved,
      displayCleanupRuns: after.displayCleanupRuns - before.displayCleanupRuns,
      cleanupEvents: cleanupEvents.length,
      primaryHidden: !!primary?.hidden,
      primaryBodyChildren: document.getElementById('taskWindow')?.querySelector?.('.task-window-body')?.children?.length || 0,
      primaryBodyText: document.getElementById('taskWindow')?.querySelector?.('.task-window-body')?.textContent || '',
      staleTaskExists: !!document.getElementById('staleSecondaryTaskWindow'),
      routePanelExists: !!document.getElementById('engineeringRouteTraceAuditPanel'),
      dockChildren: document.getElementById('objectTaskMinimizedDock')?.children?.length || 0,
      dockHidden: !!document.getElementById('objectTaskMinimizedDock')?.hidden,
      warningHidden: !!warningPanel?.hidden,
      warningHasWarnings: !!warningPanel?.classList.contains('has-warnings'),
      warningCount: warningCount?.textContent || '',
      warningText: warningList?.textContent || ''
    };
  });

  expect(cleanupState.sequenceIncreased).toBe(true);
  expect(cleanupState.taskWindowsClosed).toBeGreaterThanOrEqual(2);
  expect(cleanupState.displayCleanupRuns).toBeGreaterThanOrEqual(1);
  expect(cleanupState.cleanupEvents).toBeGreaterThanOrEqual(1);
  expect(cleanupState.primaryHidden).toBe(true);
  expect(cleanupState.primaryBodyText).not.toContain('stale pipe task body');
  expect(cleanupState.staleTaskExists).toBe(false);
  expect(cleanupState.routePanelExists).toBe(false);
  expect(cleanupState.dockChildren).toBe(0);
  expect(cleanupState.dockHidden).toBe(true);
  expect(cleanupState.warningHidden).toBe(true);
  expect(cleanupState.warningHasWarnings).toBe(false);
  expect(cleanupState.warningCount).toBe('0');
  expect(cleanupState.warningText).toContain('No active warnings');
});

test('visual refresh calls are deferred during simulation load and flushed once after completion', async ({ page }) => {
  await waitForNpshApp(page);

  const refreshState = await page.evaluate(async () => {
    const api = window.EngineeringSimulationLoadTransaction;
    const calls = [];
    window.refreshBackendProtectedSimulationUi = (...args) => {
      calls.push(args);
      return 42;
    };
    api.patchVisualRefreshFunctions();
    const before = api.visualRefreshSummary();
    const session = api.beginTransaction('e2e-visual-refresh-governor', { caseId: 'simulation-case-6' });
    const firstReturn = window.refreshBackendProtectedSimulationUi('old-pass-1');
    const secondReturn = window.refreshBackendProtectedSimulationUi('old-pass-2');
    const during = api.visualRefreshSummary();
    api.complete(session.sessionId, { reason: 'e2e-visual-refresh-complete' });
    api.flushVisualRefreshQueue('e2e-visual-refresh-flush');
    const after = api.visualRefreshSummary();
    delete window.refreshBackendProtectedSimulationUi;
    return {
      firstReturn,
      secondReturn,
      calls,
      before,
      during,
      after
    };
  });

  expect(refreshState.firstReturn).toBe(0);
  expect(refreshState.secondReturn).toBe(0);
  expect(refreshState.calls).toHaveLength(1);
  expect(refreshState.calls[0]).toEqual(['old-pass-2']);
  expect(refreshState.during.queueSize).toBeGreaterThanOrEqual(1);
  expect(refreshState.after.queueSize).toBe(0);
  expect(refreshState.after.stats.deferred).toBeGreaterThan(refreshState.before.stats.deferred);
  expect(refreshState.after.stats.flushed).toBeGreaterThan(refreshState.before.stats.flushed);
});

test('settle watchdog releases stale Calculating UI after a settled load', async ({ page }) => {
  await waitForNpshApp(page);

  const watchdogState = await page.evaluate(async () => {
    const api = window.EngineeringSimulationLoadTransaction;
    const events = [];
    document.addEventListener('npsh:simulation-load-settle-watchdog', (event) => {
      events.push(event.detail || {});
    });

    const session = api.beginTransaction('e2e-settle-watchdog', { caseId: 'simulation-case-6' });
    api.complete(session.sessionId, { reason: 'e2e-settle-watchdog-complete' });

    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label');
    if (solve) {
      solve.disabled = true;
      solve.dataset.calculationBusy = 'true';
      solve.setAttribute('aria-busy', 'true');
      solve.setAttribute('aria-disabled', 'true');
      if (label) label.textContent = 'Calculating...';
    }
    document.body.classList.add('npsh-simulation-load-transaction-active');

    const before = api.settleWatchdogSummary();
    const audit = api.auditSettledUi('e2e-settle-watchdog-audit');
    const after = api.settleWatchdogSummary();
    return {
      audit,
      events: events.length,
      before,
      after,
      label: label?.textContent?.trim() || '',
      disabled: !!solve?.disabled,
      calculationBusy: solve?.dataset?.calculationBusy || '',
      ariaBusy: solve?.getAttribute('aria-busy') || '',
      ariaDisabled: solve?.getAttribute('aria-disabled') || '',
      activeClass: document.body.classList.contains('npsh-simulation-load-transaction-active')
    };
  });

  expect(watchdogState.audit.actions).toContain('release-run-command');
  expect(watchdogState.audit.actions).toContain('clear-simulation-load-active-class');
  expect(watchdogState.events).toBeGreaterThanOrEqual(1);
  expect(watchdogState.after.audits).toBeGreaterThan(watchdogState.before.audits);
  expect(watchdogState.after.releases).toBeGreaterThan(watchdogState.before.releases);
  expect(watchdogState.disabled).toBe(false);
  expect(watchdogState.calculationBusy).toBe('false');
  expect(watchdogState.ariaBusy).toBe('false');
  expect(watchdogState.ariaDisabled).toBe('false');
  expect(watchdogState.activeClass).toBe(false);
  expect(watchdogState.label).toBe('Validate');
});
