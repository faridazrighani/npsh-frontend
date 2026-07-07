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
    && window.EngineeringSimulationLoadTransaction?.version === 'engineering-simulation-load-transaction-manager.v1'
    && window.EngineeringSimulationLoadTransaction?.cacheKey === '20260707-simulation-load-transaction6'
    && window.EngineeringCalculationLifecycle?.cacheKey === '20260707-solver-release-watchdog3'
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

function compactState(state = {}) {
  return {
    label: state.label,
    disabled: state.disabled,
    calculationBusy: state.calculationBusy,
    ariaBusy: state.ariaBusy,
    lifecycle: state.lifecycle?.status || '',
    transaction: state.transaction?.status || '',
    readiness: state.readiness?.phase || state.readiness?.status || '',
    pumps: state.pumpCount,
    pipes: state.pipeCount,
    objects: state.objectCount,
    pipeLabels: state.pipeLabelCount
  };
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

  for (const [kind, target] of sequence) {
    console.log('load sequence start', kind, target);
    if (kind === 'case') await openSimulationCase(page, target);
    else await openExternalUntirta(page, target);
    await waitForReady(page, target);
    const loadState = await expectReadySnapshot(page, target);
    console.log('load sequence ready', kind, target, compactState(loadState));
    const validateState = await assertValidateClickable(page);
    console.log('validate click ready', kind, target, compactState(validateState));
  }

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

  for (const caseId of ['simulation-case-1', 'simulation-case-4', 'simulation-case-6']) {
    await openSimulationCase(page, caseId);
    await page.waitForTimeout(250);
  }

  await waitForReady(page, 'rapid case burst');
  await expectReadySnapshot(page, 'rapid case burst');
  const finalState = await assertValidateClickable(page);
  expect(finalState.lifecycle.status).toBe('current');
  expect(finalState.transaction.status).not.toBe('active');
  expect(finalState.disabled).toBe(false);
  expect(finalState.calculationBusy).toBe('false');
});
