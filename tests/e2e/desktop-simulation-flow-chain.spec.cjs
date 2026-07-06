const path = require('node:path');
const { test, expect } = require('@playwright/test');

const frontendRoot = path.resolve(__dirname, '../..');
const apiRoot = path.resolve(frontendRoot, '..', 'npsh-api');
const { runBackendNpshSimulation } = require(path.join(apiRoot, 'server/src/engine/frontend-npsh-engine.cjs'));

const CASE = Object.freeze({
  pumpId: 'P-100',
  sourceId: 'SRC-100',
  sinkId: 'SNK-100',
  suctionPipeId: 'PIPE-1',
  dischargePipeId: 'PIPE-2'
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundMetric(value, digits = 6) {
  const number = finiteOrNull(value);
  return number === null ? null : Number(number.toFixed(digits));
}

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.applySimulationStateAtomic === 'function'
    && typeof window.updateSimulation === 'function'
    && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v13'
    && window.CanvasContextDock?.version === 'engineering-canvas-context-dock.v4'
    && window.EngineeringRouteTraceAudit?.version
    && window.EngineeringDefenseExportPackage?.schemaVersion === 'defense-export-package.v1'
    && window.NPSHSourceTemperatureRuntime?.syncFluidBasisPropertiesFromTemperature
  ), null, { timeout: 30000 });
}

async function loadSyntheticProject(page, options = {}) {
  await page.evaluate((config) => {
    const numeric = (value, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    };
    const makePipe = (name, diameter, length, fittingK, roughness = 0.0000457) => ({
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
            roughness,
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
            roughness,
            fittingType: 'Custom K',
            fittingQuantity: fittingK > 0 ? 1 : 0,
            fittingK,
            minorLoss: 0
          }
        ]
      },
      results: {}
    });

    const manualNpshr = config.manualNpshr === undefined ? 2 : config.manualNpshr;
    const model = {
      FLUID: {
        type: 'fluid',
        name: 'Fluid Basis',
        props: {
          fluidName: 'Water',
          temp: numeric(config.temperature, 40)
        },
        results: {}
      },
      'SRC-100': {
        type: 'source',
        name: 'SRC-100',
        props: {
          pressureInputBasis: 'Absolute',
          pressureBasis: 'Static',
          pressure: numeric(config.sourcePressure, 1.5),
          elevation: numeric(config.sourceElevation, 1),
          flowInputMode: 'Volumetric Flow',
          volumetricFlow: numeric(config.flow, 30),
          flow: numeric(config.flow, 30)
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
          manualNpshr,
          designNpshr: manualNpshr === '' ? 9.9 : manualNpshr,
          npshrSourceMode: 'Manual',
          designFlow: numeric(config.flow, 30),
          designHead: 20,
          designEfficiency: 70,
          bepFlow: numeric(config.flow, 30),
          porMinPercent: 70,
          porMaxPercent: 120,
          aorMinPercent: 50,
          aorMaxPercent: 130,
          minNpshMarginRatio: 1.1,
          minNpshMargin: 1
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
          pressure: numeric(config.sinkPressure, 1.2),
          elevation: numeric(config.sinkElevation, 5),
          demandFlow: numeric(config.flow, 30)
        },
        results: {}
      }
    };

    window.NPSHSourceTemperatureRuntime.syncFluidBasisPropertiesFromTemperature(model.FLUID);
    window.applySimulationStateAtomic(JSON.stringify({
      projectFile: { sourceFormat: 'synthetic-current-layout-e2e' },
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
  }, options);

  await page.waitForFunction(({ pumpId, sourceId, sinkId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return !!(model[pumpId] && model[sourceId] && model[sinkId]);
  }, CASE, { timeout: 15000 });
  await expect(page.locator('body')).toContainText(CASE.sinkId, { timeout: 15000 });
  return CASE;
}

async function runProtectedSolve(page, caseData, { expectedPreviousId = null } = {}) {
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
  await page.waitForFunction(({ pumpId, calculationId, expectedPreviousId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pumpResults = model[pumpId]?.results || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const activeId = pumpResults.calculationAudit?.calculationId || state.calculationId || null;
    if (!activeId || activeId !== calculationId) return false;
    if (expectedPreviousId && activeId === expectedPreviousId) return false;
    return state.status === 'Current' && !!pumpResults.dependencyManifest?.dependencyFingerprint;
  }, {
    pumpId: caseData.pumpId,
    calculationId: body.calculationId,
    expectedPreviousId
  }, { timeout: 15000 });
  return body;
}

async function collectUiProjectState(page) {
  return page.evaluate(() => {
    const copyObject = (value) => JSON.parse(JSON.stringify(value || {}));
    const copyArray = (value) => JSON.parse(JSON.stringify(Array.isArray(value) ? value : []));
    let state = null;
    try {
      state = typeof window.getSimulationState === 'function'
        ? JSON.parse(window.getSimulationState())
        : null;
    } catch {
      state = null;
    }
    return {
      projectFile: { sourceFormat: 'synthetic-current-layout-e2e-snapshot' },
      model: copyObject(state?.model || window.__npshGlobalModel || window.globalModel || {}),
      connections: copyArray(state?.connections || window.__npshConnections || window.connections),
      sourceLinks: copyArray(state?.sourceLinks || window.sourceLinks),
      instrumentLinks: copyArray(state?.instrumentLinks || window.instrumentLinks)
    };
  });
}

function runDirectBackendSimulation(projectState, pumpId) {
  return runBackendNpshSimulation({
    model: clone(projectState.model || {}),
    connections: clone(projectState.connections || []),
    sourceLinks: clone(projectState.sourceLinks || []),
    instrumentLinks: clone(projectState.instrumentLinks || []),
    selectedPumpId: pumpId,
    client: {
      protectedFrontend: true,
      mode: 'primary'
    }
  }, {
    projectRoot: apiRoot,
    pumpId
  });
}

function temperatureSummaryFromSimulation(simulation) {
  const result = simulation?.results || simulation?.result || simulation || {};
  const trace = result.calculationTrace || {};
  const basis = trace.basis || {};
  const systemHeadTrace = trace.systemHead || {};
  const routeTrace = simulation?.routeTrace || {};
  const suctionSection = routeTrace.sections?.suction || {};
  const dischargeSection = routeTrace.sections?.discharge || {};
  return {
    temperature: roundMetric(basis.temperature),
    rho: roundMetric(basis.density),
    viscosity: roundMetric(basis.viscosity),
    pvap: roundMetric(basis.vaporPressureBarA),
    hLSuction: roundMetric(result.suctionLoss ?? systemHeadTrace.suctionLoss ?? suctionSection.totalLossM),
    hLDischarge: roundMetric(result.dischargeLoss ?? systemHeadTrace.dischargeLoss ?? dischargeSection.totalLossM),
    hRequired: roundMetric(result.requiredSystemHead ?? systemHeadTrace.requiredHead),
    npsha: roundMetric(result.npsha),
    margin: roundMetric(result.npshMargin)
  };
}

function expectFiniteTemperatureSummary(summary, label) {
  for (const key of ['rho', 'viscosity', 'pvap', 'hLSuction', 'hLDischarge', 'hRequired', 'npsha', 'margin']) {
    expect(Number.isFinite(summary[key]), `${label}.${key} should be finite`).toBe(true);
  }
}

function expectTemperatureSummaryClose(actual, expected, label) {
  const tolerances = {
    rho: 0.002,
    viscosity: 0.0005,
    pvap: 0.0005,
    hLSuction: 0.002,
    hLDischarge: 0.002,
    hRequired: 0.002,
    npsha: 0.002,
    margin: 0.002
  };
  for (const [key, tolerance] of Object.entries(tolerances)) {
    expect(Math.abs(actual[key] - expected[key]), `${label}.${key}`).toBeLessThanOrEqual(tolerance);
  }
}

function formulaRow(responseBody, stepName) {
  const accepted = {
    'System Curve Head': ['System Curve Head', 'Required Pump Head', 'Route System Head'],
    'Expanded NPSHA': ['Expanded NPSHA', 'NPSHa']
  }[stepName] || [stepName];
  return (responseBody.results?.calculationTrace?.academicFormulaDefenseRows || [])
    .find((item) => accepted.includes(item.step)) || {};
}

function systemHead(responseBody) {
  return Number(formulaRow(responseBody, 'System Curve Head').result);
}

async function changeSinkBoundaryInBrowser(page, caseData, { elevation, pressure }) {
  return page.evaluate(({ sinkId, elevation: nextElevation, pressure: nextPressure }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const sink = model[sinkId];
    if (!sink) throw new Error(`Missing sink ${sinkId}`);
    sink.props.elevation = nextElevation;
    sink.props.pressure = nextPressure;
    sink.props.pressureInputBasis = 'Absolute';

    const taskWindow = document.querySelector(`.task-window[data-task-node-id="${sinkId}"], .persistent-object-properties-task-window[data-node-id="${sinkId}"]`)
      || document.createElement('section');
    taskWindow.classList.add('task-window');
    taskWindow.dataset.taskNodeId = sinkId;
    taskWindow.dataset.node = sinkId;
    if (!taskWindow.isConnected) document.body.appendChild(taskWindow);

    const ensureInput = (name, value) => {
      let input = taskWindow.querySelector(`input[name="${name}"], input[data-key="${name}"]`);
      if (!input) {
        input = document.createElement('input');
        input.name = name;
        input.dataset.key = name;
        input.dataset.node = sinkId;
        taskWindow.appendChild(input);
      }
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    ensureInput('elevation', nextElevation);
    ensureInput('pressure', nextPressure);
    window.CanvasContextDock?.refresh?.();

    return {
      realtime: JSON.parse(JSON.stringify(window.__engineeringCalculationDefenseRealtimeState || null)),
      sinkProps: JSON.parse(JSON.stringify(sink.props || {})),
      pumpFreshness: Object.values(model).find((node) => node?.type === 'pump')?.results?.calculationFreshness || null
    };
  }, {
    sinkId: caseData.sinkId,
    elevation,
    pressure
  });
}

async function browserSnapshot(page, caseData) {
  return page.evaluate(({ pumpId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[pumpId] || {};
    const pumpResults = pump.results || {};
    const response = window.__npshLastBackendSimulationResponse?.response || {};
    const auditPayload = window.EngineeringRouteTraceAudit?.activeAuditPayload?.() || {};
    const dock = window.CanvasContextDock?.buildDockState?.() || null;
    return {
      bodyText: document.body.innerText,
      dock,
      realtime: JSON.parse(JSON.stringify(window.__engineeringCalculationDefenseRealtimeState || null)),
      pump: {
        calculationFreshness: pumpResults.calculationFreshness || null,
        backendValidationStatus: pumpResults.backendValidationStatus || null,
        calculationId: pumpResults.calculationAudit?.calculationId || null,
        dependencyFingerprint: pumpResults.dependencyManifest?.dependencyFingerprint || null
      },
      response: {
        routeTrace: response.routeTrace || null,
        dependencyManifest: response.dependencyManifest || null
      },
      audit: {
        routeTraceText: auditPayload.routeTrace?.text || response.routeTrace?.text || ''
      }
    };
  }, { pumpId: caseData.pumpId });
}

async function readPumpCanvasRow(page, pumpId, label) {
  return page.evaluate(({ pumpId, label }) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const panels = Array.from(document.querySelectorAll('.pump-live-params'));
    const panel = panels.find((candidate) => {
      const object = candidate.closest('.pfd-object, [data-node-id], [data-object-id]');
      return object?.dataset?.nodeId === pumpId
        || object?.dataset?.objectId === pumpId
        || normalize(object?.textContent).includes(pumpId)
        || normalize(candidate.textContent).includes(pumpId);
    }) || panels[0] || null;
    if (!panel) return null;
    const row = Array.from(panel.querySelectorAll('.pump-live-param-row')).find((candidate) => (
      normalize(candidate.querySelector('.pump-live-param-label')?.textContent) === label
    ));
    if (!row) return null;
    const value = normalize(row.querySelector('.pump-live-param-value, strong')?.textContent);
    const unit = normalize(row.querySelector('.pump-live-param-unit')?.textContent);
    return {
      value: unit && value && !value.endsWith(unit) ? `${value} ${unit}` : value,
      text: normalize(row.textContent),
      previewVersion: panel.dataset.canvasFastPreview || '',
      runtimeVersion: window.EngineeringCanvasFastPreviewRuntime?.version || ''
    };
  }, { pumpId, label });
}

test.beforeEach(async ({ page }) => {
  const simulateRequests = [];
  await page.addInitScript(() => {
    window.__desktopFlowChainRequests = [];
  });
  await page.route('**/api/simulate', async (route) => {
    const request = route.request();
    let payload = null;
    try {
      payload = JSON.parse(request.postData() || '{}');
    } catch {
      payload = null;
    }
    simulateRequests.push({ url: request.url(), method: request.method(), payload });
    await route.continue();
  });
  page.__desktopFlowChainRequests = simulateRequests;
});

test('Synthetic desktop chain refreshes route, formula, and dependency after SNK edit', async ({ page }, testInfo) => {
  const caseData = CASE;
  await waitForNpshApp(page);
  await loadSyntheticProject(page);

  const baseline = await runProtectedSolve(page, caseData);
  const baselineSnapshot = await browserSnapshot(page, caseData);

  expect(baseline.results.status).toBe('OK');
  expect(baseline.results.flow).toBeCloseTo(30, 3);
  expect(baseline.results.npsha).toBeGreaterThan(baseline.results.npshr);
  expect(baseline.routeTrace.sequence).toEqual(['FLUID', 'SRC-100', 'PIPE-1', 'P-100', 'PIPE-2', 'SNK-100']);
  expect(baseline.routeTrace.sections.suction.totalLossM).toBeGreaterThan(0);
  expect(baseline.routeTrace.sections.discharge.totalLossM).toBeGreaterThan(0);
  expect(baselineSnapshot.dock.routeNodes).toEqual(['Fluid Basis', 'SRC-100', 'PIPE-1', 'P-100', 'PIPE-2', 'SNK-100']);
  expect(baselineSnapshot.audit.routeTraceText).toContain('SNK-100');
  expect(formulaRow(baseline, 'System Curve Head').substitution).toMatch(/=/);

  const staleSnapshot = await changeSinkBoundaryInBrowser(page, caseData, {
    elevation: 9,
    pressure: 1.4
  });
  expect(staleSnapshot.realtime.status).toBe('Stale');
  expect(staleSnapshot.pumpFreshness).toBe('Stale');
  expect(Number(staleSnapshot.sinkProps.elevation)).toBe(9);
  expect(Number(staleSnapshot.sinkProps.pressure)).toBeCloseTo(1.4, 8);

  const changed = await runProtectedSolve(page, caseData, { expectedPreviousId: baseline.calculationId });
  const changedSnapshot = await browserSnapshot(page, caseData);

  expect(changed.calculationId).not.toBe(baseline.calculationId);
  expect(changed.dependencyManifest.dependencyFingerprint).not.toBe(baseline.dependencyManifest.dependencyFingerprint);
  expect(changed.dependencyManifest.priorResultStale).toBe(true);
  expect(systemHead(changed)).toBeGreaterThan(systemHead(baseline));
  expect(changed.results.flow).toBeCloseTo(baseline.results.flow, 5);
  expect(changed.results.npsha).toBeCloseTo(baseline.results.npsha, 5);
  expect(changedSnapshot.realtime.status).toBe('Current');
  expect(changedSnapshot.pump.backendValidationStatus).toBe('Connected');
  expect(JSON.stringify(changedSnapshot.response.dependencyManifest.sinkImpactMatrix)).toMatch(/sink\.props\.elevation/);
  expect(changedSnapshot.audit.routeTraceText).toContain('Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 -> PIPE-2 -> SNK-100');

  const changedPayload = page.__desktopFlowChainRequests[page.__desktopFlowChainRequests.length - 1].payload;
  expect(changedPayload.client.previousDependencyFingerprint).toBe(baseline.dependencyManifest.dependencyFingerprint);
  expect(Number(changedPayload.model['SNK-100'].props.elevation)).toBe(9);
  expect(Number(changedPayload.model['SNK-100'].props.pressure)).toBeCloseTo(1.4, 8);

  const screenshotPath = testInfo.outputPath('synthetic-flow-chain-after-sink-edit.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('synthetic flow chain after sink edit', { path: screenshotPath, contentType: 'image/png' });
});

test('Fluid Basis temperature UI solve matches direct backend and reports route losses', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const caseData = CASE;
  await waitForNpshApp(page);
  await loadSyntheticProject(page);

  await page.locator('#btn-fluid-basis').click();
  const temperatureInput = page.locator('#fluid-task-temp').first();
  await expect(temperatureInput).toBeVisible({ timeout: 10000 });

  const rows = [];
  for (const temperature of [100, 80, 10]) {
    await temperatureInput.click();
    await temperatureInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await temperatureInput.type(String(temperature));
    await temperatureInput.dispatchEvent('input');
    await temperatureInput.dispatchEvent('change');
    await page.waitForFunction((nextTemperature) => {
      const model = window.__npshGlobalModel || window.globalModel || {};
      return Number(model.FLUID?.props?.temp) === nextTemperature;
    }, temperature, { timeout: 10000 });

    const uiResponse = await runProtectedSolve(page, caseData);
    const uiProjectState = await collectUiProjectState(page);
    const directBackend = runDirectBackendSimulation(uiProjectState, caseData.pumpId);
    const uiSummary = temperatureSummaryFromSimulation(uiResponse);
    const backendSummary = temperatureSummaryFromSimulation(directBackend);

    expectFiniteTemperatureSummary(uiSummary, `ui T=${temperature}`);
    expectFiniteTemperatureSummary(backendSummary, `backend T=${temperature}`);
    expectTemperatureSummaryClose(uiSummary, backendSummary, `T=${temperature}`);
    expect(uiSummary.temperature).toBe(temperature);
    expect(uiSummary.hLSuction).toBeGreaterThan(0);
    expect(uiSummary.hLDischarge).toBeGreaterThan(0);
    rows.push({ temperature, ui: uiSummary, backend: backendSummary });
  }

  const byTemperature = Object.fromEntries(rows.map((row) => [row.temperature, row]));
  expect(byTemperature[10].ui.rho).toBeGreaterThan(byTemperature[80].ui.rho);
  expect(byTemperature[80].ui.rho).toBeGreaterThan(byTemperature[100].ui.rho);
  expect(byTemperature[10].ui.pvap).toBeLessThan(byTemperature[80].ui.pvap);
  expect(byTemperature[80].ui.pvap).toBeLessThan(byTemperature[100].ui.pvap);
  expect(byTemperature[10].ui.npsha).toBeGreaterThan(byTemperature[80].ui.npsha);
  expect(byTemperature[80].ui.npsha).toBeGreaterThan(byTemperature[100].ui.npsha);
  expect(byTemperature[10].ui.margin).toBeGreaterThan(byTemperature[80].ui.margin);
  expect(byTemperature[80].ui.margin).toBeGreaterThan(byTemperature[100].ui.margin);

  await testInfo.attach('fluid-temperature-synthetic-ui-backend-parity-summary.json', {
    body: JSON.stringify({
      model: 'Synthetic current-layout route; UI snapshot after Fluid Basis temperature edit, then direct backend solve with identical snapshot',
      rows
    }, null, 2),
    contentType: 'application/json'
  });
});

test('Pump canvas keeps NPSHr and margin blank during Fluid Basis preview when Manual NPSHr is not input', async ({ page }) => {
  const caseData = CASE;
  await waitForNpshApp(page);
  await loadSyntheticProject(page, { manualNpshr: '' });
  await runProtectedSolve(page, caseData);

  const isDash = (row) => /^-(?:\s+m)?$/.test(String(row?.value || '').trim());
  expect(isDash(await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Required'))).toBe(true);
  expect(isDash(await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Margin'))).toBe(true);
  expect(isDash(await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Ratio'))).toBe(true);

  await page.locator('#btn-fluid-basis').click();
  const temperatureInput = page.locator('#fluid-task-temp').first();
  await expect(temperatureInput).toBeVisible({ timeout: 10000 });
  await temperatureInput.click();
  await temperatureInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await temperatureInput.type('90');

  await page.waitForFunction((pumpId) => {
    const runtimeVersion = window.EngineeringCanvasFastPreviewRuntime?.version || '';
    if (!/canvas-fast-preview\d+/i.test(runtimeVersion)) return false;
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const panel = Array.from(document.querySelectorAll('.pump-live-params')).find((candidate) => {
      const object = candidate.closest('.pfd-object, [data-node-id], [data-object-id]');
      return object?.dataset?.nodeId === pumpId
        || object?.dataset?.objectId === pumpId
        || normalize(object?.textContent).includes(pumpId)
        || document.querySelectorAll('.pump-live-params').length === 1;
    }) || null;
    return /canvas-fast-preview\d+/i.test(panel?.dataset?.canvasFastPreview || '');
  }, caseData.pumpId, { timeout: 3000 });

  const previewRequired = await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Required');
  const previewMargin = await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Margin');
  const previewRatio = await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Ratio');
  expect(previewRequired.runtimeVersion).toMatch(/canvas-fast-preview\d+/i);
  expect(isDash(previewRequired)).toBe(true);
  expect(isDash(previewMargin)).toBe(true);
  expect(isDash(previewRatio)).toBe(true);
});

test('Manual NPSHr UI edit previews locally and refreshes linked pump panel values', async ({ page }) => {
  const caseData = CASE;
  const ariaHiddenFocusWarnings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Blocked aria-hidden/i.test(text) && /canvasContextMenu/i.test(text)) {
      ariaHiddenFocusWarnings.push(text);
    }
  });

  await waitForNpshApp(page);
  await loadSyntheticProject(page, { manualNpshr: '' });
  const baseline = await runProtectedSolve(page, caseData);
  expect(baseline.results.npshr).toBeNull();
  expect(baseline.results.npshMargin).toBeNull();

  await page.waitForFunction(() => typeof window.openPumpManualNpshrTaskWindow === 'function', null, { timeout: 10000 });
  await page.evaluate((pumpId) => {
    const escape = window.CSS?.escape || ((value) => String(value).replace(/["\\]/g, '\\$&'));
    const candidates = Array.from(document.querySelectorAll(`[data-id="${escape(pumpId)}"]`));
    const target = candidates.find((node) => node.classList?.contains('pfd-object') || node.closest?.('svg')) || candidates[0];
    if (!target) throw new Error(`Pump object ${pumpId} was not found on the canvas.`);
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 2,
      buttons: 2,
      clientX: rect.left + Math.max(4, rect.width / 2),
      clientY: rect.top + Math.max(4, rect.height / 2)
    }));
    window.EngineeringPumpPerformanceCanonicalChart?.syncEntryPoints?.();
  }, caseData.pumpId);
  await page.waitForFunction(() => {
    const items = Array.from(document.querySelectorAll('#canvasContextMenu button[role="menuitem"]'))
      .map((button) => button.textContent.replace(/\s+/g, ' ').trim());
    return items.includes('Pump Datum - NPSHR') && items.includes('Pump Formula Defense');
  }, null, { timeout: 10000 });
  const pumpMenuItems = await page.locator('#canvasContextMenu button[role="menuitem"]').evaluateAll((buttons) => (
    buttons.map((button) => button.textContent.replace(/\s+/g, ' ').trim())
  ));
  expect(pumpMenuItems).not.toContain('User Task Object Properties');
  expect(pumpMenuItems).not.toContain('Pump Performance Chart');
  expect(pumpMenuItems.filter((item) => [
    'Pump Datum - NPSHR',
    'Pump Formula Defense',
    'Connect',
    'Delete Object'
  ].includes(item))).toEqual([
    'Pump Datum - NPSHR',
    'Pump Formula Defense',
    'Connect',
    'Delete Object'
  ]);

  await page.locator('#canvasContextMenu button[role="menuitem"]').filter({ hasText: /^Pump Datum - NPSHR$/ }).click();
  const npshrInput = page.locator(`.pump-manual-npshr-task-window[data-pump-node-id="${caseData.pumpId}"] input[data-field="manualNpshr"]`).first();
  await expect(npshrInput).toBeVisible({ timeout: 10000 });
  expect(ariaHiddenFocusWarnings).toEqual([]);

  const requestsBeforeEdit = page.__desktopFlowChainRequests.length;
  await npshrInput.click();
  await npshrInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await npshrInput.type('4');

  const localPreviewHandle = await page.waitForFunction((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[pumpId] || {};
    const results = pump.results || {};
    const npsh = results.npshEvaluation || {};
    const npsha = Number(npsh.npsha ?? results.npsha);
    const margin = Number(npsh.npshMargin ?? results.npshMargin);
    const ratio = Number(npsh.npshRatio ?? results.npshRatio);
    const freshness = results.calculationFreshness || npsh.calculationFreshness || '';
    if (
      Number(pump.props?.manualNpshr) !== 4
      || Number(pump.props?.designNpshr) !== 4
      || Number(npsh.npshr ?? results.npshr) !== 4
      || !Number.isFinite(npsha)
      || Math.abs(margin - (npsha - 4)) > 0.002
      || Math.abs(ratio - (npsha / 4)) > 0.002
      || !['Local preview', 'Current'].includes(freshness)
    ) {
      return false;
    }
    return {
      npsha,
      npshr: Number(npsh.npshr ?? results.npshr),
      margin,
      ratio,
      status: npsh.hydraulicStatus || results.hydraulicNpshStatus || npsh.status || results.status || null,
      freshness
    };
  }, caseData.pumpId, { timeout: 15000 });
  const localPreview = await localPreviewHandle.jsonValue();
  expect(localPreview.status).toBe('OK');
  expect(['Local preview', 'Current']).toContain(localPreview.freshness);
  await expect.poll(() => page.__desktopFlowChainRequests.length, {
    timeout: 15000,
    intervals: [120, 300, 800, 1500]
  }).toBeGreaterThan(requestsBeforeEdit);

  const manualNpshrPayload = page.__desktopFlowChainRequests[page.__desktopFlowChainRequests.length - 1].payload;
  expect(Number(manualNpshrPayload.model[caseData.pumpId].props.manualNpshr)).toBe(4);

  await page.waitForFunction((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[pumpId] || {};
    const results = pump.results || {};
    const npsh = results.npshEvaluation || {};
    return window.__engineeringCalculationDefenseRealtimeState?.status === 'Current'
      && results.backendValidationStatus === 'Connected'
      && Number(pump.props?.manualNpshr) === 4
      && Number(npsh.npshr ?? results.npshr) === 4;
  }, caseData.pumpId, { timeout: 15000 });

  expect(await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Required')).toMatchObject({ value: expect.stringMatching(/^4(?:\.0+)?(?: m)?$/) });
  expect(Number((await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Ratio')).value)).toBeCloseTo(localPreview.ratio, 3);
});
