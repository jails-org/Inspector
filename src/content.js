/**
 * Content Script - Scans DOM for Jails components
 */

// Store element references for state retrieval
window.__jailsInspectorElements = {};
window.__jailsInspectorElementIds = window.__jailsInspectorElementIds || new WeakMap();
window.__jailsInspectorNextElementId = window.__jailsInspectorNextElementId || 0;

function getJailsInspectorElementId(el) {
  if (!window.__jailsInspectorElementIds.has(el)) {
    window.__jailsInspectorElementIds.set(el, window.__jailsInspectorNextElementId++);
  }

  return window.__jailsInspectorElementIds.get(el);
}

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.source !== 'jails-inspector') {
    return;
  }

  if (event.data.type === 'component-state-updated') {
    chrome.runtime.sendMessage({
      action: 'jailsComponentStateUpdated',
      componentId: event.data.componentId,
    });
  }
});

function scanJailsComponents() {
  const components = [];
  const elementMap = new WeakMap();

  // Find all custom elements (Jails components typically use kebab-case names)
  const allElements = document.querySelectorAll('*');
  window.__jailsInspectorElements = {};
  
  allElements.forEach((el) => {
    const tagName = el.tagName.toLowerCase();
    
    // Check if it's a custom element (contains hyphen)
    if (tagName.includes('-')) {
      const componentId = getJailsInspectorElementId(el);

      // Get component info
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
      };

      // Collect attributes
      for (let attr of el.attributes) {
        component.attributes[attr.name] = attr.value;
      }

      // Collect data attributes
      for (let key in el.dataset) {
        component.dataAttributes[key] = el.dataset[key];
      }

      components.push(component);
      elementMap.set(el, component);
      // Store element reference for later state retrieval
      window.__jailsInspectorElements[componentId] = el;
    }
  });

  // Build relationships by finding actual parent elements
  allElements.forEach((el) => {
    const tagName = el.tagName.toLowerCase();
    if (tagName.includes('-')) {
      const childComponent = elementMap.get(el);
      if (childComponent) {
        // Find the nearest parent that is a custom element
        let parent = el.parentElement;
        while (parent) {
          const parentTagName = parent.tagName.toLowerCase();
          if (parentTagName.includes('-')) {
            const parentComponent = elementMap.get(parent);
            if (parentComponent) {
              childComponent.parentId = parentComponent.id;
              if (!parentComponent.children.includes(childComponent.id)) {
                parentComponent.children.push(childComponent.id);
              }
              break;
            }
          }
          parent = parent.parentElement;
        }
      }
    }
  });

  // Calculate depth for each component
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

  return components;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanComponents') {
    try {
      const components = scanJailsComponents();
      sendResponse({ success: true, components });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === 'getComponentState') {
    try {
      const componentId = request.componentId;
      const el = window.__jailsInspectorElements[componentId];
      if (!el || !window.__jails__) {
        sendResponse({ success: false, state: null });
        return;
      }
      
      const instance = window.__jails__.getInstance(el);
      if (!instance) {
        sendResponse({ success: false, state: null });
        return;
      }
      
      const state = instance.state && instance.state.get ? instance.state.get() : null;
      sendResponse({ success: true, state: state });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
});

console.log('[Jails Inspector] Content script loaded');
