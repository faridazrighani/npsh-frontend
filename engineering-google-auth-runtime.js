(() => {
  "use strict";

  const LOCK_VERSION = "2026.06-google-access2";
  const GOOGLE_IDENTITY_SCRIPT = "https://accounts.google.com/gsi/client";

  const state = {
    ready: false,
    loading: false,
    googleLoaded: false,
    authenticated: false,
    approved: false,
    user: null,
    message: ""
  };

  let googleScriptPromise = null;
  let sessionPromise = null;
  let controlHostObserver = null;

  const css = `
.npsh-auth-control{margin-left:auto;display:flex;align-items:center;gap:6px;min-height:28px;max-width:min(430px,48vw);padding-left:10px;color:#123b5a}
.npsh-auth-control[data-state="approved"]{color:#0f5132}
.npsh-auth-control[data-state="pending"],.npsh-auth-control[data-state="error"]{color:#7a271a}
.npsh-auth-google-button{display:flex;align-items:center;min-height:28px;overflow:hidden}
.npsh-auth-user{max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid #bcd2e8;border-radius:4px;background:#fff;color:inherit;font-size:11px;font-weight:800;line-height:1;padding:7px 8px}
.npsh-auth-logout{border:1px solid #c5d5e4;border-radius:4px;background:#fff;color:#123b5a;font-size:11px;font-weight:800;line-height:1;padding:7px 8px;cursor:pointer}
.npsh-auth-logout:hover,.npsh-auth-logout:focus-visible{border-color:#1f6fa9;background:#e8f3ff;outline:none}
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
      message: state.message,
      version: LOCK_VERSION
    };
  }

  function setState(next) {
    Object.assign(state, next);
    renderState();
    dispatchState();
  }

  function getElements() {
    return {
      root: document.getElementById("npshAuthControl"),
      googleButton: document.getElementById("npshGoogleButton"),
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
    elements.googleButton.hidden = state.approved || state.loading;
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
          : state.message || "Login required for protected PDF";
    elements.status.title = elements.status.textContent;
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

  async function refreshSession() {
    if (sessionPromise) return sessionPromise;
    sessionPromise = fetch(endpoint("/api/auth/session"), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" }
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
          setState({
            ready: true,
            loading: false,
            authenticated: false,
            approved: false,
            user: null,
            message: ""
          });
          return getPublicState();
        }
        setState({
          ready: true,
          loading: false,
          authenticated: data.authenticated === true,
          approved: data.approved === true,
          user: data.user || null,
          message: ""
        });
        return getPublicState();
      })
      .catch(() => {
        setState({
          ready: true,
          loading: false,
          authenticated: false,
          approved: false,
          user: null,
          message: "Auth API unavailable"
        });
        return getPublicState();
      })
      .finally(() => {
        sessionPromise = null;
      });
    return sessionPromise;
  }

  async function handleCredentialResponse(response) {
    const credential = response?.credential || "";
    if (!credential) {
      setState({ loading: false, message: "Google credential missing" });
      return;
    }

    setState({ loading: true, message: "" });
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
        setState({
          ready: true,
          loading: false,
          authenticated: data.authenticated === true,
          approved: data.approved === true,
          user: data.user || null,
          message: data.message || data.error || "Login failed"
        });
        return;
      }
      setState({
        ready: true,
        loading: false,
        authenticated: true,
        approved: data.approved === true,
        user: data.user || null,
        message: ""
      });
    } catch (error) {
      setState({
        ready: true,
        loading: false,
        authenticated: false,
        approved: false,
        user: null,
        message: error?.message || "Login failed"
      });
    }
  }

  async function renderGoogleButton() {
    const clientId = getClientId();
    const button = document.getElementById("npshGoogleButton");
    if (!button || !clientId || button.dataset.rendered === "true") return;
    try {
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
      setState({ message: error?.message || "Google login unavailable" });
    }
  }

  async function logout() {
    setState({ loading: true, message: "" });
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
        message: ""
      });
      const button = document.getElementById("npshGoogleButton");
      if (button) {
        button.dataset.rendered = "";
        button.textContent = "";
      }
      renderGoogleButton();
    }
  }

  async function requireApproved(options = {}) {
    ensureControl();
    const current = await refreshSession();
    if (current.approved) return true;
    const resource = options.resource ? ` for ${options.resource}` : "";
    setState({
      message: current.authenticated
        ? `Waiting admin approval${resource}`
        : `Login Google required${resource}`
    });
    await renderGoogleButton();
    return false;
  }

  async function init() {
    ensureControl();
    await Promise.allSettled([refreshSession(), renderGoogleButton()]);
  }

  window.NPSHAuth = Object.freeze({
    version: LOCK_VERSION,
    getState: getPublicState,
    refresh: refreshSession,
    requireApproved,
    logout
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
