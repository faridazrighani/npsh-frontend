const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.updateSimulation === 'function'
    && window.EngineeringCalculationLifecycle?.version === 'engineering-calculation-lifecycle.v1'
    && window.EngineeringSimulationLoadTransaction?.version === 'engineering-simulation-load-transaction-manager.v3-visual-wrapper-lock'
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

async function waitUntilNotBusy(page, caseId) {
  await page.waitForFunction((id) => {
    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '';
    const lifecycle = window.EngineeringCalculationLifecycle?.current?.();
    const transaction = window.EngineeringSimulationLoadTransaction?.current?.();
    return {
      ready: label === 'Validate'
        && !solve?.disabled
        && solve?.dataset?.calculationBusy !== 'true'
        && lifecycle?.status !== 'calculating'
        && lifecycle?.status !== 'applying-results'
        && lifecycle?.status !== 'preparing'
        && lifecycle?.status !== 'refreshing-evidence'
        && transaction?.status !== 'active'
        && !!(window.__npshGlobalModel || window.globalModel),
      id
    }.ready;
  }, caseId, { timeout: 30000 });
}

async function snapshotCaseState(page) {
  return page.evaluate(() => {
    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '';
    const model = window.__npshGlobalModel || window.globalModel || {};
    return {
      label,
      disabled: !!solve?.disabled,
      ariaBusy: solve?.getAttribute('aria-busy') || '',
      calculationBusy: solve?.dataset?.calculationBusy || '',
      lifecycle: window.EngineeringCalculationLifecycle?.current?.() || null,
      transaction: window.EngineeringSimulationLoadTransaction?.current?.() || null,
      modelKeys: Object.keys(model).filter((key) => model[key] && typeof model[key] === 'object').sort(),
      hasPump: Object.values(model).some((node) => node?.type === 'pump')
    };
  });
}

for (const caseId of ['simulation-case-1', 'simulation-case-4', 'simulation-case-6']) {
  test(`${caseId} load releases Calculating state and keeps Validate clickable`, async ({ page }) => {
    await waitForNpshApp(page);
    await openSimulationCase(page, caseId);
    await waitUntilNotBusy(page, caseId);
    const state = await snapshotCaseState(page);
    expect(state.label).toBe('Validate');
    expect(state.disabled).toBe(false);
    expect(state.calculationBusy).toBe('false');
    expect(state.lifecycle.status).toBe('current');
    expect(state.transaction.status).not.toBe('active');
    expect(state.hasPump).toBe(true);
  });
}
