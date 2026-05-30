# NPSH Frontend

Static frontend package for `https://npsh.virsim.id/`.

Deploy target:

- GitHub Pages

Important runtime config:

```json
{"apiBaseUrl":"https://npsh-api.virsim.id","simulationEndpoint":"","backendMode":"primary","backendPrimaryEnabled":true,"protectedFrontend":true}
```

Notes:

- This folder is prepared as the public frontend repository.
- This protected bundle requires the private backend API for hydraulic/NPSH results.
- The local object-formula solver and `core/simulation-engine.js` are not included in the protected public bundle.
