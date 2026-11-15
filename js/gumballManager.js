import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { pushHistory } from './historyManager.js';
import { pickObjectInstanceAt } from './objectInteraction.js';
import { groundModelInstance } from './modelGrounding.js';

let transformControls = null;
let currentGumballMode = 'translate';
let isGumballActive = true;
let isTransformDragging = false;
let transformDragStartSnapshot = null;

let mainCamera = null;
let mainRenderer = null;
let mainOrbitControls = null;
let mainScene = null;
let getTargetInstanceFn = () => null;
let onSelectInstanceFn = () => {};

/**
 * Initializes Rhino 3D Gumball TransformControls (Move / Rotate / Scale).
 * Manages full 3D Gizmo lifecycle and syncs with Layers and Coordinates HUD.
 */
export function initGumballControls({
  camera,
  renderer,
  orbitControls,
  scene,
  getTargetInstance,
  onSelectInstance
}) {
  if (transformControls) return transformControls;

  mainCamera = camera;
  mainRenderer = renderer;
  mainOrbitControls = orbitControls;
  mainScene = scene;
  getTargetInstanceFn = getTargetInstance || getTargetInstanceFn;
  onSelectInstanceFn = onSelectInstance || onSelectInstanceFn;

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.size = 0.85;
  transformControls.setMode(currentGumballMode);

  const helper = transformControls.getHelper();
  helper.name = 'RhinoGumballHelper';
  mainScene.add(helper);

  transformControls.addEventListener('dragging-changed', (event) => {
    isTransformDragging = !!event.value;
    if (orbitControls) {
      orbitControls.enabled = !event.value;
    }

    const inst = getTargetInstanceFn();
    if (event.value) {
      if (inst && inst.group) {
        transformDragStartSnapshot = {
          pos: inst.group.position.clone(),
          rot: inst.group.rotation.clone(),
          scl: inst.group.scale.clone()
        };
      }
    } else {
      if (inst && inst.group && transformDragStartSnapshot) {
        const pDiff = inst.group.position.distanceTo(transformDragStartSnapshot.pos);
        const rDiff = Math.abs(inst.group.rotation.x - transformDragStartSnapshot.rot.x) +
                      Math.abs(inst.group.rotation.y - transformDragStartSnapshot.rot.y) +
                      Math.abs(inst.group.rotation.z - transformDragStartSnapshot.rot.z);
        const sDiff = Math.abs(inst.group.scale.x - transformDragStartSnapshot.scl.x) +
                      Math.abs(inst.group.scale.y - transformDragStartSnapshot.scl.y) +
                      Math.abs(inst.group.scale.z - transformDragStartSnapshot.scl.z);
        if (pDiff > 0.001 || rDiff > 0.001 || sDiff > 0.001) {
          pushHistory({
            type: 'transform',
            instanceId: inst.id,
            before: {
              pos: transformDragStartSnapshot.pos,
              rot: transformDragStartSnapshot.rot,
              scl: transformDragStartSnapshot.scl
            },
            after: {
              pos: inst.group.position.clone(),
              rot: inst.group.rotation.clone(),
              scl: inst.group.scale.clone()
            }
          });
        }
      }
      transformDragStartSnapshot = null;
    }
  });

  transformControls.addEventListener('change', () => {
    const inst = getTargetInstanceFn();
    if (inst && inst.group) {
      inst.group.updateMatrixWorld(true);
      updateGumballCoordinatesUI();
    }
  });

  // 3D Raycasting model picker
  let pointerStart = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerStart.set(e.clientX, e.clientY);
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;
    if (isTransformDragging) return;
    const dist = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y);
    if (dist > 6) return; // Camera orbit drag, not click
    if (transformControls && transformControls.axis !== null) return; // Clicked on Gizmo axis

    const hitInst = pickObjectInstanceAt(e.clientX, e.clientY);

    if (hitInst) {
      onSelectInstanceFn(hitInst.id);
    }
  });

  // CAD / Rhino / Blender keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (['input', 'textarea'].includes((e.target?.tagName || '').toLowerCase())) return;
    const key = (e.key || '').toLowerCase();
    if (key === 'g' || e.code === 'KeyG') {
      setGumballMode('translate');
    } else if (key === 'r' && !e.ctrlKey && !e.metaKey && e.code === 'KeyR') {
      setGumballMode('rotate');
    } else if (key === 'c' || e.code === 'KeyC') {
      setGumballMode('scale');
    } else if (e.key === 'Escape') {
      selectModel(false);
    }
  });

  updateGumballUI();
  updateGumballCoordinatesUI();
  return transformControls;
}

export function getTransformControls() {
  return transformControls;
}

export function selectModel(selected = true) {
  isGumballActive = selected;
  if (!transformControls) return;

  if (selected) {
    const inst = getTargetInstanceFn();
    if (inst && inst.group && !inst.locked && inst.visible) {
      transformControls.attach(inst.group);
      transformControls.getHelper().visible = true;
    }
  } else {
    transformControls.detach();
    transformControls.getHelper().visible = false;
  }
  updateGumballUI();
  updateGumballCoordinatesUI();
}

export function toggleGumball(forceState) {
  if (forceState !== undefined) {
    isGumballActive = forceState;
  } else {
    isGumballActive = !isGumballActive;
  }
  selectModel(isGumballActive);
}

export function setGumballMode(mode) {
  if (!['translate', 'rotate', 'scale'].includes(mode)) return;
  currentGumballMode = mode;
  if (transformControls) {
    transformControls.setMode(mode);
    if (!isGumballActive) {
      selectModel(true);
    } else {
      updateGumballUI();
    }
  }
}

export function resetModelTransform(terrainHeightFn) {
  const inst = getTargetInstanceFn();
  if (inst && inst.group) {
    const before = {
      pos: inst.group.position.clone(),
      rot: inst.group.rotation.clone(),
      scl: inst.group.scale.clone()
    };
    inst.group.rotation.set(0, 0, 0);
    if (inst.defaultScale) inst.group.scale.copy(inst.defaultScale);
    else inst.group.scale.set(1, 1, 1);
    if (terrainHeightFn) {
      groundModelInstance(inst, terrainHeightFn);
    }
    inst.group.updateMatrixWorld(true);
    if (transformControls && !inst.locked && inst.visible) {
      transformControls.attach(inst.group);
    }
    pushHistory({
      type: 'transform',
      instanceId: inst.id,
      before,
      after: {
        pos: inst.group.position.clone(),
        rot: inst.group.rotation.clone(),
        scl: inst.group.scale.clone()
      }
    });
  }
  updateGumballCoordinatesUI();
}

export function snapModelToGround(terrainHeightFn) {
  const inst = getTargetInstanceFn();
  if (inst && inst.group && terrainHeightFn) {
    const before = {
      pos: inst.group.position.clone(),
      rot: inst.group.rotation.clone(),
      scl: inst.group.scale.clone()
    };
    groundModelInstance(inst, terrainHeightFn);
    inst.group.updateMatrixWorld(true);
    pushHistory({
      type: 'transform',
      instanceId: inst.id,
      before,
      after: {
        pos: inst.group.position.clone(),
        rot: inst.group.rotation.clone(),
        scl: inst.group.scale.clone()
      }
    });
  }
  updateGumballCoordinatesUI();
}

export function updateGumballUI() {
  const isAttached = transformControls && !!transformControls.object && transformControls.getHelper().visible;
  const switchEl = document.getElementById('switch-gumball');
  const dotEl = document.getElementById('gumball-status-dot');
  const textEl = document.getElementById('gumball-status-text');

  const inst = getTargetInstanceFn();

  if (switchEl) {
    if (isAttached) {
      switchEl.classList.add('active');
      switchEl.innerHTML = '<span>🎯 GIZMO ON</span>';
    } else {
      switchEl.classList.remove('active');
      switchEl.innerHTML = '<span>⚪ GIZMO OFF</span>';
    }
  }
  if (dotEl) {
    dotEl.className = 'gumball-status-indicator ' + (isAttached ? 'active' : '');
  }
  if (textEl) {
    if (isAttached && inst) {
      textEl.textContent = `Target: ${inst.layerName} (${currentGumballMode.toUpperCase()})`;
    } else if (inst && inst.locked) {
      textEl.textContent = `Target: ${inst.layerName} (LOCKED 🔒)`;
    } else if (isAttached) {
      textEl.textContent = `Target: Active Model (${currentGumballMode.toUpperCase()})`;
    } else {
      textEl.textContent = 'Target: Disabled (Off)';
    }
  }

  const modes = ['translate', 'rotate', 'scale'];
  for (const m of modes) {
    const btn = document.getElementById(`btn-gumball-${m}`);
    if (btn) {
      if (isAttached && currentGumballMode === m) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }
}

export function updateGumballCoordinatesUI() {
  const inst = getTargetInstanceFn();
  const targetObj = inst ? inst.group : null;
  if (!targetObj) return;

  const posEl = document.getElementById('coord-pos');
  const rotEl = document.getElementById('coord-rot');
  const sclEl = document.getElementById('coord-scl');

  if (posEl) {
    const p = targetObj.position;
    posEl.textContent = `X:${p.x.toFixed(1)} Y:${p.y.toFixed(1)} Z:${p.z.toFixed(1)}`;
  }
  if (rotEl) {
    const r = targetObj.rotation;
    const degX = Math.round(THREE.MathUtils.radToDeg(r.x));
    const degY = Math.round(THREE.MathUtils.radToDeg(r.y));
    const degZ = Math.round(THREE.MathUtils.radToDeg(r.z));
    rotEl.textContent = `${degX}° ${degY}° ${degZ}°`;
  }
  if (sclEl) {
    const s = targetObj.scale;
    sclEl.textContent = `${s.x.toFixed(2)}x`;
  }

  if (inst) {
    const descEl = document.getElementById(`rhino-desc-${inst.id}`);
    if (descEl) {
      descEl.textContent = `POS: X:${inst.group.position.x.toFixed(1)} Z:${inst.group.position.z.toFixed(1)} • .py3s`;
    }
  }
}

// Window globals for interactive UI
if (typeof window !== 'undefined') {
  window.toggleGumball = toggleGumball;
  window.setGumballMode = setGumballMode;
  window.resetModelTransform = () => resetModelTransform();
  window.snapModelToGround = () => snapModelToGround();
  window.selectModel = selectModel;
}

