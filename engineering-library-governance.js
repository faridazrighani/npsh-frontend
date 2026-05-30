(function registerEngineeringLibraryGovernance(root) {
  const VERSION = '2026.05-library-governance-p3';

  const LIBRARY_MANIFEST = Object.freeze({
    id: 'ghani-npsh-engineering-library',
    version: VERSION,
    calculationEngineVersion: 'thesis-migration-v0.5.3',
    terminologyLibraryVersion: '2026.05-bilingual-runtime-2',
    traceSchemaVersion: 'trace-schema.v2',
    fluidPropertyLibraryVersion: 'fluid-property-governance.v1',
    unitLibraryVersion: 'unit-governance.v1',
    equipmentDataLibraryVersion: 'equipment-data-governance.v1',
    literatureRegistryVersion: 'literature-registry.v2',
    formulaLiteratureMapVersion: 'formula-literature-map.v2',
    journalOcrTerminologyVersion: 'journal-ocr-terminology.v2',
    narrativeWindowAuditVersion: 'narrative-window-audit.v2',
    citationPageLockWorkflowVersion: 'citation-page-lock-workflow.v1',
    journalOcrFixtureVersion: 'journal-ocr-fixtures.v1',
    narrativeMaintenanceGateVersion: 'narrative-maintenance-gate.v1',
    qualityGateVersion: 'library-translator-quality-gate.v2',
    protectedFrontendMode: true,
    publicSafe: true
  });

  const LITERATURE_REGISTRY = Object.freeze([
    {
      referenceId: 'cengel-fluid-mechanics-3e',
      title: 'Fluid Mechanics: Fundamentals and Applications',
      author: 'Cengel and Cimbala',
      edition: '3rd edition',
      localFile: 'book_pdf/Fluid_Cengel_FluidMechanics_3rdEd_2014.pdf',
      topics: ['Bernoulli equation', 'pressure head', 'minor loss', 'Reynolds number'],
      formulaGroups: ['boundary-head', 'pipe-loss', 'fluid-basis'],
      usedBy: ['source trace', 'sink trace', 'pipe trace', 'valve trace'],
      publicSafe: true
    },
    {
      referenceId: 'fox-mcdonald-fluid-mechanics-10e',
      title: 'Introduction to Fluid Mechanics',
      author: 'Fox, McDonald, and Pritchard',
      edition: '10th edition',
      localFile: 'book_pdf/Fluid_Fox_McDonald_IntroductionToFluidMechanics_10thEd.pdf',
      topics: ['Darcy-Weisbach', 'Moody friction factor', 'major loss', 'minor loss'],
      formulaGroups: ['pipe-loss', 'route-loss', 'unit-check'],
      usedBy: ['pipe trace', 'Route_Trace', 'Moody chart'],
      publicSafe: true
    },
    {
      referenceId: 'grist-cavitation-centrifugal-pump-1998',
      title: 'Cavitation and the Centrifugal Pump',
      author: 'Edward Grist',
      edition: '1998',
      localFile: 'book_pdf/Fluid_Grist_CavitationAndTheCentrifugalPump_1998.pdf',
      topics: ['cavitation', 'pump suction condition', 'NPSHa', 'NPSHr'],
      formulaGroups: ['npsh', 'pump-performance', 'engineering-interpretation'],
      usedBy: ['pump NPSH trace', 'cavitation warning', 'appendix interpretation'],
      publicSafe: true
    },
    {
      referenceId: 'hydraulic-institute-npsh-margin-2024',
      title: 'Rotodynamic Pumps Guideline for NPSH Margin',
      author: 'Hydraulic Institute',
      edition: '2024',
      localFile: 'book_pdf/Hydraulic_Institute_2024_Rotodynamic_Pumps_Guideline_for_NPSH_Margin.pdf',
      topics: ['NPSH margin', 'NPSH ratio', 'pump acceptance criteria'],
      formulaGroups: ['npsh-margin', 'pump-acceptance', 'review-status'],
      usedBy: ['NPSH acceptance criteria', 'pump status', 'engineering review'],
      publicSafe: true
    }
  ]);

  const UNIT_AUDIT_CASES = Object.freeze([
    { id: 'pressure-bar-a-to-pa', quantity: 'pressureAbs', from: 'bar a', to: 'Pa', input: 1, expected: 100000, tolerance: 1e-9, basisRule: 'absolute pressure' },
    { id: 'pressure-bar-g-to-bar-a-atmospheric', quantity: 'pressureAbs', from: 'bar g', to: 'bar a', input: 0, expected: 1.01325, tolerance: 1e-9, basisRule: 'gauge pressure requires atmospheric offset' },
    { id: 'pressure-kpa-to-bar', quantity: 'pressure', from: 'kPa', to: 'bar', input: 100, expected: 1, tolerance: 1e-9, basisRule: 'metric pressure' },
    { id: 'flow-m3h-to-m3s', quantity: 'flow', from: 'm3/h', to: 'm3/s', input: 3600, expected: 1, tolerance: 1e-12, basisRule: 'volumetric flow' },
    { id: 'flow-lps-to-m3h', quantity: 'flow', from: 'L/s', to: 'm3/h', input: 1, expected: 3.6, tolerance: 1e-12, basisRule: 'volumetric flow' },
    { id: 'viscosity-cp-to-pas', quantity: 'dynamicViscosity', from: 'cP', to: 'Pa.s', input: 1, expected: 0.001, tolerance: 1e-12, basisRule: 'dynamic viscosity' },
    { id: 'viscosity-cst-to-m2s', quantity: 'kinematicViscosity', from: 'cSt', to: 'm2/s', input: 1, expected: 0.000001, tolerance: 1e-15, basisRule: 'kinematic viscosity' },
    { id: 'temperature-c-to-k', quantity: 'temperature', from: 'deg C', to: 'K', input: 25, expected: 298.15, tolerance: 1e-12, basisRule: 'absolute temperature conversion' },
    { id: 'length-ft-to-m', quantity: 'length', from: 'ft', to: 'm', input: 1, expected: 0.3048, tolerance: 1e-12, basisRule: 'head and elevation conversion' },
    { id: 'density-gcm3-to-kgm3', quantity: 'density', from: 'g/cm3', to: 'kg/m3', input: 1, expected: 1000, tolerance: 1e-12, basisRule: 'density conversion' }
  ]);

  const FLUID_PROPERTY_GOVERNANCE = Object.freeze({
    water: {
      label: 'Water',
      validTemperatureRangeDegC: [0, 100],
      propertyMethod: 'built-in liquid water correlations',
      sourceConfidence: 'screening',
      vaporPressureBasis: 'absolute',
      requiredForNpsh: ['density', 'kinematicViscosity', 'dynamicViscosity', 'vaporPressure'],
      extrapolationPolicy: 'warn'
    },
    methanol: {
      label: 'Methanol',
      validTemperatureRangeDegC: [-97, 64.7],
      propertyMethod: 'built-in methanol liquid correlations with Antoine vapor pressure basis',
      sourceConfidence: 'screening',
      vaporPressureBasis: 'absolute',
      requiredForNpsh: ['density', 'kinematicViscosity', 'dynamicViscosity', 'vaporPressure'],
      extrapolationPolicy: 'warn'
    },
    palmOil: {
      label: 'Palm Oil',
      validTemperatureRangeDegC: [20, 90],
      propertyMethod: 'screening liquid property estimate',
      sourceConfidence: 'estimate',
      vaporPressureBasis: 'absolute',
      requiredForNpsh: ['density', 'kinematicViscosity', 'dynamicViscosity', 'vaporPressure'],
      extrapolationPolicy: 'warn'
    },
    crudeOil: {
      label: 'Crude Oil',
      validTemperatureRangeDegC: [0, 120],
      propertyMethod: 'screening crude oil property estimate',
      sourceConfidence: 'estimate',
      vaporPressureBasis: 'absolute',
      requiredForNpsh: ['density', 'kinematicViscosity', 'dynamicViscosity', 'vaporPressure'],
      extrapolationPolicy: 'warn'
    },
    customFluid: {
      label: 'Custom Fluid',
      validTemperatureRangeDegC: null,
      propertyMethod: 'user-defined',
      sourceConfidence: 'user',
      vaporPressureBasis: 'must be absolute',
      requiredForNpsh: ['density', 'kinematicViscosity', 'dynamicViscosity', 'vaporPressure'],
      extrapolationPolicy: 'needs-review'
    }
  });

  const EQUIPMENT_DATA_GOVERNANCE = Object.freeze({
    pipeRoughness: {
      sourceType: 'textbook-or-user',
      referenceIds: ['fox-mcdonald-fluid-mechanics-10e'],
      confidence: 'typical unless user-entered',
      editable: true,
      screeningOnly: true,
      warningRule: 'warn when roughness is high or user-defined without source note'
    },
    fittingK: {
      sourceType: 'textbook-or-user',
      referenceIds: ['cengel-fluid-mechanics-3e', 'fox-mcdonald-fluid-mechanics-10e'],
      confidence: 'typical',
      editable: true,
      screeningOnly: true,
      warningRule: 'warn when fitting is estimate or custom K is missing'
    },
    valveK: {
      sourceType: 'textbook-or-user',
      referenceIds: ['cengel-fluid-mechanics-3e', 'fox-mcdonald-fluid-mechanics-10e'],
      confidence: 'screening',
      editable: true,
      screeningOnly: true,
      warningRule: 'warn when valve controls NPSH margin and data is not vendor/test verified'
    },
    valveCv: {
      sourceType: 'vendor-or-user',
      referenceIds: ['cengel-fluid-mechanics-3e'],
      confidence: 'user unless vendor source is documented',
      editable: true,
      screeningOnly: true,
      warningRule: 'warn when Cv is default or opening characteristic is generic'
    },
    pumpNpshr: {
      sourceType: 'vendor-test-or-user',
      referenceIds: ['grist-cavitation-centrifugal-pump-1998', 'hydraulic-institute-npsh-margin-2024'],
      confidence: 'manual unless manufacturer/test curve is entered',
      editable: true,
      screeningOnly: false,
      warningRule: 'warn when NPSHr is estimated or missing'
    },
    pumpCurve: {
      sourceType: 'vendor-test-or-engineering-fit',
      referenceIds: ['grist-cavitation-centrifugal-pump-1998'],
      confidence: 'engineering fit unless manufacturer/test verified',
      editable: true,
      screeningOnly: false,
      warningRule: 'warn when operating point is outside POR/AOR or curve confidence is low'
    },
    checkValveCrackingHead: {
      sourceType: 'vendor-or-user',
      referenceIds: ['fox-mcdonald-fluid-mechanics-10e'],
      confidence: 'user unless vendor source is documented',
      editable: true,
      screeningOnly: true,
      warningRule: 'warn when check valve is in suction path and cracking head affects NPSHa'
    }
  });

  const NARRATIVE_WINDOW_AUDIT_REGISTRY = Object.freeze([
    {
      id: 'fluid-basis-task',
      label: 'Fluid Basis task window',
      surface: 'task-window',
      i18nStrategy: 'data-i18n-and-runtime-bridge',
      textKinds: ['input labels', 'basis notice', 'property trace', 'help note'],
      canonicalTerms: ['fluid-basis', 'density', 'vapor-pressure', 'specific-gravity'],
      auditCadence: 'per-release',
      publicSafe: true
    },
    {
      id: 'source-sink-help',
      label: 'SRC/SNK boundary guidance',
      surface: 'help-window',
      i18nStrategy: 'EngineeringI18n text keys',
      textKinds: ['boundary explanation', 'pressure basis guidance', 'route role'],
      canonicalTerms: ['SRC', 'SNK', 'pressure-head', 'boundary'],
      auditCadence: 'per-release',
      publicSafe: true
    },
    {
      id: 'pump-formula-defense',
      label: 'Pump Formula Defense',
      surface: 'formula-defense-window',
      i18nStrategy: 'EngineeringI18n text keys plus runtime narrative scanner',
      textKinds: ['advisor answer', 'formula explanation', 'literature basis', 'limitation'],
      canonicalTerms: ['pump', 'NPSHa', 'NPSHr', 'NPSH margin', 'NPSH ratio'],
      auditCadence: 'per-release-and-before-defense',
      publicSafe: true
    },
    {
      id: 'pipe-formula-defense',
      label: 'Pipe Formula Defense',
      surface: 'formula-defense-window',
      i18nStrategy: 'EngineeringI18n text keys plus runtime narrative scanner',
      textKinds: ['Darcy-Weisbach explanation', 'Reynolds explanation', 'K-method note', 'Moody chart role'],
      canonicalTerms: ['pipe', 'Re', 'Darcy f', 'K', 'head loss'],
      auditCadence: 'per-release-and-before-defense',
      publicSafe: true
    },
    {
      id: 'valve-formula-defense',
      label: 'Valve/Fitting Formula Defense',
      surface: 'formula-defense-window',
      i18nStrategy: 'traceKey registry plus runtime narrative scanner',
      textKinds: ['Cv/K distinction', 'opening effect', 'NPSH loss contribution', 'source note'],
      canonicalTerms: ['valve', 'Cv', 'K', 'specific gravity', 'pressure drop'],
      auditCadence: 'per-release-and-before-defense',
      publicSafe: true
    },
    {
      id: 'journal-import-ocr',
      label: 'Journal Import and OCR review',
      surface: 'import-workflow',
      i18nStrategy: 'journal OCR terminology map plus confidence diagnostics',
      textKinds: ['OCR candidate label', 'field mapping note', 'manual review warning'],
      canonicalTerms: ['flow rate', 'head', 'pressure', 'NPSH', 'pump', 'pipe', 'valve'],
      auditCadence: 'per-import-feature-change',
      publicSafe: true
    },
    {
      id: 'export-appendix',
      label: 'Excel/DOCX/PDF calculation appendix',
      surface: 'export',
      i18nStrategy: 'scenario export i18n keys plus formula literature map',
      textKinds: ['Route_Trace', 'Scenario_Guide', 'References', 'preflight warning'],
      canonicalTerms: ['Route_Trace', 'NPSH', 'literature basis', 'assumption', 'limitation'],
      auditCadence: 'per-release-and-before-defense',
      publicSafe: true
    }
  ]);

  const JOURNAL_OCR_TERMINOLOGY = Object.freeze([
    {
      canonicalKey: 'flow_rate',
      quantity: 'flow',
      unitFamily: 'flow',
      en: 'Flow rate',
      id: 'Laju alir',
      aliases: ['flow', 'flow rate', 'capacity', 'pump capacity', 'debit', 'laju alir', 'kapasitas', 'kapasitas pompa', 'aliran'],
      expectedUnits: ['m3/h', 'm3/s', 'gpm', 'lpm', 'L/s'],
      confidence: 'high'
    },
    {
      canonicalKey: 'head',
      quantity: 'head',
      unitFamily: 'length',
      en: 'Hydraulic head',
      id: 'Head hidrolik',
      aliases: ['head', 'total head', 'pump head', 'pressure head', 'tinggi tekan', 'head pompa', 'tinggi energi'],
      expectedUnits: ['m', 'ft'],
      confidence: 'high'
    },
    {
      canonicalKey: 'pressure',
      quantity: 'pressure',
      unitFamily: 'pressure',
      en: 'Pressure',
      id: 'Tekanan',
      aliases: ['pressure', 'suction pressure', 'discharge pressure', 'tekanan', 'tekanan isap', 'tekanan discharge', 'tekanan keluar'],
      expectedUnits: ['bar', 'bar a', 'bar g', 'kPa', 'psi', 'psia', 'psig'],
      confidence: 'high'
    },
    {
      canonicalKey: 'density',
      quantity: 'density',
      unitFamily: 'density',
      en: 'Density',
      id: 'Densitas',
      aliases: ['density', 'rho', 'mass density', 'densitas', 'massa jenis', 'rapat massa'],
      expectedUnits: ['kg/m3', 'lb/ft3', 'g/cm3'],
      confidence: 'high'
    },
    {
      canonicalKey: 'kinematic_viscosity',
      quantity: 'kinematicViscosity',
      unitFamily: 'kinematicViscosity',
      en: 'Kinematic viscosity',
      id: 'Viskositas kinematik',
      aliases: ['kinematic viscosity', 'viscosity', 'nu', 'cst', 'viskositas kinematik', 'viskositas'],
      expectedUnits: ['cSt', 'm2/s'],
      confidence: 'medium'
    },
    {
      canonicalKey: 'dynamic_viscosity',
      quantity: 'dynamicViscosity',
      unitFamily: 'dynamicViscosity',
      en: 'Dynamic viscosity',
      id: 'Viskositas dinamik',
      aliases: ['dynamic viscosity', 'absolute viscosity', 'mu', 'cp', 'viskositas dinamik', 'viskositas absolut'],
      expectedUnits: ['cP', 'Pa.s'],
      confidence: 'medium'
    },
    {
      canonicalKey: 'vapor_pressure',
      quantity: 'pressureAbs',
      unitFamily: 'pressure',
      en: 'Vapor pressure',
      id: 'Tekanan uap',
      aliases: ['vapor pressure', 'vapour pressure', 'pv', 'tekanan uap', 'tekanan jenuh'],
      expectedUnits: ['bar a', 'kPa a', 'psia'],
      confidence: 'high'
    },
    {
      canonicalKey: 'specific_gravity',
      quantity: 'dimensionless',
      unitFamily: 'dimensionless',
      en: 'Specific gravity',
      id: 'Specific gravity',
      aliases: ['specific gravity', 'sg', 'relative density', 'densitas relatif', 'berat jenis relatif'],
      expectedUnits: ['', '-'],
      confidence: 'high'
    },
    {
      canonicalKey: 'npsha',
      quantity: 'npsh',
      unitFamily: 'length',
      en: 'NPSHa',
      id: 'NPSHa',
      aliases: ['npsha', 'npsh available', 'available npsh', 'npsh tersedia'],
      expectedUnits: ['m', 'ft'],
      confidence: 'high'
    },
    {
      canonicalKey: 'npshr',
      quantity: 'npsh',
      unitFamily: 'length',
      en: 'NPSHr',
      id: 'NPSHr',
      aliases: ['npshr', 'required npsh', 'npsh required', 'npsh dibutuhkan'],
      expectedUnits: ['m', 'ft'],
      confidence: 'high'
    },
    {
      canonicalKey: 'pump',
      quantity: 'equipment',
      unitFamily: '',
      en: 'Pump',
      id: 'Pompa',
      aliases: ['pump', 'centrifugal pump', 'pompa', 'pompa sentrifugal'],
      expectedUnits: [],
      confidence: 'high'
    },
    {
      canonicalKey: 'pipe',
      quantity: 'equipment',
      unitFamily: '',
      en: 'Pipe',
      id: 'Pipa',
      aliases: ['pipe', 'pipeline', 'piping', 'pipa', 'saluran pipa'],
      expectedUnits: [],
      confidence: 'high'
    },
    {
      canonicalKey: 'valve',
      quantity: 'equipment',
      unitFamily: '',
      en: 'Valve',
      id: 'Katup',
      aliases: ['valve', 'control valve', 'check valve', 'katup', 'keran', 'katup kontrol', 'katup cek'],
      expectedUnits: [],
      confidence: 'high'
    },
    {
      canonicalKey: 'valve_cv',
      quantity: 'dimensionless',
      unitFamily: 'dimensionless',
      en: 'Valve Cv',
      id: 'Cv katup',
      aliases: ['valve cv', 'flow coefficient', 'koefisien alir katup', 'cv katup'],
      expectedUnits: ['', '-'],
      confidence: 'high'
    }
  ]);

  const FORMULA_LITERATURE_MAP = Object.freeze([
    {
      formulaId: 'fluid-basis-property-chain',
      label: 'Fluid Basis property chain',
      traceKeys: ['source-fluid-density', 'source-fluid-viscosity', 'source-fluid-vapor-pressure', 'sink-fluid-density', 'sink-fluid-vapor-pressure'],
      referenceIds: ['cengel-fluid-mechanics-3e'],
      chapterOrSection: 'Fluid properties, density, viscosity, and vapor pressure as input basis',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['density', 'viscosity', 'vapor pressure'] },
      assumptions: ['single-phase liquid', 'absolute vapor pressure basis', 'screening property correlations unless user/vendor data is supplied'],
      limitations: ['not a thermodynamic flash calculation', 'custom fluid data remains user responsibility'],
      publicSafe: true
    },
    {
      formulaId: 'source-boundary-hydraulic-head',
      label: 'Source boundary hydraulic head',
      traceKeys: ['source-trace-pressure-input', 'source-absolute-pressure', 'source-trace-pressure-head', 'source-trace-velocity-head', 'source-trace-hydraulic-head'],
      referenceIds: ['cengel-fluid-mechanics-3e', 'fox-mcdonald-fluid-mechanics-10e'],
      chapterOrSection: 'Bernoulli equation and pressure/elevation/velocity head terms',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['Bernoulli equation', 'pressure head', 'velocity head'] },
      assumptions: ['steady incompressible liquid', 'pressure basis converted to absolute before NPSH calculation'],
      limitations: ['transient surge and two-phase effects are outside scope'],
      publicSafe: true
    },
    {
      formulaId: 'sink-boundary-hydraulic-head',
      label: 'Sink boundary hydraulic head',
      traceKeys: ['sink-trace-boundary-mode', 'sink-boundary-pressure', 'sink-trace-pressure-head', 'sink-trace-velocity-head', 'sink-hydraulic-head'],
      referenceIds: ['cengel-fluid-mechanics-3e', 'fox-mcdonald-fluid-mechanics-10e'],
      chapterOrSection: 'Energy equation at downstream boundary and terminal pressure profile',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['energy equation', 'pressure head', 'stagnation pressure'] },
      assumptions: ['steady boundary condition', 'single terminal pressure or flow demand mode'],
      limitations: ['control-system dynamics are not represented'],
      publicSafe: true
    },
    {
      formulaId: 'reynolds-number',
      label: 'Reynolds number',
      traceKeys: [],
      referenceIds: ['cengel-fluid-mechanics-3e', 'fox-mcdonald-fluid-mechanics-10e'],
      chapterOrSection: 'Internal flow regime and Reynolds number',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['Reynolds number', 'internal flow'] },
      assumptions: ['circular equivalent hydraulic diameter', 'Newtonian liquid screening basis'],
      limitations: ['non-Newtonian fluids require separate validation'],
      publicSafe: true
    },
    {
      formulaId: 'darcy-weisbach-pipe-loss',
      label: 'Darcy-Weisbach pipe head loss',
      traceKeys: [],
      referenceIds: ['fox-mcdonald-fluid-mechanics-10e', 'cengel-fluid-mechanics-3e'],
      chapterOrSection: 'Darcy-Weisbach equation for major loss',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['Darcy-Weisbach', 'major loss', 'head loss'] },
      assumptions: ['steady fully developed internal flow approximation', 'pipe roughness is typical/user/vendor basis'],
      limitations: ['water hammer, erosion, and fouling growth are outside current solver scope'],
      publicSafe: true
    },
    {
      formulaId: 'moody-friction-factor',
      label: 'Moody/Colebrook friction factor basis',
      traceKeys: [],
      referenceIds: ['fox-mcdonald-fluid-mechanics-10e'],
      chapterOrSection: 'Moody chart and turbulent friction factor',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['Moody chart', 'friction factor', 'relative roughness'] },
      assumptions: ['Darcy friction factor convention', 'relative roughness from pipe material/user input'],
      limitations: ['transitional regime should be reviewed by engineer'],
      publicSafe: true
    },
    {
      formulaId: 'minor-loss-k-method',
      label: 'Minor loss K-method',
      traceKeys: [],
      referenceIds: ['cengel-fluid-mechanics-3e', 'fox-mcdonald-fluid-mechanics-10e'],
      chapterOrSection: 'Minor losses for fittings, entrances, exits, and local components',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['minor loss', 'loss coefficient', 'K'] },
      assumptions: ['K values are typical/user/vendor basis', 'single-phase hydraulic screening'],
      limitations: ['component-specific vendor curves supersede generic K values'],
      publicSafe: true
    },
    {
      formulaId: 'valve-k-cv-loss',
      label: 'Valve K/Cv hydraulic loss',
      traceKeys: ['valve-loss-model', 'valve-effective-cv', 'valve-effective-k', 'valve-head-loss', 'valve-pressure-drop', 'valve-npsh-loss-contribution'],
      referenceIds: ['cengel-fluid-mechanics-3e', 'fox-mcdonald-fluid-mechanics-10e'],
      chapterOrSection: 'Local valve loss and flow coefficient interpretation',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['valve', 'flow coefficient', 'minor loss'] },
      assumptions: ['Cv means valve flow coefficient in valve context', 'opening characteristic is screening unless vendor data is supplied'],
      limitations: ['control valve cavitation/choked flow sizing is outside current NPSH screening scope'],
      publicSafe: true
    },
    {
      formulaId: 'pump-npsha',
      label: 'Pump NPSHa',
      traceKeys: ['sink-pump-npsha'],
      referenceIds: ['grist-cavitation-centrifugal-pump-1998', 'hydraulic-institute-npsh-margin-2024'],
      chapterOrSection: 'Available NPSH from suction boundary pressure head minus vapor pressure head and suction losses',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['NPSH', 'NPSHA', 'available NPSH'] },
      assumptions: ['pump suction condition is steady', 'vapor pressure is absolute', 'suction losses are resolved from route'],
      limitations: ['no transient, flashing, or two-phase validation'],
      publicSafe: true
    },
    {
      formulaId: 'pump-npshr',
      label: 'Pump NPSHr',
      traceKeys: ['designNpshr', 'sink-pump-npshr'],
      referenceIds: ['grist-cavitation-centrifugal-pump-1998', 'hydraulic-institute-npsh-margin-2024'],
      chapterOrSection: 'Required NPSH from manufacturer/test data or engineering estimate',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['NPSHR', 'required NPSH', 'manufacturer'] },
      assumptions: ['manufacturer/test curve preferred', 'journal/vendor duty data can support engineering fit'],
      limitations: ['estimated NPSHr requires advisor/vendor review before final design'],
      publicSafe: true
    },
    {
      formulaId: 'npsh-margin-ratio',
      label: 'NPSH margin and ratio',
      traceKeys: ['sink-pump-npsh-margin', 'sink-pump-npsh-ratio'],
      referenceIds: ['hydraulic-institute-npsh-margin-2024', 'grist-cavitation-centrifugal-pump-1998'],
      chapterOrSection: 'NPSH margin guideline and acceptance interpretation',
      pageLocator: { status: 'pending-page-lock', searchTerms: ['NPSH margin', 'NPSH ratio', 'rotodynamic pumps'] },
      assumptions: ['margin policy selected by app/user is applied consistently', 'status label is review guidance'],
      limitations: ['final acceptance remains project/company/vendor criterion'],
      publicSafe: true
    },
    {
      formulaId: 'route-trace-status',
      label: 'Route calculation trace status',
      traceKeys: ['source-flow', 'sink-flow', 'valve-npsh-loss-contribution'],
      referenceIds: ['cengel-fluid-mechanics-3e', 'fox-mcdonald-fluid-mechanics-10e', 'hydraulic-institute-npsh-margin-2024'],
      chapterOrSection: 'Energy balance from Fluid Basis -> SRC -> suction path -> pump -> discharge path -> SNK',
      pageLocator: { status: 'composite-trace', searchTerms: ['Bernoulli equation', 'Darcy-Weisbach', 'NPSH margin'] },
      assumptions: ['route is connected and solved as a steady hydraulic path', 'trace is presentation/audit metadata'],
      limitations: ['does not expose protected backend formula source in public frontend'],
      publicSafe: true
    }
  ]);

  const QUALITY_GATE_RULES = Object.freeze([
    {
      id: 'all-html-i18n-keys-have-en-id',
      severity: 'error',
      scope: 'frontend',
      description: 'Every data-i18n key in HTML must have English and Indonesian entries.'
    },
    {
      id: 'all-backend-trace-keys-have-i18n-and-schema',
      severity: 'error',
      scope: 'frontend-backend-contract',
      description: 'Every backend trace key must have a bilingual trace label and governance schema entry.'
    },
    {
      id: 'runtime-toast-confirm-localized',
      severity: 'error',
      scope: 'runtime-ui',
      description: 'New toast and confirm text must be covered by runtime bilingual translation or first-class i18n key.'
    },
    {
      id: 'simulation-case-metadata-bilingual',
      severity: 'error',
      scope: 'simulation-cases',
      description: 'Every simulation case must provide menuTitleI18n and titleI18n; disabled cases must provide disabledReasonI18n.'
    },
    {
      id: 'formula-literature-map-present',
      severity: 'error',
      scope: 'library',
      description: 'Formula groups used in trace/export must have public-safe literature reference metadata.'
    },
    {
      id: 'journal-ocr-term-confidence',
      severity: 'warning',
      scope: 'journal-import',
      description: 'Journal import/OCR field mapping must resolve to a canonical technical term or produce a manual review warning.'
    },
    {
      id: 'citation-page-lock-status-tracked',
      severity: 'warning',
      scope: 'literature',
      description: 'Every formula citation must declare whether its PDF page locator is pending, candidate-located, page-locked, or manual-review.'
    },
    {
      id: 'journal-ocr-fixtures-pass',
      severity: 'warning',
      scope: 'journal-import',
      description: 'Mixed Indonesian/English OCR samples must resolve to canonical engineering keys or require manual review.'
    },
    {
      id: 'narrative-maintenance-registry-current',
      severity: 'warning',
      scope: 'help-and-formula-defense',
      description: 'Long help, Formula Defense, export, and import narratives must stay registered for periodic bilingual review.'
    }
  ]);

  const CITATION_PAGE_LOCK_WORKFLOW = Object.freeze({
    version: LIBRARY_MANIFEST.citationPageLockWorkflowVersion,
    allowedStatuses: Object.freeze(['pending-page-lock', 'candidate-located', 'page-locked', 'manual-review', 'composite-trace']),
    finalStatuses: Object.freeze(['page-locked', 'composite-trace']),
    pageLockedRequiredFields: Object.freeze(['pdfPage', 'printedPage', 'evidence', 'reviewer', 'reviewedAt']),
    candidateRequiredFields: Object.freeze(['candidatePages', 'searchTerms']),
    pendingRequiredFields: Object.freeze(['searchTerms']),
    evidenceLimit: 'store short public-safe evidence only; do not copy long copyrighted book text',
    process: Object.freeze([
      'extract or search candidate formula pages from local book_pdf references',
      'match formulaId searchTerms against formula chapterOrSection and trace role',
      'record candidatePages with referenceId, pdfPage, printedPage if visible, and short evidence',
      'promote to page-locked only after manual reviewer confirms formula context',
      'run citation-page-lock audit before thesis defense or final release'
    ])
  });

  const JOURNAL_OCR_FIXTURES = Object.freeze([
    {
      id: 'id-flow-capacity-gpm',
      input: 'kapasitas pompa 100 gpm',
      unit: 'gpm',
      expectedCanonicalKey: 'flow_rate',
      expectedLanguage: 'id',
      expectedOk: true
    },
    {
      id: 'en-suction-pressure-barg',
      input: 'suction pressure 1.2 bar g',
      unit: 'bar g',
      expectedCanonicalKey: 'pressure',
      expectedLanguage: 'en',
      expectedOk: true
    },
    {
      id: 'id-density-kgm3',
      input: 'massa jenis fluida 997 kg/m3',
      unit: 'kg/m3',
      expectedCanonicalKey: 'density',
      expectedLanguage: 'id',
      expectedOk: true
    },
    {
      id: 'id-dynamic-viscosity-cp',
      input: 'viskositas dinamik 0.89 cP',
      unit: 'cP',
      expectedCanonicalKey: 'dynamic_viscosity',
      expectedLanguage: 'id',
      expectedOk: true
    },
    {
      id: 'mixed-npshr',
      input: 'NPSH dibutuhkan 3 m at rated flow',
      unit: 'm',
      expectedCanonicalKey: 'npshr',
      expectedLanguage: 'id',
      expectedOk: true
    },
    {
      id: 'unknown-needs-review',
      input: 'angka laporan tidak dikenal',
      unit: '',
      expectedCanonicalKey: '',
      expectedLanguage: '',
      expectedOk: false,
      expectedReviewRequired: true
    }
  ]);

  const NARRATIVE_MAINTENANCE_GATE = Object.freeze({
    version: LIBRARY_MANIFEST.narrativeMaintenanceGateVersion,
    requiredSurfaces: Object.freeze(['task-window', 'help-window', 'formula-defense-window', 'import-workflow', 'export']),
    requiredTextKinds: Object.freeze(['formula explanation', 'literature basis', 'manual review warning', 'Route_Trace']),
    releaseTrigger: 'run after every feature that adds task windows, help text, Formula Defense content, import/OCR mapping, export sheet, or route trace label',
    staleAfterDays: 90,
    evidence: Object.freeze([
      'registered surface in NARRATIVE_WINDOW_AUDIT_REGISTRY',
      'declared i18nStrategy',
      'canonicalTerms linked to engineering bilingual terminology',
      'publicSafe flag true'
    ])
  });

  function normalizeKey(value) {
    return String(value || '').trim();
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[µμ]/g, 'mu')
      .replace(/[ρ]/g, 'rho')
      .replace(/[_/\\-]+/g, ' ')
      .replace(/[(){}[\],.;:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function detectTermLanguage(term, alias) {
    const text = normalizeSearchText(alias);
    const idWords = ['debit', 'laju', 'tekanan', 'pompa', 'pipa', 'katup', 'viskositas', 'densitas', 'massa', 'jenis', 'rapat', 'uap', 'tinggi', 'tersedia', 'dibutuhkan'];
    const enWords = ['flow', 'pressure', 'pump', 'pipe', 'valve', 'viscosity', 'density', 'vapor', 'head'];
    if (idWords.some((word) => text.includes(word))) return 'id';
    if (enWords.some((word) => text.includes(word))) return 'en';
    return term.id && normalizeSearchText(term.id) === text ? 'id' : 'en';
  }

  function normalizeJournalOcrTerm(input, options = {}) {
    const raw = String(input || '');
    const normalized = normalizeSearchText(raw);
    if (!normalized) {
      return {
        ok: false,
        canonicalKey: '',
        confidence: 'none',
        matchType: 'empty',
        reviewRequired: true,
        input: raw
      };
    }
    const unitHint = normalizeSearchText(options.unit || '');
    let best = null;
    JOURNAL_OCR_TERMINOLOGY.forEach((term) => {
      const aliases = [term.en, term.id, ...(term.aliases || [])].filter(Boolean);
      aliases.forEach((alias) => {
        const candidate = normalizeSearchText(alias);
        if (!candidate) return;
        const exact = normalized === candidate;
        const phrase = normalized.includes(candidate) || candidate.includes(normalized);
        if (!exact && !phrase) return;
        const unitBonus = unitHint && (term.expectedUnits || []).map(normalizeSearchText).includes(unitHint) ? 1 : 0;
        const score = (exact ? 30 : 10) + unitBonus * 5 + Math.min(candidate.length, 80) / 100;
        if (!best || score > best.score) {
          best = {
            score,
            ok: true,
            canonicalKey: term.canonicalKey,
            quantity: term.quantity,
            unitFamily: term.unitFamily,
            label: { en: term.en, id: term.id },
            confidence: exact || unitBonus ? term.confidence : 'medium',
            matchType: exact ? 'exact' : 'phrase',
            matchedAlias: alias,
            languageDetected: detectTermLanguage(term, alias),
            expectedUnits: (term.expectedUnits || []).slice(),
            reviewRequired: term.confidence !== 'high' && !unitBonus,
            input: raw
          };
        }
      });
    });
    return best || {
      ok: false,
      canonicalKey: '',
      confidence: 'unresolved',
      matchType: 'none',
      reviewRequired: true,
      input: raw
    };
  }

  function validateNarrativeWindowAudit() {
    const required = ['pump-formula-defense', 'pipe-formula-defense', 'valve-formula-defense', 'journal-import-ocr', 'export-appendix'];
    const ids = new Set(NARRATIVE_WINDOW_AUDIT_REGISTRY.map((item) => item.id));
    const missing = required.filter((id) => !ids.has(id));
    const incomplete = NARRATIVE_WINDOW_AUDIT_REGISTRY
      .filter((item) => !item.id || !item.label || !item.i18nStrategy || !Array.isArray(item.textKinds) || !item.textKinds.length || item.publicSafe !== true)
      .map((item) => item.id || '(missing)');
    return {
      ok: missing.length === 0 && incomplete.length === 0,
      required,
      missing,
      incomplete,
      auditedWindows: NARRATIVE_WINDOW_AUDIT_REGISTRY.length
    };
  }

  function validateJournalOcrTerminology() {
    const required = ['flow_rate', 'head', 'pressure', 'density', 'vapor_pressure', 'npsha', 'npshr', 'pump', 'pipe', 'valve', 'valve_cv'];
    const byKey = new Map(JOURNAL_OCR_TERMINOLOGY.map((term) => [term.canonicalKey, term]));
    const missing = required.filter((key) => !byKey.has(key));
    const incomplete = JOURNAL_OCR_TERMINOLOGY
      .filter((term) => !term.canonicalKey || !term.en || !term.id || !Array.isArray(term.aliases) || term.aliases.length < 2 || typeof term.confidence !== 'string')
      .map((term) => term.canonicalKey || '(missing)');
    const bilingualGaps = JOURNAL_OCR_TERMINOLOGY
      .filter((term) => !(term.aliases || []).some((alias) => detectTermLanguage(term, alias) === 'en') || !(term.aliases || []).some((alias) => detectTermLanguage(term, alias) === 'id'))
      .map((term) => term.canonicalKey);
    return {
      ok: missing.length === 0 && incomplete.length === 0 && bilingualGaps.length === 0,
      required,
      missing,
      incomplete,
      bilingualGaps,
      terms: JOURNAL_OCR_TERMINOLOGY.length
    };
  }

  function getCitationPageLockStatus() {
    const allowedStatuses = CITATION_PAGE_LOCK_WORKFLOW.allowedStatuses;
    const byStatus = allowedStatuses.reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});
    const formulas = FORMULA_LITERATURE_MAP.map((entry) => {
      const status = entry.pageLocator?.status || 'missing';
      byStatus[status] = (byStatus[status] || 0) + 1;
      return {
        formulaId: entry.formulaId,
        label: entry.label,
        status,
        referenceIds: (entry.referenceIds || []).slice(),
        searchTerms: (entry.pageLocator?.searchTerms || []).slice(),
        candidatePages: (entry.pageLocator?.candidatePages || []).slice()
      };
    });
    return {
      version: CITATION_PAGE_LOCK_WORKFLOW.version,
      total: formulas.length,
      byStatus,
      pendingFormulaIds: formulas.filter((item) => item.status === 'pending-page-lock').map((item) => item.formulaId),
      candidateFormulaIds: formulas.filter((item) => item.status === 'candidate-located').map((item) => item.formulaId),
      pageLockedFormulaIds: formulas.filter((item) => item.status === 'page-locked').map((item) => item.formulaId),
      manualReviewFormulaIds: formulas.filter((item) => item.status === 'manual-review').map((item) => item.formulaId),
      compositeTraceFormulaIds: formulas.filter((item) => item.status === 'composite-trace').map((item) => item.formulaId),
      formulas
    };
  }

  function validateCitationPageLockWorkflow() {
    const allowedStatuses = new Set(CITATION_PAGE_LOCK_WORKFLOW.allowedStatuses);
    const literatureIds = new Set(LITERATURE_REGISTRY.map((reference) => reference.referenceId));
    const missingLocator = [];
    const invalidStatus = [];
    const incomplete = [];
    const invalidCandidateReferences = [];

    FORMULA_LITERATURE_MAP.forEach((entry) => {
      const locator = entry.pageLocator || null;
      const status = locator?.status;
      if (!locator) {
        missingLocator.push(entry.formulaId);
        return;
      }
      if (!allowedStatuses.has(status)) {
        invalidStatus.push(entry.formulaId);
      }

      const hasSearchTerms = Array.isArray(locator.searchTerms) && locator.searchTerms.length > 0;
      if ((status === 'pending-page-lock' || status === 'manual-review' || status === 'composite-trace') && !hasSearchTerms) {
        incomplete.push(entry.formulaId);
      }
      if (status === 'candidate-located') {
        const hasCandidates = Array.isArray(locator.candidatePages) && locator.candidatePages.length > 0;
        if (!hasSearchTerms || !hasCandidates) {
          incomplete.push(entry.formulaId);
        }
      }
      if (status === 'page-locked') {
        const missingFields = CITATION_PAGE_LOCK_WORKFLOW.pageLockedRequiredFields
          .filter((field) => locator[field] === undefined || locator[field] === null || locator[field] === '');
        if (missingFields.length > 0) {
          incomplete.push(`${entry.formulaId}:${missingFields.join(',')}`);
        }
      }
      (locator.candidatePages || []).forEach((candidate) => {
        if (candidate.referenceId && !literatureIds.has(candidate.referenceId)) {
          invalidCandidateReferences.push(`${entry.formulaId}:${candidate.referenceId}`);
        }
      });
    });

    const status = getCitationPageLockStatus();
    return {
      ok: missingLocator.length === 0 && invalidStatus.length === 0 && incomplete.length === 0 && invalidCandidateReferences.length === 0,
      workflowVersion: CITATION_PAGE_LOCK_WORKFLOW.version,
      allowedStatuses: CITATION_PAGE_LOCK_WORKFLOW.allowedStatuses,
      missingLocator,
      invalidStatus,
      incomplete,
      invalidCandidateReferences,
      status
    };
  }

  function validateJournalOcrFixtures() {
    const results = JOURNAL_OCR_FIXTURES.map((fixture) => {
      const normalized = normalizeJournalOcrTerm(fixture.input, { unit: fixture.unit });
      const expectedOk = fixture.expectedOk !== false;
      const keyMatches = expectedOk
        ? normalized.canonicalKey === fixture.expectedCanonicalKey
        : !normalized.ok && normalized.reviewRequired === Boolean(fixture.expectedReviewRequired);
      const languageMatches = !expectedOk || !fixture.expectedLanguage || normalized.languageDetected === fixture.expectedLanguage;
      const okMatches = normalized.ok === expectedOk;
      return {
        id: fixture.id,
        ok: keyMatches && languageMatches && okMatches,
        expectedCanonicalKey: fixture.expectedCanonicalKey,
        actualCanonicalKey: normalized.canonicalKey,
        expectedLanguage: fixture.expectedLanguage,
        actualLanguage: normalized.languageDetected || '',
        reviewRequired: Boolean(normalized.reviewRequired)
      };
    });
    return {
      ok: results.every((result) => result.ok),
      fixtures: results.length,
      failed: results.filter((result) => !result.ok),
      results
    };
  }

  function validateNarrativeMaintenanceGate() {
    const surfaces = new Set(NARRATIVE_WINDOW_AUDIT_REGISTRY.map((entry) => entry.surface));
    const textKinds = new Set(NARRATIVE_WINDOW_AUDIT_REGISTRY.flatMap((entry) => entry.textKinds || []));
    const missingSurfaces = NARRATIVE_MAINTENANCE_GATE.requiredSurfaces.filter((surface) => !surfaces.has(surface));
    const missingTextKinds = NARRATIVE_MAINTENANCE_GATE.requiredTextKinds.filter((kind) => !textKinds.has(kind));
    const incomplete = NARRATIVE_WINDOW_AUDIT_REGISTRY
      .filter((entry) => !entry.auditCadence || !entry.i18nStrategy || !Array.isArray(entry.canonicalTerms) || entry.canonicalTerms.length === 0 || entry.publicSafe !== true)
      .map((entry) => entry.id || '(missing)');
    const formulaDefenseWindows = NARRATIVE_WINDOW_AUDIT_REGISTRY.filter((entry) => entry.surface === 'formula-defense-window').length;
    return {
      ok: missingSurfaces.length === 0 && missingTextKinds.length === 0 && incomplete.length === 0 && formulaDefenseWindows >= 3,
      version: NARRATIVE_MAINTENANCE_GATE.version,
      missingSurfaces,
      missingTextKinds,
      incomplete,
      formulaDefenseWindows,
      staleAfterDays: NARRATIVE_MAINTENANCE_GATE.staleAfterDays
    };
  }

  function getFormulaLiteratureEntry(formulaId) {
    const key = normalizeKey(formulaId);
    return FORMULA_LITERATURE_MAP.find((entry) => entry.formulaId === key) || null;
  }

  function validateFormulaLiteratureMap() {
    const required = [
      'fluid-basis-property-chain',
      'source-boundary-hydraulic-head',
      'sink-boundary-hydraulic-head',
      'reynolds-number',
      'darcy-weisbach-pipe-loss',
      'minor-loss-k-method',
      'valve-k-cv-loss',
      'pump-npsha',
      'pump-npshr',
      'npsh-margin-ratio',
      'route-trace-status'
    ];
    const ids = new Set(FORMULA_LITERATURE_MAP.map((entry) => entry.formulaId));
    const literatureIds = new Set(LITERATURE_REGISTRY.map((item) => item.referenceId));
    const missing = required.filter((id) => !ids.has(id));
    const incomplete = FORMULA_LITERATURE_MAP
      .filter((entry) => !entry.formulaId || !entry.label || !Array.isArray(entry.referenceIds) || !entry.referenceIds.length || !entry.chapterOrSection || !entry.pageLocator || !Array.isArray(entry.assumptions) || !Array.isArray(entry.limitations) || entry.publicSafe !== true)
      .map((entry) => entry.formulaId || '(missing)');
    const missingReferences = FORMULA_LITERATURE_MAP
      .filter((entry) => !entry.referenceIds.every((referenceId) => literatureIds.has(referenceId)))
      .map((entry) => entry.formulaId);
    const traceLinked = FORMULA_LITERATURE_MAP
      .filter((entry) => Array.isArray(entry.traceKeys) && entry.traceKeys.length > 0)
      .map((entry) => entry.formulaId);
    return {
      ok: missing.length === 0 && incomplete.length === 0 && missingReferences.length === 0 && traceLinked.length >= 8,
      required,
      missing,
      incomplete,
      missingReferences,
      traceLinked,
      formulas: FORMULA_LITERATURE_MAP.length
    };
  }

  function inferObjectType(traceKey) {
    if (traceKey.startsWith('source-')) return 'source';
    if (traceKey.startsWith('sink-')) return 'sink';
    if (traceKey.startsWith('valve-') || traceKey.startsWith('control-valve-')) return 'valve';
    if (traceKey.startsWith('design')) return 'pump';
    return 'general';
  }

  function inferQuantity(traceKey) {
    const key = traceKey.toLowerCase();
    if (key.includes('npsh')) return 'npsh';
    if (key.includes('pressure')) return 'pressure';
    if (key.includes('head') || key.includes('loss')) return 'head';
    if (key.includes('flow')) return key.includes('mass') ? 'massFlow' : 'flow';
    if (key.includes('density')) return 'density';
    if (key.includes('specific-gravity')) return 'specificGravity';
    if (key.includes('viscosity')) return 'kinematicViscosity';
    if (key.includes('temperature')) return 'temperature';
    if (key.includes('diameter') || key.includes('bore')) return 'length';
    if (key.includes('ratio') || key.includes('efficiency') || key.includes('opening') || key.includes('characteristic') || key.includes('cv') || key.includes('-k')) return 'dimensionless';
    return 'text';
  }

  function inferUnitFamily(quantity) {
    return {
      pressure: 'pressure',
      head: 'length',
      npsh: 'length',
      flow: 'flow',
      massFlow: 'massFlow',
      density: 'density',
      specificGravity: 'dimensionless',
      kinematicViscosity: 'kinematicViscosity',
      temperature: 'temperature',
      length: 'length',
      dimensionless: 'dimensionless',
      text: ''
    }[quantity] || '';
  }

  function inferRole(traceKey) {
    const key = traceKey.toLowerCase();
    if (key.includes('input') || key.includes('type') || key.includes('model') || key.includes('mode') || key.includes('characteristic')) return 'input';
    if (key.includes('calculated') || key.includes('effective') || key.includes('head') || key.includes('loss') || key.includes('pressure') || key.includes('npsh')) return 'output';
    if (key.includes('density') || key.includes('viscosity') || key.includes('temperature')) return 'intermediate';
    return 'status';
  }

  function inferSide(traceKey) {
    if (traceKey.startsWith('source-')) return 'suction-boundary';
    if (traceKey.startsWith('sink-')) return 'discharge-boundary';
    if (traceKey.startsWith('valve-') || traceKey.startsWith('control-valve-')) return 'route-component';
    if (traceKey.startsWith('design')) return 'pump';
    return 'system';
  }

  function inferNpshImpact(traceKey) {
    const key = traceKey.toLowerCase();
    if (key.includes('npsh')) return 'direct';
    if (key.startsWith('source-') && (key.includes('pressure') || key.includes('head') || key.includes('density') || key.includes('vapor'))) return 'direct';
    if (key.startsWith('sink-')) return 'indirect';
    if (key.startsWith('valve-') && (key.includes('loss') || key.includes('pressure-drop') || key.includes('cv') || key.includes('-k'))) return 'context-dependent';
    return 'none';
  }

  function inferReferenceIds(traceKey) {
    const objectType = inferObjectType(traceKey);
    if (objectType === 'pump') return ['grist-cavitation-centrifugal-pump-1998', 'hydraulic-institute-npsh-margin-2024'];
    if (objectType === 'valve') return ['cengel-fluid-mechanics-3e', 'fox-mcdonald-fluid-mechanics-10e'];
    if (objectType === 'source' || objectType === 'sink') return ['cengel-fluid-mechanics-3e', 'fox-mcdonald-fluid-mechanics-10e'];
    return ['fox-mcdonald-fluid-mechanics-10e'];
  }

  function buildTraceSchemaEntries() {
    const mappings = root.EngineeringTraceI18nRegistry?.mappings || {};
    return Object.keys(mappings).sort().map((traceKey) => {
      const mapping = mappings[traceKey];
      const quantity = inferQuantity(traceKey);
      return Object.freeze({
        traceKey,
        i18nKey: mapping.i18nKey,
        objectType: inferObjectType(traceKey),
        quantity,
        unitFamily: inferUnitFamily(quantity),
        role: inferRole(traceKey),
        npshImpact: inferNpshImpact(traceKey),
        side: inferSide(traceKey),
        publicSafe: true,
        referenceIds: inferReferenceIds(traceKey),
        label: Object.freeze({ en: mapping.en, id: mapping.id })
      });
    });
  }

  const TRACE_SCHEMA_ENTRIES = Object.freeze(buildTraceSchemaEntries());

  function getTraceSchemaEntry(traceKey) {
    const key = normalizeKey(traceKey);
    return TRACE_SCHEMA_ENTRIES.find((entry) => entry.traceKey === key) || null;
  }

  function validateManifest() {
    const required = [
      'calculationEngineVersion',
      'terminologyLibraryVersion',
      'traceSchemaVersion',
      'fluidPropertyLibraryVersion',
      'unitLibraryVersion',
      'equipmentDataLibraryVersion',
      'literatureRegistryVersion',
      'formulaLiteratureMapVersion',
      'journalOcrTerminologyVersion',
      'narrativeWindowAuditVersion',
      'citationPageLockWorkflowVersion',
      'journalOcrFixtureVersion',
      'narrativeMaintenanceGateVersion',
      'qualityGateVersion'
    ];
    const missing = required.filter((key) => !LIBRARY_MANIFEST[key]);
    return { ok: missing.length === 0, required, missing };
  }

  function validateTraceSchema(requiredTraceKeys = []) {
    const required = Array.isArray(requiredTraceKeys) && requiredTraceKeys.length
      ? requiredTraceKeys.map(normalizeKey)
      : TRACE_SCHEMA_ENTRIES.map((entry) => entry.traceKey);
    const schemaKeys = new Set(TRACE_SCHEMA_ENTRIES.map((entry) => entry.traceKey));
    const literatureIds = new Set(LITERATURE_REGISTRY.map((item) => item.referenceId));
    const missing = required.filter((key) => !schemaKeys.has(key));
    const incomplete = TRACE_SCHEMA_ENTRIES.filter((entry) => !entry.traceKey || !entry.i18nKey || !entry.objectType || !entry.role || typeof entry.publicSafe !== 'boolean');
    const missingReferences = TRACE_SCHEMA_ENTRIES
      .filter((entry) => !entry.referenceIds.every((referenceId) => literatureIds.has(referenceId)))
      .map((entry) => entry.traceKey);
    return {
      ok: missing.length === 0 && incomplete.length === 0 && missingReferences.length === 0,
      checkedKeys: required.length,
      schemaKeys: TRACE_SCHEMA_ENTRIES.length,
      missing,
      incomplete: incomplete.map((entry) => entry.traceKey),
      missingReferences
    };
  }

  function validateUnitGovernance() {
    const requiredQuantities = ['pressureAbs', 'flow', 'dynamicViscosity', 'kinematicViscosity', 'temperature', 'length', 'density'];
    const covered = new Set(UNIT_AUDIT_CASES.map((testCase) => testCase.quantity));
    const missing = requiredQuantities.filter((quantity) => !covered.has(quantity));
    const hasGaugeAbsoluteCase = UNIT_AUDIT_CASES.some((testCase) => testCase.id === 'pressure-bar-g-to-bar-a-atmospheric');
    return { ok: missing.length === 0 && hasGaugeAbsoluteCase, requiredQuantities, missing, hasGaugeAbsoluteCase };
  }

  function validateFluidGovernance() {
    const requiredFluids = ['water', 'methanol', 'palmOil', 'crudeOil', 'customFluid'];
    const missing = requiredFluids.filter((fluidId) => !FLUID_PROPERTY_GOVERNANCE[fluidId]);
    const missingVaporBasis = Object.keys(FLUID_PROPERTY_GOVERNANCE).filter((fluidId) => !FLUID_PROPERTY_GOVERNANCE[fluidId].vaporPressureBasis);
    return { ok: missing.length === 0 && missingVaporBasis.length === 0, requiredFluids, missing, missingVaporBasis };
  }

  function validateEquipmentGovernance() {
    const required = ['pipeRoughness', 'fittingK', 'valveK', 'valveCv', 'pumpNpshr', 'pumpCurve', 'checkValveCrackingHead'];
    const missing = required.filter((key) => !EQUIPMENT_DATA_GOVERNANCE[key]);
    const missingProvenance = Object.keys(EQUIPMENT_DATA_GOVERNANCE).filter((key) => !EQUIPMENT_DATA_GOVERNANCE[key].sourceType || !EQUIPMENT_DATA_GOVERNANCE[key].confidence);
    return { ok: missing.length === 0 && missingProvenance.length === 0, required, missing, missingProvenance };
  }

  function validateLiteratureRegistry() {
    const requiredFormulaGroups = ['boundary-head', 'pipe-loss', 'npsh', 'npsh-margin'];
    const groups = new Set(LITERATURE_REGISTRY.flatMap((reference) => reference.formulaGroups));
    const missingFormulaGroups = requiredFormulaGroups.filter((group) => !groups.has(group));
    const missingIds = LITERATURE_REGISTRY.filter((reference) => !reference.referenceId || !reference.title).map((reference) => reference.referenceId || '(missing)');
    return { ok: missingFormulaGroups.length === 0 && missingIds.length === 0, requiredFormulaGroups, missingFormulaGroups, missingIds };
  }

  function getQualityGateSummary() {
    const narrativeWindowAudit = validateNarrativeWindowAudit();
    const journalOcrTerminology = validateJournalOcrTerminology();
    const formulaLiteratureMap = validateFormulaLiteratureMap();
    const citationPageLockWorkflow = validateCitationPageLockWorkflow();
    const journalOcrFixtures = validateJournalOcrFixtures();
    const narrativeMaintenanceGate = validateNarrativeMaintenanceGate();
    return {
      ok: narrativeWindowAudit.ok && journalOcrTerminology.ok && formulaLiteratureMap.ok && citationPageLockWorkflow.ok && journalOcrFixtures.ok && narrativeMaintenanceGate.ok,
      version: LIBRARY_MANIFEST.qualityGateVersion,
      rules: QUALITY_GATE_RULES,
      checks: {
        narrativeWindowAudit,
        journalOcrTerminology,
        formulaLiteratureMap,
        citationPageLockWorkflow,
        journalOcrFixtures,
        narrativeMaintenanceGate
      }
    };
  }

  function getSummary(requiredTraceKeys = []) {
    const manifest = validateManifest();
    const traceSchema = validateTraceSchema(requiredTraceKeys);
    const unitGovernance = validateUnitGovernance();
    const fluidGovernance = validateFluidGovernance();
    const equipmentGovernance = validateEquipmentGovernance();
    const literatureRegistry = validateLiteratureRegistry();
    const narrativeWindowAudit = validateNarrativeWindowAudit();
    const journalOcrTerminology = validateJournalOcrTerminology();
    const formulaLiteratureMap = validateFormulaLiteratureMap();
    const citationPageLockWorkflow = validateCitationPageLockWorkflow();
    const journalOcrFixtures = validateJournalOcrFixtures();
    const narrativeMaintenanceGate = validateNarrativeMaintenanceGate();
    const qualityGate = getQualityGateSummary();
    return {
      ok: manifest.ok && traceSchema.ok && unitGovernance.ok && fluidGovernance.ok && equipmentGovernance.ok && literatureRegistry.ok && narrativeWindowAudit.ok && journalOcrTerminology.ok && formulaLiteratureMap.ok && citationPageLockWorkflow.ok && journalOcrFixtures.ok && narrativeMaintenanceGate.ok && qualityGate.ok,
      version: VERSION,
      manifest: LIBRARY_MANIFEST,
      checks: {
        manifest,
        traceSchema,
        unitGovernance,
        fluidGovernance,
        equipmentGovernance,
        literatureRegistry,
        narrativeWindowAudit,
        journalOcrTerminology,
        formulaLiteratureMap,
        citationPageLockWorkflow,
        journalOcrFixtures,
        narrativeMaintenanceGate,
        qualityGate
      }
    };
  }

  const api = {
    version: VERSION,
    manifest: LIBRARY_MANIFEST,
    traceSchema: TRACE_SCHEMA_ENTRIES,
    literatureRegistry: LITERATURE_REGISTRY,
    formulaLiteratureMap: FORMULA_LITERATURE_MAP,
    journalOcrTerminology: JOURNAL_OCR_TERMINOLOGY,
    journalOcrFixtures: JOURNAL_OCR_FIXTURES,
    narrativeWindowAuditRegistry: NARRATIVE_WINDOW_AUDIT_REGISTRY,
    citationPageLockWorkflow: CITATION_PAGE_LOCK_WORKFLOW,
    narrativeMaintenanceGate: NARRATIVE_MAINTENANCE_GATE,
    qualityGateRules: QUALITY_GATE_RULES,
    unitAuditCases: UNIT_AUDIT_CASES,
    fluidPropertyGovernance: FLUID_PROPERTY_GOVERNANCE,
    equipmentDataGovernance: EQUIPMENT_DATA_GOVERNANCE,
    getTraceSchemaEntry,
    getFormulaLiteratureEntry,
    getCitationPageLockStatus,
    normalizeJournalOcrTerm,
    validateManifest,
    validateTraceSchema,
    validateUnitGovernance,
    validateFluidGovernance,
    validateEquipmentGovernance,
    validateLiteratureRegistry,
    validateFormulaLiteratureMap,
    validateJournalOcrTerminology,
    validateJournalOcrFixtures,
    validateNarrativeWindowAudit,
    validateCitationPageLockWorkflow,
    validateNarrativeMaintenanceGate,
    getQualityGateSummary,
    getSummary
  };

  root.EngineeringLibraryManifest = LIBRARY_MANIFEST;
  root.EngineeringTraceSchema = {
    version: LIBRARY_MANIFEST.traceSchemaVersion,
    entries: TRACE_SCHEMA_ENTRIES,
    get: getTraceSchemaEntry,
    validate: validateTraceSchema
  };
  root.EngineeringLiteratureRegistry = {
    version: LIBRARY_MANIFEST.literatureRegistryVersion,
    entries: LITERATURE_REGISTRY
  };
  root.EngineeringFormulaLiteratureMap = {
    version: LIBRARY_MANIFEST.formulaLiteratureMapVersion,
    entries: FORMULA_LITERATURE_MAP,
    get: getFormulaLiteratureEntry,
    getCitationPageLockStatus,
    validate: validateFormulaLiteratureMap,
    validateCitationPageLockWorkflow
  };
  root.EngineeringJournalOcrTerminology = {
    version: LIBRARY_MANIFEST.journalOcrTerminologyVersion,
    entries: JOURNAL_OCR_TERMINOLOGY,
    fixtures: JOURNAL_OCR_FIXTURES,
    normalizeTerm: normalizeJournalOcrTerm,
    validate: validateJournalOcrTerminology,
    validateFixtures: validateJournalOcrFixtures
  };
  root.EngineeringNarrativeWindowAudit = {
    version: LIBRARY_MANIFEST.narrativeWindowAuditVersion,
    entries: NARRATIVE_WINDOW_AUDIT_REGISTRY,
    maintenanceGate: NARRATIVE_MAINTENANCE_GATE,
    validate: validateNarrativeWindowAudit,
    validateMaintenanceGate: validateNarrativeMaintenanceGate
  };
  root.EngineeringCitationPageLockWorkflow = {
    version: LIBRARY_MANIFEST.citationPageLockWorkflowVersion,
    workflow: CITATION_PAGE_LOCK_WORKFLOW,
    getStatus: getCitationPageLockStatus,
    validate: validateCitationPageLockWorkflow
  };
  root.EngineeringQualityGate = {
    version: LIBRARY_MANIFEST.qualityGateVersion,
    rules: QUALITY_GATE_RULES,
    getSummary: getQualityGateSummary
  };
  root.EngineeringLibraryGovernance = api;

  const previousBilingualDiagnostics = root.EngineeringBilingualDiagnostics;
  if (previousBilingualDiagnostics && typeof previousBilingualDiagnostics.getSummary === 'function') {
    const previousGetSummary = previousBilingualDiagnostics.getSummary.bind(previousBilingualDiagnostics);
    root.EngineeringBilingualDiagnostics = {
      ...previousBilingualDiagnostics,
      getSummary(...args) {
        const bilingualSummary = previousGetSummary(...args);
        const librarySummary = getSummary();
        return {
          ...bilingualSummary,
          ok: Boolean(bilingualSummary.ok) && librarySummary.ok,
          libraryGovernance: librarySummary
        };
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
