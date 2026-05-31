# NPSH Frontend

Static frontend package for `https://npsh.virsim.id/`.

Deploy target:

- Same-origin application host at `https://npsh.virsim.id/`
- Served by the private backend service static root, with API calls going to `/api/*`

Important runtime config:

```json
{"apiBaseUrl":"","simulationEndpoint":"/api/simulate","backendMode":"primary","backendPrimaryEnabled":true,"protectedFrontend":true}
```

Notes:

- This folder is prepared as the public frontend repository.
- This protected bundle requires the private same-origin backend API for hydraulic/NPSH results.
- The local object-formula solver and `core/simulation-engine.js` are not included in the protected public bundle.
