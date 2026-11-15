const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
    const errors = []; let assetRequests = 0;
    page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.message); });
    page.on('console', message => { if (message.text().includes('[AssetPlacement]')) console.log(message.type(), message.text()); });
    page.on('request', req => { if (req.url().includes('thai_temple_gate_262k.py3s')) assetRequests++; });
    const placeholder = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      return canvas.toDataURL().split(',')[1];
    }), 'base64');
    const mediaStub = route => route.fulfill({ contentType: 'image/png', body: placeholder });
    await page.route('**/assets/scroll_webp/**', mediaStub);
    await page.route('**/assets/loops/**', mediaStub);
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await page.waitForFunction(() => window.placedInstances?.length === 1 && window.scene.getObjectByName('Apollo_12_Landing_Terrain'));
    await page.evaluate(() => window.jumpToTimeline(.95));
    await page.waitForFunction(() => document.getElementById('threejs-layer').classList.contains('active') &&
      Math.abs(document.getElementById('threejs-canvas').getBoundingClientRect().top) < .5);
    await page.evaluate(() => {
      window.toggleCameraFollow(); window.controls.enableDamping = false;
      window.camera.position.set(7, 7, 10); window.controls.target.set(0, .5, 0); window.controls.update();
    });
    await page.waitForTimeout(500);
    const canvas = page.locator('#threejs-canvas');
    const start = async () => {
      const transfer = await page.evaluateHandle(() => new DataTransfer());
      await page.locator('#asset-row-asset_temple_gate').dispatchEvent('dragstart', { dataTransfer: transfer });
      return transfer;
    };
    const over = (transfer, x = 840, y = 580) => canvas.dispatchEvent('dragover', { dataTransfer: transfer, clientX: x, clientY: y });
    const inspect = () => page.evaluate(() => {
      const root = window.scene.getObjectByName('AssetPlacementPreview');
      if (!root) return null;
      let viewer;
      root.traverse(obj => { if (typeof obj.getSplatScene === 'function') viewer = obj; });
      return { uuid: root.uuid, visible: root.visible, pos: root.position.toArray(), opacity: viewer?.getSplatScene(0)?.opacity,
        uniformOpacity: viewer?.splatMesh.material.uniforms.sceneOpacity?.value[0],
        splats: viewer?.splatMesh.getSplatCount(), mesh: viewer?.splatMesh.uuid,
        count: window.placedInstances.length };
    });
    let transfer = await start();
    await over(transfer);
    await page.waitForFunction(() => window.scene.getObjectByName('AssetPlacementPreview')?.visible);
    await page.waitForTimeout(150);
    const first = await inspect();
    assert.equal(first.count, 1, 'Preview is not a placed instance');
    assert.ok(first.splats > 1000, 'Preview renders actual Gaussian splats');
    assert.equal(first.opacity, .25, 'Preview uses a faint alpha');
    assert.equal(first.uniformOpacity, .25, 'Opacity is enabled in the actual Gaussian shader');
    await over(transfer, 1050, 660);
    const moved = await inspect();
    assert.ok(Math.hypot(...first.pos.map((v, i) => v - moved.pos[i])) > .3, 'Preview follows the cursor on terrain');
    assert.equal(moved.uuid, first.uuid, 'Drag motion reuses one preview');
    fs.mkdirSync(path.join(__dirname, '../scratch'), { recursive: true });
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(__dirname, '../scratch/asset-placement-preview.png') });
    await canvas.dispatchEvent('dragleave', { dataTransfer: transfer });
    assert.equal((await inspect()).visible, false, 'Leaving the scene hides the preview');
    const skyVisible = await page.evaluate(transfer => {
      const rotation = window.camera.quaternion.clone();
      window.camera.lookAt(window.camera.position.clone().add(new window.THREE.Vector3(0, 10, 0)));
      document.getElementById('threejs-canvas').dispatchEvent(new DragEvent('dragover',
        { dataTransfer: transfer, clientX: 850, clientY: 100, bubbles: true, cancelable: true }));
      const visible = window.scene.getObjectByName('AssetPlacementPreview').visible;
      window.camera.quaternion.copy(rotation);
      return visible;
    }, transfer);
    assert.equal(skyVisible, false, 'A sky ray has no valid placement target');
    await over(transfer, 1050, 660);
    const preview = await inspect(), requestsBeforeDrop = assetRequests;
    await canvas.dispatchEvent('drop', { dataTransfer: transfer, clientX: 1050, clientY: 660 });
    await page.locator('body').dispatchEvent('dragend', { dataTransfer: transfer });
    await page.waitForFunction(() => window.placedInstances.length === 2);
    const placed = await page.evaluate(() => {
      const inst = window.placedInstances.at(-1);
      return { uuid: inst.group.uuid, pos: inst.group.position.toArray(), mesh: inst.splatViewer.splatMesh.uuid,
        opacity: inst.splatViewer.getSplatScene(0).opacity, preview: inst.group.userData.placementPreview };
    });
    assert.equal(placed.uuid, preview.uuid); assert.equal(placed.mesh, preview.mesh);
    assert.equal(placed.opacity, 1); assert.equal(placed.preview, undefined);
    assert.ok(placed.pos.every((v, i) => Math.abs(v - preview.pos[i]) < .001), 'Drop uses the exact preview position');
    assert.equal(assetRequests, requestsBeforeDrop, 'Drop does not load a second copy');
    assert.equal(await inspect(), null);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.historyUndo());
    assert.equal(await page.evaluate(() => window.placedInstances.filter(i => !i.deleted).length), 1, 'One undo removes the committed placement');
    await page.evaluate(() => window.historyRedo());
    console.log('PASS real translucent 3DGS preview, cursor tracking, hidden over UI, same-object promotion, exact position and undo/redo');

    let releaseLoad;
    const gate = new Promise(resolve => { releaseLoad = resolve; });
    await page.route('**/thai_temple_gate_262k.py3s', async route => { await gate; await route.continue(); });
    transfer = await start(); await over(transfer);
    await page.keyboard.press('Escape'); releaseLoad();
    await page.waitForTimeout(1200);
    assert.equal(await inspect(), null, 'Cancellation during loading cannot create an orphan preview');
    assert.equal(await page.evaluate(() => window.placedInstances.filter(i => !i.deleted).length), 2);
    await page.unroute('**/thai_temple_gate_262k.py3s');

    let releaseDrop;
    const dropGate = new Promise(resolve => { releaseDrop = resolve; });
    await page.route('**/thai_temple_gate_262k.py3s', async route => { await dropGate; await route.continue(); });
    transfer = await start(); await over(transfer, 820, 630);
    await canvas.dispatchEvent('drop', { dataTransfer: transfer, clientX: 820, clientY: 630 });
    await page.locator('body').dispatchEvent('dragend', { dataTransfer: transfer });
    releaseDrop();
    await page.waitForFunction(() => window.placedInstances.filter(i => !i.deleted).length === 3);
    assert.equal(await inspect(), null, 'Drop before loading completes survives native dragend');
    await page.unroute('**/thai_temple_gate_262k.py3s');
    await page.waitForTimeout(500);
    await page.locator('#asset-row-asset_temple_gate').dragTo(canvas, { targetPosition: { x: 920, y: 650 } });
    await page.waitForFunction(() => window.placedInstances.filter(i => !i.deleted).length === 4);
    assert.equal(await inspect(), null);
    await page.waitForTimeout(500);
    console.log('PASS native browser drag from the asset card onto the scene');
    transfer = await start(); await over(transfer);
    await page.waitForFunction(() => window.scene.getObjectByName('AssetPlacementPreview')?.visible);
    await page.evaluate(() => window.jumpToTimeline(.1));
    assert.equal(await inspect(), null, 'Leaving 3D cancels the preview');
    assert.deepEqual(errors, []);
    console.log('PASS pending-load cancellation, drop-before-ready, dragend race and phase cleanup');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
