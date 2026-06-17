const { test, expect } = require('@playwright/test');

async function gotoWithProgressOverlay(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (
    window.EngineeringRealtimeCalculationDefense?.version === 'engineering-realtime-calculation-defense.v9'
    && window.EngineeringCalculationLifecycle?.version === 'engineering-calculation-lifecycle.v1'
    && window.EngineeringCalculationProgressOverlay?.version === 'engineering-calculation-progress-overlay.v1'
  ), null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.EngineeringCalculationProgressOverlay?.hideOverlay?.());
}

function dispatchCalculationEvent(page, name, detail = {}) {
  return page.evaluate(({ eventName, eventDetail }) => {
    document.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail }));
  }, { eventName: name, eventDetail: detail });
}

test('calculation progress overlay appears after delay and hides when results become current', async ({ page }) => {
  await gotoWithProgressOverlay(page);
  const overlay = page.locator('#engineeringCalculationProgressOverlay');

  const immediateInputOverlay = await page.evaluate(() => {
    window.__engineeringRealtimeCalculationDefenseAllowSyntheticAutoSolve = false;
    const taskWindow = document.createElement('section');
    taskWindow.className = 'task-window';
    taskWindow.dataset.nodeId = 'P-100';
    const input = document.createElement('input');
    input.name = 'designFlow';
    input.value = '51';
    taskWindow.appendChild(input);
    document.body.appendChild(taskWindow);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const overlayNode = document.getElementById('engineeringCalculationProgressOverlay');
    const snapshot = {
      visible: overlayNode?.dataset.visible || null,
      text: overlayNode?.textContent || ''
    };
    taskWindow.remove();
    return snapshot;
  });
  expect(immediateInputOverlay.visible).toBe('true');
  expect(immediateInputOverlay.text).toContain('Preparing recalculation');
  expect(immediateInputOverlay.text).toContain('Input changed');
  await expect(overlay).toHaveAttribute('data-visible', 'true');
  await dispatchCalculationEvent(page, 'npsh:calculation-current', {
    calculationId: 'calculation-progress-real-input'
  });
  await page.evaluate(() => window.EngineeringCalculationProgressOverlay?.hideOverlay?.());
  await expect(overlay).toHaveAttribute('data-visible', 'false');

  await dispatchCalculationEvent(page, 'npsh:calculation-stale', {
    reason: 'Input changed; waiting for protected backend recalculation.',
    nodeId: 'PIPE-2'
  });
  await expect(overlay).toHaveAttribute('data-visible', 'true');
  await expect(overlay).toContainText('Preparing recalculation');
  await expect(overlay).toContainText('Input changed');

  await dispatchCalculationEvent(page, 'npsh:realtime-autosolve-scheduled', {
    reason: 'Input changed; waiting for protected backend recalculation.',
    nodeId: 'PIPE-2',
    delayMs: 650
  });
  await expect(overlay).toContainText('Waiting for input to settle');
  await expect(overlay).toContainText('Waiting 650 ms');

  await dispatchCalculationEvent(page, 'npsh:calculation-current', {
    calculationId: 'calculation-progress-lifecycle'
  });
  await page.evaluate(() => window.EngineeringCalculationProgressOverlay?.hideOverlay?.());
  await expect(overlay).toHaveAttribute('data-visible', 'false');

  await dispatchCalculationEvent(page, 'npsh:calculation-calculating', {
    reason: 'Fast backend recalculation.'
  });
  await dispatchCalculationEvent(page, 'npsh:calculation-current', {
    calculationId: 'calculation-progress-fast'
  });
  await page.waitForTimeout(320);
  await expect(overlay).toHaveAttribute('data-visible', 'false');

  await dispatchCalculationEvent(page, 'npsh:calculation-calculating', {
    reason: 'Backend recalculation in progress.'
  });
  await expect(overlay).toHaveAttribute('data-visible', 'true');
  await expect(overlay).toContainText('Calculation in Progress');
  await expect(overlay).toContainText('Solving hydraulic network');
  await expect(overlay).toContainText('\u2713');
  await expect(overlay).toContainText('Reading inputs');
  await expect(overlay).toContainText('\u25cf');
  await expect(overlay).toContainText('Solving network');
  await expect(overlay).toContainText('\u25cb');
  await expect(overlay).toContainText('Updating results');
  await expect(overlay).toContainText('Refreshing evidence');

  const nonBlocking = await overlay.evaluate((node) => getComputedStyle(node).pointerEvents);
  expect(nonBlocking).toBe('none');

  await dispatchCalculationEvent(page, 'npsh:linked-views-refreshed', {
    reason: 'linked views refreshed'
  });
  await expect(overlay).toContainText('Refreshing evidence');

  await dispatchCalculationEvent(page, 'npsh:calculation-current', {
    calculationId: 'calculation-progress-e2e'
  });
  await expect(overlay).toHaveAttribute('data-visible', 'false', { timeout: 1200 });
});

test('calculation progress overlay uses task-specific text and shows error fallback', async ({ page }) => {
  await gotoWithProgressOverlay(page);
  const overlay = page.locator('#engineeringCalculationProgressOverlay');

  await page.evaluate(() => {
    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.setAttribute('data-i18n-text', 'menu.runHydraulicNpshEvaluation');
    document.body.appendChild(runButton);
    runButton.click();
    runButton.remove();
  });
  await expect(overlay).toHaveAttribute('data-visible', 'true');
  await expect(overlay).toContainText('Calculation in Progress');
  await dispatchCalculationEvent(page, 'npsh:calculation-current', {
    calculationId: 'calculation-progress-command'
  });
  await expect(overlay).toHaveAttribute('data-visible', 'false', { timeout: 1200 });

  await dispatchCalculationEvent(page, 'npsh:realtime-autosolve-start', {
    reason: 'Input changed; protected backend recalculation is running.',
    nodeId: 'PUMP-100'
  });
  await expect(overlay).toHaveAttribute('data-visible', 'true');
  await expect(overlay).toContainText('Updating pump NPSH and performance');
  await dispatchCalculationEvent(page, 'npsh:calculation-current', {
    calculationId: 'calculation-progress-start'
  });
  await expect(overlay).toHaveAttribute('data-visible', 'false', { timeout: 1200 });

  await dispatchCalculationEvent(page, 'npsh:calculation-calculating', {
    reason: 'PIPE-2 diameter changed; backend recalculation is running.',
    nodeIds: ['PIPE-2', 'PUMP-100']
  });
  await page.waitForTimeout(320);
  await expect(overlay).toHaveAttribute('data-visible', 'true');
  await expect(overlay).toContainText('Recalculating pipe losses');

  await dispatchCalculationEvent(page, 'npsh:realtime-autosolve-error', {
    nodeId: 'PIPE-2',
    message: 'Backend timeout during test'
  });
  await expect(overlay).toHaveAttribute('data-state', 'error');
  await expect(overlay).toHaveAttribute('data-visible', 'true');
  await expect(overlay).toContainText('Calculation Failed');
  await expect(overlay).toContainText('Backend timeout during test');
  await expect(overlay).toContainText('Last valid result is still shown.');
});

test('calculation lifecycle locks Validate command until a final state is reached', async ({ page }) => {
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

    document.dispatchEvent(new CustomEvent('npsh:realtime-autosolve-scheduled', {
      detail: {
        nodeId: 'PUMP-100',
        delayMs: 240,
        reason: 'Input changed; waiting for protected backend recalculation.'
      }
    }));
    const waiting = {
      disabled: button.disabled,
      ariaBusy: button.getAttribute('aria-busy'),
      busy: button.dataset.calculationBusy,
      label: label.textContent
    };

    document.dispatchEvent(new CustomEvent('npsh:calculation-current', {
      detail: {
        nodeId: 'PUMP-100',
        calculationId: 'calculation-final-state-current'
      }
    }));
    const current = {
      disabled: button.disabled,
      ariaBusy: button.getAttribute('aria-busy'),
      busy: button.dataset.calculationBusy,
      label: label.textContent
    };

    window.EngineeringCalculationLifecycle.markCalculationActivity('trusted-input', {
      calculationMode: 'realtime-input',
      nodeId: 'PUMP-100'
    });
    document.dispatchEvent(new CustomEvent('npsh:calculation-calculating', {
      detail: {
        nodeId: 'PUMP-100',
        reason: 'Backend recalculation in progress.'
      }
    }));
    const calculating = {
      disabled: button.disabled,
      ariaBusy: button.getAttribute('aria-busy'),
      busy: button.dataset.calculationBusy,
      label: label.textContent
    };

    document.dispatchEvent(new CustomEvent('npsh:calculation-failed', {
      detail: {
        nodeId: 'PUMP-100',
        message: 'Backend timeout during final-state lock test'
      }
    }));
    const failed = {
      disabled: button.disabled,
      ariaBusy: button.getAttribute('aria-busy'),
      busy: button.dataset.calculationBusy,
      label: label.textContent
    };

    button.remove();
    return { waiting, current, calculating, failed };
  });

  expect(snapshot.waiting.disabled).toBe(true);
  expect(snapshot.waiting.ariaBusy).toBe('true');
  expect(snapshot.waiting.busy).toBe('true');
  expect(snapshot.waiting.label).toBe('Preparing...');

  expect(snapshot.current.disabled).toBe(false);
  expect(snapshot.current.ariaBusy).toBe('false');
  expect(snapshot.current.busy).toBe('false');
  expect(snapshot.current.label).toBe('Validate');

  expect(snapshot.calculating.disabled).toBe(true);
  expect(snapshot.calculating.label).toBe('Calculating...');

  expect(snapshot.failed.disabled).toBe(false);
  expect(snapshot.failed.ariaBusy).toBe('false');
  expect(snapshot.failed.busy).toBe('false');
  expect(snapshot.failed.label).toBe('Validate');
});
