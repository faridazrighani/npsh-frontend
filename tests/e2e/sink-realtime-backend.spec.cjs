const { test, expect } = require('@playwright/test');

function createPipe(name, length, diameter = 0.08, fittingK = 0) {
  return {
    type: 'pipe',
    name,
    props: {
      routeStyle: 'Straight',
      elevationProfileMode: 'End Elevations',
      segments: [
        {
          name,
          pipeSize: 'Custom diameter',
          material: 'Commercial steel',
          diameter,
          length,
          roughness: 0.000045,
          fittingType: fittingK > 0 ? 'User-defined K' : 'None',
          fittingQuantity: fittingK > 0 ? 1 : 0,
          fittingK,
          minorLoss: fittingK
        }
      ]
    }
  };
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
        viscosity: 0.893,
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
        pressure: 1.01325,
        pressureEnergyBasis: 'Static Pressure',
        elevation: 0,
        temperatureMode: 'Use Fluid Basis',
        flowInputMode: 'Solve from Network',
        flow: 0,
        massFlow: 0
      }
    },
    'PIPE-S': createPipe('Suction pipe', 8, 0.08, 1),
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
    'PIPE-D': createPipe('Discharge pipe', 35, 0.08, 5),
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
    projectFile: {
      sourceFormat: 'playwright-e2e'
    },
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
    && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v2'
    && window.__npshRouteTraceAuditInstalled?.payloadBuilder
    && window.__npshRouteTraceAuditInstalled?.fetchSimulation
    && window.__npshRouteTraceAuditInstalled?.primaryResultApplier
  ), null, { timeout: 25000 });
}

async function loadProject(page, project) {
  await page.evaluate((projectState) => {
    window.applySimulationStateAtomic(JSON.stringify(projectState));
  }, project);
  await expect(page.locator('#obj-snk')).toBeVisible();
}

async function runProtectedSolve(page) {
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
  await page.waitForFunction((calculationId) => (
    window.__engineeringCalculationDefenseRealtimeState?.calculationId === calculationId
    && window.__npshGlobalModel?.P?.results?.dependencyManifest
  ), body.calculationId, { timeout: 10000 });
  return body;
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

    return browserSnapshot();
  }, { elevation, pressure });
}

async function browserSnapshotFromPage(page) {
  return page.evaluate(() => browserSnapshot());
}

function systemHead(response) {
  const step = response.results?.calculationTrace?.steps?.find((item) => item.title === 'System Curve Head');
  return Number(step?.result);
}

function formulaDefenseRow(response, stepName) {
  return (response.results?.calculationTrace?.academicFormulaDefenseRows || [])
    .find((row) => row.step === stepName) || {};
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.browserSnapshot = () => {
      const model = window.__npshGlobalModel || {};
      const pump = model.P || {};
      const sink = model.SNK || {};
      const pumpResults = pump.results || {};
      const sinkResults = sink.results || {};
      const response = window.__npshLastBackendSimulationResponse?.response || {};
      return {
        realtime: cloneForBrowser(window.__engineeringCalculationDefenseRealtimeState || null),
        pumpFreshness: pumpResults.calculationFreshness || null,
        pumpBackendValidationStatus: pumpResults.backendValidationStatus || null,
        pumpRouteFreshness: pumpResults.routeTrace?.lossFreshness || null,
        pumpDependencyFingerprint: pumpResults.dependencyManifest?.dependencyFingerprint || null,
        sinkFreshness: sinkResults.calculationFreshness || null,
        sinkProps: cloneForBrowser(sink.props || {}),
        routeTraceText: pumpResults.routeTrace?.text || '',
        formulaRows: cloneForBrowser(pumpResults.npshEvaluation?.calculationTrace?.academicFormulaDefenseRows || []),
        dependencyManifest: cloneForBrowser(pumpResults.dependencyManifest || null),
        lastResponse: {
          calculationId: response.calculationId || null,
          dependencyFingerprint: response.dependencyManifest?.dependencyFingerprint || null,
          priorResultStale: !!response.dependencyManifest?.priorResultStale
        }
      };
    };

    window.cloneForBrowser = (value) => JSON.parse(JSON.stringify(value || null));
  });
});

test('SINK elevation and pressure changes refresh protected backend trace in the browser', async ({ page }, testInfo) => {
  const simulateRequests = [];
  let delayNextSimulation = false;

  await page.route('**/api/simulate', async (route) => {
    const request = route.request();
    let payload = null;
    try {
      payload = JSON.parse(request.postData() || '{}');
    } catch {
      payload = null;
    }
    simulateRequests.push({
      url: request.url(),
      method: request.method(),
      payload
    });
    if (delayNextSimulation) {
      delayNextSimulation = false;
      await new Promise((resolve) => setTimeout(resolve, 450));
    }
    await route.continue();
  });

  await waitForNpshApp(page);
  await loadProject(page, baseProject());

  const baseline = await runProtectedSolve(page);
  const baselineSnapshot = await browserSnapshotFromPage(page);
  expect(baselineSnapshot.realtime.status).toBe('Current');
  expect(baselineSnapshot.pumpFreshness).toBe('Current');
  expect(systemHead(baseline)).toBeGreaterThan(0);

  const staleSnapshot = await changeSinkBoundaryInBrowser(page, {
    elevation: 10,
    pressure: 1.5
  });
  expect(staleSnapshot.realtime.status).toBe('Stale');
  expect(staleSnapshot.pumpFreshness).toBe('Stale');
  expect(staleSnapshot.sinkFreshness).toBe('Stale');
  expect(staleSnapshot.pumpRouteFreshness).toContain('Stale');

  delayNextSimulation = true;
  const changedResponsePromise = page.waitForResponse((response) => (
    /\/api\/simulate(?:[?#]|$)/.test(response.url())
    && response.request().method() === 'POST'
    && response.status() === 200
  ), { timeout: 30000 });
  const changedSolvePromise = page.evaluate(() => window.updateSimulation({
    refreshReason: 'solve',
    trigger: 'solve',
    forceBackend: true,
    renderSidebarAfter: false
  }));

  await page.waitForFunction(() => (
    window.__engineeringCalculationDefenseRealtimeState?.status === 'Calculating'
    && window.__npshGlobalModel?.P?.results?.backendValidationStatus === 'Calculating'
  ), null, { timeout: 10000 });
  const calculatingSnapshot = await browserSnapshotFromPage(page);
  expect(calculatingSnapshot.pumpFreshness).toBe('Calculating');
  expect(calculatingSnapshot.pumpBackendValidationStatus).toBe('Calculating');
  expect(calculatingSnapshot.pumpRouteFreshness).toContain('Calculating');

  const changedResponse = await changedResponsePromise;
  const changed = await changedResponse.json();
  await changedSolvePromise;

  const changedSnapshot = await browserSnapshotFromPage(page);
  expect(changedSnapshot.realtime.status).toBe('Current');
  expect(changedSnapshot.realtime.calculationId).toBe(changed.calculationId);
  expect(changedSnapshot.pumpFreshness).toBe('Current');
  expect(changedSnapshot.lastResponse.priorResultStale).toBe(true);

  expect(simulateRequests.length).toBeGreaterThanOrEqual(2);
  const changedPayload = simulateRequests[simulateRequests.length - 1].payload;
  expect(changedPayload?.client?.previousDependencyFingerprint).toBe(baseline.dependencyManifest.dependencyFingerprint);
  expect(Number(changedPayload?.model?.SNK?.props?.elevation)).toBe(10);
  expect(Number(changedPayload?.model?.SNK?.props?.pressure)).toBe(1.5);

  expect(changed.calculationId).not.toBe(baseline.calculationId);
  expect(changed.dependencyManifest.dependencyFingerprint).not.toBe(baseline.dependencyManifest.dependencyFingerprint);
  expect(changed.dependencyManifest.priorResultStale).toBe(true);
  expect(systemHead(changed)).toBeGreaterThan(systemHead(baseline));
  expect(Number(changed.results.flow)).toBeLessThan(Number(baseline.results.flow));
  expect(changed.routeTraceFingerprint).not.toBe(baseline.routeTraceFingerprint);

  const sinkStep = changed.routeTrace.steps.find((step) => step.type === 'sink');
  expect(sinkStep.systemHeadImpact).toBe(true);
  expect(sinkStep.directNpshImpact).toBe(false);
  expect(sinkStep.audit.dependencyKeys).toContain('sink.props.elevation');
  expect(sinkStep.audit.dependencyKeys.some((key) => key.startsWith('sink.props.pressure'))).toBe(true);

  const staticHeadRow = formulaDefenseRow(changed, 'System Static Head');
  const curveHeadRow = formulaDefenseRow(changed, 'System Curve Head');
  expect(JSON.stringify(staticHeadRow)).toMatch(/SNK|sink/i);
  expect(JSON.stringify(curveHeadRow)).toMatch(/SNK|sink|System/i);

  const dependencyChainText = JSON.stringify(
    changed.dependencyManifest.dependencyChain || changed.routeTrace.dependencyChain || []
  );
  expect(dependencyChainText).toMatch(/SNK|sink\.props\.elevation|sink\.props\.pressure/i);
  expect(changed.dependencyManifest.sinkImpactMatrix.find((row) => row.fieldName === 'sink.props.elevation')?.currentImplementationStatus).toBe('OK');
  expect(changed.dependencyManifest.sinkImpactMatrix.find((row) => row.fieldName === 'sink.props.pressure')?.directNpshaImpact).toBe('none');

  const screenshotPath = testInfo.outputPath('sink-realtime-after-change.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('sink realtime after change', {
    path: screenshotPath,
    contentType: 'image/png'
  });

  console.log(JSON.stringify({
    sinkRealtimeE2E: 'pass',
    backendCalls: simulateRequests.length,
    baseline: {
      calculationId: baseline.calculationId,
      dependencyFingerprint: baseline.dependencyManifest.dependencyFingerprint,
      systemHead: systemHead(baseline),
      flow: baseline.results.flow
    },
    changed: {
      calculationId: changed.calculationId,
      dependencyFingerprint: changed.dependencyManifest.dependencyFingerprint,
      priorResultStale: changed.dependencyManifest.priorResultStale,
      systemHead: systemHead(changed),
      flow: changed.results.flow
    },
    statesObserved: {
      stale: staleSnapshot.realtime.status,
      calculating: calculatingSnapshot.realtime.status,
      final: changedSnapshot.realtime.status
    },
    routeTraceChanged: changed.routeTraceFingerprint !== baseline.routeTraceFingerprint,
    formulaDefenseChanged: String(staticHeadRow.result) !== String(formulaDefenseRow(baseline, 'System Static Head').result),
    dependencyChainRows: (changed.dependencyManifest.dependencyChain || changed.routeTrace.dependencyChain || []).length,
    screenshotPath
  }, null, 2));
});
