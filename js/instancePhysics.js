import { isSplatPhysicsMode, isSplatFieldMode, SPLAT_FIELD_GRADIENT } from './splatPhysics.js?v=20261115_en_v21';
import { createAsyncSplatPhysicsSession } from './splatPhysicsAsync.js?v=20261115_en_v21';
import { pushHistory } from './historyManager.js';
import { createObjectInteraction } from './objectInteraction.js';

export const PHYSICS_MODES = [
  ['static', '◈', 'Solid / Collision', 'Stationary object with 1:1 Physics Collider for collision and walking'],
  ['ghost', '◇', 'Ghost / Passthrough', 'Standard 3DGS rendering, character passes through model'],
  ['stress-analysis', '↓', 'Stress Analysis', 'Compresses model and displays relative stress gradient'],
  ['megas-thermal', '♨', 'Thermal Expansion', 'Simulates heat expansion and contraction dynamics'],
  ['voronoi-fracture', '✧', 'Voronoi Fracture', 'Splits Gaussian splat clusters into Voronoi shards'],
  ['plant-wilting', '❧', 'Wilting & Sagging', 'Upper structure curves and sags based on intensity'],
  ['diffwind-aerodynamics', '≋', 'Aerodynamic Wind', 'Upper structure sways dynamically with wind turbulence'],
  ['physskin-deformation', '↝', 'Elastic Deformation', 'Deforms and twists Gaussian geometry elastically'],
  ['magnetic-mpm', '⊕', 'Magnetic MPM', 'Attracts Gaussian particles toward moving magnetic field'],
  ['enlivening-gs', '↟', 'Enlivening GS', 'Rhythmic pulsing, bouncing and organic vibration'],
];

const sessions = new Map();
let config = {};
let menu = null;
let parameters = null;
let world = null;
let targetId = null;
let parameterTargetId = null;
let outlineTargetId = null;
let menuPointer = null;
let previousFocus = null;

export function getPhysicsSettings(inst) {
  return { mode: 'static', strength: 0.65, paused: false, heatmap: true, ...inst?.physics };
}

export function hasInstanceCollision(inst) {
  return getPhysicsSettings(inst).mode === 'static';
}

function stopSession(inst) {
  const active = sessions.get(inst.id);
  active?.session.dispose();
  sessions.delete(inst.id);
}

function startSession(inst, mode) {
  // The worker and sort methods live on Viewer, inside the DropInViewer wrapper.
  const dropIn = inst.splatViewer;
  if (!dropIn?.viewer?.splatMesh) return null;
  inst.group.updateWorldMatrix(true, true);
  dropIn.updateWorldMatrix(true, true);
  dropIn.splatMesh.updateWorldMatrix(true, true);
  return createAsyncSplatPhysicsSession(dropIn.viewer, mode, dropIn.splatMesh.matrixWorld);
}

export function applyInstancePhysics(inst, settings, recordHistory = false) {
  if (!inst || inst.deleted || (recordHistory && (inst.locked || !inst.visible))) return false;
  if (!PHYSICS_MODES.some(([id]) => id === settings.mode)) return false;
  const before = getPhysicsSettings(inst);
  stopSession(inst);
  let session = null;
  if (isSplatPhysicsMode(settings.mode)) {
    session = startSession(inst, settings.mode);
    if (!session) {
      // Restore the old preview if the requested mode cannot be initialized.
      if (isSplatPhysicsMode(before.mode)) {
        const restored = startSession(inst, before.mode);
        if (restored) sessions.set(inst.id, { session: restored, elapsed: 0, accumulator: 0, dirty: true });
      }
      setStatus('This model has no Gaussian data ready for simulation. Please select Solid or Ghost.');
      return false;
    }
  }
  inst.physics = { ...before, ...settings };
  if (session) sessions.set(inst.id, { session, elapsed: 0, accumulator: 0, dirty: true });
  if (recordHistory && before.mode !== settings.mode) {
    pushHistory({ type: 'physics', instanceId: inst.id, before, after: { ...inst.physics } });
  }
  syncPhysicsUI();
  return true;
}

export function updateInstancePhysics(delta) {
  const activeScene = config.isActive?.() ?? true;
  // Undoing a deletion restores the instance; rebuild its disposed preview.
  for (const inst of config.placedInstances ?? []) {
    const settings = getPhysicsSettings(inst);
    if (activeScene && !inst.deleted && inst.visible && !inst.locked && isSplatPhysicsMode(settings.mode) && !sessions.has(inst.id)) {
      applyInstancePhysics(inst, settings);
    }
  }
  for (const [id, active] of sessions) {
    const inst = config.placedInstances?.find(item => item.id === id);
    if (!inst || inst.deleted) {
      active.session.dispose();
      sessions.delete(id);
      continue;
    }
    const dragging = config.getTransformControls?.()?.dragging;
    const enabled = activeScene && !document.hidden && inst.visible && !inst.locked && !(dragging && config.getSelectedInstance?.()?.id === id);
    active.session.setEnabled(enabled);
    if (!enabled) continue;
    const settings = getPhysicsSettings(inst);
    const dt = Math.min(Math.max(delta, 0), 0.1);
    if (!settings.paused) active.elapsed += dt;
    active.accumulator += dt;
    const interval = active.session.interval;
    if (active.accumulator < interval || (settings.paused && !active.dirty)) continue;
    active.accumulator = 0;
    if (!active.session.update(active.elapsed, settings.strength, settings.heatmap)) {
      stopSession(inst);
      inst.physics = { ...settings, mode: 'static' };
      syncPhysicsUI();
      setStatus('Model data changed. Please re-select physics mode.');
    }
    active.dirty = false;
  }
  if (!activeScene) {
    world?.update();
    closePhysicsMenu({ restoreFocus: false });
    if (parameters) parameters.hidden = true;
    document.body.classList.remove('object-physics-active');
  }
}

function editableTarget() {
  const inst = config.getSelectedInstance?.();
  return inst && !inst.deleted && inst.visible && !inst.locked ? inst : null;
}

export function getOutlinedInstance() {
  const inst = editableTarget();
  return inst?.id === outlineTargetId ? inst : null;
}

function moveMenuFocus(direction, edge = null) {
  const items = [...menu.querySelectorAll('[data-physics-mode]:not(:disabled)')];
  if (!items.length) return;
  let index = items.findIndex(item => item.dataset.physicsMode === menu.dataset.focusedMode);
  if (edge) index = edge === 'first' ? 0 : items.length - 1;
  else index = ((index < 0 ? (direction > 0 ? -1 : 0) : index) + direction + items.length) % items.length;
  items[index].focus({ preventScroll: true });
  items[index].scrollIntoView({ block: 'nearest' });
}

function setStatus(message) {
  const el = parameters?.querySelector('#physics-status');
  if (el) el.textContent = message;
}

export function syncPhysicsUI() {
  const inst = editableTarget();
  if (outlineTargetId && inst?.id !== outlineTargetId) outlineTargetId = null;
  const button = document.getElementById('btn-instance-physics');
  if (button) {
    button.disabled = !inst;
    const label = PHYSICS_MODES.find(([id]) => id === getPhysicsSettings(inst).mode)?.[2];
    button.querySelector('span').textContent = inst ? `3DGS · ${label}` : 'Select Model for Physics';
  }
  if (menu && !menu.hidden && (!inst || inst.id !== targetId)) closePhysicsMenu({ restoreFocus: false });
  if (!inst || inst.id !== parameterTargetId) {
    parameterTargetId = null;
    if (parameters) parameters.hidden = true;
  }
  if (!inst || !menu) return;
  const settings = getPhysicsSettings(inst);
  menu.querySelector('#physics-target').textContent = inst.layerName || inst.name;
  const available = !!inst.splatViewer?.viewer?.splatMesh?.splatDataTextures;
  for (const card of menu.querySelectorAll('[data-physics-mode]')) {
    const mode = card.dataset.physicsMode;
    card.disabled = isSplatPhysicsMode(mode) && !available;
    card.setAttribute('aria-checked', String(settings.mode === mode));
  }
  const preview = isSplatPhysicsMode(settings.mode);
  parameters.querySelector('#physics-parameter-target').textContent = inst.layerName || inst.name;
  parameters.querySelector('#physics-parameter-mode').textContent = PHYSICS_MODES.find(([id]) => id === settings.mode)?.[2];
  parameters.querySelector('#physics-playback').hidden = !preview;
  parameters.querySelector('#physics-strength').value = String(Math.round(settings.strength * 100));
  parameters.querySelector('#physics-strength-value').textContent = `${Math.round(settings.strength * 100)}%`;
  parameters.querySelector('#physics-pause').textContent = settings.paused ? '▶ Play' : 'Ⅱ Pause';
  parameters.querySelector('#physics-pause').setAttribute('aria-pressed', String(settings.paused));
  parameters.querySelector('#physics-heatmap-row').hidden = !isSplatFieldMode(settings.mode);
  parameters.querySelector('#physics-heatmap').checked = settings.heatmap;
  parameters.querySelector('#physics-legend').hidden = !isSplatFieldMode(settings.mode) || !settings.heatmap;
  parameters.hidden = parameterTargetId !== inst.id || !menu.hidden;
  setStatus(preview ? 'Deformation Preview · Character passes through model during preview' :
    settings.mode === 'ghost' ? 'Ghost Mode: Character passes through model · Other objects collide normally' :
    inst.colliders?.length ? '1:1 Physics Collider Active · Wireframe visibility configurable' : 'No colliders found in this model; collision unavailable');
}

export function closePhysicsMenu({ restoreFocus = true, keepParameters = false } = {}) {
  if (!menu) return;
  if (menu.hidden && !parameterTargetId && !outlineTargetId && parameters.hidden) return;
  menu.hidden = true;
  targetId = null;
  menuPointer = null;
  if (!keepParameters) {
    outlineTargetId = null;
    parameterTargetId = null;
    parameters.hidden = true;
    document.body.classList.remove('object-physics-active');
    config.releaseMovement?.();
  }
  syncPhysicsUI();
  if (restoreFocus && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
}

export function openPhysicsMenu(instance = null, pointer = null, showOutline = false) {
  if (!(config.isActive?.() ?? true) || config.getTransformControls?.()?.dragging) return;
  const inst = instance || editableTarget() || (parameterTargetId ? config.placedInstances?.find(i => i.id === parameterTargetId) : null);
  if (!inst || inst.deleted || !inst.visible || inst.locked || !menu) return;
  if (!menu.hidden && targetId === inst.id) { closePhysicsMenu(); return; }
  config.selectInstance(inst.id);
  if (showOutline) outlineTargetId = inst.id;
  config.hideGizmo?.();
  targetId = inst.id;
  menuPointer = pointer;
  previousFocus = document.activeElement;
  config.releaseMovement?.();
  menu.hidden = false;
  parameters.hidden = true;
  syncPhysicsUI();
  document.body.classList.add('object-physics-active');
  if (!world.place(menu, inst, 'side', menuPointer)) { closePhysicsMenu({ restoreFocus: false }); return; }
  const selected = menu.querySelector('[aria-checked="true"][data-physics-mode]');
  menu.dataset.focusedMode = selected?.dataset.physicsMode || '';
  selected?.focus({ preventScroll: true });
}

export function renderPhysicsInteraction(now) {
  if (!world) return;
  world.update();
  const inst = editableTarget();
  if (menu && !menu.hidden && inst?.id === targetId && !world.place(menu, inst, 'side', menuPointer)) closePhysicsMenu({ restoreFocus: false });
  if (parameterTargetId && inst?.id === parameterTargetId && (config.isActive?.() ?? true)) {
    if (menu.hidden) world.place(parameters, inst);
    else parameters.hidden = true;
  } else if (parameters) parameters.hidden = true;
  document.body.classList.toggle('object-physics-active', !menu.hidden || (parameterTargetId !== null && inst?.id === parameterTargetId));
  world.draw(now);
}

export function initInstancePhysics(options) {
  if (menu) return;
  config = options;
  world = createObjectInteraction({ ...options,
    getOutlineInstance: getOutlinedInstance,
    isMenuOpen: () => !menu?.hidden,
    getParameterTargetId: () => parameters && !parameters.hidden ? parameterTargetId : null,
    onInteract: inst => openPhysicsMenu(inst, null, true),
  });
  menu = document.createElement('div');
  menu.id = 'object-physics-menu'; menu.className = 'object-physics-menu'; menu.hidden = true;
  menu.innerHTML = `
    <header class="physics-header"><div><span class="physics-eyebrow">OBJECT PHYSICS</span>
      <strong id="physics-target"></strong></div>
      <button type="button" id="physics-close" aria-label="Close physics menu">✕</button></header>
    <div class="physics-mode-list" role="menu" aria-label="Select physics mode">
      ${PHYSICS_MODES.map(([id, icon, name, description]) => `
        <button type="button" role="menuitemradio" class="physics-mode-card" data-physics-mode="${id}" aria-checked="false" title="${description}">
          <span class="physics-mode-symbol" aria-hidden="true">${icon}</span>
          <span>${name}</span><span class="physics-mode-check" aria-hidden="true">✓</span>
        </button>`).join('')}
    </div>
    <div class="physics-menu-navigation" aria-label="Menu navigation">
      <button type="button" id="physics-menu-up" aria-label="Move Up (W)"><kbd>W</kbd> ↑</button>
      <button type="button" id="physics-menu-down" aria-label="Move Down (S)"><kbd>S</kbd> ↓</button>
      <button type="button" id="physics-menu-exit" aria-label="Exit Menu (Q)"><kbd>Q</kbd> Exit</button>
    </div><div class="physics-menu-hint">W: Up · S: Down · Enter: Select · Q: Exit</div>`;
  parameters = document.createElement('section');
  parameters.id = 'object-physics-parameters'; parameters.className = 'object-physics-parameters';
  parameters.hidden = true; parameters.tabIndex = -1;
  parameters.setAttribute('aria-label', 'Selected object physics parameters');
  parameters.innerHTML = `
    <header class="physics-header"><div><span class="physics-eyebrow" id="physics-parameter-target"></span>
      <strong id="physics-parameter-mode"></strong></div><button type="button" id="physics-parameters-close" aria-label="Hide parameters">✕</button></header>
    <div id="physics-playback" class="physics-playback" hidden>
      <div class="physics-strength-row"><label for="physics-strength">Strength</label><output id="physics-strength-value" for="physics-strength">65%</output></div>
      <input id="physics-strength" type="range" min="0" max="100" step="1" value="65" />
      <div class="physics-playback-actions"><button type="button" id="physics-pause">Ⅱ Pause</button>
        <button type="button" id="physics-restart">↺ Reset</button></div>
      <label id="physics-heatmap-row"><input id="physics-heatmap" type="checkbox" checked /> Heatmap</label>
      <div id="physics-legend"><div style="background:${SPLAT_FIELD_GRADIENT}"></div></div>
    </div>
    <p id="physics-status" class="physics-status" role="status" aria-live="polite"></p>
    <footer class="physics-footer"><button type="button" id="physics-change-mode">Change Mode <kbd>E</kbd></button><button type="button" id="physics-restore">Restore Original</button></footer>
    <div class="physics-parameter-hint"><kbd>Q</kbd> Exit</div>`;
  document.body.append(menu, parameters);
  document.getElementById('btn-instance-physics')?.addEventListener('click', () => openPhysicsMenu());
  menu.querySelector('#physics-close').addEventListener('click', () => closePhysicsMenu());
  parameters.querySelector('#physics-parameters-close').addEventListener('click', () => closePhysicsMenu());
  parameters.querySelector('#physics-change-mode').addEventListener('click', () => openPhysicsMenu());
  menu.querySelector('#physics-menu-up').addEventListener('click', () => moveMenuFocus(-1));
  menu.querySelector('#physics-menu-down').addEventListener('click', () => moveMenuFocus(1));
  menu.querySelector('#physics-menu-exit').addEventListener('click', () => closePhysicsMenu());
  menu.addEventListener('focusin', event => {
    const card = event.target.closest('[data-physics-mode]');
    if (!card) return;
    menu.dataset.focusedMode = card.dataset.physicsMode;
    for (const item of menu.querySelectorAll('[data-physics-mode]')) item.classList.toggle('menu-focused', item === card);
  });
  menu.addEventListener('click', event => {
    const card = event.target.closest('[data-physics-mode]');
    const inst = editableTarget() || config.placedInstances?.find(item => item.id === (targetId || parameterTargetId));
    if (card && !card.disabled && inst && applyInstancePhysics(inst, { mode: card.dataset.physicsMode, paused: false }, true)) {
      targetId = inst.id;
      parameterTargetId = inst.id;
      closePhysicsMenu({ restoreFocus: false, keepParameters: true });
      syncPhysicsUI();
      world.place(parameters, inst);
      parameters.focus({ preventScroll: true });
      config.onPhysicsModeSelected?.(inst, card.dataset.physicsMode);
    }
  });
  const changeSettings = changes => {
    const inst = editableTarget();
    if (!inst || inst.id !== parameterTargetId) return;
    inst.physics = { ...getPhysicsSettings(inst), ...changes };
    const active = sessions.get(inst.id);
    if (active) {
      // Discard a result computed before this input; pausing freezes the exact
      // displayed frame, including a frame that is currently being computed.
      active.session.invalidate();
      if (changes.paused) active.elapsed = active.session.lastSeconds;
      if (!changes.paused || Object.keys(changes).length > 1) active.dirty = true;
    }
    syncPhysicsUI();
  };
  parameters.querySelector('#physics-strength').addEventListener('input', event => changeSettings({ strength: Number(event.target.value) / 100 }));
  parameters.querySelector('#physics-strength').addEventListener('change', () => {
    const inst = editableTarget() || config.placedInstances?.find(item => item.id === parameterTargetId);
    if (inst) config.onPhysicsModeSelected?.(inst, inst.physics?.mode);
  });
  parameters.querySelector('#physics-heatmap').addEventListener('change', event => {
    changeSettings({ heatmap: event.target.checked });
    const inst = editableTarget() || config.placedInstances?.find(item => item.id === parameterTargetId);
    if (inst) config.onPhysicsModeSelected?.(inst, inst.physics?.mode);
  });
  parameters.querySelector('#physics-pause').addEventListener('click', () => changeSettings({ paused: !getPhysicsSettings(editableTarget()).paused }));
  parameters.querySelector('#physics-restart').addEventListener('click', () => {
    const inst = editableTarget() || config.placedInstances?.find(item => item.id === parameterTargetId);
    if (inst) {
      applyInstancePhysics(inst, { ...getPhysicsSettings(inst), paused: false });
      config.onPhysicsModeSelected?.(inst, inst.physics?.mode);
    }
  });
  parameters.querySelector('#physics-restore').addEventListener('click', () => {
    const inst = editableTarget() || config.placedInstances?.find(item => item.id === parameterTargetId);
    if (inst && applyInstancePhysics(inst, { mode: 'static', paused: false }, true)) {
      config.onPhysicsModeSelected?.(inst, 'static');
    }
  });
  window.addEventListener('pointerdown', event => {
    if (!menu.hidden && !menu.contains(event.target)) closePhysicsMenu({ restoreFocus: false });
  }, true);
  config.renderer.domElement.addEventListener('contextmenu', event => {
    event.preventDefault();
    if (!(config.isActive?.() ?? true)) return;
    const inst = world.pick(event.clientX, event.clientY);
    if (inst) openPhysicsMenu(inst, { x: event.clientX + 8, y: event.clientY + 8 });
    else closePhysicsMenu();
  });
  // Only the small mode menu and focused form controls own keyboard input.
  // Walking and orbiting remain available while the object parameters are shown.
  window.addEventListener('keydown', event => {
    const editable = event.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
    const shortcut = event.code === 'KeyE' || event.key.toLowerCase() === 'e';
    const modified = event.ctrlKey || event.metaKey || event.altKey;
    const quit = event.code === 'KeyQ' || event.key.toLowerCase() === 'q';
    const typing = editable && !['range', 'checkbox', 'radio'].includes(editable.type);
    if (quit && !modified && !event.isComposing && !typing && (!menu.hidden || parameterTargetId || outlineTargetId)) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) closePhysicsMenu();
      return;
    }
    if (!menu.hidden) {
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!event.repeat) closePhysicsMenu();
      }
      if (shortcut && !modified && !editable && !event.isComposing) {
        event.preventDefault();
        outlineTargetId = targetId;
      }
      const up = event.key === 'ArrowUp' || event.code === 'KeyW' || event.key.toLowerCase() === 'w';
      const down = event.key === 'ArrowDown' || event.code === 'KeyS' || event.key.toLowerCase() === 's';
      if (!modified && (up || down || ['Home', 'End'].includes(event.key))) {
        event.preventDefault();
        moveMenuFocus(up ? -1 : 1, event.key === 'Home' ? 'first' : event.key === 'End' ? 'last' : null);
      }
      return;
    }
    if (event.key === 'Escape' && !parameters.hidden) {
      event.preventDefault(); event.stopImmediatePropagation(); closePhysicsMenu();
      config.selectInstance(null); return;
    }
    if (event.target instanceof Node && parameters.contains(event.target) && editable) { event.stopImmediatePropagation(); return; }
    if (!shortcut || editable || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (!(config.isActive?.() ?? true)) return;
    const inst = world.nearby(true);
    if (!inst) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPhysicsMenu(inst, null, true);
  }, true);
  window.addEventListener('keyup', event => { if (!menu.hidden || (event.target instanceof Node && parameters.contains(event.target) && editableKeyTarget(event.target))) event.stopImmediatePropagation(); }, true);
  syncPhysicsUI();
}

function editableKeyTarget(target) { return target.closest?.('input, textarea, select, [contenteditable]'); }
