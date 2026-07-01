/**
 * DevTools Panel Script
 */

let visualizer;
let pendingStateScanTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('graph-canvas');
  const infoPanel = document.getElementById('info-panel');
  visualizer = new ComponentGraphVisualizer(canvas, infoPanel);
  visualizer.nodeSelectedHandler = (node) => {
    focusInspectedElement(node.component.id);
  };
  visualizer.selectionClearedHandler = clearInspectedElementFocus;

  // Set up state requester for devtools
  visualizer.stateRequester = (componentId, callback) => {
    const evalCode = `
      (function() {
        const getJailsInspectorComponentInstance = ${getJailsInspectorComponentInstance.toString()};
        const normalizeJailsInspectorState = ${normalizeJailsInspectorState.toString()};
        const getJailsInspectorComponentState = ${getJailsInspectorComponentState.toString()};
        const componentId = ${componentId};
        const el = window.__jailsInspectorElements[componentId];
        if (!el) {
          return null;
        }

        return (${getJailsInspectorComponentState.toString()})(el);
      })()
    `;
    
    chrome.devtools.inspectedWindow.eval(evalCode, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
        callback(null);
        return;
      }
      callback(result);
    });
  };

  // Setup buttons
  document.getElementById('scan-btn').addEventListener('click', scanComponents);
  document.getElementById('zoom-in').addEventListener('click', () => visualizer.zoomIn());
  document.getElementById('zoom-out').addEventListener('click', () => visualizer.zoomOut());
  document.getElementById('reset-view').addEventListener('click', () => visualizer.resetView());
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  window.addEventListener('beforeunload', clearInspectedElementFocus);

  // Auto-scan after the inspected page DOM is ready.
  scheduleInitialScan();
});

function scheduleInitialScan() {
  const checkInspectedDomReady = () => {
    chrome.devtools.inspectedWindow.eval('document.readyState', (readyState) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
        setTimeout(scanComponents, 1000);
        return;
      }

      if (readyState === 'loading') {
        setTimeout(checkInspectedDomReady, 250);
        return;
      }

      scanComponents();
    });
  };

  checkInspectedDomReady();
}

function focusInspectedElement(componentId) {
  const evalCode = `
    (function() {
      const componentId = ${Number(componentId)};
      const el = window.__jailsInspectorElements && window.__jailsInspectorElements[componentId];
      if (!el) {
        return false;
      }

      const overlayId = '__jailsInspectorElementFocusOverlay';
      let overlay = document.getElementById(overlayId);

      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.style.position = 'fixed';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '2147483647';
        overlay.style.border = '2px dashed #60a5fa';
        overlay.style.borderRadius = '4px';
        overlay.style.boxSizing = 'border-box';
        overlay.style.transition = 'top 120ms ease, left 120ms ease, width 120ms ease, height 120ms ease';
        document.documentElement.appendChild(overlay);
      }

      window.__jailsInspectorFocusedElement = el;

      function updateOverlay() {
        const focusedEl = window.__jailsInspectorFocusedElement;
        const currentOverlay = document.getElementById(overlayId);

        if (!focusedEl || !currentOverlay || !focusedEl.isConnected) {
          if (currentOverlay) {
            currentOverlay.remove();
          }
          window.removeEventListener('scroll', updateOverlay, true);
          window.removeEventListener('resize', updateOverlay, true);
          return;
        }

        const rect = focusedEl.getBoundingClientRect();
        currentOverlay.style.top = rect.top + 'px';
        currentOverlay.style.left = rect.left + 'px';
        currentOverlay.style.width = rect.width + 'px';
        currentOverlay.style.height = rect.height + 'px';
        currentOverlay.style.display = rect.width > 0 && rect.height > 0 ? 'block' : 'none';
      }

      if (window.__jailsInspectorUpdateFocusedOverlay) {
        window.removeEventListener('scroll', window.__jailsInspectorUpdateFocusedOverlay, true);
        window.removeEventListener('resize', window.__jailsInspectorUpdateFocusedOverlay, true);
      }

      window.__jailsInspectorUpdateFocusedOverlay = updateOverlay;
      window.addEventListener('scroll', updateOverlay, true);
      window.addEventListener('resize', updateOverlay, true);

      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });

      if (typeof el.focus === 'function') {
        try {
          el.focus({ preventScroll: true });
        } catch (error) {
          el.focus();
        }
      }

      updateOverlay();
      setTimeout(updateOverlay, 180);
      return true;
    })()
  `;

  chrome.devtools.inspectedWindow.eval(evalCode, (result) => {
    if (chrome.runtime.lastError) {
      console.error('Error:', chrome.runtime.lastError);
    }
  });
}

function clearInspectedElementFocus() {
  chrome.devtools.inspectedWindow.eval(
    `(${clearJailsInspectedElementFocus.toString()})();`,
    () => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      }
    }
  );
}

function clearJailsInspectedElementFocus() {
  const overlay = document.getElementById('__jailsInspectorElementFocusOverlay');

  if (overlay) {
    overlay.remove();
  }

  if (window.__jailsInspectorUpdateFocusedOverlay) {
    window.removeEventListener('scroll', window.__jailsInspectorUpdateFocusedOverlay, true);
    window.removeEventListener('resize', window.__jailsInspectorUpdateFocusedOverlay, true);
  }

  window.__jailsInspectorFocusedElement = null;
  window.__jailsInspectorUpdateFocusedOverlay = null;
}

function handleRuntimeMessage(message) {
  if (
    !message ||
    message.action !== 'jailsDevtoolsStateUpdated' ||
    message.tabId !== chrome.devtools.inspectedWindow.tabId
  ) {
    return;
  }

  const componentId = message.componentId;
  visualizer.notifyComponentUpdated(componentId);
  scheduleStateDrivenScan(componentId);

  if (visualizer.selectedNode && visualizer.selectedNode.component.id === componentId && visualizer.stateRequester) {
    visualizer.showNodeInfo(visualizer.selectedNode);
    visualizer.stateRequester(componentId, (state) => {
      if (visualizer.selectedNode && visualizer.selectedNode.component.id === componentId) {
        visualizer.updateNodeStateInfo(visualizer.selectedNode, state);
      }
    });
  }
}

function scheduleStateDrivenScan(componentId) {
  if (pendingStateScanTimer) {
    clearTimeout(pendingStateScanTimer);
  }

  pendingStateScanTimer = setTimeout(() => {
    pendingStateScanTimer = null;
    scanComponents({ preserveInfoPanel: true, updatedComponentId: componentId });
  }, 80);
}

function scanComponents(options = {}) {
  chrome.devtools.inspectedWindow.eval(
    '(function() { ' +
    'window.__jailsInspectorData = { components: [] }; ' +
    `const getJailsInspectorComponentNames = ${getJailsInspectorComponentNames.toString()}; ` +
    `const getJailsInspectorComponentInstance = ${getJailsInspectorComponentInstance.toString()}; ` +
    `const normalizeJailsInspectorState = ${normalizeJailsInspectorState.toString()}; ` +
    `const getJailsInspectorComponentState = ${getJailsInspectorComponentState.toString()}; ` +
    `(${collectJailsComponents.toString()})(); ` +
    'return window.__jailsInspectorData; ' +
    '})()',
    (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
        return;
      }

      const components = result && result.components ? result.components : [];
      const selectedIdBeforeScan = visualizer.selectedNode ? visualizer.selectedNode.id : null;

      if (components.length > 0) {
        visualizer.setComponents(components);
        installStateSetHooks();

        if (options.updatedComponentId !== undefined) {
          visualizer.notifyComponentUpdated(options.updatedComponentId);
        }

        if (visualizer.selectedNode && visualizer.stateRequester) {
          const selectedNode = visualizer.selectedNode;
          visualizer.showNodeInfo(selectedNode);
          visualizer.stateRequester(selectedNode.component.id, (state) => {
            if (visualizer.selectedNode && visualizer.selectedNode.component.id === selectedNode.component.id) {
              visualizer.updateNodeStateInfo(visualizer.selectedNode, state);
            }
          });
        } else if (selectedIdBeforeScan !== null) {
          clearInspectedElementFocus();
          document.getElementById('info-panel').innerHTML =
            '<p class="placeholder">Selected component is no longer in the DOM</p>';
        } else if (!options.preserveInfoPanel) {
          document.getElementById('info-panel').innerHTML =
            `<p class="placeholder">${components.length} component(s) found</p>`;
        }
      } else {
        visualizer.setComponents([]);

        if (!options.preserveInfoPanel) {
          document.getElementById('info-panel').innerHTML =
            '<p class="placeholder">No Jails components found</p>';
        }
      }
    }
  );
}

function installStateSetHooks() {
  chrome.devtools.inspectedWindow.eval(
    '(function() { ' +
    `const getJailsInspectorComponentInstance = ${getJailsInspectorComponentInstance.toString()}; ` +
    `(${installJailsStateSetHooks.toString()})();` +
    '})()',
    (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
      }
    }
  );
}

function installJailsStateSetHooks() {
  const elements = window.__jailsInspectorElements || {};

  Object.keys(elements).forEach((componentId) => {
    const el = elements[componentId];
    if (!el) {
      return;
    }

    const instance = getJailsInspectorComponentInstance(el);
    if (!instance || !instance.state || typeof instance.state.set !== 'function') {
      return;
    }

    const state = instance.state;

    if (state.set.__jailsInspectorWrapped) {
      state.set.__jailsInspectorComponentId = Number(componentId);
      return;
    }

    const originalSet = state.set;

    function wrappedStateSet(...args) {
      const result = originalSet.apply(this, args);
      const updatedComponentId = wrappedStateSet.__jailsInspectorComponentId;
      const notify = () => {
        window.postMessage({
          source: 'jails-inspector',
          type: 'component-state-updated',
          componentId: updatedComponentId,
        }, '*');
      };

      if (typeof queueMicrotask === 'function') {
        queueMicrotask(notify);
      } else {
        setTimeout(notify, 0);
      }

      return result;
    }

    wrappedStateSet.__jailsInspectorWrapped = true;
    wrappedStateSet.__jailsInspectorOriginalSet = originalSet;
    wrappedStateSet.__jailsInspectorComponentId = Number(componentId);

    state.set = wrappedStateSet;
  });
}

function getJailsInspectorComponentNames() {
  if (!window.__jails__ || !window.__jails__.components) {
    return [];
  }

  return Object
    .values(window.__jails__.components)
    .map((component) => component && component.name)
    .filter(Boolean);
}

function getJailsInspectorComponentInstance(el) {
  if (!el || !window.__jails__ || !window.__jails__.instances) {
    return null;
  }

  return window.__jails__.instances.get(el) || null;
}

function normalizeJailsInspectorState(value, seen = []) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'undefined') {
    return null;
  }

  if (typeof value === 'bigint') {
    return value.toString() + 'n';
  }

  if (typeof value === 'function') {
    return '[Function' + (value.name ? ': ' + value.name : '') + ']';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof URL) {
    return value.href;
  }

  if (value instanceof URLSearchParams) {
    return Object.fromEntries(value.entries());
  }

  if (value instanceof Map) {
    const output = {};
    value.forEach((mapValue, key) => {
      output[String(key)] = normalizeJailsInspectorState(mapValue, seen);
    });
    return output;
  }

  if (value instanceof Set) {
    return Array.from(value.values()).map((setValue) => normalizeJailsInspectorState(setValue, seen));
  }

  if (typeof Node !== 'undefined' && value instanceof Node) {
    return '[' + value.nodeName.toLowerCase() + ']';
  }

  if (seen.includes(value)) {
    return '[Circular]';
  }

  const nextSeen = seen.concat(value);

  if (Array.isArray(value)) {
    return value.map((item) => normalizeJailsInspectorState(item, nextSeen));
  }

  const output = {};
  Object.keys(value).forEach((key) => {
    try {
      output[key] = normalizeJailsInspectorState(value[key], nextSeen);
    } catch (error) {
      output[key] = '[Unreadable]';
    }
  });

  return output;
}

function getJailsInspectorComponentState(el) {
  const instance = getJailsInspectorComponentInstance(el);

  if (!instance || !instance.state || typeof instance.state.get !== 'function') {
    return null;
  }

  try {
    return normalizeJailsInspectorState(instance.state.get());
  } catch (error) {
    return null;
  }
}

function collectJailsComponents() {
  const components = [];
  const elementMap = new WeakMap();
  const componentNames = getJailsInspectorComponentNames();
  const selector = componentNames.join(',');
  const allElements = selector ? document.querySelectorAll(selector) : [];
  
  // Store references globally for state retrieval
  window.__jailsInspectorElements = {};
  window.__jailsInspectorElementIds = window.__jailsInspectorElementIds || new WeakMap();
  window.__jailsInspectorNextElementId = window.__jailsInspectorNextElementId || 0;

  function getInspectorElementId(el) {
    if (!window.__jailsInspectorElementIds.has(el)) {
      window.__jailsInspectorElementIds.set(el, window.__jailsInspectorNextElementId++);
    }

    return window.__jailsInspectorElementIds.get(el);
  }
  
  // First pass: collect registered Jails custom elements
  allElements.forEach((el) => {
    const tagName = el.tagName.toLowerCase();
    
    const componentId = getInspectorElementId(el);
    const state = getJailsInspectorComponentState(el);

    const component = {
      id: componentId,
      name: tagName,
      tag: tagName,
      children: [],
      parentId: null,
      hasTemplate: !!el.querySelector('template'),
      attributes: {},
      dataAttributes: {},
      classList: Array.from(el.classList),
      childCount: el.children.length,
      depth: 0,
      state,
    };

    for (let attr of el.attributes) {
      component.attributes[attr.name] = attr.value;
    }

    for (let key in el.dataset) {
      component.dataAttributes[key] = el.dataset[key];
    }

    components.push(component);
    elementMap.set(el, component);
    // Store element reference for state retrieval
    window.__jailsInspectorElements[componentId] = el;
  });

  // Second pass: build relationships
  allElements.forEach((el) => {
    const childComponent = elementMap.get(el);
    if (childComponent) {
      let parent = el.parentElement;
      while (parent) {
        const parentComponent = elementMap.get(parent);
        if (parentComponent) {
          childComponent.parentId = parentComponent.id;
          if (!parentComponent.children.includes(childComponent.id)) {
            parentComponent.children.push(childComponent.id);
          }
          break;
        }

        if (parent.matches && selector && parent.matches(selector)) {
          const parentId = getInspectorElementId(parent);
          const parentFromMap = components.find((component) => component.id === parentId);
          if (parentFromMap) {
            childComponent.parentId = parentFromMap.id;
            if (!parentFromMap.children.includes(childComponent.id)) {
              parentFromMap.children.push(childComponent.id);
            }
            break;
          }
        }

        parent = parent.parentElement;
      }
    }
  });

  // Calculate depth
  function calculateDepth(componentId, visited = new Set()) {
    if (visited.has(componentId)) return 0;
    visited.add(componentId);
    
    const component = components.find(c => c.id === componentId);
    if (!component || component.parentId === null) {
      component.depth = 0;
      return 0;
    }
    
    const parentComponent = components.find(c => c.id === component.parentId);
    if (parentComponent) {
      component.depth = calculateDepth(component.parentId, visited) + 1;
    }
    return component.depth;
  }

  components.forEach(c => calculateDepth(c.id));

  window.__jailsInspectorData.components = components;
}
