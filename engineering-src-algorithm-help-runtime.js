(() => {
  "use strict";

  const LOCK_VERSION = "2026.06-src-algorithm-help1";
  const WINDOW_ID = "srcAlgorithmTaskWindow";

  const css = `
.dropdown-content.dropdown-help-menu{overflow:visible!important}
.hydraulic-logic-submenu-content{min-width:224px!important;max-width:min(340px,calc(100vw - 24px))}
.hydraulic-logic-submenu:focus-within>.hydraulic-logic-submenu-content{display:block!important}
.hydraulic-logic-menu-item{display:flex!important;align-items:center;gap:8px;white-space:nowrap}
.hydraulic-logic-menu-item::before{content:"SRC";display:inline-flex;align-items:center;justify-content:center;width:28px;height:16px;border-radius:2px;background:#123b5a;color:#fff;font-size:8px;font-weight:800;line-height:1;box-shadow:inset 0 0 0 1px rgba(255,255,255,.38)}
.src-algorithm-window{position:fixed!important;left:72px!important;top:86px!important;right:auto!important;width:min(820px,calc(100vw - 44px))!important;height:min(700px,calc(100dvh - 112px))!important;min-width:360px;min-height:330px;max-width:calc(100vw - 16px)!important;max-height:calc(100dvh - 16px)!important;resize:both;overflow:hidden;z-index:3320!important}
.src-algorithm-window[hidden]{display:none!important}
.src-algorithm-window.task-window-minimized{height:42px!important;min-height:42px!important;resize:none}
.src-algorithm-window.task-window-minimized .src-algorithm-body{display:none!important}
.src-algorithm-window .task-window-header{cursor:move}
.src-algorithm-body{display:block;padding:0!important;background:#f6f8fb!important}
.src-algorithm-scroll{height:100%;overflow:auto;padding:14px;overscroll-behavior:contain;color:#0f172a}
.src-algorithm-document{max-width:960px;margin:0 auto}
.src-algorithm-kicker{margin:0 0 3px;color:#64748b;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.src-algorithm-title{margin:0;color:#0b2545;font-size:22px;font-weight:800;line-height:1.22}
.src-algorithm-subtitle{margin:7px 0 12px;color:#475569;font-size:13px;line-height:1.45}
.src-algorithm-card{margin:10px 0;padding:11px 12px;border:1px solid #d8e2ec;border-radius:6px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.src-algorithm-card h3{margin:0 0 8px;color:#1f6fa9;font-size:16px;line-height:1.25}
.src-algorithm-card p{margin:6px 0;color:#1f2937;font-size:13px;line-height:1.48}
.src-algorithm-note{border-color:#c7d3e2;background:#f4f7fb}
.src-algorithm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.src-algorithm-mode{min-width:0;padding:9px;border:1px solid #d8e2ec;border-radius:6px;background:#fbfdff}
.src-algorithm-mode h4{margin:0 0 5px;color:#123b5a;font-size:13px}
.src-algorithm-mode p{margin:0;color:#334155;font-size:12px;line-height:1.42}
.src-algorithm-table-wrap{max-width:100%;overflow-x:auto;margin:7px 0 2px}
.src-algorithm-table{width:100%;min-width:640px;border-collapse:collapse;background:#fff;font-size:12px;table-layout:fixed}
.src-algorithm-table th,.src-algorithm-table td{border:1px solid #aeb7c2;padding:6px 7px;vertical-align:top;line-height:1.36}
.src-algorithm-table th{background:#e8eef5;color:#0b2545;font-weight:800;text-align:left}
.src-algorithm-table td:first-child,.src-algorithm-table th:first-child{width:34px;text-align:center}
.src-algorithm-caption{margin:8px 0 4px;color:#595959;font-size:12px;font-weight:800}
.src-algorithm-equation{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;margin:9px 0;padding:8px 10px;border:1px solid #d8e2ec;border-radius:6px;background:#fff}
.src-algorithm-math{min-width:0;overflow-x:auto;color:#0b2545;font-family:"Cambria Math","Times New Roman",serif;font-size:18px;text-align:center;white-space:nowrap}
.src-algorithm-eqno{color:#475569;font-size:12px;font-weight:800;white-space:nowrap}
.src-algorithm-refs{margin:4px 0 0;padding-left:18px;color:#334155;font-size:12px;line-height:1.45}
.src-algorithm-refs li{margin:4px 0}
.src-algorithm-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px}
.src-algorithm-pill{display:inline-flex;align-items:center;min-height:22px;padding:3px 7px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#334155;font-size:11px;font-weight:800}
@media (max-width:760px){.src-algorithm-window{left:8px!important;top:58px!important;width:calc(100vw - 16px)!important;height:calc(100dvh - 66px)!important;min-width:0;min-height:300px;resize:none}.src-algorithm-scroll{padding:8px}.src-algorithm-title{font-size:18px}.src-algorithm-grid{grid-template-columns:1fr}.src-algorithm-table{min-width:620px}.src-algorithm-math{font-size:15px;text-align:left}.src-algorithm-equation{grid-template-columns:1fr;gap:4px}.src-algorithm-eqno{text-align:right}}
`;

  function hasDocument() {
    return typeof document !== "undefined" && document.body;
  }

  function injectStyle() {
    if (!hasDocument() || document.getElementById("engineering-src-algorithm-help-style")) return;
    const style = document.createElement("style");
    style.id = "engineering-src-algorithm-help-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function closeOpenMenus() {
    if (!hasDocument()) return;
    document.querySelectorAll(".menu-dropdown.show,.dropdown-submenu.show-submenu").forEach(element => {
      element.classList.remove("show", "show-submenu");
      const trigger = element.querySelector(":scope > .dropdown-submenu-trigger");
      trigger?.setAttribute("aria-expanded", "false");
    });
  }

  function clampWindowToViewport(element) {
    if (!element || typeof window === "undefined") return;
    const rect = element.getBoundingClientRect();
    const margin = window.innerWidth <= 760 ? 8 : 10;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const currentLeft = Number.parseFloat(element.style.left || String(rect.left));
    const currentTop = Number.parseFloat(element.style.top || String(rect.top));
    element.style.left = `${Math.max(margin, Math.min(maxLeft, currentLeft))}px`;
    element.style.top = `${Math.max(margin, Math.min(maxTop, currentTop))}px`;
    element.style.right = "auto";
    element.style.bottom = "auto";
  }

  function bringToFront(element) {
    if (!element) return;
    const openWindows = [...document.querySelectorAll(".task-window")];
    const highest = openWindows.reduce((max, node) => {
      const z = Number.parseInt(getComputedStyle(node).zIndex || "0", 10);
      return Number.isFinite(z) ? Math.max(max, z) : max;
    }, 3320);
    element.style.zIndex = String(Math.max(highest + 1, 3321));
  }

  function bindDrag(windowElement, header) {
    if (!windowElement || !header || header.dataset.srcAlgorithmDragBound === "true") return;
    header.dataset.srcAlgorithmDragBound = "true";
    let drag = null;
    header.addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      const rect = windowElement.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      windowElement.classList.add("task-window-user-positioned");
      bringToFront(windowElement);
      header.setPointerCapture?.(event.pointerId);
    });
    header.addEventListener("pointermove", event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const margin = window.innerWidth <= 760 ? 8 : 10;
      const maxLeft = Math.max(margin, window.innerWidth - windowElement.offsetWidth - margin);
      const maxTop = Math.max(margin, window.innerHeight - windowElement.offsetHeight - margin);
      windowElement.style.left = `${Math.max(margin, Math.min(maxLeft, event.clientX - drag.offsetX))}px`;
      windowElement.style.top = `${Math.max(margin, Math.min(maxTop, event.clientY - drag.offsetY))}px`;
      windowElement.style.right = "auto";
      windowElement.style.bottom = "auto";
    });
    const endDrag = event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag = null;
      header.releasePointerCapture?.(event.pointerId);
    };
    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);
  }

  function buildWindowMarkup() {
    return `
      <div class="task-window-header" id="srcAlgorithmTaskWindowHeader">
        <h2 class="task-window-title" id="srcAlgorithmTaskWindowTitle">SRC Algorithm - Hydraulic Logic</h2>
        <div class="task-window-actions">
          <button class="task-window-minimize" id="srcAlgorithmTaskWindowMinimize" type="button" aria-label="Minimize SRC Algorithm window" title="Minimize">_</button>
          <button class="task-window-close" id="srcAlgorithmTaskWindowClose" type="button" aria-label="Close SRC Algorithm window" title="Close">X</button>
        </div>
      </div>
      <div class="task-window-body src-algorithm-body">
        <div class="src-algorithm-scroll">
          <article class="src-algorithm-document">
            <p class="src-algorithm-kicker">Hydraulic Logic</p>
            <h1 class="src-algorithm-title">SRC Flow Input Mode</h1>
            <p class="src-algorithm-subtitle">Ringkasan lampiran teknis untuk menjelaskan posisi Source Boundary (SRC), rumus head awal, dan konsekuensi tiga mode input flow.</p>

            <section class="src-algorithm-card src-algorithm-note">
              <h3>Konsep utama SRC</h3>
              <p>SRC adalah boundary hidrolik sisi hulu. SRC memberi kondisi energi awal sistem melalui tekanan absolut, elevasi, dan bila relevan velocity head. SRC bukan pipe, valve, atau fitting, sehingga rugi-rugi baru dihitung setelah fluida melewati elemen suction menuju pompa [1][2].</p>
            </section>

            <section class="src-algorithm-card">
              <h3>Persamaan dasar</h3>
              <div class="src-algorithm-equation">
                <span class="src-algorithm-math">P<sub>abs</sub> = P<sub>input</sub> &nbsp; untuk basis Absolute</span>
                <span class="src-algorithm-eqno">(A-1)</span>
              </div>
              <div class="src-algorithm-equation">
                <span class="src-algorithm-math">P<sub>abs</sub> = P<sub>gauge</sub> + P<sub>atm</sub></span>
                <span class="src-algorithm-eqno">(A-2)</span>
              </div>
              <div class="src-algorithm-equation">
                <span class="src-algorithm-math">H<sub>SRC</sub> = P<sub>abs,SRC</sub> / (rho g) + z<sub>SRC</sub> + H<sub>V,SRC</sub></span>
                <span class="src-algorithm-eqno">(A-3)</span>
              </div>
              <p>NPSH memakai pressure head absolut terhadap vapor pressure, sehingga basis gauge harus dikonversi menjadi absolut sebelum dipakai dalam algoritma [1][3].</p>
            </section>

            <section class="src-algorithm-card">
              <h3>Flow Input Mode</h3>
              <div class="src-algorithm-grid" aria-label="SRC Flow Input Mode cards">
                <div class="src-algorithm-mode">
                  <h4>Solve from Network</h4>
                  <p>SRC tidak memberi Q fixed. Solver mencari operating point Q* dari perpotongan kurva pompa dan kurva sistem.</p>
                </div>
                <div class="src-algorithm-mode">
                  <h4>Mass Flow</h4>
                  <p>User mengunci laju massa. Algoritma mengonversi ke debit volumetrik: Q = m_dot / rho.</p>
                </div>
                <div class="src-algorithm-mode">
                  <h4>Volumetric Flow</h4>
                  <p>User mengunci debit volumetrik. Perubahan pressure/elevation SRC mengubah head dan NPSHa, tetapi Q tetap.</p>
                </div>
              </div>
              <p class="src-algorithm-caption">Tabel A.1. Logika tiga pilihan Flow Input Mode pada SRC.</p>
              <div class="src-algorithm-table-wrap">
                <table class="src-algorithm-table">
                  <thead>
                    <tr><th>No.</th><th>Mode</th><th>Definisi algoritma</th><th>Konsekuensi teknik</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>1</td><td>Solve from Network</td><td>Cari Q* sehingga H_pump(Q*) = H_system(Q*).</td><td>Pressure/elevation SRC dapat menggeser Q, loss, NPSHa, dan system head. NPSHr tetap manual input.</td></tr>
                    <tr><td>2</td><td>Mass Flow</td><td>Q = m_dot / rho. Laju massa menjadi input fixed.</td><td>Jika rho berubah, Q hasil konversi ikut berubah; loss dan NPSHa ikut berubah. NPSHr tetap manual input.</td></tr>
                    <tr><td>3</td><td>Volumetric Flow</td><td>Q = Q_input. Debit volumetrik menjadi input fixed.</td><td>Q tetap; H_SRC dan NPSHa berubah ketika pressure/elevation berubah.</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="src-algorithm-card">
              <h3>Urutan algoritma yang dikunci</h3>
              <p class="src-algorithm-caption">Tabel A.2. Alur perhitungan dari input SRC sampai output NPSH.</p>
              <div class="src-algorithm-table-wrap">
                <table class="src-algorithm-table">
                  <thead>
                    <tr><th>No.</th><th>Langkah</th><th>Output antara</th><th>Catatan kontrol</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>1</td><td>Baca sourceType dan boundaryDataSource.</td><td>Model boundary aktif.</td><td>Inherited source memakai data equipment terkait.</td></tr>
                    <tr><td>2</td><td>Ambil Fluid Basis aktif.</td><td>rho, nu, P_v, g.</td><td>Custom temperature dapat mengubah properti fluida.</td></tr>
                    <tr><td>3</td><td>Konversi tekanan menjadi P_abs.</td><td>P_abs,SRC.</td><td>Gauge harus ditambah P_atm.</td></tr>
                    <tr><td>4</td><td>Bangun H_SRC dari pressure head, elevation head, dan velocity head.</td><td>H_SRC.</td><td>SRC menjadi boundary head, bukan suction loss.</td></tr>
                    <tr><td>5</td><td>Tentukan Q menurut Flow Input Mode.</td><td>Q fixed atau Q solved.</td><td>Volumetric/Mass fixed; Network mencari operating point.</td></tr>
                    <tr><td>6</td><td>Hitung suction loss, NPSHa, system head, margin.</td><td>Status NPSH dan catatan validasi.</td><td>NPSHa berasal dari sistem; NPSHr berasal dari pompa [3][4].</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="src-algorithm-equation">
                <span class="src-algorithm-math">NPSH<sub>a</sub> = H<sub>SRC</sub> - h<sub>L,s</sub>(Q) - z<sub>pump</sub> - H<sub>vap</sub></span>
                <span class="src-algorithm-eqno">(A-4)</span>
              </div>
              <div class="src-algorithm-equation">
                <span class="src-algorithm-math">M<sub>NPSH</sub> = NPSH<sub>a</sub> - NPSH<sub>r</sub> ; R<sub>NPSH</sub> = NPSH<sub>a</sub> / NPSH<sub>r</sub></span>
                <span class="src-algorithm-eqno">(A-5)</span>
              </div>
            </section>

            <section class="src-algorithm-card">
              <h3>Dampak perubahan input</h3>
              <p class="src-algorithm-caption">Tabel A.3. Dampak perubahan input SRC terhadap hasil utama.</p>
              <div class="src-algorithm-table-wrap">
                <table class="src-algorithm-table">
                  <thead>
                    <tr><th>No.</th><th>Perubahan input</th><th>Fixed-flow mode</th><th>Solve from Network</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>1</td><td>P_abs,SRC naik</td><td>Q tetap; H_SRC dan NPSHa naik.</td><td>Q dapat berubah karena kurva sistem bergeser.</td></tr>
                    <tr><td>2</td><td>z_SRC naik</td><td>Q tetap; NPSHa naik sebesar delta z jika loss dan vapor pressure tetap.</td><td>Q dapat berubah karena kurva sistem bergeser.</td></tr>
                    <tr><td>3</td><td>flow naik pada Volumetric Flow</td><td>Q naik; velocity, Reynolds, loss, NPSHa, dan system head berubah. NPSHr tetap manual input.</td><td>Tidak berlaku sebagai input fixed.</td></tr>
                    <tr><td>4</td><td>massFlow naik pada Mass Flow</td><td>Q = m_dot/rho naik; loss dan NPSHa berubah. NPSHr tetap manual input.</td><td>Tidak berlaku sebagai input fixed.</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="src-algorithm-card src-algorithm-note">
              <h3>Guardrail</h3>
              <p>P_abs,SRC harus lebih besar dari nol dan dievaluasi terhadap vapor pressure. Jika source fixed flow, downstream pressure, dan pump curve semuanya fixed, tampilkan residual/over-specified boundary, bukan memaksa semua kondisi benar diam-diam.</p>
              <div class="src-algorithm-actions">
                <span class="src-algorithm-pill">Boundary head</span>
                <span class="src-algorithm-pill">Fixed-flow lock</span>
                <span class="src-algorithm-pill">Operating-point solve</span>
                <span class="src-algorithm-pill">NPSH margin</span>
              </div>
            </section>

            <section class="src-algorithm-card">
              <h3>Referensi</h3>
              <ol class="src-algorithm-refs">
                <li>Cengel, Y. A., &amp; Cimbala, J. M. Fluid Mechanics: Fundamentals and Applications, 3rd ed.</li>
                <li>Fox, McDonald, Pritchard, &amp; Mitchell. Introduction to Fluid Mechanics, 10th ed.</li>
                <li>Hydraulic Institute. ANSI/HI 9.6.1-2024 Rotodynamic Pumps - Guideline for NPSH Margin.</li>
                <li>Grist, E. Cavitation and the Centrifugal Pump.</li>
              </ol>
            </section>
          </article>
        </div>
      </div>
    `;
  }

  function createWindow() {
    let windowElement = document.getElementById(WINDOW_ID);
    if (windowElement) return windowElement;
    windowElement = document.createElement("section");
    windowElement.id = WINDOW_ID;
    windowElement.className = "task-window src-algorithm-window task-window-user-positioned";
    windowElement.dataset.kind = "src-algorithm";
    windowElement.setAttribute("role", "dialog");
    windowElement.setAttribute("aria-modal", "false");
    windowElement.setAttribute("aria-labelledby", "srcAlgorithmTaskWindowTitle");
    windowElement.tabIndex = -1;
    windowElement.innerHTML = buildWindowMarkup();
    document.body.appendChild(windowElement);

    const header = document.getElementById("srcAlgorithmTaskWindowHeader");
    const minimize = document.getElementById("srcAlgorithmTaskWindowMinimize");
    const close = document.getElementById("srcAlgorithmTaskWindowClose");
    bindDrag(windowElement, header);
    minimize?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      windowElement.classList.toggle("task-window-minimized");
      minimize.textContent = windowElement.classList.contains("task-window-minimized") ? "+" : "_";
      minimize.setAttribute("aria-label", windowElement.classList.contains("task-window-minimized") ? "Restore SRC Algorithm window" : "Minimize SRC Algorithm window");
      clampWindowToViewport(windowElement);
    });
    close?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      windowElement.remove();
    });
    windowElement.addEventListener("pointerdown", () => bringToFront(windowElement));
    window.addEventListener("resize", () => clampWindowToViewport(windowElement), { passive: true });
    window.addEventListener("orientationchange", () => clampWindowToViewport(windowElement), { passive: true });
    return windowElement;
  }

  function openSrcAlgorithmWindow() {
    if (!hasDocument()) return null;
    injectStyle();
    const windowElement = createWindow();
    windowElement.hidden = false;
    windowElement.classList.remove("task-window-minimized");
    const minimize = document.getElementById("srcAlgorithmTaskWindowMinimize");
    if (minimize) {
      minimize.textContent = "_";
      minimize.setAttribute("aria-label", "Minimize SRC Algorithm window");
    }
    bringToFront(windowElement);
    clampWindowToViewport(windowElement);
    closeOpenMenus();
    window.setTimeout(() => windowElement.focus({ preventScroll: true }), 0);
    return windowElement;
  }

  function bindHydraulicLogicMenu() {
    if (!hasDocument()) return;
    injectStyle();
    const helpDropdown = document.getElementById("dropdown-help");
    const wrapper = document.querySelector(".hydraulic-logic-submenu");
    const trigger = document.getElementById("menu-hydraulic-logic");
    const action = document.getElementById("menu-src-algorithm");
    if (!helpDropdown || !wrapper || !trigger || !action) return;
    helpDropdown.classList.add("dropdown-help-menu");
    if (trigger.dataset.srcAlgorithmBound !== "true") {
      trigger.dataset.srcAlgorithmBound = "true";
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
        wrapper.classList.add("show-submenu");
        trigger.setAttribute("aria-expanded", "true");
      });
      wrapper.addEventListener("pointerenter", show);
      wrapper.addEventListener("pointerleave", hide);
      trigger.addEventListener("focus", show);
      wrapper.addEventListener("focusout", hide);
    }
    if (action.dataset.srcAlgorithmBound !== "true") {
      action.dataset.srcAlgorithmBound = "true";
      action.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        openSrcAlgorithmWindow();
      });
    }
  }

  function install() {
    if (!hasDocument()) return;
    bindHydraulicLogicMenu();
  }

  if (typeof window !== "undefined") {
    window.EngineeringSrcAlgorithmHelp = {
      version: "engineering-src-algorithm-help.v1",
      cacheKey: LOCK_VERSION,
      install,
      openSrcAlgorithmWindow
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      version: "engineering-src-algorithm-help.v1",
      cacheKey: LOCK_VERSION,
      windowId: WINDOW_ID
    };
  }

  if (hasDocument()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", install, { once: true });
    } else {
      install();
    }
  }
})();
