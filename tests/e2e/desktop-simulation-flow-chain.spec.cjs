const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { test, expect } = require('@playwright/test');

const frontendRoot = path.resolve(__dirname, '../..');
const apiRoot = path.resolve(frontendRoot, '..', 'npsh-api');
const { runBackendNpshSimulation } = require(path.join(apiRoot, 'server/src/engine/frontend-npsh-engine.cjs'));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readUntirtaProject(filePath) {
  const buffer = fs.readFileSync(filePath);
  const marker = Buffer.from('UNTIRTA-NPSH-V1');
  if (buffer.subarray(0, marker.length).equals(marker)) {
    const lineEnd = buffer.indexOf(0x0a);
    const headerOffset = lineEnd + 1;
    const headerLength = Number.parseInt(buffer.subarray(headerOffset, headerOffset + 8).toString('ascii'), 16);
    const header = JSON.parse(buffer.subarray(headerOffset + 8, headerOffset + 8 + headerLength).toString('utf8'));
    let payload = buffer.subarray(headerOffset + 8 + headerLength);
    if (Number.isFinite(header.payloadBytes)) payload = payload.subarray(0, header.payloadBytes);
    if (header.compression === 'gzip') payload = zlib.gunzipSync(payload);
    return JSON.parse(payload.toString('utf8'));
  }

  const raw = buffer.toString('utf8');
  const jsonIndex = raw.indexOf('{"projectFile"');
  if (jsonIndex < 0) throw new Error(`No .untirta project payload found in ${filePath}`);
  return JSON.parse(raw.slice(jsonIndex));
}

function loadJournalCase(caseId) {
  const manifest = readJson(path.join(frontendRoot, 'journals', 'simulation-cases.json'));
  const entry = manifest.cases.find((item) => item.id === caseId);
  if (!entry) throw new Error(`${caseId} not found in simulation-cases.json`);
  if (entry.disabled) throw new Error(`${caseId} is disabled; fixture validation is blocked.`);
  const samplePath = path.join(frontendRoot, entry.sampleFile);
  const reportPath = path.join(frontendRoot, entry.analysisReport);
  if (!fs.existsSync(samplePath)) throw new Error(`${caseId} sample fixture is missing: ${samplePath}`);
  if (!fs.existsSync(reportPath)) throw new Error(`${caseId} analysis report is missing: ${reportPath}`);
  const project = readUntirtaProject(samplePath);
  const report = readJson(reportPath);
  const pumpId = Object.keys(project.model || {}).find((id) => project.model[id]?.type === 'pump');
  const sourceId = Object.keys(project.model || {}).find((id) => project.model[id]?.type === 'source');
  const sinkId = Object.keys(project.model || {}).find((id) => project.model[id]?.type === 'sink');
  if (!pumpId || !sourceId || !sinkId) throw new Error(`${caseId} fixture needs source, pump, and sink nodes.`);
  return { entry, project, report, pumpId, sourceId, sinkId, samplePath, reportPath };
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
    && window.__npshRouteTraceAuditInstalled?.fetchSimulation
    && window.__npshRouteTraceAuditInstalled?.primaryResultApplier
  ), null, { timeout: 30000 });
}

async function loadProject(page, caseData) {
  await page.evaluate((projectState) => {
    window.applySimulationStateAtomic(JSON.stringify(projectState));
    window.CanvasContextDock?.refresh?.();
  }, caseData.project);
  await page.waitForFunction(({ pumpId, sourceId, sinkId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return !!(model[pumpId] && model[sourceId] && model[sinkId]);
  }, { pumpId: caseData.pumpId, sourceId: caseData.sourceId, sinkId: caseData.sinkId }, { timeout: 15000 });
  await expect(page.locator('body')).toContainText(caseData.sinkId, { timeout: 15000 });
}

async function runProtectedSolve(page, caseData, { delayNext = false, expectedPreviousId = null } = {}) {
  if (delayNext) {
    await page.evaluate(() => {
      window.__desktopFlowChainDelayNextSolve = true;
    });
  }
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
      projectFile: { sourceFormat: 'ui-temperature-e2e-snapshot' },
      model: copyObject(state?.model || window.__npshGlobalModel || window.globalModel || {}),
      connections: copyArray(state?.connections || window.__npshConnections || window.connections),
      sourceLinks: copyArray(state?.sourceLinks || window.sourceLinks),
      instrumentLinks: copyArray(state?.instrumentLinks || window.instrumentLinks)
    };
  });
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

async function changeSinkBoundaryInBrowser(page, caseData, { elevation, pressure }) {
  return page.evaluate(({ sinkId, elevation: nextElevation, pressure: nextPressure }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const sink = model[sinkId];
    if (!sink) throw new Error(`Missing sink ${sinkId}`);
    window.currentSelectedNode = sinkId;
    sink.props.elevation = nextElevation;
    sink.props.pressure = nextPressure;

    if (typeof window.renderSidebar === 'function') {
      try {
        window.renderSidebar(sinkId);
      } catch (error) {
        window.__desktopFlowChainRenderSidebarError = String(error?.message || error);
      }
    }

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
      return input.value;
    };

    const elevationInputValue = ensureInput('elevation', nextElevation);
    const pressureInputValue = ensureInput('pressure', nextPressure);
    window.CanvasContextDock?.refresh?.();

    return {
      elevationInputValue,
      pressureInputValue,
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
  return page.evaluate(({ pumpId, sinkId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[pumpId] || {};
    const sink = model[sinkId] || {};
    const pumpResults = pump.results || {};
    const response = window.__npshLastBackendSimulationResponse?.response || {};
    const auditPayload = window.EngineeringRouteTraceAudit?.activeAuditPayload?.() || {};
    const defensePayload = window.EngineeringDefenseExportPackage?.activeDefensePayload?.() || {};
    const exportGate = window.EngineeringDefenseExportPackage?.defenseExportGate?.(defensePayload) || null;
    const dock = window.CanvasContextDock?.buildDockState?.() || null;
    const formulaRows = response.results?.calculationTrace?.academicFormulaDefenseRows
      || pumpResults.npshEvaluation?.calculationTrace?.academicFormulaDefenseRows
      || pumpResults.calculationTrace?.academicFormulaDefenseRows
      || [];
    return {
      bodyText: document.body.innerText,
      dock,
      realtime: JSON.parse(JSON.stringify(window.__engineeringCalculationDefenseRealtimeState || null)),
      pump: {
        calculationFreshness: pumpResults.calculationFreshness || null,
        backendValidationStatus: pumpResults.backendValidationStatus || null,
        calculationId: pumpResults.calculationAudit?.calculationId || null,
        dependencyFingerprint: pumpResults.dependencyManifest?.dependencyFingerprint || null,
        routeText: pumpResults.routeTrace?.text || null,
        routeLossFreshness: pumpResults.routeTrace?.lossFreshness || null
      },
      sink: {
        props: JSON.parse(JSON.stringify(sink.props || {})),
        freshness: sink.results?.calculationFreshness || null
      },
      response: {
        calculationId: response.calculationId || null,
        dependencyFingerprint: response.dependencyManifest?.dependencyFingerprint || null,
        priorResultStale: response.dependencyManifest?.priorResultStale === true,
        status: response.results?.status || null,
        flow: response.results?.flow || null,
        npsha: response.results?.npsha || null,
        npshr: response.results?.npshr || null,
        npshMargin: response.results?.npshMargin || null,
        npshRatio: response.results?.npshRatio || null,
        routeTrace: response.routeTrace || null,
        dependencyManifest: response.dependencyManifest || null,
        formulaRows
      },
      audit: {
        routeTraceText: auditPayload.routeTrace?.text || null,
        calculationId: auditPayload.calculationAudit?.calculationId || null,
        dependencyFingerprint: auditPayload.dependencyManifest?.dependencyFingerprint || null
      },
      exportGate
    };
  }, { pumpId: caseData.pumpId, sinkId: caseData.sinkId });
}

async function analysisReportCellSnapshot(page) {
  return page.evaluate(() => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const findComparison = (metric) => {
      const desired = normalize(metric);
      const rows = Array.from(document.querySelectorAll('.journal-analysis-comparison-table tbody tr'));
      const row = rows.find((item) => normalize(item.cells?.[0]?.textContent) === desired);
      return row ? {
        metric: row.cells[0]?.textContent.trim() || '',
        journal: row.cells[1]?.textContent.trim() || '',
        application: row.cells[2]?.textContent.trim() || '',
        error: row.cells[3]?.textContent.trim() || ''
      } : null;
    };
    const findApplicationValue = (metric) => {
      const desired = normalize(metric);
      const sections = Array.from(document.querySelectorAll('.journal-analysis-report-panel section, .journal-analysis-report-panel article'));
      const section = sections.find((item) => /application input|application data|data input|hasil aplikasi/i.test(item.textContent || ''));
      const rows = Array.from(section?.querySelectorAll('table tbody tr') || []);
      const row = rows.find((item) => normalize(item.cells?.[0]?.textContent) === desired);
      return row ? {
        metric: row.cells[0]?.textContent.trim() || '',
        value: row.cells[1]?.textContent.trim() || ''
      } : null;
    };
    return {
      tempComparison: findComparison('Fluid Basis - Temperature'),
      pumpHeadComparison: findComparison('Pump - Pump head evaluated'),
      pumpNpshrComparison: findComparison('Pump - NPSHr'),
      pumpNpshaNpshrComparison: findComparison('Pump - NPSHa / NPSHr'),
      pumpMarginComparison: findComparison('Pump - NPSH margin'),
      pumpRatioComparison: findComparison('Pump - NPSH ratio'),
      pumpMarginRatioComparison: findComparison('Pump - NPSH Margin / Ratio'),
      viscosityApplication: findApplicationValue('Fluid Basis - Kinematic viscosity'),
      lastRefresh: window.__npshAnalysisReportLiveLastRefresh || null
    };
  });
}

function formulaRow(snapshot, stepName) {
  const rows = snapshot?.response?.formulaRows
    || snapshot?.results?.calculationTrace?.academicFormulaDefenseRows
    || [];
  const aliases = stepName === 'System Curve Head'
    ? ['System Curve Head', 'Required Pump Head']
    : [stepName];
  return rows.find((row) => aliases.includes(row.step)) || {};
}

function systemHead(responseBody) {
  const row = (responseBody.results?.calculationTrace?.academicFormulaDefenseRows || [])
    .find((item) => item.step === 'System Curve Head' || item.step === 'Required Pump Head');
  return Number(row?.result);
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

test('Simulasi 1 desktop chain refreshes route/formula/dependency after SINK edit', async ({ page }, testInfo) => {
  const caseData = loadJournalCase('simulation-case-1');
  await waitForNpshApp(page);
  await loadProject(page, caseData);

  const baseline = await runProtectedSolve(page, caseData);
  const baselineSnapshot = await browserSnapshot(page, caseData);

  expect(baseline.results.status).toBe('Safe');
  expect(baseline.results.flow).toBe(50);
  expect(baseline.results.npsha).toBeCloseTo(6.4656, 4);
  expect(baseline.results.npshr).toBeCloseTo(2.4002, 4);
  expect(baseline.routeTrace.sequence).toEqual(['FLUID', 'SRC-100', 'PIPE-1', 'P-100', 'PIPE-2', 'SNK-100']);
  expect(baseline.routeTrace.sections.suction.pressureDropBar).toBeCloseTo(0.245897, 5);
  expect(baseline.routeTrace.sections.discharge.pressureDropBar).toBeCloseTo(1.097003, 5);
  expect(baselineSnapshot.bodyText).toContain('Water @ 100.0 deg C');
  expect(baselineSnapshot.bodyText).toContain('NPSH Available');
  expect(baselineSnapshot.dock.routeNodes).toEqual(['Fluid Basis', 'SRC-100', 'PIPE-1', 'P-100', 'PIPE-2', 'SNK-100']);
  expect(baselineSnapshot.audit.routeTraceText).toContain('SNK-100');
  expect(formulaRow(baseline, 'System Curve Head').substitution).toContain('1.946 + 2.616 + 11.669 = 16.230 m');
  expect(formulaRow(baseline, 'System Curve Head').result).toBeCloseTo(16.23, 3);
  expect(baselineSnapshot.exportGate.canExport).toBe(true);

  const suctionSegmentAudit = await page.evaluate((pumpId) => {
    window.EngineeringRealtimeCalculationDefense?.publishCanonicalCalculationState?.('e2e-segment-audit', pumpId);
    window.EngineeringParameterTaskRuntime?.openParameterSuctionTaskWindow?.(pumpId);
    const model = window.__npshGlobalModel || window.globalModel || {};
    const rows = window.EngineeringRealtimeCalculationDefense?.buildPipeSegmentRows?.('PIPE-1', model['PIPE-1'], model) || [];
    const tableText = document.querySelector('.parameter-suction-task-window .parameter-segment-table')?.innerText || '';
    return {
      rows,
      tableText
    };
  }, caseData.pumpId);
  expect(suctionSegmentAudit.rows[0].diameter).toBeCloseTo(0.098, 4);
  expect(suctionSegmentAudit.rows[0].reynolds).toBeCloseTo(224717, 0);
  expect(suctionSegmentAudit.rows[0].majorLoss).toBeCloseTo(0.08038, 5);
  expect(suctionSegmentAudit.tableText).toContain('D=0.0980');
  expect(suctionSegmentAudit.tableText).toContain('Re=224717');
  expect(suctionSegmentAudit.tableText).not.toContain('D=-');
  expect(suctionSegmentAudit.tableText).not.toContain('Major -');

  const staleSnapshot = await changeSinkBoundaryInBrowser(page, caseData, {
    elevation: 15,
    pressure: 1.9437071290497523
  });
  expect(staleSnapshot.realtime.status).toBe('Stale');
  expect(staleSnapshot.pumpFreshness).toBe('Stale');
  expect(Number(staleSnapshot.sinkProps.elevation)).toBe(15);
  expect(Number(staleSnapshot.sinkProps.pressure)).toBeCloseTo(1.9437071290497523, 8);

  const changedResponsePromise = page.waitForResponse((response) => (
    /\/api\/simulate(?:[?#]|$)/.test(response.url())
    && response.request().method() === 'POST'
    && response.status() === 200
  ), { timeout: 30000 });
  const changedSolvePromise = page.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    let delayed = false;
    window.fetch = async (...args) => {
      if (!delayed && String(args[0] || '').includes('/api/simulate')) {
        delayed = true;
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      return originalFetch(...args);
    };
    return window.updateSimulation({
      refreshReason: 'solve',
      trigger: 'solve',
      forceBackend: true,
      renderSidebarAfter: false
    }).finally(() => {
      window.fetch = originalFetch;
    });
  });

  await page.waitForFunction((pumpId) => (
    window.__engineeringCalculationDefenseRealtimeState?.status === 'Calculating'
    && ['Calculating', 'Connected'].includes(
      (window.__npshGlobalModel || window.globalModel)?.[pumpId]?.results?.backendValidationStatus
    )
  ), caseData.pumpId, { timeout: 10000 });
  const calculatingSnapshot = await browserSnapshot(page, caseData);
  expect(['Calculating', 'Current']).toContain(calculatingSnapshot.realtime.status);
  expect(['Calculating', 'Connected']).toContain(calculatingSnapshot.pump.backendValidationStatus);

  await changedResponsePromise;
  await changedSolvePromise;
  await page.waitForFunction((previousCalculationId) => {
    const response = window.__npshLastBackendSimulationResponse?.response || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pumpId = Object.keys(model).find((id) => model[id]?.type === 'pump');
    const pumpResults = model[pumpId]?.results || {};
    return !!response.calculationId
      && response.calculationId !== previousCalculationId
      && state.calculationId === response.calculationId
      && pumpResults.calculationAudit?.calculationId === response.calculationId;
  }, baseline.calculationId, { timeout: 15000 });
  const changed = await page.evaluate(() => window.__npshLastBackendSimulationResponse?.response || null);
  const changedSnapshot = await browserSnapshot(page, caseData);

  expect(changed.calculationId).not.toBe(baseline.calculationId);
  expect(changed.dependencyManifest.dependencyFingerprint).not.toBe(baseline.dependencyManifest.dependencyFingerprint);
  expect(changed.dependencyManifest.priorResultStale).toBe(true);
  expect(systemHead(changed)).toBeGreaterThan(systemHead(baseline));
  expect(changed.results.flow).toBe(baseline.results.flow);
  expect(changed.results.npsha).toBe(baseline.results.npsha);
  expect(changedSnapshot.realtime.status).toBe('Current');
  expect(changedSnapshot.realtime.calculationId).toBe(changed.calculationId);
  expect(changedSnapshot.pump.calculationId).toBe(changed.calculationId);
  expect(changedSnapshot.pump.backendValidationStatus).toBe('Connected');
  expect(changedSnapshot.pump.dependencyFingerprint).toBe(changed.dependencyManifest.dependencyFingerprint);
  expect(changedSnapshot.response.routeTrace.sections.discharge.pressureDropBar).toBeCloseTo(1.097003, 5);
  expect(formulaRow(changed, 'System Static Head').substitution).toContain('26.315 - 19.369 = 6.946 m');
  expect(formulaRow(changed, 'System Curve Head').substitution).toContain('21.230 m');
  expect(JSON.stringify(changedSnapshot.response.dependencyManifest.sinkImpactMatrix)).toMatch(/sink\.props\.elevation/);
  expect(changedSnapshot.audit.routeTraceText).toContain('Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 -> PIPE-2 -> SNK-100');
  expect(changedSnapshot.exportGate.canExport).toBe(true);

  expect(page.__desktopFlowChainRequests.length).toBeGreaterThanOrEqual(2);
  const changedPayload = page.__desktopFlowChainRequests[page.__desktopFlowChainRequests.length - 1].payload;
  expect(changedPayload.client.previousDependencyFingerprint).toBe(baseline.dependencyManifest.dependencyFingerprint);
  expect(Number(changedPayload.model['SNK-100'].props.elevation)).toBe(15);
  expect(Number(changedPayload.model['SNK-100'].props.pressure)).toBeCloseTo(1.9437071290497523, 8);

  const screenshotPath = testInfo.outputPath('simulasi-1-flow-chain-after-sink-edit.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('simulasi 1 flow chain after sink edit', { path: screenshotPath, contentType: 'image/png' });

  console.log(JSON.stringify({
    desktopFlowChainE2E: 'pass',
    caseId: 'simulation-case-1',
    backendCalls: page.__desktopFlowChainRequests.length,
    baseline: {
      calculationId: baseline.calculationId,
      dependencyFingerprint: baseline.dependencyManifest.dependencyFingerprint,
      systemHead: systemHead(baseline),
      npsha: baseline.results.npsha
    },
    changed: {
      calculationId: changed.calculationId,
      dependencyFingerprint: changed.dependencyManifest.dependencyFingerprint,
      priorResultStale: changed.dependencyManifest.priorResultStale,
      systemHead: systemHead(changed),
      npsha: changed.results.npsha
    },
    statesObserved: {
      stale: staleSnapshot.realtime.status,
      calculating: calculatingSnapshot.realtime.status,
      current: changedSnapshot.realtime.status
    },
    routeTraceUpdated: changedSnapshot.audit.routeTraceText,
    formulaDefenseUpdated: formulaRow(changed, 'System Curve Head').substitution,
    screenshotPath
  }, null, 2));
});

test('Analysis Report live cells refresh from current calculation state without rebuilding layout', async ({ page }) => {
  const caseData = loadJournalCase('simulation-case-1');
  await waitForNpshApp(page);
  await loadProject(page, caseData);
  await runProtectedSolve(page, caseData);

  await page.evaluate(({ entry, report }) => {
    window.openJournalAnalysisTaskWindow(entry, report);
    window.EngineeringAnalysisReportLiveRuntime?.refresh?.();
  }, { entry: caseData.entry, report: caseData.report });

  await page.waitForSelector('.journal-analysis-task-window .journal-analysis-comparison-table', { timeout: 10000 });
  const xlsxExportButton = page.locator('.journal-analysis-task-window [data-analysis-report-xlsx-export="true"]');
  await expect(xlsxExportButton).toBeVisible({ timeout: 10000 });
  await expect(xlsxExportButton).toHaveText('XLSX');
  const baselineReport = await analysisReportCellSnapshot(page);
  expect(baselineReport.tempComparison.application).toContain('100 deg C');
  expect(baselineReport.pumpHeadComparison.application).toContain('24 m');
  expect(baselineReport.viscosityApplication.value).toContain('0.803');

  await page.evaluate((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    model.FLUID.props.temp = 80;
    model.FLUID.props.viscosity = 0.355;
    model.FLUID.props.dynViscosity = 0.344;
    const pump = model[pumpId];
    pump.results.actualPumpHead = 31.127;
    pump.results.pumpHeadAtFlow = 31.127;
    pump.results.head = 31.127;
    pump.results.actualPumpHeadAvailable = true;
    pump.results.npshEvaluation.actualPumpHead = 31.127;
    pump.results.npshEvaluation.actualPumpHeadAvailable = true;
    pump.results.requiredSystemHead = 31.127;
    window.EngineeringAnalysisReportLiveRuntime.refresh();
  }, caseData.pumpId);

  await page.waitForFunction(() => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const comparisonRows = Array.from(document.querySelectorAll('.journal-analysis-comparison-table tbody tr'));
    const tempRow = comparisonRows.find((row) => normalize(row.cells?.[0]?.textContent) === 'fluid basis - temperature');
    const headRow = comparisonRows.find((row) => normalize(row.cells?.[0]?.textContent) === 'pump - pump head evaluated');
    const appSections = Array.from(document.querySelectorAll('.journal-analysis-report-panel section, .journal-analysis-report-panel article'));
    const appSection = appSections.find((section) => /application input|application data|data input|hasil aplikasi/i.test(section.textContent || ''));
    const viscosityRow = Array.from(appSection?.querySelectorAll('table tbody tr') || [])
      .find((row) => normalize(row.cells?.[0]?.textContent) === 'fluid basis - kinematic viscosity');
    return tempRow?.cells?.[2]?.textContent.includes('80 deg C')
      && headRow?.cells?.[2]?.textContent.includes('31.127 m')
      && viscosityRow?.cells?.[1]?.textContent.includes('0.355 cSt');
  }, null, { timeout: 10000 });

  const changedReport = await analysisReportCellSnapshot(page);
  expect(changedReport.tempComparison.application).toBe('80 deg C');
  expect(changedReport.pumpHeadComparison.application).toBe('31.127 m');
  expect(changedReport.viscosityApplication.value).toBe('0.355 cSt');
  expect(changedReport.lastRefresh?.changed).toBeGreaterThanOrEqual(3);
  const workbookSnapshot = await page.evaluate(() => {
    const taskWindow = document.querySelector('.journal-analysis-task-window');
    const workbook = window.EngineeringAnalysisReportLiveRuntime.collectAnalysisReportWorkbook(taskWindow);
    const bytes = window.EngineeringAnalysisReportLiveRuntime.buildXlsxBytes(workbook);
    return {
      sheetNames: workbook.sheets.map((sheet) => sheet.name),
      byteLength: bytes.length,
      zipHeader: Array.from(bytes.slice(0, 4)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
    };
  });
  expect(workbookSnapshot.sheetNames).toEqual(['Report Text', 'Journal vs Application Comparis']);
  expect(workbookSnapshot.byteLength).toBeGreaterThan(1200);
  expect(workbookSnapshot.zipHeader).toBe('504b0304');

  await page.evaluate(() => {
    const taskWindow = document.querySelector('.journal-analysis-task-window');
    const panel = taskWindow?.querySelector('.journal-analysis-report-panel') || taskWindow?.querySelector('.task-window-body');
    if (!taskWindow || !panel) throw new Error('Analysis Report task window is not open.');
    Object.assign(taskWindow.style, {
      left: '12px',
      top: '4px',
      width: '992px',
      height: '760px'
    });
    const card = document.createElement('section');
    card.className = 'journal-analysis-card analysis-responsive-probe-card';
    card.innerHTML = `
      <h3>Responsive Formula Probe</h3>
      <article class="academic-equation-step">
        <div class="academic-equation-display formula-defense-equation-surface">
          <span class="academic-equation-math formula-defense-inline-equation analysis-responsive-probe">
            FluidBasisJSON+decoded.untirtavalidationAudit/model/resultsAtOpenTime;staticCase1FormulasOverrideGenericDynamicHydraulicRouteTraceSourcePipePumpDischargePipeSNKNetworkCalculateTargetFlowRequiredHeadNPSHaAllowableNPSHrAndOutletPressure
          </span>
        </div>
      </article>`;
    panel.appendChild(card);
    window.EngineeringAnalysisReportLiveRuntime?.installResponsiveCss?.();
  });

  await page.waitForFunction(() => {
    const taskWindow = document.querySelector('.journal-analysis-task-window');
    const body = taskWindow?.querySelector('.task-window-body') || taskWindow;
    const probe = taskWindow?.querySelector('.analysis-responsive-probe');
    if (!body || !probe) return false;
    const bodyRect = body.getBoundingClientRect();
    const probeRect = probe.getBoundingClientRect();
    return getComputedStyle(probe).whiteSpace === 'normal'
      && body.scrollWidth <= body.clientWidth + 2
      && probeRect.right <= bodyRect.right + 2;
  }, null, { timeout: 10000 });
});

test('Fluid Basis temperature UI solve matches direct backend and reports route losses', async ({ page }, testInfo) => {
  const caseData = loadJournalCase('simulation-case-1');
  await waitForNpshApp(page);
  await loadProject(page, caseData);

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

    rows.push({
      temperature,
      ui: uiSummary,
      backend: backendSummary,
      fluidBasis: {
        propertyMethod: uiProjectState.model.FLUID?.props?.propertyMethod || '',
        temperaturePropertySynced: uiProjectState.model.FLUID?.props?.temperaturePropertySynced === true,
        density: roundMetric(uiProjectState.model.FLUID?.props?.density),
        viscosity: roundMetric(uiProjectState.model.FLUID?.props?.viscosity),
        vaporPressure: roundMetric(uiProjectState.model.FLUID?.props?.vaporPressure)
      }
    });
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

  await testInfo.attach('fluid-temperature-ui-backend-parity-summary.json', {
    body: JSON.stringify({
      caseId: 'simulation-case-1',
      model: 'UI snapshot after Fluid Basis Temperature edit, then direct backend solve with identical snapshot',
      requiredFields: ['rho', 'viscosity', 'pvap', 'hLSuction', 'hLDischarge', 'hRequired', 'npsha', 'margin'],
      rows
    }, null, 2),
    contentType: 'application/json'
  });
  console.log(JSON.stringify({
    fluidTemperatureUiBackendParity: 'pass',
    routeLossesAlwaysReported: true,
    rows
  }, null, 2));
});

test('Fluid Basis temperature lock warning appears when journal properties stay stale', async ({ page }) => {
  const caseData = loadJournalCase('simulation-case-1');
  await waitForNpshApp(page);
  await loadProject(page, caseData);

  await page.locator('#btn-fluid-basis').click();
  await expect(page.locator('#fluid-task-temp').first()).toBeVisible({ timeout: 10000 });

  const warningState = await page.evaluate(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const props = model.FLUID?.props || {};
    props.fluidName = 'Water';
    props.temp = 80;
    props.density = 958.3484;
    props.viscosity = 0.803;
    props.kinematicViscosity = 0.803;
    props.dynViscosity = 0.7696;
    props.dynamicViscosity = 0.7696;
    props.vaporPressure = 1.01418;
    props.propertyMethod = 'Journal Case 6 validation basis: Water at 100 deg C; manual properties locked for fixture validation.';
    props.fluidPropertySource = 'Journal Case 6 validation basis';
    delete props.temperaturePropertySyncRequested;
    delete props.temperaturePropertySynced;
    const runtime = window.NPSHSourceTemperatureRuntime;
    const warning = runtime?.getFluidBasisTemperaturePropertyWarning?.() || null;
    runtime?.renderFluidBasisTemperaturePropertyWarning?.();
    return {
      warning,
      text: document.querySelector('[data-fluid-temperature-property-warning="true"]')?.textContent || ''
    };
  });

  expect(warningState.warning?.id).toBe('fluid-temperature-property-lock');
  expect(warningState.warning?.severity).toBe('warning');
  expect(warningState.warning?.temperature).toBe(80);
  expect(warningState.warning?.methodTemperature).toBe(100);
  expect(warningState.text).toMatch(/density, viscosity, and vapor pressure/i);
  expect(warningState.text).toMatch(/locked\/manual\/journal/i);
});

test('Source Properties shows Volumetric Flow in Boundary Data and removes Source Definition plus Flow Specification', async ({ page }) => {
  const caseData = loadJournalCase('simulation-case-1');
  await waitForNpshApp(page);
  await loadProject(page, caseData);

  await page.evaluate((sourceId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const source = model[sourceId];
    if (!source) throw new Error(`Missing source ${sourceId}`);
    source.props.flowInputMode = 'Mass Flow';
    source.props.massFlow = 9500;
    delete source.props.flow;
    window.currentSelectedNode = sourceId;
    const taskRoot = window.createObjectPropertiesTaskRoot?.(sourceId);
    const taskWindow = taskRoot && typeof window.openPersistentObjectPropertiesTaskWindow === 'function'
      ? window.openPersistentObjectPropertiesTaskWindow('object', sourceId, `${sourceId} Properties`, taskRoot, { skipDismissedGuard: true })
      : null;
    window.renderSidebar?.(sourceId, { taskWindow, skipDismissedGuard: true, preserveScroll: true });
    window.EngineeringSourceVolumetricOnlyRuntime?.install?.();
    window.EngineeringSourceVolumetricOnlyRuntime?.cleanup?.(document);
  }, caseData.sourceId);

  await page.waitForFunction(() => (
    window.EngineeringSourceVolumetricOnlyRuntime?.version === '2026.07-source-boundary-clean2'
    && document.documentElement.dataset.sourceVolumetricOnlyRuntime === '2026.07-source-boundary-clean2'
  ), null, { timeout: 10000 });

  const state = await page.evaluate((sourceId) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const rowOf = (element) => element?.closest?.('.object-task-field-row, .pipe-task-field-row, tr, .prop-row') || element;
    const scopes = Array.from(document.querySelectorAll('#taskWindow, .task-window, .object-properties-task-body, .task-window-body, [role="dialog"]'));
    const scope = scopes.find((candidate) => (
      candidate.querySelector?.(`[data-node="${sourceId}"]`)
      || normalize(candidate.textContent).includes(sourceId)
    )) || document;
    const visibleRows = Array.from(scope.querySelectorAll('.object-task-field-row, .pipe-task-field-row, tr, .prop-row, h2, h3, h4, .task-section-title, .object-task-section-title'))
      .filter(isVisible)
      .map((row) => ({
        text: normalize(row.textContent),
        key: row.dataset?.propKey || row.querySelector?.('[data-key]')?.dataset?.key || ''
      }));
    const flowInput = scope.querySelector(`input[data-node="${sourceId}"][data-key="flow"]`);
    const flowRow = rowOf(flowInput);
    const flowRowIndex = visibleRows.findIndex((row) => row.text === normalize(flowRow?.textContent));
    const boundaryIndex = visibleRows.findIndex((row) => /^Boundary Data$/i.test(row.text));
    const nextSectionIndex = visibleRows.findIndex((row, index) => (
      index > boundaryIndex
      && !row.key
      && row.text
      && row.text.length < 80
      && /definition|fluid basis|npsh|calculation/i.test(row.text)
    ));
    const model = window.__npshGlobalModel || window.globalModel || {};
    const source = model[sourceId] || {};
    return {
      text: normalize(scope.textContent),
      runtime: window.EngineeringSourceVolumetricOnlyRuntime?.version || '',
      flowMode: source.props?.flowInputMode || '',
      flow: source.props?.flow ?? null,
      massFlow: source.props?.massFlow ?? null,
      density: model.FLUID?.props?.density ?? null,
      hasFlowInput: !!flowInput && isVisible(flowInput),
      flowRowText: normalize(flowRow?.textContent),
      boundaryIndex,
      flowRowIndex,
      nextSectionIndex,
      visibleFlowSpec: visibleRows.some((row) => /Flow Specification/i.test(row.text)),
      visibleSourceDefinition: visibleRows.some((row) => /Source Definition/i.test(row.text)),
      visibleSourceType: visibleRows.some((row) => /^Source Type\b/i.test(row.text)),
      visibleTypeMeaning: visibleRows.some((row) => /^Type Meaning\b/i.test(row.text)),
      visibleFlowInputMode: visibleRows.some((row) => /Flow Input Mode/i.test(row.text)),
      visibleMassFlow: visibleRows.some((row) => /^Mass Flow\b/i.test(row.text)) || !!Array.from(scope.querySelectorAll('input[data-key="massFlow"], input[name="massFlow"]')).find(isVisible),
      visibleRows
    };
  }, caseData.sourceId);

  expect(state.runtime).toBe('2026.07-source-boundary-clean2');
  expect(state.flowMode).toBe('Volumetric Flow');
  expect(Number(state.flow)).toBeCloseTo(9500 / Number(state.density), 4);
  expect(Number(state.massFlow)).toBeCloseTo(9500, 2);
  expect(state.hasFlowInput).toBe(true);
  expect(state.flowRowText).toMatch(/Volumetric Flow/i);
  expect(state.visibleFlowSpec).toBe(false);
  expect(state.visibleSourceDefinition).toBe(false);
  expect(state.visibleSourceType).toBe(false);
  expect(state.visibleTypeMeaning).toBe(false);
  expect(state.visibleFlowInputMode).toBe(false);
  expect(state.visibleMassFlow).toBe(false);
  expect(state.boundaryIndex).toBeGreaterThanOrEqual(0);
  expect(state.flowRowIndex).toBeGreaterThan(state.boundaryIndex);
  if (state.nextSectionIndex >= 0) expect(state.flowRowIndex).toBeLessThan(state.nextSectionIndex);
});

test('Source Properties input edits stay clean, stable, and responsive', async ({ page }) => {
  const caseData = loadJournalCase('simulation-case-1');
  await waitForNpshApp(page);
  await loadProject(page, caseData);

  await page.evaluate((sourceId) => {
    const taskRoot = window.createObjectPropertiesTaskRoot?.(sourceId);
    const taskWindow = taskRoot && typeof window.openPersistentObjectPropertiesTaskWindow === 'function'
      ? window.openPersistentObjectPropertiesTaskWindow('object', sourceId, `${sourceId} Properties`, taskRoot, { skipDismissedGuard: true })
      : null;
    window.currentSelectedNode = sourceId;
    window.renderSidebar?.(sourceId, { taskWindow, skipDismissedGuard: true, preserveScroll: true });
    window.EngineeringSourceVolumetricOnlyRuntime?.install?.();
    window.EngineeringSourceVolumetricOnlyRuntime?.cleanup?.(document);
  }, caseData.sourceId);

  await page.waitForFunction((sourceId) => {
    const win = document.querySelector(`.persistent-object-properties-task-window[data-node-id="${sourceId}"]`);
    return !!win
      && !win.hidden
      && !!win.querySelector('input[data-key="pressure"]')
      && !!win.querySelector('input[data-key="flow"]')
      && !!win.querySelector('input[data-key="elevation"]');
  }, caseData.sourceId, { timeout: 15000 });

  const sourceWindow = page.locator(`.persistent-object-properties-task-window[data-node-id="${caseData.sourceId}"]`).first();
  const beforeRect = await sourceWindow.boundingBox();
  expect(beforeRect).toBeTruthy();

  await page.evaluate((sourceId) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    window.__sourceInputCleanSamples = [];
    window.__sourceInputCleanStop = false;
    const sample = () => {
      const win = document.querySelector(`.persistent-object-properties-task-window[data-node-id="${sourceId}"]`);
      if (win && isVisible(win)) {
        const visibleText = Array.from(win.querySelectorAll('.object-task-field-row, .pipe-task-field-row, tr, h2, h3, h4, .task-section-title, .object-task-section-title'))
          .filter(isVisible)
          .map((row) => normalize(row.textContent))
          .join(' | ');
        if (/\b(Source Definition|Source Type|Type Meaning|Flow Specification|Flow Input Mode|Mass Flow)\b/i.test(visibleText)) {
          window.__sourceInputCleanSamples.push({ time: performance.now(), visibleText });
        }
      }
      if (!window.__sourceInputCleanStop) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, caseData.sourceId);

  await sourceWindow.locator('input[data-key="pressure"]').first().fill('2.250');
  await sourceWindow.locator('input[data-key="flow"]').first().fill('11.500');
  await sourceWindow.locator('input[data-key="elevation"]').first().fill('1.250');

  await page.waitForFunction((sourceId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const source = model[sourceId];
    return source?.props
      && Number(source.props.pressure) === 2.25
      && Number(source.props.flow) === 11.5
      && Number(source.props.elevation) === 1.25
      && state.status !== 'Calculating';
  }, caseData.sourceId, { timeout: 20000 });

  await page.waitForTimeout(600);
  const editState = await page.evaluate((sourceId) => {
    window.__sourceInputCleanStop = true;
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const win = document.querySelector(`.persistent-object-properties-task-window[data-node-id="${sourceId}"]`);
    const rows = Array.from(win?.querySelectorAll?.('.object-task-field-row, .pipe-task-field-row, tr, h2, h3, h4, .task-section-title, .object-task-section-title') || [])
      .filter(isVisible)
      .map((row) => normalize(row.textContent));
    const model = window.__npshGlobalModel || window.globalModel || {};
    const source = model[sourceId] || {};
    return {
      samples: window.__sourceInputCleanSamples || [],
      text: rows.join(' | '),
      pressure: source.props?.pressure,
      flow: source.props?.flow,
      elevation: source.props?.elevation,
      runtime: window.EngineeringSourceVolumetricOnlyRuntime?.version || '',
      realtimeStatus: window.__engineeringCalculationDefenseRealtimeState?.status || ''
    };
  }, caseData.sourceId);
  const afterRect = await sourceWindow.boundingBox();

  expect(editState.runtime).toBe('2026.07-source-boundary-clean2');
  expect(editState.samples).toEqual([]);
  expect(editState.text).not.toMatch(/\b(Source Definition|Source Type|Type Meaning|Flow Specification|Flow Input Mode|Mass Flow)\b/i);
  expect(Number(editState.pressure)).toBeCloseTo(2.25, 3);
  expect(Number(editState.flow)).toBeCloseTo(11.5, 3);
  expect(Number(editState.elevation)).toBeCloseTo(1.25, 3);
  expect(afterRect).toBeTruthy();
  expect(Math.abs(afterRect.x - beforeRect.x)).toBeLessThanOrEqual(4);
  expect(Math.abs(afterRect.y - beforeRect.y)).toBeLessThanOrEqual(4);
  expect(Math.abs(afterRect.width - beforeRect.width)).toBeLessThanOrEqual(8);
  expect(Math.abs(afterRect.height - beforeRect.height)).toBeLessThanOrEqual(12);
});

test('Disconnected Source/Pump/Sink presentation stays incomplete and compact', async ({ page }) => {
  const caseData = loadJournalCase('simulation-case-1');
  const disconnectedProject = clone(caseData.project);
  disconnectedProject.connections = [];
  disconnectedProject.sourceLinks = [];
  Object.values(disconnectedProject.model || {}).forEach((node) => {
    if (['source', 'pump', 'sink', 'pipe'].includes(node?.type)) node.results = {};
  });

  await waitForNpshApp(page);
  await loadProject(page, { ...caseData, project: disconnectedProject });

  await page.evaluate(() => {
    window.CanvasContextDock?.refresh?.();
    window.EngineeringRouteTraceAudit?.refreshVisibleAuditSurfaces?.();
  });

  await page.waitForFunction((pumpId) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const panel = Array.from(document.querySelectorAll('.pump-live-params')).find((candidate) => {
      const object = candidate.closest('.pfd-object, [data-node-id], [data-object-id]');
      return object?.dataset?.nodeId === pumpId
        || object?.dataset?.objectId === pumpId
        || normalize(object?.textContent).includes(pumpId)
        || normalize(candidate.textContent).includes(pumpId)
        || document.querySelectorAll('.pump-live-params').length === 1;
    });
    return !!panel && normalize(panel.textContent).includes('Backend Valid.');
  }, caseData.pumpId, { timeout: 15000 });

  const state = await page.evaluate(({ sourceId, pumpId, sinkId }) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const objectFor = (id, type) => Array.from(document.querySelectorAll(`.pfd-object.object-type-${type}, .pfd-object[data-type="${type}"], .pfd-object`))
      .find((object) => (
        (object.classList?.contains(`object-type-${type}`) || object.dataset?.type === type)
        && (object.dataset?.nodeId === id || object.dataset?.objectId === id || normalize(object.textContent).includes(id))
      )) || null;
    const rowMap = (panel, prefix) => Object.fromEntries(Array.from(panel?.querySelectorAll?.(`.${prefix}-live-param-row`) || []).map((row) => {
      const label = normalize(row.querySelector(`.${prefix}-live-param-label`)?.textContent);
      const value = normalize(row.querySelector(`.${prefix}-live-param-value, strong`)?.textContent);
      return [label, value];
    }).filter(([label]) => label));

    const sourceObject = objectFor(sourceId, 'source');
    const pumpObject = objectFor(pumpId, 'pump');
    const sinkObject = objectFor(sinkId, 'sink');
    const sourcePanel = sourceObject?.querySelector('.source-live-params') || document.querySelector('.source-live-params');
    const pumpPanel = pumpObject?.querySelector('.pump-live-params') || document.querySelector('.pump-live-params');

    window.currentSelectedNode = sinkId;
    const sinkRoot = window.createObjectPropertiesTaskRoot?.(sinkId);
    const sinkWindow = sinkRoot && typeof window.openPersistentObjectPropertiesTaskWindow === 'function'
      ? window.openPersistentObjectPropertiesTaskWindow('object', sinkId, `${sinkId} Properties`, sinkRoot, { skipDismissedGuard: true })
      : null;
    window.renderSidebar?.(sinkId, { taskWindow: sinkWindow, skipDismissedGuard: true, preserveScroll: true });
    window.EngineeringRouteTraceAudit?.syncSinkPropertyWindowCanonicalReadouts?.(document);
    const sinkTaskWindow = sinkWindow || Array.from(document.querySelectorAll('.persistent-object-properties-task-window, #taskWindow, .task-window'))
      .find((candidate) => isVisible(candidate) && normalize(candidate.textContent).includes(sinkId)) || null;
    const sinkRows = Array.from(sinkTaskWindow?.querySelectorAll?.('.object-task-field-row, .pipe-task-field-row, tr, .prop-row, .field-row, .property-row') || [])
      .filter(isVisible)
      .map((row) => normalize(row.querySelector('.prop-label, label, th, td:first-child, div:first-child, span:first-child')?.textContent || row.textContent))
      .filter(Boolean);
    const sinkVisibleText = normalize(sinkTaskWindow?.innerText || '');

    sourceObject?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 120, clientY: 120 }));
    window.EngineeringSourceVolumetricOnlyRuntime?.cleanup?.(document);
    const menuText = normalize(document.getElementById('canvasContextMenu')?.textContent || '');

    return {
      source: {
        objectStatus: sourceObject?.dataset?.operatingStatus || '',
        objectClass: sourceObject?.className || '',
        panelClass: sourcePanel?.className || '',
        title: sourceObject?.title || ''
      },
      pump: {
        objectStatus: pumpObject?.dataset?.operatingStatus || '',
        objectClass: pumpObject?.className || '',
        rows: rowMap(pumpPanel, 'pump')
      },
      sink: {
        rows: sinkRows,
        visibleText: sinkVisibleText
      },
      menuText
    };
  }, { sourceId: caseData.sourceId, pumpId: caseData.pumpId, sinkId: caseData.sinkId });

  expect(state.source.objectStatus).toBe('incomplete');
  expect(state.source.objectClass).toContain('source-status-incomplete');
  expect(state.source.panelClass).toContain('source-live-params-incomplete');
  expect(state.source.title).toContain('SRC status: Incomplete');
  expect(['', 'incomplete']).toContain(state.pump.objectStatus);
  expect(state.pump.objectClass).toContain('pump-status-incomplete');
  expect(state.pump.rows['Hydraulic NPSH']).toBe('Incomplete');
  expect(state.pump.rows['Backend Valid.']).toBe('Unverified');
  expect(Object.keys(state.pump.rows)).not.toContain('Pump Head');
  expect(Object.keys(state.pump.rows)).toContain('Required Head');
  expect(state.sink.visibleText).toMatch(/Flow Demand/i);
  expect(state.sink.visibleText).toMatch(/Volumetric Flow/i);
  expect(state.sink.visibleText).toMatch(/Calculated Abs\. Pressure/i);
  expect(state.sink.visibleText).toMatch(/Elevation/i);
  expect(state.sink.visibleText).not.toMatch(/\bActive\b|Boundary Mode|Pipe Pressure Type/i);
  expect(state.sink.visibleText).not.toMatch(/Calculated Outlet Readout|Attached Pipe|Boundary Pressure Abs\.|Calc\. Boundary P|Pressure Residual|Static Pipe P|Stagnation P|Mass Flow|Hydraulic Head|Warnings/i);
  expect(state.menuText).toMatch(/User Task Object Properties|Object Properties/i);
  expect(state.menuText).toMatch(/Connect/i);
  expect(state.menuText).toMatch(/Delete Source/i);
  expect(state.menuText).not.toMatch(/Open Tank|Pressurized Vessel|External Header|Fixed Flow Source|Standalone Boundary Source/i);
});

test('Fluid Basis temperature edit autosolves pump route without solver click', async ({ page }, testInfo) => {
  const caseData = loadJournalCase('simulation-case-1');
  await waitForNpshApp(page);
  await loadProject(page, caseData);

  const baseline = await runProtectedSolve(page, caseData);
  const baselineSummary = temperatureSummaryFromSimulation(baseline);
  expectFiniteTemperatureSummary(baselineSummary, 'baseline');
  expect(baselineSummary.temperature).toBe(100);

  await page.locator('#btn-fluid-basis').click();
  const temperatureInput = page.locator('#fluid-task-temp').first();
  await expect(temperatureInput).toBeVisible({ timeout: 10000 });

  const autoResponsePromise = page.waitForResponse((response) => (
    /\/api\/simulate(?:[?#]|$)/.test(response.url())
    && response.request().method() === 'POST'
    && response.status() === 200
  ), { timeout: 30000 });

  await temperatureInput.click();
  await temperatureInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await temperatureInput.type('80');

  await page.waitForFunction((pumpId) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    return ['Calculating', 'Stale'].includes(results.backendValidationStatus)
      || ['Calculating', 'Stale'].includes(state.status);
  }, caseData.pumpId, { timeout: 10000 });

  const autoResponse = await autoResponsePromise;
  const autoBody = await autoResponse.json();

  await page.waitForFunction(({ pumpId, calculationId, baselineId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const activeId = results.calculationAudit?.calculationId || state.calculationId || null;
    return activeId === calculationId
      && activeId !== baselineId
      && state.status === 'Current'
      && results.backendValidationStatus === 'Connected';
  }, {
    pumpId: caseData.pumpId,
    calculationId: autoBody.calculationId,
    baselineId: baseline.calculationId
  }, { timeout: 15000 });

  const uiProjectState = await collectUiProjectState(page);
  const directBackend = runDirectBackendSimulation(uiProjectState, caseData.pumpId);
  const autoSummary = temperatureSummaryFromSimulation(autoBody);
  const backendSummary = temperatureSummaryFromSimulation(directBackend);
  expectFiniteTemperatureSummary(autoSummary, 'autosolve');
  expectTemperatureSummaryClose(autoSummary, backendSummary, 'autosolve backend parity');
  expect(autoSummary.temperature).toBe(80);
  expect(autoSummary.npsha).not.toBeCloseTo(baselineSummary.npsha, 4);
  expect(autoSummary.margin).not.toBeCloseTo(baselineSummary.margin, 4);
  expect(autoSummary.hLSuction).toBeGreaterThan(0);
  expect(autoSummary.hLDischarge).toBeGreaterThan(0);

  await testInfo.attach('fluid-temperature-autosolve-without-solver.json', {
    body: JSON.stringify({
      caseId: 'simulation-case-1',
      action: 'Typed Fluid Basis Temperature=80 without clicking solver/validate.',
      baseline: baselineSummary,
      autosolve: autoSummary,
      backend: backendSummary,
      calculationId: autoBody.calculationId
    }, null, 2),
    contentType: 'application/json'
  });
});

test('Canvas Pump/Pipe/SNK readouts fast-preview before backend final after Fluid Basis temperature input', async ({ page }, testInfo) => {
  const caseData = loadJournalCase('simulation-case-1');
  let delayNextSimulation = false;

  await page.route('**/api/simulate', async (route) => {
    if (delayNextSimulation) {
      delayNextSimulation = false;
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    await route.continue();
  });

  await waitForNpshApp(page);
  await page.waitForFunction(() => window.EngineeringCanvasFastPreviewRuntime?.version === '2026.07-canvas-fast-preview3', null, { timeout: 15000 });
  await loadProject(page, caseData);

  const baseline = await runProtectedSolve(page, caseData);
  const baselineSummary = temperatureSummaryFromSimulation(baseline);
  expectFiniteTemperatureSummary(baselineSummary, 'baseline fast preview');

  await page.waitForFunction((pumpId) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(document.querySelectorAll('.pump-live-params')).some((panel) => (
      normalize(panel.textContent).includes('NPSH Available')
      && (normalize(panel.textContent).includes(pumpId) || document.querySelectorAll('.pump-live-params').length === 1)
    ));
  }, caseData.pumpId, { timeout: 15000 });

  const baselineReadout = await readPumpCanvasRow(page, caseData.pumpId, 'NPSH Available');
  expect(baselineReadout?.value).toBeTruthy();

  await page.locator('#btn-fluid-basis').click();
  const temperatureInput = page.locator('#fluid-task-temp').first();
  await expect(temperatureInput).toBeVisible({ timeout: 10000 });

  delayNextSimulation = true;
  const autoResponsePromise = page.waitForResponse((response) => (
    /\/api\/simulate(?:[?#]|$)/.test(response.url())
    && response.request().method() === 'POST'
    && response.status() === 200
  ), { timeout: 30000 });

  await temperatureInput.click();
  await temperatureInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.evaluate(({ pumpId, previousValue }) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    window.__canvasFastPreviewE2EStart = performance.now();
    window.__canvasFastPreviewObservedElapsedMs = null;
    const sample = () => {
      const panels = Array.from(document.querySelectorAll('.pump-live-params'));
      const panel = panels.find((candidate) => {
        const object = candidate.closest('.pfd-object, [data-node-id], [data-object-id]');
        return object?.dataset?.nodeId === pumpId
          || object?.dataset?.objectId === pumpId
          || normalize(object?.textContent).includes(pumpId)
          || panels.length === 1;
      }) || null;
      const row = Array.from(panel?.querySelectorAll?.('.pump-live-param-row') || []).find((candidate) => (
        normalize(candidate.querySelector('.pump-live-param-label')?.textContent) === 'NPSH Available'
      ));
      const value = normalize(row?.querySelector('.pump-live-param-value, strong')?.textContent);
      if (value && value !== previousValue && panel?.dataset?.canvasFastPreview === '2026.07-canvas-fast-preview3') {
        window.__canvasFastPreviewObservedElapsedMs = performance.now() - window.__canvasFastPreviewE2EStart;
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, {
    pumpId: caseData.pumpId,
    previousValue: baselineReadout.value.replace(/\s+m$/i, '')
  });
  await temperatureInput.type('80');

  const previewHandle = await page.waitForFunction(({ pumpId, previousValue }) => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const panels = Array.from(document.querySelectorAll('.pump-live-params'));
    const panel = panels.find((candidate) => {
      const object = candidate.closest('.pfd-object, [data-node-id], [data-object-id]');
      return object?.dataset?.nodeId === pumpId
        || object?.dataset?.objectId === pumpId
        || normalize(object?.textContent).includes(pumpId)
        || panels.length === 1;
    }) || null;
    if (!panel) return false;
    const row = Array.from(panel.querySelectorAll('.pump-live-param-row')).find((candidate) => (
      normalize(candidate.querySelector('.pump-live-param-label')?.textContent) === 'NPSH Available'
    ));
    const value = normalize(row?.querySelector('.pump-live-param-value, strong')?.textContent);
    if (!value || value === previousValue) return false;
    if (window.EngineeringCanvasFastPreviewRuntime?.version !== '2026.07-canvas-fast-preview3') return false;
    if (document.documentElement.dataset.canvasFastPreviewRuntime !== '2026.07-canvas-fast-preview3') return false;
    return {
      elapsedMs: performance.now() - (window.__canvasFastPreviewE2EStart || performance.now()),
      observedElapsedMs: window.__canvasFastPreviewObservedElapsedMs,
      value,
      previousValue,
      panelPreviewVersion: panel.dataset.canvasFastPreview || '',
      reason: document.documentElement.dataset.canvasFastPreviewReason || '',
      pipePreviewCount: document.querySelectorAll('#svg-lines .pipe-hydraulic-label[data-canvas-fast-preview="2026.07-canvas-fast-preview3"]').length,
      sinkPreviewCount: document.querySelectorAll('.sink-live-params[data-canvas-fast-preview="2026.07-canvas-fast-preview3"]').length
    };
  }, {
    pumpId: caseData.pumpId,
    previousValue: baselineReadout.value.replace(/\s+m$/i, '')
  }, { timeout: 900 });
  const preview = await previewHandle.jsonValue();

  expect(preview.observedElapsedMs ?? preview.elapsedMs).toBeLessThan(900);
  expect(preview.panelPreviewVersion).toBe('2026.07-canvas-fast-preview3');
  expect(preview.pipePreviewCount).toBeGreaterThan(0);
  expect(preview.sinkPreviewCount).toBeGreaterThan(0);

  const autoResponse = await autoResponsePromise;
  const autoBody = await autoResponse.json();
  await page.waitForFunction(({ pumpId, calculationId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const results = model[pumpId]?.results || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const activeId = results.calculationAudit?.calculationId || state.calculationId || null;
    return activeId === calculationId
      && state.status === 'Current'
      && results.backendValidationStatus === 'Connected';
  }, {
    pumpId: caseData.pumpId,
    calculationId: autoBody.calculationId
  }, { timeout: 15000 });

  const finalSummary = temperatureSummaryFromSimulation(autoBody);
  expectFiniteTemperatureSummary(finalSummary, 'fast preview backend final');
  expect(finalSummary.temperature).toBe(80);
  expect(finalSummary.npsha).not.toBeCloseTo(baselineSummary.npsha, 4);

  await testInfo.attach('canvas-fast-preview-temperature-input.json', {
    body: JSON.stringify({
      caseId: 'simulation-case-1',
      action: 'Typed Fluid Basis Temperature=80 while delaying the backend response.',
      baselineReadout,
      preview,
      baseline: baselineSummary,
      backendFinal: finalSummary
    }, null, 2),
    contentType: 'application/json'
  });
});

test('Simulasi 4 desktop chain renders actual methanol NPSH-risk fixture', async ({ page }, testInfo) => {
  const caseData = loadJournalCase('simulation-case-4');
  expect(caseData.entry.sampleFile).toMatch(/simulasi_4/i);
  expect(caseData.entry.analysisReport).toMatch(/simulasi-4/i);

  await waitForNpshApp(page);
  await loadProject(page, caseData);

  const response = await runProtectedSolve(page, caseData);
  const snapshot = await browserSnapshot(page, caseData);

  expect(response.results.status).toBe('Cavitation Risk');
  expect(response.results.flow).toBe(280);
  expect(response.results.npsha).toBeCloseTo(4.75, 4);
  expect(response.results.npshr).toBe(5);
  expect(response.results.npshMargin).toBeCloseTo(-0.25, 4);
  expect(response.results.npshRatio).toBeCloseTo(0.95, 4);
  expect(response.routeTrace.sequence).toEqual(['FLUID', 'SRC-100', 'PIPE-1', 'PUMP-100', 'PIPE-2', 'SNK-100']);
  expect(response.routeTrace.sections.suction.pressureDropBar).toBeCloseTo(0.106476, 5);
  expect(response.routeTrace.sections.discharge.pressureDropBar).toBeCloseTo(0.006842, 5);
  expect(snapshot.bodyText).toContain('Methanol @ 40.0 deg C');
  expect(snapshot.bodyText).toContain('NPSH Risk');
  expect(snapshot.bodyText).toContain('PUMP-100 - NPSH Risk');
  expect(snapshot.dock.routeNodes).toEqual(['Fluid Basis', 'SRC-100', 'PIPE-1', 'PUMP-100', 'PIPE-2', 'SNK-100']);
  expect(snapshot.response.dependencyManifest.sinkBoundaryCoverage.status).toBe('pass');
  expect(snapshot.response.dependencyManifest.sourceBoundaryCoverage.status).toBe('pass');
  expect(formulaRow(snapshot, 'Expanded NPSHA').substitution).toContain('4.750 m');
  expect(formulaRow(snapshot, 'NPSH Margin Ratio').substitution).toContain('0.950');
  expect(caseData.report.statusSummary.hydraulicStatus).toContain('Cavitation Risk');

  const screenshotPath = testInfo.outputPath('simulasi-4-methanol-risk-chain.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('simulasi 4 methanol risk chain', { path: screenshotPath, contentType: 'image/png' });

  console.log(JSON.stringify({
    desktopFlowChainE2E: 'pass',
    caseId: 'simulation-case-4',
    fixture: {
      sampleFile: path.relative(frontendRoot, caseData.samplePath),
      reportFile: path.relative(frontendRoot, caseData.reportPath)
    },
    calculationId: response.calculationId,
    dependencyFingerprint: response.dependencyManifest.dependencyFingerprint,
    status: response.results.status,
    npsha: response.results.npsha,
    npshr: response.results.npshr,
    margin: response.results.npshMargin,
    ratio: response.results.npshRatio,
    routeTrace: snapshot.audit.routeTraceText,
    screenshotPath
  }, null, 2));
});

test('Manual NPSHr UI edit previews Simulasi 4 locally and refreshes linked report values', async ({ page }) => {
  const caseData = loadJournalCase('simulation-case-4');
  const ariaHiddenFocusWarnings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Blocked aria-hidden/i.test(text) && /canvasContextMenu/i.test(text)) {
      ariaHiddenFocusWarnings.push(text);
    }
  });

  await waitForNpshApp(page);
  await loadProject(page, caseData);

  const baseline = await runProtectedSolve(page, caseData);
  expect(baseline.results.npshr).toBe(5);
  expect(baseline.results.npshMargin).toBeCloseTo(-0.25, 4);

  await page.evaluate(({ entry, report, pumpId }) => {
    window.openJournalAnalysisTaskWindow(entry, report);
    window.currentSelectedNode = pumpId;
    window.renderSidebar?.(pumpId, { skipDismissedGuard: true });
    window.EngineeringAnalysisReportLiveRuntime?.refresh?.();
  }, { entry: caseData.entry, report: caseData.report, pumpId: caseData.pumpId });

  await page.waitForSelector('.journal-analysis-task-window .journal-analysis-comparison-table', { timeout: 10000 });
  await expect(page.locator(`.persistent-object-properties-task-window[data-node-id="${caseData.pumpId}"], #taskWindow[data-node-id="${caseData.pumpId}"]`)).toHaveCount(0);
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
  const pumpMenuCoreOrder = pumpMenuItems.filter((item) => [
    'Pump Datum - NPSHR',
    'Pump Formula Defense',
    'Connect',
    'Delete Object'
  ].includes(item));
  expect(pumpMenuCoreOrder).toEqual([
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
    const margin = Number(npsh.npshMargin ?? results.npshMargin);
    const ratio = Number(npsh.npshRatio ?? results.npshRatio);
    const freshness = results.calculationFreshness || npsh.calculationFreshness || '';
    if (
      Number(pump.props?.manualNpshr) !== 4
      || Number(pump.props?.designNpshr) !== 4
      || Number(npsh.npshr ?? results.npshr) !== 4
      || Math.abs(margin - 0.75) > 0.002
      || Math.abs(ratio - 1.1875) > 0.002
      || !['Local preview', 'Current'].includes(freshness)
    ) {
      return false;
    }
    return {
      npshr: Number(npsh.npshr ?? results.npshr),
      margin,
      ratio,
      status: npsh.hydraulicStatus || results.hydraulicNpshStatus || npsh.status || results.status || null,
      freshness
    };
  }, caseData.pumpId, { timeout: 15000 });
  const localPreview = await localPreviewHandle.jsonValue();
  expect(localPreview.status).toBe('Safe');
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

  await page.waitForFunction(() => {
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const rows = Array.from(document.querySelectorAll('.journal-analysis-comparison-table tbody tr'));
    const readApp = (metric) => {
      const row = rows.find((item) => normalize(item.cells?.[0]?.textContent) === normalize(metric));
      return row?.cells?.[2]?.textContent || '';
    };
    const npshrText = readApp('Pump - NPSHr') || readApp('Pump - NPSHa / NPSHr');
    const marginText = readApp('Pump - NPSH margin') || readApp('Pump - NPSH Margin / Ratio');
    const ratioText = readApp('Pump - NPSH ratio') || readApp('Pump - NPSH Margin / Ratio');
    return /(?:^|\/\s*)4(?:\.0+)?\s*m/i.test(npshrText)
      && /0\.75(?:0+)?\s*m/i.test(marginText)
      && /1\.1875/i.test(ratioText);
  }, null, { timeout: 15000 });

  const changedReport = await analysisReportCellSnapshot(page);
  const npshrApplication = changedReport.pumpNpshrComparison?.application || changedReport.pumpNpshaNpshrComparison?.application || '';
  const marginApplication = changedReport.pumpMarginComparison?.application || changedReport.pumpMarginRatioComparison?.application || '';
  const ratioApplication = changedReport.pumpRatioComparison?.application || changedReport.pumpMarginRatioComparison?.application || '';
  expect(localPreview.npshr).toBe(4);
  expect(localPreview.margin).toBeCloseTo(0.75, 3);
  expect(localPreview.ratio).toBeCloseTo(1.1875, 4);
  expect(npshrApplication).toMatch(/(?:^|\/\s*)4(?:\.0+)? m/);
  expect(marginApplication).toMatch(/0\.75(?:0+)? m/);
  expect(ratioApplication).toMatch(/1\.1875/);
});
