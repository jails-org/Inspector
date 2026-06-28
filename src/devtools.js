/**
 * DevTools Script - Registers the devtools panel
 */

chrome.devtools.panels.create(
  'Jails',
  null,
  'devtools-panel.html',
  (panel) => {
    panel.onHidden.addListener(clearInspectedElementFocus);
    console.log('Jails devtools panel created');
  }
);

window.addEventListener('beforeunload', clearInspectedElementFocus);

function clearInspectedElementFocus() {
  chrome.devtools.inspectedWindow.eval(`
    (function() {
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
    })()
  `);
}
