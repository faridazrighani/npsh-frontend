# Audit Validasi Detail - P-2941A Hot Water Pump Evaluation

Tanggal audit: 2026-05-22T12:42:44.157Z  
File model: `Evaluasi_Pompa_Sentrifugal_P-2941A_sebagai_Pompa_Air_Panas.untirta`  
Referensi jurnal: `Evaluasi_Pompa_Sentrifugal_P-2941A_sebagai_Pompa_Air_Panas.pdf`

## Ringkasan Status

Status audit: **Conditionally validated with documented journal caveats and equivalent closures**.

Safe: NPSHa 15.358 m > NPSHr 1 m. Data Confidence: Warning: Journal gives one calculated operating point plus design/curve comparison data; full digitized manufacturer curve is not supplied..

## Komparasi Jurnal vs Aplikasi

| Parameter | Jurnal | Aplikasi / .untirta | Unit | Error | Status |
| --- | ---: | ---: | --- | ---: | --- |
| Fluid Basis - Temperature | 90 | 90 | deg C | 0% | OK |
| Fluid Basis - Density rho | 965 | 965 | kg/m3 | 0% | OK |
| Fluid Basis - Specific gravity | 0.965 | 0.965 | - | 0% | OK |
| Fluid Basis - Specific weight | 9466.65 | 9466.65 | N/m3 | 0% | OK |
| Fluid Basis - Kinematic viscosity | 3.31606217617e-7 | 3.31606217617e-7 | m2/s | 0% | OK |
| Fluid Basis - Dynamic viscosity | 0.32 | 0.32 | cP | 0% | OK |
| Fluid Basis - Vapor pressure | 0.7010774085 | 0.7013169 | bar a | 0.0342% | OK/Review |
| Fluid Basis - Vapor pressure head | 7.4057603112 | 7.40829015544 | m | 0.0342% | OK/Review |
| SRC - Boundary pressure | 2.02331783465 | 2.02400901 | bar a | 0.0342% | OK/Equivalent |
| SRC - Static/elevation basis to pump | 1.4 | 1.4 | m | 0% | OK |
| SRC - Volumetric flow | 39.68 | 39.68 | m3/h | 0% | OK |
| SRC - Mass flow | 38291.2 | 38291.2 | kg/h | 0% | OK - derived |
| SRC - Volumetric flow calculated | 39.68 | 39.68 | m3/h | 0% | OK |
| Pipe Suction - Major loss | 0.0098 | 0.00985044000209 | m | 0.5147% | OK/Review |
| Pipe Suction - Minor loss | 0.00415 | 0.00415 | m | 0% | OK/Review |
| Pipe Suction - Total head loss | 0.01395 | 0.0140004400021 | m | 0.3616% | OK/Review |
| Pipe Suction - Total K | Derived | 0.697916605872 | - | - | Derived from model K values |
| Pipe Suction - Primary Re | 208503.24 | 208786.718088 | - | 0.136% | OK/Review |
| Pipe Suction - Darcy f | 0.0172 | 0.0171670615195 | - | 0.1915% | OK/Review |
| Pipe Suction - eps/D | 0.000225 | 0.0002255550074 | - | 0.2467% | OK |
| Pipe Discharge - Major loss | Not separated | 0.282501143647 | m | - | Derived/App calculation |
| Pipe Discharge - Minor loss | Not separated | 0 | m | - | Derived/App calculation |
| Pipe Discharge - Total head loss | 0.2817 | 0.282501143647 | m | 0.2844% | OK/Review |
| Pipe Discharge - Total K | Derived | 0 | - | - | Derived from model K values |
| Pipe Discharge - Primary Re | 274224.08 | 274633.794655 | - | 0.1494% | OK/Review |
| Pipe Discharge - Darcy f | 0.0171 | 0.0170992503375 | - | 0.0044% | OK/Review |
| Pipe Discharge - eps/D | 0.0003 | 0.00029669046074 | - | 1.1032% | OK |
| Pump - Elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Suction nozzle elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Discharge nozzle elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Flow evaluated | 39.68 | 39.68 | m3/h | 0% | OK |
| Pump - Pump head | 37.674 | 37.674 | m | 0% | OK/Review |
| Pump - Efficiency | 30 | 30 | % | 0% | OK/Review |
| Pump - NPSHa | 15.358 | 15.358 | m | 0% | OK/Review |
| Pump - NPSHr | 1 | 1 | m | 0% | OK/Review |
| Pump - NPSH margin | 14.358 | 14.358 | m | 0% | Derived |
| Pump - NPSH ratio | 15.358 | 15.358 | - | 0% | Derived |
| Pump - Required NPSHa | App criterion | 1 | m | - | App margin basis |
| Pump - NPSH excess | App criterion | 14.358 | m | - | App margin basis |
| Pump - Suction pressure | Derived/equivalent | 2.155 | bar a | - | Calculated/equivalent |
| Pump - Suction loss | 0.01395 | 0.014 | m | 0.3584% | OK/Review |
| Pump - Required system head | 37.674 | 37.67 | m | 0.0106% | OK/Review |
| Optimize Pump From Network - Readiness | Ready/Review | Ready | - | - | OK |
| Optimize Pump From Network - Target flow | 39.68 | 39.68 | m3/h | 0% | Proposal result |
| Optimize Pump From Network - Required system head | 37.674 | 37.674 | m | 0% | Proposal result |
| Optimize Pump From Network - NPSHa at design | 15.358 | 15.358 | m | 0% | Proposal result |
| Optimize Pump From Network - Max allowable NPSHr | Derived | 15.349 | m | - | Proposal result |
| Optimize Pump From Network - Proposed NPSHr | Derived | 14.582 | m | - | Proposal only; journal input retained |
| SNK - Flow demand | 39.68 | 39.68 | m3/h | 0% | OK |
| SNK - Reference pressure | Not stated/equivalent | 4.9359218876 | bar a | - | Equivalent closure |
| SNK - Elevation | 8 | 8 | m | 0% | OK/Review |
| Outlet Readout - Boundary abs pressure | Not stated/equivalent | 4.9359218876 | bar a | - | Equivalent closure |
| Outlet Readout - Pressure head | Derived | 52.1401117354 | m | - | App calculation |
| Outlet Readout - Discharge loss | 0.2817 | 0.282501143647 | m | 0.2844% | OK/Review |
| Outlet Readout - Terminal velocity head | Derived | 0.0178011887354 | m | - | App calculation |
| Outlet Readout - SNK hydraulic head | Derived/equivalent | 60.1579129241 | m | - | App calculation |
| Outlet Readout - Flow rate | 39.68 | 39.68 | m3/h | 0% | OK |
| Outlet Readout - Mass flow | 38291.2 | 38291.2 | kg/h | 0% | OK/Review |
| Outlet Readout - Pipe endpoint static P | Not stated | 4.935922 | bar a | - | App result |
| Outlet Readout - Pipe endpoint stagnation P | Not stated | 4.935922 | bar a | - | App result |
| Outlet Readout - Required boundary P | Not stated/equivalent | 4.935922 | bar a | - | App closure |
| Outlet Readout - Vapor pressure | 0.7010774085 | 0.7013169 | bar a | 0.0342% | OK/Review |
| Outlet Readout - Vapor margin | Derived | 44.7318215799 | m | - | Positive margin |

## Application Input & Result Data

- Fluid Basis - Fluid Name: Hot Water (.untirta model.FLUID.props)
- Fluid Basis - Temperature: 90 deg C (.untirta model.FLUID.props)
- Fluid Basis - Density rho: 965 kg/m3 (Application fluid basis)
- Fluid Basis - Specific gravity: 0.965 (Application fluid basis)
- Fluid Basis - Specific weight: 9466.65 N/m3 (Application fluid basis)
- Fluid Basis - Kinematic viscosity: 3.3161e-7 m2/s (0.331606 cSt) (Application fluid basis)
- Fluid Basis - Dynamic viscosity: 0.32 cP (Application fluid basis)
- Fluid Basis - Vapor pressure: 0.701317 bar a (Application fluid basis)
- Fluid Basis - Vapor pressure head: 7.40829 m (Application fluid basis)
- SRC - Source Type: Standalone Boundary Source (.untirta SRC)
- SRC - Boundary Pressure: 2.02400901 bar a (Direct/equivalent input)
- SRC - Source Elevation: 1.4 m (.untirta SRC)
- SRC - Volumetric Flow / Mass Flow: 39.68 m3/h / 38291.2 kg/h (.untirta SRC)
- SRC - Volumetric Flow Calculated: 39.68 m3/h (massFlow / density)
- Pipe Suction - Major Loss: 0.00985044 m (App recalculation)
- Pipe Suction - Minor Loss: 0.00415 m (App recalculation)
- Pipe Suction - Total Head Loss: 0.01400044 m (App recalculation)
- Pipe Suction - Total K: 0.69791661 (Model K values)
- Pipe Suction - Primary Re: 208786.7181 (App recalculation)
- Pipe Suction - Darcy f: 0.01716706 (App friction basis)
- Pipe Suction - eps/D: 2.2556e-4 (roughness / diameter)
- Pipe Discharge - Major Loss: 0.28250114 m (App recalculation)
- Pipe Discharge - Minor Loss: 0 m (App recalculation)
- Pipe Discharge - Total Head Loss: 0.28250114 m (App recalculation)
- Pipe Discharge - Total K: 0 (Model K values)
- Pipe Discharge - Primary Re: 274633.7947 (App recalculation)
- Pipe Discharge - Darcy f: 0.01709925 (App friction basis)
- Pipe Discharge - eps/D: 2.9669e-4 (roughness / diameter)
- Pump - Elevation: 0 m (.untirta pump)
- Pump - Suction Nozzle Elev.: 0 m (.untirta pump)
- Pump - Discharge Nozzle Elev.: 0 m (.untirta pump)
- Pump - Hydraulic NPSH Status: Safe (NPSHa 15.358 m > NPSHr 1 m)
- Pump - Engineering Status: Warning (Application NPSH/data-confidence split)
- Pump - Data Confidence: Warning: Journal gives one calculated operating point plus design/curve comparison data; full digitized manufacturer curve is not supplied. (Curve/source data confidence)
- Pump - Flow Evaluated: 39.68 m3/h (SNK-100 flow demand)
- Pump - Pump Head: 37.674 m (Network required head)
- Pump - NPSHa / NPSHr: 15.358 / 1 m (Application NPSH evaluation)
- Pump - NPSHr Source: Engineering-fit curve (Pump input/curve source)
- Pump - NPSH Margin / Ratio: 14.358 m / 15.358 (NPSHa - NPSHr; NPSHa/NPSHr)
- Pump - Required NPSHa / NPSH Excess: 1 m / 14.358 m (App margin basis)
- Pump - Suction Pressure: 2.155 bar a (Calculated at pump suction)
- Pump - Suction Loss: 0.014 m (Application suction loss)
- Pump - Dominant Loss: Suction NPS 8 Sch 40 (0.01 m) (Application diagnostic)
- Optimize Pump From Network - Workflow Status: Proposal Ready; readiness Ready (Network optimization proposal)
- Optimize Pump From Network - Target Flow: 39.68 m3/h (SNK-100 Flow Demand)
- Optimize Pump From Network - Required System Head: 37.674 m (Boundary head difference plus losses)
- Optimize Pump From Network - NPSHa at Design: 15.358 m (Network proposal)
- Optimize Pump From Network - Max Allowable NPSHr: 15.349 m (Network proposal)
- Optimize Pump From Network - Proposed NPSHr: 14.582 m (Proposal only; model input retained)
- Optimize Pump From Network - Worst AOR Point: 51.584 m3/h, 130% BEP, NPSHa 15.349 m (AOR envelope scan)
- SNK - Flow Demand: 39.68 m3/h (.untirta SNK)
- SNK - Pressure Basis: Static (.untirta SNK)
- SNK - Reference Pressure: 4.935921888 bar a (Direct/equivalent input)
- SNK - SNK Elevation: 8 m (.untirta SNK)
- Outlet Readout - Boundary Mode: Flow Demand Boundary (Calculated Outlet Readout)
- Outlet Readout - Boundary Pressure Input: 4.935922 bar a (Calculated Outlet Readout)
- Outlet Readout - Boundary Abs. Pressure: 4.935921888 bar a (Calculated Outlet Readout)
- Outlet Readout - Pressure Head: 52.140112 m (P/(rho g))
- Outlet Readout - Discharge Loss: 0.28250114 m (App discharge pipe total)
- Outlet Readout - Terminal Velocity Head: 0.01780119 m (V2/(2g))
- Outlet Readout - SNK Hydraulic Head: 60.157913 m (Pressure head + elevation + velocity head)
- Outlet Readout - Flow Rate: 39.68 m3/h (Calculated Outlet Readout)
- Outlet Readout - Mass Flow: 38291.2 kg/h (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Static P: 4.935922 bar a (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Stagnation P: 4.935922 bar a (Calculated Outlet Readout)
- Outlet Readout - Required Boundary P: 4.935922 bar a (Calculated Outlet Readout)
- Outlet Readout - Vapor Pressure: 0.701317 bar a (Fluid Basis)
- Outlet Readout - Vapor Margin: 4.234605 bar (44.731822 m) (Boundary pressure - vapor pressure)

## Optimize Pump From Network

- Objective: Use Optimize Pump From Network to verify the network-derived operating point and record the proposal without overwriting journal/literature inputs.
- Baseline: Flow = 39.68 m3/h; head = 37.674 m; NPSHa = 15.358 m; NPSHr = 1 m; status = Safe.
- Result: Proposal Ready: target flow 39.68 m3/h, required head 37.674 m, NPSHa at design 15.358 m, max allowable NPSHr 15.349 m, proposed NPSHr 14.582 m. Proposal stored; original journal input retained.

## Caveat dan Catatan Pertahanan

- Hydraulic NPSH Status = Safe. Basis: NPSHa 15.358 m > NPSHr 1 m.
- Engineering Status = Warning. Data Confidence = Warning: Journal gives one calculated operating point plus design/curve comparison data; full digitized manufacturer curve is not supplied..
- Optimize Pump From Network result = Proposal Ready; proposed NPSHr 14.582 m is recorded as proposal only and not applied over the literature input.
- The abstract says the operating head 37.674 m is higher than design 36 m, while Table 1/Table 5 list design head 30 m and curve head 36 m at the operating flow. The model stores design head 30 m and curve read-off 36 m, while using the calculated operating head 37.674 m for hydraulic closure.
- The paper lists operating pump power as 13.007 kW in the abstract/Table 5, while the calculation text gives shaft power Pp = 13.077 kW. The app calculation at Q = 39.68 m3/h, H = 37.674 m, and 30% efficiency gives 13.095 kW; all values are preserved in validationAudit.
- The discharge pressure is labelled as manometer pressure in Table 2, but the head equation subtracts the suction tank surface pressure directly. The app stores an equivalent absolute downstream boundary calibrated to the published total head.
- Table 2 labels density as berat jenis crude even though the fluid service is hot water. The model follows the numeric density 965 kg/m3 from the journal.
- The full manufacturer curve is shown graphically but not digitized in the text. The pump curve in this file is an engineering fit from the calculated operating point and design data.
- Downstream SNK pressure is an equivalent closure boundary so the application required-head calculation equals the journal operating head 37.674 m at Q = 39.68 m3/h.
- The suction strainer is represented as an equivalent K value derived from the journal strainer loss hstr = 0.00415 m.
- Commercial steel roughness is represented as 0.0018 inch / 0.00004572 m, matching the journal relative roughness basis.
- Pump efficiency and NPSHr between the operating and design points are linearly represented by the application curve interpolation because the full curve data table is not supplied.
- Operating point is outside POR; review reliability/efficiency.
- Hydraulic NPSH margin is acceptable, but Engineering Fit is suitable for screening and thesis calculation trace, but final Engineering Validation needs manufacturer/test curve confirmation.

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

## Kesimpulan

This case is conditionally validated for academic/engineering discussion. The report distinguishes direct journal numbers, engineering-derived values, and equivalent application closures.
