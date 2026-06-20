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
const GOOGLE_AUTH_CACHE_KEY = "engineering-google-auth-runtime.js?v=20260620-google-auth-lazy1";
const LITERATURE_CACHE_KEY = "engineering-literature-pdf-viewer.js?v=20260609-literature-access3";

assert(index.includes('"googleClientId":"941768542541-kos89u2knlv2vus0ctotclaq0850dsq1.apps.googleusercontent.com"'), "Runtime config must include the public Google OAuth client ID.");
assert(index.includes('"googleAuthorizedOrigins":["https://npsh.virsim.id","https://npsh-frontend.pages.dev"]'), "Runtime config must list Google-authorized production and Pages origins.");
assert(index.includes(GOOGLE_AUTH_CACHE_KEY), "Index must load the cache-busted Google auth runtime.");
assert(
  !index.includes(`<script src="${GOOGLE_AUTH_CACHE_KEY}"></script>`),
  "Google auth runtime must not load as an initial render-path script."
);
assert(
  index.indexOf(GOOGLE_AUTH_CACHE_KEY) > index.indexOf("const featureScripts = ["),
  "Google auth runtime must be deferred in the support feature script group."
);
assert(
  index.indexOf(GOOGLE_AUTH_CACHE_KEY) < index.indexOf(LITERATURE_CACHE_KEY),
  "Google auth runtime must load before the auth-aware Literature PDF viewer."
);
assert(index.includes(LITERATURE_CACHE_KEY), "Index must load the auth-aware literature viewer.");

assert(authRuntime.includes("https://accounts.google.com/gsi/client"), "Auth runtime must load Google Identity Services.");
assert(authRuntime.includes("google.accounts.id.initialize"), "Auth runtime must initialize Google Identity Services.");
assert(authRuntime.includes("google.accounts.id.renderButton"), "Auth runtime must render the Google sign-in button.");
assert(authRuntime.includes("DEFAULT_GOOGLE_AUTHORIZED_ORIGINS"), "Auth runtime must keep an explicit Google authorized-origin allow list.");
assert(authRuntime.includes("https://npsh-frontend.pages.dev"), "Auth runtime must allow the live Pages testing origin.");
assert(authRuntime.includes("isGoogleOriginAllowed"), "Auth runtime must guard Google Identity Services by current browser origin.");
assert(authRuntime.includes("getGoogleOriginBlockedMessage"), "Auth runtime must show a sanitized message when the current origin is not OAuth-authorized.");
assert(authRuntime.includes("button.dataset.rendered = \"blocked-origin\""), "Auth runtime must not load the Google button on unauthorized preview origins.");
assert(!authRuntime.includes("if (isLocalPreviewOrigin(normalized)) return true;"), "Auth runtime must not bypass Google OAuth origin checks for local preview.");
assert(authRuntime.includes("/api/auth/google"), "Auth runtime must post Google credentials to the backend.");
assert(authRuntime.includes("/api/auth/session"), "Auth runtime must read the backend session.");
assert(authRuntime.includes("/api/auth/logout"), "Auth runtime must support logout.");
assert(authRuntime.includes("credentials: \"include\""), "Auth runtime must send and receive HttpOnly session cookies.");
assert(authRuntime.includes("requireApproved"), "Auth runtime must expose an approval guard.");
assert(authRuntime.includes("window.NPSHAuth"), "Auth runtime must expose NPSHAuth.");
assert(authRuntime.includes("refreshSession({ force: true })"), "Auth runtime must verify the HttpOnly app session immediately after Google login.");
assert(authRuntime.includes("sessionRequestId"), "Auth runtime must prevent stale session refreshes from overwriting a new Google login result.");
assert(authRuntime.includes("bindSessionWakeups"), "Auth runtime must re-check the app session after returning focus from Google login.");
assert(authRuntime.includes("elements.googleButton.hidden = state.authenticated || state.loading"), "Auth runtime must hide the sign-in button once an app session is authenticated.");
assert(authRuntime.includes("getFriendlyAuthError"), "Auth runtime must sanitize browser/OAuth errors before showing them in the UI.");
assert(authRuntime.includes("sanitizeStatusMessage"), "Auth runtime must sanitize every displayed auth status message.");
assert(authRuntime.includes("describeAuthError"), "Auth runtime must map backend auth error codes into actionable messages.");
assert(authRuntime.includes("diagnose"), "Auth runtime must expose a console diagnostic helper for session/origin checks.");
assert(authRuntime.includes("access_database_not_configured"), "Auth runtime must distinguish missing Apps Script approval database configuration.");
assert(authRuntime.includes("user_pending_approval"), "Auth runtime must distinguish pending user approval.");
assert(authRuntime.includes("invalid_google_audience"), "Auth runtime must distinguish backend Google Client ID mismatch.");
assert(!authRuntime.includes("message: error?.message || \"Login failed\""), "Auth runtime must not expose raw login fetch errors.");
assert(!authRuntime.includes("message: error?.message || \"Google login unavailable\""), "Auth runtime must not expose raw Google render errors.");

assert(literatureRuntime.includes("window.NPSHAuth?.requireApproved"), "Literature viewer must require an approved Google app session before opening PDFs.");
assert(literatureRuntime.includes("bindAuthRetryEvents"), "Literature viewer must retry a pending PDF after auth state becomes approved.");
assert(literatureRuntime.includes("refreshApprovedSession"), "Literature viewer must re-check auth before showing stale 401 PDF errors.");
assert(literatureRuntime.includes("Unexpected server response (401)"), "Literature viewer must translate backend login failures into a clear UI message.");
assert(literatureRuntime.includes("Unexpected server response (403)"), "Literature viewer must translate backend approval failures into a clear UI message.");

assert(
  packageJson.scripts?.["validate:google-auth-runtime"] === "node tools/validate-google-auth-runtime.cjs",
  "package.json must expose validate:google-auth-runtime."
);
assert(
  manifest.includes(`Google auth runtime cache key: ${GOOGLE_AUTH_CACHE_KEY}`),
  "Manifest must document the Google auth runtime cache key."
);

console.log("Google auth runtime validation passed.");
