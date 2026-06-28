const assert = require('assert');
const fs = require('fs');
const path = require('path');

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const INDEX_FILE = path.join(FRONTEND_ROOT, 'index.html');
const STYLE_FILE = path.join(FRONTEND_ROOT, 'style.min.css');
const WORKER_FILE = path.join(FRONTEND_ROOT, '_worker.js');
const STATIC_PREVIEW_FILE = path.join(FRONTEND_ROOT, 'tools', 'serve-local-preview.cjs');
const DOCK_FILE = path.join(FRONTEND_ROOT, 'engineering-canvas-context-dock.js');
const LITERATURE_FILE = path.join(FRONTEND_ROOT, 'engineering-literature-pdf-viewer.js');
const ROUTE_AUDIT_FILE = path.join(FRONTEND_ROOT, 'engineering-route-trace-audit.js');
const RUNTIME_FILE = path.join(FRONTEND_ROOT, 'engineering-browser-issues-runtime.js');
const SEO_RENDERER_FILE = path.join(FRONTEND_ROOT, 'tools', 'render-seo-metadata.cjs');
const LLMS_FILE = path.join(FRONTEND_ROOT, 'llms.txt');

function read(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, 'utf8');
}

const indexHtml = read(INDEX_FILE);
const style = read(STYLE_FILE);
const worker = read(WORKER_FILE);
const staticPreview = read(STATIC_PREVIEW_FILE);
const dock = read(DOCK_FILE);
const literature = read(LITERATURE_FILE);
const routeAudit = read(ROUTE_AUDIT_FILE);
const seoRenderer = read(SEO_RENDERER_FILE);
const llms = read(LLMS_FILE).replace(/\r\n/g, '\n');
const runtime = require(RUNTIME_FILE);

assert.strictEqual(runtime.version, 'engineering-browser-issues-runtime.v1');
assert.strictEqual(runtime.cacheKey, '20260620-orphan-label-cleanup1');
assert(indexHtml.includes('engineering-browser-issues-runtime.js?v=20260620-orphan-label-cleanup1'), 'index.html must cache-bust browser issues runtime.');
assert(indexHtml.includes('style.min.css?v=20260608-browser-issues1'), 'index.html must cache-bust browser-issues CSS cleanup.');
assert.strictEqual(typeof runtime.repairFormFieldLabels, 'function', 'Browser issues runtime must expose orphan form-field label cleanup.');
assert.strictEqual(typeof runtime.repairBrowserIssues, 'function', 'Browser issues runtime must expose a combined browser-issues repair pass.');
assert(indexHtml.includes('engineering-canvas-context-dock-20260628-canvas-dock-scroll-anchor1.js?v=20260628-canvas-dock-scroll-anchor1'), 'index.html must cache-bust canvas context dock browser issues cleanup with a physical filename.');
assert(indexHtml.includes('engineering-literature-pdf-viewer.js?v=20260609-literature-access3'), 'index.html must cache-bust literature PDF access diagnostics cleanup.');
assert(indexHtml.includes('__chromium_devtools_metrics_reporter'), 'index.html must install the Chromium DevTools metrics reporter guard early.');
assert(indexHtml.includes("typeof window.__chromium_devtools_metrics_reporter === 'function'"), 'Chromium DevTools metrics reporter guard must preserve real reporter functions.');
assert(indexHtml.includes("set(value)"), 'Chromium DevTools metrics reporter guard must handle later non-function assignments.');
assert(!indexHtml.includes('name="theme-color"'), 'index.html should not trigger Firefox theme-color compatibility notice.');
assert(!indexHtml.includes('fetchpriority='), 'About dialog images should not trigger Firefox fetchpriority compatibility notice.');
assert(/<div class="about-modal" id="aboutModal"[^>]*\shidden\b/.test(indexHtml), 'About dialog must be hidden by default so it cannot block menu clicks on first load.');
assert(
  indexHtml.indexOf('data-i18n-text="basis.openSetupInstruction"') < indexHtml.indexOf('<div class="about-modal" id="aboutModal"'),
  'Fluid Basis LCP task prompt must appear before the hidden About dialog in DOM order.'
);
assert(indexHtml.includes('.fluid-basis-lcp-shell .fluid-input-card{min-height:138px}'), 'Critical CSS must reserve the Fluid Basis LCP card height before the deferred stylesheet arrives.');
assert(indexHtml.includes('.fluid-basis-lcp-shell .fluid-basis-grid{grid-template-columns:minmax(0,1fr);gap:0}'), 'Critical CSS must keep the Fluid Basis LCP grid identical to the final stylesheet before deferred CSS loads.');
assert(indexHtml.includes('.ribbon-label{display:block;min-height:14px;font-size:11px;line-height:1.2;'), 'Critical CSS must reserve ribbon label metrics to prevent Solve/Validate label layout shift.');
assert(indexHtml.includes('.solve-ribbon-btn .ribbon-label{min-width:46px}'), 'Critical CSS must reserve the Validate/Solve command label width before i18n/support scripts run.');
assert(indexHtml.includes('function scheduleInitialAppLoad') || indexHtml.includes('const scheduleInitialAppLoad'), 'Index must schedule initial app-shell loading without requiring the first menu click.');
assert(indexHtml.includes('requestIdleCallback') && indexHtml.includes('window.setTimeout(startInitialShellLoad, 250)'), 'Initial app-shell load should use idle scheduling with a timer fallback.');
assert(!indexHtml.includes('<script src="engineering-npsh-margin-runtime.js'), 'NPSH margin bridge must not load as a synchronous first-load script.');
assert(
  indexHtml.indexOf("'engineering-npsh-margin-runtime.js?v=20260622-local-live-sync1'") >
    indexHtml.indexOf('const realtimeScripts = ['),
  'NPSH margin bridge must load through the deferred realtime script path.'
);
assert(indexHtml.includes('const scheduleInitialCanvasHydration = () => {'), 'Index must schedule no-click canvas runtime hydration after the passive shell load.');
assert(indexHtml.includes('const initialCanvasHydrationScripts = ['), 'Index must define a no-click initial canvas visual runtime pack.');
assert(indexHtml.includes("'engineering-pipe-canvas-hydraulic-label-runtime-20260628-pfv-canvas-anchor1.js?v=20260628-pfv-canvas-anchor1'"), 'Initial canvas visual runtime pack must include PFV hydraulic labels with a physical filename cache-bust.');
assert(indexHtml.includes("'engineering-route-trace-audit.js?v=20260628-discharge-duty-status2'"), 'Initial canvas visual runtime pack must include route trace canvas layout cleanup.');
assert(indexHtml.includes('window.__npshInitialCanvasHydrationScheduled'), 'Initial canvas hydration must be guarded so it starts only once.');
assert(indexHtml.includes("ensureStyles().catch(error => console.warn('Initial canvas stylesheet hydration did not load.', error));"), 'Initial canvas hydration must load main CSS plus live repaint-lock CSS without requiring a canvas click.');
assert(indexHtml.includes('loadScripts(initialCanvasHydrationScripts)'), 'Initial canvas hydration must load the visual canvas runtime pack directly instead of waiting for support-lazy idle chaining.');
assert(indexHtml.includes('window.__npshInitialCanvasHydrationComplete = true'), 'Initial canvas hydration must expose a completion flag for browser diagnostics.');
assert(indexHtml.includes('window.setTimeout(loadSupport, 12000)'), 'Initial canvas hydration must still warm the remaining support runtime after visual panels are stable.');
assert(/loadShell\(\)\s*\.then\(scheduleInitialCanvasHydration\)/.test(indexHtml), 'Passive shell load must trigger initial canvas hydration after the core app is ready.');
assert(indexHtml.includes('window.__npshLoadRealtime = loadRealtime'), 'Index must expose an internal realtime bootstrap hook for E2E and diagnostics.');
assert(indexHtml.includes("window.addEventListener('pointerdown', beginInteraction")
  && indexHtml.includes("window.addEventListener('keydown', handleFirstKeydown")
  && indexHtml.includes("document.addEventListener('keydown', handleFirstKeydown"), 'First pointer/key activation must still accelerate runtime hydration while no-click initial hydration runs in the background.');
assert(indexHtml.includes('@media (max-width:820px){.ribbon{flex-wrap:wrap;align-content:flex-start;overflow-x:hidden;overflow-y:hidden}'), 'Critical CSS must pre-lock the mobile wrapped ribbon to prevent first-load layout shift.');
assert(indexHtml.includes('@media (max-width:720px){.basis-status-pill,.basis-compact-status{display:none}.main-workspace{flex-direction:column;flex:1 1 auto;min-height:0}'), 'Critical CSS must pre-lock the mobile workspace/canvas layout before the deferred stylesheet arrives.');
assert(indexHtml.includes('@media (max-width:640px){.menu-bar{font-size:12px;gap:12px;padding:5px 8px;min-height:32px}'), 'Critical CSS must pre-lock mobile menu sizing to match the final stylesheet.');
assert(indexHtml.includes('.toolbar-palette{order:20;display:flex;min-height:50px;flex:1 0 100%;min-width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;'), 'Critical CSS must reserve the second-row mobile toolbar area to prevent CLS.');
assert(indexHtml.includes("aboutMenu?.addEventListener('click', openAbout)"), 'About menu should explicitly open the hidden About dialog.');
assert(indexHtml.includes('window.__npshAboutDismissed = true'), 'Bootstrap must suppress legacy automatic About opening after core app load.');
assert(!/id="toolbarObjectMenu"[^>]*role="menu"/.test(indexHtml), 'Static empty toolbar object menu must not declare role=menu.');
assert(!/id="toolbarObjectMenu"[^>]*aria-label=/.test(indexHtml), 'Static empty toolbar object menu must not declare aria-label without an ARIA role.');
assert(!/id="toolbarObjectMenu"[^>]*data-i18n-aria-label=/.test(indexHtml), 'Static empty toolbar object menu must not localize an aria-label before it has an ARIA role.');
assert(indexHtml.includes('stop-color="#4a90e2"'), 'Fluid Basis SVG gradient must not use inline CSS style attributes.');
assert(indexHtml.includes('-webkit-user-select:none;user-select:none'), 'Critical inline CSS must list -webkit-user-select before user-select.');

assert(!style.includes('scrollbar-width:'), 'Minified CSS should avoid scrollbar-width Safari compatibility warnings.');
assert(!style.includes('scrollbar-gutter:'), 'Minified CSS should avoid scrollbar-gutter Safari compatibility warnings.');
assert(!style.includes('-webkit-user-drag:'), 'Minified CSS should avoid -webkit-user-drag Firefox compatibility warnings.');
assert(!/mask-image:[^;]+;-webkit-mask-image/.test(style), 'Minified CSS must list -webkit-mask-image before mask-image.');
assert(!/(?<!-webkit-)user-select:none/.test(style.replace(/-webkit-user-select:none;user-select:none/g, '')), 'Minified CSS user-select declarations must have -webkit prefix first.');

assert(dock.includes('-webkit-backdrop-filter: blur(6px);'), 'Canvas context dock must include Safari backdrop-filter prefix.');
assert(dock.indexOf('-webkit-backdrop-filter') < dock.indexOf('backdrop-filter'), 'Canvas context dock must list -webkit-backdrop-filter before backdrop-filter.');
assert(!dock.includes('scrollbar-width:'), 'Canvas context dock must avoid scrollbar-width Safari compatibility warnings.');
assert(!literature.includes('user-select:none;-webkit-user-select:none'), 'Literature PDF viewer must not list user-select before -webkit-user-select.');
assert(literature.includes('-webkit-user-select:none;user-select:none'), 'Literature PDF viewer must list -webkit-user-select before user-select.');
assert(routeAudit.includes('-webkit-user-select:none;user-select:none'), 'Route trace audit runtime must prefix user-select.');
assert(!seoRenderer.includes("meta({ name: 'theme-color'"), 'SEO metadata renderer must not regenerate Firefox theme-color compatibility notices.');
assert(llms.startsWith('# NPSH Pumping System Simulator\n\n> '), 'llms.txt must follow the expected H1 plus blockquote summary structure.');
assert(llms.includes('## Primary Pages') && llms.includes('## Notes For Agents'), 'llms.txt must provide concise agent navigation and interpretation sections.');
assert(llms.includes('[Application](https://npsh.virsim.id/)'), 'llms.txt must link to the canonical application URL.');
assert(llms.includes('Realtime autosolve is the primary calculation path'), 'llms.txt must tell agents that Validate is evidence refresh, not the calculation engine.');

assert(worker.includes('staticContentType'), 'Worker must normalize static Content-Type headers.');
assert(worker.includes("image/svg+xml; charset=utf-8"), 'Worker must add utf-8 charset to SVG content.');
assert(worker.includes("headers.delete('X-Frame-Options')"), 'Worker must strip deprecated X-Frame-Options from static responses.');
assert(worker.includes("headers.delete('X-XSS-Protection')"), 'Worker must strip deprecated X-XSS-Protection from static responses.');
assert(worker.includes("frame-ancestors 'none'"), 'Worker must protect HTML documents with CSP frame-ancestors.');
assert(worker.includes("public, max-age=31536000, immutable"), 'Worker must cache immutable cache-busted static assets.');
assert(worker.includes('/must-revalidate/i'), 'Worker must normalize inherited must-revalidate cache directives.');

assert(staticPreview.includes("'.svg': 'image/svg+xml; charset=utf-8'"), 'Local static preview must serve SVG with utf-8 charset.');
assert(!staticPreview.includes("'X-Frame-Options': 'DENY'"), 'Local static preview must not emit deprecated X-Frame-Options.');

console.log('Browser issues runtime validation passed: ARIA menu repair, CSS compatibility cleanup, and static header normalization are locked.');
