const fs = require('fs');
const { test, expect } = require('@playwright/test');

function createPipe(name, segments) {
  return {
    type: 'pipe',
    name,
    props: {
      routeStyle: 'Straight',
      elevationProfileMode: 'End Elevations',
      roughnessAgingFactor: 1,
      headLossAllowancePercent: 0,
      segments
    },
    results: {
      calculationFreshness: 'Current',
      backendValidationStatus: 'Current'
    }
  };
}

function segment(name, { length = 10, diameter = 0.0738, roughness = 0.00015, fittingK = 0 } = {}) {
  return {
    name,
    pipeSize: 'Custom diameter',
    diameter,
    length,
    material: 'Custom roughness',
    roughness,
    fittingType: fittingK > 0 ? 'Custom K' : 'None',
    fittingQuantity: fittingK > 0 ? 1 : 0,
    fittingK,
    minorLoss: 0
  };
}

function baseProject() {
  return {
    projectFile: { sourceFormat: 'playwright-pipe-segments-file' },
    model: {
      FLUID: {
        type: 'fluid',
        name: 'Fluid Basis',
        props: {
          fluidName: 'Water',
          temp: 25,
          density: 997.047,
          viscosity: 0.803,
          vaporPressure: 0.0317
        }
      },
      SRC: {
        type: 'source',
        name: 'SRC',
        props: {
          sourceType: 'Pressure Boundary',
          boundaryDataSource: 'Manual',
          pressureInputBasis: 'Absolute',
          pressure: 1.25,
          pressureEnergyBasis: 'Static Pressure',
          elevation: 0,
          temperatureMode: 'Use Fluid Basis',
          flowInputMode: 'Volumetric Flow',
          flow: 50,
          massFlow: 0
        }
      },
      'PIPE-S': createPipe('Suction pipe', [segment('Suction segment', { length: 8, fittingK: 1 })]),
      PUMP: {
        type: 'pump',
        name: 'PUMP',
        props: {
          inputMode: 'Basic',
          npshrSourceMode: 'Estimated',
          curveDataSource: 'Engineering Fit',
          npshAssessmentMode: 'Screening',
          designFlow: 50,
          bepFlow: 50,
          designHead: 35,
          designEfficiency: 70,
          designNpshr: 3
        },
        results: {
          calculationFreshness: 'Current',
          backendValidationStatus: 'Current',
          calculationAudit: { calculationId: 'pipe-segments-file-baseline' },
          dependencyManifest: { dependencyFingerprint: 'pipe-segments-file-baseline' }
        }
      },
      'PIPE-D': createPipe('Discharge pipe', [
        segment('PIPE-D-Seg-1 Journal', { length: 10, fittingK: 18.448 }),
        segment('PIPE-D-Seg-2 Globe valve', { length: 0, fittingK: 2 }),
        segment('PIPE-D-Seg-3 Swing check', { length: 0, fittingK: 2 })
      ]),
      SNK: {
        type: 'sink',
        name: 'SNK',
        props: {
          active: 'Active',
          boundaryMode: 'Outlet Pressure Boundary',
          pressureInputBasis: 'Absolute',
          pressure: 1.01325,
          pressureBasis: 'Static',
          elevation: 0,
          demandFlow: 50
        },
        results: {}
      }
    },
    connections: [
      { from: 'SRC', fromPort: '.port.outlet', to: 'PUMP', toPort: '.port.inlet', pipeId: 'PIPE-S', connectionType: 'hydraulic' },
      { from: 'PUMP', fromPort: '.port.outlet', to: 'SNK', toPort: '.port.inlet', pipeId: 'PIPE-D', connectionType: 'hydraulic' }
    ],
    instrumentLinks: [],
    sourceLinks: [],
    visuals: {
      SRC: { left: '180px', top: '320px' },
      PUMP: { left: '430px', top: '320px' },
      SNK: { left: '700px', top: '320px' }
    }
  };
}

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    typeof window.applySimulationStateAtomic === 'function'
    && typeof window.openPipePropertiesTaskWindow === 'function'
    && typeof window.renderSidebar === 'function'
    && window.EngineeringPipeSegmentsFileRuntime?.version === 'engineering-pipe-segments-file-runtime.v1'
    && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v9'
  ), null, { timeout: 30000 });
}

async function openPipeSegments(page) {
  await page.evaluate((project) => {
    window.applySimulationStateAtomic(JSON.stringify(project));
    window.currentSelectedNode = 'PIPE-D';
    window.__npshExplicitObjectPropertiesOpenUntil = Date.now() + 2000;
    if (typeof window.requestPipePropertiesTaskWindowOpen === 'function') {
      window.requestPipePropertiesTaskWindowOpen('PIPE-D');
    }
    window.openPipePropertiesTaskWindow('PIPE-D');
    const taskWindow = document.querySelector('.persistent-object-properties-task-window[data-kind="pipe"][data-node-id="PIPE-D"]')
      || document.querySelector('.task-window[data-task-node-id="PIPE-D"]')
      || document.querySelector('.persistent-object-properties-task-window[data-kind="pipe"]');
    if (taskWindow) {
      window.renderSidebar('PIPE-D', { taskWindow, skipDismissedGuard: true });
    }
  }, baseProject());
  await page.waitForSelector('#pipeSegmentTable', { timeout: 10000 });
  await page.waitForSelector('[data-pipe-segments-export]', { timeout: 10000 });
  await page.waitForSelector('[data-pipe-segments-import]', { timeout: 10000 });
}

test('Pipe Segments can be exported and imported as local .v1 files without losing stale protection', async ({ page }, testInfo) => {
  await waitForNpshApp(page);
  await openPipeSegments(page);

  const actionMetrics = await page.locator('.pipe-segments-file-actions').first().boundingBox();
  expect(actionMetrics.height).toBeLessThanOrEqual(32);
  await expect(page.locator('[data-pipe-segments-import]').first()).toHaveText('Import');
  await expect(page.locator('[data-pipe-segments-export]').first()).toHaveText('Export');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-pipe-segments-export]').first().click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  expect(filename).toMatch(/^pipe-segments-export_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.v1$/);

  const exportedPath = testInfo.outputPath(filename);
  await download.saveAs(exportedPath);
  const exportedPayload = JSON.parse(fs.readFileSync(exportedPath, 'utf8'));
  expect(exportedPayload.schemaType).toBe('pipe-segments-export.v1');
  expect(exportedPayload.schemaVersion).toBe(1);
  expect(exportedPayload.pipeId).toBe('PIPE-D');
  expect(exportedPayload.segmentCount).toBe(3);
  expect(exportedPayload.segments[0].name).toBe('PIPE-D-Seg-1 Journal');
  expect(exportedPayload.segments[0].diameter).toBeCloseTo(0.0738, 6);
  expect(exportedPayload.segments[0].fittingK).toBeCloseTo(18.448, 6);

  const importPayload = {
    schemaType: 'pipe-segments-export.v1',
    schemaVersion: 1,
    app: 'Untirta Ghani PIPE NPSH',
    exportedAt: new Date('2026-06-08T06:49:35.000Z').toISOString(),
    pipeId: 'PIPE-D',
    pipeName: 'Discharge pipe imported',
    segmentCount: 2,
    segments: [
      segment('Imported Seg-1 Long run', { length: 42, diameter: 0.081, roughness: 0.00012, fittingK: 1.25 }),
      segment('Imported Seg-2 Zero length fitting', { length: 0, diameter: 0.081, roughness: 0.00012, fittingK: 6.5 })
    ]
  };
  const importPath = testInfo.outputPath('pipe-segments-import.v1');
  fs.writeFileSync(importPath, `${JSON.stringify(importPayload, null, 2)}\n`);

  await page.evaluate(() => {
    window.__pipeSegmentsImportedEvent = null;
    document.addEventListener('engineering-pipe-segments-imported', (event) => {
      window.__pipeSegmentsImportedEvent = event.detail;
    }, { once: true });
  });
  await page.locator('.pipe-segments-file-input').first().setInputFiles(importPath);

  const imported = await page.waitForFunction(() => {
    const model = window.__npshGlobalModel || {};
    const firstSegment = model['PIPE-D']?.props?.segments?.[0];
    const eventDetail = window.__pipeSegmentsImportedEvent || null;
    if (firstSegment?.name !== 'Imported Seg-1 Long run' || !eventDetail) return false;
    return {
      eventDetail,
      firstSegment,
      segmentCount: model['PIPE-D'].props.segments.length,
      pumpFreshness: model.PUMP.results.calculationFreshness,
      pumpBackendStatus: model.PUMP.results.backendValidationStatus,
      realtime: window.__engineeringCalculationDefenseRealtimeState || null
    };
  }, null, { timeout: 10000 });
  const importedState = await imported.jsonValue();

  expect(importedState.segmentCount).toBe(2);
  expect(importedState.firstSegment.length).toBe(42);
  expect(importedState.firstSegment.diameter).toBeCloseTo(0.081, 6);
  expect(importedState.eventDetail.pipeId).toBe('PIPE-D');
  expect(importedState.eventDetail.segmentCount).toBe(2);
  expect(importedState.pumpFreshness).toBe('Stale');
  expect(importedState.pumpBackendStatus).toBe('Stale');
  expect(importedState.realtime.status).toBe('Stale');
  expect(importedState.realtime.reason).toContain('Pipe Segments imported from local file');

  await expect(page.locator('#pipeSegmentTable input.segment-input[data-field="name"]').first()).toHaveValue('Imported Seg-1 Long run');
  const displayedLength = await page.locator('#pipeSegmentTable input.segment-input[data-field="length"]').first().inputValue();
  expect(Number.parseFloat(displayedLength)).toBeCloseTo(42, 6);
  await expect(page.locator('.pipe-segments-file-status').first()).toContainText('Imported 2 segment(s). Solve is stale.');

  const screenshotPath = testInfo.outputPath('pipe-segments-import-export.png');
  await page.locator('.persistent-object-properties-task-window[data-kind="pipe"], .task-window[data-task-node-id="PIPE-D"]').first().screenshot({ path: screenshotPath });
  await testInfo.attach('pipe segments import export', { path: screenshotPath, contentType: 'image/png' });

  console.log(JSON.stringify({
    pipeSegmentsFileE2E: 'pass',
    exportedFilename: filename,
    exportedSegmentCount: exportedPayload.segmentCount,
    importedSegmentCount: importedState.segmentCount,
    staleStatus: importedState.realtime.status,
    screenshotPath
  }, null, 2));
});
