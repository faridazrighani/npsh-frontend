const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  const response = await page.goto('/');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    window.EngineeringBrowserIssuesRuntime?.version === 'engineering-browser-issues-runtime.v1'
    && typeof window.applySimulationStateAtomic === 'function'
  ), null, { timeout: 30000 });
  return response;
}

test('browser Issues cleanup keeps ARIA roles and response headers compatible', async ({ page }) => {
  const documentResponse = await waitForNpshApp(page);
  const documentHeaders = documentResponse.headers();
  expect(documentHeaders['content-type']).toContain('text/html; charset=utf-8');
  expect(documentHeaders['x-frame-options']).toBeUndefined();

  const runtimeResponse = await page.request.get('/engineering-browser-issues-runtime.js?v=20260608-browser-issues1');
  expect(runtimeResponse.headers()['cache-control']).toContain('immutable');
  expect(runtimeResponse.headers()['content-type']).toContain('charset=utf-8');

  const svgResponse = await page.request.get('/toolbar/icons/pump.svg');
  expect(svgResponse.headers()['content-type']).toContain('image/svg+xml; charset=utf-8');

  const apiResponse = await page.request.get('/api/health');
  const apiHeaders = apiResponse.headers();
  expect(apiHeaders['content-type']).toContain('application/json; charset=utf-8');
  expect(apiHeaders['x-frame-options']).toBeUndefined();
  expect(apiHeaders['x-xss-protection']).toBeUndefined();

  const browserIssueState = await page.evaluate(() => {
    window.__chromium_devtools_metrics_reporter = { broken: true };
    const chromiumReporterTypeAfterObject = typeof window.__chromium_devtools_metrics_reporter;
    window.__chromium_devtools_metrics_reporter('npsh-devtools-console-guard');
    window.__chromium_devtools_metrics_reporter = 'still-not-a-function';
    const chromiumReporterTypeAfterString = typeof window.__chromium_devtools_metrics_reporter;
    window.__chromium_devtools_metrics_reporter('npsh-devtools-console-guard-again');
    window.EngineeringBrowserIssuesRuntime.repairMenuRoles(document);
    const emptyObjectMenu = document.getElementById('toolbarObjectMenu');
    const invalidMenus = [...document.querySelectorAll('[role="menu"]')]
      .filter((menu) => !menu.querySelector('[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="group"]'))
      .map((menu) => menu.id || menu.className || menu.tagName);
    return {
      themeColorMetaCount: document.querySelectorAll('meta[name="theme-color"]').length,
      fetchPriorityImageCount: document.querySelectorAll('img[fetchpriority]').length,
      objectMenuRole: emptyObjectMenu?.getAttribute('role') || null,
      objectMenuItemCount: emptyObjectMenu?.querySelectorAll('[role="menuitem"]').length || 0,
      chromiumReporterTypeAfterObject,
      chromiumReporterTypeAfterString,
      invalidMenus
    };
  });

  expect(browserIssueState.themeColorMetaCount).toBe(0);
  expect(browserIssueState.fetchPriorityImageCount).toBe(0);
  if (browserIssueState.objectMenuItemCount > 0) {
    expect(browserIssueState.objectMenuRole).toBe('menu');
  } else {
    expect(browserIssueState.objectMenuRole).toBeNull();
  }
  expect(browserIssueState.chromiumReporterTypeAfterObject).toBe('function');
  expect(browserIssueState.chromiumReporterTypeAfterString).toBe('function');
  expect(browserIssueState.invalidMenus).toEqual([]);

  console.log(JSON.stringify({
    browserIssuesE2E: 'pass',
    documentContentType: documentHeaders['content-type'],
    runtimeCacheControl: runtimeResponse.headers()['cache-control'],
    svgContentType: svgResponse.headers()['content-type'],
    apiContentType: apiHeaders['content-type'],
    chromiumReporterTypeAfterObject: browserIssueState.chromiumReporterTypeAfterObject,
    chromiumReporterTypeAfterString: browserIssueState.chromiumReporterTypeAfterString,
    invalidMenus: browserIssueState.invalidMenus
  }, null, 2));
});

test('first load keeps About hidden and menu bar clickable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#aboutModal')).toBeHidden();
  await page.waitForFunction(() => (
    typeof window.applySimulationStateAtomic === 'function'
    && window.EngineeringCalculationLifecycle?.cacheKey === '20260618-calculation-lifecycle-refresh-release1'
  ), null, { timeout: 30000 });

  await page.click('#menu-file');
  await expect(page.locator('#dropdown-file')).toBeVisible();

  await page.click('#menu-tools');
  await expect(page.locator('#dropdown-tools')).toBeVisible();
  await expect(page.locator('#menu-refresh-calculations')).toBeEnabled();
  await page.hover('#menu-flow-dynamic-state');
  await expect(page.locator('#dropdown-flow-dynamic-state')).toBeVisible();

  await page.click('#menu-help');
  await expect(page.locator('#dropdown-help')).toBeVisible();
  await page.hover('#menu-hydraulic-logic');
  await expect(page.locator('#dropdown-hydraulic-logic')).toBeVisible();

  const menuState = await page.evaluate(() => ({
    aboutHidden: document.getElementById('aboutModal')?.hasAttribute('hidden') || false,
    fileVisible: getComputedStyle(document.getElementById('dropdown-file')).display !== 'none',
    toolsVisible: getComputedStyle(document.getElementById('dropdown-tools')).display !== 'none',
    helpVisible: getComputedStyle(document.getElementById('dropdown-help')).display !== 'none',
    solveDisabled: document.getElementById('btn-solve')?.disabled || false,
    lifecycleKey: window.EngineeringCalculationLifecycle?.cacheKey || null
  }));

  expect(menuState.aboutHidden).toBe(true);
  expect(menuState.helpVisible).toBe(true);
  expect(menuState.solveDisabled).toBe(false);

  console.log(JSON.stringify({
    menuFirstLoadE2E: 'pass',
    ...menuState
  }, null, 2));
});
