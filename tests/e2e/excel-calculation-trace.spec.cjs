const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const JSZip = require('../../vendor/jszip.min.js');

function createPipe(name, { length, diameter, fittingK }) {
  return {
    type: 'pipe',
    name,
    props: {
      segments: [
        {
          name: `${name}-Seg-1`,
          length,
          diameter,
          roughness: 0.000045,
          fittingType: 'Custom K',
          fittingQuantity: 1,
          fittingK,
          minorLoss: 0
        }
      ]
    }
  };
}

function twoPipeProject() {
  return {
    projectFile: { sourceFormat: 'playwright-excel-calculation-trace' },
    model: {
      FLUID: {
        type: 'fluid',
        name: 'Fluid Basis',
        props: {
          fluidName: 'Water',
          temp: 90,
          density: 965.309,
          viscosity: 0.325,
          dynamicViscosity: 0.314,
          vaporPressure: 0.701827,
          vaporPressureHead: 7.411
        }
      },
      SRC: {
        type: 'source',
        name: 'SRC-100',
        props: {
          flow: 39.68,
          pressure: 2.024,
          pressureInputBasis: 'Absolute',
          elevation: 1.4
        }
      },
      'PIPE-1': createPipe('PIPE-1', { length: 46, diameter: 0.0635, fittingK: 1.2 }),
      'P-100': {
        type: 'pump',
        name: 'P-100',
        props: {
          designFlow: 39.68,
          designNpshr: 1,
          suctionElevation: 0
        },
        results: {
          flow: 39.68,
          npsha: 15.3476,
          npshr: 1,
          npshMargin: 14.3476,
          npshRatio: 15.3476,
          suctionLoss: 0.014,
          dischargeLoss: 0.2,
          vaporPressureHead: 7.411,
          suctionPressure: 2.155,
          requiredSystemHead: 26.9,
          dischargePressure: 4.72,
          npshEvaluation: {
            npsha: 15.3476,
            npshr: 1,
            npshMargin: 14.3476,
            npshRatio: 15.3476,
            suctionLoss: 0.014,
            dischargeLoss: 0.2,
            vaporPressureHead: 7.411,
            suctionPressure: 2.155,
            dischargePressure: 4.72
          }
        }
      },
      'PIPE-2': createPipe('PIPE-2', { length: 24, diameter: 0.05, fittingK: 2.1 }),
      'SNK-100': {
        type: 'sink',
        name: 'SNK-100',
        props: {
          demandFlow: 39.68,
          pressure: 3.936,
          pressureInputBasis: 'Absolute',
          elevation: 8
        }
      }
    },
    connections: [
      { from: 'SRC', to: 'P-100', pipeId: 'PIPE-1', connectionType: 'hydraulic' },
      { from: 'P-100', to: 'SNK-100', pipeId: 'PIPE-2', connectionType: 'hydraulic' }
    ],
    visuals: {
      SRC: { left: '120px', top: '260px' },
      'P-100': { left: '420px', top: '260px' },
      'SNK-100': { left: '700px', top: '260px' }
    }
  };
}

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.applySimulationStateAtomic === 'function'
    && window.EngineeringExcelCalculationTraceRuntime?.version === 'engineering-excel-calculation-trace.v5'
    && typeof window.exportScenarioCalculationTraceToExcel === 'function'
    && window.exportScenarioCalculationTraceToExcel.__engineeringExcelTraceRuntime === 'engineering-excel-calculation-trace.v5'
  ), null, { timeout: 30000 });
}

async function readXlsx(download) {
  const target = path.join(process.cwd(), 'test-artifacts', `excel-calculation-trace-${Date.now()}.xlsx`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await download.saveAs(target);
  const bytes = await fs.readFile(target);
  return JSZip.loadAsync(bytes);
}

test('Menu File Export Excel Calculation Trace creates formula-backed engineering workbook', async ({ page }) => {
  await waitForNpshApp(page);
  await expect(page.locator('#menu-export-excel-trace')).toHaveText('Excel Calculation Trace (.xlsx)');
  await page.evaluate((project) => {
    window.applySimulationStateAtomic(JSON.stringify(project));
  }, twoPipeProject());
  await expect(page.getByRole('button', { name: 'Route node P-100' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(() => {
    document.querySelector('#menu-file')?.click();
    document.querySelector('#menu-file-export')?.click();
    document.querySelector('#menu-export-excel-trace')?.click();
  });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('Calculation_Trace');
  expect(download.suggestedFilename()).toContain('.xlsx');

  const zip = await readXlsx(download);
  const workbookXml = await zip.file('xl/workbook.xml').async('string');
  [
    'Inputs',
    'Fluid_Basis_Calc',
    'PH_Phase_Data',
    'PH_Phase_Chart',
    'Suction_PFV_Calc',
    'Moody_Suction',
    'Discharge_PFV_Calc',
    'Moody_Discharge',
    'NPSH_Calc',
    'Pump_Discharge_Calc',
    'Calculation_Sequence'
  ].forEach((sheetName) => expect(workbookXml).toContain(sheetName));

  const sheetXml = (
    await Promise.all(
      Object.keys(zip.files)
        .filter((file) => /^xl\/worksheets\/sheet\d+\.xml$/.test(file))
        .map((file) => zip.file(file).async('string'))
    )
  ).join('\n');
  expect(sheetXml).toContain('LOG10');
  expect(sheetXml).toContain('IF(C9&gt;0,C8/C9');
  expect(sheetXml).toContain('1000*(1-(((C4+288.9414)');
  expect(sheetXml).toContain('ISNUMBER');
  expect(sheetXml).toContain('C4+C5-C6-C7');
  expect(sheetXml).toContain('<v>15.3476</v>');
  expect(sheetXml).toContain('<v>14.3476</v>');
  expect(sheetXml).toContain('<v>0.014</v>');
  expect(sheetXml).toContain('<v>0.2</v>');
  expect(sheetXml).toContain('<v>4.72</v>');
  expect(sheetXml).toContain('<v>26.9</v>');
  const sharedStrings = await zip.file('xl/sharedStrings.xml').async('string');
  expect(sharedStrings).toContain('NPSHa');
  expect(sharedStrings).toContain('OUTPUT PUMP');
  expect(sharedStrings).toContain('OUTPUT PFV (Suction)');
  expect(sharedStrings).toContain('OUTPUT PFV (Discharge)');
  expect(sharedStrings).toContain('Solved calculation basis');
  expect(sharedStrings).not.toContain('Trace control');
  expect(sharedStrings).not.toContain('Use application solved/displayed basis');

  const chartPartPrefix = 'xl/charts/chart';
  const chartFiles = Object.keys(zip.files).filter((file) => /^xl\/charts\/chart\d+\.xml$/.test(file));
  expect(chartFiles.every((file) => file.startsWith(chartPartPrefix))).toBe(true);
  expect(chartFiles).toHaveLength(3);
  const chartXml = (await Promise.all(chartFiles.map((file) => zip.file(file).async('string')))).join('\n');
  expect(chartXml).toContain('Pressure-enthalpy phase chart');
  expect(chartXml).toContain('PH_Phase_Data');
  expect(chartXml).toContain('Moody_Suction');
  expect(chartXml).toContain('Moody_Discharge');
  expect(chartXml).toContain('logBase');
});
