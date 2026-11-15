import * as THREE from 'three';

// Preview objects stay outside the outliner, collision list and undo history
// until a successful drop transfers ownership to a placed instance.
export function createAssetPlacement({ scene, camera, canvas, terrainHeight, load, commit }) {
  let current = null;
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
  raycaster.firstHitOnly = true;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();

  // Throttle getBoundingClientRect to avoid DOM layout thrashing during mouse drag
  let cachedRect = null;
  let cachedRectTime = 0;
  const getCanvasRect = () => {
    const now = performance.now();
    if (!cachedRect || (now - cachedRectTime > 250)) {
      cachedRect = canvas.getBoundingClientRect();
      cachedRectTime = now;
    }
    return cachedRect;
  };

  const pick = (x, y) => {
    const rect = getCanvasRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    mouse.set(((x - rect.left) / rect.width) * 2 - 1, 1 - ((y - rect.top) / rect.height) * 2);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(mouse, camera);
    const terrain = scene.getObjectByName('Apollo_12_Landing_Terrain');
    const hit = terrain ? raycaster.intersectObject(terrain, false)[0] : null;
    if (hit) {
      point.copy(hit.point);
      const xWorld = THREE.MathUtils.clamp(point.x, -14, 14);
      const zWorld = THREE.MathUtils.clamp(point.z, -14, 14);
      // Fast path: use exact hit elevation from the terrain geometry directly
      return new THREE.Vector3(xWorld, point.y, zWorld);
    }
    if (!raycaster.ray.intersectPlane(plane, point)) return null;
    const xWorld = THREE.MathUtils.clamp(point.x, -14, 14);
    const zWorld = THREE.MathUtils.clamp(point.z, -14, 14);
    return new THREE.Vector3(xWorld, terrainHeight(xWorld, zWorld), zWorld);
  };

  let rafId = null;
  let pendingPos = null;

  const cancel = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pendingPos = null;
    if (!current) return;
    current.cancelled = true;
    current.node?.dispose();
    current = null;
  };

  const show = session => {
    if (!session.node || session.cancelled) return;
    session.node.group.visible = !!session.position && session.hover;
    if (session.position) session.node.move(session.position);
  };

  return {
    begin(assetId) {
      cancel();
      cachedRect = canvas.getBoundingClientRect();
      cachedRectTime = performance.now();
      const session = { assetId, node: null, hover: false, position: null, cancelled: false };
      current = session;
      session.loading = Promise.resolve().then(() => load(assetId)).then(node => {
        session.node = node;
        if (session.cancelled) node?.dispose();
        else show(session);
        return node;
      }).catch(error => { console.warn('[AssetPlacement] Preview load failed:', error); return null; });
    },
    move(x, y) {
      if (!current) return;
      pendingPos = { x, y };
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          if (!current || !pendingPos) return;
          const { x: px, y: py } = pendingPos;
          pendingPos = null;
          current.position = pick(px, py);
          current.hover = !!current.position;
          show(current);
        });
      }
    },
    hide() {
      if (current) {
        current.hover = false;
        show(current);
      }
    },
    async drop(assetId, x, y) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingPos = null;
      const position = pick(x, y);
      if (!position) { cancel(); return null; }
      const session = current?.assetId === assetId ? current : null;
      if (!session) { cancel(); return commit(assetId, position); }
      // dragend fires while decoding can still be in progress. This session is
      // now owned by the drop, so dragend must not dispose its pending model.
      current = null;
      session.position = position; session.hover = true;
      try {
        const node = await session.loading;
        if (!node) return commit(assetId, position);
        show(session);
        const instance = await commit(assetId, position, node);
        if (instance) node.adopted = true;
        return instance;
      } finally { session.node?.dispose(); }
    },
    cancel,
  };
}
