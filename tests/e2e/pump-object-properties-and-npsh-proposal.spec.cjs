const { test, expect } = require('@playwright/test');

const PUMP_FORMULA_DEFENSE_LIVE_AUDIT_VERSION = 'pump-formula-defense-live-audit.v11';

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

function formulaDefenseRow(response, stepName) {
  const rows = response.results?.calculationTrace?.academicFormulaDefenseRows
    || response.results?.calculationTrace?.formulaDefenseRows
    || [];
  return rows.find((row) => String(row.step || '').toLowerCase() === stepName.toLowerCase()) || null;
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
        sourceType: 'Fixed Flow Source',
        boundaryDataSource: 'Manual',
        pressureInputBasis: 'Absolute',
        pressure: 1.01325,
        pressureEnergyBasis: 'Static Pressure',
        elevation: 0,
        temperatureMode: 'Use Fluid Basis',
        flowInputMode: 'Volumetric Flow',
        flow: 12,
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
        designFlow: 12,
        bepFlow: 12,
        designHead: 32,
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
    'PIPE-D': createPipe('Discharge pipe', 25, 0.08, 3),
    SNK: {
      type: 'sink',
      name: 'SNK',
      props: {
        active: 'Active',
        boundaryMode: 'Flow Demand Boundary',
        pressureInputBasis: 'Absolute',
        pressure: 1.01325,
        pressureBasis: 'Static',
        elevation: 4,
        demandFlow: 12
      },
      results: {}
    }
  };

  return {
    projectFile: { sourceFormat: 'pump-window-playwright-e2e' },
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
  await page.waitForFunction((expectedPumpAuditVersion) => (
    typeof window.applySimulationStateAtomic === 'function'
    && typeof window.updateSimulation === 'function'
    && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v18-src-task-window-flash-lock'
    && window.EngineeringDefenseExportPackage?.schemaVersion === 'defense-export-package.v1'
    && window.EngineeringPumpFormulaDefenseLiveAudit?.version === expectedPumpAuditVersion
    && window.__npshRouteTraceAuditInstalled?.fetchSimulation
  ), PUMP_FORMULA_DEFENSE_LIVE_AUDIT_VERSION, { timeout: 30000 });
}

async function loadProject(page, project) {
  await page.evaluate((projectState) => {
    window.applySimulationStateAtomic(JSON.stringify(projectState));
  }, project);
  await expect(page.locator('#obj-p')).toBeVisible();
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
  await page.waitForFunction(({ previousId, responseId }) => {
    const pumpResults = window.__npshGlobalModel?.P?.results || {};
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const calculationId = pumpResults.calculationAudit?.calculationId || state.calculationId || responseId;
    if (previousId && calculationId === previousId) return false;
    return state.status === 'Current'
      && calculationId === responseId
      && !!pumpResults.performanceChartData
      && !!pumpResults.dependencyManifest;
  }, { previousId: previousCalculationId, responseId: body.calculationId }, { timeout: 15000 });
  return body;
}

async function changePumpInBrowser(page) {
  return page.evaluate(() => {
    const model = window.__npshGlobalModel;
    const pump = model.P;
    pump.props.inputMode = 'Advanced';
    pump.props.curveDataSource = 'Manufacturer/Test Verified';
    pump.props.curveSourceNote = 'playwright vendor curve evidence';
    pump.props.speed = 3600;
    pump.props.curveData = [
      { flow: 6, head: 38, eff: 58, npshr: 2.4 },
      { flow: 12, head: 32, eff: 72, npshr: 3.2 },
      { flow: 18, head: 21, eff: 64, npshr: 4.1 },
      { flow: 24, head: 8, eff: 48, npshr: 5.6 }
    ];

    const taskWindow = document.createElement('section');
    taskWindow.className = 'task-window';
    taskWindow.dataset.taskNodeId = 'P';
    taskWindow.dataset.node = 'P';

    const mode = document.createElement('select');
    mode.name = 'inputMode';
    mode.dataset.key = 'inputMode';
    mode.dataset.node = 'P';
    const advancedOption = document.createElement('option');
    advancedOption.value = 'Advanced';
    advancedOption.textContent = 'Advanced';
    mode.appendChild(advancedOption);
    mode.value = 'Advanced';

    const speed = document.createElement('input');
    speed.name = 'speed';
    speed.dataset.key = 'speed';
    speed.dataset.node = 'P';
    speed.value = '3600';

    taskWindow.append(mode, speed);
    document.body.appendChild(taskWindow);
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    speed.dispatchEvent(new Event('input', { bubbles: true }));
    taskWindow.remove();

    return window.__engineeringCalculationDefenseRealtimeState || null;
  });
}

async function proposalWorkflow(page) {
  return page.evaluate(() => {
    const model = window.__npshGlobalModel;
    const pump = model.P;
    const before = JSON.parse(JSON.stringify(pump.props));
    const curveBefore = JSON.stringify(pump.props.curveData || []);
    const evaluate = typeof window.runPumpNetworkOptimization === 'function'
      ? window.runPumpNetworkOptimization('P')
      : { ok: !!pump.results?.pumpOptimizationProposal, proposal: pump.results?.pumpOptimizationProposal || null };
    const pendingAfterEvaluate = !!pump.results?.pumpOptimizationProposal || !!evaluate?.proposal;
    const apply = typeof window.applyPumpOptimizationProposal === 'function'
      ? window.applyPumpOptimizationProposal('P')
      : { ok: false, status: 'function unavailable' };
    const afterApply = JSON.parse(JSON.stringify(pump.props));
    const curveAfterApply = JSON.stringify(pump.props.curveData || []);
    const restore = typeof window.restorePumpOptimizationPreviousInputs === 'function'
      ? window.restorePumpOptimizationPreviousInputs('P', model, { force: true })
      : { ok: false, status: 'function unavailable' };
    const afterRestore = JSON.parse(JSON.stringify(pump.props));
    const clear = typeof window.clearPumpOptimizationProposal === 'function'
      ? window.clearPumpOptimizationProposal('P')
      : { ok: false, status: 'function unavailable' };
    const afterClear = JSON.parse(JSON.stringify(pump.props));
    return {
      before,
      evaluateStatus: evaluate?.status || null,
      pendingAfterEvaluate,
      apply,
      restore,
      clear,
      appliedChangedNpshaCandidate: afterApply.designNpshr !== before.designNpshr || afterApply.designHead !== before.designHead,
      manufacturerCurvePreserved: curveAfterApply === curveBefore,
      restoredDesignNpshr: afterRestore.designNpshr,
      originalDesignNpshr: before.designNpshr,
      clearKeptInputs: JSON.stringify(afterClear) === JSON.stringify(afterRestore),
      proposalAfterClear: !!pump.results?.pumpOptimizationProposal
    };
  });
}

async function browserSnapshot(page) {
  return page.evaluate(() => {
    const pumpResults = window.__npshGlobalModel?.P?.results || {};
    const response = window.__npshLastBackendSimulationResponse?.response || {};
    return {
      realtime: window.__engineeringCalculationDefenseRealtimeState || null,
      calculationId: pumpResults.calculationAudit?.calculationId || response.calculationId || null,
      dependencyFingerprint: pumpResults.dependencyManifest?.dependencyFingerprint || response.dependencyManifest?.dependencyFingerprint || null,
      chart: pumpResults.performanceChartData || null,
      formulaRows: pumpResults.npshEvaluation?.calculationTrace?.academicFormulaDefenseRows || [],
      pumpWindowAuditContract: response.pumpWindowAuditContract || null,
      backendResponse: response,
      defenseGate: window.EngineeringDefenseExportPackage?.defenseExportGate?.() || null
    };
  });
}

async function pumpFormulaDefenseWindowSnapshot(page) {
  return page.evaluate(() => {
    const windowNode = document.querySelector('.pump-formula-defense-task-window');
    const rows = window.__npshGlobalModel?.P?.results?.npshEvaluation?.calculationTrace?.academicFormulaDefenseRows || [];
    return {
      exists: !!windowNode,
      text: windowNode?.textContent || '',
      rowCount: rows.length,
      rowCalculationIds: rows.map((row) => row.calculationId).filter(Boolean),
      refreshMeta: window.__pumpFormulaDefenseLiveAuditLastRefresh || null,
      runtimeVersion: window.EngineeringPumpFormulaDefenseLiveAudit?.version || null,
      contentRefreshVersion: window.refreshPumpFormulaDefenseWindowContent?.__pumpFormulaDefenseLiveAuditVersion || null
    };
  });
}

test('Pump object properties, chart, proposal buttons, formula defense, and stale export gate refresh from backend', async ({ page }, testInfo) => {
  const simulateRequests = [];
  await page.route('**/api/simulate', async (route) => {
    const request = route.request();
    let payload = null;
    try {
      payload = JSON.parse(request.postData() || '{}');
    } catch {
      payload = null;
    }
    simulateRequests.push({ method: request.method(), payload });
    await route.continue();
  });

  await waitForNpshApp(page);
  await loadProject(page, baseProject());

  const baseline = await runProtectedSolve(page);
  const baselineSnapshot = await browserSnapshot(page);
  expect(baselineSnapshot.realtime.status).toBe('Current');
  expect(baselineSnapshot.calculationId).toBe(baseline.calculationId);
  expect(baselineSnapshot.chart.series.pumpHead.length).toBeGreaterThan(3);
  expect(baselineSnapshot.formulaRows.some((row) => /NPSHa/i.test(row.step) && /[0-9]/.test(String(row.substitution || row.substitutedValues)))).toBe(true);
  expect(baseline.pumpWindowAuditContract.pumpObjectProperties.fieldValues.npshaFromNetwork).toBe(baseline.results.npsha);
  expect(baseline.pumpWindowAuditContract.pumpPerformanceChart.status).toBe('available');
  expect(baseline.pumpWindowAuditContract.pumpFormulaDefense.mandatoryFormulaRows.every((row) => row.status === 'pass')).toBe(true);

  const staleAfterPumpEdit = await changePumpInBrowser(page);
  expect(staleAfterPumpEdit.status).toBe('Stale');
  const stalePrior = await page.evaluate(() => ({
    previousDependencyFingerprint: window.EngineeringRouteTraceAudit?.previousDependencyFingerprint?.()
      || window.__npshLastDependencyFingerprint
      || null,
    realtimeDependencyFingerprint: window.__engineeringCalculationDefenseRealtimeState?.dependencyFingerprint || null
  }));
  expect(stalePrior.previousDependencyFingerprint).toBeTruthy();
  await page.evaluate(() => window.EngineeringDefenseExportPackage.openDefensePackagePanel());
  await expect(page.locator('.defense-export-stale-gate')).toHaveAttribute('data-export-ready', 'false');

  const requestCountBeforeChangedSolve = simulateRequests.length;
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
  await page.evaluate(() => {
    window.openPumpFormulaDefenseTaskWindow?.('P');
    window.EngineeringPumpFormulaDefenseLiveAudit?.refresh?.('P');
  });
  const calculatingFormulaWindow = await pumpFormulaDefenseWindowSnapshot(page);
  expect(calculatingFormulaWindow.exists).toBe(true);
  expect(calculatingFormulaWindow.runtimeVersion).toBe(PUMP_FORMULA_DEFENSE_LIVE_AUDIT_VERSION);
  expect(calculatingFormulaWindow.contentRefreshVersion).toBe(PUMP_FORMULA_DEFENSE_LIVE_AUDIT_VERSION);
  expect(calculatingFormulaWindow.text).toMatch(/NPSHa|NPSHr|Trace Rows/i);
  await changedSolvePromise;
  await page.waitForFunction((previousCalculationId) => {
    const state = window.__engineeringCalculationDefenseRealtimeState || {};
    const response = window.__npshLastBackendSimulationResponse?.response || {};
    return state.status === 'Current'
      && !!state.calculationId
      && state.calculationId !== previousCalculationId
      && response.calculationId === state.calculationId;
  }, baseline.calculationId, { timeout: 15000 });

  const changedSnapshot = await browserSnapshot(page);
  const changed = changedSnapshot.backendResponse;
  const changedRequests = simulateRequests
    .slice(requestCountBeforeChangedSolve)
    .filter(({ payload }) => Number(payload?.model?.P?.props?.speed) === 3600);
  const appliedChangedRequest = changedRequests.find(({ payload }) => (
    payload?.client?.previousDependencyFingerprint === changed?.dependencyManifest?.previousDependencyFingerprint
  ));
  const npshrRow = formulaDefenseRow(changed, 'NPSHr');
  const marginRow = formulaDefenseRow(changed, 'NPSH Margin');
  expect(changed.calculationId).not.toBe(baseline.calculationId);
  expect(changed.dependencyManifest.dependencyFingerprint).not.toBe(baseline.dependencyManifest.dependencyFingerprint);
  expect(changed.dependencyManifest.priorResultStale).toBe(true);
  expect(changed.routeTraceFingerprint).toBeTruthy();
  expect(changed.pumpWindowAuditContract.pumpObjectProperties.fieldValues.inputMode).toBe('Advanced');
  expect(changed.pumpWindowAuditContract.engineeringReports.pumpCurveBasis.npshrManufacturerProvided).toBe(false);
  expect(changed.pumpWindowAuditContract.dependencyManifestCoverage.hasNodes).toBe(true);
  expect(changed.pumpWindowAuditContract.dependencyManifestCoverage.hasEdges).toBe(true);
  expect(changed.pumpWindowAuditContract.dependencyManifestCoverage.affectedReports).toContain('Pump Formula Defense');
  expect(changed.pumpWindowAuditContract.pumpFormulaDefense.auditTrail.calculationId).toBe(changed.calculationId);
  expect(changedSnapshot.chart.inputFingerprint.value).not.toBe(baselineSnapshot.chart.inputFingerprint.value);
  expect(changedSnapshot.formulaRows.length).toBeGreaterThan(0);
  await page.waitForFunction(({ calculationId, expectedPumpAuditVersion }) => {
    const windowNode = document.querySelector('.pump-formula-defense-task-window');
    const rows = window.__npshGlobalModel?.P?.results?.npshEvaluation?.calculationTrace?.academicFormulaDefenseRows || [];
    const refreshMeta = window.__pumpFormulaDefenseLiveAuditLastRefresh || {};
    return !!windowNode
      && window.EngineeringPumpFormulaDefenseLiveAudit?.version === expectedPumpAuditVersion
      && window.refreshPumpFormulaDefenseWindowContent?.__pumpFormulaDefenseLiveAuditVersion === expectedPumpAuditVersion
      && rows.length > 0
      && (rows.some((row) => row.calculationId === calculationId) || rows.every((row) => !row.calculationId))
      && Array.isArray(refreshMeta.pumpIds)
      && refreshMeta.pumpIds.includes('P')
      && /Trace Rows|NPSHa|NPSHr/i.test(windowNode.textContent || '');
  }, {
    calculationId: changed.calculationId,
    expectedPumpAuditVersion: PUMP_FORMULA_DEFENSE_LIVE_AUDIT_VERSION
  }, { timeout: 10000 });
  const changedFormulaWindow = await pumpFormulaDefenseWindowSnapshot(page);
  expect(changedFormulaWindow.refreshMeta.version).toBe(PUMP_FORMULA_DEFENSE_LIVE_AUDIT_VERSION);
  expect(changedFormulaWindow.rowCalculationIds.every((id) => id === changed.calculationId)).toBe(true);
  expect(changedFormulaWindow.text).toMatch(/Trace Rows|NPSHa|NPSHr/i);
  expect(changedFormulaWindow.text).not.toMatch(/Required NPSHa|Maximum Allowable NPSHr|Manual NPSHr Comparison|Vendor Curve Verification|NPSH Excess/i);
  expect(npshrRow?.substitution || npshrRow?.substitutedValues || '').toMatch(/12\.000.*-\s*m/i);
  expect(marginRow?.substitution || marginRow?.substitutedValues || '').toMatch(/[0-9].*-\s*(?:[0-9]|-).*=/);
  expect(simulateRequests.length).toBeGreaterThanOrEqual(2);
  expect(changedRequests.length).toBeGreaterThanOrEqual(1);
  expect(appliedChangedRequest).toBeTruthy();
  expect(stalePrior.previousDependencyFingerprint).not.toBe(changed.dependencyManifest.dependencyFingerprint);
  expect(changed.dependencyManifest.previousDependencyFingerprint).toBeTruthy();
  expect(appliedChangedRequest.payload.client.previousDependencyFingerprint).toBe(changed.dependencyManifest.previousDependencyFingerprint);
  expect(appliedChangedRequest.payload.client.previousDependencyFingerprint).not.toBe(changed.dependencyManifest.dependencyFingerprint);
  expect(appliedChangedRequest.payload.model.P.props.speed).toBe(3600);

  const workflow = await proposalWorkflow(page);
  expect(workflow.pendingAfterEvaluate).toBe(true);
  expect(workflow.apply.ok).toBe(true);
  expect(workflow.appliedChangedNpshaCandidate).toBe(true);
  expect(workflow.manufacturerCurvePreserved).toBe(true);
  expect(workflow.restore.ok).toBe(true);
  expect(Number(workflow.restoredDesignNpshr)).toBe(Number(workflow.originalDesignNpshr));
  expect(workflow.clear.ok).toBe(true);
  expect(workflow.clearKeptInputs).toBe(true);
  expect(workflow.proposalAfterClear).toBe(false);

  await page.evaluate(() => window.EngineeringDefenseExportPackage.openDefensePackagePanel());
  await expect(page.locator('.defense-export-stale-gate')).toHaveAttribute('data-export-ready', 'true');
  await expect(page.locator('[data-defense-package-action="json"]')).toBeEnabled();

  await page.evaluate(() => {
    if (typeof window.openPumpFormulaDefenseTaskWindow === 'function') {
      window.openPumpFormulaDefenseTaskWindow('P');
    }
    window.EngineeringPumpFormulaDefenseLiveAudit?.refresh?.('P');
  });
  const defenseText = await page.locator('body').textContent();
  expect(defenseText).toMatch(/NPSHa|NPSHr|Trace Rows/i);
  expect(defenseText).not.toMatch(/Vendor Curve Verification|NPSH Excess/i);

  const screenshotPath = testInfo.outputPath('pump-window-audit-current.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach('pump window audit current', { path: screenshotPath, contentType: 'image/png' });

  console.log(JSON.stringify({
    pumpWindowE2E: 'pass',
    backendCalls: simulateRequests.length,
    baseline: {
      calculationId: baseline.calculationId,
      dependencyFingerprint: baseline.dependencyManifest.dependencyFingerprint,
      chartFingerprint: baselineSnapshot.chart.inputFingerprint.value
    },
    changed: {
      calculationId: changed.calculationId,
      dependencyFingerprint: changed.dependencyManifest.dependencyFingerprint,
      priorResultStale: changed.dependencyManifest.priorResultStale,
      chartFingerprint: changedSnapshot.chart.inputFingerprint.value
    },
    proposalWorkflow: {
      evaluateStatus: workflow.evaluateStatus,
      applyStatus: workflow.apply.status,
      restoreStatus: workflow.restore.status,
      clearStatus: workflow.clear.status,
      manufacturerCurvePreserved: workflow.manufacturerCurvePreserved
    },
    screenshotPath
  }, null, 2));
});
