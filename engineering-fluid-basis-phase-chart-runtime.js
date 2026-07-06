!function registerEngineeringFluidBasisPhaseChartRuntime(root) {
  "use strict";

  const VERSION = "2026.07-fluid-basis-phase-chart1";
  const CACHE_KEY = "20260706-fluid-phase-chart1";
  const STYLE_ID = "engineering-fluid-basis-phase-chart-style";
  const PANEL_SELECTOR = "[data-fluid-basis-phase-chart-panel='true']";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ATM_PRESSURE_BAR = 1.01325;
  const CRITICAL_TEMPERATURE_C = 373.946;
  const CRITICAL_PRESSURE_BAR = 220.64;
  const CRITICAL_ENTHALPY_KJ_KG = 2087.5;

  const plot = {
    width: 960,
    height: 620,
    margin: { left: 76, right: 44, top: 48, bottom: 78 },
    hMin: 0,
    hMax: 3200,
    pMin: 0.006,
    pMax: 300
  };

  const region4N = [
    0.11670521452767e4,
    -0.72421316703206e6,
    -0.17073846940092e2,
    0.12020824702470e5,
    -0.32325550322333e7,
    0.14915108613530e2,
    -0.48232657361591e4,
    0.40511340542057e6,
    -0.23855557567849,
    0.65017534844798e3
  ];

  let observer = null;
  let refreshTimer = 0;
  let installAttempts = 0;
  let cachedSaturationCurve = null;

  function finiteNumber(value, fallback = null) {
    if (value === null || value === undefined || value === "") return fallback;
    const match = String(value).replace(",", ".").match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
    if (!match) return fallback;
    const number = Number(match[0]);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function fmt(value, digits = 3) {
    const number = finiteNumber(value, NaN);
    if (!Number.isFinite(number)) return "-";
    const abs = Math.abs(number);
    if (abs > 0 && abs < 0.001) return number.toExponential(3);
    return number.toFixed(digits);
  }

  function runtimeModel() {
    if (root.globalModel && Object.keys(root.globalModel || {}).length) return root.globalModel;
    if (root.__npshGlobalModel && Object.keys(root.__npshGlobalModel || {}).length) return root.__npshGlobalModel;
    try {
      if (typeof root.getSimulationState === "function") {
        const state = JSON.parse(root.getSimulationState());
        if (state?.model) return state.model;
      }
    } catch (error) {
      // Protected/local previews may not expose a serializable state yet.
    }
    return root.globalModel || root.__npshGlobalModel || {};
  }

  function sourceEntries(model = runtimeModel()) {
    return Object.entries(model || {}).filter(([, node]) => node?.type === "source");
  }

  function sourceSortKey([id]) {
    const text = String(id || "");
    const score = /^SRC[-_]/i.test(text) ? 0 : 1;
    const number = finiteNumber(text, 99999);
    return `${score}-${String(number).padStart(8, "0")}-${text}`;
  }

  function firstRouteSource(model = runtimeModel()) {
    const entries = sourceEntries(model).sort((a, b) => sourceSortKey(a).localeCompare(sourceSortKey(b)));
    return entries[0] || null;
  }

  function readFluidTemperature(model = runtimeModel()) {
    if (typeof document !== "undefined") {
      const activeInput = document.querySelector("#fluid-task-temp, input.prop-input-field[data-node='FLUID'][data-key='temp'], input[data-node='FLUID'][data-key='temp']");
      const fromInput = finiteNumber(activeInput?.value, null);
      if (fromInput !== null) return fromInput;
    }
    return finiteNumber(model?.FLUID?.props?.temp, 25);
  }

  function readFluidSaturationPressure(model = runtimeModel(), temperatureC = readFluidTemperature(model)) {
    const props = model?.FLUID?.props || {};
    const fromFluidBasis = finiteNumber(props.vaporPressure, null);
    if (fromFluidBasis !== null && fromFluidBasis > 0) return {
      value: fromFluidBasis,
      source: "Fluid Basis vapor pressure"
    };
    return {
      value: saturationPressureBar(temperatureC),
      source: "IAPWS Region 4 saturation pressure"
    };
  }

  function readNestedNumber(object, paths = []) {
    for (const path of paths) {
      const parts = path.split(".");
      let current = object;
      for (const part of parts) current = current?.[part];
      const number = finiteNumber(current, null);
      if (number !== null) return number;
    }
    return null;
  }

  function readSourceAbsPressureBar(model = runtimeModel()) {
    const entry = firstRouteSource(model);
    if (!entry) return {
      value: ATM_PRESSURE_BAR,
      sourceId: "",
      source: "Atmospheric fallback"
    };
    const [sourceId, sourceNode] = entry;
    const resultValue = readNestedNumber(sourceNode, [
      "results.calculationTrace.boundary.absolutePressureBar",
      "results.boundary.absolutePressureBar",
      "results.boundaryAudit.suction.pressureAbsBar",
      "results.pressureAbsBar",
      "results.absolutePressureBar",
      "results.calculatedAbsPressure",
      "results.calculatedPressure",
      "results.staticPressure",
      "results.pressure"
    ]);
    if (resultValue !== null && resultValue > 0) return {
      value: resultValue,
      sourceId,
      source: "SRC Calculated Abs. Pressure"
    };
    const standardValue = typeof root.EngineeringStandards?.getNodeAbsolutePressureBar === "function"
      ? finiteNumber(root.EngineeringStandards.getNodeAbsolutePressureBar(sourceNode, "pressure"), null)
      : null;
    if (standardValue !== null && standardValue > 0) return {
      value: standardValue,
      sourceId,
      source: "SRC pressure basis conversion"
    };
    const props = sourceNode?.props || {};
    const pressure = finiteNumber(props.pressure, null);
    if (pressure !== null) {
      const basis = String(props.pressureInputBasis || props.pressureBasis || "Absolute").toLowerCase();
      const absolute = basis.includes("gauge") || /\bg\b/.test(basis) ? pressure + ATM_PRESSURE_BAR : pressure;
      if (absolute > 0) return {
        value: absolute,
        sourceId,
        source: "SRC pressure input"
      };
    }
    return {
      value: ATM_PRESSURE_BAR,
      sourceId,
      source: "Atmospheric fallback"
    };
  }

  function saturationPressureBar(temperatureC) {
    const boundedC = clamp(finiteNumber(temperatureC, 25), 0, CRITICAL_TEMPERATURE_C);
    const temperatureK = boundedC + 273.15;
    const n = region4N;
    const theta = temperatureK + n[8] / (temperatureK - n[9]);
    const A = theta * theta + n[0] * theta + n[1];
    const B = n[2] * theta * theta + n[3] * theta + n[4];
    const C = n[5] * theta * theta + n[6] * theta + n[7];
    const discriminant = B * B - 4 * A * C;
    const pressureMPa = Math.pow((2 * C) / (-B + Math.sqrt(discriminant)), 4);
    return pressureMPa * 10;
  }

  function saturationVisualPoint(temperatureC) {
    const temperature = clamp(finiteNumber(temperatureC, 25), 0.01, CRITICAL_TEMPERATURE_C);
    const tau = temperature / CRITICAL_TEMPERATURE_C;
    const pBar = saturationPressureBar(temperature);
    const hfBase = CRITICAL_ENTHALPY_KJ_KG * Math.pow(tau, 1.25);
    const nearCritical = clamp((temperature - 350) / (CRITICAL_TEMPERATURE_C - 350), 0, 1);
    const hf = hfBase * (1 - nearCritical) + CRITICAL_ENTHALPY_KJ_KG * nearCritical;
    const width = (2505 - CRITICAL_ENTHALPY_KJ_KG) * Math.pow(1 - tau, 0.34)
      + 260 * Math.pow(Math.max(0, Math.sin(Math.PI * tau)), 0.9);
    const hg = CRITICAL_ENTHALPY_KJ_KG + Math.max(0, width) * (1 - nearCritical);
    return {
      temperatureC: temperature,
      P_bar: pBar,
      hf: clamp(hf, 0, CRITICAL_ENTHALPY_KJ_KG),
      hg: clamp(Math.max(hg, hf + 8), CRITICAL_ENTHALPY_KJ_KG, 3120)
    };
  }

  function saturationCurve() {
    if (cachedSaturationCurve) return cachedSaturationCurve;
    const points = [];
    for (let t = 0.01; t <= CRITICAL_TEMPERATURE_C; t += 4) {
      points.push(saturationVisualPoint(t));
    }
    points.push(saturationVisualPoint(CRITICAL_TEMPERATURE_C));
    cachedSaturationCurve = points;
    return points;
  }

  function buildCalculation(model = runtimeModel()) {
    const temperatureC = readFluidTemperature(model);
    const pAbs = readSourceAbsPressureBar(model);
    const psat = readFluidSaturationPressure(model, temperatureC);
    const satVisual = saturationVisualPoint(temperatureC);
    const deltaP = pAbs.value - psat.value;
    const toleranceBar = Math.max(0.001, Math.abs(psat.value) * 0.005);
    let statusTitle = "Single-phase liquid region";
    let statusTone = "safe";
    if (temperatureC > 350) {
      statusTitle = "Near-critical chart range";
      statusTone = "warning";
    }
    if (deltaP < -toleranceBar) {
      statusTitle = "Not stable as single-phase liquid";
      statusTone = "danger";
    } else if (Math.abs(deltaP) <= toleranceBar) {
      statusTitle = "Near saturated boundary";
      statusTone = "warning";
    }
    return {
      validForPlot: Number.isFinite(temperatureC) && pAbs.value > 0 && psat.value > 0,
      temperatureC,
      actualPressureBar: pAbs.value,
      actualPressureSource: pAbs.source,
      sourceId: pAbs.sourceId,
      psatBar: psat.value,
      psatSource: psat.source,
      deltaPBar: deltaP,
      toleranceBar,
      hf: satVisual.hf,
      hg: satVisual.hg,
      hMarker: deltaP >= -toleranceBar ? satVisual.hf : satVisual.hg,
      statusTitle,
      statusTone
    };
  }

  function xScale(h) {
    const left = plot.margin.left;
    const right = plot.width - plot.margin.right;
    const ratio = (clamp(h, plot.hMin, plot.hMax) - plot.hMin) / (plot.hMax - plot.hMin);
    return left + ratio * (right - left);
  }

  function yScale(pBar) {
    const top = plot.margin.top;
    const bottom = plot.height - plot.margin.bottom;
    const bounded = clamp(pBar, plot.pMin, plot.pMax);
    const logMin = Math.log10(plot.pMin);
    const logMax = Math.log10(plot.pMax);
    const ratio = (Math.log10(bounded) - logMin) / (logMax - logMin);
    return bottom - ratio * (bottom - top);
  }

  function svgEl(tag, attrs = {}, text = "") {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      node.setAttribute(key, String(value));
    });
    if (text !== "") node.textContent = text;
    return node;
  }

  function pointsToPath(points) {
    return points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  }

  function pointsToPolygon(points) {
    return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  }

  function drawTextBadge(group, x, y, text, options = {}) {
    const width = Math.max(58, String(text).length * (options.fontSize || 11) * 0.58 + 18);
    const height = options.height || 22;
    const anchor = options.anchor || "middle";
    const left = anchor === "end" ? x - width : anchor === "start" ? x : x - width / 2;
    const top = y - height + 5;
    group.appendChild(svgEl("rect", {
      x: left,
      y: top,
      width,
      height,
      rx: 6,
      fill: options.bg || "rgba(255,255,255,0.88)",
      stroke: options.stroke || "#cbd5e1",
      "stroke-width": 1
    }));
    group.appendChild(svgEl("text", {
      x,
      y,
      fill: options.fill || "#0f314d",
      "font-size": options.fontSize || 11,
      "font-weight": options.fontWeight || 700,
      "text-anchor": anchor
    }, text));
  }

  function createAxisAndGrid() {
    const group = svgEl("g", { class: "fluid-phase-chart-axis" });
    const left = plot.margin.left;
    const right = plot.width - plot.margin.right;
    const top = plot.margin.top;
    const bottom = plot.height - plot.margin.bottom;
    const pressureTicks = [0.006, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200];
    const hTicks = [0, 500, 1000, 1500, 2000, 2500, 3000];

    pressureTicks.forEach((tick) => {
      const y = yScale(tick);
      group.appendChild(svgEl("line", { x1: left, y1: y, x2: right, y2: y, class: "fluid-phase-grid-line" }));
      group.appendChild(svgEl("text", { x: left - 10, y: y + 4, class: "fluid-phase-tick-label", "text-anchor": "end" }, String(tick)));
    });

    hTicks.forEach((tick) => {
      const x = xScale(tick);
      group.appendChild(svgEl("line", { x1: x, y1: top, x2: x, y2: bottom, class: "fluid-phase-grid-line" }));
      group.appendChild(svgEl("text", { x, y: bottom + 23, class: "fluid-phase-tick-label", "text-anchor": "middle" }, String(tick)));
    });

    group.appendChild(svgEl("line", { x1: left, y1: bottom, x2: right, y2: bottom, class: "fluid-phase-axis-line" }));
    group.appendChild(svgEl("line", { x1: left, y1: top, x2: left, y2: bottom, class: "fluid-phase-axis-line" }));
    group.appendChild(svgEl("text", { x: (left + right) / 2, y: plot.height - 16, class: "fluid-phase-axis-label", "text-anchor": "middle" }, "Specific enthalpy, h (kJ/kg)"));
    const yLabel = svgEl("text", { x: 20, y: (top + bottom) / 2, class: "fluid-phase-axis-label", "text-anchor": "middle", transform: `rotate(-90 20 ${(top + bottom) / 2})` }, "Absolute pressure, P (bar A, log scale)");
    group.appendChild(yLabel);
    return group;
  }

  function drawTemperatureGuides(group) {
    [50, 100, 150, 200, 250, 300].forEach((temperature) => {
      const sat = saturationVisualPoint(temperature);
      const liquidTop = [];
      const pStart = Math.max(sat.P_bar * 1.02, plot.pMin * 1.01);
      for (let i = 0; i <= 22; i += 1) {
        const ratio = i / 22;
        const p = pStart * Math.pow(plot.pMax / pStart, ratio);
        const h = sat.hf - 85 + 50 * ratio;
        liquidTop.push({ x: xScale(h), y: yScale(p) });
      }
      group.appendChild(svgEl("path", {
        d: pointsToPath(liquidTop),
        fill: "none",
        stroke: "#109618",
        "stroke-width": 0.9,
        opacity: 0.78
      }));
      group.appendChild(svgEl("line", {
        x1: xScale(sat.hf),
        y1: yScale(sat.P_bar),
        x2: xScale(sat.hg),
        y2: yScale(sat.P_bar),
        stroke: "#109618",
        "stroke-width": 0.9,
        opacity: 0.78
      }));
      const vapor = [];
      const pEnd = Math.max(plot.pMin, sat.P_bar * 0.998);
      for (let i = 0; i <= 28; i += 1) {
        const ratio = i / 28;
        const p = pEnd * Math.pow(plot.pMin / pEnd, ratio);
        const h = sat.hg + 380 * Math.pow(ratio, 0.8);
        vapor.push({ x: xScale(h), y: yScale(p) });
      }
      group.appendChild(svgEl("path", {
        d: pointsToPath(vapor),
        fill: "none",
        stroke: "#109618",
        "stroke-width": 0.9,
        opacity: 0.78
      }));
      const labelX = xScale(sat.hf + 0.16 * (sat.hg - sat.hf));
      const labelY = yScale(sat.P_bar) - 7;
      group.appendChild(svgEl("text", {
        x: labelX,
        y: labelY,
        fill: "#109618",
        "font-size": temperature === 50 ? 12 : 11,
        "font-style": "italic",
        "font-weight": temperature === 50 ? 700 : 600,
        "text-anchor": "middle"
      }, temperature === 50 ? `T = ${temperature} deg C` : String(temperature)));
    });
  }

  function drawDiagram(svg, calc) {
    if (!svg || typeof document === "undefined") return;
    svg.setAttribute("viewBox", `0 0 ${plot.width} ${plot.height}`);
    svg.replaceChildren();
    svg.appendChild(createAxisAndGrid());

    const curve = saturationCurve();
    const liquidPixels = curve.map((point) => ({ x: xScale(point.hf), y: yScale(point.P_bar) }));
    const vaporPixels = curve.map((point) => ({ x: xScale(point.hg), y: yScale(point.P_bar) }));
    const dome = svgEl("g", { class: "fluid-phase-dome" });

    dome.appendChild(svgEl("polygon", {
      points: pointsToPolygon(liquidPixels.concat([...vaporPixels].reverse())),
      fill: "#dcefff",
      opacity: 0.6
    }));
    drawTemperatureGuides(dome);

    for (let q = 0.1; q < 1; q += 0.1) {
      const quality = Number(q.toFixed(1));
      const points = curve.map((point) => ({
        x: xScale(point.hf + quality * (point.hg - point.hf)),
        y: yScale(point.P_bar)
      }));
      dome.appendChild(svgEl("path", {
        d: pointsToPath(points),
        fill: "none",
        stroke: "#1d4ed8",
        "stroke-width": 0.75,
        opacity: 0.62
      }));
    }

    dome.appendChild(svgEl("path", { d: pointsToPath(liquidPixels), fill: "none", stroke: "#111827", "stroke-width": 1.4 }));
    dome.appendChild(svgEl("path", { d: pointsToPath(vaporPixels), fill: "none", stroke: "#111827", "stroke-width": 1.4 }));

    [
      { q: 0.1, temp: 250, dx: 18, dy: -24 },
      { q: 0.5, temp: 235, dx: 0, dy: -10 },
      { q: 0.9, temp: 245, dx: 8, dy: -10 }
    ].forEach(({ q, temp, dx, dy }) => {
      const point = saturationVisualPoint(temp);
      drawTextBadge(dome, xScale(point.hf + q * (point.hg - point.hf)) + dx, yScale(point.P_bar) + dy, `x = ${q.toFixed(1)}`, {
        fill: "#1d4ed8",
        fontSize: 11,
        bg: "rgba(255,255,255,0.78)",
        stroke: "rgba(29,78,216,0.22)"
      });
    });

    drawTextBadge(dome, xScale(1320), yScale(17), "Two-phase liquid-vapor region", {
      fill: "#285f75",
      fontSize: 12,
      fontWeight: 800,
      bg: "rgba(255,255,255,0.84)",
      stroke: "rgba(40,95,117,0.24)"
    });
    drawTextBadge(dome, xScale(90), yScale(24), "Compressed / subcooled liquid", {
      fill: "#2159a8",
      fontSize: 11,
      fontWeight: 800,
      anchor: "start",
      bg: "rgba(255,255,255,0.84)",
      stroke: "rgba(33,89,168,0.20)"
    });
    drawTextBadge(dome, xScale(2560), yScale(5.5), "Superheated vapor region", {
      fill: "#a23a24",
      fontSize: 11,
      fontWeight: 800,
      bg: "rgba(255,255,255,0.84)",
      stroke: "rgba(162,58,36,0.20)"
    });
    svg.appendChild(dome);

    if (!calc?.validForPlot) return;
    const overlay = svgEl("g", { class: "fluid-phase-overlay" });
    const left = plot.margin.left;
    const right = plot.width - plot.margin.right;
    const bottom = plot.height - plot.margin.bottom;
    const yPsat = yScale(calc.psatBar);
    const yActual = yScale(calc.actualPressureBar);
    const xEval = xScale(calc.hMarker);

    overlay.appendChild(svgEl("line", {
      x1: left,
      y1: yPsat,
      x2: right,
      y2: yPsat,
      stroke: "#64748b",
      "stroke-width": 1.6,
      "stroke-dasharray": "6 5",
      opacity: 0.84
    }));
    overlay.appendChild(svgEl("line", {
      x1: left,
      y1: yActual,
      x2: right,
      y2: yActual,
      stroke: "#0f172a",
      "stroke-width": 1.7,
      "stroke-dasharray": "8 4",
      opacity: 0.74
    }));
    let psatLabelY = yPsat + 22;
    let actualLabelY = yActual - 12;
    if (Math.abs(yActual - yPsat) > 34) {
      psatLabelY = yPsat - 10;
      actualLabelY = yActual - 10;
    }
    drawTextBadge(overlay, right - 10, psatLabelY, `P_sat(T) = ${fmt(calc.psatBar, 4)} bar A`, {
      fill: "#475569",
      fontSize: 11,
      anchor: "end",
      bg: "rgba(255,255,255,0.93)",
      stroke: "rgba(100,116,139,0.25)"
    });
    drawTextBadge(overlay, right - 10, actualLabelY, `P_abs = ${fmt(calc.actualPressureBar, 4)} bar A`, {
      fill: "#0f172a",
      fontSize: 11,
      anchor: "end",
      bg: "rgba(255,255,255,0.93)",
      stroke: "rgba(15,23,42,0.20)"
    });
    overlay.appendChild(svgEl("line", {
      x1: xEval,
      y1: yActual,
      x2: xEval,
      y2: bottom,
      stroke: "#111827",
      "stroke-width": 1.2,
      "stroke-dasharray": "4 5",
      opacity: 0.62
    }));
    overlay.appendChild(svgEl("circle", {
      cx: xEval,
      cy: yActual,
      r: 7,
      fill: "#dc2626",
      stroke: "#ffffff",
      "stroke-width": 3
    }));
    const boxX = plot.margin.left + 14;
    const boxY = bottom - 52;
    overlay.appendChild(svgEl("rect", { x: boxX, y: boxY, width: 314, height: 38, rx: 10, fill: "#111827", opacity: 0.94 }));
    overlay.appendChild(svgEl("text", { x: boxX + 12, y: boxY + 24, fill: "#ffffff", "font-size": 11.5, "font-weight": 700 }, `h marker ~= ${fmt(calc.hMarker, 2)} kJ/kg; P = ${fmt(calc.actualPressureBar, 4)} bar A`));
    svg.appendChild(overlay);
  }

  function installStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.fluid-basis-phase-chart-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid #d8e6f2;
  border-radius: 8px;
  background: #fff;
  overflow-anchor: none;
}
.fluid-basis-phase-chart-panel h3 {
  margin: 0;
  color: #0f314d;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
}
.fluid-basis-phase-chart-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.fluid-basis-phase-chart-meta div {
  min-height: 42px;
  padding: 7px 8px;
  border: 1px solid #e2edf7;
  border-radius: 6px;
  background: #f8fbff;
  color: #475569;
  font-size: 10.5px;
  line-height: 1.25;
}
.fluid-basis-phase-chart-meta strong {
  display: block;
  margin-top: 2px;
  color: #0f314d;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.fluid-basis-phase-chart-wrap {
  position: relative;
  width: 100%;
  min-width: 0;
  height: clamp(340px, 52vh, 520px);
  min-height: 340px;
  border: 1px solid #d8e2ef;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  contain: layout paint;
}
.fluid-basis-phase-chart-svg {
  display: block;
  width: 100%;
  height: 100%;
}
.fluid-phase-axis-label {
  font-size: 13px;
  font-weight: 800;
  fill: #1f2937;
}
.fluid-phase-tick-label {
  font-size: 11px;
  fill: #4b5563;
}
.fluid-phase-grid-line {
  stroke: #dce6f2;
  stroke-width: 1;
}
.fluid-phase-axis-line {
  stroke: #4b5563;
  stroke-width: 1.2;
}
.fluid-basis-phase-chart-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 14px;
  color: #5b677a;
  font-size: 11px;
  line-height: 1.2;
}
.fluid-basis-phase-chart-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.fluid-basis-phase-chart-legend i {
  display: inline-block;
  width: 20px;
  height: 3px;
  border-radius: 8px;
  background: #1d4ed8;
}
.fluid-basis-phase-chart-legend .legend-liquid { background: #2159a8; }
.fluid-basis-phase-chart-legend .legend-vapor { background: #a23a24; }
.fluid-basis-phase-chart-legend .legend-quality { background: #1d4ed8; }
.fluid-basis-phase-chart-legend .legend-temperature { background: #109618; }
.fluid-basis-phase-chart-legend .legend-point {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #dc2626;
}
@media (max-width: 720px) {
  .fluid-basis-phase-chart-panel { padding: 9px; }
  .fluid-basis-phase-chart-meta { grid-template-columns: 1fr; }
  .fluid-basis-phase-chart-wrap { height: 360px; min-height: 360px; }
}
`;
    document.head.appendChild(style);
  }

  function isFluidBasisWindow(windowNode) {
    if (!windowNode?.querySelector) return false;
    const kind = normalizeText(windowNode.dataset?.kind).toLowerCase();
    if (kind === "fluid") return true;
    const title = normalizeText(windowNode.querySelector(".task-window-title, #taskWindowTitle, .task-window-header")?.textContent || "");
    return /fluid\s+basis|basis\s+fluida/i.test(title)
      || !!windowNode.querySelector("#fluid-task-temp, input[data-node='FLUID'][data-key='temp'], .fluid-basis-task");
  }

  function fluidBasisWindows(rootNode = document) {
    const nodes = Array.from(rootNode?.querySelectorAll?.("#taskWindow, .task-window") || []);
    if (rootNode?.matches?.("#taskWindow, .task-window")) nodes.unshift(rootNode);
    return Array.from(new Set(nodes)).filter(isFluidBasisWindow);
  }

  function createPanel() {
    const panel = document.createElement("section");
    panel.className = "fluid-basis-phase-chart-panel";
    panel.dataset.fluidBasisPhaseChartPanel = "true";
    panel.dataset.runtimeVersion = VERSION;
    panel.innerHTML = `
      <h3>Pressure-enthalpy phase chart</h3>
      <div class="fluid-basis-phase-chart-meta" data-fluid-phase-meta="true">
        <div>Temperature<strong data-fluid-phase-temperature>-</strong></div>
        <div>SRC Calculated Abs. Pressure<strong data-fluid-phase-pressure>-</strong></div>
        <div>Phase Status<strong data-fluid-phase-status>-</strong></div>
      </div>
      <div class="fluid-basis-phase-chart-wrap">
        <svg class="fluid-basis-phase-chart-svg" data-fluid-phase-chart-svg role="img" aria-label="Water pressure enthalpy phase chart"></svg>
      </div>
      <div class="fluid-basis-phase-chart-legend" aria-hidden="true">
        <span><i class="legend-liquid"></i>Saturated liquid</span>
        <span><i class="legend-vapor"></i>Saturated vapor</span>
        <span><i class="legend-quality"></i>Quality lines</span>
        <span><i class="legend-temperature"></i>Temperature curves</span>
        <span><i class="legend-point"></i>Evaluated point</span>
      </div>
    `;
    return panel;
  }

  function ensurePanel(windowNode) {
    const body = windowNode?.querySelector?.(".task-window-body, #taskWindowBody");
    if (!body) return null;
    let panel = body.querySelector(PANEL_SELECTOR);
    if (!panel) {
      panel = createPanel();
      const host = body.querySelector(".fluid-basis-task") || body;
      host.appendChild(panel);
    }
    return panel;
  }

  function updatePanel(panel, calc = buildCalculation()) {
    if (!panel) return null;
    panel.querySelector("[data-fluid-phase-temperature]").textContent = `${fmt(calc.temperatureC, 3)} deg C`;
    panel.querySelector("[data-fluid-phase-pressure]").textContent = `${fmt(calc.actualPressureBar, 4)} bar A`;
    panel.querySelector("[data-fluid-phase-status]").textContent = calc.statusTitle;
    panel.dataset.phaseStatusTone = calc.statusTone;
    panel.dataset.sourceId = calc.sourceId || "";
    panel.title = [
      `Temperature source: Fluid Basis`,
      `Pressure source: ${calc.actualPressureSource}${calc.sourceId ? ` (${calc.sourceId})` : ""}`,
      `P_sat source: ${calc.psatSource}`
    ].join("\n");
    drawDiagram(panel.querySelector("[data-fluid-phase-chart-svg]"), calc);
    return calc;
  }

  function refresh(rootNode = document) {
    if (typeof document === "undefined") return 0;
    installStyles();
    let count = 0;
    fluidBasisWindows(rootNode).forEach((windowNode) => {
      const panel = ensurePanel(windowNode);
      if (panel) {
        updatePanel(panel);
        count += 1;
      }
    });
    document.documentElement.dataset.fluidBasisPhaseChartRuntime = VERSION;
    return count;
  }

  function scheduleRefresh(rootNode = document, delayMs = 0) {
    if (typeof document === "undefined") return;
    root.clearTimeout?.(refreshTimer);
    refreshTimer = root.setTimeout(() => {
      refreshTimer = 0;
      refresh(rootNode);
    }, Math.max(0, delayMs));
  }

  function patchFunction(name) {
    const original = root[name];
    if (typeof original !== "function" || original.__fluidBasisPhaseChartRuntime) return false;
    function wrappedFluidPhaseChartFunction(...args) {
      const result = original.apply(this, args);
      const after = () => scheduleRefresh(document, 20);
      if (result && typeof result.then === "function") return result.finally(after);
      after();
      return result;
    }
    wrappedFluidPhaseChartFunction.__fluidBasisPhaseChartRuntime = VERSION;
    wrappedFluidPhaseChartFunction.__original = original;
    root[name] = wrappedFluidPhaseChartFunction;
    return true;
  }

  function installEvents() {
    if (typeof document === "undefined" || document.documentElement.dataset.fluidBasisPhaseChartEvents === VERSION) return;
    document.documentElement.dataset.fluidBasisPhaseChartEvents = VERSION;
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (target?.matches?.("#fluid-task-temp, input[data-node='FLUID'][data-key='temp'], input[data-key='pressure'][data-node], select[data-key='pressureInputBasis'][data-node]")) {
        scheduleRefresh(target.closest(".task-window, #taskWindow") || document, 40);
      }
    }, true);
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (target?.matches?.("#fluid-task-temp, input[data-node='FLUID'][data-key='temp'], input[data-key='pressure'][data-node], select[data-key='pressureInputBasis'][data-node]")) {
        scheduleRefresh(target.closest(".task-window, #taskWindow") || document, 20);
      }
    }, true);
    [
      "npsh:calculation-current",
      "npsh:realtime-autosolve-complete",
      "npsh:linked-views-refreshed",
      "npsh:dependency-changed"
    ].forEach((eventName) => document.addEventListener(eventName, () => scheduleRefresh(document, 40), true));
  }

  function installObserver() {
    if (observer || typeof MutationObserver === "undefined" || typeof document === "undefined") return;
    observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => Array.from(mutation.addedNodes || []).some((node) => (
        node?.nodeType === 1 && (
          node.matches?.("#taskWindow, .task-window, .fluid-basis-task")
          || node.querySelector?.("#taskWindow, .task-window, .fluid-basis-task, #fluid-task-temp, input[data-node='FLUID'][data-key='temp']")
        )
      )))) {
        scheduleRefresh(document, 20);
      }
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }

  function install() {
    if (typeof document === "undefined") return false;
    installStyles();
    installEvents();
    installObserver();
    ["openFluidBasis", "renderSidebar", "updateSimulation", "applySimulationState", "applySimulationStateAtomic"].forEach(patchFunction);
    refresh(document);
    return true;
  }

  function startInstallLoop() {
    installAttempts += 1;
    install();
    if (installAttempts < 32 && typeof root.setTimeout === "function") {
      root.setTimeout(startInstallLoop, installAttempts < 10 ? 250 : 1000);
    }
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    install,
    refresh,
    buildCalculation,
    saturationPressureBar,
    saturationVisualPoint,
    readSourceAbsPressureBar,
    readFluidTemperature,
    readFluidSaturationPressure
  };

  root.EngineeringFluidBasisPhaseChartRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startInstallLoop, { once: true });
    else startInstallLoop();
  }
}("undefined" !== typeof window ? window : globalThis);
