const { test, expect } = require('@playwright/test');

function createPipe(name, { length = 8, diameter = 0.08, fittingK = 0, segments = null } = {}) {
  return {
    type: 'pipe',
    name,
    props: {
      routeStyle: 'Straight',
      elevationProfileMode: 'End Elevations',
      roughnessAgingFactor: 1,
      headLossAllowancePercent: 0,
      segments: segments || [
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

function overlappingDischargeSegments() {
  return Array.from({ length: 6 }, (_, index) => ({
    name: `Overlap element ${index + 1}`,
    pipeSize: 'Custom diameter',
    material: 'Custom roughness',
    diameter: 0.0738,
    length: index === 0 ? 10 : 0,
    roughness: 0.00015,
    fittingType: 'Custom K',
    fittingQuantity: 1,
    fittingK: index === 0 ? 0.5 : 2,
    minorLoss: 0
  }));
}

function baseProject({ sinkElevation = 0, sinkPressure = 1.01325 } = {}) {
  const model = {
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
    'PIPE-S': createPipe('Suction pipe', { length: 8, diameter: 0.08, fittingK: 1 }),
    P: {
      type: 'pump',
      name: 'P',
      props: {
        inputMode: 'Basic',
        npshrSourceMode: 'Estimated',
        curveDataSource: 'Engineering Fit',
        npshAssessmentMode: 'Screening',
        npshMarginBasis: 'User Defined',
        designFlow: 50,
        bepFlow: 50,
        designHead: 35,
        designEfficiency: 70,
        designNpshr: 3,
        porMinPercent: 70,
        porMaxPercent: 120,
        aorMinPercent: 50,
        aorMaxPercent: 130,
        minNpshMarginRatio: 1.1,
        minNpshMargin: 0.5,
        suctionElevation: 0,
        dischargeElevation: 0,
        curveData: []
      },
      results: {}
    },
    'PIPE-D': createPipe('Discharge overlap pipe', {
      diameter: 0.0738,
      segments: overlappingDischargeSegments()
    }),
    SNK: {
      type: 'sink',
      name: 'SNK',
      props: {
        active: 'Active',
        boundaryMode: 'Outlet Pressure Boundary',
        pressureInputBasis: 'Absolute',
        pressure: sinkPressure,
        pressureBasis: 'Static',
        elevation: sinkElevation,
        demandFlow: 50
      },
      results: {}
    }
  };

  return {
    projectFile: { sourceFormat: 'playwright-e2e' },
    model,
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

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    typeof window.applySimulationStateAtomic === 'function'
    && typeof window.updateSimulation === 'function'
    && window.EngineeringDefenseExportPackage?.schemaVersion === 'defense-export-package.v1'
    && window.EngineeringPipePropertiesCleanupRuntime?.version === 'engineering-pipe-properties-cleanup-runtime.v1'
    && window.EngineeringPipeMoodyChartAudit?.version === 'engineering-pipe-moody-chart-audit.v7'
    && window.__npshRouteTraceAuditInstalled?.fetchSimulation
  ), null, { timeout: 30000 });
}

async function loadProject(page, project) {
  await page.evaluate((projectState) => {
    window.applySimulationStateAtomic(JSON.stringify(projectState));
  }, project);
  await expect(page.locator('#obj-snk')).toBeVisible();
}

async function runProtectedSolve(page, { previousCalculationId = null } = {}) {
  const responsePromise = page.waitForResponse((response) => (
    /\/api\/simulate(?:[?#]|$)/.test(response.url())
    && response.request().method() === 'POST'
    && response.status() === 200
  ), { timeout: 30000 });
  const solvePromise = page.evaluate(() => window.updateSimulation({
    refreshReason: 'solve',
    trigger: 'solve',
    forceBackend: true,
    renderSidebarAfter: false
  }));
  const response = await responsePromise;
  const body = await response.json();
  await solvePromise;
  const active = await page.waitForFunction(({ previousId, responseId }) => {
    const pumpResults = window.__npshGlobalModel?.P?.results || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const calculationId = pumpResults.calculationAudit?.calculationId || state.calculationId || responseId;
    const current = state.status === 'Current' && pumpResults.dependencyManifest;
    if (!current || !calculationId) return false;
    if (previousId && calculationId === previousId) return false;
    if (!previousId && responseId && state.calculationId && state.calculationId !== responseId) return false;
    return {
      calculationId,
      dependencyFingerprint: pumpResults.dependencyManifest?.dependencyFingerprint || state.dependencyFingerprint || null
    };
  }, { previousId: previousCalculationId, responseId: body.calculationId }, { timeout: 12000 });
  const activePayload = await active.jsonValue();
  return {
    ...body,
    calculationId: activePayload.calculationId || body.calculationId,
    activeCalculationId: activePayload.calculationId || null,
    activeDependencyFingerprint: activePayload.dependencyFingerprint || null
  };
}

async function runPipePropertiesSolveRefresh(page) {
  const responsePromise = page.waitForResponse((response) => (
    /\/api\/simulate(?:[?#]|$)/.test(response.url())
    && response.request().method() === 'POST'
    && response.status() === 200
  ), { timeout: 30000 });
  const solvePromise = page.evaluate(() => window.updateSimulation({
    refreshReason: 'solve',
    trigger: 'solve',
    forceBackend: true,
    renderSidebarAfter: true
  }));
  const response = await responsePromise;
  await solvePromise;
  await response.json();
}

async function copyPipeNodeResultsIntoBrowser(page, response, pipeIds = []) {
  await page.evaluate((body) => {
    const model = window.__npshGlobalModel || {};
    Object.entries(body.nodeResults || {}).forEach(([id, node]) => {
      if (!model[id]) return;
      if (model[id].type !== 'pipe') return;
      if (Array.isArray(body.pipeIds) && body.pipeIds.length && !body.pipeIds.includes(id)) return;
      model[id].results = {
        ...(model[id].results || {}),
        ...(node.results || {})
      };
    });
  }, { ...response, pipeIds });
}

async function changeSinkBoundaryInBrowser(page, { elevation, pressure }) {
  return page.evaluate(({ elevation: nextElevation, pressure: nextPressure }) => {
    const model = window.__npshGlobalModel;
    model.SNK.props.elevation = nextElevation;
    model.SNK.props.pressure = nextPressure;

    const taskWindow = document.createElement('section');
    taskWindow.className = 'task-window';
    taskWindow.dataset.taskNodeId = 'SNK';
    taskWindow.dataset.node = 'SNK';

    const elevationInput = document.createElement('input');
    elevationInput.name = 'elevation';
    elevationInput.dataset.key = 'elevation';
    elevationInput.dataset.node = 'SNK';
    elevationInput.value = String(nextElevation);

    const pressureInput = document.createElement('input');
    pressureInput.name = 'pressure';
    pressureInput.dataset.key = 'pressure';
    pressureInput.dataset.node = 'SNK';
    pressureInput.value = String(nextPressure);

    taskWindow.append(elevationInput, pressureInput);
    document.body.appendChild(taskWindow);
    elevationInput.dispatchEvent(new Event('input', { bubbles: true }));
    pressureInput.dispatchEvent(new Event('change', { bubbles: true }));
    taskWindow.remove();

    return {
      realtime: window.__engineeringCalculationDefenseRealtimeState || null,
      freshness: model.P.results.calculationFreshness || null
    };
  }, { elevation, pressure });
}

async function defenseGateSnapshot(page) {
  return page.evaluate(() => {
    const payload = window.EngineeringDefenseExportPackage?.activeDefensePayload?.() || {};
    const gate = window.EngineeringDefenseExportPackage?.defenseExportGate?.(payload) || null;
    const pumpResults = payload.pumpNode?.results || {};
    return {
      gate,
      realtime: window.__engineeringCalculationDefenseRealtimeState || null,
      pump: {
        calculationFreshness: pumpResults.calculationFreshness || null,
        backendValidationStatus: pumpResults.backendValidationStatus || null,
        isCalculationStale: pumpResults.isCalculationStale === true,
        previousResultWasStale: pumpResults.previousResultWasStale === true
      },
      calculationAudit: {
        calculationId: payload.calculationAudit?.calculationId || null,
        freshness: payload.calculationAudit?.freshness || null
      },
      calculationDefenseContract: {
        status: payload.calculationDefenseContract?.status || null,
        freshness: payload.calculationDefenseContract?.freshness || null,
        staleStatus: payload.calculationDefenseContract?.staleStatus || null,
        freshnessStatus: payload.calculationDefenseContract?.freshnessStatus || null
      },
      dependencyManifest: {
        dependencyFingerprint: payload.dependencyManifest?.dependencyFingerprint || null,
        freshness: payload.dependencyManifest?.freshness || null,
        isStale: payload.dependencyManifest?.isStale === true,
        priorResultStale: payload.dependencyManifest?.priorResultStale === true
      }
    };
  });
}

test('Moody chart audit panel stays hidden on first browser load until opened explicitly', async ({ page }) => {
  await waitForNpshApp(page);
  await page.waitForTimeout(700);

  const bootState = await page.evaluate(() => {
    const panel = document.getElementById('engineeringPipeMoodyChartPanel');
    const scriptCount = [...document.scripts]
      .filter((script) => /engineering-pipe-moody-chart-audit\.js/.test(script.src || ''))
      .length;
    const display = panel ? getComputedStyle(panel).display : null;
    return {
      panelExists: !!panel,
      hiddenAttribute: panel?.hasAttribute('hidden') || false,
      hiddenProperty: panel?.hidden === true,
      display,
      visible: !!panel && display !== 'none' && panel.hidden !== true,
      scriptCount
    };
  });

  expect(bootState.scriptCount).toBe(1);
  expect(bootState.visible).toBe(false);
  if (bootState.panelExists) {
    expect(bootState.hiddenAttribute).toBe(true);
    expect(bootState.hiddenProperty).toBe(true);
    expect(bootState.display).toBe('none');
  }
  await expect(page.locator('#engineeringPipeMoodyChartPanel')).toBeHidden();

  console.log(JSON.stringify({
    moodyDefaultHiddenE2E: 'pass',
    ...bootState
  }, null, 2));
});

test('Moody chart separates overlapped pipe/fitting/valve markers and keeps every tooltip name visible', async ({ page }, testInfo) => {
  await waitForNpshApp(page);
  await loadProject(page, baseProject());

  const response = await runProtectedSolve(page);
  const trace = response.nodeResults['PIPE-D']?.results?.calculationTrace;
  expect(trace?.moody?.markers?.length).toBeGreaterThanOrEqual(6);

  await copyPipeNodeResultsIntoBrowser(page, response, ['PIPE-D']);
  const renderResult = await page.evaluate(() => window.EngineeringPipeMoodyChartAudit.openMoodyChartPanel('PIPE-D'));
  expect(renderResult.overlapGroupCount).toBeGreaterThanOrEqual(1);
  expect(renderResult.markerCount).toBeGreaterThanOrEqual(6);

  const groupKey = await page.locator('.pipe-moody-marker[data-overlap-count="6"]').first().getAttribute('data-overlap-group');
  const markerInfo = await page.locator(`.pipe-moody-marker[data-overlap-group="${groupKey}"]`).evaluateAll((nodes) => nodes.map((node) => ({
    name: node.getAttribute('data-marker-name'),
    tooltip: node.getAttribute('data-tooltip'),
    cx: Number(node.getAttribute('cx')),
    cy: Number(node.getAttribute('cy')),
    title: node.querySelector('title')?.textContent || ''
  })));
  expect(markerInfo.length).toBe(6);
  expect(new Set(markerInfo.map((marker) => `${marker.cx.toFixed(1)},${marker.cy.toFixed(1)}`)).size).toBeGreaterThan(1);
  markerInfo.forEach((marker) => {
    expect(marker.tooltip).toContain('Overlap element 1');
    expect(marker.tooltip).toContain('Overlap element 6');
    expect(marker.title).toContain('Overlap element 3');
  });
  await expect(page.locator('.pipe-moody-overlap-card').first()).toContainText('6 overlapped elements separated visually');

  const screenshotPath = testInfo.outputPath('moody-overlap-visual.png');
  await page.locator('#engineeringPipeMoodyChartPanel').screenshot({ path: screenshotPath });
  await testInfo.attach('moody overlap visual', { path: screenshotPath, contentType: 'image/png' });

  console.log(JSON.stringify({
    moodyVisualE2E: 'pass',
    overlapCount: markerInfo.length,
    uniqueMarkerPositions: new Set(markerInfo.map((marker) => `${marker.cx.toFixed(1)},${marker.cy.toFixed(1)}`)).size,
    tooltipIncludesAll: markerInfo.every((marker) => /Overlap element 1/.test(marker.tooltip) && /Overlap element 6/.test(marker.tooltip)),
    screenshotPath
  }, null, 2));
});

test('Defense export actions are blocked while calculation is stale and restored after backend refresh', async ({ page }, testInfo) => {
  await waitForNpshApp(page);
  await loadProject(page, baseProject());

  const baseline = await runProtectedSolve(page);
  await page.evaluate(() => window.EngineeringDefenseExportPackage.openDefensePackagePanel());
  await expect(page.locator('.defense-export-stale-gate')).toHaveAttribute('data-export-ready', 'true');
  await expect(page.locator('[data-defense-package-action="json"]')).toBeEnabled();

  const staleSnapshot = await changeSinkBoundaryInBrowser(page, { elevation: 7, pressure: 1.45 });
  expect(staleSnapshot.realtime.status).toBe('Stale');
  await page.evaluate(() => window.EngineeringDefenseExportPackage.openDefensePackagePanel());
  await expect(page.locator('.defense-export-stale-gate')).toHaveAttribute('data-export-ready', 'false');
  await expect(page.locator('.defense-export-stale-gate')).toHaveAttribute('data-export-status', /Stale|Calculating/);
  await expect(page.locator('.defense-export-stale-gate')).toContainText(/stale|rerun backend solve|calculating|wait for current/i);
  await expect(page.locator('[data-defense-package-action="json"]')).toBeDisabled();
  await expect(page.locator('[data-defense-package-action="print"]')).toBeDisabled();

  const refreshed = await runProtectedSolve(page, { previousCalculationId: baseline.calculationId });
  await page.evaluate(() => window.EngineeringDefenseExportPackage.openDefensePackagePanel());
  const refreshedGate = await defenseGateSnapshot(page);
  console.log(JSON.stringify({ refreshedDefenseGateSnapshot: refreshedGate }, null, 2));
  await expect(page.locator('.defense-export-stale-gate')).toHaveAttribute('data-export-ready', 'true');
  await expect(page.locator('[data-defense-package-action="json"]')).toBeEnabled();
  expect(refreshed.calculationId).not.toBe(baseline.calculationId);

  const screenshotPath = testInfo.outputPath('defense-export-current-after-stale.png');
  await page.locator('#engineeringDefenseExportPackagePanel').screenshot({ path: screenshotPath });
  await testInfo.attach('defense export current after stale', { path: screenshotPath, contentType: 'image/png' });

  console.log(JSON.stringify({
    defenseExportStaleGateE2E: 'pass',
    baselineCalculationId: baseline.calculationId,
    refreshedCalculationId: refreshed.calculationId,
    staleObserved: staleSnapshot.realtime.status,
    exportRestored: true,
    screenshotPath
  }, null, 2));
});

test('unused Pipe Properties fields and segment z columns are removed', async ({ page }) => {
  await waitForNpshApp(page);
  await loadProject(page, baseProject());

  await page.evaluate(() => {
    window.currentSelectedNode = 'PIPE-D';
    window.__npshExplicitObjectPropertiesOpenUntil = Date.now() + 2000;
    if (typeof window.requestPipePropertiesTaskWindowOpen === 'function') {
      window.requestPipePropertiesTaskWindowOpen('PIPE-D');
    }
    if (typeof window.openPipePropertiesTaskWindow === 'function') {
      window.openPipePropertiesTaskWindow('PIPE-D');
    }
    const taskWindow = document.querySelector('.persistent-object-properties-task-window[data-kind="pipe"][data-node-id="PIPE-D"]')
      || document.querySelector('.task-window[data-task-node-id="PIPE-D"]')
      || document.querySelector('.persistent-object-properties-task-window[data-kind="pipe"]');
    if (typeof window.renderSidebar === 'function' && taskWindow) {
      window.renderSidebar('PIPE-D', { taskWindow, skipDismissedGuard: true });
    }
  });
  await page.waitForFunction(() => Boolean(
    document.querySelector('.persistent-object-properties-task-window[data-kind="pipe"][data-node-id="PIPE-D"]')
    || document.querySelector('.persistent-object-properties-task-window[data-kind="pipe"]')
    || document.querySelector('.task-window-pipe-active')
    || document.querySelector('#taskWindow[data-kind="pipe"]')
  ), null, { timeout: 10000 });
  await page.evaluate(() => window.EngineeringPipeMoodyChartAudit.refreshRemovedPipePropertyFields(document));
  await page.evaluate(() => window.EngineeringPipeMoodyChartAudit.refreshRemovedPipeSegmentColumns(document));

  const removedLabels = [
    'Pipe Routing',
    'Pipe Rating/Class',
    'End Connection Basis',
    'Elevation Profile',
    'Start Elevation Override',
    'End Elevation Override',
    'Head Loss Allowance',
    'Aging Roughness Factor'
  ];
  const removedKeys = [
    'routeStyle',
    'pressureClass',
    'endConnection',
    'elevationProfileMode',
    'startElevation',
    'endElevation',
    'headLossAllowancePercent',
    'roughnessAgingFactor'
  ];
  const removedFieldSnapshot = await page.evaluate(({ labels, keys }) => {
    const surfaces = Array.from(document.querySelectorAll(
      '.persistent-object-properties-task-window[data-kind="pipe"], .task-window-pipe-active, #taskWindow[data-kind="pipe"]'
    ));
    return {
      visibleLabels: labels.filter((label) => surfaces.some((surface) => new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(surface.textContent || ''))),
      visibleKeys: keys.filter((key) => surfaces.some((surface) => surface.querySelector(`[data-key="${key}"], [name="${key}"], [data-prop-key="${key}"]`)))
    };
  }, { labels: removedLabels, keys: removedKeys });
  const removedSegmentSnapshot = await page.evaluate(({ labels, keys }) => {
    const surfaces = Array.from(document.querySelectorAll(
      '.persistent-object-properties-task-window[data-kind="pipe"], .task-window-pipe-active, #taskWindow[data-kind="pipe"]'
    ));
    const tables = surfaces.flatMap((surface) => Array.from(surface.querySelectorAll('#pipeSegmentTable, table.segment-table')));
    const headers = tables.flatMap((table) => Array.from(table.querySelectorAll('th')).map((header) => String(header.textContent || '').trim()));
    return {
      visibleHeaders: labels.filter((label) => headers.some((header) => header.toLowerCase() === label.toLowerCase())),
      visibleKeys: keys.filter((key) => tables.some((table) => table.querySelector(`[data-field="${key}"], [data-key="${key}"], [name="${key}"]`)))
    };
  }, { labels: ['z in (m)', 'z out (m)'], keys: ['startElevation', 'endElevation'] });
  await expect(page.locator('.pipe-aging-roughness-help')).toHaveCount(0);
  expect(removedFieldSnapshot.visibleLabels).toEqual([]);
  expect(removedFieldSnapshot.visibleKeys).toEqual([]);
  expect(removedSegmentSnapshot.visibleHeaders).toEqual([]);
  expect(removedSegmentSnapshot.visibleKeys).toEqual([]);

  console.log(JSON.stringify({
    unusedPipeFieldsRemovedE2E: 'pass',
    helpCount: await page.locator('.pipe-aging-roughness-help').count(),
    removedFieldSnapshot,
    removedSegmentSnapshot
  }, null, 2));
});

test('unused Pipe Properties block does not flash during protected solve refresh', async ({ page }) => {
  await waitForNpshApp(page);
  await loadProject(page, baseProject());

  await page.evaluate(() => {
    window.currentSelectedNode = 'PIPE-D';
    window.__npshExplicitObjectPropertiesOpenUntil = Date.now() + 8000;
    window.openPipePropertiesTaskWindow?.('PIPE-D');
    const taskWindow = document.querySelector('.persistent-object-properties-task-window[data-kind="pipe"][data-node-id="PIPE-D"]')
      || document.querySelector('.persistent-object-properties-task-window[data-kind="pipe"]')
      || document.querySelector('.task-window[data-task-node-id="PIPE-D"]');
    if (taskWindow && typeof window.renderSidebar === 'function') {
      window.renderSidebar('PIPE-D', { taskWindow, skipDismissedGuard: true });
    }
    window.EngineeringPipePropertiesCleanupRuntime?.clean?.(document);
  });

  const removedLabels = [
    'Pipe Routing',
    'Pipe Rating/Class',
    'End Connection Basis',
    'Elevation Profile',
    'Start Elevation Override',
    'End Elevation Override',
    'Head Loss Allowance',
    'Aging Roughness Factor',
    'High Point P',
    'High Point Margin',
    'High Point Segment'
  ];

  await page.evaluate((labels) => {
    const surfaceSelector = '.persistent-object-properties-task-window[data-kind="pipe"], .task-window-pipe-active, #taskWindow[data-kind="pipe"]';
    const escaped = (label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isVisible = (node) => {
      if (!node || !node.isConnected) return false;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const visibleRemovedLabels = () => {
      const surfaces = Array.from(document.querySelectorAll(surfaceSelector)).filter(isVisible);
      return labels.filter((label) => surfaces.some((surface) => {
        const pattern = new RegExp(escaped(label), 'i');
        if (!pattern.test(surface.textContent || '')) return false;
        return Array.from(surface.querySelectorAll('*')).some((node) => isVisible(node) && pattern.test(node.textContent || ''));
      }));
    };
    window.__pipePropertiesFlashSamples = [];
    window.__pipePropertiesFlashSampler = window.setInterval(() => {
      const visible = visibleRemovedLabels();
      if (visible.length) {
        window.__pipePropertiesFlashSamples.push({ visible, at: performance.now() });
      }
      window.EngineeringPipePropertiesCleanupRuntime?.clean?.(document, { capture: false });
    }, 16);
  }, removedLabels);

  await runPipePropertiesSolveRefresh(page);
  await page.waitForTimeout(500);

  const flashSamples = await page.evaluate(() => {
    window.clearInterval(window.__pipePropertiesFlashSampler);
    window.EngineeringPipePropertiesCleanupRuntime?.clean?.(document, { capture: false });
    return window.__pipePropertiesFlashSamples || [];
  });

  expect(flashSamples).toEqual([]);

  console.log(JSON.stringify({
    unusedPipeFieldsNoFlashDuringSolveE2E: 'pass',
    flashSamples
  }, null, 2));
});
