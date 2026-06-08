(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'engineering-browser-issues-runtime.v1';
  const CACHE_KEY = '20260608-browser-issues1';

  function repairMenuRoles(scope = document) {
    if (!scope?.querySelectorAll) return 0;
    let repaired = 0;
    const objectMenu = scope.querySelector('#toolbarObjectMenu') || document.getElementById('toolbarObjectMenu');
    if (objectMenu) {
      const items = objectMenu.querySelectorAll('.toolbar-object-menu-item');
      if (items.length > 0) {
        objectMenu.setAttribute('role', 'menu');
        objectMenu.querySelectorAll('.toolbar-object-menu-section').forEach((section) => {
          section.setAttribute('role', 'group');
        });
        items.forEach((item) => item.setAttribute('role', 'menuitem'));
      } else {
        objectMenu.removeAttribute('role');
      }
      repaired += 1;
    }

    document.querySelectorAll('[role="menu"]').forEach((menu) => {
      if (menu.querySelector('[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="group"]')) return;
      menu.removeAttribute('role');
      repaired += 1;
    });
    return repaired;
  }

  function install() {
    if (typeof document === 'undefined') return false;
    if (root.__engineeringBrowserIssuesRuntimeInstalled) {
      repairMenuRoles(document);
      return false;
    }
    root.__engineeringBrowserIssuesRuntimeInstalled = true;
    repairMenuRoles(document);
    let pending = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => repairMenuRoles(document), 80);
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
    root.__engineeringBrowserIssuesRuntimeObserver = observer;
    return true;
  }

  const api = {
    version: VERSION,
    cacheKey: CACHE_KEY,
    repairMenuRoles,
    install
  };

  root.EngineeringBrowserIssuesRuntime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
