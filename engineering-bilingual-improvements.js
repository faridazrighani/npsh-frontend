(function registerEngineeringBilingualImprovements(root) {
  const VERSION = '2026.05-bilingual-runtime-2';

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
    'sink-boundary-pressure': { i18nKey: 'trace.sink.boundaryPressure', en: 'Boundary Abs. Pressure', id: 'Tekanan Absolut Boundary' },
    'sink-calculated-pressure': { i18nKey: 'trace.sink.calculatedPressure', en: 'Required Boundary Pressure', id: 'Tekanan Boundary yang Dibutuhkan' },
    'sink-flow': { i18nKey: 'trace.sink.flow', en: 'Flow Rate', id: 'Laju Alir' },
    'sink-fluid-density': { i18nKey: 'trace.sink.fluidDensity', en: 'Density Used', id: 'Densitas Digunakan' },
    'sink-fluid-vapor-pressure': { i18nKey: 'trace.sink.fluidVaporPressure', en: 'Vapor Pressure', id: 'Tekanan Uap' },
    'sink-hydraulic-head': { i18nKey: 'trace.sink.hydraulicHead', en: 'SNK Hydraulic Head', id: 'Head Hidrolik SNK' },
    'sink-mass-flow': { i18nKey: 'trace.sink.massFlow', en: 'Mass Flow', id: 'Laju Alir Massa' },
    'sink-pressure-residual': { i18nKey: 'trace.sink.pressureResidual', en: 'Pressure Residual', id: 'Residual Tekanan' },
    'sink-pump-npsh-margin': { i18nKey: 'trace.sink.pumpNpshMargin', en: 'Pump NPSH Margin', id: 'Margin NPSH Pompa' },
    'sink-pump-npsh-ratio': { i18nKey: 'trace.sink.pumpNpshRatio', en: 'Pump NPSH Ratio', id: 'Rasio NPSH Pompa' },
    'sink-pump-npsha': { i18nKey: 'trace.sink.pumpNpsha', en: 'Pump NPSHa', id: 'NPSHa Pompa' },
    'sink-pump-npshr': { i18nKey: 'trace.sink.pumpNpshr', en: 'Pump NPSHr', id: 'NPSHr Pompa' },
    'sink-stagnation-pressure': { i18nKey: 'trace.sink.stagnationPressure', en: 'Pipe Endpoint Stagnation Pressure', id: 'Tekanan Stagnasi Endpoint Pipa' },
    'sink-static-pressure': { i18nKey: 'trace.sink.staticPressure', en: 'Pipe Endpoint Static Pressure', id: 'Tekanan Statik Endpoint Pipa' },
    'sink-temperature': { i18nKey: 'trace.sink.temperature', en: 'Temperature', id: 'Temperatur' },
    'sink-trace-boundary-mode': { i18nKey: 'trace.sink.boundaryMode', en: 'Boundary Mode', id: 'Mode Boundary' },
    'sink-trace-elevation': { i18nKey: 'trace.sink.elevation', en: 'SNK Elevation', id: 'Elevasi SNK' },
    'sink-trace-pressure-head': { i18nKey: 'trace.sink.pressureHead', en: 'Pressure Head', id: 'Head Tekanan' },
    'sink-trace-pressure-input': { i18nKey: 'trace.sink.pressureInput', en: 'Boundary Pressure Input', id: 'Input Tekanan Boundary' },
    'sink-trace-velocity-head': { i18nKey: 'trace.sink.velocityHead', en: 'Terminal Velocity Head', id: 'Head Kecepatan Terminal' },
    'source-absolute-pressure': { i18nKey: 'trace.source.absolutePressure', en: 'Calculated Abs. Pressure', id: 'Tekanan Absolut Terhitung' },
    'source-effective-elevation': { i18nKey: 'trace.source.effectiveElevation', en: 'Source Elevation', id: 'Elevasi Source' },
    'source-flow': { i18nKey: 'trace.source.flow', en: 'Volumetric Flow', id: 'Flow Volumetrik' },
    'source-fluid-density': { i18nKey: 'trace.source.fluidDensity', en: 'Density Used', id: 'Densitas Digunakan' },
    'source-fluid-vapor-pressure': { i18nKey: 'trace.source.fluidVaporPressure', en: 'Vapor Pressure', id: 'Tekanan Uap' },
    'source-fluid-viscosity': { i18nKey: 'trace.source.fluidViscosity', en: 'Kinematic Viscosity', id: 'Viskositas Kinematik' },
    'source-mass-flow': { i18nKey: 'trace.source.massFlow', en: 'Mass Flow', id: 'Laju Alir Massa' },
    'source-temperature': { i18nKey: 'trace.source.temperature', en: 'Temperature', id: 'Temperatur' },
    'source-trace-hydraulic-head': { i18nKey: 'trace.source.hydraulicHead', en: 'Source Hydraulic Head', id: 'Head Hidrolik Source' },
    'source-trace-pressure-head': { i18nKey: 'trace.source.pressureHead', en: 'Pressure Head', id: 'Head Tekanan' },
    'source-trace-pressure-input': { i18nKey: 'trace.source.pressureInput', en: 'Boundary Pressure Input', id: 'Input Tekanan Boundary' },
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

  const RUNTIME_TEXT_ENTRIES = Object.freeze([
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
    ['runtime.toast.simulation.refreshed', 'Hydraulic and NPSH evaluation has been refreshed.', 'Evaluasi hidrolik dan NPSH telah disegarkan.'],
    ['runtime.toast.refresh.complete', 'Calculations, connection labels, and warning status were refreshed.', 'Perhitungan, label koneksi, dan status warning telah disegarkan.'],
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
        if (data?.model && (!data.model.SETTINGS || !data.model.SETTINGS.props?.language)) {
          data.model.SETTINGS = data.model.SETTINGS || { type: 'settings', name: 'Simulation Settings', props: {} };
          data.model.SETTINGS.type = data.model.SETTINGS.type || 'settings';
          data.model.SETTINGS.name = data.model.SETTINGS.name || 'Simulation Settings';
          data.model.SETTINGS.props = data.model.SETTINGS.props || {};
          data.model.SETTINGS.props.language = getActiveRuntimeLanguage();
          return [JSON.stringify(data), ...rest];
        }
      } catch (error) {
        return args;
      }
      return args;
    });
  }

  const runtimeOriginalTextNodes = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function normalizeRuntimeOriginalText(text) {
    const trimmed = String(text || '').trim();
    return RUNTIME_ID_TO_EN[trimmed] || translateRuntimePattern(trimmed, 'en');
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

  function localizeRuntimeNodeTree(node = root.document?.body) {
    if (!node || !root.document) return;
    if (node.nodeType === 3) {
      localizeRuntimeTextNode(node);
      return;
    }
    if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
    if (node.nodeType === 1) localizeRuntimeAttributes(node);
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

  function shouldShortCircuitBackendSimulationFetch(input) {
    return isLocalPreviewHost() && isBackendSimulationFetch(input);
  }

  function installRealtimeAutosolveBridge() {
    if (!root.document) return;
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
    installRealtimeAutosolveBridge();

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
  root.EngineeringBilingualImprovements = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
