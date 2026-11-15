import * as THREE from 'three';
import { createObjectOutline } from './objectOutline.js';

let viewport = null;
export function pickObjectInstanceAt(x, y) { return viewport?.pick(x, y) ?? null; }

export function createObjectInteraction(config) {
  const { camera, renderer, placedInstances, astroPos } = config;
  const outline = createObjectOutline(renderer, camera);
  const cache = new WeakMap();
  const dimensions = new WeakMap();
  const sizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) {
      const box = entry.borderBoxSize?.[0];
      const width = box?.inlineSize ?? entry.target.offsetWidth;
      const height = box?.blockSize ?? entry.target.offsetHeight;
      if (width && height) dimensions.set(entry.target, { width, height });
    }
  });
  const panels = ['v3d-leftpanel', 'v3d-wasd-hud', 'v3d-layer-panel'].map(id => document.getElementById(id)).filter(Boolean);
  const navigation = document.querySelector('.top-nav');
  const helpButton = document.getElementById('btn-physics-help');
  let helpRect = null;
  let canvasRect = null, sceneRect = null, lastLayoutRead = -Infinity;
  let lastInteraction = null;
  let lastWidth = 0, lastHeight = 0;
  function layout() {
    const now = performance.now();
    const interacting = document.body.classList.contains('object-physics-active');
    if (!canvasRect || now - lastLayoutRead > 250 || lastWidth !== innerWidth || lastHeight !== innerHeight || interacting !== lastInteraction) {
      canvasRect = renderer.domElement.getBoundingClientRect();
      sceneRect = { left: Math.max(0, canvasRect.left) + 10, right: Math.min(innerWidth, canvasRect.right) - 10,
        top: Math.max(0, canvasRect.top, navigation?.getBoundingClientRect().bottom ?? 0) + 12,
        bottom: Math.min(innerHeight, canvasRect.bottom) - 12 };
      for (const panel of panels) {
        const style = getComputedStyle(panel);
        if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') continue;
        const rect = panel.getBoundingClientRect();
        if (rect.bottom < sceneRect.top || rect.top > sceneRect.bottom || rect.right < canvasRect.left || rect.left > canvasRect.right) continue;
        // Include the panel's final layout position during its slide-in transition.
        if (panel.id === 'v3d-layer-panel') sceneRect.right = Math.min(sceneRect.right, rect.left - 12, panel.offsetLeft - 12);
        else sceneRect.left = Math.max(sceneRect.left, rect.right + 12, panel.offsetLeft + panel.offsetWidth + 12);
      }
      lastLayoutRead = now; lastWidth = innerWidth; lastHeight = innerHeight;
      helpRect = helpButton && !helpButton.hidden ? helpButton.getBoundingClientRect() : null;
      lastInteraction = interacting;
    }
    return canvasRect;
  }
  const point = new THREE.Vector3(), center = new THREE.Vector3(), actor = new THREE.Vector3();
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  let nearest = null, lastScan = -Infinity;
  const prompt = document.createElement('button');
  prompt.type = 'button'; prompt.id = 'object-interaction-prompt'; prompt.hidden = true;
  prompt.className = 'object-interaction-prompt';
  prompt.innerHTML = '<kbd>E</kbd><span></span><small>Select Physics</small>';
  document.body.append(prompt);
  const promptName = prompt.querySelector('span');
  prompt.addEventListener('click', () => { if (nearest) config.onInteract(nearest); });

  const editable = inst => inst && !inst.deleted && inst.visible && !inst.locked && inst.visualGroup?.visible !== false;
  function bounds(inst) {
    let entry = cache.get(inst);
    const mesh = inst.splatViewer?.splatMesh;
    const now = performance.now();
    const version = mesh?.splatDataTextures?.centerColors?.texture.version ?? 0;
    if (!entry || (entry.version !== version && now - entry.time > 250)) {
      const local = new THREE.Box3();
      const data = mesh?.splatDataTextures?.baseData;
      if (data?.centers) {
        const count = mesh.getSplatCount(), stride = Math.max(1, Math.floor(count / 2048));
        const samples = [[], [], []];
        for (let i = 0; i < count; i += stride) {
          if (data.colors[i * 4 + 3] < 12) continue;
          point.fromArray(data.centers, i * 3);
          if (!Number.isFinite(point.lengthSq())) continue;
          samples[0].push(point.x); samples[1].push(point.y); samples[2].push(point.z);
        }
        if (samples[0].length) {
          samples.forEach(values => values.sort((a, b) => a - b));
          local.min.set(...samples.map(values => values[Math.floor(values.length * 0.01)]));
          local.max.set(...samples.map(values => values[Math.min(values.length - 1, Math.floor(values.length * 0.99))]));
        }
      }
      let reference = mesh;
      if (local.isEmpty()) {
        inst.group.updateWorldMatrix(true, true);
        local.setFromObject(inst.visualGroup || inst.group).applyMatrix4(inst.group.matrixWorld.clone().invert());
        reference = inst.group;
      }
      entry = { local, reference, world: new THREE.Box3(), version, time: now };
      cache.set(inst, entry);
    }
    entry.reference.updateWorldMatrix(true, false);
    entry.world.copy(entry.local).applyMatrix4(entry.reference.matrixWorld);
    return entry.world;
  }

  function screenBounds(inst) {
    const box = bounds(inst);
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    if (box.isEmpty() || !frustum.intersectsBox(box)) return null;
    const rect = layout();
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (let i = 0; i < 8; i++) {
      point.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
      if (point.z < -1 || point.z > 1) continue;
      const x = rect.left + (point.x + 1) * rect.width / 2, y = rect.top + (1 - point.y) * rect.height / 2;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return Number.isFinite(left) ? { left, right, top, bottom, x: (left + right) / 2 } : null;
  }

  function nearby(force = false) {
    const now = performance.now();
    if (!force && now - lastScan < 100) return editable(nearest) ? nearest : null;
    lastScan = now;
    actor.copy(astroPos); actor.y += 0.85;
    let best = null, bestDistance = 2.4;
    for (const inst of placedInstances) {
      if (!editable(inst)) continue;
      const box = bounds(inst), distance = box.distanceToPoint(actor);
      if (distance < 2.4 && (distance < bestDistance || (best && Math.abs(distance - bestDistance) < 0.05))) {
        // Break equal surface distances with the closest actual object center.
        const centerDistance = box.getCenter(center).distanceToSquared(actor);
        if (best && Math.abs(distance - bestDistance) < 0.05 && centerDistance >= bounds(best).getCenter(point).distanceToSquared(actor)) continue;
        best = inst; bestDistance = distance;
      }
    }
    nearest = best;
    return best;
  }

  function place(element, inst, kind = 'side', pointer = null) {
    const screen = screenBounds(inst);
    if (!screen) { element.hidden = true; return false; }
    const availableWidth = Math.floor(sceneRect.right - sceneRect.left);
    const availableHeight = Math.floor(sceneRect.bottom - sceneRect.top);
    if (availableWidth < 110 || availableHeight < 48 || screen.right < sceneRect.left || screen.left > sceneRect.right || screen.bottom < sceneRect.top || screen.top > sceneRect.bottom) {
      element.hidden = true;
      return false;
    }
    // Apply scene limits before measuring, including narrow/resized windows.
    const maxWidth = `${kind === 'above' ? Math.min(225, availableWidth) : availableWidth}px`;
    const maxHeight = `${availableHeight - (kind === 'above' ? 7 : 0)}px`;
    if (element.style.maxWidth !== maxWidth || element.style.maxHeight !== maxHeight) {
      element.style.maxWidth = maxWidth; element.style.maxHeight = maxHeight;
      dimensions.delete(element);
    }
    element.hidden = false;
    let size = dimensions.get(element);
    if (!size) {
      size = { width: element.offsetWidth || 230, height: element.offsetHeight || 220 };
      dimensions.set(element, size); sizeObserver.observe(element);
    }
    const { width, height } = size;
    let x, y;
    if (pointer) { x = pointer.x; y = pointer.y; }
    else if (kind === 'above') { x = screen.x - width / 2; y = screen.top - height - 14; }
    else {
      x = screen.right + 14; y = Math.max(sceneRect.top, screen.top + 30);
      const rightEdge = sceneRect.right;
      const leftEdge = sceneRect.left;
      // Keep controls beside the silhouette, choosing the side with more space.
      // If the object fills the viewport, overlap its outer edge, not its center.
      const rightSpace = rightEdge - screen.right, leftSpace = screen.left - leftEdge;
      if (rightSpace >= width + 14) x = screen.right + 14;
      else if (leftSpace >= width + 14) x = screen.left - width - 14;
      else x = rightSpace >= leftSpace ? Math.max(leftEdge, rightEdge - width) : leftEdge;
    }
    x = THREE.MathUtils.clamp(x, sceneRect.left, Math.max(sceneRect.left, sceneRect.right - width));
    y = THREE.MathUtils.clamp(y, sceneRect.top, Math.max(sceneRect.top, sceneRect.bottom - height - (kind === 'above' ? 7 : 0)));
    if (helpRect && x < helpRect.right + 8 && x + width > helpRect.left - 8 && y < helpRect.bottom + 8 && y + height > helpRect.top - 8) {
      if (helpRect.bottom + 10 + height <= sceneRect.bottom) y = helpRect.bottom + 10;
      else if (helpRect.left - width - 10 >= sceneRect.left) x = helpRect.left - width - 10;
      else { element.hidden = true; return false; }
    }
    const transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    if (element.style.transform !== transform) element.style.transform = transform;
    if (element.dataset.instanceId !== inst.id) element.dataset.instanceId = inst.id;
    return true;
  }

  const api = {
    bounds, screenBounds, nearby, place,
    update() {
      if (!config.isActive() || document.hidden) { prompt.hidden = true; return; }
      camera.updateMatrixWorld();
      const inst = nearby();
      if (!inst || config.isMenuOpen() || config.getParameterTargetId?.() === inst.id) { prompt.hidden = true; return; }
      const name = inst.layerName || inst.name;
      if (promptName.textContent !== name) { promptName.textContent = name; dimensions.delete(prompt); }
      place(prompt, inst, 'above');
    },
    draw(now) {
      const inst = config.getOutlineInstance();
      outline.render(config.isActive() && inst?.visualGroup?.visible !== false ? inst : null, now);
    },
    pick(x, y) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(mouse, camera);
      const candidates = [];
      for (const inst of placedInstances) {
        if (!editable(inst)) continue;
        const hit = raycaster.ray.intersectBox(bounds(inst), new THREE.Vector3());
        if (hit) candidates.push({ inst, distance: raycaster.ray.origin.distanceToSquared(hit) });
      }
      candidates.sort((a, b) => a.distance - b.distance);
      return candidates.find(({ inst }) => outline.hitTest(inst, x, y))?.inst ?? null;
    },
  };
  viewport = api;
  return api;
}
