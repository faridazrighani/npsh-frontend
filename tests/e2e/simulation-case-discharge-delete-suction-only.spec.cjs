const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.updateSimulation === 'function'
    && window.EngineeringSuctionOnlyNpshaRuntime
    && window.EngineeringCalculationLifecycle?.version === 'engineering-calculation-lifecycle.v1'
    && window.EngineeringSimulationLoadTransaction?.version === 'engineering-simulation-load-transaction-manager.v1'
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

async function removeDischargeSideLeavingStaleConnection(page) {
  return page.evaluate(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    let connectionList = [];
    try {
      if (typeof connections !== 'undefined' && Array.isArray(connections)) connectionList = connections;
    } catch (error) {
      connectionList = [];
    }
    if (!Array.isArray(connectionList) || !connectionList.length) {
      if (!Array.isArray(window.connections)) window.connections = [];
      connectionList = window.connections;
    }
    const pumpId = Object.keys(model).find((id) => model[id]?.type === 'pump') || 'P-100';
    let downstream = connectionList.find((connection) => (
      connection?.from === pumpId
      && (!connection.connectionType || connection.connectionType === 'hydraulic')
    ));
    const suction = connectionList.find((connection) => connection?.to === pumpId);
    const suctionPipeId = suction?.pipeId || (model[suction?.from]?.type === 'pipe' ? suction.from : '');
    const sinkId = downstream?.to || Object.keys(model).find((id) => /sink/i.test(model[id]?.type || '') || /^SNK/i.test(id));
    const pipeId = downstream?.pipeId
      || Object.keys(model).find((id) => model[id]?.type === 'pipe' && id !== suctionPipeId);
    if (!downstream && sinkId && pipeId) {
      downstream = { from: pumpId, to: sinkId, pipeId, connectionType: 'hydraulic' };
      connectionList.push(downstream);
    }
    const removed = [];
    [sinkId, pipeId].forEach((id) => {
      if (!id) return;
      if (model[id]) removed.push(id);
      delete model[id];
      if (window.globalModel && window.globalModel !== model) delete window.globalModel[id];
      if (window.__npshGlobalModel && window.__npshGlobalModel !== model) delete window.__npshGlobalModel[id];
    });
    window.CanvasContextDock?.refresh?.();
    window.updateAllObjectOperatingStatusVisuals?.();
    document.dispatchEvent(new CustomEvent('npsh:simulation-updated', {
      detail: { reason: 'e2e-discharge-side-deleted', pumpId, removed }
    }));
    return {
      pumpId,
      removed,
      staleDownstreamKept: !!downstream && connectionList.some((connection) => connection === downstream),
      eligible: !!window.EngineeringSuctionOnlyNpshaRuntime?.isSuctionOnlyEligiblePump?.(model, pumpId)
    };
  });
}

async function waitForSuctionOnlyReady(page, pumpId) {
  await page.waitForFunction((id) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[id];
    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '';
    const lifecycle = window.EngineeringCalculationLifecycle?.current?.();
    return pump?.results?.routeCalculationStatus === 'Suction Only'
      && pump?.results?.requiredPumpHeadStatus === 'Downstream Required'
      && pump?.results?.backendValidationStatus === 'Connected'
      && pump?.results?.calculationFreshness === 'Current'
      && label === 'Validate'
      && !solve?.disabled
      && solve?.dataset?.calculationBusy !== 'true'
      && lifecycle?.status === 'current';
  }, pumpId, { timeout: 30000 });
}

for (const caseId of ['simulation-case-1', 'simulation-case-4', 'simulation-case-6']) {
  test(`${caseId} remains solvable after deleting discharge pipe and SNK`, async ({ page }) => {
    await waitForNpshApp(page);
    await openSimulationCase(page, caseId);
    await waitUntilNotBusy(page);

    const removal = await removeDischargeSideLeavingStaleConnection(page);
    expect(removal.removed.length).toBeGreaterThan(0);
    expect(removal.staleDownstreamKept).toBe(true);
    expect(removal.eligible).toBe(true);

    const solved = await page.evaluate((pumpId) => window.EngineeringSuctionOnlyNpshaRuntime.runRouteSolve(pumpId), removal.pumpId);
    expect(solved).toBe(true);
    await waitForSuctionOnlyReady(page, removal.pumpId);
    await expect(page.locator('#btn-solve')).toBeEnabled();
    await page.locator('#btn-solve').click();
    await waitForSuctionOnlyReady(page, removal.pumpId);
  });
}
