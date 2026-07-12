const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    window.__NPSH_PERFORMANCE_BASELINE_SILENT__ = true;
  });
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.updateSimulation === 'function'
    && window.EngineeringSimulationLoadTransaction?.cacheKey === '20260712-simulation-load-primary-apply-evidence-lock1'
    && window.EngineeringPerformanceBaselineRuntime?.cacheKey === '20260709-performance-baseline1'
    && window.EngineeringRuntimeHealthAudit?.cacheKey === '20260710-runtime-health-audit-phase10-1'
  ), null, { timeout: 30000 });
  await page.evaluate(() => {
    window.EngineeringPerformanceBaselineRuntime?.reset?.();
    window.EngineeringRuntimeHealthAudit?.reset?.();
  });
}

async function openSimulationCase(page, caseId) {
  await page.click('#menu-simulate');
  await page.waitForSelector(`#dropdown-simulate [data-simulation-case-id="${caseId}"]`, { timeout: 15000 });
  await page.evaluate((id) => {
    const root = document.querySelector(`#dropdown-simulate [data-simulation-case-id="${id}"]`);
    const openTarget = root?.querySelector?.('[data-simulation-case-action="open"]')
      || root?.querySelector?.('button, [role="menuitem"], .dropdown-submenu-trigger')
      || root;
    openTarget?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }, caseId);
  const dialog = page.getByRole('dialog', { name: /Simulation Cases/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Open Sample Case' }).click();
}

async function waitUntilNotBusy(page) {
  await page.waitForFunction(() => {
    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '';
    const lifecycle = window.EngineeringCalculationLifecycle?.current?.();
    const transaction = window.EngineeringSimulationLoadTransaction?.current?.();
    return label === 'Validate'
      && !solve?.disabled
      && solve?.dataset?.calculationBusy !== 'true'
      && lifecycle?.status !== 'calculating'
      && lifecycle?.status !== 'applying-results'
      && lifecycle?.status !== 'preparing'
      && lifecycle?.status !== 'refreshing-evidence'
      && transaction?.status !== 'active';
  }, null, { timeout: 30000 });
}

test('runtime health audit records settled case health without blocking Validate', async ({ page }) => {
  await waitForNpshApp(page);
  await openSimulationCase(page, 'simulation-case-6');
  await waitUntilNotBusy(page);

  const health = await page.evaluate(() => {
    const audit = window.EngineeringRuntimeHealthAudit.audit('e2e-case-6-health');
    const summary = window.EngineeringRuntimeHealthAudit.summary();
    const solve = document.getElementById('btn-solve');
    return {
      audit,
      summary,
      disabled: !!solve?.disabled,
      busy: solve?.dataset?.calculationBusy || '',
      label: solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || ''
    };
  });

  expect(health.audit.cacheKey).toBe('20260710-runtime-health-audit-phase10-1');
  expect(['healthy', 'warning']).toContain(health.audit.status);
  expect(health.summary.lastAudit.reason).toBe('e2e-case-6-health');
  expect(health.disabled).toBe(false);
  expect(health.busy).not.toBe('true');
  expect(health.label).toBe('Validate');
});

test('runtime idle maintenance trims diagnostic buffers after settled load bursts', async ({ page }) => {
  await waitForNpshApp(page);

  const maintenance = await page.evaluate(() => {
    const api = window.EngineeringRuntimeHealthAudit;
    const events = [];
    document.addEventListener('npsh:runtime-idle-maintenance', (event) => {
      events.push(event.detail || {});
    });

    for (let index = 0; index < 44; index += 1) {
      api.audit(`e2e-buffer-audit-${index}`);
    }
    for (let index = 0; index < 16; index += 1) {
      api.noteLoadSettle({ caseId: `simulation-case-${index}`, sessionId: `session-${index}` }, 'npsh:simulation-load-transaction-complete');
    }

    const before = api.maintenanceSummary();
    const entry = api.runIdleMaintenance('e2e-idle-maintenance-trim', {
      force: true,
      retainAudits: 6,
      retainLoads: 4
    });
    api.clearMaintenanceTimers('e2e-cleanup');
    const after = api.maintenanceSummary();
    const solve = document.getElementById('btn-solve');

    return {
      before,
      entry,
      after,
      events: events.length,
      historyLength: api.history().length,
      label: solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '',
      disabled: !!solve?.disabled,
      busy: solve?.dataset?.calculationBusy || ''
    };
  });

  expect(maintenance.before.retainedAudits).toBeGreaterThan(6);
  expect(maintenance.before.retainedLoadHistory).toBeGreaterThan(4);
  expect(maintenance.entry.status).toBe('maintained');
  expect(maintenance.entry.actions).toContain('trim-health-audits:38');
  expect(maintenance.entry.actions).toContain('trim-load-history:12');
  expect(maintenance.after.retainedAudits).toBe(6);
  expect(maintenance.after.retainedLoadHistory).toBe(4);
  expect(maintenance.after.stats.runs).toBeGreaterThanOrEqual(1);
  expect(maintenance.events).toBeGreaterThanOrEqual(1);
  expect(maintenance.historyLength).toBe(6);
  expect(maintenance.disabled).toBe(false);
  expect(maintenance.busy).not.toBe('true');
  expect(maintenance.label).toBe('Validate');
});

test('runtime health audit self-heals stale Calculating command after settled load', async ({ page }) => {
  await waitForNpshApp(page);

  const health = await page.evaluate(() => {
    const events = [];
    document.addEventListener('npsh:runtime-health-audit', (event) => {
      events.push(event.detail || {});
    });

    const transaction = window.EngineeringSimulationLoadTransaction;
    const session = transaction.beginTransaction('e2e-runtime-health-audit', { caseId: 'simulation-case-6' });
    transaction.complete(session.sessionId, { reason: 'e2e-runtime-health-audit-complete' });

    const solve = document.getElementById('btn-solve');
    const label = solve?.querySelector?.('.ribbon-label');
    if (solve) {
      solve.disabled = true;
      solve.dataset.calculationBusy = 'true';
      solve.setAttribute('aria-busy', 'true');
      solve.setAttribute('aria-disabled', 'true');
      if (label) label.textContent = 'Calculating...';
    }
    document.body.classList.add('npsh-simulation-load-transaction-active');

    const before = window.EngineeringRuntimeHealthAudit.summary();
    const audit = window.EngineeringRuntimeHealthAudit.audit('e2e-stale-calculating-health', { forceReadiness: true });
    const after = window.EngineeringRuntimeHealthAudit.summary();

    return {
      before,
      audit,
      after,
      events: events.length,
      label: label?.textContent?.trim() || '',
      disabled: !!solve?.disabled,
      calculationBusy: solve?.dataset?.calculationBusy || '',
      ariaBusy: solve?.getAttribute('aria-busy') || '',
      ariaDisabled: solve?.getAttribute('aria-disabled') || '',
      activeClass: document.body.classList.contains('npsh-simulation-load-transaction-active')
    };
  });

  expect(health.audit.status).toBe('critical');
  expect(health.audit.reasons).toContain('validate-command-stale-busy');
  expect(health.audit.reasons).toContain('load-active-class-stale');
  expect(health.audit.actions).toContain('transaction-settle-audit');
  expect(health.events).toBeGreaterThanOrEqual(1);
  expect(health.after.stats.audits).toBeGreaterThan(health.before.stats.audits);
  expect(health.disabled).toBe(false);
  expect(health.calculationBusy).toBe('false');
  expect(health.ariaBusy).toBe('false');
  expect(health.ariaDisabled).toBe('false');
  expect(health.activeClass).toBe(false);
  expect(health.label).toBe('Validate');
});

test('runtime footprint guard detects DOM growth and prunes transient load artifacts', async ({ page }) => {
  await waitForNpshApp(page);

  const footprint = await page.evaluate(() => {
    const api = window.EngineeringRuntimeHealthAudit;
    const events = [];
    document.addEventListener('npsh:runtime-load-footprint', (event) => {
      events.push(event.detail || {});
    });

    const baseline = api.recordFootprint('e2e-footprint-baseline');
    for (let index = 0; index < 150; index += 1) {
      const node = document.createElement('div');
      node.dataset.simulationLoadTransient = 'true';
      node.className = 'simulation-load-transient';
      node.textContent = `transient footprint node ${index}`;
      document.body.appendChild(node);
    }
    const transientBefore = document.querySelectorAll('[data-simulation-load-transient="true"]').length;
    const warning = api.recordFootprint('e2e-footprint-growth', { selfHeal: true });
    const transientAfter = document.querySelectorAll('[data-simulation-load-transient="true"]').length;
    const summary = api.footprintSummary();
    const maintenance = api.maintenanceSummary();
    return {
      baseline,
      warning,
      events: events.length,
      transientBefore,
      transientAfter,
      summary,
      maintenance
    };
  });

  expect(footprint.baseline.status).toBe('stable');
  expect(footprint.warning.status).toBe('warning');
  expect(footprint.warning.warnings).toContain('bodyDomNodes-growth');
  expect(footprint.warning.deltas.bodyDomNodes).toBeGreaterThan(120);
  expect(footprint.events).toBeGreaterThanOrEqual(2);
  expect(footprint.transientBefore).toBe(150);
  expect(footprint.transientAfter).toBe(0);
  expect(footprint.summary.stats.samples).toBeGreaterThanOrEqual(2);
  expect(footprint.summary.stats.selfHeals).toBeGreaterThanOrEqual(1);
  expect(footprint.maintenance.stats.runs).toBeGreaterThanOrEqual(1);
  expect(footprint.maintenance.stats.lastActions.some((action) => /^load-artifacts-pruned:/.test(action))).toBe(true);
});

test('runtime reliability evidence snapshot opens opt-in panel without blocking Validate', async ({ page }) => {
  await waitForNpshApp(page);
  await openSimulationCase(page, 'simulation-case-6');
  await waitUntilNotBusy(page);

  const evidence = await page.evaluate(() => {
    const events = [];
    document.addEventListener('npsh:runtime-reliability-evidence', (event) => {
      events.push(event.detail || {});
    });
    const api = window.EngineeringRuntimeHealthAudit;
    const snapshot = api.captureReliabilityEvidence('e2e-evidence-capture');
    const panelEvidence = api.openReliabilityEvidencePanel('e2e-evidence-panel');
    const panel = document.getElementById('npshReliabilityEvidencePanel');
    const jsonText = panel?.querySelector('[data-evidence-json]')?.textContent || '';
    const metricsText = panel?.querySelector('[data-evidence-summary]')?.textContent || '';
    const closeResult = api.closeReliabilityEvidencePanel();
    const solve = document.getElementById('btn-solve');
    return {
      snapshot,
      panelEvidence,
      events: events.length,
      panelExists: !!panel,
      panelHiddenAfterClose: !!panel?.hidden,
      jsonHasCacheKey: jsonText.includes('20260710-runtime-health-audit-phase10-1'),
      metricsText,
      closeResult,
      label: solve?.querySelector?.('.ribbon-label')?.textContent?.trim() || '',
      disabled: !!solve?.disabled,
      busy: solve?.dataset?.calculationBusy || ''
    };
  });

  expect(evidence.snapshot.cacheKey).toBe('20260710-runtime-health-audit-phase10-1');
  expect(['healthy', 'watch', 'attention']).toContain(evidence.snapshot.status);
  expect(evidence.snapshot.recent.audits).toBeInstanceOf(Array);
  expect(evidence.snapshot.transaction.current.status).toBe('completed');
  expect(evidence.panelEvidence.reason).toBe('e2e-evidence-panel');
  expect(evidence.events).toBeGreaterThanOrEqual(2);
  expect(evidence.panelExists).toBe(true);
  expect(evidence.panelHiddenAfterClose).toBe(true);
  expect(evidence.jsonHasCacheKey).toBe(true);
  expect(evidence.metricsText).toContain('Status');
  expect(evidence.closeResult).toBe(true);
  expect(evidence.disabled).toBe(false);
  expect(evidence.busy).not.toBe('true');
  expect(evidence.label).toBe('Validate');
});
