const { test, expect } = require('@playwright/test');

const CASE_IDS = ['simulation-case-1', 'simulation-case-2', 'simulation-case-3', 'simulation-case-4', 'simulation-case-5', 'simulation-case-6'];

test('all Simulation Cases omit View Journal & Analysis Report and retain Open Sample Case', async ({ page }) => {
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    window.EngineeringSimulationCaseMenuCleanup?.VERSION === 'engineering-simulation-case-menu-cleanup.v1'
  ), null, { timeout: 30000 });

  await page.click('#menu-simulate');
  await page.waitForFunction((caseIds) => caseIds.every((id) => (
    document.querySelector(`#dropdown-simulate [data-simulation-case-id="${id}"]`)
  )), CASE_IDS, { timeout: 15000 });

  const state = await page.evaluate((caseIds) => {
    const menu = document.getElementById('dropdown-simulate');
    return {
      reportActionCount: menu?.querySelectorAll('[data-simulation-case-action="report"]').length ?? -1,
      containsRetiredText: /View Journal\s*&\s*Analysis Report/i.test(menu?.textContent || ''),
      cases: caseIds.map((id) => {
        const item = menu?.querySelector(`[data-simulation-case-id="${id}"]`);
        return {
          id,
          disabled: item?.dataset?.simulationCaseDisabled === 'true',
          actions: Array.from(item?.querySelectorAll?.('[data-simulation-case-action]') || [])
            .map((action) => action.dataset.simulationCaseAction)
        };
      })
    };
  }, CASE_IDS);

  expect(state.reportActionCount).toBe(0);
  expect(state.containsRetiredText).toBe(false);
  expect(state.cases.map((entry) => entry.id)).toEqual(CASE_IDS);
  state.cases.forEach((entry) => {
    expect(entry.actions).not.toContain('report');
    expect(entry.actions).toEqual(entry.disabled ? [] : ['open']);
  });

  const staleAction = await page.evaluate(async () => {
    const menu = document.getElementById('dropdown-simulate');
    const host = menu?.querySelector('[data-simulation-case-id="simulation-case-1"] .simulation-case-submenu');
    if (!host) throw new Error('Simulation Case 1 submenu is unavailable.');
    let oldHandlerRan = false;
    const button = document.createElement('button');
    button.dataset.simulationCaseAction = 'report';
    button.textContent = 'View Journal & Analysis Report';
    button.addEventListener('click', () => { oldHandlerRan = true; });
    host.appendChild(button);
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { oldHandlerRan, stillConnected: button.isConnected };
  });

  expect(staleAction).toEqual({ oldHandlerRan: false, stillConnected: false });
  expect(browserErrors).toEqual([]);
});
