(() => {
  const root = typeof window !== 'undefined' ? window : globalThis;
  const VERSION = 'engineering-browser-issues-runtime.v1';
  const CACHE_KEY = '20260620-orphan-label-cleanup1';

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

  function repairFormFieldLabels(scope = document) {
    if (!scope?.querySelectorAll) return 0;
    let repaired = 0;
    const labels = new Set([
      ...document.querySelectorAll('label.form-field-a11y-label[id$="-a11y-label"]'),
      ...scope.querySelectorAll('label.form-field-a11y-label[id$="-a11y-label"]')
    ]);
    labels.forEach((label) => {
      const targetId = label.getAttribute('for');
      if (targetId && document.getElementById(targetId)) return;
      label.remove();
      repaired += 1;
    });
    return repaired;
  }

  function repairBrowserIssues(scope = document) {
    return {
      menuRoles: repairMenuRoles(scope),
      formFieldLabels: repairFormFieldLabels(scope)
    };
  }

  function install() {
    if (typeof document === 'undefined') return false;
    if (root.__engineeringBrowserIssuesRuntimeInstalled) {
      repairBrowserIssues(document);
      return false;
    }
    root.__engineeringBrowserIssuesRuntimeInstalled = true;
    repairBrowserIssues(document);
    let pending = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => repairBrowserIssues(document), 80);
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
    repairFormFieldLabels,
    repairBrowserIssues,
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
