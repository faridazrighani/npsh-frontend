# NPSH Frontend Deployment

Repository visibility: public.

Deploy target: same-origin application host.

Current live topology recommendation:

```text
https://npsh.virsim.id/      Cloudflare Pages frontend
https://npsh.virsim.id/api/* Cloudflare Pages Function proxy to npsh-api Worker
```

Custom domain:

```text
npsh.virsim.id
```

Upload order:

1. Upload this updated frontend package to Cloudflare Pages.
2. Deploy the private Worker from `npsh-api/worker.mjs`.
3. In the `npsh-frontend` Pages project, add a production Service Binding:

```text
Variable name: NPSH_API
Service: npsh-api
Environment: production
```

4. Redeploy `npsh-frontend` so `_worker.js` and the binding are active.
5. Verify `https://npsh.virsim.id/api/health`.
6. Open `https://npsh.virsim.id/` and run a thesis validation case.

Protected runtime:

```json
{"apiBaseUrl":"","simulationEndpoint":"/api/simulate","backendMode":"primary","backendPrimaryEnabled":true,"protectedFrontend":true}
```

Google-approved literature runtime:

```text
Public Client ID: 941768542541-kos89u2knlv2vus0ctoclaq0850dsq1.apps.googleusercontent.com
Frontend runtime: engineering-google-auth-runtime.js
Backend session: /api/auth/google, /api/auth/session, /api/auth/logout
Protected PDF path: /api/literature/*/pdf
```

Do not add Apps Script secrets, GitHub tokens, or session secrets to this public frontend package. Those values belong only in the private `npsh-api` Worker environment.

Important:

- Do not upload source maps with source content; `app.bundle.min.js.map` is a public-safe self-map stub for PageSpeed diagnostics.
- Do not add backend formula/source files to this public repository.
- If the API is offline, protected calculations will not run.
- GitHub Pages alone cannot serve the protected `/api/*` backend; use a same-origin app host or an equivalent edge route for `/api/*`.
- Cloudflare Pages can remain the frontend host when `_worker.js` proxies `/api/*` to the `NPSH_API` Service Binding.
- If the Cloudflare account later has access to the `virsim.id` zone, a direct Worker route `npsh.virsim.id/api/*` is also valid, but the current account can use the Pages Function proxy without owning the zone.
