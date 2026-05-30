# Frontend File Manifest

Date: 2026-05-29

Folder:

```text
C:\Users\Zfaryana\Desktop\Hysys\npsh-frontend
```

Purpose:

- Protected public static package for `https://npsh.virsim.id/`.
- Requires the private API at `https://npsh-api.virsim.id`.

Summary:

```text
Total files: 83
Total size: 56,736,544 bytes
```

Top-level contents:

```text
.gitignore              upload guardrail
.nojekyll               disable GitHub Pages Jekyll processing
CNAME                   custom domain: npsh.virsim.id
DEPLOYMENT.md           frontend deployment runbook
FILE_MANIFEST.md        local folder inventory
README.md               public package overview
UPLOAD_READINESS.md     readiness checklist
index.html              static app entry
app.bundle.min.js       protected frontend bundle
engineering-bilingual-improvements.js bilingual engineering terminology, trace-key registry, runtime UI workflow localization, and diagnostics overlay
engineering-library-governance.js public-safe library manifest, trace schema, unit/fluid/equipment/literature governance, OCR terminology, formula-literature map, and quality gates
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

Do not add to this folder:

- backend formula source
- `core/simulation-engine.js`
- `.env`
- source maps
- unbundled frontend source files
- public PDF files
- private keys or certificates
- local logs or test outputs
- `desktop.ini`
