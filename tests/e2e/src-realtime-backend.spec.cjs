const { test, expect } = require('@playwright/test');

const SOURCE_BOUNDARY_CHANGE = Object.freeze({
  elevation: -2,
  pressure: 1.2,
  temperature: 45
});

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

function baseProject() {
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
        temp: 25,
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
        curveData: [
          { flow: 0, head: 40, npshr: 2.4 },
          { flow: 50, head: 35, npshr: 3 },
          { flow: 100, head: 10, npshr: 6.2 }
        ]
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
        pressure: 1.01325,
        pressureBasis: 'Static',
        elevation: 0,
        demandFlow: 50
      },
      results: {}
    }
  };

  return {
    projectFile: {
      sourceFormat: 'playwright-e2e-src'
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
    && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v13'
    && window.__npshRouteTraceAuditInstalled?.payloadBuilder
    && window.__npshRouteTraceAuditInstalled?.fetchSimulation
    && window.__npshRouteTraceAuditInstalled?.primaryResultApplier
  ), null, { timeout: 25000 });
}

async function loadProject(page, project) {
  await page.evaluate((projectState) => {
    window.applySimulationStateAtomic(JSON.stringify(projectState));
  }, project);
  await expect(page.locator('#obj-src')).toBeVisible();
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
  await page.waitForFunction((calculationId) => {
    const pumpResults = window.__npshGlobalModel?.P?.results || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const activeId = pumpResults.calculationAudit?.calculationId
      || pumpResults.npshEvaluation?.calculationAudit?.calculationId
      || state.calculationId
      || null;
    return activeId === calculationId && !!pumpResults.dependencyManifest;
  }, body.calculationId, { timeout: 10000 });
  return body;
}

async function changeSourceBoundaryInBrowser(page, { elevation, pressure, temperature }) {
  return page.evaluate(({ elevation: nextElevation, pressure: nextPressure, temperature: nextTemperature }) => {
    window.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve = true;
    const model = window.__npshGlobalModel;
    model.SRC.props.elevation = nextElevation;
    model.SRC.props.pressure = nextPressure;
    model.SRC.props.temperatureMode = 'Custom';
    model.SRC.props.temp = nextTemperature;

    const taskWindow = document.createElement('section');
    taskWindow.className = 'task-window';
    taskWindow.dataset.taskNodeId = 'SRC';
    taskWindow.dataset.node = 'SRC';

    const elevationInput = document.createElement('input');
    elevationInput.name = 'elevation';
    elevationInput.dataset.key = 'elevation';
    elevationInput.dataset.node = 'SRC';
    elevationInput.value = String(nextElevation);

    const pressureInput = document.createElement('input');
    pressureInput.name = 'pressure';
    pressureInput.dataset.key = 'pressure';
    pressureInput.dataset.node = 'SRC';
    pressureInput.value = String(nextPressure);

    const tempInput = document.createElement('input');
    tempInput.name = 'temp';
    tempInput.dataset.key = 'temp';
    tempInput.dataset.node = 'SRC';
    tempInput.value = String(nextTemperature);

    taskWindow.append(elevationInput, pressureInput, tempInput);
    document.body.appendChild(taskWindow);
    elevationInput.dispatchEvent(new Event('input', { bubbles: true }));
    pressureInput.dispatchEvent(new Event('change', { bubbles: true }));
    tempInput.dispatchEvent(new Event('input', { bubbles: true }));
    taskWindow.remove();

    return {
      ...browserSnapshot(),
      allowSyntheticAutoSolve: window.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve === true,
      pendingAutoSolve: JSON.parse(JSON.stringify(window.__engineeringCalculationDefenseRealtimeAutoSolve || null))
    };
  }, { elevation, pressure, temperature });
}

async function browserSnapshotFromPage(page) {
  return page.evaluate(() => browserSnapshot());
}

function requiredPumpHead(response) {
  const step = response.results?.calculationTrace?.steps?.find((item) => /Required Pump Head/i.test(item.title || ''));
  return Number(step?.result);
}

function srcTraceStep(response) {
  return response.routeTrace?.steps?.find((step) => step.type === 'source') || {};
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.cloneForBrowser = (value) => JSON.parse(JSON.stringify(value || null));
    window.browserSnapshot = () => {
      const model = window.__npshGlobalModel || {};
      const pump = model.P || {};
      const source = model.SRC || {};
      const pumpResults = pump.results || {};
      const sourceResults = source.results || {};
      const response = window.__npshLastBackendSimulationResponse?.response || {};
      return {
        realtime: cloneForBrowser(window.__engineeringCalculationDefenseRealtimeState || null),
        pumpFreshness: pumpResults.calculationFreshness || null,
        pumpBackendValidationStatus: pumpResults.backendValidationStatus || null,
        pumpRouteFreshness: pumpResults.routeTrace?.lossFreshness || null,
        pumpDependencyFingerprint: pumpResults.dependencyManifest?.dependencyFingerprint || null,
        sourceFreshness: sourceResults.calculationFreshness || null,
        sourceProps: cloneForBrowser(source.props || {}),
        routeTraceText: pumpResults.routeTrace?.text || '',
        srcObjectAudit: cloneForBrowser(pumpResults.srcObjectAudit || response.srcObjectAudit || null),
        dependencyManifest: cloneForBrowser(pumpResults.dependencyManifest || response.dependencyManifest || null),
        lastResponse: {
          calculationId: response.calculationId || null,
          dependencyFingerprint: response.dependencyManifest?.dependencyFingerprint || null,
          priorResultStale: !!response.dependencyManifest?.priorResultStale,
          npsha: response.results?.npsha ?? null,
          npshr: response.results?.npshr ?? null,
          margin: response.results?.npshMargin ?? null,
          requiredPumpHead: response.results ? (response.results.calculationTrace?.steps || []).find((step) => /Required Pump Head/i.test(step.title || ''))?.result : null
        }
      };
    };
  });
});

test('SRC elevation, pressure, and temperature changes refresh protected backend trace in the browser', async ({ page }, testInfo) => {
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
  expect(requiredPumpHead(baseline)).toBeGreaterThan(0);
  expect(srcTraceStep(baseline).directNpshImpact).toBe(true);
  expect(baseline.srcObjectAudit.routeCalculation.directNpshImpact).toBe(true);
  expect(baseline.dependencyManifest.sourceBoundaryCoverage.status).toBe('pass');

  delayNextSimulation = true;
  const changedResponsePromise = page.waitForResponse((response) => (
    /\/api\/simulate(?:[?#]|$)/.test(response.url())
    && response.request().method() === 'POST'
    && response.status() === 200
  ), { timeout: 30000 });

  const staleSnapshot = await changeSourceBoundaryInBrowser(page, SOURCE_BOUNDARY_CHANGE);
  expect(staleSnapshot.realtime.status).toBe('Stale');
  expect(staleSnapshot.allowSyntheticAutoSolve).toBe(true);
  expect(staleSnapshot.pendingAutoSolve?.calculationMode).toBe('realtime-input');
  expect(staleSnapshot.pumpFreshness).toBe('Stale');
  expect(staleSnapshot.sourceProps.elevation).toBe(SOURCE_BOUNDARY_CHANGE.elevation);
  expect(staleSnapshot.sourceProps.pressure).toBe(SOURCE_BOUNDARY_CHANGE.pressure);
  expect(staleSnapshot.sourceProps.temperatureMode).toBe('Custom');

  const changedResponse = await changedResponsePromise;
  const changed = await changedResponse.json();
  await page.waitForFunction((calculationId) => (
    window.__engineeringCalculationDefenseRealtimeState?.status === 'Current'
    && window.__engineeringCalculationDefenseRealtimeState?.calculationId === calculationId
    && window.__npshGlobalModel?.P?.results?.dependencyManifest
  ), changed.calculationId, { timeout: 10000 });

  const changedSnapshot = await browserSnapshotFromPage(page);
  expect(changedSnapshot.realtime.status).toBe('Current');
  expect(changedSnapshot.realtime.calculationId).toBe(changed.calculationId);
  expect(['Current', 'Recalculated after stale input change']).toContain(changedSnapshot.pumpFreshness);
  expect(changedSnapshot.lastResponse.priorResultStale).toBe(true);

  expect(simulateRequests.length).toBeGreaterThanOrEqual(2);
  const changedPayload = simulateRequests[simulateRequests.length - 1].payload;
  expect(changedPayload?.client?.previousDependencyFingerprint).toBe(baseline.dependencyManifest.dependencyFingerprint);
  expect(Number(changedPayload?.model?.SRC?.props?.elevation)).toBe(SOURCE_BOUNDARY_CHANGE.elevation);
  expect(Number(changedPayload?.model?.SRC?.props?.pressure)).toBe(SOURCE_BOUNDARY_CHANGE.pressure);
  expect(changedPayload?.model?.SRC?.props?.temperatureMode).toBe('Custom');
  expect(Number(changedPayload?.model?.SRC?.props?.temp)).toBe(SOURCE_BOUNDARY_CHANGE.temperature);

  expect(changed.calculationId).not.toBe(baseline.calculationId);
  expect(changed.dependencyManifest.dependencyFingerprint).not.toBe(baseline.dependencyManifest.dependencyFingerprint);
  expect(changed.dependencyManifest.priorResultStale).toBe(true);
  expect(requiredPumpHead(changed)).not.toBe(requiredPumpHead(baseline));
  expect(Number(changed.results.flow)).not.toBe(Number(baseline.results.flow));
  expect(changed.routeTraceFingerprint).not.toBe(baseline.routeTraceFingerprint);
  expect(changed.results.npsha).not.toBe(baseline.results.npsha);
  expect(changed.results.npshr).toBe(baseline.results.npshr);
  expect(changed.results.npshMargin).toBe(baseline.results.npshMargin);

  const changedSrcStep = srcTraceStep(changed);
  expect(changedSrcStep.directNpshImpact).toBe(true);
  expect(changedSrcStep.systemHeadImpact).toBe(true);
  expect(changedSrcStep.audit.dependencyKeys).toContain('source.props.pressure');
  expect(changedSrcStep.audit.dependencyKeys).toContain('source.props.elevation');
  expect(changedSrcStep.audit.dependencyKeys).toContain('source.props.temp');
  expect(changedSrcStep.values.elevationM).toBe(SOURCE_BOUNDARY_CHANGE.elevation);
  expect(changedSrcStep.values.pressureBarA).toBe(SOURCE_BOUNDARY_CHANGE.pressure);

  const srcAudit = changed.srcObjectAudit;
  expect(srcAudit.routeCalculation.directNpshImpact).toBe(true);
  expect(srcAudit.routeCalculation.systemHeadImpact).toBe(true);
  expect(srcAudit.engineeringCalculation.substitutions.npsha).toMatch(/[0-9].*=.*m/);
  expect(srcAudit.engineeringCalculation.substitutions.npsha).not.toBe(baseline.srcObjectAudit.engineeringCalculation.substitutions.npsha);
  expect(srcAudit.engineeringCalculation.formulaDefenseExamples.sourceElevationChange).toMatch(/Delta NPSHA/i);
  expect(srcAudit.engineeringCalculation.formulaDefenseExamples.pumpCurveMode).toMatch(/H_pump_curve/i);
  expect(srcAudit.fluidBasisLink.temperatureMode).toBe('Custom');
  expect(srcAudit.fluidBasisLink.temperatureDegC).toBe(45);

  const sourceImpactText = JSON.stringify(changed.dependencyManifest.sourceImpactMatrix || []);
  expect(sourceImpactText).toMatch(/source\.props\.pressure/);
  expect(sourceImpactText).toMatch(/direct.*NPSHa|direct.*NPSHA/i);
  expect(changed.dependencyManifest.sourceBoundaryCoverage.status).toBe('pass');
  expect(changed.calculationDefenseContract.dependencyChain.sourceBoundaryCoverage.status).toBe('pass');

  const dependencyChainText = JSON.stringify(
    changed.dependencyManifest.dependencyChain || changed.routeTrace.dependencyChain || []
  );
  expect(dependencyChainText).toMatch(/SRC|suction pressure\/elevation boundary head/i);

  await page.evaluate(() => {
    const windowNode = document.createElement('section');
    windowNode.className = 'source-formula-defense-task-window';
    windowNode.dataset.sourceNodeId = 'SRC';
    windowNode.dataset.nodeId = 'SRC';
    const body = document.createElement('div');
    body.className = 'source-formula-defense-body';
    body.textContent = 'Source calculation trace is not available';
    windowNode.appendChild(body);
    document.body.appendChild(windowNode);
    window.EngineeringBilingualImprovements?.refreshSourceDefenseFallbacks?.(true);
  });
  const sourceDefenseBody = page.locator('.source-formula-defense-body').last();
  await expect(sourceDefenseBody).toContainText(/Backend Formula Substitution|Substitusi Formula Backend/);
  await expect(sourceDefenseBody).toContainText(changed.calculationId);
  await expect(sourceDefenseBody).toContainText(/NPSHA = H_SRC/);
  await expect(sourceDefenseBody).toContainText(/Direct NPSHA boundary impact|Direct impact boundary NPSHA/);

  const screenshotPath = testInfo.outputPath('src-realtime-after-change.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('src realtime after change', {
    path: screenshotPath,
    contentType: 'image/png'
  });

  console.log(JSON.stringify({
    srcRealtimeE2E: 'pass',
    backendCalls: simulateRequests.length,
    baseline: {
      calculationId: baseline.calculationId,
      dependencyFingerprint: baseline.dependencyManifest.dependencyFingerprint,
      requiredPumpHead: requiredPumpHead(baseline),
      flow: baseline.results.flow,
      npsha: baseline.results.npsha,
      npshr: baseline.results.npshr
    },
    changed: {
      calculationId: changed.calculationId,
      dependencyFingerprint: changed.dependencyManifest.dependencyFingerprint,
      priorResultStale: changed.dependencyManifest.priorResultStale,
      requiredPumpHead: requiredPumpHead(changed),
      flow: changed.results.flow,
      npsha: changed.results.npsha,
      npshr: changed.results.npshr
    },
    statesObserved: {
      stale: staleSnapshot.realtime.status,
      final: changedSnapshot.realtime.status
    },
    routeTraceChanged: changed.routeTraceFingerprint !== baseline.routeTraceFingerprint,
    formulaDefenseChanged: srcAudit.engineeringCalculation.substitutions.npsha !== baseline.srcObjectAudit.engineeringCalculation.substitutions.npsha,
    dependencyChainRows: (changed.dependencyManifest.dependencyChain || changed.routeTrace.dependencyChain || []).length,
    screenshotPath
  }, null, 2));
});
