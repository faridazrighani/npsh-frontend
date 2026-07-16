const { test, expect } = require('@playwright/test');

function createPipe(name) {
  return {
    type: 'pipe',
    name,
    props: {
      routeStyle: 'Straight',
      elevationProfileMode: 'End Elevations',
      segments: [{
        name,
        pipeSize: 'Custom diameter',
        material: 'Custom roughness',
        diameter: 0.08,
        length: 8,
        roughness: 0.000045,
        fittingType: 'Custom K',
        fittingQuantity: 1,
        fittingK: 1,
        minorLoss: 0
      }]
    }
  };
}

function dragProject() {
  return {
    projectFile: { sourceFormat: 'playwright-drag-e2e' },
    model: {
      FLUID: {
        type: 'fluid',
        name: 'Fluid Basis',
        props: { fluidName: 'Water', temp: 25, density: 997.047, viscosity: 0.803, vaporPressure: 0.0317 }
      },
      SRC: {
        type: 'source',
        name: 'SRC',
        props: { pressureInputBasis: 'Absolute', pressure: 1.25, elevation: 0, flow: 50 }
      },
      'PIPE-S': createPipe('Suction pipe'),
      P: {
        type: 'pump',
        name: 'P',
        props: { inputMode: 'Basic', npshrSourceMode: 'Manual', manualNpshr: 3 },
        results: {}
      },
      'PIPE-D': createPipe('Discharge pipe'),
      SNK: {
        type: 'sink',
        name: 'SNK',
        props: { pressureInputBasis: 'Absolute', pressure: 1.01325, elevation: 0, demandFlow: 50 },
        results: {}
      }
    },
    connections: [
      { from: 'SRC', fromPort: '.port.outlet', to: 'P', toPort: '.port.inlet', pipeId: 'PIPE-S', connectionType: 'hydraulic' },
      { from: 'P', fromPort: '.port.outlet', to: 'SNK', toPort: '.port.inlet', pipeId: 'PIPE-D', connectionType: 'hydraulic' }
    ],
    instrumentLinks: [],
    sourceLinks: [],
    visuals: {
      SRC: { left: '180px', top: '320px' },
      P: { left: '430px', top: '320px' },
      SNK: { left: '700px', top: '320px' }
    }
  };
}

test('canvas equipment drag coalesces redraw bursts and keeps the final route aligned', async ({ page }) => {
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(error.stack || error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.applySimulationStateAtomic === 'function'
    && typeof window.getPipeRoutePoints === 'function'
    && typeof window.pointsToPath === 'function'
    && typeof window.updateSimulation === 'function'
    && window.EngineeringSimulationLoadTransaction?.version === 'engineering-simulation-load-transaction-manager.v7-export-lock-dedupe'
    && window.EngineeringCalculationLifecycle?.version === 'engineering-calculation-lifecycle.v1'
  ), null, { timeout: 30000 });
  await page.evaluate((project) => window.applySimulationStateAtomic(JSON.stringify(project)), dragProject());
  await page.waitForSelector('#obj-p', { state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => (
    document.querySelectorAll('#svg-lines .pipe-line[data-pipe-id]').length === 2
    && window.EngineeringPipeCanvasHydraulicLabelRuntime?.version === '2026.07-pipe-canvas-reynolds-darcy3-smooth-drag'
  ), null, { timeout: 30000 });

  const pump = page.locator('#obj-p');
  await expect(pump).toBeVisible();
  const before = await pump.boundingBox();
  expect(before).not.toBeNull();

  const start = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
  const delta = { x: 160, y: 70 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  const burst = await page.evaluate(async ({ start, delta }) => {
    const svg = document.getElementById('svg-lines');
    let childListRecords = 0;
    const observer = new MutationObserver((records) => {
      childListRecords += records.filter((record) => record.type === 'childList').length;
    });
    observer.observe(svg, { childList: true, subtree: true });

    const startedAt = performance.now();
    for (let index = 1; index <= 120; index += 1) {
      const ratio = index / 120;
      document.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        clientX: start.x + delta.x * ratio,
        clientY: start.y + delta.y * ratio
      }));
    }
    const dispatchDurationMs = performance.now() - startedAt;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    observer.disconnect();
    return { childListRecords, dispatchDurationMs };
  }, { start, delta });

  await page.mouse.move(start.x + delta.x, start.y + delta.y);
  await page.mouse.up();
  await page.waitForTimeout(350);

  const after = await pump.boundingBox();
  const finalState = await page.evaluate(() => ({
    left: document.getElementById('obj-p')?.style.left || '',
    top: document.getElementById('obj-p')?.style.top || '',
    pipePaths: Array.from(document.querySelectorAll('#svg-lines .pipe-line')).map((path) => path.getAttribute('d') || ''),
    duplicateLabels: Array.from(document.querySelectorAll('#svg-lines .pipe-hydraulic-label[data-pipe-id]'))
      .map((label) => label.dataset.pipeId)
      .filter((pipeId, index, all) => all.indexOf(pipeId) !== index)
  }));

  expect(after.x - before.x).toBeGreaterThan(140);
  expect(after.y - before.y).toBeGreaterThan(55);
  expect(burst.childListRecords).toBeLessThan(20);
  expect(burst.dispatchDurationMs).toBeLessThan(250);
  expect(finalState.left).toMatch(/px$/);
  expect(finalState.top).toMatch(/px$/);
  expect(finalState.pipePaths.length).toBeGreaterThanOrEqual(2);
  finalState.pipePaths.forEach((pathData) => expect(pathData).toMatch(/^M\s/));
  expect(finalState.duplicateLabels).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
