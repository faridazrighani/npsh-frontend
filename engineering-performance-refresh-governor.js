(function initEngineeringPerformanceRefreshGovernor(root) {
  'use strict';

  const VERSION = '2026.06-performance-refresh-governor5-head-power-audit';
  const DEFAULT_DELAY_MS = 300;
  const FAST_DELAY_MS = 180;
  const MAX_DELAY_MS = 1500;
  const INPUT_SHIELDED_REFRESH_TYPES = new Set([
    'secondary-task-windows',
    'pump-performance-chart',
    'pump-formula-audit',
    'formula-enhance',
  ]);
  const SECONDARY_WINDOW_SELECTOR = [
    '.pipe-formula-defense-task-window',
    '.pump-formula-defense-task-window',
    '.source-formula-defense-task-window',
    '.fluid-formula-defense-task-window',
    '.pump-curve-explanation-task-window',
  ].join(',');

  const state = {
    queue: new Map(),
    timer: null,
    raf: null,
    flushing: false,
    patched: new Set(),
    lastFlush: null,
    stats: {
      scheduled: 0,
      flushed: 0,
      skippedBySignature: 0,
      skippedHidden: 0,
      patched: 0,
    },
  };

  function now() {
    if (root.performance && typeof root.performance.now === 'function') {
      return root.performance.now();
    }
    return Date.now();
  }

  function currentInputLatencyShield() {
    try {
      if (typeof root.EngineeringInputLatencyShield?.current === 'function') {
        return root.EngineeringInputLatencyShield.current();
      }
      const shield = root.__engineeringInputLatencyShield;
      return shield && Number(shield.activeUntil) > Date.now() ? shield : null;
    } catch (error) {
      return null;
    }
  }

  function shieldAdjustedDelay(type, delayMs) {
    const shield = currentInputLatencyShield();
    if (!shield || !INPUT_SHIELDED_REFRESH_TYPES.has(String(type || ''))) {
      return delayMs;
    }
    const remaining = Math.max(0, Number(shield.activeUntil) - Date.now());
    return Math.max(delayMs, Math.min(MAX_DELAY_MS, remaining + 120));
  }

  function getDocument() {
    return root.document || null;
  }

  function asSafeDelay(delayMs) {
    const value = Number(delayMs);
    if (!Number.isFinite(value)) {
      return DEFAULT_DELAY_MS;
    }
    return Math.max(0, Math.min(MAX_DELAY_MS, value));
  }

  function normalizeNodeId(nodeId) {
    if (nodeId === null || nodeId === undefined) {
      return '';
    }
    return String(nodeId).trim();
  }

  function getModel() {
    let lexicalModel = null;
    try {
      lexicalModel = typeof globalModel !== 'undefined' ? globalModel : null;
    } catch (error) {
      lexicalModel = null;
    }
    return root.NPSH_PROJECT_MODEL
      || root.projectModel
      || root.currentProject
      || root.globalModel
      || root.__npshGlobalModel
      || lexicalModel
      || null;
  }

  function getObjectContainer(source) {
    if (!source || typeof source !== 'object') {
      return {};
    }
    if (source.nodes && typeof source.nodes === 'object') {
      return source.nodes;
    }
    if (source.nodeMap && typeof source.nodeMap === 'object') {
      return source.nodeMap;
    }
    if (source.objects && typeof source.objects === 'object') {
      return source.objects;
    }
    return source;
  }

  function getNodes() {
    return getObjectContainer(getModel());
  }

  function nodeEntries() {
    const nodes = getNodes();
    if (Array.isArray(nodes)) {
      return nodes
        .map((node, index) => [normalizeNodeId(node && (node.id || node.nodeId || node.key || index)), node])
        .filter(([, node]) => node && typeof node === 'object');
    }
    return Object.entries(nodes || {})
      .filter(([, node]) => node && typeof node === 'object');
  }

  function getNode(nodeId) {
    const id = normalizeNodeId(nodeId);
    if (!id) {
      return null;
    }
    const nodes = getNodes();
    if (nodes && !Array.isArray(nodes) && nodes[id]) {
      return nodes[id];
    }
    if (Array.isArray(nodes)) {
      return nodes.find((node) => normalizeNodeId(node && (node.id || node.nodeId)) === id) || null;
    }
    return null;
  }

  function getAllNodeIdsByType(typeList) {
    const wanted = new Set(typeList.map((item) => String(item).toLowerCase()));
    return nodeEntries()
      .filter(([, node]) => wanted.has(String(node.type || node.kind || node.category || '').toLowerCase()))
      .map(([id, node]) => normalizeNodeId(node.id || node.nodeId || id))
      .filter(Boolean);
  }

  function getConnections() {
    let lexicalConnections = null;
    try {
      lexicalConnections = typeof connections !== 'undefined' ? connections : null;
    } catch (error) {
      lexicalConnections = null;
    }
    const model = getModel();
    const candidates = [
      model && model.connections,
      model && model.links,
      model && model.edges,
      root.connections,
      root.__npshConnections,
      root.globalConnections,
      lexicalConnections,
      root.__npshLastBackendSimulationResponse && root.__npshLastBackendSimulationResponse.response && root.__npshLastBackendSimulationResponse.response.connections,
    ];
    return candidates.find(Array.isArray) || [];
  }

  function connectionEndpoint(connection, key) {
    if (!connection) {
      return '';
    }
    return normalizeNodeId(
      connection[key]
      || connection[`raw${key.charAt(0).toUpperCase()}${key.slice(1)}`]
      || connection[`${key}Node`]
      || connection[`${key}Id`]
      || ''
    );
  }

  function connectionPipeId(connection) {
    return normalizeNodeId(connection && (
      connection.pipeId
      || connection.pipe
      || connection.pipeNodeId
      || connection.via
      || connection.edgePipeId
      || ''
    ));
  }

  function readNodeType(nodeId) {
    const node = getNode(nodeId);
    return String(node && (node.type || node.kind || node.category) || '').toLowerCase();
  }

  function firstNodeIdByType(type) {
    return getAllNodeIdsByType([type])[0] || '';
  }

  function pipeFallbackIds(pumpId) {
    const pipes = getAllNodeIdsByType(['pipe']);
    const suction = pipes.find((id) => /suction|pipe-?1/i.test(id)) || pipes[0] || '';
    const discharge = pipes.find((id) => /discharge|pipe-?2/i.test(id)) || pipes.find((id) => id !== suction) || '';
    return { suction, discharge };
  }

  function findPumpDependencyIds(pumpId) {
    const id = normalizeNodeId(pumpId);
    const suctionConnection = getConnections().find((connection) => connectionEndpoint(connection, 'to') === id);
    const dischargeConnection = getConnections().find((connection) => connectionEndpoint(connection, 'from') === id);
    const fallbackPipes = pipeFallbackIds(id);
    const suctionPipeId = connectionPipeId(suctionConnection) || fallbackPipes.suction;
    const dischargePipeId = connectionPipeId(dischargeConnection) || fallbackPipes.discharge;
    const sourceId = connectionEndpoint(suctionConnection, 'from') || firstNodeIdByType('source');
    const sinkId = connectionEndpoint(dischargeConnection, 'to') || firstNodeIdByType('sink');
    const fluidIds = getAllNodeIdsByType(['fluid']);
    const all = new Set([id, sourceId, suctionPipeId, dischargePipeId, sinkId, ...fluidIds].filter(Boolean));
    return {
      pumpId: id,
      fluidIds,
      sourceId,
      suctionPipeId,
      dischargePipeId,
      sinkId,
      all,
    };
  }

  function pumpDependencySet(pumpId) {
    return findPumpDependencyIds(pumpId).all;
  }

  function relatedPumpsForNode(nodeId) {
    const id = normalizeNodeId(nodeId);
    const type = readNodeType(id);
    if (type === 'pump') {
      return new Set([id]);
    }
    const pumpIds = getAllNodeIdsByType(['pump']);
    if (type === 'fluid') {
      return new Set(pumpIds);
    }
    return new Set(pumpIds.filter((pumpId) => pumpDependencySet(pumpId).has(id)));
  }

  function relatedNodeIds(nodeId) {
    const id = normalizeNodeId(nodeId);
    if (!id) {
      return null;
    }
    const type = readNodeType(id);
    if (!type) {
      return new Set([id]);
    }
    if (type === 'pump') {
      return pumpDependencySet(id);
    }
    if (['pipe', 'source', 'sink', 'tank', 'vessel', 'fluid'].includes(type)) {
      const related = new Set([id]);
      relatedPumpsForNode(id).forEach((pumpId) => {
        pumpDependencySet(pumpId).forEach((dependencyId) => related.add(dependencyId));
      });
      return related;
    }
    return new Set([id]);
  }

  function getWindowNodeId(element) {
    if (!element || !element.dataset) {
      return '';
    }
    return normalizeNodeId(
      element.dataset.nodeId ||
      element.dataset.pipeNodeId ||
      element.dataset.pipeId ||
      element.dataset.pumpNodeId ||
      element.dataset.pumpId ||
      element.dataset.sourceNodeId ||
      element.dataset.sourceId ||
      element.dataset.fluidNodeId ||
      element.dataset.targetNodeId
    );
  }

  function getWindowKind(element) {
    if (!element || !element.classList) {
      return '';
    }
    if (element.classList.contains('pipe-formula-defense-task-window')) {
      return 'pipeFormulaDefense';
    }
    if (element.classList.contains('pump-formula-defense-task-window')) {
      return 'pumpFormulaDefense';
    }
    if (element.classList.contains('source-formula-defense-task-window')) {
      return 'sourceFormulaDefense';
    }
    if (element.classList.contains('fluid-formula-defense-task-window')) {
      return 'fluidFormulaDefense';
    }
    if (element.classList.contains('pump-curve-explanation-task-window')) {
      return 'pumpCurveExplanation';
    }
    return '';
  }

  function isVisibleElement(element) {
    const documentRef = getDocument();
    if (!element || !documentRef || !documentRef.documentElement.contains(element)) {
      return false;
    }
    if (documentRef.visibilityState === 'hidden') {
      return false;
    }
    const style = root.getComputedStyle ? root.getComputedStyle(element) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) {
      return false;
    }
    if (element.classList && element.classList.contains('minimized')) {
      return false;
    }
    if (element.offsetParent !== null || (typeof element.getClientRects === 'function' && element.getClientRects().length > 0)) {
      return true;
    }
    return element === documentRef.body || element === documentRef.documentElement;
  }

  function isWindowRelatedToNode(element, nodeId) {
    const id = normalizeNodeId(nodeId);
    if (!id) {
      return true;
    }
    const related = relatedNodeIds(id);
    if (!related) {
      return true;
    }
    const windowId = getWindowNodeId(element);
    if (!windowId) {
      return true;
    }
    return related.has(windowId);
  }

  function sortValue(value, depth) {
    if (depth > 6) {
      return '[depth]';
    }
    if (value === null || value === undefined) {
      return value;
    }
    const type = typeof value;
    if (type === 'number') {
      return Number.isFinite(value) ? Number(value.toPrecision(12)) : String(value);
    }
    if (type === 'string') {
      return value.length > 1000 ? value.slice(0, 1000) : value;
    }
    if (type === 'boolean') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.slice(0, 80).map((item) => sortValue(item, depth + 1));
    }
    if (type === 'object') {
      const output = {};
      Object.keys(value)
        .sort()
        .slice(0, 120)
        .forEach((key) => {
          if (typeof value[key] !== 'function') {
            output[key] = sortValue(value[key], depth + 1);
          }
        });
      return output;
    }
    return String(value);
  }

  function stableStringify(value) {
    try {
      return JSON.stringify(sortValue(value, 0));
    } catch (error) {
      return String(value);
    }
  }

  function hashString(input) {
    const text = String(input || '');
    let hash = 5381;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
      hash >>>= 0;
    }
    return hash.toString(36);
  }

  function finiteNumber(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? Number(number.toPrecision(12)) : null;
  }

  function firstFiniteValue(...values) {
    for (const value of values) {
      const number = finiteNumber(value);
      if (number !== null) {
        return number;
      }
    }
    return null;
  }

  function pickFields(source, fields) {
    const output = {};
    fields.forEach((field) => {
      if (source && Object.prototype.hasOwnProperty.call(source, field)) {
        output[field] = source[field];
      }
    });
    return output;
  }

  function nodeParts(nodeId) {
    const node = getNode(nodeId) || {};
    return {
      id: normalizeNodeId(nodeId),
      type: node.type || node.kind || node.category || '',
      props: node.props || {},
      results: node.results || {},
    };
  }

  function pipeDependencySnapshot(pipeId, role) {
    const node = nodeParts(pipeId);
    const results = node.results || {};
    const trace = results.calculationTrace || {};
    const totals = trace.totals || {};
    return {
      id: node.id,
      role,
      type: node.type,
      inputHash: hashString(stableStringify(pickFields(node.props, [
        'segments',
        'roughnessAgingFactor',
        'headLossAllowancePercent',
        'elevationProfileMode',
        'startElevation',
        'endElevation',
        'pressureBasis',
      ]))),
      flow: firstFiniteValue(results.flow, results.flowM3h, trace.basis && trace.basis.flowM3H),
      velocity: firstFiniteValue(results.velocity, trace.basis && trace.basis.velocity),
      totalK: firstFiniteValue(results.totalK, totals.totalK),
      majorLoss: firstFiniteValue(results.majorHeadLoss, totals.majorLoss),
      minorLoss: firstFiniteValue(results.minorHeadLoss, totals.minorLoss),
      totalLoss: firstFiniteValue(results.totalHeadLoss, results.headLoss, totals.totalLoss),
      pressureDrop: firstFiniteValue(results.pressureDrop, results.pressureDropBar, trace.hydraulic && trace.hydraulic.pressureDropBar),
      inletPressure: firstFiniteValue(results.pressureInBar, results.inletPressureBar),
      outletPressure: firstFiniteValue(results.pressureOutBar, results.outletPressureBar),
    };
  }

  function boundarySnapshot(nodeId, role) {
    const node = nodeParts(nodeId);
    return {
      id: node.id,
      role,
      type: node.type,
      props: pickFields(node.props, [
        'sourceType',
        'boundaryMode',
        'pressure',
        'pressureBasis',
        'pressureInputBasis',
        'pressureEnergyBasis',
        'elevation',
        'liquidLevel',
        'head',
        'flow',
        'demandFlow',
        'active',
      ]),
      results: pickFields(node.results, [
        'flow',
        'pressureBarA',
        'pressureAbsBar',
        'hydraulicHeadM',
        'head',
        'elevation',
        'demandFlowM3H',
        'evaluatedFlowM3H',
      ]),
    };
  }

  function buildPumpDependencyContract(pumpId) {
    const dependencies = findPumpDependencyIds(pumpId);
    const pump = nodeParts(dependencies.pumpId);
    const pumpResults = pump.results || {};
    const evaluation = pumpResults.npshEvaluation || {};
    const fluidSnapshots = dependencies.fluidIds.map((fluidId) => {
      const fluid = nodeParts(fluidId);
      return {
        id: fluid.id,
        type: fluid.type,
        props: pickFields(fluid.props, [
          'fluidName',
          'temp',
          'temperature',
          'density',
          'viscosity',
          'kinematicViscosity',
          'dynamicViscosity',
          'vaporPressure',
        ]),
        results: pickFields(fluid.results, [
          'density',
          'kinematicViscosity',
          'dynamicViscosity',
          'vaporPressure',
          'vaporPressureHead',
        ]),
      };
    });
    const pumpProps = pump.props || {};
    const pumpModeText = [
      pumpResults.solveMode,
      pumpResults.flowBasis,
      evaluation.solveMode,
      evaluation.flowBasis,
    ].filter(Boolean).join(' ');
    const routeOnlyPump = pumpResults.routeOnlyNpshEvaluation === true
      || evaluation.routeOnlyNpshEvaluation === true
      || /route-only/i.test(pumpModeText);
    const actualPumpHead = routeOnlyPump
      ? firstFiniteValue(evaluation.actualPumpHead, pumpResults.actualPumpHead)
      : firstFiniteValue(evaluation.actualPumpHead, pumpResults.actualPumpHead, evaluation.pumpHead, pumpResults.head, pumpResults.pumpHeadAtFlow);
    return {
      schemaVersion: 'pump-dependency-contract.v1',
      pumpId: dependencies.pumpId,
      dependencyIds: {
        fluid: dependencies.fluidIds,
        source: dependencies.sourceId,
        suctionPfv: dependencies.suctionPipeId,
        pump: dependencies.pumpId,
        dischargePfv: dependencies.dischargePipeId,
        sink: dependencies.sinkId,
      },
      fluidBasis: fluidSnapshots,
      source: boundarySnapshot(dependencies.sourceId, 'source'),
      suctionPfv: pipeDependencySnapshot(dependencies.suctionPipeId, 'suction'),
      pump: {
        id: pump.id,
        type: pump.type,
        props: pickFields(pumpProps, [
          'npshAssessmentMode',
          'suctionElevation',
          'designFlow',
          'designHead',
          'designEfficiency',
          'designNpshr',
          'npshrSourceMode',
          'npshMarginBasis',
          'minNpshMarginRatio',
          'minNpshMargin',
          'bepFlow',
          'porMinPercent',
          'porMaxPercent',
          'aorMinPercent',
          'aorMaxPercent',
          'curveDataSource',
        ]),
        curveInputHash: hashString(stableStringify(pickFields(pumpProps, [
          'curveData',
          'curvePoints',
          'pumpCurvePoints',
          'headCurve',
          'npshrCurve',
          'performancePoints',
        ]))),
      },
      dischargePfv: pipeDependencySnapshot(dependencies.dischargePipeId, 'discharge'),
      sink: boundarySnapshot(dependencies.sinkId, 'sink'),
      pumpPerformance: {
        flow: firstFiniteValue(evaluation.flow, pumpResults.fixedFlow, pumpResults.flow),
        head: actualPumpHead,
        npshr: firstFiniteValue(evaluation.npshr, pumpResults.npshr, pumpProps.designNpshr),
        chartDataHash: hashString(stableStringify(pickFields(pumpResults, [
          'performanceChartData',
          'pumpCurveData',
          'pumpCurve',
          'curveFit',
        ]))),
      },
      npshEvaluation: {
        status: evaluation.hydraulicStatus || evaluation.status || pumpResults.hydraulicNpshStatus || pumpResults.cavitationStatus || '',
        engineeringStatus: evaluation.engineeringStatus || pumpResults.engineeringStatus || '',
        dataConfidence: evaluation.dataConfidence || pumpResults.dataConfidence || '',
        flow: firstFiniteValue(evaluation.flow, pumpResults.fixedFlow, pumpResults.flow),
        pumpHead: actualPumpHead,
        npsha: firstFiniteValue(evaluation.npsha, pumpResults.npsha, pumpResults.npshAvailable),
        npshr: firstFiniteValue(evaluation.npshr, pumpResults.npshr, pumpResults.npshRequired),
        npshMargin: firstFiniteValue(evaluation.npshMargin, pumpResults.npshMargin),
        npshRatio: firstFiniteValue(evaluation.npshRatio, pumpResults.npshRatio),
        requiredNpsha: firstFiniteValue(evaluation.requiredNpsha, pumpResults.requiredNpsha),
        suctionPressureAbs: firstFiniteValue(evaluation.suctionPressureAbs, pumpResults.suctionPressure),
        suctionLoss: firstFiniteValue(evaluation.suctionLoss, pumpResults.suctionLoss),
        dischargeLoss: firstFiniteValue(evaluation.dischargeLoss, pumpResults.dischargeLoss),
        requiredSystemHead: firstFiniteValue(evaluation.requiredSystemHead, pumpResults.requiredSystemHead),
      },
      freshness: root.__engineeringCalculationFreshness && root.__engineeringCalculationFreshness.byNode
        ? root.__engineeringCalculationFreshness.byNode[dependencies.pumpId]
        : null,
    };
  }

  function getPipeSignaturePayload(nodeId) {
    const node = getNode(nodeId);
    const fluid = root.FluidBasisStore && typeof root.FluidBasisStore.getActive === 'function'
      ? root.FluidBasisStore.getActive()
      : null;
    return {
      nodeId: normalizeNodeId(nodeId),
      type: node && node.type,
      props: node && node.props,
      results: node && {
        flow: node.results && node.results.flow,
        flowM3h: node.results && node.results.flowM3h,
        velocity: node.results && node.results.velocity,
        reynolds: node.results && node.results.reynolds,
        pressureInBar: node.results && node.results.pressureInBar,
        pressureOutBar: node.results && node.results.pressureOutBar,
        pressureBar: node.results && node.results.pressureBar,
        totalK: node.results && node.results.totalK,
        totalHeadLoss: node.results && node.results.totalHeadLoss,
        majorHeadLoss: node.results && node.results.majorHeadLoss,
        minorHeadLoss: node.results && node.results.minorHeadLoss,
        calculationTrace: node.results && node.results.calculationTrace,
        segmentTrace: node.results && node.results.segmentTrace,
      },
      freshness: root.__engineeringCalculationFreshness && root.__engineeringCalculationFreshness.byNode
        ? root.__engineeringCalculationFreshness.byNode[normalizeNodeId(nodeId)]
        : null,
      fluid,
    };
  }

  function getPumpSignaturePayload(nodeId) {
    return {
      contract: buildPumpDependencyContract(nodeId),
      actionReadiness: getNode(nodeId) && getNode(nodeId).results && getNode(nodeId).results.actionReadiness,
    };
  }

  function traceSignature(kind, nodeId) {
    const normalizedKind = String(kind || '');
    const id = normalizeNodeId(nodeId);
    let payload = null;
    if (normalizedKind.indexOf('pipe') === 0) {
      payload = getPipeSignaturePayload(id);
    } else if (normalizedKind.indexOf('pump') === 0) {
      payload = getPumpSignaturePayload(id);
    } else {
      payload = {
        kind: normalizedKind,
        nodeId: id,
        node: getNode(id),
        fluid: root.FluidBasisStore && typeof root.FluidBasisStore.getActive === 'function'
          ? root.FluidBasisStore.getActive()
          : null,
      };
    }
    return hashString(stableStringify(payload));
  }

  function signatureKey(kind) {
    return `performanceRefreshSignature${String(kind || 'window')}`;
  }

  function readStoredSignature(element, kind) {
    if (!element || !element.dataset) {
      return '';
    }
    return element.dataset[signatureKey(kind)] || '';
  }

  function writeStoredSignature(element, kind, signature) {
    if (element && element.dataset) {
      element.dataset[signatureKey(kind)] = signature || '';
    }
  }

  function shouldSkipWindowBySignature(element, kind, nodeId, options) {
    if (options && options.force) {
      return false;
    }
    const id = normalizeNodeId(nodeId || getWindowNodeId(element));
    if (!kind || !id) {
      return false;
    }
    const signature = traceSignature(kind, id);
    if (!signature) {
      return false;
    }
    const previous = readStoredSignature(element, kind);
    if (previous && previous === signature) {
      state.stats.skippedBySignature += 1;
      return true;
    }
    return false;
  }

  function rememberWindowSignature(element, kind, nodeId) {
    const id = normalizeNodeId(nodeId || getWindowNodeId(element));
    if (!kind || !id) {
      return;
    }
    writeStoredSignature(element, kind, traceSignature(kind, id));
  }

  function getVisibleSecondaryWindows(nodeId) {
    const documentRef = getDocument();
    if (!documentRef) {
      return [];
    }
    return Array.from(documentRef.querySelectorAll(SECONDARY_WINDOW_SELECTOR))
      .filter((element) => {
        if (!isVisibleElement(element)) {
          state.stats.skippedHidden += 1;
          return false;
        }
        return isWindowRelatedToNode(element, nodeId);
      });
  }

  function schedule(keyType, nodeId, options) {
    const type = String(keyType || 'refresh');
    const id = normalizeNodeId(nodeId);
    const opts = options || {};
    const key = `${type}:${id || 'all'}`;
    const delayMs = asSafeDelay(shieldAdjustedDelay(type, opts.delayMs));
    state.queue.set(key, {
      key,
      type,
      nodeId: id,
      reason: opts.reason || '',
      createdAt: now(),
      run: typeof opts.run === 'function' ? opts.run : null,
      context: opts.context || null,
    });
    state.stats.scheduled += 1;
    armFlush(delayMs);
    return true;
  }

  function armFlush(delayMs) {
    if (state.timer) {
      root.clearTimeout(state.timer);
    }
    state.timer = root.setTimeout(() => {
      state.timer = null;
      if (root.requestAnimationFrame) {
        if (state.raf) {
          root.cancelAnimationFrame(state.raf);
        }
        state.raf = root.requestAnimationFrame(() => {
          state.raf = null;
          flush();
        });
      } else {
        flush();
      }
    }, delayMs);
    state.timer?.unref?.();
  }

  function flush() {
    if (state.flushing) {
      return false;
    }
    const jobs = Array.from(state.queue.values());
    state.queue.clear();
    if (!jobs.length) {
      return false;
    }
    state.flushing = true;
    const startedAt = now();
    const results = [];
    jobs.forEach((job) => {
      try {
        if (job && typeof job.run === 'function') {
          results.push({ key: job.key, value: job.run(job) });
        }
      } catch (error) {
        console.warn('[PerformanceRefreshGovernor] refresh job failed', job.key, error);
      }
    });
    state.flushing = false;
    state.stats.flushed += jobs.length;
    state.lastFlush = {
      at: Date.now(),
      durationMs: Number((now() - startedAt).toFixed(2)),
      jobs: jobs.map((job) => job.key),
      results,
    };
    root.__engineeringPerformanceRefreshGovernorLastFlush = state.lastFlush;
    return true;
  }

  function scheduleEnhance(scope, options) {
    const ui = root.EngineeringFormulaDefenseUI;
    if (!ui || typeof ui.enhanceDocument !== 'function') {
      return false;
    }
    const opts = options || {};
    const targetScope = scope || getDocument();
    const nodeId = opts.nodeId || (targetScope && typeof targetScope.closest === 'function'
      ? getWindowNodeId(targetScope.closest(SECONDARY_WINDOW_SELECTOR))
      : '');
    return schedule('formula-enhance', nodeId || 'document', {
      delayMs: opts.delayMs === undefined ? DEFAULT_DELAY_MS : opts.delayMs,
      reason: opts.reason || 'formula-enhance',
      run: () => {
        if (targetScope === getDocument() && !getVisibleSecondaryWindows(nodeId).length) {
          state.stats.skippedHidden += 1;
          return false;
        }
        const current = root.EngineeringFormulaDefenseUI;
        if (!current || typeof current.enhanceDocument !== 'function') {
          return false;
        }
        return current.enhanceDocument.__performanceRefreshGovernorOriginal
          ? current.enhanceDocument.__performanceRefreshGovernorOriginal.call(current, targetScope)
          : current.enhanceDocument.call(current, targetScope);
      },
    });
  }

  function refreshRelevantSecondaryWindows(context) {
    const detail = context || {};
    const nodeId = normalizeNodeId(detail.nodeId || detail.selectedNodeId || detail.targetNodeId);
    const windows = getVisibleSecondaryWindows(nodeId);
    let refreshed = 0;
    windows.forEach((element) => {
      const kind = getWindowKind(element);
      const elementNodeId = getWindowNodeId(element);
      if (shouldSkipWindowBySignature(element, kind, elementNodeId, detail)) {
        return;
      }
      if (typeof root.refreshRealtimeTaskWindowElement === 'function') {
        root.refreshRealtimeTaskWindowElement(element, detail);
        rememberWindowSignature(element, kind, elementNodeId);
        refreshed += 1;
      }
    });
    return refreshed;
  }

  function hasVisiblePumpChart(pumpId) {
    const documentRef = getDocument();
    if (!documentRef) {
      return false;
    }
    const selector = [
      '.pump-performance-chart-task-window',
      '.pump-performance-chart-window',
      '#fullEditor .caption-audit-inline-chart-wrap',
      '#fullEditor canvas',
      '#pumpChart',
      '#captionAuditPumpChartCanvas',
    ].join(',');
    return Array.from(documentRef.querySelectorAll(selector)).some((element) => {
      if (!isVisibleElement(element)) {
        return false;
      }
      if (!pumpId) {
        return true;
      }
      const container = element.closest ? element.closest('[data-node-id], [data-pump-id], .task-window, #fullEditor') : element;
      const id = getWindowNodeId(container) || normalizeNodeId(container && container.dataset && container.dataset.pumpId);
      return !id || id === normalizeNodeId(pumpId);
    });
  }

  function copyFunctionProperties(target, source) {
    try {
      Object.keys(source).forEach((key) => {
        try {
          target[key] = source[key];
        } catch (error) {
          /* ignore read-only compatibility properties */
        }
      });
    } catch (error) {
      /* ignore */
    }
  }

  function patchGlobalFunction(name, marker, wrapperFactory) {
    const original = root[name];
    if (typeof original !== 'function' || original[marker]) {
      return false;
    }
    const wrapped = wrapperFactory(original);
    if (typeof wrapped !== 'function') {
      return false;
    }
    copyFunctionProperties(wrapped, original);
    wrapped[marker] = VERSION;
    wrapped.__performanceRefreshGovernorOriginal = original;
    root[name] = wrapped;
    state.patched.add(name);
    state.stats.patched += 1;
    return true;
  }

  function patchObjectFunction(object, name, marker, wrapperFactory, label) {
    if (!object || typeof object[name] !== 'function' || object[name][marker]) {
      return false;
    }
    const original = object[name];
    const wrapped = wrapperFactory(original);
    if (typeof wrapped !== 'function') {
      return false;
    }
    copyFunctionProperties(wrapped, original);
    wrapped[marker] = VERSION;
    wrapped.__performanceRefreshGovernorOriginal = original;
    object[name] = wrapped;
    state.patched.add(label || name);
    state.stats.patched += 1;
    return true;
  }

  function patchRefreshFunctions() {
    patchGlobalFunction('refreshOpenRealtimeSecondaryTaskWindows', '__performanceRefreshGovernorPatched', (original) => {
      return function governedRefreshOpenRealtimeSecondaryTaskWindows(context) {
        const detail = context && typeof context === 'object' ? Object.assign({}, context) : {};
        const nodeId = normalizeNodeId(detail.nodeId || detail.selectedNodeId || detail.targetNodeId);
        return schedule('secondary-task-windows', nodeId, {
          delayMs: detail.delayMs === undefined ? DEFAULT_DELAY_MS : detail.delayMs,
          reason: detail.reason || 'secondary-task-windows',
          context: detail,
          run: () => refreshRelevantSecondaryWindows(detail),
        });
      };
    });

    patchGlobalFunction('refreshPipeFormulaDefenseWindowContent', '__performanceRefreshGovernorPatched', (original) => {
      return function governedRefreshPipeFormulaDefenseWindowContent(windowElement, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const kind = 'pipeFormulaDefense';
        const nodeId = getWindowNodeId(windowElement);
        if (windowElement && shouldSkipWindowBySignature(windowElement, kind, nodeId, opts)) {
          return false;
        }
        const result = original.apply(this, arguments);
        if (windowElement && typeof windowElement.querySelector === 'function') {
          rememberWindowSignature(windowElement, kind, nodeId);
          scheduleEnhance(windowElement, { nodeId, delayMs: FAST_DELAY_MS, reason: 'pipe-formula-content' });
        }
        return result;
      };
    });

    patchGlobalFunction('refreshPumpFormulaDefenseWindowContent', '__performanceRefreshGovernorPatched', (original) => {
      return function governedRefreshPumpFormulaDefenseWindowContent(windowElement, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const kind = 'pumpFormulaDefense';
        const nodeId = getWindowNodeId(windowElement);
        if (windowElement && shouldSkipWindowBySignature(windowElement, kind, nodeId, opts)) {
          return false;
        }
        const result = original.apply(this, arguments);
        if (windowElement && typeof windowElement.querySelector === 'function') {
          rememberWindowSignature(windowElement, kind, nodeId);
          scheduleEnhance(windowElement, { nodeId, delayMs: FAST_DELAY_MS, reason: 'pump-formula-content' });
        }
        return result;
      };
    });

    patchGlobalFunction('updatePumpChart', '__performanceRefreshGovernorPatched', (original) => {
      return function governedUpdatePumpChart(pumpId, options) {
        const id = normalizeNodeId(pumpId);
        const opts = options && typeof options === 'object' ? options : {};
        if (opts.forceImmediate) {
          return original.apply(this, arguments);
        }
        if (!hasVisiblePumpChart(id) && !opts.force) {
          state.stats.skippedHidden += 1;
          return root.__pumpPerformanceCanonicalChartLast || root.__pumpPerformanceChartAuditLast || null;
        }
        schedule('pump-performance-chart', id, {
          delayMs: opts.delayMs === undefined ? FAST_DELAY_MS : opts.delayMs,
          reason: opts.reason || 'pump-performance-chart',
          run: () => original.call(this, id, { forceImmediate: true }),
        });
        return root.__pumpPerformanceCanonicalChartLast || root.__pumpPerformanceChartAuditLast || null;
      };
    });

    const formulaUi = root.EngineeringFormulaDefenseUI;
    patchObjectFunction(formulaUi, 'enhanceDocument', '__performanceRefreshGovernorPatched', (original) => {
      return function governedEnhanceDocument(scope, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const documentRef = getDocument();
        if (!opts.forceImmediate && (!scope || scope === documentRef)) {
          return schedule('formula-enhance', 'document', {
            delayMs: opts.delayMs === undefined ? DEFAULT_DELAY_MS : opts.delayMs,
            reason: opts.reason || 'formula-enhance-document',
            run: () => original.call(this, documentRef),
          });
        }
        return original.call(this, scope || documentRef);
      };
    }, 'EngineeringFormulaDefenseUI.enhanceDocument');
  }

  function patch() {
    patchRefreshFunctions();
    return Array.from(state.patched);
  }

  function installPatchLoop() {
    let attempts = 0;
    const tick = () => {
      attempts += 1;
      patch();
      if (attempts < 40) {
        const timer = root.setTimeout(tick, attempts < 10 ? 80 : 250);
        timer?.unref?.();
      }
    };
    tick();
  }

  const api = {
    version: VERSION,
    cacheKey: '20260626-head-power-audit1',
    VERSION,
    schedule,
    flush,
    patch,
    scheduleEnhance,
    refreshRelevantSecondaryWindows,
    buildPumpDependencyContract,
    relatedNodeIds,
    hasVisiblePumpChart,
    isVisibleElement,
    traceSignature,
    getStats: () => Object.assign({}, state.stats, {
      pending: state.queue.size,
      patched: Array.from(state.patched),
      lastFlush: state.lastFlush,
    }),
  };

  root.EngineeringPerformanceRefreshGovernor = api;
  installPatchLoop();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
