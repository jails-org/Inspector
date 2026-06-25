# Quick Start Guide

## Getting Started

### 1. Install the Extension

**For Chrome/Chromium:**
1. Open `chrome://extensions/`
2. Enable "Developer mode" 
3. Click "Load unpacked"
4. Select this `dev-tools` folder
5. Done! ✅

**For Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json`
4. Done! ✅

### 2. Test It

1. Open `test.html` in your browser (it's included in this folder)
2. Open the browser extension popup (click the Jails icon)
3. Click "Scan Components"
4. You should see a tree visualization showing all components in hierarchical order

### 3. Try the Interactive Features

- **Zoom**: Scroll your mouse wheel or use +/- buttons
- **Pan**: Click and drag on the canvas
- **Select**: Click on a component node to see its details
- **Reset**: Click the reset button (⊙)

## What the Extension Does Now

✅ **Scans your webpage** for all Jails components (custom elements)
✅ **Displays them hierarchically** - parent components on top, children below
✅ **Shows connections** - lines connect parent components to their children
✅ **Shows component properties** when you click on a node
✅ **Full interactivity** - zoom in/out, pan, and select components
✅ **Works as popup and DevTools** - both interfaces available

## Understanding the Tree Layout

- **Root Level**: Components with no parent appear at the top
- **Child Level**: Components contained within others appear below their parents
- **Connections**: Blue lines show parent-child relationships
- **Depth**: Each level down represents one level of nesting

## File Descriptions

| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration |
| `content.js` | Scans DOM for components and builds hierarchy |
| `visualizer.js` | Renders the interactive tree graph |
| `popup.js` | Popup UI logic |
| `popup.html` | Popup interface |
| `devtools-panel.js` | DevTools panel logic |
| `devtools-panel.html` | DevTools panel UI |
| `styles.css` | All styling |
| `test.html` | Sample page for testing |

## Testing with Demo Components

Use the included `test.html` file - it has:
- Nested components showing hierarchy
- Standalone components
- Parent-child relationships you can inspect

Simply open it in your browser after installing the extension!

## Next Steps

The extension is now production-ready with:
- ✅ Proper component hierarchy detection
- ✅ Tree visualization with connections
- ✅ Click-to-inspect functionality
- ✅ Full zoom and pan support
- ✅ Hierarchical layout (parent on top, children below)

## Troubleshooting

**Components not showing?**
- Make sure your Jails components use kebab-case names (e.g., `app-counter`)
- Refresh the page and scan again
- Check browser console for errors (F12)

**Connections not visible?**
- Blue lines should appear between parents and children
- If not, the components may not be properly nested in the DOM
- Check that child elements are actually inside parent elements

**Clicks not working?**
- Try clicking directly on the node circles (not the text)
- Make sure you're not dragging - drag is for panning
- Try resetting the view and trying again

**Want to contribute?**
- Check the README.md for future enhancement ideas!

