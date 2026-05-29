# Audit Validasi Detail - Reflux Centrifugal Pump Evaluation

Tanggal audit: 2026-05-22T12:42:44.026Z  
File model: `simulasi_kinerja_pompa_sentrifugal_reflux_kilang.untirta`  
Referensi jurnal: `journal_evaluasi_kinerja_pompa_sentrifugal_reflux_kilang.pdf`

## Ringkasan Status

Status audit: **Conditionally validated with documented journal caveats and equivalent closures**.

Safe: NPSHa 11.8785 m > NPSHr 3.5 m. Data Confidence: Warning: Journal actual duty point + journal design point; no full manufacturer/test curve supplied..

## Komparasi Jurnal vs Aplikasi

| Parameter | Jurnal | Aplikasi / .untirta | Unit | Error | Status |
| --- | ---: | ---: | --- | ---: | --- |
| Fluid Basis - Temperature | Not stated | 40 | deg C | - | Derived/App basis |
| Fluid Basis - Density rho | 773 | 773 | kg/m3 | 0% | OK |
| Fluid Basis - Specific gravity | 0.773 | 0.773017006374 | - | 0.0022% | OK |
| Fluid Basis - Specific weight | 7583.13 | 7583.13 | N/m3 | 0% | OK |
| Fluid Basis - Kinematic viscosity | 6.58e-7 | 6.58e-7 | m2/s | 0% | OK |
| Fluid Basis - Dynamic viscosity | 0.508634 | 0.508634 | cP | 0% | OK |
| Fluid Basis - Vapor pressure | 0.015 | 0.015 | bar a | 0% | OK/Review |
| Fluid Basis - Vapor pressure head | 0.197807501652 | 0.197807501652 | m | 0% | OK/Review |
| SRC - Boundary pressure | 1.01325 | 1.01358523553 | bar a | 0.0331% | OK/Equivalent |
| SRC - Static/elevation basis to pump | 1.29 | 1.29 | m | 0% | OK |
| SRC - Volumetric flow | 0.166666666667 | 0.166666666667 | m3/h | 0% | OK |
| SRC - Mass flow | 128.833333333 | 128.833333333 | kg/h | 0% | OK - derived |
| SRC - Volumetric flow calculated | 0.166666666667 | 0.166666666667 | m3/h | 1.6653e-14% | OK |
| Pipe Suction - Major loss | Not separated | 0.00000831224136544 | m | - | Derived/App calculation |
| Pipe Suction - Minor loss | Not separated | 0.00000172953601829 | m | - | Derived/App calculation |
| Pipe Suction - Total head loss | 0.0000100738 | 0.0000100417773837 | m | 0.3179% | OK/Review |
| Pipe Suction - Total K | Derived | 5.5 | - | - | Derived from model K values |
| Pipe Suction - Primary Re | Not stated | 581.525510499 | - | - | Derived/App calculation |
| Pipe Suction - Darcy f | Not stated | 0.110055361019 | - | - | Derived/App calculation |
| Pipe Suction - eps/D | Derived | 0.000292112950341 | - | - | Derived/App calculation |
| Pipe Discharge - Major loss | Not separated | 0.0000543798413733 | m | - | Derived/App calculation |
| Pipe Discharge - Minor loss | Not separated | 0.0000203089801378 | m | - | Derived/App calculation |
| Pipe Discharge - Total head loss | 0.0000748133 | 0.000074688821511 | m | 0.1664% | OK/Review |
| Pipe Discharge - Total K | Derived | 12.54 | - | - | Derived from model K values |
| Pipe Discharge - Primary Re | Not stated | 876.041510781 | - | - | Derived/App calculation |
| Pipe Discharge - Darcy f | Not stated | 0.07305589885 | - | - | Derived/App calculation |
| Pipe Discharge - eps/D | Derived | 0.00044005476237 | - | - | Derived/App calculation |
| Pump - Elevation | Datum/equivalent | 1.29 | m | - | Model datum |
| Pump - Suction nozzle elevation | Datum/equivalent | 1.29 | m | - | Model datum |
| Pump - Discharge nozzle elevation | Datum/equivalent | 1.29 | m | - | Model datum |
| Pump - Flow evaluated | 0.166666666667 | 0.166667 | m3/h | 2.0000e-4% | OK |
| Pump - Pump head | 62.2888 | 62.2888 | m | 0% | OK/Review |
| Pump - Efficiency | 28.26 | 28.26 | % | 0% | OK/Review |
| Pump - NPSHa | 11.8785 | 11.8785 | m | 0% | OK/Review |
| Pump - NPSHr | 3.5 | 3.5 | m | 0% | OK/Review |
| Pump - NPSH margin | 8.3785 | 8.3785 | m | 0% | Derived |
| Pump - NPSH ratio | 3.39385714286 | 3.3939 | - | 0.0013% | Derived |
| Pump - Required NPSHa | App criterion | 4.5 | m | - | App margin basis |
| Pump - NPSH excess | App criterion | 7.3785 | m | - | App margin basis |
| Pump - Suction pressure | Derived/equivalent | 0.915762 | bar a | - | Calculated/equivalent |
| Pump - Suction loss | 0.0000100738 | 0.000010042 | m | 0.3157% | OK/Review |
| Pump - Required system head | 62.2888 | 62.29 | m | 0.0019% | OK/Review |
| Optimize Pump From Network - Readiness | Ready/Review | Ready | - | - | OK |
| Optimize Pump From Network - Target flow | 0.166666666667 | 0.167 | m3/h | 0.2% | Proposal result |
| Optimize Pump From Network - Required system head | 62.2888 | 62.289 | m | 3.2109e-4% | Proposal result |
| Optimize Pump From Network - NPSHa at design | 11.8785 | 11.878 | m | 0.0042% | Proposal result |
| Optimize Pump From Network - Max allowable NPSHr | Derived | 10.799 | m | - | Proposal result |
| Optimize Pump From Network - Proposed NPSHr | Derived | 10.259 | m | - | Proposal only; journal input retained |
| SNK - Flow demand | 0.166666666667 | 0.166666666667 | m3/h | 0% | OK |
| SNK - Reference pressure | Not stated/equivalent | 4.31897405693 | bar a | - | Equivalent closure |
| SNK - Elevation | 18.7 | 18.7 | m | 0% | OK/Review |
| Outlet Readout - Boundary abs pressure | Not stated/equivalent | 4.31897405693 | bar a | - | Equivalent closure |
| Outlet Readout - Pressure head | Derived | 56.9550311933 | m | - | App calculation |
| Outlet Readout - Discharge loss | 0.0000748133 | 0.000074688821511 | m | 0.1664% | OK/Review |
| Outlet Readout - Terminal velocity head | Derived | 0.00000161953589615 | m | - | App calculation |
| Outlet Readout - SNK hydraulic head | Derived/equivalent | 75.6550328128 | m | - | App calculation |
| Outlet Readout - Flow rate | 0.166666666667 | 0.166666666667 | m3/h | 0% | OK |
| Outlet Readout - Mass flow | 128.833333333 | 128.833333 | kg/h | 2.5873e-7% | OK/Review |
| Outlet Readout - Pipe endpoint static P | Not stated | 4.319 | bar a | - | App result |
| Outlet Readout - Pipe endpoint stagnation P | Not stated | 4.319 | bar a | - | App result |
| Outlet Readout - Required boundary P | Not stated/equivalent | 4.318974 | bar a | - | App closure |
| Outlet Readout - Vapor pressure | 0.015 | 0.015 | bar a | 0% | OK/Review |
| Outlet Readout - Vapor margin | Derived | 56.7572236916 | m | - | Positive margin |

## Application Input & Result Data

- Fluid Basis - Fluid Name: Custom (.untirta model.FLUID.props)
- Fluid Basis - Temperature: 40 deg C (.untirta model.FLUID.props)
- Fluid Basis - Density rho: 773 kg/m3 (Application fluid basis)
- Fluid Basis - Specific gravity: 0.773017 (Application fluid basis)
- Fluid Basis - Specific weight: 7583.13 N/m3 (Application fluid basis)
- Fluid Basis - Kinematic viscosity: 6.5800e-7 m2/s (0.658 cSt) (Application fluid basis)
- Fluid Basis - Dynamic viscosity: 0.508634 cP (Application fluid basis)
- Fluid Basis - Vapor pressure: 0.015 bar a (Application fluid basis)
- Fluid Basis - Vapor pressure head: 0.197808 m (Application fluid basis)
- SRC - Source Type: Standalone Boundary Source (.untirta SRC)
- SRC - Boundary Pressure: 1.013585236 bar a (Direct/equivalent input)
- SRC - Source Elevation: 0 m (.untirta SRC)
- SRC - Volumetric Flow / Mass Flow: 0.166667 m3/h / 128.833 kg/h (.untirta SRC)
- SRC - Volumetric Flow Calculated: 0.166667 m3/h (massFlow / density)
- Pipe Suction - Major Loss: 8.3122e-6 m (App recalculation)
- Pipe Suction - Minor Loss: 1.7295e-6 m (App recalculation)
- Pipe Suction - Total Head Loss: 1.0042e-5 m (App recalculation)
- Pipe Suction - Total K: 5.5 (Model K values)
- Pipe Suction - Primary Re: 581.5255 (App recalculation)
- Pipe Suction - Darcy f: 0.11005536 (App friction basis)
- Pipe Suction - eps/D: 2.9211e-4 (roughness / diameter)
- Pipe Discharge - Major Loss: 5.4380e-5 m (App recalculation)
- Pipe Discharge - Minor Loss: 2.0309e-5 m (App recalculation)
- Pipe Discharge - Total Head Loss: 7.4689e-5 m (App recalculation)
- Pipe Discharge - Total K: 12.54 (Model K values)
- Pipe Discharge - Primary Re: 876.0415 (App recalculation)
- Pipe Discharge - Darcy f: 0.0730559 (App friction basis)
- Pipe Discharge - eps/D: 4.4005e-4 (roughness / diameter)
- Pump - Elevation: 1.29 m (.untirta pump)
- Pump - Suction Nozzle Elev.: 1.29 m (.untirta pump)
- Pump - Discharge Nozzle Elev.: 1.29 m (.untirta pump)
- Pump - Hydraulic NPSH Status: Safe (NPSHa 11.8785 m > NPSHr 3.5 m)
- Pump - Engineering Status: Warning (Application NPSH/data-confidence split)
- Pump - Data Confidence: Warning: Journal actual duty point + journal design point; no full manufacturer/test curve supplied. (Curve/source data confidence)
- Pump - Flow Evaluated: 0.166667 m3/h (SNK-100 flow demand)
- Pump - Pump Head: 62.2888 m (Network required head)
- Pump - NPSHa / NPSHr: 11.8785 / 3.5 m (Application NPSH evaluation)
- Pump - NPSHr Source: Engineering-fit curve (Pump input/curve source)
- Pump - NPSH Margin / Ratio: 8.3785 m / 3.3939 (NPSHa - NPSHr; NPSHa/NPSHr)
- Pump - Required NPSHa / NPSH Excess: 4.5 m / 7.3785 m (App margin basis)
- Pump - Suction Pressure: 0.915762 bar a (Calculated at pump suction)
- Pump - Suction Loss: 1.0042e-5 m (Application suction loss)
- Pump - Dominant Loss: PIPE-1 journal-calibrated suction loss (Application diagnostic)
- Optimize Pump From Network - Workflow Status: Proposal Ready; readiness Ready (Network optimization proposal)
- Optimize Pump From Network - Target Flow: 0.167 m3/h (SNK-100 Flow Demand)
- Optimize Pump From Network - Required System Head: 62.289 m (Boundary head difference plus losses)
- Optimize Pump From Network - NPSHa at Design: 11.878 m (Network proposal)
- Optimize Pump From Network - Max Allowable NPSHr: 10.799 m (Network proposal)
- Optimize Pump From Network - Proposed NPSHr: 10.259 m (Proposal only; model input retained)
- Optimize Pump From Network - Worst AOR Point: 0.083 m3/h, 50% BEP, NPSHa 11.879 m (AOR envelope scan)
- SNK - Flow Demand: 0.166667 m3/h (.untirta SNK)
- SNK - Pressure Basis: Static (.untirta SNK)
- SNK - Reference Pressure: 4.318974057 bar a (Direct/equivalent input)
- SNK - SNK Elevation: 18.7 m (.untirta SNK)
- Outlet Readout - Boundary Mode: Flow Demand Boundary (Calculated Outlet Readout)
- Outlet Readout - Boundary Pressure Input: 4.318974 bar a (Calculated Outlet Readout)
- Outlet Readout - Boundary Abs. Pressure: 4.318974057 bar a (Calculated Outlet Readout)
- Outlet Readout - Pressure Head: 56.955031 m (P/(rho g))
- Outlet Readout - Discharge Loss: 7.4689e-5 m (App discharge pipe total)
- Outlet Readout - Terminal Velocity Head: 1.6195e-6 m (V2/(2g))
- Outlet Readout - SNK Hydraulic Head: 75.655033 m (Pressure head + elevation + velocity head)
- Outlet Readout - Flow Rate: 0.166667 m3/h (Calculated Outlet Readout)
- Outlet Readout - Mass Flow: 128.833 kg/h (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Static P: 4.319 bar a (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Stagnation P: 4.319 bar a (Calculated Outlet Readout)
- Outlet Readout - Required Boundary P: 4.318974 bar a (Calculated Outlet Readout)
- Outlet Readout - Vapor Pressure: 0.015 bar a (Fluid Basis)
- Outlet Readout - Vapor Margin: 4.303974 bar (56.757224 m) (Boundary pressure - vapor pressure)

## Optimize Pump From Network

- Objective: Use Optimize Pump From Network to verify the network-derived operating point and record the proposal without overwriting journal/literature inputs.
- Baseline: Flow = 0.166667 m3/h; head = 62.2888 m; NPSHa = 11.8785 m; NPSHr = 3.5 m; status = Safe.
- Result: Proposal Ready: target flow 0.167 m3/h, required head 62.289 m, NPSHa at design 11.878 m, max allowable NPSHr 10.799 m, proposed NPSHr 10.259 m. Proposal stored; original journal input retained.

## Caveat dan Catatan Pertahanan

- Hydraulic NPSH Status = Safe. Basis: NPSHa 11.8785 m > NPSHr 3.5 m.
- Engineering Status = Warning. Data Confidence = Warning: Journal actual duty point + journal design point; no full manufacturer/test curve supplied..
- Optimize Pump From Network result = Proposal Ready; proposed NPSHr 10.259 m is recorded as proposal only and not applied over the literature input.
- Abstract states head system 62.888 m and increase 2.888 m, while the detailed calculation and evaluation table give 62.2888 m and +2.2888 m.
- Table 4 states actual capacity 4 m3/day; the evaluation table expresses it as 0.1667 m3/h. The model uses 0.1666667 m3/h.
- Table 5 lists suction length 36 m, but the published suction-loss calculation uses 37 m; model keeps 36 m plus a documented 1 m adjustment.
- Table 5 lists an additional 2 inch discharge spool of 1 m, but the published head-loss calculation uses the 4 inch diameter/velocity basis; model documents the spool with inactive length to match the calculation.
- Motor table lists cos phi 0.82 and efficiency 85%, while the power calculation substitutes 0.8 and 0.93. The model stores the published result and notes the inconsistency.
- The efficiency section reports 28.26%; direct use of the stated liquid power 0.02929 hp and driver power 10.3641 hp gives about 0.2826%. The reported 28.26% is consistent with the shaft-power back-calculation Pp = 0.02185/0.2826 = 0.07728 kW, so the model keeps the published pump-efficiency basis and records driver power separately.
- The detailed head-total equation prints a suction-loss term after also calculating total head loss. Including the discharge-loss term changes the result by only about 0.000075 m, below the published 4-decimal head precision; the model includes both suction and discharge losses in the application balance.
- SRC-100 pressure is a small equivalent closure pressure so the application SI pressure-head basis reproduces NPSHa = 11.8785 m.
- SNK-100 pressure is an equivalent closure pressure so the application required-system-head calculation reproduces H = 62.2888 m at Q = 4 m3/day.
- Pump curve points beyond the actual and design points are interpolation brackets, not manufacturer-certified data.
- Tank T-109 is represented as an SRC boundary because the journal provides pressure/elevation/flow data but not tank geometry, inventory, or liquid-level history. SRC elevation 0 m with pump suction elevation 1.29 m reproduces the journal NPSHa static-lift term.
- SNK pressure is a downstream application closure pressure, not a replacement for the journal 4.5 kg/cm2 discharge-pressure datum; the published discharge pressure remains stored on P-100 and is used as the literature reference.
- Actual flow is far below design/BEP flow; journal still concludes operation is acceptable for the observed low demand.
- Full manufacturer/test pump curve is not included in the journal; curve is an engineering fit for application interpolation.
- Journal efficiency arithmetic has a definition/factor caveat; see validation audit before presenting motor-to-fluid efficiency.

## Formula Utama

- Fluid specific weight: `gamma = rho x g`
- Kinematic viscosity: `nu = mu / rho when the journal gives dynamic viscosity only`
- Vapor pressure head: `Hv = Pv x 100000 / (rho x g)`
- Reynolds number: `Re = V D / nu`
- Relative roughness: `eps/D = pipe roughness / internal diameter`
- Darcy-Weisbach major loss: `h_major = f (L / D) (V^2 / 2g)`
- Minor loss: `h_minor = K (V^2 / 2g)`
- System head closure: `H_required = H_discharge boundary - H_suction boundary + hL_suction + hL_discharge`
- NPSHa: `NPSHa = suction boundary head - suction loss - pump elevation - vapor pressure head`
- NPSH acceptance: `Hydraulic status is Safe when NPSHa > NPSHr; Cavitation Risk when NPSHa < NPSHr`
- NPSH margin and ratio: `Margin = NPSHa - NPSHr; Ratio = NPSHa / NPSHr`
- Error percent: `errorPercent = ABS(application - journal) / ABS(journal) x 100%`
- Optimize Pump From Network: `Proposal reads the current Fluid Basis -> SRC/Tank -> Pipe -> Pump -> Pipe -> SNK network and calculates target flow, required head, NPSHa, allowable NPSHr, and AOR envelope.`
- Dynamic report source: `Analysis Report = detailed static report JSON + decoded .untirta validationAudit/model/results at open time.`
- Journal pump efficiency caveat: `Use journal-published pump efficiency 28.26% for Pp=0.07728 kW; direct Pw divided by stated driver power gives about 0.2826%, so driver-power efficiency is a literature caveat.`

## Kesimpulan

This case is conditionally validated for academic/engineering discussion. The report distinguishes direct journal numbers, engineering-derived values, and equivalent application closures.
