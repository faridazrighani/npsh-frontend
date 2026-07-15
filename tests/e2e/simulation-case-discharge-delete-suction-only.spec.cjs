const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.updateSimulation === 'function'
    && window.EngineeringSuctionOnlyNpshaRuntime
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

async function reverseDischargeConnectionLeavingSuctionOnly(page) {
  return page.evaluate(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    let connectionList = [];
    try {
      if (typeof connections !== 'undefined' && Array.isArray(connections)) connectionList = connections;
    } catch {
      connectionList = [];
    }
    if (!Array.isArray(connectionList) || !connectionList.length) {
      if (!Array.isArray(window.connections)) window.connections = [];
      connectionList = window.connections;
    }
    const pumpId = Object.keys(model).find((id) => model[id]?.type === 'pump') || 'P-100';
    const downstream = connectionList.find((connection) => (
      connection?.from === pumpId
      && (!connection.connectionType || connection.connectionType === 'hydraulic')
    ));
    if (!downstream) {
      return { pumpId, reversed: false, eligible: false };
    }
    const originalTo = downstream.to;
    downstream.from = originalTo;
    downstream.to = pumpId;
    downstream.rawFrom = originalTo;
    downstream.rawTo = pumpId;
    downstream.hydraulicReversed = true;
    window.CanvasContextDock?.refresh?.();
    window.updateAllObjectOperatingStatusVisuals?.();
    document.dispatchEvent(new CustomEvent('npsh:simulation-updated', {
      detail: {
        reason: 'e2e-discharge-connection-reversed',
        pumpId,
        sinkId: originalTo,
        pipeId: downstream.pipeId || downstream.pipe || ''
      }
    }));
    return {
      pumpId,
      reversed: true,
      sinkId: originalTo,
      pipeId: downstream.pipeId || downstream.pipe || '',
      eligible: !!window.EngineeringSuctionOnlyNpshaRuntime?.isSuctionOnlyEligiblePump?.(model, pumpId)
    };
  });
}

async function waitForSuctionOnlyReady(page, pumpId) {
  await page.waitForFunction((id) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[id];
    const evaluation = pump?.results?.npshEvaluation || {};
    const connectionList = Array.isArray(window.__npshConnections)
      ? window.__npshConnections
      : (Array.isArray(window.connections) ? window.connections : []);
    const suctionConnection = connectionList.find((connection) => connection?.to === id);
    const pipe = model[suctionConnection?.pipeId];
    const solvedPumpFlow = Number(evaluation.flow ?? pump?.results?.flow);
    const solvedPipeFlow = Number(pipe?.results?.flow ?? pipe?.results?.calculationTrace?.basis?.flowM3H);
    const npsha = Number(evaluation.npsha ?? pump?.results?.npsha);
    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '';
    const lifecycle = window.EngineeringCalculationLifecycle?.current?.();
    return pump?.results?.routeCalculationStatus === 'Suction Only'
      && pump?.results?.requiredPumpHeadStatus === 'Downstream Required'
      && pump?.results?.backendValidationStatus === 'Connected'
      && pump?.results?.calculationFreshness === 'Current'
      && Number.isFinite(npsha)
      && solvedPumpFlow > 0
      && solvedPipeFlow > 0
      && label === 'Validate'
      && !solve?.disabled
      && solve?.dataset?.calculationBusy !== 'true'
      && lifecycle?.status === 'current';
  }, pumpId, { timeout: 30000 });
}

async function expectPumpDownstreamRowsBlank(page, pumpId) {
  await page.waitForFunction((id) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isDash = (value) => /^-(?:\s+(?:m|bar a))?$/.test(normalize(value));
    const panel = Array.from(document.querySelectorAll('.pump-live-params')).find((candidate) => {
      const object = candidate.closest('.pfd-object, [data-node-id], [data-object-id]');
      return object?.dataset?.nodeId === id
        || object?.dataset?.objectId === id
        || normalize(candidate.textContent).includes(id)
        || document.querySelectorAll('.pump-live-params').length === 1;
    }) || null;
    const rowValue = (label) => {
      const row = Array.from(panel?.querySelectorAll?.('.pump-live-param-row') || []).find((candidate) => (
        normalize(candidate.querySelector('.pump-live-param-label')?.textContent) === label
      ));
      const value = normalize(row?.querySelector('.pump-live-param-value, strong')?.textContent);
      const unit = normalize(row?.querySelector('.pump-live-param-unit')?.textContent);
      return unit && value && !value.endsWith(unit) ? `${value} ${unit}` : value;
    };
    return isDash(rowValue('Required Head')) && isDash(rowValue('Discharge Press.'));
  }, pumpId, { timeout: 30000 });
}

async function loadFreshSuctionOnlyProject(page) {
  return page.evaluate(() => {
    const model = {
      FLUID: {
        type: 'fluid',
        name: 'Fluid Basis',
        props: { fluidName: 'Water', temp: 25 },
        results: {}
      },
      'SRC-100': {
        type: 'source',
        name: 'SRC-100',
        props: {
          mode: 'Tank',
          pressureInputBasis: 'Absolute',
          pressureBasis: 'Static',
          pressure: 1.01325,
          elevation: 0,
          flowInputMode: 'Volumetric Flow',
          volumetricFlow: 9.528,
          flow: 9.528
        },
        results: {}
      },
      'PIPE-1': {
        type: 'pipe',
        name: 'PIPE-1',
        props: {
          roughnessAgingFactor: 1,
          headLossAllowancePercent: 0,
          segments: [{
            name: 'PIPE-1-Seg-1',
            pipeSize: 'Custom diameter',
            material: 'Custom roughness',
            diameter: 0.1,
            length: 20,
            roughness: 0.0000457,
            fittingType: 'None',
            fittingQuantity: 0,
            fittingK: 0,
            minorLoss: 0
          }]
        },
        results: {}
      },
      'P-100': {
        type: 'pump',
        name: 'P-100',
        props: {
          inputMode: 'Basic',
          suctionElevation: 0,
          elevation: 0,
          manualNpshr: '',
          npshrSourceMode: 'Manual',
          designFlow: 9.528
        },
        results: {}
      }
    };
    window.NPSHSourceTemperatureRuntime?.syncFluidBasisPropertiesFromTemperature?.(model.FLUID);
    window.applySimulationStateAtomic(JSON.stringify({
      projectFile: { sourceFormat: 'fresh-suction-only-user-flow-e2e' },
      model,
      connections: [{
        from: 'SRC-100',
        fromPort: '.port.outlet',
        to: 'P-100',
        toPort: '.port.inlet',
        pipeId: 'PIPE-1',
        connectionType: 'hydraulic',
        rawFrom: 'SRC-100',
        rawTo: 'P-100',
        hydraulicReversed: false
      }],
      visuals: {
        'SRC-100': { left: '120px', top: '310px' },
        'P-100': { left: '430px', top: '300px' }
      },
      sourceLinks: [],
      instrumentLinks: []
    }));
    window.CanvasContextDock?.refresh?.();
    return {
      pumpId: 'P-100',
      eligible: !!window.EngineeringSuctionOnlyNpshaRuntime?.isSuctionOnlyEligiblePump?.(
        window.__npshGlobalModel || window.globalModel || model,
        'P-100'
      )
    };
  });
}

test('fresh FB -> SRC -> PIPE -> Pump route calculates from the Validate button', async ({ page }) => {
  await waitForNpshApp(page);
  const route = await loadFreshSuctionOnlyProject(page);
  expect(route.eligible).toBe(true);

  await waitUntilNotBusy(page);
  await expect(page.locator('#btn-solve')).toBeEnabled();
  await page.locator('#btn-solve').click();
  await waitForSuctionOnlyReady(page, route.pumpId);

  const result = await page.evaluate((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[pumpId] || {};
    const evaluation = pump.results?.npshEvaluation || {};
    const lossTrace = evaluation.calculationTrace?.losses || {};
    const suctionPipeTrace = Array.isArray(lossTrace.entries)
      ? lossTrace.entries.find((entry) => entry?.id === 'PIPE-1')
      : null;
    const firstSegment = Array.isArray(suctionPipeTrace?.details) ? suctionPipeTrace.details[0] : null;
    return {
      npsha: Number(evaluation.npsha ?? pump.results?.npsha),
      velocity: Number(firstSegment?.velocity),
      totalLoss: Number(suctionPipeTrace?.headLoss ?? lossTrace.total),
      hydraulicStatus: pump.results?.hydraulicNpshStatus,
      backendStatus: pump.results?.backendValidationStatus,
      routeStatus: pump.results?.routeCalculationStatus,
      requiredHeadStatus: pump.results?.requiredPumpHeadStatus
    };
  }, route.pumpId);

  expect(result.npsha).toBeGreaterThan(0);
  expect(result.velocity).toBeGreaterThan(0);
  expect(result.totalLoss).toBeGreaterThanOrEqual(0);
  expect(result.hydraulicStatus).toBe('NPSHr Not Provided');
  expect(result.backendStatus).toBe('Connected');
  expect(result.routeStatus).toBe('Suction Only');
  expect(result.requiredHeadStatus).toBe('Downstream Required');
  await expectPumpDownstreamRowsBlank(page, route.pumpId);
});

test('new-user UI route SRC -> PIPE -> Pump automatically calculates NPSHa', async ({ page }) => {
  await waitForNpshApp(page);

  const openSetup = page.getByRole('button', { name: 'Open Setup', exact: true });
  if (await openSetup.isVisible().catch(() => false)) await openSetup.click();
  const applyBasis = page.getByRole('button', { name: 'Apply Basis / Start Modeling', exact: true });
  if (await applyBasis.isVisible().catch(() => false)) await applyBasis.click();

  await page.getByRole('button', { name: 'Add Source', exact: true }).click();
  await page.getByRole('button', { name: 'Add Pump', exact: true }).click();
  await page.waitForFunction(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return !!(model['SRC-100'] && model['P-100']);
  }, null, { timeout: 15000 });

  const sourceObject = page.locator('#obj-src100');
  await expect(sourceObject).toBeVisible();
  await sourceObject.click({ button: 'right' });
  const connect = page.locator('#canvasContextMenu [role="menuitem"]').filter({ hasText: /^Connect$/ });
  await expect(connect).toHaveCount(1);
  await connect.click();
  await page.locator('#obj-p100 .port.inlet').click();

  await page.waitForFunction(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const connectionList = Array.isArray(window.__npshConnections)
      ? window.__npshConnections
      : (Array.isArray(window.connections) ? window.connections : []);
    return connectionList.some((connection) => (
      connection?.from === 'SRC-100'
      && connection?.to === 'P-100'
      && model[connection?.pipeId]?.type === 'pipe'
    ));
  }, null, { timeout: 15000 });

  await waitForSuctionOnlyReady(page, 'P-100');

  const result = await page.evaluate(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const connections = Array.isArray(window.__npshConnections)
      ? window.__npshConnections
      : (Array.isArray(window.connections) ? window.connections : []);
    const connection = connections.find((candidate) => candidate?.from === 'SRC-100' && candidate?.to === 'P-100');
    const source = model['SRC-100'] || {};
    const pump = model['P-100'] || {};
    const pipe = model[connection?.pipeId] || {};
    const evaluation = pump.results?.npshEvaluation || {};
    return {
      pipeId: connection?.pipeId || '',
      sourceInputFlow: Number(source.props?.flow ?? source.props?.volumetricFlow),
      sourceEvaluatedFlow: Number(
        source.results?.evaluatedFlow
        ?? source.results?.flow
        ?? source.results?.sourceInputFlow
        ?? source.results?.outletFlow
        ?? source.props?.flow
      ),
      pipeFlow: Number(pipe.results?.flow ?? pipe.results?.calculationTrace?.basis?.flowM3H),
      npsha: Number(evaluation.npsha ?? pump.results?.npsha),
      suctionPressure: Number(evaluation.suctionPressureAbs ?? pump.results?.suctionPressure),
      routeStatus: pump.results?.routeCalculationStatus,
      backendStatus: pump.results?.backendValidationStatus
    };
  });

  expect(result.pipeId).toMatch(/^PIPE-/);
  expect(result.sourceInputFlow).toBeGreaterThan(0);
  expect(result.sourceEvaluatedFlow).toBeGreaterThan(0);
  expect(result.pipeFlow).toBeGreaterThan(0);
  expect(result.suctionPressure).toBeGreaterThan(0);
  expect(result.npsha).toBeGreaterThan(0);
  expect(result.routeStatus).toBe('Suction Only');
  expect(result.backendStatus).toBe('Connected');
  await expectPumpDownstreamRowsBlank(page, 'P-100');

  await expect(page.locator('#btn-solve')).toBeEnabled();
  await page.locator('#btn-solve').click();
  await waitForSuctionOnlyReady(page, 'P-100');
});

for (const caseId of ['simulation-case-1', 'simulation-case-4', 'simulation-case-5', 'simulation-case-6']) {
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

test('simulation-case-6 remains solvable when discharge connection is reversed', async ({ page }) => {
  await waitForNpshApp(page);
  await openSimulationCase(page, 'simulation-case-6');
  await waitUntilNotBusy(page);

  const reversal = await reverseDischargeConnectionLeavingSuctionOnly(page);
  expect(reversal.reversed).toBe(true);
  expect(reversal.eligible).toBe(false);

  await expect(page.locator('#btn-solve')).toBeEnabled();
  await page.locator('#btn-solve').click();
  await page.waitForFunction((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const evaluation = results.npshEvaluation || {};
    const lifecycle = window.EngineeringCalculationLifecycle?.current?.();
    return results.backendValidationStatus === 'Connected'
      && Number.isFinite(Number(results.requiredSystemHead ?? evaluation.requiredSystemHead))
      && Number.isFinite(Number(results.dischargePressure ?? evaluation.dischargePressure))
      && lifecycle?.status === 'current';
  }, reversal.pumpId, { timeout: 30000 });
  await expect(page.locator('#btn-solve')).toBeEnabled();
});
