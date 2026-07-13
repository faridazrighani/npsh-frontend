!function registerEngineeringFluidBasisPhaseChartRuntime(root) {
  "use strict";

  const VERSION = "2026.07-fluid-basis-phase-chart5-water-only";
  const CACHE_KEY = "20260712-fluid-phase-chart-water-only1";
  const STYLE_ID = "engineering-fluid-basis-phase-chart-style";
  const PANEL_SELECTOR = "[data-fluid-basis-phase-chart-panel='true']";
  const FLUID_NAME_SELECTOR = "#fluidNameSelect, select[data-fluid-control='fluidName'], select[data-node='FLUID'][data-key='fluidName']";
  const SVG_NS = "http://www.w3.org/2000/svg";
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
    pMax: 260
  };

  const WATER_R_KJ_KG_K = 0.461526;
  const CRITICAL_TEMPERATURE_K = 647.096;
  const CRITICAL_VOLUME_M3_KG = 1 / 322.0;

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

  const region1I = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 8, 8, 21, 23, 29, 30, 31, 32];
  const region1J = [-2, -1, 0, 1, 2, 3, 4, 5, -9, -7, -1, 0, 1, 3, -3, 0, 1, 3, 17, -4, 0, 6, -5, -2, 10, -8, -11, -6, -29, -31, -38, -39, -40, -41];
  const region1N = [
    0.14632971213167,
    -0.84548187169114,
    -3.7563603672040,
    3.3855169168385,
    -0.95791963387872,
    0.15772038513228,
    -0.016616417199501,
    0.00081214629983568,
    0.00028319080123804,
    -0.00060706301565874,
    -0.018990068218419,
    -0.032529748770505,
    -0.021841717175414,
    -0.000052838357969930,
    -0.00047184321073267,
    -0.00030001780793026,
    0.000047661393906987,
    -0.0000044141845330846,
    -7.2694996297594e-16,
    -0.000031679644845054,
    -0.0000028270797985312,
    -8.5205128120103e-10,
    -2.2425281908000e-6,
    -6.5171222895601e-7,
    -1.4341729937924e-13,
    -4.0516996860117e-7,
    -1.2734301741641e-9,
    -1.7424871230634e-10,
    -6.8762131295536e-19,
    1.4478307828521e-20,
    2.6335781662795e-23,
    -1.1947622640071e-23,
    1.8228094581404e-24,
    -9.3537087292458e-26
  ];

  const region2J0 = [0, 1, -5, -4, -3, -2, -1, 2, 3];
  const region2N0 = [
    -9.6927686500217,
    10.086655968018,
    -0.0056087911283020,
    0.071452738081455,
    -0.40710498223928,
    1.4240819171444,
    -4.3839511319450,
    -0.28408632460772,
    0.021268463753307
  ];
  const region2I = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 6, 6, 6, 7, 7, 7, 8, 8, 9, 10, 10, 10, 16, 16, 18, 20, 20, 20, 21, 22, 23, 24, 24, 24];
  const region2J = [0, 1, 2, 3, 6, 1, 2, 4, 7, 36, 0, 1, 3, 6, 35, 1, 2, 3, 7, 3, 16, 35, 0, 11, 25, 8, 36, 13, 4, 10, 14, 29, 50, 57, 20, 35, 48, 21, 53, 39, 26, 40, 58];
  const region2N = [
    -0.0017731742473213,
    -0.017834862292358,
    -0.045996013696365,
    -0.057581259083432,
    -0.050325278727930,
    -0.000033032641670203,
    -0.00018948987516315,
    -0.0039392777243355,
    -0.043797295650573,
    -0.000026674547914087,
    2.0481737692309e-8,
    4.3870667284435e-7,
    -0.000032277677238570,
    -0.0015033924542148,
    -0.040668253562649,
    -7.8847309559367e-10,
    1.2790717852285e-8,
    4.8225372718507e-7,
    2.2922076337661e-6,
    -1.6714766451061e-11,
    -0.0021171472321355,
    -23.895741934104,
    -5.905956432427e-18,
    -1.2621808899101e-6,
    -0.038946842435739,
    1.1256211360459e-11,
    -8.2311340897998,
    1.9809712802088e-8,
    1.0406965210174e-19,
    -1.0234747095929e-13,
    -1.0018179379511e-9,
    -8.0882908646985e-11,
    0.10693031879409,
    -0.33662250574171,
    8.9185845424773e-25,
    3.0629316876232e-13,
    -4.2002467698208e-6,
    -5.9056029685639e-26,
    3.7826947613457e-6,
    -1.2768608934681e-15,
    7.3087610595061e-29,
    5.5414715350778e-17,
    -9.4369707241210e-7
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function readFluidName(model = runtimeModel(), scope = null) {
    if (typeof document !== "undefined") {
      const host = scope?.querySelector ? scope : document;
      const activeInput = host.querySelector(FLUID_NAME_SELECTOR)
        || (host !== document ? document.querySelector(FLUID_NAME_SELECTOR) : null);
      const fromInput = normalizeText(activeInput?.value || activeInput?.selectedOptions?.[0]?.textContent);
      if (fromInput) return fromInput;
    }
    return normalizeText(model?.FLUID?.props?.fluidName || model?.FLUID?.name || "Water");
  }

  function isWaterFluid(fluidName) {
    return normalizeText(fluidName).toLowerCase() === "water";
  }

  function shouldDisplayPhaseChart(model = runtimeModel(), scope = null) {
    return isWaterFluid(readFluidName(model, scope));
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

  function readFluidChartPressure(model = runtimeModel(), temperatureC = readFluidTemperature(model)) {
    const vaporPressure = readFluidSaturationPressure(model, temperatureC);
    return {
      value: vaporPressure.value,
      sourceId: "FLUID",
      source: vaporPressure.source
    };
  }

  function assertFinite(value, label) {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} is outside the numerical range of the water property function.`);
    }
    return value;
  }

  function psatMPaFromT(temperatureK) {
    if (temperatureK < 273.15 || temperatureK > CRITICAL_TEMPERATURE_K) {
      throw new Error("Saturation pressure is valid only from 0 deg C to the water critical point.");
    }
    const n = region4N;
    const theta = temperatureK + n[8] / (temperatureK - n[9]);
    const A = theta * theta + n[0] * theta + n[1];
    const B = n[2] * theta * theta + n[3] * theta + n[4];
    const C = n[5] * theta * theta + n[6] * theta + n[7];
    const discriminant = B * B - 4 * A * C;
    const pressureMPa = Math.pow((2 * C) / (-B + Math.sqrt(discriminant)), 4);
    return assertFinite(pressureMPa, "P_sat");
  }

  function region1Liquid(pressureMPa, temperatureK) {
    const pi = pressureMPa / 16.53;
    const tau = 1386.0 / temperatureK;
    let gammaTau = 0;
    let gammaPi = 0;

    for (let index = 0; index < region1N.length; index += 1) {
      const I = region1I[index];
      const J = region1J[index];
      const n = region1N[index];
      const a = Math.pow(7.1 - pi, I);
      const b = Math.pow(tau - 1.222, J);
      gammaTau += n * a * J * Math.pow(tau - 1.222, J - 1);
      if (I !== 0) {
        gammaPi += -n * I * Math.pow(7.1 - pi, I - 1) * b;
      }
    }

    const h = WATER_R_KJ_KG_K * temperatureK * tau * gammaTau;
    const v = WATER_R_KJ_KG_K * temperatureK * pi * gammaPi / (pressureMPa * 1000);
    return {
      h: assertFinite(h, "liquid enthalpy"),
      v: assertFinite(v, "liquid specific volume"),
      rho: assertFinite(1 / v, "liquid density")
    };
  }

  function region2Vapor(pressureMPa, temperatureK) {
    const pi = pressureMPa;
    const tau = 540.0 / temperatureK;
    let gamma0Tau = 0;
    let gammarTau = 0;
    let gammarPi = 0;

    for (let index = 0; index < region2N0.length; index += 1) {
      const J = region2J0[index];
      const n = region2N0[index];
      gamma0Tau += n * J * Math.pow(tau, J - 1);
    }

    for (let index = 0; index < region2N.length; index += 1) {
      const I = region2I[index];
      const J = region2J[index];
      const n = region2N[index];
      const tauTerm = Math.pow(tau - 0.5, J);
      gammarTau += n * Math.pow(pi, I) * J * Math.pow(tau - 0.5, J - 1);
      if (I !== 0) {
        gammarPi += n * I * Math.pow(pi, I - 1) * tauTerm;
      }
    }

    const h = WATER_R_KJ_KG_K * temperatureK * tau * (gamma0Tau + gammarTau);
    const v = WATER_R_KJ_KG_K * temperatureK * pi * ((1 / pi) + gammarPi) / (pressureMPa * 1000);
    return {
      h: assertFinite(h, "vapor enthalpy"),
      v: assertFinite(v, "vapor specific volume"),
      rho: assertFinite(1 / v, "vapor density")
    };
  }

  function criticalInterpolation(temperatureC) {
    const baseC = 350;
    const baseK = baseC + 273.15;
    const baseP = psatMPaFromT(baseK);
    const liquid350 = region1Liquid(baseP, baseK);
    const vapor350 = region2Vapor(baseP, baseK);
    const s = clamp((temperatureC - baseC) / (CRITICAL_TEMPERATURE_C - baseC), 0, 1);
    const pMPa = psatMPaFromT(temperatureC + 273.15);
    const hf = liquid350.h + (CRITICAL_ENTHALPY_KJ_KG - liquid350.h) * Math.pow(s, 0.62);
    const hg = CRITICAL_ENTHALPY_KJ_KG + (vapor350.h - CRITICAL_ENTHALPY_KJ_KG) * Math.pow(1 - s, 0.68);
    const vf = liquid350.v + (CRITICAL_VOLUME_M3_KG - liquid350.v) * Math.pow(s, 0.72);
    const vg = CRITICAL_VOLUME_M3_KG + (vapor350.v - CRITICAL_VOLUME_M3_KG) * Math.pow(1 - s, 0.72);
    return {
      temperatureC,
      P_bar: pMPa * 10,
      hf,
      hg,
      hfg: Math.max(0, hg - hf),
      vf,
      vg,
      approximate: true
    };
  }

  function saturationPropsFromTC(temperatureC) {
    const boundedC = clamp(finiteNumber(temperatureC, 25), 0.01, CRITICAL_TEMPERATURE_C);
    if (boundedC > 350) return criticalInterpolation(boundedC);
    const temperatureK = boundedC + 273.15;
    const pressureMPa = psatMPaFromT(temperatureK);
    const liquid = region1Liquid(pressureMPa, temperatureK);
    const vapor = region2Vapor(pressureMPa, temperatureK);
    return {
      temperatureC: boundedC,
      P_bar: pressureMPa * 10,
      hf: liquid.h,
      hg: vapor.h,
      hfg: vapor.h - liquid.h,
      vf: liquid.v,
      vg: vapor.v,
      approximate: false
    };
  }

  function saturationPressureBar(temperatureC) {
    const boundedC = clamp(finiteNumber(temperatureC, 25), 0, CRITICAL_TEMPERATURE_C);
    const temperatureK = boundedC + 273.15;
    const pressureMPa = psatMPaFromT(temperatureK);
    return pressureMPa * 10;
  }

  function saturationVisualPoint(temperatureC) {
    return saturationPropsFromTC(temperatureC);
  }

  function saturationCurve() {
    if (cachedSaturationCurve) return cachedSaturationCurve;
    const points = [];
    [
      [0.01, 100, 2.5],
      [102.5, 250, 5],
      [255, 350, 2.5],
      [352, 373.5, 1]
    ].forEach(([start, end, step]) => {
      for (let t = start; t <= end + 1e-9; t += step) {
        try {
          points.push(saturationVisualPoint(Number(t.toFixed(4))));
        } catch (error) {
          // Ignore points outside the chart range.
        }
      }
    });
    if (!points.some((point) => Math.abs(point.temperatureC - CRITICAL_TEMPERATURE_C) < 0.001)) {
      points.push(saturationVisualPoint(CRITICAL_TEMPERATURE_C));
    }
    cachedSaturationCurve = points;
    return points;
  }

  function buildCalculation(model = runtimeModel()) {
    const temperatureC = readFluidTemperature(model);
    const pAbs = readFluidChartPressure(model, temperatureC);
    const psat = readFluidSaturationPressure(model, temperatureC);
    const satVisual = saturationVisualPoint(temperatureC);
    const deltaP = pAbs.value - psat.value;
    const toleranceBar = Math.max(0.001, Math.abs(psat.value) * 0.005);
    let statusTitle = "Saturated boundary";
    let statusTone = "warning";
    if (temperatureC > 350) {
      statusTitle = "Near-critical chart range";
      statusTone = "warning";
    }
    if (deltaP < -toleranceBar) {
      statusTitle = "Not stable as single-phase liquid";
      statusTone = "danger";
    } else if (deltaP > toleranceBar) {
      statusTitle = "Compressed / subcooled liquid";
      statusTone = "safe";
    } else if (Math.abs(deltaP) <= toleranceBar) {
      statusTitle = "Saturated boundary";
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

  function logSpace(minValue, maxValue, count) {
    const safeMin = Math.max(Math.min(minValue, maxValue), 1e-8);
    const safeMax = Math.max(Math.max(minValue, maxValue), safeMin * 1.0001);
    const minLog = Math.log10(safeMin);
    const maxLog = Math.log10(safeMax);
    return Array.from({ length: count }, (_, index) => {
      const ratio = count === 1 ? 0 : index / (count - 1);
      return Math.pow(10, minLog + ratio * (maxLog - minLog));
    });
  }

  function pathFromPixelSegments(points, breakDistance = 190) {
    if (!points.length) return "";
    return points.map((point, index) => {
      if (index === 0) return `M${point.x.toFixed(2)},${point.y.toFixed(2)}`;
      const previous = points[index - 1];
      const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
      const command = distance > breakDistance ? "M" : "L";
      return `${command}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    }).join(" ");
  }

  function b23PressureMPa(temperatureK) {
    return 348.05185628969 - 1.1671859879975 * temperatureK + 0.0010192970039326 * temperatureK * temperatureK;
  }

  function maxRegion2PressureBar(temperatureC) {
    const temperatureK = temperatureC + 273.15;
    if (temperatureK <= CRITICAL_TEMPERATURE_K) return null;
    if (temperatureK >= 623.15 && temperatureK <= 863.15) {
      return Math.max(plot.pMin * 1.1, Math.min(plot.pMax, b23PressureMPa(temperatureK) * 10 * 0.985));
    }
    return plot.pMax;
  }

  function safeRegion1Point(pBar, temperatureC) {
    try {
      const point = region1Liquid(pBar / 10, temperatureC + 273.15);
      if (!Number.isFinite(point.h) || !Number.isFinite(point.v)) return null;
      return {
        h: point.h,
        v: point.v,
        pBar,
        x: xScale(point.h),
        y: yScale(pBar),
        phase: "liquid"
      };
    } catch (error) {
      return null;
    }
  }

  function safeRegion2Point(pBar, temperatureC) {
    try {
      const point = region2Vapor(pBar / 10, temperatureC + 273.15);
      if (!Number.isFinite(point.h) || !Number.isFinite(point.v)) return null;
      return {
        h: point.h,
        v: point.v,
        pBar,
        x: xScale(point.h),
        y: yScale(pBar),
        phase: "vapor"
      };
    } catch (error) {
      return null;
    }
  }

  function buildIsothermPixels(temperatureC) {
    const points = [];
    if (temperatureC <= 350) {
      const sat = saturationPropsFromTC(temperatureC);
      const liquidStart = Math.min(plot.pMax, Math.max(sat.P_bar * 1.002, plot.pMin * 1.01));
      if (liquidStart < plot.pMax) {
        logSpace(liquidStart, plot.pMax, 34).reverse().forEach((pBar) => {
          const state = safeRegion1Point(pBar, temperatureC);
          if (state) points.push(state);
        });
      }

      for (let index = 0; index <= 32; index += 1) {
        const quality = index / 32;
        const h = sat.hf + quality * (sat.hg - sat.hf);
        points.push({
          h,
          v: sat.vf + quality * (sat.vg - sat.vf),
          pBar: sat.P_bar,
          quality,
          x: xScale(h),
          y: yScale(sat.P_bar),
          phase: "two-phase"
        });
      }

      const vaporEnd = Math.max(plot.pMin, sat.P_bar * 0.998);
      if (plot.pMin < vaporEnd) {
        logSpace(plot.pMin, vaporEnd, 42).reverse().forEach((pBar) => {
          const state = safeRegion2Point(pBar, temperatureC);
          if (state) points.push(state);
        });
      }

      return points.filter((point) => point.h >= plot.hMin - 80 && point.h <= plot.hMax + 80);
    }

    const pMaxRegion = maxRegion2PressureBar(temperatureC);
    if (!pMaxRegion || pMaxRegion <= plot.pMin) return [];
    logSpace(plot.pMin, pMaxRegion, 66).reverse().forEach((pBar) => {
      const state = safeRegion2Point(pBar, temperatureC);
      if (state) points.push(state);
    });
    return points.filter((point) => point.h >= plot.hMin - 80 && point.h <= plot.hMax + 120);
  }

  function nearestCurvePointByTemperature(targetC) {
    return saturationCurve().reduce((best, point) => {
      if (!best) return point;
      return Math.abs(point.temperatureC - targetC) < Math.abs(best.temperatureC - targetC) ? point : best;
    }, null);
  }

  function drawTemperatureGuides(group) {
    [50, 100, 150, 200, 250, 300].forEach((temperature) => {
      const pixels = buildIsothermPixels(temperature);
      if (pixels.length < 2) return;
      group.appendChild(svgEl("path", {
        d: pathFromPixelSegments(pixels, 190),
        fill: "none",
        stroke: "#109618",
        "stroke-width": 0.85,
        opacity: 0.96
      }));
      const sat = nearestCurvePointByTemperature(temperature);
      const labelX = sat ? xScale(sat.hf + 0.15 * (sat.hg - sat.hf)) : pixels[Math.round(pixels.length * 0.25)].x;
      const labelY = sat ? yScale(sat.P_bar) - 7 : pixels[Math.round(pixels.length * 0.25)].y - 7;
      group.appendChild(svgEl("text", {
        x: labelX,
        y: labelY,
        fill: "#109618",
        "font-size": temperature === 50 ? 12 : 11.5,
        "font-style": "italic",
        "font-weight": temperature === 50 ? 700 : 500,
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
    drawTextBadge(overlay, right - 10, actualLabelY, `P_vap = ${fmt(calc.actualPressureBar, 4)} bar A`, {
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
    overlay.appendChild(svgEl("text", { x: boxX + 12, y: boxY + 24, fill: "#ffffff", "font-size": 11.5, "font-weight": 700 }, `h marker ~= ${fmt(calc.hMarker, 2)} kJ/kg; P_vap = ${fmt(calc.actualPressureBar, 4)} bar A`));
    svg.appendChild(overlay);
  }

  function serializeSvg(svg) {
    if (!svg) return "";
    if (typeof XMLSerializer !== "undefined") {
      return new XMLSerializer().serializeToString(svg);
    }
    return svg.outerHTML || "";
  }

  function buildExportMarkup(model = runtimeModel()) {
    if (!shouldDisplayPhaseChart(model)) return "";
    const calc = buildCalculation(model);
    let svgMarkup = "";
    if (typeof document !== "undefined") {
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "fluid-basis-phase-chart-svg");
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Water pressure enthalpy phase chart");
      drawDiagram(svg, calc);
      svgMarkup = serializeSvg(svg);
    }
    return `
      <section class="eqp-fluid-phase-chart-figure" data-export-note="pressure-enthalpy-phase-chart">
        <h3>Pressure-enthalpy phase chart</h3>
        <div class="fluid-basis-phase-chart-meta">
          <div>Temperature<strong>${escapeHtml(`${fmt(calc.temperatureC, 3)} deg C`)}</strong></div>
          <div>Fluid Basis Vapor Pressure<strong>${escapeHtml(`${fmt(calc.actualPressureBar, 4)} bar A`)}</strong></div>
          <div>Phase Status<strong>${escapeHtml(calc.statusTitle)}</strong></div>
        </div>
        <div class="fluid-basis-phase-chart-wrap">
          ${svgMarkup || `<p class="eqp-fluid-phase-chart-fallback">Pressure-enthalpy chart rendering is unavailable in this export context.</p>`}
        </div>
        <div class="fluid-basis-phase-chart-legend" aria-hidden="true">
          <span><i class="legend-liquid"></i>Saturated liquid</span>
          <span><i class="legend-vapor"></i>Saturated vapor</span>
          <span><i class="legend-quality"></i>Quality lines</span>
          <span><i class="legend-temperature"></i>Temperature curves</span>
          <span><i class="legend-point"></i>Evaluated point</span>
        </div>
        <p class="eqp-fluid-phase-chart-caption">The P-h chart visualizes whether the selected process fluid is in the liquid, mixed-phase, or vapor region before it flows through the pumping system.</p>
      </section>`;
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
        <div>Fluid Basis Vapor Pressure<strong data-fluid-phase-pressure>-</strong></div>
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

  function removePanel(windowNode) {
    const panels = Array.from(windowNode?.querySelectorAll?.(PANEL_SELECTOR) || []);
    panels.forEach((panel) => panel.remove());
    return panels.length;
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
      `Pressure source: ${calc.actualPressureSource}`,
      `P_sat source: ${calc.psatSource}`
    ].join("\n");
    drawDiagram(panel.querySelector("[data-fluid-phase-chart-svg]"), calc);
    return calc;
  }

  function refresh(rootNode = document) {
    if (typeof document === "undefined") return 0;
    installStyles();
    let count = 0;
    let windowCount = 0;
    const model = runtimeModel();
    fluidBasisWindows(rootNode).forEach((windowNode) => {
      windowCount += 1;
      if (!shouldDisplayPhaseChart(model, windowNode)) {
        removePanel(windowNode);
        windowNode.dataset.fluidBasisPhaseChartVisibility = "hidden-non-water";
        return;
      }
      const panel = ensurePanel(windowNode);
      if (panel) {
        updatePanel(panel);
        windowNode.dataset.fluidBasisPhaseChartVisibility = "visible-water";
        count += 1;
      }
    });
    document.documentElement.dataset.fluidBasisPhaseChartRuntime = VERSION;
    document.documentElement.dataset.fluidBasisPhaseChartVisibility = windowCount === 0
      ? "idle"
      : count > 0 ? "visible-water" : "hidden-non-water";
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
      if (target?.matches?.(`#fluid-task-temp, input[data-node='FLUID'][data-key='temp'], input[data-node='FLUID'][data-key='vaporPressure'], ${FLUID_NAME_SELECTOR}`)) {
        scheduleRefresh(target.closest(".task-window, #taskWindow") || document, 40);
      }
    }, true);
    document.addEventListener("change", (event) => {
      const target = event.target;
      if (target?.matches?.(FLUID_NAME_SELECTOR)) {
        const windowNode = target.closest(".task-window, #taskWindow");
        if (windowNode && !isWaterFluid(target.value)) {
          removePanel(windowNode);
          windowNode.dataset.fluidBasisPhaseChartVisibility = "hidden-non-water";
        }
      }
      if (target?.matches?.(`#fluid-task-temp, input[data-node='FLUID'][data-key='temp'], input[data-node='FLUID'][data-key='vaporPressure'], ${FLUID_NAME_SELECTOR}`)) {
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
          || node.querySelector?.(`#taskWindow, .task-window, .fluid-basis-task, #fluid-task-temp, input[data-node='FLUID'][data-key='temp'], ${FLUID_NAME_SELECTOR}`)
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
    readFluidName,
    isWaterFluid,
    shouldDisplayPhaseChart,
    saturationPressureBar,
    saturationVisualPoint,
    saturationPropsFromTC,
    buildIsothermPixels,
    readFluidChartPressure,
    readFluidTemperature,
    readFluidSaturationPressure,
    drawDiagram,
    buildExportMarkup
  };

  root.EngineeringFluidBasisPhaseChartRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startInstallLoop, { once: true });
    else startInstallLoop();
  }
}("undefined" !== typeof window ? window : globalThis);
