# Frontend File Manifest

Date: 2026-06-10

Folder:

```text
C:\Users\Zfaryana\Desktop\npshs\npsh-frontend
```

Purpose:

- Protected public static package for `https://npsh.virsim.id/`.
- Requires the private same-origin API at `https://npsh.virsim.id/api/*`, proxied by `_worker.js` to the `NPSH_API` Service Binding.

Summary:

```text
Total files: 280
Total size: 72,193,823 bytes
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
package.json            frontend npm scripts and dev-tool dependency declarations
package-lock.json       locked npm dependency graph for Playwright E2E and local KaTeX equation rendering
playwright.config.cjs   browser E2E configuration for same-origin preview:api testing
index.html              static app entry
seo.metadata.json       data-driven academic SEO metadata source
tools/                  static metadata rendering and validation utilities, including local preview support for /api/literature PDF range reads from the sibling book_pdf folder
tests/                  Playwright browser E2E coverage for realtime SINK backend recalculation, Moody/defense gates, Pipe Segments local file import/export, and Formula Defense UI visibility/rendering
app.bundle.min.js       protected frontend bundle
app.bundle.min.js.map   public-safe self source map stub, no sourcesContent
engineering-npsh-margin-runtime.js public-safe ANSI/HI NPSH margin preset bridge used by Pump Object Properties readouts
engineering-pump-readiness-visibility-runtime.js public-safe final-defense guard that hides developer Pump Action Readiness diagnostics unless debug flag is enabled, including late DOM insertion pruning
engineering-bilingual-improvements.js bilingual engineering terminology, trace-key registry, runtime UI workflow localization, and diagnostics overlay
engineering-library-governance.js public-safe library manifest, trace schema, unit/fluid/equipment/literature governance, OCR terminology, formula-literature map, and quality gates
engineering-route-trace-audit.js public-safe backend route-trace audit bridge, dependency fingerprint handoff, stale-result metadata capture, default-hidden canvas route-trace plus pump/SNK presentation-row display lock, SNK Boundary Mode canonical canvas/tooltip/readout lock, Free Outlet/Outlet Pressure demand-ignore property window lock, atmospheric outlet pressure assumption readout, SNK evaluated flow display, SNK Sink Flow/Sink P abs/Sink Elev./Sink Head canvas readouts, pump/SNK object-hover synchronization, idempotent canvas observer pruning, calculation defense contract handoff, advanced engineering validation display, defense export context capture, backend schema mismatch warning, and software dependency-change gate display
engineering-realtime-calculation-defense.js public-safe realtime stale/calculating/freshness bridge that marks calculation results stale immediately when object-property inputs change, autosolves trusted user edits through the protected backend, and refreshes linked report/task-window views after backend completion
engineering-browser-issues-runtime.js public-safe browser Issues cleanup bridge for ARIA menu ownership, empty-menu role removal, and dynamic toolbar object-menu role repair
engineering-pipe-segments-file-runtime.js public-safe Pipe Segments local `.v1` import/export bridge with compact table controls, schema validation, browser download/upload handling, and stale-result marking after import
engineering-formula-defense-ui.js public-safe Formula Defense UI bridge for compact responsive Pipe Formula Defense layout, Source & Confidence Map/table wrapping with normal light code text, KaTeX equation rendering on normal light equation surfaces with dark text, WCAG AA contrast, dependency chain visualization, open-window refresh after realtime recalculation, and debounced realtime input handling
engineering-decimal-display-runtime.js public-safe live readout decimal lock and click-guard bridge for pump parameter cards
engineering-parameter-task-runtime.js public-safe hidden pump Status/Suction/Discharge task-window defense notes with route-trace formulas for oral examination answers and refresh support for open parameter windows after realtime solves
engineering-local-trace-fallback-runtime.js public-safe local route-trace fallback that keeps Pump Status connected, current, and schema-complete when the protected backend is not reachable in local preview; preserves Calculating during in-flight protected backend solves
engineering-pipe-canvas-hydraulic-label-runtime.js public-safe compact Pipe/Fitting/Valve canvas label bridge that suppresses the old delta-P-only SVG label and replaces it with live P1-to-P2, velocity, total K, major loss, and minor loss readouts formatted to 3 decimals from current pipe results/calculation trace without changing calculation data
engineering-pipe-source-confidence-map-runtime.js public-safe Pipe Formula Defense source-confidence bridge that restores the Source & Confidence Map rows when pipe calculation trace fallback data contains an empty sourceMap, preserving current pipe calculations and live pressure/profile evidence
engineering-analysis-report-live-runtime.js public-safe Analysis Report live-link bridge that refreshes existing comparison and application-value report table cells from current Fluid Basis, canonical pipe trace totals, pump NPSH/system-head results, SNK/outlet readouts, and backend/local calculation context without rebuilding report layout; also installs scoped responsive wrapping for long report formula/route-trace text
engineering-canvas-context-dock.js public-safe responsive Fluid Basis and Route Trace dock for the PFD canvas, including default-collapsed audit details, sticky canvas viewport positioning, mobile compact lock, mobile symbol mode, stale/current freshness display, route breadcrumb focus, audit metadata handoff, global canvas select/context-menu guard, and explicit User Task Object Properties command-only open policy
engineering-defense-export-package.js public-safe one-click defense report exporter, calculation defense contract evidence, UI evidence registry, task-window evidence badges, redacted audit event handoff, and print/save PDF workflow
engineering-pipe-moody-chart-audit.js public-safe pipe Moody chart visual audit overlay that stays hidden until explicitly opened, separates overlapped markers, exposes all overlapped element names in tooltip/list evidence, and adds dimensionless Aging Roughness Factor help text
engineering-pump-formula-defense-live-audit.js public-safe live Pump Formula Defense badges, trace-row source/literature notes, and protected backend refresh bridge for advisor-facing pump NPSH evidence
engineering-pump-performance-chart-audit.js public-safe pump performance chart audit guard that suppresses fallback/duty-point fit curves, keeps no-data charts visually clean, requires sourced curve data, and redraws eligible curves on log-log axes
engineering-pump-performance-canonical-chart.js public-safe operational chart renderer that uses solver-owned performanceChartData before legacy chart arrays or pump props
engineering-google-auth-runtime.js public-safe Google Identity Services frontend bridge that renders a sign-in control, sends ID tokens to the backend, immediately verifies the HttpOnly app session, prevents stale session refresh overwrite after login, exposes NPSHAuth.requireApproved and NPSHAuth.diagnose, maps backend auth error codes into actionable messages, and keeps approved/pending status visible
engineering-literature-pdf-viewer.js public-safe Literature task-window viewer that adds Help -> Literature, requires an approved Google app session, translates protected PDF auth/approval/source failures into actionable messages, retries pending PDFs after approved auth, renders private book_pdf PDFs through the same-origin API with PDF.js canvas pages, zoom/page controls, no visible source links, and user-resizable window sizing
engineering-live-parameter-repaint-lock.css public-safe live canvas parameter paint-lock override that removes transient Solve repaint shadows from parameter cards, pump status badge, and pump status icon glow
style.min.css           minified styles
png/                    public images and favicon
toolbar/                public toolbar icons
vendor/                 browser libraries for PDF/OCR/export and local KaTeX static equation assets
journals/               public case data, analysis reports, audit summaries, and current-system case review evidence
tools/validate-pump-performance-chart-audit.cjs Node validation for chart data eligibility, log-log audit contract, and cache-busted runtime load
tools/validate-route-trace-default-lock.cjs Node validation for default-hidden canvas route-trace overlays, pump-summary route-trace/vapor-pressure lock, SNK presentation-row lock, SNK Sink Flow/Sink Elev./Sink Head readouts, audit/debug unlock APIs, and cache-busted runtime load
tools/validate-sink-boundary-mode-canvas-lock.cjs Node validation for SNK Boundary Mode canonical canvas/tooltip/readout values, stale result override, null-panel hover guard, free-outlet atmospheric pressure/head calculation, and cache-busted runtime load
tools/validate-global-live-indicator-engine-link.cjs Node validation for Global live indicator engine-link validation across all six UNTIRTA simulations, including SRC/SNK/pump canvas readouts, hover/title backup synchronization, engine-result hooks, realtime decimal locks, and cache-busted runtime load
tools/validate-canvas-context-dock.cjs Node validation for default-collapsed Fluid Basis dock behavior, sticky canvas viewport positioning, mobile compact lock, responsive Fluid Basis symbols, route trace source preference, stale freshness display, and cache-busted runtime load
tools/validate-live-parameter-repaint-lock.cjs Node validation for locked live parameter repaint CSS, cache key, opaque backgrounds, no panel/badge shadow, and pump icon outline-only status display
tools/validate-export-canvas-snapshot-lock.cjs Node validation for silent normal export canvas fallback, retained real-failure warning, and stable manual renderer snapshot path
tools/validate-literature-pdf-viewer.cjs Node validation for Help -> Literature flyout, approved Google app-session guard, auth-approved PDF retry, local PDF.js canvas viewer, zoom/page controls, same-origin literature API, resizable task window, and no private GitHub source links in public runtime
tools/validate-google-auth-runtime.cjs Node validation for Google Identity Services runtime wiring, backend auth endpoints, post-login session verification, stale-session overwrite prevention, credentialed session fetches, approved-session guard, and cache-busted runtime load
tools/validate-pump-readiness-visibility-lock.cjs Node validation for late-added developer Pump Action Readiness panel hiding, childList-only observer scope, cache-busted runtime load, and manifest lock
tools/validate-browser-issues-runtime.cjs Node validation for browser Issues cleanup: ARIA menu repair, CSS compatibility property cleanup, static header normalization, and cache-busted runtime load
tools/validate-pipe-segments-file-runtime.cjs Node validation for Pipe Segments local `.v1` schema, filename convention, compact import/export controls, cache-busted runtime load, and stale-result marking
tools/validate-formula-defense-ui.cjs Node validation for compact Pipe Formula Defense layout, Source & Confidence Map responsive table/plain formula contract, Formula Defense UI KaTeX rendering, WCAG contrast, dependency chain visualization, cache-busted runtime load, and realtime refresh/debounce
tools/validate-pipe-canvas-hydraulic-label.cjs Node validation for Pipe/Fitting/Valve canvas hydraulic label runtime loading, 3-decimal display contract, symbolic row labels, cache key, npm script, and manifest lock
tools/validate-pipe-source-confidence-map.cjs Node validation for Pipe Formula Defense Source & Confidence Map restoration, pump path role inference, pressure-profile evidence, cache key, npm script, and manifest lock
tools/validate-analysis-report-live-runtime.cjs Node validation for Analysis Report live-link runtime loading, existing-table cell refresh behavior including bilingual headers and TH metric rows, Simulasi 1 Fluid/Pipe/Pump/SNK metric mapping, cache key, npm script, and manifest lock
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
App bundle cache key: app.bundle.min.js?v=20260608-global-ribbon-placement-lock5
Main style cache key: style.min.css?v=20260608-browser-issues1
Bilingual terminology runtime cache key: engineering-bilingual-improvements.js?v=20260607-sink-mode-trace1
Source canvas parameter runtime cache key: engineering-src-canvas-parameter-runtime.js?v=20260607-src-flow-basis2
Decimal display runtime cache key: engineering-decimal-display-runtime.js?v=20260609-pump-live-readout-click-lock2
Parameter Task runtime cache key: engineering-parameter-task-runtime.js?v=20260611-parameter-blocks3
Local trace fallback runtime cache key: engineering-local-trace-fallback-runtime.js?v=20260611-local-trace3
Pipe canvas hydraulic label runtime cache key: engineering-pipe-canvas-hydraulic-label-runtime.js?v=20260611-pipe-canvas-hydraulic-label4
Pipe source confidence map runtime cache key: engineering-pipe-source-confidence-map-runtime.js?v=20260611-pipe-source-confidence-map1
Analysis Report live runtime cache key: engineering-analysis-report-live-runtime.js?v=20260611-analysis-report-live4
Route audit cache key: engineering-route-trace-audit.js?v=20260607-snk-boundary-mode-lock8
Realtime calculation defense cache key: engineering-realtime-calculation-defense.js?v=20260611-realtime-global1
Browser issues runtime cache key: engineering-browser-issues-runtime.js?v=20260608-browser-issues1
Pipe Segments file runtime cache key: engineering-pipe-segments-file-runtime.js?v=20260608-pipe-segments-file1
Formula Defense UI runtime cache key: engineering-formula-defense-ui.js?v=20260611-formula-defense-ui4
Formula Defense UI KaTeX CSS cache key: vendor/katex/katex.min.css?v=20260611-formula-defense-ui4
Canvas context dock cache key: engineering-canvas-context-dock.js?v=20260608-browser-issues2
Defense export cache key: engineering-defense-export-package.js?v=20260603-defensev3
Pipe Moody chart audit cache key: engineering-pipe-moody-chart-audit.js?v=20260607-pipe-moody-audit2
Runtime API config: same-origin /api/simulate
NPSH margin runtime cache key: engineering-npsh-margin-runtime.js?v=20260602-npsh-margin1
Pump readiness visibility cache key: engineering-pump-readiness-visibility-runtime.js?v=20260607-pump-readiness-visibility3
Pump formula defense live audit cache key: engineering-pump-formula-defense-live-audit.js?v=20260602-pump-defense-live11
Pump performance chart audit cache key: engineering-pump-performance-chart-audit.js?v=20260603-pump-chart-audit9
Pump performance canonical chart cache key: engineering-pump-performance-canonical-chart.js?v=20260603-canonical-chart2
Google auth runtime cache key: engineering-google-auth-runtime.js?v=20260609-google-access7
Literature PDF viewer cache key: engineering-literature-pdf-viewer.js?v=20260609-literature-access3
Live parameter repaint lock cache key: engineering-live-parameter-repaint-lock.css?v=20260605-live-param-repaint-lock1
Live parameter repaint lock validation: npm run validate:live-parameter-repaint-lock
Export canvas snapshot validation: npm run validate:export-canvas-snapshot-lock
Literature PDF viewer validation: npm run validate:literature-pdf-viewer
Google auth runtime validation: npm run validate:google-auth-runtime
SNK boundary mode canvas lock validation: npm run validate:sink-boundary-mode-canvas-lock
Pump readiness visibility validation: npm run validate:pump-readiness-visibility-lock
Browser issues runtime validation: npm run validate:browser-issues-runtime
Pipe Segments file runtime validation: npm run validate:pipe-segments-file-runtime
Formula Defense UI validation: npm run validate:formula-defense-ui
Pipe canvas hydraulic label validation: npm run validate:pipe-canvas-hydraulic-label
Pipe source confidence map validation: npm run validate:pipe-source-confidence-map
Analysis Report live runtime validation: npm run validate:analysis-report-live-runtime
Pages API proxy: _worker.js -> env.NPSH_API.fetch(request), optional X-NPSH-API-Proxy-Secret from env.NPSH_API_PROXY_SECRET, static fallback -> env.ASSETS.fetch(request)
Local static preview literature fallback: tools/serve-local-preview.cjs serves /api/literature and /api/literature/:id/pdf from ../book_pdf with byte-range PDF support
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
