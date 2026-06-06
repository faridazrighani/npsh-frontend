const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const runtimePath = path.join(rootDir, 'engineering-pump-readiness-visibility-runtime.js');
const indexPath = path.join(rootDir, 'index.html');
const manifestPath = path.join(rootDir, 'FILE_MANIFEST.md');

const runtime = fs.readFileSync(runtimePath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');

assert(runtime.includes("const panelSelector = '[data-caption-audit-pump-action-readiness=\"true\"], .caption-audit-pump-action-readiness';"), 'Pump readiness guard must keep the exact developer panel selector.');
assert(runtime.includes('function addedPumpReadinessPanel'), 'Pump readiness guard must detect late-added readiness panels.');
assert(runtime.includes('new MutationObserver((mutations) => {'), 'Pump readiness guard must observe late DOM insertions.');
assert(runtime.includes('readinessObserver.observe(target, { childList: true, subtree: true });'), 'Pump readiness observer must be scoped to childList/subtree insertions.');
assert(!runtime.includes('attributes: true'), 'Pump readiness observer must not watch global attribute churn.');
assert(!runtime.includes('characterData: true'), 'Pump readiness observer must not watch global text churn.');
assert(runtime.includes('readinessObserver?.disconnect?.();'), 'Debug mode should disconnect the hidden-panel observer.');
assert(index.includes('engineering-pump-readiness-visibility-runtime.js?v=20260607-pump-readiness-visibility3'), 'Index must load the cache-busted pump readiness visibility guard.');
assert(manifest.includes('Pump readiness visibility cache key: engineering-pump-readiness-visibility-runtime.js?v=20260607-pump-readiness-visibility3'), 'Manifest must document the pump readiness visibility cache key.');
assert(manifest.includes('Pump readiness visibility validation: npm run validate:pump-readiness-visibility-lock'), 'Manifest must document the pump readiness visibility validator.');

console.log('Pump readiness visibility lock validation passed.');
