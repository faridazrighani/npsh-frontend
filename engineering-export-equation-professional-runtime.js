/*
 * Menu -> File -> Export PDF professional equation layout bridge.
 *
 * Calculation appendices must read like a compact mechanical/chemical
 * engineering calculation note: equation first, numerical substitution next,
 * and the evaluated result immediately below it. XLSX keeps its own exporter,
 * and DOCX is no longer exposed from the menu.
 */
(function exportEquationProfessionalFactory(root, factory) {
  const api = factory(root || globalThis);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EngineeringExportEquationProfessionalRuntime = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function createExportEquationProfessionalRuntime(root) {
  "use strict";

  const VERSION = "2026.07-pdf-equation-professional7";
  const MODE_LABEL = "Mode: Equation Professional";
  const LANGUAGE_LABEL = "Language: Professional English for Mechanical and Chemical Engineering";
  const LAYOUT_LABEL = "Layout: Compact";

  const original = {
    buildScenarioAppendixHtml: root.buildScenarioAppendixHtml,
    exportScenarioCalculationTraceToPdf: root.exportScenarioCalculationTraceToPdf
  };

  let installed = false;

  const PROFESSIONAL_CSS = `
    html { color: #13293d; }
    body.equation-professional-export { font-size: 9.25pt; line-height: 1.28; color: #13293d; }
    body.equation-professional-export h1 { margin-bottom: 6pt; font-size: 18pt; }
    body.equation-professional-export h2 { margin: 12pt 0 5pt; font-size: 12.5pt; }
    body.equation-professional-export h3 { margin: 8pt 0 4pt; font-size: 10.5pt; }
    body.equation-professional-export p { margin: 3pt 0; }
    body.equation-professional-export table { margin: 4pt 0 7pt; font-size: 8.25pt; }
    body.equation-professional-export th,
    body.equation-professional-export td { padding: 3pt 4pt; vertical-align: top; }
    .eqp-export-contract {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 5pt;
      margin: 0 0 8pt;
      padding: 5pt 6pt;
      border: 1px solid #94b8d8;
      background: #f4fbff;
      color: #15324a;
      font-size: 8.6pt;
    }
    .eqp-export-contract strong,
    .eqp-export-contract span { display: block; }
    .compact-equation-sequence {
      display: grid;
      grid-template-columns: 1fr;
      gap: 5pt;
      margin: 5pt 0 8pt;
    }
    .eqp-step {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 1px solid #b9cce0;
      border-left: 3px solid #1f6f9f;
      border-radius: 3px;
      padding: 5pt 6pt;
      background: #fbfdff;
    }
    .eqp-step-title {
      display: flex;
      justify-content: space-between;
      gap: 8pt;
      margin-bottom: 3pt;
      color: #0f334f;
      font-weight: 700;
      font-size: 9.1pt;
    }
    .eqp-mode {
      margin: 1pt 0 3pt;
      color: #28705a;
      font-size: 7.7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .eqp-line {
      display: grid;
      grid-template-columns: 86pt minmax(0, 1fr);
      gap: 5pt;
      align-items: start;
      margin-top: 2pt;
    }
    .eqp-line-label {
      color: #536b82;
      font-size: 7.7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .eqp-equation-code,
    .eqp-substitution-code,
    .eqp-result-value {
      min-width: 0;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: normal;
      font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif;
      font-size: 10.8pt;
      line-height: 1.45;
      text-align: center;
    }
    .eqp-equation-code,
    .eqp-substitution-code,
    body.equation-professional-export .formula {
      display: block;
      margin: 3pt auto 2pt;
      padding: 2pt 4pt;
      color: #111827;
      font-family: "Cambria Math", "STIX Two Math", "Times New Roman", serif;
      font-size: 11.2pt;
      font-style: italic;
      text-align: center;
      letter-spacing: 0;
    }
    .eqp-result-value {
      color: #0d4b30;
      font-weight: 700;
    }
    .eqp-reference {
      margin-top: 3pt;
      color: #556b7e;
      font-size: 7.8pt;
    }
    body.equation-professional-export .formula-block {
      margin: 4pt 0 7pt;
      padding: 5pt 6pt;
      border-left: 3px solid #1f6f9f;
      background: #fbfdff;
    }
    body.equation-professional-export .formula {
      min-height: 16pt;
      border-top: 1px solid #e5eef6;
      border-bottom: 1px solid #e5eef6;
      background: #ffffff;
    }
    .eqp-fluid-phase-chart-note {
      break-inside: avoid;
      page-break-inside: avoid;
      margin: 4pt 0 7pt;
      padding: 5pt 6pt;
      border: 1px solid #b9d9c8;
      border-left: 3px solid #28705a;
      background: #f5fff9;
      color: #17324d;
      font-size: 8.45pt;
    }
    .eqp-fluid-phase-chart-note strong {
      color: #0d4b30;
    }
    .eqp-fluid-phase-chart-figure {
      break-inside: avoid;
      page-break-inside: avoid;
      margin: 5pt 0 8pt;
      padding: 6pt;
      border: 1px solid #d8e6f2;
      border-radius: 4px;
      background: #fff;
    }
    .eqp-fluid-phase-chart-figure h3 {
      margin: 0 0 5pt;
      color: #0f314d;
      font-size: 10.5pt;
      font-weight: 800;
    }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 5pt;
      margin-bottom: 5pt;
    }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-meta div {
      min-height: 28pt;
      padding: 4pt 5pt;
      border: 1px solid #e2edf7;
      border-radius: 3px;
      background: #f8fbff;
      color: #475569;
      font-size: 7.8pt;
      line-height: 1.2;
    }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-meta strong {
      display: block;
      margin-top: 1pt;
      color: #0f314d;
      font-size: 8.6pt;
      font-variant-numeric: tabular-nums;
    }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-wrap {
      width: 100%;
      border: 1px solid #d8e2ef;
      border-radius: 4px;
      overflow: hidden;
      background: #f8fbff;
    }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-svg {
      display: block;
      width: 100%;
      height: auto;
      max-height: 410pt;
    }
    .eqp-fluid-phase-chart-figure .fluid-phase-axis-label { font-size: 13px; font-weight: 800; fill: #1f2937; }
    .eqp-fluid-phase-chart-figure .fluid-phase-tick-label { font-size: 11px; fill: #4b5563; }
    .eqp-fluid-phase-chart-figure .fluid-phase-grid-line { stroke: #dce6f2; stroke-width: 1; }
    .eqp-fluid-phase-chart-figure .fluid-phase-axis-line { stroke: #4b5563; stroke-width: 1.2; }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-legend {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 4pt 8pt;
      margin-top: 5pt;
      color: #5b677a;
      font-size: 7.8pt;
      line-height: 1.2;
    }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-legend span {
      display: inline-flex;
      align-items: center;
      gap: 4pt;
      white-space: nowrap;
    }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-legend i {
      display: inline-block;
      width: 16pt;
      height: 2pt;
      border-radius: 8px;
      background: #1d4ed8;
    }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-legend .legend-liquid { background: #2159a8; }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-legend .legend-vapor { background: #a23a24; }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-legend .legend-quality { background: #1d4ed8; }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-legend .legend-temperature { background: #109618; }
    .eqp-fluid-phase-chart-figure .fluid-basis-phase-chart-legend .legend-point {
      width: 7pt;
      height: 7pt;
      border-radius: 999px;
      background: #dc2626;
    }
    .eqp-fluid-phase-chart-caption,
    .eqp-fluid-phase-chart-fallback {
      margin: 5pt 0 0;
      color: #334155;
      font-size: 8.3pt;
    }
    .eqp-moody-chart-pack {
      display: grid;
      grid-template-columns: 1fr;
      gap: 7pt;
      margin: 6pt 0 9pt;
    }
    .eqp-moody-chart-figure {
      break-inside: avoid;
      page-break-inside: avoid;
      margin: 0;
      padding: 7pt;
      border: 1px solid #cfe0ef;
      border-radius: 5px;
      background: #f7fbff;
    }
    .eqp-moody-topline {
      display: grid;
      grid-template-columns: 120pt minmax(0, 1fr);
      gap: 6pt;
      align-items: stretch;
      margin-bottom: 5pt;
    }
    .eqp-moody-title-badge {
      padding: 6pt 7pt;
      border-radius: 5px;
      background: #0f5b73;
      color: #fff;
      line-height: 1.15;
    }
    .eqp-moody-title-badge span,
    .eqp-moody-title-badge strong {
      display: block;
    }
    .eqp-moody-title-badge span {
      margin-bottom: 2pt;
      font-size: 6.9pt;
      font-weight: 800;
      letter-spacing: 0;
    }
    .eqp-moody-title-badge strong {
      font-size: 10pt;
      font-weight: 900;
    }
    .eqp-moody-metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 5pt;
    }
    .eqp-moody-metric {
      min-height: 32pt;
      padding: 5pt 6pt;
      border: 1px solid #d7e5f2;
      border-radius: 4px;
      background: #fff;
      line-height: 1.2;
    }
    .eqp-moody-metric span {
      display: block;
      color: #486274;
      font-size: 7.3pt;
    }
    .eqp-moody-metric strong {
      display: block;
      margin-top: 2pt;
      color: #0f314d;
      font-size: 8.7pt;
      font-variant-numeric: tabular-nums;
    }
    .eqp-moody-chip-row,
    .eqp-moody-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4pt;
      margin: 4pt 0 6pt;
    }
    .eqp-moody-chip-row span {
      padding: 2pt 6pt;
      border: 1px solid #cfe0ef;
      border-radius: 999px;
      background: #ffffff;
      color: #143c55;
      font-size: 7.2pt;
      font-weight: 700;
      white-space: nowrap;
    }
    .eqp-moody-chart-wrap {
      width: 100%;
      border: 1px solid #cbd9e6;
      border-radius: 5px;
      overflow: hidden;
      background: #fff;
    }
    .eqp-moody-chart-svg {
      display: block;
      width: 100%;
      height: auto;
      max-height: 330pt;
    }
    .eqp-moody-axis-label {
      fill: #0f314d;
      font-size: 13px;
      font-weight: 800;
    }
    .eqp-moody-tick {
      fill: #23384b;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .eqp-moody-region-label {
      fill: #196b4f;
      font-size: 12px;
      font-weight: 800;
    }
    .eqp-moody-transition-label {
      fill: #8a4b00;
      font-size: 12px;
      font-weight: 800;
    }
    .eqp-moody-formula-block {
      margin: 5pt 0 4pt;
    }
    .eqp-moody-formula-block .formula {
      min-height: 0;
      margin: 0;
      border-top: 1px solid #dce8f3;
      border-bottom: 1px solid #dce8f3;
      background: #ffffff;
      font-size: 10.4pt;
    }
    .eqp-moody-segment-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4pt;
      margin: 5pt 0;
    }
    .eqp-moody-segment-card {
      display: grid;
      grid-template-columns: 16pt minmax(0, 1fr);
      gap: 4pt;
      align-items: start;
      min-height: 26pt;
      padding: 4pt 5pt;
      border: 1px solid #cfe0ef;
      border-radius: 4px;
      background: #fff;
      color: #0f314d;
    }
    .eqp-moody-segment-index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14pt;
      height: 14pt;
      border-radius: 999px;
      background: #2563eb;
      color: #ffffff;
      font-size: 7.5pt;
      font-weight: 800;
      line-height: 1;
    }
    .eqp-moody-segment-card:nth-child(1) .eqp-moody-segment-index { background: #e11d48; }
    .eqp-moody-segment-card:nth-child(2) .eqp-moody-segment-index { background: #2563eb; }
    .eqp-moody-segment-card:nth-child(3) .eqp-moody-segment-index { background: #059669; }
    .eqp-moody-segment-card:nth-child(4) .eqp-moody-segment-index { background: #d97706; }
    .eqp-moody-segment-card:nth-child(5) .eqp-moody-segment-index { background: #7c3aed; }
    .eqp-moody-segment-card:nth-child(6) .eqp-moody-segment-index { background: #0f766e; }
    .eqp-moody-segment-copy {
      min-width: 0;
      display: grid;
      gap: 2pt;
    }
    .eqp-moody-segment-copy strong {
      font-size: 7.8pt;
      line-height: 1.15;
      overflow-wrap: break-word;
    }
    .eqp-moody-segment-copy small {
      display: flex;
      flex-wrap: wrap;
      gap: 1pt 5pt;
      color: #3f5367;
      font-size: 6.8pt;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
      overflow-wrap: normal;
      word-break: normal;
    }
    .eqp-moody-segment-copy small span {
      white-space: nowrap;
    }
    .eqp-moody-empty-card {
      grid-column: 1 / -1;
      grid-template-columns: 1fr;
    }
    .eqp-moody-note {
      margin: 4pt 0 3pt;
      padding: 4pt 5pt;
      border: 1px solid #d7e5f2;
      border-radius: 4px;
      background: #ffffff;
      color: #24435b;
      font-size: 7.8pt;
    }
    .eqp-moody-legend {
      margin-bottom: 0;
      color: #486274;
      font-size: 7.1pt;
      line-height: 1.2;
    }
    .eqp-moody-legend span {
      display: inline-flex;
      align-items: center;
      gap: 3pt;
      padding: 2pt 5pt;
      border: 1px solid #d7e5f2;
      border-radius: 4px;
      background: #fff;
      white-space: nowrap;
    }
    .eqp-moody-legend i {
      display: inline-block;
      width: 14pt;
      height: 2pt;
      border-radius: 999px;
    }
    @media print {
      body.equation-professional-export { font-size: 8.9pt; }
      .eqp-export-contract { grid-template-columns: 1fr 1fr 1fr; }
      .eqp-moody-segment-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
  `;

  function text(value, fallback = "-") {
    const normalized = String(value == null ? "" : value).trim();
    return normalized || fallback;
  }

  function lower(value) {
    return text(value, "").toLowerCase();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function decodeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  function stripTags(value) {
    return decodeHtml(String(value == null ? "" : value).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  }

  function forceEnglishReport(report) {
    if (!report || typeof report !== "object") return report;
    report.language = "en";
    report.locale = "en-US";
    report.exportLanguage = "en";
    report.exportMode = "equation-professional";
    report.exportLayout = "compact";
    if (report.sourceData && typeof report.sourceData === "object") {
      report.sourceData.language = "en";
      report.sourceData.locale = "en-US";
      report.sourceData.settings = {
        ...(report.sourceData.settings || {}),
        language: "en",
        locale: "en-US",
        exportLanguage: "en"
      };
    }
    return report;
  }

  function runtimeModel(report) {
    try {
      if (typeof globalModel !== "undefined" && globalModel) return globalModel;
    } catch (error) {
      // Some builds expose the model only on window globals.
    }
    return root.globalModel || root.__npshGlobalModel || report?.sourceData?.model || report?.model || {};
  }

  function runtimeConnections(report) {
    try {
      if (typeof connections !== "undefined" && Array.isArray(connections)) return connections;
    } catch (error) {
      // Some builds expose connections only on window globals.
    }
    return Array.isArray(root.connections)
      ? root.connections
      : (Array.isArray(report?.sourceData?.connections) ? report.sourceData.connections : []);
  }

  function hydraulicConnections(report) {
    return runtimeConnections(report).filter(connection => !connection?.connectionType || connection.connectionType === "hydraulic");
  }

  function nodeType(model, nodeId) {
    return text(model?.[nodeId]?.type, "").toLowerCase();
  }

  function primaryPumpId(report, model = runtimeModel(report)) {
    const fromReport = text(report?.sourceData?.primary?.pumpId || report?.pump?.id, "");
    if (fromReport && nodeType(model, fromReport) === "pump") return fromReport;
    return Object.keys(model || {}).find(id => nodeType(model, id) === "pump") || fromReport;
  }

  function connectionSourceId(connection) {
    return connection?.from || connection?.sourceId || connection?.source || "";
  }

  function connectionTargetId(connection) {
    return connection?.to || connection?.targetId || connection?.target || "";
  }

  function connectionPipeId(connection) {
    return connection?.pipeId || connection?.pipe || connection?.objectId || "";
  }

  function detectActiveTopology(report) {
    const model = runtimeModel(report);
    const pumpId = primaryPumpId(report, model);
    const activeConnections = hydraulicConnections(report);
    const inlet = activeConnections.find(connection => connectionTargetId(connection) === pumpId) || null;
    const outlet = activeConnections.find(connection => connectionSourceId(connection) === pumpId) || null;
    const sourceId = inlet ? connectionSourceId(inlet) : text(report?.source?.id || report?.sourceData?.primary?.sourceId, "");
    const sinkId = outlet ? connectionTargetId(outlet) : "";
    const sourcePipeId = inlet ? connectionPipeId(inlet) : "";
    const dischargePipeId = outlet ? connectionPipeId(outlet) : "";
    const activePipeIds = new Set(activeConnections.map(connectionPipeId).filter(Boolean));
    const suctionOnly = !!pumpId && !!inlet && !outlet;
    return {
      model,
      pumpId,
      sourceId,
      sinkId,
      sourcePipeId,
      dischargePipeId,
      inlet,
      outlet,
      activeConnections,
      activePipeIds,
      suctionOnly,
      hasDownstream: !!outlet
    };
  }

  function isDischargeOrSinkSectionTitle(value) {
    return /\b(?:Discharge\s+Pipe|SNK\s+Boundary|Sink\s+Boundary)\b/i.test(text(value, ""));
  }

  function isUnusedTopologyRegisterRow(row) {
    return Array.isArray(row) && row.some(cell => /\b(?:Discharge\s+Pipe|SNK\s+Boundary|Sink\s+Boundary|Pump\s+Performance\s+Chart|Pump\s+Performance\s+Curve)\b/i.test(text(cell, "")));
  }

  function inactiveTopologyTokens(topology, report) {
    const model = topology.model || runtimeModel(report);
    const activePipeIds = topology.activePipeIds || new Set();
    const tokens = [];
    Object.keys(model || {}).forEach(nodeId => {
      const type = nodeType(model, nodeId);
      if (type === "pipe" && !activePipeIds.has(nodeId)) tokens.push(nodeId);
      if (["sink", "tank", "verticalvessel", "horizontalvessel", "vessel", "separator"].includes(type) && nodeId !== topology.sinkId) {
        tokens.push(nodeId);
      }
    });
    (report?.sourceData?.sinkIds || []).forEach(id => {
      if (id && id !== topology.sinkId) tokens.push(id);
    });
    (report?.sourceData?.pipeIds || []).forEach(id => {
      if (id && !activePipeIds.has(id)) tokens.push(id);
    });
    return [...new Set(tokens.map(token => text(token, "")).filter(Boolean))];
  }

  function valueMentionsAnyToken(value, tokens) {
    if (!tokens.length) return false;
    const haystack = typeof value === "string" ? value : JSON.stringify(value || {});
    return tokens.some(token => haystack.includes(token));
  }

  function filterInactiveTopologyItems(items, tokens) {
    if (!Array.isArray(items)) return items;
    return items.filter(item => !valueMentionsAnyToken(item, tokens));
  }

  function sanitizeReportForActiveTopology(report) {
    if (!report || typeof report !== "object") return report;
    const topology = detectActiveTopology(report);
    if (!topology.suctionOnly) return report;
    const noDownstreamLabel = "Not connected in the current active topology";
    const activePipeIds = topology.activePipeIds;
    const inactiveTokens = inactiveTopologyTokens(topology, report);

    report.exportTopology = {
      mode: "suction-only",
      pumpId: topology.pumpId,
      sourceId: topology.sourceId,
      suctionPipeId: topology.sourcePipeId,
      downstreamStatus: noDownstreamLabel
    };

    if (report.sourceData?.primary) {
      report.sourceData.primary.sinkId = "";
      report.sourceData.primary.sink = null;
      if (report.sourceData.primary.trace?.path) {
        report.sourceData.primary.trace.path.text = ["Fluid Basis", topology.sourceId, topology.sourcePipeId, topology.pumpId].filter(Boolean).join(" -> ");
      }
      if (Array.isArray(report.sourceData.primary.trace?.steps)) {
        report.sourceData.primary.trace.steps = filterInactiveTopologyItems(report.sourceData.primary.trace.steps, inactiveTokens);
      }
      if (Array.isArray(report.sourceData.primary.trace?.calculationSteps)) {
        report.sourceData.primary.trace.calculationSteps = filterInactiveTopologyItems(report.sourceData.primary.trace.calculationSteps, inactiveTokens);
      }
    }

    if (Array.isArray(report.passport)) {
      report.passport = report.passport.map(row => {
        if (!Array.isArray(row)) return row;
        if (/^Primary sink$/i.test(text(row[0], ""))) {
          return ["Primary sink", noDownstreamLabel, "-", "No downstream boundary is connected; discharge and SNK calculations are omitted from this PDF export."];
        }
        if (/^Pump head$/i.test(text(row[0], ""))) {
          return ["Pump head", "-", "m", "Not calculated because the active topology stops at the pump."];
        }
        return row;
      }).filter(row => !isUnusedTopologyRegisterRow(row));
    }

    report.discharge = { rows: [], totalLoss: 0 };
    report.sink = {
      id: "-",
      status: noDownstreamLabel,
      readouts: [],
      steps: [],
      warnings: []
    };

    if (report.pump && typeof report.pump === "object") {
      report.pump.curveRows = [];
      report.pump.steps = filterInactiveTopologyItems(report.pump.steps, inactiveTokens);
      report.pump.results = {
        ...(report.pump.results || {}),
        pumpHead: null,
        head: null,
        dischargePressure: null,
        routeCalculationStatus: "Suction Only",
        requiredPumpHeadStatus: "Downstream Required",
        actualPumpHeadAvailable: false
      };
    }

    if (Array.isArray(report.routeRows)) {
      report.routeRows = report.routeRows
        .filter(row => !/^discharge$/i.test(text(row?.side, "")))
        .filter(row => {
          const objectId = text(row?.objectId, "");
          return !objectId || objectId === "-" || !activePipeIds.size || activePipeIds.has(objectId);
        });
      if (!report.routeRows.length && topology.sourcePipeId) {
        report.routeRows = [{
          side: "Suction",
          order: 1,
          objectId: topology.sourcePipeId,
          from: topology.sourceId || "-",
          to: topology.pumpId || "-",
          loss: report.suction?.totalLoss ?? "-"
        }];
      }
    }

    if (report.moody?.rows && Array.isArray(report.moody.rows)) {
      report.moody.rows = report.moody.rows.filter(row => {
        const role = lower(row?.role || "");
        const pipeId = text(row?.pipeId || row?.objectId, "");
        if (role.includes("discharge")) return false;
        return !activePipeIds.size || !pipeId || activePipeIds.has(pipeId);
      });
    }

    if (Array.isArray(report.requiredSections)) {
      report.requiredSections = report.requiredSections.filter(title => !isDischargeOrSinkSectionTitle(title) && !/\bPump\s+Performance\s+(?:Chart|Curve)\b/i.test(text(title, "")));
    }

    report.warnings = filterInactiveTopologyItems(report.warnings, inactiveTokens);
    if (Array.isArray(report.sourceData?.warnings)) {
      report.sourceData.warnings = filterInactiveTopologyItems(report.sourceData.warnings, inactiveTokens);
    }

    return report;
  }

  function waitForExportRefresh(promise, timeoutMs = 12000) {
    if (!promise || typeof promise.then !== "function") return Promise.resolve(promise);
    return new Promise(resolve => {
      let settled = false;
      const timer = root.setTimeout?.(() => {
        if (settled) return;
        settled = true;
        resolve({ timedOut: true });
      }, timeoutMs);
      promise.then(
        value => {
          if (settled) return;
          settled = true;
          root.clearTimeout?.(timer);
          resolve(value);
        },
        error => {
          if (settled) return;
          settled = true;
          root.clearTimeout?.(timer);
          console.warn("PDF export calculation refresh failed.", error);
          resolve({ error });
        }
      );
    });
  }

  async function refreshActiveCalculationBeforeExport(options = {}) {
    const reportHint = options.reportHint || {};
    const topology = detectActiveTopology(reportHint);
    if (!topology.pumpId) return false;

    if (topology.suctionOnly && root.EngineeringSuctionOnlyNpshaRuntime?.runRouteSolve) {
      await waitForExportRefresh(root.EngineeringSuctionOnlyNpshaRuntime.runRouteSolve(topology.pumpId), 14000);
      return true;
    }

    if (!topology.suctionOnly && options.refreshCalculation !== false && typeof root.updateSimulation === "function") {
      await waitForExportRefresh(root.updateSimulation({
        refreshReason: "pdf-export",
        trigger: "pdf-export",
        forceBackend: true,
        renderSidebarAfter: false
      }), 14000);
      return true;
    }

    try {
      if (typeof root.drawConnections === "function") root.drawConnections();
    } catch (error) {
      // Canvas refresh is best-effort; export data is sanitized below.
    }
    return false;
  }

  function normalizeStep(raw, index = 0, sectionTitle = "") {
    const step = raw || {};
    const title = text(step.step || step.title || step.name || step.label || `Calculation Step ${index + 1}`);
    const formula = text(step.formula || step.equation || step.expression || step.methodFormula);
    const substitution = text(
      step.substitution ||
        step.numericSubstitution ||
        step.numericalSubstitution ||
        step.inputs ||
        step.inputSubstitution,
      "-"
    );
    const resultValue = step.resultText || step.evaluatedResult || step.output || step.value || step.result;
    const result = text(resultValue, "-");
    const reference = text(step.reference || step.literature || step.literatureBasis || step.source || step.note, "");
    return {
      index,
      sectionTitle: text(sectionTitle, ""),
      title,
      formula,
      substitution,
      result,
      reference
    };
  }

  function renderEquationStep(step, index) {
    const normalized = normalizeStep(step, index, step.sectionTitle);
    const title = `${index + 1}. ${normalized.title}`;
    return `
      <article class="eqp-step">
        <div class="eqp-step-title"><span>${escapeHtml(title)}</span>${normalized.sectionTitle ? `<span>${escapeHtml(normalized.sectionTitle)}</span>` : ""}</div>
        <div class="eqp-mode">${escapeHtml(MODE_LABEL)}</div>
        <div class="eqp-line">
          <div class="eqp-line-label">Equation</div>
          <div class="eqp-equation-code">${escapeHtml(normalized.formula)}</div>
        </div>
        <div class="eqp-line">
          <div class="eqp-line-label">Numerical substitution</div>
          <div class="eqp-substitution-code">${escapeHtml(normalized.substitution)}</div>
        </div>
        <div class="eqp-line">
          <div class="eqp-line-label">Result</div>
          <div class="eqp-result-value">${escapeHtml(normalized.result)}</div>
        </div>
        ${normalized.reference ? `<div class="eqp-reference">Reference: ${escapeHtml(normalized.reference)}</div>` : ""}
      </article>
    `;
  }

  function readCells(rowHtml) {
    const cells = [];
    rowHtml.replace(/<(?:t[hd])\b[^>]*>([\s\S]*?)<\/t[hd]>/gi, (match, cellHtml) => {
      cells.push(stripTags(cellHtml));
      return match;
    });
    return cells;
  }

  function transformStepTable(tableHtml) {
    const rows = [];
    tableHtml.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (match, rowHtml) => {
      rows.push(readCells(rowHtml));
      return match;
    });
    if (rows.length < 2) return tableHtml;
    const headers = rows[0].map(lower);
    const stepIndex = headers.indexOf("step");
    const formulaIndex = headers.indexOf("formula");
    const substitutionIndex = headers.indexOf("substitution");
    const resultIndex = headers.indexOf("result");
    const referenceIndex = headers.indexOf("reference");
    if (stepIndex < 0 || formulaIndex < 0 || substitutionIndex < 0 || resultIndex < 0) return tableHtml;

    const steps = rows.slice(1)
      .filter(row => row.some(cell => text(cell, "") !== ""))
      .map((row, index) => normalizeStep({
        title: row[stepIndex],
        formula: row[formulaIndex],
        substitution: row[substitutionIndex],
        result: row[resultIndex],
        reference: referenceIndex >= 0 ? row[referenceIndex] : ""
      }, index));

    if (!steps.length) return tableHtml;
    return `<div class="compact-equation-sequence" data-export-mode="equation-professional">${steps.map(renderEquationStep).join("")}</div>`;
  }

  function transformStepTables(html) {
    return String(html || "").replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, tableHtml => transformStepTable(tableHtml));
  }

  function ensureFormulaLineModes(html) {
    return String(html || "").replace(/<div\b[^>]*>/gi, function replaceFormulaOpening(match) {
      const args = Array.from(arguments);
      const offset = args[args.length - 2];
      const fullText = args[args.length - 1];
      const classMatch = match.match(/\bclass=(["'])(.*?)\1/i);
      if (!classMatch) return match;
      const classTokens = classMatch[2].split(/\s+/).filter(Boolean);
      if (!classTokens.includes("formula")) return match;
      const prefix = fullText.slice(Math.max(0, offset - 160), offset);
      if (/class=(["'])eqp-mode\1[^>]*>\s*Mode:\s*Equation Professional\s*<\/div>\s*$/i.test(prefix)) {
        return match;
      }
      return `<div class="eqp-mode" data-equation-professional-mode="true">${escapeHtml(MODE_LABEL)}</div>${match}`;
    });
  }

  function professionalizeFormulaBlocks(html) {
    return ensureFormulaLineModes(String(html || ""))
      .replace(/Formula:/g, "Equation:")
      .replace(/<th>\s*Formula\s*<\/th>/gi, "<th>Equation</th>")
      .replace(/<th>\s*Substitution\s*<\/th>/gi, "<th>Numerical substitution</th>");
  }

  function sectionHeadingText(sectionHtml) {
    const match = String(sectionHtml || "").match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i);
    return stripTags(match ? match[1] : "");
  }

  function parseHtmlDocument(html) {
    if (typeof root.DOMParser !== "function") return null;
    try {
      return new root.DOMParser().parseFromString(String(html || ""), "text/html");
    } catch (error) {
      return null;
    }
  }

  function serializeHtmlDocument(doc, originalHtml) {
    if (!doc?.documentElement) return String(originalHtml || "");
    const doctype = /^<!doctype/i.test(String(originalHtml || "")) ? "<!doctype html>\n" : "";
    return `${doctype}${doc.documentElement.outerHTML}`;
  }

  function removePumpPerformanceChartDiscussion(html) {
    const pumpPerformancePattern = /\bPump Performance (?:Chart|Curve)\b/i;
    const doc = parseHtmlDocument(html);
    if (doc?.body) {
      Array.from(doc.querySelectorAll("section")).forEach(section => {
        const heading = section.querySelector("h1,h2,h3,h4");
        if (pumpPerformancePattern.test(text(heading?.textContent, ""))) section.remove();
      });
      Array.from(doc.querySelectorAll("figure, figcaption, tr, li")).forEach(node => {
        if (pumpPerformancePattern.test(text(node.textContent, ""))) node.remove();
      });
      return serializeHtmlDocument(doc, html);
    }
    let output = String(html || "").replace(/<section\b[^>]*>[\s\S]*?<\/section>/gi, sectionHtml => {
      return pumpPerformancePattern.test(sectionHeadingText(sectionHtml)) ? "" : sectionHtml;
    });
    output = output.replace(/<h2\b[^>]*>\s*Pump Performance (?:Chart|Curve)\s*<\/h2>[\s\S]*?(?=<h2\b|<\/main>|<\/body>)/gi, "");
    output = output.replace(/<figure\b[^>]*>[\s\S]*?Pump Performance (?:Chart|Curve)[\s\S]*?<\/figure>/gi, "");
    output = output.replace(/<figcaption\b[^>]*>[\s\S]*?pump performance curve[\s\S]*?<\/figcaption>/gi, "");
    output = output.replace(/<tr\b[^>]*>[\s\S]*?Pump Performance (?:Chart|Curve)[\s\S]*?<\/tr>/gi, "");
    output = output.replace(/<li\b[^>]*>[\s\S]*?Pump Performance (?:Chart|Curve)[\s\S]*?<\/li>/gi, "");
    return output;
  }

  function renderFluidPhaseChartDiscussion() {
    try {
      const chartMarkup = root.EngineeringFluidBasisPhaseChartRuntime?.buildExportMarkup?.();
      if (chartMarkup) return chartMarkup;
    } catch (error) {
      console.warn("Pressure-enthalpy phase chart export markup failed.", error);
    }
    return `
      <aside class="eqp-fluid-phase-chart-note" data-export-note="pressure-enthalpy-phase-chart">
        <strong>Pressure-enthalpy phase chart.</strong>
        The Fluid Basis workspace includes a P-h phase chart to visualize whether the selected process fluid is in the liquid, mixed-phase, or vapor region before it flows through the pumping system. This visual check helps mechanical and chemical engineers interpret pumpability, vapor-pressure risk, and the consistency of density, viscosity, and vapor-pressure inputs used in the hydraulic calculation.
      </aside>`;
  }

  function injectFluidPhaseChartDiscussion(html) {
    const output = String(html || "");
    if (output.includes('data-export-note="pressure-enthalpy-phase-chart"')) return output;
    const note = renderFluidPhaseChartDiscussion();
    const doc = parseHtmlDocument(output);
    if (doc?.body) {
      const heading = Array.from(doc.querySelectorAll("h1,h2,h3,h4")).find(node => /Fluid\s+Basis\s+Calculation/i.test(text(node.textContent, "")));
      if (heading) {
        heading.insertAdjacentHTML("afterend", note);
        return serializeHtmlDocument(doc, output);
      }
    }
    const fluidHeadingPattern = /(<h[2-4]\b[^>]*>\s*Fluid\s+Basis\s+Calculation\s*<\/h[2-4]>)/i;
    if (fluidHeadingPattern.test(output)) {
      return output.replace(fluidHeadingPattern, `$1${note}`);
    }
    const fallbackPattern = /(<h[2-4]\b[^>]*>\s*Fluid\s+Basis[\s\S]*?<\/h[2-4]>)/i;
    if (fallbackPattern.test(output)) {
      return output.replace(fallbackPattern, `$1${note}`);
    }
    return output;
  }

  function renderMoodyChartDiscussion(report) {
    try {
      const chartMarkup = root.EngineeringPipeMoodyChartAudit?.buildExportMarkup?.(report);
      if (chartMarkup) return chartMarkup;
    } catch (error) {
      console.warn("Moody chart export markup failed.", error);
    }
    return `
      <section class="eqp-moody-chart-figure" data-export-note="moody-friction-factor-chart">
        <div class="eqp-moody-topline">
          <div class="eqp-moody-title-badge">
            <span>FRICTION FACTOR AUDIT</span>
            <strong>Log-Log Moody Chart</strong>
          </div>
          <div class="eqp-moody-metrics">
            <div class="eqp-moody-metric"><span>Primary Re</span><strong>-</strong></div>
            <div class="eqp-moody-metric"><span>Darcy f</span><strong>-</strong></div>
            <div class="eqp-moody-metric"><span>eps/D</span><strong>-</strong></div>
            <div class="eqp-moody-metric"><span>Regime</span><strong>Unverified</strong></div>
          </div>
        </div>
        <div class="eqp-moody-chip-row">
          <span>Log-log scale</span>
          <span>Darcy friction factor</span>
          <span>Relative roughness families</span>
        </div>
        <p class="eqp-moody-note">Darcy friction factor chart. Fanning friction factor equals Darcy f / 4.</p>
      </section>`;
  }

  function injectMoodyChartDiscussion(html, report) {
    const output = String(html || "");
    if (output.includes('data-export-note="moody-friction-factor-chart"')) return output;
    const chart = renderMoodyChartDiscussion(report);
    const doc = parseHtmlDocument(output);
    if (doc?.body) {
      const heading = Array.from(doc.querySelectorAll("h1,h2,h3,h4")).find(node => /\bMoody\s+Chart\b/i.test(text(node.textContent, "")));
      if (heading) {
        heading.insertAdjacentHTML("afterend", chart);
        return serializeHtmlDocument(doc, output);
      }
    }
    const moodyHeadingPattern = /(<h[2-4]\b[^>]*>\s*Moody\s+Chart\s*<\/h[2-4]>)/i;
    if (moodyHeadingPattern.test(output)) {
      return output.replace(moodyHeadingPattern, `$1${chart}`);
    }
    const fallbackPattern = /(<h[2-4]\b[^>]*>[\s\S]*?Pipe[\s\S]*?Calculation[\s\S]*?<\/h[2-4]>)/i;
    if (fallbackPattern.test(output)) {
      return output.replace(fallbackPattern, `$1${chart}`);
    }
    return output;
  }

  function isMoodyChartTitle(value) {
    return /\bMoody\s+Chart\b/i.test(text(value, ""));
  }

  function removeLegacyMoodyChartDiscussion(html, report) {
    let output = String(html || "");
    if (!output.includes('data-export-note="moody-friction-factor-chart"')) {
      output = injectMoodyChartDiscussion(output, report);
    }
    const doc = parseHtmlDocument(output);
    if (doc?.body) {
      Array.from(doc.querySelectorAll("section")).forEach(section => {
        const heading = Array.from(section.children || []).find(child => /^H[1-4]$/i.test(child.tagName || ""));
        if (!heading || !isMoodyChartTitle(heading.textContent)) return;
        const charts = Array.from(section.querySelectorAll('[data-export-note="moody-friction-factor-chart"]'));
        if (!charts.length) return;
        Array.from(section.childNodes || []).forEach(node => {
          if (node === heading || charts.includes(node)) return;
          if (node.nodeType === 1 && typeof node.contains === "function" && charts.some(chart => node.contains(chart))) return;
          node.remove();
        });
      });
      return serializeHtmlDocument(doc, output);
    }
    output = output.replace(
      /<section\b([^>]*)>\s*(<h[1-4]\b[^>]*>\s*Moody\s+Chart\s*<\/h[1-4]>)([\s\S]*?<section\b[^>]*data-export-note=(["'])moody-friction-factor-chart\4[\s\S]*?<\/section>)[\s\S]*?<\/section>/gi,
      "<section$1>$2$3</section>"
    );
    output = output.replace(/<p\b[^>]*>\s*Legacy\s+placeholder\.?\s*<\/p>/gi, "");
    output = output.replace(/<figure\b[^>]*>[\s\S]*?(?:Moody chart with calculated route points|Legacy Moody|old Moody)[\s\S]*?<\/figure>/gi, "");
    output = output.replace(/<table\b[^>]*>[\s\S]*?(?:Legacy Moody|Moody Curve Data|Moody Chart Data)[\s\S]*?<\/table>/gi, "");
    return output;
  }

  function renderSuctionOnlyExportNotice(report) {
    const topology = report?.exportTopology || {};
    const route = ["Fluid Basis", topology.sourceId, topology.suctionPipeId, topology.pumpId].filter(Boolean).join(" > ");
    return `
      <aside class="eqp-fluid-phase-chart-note" data-export-note="active-topology-suction-only">
        <strong>Active topology export.</strong>
        This PDF follows the current simulation route only: ${escapeHtml(route || "source to pump")}. No downstream hydraulic boundary is connected, therefore discharge-pipe and SNK-boundary calculation sections are intentionally omitted from this report.
      </aside>`;
  }

  function removeInactiveTopologySections(html, report) {
    const topology = detectActiveTopology(report);
    const output = String(html || "");
    if (!topology.suctionOnly) return output;
    const doc = parseHtmlDocument(output);
    if (doc?.body) {
      Array.from(doc.querySelectorAll("section")).forEach(section => {
        const heading = section.querySelector("h1,h2,h3,h4");
        if (isDischargeOrSinkSectionTitle(heading?.textContent || "")) section.remove();
      });
      Array.from(doc.querySelectorAll("tr, li")).forEach(node => {
        if (isUnusedTopologyRegisterRow([node.textContent || ""])) node.remove();
      });
      const workflowHeading = Array.from(doc.querySelectorAll("h1,h2,h3,h4")).find(node => /Application\s+Calculation\s+Workflow/i.test(text(node.textContent, "")));
      if (workflowHeading) {
        const nextParagraph = workflowHeading.parentElement?.querySelector("p");
        if (nextParagraph) {
          nextParagraph.textContent = "The exported appendix follows only the current active simulation topology. This run stops at the pump because no downstream hydraulic boundary is connected.";
        }
        if (!doc.querySelector('[data-export-note="active-topology-suction-only"]')) {
          workflowHeading.insertAdjacentHTML("afterend", renderSuctionOnlyExportNotice(report));
        }
      }
      return serializeHtmlDocument(doc, output);
    }
    let fallback = output
      .replace(/<section\b[^>]*>[\s\S]*?<\/section>/gi, sectionHtml => {
        return isDischargeOrSinkSectionTitle(sectionHeadingText(sectionHtml)) ? "" : sectionHtml;
      })
      .replace(/<tr\b[^>]*>[\s\S]*?(?:Discharge|SNK\s+Boundary|Sink\s+Boundary)[\s\S]*?<\/tr>/gi, "")
      .replace(/The application solves the route from Fluid Basis[\s\S]*?calculation engine\./i, "The exported appendix follows only the current active simulation topology. This run stops at the pump because no downstream hydraulic boundary is connected.");
    if (!fallback.includes('data-export-note="active-topology-suction-only"')) {
      fallback = fallback.replace(/(<h[1-4]\b[^>]*>\s*Application\s+Calculation\s+Workflow\s*<\/h[1-4]>)/i, `$1${renderSuctionOnlyExportNotice(report)}`);
    }
    return fallback;
  }

  function injectProfessionalCss(html) {
    const styleTag = `<style data-export-equation-professional="true">${PROFESSIONAL_CSS}</style>`;
    if (String(html).includes("data-export-equation-professional")) return html;
    if (String(html).includes("</head>")) return String(html).replace("</head>", `${styleTag}</head>`);
    return `${styleTag}${html}`;
  }

  function injectProfessionalContract(html) {
    const contract = `
      <section class="eqp-export-contract" data-export-mode="equation-professional">
        <strong>${escapeHtml(MODE_LABEL)}</strong>
        <span>${escapeHtml(LANGUAGE_LABEL)}</span>
        <span>${escapeHtml(LAYOUT_LABEL)}</span>
      </section>`;
    const raw = String(html || "");
    if (raw.includes("eqp-export-contract")) return raw;
    if (raw.includes("<main")) {
      return raw.replace(/(<main\b[^>]*>)/i, `$1${contract}`);
    }
    return raw.replace(/(<body\b[^>]*>)/i, `$1${contract}`);
  }

  function addBodyClass(html) {
    const raw = String(html || "");
    let output = raw.replace(/<html\b([^>]*)>/i, (match, attrs) => {
      const cleanAttrs = String(attrs || "").replace(/\s+lang=(["']).*?\1/i, "");
      return `<html${cleanAttrs} lang="en">`;
    });
    if (!/<html\b/i.test(output)) output = `<html lang="en">${output}</html>`;
    output = output.replace(/<body\b([^>]*)>/i, (match, attrs) => {
      if (/class=(["'])(.*?)\1/i.test(attrs)) {
        return `<body${attrs.replace(/class=(["'])(.*?)\1/i, (classMatch, quote, classes) => `class=${quote}${classes} equation-professional-export compact-export-layout${quote}`)}>`;
      }
      return `<body${attrs} class="equation-professional-export compact-export-layout">`;
    });
    return output;
  }

  function professionalizeAppendixHtml(html, report) {
    forceEnglishReport(report);
    sanitizeReportForActiveTopology(report);
    let output = String(html || "");
    output = addBodyClass(output);
    output = injectProfessionalCss(output);
    output = injectProfessionalContract(output);
    output = removePumpPerformanceChartDiscussion(output);
    output = injectFluidPhaseChartDiscussion(output);
    output = injectMoodyChartDiscussion(output, report);
    output = removeLegacyMoodyChartDiscussion(output, report);
    output = removeInactiveTopologySections(output, report);
    output = transformStepTables(output);
    output = professionalizeFormulaBlocks(output);
    return output;
  }

  function buildProfessionalAppendixHtml(report, options) {
    if (typeof original.buildScenarioAppendixHtml !== "function") {
      throw new Error("Scenario appendix HTML builder is not available.");
    }
    const forced = sanitizeReportForActiveTopology(forceEnglishReport(report));
    const html = original.buildScenarioAppendixHtml.call(root, forced, options);
    return professionalizeAppendixHtml(html, forced);
  }

  async function collectProfessionalAppendixData(options) {
    if (typeof root.collectScenarioAppendixData !== "function") {
      throw new Error("Scenario appendix data collector is not available.");
    }
    await refreshActiveCalculationBeforeExport(options || {});
    const data = await root.collectScenarioAppendixData({
      includePumpChart: false,
      ...(options || {})
    });
    return sanitizeReportForActiveTopology(forceEnglishReport(data));
  }

  function writePrintWindow(printWindow, html) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    try {
      printWindow.focus();
    } catch (error) {
      // Focusing a popup can fail in hardened browser contexts.
    }
  }

  async function exportProfessionalPdf(options) {
    try {
      const data = await collectProfessionalAppendixData(options);
      const html = buildProfessionalAppendixHtml(data, { autoPrint: true });
      const printWindow = root.open ? root.open("", "_blank") : null;
      if (!printWindow) {
        throw new Error("The browser blocked the PDF print window.");
      }
      writePrintWindow(printWindow, html);
      return { ok: true, mode: "pdf-print", data };
    } catch (error) {
      console.error("Professional PDF appendix export failed.", error);
      if (typeof original.exportScenarioCalculationTraceToPdf === "function") {
        return original.exportScenarioCalculationTraceToPdf.apply(root, arguments);
      }
      throw error;
    }
  }

  function collectProfessionalSteps(report) {
    const steps = [];
    const seenObjects = typeof WeakSet === "function" ? new WeakSet() : null;
    const seenSignatures = new Set();

    function addSteps(sectionTitle, items) {
      if (!Array.isArray(items)) return;
      items.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const hasSequentialShape = item.formula || item.equation || item.substitution || item.numericSubstitution || item.result || item.resultText;
        if (!hasSequentialShape) return;
        const normalized = normalizeStep(item, steps.length, sectionTitle);
        const signature = [normalized.sectionTitle, normalized.title, normalized.formula, normalized.substitution, normalized.result].join("|");
        if (seenSignatures.has(signature)) return;
        seenSignatures.add(signature);
        steps.push(normalized);
      });
    }

    function titleFromPath(path) {
      const last = path.filter(Boolean).slice(-2).join(" ");
      return last
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\bsteps\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^./, value => value.toUpperCase()) || "Calculation Sequence";
    }

    function visit(value, path) {
      if (!value || typeof value !== "object") return;
      if (seenObjects) {
        if (seenObjects.has(value)) return;
        seenObjects.add(value);
      }
      if (Array.isArray(value)) {
        addSteps(titleFromPath(path), value);
        value.forEach((item, index) => visit(item, path.concat(String(index))));
        return;
      }
      Object.keys(value).forEach(key => {
        const child = value[key];
        if (Array.isArray(child) && lower(key).includes("step")) {
          addSteps(titleFromPath(path.concat(key)), child);
        }
        visit(child, path.concat(key));
      });
    }

    visit(report, []);
    return steps;
  }

  function install(options = {}) {
    if (installed && !options.force) return api;
    if (typeof original.exportScenarioCalculationTraceToPdf === "function") {
      root.exportScenarioCalculationTraceToPdf = exportProfessionalPdf;
    }
    installed = true;
    return api;
  }

  const api = {
    version: VERSION,
    labels: {
      mode: MODE_LABEL,
      language: LANGUAGE_LABEL,
      layout: LAYOUT_LABEL
    },
    install,
    forceEnglishReport,
    detectActiveTopology,
    sanitizeReportForActiveTopology,
    refreshActiveCalculationBeforeExport,
    buildProfessionalAppendixHtml,
    professionalizeAppendixHtml,
    removePumpPerformanceChartDiscussion,
    removeInactiveTopologySections,
    injectFluidPhaseChartDiscussion,
    renderMoodyChartDiscussion,
    injectMoodyChartDiscussion,
    removeLegacyMoodyChartDiscussion,
    transformStepTable,
    transformStepTables,
    renderEquationStep,
    collectProfessionalSteps,
    original
  };

  install();
  return api;
});
