# Upload Readiness - npsh-frontend

Status: READY for same-origin public-asset deployment after the private backend application service is deployed and final user approval is given.

Local freeze: recorded in `../LOCAL_FREEZE_2026-05-28.md`.

This folder is now a protected static frontend package. The displayed hydraulic/NPSH result is expected to come from the private backend API, and the protected public bundle omits the local object-formula solver.

Checks passed:

- No `.env`, source-content `.map`, `.pem`, `.key`, `.log`, or similar sensitive artifact was found.
- Public metadata points to `https://npsh.virsim.id/`.
- Runtime API config uses same-origin `/api/simulate` in backend-primary protected mode.
- Required public assets are present: `index.html`, `app.bundle.min.js`, `style.min.css`, `png/favicon.ico`, `vendor/`, `journals/`, and `toolbar/`.
- Custom-domain file is present: `CNAME` -> `npsh.virsim.id`.
- Deployment runbook is present: `DEPLOYMENT.md`.
- Protected bundle scan did not detect `hydraulic-network-formulas`, `pump-formulas`, `pipe-formulas`, `calculatePumpSystemHead`, `calculateDarcy`, or `calculateReynolds`.
- Phase 5 local freeze validation passed.
- The general reference PDF collection was moved out of the public frontend package to the local private reference archive.
- Public PDF content is reduced to zero files.
- The six simulation-case source PDFs were moved out of the public package to the local private reference archive.
- Unbundled toolbar source files and Windows `desktop.ini` noise were moved out of the public package.

Important dependency:

- The same-origin private application service must serve both `/` and `/api/*` before public users can run protected calculations.
- Simulation-case PDF files are private-local only unless public redistribution is explicitly approved later.

Upload guidance:

- Prepare this folder into the backend `public/` static root with `npm --prefix npsh-api run build:same-origin`, or upload equivalent public artifacts to the same-origin application host.
- Keep source maps with source content out of the public repository; only the public-safe `app.bundle.min.js.map` self-map stub is allowed.
- Keep PDF files out of the public repository unless rights/public redistribution are explicitly approved.
- Keep unbundled frontend source files out of this folder unless they are directly referenced by `index.html`.
- Keep `npsh-api` private.
