const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const runtimePath = path.join(repoRoot, 'engineering-simulation-load-transaction-manager.js');
const indexPath = path.join(repoRoot, 'index.html');
const packagePath = path.join(repoRoot, 'package.json');
const manifestPath = path.join(repoRoot, 'FILE_MANIFEST.md');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} is missing: ${needle}`);
}

const runtimeSource = read(runtimePath);
const indexSource = read(indexPath);
const packageJson = JSON.parse(read(packagePath));
const manifestSource = read(manifestPath);

[
  'engineering-simulation-load-transaction-manager.v3-visual-wrapper-lock',
  '20260711-simulation-load-visual-wrapper-lock1',
  'AbortController',
  'beginTransaction',
  'abortPrevious',
  'registerCleanup',
  'registerController',
  'sessionSignal',
  'setSessionTimeout',
  'clearAllSessionTimers',
  'abortSessionFileReaders',
  'createAbortSignalForSession',
  'cleanupSummary',
  'cleanTaskWindowsForLoad',
  'cleanLoadArtifacts',
  'requestDisplayCleanup',
  'npsh:simulation-load-workspace-cleanup',
  'npsh:simulation-load-settle-watchdog',
  'RETAINED_SESSION_SIGNAL_LIMIT',
  'SETTLE_WATCHDOG_DELAYS_MS',
  'BUSY_LABEL_PATTERN',
  'VISUAL_REFRESH_FUNCTIONS',
  'SINGLE_INSTALL_VISUAL_REFRESH_FUNCTIONS',
  'VISUAL_REFRESH_PATCH_RETRY_DELAYS_MS',
  'pruneSessionSignalCache',
  'displayCleanupFrame',
  'visualRefreshSummary',
  'patchVisualRefreshFunctions',
  'flushVisualRefreshQueue',
  'requestVisualRefreshFlush',
  'clearVisualRefreshQueue',
  'discardQueuedVisualRefresh',
  '__simulationLoadVisualRefreshPatched',
  'visualRefreshPatchedNames',
  'settleWatchdogSummary',
  'auditSettledUi',
  'scheduleSettleWatchdogs',
  'clearSettleWatchdogs',
  'commandReleaseNeeded',
  'forceReadinessGateRelease',
  'prefetchSimulationCases',
  'cleanWorkspaceForLoad',
  'input[type="file"]',
  '[data-simulation-case-action="open"][data-simulation-case-id]',
  'X-NPSH-Load-Session',
  'npsh:simulation-load-transaction-begin',
  'npsh:simulation-load-transaction-stale-result',
  'patchFetch',
  'patchFileArrayBuffer',
  'patchFileReaderMethods',
  'guardAsyncResult',
  'assertCurrent',
  'bindFileToSession',
  'FileReader',
  'patchFileReaderEventListeners',
  'wrapFileReaderListener',
  'removeEventListener',
  'wrapFileReaderHandlerProperty',
  'onload',
  'stopImmediatePropagation',
  'patchResponseBodyMethod',
  'applySimulationStateAtomic',
  'openSimulationCaseSample',
  'releaseRunCommandLocks',
  'calculationBusy',
  'closeLoadDropdowns',
  'simulationLoadMenusClosedAt',
  'EngineeringDropdownFocusGuardRuntime',
  'SAMPLE_DIALOG_OPEN_TEXT',
  'open-sample-case-confirmed',
  'simulation-case-6'
].forEach((needle) => assertIncludes(runtimeSource, needle, 'runtime'));

assertIncludes(
  indexSource,
  'engineering-simulation-load-transaction-manager.js?v=20260711-simulation-load-visual-wrapper-lock1',
  'index.html'
);

const appIndex = indexSource.indexOf('app.bundle.min.js?v=20260707-pipe-canvas-loss-label1');
const managerIndex = indexSource.indexOf('engineering-simulation-load-transaction-manager.js?v=20260711-simulation-load-visual-wrapper-lock1');
const readinessIndex = indexSource.indexOf('engineering-open-file-readiness-gate.js?v=20260711-open-file-hard-release1');
assert(appIndex >= 0 && managerIndex > appIndex, 'simulation load transaction manager must load after app.bundle.min.js');
assert(readinessIndex > managerIndex, 'open-file readiness gate must load after simulation load transaction manager');

assert(
  packageJson.scripts?.['validate:simulation-load-transaction-manager'] === 'node tools/validate-simulation-load-transaction-manager.cjs',
  'package.json script validate:simulation-load-transaction-manager is missing'
);

assertIncludes(manifestSource, 'engineering-simulation-load-transaction-manager.js', 'FILE_MANIFEST.md');
assertIncludes(manifestSource, 'Simulation load transaction manager cache key', 'FILE_MANIFEST.md');

const runtime = require(runtimePath);
assert(runtime.version === 'engineering-simulation-load-transaction-manager.v3-visual-wrapper-lock', 'runtime version mismatch');
assert(runtime.cacheKey === '20260711-simulation-load-visual-wrapper-lock1', 'runtime cache key mismatch');
[
  'install',
  'beginTransaction',
  'abortPrevious',
  'registerCleanup',
  'registerController',
  'bindFileToSession',
  'signal',
  'setSessionTimeout',
  'isCurrent',
  'assertCurrent',
  'guardAsyncResult',
  'current',
  'complete',
  'fail',
  'warmRuntime',
  'prefetchSimulationCases',
  'cleanWorkspaceForLoad',
  'cleanTaskWindowsForLoad',
  'cleanLoadArtifacts',
  'visualRefreshSummary',
  'patchVisualRefreshFunctions',
  'flushVisualRefreshQueue',
  'requestVisualRefreshFlush',
  'clearVisualRefreshQueue',
  'settleWatchdogSummary',
  'auditSettledUi',
  'scheduleSettleWatchdogs',
  'clearSettleWatchdogs',
  'releaseRunCommandLocks'
].forEach((name) => assert(typeof runtime[name] === 'function', `runtime API missing ${name}`));

let aborted = false;
let cleaned = false;
let timerRan = false;
const first = runtime.beginTransaction('validator-first', { caseId: 'simulation-case-4' });
runtime.registerController({ abort: () => { aborted = true; } }, 'validator-controller');
runtime.registerCleanup(() => { cleaned = true; }, 'validator-cleanup');
const firstSignal = runtime.signal(first.sessionId);
let signalAborted = false;
firstSignal?.addEventListener?.('abort', () => { signalAborted = true; }, { once: true });
runtime.setSessionTimeout(() => { timerRan = true; }, 20, 'validator-stale-timer', first.sessionId);
assert(runtime.isCurrent(first.sessionId), 'first transaction should be current before supersede');

const second = runtime.beginTransaction('validator-second', { caseId: 'simulation-case-6' });
assert(aborted, 'previous controller was not aborted');
assert(cleaned, 'previous cleanup callback was not called');
assert(signalAborted || firstSignal?.aborted, 'previous transaction signal was not aborted');
assert(!timerRan, 'previous transaction timer should be cancelled on supersede');
assert(!runtime.isCurrent(first.sessionId), 'first transaction should not be current after supersede');
assert(runtime.isCurrent(second.sessionId), 'second transaction should be current');
assert(runtime.complete(second.sessionId, { reason: 'validator-complete' }), 'second transaction did not complete');
assert(runtime.current().status === 'completed', 'completed transaction status not reflected');
assert(runtime.guardAsyncResult(second.sessionId, 'validator-sync', true) === true, 'guardAsyncResult should return sync values.');
runtime.abortPrevious('validator-finish');

const cleanupBefore = runtime.cleanupSummary();
runtime.cleanWorkspaceForLoad({ source: 'validator-cleanup', sessionId: 'validator-cleanup-session' });
const cleanupAfter = runtime.cleanupSummary();
assert(cleanupAfter.sequence > cleanupBefore.sequence, 'workspace cleanup must update cleanup summary sequence');
assert(cleanupAfter.lastReason === 'workspace-cleanup-before-load', 'workspace cleanup reason not recorded');

const third = runtime.beginTransaction('validator-third', { caseId: 'simulation-case-1' });
const staleSessionId = third.sessionId;
runtime.beginTransaction('validator-fourth', { caseId: 'simulation-case-6' });
let staleRejected = false;
try {
  runtime.assertCurrent(staleSessionId, 'validator-stale-session');
} catch (error) {
  staleRejected = error?.name === 'AbortError';
}
assert(staleRejected, 'assertCurrent must reject stale session ids.');
runtime.abortPrevious('validator-finish-2');

let visualRefreshCalls = 0;
global.refreshBackendProtectedSimulationUi = () => {
  visualRefreshCalls += 1;
  return 99;
};
assert(runtime.patchVisualRefreshFunctions() >= 1, 'visual refresh patch did not patch the validator refresh function');
const visualSession = runtime.beginTransaction('validator-visual-refresh', { caseId: 'simulation-case-6' });
global.refreshBackendProtectedSimulationUi('during-load');
global.refreshBackendProtectedSimulationUi('during-load-again');
assert(visualRefreshCalls === 0, 'visual refresh should be deferred while a simulation load is active');
assert(runtime.visualRefreshSummary().queueSize >= 1, 'visual refresh queue should contain deferred work');
runtime.complete(visualSession.sessionId, { reason: 'validator-visual-refresh-complete' });
runtime.flushVisualRefreshQueue('validator-visual-refresh-flush');
assert(visualRefreshCalls === 1, 'deferred visual refresh should flush once after load completion');
assert(runtime.visualRefreshSummary().queueSize === 0, 'visual refresh queue should be empty after flush');
delete global.refreshBackendProtectedSimulationUi;

let fakeButton = {
  disabled: true,
  dataset: { calculationBusy: 'true' },
  attributes: { 'aria-busy': 'true', 'aria-disabled': 'true' },
  querySelector: () => ({ textContent: 'Calculating...' }),
  setAttribute(name, value) { this.attributes[name] = value; },
  getAttribute(name) { return this.attributes[name] || ''; },
  removeAttribute(name) { delete this.attributes[name]; },
  toggleAttribute(name, enabled) {
    if (enabled) this.attributes[name] = '';
    else delete this.attributes[name];
  }
};
const originalDocument = global.document;
const originalCustomEvent = global.CustomEvent;
global.CustomEvent = function CustomEvent(type, init = {}) {
  this.type = type;
  this.detail = init.detail;
};
global.document = {
  documentElement: {},
  body: {
    classList: {
      classes: new Set(['npsh-simulation-load-transaction-active']),
      contains(name) { return this.classes.has(name); },
      remove(name) { this.classes.delete(name); }
    }
  },
  querySelectorAll(selector) {
    return String(selector).includes('#btn-solve') ? [fakeButton] : [];
  },
  dispatchEvent() { return true; }
};
const watchdogBefore = runtime.settleWatchdogSummary();
const watchdogAudit = runtime.auditSettledUi('validator-settle-watchdog');
assert(watchdogAudit.actions.includes('release-run-command'), 'settle watchdog must release stuck Validate command');
assert(watchdogAudit.actions.includes('clear-simulation-load-active-class'), 'settle watchdog must clear stale simulation load active class');
assert(fakeButton.disabled === false, 'settle watchdog did not re-enable fake Validate button');
assert(fakeButton.dataset.calculationBusy === 'false', 'settle watchdog did not clear calculationBusy');
assert(global.document.body.classList.contains('npsh-simulation-load-transaction-active') === false, 'settle watchdog did not clear active class');
assert(runtime.settleWatchdogSummary().audits > watchdogBefore.audits, 'settle watchdog audit count did not increase');
runtime.clearSettleWatchdogs('validator-cleanup');
global.document = originalDocument;
global.CustomEvent = originalCustomEvent;

console.log('Simulation load transaction manager validation passed.');
