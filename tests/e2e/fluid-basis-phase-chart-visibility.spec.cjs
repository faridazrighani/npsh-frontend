const { test, expect } = require('@playwright/test');

const PANEL = '[data-fluid-basis-phase-chart-panel="true"]';
const FLUID_NAME = '#taskWindow select[data-fluid-control="fluidName"], #taskWindow #fluidNameSelect';

test('Fluid Basis P-h chart is locked to Water and cleanly hidden for Methanol or Custom Fluid', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.message || error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.openFluidBasis === 'function'
    && window.EngineeringFluidBasisPhaseChartRuntime?.version === '2026.07-fluid-basis-phase-chart5-water-only'
    && window.EngineeringFluidBasisPhaseChartRuntime?.cacheKey === '20260712-fluid-phase-chart-water-only1'
  ), null, { timeout: 30000 });

  const initialFluidName = await page.evaluate(() => window.EngineeringFluidBasisPhaseChartRuntime.readFluidName());
  expect(initialFluidName).toBe('Water');
  await expect(page.locator(`#taskWindow ${PANEL}`)).toHaveCount(1);
  await expect(page.locator(`#taskWindow ${PANEL}`)).toBeVisible();

  const openSetup = page.locator('#taskWindow button').filter({ hasText: /Open Setup/i }).first();
  if (await openSetup.count()) await openSetup.click();
  const fluidName = page.locator(FLUID_NAME).first();
  await expect(fluidName).toBeVisible();
  await expect(fluidName).toHaveValue('Water');
  await expect(page.locator(`#taskWindow ${PANEL}`)).toHaveCount(1);
  await expect(page.locator(`#taskWindow ${PANEL}`)).toBeVisible();

  await fluidName.selectOption('Methanol');
  await expect(page.locator(`#taskWindow ${PANEL}`)).toHaveCount(0);
  await expect(page.locator('#taskWindow')).toHaveAttribute('data-fluid-basis-phase-chart-visibility', 'hidden-non-water');

  await fluidName.selectOption('Custom');
  await expect(page.locator(`#taskWindow ${PANEL}`)).toHaveCount(0);
  await expect(page.locator('#taskWindow')).toHaveAttribute('data-fluid-basis-phase-chart-visibility', 'hidden-non-water');

  await fluidName.selectOption('Water');
  await expect(page.locator(`#taskWindow ${PANEL}`)).toHaveCount(1);
  await expect(page.locator(`#taskWindow ${PANEL}`)).toBeVisible();
  await expect(page.locator('#taskWindow')).toHaveAttribute('data-fluid-basis-phase-chart-visibility', 'visible-water');

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
