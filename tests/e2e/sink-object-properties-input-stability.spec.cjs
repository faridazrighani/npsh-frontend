const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.renderSidebar === 'function'
    && typeof window.updateSimulation === 'function'
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
}

test('actual SNK numeric inputs remain stable and create one realtime transaction per committed value', async ({ page }, testInfo) => {
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
    return Number(window.__engineeringCalculationDefenseRealtimeState?.sequence || 0);
  }, { windowSelector });

  const flowInput = page.locator(`${windowSelector} input[data-key="demandFlow"]`);
  await flowInput.click();
  await flowInput.press('Control+A');
  const previewSnapshots = [];
  for (const character of '20.25') {
    await flowInput.type(character);
    const currentValue = await flowInput.inputValue();
    previewSnapshots.push(await page.evaluate(({ sinkId: id, expected }) => {
      const model = window.__npshGlobalModel || window.globalModel || {};
      const row = Array.from(document.querySelectorAll('.sink-live-param-row')).find((candidate) => (
        candidate.querySelector('.sink-live-param-label')?.textContent?.trim() === 'Sink Flow'
      ));
      return {
        expected,
        prop: model[id]?.props?.demandFlow,
        preview: window.EngineeringSinkInputStabilityRuntime?.previewForNode?.(model[id])?.demandFlow,
        canvas: row?.querySelector('.sink-live-param-value')?.textContent || ''
      };
    }, { sinkId, expected: currentValue }));
    await page.waitForTimeout(350);
  }
  previewSnapshots.forEach((snapshot) => {
    const expected = Number(snapshot.expected);
    expect(Number(snapshot.prop)).toBeCloseTo(expected, 9);
    expect(Number(snapshot.preview)).toBeCloseTo(expected, 9);
    expect(snapshot.canvas).toBe(expected.toFixed(3));
  });
  await page.waitForFunction(({ sinkId: id }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return window.__engineeringCalculationDefenseRealtimeState?.status === 'Current'
      && Math.abs(Number(model[id]?.props?.demandFlow) - 20.25) < 1e-9
      && Math.abs(Number(model[id]?.results?.flow) - 20.25) < 1e-9;
  }, { sinkId }, { timeout: 30000 });
  const afterFlowSequence = await page.evaluate(() => Number(window.__engineeringCalculationDefenseRealtimeState?.sequence || 0));
  expect(afterFlowSequence - baseline).toBe(1);

  const elevationInput = page.locator(`${windowSelector} input[data-key="elevation"]`);
  await elevationInput.fill('2.75');
  await page.waitForFunction(({ sinkId: id }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return window.__engineeringCalculationDefenseRealtimeState?.status === 'Current'
      && Math.abs(Number(model[id]?.props?.elevation) - 2.75) < 1e-9
      && Math.abs(Number(model[id]?.results?.calculationTrace?.boundary?.elevation) - 2.75) < 1e-9;
  }, { sinkId }, { timeout: 30000 });

  const pressureInput = page.locator(`${windowSelector} input[data-key="pressure"]`);
  await pressureInput.fill('2.5');
  await expect(page.locator(`${windowSelector} [data-prop-key="source-absolute-pressure"], ${windowSelector} .object-task-field-row`).filter({ hasText: /Calculated Abs\. Pressure/ }).first()).toContainText('3.513');
  await page.waitForFunction(({ sinkId: id }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return window.__engineeringCalculationDefenseRealtimeState?.status === 'Current'
      && Math.abs(Number(model[id]?.props?.pressure) - 2.5) < 1e-9
      && Math.abs(Number(model[id]?.results?.boundaryPressureInput) - 2.5) < 0.001;
  }, { sinkId }, { timeout: 30000 });

  const state = await page.evaluate(({ windowSelector, sinkId: id }) => {
    const task = document.querySelector(windowSelector);
    const model = window.__npshGlobalModel || window.globalModel || {};
    const retained = window.__sinkStableTaskNodes || {};
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
      sequence: Number(window.__engineeringCalculationDefenseRealtimeState?.sequence || 0)
    };
  }, { windowSelector, sinkId });

  expect(state.nodesStable).toBe(true);
  expect(state.values).toEqual({ demandFlow: '20.25', pressure: '2.5', elevation: '2.75' });
  expect(Number(state.props.demandFlow)).toBeCloseTo(20.25, 9);
  expect(Number(state.props.flowDemand)).toBeCloseTo(20.25, 9);
  expect(Number(state.props.pressure)).toBeCloseTo(2.5, 9);
  expect(Number(state.props.elevation)).toBeCloseTo(2.75, 9);
  expect(Number(state.resultFlow)).toBeCloseTo(20.25, 9);
  expect(state.sequence - baseline).toBe(3);

  const screenshotPath = testInfo.outputPath('sink-object-properties-input-stability.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('SNK input stability', { path: screenshotPath, contentType: 'image/png' });
});
