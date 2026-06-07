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
    && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v2'
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
  expect(formulaRow(baselineSnapshot, 'System Curve Head').substitution).toContain('24.000 m');
  expect(baselineSnapshot.exportGate.canExport).toBe(true);

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
    && (window.__npshGlobalModel || window.globalModel)?.[pumpId]?.results?.backendValidationStatus === 'Calculating'
  ), caseData.pumpId, { timeout: 10000 });
  const calculatingSnapshot = await browserSnapshot(page, caseData);
  expect(calculatingSnapshot.realtime.status).toBe('Calculating');
  expect(calculatingSnapshot.pump.backendValidationStatus).toBe('Calculating');

  const changedResponse = await changedResponsePromise;
  const changed = await changedResponse.json();
  await changedSolvePromise;
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
  expect(changedSnapshot.pump.dependencyFingerprint).toBe(changed.dependencyManifest.dependencyFingerprint);
  expect(changedSnapshot.response.routeTrace.sections.discharge.pressureDropBar).toBeCloseTo(1.097003, 5);
  expect(formulaRow(changedSnapshot, 'System Static Head').substitution).toContain('36.212 - 19.369 = 16.843 m');
  expect(formulaRow(changedSnapshot, 'System Curve Head').substitution).toContain('31.127 m');
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
