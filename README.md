

<p align="center"><img align="center" width="202" height="82" alt="Screenshot 2026-06-25 at 20 56 06" src="https://github.com/user-attachments/assets/34458ea4-5192-494f-8996-682c6354b164" /></p>

<h1 align="center">Inspector</h1>

<p align="center">A browser extension dev tool for inspecting and visualizing Jails components in your web applications.</p>


<br />

<p align="center"><img width="640" height="400" alt="screenshot" src="https://github.com/user-attachments/assets/2066085b-0bb4-435f-abd3-2fe52e5f3015" /></p>
<br />
<br />

## Features

- ✨ **Component Discovery** - Automatically scans and finds all Jails components on the page
- 📊 **Interactive Visualization** - Displays components as an interactive circular graph
- 🎯 **Component Details** - Click on any component to view its properties and data
- 🔍 **Zoom & Pan** - Zoom in/out and pan around the component tree
- 📱 **DevTools Integration** - Available both as a popup and in browser DevTools


<br />
<br />

## Installation

### Chrome/Chromium

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dev-tools` folder
6. The extension should now appear in your extensions menu

### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select the `manifest.json` file from the `dev-tools` folder
4. The extension will be installed for this session

## Usage

### Via Popup

1. Click the Jails Inspector icon in your browser toolbar
2. Click "Scan Components" to discover all Jails components on the page
3. The circular graph will display all found components
4. Click on a node to see component details
5. Use the controls to zoom and pan:
   - **+/-**: Zoom in/out
   - **⊙**: Reset view
   - **Mouse Drag**: Pan around
   - **Mouse Wheel**: Zoom

### Via DevTools

1. Open Developer Tools (F12 or right-click → Inspect)
2. Look for the "🏝 Jails" tab
3. The same visualization and controls are available
4. The panel will automatically scan the current page

## How It Works

The extension works by:

1. **Content Script** - Scans the DOM for custom elements (components with hyphens in their tags)
2. **Component Analysis** - Collects component metadata like attributes, classes, and children
3. **Graph Visualization** - Renders components as nodes in a circular layout using Canvas
4. **Interactive Features** - Allows selection, zoom, and pan for better exploration

## Component Properties Displayed

When you click on a component node, you'll see:

- **Component**: The custom element tag name
- **Children**: Number of child elements
- **Has Template**: Whether the component has a template element
- **Data**: Any data attributes attached to the component
- **Classes**: CSS classes applied to the component

## Keyboard Shortcuts

- `Ctrl/Cmd + Scroll`: Zoom in/out
- `Click + Drag`: Pan the view
- `Click Node`: Select and view component details
- `Spacebar`: Reset view (coming soon)

## Development

### File Structure

```
dev-tools/
├── manifest.json           # Extension manifest
├── popup.html             # Popup UI
├── popup.js               # Popup logic
├── content.js             # Content script for DOM scanning
├── visualizer.js          # Canvas visualization engine
├── styles.css             # Styling
├── background.js          # Service worker
├── devtools.html          # DevTools page
├── devtools.js            # DevTools registration
├── devtools-panel.html    # DevTools panel UI
└── devtools-panel.js      # DevTools panel logic
```

### Technical Stack

- **Vanilla JavaScript** - No dependencies for maximum compatibility
- **Canvas API** - Used for rendering the interactive graph
- **Chrome Extension API** - For browser integration
- **Service Workers** - For background processing

## License

MIT

## Support

For issues or feature requests, please open an issue in the repository.

---

Made with ❤️ for the Jails framework
