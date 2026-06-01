(function registerEngineeringDefenseExportPackage(root) {
  const VERSION = '2026.05-defense-export-package-v2';
  const SCHEMA_VERSION = 'defense-export-package.v1';
  const PANEL_ID = 'engineeringDefenseExportPackagePanel';
  const PANEL_BODY_ID = 'engineeringDefenseExportPackagePanelBody';
  const MENU_BUTTON_ID = 'menu-tools-defense-export-package';
  const DEFENDED_ROUTE_ORDER = 'First Opening -> Fluid Basis -> SRC -> Pipe/Fitting/Valve (suction) -> Pump -> Pipe/Fitting/Valve (discharge) -> SNK';
  const SRC_STANDARD_FORM_FALLBACK = Object.freeze({
    schemaVersion: 'src-standard-form.v1',
    lockVersion: 'source-standard-form-all-surfaces-v1',
    valuePolicy: 'live-user-import-or-calculated-values-only',
    requiredSections: Object.freeze(['Source Definition', 'Boundary Data', 'Flow Specification', 'Fluid Basis Link'])
  });

  function escapeText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function roundValue(value, digits = 4) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
  }

  function formatValue(value, unit = '') {
    const rounded = roundValue(value);
    if (rounded === null) return '-';
    return `${rounded}${unit ? ` ${unit}` : ''}`;
  }

  function shortHash(value) {
    const text = String(value || '');
    return text ? text.slice(0, 12) : '-';
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  function lightweightFingerprint(value) {
    const text = stableStringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `ui-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function routeAuditPayload() {
    if (typeof root.EngineeringRouteTraceAudit?.activeAuditPayload === 'function') {
      return root.EngineeringRouteTraceAudit.activeAuditPayload() || {};
    }
    return {};
  }

  function activeDefensePayload() {
    const audit = routeAuditPayload();
    const results = audit.pumpNode?.results || {};
    return {
      pumpId: audit.pumpId || '',
      pumpNode: audit.pumpNode || null,
      routeTrace: audit.routeTrace || results.routeTrace || null,
      calculationAudit: audit.calculationAudit || results.calculationAudit || null,
      dependencyManifest: audit.dependencyManifest || results.dependencyManifest || null,
      advancedEngineeringValidation: audit.advancedEngineeringValidation || results.advancedEngineeringValidation || null,
      securityPosture: audit.securityPosture || results.securityPosture || null,
      libraryManifest: audit.libraryManifest || results.libraryManifest || root.EngineeringLibraryManifest || null,
      defenseExportContext: audit.defenseExportContext || results.defenseExportContext || null,
      apiAuditEvent: audit.apiAuditEvent || results.apiAuditEvent || null,
      libraryGovernance: root.EngineeringLibraryGovernance || null,
      result: results.npshEvaluation || results || null
    };
  }

  function sourceStandardFormContract() {
    return root.EngineeringSourceStandardForm?.contract || SRC_STANDARD_FORM_FALLBACK;
  }

  function finalCitationStatus(libraryGovernance) {
    if (typeof libraryGovernance?.getCitationPageLockStatus === 'function') {
      return libraryGovernance.getCitationPageLockStatus();
    }
    return {
      byStatus: {},
      pendingFormulaIds: [],
      pageLockedFormulaIds: [],
      compositeTraceFormulaIds: [],
      formulas: []
    };
  }

  function formulaPageLocks(libraryGovernance, routeTrace) {
    const formulaIds = new Set((routeTrace?.steps || []).map((step) => step.formulaGroup).filter(Boolean));
    const entries = libraryGovernance?.formulaLiteratureMap || [];
    return entries
      .filter((entry) => formulaIds.has(entry.formulaId) || (entry.traceKeys || []).some((key) => routeTrace?.text?.includes(key)))
      .map((entry) => ({
        formulaId: entry.formulaId,
        label: entry.label,
        status: entry.pageLocator?.status || 'missing',
        referenceIds: entry.referenceIds || [],
        pdfPage: entry.pageLocator?.pdfPage || null,
        printedPage: entry.pageLocator?.printedPage || null,
        evidence: entry.pageLocator?.evidence || '',
        assumptions: entry.assumptions || [],
        limitations: entry.limitations || []
      }));
  }

  function routeStep(routeTrace, type) {
    return (routeTrace?.steps || []).find((step) => step.type === type) || null;
  }

  function stagedRouteSteps(routeTrace, pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(String(pattern || ''), 'i');
    return (routeTrace?.steps || []).filter((step) => regex.test(String(step.stage || '')));
  }

  function evidenceStatus(ok, review = false) {
    if (!ok) return 'Missing';
    return review ? 'Review Required' : 'Ready';
  }

  function buildUiEvidenceRegistry(payload = activeDefensePayload()) {
    const routeTrace = payload.routeTrace || {};
    const validation = payload.advancedEngineeringValidation || {};
    const result = payload.result || validation.acceptanceCriteria || {};
    const dependency = payload.dependencyManifest || {};
    const routeSteps = routeTrace.steps || [];
    const fluidStep = routeStep(routeTrace, 'fluid');
    const sourceStep = routeStep(routeTrace, 'source');
    const sourceStandard = sourceStandardFormContract();
    const sinkStep = routeStep(routeTrace, 'sink');
    const pumpStep = routeStep(routeTrace, 'pump');
    const suctionSteps = stagedRouteSteps(routeTrace, /suction/i).filter((step) => ['pipe', 'valve', 'checkValve'].includes(step.type));
    const dischargeSteps = stagedRouteSteps(routeTrace, /discharge/i).filter((step) => ['pipe', 'valve', 'checkValve'].includes(step.type));
    const citationStatus = finalCitationStatus(payload.libraryGovernance);
    const pageLockOk = (citationStatus.pendingFormulaIds || []).length === 0;
    const tankOrVesselNodes = validation.boundaryValidation?.tankOrVesselNodes || [];
    const resultStatus = validation.acceptanceCriteria?.reportedStatus || result.status || '';
    const calculationComplete = resultStatus !== 'Incomplete';

    return [
      {
        id: 'first-opening',
        taskWindow: 'First Opening / Browser',
        status: 'Ready',
        inputEvidence: 'Protected public shell and deferred audit scripts are available.',
        outputEvidence: 'Route audit and defense export package can be opened from Tools.',
        requiredForDefense: true
      },
      {
        id: 'fluid-basis',
        taskWindow: 'Fluid Basis',
        status: evidenceStatus(!!fluidStep && pageLockOk),
        inputEvidence: fluidStep ? `Step ${fluidStep.order}: fluid properties are in the route trace.` : 'Fluid Basis route step is missing.',
        outputEvidence: fluidStep ? `Density/vapor-pressure basis references ${(fluidStep.literatureReferences || []).join(', ') || '-'}.` : 'Run backend calculation after completing Fluid Basis.',
        requiredForDefense: true
      },
      {
        id: 'src-boundary',
        taskWindow: 'SRC',
        status: evidenceStatus(!!sourceStep),
        inputEvidence: sourceStep
          ? `${sourceStep.id} is upstream of pump; standard form=${sourceStandard?.lockVersion || '-'}.`
          : 'SRC boundary is missing.',
        outputEvidence: sourceStep
          ? `Boundary data=${sourceStep.audit?.dataStatus?.status || '-'}; sections=${(sourceStandard?.requiredSections || []).join(', ') || '-'}; Source Formula Defense=required.`
          : 'Connect SRC before final NPSH route defense.',
        standardForm: sourceStandard ? {
          schemaVersion: sourceStandard.schemaVersion,
          lockVersion: sourceStandard.lockVersion,
          valuePolicy: sourceStandard.valuePolicy,
          requiredSections: sourceStandard.requiredSections || []
        } : null,
        requiredForDefense: true
      },
      {
        id: 'suction-pipe-fitting-valve',
        taskWindow: 'Pipe/Fitting/Valve (suction)',
        status: evidenceStatus(suctionSteps.length > 0),
        inputEvidence: suctionSteps.length ? suctionSteps.map((step) => step.id).join(' -> ') : 'No suction route component is traced.',
        outputEvidence: `Suction loss ${formatValue(routeTrace.sections?.suction?.totalLossM, 'm')}; direct NPSHa impact=${routeTrace.sections?.suction?.directNpshImpact === true}.`,
        requiredForDefense: true
      },
      {
        id: 'pump',
        taskWindow: 'Pump',
        status: evidenceStatus(!!pumpStep && calculationComplete, validation.pumpCurveBasis?.reviewRequired),
        inputEvidence: pumpStep ? `${pumpStep.id} is the evaluated pump.` : 'Pump route step is missing.',
        outputEvidence: `NPSHa ${formatValue(validation.acceptanceCriteria?.npshaM ?? result.npsha, 'm')}; NPSHr ${formatValue(validation.acceptanceCriteria?.npshrM ?? result.npshr, 'm')}; validation=${validation.status || '-'}.`,
        requiredForDefense: true
      },
      {
        id: 'discharge-pipe-fitting-valve',
        taskWindow: 'Pipe/Fitting/Valve (discharge)',
        status: evidenceStatus(dischargeSteps.length > 0),
        inputEvidence: dischargeSteps.length ? dischargeSteps.map((step) => step.id).join(' -> ') : 'No discharge route component is traced.',
        outputEvidence: `Discharge loss ${formatValue(routeTrace.sections?.discharge?.totalLossM, 'm')}; system-head impact=true.`,
        requiredForDefense: true
      },
      {
        id: 'snk-boundary',
        taskWindow: 'SNK',
        status: evidenceStatus(!!sinkStep),
        inputEvidence: sinkStep ? `${sinkStep.id} is downstream of pump.` : 'SNK boundary is missing.',
        outputEvidence: sinkStep ? `Outlet data=${sinkStep.audit?.dataStatus?.status || '-'}.` : 'Connect SNK before final route defense.',
        requiredForDefense: true
      },
      {
        id: 'tank-vessel',
        taskWindow: 'Tank / Vessel',
        status: tankOrVesselNodes.length ? 'Ready' : 'Optional / Future Study',
        inputEvidence: tankOrVesselNodes.length ? tankOrVesselNodes.map((node) => `${node.id} (${node.type})`).join(', ') : 'No tank/vessel node in current route.',
        outputEvidence: tankOrVesselNodes.length ? 'Tank/vessel boundary evidence is available.' : 'Badge remains available for future tank/vessel routes.',
        requiredForDefense: false
      },
      {
        id: 'route-calculation-output',
        taskWindow: 'Route Calculation output',
        status: evidenceStatus(!!routeTrace.text && !!dependency.dependencyFingerprint && !!payload.calculationAudit?.calculationId),
        inputEvidence: routeTrace.text || 'Route text is unavailable.',
        outputEvidence: `calculationId=${payload.calculationAudit?.calculationId || '-'}; dependency=${shortHash(dependency.dependencyFingerprint)}.`,
        requiredForDefense: true
      }
    ];
  }

  function defenseReadiness(payload, registry) {
    const validation = payload.advancedEngineeringValidation || {};
    const failedChecks = (validation.checks || []).filter((check) => check.status === 'fail');
    const missingRequired = registry.filter((item) => item.requiredForDefense && item.status === 'Missing');
    if (validation.status === 'Incomplete') return 'Incomplete';
    if (failedChecks.length || missingRequired.length) return 'Failed';
    if (validation.status === 'Review Required' || registry.some((item) => item.status === 'Review Required')) return 'Review Required';
    if (!payload.routeTrace) return 'Incomplete';
    return 'Defense Ready';
  }

  function buildDefensePackage(payload = activeDefensePayload()) {
    const registry = buildUiEvidenceRegistry(payload);
    const routeTrace = payload.routeTrace || {};
    const validation = payload.advancedEngineeringValidation || {};
    const dependency = payload.dependencyManifest || {};
    const calculation = payload.calculationAudit || {};
    const result = payload.result || {};
    const citationStatus = finalCitationStatus(payload.libraryGovernance);
    const pageLocks = formulaPageLocks(payload.libraryGovernance, routeTrace);
    const npsh = validation.acceptanceCriteria || result || {};
    const readiness = defenseReadiness(payload, registry);
    const gapNotes = [
      ...new Set([
        ...(validation.gapReviewNotes || []),
        ...(result.warnings || []),
        ...registry.filter((item) => item.requiredForDefense && item.status !== 'Ready').map((item) => `${item.taskWindow}: ${item.outputEvidence}`)
      ])
    ];
    const core = {
      pumpId: payload.pumpId || routeTrace.pumpId || '',
      readiness,
      routeText: routeTrace.text || '',
      calculationId: calculation.calculationId || null,
      dependencyFingerprint: dependency.dependencyFingerprint || null,
      validationStatus: validation.status || '',
      evidenceStatus: registry.map((item) => ({ id: item.id, status: item.status }))
    };
    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      sourceOfTruth: 'backend',
      publicFrontendIsSecret: false,
      routeOrder: DEFENDED_ROUTE_ORDER,
      packageFingerprint: lightweightFingerprint(core),
      ...core,
      summary: {
        routeTraceAvailable: !!payload.routeTrace,
        calculationAuditAvailable: !!payload.calculationAudit,
        dependencyManifestAvailable: !!payload.dependencyManifest,
        advancedEngineeringValidationAvailable: !!payload.advancedEngineeringValidation,
        uiEvidenceItems: registry.length,
        requiredEvidenceMissing: registry.filter((item) => item.requiredForDefense && item.status === 'Missing').length,
        reviewItems: registry.filter((item) => item.status === 'Review Required').length,
        conclusion: readiness === 'Defense Ready'
          ? 'Defense package is complete for the current backend route.'
          : (readiness === 'Incomplete' ? 'Defense package is incomplete until backend route calculation is available.' : 'Defense package is traceable with review items before final defense.')
      },
      npshAcceptance: {
        npshaM: roundValue(npsh.npshaM ?? npsh.npsha),
        npshrM: roundValue(npsh.npshrM ?? npsh.npshr),
        marginM: roundValue(npsh.npshMarginM ?? npsh.npshMargin),
        ratio: roundValue(npsh.npshRatio),
        requiredNpshaM: roundValue(npsh.requiredNpshaM ?? npsh.requiredNpsha),
        excessM: roundValue(npsh.npshExcessM ?? npsh.npshExcess),
        reportedStatus: npsh.reportedStatus || result.status || '',
        expectedStatus: npsh.expectedStatus || ''
      },
      routeCalculation: {
        text: routeTrace.text || '',
        steps: (routeTrace.steps || []).map((step) => ({
          order: step.order,
          id: step.id,
          type: step.type,
          stage: step.stage,
          formulaGroup: step.formulaGroup || '',
          directNpshImpact: step.directNpshImpact === true,
          systemHeadImpact: step.systemHeadImpact === true,
          dataStatus: step.audit?.dataStatus?.status || '',
          literatureReferences: step.literatureReferences || []
        })),
        suction: routeTrace.sections?.suction || null,
        discharge: routeTrace.sections?.discharge || null
      },
      pumpCurveBasis: validation.pumpCurveBasis || null,
      boundaryValidation: validation.boundaryValidation || null,
      traceValidation: validation.traceValidation || null,
      uiEvidenceRegistry: registry,
      literatureEvidence: {
        citationWorkflowVersion: payload.libraryGovernance?.citationPageLockWorkflow?.version || payload.libraryManifest?.citationPageLockWorkflowVersion || '',
        pendingPageLock: (citationStatus.pendingFormulaIds || []).length,
        pageLocked: (citationStatus.pageLockedFormulaIds || []).length,
        compositeTrace: (citationStatus.compositeTraceFormulaIds || []).length,
        routePageLocks: pageLocks
      },
      integrity: {
        calculationId: calculation.calculationId || null,
        dependencyFingerprint: dependency.dependencyFingerprint || null,
        apiAuditEventId: payload.apiAuditEvent?.eventId || null,
        apiAuditLoggedAt: payload.apiAuditEvent?.loggedAt || null,
        routeTraceFingerprint: calculation.routeTraceFingerprint || null,
        resultFingerprint: calculation.resultFingerprint || null,
        releaseIntegrityManifest: payload.securityPosture?.releaseIntegrityManifest || payload.defenseExportContext?.releaseIntegrityManifest || 'npsh-api/docs/release-integrity-manifest.json',
        softwareDependencyChangeGate: dependency.softwareDependencyChangeGate || null,
        staleCalculationPolicy: dependency.staleCalculationPolicy || null
      },
      gapNotes
    };
  }

  function markdownTableRow(cells) {
    return `| ${cells.map((cell) => String(cell ?? '').replace(/\|/g, '/')).join(' | ')} |`;
  }

  function defensePackageMarkdown(pkg = buildDefensePackage()) {
    const evidenceRows = pkg.uiEvidenceRegistry.map((item) => markdownTableRow([
      item.taskWindow,
      item.status,
      item.inputEvidence,
      item.outputEvidence
    ]));
    const routeRows = pkg.routeCalculation.steps.map((step) => markdownTableRow([
      step.order,
      step.id,
      step.type,
      step.stage,
      step.directNpshImpact ? 'yes' : 'no',
      step.systemHeadImpact ? 'yes' : 'no',
      step.formulaGroup,
      (step.literatureReferences || []).join(', ') || '-'
    ]));
    return [
      `# Defense Export Package - ${pkg.pumpId || 'route'}`,
      '',
      `Schema: \`${pkg.schemaVersion}\``,
      '',
      `Package fingerprint: \`${pkg.packageFingerprint}\``,
      '',
      `Readiness: **${pkg.readiness}**`,
      '',
      `Route order: ${pkg.routeOrder}`,
      '',
      `Route trace: ${pkg.routeCalculation.text || '-'}`,
      '',
      '## NPSH Acceptance',
      '',
      markdownTableRow(['NPSHa m', 'NPSHr m', 'Margin m', 'Ratio', 'Required NPSHa m', 'Excess m', 'Reported', 'Expected']),
      markdownTableRow(['---:', '---:', '---:', '---:', '---:', '---:', '---', '---']),
      markdownTableRow([pkg.npshAcceptance.npshaM ?? '-', pkg.npshAcceptance.npshrM ?? '-', pkg.npshAcceptance.marginM ?? '-', pkg.npshAcceptance.ratio ?? '-', pkg.npshAcceptance.requiredNpshaM ?? '-', pkg.npshAcceptance.excessM ?? '-', pkg.npshAcceptance.reportedStatus || '-', pkg.npshAcceptance.expectedStatus || '-']),
      '',
      '## Route Calculation',
      '',
      markdownTableRow(['#', 'Object', 'Type', 'Stage', 'Direct NPSH', 'System head', 'Formula group', 'References']),
      markdownTableRow(['---:', '---', '---', '---', '---', '---', '---', '---']),
      ...(routeRows.length ? routeRows : [markdownTableRow(['-', '-', '-', '-', '-', '-', '-', '-'])]),
      '',
      '## UI Evidence Registry',
      '',
      markdownTableRow(['Task window', 'Status', 'Input evidence', 'Output evidence']),
      markdownTableRow(['---', '---', '---', '---']),
      ...evidenceRows,
      '',
      '## Integrity',
      '',
      `Calculation ID: \`${pkg.integrity.calculationId || '-'}\``,
      '',
      `Dependency fingerprint: \`${pkg.integrity.dependencyFingerprint || '-'}\``,
      '',
      `Release manifest: \`${pkg.integrity.releaseIntegrityManifest || '-'}\``,
      '',
      '## Gap Notes',
      '',
      ...(pkg.gapNotes.length ? pkg.gapNotes.map((note) => `- ${note}`) : ['- No gap notes.']),
      ''
    ].join('\n');
  }

  function defenseEvidenceCsv(pkg = buildDefensePackage()) {
    const headers = ['taskWindow', 'status', 'requiredForDefense', 'inputEvidence', 'outputEvidence', 'packageFingerprint', 'calculationId', 'dependencyFingerprint'];
    const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = pkg.uiEvidenceRegistry.map((item) => ({
      taskWindow: item.taskWindow,
      status: item.status,
      requiredForDefense: item.requiredForDefense === true,
      inputEvidence: item.inputEvidence,
      outputEvidence: item.outputEvidence,
      packageFingerprint: pkg.packageFingerprint,
      calculationId: pkg.integrity.calculationId || '',
      dependencyFingerprint: pkg.integrity.dependencyFingerprint || ''
    }));
    return [
      headers.map(quote).join(','),
      ...rows.map((row) => headers.map((header) => quote(row[header])).join(','))
    ].join('\n');
  }

  function downloadText(filename, mimeType, text) {
    if (typeof document === 'undefined') return false;
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    root.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  function downloadDefenseJson() {
    const pkg = buildDefensePackage();
    return downloadText(`defense-export-package-${pkg.pumpId || 'route'}.json`, 'application/json;charset=utf-8', JSON.stringify(pkg, null, 2));
  }

  function downloadDefenseMarkdown() {
    const pkg = buildDefensePackage();
    return downloadText(`defense-export-package-${pkg.pumpId || 'route'}.md`, 'text/markdown;charset=utf-8', defensePackageMarkdown(pkg));
  }

  function downloadDefenseCsv() {
    const pkg = buildDefensePackage();
    return downloadText(`defense-evidence-registry-${pkg.pumpId || 'route'}.csv`, 'text/csv;charset=utf-8', defenseEvidenceCsv(pkg));
  }

  async function copyDefenseJson() {
    const text = JSON.stringify(buildDefensePackage(), null, 2);
    if (root.navigator?.clipboard?.writeText) {
      await root.navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('engineering-defense-export-package-style')) return;
    const style = document.createElement('style');
    style.id = 'engineering-defense-export-package-style';
    style.textContent = [
      '.defense-export-package-panel{left:clamp(14px,4vw,58px);right:auto;top:104px;width:min(1020px,calc(100vw - 28px));height:min(700px,calc(100dvh - 124px));}',
      '.defense-export-package-panel.task-window-minimized{height:42px!important;min-height:42px;}',
      '.defense-export-package-panel.task-window-minimized .defense-package-body{display:none;}',
      '.defense-package-body{display:flex;flex-direction:column;gap:10px;padding:12px;}',
      '.defense-package-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}',
      '.defense-package-summary div,.defense-evidence-card{min-width:0;padding:8px;border:1px solid #d8e6f2;border-radius:6px;background:#fff;}',
      '.defense-package-summary span,.defense-evidence-card span{display:block;color:#64748b;font-size:10px;line-height:1.2;}',
      '.defense-package-summary strong,.defense-evidence-card strong{display:block;margin-top:2px;color:#123b5a;font-size:12px;line-height:1.25;overflow:hidden;text-overflow:ellipsis;}',
      '.defense-evidence-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}',
      '.defense-evidence-card p{margin:4px 0 0;color:#334155;font-size:10.5px;line-height:1.35;}',
      '.defense-package-section{padding:10px;border:1px solid #d8e6f2;border-radius:6px;background:#fff;}',
      '.defense-package-section h3{margin:0 0 6px;color:#123b5a;font-size:13px;line-height:1.2;}',
      '.defense-package-section p{margin:0 0 5px;color:#334155;font-size:11px;line-height:1.35;}',
      '.defense-package-actions{display:flex;flex-wrap:wrap;gap:6px;}',
      '.defense-package-actions button{padding:6px 8px;border:1px solid #1c4568;border-radius:5px;background:#eef6fc;color:#123b5a;font-size:11px;font-weight:700;cursor:pointer;}',
      '.defense-evidence-badge{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px;padding:6px 8px;border:1px solid #bfd6e8;border-radius:6px;background:#f8fbff;color:#123b5a;font-size:10.5px;line-height:1.3;}',
      '.defense-evidence-badge strong{font-size:11px;}',
      '.defense-evidence-badge[data-status="Missing"]{border-color:#f4b6b6;background:#fff8f8;color:#8a1f1f;}',
      '.defense-evidence-badge[data-status="Review Required"]{border-color:#f2d28a;background:#fffaf0;color:#7a4b00;}',
      '@media (max-width:760px){.defense-package-summary,.defense-evidence-grid{grid-template-columns:1fr;}.defense-export-package-panel{top:76px;height:calc(100dvh - 92px);}}'
    ].join('');
    document.head.appendChild(style);
  }

  function renderPanelBody() {
    const body = document.getElementById(PANEL_BODY_ID);
    if (!body) return;
    const pkg = buildDefensePackage();
    const evidenceCards = pkg.uiEvidenceRegistry.map((item) => `
      <div class="defense-evidence-card">
        <span>${escapeText(item.taskWindow)}</span>
        <strong>${escapeText(item.status)}</strong>
        <p>${escapeText(item.outputEvidence)}</p>
      </div>
    `).join('');
    body.innerHTML = `
      <section class="defense-package-summary">
        <div><span>Readiness</span><strong>${escapeText(pkg.readiness)}</strong></div>
        <div><span>Pump</span><strong>${escapeText(pkg.pumpId || '-')}</strong></div>
        <div><span>Package</span><strong>${escapeText(pkg.packageFingerprint)}</strong></div>
        <div><span>Calculation</span><strong>${escapeText(pkg.integrity.calculationId || '-')}</strong></div>
        <div><span>Dependency</span><strong>${escapeText(shortHash(pkg.integrity.dependencyFingerprint))}</strong></div>
        <div><span>Validation</span><strong>${escapeText(pkg.validationStatus || '-')}</strong></div>
        <div><span>Page locks</span><strong>${escapeText(`${pkg.literatureEvidence.pageLocked || 0} locked / ${pkg.literatureEvidence.pendingPageLock || 0} pending`)}</strong></div>
        <div><span>Evidence</span><strong>${escapeText(`${pkg.summary.uiEvidenceItems} items`)}</strong></div>
      </section>
      <section class="defense-package-section">
        <h3>Route Calculation</h3>
        <p>${escapeText(pkg.routeOrder)}</p>
        <p>${escapeText(pkg.routeCalculation.text || 'Run backend Hydraulic / NPSH Evaluation to populate the route trace.')}</p>
      </section>
      <section class="defense-evidence-grid">${evidenceCards}</section>
      <section class="defense-package-section">
        <h3>Defense Notes</h3>
        <p>${escapeText(pkg.summary.conclusion)}</p>
        <p>${escapeText(pkg.gapNotes.join(' | ') || 'No gap notes.')}</p>
      </section>
      <div class="defense-package-actions">
        <button type="button" data-defense-package-action="json">Download JSON</button>
        <button type="button" data-defense-package-action="markdown">Download Markdown</button>
        <button type="button" data-defense-package-action="csv">Download Evidence CSV</button>
        <button type="button" data-defense-package-action="copy">Copy JSON</button>
        <button type="button" data-defense-package-action="print">Print / Save PDF</button>
      </div>
    `;
  }

  function ensurePanel() {
    if (typeof document === 'undefined') return null;
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'task-window defense-export-package-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="task-window-header defense-package-header">
        <span>Defense Export Package</span>
        <span class="task-window-actions">
          <button class="task-window-minimize" type="button" data-defense-package-minimize aria-label="Minimize defense export package">_</button>
          <button class="task-window-close" type="button" data-defense-package-close aria-label="Close defense export package">X</button>
        </span>
      </div>
      <div class="task-window-body defense-package-body" id="${PANEL_BODY_ID}"></div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener('click', async (event) => {
      const action = event.target?.dataset?.defensePackageAction;
      if (event.target?.matches?.('[data-defense-package-close]')) panel.hidden = true;
      if (event.target?.matches?.('[data-defense-package-minimize]')) panel.classList.toggle('task-window-minimized');
      if (action === 'json') downloadDefenseJson();
      if (action === 'markdown') downloadDefenseMarkdown();
      if (action === 'csv') downloadDefenseCsv();
      if (action === 'print') root.print?.();
      if (action === 'copy') {
        const ok = await copyDefenseJson();
        if (typeof root.showUiToast === 'function') {
          root.showUiToast(ok ? 'Defense package JSON copied.' : 'Clipboard is unavailable.', {
            title: 'Defense Export Package',
            variant: ok ? 'success' : 'warning'
          });
        }
      }
    });
    return panel;
  }

  function openDefensePackagePanel() {
    const panel = ensurePanel();
    if (!panel) return null;
    panel.hidden = false;
    panel.classList.remove('task-window-minimized');
    renderPanelBody();
    return panel;
  }

  function ensureMenuButton() {
    if (typeof document === 'undefined') return false;
    const menu = document.getElementById('dropdown-tools') || document.getElementById('dropdown-view');
    if (!menu || document.getElementById(MENU_BUTTON_ID)) return false;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = MENU_BUTTON_ID;
    button.textContent = 'Defense Export Package';
    button.dataset.i18nText = 'menu.defenseExportPackage';
    button.addEventListener('click', openDefensePackagePanel);
    const anchor = document.getElementById('menu-tools-route-trace-audit') || document.getElementById('menu-tools-export-excel') || menu.firstElementChild;
    if (anchor?.nextSibling) menu.insertBefore(button, anchor.nextSibling);
    else menu.appendChild(button);
    return true;
  }

  function classifyWindowEvidence(windowNode, registry) {
    const text = String(windowNode?.textContent || '').toLowerCase();
    const byId = new Map(registry.map((item) => [item.id, item]));
    if (text.includes('fluid basis')) return byId.get('fluid-basis');
    if (text.includes('src') || text.includes('source')) return byId.get('src-boundary');
    if (text.includes('snk') || text.includes('sink')) return byId.get('snk-boundary');
    if (text.includes('tank') || text.includes('vessel')) return byId.get('tank-vessel');
    if (text.includes('pump') || /\bp-\d+/i.test(text)) return byId.get('pump');
    if (text.includes('valve') || text.includes('pipe') || text.includes('fitting')) {
      return text.includes('discharge') ? byId.get('discharge-pipe-fitting-valve') : byId.get('suction-pipe-fitting-valve');
    }
    return null;
  }

  function refreshTaskWindowEvidenceBadges() {
    if (typeof document === 'undefined') return;
    const registry = buildUiEvidenceRegistry();
    document.querySelectorAll('.persistent-object-properties-task-window, #taskWindow, .task-window').forEach((windowNode) => {
      if (!windowNode || [PANEL_ID, 'engineeringRouteTraceAuditPanel'].includes(windowNode.id)) return;
      const evidence = classifyWindowEvidence(windowNode, registry);
      if (!evidence) return;
      const body = windowNode.querySelector('.object-properties-task-body, .task-window-body') || windowNode;
      let badge = body.querySelector(':scope > .defense-evidence-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'defense-evidence-badge';
        body.insertBefore(badge, body.firstElementChild || null);
      }
      badge.dataset.status = evidence.status;
      badge.innerHTML = `<strong>${escapeText(evidence.taskWindow)}</strong><span>${escapeText(evidence.status)}</span><span>${escapeText(evidence.outputEvidence)}</span>`;
    });
  }

  function refreshVisibleSurfaces() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById(PANEL_ID)?.hidden) renderPanelBody();
    refreshTaskWindowEvidenceBadges();
  }

  function install() {
    ensureStyles();
    ensurePanel();
    ensureMenuButton();
    refreshVisibleSurfaces();
    const installed = {
      panel: typeof document !== 'undefined' && !!document.getElementById(PANEL_ID),
      menuButton: typeof document !== 'undefined' && !!document.getElementById(MENU_BUTTON_ID),
      routeAuditBridge: !!root.EngineeringRouteTraceAudit
    };
    root.__npshDefenseExportPackageInstalled = installed;
    return installed;
  }

  function startInstallLoop() {
    let attempts = 0;
    const timer = root.setInterval(() => {
      attempts += 1;
      const installed = install();
      if ((installed.panel && installed.menuButton && installed.routeAuditBridge) || attempts >= 40) {
        root.clearInterval(timer);
      }
    }, 250);
  }

  const api = {
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    buildDefensePackage,
    buildUiEvidenceRegistry,
    defensePackageMarkdown,
    defenseEvidenceCsv,
    downloadDefenseJson,
    downloadDefenseMarkdown,
    downloadDefenseCsv,
    openDefensePackagePanel,
    refreshVisibleSurfaces,
    install
  };

  root.EngineeringDefenseExportPackage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'complete') startInstallLoop();
    else root.addEventListener?.('load', startInstallLoop, { once: true });
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.(`#${MENU_BUTTON_ID}`)) openDefensePackagePanel();
    });
    const observer = new MutationObserver(() => root.setTimeout(refreshTaskWindowEvidenceBadges, 40));
    root.addEventListener?.('load', () => {
      try {
        observer.observe(document.documentElement, { childList: true, subtree: true });
      } catch (error) {
        root.__npshDefenseExportPackageObserverError = error;
      }
    }, { once: true });
  }
})((typeof window !== 'undefined') ? window : globalThis);
