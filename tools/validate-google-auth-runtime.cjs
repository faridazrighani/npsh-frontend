const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(FRONTEND_ROOT, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const index = read("index.html");
const authRuntime = read("engineering-google-auth-runtime.js");
const literatureRuntime = read("engineering-literature-pdf-viewer.js");
const packageJson = JSON.parse(read("package.json"));
const manifest = read("FILE_MANIFEST.md");

assert(index.includes('"googleClientId":"941768542541-kos89u2knlv2vus0ctotclaq0850dsq1.apps.googleusercontent.com"'), "Runtime config must include the public Google OAuth client ID.");
assert(index.includes("engineering-google-auth-runtime.js?v=20260607-google-access2"), "Index must load the cache-busted Google auth runtime.");
assert(
  index.indexOf("engineering-google-auth-runtime.js?v=20260607-google-access2") < index.indexOf("engineering-src-canvas-parameter-runtime.js"),
  "Google auth runtime must load before deferred/blocking app support scripts so the login control is available immediately."
);
assert(index.includes("engineering-literature-pdf-viewer.js?v=20260607-literature-pdf-viewer4"), "Index must load the auth-aware literature viewer.");

assert(authRuntime.includes("https://accounts.google.com/gsi/client"), "Auth runtime must load Google Identity Services.");
assert(authRuntime.includes("google.accounts.id.initialize"), "Auth runtime must initialize Google Identity Services.");
assert(authRuntime.includes("google.accounts.id.renderButton"), "Auth runtime must render the Google sign-in button.");
assert(authRuntime.includes("/api/auth/google"), "Auth runtime must post Google credentials to the backend.");
assert(authRuntime.includes("/api/auth/session"), "Auth runtime must read the backend session.");
assert(authRuntime.includes("/api/auth/logout"), "Auth runtime must support logout.");
assert(authRuntime.includes("credentials: \"include\""), "Auth runtime must send and receive HttpOnly session cookies.");
assert(authRuntime.includes("requireApproved"), "Auth runtime must expose an approval guard.");
assert(authRuntime.includes("window.NPSHAuth"), "Auth runtime must expose NPSHAuth.");

assert(literatureRuntime.includes("window.NPSHAuth?.requireApproved"), "Literature viewer must require an approved Google app session before opening PDFs.");
assert(literatureRuntime.includes("Unexpected server response (401)"), "Literature viewer must translate backend login failures into a clear UI message.");
assert(literatureRuntime.includes("Unexpected server response (403)"), "Literature viewer must translate backend approval failures into a clear UI message.");

assert(
  packageJson.scripts?.["validate:google-auth-runtime"] === "node tools/validate-google-auth-runtime.cjs",
  "package.json must expose validate:google-auth-runtime."
);
assert(
  manifest.includes("Google auth runtime cache key: engineering-google-auth-runtime.js?v=20260607-google-access2"),
  "Manifest must document the Google auth runtime cache key."
);

console.log("Google auth runtime validation passed.");
