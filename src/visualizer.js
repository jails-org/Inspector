/**
 * Visualizer - Renders components as interactive circular graph
 */

class ComponentGraphVisualizer {
  constructor(canvasElement, infoPanel) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.infoPanel = infoPanel;
    this.stateRequester = null; // Set by popup.js or devtools-panel.js
    this.nodeSelectedHandler = null; // Set by devtools-panel.js
    this.selectionClearedHandler = null; // Set by devtools-panel.js
    
    this.components = [];
    this.nodes = []; // Visual nodes (with positions)
    this.selectedNode = null;
    
    // Camera/view settings
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.minZoom = 0.3;
    this.maxZoom = 3;
    
    // Interaction
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragPanX = 0;
    this.dragPanY = 0;
    this.hoveredNode = null;

    // State update animations
    this.signalFlows = [];
    this.updatedNodePulses = new Map();
    this.animationFrameId = null;
    this.signalDuration = 650;
    this.signalCascadeDelay = 180;
    this.pulseDuration = 1200;

    this.setupCanvasSize();
    this.setupEventListeners();
  }

  setupCanvasSize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    this.canvas.addEventListener('click', this.onClick.bind(this));
    
    window.addEventListener('resize', () => this.setupCanvasSize());
  }

  onMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.dragStartX = e.clientX - rect.left;
    this.dragStartY = e.clientY - rect.top;
    this.dragPanX = this.panX;
    this.dragPanY = this.panY;
    this.isDragging = true;
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check hover
    this.hoveredNode = this.getNodeAtPosition(x, y);

    if (this.isDragging) {
      const deltaX = x - this.dragStartX;
      const deltaY = y - this.dragStartY;
      this.panX = this.dragPanX + deltaX / this.zoom;
      this.panY = this.dragPanY + deltaY / this.zoom;
      this.render();
    } else {
      this.render();
    }
  }

  onMouseUp() {
    this.isDragging = false;
  }

  onMouseLeave() {
    this.hoveredNode = null;
    this.isDragging = false;
  }

  onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const node = this.getNodeAtPosition(x, y);
    if (node) {
      this.selectedNode = node;
      if (this.nodeSelectedHandler) {
        this.nodeSelectedHandler(node);
      }
      this.render();
      this.showNodeInfo(node);
      // Request state from content script if available
      if (this.stateRequester) {
        this.stateRequester(node.component.id, (state) => {
          if (this.selectedNode === node) {
            this.updateNodeStateInfo(node, state);
          }
        });
      }
    } else {
      this.selectedNode = null;
      if (this.selectionClearedHandler) {
        this.selectionClearedHandler();
      }
      this.infoPanel.innerHTML = '<p class="placeholder">Select a component to view details</p>';
      this.render();
    }
  }

  onWheel(e) {
    e.preventDefault();
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width / window.devicePixelRatio;
    const height = rect.height / window.devicePixelRatio;
    const worldXBeforeZoom = (x - width / 2) / this.zoom - this.panX;
    const worldYBeforeZoom = (y - height / 2) / this.zoom - this.panY;

    const clampedDelta = Math.max(-80, Math.min(80, e.deltaY));
    const zoomFactor = Math.exp(-clampedDelta * 0.002);
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));
    
    // Keep the graph point under the cursor stable while zooming.
    this.panX = (x - width / 2) / newZoom - worldXBeforeZoom;
    this.panY = (y - height / 2) / newZoom - worldYBeforeZoom;
    this.zoom = newZoom;
    
    this.render();
  }

  getNodeAtPosition(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width / window.devicePixelRatio;
    const height = rect.height / window.devicePixelRatio;

    for (let node of this.nodes) {
      // Convert world coordinates to screen coordinates
      const screenX = (width / 2) + (node.x + this.panX) * this.zoom;
      const screenY = (height / 2) + (node.y + this.panY) * this.zoom;
      const dist = Math.sqrt((x - screenX) ** 2 + (y - screenY) ** 2);
      if (dist <= node.radius * this.zoom + 5) {
        return node;
      }
    }
    return null;
  }

  setComponents(components) {
    this.components = components;
    this.signalFlows = [];
    this.updatedNodePulses.clear();
    this.calculateLayout();
    this.render();
  }

  calculateLayout() {
    // Create hierarchical tree layout
    const nodes = new Map();
    const startX = 0;
    const startY = -260;
    const nodeRadius = 84;
    const verticalSpacing = nodeRadius * 3.25;
    const horizontalSpacing = nodeRadius * 3.35;

    // Group components by depth
    const depthGroups = {};
    this.components.forEach(component => {
      const depth = component.depth || 0;
      if (!depthGroups[depth]) {
        depthGroups[depth] = [];
      }
      depthGroups[depth].push(component);
    });

    // Position root nodes
    const rootComponents = this.components.filter(c => c.parentId === null);
    const nodesPerLevel = Math.max(1, Math.ceil(Math.sqrt(this.components.length)));

    // Calculate positions using hierarchical layout
    let nodeIndex = 0;
    Object.keys(depthGroups).sort((a, b) => a - b).forEach((depth) => {
      const componentsAtDepth = depthGroups[depth];
      const levelY = startY + (parseInt(depth) * verticalSpacing);
      
      componentsAtDepth.forEach((component, index) => {
        const totalAtDepth = componentsAtDepth.length;
        const centerOffset = (totalAtDepth - 1) * horizontalSpacing / 2;
        const x = startX + (index * horizontalSpacing) - centerOffset;
        const y = levelY;

        nodes.set(component.id, {
          id: component.id,
          name: component.name,
          component,
          x,
          y,
          radius: nodeRadius,
        });
      });
    });

    this.nodes = Array.from(nodes.values());
  }

  render() {
    const now = performance.now();
    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;

    // Clear canvas
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.save();
    this.ctx.translate(width / 2, height / 2);
    this.ctx.scale(this.zoom, this.zoom);
    this.ctx.translate(this.panX, this.panY);

    // Draw connections
    this.drawConnections();
    this.drawSignalFlows(now);

    // Draw nodes
    this.drawNodes(now);

    this.ctx.restore();
  }

  drawConnections() {
    this.ctx.strokeStyle = '#60a5fa';
    this.ctx.lineWidth = 2;
    this.ctx.lineJoin = 'round';

    for (let node of this.nodes) {
      if (node.component.parentId !== null) {
        const parentNode = this.nodes.find(n => n.id === node.component.parentId);
        if (parentNode) {
          const path = this.getOrthogonalEdgePath(parentNode, node);

          this.ctx.beginPath();
          this.ctx.moveTo(path[0].x, path[0].y);
          path.slice(1).forEach(point => {
            this.ctx.lineTo(point.x, point.y);
          });
          this.ctx.stroke();
        }
      }
    }
  }

  drawSignalFlows(now) {
    this.signalFlows = this.signalFlows.filter((signal) => {
      return now <= signal.startTime + signal.duration;
    });

    for (let signal of this.signalFlows) {
      if (now < signal.startTime) {
        continue;
      }

      const fromNode = this.nodes.find(n => n.id === signal.fromId);
      const toNode = this.nodes.find(n => n.id === signal.toId);
      if (!fromNode || !toNode) {
        continue;
      }

      const progress = Math.min(1, Math.max(0, (now - signal.startTime) / signal.duration));
      const eased = this.easeOutCubic(progress);
      const path = this.getOrthogonalEdgePath(fromNode, toNode);
      const signalPoint = this.getPointOnPath(path, eased);
      const partialPath = this.getPartialPath(path, eased);

      this.ctx.save();
      this.ctx.strokeStyle = `rgba(52, 211, 153, ${0.25 + (1 - progress) * 0.45})`;
      this.ctx.lineWidth = 5;
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(partialPath[0].x, partialPath[0].y);
      partialPath.slice(1).forEach(point => {
        this.ctx.lineTo(point.x, point.y);
      });
      this.ctx.stroke();

      this.ctx.fillStyle = '#34d399';
      this.ctx.shadowColor = '#34d399';
      this.ctx.shadowBlur = 12;
      this.ctx.beginPath();
      this.ctx.arc(signalPoint.x, signalPoint.y, 5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  getOrthogonalEdgePath(parentNode, childNode) {
    const start = {
      x: parentNode.x,
      y: parentNode.y + parentNode.radius,
    };
    const end = {
      x: childNode.x,
      y: childNode.y - childNode.radius,
    };
    const midY = start.y + (end.y - start.y) / 2;

    return [
      start,
      { x: start.x, y: midY },
      { x: end.x, y: midY },
      end,
    ];
  }

  getPointOnPath(path, progress) {
    const segmentLengths = [];
    const totalLength = path.slice(1).reduce((total, point, index) => {
      const previous = path[index];
      const length = Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
      segmentLengths.push(length);
      return total + length;
    }, 0);

    if (totalLength === 0) {
      return path[0];
    }

    let distance = totalLength * progress;

    for (let index = 1; index < path.length; index++) {
      const previous = path[index - 1];
      const current = path[index];
      const segmentLength = segmentLengths[index - 1];

      if (distance <= segmentLength) {
        const segmentProgress = segmentLength === 0 ? 0 : distance / segmentLength;
        return {
          x: previous.x + (current.x - previous.x) * segmentProgress,
          y: previous.y + (current.y - previous.y) * segmentProgress,
        };
      }

      distance -= segmentLength;
    }

    return path[path.length - 1];
  }

  getPartialPath(path, progress) {
    const point = this.getPointOnPath(path, progress);
    const partialPath = [path[0]];
    const targetDistance = this.getPathLength(path) * progress;
    let traveledDistance = 0;

    for (let index = 1; index < path.length; index++) {
      const previous = path[index - 1];
      const current = path[index];
      const segmentLength = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);

      if (traveledDistance + segmentLength >= targetDistance) {
        partialPath.push(point);
        return partialPath;
      }

      traveledDistance += segmentLength;
      partialPath.push(current);
    }

    return partialPath;
  }

  getPathLength(path) {
    return path.slice(1).reduce((total, point, index) => {
      const previous = path[index];
      return total + Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
    }, 0);
  }

  drawNodes(now) {
    this.updatedNodePulses.forEach((startedAt, nodeId) => {
      if (now > startedAt + this.pulseDuration) {
        this.updatedNodePulses.delete(nodeId);
      }
    });

    for (let node of this.nodes) {
      const isSelected = this.selectedNode === node;
      const isHovered = this.hoveredNode === node;
      const pulseStartedAt = this.updatedNodePulses.get(node.id);

      if (pulseStartedAt) {
        const progress = Math.min(1, (now - pulseStartedAt) / this.pulseDuration);
        const pulseRadius = node.radius + 10 + progress * 18;
        const alpha = Math.max(0, 1 - progress);

        this.ctx.save();
        this.ctx.strokeStyle = `rgba(52, 211, 153, ${alpha})`;
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }

      // Draw shadow
      if (isSelected || isHovered) {
        this.ctx.fillStyle = isSelected ? '#60a5fa' : '#94a3b8';
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Draw node circle
      this.ctx.fillStyle = pulseStartedAt ? '#064e3b' : (isSelected ? '#3b82f6' : '#1e293b');
      this.ctx.strokeStyle = pulseStartedAt ? '#34d399' : (isSelected ? '#60a5fa' : '#475569');
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Draw text
      this.ctx.fillStyle = '#e2e8f0';
      this.ctx.font = 'bold 11px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      // Truncate long names
      let displayName = node.name;
      if (displayName.length > 12) {
        displayName = displayName.substr(0, 10) + '...';
      }

      this.ctx.fillText(displayName, node.x, node.y);

      // Draw cursor feedback
      if (isHovered) {
        this.canvas.style.cursor = 'pointer';
      }
    }

    if (!this.hoveredNode) {
      this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'grab';
    }
  }

  notifyComponentUpdated(componentId) {
    const node = this.nodes.find(n => n.id === componentId);
    if (!node) {
      return;
    }

    const startedAt = performance.now();
    this.updatedNodePulses.set(componentId, startedAt);
    this.enqueueChildSignals(node, startedAt);
    this.startAnimationLoop();
    this.render();
  }

  enqueueChildSignals(parentNode, startedAt, depth = 0) {
    const childIds = parentNode.component.children || [];

    childIds.forEach((childId) => {
      const childNode = this.nodes.find(n => n.id === childId);
      if (!childNode) {
        return;
      }

      const signalStartedAt = startedAt + depth * this.signalCascadeDelay;
      this.signalFlows.push({
        fromId: parentNode.id,
        toId: childNode.id,
        startTime: signalStartedAt,
        duration: this.signalDuration,
      });

      this.enqueueChildSignals(childNode, startedAt, depth + 1);
    });
  }

  startAnimationLoop() {
    if (this.animationFrameId) {
      return;
    }

    const tick = () => {
      this.animationFrameId = null;
      this.render();

      if (this.signalFlows.length > 0 || this.updatedNodePulses.size > 0) {
        this.animationFrameId = requestAnimationFrame(tick);
      }
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  showNodeInfo(node) {
    const component = node.component;
    let html = '<dl class="component-info">';
    
    html += `<dt>Name</dt><dd>${this.escapeHtml(component.tag)}</dd>`;
    html += `<dt>Depth</dt><dd>${component.depth}</dd>`;
    html += `<dt>Children</dt><dd>${component.childCount}</dd>`;
    // html += `<dt>Has Template</dt><dd>${component.hasTemplate ? 'Yes' : 'No'}</dd>`;
    
    if (component.children && component.children.length > 0) {
      html += `<dt>Child Cmps</dt><dd>${component.children.length}</dd>`;
    }
    
    if (Object.keys(component.dataAttributes).length > 0) {
      html += `<dt>Data</dt><dd class="small">${this.escapeHtml(JSON.stringify(component.dataAttributes))}</dd>`;
    }
    
    if (component.classList.length > 0) {
      html += `<dt>Classes</dt><dd class="small">${this.escapeHtml(component.classList.join(', '))}</dd>`;
    }

    html += '</dl>';
    this.infoPanel.innerHTML = html;
  }

  updateNodeStateInfo(node, state) {
    this.removeExistingStateInfo();

    let html = this.infoPanel.innerHTML;

    html += '<hr class="panel-divider state-divider">';
    html += '<section class="state-section" id="component-state-section">';
    html += '<h2 class="state-title">State</h2>';
    html += this.renderJsonTree(state, { expanded: true });
    html += '</section>';
    
    this.infoPanel.innerHTML = html;
  }

  removeExistingStateInfo() {
    const existingStateSection = this.infoPanel.querySelector('#component-state-section');
    const existingStateDivider = this.infoPanel.querySelector('.state-divider');

    if (existingStateSection) {
      existingStateSection.remove();
    }

    if (existingStateDivider) {
      existingStateDivider.remove();
    }
  }

  renderJsonTree(value, options = {}) {
    return `<div class="json-tree">${this.renderJsonValue(value, 'state', {
      expanded: options.expanded,
      isRoot: true,
    })}</div>`;
  }

  renderJsonValue(value, key, options = {}) {
    if (!this.isExpandable(value)) {
      return this.renderJsonRow(key, this.renderPrimitive(value), options);
    }

    const entries = this.getObjectEntries(value);
    const type = Array.isArray(value) ? 'array' : 'object';
    const isEmpty = entries.length === 0;
    const summary = this.renderSummary(key, value, options);
    const childRows = entries
      .map(([childKey, childValue]) => this.renderJsonValue(childValue, childKey))
      .join('');
    const emptyLabel = type === 'array' ? 'empty array' : 'empty object';

    return `
      <details class="json-node json-${type}" ${options.expanded && !isEmpty ? 'open' : ''}>
        <summary>${summary}</summary>
        <div class="json-children">
          ${isEmpty ? `<span class="json-empty">${emptyLabel}</span>` : childRows}
        </div>
      </details>
    `;
  }

  renderJsonRow(key, renderedValue, options = {}) {
    const label = options.isRoot ? '' : `<span class="json-key">${this.escapeHtml(String(key))}</span><span class="json-colon">:</span> `;
    return `<div class="json-row">${label}${renderedValue}</div>`;
  }

  renderSummary(key, value, options = {}) {
    const label = options.isRoot ? '' : `<span class="json-key">${this.escapeHtml(String(key))}</span><span class="json-colon">:</span> `;
    return `${label}<span class="json-preview">${this.escapeHtml(this.getObjectPreview(value))}</span>`;
  }

  renderPrimitive(value) {
    if (value === null) {
      return '<span class="json-null">null</span>';
    }

    if (typeof value === 'string') {
      return `<span class="json-string">"${this.escapeHtml(value)}"</span>`;
    }

    if (typeof value === 'number') {
      return `<span class="json-number">${Number.isNaN(value) ? 'NaN' : value}</span>`;
    }

    if (typeof value === 'boolean') {
      return `<span class="json-boolean">${value}</span>`;
    }

    if (typeof value === 'undefined') {
      return '<span class="json-undefined">undefined</span>';
    }

    return `<span class="json-unknown">${this.escapeHtml(String(value))}</span>`;
  }

  getObjectPreview(value) {
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }

    const entries = Object.entries(value);
    if (entries.length === 0) {
      return '{}';
    }

    const preview = entries
      .slice(0, 3)
      .map(([key, childValue]) => `${key}: ${this.getPreviewValue(childValue)}`)
      .join(', ');
    const suffix = entries.length > 3 ? ', ...' : '';
    return `{${preview}${suffix}}`;
  }

  getPreviewValue(value) {
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }

    if (value && typeof value === 'object') {
      return '{...}';
    }

    if (typeof value === 'string') {
      return `"${value}"`;
    }

    return String(value);
  }

  getObjectEntries(value) {
    if (Array.isArray(value)) {
      return value.map((item, index) => [index, item]);
    }

    return Object.entries(value);
  }

  isExpandable(value) {
    return value !== null && typeof value === 'object';
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  zoomIn() {
    this.zoom = Math.min(this.maxZoom, this.zoom * 1.2);
    this.render();
  }

  zoomOut() {
    this.zoom = Math.max(this.minZoom, this.zoom / 1.2);
    this.render();
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.selectedNode = null;
    this.infoPanel.innerHTML = '<p class="placeholder">Select a component to view details</p>';
    this.render();
  }
}
