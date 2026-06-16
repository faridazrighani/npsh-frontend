const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { test, expect } = require('@playwright/test');

const frontendRoot = path.resolve(__dirname, '../..');

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
  await page.waitForFunction(() => (
    typeof window.applySimulationStateAtomic === 'function'
    && typeof window.updateSimulation === 'function'
    && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v8'
    && window.CanvasContextDock?.version === 'engineering-canvas-context-dock.v2'
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
  return (snapshot.response.formulaRows || []).find((row) => row.step === stepName) || {};
}

function systemHead(responseBody) {
  const row = (responseBody.results?.calculationTrace?.academicFormulaDefenseRows || [])
    .find((item) => item.step === 'System Curve Head');
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
  expect(formulaRow(baselineSnapshot, 'System Curve Head').substitution).toContain('1.946 + 2.616 + 11.669 = 16.230 m');
  expect(formulaRow(baselineSnapshot, 'System Curve Head').result).toBeCloseTo(16.23, 3);
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
  expect(formulaRow(changedSnapshot, 'System Static Head').substitution).toContain('26.315 - 19.369 = 6.946 m');
  expect(formulaRow(changedSnapshot, 'System Curve Head').substitution).toContain('21.230 m');
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
    formulaDefenseUpdated: formulaRow(changedSnapshot, 'System Curve Head').substitution,
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
    pump.results.npshEvaluation.pumpHead = 31.127;
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

  await waitForNpshApp(page);
  await loadProject(page, caseData);

  const baseline = await runProtectedSolve(page, caseData);
  expect(baseline.results.npshr).toBe(5);
  expect(baseline.results.npshMargin).toBeCloseTo(-0.25, 4);

  await page.evaluate(({ entry, report, pumpId }) => {
    window.openJournalAnalysisTaskWindow(entry, report);
    window.currentSelectedNode = pumpId;
    window.__npshExplicitObjectPropertiesOpenUntil = Date.now() + 2000;
    window.requestObjectPropertiesTaskWindowOpen?.(pumpId);
    window.openObjectPropertiesTaskWindow?.(pumpId);
    const taskWindow = document.querySelector(`.persistent-object-properties-task-window[data-node-id="${pumpId}"]`);
    window.renderSidebar?.(pumpId, { taskWindow, skipDismissedGuard: true });
    window.EngineeringAnalysisReportLiveRuntime?.refresh?.();
  }, { entry: caseData.entry, report: caseData.report, pumpId: caseData.pumpId });

  await page.waitForSelector('.journal-analysis-task-window .journal-analysis-comparison-table', { timeout: 10000 });
  const npshrInput = page.locator(`.persistent-object-properties-task-window[data-node-id="${caseData.pumpId}"] input[data-key="designNpshr"], .persistent-object-properties-task-window[data-node-id="${caseData.pumpId}"] input[name="design-npshr"]`).first();
  await expect(npshrInput).toBeVisible({ timeout: 10000 });

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
    if (
      Number(pump.props?.designNpshr) !== 4
      || Number(npsh.npshr ?? results.npshr) !== 4
      || Math.abs(margin - 0.751) > 0.002
      || Math.abs(ratio - 1.18775) > 0.002
      || results.calculationFreshness !== 'Local preview'
    ) {
      return false;
    }
    return {
      npshr: Number(npsh.npshr ?? results.npshr),
      margin,
      ratio,
      status: npsh.hydraulicStatus || results.hydraulicNpshStatus || npsh.status || results.status || null,
      freshness: results.calculationFreshness
    };
  }, caseData.pumpId, { timeout: 15000 });
  const localPreview = await localPreviewHandle.jsonValue();
  expect(localPreview.status).toBe('Safe');
  expect(localPreview.freshness).toBe('Local preview');
  await expect.poll(() => page.__desktopFlowChainRequests.length, {
    timeout: 1400,
    intervals: [300, 400, 700]
  }).toBe(requestsBeforeEdit);

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
      && /0\.751\s*m/i.test(marginText)
      && /1\.18775/i.test(ratioText);
  }, null, { timeout: 15000 });

  const changedReport = await analysisReportCellSnapshot(page);
  const npshrApplication = changedReport.pumpNpshrComparison?.application || changedReport.pumpNpshaNpshrComparison?.application || '';
  const marginApplication = changedReport.pumpMarginComparison?.application || changedReport.pumpMarginRatioComparison?.application || '';
  const ratioApplication = changedReport.pumpRatioComparison?.application || changedReport.pumpMarginRatioComparison?.application || '';
  expect(localPreview.npshr).toBe(4);
  expect(localPreview.margin).toBeCloseTo(0.751, 3);
  expect(localPreview.ratio).toBeCloseTo(1.18775, 4);
  expect(npshrApplication).toMatch(/(?:^|\/\s*)4(?:\.0+)? m/);
  expect(marginApplication).toMatch(/0\.751 m/);
  expect(ratioApplication).toMatch(/1\.18775/);
});
