# Frontend File Manifest

Date: 2026-06-03

Folder:

```text
C:\Users\Zfaryana\Desktop\npshs\npsh-frontend
```

Purpose:

- Protected public static package for `https://npsh.virsim.id/`.
- Requires the private same-origin API at `https://npsh.virsim.id/api/*`, proxied by `_worker.js` to the `NPSH_API` Service Binding.

Summary:

```text
Total files: 157
Total size: 63,522,387 bytes
```

Top-level contents:

```text
.gitignore              upload guardrail
.nojekyll               compatibility marker for static hosts
CNAME                   custom domain: npsh.virsim.id
_worker.js              Cloudflare Pages advanced-mode proxy for /api/* and static assets
DEPLOYMENT.md           frontend deployment runbook
FILE_MANIFEST.md        local folder inventory
README.md               public package overview
UPLOAD_READINESS.md     readiness checklist
index.html              static app entry
seo.metadata.json       data-driven academic SEO metadata source
tools/                  static metadata rendering and validation utilities
app.bundle.min.js       protected frontend bundle
app.bundle.min.js.map   public-safe self source map stub, no sourcesContent
engineering-npsh-margin-runtime.js public-safe ANSI/HI NPSH margin preset bridge used by Pump Object Properties readouts
engineering-pump-readiness-visibility-runtime.js public-safe final-defense guard that hides developer Pump Action Readiness diagnostics unless debug flag is enabled
engineering-bilingual-improvements.js bilingual engineering terminology, trace-key registry, runtime UI workflow localization, and diagnostics overlay
engineering-library-governance.js public-safe library manifest, trace schema, unit/fluid/equipment/literature governance, OCR terminology, formula-literature map, and quality gates
engineering-route-trace-audit.js public-safe backend route-trace audit bridge, dependency fingerprint handoff, stale-result metadata capture, advanced engineering validation display, defense export context capture, backend schema mismatch warning, and software dependency-change gate display
engineering-defense-export-package.js public-safe one-click defense report exporter, UI evidence registry, task-window evidence badges, redacted audit event handoff, and print/save PDF workflow
engineering-pump-formula-defense-live-audit.js public-safe live Pump Formula Defense badges, trace-row source/literature notes, and protected backend refresh bridge for advisor-facing pump NPSH evidence
engineering-pump-performance-chart-audit.js public-safe pump performance chart audit guard that suppresses fallback/duty-point fit curves, keeps no-data charts visually clean, requires sourced curve data, and redraws eligible curves on log-log axes
engineering-pump-performance-canonical-chart.js public-safe operational chart renderer that uses solver-owned performanceChartData before legacy chart arrays or pump props
style.min.css           minified styles
png/                    public images and favicon
toolbar/                public toolbar icons
vendor/                 browser libraries for PDF/OCR/export
journals/               public case data, analysis reports, and audit summaries
tools/validate-pump-performance-chart-audit.cjs Node validation for chart data eligibility, log-log audit contract, and cache-busted runtime load
```

Protected-bundle guardrail:

```text
calculatePumpSystemHead: 0
calculateDarcy: 0
calculateReynolds: 0
hydraulic-network-formulas: 0
pump-formulas: 0
pipe-formulas: 0
```

Release integrity guardrail:

```text
node npsh-api/tools/release-integrity-audit.cjs
app.bundle.min.js.map sourcesContent: absent
Route audit cache key: engineering-route-trace-audit.js?v=20260602-route-audit-contract1
Defense export cache key: engineering-defense-export-package.js?v=20260531-defensev2
Runtime API config: same-origin /api/simulate
NPSH margin runtime cache key: engineering-npsh-margin-runtime.js?v=20260602-npsh-margin1
Pump readiness visibility cache key: engineering-pump-readiness-visibility-runtime.js?v=20260602-pump-readiness-visibility2
Pump formula defense live audit cache key: engineering-pump-formula-defense-live-audit.js?v=20260602-pump-defense-live11
Pump performance chart audit cache key: engineering-pump-performance-chart-audit.js?v=20260603-pump-chart-audit9
Pump performance canonical chart cache key: engineering-pump-performance-canonical-chart.js?v=20260603-canonical-chart1
Pages API proxy: _worker.js -> env.NPSH_API.fetch(request), static fallback -> env.ASSETS.fetch(request)
```

Do not add to this folder:

- backend formula source
- `core/simulation-engine.js`
- `.env`
- source maps with source content
- unbundled frontend source files
- public PDF files
- private keys or certificates
- local logs or test outputs
- `desktop.ini`
