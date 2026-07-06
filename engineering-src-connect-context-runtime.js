(function srcConnectContextFactory(root, factory) {
  const api = factory(root || globalThis);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EngineeringSrcConnectContextRuntime = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function createSrcConnectContextRuntime(root) {
  'use strict';

  const VERSION = 'engineering-src-connect-context-runtime.v1';
  const CACHE_KEY = '20260706-src-connect-context1';
  const SOURCE_OBJECT_SELECTOR = '.pfd-object[data-type="source"], .pfd-object.object-type-source';
  const CONTEXT_MENU_ID = 'canvasContextMenu';
  const MENU_LABELS = Object.freeze([
    'User Task Object Properties',
    'Connect',
    'Delete Source'
  ]);

  let installed = false;

  function getModel(rootLike = root) {
    return rootLike.__npshGlobalModel || rootLike.globalModel || {};
  }

  function objectIdFromElement(element) {
    return element?.dataset?.id || '';
  }

  function getObjectElement(sourceId) {
    const documentRef = root.document;
    if (!documentRef || !sourceId) return null;
    const encoded = String(sourceId).toLowerCase().replace(/-/g, '');
    return documentRef.getElementById(`obj-${encoded}`);
  }

  function isSourceNode(sourceId) {
    const node = getModel(root)[sourceId];
    return String(node?.type || '').toLowerCase() === 'source';
  }

  function findSourceObjectFromEvent(event) {
    const target = event?.target;
    if (!target?.closest) return null;
    const object = target.closest(SOURCE_OBJECT_SELECTOR);
    if (!object) return null;
    const canvas = root.document?.getElementById?.('canvas');
    if (canvas && !canvas.contains(object)) return null;
    const sourceId = objectIdFromElement(object);
    return isSourceNode(sourceId) ? object : null;
  }

  function hideContextMenu() {
    if (typeof root.hideContextMenu === 'function') {
      root.hideContextMenu();
      return;
    }
    const menu = root.document?.getElementById?.(CONTEXT_MENU_ID);
    if (menu) {
      menu.style.display = 'none';
      menu.setAttribute('aria-hidden', 'true');
    }
    root.document?.body?.classList?.remove('context-menu-open');
  }

  function showContextMenu(clientX, clientY, items) {
    if (typeof root.showContextMenu === 'function') {
      root.showContextMenu(clientX, clientY, items);
      return;
    }
    const documentRef = root.document;
    if (!documentRef) return;
    let menu = documentRef.getElementById(CONTEXT_MENU_ID);
    if (!menu) {
      menu = documentRef.createElement('div');
      menu.id = CONTEXT_MENU_ID;
      menu.className = 'context-menu';
      menu.setAttribute('role', 'menu');
      documentRef.body.appendChild(menu);
    }
    menu.innerHTML = '';
    items.forEach((item) => {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      if (item.danger) button.className = 'danger';
      button.textContent = item.label;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        hideContextMenu();
        item.action();
      });
      menu.appendChild(button);
    });
    menu.style.display = 'block';
    menu.setAttribute('aria-hidden', 'false');
    const rect = menu.getBoundingClientRect?.() || { width: 180, height: 120 };
    menu.style.left = `${Math.max(8, Math.min(clientX, root.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(clientY, root.innerHeight - rect.height - 8))}px`;
    documentRef.body.classList.add('context-menu-open');
  }

  function requestUserTaskObjectProperties(sourceId) {
    if (!isSourceNode(sourceId)) return false;
    if (typeof root.__npshAllowCanvasPropertiesCommandOpen === 'function') {
      root.__npshAllowCanvasPropertiesCommandOpen();
    }
    if (typeof root.requestUserTaskObjectProperties === 'function') {
      root.requestUserTaskObjectProperties(sourceId);
      return true;
    }
    const object = getObjectElement(sourceId);
    if (object) {
      object.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      object.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      return true;
    }
    return false;
  }

  function startSourceHydraulicConnect(sourceId) {
    if (!isSourceNode(sourceId)) return false;
    hideContextMenu();
    if (typeof root.startHydraulicConnectionFromSource === 'function') {
      root.startHydraulicConnectionFromSource(sourceId, null);
      return true;
    }
    const object = getObjectElement(sourceId);
    const port = object?.querySelector?.('.port.outlet') || object?.querySelector?.('.port');
    if (!port) return false;
    if (typeof root.setAppMode === 'function') root.setAppMode('CONNECT');
    const rect = port.getBoundingClientRect();
    port.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    }));
    return true;
  }

  function deleteSource(sourceId) {
    if (!isSourceNode(sourceId)) return false;
    hideContextMenu();
    if (typeof root.deleteNode === 'function') {
      root.deleteNode(sourceId);
      return true;
    }
    const model = getModel(root);
    const connections = Array.isArray(root.__npshConnections) ? root.__npshConnections : [];
    for (let index = connections.length - 1; index >= 0; index -= 1) {
      const connection = connections[index];
      if (connection?.from === sourceId || connection?.to === sourceId) {
        if (connection.pipeId && model[connection.pipeId]?.type === 'pipe') delete model[connection.pipeId];
        connections.splice(index, 1);
      }
    }
    delete model[sourceId];
    getObjectElement(sourceId)?.remove();
    if (typeof root.drawConnections === 'function') root.drawConnections();
    if (typeof root.updateSimulation === 'function') root.updateSimulation({ renderSidebarAfter: false });
    return true;
  }

  function buildSourceContextMenuItems(sourceId) {
    return [
      {
        label: MENU_LABELS[0],
        action: () => requestUserTaskObjectProperties(sourceId)
      },
      {
        label: MENU_LABELS[1],
        action: () => startSourceHydraulicConnect(sourceId)
      },
      {
        label: MENU_LABELS[2],
        danger: true,
        action: () => deleteSource(sourceId)
      }
    ];
  }

  function handleSourceContextMenu(event) {
    const sourceObject = findSourceObjectFromEvent(event);
    if (!sourceObject) return;
    const sourceId = objectIdFromElement(sourceObject);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    showContextMenu(event.clientX || 0, event.clientY || 0, buildSourceContextMenuItems(sourceId));
  }

  function install() {
    const documentRef = root.document;
    if (!documentRef || installed) return false;
    documentRef.addEventListener('contextmenu', handleSourceContextMenu, true);
    installed = true;
    return true;
  }

  function autoInstall() {
    if (!root.document || installed) return;
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', install, { once: true });
      return;
    }
    install();
  }

  autoInstall();

  return {
    VERSION,
    CACHE_KEY,
    MENU_LABELS,
    SOURCE_OBJECT_SELECTOR,
    buildSourceContextMenuItems,
    deleteSource,
    findSourceObjectFromEvent,
    install,
    isSourceNode,
    requestUserTaskObjectProperties,
    startSourceHydraulicConnect
  };
});
