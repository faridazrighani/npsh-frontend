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
const runtime = require(RUNTIME_FILE);

assert.strictEqual(runtime.version, 'engineering-browser-issues-runtime.v1');
assert.strictEqual(runtime.cacheKey, '20260608-browser-issues1');
assert(indexHtml.includes('engineering-browser-issues-runtime.js?v=20260608-browser-issues1'), 'index.html must cache-bust browser issues runtime.');
assert(indexHtml.includes('style.min.css?v=20260608-browser-issues1'), 'index.html must cache-bust browser-issues CSS cleanup.');
assert(indexHtml.includes('engineering-canvas-context-dock.js?v=20260618-current-prior-stale1'), 'index.html must cache-bust canvas context dock browser issues cleanup.');
assert(indexHtml.includes('engineering-literature-pdf-viewer.js?v=20260609-literature-access3'), 'index.html must cache-bust literature PDF access diagnostics cleanup.');
assert(indexHtml.includes('__chromium_devtools_metrics_reporter'), 'index.html must install the Chromium DevTools metrics reporter guard early.');
assert(indexHtml.includes("typeof window.__chromium_devtools_metrics_reporter === 'function'"), 'Chromium DevTools metrics reporter guard must preserve real reporter functions.');
assert(indexHtml.includes("set(value)"), 'Chromium DevTools metrics reporter guard must handle later non-function assignments.');
assert(!indexHtml.includes('name="theme-color"'), 'index.html should not trigger Firefox theme-color compatibility notice.');
assert(!indexHtml.includes('fetchpriority='), 'About dialog images should not trigger Firefox fetchpriority compatibility notice.');
assert(/<div class="about-modal" id="aboutModal"[^>]*\shidden\b/.test(indexHtml), 'About dialog must be hidden by default so it cannot block menu clicks on first load.');
assert(indexHtml.includes('function scheduleInitialAppLoad') || indexHtml.includes('const scheduleInitialAppLoad'), 'Index must schedule initial app loading without requiring the first menu click.');
assert(indexHtml.includes('requestIdleCallback') && indexHtml.includes('window.setTimeout(beginInteraction, 250)'), 'Initial app load should use idle scheduling with a timer fallback.');
assert(indexHtml.includes("aboutMenu?.addEventListener('click', openAbout)"), 'About menu should explicitly open the hidden About dialog.');
assert(indexHtml.includes('window.__npshAboutDismissed = true'), 'Bootstrap must suppress legacy automatic About opening after core app load.');
assert(!/id="toolbarObjectMenu"[^>]*role="menu"/.test(indexHtml), 'Static empty toolbar object menu must not declare role=menu.');
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
