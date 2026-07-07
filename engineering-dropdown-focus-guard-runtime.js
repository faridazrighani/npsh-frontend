/*
 * Dropdown Focus Guard Runtime
 * Prevents Chromium aria-hidden warnings by releasing focus before a menu is hidden.
 */
(function dropdownFocusGuardFactory(root, factory) {
  const api = factory(root || globalThis);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EngineeringDropdownFocusGuardRuntime = api;
})(typeof window !== "undefined" ? window : globalThis, function createDropdownFocusGuardRuntime(root) {
  "use strict";

  const VERSION = "engineering-dropdown-focus-guard-runtime.v2";
  const CACHE_KEY = "20260707-dropdown-focus-guard2";
  const GUARDED_HIDDEN_SELECTOR = [
    ".dropdown-content",
    ".dropdown-submenu-content",
    ".context-menu",
    "[role='menu']"
  ].join(",");

  let installed = false;
  let lastFocusedElement = null;

  function isElement(value) {
    return !!value && typeof value === "object" && typeof value.contains === "function";
  }

  function activeElement(documentRef = root.document) {
    const active = documentRef?.activeElement;
    if (!active || active === documentRef.body || active === documentRef.documentElement) return lastFocusedElement;
    return active;
  }

  function shouldGuardElement(element) {
    if (!isElement(element)) return false;
    if (typeof element.matches !== "function") return true;
    try {
      return element.matches(GUARDED_HIDDEN_SELECTOR) || !!element.closest?.(GUARDED_HIDDEN_SELECTOR);
    } catch (error) {
      return true;
    }
  }

  function selectorForDropdownId(id = "") {
    const suffix = String(id || "").replace(/^dropdown-/, "");
    return suffix ? `#menu-${suffix}` : "";
  }

  function findFallbackFocus(element, active = activeElement()) {
    const documentRef = root.document;
    if (!documentRef || !isElement(element)) return null;
    const idSelector = selectorForDropdownId(element.id);
    const candidates = [
      idSelector ? documentRef.querySelector?.(idSelector) : null,
      element.previousElementSibling,
      element.parentElement?.querySelector?.(":scope > .menu-item"),
      element.parentElement?.querySelector?.(":scope > .dropdown-submenu-trigger"),
      active?.closest?.(".menu-dropdown")?.querySelector?.(".menu-item"),
      active?.closest?.(".dropdown-submenu")?.querySelector?.(".dropdown-submenu-trigger")
    ];
    return candidates.find((candidate) => candidate && typeof candidate.focus === "function" && !candidate.disabled) || null;
  }

  function focusFallback(candidate) {
    if (!candidate || typeof candidate.focus !== "function") return false;
    try {
      if (!candidate.hasAttribute?.("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/i.test(candidate.tagName || "")) {
        candidate.setAttribute?.("tabindex", "-1");
        candidate.dataset.engineeringFocusGuardTabindex = "true";
      }
      candidate.focus({ preventScroll: true });
      return true;
    } catch (error) {
      return false;
    }
  }

  function releaseFocusBeforeHide(element) {
    const documentRef = root.document;
    const active = activeElement(documentRef);
    if (!active || !isElement(element) || !element.contains(active) || !shouldGuardElement(element)) return false;
    const fallback = findFallbackFocus(element, active);
    if (focusFallback(fallback)) return true;
    if (typeof active.blur === "function") {
      active.blur();
      return true;
    }
    return false;
  }

  function observeFocus() {
    const documentRef = root.document;
    if (!documentRef?.addEventListener || documentRef.__engineeringDropdownFocusGuardFocusObserved) return;
    documentRef.addEventListener("focusin", (event) => {
      if (isElement(event.target)) lastFocusedElement = event.target;
    }, true);
    Object.defineProperty(documentRef, "__engineeringDropdownFocusGuardFocusObserved", {
      value: true,
      configurable: true
    });
  }

  function cleanupFocusedHiddenDropdowns() {
    const documentRef = root.document;
    const active = activeElement(documentRef);
    if (!active || !documentRef?.querySelectorAll) return;
    Array.from(documentRef.querySelectorAll(`${GUARDED_HIDDEN_SELECTOR}[aria-hidden="true"]`)).forEach((element) => {
      if (element.contains(active)) releaseFocusBeforeHide(element);
    });
  }

  function observeHiddenMutations() {
    const documentRef = root.document;
    if (!root.MutationObserver || !documentRef?.documentElement || documentRef.__engineeringDropdownFocusGuardMutationObserved) return;
    const observer = new root.MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "aria-hidden")) {
        cleanupFocusedHiddenDropdowns();
      }
    });
    observer.observe(documentRef.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden"]
    });
    Object.defineProperty(documentRef, "__engineeringDropdownFocusGuardMutationObserved", {
      value: true,
      configurable: true
    });
  }

  function install() {
    if (installed || !root.Element?.prototype?.setAttribute) return false;
    const proto = root.Element.prototype;
    if (proto.__engineeringDropdownFocusGuardPatched) {
      installed = true;
      return true;
    }
    const originalSetAttribute = proto.setAttribute;
    Object.defineProperty(proto, "__engineeringDropdownFocusGuardOriginalSetAttribute", {
      value: originalSetAttribute,
      configurable: true
    });
    proto.setAttribute = function guardedSetAttribute(name, value) {
      if (String(name || "").toLowerCase() === "aria-hidden" && String(value).toLowerCase() === "true") {
        releaseFocusBeforeHide(this);
      }
      return originalSetAttribute.call(this, name, value);
    };
    const ariaHiddenDescriptor = Object.getOwnPropertyDescriptor(proto, "ariaHidden")
      || Object.getOwnPropertyDescriptor(root.HTMLElement?.prototype || {}, "ariaHidden");
    if (ariaHiddenDescriptor?.set && !proto.__engineeringDropdownFocusGuardAriaHiddenPatched) {
      Object.defineProperty(proto, "ariaHidden", {
        configurable: true,
        enumerable: ariaHiddenDescriptor.enumerable,
        get: function getGuardedAriaHidden() {
          return ariaHiddenDescriptor.get ? ariaHiddenDescriptor.get.call(this) : this.getAttribute?.("aria-hidden");
        },
        set: function setGuardedAriaHidden(value) {
          if (String(value).toLowerCase() === "true") releaseFocusBeforeHide(this);
          return ariaHiddenDescriptor.set.call(this, value);
        }
      });
      Object.defineProperty(proto, "__engineeringDropdownFocusGuardAriaHiddenPatched", {
        value: true,
        configurable: true
      });
    }
    Object.defineProperty(proto, "__engineeringDropdownFocusGuardPatched", {
      value: true,
      configurable: true
    });
    observeFocus();
    observeHiddenMutations();
    installed = true;
    return true;
  }

  install();

  return {
    VERSION,
    CACHE_KEY,
    GUARDED_HIDDEN_SELECTOR,
    install,
    releaseFocusBeforeHide,
    cleanupFocusedHiddenDropdowns,
    findFallbackFocus,
    get installed() {
      return installed;
    }
  };
});
