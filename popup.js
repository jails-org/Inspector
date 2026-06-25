/**
 * Popup Script - Handles UI interactions
 */

let visualizer;

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('graph-canvas');
  const infoPanel = document.getElementById('info-panel');
  visualizer = new ComponentGraphVisualizer(canvas, infoPanel);

  // Set up state requester for popup
  visualizer.stateRequester = (componentId, callback) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      chrome.tabs.sendMessage(activeTab.id, { 
        action: 'getComponentState', 
        componentId: componentId 
      }, (response) => {
        if (response && response.success) {
          callback(response.state);
        } else {
          callback(null);
        }
      });
    });
  };

  // Setup buttons
  document.getElementById('scan-btn').addEventListener('click', scanComponents);
  document.getElementById('zoom-in').addEventListener('click', () => visualizer.zoomIn());
  document.getElementById('zoom-out').addEventListener('click', () => visualizer.zoomOut());
  document.getElementById('reset-view').addEventListener('click', () => visualizer.resetView());

  // Auto-scan on open
  scanComponents();
});

function scanComponents() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    
    chrome.tabs.sendMessage(activeTab.id, { action: 'scanComponents' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error:', chrome.runtime.lastError);
        document.getElementById('info-panel').innerHTML = 
          '<p class="placeholder">Error: Could not scan components. Refresh page and try again.</p>';
        return;
      }

      if (response && response.success && response.components.length > 0) {
        visualizer.setComponents(response.components);
        document.getElementById('info-panel').innerHTML = 
          `<p class="placeholder">${response.components.length} component(s) found</p>`;
      } else {
        document.getElementById('info-panel').innerHTML = 
          '<p class="placeholder">No Jails components found on this page</p>';
      }
    });
  });
}
