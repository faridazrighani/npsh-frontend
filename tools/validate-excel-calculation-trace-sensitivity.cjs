"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const RUNTIME_FILE = path.join(FRONTEND_ROOT, "engineering-excel-calculation-trace-runtime.js");

function createPipe(name, { length, diameter, fittingK }) {
  return {
    type: "pipe",
    name,
    props: {
      segments: [
        {
          name: `${name}-Seg-1`,
          length,
          diameter,
          roughness: 0.000045,
          fittingType: "Custom K",
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
    model: {
      FLUID: {
        type: "fluid",
        name: "Fluid Basis",
        props: {
          fluidName: "Water",
          temp: 90,
          density: 965.309,
          viscosity: 0.325,
          dynamicViscosity: 0.314,
          vaporPressure: 0.701827,
          vaporPressureHead: 7.411,
          specificWeight: 9469.681
        }
      },
      SRC: {
        type: "source",
        name: "SRC-100",
        props: {
          flow: 39.68,
          pressure: 2.024,
          pressureInputBasis: "Absolute",
          elevation: 1.4
        }
      },
      "PIPE-1": createPipe("PIPE-1", { length: 46, diameter: 0.0635, fittingK: 1.2 }),
      "P-100": {
        type: "pump",
        name: "P-100",
        props: { designNpshr: 1, suctionElevation: 0 },
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
            dischargePressure: 4.72,
            requiredSystemHead: 26.9
          }
        }
      },
      "PIPE-2": createPipe("PIPE-2", { length: 24, diameter: 0.05, fittingK: 2.1 }),
      "SNK-100": {
        type: "sink",
        name: "SNK-100",
        props: {
          demandFlow: 39.68,
          pressure: 3.936,
          pressureInputBasis: "Absolute",
          elevation: 8
        }
      }
    },
    connections: [
      { from: "SRC", to: "P-100", pipeId: "PIPE-1", connectionType: "hydraulic" },
      { from: "P-100", to: "SNK-100", pipeId: "PIPE-2", connectionType: "hydraulic" }
    ]
  };
}

const sensitivityTests = [
  { name: "Fluid temperature", section: "Fluid Basis", parameter: "Temperature", value: 95, outputs: [["Fluid_Basis_Calc", "C6"], ["Fluid_Basis_Calc", "C11"], ["NPSH_Calc", "C8"]] },
  { name: "SRC flow", section: "SRC", parameter: "SRC input flow", value: 45, outputs: [["Suction_PFV_Calc", "C8"], ["NPSH_Calc", "C8"]] },
  { name: "SRC pressure", section: "SRC", parameter: "Source absolute pressure", value: 2.5, outputs: [["NPSH_Calc", "C4"], ["NPSH_Calc", "C8"]] },
  { name: "SRC elevation", section: "SRC", parameter: "Source elevation", value: 2.2, outputs: [["NPSH_Calc", "C5"], ["NPSH_Calc", "C8"]] },
  { name: "Manual NPSHr", section: "Pump", parameter: "Manual NPSHr", value: 2, outputs: [["NPSH_Calc", "C10"], ["NPSH_Calc", "C11"]] },
  { name: "SNK flow", section: "SNK", parameter: "Sink flow demand", value: 45, outputs: [["Discharge_PFV_Calc", "C8"], ["Pump_Discharge_Calc", "C6"]] },
  { name: "SNK pressure", section: "SNK", parameter: "Sink absolute pressure", value: 4.5, outputs: [["Pump_Discharge_Calc", "C5"], ["Pump_Discharge_Calc", "C6"]] },
  { name: "SNK elevation", section: "SNK", parameter: "Sink elevation", value: 10, outputs: [["Pump_Discharge_Calc", "C5"], ["Pump_Discharge_Calc", "C6"]] },
  { name: "Suction pipe length", section: "Pipe Fitting Valve (suction)", parameter: "PIPE-1 1 length", value: 60, outputs: [["Suction_PFV_Calc", "C8"], ["NPSH_Calc", "C8"]] },
  { name: "Suction pipe diameter", section: "Pipe Fitting Valve (suction)", parameter: "PIPE-1 1 inside diameter", value: 0.05, outputs: [["Suction_PFV_Calc", "C8"], ["NPSH_Calc", "C8"]] },
  { name: "Suction fitting K", section: "Pipe Fitting Valve (suction)", parameter: "PIPE-1 1 K each", value: 2.4, outputs: [["Suction_PFV_Calc", "C8"], ["NPSH_Calc", "C8"]] },
  { name: "Discharge pipe length", section: "Pipe Fitting Valve (discharge)", parameter: "PIPE-2 1 length", value: 40, outputs: [["Discharge_PFV_Calc", "C8"], ["Pump_Discharge_Calc", "C6"]] },
  { name: "Discharge pipe diameter", section: "Pipe Fitting Valve (discharge)", parameter: "PIPE-2 1 inside diameter", value: 0.04, outputs: [["Discharge_PFV_Calc", "C8"], ["Pump_Discharge_Calc", "C6"]] },
  { name: "Discharge fitting K", section: "Pipe Fitting Valve (discharge)", parameter: "PIPE-2 1 K each", value: 4.2, outputs: [["Discharge_PFV_Calc", "C8"], ["Pump_Discharge_Calc", "C6"]] }
];

async function main() {
  const api = require(RUNTIME_FILE);
  assert.equal(api.version, "engineering-excel-calculation-trace.v6-water-only-ph-sheets", "sensitivity validator must run against the Water-only P-H sheet runtime.");
  const outputDir = path.join(FRONTEND_ROOT, "test-artifacts");
  fs.mkdirSync(outputDir, { recursive: true });
  const workbookPath = path.join(outputDir, "excel-calculation-trace-sensitivity.xlsx");
  const buffer = await api.buildXlsxBuffer(twoPipeProject());
  fs.writeFileSync(workbookPath, Buffer.from(buffer));

  const powershell = `
$ErrorActionPreference = 'Stop'
$path = ${JSON.stringify(workbookPath)}
$testsJson = @'
${JSON.stringify(sensitivityTests)}
'@
$tests = $testsJson | ConvertFrom-Json
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
function Get-CellValue($wb, $sheet, $addr) {
  return $wb.Worksheets.Item($sheet).Range($addr).Value2
}
function Set-InputValue($ws, $section, $param, $value) {
  $usedRows = $ws.UsedRange.Rows.Count
  for ($r = 1; $r -le $usedRows; $r++) {
    $s = [string]$ws.Cells.Item($r,1).Text
    $p = [string]$ws.Cells.Item($r,2).Text
    if ($s -eq $section -and $p -eq $param) {
      $ws.Cells.Item($r,3).Value2 = [double]$value
      return
    }
  }
  throw "Input not found: $section / $param"
}
try {
  $wb = $excel.Workbooks.Open($path)
  $inputs = $wb.Worksheets.Item('Inputs')
  $excel.CalculateFullRebuild()
  $results = @()
  foreach ($t in $tests) {
    $baseline = @()
    foreach ($o in $t.outputs) { $baseline += ,(Get-CellValue $wb $o[0] $o[1]) }
    Set-InputValue $inputs $t.section $t.parameter $t.value
    $excel.CalculateFullRebuild()
    $after = @()
    foreach ($o in $t.outputs) { $after += ,(Get-CellValue $wb $o[0] $o[1]) }
    $changedAll = $true
    for ($i = 0; $i -lt $baseline.Count; $i++) {
      $b = [double]$baseline[$i]
      $a = [double]$after[$i]
      if ([math]::Abs($a - $b) -le 1e-9) { $changedAll = $false }
    }
    $results += [pscustomobject]@{ test = $t.name; changedAll = $changedAll; before = ($baseline -join ', '); after = ($after -join ', ') }
    $wb.Close($false)
    $wb = $excel.Workbooks.Open($path)
    $inputs = $wb.Worksheets.Item('Inputs')
    $excel.CalculateFullRebuild()
  }
  $results | ConvertTo-Json -Depth 4
  $wb.Close($false)
} finally {
  $excel.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
`;

  const result = spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", powershell], {
    cwd: FRONTEND_ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Excel COM sensitivity run failed:\n${result.stdout}\n${result.stderr}`);
  const parsed = JSON.parse(result.stdout.trim());
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const failures = rows.filter((row) => !row.changedAll);
  assert.deepEqual(failures, [], `Some Excel inputs did not drive recalculated outputs:\n${JSON.stringify(failures, null, 2)}`);
  console.log(`Excel calculation trace sensitivity validation passed (${rows.length} input changes tested).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
