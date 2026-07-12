const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__NPSH_PERFORMANCE_BASELINE_SILENT__ = true);
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.updateSimulation === 'function'
    && window.EngineeringPerformanceBaselineRuntime?.version === 'engineering-performance-baseline.v2-console-clean'
    && window.EngineeringPerformanceBaselineRuntime?.cacheKey === '20260712-performance-console-clean1'
    && window.EngineeringSimulationLoadTransaction?.version === 'engineering-simulation-load-transaction-manager.v6-stale-promise-clean'
    && window.EngineeringCalculationLifecycle?.version === 'engineering-calculation-lifecycle.v1'
  ), null, { timeout: 30000 });
  await page.evaluate(() => window.EngineeringPerformanceBaselineRuntime.reset());
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

async function waitUntilNotBusy(page) {
  await page.waitForFunction(() => {
    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '';
    const lifecycle = window.EngineeringCalculationLifecycle?.current?.();
    const transaction = window.EngineeringSimulationLoadTransaction?.current?.();
    return label === 'Validate'
      && !solve?.disabled
      && solve?.dataset?.calculationBusy !== 'true'
      && lifecycle?.status !== 'calculating'
      && lifecycle?.status !== 'applying-results'
      && lifecycle?.status !== 'preparing'
      && lifecycle?.status !== 'refreshing-evidence'
      && transaction?.status !== 'active'
      && !!(window.__npshGlobalModel || window.globalModel);
  }, null, { timeout: 30000 });
}

test('performance baseline records simulation load and canvas metrics without blocking Validate', async ({ page }) => {
  await waitForNpshApp(page);
  await openSimulationCase(page, 'simulation-case-6');
  await waitUntilNotBusy(page);

  const baseline = await page.evaluate(() => ({
    snapshot: window.EngineeringPerformanceBaselineRuntime.snapshot(),
    samples: window.EngineeringPerformanceBaselineRuntime.samples().map((sample) => ({
      type: sample.type,
      durationMs: sample.durationMs,
      canvasObjects: sample.canvasObjects,
      canvasDomNodes: sample.canvasDomNodes,
      taskWindows: sample.taskWindows,
      validateDisabled: sample.validateDisabled,
      validateBusy: sample.validateBusy,
      consoleWarnings: sample.counters?.consoleWarnings,
      consoleErrors: sample.counters?.consoleErrors,
      staleResultsRejected: sample.counters?.staleResultsRejected
    }))
  }));

  expect(baseline.snapshot.cacheKey).toBe('20260712-performance-console-clean1');
  expect(baseline.snapshot.canvasObjects).toBeGreaterThanOrEqual(3);
  expect(baseline.snapshot.validateDisabled).toBe(false);
  expect(baseline.snapshot.validateBusy).toBe(false);
  expect(baseline.snapshot.counters.consoleErrors).toBe(0);
  expect(baseline.samples.some((sample) => sample.type === 'simulation-load-start')).toBe(true);
  expect(baseline.samples.some((sample) => sample.type === 'simulation-load-complete')).toBe(true);
  expect(baseline.samples.some((sample) => sample.type === 'apply-simulation-state')).toBe(true);
  expect(baseline.samples.some((sample) => sample.type === 'canvas-ready-after-apply')).toBe(true);
  expect(baseline.samples.find((sample) => sample.type === 'simulation-load-complete')?.durationMs).toBeGreaterThanOrEqual(0);
});
