const { test, expect } = require('@playwright/test');

const BACKEND_WARNING = 'Backend validation unavailable; displayed hydraulic results are unverified by the protected backend.';
const HYDRAULIC_WARNING = 'Hydraulic NPSH margin is below the required value.';

async function waitForApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.updateSimulation === 'function'
    && window.EngineeringPumpEnvelopeWarningCleanup?.version === '2026.07-warning-lifecycle-cleanup3-current-request-lock'
    && window.EngineeringSimulationLoadTransaction?.version === 'engineering-simulation-load-transaction-manager.v6-stale-promise-clean'
  ), null, { timeout: 30000 });
}

async function openCase6(page) {
  await page.click('#menu-simulate');
  await page.waitForSelector('[data-simulation-case-id="simulation-case-6"]', { timeout: 15000 });
  await page.evaluate(() => {
    const root = document.querySelector('[data-simulation-case-id="simulation-case-6"]');
    const target = root?.querySelector?.('[data-simulation-case-action="open"]')
      || root?.querySelector?.('button, [role="menuitem"], .dropdown-submenu-trigger')
      || root;
    target?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  });
  const dialog = page.getByRole('dialog', { name: /Simulation Cases/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Open Sample Case' }).click();
}

async function waitUntilReady(page) {
  await page.waitForFunction(() => {
    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '';
    const lifecycle = window.EngineeringCalculationLifecycle?.current?.();
    const transaction = window.EngineeringSimulationLoadTransaction?.current?.();
    return label === 'Validate'
      && !solve?.disabled
      && !['preparing', 'calculating', 'applying-results', 'refreshing-evidence'].includes(lifecycle?.status)
      && transaction?.status !== 'active';
  }, null, { timeout: 30000 });
}

test('expired backend warnings are removed while active engineering and real outage warnings remain', async ({ page }) => {
  await waitForApp(page);
  await openCase6(page);
  await waitUntilReady(page);
  await page.waitForFunction(() => window.setBackendProtectedUnavailableResult?.__warningLifecycleCleanupPatched === true, null, {
    timeout: 10000
  });

  const connectedCleanup = await page.evaluate(({ backendWarning, hydraulicWarning }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = Object.values(model).find((node) => node?.type === 'pump');
    pump.results.warnings = [backendWarning, hydraulicWarning];
    pump.results.npshEvaluation = pump.results.npshEvaluation || {};
    pump.results.npshEvaluation.warnings = [backendWarning];
    window.EngineeringPumpEnvelopeWarningCleanup.sanitizeModelWarnings(model);
    window.updateCanvasWarningPanel?.();
    return {
      warnings: pump.results.warnings,
      nestedWarnings: pump.results.npshEvaluation.warnings,
      panelText: document.getElementById('canvasWarningList')?.textContent || '',
      backendStatus: pump.results.backendValidationStatus,
      freshness: pump.results.calculationFreshness
    };
  }, { backendWarning: BACKEND_WARNING, hydraulicWarning: HYDRAULIC_WARNING });

  expect(connectedCleanup.backendStatus).toBe('Connected');
  expect(connectedCleanup.freshness).toBe('Current');
  expect(connectedCleanup.warnings).toEqual([HYDRAULIC_WARNING]);
  expect(connectedCleanup.nestedWarnings).toEqual([]);
  expect(connectedCleanup.panelText).toContain(HYDRAULIC_WARNING);
  expect(connectedCleanup.panelText).not.toContain('Backend validation unavailable');

  const pendingCleanup = await page.evaluate((backendWarning) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = Object.values(model).find((node) => node?.type === 'pump');
    pump.results.warnings = [backendWarning];
    pump.results.backendValidationStatus = 'Calculating';
    pump.results.calculationFreshness = 'Calculating';
    pump.results.backendParity = { status: 'pending', requestId: 502 };
    window.setBackendProtectedUnavailableResult(pump, { status: 'timeout', requestId: 501 });
    window.EngineeringPumpEnvelopeWarningCleanup.sanitizeModelWarnings(model);
    window.updateCanvasWarningPanel?.();
    return {
      warnings: pump.results.warnings,
      backendStatus: pump.results.backendValidationStatus,
      freshness: pump.results.calculationFreshness,
      panelText: document.getElementById('canvasWarningList')?.textContent || ''
    };
  }, BACKEND_WARNING);

  expect(pendingCleanup.warnings).toEqual([]);
  expect(pendingCleanup.backendStatus).toBe('Calculating');
  expect(pendingCleanup.freshness).toBe('Calculating');
  expect(pendingCleanup.panelText).not.toContain('Backend validation unavailable');

  const activeFailure = await page.evaluate(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = Object.values(model).find((node) => node?.type === 'pump');
    pump.results.backendParity = { status: 'timeout', requestId: 503 };
    window.setBackendProtectedUnavailableResult(pump, { status: 'timeout', requestId: 503 });
    window.updateCanvasWarningPanel?.();
    return {
      warnings: pump.results.warnings || [],
      backendStatus: pump.results.backendValidationStatus,
      freshness: pump.results.calculationFreshness,
      panelText: document.getElementById('canvasWarningList')?.textContent || ''
    };
  });

  expect(activeFailure.backendStatus).toBe('Timeout');
  expect(activeFailure.freshness).toBe('Unverified');
  expect(activeFailure.warnings.some((warning) => /Backend validation unavailable/i.test(String(warning)))).toBe(true);
  expect(activeFailure.panelText).toContain('Backend validation unavailable');

  await page.locator('#btn-solve').click();
  await waitUntilReady(page);
  await page.waitForTimeout(500);

  const recovered = await page.evaluate(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = Object.values(model).find((node) => node?.type === 'pump');
    window.EngineeringPumpEnvelopeWarningCleanup.sanitizeModelWarnings(model);
    window.updateCanvasWarningPanel?.();
    return {
      warnings: pump.results.warnings || [],
      backendStatus: pump.results.backendValidationStatus,
      freshness: pump.results.calculationFreshness,
      npsha: Number(pump.results.npsha),
      panelText: document.getElementById('canvasWarningList')?.textContent || ''
    };
  });

  expect(recovered.backendStatus).toBe('Connected');
  expect(recovered.freshness).toBe('Current');
  expect(Number.isFinite(recovered.npsha)).toBe(true);
  expect(recovered.warnings.some((warning) => /Backend validation unavailable/i.test(String(warning)))).toBe(false);
  expect(recovered.panelText).not.toContain('Backend validation unavailable');
});
