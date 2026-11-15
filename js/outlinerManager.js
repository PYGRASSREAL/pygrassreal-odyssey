/**
 * Outliner & Layers Manager
 * Unreal Engine 5 & Rhino 3D styled Outliner hierarchy, layer states,
 * visibility/lock toggling, 2-step confirmation deletion, and shading sync.
 */
import { pushHistory } from './historyManager.js';

export const placedInstances = [];
export let selectedInstanceId = null;

let pendingDeleteInstanceId = null;
let pendingDeleteInstanceTimeout = null;

let pendingDeleteLayerKey = null;
let pendingDeleteLayerTimeout = null;

export const py3sLayersState = {
  splat: true,
  collider: false,
  solid: false,
  terrain: true
};

export const py3sLayersLocked = {
  splat: false,
  collider: false,
  solid: false,
  terrain: true
};

export const py3sLayersDeleted = {
  splat: false,
  collider: false,
  solid: false,
  terrain: false
};

export let selectedRhinoLayer = 'splat';

// External hook listeners
let onSelectionChangeHook = null;
let onDeleteInstanceHook = null;
let onLayerStateChangeHook = null;

export function registerOutlinerHooks({
  onSelectionChange = null,
  onDeleteInstance = null,
  onLayerStateChange = null
} = {}) {
  if (onSelectionChange) onSelectionChangeHook = onSelectionChange;
  if (onDeleteInstance) onDeleteInstanceHook = onDeleteInstance;
  if (onLayerStateChange) onLayerStateChangeHook = onLayerStateChange;
}

export function getSelectedInstance() {
  return placedInstances.find(i => i.id === selectedInstanceId && !i.deleted) || null;
}

export function selectInstance(instanceId) {
  selectedInstanceId = instanceId;
  const inst = placedInstances.find(i => i.id === instanceId);

  if (onSelectionChangeHook) {
    onSelectionChangeHook(instanceId, inst);
  }

  updateRhinoLayersUI();
}

export function selectTerrainLayer() {
  selectedInstanceId = 'terrain';
  if (onSelectionChangeHook) {
    onSelectionChangeHook('terrain', null);
  }
  updateRhinoLayersUI();
}

export function toggleInstanceVisibility(event, instanceId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const inst = placedInstances.find(i => i.id === instanceId);
  if (!inst) return;
  inst.visible = !inst.visible;
  if (inst.group) {
    inst.group.visible = inst.visible;
  }

  if (onSelectionChangeHook) {
    onSelectionChangeHook(selectedInstanceId, getSelectedInstance());
  }
  updateRhinoLayersUI();
}

export function toggleInstanceLock(event, instanceId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const inst = placedInstances.find(i => i.id === instanceId);
  if (!inst) return;
  inst.locked = !inst.locked;

  if (onSelectionChangeHook) {
    onSelectionChangeHook(selectedInstanceId, getSelectedInstance());
  }
  updateRhinoLayersUI();
}

/**
 * Two-Step Confirmation Deletion for placed 3D instances.
 * First click shows a pulsing red warning. Second click within 4.5s deletes permanently.
 */
export function handleDeleteInstance(event, instanceId) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  if (pendingDeleteInstanceId === instanceId) {
    if (pendingDeleteInstanceTimeout) {
      clearTimeout(pendingDeleteInstanceTimeout);
      pendingDeleteInstanceTimeout = null;
    }
    pendingDeleteInstanceId = null;
    executeDeleteInstance(instanceId);
  } else {
    if (pendingDeleteInstanceTimeout) clearTimeout(pendingDeleteInstanceTimeout);
    pendingDeleteInstanceId = instanceId;
    updateRhinoLayersUI();

    pendingDeleteInstanceTimeout = setTimeout(() => {
      pendingDeleteInstanceId = null;
      updateRhinoLayersUI();
    }, 4500);
  }
}

export function executeDeleteInstance(instanceId) {
  const inst = placedInstances.find(i => i.id === instanceId);
  if (!inst) return;
  inst.deleted = true;

  pushHistory({
    type: 'delete',
    instanceId: instanceId
  });

  if (onDeleteInstanceHook) {
    onDeleteInstanceHook(instanceId, inst);
  }

  if (selectedInstanceId === instanceId) {
    const remaining = placedInstances.filter(i => !i.deleted);
    if (remaining.length > 0) {
      selectInstance(remaining[remaining.length - 1].id);
    } else {
      selectedInstanceId = null;
      if (onSelectionChangeHook) onSelectionChangeHook(null, null);
    }
  }

  updateRhinoLayersUI();
}

// Backwards compatibility layer methods
export function toggleRhinoVisibility(event, layerName) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (layerName === 'terrain') {
    py3sLayersState.terrain = !py3sLayersState.terrain;
    if (window.toggleEnvironment) {
      window.toggleEnvironment();
    }
    updateRhinoLayersUI();
    return;
  }
  const inst = placedInstances.find(i => !i.deleted);
  if (inst) toggleInstanceVisibility(event, inst.id);
}

export function toggleRhinoLock(event, layerName) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (layerName === 'terrain') {
    py3sLayersLocked.terrain = !py3sLayersLocked.terrain;
    updateRhinoLayersUI();
    return;
  }
  const inst = placedInstances.find(i => !i.deleted);
  if (inst) toggleInstanceLock(event, inst.id);
}

export function selectRhinoLayer(layerName) {
  if (layerName === 'terrain') {
    selectTerrainLayer();
    return;
  }
  const inst = placedInstances.find(i => !i.deleted);
  if (inst) selectInstance(inst.id);
}

export function handleDeleteLayer(event, layerKey) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (layerKey === 'terrain') {
    if (pendingDeleteLayerKey === 'terrain') {
      if (pendingDeleteLayerTimeout) clearTimeout(pendingDeleteLayerTimeout);
      pendingDeleteLayerKey = null;
      py3sLayersState.terrain = false;
      if (window.toggleEnvironment) window.toggleEnvironment();
      updateRhinoLayersUI();
    } else {
      pendingDeleteLayerKey = 'terrain';
      updateRhinoLayersUI();
      pendingDeleteLayerTimeout = setTimeout(() => {
        pendingDeleteLayerKey = null;
        updateRhinoLayersUI();
      }, 4500);
    }
    return;
  }
  const inst = placedInstances.find(i => !i.deleted);
  if (inst) handleDeleteInstance(event, inst.id);
}

export function executeDeleteLayer(layerKey) {
  if (layerKey === 'terrain') {
    py3sLayersState.terrain = false;
    if (window.toggleEnvironment) window.toggleEnvironment();
    updateRhinoLayersUI();
    return;
  }
  const inst = placedInstances.find(i => !i.deleted);
  if (inst) executeDeleteInstance(inst.id);
}

export function updateRhinoLayersUI() {
  const container = document.getElementById('rhino-table-body');
  if (!container) return;

  const activeInstances = placedInstances.filter(i => !i.deleted);

  if (activeInstances.length === 0) {
    container.innerHTML = `
      <div style="font-size: 0.68rem; color: #94a3b8; text-align: center; padding: 1.6rem 0.5rem; line-height: 1.6;">
        No 3D models in scene<br>
        <span style="font-size: 0.62rem; color: #64748b;">(Drag .py3s from left panel to place on ground)</span>
      </div>
    `;
    return;
  }

  let rowsHtml = '';
  for (const inst of activeInstances) {
    const isSelected = (selectedInstanceId === inst.id);
    const isConfirming = (pendingDeleteInstanceId === inst.id);
    const posX = inst.group ? inst.group.position.x.toFixed(1) : '0.0';
    const posZ = inst.group ? inst.group.position.z.toFixed(1) : '0.0';

    rowsHtml += `
      <div class="rhino-layer-row ${isSelected ? 'selected' : ''} ${!inst.visible ? 'layer-hidden' : ''}" 
           id="rhino-row-${inst.id}" 
           onclick="window.selectInstance('${inst.id}')"
           title="Click to select & transform: ${escapeHtml(inst.layerName)}">
        <button class="rhino-btn-icon ${inst.visible ? 'visible' : 'hidden'}" 
                id="rhino-vis-${inst.id}" 
                onclick="window.toggleInstanceVisibility(event, '${inst.id}')"
                title="Visibility: ${inst.visible ? 'Visible (Click to hide)' : 'Hidden (Click to show)'}">
          ${inst.visible ? '👁️' : '🚫'}
        </button>
        <button class="rhino-btn-icon ${inst.locked ? 'locked' : 'unlocked'}" 
                id="rhino-lock-${inst.id}" 
                onclick="window.toggleInstanceLock(event, '${inst.id}')"
                title="Lock: ${inst.locked ? 'Locked (Click to unlock)' : 'Unlocked (Click to lock)'}">
          ${inst.locked ? '🔒' : '🔓'}
        </button>
        <div class="rhino-layer-info">
          <span class="rhino-layer-name">${escapeHtml(inst.layerName)}</span>
          <span class="rhino-layer-desc" id="rhino-desc-${inst.id}">POS: X:${posX} Z:${posZ} • .py3s</span>
        </div>
        <button class="btn-layer-del ${isConfirming ? 'confirming' : ''}" 
                id="btn-del-${inst.id}" 
                onclick="window.handleDeleteInstance(event, '${inst.id}')"
                title="${isConfirming ? 'Click again to confirm deletion' : 'Delete model (Click twice to confirm)'}">
          ${isConfirming ? '⚠️ Delete?' : '🗑️'}
        </button>
      </div>
    `;
  }

  container.innerHTML = rowsHtml;
}

export function togglePy3sLayer(layerName) {
  if (py3sLayersState.hasOwnProperty(layerName)) {
    py3sLayersState[layerName] = !py3sLayersState[layerName];
  }
  applyPy3sLayers();
}

export function applyPy3sLayers() {
  if (onLayerStateChangeHook) {
    onLayerStateChangeHook(py3sLayersState);
  }

  // Synchronize Left Panel Single Toggle Button
  const btnCol = document.getElementById('btn-shade-collider');
  const swCol = document.getElementById('switch-collider');
  if (btnCol) btnCol.classList.toggle('active', py3sLayersState.collider);
  if (swCol) swCol.classList.toggle('active', py3sLayersState.collider);

  updateRhinoLayersUI();
}

export function toggleColliderMode() {
  togglePy3sLayer('collider');
}

export function setShadingMode(mode) {
  if (mode === 'collider') {
    py3sLayersState.collider = true;
  } else {
    py3sLayersState.collider = false;
  }
  applyPy3sLayers();
}

export function applyShadingMode() {
  applyPy3sLayers();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Window bindings for inline HTML onclick attributes
if (typeof window !== 'undefined') {
  window.placedInstances = placedInstances;
  window.selectInstance = selectInstance;
  window.selectTerrainLayer = selectTerrainLayer;
  window.toggleInstanceVisibility = toggleInstanceVisibility;
  window.toggleInstanceLock = toggleInstanceLock;
  window.handleDeleteInstance = handleDeleteInstance;
  window.executeDeleteInstance = executeDeleteInstance;
  window.toggleRhinoVisibility = toggleRhinoVisibility;
  window.toggleRhinoLock = toggleRhinoLock;
  window.selectRhinoLayer = selectRhinoLayer;
  window.handleDeleteLayer = handleDeleteLayer;
  window.executeDeleteLayer = executeDeleteLayer;
  window.updateRhinoLayersUI = updateRhinoLayersUI;
  window.togglePy3sLayer = togglePy3sLayer;
  window.py3sLayersState = py3sLayersState;
  window.py3sLayersLocked = py3sLayersLocked;
  window.py3sLayersDeleted = py3sLayersDeleted;
  window.toggleColliderMode = toggleColliderMode;
  window.setShadingMode = setShadingMode;
  window.applyShadingMode = applyShadingMode;
}

