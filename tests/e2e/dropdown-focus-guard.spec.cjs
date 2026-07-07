const { test, expect } = require('@playwright/test');

test('dropdown focus guard releases focused menu item before aria-hidden hide', async ({ page }) => {
  const ariaHiddenWarnings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('Blocked aria-hidden')) ariaHiddenWarnings.push(text);
  });

  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    window.EngineeringDropdownFocusGuardRuntime?.VERSION === 'engineering-dropdown-focus-guard-runtime.v2'
  ), null, { timeout: 30000 });

  const result = await page.evaluate(() => {
    const menuTrigger = document.getElementById('menu-simulate');
    const dropdown = document.getElementById('dropdown-simulate');
    if (!menuTrigger || !dropdown) throw new Error('Simulate menu markup is unavailable.');
    let caseItem = document.getElementById('simulation-case-6');
    if (!caseItem) {
      caseItem = document.createElement('button');
      caseItem.type = 'button';
      caseItem.id = 'simulation-case-6';
      caseItem.textContent = 'Simulation Cases 6';
      dropdown.appendChild(caseItem);
    }
    dropdown.style.display = 'block';
    dropdown.removeAttribute('aria-hidden');
    caseItem.focus({ preventScroll: true });
    if (document.activeElement !== caseItem) throw new Error('Simulation case item could not receive focus.');
    dropdown.setAttribute('aria-hidden', 'true');
    return {
      activeId: document.activeElement?.id,
      hidden: dropdown.getAttribute('aria-hidden'),
      focusStillInsideDropdown: dropdown.contains(document.activeElement)
    };
  });

  expect(result.hidden).toBe('true');
  expect(result.focusStillInsideDropdown).toBe(false);
  expect(result.activeId).toBe('menu-simulate');
  expect(ariaHiddenWarnings).toEqual([]);
});

test('real Simulation menu close has no blocked aria-hidden console warning', async ({ page }) => {
  const ariaHiddenWarnings = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('Blocked aria-hidden')) ariaHiddenWarnings.push(text);
  });

  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    window.EngineeringDropdownFocusGuardRuntime?.VERSION === 'engineering-dropdown-focus-guard-runtime.v2'
  ), null, { timeout: 30000 });

  await page.click('#menu-simulate');
  await expect(page.locator('#dropdown-simulate')).toBeVisible();
  await page.waitForSelector('#dropdown-simulate .simulation-case-menu-item[data-simulation-case-id="simulation-case-6"]', { timeout: 10000 });
  await page.evaluate(() => {
    const item = document.querySelector('#dropdown-simulate .simulation-case-menu-item[data-simulation-case-id="simulation-case-6"] .dropdown-submenu-trigger');
    item?.setAttribute('tabindex', '0');
    item?.focus({ preventScroll: true });
    if (document.activeElement !== item) throw new Error('Simulation Cases 6 item did not receive focus.');
  });
  await page.click('#menu-file');
  await page.waitForTimeout(100);

  const focusState = await page.evaluate(() => {
    const dropdown = document.getElementById('dropdown-simulate');
    return {
      activeId: document.activeElement?.id || '',
      focusStillInsideDropdown: !!dropdown?.contains(document.activeElement)
    };
  });
  expect(focusState.focusStillInsideDropdown).toBe(false);
  expect(ariaHiddenWarnings).toEqual([]);
});
