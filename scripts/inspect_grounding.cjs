const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('pageerror', error => console.error(error.message));
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await page.waitForFunction(() => window.placedInstances?.length > 0 && window.scene.children.some(c => c.isMesh && c.geometry?.attributes.position.count > 50000));
    await page.evaluate(() => window.jumpToTimeline(.95));
    await page.waitForTimeout(1000);
    const measurements = await page.evaluate(async () => {
      const { getTerrainHeight } = await import('/js/marsScene.js');
      const T = window.THREE;
      const skinned = [], terrain = [];
      window.scene.traverse(c => { if (c.isSkinnedMesh) skinned.push(c); if (c.isMesh && c.geometry?.attributes.position.count > 50000) terrain.push(c); });
      let actor = skinned[0]; while (actor && actor.parent !== window.scene) actor = actor.parent;
      const vertices = [], point = new T.Vector3();
      actor?.updateMatrixWorld(true);
      for (const mesh of skinned) {
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
          vertices.push([point.x, point.y, point.z]);
        }
      }
      vertices.sort((a, b) => a[1] - b[1]);
      const bootVertices = [...new Map(vertices.filter(v => v[1] < vertices[0][1] + .25).map(v => [v.map(n => n.toFixed(4)).join(':'), v])).values()];
      const bootGaps = bootVertices.map(([x, y, z]) => y - getTerrainHeight(x, z));
      const inst = window.placedInstances[0];
      const feet = [];
      inst.visualGroup.traverse(c => {
        if (c.isMesh && c.geometry?.parameters?.height === .1) {
          const box = new T.Box3().setFromObject(c);
          const center = box.getCenter(new T.Vector3());
          feet.push({ x: center.x, z: center.z, bottom: box.min.y, ground: getTerrainHeight(center.x, center.z) });
        }
      });
      const lights = window.scene.children.filter(c => c.isDirectionalLight).map(c => ({ casts: c.castShadow, position: c.position.toArray(), camera: c.shadow?.camera.toJSON().object }));
      return { actorPos: actor?.position.toArray(), astroPos: window.astroPos.toArray(), bootContactGap: Math.min(...bootGaps),
        lowestVertices: vertices.slice(0, 12).map(([x, y, z]) => ({ x, y, z, ground: getTerrainHeight(x, z), gap: y - getTerrainHeight(x, z) })),
        landerPos: inst.group.position.toArray(), landerScale: inst.group.scale.toArray(), feet,
        terrain: terrain.map(c => ({ name: c.name, casts: c.castShadow, receives: c.receiveShadow, box: new T.Box3().setFromObject(c) })), lights };
    });
    console.log(JSON.stringify(measurements, null, 2));
    fs.writeFileSync(path.join(__dirname, '../scratch/grounding-before.json'), JSON.stringify(measurements, null, 2));
    await page.evaluate(() => {
      window.toggleCameraFollow();
      window.camera.position.set(5, 1.5, 8); window.controls.target.set(1, 1, 1); window.controls.update();
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, '../scratch/grounding-before.png') });
    await page.evaluate(() => {
      window.scene.traverse(c => { if (c.isMesh && c.geometry?.attributes.position.count > 50000) c.castShadow = false; });
      const sun = window.scene.children.find(c => c.isDirectionalLight && c.castShadow);
      sun.shadow.bias = -.0005; sun.shadow.normalBias = .035;
      window.renderer.shadowMap.needsUpdate = true;
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, '../scratch/shadow-diagnostic.png') });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
