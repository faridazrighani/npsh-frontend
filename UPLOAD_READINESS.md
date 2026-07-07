# Upload Readiness - npsh-frontend

Status: READY for same-origin public-asset deployment after the private backend application service is deployed and final user approval is given.

Local freeze: recorded in `../LOCAL_FREEZE_2026-05-28.md`.

This folder is now a protected static frontend package. The displayed hydraulic/NPSH result is expected to come from the private backend API, and the protected public bundle omits the local object-formula solver.

Checks passed:

- No `.env`, source-content `.map`, `.pem`, `.key`, `.log`, or similar sensitive artifact was found.
- Public metadata points to `https://npsh.virsim.id/`.
- Runtime API config uses same-origin `/api/simulate` in backend-primary protected mode.
- Required public assets are present: `index.html`, `app.bundle.min.js`, `engineering-npsh-margin-runtime.js`, `engineering-pump-readiness-visibility-runtime.js`, `engineering-live-parameter-repaint-lock.css`, `engineering-live-parameter-stable-runtime.js`, `engineering-pipe-canvas-hydraulic-label-runtime.js`, `engineering-pipe-source-confidence-map-runtime.js`, `style.min.css`, `png/favicon.ico`, `vendor/`, `journals/`, and `toolbar/`.
- Custom-domain file is present: `CNAME` -> `npsh.virsim.id`.
- Deployment runbook is present: `DEPLOYMENT.md`.
- Pages advanced-mode proxy is present: `_worker.js` forwards `/api/*` to the `NPSH_API` Service Binding and serves static assets through `env.ASSETS`.
- Protected bundle scan did not detect `hydraulic-network-formulas`, `pump-formulas`, `pipe-formulas`, `calculatePumpSystemHead`, `calculateDarcy`, or `calculateReynolds`.
- Phase 5 local freeze validation passed.
- The general reference PDF collection was moved out of the public frontend package to the local private reference archive.
- Public PDF content is reduced to zero files.
- The six simulation-case source PDFs were moved out of the public package to the local private reference archive.
- Unbundled toolbar source files and Windows `desktop.ini` noise were moved out of the public package.
- Live parameter repaint-lock validation passed and must stay part of the frontend validation set.
- Pipe/Fitting/Valve canvas hydraulic label validation passed and must stay part of the frontend validation set.
- Pump envelope warning cleanup validation passed and must stay part of the frontend validation set; pump performance/envelope/BEP/design-duty warnings are sanitized from pump results and the canvas Warnings panel while hydraulic NPSH warnings remain visible.
- Pipe Formula Defense source-confidence map validation passed and must stay part of the frontend validation set.
- Formula Defense UI compact/reference-width responsive/resizable layout and academic pipe trace content validation passed and must stay part of the frontend validation set.
- Export canvas snapshot fallback is locked to stay silent during normal XLSX/PDF export.
- Fluid Basis workspace Model Snapshot export validation passed and must stay part of Menu -> File -> Export validation; PDF Model Snapshot starts from the visible Fluid Basis/Route dock and continues into the native/original canvas capture so live Pipe/Fitting/Valve parameter labels remain included.
- Export equation professional PDF-only validation passed and must stay part of Menu -> File -> Export PDF validation; PDF data is refreshed/sanitized against the active topology so reduced suction-only routes do not leak stale discharge/SNK report steps, PDF Fluid Basis includes the Pressure-enthalpy phase chart SVG discussion, PDF Moody Chart replaces the old native image/table with the compact Log-Log Moody Chart friction-factor visual and fixed segment-card copy columns, Pump Performance Chart/Curve content is removed, Excel remains on its separate original path, and DOCX is hidden from the menu.
- Open-file readiness gate validation passed and must stay part of Menu -> File -> Open validation; `.untirta` files keep the canvas hidden until reading, validation, hydraulic result application, pipe/fitting/valve labels, and pump-panel cleanup are ready.
- Simulation Cases 6 is enabled and locked as the P-2941A hot-water pump validation fixture; its `.untirta` payload is synchronized from Papah-sim-6, migrated to the current Pipe Properties layout, and mirrored consistently for frontend/API public paths.
- Simulation Load Transaction Manager validation passed and must stay part of Menu -> File -> Open and Simulation Case validation; every file/case load gets a session token, stale file/fetch/body reads are abort-guarded, selected runtime/case assets are warm-cached, and transient warning/route-trace UI is cleaned before the next model is applied.

Important dependency:

- The `npsh-frontend` Cloudflare Pages production environment must bind `NPSH_API` to the `npsh-api` Worker before public users can run protected calculations.
- Simulation-case PDF files are private-local only unless public redistribution is explicitly approved later.

Upload guidance:

- Prepare this folder into the backend `public/` static root with `npm --prefix npsh-api run build:same-origin`, or upload equivalent public artifacts to the same-origin application host.
- On Cloudflare Pages, add a production Service Binding named `NPSH_API` that points to Worker `npsh-api`, then redeploy this Pages project.
- Keep source maps with source content out of the public repository; only the public-safe `app.bundle.min.js.map` self-map stub is allowed.
- Keep PDF files out of the public repository unless rights/public redistribution are explicitly approved.
- Keep unbundled frontend source files out of this folder unless they are directly referenced by `index.html`.
- Keep `npsh-api` private.
