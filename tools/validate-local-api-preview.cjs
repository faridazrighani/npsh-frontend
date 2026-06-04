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

const indexHtml = read(INDEX_FILE);
assert(indexHtml.includes('"simulationEndpoint":"/api/simulate"'), "Runtime config must keep /api/simulate as the same-origin endpoint.");
assert(indexHtml.includes('"apiBaseUrl":""'), "Runtime config must use same-origin API base for the API-enabled local preview.");
assert(indexHtml.includes('"backendPrimaryEnabled":true'), "Runtime config must keep backend primary enabled.");

const staticPreview = read(STATIC_PREVIEW_FILE);
assert(staticPreview.includes("!['GET', 'HEAD'].includes"), "Static preview must remain explicitly GET/HEAD only.");
assert(staticPreview.includes("405, 'Method Not Allowed'"), "Static preview must make POST misuse visible as 405.");

const apiPreview = read(API_PREVIEW_FILE);
assert(apiPreview.includes("server.mjs"), "API preview wrapper must start the backend server.mjs.");
assert(apiPreview.includes("NPSH_STATIC_ROOT"), "API preview wrapper must set NPSH_STATIC_ROOT to the frontend directory.");
assert(apiPreview.includes("process.execPath"), "API preview wrapper must launch Node using the current runtime.");
assert(apiPreview.includes("cwd: apiRoot"), "API preview wrapper must run the backend from npsh-api.");
assert(apiPreview.includes("HOST: host"), "API preview wrapper must forward the selected host.");
assert(apiPreview.includes("PORT: String(port)"), "API preview wrapper must forward the selected port.");

const apiServer = read(API_SERVER_FILE);
assert(apiServer.includes("handleApiRequest"), "Backend server must route API requests before static files.");
assert(apiServer.includes("NPSH_STATIC_ROOT"), "Backend server must support serving the frontend through NPSH_STATIC_ROOT.");
assert(apiServer.includes("handleApiRequest(req, res, requestUrl)"), "Backend server must delegate /api/simulate to API handlers.");

console.log("Local API preview validation passed: preview:api serves frontend files and /api/simulate from the backend server.");
