const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    let releaseTerrain;
    const terrainGate = new Promise(resolve => { releaseTerrain = resolve; });
    await page.route('**/Apollo_12_Terrain.glb', async route => { await terrainGate; await route.continue(); });
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.placedInstances?.length > 0);
    await page.waitForTimeout(300);
    await page.evaluate(async () => {
      const inst = await window.spawnModelInstance('asset_mars_lander', new window.THREE.Vector3(-8, 0, -8));
      window.__manuallyPlaced = inst;
      inst.group.position.y = 4; // Explicit edits must survive a later terrain load.
    });
    releaseTerrain();
    await page.waitForFunction(() => {
      const terrain = window.scene.getObjectByName('Apollo_12_Landing_Terrain');
      const grid = window.scene.getObjectByName('TerrainGrid');
      const actor = window.scene.getObjectByName('AstronautCharacter');
      return !!terrain && grid?.userData.terrainDraped && actor?.children.length > 0;
    });
    await page.evaluate(() => window.jumpToTimeline(.95));
    await page.waitForTimeout(600);
    await page.waitForFunction(async () => {
      const { getTerrainHeight } = await import('/js/marsScene.js');
      return Math.abs(window.astroPos.y - getTerrainHeight(window.astroPos.x, window.astroPos.z)) < .005;
    });
    const scene = await page.evaluate(async () => {
      const { getTerrainHeight } = await import('/js/marsScene.js');
      const { getModelSupportPoints } = await import('/js/modelGrounding.js');
      const terrain = window.scene.getObjectByName('Apollo_12_Landing_Terrain');
      const grid = window.scene.getObjectByName('TerrainGrid');
      const position = grid.geometry.attributes.position;
      let gridError = 0;
      for (let i = 0; i < position.count; i += 31) gridError = Math.max(gridError, Math.abs(position.getY(i) - getTerrainHeight(position.getX(i), position.getZ(i)) - .015));
      const inst = window.placedInstances[0];
      const gaps = getModelSupportPoints(inst).map(local => {
        const world = local.applyMatrix4(inst.group.matrixWorld);
        return world.y - getTerrainHeight(world.x, world.z);
      });
      return { terrainCasts: terrain.castShadow, terrainReceives: terrain.receiveShadow, gridError,
        landerContact: Math.min(...gaps), manuallyPlacedY: window.__manuallyPlaced.group.position.y };
    });
    assert.equal(scene.terrainCasts, false, 'The terrain cannot cast a rectangular self-shadow footprint');
    assert.equal(scene.terrainReceives, true, 'Natural object shadows are retained');
    assert.ok(scene.gridError < .0001, `Grid follows actual terrain (${scene.gridError})`);
    assert.ok(Math.abs(scene.landerContact) < .0001, 'Existing lander regrounds when asynchronous terrain arrives');
    assert.equal(scene.manuallyPlacedY, 4, 'Terrain loading preserves manual placements');

    const measureBoots = () => page.evaluate(async () => {
      const { getTerrainHeight } = await import('/js/marsScene.js');
      const actor = window.scene.getObjectByName('AstronautCharacter');
      actor.updateMatrixWorld(true);
      const point = new window.THREE.Vector3(), vertices = [];
      actor.traverse(mesh => {
        if (!mesh.isSkinnedMesh) return;
        mesh.skeleton.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
          mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld);
          vertices.push([point.x, point.y, point.z]);
        }
      });
      const low = Math.min(...vertices.map(v => v[1]));
      const unique = new Map(vertices.filter(v => v[1] < low + .25).map(v => [v.map(n => n.toFixed(4)).join(':'), v]));
      let contact = Infinity;
      for (const [x, y, z] of unique.values()) contact = Math.min(contact, y - getTerrainHeight(x, z));
      return { contact, height: new window.THREE.Box3().setFromObject(actor, true).getSize(point).y,
        animation: actor.userData.animation,
        rootGap: window.astroPos.y - getTerrainHeight(window.astroPos.x, window.astroPos.z) };
    });
    const idle = await measureBoots();
    assert.ok(idle.contact > -.035 && idle.contact < .035, `Animated idle boots contact terrain (${idle.contact})`);
    assert.ok(idle.height > 1.5 && idle.height < 1.8, `Character keeps its intended height (${idle.height})`);
    await page.evaluate(() => window.setVirtualKey('w', true));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.setVirtualKey('w', false));
    await page.waitForTimeout(300);
    const afterWalk = await measureBoots();
    assert.ok(afterWalk.contact > -.05 && afterWalk.contact < .05, `Boots remain grounded after walking (${afterWalk.contact})`);
    await page.evaluate(() => window.setVirtualKey('space', true));
    await page.waitForTimeout(80);
    await page.evaluate(() => window.setVirtualKey('space', false));
    await page.waitForTimeout(200);
    const inAir = await measureBoots();
    assert.ok(inAir.rootGap > .05, 'Physics jumping still leaves the ground');
    assert.equal(inAir.animation, 'Jumping', 'The replacement rig plays its Jumping clip');
    await page.waitForTimeout(1400);
    const landed = await measureBoots();
    assert.ok(landed.contact > -.05 && landed.contact < .05, `Boots return to contact after landing (${landed.contact})`);
    assert.equal(landed.animation, 'Idle', 'Landing returns to idle');
    await page.keyboard.down('Space');
    await page.waitForTimeout(80);
    await page.keyboard.up('Space');
    await page.waitForTimeout(200);
    const repeatJump = await measureBoots();
    assert.equal(repeatJump.animation, 'Jumping', 'A second Space press restarts the one-shot jump');
    assert.ok(repeatJump.rootGap > .05, 'A repeated jump still leaves the ground');
    await page.screenshot({ path: path.join(__dirname, '../scratch/updated-astronaut-jump.png') });
    await page.waitForTimeout(1400);
    const repeatLanding = await measureBoots();
    assert.equal(repeatLanding.animation, 'Idle');
    assert.ok(repeatLanding.contact > -.05 && repeatLanding.contact < .05, 'Repeated jumps retain boot contact after landing');

    const snap = await page.evaluate(async () => {
      const { getTerrainHeight } = await import('/js/marsScene.js');
      const { getModelSupportPoints } = await import('/js/modelGrounding.js');
      const inst = window.placedInstances[0];
      window.selectInstance(inst.id);
      inst.group.scale.multiplyScalar(1.4); inst.group.rotation.y = .4; inst.group.position.y += 3;
      const raised = inst.group.position.y;
      window.snapModelToGround();
      const gaps = getModelSupportPoints(inst).map(local => {
        const world = local.applyMatrix4(inst.group.matrixWorld);
        return world.y - getTerrainHeight(world.x, world.z);
      });
      const snapped = inst.group.position.y;
      window.historyUndo(); const undoY = inst.group.position.y;
      window.historyRedo(); const redoY = inst.group.position.y;
      window.resetModelTransform();
      return { contact: Math.min(...gaps), raised, snapped, undoY, redoY, resetScale: inst.group.scale.equals(inst.defaultScale) };
    });
    assert.ok(Math.abs(snap.contact) < .0001, 'Ground snap uses transformed visible contact points');
    assert.equal(snap.undoY, snap.raised); assert.equal(snap.redoY, snap.snapped);
    assert.equal(snap.resetScale, true, 'Reset restores the original scale before grounding');
    await page.evaluate(() => {
      window.__manuallyPlaced.visible = false;
      window.__manuallyPlaced.group.visible = false;
      window.selectModel(false); window.selectInstance(null); window.toggleCameraFollow();
      window.camera.position.set(5, 1.5, 8); window.controls.target.set(1, .5, 1); window.controls.update();
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, '../scratch/ground-contact-low.png') });
    await page.evaluate(() => { window.camera.position.set(5, 11, 9); window.controls.target.set(1, 0, 1); window.controls.update(); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(__dirname, '../scratch/ground-contact-above.png') });
    assert.deepEqual(errors, []);
    const result = { scene, idle, afterWalk, inAir, landed, repeatJump, repeatLanding, snap };
    fs.writeFileSync(path.join(__dirname, '../scratch/ground-contact-checks.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    console.log('PASS terrain loading, manual placement preservation, boot contact, walk/jump/landing, terrain-conforming grid, shadow footprint removal, snap, reset and undo/redo');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
