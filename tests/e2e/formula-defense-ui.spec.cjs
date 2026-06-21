const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const stableArtifactDir = path.resolve(__dirname, '..', '..', 'test-artifacts', 'formula-defense-ui');

async function gotoWithoutFormulaAutoEnhance(page) {
  await page.addInitScript(() => {
    window.__NPSH_FORMULA_DEFENSE_UI_DISABLE_AUTO_ENHANCE__ = true;
  });
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    window.EngineeringFormulaDefenseUI?.version === 'engineering-formula-defense-ui.v1'
    && window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v10'
    && window.katex?.renderToString
  ), null, { timeout: 30000 });
}

async function gotoWithFormulaRuntime(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    window.EngineeringFormulaDefenseUI?.version === 'engineering-formula-defense-ui.v1'
    && typeof window.openPipeFormulaDefenseTaskWindow === 'function'
    && typeof window.buildPipeCalculationTrace === 'function'
    && typeof window.calculatePipeHydraulicSegments === 'function'
  ), null, { timeout: 30000 });
}

function mockFormulaDefenseMarkup() {
  return `
    <section id="formulaDefenseMock" class="task-window pipe-formula-defense-task-window" data-task-node-id="PIPE-1" data-formula-defense-window="true">
      <div class="pipe-formula-defense-body pipe-formula-defense-layout">
        <h2>Pipe Formula Defense</h2>
        <article class="pipe-trace-block">
          <h3>Formula Sequence & Active Substitution</h3>
          <div id="darkFormula" class="academic-equation-step">
            <div class="academic-equation-context">Darcy-Weisbach</div>
            <div class="academic-equation-display" style="background:#0b1220;border:1px solid #0b1220;padding:12px;border-radius:8px;">
              <span class="academic-equation-math" style="color:#0b1220;">hf = f (L/D) (V^2/(2g))</span>
            </div>
            <div class="academic-equation-result">Result: 2.616 m</div>
          </div>
        </article>
        <article class="pipe-trace-block">
          <h3>Realtime Role Path</h3>
          <div class="pump-curve-explanation-table-wrap">
            <table class="pump-curve-explanation-table pipe-formula-defense-role-path-table">
              <thead>
                <tr>
                  <th>Realtime Role Path</th>
                  <th>Live Readout</th>
                  <th>Who Uses It</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Pipe segments/fittings -> Total loss</td>
                  <td>Major 0.080 m / Minor 2.535 m / Total 2.616 m</td>
                  <td>Total loss is sent back to the hydraulic network solver and then to pump NPSH/system-head calculations.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
        <article class="pipe-trace-block">
          <h3>Pipe Fitting Valve Breakdown</h3>
          <div class="pump-curve-explanation-table-wrap">
            <table class="pump-curve-explanation-table pipe-formula-defense-fitting-breakdown-table">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>K total</th>
                  <th>Major hL</th>
                  <th>Minor hL</th>
                  <th>Total hL</th>
                  <th>Source / Note</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>PIPE-1-Seg-1 Journal discharge pipe 3 in</td><td>Pipe major loss</td><td>0.000</td><td>0.000</td><td>1.756 m</td><td>0.000 m</td><td>1.756 m</td><td>[Journal] Journal Case 6 discharge pipe: internal diameter 0.0738 m, length 10 m.</td></tr>
                <tr><td>PIPE-1-Seg-2 Globe valve 3 in</td><td>Valve / inline component</td><td>1.000</td><td>6.100</td><td>0.000 m</td><td>3.278 m</td><td>3.278 m</td><td>[Journal] Journal discharge minor loss: globe valve 3 in, K = 6.1.</td></tr>
              </tbody>
            </table>
          </div>
        </article>
        <article class="fluid-help-card">
          <h3>Source & Confidence Map</h3>
          <div class="pump-curve-explanation-table-wrap fluid-formula-defense-table-wrap">
            <table class="pump-curve-explanation-table fluid-formula-defense-table pipe-formula-defense-source-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Formula</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Flow</td>
                  <td>50.000 m3/h</td>
                  <td>Network-derived</td>
                  <td>Solved pipe path</td>
                  <td class="academic-inline-formula" title="Q_m3/s = Q_m3/h / 3600">Q_m3/s = Q_m3/h / 3600</td>
                  <td>Hydraulic network flow balance</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
        <article class="pipe-trace-block">
          <h3>Dependency Chain</h3>
          <p>Flowrate -> Velocity -> Reynolds Number -> Friction Factor -> Major Loss -> Minor Loss -> TDH -> Pump Duty</p>
        </article>
        <label for="diameterInput">Diameter</label>
        <input id="diameterInput" name="diameter" value="0.0738">
      </div>
    </section>
  `;
}

async function contrastForFormula(page) {
  return page.evaluate(() => {
    const node = document.querySelector('#darkFormula .academic-equation-math');
    const surface = node.closest('.academic-equation-display');
    const parse = (value) => {
      const match = String(value || '').match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const [r, g, b] = match[1].split(',').slice(0, 3).map((part) => Number.parseFloat(part));
      return { r, g, b };
    };
    const luminance = ({ r, g, b }) => {
      const linear = (channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    };
    const ratio = (foreground, background) => {
      const high = Math.max(luminance(foreground), luminance(background));
      const low = Math.min(luminance(foreground), luminance(background));
      return (high + 0.05) / (low + 0.05);
    };
    const nodeStyle = getComputedStyle(node);
    const surfaceStyle = getComputedStyle(surface);
    const foreground = parse(nodeStyle.color);
    const background = parse(surfaceStyle.backgroundColor);
    return {
      color: nodeStyle.color,
      backgroundColor: surfaceStyle.backgroundColor,
      ratio: foreground && background ? ratio(foreground, background) : 0,
      visible: node.getBoundingClientRect().width > 0
        && node.getBoundingClientRect().height > 0
        && nodeStyle.visibility !== 'hidden'
        && nodeStyle.display !== 'none'
        && Number.parseFloat(nodeStyle.opacity) > 0
    };
  });
}

test('Formula Defense UI renders light KaTeX equations, responsive tables, dependency trace, and realtime debounce', async ({ page }, testInfo) => {
  await gotoWithoutFormulaAutoEnhance(page);
  await page.evaluate((markup) => {
    const conflictStyle = document.createElement('style');
    conflictStyle.id = 'legacyFormulaConflictStyle';
    conflictStyle.textContent = '#formulaDefenseMock .academic-equation-math{color:#0b1220!important}';
    document.head.appendChild(conflictStyle);
    document.body.insertAdjacentHTML('beforeend', markup);
  }, mockFormulaDefenseMarkup());

  const beforeContrast = await contrastForFormula(page);
  expect(beforeContrast.visible).toBe(true);
  expect(beforeContrast.backgroundColor).toBe('rgb(255, 255, 255)');
  expect(beforeContrast.ratio).toBeGreaterThanOrEqual(4.5);

  const beforePath = testInfo.outputPath('formula-defense-before-light-surface.png');
  await page.locator('#formulaDefenseMock').screenshot({ path: beforePath });
  fs.mkdirSync(stableArtifactDir, { recursive: true });
  const stableBeforePath = path.join(stableArtifactDir, 'formula-defense-before-light-surface.png');
  await page.locator('#formulaDefenseMock').screenshot({ path: stableBeforePath });
  await testInfo.attach('formula defense before light surface', { path: beforePath, contentType: 'image/png' });

  await page.evaluate(() => {
    document.getElementById('legacyFormulaConflictStyle')?.remove();
    window.EngineeringFormulaDefenseUI.install({ force: true });
    window.EngineeringFormulaDefenseUI.enhanceDocument(document);
  });

  await expect(page.locator('#formulaDefenseMock')).toHaveAttribute('data-pipe-formula-defense-layout', 'compact-v2');
  await expect(page.locator('.pipe-formula-defense-layout')).toHaveAttribute('data-pipe-formula-defense-layout', 'compact-v2');
  await expect(page.locator('#darkFormula .academic-equation-math .katex')).toBeVisible();
  const referenceWindowState = await page.evaluate(() => {
    const win = document.getElementById('formulaDefenseMock');
    const body = win.querySelector('.task-window-body, .pipe-formula-defense-body');
    const header = win.querySelector('.fluid-help-card h3');
    const table = win.querySelector('.pump-curve-explanation-table');
    const roleTable = win.querySelector('.pipe-formula-defense-role-path-table');
    const sourceTable = win.querySelector('.pipe-formula-defense-source-table');
    const winStyle = getComputedStyle(win);
    const bodyStyle = getComputedStyle(body);
    const headerStyle = getComputedStyle(header);
    return {
      width: Math.round(win.getBoundingClientRect().width),
      height: Math.round(win.getBoundingClientRect().height),
      cssWidth: winStyle.width,
      cssHeight: winStyle.height,
      bodyPadding: bodyStyle.padding,
      bodyBackground: bodyStyle.backgroundColor,
      cardHeaderPadding: headerStyle.padding,
      cardHeaderFontSize: headerStyle.fontSize,
      cardHeaderLineHeight: headerStyle.lineHeight,
      cardHeaderBackground: headerStyle.backgroundColor,
      cardHeaderColor: headerStyle.color,
      roleTableMinWidth: getComputedStyle(roleTable).minWidth,
      roleTableFontSize: getComputedStyle(roleTable).fontSize,
      sourceTableMinWidth: getComputedStyle(sourceTable).minWidth,
      sourceTableFontSize: getComputedStyle(sourceTable).fontSize
    };
  });
  expect(referenceWindowState.width).toBeGreaterThanOrEqual(696);
  expect(referenceWindowState.width).toBeLessThanOrEqual(704);
  expect(referenceWindowState.height).toBeGreaterThanOrEqual(696);
  expect(referenceWindowState.height).toBeLessThanOrEqual(704);
  expect(referenceWindowState.cssWidth).toBe('700px');
  expect(referenceWindowState.cssHeight).toBe('700px');
  expect(referenceWindowState.bodyPadding).toBe('14px');
  expect(referenceWindowState.bodyBackground).toBe('rgb(246, 248, 251)');
  expect(referenceWindowState.cardHeaderPadding).toBe('10px 12px');
  expect(referenceWindowState.cardHeaderFontSize).toBe('13px');
  expect(referenceWindowState.cardHeaderBackground).toBe('rgb(238, 246, 252)');
  expect(referenceWindowState.cardHeaderColor).toBe('rgb(18, 59, 90)');
  expect(referenceWindowState.roleTableMinWidth).toBe('min(760px, 100%)');
  expect(referenceWindowState.roleTableFontSize).toBe('10.6px');
  expect(referenceWindowState.sourceTableMinWidth).toBe('min(760px, 100%)');
  expect(referenceWindowState.sourceTableFontSize).toBe('10.5px');
  const afterContrast = await contrastForFormula(page);
  expect(afterContrast.visible).toBe(true);
  expect(afterContrast.ratio).toBeGreaterThanOrEqual(4.5);
  expect(afterContrast.backgroundColor).toBe('rgb(255, 255, 255)');
  expect(afterContrast.color).toBe('rgb(15, 23, 42)');

  const tableState = await page.evaluate(() => {
    const table = document.querySelector('.pipe-formula-defense-fitting-breakdown-table');
    const wrapper = table.closest('.pump-curve-explanation-table-wrap');
    const roleTable = document.querySelector('.pipe-formula-defense-role-path-table');
    const roleWrapper = roleTable.closest('.pump-curve-explanation-table-wrap');
    const sourceTable = document.querySelector('.pipe-formula-defense-source-table');
    const sourceWrapper = sourceTable.closest('.fluid-formula-defense-table-wrap');
    const sourceFormulaCell = sourceTable.querySelector('.pipe-source-map-formula-cell');
    const sourceFormula = sourceFormulaCell.querySelector('code');
    const moodyTable = document.querySelector('.pipe-formula-defense-moody-table');
    const header = table.querySelector('thead th');
    const firstRow = table.querySelector('tbody tr:first-child td');
    const secondRow = table.querySelector('tbody tr:nth-child(2) td');
    const formulaStyle = getComputedStyle(sourceFormula);
    const formulaCellStyle = getComputedStyle(sourceFormula.closest('td'));
    return {
      responsive: table.dataset.formulaDefenseResponsive,
      wrapperOverflowX: getComputedStyle(wrapper).overflowX,
      targetWrapper: wrapper.classList.contains('pipe-formula-defense-target-table-wrap'),
      firstCellLabel: table.querySelector('tbody td')?.dataset.label,
      roleResponsive: roleTable.dataset.formulaDefenseResponsive,
      roleWrapperOverflowX: getComputedStyle(roleWrapper).overflowX,
      roleTargetWrapper: roleWrapper.classList.contains('pipe-formula-defense-target-table-wrap'),
      roleFirstCellLabel: roleTable.querySelector('tbody td')?.dataset.label,
      sourceResponsive: sourceTable.dataset.formulaDefenseResponsive,
      sourceWrapperOverflowX: getComputedStyle(sourceWrapper).overflowX,
      sourceFormulaBackground: formulaStyle.backgroundColor,
      sourceFormulaColor: formulaStyle.color,
      sourceFormulaText: sourceFormula.textContent,
      sourceFormulaPlain: sourceFormulaCell.dataset.formulaDefensePlain,
      sourceFormulaCellBackground: formulaCellStyle.backgroundColor,
      headerPosition: getComputedStyle(header).position,
      firstRowBackground: getComputedStyle(firstRow).backgroundColor,
      secondRowBackground: getComputedStyle(secondRow).backgroundColor,
      qtyAlignment: getComputedStyle(table.querySelector('tbody tr:first-child td:nth-child(3)')).textAlign,
      roleLiveReadoutWeight: getComputedStyle(roleTable.querySelector('tbody tr:first-child td:nth-child(2)')).fontWeight,
      breakdownTypeWeight: getComputedStyle(table.querySelector('tbody tr:first-child td:nth-child(2)')).fontWeight,
      breakdownNumericWeight: getComputedStyle(table.querySelector('tbody tr:first-child td:nth-child(5)')).fontWeight,
      moodyNumericWeight: moodyTable
        ? getComputedStyle(moodyTable.querySelector('tbody tr:first-child td:nth-child(2)')).fontWeight
        : null
    };
  });
  expect(tableState.responsive).toBe('true');
  expect(tableState.wrapperOverflowX).toBe('auto');
  expect(tableState.targetWrapper).toBe(true);
  expect(tableState.firstCellLabel).toBe('Segment');
  expect(tableState.roleResponsive).toBe('true');
  expect(tableState.roleWrapperOverflowX).toBe('auto');
  expect(tableState.roleTargetWrapper).toBe(true);
  expect(tableState.roleFirstCellLabel).toBe('Realtime Role Path');
  expect(tableState.sourceResponsive).toBe('true');
  expect(tableState.sourceWrapperOverflowX).toBe('auto');
  expect(tableState.sourceFormulaBackground).toBe('rgb(255, 255, 255)');
  expect(tableState.sourceFormulaColor).toBe('rgb(15, 23, 42)');
  expect(tableState.sourceFormulaText).toBe('Q_m3/s = Q_m3/h / 3600');
  expect(tableState.sourceFormulaPlain).toBe('true');
  expect(tableState.sourceFormulaCellBackground).not.toBe('rgb(0, 0, 0)');
  expect(tableState.headerPosition).toBe('static');
  expect(tableState.secondRowBackground).not.toBe(tableState.firstRowBackground);
  expect(tableState.qtyAlignment).toBe('right');
  expect(tableState.roleLiveReadoutWeight).toBe('400');
  expect(tableState.breakdownTypeWeight).toBe('400');
  expect(tableState.breakdownNumericWeight).toBe('400');
  if (tableState.moodyNumericWeight) expect(tableState.moodyNumericWeight).toBe('400');

  const mediumTableState = await page.evaluate(() => {
    const win = document.getElementById('formulaDefenseMock');
    win.style.width = '860px';
    win.style.height = '620px';
    win.classList.add('task-window-resized');
    window.EngineeringFormulaDefenseUI.enhanceDocument(document);
    const roleTable = document.querySelector('.pipe-formula-defense-role-path-table');
    const roleWrapper = roleTable.closest('.pump-curve-explanation-table-wrap');
    const fittingTable = document.querySelector('.pipe-formula-defense-fitting-breakdown-table');
    const fittingWrapper = fittingTable.closest('.pump-curve-explanation-table-wrap');
    const kHead = fittingTable.querySelector('thead th:nth-child(4)');
    const majorHead = fittingTable.querySelector('thead th:nth-child(5)');
    const majorCell = fittingTable.querySelector('tbody tr:first-child td:nth-child(5)');
    const sourceHead = fittingTable.querySelector('thead th:nth-child(8)');
    const sourceCell = fittingTable.querySelector('tbody tr:first-child td:nth-child(8)');
    return {
      width: Math.round(win.getBoundingClientRect().width),
      fittingTableWidth: Math.round(fittingTable.getBoundingClientRect().width),
      fittingWrapperClientWidth: Math.round(fittingWrapper.clientWidth),
      fittingWrapperScrollWidth: Math.round(fittingWrapper.scrollWidth),
      fittingHeadDisplay: getComputedStyle(fittingTable.querySelector('thead')).display,
      kHeadText: kHead.textContent.trim(),
      kHeadWhiteSpace: getComputedStyle(kHead).whiteSpace,
      kHeadOverflowWrap: getComputedStyle(kHead).overflowWrap,
      majorHeadWhiteSpace: getComputedStyle(majorHead).whiteSpace,
      majorCellWhiteSpace: getComputedStyle(majorCell).whiteSpace,
      sourceHeadAlign: getComputedStyle(sourceHead).textAlign,
      sourceCellAlign: getComputedStyle(sourceCell).textAlign,
      roleTableWidth: Math.round(roleTable.getBoundingClientRect().width),
      roleWrapperClientWidth: Math.round(roleWrapper.clientWidth),
      roleWrapperScrollWidth: Math.round(roleWrapper.scrollWidth),
      roleHeadDisplay: getComputedStyle(roleTable.querySelector('thead')).display
    };
  });
  expect(mediumTableState.width).toBeGreaterThanOrEqual(856);
  expect(mediumTableState.width).toBeLessThanOrEqual(864);
  expect(mediumTableState.fittingTableWidth).toBeGreaterThanOrEqual(850);
  expect(mediumTableState.fittingWrapperScrollWidth).toBeGreaterThanOrEqual(mediumTableState.fittingWrapperClientWidth);
  expect(mediumTableState.fittingHeadDisplay).toBe('table-header-group');
  expect(mediumTableState.kHeadText).toBe('K total');
  expect(mediumTableState.kHeadWhiteSpace).toBe('nowrap');
  expect(mediumTableState.kHeadOverflowWrap).toBe('normal');
  expect(mediumTableState.majorHeadWhiteSpace).toBe('nowrap');
  expect(mediumTableState.majorCellWhiteSpace).toBe('nowrap');
  expect(mediumTableState.sourceHeadAlign).toBe('left');
  expect(mediumTableState.sourceCellAlign).toBe('left');
  expect(mediumTableState.roleTableWidth).toBeGreaterThanOrEqual(800);
  expect(mediumTableState.roleWrapperScrollWidth).toBeGreaterThanOrEqual(mediumTableState.roleWrapperClientWidth);
  expect(mediumTableState.roleHeadDisplay).toBe('table-header-group');

  const resizedState = await page.evaluate(() => {
    const win = document.getElementById('formulaDefenseMock');
    win.style.width = '520px';
    win.style.height = '520px';
    win.classList.add('task-window-resized');
    window.EngineeringFormulaDefenseUI.enhanceDocument(document);
    const roleTable = document.querySelector('.pipe-formula-defense-role-path-table');
    const fittingTable = document.querySelector('.pipe-formula-defense-fitting-breakdown-table');
    return {
      width: Math.round(win.getBoundingClientRect().width),
      height: Math.round(win.getBoundingClientRect().height),
      roleHeadDisplay: getComputedStyle(roleTable.querySelector('thead')).display,
      roleCellDisplay: getComputedStyle(roleTable.querySelector('tbody td')).display,
      fittingHeadDisplay: getComputedStyle(fittingTable.querySelector('thead')).display,
      fittingCellDisplay: getComputedStyle(fittingTable.querySelector('tbody td')).display
    };
  });
  expect(resizedState.width).toBeGreaterThanOrEqual(516);
  expect(resizedState.width).toBeLessThanOrEqual(524);
  expect(resizedState.height).toBeGreaterThanOrEqual(516);
  expect(resizedState.height).toBeLessThanOrEqual(524);
  expect(resizedState.roleHeadDisplay).toBe('none');
  expect(resizedState.fittingHeadDisplay).toBe('none');
  expect(resizedState.roleCellDisplay).toBe('grid');
  expect(resizedState.fittingCellDisplay).toBe('grid');

  await expect(page.locator('.formula-dependency-visualization')).toContainText('Changed Input');
  await expect(page.locator('.formula-dependency-visualization')).toContainText('Affected Variables');
  await expect(page.locator('.formula-dependency-visualization')).toContainText('Recalculated Variables');
  await expect(page.locator('.formula-dependency-visualization')).toContainText('Final Result');

  await page.evaluate(() => {
    window.__formulaDefenseAutosolveCalls = [];
    window.__formulaDefenseInputStartedAt = null;
    document.getElementById('diameterInput')?.addEventListener('input', () => {
      window.__formulaDefenseInputStartedAt = performance.now();
    }, { once: true });
    window.updateSimulation = async (options) => {
      window.__formulaDefenseAutosolveCalls.push({
        options,
        latencyMs: performance.now() - (window.__formulaDefenseInputStartedAt || performance.now())
      });
      window.EngineeringRealtimeCalculationDefense?.markCurrentFromBackend?.({
        calculationId: `formula-defense-e2e-${window.__formulaDefenseAutosolveCalls.length}`
      });
      return { calculationId: 'formula-defense-e2e' };
    };
  });
  await page.locator('#diameterInput').fill('0.0810');
  await page.waitForFunction(() => (window.__formulaDefenseAutosolveCalls || []).length >= 1);
  const autosolveState = await page.evaluate(() => ({
    calls: window.__formulaDefenseAutosolveCalls,
    bypass: window.__formulaDefenseUiAutosolveBypass
  }));
  expect(autosolveState.calls).toHaveLength(1);
  expect(autosolveState.calls[0].latencyMs).toBeLessThan(650);
  expect(autosolveState.calls[0].options.__engineeringRealtimeAutoSolve).toBe(true);
  expect(autosolveState.calls[0].options.__engineeringRealtimeAutoSolveSequence).toBeGreaterThan(0);
  expect(autosolveState.calls[0].options.forceBackend).toBe(true);
  expect(autosolveState.bypass.reason).toContain('RealtimeCalculationDefense owns autosolve');
  const refreshState = await page.evaluate(() => ({
    refreshApi: typeof window.EngineeringFormulaDefenseUI.refreshOpenPipeFormulaDefenseWindows,
    refreshed: window.EngineeringFormulaDefenseUI.refreshOpenPipeFormulaDefenseWindows()
  }));
  expect(refreshState.refreshApi).toBe('function');
  expect(refreshState.refreshed).toBeGreaterThanOrEqual(0);

  await expect(page.locator('.formula-defense-calculation-banner')).toContainText(/Current|Calculating|Stale/);

  const afterPath = testInfo.outputPath('formula-defense-after-katex-visible.png');
  await page.locator('#formulaDefenseMock').screenshot({ path: afterPath });
  const stableAfterPath = path.join(stableArtifactDir, 'formula-defense-after-katex-visible.png');
  await page.locator('#formulaDefenseMock').screenshot({ path: stableAfterPath });
  await testInfo.attach('formula defense after KaTeX visible', { path: afterPath, contentType: 'image/png' });

  console.log(JSON.stringify({
    formulaDefenseUiE2E: 'pass',
    beforeContrast,
    afterContrast,
    tableState,
    autosolveState,
    beforePath,
    afterPath,
    stableBeforePath,
    stableAfterPath
  }, null, 2));
});

test('Pipe Formula Defense values refresh from live pipe model data', async ({ page }) => {
  await gotoWithFormulaRuntime(page);
  await page.evaluate(() => {
    window.EngineeringFormulaDefenseUI.install({ force: true });
    const model = typeof globalModel !== 'undefined' ? globalModel : (window.globalModel ||= {});
    model.FLUID = { type: 'fluid', props: { density: 958.348, viscosity: 0.803, vaporPressure: 1.014 } };
    const makePipe = (flow, diameter) => {
      const segments = [{
        name: 'PIPE-RT-Seg-1 Live diameter pipe',
        pipeSize: 'Custom diameter',
        material: 'Custom roughness',
        length: 10,
        diameter,
        roughness: 0.00015,
        fittingType: 'None',
        fittingQuantity: 0,
        fittingK: 0,
        additionalK: 0,
        notes: 'Realtime validation segment.'
      }, {
        name: 'PIPE-RT-Seg-2 Live valve K',
        pipeSize: 'Custom diameter',
        material: 'Custom roughness',
        length: 0,
        diameter,
        roughness: 0.00015,
        fittingType: 'Custom K',
        fittingQuantity: 1,
        fittingK: 6.1,
        additionalK: 0,
        notes: 'Realtime validation K.'
      }];
      const segmentProfiles = segments.map((segment, index) => ({
        index,
        startElevation: 0,
        endElevation: 0,
        startPressure: 3.781,
        endPressure: 2.676,
        highPointPressure: 2.676,
        highPointVaporMargin: 1.662
      }));
      return {
        type: 'pipe',
        name: 'PIPE-RT',
        props: { elevationProfileMode: 'End Elevations', roughnessAgingFactor: 1, headLossAllowancePercent: 0, segments },
        results: {
          flow,
          pressureCalculated: true,
          segmentProfiles,
          pressure: 3.2,
          inletPressure: 3.781,
          outletPressure: 2.676,
          highPointPressure: 2.676,
          highPointVaporMargin: 1.662,
          warnings: []
        }
      };
    };
    const pipe = makePipe(50, 0.0738);
    model['PIPE-RT'] = pipe;
    window.globalModel = model;
    pipe.results.calculationTrace = window.buildPipeCalculationTrace(50, pipe.props, pipe.results, null, 'PIPE-RT');
    window.openPipeFormulaDefenseTaskWindow('PIPE-RT');
    window.EngineeringFormulaDefenseUI.refreshOpenPipeFormulaDefenseWindows();
  });
  await page.waitForSelector('.pipe-formula-defense-task-window[data-pipe-node="PIPE-RT"] .pipe-formula-defense-source-table tbody tr');
  await page.waitForFunction(() => (
    document.querySelector('.pipe-formula-defense-task-window[data-pipe-node="PIPE-RT"] .pipe-formula-defense-segment-metric[data-pipe-basis-tooltip="true"]')
  ), null, { timeout: 3000 });

  const before = await page.evaluate(() => {
    const win = document.querySelector('.pipe-formula-defense-task-window[data-pipe-node="PIPE-RT"]');
    const text = (selector) => win.querySelector(selector)?.textContent.trim() || '';
    const basisValue = (segmentIndex, label) => {
      const card = win.querySelectorAll('.pipe-formula-defense-segment-card')[segmentIndex];
      return [...(card?.querySelectorAll('.pipe-formula-defense-segment-metric') || [])]
        .find((metric) => metric.querySelector('span')?.textContent.trim() === label)
        ?.querySelector('strong')?.textContent.trim() || '';
    };
    const basisTitle = (segmentIndex, label) => {
      const card = win.querySelectorAll('.pipe-formula-defense-segment-card')[segmentIndex];
      return [...(card?.querySelectorAll('.pipe-formula-defense-segment-metric') || [])]
        .find((metric) => metric.querySelector('span')?.textContent.trim() === label)
        ?.getAttribute('title') || '';
    };
    const basisWeight = (segmentIndex, label) => {
      const card = win.querySelectorAll('.pipe-formula-defense-segment-card')[segmentIndex];
      const node = [...(card?.querySelectorAll('.pipe-formula-defense-segment-metric') || [])]
        .find((metric) => metric.querySelector('span')?.textContent.trim() === label)
        ?.querySelector('strong');
      return node ? getComputedStyle(node).fontWeight : '';
    };
    return {
      sourceFlow: text('.pipe-formula-defense-source-table tbody tr:first-child td:nth-child(2)'),
      roleLoss: text('.pipe-formula-defense-role-path-table tbody tr:nth-child(3) td:nth-child(2)'),
      formulaFlow: [...win.querySelectorAll('.pipe-formula-defense-formula-list .academic-equation-step')]
        .find((step) => /Flow Conversion/.test(step.textContent))?.textContent || '',
      firstMajor: text('.pipe-formula-defense-fitting-breakdown-table tbody tr:first-child td:nth-child(5)'),
      firstSizeBasis: basisValue(0, 'Pipe size basis'),
      firstMaterialBasis: basisValue(0, 'Material basis'),
      secondFittingBasis: basisValue(1, 'Fitting basis'),
      firstSizeTitle: basisTitle(0, 'Pipe size basis'),
      firstSizeWeight: basisWeight(0, 'Pipe size basis')
    };
  });
  expect(before.sourceFlow).toContain('50.000 m3/h');
  expect(before.formulaFlow).toContain('50');
  expect(before.firstSizeBasis).toBe('Custom dia · 73.8 mm');
  expect(before.firstMaterialBasis).toBe('Custom ε · 0.150 mm');
  expect(before.secondFittingBasis).toBe('Custom K · 6.1');
  expect(before.firstSizeTitle).toContain('Selected NPS / Schedule: Custom diameter');
  expect(before.firstSizeWeight).toBe('400');

  await page.evaluate(() => {
    const pipe = window.globalModel['PIPE-RT'];
    pipe.results.flow = 60;
    pipe.props.segments.forEach((segment) => {
      segment.diameter = 0.081;
    });
    pipe.results.segmentProfiles = pipe.props.segments.map((segment, index) => ({
      index,
      startElevation: 0,
      endElevation: 0,
      startPressure: 3.9,
      endPressure: 2.9,
      highPointPressure: 2.9,
      highPointVaporMargin: 1.886
    }));
    pipe.results.pressure = 3.4;
    pipe.results.inletPressure = 3.9;
    pipe.results.outletPressure = 2.9;
    pipe.results.highPointPressure = 2.9;
    pipe.results.highPointVaporMargin = 1.886;
    pipe.results.calculationTrace = window.buildPipeCalculationTrace(60, pipe.props, pipe.results, null, 'PIPE-RT');
    window.EngineeringFormulaDefenseUI.refreshOpenPipeFormulaDefenseWindows();
  });

  await page.waitForFunction(() => {
    const win = document.querySelector('.pipe-formula-defense-task-window[data-pipe-node="PIPE-RT"]');
    return win?.querySelector('.pipe-formula-defense-source-table tbody tr:first-child td:nth-child(2)')?.textContent.includes('60.000 m3/h');
  }, null, { timeout: 3000 });

  const after = await page.evaluate(() => {
    const win = document.querySelector('.pipe-formula-defense-task-window[data-pipe-node="PIPE-RT"]');
    const text = (selector) => win.querySelector(selector)?.textContent.trim() || '';
    const basisValue = (segmentIndex, label) => {
      const card = win.querySelectorAll('.pipe-formula-defense-segment-card')[segmentIndex];
      return [...(card?.querySelectorAll('.pipe-formula-defense-segment-metric') || [])]
        .find((metric) => metric.querySelector('span')?.textContent.trim() === label)
        ?.querySelector('strong')?.textContent.trim() || '';
    };
    return {
      sourceFlow: text('.pipe-formula-defense-source-table tbody tr:first-child td:nth-child(2)'),
      roleLoss: text('.pipe-formula-defense-role-path-table tbody tr:nth-child(3) td:nth-child(2)'),
      formulaFlow: [...win.querySelectorAll('.pipe-formula-defense-formula-list .academic-equation-step')]
        .find((step) => /Flow Conversion/.test(step.textContent))?.textContent || '',
      firstMajor: text('.pipe-formula-defense-fitting-breakdown-table tbody tr:first-child td:nth-child(5)'),
      firstSizeBasis: basisValue(0, 'Pipe size basis'),
      firstMaterialBasis: basisValue(0, 'Material basis'),
      secondFittingBasis: basisValue(1, 'Fitting basis'),
      segmentCards: win.querySelectorAll('.pipe-formula-defense-segment-card').length,
      sourceRows: win.querySelectorAll('.pipe-formula-defense-source-table tbody tr').length
    };
  });
  expect(after.sourceFlow).toContain('60.000 m3/h');
  expect(after.formulaFlow).toContain('60');
  expect(after.roleLoss).not.toBe(before.roleLoss);
  expect(after.firstMajor).not.toBe(before.firstMajor);
  expect(after.firstSizeBasis).toBe('Custom dia · 81 mm');
  expect(after.firstMaterialBasis).toBe(before.firstMaterialBasis);
  expect(after.secondFittingBasis).toBe(before.secondFittingBasis);
  expect(after.segmentCards).toBe(2);
  expect(after.sourceRows).toBe(16);
});
