# Frontend File Manifest

Date: 2026-06-19

Folder:

```text
C:\Users\Zfaryana\Desktop\npshs\npsh-frontend
```

Purpose:

- Protected public static package for `https://npsh.virsim.id/`.
- Requires the private same-origin API at `https://npsh.virsim.id/api/*`, proxied by `_worker.js` to the `NPSH_API` Service Binding.

Summary:

```text
Total files: 262
Total size: 68,167,807 bytes
```

Inventory scope excludes `.git`, `node_modules`, `test-artifacts`, nested local workspace copies, and local preview log files.

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
llms.txt                concise agent-readable Markdown overview for Lighthouse Agentic Browsing and browser agents
robots.txt              public crawler policy
sitemap.xml             canonical URL inventory
package.json            frontend npm scripts and dev-tool dependency declarations
package-lock.json       locked npm dependency graph for Playwright E2E and local KaTeX equation rendering
playwright.config.cjs   browser E2E configuration for same-origin preview:api testing
index.html              static app entry
seo.metadata.json       data-driven academic SEO metadata source
tools/                  static metadata rendering and validation utilities, including local preview support for /api/literature PDF range reads from the sibling book_pdf folder
tests/                  Playwright browser E2E coverage for realtime SINK backend recalculation, Moody/defense gates, Pipe Segments local file import/export, Formula Defense UI visibility/rendering, live model-linked Pipe Formula Defense numeric refresh, and Pump Performance Chart backend-refresh fingerprints
app.bundle.min.js       protected frontend bundle
app.bundle.min.js.map   public-safe self source map stub, no sourcesContent
engineering-npsh-margin-runtime.js public-safe ANSI/HI NPSH margin preset bridge used by Pump Object Properties/readouts, including blank User Defined fallback to General Purpose criteria
engineering-pump-readiness-visibility-runtime.js public-safe final-defense guard that hides developer Pump Action Readiness diagnostics unless debug flag is enabled, including late DOM insertion pruning
engineering-bilingual-improvements.js bilingual engineering terminology, trace-key registry, runtime UI workflow localization including Validate / Refresh Evidence labels, diagnostics overlay, and legacy autosolve bridge disabled by default so realtime calculation defense remains the single autosolve owner
engineering-library-governance.js public-safe library manifest, trace schema, unit/fluid/equipment/literature governance, OCR terminology, formula-literature map, and quality gates
engineering-route-trace-audit.js public-safe backend route-trace audit bridge, dependency fingerprint handoff, stale-result metadata capture, default-hidden canvas route-trace plus pump/SNK presentation-row display lock, pump disconnected/incomplete status matrix display, Required Head-only pump readout, compact SNK property allowlist, SNK canonical canvas/tooltip/readout lock, atmospheric outlet pressure assumption readout, SNK evaluated flow display, SNK Sink Flow/Sink P abs/Sink Elev./Sink Head canvas readouts, pump/SNK object-hover synchronization, realtime autosolve-first empty-state guidance, idempotent canvas observer pruning, calculation defense contract handoff, advanced engineering validation display, defense export context capture, backend schema mismatch warning, and software dependency-change gate display
engineering-head-power-audit-guard.js public-safe backend/frontend result guard that prevents route-only Required/System Head, especially negative pressure-assisted head, and frontend local-trace fallback values without pump curve/performance evidence from leaking into legacy Actual Pump Head, Pump Head @ Flow, or pump power fields
engineering-simulation-case-integrity-guard.js public-safe sample-case canvas integrity guard that detects partial Simulasi 4 Methanol state where SRC/SNK loaded but pump/PFV route objects are missing, restores the validated .untirta sample, and re-renders missing canvas objects from current model state without changing Pump Properties layout
engineering-performance-refresh-governor.js public-safe UI-only refresh governor that debounces and coalesces heavy secondary task window, Formula Defense, Source Map, Pump Formula Defense, and Pump Chart repaint work; filters hidden windows, scopes refresh to only the pump dependency contract (Fluid Basis -> SRC -> suction PFV -> Pump -> discharge PFV -> SNK plus Pump Performance), skips full-document formula enhancement when no defense window is visible, skips unchanged formula rebuilds through trace signatures, and never mutates calculation data
engineering-pump-edit-fast-lane.js public-safe Pump Object Properties and compact Manual NPSHr task fast-lane runtime that classifies pump-only edits, updates local NPSH margin/ratio/status and pump chart preview without changing Pump Properties layout, keeps route-only NPSH/margin edits from filling Actual Pump Head or power from design/required head, and requests protected backend autosolve for Manual NPSHr and other fields whose connected-route NPSHa/status must be recalculated
engineering-realtime-calculation-defense.js public-safe realtime stale/calculating/freshness bridge that marks calculation results stale/calculating when object-property inputs or upstream dependency inputs change, exposes a global dependency-change bridge for Fluid Basis/SRC/pipe/sink route dependencies, covers persistent Object Properties surfaces including compact Manual NPSHr, autosolves trusted user edits and explicit dependency notifications through the protected backend as the primary calculation path with 240 ms input and 90 ms change debounce, carries sequence/request transaction metadata plus explicit realtime-input mode, records initial/final dependency fingerprints, emits superseded events without letting stale backend results overwrite newer input, exposes Failed when backend recalculation fails while keeping the last valid result visible, suppresses bootstrap/sample-menu Calculating status until explicit user calculation intent, treats Simulation Case browsing as menu-only, publishes canonical pumpHead as actual-only with requiredSystemHead separate, avoids heavy chart/linked-view refresh during typing, debounces linked-view refresh through the Performance Refresh Governor after backend completion, and refreshes linked report/task-window views from current backend results
engineering-source-volumetric-only-runtime.js public-safe Source Properties volumetric-only guard that locks SRC flow basis to Volumetric Flow, moves the editable Volumetric Flow field into Boundary Data, removes Source Definition/Source Type/Type Meaning and Flow Specification/Flow Input Mode/Mass Flow task rows, removes legacy SRC source-type context menu choices while keeping Object Properties/Connect/Delete Source, converts legacy Mass Flow mode sources into equivalent volumetric flow once, and keeps Mass Flow only as hidden derived data
engineering-suction-only-npsha-runtime.js public-safe suction-only NPSHa bridge that detects Fluid Basis/SRC to suction PFV to Pump routes without downstream Sink, fingerprints suction-side inputs to avoid repeated refreshes, requests one protected backend calculation when the suction fingerprint changes, hydrates SRC/PFV/Pump readouts from the current suction-side inputs when protected results do not repaint the canvas, applies Suction Only and Downstream Required readouts, refreshes PFV canvas hydraulic labels, and keeps Required Pump Head, Discharge Pressure, Actual Pump Head, and pump power unavailable until a downstream route exists
engineering-calculation-lifecycle-runtime.js public-safe lifecycle status bridge that unifies input-changed, preparing, waiting-debounce, calculating, applying-results, refreshing-evidence, current, and failed states from realtime calculation events and Validate/Refresh/Open Sample Case commands, separates realtime-input/menu-browse/sample-open/manual-solve modes, treats the manual command as Validate / Refresh Evidence while realtime autosolve remains primary, keeps Run/Validate commands passive during realtime input autosolve, only disables Run/Validate for manual/sample/evidence work, suppresses bootstrap calculating/applying and orphan evidence-refresh events while sample-case selection is idle, permits Refreshing evidence only for manual evidence refresh, and never mutates calculation data
engineering-calculation-progress-overlay.js public-safe non-blocking compact calculation progress overlay for manual Validate/Refresh/Open Sample Case/Simulation Case browse intent, suppresses overlay display for realtime input autosolve so input edits remain non-blocking, shows only Reading inputs for menu browsing, shows Reading/Solving/Updating for sample-open, reserves Refreshing evidence for manual evidence refresh, auto-hides on Current/fallback evidence completion, shows short failed-calculation fallback text for manual evidence runs, and never mutates model/results/traces/charts
engineering-browser-issues-runtime.js public-safe browser Issues cleanup bridge for ARIA menu ownership, empty-menu role removal, orphan form-field label cleanup, dynamic toolbar object-menu role repair, index-level Chromium DevTools metrics reporter guard validation, and critical mobile first-paint layout locks that prevent menu/ribbon/workspace CLS while the deferred stylesheet loads
engineering-pipe-properties-cleanup-runtime.js public-safe early Pipe Properties hard cleanup and stability guard that removes unsupported top-level Pipe Properties fields before visible paint/repaint, removes segment z columns, hooks calculation refresh mutations, and preserves Pipe Segment horizontal/body scroll during user input
engineering-pipe-segments-file-runtime.js public-safe Pipe Segments local `.v1` import/export bridge with compact table controls, schema validation, browser download/upload handling, stale-result marking after import, and cleanup-runtime scroll retention across Pipe Properties rerenders
engineering-formula-defense-ui.js public-safe Formula Defense UI bridge for npsh-untirta compact 700px Pipe Formula Defense sizing, Formula Sequence & Active Substitution with endpoint pressure trace, All Segment Calculation Trace academic step reconstruction from live pipe hydraulics, dropdown-derived compact Pipe size/Material/Fitting basis captions with audit tooltips, responsive Realtime Role Path and Pipe Fitting Valve Breakdown tables with normal-weight body values, Source & Confidence Map/table wrapping with normal light code text, KaTeX equation rendering on normal light equation surfaces with dark text plus benign text-space warning filtering, WCAG AA contrast, dependency chain visualization, scoped Performance Refresh Governor enhancement after realtime recalculation, and debounced realtime input handling
engineering-decimal-display-runtime.js public-safe live readout decimal lock and click-guard bridge for pump parameter cards
engineering-parameter-task-runtime.js public-safe hidden pump Status/Suction/Discharge task-window defense notes with route-trace formulas, effective NPSH margin criteria mapping, oral examination answers, and refresh support for open parameter windows after realtime solves
engineering-local-trace-fallback-runtime.js public-safe local route-trace fallback that keeps Pump Status connected, current, and schema-complete when the protected backend is not reachable in local preview; preserves Calculating during in-flight protected backend solves
engineering-pipe-canvas-hydraulic-label-runtime.js public-safe compact Pipe/Fitting/Valve canvas label bridge that suppresses the old delta-P-only SVG label and replaces it with live P1-to-P2, velocity, total K, major loss, and minor loss readouts formatted to 3 decimals from current pipe results/calculation trace, with pump-label-sized upright canonical canvas-anchor placement that stays in the same pipe-relative position on desktop and cellular viewports, and synchronous no-flicker refresh after solver/canvas redraws, without changing calculation data
engineering-canvas-fast-preview-runtime.js public-safe canvas fast-preview bridge that repaints Pump, Pipe/Fitting/Valve, and SNK live readouts on the next animation frame after input/dependency changes, uses current Fluid Basis properties and existing calculation traces, keeps disconnected pumps Incomplete/Unverified, updates Required Head only, and keeps the protected backend solve authoritative without calling updateSimulation
engineering-pipe-source-confidence-map-runtime.js public-safe Pipe Formula Defense source-confidence bridge that restores the Source & Confidence Map rows when pipe calculation trace fallback data contains an empty sourceMap, preserving current pipe calculations and live pressure/profile evidence
engineering-pump-nozzle-simplify-runtime.js public-safe pump properties simplification bridge that hides deprecated main Elevation and Discharge Nozzle Elev. inputs, non-actionable Pump Evaluation Mode/Input Readiness status rows, and redundant pump optimization proposal summary readouts, while relabeling suctionElevation as Pump Datum Elev. and retaining PFV pipe endpoint elevations as the active elevation source
engineering-analysis-report-live-runtime.js public-safe Analysis Report live-link bridge that refreshes existing comparison and application-value report table cells from current Fluid Basis, canonical/backend route trace pipe totals, pump NPSH/system-head results, SNK/outlet readouts, and backend/local calculation context without rebuilding report layout; refreshes only when an Analysis Report surface is visible, installs scoped responsive wrapping for long report formula/route-trace text, keeps route-only max allowable/manual NPSHr statuses calculated when the numbers are available, keeps Outlet Discharge Loss populated from backend routeTrace/systemHead fallbacks when pipe-object totals are absent, and adds an XLSX export button beside Case Status Summary that exports only Report Text and Journal vs Application Comparison sheets with UNTIRTA logo/header branding, formula-driven Error percentages, and numeric cleanup for trailing-dash values without changing calculation data
engineering-canvas-context-dock.js public-safe responsive Fluid Basis and Route Trace dock for the PFD canvas, including default-collapsed audit details, absolute canvas overlay positioning with scroll-viewport anchoring that keeps the dock stable during horizontal/vertical canvas scroll without pushing layout, mobile compact lock, mobile symbol mode, stale/current freshness display, route breadcrumb focus, audit metadata handoff, global canvas select/context-menu guard with left-click pipe properties menu and background pipe deselect, and explicit User Task Object Properties command-only open policy
engineering-canvas-clear-reset-guard.js public-safe global Clear Canvas and Reset Canvas View guard that suppresses live-panel resurrection during canvas clear, removes transient pump/source/sink/PFV/route/dock overlays, resets warning/context-menu state, and restores canvas scroll/anchor origin after menu reset
engineering-defense-export-package.js public-safe one-click defense report exporter, calculation defense contract evidence, UI evidence registry, task-window evidence badges, redacted audit event handoff, and print/save PDF workflow
engineering-pipe-moody-chart-audit.js public-safe pipe Moody chart visual audit overlay that stays hidden until explicitly opened, separates overlapped markers, exposes all overlapped element names in tooltip/list evidence, and removes unsupported/unused top-level Pipe Properties fields from the UI
engineering-pump-formula-defense-live-audit.js public-safe live Pump Formula Defense badges, trace-row source/literature notes, protected backend refresh bridge, input-to-output calculation matrix with Required Pump Head and Actual Pump Head separated, backend routeTrace/systemHead discharge-loss fallbacks, margin-criteria-aware summary, and Performance Refresh Governor scheduled open-window realtime refresh for advisor-facing pump NPSH evidence
engineering-pump-performance-chart-audit.js public-safe pump performance chart audit guard that suppresses fallback/duty-point fit curves, keeps no-data charts visually clean, requires sourced curve data, loads the realtime canonical renderer, and validates smart engineering chart modes
engineering-pump-performance-canonical-chart.js public-safe operational smart engineering chart/runtime guard that keeps established pump NPSH chart-model refresh logic available for dependencies, suppresses pump-development UI entry points (Pump Object Properties and Pump Performance Chart task windows), exposes Pump Datum - NPSHR with Pump Datum Elev. plus NPSH margin criteria and Pump Formula Defense task windows from the pump context menu, safely releases context-menu focus before aria-hidden, and schedules one governed visible-chart render so dependent chart numbers can refresh without repeated repaint bursts
engineering-google-auth-runtime.js public-safe support-lazy Google Identity Services frontend bridge that renders a sign-in control only on explicitly authorized OAuth origins when protected literature/auth is requested, sends ID tokens to the backend, immediately verifies the HttpOnly app session, prevents stale session refresh overwrite after login, exposes NPSHAuth.requireApproved and NPSHAuth.diagnose, maps backend auth error codes into actionable messages, and keeps approved/pending status visible
engineering-literature-pdf-viewer.js public-safe Literature task-window viewer that adds Help -> Literature, requires an approved Google app session, translates protected PDF auth/approval/source failures into actionable messages, retries pending PDFs after approved auth, renders private book_pdf PDFs through the same-origin API with PDF.js canvas pages, zoom/page controls, no visible source links, and user-resizable window sizing
engineering-src-algorithm-help-runtime.js public-safe Help -> Hydraulic Logic -> SRC Algorithm task-window runtime that presents the SRC Flow Input Mode appendix logic, equations, numbered tables, guardrails, and references without changing hydraulic calculation data
engineering-live-parameter-repaint-lock.css public-safe deferred live canvas parameter paint-lock override that removes transient Solve repaint shadows from parameter cards, pump status badge, and pump status icon glow without blocking first render
engineering-live-parameter-stable-runtime.js public-safe global stable-shell runtime for pump/source/sink/tank canvas parameter panels that absorbs renderer replacements and updates matching numeric values in place during input, drag, and solver changes
style.min.css           minified styles
png/                    public images and favicon
toolbar/                public toolbar icons
vendor/                 browser libraries for PDF/OCR/export and local KaTeX static equation assets
journals/               public case data, analysis reports, audit summaries, and current-system case review evidence
tools/publish-local-live.cjs Node publish helper for local-to-live release flow: runs focused validators, refreshes `LOCAL_LIVE_SYNC_MANIFEST.json`, commits/pushes local changes, deploys via Wrangler using `CLOUDFLARE_API_TOKEN` or stored OAuth login, and waits for live/cache verification
tools/validate-pump-performance-chart-audit.cjs Node validation for chart data eligibility, log-log audit contract, cache-busted runtime load, and model-linked realtime chart refresh
tools/validate-pump-formula-defense-live-audit.cjs Node validation for Pump Formula Defense live audit self-healing hooks, open-window content refresh, realtime event listeners, and model-linked formula row rebuilds
tools/validate-route-trace-default-lock.cjs Node validation for default-hidden canvas route-trace overlays, pump-summary route-trace/vapor-pressure lock, SNK presentation-row lock, SNK Sink Flow/Sink Elev./Sink Head readouts, audit/debug unlock APIs, and cache-busted runtime load
tools/validate-sink-boundary-mode-canvas-lock.cjs Node validation for SNK Boundary Mode canonical canvas/tooltip/readout values, stale result override, null-panel hover guard, free-outlet atmospheric pressure/head calculation, and cache-busted runtime load
tools/validate-global-live-indicator-engine-link.cjs Node validation for Global live indicator engine-link validation across all six UNTIRTA simulations, including SRC/SNK/pump canvas readouts, hover/title backup synchronization, engine-result hooks, realtime decimal locks, and cache-busted runtime load
tools/validate-canvas-context-dock.cjs Node validation for default-collapsed Fluid Basis dock behavior, absolute canvas overlay positioning, mobile compact lock, responsive Fluid Basis symbols, route trace source preference, stale freshness display, and cache-busted runtime load
tools/validate-live-parameter-repaint-lock.cjs Node validation for locked live parameter repaint CSS, stable live-parameter runtime, deferred non-render-blocking cache key, opaque backgrounds, no panel/badge shadow, and pump icon outline-only status display
tools/validate-export-canvas-snapshot-lock.cjs Node validation for silent normal export canvas fallback, retained real-failure warning, and stable manual renderer snapshot path
tools/validate-literature-pdf-viewer.cjs Node validation for Help -> Literature flyout, approved Google app-session guard, auth-approved PDF retry, local PDF.js canvas viewer, zoom/page controls, same-origin literature API, resizable task window, and no private GitHub source links in public runtime
tools/validate-src-algorithm-help.cjs Node validation for Help -> Hydraulic Logic -> SRC Algorithm flyout, SRC Flow Input Mode task-window content, equations, numbered tables, cache-busted runtime load, and manifest lock
tools/validate-source-volumetric-only-runtime.cjs Node validation for Source Properties volumetric-only cleanup, Source Definition and Flow Specification removal, Volumetric Flow relocation to Boundary Data, Mass Flow input removal, cache-busted runtime load, and manifest lock
tools/validate-google-auth-runtime.cjs Node validation for Google Identity Services runtime wiring, backend auth endpoints, post-login session verification, stale-session overwrite prevention, credentialed session fetches, approved-session guard, and cache-busted runtime load
tools/validate-pump-readiness-visibility-lock.cjs Node validation for late-added developer Pump Action Readiness panel hiding, childList-only observer scope, cache-busted runtime load, and manifest lock
tools/validate-browser-issues-runtime.cjs Node validation for browser Issues cleanup: ARIA menu repair, CSS compatibility property cleanup, static header normalization, critical mobile first-paint layout locks, llms.txt agent-readable structure, and cache-busted runtime load
tools/validate-pipe-properties-cleanup-runtime.cjs Node validation for early Pipe Properties cleanup runtime loading, removed field/label registry, segment z-column cleanup, calculation-phase hooks, hard-hidden CSS, and scroll stability contract
tools/validate-pipe-segments-file-runtime.cjs Node validation for Pipe Segments local `.v1` schema, filename convention, compact import/export controls, cache-busted runtime load, and stale-result marking
tools/validate-formula-defense-ui.cjs Node validation for npsh-untirta compact 700px Pipe Formula Defense layout, reference Formula Sequence & Active Substitution row reconstruction, All Segment Calculation Trace step coverage, dropdown-derived compact segment basis captions/tooltips, Realtime Role Path and Pipe Fitting Valve Breakdown responsive behavior, Source & Confidence Map responsive table/plain formula contract, Formula Defense UI KaTeX rendering, WCAG contrast, dependency chain visualization, cache-busted runtime load, and realtime refresh/debounce
tools/validate-pipe-canvas-hydraulic-label.cjs Node validation for Pipe/Fitting/Valve canvas hydraulic label runtime loading, 3-decimal display contract, symbolic row labels, cache key, npm script, and manifest lock
tools/validate-pipe-source-confidence-map.cjs Node validation for Pipe Formula Defense Source & Confidence Map restoration, pump path role inference, pressure-profile evidence, cache key, npm script, and manifest lock
tools/validate-analysis-report-live-runtime.cjs Node validation for Analysis Report live-link runtime loading, existing-table cell refresh behavior including bilingual headers and TH metric rows, Simulasi 1 Fluid/Pipe/Pump/SNK metric mapping, two-sheet XLSX export byte generation, Error column formula lock, cache key, npm script, and manifest lock
tools/validate-pump-nozzle-simplify-runtime.cjs Node validation for pump nozzle simplification runtime loading, deprecated main elevation input hiding, non-actionable status row hiding, redundant pump optimization proposal summary hiding, Pump Datum Elev. relabeling, cache key, npm script, and manifest lock
tools/validate-calculation-lifecycle-runtime.cjs Node validation for unified calculation lifecycle status mapping, Run/Refresh command observation, realtime event subscriptions, load order, cache key, npm script, and audit-safe no-mutation guard
tools/validate-calculation-progress-overlay.cjs Node validation for isolated calculation progress overlay runtime loading, realtime event listeners, delay/auto-hide timing contract, audit-safe no-mutation guard, compact academic copy, cache key, npm script, E2E script, and manifest lock
tools/validate-performance-refresh-governor.cjs Node validation for Performance Refresh Governor loading, duplicate-job coalescing, scoped secondary-window/chart/formula-defense patch coverage, governor-before-realtime load order, deferred route-audit diagnostic placement, npm script, manifest lock, and audit-safe no-mutation guard
tools/validate-head-power-audit-guard.cjs Node validation for Head Power Audit Guard loading, route-only Required/System Head cleanup, frontend local trace fallback cleanup without pump performance evidence, valid actual-pump-head preservation, cache key, npm script, and manifest lock
tools/validate-simulation-case-integrity-guard.cjs Node validation for Simulation Case integrity guard runtime loading, deferred diagnostic placement, Simulasi 4 partial Methanol detection, sample-file restore wiring, rendered canvas object repair, cache key, npm script, and manifest lock
tools/upgrade-simulation-untirta-current-layout.cjs Node migration for all six simulation `.untirta` sample files so deprecated Pipe Properties layout fields and segment z-column inputs are not persisted in the current app layout
tools/validate-simulation-untirta-current-layout.cjs Node validation for all six simulation `.untirta` sample files, including current Pipe Properties layout metadata, removed top-level pipe fields, removed segment z-column inputs, and project-object integrity
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
App bundle cache key: app.bundle.min.js?v=20260621-npsh-margin-options1
Main style cache key: style.min.css?v=20260608-browser-issues1
Bilingual terminology runtime cache key: engineering-bilingual-improvements.js?v=20260702-source-boundary-clean2
Source canvas parameter runtime cache key: engineering-src-canvas-parameter-runtime.js?v=20260702-object-status-clean1
Source temperature runtime cache key: engineering-source-temperature-runtime.js?v=20260701-source-volumetric-only1
Source volumetric-only runtime cache key: engineering-source-volumetric-only-runtime.js?v=20260702-source-boundary-clean2
Decimal display runtime cache key: engineering-decimal-display-runtime.js?v=20260609-pump-live-readout-click-lock2
Live parameter stable runtime cache key: engineering-live-parameter-stable-runtime-20260628-global-stable-values3.js?v=20260702-object-status-clean1
Parameter Task runtime cache key: engineering-parameter-task-runtime.js?v=20260626-head-power-audit1
Local trace fallback runtime cache key: engineering-local-trace-fallback-runtime.js?v=20260628-manual-npshr1
Pipe canvas hydraulic label runtime cache key: engineering-pipe-canvas-hydraulic-label-runtime-20260628-pfv-canvas-anchor1.js?v=20260630-pfv-label-noflicker1
Canvas fast preview runtime cache key: engineering-canvas-fast-preview-runtime.js?v=20260702-canvas-fast-preview3
Pipe source confidence map runtime cache key: engineering-pipe-source-confidence-map-runtime.js?v=20260630-pipe-properties-live1
Pump nozzle simplify runtime cache key: engineering-pump-nozzle-simplify-runtime.js?v=20260614-pump-nozzle-simplify5
Analysis Report live runtime cache key: engineering-analysis-report-live-runtime.js?v=20260629-live-evidence1
Head Power Audit Guard cache key: engineering-head-power-audit-guard.js?v=20260627-head-power-audit2
Route audit cache key: engineering-route-trace-audit.js?v=20260703-sink-boundary-layout1
Simulation case integrity guard cache key: engineering-simulation-case-integrity-guard.js?v=20260614-simulation-case-integrity3
Performance refresh governor cache key: engineering-performance-refresh-governor.js?v=20260629-live-evidence1
Pump edit fast lane cache key: engineering-pump-edit-fast-lane.js?v=20260701-user-flow-npshr1
Realtime calculation defense cache key: engineering-realtime-calculation-defense.js?v=20260701-user-flow-autosolve1
Suction-only NPSHa runtime cache key: engineering-suction-only-npsha-runtime.js?v=20260630-pipe-properties-live1
Calculation lifecycle runtime cache key: engineering-calculation-lifecycle-runtime.js?v=20260618-calculation-lifecycle-refresh-release1
Calculation progress overlay cache key: engineering-calculation-progress-overlay.js?v=20260617-calculation-progress-manual-only1
Browser issues runtime cache key: engineering-browser-issues-runtime.js?v=20260620-orphan-label-cleanup1
Pipe Properties cleanup runtime cache key: engineering-pipe-properties-cleanup-runtime.js?v=20260630-pipe-properties-cleanup1
Pipe Segments file runtime cache key: engineering-pipe-segments-file-runtime.js?v=20260630-pipe-properties-cleanup1
Formula Defense UI runtime cache key: engineering-formula-defense-ui-20260628-physical-cache1.js?v=20260630-pipe-properties-live1
Formula Defense UI KaTeX CSS cache key: vendor/katex/katex.min.css?v=20260630-pipe-properties-live1
Canvas context dock cache key: engineering-canvas-context-dock-20260628-canvas-dock-scroll-anchor1.js?v=20260629-live-evidence1
Canvas clear/reset guard cache key: engineering-canvas-clear-reset-guard.js?v=20260629-canvas-clear-reset1
Canvas context dock load placement: post-shell no-click canvas visual hydration pack plus status script fallback; not a synchronous first-paint script tag
Initial app load placement: Fluid Basis setup prompt is first in body DOM order for LCP; critical CSS reserves the Fluid Basis LCP card and Validate/Solve ribbon label metrics to prevent first-load CLS; shell JS auto-loads on idle; full main CSS, live parameter repaint lock, realtime/status scripts, PFV hydraulic labels, browser cleanup, and route-trace canvas layout cleanup hydrate automatically after shell load so canvas panels normalize without pointer/key input; remaining support scripts stay support-lazy, with first pointer/key activation still acting as an accelerator; Google Auth/GSI is support-lazy and not part of the first render path
Defense export cache key: engineering-defense-export-package.js?v=20260702-source-boundary-clean1
Pipe Moody chart audit cache key: engineering-pipe-moody-chart-audit.js?v=20260630-pipe-moody-audit-clean-unused-pipe-fields1
Runtime API config: same-origin /api/simulate
NPSH margin runtime cache key: engineering-npsh-margin-runtime.js?v=20260622-local-live-sync1
NPSH margin runtime load placement: deferred realtimeScripts path before Pump NPSH Acceptance runtime; no synchronous first-load script tag; no-click initial canvas hydration now starts the visual runtime pack after shell load so Fluid Basis and canvas panels normalize without a canvas click
Pump readiness visibility cache key: engineering-pump-readiness-visibility-runtime.js?v=20260607-pump-readiness-visibility3
Pump readiness visibility load placement: support-lazy feature script for developer panel hiding, not critical first-paint script
Pump formula defense live audit cache key: engineering-pump-formula-defense-live-audit.js?v=20260702-formula-defense-clean1
Pump performance chart audit cache key: engineering-pump-performance-chart-audit.js?v=20260630-pipe-properties-live1
Pump performance canonical chart cache key: engineering-pump-performance-canonical-chart.js?v=20260628-manual-npshr1
Pump performance canonical chart load phase: critical shell, immediately after app.bundle.min.js, so Pump Datum - NPSHR margin-basis defaults and options are active before the first pump context-menu click
Google auth runtime cache key: engineering-google-auth-runtime.js?v=20260620-google-auth-lazy1
Literature PDF viewer cache key: engineering-literature-pdf-viewer.js?v=20260609-literature-access3
SRC Algorithm help runtime cache key: engineering-src-algorithm-help-runtime.js?v=20260628-manual-npshr1
Live parameter repaint lock cache key: engineering-live-parameter-repaint-lock.css?v=20260702-object-status-clean1
Live parameter repaint lock validation: npm run validate:live-parameter-repaint-lock
Export canvas snapshot validation: npm run validate:export-canvas-snapshot-lock
Literature PDF viewer validation: npm run validate:literature-pdf-viewer
SRC Algorithm help validation: npm run validate:src-algorithm-help
Google auth runtime validation: npm run validate:google-auth-runtime
SNK boundary mode canvas lock validation: npm run validate:sink-boundary-mode-canvas-lock
Pump readiness visibility validation: npm run validate:pump-readiness-visibility-lock
Browser issues runtime validation: npm run validate:browser-issues-runtime
Agentic browsing discovery: llms.txt
Pipe Segments file runtime validation: npm run validate:pipe-segments-file-runtime
Pipe Properties cleanup runtime validation: npm run validate:pipe-properties-cleanup-runtime
Formula Defense UI validation: npm run validate:formula-defense-ui
Pipe canvas hydraulic label validation: npm run validate:pipe-canvas-hydraulic-label
Pipe source confidence map validation: npm run validate:pipe-source-confidence-map
Analysis Report live runtime validation: npm run validate:analysis-report-live-runtime
Pump nozzle simplify runtime validation: npm run validate:pump-nozzle-simplify
Calculation lifecycle validation: npm run validate:calculation-lifecycle
Calculation progress overlay validation: npm run validate:calculation-progress-overlay
Performance refresh governor validation: npm run validate:performance-refresh-governor
Head Power Audit Guard validation: npm run validate:head-power-audit-guard
Pump edit fast lane validation: npm run validate:pump-edit-fast-lane
Simulation case integrity validation: npm run validate:simulation-case-integrity
Simulation UNTIRTA current-layout validation: npm run validate:simulation-untirta-current-layout
Canvas clear/reset guard validation: npm run validate:canvas-clear-reset-guard
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
