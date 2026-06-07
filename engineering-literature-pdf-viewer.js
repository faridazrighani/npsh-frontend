(() => {
  "use strict";

  const LOCK_VERSION = "2026.06-literature-pdf-viewer4";
  const PDFJS_SCRIPT = "vendor/pdf.min.js?v=20260606-literature-pdf-viewer3";
  const PDFJS_WORKER = "vendor/pdf.worker.min.js?v=20260606-literature-pdf-viewer3";
  const BOOKS = [
    {
      id: "cengel-fluid-mechanics-3e",
      label: "Cengel - Fluid Mechanics 3rd Ed"
    },
    {
      id: "fox-mcdonald-fluid-mechanics-10e",
      label: "Fox & McDonald - Introduction to Fluid Mechanics 10th Ed"
    },
    {
      id: "grist-cavitation-centrifugal-pump-1998",
      label: "Grist - Cavitation and the Centrifugal Pump"
    },
    {
      id: "hydraulic-institute-npsh-margin-2024",
      label: "Hydraulic Institute - NPSH Margin Guideline 2024"
    }
  ];

  const state = {
    pdfjsPromise: null,
    pdf: null,
    book: null,
    pageNumber: 1,
    zoom: 1,
    rendering: false,
    pendingRender: false
  };

  const css = `
.dropdown-content.dropdown-help-menu{overflow:visible!important}
.literature-submenu-content{min-width:292px!important;max-width:min(420px,calc(100vw - 24px))}
.literature-submenu:focus-within>.literature-submenu-content{display:block!important}
.literature-menu-item{display:flex!important;align-items:center;gap:8px;white-space:nowrap}
.literature-menu-item::before{content:"PDF";display:inline-flex;align-items:center;justify-content:center;width:22px;height:16px;border-radius:2px;background:#d51f2a;color:#fff;font-size:8px;font-weight:800;line-height:1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.42)}
.literature-pdf-window{position:fixed;left:76px;top:82px;width:min(920px,calc(100vw - 44px));height:min(720px,calc(100dvh - 112px));min-width:360px;min-height:320px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);resize:both;overflow:hidden;z-index:3300}
.literature-pdf-window[hidden]{display:none!important}
.literature-pdf-window .task-window-header{cursor:move}
.literature-pdf-toolbar{display:flex;align-items:center;gap:7px;min-height:38px;padding:6px 8px;border-bottom:1px solid #d8e2ec;background:#eef4f8;color:#123b5a}
.literature-pdf-toolbar button{width:30px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #c5d5e4;border-radius:4px;background:#fff;color:#123b5a;cursor:pointer;font-size:13px;font-weight:800;line-height:1}
.literature-pdf-toolbar button:hover,.literature-pdf-toolbar button:focus-visible{border-color:#1f6fa9;background:#e8f3ff;outline:none}
.literature-pdf-toolbar button:disabled{opacity:.45;cursor:not-allowed}
.literature-pdf-page-input{width:58px;height:28px;border:1px solid #c5d5e4;border-radius:4px;background:#fff;color:#0f172a;text-align:center;font-size:12px;font-weight:700}
.literature-pdf-page-total,.literature-pdf-zoom-label{color:#334155;font-size:12px;font-weight:700;white-space:nowrap}
.literature-pdf-spacer{flex:1 1 auto}
.literature-pdf-body{display:flex;flex-direction:column;padding:0;background:#dbe5ec}
.literature-pdf-stage{flex:1 1 auto;min-height:0;overflow:auto;padding:18px;overscroll-behavior:contain;text-align:center;background:#cfdbe4}
.literature-pdf-canvas{display:inline-block;background:#fff;box-shadow:0 10px 28px rgba(15,23,42,.28);user-select:none;-webkit-user-select:none}
.literature-pdf-status{min-height:24px;padding:5px 9px;border-top:1px solid #b9c9d8;background:#f8fafc;color:#475569;font-size:11px;font-weight:700;line-height:1.2}
.literature-pdf-status[data-state="error"]{color:#b91c1c;background:#fff1f2}
@media (max-width:639px){.literature-pdf-window{left:8px!important;top:58px!important;width:calc(100vw - 16px)!important;height:calc(100dvh - 66px)!important;min-width:0;min-height:300px;resize:none}.literature-pdf-stage{padding:10px}.literature-pdf-toolbar{gap:4px;overflow-x:auto}.literature-pdf-toolbar button{width:32px;height:30px}.literature-pdf-window .task-window-title{font-size:12px}}
`;

  function injectStyle() {
    if (document.getElementById("engineering-literature-pdf-viewer-style")) return;
    const style = document.createElement("style");
    style.id = "engineering-literature-pdf-viewer-style";
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

  function getBook(bookId) {
    return BOOKS.find(book => book.id === bookId) || BOOKS[0];
  }

  function buildPdfEndpoint(bookId) {
    return `${getApiBaseUrl()}/api/literature/${encodeURIComponent(bookId)}/pdf`;
  }

  function closeOpenMenus() {
    document.querySelectorAll(".menu-dropdown.show,.dropdown-submenu.show-submenu").forEach(element => {
      element.classList.remove("show", "show-submenu");
    });
  }

  function ensureMenu() {
    const helpDropdown = document.getElementById("dropdown-help");
    if (!helpDropdown) return;
    helpDropdown.classList.add("dropdown-help-menu");

    let submenu = document.getElementById("dropdown-literature");
    if (!submenu) {
      const wrapper = document.createElement("div");
      wrapper.className = "dropdown-submenu dropdown-submenu-flyout literature-submenu";
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.id = "menu-literature";
      trigger.className = "dropdown-submenu-trigger";
      trigger.setAttribute("aria-haspopup", "true");
      trigger.setAttribute("aria-expanded", "false");
      trigger.textContent = "Literature";
      submenu = document.createElement("div");
      submenu.id = "dropdown-literature";
      submenu.className = "dropdown-submenu-content literature-submenu-content";
      wrapper.append(trigger, submenu);
      const diagnostics = document.getElementById("menu-core-diagnostics");
      helpDropdown.insertBefore(wrapper, diagnostics || document.getElementById("menu-about"));
    }

    submenu.textContent = "";
    BOOKS.forEach(book => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "literature-menu-item";
      button.dataset.literatureId = book.id;
      button.textContent = book.label;
      submenu.appendChild(button);
    });

    const wrapper = submenu.closest(".literature-submenu");
    const trigger = document.getElementById("menu-literature");
    if (wrapper && trigger && trigger.dataset.literatureBound !== "true") {
      trigger.dataset.literatureBound = "true";
      const show = () => {
        wrapper.classList.add("show-submenu");
        trigger.setAttribute("aria-expanded", "true");
      };
      const hide = event => {
        if (event?.relatedTarget && wrapper.contains(event.relatedTarget)) return;
        wrapper.classList.remove("show-submenu");
        trigger.setAttribute("aria-expanded", "false");
      };
      trigger.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const isOpen = wrapper.classList.toggle("show-submenu");
        trigger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
      wrapper.addEventListener("pointerenter", show);
      wrapper.addEventListener("pointerleave", hide);
      trigger.addEventListener("focus", show);
    }
  }

  function loadPdfJs() {
    if (window.pdfjsLib?.getDocument) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      return Promise.resolve(window.pdfjsLib);
    }
    if (state.pdfjsPromise) return state.pdfjsPromise;
    state.pdfjsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PDFJS_SCRIPT;
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib?.getDocument) {
          reject(new Error("PDF.js did not initialize."));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error("Unable to load PDF.js."));
      document.body.appendChild(script);
    });
    return state.pdfjsPromise;
  }

  function createViewerWindow() {
    let windowElement = document.getElementById("literaturePdfWindow");
    if (windowElement) return windowElement;

    windowElement = document.createElement("section");
    windowElement.id = "literaturePdfWindow";
    windowElement.className = "task-window literature-pdf-window";
    windowElement.setAttribute("role", "dialog");
    windowElement.setAttribute("aria-modal", "false");
    windowElement.setAttribute("aria-labelledby", "literaturePdfTitle");
    windowElement.tabIndex = -1;
    windowElement.hidden = true;
    windowElement.innerHTML = `
      <div class="task-window-header" id="literaturePdfHeader">
        <h2 class="task-window-title" id="literaturePdfTitle">Literature</h2>
        <div class="task-window-actions">
          <button class="task-window-close" id="literaturePdfClose" type="button" aria-label="Close literature window">X</button>
        </div>
      </div>
      <div class="task-window-body literature-pdf-body">
        <div class="literature-pdf-toolbar" role="toolbar" aria-label="Literature PDF controls">
          <button type="button" id="literaturePrevPage" aria-label="Previous page" title="Previous page">&lt;</button>
          <input class="literature-pdf-page-input" id="literaturePageInput" type="number" min="1" value="1" aria-label="Page number">
          <span class="literature-pdf-page-total" id="literaturePageTotal">/ -</span>
          <span class="literature-pdf-spacer"></span>
          <button type="button" id="literatureZoomOut" aria-label="Zoom out" title="Zoom out">-</button>
          <span class="literature-pdf-zoom-label" id="literatureZoomLabel">100%</span>
          <button type="button" id="literatureZoomIn" aria-label="Zoom in" title="Zoom in">+</button>
        </div>
        <div class="literature-pdf-stage" id="literaturePdfStage">
          <canvas class="literature-pdf-canvas" id="literaturePdfCanvas"></canvas>
        </div>
        <div class="literature-pdf-status" id="literaturePdfStatus" role="status" aria-live="polite">Ready</div>
      </div>
    `;
    document.body.appendChild(windowElement);
    bindViewerWindow(windowElement);
    return windowElement;
  }

  function setStatus(text, type = "ready") {
    const status = document.getElementById("literaturePdfStatus");
    if (!status) return;
    status.textContent = text;
    status.dataset.state = type;
  }

  function updateControls() {
    const total = state.pdf?.numPages || 0;
    const input = document.getElementById("literaturePageInput");
    const totalLabel = document.getElementById("literaturePageTotal");
    const zoomLabel = document.getElementById("literatureZoomLabel");
    const prev = document.getElementById("literaturePrevPage");
    const next = document.getElementById("literatureNextPage");
    if (input) {
      input.value = String(state.pageNumber || 1);
      input.max = String(Math.max(total, 1));
    }
    if (totalLabel) totalLabel.textContent = `/ ${total || "-"}`;
    if (zoomLabel) zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
    if (prev) prev.disabled = state.pageNumber <= 1 || !total;
    if (next) next.disabled = state.pageNumber >= total || !total;
  }

  function clampWindow(windowElement) {
    const margin = 8;
    const rect = windowElement.getBoundingClientRect();
    const width = Math.min(rect.width, window.innerWidth - margin * 2);
    const height = Math.min(rect.height, window.innerHeight - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const top = Math.max(margin, Math.min(rect.top, window.innerHeight - height - margin));
    windowElement.style.left = `${left}px`;
    windowElement.style.top = `${top}px`;
    windowElement.style.width = `${width}px`;
    windowElement.style.height = `${height}px`;
  }

  function bindDrag(windowElement, header) {
    let drag = null;
    header.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      const rect = windowElement.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      header.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    header.addEventListener("pointermove", event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      windowElement.style.left = `${drag.left + event.clientX - drag.startX}px`;
      windowElement.style.top = `${drag.top + event.clientY - drag.startY}px`;
      windowElement.style.right = "auto";
      windowElement.style.bottom = "auto";
      clampWindow(windowElement);
    });
    const stop = event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      try {
        header.releasePointerCapture(event.pointerId);
      } catch {
        /* pointer capture may already be released */
      }
      clampWindow(windowElement);
    };
    header.addEventListener("pointerup", stop);
    header.addEventListener("pointercancel", stop);
  }

  function bindViewerWindow(windowElement) {
    bindDrag(windowElement, document.getElementById("literaturePdfHeader"));
    windowElement.addEventListener("contextmenu", event => event.preventDefault());
    windowElement.addEventListener("keydown", event => {
      const key = String(event.key || "").toLowerCase();
      if ((event.ctrlKey || event.metaKey) && (key === "s" || key === "p")) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
    document.getElementById("literaturePdfClose")?.addEventListener("click", () => {
      windowElement.hidden = true;
      state.pdf = null;
      state.book = null;
    });
    document.getElementById("literaturePrevPage")?.addEventListener("click", () => {
      goToPage(state.pageNumber - 1);
    });
    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.id = "literatureNextPage";
    nextButton.setAttribute("aria-label", "Next page");
    nextButton.title = "Next page";
    nextButton.textContent = ">";
    document.getElementById("literaturePageTotal")?.after(nextButton);
    nextButton.addEventListener("click", () => goToPage(state.pageNumber + 1));
    document.getElementById("literaturePageInput")?.addEventListener("change", event => {
      goToPage(Number.parseInt(event.target.value, 10));
    });
    document.getElementById("literatureZoomOut")?.addEventListener("click", () => {
      setZoom(state.zoom - 0.15);
    });
    document.getElementById("literatureZoomIn")?.addEventListener("click", () => {
      setZoom(state.zoom + 0.15);
    });
    window.addEventListener("resize", () => clampWindow(windowElement), { passive: true });
  }

  async function renderPage() {
    if (!state.pdf || state.rendering) {
      state.pendingRender = Boolean(state.rendering);
      return;
    }
    state.rendering = true;
    state.pendingRender = false;
    updateControls();
    setStatus("Rendering page...");

    try {
      const page = await state.pdf.getPage(state.pageNumber);
      const canvas = document.getElementById("literaturePdfCanvas");
      const context = canvas.getContext("2d");
      const viewport = page.getViewport({ scale: state.zoom });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      await page.render({ canvasContext: context, viewport }).promise;
      setStatus(`${state.book.label} | Page ${state.pageNumber} of ${state.pdf.numPages}`);
    } catch (error) {
      setStatus(error?.message || "Unable to render literature page.", "error");
    } finally {
      state.rendering = false;
      if (state.pendingRender) renderPage();
    }
  }

  function goToPage(pageNumber) {
    if (!state.pdf) return;
    const target = Math.max(1, Math.min(Number.isFinite(pageNumber) ? pageNumber : 1, state.pdf.numPages));
    if (target === state.pageNumber && !state.pendingRender) {
      updateControls();
      return;
    }
    state.pageNumber = target;
    renderPage();
  }

  function setZoom(value) {
    const nextZoom = Math.max(0.45, Math.min(value, 2.4));
    if (Math.abs(nextZoom - state.zoom) < 0.001) return;
    state.zoom = nextZoom;
    renderPage();
  }

  async function openLiterature(bookId) {
    injectStyle();
    const book = getBook(bookId);
    const windowElement = createViewerWindow();
    document.getElementById("literaturePdfTitle").textContent = `Literature: ${book.label}`;
    windowElement.hidden = false;
    windowElement.focus({ preventScroll: true });
    clampWindow(windowElement);
    state.book = book;
    state.pdf = null;
    state.pageNumber = 1;
    state.zoom = 1;
    updateControls();
    setStatus("Opening literature...");

    try {
      if (window.NPSHAuth?.requireApproved) {
        const allowed = await window.NPSHAuth.requireApproved({ resource: book.label });
        if (!allowed) {
          setStatus("Login Google is required and the account must be approved before this PDF can be opened.", "error");
          return;
        }
      }
      const pdfjs = await loadPdfJs();
      const task = pdfjs.getDocument({
        url: buildPdfEndpoint(book.id),
        withCredentials: true,
        disableAutoFetch: true,
        disableStream: false,
        rangeChunkSize: 131072
      });
      state.pdf = await task.promise;
      state.pageNumber = 1;
      updateControls();
      await renderPage();
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("Unexpected server response (401)")) {
        setStatus("Login Google is required before this PDF can be opened.", "error");
        return;
      }
      if (message.includes("Unexpected server response (403)")) {
        setStatus("Your Google account is not approved for this PDF yet.", "error");
        return;
      }
      setStatus(message || "Unable to open literature.", "error");
    }
  }

  function bindMenuEvents() {
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-literature-id]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      closeOpenMenus();
      openLiterature(button.dataset.literatureId);
    });
  }

  function init() {
    injectStyle();
    ensureMenu();
    bindMenuEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.EngineeringLiteraturePdfViewer = Object.freeze({
    version: LOCK_VERSION,
    books: BOOKS.map(book => ({ ...book })),
    open: openLiterature
  });
})();
