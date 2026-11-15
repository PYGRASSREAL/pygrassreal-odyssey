// Start the static server on 4183, or set ODYSSEY_URL.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /THREE.WebGLProgram|Shader Error/.test(message.text())) errors.push(message.text()); });
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await page.waitForFunction(() => window.placedInstances?.length > 0);
    await page.waitForTimeout(300);
    await page.keyboard.press('e');
    assert.equal(await page.locator('#object-physics-menu').isVisible(), false);
    await page.evaluate(() => window.jumpToTimeline(0.95));
    const id = await page.evaluate(async () => {
      const inst = await window.spawnModelInstance('asset_temple_gate', new window.THREE.Vector3(4, -0.05, 0));
      window.__physicsTestInstance = inst;
      const textures = inst.splatViewer.viewer.splatMesh.splatDataTextures;
      window.__physicsOriginal = {
        centers: textures.baseData.centers.slice(), covariances: textures.baseData.covariances.slice(),
        colors: textures.baseData.colors.slice(), packed: textures.centerColors.data.slice(),
        tree: inst.splatViewer.viewer.splatMesh.getSplatTree,
      };
      window.toggleCameraFollow();
      window.camera.position.set(9, 4, 10); window.controls.target.set(4, 1.7, 0); window.controls.update();
      window.astroPos.set(50, 0, 50);
      return inst.id;
    });
    await page.waitForTimeout(250);
    const outlinedId = () => page.evaluate(async () => (await import('/js/instancePhysics.js')).getOutlinedInstance()?.id ?? null);
    assert.equal(await outlinedId(), null, 'Spawning and ordinary selection do not enable outlines');
    assert.equal(await page.locator('#object-interaction-prompt').isVisible(), false, 'No distant interaction hint');
    await page.keyboard.press('e');
    assert.equal(await page.locator('#object-physics-menu').isVisible(), false, 'E cannot edit a distant object');
    await page.evaluate(() => {
      window.selectInstance(window.placedInstances[0].id); // Deliberately stale selection.
      window.astroPos.set(4.3, 0, 2.2);
    });
    await page.waitForFunction(id => {
      const prompt = document.getElementById('object-interaction-prompt');
      return !prompt.hidden && prompt.dataset.instanceId === id;
    }, id);
    await page.waitForTimeout(220); // Let the short E-key arrival animation finish.
    assert.equal(await outlinedId(), null, 'The proximity hint does not enable an outline');
    await page.screenshot({ path: path.join(__dirname, '../scratch/object-proximity-prompt.png') });
    await page.keyboard.press('e');
    assert.equal(await page.locator('#object-physics-menu').isVisible(), true);
    assert.equal(await outlinedId(), id, 'Only entering with E enables the outline');
    assert.equal(await page.evaluate(async () => (await import('/js/outlinerManager.js')).getSelectedInstance().id), id, 'E selects the nearby object, not the stale selection');
    assert.equal(await page.locator('#physics-target').textContent(), 'Thai Temple Gate (01)');
    assert.equal(await page.locator('dialog[open]').count(), 0, 'No modal blocks the viewport');
    assert.ok((await page.locator('#object-physics-menu').boundingBox()).width <= 240, 'Context menu stays compact');
    const menuPosition = await page.evaluate(() => [window.astroPos.x, window.astroPos.z]);
    await page.keyboard.press('s');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.physicsMode), 'ghost', 'S moves down through modes');
    await page.keyboard.press('w');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.physicsMode), 'static', 'W moves up through modes');
    await page.keyboard.press('w');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.physicsMode), 'enlivening-gs', 'W wraps at the first mode');
    await page.keyboard.press('s');
    await page.locator('#physics-menu-down').click();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.physicsMode), 'ghost', 'The S button also navigates');
    await page.locator('#physics-menu-up').click();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.physicsMode), 'static', 'The W button also navigates');
    assert.deepEqual(await page.evaluate(() => [window.astroPos.x, window.astroPos.z]), menuPosition, 'Menu W/S does not move the astronaut');
    await page.keyboard.press('q');
    assert.equal(await page.locator('#object-physics-menu').isVisible(), false);
    assert.equal(await outlinedId(), null, 'Q closes the menu and removes its outline');
    await page.keyboard.press('e');
    assert.equal(await outlinedId(), id);
    await page.screenshot({ path: path.join(__dirname, '../scratch/object-physics-context.png') });

    const openMenu = async () => {
      if (await page.locator('#object-physics-menu').isVisible()) return;
      await page.evaluate(() => document.getElementById('btn-instance-physics').click());
      await page.locator('#object-physics-menu').waitFor({ state: 'visible' });
    };
    for (const mode of ['stress-analysis', 'megas-thermal', 'voronoi-fracture', 'plant-wilting', 'diffwind-aerodynamics', 'physskin-deformation', 'magnetic-mpm', 'enlivening-gs']) {
      await openMenu();
      await page.locator(`[data-physics-mode="${mode}"]`).click();
      assert.equal(await page.locator('#object-physics-menu').isVisible(), false, 'Choosing a mode dismisses its menu');
      await page.locator('#object-physics-parameters').waitFor({ state: 'visible' });
      await page.waitForFunction(() => {
        const data = window.__physicsTestInstance.splatViewer.viewer.splatMesh.splatDataTextures.baseData;
        return data.centers.some((v, i) => Math.abs(v - window.__physicsOriginal.centers[i]) > 1e-5);
      });
      assert.equal(await page.evaluate(() => {
        const base = window.__physicsTestInstance.splatViewer.viewer.splatMesh.splatDataTextures.baseData;
        return base.centers.every(Number.isFinite) && base.covariances.every(Number.isFinite) &&
          base.colors.every((v, i) => i % 4 !== 3 || v === window.__physicsOriginal.colors[i]);
      }), true);
      console.log(`PASS ${mode}: live Gaussian deformation with object parameters`);
    }
    await page.locator('#physics-pause').click();
    await page.evaluate(() => { window.__physicsPaused = window.__physicsTestInstance.splatViewer.viewer.splatMesh.splatDataTextures.baseData.centers.slice(); });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__physicsTestInstance.splatViewer.viewer.splatMesh.splatDataTextures.baseData.centers.every((v, i) => v === window.__physicsPaused[i])), true);
    await page.locator('#physics-strength').fill('0');
    await page.waitForFunction(() => window.__physicsTestInstance.splatViewer.viewer.splatMesh.splatDataTextures.baseData.centers.every((v, i) => Math.abs(v - window.__physicsOriginal.centers[i]) < 1e-5));
    await page.locator('#physics-strength').fill('75');
    assert.equal(await page.locator('#physics-strength-value').textContent(), '75%');
    // A focused slider owns arrow/WASD input; the floating panel itself does not.
    const beforePosition = await page.evaluate(() => window.astroPos.toArray());
    await page.keyboard.down('w'); await page.waitForTimeout(100); await page.keyboard.up('w');
    assert.deepEqual(await page.evaluate(() => [window.astroPos.x, window.astroPos.z]), [beforePosition[0], beforePosition[2]]);
    await page.locator('#physics-parameter-mode').click();
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.down('w'); await page.waitForTimeout(150); await page.keyboard.up('w');
    assert.notDeepEqual(await page.evaluate(() => [window.astroPos.x, window.astroPos.z]), [beforePosition[0], beforePosition[2]], 'Walking remains available beside floating parameters');
    const beforeAnchor = await page.locator('#object-physics-parameters').getAttribute('style');
    await page.evaluate(() => { window.camera.position.x -= 2; window.controls.update(); });
    await page.waitForFunction(before => document.getElementById('object-physics-parameters').getAttribute('style') !== before, beforeAnchor);
    await page.locator('#physics-restore').click();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => {
      const mesh = window.__physicsTestInstance.splatViewer.viewer.splatMesh, data = mesh.splatDataTextures;
      return data.baseData.centers.every((v, i) => v === window.__physicsOriginal.centers[i]) &&
        data.baseData.covariances.every((v, i) => v === window.__physicsOriginal.covariances[i]) &&
        data.baseData.colors.every((v, i) => v === window.__physicsOriginal.colors[i]) &&
        data.centerColors.data.every((v, i) => v === window.__physicsOriginal.packed[i]) && mesh.getSplatTree === window.__physicsOriginal.tree;
    }), true, 'Restoring a model cancels workers and restores its complete original data');
    await openMenu(); await page.locator('[data-physics-mode="ghost"]').click();
    assert.equal(await page.evaluate(async () => {
      const colliders = (await import('/js/modelManager.js')).getActiveColliders();
      return window.__physicsTestInstance.colliders.every(c => !colliders.includes(c));
    }), true);
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('Control+z');
    assert.equal(await page.evaluate(() => window.__physicsTestInstance.physics.mode), 'static');
    await page.keyboard.press('Control+y');
    assert.equal(await page.evaluate(() => window.__physicsTestInstance.physics.mode), 'ghost');
    await page.locator('#physics-parameters-close').click();
    assert.equal(await outlinedId(), null, 'Closing the object interaction clears the outline');

    // Pick a visible pixel of a real Gaussian and use an actual right click.
    const hitPixel = await page.evaluate(async () => {
      const { pickObjectInstanceAt } = await import('/js/objectInteraction.js');
      const inst = window.__physicsTestInstance, mesh = inst.splatViewer.splatMesh;
      const data = mesh.splatDataTextures.baseData;
      for (let i = 0; i < mesh.getSplatCount(); i += 3001) {
        if (data.colors[i * 4 + 3] < 100) continue;
        const p = new window.THREE.Vector3().fromArray(data.centers, i * 3).applyMatrix4(mesh.matrixWorld).project(window.camera);
        const x = (p.x + 1) * innerWidth / 2, y = (1 - p.y) * innerHeight / 2;
        if (x < 340 || x > innerWidth - 340 || y < 100 || y > innerHeight - 50) continue;
        if (pickObjectInstanceAt(x, y)?.id === inst.id) return { x, y };
      }
      return null;
    });
    assert.ok(hitPixel, 'Actual Gaussian pixels can be picked');
    await page.mouse.click(hitPixel.x, hitPixel.y, { button: 'right' });
    await page.locator('#object-physics-menu').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#object-physics-menu').getAttribute('data-instance-id'), id);
    assert.equal(await outlinedId(), null, 'Right-clicking without E does not enable an outline');
    await page.keyboard.press('e');
    assert.equal(await outlinedId(), id, 'E can activate the outline from an already-open context menu');
    assert.equal(await page.locator('#object-physics-menu').isVisible(), true, 'E keeps the menu open; Q exits');
    await page.keyboard.press('q');
    assert.equal(await outlinedId(), null);
    await page.keyboard.press('e');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'menuitemradio');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ำ', code: 'KeyE', bubbles: true })));
    await page.locator('#object-physics-menu').waitFor({ state: 'visible' });
    assert.equal(await outlinedId(), id, 'Physical E on a Thai keyboard enables the outline');
    await page.locator('[data-physics-mode="stress-analysis"]').click();
    await page.waitForFunction(() => window.__physicsTestInstance.splatViewer.viewer.splatMesh.splatDataTextures.baseData.colors[0] !== window.__physicsOriginal.colors[0]);
    await page.locator('#physics-pause').click();
    await page.locator('#physics-heatmap').uncheck();
    await page.waitForFunction(() => window.__physicsTestInstance.splatViewer.viewer.splatMesh.splatDataTextures.baseData.colors.every((v, i) => v === window.__physicsOriginal.colors[i]));
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ๆ', code: 'KeyQ', bubbles: true })));
    assert.equal(await page.locator('#object-physics-parameters').isVisible(), false, 'Q exits parameters too');
    assert.equal(await outlinedId(), null, 'Q also clears the outline after choosing physics');
    assert.equal(await page.evaluate(() => window.__physicsTestInstance.physics.mode), 'stress-analysis', 'Q keeps the applied physics');
    await page.keyboard.press('e');
    await page.locator('[data-physics-mode="stress-analysis"]').click();
    await page.locator('#object-physics-parameters').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(__dirname, '../scratch/object-physics-parameters.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    const mobileBounds = await page.locator('#object-physics-parameters').boundingBox();
    assert.ok(mobileBounds && mobileBounds.x >= 0 && mobileBounds.x + mobileBounds.width <= 390 && mobileBounds.y + mobileBounds.height <= 844);
    assert.equal(await page.locator('#v3d-layer-panel').evaluate(el => getComputedStyle(el).pointerEvents), 'none', 'Large scene panels step aside on mobile while editing');
    await page.screenshot({ path: path.join(__dirname, '../scratch/object-physics-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(id => window.toggleInstanceVisibility(null, id), id);
    assert.equal(await page.locator('#object-physics-parameters').isVisible(), false);
    await page.evaluate(id => window.toggleInstanceVisibility(null, id), id);
    await page.evaluate(id => window.toggleInstanceLock(null, id), id);
    assert.equal(await page.locator('#btn-instance-physics').isDisabled(), true);
    await page.evaluate(id => window.toggleInstanceLock(null, id), id);
    await page.evaluate(() => window.selectTerrainLayer());
    assert.equal(await page.locator('#btn-instance-physics').isDisabled(), true);
    await page.evaluate(id => window.executeDeleteInstance(id), id);
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => !window.__physicsTestInstance.deleted && window.__physicsTestInstance.splatViewer.viewer.splatMesh.getSplatTree() === null);
    await page.evaluate(() => window.jumpToTimeline(0.1));
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#object-interaction-prompt').isVisible(), false);
    assert.equal(await page.locator('#object-physics-menu').isVisible(), false);
    assert.equal(await page.locator('#object-physics-parameters').isVisible(), false);
    assert.deepEqual(errors, [], 'No JavaScript or shader errors');
    console.log('PASS E-only outlines, W/S keys and buttons, Q exit, proximity, anchored controls, exact restore, undo/redo, right-click picking, Thai shortcuts, mobile and deletion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
