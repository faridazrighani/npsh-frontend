const { test, expect } = require('@playwright/test');

const CASES = [
  { id: 'simulation-case-1', fluid: 'Water', temperature: 100, flow: 50, manualNpshr: 2.4002 },
  { id: 'simulation-case-4', fluid: 'Methanol', temperature: 40, flow: 280, manualNpshr: 5 },
  { id: 'simulation-case-6', fluid: 'Water', temperature: 90, flow: 39.68, manualNpshr: 1 }
];

async function waitForApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.updateSimulation === 'function'
    && window.EngineeringSimulationLoadTransaction?.version === 'engineering-simulation-load-transaction-manager.v7-export-lock-dedupe'
  ), null, { timeout: 30000 });
}

async function openSimulationCase(page, caseId) {
  await page.click('#menu-simulate');
  await page.waitForSelector(`#dropdown-simulate [data-simulation-case-id="${caseId}"]`);
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
    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label')?.textContent?.trim();
    const lifecycle = window.EngineeringCalculationLifecycle?.current?.();
    const transaction = window.EngineeringSimulationLoadTransaction?.current?.();
    return label === 'Validate'
      && !solve?.disabled
      && lifecycle?.status === 'current'
      && transaction?.status !== 'active';
  }, null, { timeout: 30000 });
}

for (const expected of CASES) {
  test(`${expected.id} opens with the current global data, layout, and backend algorithm`, async ({ page }) => {
    await waitForApp(page);
    await openSimulationCase(page, expected.id);

    const state = await page.evaluate(() => {
      let snapshot = null;
      try { snapshot = JSON.parse(window.getSimulationState?.() || 'null'); } catch {}
      const model = snapshot?.model || window.__npshGlobalModel || window.globalModel || {};
      const connections = snapshot?.connections || [];
      const entryByType = (type) => Object.entries(model).find(([, node]) => node?.type === type) || [];
      const [sourceId, source] = entryByType('source');
      const [pumpId, pump] = entryByType('pump');
      const [sinkId, sink] = entryByType('sink');
      const pipeIds = Object.entries(model).filter(([, node]) => node?.type === 'pipe').map(([id]) => id);
      const elementFor = (id) => document.querySelector(`.pfd-object[data-id="${id}"], .pfd-object[data-node-id="${id}"]`);
      const positionFor = (id) => {
        const element = elementFor(id);
        return element ? { left: element.style.left, top: element.style.top } : null;
      };
      const results = pump?.results || {};
      const evaluation = results.npshEvaluation || {};
      const sinkPanel = elementFor(sinkId)?.querySelector?.('.sink-live-params')
        || document.querySelector('.sink-live-params');
      const sinkRibbonLabels = Array.from(sinkPanel?.querySelectorAll?.('.sink-live-param-row') || [])
        .map((row) => row.querySelector('.sink-live-param-label')?.textContent?.trim())
        .filter(Boolean);
      const warningText = JSON.stringify([
        results.warnings || [],
        results.validationWarnings || [],
        evaluation.warnings || []
      ]);
      return {
        settings: model.SETTINGS?.props || {},
        fluid: model.FLUID?.props || {},
        sourceId,
        source: source?.props || {},
        pumpId,
        pump: pump?.props || {},
        pumpResults: results,
        sinkId,
        sink: sink?.props || {},
        pipeIds,
        connections,
        positions: {
          source: positionFor(sourceId),
          pump: positionFor(pumpId),
          sink: positionFor(sinkId)
        },
        npsha: Number(results.npsha ?? results.npshAvailable ?? evaluation.npsha),
        sinkRibbonLabels,
        warningText
      };
    });

    expect(state.settings.sourceFormat).toBe('sample-case');
    expect(state.settings.scenarioActive).toBe(true);
    expect(state.settings.basisConfirmed).toBe(true);
    expect(state.settings.basisDirty).toBe(false);
    expect(state.fluid.fluidName).toBe(expected.fluid);
    expect(Number(state.fluid.temperature)).toBeCloseTo(expected.temperature, 8);
    expect(Number(state.fluid.temperature)).toBeCloseTo(Number(state.fluid.temp), 10);
    expect(Number(state.source.volumetricFlow)).toBeCloseTo(expected.flow, 8);
    expect(Number(state.source.volumetricFlow)).toBeCloseTo(Number(state.source.flow), 10);
    expect(Number(state.sink.flowDemand)).toBeCloseTo(Number(state.sink.demandFlow), 10);
    expect(state.pump.npshrSourceMode).toBe('Manual');
    expect(Number(state.pump.manualNpshr)).toBeCloseTo(expected.manualNpshr, 8);
    expect(state.pipeIds).toEqual(['PIPE-1', 'PIPE-2']);
    expect(state.connections).toEqual([
      expect.objectContaining({ from: state.sourceId, to: state.pumpId, pipeId: 'PIPE-1' }),
      expect.objectContaining({ from: state.pumpId, to: state.sinkId, pipeId: 'PIPE-2' })
    ]);
    expect(state.positions).toEqual({
      source: { left: '115px', top: '228px' },
      pump: { left: '461px', top: '228px' },
      sink: { left: '808px', top: '228px' }
    });
    expect(state.sinkRibbonLabels).toEqual(['Mode', 'Sink Flow', 'Sink P abs', 'Sink Elev.', 'Sink Head']);
    expect(state.pumpResults.backendValidationStatus).toBe('Connected');
    expect(state.pumpResults.backendCalculationSource).toMatch(/backend|primary|protected/i);
    expect(Number.isFinite(state.npsha)).toBe(true);
    expect(state.warningText).not.toMatch(/Backend validation unavailable; displayed hydraulic results are unverified/i);

    await page.locator('#btn-solve').click();
    await page.waitForFunction(() => {
      const solve = document.getElementById('btn-solve');
      const label = solve?.querySelector?.('.ribbon-label')?.textContent?.trim();
      return label === 'Validate'
        && !solve?.disabled
        && window.EngineeringCalculationLifecycle?.current?.()?.status === 'current';
    }, null, { timeout: 30000 });
    const labelsAfterValidate = await page.evaluate(() => Array.from(
      document.querySelectorAll('.sink-live-params .sink-live-param-row')
    ).map((row) => row.querySelector('.sink-live-param-label')?.textContent?.trim()).filter(Boolean));
    expect(labelsAfterValidate).toEqual(['Mode', 'Sink Flow', 'Sink P abs', 'Sink Elev.', 'Sink Head']);
  });
}

test('route warning colors stay identical for forward and reverse workflow construction', async ({ page }) => {
  await waitForApp(page);
  await openSimulationCase(page, 'simulation-case-6');

  const prepareWarning = await page.evaluate(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pumpEntry = Object.entries(model).find(([, node]) => node?.type === 'pump') || [];
    const pump = pumpEntry[1];
    if (!pump) return { ok: false };
    pump.results = pump.results || {};
    pump.results.hydraulicNpshStatus = 'Warning';
    pump.results.backendValidationStatus = 'Connected';
    pump.results.status = 'Warning';
    window.EngineeringRouteTraceAudit?.syncRoutePresentationColors?.(document);
    return { ok: true, pumpId: pumpEntry[0] };
  });
  expect(prepareWarning.ok).toBe(true);

  async function monitorWarningFrames() {
    return page.evaluate(async () => {
      const samples = [];
      const capture = () => {
        const model = window.__npshGlobalModel || window.globalModel || {};
        const statuses = window.EngineeringRouteTraceAudit?.routePresentationStatuses?.(model) || {};
        const classes = Object.keys(statuses).map((nodeId) => {
          const type = model[nodeId]?.type;
          if (type === 'pipe') {
            return document.querySelector(`#svg-lines .pipe-hydraulic-label[data-pipe-id="${nodeId}"]`)?.getAttribute('class') || '';
          }
          const object = Array.from(document.querySelectorAll('.pfd-object')).find((candidate) => (
            candidate.dataset.nodeId === nodeId
            || candidate.dataset.objectId === nodeId
            || candidate.dataset.id === nodeId
            || candidate.textContent.includes(nodeId)
          ));
          return object?.querySelector(`.${type}-live-params`)?.className || '';
        });
        samples.push(classes);
      };
      const callable = typeof window.updateAllObjectOperatingStatusVisuals === 'function';
      window.updateAllObjectOperatingStatusVisuals?.();
      const startedAt = performance.now();
      while (performance.now() - startedAt < 700) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        capture();
      }
      return { callable, samples };
    });
  }

  const forwardFrames = await monitorWarningFrames();
  expect(forwardFrames.callable).toBe(true);
  expect(forwardFrames.samples.length).toBeGreaterThan(5);
  forwardFrames.samples.flat().forEach((className) => expect(className).toMatch(/-warning(?:\s|$)/));

  async function colorSnapshot() {
    return page.evaluate(() => {
      const model = window.__npshGlobalModel || window.globalModel || {};
      const statuses = window.EngineeringRouteTraceAudit?.routePresentationStatuses?.(model) || {};
      const routeNodeIds = Object.keys(statuses).filter((nodeId) => ['source', 'pipe', 'pump', 'sink'].includes(model[nodeId]?.type));
      const details = routeNodeIds.map((nodeId) => {
        const type = model[nodeId]?.type;
        if (type === 'pipe') {
          const label = document.querySelector(`#svg-lines .pipe-hydraulic-label[data-pipe-id="${nodeId}"]`);
          return { nodeId, type, className: label?.getAttribute('class') || '', status: label?.dataset?.routePresentationStatus || '' };
        }
        const object = Array.from(document.querySelectorAll('.pfd-object')).find((candidate) => (
          candidate.dataset.nodeId === nodeId
          || candidate.dataset.objectId === nodeId
          || candidate.dataset.id === nodeId
          || candidate.textContent.includes(nodeId)
        ));
        const panel = object?.querySelector(`.${type}-live-params`);
        return {
          nodeId,
          type,
          className: panel?.className || '',
          status: object?.dataset?.routePresentationStatus || '',
          background: panel ? getComputedStyle(panel).backgroundColor : ''
        };
      });
      return { statuses, details };
    });
  }

  const forward = await colorSnapshot();
  expect(Object.values(forward.statuses)).toEqual(['warning', 'warning', 'warning', 'warning', 'warning']);
  forward.details.forEach((item) => {
    expect(item.status).toBe('warning');
    expect(item.className).toContain(item.type === 'pipe' ? 'pipe-hydraulic-label-warning' : `${item.type}-live-params-warning`);
    if (item.type !== 'pipe') expect(item.background).toBe('rgb(255, 247, 237)');
  });

  const reversed = await page.evaluate(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const connectionLists = [];
    try { if (typeof connections !== 'undefined' && Array.isArray(connections)) connectionLists.push(connections); } catch {}
    if (Array.isArray(window.connections)) connectionLists.push(window.connections);
    if (Array.isArray(window.__npshConnections)) connectionLists.push(window.__npshConnections);
    const seen = new Set();
    let changed = 0;
    connectionLists.forEach((list) => {
      if (seen.has(list)) return;
      seen.add(list);
      list.forEach((connection) => {
        const from = connection.from;
        const fromPort = connection.fromPort;
        connection.from = connection.to;
        connection.fromPort = connection.toPort;
        connection.to = from;
        connection.toPort = fromPort;
        connection.rawFrom = connection.from;
        connection.rawTo = connection.to;
        connection.hydraulicReversed = true;
        changed += 1;
      });
    });
    window.EngineeringRouteTraceAudit?.syncRoutePresentationColors?.(document);
    return { changed, statuses: window.EngineeringRouteTraceAudit?.routePresentationStatuses?.(model) || {} };
  });
  expect(reversed.changed).toBeGreaterThanOrEqual(2);
  expect(Object.values(reversed.statuses)).toEqual(['warning', 'warning', 'warning', 'warning', 'warning']);

  const reverseFrames = await monitorWarningFrames();
  expect(reverseFrames.callable).toBe(true);
  expect(reverseFrames.samples.length).toBeGreaterThan(5);
  reverseFrames.samples.flat().forEach((className) => expect(className).toMatch(/-warning(?:\s|$)/));

  const reverse = await colorSnapshot();
  expect(reverse).toEqual(forward);
});
