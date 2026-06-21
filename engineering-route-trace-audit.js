(function registerEngineeringRouteTraceAudit(root) {
  const VERSION = '2026.06-route-trace-audit-v29';
  const PANEL_ID = 'engineeringRouteTraceAuditPanel';
  const PANEL_BODY_ID = 'engineeringRouteTraceAuditPanelBody';
  const MENU_BUTTON_ID = 'menu-tools-route-trace-audit';
  const CANVAS_OVERLAY_UNLOCK_KEY = 'npsh.routeTraceCanvasOverlayVisible';
  const PUMP_SUMMARY_UNLOCK_KEY = 'npsh.routeTracePumpSummaryVisible';
  const CANVAS_OVERLAY_HIDDEN_CLASS = 'route-trace-canvas-overlay-hidden';
  const ROUTE_TRACE_CANVAS_TEXT_PATTERN = /\broute\s+trace\b/i;
  const ROUTE_LOSS_TRACE_CANVAS_TEXT_PATTERN = /\broute\b[\s\S]*suction\s+loss[\s\S]*disch(?:arge)?\.?\s+loss/i;
  const PUMP_CANVAS_HIDDEN_ROW_LABELS = new Set([
    'Route',
    'Suction Loss',
    'Disch. Loss',
    'Discharge Loss',
    'Basis Vapor Press.',
    'Vapor Press. Used'
  ]);
  const SINK_CANVAS_HIDDEN_ROW_LABELS = new Set([
    'Flow Demand',
    'Outlet Flow',
    'Discharge Loss',
    'Vapor Press.',
    'Vapor Margin',
    'Pump NPSH Margin'
  ]);
  let canvasOverlayObserver = null;
  let canvasOverlayPruneTimer = null;
  let canvasOverlayPrunePending = false;
  let canvasOverlayPruneScope = null;
  let canvasOverlayRetryTimer = null;
  let canvasOverlayRetryCount = 0;
  const canvasOverlayWrappedFunctions = new Set();
  let routeObjectTooltipSyncTimer = null;
  let routeSurfaceRefreshPending = false;
  let sinkPropertyChangeRefreshInstalled = false;
  const ATM_PRESSURE_BAR_A = 1.01325;

  function model() {
    return root.globalModel || root.__npshGlobalModel || {};
  }

  function escapeText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function pruneDefaultPumpRouteTraceRows(scope) {
    if (typeof document === 'undefined') return 0;
    const rootNode = scope?.querySelectorAll ? scope : document;
    let removed = 0;
    const panels = new Set();
    if (rootNode.matches?.('.pump-live-params')) panels.add(rootNode);
    rootNode.closest?.('.pump-live-params') && panels.add(rootNode.closest('.pump-live-params'));
    rootNode.querySelectorAll?.('.pump-live-params').forEach((panel) => panels.add(panel));
    panels.forEach((panel) => {
      panel.querySelectorAll('[data-caption-audit-route="true"], [data-caption-audit-chart-control="true"]').forEach((element) => {
        element.remove();
        removed += 1;
      });
      panel.querySelectorAll('.pump-live-param-section').forEach((section) => {
        if (/^route\s+trace$/i.test(normalizeText(section.textContent))) {
          section.remove();
          removed += 1;
        }
      });
      panel.querySelectorAll('.pump-live-param-row').forEach((row) => {
        const label = normalizeText(row.querySelector('.pump-live-param-label')?.textContent);
        if (PUMP_CANVAS_HIDDEN_ROW_LABELS.has(label)) {
          row.remove();
          removed += 1;
        }
      });
      removed += syncPumpObjectTooltip(panel);
    });
    return removed;
  }

  function pruneDefaultSinkCanvasRows(scope) {
    if (typeof document === 'undefined') return 0;
    const rootNode = scope?.querySelectorAll ? scope : document;
    let removed = 0;
    const panels = new Set();
    if (rootNode.matches?.('.sink-live-params')) panels.add(rootNode);
    rootNode.closest?.('.sink-live-params') && panels.add(rootNode.closest('.sink-live-params'));
    rootNode.querySelectorAll?.('.sink-live-params').forEach((panel) => panels.add(panel));
    panels.forEach((panel) => {
      normalizeDefaultSinkCanvasRows(panel);
      panel.querySelectorAll('.sink-live-param-row').forEach((row) => {
        const label = normalizeText(row.querySelector('.sink-live-param-label')?.textContent);
        if (SINK_CANVAS_HIDDEN_ROW_LABELS.has(label)) {
          row.remove();
          removed += 1;
        }
      });
    });
    return removed;
  }

  function finiteNumber(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstFiniteValue(...values) {
    for (const value of values) {
      const number = finiteNumber(value);
      if (number !== null) return number;
    }
    return null;
  }

  function firstTextValue(...values) {
    for (const value of values) {
      const text = normalizeText(value);
      if (text && text !== '-') return text;
    }
    return '';
  }

  function firstBooleanValue(...values) {
    for (const value of values) {
      if (typeof value === 'boolean') return value;
      if (String(value).toLowerCase() === 'true') return true;
      if (String(value).toLowerCase() === 'false') return false;
    }
    return null;
  }

  function connectionList(modelRef = model()) {
    const candidates = [
      root.__npshConnections,
      root.connections,
      modelRef?.connections,
      modelRef?.__connections
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  function connectionPipeId(connection = {}) {
    return connection.pipeId || connection.pipe || connection.via || connection.edgeId || '';
  }

  function connectionFrom(connection = {}) {
    return connection.from || connection.source || connection.fromNode || '';
  }

  function connectionTo(connection = {}) {
    return connection.to || connection.target || connection.toNode || '';
  }

  function isHydraulicConnection(connection = {}) {
    return !connection.connectionType || String(connection.connectionType).toLowerCase() === 'hydraulic';
  }

  function connectedPipeForSink(sinkId, modelRef = model()) {
    if (!sinkId) return null;
    const connection = connectionList(modelRef).find((candidate) => (
      isHydraulicConnection(candidate)
      && (connectionFrom(candidate) === sinkId || connectionTo(candidate) === sinkId)
      && modelRef[connectionPipeId(candidate)]?.type === 'pipe'
    ));
    return connection ? modelRef[connectionPipeId(connection)] : null;
  }

  function sourceIdForSinkNode(source, node = source?.node || source || {}, modelRef = model()) {
    if (source?.id) return source.id;
    return Object.entries(modelRef).find(([, candidate]) => candidate === node)?.[0] || '';
  }

  function sinkBoundaryModeRaw(node = {}) {
    const props = node.props || {};
    const results = node.results || {};
    const traceBoundary = results.calculationTrace?.boundary || {};
    const traceInput = results.calculationTrace?.inputBasis || {};
    return normalizeText(
      props.boundaryMode
      || props.mode
      || props.sinkBoundaryMode
      || traceInput.boundaryMode
      || traceInput.mode
      || traceBoundary.boundaryMode
      || traceBoundary.mode
      || results.boundaryMode
      || results.mode
      || ''
    );
  }

  function sinkBoundaryModeKind(mode = '') {
    const text = normalizeText(mode).toLowerCase();
    if (/free|atmos/.test(text)) return 'free-outlet';
    if (/flow\s*demand|demand\s*flow/.test(text)) return 'flow-demand';
    if (/outlet\s*pressure|pressure\s*boundary|specified\s*pressure/.test(text)) return 'outlet-pressure';
    return '';
  }

  function sinkBoundaryModeDisplay(mode = '') {
    const kind = sinkBoundaryModeKind(mode);
    if (kind === 'free-outlet') return 'Free Outlet';
    if (kind === 'flow-demand') return 'Flow Demand';
    if (kind === 'outlet-pressure') return 'Outlet Pressure';
    return normalizeText(mode).replace(/\s*Boundary$/i, '') || '-';
  }

  function sinkBoundaryModeFormLabel(mode = '') {
    const kind = sinkBoundaryModeKind(mode);
    if (kind === 'free-outlet') return 'Free Outlet / Atmospheric Discharge';
    if (kind === 'flow-demand') return 'Flow Demand Boundary';
    if (kind === 'outlet-pressure') return 'Outlet Pressure Boundary';
    return normalizeText(mode) || 'Flow Demand Boundary';
  }

  function syncSinkBoundaryModeOptions(select) {
    if (!select || select.tagName !== 'SELECT') return 0;
    const expected = [
      'Free Outlet / Atmospheric Discharge',
      'Outlet Pressure Boundary',
      'Flow Demand Boundary'
    ];
    let changed = 0;
    expected.forEach((label) => {
      const kind = sinkBoundaryModeKind(label);
      let option = Array.from(select.options || []).find((item) => sinkBoundaryModeKind(item.value || item.textContent) === kind);
      if (!option && typeof document !== 'undefined') {
        option = document.createElement('option');
        select.appendChild(option);
        changed += 1;
      }
      if (!option) return;
      if (option.value !== label) {
        option.value = label;
        changed += 1;
      }
      if (normalizeText(option.textContent) !== label) {
        option.textContent = label;
        changed += 1;
      }
    });
    return changed;
  }

  function pressureBasisIsGauge(value = '') {
    return /^gauge$/i.test(normalizeText(value)) || /^bar\s*g$/i.test(normalizeText(value));
  }

  function absolutePressureFromInput(value, basis = '') {
    const pressure = finiteNumber(value);
    if (pressure === null) return null;
    return pressureBasisIsGauge(basis) ? pressure + ATM_PRESSURE_BAR_A : pressure;
  }

  function fluidDensity() {
    return firstFiniteValue(model().FLUID?.props?.density, root.__npshFluidBasis?.density, 1000);
  }

  function pressureHeadFromBarA(pressureAbsBar) {
    const pressure = finiteNumber(pressureAbsBar);
    const density = fluidDensity();
    if (pressure === null || density === null || density <= 0) return null;
    return (pressure * 100000) / (density * 9.81);
  }

  function connectedSinkVelocityHead(sinkId, node = {}, modelRef = model()) {
    const pipe = connectedPipeForSink(sinkId, modelRef);
    return firstFiniteValue(
      node.results?.terminalVelocityHead,
      node.results?.velocityHead,
      node.results?.pipeEndpointVelocityHead,
      node.results?.calculationTrace?.boundary?.terminalVelocityHead,
      node.results?.calculationTrace?.boundary?.velocityHead,
      pipe?.results?.terminalVelocityHead,
      pipe?.results?.outletVelocityHead,
      pipe?.results?.velocityHead,
      pipe?.results?.calculationTrace?.boundary?.terminalVelocityHead,
      pipe?.results?.calculationTrace?.boundary?.velocityHead,
      0
    );
  }

  function pressureAbsForSelectedSinkMode(node, mode) {
    const results = node.results || {};
    const props = node.props || {};
    const traceBoundary = results.calculationTrace?.boundary || {};
    const traceInput = results.calculationTrace?.inputBasis || {};
    const kind = sinkBoundaryModeKind(mode);
    const propPressureAbs = absolutePressureFromInput(
      firstFiniteValue(props.pressure, props.referencePressure, props.boundaryPressure, props.outletPressure),
      props.pressureInputBasis || props.pressureBasis || results.pressureInputBasis || results.pressureBasis
    );
    const tracePressureAbs = firstFiniteValue(
      traceBoundary.pressureAbsBar,
      traceBoundary.absolutePressureBar,
      traceBoundary.boundaryPressureAbsBar,
      traceInput.pressureAbsBar,
      traceInput.absolutePressureBar,
      traceInput.boundaryPressureAbsBar
    );
    const inputPressureAbs = firstFiniteValue(
      tracePressureAbs,
      propPressureAbs
    );
    if (kind === 'free-outlet') return firstFiniteValue(tracePressureAbs, ATM_PRESSURE_BAR_A);
    if (kind === 'outlet-pressure') {
      return firstFiniteValue(
        inputPressureAbs,
        results.boundaryPressure,
        results.calculatedPressure,
        results.staticPressure,
        results.stagnationPressure
      );
    }
    return firstFiniteValue(
      results.calculatedPressure,
      results.requiredBoundaryPressure,
      results.boundaryPressure,
      results.staticPressure,
      results.stagnationPressure,
      inputPressureAbs
    );
  }

  function sinkHeadForSelectedSinkMode(node, mode, pressureAbsBar, elevation) {
    const results = node.results || {};
    const traceBoundary = results.calculationTrace?.boundary || {};
    const traceInput = results.calculationTrace?.inputBasis || {};
    const props = node.props || {};
    const kind = sinkBoundaryModeKind(mode);
    const modelRef = model();
    const sinkId = sourceIdForSinkNode(null, node, modelRef);
    const computedHead = (() => {
      const pressureHead = firstFiniteValue(
        traceBoundary.pressureHead,
        traceInput.pressureHead,
        pressureHeadFromBarA(pressureAbsBar)
      );
      const velocityHead = connectedSinkVelocityHead(sinkId, node, modelRef);
      const z = firstFiniteValue(elevation, props.elevation);
      if (pressureHead === null || z === null) return null;
      return pressureHead + z + (velocityHead || 0);
    })();
    if (kind === 'free-outlet' || kind === 'outlet-pressure') {
      return firstFiniteValue(
        traceBoundary.hydraulicHead,
        traceBoundary.totalSinkHead,
        traceInput.hydraulicHead,
        traceInput.totalSinkHead,
        computedHead,
        results.hydraulicHead,
        results.sinkHead,
        results.boundaryHead
      );
    }
    return firstFiniteValue(
      results.requiredBoundaryHead,
      results.hydraulicHead,
      results.sinkHead,
      results.boundaryHead,
      traceBoundary.hydraulicHead,
      traceInput.hydraulicHead,
      computedHead
    );
  }

  function sinkCanonicalValues(node = {}) {
    const results = node.results || {};
    const traceBoundary = results.calculationTrace?.boundary || {};
    const traceInput = results.calculationTrace?.inputBasis || {};
    const tracePumpImpact = results.calculationTrace?.pumpImpact || {};
    const props = node.props || {};
    const mode = sinkBoundaryModeRaw(node);
    const pressureAbsBar = pressureAbsForSelectedSinkMode(node, mode);
    const elevation = firstFiniteValue(
      results.elevation,
      results.sinkElevation,
      traceBoundary.elevation,
      traceInput.elevation,
      props.elevation
    );
    const sinkHead = sinkHeadForSelectedSinkMode(node, mode, pressureAbsBar, elevation);
    const operatingFeasibilityStatus = firstTextValue(
      results.operatingFeasibilityStatus,
      traceBoundary.operatingFeasibilityStatus,
      tracePumpImpact.operatingFeasibilityStatus
    );
    const engineeringStatus = firstTextValue(
      results.status,
      results.engineeringStatus,
      results.calculationTrace?.status,
      tracePumpImpact.engineeringStatus,
      operatingFeasibilityStatus
    );
    return {
      mode,
      pressureAbsBar,
      elevation,
      sinkHead,
      sinkFlow: firstFiniteValue(
        results.flow,
        results.outletFlow,
        results.sinkFlow,
        results.flowDemand,
        traceBoundary.flow,
        traceBoundary.outletFlow,
        traceBoundary.demandFlow,
        traceInput.flow,
        traceInput.outletFlow,
        traceInput.demandFlow,
        props.demandFlow,
        props.flow,
        props.flowDemand,
        props.outletFlow
      ),
      engineeringStatus,
      operatingFeasibilityStatus,
      boundaryFeasible: firstBooleanValue(
        results.boundaryFeasible,
        traceBoundary.boundaryFeasible,
        tracePumpImpact.boundaryFeasible
      ),
      headResidual: firstFiniteValue(
        results.headResidual,
        traceBoundary.headResidual,
        tracePumpImpact.headResidual
      ),
      maxAllowableSnkElevation: firstFiniteValue(
        results.maxAllowableSnkElevation,
        traceBoundary.maxAllowableSnkElevation,
        tracePumpImpact.maxAllowableSnkElevation
      )
    };
  }

  function formatCanvasValue(value, unit = '') {
    const number = finiteNumber(value);
    if (number === null) return '-';
    return `${number.toFixed(3)}${unit ? ` ${unit}` : ''}`;
  }

  function sinkNodeForCanvasPanel(panel) {
    const modelRef = model();
    const candidates = [
      panel?.dataset?.nodeId,
      panel?.dataset?.objectId,
      panel?.closest?.('[data-node-id]')?.dataset?.nodeId,
      panel?.closest?.('[data-object-id]')?.dataset?.objectId,
      panel?.closest?.('.pfd-object')?.dataset?.nodeId,
      panel?.closest?.('.pfd-object')?.dataset?.objectId
    ].filter(Boolean);
    for (const id of candidates) {
      if (modelRef[id]?.type === 'sink') return { id, node: modelRef[id] };
    }
    const objectText = normalizeText(panel?.closest?.('.pfd-object')?.textContent || panel?.textContent || '');
    const matching = Object.entries(modelRef).filter(([id, node]) => {
      if (node?.type !== 'sink') return false;
      return objectText.includes(id) || (node.name && objectText.includes(node.name));
    });
    if (matching.length === 1) return { id: matching[0][0], node: matching[0][1] };
    const allSinks = Object.entries(modelRef).filter(([, node]) => node?.type === 'sink');
    return allSinks.length === 1 ? { id: allSinks[0][0], node: allSinks[0][1] } : null;
  }

  function createSinkCanvasRow(label, value) {
    const row = document.createElement('div');
    row.className = 'sink-live-param-row';
    row.dataset.routeTraceAuditSinkReadout = 'true';
    const labelElement = document.createElement('span');
    labelElement.className = 'sink-live-param-label';
    labelElement.textContent = label;
    const valueElement = document.createElement('strong');
    valueElement.className = 'sink-live-param-value';
    valueElement.textContent = value;
    row.appendChild(labelElement);
    row.appendChild(valueElement);
    return row;
  }

  function sinkPanelRowByLabel(panel, label) {
    if (!panel?.querySelectorAll) return null;
    return Array.from(panel.querySelectorAll('.sink-live-param-row')).find((row) => (
      normalizeText(row.querySelector('.sink-live-param-label')?.textContent) === label
    )) || null;
  }

  function sinkPanelNumericValue(panel, labels = []) {
    for (const label of labels) {
      const value = finiteNumber(sinkPanelRowByLabel(panel, label)?.querySelector('.sink-live-param-value, strong')?.textContent);
      if (value !== null) return value;
    }
    return null;
  }

  function sinkModeDisplayValue(node = {}, panel = null) {
    const mode = sinkBoundaryModeRaw(node);
    const modeDisplay = sinkBoundaryModeDisplay(mode);
    if (modeDisplay !== '-') return modeDisplay;
    if (sinkPanelRowByLabel(panel, 'Flow Demand')) return 'Flow Demand';
    const currentMode = normalizeText(sinkPanelRowByLabel(panel, 'Mode')?.querySelector('.sink-live-param-value, strong')?.textContent);
    if (/^flow$/i.test(currentMode) && sinkPanelRowByLabel(panel, 'Outlet Flow')) return 'Flow Demand';
    return currentMode || '-';
  }

  function insertSinkCanvasRow(panel, row, anchorLabels = []) {
    if (!panel?.querySelectorAll || !row) return;
    const rows = Array.from(panel.querySelectorAll('.sink-live-param-row'));
    const anchor = anchorLabels
      .map((label) => rows.find((item) => normalizeText(item.querySelector('.sink-live-param-label')?.textContent) === label))
      .find(Boolean);
    if (!anchor) {
      panel.appendChild(row);
      return;
    }
    const siblings = Array.from(panel.children || []);
    const index = siblings.indexOf(anchor);
    const before = index >= 0 ? siblings[index + 1] : null;
    if (before) panel.insertBefore(row, before);
    else panel.appendChild(row);
  }

  function valueForExistingSinkRow(row, value) {
    const unitText = normalizeText(row?.querySelector?.('.sink-live-param-unit')?.textContent);
    const text = String(value ?? '');
    if (unitText && text.endsWith(` ${unitText}`)) return text.slice(0, -unitText.length - 1);
    return text;
  }

  function setTextIfChanged(element, value) {
    if (!element || value === null || value === undefined) return false;
    const text = String(value);
    if (element.textContent === text) return false;
    element.textContent = text;
    return true;
  }

  function sinkNodeForPropertyWindow(windowNode) {
    const modelRef = model();
    const candidates = [
      windowNode?.dataset?.nodeId,
      windowNode?.dataset?.objectNode,
      windowNode?.querySelector?.('[data-node-id]')?.dataset?.nodeId,
      windowNode?.querySelector?.('[data-object-node]')?.dataset?.objectNode,
      windowNode?.querySelector?.('[data-node]')?.dataset?.node
    ].filter(Boolean);
    for (const id of candidates) {
      if (modelRef[id]?.type === 'sink') return { id, node: modelRef[id] };
    }
    const windowText = normalizeText(windowNode?.textContent || '');
    const matching = Object.entries(modelRef).filter(([id, node]) => (
      node?.type === 'sink' && (windowText.includes(id) || (node.name && windowText.includes(node.name)))
    ));
    return matching.length === 1 ? { id: matching[0][0], node: matching[0][1] } : null;
  }

  function sinkPropertyRowByLabel(windowNode, label) {
    if (!windowNode?.querySelectorAll) return null;
    const tableRow = Array.from(windowNode.querySelectorAll('tr')).find((row) => {
      const firstCell = Array.from(row.children || []).find((child) => /^(TD|TH)$/i.test(child.tagName || ''));
      return normalizeText(firstCell?.textContent) === label;
    });
    if (tableRow) return tableRow;
    const candidates = [
      '.fluid-field-row',
      '.field-row',
      '.property-row',
      '.prop-row',
      '.object-property-row',
      '[data-field-key]',
      '[data-property-key]'
    ].join(',');
    return Array.from(windowNode.querySelectorAll(candidates)).find((row) => {
      const labelNode = row.querySelector?.('.fluid-field-label, .field-label, .property-label, .prop-label, label, span');
      const labelText = normalizeText(labelNode?.textContent || '');
      if (labelText === label) return true;
      const directText = normalizeText(Array.from(row.childNodes || [])
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent)
        .join(' '));
      return directText === label;
    }) || null;
  }

  function sinkPropertyRowLabelCell(row) {
    return Array.from(row?.children || []).find((child) => /^(TD|TH)$/i.test(child.tagName || ''))
      || row?.querySelector?.('.fluid-field-label, .field-label, .property-label, .prop-label, label, span')
      || null;
  }

  function sinkPropertyRowValueCell(row) {
    const cells = Array.from(row?.children || []).filter((child) => /^(TD|TH)$/i.test(child.tagName || ''));
    return cells[1]
      || row?.querySelector?.('.fluid-field-value, .field-value, .property-value, .prop-value, .task-prop-value, .fluid-field-control, strong')
      || null;
  }

  function setRowHiddenForSinkMode(row, hidden, reason) {
    if (!row) return 0;
    let changed = 0;
    if (hidden) {
      if (row.hidden !== true) {
        row.hidden = true;
        changed += 1;
      }
      if (row.getAttribute?.('aria-hidden') !== 'true') {
        row.setAttribute?.('aria-hidden', 'true');
        changed += 1;
      }
      if (row.classList && !row.classList.contains('route-trace-sink-mode-hidden')) {
        row.classList.add('route-trace-sink-mode-hidden');
        changed += 1;
      }
      if (row.dataset) {
        row.dataset.routeTraceSinkModeHidden = reason || 'mode-ignored';
      }
    } else {
      if (row.hidden === true) {
        row.hidden = false;
        changed += 1;
      }
      if (row.getAttribute?.('aria-hidden') === 'true') {
        row.removeAttribute?.('aria-hidden');
        changed += 1;
      }
      if (row.classList?.contains('route-trace-sink-mode-hidden')) {
        row.classList.remove('route-trace-sink-mode-hidden');
        changed += 1;
      }
      if (row.dataset?.routeTraceSinkModeHidden) {
        delete row.dataset.routeTraceSinkModeHidden;
      }
    }
    if (row.dataset) row.dataset.routeTraceSinkModeLock = VERSION;
    return changed;
  }

  function setSinkPropertyRowValue(windowNode, label, value) {
    const row = sinkPropertyRowByLabel(windowNode, label);
    const control = row?.querySelector?.('select, input, textarea');
    if (control) {
      let changed = 0;
      if (label === 'Boundary Mode') changed += syncSinkBoundaryModeOptions(control);
      const targetText = normalizeText(value);
      const targetKind = label === 'Boundary Mode' ? sinkBoundaryModeKind(value) : '';
      if (control.tagName === 'SELECT') {
        const option = Array.from(control.options || []).find((item) => (
          (targetKind && sinkBoundaryModeKind(item.value || item.textContent) === targetKind)
          || normalizeText(item.value) === targetText
          || normalizeText(item.textContent) === targetText
          || normalizeText(item.value).includes(targetText)
          || targetText.includes(normalizeText(item.value))
          || normalizeText(item.textContent).includes(targetText)
          || targetText.includes(normalizeText(item.textContent))
        ));
        if (option && control.value !== option.value) {
          control.value = option.value;
          changed += 1;
        }
        return changed;
      }
      if ((control.readOnly || control.disabled) && control.value !== String(value)) {
        control.value = String(value);
        changed += 1;
      }
      return changed;
    }
    const valueCell = sinkPropertyRowValueCell(row);
    return setTextIfChanged(valueCell, value) ? 1 : 0;
  }

  function setSinkPropertyRowValues(windowNode, labels, value) {
    return labels.reduce((changed, label) => changed + setSinkPropertyRowValue(windowNode, label, value), 0);
  }

  function setSinkPropertyRowsTitle(windowNode, labels, title) {
    return labels.reduce((changed, label) => {
      const row = sinkPropertyRowByLabel(windowNode, label);
      if (!row || row.title === title) return changed;
      row.title = title;
      return changed + 1;
    }, 0);
  }

  function hideSinkPropertyRows(windowNode, labels, hidden, reason) {
    return labels.reduce((changed, label) => changed + setRowHiddenForSinkMode(sinkPropertyRowByLabel(windowNode, label), hidden, reason), 0);
  }

  function removeLegacyGeneratedSinkPropertyRows(windowNode) {
    const labels = ['Evaluated Flow', 'Outlet Pressure Assumption'];
    return labels.reduce((changed, label) => {
      const row = sinkPropertyRowByLabel(windowNode, label);
      if (!row) return changed;
      if (
        row.dataset?.routeTraceSinkModeReadout === 'true'
        || row.dataset?.routeTraceSinkModeGenerated === 'true'
        || label === 'Evaluated Flow'
        || label === 'Outlet Pressure Assumption'
      ) {
        row.remove();
        return changed + 1;
      }
      return changed;
    }, 0);
  }

  function isSinkTraceSectionLabel(value = '') {
    const label = normalizeText(value).replace(/^[+-]\s*/, '');
    return /^Calculation Trace(?:\s*\/\s*Step-by-step Report)?$/i.test(label)
      || /^Trace Perhitungan(?:\s*\/\s*Laporan Step-by-step)?$/i.test(label);
  }

  function isPropertySectionHeaderRow(row) {
    return Array.from(row?.children || []).some((child) => child?.classList?.contains('prop-section-header'));
  }

  function sinkTraceSectionHeaderRows(windowNode) {
    if (!windowNode?.querySelectorAll) return [];
    return Array.from(windowNode.querySelectorAll('tr')).filter((row) => {
      if (!isPropertySectionHeaderRow(row)) return false;
      return isSinkTraceSectionLabel(sinkPropertyRowLabelCell(row)?.textContent || '');
    });
  }

  function sinkTraceSectionBodyRows(headerRow) {
    const rows = [];
    let next = headerRow?.nextElementSibling || null;
    while (next) {
      if (isPropertySectionHeaderRow(next)) break;
      rows.push(next);
      next = next.nextElementSibling;
    }
    return rows;
  }

  function setSinkTraceSectionCollapsed(headerRow, collapsed) {
    if (!headerRow) return 0;
    const cell = sinkPropertyRowLabelCell(headerRow);
    const bodyRows = sinkTraceSectionBodyRows(headerRow);
    let changed = 0;
    const state = collapsed ? 'collapsed' : 'expanded';
    if (!headerRow.classList?.contains('route-trace-sink-trace-toggle')) {
      headerRow.classList?.add('route-trace-sink-trace-toggle');
      changed += 1;
    }
    if (headerRow.dataset?.routeTraceSinkTraceCollapse !== state) {
      headerRow.dataset.routeTraceSinkTraceCollapse = state;
      changed += 1;
    }
    if (cell) {
      if (cell.getAttribute?.('role') !== 'button') {
        cell.setAttribute?.('role', 'button');
        changed += 1;
      }
      if (cell.getAttribute?.('tabindex') !== '0') {
        cell.setAttribute?.('tabindex', '0');
        changed += 1;
      }
      const expandedText = collapsed ? 'false' : 'true';
      if (cell.getAttribute?.('aria-expanded') !== expandedText) {
        cell.setAttribute?.('aria-expanded', expandedText);
        changed += 1;
      }
      const title = collapsed ? 'Expand Calculation Trace' : 'Collapse Calculation Trace';
      if (cell.getAttribute?.('title') !== title) {
        cell.setAttribute?.('title', title);
        changed += 1;
      }
    }
    bodyRows.forEach((row) => {
      if (row.hidden !== collapsed) {
        row.hidden = collapsed;
        changed += 1;
      }
      if (collapsed) {
        if (row.getAttribute?.('aria-hidden') !== 'true') {
          row.setAttribute?.('aria-hidden', 'true');
          changed += 1;
        }
        if (!row.classList?.contains('route-trace-sink-trace-collapsed')) {
          row.classList?.add('route-trace-sink-trace-collapsed');
          changed += 1;
        }
      } else {
        if (row.getAttribute?.('aria-hidden') === 'true') {
          row.removeAttribute?.('aria-hidden');
          changed += 1;
        }
        if (row.classList?.contains('route-trace-sink-trace-collapsed')) {
          row.classList?.remove('route-trace-sink-trace-collapsed');
          changed += 1;
        }
      }
      if (row.dataset) row.dataset.routeTraceSinkTraceBody = 'true';
    });
    return changed;
  }

  function installSinkTraceSectionToggle(headerRow) {
    if (!headerRow || headerRow.dataset?.routeTraceSinkTraceToggleInstalled === VERSION) return 0;
    const toggle = (event) => {
      event?.preventDefault?.();
      const nextCollapsed = headerRow.dataset?.routeTraceSinkTraceCollapse !== 'collapsed';
      setSinkTraceSectionCollapsed(headerRow, nextCollapsed);
    };
    headerRow.addEventListener?.('click', toggle);
    headerRow.addEventListener?.('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') toggle(event);
    });
    if (headerRow.dataset) headerRow.dataset.routeTraceSinkTraceToggleInstalled = VERSION;
    return 1;
  }

  function collapseSinkTraceDetails(windowNode) {
    let changed = 0;
    windowNode?.querySelectorAll?.('details').forEach((details) => {
      const summary = details.querySelector?.('summary');
      if (!isSinkTraceSectionLabel(summary?.textContent || '')) return;
      if (!details.classList?.contains('route-trace-sink-trace-details')) {
        details.classList?.add('route-trace-sink-trace-details');
        changed += 1;
      }
      if (details.dataset?.routeTraceSinkTraceDetailsInitialized === VERSION) return;
      if (details.open) {
        details.open = false;
        changed += 1;
      }
      if (details.dataset) details.dataset.routeTraceSinkTraceDetailsInitialized = VERSION;
    });
    return changed;
  }

  function collapseSinkTraceSections(windowNode) {
    let changed = 0;
    sinkTraceSectionHeaderRows(windowNode).forEach((headerRow) => {
      changed += installSinkTraceSectionToggle(headerRow);
      const hasState = !!headerRow.dataset?.routeTraceSinkTraceCollapse;
      changed += setSinkTraceSectionCollapsed(
        headerRow,
        hasState ? headerRow.dataset.routeTraceSinkTraceCollapse === 'collapsed' : true
      );
    });
    changed += collapseSinkTraceDetails(windowNode);
    return changed;
  }

  function lockSinkPropertyWindowLayout(windowNode) {
    if (!windowNode) return 0;
    let changed = 0;
    if (!windowNode.classList?.contains('route-trace-sink-layout-locked')) {
      windowNode.classList?.add('route-trace-sink-layout-locked');
      changed += 1;
    }
    if (windowNode.dataset?.routeTraceSinkLayoutLock !== VERSION) {
      if (windowNode.dataset) windowNode.dataset.routeTraceSinkLayoutLock = VERSION;
      changed += 1;
    }
    changed += collapseSinkTraceSections(windowNode);
    return changed;
  }

  function syncSinkPropertyWindowCanonicalReadouts(scope) {
    if (typeof document === 'undefined') return 0;
    const rootNode = scope?.querySelectorAll ? scope : document;
    const windows = new Set();
    if (rootNode.matches?.('.persistent-object-properties-task-window, #taskWindow, .task-window')) windows.add(rootNode);
    rootNode.closest?.('.persistent-object-properties-task-window, #taskWindow, .task-window')
      && windows.add(rootNode.closest('.persistent-object-properties-task-window, #taskWindow, .task-window'));
    rootNode.querySelectorAll?.('.persistent-object-properties-task-window, #taskWindow, .task-window').forEach((item) => windows.add(item));
    let changed = 0;
    windows.forEach((windowNode) => {
      const sink = sinkNodeForPropertyWindow(windowNode);
      if (!sink) return;
      const canonical = sinkCanonicalValues(sink.node);
      const kind = sinkBoundaryModeKind(canonical.mode);
      const isFlowDemand = kind === 'flow-demand';
      const isFreeOutlet = kind === 'free-outlet';
      const isOutletPressure = kind === 'outlet-pressure';
      const pressureText = formatCanvasValue(canonical.pressureAbsBar, 'bar a');
      const requiredBoundaryHeadText = formatCanvasValue(
        firstFiniteValue(
          sink.node?.results?.requiredBoundaryHead,
          sink.node?.results?.calculationTrace?.boundary?.requiredBoundaryHead
        ),
        'm'
      );

      changed += removeLegacyGeneratedSinkPropertyRows(windowNode);
      changed += lockSinkPropertyWindowLayout(windowNode);
      changed += setSinkPropertyRowValue(windowNode, 'Calculated Abs. Pressure', pressureText);
      changed += setSinkPropertyRowValue(windowNode, 'Boundary Abs. Pressure', pressureText);
      changed += setSinkPropertyRowValues(windowNode, ['Required Boundary P', 'Required Sink P abs'], pressureText);
      changed += setSinkPropertyRowValues(windowNode, ['Required Boundary Head', 'Required Sink Head'], requiredBoundaryHeadText);
      changed += setSinkPropertyRowValue(windowNode, 'Boundary Mode', sinkBoundaryModeFormLabel(canonical.mode));
      changed += setSinkPropertyRowsTitle(
        windowNode,
        ['Calculated Abs. Pressure', 'Boundary Abs. Pressure'],
        isFlowDemand
          ? 'Flow Demand output: required absolute boundary pressure solved from required boundary head, elevation, and pipe pressure type.'
          : isFreeOutlet
          ? 'Free Outlet output: atmospheric absolute pressure, fixed at 0 bar g / 1.01325 bar a.'
          : 'Outlet Pressure output: absolute boundary pressure converted from the selected pressure basis.'
      );

      changed += hideSinkPropertyRows(
        windowNode,
        ['Flow Demand', 'Demand Flow', 'Sink Flow Demand'],
        !isFlowDemand,
        'ignored-when-not-flow-demand'
      );
      changed += hideSinkPropertyRows(
        windowNode,
        ['Required Boundary P', 'Required Sink P abs', 'Required Boundary Head', 'Required Sink Head'],
        !isFlowDemand,
        'only-flow-demand'
      );
      changed += hideSinkPropertyRows(
        windowNode,
        ['Boundary Pressure Input', 'Sink Pressure Input'],
        !isOutletPressure,
        'only-outlet-pressure-boundary'
      );
      changed += hideSinkPropertyRows(
        windowNode,
        ['Reference Pressure', 'Outlet Pressure', 'Sink Pressure', 'Pressure Input'],
        !isOutletPressure,
        'only-outlet-pressure-boundary'
      );
      changed += hideSinkPropertyRows(
        windowNode,
        ['Pressure Basis', 'Pressure Input Basis'],
        !isOutletPressure,
        'only-outlet-pressure-boundary'
      );
      changed += hideSinkPropertyRows(
        windowNode,
        ['Elevation', 'Sink Elevation', 'SNK Elevation'],
        false,
        'active-boundary-elevation'
      );

      const ignoredRow = sinkPropertyRowByLabel(windowNode, 'Ignored Flow Demand');
      if (ignoredRow) {
        changed += setRowHiddenForSinkMode(ignoredRow, isFlowDemand, 'only-non-flow-demand');
      }
    });
    return changed;
  }

  function valueWithUnitFromRow(row, valueSelector, unitSelector) {
    const value = normalizeText(row?.querySelector?.(valueSelector)?.textContent);
    const unit = normalizeText(row?.querySelector?.(unitSelector)?.textContent);
    if (!value) return '';
    if (!unit || value.endsWith(unit)) return value;
    return `${value} ${unit}`;
  }

  function syncObjectTooltip(object, title, datasetKey) {
    if (!object || !title) return 0;
    const storedTitle = object.getAttribute('data-engineering-runtime-originaltitle') || '';
    if (object.title === title && storedTitle === title) return 0;
    object.title = title;
    object.setAttribute('data-engineering-runtime-originaltitle', title);
    if (datasetKey) object.dataset[datasetKey] = VERSION;
    return 1;
  }

  function syncPumpObjectTooltip(panel) {
    const object = panel?.closest?.('.pfd-object');
    if (!object) return 0;
    const lines = [];
    panel.querySelectorAll('.pump-live-param-row').forEach((row) => {
      const label = normalizeText(row.querySelector('.pump-live-param-label')?.textContent);
      const value = valueWithUnitFromRow(row, '.pump-live-param-value, strong', '.pump-live-param-unit');
      if (label && value) lines.push(`${label}: ${value}`);
    });
    return syncObjectTooltip(object, lines.join('\n'), 'routeTracePumpObjectTooltipLock');
  }

  function sinkObjectTooltip(node = {}, panel = null, canonical = sinkCanonicalValues(node)) {
    const sinkFlow = sinkPanelDisplayValue(panel, 'Sink Flow') || formatCanvasValue(canonical.sinkFlow, 'm3/h');
    const pressureAbsBar = sinkPanelDisplayValue(panel, 'Sink P abs') || formatCanvasValue(canonical.pressureAbsBar, 'bar a');
    const elevation = sinkPanelDisplayValue(panel, 'Sink Elev.') || formatCanvasValue(canonical.elevation, 'm');
    const sinkHead = sinkPanelDisplayValue(panel, 'Sink Head') || formatCanvasValue(canonical.sinkHead, 'm');
    const status = canonical.engineeringStatus || canonical.operatingFeasibilityStatus || 'OK';
    const lines = [
      `SNK status: ${status}`,
      `Mode: ${sinkModeDisplayValue(node, panel)}`,
      `Sink Flow: ${sinkFlow}`,
      `Sink P abs: ${pressureAbsBar}`,
      `Sink Elev.: ${elevation}`,
      `Sink Head: ${sinkHead}`
    ];
    if (canonical.operatingFeasibilityStatus) {
      lines.push(`Boundary: ${canonical.operatingFeasibilityStatus}`);
    }
    if (canonical.headResidual !== null) {
      lines.push(`Head Res.: ${formatCanvasValue(canonical.headResidual, 'm')}`);
    }
    if (canonical.maxAllowableSnkElevation !== null) {
      lines.push(`Max Elev.: ${formatCanvasValue(canonical.maxAllowableSnkElevation, 'm')}`);
    }
    return lines.join('\n');
  }

  function syncSinkObjectTooltip(panel, node = {}, canonical = sinkCanonicalValues(node)) {
    return syncObjectTooltip(
      panel?.closest?.('.pfd-object'),
      sinkObjectTooltip(node, panel, canonical),
      'routeTraceSinkObjectTooltipLock'
    );
  }

  function sinkPanelDisplayValue(panel, label) {
    if (!panel?.querySelectorAll) return '';
    const row = sinkPanelRowByLabel(panel, label);
    return valueWithUnitFromRow(row, '.sink-live-param-value, strong', '.sink-live-param-unit');
  }

  function syncRouteObjectTooltips(scope) {
    if (typeof document === 'undefined') return 0;
    const rootNode = scope?.querySelectorAll ? scope : document;
    let changed = 0;
    const pumpPanels = new Set();
    if (rootNode.matches?.('.pump-live-params')) pumpPanels.add(rootNode);
    rootNode.closest?.('.pump-live-params') && pumpPanels.add(rootNode.closest('.pump-live-params'));
    rootNode.querySelectorAll?.('.pump-live-params').forEach((panel) => pumpPanels.add(panel));
    pumpPanels.forEach((panel) => {
      changed += syncPumpObjectTooltip(panel);
    });

    const sinkPanels = new Set();
    if (rootNode.matches?.('.sink-live-params')) sinkPanels.add(rootNode);
    rootNode.closest?.('.sink-live-params') && sinkPanels.add(rootNode.closest('.sink-live-params'));
    rootNode.querySelectorAll?.('.sink-live-params').forEach((panel) => sinkPanels.add(panel));
    sinkPanels.forEach((panel) => {
      const sink = sinkNodeForCanvasPanel(panel);
      changed += syncSinkObjectTooltip(panel, sink?.node || {}, sinkCanonicalValues(sink?.node || {}));
    });
    return changed;
  }

  function scheduleRouteObjectTooltipSync(scope, delayMs = 60) {
    if (typeof document === 'undefined') return;
    root.clearTimeout?.(routeObjectTooltipSyncTimer);
    routeObjectTooltipSyncTimer = root.setTimeout(() => syncRouteObjectTooltips(scope || document), delayMs);
  }

  function normalizeDefaultSinkCanvasRows(scope) {
    if (typeof document === 'undefined') return 0;
    const rootNode = scope?.querySelectorAll ? scope : document;
    let changed = 0;
    const panels = new Set();
    if (rootNode.matches?.('.sink-live-params')) panels.add(rootNode);
    rootNode.closest?.('.sink-live-params') && panels.add(rootNode.closest('.sink-live-params'));
    rootNode.querySelectorAll?.('.sink-live-params').forEach((panel) => panels.add(panel));
    panels.forEach((panel) => {
      const sink = sinkNodeForCanvasPanel(panel);
      const canonical = sinkCanonicalValues(sink?.node || {});
      const sinkFlow = firstFiniteValue(canonical.sinkFlow, sinkPanelNumericValue(panel, ['Sink Flow', 'Flow Demand', 'Outlet Flow']));
      let sinkFlowInstalled = false;
      panel.querySelectorAll('.sink-live-param-row').forEach((row) => {
        const labelElement = row.querySelector('.sink-live-param-label');
        const valueElement = row.querySelector('.sink-live-param-value, strong');
        const label = normalizeText(labelElement?.textContent);
        if (label === 'Mode') {
          changed += setTextIfChanged(valueElement, sinkModeDisplayValue(sink?.node || {}, panel)) ? 1 : 0;
          row.dataset.routeTraceSinkTerminologyLock = VERSION;
        } else if (label === 'Flow Demand' || label === 'Outlet Flow') {
          if (!sinkFlowInstalled && (label === 'Flow Demand' || !sinkPanelRowByLabel(panel, 'Flow Demand'))) {
            changed += setTextIfChanged(labelElement, 'Sink Flow') ? 1 : 0;
            changed += setTextIfChanged(valueElement, valueForExistingSinkRow(row, formatCanvasValue(sinkFlow, 'm3/h'))) ? 1 : 0;
            row.title = 'Flow accepted by SNK at the discharge boundary';
            row.dataset.routeTraceSinkTerminologyLock = VERSION;
            sinkFlowInstalled = true;
          }
        } else if (label === 'Sink Flow') {
          changed += setTextIfChanged(valueElement, valueForExistingSinkRow(row, formatCanvasValue(sinkFlow, 'm3/h'))) ? 1 : 0;
          row.title = 'Flow accepted by SNK at the discharge boundary';
          row.dataset.routeTraceSinkTerminologyLock = VERSION;
          sinkFlowInstalled = true;
        } else if (label === 'Required Press.' || label === 'Outlet Press.') {
          changed += setTextIfChanged(labelElement, 'Sink P abs') ? 1 : 0;
          changed += setTextIfChanged(valueElement, valueForExistingSinkRow(row, formatCanvasValue(canonical.pressureAbsBar, 'bar a'))) ? 1 : 0;
          row.title = 'Absolute sink pressure used for discharge closure';
          row.dataset.routeTraceSinkTerminologyLock = VERSION;
        } else if (label === 'Sink Elev.') {
          changed += setTextIfChanged(valueElement, valueForExistingSinkRow(row, formatCanvasValue(canonical.elevation, 'm'))) ? 1 : 0;
          row.dataset.routeTraceSinkTerminologyLock = VERSION;
        } else if (label === 'Sink Head') {
          changed += setTextIfChanged(valueElement, valueForExistingSinkRow(row, formatCanvasValue(canonical.sinkHead, 'm'))) ? 1 : 0;
          row.title = 'Total sink hydraulic head at the discharge closure';
          row.dataset.routeTraceSinkTerminologyLock = VERSION;
        } else if (label === 'Boundary Feasibility' || label === 'Boundary') {
          changed += setTextIfChanged(labelElement, 'Boundary') ? 1 : 0;
          changed += setTextIfChanged(valueElement, canonical.operatingFeasibilityStatus || '-') ? 1 : 0;
          row.title = 'Pump head feasibility against downstream pressure/elevation boundary';
          row.dataset.routeTraceSinkTerminologyLock = VERSION;
        } else if (label === 'Head Residual' || label === 'Head Res.') {
          changed += setTextIfChanged(labelElement, 'Head Res.') ? 1 : 0;
          changed += setTextIfChanged(valueElement, valueForExistingSinkRow(row, formatCanvasValue(canonical.headResidual, 'm'))) ? 1 : 0;
          row.title = 'Pump available head minus required system head';
          row.dataset.routeTraceSinkTerminologyLock = VERSION;
        } else if (label === 'Max SNK Elevation' || label === 'Max Elev.') {
          changed += setTextIfChanged(labelElement, 'Max Elev.') ? 1 : 0;
          changed += setTextIfChanged(valueElement, valueForExistingSinkRow(row, formatCanvasValue(canonical.maxAllowableSnkElevation, 'm'))) ? 1 : 0;
          row.title = 'Maximum SNK elevation allowed by the current pump head and outlet pressure duty';
          row.dataset.routeTraceSinkTerminologyLock = VERSION;
        }
      });
      changed += syncSinkObjectTooltip(panel, sink?.node || {}, canonical);
    });
    return changed;
  }

  function upsertSinkCanvasRow(panel, label, value, anchorLabels = []) {
    const existing = sinkPanelRowByLabel(panel, label);
    if (existing) {
      const valueElement = existing.querySelector('.sink-live-param-value, strong');
      let changed = false;
      const existingValue = valueForExistingSinkRow(existing, value);
      if (valueElement && valueElement.textContent !== existingValue) {
        valueElement.textContent = existingValue;
        changed = true;
      }
      if (existing.dataset.routeTraceAuditSinkReadout !== 'true') {
        existing.dataset.routeTraceAuditSinkReadout = 'true';
        changed = true;
      }
      return changed;
    }
    const row = createSinkCanvasRow(label, value);
    insertSinkCanvasRow(panel, row, anchorLabels);
    return true;
  }

  function ensureDefaultSinkCanvasRows(scope) {
    if (typeof document === 'undefined') return 0;
    const rootNode = scope?.querySelectorAll ? scope : document;
    let changed = 0;
    const panels = new Set();
    if (rootNode.matches?.('.sink-live-params')) panels.add(rootNode);
    rootNode.closest?.('.sink-live-params') && panels.add(rootNode.closest('.sink-live-params'));
    rootNode.querySelectorAll?.('.sink-live-params').forEach((panel) => panels.add(panel));
    panels.forEach((panel) => {
      const sink = sinkNodeForCanvasPanel(panel);
      const node = sink?.node || {};
      const canonical = sinkCanonicalValues(node);
      const elevation = firstFiniteValue(
        canonical.elevation,
        node.results?.elevation,
        node.results?.sinkElevation,
        node.results?.calculationTrace?.inputBasis?.elevation,
        node.results?.calculationTrace?.boundary?.elevation,
        node.props?.elevation
      );
      const sinkHead = firstFiniteValue(
        canonical.sinkHead,
        node.results?.hydraulicHead,
        node.results?.sinkHead,
        node.results?.boundaryHead,
        node.results?.calculationTrace?.inputBasis?.hydraulicHead,
        node.results?.calculationTrace?.boundary?.hydraulicHead
      );
      const sinkFlow = firstFiniteValue(
        canonical.sinkFlow,
        sinkPanelNumericValue(panel, ['Sink Flow', 'Flow Demand', 'Outlet Flow'])
      );
      changed += normalizeDefaultSinkCanvasRows(panel);
      changed += upsertSinkCanvasRow(panel, 'Sink Flow', formatCanvasValue(sinkFlow, 'm3/h'), ['Mode']) ? 1 : 0;
      changed += upsertSinkCanvasRow(panel, 'Sink P abs', formatCanvasValue(canonical.pressureAbsBar, 'bar a'), ['Sink Flow', 'Mode']) ? 1 : 0;
      changed += upsertSinkCanvasRow(panel, 'Sink Elev.', formatCanvasValue(elevation, 'm'), ['Sink P abs', 'Sink Flow']) ? 1 : 0;
      changed += upsertSinkCanvasRow(panel, 'Sink Head', formatCanvasValue(sinkHead, 'm'), ['Sink Elev.', 'Sink P abs', 'Sink Flow']) ? 1 : 0;
      if (canonical.operatingFeasibilityStatus) {
        changed += upsertSinkCanvasRow(panel, 'Boundary', canonical.operatingFeasibilityStatus, ['Sink Head', 'Sink Elev.']) ? 1 : 0;
      }
      if (canonical.headResidual !== null) {
        changed += upsertSinkCanvasRow(panel, 'Head Res.', formatCanvasValue(canonical.headResidual, 'm'), ['Boundary', 'Sink Head']) ? 1 : 0;
      }
      if (canonical.maxAllowableSnkElevation !== null) {
        changed += upsertSinkCanvasRow(panel, 'Max Elev.', formatCanvasValue(canonical.maxAllowableSnkElevation, 'm'), ['Head Res.', 'Boundary', 'Sink Head']) ? 1 : 0;
      }
      changed += syncSinkObjectTooltip(panel, node, canonical);
    });
    return changed;
  }

  function localStorageFlag(key) {
    try {
      return root.localStorage?.getItem(key) === 'true';
    } catch (error) {
      return false;
    }
  }

  function formatTooltipMetricLine(line, metricRules) {
    const match = String(line || '').match(/^([^:]+):\s*([-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?)(?:\s+.*)?$/i);
    if (!match) return line;
    const label = normalizeText(match[1]);
    const rule = metricRules[label];
    if (!rule) return line;
    const number = finiteNumber(match[2]);
    if (number === null) return line;
    const value = `${rule.showSign && number > 0 ? '+' : ''}${number.toFixed(rule.digits ?? 3)}`;
    return `${rule.label || label}: ${value}${rule.unit ? ` ${rule.unit}` : ''}`;
  }

  function patchSinkStatusTooltip() {
    if (
      typeof root.getSinkOperatingStatusTooltip !== 'function'
      || root.getSinkOperatingStatusTooltip.__routeTraceSinkTerminologyLock === VERSION
    ) {
      return false;
    }
    const originalSinkTooltip = root.getSinkOperatingStatusTooltip;
    const metricRules = {
      'Required outlet pressure': { label: 'Sink P abs', unit: 'bar a', digits: 3 },
      'Outlet pressure': { label: 'Sink P abs', unit: 'bar a', digits: 3 },
      'Outlet flow': { label: 'Sink Flow', unit: 'm3/h', digits: 3 },
      'Flow demand': { label: 'Sink Flow', unit: 'm3/h', digits: 3 },
      'SNK hydraulic head': { label: 'Sink Head', unit: 'm', digits: 3 },
      'Discharge loss': { unit: 'm', digits: 3 },
      'Vapor pressure': { unit: 'bar a', digits: 3 },
      'Outlet pressure minus vapor pressure': { unit: 'bar', digits: 3, showSign: true },
      'Pump NPSH margin': { unit: 'm', digits: 4, showSign: true },
      'Head residual': { label: 'Head Res.', unit: 'm', digits: 3, showSign: true },
      'Head Res.': { unit: 'm', digits: 3, showSign: true },
      'Max SNK elevation': { label: 'Max Elev.', unit: 'm', digits: 3 },
      'Max Elev.': { unit: 'm', digits: 3 }
    };
    root.getSinkOperatingStatusTooltip = function getSinkOperatingStatusTooltipLocked(...args) {
      const text = String(originalSinkTooltip.apply(this, args) || '');
      const node = args[1] || {};
      const canonical = sinkCanonicalValues(node);
      let sinkFlowLineSeen = false;
      const lines = text.split('\n').map((line) => {
        if (/^SNK status:/i.test(line)) {
          return `SNK status: ${canonical.engineeringStatus || canonical.operatingFeasibilityStatus || normalizeText(line).replace(/^SNK status:\s*/i, '') || 'OK'}`;
        }
        if (/^Mode:/i.test(line)) {
          const mode = sinkModeDisplayValue(node, null);
          return `Mode: ${mode === '-' ? normalizeText(line).replace(/^Mode:\s*/i, '') || '-' : mode}`;
        }
        if (/^(Outlet flow|Flow demand):/i.test(line)) {
          if (sinkFlowLineSeen) return '';
          sinkFlowLineSeen = true;
          return `Sink Flow: ${formatCanvasValue(canonical.sinkFlow, 'm3/h')}`;
        }
        if (/^(Required outlet pressure|Outlet pressure):/i.test(line)) {
          return `Sink P abs: ${formatCanvasValue(canonical.pressureAbsBar, 'bar a')}`;
        }
        if (/^SNK hydraulic head:/i.test(line)) {
          return `Sink Head: ${formatCanvasValue(canonical.sinkHead, 'm')}`;
        }
        return formatTooltipMetricLine(line, metricRules);
      }).filter(Boolean);
      if (!lines.some((line) => /^Sink Elev\.:/i.test(line))) {
        const pressureIndex = lines.findIndex((line) => /^Sink P abs:/i.test(line));
        const elevationLine = `Sink Elev.: ${formatCanvasValue(canonical.elevation, 'm')}`;
        lines.splice(pressureIndex >= 0 ? pressureIndex + 1 : Math.min(2, lines.length), 0, elevationLine);
      }
      if (canonical.operatingFeasibilityStatus && !lines.some((line) => /^Boundary:/i.test(line))) {
        lines.push(`Boundary: ${canonical.operatingFeasibilityStatus}`);
      }
      if (canonical.headResidual !== null && !lines.some((line) => /^Head Res\.:/i.test(line))) {
        lines.push(`Head Res.: ${formatCanvasValue(canonical.headResidual, 'm')}`);
      }
      if (canonical.maxAllowableSnkElevation !== null && !lines.some((line) => /^Max Elev\.:/i.test(line))) {
        lines.push(`Max Elev.: ${formatCanvasValue(canonical.maxAllowableSnkElevation, 'm')}`);
      }
      const corePatterns = [/^Mode:/i, /^Sink Flow:/i, /^Sink P abs:/i, /^Sink Elev\.:/i, /^Sink Head:/i, /^Boundary:/i, /^Head Res\.:/i, /^Max Elev\.:/i];
      const statusLines = lines.filter((line) => /^SNK status:/i.test(line));
      const coreLines = corePatterns
        .map((pattern) => lines.find((line) => pattern.test(line)))
        .filter(Boolean);
      const detailLines = lines.filter((line) => (
        !/^SNK status:/i.test(line)
        && !corePatterns.some((pattern) => pattern.test(line))
      ));
      return [...statusLines, ...coreLines, ...detailLines].join('\n');
    };
    root.getSinkOperatingStatusTooltip.__routeTraceSinkTerminologyLock = VERSION;
    return true;
  }

  function isRouteTraceCanvasOverlayUnlocked() {
    return root.__routeTraceCanvasOverlayUnlocked === true || localStorageFlag(CANVAS_OVERLAY_UNLOCK_KEY);
  }

  function isRouteTracePumpSummaryUnlocked() {
    return root.__routeTracePumpSummaryUnlocked === true
      || root.__routeTraceCanvasOverlayUnlocked === true
      || localStorageFlag(PUMP_SUMMARY_UNLOCK_KEY);
  }

  function setRouteTraceCanvasOverlayVisible(visible) {
    root.__routeTraceCanvasOverlayUnlocked = visible === true;
    try {
      root.localStorage?.setItem(CANVAS_OVERLAY_UNLOCK_KEY, root.__routeTraceCanvasOverlayUnlocked ? 'true' : 'false');
    } catch (error) {
      // Ignore storage failures in locked-down browser contexts.
    }
    pruneDefaultCanvasRouteTraceOverlays(typeof document !== 'undefined' ? document : null);
    return root.__routeTraceCanvasOverlayUnlocked;
  }

  function setRouteTracePumpSummaryVisible(visible) {
    root.__routeTracePumpSummaryUnlocked = visible === true;
    try {
      root.localStorage?.setItem(PUMP_SUMMARY_UNLOCK_KEY, root.__routeTracePumpSummaryUnlocked ? 'true' : 'false');
    } catch (error) {
      // Ignore storage failures in locked-down browser contexts.
    }
    refreshPumpObjectWindows();
    return root.__routeTracePumpSummaryUnlocked;
  }

  function shortHash(value) {
    const text = String(value || '');
    return text ? text.slice(0, 12) : '-';
  }

  function auditFreshnessLabel(payload = {}) {
    const dependencyManifest = payload.dependencyManifest || null;
    if (!dependencyManifest) {
      return payload.routeTrace?.schemaVersion && payload.routeTrace.schemaVersion !== 'route-trace.v2'
        ? 'Frontend fallback / unverified'
        : 'Unverified';
    }
    if (dependencyManifest.priorResultStale) return 'Recalculated after stale input change';
    return dependencyManifest.freshness || 'Current';
  }

  function auditSourceLabel(payload = {}) {
    if (payload.calculationAudit?.sourceOfTruth) return payload.calculationAudit.sourceOfTruth;
    if (payload.routeTrace?.schemaVersion === 'route-trace.v2' && payload.dependencyManifest) return 'backend';
    if (payload.routeTrace) return 'frontend fallback';
    return '-';
  }

  function formatValue(value, unit = '') {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') {
      const rounded = Number.isFinite(value) ? Number(value.toFixed(Math.abs(value) >= 100 ? 2 : 4)) : value;
      return `${rounded}${unit ? ` ${unit}` : ''}`;
    }
    return String(value);
  }

  function firstPumpNode() {
    const entries = Object.entries(model());
    const current = root.currentSelectedNode;
    if (current && model()[current]?.type === 'pump') return { id: current, node: model()[current] };
    const found = entries.find(([, node]) => node?.type === 'pump');
    return found ? { id: found[0], node: found[1] } : null;
  }

  function activeAuditPayload() {
    const pump = firstPumpNode();
    const results = pump?.node?.results || {};
    const fallbackTrace = typeof root.EngineeringCaptionAuditOverrides?.buildRuntimeRouteTrace === 'function'
      ? root.EngineeringCaptionAuditOverrides.buildRuntimeRouteTrace(pump?.node)
      : null;
    const routeTrace = results.routeTrace || results.npshEvaluation?.routeTrace || fallbackTrace || null;
    const calculationAudit = results.calculationAudit || null;
    const calculationDefenseContract = results.calculationDefenseContract || null;
    const dependencyManifest = results.dependencyManifest || calculationAudit?.dependencyManifest || null;
    const advancedEngineeringValidation = results.advancedEngineeringValidation || null;
    const securityPosture = results.securityPosture || null;
    const libraryManifest = results.libraryManifest || null;
    const backendValidation = results.backendValidation || null;
    const defenseExportContext = results.defenseExportContext || null;
    const apiAuditEvent = results.apiAuditEvent || null;
    return {
      pumpId: pump?.id || routeTrace?.pumpId || '',
      pumpNode: pump?.node || null,
      routeTrace,
      calculationAudit,
      calculationDefenseContract,
      dependencyManifest,
      advancedEngineeringValidation,
      securityPosture,
      libraryManifest,
      backendValidation,
      defenseExportContext,
      apiAuditEvent
    };
  }

  function auditPayloadFromResponse(response, result) {
    const calculationAudit = response?.calculationAudit || result?.calculationAudit || null;
    const calculationDefenseContract = response?.calculationDefenseContract || result?.calculationDefenseContract || null;
    const dependencyManifest = response?.dependencyManifest
      || result?.dependencyManifest
      || calculationAudit?.dependencyManifest
      || null;
    const routeTrace = response?.routeTrace || result?.routeTrace || null;
    const advancedEngineeringValidation = response?.advancedEngineeringValidation
      || result?.advancedEngineeringValidation
      || null;
    const securityPosture = response?.securityPosture || result?.securityPosture || null;
    const libraryManifest = response?.libraryManifest || result?.libraryManifest || null;
    const backendValidation = response?.backendValidation || result?.backendValidation || null;
    const defenseExportContext = response?.defenseExportContext || result?.defenseExportContext || null;
    const apiAuditEvent = response?.apiAuditEvent || result?.apiAuditEvent || null;
    return { calculationAudit, calculationDefenseContract, dependencyManifest, routeTrace, advancedEngineeringValidation, securityPosture, libraryManifest, backendValidation, defenseExportContext, apiAuditEvent };
  }

  function hasBackendAuditPayload(payload = {}) {
    return !!(
      payload?.routeTrace
      || payload?.dependencyManifest
      || payload?.calculationAudit
      || payload?.calculationDefenseContract
      || payload?.advancedEngineeringValidation
      || payload?.defenseExportContext
    );
  }

  function latestBackendSimulationResponse(backendResult, response) {
    if (hasBackendAuditPayload(response)) return response;
    const cached = root.__npshLastBackendSimulationResponse;
    const payload = cached?.response || null;
    if (!payload || !hasBackendAuditPayload(payload)) return response;
    if (payload.results === backendResult || payload.result === backendResult) return payload;
    return response;
  }

  function rememberDependencyFingerprint(dependencyManifest) {
    const fingerprint = dependencyManifest?.dependencyFingerprint || '';
    if (!fingerprint) return;
    root.__npshLastDependencyFingerprint = fingerprint;
    try {
      root.sessionStorage?.setItem('npsh:lastDependencyFingerprint', fingerprint);
    } catch (error) {
      root.__npshRouteTraceAuditStorageError = error;
    }
  }

  function previousDependencyFingerprint() {
    if (root.__npshLastDependencyFingerprint) return root.__npshLastDependencyFingerprint;
    try {
      return root.sessionStorage?.getItem('npsh:lastDependencyFingerprint') || null;
    } catch (error) {
      root.__npshRouteTraceAuditStorageError = error;
      return null;
    }
  }

  function attachAuditToPumpNode(pumpNode, response, result) {
    if (!pumpNode || typeof pumpNode !== 'object') return;
    const auditResponse = latestBackendSimulationResponse(result, response);
    const { calculationAudit, calculationDefenseContract, dependencyManifest, routeTrace, advancedEngineeringValidation, securityPosture, libraryManifest, backendValidation, defenseExportContext, apiAuditEvent } = auditPayloadFromResponse(auditResponse, result);
    if (!pumpNode.results || typeof pumpNode.results !== 'object') pumpNode.results = {};
    if (routeTrace) pumpNode.results.routeTrace = routeTrace;
    if (calculationAudit) pumpNode.results.calculationAudit = calculationAudit;
    if (calculationDefenseContract) pumpNode.results.calculationDefenseContract = calculationDefenseContract;
    if (advancedEngineeringValidation) pumpNode.results.advancedEngineeringValidation = advancedEngineeringValidation;
    if (securityPosture) pumpNode.results.securityPosture = securityPosture;
    if (libraryManifest) pumpNode.results.libraryManifest = libraryManifest;
    if (backendValidation) pumpNode.results.backendValidation = backendValidation;
    if (defenseExportContext) pumpNode.results.defenseExportContext = defenseExportContext;
    if (apiAuditEvent) pumpNode.results.apiAuditEvent = apiAuditEvent;
    if (dependencyManifest) {
      pumpNode.results.dependencyManifest = dependencyManifest;
      pumpNode.results.calculationFreshness = dependencyManifest.priorResultStale ? 'Recalculated after stale input change' : 'Current';
      pumpNode.results.isCalculationStale = false;
      pumpNode.results.previousResultWasStale = !!dependencyManifest.priorResultStale;
      rememberDependencyFingerprint(dependencyManifest);
    }
    if (typeof root.EngineeringRealtimeCalculationDefense?.markCurrentFromBackend === 'function' && hasBackendAuditPayload(auditResponse)) {
      root.EngineeringRealtimeCalculationDefense.markCurrentFromBackend(auditResponse);
    }
    refreshVisibleAuditSurfaces();
  }

  function stepPrimaryValue(step) {
    const values = step?.values || {};
    if (step.type === 'fluid') {
      return `${formatValue(values.densityKgM3, 'kg/m3')} | Pv ${formatValue(values.vaporPressureBarA, 'bar a')}`;
    }
    if (step.type === 'source' || step.type === 'sink') {
      return `P ${formatValue(values.pressureBarA, 'bar a')} | H ${formatValue(values.hydraulicHeadM, 'm')}`;
    }
    if (step.type === 'pump') {
      return `NPSHa ${formatValue(values.npshaM, 'm')} | NPSHr ${formatValue(values.npshrM, 'm')} | Margin ${formatValue(values.npshMarginM, 'm')}`;
    }
    return `HL ${formatValue(values.headLossM, 'm')} | dP ${formatValue(values.pressureDropBar, 'bar')}`;
  }

  function buildRouteAuditExportRows(payload = activeAuditPayload()) {
    const routeTrace = payload.routeTrace || {};
    const dependencyManifest = payload.dependencyManifest || {};
    return (routeTrace.steps || []).map((step) => ({
      order: step.order,
      objectId: step.id,
      objectType: step.type,
      stage: step.stage,
      role: step.role,
      formulaGroup: step.formulaGroup || '',
      formula: step.formula || '',
      directNpshImpact: step.directNpshImpact === true,
      systemHeadImpact: step.systemHeadImpact === true,
      primaryValue: stepPrimaryValue(step),
      dataStatus: step.audit?.dataStatus?.status || '',
      staleWhenChanged: (step.audit?.staleWhenChanged || []).join(' | '),
      literatureReferences: (step.literatureReferences || []).join('; '),
      calculationId: payload.calculationAudit?.calculationId || '',
      dependencyFingerprint: dependencyManifest.dependencyFingerprint || '',
      engineeringValidationStatus: payload.advancedEngineeringValidation?.status || ''
    }));
  }

  function routeAuditCsv(payload = activeAuditPayload()) {
    const rows = buildRouteAuditExportRows(payload);
    const headers = [
      'order',
      'objectId',
      'objectType',
      'stage',
      'role',
      'formulaGroup',
      'primaryValue',
      'directNpshImpact',
      'systemHeadImpact',
      'dataStatus',
      'staleWhenChanged',
      'literatureReferences',
      'calculationId',
      'dependencyFingerprint',
      'engineeringValidationStatus'
    ];
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [
      headers.map(quote).join(','),
      ...rows.map((row) => headers.map((header) => quote(row[header])).join(','))
    ].join('\n');
  }

  function backendContractWarnings(payload = activeAuditPayload()) {
    const warnings = [];
    const expected = {
      routeTrace: 'route-trace.v2',
      dependencyManifest: 'dependency-manifest.v1',
      calculationAudit: 'calculation-audit.v1',
      calculationDefenseContract: 'calculation-defense-contract.v1',
      advancedEngineeringValidation: 'advanced-engineering-validation.v1',
      defenseExportContext: 'defense-export-context.v1'
    };
    if (!payload.routeTrace) warnings.push('routeTrace is missing; route calculation output is not defense-ready.');
    else if (payload.routeTrace.schemaVersion !== expected.routeTrace) warnings.push(`routeTrace schema mismatch: expected ${expected.routeTrace}, got ${payload.routeTrace.schemaVersion || 'missing'}.`);
    if (!payload.dependencyManifest) warnings.push('dependencyManifest is missing; stale-calculation protection cannot be proven.');
    else if (payload.dependencyManifest.schemaVersion !== expected.dependencyManifest) warnings.push(`dependencyManifest schema mismatch: expected ${expected.dependencyManifest}, got ${payload.dependencyManifest.schemaVersion || 'missing'}.`);
    if (!payload.calculationAudit) warnings.push('calculationAudit is missing; calculationId and formula-source posture cannot be proven.');
    else if (payload.calculationAudit.schemaVersion !== expected.calculationAudit) warnings.push(`calculationAudit schema mismatch: expected ${expected.calculationAudit}, got ${payload.calculationAudit.schemaVersion || 'missing'}.`);
    if (!payload.calculationDefenseContract) warnings.push('calculationDefenseContract is missing; unified formula/dependency/trace/stale defense cannot be proven.');
    else if (payload.calculationDefenseContract.schemaVersion !== expected.calculationDefenseContract) warnings.push(`calculationDefenseContract schema mismatch: expected ${expected.calculationDefenseContract}, got ${payload.calculationDefenseContract.schemaVersion || 'missing'}.`);
    if (!payload.advancedEngineeringValidation) warnings.push('advancedEngineeringValidation is missing; NPSH acceptance review cannot be proven.');
    else if (payload.advancedEngineeringValidation.schemaVersion !== expected.advancedEngineeringValidation) warnings.push(`advancedEngineeringValidation schema mismatch: expected ${expected.advancedEngineeringValidation}, got ${payload.advancedEngineeringValidation.schemaVersion || 'missing'}.`);
    if (!payload.defenseExportContext) warnings.push('defenseExportContext is missing; one-click defense package readiness cannot be proven.');
    else if (payload.defenseExportContext.schemaVersion !== expected.defenseExportContext) warnings.push(`defenseExportContext schema mismatch: expected ${expected.defenseExportContext}, got ${payload.defenseExportContext.schemaVersion || 'missing'}.`);
    return warnings;
  }

  function downloadText(filename, mimeType, text) {
    if (typeof document === 'undefined') return false;
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    root.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  function downloadRouteAuditCsv() {
    const payload = activeAuditPayload();
    const pumpId = payload.pumpId || 'pump';
    return downloadText(`route-trace-audit-${pumpId}.csv`, 'text/csv;charset=utf-8', routeAuditCsv(payload));
  }

  function downloadRouteAuditJson() {
    const payload = activeAuditPayload();
    const pumpId = payload.pumpId || 'pump';
    return downloadText(
      `route-trace-audit-${pumpId}.json`,
      'application/json;charset=utf-8',
      JSON.stringify({
        routeTrace: payload.routeTrace || null,
        dependencyManifest: payload.dependencyManifest || null,
        calculationAudit: payload.calculationAudit || null,
        calculationDefenseContract: payload.calculationDefenseContract || null,
        advancedEngineeringValidation: payload.advancedEngineeringValidation || null,
        securityPosture: payload.securityPosture || null,
        libraryManifest: payload.libraryManifest || null,
        backendValidation: payload.backendValidation || null,
        defenseExportContext: payload.defenseExportContext || null,
        apiAuditEvent: payload.apiAuditEvent || null
      }, null, 2)
    );
  }

  async function copyRouteAuditJson() {
    const payload = activeAuditPayload();
    const text = JSON.stringify({
      routeTrace: payload.routeTrace || null,
      dependencyManifest: payload.dependencyManifest || null,
      calculationAudit: payload.calculationAudit || null,
      calculationDefenseContract: payload.calculationDefenseContract || null,
      advancedEngineeringValidation: payload.advancedEngineeringValidation || null,
      securityPosture: payload.securityPosture || null,
      libraryManifest: payload.libraryManifest || null,
      backendValidation: payload.backendValidation || null,
      defenseExportContext: payload.defenseExportContext || null,
      apiAuditEvent: payload.apiAuditEvent || null
    }, null, 2);
    if (root.navigator?.clipboard?.writeText) {
      await root.navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }

  function routeImpactLabel(step) {
    if (step.directNpshImpact) return 'Direct NPSHa loss';
    if (step.systemHeadImpact) return 'System head / outlet';
    if (step.type === 'fluid') return 'Global basis';
    if (step.type === 'source') return 'Suction boundary';
    return 'Trace context';
  }

  function isProtectedCanvasRouteTraceSurface(element) {
    return Boolean(element?.closest?.([
      `#${PANEL_ID}`,
      '#canvasContextDock',
      '.canvas-context-dock',
      '.route-trace-audit-panel',
      '.task-window',
      '.modal',
      '.context-menu',
      '.dropdown-menu',
      '.object-properties-task-window',
      '.persistent-object-properties-task-window'
    ].join(',')));
  }

  function hasRouteTraceOverlayText(element) {
    const text = normalizeText(element?.textContent);
    return Boolean(
      text
      && (
        ROUTE_TRACE_CANVAS_TEXT_PATTERN.test(text)
        || ROUTE_LOSS_TRACE_CANVAS_TEXT_PATTERN.test(text)
      )
    );
  }

  function isProtectedPfdObject(element) {
    return Boolean(
      element?.matches?.('.pfd-object')
      || element?.matches?.('[data-node-id]')
      || element?.matches?.('[data-object-id]')
    );
  }

  function isLikelyRouteTraceOverlayFrame(element, canvas) {
    if (!element || element === canvas || isProtectedPfdObject(element)) return false;
    const text = normalizeText(element.textContent);
    if (!hasRouteTraceOverlayText(element)) return false;
    const rect = element.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    if (rect.width > 760 || rect.height > 260) return false;
    const style = root.getComputedStyle?.(element);
    const className = String(element.className || '');
    const hasOverlayClass = /route|trace|readout|live|param|metric|annotation|caption|overlay|tooltip|audit/i.test(className);
    const hasFrameStyle = style && (
      style.position === 'absolute'
      || style.position === 'fixed'
      || style.borderTopStyle !== 'none'
      || style.borderRightStyle !== 'none'
      || style.boxShadow !== 'none'
      || style.backgroundColor !== 'rgba(0, 0, 0, 0)'
    );
    return hasOverlayClass || hasFrameStyle || text.length <= 420;
  }

  function routeTraceOverlayContainer(element, canvas) {
    if (!element || !canvas || isProtectedCanvasRouteTraceSurface(element)) return null;
    let cursor = element;
    let candidate = isLikelyRouteTraceOverlayFrame(cursor, canvas) ? cursor : null;
    while (cursor?.parentElement && cursor.parentElement !== canvas) {
      const parent = cursor.parentElement;
      if (isProtectedCanvasRouteTraceSurface(parent) || isProtectedPfdObject(parent)) break;
      if (!hasRouteTraceOverlayText(parent)) break;
      if (isLikelyRouteTraceOverlayFrame(parent, canvas)) candidate = parent;
      cursor = parent;
    }
    return candidate;
  }

  function pruneDefaultCanvasRouteTraceOverlays(scope) {
    const documentRef = typeof document !== 'undefined' ? document : null;
    if (!documentRef) return [];
    pruneDefaultPumpRouteTraceRows(scope || documentRef);
    pruneDefaultSinkCanvasRows(scope || documentRef);
    ensureDefaultSinkCanvasRows(scope || documentRef);
    syncRouteObjectTooltips(scope || documentRef);
    if (isRouteTraceCanvasOverlayUnlocked()) {
      documentRef.querySelectorAll(`.${CANVAS_OVERLAY_HIDDEN_CLASS}`).forEach((element) => {
        element.classList.remove(CANVAS_OVERLAY_HIDDEN_CLASS);
        if (!element.hasAttribute || element.hasAttribute('data-route-trace-default-lock')) element.removeAttribute('data-route-trace-default-lock');
        if (!element.hasAttribute || element.hasAttribute('aria-hidden')) element.removeAttribute('aria-hidden');
      });
      return [];
    }

    const rootNode = scope?.querySelectorAll ? scope : documentRef;
    const canvas = documentRef.getElementById('canvas');
    if (!canvas) return [];
    documentRef.querySelectorAll(`.${CANVAS_OVERLAY_HIDDEN_CLASS}`).forEach((element) => {
      if (!canvas.contains(element) || !hasRouteTraceOverlayText(element) || isProtectedPfdObject(element)) {
        element.classList.remove(CANVAS_OVERLAY_HIDDEN_CLASS);
        if (!element.hasAttribute || element.hasAttribute('data-route-trace-default-lock')) element.removeAttribute('data-route-trace-default-lock');
        if (!element.hasAttribute || element.hasAttribute('aria-hidden')) element.removeAttribute('aria-hidden');
      }
    });
    const hidden = new Set();
    const elements = [];
    if (rootNode.nodeType === 1) elements.push(rootNode);
    rootNode.querySelectorAll('*').forEach((element) => elements.push(element));
    elements.forEach((element) => {
      if (!canvas.contains(element) || !hasRouteTraceOverlayText(element)) return;
      const container = routeTraceOverlayContainer(element, canvas);
      if (!container) return;
      hidden.add(container);
    });
    hidden.forEach((element) => {
      if (!element.classList.contains(CANVAS_OVERLAY_HIDDEN_CLASS)) {
        element.classList.add(CANVAS_OVERLAY_HIDDEN_CLASS);
      }
      if (element.dataset.routeTraceDefaultLock !== 'hidden-default') {
        element.dataset.routeTraceDefaultLock = 'hidden-default';
      }
      if (element.getAttribute('aria-hidden') !== 'true') {
        element.setAttribute('aria-hidden', 'true');
      }
    });
    return [...hidden];
  }

  function scheduleDefaultCanvasRouteTracePrune(scope, delayMs = 40) {
    if (typeof document === 'undefined') return;
    canvasOverlayPruneScope = canvasOverlayPruneScope === document ? document : (scope || document);
    if (canvasOverlayPrunePending) return;
    canvasOverlayPrunePending = true;
    canvasOverlayPruneTimer = root.setTimeout?.(() => {
      const runScope = canvasOverlayPruneScope || document;
      canvasOverlayPrunePending = false;
      canvasOverlayPruneScope = null;
      canvasOverlayPruneTimer = null;
      pruneDefaultCanvasRouteTraceOverlays(runScope);
    }, Math.max(0, delayMs));
  }

  function startDefaultCanvasRouteTraceRetryLoop() {
    if (typeof document === 'undefined' || canvasOverlayRetryTimer) return false;
    canvasOverlayRetryCount = 0;
    canvasOverlayRetryTimer = root.setInterval?.(() => {
      canvasOverlayRetryCount += 1;
      pruneDefaultCanvasRouteTraceOverlays(document.getElementById('canvas') || document);
      if (canvasOverlayRetryCount >= 24) {
        root.clearInterval?.(canvasOverlayRetryTimer);
        canvasOverlayRetryTimer = null;
      }
    }, 250);
    return true;
  }

  function patchCanvasOverlayRenderFunction(functionName) {
    if (canvasOverlayWrappedFunctions.has(functionName)) return false;
    const original = root[functionName];
    if (typeof original !== 'function' || original.__routeTraceCanvasOverlayLockPatched) return false;
    function routeTraceCanvasOverlayLockedFunction(...args) {
      const result = original.apply(this, args);
      const prune = () => {
        const canvas = document.getElementById('canvas') || document;
        scheduleDefaultCanvasRouteTracePrune(canvas, 0);
        scheduleDefaultCanvasRouteTracePrune(canvas, 80);
        scheduleDefaultCanvasRouteTracePrune(canvas, 220);
        scheduleRouteObjectTooltipSync(canvas, 320);
        scheduleRouteObjectTooltipSync(canvas, 900);
      };
      if (result && typeof result.then === 'function') return result.finally(prune);
      prune();
      return result;
    }
    routeTraceCanvasOverlayLockedFunction.__routeTraceCanvasOverlayLockPatched = true;
    routeTraceCanvasOverlayLockedFunction.__routeTraceCanvasOverlayLockOriginal = original;
    root[functionName] = routeTraceCanvasOverlayLockedFunction;
    canvasOverlayWrappedFunctions.add(functionName);
    return true;
  }

  function patchCanvasOverlayRenderHooks() {
    return [
      'applySimulationState',
      'applySimulationStateAtomic',
      'drawConnections',
      'notifyRealtimeTaskWindows',
      'renderToolbarPalette',
      'updateAllObjectOperatingStatusVisuals',
      'updateSimulation'
    ].filter((functionName) => patchCanvasOverlayRenderFunction(functionName));
  }

  function watchDefaultCanvasRouteTraceOverlays() {
    if (
      typeof document === 'undefined'
      || typeof root.MutationObserver !== 'function'
      || canvasOverlayObserver
    ) {
      return false;
    }
    canvasOverlayObserver = new root.MutationObserver((mutations) => {
      let shouldSyncTooltips = false;
      const overlayUnlocked = isRouteTraceCanvasOverlayUnlocked();
      let shouldPruneCanvas = false;
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' || mutation.type === 'attributes') {
          shouldPruneCanvas = !overlayUnlocked;
          shouldSyncTooltips = true;
        }
        for (const node of mutation.addedNodes || []) {
          if (node?.nodeType === 1) {
            shouldPruneCanvas = !overlayUnlocked;
            shouldSyncTooltips = true;
          }
          if (node?.nodeType === 3) {
            shouldPruneCanvas = !overlayUnlocked;
            shouldSyncTooltips = true;
          }
        }
      }
      if (shouldSyncTooltips) scheduleRouteObjectTooltipSync(document.getElementById('canvas') || document, 60);
      if (shouldPruneCanvas) scheduleDefaultCanvasRouteTracePrune(document.getElementById('canvas') || document, 0);
    });
    const start = () => {
      const canvas = document.getElementById('canvas');
      canvasOverlayObserver.observe(canvas || document.documentElement, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true
      });
      pruneDefaultCanvasRouteTraceOverlays(canvas || document);
      scheduleDefaultCanvasRouteTracePrune(canvas || document, 120);
      startDefaultCanvasRouteTraceRetryLoop();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
    return true;
  }

  function renderRoutePanelBody() {
    const body = document.getElementById(PANEL_BODY_ID);
    if (!body) return;
    const payload = activeAuditPayload();
    const { routeTrace, dependencyManifest, calculationAudit, advancedEngineeringValidation, pumpId } = payload;
    const contractWarnings = backendContractWarnings(payload);
    if (!routeTrace) {
      body.innerHTML = [
        '<div class="route-audit-empty">',
        '<strong>Route trace is not available yet.</strong>',
        '<span>Realtime autosolve runs after Fluid Basis, SRC, pump route, and SNK are connected; use Validate / Refresh Evidence for a manual audit refresh.</span>',
        contractWarnings.length ? `<p class="route-audit-schema-warning">Schema Warning: ${escapeText(contractWarnings.join(' | '))}</p>` : '',
        '</div>'
      ].join('');
      return;
    }
    const suction = routeTrace.sections?.suction || {};
    const discharge = routeTrace.sections?.discharge || {};
    const rows = (routeTrace.steps || []).map((step) => `
      <tr>
        <td>${escapeText(step.order)}</td>
        <td><strong>${escapeText(step.id)}</strong><span>${escapeText(step.type)}</span></td>
        <td>${escapeText(step.stage || '')}</td>
        <td>${escapeText(routeImpactLabel(step))}</td>
        <td>${escapeText(stepPrimaryValue(step))}</td>
        <td>${escapeText(step.formulaGroup || '')}<span>${escapeText((step.literatureReferences || []).join(', '))}</span></td>
        <td>${escapeText(step.audit?.dataStatus?.status || '-')}</td>
      </tr>
    `).join('');
    body.innerHTML = `
      <section class="route-audit-summary">
        <div><span>Pump</span><strong>${escapeText(pumpId || routeTrace.pumpId || '-')}</strong></div>
        <div><span>Freshness</span><strong>${escapeText(auditFreshnessLabel(payload))}</strong></div>
        <div><span>Engineering Validation</span><strong>${escapeText(advancedEngineeringValidation?.status || '-')}</strong></div>
        <div><span>Calculation ID</span><strong>${escapeText(calculationAudit?.calculationId || '-')}</strong></div>
        <div><span>Dependency</span><strong>${escapeText(shortHash(dependencyManifest?.dependencyFingerprint))}</strong></div>
      </section>
      <section class="route-audit-path">
        <h3>Route Calculation</h3>
        <p>${escapeText(routeTrace.text || '')}</p>
        <div class="route-audit-loss-grid">
          <div><span>Suction loss</span><strong>${escapeText(formatValue(suction.totalLossM, 'm'))}</strong><small>Direct NPSHa impact</small></div>
          <div><span>Discharge loss</span><strong>${escapeText(formatValue(discharge.totalLossM, 'm'))}</strong><small>System head impact</small></div>
        </div>
      </section>
      <section class="route-audit-table-wrap">
        <table class="route-audit-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Object</th>
              <th>Stage</th>
              <th>Impact</th>
              <th>Primary value</th>
              <th>Formula / literature</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
      <section class="route-audit-notes">
        <h3>Audit Boundary</h3>
        ${contractWarnings.length ? `<p class="route-audit-schema-warning">Schema Warning: ${escapeText(contractWarnings.join(' | '))}</p>` : ''}
        <p>${escapeText(routeTrace.audit?.protectedFormulaSource || 'Backend remains source of truth for protected calculation.')}</p>
        <p>${escapeText(advancedEngineeringValidation?.summary?.conclusion || 'Advanced engineering validation appears after backend calculation.')}</p>
        <p>${escapeText(dependencyManifest?.fallbackTraceBoundary?.policy || routeTrace.audit?.fallbackTraceBoundary || '')}</p>
        <p>${escapeText(dependencyManifest?.staleCalculationPolicy?.uiExpectation || 'Use calculationId and dependencyFingerprint to verify current results before export.')}</p>
        <p>${escapeText(dependencyManifest?.softwareDependencyChangeGate?.validationCommand || 'Run release integrity audit after dependency or release file changes.')}</p>
      </section>
      <div class="route-audit-actions">
        <button type="button" data-route-audit-action="json">Download JSON</button>
        <button type="button" data-route-audit-action="csv">Download CSV</button>
        <button type="button" data-route-audit-action="copy">Copy JSON</button>
      </div>
    `;
  }

  function ensureRoutePanel() {
    if (typeof document === 'undefined') return null;
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'task-window route-trace-audit-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="task-window-header route-audit-header">
        <span>Route Calculation Audit</span>
        <span class="task-window-actions">
          <button class="task-window-minimize" type="button" data-route-audit-minimize aria-label="Minimize route calculation audit">_</button>
          <button class="task-window-close" type="button" data-route-audit-close aria-label="Close route calculation audit">X</button>
        </span>
      </div>
      <div class="task-window-body route-audit-body" id="${PANEL_BODY_ID}"></div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener('click', async (event) => {
      const action = event.target?.dataset?.routeAuditAction;
      if (event.target?.matches?.('[data-route-audit-close]')) panel.hidden = true;
      if (event.target?.matches?.('[data-route-audit-minimize]')) panel.classList.toggle('task-window-minimized');
      if (action === 'json') downloadRouteAuditJson();
      if (action === 'csv') downloadRouteAuditCsv();
      if (action === 'copy') {
        const ok = await copyRouteAuditJson();
        if (typeof root.showUiToast === 'function') {
          root.showUiToast(ok ? 'Route audit JSON copied.' : 'Clipboard is unavailable.', {
            title: 'Route Calculation Audit',
            variant: ok ? 'success' : 'warning'
          });
        }
      }
    });
    return panel;
  }

  function openRouteAuditPanel() {
    const panel = ensureRoutePanel();
    if (!panel) return null;
    panel.hidden = false;
    panel.classList.remove('task-window-minimized');
    renderRoutePanelBody();
    return panel;
  }

  function ensureMenuButton() {
    if (typeof document === 'undefined') return false;
    const menu = document.getElementById('dropdown-tools') || document.getElementById('dropdown-view');
    if (!menu || document.getElementById(MENU_BUTTON_ID)) return false;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = MENU_BUTTON_ID;
    button.textContent = 'Route Calculation Audit';
    button.dataset.i18nText = 'menu.routeCalculationAudit';
    button.addEventListener('click', () => openRouteAuditPanel());
    const anchor = document.getElementById('menu-tools-export-excel') || menu.firstElementChild;
    if (anchor?.nextSibling) menu.insertBefore(button, anchor.nextSibling);
    else menu.appendChild(button);
    return true;
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('engineering-route-trace-audit-style')) return;
    const style = document.createElement('style');
    style.id = 'engineering-route-trace-audit-style';
    style.textContent = [
      '.route-trace-canvas-overlay-hidden{display:none!important;}',
      '.route-trace-sink-mode-hidden{display:none!important;}',
      '.route-trace-sink-trace-collapsed{display:none!important;}',
      '.route-trace-sink-layout-locked .route-trace-sink-trace-toggle .prop-section-header{cursor:pointer;-webkit-user-select:none;user-select:none;}',
      '.route-trace-sink-layout-locked .route-trace-sink-trace-toggle .prop-section-header::before{content:"- ";font-weight:900;}',
      '.route-trace-sink-layout-locked .route-trace-sink-trace-toggle[data-route-trace-sink-trace-collapse="collapsed"] .prop-section-header::before{content:"+ ";}',
      '.route-trace-audit-panel{left:clamp(12px,3vw,42px);right:auto;top:118px;width:min(980px,calc(100vw - 28px));height:min(680px,calc(100dvh - 140px));}',
      '.route-trace-audit-panel.task-window-minimized{height:42px!important;min-height:42px;}',
      '.route-trace-audit-panel.task-window-minimized .route-audit-body{display:none;}',
      '.route-audit-body{display:flex;flex-direction:column;gap:10px;padding:12px;}',
      '.route-audit-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}',
      '.route-audit-summary div,.route-audit-loss-grid div{min-width:0;padding:8px;border:1px solid #d8e6f2;border-radius:6px;background:#fff;}',
      '.route-audit-summary span,.route-audit-loss-grid span,.route-audit-table td span{display:block;color:#64748b;font-size:10px;line-height:1.2;}',
      '.route-audit-summary strong,.route-audit-loss-grid strong{display:block;min-width:0;margin-top:2px;color:#123b5a;font-size:12px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;}',
      '.route-audit-path,.route-audit-notes{padding:10px;border:1px solid #d8e6f2;border-radius:6px;background:#fff;}',
      '.route-audit-path h3,.route-audit-notes h3{margin:0 0 5px;color:#123b5a;font-size:13px;line-height:1.2;}',
      '.route-audit-path p,.route-audit-notes p{margin:0 0 5px;color:#334155;font-size:11px;line-height:1.35;}',
      '.route-audit-schema-warning{padding:6px 8px;border:1px solid #f2d28a;border-radius:5px;background:#fffaf0;color:#7a4b00;font-weight:700;}',
      '.route-audit-loss-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px;}',
      '.route-audit-loss-grid small{display:block;margin-top:2px;color:#475569;font-size:10px;line-height:1.25;}',
      '.route-audit-table-wrap{min-height:0;overflow:auto;border:1px solid #d8e6f2;border-radius:6px;background:#fff;}',
      '.route-audit-table{width:100%;border-collapse:collapse;font-size:10.5px;line-height:1.35;}',
      '.route-audit-table th{position:sticky;top:0;padding:7px;border-bottom:1px solid #d8e6f2;background:#eef6fc;color:#123b5a;text-align:left;z-index:1;}',
      '.route-audit-table td{padding:7px;border-bottom:1px solid #edf2f7;color:#334155;vertical-align:top;}',
      '.route-audit-actions{display:flex;flex-wrap:wrap;gap:6px;}',
      '.route-audit-actions button,.route-audit-open-btn{padding:6px 8px;border:1px solid #1c4568;border-radius:5px;background:#eef6fc;color:#123b5a;font-size:11px;font-weight:700;cursor:pointer;}',
      '.route-audit-pump-summary{margin:0 0 12px;padding:10px;border:1px solid #d8e6f2;border-radius:8px;background:#fff;}',
      '.route-audit-pump-summary h3{margin:0 0 7px;color:#123b5a;font-size:13px;line-height:1.2;}',
      '.route-audit-pump-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;}',
      '.route-audit-pump-grid div{min-width:0;padding:6px;border:1px solid #e2edf7;border-radius:6px;background:#f8fbff;}',
      '.route-audit-pump-grid span{display:block;color:#64748b;font-size:10px;line-height:1.2;}',
      '.route-audit-pump-grid strong{display:block;min-width:0;margin-top:2px;color:#123b5a;font-size:11px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;}',
      '@media (max-width:760px){.route-audit-summary,.route-audit-loss-grid,.route-audit-pump-grid{grid-template-columns:1fr;}.route-trace-audit-panel{top:76px;height:calc(100dvh - 92px);}}'
    ].join('');
    document.head.appendChild(style);
  }

  function renderPumpSummaryInto(body) {
    if (!body || typeof document === 'undefined') return;
    if (!isRouteTracePumpSummaryUnlocked()) {
      body.querySelector('[data-route-audit-pump-summary="true"]')?.remove();
      body.dataset.routeTracePumpSummaryDefaultLock = 'hidden-default';
      return;
    }
    delete body.dataset.routeTracePumpSummaryDefaultLock;
    const payload = activeAuditPayload();
    const routeTrace = payload.routeTrace;
    const dependencyManifest = payload.dependencyManifest;
    const calculationAudit = payload.calculationAudit;
    const advancedEngineeringValidation = payload.advancedEngineeringValidation;
    if (!routeTrace && !calculationAudit && !dependencyManifest && !advancedEngineeringValidation) return;
    let section = body.querySelector('[data-route-audit-pump-summary="true"]');
    if (!section) {
      section = document.createElement('section');
      section.className = 'route-audit-pump-summary';
      section.dataset.routeAuditPumpSummary = 'true';
      body.insertBefore(section, body.firstElementChild || null);
    }
    section.innerHTML = `
      <h3>Route Trace & Audit</h3>
      <div class="route-audit-pump-grid">
        <div><span>Calculation ID</span><strong>${escapeText(calculationAudit?.calculationId || '-')}</strong></div>
        <div><span>Freshness</span><strong>${escapeText(auditFreshnessLabel(payload))}</strong></div>
        <div><span>Engineering Validation</span><strong>${escapeText(advancedEngineeringValidation?.status || '-')}</strong></div>
        <div><span>Backend Source</span><strong>${escapeText(auditSourceLabel(payload))}</strong></div>
        <div><span>Suction Loss</span><strong>${escapeText(formatValue(routeTrace?.sections?.suction?.totalLossM, 'm'))}</strong></div>
        <div><span>Discharge Loss</span><strong>${escapeText(formatValue(routeTrace?.sections?.discharge?.totalLossM, 'm'))}</strong></div>
        <div><span>Dependency</span><strong>${escapeText(shortHash(dependencyManifest?.dependencyFingerprint))}</strong></div>
      </div>
      <p style="margin:8px 0 0;color:#475569;font-size:10.5px;line-height:1.35;">${escapeText(routeTrace?.text || 'Route trace will appear after backend evaluation.')}</p>
      <div class="route-audit-actions" style="margin-top:8px;"><button type="button" class="route-audit-open-btn" data-route-audit-open-panel>Open Route Calculation Audit</button></div>
    `;
    section.querySelector('[data-route-audit-open-panel]')?.addEventListener('click', openRouteAuditPanel);
  }

  function refreshPumpObjectWindows() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.persistent-object-properties-task-window, #taskWindow').forEach((windowNode) => {
      const text = windowNode.textContent || '';
      if (!/Pump Object Properties|\bP-\d+\b/i.test(text)) return;
      const body = windowNode.querySelector('.object-properties-task-body, .task-window-body');
      renderPumpSummaryInto(body);
    });
  }

  function refreshVisibleAuditSurfaces() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById(PANEL_ID)?.hidden) renderRoutePanelBody();
    refreshPumpObjectWindows();
    syncSinkPropertyWindowCanonicalReadouts(document);
    pruneDefaultCanvasRouteTraceOverlays(typeof document !== 'undefined' ? document : null);
  }

  function installSinkPropertyChangeRefresh() {
    if (typeof document === 'undefined' || sinkPropertyChangeRefreshInstalled) return false;
    sinkPropertyChangeRefreshInstalled = true;
    const schedule = () => [0, 80, 240, 640].forEach((delayMs) => root.setTimeout?.(refreshVisibleAuditSurfaces, delayMs));
    const onChange = (event) => {
      const target = event.target;
      const key = normalizeText(target?.dataset?.key || target?.name || target?.id || '');
      if (!/boundary|pressure|elevation|flow|demand/i.test(key)) return;
      if (!target?.closest?.('.persistent-object-properties-task-window, #taskWindow, [data-task-prop-body="true"]')) return;
      schedule();
    };
    document.addEventListener('input', onChange, true);
    document.addEventListener('change', onChange, true);
    return true;
  }

  function patchPayloadBuilder() {
    const original = root.buildBackendSimulationPayload;
    if (typeof original !== 'function' || original.__routeTraceAuditPatched) return false;
    function buildBackendSimulationPayloadWithAudit(...args) {
      const payload = original.apply(this, args) || {};
      payload.client = {
        ...(payload.client || {}),
        routeTraceAuditVersion: VERSION,
        previousDependencyFingerprint: previousDependencyFingerprint()
      };
      return payload;
    }
    buildBackendSimulationPayloadWithAudit.__routeTraceAuditPatched = true;
    root.buildBackendSimulationPayload = buildBackendSimulationPayloadWithAudit;
    return true;
  }

  function fetchInputUrl(input) {
    if (typeof input === 'string') return input;
    if (input?.url) return String(input.url);
    return '';
  }

  function requestPumpId(init) {
    try {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      return body?.pumpId || body?.target?.pumpId || '';
    } catch (error) {
      return '';
    }
  }

  function patchSimulationFetch() {
    const original = root.fetch;
    if (typeof original !== 'function' || original.__routeTraceAuditFetchPatched) return false;
    function routeTraceAuditFetch(input, init) {
      const url = fetchInputUrl(input);
      const shouldCapture = /\/api\/simulate(?:[?#]|$)/i.test(url);
      const promise = original.apply(this, arguments);
      if (!shouldCapture) return promise;
      const pumpId = requestPumpId(init);
      return promise.then((response) => {
        if (!response || typeof response.json !== 'function' || response.__routeTraceAuditJsonPatched) return response;
        const originalJson = response.json.bind(response);
        response.json = function routeTraceAuditJson(...jsonArgs) {
          return originalJson(...jsonArgs).then((payload) => {
            if (payload && typeof payload === 'object') {
              root.__npshLastBackendSimulationResponse = {
                schemaVersion: 'route-trace-audit-response-cache.v1',
                url,
                pumpId: pumpId || payload.pumpId || payload.routeTrace?.pumpId || '',
                capturedAt: new Date().toISOString(),
                response: payload
              };
            }
            return payload;
          });
        };
        response.__routeTraceAuditJsonPatched = true;
        return response;
      });
    }
    routeTraceAuditFetch.__routeTraceAuditFetchPatched = true;
    routeTraceAuditFetch.__routeTraceAuditOriginal = original;
    root.fetch = routeTraceAuditFetch;
    return true;
  }

  function patchPrimaryResultApplier() {
    const original = root.applyBackendSimulationPrimaryResults;
    if (typeof original !== 'function' || original.__routeTraceAuditPatched) return false;
    function applyBackendSimulationPrimaryResultsWithAudit(pumpNode, backendResult, response, ...rest) {
      const output = original.call(this, pumpNode, backendResult, response, ...rest);
      attachAuditToPumpNode(pumpNode, response, backendResult);
      [0, 120, 420, 1000].forEach((delayMs) => root.setTimeout?.(refreshVisibleAuditSurfaces, delayMs));
      return output;
    }
    applyBackendSimulationPrimaryResultsWithAudit.__routeTraceAuditPatched = true;
    root.applyBackendSimulationPrimaryResults = applyBackendSimulationPrimaryResultsWithAudit;
    return true;
  }

  function install() {
    ensureStyles();
    ensureRoutePanel();
    ensureMenuButton();
    watchDefaultCanvasRouteTraceOverlays();
    const patchedCanvasOverlayHooks = patchCanvasOverlayRenderHooks();
    pruneDefaultCanvasRouteTraceOverlays(typeof document !== 'undefined' ? document : null);
    const installed = {
      payloadBuilder: patchPayloadBuilder(),
      fetchSimulation: patchSimulationFetch(),
      primaryResultApplier: patchPrimaryResultApplier(),
      sinkStatusTooltip: patchSinkStatusTooltip(),
      sinkPropertyChangeRefresh: installSinkPropertyChangeRefresh(),
      canvasOverlayRenderHooks: patchedCanvasOverlayHooks,
      routePanel: typeof document !== 'undefined' && !!document.getElementById(PANEL_ID),
      menuButton: typeof document !== 'undefined' && !!document.getElementById(MENU_BUTTON_ID),
      routeTraceCanvasOverlayDefaultHidden: !isRouteTraceCanvasOverlayUnlocked(),
      routeTracePumpSummaryDefaultHidden: !isRouteTracePumpSummaryUnlocked()
    };
    root.__npshRouteTraceAuditInstalled = installed;
    refreshVisibleAuditSurfaces();
    return installed;
  }

  function startInstallLoop() {
    let attempts = 0;
    const timer = root.setInterval(() => {
      attempts += 1;
      const installed = install();
      if ((installed.payloadBuilder && installed.primaryResultApplier) || attempts >= 40) {
        root.clearInterval(timer);
      }
    }, 250);
  }

  const api = {
    version: VERSION,
    install,
    previousDependencyFingerprint,
    attachAuditToPumpNode,
    openRouteAuditPanel,
    activeAuditPayload,
    buildRouteAuditExportRows,
    backendContractWarnings,
    routeAuditCsv,
    downloadRouteAuditCsv,
    downloadRouteAuditJson,
    refreshVisibleAuditSurfaces,
    sinkCanonicalValues,
    sinkModeDisplayValue,
    syncSinkPropertyWindowCanonicalReadouts,
    collapseSinkTraceSections,
    lockSinkPropertyWindowLayout,
    pruneDefaultPumpRouteTraceRows,
    pruneDefaultSinkCanvasRows,
    normalizeDefaultSinkCanvasRows,
    ensureDefaultSinkCanvasRows,
    pruneDefaultCanvasRouteTraceOverlays,
    setRouteTraceCanvasOverlayVisible,
    setRouteTracePumpSummaryVisible,
    isRouteTraceCanvasOverlayUnlocked,
    isRouteTracePumpSummaryUnlocked
  };

  root.EngineeringRouteTraceAudit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document === 'undefined') {
    install();
  } else if (document.readyState === 'complete') {
    startInstallLoop();
  } else {
    root.addEventListener?.('load', startInstallLoop, { once: true });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.(`#${MENU_BUTTON_ID}`)) openRouteAuditPanel();
    });
    if (typeof root.MutationObserver === 'function') {
      const observer = new root.MutationObserver(() => {
        if (routeSurfaceRefreshPending) return;
        routeSurfaceRefreshPending = true;
        root.setTimeout(() => {
          routeSurfaceRefreshPending = false;
          refreshVisibleAuditSurfaces();
        }, 160);
      });
      const startRouteSurfaceObserver = () => {
        try {
          observer.observe(document.getElementById('canvas') || document.body || document.documentElement, { childList: true, subtree: true });
          refreshVisibleAuditSurfaces();
        } catch (error) {
          root.__npshRouteTraceAuditObserverError = error;
        }
      };
      if (document.readyState === 'loading') {
        root.addEventListener?.('load', startRouteSurfaceObserver, { once: true });
      } else {
        startRouteSurfaceObserver();
      }
    }
  }
})((typeof window !== 'undefined') ? window : globalThis);
