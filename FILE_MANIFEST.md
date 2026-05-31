# Frontend File Manifest

Date: 2026-05-31

Folder:

```text
C:\Users\Zfaryana\Desktop\npshs\npsh-frontend
```

Purpose:

- Protected public static package for `https://npsh.virsim.id/`.
- Requires the private same-origin API at `https://npsh.virsim.id/api/*`.

Summary:

```text
Total files: 143
Total size: 63,247,647 bytes
```

Top-level contents:

```text
.gitignore              upload guardrail
.nojekyll               compatibility marker for static hosts
CNAME                   custom domain: npsh.virsim.id
DEPLOYMENT.md           frontend deployment runbook
FILE_MANIFEST.md        local folder inventory
README.md               public package overview
UPLOAD_READINESS.md     readiness checklist
index.html              static app entry
app.bundle.min.js       protected frontend bundle
app.bundle.min.js.map   public-safe self source map stub, no sourcesContent
engineering-bilingual-improvements.js bilingual engineering terminology, trace-key registry, runtime UI workflow localization, and diagnostics overlay
engineering-library-governance.js public-safe library manifest, trace schema, unit/fluid/equipment/literature governance, OCR terminology, formula-literature map, and quality gates
engineering-route-trace-audit.js public-safe backend route-trace audit bridge, dependency fingerprint handoff, stale-result metadata capture, advanced engineering validation display, defense export context capture, backend schema mismatch warning, and software dependency-change gate display
engineering-defense-export-package.js public-safe one-click defense report exporter, UI evidence registry, task-window evidence badges, redacted audit event handoff, and print/save PDF workflow
style.min.css           minified styles
png/                    public images and favicon
toolbar/                public toolbar icons
vendor/                 browser libraries for PDF/OCR/export
journals/               public case data, analysis reports, and audit summaries
```

Protected-bundle guardrail:

```text
calculatePumpSystemHead: 0
calculateDarcy: 0
calculateReynolds: 0
hydraulic-network-formulas: 0
pump-formulas: 0
pipe-formulas: 0
```

Release integrity guardrail:

```text
node npsh-api/tools/release-integrity-audit.cjs
app.bundle.min.js.map sourcesContent: absent
Route audit cache key: engineering-route-trace-audit.js?v=20260531-auditv7
Defense export cache key: engineering-defense-export-package.js?v=20260531-defensev2
Runtime API config: same-origin /api/simulate
```

Do not add to this folder:

- backend formula source
- `core/simulation-engine.js`
- `.env`
- source maps with source content
- unbundled frontend source files
- public PDF files
- private keys or certificates
- local logs or test outputs
- `desktop.ini`
