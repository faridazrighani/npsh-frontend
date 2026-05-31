# NPSH Frontend Deployment

Repository visibility: public.

Deploy target: same-origin application host.

Current live topology recommendation:

```text
https://npsh.virsim.id/      Cloudflare Pages frontend
https://npsh.virsim.id/api/* Cloudflare Worker backend route
```

Custom domain:

```text
npsh.virsim.id
```

Upload order:

1. Upload this updated frontend package to Cloudflare Pages.
2. Deploy the private Worker from `npsh-api/worker.mjs`.
3. Attach the Worker route `npsh.virsim.id/api/*` in the `virsim.id` zone.
4. Verify `https://npsh.virsim.id/api/health`.
5. Open `https://npsh.virsim.id/` and run a thesis validation case.

Protected runtime:

```json
{"apiBaseUrl":"","simulationEndpoint":"/api/simulate","backendMode":"primary","backendPrimaryEnabled":true,"protectedFrontend":true}
```

Important:

- Do not upload source maps with source content; `app.bundle.min.js.map` is a public-safe self-map stub for PageSpeed diagnostics.
- Do not add backend formula/source files to this public repository.
- If the API is offline, protected calculations will not run.
- GitHub Pages alone cannot serve the protected `/api/*` backend; use a same-origin app host or an equivalent edge route for `/api/*`.
- Cloudflare Pages can remain the frontend host if `/api/*` is served by the Cloudflare Worker route.
