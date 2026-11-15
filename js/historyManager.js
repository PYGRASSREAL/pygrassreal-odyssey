/**
 * historyManager.js - Professional Undo/Redo Engine for PyGrassReal Odyssey
 * Supports 3D model transforms (Translate, Rotate, Scale, Snap, Reset),
 * Model placement (Spawn), and Model deletions with hotkeys and UI sync.
 */

let undoStack = [];
let redoStack = [];
const MAX_HISTORY = 50;

let isExecutingHistory = false;
let sceneRef = null;
let placedInstancesRef = null;
let updateUIRef = null;
let selectInstanceRef = null;
let getTransformControlsRef = null;
let updateGumballUIRef = null;
let updateGumballCoordsRef = null;
let renderAssetListRef = null;
let applyInstancePhysicsRef = null;
let onPhysicsAppliedRef = null;

export function initHistoryManager(config = {}) {
  sceneRef = config.scene || null;
  placedInstancesRef = config.placedInstances || null;
  updateUIRef = config.updateRhinoLayersUI || null;
  selectInstanceRef = config.selectInstance || null;
  getTransformControlsRef = config.getTransformControls || null;
  updateGumballUIRef = config.updateGumballUI || null;
  updateGumballCoordsRef = config.updateGumballCoordinatesUI || null;
  renderAssetListRef = config.renderPy3sFileList || null;
  applyInstancePhysicsRef = config.applyInstancePhysics || null;
  onPhysicsAppliedRef = config.onPhysicsModeSelected || null;

  updateUndoRedoUI();
  setupKeyboardShortcuts();
}

export function pushHistory(action) {
  if (isExecutingHistory) return;
  undoStack.push(action);
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }
  redoStack = []; // Clear redo stack on any new user action
  updateUndoRedoUI();
}

export function undo() {
  if (undoStack.length === 0 || isExecutingHistory) return;
  isExecutingHistory = true;

  try {
    const action = undoStack.pop();
    redoStack.push(action);

    if (action.type === 'transform') {
      applyTransform(action.instanceId, action.before);
    } else if (action.type === 'physics') {
      applyPhysics(action.instanceId, action.before);
    } else if (action.type === 'spawn') {
      // Undo spawn -> delete/hide instance
      setInstanceDeleted(action.instanceId, true);
    } else if (action.type === 'delete') {
      // Undo delete -> restore instance
      setInstanceDeleted(action.instanceId, false);
    }
  } finally {
    isExecutingHistory = false;
    updateUndoRedoUI();
  }
}

export function redo() {
  if (redoStack.length === 0 || isExecutingHistory) return;
  isExecutingHistory = true;

  try {
    const action = redoStack.pop();
    undoStack.push(action);

    if (action.type === 'transform') {
      applyTransform(action.instanceId, action.after);
    } else if (action.type === 'physics') {
      applyPhysics(action.instanceId, action.after);
    } else if (action.type === 'spawn') {
      // Redo spawn -> restore instance
      setInstanceDeleted(action.instanceId, false);
    } else if (action.type === 'delete') {
      // Redo delete -> re-delete instance
      setInstanceDeleted(action.instanceId, true);
    }
  } finally {
    isExecutingHistory = false;
    updateUndoRedoUI();
  }
}

function applyPhysics(instanceId, settings) {
  const inst = placedInstancesRef?.find(item => item.id === instanceId);
  if (!inst || !applyInstancePhysicsRef) return;
  applyInstancePhysicsRef(inst, settings);
  selectInstanceRef?.(inst.id);
  onPhysicsAppliedRef?.(inst, settings.mode);
}

function applyTransform(instanceId, transform) {
  if (!placedInstancesRef || !transform) return;
  const inst = placedInstancesRef.find(i => i.id === instanceId);
  if (!inst || !inst.group) return;

  if (transform.pos) inst.group.position.set(transform.pos.x, transform.pos.y, transform.pos.z);
  if (transform.rot) inst.group.rotation.set(transform.rot.x, transform.rot.y, transform.rot.z);
  if (transform.scl) inst.group.scale.set(transform.scl.x, transform.scl.y, transform.scl.z);

  inst.group.updateMatrixWorld(true);

  if (selectInstanceRef) selectInstanceRef(inst.id);
  if (updateGumballCoordsRef) updateGumballCoordsRef();
  if (updateGumballUIRef) updateGumballUIRef();
  if (updateUIRef) updateUIRef();
}

function setInstanceDeleted(instanceId, isDeleted) {
  if (!placedInstancesRef) return;
  const inst = placedInstancesRef.find(i => i.id === instanceId);
  if (!inst) return;

  inst.deleted = isDeleted;
  if (inst.group) {
    inst.group.visible = !isDeleted;
    if (sceneRef) {
      if (isDeleted) {
        sceneRef.remove(inst.group);
      } else {
        sceneRef.add(inst.group);
      }
    }
  }

  const tc = getTransformControlsRef ? getTransformControlsRef() : null;
  if (isDeleted) {
    if (tc && tc.object === inst.group) {
      tc.detach();
      tc.getHelper().visible = false;
    }
    const remaining = placedInstancesRef.filter(i => !i.deleted);
    if (remaining.length > 0 && selectInstanceRef) {
      selectInstanceRef(remaining[remaining.length - 1].id);
    }
  } else {
    if (selectInstanceRef) selectInstanceRef(inst.id);
  }

  if (updateUIRef) updateUIRef();
  if (renderAssetListRef) renderAssetListRef();
  if (updateGumballUIRef) updateGumballUIRef();
  if (updateGumballCoordsRef) updateGumballCoordsRef();
}

export function updateUndoRedoUI() {
  const btnUndo = document.getElementById('btn-undo');
  const btnRedo = document.getElementById('btn-redo');

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  if (btnUndo) {
    btnUndo.disabled = !canUndo;
    btnUndo.classList.toggle('disabled', !canUndo);
    btnUndo.title = canUndo 
      ? `Undo: ${undoStack[undoStack.length - 1].type.toUpperCase()} (Ctrl+Z)` 
      : 'Undo (Ctrl+Z) - No undo history';
  }

  if (btnRedo) {
    btnRedo.disabled = !canRedo;
    btnRedo.classList.toggle('disabled', !canRedo);
    btnRedo.title = canRedo 
      ? `Redo: ${redoStack[redoStack.length - 1].type.toUpperCase()} (Ctrl+Y)` 
      : 'Redo (Ctrl+Y) - No redo history';
  }
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (['input', 'textarea'].includes((e.target?.tagName || '').toLowerCase())) return;
    
    // Ctrl+Z or Cmd+Z (without shift) -> Undo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.code === 'KeyZ') && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    // Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z -> Redo
    else if (
      ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.code === 'KeyY')) ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ'))
    ) {
      e.preventDefault();
      redo();
    }
  });
}

// Global bindings for inline HTML onclick attributes
if (typeof window !== 'undefined') {
  window.historyUndo = undo;
  window.historyRedo = redo;
  window.pushHistory = pushHistory;
  window.updateUndoRedoUI = updateUndoRedoUI;
}

