const { test, expect } = require('@playwright/test');

async function gotoWithProgressOverlay(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v9'
    && window.EngineeringCalculationLifecycle?.version === 'engineering-calculation-lifecycle.v1'
    && window.EngineeringCalculationProgressOverlay?.version === 'engineering-calculation-progress-overlay.v1'
  ), null, { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.EngineeringCalculationProgressOverlay?.hideOverlay?.());
}

function dispatchCalculationEvent(page, name, detail = {}) {
  return page.evaluate(({ eventName, eventDetail }) => {
    document.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail }));
  }, { eventName: name, eventDetail: detail });
}

test('realtime autosolve keeps Validate available and does not show the progress overlay', async ({ page }) => {
  await gotoWithProgressOverlay(page);

  const snapshot = await page.evaluate(() => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'btn-solve';
    const label = document.createElement('span');
    label.className = 'ribbon-label';
    label.textContent = 'Validate';
    button.appendChild(label);
    document.body.appendChild(button);

    const detail = {
      calculationMode: 'realtime-input',
      nodeId: 'PUMP-100',
      delayMs: 240,
      reason: 'Input changed; waiting for protected backend recalculation.'
    };

    document.dispatchEvent(new CustomEvent('npsh:realtime-autosolve-scheduled', { detail }));
    const waiting = {
      disabled: button.disabled,
      ariaBusy: button.getAttribute('aria-busy'),
      busy: button.dataset.calculationBusy,
      label: label.textContent,
      overlayVisible: document.getElementById('engineeringCalculationProgressOverlay')?.dataset.visible || null
    };

    document.dispatchEvent(new CustomEvent('npsh:calculation-calculating', {
      detail: { ...detail, reason: 'Backend recalculation in progress.' }
    }));
    document.dispatchEvent(new CustomEvent('npsh:realtime-autosolve-start', {
      detail: { ...detail, reason: 'Input changed; protected backend recalculation is running.' }
    }));
    const calculating = {
      disabled: button.disabled,
      ariaBusy: button.getAttribute('aria-busy'),
      busy: button.dataset.calculationBusy,
      label: label.textContent,
      overlayVisible: document.getElementById('engineeringCalculationProgressOverlay')?.dataset.visible || null
    };

    document.dispatchEvent(new CustomEvent('npsh:calculation-current', {
      detail: { ...detail, calculationId: 'realtime-current-without-solve' }
    }));
    const current = {
      disabled: button.disabled,
      ariaBusy: button.getAttribute('aria-busy'),
      busy: button.dataset.calculationBusy,
      label: label.textContent,
      overlayVisible: document.getElementById('engineeringCalculationProgressOverlay')?.dataset.visible || null
    };

    document.dispatchEvent(new CustomEvent('npsh:calculation-failed', {
      detail: { ...detail, message: 'Backend timeout during realtime validation test' }
    }));
    const failed = {
      disabled: button.disabled,
      ariaBusy: button.getAttribute('aria-busy'),
      busy: button.dataset.calculationBusy,
      label: label.textContent,
      overlayVisible: document.getElementById('engineeringCalculationProgressOverlay')?.dataset.visible || null
    };

    button.remove();
    return { waiting, calculating, current, failed };
  });

  for (const state of [snapshot.waiting, snapshot.calculating, snapshot.current, snapshot.failed]) {
    expect(state.disabled).toBe(false);
    expect(state.ariaBusy).toBe('false');
    expect(state.busy).toBe('false');
    expect(state.label).toBe('Validate');
    expect(state.overlayVisible).not.toBe('true');
  }
});

test('manual Validate still shows compact progress and evidence refresh feedback', async ({ page }) => {
  await gotoWithProgressOverlay(page);
  const overlay = page.locator('#engineeringCalculationProgressOverlay');

  await page.evaluate(() => {
    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.id = 'btn-solve';
    runButton.setAttribute('data-i18n-text', 'menu.runHydraulicNpshEvaluation');
    document.body.appendChild(runButton);
    runButton.click();
    runButton.remove();
  });
  await expect(overlay).toHaveAttribute('data-visible', 'true');
  await expect(overlay).toContainText('Calculation in Progress');

  await dispatchCalculationEvent(page, 'npsh:calculation-calculating', {
    calculationMode: 'manual-solve',
    reason: 'PIPE-2 diameter changed; backend recalculation is running.',
    nodeIds: ['PIPE-2', 'PUMP-100']
  });
  await expect(overlay).toContainText('Recalculating pipe losses');
  const nonBlocking = await overlay.evaluate((node) => getComputedStyle(node).pointerEvents);
  expect(nonBlocking).toBe('none');

  await dispatchCalculationEvent(page, 'npsh:linked-views-refreshed', {
    calculationMode: 'manual-solve',
    reason: 'linked views refreshed'
  });
  await expect(overlay).toContainText('Refreshing evidence');

  await dispatchCalculationEvent(page, 'npsh:calculation-current', {
    calculationMode: 'manual-solve',
    calculationId: 'manual-validate-current'
  });
  await expect(overlay).toHaveAttribute('data-visible', 'false', { timeout: 1200 });
});

test('manual calculation errors keep the short fallback message visible', async ({ page }) => {
  await gotoWithProgressOverlay(page);
  const overlay = page.locator('#engineeringCalculationProgressOverlay');

  await page.evaluate(() => {
    window.EngineeringCalculationLifecycle.markCalculationActivity('manual-command', {
      calculationMode: 'manual-solve',
      nodeId: 'btn-solve'
    });
  });
  await dispatchCalculationEvent(page, 'npsh:calculation-calculating', {
    calculationMode: 'manual-solve',
    reason: 'Pump curve NPSHr changed'
  });
  await expect(overlay).toHaveAttribute('data-visible', 'true');
  await expect(overlay).toContainText('Updating pump NPSH and performance');

  await dispatchCalculationEvent(page, 'npsh:realtime-autosolve-error', {
    calculationMode: 'manual-solve',
    nodeId: 'PUMP-100',
    message: 'Backend timeout during test'
  });
  await expect(overlay).toHaveAttribute('data-state', 'error');
  await expect(overlay).toHaveAttribute('data-visible', 'true');
  await expect(overlay).toContainText('Calculation Failed');
  await expect(overlay).toContainText('Backend timeout during test');
  await expect(overlay).toContainText('Last valid result is still shown.');
});
