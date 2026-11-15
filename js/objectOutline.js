import * as THREE from 'three';

// A silhouette of the actual Gaussian ellipses/visual meshes, never a bounding box.
// Share live position/covariance uniforms so the outline follows physics too.
export function createObjectOutline(renderer, camera) {
  const maskScene = new THREE.Scene();
  const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const plainMask = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, toneMapped: false });
  const screenScene = new THREE.Scene();
  const screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const edgeMaterial = new THREE.ShaderMaterial({
    uniforms: { mask: { value: target.texture }, texel: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D mask; uniform vec2 texel; varying vec2 vUv;
      void main() {
        float center = texture2D(mask, vUv).r;
        float edge = 0.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          edge = max(edge, texture2D(mask, vUv + vec2(float(x), float(y)) * texel * 1.5).r);
        }
        float alpha = max(0.0, edge - center) * 0.95;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(0.15, 0.86, 1.0, alpha);
      }`,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  });
  screenScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), edgeMaterial));
  let currentId = null, sources = [], clones = [], splatMaterials = [];
  let lastMask = -Infinity, lastVersion = -1;
  const previousCamera = new THREE.Matrix4(), previousProjection = new THREE.Matrix4(), previousObject = new THREE.Matrix4();
  const oldClear = new THREE.Color();
  const pixel = new Uint8Array(4);

  function rebuild(inst) {
    maskScene.clear();
    for (const material of splatMaterials) material.dispose();
    sources = []; clones = []; splatMaterials = [];
    currentId = inst?.id ?? null;
    if (!inst) return;
    const splatMesh = inst.splatViewer?.splatMesh;
    inst.visualGroup?.traverse(source => {
      if (source.isMesh && source !== inst.splatViewer?.callbackMesh && !source.material?.uniforms?.centersColorsTexture && source.visible) sources.push(source);
    });
    if (splatMesh?.geometry && inst.splatViewer.visible && inst.visualGroup?.visible !== false) sources.push(splatMesh);
    for (const source of sources) {
      let material = plainMask;
      if (source === splatMesh) {
        material = source.material.clone();
        material.uniforms = source.material.uniforms;
        material.fragmentShader = source.material.fragmentShader.replace('gl_FragColor = vec4(color.rgb, opacity);',
          'if (opacity < 0.12) discard; gl_FragColor = vec4(1.0);');
        material.transparent = false; material.blending = THREE.NoBlending;
        material.depthTest = false; material.depthWrite = false; material.toneMapped = false;
        splatMaterials.push(material);
      }
      const clone = new THREE.Mesh(source.geometry, material);
      clone.matrixAutoUpdate = false; clone.frustumCulled = false;
      maskScene.add(clone); clones.push(clone);
    }
    lastMask = -Infinity;
  }

  function renderMask(inst) {
    if (currentId !== inst.id) rebuild(inst);
    const canvas = renderer.domElement;
    const width = Math.max(1, Math.round(Math.min(canvas.clientWidth * 0.5, 960)));
    const height = Math.max(1, Math.round(width * canvas.clientHeight / canvas.clientWidth));
    if (target.width !== width || target.height !== height) target.setSize(width, height);
    edgeMaterial.uniforms.texel.value.set(1 / width, 1 / height);
    sources.forEach((source, index) => { clones[index].geometry = source.geometry; clones[index].matrix.copy(source.matrixWorld); });
    const oldTarget = renderer.getRenderTarget();
    renderer.getClearColor(oldClear);
    const oldAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    try {
      renderer.autoClear = true;
      renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 0);
      renderer.clear(); renderer.render(maskScene, camera);
    } finally {
      renderer.setRenderTarget(oldTarget); renderer.setClearColor(oldClear, oldAlpha); renderer.autoClear = oldAutoClear;
    }
  }

  return {
    render(inst, now) {
      if (!inst || inst.deleted || !inst.visible) { if (currentId) rebuild(null); return; }
      const version = inst.splatViewer?.splatMesh?.splatDataTextures?.centerColors?.texture.version ?? 0;
      const changed = currentId !== inst.id || version !== lastVersion ||
        !previousCamera.equals(camera.matrixWorld) || !previousProjection.equals(camera.projectionMatrix) || !previousObject.equals(inst.group.matrixWorld);
      if (changed && (currentId !== inst.id || now - lastMask >= 1000 / 30)) {
        renderMask(inst); lastMask = now; lastVersion = version;
        previousCamera.copy(camera.matrixWorld); previousProjection.copy(camera.projectionMatrix); previousObject.copy(inst.group.matrixWorld);
      }
      if (currentId !== inst.id) return;
      const oldAutoClear = renderer.autoClear;
      try { renderer.autoClear = false; renderer.render(screenScene, screenCamera); }
      finally { renderer.autoClear = oldAutoClear; }
    },
    hitTest(inst, clientX, clientY) {
      renderMask(inst);
      const rect = renderer.domElement.getBoundingClientRect();
      const x = THREE.MathUtils.clamp(Math.floor((clientX - rect.left) / rect.width * target.width), 0, target.width - 1);
      const y = THREE.MathUtils.clamp(Math.floor((rect.bottom - clientY) / rect.height * target.height), 0, target.height - 1);
      renderer.readRenderTargetPixels(target, x, y, 1, 1, pixel);
      lastMask = -Infinity; // Picking may have used a different object from selection.
      return pixel[0] > 0;
    },
  };
}
