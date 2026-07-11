const { test, expect } = require('@playwright/test');

async function waitForNpshApp(page) {
  await page.goto('/');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__npshLoadSupport?.());
  await page.waitForFunction(() => (
    typeof window.renderObjectProperties === 'function'
    && window.EngineeringSourceVolumetricOnlyRuntime?.version === '2026.07-source-route-flow-lock4-src-input-flash-lock'
  ), null, { timeout: 30000 });
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
  await page.waitForFunction(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    return Object.values(model).some((node) => node?.type === 'source');
  }, null, { timeout: 30000 });
}

test('SRC Boundary Data legacy rows are hidden immediately and removed after render/input refresh', async ({ page }) => {
  await waitForNpshApp(page);
  await openSimulationCase(page, 'simulation-case-6');

  const state = await page.evaluate(async () => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const sourceId = Object.keys(model).find((id) => model[id]?.type === 'source');
    if (!sourceId) throw new Error('Source node was not loaded.');

    function createLegacyProbe() {
      const scope = document.createElement('section');
      scope.className = 'task-window object-properties-task-body';
      scope.dataset.kind = 'object';
      const probe = document.createElement('table');
      probe.id = 'src-boundary-no-flash-css-probe';
      probe.innerHTML = `
        <tbody>
          <tr id="probe-source-definition"><td class="prop-section-header" data-i18n-text="sidebar.section.sourceDefinition" data-i18n-fallback="Source Definition">Source Definition</td></tr>
          <tr id="probe-source-type" data-prop-key="sourceType"><td><select data-key="sourceType"><option>Fixed Flow Source</option></select></td></tr>
          <tr id="probe-flow-specification"><td class="prop-section-header" data-i18n-text="sidebar.section.flowSpecification" data-i18n-fallback="Flow Specification">Flow Specification</td></tr>
          <tr id="probe-flow-mode" data-prop-key="flowInputMode"><td><select data-key="flowInputMode"><option>Mass Flow</option></select></td></tr>
          <tr id="probe-source-mass-flow" data-prop-key="source-mass-flow"><td><input data-key="source-mass-flow" value="1"></td></tr>
          <tr id="probe-toolbar" class="source-defense-toolbar-row"><td>Advisor-ready SRC boundary explanation</td></tr>
        </tbody>`;
      scope.appendChild(probe);
      document.body.appendChild(scope);
      const display = Object.fromEntries(Array.from(probe.querySelectorAll('tr')).map((row) => [
        row.id,
        getComputedStyle(row).display
      ]));
      scope.remove();
      return display;
    }

    function appendPropertyRow(label, value, key, readonly, unit, type, options) {
      const tr = document.createElement('tr');
      tr.className = 'object-task-field-row';
      tr.dataset.propKey = key;
      const labelCell = document.createElement('td');
      labelCell.className = 'prop-label';
      labelCell.textContent = label;
      const valueCell = document.createElement('td');
      valueCell.className = 'prop-value';
      const control = document.createElement(type === 'select' ? 'select' : 'input');
      control.dataset.key = key;
      control.dataset.node = sourceId;
      control.name = key;
      if (type === 'select' && Array.isArray(options)) {
        options.forEach((option) => {
          const element = document.createElement('option');
          element.value = option;
          element.textContent = option;
          control.appendChild(element);
        });
      } else {
        control.type = type || 'text';
      }
      control.value = value ?? '';
      control.readOnly = !!readonly;
      valueCell.appendChild(control);
      if (unit) {
        const unitElement = document.createElement('span');
        unitElement.className = 'input-unit';
        unitElement.textContent = unit;
        valueCell.appendChild(unitElement);
      }
      tr.append(labelCell, valueCell);
      taskBody.appendChild(tr);
    }

    const cssDisplay = createLegacyProbe();
    const task = document.createElement('section');
    task.className = 'task-window object-properties-task-body';
    task.dataset.kind = 'object';
    task.dataset.nodeId = sourceId;
    const table = document.createElement('table');
    table.className = 'prop-table object-task-prop-table';
    const taskBody = document.createElement('tbody');
    taskBody.dataset.taskPropBody = 'true';
    taskBody.dataset.taskKind = 'object';
    taskBody.dataset.nodeId = sourceId;
    table.appendChild(taskBody);
    task.appendChild(table);
    document.body.appendChild(task);

    window.renderObjectProperties('source', sourceId, model[sourceId], appendPropertyRow, taskBody);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const flowInput = task.querySelector('input[data-key="flow"][data-node]');
    if (!flowInput) throw new Error('Volumetric Flow input was not rendered inside Boundary Data.');
    flowInput.value = '41.25';
    flowInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText' }));
    document.dispatchEvent(new CustomEvent('npsh:calculation-current', { detail: { reason: 'e2e-src-boundary-no-flash' } }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const rows = Array.from(taskBody.querySelectorAll('tr')).map((row) => ({
      key: row.dataset.propKey || '',
      text: (row.textContent || '').replace(/\s+/g, ' ').trim(),
      display: getComputedStyle(row).display
    }));
    const text = rows.map((row) => row.text).join(' | ');
    const keys = rows.map((row) => row.key).filter(Boolean);
    const flowIndex = rows.findIndex((row) => row.key === 'flow');
    const boundaryIndex = rows.findIndex((row) => /^Boundary Data$/i.test(row.text));
    const fluidBasisIndex = rows.findIndex((row) => /^Fluid Basis Link$/i.test(row.text));
    const hiddenLegacyRows = rows.filter((row) => (
      /Source Definition|Flow Specification|Source Type|Flow Input Mode|Mass Flow|Semantic Attachment|Advisor-ready SRC/i.test(row.text)
      || ['sourceType', 'flowInputMode', 'massFlow', 'source-mass-flow'].includes(row.key)
    ));
    const sourceFlow = Number((window.__npshGlobalModel || window.globalModel || {})[sourceId]?.props?.flow);
    task.remove();
    return {
      cssDisplay,
      text,
      keys,
      flowIndex,
      boundaryIndex,
      fluidBasisIndex,
      hiddenLegacyRows,
      flowValue: flowInput.value,
      sourceFlow
    };
  });

  expect(Object.values(state.cssDisplay).every((display) => display === 'none')).toBe(true);
  expect(state.hiddenLegacyRows).toEqual([]);
  expect(state.keys).not.toContain('sourceType');
  expect(state.keys).not.toContain('flowInputMode');
  expect(state.keys).not.toContain('source-mass-flow');
  expect(state.text).toContain('Boundary Data');
  expect(state.text).toContain('Volumetric Flow');
  expect(state.flowIndex).toBeGreaterThan(state.boundaryIndex);
  expect(state.flowIndex).toBeLessThan(state.fluidBasisIndex);
  expect(state.flowValue).toBe('41.25');
  expect(state.sourceFlow).toBeCloseTo(41.25, 6);
});

test('SRC Boundary Data cleanup runs immediately during async solver task-window refresh', async ({ page }) => {
  await waitForNpshApp(page);
  await openSimulationCase(page, 'simulation-case-6');

  const pendingState = await page.evaluate(async () => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const sourceId = Object.keys(model).find((id) => model[id]?.type === 'source');
    if (!sourceId) throw new Error('Source node was not loaded.');

    const task = document.createElement('section');
    task.id = 'src-boundary-async-refresh-task';
    task.className = 'task-window object-properties-task-body';
    task.dataset.kind = 'object';
    task.dataset.nodeId = sourceId;
    const table = document.createElement('table');
    const body = document.createElement('tbody');
    body.dataset.taskPropBody = 'true';
    body.dataset.taskKind = 'object';
    body.dataset.nodeId = sourceId;
    table.appendChild(body);
    task.appendChild(table);
    document.body.appendChild(task);

    const appendLegacyRows = () => {
      body.insertAdjacentHTML('afterbegin', `
        <tr data-prop-key="sourceType"><td>Source Type</td><td><select data-key="sourceType"><option>Fixed Flow Source</option></select></td></tr>
        <tr><td class="prop-section-header" data-i18n-fallback="Flow Specification">Flow Specification</td></tr>
        <tr data-prop-key="flowInputMode"><td>Flow Input Mode</td><td><select data-key="flowInputMode"><option>Mass Flow</option></select></td></tr>
        <tr data-prop-key="source-mass-flow"><td>Mass Flow</td><td><input data-key="source-mass-flow" value="1"></td></tr>
        <tr class="source-defense-toolbar-row"><td>Advisor-ready SRC boundary explanation</td></tr>
        <tr><td class="prop-section-header">Boundary Data</td></tr>
        <tr data-prop-key="flow"><td>Volumetric Flow</td><td><input data-key="flow" data-node="${sourceId}" value="39.68"></td></tr>
      `);
    };
    const legacyRows = () => Array.from(body.querySelectorAll('tr')).filter((row) => (
      /Source Type|Flow Specification|Flow Input Mode|Mass Flow|Advisor-ready SRC/i.test(row.textContent || '')
      || ['sourceType', 'flowInputMode', 'source-mass-flow'].includes(row.dataset.propKey || '')
      || !!row.querySelector('[data-key="sourceType"], [data-key="flowInputMode"], [data-key="source-mass-flow"]')
    )).map((row) => (row.textContent || '').replace(/\s+/g, ' ').trim());

    window.__srcBoundaryAsyncRefreshDone = false;
    window.refreshBackendProtectedRealtimeTaskWindows = function refreshBackendProtectedRealtimeTaskWindowsForNoFlashTest() {
      appendLegacyRows();
      return new Promise((resolve) => {
        setTimeout(() => {
          window.__srcBoundaryAsyncRefreshDone = true;
          resolve({ ok: true });
        }, 300);
      });
    };
    window.EngineeringSourceVolumetricOnlyRuntime.install();
    const result = window.refreshBackendProtectedRealtimeTaskWindows();
    if (!result || typeof result.then !== 'function') throw new Error('Expected async refresh hook to return a Promise.');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      pendingDone: window.__srcBoundaryAsyncRefreshDone,
      legacyRowsDuringPending: legacyRows(),
      textDuringPending: (body.textContent || '').replace(/\s+/g, ' ').trim()
    };
  });

  expect(pendingState.pendingDone).toBe(false);
  expect(pendingState.legacyRowsDuringPending).toEqual([]);
  expect(pendingState.textDuringPending).toContain('Boundary Data');
  expect(pendingState.textDuringPending).toContain('Volumetric Flow');

  await page.waitForFunction(() => window.__srcBoundaryAsyncRefreshDone === true, null, { timeout: 5000 });
  const finalState = await page.evaluate(() => {
    const body = document.querySelector('#src-boundary-async-refresh-task tbody');
    const legacyRows = Array.from(body?.querySelectorAll('tr') || []).filter((row) => (
      /Source Type|Flow Specification|Flow Input Mode|Mass Flow|Advisor-ready SRC/i.test(row.textContent || '')
      || ['sourceType', 'flowInputMode', 'source-mass-flow'].includes(row.dataset.propKey || '')
      || !!row.querySelector('[data-key="sourceType"], [data-key="flowInputMode"], [data-key="source-mass-flow"]')
    )).map((row) => (row.textContent || '').replace(/\s+/g, ' ').trim());
    document.getElementById('src-boundary-async-refresh-task')?.remove();
    return { legacyRows };
  });
  expect(finalState.legacyRows).toEqual([]);
});

test('actual SRC Object Properties numeric inputs keep stable nodes, layout, focus, and attributes', async ({ page }) => {
  await waitForNpshApp(page);
  await openSimulationCase(page, 'simulation-case-6');
  const sourceId = await page.evaluate(() => {
    const model = window.__npshGlobalModel || window.globalModel || {};
    const id = Object.keys(model).find((nodeId) => model[nodeId]?.type === 'source');
    window.currentSelectedNode = id;
    window.__npshExplicitObjectPropertiesOpenUntil = Date.now() + 15000;
    window.requestObjectPropertiesTaskWindowOpen?.(id);
    window.openSourcePropertiesTaskWindow?.(id);
    window.openObjectPropertiesTaskWindow?.(id);
    const taskWindow = document.querySelector(`.persistent-object-properties-task-window[data-node-id="${id}"]`)
      || document.querySelector('.persistent-object-properties-task-window[data-kind="object"]');
    if (taskWindow) window.renderSidebar?.(id, { taskWindow, skipDismissedGuard: true });
    window.EngineeringSourceVolumetricOnlyRuntime?.cleanup?.(document);
    return id;
  });
  const windowSelector = `.persistent-object-properties-task-window[data-node-id="${sourceId}"]`;
  await page.waitForSelector(windowSelector, { state: 'visible', timeout: 10000 });
  const inputValues = {
    pressure: '2.25',
    flow: '41.125',
    elevation: '3.5'
  };
  for (const key of Object.keys(inputValues)) {
    await page.waitForSelector(`${windowSelector} input[data-key="${key}"]`, { state: 'visible', timeout: 10000 });
  }

  await page.evaluate(({ windowSelector, inputKeys }) => {
    window.__srcNoFlashNodeIds = new WeakMap();
    window.__srcNoFlashNodeSequence = 0;
    const idFor = (node) => {
      if (!node) return 0;
      if (!window.__srcNoFlashNodeIds.has(node)) {
        window.__srcNoFlashNodeIds.set(node, ++window.__srcNoFlashNodeSequence);
      }
      return window.__srcNoFlashNodeIds.get(node);
    };
    const snapshot = (reason) => {
      const task = document.querySelector(windowSelector);
      const body = task?.querySelector('.task-window-body, [data-task-prop-body="true"], #taskWindowBody');
      const rect = task?.getBoundingClientRect();
      const bodyRect = body?.getBoundingClientRect();
      const rows = Array.from(task?.querySelectorAll('[data-prop-key]') || []).map((row) => row.dataset.propKey);
      const inputs = Object.fromEntries(inputKeys.map((key) => {
        const input = task?.querySelector(`input[data-key="${key}"]`);
        const inputRect = input?.getBoundingClientRect();
        return [key, {
          id: idFor(input),
          rect: inputRect ? [inputRect.x, inputRect.y, inputRect.width, inputRect.height].map((value) => Math.round(value * 10) / 10) : null
        }];
      }));
      window.__srcNoFlashSamples.push({
        reason,
        at: performance.now(),
        taskId: idFor(task),
        bodyId: idFor(body),
        inputs,
        activeKey: document.activeElement?.dataset?.key || '',
        taskRect: rect ? [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 10) / 10) : null,
        bodyRect: bodyRect ? [bodyRect.x, bodyRect.y, bodyRect.width, bodyRect.height].map((value) => Math.round(value * 10) / 10) : null,
        scrollTop: body?.scrollTop || 0,
        rows
      });
    };
    window.__srcNoFlashSamples = [];
    window.__srcNoFlashMutations = [];
    window.__srcNoFlashObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        const target = mutation.target;
        window.__srcNoFlashMutations.push({
          type: mutation.type,
          attributeName: mutation.attributeName || '',
          targetKey: target?.dataset?.propKey || target?.dataset?.key || target?.tagName || ''
        });
      });
      snapshot('mutation');
    });
    window.__srcNoFlashObserver.observe(document.querySelector(windowSelector), {
      attributes: true,
      attributeOldValue: true,
      childList: true,
      characterData: true,
      subtree: true
    });
    window.__srcNoFlashTimer = setInterval(() => snapshot('timer'), 4);
    snapshot('start');
  }, { windowSelector, inputKeys: Object.keys(inputValues) });

  for (const [key, value] of Object.entries(inputValues)) {
    const input = page.locator(`${windowSelector} input[data-key="${key}"]`);
    await input.click();
    await input.press('Control+A');
    await input.type(value, { delay: 90 });
    await page.waitForTimeout(650);
    await expect(input).toBeFocused();
  }

  const state = await page.evaluate(({ windowSelector, inputKeys }) => {
    clearInterval(window.__srcNoFlashTimer);
    window.__srcNoFlashObserver.disconnect();
    const samples = window.__srcNoFlashSamples || [];
    const geometrySignatures = new Set(samples.map((sample) => JSON.stringify({
        taskId: sample.taskId,
        bodyId: sample.bodyId,
        inputs: sample.inputs,
        taskRect: sample.taskRect,
        bodyRect: sample.bodyRect,
        scrollTop: sample.scrollTop,
        rows: sample.rows
    })));
    const forbiddenAttributes = new Set([
      'hidden',
      'aria-hidden',
      'data-source-volumetric-only',
      'data-prop-key',
      'data-key',
      'data-node',
      'data-i18n-fallback',
      'data-source-fluid-basis-layout-lock',
      'data-source-fluid-basis-derived'
    ]);
    const forbiddenMutations = (window.__srcNoFlashMutations || []).filter((mutation) => (
      mutation.type === 'attributes' && forbiddenAttributes.has(mutation.attributeName)
    ));
    const task = document.querySelector(windowSelector);
    const model = window.__npshGlobalModel || window.globalModel || {};
    const sourceId = task?.dataset?.nodeId || '';
    return {
      sampleCount: samples.length,
      geometrySignatureCount: geometrySignatures.size,
      forbiddenMutations,
      activeKey: document.activeElement?.dataset?.key || '',
      values: Object.fromEntries(inputKeys.map((key) => [key, task?.querySelector(`input[data-key="${key}"]`)?.value || ''])),
      modelValues: Object.fromEntries(inputKeys.map((key) => [key, model[sourceId]?.props?.[key]]))
    };
  }, { windowSelector, inputKeys: Object.keys(inputValues) });

  expect(state.sampleCount).toBeGreaterThan(10);
  expect(state.geometrySignatureCount).toBe(1);
  expect(state.forbiddenMutations).toEqual([]);
  expect(state.activeKey).toBe('elevation');
  expect(state.values).toEqual(inputValues);
  expect(Number(state.modelValues.pressure)).toBeCloseTo(2.25, 6);
  expect(Number(state.modelValues.flow)).toBeCloseTo(41.125, 6);
  expect(Number(state.modelValues.elevation)).toBeCloseTo(3.5, 6);
});
