(function () {
    'use strict';

    const WATER_REFERENCE_DENSITY_KGM3 = 999.972;
    const GRAVITY_MS2 = 9.81;
    const SOURCE_TEMP_MODE_FLUID_BASIS = 'Use Fluid Basis';
    const SOURCE_CUSTOM_TEMPERATURE_UI_ENABLED = window.NPSH_ENABLE_SRC_CUSTOM_TEMPERATURE === true;

    function toFiniteNumber(value, fallback) {
        const number = Number.parseFloat(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function isCustomTemperatureMode(value) {
        return String(value || '').trim().toLowerCase() === 'custom';
    }

    function isWaterFluid(fluidBasis) {
        const fluidName = String(fluidBasis?.fluidName || fluidBasis?.name || '').trim().toLowerCase();
        return fluidName === 'water' || fluidName === 'air';
    }

    function isWaterPropertyCorrelationFluid(fluidBasis) {
        const fluidName = String(fluidBasis?.fluidName || fluidBasis?.name || '').trim().toLowerCase();
        return fluidName === 'water';
    }

    function sumRange(start, end, term) {
        let total = 0;
        for (let index = start; index < end; index += 1) total += term(index);
        return total;
    }

    function calculateRuntimeWaterVaporPressureBar(temperatureK) {
        const criticalTemperature = 647.096;
        const boundedTemperature = Math.min(Math.max(temperatureK, 273.16), criticalTemperature);
        const theta = 1 - boundedTemperature / criticalTemperature;
        const exponent = criticalTemperature / temperatureK * (
            -7.85951783 * theta
            + 1.84408259 * Math.pow(theta, 1.5)
            - 11.7866497 * Math.pow(theta, 3)
            + 22.6807411 * Math.pow(theta, 3.5)
            - 15.9618719 * Math.pow(theta, 4)
            + 1.80122502 * Math.pow(theta, 7.5)
        );
        return 22.064 * Math.exp(exponent) * 10;
    }

    function calculateRuntimeLiquidWaterAt01MPa(temperatureK) {
        const gasConstant = 0.46151805;
        const theta = temperatureK / 10;
        const tauLow = 10 / (593 - temperatureK);
        const tauHigh = 10 / (temperatureK - 232);
        const reducedTemperature = temperatureK / 300;
        const a = [
            null, -166147.0539, 2708781.64, -155719154.4, null, 0.0193763157,
            6744.58446, -222521.604, 100231247, -1635521180, 8322996580,
            -75245878e-13, -0.013767418, 10.627293, -204.57795, 1203.7414
        ];
        const b = [
            null, -0.8237426256, 1.908956353, -2.017597384, 0.8546361348,
            0.00578545292, -0.0153195665, 0.0311337859, -0.0423546241,
            0.0338713507, -0.0119946761, -3109147e-12, 28964919e-12,
            -0.00013112763, 0.00030410453, -0.00039034594, 0.00023403117,
            -48510101e-12
        ];
        const l = [null, 4, 5, 7, null, null, 4, 5, 7, 8, 9, 1, 3, 5, 6, 7];
        const u = [null, 2, 3, 4, 5, 1, 2, 3, 4, 5, 6, 1, 3, 4, 5, 6, 7, 9];
        const specificVolume = 0.046151805 * (
            a[5]
            + sumRange(6, 11, (index) => a[index] * Math.pow(tauLow, l[index]))
            + sumRange(5, 11, (index) => b[index] * Math.pow(tauHigh, u[index]))
        );
        const pressureDerivative = 10 * gasConstant / Math.pow(0.1, 2) / 1000 * (
            sumRange(11, 16, (index) => a[index] * Math.pow(tauLow, l[index]))
            + sumRange(11, 18, (index) => b[index] * Math.pow(tauHigh, u[index]))
        );
        const specificHeat = -gasConstant * (
            theta * sumRange(1, 4, (index) => l[index] * (l[index] + 1) * a[index] * Math.pow(tauLow, l[index] + 2))
            - 8.983025854
            + theta * sumRange(1, 5, (index) => u[index] * (u[index] + 1) * b[index] * Math.pow(tauHigh, u[index] + 2))
        );
        const temperatureDerivative = gasConstant / 0.1 / 1000 * (
            sumRange(6, 11, (index) => l[index] * a[index] * Math.pow(tauLow, l[index] + 1))
            - sumRange(5, 11, (index) => u[index] * b[index] * Math.pow(tauHigh, u[index] + 1))
        );
        const density = 1 / specificVolume;
        return {
            density,
            specificHeat,
            speedOfSound: Math.sqrt(1e9 * -Math.pow(specificVolume, 2) / (1000 * pressureDerivative + temperatureK * Math.pow(temperatureDerivative, 2) * 1e6 / specificHeat)),
            dynamicViscosityPaS: (
                280.68 * Math.pow(reducedTemperature, -1.9)
                + 511.45 * Math.pow(reducedTemperature, -7.7)
                + 61.131 * Math.pow(reducedTemperature, -19.6)
                + 0.45903 * Math.pow(reducedTemperature, -40)
            ) / 1e6,
            thermalConductivity: (
                1.663 * Math.pow(reducedTemperature, -1.15)
                - 1.7781 * Math.pow(reducedTemperature, -3.4)
                + 1.1567 * Math.pow(reducedTemperature, -6)
                - 0.432115 * Math.pow(reducedTemperature, -7.6)
            ),
            dielectricConstant: (
                -43.7527 * Math.pow(reducedTemperature, -0.05)
                + 299.504 * Math.pow(reducedTemperature, -1.47)
                - 399.364 * Math.pow(reducedTemperature, -2.11)
                + 221.327 * Math.pow(reducedTemperature, -2.31)
            )
        };
    }

    function calculateRuntimeWaterProperties(tempC) {
        if (typeof window.calculateIapwsWaterProperties === 'function') {
            return window.calculateIapwsWaterProperties(tempC);
        }
        const temperatureK = Math.min(110, Math.max(-20, toFiniteNumber(tempC, 25))) + 273.15;
        const liquid = calculateRuntimeLiquidWaterAt01MPa(temperatureK);
        const vaporPressure = calculateRuntimeWaterVaporPressureBar(temperatureK);
        const dynamicViscosity = 1000 * liquid.dynamicViscosityPaS;
        return {
            density: liquid.density,
            vaporPressure,
            dynamicViscosity,
            kinematicViscosity: dynamicViscosity / (liquid.density / 1000),
            specificHeat: liquid.specificHeat,
            bulkModulus: liquid.density * Math.pow(liquid.speedOfSound, 2) / 1e9,
            thermalConductivity: liquid.thermalConductivity,
            dielectricConstant: liquid.dielectricConstant
        };
    }

    function applyExtendedProperties(fluid) {
        const density = toFiniteNumber(fluid.density, NaN);
        const kinematicViscosity = toFiniteNumber(fluid.viscosity ?? fluid.kinematicViscosity, NaN);
        const dynamicViscosity = toFiniteNumber(fluid.dynViscosity ?? fluid.dynamicViscosity, NaN);
        const vaporPressure = toFiniteNumber(fluid.vaporPressure, NaN);
        if (density > 0) {
            if (!Number.isFinite(dynamicViscosity) && Number.isFinite(kinematicViscosity)) {
                fluid.dynViscosity = kinematicViscosity * (density / 1000);
                fluid.dynamicViscosity = fluid.dynViscosity;
            } else if (Number.isFinite(dynamicViscosity)) {
                fluid.dynViscosity = dynamicViscosity;
                fluid.dynamicViscosity = dynamicViscosity;
            }
            fluid.sg = density / WATER_REFERENCE_DENSITY_KGM3;
            fluid.specVolume = 1 / density;
            fluid.specWeight = density * GRAVITY_MS2;
            fluid.vaporPressureHead = Number.isFinite(vaporPressure) && vaporPressure >= 0
                ? 1e5 * vaporPressure / (density * GRAVITY_MS2)
                : null;
            const bulkModulus = toFiniteNumber(fluid.bulkModulus, NaN);
            fluid.speedOfSound = Number.isFinite(bulkModulus)
                ? Math.sqrt((bulkModulus * 1e9) / density)
                : fluid.speedOfSound ?? null;
        }
        return fluid;
    }

    function applyWaterCorrelationProperties(target, water, temp, sourceLabel) {
        target.fluidName = target.fluidName || 'Water';
        target.temp = temp;
        target.density = water.density;
        target.sg = water.density / WATER_REFERENCE_DENSITY_KGM3;
        target.vaporPressure = water.vaporPressure;
        target.dynViscosity = water.dynamicViscosity;
        target.dynamicViscosity = water.dynamicViscosity;
        target.viscosity = water.kinematicViscosity;
        target.kinematicViscosity = water.kinematicViscosity;
        target.specificHeat = water.specificHeat;
        target.bulkModulus = water.bulkModulus;
        target.thermalConductivity = water.thermalConductivity;
        target.dielectricConstant = water.dielectricConstant;
        target.propertyMethod = `IAPWS-based water property correlation at ${sourceLabel}`;
        target.sourceTemperatureBasis = sourceLabel;
        return applyExtendedProperties(target);
    }

    function getTemperatureResolvedFluidBasisProps(fluidBasis) {
        const base = { ...(fluidBasis || window.globalModel?.FLUID?.props || {}) };
        const temp = toFiniteNumber(base.temp, NaN);
        if (!Number.isFinite(temp) || !isWaterPropertyCorrelationFluid(base)) {
            return applyExtendedProperties(base);
        }
        const propertyMethod = String(base.propertyMethod || base.fluidPropertySource || '');
        const syncRequested = base.temperaturePropertySyncRequested === true
            || base.temperaturePropertySynced === true
            || /fluid basis temperature correlation/i.test(propertyMethod);
        if (/journal|validation basis/i.test(propertyMethod) && !syncRequested) {
            return applyExtendedProperties(base);
        }
        const resolved = applyWaterCorrelationProperties(base, calculateRuntimeWaterProperties(temp), temp, 'Fluid Basis temperature');
        resolved.fluidPropertySource = 'Fluid Basis temperature correlation';
        resolved.temperaturePropertySynced = true;
        return resolved;
    }

    function syncFluidBasisPropertiesFromTemperature(fluidOrProps) {
        const props = fluidOrProps?.props || fluidOrProps;
        if (!props || typeof props !== 'object') return null;
        const resolved = getTemperatureResolvedFluidBasisProps(props);
        if (!resolved.temperaturePropertySynced) return null;
        Object.assign(props, resolved);
        return resolved;
    }

    function getFluidPropsAtSourceTemperature(source, fluidBasis) {
        const base = getTemperatureResolvedFluidBasisProps(fluidBasis || window.globalModel?.FLUID?.props || {});
        const sourceProps = source?.props || {};
        const baseTemperature = toFiniteNumber(base.temp, 25);
        const customTemperature = toFiniteNumber(sourceProps.temp, baseTemperature);
        const useCustomTemperature = SOURCE_CUSTOM_TEMPERATURE_UI_ENABLED && isCustomTemperatureMode(sourceProps.temperatureMode);
        const effective = {
            ...base,
            temp: useCustomTemperature ? customTemperature : baseTemperature,
            temperatureMode: useCustomTemperature ? 'Custom' : SOURCE_TEMP_MODE_FLUID_BASIS,
            warnings: []
        };

        if (!useCustomTemperature) return applyExtendedProperties(effective);

        if (!isWaterFluid(base)) {
            effective.warnings.push('Custom SRC temperature currently recalculates water properties only; using Fluid Basis properties.');
            return applyExtendedProperties(effective);
        }

        return applyWaterCorrelationProperties(
            effective,
            calculateRuntimeWaterProperties(customTemperature),
            customTemperature,
            'SRC custom temperature'
        );
    }

    function formatRuntimeReadout(value, digits = 3) {
        const number = toFiniteNumber(value, NaN);
        if (!Number.isFinite(number)) return '-';
        return number.toFixed(digits);
    }

    function cssEscape(value) {
        if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(String(value || ''));
        return String(value || '').replace(/["\\]/g, '\\$&');
    }

    function installSourceTemperatureStabilityStyles() {
        if (typeof document === 'undefined' || document.getElementById('src-temperature-stability-style')) return;
        const style = document.createElement('style');
        style.id = 'src-temperature-stability-style';
        style.textContent = [
            '.object-task-field-row[data-prop-key="temp"],',
            '.object-task-field-row[data-prop-key="source-fluid-density"],',
            '.object-task-field-row[data-prop-key="source-fluid-viscosity"],',
            '.object-task-field-row[data-prop-key="source-fluid-dynamic-viscosity"],',
            '.object-task-field-row[data-prop-key="source-fluid-specific-weight"],',
            '.object-task-field-row[data-prop-key="source-fluid-vapor-pressure-head"],',
            '.object-task-field-row[data-prop-key="source-fluid-vapor-pressure"]{min-height:34px;overflow-anchor:none}',
            '.object-task-field-row[data-prop-key="source-fluid-density"] .prop-value,',
            '.object-task-field-row[data-prop-key="source-fluid-viscosity"] .prop-value,',
            '.object-task-field-row[data-prop-key="source-fluid-dynamic-viscosity"] .prop-value,',
            '.object-task-field-row[data-prop-key="source-fluid-specific-weight"] .prop-value,',
            '.object-task-field-row[data-prop-key="source-fluid-vapor-pressure-head"] .prop-value,',
            '.object-task-field-row[data-prop-key="source-fluid-vapor-pressure"] .prop-value,',
            '.prop-input-field[data-key="temp"]{font-variant-numeric:tabular-nums;white-space:nowrap}',
            '.object-task-field-row[data-prop-key="temperatureMode"]{display:none!important}',
            '.src-temperature-stability-lock{overflow-anchor:none!important}',
            '.src-temperature-stability-lock .object-task-field-row[data-prop-key="temp"],',
            '.src-temperature-stability-lock .object-task-field-row[data-prop-key="source-fluid-density"],',
            '.src-temperature-stability-lock .object-task-field-row[data-prop-key="source-fluid-viscosity"],',
            '.src-temperature-stability-lock .object-task-field-row[data-prop-key="source-fluid-dynamic-viscosity"],',
            '.src-temperature-stability-lock .object-task-field-row[data-prop-key="source-fluid-specific-weight"],',
            '.src-temperature-stability-lock .object-task-field-row[data-prop-key="source-fluid-vapor-pressure-head"],',
            '.src-temperature-stability-lock .object-task-field-row[data-prop-key="source-fluid-vapor-pressure"]{contain:layout style}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function findSourceTemperaturePanel(input) {
        if (!SOURCE_CUSTOM_TEMPERATURE_UI_ENABLED) return null;
        if (!input?.matches?.('input.prop-input-field[data-key="temp"][data-node]')) return null;
        const panel = input.closest('[role="dialog"], .object-properties-task, .task-window, .canvas-task-window, .task-window-body, body');
        const scope = input.closest('table, tbody, .task-body, .object-properties-body, [role="dialog"]') || panel || document;
        return scope?.querySelector?.('[data-key="source-fluid-density"]') ? panel : null;
    }

    function collectScrollTargets(element) {
        const targets = [];
        let node = element?.parentElement || null;
        while (node && node !== document.body) {
            const style = window.getComputedStyle ? window.getComputedStyle(node) : null;
            const overflowY = style ? `${style.overflowY} ${style.overflow}` : '';
            if ((/auto|scroll/i.test(overflowY) && node.scrollHeight > node.clientHeight) || node.classList?.contains('task-window-body')) {
                targets.push({ element: node, top: node.scrollTop, left: node.scrollLeft });
            }
            node = node.parentElement;
        }
        return targets.slice(0, 4);
    }

    function setReadout(scope, key, value, unit, digits = 3) {
        const element = scope?.querySelector?.(`[data-key="${key}"]`);
        if (!element) return;
        const formatted = formatRuntimeReadout(value, digits);
        element.textContent = formatted === '-' ? '-' : `${formatted} ${unit}`;
        element.dataset.srcTemperaturePreview = 'true';
    }

    function readFluidBasisFromPanel(scope) {
        const nameText = scope?.querySelector?.('[data-key="source-fluid-basis"]')?.textContent || 'Water';
        return {
            fluidName: /water|air/i.test(nameText) ? 'Water' : nameText.trim() || 'Water',
            temp: toFiniteNumber(scope?.querySelector?.('[data-key="source-temperature"]')?.textContent, 25),
            density: toFiniteNumber(scope?.querySelector?.('[data-key="source-fluid-density"]')?.textContent, 997.047),
            viscosity: toFiniteNumber(scope?.querySelector?.('[data-key="source-fluid-viscosity"]')?.textContent, 0.893),
            dynViscosity: toFiniteNumber(scope?.querySelector?.('[data-key="source-fluid-dynamic-viscosity"]')?.textContent, NaN),
            dynamicViscosity: toFiniteNumber(scope?.querySelector?.('[data-key="source-fluid-dynamic-viscosity"]')?.textContent, NaN),
            specWeight: toFiniteNumber(scope?.querySelector?.('[data-key="source-fluid-specific-weight"]')?.textContent, NaN),
            vaporPressure: toFiniteNumber(scope?.querySelector?.('[data-key="source-fluid-vapor-pressure"]')?.textContent, 0.032),
            vaporPressureHead: toFiniteNumber(scope?.querySelector?.('[data-key="source-fluid-vapor-pressure-head"]')?.textContent, NaN)
        };
    }

    function updateSourceTemperaturePreview(input) {
        const scope = input.closest('table, tbody, .task-body, .object-properties-body, [role="dialog"]') || document;
        const source = { props: { temperatureMode: 'Custom', temp: input.value } };
        const fluid = getFluidPropsAtSourceTemperature(source, readFluidBasisFromPanel(scope));
        setReadout(scope, 'source-fluid-density', fluid.density, 'kg/m3', 3);
        setReadout(scope, 'source-fluid-viscosity', fluid.viscosity, 'cSt', 3);
        setReadout(scope, 'source-fluid-dynamic-viscosity', fluid.dynViscosity ?? fluid.dynamicViscosity, 'cP', 3);
        setReadout(scope, 'source-fluid-specific-weight', fluid.specWeight, 'N/m3', 3);
        setReadout(scope, 'source-fluid-vapor-pressure', fluid.vaporPressure, 'bar a', 6);
        setReadout(scope, 'source-fluid-vapor-pressure-head', fluid.vaporPressureHead, 'm', 3);
        const flowInput = scope.querySelector('input[data-key="flow"]');
        const massInput = scope.querySelector('input[data-key="massFlow"]');
        const flowReadout = scope.querySelector('[data-key="source-flow"]');
        const massReadout = scope.querySelector('[data-key="source-mass-flow"]');
        if (flowInput && massReadout) {
            const flow = toFiniteNumber(flowInput.value, NaN);
            if (Number.isFinite(flow)) setReadout(scope, 'source-mass-flow', flow * fluid.density, 'kg/h', 3);
        } else if (massInput && flowReadout) {
            const mass = toFiniteNumber(massInput.value, NaN);
            if (Number.isFinite(mass) && fluid.density > 0) setReadout(scope, 'source-flow', mass / fluid.density, 'm3/h', 3);
        }
    }

    const sourceTemperatureStability = {
        active: null,
        solveTimer: null,
        editHistoryCaptured: false,
        releaseTimer: null,
        mutationObserver: null
    };

    function isSourceTemperatureInput(input) {
        return !!findSourceTemperaturePanel(input);
    }

    function getSourceTemperatureNode(input) {
        const nodeId = input?.dataset?.node || '';
        const node = nodeId && window.globalModel ? window.globalModel[nodeId] : null;
        return node && node.type === 'source' ? { nodeId, node } : null;
    }

    function getEffectiveDensityForSource(node) {
        const fluid = getFluidPropsAtSourceTemperature(node, window.globalModel?.FLUID?.props || {});
        const density = toFiniteNumber(fluid.density, NaN);
        return Number.isFinite(density) && density > 0 ? density : toFiniteNumber(window.globalModel?.FLUID?.props?.density, 1000);
    }

    function syncSourceFlowFromRuntime(node) {
        if (!node?.props) return;
        const mode = String(node.props.flowInputMode || 'Mass Flow');
        if (/solve from network/i.test(mode)) return;
        const density = getEffectiveDensityForSource(node);
        if (/mass flow/i.test(mode)) {
            const massFlow = toFiniteNumber(node.props.massFlow, NaN);
            if (Number.isFinite(massFlow) && density > 0) node.props.flow = massFlow / density;
            return;
        }
        const flow = toFiniteNumber(node.props.flow, NaN);
        if (Number.isFinite(flow) && density > 0) node.props.massFlow = flow * density;
    }

    function applySourceTemperatureInput(input) {
        const source = getSourceTemperatureNode(input);
        if (!source) return false;
        const rawValue = String(input.value || '').trim();
        const number = Number.parseFloat(rawValue);
        source.node.props.temperatureMode = 'Custom';
        source.node.props.temp = Number.isFinite(number) ? number : rawValue;
        syncSourceFlowFromRuntime(source.node);
        updateSourceTemperaturePreview(input);
        return true;
    }

    function scheduleDebouncedSourceTemperatureSolve(input) {
        window.clearTimeout(sourceTemperatureStability.solveTimer);
        const source = getSourceTemperatureNode(input);
        sourceTemperatureStability.solveTimer = window.setTimeout(() => {
            if (!source || !window.globalModel?.[source.nodeId]) return;
            restoreSourceTemperatureStability();
            try {
                if (typeof window.updateSimulation === 'function') {
                    window.updateSimulation({
                        refreshReason: 'solve',
                        trigger: 'source-temperature-debounce',
                        renderSidebarAfter: false
                    });
                }
            } finally {
                window.setTimeout(restoreSourceTemperatureStability, 40);
                window.setTimeout(restoreSourceTemperatureStability, 220);
            }
        }, 420);
    }

    function captureSourceTemperatureHistory(input) {
        if (sourceTemperatureStability.editHistoryCaptured) return;
        if (typeof window.captureState === 'function') {
            window.captureState();
            sourceTemperatureStability.editHistoryCaptured = true;
            input.dataset.historyCaptured = 'true';
        }
    }

    function releaseSourceTemperatureHistory(input) {
        sourceTemperatureStability.editHistoryCaptured = false;
        if (input?.dataset) delete input.dataset.historyCaptured;
    }

    function handleSourceTemperatureInputEvent(event, options = {}) {
        const input = event.target;
        if (!isSourceTemperatureInput(input)) return;
        event.stopImmediatePropagation();
        event.stopPropagation();
        captureSourceTemperatureHistory(input);
        scheduleSourceTemperatureRestore(input);
        applySourceTemperatureInput(input);
        scheduleDebouncedSourceTemperatureSolve(input);
        if (options.finalize) {
            releaseSourceTemperatureHistory(input);
        }
    }

    function captureSourceTemperatureStability(input) {
        const panel = findSourceTemperaturePanel(input);
        if (!panel) return null;
        const rect = panel.getBoundingClientRect ? panel.getBoundingClientRect() : null;
        const active = {
            node: input.dataset.node,
            key: input.dataset.key,
            value: input.value,
            selectionStart: input.selectionStart,
            selectionEnd: input.selectionEnd,
            panel,
            scrollTargets: collectScrollTargets(input),
            minWidth: rect?.width || 0,
            minHeight: rect?.height || 0,
            startedAt: Date.now()
        };
        sourceTemperatureStability.active = active;
        panel.classList.add('src-temperature-stability-lock');
        if (active.minWidth > 0 && !panel.dataset.srcTemperatureOriginalMinWidth) {
            panel.dataset.srcTemperatureOriginalMinWidth = panel.style.minWidth || '';
            panel.style.minWidth = `${Math.ceil(active.minWidth)}px`;
        }
        if (active.minHeight > 0 && !panel.dataset.srcTemperatureOriginalMinHeight) {
            panel.dataset.srcTemperatureOriginalMinHeight = panel.style.minHeight || '';
            panel.style.minHeight = `${Math.ceil(active.minHeight)}px`;
        }
        window.clearTimeout(sourceTemperatureStability.releaseTimer);
        sourceTemperatureStability.releaseTimer = window.setTimeout(releaseSourceTemperatureStability, 1600);
        return active;
    }

    function restoreSourceTemperatureStability() {
        const active = sourceTemperatureStability.active;
        if (!active) return;
        for (const target of active.scrollTargets || []) {
            if (target.element?.isConnected) {
                target.element.scrollTop = target.top;
                target.element.scrollLeft = target.left;
            }
        }
        const selector = `input.prop-input-field[data-node="${cssEscape(active.node)}"][data-key="${cssEscape(active.key)}"]`;
        const input = document.querySelector(selector);
        if (input) {
            input.focus({ preventScroll: true });
            try {
                const start = Math.min(active.selectionStart ?? input.value.length, input.value.length);
                const end = Math.min(active.selectionEnd ?? start, input.value.length);
                input.setSelectionRange(start, end);
            } catch (error) {
                // Some input types do not support selection; focus stability still applies.
            }
        }
    }

    function scheduleSourceTemperatureRestore(input) {
        captureSourceTemperatureStability(input);
        const restore = () => restoreSourceTemperatureStability();
        restore();
        window.requestAnimationFrame?.(restore);
        window.setTimeout(restore, 40);
        window.setTimeout(restore, 140);
        window.setTimeout(restore, 360);
        window.setTimeout(restore, 760);
    }

    function releaseSourceTemperatureStability() {
        const active = sourceTemperatureStability.active;
        if (!active) return;
        const panel = active.panel;
        if (panel?.isConnected) {
            panel.classList.remove('src-temperature-stability-lock');
            if (Object.prototype.hasOwnProperty.call(panel.dataset, 'srcTemperatureOriginalMinWidth')) {
                panel.style.minWidth = panel.dataset.srcTemperatureOriginalMinWidth;
                delete panel.dataset.srcTemperatureOriginalMinWidth;
            }
            if (Object.prototype.hasOwnProperty.call(panel.dataset, 'srcTemperatureOriginalMinHeight')) {
                panel.style.minHeight = panel.dataset.srcTemperatureOriginalMinHeight;
                delete panel.dataset.srcTemperatureOriginalMinHeight;
            }
        }
        sourceTemperatureStability.active = null;
    }

    function installSourceTemperatureStabilityGuard() {
        if (typeof document === 'undefined' || document.documentElement?.dataset.srcTemperatureStabilityGuard === 'true') return;
        document.documentElement.dataset.srcTemperatureStabilityGuard = 'true';
        installSourceTemperatureStabilityStyles();
        document.addEventListener('input', (event) => {
            handleSourceTemperatureInputEvent(event);
        }, true);
        document.addEventListener('change', (event) => {
            handleSourceTemperatureInputEvent(event, { finalize: true });
        }, true);
        document.addEventListener('blur', (event) => {
            const input = event.target;
            if (!isSourceTemperatureInput(input)) return;
            releaseSourceTemperatureHistory(input);
            scheduleDebouncedSourceTemperatureSolve(input);
        }, true);
        if (typeof MutationObserver === 'undefined' || !document.body) return;
        sourceTemperatureStability.mutationObserver = new MutationObserver(() => {
            const active = sourceTemperatureStability.active;
            if (!active || Date.now() - active.startedAt > 1600) return;
            window.requestAnimationFrame?.(restoreSourceTemperatureStability);
        });
        sourceTemperatureStability.mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    function enforceFluidBasisModeInSourceUi(root = document) {
        if (typeof document === 'undefined') return;
        const scope = root?.querySelectorAll ? root : document;
        scope.querySelectorAll('.object-task-field-row[data-prop-key="temperatureMode"]').forEach((row) => {
            row.hidden = true;
            row.setAttribute('aria-hidden', 'true');
            row.style.display = 'none';
        });
        scope.querySelectorAll('select.prop-input-field[data-key="temperatureMode"]').forEach((select) => {
            if (select.value !== SOURCE_TEMP_MODE_FLUID_BASIS) {
                select.value = SOURCE_TEMP_MODE_FLUID_BASIS;
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    function installSourceFluidBasisOnlyUiGuard() {
        if (typeof document === 'undefined' || document.documentElement?.dataset.srcFluidBasisOnlyGuard === 'true') return;
        document.documentElement.dataset.srcFluidBasisOnlyGuard = 'true';
        enforceFluidBasisModeInSourceUi(document);
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes || []) {
                    if (node?.nodeType === 1) enforceFluidBasisModeInSourceUi(node);
                }
            }
            enforceFluidBasisModeInSourceUi(document);
        });
        observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }

    function installFluidBasisTemperatureSyncGuard() {
        if (typeof document === 'undefined' || document.documentElement?.dataset.fluidBasisTemperatureSyncGuard === 'true') return;
        document.documentElement.dataset.fluidBasisTemperatureSyncGuard = 'true';
        const sync = () => syncFluidBasisPropertiesFromTemperature(window.globalModel?.FLUID);
        const wrapUpdateSimulation = () => {
            if (typeof window.updateSimulation !== 'function') return false;
            if (window.updateSimulation.__fluidBasisTemperatureSyncWrapped) return true;
            const originalUpdateSimulation = window.updateSimulation;
            const wrappedUpdateSimulation = function (...args) {
                sync();
                return originalUpdateSimulation.apply(this, args);
            };
            wrappedUpdateSimulation.__fluidBasisTemperatureSyncWrapped = true;
            wrappedUpdateSimulation.__originalUpdateSimulation = originalUpdateSimulation;
            window.updateSimulation = wrappedUpdateSimulation;
            return true;
        };
        sync();
        if (!wrapUpdateSimulation()) {
            const timer = window.setInterval(() => {
                if (wrapUpdateSimulation()) window.clearInterval(timer);
            }, 120);
            window.setTimeout(() => window.clearInterval(timer), 5000);
        }
        document.addEventListener('input', (event) => {
            if (event.target?.matches?.('input.prop-input-field[data-key="temp"][data-node="FLUID"], input[data-key="temp"][data-node="FLUID"]')) {
                if (window.globalModel?.FLUID?.props) window.globalModel.FLUID.props.temperaturePropertySyncRequested = true;
                sync();
            }
        }, true);
        document.addEventListener('change', (event) => {
            if (event.target?.matches?.('input.prop-input-field[data-key="temp"][data-node="FLUID"], input[data-key="temp"][data-node="FLUID"]')) {
                if (window.globalModel?.FLUID?.props) window.globalModel.FLUID.props.temperaturePropertySyncRequested = true;
                sync();
                if (typeof window.updateSimulation === 'function') {
                    window.updateSimulation({ refreshReason: 'solve', trigger: 'fluid-basis-temperature-sync' });
                }
            }
        }, true);
    }

    window.getFluidPropsAtSourceTemperature = getFluidPropsAtSourceTemperature;
    window.calculateEffectiveSourceFluidProperties = getFluidPropsAtSourceTemperature;
    window.getTemperatureResolvedFluidBasisProps = getTemperatureResolvedFluidBasisProps;
    window.syncFluidBasisPropertiesFromTemperature = syncFluidBasisPropertiesFromTemperature;
    window.NPSHSourceTemperatureRuntime = {
        getFluidPropsAtSourceTemperature,
        getTemperatureResolvedFluidBasisProps,
        syncFluidBasisPropertiesFromTemperature,
        updateSourceTemperaturePreview,
        applySourceTemperatureInput,
        installSourceTemperatureStabilityGuard,
        enforceFluidBasisModeInSourceUi,
        installSourceFluidBasisOnlyUiGuard,
        installFluidBasisTemperatureSyncGuard,
        sourceCustomTemperatureUiEnabled: SOURCE_CUSTOM_TEMPERATURE_UI_ENABLED,
        version: '20260622-fluid-basis-temperature-sync-v1'
    };
    installSourceTemperatureStabilityGuard();
    installSourceFluidBasisOnlyUiGuard();
    installFluidBasisTemperatureSyncGuard();
}());
