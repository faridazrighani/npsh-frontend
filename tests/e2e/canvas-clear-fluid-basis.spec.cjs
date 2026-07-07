const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.applySimulationStateAtomic === 'function'
    && window.EngineeringCanvasClearResetGuard?.version === '2026.07-canvas-clear-reset-guard2'
    && window.CanvasContextDock?.version === 'engineering-canvas-context-dock.v4'
    && window.CanvasContextDock?.cacheKey === '20260707-clear-keeps-fluid-basis1'
  ), null, { timeout: 30000 });
}

async function loadProjectWithFluidBasisDock(page) {
  await page.evaluate(() => {
    const makePipe = (name, diameter, length, fittingK) => ({
      type: 'pipe',
      name,
      props: {
        roughnessAgingFactor: 1,
        headLossAllowancePercent: 0,
        segments: [
          {
            name: `${name} major`,
            pipeSize: 'Custom diameter',
            material: 'Custom roughness',
            diameter,
            length,
            roughness: 0.0000457,
            fittingType: 'None',
            fittingQuantity: 0,
            fittingK: 0,
            minorLoss: 0
          },
          {
            name: `${name} fitting K`,
            pipeSize: 'Custom diameter',
            material: 'Custom roughness',
            diameter,
            length: 0,
            roughness: 0.0000457,
            fittingType: 'Custom K',
            fittingQuantity: 1,
            fittingK,
            minorLoss: 0
          }
        ]
      },
      results: {}
    });

    const model = {
      FLUID: {
        type: 'fluid',
        name: 'Fluid Basis',
        props: {
          fluidName: 'Water',
          temp: 90,
          density: 965.309,
          kinematicViscosity: 0.325,
          dynamicViscosity: 0.314,
          vaporPressure: 0.701827,
          vaporPressureHead: 7.411,
          specificWeight: 9469.681
        },
        results: {}
      },
      'SRC-100': {
        type: 'source',
        name: 'SRC-100',
        props: {
          pressureInputBasis: 'Absolute',
          pressureBasis: 'Static',
          pressure: 2.024,
          elevation: 1,
          flowInputMode: 'Volumetric Flow',
          volumetricFlow: 39.68,
          flow: 39.68
        },
        results: {}
      },
      'PIPE-1': makePipe('PIPE-1', 0.1, 20, 2),
      'P-100': {
        type: 'pump',
        name: 'P-100',
        props: {
          inputMode: 'Basic',
          suctionElevation: 0,
          elevation: 0,
          manualNpshr: 1,
          designNpshr: 1,
          npshrSourceMode: 'Manual',
          designFlow: 39.68,
          designHead: 20,
          designEfficiency: 70
        },
        results: {}
      },
      'PIPE-2': makePipe('PIPE-2', 0.08, 30, 4),
      'SNK-100': {
        type: 'sink',
        name: 'SNK-100',
        props: {
          pressureInputBasis: 'Absolute',
          pressureBasis: 'Static',
          pressure: 3.936,
          elevation: 8,
          demandFlow: 39.68
        },
        results: {}
      }
    };

    window.applySimulationStateAtomic(JSON.stringify({
      projectFile: { sourceFormat: 'canvas-clear-fluid-basis-e2e' },
      model,
      connections: [
        {
          from: 'SRC-100',
          fromPort: '.port.outlet',
          to: 'P-100',
          toPort: '.port.inlet',
          pipeId: 'PIPE-1',
          connectionType: 'hydraulic',
          rawFrom: 'SRC-100',
          rawTo: 'P-100',
          hydraulicReversed: false
        },
        {
          from: 'P-100',
          fromPort: '.port.outlet',
          to: 'SNK-100',
          toPort: '.port.inlet',
          pipeId: 'PIPE-2',
          connectionType: 'hydraulic',
          rawFrom: 'P-100',
          rawTo: 'SNK-100',
          hydraulicReversed: false
        }
      ],
      visuals: {
        'SRC-100': { left: '120px', top: '310px' },
        'P-100': { left: '430px', top: '300px' },
        'SNK-100': { left: '740px', top: '310px' }
      },
      sourceLinks: [],
      instrumentLinks: []
    }));
    window.CanvasContextDock?.refresh?.();
  });

  await page.waitForFunction(() => (
    document.querySelectorAll('#canvas .pfd-object').length >= 3
    && !!document.getElementById('canvasContextDock')
  ), null, { timeout: 15000 });
}

test('Edit Clear Canvas keeps Fluid Basis dock visible on an empty canvas', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await waitForNpshApp(page);
  await loadProjectWithFluidBasisDock(page);

  await expect(page.locator('#canvasContextDock')).toBeVisible();
  await expect(page.locator('#canvasContextDock')).toContainText('Fluid Basis');
  await expect(page.locator('#canvas .pfd-object')).toHaveCount(3);

  await page.click('#menu-edit');
  await expect(page.locator('#dropdown-edit')).toBeVisible();
  await page.click('#menu-clear');
  const confirmDialog = page.getByRole('dialog', { name: 'Clear Canvas' });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole('button', { name: 'Clear Canvas' }).click();

  await page.waitForFunction(() => (
    window.__npshCanvasClearEmpty === true
    && document.querySelectorAll('#canvas .pfd-object').length === 0
    && !!document.getElementById('canvasContextDock')
  ), null, { timeout: 15000 });

  await page.waitForTimeout(2200);
  const state = await page.evaluate(() => {
    const dock = document.getElementById('canvasContextDock');
    const routeButtons = [...document.querySelectorAll('#canvasContextDock .context-dock-route-button')];
    const style = dock ? window.getComputedStyle(dock) : null;
    return {
      clearEmpty: window.__npshCanvasClearEmpty === true,
      objectCount: document.querySelectorAll('#canvas .pfd-object').length,
      dockExists: !!dock,
      dockParentId: dock?.parentElement?.id || null,
      dockDisplay: style?.display || null,
      dockVisibility: style?.visibility || null,
      dockText: dock?.innerText || '',
      routeTitles: routeButtons.map((button) => button.getAttribute('title') || button.textContent.trim())
    };
  });

  expect(state.clearEmpty).toBe(true);
  expect(state.objectCount).toBe(0);
  expect(state.dockExists).toBe(true);
  expect(state.dockParentId).toBe('canvas');
  expect(state.dockDisplay).not.toBe('none');
  expect(state.dockVisibility).not.toBe('hidden');
  expect(state.dockText).toContain('Fluid Basis');
  expect(state.routeTitles).toEqual(['Fluid Basis']);
});
