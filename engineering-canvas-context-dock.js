(function canvasContextDockFactory(root, factory) {
  const api = factory(root || globalThis);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.CanvasContextDock = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function createCanvasContextDock(root) {
  'use strict';

  const VERSION = 'engineering-canvas-context-dock.v2';
  const CACHE_KEY = '20260608-global-ribbon-placement-lock5';
  const DOCK_ID = 'canvasContextDock';
  const STYLE_ID = 'canvas-context-dock-style';
  const STORAGE_KEY = 'npsh.canvasContextDock.expanded';
  const LEGEND_SELECTOR = '.canvas-status-legend';
  const LEGEND_HIDDEN_CLASS = 'canvas-status-legend-hidden';
  const LEGEND_COLLISION_MARGIN_PX = 12;
  const CANVAS_PROPERTIES_POLICY_STATE_KEY = '__npshCanvasSelectionOnly';
  const CANVAS_PROPERTIES_POLICY_EVENT_FLAG = '__canvasPropertiesOpenPolicyEventsInstalled';
  const CANVAS_OBJECT_SELECTOR = '.pfd-object';
  const CANVAS_PIPE_SELECTOR = '.pipe-line';
  const TOOLBAR_PLACEMENT_SELECTOR = '.toolbar-tool-draggable';
  const EXPLICIT_PROPERTIES_OPEN_TICKET_KEY = '__npshExplicitObjectPropertiesOpenUntil';
  const EXPLICIT_PROPERTIES_OPEN_TICKET_MS = 2500;
  const CANVAS_SELECTION_SETTLE_MS = 180;
  const CANVAS_CONTEXT_MENU_SETTLE_MS = 1800;
  const CANVAS_LEFT_CONTEXT_MENU_MAX_MOVE_PX = 7;
  const CANVAS_OBJECT_DRAG_SETTLE_MS = 1200;
  const TOOLBAR_PLACEMENT_SETTLE_MS = 900;
  const TOOLBAR_PLACEMENT_GUARD_MS = 30000;
  const FALLBACK_ROUTE = ['Fluid Basis'];
  const MAX_ROUTE_HOPS = 30;

  const PROPERTY_DEFS = [
    {
      id: 'fluid',
      label: 'Active Fluid Basis',
      symbol: 'Fluid',
      unit: '',
      digits: 0,
      paths: ['fluidName', 'name', 'basisName', 'activeFluidBasis'],
      type: 'text'
    },
    {
      id: 'temperature',
      label: 'Temperature',
      symbol: 'T',
      unit: 'deg C',
      digits: 1,
      paths: ['temp', 'temperature', 'temperatureC', 'basisTemperature', 'fluidTemperature']
    },
    {
      id: 'density',
      label: 'Density',
      symbol: 'rho',
      mobileSymbol: 'ρ',
      unit: 'kg/m3',
      digits: 3,
      paths: ['density', 'densityUsed', 'rho']
    },
    {
      id: 'kinematicViscosity',
      label: 'Kinematic Visc.',
      symbol: 'nu',
      mobileSymbol: 'ν',
      unit: 'cSt',
      digits: 3,
      paths: ['kinematicViscosity', 'kinematicVisc', 'kinematicViscosityCSt', 'viscosityKinematic', 'viscosity', 'viscosityCSt', 'nu']
    },
    {
      id: 'dynamicViscosity',
      label: 'Dynamic Visc.',
      symbol: 'mu',
      mobileSymbol: 'μ',
      unit: 'cP',
      digits: 3,
      paths: ['dynViscosity', 'dynamicViscosity', 'dynamicVisc', 'dynamicViscosityCP', 'dynamicViscosityCp', 'viscosityDynamic', 'mu']
    },
    {
      id: 'vaporPressure',
      label: 'Vapor Pressure',
      symbol: 'Pv',
      unit: 'bar a',
      digits: 6,
      paths: ['vaporPressure', 'vapourPressure', 'vaporPressureBarA', 'pv']
    },
    {
      id: 'vaporPressureHead',
      label: 'Vapor Pressure Head',
      symbol: 'hv',
      unit: 'm',
      digits: 3,
      paths: ['vaporPressureHead', 'vapourPressureHead', 'vaporPressureHeadM', 'pvHead']
    },
    {
      id: 'specificWeight',
      label: 'Specific Weight',
      symbol: 'gamma',
      mobileSymbol: 'γ',
      unit: 'N/m3',
      digits: 3,
      paths: ['specificWeight', 'specificWeightUsed', 'gamma']
    }
  ];

  let installed = false;
  let renderTimer = null;
  let dockExpanded = null;
  let routeObserver = null;
  let legendVisibilityObserver = null;
  let legendVisibilityObservedDock = null;
  let legendVisibilityObservedLegend = null;
  const wrappedFunctions = new Set();

  function clone(value) {
    if (value == null || typeof value !== 'object') return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function asString(value) {
    return value == null ? '' : String(value).trim();
  }

  function finiteNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function readPath(source, path) {
    if (!source || !path) return undefined;
    if (Array.isArray(path)) {
      let cursor = source;
      for (const segment of path) {
        if (cursor == null) return undefined;
        cursor = cursor[segment];
      }
      return cursor;
    }
    return String(path)
      .split('.')
      .reduce((cursor, segment) => (cursor == null ? undefined : cursor[segment]), source);
  }

  function firstValue(source, paths) {
    for (const path of paths || []) {
      const value = readPath(source, path);
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  }

  function firstNumber(source, paths) {
    for (const path of paths || []) {
      const value = finiteNumber(readPath(source, path));
      if (value !== null) return value;
    }
    return null;
  }

  function formatNumber(value, digits) {
    const number = finiteNumber(value);
    if (number === null) return '-';
    const abs = Math.abs(number);
    if (abs > 0 && abs < 0.000001) return number.toExponential(3);
    if (Number.isInteger(number) && digits <= 1) return String(number);
    return number.toFixed(digits);
  }

  function formatValue(value, def) {
    if (def.type === 'text') {
      const text = asString(value);
      return text || '-';
    }
    const text = formatNumber(value, def.digits);
    return def.unit && text !== '-' ? `${text} ${def.unit}` : text;
  }

  function normalizeModel(rootLike = root) {
    const model = rootLike.__npshGlobalModel || rootLike.globalModel || rootLike.model || {};
    if (model && model.model && typeof model.model === 'object') return model.model;
    return model || {};
  }

  function normalizeConnections(model, rootLike = root) {
    const candidates = [
      rootLike.__npshConnections,
      rootLike.connections,
      model.connections,
      model.__connections
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  function getFluidProps(model) {
    return model.FLUID?.props || model.Fluid?.props || model.fluid?.props || model.FLUID || {};
  }

  function computeSpecificWeight(props) {
    const density = firstNumber(props, ['density', 'densityUsed', 'rho']);
    if (density !== null) return density * 9.81;
    return firstNumber(props, ['specificWeight', 'specificWeightUsed', 'gamma']);
  }

  function computeKinematicViscosity(props) {
    const explicit = firstNumber(props, ['kinematicViscosity', 'kinematicVisc', 'kinematicViscosityCSt', 'viscosityKinematic', 'viscosity', 'viscosityCSt', 'nu']);
    if (explicit !== null) return explicit;
    const dynamicViscosity = firstNumber(props, ['dynViscosity', 'dynamicViscosity', 'dynamicVisc', 'dynamicViscosityCP', 'dynamicViscosityCp', 'viscosityDynamic', 'mu']);
    const density = firstNumber(props, ['density', 'densityUsed', 'rho']);
    if (dynamicViscosity === null || density === null || density <= 0) return null;
    return dynamicViscosity / (density / 1000);
  }

  function computeDynamicViscosity(props) {
    const kinematicViscosity = firstNumber(props, ['kinematicViscosity', 'kinematicVisc', 'kinematicViscosityCSt', 'viscosityKinematic', 'viscosity', 'viscosityCSt', 'nu']);
    const density = firstNumber(props, ['density', 'densityUsed', 'rho']);
    if (kinematicViscosity !== null && density !== null && density > 0) return kinematicViscosity * (density / 1000);
    return firstNumber(props, ['dynViscosity', 'dynamicViscosity', 'dynamicVisc', 'dynamicViscosityCP', 'dynamicViscosityCp', 'viscosityDynamic', 'mu']);
  }

  function computeVaporPressureHead(props) {
    const vaporPressureBarA = firstNumber(props, ['vaporPressure', 'vapourPressure', 'vaporPressureBarA', 'pv']);
    const density = firstNumber(props, ['density', 'densityUsed', 'rho']);
    if (vaporPressureBarA !== null && density !== null && density > 0) return (vaporPressureBarA * 100000) / (density * 9.81);
    return firstNumber(props, ['vaporPressureHead', 'vapourPressureHead', 'vaporPressureHeadM', 'pvHead']);
  }

  function getFluidCells(model) {
    const props = getFluidProps(model);
    return PROPERTY_DEFS.map((def) => {
      let rawValue = firstValue(props, def.paths);
      if (def.id === 'fluid') rawValue = rawValue || model.FLUID?.name || 'Fluid Basis';
      if (def.id === 'kinematicViscosity') rawValue = computeKinematicViscosity(props);
      if (def.id === 'dynamicViscosity') rawValue = computeDynamicViscosity(props);
      if (def.id === 'specificWeight') rawValue = computeSpecificWeight(props);
      if (def.id === 'vaporPressureHead') rawValue = computeVaporPressureHead(props);
      const value = formatValue(rawValue, def);
      return {
        id: def.id,
        label: def.label,
        symbol: def.symbol,
        mobileSymbol: def.mobileSymbol || def.symbol,
        unit: def.unit,
        value,
        rawValue: clone(rawValue),
        complete: value !== '-'
      };
    });
  }

  function isPumpNode(node) {
    return /pump/i.test(asString(node?.type)) || /pump/i.test(asString(node?.kind));
  }

  function resolveActivePump(model, rootLike = root) {
    const preferredIds = [
      rootLike.activeChartPumpId,
      rootLike.currentSelectedNode,
      rootLike.__activePumpId,
      rootLike.__npshActivePumpId
    ].map(asString).filter(Boolean);
    for (const id of preferredIds) {
      if (model[id] && isPumpNode(model[id])) return { id, node: model[id] };
    }
    for (const [id, node] of Object.entries(model || {})) {
      if (isPumpNode(node)) return { id, node };
    }
    return { id: null, node: null };
  }

  function parseRouteText(routeText) {
    if (Array.isArray(routeText)) return routeText.map(asString).filter(Boolean);
    const text = asString(routeText);
    if (!text) return [];
    return text
      .split(/\s*(?:->|>|→)\s*/u)
      .map(asString)
      .filter(Boolean);
  }

  function extractRouteCandidate(value) {
    if (!value) return [];
    if (Array.isArray(value)) return parseRouteText(value);
    if (typeof value === 'string') return parseRouteText(value);
    if (Array.isArray(value.nodes)) return parseRouteText(value.nodes);
    if (Array.isArray(value.routeNodes)) return parseRouteText(value.routeNodes);
    if (Array.isArray(value.path)) return parseRouteText(value.path);
    return parseRouteText(
      value.text ||
        value.routeText ||
        value.trace ||
        value.route ||
        value.pathText ||
        value.displayText
    );
  }

  function routeFromResults(pumpNode) {
    const results = pumpNode?.results || {};
    const candidates = [
      results.routeTrace,
      results.routeTrace?.text,
      results.routeTrace?.route,
      results.routeTrace?.displayText,
      results.routeAudit?.routeTrace,
      results.npshEvaluation?.routeTrace,
      results.npshEvaluation?.routeTrace?.text,
      results.npshEvaluation?.routeTrace?.route,
      results.actionReadinessBackend?.routeTrace,
      results.calculationDefenseContract?.routeTrace
    ];
    for (const candidate of candidates) {
      const route = extractRouteCandidate(candidate);
      if (route.length >= 2) return route;
    }
    return [];
  }

  function isHydraulicConnection(connection) {
    const type = asString(connection?.connectionType || connection?.type);
    return !type || /hydraulic|process|pipe|flow/i.test(type) || Boolean(connection?.pipeId);
  }

  function connectionFrom(connection) {
    return asString(connection?.from || connection?.rawFrom || connection?.source || connection?.start);
  }

  function connectionTo(connection) {
    return asString(connection?.to || connection?.rawTo || connection?.target || connection?.end);
  }

  function normalizeRoute(route) {
    const normalized = [];
    for (const item of route || []) {
      const label = asString(item);
      if (!label) continue;
      const canonical = /^fluid$/i.test(label) || /^fluid basis$/i.test(label) ? 'Fluid Basis' : label;
      if (normalized[normalized.length - 1] !== canonical) normalized.push(canonical);
    }
    if (!normalized.length) return FALLBACK_ROUTE.slice();
    if (!/^fluid basis$/i.test(normalized[0])) normalized.unshift('Fluid Basis');
    return normalized;
  }

  function buildRouteFromConnections(model, connections, pumpId) {
    if (!pumpId) return FALLBACK_ROUTE.slice();
    const hydraulicConnections = (connections || []).filter(isHydraulicConnection);
    const upstream = [];
    const downstream = [];

    let cursor = pumpId;
    let seen = new Set([cursor]);
    for (let index = 0; index < MAX_ROUTE_HOPS; index += 1) {
      const connection = hydraulicConnections.find((item) => connectionTo(item) === cursor);
      if (!connection) break;
      const from = connectionFrom(connection);
      const pipeId = asString(connection.pipeId || connection.via || connection.linkId);
      if (pipeId) upstream.push(pipeId);
      if (from) upstream.push(from);
      if (!from || seen.has(from)) break;
      seen.add(from);
      cursor = from;
    }

    cursor = pumpId;
    seen = new Set([cursor]);
    for (let index = 0; index < MAX_ROUTE_HOPS; index += 1) {
      const connection = hydraulicConnections.find((item) => connectionFrom(item) === cursor);
      if (!connection) break;
      const to = connectionTo(connection);
      const pipeId = asString(connection.pipeId || connection.via || connection.linkId);
      if (pipeId) downstream.push(pipeId);
      if (to) downstream.push(to);
      if (!to || seen.has(to)) break;
      seen.add(to);
      cursor = to;
    }

    return normalizeRoute([...upstream.reverse(), pumpId, ...downstream]);
  }

  function resolveRouteNodes(model, pump, rootLike = root) {
    const resultRoute = routeFromResults(pump.node);
    if (resultRoute.length >= 2) {
      return {
        source: 'backend route trace',
        nodes: normalizeRoute(resultRoute)
      };
    }
    return {
      source: 'canvas connections',
      nodes: buildRouteFromConnections(model, normalizeConnections(model, rootLike), pump.id)
    };
  }

  function collectStatusTokens(pumpNode, rootLike = root) {
    const results = pumpNode?.results || {};
    return [
      rootLike.__engineeringCalculationDefenseRealtimeState?.status,
      rootLike.__engineeringCalculationDefenseRealtimeState?.calculationDefenseStatus,
      results.calculationFreshness,
      results.backendValidationStatus,
      results.performanceChartData?.freshness,
      results.routeTrace?.lossFreshness,
      results.npshEvaluation?.calculationFreshness,
      results.actionReadinessBackend?.status,
      results.calculationDefenseContract?.status
    ].map(asString).filter(Boolean);
  }

  function resolveFreshness(pumpNode, rootLike = root) {
    const realtime = rootLike.__engineeringCalculationDefenseRealtimeState || {};
    const results = pumpNode?.results || {};
    if (realtime.status === 'Stale' || realtime.stale || results.actionReadinessBackend?.stale) {
      return { status: 'Stale', tone: 'stale', note: 'Input changed before backend refresh.' };
    }

    const tokens = collectStatusTokens(pumpNode, rootLike);
    if (tokens.some((token) => /stale|dirty|expired|outdated/i.test(token))) {
      return { status: 'Stale', tone: 'stale', note: tokens.find((token) => /stale|dirty|expired|outdated/i.test(token)) };
    }
    if (tokens.some((token) => /blocked|fail|mismatch|incomplete/i.test(token))) {
      return { status: 'Review', tone: 'review', note: tokens.find((token) => /blocked|fail|mismatch|incomplete/i.test(token)) };
    }
    if (tokens.some((token) => /current|ready|ok|pass/i.test(token))) {
      return { status: 'Current', tone: 'current', note: 'Current from backend/model trace.' };
    }
    return { status: 'Review', tone: 'review', note: 'Waiting for backend calculation trace.' };
  }

  function resolveAudit(pumpNode, rootLike = root) {
    const results = pumpNode?.results || {};
    return {
      calculationId:
        results.calculationAudit?.calculationId ||
        results.npshEvaluation?.calculationAudit?.calculationId ||
        rootLike.__engineeringCalculationDefenseRealtimeState?.calculationId ||
        '-',
      dependencyFingerprint:
        results.dependencyManifest?.dependencyFingerprint ||
        results.npshEvaluation?.dependencyManifest?.dependencyFingerprint ||
        rootLike.__engineeringCalculationDefenseRealtimeState?.dependencyFingerprint ||
        '-',
      defenseStatus:
        results.calculationDefenseContract?.status ||
        rootLike.__engineeringCalculationDefenseRealtimeState?.calculationDefenseStatus ||
        '-'
    };
  }

  function buildDockState(rootLike = root) {
    const model = normalizeModel(rootLike);
    const pump = resolveActivePump(model, rootLike);
    const freshness = resolveFreshness(pump.node, rootLike);
    const route = resolveRouteNodes(model, pump, rootLike);
    const fluidCells = getFluidCells(model);
    const missingFluidCells = fluidCells.filter((cell) => !cell.complete).map((cell) => cell.label);
    return {
      version: VERSION,
      cacheKey: CACHE_KEY,
      pumpId: pump.id || '-',
      status: freshness.status,
      statusTone: freshness.tone,
      statusNote: freshness.note || '-',
      routeSource: route.source,
      routeNodes: route.nodes,
      fluidCells,
      missingFluidCells,
      audit: resolveAudit(pump.node, rootLike)
    };
  }

  function injectStyle() {
    const documentRef = root.document;
    if (!documentRef || documentRef.getElementById(STYLE_ID)) return;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.canvas-context-dock {
  position: sticky;
  top: 10px;
  left: 12px;
  width: min(940px, calc(100% - 182px));
  margin: 10px 170px 0 12px;
  z-index: 68;
  max-width: 940px;
  min-width: 260px;
  color: #142033;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #cbd9e6;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
  font-size: 11px;
  line-height: 1.25;
  backdrop-filter: blur(6px);
}
.canvas-context-dock[data-tone="current"] { border-color: #6eb39a; }
.canvas-context-dock[data-tone="stale"] { border-color: #d89b28; }
.canvas-context-dock[data-tone="review"] { border-color: #9ab0c5; }
.context-dock-header,
.context-dock-route,
.context-dock-audit {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.context-dock-header {
  min-height: 30px;
  padding: 4px 8px;
  border-bottom: 1px solid #e5edf4;
}
.context-dock-title {
  font-weight: 800;
  color: #123e5d;
  white-space: nowrap;
}
.context-dock-spacer { flex: 1 1 auto; min-width: 8px; }
.context-dock-pill {
  flex: 0 0 auto;
  padding: 2px 7px;
  border: 1px solid #cbd9e6;
  border-radius: 999px;
  background: #f7fafc;
  font-size: 10px;
  font-weight: 400;
  color: #123e5d;
  white-space: nowrap;
}
.canvas-context-dock[data-tone="current"] .context-dock-pill {
  border-color: #8cc8b2;
  background: #eef9f4;
  color: #126245;
}
.canvas-context-dock[data-tone="stale"] .context-dock-pill {
  border-color: #e3b35c;
  background: #fff8e8;
  color: #805500;
}
.context-dock-toggle,
.context-dock-route-button {
  appearance: none;
  border: 1px solid #cbd9e6;
  border-radius: 5px;
  background: #ffffff;
  color: #123e5d;
  font: inherit;
  font-weight: 400;
  cursor: pointer;
}
.context-dock-toggle {
  width: 26px;
  height: 24px;
  padding: 0;
}
.context-dock-toggle:focus-visible,
.context-dock-route-button:focus-visible {
  outline: 2px solid #2780b8;
  outline-offset: 2px;
}
.context-dock-summary {
  display: grid;
  grid-template-columns: repeat(8, minmax(62px, 1fr));
  min-width: 0;
}
.context-dock-cell {
  min-width: 0;
  padding: 5px 7px;
  border-right: 1px solid #edf3f8;
}
.context-dock-cell:last-child { border-right: 0; }
.context-dock-label {
  overflow: hidden;
  color: #506175;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.context-dock-symbol {
  display: none;
  color: #123e5d;
  font-size: 12px;
  font-weight: 400;
  line-height: 1;
}
.context-dock-value {
  overflow: hidden;
  color: #0f3b57;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.context-dock-cell[data-cell-id="fluid"] .context-dock-value {
  font-weight: 800;
}
.context-dock-route {
  padding: 6px 8px;
  border-top: 1px solid #e5edf4;
  background: rgba(248, 251, 253, 0.86);
}
.context-dock-route-label {
  flex: 0 0 auto;
  font-weight: 800;
  color: #48586c;
}
.context-dock-route-list {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.context-dock-route-button {
  flex: 0 0 auto;
  max-width: 130px;
  padding: 3px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.context-dock-route-button[data-kind="fluid"] {
  border-color: #8cc8b2;
  color: #126245;
}
.context-dock-route-arrow {
  flex: 0 0 auto;
  color: #8090a3;
  font-weight: 400;
}
.context-dock-expanded {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  border-top: 1px solid #e5edf4;
}
.context-dock-audit {
  min-width: 0;
  padding: 5px 7px;
  border-right: 1px solid #edf3f8;
}
.context-dock-audit:last-child { border-right: 0; }
.context-dock-audit-label {
  flex: 0 0 auto;
  color: #506175;
}
.context-dock-audit-value {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: #142033;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.canvas-context-dock-node-pulse {
  box-shadow: 0 0 0 3px rgba(39, 128, 184, 0.32) !important;
}
.canvas-status-legend.canvas-status-legend-hidden {
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
@media (max-width: 1040px) {
  .canvas-context-dock {
    width: calc(100% - 24px);
    margin-right: 12px;
    max-width: none;
  }
  .context-dock-summary { grid-template-columns: repeat(4, minmax(62px, 1fr)); }
}
@media (max-width: 639px) {
  .canvas-context-dock {
    top: 8px;
    left: 8px;
    width: calc(100% - 16px);
    margin: 8px 8px 0;
    min-width: 0;
    font-size: 10px;
  }
  .canvas-context-dock[data-mobile-locked="true"] .context-dock-expanded { display: none; }
  .canvas-context-dock[data-mobile-locked="true"] .context-dock-toggle {
    cursor: default;
  }
  .context-dock-header { min-height: 28px; }
  .context-dock-title { max-width: 112px; overflow: hidden; text-overflow: ellipsis; }
  .context-dock-summary {
    display: flex;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .context-dock-cell {
    flex: 0 0 56px;
    min-height: 38px;
    padding: 5px 6px;
  }
  .context-dock-label { display: none; }
  .context-dock-symbol { display: block; }
  .context-dock-value { font-size: 10px; }
  .context-dock-route { padding: 5px 7px; }
  .context-dock-route-button { max-width: 92px; padding: 3px 5px; }
  .context-dock-expanded { grid-template-columns: 1fr; }
  .context-dock-audit {
    border-right: 0;
    border-top: 1px solid #edf3f8;
  }
  .canvas-context-dock:not(.is-expanded) .context-dock-route,
  .canvas-context-dock:not(.is-expanded) .context-dock-expanded {
    display: none;
  }
}
`;
    documentRef.head.appendChild(style);
  }

  function normalizeRect(rect) {
    if (!rect) return null;
    const left = finiteNumber(rect.left);
    const right = finiteNumber(rect.right);
    const top = finiteNumber(rect.top);
    const bottom = finiteNumber(rect.bottom);
    if ([left, right, top, bottom].some((value) => value === null)) return null;
    return {
      left: Math.min(left, right),
      right: Math.max(left, right),
      top: Math.min(top, bottom),
      bottom: Math.max(top, bottom)
    };
  }

  function rectsOverlapOrTooClose(dockRect, legendRect, marginPx = LEGEND_COLLISION_MARGIN_PX) {
    const dock = normalizeRect(dockRect);
    const legend = normalizeRect(legendRect);
    const margin = Math.max(0, finiteNumber(marginPx) ?? LEGEND_COLLISION_MARGIN_PX);
    if (!dock || !legend) return false;
    const horizontalConflict = dock.left <= legend.right + margin && legend.left <= dock.right + margin;
    const verticalConflict = dock.top <= legend.bottom + margin && legend.top <= dock.bottom + margin;
    return horizontalConflict && verticalConflict;
  }

  function syncCanvasStatusLegendVisibility() {
    const documentRef = root.document;
    if (!documentRef) return { applied: false, reason: 'no-document' };
    const dock = documentRef.getElementById(DOCK_ID);
    const legend = documentRef.querySelector(LEGEND_SELECTOR);
    if (!dock || !legend) return { applied: false, reason: 'missing-elements' };

    const shouldHide = rectsOverlapOrTooClose(
      dock.getBoundingClientRect(),
      legend.getBoundingClientRect(),
      LEGEND_COLLISION_MARGIN_PX
    );
    legend.classList.toggle(LEGEND_HIDDEN_CLASS, shouldHide);
    legend.setAttribute('aria-hidden', shouldHide ? 'true' : 'false');
    legend.dataset.canvasContextDockCollision = shouldHide ? 'hidden' : 'visible';
    return {
      applied: true,
      hidden: shouldHide,
      marginPx: LEGEND_COLLISION_MARGIN_PX
    };
  }

  function scheduleLegendVisibilitySync() {
    if (!root.document) return;
    if (typeof root.requestAnimationFrame === 'function') {
      root.requestAnimationFrame(() => syncCanvasStatusLegendVisibility());
      return;
    }
    root.setTimeout?.(() => syncCanvasStatusLegendVisibility(), 0);
  }

  function scheduleSettledLegendVisibilitySync(delayMs = 160) {
    root.setTimeout?.(() => {
      observeLegendVisibilityLayout();
      syncCanvasStatusLegendVisibility();
    }, delayMs);
  }

  function observeLegendVisibilityLayout() {
    const documentRef = root.document;
    if (!documentRef || typeof root.ResizeObserver !== 'function') return;
    const dock = documentRef.getElementById(DOCK_ID);
    const legend = documentRef.querySelector(LEGEND_SELECTOR);
    if (!dock || !legend) return;
    if (
      legendVisibilityObserver &&
      legendVisibilityObservedDock === dock &&
      legendVisibilityObservedLegend === legend
    ) {
      return;
    }

    legendVisibilityObserver?.disconnect?.();
    legendVisibilityObservedDock = dock;
    legendVisibilityObservedLegend = legend;
    legendVisibilityObserver = new root.ResizeObserver(() => {
      scheduleLegendVisibilitySync();
      root.setTimeout?.(() => syncCanvasStatusLegendVisibility(), 80);
    });
    legendVisibilityObserver.observe(dock);
    legendVisibilityObserver.observe(legend);
  }

  function isMobileViewport() {
    return Boolean(root.matchMedia && root.matchMedia('(max-width: 639px)').matches);
  }

  function getStoredExpandedState() {
    if (dockExpanded !== null) return dockExpanded;
    try {
      const stored = root.localStorage?.getItem(STORAGE_KEY);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch (error) {
      // Ignore storage failures in locked-down browser contexts.
    }
    return false;
  }

  function getEffectiveExpandedState() {
    if (isMobileViewport()) return false;
    return getStoredExpandedState();
  }

  function setExpanded(nextExpanded) {
    if (isMobileViewport()) {
      scheduleRender('mobile-locked-toggle');
      return false;
    }
    dockExpanded = Boolean(nextExpanded);
    try {
      root.localStorage?.setItem(STORAGE_KEY, String(dockExpanded));
    } catch (error) {
      // Ignore storage failures in locked-down browser contexts.
    }
    scheduleRender('toggle');
    return dockExpanded;
  }

  function createElement(tagName, className, text) {
    const element = root.document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function shortRouteLabel(label) {
    const text = asString(label);
    if (/^fluid basis$/i.test(text)) return 'FB';
    return text;
  }

  function routeNodeKind(label) {
    if (/^fluid basis$/i.test(label) || /^fluid$/i.test(label)) return 'fluid';
    if (/^pipe|^line|^valve|^fit/i.test(label)) return 'path';
    if (/^pump|^p-/i.test(label)) return 'pump';
    return 'node';
  }

  function findCanvasNodeElement(nodeId) {
    const documentRef = root.document;
    if (!documentRef || !nodeId || /^fluid basis$/i.test(nodeId)) return null;
    const selectors = [
      `[data-id="${nodeId}"]`,
      `[data-node-id="${nodeId}"]`,
      `[data-object-id="${nodeId}"]`,
      `[data-node="${nodeId}"]`
    ];
    for (const selector of selectors) {
      const found = documentRef.querySelector(selector);
      if (found) return found;
    }
    try {
      return documentRef.getElementById(nodeId);
    } catch (error) {
      return null;
    }
  }

  function focusRouteNode(nodeId) {
    const id = asString(nodeId);
    if (!id) return;
    if (/^fluid basis$/i.test(id) && typeof root.openFluidBasis === 'function') {
      root.openFluidBasis();
      return;
    }
    const selectFunction = root.selectNode || root.setSelectedNode || root.selectCanvasNode;
    if (typeof selectFunction === 'function') {
      try {
        selectFunction(id);
      } catch (error) {
        // Visual pulse below still gives user feedback when selection APIs differ.
      }
    }
    const element = findCanvasNodeElement(id);
    if (!element) return;
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    element.classList.add('canvas-context-dock-node-pulse');
    root.setTimeout?.(() => element.classList.remove('canvas-context-dock-node-pulse'), 1100);
  }

  function getCanvasPropertiesPolicyState() {
    const existing = root[CANVAS_PROPERTIES_POLICY_STATE_KEY];
    if (existing && typeof existing === 'object') return existing;
    const state = { active: false, reason: '', until: 0, timer: null, pointerStart: null };
    root[CANVAS_PROPERTIES_POLICY_STATE_KEY] = state;
    return state;
  }

  function clearCanvasSelectionOnly() {
    const state = getCanvasPropertiesPolicyState();
    state.active = false;
    state.reason = '';
    state.until = 0;
    state.pointerStart = null;
    if (state.timer) {
      root.clearTimeout?.(state.timer);
      state.timer = null;
    }
    return state;
  }

  function allowCanvasPropertiesCommandOpen() {
    const state = clearCanvasSelectionOnly();
    state.reason = 'explicit-user-task-object-properties';
    root[EXPLICIT_PROPERTIES_OPEN_TICKET_KEY] = Date.now() + EXPLICIT_PROPERTIES_OPEN_TICKET_MS;
    return state;
  }

  function markCanvasSelectionOnly(reason = 'canvas-left-select', durationMs = CANVAS_SELECTION_SETTLE_MS) {
    const state = getCanvasPropertiesPolicyState();
    const now = Date.now();
    state.active = true;
    state.reason = reason;
    state.until = now + Math.max(0, durationMs);
    if (state.timer) root.clearTimeout?.(state.timer);
    state.timer = root.setTimeout?.(() => {
      if (!state.until || Date.now() >= state.until) clearCanvasSelectionOnly();
    }, Math.max(0, durationMs) + 40) || null;
    return state;
  }

  function isCanvasSelectionOnlyActive() {
    const state = getCanvasPropertiesPolicyState();
    if (!state.active) return false;
    if (state.until && Date.now() > state.until) {
      clearCanvasSelectionOnly();
      return false;
    }
    return true;
  }

  function isLeftButtonEvent(event) {
    return !(typeof event?.button === 'number' && event.button !== 0);
  }

  function getEventClientPoint(event) {
    const point = event?.touches?.[0] || event?.changedTouches?.[0] || event;
    return {
      x: Number.isFinite(point?.clientX) ? point.clientX : 0,
      y: Number.isFinite(point?.clientY) ? point.clientY : 0
    };
  }

  function isInsideCanvas(element) {
    const canvas = root.document?.getElementById('canvas');
    return !!(canvas && element && canvas.contains(element));
  }

  function getCanvasSelectableElement(event) {
    const target = event?.target;
    if (!target?.closest) return null;
    if (target.closest('.port')) return null;
    const object = target.closest(CANVAS_OBJECT_SELECTOR);
    if (object && isInsideCanvas(object)) return object;
    const pipe = target.closest(CANVAS_PIPE_SELECTOR);
    return pipe && isInsideCanvas(pipe) ? pipe : null;
  }

  function eventTargetsCanvasSelectable(event) {
    return !!getCanvasSelectableElement(event);
  }

  function eventTargetsToolbarPlacement(event) {
    return !!event?.target?.closest?.(TOOLBAR_PLACEMENT_SELECTOR);
  }

  function handleCanvasPropertiesPolicyPointerStart(event) {
    if (!isLeftButtonEvent(event)) return;
    const state = getCanvasPropertiesPolicyState();
    const point = getEventClientPoint(event);
    if (eventTargetsToolbarPlacement(event)) {
      state.pointerStart = { ...point, selectable: false, toolbarPlacement: true };
      markCanvasSelectionOnly('toolbar-placement', TOOLBAR_PLACEMENT_GUARD_MS);
      return;
    }
    const selectable = getCanvasSelectableElement(event);
    if (selectable) {
      state.pointerStart = { ...point, selectable: true, target: selectable };
      markCanvasSelectionOnly('canvas-left-select', 650);
    }
  }

  function handleCanvasPropertiesPolicyPointerMove(event) {
    const state = getCanvasPropertiesPolicyState();
    const start = state.pointerStart;
    if (!state.active || !start?.selectable || start.toolbarPlacement || start.dragging) return;
    const point = getEventClientPoint(event);
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    if (Math.hypot(dx, dy) >= CANVAS_LEFT_CONTEXT_MENU_MAX_MOVE_PX) {
      start.dragging = true;
      markCanvasSelectionOnly('canvas-object-drag', CANVAS_OBJECT_DRAG_SETTLE_MS);
    }
  }

  function handleCanvasPropertiesPolicyPointerEnd() {
    const state = getCanvasPropertiesPolicyState();
    if (!state.active) return;
    if (state.reason === 'toolbar-placement') {
      markCanvasSelectionOnly('toolbar-placement-settle', TOOLBAR_PLACEMENT_SETTLE_MS);
      return;
    }
    if (state.reason === 'canvas-object-drag') {
      markCanvasSelectionOnly('canvas-object-drag-settle', CANVAS_OBJECT_DRAG_SETTLE_MS);
      return;
    }
    if (/^canvas-left/.test(state.reason)) {
      markCanvasSelectionOnly('canvas-left-select-settle', CANVAS_SELECTION_SETTLE_MS);
    }
  }

  function shouldDispatchLeftClickCanvasContextMenu(event) {
    if (!isLeftButtonEvent(event)) return false;
    const selectable = getCanvasSelectableElement(event);
    if (!selectable) return false;
    const target = event?.target;
    if (target?.closest?.('#canvasContextMenu, #taskWindow, .task-window, input, select, textarea, button, a')) return false;
    const state = getCanvasPropertiesPolicyState();
    const start = state.pointerStart;
    if (start?.toolbarPlacement) return false;
    if (start?.dragging) return false;
    if (start?.selectable) {
      const point = getEventClientPoint(event);
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      if (Math.sqrt(dx * dx + dy * dy) > CANVAS_LEFT_CONTEXT_MENU_MAX_MOVE_PX) return false;
    }
    return true;
  }

  function dispatchLeftClickCanvasContextMenu(event) {
    const selectable = getCanvasSelectableElement(event);
    if (!selectable || typeof root.MouseEvent !== 'function') return false;
    const point = getEventClientPoint(event);
    markCanvasSelectionOnly('canvas-left-context-menu', CANVAS_CONTEXT_MENU_SETTLE_MS);
    const contextEvent = new root.MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: point.x,
      clientY: point.y,
      button: 2
    });
    selectable.dispatchEvent(contextEvent);
    return true;
  }

  function handleCanvasPropertiesPolicyClickForContextMenu(event) {
    if (!shouldDispatchLeftClickCanvasContextMenu(event)) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    dispatchLeftClickCanvasContextMenu(event);
  }

  function handleCanvasPropertiesPolicyContextMenu(event) {
    if (eventTargetsCanvasSelectable(event)) {
      markCanvasSelectionOnly('canvas-context-menu', CANVAS_CONTEXT_MENU_SETTLE_MS);
    }
  }

  function installCanvasPropertiesOpenPolicyEventBridge() {
    const documentRef = root.document;
    if (!documentRef) return;
    root.__npshAllowCanvasPropertiesCommandOpen = allowCanvasPropertiesCommandOpen;
    if (documentRef[CANVAS_PROPERTIES_POLICY_EVENT_FLAG]) return;
    documentRef[CANVAS_PROPERTIES_POLICY_EVENT_FLAG] = true;
    ['pointerdown', 'mousedown'].forEach((eventName) => {
      documentRef.addEventListener(eventName, handleCanvasPropertiesPolicyPointerStart, true);
    });
    ['pointermove', 'mousemove'].forEach((eventName) => {
      documentRef.addEventListener(eventName, handleCanvasPropertiesPolicyPointerMove, true);
    });
    ['pointerup', 'mouseup', 'click'].forEach((eventName) => {
      documentRef.addEventListener(eventName, handleCanvasPropertiesPolicyPointerEnd, true);
    });
    documentRef.addEventListener('click', handleCanvasPropertiesPolicyClickForContextMenu, true);
    documentRef.addEventListener('contextmenu', handleCanvasPropertiesPolicyContextMenu, true);
  }

  function renderSummary(parent, state) {
    const summary = createElement('div', 'context-dock-summary');
    state.fluidCells.forEach((cell) => {
      const item = createElement('div', 'context-dock-cell');
      item.dataset.cellId = cell.id;
      item.title = `${cell.label}: ${cell.value}`;
      const label = createElement('div', 'context-dock-label', cell.label);
      const symbol = createElement('div', 'context-dock-symbol', cell.mobileSymbol);
      const value = createElement('div', 'context-dock-value', cell.value);
      item.append(label, symbol, value);
      summary.appendChild(item);
    });
    parent.appendChild(summary);
  }

  function renderRoute(parent, state) {
    const route = createElement('div', 'context-dock-route');
    route.appendChild(createElement('div', 'context-dock-route-label', 'Route'));
    const list = createElement('div', 'context-dock-route-list');
    state.routeNodes.forEach((node, index) => {
      if (index > 0) list.appendChild(createElement('span', 'context-dock-route-arrow', '>'));
      const button = createElement('button', 'context-dock-route-button', shortRouteLabel(node));
      button.type = 'button';
      button.title = node;
      button.dataset.kind = routeNodeKind(node);
      button.dataset.nodeId = node;
      button.setAttribute('aria-label', `Route node ${node}`);
      button.addEventListener('click', () => focusRouteNode(node));
      list.appendChild(button);
    });
    route.appendChild(list);
    parent.appendChild(route);
  }

  function renderExpandedAudit(parent, state) {
    const expanded = createElement('div', 'context-dock-expanded');
    [
      ['Pump', state.pumpId],
      ['Freshness', state.statusNote],
      ['Calc ID', state.audit.calculationId],
      ['Dependency', state.audit.dependencyFingerprint],
      ['Defense', state.audit.defenseStatus],
      ['Route Source', state.routeSource],
      ['Missing Basis', state.missingFluidCells.length ? state.missingFluidCells.join(', ') : 'None']
    ].forEach(([label, value]) => {
      const item = createElement('div', 'context-dock-audit');
      item.title = `${label}: ${value || '-'}`;
      item.append(
        createElement('span', 'context-dock-audit-label', `${label}`),
        createElement('span', 'context-dock-audit-value', value || '-')
      );
      expanded.appendChild(item);
    });
    parent.appendChild(expanded);
  }

  function render() {
    const documentRef = root.document;
    if (!documentRef) return null;
    const canvas = documentRef.getElementById('canvas');
    if (!canvas) return null;
    injectStyle();

    let dock = documentRef.getElementById(DOCK_ID);
    if (!dock) {
      dock = createElement('section', 'canvas-context-dock');
      dock.id = DOCK_ID;
      dock.setAttribute('aria-label', 'Fluid Basis and Route Trace');
      canvas.appendChild(dock);
    }

    const state = buildDockState(root);
    const mobileLocked = isMobileViewport();
    const expanded = getEffectiveExpandedState();
    dock.dataset.tone = state.statusTone;
    dock.dataset.mobileLocked = mobileLocked ? 'true' : 'false';
    dock.className = `canvas-context-dock${expanded ? ' is-expanded' : ''}`;
    dock.replaceChildren();

    const header = createElement('div', 'context-dock-header');
    header.appendChild(createElement('div', 'context-dock-title', 'Fluid Basis'));
    header.appendChild(createElement('div', 'context-dock-spacer'));
    header.appendChild(createElement('div', 'context-dock-pill', state.status));
    const toggle = createElement('button', 'context-dock-toggle', expanded ? '-' : '+');
    toggle.type = 'button';
    toggle.title = mobileLocked ? 'Compact on mobile' : (expanded ? 'Collapse' : 'Expand');
    toggle.setAttribute('aria-label', mobileLocked ? 'Fluid Basis dock stays compact on mobile' : (expanded ? 'Collapse Fluid Basis dock' : 'Expand Fluid Basis dock'));
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-disabled', String(mobileLocked));
    if (!mobileLocked) {
      toggle.addEventListener('click', () => setExpanded(!expanded));
    } else {
      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setExpanded(false);
      });
    }
    header.appendChild(toggle);
    dock.appendChild(header);

    renderSummary(dock, state);
    renderRoute(dock, state);
    if (expanded) renderExpandedAudit(dock, state);
    observeLegendVisibilityLayout();
    syncCanvasStatusLegendVisibility();
    scheduleLegendVisibilitySync();
    scheduleSettledLegendVisibilitySync();
    return state;
  }

  function scheduleRender(reason = 'change') {
    if (!root.document) return;
    root.clearTimeout?.(renderTimer);
    renderTimer = root.setTimeout?.(() => {
      renderTimer = null;
      try {
        render();
      } catch (error) {
        root.console?.warn?.('Canvas context dock render failed.', reason, error);
      }
    }, 60);
  }

  function wrapFunction(functionName) {
    if (wrappedFunctions.has(functionName)) return;
    const original = root[functionName];
    if (typeof original !== 'function' || original.__canvasContextDockWrapped) return;
    const wrapped = function canvasContextDockWrappedFunction(...args) {
      const result = original.apply(this, args);
      if (result && typeof result.then === 'function') {
        return result.finally(() => scheduleRender(functionName));
      }
      scheduleRender(functionName);
      return result;
    };
    wrapped.__canvasContextDockWrapped = true;
    wrapped.__canvasContextDockOriginal = original;
    root[functionName] = wrapped;
    wrappedFunctions.add(functionName);
  }

  function installEventBridge() {
    if (!root.document || root.document.__canvasContextDockEventsInstalled) return;
    root.document.__canvasContextDockEventsInstalled = true;
    const scheduleViewportRender = (reason) => {
      scheduleRender(reason);
      scheduleLegendVisibilitySync();
      scheduleSettledLegendVisibilitySync();
    };
    ['input', 'change'].forEach((eventName) => {
      root.document.addEventListener(eventName, () => scheduleRender(eventName), true);
    });
    root.addEventListener?.('resize', () => scheduleViewportRender('resize'), { passive: true });
    root.addEventListener?.('orientationchange', () => scheduleViewportRender('orientationchange'), { passive: true });
    installCanvasPropertiesOpenPolicyEventBridge();

    const canvas = root.document.getElementById('canvas');
    if (canvas && typeof root.MutationObserver === 'function') {
      routeObserver = new root.MutationObserver(() => scheduleRender('canvas-mutation'));
      routeObserver.observe(canvas, { childList: true, subtree: false });
    }
  }

  function installFunctionBridge() {
    [
      'applyBackendSimulationPrimaryResults',
      'applySimulationState',
      'applySimulationStateAtomic',
      'drawConnections',
      'notifyRealtimeTaskWindows',
      'updateBasisStatusPill',
      'updateSimulation'
    ].forEach(wrapFunction);
  }

  function install() {
    if (!root.document) return api;
    installFunctionBridge();
    installEventBridge();
    render();
    syncCanvasStatusLegendVisibility();
    scheduleSettledLegendVisibilitySync();
    installed = true;
    return api;
  }

  function autoInstall() {
    if (!root.document || installed) return;
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', install, { once: true });
      return;
    }
    install();
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    buildDockState,
    allowCanvasPropertiesCommandOpen,
    focusRouteNode,
    formatValue,
    clearCanvasSelectionOnly,
    getEffectiveExpandedState,
    getFluidCells,
    getStoredExpandedState,
    isCanvasSelectionOnlyActive,
    install,
    isMobileViewport,
    markCanvasSelectionOnly,
    refresh: () => render(),
    rectsOverlapOrTooClose,
    resolveRouteNodes,
    scheduleRender,
    setExpanded,
    syncCanvasStatusLegendVisibility
  };

  autoInstall();
  return api;
});
