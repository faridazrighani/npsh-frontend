const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'engineering-simulation-case-menu-cleanup-runtime-20260716-report-action-remove2.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const e2e = fs.readFileSync(path.join(root, 'tests', 'e2e', 'simulation-case-menu-cleanup.spec.cjs'), 'utf8');
const cacheKey = 'engineering-simulation-case-menu-cleanup-runtime-20260716-report-action-remove2.js?v=20260716-simulation-case-report-action-remove2';

assert(index.includes(cacheKey), 'index.html must load the cache-busted Simulation Case menu cleanup runtime.');
assert(runtime.includes('engineering-simulation-case-menu-cleanup.v1'), 'Runtime version must remain explicit.');
assert(runtime.includes("const REPORT_ACTION_SELECTOR = '[data-simulation-case-action=\"report\"]'"), 'Runtime must target only the retired report action.');
assert(runtime.includes('display:none!important'), 'Runtime must prevent a one-frame report-action flash.');
assert(runtime.includes('MutationObserver'), 'Runtime must remove report actions created by asynchronous menu rendering.');
assert(runtime.includes('stopImmediatePropagation'), 'Runtime must block a stale report-action click before its old handler runs.');
assert(runtime.includes('action.remove'), 'Runtime must physically remove retired actions from the menu DOM.');
assert(e2e.includes("['simulation-case-1', 'simulation-case-2', 'simulation-case-3', 'simulation-case-4', 'simulation-case-5', 'simulation-case-6']"), 'E2E must inspect all Simulation Cases.');
assert(e2e.includes('[data-simulation-case-action="report"]'), 'E2E must assert that report actions are absent.');

console.log('Simulation Case menu cleanup validation passed.');
