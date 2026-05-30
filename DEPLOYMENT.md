# NPSH Frontend Deployment

Repository visibility: public.

Deploy target: GitHub Pages.

Custom domain:

```text
npsh.virsim.id
```

Upload order:

1. Deploy the private `npsh-api` service first.
2. Verify `https://npsh-api.virsim.id/api/health`.
3. Upload this frontend repository to GitHub.
4. Enable GitHub Pages from the repository root.
5. Confirm GitHub Pages uses the `CNAME` file in this folder.
6. Open `https://npsh.virsim.id/` and run a thesis validation case.

Protected runtime:

```json
{"apiBaseUrl":"https://npsh-api.virsim.id","simulationEndpoint":"","backendMode":"primary","backendPrimaryEnabled":true,"protectedFrontend":true}
```

Important:

- Do not upload source maps.
- Do not add backend formula/source files to this public repository.
- If the API is offline, protected calculations will not run.
