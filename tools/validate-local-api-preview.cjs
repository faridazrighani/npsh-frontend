const fs = require("fs");
const path = require("path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(FRONTEND_ROOT, "..");
const API_ROOT = path.join(WORKSPACE_ROOT, "npsh-api");
const PACKAGE_FILE = path.join(FRONTEND_ROOT, "package.json");
const INDEX_FILE = path.join(FRONTEND_ROOT, "index.html");
const STATIC_PREVIEW_FILE = path.join(FRONTEND_ROOT, "tools", "serve-local-preview.cjs");
const API_PREVIEW_FILE = path.join(FRONTEND_ROOT, "tools", "serve-local-api-preview.cjs");
const API_SERVER_FILE = path.join(API_ROOT, "server.mjs");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist.`);
  return fs.readFileSync(filePath, "utf8");
}

const packageJson = JSON.parse(read(PACKAGE_FILE));
assert(
  packageJson.scripts?.["preview:api"] === "node tools/serve-local-api-preview.cjs",
  "package.json must expose preview:api for same-origin frontend + backend API preview."
);
assert(
  packageJson.scripts?.["validate:local-api-preview"] === "node tools/validate-local-api-preview.cjs",
  "package.json must expose validate:local-api-preview."
);
assert(
  packageJson.scripts?.["validate:local-api-preview-single-flight"] === "node tools/validate-local-api-preview-single-flight.cjs",
  "package.json must expose validate:local-api-preview-single-flight."
);

const indexHtml = read(INDEX_FILE);
assert(indexHtml.includes('"simulationEndpoint":"/api/simulate"'), "Runtime config must keep /api/simulate as the same-origin endpoint.");
assert(indexHtml.includes('"apiBaseUrl":""'), "Runtime config must use same-origin API base for the API-enabled local preview.");
assert(indexHtml.includes('"backendPrimaryEnabled":true'), "Runtime config must keep backend primary enabled.");

const staticPreview = read(STATIC_PREVIEW_FILE);
assert(staticPreview.includes("!['GET', 'HEAD'].includes"), "Static preview must remain explicitly GET/HEAD only.");
assert(staticPreview.includes("405, 'Method Not Allowed'"), "Static preview must make POST misuse visible as 405.");
assert(staticPreview.includes("handleLocalLiteratureRequest"), "Static preview must serve the local /api/literature fallback.");
assert(staticPreview.includes("sourceLinksExposed: false"), "Static preview literature fallback must not expose source links.");
assert(staticPreview.includes("parseByteRange"), "Static preview literature fallback must support PDF byte ranges.");
assert(staticPreview.includes("'Accept-Ranges': 'bytes'"), "Static preview literature fallback must expose byte-range support.");
assert(staticPreview.includes("workspaceRoot, 'book_pdf'"), "Static preview literature fallback must read from the local book_pdf folder.");
assert(staticPreview.includes("'.svg': 'image/svg+xml; charset=utf-8'"), "Static preview must serve SVG with utf-8 charset.");
assert(!staticPreview.includes("'X-Frame-Options': 'DENY'"), "Static preview must not emit deprecated X-Frame-Options.");

const apiPreview = read(API_PREVIEW_FILE);
assert(apiPreview.includes("server.mjs"), "API preview wrapper must start the backend server.mjs.");
assert(apiPreview.includes("NPSH_STATIC_ROOT"), "API preview wrapper must set NPSH_STATIC_ROOT to the frontend directory.");
assert(apiPreview.includes("process.execPath"), "API preview wrapper must launch Node using the current runtime.");
assert(apiPreview.includes("cwd: apiRoot"), "API preview wrapper must run the backend from npsh-api.");
assert(apiPreview.includes("HOST: host"), "API preview wrapper must forward the selected host.");
assert(apiPreview.includes("PORT: String(port)"), "API preview wrapper must forward the selected port.");
assert(apiPreview.includes("npsh-local-api-preview-locks"), "API preview wrapper must coordinate concurrent Playwright webServer starts with a local lock.");
assert(apiPreview.includes("waitForHealth"), "API preview wrapper must wait for an already-starting server instead of binding the same port twice.");
assert(apiPreview.includes("Reusing existing NPSH preview server"), "API preview wrapper must explicitly reuse an existing healthy preview server.");

const apiServer = read(API_SERVER_FILE);
assert(apiServer.includes("handleApiRequest"), "Backend server must route API requests before static files.");
assert(apiServer.includes("NPSH_STATIC_ROOT"), "Backend server must support serving the frontend through NPSH_STATIC_ROOT.");
assert(apiServer.includes("handleApiRequest(req, res, requestUrl)"), "Backend server must delegate /api/simulate to API handlers.");
assert(apiServer.includes("['.svg', 'image/svg+xml; charset=utf-8']"), "Backend static preview must serve SVG with utf-8 charset.");
assert(apiServer.includes("public, max-age=31536000, immutable"), "Backend static preview must cache immutable cache-busted assets.");
assert(apiServer.includes("frame-ancestors 'none'"), "Backend static preview must protect HTML framing with CSP.");

console.log("Local API preview validation passed: preview:api serves frontend files and /api/simulate from the backend server; static preview serves local /api/literature PDFs.");
