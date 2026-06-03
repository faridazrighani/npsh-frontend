# Review Analysis Report Simulation Case 1 - Current System

Generated at: 2026-06-03T16:40:31.921Z

Target folder:

`C:/Users/Zfaryana/Desktop/npshs/npsh-frontend/journals/simulasi_1`

## Executive Summary

Conclusion: **Ready with documented review notes**.

Backend engine mode: `backend-npsh-engine-adapter`. Calculation defense status: **Ready**.

Calculation ID: `c30c5892ab20d632`  
Dependency fingerprint: `ac1d9af6f169ece5dbca14c8841bbbc69f067980ffa39a001b3240548914c8d9`  
Route trace fingerprint: `3dc6484aa2b4dfa6cbb2f75a3c9aeb7aa8cc6097447a4e1f29c6e218a28281f7`

## Deployment / Go-Live Note

| Item | Status | Impact ke Review Case 1 | Catatan |
| --- | --- | --- | --- |
| Local production readiness | Ready | Validasi lokal Case 1 tetap dapat dipakai | Production readiness lokal Ready. |
| Go-live/final deployment | Blocked | Bukan blocker Case 1 | Go-live/final deployment tetap Blocked karena live deployment fingerprint belum sama dengan release lokal terbaru. |
| Deployment final lock | Blocked | Bukan blocker Case 1 | Blocked berasal dari live/go-live fingerprint, bukan dari report Case 1. |
| Final defense package | Blocked | Bukan blocker Case 1 | Menunggu redeploy/live validation sebelum klaim final production ready. |

Catatan defense: Tidak menjadi blocker untuk review Analysis Report Simulation Case 1; Case 1 review tetap Ready with documented review notes.

## Files Reviewed

| File |Purpose |
| --- |--- |
| npsh-frontend/journals/simulasi_1/simulasi_performansi_pompa_air_umpan_tangki_deaerator.untirta |Case 1 .untirta model payload |
| npsh-frontend/journals/analysis-reports/simulasi-1-analysis.json |Existing analysis report JSON |
| npsh-frontend/journals/simulasi_1/audit_validasi_simulasi_performansi_pompa_air_umpan_tangki_deaerator.md |Existing validation audit Markdown |
| npsh-frontend/journals/simulasi_1/review_analysis_simulasi_1_current_system.json |Generated current-system evidence JSON |
| npsh-frontend/journals/simulasi_1/review_analysis_simulasi_1_current_system.md |Generated current-system review Markdown |

## Review Matrix

| Area |Status |Evidence |
| --- |--- |--- |
| Defense Formula |Ready |15 formula/defense rows; defense=Ready. |
| Responsive realtime frontend |Ready |7/7 frontend runtime checks pass. |
| Backend realtime recalculation |Ready |sameInput stale=false; changed stale=true. |
| Dependency Change |Ready |baseline=ac1d9af6f169ece5dbca14c8841bbbc69f067980ffa39a001b3240548914c8d9; changed=512dc03bbd488fe9a712b26ab2537945ce3518dc52edef89d8df2e3e817a6a2d. |
| Dependency Chain |Ready |6 dependency chain items from routeTrace/calculationDefenseContract. |
| Route Calculation |Ready |suction direct=true; discharge direct=false. |
| Route Trace |Ready |schema=route-trace.v2; steps=6. |
| Traceability |Ready |calculationId=c30c5892ab20d632; dependency=ac1d9af6f169ece5dbca14c8841bbbc69f067980ffa39a001b3240548914c8d9. |
| Engineering Calculation |Ready |advancedEngineeringValidation=advanced-engineering-validation.v1; status=Review Required. |
| Auditable |Ready |calculationAudit=calculation-audit.v1; source=backend. |
| Stale Calculation |Ready |Display the new calculationId and dependencyFingerprint; mark prior UI/export values stale when previousDependencyFingerprint differs. |
| Pump Performance Chart |Review Required |schema=pump-performance-chart-data.v1; freshness=Current; traceableDuty=true; defaultCurve=false; estimated=true. |

## Audit Completeness Checker

| Check | Area | Status | Result / Evidence |
| --- | --- | --- | --- |
| input-file-checksum | Input File | Ready | checksum verified; npsh-frontend/journals/simulasi_1/simulasi_performansi_pompa_air_umpan_tangki_deaerator.untirta |
| analysis-report-cross-check | Analysis Report | Ready | 7/7 metrics pass; npsh-frontend/journals/analysis-reports/simulasi-1-analysis.json |
| formula-calculation-basis | Formula & Calculation Basis | Ready | 15 formula rows with result numbers; formulaCalculationBasis.formulaRows |
| route-trace | Route Trace | Ready | route-trace.v2; 3dc6484aa2b4dfa6cbb2f75a3c9aeb7aa8cc6097447a4e1f29c6e218a28281f7 |
| dependency-change | Dependency Change | Ready | changedPriorResultStale=true; PIPE-1 segment[0].length + 0.5 m |
| dependency-chain | Dependency Chain | Ready | 6 chain items; dependency.dependencyChain |
| calculation-audit | Auditable | Ready | calculation-audit.v1; calculationAudit=calculation-audit.v1; source=backend. |
| calculation-defense-contract | Defense Formula | Ready | Ready; calculation-defense-contract.v1 |
| frontend-realtime | Frontend Realtime | Ready | 7/7 checks pass; frontendRuntime.checks |
| backend-realtime | Backend Realtime | Ready | same=false; changed=true; staleValidation |
| pump-chart | Pump Performance Chart | Review Required | schema=pump-performance-chart-data.v1; freshness=Current; traceableDuty=true; defaultCurve=false; estimated=true.; Chart current and traceable, but engineering-fit/manual basis remains review note. |
| go-live-final-deployment | Deployment | External Blocked - Not Case 1 Blocker | Go-live/final deployment tetap Blocked karena live deployment fingerprint belum sama dengan release lokal terbaru.; Tidak menjadi blocker untuk review Analysis Report Simulation Case 1; Case 1 review tetap Ready with documented review notes. |

Overall: **Complete for Case 1 review; deployment remains external live-fingerprint blocker**.

## Main Calculation Check

| Metric |Backend current-system result |Analysis/Jurnal basis |Status |
| --- |--- |--- |--- |
| Flow |50 m3/h |50 m3/h |Ready |
| Pump/System Head |24 m |24 m |Ready |
| NPSHa |6.4656 m |6.4656 m |Ready |
| NPSHr |2.4002 m |2.4002 m |Ready |
| NPSH Margin |4.0654 m |NPSHa - NPSHr |Ready |
| NPSH Ratio |2.6938 |NPSHa / NPSHr |Ready |
| Hydraulic Status |Safe |Safe |Ready |
| Engineering Status |Safe |Safe dengan catatan NPSHr manual |Safe |

## Analysis Report Cross-Check

| Metric |Backend value |Report target / note |Status |
| --- |--- |--- |--- |
| Flow |50 |50 m3/h |Ready |
| Required system head |24 |24 m |Ready |
| NPSHa |6.4656 |6.4656 m |Ready |
| NPSHr |2.4002 |2.4002 m |Ready |
| Suction loss |2.62 |2.6155 m app recalculation |Ready |
| Discharge loss |11.67 |11.6685 m app recalculation |Ready |
| Hydraulic status |Safe |Safe: NPSHa 6.4656 m > NPSHr 2.4002 m |Ready |

## Formula & Calculation Basis

Kolom `Result` di bawah adalah angka hasil backend current-system untuk Case 1, bukan angka dummy/default.

| Item | Result | Unit | Basis |
| --- | --- | --- | --- |
| Flow | 50 | m3/h | SNK-100 flow demand / journal duty flow |
| Pump/System Head | 24 | m | Journal operating head / backend system head closure |
| NPSHa | 6.4656 | m | Backend NPSHa from suction energy balance |
| NPSHr | 2.4002 | m | Manual/journal NPSHr input |
| NPSH Margin | 4.0654 | m | NPSHa - NPSHr |
| NPSH Ratio | 2.6938 | - | NPSHa / NPSHr |
| Required NPSHa | 3.0002 | m | max(NPSHr x ratio, NPSHr + absolute margin) |
| NPSH Excess | 3.4654 | m | NPSHa - Required NPSHa |

| No | Calculation Item | Formula | Substitution | Result | Basis / Literature |
| --- | --- | --- | --- | --- | --- |
| 1 | System Static Head | H_static = H_discharge boundary - H_suction boundary | 29.085 - 19.369 = 9.716 m | 9.716 m | Fluid Mechanics: Bernoulli/mechanical energy balance and pump/system curve matching. |
| 2 | System Curve Head | H_system(Q) = H_static + hL_suction(Q) + hL_discharge(Q) | 9.716 + 2.616 + 11.669 = 24.000 m | 24 m | Fluid Mechanics: Bernoulli/mechanical energy balance and pump/system curve matching. |
| 3 | Head Residual | Head residual = H_pump(Q) - H_system(Q) | 24.000 - 24.000 = 0.000 m | 0 m | Fluid Mechanics: Bernoulli/mechanical energy balance and pump/system curve matching. |
| 4 | Source Absolute Pressure | Pabs = Pabs input | 1.821 = 1.821 bar a | 1.821 bar a | Local thesis literature set: fluid mechanics, cavitation, and ANSI/HI NPSH margin references. |
| 5 | Pressure Head | Hp = Pabs x 100000 / (rho x g) | 1.821 x 100000 / (958.348 x 9.810) = 19.369 m | 19.369 m | Fluid Mechanics: Bernoulli/mechanical energy balance and pump/system curve matching. |
| 6 | Elevation Head | Hz = z_source - z_pump | 0.000 - -0.500 = 0.500 m | 0.5 m | Fluid Mechanics: Bernoulli/mechanical energy balance and pump/system curve matching. |
| 7 | Source Velocity Head | Hvel = 0 | 0.000 m | 0 m | Fluid Mechanics: Bernoulli/mechanical energy balance and pump/system curve matching. |
| 8 | Suction Loss | HL = pipe major + fitting/valve minor | 0.080 + 2.535 = 2.616 m | 2.616 m | Fluid Mechanics: Darcy-Weisbach major loss plus minor-loss coefficient K; ANSI/HI Appendix A suction head loss hf. |
| 9 | Vapor Pressure Head | Hv = Pv x 100000 / (rho x g) | 1.014180 x 100000 / (958.348 x 9.810) = 10.788 m | 10.788 m | Fluid Mechanics: Bernoulli/mechanical energy balance and pump/system curve matching. |
| 10 | NPSHa | NPSHa = Hp + z_source + Hvel - z_pump - HL - Hv | 19.369 + 0.000 + 0.000 - -0.500 - 2.616 - 10.788 = 6.466 m | 6.466 m | ANSI/HI 9.6.1-2024 Appendix A: NPSHA determination at the pump NPSH datum plane. |
| 11 | NPSHr | NPSHr = pump required NPSH at operating flow | 50.000 m3/h -> 2.400 m | 2.4 m | ANSI/HI 9.6.1-2024: NPSHR is pump/manufacturer supplied for specified flow, speed, and pumped liquid. |
| 12 | Operating Region | Flow %BEP = Q / Q_BEP x 100 | 50.000 / 50.000 x 100 = 100.000 % BEP | 100 % BEP | ANSI/HI operating-region guidance: POR/AOR are interpreted relative to BEP flow. |
| 13 | Required NPSHa | Required NPSHa = max(NPSHr x margin ratio, NPSHr + absolute margin) | max(2.400 x 1.050, 2.400 + 0.600) = 3.000 m | 3 m | ANSI/HI 9.6.1-2024: NPSH margin and NPSH margin ratio. |
| 14 | Margin and Ratio | Margin = NPSHa - NPSHr; Ratio = NPSHa / NPSHr; Excess = NPSHa - Required NPSHa | 6.466 - 2.400 = 4.065 m; 6.466 / 2.400 = 2.694; 6.466 - 3.000 = 3.465 m | 3.465 m | ANSI/HI 9.6.1-2024: NPSH margin and NPSH margin ratio. |
| 15 | Data Confidence Gate | Engineering status = hydraulic status + NPSHr data confidence | Hydraulic: Safe; Data: Manual - verify vendor data; Engineering: Safe | Safe | ANSI/HI 9.6.1-2024 distinguishes system NPSHA from pump/manufacturer NPSHR; manufacturer/test data is preferred for final validation. |

## Dependency Chain

| No |Dependency |
| --- |--- |
| 1 |Fluid Basis -> density, viscosity, vapor pressure |
| 2 |SRC -> suction pressure/elevation boundary head |
| 3 |Pipe/Fitting/Valve (suction) -> suction loss subtracts from NPSHa |
| 4 |Pump -> NPSHa versus NPSHr and margin status |
| 5 |Pipe/Fitting/Valve (discharge) -> system head and outlet pressure |
| 6 |SNK -> downstream boundary closes the route calculation |

## Dependency Change Rules

| Scope |Invalidates |
| --- |--- |
| Fluid Basis |all route hydraulics, NPSHa, status, exports |
| SRC |suction boundary, suction pressure head, NPSHa |
| Pipe/Fitting/Valve suction |suction loss, NPSHa, pump NPSH margin |
| Pump |operating point, NPSHr, NPSH acceptance, action readiness |
| Pipe/Fitting/Valve discharge |system head, outlet pressure, operating point |
| SNK |discharge boundary, system head, operating point |

## Route Calculation and Route Trace

Route text: Fluid Basis -> SRC-100 -> PIPE-1 -> P-100 -> PIPE-2 -> SNK-100

| No |Object |Type |Stage |Label |Data status |
| --- |--- |--- |--- |--- |--- |
| 1 |FLUID |fluid |Fluid Basis |Fluid Basis |available |
| 2 |SRC-100 |source |SRC |SRC-100 |available |
| 3 |PIPE-1 |pipe |Pipe/Fitting/Valve (suction) |PIPE-1 |available |
| 4 |P-100 |pump |Pump |P-100 |available |
| 5 |PIPE-2 |pipe |Pipe/Fitting/Valve (discharge) |PIPE-2 |available |
| 6 |SNK-100 |sink |SNK |SNK-100 |available |

Route section defense:

| Section |Total loss (m) |Direct NPSHa impact |Defense |
| --- |--- |--- |--- |
| Suction |2.6155 |true |Suction loss reduces NPSHa. |
| Discharge |11.6685 |false |Discharge loss affects system head/outlet pressure, not direct NPSHa. |

## Stale Calculation and Realtime Behavior

| Scenario |Previous fingerprint |Current fingerprint |priorResultStale |Result |
| --- |--- |--- |--- |--- |
| Same input after backend result |ac1d9af6f169ece5dbca14c8841bbbc69f067980ffa39a001b3240548914c8d9 |ac1d9af6f169ece5dbca14c8841bbbc69f067980ffa39a001b3240548914c8d9 |false |Ready |
| PIPE-1 suction length +0.5 m |ac1d9af6f169ece5dbca14c8841bbbc69f067980ffa39a001b3240548914c8d9 |512dc03bbd488fe9a712b26ab2537945ce3518dc52edef89d8df2e3e817a6a2d |true |Ready |

Policy: Display the new calculationId and dependencyFingerprint; mark prior UI/export values stale when previousDependencyFingerprint differs.

## Frontend and Backend Realtime Checks

| Check |Area |Status |Evidence |
| --- |--- |--- |--- |
| route-audit-loaded |Frontend |Ready |index.html loads engineering-route-trace-audit.js. |
| realtime-defense-loaded |Frontend |Ready |index.html loads engineering-realtime-calculation-defense.js. |
| dependency-fingerprint-handoff |Frontend |Ready |Route audit bridge captures previous/current dependency fingerprints. |
| calculation-defense-handoff |Frontend |Ready |Route audit bridge stores calculationDefenseContract. |
| stale-marking-bridge |Frontend |Ready |Realtime bridge marks chart/results stale before backend refresh. |
| canonical-chart-contract |Frontend |Ready |Canonical chart renderer prefers solver-owned performanceChartData v1. |
| chart-audit-contract |Frontend |Ready |Chart audit runtime checks canonical chart source audit. |

Backend checks:

| Check |Status |Evidence |
| --- |--- |--- |
| Backend simulation contract |Ready |engine=backend-npsh-engine-adapter |
| Route trace schema |Ready |route-trace.v2 |
| Dependency manifest schema |Ready |dependency-manifest.v1 |
| Calculation audit schema |Ready |calculation-audit.v1 |
| Calculation defense contract |Ready |calculation-defense-contract.v1 / Ready |
| Advanced engineering validation |Ready |advanced-engineering-validation.v1 / Review Required |

## Pump Performance Chart Defense

| Item |Value |
| --- |--- |
| Schema |pump-performance-chart-data.v1 |
| Freshness |Current |
| Duty flow |50 m3/h |
| Duty head |24 m |
| Traceable duty inputs |true |
| Sourced curve data |true |
| Default curve data |false |
| Estimated / engineering fit |true |
| Screening defaults applied |false |

Interpretasi: chart Case 1 dapat diplot karena duty input jurnal lengkap dan traceable. Chart bukan berasal dari PUMP_SCREENING_DEFAULTS atau default curve data, tetapi tetap memakai engineering-fit untuk bagian kurva yang tidak tersedia dari manufacturer/test curve.

## Concerns and Improvements

- Pump curve/NPSHr basis masih engineering-fit/manual sesuai data jurnal. Ini boleh untuk validasi akademik Case 1, tetapi jangan diklaim sebagai manufacturer/test curve lengkap.
- File .untirta Case 1 belum menyimpan kontrak current-system secara persisted; backend runtime menghasilkan kontrak lengkap saat recalculation. Jika ingin file portable tanpa solve ulang, lakukan upgrade .untirta seperti Case 6.
- Analysis report lama mencatat data confidence: Warning: Manual - verify vendor data. Pertahankan catatan ini untuk defense karena NPSHr manual/vendor perlu verifikasi.

Recommended improvements:

- Jika dosen meminta file portable, upgrade `.untirta` Case 1 agar menyimpan routeTrace/dependency/calculationDefenseContract seperti format current-system runtime.
- Tambahkan vendor/manufacturer curve bila tersedia agar engineering-fit warning bisa diturunkan.
- Lakukan smoke test UI setelah membuka Case 1: ubah satu angka pipe/pump, pastikan chart dan route trace menjadi stale lalu kembali Current setelah solve backend.

## Validation Commands

```powershell
node npsh-api/tools/release-integrity-audit.cjs
npm.cmd run validate:realtime-defense --prefix npsh-frontend
npm.cmd run validate:pump-chart-audit --prefix npsh-frontend
```

## Final Decision

Case 1 status: **Ready with documented review notes**. Hydraulic result is Safe; calculation defense is Ready; remaining concern is data-confidence wording for manual/engineering-fit pump curve basis. Go-live/final deployment tetap Blocked karena live deployment fingerprint, bukan karena review Case 1.
