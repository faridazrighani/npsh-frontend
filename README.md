# NPSH Frontend

Static frontend package for `https://npsh.virsim.id/`.

Deploy target:

- Cloudflare Pages at `https://npsh.virsim.id/`
- Pages advanced-mode `_worker.js` proxies `/api/*` to the private `npsh-api` Worker through the `NPSH_API` Service Binding.

Important runtime config:

```json
{"apiBaseUrl":"","simulationEndpoint":"/api/simulate","backendMode":"primary","backendPrimaryEnabled":true,"protectedFrontend":true}
```

Notes:

- This folder is prepared as the public frontend repository.
- This protected bundle requires the private same-origin backend API for hydraulic/NPSH results.
- The local object-formula solver and `core/simulation-engine.js` are not included in the protected public bundle.
- Production Pages must bind `NPSH_API` to the `npsh-api` Worker and then redeploy.
