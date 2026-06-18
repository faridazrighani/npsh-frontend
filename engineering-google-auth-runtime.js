(() => {
  "use strict";

  const LOCK_VERSION = "2026.06-google-access8";
  const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";
  const DEFAULT_GOOGLE_AUTHORIZED_ORIGINS = [
    "https://npsh.virsim.id",
    "https://npsh-frontend.pages.dev"
  ];
  const AUTH_ERROR_MESSAGES = Object.freeze({
    app_login_required: "Login Google diperlukan sebelum PDF dapat dibuka.",
    app_user_not_approved: "Email Google sudah login, tetapi belum approved di access database.",
    auth_api_unavailable: "Auth API belum dapat dihubungi. Cek koneksi backend /api/auth/session.",
    auth_session_secret_missing: "Backend belum memiliki NPSH_AUTH_SESSION_SECRET.",
    access_database_failed: "Access database Apps Script menolak request backend.",
    access_database_invalid_response: "Access database Apps Script mengembalikan response yang tidak valid.",
    access_database_not_configured: "Backend belum memiliki NPSH_ACCESS_DATABASE_URL dan/atau NPSH_ACCESS_DATABASE_SECRET.",
    expired_google_token: "Token Google sudah kadaluarsa. Silakan login ulang.",
    frontend_google_client_id_missing: "Frontend runtime belum memiliki Google Client ID.",
    google_client_id_missing: "Backend belum memiliki NPSH_AUTH_GOOGLE_CLIENT_ID.",
    google_credential_missing: "Credential Google tidak diterima oleh aplikasi.",
    google_email_not_verified: "Email Google belum terverifikasi.",
    google_key_not_found: "Google signing key belum ditemukan. Coba login ulang.",
    google_keys_unavailable: "Backend belum dapat mengambil Google public keys.",
    invalid_google_audience: "Google Client ID backend tidak cocok dengan token login.",
    invalid_google_credential: "Credential Google tidak valid.",
    invalid_google_issuer: "Google token issuer tidak valid.",
    invalid_google_signature: "Signature token Google tidak valid.",
    literature_login_required: "Login Google diperlukan sebelum PDF literature dibuka.",
    literature_source_unavailable: "Sumber PDF private belum dapat diakses backend. Cek token book_pdf.",
    user_pending_approval: "Email Google sudah login, tetapi belum approved di access database."
  });

  const state = {
    ready: false,
    loading: false,
    googleLoaded: false,
    authenticated: false,
    approved: false,
    user: null,
    error: "",
    message: ""
  };

  let googleScriptPromise = null;
  let sessionPromise = null;
  let sessionRequestId = 0;
  let controlHostObserver = null;

  const css = `
.npsh-auth-control{margin-left:auto;display:flex;align-items:center;gap:6px;min-height:28px;max-width:min(430px,48vw);padding-left:10px;color:#123b5a}
.npsh-auth-control[data-state="approved"]{color:#0f5132}
.npsh-auth-control[data-state="pending"],.npsh-auth-control[data-state="error"]{color:#7a271a}
.npsh-auth-google-button{display:flex;align-items:center;min-height:28px;overflow:hidden}
.npsh-auth-user{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid #bcd2e8;border-radius:4px;background:#fff;color:inherit;font-size:11px;font-weight:800;line-height:1;padding:7px 8px}
.npsh-auth-signin,.npsh-auth-logout{border:1px solid #c5d5e4;border-radius:4px;background:#fff;color:#123b5a;font-size:11px;font-weight:800;line-height:1;padding:7px 8px;cursor:pointer}
.npsh-auth-signin:hover,.npsh-auth-signin:focus-visible,.npsh-auth-logout:hover,.npsh-auth-logout:focus-visible{border-color:#1f6fa9;background:#e8f3ff;outline:none}
.npsh-auth-status{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:800}
@media (max-width:760px){.npsh-auth-control{order:99;flex:0 0 auto;margin-left:0;max-width:100%;padding-left:0}.npsh-auth-status{display:none}.npsh-auth-user{max-width:160px}}
`;

  function injectStyle() {
    if (document.getElementById("npsh-google-auth-style")) return;
    const style = document.createElement("style");
    style.id = "npsh-google-auth-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function getRuntimeConfig() {
    try {
      return JSON.parse(document.getElementById("npsh-runtime-config")?.textContent || "{}");
    } catch {
      return {};
    }
  }

  function getApiBaseUrl() {
    return String(getRuntimeConfig().apiBaseUrl || "").replace(/\/+$/, "");
  }

  function endpoint(path) {
    return `${getApiBaseUrl()}${path}`;
  }

  function getClientId() {
    return String(getRuntimeConfig().googleClientId || getRuntimeConfig().authGoogleClientId || "").trim();
  }

  function getAuthorizedGoogleOrigins() {
    const config = getRuntimeConfig();
    const configured = config.googleAuthorizedOrigins || config.authGoogleAuthorizedOrigins || [];
    const origins = Array.isArray(configured) ? configured : String(configured || "").split(",");
    return [...new Set([...DEFAULT_GOOGLE_AUTHORIZED_ORIGINS, ...origins]
      .map(origin => String(origin || "").trim().replace(/\/+$/, ""))
      .filter(Boolean))];
  }

  function maskClientId(clientId) {
    const text = String(clientId || "").trim();
    if (!text) return "";
    if (text.length <= 34) return text;
    return `${text.slice(0, 12)}...${text.slice(-26)}`;
  }

  function isGoogleOriginAllowed(origin = window.location?.origin || "") {
    const normalized = String(origin || "").trim().replace(/\/+$/, "");
    if (!normalized) return false;
    return getAuthorizedGoogleOrigins().includes(normalized);
  }

  function getGoogleOriginBlockedMessage() {
    return "Google login dinonaktifkan pada origin ini. Gunakan domain production atau tambahkan origin ini di Google Cloud OAuth dan runtime config.";
  }

  function describeAuthError(errorCode, message = "", fallback = "Google login unavailable") {
    const code = String(errorCode || "").trim();
    const mapped = code ? AUTH_ERROR_MESSAGES[code] : "";
    return mapped || sanitizeStatusMessage(message) || fallback;
  }

  function getFriendlyAuthError(error, fallback = "Google login unavailable") {
    const message = String(error?.message || error || "").trim();
    if (!message) return fallback;
    if (/Fetch API cannot load|Failed to fetch|NetworkError|Load failed/i.test(message)) {
      return "Google login belum dapat dimuat. Refresh halaman atau izinkan accounts.google.com.";
    }
    if (/invalid_client|OAuth client/i.test(message)) {
      return "Google OAuth Client ID tidak valid.";
    }
    return fallback;
  }

  function sanitizeStatusMessage(message) {
    const text = String(message || "").trim();
    if (!text) return "";
    if (/Fetch API cannot load|Failed to fetch|NetworkError|Load failed/i.test(text)) {
      return "Google login belum dapat dimuat. Refresh halaman atau izinkan accounts.google.com.";
    }
    if (/^941768542541-|apps\.googleusercontent\.com/i.test(text)) {
      return "Google login belum dapat dimuat. Refresh halaman atau coba login lagi.";
    }
    return text;
  }

  function dispatchState() {
    document.dispatchEvent(new CustomEvent("npsh-auth-state", {
      detail: getPublicState()
    }));
  }

  function getPublicState() {
    return {
      ready: state.ready,
      loading: state.loading,
      authenticated: state.authenticated,
      approved: state.approved,
      user: state.user ? { ...state.user } : null,
      error: state.error,
      message: state.message,
      googleLoaded: state.googleLoaded,
      originAllowed: isGoogleOriginAllowed(),
      version: LOCK_VERSION
    };
  }

  function setState(next) {
    if (Object.prototype.hasOwnProperty.call(next, "error")) {
      next.error = String(next.error || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(next, "message")) {
      next.message = sanitizeStatusMessage(next.message);
    }
    Object.assign(state, next);
    renderState();
    dispatchState();
  }

  function getElements() {
    return {
      root: document.getElementById("npshAuthControl"),
      googleButton: document.getElementById("npshGoogleButton"),
      signInButton: document.getElementById("npshAuthSignIn"),
      userButton: document.getElementById("npshAuthUser"),
      logoutButton: document.getElementById("npshAuthLogout"),
      status: document.getElementById("npshAuthStatus")
    };
  }

  function placeControl(root) {
    const menuBar = document.querySelector(".menu-bar");
    if (menuBar && root.parentElement !== menuBar) {
      menuBar.appendChild(root);
      return;
    }
    if (!root.parentElement && document.body) {
      document.body.prepend(root);
    }
  }

  function observeControlHost(root) {
    if (controlHostObserver || !window.MutationObserver || !document.body) return;
    controlHostObserver = new MutationObserver(() => placeControl(root));
    controlHostObserver.observe(document.body, { childList: true, subtree: true });
  }

  function renderState() {
    const elements = getElements();
    if (!elements.root || !elements.googleButton || !elements.userButton || !elements.logoutButton || !elements.status) return;
    const tone = state.approved ? "approved" : state.authenticated ? "pending" : state.message ? "error" : "ready";
    elements.root.dataset.state = tone;
    elements.googleButton.hidden = state.authenticated || state.loading;
    if (elements.signInButton) elements.signInButton.hidden = state.authenticated || state.loading || elements.googleButton.dataset.rendered === "true";
    elements.userButton.hidden = !state.authenticated;
    elements.logoutButton.hidden = !state.authenticated;
    elements.userButton.textContent = state.user?.email || "Signed in";
    elements.userButton.title = state.user?.name ? `${state.user.name} (${state.user.email})` : state.user?.email || "Signed in";
    elements.status.textContent = state.loading
      ? "Checking access..."
      : state.approved
        ? `Approved: ${state.user?.role || "user"}`
        : state.authenticated
          ? "Waiting approval"
      : sanitizeStatusMessage(state.message) || "Login required for protected PDF";
    elements.status.title = elements.status.textContent;
  }

  function renderSignInFallback(button = document.getElementById("npshGoogleButton")) {
    if (!button || button.dataset.rendered === "true") return;
    button.dataset.rendered = "";
    button.textContent = "";
    const fallback = document.createElement("button");
    fallback.type = "button";
    fallback.id = "npshAuthSignIn";
    fallback.className = "npsh-auth-signin";
    fallback.textContent = "Sign in";
    fallback.title = "Sign in with Google";
    fallback.addEventListener("click", requestGoogleButton);
    button.appendChild(fallback);
  }

  function requestGoogleButton(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    renderGoogleButton();
  }

  function ensureControl() {
    injectStyle();
    let root = document.getElementById("npshAuthControl");
    if (root) {
      placeControl(root);
      observeControlHost(root);
      return root;
    }

    root = document.createElement("div");
    root.id = "npshAuthControl";
    root.className = "npsh-auth-control";
    root.setAttribute("aria-live", "polite");
    root.innerHTML = `
      <div class="npsh-auth-google-button" id="npshGoogleButton"></div>
      <button type="button" class="npsh-auth-user" id="npshAuthUser" title="Signed in" hidden></button>
      <button type="button" class="npsh-auth-logout" id="npshAuthLogout" title="Sign out" hidden>Sign out</button>
      <span class="npsh-auth-status" id="npshAuthStatus">Login required for protected PDF</span>
    `;

    placeControl(root);
    observeControlHost(root);

    document.getElementById("npshAuthLogout")?.addEventListener("click", logout);
    renderSignInFallback(document.getElementById("npshGoogleButton"));
    renderState();
    return root;
  }

  function loadGoogleScript() {
    if (window.google?.accounts?.id) {
      state.googleLoaded = true;
      return Promise.resolve(window.google);
    }
    if (googleScriptPromise) return googleScriptPromise;
    googleScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (!window.google?.accounts?.id) {
          reject(new Error("Google Identity Services did not initialize."));
          return;
        }
        state.googleLoaded = true;
        resolve(window.google);
      };
      script.onerror = () => reject(new Error("Unable to load Google Identity Services."));
      document.head.appendChild(script);
    });
    return googleScriptPromise;
  }

  async function refreshSession(options = {}) {
    if (sessionPromise && !options.force) return sessionPromise;
    const requestId = ++sessionRequestId;
    sessionPromise = fetch(endpoint("/api/auth/session"), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" }
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (requestId !== sessionRequestId) return getPublicState();
        if (!response.ok || data.ok === false) {
          const errorCode = String(data.error || (response.status ? `http_${response.status}` : "")).trim();
          setState({
            ready: true,
            loading: false,
            authenticated: false,
            approved: false,
            user: null,
            error: errorCode,
            message: describeAuthError(errorCode, data.message || data.error || "", "")
          });
          return getPublicState();
        }
        setState({
          ready: true,
          loading: false,
          authenticated: data.authenticated === true,
          approved: data.approved === true,
          user: data.user || null,
          error: "",
          message: ""
        });
        return getPublicState();
      })
      .catch(() => {
        if (requestId !== sessionRequestId) return getPublicState();
        setState({
          ready: true,
          loading: false,
          authenticated: false,
          approved: false,
          user: null,
          error: "auth_api_unavailable",
          message: describeAuthError("auth_api_unavailable")
        });
        return getPublicState();
      })
      .finally(() => {
        if (requestId === sessionRequestId) sessionPromise = null;
      });
    return sessionPromise;
  }

  async function handleCredentialResponse(response) {
    const credential = response?.credential || "";
    if (!credential) {
      setState({
        loading: false,
        error: "google_credential_missing",
        message: describeAuthError("google_credential_missing")
      });
      return;
    }

    setState({ loading: true, error: "", message: "" });
    try {
      const loginResponse = await fetch(endpoint("/api/auth/google"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ credential })
      });
      const data = await loginResponse.json().catch(() => ({}));
      if (!loginResponse.ok || data.ok === false) {
        const errorCode = String(data.error || (loginResponse.status ? `http_${loginResponse.status}` : "")).trim();
        setState({
          ready: true,
          loading: false,
          authenticated: data.authenticated === true,
          approved: data.approved === true,
          user: data.user || null,
          error: errorCode,
          message: describeAuthError(errorCode, data.message || data.error || "", "Login failed")
        });
        return;
      }
      setState({
        ready: true,
        loading: false,
        authenticated: true,
        approved: data.approved === true,
        user: data.user || null,
        error: "",
        message: ""
      });
      await refreshSession({ force: true });
    } catch (error) {
      setState({
        ready: true,
        loading: false,
        authenticated: false,
        approved: false,
        user: null,
        error: "login_request_failed",
        message: getFriendlyAuthError(error, "Login failed")
      });
    }
  }

  async function renderGoogleButton() {
    const clientId = getClientId();
    const button = document.getElementById("npshGoogleButton");
    if (!button || button.dataset.rendered === "true") return;
    if (!clientId) {
      button.dataset.rendered = "missing-client-id";
      setState({
        ready: true,
        loading: false,
        authenticated: false,
        approved: false,
        user: null,
        error: "frontend_google_client_id_missing",
        message: describeAuthError("frontend_google_client_id_missing")
      });
      return;
    }
    if (!isGoogleOriginAllowed()) {
      button.dataset.rendered = "blocked-origin";
      button.textContent = "";
      setState({
        ready: true,
        loading: false,
        authenticated: false,
        approved: false,
        user: null,
        error: "google_origin_not_authorized",
        message: getGoogleOriginBlockedMessage()
      });
      return;
    }
    try {
      button.textContent = "";
      const google = await loadGoogleScript();
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      google.accounts.id.renderButton(button, {
        type: "standard",
        theme: "outline",
        size: "medium",
        text: "signin_with",
        shape: "rectangular"
      });
      button.dataset.rendered = "true";
    } catch (error) {
      if (button.childElementCount > 0 || button.textContent.trim()) {
        button.dataset.rendered = "true";
        if (/Fetch API cannot load/i.test(String(error?.message || ""))) {
          setState({ error: "", message: "" });
          return;
        }
      }
      setState({ error: "google_button_render_failed", message: getFriendlyAuthError(error) });
    }
  }

  async function logout() {
    setState({ loading: true, error: "", message: "" });
    try {
      await fetch(endpoint("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
    } finally {
      setState({
        ready: true,
        loading: false,
        authenticated: false,
        approved: false,
        user: null,
        error: "",
        message: ""
      });
      const button = document.getElementById("npshGoogleButton");
      if (button) {
        button.dataset.rendered = "";
        renderSignInFallback(button);
      }
      renderState();
    }
  }

  async function requireApproved(options = {}) {
    ensureControl();
    if (!isGoogleOriginAllowed()) {
      setState({
        ready: true,
        loading: false,
        authenticated: false,
        approved: false,
        user: null,
        error: "google_origin_not_authorized",
        message: getGoogleOriginBlockedMessage()
      });
      return false;
    }
    const current = await refreshSession();
    if (current.approved) return true;
    const resource = options.resource ? ` untuk ${options.resource}` : "";
    setState({
      error: current.error || (current.authenticated ? "user_pending_approval" : "app_login_required"),
      message: current.message || (current.authenticated
        ? `Menunggu admin approval${resource}`
        : `Login Google diperlukan${resource}`)
    });
    await renderGoogleButton();
    return false;
  }

  async function diagnose(options = {}) {
    const report = {
      schema: "npsh-google-auth-diagnostics.v1",
      version: LOCK_VERSION,
      checkedAt: new Date().toISOString(),
      origin: window.location?.origin || "",
      apiBaseUrl: getApiBaseUrl() || "(same-origin)",
      sessionEndpoint: endpoint("/api/auth/session"),
      clientIdConfigured: Boolean(getClientId()),
      clientId: maskClientId(getClientId()),
      authorizedOrigins: getAuthorizedGoogleOrigins(),
      originAllowed: isGoogleOriginAllowed(),
      googleLoaded: Boolean(window.google?.accounts?.id) || state.googleLoaded,
      googleButtonRendered: document.getElementById("npshGoogleButton")?.dataset.rendered || "",
      state: getPublicState(),
      session: null,
      checks: []
    };
    const addCheck = (id, pass, evidence, remediation = "-") => {
      report.checks.push({
        id,
        status: pass ? "pass" : "fail",
        evidence,
        remediation: pass ? "-" : remediation
      });
    };
    addCheck(
      "frontend-google-client-id",
      report.clientIdConfigured,
      report.clientIdConfigured ? `clientId=${report.clientId}` : "clientId missing",
      "Set googleClientId/authGoogleClientId in the frontend runtime config."
    );
    addCheck(
      "browser-origin-authorized",
      report.originAllowed,
      `origin=${report.origin}; allowed=${report.authorizedOrigins.join(", ")}`,
      "Add the browser origin to Google Cloud OAuth Authorized JavaScript origins and frontend googleAuthorizedOrigins."
    );
    try {
      const response = await fetch(report.sessionEndpoint, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      const errorCode = String(data.error || "").trim();
      report.session = {
        httpStatus: response.status,
        ok: data.ok === true,
        authenticated: data.authenticated === true,
        approved: data.approved === true,
        status: data.status || data.user?.status || "",
        role: data.user?.role || "",
        userEmail: data.user?.email || "",
        error: errorCode,
        message: sanitizeStatusMessage(data.message || "")
      };
      addCheck(
        "auth-session-endpoint",
        response.ok && data.ok !== false,
        `HTTP ${response.status}; authenticated=${report.session.authenticated}; approved=${report.session.approved}`,
        describeAuthError(errorCode, data.message || data.error || "", "Check /api/auth/session backend routing.")
      );
      addCheck(
        "approved-app-session",
        report.session.approved === true,
        `authenticated=${report.session.authenticated}; approved=${report.session.approved}; user=${report.session.userEmail || "-"}`,
        report.session.authenticated
          ? "Approve this email in the Apps Script access database."
          : "Click Sign in with Google, then re-run await window.NPSHAuth.diagnose()."
      );
    } catch (error) {
      report.session = {
        httpStatus: 0,
        ok: false,
        authenticated: false,
        approved: false,
        error: "auth_api_unavailable",
        message: getFriendlyAuthError(error, describeAuthError("auth_api_unavailable"))
      };
      addCheck(
        "auth-session-endpoint",
        false,
        report.session.message,
        "Check same-origin /api route, backend deployment, and Cloudflare Pages Worker proxy."
      );
    }
    if (options.log !== false) console.log("NPSH Google auth diagnostics", report);
    return report;
  }

  function bindSessionWakeups() {
    window.addEventListener("focus", () => {
      if (!state.loading) refreshSession().catch(() => {});
    }, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && !state.loading) {
        refreshSession().catch(() => {});
      }
    });
  }

  async function init() {
    ensureControl();
    bindSessionWakeups();
    if (!isGoogleOriginAllowed()) {
      setState({
        ready: true,
        loading: false,
        authenticated: false,
        approved: false,
        user: null,
        error: "google_origin_not_authorized",
        message: getGoogleOriginBlockedMessage()
      });
      return;
    }
    await refreshSession();
  }

  window.NPSHAuth = Object.freeze({
    version: LOCK_VERSION,
    getState: getPublicState,
    refresh: refreshSession,
    requireApproved,
    isGoogleOriginAllowed,
    describeError: describeAuthError,
    diagnose,
    logout
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
