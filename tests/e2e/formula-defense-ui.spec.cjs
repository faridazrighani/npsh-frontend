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
    && window.katex?.renderToString
  ), null, { timeout: 30000 });
}

function mockFormulaDefenseMarkup() {
  return `
    <section id="formulaDefenseMock" class="task-window pipe-formula-defense-task-window" data-task-node-id="PIPE-1" data-formula-defense-window="true">
      <div class="pipe-formula-defense-body">
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
          <h3>Pipe Fitting Valve Breakdown</h3>
          <div class="pump-curve-explanation-table-wrap">
            <table class="pump-curve-explanation-table pipe-formula-defense-fitting-breakdown-table">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Element</th>
                  <th>Qty</th>
                  <th>K</th>
                  <th>Major Loss (m)</th>
                  <th>Minor Loss (m)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>PIPE-1-Seg-1</td><td>Journal pipe</td><td>1</td><td>0.000</td><td>1.756</td><td>0.000</td></tr>
                <tr><td>PIPE-1-Seg-2</td><td>Globe valve</td><td>1</td><td>18.448</td><td>0.000</td><td>9.912</td></tr>
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

test('Formula Defense UI renders visible KaTeX equations, responsive tables, dependency trace, and realtime debounce', async ({ page }, testInfo) => {
  await gotoWithoutFormulaAutoEnhance(page);
  await page.evaluate((markup) => {
    const conflictStyle = document.createElement('style');
    conflictStyle.id = 'legacyFormulaConflictStyle';
    conflictStyle.textContent = '#formulaDefenseMock .academic-equation-math{color:#0b1220!important}';
    document.head.appendChild(conflictStyle);
    document.body.insertAdjacentHTML('beforeend', markup);
  }, mockFormulaDefenseMarkup());

  const beforeContrast = await contrastForFormula(page);
  expect(beforeContrast.ratio).toBeLessThan(1.2);

  const beforePath = testInfo.outputPath('formula-defense-before-invisible.png');
  await page.locator('#formulaDefenseMock').screenshot({ path: beforePath });
  fs.mkdirSync(stableArtifactDir, { recursive: true });
  const stableBeforePath = path.join(stableArtifactDir, 'formula-defense-before-invisible.png');
  await page.locator('#formulaDefenseMock').screenshot({ path: stableBeforePath });
  await testInfo.attach('formula defense before invisible formula', { path: beforePath, contentType: 'image/png' });

  await page.evaluate(() => {
    document.getElementById('legacyFormulaConflictStyle')?.remove();
    window.EngineeringFormulaDefenseUI.install({ force: true });
    window.EngineeringFormulaDefenseUI.enhanceDocument(document);
  });

  await expect(page.locator('#darkFormula .academic-equation-math .katex')).toBeVisible();
  const afterContrast = await contrastForFormula(page);
  expect(afterContrast.visible).toBe(true);
  expect(afterContrast.ratio).toBeGreaterThanOrEqual(4.5);

  const tableState = await page.evaluate(() => {
    const table = document.querySelector('.pipe-formula-defense-fitting-breakdown-table');
    const wrapper = table.closest('.pump-curve-explanation-table-wrap');
    const header = table.querySelector('thead th');
    const firstRow = table.querySelector('tbody tr:first-child td');
    const secondRow = table.querySelector('tbody tr:nth-child(2) td');
    return {
      responsive: table.dataset.formulaDefenseResponsive,
      wrapperOverflowX: getComputedStyle(wrapper).overflowX,
      headerPosition: getComputedStyle(header).position,
      firstRowBackground: getComputedStyle(firstRow).backgroundColor,
      secondRowBackground: getComputedStyle(secondRow).backgroundColor,
      qtyAlignment: getComputedStyle(table.querySelector('tbody tr:first-child td:nth-child(3)')).textAlign
    };
  });
  expect(tableState.responsive).toBe('true');
  expect(tableState.wrapperOverflowX).toBe('auto');
  expect(tableState.headerPosition).toBe('sticky');
  expect(tableState.secondRowBackground).not.toBe(tableState.firstRowBackground);
  expect(tableState.qtyAlignment).toBe('right');

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
  const autosolve = await page.waitForFunction(() => window.__formulaDefenseAutosolveCalls?.[0] || null, null, { timeout: 1200 });
  const autosolveState = await autosolve.jsonValue();
  expect(autosolveState.options.refreshReason).toBe('realtime-input');
  expect(autosolveState.options.forceBackend).toBe(true);
  expect(autosolveState.latencyMs).toBeLessThan(200);

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
