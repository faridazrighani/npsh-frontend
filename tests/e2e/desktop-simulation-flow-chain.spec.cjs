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

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
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
    && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v18-src-task-window-flash-lock'
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
  const expectedRequestProps = await page.evaluate(({ ids }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return Object.fromEntries(ids.map((id) => [id, JSON.parse(JSON.stringify(model[id]?.props || {}))]));
  }, {
    ids: [
      'FLUID',
      caseData.sourceId,
      caseData.suctionPipeId,
      caseData.pumpId,
      caseData.dischargePipeId,
      caseData.sinkId
    ]
  });
  const expectedPropsSignature = stableJson(expectedRequestProps);
  const responsePromise = page.waitForResponse((response) => {
    if (
      !/\/api\/simulate(?:[?#]|$)/.test(response.url())
      || response.request().method() !== 'POST'
      || response.status() !== 200
    ) {
      return false;
    }
    let payload = null;
    try {
      payload = JSON.parse(response.request().postData() || '{}');
    } catch {
      return false;
    }
    const requestProps = Object.fromEntries(Object.keys(expectedRequestProps).map((id) => [
      id,
      payload?.model?.[id]?.props || {}
    ]));
    return stableJson(requestProps) === expectedPropsSignature;
  }, { timeout: 30000 });
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
    const npsh = pumpResults.npshEvaluation || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const lastResponse = window.__npshLastBackendSimulationResponse?.response || {};
    const activeIds = [
      pumpResults.calculationAudit?.calculationId,
      state.calculationId,
      lastResponse.calculationId
    ].filter(Boolean);
    if (!activeIds.length) return false;
    if (expectedPreviousId && activeIds.every((activeId) => activeId === expectedPreviousId)) return false;
    const hasObservedResponse = activeIds.includes(calculationId);
    const isCurrent = state.status === 'Current'
      || pumpResults.calculationFreshness === 'Current'
      || npsh.calculationFreshness === 'Current';
    const backendConnected = pumpResults.backendValidationStatus === 'Connected'
      || npsh.backendValidationStatus === 'Connected';
    return isCurrent
      && backendConnected
      && !!pumpResults.dependencyManifest?.dependencyFingerprint
      && (hasObservedResponse || activeIds.some((activeId) => activeId !== expectedPreviousId));
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

function numericReadoutValue(row) {
  const match = String(row?.value || row?.text || '').replace(',', '.').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  return match ? Number(match[0]) : NaN;
}

async function changeSinkBoundaryInBrowser(page, caseData, { elevation, pressure, allowSyntheticAutoSolve = false }) {
  return page.evaluate(({ sinkId, elevation: nextElevation, pressure: nextPressure, allowSyntheticAutoSolve }) => {
    if (allowSyntheticAutoSolve) {
      window.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve = true;
    }
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
      pendingAutoSolve: JSON.parse(JSON.stringify(window.__engineeringCalculationDefenseRealtimeAutoSolve || null)),
      allowSyntheticAutoSolve: window.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve === true,
      sinkProps: JSON.parse(JSON.stringify(sink.props || {})),
      pumpFreshness: Object.values(model).find((node) => node?.type === 'pump')?.results?.calculationFreshness || null
    };
  }, {
    sinkId: caseData.sinkId,
    elevation,
    pressure,
    allowSyntheticAutoSolve
  });
}

async function changePipeSegmentInBrowser(page, { pipeId, segmentIndex = 0, field, value, allowSyntheticAutoSolve = false }) {
  return page.evaluate(({ pipeId: targetPipeId, segmentIndex: targetSegmentIndex, field: targetField, value: nextValue, allowSyntheticAutoSolve: shouldAutosolve }) => {
    if (shouldAutosolve) {
      window.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve = true;
    }
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pipe = model[targetPipeId];
    if (!pipe) throw new Error(`Missing pipe ${targetPipeId}`);
    if (!pipe.props || typeof pipe.props !== 'object') pipe.props = {};
    if (!Array.isArray(pipe.props.segments)) pipe.props.segments = [];
    if (!pipe.props.segments[targetSegmentIndex]) pipe.props.segments[targetSegmentIndex] = {};
    pipe.props.segments[targetSegmentIndex][targetField] = nextValue;

    const taskWindow = document.querySelector(`.task-window[data-task-node-id="${targetPipeId}"], .persistent-object-properties-task-window[data-node-id="${targetPipeId}"]`)
      || document.createElement('section');
    taskWindow.classList.add('task-window');
    taskWindow.dataset.taskNodeId = targetPipeId;
    taskWindow.dataset.node = targetPipeId;
    taskWindow.dataset.nodeId = targetPipeId;
    taskWindow.dataset.kind = 'pipe';
    taskWindow.dataset.taskNodeType = 'pipe';
    if (!taskWindow.isConnected) document.body.appendChild(taskWindow);

    const selector = `input[data-key="${targetField}"][data-segment-index="${targetSegmentIndex}"]`;
    let input = taskWindow.querySelector(selector);
    if (!input) {
      input = document.createElement('input');
      input.type = 'number';
      input.name = `segments[${targetSegmentIndex}].${targetField}`;
      input.dataset.key = targetField;
      input.dataset.field = targetField;
      input.dataset.node = targetPipeId;
      input.dataset.nodeId = targetPipeId;
      input.dataset.segmentIndex = String(targetSegmentIndex);
      taskWindow.appendChild(input);
    }
    input.value = String(nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    window.CanvasContextDock?.refresh?.();

    return {
      realtime: JSON.parse(JSON.stringify(window.__engineeringCalculationDefenseRealtimeState || null)),
      pendingAutoSolve: JSON.parse(JSON.stringify(window.__engineeringCalculationDefenseRealtimeAutoSolve || null)),
      allowSyntheticAutoSolve: window.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve === true,
      pipeProps: JSON.parse(JSON.stringify(pipe.props || {})),
      pumpFreshness: Object.values(model).find((node) => node?.type === 'pump')?.results?.calculationFreshness || null
    };
  }, {
    pipeId,
    segmentIndex,
    field,
    value,
    allowSyntheticAutoSolve
  });
}

async function reverseSuctionConnectionInBrowser(page, caseData) {
  return page.evaluate(({ sourceId, pumpId, suctionPipeId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const connectionLists = [];
    try {
      if (typeof connections !== 'undefined' && Array.isArray(connections)) connectionLists.push(connections);
    } catch {
      // Protected global may be unavailable.
    }
    if (Array.isArray(window.connections)) connectionLists.push(window.connections);
    if (Array.isArray(window.__npshConnections)) connectionLists.push(window.__npshConnections);
    const seen = new Set();
    let changed = 0;
    connectionLists.forEach((list) => {
      if (!Array.isArray(list) || seen.has(list)) return;
      seen.add(list);
      const connection = list.find((candidate) => (
        candidate
        && (candidate.pipeId === suctionPipeId || candidate.pipe === suctionPipeId)
        && ((candidate.from === sourceId && candidate.to === pumpId) || (candidate.rawFrom === sourceId && candidate.rawTo === pumpId))
      ));
      if (!connection) return;
      connection.from = pumpId;
      connection.to = sourceId;
      connection.rawFrom = pumpId;
      connection.rawTo = sourceId;
      connection.hydraulicReversed = true;
      changed += 1;
    });
    document.dispatchEvent(new CustomEvent('npsh:simulation-updated', {
      detail: {
        reason: 'e2e-reversed-suction-route',
        pumpId,
        sourceId,
        pipeId: suctionPipeId
      }
    }));
    window.EngineeringCanvasFastPreviewRuntime?.runImmediatePumpPreview?.('e2e-reversed-suction-route');
    window.EngineeringRouteTraceAudit?.pruneDefaultPumpRouteTraceRows?.(document);
    window.CanvasContextDock?.refresh?.();
    return {
      changed,
      suctionConnection: (connectionLists[0] || []).find((candidate) => candidate?.pipeId === suctionPipeId || candidate?.pipe === suctionPipeId) || null,
      hasSource: model[sourceId]?.type === 'source',
      hasPump: model[pumpId]?.type === 'pump'
    };
  }, {
    sourceId: caseData.sourceId,
    pumpId: caseData.pumpId,
    suctionPipeId: caseData.suctionPipeId
  });
}

async function setFluidBasisTemperature(page, temperature) {
  const temperatureInput = page.locator('#fluid-task-temp').first();
  await expect(temperatureInput).toBeVisible({ timeout: 10000 });
  await temperatureInput.evaluate((input, nextTemperature) => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (valueSetter) {
      valueSetter.call(input, String(nextTemperature));
    } else {
      input.value = String(nextTemperature);
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('npsh:input-lightweight-update', {
      bubbles: true,
      detail: { sourceEvent: 'e2e-fluid-temperature' }
    }));
    window.EngineeringCanvasFastPreviewRuntime?.runImmediatePumpPreview?.('e2e-fluid-temperature');
  }, temperature);
  await page.waitForFunction((nextTemperature) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return Number(model.FLUID?.props?.temp) === nextTemperature;
  }, temperature, { timeout: 10000 });
  return temperatureInput;
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

async function waitForSimulationPayloadResponse(page, predicate, timeout = 30000) {
  return page.waitForResponse((response) => {
    if (
      !/\/api\/simulate(?:[?#]|$)/.test(response.url())
      || response.request().method() !== 'POST'
      || response.status() !== 200
    ) {
      return false;
    }
    try {
      return !!predicate(JSON.parse(response.request().postData() || '{}'));
    } catch {
      return false;
    }
  }, { timeout });
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

test('Newer boundary input blocks a delayed stale solver result without changing route flow', async ({ page }) => {
  test.setTimeout(150000);
  const caseData = CASE;
  await waitForNpshApp(page);
  await loadSyntheticProject(page, { flow: 30, sinkElevation: 5, sinkPressure: 1.2 });
  const baseline = await runProtectedSolve(page, caseData);

  await page.unroute('**/api/simulate');
  const served = [];
  await page.route('**/api/simulate', async (route) => {
    const payload = JSON.parse(route.request().postData() || '{}');
    const elevation = Number(payload.model?.[caseData.sinkId]?.props?.elevation);
    const response = await route.fetch();
    const body = await response.json();
    served.push({ elevation, calculationId: body.calculationId || body.calculationAudit?.calculationId });
    await new Promise((resolve) => setTimeout(resolve, elevation === 8 ? 650 : 30));
    await route.fulfill({
      response,
      body: JSON.stringify(body)
    });
  });

  await changeSinkBoundaryInBrowser(page, caseData, {
    elevation: 8,
    pressure: 1.3,
    allowSyntheticAutoSolve: true
  });
  await expect.poll(() => served.some((entry) => entry.elevation === 8), { timeout: 10000 }).toBe(true);
  const staleCalculationId = served.find((entry) => entry.elevation === 8).calculationId;

  await page.evaluate(() => {
    window.__routeInputRaceSamples = [];
    window.__routeInputRaceTimer = window.setInterval(() => {
      const model = window.__npshGlobalModel || window.globalModel || {};
      const pump = model['P-100'] || {};
      window.__routeInputRaceSamples.push({
        sourceFlow: Number(model['SRC-100']?.props?.flow),
        sinkFlow: Number(model['SNK-100']?.props?.demandFlow),
        sinkElevation: Number(model['SNK-100']?.props?.elevation),
        sinkPressure: Number(model['SNK-100']?.props?.pressure),
        calculationId: pump.results?.calculationAudit?.calculationId || null
      });
    }, 15);
  });
  await changeSinkBoundaryInBrowser(page, caseData, {
    elevation: 14,
    pressure: 1.8,
    allowSyntheticAutoSolve: true
  });

  await expect.poll(() => served.some((entry) => entry.elevation === 14), { timeout: 30000 }).toBe(true);
  const currentCalculationId = served.findLast((entry) => entry.elevation === 14).calculationId;
  await page.waitForFunction(({ pumpId, calculationId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    return results.calculationAudit?.calculationId === calculationId
      && window.__engineeringCalculationDefenseRealtimeState?.status === 'Current';
  }, { pumpId: caseData.pumpId, calculationId: currentCalculationId }, { timeout: 30000 });

  const finalState = await page.evaluate(() => {
    window.clearInterval(window.__routeInputRaceTimer);
    const model = window.__npshGlobalModel || window.globalModel || {};
    return {
      sourceFlow: Number(model['SRC-100']?.props?.flow),
      sinkFlow: Number(model['SNK-100']?.props?.demandFlow),
      sinkElevation: Number(model['SNK-100']?.props?.elevation),
      sinkPressure: Number(model['SNK-100']?.props?.pressure),
      calculationId: model['P-100']?.results?.calculationAudit?.calculationId || null,
      blocked: JSON.parse(JSON.stringify(window.__engineeringRealtimeBlockedBackendApply || null)),
      samples: JSON.parse(JSON.stringify(window.__routeInputRaceSamples || []))
    };
  });

  expect(staleCalculationId).not.toBe(currentCalculationId);
  expect(finalState.blocked?.sequence).toBeGreaterThan(0);
  expect(finalState.calculationId).toBe(currentCalculationId);
  expect(finalState.sourceFlow).toBe(30);
  expect(finalState.sinkFlow).toBe(30);
  expect(finalState.sinkElevation).toBe(14);
  expect(finalState.sinkPressure).toBeCloseTo(1.8, 8);
  expect(finalState.samples.some((sample) => sample.calculationId === staleCalculationId)).toBe(false);
  expect(finalState.samples.every((sample) => sample.sourceFlow === 30 && sample.sinkFlow === 30)).toBe(true);
  expect(baseline.calculationId).not.toBe(currentCalculationId);
});

test('Downstream SNK and discharge pipe edits autosolve required head without Validate click', async ({ page }) => {
  test.setTimeout(150000);
  const caseData = CASE;
  await waitForNpshApp(page);
  await loadSyntheticProject(page, { manualNpshr: 2, sinkElevation: 5, sinkPressure: 1.2 });

  const baseline = await runProtectedSolve(page, caseData);
  const baselineHead = systemHead(baseline);
  expect(Number.isFinite(baselineHead)).toBe(true);
  expect(baselineHead).toBeGreaterThan(0);
  expect(numericReadoutValue(await readPumpCanvasRow(page, caseData.pumpId, 'Required Head'))).toBeGreaterThan(0);
  expect(numericReadoutValue(await readPumpCanvasRow(page, caseData.pumpId, 'Discharge Press.'))).toBeGreaterThan(0);

  const requestsBeforeSinkEdit = page.__desktopFlowChainRequests.length;
  const sinkResponsePromise = waitForSimulationPayloadResponse(page, (payload) => (
    Number(payload?.model?.[caseData.sinkId]?.props?.elevation) === 12
    && Math.abs(Number(payload?.model?.[caseData.sinkId]?.props?.pressure) - 1.65) < 1e-9
  ));
  const staleSink = await changeSinkBoundaryInBrowser(page, caseData, {
    elevation: 12,
    pressure: 1.65,
    allowSyntheticAutoSolve: true
  });
  expect(staleSink.allowSyntheticAutoSolve).toBe(true);
  expect(staleSink.pendingAutoSolve?.calculationMode).toBe('realtime-input');
  expect(staleSink.realtime.status).toBe('Stale');
  expect(staleSink.pumpFreshness).toBe('Stale');

  const sinkResponse = await sinkResponsePromise;
  const sinkChanged = await sinkResponse.json();
  await page.waitForFunction(({ pumpId, calculationId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const evaluation = results.npshEvaluation || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const activeIds = [
      results.calculationAudit?.calculationId,
      evaluation.calculationAudit?.calculationId,
      evaluation.calculationId,
      state.calculationId
    ].filter(Boolean);
    return state.status === 'Current'
      && activeIds.includes(calculationId)
      && results.backendValidationStatus === 'Connected'
      && Number.isFinite(Number(results.requiredSystemHead ?? evaluation.requiredSystemHead))
      && Number.isFinite(Number(results.dischargePressure ?? evaluation.dischargePressure));
  }, {
    pumpId: caseData.pumpId,
    calculationId: sinkChanged.calculationId
  }, { timeout: 30000 });

  expect(page.__desktopFlowChainRequests.length).toBeGreaterThan(requestsBeforeSinkEdit);
  expect(sinkChanged.calculationId).not.toBe(baseline.calculationId);
  expect(sinkChanged.dependencyManifest.dependencyFingerprint).not.toBe(baseline.dependencyManifest.dependencyFingerprint);
  expect(systemHead(sinkChanged)).toBeGreaterThan(baselineHead);
  await page.waitForFunction(({ pumpId, baselineHead: previousHead }) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const panel = Array.from(document.querySelectorAll('.pump-live-params')).find((candidate) => (
      normalize(candidate.closest?.('.pfd-object, [data-node-id], [data-object-id]')?.dataset?.nodeId) === pumpId
      || normalize(candidate.closest?.('.pfd-object, [data-node-id], [data-object-id]')?.dataset?.objectId) === pumpId
      || normalize(candidate.textContent).includes(pumpId)
    )) || document.querySelector('.pump-live-params');
    const row = Array.from(panel?.querySelectorAll?.('.pump-live-param-row') || []).find((candidate) => (
      normalize(candidate.querySelector('.pump-live-param-label')?.textContent) === 'Required Head'
    ));
    const text = normalize(row?.querySelector('.pump-live-param-value, strong')?.textContent);
    const match = text.replace(',', '.').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
    return match && Number(match[0]) > previousHead;
  }, {
    pumpId: caseData.pumpId,
    baselineHead
  }, { timeout: 10000 });

  const requestsBeforePipeEdit = page.__desktopFlowChainRequests.length;
  const pipeResponsePromise = waitForSimulationPayloadResponse(page, (payload) => (
    Number(payload?.model?.[caseData.dischargePipeId]?.props?.segments?.[0]?.length) === 95
  ));
  const stalePipe = await changePipeSegmentInBrowser(page, {
    pipeId: caseData.dischargePipeId,
    segmentIndex: 0,
    field: 'length',
    value: 95,
    allowSyntheticAutoSolve: true
  });
  expect(stalePipe.allowSyntheticAutoSolve).toBe(true);
  expect(stalePipe.pendingAutoSolve?.calculationMode).toBe('realtime-input');
  expect(stalePipe.realtime.status).toBe('Stale');
  expect(Number(stalePipe.pipeProps.segments[0].length)).toBe(95);

  const pipeResponse = await pipeResponsePromise;
  const pipeChanged = await pipeResponse.json();
  await page.waitForFunction(({ pumpId, calculationId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const evaluation = results.npshEvaluation || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const activeIds = [
      results.calculationAudit?.calculationId,
      evaluation.calculationAudit?.calculationId,
      evaluation.calculationId,
      state.calculationId
    ].filter(Boolean);
    return state.status === 'Current'
      && activeIds.includes(calculationId)
      && results.backendValidationStatus === 'Connected'
      && Number.isFinite(Number(results.requiredSystemHead ?? evaluation.requiredSystemHead));
  }, {
    pumpId: caseData.pumpId,
    calculationId: pipeChanged.calculationId
  }, { timeout: 30000 });

  expect(page.__desktopFlowChainRequests.length).toBeGreaterThan(requestsBeforePipeEdit);
  expect(pipeChanged.calculationId).not.toBe(sinkChanged.calculationId);
  expect(pipeChanged.dependencyManifest.dependencyFingerprint).not.toBe(sinkChanged.dependencyManifest.dependencyFingerprint);
  expect(pipeChanged.routeTrace.sections.discharge.totalLossM).toBeGreaterThan(sinkChanged.routeTrace.sections.discharge.totalLossM);
  expect(systemHead(pipeChanged)).toBeGreaterThan(systemHead(sinkChanged));
  await page.waitForFunction(({ pumpId, previousHead }) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const panel = Array.from(document.querySelectorAll('.pump-live-params')).find((candidate) => (
      normalize(candidate.closest?.('.pfd-object, [data-node-id], [data-object-id]')?.dataset?.nodeId) === pumpId
      || normalize(candidate.closest?.('.pfd-object, [data-node-id], [data-object-id]')?.dataset?.objectId) === pumpId
      || normalize(candidate.textContent).includes(pumpId)
    )) || document.querySelector('.pump-live-params');
    const row = Array.from(panel?.querySelectorAll?.('.pump-live-param-row') || []).find((candidate) => (
      normalize(candidate.querySelector('.pump-live-param-label')?.textContent) === 'Required Head'
    ));
    const text = normalize(row?.querySelector('.pump-live-param-value, strong')?.textContent);
    const match = text.replace(',', '.').match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
    return match && Number(match[0]) > previousHead;
  }, {
    pumpId: caseData.pumpId,
    previousHead: systemHead(sinkChanged)
  }, { timeout: 10000 });
});

test('Reverse construction order resolves to the same complete hydraulic route', async ({ page }) => {
  const caseData = CASE;
  await waitForNpshApp(page);
  await loadSyntheticProject(page, { manualNpshr: 2, sinkElevation: 5, sinkPressure: 1.2 });

  const baseline = await runProtectedSolve(page, caseData);
  expect(systemHead(baseline)).toBeGreaterThan(0);
  expect(numericReadoutValue(await readPumpCanvasRow(page, caseData.pumpId, 'Required Head'))).toBeGreaterThan(0);
  expect(numericReadoutValue(await readPumpCanvasRow(page, caseData.pumpId, 'Discharge Press.'))).toBeGreaterThan(0);

  const reversed = await reverseSuctionConnectionInBrowser(page, caseData);
  expect(reversed.changed).toBeGreaterThan(0);
  expect(reversed.hasSource).toBe(true);
  expect(reversed.hasPump).toBe(true);

  await page.locator('#btn-solve').click();
  await page.waitForFunction((pumpId) => {
    const results = window.globalModel?.[pumpId]?.results || window.__npshGlobalModel?.[pumpId]?.results || {};
    const evaluation = results.npshEvaluation || {};
    return results.backendValidationStatus === 'Connected'
      && Number.isFinite(Number(results.requiredSystemHead ?? evaluation.requiredSystemHead));
  }, caseData.pumpId, { timeout: 30000 });

  expect(numericReadoutValue(await readPumpCanvasRow(page, caseData.pumpId, 'Required Head'))).toBeGreaterThan(0);
  expect(numericReadoutValue(await readPumpCanvasRow(page, caseData.pumpId, 'Discharge Press.'))).toBeGreaterThan(0);
  await expect(page.locator('#btn-solve')).toBeEnabled();
});

test('Fluid Basis temperature UI solve matches direct backend and reports route losses', async ({ page }, testInfo) => {
  test.setTimeout(150000);
  const caseData = CASE;
  await waitForNpshApp(page);
  await loadSyntheticProject(page);

  await page.locator('#btn-fluid-basis').click();

  const rows = [];
  for (const temperature of [100, 80, 10]) {
    await setFluidBasisTemperature(page, temperature);

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
  await setFluidBasisTemperature(page, 90);

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
  }, caseData.pumpId, { timeout: 8000 });

  const previewRequired = await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Required');
  const previewMargin = await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Margin');
  const previewRatio = await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Ratio');
  expect(previewRequired.runtimeVersion).toMatch(/canvas-fast-preview\d+/i);
  expect(isDash(previewRequired)).toBe(true);
  expect(isDash(previewMargin)).toBe(true);
  expect(isDash(previewRatio)).toBe(true);
});

test('Backend NPSHa remains canonical after an older canvas preview pulse', async ({ page }) => {
  const caseData = CASE;
  await waitForNpshApp(page);
  await loadSyntheticProject(page, { manualNpshr: 2 });
  const baseline = await runProtectedSolve(page, caseData);
  const canonicalBaseline = Number(baseline.results?.npsha);
  expect(Number.isFinite(canonicalBaseline)).toBe(true);

  const staleNpsha = canonicalBaseline - 0.0036;
  await page.evaluate(({ pumpId, stale }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[pumpId];
    const results = pump.results || (pump.results = {});
    const evaluation = results.npshEvaluation || (results.npshEvaluation = {});
    results.npsha = stale;
    results.npshAvailable = stale;
    evaluation.npsha = stale;
    evaluation.npshAvailable = stale;
    window.EngineeringCanvasFastPreviewRuntime?.captureAuthoritativeBaselines?.();
    window.EngineeringCanvasFastPreviewRuntime?.applyTransientPumpPreview?.(pump, {
      npsha: stale,
      npshr: Number(pump.props?.manualNpshr),
      margin: stale - Number(pump.props?.manualNpshr),
      ratio: stale / Number(pump.props?.manualNpshr),
      status: 'OK',
      currentVaporHead: Number(results.vaporPressureHead || evaluation.vaporPressureHead || 0)
    });
    document.dispatchEvent(new CustomEvent('npsh:input-lightweight-update', {
      bubbles: true,
      detail: { sourceEvent: 'e2e-stale-npsha-preview' }
    }));
  }, { pumpId: caseData.pumpId, stale: staleNpsha });

  const refreshed = await runProtectedSolve(page, caseData, { expectedPreviousId: baseline.calculationId });
  const canonical = Number(refreshed.results?.npsha);
  expect(Number.isFinite(canonical)).toBe(true);
  await page.waitForTimeout(2400);

  const final = await page.evaluate((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const evaluation = results.npshEvaluation || {};
    return {
      aliases: [
        Number(results.npsha),
        Number(results.npshAvailable),
        Number(evaluation.npsha),
        Number(evaluation.npshAvailable)
      ],
      transient: results.__canvasFastPreviewTransient || null,
      commit: window.__engineeringCanvasFastPreviewLastAuthoritativeCommit || null,
      finalize: window.__engineeringCanvasFastPreviewLastFinalize || null
    };
  }, caseData.pumpId);
  final.aliases.forEach((value) => expect(value).toBeCloseTo(canonical, 8));
  expect(final.transient).toBeNull();
  expect(final.commit?.npsha).toBeCloseTo(canonical, 8);
  expect(final.finalize?.committed).toBeGreaterThan(0);
  expect(numericReadoutValue(await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Available'))).toBeCloseTo(canonical, 4);
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
  const baselineNpsha = await page.evaluate((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const npsh = results.npshEvaluation || {};
    return Number(npsh.npsha ?? results.npsha);
  }, caseData.pumpId);
  expect(Number.isFinite(baselineNpsha)).toBe(true);

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
  expect(localPreview.npsha).toBeCloseTo(baselineNpsha, 4);
  expect(localPreview.status).toBe('OK');
  expect(['Local preview', 'Current']).toContain(localPreview.freshness);
  await page.waitForTimeout(500);
  expect(page.__desktopFlowChainRequests.length).toBe(requestsBeforeEdit);

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
  const currentNpshaAfterManual = await page.evaluate((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const npsh = results.npshEvaluation || {};
    return Number(npsh.npsha ?? results.npsha);
  }, caseData.pumpId);
  expect(currentNpshaAfterManual).toBeCloseTo(baselineNpsha, 4);

  expect(await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Required')).toMatchObject({ value: expect.stringMatching(/^4(?:\.0+)?(?: m)?$/) });
  const currentRatioHandle = await page.waitForFunction((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const npsh = results.npshEvaluation || {};
    const ratio = Number(npsh.npshRatio ?? results.npshRatio);
    return Number.isFinite(ratio) ? ratio : false;
  }, caseData.pumpId, { timeout: 10000 });
  const currentRatio = await currentRatioHandle.jsonValue();
  expect(Number((await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Ratio')).value)).toBeCloseTo(currentRatio, 3);

  const requestsBeforeClear = page.__desktopFlowChainRequests.length;
  await npshrInput.click();
  await npshrInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await npshrInput.press('Backspace');

  await page.waitForFunction((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[pumpId] || {};
    const results = pump.results || {};
    const npsh = results.npshEvaluation || {};
    const status = npsh.hydraulicStatus || results.hydraulicNpshStatus || npsh.status || results.status || '';
    return pump.props?.manualNpshr === ''
      && (npsh.npshr ?? results.npshr) == null
      && (npsh.npshMargin ?? results.npshMargin) == null
      && (npsh.npshRatio ?? results.npshRatio) == null
      && status === 'NPSHr Not Provided';
  }, caseData.pumpId, { timeout: 15000 });
  const currentNpshaAfterClear = await page.evaluate((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const npsh = results.npshEvaluation || {};
    return Number(npsh.npsha ?? results.npsha);
  }, caseData.pumpId);
  expect(currentNpshaAfterClear).toBeCloseTo(baselineNpsha, 4);

  await page.waitForTimeout(500);
  expect(page.__desktopFlowChainRequests.length).toBe(requestsBeforeClear);

  await page.waitForFunction((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[pumpId] || {};
    const results = pump.results || {};
    const npsh = results.npshEvaluation || {};
    const status = npsh.hydraulicStatus || results.hydraulicNpshStatus || npsh.status || results.status || '';
    return window.__engineeringCalculationDefenseRealtimeState?.status === 'Current'
      && results.backendValidationStatus === 'Connected'
      && pump.props?.manualNpshr === ''
      && (npsh.npshr ?? results.npshr) == null
      && (npsh.npshMargin ?? results.npshMargin) == null
      && (npsh.npshRatio ?? results.npshRatio) == null
      && status === 'NPSHr Not Provided';
  }, caseData.pumpId, { timeout: 15000 });

  const isDash = (row) => /^-(?:\s+(?:m|bar a))?$/.test(String(row?.value || '').trim());
  expect(await readPumpCanvasRow(page, caseData.pumpId, 'Hydraulic NPSH')).toMatchObject({ value: 'NPSHr Not Provided' });
  expect(isDash(await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Required'))).toBe(true);
  expect(isDash(await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Margin'))).toBe(true);
  expect(isDash(await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Ratio'))).toBe(true);
  expect(isDash(await readPumpCanvasRow(page, caseData.pumpId, 'Discharge Press.'))).toBe(true);
  expect(isDash(await readPumpCanvasRow(page, caseData.pumpId, 'Required Head'))).toBe(true);
});
