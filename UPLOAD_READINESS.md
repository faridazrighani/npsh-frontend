# Upload Readiness - npsh-frontend

Status: READY for same-origin public-asset deployment after the private backend application service is deployed and final user approval is given.

Local freeze: recorded in `../LOCAL_FREEZE_2026-05-28.md`.

This folder is now a protected static frontend package. The displayed hydraulic/NPSH result is expected to come from the private backend API, and the protected public bundle omits the local object-formula solver.

Checks passed:

- No `.env`, source-content `.map`, `.pem`, `.key`, `.log`, or similar sensitive artifact was found.
- Public metadata points to `https://npsh.virsim.id/`.
- Runtime API config uses same-origin `/api/simulate` in backend-primary protected mode.
- Required public assets are present: `index.html`, `app.bundle.min.js`, `engineering-npsh-margin-runtime.js`, `engineering-pump-readiness-visibility-runtime.js`, `engineering-live-parameter-repaint-lock.css`, `style.min.css`, `png/favicon.ico`, `vendor/`, `journals/`, and `toolbar/`.
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
