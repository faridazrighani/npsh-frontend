#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'engineering-src-connect-context-runtime.js');
const indexPath = path.join(root, 'index.html');
const manifestPath = path.join(root, 'FILE_MANIFEST.md');

const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');

assert(runtimeSource.includes("const VERSION = 'engineering-src-connect-context-runtime.v1'"), 'Runtime must declare the SRC connect context version.');
assert(runtimeSource.includes("const CACHE_KEY = '20260706-src-connect-context1'"), 'Runtime must declare the cache key.');
assert(runtimeSource.includes("documentRef.addEventListener('contextmenu', handleSourceContextMenu, true)"), 'Runtime must intercept SRC context menus in capture phase.');
assert(runtimeSource.includes('event.stopImmediatePropagation?.()'), 'Runtime must stop the legacy SRC menu before source-type choices render.');
assert(runtimeSource.includes('root.startHydraulicConnectionFromSource(sourceId, null)'), 'Connect action must use the native hydraulic source connection starter.');
assert(runtimeSource.includes('root.requestUserTaskObjectProperties(sourceId)'), 'Object Properties action must use the native explicit object-properties command.');
assert(runtimeSource.includes('root.deleteNode(sourceId)'), 'Delete Source action must use the native source deletion command.');
assert(!runtimeSource.includes('Open Tank / Reservoir'), 'Runtime must not reintroduce source-type context menu choices.');
assert(!runtimeSource.includes('Pressurized Vessel'), 'Runtime must not reintroduce source-type context menu choices.');
assert(!runtimeSource.includes('Fixed Flow Source'), 'Runtime must not reintroduce source-type context menu choices.');

assert(
  indexHtml.includes('engineering-src-connect-context-runtime.js?v=20260706-src-connect-context1'),
  'index.html must load the SRC connect context runtime with a fresh cache key.'
);
assert(
  indexHtml.indexOf('app.bundle.min.js?v=20260707-pipe-canvas-loss-label1') <
    indexHtml.indexOf('engineering-src-connect-context-runtime.js?v=20260706-src-connect-context1'),
  'SRC connect context runtime must load after the protected app bundle.'
);
assert(
  indexHtml.indexOf('engineering-src-connect-context-runtime.js?v=20260706-src-connect-context1') <
    indexHtml.indexOf('engineering-source-volumetric-only-runtime.js?v=20260711-src-input-flash-lock1'),
  'SRC connect context runtime must load before deferred source cleanup bridges.'
);

assert(manifest.includes('engineering-src-connect-context-runtime.js'), 'FILE_MANIFEST must mention the SRC connect context runtime.');
assert(manifest.includes('20260706-src-connect-context1'), 'FILE_MANIFEST must mention the SRC connect context cache key.');
assert(manifest.includes('validate:src-connect-context'), 'FILE_MANIFEST must mention the SRC connect context validator.');

const sourceObject = {
  dataset: { id: 'SRC-100' },
  closest(selector) {
    return selector.includes('.pfd-object') ? sourceObject : null;
  }
};
const sandbox = {
  module: { exports: {} },
  exports: {},
  globalThis: {},
  document: {
    readyState: 'loading',
    addEventListener() {},
    getElementById(id) {
      if (id === 'canvas') return { contains: () => true };
      return null;
    }
  },
  MouseEvent: function MouseEvent() {}
};
sandbox.window = sandbox;
sandbox.__npshGlobalModel = {
  'SRC-100': { type: 'source', props: {} },
  'P-100': { type: 'pump', props: {} }
};
vm.runInNewContext(runtimeSource, sandbox, { filename: runtimePath });

const api = sandbox.module.exports;
assert.equal(api.VERSION, 'engineering-src-connect-context-runtime.v1', 'Runtime should export version.');
assert.deepEqual(Array.from(api.MENU_LABELS), ['User Task Object Properties', 'Connect', 'Delete Source'], 'SRC menu labels must stay clean and ordered.');
assert.equal(api.findSourceObjectFromEvent({ target: sourceObject }), sourceObject, 'Runtime should identify SRC canvas objects from contextmenu events.');

let connectedSource = '';
sandbox.startHydraulicConnectionFromSource = (sourceId) => {
  connectedSource = sourceId;
};
assert.equal(api.startSourceHydraulicConnect('SRC-100'), true, 'Connect action should start the native SRC hydraulic connection.');
assert.equal(connectedSource, 'SRC-100', 'Connect action should target the selected SRC.');

let propertiesSource = '';
sandbox.requestUserTaskObjectProperties = (sourceId) => {
  propertiesSource = sourceId;
};
assert.equal(api.requestUserTaskObjectProperties('SRC-100'), true, 'Object Properties action should use native command.');
assert.equal(propertiesSource, 'SRC-100', 'Object Properties action should target the selected SRC.');

let deletedSource = '';
sandbox.deleteNode = (sourceId) => {
  deletedSource = sourceId;
};
assert.equal(api.deleteSource('SRC-100'), true, 'Delete Source action should use native delete command.');
assert.equal(deletedSource, 'SRC-100', 'Delete Source action should target the selected SRC.');

const menuItems = api.buildSourceContextMenuItems('SRC-100');
assert.deepEqual(Array.from(menuItems, (item) => item.label), ['User Task Object Properties', 'Connect', 'Delete Source'], 'Built menu should contain only the clean SRC actions.');
assert.equal(menuItems[2].danger, true, 'Delete Source must remain visually dangerous.');

console.log('SRC connect context runtime validation passed.');
