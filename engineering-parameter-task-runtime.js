!function(root) {
  "use strict";

  const VERSION = "2026.06-parameter-task-blocks3";
  const STYLE_ID = "engineeringParameterTaskRuntimeStyle";
  const TRIGGER_SELECTOR = "[data-parameter-task-trigger]";
  const SECTION_SELECTOR = ".pump-live-param-section";
  const WINDOW_SELECTOR = ".parameter-task-window";
  const BLOCKS = {
    status: {
      label: "Status",
      title: "Parameter Status - Blok 1",
      windowClass: "parameter-status-task-window",
      bodyClass: "parameter-status-body"
    },
    suction: {
      label: "Suction",
      title: "Parameter Suction - Blok 2",
      windowClass: "parameter-suction-task-window",
      bodyClass: "parameter-suction-body"
    },
    discharge: {
      label: "Discharge",
      title: "Parameter Discharge - Blok 3",
      windowClass: "parameter-discharge-task-window",
      bodyClass: "parameter-discharge-body"
    }
  };
  const MIN_WINDOW_WIDTH = 360;
  const MIN_WINDOW_HEIGHT = 320;

  let observer = null;
  let windowCounter = 0;
  let dragState = null;
  let resizeState = null;

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const match = String(value).replace(",", ".").match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
    if (!match) return null;
    const number = Number(match[0]);
    return Number.isFinite(number) ? number : null;
  }

  function formatNumber(value, digits = 4, signed = false) {
    const number = parseNumber(value);
    if (!Number.isFinite(number)) return "-";
    const text = number.toFixed(digits);
    return signed && number >= 0 ? `+${text}` : text;
  }

  function formatValue(value, unit = "", digits = 4, signed = false) {
    const number = parseNumber(value);
    if (!Number.isFinite(number)) return "-";
    const text = formatNumber(number, digits, signed);
    return unit ? `${text} ${unit}` : text;
  }

  function displayText(value, fallback = "-") {
    const text = normalizeText(value);
    return text || fallback;
  }

  function createNode(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== "") node.textContent = text;
    return node;
  }

  function appendParagraphs(parent, paragraphs = []) {
    paragraphs.forEach((text) => {
      const paragraph = createNode("p", "parameter-task-paragraph", text);
      parent.appendChild(paragraph);
    });
    return parent;
  }

  function createCard(title, content, className = "") {
    const card = createNode("section", `parameter-task-card${className ? ` ${className}` : ""}`);
    const heading = createNode("h3", "", title);
    card.appendChild(heading);
    if (content instanceof Node) {
      card.appendChild(content);
    } else if (Array.isArray(content)) {
      appendParagraphs(card, content);
    } else if (content) {
      card.appendChild(createNode("p", "parameter-task-paragraph", content));
    }
    return card;
  }

  function createList(items = [], className = "parameter-task-list") {
    const list = createNode("ul", className);
    items.forEach((item) => {
      const li = createNode("li");
      if (item instanceof Node) li.appendChild(item);
      else li.textContent = String(item ?? "");
      list.appendChild(li);
    });
    return list;
  }

  function createTable(headers = [], rows = [], className = "parameter-task-table") {
    const wrap = createNode("div", "parameter-task-table-wrap");
    const table = createNode("table", className);
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headers.forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell, index) => {
        const td = document.createElement("td");
        td.dataset.label = headers[index] || "";
        if (cell instanceof Node) td.appendChild(cell);
        else td.textContent = String(cell ?? "-");
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function createCodeLine(text) {
    const code = createNode("code", "parameter-task-code-line", text);
    code.dataset.formulaDefenseEquation = "true";
    return code;
  }

  function runtimeState() {
    let directModel = null;
    let directConnections = null;
    try {
      if (typeof globalModel !== "undefined" && globalModel) directModel = globalModel;
    } catch (error) {
      // Protected builds may not expose globalModel as a direct binding.
    }
    try {
      if (typeof connections !== "undefined" && Array.isArray(connections)) directConnections = connections;
    } catch (error) {
      // Protected builds may not expose connections as a direct binding.
    }
    const attachedModel = root.__npshGlobalModel || root.globalModel || null;
    const attachedConnections = Array.isArray(root.__npshConnections)
      ? root.__npshConnections
      : (Array.isArray(root.connections) ? root.connections : null);

    if (directModel && Object.keys(directModel || {}).length) {
      return { model: directModel, connections: directConnections || attachedConnections || [] };
    }
    if (attachedModel && Object.keys(attachedModel || {}).length) {
      return { model: attachedModel, connections: attachedConnections || directConnections || [] };
    }
    try {
      if (typeof root.getSimulationState === "function") {
        const state = JSON.parse(root.getSimulationState());
        if (state?.model) {
          return {
            model: state.model || {},
            connections: Array.isArray(state.connections) ? state.connections : (directConnections || attachedConnections || [])
          };
        }
      }
    } catch (error) {
      // Fall through to legacy window-attached names.
    }
    return { model: attachedModel || directModel || {}, connections: attachedConnections || directConnections || [] };
  }

  function runtimeModel() {
    return runtimeState().model || {};
  }

  function runtimeConnections() {
    return runtimeState().connections || [];
  }

  function firstPumpId(model = runtimeModel()) {
    return Object.keys(model || {}).find((id) => model[id]?.type === "pump") || "";
  }

  function resolvePumpId(value = "", scope = null) {
    const model = runtimeModel();
    const direct = normalizeText(value);
    if (direct && model[direct]?.type === "pump") return direct;

    const host = scope?.closest?.("[data-pump-node-id], [data-node-id], [data-node], [data-id]");
    const dataset = host?.dataset || {};
    const candidates = [
      dataset.pumpNodeId,
      dataset.nodeId,
      dataset.node,
      dataset.id,
      normalizeText(scope?.closest?.(".object-type-pump")?.id)
    ].filter(Boolean);
    const textMatch = normalizeText(scope?.closest?.(".pump-live-params, .object-type-pump")?.textContent).match(/\bP-\d+\b/i);
    if (textMatch) candidates.push(textMatch[0]);

    for (const candidate of candidates) {
      const id = normalizeText(candidate);
      if (id && model[id]?.type === "pump") return id;
    }
    return firstPumpId(model);
  }

  function pumpContext(pumpId = "", scope = null) {
    const model = runtimeModel();
    const id = resolvePumpId(pumpId, scope);
    const pump = model[id] || {};
    const results = pump.results || {};
    const evaluation = results.npshEvaluation || results;
    const props = pump.props || {};
    return { id, pump, props, results, evaluation };
  }

  function sectionBlockNodes(section) {
    if (!section) return [];
    const nodes = [section];
    let next = section.nextElementSibling;
    while (next && !next.classList?.contains("pump-live-param-section")) {
      nodes.push(next);
      next = next.nextElementSibling;
    }
    return nodes;
  }

  function sectionBlockText(section) {
    return normalizeText(sectionBlockNodes(section).map((node) => node.textContent || "").join(" "));
  }

  function sectionBlockRows(section) {
    if (!section) return [];
    const rows = Array.from(section.querySelectorAll?.(".pump-live-param-row") || []);
    sectionBlockNodes(section).forEach((node) => {
      if (node !== section && node.classList?.contains("pump-live-param-row")) rows.push(node);
      if (node !== section) rows.push(...Array.from(node.querySelectorAll?.(".pump-live-param-row") || []));
    });
    return Array.from(new Set(rows));
  }

  function readStatusRow(section, labelPattern) {
    if (!section) return "";
    const rows = sectionBlockRows(section);
    const row = rows.find((item) => labelPattern.test(normalizeText(item.textContent)));
    if (!row) return "";
    const value = row.querySelector(".pump-live-param-value, strong, [data-readout-key]");
    if (value) return normalizeText(value.textContent);
    const label = row.querySelector(".pump-live-param-label");
    return normalizeText(row.textContent).replace(normalizeText(label?.textContent), "").trim();
  }

  function sectionLabel(section) {
    if (!section) return "";
    const textNode = Array.from(section.childNodes || [])
      .find((node) => node.nodeType === 3 && normalizeText(node.textContent));
    return normalizeText(textNode?.textContent || section.textContent);
  }

  function readBlockRow(section, labelPattern) {
    return readStatusRow(section, labelPattern);
  }

  function isBlockSection(section, block) {
    const label = sectionLabel(section).toLowerCase();
    const text = sectionBlockText(section);
    if (block === "status") {
      return /\bstatus\b/i.test(label) && /Hydraulic\s+NPSH/i.test(text) && /Backend\s+Valid\.?/i.test(text);
    }
    if (block === "suction") {
      return /\bsuction\b/i.test(label) && /Flow/i.test(text) && /NPSH\s+Available/i.test(text);
    }
    if (block === "discharge") {
      return /\bdischarge\b/i.test(label) && /Pump\s+Head/i.test(text) && /Discharge\s+Press/i.test(text);
    }
    return false;
  }

  function getLiveBlockSection(block, scope = null) {
    const host = scope?.closest?.(SECTION_SELECTOR);
    if (host && isBlockSection(host, block)) return host;
    const parentPanel = scope?.closest?.(".pump-live-params");
    const searchRoot = parentPanel || document;
    return Array.from(searchRoot.querySelectorAll(SECTION_SELECTOR)).find((section) => isBlockSection(section, block)) || null;
  }

  function getLiveStatusSection(scope = null) {
    return getLiveBlockSection("status", scope);
  }

  function buildStatusSnapshot(pumpId = "", trigger = null) {
    const section = getLiveStatusSection(trigger);
    const { id, props, results, evaluation } = pumpContext(pumpId, trigger);
    const action = results.actionReadinessBackend || results.backendActionReadiness || results.actionReadinessFrontend || {};
    const marginCriteria = evaluation.marginCriteria || evaluation.criteria || {};
    const hydraulicFromDom = readStatusRow(section, /Hydraulic\s+NPSH/i);
    const backendFromDom = readStatusRow(section, /Backend\s+Valid/i);

    return {
      id,
      hydraulicStatus: displayText(
        hydraulicFromDom
        || results.hydraulicNpshStatus
        || evaluation.hydraulicStatus
        || evaluation.status
        || results.cavitationStatus
        || results.status,
        "Incomplete"
      ),
      engineeringStatus: displayText(results.engineeringStatus || evaluation.engineeringStatus || evaluation.status, "-"),
      backendStatus: displayText(
        backendFromDom
        || results.backendValidationStatus
        || evaluation.backendValidationStatus
        || action.status,
        "Unverified"
      ),
      backendMessage: displayText(results.backendValidationMessage || evaluation.backendValidationMessage || action.message, "-"),
      freshness: displayText(results.calculationFreshness || evaluation.calculationFreshness || action.freshness || (action.stale ? "Stale" : ""), "-"),
      npsha: evaluation.npsha ?? results.npsha,
      npshr: evaluation.npshr ?? results.npshr,
      npshMargin: evaluation.npshMargin ?? results.npshMargin,
      npshRatio: evaluation.npshRatio ?? results.npshRatio,
      requiredNpsha: evaluation.requiredNpsha ?? evaluation.requiredNpshaForMargin ?? results.requiredNpsha,
      npshrSource: displayText(evaluation.npshrSource || results.npshrSource || props.npshrSourceMode || props.curveDataSource, "-"),
      dataConfidence: displayText(evaluation.dataConfidence || results.dataConfidence || results.npshrDataConfidence, "-"),
      marginBasis: displayText(evaluation.npshMarginBasis || props.npshMarginBasis || marginCriteria.basis, "Selected margin basis"),
      minRatio: marginCriteria.minRatio ?? evaluation.minNpshMarginRatio ?? props.minNpshMarginRatio,
      minMargin: marginCriteria.minMargin ?? evaluation.minNpshMargin ?? props.minNpshMargin,
      warnings: [
        ...(Array.isArray(results.warnings) ? results.warnings : []),
        ...(Array.isArray(evaluation.warnings) ? evaluation.warnings : [])
      ].filter(Boolean)
    };
  }

  function createMetric(label, value, tone = "") {
    const metric = createNode("div", `parameter-task-metric${tone ? ` parameter-task-metric-${tone}` : ""}`);
    metric.appendChild(createNode("span", "", label));
    metric.appendChild(createNode("strong", "", value));
    return metric;
  }

  function createIntroCard(snapshot) {
    const content = createNode("div");
    appendParagraphs(content, [
      "Blok STATUS memisahkan dua pertanyaan dosen yang berbeda: apakah kondisi NPSH secara hidrolik aman, dan apakah angka tersebut sudah tervalidasi oleh backend protected untuk rute saat ini.",
      "Jadi Hydraulic NPSH menjawab keamanan terhadap kavitasi, sedangkan Backend Valid. menjawab keabsahan jalur perhitungan yang dipakai aplikasi."
    ]);
    const grid = createNode("div", "parameter-task-metric-grid");
    grid.append(
      createMetric("Pump", snapshot.id || "-"),
      createMetric("Hydraulic NPSH", snapshot.hydraulicStatus, statusTone(snapshot.hydraulicStatus)),
      createMetric("Backend Valid.", snapshot.backendStatus, backendTone(snapshot.backendStatus)),
      createMetric("Freshness", snapshot.freshness)
    );
    content.appendChild(grid);
    return createCard("Jawaban Singkat Blok 1", content);
  }

  function createSnapshotCard(snapshot) {
    const rows = [
      ["NPSH Available", formatValue(snapshot.npsha, "m", 4), "NPSH yang tersedia dari sisi sistem/suction."],
      ["NPSH Required", formatValue(snapshot.npshr, "m", 4), "NPSH minimum dari karakteristik pompa pada flow operasi."],
      ["NPSH Margin", formatValue(snapshot.npshMargin, "m", 4, true), "Selisih NPSHa - NPSHr."],
      ["NPSH Ratio", formatValue(snapshot.npshRatio, "", 4), "Perbandingan NPSHa / NPSHr."],
      ["Required NPSHa", formatValue(snapshot.requiredNpsha, "m", 4), "Ambang minimum setelah kriteria margin/ratio dipilih."],
      ["NPSHr Source", snapshot.npshrSource, "Basis data NPSHr: vendor, manufacturer/test, datasheet, journal, atau engineering fit."],
      ["Data Confidence", snapshot.dataConfidence, "Kualitas sumber NPSHr untuk pembelaan akademik."]
    ];
    return createCard("Snapshot Nilai Aktual", createTable(["Parameter", "Nilai", "Makna"], rows));
  }

  function createHydraulicStatusCard(snapshot) {
    const content = createNode("div");
    appendParagraphs(content, [
      "Aplikasi tidak menyatakan Safe/Warning/NPSH Risk dari teks manual. Status dibuat dari perbandingan NPSHa, NPSHr, dan kriteria margin yang dipilih pada sistem.",
      "Rumus keputusan yang dipakai:"
    ]);
    const formulas = createNode("div", "parameter-task-formula-stack");
    formulas.append(
      createCodeLine("NPSH Margin = NPSHa - NPSHr"),
      createCodeLine("NPSH Ratio = NPSHa / NPSHr"),
      createCodeLine("Required NPSHa = max(NPSHr x minimum ratio, NPSHr + minimum margin)")
    );
    content.appendChild(formulas);
    content.appendChild(createTable(["Status", "Kondisi", "Apa yang dilakukan aplikasi"], [
      [
        "Safe",
        "NPSHa lebih besar dari NPSHr dan kriteria margin/ratio yang dipilih terpenuhi.",
        "Menampilkan aman secara hidrolik, tetap menyimpan angka margin dan ratio untuk pembuktian."
      ],
      [
        "Warning",
        "NPSHa masih di atas NPSHr, tetapi cadangan margin/ratio belum memenuhi basis screening.",
        "Menampilkan peringatan evaluasi engineering; hasil tidak langsung gagal, tetapi perlu review desain."
      ],
      [
        "NPSH Risk / Cavitation Risk",
        "NPSHa lebih kecil atau sama dengan NPSHr.",
        "Menandai risiko kavitasi dan mengarahkan evaluasi ke suction loss, tekanan inlet, temperatur/vapor pressure, elevasi, atau pemilihan pompa."
      ],
      [
        "Input Required / Incomplete",
        "Data belum lengkap: flow belum valid, rute suction/discharge belum terbaca, NPSHr/margin criteria belum ada, atau backend trace belum valid.",
        "Tidak membuat klaim aman; aplikasi menunggu input dilengkapi lalu perhitungan dijalankan ulang."
      ]
    ]));
    content.appendChild(createList([
      `Basis margin aktif: ${snapshot.marginBasis}.`,
      `Minimum ratio: ${formatValue(snapshot.minRatio, "", 4)}; minimum margin: ${formatValue(snapshot.minMargin, "m", 4)}.`,
      "Hydraulic status berbeda dari engineering status; engineering status bisa memberi Warning jika sumber data NPSHr belum manufacturer/test."
    ], "parameter-task-note-list"));
    return createCard("Hydraulic NPSH: Cara Status Ditentukan", content);
  }

  function createBackendStatusCard(snapshot) {
    const content = createNode("div");
    appendParagraphs(content, [
      "Connected berarti frontend menerima hasil perhitungan protected backend yang usable untuk rute dan kondisi saat ini. Ini bukan arti pompa pasti aman; Connected hanya menyatakan jalur kalkulasi backend valid/tersambung.",
      "Backend Valid. dipisahkan dari Hydraulic NPSH supaya dosen bisa melihat mana status fisika pompa dan mana status keabsahan mesin hitung."
    ]);
    content.appendChild(createTable(["Status Backend", "Kapan muncul", "Makna pembelaan"], [
      ["Connected", "Backend mengembalikan hasil hydraulic/NPSH yang usable untuk rute saat ini.", "Angka live sudah tervalidasi oleh protected backend."],
      ["Calculating", "Input berubah atau solve sedang berjalan.", "Tunggu refresh selesai sebelum mengambil kesimpulan final."],
      ["Stale", "Ada input berubah setelah hasil terakhir.", "Angka lama masih tampil, tetapi belum current terhadap input terbaru."],
      ["Unavailable", "Backend/API tidak dapat dipakai atau response tidak usable.", "Frontend tidak boleh mengklaim hasil protected backend."],
      ["Timeout", "Permintaan backend terlalu lama atau melewati batas waktu.", "Perhitungan harus diulang atau koneksi/API diperiksa."],
      ["Unverified / kosong", "Belum ada status backend yang sah.", "Hasil belum bisa disebut Connected."]
    ]));
    const note = createList([
      `Status backend saat ini: ${snapshot.backendStatus}.`,
      `Freshness saat ini: ${snapshot.freshness}.`,
      `Pesan backend: ${snapshot.backendMessage}.`,
      "Label Current biasanya dipakai sebagai freshness hasil perhitungan, sedangkan Connected adalah label validasi backend."
    ], "parameter-task-note-list");
    content.appendChild(note);
    return createCard("Backend Valid.: Arti Connected dan Status Lain", content);
  }

  function createApplicationActionCard() {
    return createCard("Yang Dilakukan Aplikasi", createList([
      "Mengambil flow operasi pompa dari rute hydraulic yang sedang aktif.",
      "Menghitung NPSHa dari tekanan absolut suction/source, elevasi, velocity head jika relevan, suction losses, dan vapor pressure fluida.",
      "Mengambil atau menginterpolasi NPSHr dari input/kurva pompa pada flow operasi.",
      "Menghitung margin, ratio, dan required NPSHa sesuai basis margin yang dipilih.",
      "Menghasilkan status hydraulic, warning, route trace, data confidence, dan backend validation status.",
      "Jika data tidak lengkap atau hasil backend tidak usable, aplikasi menurunkan status menjadi Incomplete, Unverified, Stale, Timeout, atau Unavailable sesuai penyebabnya."
    ]));
  }

  function createLikelyQuestionsCard(snapshot) {
    const warnings = snapshot.warnings.length
      ? snapshot.warnings.slice(0, 4).map((warning) => `Warning aktif: ${warning}`)
      : ["Tidak ada warning aktif yang terbaca pada snapshot ini."];
    const content = createNode("div");
    content.appendChild(createTable(["Pertanyaan Dosen", "Jawaban Singkat"], [
      [
        "Mengapa Safe masih bisa punya Engineering Warning?",
        "Karena Safe adalah status hidrolik NPSHa vs NPSHr, sedangkan Engineering Warning bisa berasal dari kualitas sumber NPSHr, margin basis, atau data confidence."
      ],
      [
        "Apa beda NPSHa dan NPSHr?",
        "NPSHa berasal dari sistem/suction yang tersedia di inlet pompa; NPSHr berasal dari karakteristik pompa yang dibutuhkan agar tidak kavitasi."
      ],
      [
        "Mengapa suction pressure ditulis bar a?",
        "Kavitasi dibandingkan dengan vapor pressure, sehingga tekanan harus absolut, bukan gauge."
      ],
      [
        "Apa yang menurunkan NPSHa?",
        "Suction pressure rendah, vapor pressure tinggi akibat temperatur, suction loss besar, elevasi pompa terlalu tinggi, atau flow terlalu besar."
      ],
      [
        "Apa tindakan jika NPSH Risk?",
        "Kurangi suction loss, naikkan tekanan/level inlet, turunkan temperatur fluida, turunkan elevasi pompa, ubah duty point, atau pilih pompa dengan NPSHr lebih rendah."
      ],
      [
        "Apakah Safe adalah garansi final lapangan?",
        "Safe adalah hasil evaluasi berdasarkan input dan asumsi aplikasi. Validasi final tetap membutuhkan data vendor/manufacturer/test dan kondisi operasi nyata."
      ]
    ]));
    content.appendChild(createCard("Catatan Snapshot", createList(warnings, "parameter-task-note-list"), "parameter-task-nested-card"));
    return createCard("Pertanyaan Lanjutan yang Berpotensi Muncul", content);
  }

  function createParameterStatusContent(pumpId = "", trigger = null) {
    const snapshot = buildStatusSnapshot(pumpId, trigger);
    const layout = createNode("div", "fluid-help-layout parameter-task-layout parameter-status-layout");
    layout.dataset.parameterTaskBlock = "status";
    layout.append(
      createIntroCard(snapshot),
      createSnapshotCard(snapshot),
      createHydraulicStatusCard(snapshot),
      createBackendStatusCard(snapshot),
      createApplicationActionCard(),
      createLikelyQuestionsCard(snapshot)
    );
    return layout;
  }

  function getFluidProps(model = runtimeModel()) {
    return model.FLUID?.props || {};
  }

  function formatLiveOrValue(liveValue, value, unit = "", digits = 4, signed = false) {
    const text = displayText(liveValue, "");
    if (text) return unit && !new RegExp(`\\b${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text) ? `${text} ${unit}` : text;
    return formatValue(value, unit, digits, signed);
  }

  function getTraceSteps(evaluation = {}) {
    return Array.isArray(evaluation.calculationTrace?.steps) ? evaluation.calculationTrace.steps : [];
  }

  function findTraceStep(evaluation, pattern) {
    return getTraceSteps(evaluation).find((step) => pattern.test(String(step.title || step.label || ""))) || null;
  }

  function formatStepResult(step, digits = 4) {
    if (!step) return "-";
    const unit = step.unit || "";
    return formatValue(step.result, unit, digits);
  }

  function createTraceStepTable(steps = []) {
    const rows = (steps.length ? steps : [{ title: "Trace unavailable", formula: "-", substitution: "Run Solve/backend validation to refresh formula trace.", result: "-", unit: "" }])
      .map((step) => [
        step.title || step.label || "-",
        step.formula || "-",
        step.substitution || "-",
        step.result === "-" ? "-" : formatStepResult(step)
      ]);
    return createTable(["Langkah", "Rumus", "Substitusi angka", "Hasil"], rows, "parameter-task-table parameter-trace-table");
  }

  function getPumpRoute(pumpId, model = runtimeModel(), connections = runtimeConnections()) {
    const hydraulic = (Array.isArray(connections) ? connections : []).filter((connection) => !connection.connectionType || connection.connectionType === "hydraulic");
    const suctionConnection = hydraulic.find((connection) => connection.to === pumpId);
    const dischargeConnection = hydraulic.find((connection) => connection.from === pumpId);
    const suctionPipe = suctionConnection?.pipeId ? model[suctionConnection.pipeId] : null;
    const dischargePipe = dischargeConnection?.pipeId ? model[dischargeConnection.pipeId] : null;
    const suctionBoundary = suctionConnection?.from ? model[suctionConnection.from] : null;
    const dischargeBoundary = dischargeConnection?.to ? model[dischargeConnection.to] : null;
    return {
      suctionConnection,
      dischargeConnection,
      suctionPipeId: suctionConnection?.pipeId || "",
      dischargePipeId: dischargeConnection?.pipeId || "",
      suctionBoundaryId: suctionConnection?.from || "",
      dischargeBoundaryId: dischargeConnection?.to || "",
      suctionPipe,
      dischargePipe,
      suctionBoundary,
      dischargeBoundary,
      text: [
        suctionConnection?.from,
        suctionConnection?.pipeId,
        pumpId,
        dischargeConnection?.pipeId,
        dischargeConnection?.to
      ].filter(Boolean).join(" -> ")
    };
  }

  function pipeTraceForBlock(route, block) {
    return block === "suction"
      ? route.suctionPipe?.results?.calculationTrace
      : route.dischargePipe?.results?.calculationTrace;
  }

  function pipeNodeForBlock(route, block) {
    return block === "suction" ? route.suctionPipe : route.dischargePipe;
  }

  function canonicalPipeSegments(pipeId = "", pipeNode = {}, model = runtimeModel()) {
    try {
      const realtime = root.EngineeringRealtimeCalculationDefense;
      if (typeof realtime?.enrichPipeCalculationTrace === "function") {
        const trace = realtime.enrichPipeCalculationTrace(pipeId, pipeNode, model);
        if (Array.isArray(trace?.segmentRows) && trace.segmentRows.length) return trace.segmentRows;
        if (Array.isArray(trace?.segments) && trace.segments.length) return trace.segments;
      }
      if (typeof realtime?.buildPipeSegmentRows === "function") {
        const rows = realtime.buildPipeSegmentRows(pipeId, pipeNode, model);
        if (Array.isArray(rows) && rows.length) return rows;
      }
    } catch (error) {
      // Parameter explanation can still render the backend trace if canonical enrichment is unavailable.
    }
    const trace = pipeNode?.results?.calculationTrace || {};
    if (Array.isArray(trace.segmentRows) && trace.segmentRows.length) return trace.segmentRows;
    if (Array.isArray(trace.segments) && trace.segments.length) return trace.segments;
    return [];
  }

  function createFluidBasisCard(fluid = {}) {
    const density = fluid.density;
    const vaporPressure = fluid.vaporPressure;
    const vaporHead = fluid.vaporPressureHead ?? (parseNumber(vaporPressure) !== null && parseNumber(density) !== null
      ? parseNumber(vaporPressure) * 100000 / (parseNumber(density) * 9.81)
      : null);
    const rows = [
      ["Fluid", displayText(fluid.fluidName || fluid.name, "-"), "Dipilih pada Fluid Basis."],
      ["Temperature", formatValue(fluid.temp, "deg C", 3), "Input temperatur yang menggerakkan property correlation."],
      ["Density, rho", formatValue(density, "kg/m3", 4), "Dipakai pada pressure head, pipe loss, dan konversi pressure-drop."],
      ["Kinematic viscosity, nu", formatValue(fluid.viscosity, "cSt", 6), "Dipakai pada Reynolds number."],
      ["Dynamic viscosity", formatValue(fluid.dynViscosity, "cP", 6), "Turunan density x kinematic viscosity."],
      ["Vapor pressure, Pv", formatValue(vaporPressure, "bar a", 6), "Dipakai pada vapor pressure head NPSH."],
      ["Vapor pressure head, Hv", formatValue(vaporHead, "m", 4), "Hv = Pv x 100000 / (rho x g)."]
    ];
    const content = createNode("div");
    content.appendChild(createTable(["Input/Properti", "Nilai", "Dipakai untuk"], rows));
    content.appendChild(createList([
      `Property method: ${displayText(fluid.propertyMethod, "Fluid Basis correlation / table basis")}.`,
      `Rumus konversi utama: Hv = ${formatNumber(vaporPressure, 6)} x 100000 / (${formatNumber(density, 4)} x 9.81) = ${formatNumber(vaporHead, 4)} m.`
    ], "parameter-task-note-list"));
    return createCard("Fluid Properties dan Temperatur", content);
  }

  function createRouteSummaryCard(block, snapshot) {
    const route = snapshot.route;
    const rows = block === "suction"
      ? [
        ["Route", [route.suctionBoundaryId, route.suctionPipeId, snapshot.id].filter(Boolean).join(" -> "), "Jalur dari boundary/source ke inlet pompa."],
        ["Boundary/source", route.suctionBoundaryId || "-", displayText(route.suctionBoundary?.name, "-")],
        ["Pipe/PFV suction", route.suctionPipeId || "-", displayText(route.suctionPipe?.name, "Suction pipe/PFV")],
        ["Pump", snapshot.id || "-", "Node pompa yang sedang dievaluasi."]
      ]
      : [
        ["Route", [snapshot.id, route.dischargePipeId, route.dischargeBoundaryId].filter(Boolean).join(" -> "), "Jalur dari outlet pompa ke sink/discharge boundary."],
        ["Pump", snapshot.id || "-", "Head pompa ditambahkan dari suction ke discharge."],
        ["Pipe/PFV discharge", route.dischargePipeId || "-", displayText(route.dischargePipe?.name, "Discharge pipe/PFV")],
        ["Boundary/sink", route.dischargeBoundaryId || "-", displayText(route.dischargeBoundary?.name, "-")]
      ];
    return createCard(block === "suction" ? "Route Trace Suction" : "Route Trace Discharge", createTable(["Item", "Nilai", "Keterangan"], rows));
  }

  function createPipeTraceCard(block, snapshot) {
    const trace = snapshot.pipeTrace || {};
    const pipe = snapshot.pipeNode || {};
    const totals = trace.totals || {};
    const basis = trace.basis || {};
    const content = createNode("div");
    content.appendChild(createTable(["Basis Pipe/PFV", "Nilai", "Rumus/Keterangan"], [
      ["Pipe/PFV", snapshot.pipeId || "-", displayText(pipe.name, block === "suction" ? "Suction side pipe/PFV" : "Discharge side pipe/PFV")],
      ["Flow", formatValue(basis.flowM3H ?? snapshot.flow, "m3/h", 4), "Q dari route hydraulic."],
      ["Flow SI", formatValue(basis.flowM3S ?? (parseNumber(snapshot.flow) / 3600), "m3/s", 8), "Q_SI = Q / 3600."],
      ["Density", formatValue(basis.density ?? snapshot.fluid.density, "kg/m3", 4), "rho dari Fluid Basis."],
      ["Kinematic viscosity", formatValue(basis.viscosityCSt ?? snapshot.fluid.viscosity, "cSt", 6), "nu untuk Reynolds number."],
      ["Major loss", formatValue(totals.majorLoss, "m", 6), "h_major = f x (L/D) x v^2/(2g)."],
      ["Minor loss", formatValue(totals.minorLoss, "m", 6), "h_minor = K_total x v^2/(2g)."],
      ["Total loss", formatValue(totals.totalLoss, "m", 6), "HL = major + minor + allowance."]
    ]));
    const segments = canonicalPipeSegments(snapshot.pipeId, pipe, snapshot.model);
    if (segments.length) {
      content.appendChild(createTable(["Segment", "D/L/K", "Re/f", "Loss"], segments.map((segment) => [
        displayText(segment.name, `Segment ${(segment.index ?? 0) + 1}`),
        `D=${formatNumber(segment.diameter, 4)} m; L=${formatNumber(segment.length, 3)} m; K=${formatNumber(segment.totalK ?? segment.minorLossK, 5)}`,
        `Re=${formatNumber(segment.reynolds, 0)}; f=${formatNumber(segment.frictionFactor, 6)}`,
        `Major ${formatNumber(segment.majorLoss, 5)} m; Minor ${formatNumber(segment.minorLoss, 5)} m; Total ${formatNumber(segment.totalLoss, 5)} m`
      ]), "parameter-task-table parameter-segment-table"));
    }
    content.appendChild(createList([
      "Urutan pipe loss: input diameter/panjang/roughness/K -> velocity -> Reynolds -> friction factor -> major/minor loss -> total loss.",
      "Total loss ini dipakai langsung dalam NPSHa untuk suction, dan dalam system head/discharge pressure check untuk discharge."
    ], "parameter-task-note-list"));
    return createCard(block === "suction" ? "Histori Pipe/PFV Suction Loss" : "Histori Pipe/PFV Discharge Loss", content);
  }

  function createSuctionResultCard(snapshot) {
    const evaluation = snapshot.evaluation;
    const npshaStep = findTraceStep(evaluation, /^NPSHa$/i);
    const npshrStep = findTraceStep(evaluation, /^NPSHr$/i);
    const marginStep = findTraceStep(evaluation, /Margin and Ratio/i);
    const requiredStep = findTraceStep(evaluation, /Required NPSHa/i);
    const pressureStep = findTraceStep(evaluation, /Source Absolute Pressure|Pressure Head|Suction Loss|Vapor Pressure Head|NPSHa/i);
    const rows = [
      ["Flow", formatLiveOrValue(snapshot.live.flow, snapshot.flow, "m3/h", 3), "Q dari route hydraulic/source/sink demand; dipakai untuk pipe loss dan titik kerja pompa."],
      ["Suction Press.", formatLiveOrValue(snapshot.live.suctionPressure, snapshot.suctionPressure, "bar a", 3), "Tekanan absolut di inlet pompa setelah suction route dihitung."],
      ["NPSH Available", formatLiveOrValue(snapshot.live.npsha, snapshot.npsha, "m", 4), npshaStep ? `${npshaStep.formula}; ${npshaStep.substitution}` : "NPSHa = pressure head + elevation/velocity head - suction loss - vapor pressure head."],
      ["NPSH Required", formatLiveOrValue(snapshot.live.npshr, snapshot.npshr, "m", 4), npshrStep ? `${npshrStep.formula}; ${npshrStep.substitution}` : "NPSHr dari data/curve pompa pada flow operasi."],
      ["NPSH Margin", formatLiveOrValue(snapshot.live.npshMargin, snapshot.npshMargin, "m", 4, true), marginStep ? marginStep.substitution : "Margin = NPSHa - NPSHr."],
      ["Required NPSHa", formatValue(snapshot.requiredNpsha, "m", 4), requiredStep ? requiredStep.substitution : "Required NPSHa = max(NPSHr x ratio minimum, NPSHr + margin minimum)."],
      ["NPSH Ratio", formatLiveOrValue(snapshot.live.npshRatio, snapshot.npshRatio, "", 4), marginStep ? marginStep.substitution : "Ratio = NPSHa / NPSHr."]
    ];
    const content = createNode("div");
    content.appendChild(createTable(["Parameter Blok 2", "Nilai", "Histori / Rumus"], rows));
    content.appendChild(createCard("Formula Trace NPSH", createTraceStepTable(getTraceSteps(evaluation).filter((step) => /Source Absolute Pressure|Pressure Head|Elevation Head|Velocity Head|Suction Loss|Vapor Pressure Head|NPSHa|NPSHr|Required NPSHa|Margin and Ratio|Operating Region/i.test(step.title || ""))), "parameter-task-nested-card"));
    if (pressureStep) content.appendChild(createList([`Pressure route anchor: ${pressureStep.substitution || "-"}`], "parameter-task-note-list"));
    return createCard("Histori Angka Parameter Suction", content);
  }

  function createDischargeResultCard(snapshot) {
    const evaluation = snapshot.evaluation;
    const systemHeadStep = findTraceStep(evaluation, /System Curve Head/i);
    const residualStep = findTraceStep(evaluation, /Head Residual/i);
    const pumpHead = parseNumber(snapshot.pumpHead);
    const suctionPressure = parseNumber(snapshot.suctionPressure);
    const density = parseNumber(snapshot.fluid.density);
    const dischargeFromFormula = Number.isFinite(suctionPressure) && Number.isFinite(pumpHead) && Number.isFinite(density)
      ? suctionPressure + density * 9.81 * pumpHead / 100000
      : null;
    const rows = [
      ["Pump Head", formatLiveOrValue(snapshot.live.pumpHead, snapshot.pumpHead, "m", 3), systemHeadStep ? `${systemHeadStep.formula}; ${systemHeadStep.substitution}` : "H_pump(Q) dari kurva/data pompa pada flow operasi."],
      ["Discharge Press.", formatLiveOrValue(snapshot.live.dischargePressure, snapshot.dischargePressure, "bar a", 3), `P_discharge = P_suction + rho x g x H_pump / 100000 = ${formatNumber(suctionPressure, 3)} + ${formatNumber(density, 3)} x 9.81 x ${formatNumber(pumpHead, 3)} / 100000 = ${formatNumber(dischargeFromFormula, 3)} bar a.`],
      ["System Head Check", formatValue(systemHeadStep?.result, systemHeadStep?.unit || "m", 4), systemHeadStep ? systemHeadStep.substitution : "System head = static head + suction loss + discharge loss."],
      ["Head Residual", formatValue(residualStep?.result, residualStep?.unit || "m", 4), residualStep ? residualStep.substitution : "Residual = pump head - system head."]
    ];
    const content = createNode("div");
    content.appendChild(createTable(["Parameter Blok 3", "Nilai", "Histori / Rumus"], rows));
    content.appendChild(createCard("Formula Trace Discharge/System Head", createTraceStepTable(getTraceSteps(evaluation).filter((step) => /System Static Head|System Curve Head|Head Residual/i.test(step.title || ""))), "parameter-task-nested-card"));
    return createCard("Histori Angka Parameter Discharge", content);
  }

  function buildRouteSnapshot(block, pumpId = "", trigger = null) {
    const { id, pump, props, results, evaluation } = pumpContext(pumpId, trigger);
    const model = runtimeModel();
    const route = getPumpRoute(id, model, runtimeConnections());
    const fluid = getFluidProps(model);
    const section = getLiveBlockSection(block, trigger);
    const live = block === "suction"
      ? {
        flow: readBlockRow(section, /^Flow\b/i),
        suctionPressure: readBlockRow(section, /Suction\s+Press/i),
        npsha: readBlockRow(section, /NPSH\s+Available/i),
        npshr: readBlockRow(section, /NPSH\s+Required/i),
        npshMargin: readBlockRow(section, /NPSH\s+Margin/i),
        npshRatio: readBlockRow(section, /NPSH\s+Ratio/i)
      }
      : {
        pumpHead: readBlockRow(section, /Pump\s+Head/i),
        dischargePressure: readBlockRow(section, /Discharge\s+Press/i)
      };
    const pipeNode = pipeNodeForBlock(route, block);
    const pipeTrace = pipeTraceForBlock(route, block);
    return {
      id,
      pump,
      props,
      results,
      evaluation,
      model,
      route,
      fluid,
      live,
      pipeNode,
      pipeTrace,
      pipeId: block === "suction" ? route.suctionPipeId : route.dischargePipeId,
      flow: evaluation.flow ?? results.flow ?? results.fixedFlow ?? props.designFlow,
      suctionPressure: evaluation.suctionPressureAbs ?? results.suctionPressure,
      npsha: evaluation.npsha ?? results.npsha,
      npshr: evaluation.npshr ?? results.npshr,
      npshMargin: evaluation.npshMargin ?? results.npshMargin,
      npshRatio: evaluation.npshRatio ?? results.npshRatio,
      requiredNpsha: evaluation.requiredNpsha ?? results.requiredNpsha,
      pumpHead: evaluation.pumpHead ?? results.head ?? results.pumpHeadAtFlow ?? props.designHead,
      dischargePressure: results.dischargePressure
    };
  }

  function createParameterRouteContent(block, pumpId = "", trigger = null) {
    const snapshot = buildRouteSnapshot(block, pumpId, trigger);
    const layout = createNode("div", `fluid-help-layout parameter-task-layout parameter-${block}-layout`);
    layout.dataset.parameterTaskBlock = block;
    layout.append(
      createRouteSummaryCard(block, snapshot),
      createFluidBasisCard(snapshot.fluid),
      createPipeTraceCard(block, snapshot),
      block === "suction" ? createSuctionResultCard(snapshot) : createDischargeResultCard(snapshot)
    );
    return layout;
  }

  function createParameterTaskContent(block, pumpId = "", trigger = null) {
    if (block === "status") return createParameterStatusContent(pumpId, trigger);
    if (block === "suction" || block === "discharge") return createParameterRouteContent(block, pumpId, trigger);
    return createCard("Parameter Task", "Parameter explanation is not available.");
  }

  function statusTone(status = "") {
    const text = String(status).toLowerCase();
    if (text.includes("safe")) return "ok";
    if (text.includes("risk") || text.includes("cavitation")) return "danger";
    if (text.includes("warn")) return "warning";
    if (text.includes("input") || text.includes("incomplete") || text.includes("unknown")) return "muted";
    return "";
  }

  function backendTone(status = "") {
    const text = String(status).toLowerCase();
    if (text.includes("connected") || text.includes("current")) return "ok";
    if (text.includes("timeout") || text.includes("unavailable")) return "danger";
    if (text.includes("stale") || text.includes("calculating") || text.includes("unverified")) return "warning";
    return "";
  }

  function isStatusSection(section) {
    return isBlockSection(section, "status");
  }

  function findBlockSections(scope = document, block = "status") {
    const rootNode = scope && scope.querySelectorAll ? scope : document;
    const sections = new Set();
    const scanRoots = new Set([rootNode]);
    const parentPanel = rootNode.closest?.(".pump-live-params");
    if (parentPanel) scanRoots.add(parentPanel);

    scanRoots.forEach((scanRoot) => {
      if (scanRoot.matches?.(SECTION_SELECTOR) && isBlockSection(scanRoot, block)) {
        sections.add(scanRoot);
      }
      scanRoot.querySelectorAll?.(SECTION_SELECTOR).forEach((section) => {
        if (isBlockSection(section, block)) sections.add(section);
      });
    });
    return Array.from(sections);
  }

  function findStatusSections(scope = document) {
    return findBlockSections(scope, "status");
  }

  function ensureBlockTrigger(section, block = "status") {
    if (!section || !BLOCKS[block] || section.querySelector(`[data-parameter-task-trigger="${block}"]`)) return false;
    section.classList.add("parameter-task-trigger-host");
    section.dataset.parameterTaskBlock = block;

    const button = createNode("button", `parameter-task-trigger parameter-task-trigger-${block}`, "i");
    button.type = "button";
    button.dataset.parameterTaskTrigger = block;
    button.setAttribute("aria-label", `Open Parameter ${BLOCKS[block].label} explanation`);
    button.title = `Open Parameter ${BLOCKS[block].label}`;
    button.addEventListener("pointerdown", onTriggerPointerDown, true);
    button.addEventListener("click", onTriggerButtonClick, true);
    section.appendChild(button);
    return true;
  }

  function ensureStatusTrigger(section) {
    return ensureBlockTrigger(section, "status");
  }

  function ensureTriggers(scope = document) {
    if (typeof document === "undefined") return 0;
    let count = 0;
    Object.keys(BLOCKS).forEach((block) => {
      findBlockSections(scope, block).forEach((section) => {
        if (ensureBlockTrigger(section, block)) count += 1;
      });
    });
    return count;
  }

  function installCss() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.parameter-task-trigger-host {
  position: relative !important;
  padding-right: 0 !important;
}
.pump-live-param-section.parameter-task-trigger-host {
  display: flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 4px !important;
}
.parameter-task-trigger {
  position: static;
  z-index: 3;
  width: 12px;
  height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  margin-left: 3px;
  border: 1px solid rgba(28, 69, 104, .34);
  border-radius: 3px;
  background: rgba(255, 255, 255, .82);
  color: #123b5a;
  font-size: 8px;
  font-weight: 800;
  line-height: 1;
  opacity: .55;
  box-shadow: none;
  cursor: pointer !important;
  pointer-events: auto !important;
  transform: translateY(-1px);
}
.parameter-task-trigger:hover,
.parameter-task-trigger:focus-visible {
  background: #eaf5ff;
  opacity: 1;
  outline: 2px solid rgba(28, 69, 104, .24);
  outline-offset: 1px;
}
.parameter-task-window {
  width: min(760px, calc(100vw - 36px));
  height: min(690px, calc(100dvh - 128px));
}
.parameter-task-window.task-window-minimized {
  height: 42px !important;
  min-height: 42px !important;
  max-height: 42px !important;
}
.parameter-task-window.task-window-minimized .task-window-body,
.parameter-task-window.task-window-minimized .parameter-task-resize-handle {
  display: none !important;
}
.parameter-task-body {
  background: #f6f8fb;
}
.parameter-task-layout {
  display: grid;
  gap: 10px;
  color: #17395a;
  font-size: 11.5px;
  line-height: 1.45;
}
.parameter-task-card {
  min-width: 0;
  padding: 11px;
  border: 1px solid #d8e6f2;
  border-radius: 8px;
  background: #ffffff;
}
.parameter-task-nested-card {
  margin-top: 10px;
  background: #f8fbff;
}
.parameter-task-card h3 {
  margin: 0 0 8px;
  color: #123b5a;
  font-size: 13px;
  line-height: 1.25;
}
.parameter-task-paragraph {
  margin: 0 0 7px;
  color: #334155;
}
.parameter-task-metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  margin-top: 8px;
}
.parameter-task-metric {
  min-width: 0;
  padding: 7px;
  border: 1px solid #e2edf7;
  border-radius: 6px;
  background: #f8fbff;
}
.parameter-task-metric span,
.parameter-task-metric strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.parameter-task-metric span {
  color: #64748b;
  font-size: 10px;
}
.parameter-task-metric strong {
  margin-top: 2px;
  color: #123b5a;
  font-size: 12px;
}
.parameter-task-metric-ok {
  border-color: #a7f3d0;
  background: #ecfdf5;
}
.parameter-task-metric-warning {
  border-color: #fed7aa;
  background: #fff7ed;
}
.parameter-task-metric-danger {
  border-color: #fecaca;
  background: #fef2f2;
}
.parameter-task-metric-muted {
  border-color: #cbd5e1;
  background: #f8fafc;
}
.parameter-task-formula-stack {
  display: grid;
  gap: 6px;
  margin: 8px 0;
}
.parameter-task-code-line {
  display: block;
  padding: 7px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 11px;
  white-space: normal;
}
.parameter-task-table-wrap {
  width: 100%;
  overflow: auto;
  border: 1px solid #e2edf7;
  border-radius: 6px;
  background: #fff;
}
.parameter-task-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10.8px;
  line-height: 1.38;
}
.parameter-task-table th {
  padding: 7px 8px;
  border-bottom: 1px solid #d8e6f2;
  background: #eef6fc;
  color: #123b5a;
  text-align: left;
  font-weight: 800;
  white-space: nowrap;
}
.parameter-task-table td {
  padding: 7px 8px;
  border-bottom: 1px solid #edf2f7;
  color: #334155;
  vertical-align: top;
}
.parameter-task-table tr:last-child td {
  border-bottom: 0;
}
.parameter-task-list,
.parameter-task-note-list {
  margin: 7px 0 0;
  padding-left: 18px;
  color: #334155;
}
.parameter-task-list li,
.parameter-task-note-list li {
  margin: 4px 0;
}
.parameter-task-note-list {
  color: #475569;
}
.parameter-task-resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  touch-action: none;
}
.parameter-task-resize-handle::after {
  content: "";
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 8px;
  height: 8px;
  border-right: 2px solid rgba(28, 69, 104, .45);
  border-bottom: 2px solid rgba(28, 69, 104, .45);
}
@media (max-width: 760px) {
  .parameter-task-metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .parameter-task-layout {
    font-size: 11px;
  }
  .parameter-task-metric-grid {
    grid-template-columns: 1fr;
  }
  .parameter-task-table-wrap {
    border: 0;
    background: transparent;
  }
  .parameter-task-table,
  .parameter-task-table thead,
  .parameter-task-table tbody,
  .parameter-task-table tr,
  .parameter-task-table th,
  .parameter-task-table td {
    display: block;
  }
  .parameter-task-table thead {
    display: none;
  }
  .parameter-task-table tr {
    margin-bottom: 7px;
    border: 1px solid #e2edf7;
    border-radius: 6px;
    background: #fff;
    overflow: hidden;
  }
  .parameter-task-table td {
    display: grid;
    grid-template-columns: minmax(108px, 42%) 1fr;
    gap: 8px;
    border-bottom: 1px solid #edf2f7;
  }
  .parameter-task-table td::before {
    content: attr(data-label);
    color: #64748b;
    font-weight: 800;
  }
}
`;
    document.head.appendChild(style);
  }

  function bringToFront(windowNode) {
    if (!windowNode) return;
    const current = Number(root.__engineeringParameterTaskZ || 1450);
    const next = Math.max(current + 1, 1451);
    root.__engineeringParameterTaskZ = next;
    windowNode.style.zIndex = String(next);
  }

  function clampWindow(windowNode) {
    if (!windowNode || typeof window === "undefined") return;
    const rect = windowNode.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - Math.min(rect.width, window.innerWidth - 16) - 8);
    const maxTop = Math.max(8, window.innerHeight - 48);
    const left = Math.min(Math.max(8, rect.left), maxLeft);
    const top = Math.min(Math.max(8, rect.top), maxTop);
    windowNode.style.left = `${left}px`;
    windowNode.style.top = `${top}px`;
    windowNode.style.right = "auto";
  }

  function positionWindow(windowNode) {
    const offset = (windowCounter % 5) * 24;
    windowCounter += 1;
    const width = Math.min(760, Math.max(MIN_WINDOW_WIDTH, window.innerWidth - 36));
    const left = Math.max(8, window.innerWidth - width - 18 - offset);
    const top = Math.max(8, 112 + offset);
    windowNode.style.width = `${width}px`;
    windowNode.style.left = `${left}px`;
    windowNode.style.top = `${top}px`;
    windowNode.style.right = "auto";
  }

  function updateMinimizeButton(windowNode) {
    const button = windowNode?.querySelector?.(".task-window-minimize");
    if (!button) return;
    const minimized = windowNode.classList.contains("task-window-minimized");
    button.textContent = minimized ? "+" : "_";
    button.setAttribute("aria-label", minimized ? "Restore parameter task window" : "Minimize parameter task window");
    windowNode.setAttribute("aria-expanded", minimized ? "false" : "true");
  }

  function setWindowMinimized(windowNode, minimized) {
    if (!windowNode) return;
    windowNode.classList.toggle("task-window-minimized", !!minimized);
    updateMinimizeButton(windowNode);
    bringToFront(windowNode);
  }

  function finishDrag(pointerId = null) {
    if (dragState?.header && pointerId !== null) {
      try {
        dragState.header.releasePointerCapture?.(pointerId);
      } catch (error) {
        // Pointer capture may already be released by the browser.
      }
    }
    dragState = null;
  }

  function initializeDrag(windowNode, header) {
    if (!windowNode || !header) return;
    header.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target?.closest?.("button, a, input, select, textarea")) return;
      const rect = windowNode.getBoundingClientRect();
      dragState = {
        windowNode,
        header,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      header.setPointerCapture?.(event.pointerId);
      bringToFront(windowNode);
      event.preventDefault();
    });
    header.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.windowNode !== windowNode || dragState.pointerId !== event.pointerId) return;
      const nextLeft = dragState.left + event.clientX - dragState.startX;
      const nextTop = dragState.top + event.clientY - dragState.startY;
      windowNode.style.left = `${Math.max(8, Math.min(nextLeft, window.innerWidth - 64))}px`;
      windowNode.style.top = `${Math.max(8, Math.min(nextTop, window.innerHeight - 48))}px`;
      windowNode.style.right = "auto";
      event.preventDefault();
    });
    header.addEventListener("pointerup", (event) => finishDrag(event.pointerId));
    header.addEventListener("pointercancel", (event) => finishDrag(event.pointerId));
  }

  function finishResize(pointerId = null) {
    if (resizeState?.handle && pointerId !== null) {
      try {
        resizeState.handle.releasePointerCapture?.(pointerId);
      } catch (error) {
        // Pointer capture may already be released by the browser.
      }
    }
    resizeState = null;
  }

  function initializeResize(windowNode, handle) {
    if (!windowNode || !handle) return;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      const rect = windowNode.getBoundingClientRect();
      resizeState = {
        windowNode,
        handle,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        width: rect.width,
        height: rect.height
      };
      handle.setPointerCapture?.(event.pointerId);
      bringToFront(windowNode);
      event.preventDefault();
      event.stopPropagation();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!resizeState || resizeState.windowNode !== windowNode || resizeState.pointerId !== event.pointerId) return;
      const nextWidth = Math.max(MIN_WINDOW_WIDTH, resizeState.width + event.clientX - resizeState.startX);
      const nextHeight = Math.max(MIN_WINDOW_HEIGHT, resizeState.height + event.clientY - resizeState.startY);
      windowNode.style.width = `${Math.min(nextWidth, window.innerWidth - 16)}px`;
      windowNode.style.height = `${Math.min(nextHeight, window.innerHeight - 24)}px`;
      event.preventDefault();
    });
    handle.addEventListener("pointerup", (event) => finishResize(event.pointerId));
    handle.addEventListener("pointercancel", (event) => finishResize(event.pointerId));
  }

  function refreshWindowContent(windowNode, pumpId = "", trigger = null) {
    const body = windowNode?.querySelector?.(".task-window-body");
    if (!body) return;
    const block = windowNode.dataset.parameterTaskBlock || windowNode.dataset.kind?.replace("parameter-", "") || "status";
    body.replaceChildren(createParameterTaskContent(block, pumpId || windowNode.dataset.pumpNodeId, trigger));
    body.scrollTop = 0;
    body.scrollLeft = 0;
    root.EngineeringFormulaDefenseUI?.enhanceDocument?.(document);
  }

  function refreshOpenWindows(pumpId = "") {
    if (typeof document === "undefined") return 0;
    let count = 0;
    Array.from(document.querySelectorAll(WINDOW_SELECTOR)).forEach((windowNode) => {
      const body = windowNode.querySelector?.(".task-window-body");
      const scrollTop = body?.scrollTop || 0;
      const scrollLeft = body?.scrollLeft || 0;
      refreshWindowContent(windowNode, pumpId || windowNode.dataset.pumpNodeId);
      if (body) {
        body.scrollTop = scrollTop;
        body.scrollLeft = scrollLeft;
      }
      count += 1;
    });
    return count;
  }

  function openParameterTaskWindow(block = "status", pumpId = "", trigger = null) {
    if (typeof document === "undefined") return null;
    const definition = BLOCKS[block] || BLOCKS.status;
    installCss();
    const resolvedId = resolvePumpId(pumpId, trigger);
    const existing = Array.from(document.querySelectorAll(`.${definition.windowClass}`))
      .find((node) => node.dataset.pumpNodeId === resolvedId);
    if (existing) {
      refreshWindowContent(existing, resolvedId, trigger);
      existing.classList.remove("task-window-minimized");
      updateMinimizeButton(existing);
      clampWindow(existing);
      bringToFront(existing);
      existing.focus({ preventScroll: true });
      return existing;
    }

    const windowNode = createNode("section", `task-window parameter-task-window ${definition.windowClass} task-window-user-positioned task-window-mobile-sheet`);
    windowNode.dataset.kind = `parameter-${block}`;
    windowNode.dataset.parameterTaskBlock = block;
    windowNode.dataset.pumpNodeId = resolvedId;
    windowNode.dataset.formulaDefenseWindow = `parameter-${block}`;
    windowNode.setAttribute("role", "dialog");
    windowNode.setAttribute("aria-modal", "false");
    windowNode.setAttribute("aria-label", `Parameter ${definition.label}`);
    windowNode.setAttribute("aria-expanded", "true");
    windowNode.setAttribute("tabindex", "-1");
    positionWindow(windowNode);

    const header = createNode("div", "task-window-header parameter-task-window-header");
    const title = createNode("span", "task-window-title", definition.title);
    const actions = createNode("div", "task-window-actions");
    const minimize = createNode("button", "task-window-minimize", "_");
    minimize.type = "button";
    minimize.setAttribute("aria-label", "Minimize parameter task window");
    minimize.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setWindowMinimized(windowNode, !windowNode.classList.contains("task-window-minimized"));
    });
    const close = createNode("button", "task-window-close", "X");
    close.type = "button";
    close.setAttribute("aria-label", "Close parameter task window");
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      windowNode.remove();
    });
    actions.append(minimize, close);
    header.append(title, actions);

    const body = createNode("div", `task-window-body fluid-help-body parameter-task-body ${definition.bodyClass}`);
    body.dataset.taskPropBody = "true";
    body.appendChild(createParameterTaskContent(block, resolvedId, trigger));

    const handle = createNode("div", "parameter-task-resize-handle");
    handle.setAttribute("aria-hidden", "true");
    windowNode.append(header, body, handle);
    document.body.appendChild(windowNode);

    initializeDrag(windowNode, header);
    initializeResize(windowNode, handle);
    windowNode.addEventListener("pointerdown", () => bringToFront(windowNode));
    windowNode.addEventListener("focusin", () => bringToFront(windowNode));
    root.EngineeringFormulaDefenseUI?.enhanceDocument?.(document);
    clampWindow(windowNode);
    bringToFront(windowNode);
    window.setTimeout(() => windowNode.focus({ preventScroll: true }), 0);
    return windowNode;
  }

  function openParameterStatusTaskWindow(pumpId = "", trigger = null) {
    return openParameterTaskWindow("status", pumpId, trigger);
  }

  function openParameterSuctionTaskWindow(pumpId = "", trigger = null) {
    return openParameterTaskWindow("suction", pumpId, trigger);
  }

  function openParameterDischargeTaskWindow(pumpId = "", trigger = null) {
    return openParameterTaskWindow("discharge", pumpId, trigger);
  }

  function activateTrigger(trigger, event = null) {
    if (!trigger) return false;
    const block = trigger.dataset.parameterTaskTrigger;
    if (!BLOCKS[block]) return false;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    openParameterTaskWindow(block, resolvePumpId("", trigger), trigger);
    return true;
  }

  function onTriggerPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    activateTrigger(event.currentTarget || event.target?.closest?.(TRIGGER_SELECTOR), event);
  }

  function onTriggerButtonClick(event) {
    activateTrigger(event.currentTarget || event.target?.closest?.(TRIGGER_SELECTOR), event);
  }

  function onDocumentClick(event) {
    const trigger = event.target?.closest?.(TRIGGER_SELECTOR);
    if (!trigger) return;
    activateTrigger(trigger, event);
  }

  function onDocumentKeydown(event) {
    const trigger = event.target?.closest?.(TRIGGER_SELECTOR);
    if (!trigger) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    activateTrigger(trigger, event);
  }

  function installObserver() {
    if (typeof MutationObserver === "undefined" || observer || typeof document === "undefined" || !document.body) return;
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes || []) {
          if (node?.nodeType === 1) {
            ensureTriggers(node);
          }
        }
        if (mutation.type === "characterData") {
          ensureTriggers(document);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function install(options = {}) {
    if (typeof document === "undefined") return false;
    installCss();
    ensureTriggers(document);
    installObserver();
    if (!root.__engineeringParameterTaskEventsBound || options.force) {
      if (!root.__engineeringParameterTaskEventsBound) {
        document.addEventListener("click", onDocumentClick, true);
        document.addEventListener("keydown", onDocumentKeydown, true);
      }
      root.__engineeringParameterTaskEventsBound = true;
    }
    document.documentElement.dataset.engineeringParameterTaskRuntime = VERSION;
    return true;
  }

  root.EngineeringParameterTaskRuntime = {
    version: VERSION,
    install,
    ensureTriggers,
    createParameterStatusContent,
    createParameterRouteContent,
    createParameterTaskContent,
    openParameterTaskWindow,
    openParameterStatusTaskWindow,
    openParameterSuctionTaskWindow,
    openParameterDischargeTaskWindow,
    refreshOpenWindows,
    buildStatusSnapshot,
    buildRouteSnapshot,
    windows: () => Array.from(document.querySelectorAll(WINDOW_SELECTOR))
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = root.EngineeringParameterTaskRuntime;
  }

  if (typeof document === "undefined") {
    install();
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => install(), { once: true });
  } else {
    install();
  }
}("undefined" !== typeof window ? window : globalThis);
