const { test, expect } = require('@playwright/test');

function createPipe(name, { length = 8, diameter = 0.08, fittingK = 0 } = {}) {
  return {
    type: 'pipe',
    name,
    props: {
      routeStyle: 'Straight',
      elevationProfileMode: 'End Elevations',
      roughnessAgingFactor: 1,
      headLossAllowancePercent: 0,
      segments: [
        {
          name,
          pipeSize: 'Custom diameter',
          material: 'Custom roughness',
          diameter,
          length,
          roughness: 0.000045,
          fittingType: fittingK > 0 ? 'Custom K' : 'None',
          fittingQuantity: fittingK > 0 ? 1 : 0,
          fittingK,
          minorLoss: 0
        }
      ]
    }
  };
}

function twoPipeProject() {
  return {
    projectFile: { sourceFormat: 'playwright-pdf-export-progress' },
    model: {
      FLUID: {
        type: 'fluid',
        name: 'Fluid Basis',
        props: {
          fluidName: 'Water',
          temp: 90,
          density: 965.309,
          viscosity: 0.325,
          dynamicViscosity: 0.314,
          vaporPressure: 0.701827
        }
      },
      SRC: {
        type: 'source',
        name: 'SRC-100',
        props: {
          sourceType: 'Pressure Boundary',
          boundaryDataSource: 'Manual',
          pressureInputBasis: 'Absolute',
          pressure: 2.024,
          pressureEnergyBasis: 'Static Pressure',
          elevation: 1.4,
          temperatureMode: 'Use Fluid Basis',
          flowInputMode: 'Volumetric Flow',
          flow: 39.68,
          massFlow: 0
        }
      },
      'PIPE-1': createPipe('PIPE-1', { length: 46, diameter: 0.0635, fittingK: 1.2 }),
      'P-100': {
        type: 'pump',
        name: 'P-100',
        props: {
          inputMode: 'Basic',
          npshrSourceMode: 'Estimated',
          curveDataSource: 'Engineering Fit',
          npshAssessmentMode: 'Screening',
          npshMarginBasis: 'User Defined',
          designFlow: 39.68,
          bepFlow: 39.68,
          designHead: 30,
          designEfficiency: 70,
          designNpshr: 1,
          porMinPercent: 70,
          porMaxPercent: 120,
          aorMinPercent: 50,
          aorMaxPercent: 130,
          minNpshMarginRatio: 1,
          minNpshMargin: 0.5,
          suctionElevation: 0,
          dischargeElevation: 0,
          curveData: []
        },
        results: {}
      },
      'PIPE-2': createPipe('PIPE-2', { length: 24, diameter: 0.05, fittingK: 2.1 }),
      'SNK-100': {
        type: 'sink',
        name: 'SNK-100',
        props: {
          active: 'Active',
          boundaryMode: 'Outlet Pressure Boundary',
          pressureInputBasis: 'Absolute',
          pressure: 3.936,
          pressureBasis: 'Static',
          elevation: 8,
          demandFlow: 39.68
        },
        results: {}
      }
    },
    connections: [
      { from: 'SRC', fromPort: '.port.outlet', to: 'P-100', toPort: '.port.inlet', pipeId: 'PIPE-1', connectionType: 'hydraulic' },
      { from: 'P-100', fromPort: '.port.outlet', to: 'SNK-100', toPort: '.port.inlet', pipeId: 'PIPE-2', connectionType: 'hydraulic' }
    ],
    instrumentLinks: [],
    sourceLinks: [],
    visuals: {
      SRC: { left: '120px', top: '260px' },
      'P-100': { left: '420px', top: '260px' },
      'SNK-100': { left: '700px', top: '260px' }
    }
  };
}

async function waitForNpshApp(page) {
  await page.addInitScript(() => {
    window.__pdfExportProgressEvents = [];
    window.__pdfExportHtml = '';
    window.__pdfExportPrintFocusCalls = 0;
    window.open = () => ({
      document: {
        open() {},
        write(html) {
          window.__pdfExportHtml = String(html || '');
        },
        close() {}
      },
      focus() {
        window.__pdfExportPrintFocusCalls += 1;
      }
    });
    const installCapture = () => {
      document.addEventListener('npsh:pdf-export-progress', (event) => {
        window.__pdfExportProgressEvents.push({ ...(event.detail || {}) });
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installCapture, { once: true });
    else installCapture();
  });

  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    window.__npshLoadSupport?.();
  });
  await page.waitForFunction(() => (
    typeof window.applySimulationStateAtomic === 'function'
    && typeof window.updateSimulation === 'function'
    && window.EngineeringPdfExportProgressRuntime?.version === 'engineering-pdf-export-progress.v1'
    && window.EngineeringExportEquationProfessionalRuntime?.version === '2026.07-pdf-equation-professional10-route-integrity'
    && window.EngineeringPipeMoodyChartAudit?.version === 'engineering-pipe-moody-chart-audit.v9'
  ), null, { timeout: 30000 });
}

async function loadProject(page, project) {
  await page.evaluate((projectState) => {
    window.applySimulationStateAtomic(JSON.stringify(projectState));
  }, project);
  await expect(page.getByRole('button', { name: 'Route node P-100' })).toBeVisible();
}

async function runProtectedSolve(page) {
  const responsePromise = page.waitForResponse((response) => (
    /\/api\/simulate(?:[?#]|$)/.test(response.url())
    && response.request().method() === 'POST'
    && response.status() === 200
  ), { timeout: 30000 });
  const solvePromise = page.evaluate(() => window.updateSimulation({
    refreshReason: 'pdf-export-progress-e2e',
    trigger: 'solve',
    forceBackend: true,
    renderSidebarAfter: false
  }));
  const response = await responsePromise;
  const body = await response.json();
  await solvePromise;
  await page.evaluate((result) => {
    const model = window.__npshGlobalModel || {};
    Object.entries(result.nodeResults || {}).forEach(([id, node]) => {
      if (model[id]?.type !== 'pipe') return;
      model[id].results = {
        ...(model[id].results || {}),
        ...(node.results || {})
      };
    });
    window.drawConnections?.();
    window.EngineeringPipeCanvasHydraulicLabelRuntime?.refresh?.(document);
  }, body);
}

test('Menu File Export PDF shows compact progress and keeps report content current', async ({ page }) => {
  await waitForNpshApp(page);
  await loadProject(page, twoPipeProject());
  await runProtectedSolve(page);

  await page.evaluate(() => {
    document.querySelector('#menu-file')?.click();
    document.querySelector('#menu-file-export')?.click();
    document.querySelector('#menu-export-appendix-pdf')?.click();
  });

  await page.waitForFunction(() => {
    const events = window.__pdfExportProgressEvents || [];
    return events.some((event) => event.phase === 'complete')
      && typeof window.__pdfExportHtml === 'string'
      && window.__pdfExportHtml.includes('Mode: Equation Professional');
  }, null, { timeout: 30000 });

  const result = await page.evaluate(() => {
    const events = window.__pdfExportProgressEvents || [];
    const html = window.__pdfExportHtml || '';
    const overlay = document.getElementById('engineeringPdfExportProgressOverlay');
    const pdfButton = document.querySelector('#menu-export-appendix-pdf');
    const excelButton = document.querySelector('#menu-export-excel-trace');
    return {
      events,
      htmlContains: {
        equationProfessional: html.includes('Mode: Equation Professional'),
        pressureEnthalpy: html.includes('Pressure-enthalpy phase chart'),
        moodyChart: html.includes('Log-Log Moody Chart'),
        pipe2Moody: html.includes('PIPE-2') && html.includes('Log-Log Moody Chart'),
        moodyChartCount: (html.match(/Log-Log Moody Chart/g) || []).length,
        pumpPerformanceCurve: html.includes('Pump Performance Curve')
      },
      overlay: {
        visible: overlay?.dataset.visible || '',
        state: overlay?.dataset.state || '',
        percent: overlay?.querySelector('[data-pdf-export-progress-percent]')?.textContent || '',
        text: overlay?.textContent || ''
      },
      buttons: {
        pdfDisabled: pdfButton?.disabled === true,
        pdfBusy: pdfButton?.getAttribute('aria-busy') || '',
        excelDisabled: excelButton?.disabled === true,
        excelBusy: excelButton?.getAttribute('aria-busy') || ''
      },
      focusCalls: window.__pdfExportPrintFocusCalls || 0
    };
  });

  const stepKeys = result.events.map((event) => event.stepKey).filter(Boolean);
  [
    'start',
    'read',
    'validate',
    'snapshot',
    'phase-chart',
    'moody',
    'equations',
    'pages',
    'finalizing',
    'complete'
  ].forEach((stepKey) => expect(stepKeys).toContain(stepKey));

  expect(result.events.some((event) => event.phase === 'begin')).toBe(true);
  expect(result.events.some((event) => event.phase === 'complete' && event.percent === 100)).toBe(true);
  expect(result.events.some((event) => event.stepKey === 'moody')).toBe(true);
  expect(result.htmlContains.equationProfessional).toBe(true);
  expect(result.htmlContains.pressureEnthalpy).toBe(true);
  expect(result.htmlContains.moodyChart).toBe(true);
  expect(result.htmlContains.pipe2Moody).toBe(true);
  expect(result.htmlContains.moodyChartCount).toBe(2);
  expect(result.htmlContains.pumpPerformanceCurve).toBe(false);
  expect(result.overlay.state).toBe('complete');
  expect(result.overlay.percent).toBe('100%');
  expect(result.overlay.text).toContain('PDF Report Ready');
  expect(result.buttons.excelDisabled).toBe(false);
  expect(result.buttons.excelBusy).toBe('');
  expect(result.focusCalls).toBeGreaterThanOrEqual(1);

  await expect(page.locator('#engineeringPdfExportProgressOverlay')).toHaveAttribute('data-visible', 'false', { timeout: 2500 });
  const restored = await page.evaluate(() => ({
    pdfDisabled: document.querySelector('#menu-export-appendix-pdf')?.disabled === true,
    pdfBusy: document.querySelector('#menu-export-appendix-pdf')?.getAttribute('aria-busy') || ''
  }));
  expect(restored.pdfDisabled).toBe(false);
  expect(restored.pdfBusy).toBe('');
});
