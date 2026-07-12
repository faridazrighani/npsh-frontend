#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const runtimePath = path.join(root, "engineering-dropdown-focus-guard-runtime.js");
const indexPath = path.join(root, "index.html");
const manifestPath = path.join(root, "FILE_MANIFEST.md");
const packagePath = path.join(root, "package.json");
const e2ePath = path.join(root, "tests", "e2e", "dropdown-focus-guard.spec.cjs");

const runtimeSource = fs.readFileSync(runtimePath, "utf8");
const indexHtml = fs.readFileSync(indexPath, "utf8");
const manifest = fs.readFileSync(manifestPath, "utf8");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const e2eSource = fs.readFileSync(e2ePath, "utf8");

assert(runtimeSource.includes('const VERSION = "engineering-dropdown-focus-guard-runtime.v2"'), "Runtime must declare version.");
assert(runtimeSource.includes('const CACHE_KEY = "20260707-dropdown-focus-guard2"'), "Runtime must declare cache key.");
assert(runtimeSource.includes('proto.setAttribute = function guardedSetAttribute'), "Runtime must patch Element.setAttribute.");
assert(runtimeSource.includes('setGuardedAriaHidden'), "Runtime must patch the ariaHidden property setter.");
assert(runtimeSource.includes('observeHiddenMutations'), "Runtime must include mutation cleanup as a secondary guard.");
assert(runtimeSource.includes('lastFocusedElement'), "Runtime must track the last focused element.");
assert(runtimeSource.includes('releaseFocusBeforeHide(this)'), "Runtime must release focus before setting aria-hidden=true.");
assert(runtimeSource.includes('".dropdown-content"'), "Runtime must guard dropdown content.");
assert(runtimeSource.includes('".dropdown-submenu-content"'), "Runtime must guard submenu content.");
assert(runtimeSource.includes('selectorForDropdownId'), "Runtime must map dropdown IDs to menu trigger IDs.");

const cacheKey = "engineering-dropdown-focus-guard-runtime.js?v=20260707-dropdown-focus-guard2";
assert(indexHtml.includes(cacheKey), "index.html must load the dropdown focus guard runtime.");
assert(
  indexHtml.indexOf(cacheKey) < indexHtml.indexOf("app.bundle.min.js?v=20260707-pipe-canvas-loss-label1"),
  "Dropdown focus guard must load before the protected app bundle."
);
assert(
  indexHtml.indexOf(cacheKey) < indexHtml.indexOf("engineering-simulation-load-transaction-manager.js?v=20260712-simulation-load-stale-promise-clean2"),
  "Dropdown focus guard must load before runtime bridges that interact with menus."
);
assert(manifest.includes("engineering-dropdown-focus-guard-runtime.js"), "FILE_MANIFEST must mention the dropdown focus guard runtime.");
assert(manifest.includes("20260707-dropdown-focus-guard2"), "FILE_MANIFEST must mention the dropdown focus guard cache key.");
assert(manifest.includes("validate:dropdown-focus-guard"), "FILE_MANIFEST must mention the dropdown focus guard validator.");
assert.equal(
  packageJson.scripts?.["validate:dropdown-focus-guard"],
  "node tools/validate-dropdown-focus-guard-runtime.cjs",
  "package.json must expose validate:dropdown-focus-guard."
);
assert.equal(
  packageJson.scripts?.["test:e2e:dropdown-focus-guard"],
  "playwright test tests/e2e/dropdown-focus-guard.spec.cjs",
  "package.json must expose test:e2e:dropdown-focus-guard."
);
assert(e2eSource.includes("Blocked aria-hidden"), "E2E must watch for the Chromium aria-hidden warning.");
assert(e2eSource.includes("simulation-case-6"), "E2E must cover the Simulation Cases dropdown item.");
assert(e2eSource.includes("focusStillInsideDropdown"), "E2E must prove focus is no longer inside the hidden dropdown.");

class FakeElement {
  constructor(tagName = "div", id = "") {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.attributes = {};
    this.children = [];
    this.parentElement = null;
    this.previousElementSibling = null;
    this.dataset = {};
    this.disabled = false;
    this.focused = false;
    this.blurred = false;
  }
  appendChild(child) {
    child.parentElement = this;
    child.previousElementSibling = this.children[this.children.length - 1] || null;
    this.children.push(child);
    return child;
  }
  contains(candidate) {
    return candidate === this || this.children.some((child) => child.contains(candidate));
  }
  matches(selector) {
    return selector.includes(".dropdown-content") && this.className === "dropdown-content";
  }
  closest(selector) {
    let cursor = this;
    while (cursor) {
      if (typeof cursor.matches === "function" && cursor.matches(selector)) return cursor;
      cursor = cursor.parentElement;
    }
    return null;
  }
  querySelector(selector) {
    if (selector === ":scope > .menu-item") return this.children.find((child) => child.className === "menu-item") || null;
    return this.children.find((child) => child.id && selector === `#${child.id}`) || null;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }
  focus() {
    this.focused = true;
    sandbox.document.activeElement = this;
  }
  blur() {
    this.blurred = true;
    sandbox.document.activeElement = sandbox.document.body;
  }
}

const menuTrigger = new FakeElement("span", "menu-simulate");
menuTrigger.className = "menu-item";
const dropdown = new FakeElement("div", "dropdown-simulate");
dropdown.className = "dropdown-content";
const focusedItem = new FakeElement("button", "simulation-case-6");
dropdown.appendChild(focusedItem);

const sandbox = {
  module: { exports: {} },
  exports: {},
  Element: FakeElement,
  document: {
    body: new FakeElement("body"),
    documentElement: new FakeElement("html"),
    activeElement: focusedItem,
    querySelector(selector) {
      return selector === "#menu-simulate" ? menuTrigger : null;
    }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.runInNewContext(runtimeSource, sandbox, { filename: runtimePath });
const api = sandbox.module.exports;
assert.equal(api.VERSION, "engineering-dropdown-focus-guard-runtime.v2", "Runtime should export version.");
assert.equal(api.CACHE_KEY, "20260707-dropdown-focus-guard2", "Runtime should export cache key.");
assert.equal(api.installed, true, "Runtime should install automatically.");

dropdown.setAttribute("aria-hidden", "true");
assert.equal(dropdown.attributes["aria-hidden"], "true", "aria-hidden should still be applied.");
assert.equal(menuTrigger.focused, true, "Focus must move to the menu trigger before dropdown is hidden.");
assert.equal(sandbox.document.activeElement, menuTrigger, "Active element should no longer be inside hidden dropdown.");

console.log("Dropdown focus guard runtime validation passed.");
