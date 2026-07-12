const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.renderSidebar === 'function'
    && typeof window.updateSimulation === 'function'
    && window.EngineeringSinkInputStabilityRuntime?.version === 'engineering-sink-input-stability-runtime.v14-solver-flash-lock'
    && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v18-src-task-window-flash-lock'
    && window.__npshRouteTraceAuditInstalled
  ), null, { timeout: 30000 });
}

async function openSimulationCase(page, caseId) {
  await page.click('#menu-simulate');
  await page.waitForSelector(`#dropdown-simulate [data-simulation-case-id="${caseId}"]`, { timeout: 15000 });
  await page.evaluate((id) => {
    const root = document.querySelector(`#dropdown-simulate [data-simulation-case-id="${id}"]`);
    const target = root?.querySelector?.('[data-simulation-case-action="open"]')
      || root?.querySelector?.('button, [role="menuitem"], .dropdown-submenu-trigger')
      || root;
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }, caseId);
  const dialog = page.getByRole('dialog', { name: /Simulation Cases/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Open Sample Case' }).click();
  await page.waitForFunction(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return Object.values(model).some((node) => node?.type === 'sink');
  }, null, { timeout: 30000 });
  await page.waitForFunction(() => {
    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label')?.textContent?.trim();
    const lifecycle = window.EngineeringCalculationLifecycle?.current?.();
    const transaction = window.EngineeringSimulationLoadTransaction?.current?.();
    return label === 'Validate'
      && !solve?.disabled
      && lifecycle?.status === 'current'
      && transaction?.status !== 'active';
  }, null, { timeout: 30000 });
}

test('actual SNK numeric inputs remain stable and create one realtime transaction per committed value', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await waitForNpshApp(page);
  await openSimulationCase(page, 'simulation-case-6');
  const sinkId = await page.evaluate(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const id = Object.keys(model).find((nodeId) => model[nodeId]?.type === 'sink');
    window.currentSelectedNode = id;
    window.__npshExplicitObjectPropertiesOpenUntil = Date.now() + 20000;
    window.requestObjectPropertiesTaskWindowOpen?.(id);
    window.openObjectPropertiesTaskWindow?.(id);
    const taskWindow = document.querySelector(`.persistent-object-properties-task-window[data-node-id="${id}"]`)
      || document.querySelector('.persistent-object-properties-task-window[data-kind="object"]');
    if (taskWindow) window.renderSidebar?.(id, { taskWindow, skipDismissedGuard: true });
    window.EngineeringRouteTraceAudit?.refreshVisibleAuditSurfaces?.();
    return id;
  });
  const windowSelector = `.persistent-object-properties-task-window[data-node-id="${sinkId}"]`;
  for (const key of ['demandFlow', 'pressure', 'elevation']) {
    await page.waitForSelector(`${windowSelector} input[data-key="${key}"]`, { state: 'visible', timeout: 10000 });
  }
  await page.waitForTimeout(1200);

  const baseline = await page.evaluate(({ windowSelector }) => {
    const task = document.querySelector(windowSelector);
    window.__sinkStableTaskNodes = {
      task,
      body: task?.querySelector('.task-window-body, [data-task-prop-body="true"], #taskWindowBody'),
      demandFlow: task?.querySelector('input[data-key="demandFlow"]'),
      pressure: task?.querySelector('input[data-key="pressure"]'),
      elevation: task?.querySelector('input[data-key="elevation"]')
    };
    const captureRibbon = () => {
      const panel = document.querySelector('.sink-live-params');
      if (!panel) return;
      const labels = Array.from(panel.querySelectorAll('.sink-live-param-row'))
        .map((row) => row.querySelector('.sink-live-param-label')?.textContent?.trim())
        .filter(Boolean);
      const height = panel.getBoundingClientRect?.().height || 0;
      window.__sinkRibbonTemplateSamples.push({ labels, height });
    };
    window.__sinkRibbonTemplateSamples = [];
    window.__sinkTaskLayoutSamples = [];
    window.clearInterval(window.__sinkRibbonTemplateTimer);
    window.__sinkRibbonTemplateTimer = window.setInterval(captureRibbon, 100);
    const captureTaskLayout = () => {
      const currentTask = document.querySelector(windowSelector);
      const currentBody = currentTask?.querySelector('.task-window-body, [data-task-prop-body="true"], #taskWindowBody');
      const currentInputs = {
        demandFlow: currentTask?.querySelector('input[data-key="demandFlow"]'),
        pressure: currentTask?.querySelector('input[data-key="pressure"]'),
        elevation: currentTask?.querySelector('input[data-key="elevation"]')
      };
      const taskRect = currentTask?.getBoundingClientRect?.();
      const flowRect = currentInputs.demandFlow?.closest('tr, .object-task-field-row')?.getBoundingClientRect?.();
      window.__sinkTaskLayoutSamples.push({
        nodesStable: currentTask === window.__sinkStableTaskNodes.task
          && currentBody === window.__sinkStableTaskNodes.body
          && currentInputs.demandFlow === window.__sinkStableTaskNodes.demandFlow
          && currentInputs.pressure === window.__sinkStableTaskNodes.pressure
          && currentInputs.elevation === window.__sinkStableTaskNodes.elevation,
        taskWidth: taskRect?.width || 0,
        taskHeight: taskRect?.height || 0,
        flowRowWidth: flowRect?.width || 0,
        flowRowHeight: flowRect?.height || 0
      });
    };
    window.clearInterval(window.__sinkTaskLayoutTimer);
    window.__sinkTaskLayoutTimer = window.setInterval(captureTaskLayout, 50);
    captureRibbon();
    captureTaskLayout();
    return Number(window.__engineeringCalculationDefenseRealtimeState?.sequence || 0);
  }, { windowSelector });

  const flowInput = page.locator(`${windowSelector} input[data-key="demandFlow"]`);
  await flowInput.click();
  await flowInput.press('Control+A');
  const previewSnapshots = [];
  for (const character of '30') {
    await flowInput.type(character);
    const currentValue = await flowInput.inputValue();
    previewSnapshots.push(await page.evaluate(({ sinkId: id, expected }) => {
      const model = window.__npshGlobalModel || window.globalModel || {};
      return {
        expected,
        prop: model[id]?.props?.demandFlow,
        inputPreview: window.EngineeringSinkInputStabilityRuntime?.previewForNode?.(model[id])?.demandFlow
      };
    }, { sinkId, expected: currentValue }));
  }
  previewSnapshots.forEach((snapshot) => {
    const expected = Number(snapshot.expected);
    expect(Number(snapshot.prop)).toBeCloseTo(expected, 9);
    expect(Number(snapshot.inputPreview)).toBeCloseTo(expected, 9);
  });
  await expect(flowInput).toHaveValue('30');
  await flowInput.press('Tab');
  await page.waitForFunction(({ sinkId: id }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return window.__engineeringCalculationDefenseRealtimeState?.status === 'Current'
      && Math.abs(Number(model[id]?.props?.demandFlow) - 30) < 1e-9
      && Math.abs(Number(model[id]?.results?.flow) - 30) < 1e-9;
  }, { sinkId }, { timeout: 30000 });
  const afterFlowSequence = await page.evaluate(() => Number(window.__engineeringCalculationDefenseRealtimeState?.sequence || 0));
  expect(afterFlowSequence - baseline).toBe(1);
  await expect(page.locator('.sink-live-param-row').filter({ hasText: /^Sink Flow/ }).first()).toContainText('30.000');

  const elevationInput = page.locator(`${windowSelector} input[data-key="elevation"]`);
  await elevationInput.click();
  await elevationInput.press('Control+A');
  await elevationInput.pressSequentially('10');
  await expect(elevationInput).toHaveValue('10');
  await elevationInput.press('Tab');
  await page.waitForFunction(({ sinkId: id }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return window.__engineeringCalculationDefenseRealtimeState?.status === 'Current'
      && Math.abs(Number(model[id]?.props?.elevation) - 10) < 1e-9
      && Math.abs(Number(model[id]?.results?.calculationTrace?.boundary?.elevation) - 10) < 1e-9;
  }, { sinkId }, { timeout: 30000 });

  const pressureInput = page.locator(`${windowSelector} input[data-key="pressure"]`);
  await pressureInput.click();
  await pressureInput.press('Control+A');
  await pressureInput.pressSequentially('10');
  await expect(pressureInput).toHaveValue('10');
  await pressureInput.press('Tab');
  await page.waitForFunction(({ sinkId: id }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return window.__engineeringCalculationDefenseRealtimeState?.status === 'Current'
      && Math.abs(Number(model[id]?.props?.pressure) - 10) < 1e-9
      && Math.abs(Number(model[id]?.results?.boundaryPressureInput) - 10) < 0.001;
  }, { sinkId }, { timeout: 30000 });
  await expect(page.locator(`${windowSelector} [data-prop-key="source-absolute-pressure"], ${windowSelector} .object-task-field-row`).filter({ hasText: /Calculated Abs\. Pressure/ }).first()).toContainText('11.013');
  const sequenceAfterInputs = await page.evaluate(() => Number(window.__engineeringCalculationDefenseRealtimeState?.sequence || 0));
  expect(sequenceAfterInputs - baseline).toBe(3);

  await page.evaluate(({ windowSelector }) => {
    const task = document.querySelector(windowSelector);
    const body = task?.querySelector('.task-window-body, [data-task-prop-body="true"], #taskWindowBody');
    const inputs = {
      demandFlow: task?.querySelector('input[data-key="demandFlow"]'),
      pressure: task?.querySelector('input[data-key="pressure"]'),
      elevation: task?.querySelector('input[data-key="elevation"]')
    };
    const samples = [];
    const structuralMutations = [];
    const sample = () => {
      const currentTask = document.querySelector(windowSelector);
      const currentBody = currentTask?.querySelector('.task-window-body, [data-task-prop-body="true"], #taskWindowBody');
      const rect = currentTask?.getBoundingClientRect?.();
      samples.push({
        taskStable: currentTask === task,
        bodyStable: currentBody === body,
        inputsStable: inputs.demandFlow === currentTask?.querySelector('input[data-key="demandFlow"]')
          && inputs.pressure === currentTask?.querySelector('input[data-key="pressure"]')
          && inputs.elevation === currentTask?.querySelector('input[data-key="elevation"]'),
        values: {
          demandFlow: currentTask?.querySelector('input[data-key="demandFlow"]')?.value,
          pressure: currentTask?.querySelector('input[data-key="pressure"]')?.value,
          elevation: currentTask?.querySelector('input[data-key="elevation"]')?.value
        },
        width: rect?.width || 0,
        height: rect?.height || 0
      });
    };
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const changedElements = [...mutation.addedNodes, ...mutation.removedNodes]
          .filter((node) => node?.nodeType === 1);
        if (changedElements.some((node) => (
          node.matches?.('tr, .object-task-field-row, .pipe-task-field-row')
          || node.querySelector?.('input[data-key="demandFlow"], input[data-key="pressure"], input[data-key="elevation"]')
        ))) structuralMutations.push(mutation.type);
      });
    });
    observer.observe(task, { childList: true, subtree: true });
    sample();
    window.__sinkSolverLayoutAudit = {
      samples,
      structuralMutations,
      observer,
      timer: window.setInterval(sample, 40),
      previousLockId: Number(window.__engineeringSinkSolverTaskLockState?.id || 0)
    };
  }, { windowSelector });

  await page.locator('#btn-solve').click();
  await page.waitForFunction(() => (
    Number(window.__engineeringSinkSolverTaskLockState?.id || 0)
      > Number(window.__sinkSolverLayoutAudit?.previousLockId || 0)
  ), null, { timeout: 10000 });
  await page.waitForTimeout(120);
  await page.waitForFunction(() => {
    const solve = document.getElementById('btn-solve');
    return solve?.querySelector?.('.ribbon-label')?.textContent?.trim() === 'Validate'
      && !solve?.disabled
      && window.EngineeringCalculationLifecycle?.current?.().status === 'current'
      && window.__engineeringSinkSolverTaskLockState?.status === 'current';
  }, null, { timeout: 30000 });
  await page.waitForTimeout(1800);

  const solverLayoutAudit = await page.evaluate(() => {
    const audit = window.__sinkSolverLayoutAudit;
    window.clearInterval(audit?.timer);
    audit?.observer?.disconnect?.();
    return {
      samples: audit?.samples || [],
      structuralMutations: audit?.structuralMutations || []
    };
  });
  expect(solverLayoutAudit.samples.length).toBeGreaterThan(5);
  solverLayoutAudit.samples.forEach((sample) => {
    expect(sample.taskStable).toBe(true);
    expect(sample.bodyStable).toBe(true);
    expect(sample.inputsStable).toBe(true);
    expect(sample.values).toEqual({ demandFlow: '30', pressure: '10', elevation: '10' });
  });
  expect(solverLayoutAudit.structuralMutations).toEqual([]);
  const solverWidths = solverLayoutAudit.samples.map((sample) => sample.width).filter((value) => value > 0);
  const solverHeights = solverLayoutAudit.samples.map((sample) => sample.height).filter((value) => value > 0);
  expect(Math.max(...solverWidths) - Math.min(...solverWidths)).toBeLessThan(1);
  expect(Math.max(...solverHeights) - Math.min(...solverHeights)).toBeLessThan(1);

  const state = await page.evaluate(({ windowSelector, sinkId: id }) => {
    const task = document.querySelector(windowSelector);
    const model = window.__npshGlobalModel || window.globalModel || {};
    const retained = window.__sinkStableTaskNodes || {};
    window.clearInterval(window.__sinkRibbonTemplateTimer);
    window.clearInterval(window.__sinkTaskLayoutTimer);
    return {
      nodesStable: retained.task === task
        && retained.body === task?.querySelector('.task-window-body, [data-task-prop-body="true"], #taskWindowBody')
        && retained.demandFlow === task?.querySelector('input[data-key="demandFlow"]')
        && retained.pressure === task?.querySelector('input[data-key="pressure"]')
        && retained.elevation === task?.querySelector('input[data-key="elevation"]'),
      values: {
        demandFlow: task?.querySelector('input[data-key="demandFlow"]')?.value,
        pressure: task?.querySelector('input[data-key="pressure"]')?.value,
        elevation: task?.querySelector('input[data-key="elevation"]')?.value
      },
      props: model[id]?.props || {},
      resultFlow: model[id]?.results?.flow,
      sequence: Number(window.__engineeringCalculationDefenseRealtimeState?.sequence || 0),
      ribbonSamples: window.__sinkRibbonTemplateSamples || [],
      taskLayoutSamples: window.__sinkTaskLayoutSamples || []
    };
  }, { windowSelector, sinkId });

  expect(state.nodesStable).toBe(true);
  expect(state.values).toEqual({ demandFlow: '30', pressure: '10', elevation: '10' });
  expect(Number(state.props.demandFlow)).toBeCloseTo(30, 9);
  expect(Number(state.props.flowDemand)).toBeCloseTo(30, 9);
  expect(Number(state.props.pressure)).toBeCloseTo(10, 9);
  expect(Number(state.props.elevation)).toBeCloseTo(10, 9);
  expect(Number(state.resultFlow)).toBeCloseTo(30, 9);
  expect(state.ribbonSamples.length).toBeGreaterThan(10);
  const canonicalRibbonLabels = ['Mode', 'Sink Flow', 'Sink P abs', 'Sink Elev.', 'Sink Head'];
  state.ribbonSamples.forEach((sample) => expect(sample.labels).toEqual(canonicalRibbonLabels));
  const ribbonHeights = state.ribbonSamples.map((sample) => sample.height).filter((height) => height > 0);
  expect(Math.max(...ribbonHeights) - Math.min(...ribbonHeights)).toBeLessThan(1);
  expect(state.taskLayoutSamples.length).toBeGreaterThan(10);
  state.taskLayoutSamples.forEach((sample) => expect(sample.nodesStable).toBe(true));
  for (const metric of ['taskWidth', 'taskHeight', 'flowRowWidth', 'flowRowHeight']) {
    const values = state.taskLayoutSamples.map((sample) => sample[metric]).filter((value) => value > 0);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(1);
  }

  const screenshotPath = testInfo.outputPath('sink-object-properties-input-stability.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('SNK input stability', { path: screenshotPath, contentType: 'image/png' });
});
