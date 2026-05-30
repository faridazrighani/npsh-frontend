# Audit Validasi Detail - Multistage Centrifugal Pump 118.5 kW

Tanggal audit: 2026-05-22T12:42:44.131Z  
File model: `Kinerja_Sentrifugal_Multistage_118,5_KW.untirta`  
Referensi jurnal: `Kinerja_Sentrifugal_Multistage_118,5_KW.pdf`

## Ringkasan Status

Status audit: **Conditionally validated with documented journal caveats and equivalent closures**.

Safe: NPSHa 17.76 m > NPSHr 3.3 m. Data Confidence: Warning: H-Q field test; efficiency/NPSHr from specification table.

## Komparasi Jurnal vs Aplikasi

| Parameter | Jurnal | Aplikasi / .untirta | Unit | Error | Status |
| --- | ---: | ---: | --- | ---: | --- |
| Fluid Basis - Temperature | 20 | 20 | deg C | 0% | OK |
| Fluid Basis - Density rho | 998.2 | 998.2 | kg/m3 | 0% | OK |
| Fluid Basis - Specific gravity | 0.9982 | 0.998227950383 | - | 0.0028% | OK |
| Fluid Basis - Specific weight | 9789 | 9789 | N/m3 | 0% | OK |
| Fluid Basis - Kinematic viscosity | 0.00000100380685233 | 0.000001003806852 | m2/s | 3.3293e-8% | OK |
| Fluid Basis - Dynamic viscosity | 1.002 | 1.002 | cP | 0% | OK |
| Fluid Basis - Vapor pressure | Not stated | 0.02339 | bar a | - | Derived/App basis |
| Fluid Basis - Vapor pressure head | Derived | 0.238860121511 | m | - | Derived/App basis |
| SRC - Boundary pressure | Not stated | 0.827 | bar a | - | Equivalent closure |
| SRC - Static/elevation basis to pump | 11 | 11 | m | 0% | OK |
| SRC - Volumetric flow | 116.64 | 116.64 | m3/h | 0% | OK |
| SRC - Mass flow | 116430.048 | 116430.048 | kg/h | 0% | OK - derived |
| SRC - Volumetric flow calculated | 116.64 | 116.64 | m3/h | 0% | OK |
| Pipe Suction - Major loss | 0.54 | 0.545087802716 | m | 0.9422% | OK/Review |
| Pipe Suction - Minor loss | 0.9 | 0.901456620312 | m | 0.1618% | OK/Review |
| Pipe Suction - Total head loss | 1.44 | 1.44654442303 | m | 0.4545% | OK/Review |
| Pipe Suction - Total K | Derived | 17.55 | - | - | Derived from model K values |
| Pipe Suction - Primary Re | Not stated | 202730.498025 | - | - | Derived/App calculation |
| Pipe Suction - Darcy f | Not stated | 0.0199371553706 | - | - | Derived/App calculation |
| Pipe Suction - eps/D | Derived | 0.00073995510939 | - | - | Derived/App calculation |
| Pipe Discharge - Major loss | 1.55 | 1.55089856751 | m | 0.058% | OK/Review |
| Pipe Discharge - Minor loss | 0.49 | 0.464853698794 | m | 5.1319% | OK/Review |
| Pipe Discharge - Total head loss | 2.04 | 2.0157522663 | m | 1.1886% | OK/Review |
| Pipe Discharge - Total K | Derived | 9.05 | - | - | Derived from model K values |
| Pipe Discharge - Primary Re | Not stated | 202730.498025 | - | - | Derived/App calculation |
| Pipe Discharge - Darcy f | Not stated | 0.0199371553706 | - | - | Derived/App calculation |
| Pipe Discharge - eps/D | Derived | 0.00073995510939 | - | - | Derived/App calculation |
| Pump - Elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Suction nozzle elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Discharge nozzle elevation | Datum/equivalent | 0 | m | - | Model datum |
| Pump - Flow evaluated | 116.64 | 116.64 | m3/h | 0% | OK |
| Pump - Pump head | 275.13 | 275.13 | m | 0% | OK/Review |
| Pump - Efficiency | 69 | 69 | % | 0% | OK/Review |
| Pump - NPSHa | 17.75997 | 17.76 | m | 1.6892e-4% | OK/Review |
| Pump - NPSHr | 3.3 | 3.3 | m | 0% | OK/Review |
| Pump - NPSH margin | 14.45997 | 14.46 | m | 2.0747e-4% | Derived |
| Pump - NPSH ratio | 5.38180909091 | 5.3818 | - | 1.6892e-4% | Derived |
| Pump - Required NPSHa | App criterion | 3.3 | m | - | App margin basis |
| Pump - NPSH excess | App criterion | 14.46 | m | - | App margin basis |
| Pump - Suction pressure | Derived/equivalent | 1.763 | bar a | - | Calculated/equivalent |
| Pump - Suction loss | 1.44 | 1.447 | m | 0.4861% | OK/Review |
| Pump - Required system head | 275.13 | 275.13 | m | 0% | OK/Review |
| Optimize Pump From Network - Readiness | Ready/Review | Ready | - | - | OK |
| Optimize Pump From Network - Target flow | 116.64 | 116.64 | m3/h | 0% | Proposal result |
| Optimize Pump From Network - Required system head | 275.13 | 275.13 | m | 0% | Proposal result |
| Optimize Pump From Network - NPSHa at design | 17.75997 | 17.76 | m | 1.6892e-4% | Proposal result |
| Optimize Pump From Network - Max allowable NPSHr | Derived | 16.778 | m | - | Proposal result |
| Optimize Pump From Network - Proposed NPSHr | Derived | 15.939 | m | - | Proposal only; journal input retained |
| SNK - Flow demand | 116.64 | 116.64 | m3/h | 0% | OK |
| SNK - Reference pressure | Not stated/equivalent | 27.4246007704 | bar a | - | Equivalent closure |
| SNK - Elevation | Not stated/equivalent | 11 | m | - | Model datum |
| Outlet Readout - Boundary abs pressure | Not stated/equivalent | 27.4246007704 | bar a | - | Equivalent closure |
| Outlet Readout - Pressure head | Derived | 280.061713229 | m | - | App calculation |
| Outlet Readout - Discharge loss | 2.04 | 2.0157522663 | m | 1.1886% | OK/Review |
| Outlet Readout - Terminal velocity head | Derived | 0.0513650495905 | m | - | App calculation |
| Outlet Readout - SNK hydraulic head | Derived/equivalent | 291.113078278 | m | - | App calculation |
| Outlet Readout - Flow rate | 116.64 | 116.64 | m3/h | 0% | OK |
| Outlet Readout - Mass flow | 116430.048 | 116430.048 | kg/h | 1.2498e-14% | OK/Review |
| Outlet Readout - Pipe endpoint static P | Not stated | 27.425 | bar a | - | App result |
| Outlet Readout - Pipe endpoint stagnation P | Not stated | 27.43 | bar a | - | App result |
| Outlet Readout - Required boundary P | Not stated/equivalent | 27.425 | bar a | - | App closure |
| Outlet Readout - Vapor pressure | Not stated | 0.02339 | bar a | - | Derived/App basis |
| Outlet Readout - Vapor margin | Derived | 279.822853107 | m | - | Positive margin |

## Application Input & Result Data

- Fluid Basis - Fluid Name: Water (.untirta model.FLUID.props)
- Fluid Basis - Temperature: 20 deg C (.untirta model.FLUID.props)
- Fluid Basis - Density rho: 998.2 kg/m3 (Application fluid basis)
- Fluid Basis - Specific gravity: 0.998228 (Application fluid basis)
- Fluid Basis - Specific weight: 9789 N/m3 (Application fluid basis)
- Fluid Basis - Kinematic viscosity: 1.0038e-6 m2/s (1.003807 cSt) (Application fluid basis)
- Fluid Basis - Dynamic viscosity: 1.002 cP (Application fluid basis)
- Fluid Basis - Vapor pressure: 0.02339 bar a (Application fluid basis)
- Fluid Basis - Vapor pressure head: 0.23886 m (Application fluid basis)
- SRC - Source Type: Standalone Boundary Source (.untirta SRC)
- SRC - Boundary Pressure: 0.827 bar a (Direct/equivalent input)
- SRC - Source Elevation: 11 m (.untirta SRC)
- SRC - Volumetric Flow / Mass Flow: 116.64 m3/h / 116430.048 kg/h (.untirta SRC)
- SRC - Volumetric Flow Calculated: 116.64 m3/h (massFlow / density)
- Pipe Suction - Major Loss: 0.5450878 m (App recalculation)
- Pipe Suction - Minor Loss: 0.90145662 m (App recalculation)
- Pipe Suction - Total Head Loss: 1.44654442 m (App recalculation)
- Pipe Suction - Total K: 17.55 (Model K values)
- Pipe Suction - Primary Re: 202730.498 (App recalculation)
- Pipe Suction - Darcy f: 0.01993716 (App friction basis)
- Pipe Suction - eps/D: 7.3996e-4 (roughness / diameter)
- Pipe Discharge - Major Loss: 1.55089857 m (App recalculation)
- Pipe Discharge - Minor Loss: 0.4648537 m (App recalculation)
- Pipe Discharge - Total Head Loss: 2.01575227 m (App recalculation)
- Pipe Discharge - Total K: 9.05 (Model K values)
- Pipe Discharge - Primary Re: 202730.498 (App recalculation)
- Pipe Discharge - Darcy f: 0.01993716 (App friction basis)
- Pipe Discharge - eps/D: 7.3996e-4 (roughness / diameter)
- Pump - Elevation: 0 m (.untirta pump)
- Pump - Suction Nozzle Elev.: 0 m (.untirta pump)
- Pump - Discharge Nozzle Elev.: 0 m (.untirta pump)
- Pump - Hydraulic NPSH Status: Safe (NPSHa 17.76 m > NPSHr 3.3 m)
- Pump - Engineering Status: Warning (Application NPSH/data-confidence split)
- Pump - Data Confidence: Warning: H-Q field test; efficiency/NPSHr from specification table (Curve/source data confidence)
- Pump - Flow Evaluated: 116.64 m3/h (SNK-100 flow demand)
- Pump - Pump Head: 275.13 m (Network required head)
- Pump - NPSHa / NPSHr: 17.76 / 3.3 m (Application NPSH evaluation)
- Pump - NPSHr Source: Engineering-fit curve (Pump input/curve source)
- Pump - NPSH Margin / Ratio: 14.46 m / 5.3818 (NPSHa - NPSHr; NPSHa/NPSHr)
- Pump - Required NPSHa / NPSH Excess: 3.3 m / 14.46 m (App margin basis)
- Pump - Suction Pressure: 1.763 bar a (Calculated at pump suction)
- Pump - Suction Loss: 1.447 m (Application suction loss)
- Pump - Dominant Loss: PIPE-1 journal suction branch losses (Application diagnostic)
- Optimize Pump From Network - Workflow Status: Proposal Ready; readiness Ready (Network optimization proposal)
- Optimize Pump From Network - Target Flow: 116.64 m3/h (SNK-100 Flow Demand)
- Optimize Pump From Network - Required System Head: 275.13 m (Boundary head difference plus losses)
- Optimize Pump From Network - NPSHa at Design: 17.76 m (Network proposal)
- Optimize Pump From Network - Max Allowable NPSHr: 16.778 m (Network proposal)
- Optimize Pump From Network - Proposed NPSHr: 15.939 m (Proposal only; model input retained)
- Optimize Pump From Network - Worst AOR Point: 151.632 m3/h, 130% BEP, NPSHa 16.778 m (AOR envelope scan)
- SNK - Flow Demand: 116.64 m3/h (.untirta SNK)
- SNK - Pressure Basis: Static (.untirta SNK)
- SNK - Reference Pressure: 27.42460077 bar a (Direct/equivalent input)
- SNK - SNK Elevation: 11 m (.untirta SNK)
- Outlet Readout - Boundary Mode: Flow Demand Boundary (Calculated Outlet Readout)
- Outlet Readout - Boundary Pressure Input: 27.425 bar a (Calculated Outlet Readout)
- Outlet Readout - Boundary Abs. Pressure: 27.42460077 bar a (Calculated Outlet Readout)
- Outlet Readout - Pressure Head: 280.061713 m (P/(rho g))
- Outlet Readout - Discharge Loss: 2.01575227 m (App discharge pipe total)
- Outlet Readout - Terminal Velocity Head: 0.05136505 m (V2/(2g))
- Outlet Readout - SNK Hydraulic Head: 291.113078 m (Pressure head + elevation + velocity head)
- Outlet Readout - Flow Rate: 116.64 m3/h (Calculated Outlet Readout)
- Outlet Readout - Mass Flow: 116430.048 kg/h (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Static P: 27.425 bar a (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Stagnation P: 27.43 bar a (Calculated Outlet Readout)
- Outlet Readout - Required Boundary P: 27.425 bar a (Calculated Outlet Readout)
- Outlet Readout - Vapor Pressure: 0.02339 bar a (Fluid Basis)
- Outlet Readout - Vapor Margin: 27.401211 bar (279.822853 m) (Boundary pressure - vapor pressure)

## Optimize Pump From Network

- Objective: Use Optimize Pump From Network to verify the network-derived operating point and record the proposal without overwriting journal/literature inputs.
- Baseline: Flow = 116.64 m3/h; head = 275.13 m; NPSHa = 17.76 m; NPSHr = 3.3 m; status = Safe.
- Result: Proposal Ready: target flow 116.64 m3/h, required head 275.13 m, NPSHa at design 17.76 m, max allowable NPSHr 16.778 m, proposed NPSHr 15.939 m. Proposal stored; original journal input retained.

## Caveat dan Catatan Pertahanan

- Hydraulic NPSH Status = Safe. Basis: NPSHa 17.76 m > NPSHr 3.3 m.
- Engineering Status = Warning. Data Confidence = Warning: H-Q field test; efficiency/NPSHr from specification table.
- Optimize Pump From Network result = Proposal Ready; proposed NPSHr 15.939 m is recorded as proposal only and not applied over the literature input.
- Table 2 labels the 307 m and 107.9 m pipe branches under headings that conflict with the hfd/hfs/hld/hls loss columns. The model maps 107.9 m + high-K fittings to suction loss and 307 m + lower-K fittings to discharge loss because that reproduces the Table 5 loss grouping.
- The paper gives the NPSHA formula and environment data but does not publish a final NPSHA value; this file stores a derived NPSHA from those inputs.
- Power input 118.5 kW and efficiency 69% are from the specification table and do not exactly close with every field-test H-Q point; app power uses the active H-Q point with the published efficiency.
- The paper calls the 2019 maximum-flow result 116 m3/h in the conclusion and 116.64 m3/h in the tables/abstract; the model uses the table value 116.64 m3/h.
- Tabel 5 component values are rounded and do not exactly sum to the reported Htot column; the model uses the published Htot values because they are repeated in Tabel 6 and the abstract as the official H-Q curve.
- Downstream SNK pressure is an equivalent closure boundary so the application required-head calculation equals the journal active head 275.13 m at Q = 116.64 m3/h.
- Water vapor pressure at 20 deg C is supplied from standard water-property data because the PDF omits the numeric Psat used in NPSHA.
- Efficiency and NPSHr are held constant across H-Q curve rows because measured curves are not supplied.
- SNK-100 pressure is an equivalent downstream closure boundary, not the Tabel 4 discharge pressure gauge reading; it is derived so the application system-head equation closes at Htot = 275.13 m and Q = 116.64 m3/h.
- Journal does not provide measured efficiency or NPSHr curve; curve uses H-Q test points with specification efficiency/NPSHr placeholders.
- Power readout uses active H-Q point with specification efficiency; it is not the same basis as the published 118.5 kW shaft-power line.

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
