const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.updateSimulation === 'function'
    && window.EngineeringCalculationLifecycle?.version === 'engineering-calculation-lifecycle.v1'
    && window.EngineeringSimulationLoadTransaction?.version === 'engineering-simulation-load-transaction-manager.v7-export-lock-dedupe'
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

    if (caseId === 'simulation-case-6') {
      const loadedNpsha = await page.evaluate(() => {
        const model = window.__npshGlobalModel || window.globalModel || {};
        const pump = Object.values(model).find((node) => node?.type === 'pump') || {};
        const results = pump.results || {};
        const evaluation = results.npshEvaluation || {};
        return {
          aliases: [
            Number(results.npsha),
            Number(results.npshAvailable),
            Number(evaluation.npsha),
            Number(evaluation.npshAvailable)
          ],
          commit: window.__engineeringCanvasFastPreviewLastAuthoritativeCommit || null,
          backendSource: results.backendCalculationSource || evaluation.backendCalculationSource || '',
          responseNpsha: Number(window.__npshLastBackendSimulationResponse?.response?.results?.npsha),
          awaiting: !!window.EngineeringSimulationLoadTransaction?.current?.()?.awaitingAuthoritativeCalculation
        };
      });
      expect(loadedNpsha.aliases.every(Number.isFinite)).toBe(true);
      expect(new Set(loadedNpsha.aliases.map((value) => value.toFixed(8))).size).toBe(1);
      expect(
        Number.isFinite(loadedNpsha.responseNpsha)
        || /backend|primary|protected/i.test(loadedNpsha.backendSource)
      ).toBe(true);
      if (Number.isFinite(loadedNpsha.responseNpsha)) {
        expect(loadedNpsha.responseNpsha).toBeCloseTo(loadedNpsha.aliases[0], 8);
      }
      expect(loadedNpsha.awaiting).toBe(false);

      await page.locator('#btn-solve').click();
      await waitUntilNotBusy(page, caseId);
      await page.waitForTimeout(2400);
      const npshaState = await page.evaluate(() => {
        const model = window.__npshGlobalModel || window.globalModel || {};
        const pumpEntry = Object.entries(model).find(([, node]) => node?.type === 'pump') || [];
        const sourceEntry = Object.entries(model).find(([, node]) => node?.type === 'source') || [];
        let connectionList = model.connections || window.connections || [];
        try {
          if (typeof connections !== 'undefined' && Array.isArray(connections)) connectionList = connections;
        } catch {
          connectionList = [];
        }
        const suctionConnection = connectionList.find((connection) => connection?.to === pumpEntry[0]);
        const suctionPipe = model[suctionConnection?.pipeId];
        const pump = pumpEntry[1] || {};
        const source = sourceEntry[1] || {};
        const fluid = model.FLUID?.props || {};
        const results = pump.results || {};
        const evaluation = results.npshEvaluation || {};
        const pressureInput = Number(source.props?.pressure);
        const pressureAbs = source.props?.pressureInputBasis === 'Gauge' ? pressureInput + 1.01325 : pressureInput;
        const density = Number(fluid.density);
        const vaporPressure = Number(fluid.vaporPressure);
        const sourceElevation = Number(source.props?.elevation || 0);
        const pumpElevation = Number(pump.props?.suctionElevation ?? pump.props?.elevation ?? 0);
        const suctionLoss = Number(suctionPipe?.results?.calculationTrace?.totals?.totalLoss || 0);
        const expected = pressureAbs * 100000 / (density * 9.81)
          + sourceElevation
          - pumpElevation
          - suctionLoss
          - vaporPressure * 100000 / (density * 9.81);
        return {
          expected,
          aliases: [
            Number(results.npsha),
            Number(results.npshAvailable),
            Number(evaluation.npsha),
            Number(evaluation.npshAvailable)
          ],
          transient: results.__canvasFastPreviewTransient || null
        };
      });
      npshaState.aliases.forEach((value) => expect(value).toBeCloseTo(npshaState.expected, 4));
      expect(new Set(npshaState.aliases.map((value) => value.toFixed(8))).size).toBe(1);
      expect(npshaState.transient).toBeNull();
    }
  });
}
