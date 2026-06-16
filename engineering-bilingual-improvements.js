(function registerEngineeringBilingualImprovements(root) {
  const VERSION = '2026.05-bilingual-runtime-27';
  const SOURCE_ADVISOR_AUDIT_LOCK = 'source-advisor-hidden-v1';
  const SOURCE_ADVISOR_AUDIT_LOCK_REASON = 'src-window-simplified-for-academic-audit';
  const SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK = 'source-formula-defense-src-header-right-v1';
  const SOURCE_ADVISOR_HIDDEN_SECTIONS = 'pump-readiness,semantic-attachment,hydraulic-connection,defense-ready-note,boundary-role,generic-meaning';
  const SOURCE_TYPE_MEANING_VISIBLE_LOCK = 'source-type-meaning-visible-v1';
  const SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK = 'source-fluid-basis-link-after-flow-v1';
  const SOURCE_STANDARD_FORM_SCHEMA_VERSION = 'src-standard-form.v1';
  const SOURCE_STANDARD_FORM_LOCK = 'source-standard-form-all-surfaces-v1';
  const SOURCE_STANDARD_FORM_VALUE_POLICY = 'live-user-import-or-calculated-values-only';
  const SOURCE_STANDARD_FORM_SECTIONS = Object.freeze([
    'Source Definition',
    'Boundary Data',
    'Flow Specification',
    'Fluid Basis Link'
  ]);
  const SOURCE_STANDARD_FORM_FIELD_KEYS = Object.freeze([
    'sourceType',
    'source-type-meaning',
    'boundaryDataSource',
    'pressureInputBasis',
    'pressure',
    'source-absolute-pressure',
    'elevation',
    'flowInputMode',
    'massFlow',
    'flow',
    'source-flow',
    'source-fluid-basis',
    'source-temperature',
    'source-fluid-density',
    'source-fluid-viscosity',
    'source-fluid-dynamic-viscosity',
    'source-fluid-specific-weight',
    'source-fluid-vapor-pressure',
    'source-fluid-vapor-pressure-head'
  ]);
  const SOURCE_STANDARD_REPORT_FIELDS = Object.freeze([
    'Object ID',
    'Source Definition',
    'Boundary Data',
    'Flow Specification',
    'Fluid Basis Link',
    'Source Formula Defense',
    'Route Trace',
    'Dependency Change',
    'Stale Calculation Policy'
  ]);
  const SOURCE_STANDARD_FORM_CONTRACT = Object.freeze({
    schemaVersion: SOURCE_STANDARD_FORM_SCHEMA_VERSION,
    lockVersion: SOURCE_STANDARD_FORM_LOCK,
    appliesTo: Object.freeze(['all-simulations', 'journal-import-src', 'defense-report-src']),
    requiredSections: SOURCE_STANDARD_FORM_SECTIONS,
    requiredFieldKeys: SOURCE_STANDARD_FORM_FIELD_KEYS,
    reportFields: SOURCE_STANDARD_REPORT_FIELDS,
    formulaDefenseButton: 'Source Formula Defense',
    valuePolicy: SOURCE_STANDARD_FORM_VALUE_POLICY,
    captionValuePolicy: 'Caption numbers are examples only; runtime values must come from user input, journal import, or engine calculation.',
    layoutPolicy: 'Do not replace the caption-standard layout; enforce metadata, ordering, and audit evidence only.'
  });

  const CRITICAL_TERM_KEYS = Object.freeze([
    'head',
    'pump',
    'source',
    'sink',
    'specific_gravity',
    'specific_weight',
    'valve_flow_coefficient'
  ]);

  const TERMINOLOGY_TERMS = Object.freeze([
    {
      key: 'head',
      language: 'en',
      category: 'mechanical',
      term: 'Hydraulic head',
      shortTerm: 'Head',
      aliases: ['head', 'total head', 'pressure head', 'energy head'],
      discipline: ['mechanical', 'chemical'],
      domain: ['fluid-mechanics', 'pump', 'pipe'],
      quantity: 'head',
      unitFamily: 'length',
      definition: 'Energy per unit weight of liquid expressed as an equivalent liquid height.',
      usageNote: 'In pump and pipe calculations, head means hydraulic energy head, not a physical head.'
    },
    {
      key: 'head',
      language: 'id',
      category: 'mechanical',
      term: 'Tinggi tekan hidrolik',
      shortTerm: 'Head',
      aliases: ['head', 'tinggi tekan', 'tinggi energi', 'head hidrolik'],
      discipline: ['mechanical', 'chemical'],
      domain: ['mekanika-fluida', 'pompa', 'pipa'],
      quantity: 'head',
      unitFamily: 'length',
      definition: 'Energi per satuan berat cairan yang dinyatakan sebagai tinggi cairan ekuivalen.',
      usageNote: 'Pada perhitungan pompa dan pipa, head berarti tinggi energi hidrolik.'
    },
    {
      key: 'pump',
      language: 'en',
      category: 'mechanical',
      term: 'Pump',
      aliases: ['pump', 'pumping equipment'],
      discipline: ['mechanical', 'chemical'],
      domain: ['pump', 'rotating-equipment'],
      equipment: ['pump'],
      definition: 'Rotating or positive-displacement equipment used to add hydraulic energy to a fluid.'
    },
    {
      key: 'pump',
      language: 'id',
      category: 'mechanical',
      term: 'Pompa',
      aliases: ['pump', 'pompa', 'peralatan pompa'],
      discipline: ['mechanical', 'chemical'],
      domain: ['pompa', 'rotating-equipment'],
      equipment: ['pump'],
      definition: 'Peralatan yang menambahkan energi hidrolik ke fluida.'
    },
    {
      key: 'source',
      language: 'en',
      category: 'pump',
      term: 'Source boundary',
      shortTerm: 'SRC',
      aliases: ['source', 'SRC', 'upstream boundary', 'suction boundary source'],
      discipline: ['mechanical', 'chemical'],
      domain: ['pump', 'boundary', 'fluid-mechanics'],
      equipment: ['source'],
      definition: 'Upstream hydraulic boundary that supplies pressure, elevation, flow, or liquid level basis to the route.'
    },
    {
      key: 'source',
      language: 'id',
      category: 'pump',
      term: 'Boundary sumber',
      shortTerm: 'SRC',
      aliases: ['source', 'SRC', 'sumber', 'boundary hulu', 'batas hulu'],
      discipline: ['mechanical', 'chemical'],
      domain: ['pompa', 'boundary', 'mekanika-fluida'],
      equipment: ['source'],
      definition: 'Boundary hidrolik hulu yang memberi basis tekanan, elevasi, aliran, atau level cairan ke route.'
    },
    {
      key: 'sink',
      language: 'en',
      category: 'pump',
      term: 'Sink boundary',
      shortTerm: 'SNK',
      aliases: ['sink', 'SNK', 'downstream boundary', 'discharge boundary sink'],
      discipline: ['mechanical', 'chemical'],
      domain: ['pump', 'boundary', 'fluid-mechanics'],
      equipment: ['sink'],
      definition: 'Downstream hydraulic boundary that closes the pump route through outlet pressure or flow demand.'
    },
    {
      key: 'sink',
      language: 'id',
      category: 'pump',
      term: 'Boundary hilir',
      shortTerm: 'SNK',
      aliases: ['sink', 'SNK', 'tujuan', 'boundary hilir', 'batas hilir'],
      discipline: ['mechanical', 'chemical'],
      domain: ['pompa', 'boundary', 'mekanika-fluida'],
      equipment: ['sink'],
      definition: 'Boundary hidrolik hilir yang menutup route pompa melalui tekanan outlet atau demand flow.'
    },
    {
      key: 'specific_gravity',
      language: 'en',
      category: 'units',
      term: 'Specific gravity',
      shortTerm: 'SG',
      aliases: ['specific gravity', 'relative density', 'SG'],
      discipline: ['mechanical', 'chemical'],
      domain: ['fluid-properties'],
      quantity: 'dimensionless',
      unitFamily: 'dimensionless',
      definition: 'Ratio of fluid density to reference water density at the selected basis.',
      usageNote: 'Specific gravity is dimensionless and should not be confused with specific weight.'
    },
    {
      key: 'specific_gravity',
      language: 'id',
      category: 'units',
      term: 'Specific gravity',
      shortTerm: 'SG',
      aliases: ['specific gravity', 'berat jenis relatif', 'densitas relatif', 'SG'],
      discipline: ['mechanical', 'chemical'],
      domain: ['properti-fluida'],
      quantity: 'dimensionless',
      unitFamily: 'dimensionless',
      definition: 'Rasio densitas fluida terhadap densitas air referensi pada basis yang dipilih.',
      usageNote: 'Specific gravity tidak berdimensi dan harus dibedakan dari berat spesifik.'
    },
    {
      key: 'specific_weight',
      language: 'en',
      category: 'units',
      term: 'Specific weight',
      aliases: ['specific weight', 'unit weight', 'gamma'],
      discipline: ['mechanical', 'chemical'],
      domain: ['fluid-properties', 'fluid-mechanics'],
      quantity: 'specificWeight',
      unitFamily: 'specificWeight',
      definition: 'Fluid weight per unit volume, usually gamma = rho g.'
    },
    {
      key: 'specific_weight',
      language: 'id',
      category: 'units',
      term: 'Berat spesifik',
      aliases: ['berat spesifik', 'berat jenis', 'gamma'],
      discipline: ['mechanical', 'chemical'],
      domain: ['properti-fluida', 'mekanika-fluida'],
      quantity: 'specificWeight',
      unitFamily: 'specificWeight',
      definition: 'Berat fluida per satuan volume, biasanya gamma = rho g.'
    },
    {
      key: 'valve_flow_coefficient',
      language: 'en',
      category: 'pipe',
      term: 'Valve flow coefficient',
      shortTerm: 'Cv',
      aliases: ['Cv', 'valve Cv', 'flow coefficient', 'valve flow coefficient'],
      discipline: ['mechanical', 'chemical'],
      domain: ['pipe', 'valve', 'fluid-mechanics'],
      equipment: ['valve'],
      quantity: 'flowCoefficient',
      unitFamily: 'dimensionless',
      definition: 'Valve capacity coefficient used to estimate valve pressure drop or head loss.',
      usageNote: 'Use this meaning for valve hydraulics; control-loop CV means controlled variable.'
    },
    {
      key: 'valve_flow_coefficient',
      language: 'id',
      category: 'pipe',
      term: 'Koefisien alir katup',
      shortTerm: 'Cv',
      aliases: ['Cv', 'Cv katup', 'koefisien alir', 'koefisien alir katup'],
      discipline: ['mechanical', 'chemical'],
      domain: ['pipa', 'katup', 'mekanika-fluida'],
      equipment: ['valve'],
      quantity: 'flowCoefficient',
      unitFamily: 'dimensionless',
      definition: 'Koefisien kapasitas katup yang dipakai untuk memperkirakan pressure drop atau head loss katup.',
      usageNote: 'Gunakan makna ini untuk hidrolik katup; CV pada kontrol berarti variabel terkendali.'
    },
    {
      key: 'loss_coefficient_k',
      language: 'en',
      category: 'pipe',
      term: 'Loss coefficient',
      shortTerm: 'K',
      aliases: ['K coefficient', 'loss coefficient', 'K factor', 'equivalent K'],
      discipline: ['mechanical', 'chemical'],
      domain: ['pipe', 'valve', 'fluid-mechanics'],
      equipment: ['pipe', 'valve'],
      quantity: 'dimensionless',
      unitFamily: 'dimensionless',
      definition: 'Dimensionless coefficient used for local fitting or valve head loss.'
    },
    {
      key: 'loss_coefficient_k',
      language: 'id',
      category: 'pipe',
      term: 'Koefisien kerugian',
      shortTerm: 'K',
      aliases: ['K coefficient', 'koefisien K', 'koefisien kerugian', 'equivalent K'],
      discipline: ['mechanical', 'chemical'],
      domain: ['pipa', 'katup', 'mekanika-fluida'],
      equipment: ['pipe', 'valve'],
      quantity: 'dimensionless',
      unitFamily: 'dimensionless',
      definition: 'Koefisien tak berdimensi untuk head loss lokal pada fitting atau katup.'
    }
  ]);

  const TRACE_KEY_MAPPINGS = Object.freeze({
    'control-valve-characteristic': { i18nKey: 'trace.controlValve.characteristic', en: 'Flow Characteristic', id: 'Karakteristik Alir' },
    'control-valve-cv-input': { i18nKey: 'trace.controlValve.cvInput', en: 'Cv Input', id: 'Input Cv' },
    designEfficiency: { i18nKey: 'trace.pump.designEfficiency', en: 'Design Efficiency', id: 'Efisiensi Desain' },
    designFlow: { i18nKey: 'trace.pump.designFlow', en: 'Design Flow', id: 'Flow Desain' },
    designHead: { i18nKey: 'trace.pump.designHead', en: 'Design Head', id: 'Head Desain' },
    designNpshr: { i18nKey: 'trace.pump.designNpshr', en: 'Design NPSHr', id: 'NPSHr Desain' },
    'sink-boundary-pressure': { i18nKey: 'trace.sink.boundaryPressure', en: 'Sink P abs', id: 'Tekanan Absolut Sink' },
    'sink-calculated-pressure': { i18nKey: 'trace.sink.calculatedPressure', en: 'Required Sink P abs', id: 'Tekanan Absolut Sink yang Dibutuhkan' },
    'sink-evaluated-flow': { i18nKey: 'trace.sink.evaluatedFlow', en: 'Evaluated Flow', id: 'Flow Terevaluasi' },
    'sink-flow': { i18nKey: 'trace.sink.flow', en: 'Flow Rate', id: 'Laju Alir' },
    'sink-flow-demand': { i18nKey: 'trace.sink.flowDemand', en: 'Flow Demand', id: 'Demand Flow' },
    'sink-flow-demand-achieved': { i18nKey: 'trace.sink.flowDemandAchieved', en: 'Flow Demand Achieved', id: 'Demand Flow Tercapai' },
    'sink-flow-demand-gap': { i18nKey: 'trace.sink.flowDemandGap', en: 'Flow Demand Gap', id: 'Selisih Demand Flow' },
    'sink-flow-demand-ignored': { i18nKey: 'trace.sink.flowDemandIgnored', en: 'Ignored Flow Demand', id: 'Demand Flow Diabaikan' },
    'sink-fluid-density': { i18nKey: 'trace.sink.fluidDensity', en: 'Density Used', id: 'Densitas Digunakan' },
    'sink-fluid-vapor-pressure': { i18nKey: 'trace.sink.fluidVaporPressure', en: 'Vapor Pressure', id: 'Tekanan Uap' },
    'sink-boundary-feasibility': { i18nKey: 'trace.sink.boundaryFeasibility', en: 'Boundary Feasibility', id: 'Kelayakan Boundary' },
    'sink-head-residual': { i18nKey: 'trace.sink.headResidual', en: 'Head Residual', id: 'Residual Head' },
    'sink-hydraulic-head': { i18nKey: 'trace.sink.hydraulicHead', en: 'SNK Hydraulic Head', id: 'Head Hidrolik SNK' },
    'sink-mass-flow': { i18nKey: 'trace.sink.massFlow', en: 'Mass Flow', id: 'Laju Alir Massa' },
    'sink-max-allowable-elevation': { i18nKey: 'trace.sink.maxAllowableElevation', en: 'Max SNK Elevation', id: 'Maksimum Elevasi SNK' },
    'sink-outlet-pressure-assumption': { i18nKey: 'trace.sink.outletPressureAssumption', en: 'Outlet Pressure Assumption', id: 'Asumsi Tekanan Outlet' },
    'sink-pressure-residual': { i18nKey: 'trace.sink.pressureResidual', en: 'Pressure Residual', id: 'Residual Tekanan' },
    'sink-pump-available-head': { i18nKey: 'trace.sink.pumpAvailableHead', en: 'Pump Available Head', id: 'Head Tersedia Pompa' },
    'sink-pump-npsh-margin': { i18nKey: 'trace.sink.pumpNpshMargin', en: 'Pump NPSH Margin', id: 'Margin NPSH Pompa' },
    'sink-pump-npsh-ratio': { i18nKey: 'trace.sink.pumpNpshRatio', en: 'Pump NPSH Ratio', id: 'Rasio NPSH Pompa' },
    'sink-pump-npsha': { i18nKey: 'trace.sink.pumpNpsha', en: 'Pump NPSHa', id: 'NPSHa Pompa' },
    'sink-pump-npshr': { i18nKey: 'trace.sink.pumpNpshr', en: 'Pump NPSHr', id: 'NPSHr Pompa' },
    'sink-required-system-head': { i18nKey: 'trace.sink.requiredSystemHead', en: 'Required System Head', id: 'Head Sistem Dibutuhkan' },
    'sink-stagnation-pressure': { i18nKey: 'trace.sink.stagnationPressure', en: 'Pipe Endpoint Stagnation Pressure', id: 'Tekanan Stagnasi Endpoint Pipa' },
    'sink-static-pressure': { i18nKey: 'trace.sink.staticPressure', en: 'Pipe Endpoint Static Pressure', id: 'Tekanan Statik Endpoint Pipa' },
    'sink-temperature': { i18nKey: 'trace.sink.temperature', en: 'Temperature', id: 'Temperatur' },
    'sink-trace-boundary-mode': { i18nKey: 'trace.sink.boundaryMode', en: 'Sink Mode', id: 'Mode Sink' },
    'sink-trace-elevation': { i18nKey: 'trace.sink.elevation', en: 'SNK Elevation', id: 'Elevasi SNK' },
    'sink-trace-pressure-head': { i18nKey: 'trace.sink.pressureHead', en: 'Pressure Head', id: 'Head Tekanan' },
    'sink-trace-pressure-input': { i18nKey: 'trace.sink.pressureInput', en: 'Sink Pressure Input', id: 'Input Tekanan Sink' },
    'sink-trace-velocity-head': { i18nKey: 'trace.sink.velocityHead', en: 'Terminal Velocity Head', id: 'Head Kecepatan Terminal' },
    'sink-valid-operating-flow': { i18nKey: 'trace.sink.validOperatingFlow', en: 'Valid Operating Flow', id: 'Flow Operasi Valid' },
    'source-absolute-pressure': { i18nKey: 'trace.source.absolutePressure', en: 'Calculated Abs. Pressure', id: 'Tekanan Absolut Terhitung' },
    'source-effective-elevation': { i18nKey: 'trace.source.effectiveElevation', en: 'Source Elevation', id: 'Elevasi Source' },
    'source-flow': { i18nKey: 'trace.source.flow', en: 'Volumetric Flow', id: 'Flow Volumetrik' },
    'source-fluid-density': { i18nKey: 'trace.source.fluidDensity', en: 'Density Used', id: 'Densitas Digunakan' },
    'source-fluid-dynamic-viscosity': { i18nKey: 'trace.source.fluidDynamicViscosity', en: 'Dynamic Viscosity', id: 'Viskositas Dinamik' },
    'source-fluid-specific-weight': { i18nKey: 'trace.source.fluidSpecificWeight', en: 'Specific Weight', id: 'Berat Spesifik' },
    'source-fluid-vapor-pressure': { i18nKey: 'trace.source.fluidVaporPressure', en: 'Vapor Pressure', id: 'Tekanan Uap' },
    'source-fluid-vapor-pressure-head': { i18nKey: 'trace.source.fluidVaporPressureHead', en: 'Vapor Pressure Head', id: 'Head Tekanan Uap' },
    'source-fluid-viscosity': { i18nKey: 'trace.source.fluidViscosity', en: 'Kinematic Viscosity', id: 'Viskositas Kinematik' },
    'source-mass-flow': { i18nKey: 'trace.source.massFlow', en: 'Mass Flow', id: 'Laju Alir Massa' },
    'source-temperature': { i18nKey: 'trace.source.temperature', en: 'Temperature', id: 'Temperatur' },
    'source-trace-hydraulic-head': { i18nKey: 'trace.source.hydraulicHead', en: 'Source Hydraulic Head', id: 'Head Hidrolik Source' },
    'source-trace-pressure-head': { i18nKey: 'trace.source.pressureHead', en: 'Pressure Head', id: 'Head Tekanan' },
    'source-trace-pressure-input': { i18nKey: 'trace.source.pressureInput', en: 'Source Pressure Input', id: 'Input Tekanan Source' },
    'source-trace-velocity-head': { i18nKey: 'trace.source.velocityHead', en: 'Velocity Head', id: 'Head Kecepatan' },
    'valve-bore-diameter': { i18nKey: 'trace.valve.boreDiameter', en: 'Nominal Bore', id: 'Bore Nominal' },
    'valve-cracking-head': { i18nKey: 'trace.valve.crackingHead', en: 'Cracking Head', id: 'Head Bukaan Awal' },
    'valve-density': { i18nKey: 'trace.valve.density', en: 'Density Used', id: 'Densitas Digunakan' },
    'valve-diameter': { i18nKey: 'trace.valve.diameter', en: 'Hydraulic Diameter', id: 'Diameter Hidrolik' },
    'valve-effective-cv': { i18nKey: 'trace.valve.effectiveCv', en: 'Effective Cv', id: 'Cv Efektif' },
    'valve-effective-k': { i18nKey: 'trace.valve.effectiveK', en: 'Effective K', id: 'K Efektif' },
    'valve-flow': { i18nKey: 'trace.valve.flow', en: 'Solved Flow', id: 'Flow Terselesaikan' },
    'valve-forward-loss-head': { i18nKey: 'trace.valve.forwardLossHead', en: 'Forward Loss Head', id: 'Head Loss Maju' },
    'valve-head-loss': { i18nKey: 'trace.valve.headLoss', en: 'Valve Head Loss', id: 'Head Loss Katup' },
    'valve-loss-model': { i18nKey: 'trace.valve.lossModel', en: 'Loss Model', id: 'Model Loss' },
    'valve-npsh-loss-contribution': { i18nKey: 'trace.valve.npshLossContribution', en: 'NPSH Loss Contribution', id: 'Kontribusi Loss NPSH' },
    'valve-object-type': { i18nKey: 'trace.valve.objectType', en: 'Object Type', id: 'Tipe Objek' },
    'valve-opening': { i18nKey: 'trace.valve.opening', en: 'Opening', id: 'Bukaan' },
    'valve-opening-effect': { i18nKey: 'trace.valve.openingEffect', en: 'Opening Effect', id: 'Efek Bukaan' },
    'valve-pressure-drop': { i18nKey: 'trace.valve.pressureDrop', en: 'Valve Pressure Drop', id: 'Pressure Drop Katup' },
    'valve-specific-gravity': { i18nKey: 'trace.valve.specificGravity', en: 'Specific Gravity Used', id: 'Specific Gravity Digunakan' },
    'valve-type': { i18nKey: 'trace.valve.type', en: 'Valve Type', id: 'Tipe Katup' },
    'valve-velocity-head': { i18nKey: 'trace.valve.velocityHead', en: 'Velocity Head', id: 'Head Kecepatan' }
  });

  const ROUTE_TRACE_TEXT_ENTRIES = Object.freeze([
    ['route.trace.object.fluidBasis', 'Fluid Basis', 'Basis Fluida'],
    ['route.trace.object.suctionPipeFittingValve', 'Suction Pipe/Fitting/Valve', 'Pipa/Fitting/Katup Isap'],
    ['route.trace.object.dischargePipeFittingValve', 'Discharge Pipe/Fitting/Valve', 'Pipa/Fitting/Katup Discharge'],
    ['route.trace.object.system', 'System', 'Sistem'],
    ['route.trace.dependency.fluidBasis', 'rho, viscosity, vapor pressure', 'rho, viskositas, tekanan uap'],
    ['route.trace.dependency.sourceBoundary', 'Source pressure/elevation', 'Tekanan/elevasi source'],
    ['route.trace.dependency.suctionLosses', 'Suction major/minor/valve losses', 'Loss mayor/minor/katup sisi isap'],
    ['route.trace.dependency.pumpNpsh', 'NPSHa vs NPSHr', 'NPSHa vs NPSHr'],
    ['route.trace.dependency.dischargeLosses', 'Discharge pipe/fitting/valve losses', 'Loss pipa/fitting/katup discharge'],
    ['route.trace.dependency.sinkBoundary', 'Downstream boundary', 'Boundary hilir'],
    ['route.trace.dependency.systemStatus', 'Final export status', 'Status export akhir'],
    ['route.trace.interpretation.fluidBasis', 'Fluid properties set hydraulic and NPSH calculation basis.', 'Properti fluida menetapkan basis perhitungan hidrolik dan NPSH.'],
    ['route.trace.interpretation.sourceBoundary', 'Pressure head is available at the upstream boundary.', 'Head tekanan tersedia pada boundary hulu.'],
    ['route.trace.interpretation.suctionLosses', 'Suction loss subtracts directly from NPSHa.', 'Loss sisi isap mengurangi NPSHa secara langsung.'],
    ['route.trace.interpretation.pumpNpsh', 'Primary cavitation comparison.', 'Perbandingan utama potensi kavitasi.'],
    ['route.trace.interpretation.dischargeLosses', 'Discharge losses affect pump head and outlet pressure.', 'Loss discharge memengaruhi head pompa dan tekanan outlet.'],
    ['route.trace.interpretation.sinkBoundary', 'Sink condition closes the route calculation.', 'Kondisi SNK menutup perhitungan route.'],
    ['route.trace.interpretation.systemStatus', 'Export records warnings and missing data explicitly.', 'Export merekam warning dan data yang kurang secara eksplisit.']
  ]);

  const DIAGNOSTIC_TEXT_ENTRIES = Object.freeze([
    ['coreDiagnostics.bilingual.title', 'Bilingual Engineering Coverage', 'Coverage Engineering Bilingual'],
    ['coreDiagnostics.bilingual.traceKeyCoverage', 'Trace key coverage', 'Coverage trace key'],
    ['coreDiagnostics.bilingual.criticalTerms', 'Critical terminology coverage', 'Coverage terminologi kritis'],
    ['coreDiagnostics.bilingual.routeTrace', 'Route trace localization', 'Lokalisasi route trace']
  ]);

  const FLUID_TASK_TEXT_ENTRIES = Object.freeze([
    ['task.fluid.title', 'Fluid Basis', 'Basis Fluida'],
    ['task.fluid.formulaDefenseTitle', 'Fluid Basis Formula Defense', 'Defense Formula Basis Fluida'],
    ['task.fluid.defenseButton', 'Formula Defense', 'Defense Formula'],
    ['task.fluid.openDefenseAria', 'Open Fluid Basis formula defense explanation', 'Buka penjelasan defense formula Basis Fluida'],
    ['task.window.minimize', 'Minimize task window', 'Minimalkan window task'],
    ['task.window.close', 'Close task window', 'Tutup window task'],
    ['task.fluid.missing', 'Missing', 'Belum lengkap'],
    ['task.fluid.runBackendAfterFluid', 'Run backend calculation after completing Fluid Basis.', 'Jalankan perhitungan backend setelah melengkapi Basis Fluida.'],
    ['task.fluid.inputBasis', 'Input Basis', 'Basis Input'],
    ['task.fluid.setCalculationFirst', 'Set calculation basis first', 'Tentukan basis perhitungan lebih dulu'],
    ['task.fluid.setupRequiredReason', 'Set Fluid Basis and Unit Standard before adding equipment.', 'Pilih Basis Fluida dan Standar Satuan sebelum menambahkan equipment.'],
    ['task.fluid.openSetupInstruction', 'Open the setup panel to select the fluid basis and unit standard.', 'Buka panel setup untuk memilih basis fluida dan standar satuan.'],
    ['task.fluid.openSetup', 'Open Setup', 'Buka Setup'],
    ['task.fluid.unitStandard', 'Unit Standard', 'Standar Satuan'],
    ['task.fluid.metricEuropean', 'Metric / European Engineering', 'Metric / European Engineering'],
    ['task.fluid.siInternational', 'SI / International', 'SI / Internasional'],
    ['task.fluid.usCustomary', 'US Customary', 'US Customary'],
    ['task.fluid.inputMode', 'Input Mode', 'Mode Input'],
    ['task.fluid.basic', 'Basic', 'Dasar'],
    ['task.fluid.advanced', 'Advanced', 'Lanjutan'],
    ['task.fluid.fluidName', 'Fluid Name', 'Nama Fluida'],
    ['task.fluid.customFluid', 'Custom Fluid', 'Fluida Kustom'],
    ['task.fluid.water', 'Water', 'Air'],
    ['task.fluid.waterAuto', 'Water (Auto)', 'Air (Otomatis)'],
    ['task.fluid.methanolAuto', 'Methanol (Auto)', 'Metanol (Otomatis)'],
    ['task.fluid.npshHydraulicData', 'NPSH & Hydraulic Calculation Data', 'Data Perhitungan NPSH & Hidrolik'],
    ['task.fluid.npshHydraulicDataNote', 'Primary properties used by the current steady-state NPSH and hydraulic-loss calculations.', 'Properti utama yang digunakan oleh perhitungan NPSH steady-state dan kehilangan hidrolik saat ini.'],
    ['task.fluid.temperature', 'Temperature', 'Temperatur'],
    ['task.fluid.density', 'Density', 'Densitas'],
    ['task.fluid.densityRho', 'Density (ρ)', 'Densitas (ρ)'],
    ['task.fluid.kinematicViscosity', 'Kinematic Viscosity', 'Viskositas Kinematik'],
    ['task.fluid.kinematicViscosityNu', 'Kinematic viscosity (ν)', 'Viskositas kinematik (ν)'],
    ['task.fluid.dynamicViscosity', 'Dynamic Viscosity', 'Viskositas Dinamik'],
    ['task.fluid.dynamicViscosityMu', 'Dynamic viscosity (μ)', 'Viskositas dinamik (μ)'],
    ['task.fluid.vaporPressure', 'Vapor Pressure', 'Tekanan Uap'],
    ['task.fluid.vaporPressurePv', 'Vapor pressure (Pᵥ)', 'Tekanan uap (Pᵥ)'],
    ['task.fluid.specificWeight', 'Specific Weight', 'Berat Spesifik'],
    ['task.fluid.specificWeightGamma', 'Specific weight (γ)', 'Berat spesifik (γ)'],
    ['task.fluid.vaporPressureHead', 'Vapor Pressure Head', 'Head Tekanan Uap'],
    ['task.fluid.vaporPressureHeadHv', 'Vapor pressure head (Hᵥ)', 'Head tekanan uap (Hᵥ)'],
    ['task.fluid.auditFutureStudy', 'Properties for Audit / Future Study', 'Properti untuk Audit / Studi Lanjutan'],
    ['task.fluid.auditFutureStudyNote', 'Retained for audit, validation, and future thermal/transient study; not primary terms in the current steady-state NPSH calculation.', 'Disimpan untuk audit, validasi, dan studi termal/transien berikutnya; bukan term utama dalam perhitungan NPSH steady-state saat ini.'],
    ['task.fluid.specificGravity', 'Specific Gravity', 'Specific Gravity'],
    ['task.fluid.specificGravitySg', 'Specific gravity (SG)', 'Specific gravity (SG)'],
    ['task.fluid.specificVolume', 'Specific Volume', 'Volume Spesifik'],
    ['task.fluid.specificVolumeV', 'Specific volume (v)', 'Volume spesifik (v)'],
    ['task.fluid.specificHeat', 'Specific Heat', 'Kalor Spesifik'],
    ['task.fluid.specificHeatCp', 'Specific heat (cₚ)', 'Kalor spesifik (cₚ)'],
    ['task.fluid.bulkModulus', 'Bulk Modulus', 'Modulus Bulk'],
    ['task.fluid.bulkModulusK', 'Bulk modulus (K)', 'Modulus bulk (K)'],
    ['task.fluid.speedOfSound', 'Speed of Sound', 'Kecepatan Suara'],
    ['task.fluid.speedOfSoundA', 'Speed of sound (a)', 'Kecepatan suara (a)'],
    ['task.fluid.propertyBasis', 'Property Basis', 'Basis Properti'],
    ['task.fluid.validationStatus', 'Validation Status', 'Status Validasi'],
    ['task.fluid.confirmBasis', 'Confirm this basis to start or continue modeling.', 'Konfirmasi basis ini untuk memulai atau melanjutkan pemodelan.'],
    ['task.fluid.applyBasis', 'Apply Basis / Start Modeling', 'Terapkan Basis / Mulai Pemodelan'],
    ['task.fluid.calculatedTrace', 'Calculated Properties / Engineering Trace', 'Properti Terhitung / Trace Engineering'],
    ['task.fluid.status', 'Status', 'Status'],
    ['task.fluid.dataSource', 'Data Source', 'Sumber Data'],
    ['task.fluid.fluidBasisLower', 'Fluid basis', 'Basis fluida'],
    ['task.fluid.confidence', 'Confidence', 'Confidence'],
    ['task.fluid.npshBasis', 'NPSH Basis', 'Basis NPSH'],
    ['task.fluid.hydraulicLoss', 'Hydraulic Loss', 'Kehilangan Hidrolik'],
    ['task.fluid.fluid', 'Fluid', 'Fluida'],
    ['task.fluid.available', 'Available', 'Tersedia'],
    ['task.fluid.verified', 'Verified', 'Terverifikasi'],
    ['task.fluid.formulaVerified', 'Formula verified', 'Formula terverifikasi'],
    ['task.fluid.correlation', 'Correlation', 'Korelasi'],
    ['task.fluid.shortAnswer', 'Short Answer for Advisor', 'Jawaban Singkat untuk Advisor'],
    ['task.fluid.shortAnswerText', 'Fluid Basis calculates primary fluid properties from correlation, table, journal data, or user input. Derived properties are calculated using standard fluid mechanics equations. Density and vapor pressure support NPSH screening, while viscosity is required for Reynolds number, friction factor, head loss, and system curve validation.', 'Basis Fluida menghitung properti fluida utama dari korelasi, tabel, data jurnal, atau input user. Properti turunan dihitung menggunakan persamaan standar mekanika fluida. Densitas dan tekanan uap mendukung evaluasi NPSH, sedangkan viskositas diperlukan untuk bilangan Reynolds, faktor gesek, kehilangan head, dan validasi kurva sistem.'],
    ['task.fluid.currentBasisSummary', 'Current Basis Summary', 'Ringkasan Basis Saat Ini'],
    ['task.fluid.item', 'Item', 'Item'],
    ['task.fluid.currentValue', 'Current Value', 'Nilai Saat Ini'],
    ['task.fluid.defenseMeaning', 'Defense Meaning', 'Makna Defense'],
    ['task.fluid.activeFluidSetMeaning', 'Active fluid property set used by hydraulic and NPSH calculations.', 'Set properti fluida aktif yang dipakai oleh perhitungan hidrolik dan NPSH.'],
    ['task.fluid.inputModeMeaning', 'Determines whether primary properties are correlation/table based or user-entered.', 'Menentukan apakah properti utama berbasis korelasi/tabel atau diinput oleh user.'],
    ['task.fluid.temperatureMeaning', 'Property basis temperature; automatic fluids depend on this value.', 'Temperatur basis properti; fluida otomatis bergantung pada nilai ini.'],
    ['task.fluid.propertyMethod', 'Property Method', 'Metode Properti'],
    ['task.fluid.waterCorrelation', 'IAPWS-based water property correlation (IAPWS SR6-08, 2011)', 'Korelasi properti air berbasis IAPWS (IAPWS SR6-08, 2011)'],
    ['task.fluid.waterDensityCorrelation', 'IAPWS-based liquid density correlation', 'Korelasi densitas cairan berbasis IAPWS'],
    ['task.fluid.waterViscosityCorrelation', 'IAPWS-based liquid viscosity correlation', 'Korelasi viskositas cairan berbasis IAPWS'],
    ['task.fluid.waterVaporCorrelation', 'IAPWS vapor pressure correlation', 'Korelasi tekanan uap IAPWS'],
    ['task.fluid.propertyMethodMeaning', 'Primary correlation, table, journal, or user-input method.', 'Metode utama berupa korelasi, tabel, jurnal, atau input user.'],
    ['task.fluid.validationStatusMeaning', 'Advisor-facing status for whether the fluid basis can support final validation.', 'Status untuk advisor mengenai apakah basis fluida dapat mendukung validasi final.'],
    ['task.fluid.npshBasisMeaning', 'Requires valid density and absolute vapor pressure.', 'Memerlukan densitas valid dan tekanan uap absolut.'],
    ['task.fluid.hydraulicLossMeaning', 'Requires valid density and viscosity for Reynolds number and friction loss.', 'Memerlukan densitas dan viskositas valid untuk bilangan Reynolds dan friction loss.'],
    ['task.fluid.confidenceMeaning', 'Data-quality label used before accepting calculations as final engineering evidence.', 'Label kualitas data sebelum perhitungan diterima sebagai bukti engineering final.'],
    ['task.fluid.propertyUseBoundary', 'Property Use Boundary', 'Boundary Penggunaan Properti'],
    ['task.fluid.propertyGroup', 'Property Group', 'Kelompok Properti'],
    ['task.fluid.properties', 'Properties', 'Daftar Properti'],
    ['task.fluid.currentCalculationRole', 'Current Calculation Role', 'Peran Perhitungan Saat Ini'],
    ['task.fluid.primaryPropertyList', 'Temperature; density; kinematic viscosity; dynamic viscosity; vapor pressure; specific weight; vapor pressure head', 'Temperatur; densitas; viskositas kinematik; viskositas dinamik; tekanan uap; berat spesifik; head tekanan uap'],
    ['task.fluid.primaryPropertyRole', 'Primary set used by the current steady-state NPSH, pressure-head, Reynolds/friction, suction-loss, and hydraulic calculations.', 'Set utama yang dipakai oleh perhitungan NPSH steady-state, pressure head, Reynolds/friksi, kehilangan sisi isap, dan hidrolik saat ini.'],
    ['task.fluid.auditPropertyList', 'Specific gravity; specific volume; specific heat; bulk modulus; speed of sound', 'SG; volume spesifik; kalor spesifik; modulus bulk; kecepatan suara'],
    ['task.fluid.auditPropertyRole', 'Kept for formula audit, source validation, literature comparison, and future thermal/transient research; not primary NPSHₐ terms in the current steady-state model.', 'Disimpan untuk audit formula, validasi sumber, perbandingan literatur, dan riset termal/transien berikutnya; bukan suku utama NPSHₐ pada model steady-state saat ini.'],
    ['task.fluid.inputSourceMap', 'Input Source Map', 'Peta Sumber Input'],
    ['task.fluid.property', 'Property', 'Properti'],
    ['task.fluid.useGroup', 'Use Group', 'Kelompok Penggunaan'],
    ['task.fluid.unit', 'Unit', 'Satuan'],
    ['task.fluid.method', 'Method', 'Metode'],
    ['task.fluid.formulaDependency', 'Formula / Dependency', 'Formula / Dependensi'],
    ['task.fluid.referenceAuditBasis', 'Reference / Audit Basis', 'Referensi / Basis Audit'],
    ['task.fluid.derivedFromMuRho', 'Derived from dynamic viscosity and density', 'Diturunkan dari viskositas dinamik dan densitas'],
    ['task.fluid.absoluteVaporMethod', 'Absolute saturation or estimated vapor pressure at fluid temperature', 'Tekanan uap jenuh absolut atau estimasi pada temperatur fluida'],
    ['task.fluid.primaryInputFormula', 'property = Primary input or fluid correlation', 'properti = input utama atau korelasi fluida'],
    ['task.fluid.primaryInputTableFormula', 'property = Primary input, table, or fluid correlation', 'properti = input utama, tabel, atau korelasi fluida'],
    ['task.fluid.bulkMethod', 'K = ρ x a^2 where speed of sound is available', 'K = ρ x a^2 jika kecepatan suara tersedia'],
    ['task.fluid.speedMethod', 'sqrt(K / ρ)', 'sqrt(K / ρ)'],
    ['task.fluid.formulaSequence', 'Formula Sequence & Active Substitution', 'Urutan Formula & Substitusi Aktif'],
    ['task.fluid.temperatureBasis', '1. Temperature Basis', '1. Basis Temperatur'],
    ['task.fluid.temperatureFormulaVerified', 'Formula verified: temperature conversion for SI thermophysical correlations', 'Formula terverifikasi: konversi temperatur untuk korelasi termofisika SI'],
    ['task.fluid.densityStep', '2. Density', '2. Densitas'],
    ['task.fluid.dynamicViscosityStep', '3. Dynamic Viscosity', '3. Viskositas Dinamik'],
    ['task.fluid.vaporPressureStep', '4. Vapor Pressure', '4. Tekanan Uap'],
    ['task.fluid.specificHeatStep', '5. Specific Heat', '5. Kalor Spesifik'],
    ['task.fluid.bulkModulusStep', '6. Bulk Modulus', '6. Modulus Bulk'],
    ['task.fluid.specificGravityStep', '7. Specific Gravity', '7. Specific Gravity'],
    ['task.fluid.kinematicViscosityStep', '8. Kinematic Viscosity', '8. Viskositas Kinematik'],
    ['task.fluid.specificWeightStep', '9. Specific Weight', '9. Berat Spesifik'],
    ['task.fluid.specificVolumeStep', '10. Specific Volume', '10. Volume Spesifik'],
    ['task.fluid.vaporPressureHeadStep', '11. Vapor Pressure Head', '11. Head Tekanan Uap'],
    ['task.fluid.speedOfSoundStep', '12. Speed of Sound', '12. Kecepatan Suara'],
    ['task.fluid.dependencyChain', 'Dependency Chain', 'Rantai Dependency'],
    ['task.fluid.dependencyTemp', 'Temperature -> density, viscosity, vapor pressure for automatic fluids', 'Temperatur -> densitas, viskositas, tekanan uap untuk fluida otomatis'],
    ['task.fluid.dependencyDensity', 'Density -> specific gravity, specific volume, specific weight', 'Densitas -> SG, volume spesifik, berat spesifik'],
    ['task.fluid.dependencyViscosity', 'Dynamic viscosity + density -> kinematic viscosity', 'Viskositas dinamik + densitas -> viskositas kinematik'],
    ['task.fluid.dependencyVapor', 'Vapor pressure + density -> vapor pressure head for NPSHₐ', 'Tekanan uap + densitas -> head tekanan uap untuk NPSHₐ'],
    ['task.fluid.dependencyBulk', 'Bulk modulus + density -> speed of sound', 'Modulus bulk + densitas -> kecepatan suara'],
    ['task.fluid.validationGate', 'Validation Gate', 'Gate Validasi'],
    ['task.fluid.check', 'Check', 'Pengecekan'],
    ['task.fluid.engineeringDefense', 'Engineering Defense', 'Defense Engineering'],
    ['task.fluid.pressureHeadDefense', 'Required for pressure-to-head conversion and NPSH.', 'Diperlukan untuk konversi pressure-to-head dan NPSH.'],
    ['task.fluid.absoluteVaporDefense', 'Required as absolute vapor pressure for NPSHₐ.', 'Diperlukan sebagai tekanan uap absolut untuk NPSHₐ.'],
    ['task.fluid.viscosityCheck', 'Viscosity (μ/ν)', 'Viskositas (μ/ν)'],
    ['task.fluid.viscosityDefense', 'Required for Reynolds number, friction factor, suction loss, and system curve.', 'Diperlukan untuk bilangan Reynolds, faktor gesek, suction loss, dan kurva sistem.'],
    ['task.fluid.temperatureDefense', 'Required to document the fluid property basis and automatic correlations.', 'Diperlukan untuk mendokumentasikan basis properti fluida dan korelasi otomatis.'],
    ['task.fluid.basisLimitation', 'Basis & Limitation', 'Basis & Batasan'],
    ['task.fluid.limitationTemperature', 'Fluid properties are evaluated at the selected bulk fluid temperature.', 'Properti fluida dievaluasi pada temperatur bulk fluida yang dipilih.'],
    ['task.fluid.limitationSinglePhase', 'Hydraulic calculations treat the liquid as single-phase and incompressible for screening.', 'Perhitungan hidrolik memperlakukan cairan sebagai satu fase dan inkompresibel untuk penapisan awal.'],
    ['task.fluid.limitationVaporAbsolute', 'Vapor pressure is treated as absolute pressure in bar a before conversion to Pa.', 'Tekanan uap diperlakukan sebagai tekanan absolut dalam bar a sebelum dikonversi ke Pa.'],
    ['task.fluid.limitationGravity', 'The application uses g = 9.810 m/s2 for hydraulic head conversions.', 'Aplikasi menggunakan g = 9.810 m/s2 untuk konversi head hidrolik.'],
    ['task.fluid.limitationSource', 'Fluid Basis is valid only as far as the selected property source is valid.', 'Basis Fluida valid sejauh sumber properti yang dipilih valid.'],
    ['task.fluid.limitationNpshHydraulic', 'NPSH screening can use density and absolute vapor pressure, but hydraulic loss and system curve validation require viscosity.', 'Evaluasi NPSH dapat memakai densitas dan tekanan uap absolut, tetapi kehilangan hidrolik dan validasi kurva sistem memerlukan viskositas.'],
    ['task.fluid.limitationSupportProperties', 'Specific heat, bulk modulus, speed of sound, specific gravity, and specific volume are retained as supporting audit or future-study properties, not as primary steady-state NPSH terms.', 'Kalor spesifik, modulus bulk, kecepatan suara, SG, dan volume spesifik disimpan sebagai properti pendukung audit atau studi lanjutan, bukan sebagai suku utama NPSH steady-state.'],
    ['task.fluid.limitationCustomFluid', 'Custom Fluid values must be defended with lab, vendor, NIST, REFPROP, ASTM, API, or peer-reviewed data when the status is not Verified.', 'Nilai Fluida Kustom harus dipertahankan dengan data lab, vendor, NIST, REFPROP, ASTM, API, atau peer-reviewed ketika statusnya belum Terverifikasi.'],
    ['task.fluid.limitationFinalValidation', 'Final academic/design validation should use laboratory, vendor, NIST, REFPROP, ASTM, API, or peer-reviewed data when the status is not Verified.', 'Validasi akademik/desain final sebaiknya memakai data laboratorium, vendor, NIST, REFPROP, ASTM, API, atau peer-reviewed ketika statusnya belum Terverifikasi.'],
    ['task.fluid.referencesUsed', 'References Used', 'Referensi yang Digunakan']
  ]);

  const SOURCE_TASK_TEXT_ENTRIES = Object.freeze([
    ['task.source.objectPropertiesTitle', 'Source Object Properties', 'Properti Objek Source'],
    ['task.source.formulaDefenseTitle', 'Source Formula Defense', 'Defense Formula Source'],
    ['task.source.defenseButton', 'Source Formula Defense', 'Defense Formula Source'],
    ['task.source.shortAnswerBoundary', 'SRC is the upstream suction boundary for the pump network. It supplies absolute pressure, source elevation, fluid basis, flow basis, and hydraulic path information. These values are converted into source hydraulic head and then used by the Pump Object to calculate NPSHa.', 'SRC adalah boundary suction upstream untuk network pompa. SRC memasok tekanan absolut, elevasi source, Basis Fluida, basis aliran, dan informasi jalur hidrolik. Nilai ini dikonversi menjadi head hidrolik source lalu dipakai oleh Pump Object untuk menghitung NPSHa.'],
    ['task.source.shortAnswerVerdict', 'SRC does not decide final cavitation risk by itself. The final verdict is in Pump Object Properties, where system-derived NPSHa is compared against pump/vendor/journal NPSHr and the selected margin basis.', 'SRC tidak menentukan risiko kavitasi final sendirian. Verdict final berada di Pump Object Properties, tempat NPSHa dari sistem dibandingkan dengan NPSHr pump/vendor/journal dan basis margin yang dipilih.'],
    ['task.source.currentInputInterpretation', 'Current Input Interpretation', 'Interpretasi Input Saat Ini'],
    ['task.source.dropdownBehaviorMap', 'Dropdown Behavior Map', 'Peta Perilaku Dropdown'],
    ['task.source.inputChoice', 'Input / Choice', 'Input / Pilihan'],
    ['task.source.currentValue', 'Current Value', 'Nilai Saat Ini'],
    ['task.source.meaning', 'Meaning', 'Makna'],
    ['task.source.meaningPossessive', 'Meaning', 'Maknanya'],
    ['task.source.dropdown', 'Dropdown', 'Dropdown'],
    ['task.source.selectedValue', 'Selected Value', 'Nilai Terpilih'],
    ['task.source.solverEffect', 'What Changes in Solver', 'Yang Berubah di Solver'],
    ['task.source.sourceType', 'Source Type', 'Tipe Source'],
    ['task.source.sourceTypeMeaning', 'Type Meaning', 'Makna Tipe'],
    ['task.source.boundaryDataSource', 'Source Data Origin', 'Asal Data Source'],
    ['task.source.boundaryDataNote', 'Source Data Note', 'Catatan Data Source'],
    ['task.source.pressureBasis', 'Pressure Basis', 'Basis Tekanan'],
    ['task.source.boundaryPressure', 'Source P abs', 'Tekanan Absolut Source'],
    ['task.source.sourceElevation', 'Source Elevation', 'Elevasi Source'],
    ['task.source.pressureEnergyBasis', 'Pressure Energy Basis', 'Basis Energi Tekanan'],
    ['task.source.temperatureMode', 'Temperature Mode', 'Mode Temperatur'],
    ['task.source.flowInputMode', 'Flow Input Mode', 'Mode Input Flow'],
    ['task.source.hydraulicPath', 'Hydraulic Path', 'Jalur Hidrolik'],
    ['task.source.notEvaluated', 'Not evaluated', 'Belum dievaluasi'],
    ['task.source.directBoundaryMeaning', 'SRC is a direct hydraulic boundary/tie-in; pressure and elevation are interpreted from SRC inputs.', 'SRC adalah boundary hidrolik langsung/tie-in; tekanan dan elevasi diinterpretasikan dari input SRC.'],
    ['task.source.manualScenarioMeaning', 'Pressure and elevation are manual scenario inputs on this SRC.', 'Tekanan dan elevasi adalah input skenario manual pada SRC ini.'],
    ['task.source.absolutePressureMeaning', 'The entered boundary pressure is already absolute and is used directly for pressure head.', 'Tekanan boundary yang dimasukkan sudah absolut dan dipakai langsung untuk head tekanan.'],
    ['task.source.absoluteSourcePressureMeaning', 'Absolute source pressure used to form pressure head.', 'Tekanan absolut source yang dipakai untuk membentuk head tekanan.'],
    ['task.source.elevationHeadMeaning', 'Elevation head at the source datum or inherited liquid surface.', 'Head elevasi pada datum source atau permukaan cairan yang diwariskan.'],
    ['task.source.pressureEnergyInactiveMeaning', 'Not active unless Source Type is External Header / Pipe Tie-in.', 'Tidak aktif kecuali Tipe Source adalah External Header / Pipe Tie-in.'],
    ['task.source.usesFluidBasisMeaning', 'SRC uses the active Fluid Basis properties.', 'SRC memakai properti Basis Fluida aktif.'],
    ['task.source.flowSolvedMeaning', 'Flow is not imposed by SRC; it is solved from the hydraulic network.', 'Flow tidak dipaksakan oleh SRC; flow dihitung dari network hidrolik.'],
    ['task.source.sourceTypeDropdownMeaning', 'Chooses whether SRC behaves as tank/reservoir attachment, pressurized vessel attachment, external header, fixed flow source, or standalone manual boundary.', 'Memilih apakah SRC berperan sebagai attachment tank/reservoir, attachment vessel bertekanan, external header, fixed flow source, atau boundary manual mandiri.'],
    ['task.source.pumpActionReadiness', 'Pump Action Readiness', 'Kesiapan Aksi Pompa'],
    ['task.source.backendContract', 'Backend Contract', 'Kontrak Backend'],
    ['task.source.fallbackRuntime', 'Fallback runtime', 'Runtime fallback'],
    ['task.source.routeTrace', 'Route Trace', 'Trace Route'],
    ['task.source.currentFromPipeTrace', 'Current from pipe trace', 'Current dari trace pipa'],
    ['task.source.evaluateNetwork', 'Evaluate Network', 'Evaluasi Network'],
    ['task.source.readyFromRouteProposal', 'Ready from route/proposal', 'Siap dari route/proposal'],
    ['task.source.engineeringFit', 'Engineering Fit', 'Engineering Fit'],
    ['task.source.readyAdvancedEnabled', 'Ready - Advanced mode will be enabled', 'Siap - mode Advanced akan diaktifkan'],
    ['task.source.applyProposal', 'Apply Proposal', 'Terapkan Proposal'],
    ['task.source.restoreInput', 'Restore Input', 'Pulihkan Input'],
    ['task.source.clearProposal', 'Clear Proposal', 'Bersihkan Proposal'],
    ['task.source.stale', 'Stale', 'Stale'],
    ['task.source.ready', 'Ready', 'Siap'],
    ['task.source.no', 'No', 'Tidak'],
    ['task.source.noPreviousInputs', 'No previous inputs', 'Tidak ada input sebelumnya'],
    ['task.source.sourceDefinition', 'Source Definition', 'Definisi Source'],
    ['task.source.fixedFlowSource', 'Fixed Flow Source', 'Source Flow Tetap'],
    ['task.source.openTankReservoir', 'Open Tank / Reservoir', 'Tangki Terbuka / Reservoir'],
    ['task.source.pressurizedVessel', 'Pressurized Vessel', 'Vessel Bertekanan'],
    ['task.source.externalHeaderTieIn', 'External Header / Pipe Tie-in', 'Header Eksternal / Tie-in Pipa'],
    ['task.source.standaloneBoundary', 'Standalone Source Boundary', 'Boundary Source Mandiri'],
    ['task.source.sourceBoundaryStandalone', 'Source Boundary Standalone', 'Boundary Source Mandiri'],
    ['task.source.fixedFlowMeaning', 'Specified inlet flow boundary; use a solid pipe and review the resulting pressure/head balance.', 'Boundary inlet flow ditentukan; gunakan pipa solid dan review balance pressure/head yang dihasilkan.'],
    ['task.source.openTankMeaning', 'Atmospheric tank/reservoir boundary; may inherit tank pressure and level through a dashed attachment.', 'Boundary tangki/reservoir atmosferik; dapat mewarisi tekanan dan level tank melalui attachment dashed.'],
    ['task.source.boundaryRole', 'Boundary Role', 'Peran Boundary'],
    ['task.source.hydraulicTieIn', 'Hydraulic boundary / tie-in', 'Boundary hidrolik / tie-in'],
    ['task.source.semanticBoundaryAttachment', 'Semantic boundary attachment', 'Attachment boundary semantik'],
    ['task.source.semanticAttachmentRole', 'Semantic attachment only - not a hydraulic pipe', 'Semantik saja - bukan pipa hidrolik'],
    ['task.source.solidPipeRequiredMeaning', 'Solid hydraulic pipe from SRC is required for flow and pressure-loss calculation.', 'Pipa hidrolik solid dari SRC wajib untuk perhitungan flow dan pressure loss.'],
    ['task.source.boundaryData', 'Boundary Data', 'Data Boundary'],
    ['task.source.manual', 'Manual', 'Manual'],
    ['task.source.custom', 'Custom', 'Kustom'],
    ['task.source.absolute', 'Absolute', 'Absolut'],
    ['task.source.gauge', 'Gauge', 'Gauge'],
    ['task.source.useFluidBasis', 'Use Fluid Basis', 'Gunakan Basis Fluida'],
    ['task.source.volumetricFlow', 'Volumetric Flow', 'Flow Volumetrik'],
    ['task.source.massFlow', 'Mass Flow', 'Flow Massa'],
    ['task.source.solveFromNetwork', 'Solve from Network', 'Solve dari Jaringan'],
    ['task.source.noCompletePath', 'No complete SRC -> pump -> SNK hydraulic path is available.', 'Belum ada path hidrolik lengkap SRC -> pompa -> SNK.'],
    ['task.source.attachmentNeedsHydraulicPath', 'Attachment only. Hydraulic flow path must be created using pipe or hydraulic components.', 'Hanya attachment. Path flow hidrolik harus dibuat menggunakan pipa atau komponen hidrolik.'],
    ['task.source.startDashedAttachment', 'Start Dashed Tank/Vessel Attachment', 'Mulai Attachment Dashed Tangki/Vessel'],
    ['task.source.inheritOnlyMeaning', 'Inherit is only available for Open Tank/Pressurized Vessel dashed-attached to a tank/vessel.', 'Inherit hanya tersedia untuk Open Tank/Pressurized Vessel yang dashed-attached ke tank/vessel.'],
    ['task.source.defenseReadyNote', 'SRC boundary explanation is ready for advisor review: dropdown meaning, input basis, formula sequence, journal link, and NPSHa role.', 'Penjelasan boundary SRC siap ditinjau advisor: makna dropdown, basis input, urutan formula, link jurnal, dan peran NPSHa.']
  ]);

  const RUNTIME_TEXT_ENTRIES = Object.freeze([
    ...FLUID_TASK_TEXT_ENTRIES,
    ...SOURCE_TASK_TEXT_ENTRIES,
    ['menu.runHydraulicNpshEvaluation', 'Validate / Refresh Evidence', 'Validasi / Segarkan Evidence'],
    ['menu.refreshCalculationsConnections', 'Refresh Realtime Views & Connections', 'Segarkan Tampilan Realtime & Koneksi'],
    ['ribbon.solve', 'Validate', 'Validasi'],
    ['ribbon.solveTitle', 'Validate current evidence; realtime autosolve updates results automatically', 'Validasi evidence saat ini; autosolve realtime memperbarui hasil otomatis'],
    ['runtime.toast.saveAs.started', 'Simulation file download has started. UNTIRTA project file is being saved.', 'Download file simulasi dimulai. File proyek UNTIRTA sedang disimpan.'],
    ['runtime.toast.save.success', 'File saved successfully.', 'File berhasil disimpan.'],
    ['runtime.toast.save.failed', 'Failed to save file. Please check browser file permissions and try again.', 'Gagal menyimpan file. Periksa izin file browser lalu coba lagi.'],
    ['runtime.toast.open.legacyImported', 'Legacy project imported. Use Save As to write the official .untirta file.', 'Proyek legacy berhasil diimpor. Gunakan Save As untuk menulis file resmi .untirta.'],
    ['runtime.toast.open.loaded', 'Simulation file loaded successfully. UNTIRTA project opened.', 'File simulasi berhasil dimuat. Proyek UNTIRTA terbuka.'],
    ['runtime.toast.open.failed', 'Failed to open file. Please choose a valid .untirta project or legacy project file saved by this app.', 'Gagal membuka file. Pilih proyek .untirta yang valid atau file proyek legacy yang disimpan oleh aplikasi ini.'],
    ['runtime.toast.importLegacy.success', 'Legacy project imported. Use Save As to convert it to .untirta.', 'Proyek legacy berhasil diimpor. Gunakan Save As untuk mengonversinya ke .untirta.'],
    ['runtime.toast.importLegacy.failed', 'Failed to import the legacy project file.', 'Gagal mengimpor file proyek legacy.'],
    ['runtime.toast.simulationCase.loadFailed', 'Unable to open the sample case. Open the app through start-untirta.bat and try again.', 'Tidak dapat membuka sample case. Buka aplikasi melalui start-untirta.bat lalu coba lagi.'],
    ['runtime.toast.simulationCase.unavailable', 'Simulation cases could not be loaded. Open the app through the local server using start-untirta.bat.', 'Kasus simulasi tidak dapat dimuat. Buka aplikasi melalui server lokal menggunakan start-untirta.bat.'],
    ['runtime.toast.simulation.refreshedLegacy', 'Hydraulic and NPSH evaluation has been refreshed.', 'Evaluasi hidrolik dan NPSH telah disegarkan.'],
    ['runtime.toast.simulation.refreshed', 'Realtime hydraulic and NPSH evidence has been refreshed.', 'Evidence hidrolik dan NPSH realtime telah disegarkan.'],
    ['runtime.toast.refresh.completeLegacy', 'Calculations, connection labels, and warning status were refreshed.', 'Perhitungan, label koneksi, dan status warning telah disegarkan.'],
    ['runtime.toast.refresh.complete', 'Realtime views, connection labels, and warning status were refreshed.', 'Tampilan realtime, label koneksi, dan status warning telah disegarkan.'],
    ['runtime.toast.dynamic.stopped', 'Realtime dynamic inventory stopped.', 'Dynamic inventory realtime dihentikan.'],
    ['runtime.toast.dynamic.unavailable', 'Dynamic inventory engine is not available. Please reload the application.', 'Engine dynamic inventory tidak tersedia. Muat ulang aplikasi.'],
    ['runtime.toast.view.reset', 'Canvas view reset to the upper-left workspace.', 'Tampilan canvas dikembalikan ke workspace kiri atas.'],
    ['runtime.toast.warning.none', 'No active equipment warnings are currently shown.', 'Tidak ada warning peralatan aktif yang sedang ditampilkan.'],
    ['runtime.toast.curve.unavailable', 'Curve data explanation window is not available.', 'Window penjelasan data kurva tidak tersedia.'],
    ['runtime.title.saveAs', 'Save As', 'Simpan Sebagai'],
    ['runtime.title.save', 'Save', 'Simpan'],
    ['runtime.title.saveFailed', 'Save failed', 'Simpan gagal'],
    ['runtime.title.open', 'Open', 'Buka'],
    ['runtime.title.openFailed', 'Open failed', 'Buka gagal'],
    ['runtime.title.importLegacy', 'Import Legacy', 'Impor Legacy'],
    ['runtime.title.importFailed', 'Import failed', 'Impor gagal'],
    ['runtime.title.simulationCase', 'Simulation Case', 'Kasus Simulasi'],
    ['runtime.title.simulationCasesUnavailable', 'Simulation cases unavailable', 'Kasus simulasi tidak tersedia'],
    ['runtime.title.sampleCaseFailed', 'Sample case failed', 'Sample case gagal'],
    ['runtime.title.simulation', 'Simulation', 'Simulasi'],
    ['runtime.title.refreshComplete', 'Refresh complete', 'Refresh selesai'],
    ['runtime.title.view', 'View', 'Tampilan'],
    ['runtime.title.warnings', 'Warnings', 'Warning'],
    ['runtime.title.dynamicInventory', 'Dynamic Inventory', 'Dynamic Inventory'],
    ['runtime.title.dynamicInventoryReview', 'Dynamic Inventory Review', 'Review Dynamic Inventory'],
    ['menu.flowDynamicState', 'Flow Dynamic State', 'Flow Dynamic State'],
    ['runtime.title.dynamicStepSize', 'Dynamic Step Size', 'Ukuran Step Dinamis'],
    ['runtime.title.realtimeInterval', 'Realtime Interval', 'Interval Realtime'],
    ['runtime.title.curveData', 'Curve Data', 'Data Kurva'],
    ['runtime.confirm.clearCanvas.title', 'Clear Canvas', 'Bersihkan Canvas'],
    ['runtime.confirm.clearCanvas.message', 'Clear all equipment, pipes, connections, and unsaved changes from the canvas?', 'Bersihkan semua peralatan, pipa, koneksi, dan perubahan yang belum disimpan dari canvas?'],
    ['runtime.confirm.clearCanvas.confirm', 'Clear Canvas', 'Bersihkan Canvas'],
    ['runtime.confirm.clearCanvas.cancel', 'Keep Model', 'Pertahankan Model'],
    ['runtime.confirm.sampleCase.confirm', 'Open Sample Case', 'Buka Sample Case'],
    ['runtime.confirm.restorePump.title', 'Restore Previous Pump Inputs', 'Pulihkan Input Pompa Sebelumnya'],
    ['runtime.confirm.restorePump.message', 'Restore previous pump inputs? Current pump input edits made after applying the proposal will be replaced.', 'Pulihkan input pompa sebelumnya? Edit input pompa saat ini setelah proposal diterapkan akan diganti.'],
    ['runtime.confirm.restorePump.confirm', 'Restore Inputs', 'Pulihkan Input'],
    ['runtime.confirm.restorePump.cancel', 'Keep Current', 'Pertahankan Saat Ini'],
    ['runtime.confirm.loadJournal.title', 'Load Journal Import', 'Muat Impor Jurnal'],
    ['runtime.confirm.loadJournal.message', 'Load this journal-derived model to the canvas? Current canvas work will be replaced.', 'Muat model turunan jurnal ini ke canvas? Pekerjaan canvas saat ini akan diganti.'],
    ['runtime.confirm.loadJournal.confirm', 'Load Model', 'Muat Model'],
    ['runtime.confirm.cancel', 'Cancel', 'Batal'],
    ['runtime.confirm.cancelAria', 'Cancel confirmation', 'Batalkan konfirmasi'],
    ['runtime.simulationCase.menu.1', 'Simulation Cases 1', 'Kasus Simulasi 1'],
    ['runtime.simulationCase.menu.2', 'Simulation Cases 2', 'Kasus Simulasi 2'],
    ['runtime.simulationCase.menu.3', 'Simulation Cases 3', 'Kasus Simulasi 3'],
    ['runtime.simulationCase.menu.4', 'Simulation Cases 4', 'Kasus Simulasi 4'],
    ['runtime.simulationCase.menu.5', 'Simulation Cases 5', 'Kasus Simulasi 5'],
    ['runtime.simulationCase.menu.6', 'Simulation Cases 6', 'Kasus Simulasi 6'],
    ['runtime.simulationCase.title.1', 'Pump Feed Water to Deaerator', 'Pompa air umpan ke deaerator'],
    ['runtime.simulationCase.title.2', 'Reflux Centrifugal Pump Evaluation', 'Evaluasi pompa sentrifugal reflux'],
    ['runtime.simulationCase.title.3', 'Pipe Diameter Head Loss Analysis', 'Analisis head loss pada diameter pipa'],
    ['runtime.simulationCase.title.4', 'Methanol Pump NPSH and Impeller Damage', 'Analisis NPSH pompa metanol dan kerusakan impeller'],
    ['runtime.simulationCase.title.5', 'Multistage Centrifugal Pump 118.5 kW', 'Pompa sentrifugal multistage 118,5 kW'],
    ['runtime.simulationCase.title.6', 'P-2941A Hot Water Pump Evaluation', 'Evaluasi pompa air panas P-2941A'],
    ['runtime.simulationCase.disabledIncomplete', 'Temporarily disabled - journal data incomplete.', 'Sementara dinonaktifkan - data jurnal belum lengkap.']
  ]);

  const REALTIME_FIRST_TEXT_KEYS = Object.freeze(new Set([
    'menu.runHydraulicNpshEvaluation',
    'menu.refreshCalculationsConnections',
    'ribbon.solve',
    'ribbon.solveTitle',
    'runtime.toast.simulation.refreshed',
    'runtime.toast.refresh.complete'
  ]));

  const REALTIME_FIRST_LEGACY_TEXT_OVERRIDES = Object.freeze({
    'Run Hydraulic / NPSH Evaluation': 'Validate / Refresh Evidence',
    'Run hydraulic and NPSH evaluation': 'Validate current evidence; realtime autosolve updates results automatically',
    Solve: 'Validate',
    'Hydraulic and NPSH evaluation has been refreshed.': 'Realtime hydraulic and NPSH evidence has been refreshed.',
    'Calculations, connection labels, and warning status were refreshed.': 'Realtime views, connection labels, and warning status were refreshed.'
  });

  const STYLE_GUIDE = Object.freeze({
    preserveSymbols: ['NPSH', 'NPSHa', 'NPSHr', 'SRC', 'SNK', 'Cv', 'K', 'Re', 'rho', 'mu', 'nu'],
    preferredIndonesian: {
      density: 'Densitas',
      vapor_pressure: 'Tekanan uap',
      suction_loss: 'Kerugian sisi isap',
      discharge_loss: 'Kerugian sisi keluar',
      specific_weight: 'Berat spesifik'
    },
    bilingualAllowed: ['Head / tinggi tekan', 'Boundary / batas', 'Route trace / trace route', 'Specific Gravity / SG'],
    note: 'Calculation code must use canonical keys and numbers; language is presentation only.'
  });

  function normalizeLanguage(language) {
    const text = String(language || 'en').trim().toLowerCase();
    return text === 'id' || text === 'ind' || text === 'id-id' || text === 'bahasa indonesia' ? 'id' : 'en';
  }

  function buildTraceTextEntries() {
    return Object.keys(TRACE_KEY_MAPPINGS).flatMap((traceKey) => {
      const item = TRACE_KEY_MAPPINGS[traceKey];
      return [
        { key: item.i18nKey, language: 'en', namespace: 'trace', value: item.en },
        { key: item.i18nKey, language: 'id', namespace: 'trace', value: item.id }
      ];
    });
  }

  function buildArrayTextEntries(rows) {
    return rows.flatMap(([key, en, id]) => [
      { key, language: 'en', namespace: key.split('.')[0] || 'common', value: en },
      { key, language: 'id', namespace: key.split('.')[0] || 'common', value: id }
    ]);
  }

  const I18N_TEXT_ENTRIES = Object.freeze([
    ...buildTraceTextEntries(),
    ...buildArrayTextEntries(ROUTE_TRACE_TEXT_ENTRIES),
    ...buildArrayTextEntries(DIAGNOSTIC_TEXT_ENTRIES),
    ...buildArrayTextEntries(RUNTIME_TEXT_ENTRIES)
  ]);

  function registerTerminology() {
    if (root.EngineeringTerminology && typeof root.EngineeringTerminology.registerTerms === 'function') {
      root.EngineeringTerminology.registerTerms(TERMINOLOGY_TERMS);
      return;
    }
    root.EngineeringTerminologyRawTerms = root.EngineeringTerminologyRawTerms || [];
    root.EngineeringTerminologyRawTerms.push(...TERMINOLOGY_TERMS);
  }

  function registerTextEntries() {
    if (Array.isArray(root.EngineeringI18nRawText)) {
      root.EngineeringI18nRawText = root.EngineeringI18nRawText.filter((entry) => {
        const key = String(entry?.key || '').trim();
        return !REALTIME_FIRST_TEXT_KEYS.has(key);
      });
    }
    if (root.EngineeringI18n && typeof root.EngineeringI18n.registerTextEntries === 'function') {
      root.EngineeringI18n.registerTextEntries(I18N_TEXT_ENTRIES);
      return;
    }
    root.EngineeringI18nRawText = root.EngineeringI18nRawText || [];
    root.EngineeringI18nRawText.push(...I18N_TEXT_ENTRIES);
  }

  function hasTerm(key, language) {
    return !!root.EngineeringTerminology?.getTerm?.(key, { language });
  }

  function hasText(key, language) {
    return !!root.EngineeringI18n?.hasKey?.(key, language);
  }

  function getTraceI18nKey(traceKey) {
    return TRACE_KEY_MAPPINGS[String(traceKey || '')]?.i18nKey || '';
  }

  function getTraceLabel(traceKey, options = {}) {
    const item = TRACE_KEY_MAPPINGS[String(traceKey || '')];
    if (!item) return options.fallback || String(traceKey || '');
    const language = normalizeLanguage(options.language || root.EngineeringI18n?.getActiveLanguage?.() || 'en');
    const fallback = language === 'id' ? item.id : item.en;
    return root.EngineeringI18n?.t?.(item.i18nKey, { language, fallback }) || fallback;
  }

  const RUNTIME_EN_TO_ID = Object.freeze(RUNTIME_TEXT_ENTRIES.reduce((map, [, en, id]) => {
    map[en] = id;
    return map;
  }, {}));

  const RUNTIME_ID_TO_EN = Object.freeze(RUNTIME_TEXT_ENTRIES.reduce((map, [, en, id]) => {
    map[id] = en;
    return map;
  }, {}));

  function getActiveRuntimeLanguage() {
    return normalizeLanguage(
      root.EngineeringI18n?.getActiveLanguage?.({ model: root.globalModel })
      || root.document?.body?.getAttribute?.('data-language')
      || root.document?.documentElement?.getAttribute?.('lang')
      || 'en'
    );
  }

  function translateRuntimePattern(text, language) {
    const value = String(text || '');
    let match = value.match(/^Simulation Cases (\d+)$/);
    if (match) return language === 'id' ? `Kasus Simulasi ${match[1]}` : value;
    match = value.match(/^Kasus Simulasi (\d+)$/);
    if (match) return language === 'en' ? `Simulation Cases ${match[1]}` : value;
    match = value.match(/^Source Formula Defense\s*-\s*(.+)$/);
    if (match) return language === 'id' ? `Defense Formula Source - ${match[1]}` : value;
    match = value.match(/^Defense Formula Source\s*-\s*(.+)$/);
    if (match) return language === 'en' ? `Source Formula Defense - ${match[1]}` : value;
    match = value.match(/^Source Object Properties\s*-\s*(.+)$/);
    if (match) return language === 'id' ? `Properti Objek Source - ${match[1]}` : value;
    match = value.match(/^Properti Objek Source\s*-\s*(.+)$/);
    if (match) return language === 'en' ? `Source Object Properties - ${match[1]}` : value;

    if (language === 'id') {
      match = value.match(/^(.+): sample case loaded to canvas\.$/);
      if (match) return `${translateRuntimeText(match[1], { language })}: sample case dimuat ke canvas.`;
      match = value.match(/^Open (.+)\? Current canvas work will be replaced by this sample case\.$/);
      if (match) return `Buka ${translateRuntimeText(match[1], { language })}? Pekerjaan canvas saat ini akan diganti oleh sample case ini.`;
      match = value.match(/^Dynamic inventory timestep set to (.+)\.$/);
      if (match) return `Timestep dynamic inventory diatur ke ${match[1]}.`;
      match = value.match(/^Realtime dynamic inventory interval set to (.+)\.$/);
      if (match) return `Interval realtime dynamic inventory diatur ke ${match[1]}.`;
      match = value.match(/^Realtime dynamic inventory started\. Step = (.+), interval = (.+)\.$/);
      if (match) return `Dynamic inventory realtime dimulai. Step = ${match[1]}, interval = ${match[2]}.`;
      match = value.match(/^(.+) step complete at t=(.+)\. No tank level changed; check net flow, tank diameter, and tank level\.$/);
      if (match) return `Step ${match[1]} selesai pada t=${match[2]}. Tidak ada level tangki yang berubah; periksa net flow, diameter tangki, dan level tangki.`;
      match = value.match(/^Unable to load (.+) \((\d+)\)\.$/);
      if (match) return `Tidak dapat memuat ${match[1]} (${match[2]}).`;
    } else {
      match = value.match(/^(.+): sample case dimuat ke canvas\.$/);
      if (match) return `${translateRuntimeText(match[1], { language })}: sample case loaded to canvas.`;
      match = value.match(/^Buka (.+)\? Pekerjaan canvas saat ini akan diganti oleh sample case ini\.$/);
      if (match) return `Open ${translateRuntimeText(match[1], { language })}? Current canvas work will be replaced by this sample case.`;
      match = value.match(/^Timestep dynamic inventory diatur ke (.+)\.$/);
      if (match) return `Dynamic inventory timestep set to ${match[1]}.`;
      match = value.match(/^Interval realtime dynamic inventory diatur ke (.+)\.$/);
      if (match) return `Realtime dynamic inventory interval set to ${match[1]}.`;
      match = value.match(/^Dynamic inventory realtime dimulai\. Step = (.+), interval = (.+)\.$/);
      if (match) return `Realtime dynamic inventory started. Step = ${match[1]}, interval = ${match[2]}.`;
      match = value.match(/^Step (.+) selesai pada t=(.+)\. Tidak ada level tangki yang berubah; periksa net flow, diameter tangki, dan level tangki\.$/);
      if (match) return `${match[1]} step complete at t=${match[2]}. No tank level changed; check net flow, tank diameter, and tank level.`;
      match = value.match(/^Tidak dapat memuat (.+) \((\d+)\)\.$/);
      if (match) return `Unable to load ${match[1]} (${match[2]}).`;
    }

    return value;
  }

  function translateRuntimeText(value, options = {}) {
    if (value === null || value === undefined) return value;
    const text = String(value);
    if (!text.trim()) return text;
    const language = normalizeLanguage(options.language || getActiveRuntimeLanguage());
    if (language === 'id') {
      return RUNTIME_EN_TO_ID[text] || translateRuntimePattern(text, language);
    }
    return RUNTIME_ID_TO_EN[text] || translateRuntimePattern(text, language);
  }

  function pickLocalizedValue(value, language, fallback = '') {
    const lang = normalizeLanguage(language);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return String(value[lang] || value.en || value.id || fallback || '');
    }
    return translateRuntimeText(value || fallback || '', { language: lang });
  }

  function localizeSimulationCasesManifest(manifest, options = {}) {
    if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.cases)) return manifest;
    const language = normalizeLanguage(options.language || getActiveRuntimeLanguage());
    return {
      ...manifest,
      cases: manifest.cases.map((entry, index) => {
        const fallbackMenuTitle = entry.menuTitle || `Simulation Cases ${index + 1}`;
        const fallbackTitle = entry.title || fallbackMenuTitle;
        const fallbackDisabled = entry.disabledReason || 'Temporarily disabled - journal data incomplete.';
        return {
          ...entry,
          menuTitle: pickLocalizedValue(entry.menuTitleI18n, language, fallbackMenuTitle),
          title: pickLocalizedValue(entry.titleI18n, language, fallbackTitle),
          disabledReason: pickLocalizedValue(entry.disabledReasonI18n, language, fallbackDisabled)
        };
      })
    };
  }

  function translateRuntimeOptions(options = {}) {
    if (!options || typeof options !== 'object') return options;
    const localized = { ...options };
    ['title', 'message', 'confirmLabel', 'cancelLabel', 'label', 'ariaLabel'].forEach((key) => {
      if (typeof localized[key] === 'string') localized[key] = translateRuntimeText(localized[key]);
    });
    return localized;
  }

  function patchRuntimeFunction(name, localizer) {
    const original = root[name];
    if (typeof original !== 'function' || original.__engineeringBilingualPatched) return false;
    const wrapped = function engineeringBilingualPatchedFunction(...args) {
      return original.apply(this, localizer(args));
    };
    wrapped.__engineeringBilingualPatched = true;
    wrapped.__engineeringBilingualOriginal = original;
    root[name] = wrapped;
    return true;
  }

  function patchRuntimeFunctions() {
    patchRuntimeFunction('showUiToast', (args) => {
      const [message, options = {}] = args;
      return [translateRuntimeText(message), translateRuntimeOptions(options)];
    });
    patchRuntimeFunction('showUiConfirm', (args) => [translateRuntimeOptions(args[0] || {})]);
    patchRuntimeFunction('applySimulationState', (args) => {
      const [stateText, ...rest] = args;
      if (typeof stateText !== 'string') return args;
      try {
        const data = JSON.parse(stateText);
        const sourceOrigin = data?.projectFile?.sourceFormat === 'journal-import-pdf-mvp'
          || data?.model?.SETTINGS?.props?.importSource === 'Journal Import'
          ? 'journal-import'
          : 'simulation-state';
        let changed = applySourceStandardFormToProject(data, sourceOrigin);
        if (data?.model && (!data.model.SETTINGS || !data.model.SETTINGS.props?.language)) {
          data.model.SETTINGS = data.model.SETTINGS || { type: 'settings', name: 'Simulation Settings', props: {} };
          data.model.SETTINGS.type = data.model.SETTINGS.type || 'settings';
          data.model.SETTINGS.name = data.model.SETTINGS.name || 'Simulation Settings';
          data.model.SETTINGS.props = data.model.SETTINGS.props || {};
          data.model.SETTINGS.props.language = getActiveRuntimeLanguage();
          changed = true;
        }
        if (changed) {
          return [JSON.stringify(data), ...rest];
        }
      } catch (error) {
        return args;
      }
      return args;
    });
    patchSourceStandardJournalImportBuilder();
  }

  const runtimeOriginalTextNodes = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  const LEGACY_RUNTIME_ID_TO_EN = Object.freeze({
    'Water (Otomatis)': 'Water (Auto)',
    'Methanol (Otomatis)': 'Methanol (Auto)',
    'Fluid Basis menghitung properti fluida utama dari korelasi, tabel, data jurnal, atau input user. Properti turunan dihitung dengan persamaan standar mekanika fluida. Density dan vapor pressure mendukung screening NPSH, sedangkan viscosity diperlukan untuk Reynolds number, friction factor, head loss, dan validasi system curve.': 'Fluid Basis calculates primary fluid properties from correlation, table, journal data, or user input. Derived properties are calculated using standard fluid mechanics equations. Density and vapor pressure support NPSH screening, while viscosity is required for Reynolds number, friction factor, head loss, and system curve validation.',
    'Set utama yang dipakai oleh perhitungan NPSH steady-state, pressure head, Reynolds/friksi, suction loss, dan hidrolik saat ini.': 'Primary set used by the current steady-state NPSH, pressure-head, Reynolds/friction, suction-loss, and hydraulic calculations.',
    'Specific gravity; volume spesifik; kalor spesifik; modulus bulk; kecepatan suara': 'Specific gravity; specific volume; specific heat; bulk modulus; speed of sound',
    'Disimpan untuk audit formula, validasi sumber, perbandingan literatur, dan riset termal/transien berikutnya; bukan term utama NPSHₐ pada model steady-state saat ini.': 'Kept for formula audit, source validation, literature comparison, and future thermal/transient research; not primary NPSHₐ terms in the current steady-state model.',
    'Densitas -> specific gravity, volume spesifik, berat spesifik': 'Density -> specific gravity, specific volume, specific weight',
    'Perhitungan hidrolik memperlakukan cairan sebagai satu fase dan inkompresibel untuk screening.': 'Hydraulic calculations treat the liquid as single-phase and incompressible for screening.',
    'Fluid Basis hanya valid sejauh sumber properti yang dipilih valid.': 'Fluid Basis is valid only as far as the selected property source is valid.',
    'Screening NPSH dapat memakai density dan absolute vapor pressure, tetapi hydraulic loss dan validasi system curve memerlukan viscosity.': 'NPSH screening can use density and absolute vapor pressure, but hydraulic loss and system curve validation require viscosity.',
    'Specific heat, bulk modulus, speed of sound, specific gravity, dan specific volume disimpan sebagai properti pendukung untuk audit atau studi lanjutan, bukan sebagai term utama NPSH steady-state.': 'Specific heat, bulk modulus, speed of sound, specific gravity, and specific volume are retained as supporting audit or future-study properties, not as primary steady-state NPSH terms.',
    'Nilai Custom Fluid harus dipertahankan dengan data lab, vendor, NIST, REFPROP, ASTM, API, atau peer-reviewed ketika statusnya belum Verified.': 'Custom Fluid values must be defended with lab, vendor, NIST, REFPROP, ASTM, API, or peer-reviewed data when the status is not Verified.',
    'Validasi akademik/desain final sebaiknya memakai data laboratorium, vendor, NIST, REFPROP, ASTM, API, atau peer-reviewed ketika statusnya belum Verified.': 'Final academic/design validation should use laboratory, vendor, NIST, REFPROP, ASTM, API, or peer-reviewed data when the status is not Verified.',
    'SRC adalah boundary suction upstream untuk network pompa. SRC memasok absolute pressure, source elevation, fluid basis, flow basis, dan informasi hydraulic path. Nilai ini dikonversi menjadi source hydraulic head lalu dipakai Pump Object untuk menghitung NPSHa.': 'SRC is the upstream suction boundary for the pump network. It supplies absolute pressure, source elevation, fluid basis, flow basis, and hydraulic path information. These values are converted into source hydraulic head and then used by the Pump Object to calculate NPSHa.',
    'SRC tidak menentukan risiko kavitasi final sendirian. Verdict final berada di Pump Object Properties, tempat NPSHa dari sistem dibandingkan dengan NPSHr pump/vendor/journal dan margin basis yang dipilih.': 'SRC does not decide final cavitation risk by itself. The final verdict is in Pump Object Properties, where system-derived NPSHa is compared against pump/vendor/journal NPSHr and the selected margin basis.',
    'Pipa hidrolik solid dari SRC wajib untuk perhitungan flow dan pressure loss.': 'Solid hydraulic pipe from SRC is required for flow and pressure-loss calculation.',
    'Inherit hanya tersedia untuk Open Tank/Pressurized Vessel yang dashed-attached ke tank/vessel.': 'Inherit is only available for Open Tank/Pressurized Vessel dashed-attached to a tank/vessel.',
    'Source Flow Tetap': 'Fixed Flow Source',
    'Boundary attachment semantik': 'Semantic boundary attachment'
  });

  function normalizeRuntimeOriginalText(text) {
    const trimmed = String(text || '').trim();
    return REALTIME_FIRST_LEGACY_TEXT_OVERRIDES[trimmed] || LEGACY_RUNTIME_ID_TO_EN[trimmed] || RUNTIME_ID_TO_EN[trimmed] || translateRuntimePattern(trimmed, 'en');
  }

  function preserveTextWhitespace(currentText, translated) {
    const current = String(currentText || '');
    const prefix = current.match(/^\s*/)?.[0] || '';
    const suffix = current.match(/\s*$/)?.[0] || '';
    return `${prefix}${translated}${suffix}`;
  }

  function localizeRuntimeTextNode(node) {
    if (!node || node.nodeType !== 3 || !runtimeOriginalTextNodes) return;
    const current = node.nodeValue || '';
    if (!current.trim()) return;
    let original = runtimeOriginalTextNodes.get(node);
    if (!original) {
      original = normalizeRuntimeOriginalText(current);
      runtimeOriginalTextNodes.set(node, original);
    }
    const translated = translateRuntimeText(original);
    const nextValue = preserveTextWhitespace(current, translated);
    if (nextValue !== current) node.nodeValue = nextValue;
  }

  function localizeRuntimeAttributes(element) {
    if (!element || element.nodeType !== 1 || !element.getAttribute) return;
    ['title', 'aria-label', 'placeholder'].forEach((attr) => {
      const current = element.getAttribute(attr);
      if (!current || !current.trim()) return;
      const key = `engineeringRuntimeOriginal${attr.replace(/[^a-z]/gi, '')}`;
      if (!element.dataset[key]) element.dataset[key] = normalizeRuntimeOriginalText(current);
      const translated = translateRuntimeText(element.dataset[key]);
      if (translated && translated !== current) element.setAttribute(attr, translated);
    });
  }

  function localizeRuntimeOption(option) {
    if (!option || option.nodeType !== 1 || !/^OPTION$/i.test(option.tagName || '')) return;
    const current = option.textContent || '';
    if (!current.trim()) return;
    if (!option.dataset.engineeringRuntimeOriginalOptionText) {
      option.dataset.engineeringRuntimeOriginalOptionText = normalizeRuntimeOriginalText(current);
    }
    const translated = translateRuntimeText(option.dataset.engineeringRuntimeOriginalOptionText);
    const nextValue = preserveTextWhitespace(current, translated);
    if (nextValue !== current) option.textContent = nextValue;
  }

  function localizeRuntimeNodeTree(node = root.document?.body) {
    if (!node || !root.document) return;
    if (node.nodeType === 3) {
      localizeRuntimeTextNode(node);
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType === 1) localizeRuntimeAttributes(node);
    if (node.nodeType === 1 && /^OPTION$/i.test(node.tagName || '')) localizeRuntimeOption(node);
    if (node.querySelectorAll) node.querySelectorAll('option').forEach(localizeRuntimeOption);
    const walker = root.document.createTreeWalker(node, 5, {
      acceptNode(candidate) {
        const parent = candidate.nodeType === 3 ? candidate.parentElement : candidate;
        if (parent && /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION)$/i.test(parent.tagName || '')) {
          return 2;
        }
        return 1;
      }
    });
    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === 3) localizeRuntimeTextNode(current);
      else if (current.nodeType === 1) localizeRuntimeAttributes(current);
      current = walker.nextNode();
    }
  }

  function getRuntimeModel() {
    return root.__npshGlobalModel || root.globalModel || root.DEFAULT_SIMULATION_STATE?.model || {};
  }

  function getSourceDefenseText(en, id) {
    return getActiveRuntimeLanguage() === 'id' ? id : en;
  }

  function getFirstSourceNode(model, sourceId = '') {
    if (!model || typeof model !== 'object') return { id: sourceId || 'SRC', node: null };
    const preferred = sourceId && model[sourceId] && String(model[sourceId].type || '').toLowerCase() === 'source'
      ? [sourceId, model[sourceId]]
      : Object.entries(model).find(([, node]) => String(node?.type || '').toLowerCase() === 'source');
    return preferred ? { id: preferred[0], node: preferred[1] } : { id: sourceId || 'SRC', node: null };
  }

  function cloneSourceStandardFormContract() {
    return {
      ...SOURCE_STANDARD_FORM_CONTRACT,
      appliesTo: SOURCE_STANDARD_FORM_CONTRACT.appliesTo.slice(),
      requiredSections: SOURCE_STANDARD_FORM_SECTIONS.slice(),
      requiredFieldKeys: SOURCE_STANDARD_FORM_FIELD_KEYS.slice(),
      reportFields: SOURCE_STANDARD_REPORT_FIELDS.slice()
    };
  }

  function applySourceStandardPropsToSource(sourceNode, origin = 'runtime') {
    if (!sourceNode || String(sourceNode.type || '').toLowerCase() !== 'source') return false;
    sourceNode.props = sourceNode.props || {};
    const props = sourceNode.props;
    let changed = false;
    const assign = (key, value) => {
      if (props[key] === value) return;
      props[key] = value;
      changed = true;
    };
    assign('standardFormSchemaVersion', SOURCE_STANDARD_FORM_SCHEMA_VERSION);
    assign('standardFormLockVersion', SOURCE_STANDARD_FORM_LOCK);
    assign('standardFormProfile', 'SRC Object Properties Standard');
    assign('standardFormValuePolicy', SOURCE_STANDARD_FORM_VALUE_POLICY);
    assign('sourceFormulaDefenseRequired', true);
    assign('sourceFormulaDefenseButton', 'Source Formula Defense');
    assign('sourceStandardInputOrigin', origin);
    if (!Array.isArray(props.standardFormSections)
      || props.standardFormSections.join('|') !== SOURCE_STANDARD_FORM_SECTIONS.join('|')) {
      props.standardFormSections = SOURCE_STANDARD_FORM_SECTIONS.slice();
      changed = true;
    }
    if (!Array.isArray(props.standardReportFields)
      || props.standardReportFields.join('|') !== SOURCE_STANDARD_REPORT_FIELDS.join('|')) {
      props.standardReportFields = SOURCE_STANDARD_REPORT_FIELDS.slice();
      changed = true;
    }
    return changed;
  }

  function applySourceStandardFormToProject(project, origin = 'runtime') {
    if (!project || typeof project !== 'object' || !project.model || typeof project.model !== 'object') return false;
    let changed = false;
    Object.values(project.model).forEach((node) => {
      if (applySourceStandardPropsToSource(node, origin)) changed = true;
    });
    project.validationAudit = project.validationAudit || {};
    const nextAudit = {
      schemaVersion: SOURCE_STANDARD_FORM_SCHEMA_VERSION,
      lockVersion: SOURCE_STANDARD_FORM_LOCK,
      requiredSections: SOURCE_STANDARD_FORM_SECTIONS.slice(),
      valuePolicy: SOURCE_STANDARD_FORM_VALUE_POLICY,
      sourceFormulaDefenseRequired: true,
      origin
    };
    const currentAudit = project.validationAudit.srcStandardForm || null;
    if (JSON.stringify(currentAudit) !== JSON.stringify(nextAudit)) {
      project.validationAudit.srcStandardForm = nextAudit;
      changed = true;
    }
    return changed;
  }

  function patchSourceStandardJournalImportBuilder() {
    const original = root.buildJournalImportProjectData;
    if (typeof original !== 'function' || original.__sourceStandardFormPatched) return false;
    function sourceStandardJournalImportProjectData(...args) {
      const project = original.apply(this, args);
      applySourceStandardFormToProject(project, 'journal-import');
      return project;
    }
    sourceStandardJournalImportProjectData.__sourceStandardFormPatched = true;
    sourceStandardJournalImportProjectData.__sourceStandardFormOriginal = original;
    root.buildJournalImportProjectData = sourceStandardJournalImportProjectData;
    return true;
  }

  function getFluidDefenseBasis(model) {
    const fluid = model?.FLUID?.props || {};
    return {
      name: fluid.fluidName || fluid.name || 'Water',
      density: fluid.density,
      vaporPressure: fluid.vaporPressure,
      viscosity: fluid.viscosity,
      temperature: fluid.temp ?? fluid.temperature
    };
  }

  function formatDefenseValue(value, unit = '', digits = 3) {
    const numeric = Number.parseFloat(value);
    const text = Number.isFinite(numeric)
      ? String(Number(numeric.toFixed(digits)))
      : String(value ?? '').trim();
    return `${text || '-'}${unit ? ` ${unit}` : ''}`;
  }

  function appendSourceDefenseCard(layout, title, builder) {
    const card = root.document.createElement('section');
    card.className = 'fluid-help-card source-formula-defense-fallback-card';
    const heading = root.document.createElement('h3');
    heading.textContent = title;
    card.appendChild(heading);
    const content = typeof builder === 'function' ? builder() : builder;
    if (content) card.appendChild(content);
    layout.appendChild(card);
    return card;
  }

  function createSourceDefenseParagraphs(lines) {
    const wrap = root.document.createElement('div');
    wrap.className = 'fluid-help-text-block source-formula-defense-fallback-text';
    lines.forEach((line) => {
      const paragraph = root.document.createElement('p');
      paragraph.textContent = line;
      wrap.appendChild(paragraph);
    });
    return wrap;
  }

  function createSourceDefenseList(items, className = 'fluid-help-list') {
    const list = root.document.createElement('ul');
    list.className = className;
    items.forEach((item) => {
      const row = root.document.createElement('li');
      row.textContent = item;
      list.appendChild(row);
    });
    return list;
  }

  function createSourceDefenseTable(headers, rows) {
    const wrap = root.document.createElement('div');
    wrap.className = 'pump-curve-explanation-table-wrap source-formula-defense-fallback-table-wrap';
    const table = root.document.createElement('table');
    table.className = 'pump-curve-explanation-table source-formula-defense-fallback-table';
    const thead = root.document.createElement('thead');
    const headRow = root.document.createElement('tr');
    headers.forEach((header) => {
      const cell = root.document.createElement('th');
      cell.textContent = header;
      headRow.appendChild(cell);
    });
    thead.appendChild(headRow);
    const tbody = root.document.createElement('tbody');
    rows.forEach((row) => {
      const tr = root.document.createElement('tr');
      row.forEach((value) => {
        const cell = root.document.createElement('td');
        cell.textContent = String(value ?? '-');
        tr.appendChild(cell);
      });
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function installSourceDefenseLayoutStyle() {
    if (!root.document || root.document.getElementById('engineering-source-defense-layout-style')) return;
    const style = root.document.createElement('style');
    style.id = 'engineering-source-defense-layout-style';
    style.textContent = `
      .source-formula-defense-task-window {
        font-size: 12px;
      }
      .source-formula-defense-task-window .source-formula-defense-body {
        padding: 10px 12px;
      }
      .source-formula-defense-task-window .source-formula-defense-layout {
        gap: 8px;
      }
      .source-formula-defense-task-window .source-formula-defense-fallback-card {
        border-radius: 6px;
      }
      .source-formula-defense-task-window .source-formula-defense-fallback-card h3 {
        padding: 9px 11px;
        font-size: 12px;
        line-height: 1.2;
      }
      .source-formula-defense-task-window .source-formula-defense-fallback-text {
        padding: 9px 11px;
        color: #334155;
        font-size: 12px;
        line-height: 1.42;
      }
      .source-formula-defense-task-window .source-formula-defense-fallback-text p {
        margin: 0 0 6px;
        font-size: 12px;
        line-height: 1.42;
      }
      .source-formula-defense-task-window .source-formula-defense-fallback-text p:last-child {
        margin-bottom: 0;
      }
      .source-formula-defense-task-window .source-formula-defense-fallback-table {
        min-width: 560px;
        font-size: 11px;
        line-height: 1.34;
      }
      .source-formula-defense-task-window .source-formula-defense-fallback-table th,
      .source-formula-defense-task-window .source-formula-defense-fallback-table td {
        padding: 6px 8px;
      }
      .source-formula-defense-task-window .fluid-help-list {
        margin: 0;
        padding: 9px 11px 9px 24px;
        color: #334155;
        font-size: 12px;
        line-height: 1.42;
      }
      .source-formula-defense-task-window .fluid-help-list li {
        margin: 0 0 5px;
      }
      .source-formula-defense-task-window .fluid-help-list li:last-child {
        margin-bottom: 0;
      }
      @media (max-width: 639px) {
        .source-formula-defense-task-window .source-formula-defense-body {
          padding: 8px;
        }
        .source-formula-defense-task-window .source-formula-defense-fallback-text,
        .source-formula-defense-task-window .source-formula-defense-fallback-text p,
        .source-formula-defense-task-window .fluid-help-list {
          font-size: 11.5px;
          line-height: 1.38;
        }
        .source-formula-defense-task-window .source-formula-defense-fallback-table-wrap {
          overflow-x: visible;
        }
        .source-formula-defense-task-window .source-formula-defense-fallback-table {
          min-width: 0;
          table-layout: auto;
        }
        .source-formula-defense-task-window .source-formula-defense-fallback-table thead {
          display: none;
        }
        .source-formula-defense-task-window .source-formula-defense-fallback-table,
        .source-formula-defense-task-window .source-formula-defense-fallback-table tbody,
        .source-formula-defense-task-window .source-formula-defense-fallback-table tr,
        .source-formula-defense-task-window .source-formula-defense-fallback-table td {
          display: block;
          width: 100%;
        }
        .source-formula-defense-task-window .source-formula-defense-fallback-table tr {
          padding: 8px 10px;
          border-bottom: 1px solid #edf2f7;
        }
        .source-formula-defense-task-window .source-formula-defense-fallback-table td {
          border-bottom: 0;
          padding: 2px 0;
        }
        .source-formula-defense-task-window .source-formula-defense-fallback-table td:nth-child(1) {
          color: #52606d;
          font-weight: 600;
        }
        .source-formula-defense-task-window .source-formula-defense-fallback-table td:nth-child(2) {
          color: #0f172a;
          font-weight: 700;
        }
        .source-formula-defense-task-window .source-formula-defense-fallback-table td:nth-child(3) {
          color: #334155;
          font-weight: 400;
        }
      }
    `;
    root.document.head.appendChild(style);
  }

  function installSourceAdvisorVisibilityStyle() {
    if (!root.document || root.document.getElementById('engineering-source-advisor-visibility-style')) return;
    const style = root.document.createElement('style');
    style.id = 'engineering-source-advisor-visibility-style';
    style.textContent = `
      .persistent-object-properties-task-window[data-advisor-hide-pump-readiness="true"] .caption-audit-pump-action-readiness,
      .persistent-object-properties-task-window[data-node-id^="SRC-"] .caption-audit-pump-action-readiness {
        display: none !important;
      }
      .persistent-object-properties-task-window[data-advisor-hide-semantic-attachment="true"] [data-advisor-hidden-section="source-semantic-attachment"],
      .persistent-object-properties-task-window[data-advisor-hide-hydraulic-connection="true"] [data-advisor-hidden-section="source-hydraulic-connection"],
      .persistent-object-properties-task-window[data-advisor-hide-generic-meaning="true"] [data-advisor-hidden-section="source-generic-meaning"],
      .persistent-object-properties-task-window [data-advisor-audit-lock="${SOURCE_ADVISOR_AUDIT_LOCK}"] {
        display: none !important;
      }
      .persistent-object-properties-task-window .source-header-with-defense {
        padding: 7px 10px !important;
        vertical-align: middle;
      }
      .persistent-object-properties-task-window .source-header-defense-layout {
        align-items: center;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        min-width: 0;
        width: 100%;
      }
      .persistent-object-properties-task-window .source-header-title {
        color: inherit;
        flex: 1 1 auto;
        font-weight: 700;
        min-width: 0;
        overflow: hidden;
        text-align: left;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .persistent-object-properties-task-window .source-header-actions {
        align-items: center;
        display: inline-flex;
        flex: 0 0 auto;
        justify-content: flex-end;
        min-width: max-content;
      }
      .persistent-object-properties-task-window .source-header-actions .source-formula-defense-btn {
        line-height: 1.2;
        margin: 0;
        max-width: min(220px, 52vw);
        min-height: 28px;
        padding: 4px 12px;
        white-space: nowrap;
      }
      .persistent-object-properties-task-window[data-source-fluid-basis-link-layout-lock="${SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK}"] .object-task-field-row[data-prop-key="source-fluid-dynamic-viscosity"],
      .persistent-object-properties-task-window[data-source-fluid-basis-link-layout-lock="${SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK}"] .object-task-field-row[data-prop-key="source-fluid-specific-weight"],
      .persistent-object-properties-task-window[data-source-fluid-basis-link-layout-lock="${SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK}"] .object-task-field-row[data-prop-key="source-fluid-vapor-pressure-head"] {
        min-height: 34px;
        overflow-anchor: none;
      }
      .persistent-object-properties-task-window[data-source-fluid-basis-link-layout-lock="${SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK}"] [data-source-fluid-basis-derived="true"] .prop-value {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      @media (max-width: 520px) {
        .persistent-object-properties-task-window .source-header-defense-layout {
          align-items: center;
          flex-direction: row;
          gap: 8px;
        }
        .persistent-object-properties-task-window .source-header-actions {
          justify-content: flex-end;
        }
        .persistent-object-properties-task-window .source-header-actions .source-formula-defense-btn {
          max-width: 58vw;
          white-space: normal;
        }
      }
    `;
    root.document.head.appendChild(style);
  }

  function markSourceStandardFormLock(windowNode) {
    if (!windowNode?.dataset) return;
    if (windowNode.dataset.sourceStandardFormLock !== 'locked') windowNode.dataset.sourceStandardFormLock = 'locked';
    if (windowNode.dataset.sourceStandardFormSchemaVersion !== SOURCE_STANDARD_FORM_SCHEMA_VERSION) {
      windowNode.dataset.sourceStandardFormSchemaVersion = SOURCE_STANDARD_FORM_SCHEMA_VERSION;
    }
    if (windowNode.dataset.sourceStandardFormLockVersion !== SOURCE_STANDARD_FORM_LOCK) {
      windowNode.dataset.sourceStandardFormLockVersion = SOURCE_STANDARD_FORM_LOCK;
    }
    if (windowNode.dataset.sourceStandardValuePolicy !== SOURCE_STANDARD_FORM_VALUE_POLICY) {
      windowNode.dataset.sourceStandardValuePolicy = SOURCE_STANDARD_FORM_VALUE_POLICY;
    }
    if (windowNode.dataset.sourceStandardSections !== SOURCE_STANDARD_FORM_SECTIONS.join('|')) {
      windowNode.dataset.sourceStandardSections = SOURCE_STANDARD_FORM_SECTIONS.join('|');
    }
    if (windowNode.dataset.sourceStandardFormulaDefense !== 'required') {
      windowNode.dataset.sourceStandardFormulaDefense = 'required';
    }
  }

  function validateSourceStandardFormWindow(windowNode) {
    const text = String(windowNode?.textContent || '').replace(/\s+/g, ' ');
    const missingSections = SOURCE_STANDARD_FORM_SECTIONS.filter((section) => {
      const localized = translateRuntimeText(section);
      return !text.includes(section) && !text.includes(localized);
    });
    const hasDefenseButton = !!windowNode?.querySelector?.('.source-formula-defense-btn, [data-source-formula-defense]');
    return {
      ok: missingSections.length === 0 && hasDefenseButton,
      schemaVersion: SOURCE_STANDARD_FORM_SCHEMA_VERSION,
      lockVersion: SOURCE_STANDARD_FORM_LOCK,
      missingSections,
      hasDefenseButton,
      valuePolicy: SOURCE_STANDARD_FORM_VALUE_POLICY
    };
  }

  function markSourceAdvisorAuditLock(windowNode) {
    if (!windowNode?.dataset) return;
    markSourceStandardFormLock(windowNode);
    if (windowNode.dataset.sourceAdvisorAuditLock !== 'locked') windowNode.dataset.sourceAdvisorAuditLock = 'locked';
    if (windowNode.dataset.sourceAdvisorAuditLockVersion !== SOURCE_ADVISOR_AUDIT_LOCK) {
      windowNode.dataset.sourceAdvisorAuditLockVersion = SOURCE_ADVISOR_AUDIT_LOCK;
    }
    if (windowNode.dataset.sourceAdvisorAuditLockReason !== SOURCE_ADVISOR_AUDIT_LOCK_REASON) {
      windowNode.dataset.sourceAdvisorAuditLockReason = SOURCE_ADVISOR_AUDIT_LOCK_REASON;
    }
    if (windowNode.dataset.sourceAdvisorHiddenSections !== SOURCE_ADVISOR_HIDDEN_SECTIONS) {
      windowNode.dataset.sourceAdvisorHiddenSections = SOURCE_ADVISOR_HIDDEN_SECTIONS;
    }
  }

  function lockSourceAdvisorHiddenNode(node, section) {
    if (!node || node.nodeType !== 1) return;
    if (!node.hidden) node.hidden = true;
    if (node.getAttribute('aria-hidden') !== 'true') node.setAttribute('aria-hidden', 'true');
    if (node.getAttribute('data-advisor-audit-lock') !== SOURCE_ADVISOR_AUDIT_LOCK) {
      node.setAttribute('data-advisor-audit-lock', SOURCE_ADVISOR_AUDIT_LOCK);
    }
    if (node.getAttribute('data-advisor-audit-lock-section') !== section) {
      node.setAttribute('data-advisor-audit-lock-section', section);
    }
    if (node.getAttribute('data-advisor-audit-lock-reason') !== SOURCE_ADVISOR_AUDIT_LOCK_REASON) {
      node.setAttribute('data-advisor-audit-lock-reason', SOURCE_ADVISOR_AUDIT_LOCK_REASON);
    }
    if (node.style?.getPropertyValue?.('display') !== 'none' || node.style?.getPropertyPriority?.('display') !== 'important') {
      node.style?.setProperty?.('display', 'none', 'important');
    }
  }

  function getModelNodeType(nodeId = '') {
    const node = getRuntimeModel()?.[nodeId];
    return String(node?.type || '').toLowerCase();
  }

  function isSourceObjectPropertiesWindow(windowNode) {
    if (!windowNode || windowNode.nodeType !== 1) return false;
    if (!windowNode.classList?.contains('persistent-object-properties-task-window')) return false;
    const nodeId = String(windowNode.dataset?.nodeId || '').trim();
    if (getModelNodeType(nodeId) === 'source') return true;
    const label = String(windowNode.getAttribute?.('aria-label') || windowNode.textContent || '');
    return /^SRC[-_]/i.test(nodeId) || /Properti Objek Source|Source Object Properties/i.test(label);
  }

  function getSourceAdvisorHiddenSection(text = '', node = null) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    const propKey = String(node?.dataset?.propKey || node?.dataset?.fieldKey || node?.getAttribute?.('data-prop-key') || node?.getAttribute?.('data-field-key') || '').trim();
    if (propKey === 'source-boundary-role') return 'source-boundary-role';
    if (isSourceTypeMeaningText(value)) return '';
    if (isSourceGenericMeaningText(value, node)) return 'source-generic-meaning';
    if (/^Boundary Role\b/i.test(value)
      || /^Peran Boundary\b/i.test(value)
      || /^Hydraulic boundary\s*\/\s*tie-in$/i.test(value)
      || /^Boundary hidrolik\s*\/\s*tie-in$/i.test(value)
      || /^Semantic attachment boundary$/i.test(value)
      || /^Attachment boundary semantic$/i.test(value)
      || /^Boundary Role\s+(Hydraulic boundary|Semantic attachment)/i.test(value)
      || /^Peran Boundary\s+(Boundary hidrolik|Attachment boundary)/i.test(value)) {
      return 'source-boundary-role';
    }
    if (/Advisor-ready SRC boundary explanation/i.test(value)
      || /SRC boundary explanation is ready for advisor review/i.test(value)
      || /dropdown meaning, input basis, formula sequence, journal link, and NPSHa role/i.test(value)
      || /Penjelasan boundary SRC siap ditinjau advisor/i.test(value)
      || /makna dropdown, basis input, urutan formula, link jurnal, dan peran NPSHa/i.test(value)) {
      return 'source-defense-ready-note';
    }
    if (/^Attachment Semantik$/i.test(value)
      || /^Semantic Attachment$/i.test(value)
      || /^Peran Attachment/i.test(value)
      || /^Attachment Role/i.test(value)
      || /^Equipment Ter-attach/i.test(value)
      || /^Attached Equipment/i.test(value)
      || /^Kebutuhan Hidrolik/i.test(value)
      || /^Hydraulic Requirement/i.test(value)
      || /^Path Hidrolik ke Pompa/i.test(value)
      || /^Hydraulic Path to Pump/i.test(value)
      || /^Path Isap/i.test(value)
      || /^Suction Path/i.test(value)
      || /^Peringatan Path/i.test(value)
      || /^Path Warning/i.test(value)
      || /^Hanya attachment\./i.test(value)
      || /^Attachment only\./i.test(value)
      || /attachment dashed|dashed-attached|semantic attachment|semantik|ter-attach/i.test(value)
      || /Mulai Attachment Dashed Tangki\/Vessel/i.test(value)
      || /Start Dashed Tank\/Vessel Attachment/i.test(value)) {
      return 'source-semantic-attachment';
    }
    if (/^Hydraulic Connection$/i.test(value)
      || /^Koneksi Hidrolik$/i.test(value)
      || /^Connection Role/i.test(value)
      || /^Peran Koneksi/i.test(value)
      || /^Solid Pipe\(s\)/i.test(value)
      || /^Pipa Solid/i.test(value)
      || /^Hydraulic boundary; solid pipe required/i.test(value)
      || /^Boundary hidrolik; pipa solid wajib/i.test(value)
      || /^Solid hydraulic pipe from SRC is required/i.test(value)
      || /^Pipa hidrolik solid dari SRC wajib/i.test(value)
      || /^Connect the SRC outlet .*solid hydraulic connection/i.test(value)
      || /^Hubungkan outlet SRC .*koneksi hidrolik solid/i.test(value)
      || /solid pipe required|pipa solid wajib|solid hydraulic pipe from SRC|pipa hidrolik solid dari SRC/i.test(value)) {
      return 'source-hydraulic-connection';
    }
    return '';
  }

  function isSourceSemanticAttachmentText(text = '') {
    return getSourceAdvisorHiddenSection(text) === 'source-semantic-attachment';
  }

  function isSourceTypeMeaningText(text = '') {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    return /^Type Meaning\b/i.test(value)
      || /^Makna Tipe\b/i.test(value);
  }

  function isSourceGenericMeaningText(text = '', node = null) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    const propKey = String(node?.dataset?.propKey || node?.dataset?.fieldKey || node?.getAttribute?.('data-prop-key') || node?.getAttribute?.('data-field-key') || '').trim();
    if (!value && !propKey) return false;
    if (propKey === 'source-type-meaning' || /source[-_]?type[-_]?meaning|typeMeaning/i.test(propKey) || isSourceTypeMeaningText(value)) return false;
    if (/(^|[-_])(meaning|makna)([-_]|$)/i.test(propKey)) return true;
    if (/^Meaning\b/i.test(value) || /^Makna\b/i.test(value) || /^Maknanya\b/i.test(value)) return true;
    return /dashed attachment may inherit/i.test(value)
      || /flow still needs a real hydraulic path/i.test(value)
      || /attachment dashed.*mewarisi/i.test(value)
      || /mewarisi.*(tank|tangki|vessel).*path hidrolik/i.test(value)
      || /path hidrolik nyata|jalur hidrolik nyata/i.test(value);
  }

  function normalizeSourceTypeForMeaning(sourceType = '') {
    const value = String(sourceType || '').replace(/\s+/g, ' ').trim();
    return RUNTIME_ID_TO_EN[value] || value || 'Open Tank / Reservoir';
  }

  function getSourceTypeMeaningText(sourceType = '') {
    const language = getActiveRuntimeLanguage();
    const type = normalizeSourceTypeForMeaning(sourceType);
    const fallback = {
      'Open Tank / Reservoir': {
        en: 'Atmospheric tank or reservoir boundary. Pressure and elevation define the upstream source head basis.',
        id: 'Boundary tangki/reservoir atmosferik; tekanan dan elevasi menentukan basis head source upstream.'
      },
      'Pressurized Vessel': {
        en: 'Pressurized vessel boundary. Vessel pressure and liquid elevation define the upstream source head basis.',
        id: 'Boundary vessel bertekanan. Tekanan vessel dan elevasi cairan menentukan basis head source upstream.'
      },
      'External Header / Pipe Tie-in': {
        en: 'External header or pipe tie-in boundary. Pressure basis and pressure energy basis define the upstream source head.',
        id: 'Boundary external header atau tie-in pipa. Basis tekanan dan basis energi tekanan menentukan head source upstream.'
      },
      'Fixed Flow Source': {
        en: 'Specified inlet flow boundary; use a solid pipe and review the resulting pressure/head balance.',
        id: 'Boundary flow inlet tertentu; gunakan pipa solid dan review hasil keseimbangan pressure/head.'
      },
      'Standalone Boundary Source': {
        en: 'Standalone manual boundary. Pressure, elevation, and flow data are entered directly on SRC.',
        id: 'Boundary manual mandiri. Data tekanan, elevasi, dan aliran dimasukkan langsung pada SRC.'
      }
    };
    const entry = fallback[type] || fallback['Open Tank / Reservoir'];
    if (language === 'id') return entry.id;
    return entry.en;
  }

  function getSourceTypeValueFromWindow(windowNode) {
    const select = windowNode?.querySelector?.('select[data-key="sourceType"], [data-prop-key="sourceType"] select, select.prop-input-field[data-key="sourceType"]');
    const selectedText = select?.selectedOptions?.[0]?.textContent || '';
    const fromSelect = select?.value || selectedText;
    if (fromSelect) return normalizeSourceTypeForMeaning(fromSelect);
    const nodeId = String(windowNode?.dataset?.nodeId || '').trim();
    const modelNode = getRuntimeModel()?.[nodeId];
    return normalizeSourceTypeForMeaning(modelNode?.props?.sourceType || modelNode?.props?.boundaryMode || '');
  }

  function createSourceTypeMeaningRow(windowNode, sourceTypeRow, sourceType) {
    if (!root.document || !sourceTypeRow?.parentNode) return null;
    const row = root.document.createElement('tr');
    row.className = sourceTypeRow.className || 'pipe-task-field-row object-task-field-row';
    row.dataset.propKey = 'source-type-meaning';
    row.dataset.sourceTypeMeaningVisibleLock = SOURCE_TYPE_MEANING_VISIBLE_LOCK;
    const label = root.document.createElement('td');
    label.className = 'prop-label';
    label.setAttribute('data-i18n-text', 'sidebar.field.typeMeaning');
    label.setAttribute('data-i18n-fallback', 'Type Meaning');
    const value = root.document.createElement('td');
    value.className = 'prop-value';
    value.dataset.key = 'source-type-meaning';
    row.append(label, value);
    sourceTypeRow.insertAdjacentElement('afterend', row);
    updateSourceTypeMeaningRow(row, sourceType);
    return row;
  }

  function updateSourceTypeMeaningRow(row, sourceType = '') {
    if (!row) return;
    const language = getActiveRuntimeLanguage();
    const label = row.querySelector?.('.prop-label') || row.children?.[0];
    const value = row.querySelector?.('.prop-value, [data-key="source-type-meaning"]') || row.children?.[1];
    row.dataset.sourceTypeMeaningVisibleLock = SOURCE_TYPE_MEANING_VISIBLE_LOCK;
    row.dataset.propKey = 'source-type-meaning';
    row.dataset.sourceType = normalizeSourceTypeForMeaning(sourceType);
    if (label) {
      label.setAttribute?.('data-i18n-text', 'sidebar.field.typeMeaning');
      label.setAttribute?.('data-i18n-fallback', 'Type Meaning');
      label.textContent = language === 'id' ? 'Makna Tipe' : 'Type Meaning';
    }
    if (value) {
      value.dataset.key = 'source-type-meaning';
      value.textContent = getSourceTypeMeaningText(sourceType);
    }
  }

  function keepSourceTypeMeaningRowsVisible(windowNode) {
    if (!isSourceObjectPropertiesWindow(windowNode)) return 0;
    const sourceType = getSourceTypeValueFromWindow(windowNode);
    const sourceTypeSelect = windowNode.querySelector?.('select[data-key="sourceType"], select.prop-input-field[data-key="sourceType"]');
    const sourceTypeRow = windowNode.querySelector?.('[data-prop-key="sourceType"]') || sourceTypeSelect?.closest?.('tr, .source-field-row, .object-property-row, .object-task-field-row, .field-card, .object-field, .task-field');
    if (sourceTypeRow) sourceTypeRow.dataset.sourceTypeMeaningAnchor = SOURCE_TYPE_MEANING_VISIBLE_LOCK;
    let restored = 0;
    let rows = Array.from(windowNode.querySelectorAll?.('[data-prop-key="source-type-meaning"], [data-source-type-meaning-visible-lock], tr, .source-field-row, .object-property-row, .object-task-field-row, .source-field-card, .object-field, .field-card, .task-field, [data-field-key]') || [])
      .filter((row) => row?.isConnected && (row.dataset?.propKey === 'source-type-meaning' || row.dataset?.sourceTypeMeaningVisibleLock || isSourceTypeMeaningText(row.textContent)));
    if (!rows.length && sourceTypeRow) {
      const created = createSourceTypeMeaningRow(windowNode, sourceTypeRow, sourceType);
      if (created) {
        rows = [created];
        restored += 1;
      }
    }
    rows.forEach((row, index) => {
      if (!row?.isConnected) return;
      if (index > 0 && row.dataset?.sourceTypeMeaningVisibleLock === SOURCE_TYPE_MEANING_VISIBLE_LOCK) {
        row.remove();
        return;
      }
      if (row.dataset?.sourceTypeMeaningVisibleLock !== SOURCE_TYPE_MEANING_VISIBLE_LOCK) {
        row.dataset.sourceTypeMeaningVisibleLock = SOURCE_TYPE_MEANING_VISIBLE_LOCK;
      }
      updateSourceTypeMeaningRow(row, sourceType);
      if (row.hidden) {
        row.hidden = false;
        restored += 1;
      }
      if (row.getAttribute('aria-hidden') === 'true') row.removeAttribute('aria-hidden');
      if (row.hasAttribute('data-advisor-audit-lock')) {
        row.removeAttribute('data-advisor-audit-lock');
        row.removeAttribute('data-advisor-audit-lock-section');
        row.removeAttribute('data-advisor-audit-lock-reason');
        row.removeAttribute('data-advisor-hidden-section');
        restored += 1;
      }
      if (row.style?.getPropertyValue?.('display') === 'none') {
        row.style.removeProperty('display');
        restored += 1;
      }
    });
    return restored;
  }

  const SOURCE_FLUID_BASIS_EXTRA_READOUTS = Object.freeze([
    {
      key: 'source-fluid-dynamic-viscosity',
      labelEn: 'Dynamic Viscosity Used',
      labelId: 'Visk. Dinamik Digunakan',
      unit: 'cP',
      digits: 3,
      valueName: 'dynamicViscosity'
    },
    {
      key: 'source-fluid-specific-weight',
      labelEn: 'Specific Weight Used',
      labelId: 'Berat Spesifik Digunakan',
      unit: 'N/m3',
      digits: 3,
      valueName: 'specificWeight'
    },
    {
      key: 'source-fluid-vapor-pressure-head',
      labelEn: 'Vapor Pressure Head',
      labelId: 'Head Tekanan Uap',
      unit: 'm',
      digits: 3,
      valueName: 'vaporPressureHead'
    }
  ]);

  function cssEscapeSourceValue(value = '') {
    if (typeof root.CSS !== 'undefined' && typeof root.CSS.escape === 'function') return root.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function parseSourceFluidBasisNumber(value, fallback = NaN) {
    const number = Number.parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) ? number : fallback;
  }

  function getSourceFieldElement(windowNode, key) {
    if (!windowNode?.querySelector) return null;
    const safeKey = cssEscapeSourceValue(key);
    return windowNode.querySelector(`[data-key="${safeKey}"]`)
      || windowNode.querySelector(`[data-prop-key="${safeKey}"] .prop-value`)
      || windowNode.querySelector(`[data-prop-key="${safeKey}"]`);
  }

  function getSourceFieldRow(windowNode, key) {
    const element = getSourceFieldElement(windowNode, key);
    return element?.closest?.('tr, .source-field-row, .object-property-row, .pipe-task-field-row, .object-task-field-row, .source-field-card, .object-field, .field-card, .task-field') || null;
  }

  function setSourceFieldReadout(windowNode, key, text) {
    const element = getSourceFieldElement(windowNode, key);
    if (!element) return false;
    if (element.textContent !== text) element.textContent = text;
    if (element.dataset) element.dataset.sourceFluidBasisLayoutLock = SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK;
    const row = getSourceFieldRow(windowNode, key);
    if (row?.dataset) {
      row.dataset.propKey = key;
      row.dataset.sourceFluidBasisLayoutLock = SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK;
    }
    return true;
  }

  function formatSourceFluidBasisReadout(value, unit, digits = 3) {
    const number = parseSourceFluidBasisNumber(value, NaN);
    if (!Number.isFinite(number)) return '-';
    return `${number.toFixed(digits)} ${unit}`;
  }

  function readSourceFluidBasisNumber(windowNode, key, fallback = NaN) {
    return parseSourceFluidBasisNumber(getSourceFieldElement(windowNode, key)?.textContent, fallback);
  }

  function getSourceFluidBasisValues(windowNode) {
    const model = getRuntimeModel() || {};
    const nodeId = String(windowNode?.dataset?.nodeId || '').trim();
    const sourceNode = nodeId ? model[nodeId] : null;
    const baseFluid = model?.FLUID?.props || {};
    const effectiveFluid = typeof root.getFluidPropsAtSourceTemperature === 'function'
      ? root.getFluidPropsAtSourceTemperature(sourceNode, baseFluid)
      : { ...baseFluid };
    const density = parseSourceFluidBasisNumber(effectiveFluid?.density, readSourceFluidBasisNumber(windowNode, 'source-fluid-density'));
    const kinematicViscosity = parseSourceFluidBasisNumber(
      effectiveFluid?.viscosity ?? effectiveFluid?.kinematicViscosity,
      readSourceFluidBasisNumber(windowNode, 'source-fluid-viscosity')
    );
    const vaporPressure = parseSourceFluidBasisNumber(
      effectiveFluid?.vaporPressure,
      readSourceFluidBasisNumber(windowNode, 'source-fluid-vapor-pressure')
    );
    let dynamicViscosity = Number.NaN;
    if (Number.isFinite(density) && Number.isFinite(kinematicViscosity)) {
      dynamicViscosity = kinematicViscosity * (density / 1000);
    }
    if (!Number.isFinite(dynamicViscosity)) {
      dynamicViscosity = parseSourceFluidBasisNumber(
        effectiveFluid?.dynViscosity ?? effectiveFluid?.dynamicViscosity,
        readSourceFluidBasisNumber(windowNode, 'source-fluid-dynamic-viscosity')
      );
    }
    let specificWeight = Number.isFinite(density) ? density * 9.81 : Number.NaN;
    if (!Number.isFinite(specificWeight)) {
      specificWeight = parseSourceFluidBasisNumber(
        effectiveFluid?.specWeight ?? effectiveFluid?.specificWeight,
        readSourceFluidBasisNumber(windowNode, 'source-fluid-specific-weight')
      );
    }
    let vaporPressureHead = Number.NaN;
    if (Number.isFinite(vaporPressure) && Number.isFinite(density) && density > 0) {
      vaporPressureHead = 1e5 * vaporPressure / (density * 9.81);
    }
    if (!Number.isFinite(vaporPressureHead)) {
      vaporPressureHead = parseSourceFluidBasisNumber(
        effectiveFluid?.vaporPressureHead,
        readSourceFluidBasisNumber(windowNode, 'source-fluid-vapor-pressure-head')
      );
    }
    return {
      density,
      kinematicViscosity,
      dynamicViscosity,
      specificWeight,
      vaporPressure,
      vaporPressureHead
    };
  }

  function isSourceSectionHeaderRow(row) {
    return !!row?.querySelector?.('.prop-section-header, [data-task-prop-section], [data-section-header]');
  }

  function findSourceSectionHeader(windowNode, labels, anchorKey) {
    if (!windowNode?.querySelectorAll) return null;
    const normalizedLabels = labels.map((label) => String(label || '').toLowerCase());
    const candidates = Array.from(windowNode.querySelectorAll('tr, .prop-section-header, [data-task-prop-section], [data-section-header]'));
    const byLabel = candidates.find((candidate) => {
      const row = candidate.closest?.('tr') || candidate;
      const text = String(candidate.textContent || row.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return normalizedLabels.some((label) => text === label || text.includes(label));
    });
    if (byLabel) return byLabel.closest?.('tr') || byLabel;
    const anchorRow = getSourceFieldRow(windowNode, anchorKey);
    let row = anchorRow?.previousElementSibling || null;
    while (row) {
      if (isSourceSectionHeaderRow(row)) return row;
      row = row.previousElementSibling;
    }
    return null;
  }

  function collectSourceSectionBlock(headerRow) {
    const rows = [];
    let row = headerRow;
    while (row) {
      if (row !== headerRow && isSourceSectionHeaderRow(row)) break;
      rows.push(row);
      row = row.nextElementSibling;
    }
    return rows;
  }

  function moveSourceFluidBasisAfterFlow(windowNode) {
    const fluidHeader = findSourceSectionHeader(windowNode, ['Fluid Basis Link', 'Link Basis Fluida'], 'source-fluid-basis');
    const flowHeader = findSourceSectionHeader(windowNode, ['Flow Specification', 'Spesifikasi Flow', 'Spesifikasi Aliran'], 'flowInputMode');
    if (!fluidHeader || !flowHeader || fluidHeader === flowHeader || fluidHeader.parentNode !== flowHeader.parentNode) return false;
    const parentRows = Array.from(fluidHeader.parentNode.children || []);
    const fluidIndex = parentRows.indexOf(fluidHeader);
    const flowIndex = parentRows.indexOf(flowHeader);
    if (fluidIndex < 0 || flowIndex < 0 || fluidIndex > flowIndex) return false;
    const fluidBlock = collectSourceSectionBlock(fluidHeader);
    const flowBlock = collectSourceSectionBlock(flowHeader);
    let insertAfter = flowBlock[flowBlock.length - 1] || flowHeader;
    fluidBlock.forEach((row) => {
      insertAfter.insertAdjacentElement('afterend', row);
      insertAfter = row;
    });
    return true;
  }

  function createSourceFluidBasisReadoutRow(anchorRow, config, valueText) {
    if (!root.document || !anchorRow?.parentNode) return null;
    const row = root.document.createElement(anchorRow.tagName?.toLowerCase() === 'tr' ? 'tr' : 'div');
    row.className = anchorRow.className || 'pipe-task-field-row object-task-field-row';
    row.dataset.propKey = config.key;
    row.dataset.sourceFluidBasisDerived = 'true';
    row.dataset.sourceFluidBasisLayoutLock = SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK;
    const label = root.document.createElement(row.tagName.toLowerCase() === 'tr' ? 'td' : 'div');
    label.className = 'prop-label';
    const value = root.document.createElement(row.tagName.toLowerCase() === 'tr' ? 'td' : 'div');
    value.className = 'prop-value';
    value.dataset.key = config.key;
    row.append(label, value);
    anchorRow.insertAdjacentElement('afterend', row);
    updateSourceFluidBasisReadoutRow(row, config, valueText);
    return row;
  }

  function updateSourceFluidBasisReadoutRow(row, config, valueText) {
    if (!row) return;
    const language = getActiveRuntimeLanguage();
    const label = row.querySelector?.('.prop-label') || row.children?.[0];
    const value = row.querySelector?.('.prop-value, [data-key]') || row.children?.[1];
    row.dataset.propKey = config.key;
    row.dataset.sourceFluidBasisDerived = 'true';
    row.dataset.sourceFluidBasisLayoutLock = SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK;
    if (label) {
      const nextLabel = language === 'id' ? config.labelId : config.labelEn;
      if (label.textContent !== nextLabel) label.textContent = nextLabel;
      label.setAttribute?.('data-i18n-fallback', config.labelEn);
    }
    if (value) {
      value.dataset.key = config.key;
      value.dataset.sourceFluidBasisLayoutLock = SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK;
      if (value.textContent !== valueText) value.textContent = valueText;
    }
  }

  function ensureSourceFluidBasisReadoutRow(windowNode, anchorRow, config, valueText) {
    let row = getSourceFieldRow(windowNode, config.key);
    if (!row) row = createSourceFluidBasisReadoutRow(anchorRow, config, valueText);
    else if (anchorRow?.parentNode && row.parentNode === anchorRow.parentNode && row.previousElementSibling !== anchorRow) {
      anchorRow.insertAdjacentElement('afterend', row);
    }
    updateSourceFluidBasisReadoutRow(row, config, valueText);
    return row || anchorRow;
  }

  function ensureSourceFluidBasisExtraReadouts(windowNode) {
    const values = getSourceFluidBasisValues(windowNode);
    setSourceFieldReadout(windowNode, 'source-fluid-density', formatSourceFluidBasisReadout(values.density, 'kg/m3', 3));
    setSourceFieldReadout(windowNode, 'source-fluid-viscosity', formatSourceFluidBasisReadout(values.kinematicViscosity, 'cSt', 3));
    setSourceFieldReadout(windowNode, 'source-fluid-vapor-pressure', formatSourceFluidBasisReadout(values.vaporPressure, 'bar a', 6));
    let anchor = getSourceFieldRow(windowNode, 'source-fluid-viscosity')
      || getSourceFieldRow(windowNode, 'source-fluid-density')
      || getSourceFieldRow(windowNode, 'source-temperature');
    if (!anchor) return false;
    const dynamicConfig = SOURCE_FLUID_BASIS_EXTRA_READOUTS[0];
    anchor = ensureSourceFluidBasisReadoutRow(
      windowNode,
      anchor,
      dynamicConfig,
      formatSourceFluidBasisReadout(values[dynamicConfig.valueName], dynamicConfig.unit, dynamicConfig.digits)
    );
    const specificConfig = SOURCE_FLUID_BASIS_EXTRA_READOUTS[1];
    anchor = ensureSourceFluidBasisReadoutRow(
      windowNode,
      anchor,
      specificConfig,
      formatSourceFluidBasisReadout(values[specificConfig.valueName], specificConfig.unit, specificConfig.digits)
    );
    const vaporRow = getSourceFieldRow(windowNode, 'source-fluid-vapor-pressure') || anchor;
    const vaporHeadConfig = SOURCE_FLUID_BASIS_EXTRA_READOUTS[2];
    ensureSourceFluidBasisReadoutRow(
      windowNode,
      vaporRow,
      vaporHeadConfig,
      formatSourceFluidBasisReadout(values[vaporHeadConfig.valueName], vaporHeadConfig.unit, vaporHeadConfig.digits)
    );
    return true;
  }

  function ensureSourceFluidBasisLinkLayout(windowNode) {
    if (!isSourceObjectPropertiesWindow(windowNode)) return false;
    if (windowNode.dataset?.sourceFluidBasisLinkLayoutLock !== SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK) {
      windowNode.dataset.sourceFluidBasisLinkLayoutLock = SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK;
    }
    moveSourceFluidBasisAfterFlow(windowNode);
    return ensureSourceFluidBasisExtraReadouts(windowNode);
  }

  function hideSourceSemanticAttachmentRows(windowNode) {
    if (!isSourceObjectPropertiesWindow(windowNode)) return 0;
    markSourceAdvisorAuditLock(windowNode);
    if (windowNode.dataset && windowNode.dataset.advisorHideSemanticAttachment !== 'true') windowNode.dataset.advisorHideSemanticAttachment = 'true';
    if (windowNode.dataset && windowNode.dataset.advisorHideHydraulicConnection !== 'true') windowNode.dataset.advisorHideHydraulicConnection = 'true';
    if (windowNode.dataset && windowNode.dataset.advisorHideDefenseReadyNote !== 'true') windowNode.dataset.advisorHideDefenseReadyNote = 'true';
    if (windowNode.dataset && windowNode.dataset.advisorHideBoundaryRole !== 'true') windowNode.dataset.advisorHideBoundaryRole = 'true';
    if (windowNode.dataset && windowNode.dataset.advisorHideGenericMeaning !== 'true') windowNode.dataset.advisorHideGenericMeaning = 'true';
    ensureSourceFluidBasisLinkLayout(windowNode);
    keepSourceTypeMeaningRowsVisible(windowNode);
    let hidden = 0;
    windowNode.querySelectorAll?.('tr, h1, h2, h3, h4, h5, h6, legend, .fluid-field-row, .source-field-row, .object-property-row, .pipe-task-field-row, .object-task-field-row, .source-field-card, .object-field, .field-card, .task-field, [data-prop-key], [data-field-key], [class*="section-title"], [class*="section-heading"], [class*="card-title"]').forEach((row) => {
      if (!row.isConnected) return;
      const hiddenSection = getSourceAdvisorHiddenSection(row.textContent, row);
      if (!hiddenSection) return;
      if (row.dataset?.advisorHiddenSection !== hiddenSection) row.dataset.advisorHiddenSection = hiddenSection;
      lockSourceAdvisorHiddenNode(row, hiddenSection);
      if (hiddenSection === 'source-defense-ready-note') {
        relocateSourceFormulaDefenseButton(windowNode);
        const stillOwnsDefenseButton = Boolean(row.querySelector?.('.source-formula-defense-btn, [data-source-formula-defense]'));
        if (!stillOwnsDefenseButton && row.parentNode) row.remove();
      } else if (hiddenSection === 'source-boundary-role' && row.parentNode) {
        row.remove();
      }
      hidden += 1;
    });
    keepSourceTypeMeaningRowsVisible(windowNode);
    ensureSourceFluidBasisLinkLayout(windowNode);
    return hidden;
  }

  function hideSourcePumpActionReadiness(windowNode) {
    if (!isSourceObjectPropertiesWindow(windowNode)) return 0;
    markSourceAdvisorAuditLock(windowNode);
    if (windowNode.dataset && windowNode.dataset.advisorHidePumpReadiness !== 'true') windowNode.dataset.advisorHidePumpReadiness = 'true';
    relocateSourceFormulaDefenseButton(windowNode);
    let hidden = hideSourceSemanticAttachmentRows(windowNode);
    windowNode.querySelectorAll?.('.caption-audit-pump-action-readiness').forEach((panel) => {
      if (panel.dataset?.advisorHidden !== 'source-object-properties') panel.dataset.advisorHidden = 'source-object-properties';
      lockSourceAdvisorHiddenNode(panel, 'source-pump-action-readiness');
      hidden += 1;
    });
    return hidden;
  }

  function getSourceWindowHeaderCell(windowNode) {
    if (!windowNode?.querySelector) return null;
    const nodeId = String(windowNode.dataset?.nodeId || '').trim();
    const cells = Array.from(windowNode.querySelectorAll('th[data-task-prop-header="true"], thead th, .source-object-header, .object-properties-header'));
    return cells.find((cell) => {
      const text = String(cell.textContent || '').replace(/\s+/g, ' ').trim();
      return nodeId ? text.includes(nodeId) : /^SRC[-_]/i.test(text);
    }) || cells[0] || null;
  }

  function ensureSourceHeaderDefenseLayout(headerCell, nodeId = '') {
    if (!headerCell || !root.document) return null;
    let layout = headerCell.querySelector(':scope > .source-header-defense-layout');
    if (!layout) {
      const existingText = String(headerCell.textContent || '').replace(/\s+/g, ' ').trim() || nodeId || 'SRC';
      headerCell.replaceChildren();
      headerCell.classList?.add('source-header-with-defense');
      layout = root.document.createElement('span');
      layout.className = 'source-header-defense-layout';
      const title = root.document.createElement('span');
      title.className = 'source-header-title';
      title.textContent = existingText;
      const actions = root.document.createElement('span');
      actions.className = 'source-header-actions';
      layout.append(title, actions);
      headerCell.append(layout);
    } else {
      headerCell.classList?.add('source-header-with-defense');
    }
    if (headerCell.dataset?.sourceFormulaDefensePlacementLock !== SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK) {
      headerCell.dataset.sourceFormulaDefensePlacementLock = SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK;
    }
    if (layout.dataset?.sourceFormulaDefensePlacementLock !== SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK) {
      layout.dataset.sourceFormulaDefensePlacementLock = SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK;
    }
    const title = layout.querySelector('.source-header-title');
    if (title && nodeId && !String(title.textContent || '').trim()) title.textContent = nodeId;
    let actions = layout.querySelector('.source-header-actions');
    if (!actions) {
      actions = root.document.createElement('span');
      actions.className = 'source-header-actions';
      layout.append(actions);
    }
    if (actions.dataset?.sourceFormulaDefensePlacementLock !== SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK) {
      actions.dataset.sourceFormulaDefensePlacementLock = SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK;
    }
    return actions;
  }

  function relocateSourceFormulaDefenseButton(windowNode) {
    if (!isSourceObjectPropertiesWindow(windowNode)) return false;
    const button = windowNode.querySelector?.('.source-formula-defense-btn, [data-source-formula-defense]');
    if (!button) return false;
    const nodeId = String(windowNode.dataset?.nodeId || button.dataset?.sourceFormulaDefense || '').trim();
    const headerCell = getSourceWindowHeaderCell(windowNode);
    const actions = ensureSourceHeaderDefenseLayout(headerCell, nodeId);
    if (!actions) return false;
    if (button.parentElement !== actions) actions.append(button);
    if (button.dataset.sourceFormulaDefensePlacement !== 'src-header') {
      button.dataset.sourceFormulaDefensePlacement = 'src-header';
    }
    if (button.dataset.sourceFormulaDefensePlacementLock !== SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK) {
      button.dataset.sourceFormulaDefensePlacementLock = SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK;
    }
    if (windowNode.dataset.sourceFormulaDefenseButtonPlacement !== 'src-header') {
      windowNode.dataset.sourceFormulaDefenseButtonPlacement = 'src-header';
    }
    if (windowNode.dataset.sourceFormulaDefensePlacementLock !== SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK) {
      windowNode.dataset.sourceFormulaDefensePlacementLock = SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK;
    }
    return true;
  }

  function hideOpenSourcePumpActionReadiness(rootNode = root.document) {
    if (!rootNode?.querySelectorAll) return 0;
    let hidden = 0;
    const candidates = rootNode.matches?.('.persistent-object-properties-task-window')
      ? [rootNode]
      : Array.from(rootNode.querySelectorAll('.persistent-object-properties-task-window'));
    candidates.forEach((windowNode) => {
      hidden += hideSourcePumpActionReadiness(windowNode);
    });
    return hidden;
  }

  function installSourceAdvisorVisibilityBridge() {
    if (root.__EngineeringSourceAdvisorVisibilityBridgeInstalled || typeof root.document === 'undefined') return;
    root.__EngineeringSourceAdvisorVisibilityBridgeInstalled = true;
    root.__EngineeringSourceAdvisorAuditLock = Object.freeze({
      version: SOURCE_ADVISOR_AUDIT_LOCK,
      placementLock: SOURCE_FORMULA_DEFENSE_PLACEMENT_LOCK,
      fluidBasisLinkLayoutLock: SOURCE_FLUID_BASIS_LINK_LAYOUT_LOCK,
      standardFormLock: SOURCE_STANDARD_FORM_LOCK,
      reason: SOURCE_ADVISOR_AUDIT_LOCK_REASON,
      appliesTo: 'persistent Source/SRC object properties windows'
    });
    root.EngineeringSourceStandardForm = Object.freeze({
      version: SOURCE_STANDARD_FORM_SCHEMA_VERSION,
      lockVersion: SOURCE_STANDARD_FORM_LOCK,
      valuePolicy: SOURCE_STANDARD_FORM_VALUE_POLICY,
      contract: cloneSourceStandardFormContract(),
      applyToProject: applySourceStandardFormToProject,
      validateWindow: validateSourceStandardFormWindow
    });
    const scan = () => hideOpenSourcePumpActionReadiness(root.document);
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', scan, { once: true });
    else root.setTimeout?.(scan, 0);
    if (typeof MutationObserver !== 'undefined') {
      let scheduled = false;
      const scheduleScan = () => {
        if (scheduled) return;
        scheduled = true;
        const run = () => {
          scheduled = false;
          scan();
        };
        if (typeof root.setTimeout === 'function') root.setTimeout(run, 0);
        else run();
      };
      const observer = new MutationObserver((mutations) => {
        let needsScan = false;
        mutations.forEach((mutation) => {
          mutation.addedNodes?.forEach((node) => {
            if (node.nodeType !== 1) return;
            const windowNode = node.matches?.('.persistent-object-properties-task-window')
              ? node
              : node.closest?.('.persistent-object-properties-task-window');
            if (windowNode || node.querySelector?.('.persistent-object-properties-task-window')) needsScan = true;
          });
        });
        if (needsScan) scheduleScan();
      });
      observer.observe(root.document.documentElement, {
        childList: true,
        subtree: true
      });
      root.__EngineeringSourceAdvisorVisibilityObserver = observer;
    }
    if (typeof root.setInterval === 'function' && !root.__EngineeringSourceAdvisorVisibilityInterval) {
      root.__EngineeringSourceAdvisorVisibilityInterval = root.setInterval(scan, 1500);
    }
    root.addEventListener?.('engineering-language-changed', () => root.setTimeout?.(scan, 0));
  }

  function getSourceAttachmentText(sourceNode) {
    const props = sourceNode?.props || {};
    const links = Array.isArray(root.sourceLinks) ? root.sourceLinks : [];
    const linked = links.find((link) => link?.sourceId === sourceNode?.id || link?.from === sourceNode?.id || link?.source === sourceNode?.id);
    return props.attachedTo || props.semanticAttachment || linked?.targetId || linked?.to || '-';
  }

  function buildSourceDefenseFallbackLayout(sourceId = '') {
    const model = getRuntimeModel();
    const { id, node } = getFirstSourceNode(model, sourceId);
    const props = node?.props || {};
    const fluid = getFluidDefenseBasis(model);
    const isId = getActiveRuntimeLanguage() === 'id';
    const sourceType = props.sourceType || props.boundaryMode || props.type || 'Fixed Flow Source';
    const pressureBasis = props.pressureInputBasis || props.pressureBasis || 'Absolute';
    const pressure = props.pressure ?? props.boundaryPressure ?? props.suctionPressure;
    const elevation = props.elevation ?? props.sourceElevation ?? 0;
    const flow = props.flow ?? props.designFlow ?? props.demandFlow ?? props.massFlow;
    const flowMode = props.flowInputMode || props.boundaryMode || 'Volumetric Flow';
    const temperature = props.temp ?? props.temperature ?? fluid.temperature;
    const latestBackendResponse = root.__npshLastBackendSimulationResponse?.response || {};
    const backendSrcAudit = latestBackendResponse.srcObjectAudit
      || Object.values(model || {}).find((item) => item?.type === 'pump')?.results?.srcObjectAudit
      || null;
    const backendEngineering = backendSrcAudit?.engineeringCalculation || {};
    const backendSubstitutions = backendEngineering.substitutions || {};
    const backendDependency = backendSrcAudit?.dependencyChange || {};
    const displaySourceType = translateRuntimeText(sourceType);
    const displayPressureBasis = translateRuntimeText(pressureBasis);
    const displayFlowMode = translateRuntimeText(flowMode);
    const displayFluidName = translateRuntimeText(fluid.name);
    const layout = root.document.createElement('div');
    layout.className = 'fluid-help-layout src-help-layout source-formula-defense-layout source-formula-defense-fallback-layout';
    layout.dataset.engineeringSourceFallback = 'true';
    layout.dataset.sourceStandardFormLock = SOURCE_STANDARD_FORM_LOCK;
    layout.dataset.sourceStandardFormSchemaVersion = SOURCE_STANDARD_FORM_SCHEMA_VERSION;
    layout.dataset.sourceStandardValuePolicy = SOURCE_STANDARD_FORM_VALUE_POLICY;

    appendSourceDefenseCard(layout, getSourceDefenseText('Short Answer for Advisor', 'Jawaban Singkat untuk Advisor'), () => createSourceDefenseParagraphs([
      getSourceDefenseText(
        'SRC is the upstream suction boundary. It defines the pressure, elevation, flow basis, and Fluid Basis link used before the suction pipe/fitting/valve path reaches the pump.',
        'SRC adalah boundary suction upstream. SRC menetapkan tekanan, elevasi, basis aliran, dan link Basis Fluida sebelum jalur suction pipe/fitting/valve menuju pompa.'
      ),
      getSourceDefenseText(
        'This fallback is shown because the route-dependent source calculation trace has not been generated yet. The boundary data are still auditable; suction-loss and final NPSHa remain route-dependent until the hydraulic path is solved.',
        'Fallback ini ditampilkan karena trace perhitungan Source yang bergantung pada route belum terbentuk. Data boundary tetap dapat diaudit; suction loss dan NPSHa final tetap bergantung pada route sampai jalur hidrolik diselesaikan.'
      )
    ]));

    appendSourceDefenseCard(layout, getSourceDefenseText('Current SRC Source Data', 'Data Source SRC Saat Ini'), () => createSourceDefenseTable(
      [
        getSourceDefenseText('Item', 'Item'),
        getSourceDefenseText('Current Value', 'Nilai Saat Ini'),
        getSourceDefenseText('Defense Meaning', 'Makna Defense')
      ],
      [
        [
          'SRC',
          id || 'SRC',
          getSourceDefenseText('Selected source object used as the upstream boundary.', 'Objek source yang dipilih sebagai boundary hulu.')
        ],
        [
          getSourceDefenseText('Standard Form Profile', 'Profil Form Standard'),
          SOURCE_STANDARD_FORM_LOCK,
          getSourceDefenseText('SRC Object Properties uses the same section contract in every simulation, journal import, and defense report.', 'SRC Object Properties memakai kontrak section yang sama di setiap simulasi, import jurnal, dan report defense.')
        ],
        [
          getSourceDefenseText('Source Definition', 'Definisi Source'),
          displaySourceType,
          getSourceDefenseText('Defines whether the source behaves as a fixed-flow, pressure, tank, vessel, or external boundary.', 'Mendefinisikan apakah source berperan sebagai fixed-flow, pressure, tank, vessel, atau boundary eksternal.')
        ],
        [
          getSourceDefenseText('Source Data Origin', 'Asal Data Source'),
          props.boundaryDataSource || props.dataSource || getSourceDefenseText('Manual / User Input', 'Manual / Input User'),
          getSourceDefenseText('Documents whether the SRC number comes from user input, journal data, vendor data, or an engineering boundary note.', 'Mendokumentasikan apakah angka SRC berasal dari input user, data jurnal, data vendor, atau catatan boundary engineering.')
        ],
        [
          getSourceDefenseText('Pressure Basis', 'Basis Tekanan'),
          `${displayPressureBasis}; ${formatDefenseValue(pressure, /gauge/i.test(pressureBasis) ? 'bar g' : 'bar a', 4)}`,
          getSourceDefenseText('Pressure must be converted to an absolute basis before pressure-head and NPSH terms are defended.', 'Tekanan harus dikonversi ke basis absolut sebelum head tekanan dan term NPSH dipertahankan.')
        ],
        [
          getSourceDefenseText('Elevation', 'Elevasi'),
          formatDefenseValue(elevation, 'm', 3),
          getSourceDefenseText('Elevation contributes static head at the upstream boundary.', 'Elevasi berkontribusi pada static head di boundary hulu.')
        ],
        [
          getSourceDefenseText('Flow Basis', 'Basis Aliran'),
          `${displayFlowMode}; ${formatDefenseValue(flow, /mass/i.test(flowMode) ? 'kg/h' : 'm3/h', 3)}`,
          getSourceDefenseText('Flow basis is passed to the hydraulic route and pump duty calculation.', 'Basis aliran diteruskan ke route hidrolik dan perhitungan duty pompa.')
        ],
        [
          getSourceDefenseText('Fluid Basis Link', 'Link Basis Fluida'),
          `${displayFluidName}; rho ${formatDefenseValue(fluid.density, 'kg/m3', 3)}; Pv ${formatDefenseValue(fluid.vaporPressure, 'bar a', 6)}`,
          getSourceDefenseText('Fluid density and vapor pressure connect SRC pressure-head terms to NPSH evaluation.', 'Densitas dan tekanan uap fluida menghubungkan term head tekanan SRC dengan evaluasi NPSH.')
        ],
        [
          getSourceDefenseText('Temperature Basis', 'Basis Temperatur'),
          formatDefenseValue(temperature, 'deg C', 3),
          getSourceDefenseText('Temperature selects or validates the Fluid Basis properties used by SRC and pump calculations.', 'Temperatur memilih atau memvalidasi properti Basis Fluida yang digunakan SRC dan perhitungan pompa.')
        ]
      ]
    ));

    appendSourceDefenseCard(layout, getSourceDefenseText('Backend Formula Substitution', 'Substitusi Formula Backend'), () => createSourceDefenseTable(
      [
        getSourceDefenseText('Formula', 'Formula'),
        getSourceDefenseText('Live Substitution', 'Substitusi Live'),
        getSourceDefenseText('Traceability', 'Traceability')
      ],
      [
        [
          'P_abs',
          backendSubstitutions.pressureConversion || getSourceDefenseText('Run Solve to load backend SRC substitution.', 'Jalankan Hitung untuk memuat substitusi SRC backend.'),
          backendSrcAudit?.auditable?.calculationId || latestBackendResponse.calculationId || '-'
        ],
        [
          'H_p = P_abs x 100000 / (rho x g)',
          backendSubstitutions.pressureHead || '-',
          backendDependency.dependencyFingerprint || '-'
        ],
        [
          'H_SRC = H_p + z_SRC + H_vel',
          backendSubstitutions.sourceHydraulicHead || '-',
          backendSrcAudit?.routeCalculation?.directNpshImpact ? getSourceDefenseText('Direct NPSHA boundary impact', 'Direct impact boundary NPSHA') : getSourceDefenseText('Needs backend trace', 'Perlu trace backend')
        ],
        [
          'NPSHA = H_SRC - z_pump - hL_suction - H_vapor',
          backendSubstitutions.npsha || '-',
          backendDependency.priorResultStale ? getSourceDefenseText('Recalculated after stale input change', 'Dihitung ulang setelah input stale') : getSourceDefenseText('Current when calculationId matches latest result', 'Current bila calculationId cocok dengan hasil terbaru')
        ]
      ]
    ));

    appendSourceDefenseCard(layout, getSourceDefenseText('Input -> Process -> Output Chain', 'Rantai Input -> Proses -> Output'), () => createSourceDefenseTable(
      [
        getSourceDefenseText('Stage', 'Tahap'),
        getSourceDefenseText('Engineering Role', 'Peran Engineering'),
        getSourceDefenseText('Trace Status', 'Status Trace')
      ],
      [
        [
          'Fluid Basis -> SRC',
          getSourceDefenseText('SRC reads density, vapor pressure, viscosity, and temperature basis from Fluid Basis.', 'SRC membaca densitas, tekanan uap, viskositas, dan basis temperatur dari Basis Fluida.'),
          fluid.density ? getSourceDefenseText('Available', 'Tersedia') : getSourceDefenseText('Needs Fluid Basis', 'Perlu Basis Fluida')
        ],
        [
          'SRC -> Suction Pipe/Fitting/Valve',
          getSourceDefenseText('SRC supplies upstream boundary head; suction PFV subtracts major/minor losses after route solve.', 'SRC memberi upstream boundary head; PFV suction mengurangi major/minor loss setelah route dihitung.'),
          getSourceDefenseText('Route-dependent', 'Bergantung route')
        ],
        [
          'Suction PFV -> Pump',
          getSourceDefenseText('Pump uses source head, suction loss, vapor pressure head, and pump elevation to calculate NPSHa.', 'Pompa memakai source head, kehilangan sisi isap, head tekanan uap, dan elevasi pompa untuk menghitung NPSHa.'),
          getSourceDefenseText('Requires solved hydraulic path', 'Memerlukan jalur hidrolik yang sudah dihitung')
        ]
      ]
    ));

    appendSourceDefenseCard(layout, getSourceDefenseText('Source Formula Defense', 'Defense Formula Source'), () => createSourceDefenseList([
      getSourceDefenseText('Pressure conversion: P_abs = P_input for absolute pressure, or P_abs = P_gauge + P_atm for gauge pressure.', 'Konversi tekanan: P_abs = P_input untuk tekanan absolut, atau P_abs = P_gauge + P_atm untuk tekanan gauge.'),
      getSourceDefenseText('Pressure head: H_p = P_abs / (rho x g). Density comes from Fluid Basis.', 'Head tekanan: H_p = P_abs / (rho x g). Densitas berasal dari Basis Fluida.'),
      getSourceDefenseText('Source hydraulic head: H_src = H_p + z_src + velocity head when velocity data are available.', 'Head hidrolik source: H_src = H_p + z_src + head kecepatan jika data velocity tersedia.'),
      getSourceDefenseText('Pump NPSHa dependency: NPSHa = source head - suction losses - vapor pressure head - pump elevation correction.', 'Dependensi NPSHa pompa: NPSHa = source head - kehilangan sisi isap - head tekanan uap - koreksi elevasi pompa.')
    ]));

    appendSourceDefenseCard(layout, getSourceDefenseText('Advisor Questions & Answers', 'Potensi Pertanyaan Dosen & Jawaban'), () => createSourceDefenseTable(
      [
        getSourceDefenseText('Parameter', 'Parameter'),
        getSourceDefenseText('Likely Question', 'Potensi Pertanyaan'),
        getSourceDefenseText('Defense Answer', 'Jawaban Defense'),
        getSourceDefenseText('Used In', 'Dipakai Pada')
      ],
      [
        [
          getSourceDefenseText('Source Type', 'Tipe Source'),
          getSourceDefenseText('Why was this source type selected?', 'Mengapa tipe source ini dipilih?'),
          getSourceDefenseText('It defines how SRC behaves as the upstream boundary before the suction route reaches the pump.', 'Tipe ini mendefinisikan perilaku SRC sebagai boundary hulu sebelum route suction menuju pompa.'),
          getSourceDefenseText('Boundary model, source head', 'Model boundary, head source')
        ],
        [
          getSourceDefenseText('Type Meaning', 'Makna Tipe'),
          getSourceDefenseText('Why is this explanation shown?', 'Mengapa penjelasan ini ditampilkan?'),
          getSourceDefenseText('It documents the engineering meaning of the selected Source Type so the boundary assumption is auditable before calculation.', 'Ini mendokumentasikan makna engineering dari Tipe Source yang dipilih agar asumsi boundary dapat diaudit sebelum perhitungan.'),
          getSourceDefenseText('Boundary assumption defense', 'Defense asumsi boundary')
        ],
        [
          getSourceDefenseText('Pressure Basis', 'Basis Tekanan'),
          getSourceDefenseText('Why does gauge pressure need conversion?', 'Mengapa tekanan gauge harus dikonversi?'),
          getSourceDefenseText('NPSH is defended on an absolute pressure basis, so gauge pressure is converted before pressure head is calculated.', 'NPSH dipertahankan pada basis tekanan absolut, sehingga tekanan gauge dikonversi sebelum head tekanan dihitung.'),
          getSourceDefenseText('Pressure head, NPSHa', 'Head tekanan, NPSHa')
        ],
        [
          getSourceDefenseText('Calculated Abs. Pressure', 'Tekanan Abs. Terhitung'),
          getSourceDefenseText('Why is absolute pressure shown separately?', 'Mengapa tekanan absolut ditampilkan terpisah?'),
          getSourceDefenseText('NPSH calculation requires absolute pressure. Gauge pressure is converted using atmospheric pressure before pressure head is calculated.', 'Perhitungan NPSH membutuhkan tekanan absolut. Tekanan gauge dikonversi menggunakan tekanan atmosfer sebelum head tekanan dihitung.'),
          getSourceDefenseText('Pressure head, NPSHa', 'Head tekanan, NPSHa')
        ],
        [
          getSourceDefenseText('Source P abs', 'Tekanan Absolut Source'),
          getSourceDefenseText('Which formula uses this pressure?', 'Tekanan ini masuk ke rumus mana?'),
          getSourceDefenseText('Boundary pressure becomes pressure head using H_p = P_abs / (rho x g).', 'Tekanan boundary menjadi head tekanan dengan H_p = P_abs / (rho x g).'),
          getSourceDefenseText('Source hydraulic head', 'Head hidrolik source')
        ],
        [
          getSourceDefenseText('Source Elevation', 'Elevasi Source'),
          getSourceDefenseText('What is the effect of source elevation?', 'Apa pengaruh elevasi source?'),
          getSourceDefenseText('Elevation adds or subtracts static head at the upstream boundary.', 'Elevasi menambah atau mengurangi static head pada boundary hulu.'),
          getSourceDefenseText('Static head, NPSHa', 'Static head, NPSHa')
        ],
        [
          getSourceDefenseText('Flow Basis', 'Basis Aliran'),
          getSourceDefenseText('Why does SRC need a flow basis?', 'Mengapa SRC perlu basis flow?'),
          getSourceDefenseText('Flow is passed to the hydraulic route so velocity, Reynolds number, and suction losses can be solved.', 'Flow diteruskan ke route hidrolik agar velocity, Reynolds number, dan suction loss dapat dihitung.'),
          getSourceDefenseText('Pipe/Fitting/Valve loss, pump duty', 'Loss Pipe/Fitting/Valve, duty pompa')
        ],
        [
          getSourceDefenseText('Mass Flow', 'Mass Flow'),
          getSourceDefenseText('Why does mass flow become volumetric flow?', 'Mengapa mass flow menjadi volumetric flow?'),
          getSourceDefenseText('Hydraulic velocity, Reynolds number, and pipe losses require volumetric flow, so mass flow is divided by density.', 'Velocity hidrolik, Reynolds number, dan pipe loss membutuhkan volumetric flow, sehingga mass flow dibagi dengan densitas.'),
          getSourceDefenseText('Pipe velocity, Reynolds number', 'Velocity pipa, Reynolds number')
        ],
        [
          getSourceDefenseText('Volumetric Flow (Calculated)', 'Volumetric Flow (Terhitung)'),
          getSourceDefenseText('Is this user input or calculated result?', 'Apakah ini input user atau hasil perhitungan?'),
          getSourceDefenseText('It is calculated from mass flow and density, then used by the hydraulic route for pipe/fitting/valve loss.', 'Ini dihitung dari mass flow dan densitas, lalu dipakai route hidrolik untuk loss pipe/fitting/valve.'),
          getSourceDefenseText('Hydraulic loss, pump duty', 'Loss hidrolik, duty pompa')
        ],
        [
          getSourceDefenseText('Density', 'Densitas'),
          getSourceDefenseText('Where is density used?', 'Densitas digunakan di mana?'),
          getSourceDefenseText('Density converts pressure to head and converts mass flow to volumetric flow when mass flow is selected.', 'Densitas mengonversi tekanan menjadi head dan mengonversi mass flow menjadi volumetric flow jika mode mass flow dipilih.'),
          getSourceDefenseText('Head conversion, flow conversion', 'Konversi head, konversi flow')
        ],
        [
          getSourceDefenseText('Kinematic Viscosity', 'Viskositas Kinematik'),
          getSourceDefenseText('Is viscosity used by pipe, fitting, valve, and Moody chart?', 'Apakah viskositas dipakai oleh pipe, fitting, valve, dan Diagram Moody?'),
          getSourceDefenseText('Yes. Kinematic viscosity is used for Reynolds number, then friction factor or Moody interpretation, then hydraulic loss.', 'Ya. Viskositas kinematik dipakai untuk Reynolds number, lalu friction factor atau interpretasi Moody, lalu hydraulic loss.'),
          getSourceDefenseText('Reynolds number, friction loss', 'Reynolds number, friction loss')
        ],
        [
          getSourceDefenseText('Dynamic Viscosity', 'Viskositas Dinamik'),
          getSourceDefenseText('Why show dynamic viscosity if Moody uses kinematic viscosity?', 'Mengapa viskositas dinamik ditampilkan jika Moody memakai viskositas kinematik?'),
          getSourceDefenseText('Dynamic viscosity supports fluid-property audit and is related to kinematic viscosity by nu = mu / rho.', 'Viskositas dinamik mendukung audit properti fluida dan berhubungan dengan viskositas kinematik melalui nu = mu / rho.'),
          getSourceDefenseText('Fluid property defense', 'Defense properti fluida')
        ],
        [
          getSourceDefenseText('Specific Weight', 'Berat Spesifik'),
          getSourceDefenseText('Why is specific weight needed?', 'Mengapa berat spesifik diperlukan?'),
          getSourceDefenseText('Specific weight rho x g links pressure, head, and hydraulic energy terms used in pressure-head and NPSH defense.', 'Berat spesifik rho x g menghubungkan tekanan, head, dan energi hidrolik yang dipakai pada defense pressure-head dan NPSH.'),
          getSourceDefenseText('Pressure head, NPSH basis', 'Head tekanan, basis NPSH')
        ],
        [
          getSourceDefenseText('Vapor Pressure', 'Tekanan Uap'),
          getSourceDefenseText('Why is vapor pressure important for cavitation?', 'Mengapa tekanan uap penting untuk kavitasi?'),
          getSourceDefenseText('Vapor pressure head is subtracted from NPSHa; higher vapor pressure reduces cavitation margin.', 'Head tekanan uap dikurangkan dari NPSHa; tekanan uap yang lebih tinggi menurunkan margin kavitasi.'),
          getSourceDefenseText('NPSHa, cavitation risk', 'NPSHa, risiko kavitasi')
        ],
        [
          getSourceDefenseText('Vapor Pressure Head', 'Head Tekanan Uap'),
          getSourceDefenseText('Why convert vapor pressure to head?', 'Mengapa tekanan uap dikonversi menjadi head?'),
          getSourceDefenseText('NPSHa is evaluated in head units, so vapor pressure is converted to vapor pressure head and subtracted from suction head.', 'NPSHa dievaluasi dalam satuan head, sehingga tekanan uap dikonversi menjadi head tekanan uap dan dikurangkan dari suction head.'),
          getSourceDefenseText('NPSHa, cavitation risk', 'NPSHa, risiko kavitasi')
        ],
        [
          getSourceDefenseText('Temperature Basis', 'Basis Temperatur'),
          getSourceDefenseText('Why is temperature controlled from Fluid Basis?', 'Mengapa temperatur dikontrol dari Basis Fluida?'),
          getSourceDefenseText('Fluid Basis is the single auditable property source, so SRC uses the same density, viscosity, and vapor pressure as the network.', 'Basis Fluida adalah sumber properti tunggal yang auditable, sehingga SRC memakai densitas, viskositas, dan tekanan uap yang sama dengan network.'),
          getSourceDefenseText('Fluid properties, audit trace', 'Properti fluida, audit trace')
        ],
        [
          getSourceDefenseText('Fluid Basis Link', 'Link Basis Fluida'),
          getSourceDefenseText('Why is SRC not editing fluid properties directly?', 'Mengapa SRC tidak mengedit properti fluida secara langsung?'),
          getSourceDefenseText('SRC uses Fluid Basis as the single auditable source of fluid properties to avoid inconsistent or stale calculations.', 'SRC memakai Basis Fluida sebagai sumber properti fluida tunggal yang auditable untuk menghindari perhitungan yang tidak konsisten atau stale.'),
          getSourceDefenseText('Audit trace, dependency control', 'Audit trace, kontrol dependensi')
        ],
        [
          getSourceDefenseText('Route Completeness', 'Kelengkapan Route'),
          getSourceDefenseText('Why can the trace be partial?', 'Mengapa trace bisa parsial?'),
          getSourceDefenseText('SRC boundary data can be audited first; final suction loss requires a solved route from SRC through suction PFV to pump.', 'Data boundary SRC dapat diaudit lebih dulu; suction loss final memerlukan route solved dari SRC melalui PFV suction ke pompa.'),
          getSourceDefenseText('Route trace, suction loss', 'Route trace, suction loss')
        ],
        [
          getSourceDefenseText('Stale Calculation', 'Perhitungan Stale'),
          getSourceDefenseText('What happens after SRC or Fluid Basis changes?', 'Apa yang terjadi setelah SRC atau Basis Fluida berubah?'),
          getSourceDefenseText('Run Solve so the route trace, suction loss, and NPSHa are recalculated from the latest inputs.', 'Jalankan Solve agar route trace, suction loss, dan NPSHa dihitung ulang dari input terbaru.'),
          getSourceDefenseText('Traceability, final validation', 'Traceability, validasi final')
        ]
      ]
    ));

    appendSourceDefenseCard(layout, getSourceDefenseText('Validation Gate / Why Trace Was Partial', 'Gate Validasi / Mengapa Trace Parsial'), () => createSourceDefenseList([
      getSourceDefenseText('SRC Standard Form is locked to Source Definition, Boundary Data, Flow Specification, and Fluid Basis Link across all simulations and journal-import SRC inputs.', 'SRC Standard Form dikunci pada Source Definition, Boundary Data, Flow Specification, dan Fluid Basis Link untuk semua simulasi dan input SRC dari import jurnal.'),
      getSourceDefenseText('Numbers shown in captions are examples only; runtime values must come from user input, journal import review, or engine calculation.', 'Angka pada caption hanya contoh; nilai runtime wajib berasal dari input user, review import jurnal, atau kalkulasi engine.'),
      getSourceDefenseText('Complete the solid hydraulic route SRC -> suction pipe/fitting/valve -> pump before expecting suction-loss substitution.', 'Lengkapi route hidrolik solid SRC -> suction pipe/fitting/valve -> pump sebelum mengharapkan substitusi suction loss.'),
      getSourceDefenseText('Run Solve after changing SRC, Fluid Basis, suction PFV, or pump elevation so the route-dependent trace becomes current.', 'Jalankan Hitung setelah mengubah SRC, Basis Fluida, PFV suction, atau elevasi pompa agar trace yang bergantung route menjadi current.'),
      getSourceDefenseText('The static SRC boundary defense above is valid for audit even when route suction loss is not yet available.', 'Defense boundary SRC statis di atas tetap valid untuk audit walaupun suction loss route belum tersedia.')
    ], 'fluid-help-list fluid-warning-list'));

    appendSourceDefenseCard(layout, getSourceDefenseText('References Used', 'Referensi yang Digunakan'), () => createSourceDefenseList([
      getSourceDefenseText('Cengel & Cimbala, Fluid Mechanics: Bernoulli equation, pressure head, elevation head, and fluid properties.', 'Cengel & Cimbala, Fluid Mechanics: persamaan Bernoulli, head tekanan, head elevasi, dan properti fluida.'),
      getSourceDefenseText('Fox, McDonald & Pritchard, Introduction to Fluid Mechanics: steady incompressible energy balance and hydraulic losses.', 'Fox, McDonald & Pritchard, Introduction to Fluid Mechanics: energy balance steady incompressible dan kehilangan hidrolik.'),
      getSourceDefenseText('Hydraulic Institute NPSH Margin Guideline: NPSHa/NPSHr separation and cavitation margin interpretation.', 'Hydraulic Institute NPSH Margin Guideline: pemisahan NPSHa/NPSHr dan interpretasi margin kavitasi.')
    ]));

    return layout;
  }

  function sourceDefenseNeedsFallback(body) {
    if (!body) return false;
    if (body.dataset.engineeringSourceDefenseFallback === 'true' && body.querySelector?.('.source-formula-defense-fallback-layout')) {
      return false;
    }
    const text = String(body.textContent || '');
    const isSourceDefense = body.closest?.('.source-formula-defense-task-window')
      || body.classList?.contains('source-formula-defense-body');
    if (!isSourceDefense) return false;
    return /Source calculation trace is not available|Trace perhitungan Source tidak tersedia/i.test(text)
      || (/Defense Formula Source|Source Formula Defense/i.test(text) && text.trim().length < 360);
  }

  function repairSourceDefenseFallback(target, force = false) {
    if (!root.document) return false;
    const body = target?.classList?.contains('source-formula-defense-body')
      ? target
      : target?.querySelector?.('.source-formula-defense-body');
    if (!body) return false;
    if (!force && !sourceDefenseNeedsFallback(body)) return false;
    const windowNode = body.closest?.('.source-formula-defense-task-window');
    const sourceId = windowNode?.dataset.sourceNodeId || windowNode?.dataset.nodeId || '';
    const scrollTop = body.scrollTop || 0;
    body.replaceChildren(buildSourceDefenseFallbackLayout(sourceId));
    body.dataset.engineeringSourceDefenseFallback = 'true';
    body.scrollTop = Math.min(scrollTop, body.scrollHeight || 0);
    localizeRuntimeNodeTree(body);
    return true;
  }

  function repairOpenSourceDefenseFallbacks(force = false) {
    if (!root.document) return 0;
    let repaired = 0;
    root.document.querySelectorAll('.source-formula-defense-body, .source-formula-defense-task-window').forEach((node) => {
      if (repairSourceDefenseFallback(node, force)) repaired += 1;
    });
    return repaired;
  }

  function installSourceDefenseFallbackBridge() {
    if (root.__EngineeringSourceDefenseFallbackBridgeInstalled || typeof root.document === 'undefined') return;
    root.__EngineeringSourceDefenseFallbackBridgeInstalled = true;
    const scan = () => repairOpenSourceDefenseFallbacks(false);
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', scan, { once: true });
    else root.setTimeout?.(scan, 0);
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes?.forEach((node) => {
            if (node.nodeType === 1) repairSourceDefenseFallback(node, false);
          });
          if (mutation.type === 'characterData') {
            const parent = mutation.target?.parentElement;
            if (parent) repairSourceDefenseFallback(parent.closest?.('.source-formula-defense-body') || parent, false);
          }
        });
      });
      observer.observe(root.document.documentElement, { childList: true, subtree: true, characterData: true });
      root.__EngineeringSourceDefenseFallbackObserver = observer;
    }
    root.addEventListener?.('engineering-language-changed', () => root.setTimeout?.(() => repairOpenSourceDefenseFallbacks(true), 0));
  }

  function isLocalPreviewHost() {
    const hostname = String(root.location?.hostname || '').toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  }

  function getRequestUrl(input) {
    return typeof input === 'string' ? input : input?.url || '';
  }

  function isBackendSimulationFetch(input) {
    const requestUrl = getRequestUrl(input);
    if (!requestUrl) return false;
    try {
      const url = new URL(requestUrl, root.location?.href || 'http://localhost/');
      return /\/api\/simulate\/?$/.test(url.pathname);
    } catch (error) {
      return /\/api\/simulate\b/i.test(requestUrl);
    }
  }

  function createBackendSimulationOfflineResponse(input, error = null) {
    const statusText = error?.name === 'AbortError' ? 'Backend timeout' : 'Backend unavailable';
    const payload = {
      status: 'frontend-local-fallback',
      message: isLocalPreviewHost()
        ? 'Local preview skipped the protected backend request; realtime frontend solve remains active.'
        : 'Protected backend request was unavailable; frontend fallback remains active.',
      error: error?.message || '',
      requestUrl: getRequestUrl(input)
    };
    return new Response(JSON.stringify(payload), {
      status: 503,
      statusText,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  function shouldAllowBackendSimulationFetchOnLocal() {
    try {
      const raw = root.document?.getElementById('npsh-runtime-config')?.textContent || '{}';
      return JSON.parse(raw)?.allowExternalApiOnLocal === true;
    } catch (error) {
      return false;
    }
  }

  function shouldShortCircuitBackendSimulationFetch(input) {
    return isLocalPreviewHost() && isBackendSimulationFetch(input) && !shouldAllowBackendSimulationFetchOnLocal();
  }

  function installRealtimeAutosolveBridge() {
    if (!root.document) return;
    if (root.__NPSH_USE_LEGACY_BILINGUAL_AUTOSOLVE__ !== true) {
      root.__EngineeringRealtimeAutosolveInstalled = true;
      if (root.document.documentElement?.dataset) {
        root.document.documentElement.dataset.engineeringRealtimeAutosolveInstalled = 'disabled-by-realtime-defense';
      }
      return;
    }
    const installMarker = root.document.documentElement;
    if (root.__EngineeringRealtimeAutosolveInstalled || installMarker?.dataset.engineeringRealtimeAutosolveInstalled === 'true') return;
    try {
      root.__EngineeringRealtimeAutosolveInstalled = true;
    } catch (error) {
      // Some embedded audit contexts make window non-extensible; the DOM marker is enough.
    }
    if (installMarker?.dataset) installMarker.dataset.engineeringRealtimeAutosolveInstalled = 'true';

    let timer = null;
    let running = false;
    let pending = false;

    const getSolveButton = () => root.document.getElementById('btn-solve');
    const markActive = () => {
      const button = getSolveButton();
      if (!button) return;
      button.classList.add('active', 'solve-autosolve-active');
      button.setAttribute('aria-pressed', 'true');
      button.dataset.autosolve = 'active';
    };

    const isSolveInput = (target) => {
      if (!target || !target.matches?.('input, select, textarea')) return false;
      if (target.disabled || target.readOnly || target.type === 'file') return false;
      return !!target.closest?.('.task-window, .full-editor-modal, .canvas-task-window, #taskWindowBody, [data-task-prop-body="true"]');
    };

    const runSolve = () => {
      timer = null;
      if (typeof root.updateSimulation !== 'function') return;
      if (running) {
        pending = true;
        return;
      }
      running = true;
      pending = false;
      Promise.resolve(root.updateSimulation({
        refreshReason: 'solve',
        trigger: 'autosolve',
        renderSidebarAfter: false,
        allowExternalApiOnLocal: false,
        autoSolve: true
      }))
        .catch((error) => console.warn('Realtime autosolve used the frontend fallback.', error))
        .finally(() => {
          running = false;
          if (pending) timer = root.setTimeout?.(runSolve, 120);
        });
    };

    const scheduleSolve = (event) => {
      if (!isSolveInput(event.target) || event.isComposing) return;
      markActive();
      if (timer) root.clearTimeout?.(timer);
      timer = root.setTimeout?.(runSolve, event.type === 'input' ? 260 : 80);
    };

    markActive();
    root.document.addEventListener('input', scheduleSolve, true);
    root.document.addEventListener('change', scheduleSolve, true);
  }

  function patchSimulationCaseFetch() {
    if (typeof root.fetch !== 'function' || root.fetch.__engineeringBilingualPatched) return false;
    const originalFetch = root.fetch.bind(root);
    const patchedFetch = async function engineeringBilingualFetch(input, init) {
      if (shouldShortCircuitBackendSimulationFetch(input)) {
        return createBackendSimulationOfflineResponse(input);
      }
      let response;
      try {
        response = await originalFetch(input, init);
      } catch (error) {
        if (isBackendSimulationFetch(input)) return createBackendSimulationOfflineResponse(input, error);
        throw error;
      }
      try {
        const requestUrl = getRequestUrl(input);
        const responseUrl = response?.url || requestUrl;
        if (!String(responseUrl || requestUrl).includes('journals/simulation-cases.json')) return response;
        const manifest = await response.clone().json();
        const localized = localizeSimulationCasesManifest(manifest);
        const headers = typeof Headers !== 'undefined' ? new Headers(response.headers) : response.headers;
        headers?.set?.('content-type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify(localized), {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      } catch (error) {
        return response;
      }
    };
    patchedFetch.__engineeringBilingualPatched = true;
    patchedFetch.__engineeringBilingualOriginal = root.fetch;
    root.fetch = patchedFetch;
    return true;
  }

  function installRuntimeLocalizationBridge() {
    if (root.__EngineeringRuntimeLocalizationBridgeInstalled) return;
    root.__EngineeringRuntimeLocalizationBridgeInstalled = true;
    if (typeof root.document === 'undefined') return;
    patchRuntimeFunctions();
    patchSimulationCaseFetch();
    installSourceDefenseLayoutStyle();
    installSourceAdvisorVisibilityStyle();
    installSourceAdvisorVisibilityBridge();
    installRealtimeAutosolveBridge();
    installSourceDefenseFallbackBridge();

    const scan = () => localizeRuntimeNodeTree(root.document.body || root.document);
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', scan, { once: true });
    } else {
      scan();
    }
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes?.forEach((node) => localizeRuntimeNodeTree(node));
          if (mutation.type === 'characterData') localizeRuntimeTextNode(mutation.target);
          if (mutation.type === 'attributes') localizeRuntimeAttributes(mutation.target);
        });
      });
      observer.observe(root.document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['title', 'aria-label', 'placeholder']
      });
      root.__EngineeringRuntimeLocalizationObserver = observer;
    }
    if (typeof root.addEventListener === 'function') {
      root.addEventListener('engineering-language-changed', () => root.setTimeout?.(scan, 0));
    }
    root.setTimeout?.(patchRuntimeFunctions, 0);
  }

  function validateTraceKeyCoverage(requiredKeys) {
    const keys = Array.isArray(requiredKeys) && requiredKeys.length
      ? requiredKeys.map(String)
      : Object.keys(TRACE_KEY_MAPPINGS);
    const missingMappings = keys.filter((key) => !TRACE_KEY_MAPPINGS[key]);
    const missingText = Object.keys(TRACE_KEY_MAPPINGS).flatMap((key) => {
      const i18nKey = TRACE_KEY_MAPPINGS[key].i18nKey;
      return ['en', 'id']
        .filter((language) => root.EngineeringI18n && !hasText(i18nKey, language))
        .map((language) => ({ traceKey: key, i18nKey, language }));
    });
    return {
      ok: missingMappings.length === 0 && missingText.length === 0,
      checkedKeys: keys.length,
      mappedKeys: Object.keys(TRACE_KEY_MAPPINGS).length,
      missingMappings,
      missingText
    };
  }

  function getBilingualDiagnostics() {
    const missingCriticalTerms = root.EngineeringTerminology
      ? CRITICAL_TERM_KEYS.flatMap((key) => ['en', 'id']
        .filter((language) => !hasTerm(key, language))
        .map((language) => ({ key, language })))
      : [];
    const traceCoverage = validateTraceKeyCoverage();
    return {
      ok: missingCriticalTerms.length === 0 && traceCoverage.ok,
      version: VERSION,
      criticalTermKeys: CRITICAL_TERM_KEYS.slice(),
      missingCriticalTerms,
      traceCoverage,
      styleGuide: STYLE_GUIDE
    };
  }

  const traceRegistry = {
    version: VERSION,
    mappings: TRACE_KEY_MAPPINGS,
    getI18nKey: getTraceI18nKey,
    getLabel: getTraceLabel,
    validateCoverage: validateTraceKeyCoverage
  };

  const api = {
    version: VERSION,
    criticalTermKeys: CRITICAL_TERM_KEYS,
    terminologyTerms: TERMINOLOGY_TERMS,
    i18nTextEntries: I18N_TEXT_ENTRIES,
    runtimeTextEntries: RUNTIME_TEXT_ENTRIES,
    traceKeyMappings: TRACE_KEY_MAPPINGS,
    styleGuide: STYLE_GUIDE,
    registerTerminology,
    registerTextEntries,
    translateRuntimeText,
    localizeSimulationCasesManifest,
    sourceStandardForm: cloneSourceStandardFormContract(),
    applySourceStandardFormToProject,
    validateSourceStandardFormWindow,
    installRuntimeLocalizationBridge,
    getDiagnostics: getBilingualDiagnostics,
    traceRegistry
  };

  registerTerminology();
  registerTextEntries();
  installRuntimeLocalizationBridge();

  root.EngineeringTraceI18nRegistry = traceRegistry;
  root.EngineeringTerminologyStyleGuide = STYLE_GUIDE;
  root.EngineeringBilingualDiagnostics = {
    version: VERSION,
    getSummary: getBilingualDiagnostics,
    validateTraceKeyCoverage
  };
  root.EngineeringSourceStandardForm = root.EngineeringSourceStandardForm || Object.freeze({
    version: SOURCE_STANDARD_FORM_SCHEMA_VERSION,
    lockVersion: SOURCE_STANDARD_FORM_LOCK,
    valuePolicy: SOURCE_STANDARD_FORM_VALUE_POLICY,
    contract: cloneSourceStandardFormContract(),
    applyToProject: applySourceStandardFormToProject,
    validateWindow: validateSourceStandardFormWindow
  });
  root.EngineeringBilingualImprovements = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
