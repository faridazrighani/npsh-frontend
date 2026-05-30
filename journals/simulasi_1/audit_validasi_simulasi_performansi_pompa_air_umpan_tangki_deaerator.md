# Audit Validasi Detail - Pompa Air Umpan ke Tangki Deaerator

Tanggal audit: 2026-05-22T12:07:05.980Z  
File model: `simulasi_performansi_pompa_air_umpan_tangki_deaerator.untirta`  
Referensi jurnal: `analisisi_performansi_pompa_air_umpan_tangki_deaerator.pdf`

## Ringkasan Status

Status audit: **conditionally validated**.

Simulasi aplikasi merekonstruksi titik operasi jurnal: Q = 50 m3/h, H = 24 m, NPSHa = 6.4656 m, NPSHr = 2.4002 m, margin = 4.0654 m. Hydraulic NPSH Status adalah **Safe** karena NPSHa > NPSHr. Data Confidence tetap **Warning** karena NPSHr manual dan kurva pompa lengkap tidak tersedia dari jurnal.

## Proporsi Laporan

| Bagian | Porsi Engineering | Fokus |
| --- | ---: | --- |
| Fluid Basis | 10% | Properti fluida untuk Re, friction, dan NPSH |
| SRC/Tank | 10% | Flow, elevasi datum, dan equivalent boundary |
| Pipe Suction/Discharge | 25% | Major/minor loss, K, Re, f, eps/D |
| Pump dan NPSH | 25% | Head, NPSHa/NPSHr, margin, status, data confidence |
| Optimize Pump From Network | 15% | Required head, NPSHa design, allowable NPSHr envelope |
| SNK dan Outlet Readout | 15% | Boundary akhir, pressure head, vapor margin |

## Komparasi Jurnal vs Aplikasi

| Parameter | Jurnal | Aplikasi / .untirta | Unit | Error | Status |
| --- | ---: | ---: | --- | ---: | --- |
| Fluid Basis - Temperature | 100 | 100 | deg C | 0% | OK |
| Fluid Basis - Density rho | 958.205912334 | 958.348383592 | kg/m3 | 0.0149% | OK - derived from gamma |
| Fluid Basis - Specific gravity | 0.958205912334 | 0.958375218099 | - | 0.0177% | OK - derived |
| Fluid Basis - Specific weight | 9400 | 9398.18717596 | N/m3 | 0.0193% | OK - rounding |
| Fluid Basis - Kinematic viscosity | 8.03e-7 | 8.03e-7 | m2/s | 0% | OK |
| Fluid Basis - Dynamic viscosity | 0.769439347604 | 0.769553752025 | cP | 0.0149% | OK - derived |
| Fluid Basis - Vapor pressure | 1.01325 | 1.01417993818 | bar a | 0.0918% | Review - physical 100 deg C basis |
| Fluid Basis - Vapor pressure head | 10.7792553191 | 10.7875443278 | m | 0.0769% | Review - journal NPSH line has unit caveat |
| SRC - Boundary pressure | Not stated | 1.82092647642 | bar a | - | Equivalent closure |
| SRC - Source elevation datum | 0 | 0 | m | - | OK - model datum |
| SRC - Static head to pump suction | 0.5 | 0.5 | m | 0% | OK |
| SRC - Volumetric flow | 50 | 50 | m3/h | 0% | OK |
| SRC - Mass flow | 47910.2956167 | 47917.4191796 | kg/h | 0.0149% | Derived OK |
| SRC - Volumetric flow calculated | 50 | 50 | m3/h | 0% | OK |
| Pipe Suction - Major loss | 0.0796 | 0.0803797738187 | m | 0.9796% | OK - constants/rounding |
| Pipe Suction - Minor loss | 2.5507 | 2.5351543179 | m | 0.6095% | OK - equivalent K/rounding |
| Pipe Suction - Total head loss | 2.6303 | 2.61553409172 | m | 0.5614% | OK - rounding |
| Pipe Suction - Total K | 14.6707549131 | 14.6707549131 | - | 0% | OK - includes equivalent contraction K |
| Pipe Suction - Primary Re | 222501 | 224717.037713 | - | 0.996% | OK - turbulent; exact Q/pi basis |
| Pipe Suction - Darcy f | 0.0225 | 0.0227924453015 | - | 1.2998% | OK - Colebrook/app basis |
| Pipe Suction - eps/D | 0.0015306122449 | 0.0015306122449 | - | 0% | OK |
| Pipe Discharge - Major loss | 1.761 | 1.75623677195 | m | 0.2705% | OK - constants/rounding |
| Pipe Discharge - Minor loss | 9.9265 | 9.91227216765 | m | 0.1433% | OK - equivalent K/rounding |
| Pipe Discharge - Total head loss | 11.6875 | 11.6685089396 | m | 0.1625% | OK - rounding |
| Pipe Discharge - Total K | 18.4477083569 | 18.4477083569 | - | 0% | OK - split as 4 table elbows + 2 calculation elbows |
| Pipe Discharge - Primary Re | 296940 | 298404.738426 | - | 0.4933% | OK - turbulent; exact Q/pi basis |
| Pipe Discharge - Darcy f | 0.0241 | 0.0241217401028 | - | 0.0902% | OK |
| Pipe Discharge - eps/D | 0.0020325203252 | 0.0020325203252 | - | 0% | OK |
| Pump - Elevation | 0 | 0 | m | - | OK - pump datum |
| Pump - Suction nozzle elevation | -0.5 | -0.5 | m | 0% | OK - gives hs 0.5 m |
| Pump - Discharge nozzle elevation | 0 | 0 | m | - | OK |
| Pump - Flow evaluated | 50 | 50 | m3/h | 0% | OK |
| Pump - Pump head design | 24 | 24 | m | 0% | OK |
| Pump - Pump head evaluated | 24 | 24 | m | 0% | OK |
| Pump - NPSHa | 6.4656 | 6.4656 | m | 0% | OK |
| Pump - NPSHr | 2.4002 | 2.4002 | m | 0% | OK |
| Pump - NPSH margin | 4.0654 | 4.0654 | m | 0% | OK - derived |
| Pump - NPSH ratio | 2.69377551871 | 2.6938 | - | 9.0881e-4% | OK - derived |
| Pump - Required NPSHa | 3.0002 | 3.0002 | m | 0% | Derived by app margin basis |
| Pump - NPSH excess | 3.4654 | 3.4654 | m | 1.2815e-14% | Derived by app margin basis |
| Pump - Suction pressure | Not stated | 1.622 | bar a | - | Calculated/equivalent |
| Pump - Suction loss | 2.6303 | 2.6155 | m | 0.5627% | OK - constants/rounding |
| Pump - Shaft power | 5.0578 | 5.05278880428 | kW | 0.0991% | OK - app exact gamma/Q |
| Optimize Pump From Network - Readiness | Ready | Ready | - | - | OK |
| Optimize Pump From Network - Target flow | 50 | 50 | m3/h | 0% | OK |
| Optimize Pump From Network - Required system head | 24 | 24 | m | 0% | OK |
| Optimize Pump From Network - NPSHa at design | 6.4656 | 6.466 | m | 0.0062% | OK |
| Optimize Pump From Network - Max allowable NPSHr | Derived | 3.662 | m | - | Proposal result |
| Optimize Pump From Network - Proposed NPSHr | Derived | 3.479 | m | - | Proposal only; journal NPSHr retained |
| Optimize Pump From Network - Worst AOR flow | AOR scan | 65 | m3/h | - | Proposal result |
| SNK - Flow demand | 50 | 50 | m3/h | 0% | OK |
| SNK - Reference pressure | Not stated | 1.74370712905 | bar a | - | Equivalent closure |
| SNK - Elevation | 10 | 10 | m | 0% | OK |
| Outlet Readout - Boundary abs pressure | Not stated | 1.74370712905 | bar a | - | Equivalent closure |
| Outlet Readout - Pressure head | Derived/equivalent | 18.547318125 | m | - | App calculation |
| Outlet Readout - Discharge loss | 11.6875 | 11.6685089396 | m | 0.1625% | OK - constants/rounding |
| Outlet Readout - Terminal velocity head | Derived | 0.537317263254 | m | - | App calculation |
| Outlet Readout - SNK hydraulic head | Derived/equivalent | 29.0846353882 | m | - | App calculation |
| Outlet Readout - Flow rate | 50 | 50 | m3/h | 0% | OK |
| Outlet Readout - Mass flow | 47910.2956167 | 47917.419 | kg/h | 0.0149% | Derived OK |
| Outlet Readout - Pipe endpoint static P | Not stated | 1.744 | bar a | - | App result |
| Outlet Readout - Pipe endpoint stagnation P | Not stated | 1.794 | bar a | - | App result |
| Outlet Readout - Required boundary P | Not stated | 1.744 | bar a | - | App closure |
| Outlet Readout - Vapor pressure | 1.01325 | 1.01417993818 | bar a | 0.0918% | Review - physical 100 deg C basis |
| Outlet Readout - Vapor margin | Derived | 7.75977379715 | m | - | Positive margin at outlet |

## Fluid Basis Yang Digunakan

- Fluid Name: Water (.untirta model.FLUID.props)
- Temperature: 100 deg C (.untirta model.FLUID.props)
- Density rho: 958.348384 kg/m3 (Application fluid basis)
- Specific gravity: 0.958375 (Application fluid basis)
- Specific weight: 9398.187176 N/m3 (Application fluid basis)
- Kinematic viscosity: 8.0300e-7 m2/s (0.803 cSt) (Set from journal nu)
- Dynamic viscosity: 0.769554 cP (rho x nu)
- Vapor pressure: 1.01418 bar a (Physical 100 deg C water basis)
- Vapor pressure head: 10.7875 m (Pv/(rho g))

## SRC/Tank Yang Digunakan

- Source Type: Fixed Flow Source (.untirta SRC-100)
- Boundary Pressure: 1.820926476 bar a (Equivalent closure to reproduce NPSHa)
- Source Elevation: 0 m (Application datum)
- Volumetric Flow / Mass Flow: 50 m3/h / 47917.419 kg/h (.untirta SRC-100)
- Volumetric Flow Calculated: 50 m3/h (massFlow / density)

## Pipe Suction dan Discharge

- Pipe Suction - Major Loss: 0.08038 m (App recalculation)
- Pipe Suction - Minor Loss: 2.535154 m (App recalculation)
- Pipe Suction - Total Head Loss: 2.615534 m (App recalculation)
- Pipe Suction - Total K: 14.670755 (Direct K plus equivalent K)
- Pipe Suction - Primary Re: 224717 (App recalculation)
- Pipe Suction - Darcy f: 0.02279245 (Colebrook/app basis)
- Pipe Suction - eps/D: 0.00153061 (roughness / diameter)
- Pipe Discharge - Major Loss: 1.756237 m (App recalculation)
- Pipe Discharge - Minor Loss: 9.912272 m (App recalculation)
- Pipe Discharge - Total Head Loss: 11.668509 m (App recalculation)
- Pipe Discharge - Total K: 18.447708 (Direct K plus equivalent K)
- Pipe Discharge - Primary Re: 298404.7 (App recalculation)
- Pipe Discharge - Darcy f: 0.02412174 (Colebrook/app basis)
- Pipe Discharge - eps/D: 0.00203252 (roughness / diameter)
- Pipe Segment reconciliation: PIPE-2 now stores the discharge elbows as 4 long-radius elbows from Table 3 plus 2 calculation-only elbows from the detailed loss equation. This keeps the visible input faithful to the table while retaining the published six-elbow loss basis.
- Suction elbow note: Table 2 describes one 45 deg long-radius 4 in elbow; the detailed calculation applies K = 0.27, so PIPE-1 keeps K = 0.27 and documents the table/calculation wording difference.

## Pump dan NPSH

- Elevation: 0 m (.untirta P-100)
- Suction Nozzle Elev.: -0.5 m (.untirta P-100)
- Discharge Nozzle Elev.: 0 m (.untirta P-100)
- Hydraulic NPSH Status: Safe (NPSHa > NPSHr check)
- Engineering Status: Safe (Application NPSH evaluation)
- Data Confidence: Warning: Manual - verify vendor data (Manual NPSHr / engineering-fit curve)
- Flow Evaluated: 50 m3/h (SNK-100 flow demand)
- Pump Head: 24 m (Network required head)
- NPSHa / NPSHr: 6.4656 / 2.4002 m (Application NPSH evaluation)
- NPSHr Source: Manual input (Manual input from journal)
- NPSH Margin / Ratio: 4.0654 m / 2.6938 (NPSHa - NPSHr; NPSHa/NPSHr)
- Required NPSHa / NPSH Excess: 3.0002 m / 3.4654 m (App margin basis)
- Suction Pressure: 1.622 bar a (Calculated at pump suction)
- Suction Loss: 2.6155 m (Application suction pipe total)
- Dominant Loss: PIPE-1 journal-calibrated suction loss; largest suction segment PIPE-1-Seg-3 Globe valve 3 in equivalent = 1.0541 m (Application diagnostic)

## Optimize Pump From Network

- Workflow Status: Proposal Ready; readiness Ready
- Target flow: 50 m3/h
- Required system head: 24 m
- NPSHa at design: 6.466 m
- Max allowable NPSHr: 3.662 m
- Proposed NPSHr: 3.479 m
- Worst AOR point: 65 m3/h at 130% BEP, NPSHa 4.662 m
- Keputusan audit: proposal dicatat, tetapi input jurnal NPSHr = 2.4002 m tetap dipertahankan.

## SNK dan Calculated Outlet Readout

- SNK - Flow Demand: 50 m3/h (.untirta SNK-100)
- SNK - Pressure Basis: Static (.untirta SNK-100)
- SNK - Reference Pressure: 1.743707129 bar a (Equivalent closure)
- SNK - SNK Elevation: 10 m (.untirta SNK-100)
- Outlet Readout - Boundary Mode: Flow Demand Boundary (Calculated Outlet Readout)
- Outlet Readout - Boundary Pressure Input: 1.744 bar a (Calculated Outlet Readout)
- Outlet Readout - Boundary Abs. Pressure: 1.743707129 bar a (Calculated Outlet Readout)
- Outlet Readout - Pressure Head: 18.5473 m (P/(rho g))
- Outlet Readout - Discharge Loss: 11.668509 m (App discharge pipe total)
- Outlet Readout - Terminal Velocity Head: 0.537317 m (V2/(2g))
- Outlet Readout - SNK Hydraulic Head: 29.0846 m (Pressure head + elevation + velocity head)
- Outlet Readout - Flow Rate: 50 m3/h (Calculated Outlet Readout)
- Outlet Readout - Mass Flow: 47917.419 kg/h (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Static P: 1.744 bar a (Calculated Outlet Readout)
- Outlet Readout - Pipe Endpoint Stagnation P: 1.794 bar a (Calculated Outlet Readout)
- Outlet Readout - Required Boundary P: 1.744 bar a (Calculated Outlet Readout)
- Outlet Readout - Vapor Pressure: 1.01418 bar a (Fluid Basis)
- Outlet Readout - Vapor Margin: 0.729527 bar (7.7598 m) (Boundary pressure - vapor pressure)

## Formula Utama

- Density from specific weight: `rho = gamma / g = 9400 / 9.81 = 958.2059 kg/m3 journal-derived basis`
- Dynamic viscosity: `mu = rho x nu; app: 958.3483836 x 8.03e-7 = 0.000769554 Pa.s = 0.769554 cP`
- Vapor pressure head: `Hv = Pv x 100000 / (rho x g)`
- Reynolds number: `Re = V D / nu`
- Relative roughness: `eps/D = pipe roughness / internal diameter`
- Darcy-Weisbach major loss: `h_major = f (L / D) (V^2 / 2g)`
- Minor loss: `h_minor = K (V^2 / 2g)`
- System head closure: `H_required = H_discharge boundary - H_suction boundary + hL_suction + hL_discharge = 29.085 - 19.369 + 2.616 + 11.669 = 24.000 m`
- NPSHa: `NPSHa = H_suction boundary - hL_suction - z_pump - H_vapor = 19.369 - 2.616 - (-0.500) - 10.788 = 6.466 m`
- NPSH acceptance: `Safe when NPSHa > NPSHr and NPSHa >= Required NPSHa; 6.4656 > 2.4002 and 6.4656 > 3.0002`
- NPSH margin and ratio: `Margin = NPSHa - NPSHr = 4.0654 m; Ratio = NPSHa / NPSHr = 2.6938`
- Pump power: `P = gamma Q H / eta. Table 8 uses gamma=9400 N/m3, Q=0.0139 m3/s, H=24 m, eta=0.62 -> 5.0578 kW.`
- Error percent: `errorPercent = ABS(application - journal) / ABS(journal) x 100%`
- Optimize Pump From Network: `Proposal uses current SRC -> suction pipe -> pump -> discharge pipe -> SNK network to calculate target flow, required head, NPSHa, allowable NPSHr, and AOR envelope.`
- Journal pump efficiency caveat: `Case 1 uses eta = 62%. Abstract power follows exact H = 23.8178 m, while Table 8/app duty follows rounded H = 24 m.`
- Dynamic report source: `Analysis Report = detailed static report JSON + decoded .untirta validationAudit/model/results at open time; static Case 1 formulas override generic dynamic caveats by name.`

## Caveat Yang Harus Siap Dijawab

- Hydraulic NPSH Status = Safe comes from NPSHa > NPSHr: 6.4656 m > 2.4002 m. This is an engineering inequality, not a manual label.
- Engineering Status = Safe because the selected margin basis is satisfied: Required NPSHa is 3.0002 m and available NPSHa is 6.4656 m.
- Data Confidence remains Warning because NPSHr is a manual journal value and the full manufacturer/test pump curve is not published.
- The journal Table 3 lists four discharge elbows, but the calculation section uses six elbows. The model now shows this explicitly as four table elbows plus two calculation-only elbows.
- The journal has two arithmetic/typing caveats in pipe losses: the suction subtotal is printed once as 2.6393 m even though the terms sum to 2.6303 m, and the discharge sudden-change line prints 2.9873 m while the published discharge total uses 2.9047 m.
- The journal NPSHa substitution line contains hs/unit inconsistency. The published final NPSHa 6.4656 m is retained and documented as the validation target.
- Pipe-loss deviations are small and explainable by exact Q = 50/3600 m3/s, exact pi, g = 9.81 m/s2, and app Colebrook/friction implementation.
- Optimize Pump From Network proposes NPSHr = 3.479 m as a margin-envelope candidate; the model retains journal NPSHr = 2.4002 m for literature matching.

## Kesimpulan

The simulation case is conditionally validated for academic/engineering defense. The main duty point, pipe-loss basis, and NPSH result match the journal within traceable rounding/equivalent-boundary assumptions. The only non-direct inputs are SRC/SNK equivalent pressures and non-duty pump-curve placeholders, both explicitly documented.
