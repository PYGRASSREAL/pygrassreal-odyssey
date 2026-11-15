const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1592, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (/\[(AssetPlacement|AssetBrowser|ModelManager)\]/.test(message.text())) console.log(message.type(), message.text());
    });
    // Keep this regression focused on the 3D editor rather than timeline media.
    await page.route('**/assets/scroll_webp/**', route => route.abort());
    await page.route('**/assets/loops/**', route => route.abort());
    await page.goto(process.env.ODYSSEY_URL || 'http://localhost:4173/');
    await page.waitForFunction(() => window.placedInstances?.length === 1 &&
      window.scene.getObjectByName('Apollo_12_Landing_Terrain'));
    await page.evaluate(() => window.jumpToTimeline(.95));
    await page.waitForFunction(() => document.getElementById('threejs-layer').classList.contains('active'));
    await page.waitForTimeout(500);

    const buffer = fs.readFileSync(path.join(__dirname, '../assets/models/sci-fi-spacecraft-probe.py3s'));
    const snapshot = () => page.evaluate(() => ({
      instances: window.placedInstances.map(i => ({ id: i.id, deleted: i.deleted, pos: i.group.position.toArray() })),
      layers: document.getElementById('v3d-layer-panel').innerHTML,
      sceneChildren: window.scene.children.map(child => child.uuid),
    }));
    const baseline = await snapshot();
    const initialLibrarySize = await page.evaluate(() => window.assetLibrary.length);
    const dropFile = async (selector, name) => {
      const transfer = await page.evaluateHandle(({ name, base64 }) => {
        const transfer = new DataTransfer();
        const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
        transfer.items.add(new File([bytes], name, { type: 'model/vnd.pygrassreal.py3s' }));
        return transfer;
      }, { name, base64: buffer.toString('base64') });
      await page.locator(selector).dispatchEvent('drop', { dataTransfer: transfer, clientX: 800, clientY: 550 });
      await transfer.dispose();
    };
    const targets = ['#drop-zone', '#py3s-file-list-container', '#v3d-leftpanel', '#threejs-canvas', 'body'];
    for (const [index, target] of targets.entries()) {
      const name = `import-only-${index}.py3s`;
      await dropFile(target, name);
      await page.waitForFunction(name => window.assetLibrary.some(a => a.name === name), name);
      await page.waitForTimeout(450);
      assert.deepEqual(await snapshot(), baseline, `${target}: file import leaves scene and layers unchanged`);
    }
    await page.locator('#model-file-input').setInputFiles({ name: 'file-picker.py3s', mimeType: 'model/vnd.pygrassreal.py3s', buffer });
    await page.waitForFunction(() => window.assetLibrary.some(a => a.name === 'file-picker.py3s'));
    await page.waitForTimeout(450);
    assert.deepEqual(await snapshot(), baseline, 'File picker only imports into the library');

    // Re-import after the duplicate-event suppression window to exercise updating an existing asset.
    await page.waitForTimeout(1800);
    const originalId = await page.evaluate(() => window.assetLibrary.find(a => a.name === 'import-only-0.py3s').id);
    await page.evaluate(() => { window.assetLibrary.find(a => a.name === 'import-only-0.py3s').buffer = null; });
    await dropFile('#drop-zone', 'import-only-0.py3s');
    await page.waitForFunction(() => window.assetLibrary.find(a => a.name === 'import-only-0.py3s').buffer !== null);
    await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => window.assetLibrary.find(a => a.name === 'import-only-0.py3s').id), originalId);
    assert.equal(await page.evaluate(() => window.assetLibrary.length), initialLibrarySize + targets.length + 1);
    assert.deepEqual(await snapshot(), baseline, 'Re-import updates the library without adding a layer');
    console.log('PASS file drops on all import targets, file picker and re-import leave scene and layers unchanged');

    await page.evaluate(() => {
      window.toggleCameraFollow();
      window.controls.enableDamping = false;
      window.camera.position.set(7, 7, 10);
      window.controls.target.set(0, .5, 0);
      window.controls.update();
    });
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await page.locator(`#asset-row-${originalId}`).dispatchEvent('dragstart', { dataTransfer: transfer });
    await page.locator('#threejs-canvas').dispatchEvent('dragover', { dataTransfer: transfer, clientX: 800, clientY: 550 });
    await page.locator('#threejs-canvas').dispatchEvent('drop', { dataTransfer: transfer, clientX: 800, clientY: 550 });
    await page.locator('body').dispatchEvent('dragend', { dataTransfer: transfer });
    await transfer.dispose();
    await page.waitForFunction(() => window.placedInstances.length === 2);
    assert.equal(await page.evaluate(() => window.placedInstances.at(-1).assetId), originalId, 'Explicit asset placement creates a layer');
    await page.waitForTimeout(500);
    await page.evaluate(() => window.historyUndo());
    assert.equal(await page.evaluate(() => window.placedInstances.filter(i => !i.deleted).length), 1);
    await page.evaluate(() => window.historyRedo());
    assert.equal(await page.evaluate(() => window.placedInstances.filter(i => !i.deleted).length), 2);
    assert.deepEqual(errors, []);
    console.log('PASS file drops on all import targets, file picker and re-import only update Assets; explicit drag placement creates one undoable layer');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
