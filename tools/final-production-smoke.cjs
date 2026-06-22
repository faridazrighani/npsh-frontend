const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { chromium } = require('playwright');

const frontendRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(frontendRoot, '..');
const apiRoot = path.join(workspaceRoot, 'npsh-api');
const screenshotRoot = path.join(apiRoot, 'docs', 'final-defense-screenshots');
const productionUrl = process.env.NPSH_PRODUCTION_URL || 'https://npsh.virsim.id/';
const caseId = process.env.NPSH_SMOKE_CASE_ID || 'simulation-case-1';
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  || 'C:/Users/Zfaryana/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe';

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

function loadJournalCase(id) {
  const manifest = readJson(path.join(frontendRoot, 'journals', 'simulation-cases.json'));
  const entry = manifest.cases.find((item) => item.id === id);
  if (!entry) throw new Error(`${id} not found in journals/simulation-cases.json`);
  if (entry.disabled) throw new Error(`${id} is disabled: ${entry.disabledReason || 'no reason provided'}`);
  const samplePath = path.join(frontendRoot, entry.sampleFile);
  const project = readUntirtaProject(samplePath);
  const pumpId = Object.keys(project.model || {}).find((nodeId) => project.model[nodeId]?.type === 'pump');
  const sourceId = Object.keys(project.model || {}).find((nodeId) => project.model[nodeId]?.type === 'source');
  const sinkId = Object.keys(project.model || {}).find((nodeId) => project.model[nodeId]?.type === 'sink');
  if (!pumpId || !sourceId || !sinkId) throw new Error(`${id} fixture needs source, pump, and sink nodes.`);
  return { entry, project, pumpId, sourceId, sinkId, samplePath };
}

async function safeClick(page, selector) {
  const locator = page.locator(selector).first();
  if (await locator.count()) {
    await locator.click({ timeout: 10000 }).catch(() => {});
  }
}

async function waitForProductionApp(page, diagnostics) {
  await page.goto(productionUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await safeClick(page, '#closeAbout');
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(700);
  await page.mouse.click(24, 24).catch(() => {});
  await safeClick(page, '[data-fluid-action="open-full-basis"]');
  try {
    await page.waitForFunction(() => (
      typeof window.applySimulationStateAtomic === 'function'
      && typeof window.updateSimulation === 'function'
      && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v11'
      && window.CanvasContextDock?.version
      && window.EngineeringRouteTraceAudit?.version
      && window.EngineeringDefenseExportPackage?.schemaVersion === 'defense-export-package.v1'
      && window.__npshRouteTraceAuditInstalled?.fetchSimulation
      && window.__npshRouteTraceAuditInstalled?.primaryResultApplier
    ), null, { timeout: 60000 });
  } catch (error) {
    const readiness = await page.evaluate(() => ({
      url: window.location.href,
      aboutHidden: document.getElementById('aboutModal')?.hasAttribute('hidden') || false,
      setupButton: !!document.querySelector('[data-fluid-action="open-full-basis"]'),
      applySimulationStateAtomic: typeof window.applySimulationStateAtomic,
      updateSimulation: typeof window.updateSimulation,
      realtimeVersion: window.EngineeringRealtimeCalculationDefense?.version || null,
      canvasDockVersion: window.CanvasContextDock?.version || null,
      routeTraceVersion: window.EngineeringRouteTraceAudit?.version || null,
      defenseSchemaVersion: window.EngineeringDefenseExportPackage?.schemaVersion || null,
      routeTraceInstalled: window.__npshRouteTraceAuditInstalled || null,
      scriptCount: document.scripts.length,
      lastScripts: Array.from(document.scripts).map((script) => script.src).filter(Boolean).slice(-20),
      bodyHead: document.body.innerText.slice(0, 700),
      diagnostics
    }));
    throw new Error(`Production app runtime did not become ready: ${JSON.stringify(readiness, null, 2)}`, { cause: error });
  }
}

async function loadProject(page, project, ids) {
  await page.evaluate((projectState) => {
    window.applySimulationStateAtomic(JSON.stringify(projectState));
    window.CanvasContextDock?.refresh?.();
  }, project);

  await page.waitForFunction(({ pumpId, sourceId, sinkId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return !!(model[pumpId] && model[sourceId] && model[sinkId]);
  }, ids, { timeout: 20000 });
}

async function runProtectedSolve(page, pumpId) {
  const responsePromise = page.waitForResponse((response) => (
    /\/api\/simulate(?:[?#]|$)/.test(response.url())
    && response.request().method() === 'POST'
    && response.status() === 200
  ), { timeout: 60000 });

  const solvePromise = page.evaluate(() => window.updateSimulation({
    refreshReason: 'solve',
    trigger: 'final-production-smoke',
    forceBackend: true,
    renderSidebarAfter: false
  }));

  const response = await responsePromise;
  const body = await response.json();
  await solvePromise;

  await page.waitForFunction(({ pumpId: selectedPumpId, calculationId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pumpResults = model[selectedPumpId]?.results || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    return state.status === 'Current'
      && state.calculationId === calculationId
      && pumpResults.calculationFreshness === 'Current'
      && pumpResults.backendValidationStatus === 'Connected'
      && pumpResults.calculationAudit?.calculationId === calculationId
      && !!pumpResults.dependencyManifest?.dependencyFingerprint;
  }, { pumpId, calculationId: body.calculationId }, { timeout: 20000 });

  return body;
}

async function selectPumpCanvas(page, pumpId) {
  await page.evaluate((selectedPumpId) => {
    window.currentSelectedNode = selectedPumpId;
    const element = document.getElementById(`obj-${selectedPumpId}`);
    if (typeof window.selectNode === 'function' && element) {
      window.selectNode(selectedPumpId, element);
    } else if (typeof window.renderSidebar === 'function') {
      window.renderSidebar(selectedPumpId);
    }
    window.CanvasContextDock?.refresh?.();
    window.closeTaskWindow?.({ markDismissed: false });
  }, pumpId);
  await page.waitForTimeout(600);
}

async function captureScreenshot(page, name) {
  fs.mkdirSync(screenshotRoot, { recursive: true });
  const filePath = path.join(screenshotRoot, name);
  await page.screenshot({ path: filePath, fullPage: false });
  const stat = fs.statSync(filePath);
  assert(stat.size > 10000, `${name} should contain a non-empty production screenshot.`);
  return filePath;
}

async function smokeSnapshot(page, ids) {
  return page.evaluate(({ pumpId, sourceId, sinkId }) => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const pump = model[pumpId] || {};
    const pumpResults = pump.results || {};
    const lastResponse = window.__npshLastBackendSimulationResponse?.response || {};
    const auditPayload = window.EngineeringRouteTraceAudit?.activeAuditPayload?.() || {};
    const defensePayload = window.EngineeringDefenseExportPackage?.activeDefensePayload?.() || {};
    const exportGate = window.EngineeringDefenseExportPackage?.defenseExportGate?.(defensePayload) || null;
    return {
      url: window.location.href,
      caseIds: { pumpId, sourceId, sinkId },
      realtime: JSON.parse(JSON.stringify(window.__engineeringCalculationDefenseRealtimeState || null)),
      pump: {
        calculationFreshness: pumpResults.calculationFreshness || null,
        backendValidationStatus: pumpResults.backendValidationStatus || null,
        calculationId: pumpResults.calculationAudit?.calculationId || null,
        dependencyFingerprint: pumpResults.dependencyManifest?.dependencyFingerprint || null,
        status: pumpResults.npshEvaluation?.status || pumpResults.status || null,
        flow: pumpResults.npshEvaluation?.flow ?? pumpResults.flow ?? null,
        npsha: pumpResults.npshEvaluation?.npsha ?? pumpResults.npsha ?? null,
        npshr: pumpResults.npshEvaluation?.npshr ?? pumpResults.npshr ?? null,
        routeText: pumpResults.routeTrace?.text || null,
        routeLossFreshness: pumpResults.routeTrace?.lossFreshness || null
      },
      response: {
        calculationId: lastResponse.calculationId || null,
        routeTraceFingerprint: lastResponse.routeTraceFingerprint || null,
        dependencyFingerprint: lastResponse.dependencyManifest?.dependencyFingerprint || null,
        status: lastResponse.results?.status || null,
        flow: lastResponse.results?.flow ?? null,
        npsha: lastResponse.results?.npsha ?? null,
        npshr: lastResponse.results?.npshr ?? null,
        npshMargin: lastResponse.results?.npshMargin ?? null,
        npshRatio: lastResponse.results?.npshRatio ?? null,
        routeSequence: lastResponse.routeTrace?.sequence || []
      },
      audit: {
        routeTraceText: auditPayload.routeTrace?.text || null,
        dependencyFingerprint: auditPayload.dependencyManifest?.dependencyFingerprint || null,
        calculationId: auditPayload.calculationAudit?.calculationId || null
      },
      exportGate
    };
  }, ids);
}

async function main() {
  const caseData = loadJournalCase(caseId);
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromiumExecutable) ? chromiumExecutable : undefined
  });
  const context = await browser.newContext({
    viewport: { width: 1680, height: 920 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const simulateRequests = [];
  const diagnostics = {
    console: [],
    pageErrors: [],
    requestFailures: [],
    watchedResponses: []
  };

  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) diagnostics.console.push({
      type: message.type(),
      text: message.text()
    });
  });
  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(String(error?.stack || error?.message || error));
  });
  page.on('requestfailed', (request) => {
    diagnostics.requestFailures.push({
      url: request.url(),
      errorText: request.failure()?.errorText || ''
    });
  });
  page.on('response', (response) => {
    const url = response.url();
    if (/engineering-(realtime-calculation-defense|calculation-lifecycle|calculation-progress-overlay|defense-export-package)|\/api\/simulate(?:[?#]|$)/.test(url)) {
      diagnostics.watchedResponses.push({
        status: response.status(),
        url
      });
    }
  });

  await page.route('**/api/simulate', async (route) => {
    simulateRequests.push({
      url: route.request().url(),
      method: route.request().method(),
      capturedAt: new Date().toISOString()
    });
    await route.continue();
  });

  try {
    await waitForProductionApp(page, diagnostics);
    await loadProject(page, caseData.project, caseData);
    const response = await runProtectedSolve(page, caseData.pumpId);

    await selectPumpCanvas(page, caseData.pumpId);
    const canvasScreenshot = await captureScreenshot(page, '02-production-current-calculation-canvas.png');

    await page.evaluate(() => window.EngineeringRouteTraceAudit?.openRouteAuditPanel?.());
    await page.waitForSelector('#engineeringRouteTraceAuditPanel:not([hidden])', { timeout: 10000 });
    const routeAuditScreenshot = await captureScreenshot(page, '03-production-route-calculation-audit.png');

    await page.evaluate(() => {
      const routePanel = document.getElementById('engineeringRouteTraceAuditPanel');
      if (routePanel) routePanel.hidden = true;
      window.EngineeringDefenseExportPackage?.openDefensePackagePanel?.();
    });
    await page.waitForSelector('#engineeringDefenseExportPackagePanel:not([hidden])', { timeout: 10000 });
    const defensePackageScreenshot = await captureScreenshot(page, '04-production-defense-export-package.png');

    const snapshot = await smokeSnapshot(page, caseData);
    assert.equal(snapshot.realtime?.status, 'Current', 'Realtime calculation state should be Current.');
    assert.equal(snapshot.pump.calculationFreshness, 'Current', 'Pump calculation freshness should be Current.');
    assert.equal(snapshot.pump.backendValidationStatus, 'Connected', 'Pump backend validation should be Connected.');
    assert.equal(snapshot.response.calculationId, response.calculationId, 'Cached backend response should match the smoke response.');
    assert(snapshot.audit.routeTraceText?.includes(caseData.sinkId), 'Route audit should include the sink node.');
    assert.equal(snapshot.exportGate?.canExport, true, 'Defense export gate should be export-ready.');
    assert(simulateRequests.length >= 1, 'Smoke test should call the live /api/simulate endpoint.');

    console.log(JSON.stringify({
      finalProductionSmoke: 'pass',
      productionUrl,
      caseId,
      samplePath: path.relative(frontendRoot, caseData.samplePath).replace(/\\/g, '/'),
      backendCalls: simulateRequests.length,
      response: {
        calculationId: response.calculationId,
        dependencyFingerprint: response.dependencyManifest?.dependencyFingerprint || null,
        routeTraceFingerprint: response.routeTraceFingerprint || null,
        status: response.results?.status || null,
        flow: response.results?.flow ?? null,
        npsha: response.results?.npsha ?? null,
        npshr: response.results?.npshr ?? null,
        npshMargin: response.results?.npshMargin ?? null,
        npshRatio: response.results?.npshRatio ?? null
      },
      snapshot,
      screenshots: [
        canvasScreenshot,
        routeAuditScreenshot,
        defensePackageScreenshot
      ]
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
