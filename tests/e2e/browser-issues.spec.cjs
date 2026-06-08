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
  expect(browserIssueState.invalidMenus).toEqual([]);

  console.log(JSON.stringify({
    browserIssuesE2E: 'pass',
    documentContentType: documentHeaders['content-type'],
    runtimeCacheControl: runtimeResponse.headers()['cache-control'],
    svgContentType: svgResponse.headers()['content-type'],
    apiContentType: apiHeaders['content-type'],
    invalidMenus: browserIssueState.invalidMenus
  }, null, 2));
});
