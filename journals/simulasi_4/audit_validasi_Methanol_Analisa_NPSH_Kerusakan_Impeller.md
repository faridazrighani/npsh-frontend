# Audit Validasi Detail - Methanol Pump NPSH and Impeller Damage

Tanggal audit: 2026-05-22T12:42:44.092Z  
File model: `Methanol_Analisa_NPSH_Kerusakan_Impeller.untirta`  
Referensi jurnal: `Methanol_Analisa_NPSH_Kerusakan_Impeller.pdf`

## Ringkasan Status

Status audit: **Cavitation-risk case validated with documented journal caveats and equivalent closures**.

Cavitation Risk: NPSHa 4.75 m < NPSHr 5 m. Data Confidence: Warning: Manual - verify vendor data.

## Komparasi Jurnal vs Aplikasi

| Parameter | Jurnal | Aplikasi / .untirta | Unit | Error | Status |
| --- | ---: | ---: | --- | ---: | --- |
| Fluid Basis - Temperature | 40 | 40 | deg C | 0% | OK |
| Fluid Basis - Density rho | 774 | 774 | kg/m3 | 0% | OK |
| Fluid Basis - Specific gravity | 0.774 | 0.774021672607 | - | 0.0028% | OK |
| Fluid Basis - Specific weight | 7592.94 | 7592.94 | N/m3 | 0% | OK |
| Fluid Basis - Kinematic viscosity | 6.07235142119e-7 | 6.07235142119e-7 | m2/s | 1.7436e-14% | OK |
| Fluid Basis - Dynamic viscosity | 0.47 | 0.47 | cP | 0% | OK |
| Fluid Basis - Vapor pressure | 0.354303284 | 0.354303284097 | bar a | 2.7421e-8% | OK/Review |
| Fluid Basis - Vapor pressure head | 4.66621998857 | 4.66621998985 | m | 2.7421e-8% | OK/Review |
| SRC - Boundary pressure | Not stated | 0.368145597813 | bar a | - | Equivalent closure |
| SRC - Static/elevation basis to pump | Datum/equivalent | 5.97 | m | - | Model datum |
| SRC - Volumetric flow | 280 | 280 | m3/h | 0% | OK |
| SRC - Mass flow | 216720 | 216720 | kg/h | 0% | OK - derived |
| SRC - Volumetric flow calculated | 280 | 280 | m3/h | 0% | OK |
| Pipe Suction - Major loss | 0.19 | 0.187548555457 | m | 1.2902% | OK/Review |
| Pipe Suction - Minor loss | 1.22 | 1.21475650313 | m | 0.4298% | OK/Review |
| Pipe Suction - Total head loss | 1.41 | 1.40230505859 | m | 0.5457% | OK/Review |
| Pipe Suction - Total K | Derived | 9.81 | - | - | Derived from model K values |
| Pipe Suction - Primary Re | 553000 | 534698.434552 | - | 3.3095% | OK/Review |
| Pipe Suction - Darcy f | Not stated | 0.0148653793505 | - | - | Derived/App calculation |
| Pipe Suction - eps/D | Derived | 0.000150819672131 | - | - | Derived/App calculation |
| Pipe Discharge - Major loss | Not separated | 0.0901080205592 | m | - | Derived/App calculation |
| Pipe Discharge - Minor loss | Not separated | 0 | m | - | Derived/App calculation |
| Pipe Discharge - Total head loss | Not stated | 0.0901080205592 | m | - | Derived/App calculation |
| Pipe Discharge - Total K | Derived | 0 | - | - | Derived from model K values |
| Pipe Discharge - Primary Re | Not stated | 1058980.66583 | - | - | Derived/App calculation |
| Pipe Discharge - Darcy f | Not stated | 0.015614740038 | - | - | Derived/App calculation |
| Pipe Discharge - eps/D | Derived | 0.000298701298701 | - | - | Derived/App calculation |
| Pump - Elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Suction nozzle elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Discharge nozzle elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Flow evaluated | 280 | 280 | m3/h | 0% | OK |
| Pump - Pump head | 35.5 | 35.5 | m | 0% | OK/Review |
| Pump - Efficiency | 78.8156052632 | 78.82 | % | 0.0056% | OK/Review |
| Pump - NPSHa | 4.75 | 4.75 | m | 0% | OK/Review |
| Pump - NPSHr | 5 | 5 | m | 0% | OK/Review |
| Pump - NPSH margin | -0.25 | -0.25 | m | 0% | Derived |
| Pump - NPSH ratio | 0.95 | 0.95 | - | 0% | Derived |
| Pump - Required NPSHa | App criterion | 5 | m | - | App margin basis |
| Pump - NPSH excess | App criterion | -0.25 | m | - | App margin basis |
| Pump - Suction pressure | Derived/equivalent | 0.715 | bar a | - | Calculated/equivalent |
| Pump - Suction loss | 1.41 | 1.402 | m | 0.5674% | OK/Review |
| Pump - Required system head | 35.5 | 35.5 | m | 0% | OK/Review |
| Optimize Pump From Network - Readiness | Ready/Review | Ready | - | - | OK |
| Optimize Pump From Network - Target flow | 280 | 280 | m3/h | 0% | Proposal result |
| Optimize Pump From Network - Required system head | 35.5 | 35.5 | m | 0% | Proposal result |
| Optimize Pump From Network - NPSHa at design | 4.75 | 4.75 | m | 0% | Proposal result |
| Optimize Pump From Network - Max allowable NPSHr | Derived | 3.79 | m | - | Proposal result |
| Optimize Pump From Network - Proposed NPSHr | Derived | 3.6 | m | - | Proposal only; journal input retained |
| SNK - Flow demand | 280 | 280 | m3/h | 0% | OK |
| SNK - Reference pressure | Not stated/equivalent | 3.3361422246 | bar a | - | Equivalent closure |
| SNK - Elevation | Not stated/equivalent | 0 | m | - | Model datum |
| Outlet Readout - Boundary abs pressure | Not stated/equivalent | 3.3361422246 | bar a | - | Equivalent closure |
| Outlet Readout - Pressure head | Derived | 43.9374237726 | m | - | App calculation |
| Outlet Readout - Discharge loss | Not stated | 0.0901080205592 | m | - | OK/Review |
| Outlet Readout - Terminal velocity head | Derived | 0.88868819669 | m | - | App calculation |
| Outlet Readout - SNK hydraulic head | Derived/equivalent | 44.8261119693 | m | - | App calculation |
| Outlet Readout - Flow rate | 280 | 280 | m3/h | 0% | OK |
| Outlet Readout - Mass flow | 216720 | 216720 | kg/h | 0% | OK/Review |
| Outlet Readout - Pipe endpoint static P | Not stated | 3.336 | bar a | - | App result |
| Outlet Readout - Pipe endpoint stagnation P | Not stated | 3.404 | bar a | - | App result |
| Outlet Readout - Required boundary P | Not stated/equivalent | 3.336 | bar a | - | App closure |
| Outlet Readout - Vapor pressure | 0.354303284 | 0.354303284097 | bar a | 2.7421e-8% | OK/Review |
| Outlet Readout - Vapor margin | Derived | 39.2712037828 | m | - | Positive margin |

## Application Input & Result Data

- Fluid Basis - Fluid Name: Methanol (.untirta model.FLUID.props)
- Fluid Basis - Temperature: 40 deg C (.untirta model.FLUID.props)
- Fluid Basis - Density rho: 774 kg/m3 (Application fluid basis)
- Fluid Basis - Specific gravity: 0.774022 (Application fluid basis)
- Fluid Basis - Specific weight: 7592.94 N/m3 (Application fluid basis)
- Fluid Basis - Kinematic viscosity: 6.0724e-7 m2/s (0.607235 cSt) (Application fluid basis)
- Fluid Basis - Dynamic viscosity: 0.47 cP (Application fluid basis)
- Fluid Basis - Vapor pressure: 0.354303 bar a (Application fluid basis)
- Fluid Basis - Vapor pressure head: 4.66622 m (Application fluid basis)
- SRC - Source Type: Open Tank / Reservoir (.untirta SRC)
- SRC - Boundary Pressure: 0.368145598 bar a (Direct/equivalent input)
- SRC - Source Elevation: 5.97 m (.untirta SRC)
- SRC - Volumetric Flow / Mass Flow: 280 m3/h / 216720 kg/h (.untirta SRC)
- SRC - Volumetric Flow Calculated: 280 m3/h (massFlow / density)
- Pipe Suction - Major Loss: 0.18754856 m (App recalculation)
- Pipe Suction - Minor Loss: 1.2147565 m (App recalculation)
- Pipe Suction - Total Head Loss: 1.40230506 m (App recalculation)
- Pipe Suction - Total K: 9.81 (Model K values)
- Pipe Suction - Primary Re: 534698.4346 (App recalculation)
- Pipe Suction - Darcy f: 0.01486538 (App friction basis)
- Pipe Suction - eps/D: 1.5082e-4 (roughness / diameter)
- Pipe Discharge - Major Loss: 0.09010802 m (App recalculation)
- Pipe Discharge - Minor Loss: 0 m (App recalculation)
- Pipe Discharge - Total Head Loss: 0.09010802 m (App recalculation)
- Pipe Discharge - Total K: 0 (Model K values)
- Pipe Discharge - Primary Re: 1058980.6658 (App recalculation)
- Pipe Discharge - Darcy f: 0.01561474 (App friction basis)
- Pipe Discharge - eps/D: 2.9870e-4 (roughness / diameter)
- Pump - Elevation: 0 m (.untirta pump)
- Pump - Suction Nozzle Elev.: 0 m (.untirta pump)
- Pump - Discharge Nozzle Elev.: 0 m (.untirta pump)
- Pump - Hydraulic NPSH Status: Cavitation Risk (NPSHa 4.75 m < NPSHr 5 m)
- Pump - Engineering Status: Cavitation Risk (Application NPSH/data-confidence split)
- Pump - Data Confidence: Warning: Manual - verify vendor data (Curve/source data confidence)
- Pump - Flow Evaluated: 280 m3/h (SNK-100 flow demand)
- Pump - Pump Head: 35.5 m (Network required head)
- Pump - NPSHa / NPSHr: 4.75 / 5 m (Application NPSH evaluation)
- Pump - NPSHr Source: Manual input (Pump input/curve source)
- Pump - NPSH Margin / Ratio: -0.25 m / 0.95 (NPSHa - NPSHr; NPSHa/NPSHr)
- Pump - Required NPSHa / NPSH Excess: 5 m / -0.25 m (App margin basis)
- Pump - Suction Pressure: 0.715 bar a (Calculated at pump suction)
- Pump - Suction Loss: 1.402 m (Application suction loss)
- Pump - Dominant Loss: PIPE-1 (1.40 m) (Application diagnostic)
- Optimize Pump From Network - Workflow Status: Proposal Ready; readiness Ready (Network optimization proposal)
- Optimize Pump From Network - Target Flow: 280 m3/h (SNK-100 Flow Demand)
- Optimize Pump From Network - Required System Head: 35.5 m (Boundary head difference plus losses)
- Optimize Pump From Network - NPSHa at Design: 4.75 m (Network proposal)
- Optimize Pump From Network - Max Allowable NPSHr: 3.79 m (Network proposal)
- Optimize Pump From Network - Proposed NPSHr: 3.6 m (Proposal only; model input retained)
- Optimize Pump From Network - Worst AOR Point: 364 m3/h, 130% BEP, NPSHa 3.79 m (AOR envelope scan)
- SNK - Flow Demand: 280 m3/h (.untirta SNK)
- SNK - Pressure Basis: Static (.untirta SNK)
- SNK - Reference Pressure: 3.336142225 bar a (Direct/equivalent input)
- SNK - SNK Elevation: 0 m (.untirta SNK)
- Outlet Readout - Boundary Mode: Flow Demand Boundary (Calculated Outlet Readout)
- Outlet Readout - Boundary Pressure Input: 3.336 bar a (Calculated Outlet Readout)
- Outlet Readout - Boundary Abs. Pressure: 3.336142225 bar a (Calculated Outlet Readout)
- Outlet Readout - Pressure Head: 43.937424 m (P/(rho g))
- Outlet Readout - Discharge Loss: 0.09010802 m (App discharge pipe total)
- Outlet Readout - Terminal Velocity Head: 0.8886882 m (V2/(2g))
- Outlet Readout - SNK Hydraulic Head: 44.826112 m (Pressure head + elevation + velocity head)
- Outlet Readout - Flow Rate: 280 m3/h (Calculated Outlet Readout)
- Outlet Readout - Mass Flow: 216720 kg/h (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Static P: 3.336 bar a (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Stagnation P: 3.404 bar a (Calculated Outlet Readout)
- Outlet Readout - Required Boundary P: 3.336 bar a (Calculated Outlet Readout)
- Outlet Readout - Vapor Pressure: 0.354303 bar a (Fluid Basis)
- Outlet Readout - Vapor Margin: 2.981839 bar (39.271204 m) (Boundary pressure - vapor pressure)

## Optimize Pump From Network

- Objective: Use Optimize Pump From Network to verify the network-derived operating point and record the proposal without overwriting journal/literature inputs.
- Baseline: Flow = 280 m3/h; head = 35.5 m; NPSHa = 4.75 m; NPSHr = 5 m; status = Cavitation Risk.
- Result: Proposal Ready: target flow 280 m3/h, required head 35.5 m, NPSHa at design 4.75 m, max allowable NPSHr 3.79 m, proposed NPSHr 3.6 m. Proposal stored; original journal input retained.

## Caveat dan Catatan Pertahanan

- Hydraulic NPSH Status = Cavitation Risk. Basis: NPSHa 4.75 m < NPSHr 5 m.
- Engineering Status = Cavitation Risk. Data Confidence = Warning: Manual - verify vendor data.
- Optimize Pump From Network result = Proposal Ready; proposed NPSHr 3.6 m is recorded as proposal only and not applied over the literature input.
- The PDF text labels Pb = 536.7 N/m2 and PD = 35x10^6 N/m2, but those units/magnitudes cannot produce the published NPSHa = 4.75 m and PD is not credible for methanol at 40 C.
- The NPSHa equation line subtracts 1.22 m, while the preceding text defines Hvs as major + minor and separately reports major loss about 0.19 m.
- The sketch list says five 45-degree elbows, while Table 2 uses quantity two and total K = 0.8; this model follows Table 2 because it leads to the published K sum 9.03.
- The paper focuses on suction NPSH and does not provide discharge piping or downstream boundary data.
- Reynolds number from the listed Q, D, rho, and mu is about 5.35e5 with the app/standard area calculation, while the paper reports 5.53e5; both remain turbulent and do not change the conclusion.
- SRC-100 pressure is an equivalent boundary selected to reproduce published NPSHa with the app hydraulic formulation while retaining a defensible methanol vapor pressure.
- SNK-100 pressure is an equivalent closure boundary selected so required system head equals the nameplate pump head 35.5 m at 280 m3/h.
- PIPE-2 is a placeholder for app hydraulic closure only, not a journal-validated discharge model.
- NPSHa is at or below NPSHr; cavitation risk is high.

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

This case is validated as a cavitation-risk reconstruction for academic/engineering discussion. The report distinguishes direct journal numbers, engineering-derived values, and equivalent application closures.
