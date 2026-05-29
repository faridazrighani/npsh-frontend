# Audit Validasi Detail - Pipe Diameter Head Loss Analysis

Tanggal audit: 2026-05-22T12:42:44.059Z  
File model: `Analisa_Head_Losses_pada_Diameter_Pipa.untirta`  
Referensi jurnal: `Analisa_Head_Losses_pada_Diameter_Pipa.pdf`

## Ringkasan Status

Status audit: **Conditionally validated with documented journal caveats and equivalent closures**.

Safe: NPSHa 6.3238 m > NPSHr 0.1166 m. Data Confidence: Warning: Manual - verify vendor data.

## Komparasi Jurnal vs Aplikasi

| Parameter | Jurnal | Aplikasi / .untirta | Unit | Error | Status |
| --- | ---: | ---: | --- | ---: | --- |
| Fluid Basis - Temperature | 100 | 100 | deg C | 0% | OK |
| Fluid Basis - Density rho | Not stated | 1000 | kg/m3 | - | Derived/App basis |
| Fluid Basis - Specific gravity | Derived | 1 | - | - | Derived/App basis |
| Fluid Basis - Specific weight | Derived | 9810 | N/m3 | - | Derived/App basis |
| Fluid Basis - Kinematic viscosity | 2.95e-7 | 2.95e-7 | m2/s | 0% | OK |
| Fluid Basis - Dynamic viscosity | Not stated | 0.295 | cP | - | Derived/App basis |
| Fluid Basis - Vapor pressure | Not stated | 1.01324661396 | bar a | - | Derived/App basis |
| Fluid Basis - Vapor pressure head | Derived | 10.3287116612 | m | - | Derived/App basis |
| SRC - Boundary pressure | Not stated | 1.01323900631 | bar a | - | Equivalent closure |
| SRC - Static/elevation basis to pump | Datum/equivalent | 6.5 | m | - | Model datum |
| SRC - Volumetric flow | 25 | 25 | m3/h | 0% | OK |
| SRC - Mass flow | Derived | 25000 | kg/h | - | Derived/App basis |
| SRC - Volumetric flow calculated | 25 | 25 | m3/h | 0% | OK |
| Pipe Suction - Major loss | 0.1082 | 0.11581099376 | m | 7.0342% | OK/Review |
| Pipe Suction - Minor loss | Not separated | 0.0679105522897 | m | - | Derived/App calculation |
| Pipe Suction - Total head loss | 0.176 | 0.18372154605 | m | 4.3872% | OK/Review |
| Pipe Suction - Total K | Derived | 1.816 | - | - | Derived from model K values |
| Pipe Suction - Primary Re | 295050 | 295006.715697 | - | 0.0147% | OK/Review |
| Pipe Suction - Darcy f | 0.021 | 0.0224747071909 | - | 7.0224% | OK/Review |
| Pipe Suction - eps/D | 0.0015 | 0.0015 | - | 0% | OK |
| Pipe Discharge - Major loss | 0.0927 | 0.0992665660803 | m | 7.0837% | OK/Review |
| Pipe Discharge - Minor loss | Not separated | 0.0454731451455 | m | - | Derived/App calculation |
| Pipe Discharge - Total head loss | 0.1381 | 0.144739711226 | m | 4.8079% | OK/Review |
| Pipe Discharge - Total K | Derived | 1.216 | - | - | Derived from model K values |
| Pipe Discharge - Primary Re | 295050 | 295006.715697 | - | 0.0147% | OK/Review |
| Pipe Discharge - Darcy f | 0.021 | 0.0224747071909 | - | 7.0224% | OK/Review |
| Pipe Discharge - eps/D | 0.0015 | 0.0015 | - | 0% | OK |
| Pump - Elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Suction nozzle elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Discharge nozzle elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Flow evaluated | 25 | 25 | m3/h | 0% | OK |
| Pump - Pump head | 1.8515 | 1.851 | m | 0.027% | OK/Review |
| Pump - Efficiency | 60 | 60 | % | 0% | OK/Review |
| Pump - NPSHa | 6.3238 | 6.3238 | m | 0% | OK/Review |
| Pump - NPSHr | 0.1166 | 0.1166 | m | 0% | OK/Review |
| Pump - NPSH margin | 6.2072 | 6.2072 | m | 0% | Derived |
| Pump - NPSH ratio | 54.2349914237 | 54.235 | - | 1.5813e-5% | Derived |
| Pump - Required NPSHa | App criterion | 0.1166 | m | - | App margin basis |
| Pump - NPSH excess | App criterion | 6.2072 | m | - | App margin basis |
| Pump - Suction pressure | Derived/equivalent | 1.6336 | bar a | - | Calculated/equivalent |
| Pump - Suction loss | 0.176 | 0.1761 | m | 0.0568% | OK/Review |
| Pump - Required system head | 1.8515 | 1.8515 | m | 0% | OK/Review |
| Optimize Pump From Network - Readiness | Ready/Review | Ready | - | - | OK |
| Optimize Pump From Network - Target flow | 25 | 25 | m3/h | 0% | Proposal result |
| Optimize Pump From Network - Required system head | 1.8515 | 1.852 | m | 0.027% | Proposal result |
| Optimize Pump From Network - NPSHa at design | 6.3238 | 6.324 | m | 0.0032% | Proposal result |
| Optimize Pump From Network - Max allowable NPSHr | Derived | 6.204 | m | - | Proposal result |
| Optimize Pump From Network - Proposed NPSHr | Derived | 5.894 | m | - | Proposal only; journal input retained |
| SNK - Flow demand | 25 | 25 | m3/h | 0% | OK |
| SNK - Reference pressure | Not stated/equivalent | 1.01321503763 | bar a | - | Equivalent closure |
| SNK - Elevation | Not stated/equivalent | 8 | m | - | Model datum |
| Outlet Readout - Boundary abs pressure | Not stated/equivalent | 1.01321503763 | bar a | - | Equivalent closure |
| Outlet Readout - Pressure head | Derived | 10.3283897822 | m | - | App calculation |
| Outlet Readout - Discharge loss | 0.1381 | 0.144739711226 | m | 4.8079% | OK/Review |
| Outlet Readout - Terminal velocity head | Derived | 0.0373956785736 | m | - | App calculation |
| Outlet Readout - SNK hydraulic head | Derived/equivalent | 18.3657854608 | m | - | App calculation |
| Outlet Readout - Flow rate | 25 | 25 | m3/h | 0% | OK |
| Outlet Readout - Mass flow | Derived | 25000 | kg/h | - | Derived/App basis |
| Outlet Readout - Pipe endpoint static P | Not stated | 1.013 | bar a | - | App result |
| Outlet Readout - Pipe endpoint stagnation P | Not stated | 1.017 | bar a | - | App result |
| Outlet Readout - Required boundary P | Not stated/equivalent | 1.013215 | bar a | - | App closure |
| Outlet Readout - Vapor pressure | Not stated | 1.01324661396 | bar a | - | Derived/App basis |
| Outlet Readout - Vapor margin | Derived | -0.000321878954112 | m | - | Review |

## Application Input & Result Data

- Fluid Basis - Fluid Name: Custom (.untirta model.FLUID.props)
- Fluid Basis - Temperature: 100 deg C (.untirta model.FLUID.props)
- Fluid Basis - Density rho: 1000 kg/m3 (Application fluid basis)
- Fluid Basis - Specific gravity: 1 (Application fluid basis)
- Fluid Basis - Specific weight: 9810 N/m3 (Application fluid basis)
- Fluid Basis - Kinematic viscosity: 2.9500e-7 m2/s (0.295 cSt) (Application fluid basis)
- Fluid Basis - Dynamic viscosity: 0.295 cP (Application fluid basis)
- Fluid Basis - Vapor pressure: 1.013247 bar a (Application fluid basis)
- Fluid Basis - Vapor pressure head: 10.328712 m (Application fluid basis)
- SRC - Source Type: Standalone Boundary Source (.untirta SRC)
- SRC - Boundary Pressure: 1.013239006 bar a (Direct/equivalent input)
- SRC - Source Elevation: 6.5 m (.untirta SRC)
- SRC - Volumetric Flow / Mass Flow: 25 m3/h / 25000 kg/h (.untirta SRC)
- SRC - Volumetric Flow Calculated: 25 m3/h (massFlow / density)
- Pipe Suction - Major Loss: 0.11581099 m (App recalculation)
- Pipe Suction - Minor Loss: 0.06791055 m (App recalculation)
- Pipe Suction - Total Head Loss: 0.18372155 m (App recalculation)
- Pipe Suction - Total K: 1.816 (Model K values)
- Pipe Suction - Primary Re: 295006.7157 (App recalculation)
- Pipe Suction - Darcy f: 0.02247471 (App friction basis)
- Pipe Suction - eps/D: 0.0015 (roughness / diameter)
- Pipe Discharge - Major Loss: 0.09926657 m (App recalculation)
- Pipe Discharge - Minor Loss: 0.04547315 m (App recalculation)
- Pipe Discharge - Total Head Loss: 0.14473971 m (App recalculation)
- Pipe Discharge - Total K: 1.216 (Model K values)
- Pipe Discharge - Primary Re: 295006.7157 (App recalculation)
- Pipe Discharge - Darcy f: 0.02247471 (App friction basis)
- Pipe Discharge - eps/D: 0.0015 (roughness / diameter)
- Pump - Elevation: 0 m (.untirta pump)
- Pump - Suction Nozzle Elev.: 0 m (.untirta pump)
- Pump - Discharge Nozzle Elev.: 0 m (.untirta pump)
- Pump - Hydraulic NPSH Status: Safe (NPSHa 6.3238 m > NPSHr 0.1166 m)
- Pump - Engineering Status: Safe (Application NPSH/data-confidence split)
- Pump - Data Confidence: Warning: Manual - verify vendor data (Curve/source data confidence)
- Pump - Flow Evaluated: 25 m3/h (SNK-100 flow demand)
- Pump - Pump Head: 1.851 m (Network required head)
- Pump - NPSHa / NPSHr: 6.3238 / 0.1166 m (Application NPSH evaluation)
- Pump - NPSHr Source: Manual input (Pump input/curve source)
- Pump - NPSH Margin / Ratio: 6.2072 m / 54.235 (NPSHa - NPSHr; NPSHa/NPSHr)
- Pump - Required NPSHa / NPSH Excess: 0.1166 m / 6.2072 m (App margin basis)
- Pump - Suction Pressure: 1.6336 bar a (Calculated at pump suction)
- Pump - Suction Loss: 0.1761 m (Application suction loss)
- Pump - Dominant Loss: PIPE-1 (0.18 m) (Application diagnostic)
- Optimize Pump From Network - Workflow Status: Proposal Ready; readiness Ready (Network optimization proposal)
- Optimize Pump From Network - Target Flow: 25 m3/h (SNK-100 Flow Demand)
- Optimize Pump From Network - Required System Head: 1.852 m (Boundary head difference plus losses)
- Optimize Pump From Network - NPSHa at Design: 6.324 m (Network proposal)
- Optimize Pump From Network - Max Allowable NPSHr: 6.204 m (Network proposal)
- Optimize Pump From Network - Proposed NPSHr: 5.894 m (Proposal only; model input retained)
- Optimize Pump From Network - Worst AOR Point: 32.5 m3/h, 130% BEP, NPSHa 6.204 m (AOR envelope scan)
- SNK - Flow Demand: 25 m3/h (.untirta SNK)
- SNK - Pressure Basis: Static (.untirta SNK)
- SNK - Reference Pressure: 1.013215038 bar a (Direct/equivalent input)
- SNK - SNK Elevation: 8 m (.untirta SNK)
- Outlet Readout - Boundary Mode: Flow Demand Boundary (Calculated Outlet Readout)
- Outlet Readout - Boundary Pressure Input: 1.013215 bar a (Calculated Outlet Readout)
- Outlet Readout - Boundary Abs. Pressure: 1.013215038 bar a (Calculated Outlet Readout)
- Outlet Readout - Pressure Head: 10.32839 m (P/(rho g))
- Outlet Readout - Discharge Loss: 0.14473971 m (App discharge pipe total)
- Outlet Readout - Terminal Velocity Head: 0.03739568 m (V2/(2g))
- Outlet Readout - SNK Hydraulic Head: 18.365785 m (Pressure head + elevation + velocity head)
- Outlet Readout - Flow Rate: 25 m3/h (Calculated Outlet Readout)
- Outlet Readout - Mass Flow: 25000 kg/h (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Static P: 1.013 bar a (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Stagnation P: 1.017 bar a (Calculated Outlet Readout)
- Outlet Readout - Required Boundary P: 1.013215 bar a (Calculated Outlet Readout)
- Outlet Readout - Vapor Pressure: 1.013247 bar a (Fluid Basis)
- Outlet Readout - Vapor Margin: -3.1576e-5 bar (-3.2188e-4 m) (Boundary pressure - vapor pressure)

## Optimize Pump From Network

- Objective: Use Optimize Pump From Network to verify the network-derived operating point and record the proposal without overwriting journal/literature inputs.
- Baseline: Flow = 25 m3/h; head = 1.851 m; NPSHa = 6.3238 m; NPSHr = 0.1166 m; status = Safe.
- Result: Proposal Ready: target flow 25 m3/h, required head 1.852 m, NPSHa at design 6.324 m, max allowable NPSHr 6.204 m, proposed NPSHr 5.894 m. Proposal stored; original journal input retained.

## Caveat dan Catatan Pertahanan

- Hydraulic NPSH Status = Safe. Basis: NPSHa 6.3238 m > NPSHr 0.1166 m.
- Engineering Status = Safe. Data Confidence = Warning: Manual - verify vendor data.
- Optimize Pump From Network result = Proposal Ready; proposed NPSHr 5.894 m is recorded as proposal only and not applied over the literature input.
- The abstract shows elbow head loss as 0.0012 m, while the detailed calculation gives 0.0112 m. The model uses 0.0112 m because it matches K*V^2/(2g).
- Pump rated/nameplate head is 40 m, but the journal NPSHr calculation uses HN = 1.8515 m from the system-head calculation. The model uses 1.8515 m as active duty head and stores 40 m as metadata.
- The journal assumes reservoir pressure difference Delta hp = 0. The app-calibrated source and sink reference pressures differ only by rounding-level closure so the exact app solver returns Htotal = 1.8515 m.
- The journal does not provide manufacturer pump curve or efficiency validation; any efficiency/power readout is support data, not a validated journal target.
- NPSH margin basis is User Defined with ratio 1.0 and absolute margin 0 m to reproduce the journal criterion NPSHa > NPSHr.
- Source and sink pressures are equivalent application boundaries selected to reproduce the journal head/NPSH values under the application formula set.
- The pump curve rows are retained as illustrative metadata only; Basic/manual duty inputs control the recalculated operating point.

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
