const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await page.waitForFunction(() => window.placedInstances?.length > 0 && window.scene.getObjectByName('AstronautCharacter')?.userData.animation);
    await page.evaluate(async () => {
      window.__actorApi = await import('/js/astronaut.js');
      window.__groundApi = await import('/js/marsScene.js');
      window.jumpToTimeline(.95); window.toggleCameraFollow(); window.controls.enableDamping = false;
    });
    const resetCourse = () => page.evaluate(() => {
      const api = window.__actorApi, ground = window.__groundApi.getTerrainHeight;
      api.resetAstronautToLander(ground);
      api.astroPos.set(12, ground(12, 12), 12);
      window.camera.position.set(12, api.astroPos.y + 3, 22);
      window.controls.target.set(12, api.astroPos.y + 1, 12); window.controls.update();
    });
    const tick = (count = 30) => page.evaluate(count => {
      const api = window.__actorApi;
      const start = api.astroPos.clone();
      for (let i = 0; i < count; i++) api.updateAstronautPhysics(1 / 60, window.__groundApi.getTerrainHeight, window.camera, window.controls, false);
      return { distance: Math.hypot(api.astroPos.x - start.x, api.astroPos.z - start.z),
        ...window.scene.getObjectByName('AstronautCharacter').userData, keys: { ...api.keyState } };
    }, count);

    await resetCourse(); await page.keyboard.down('w');
    const walk = await tick(); await page.keyboard.up('w');
    assert.ok(Math.abs(walk.distance - 1.6) < .03); assert.equal(walk.animation, 'Walking');
    await resetCourse(); await page.keyboard.down('ShiftLeft'); await page.keyboard.down('w');
    const run = await tick();
    assert.ok(Math.abs(run.distance / walk.distance - 2) < .03, 'Shift doubles actual travel speed');
    assert.equal(run.animation, 'Running'); assert.equal(run.isSprinting, true);
    await page.keyboard.up('ShiftLeft');
    const walkingAgain = await tick(6); await page.keyboard.up('w');
    assert.ok(Math.abs(walkingAgain.distance - .32) < .02); assert.equal(walkingAgain.animation, 'Walking');
    await resetCourse();
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('ShiftRight'); await page.keyboard.down('w');
    await page.keyboard.up('ShiftLeft');
    const otherShift = await tick(6); assert.equal(otherShift.isSprinting, true, 'Either Shift key can sustain sprint');
    await page.keyboard.up('ShiftRight'); await page.keyboard.up('w');
    await resetCourse(); await page.keyboard.down('ShiftLeft'); await page.keyboard.down('w'); await page.keyboard.down('d');
    const diagonal = await tick();
    assert.ok(Math.abs(diagonal.distance - run.distance) < .03, 'Diagonal sprint remains normalized');
    await page.keyboard.up('d'); await page.keyboard.up('w'); await page.keyboard.up('ShiftLeft');

    await page.evaluate(() => { const input = document.createElement('input'); input.id = 'action-test-input'; document.body.append(input); input.focus(); });
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('w');
    const typing = await tick(3);
    assert.equal(typing.distance, 0); assert.equal(typing.keys.shift, false);
    await page.keyboard.up('w'); await page.keyboard.up('ShiftLeft');
    await page.evaluate(() => document.getElementById('action-test-input').remove());
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('w');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const blurred = await tick(1); assert.equal(blurred.keys.shift, false); assert.equal(blurred.keys.w, false);
    await page.keyboard.up('w'); await page.keyboard.up('ShiftLeft');

    // On-screen Shift is holdable and pointer cancellation cannot leave sprint stuck.
    await resetCourse();
    const shiftButton = await page.locator('#key-shift').boundingBox();
    await page.mouse.move(shiftButton.x + shiftButton.width / 2, shiftButton.y + shiftButton.height / 2); await page.mouse.down();
    await page.evaluate(() => window.setVirtualKey('w', true));
    assert.equal((await tick(3)).isSprinting, true);
    await page.locator('#key-shift').dispatchEvent('pointercancel', { pointerId: 1 });
    assert.equal((await tick(1)).keys.shift, false);
    await page.mouse.up(); await page.evaluate(() => window.__actorApi.releaseAstronautControls());
    console.log(`PASS sprint: walk ${walk.distance.toFixed(2)} m / run ${run.distance.toFixed(2)} m per 0.5 s, diagonal normalization, both Shift keys, input/focus guards and virtual control`);

    await page.evaluate(() => {
      window.__actorApi.resetAstronautToLander(window.__groundApi.getTerrainHeight);
      window.astroPos.set(1.2, window.__groundApi.getTerrainHeight(1.2, 2.2), 2.2);
      window.camera.position.set(5, 3, 7); window.controls.target.set(.5, .8, 1); window.controls.update();
    });
    await tick(3);
    const actorData = () => page.evaluate(() => ({ ...window.scene.getObjectByName('AstronautCharacter').userData }));
    const beforeCast = await actorData();
    await page.keyboard.down('ShiftLeft'); await page.keyboard.press('e');
    await page.locator('#object-physics-menu').waitFor({ state: 'visible' });
    const menuPosition = await page.evaluate(() => [window.astroPos.x, window.astroPos.z]);
    await page.keyboard.press('s'); await page.keyboard.press('s');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.physicsMode), 'stress-analysis');
    assert.equal((await actorData()).castCount, beforeCast.castCount, 'Highlighting modes does not cast');
    assert.deepEqual(await page.evaluate(() => [window.astroPos.x, window.astroPos.z]), menuPosition, 'Shift+W/S in menus cannot run the character');
    await page.keyboard.press('Enter'); await page.keyboard.up('ShiftLeft');
    await page.waitForFunction(() => window.scene.getObjectByName('AstronautCharacter').userData.isCasting);
    const cast = await actorData();
    assert.equal(cast.animation, 'Magic_Attack'); assert.equal(cast.castCount, beforeCast.castCount + 1);
    const facing = await page.evaluate(() => {
      const actor = window.scene.getObjectByName('AstronautCharacter');
      const target = window.placedInstances[0].group.getWorldPosition(new window.THREE.Vector3()).sub(window.astroPos); target.y = 0; target.normalize();
      return new window.THREE.Vector3(0, 0, 1).applyQuaternion(actor.quaternion).dot(target);
    });
    assert.ok(facing > .98, 'The casting gesture faces the selected object');
    await page.waitForTimeout(850);
    await page.screenshot({ path: path.join(__dirname, '../scratch/physics-spell-cast.png') });
    await page.waitForFunction(() => {
      const data = window.scene.getObjectByName('AstronautCharacter').userData;
      return !data.isCasting && data.animation === 'Idle';
    }, null, { timeout: 6000 });
    assert.equal(await page.evaluate(() => window.placedInstances[0].physics.mode), 'stress-analysis', 'The selected physics continues after the one-shot gesture');

    const choose = async mode => {
      await page.evaluate(() => document.getElementById('btn-instance-physics').click());
      await page.locator(`[data-physics-mode="${mode}"]`).click();
    };
    await choose('stress-analysis');
    const recast = await actorData(); assert.equal(recast.castCount, cast.castCount + 1);
    await choose('stress-analysis');
    assert.equal((await actorData()).castCount, recast.castCount + 1, 'Repeated selection restarts the gesture');
    const selectedCount = (await actorData()).castCount;
    await page.locator('#physics-strength').fill('80'); await page.locator('#physics-pause').click();
    assert.equal((await actorData()).castCount, selectedCount, 'Parameter edits do not repeatedly cast');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('w');
    const interrupted = await tick(1);
    assert.equal(interrupted.isCasting, false); assert.equal(interrupted.animation, 'Running', 'Movement can interrupt a spell');
    await page.keyboard.up('w'); await page.keyboard.up('ShiftLeft'); await tick(1);
    await choose('static');
    assert.equal((await actorData()).castCount, selectedCount, 'Solid mode does not trigger a spell');
    await choose('ghost');
    assert.equal((await actorData()).castCount, selectedCount, 'Ghost mode does not trigger a spell');
    await page.keyboard.press('q');
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('w');
    await page.evaluate(() => window.jumpToTimeline(.1));
    assert.equal(await page.evaluate(() => window.__actorApi.keyState.shift), false);
    assert.equal(await page.evaluate(() => window.__actorApi.keyState.w), false);
    await page.keyboard.up('w'); await page.keyboard.up('ShiftLeft');
    assert.deepEqual(errors, []);
    console.log('PASS casting on confirmed physics selection, facing, automatic completion, recasting, movement interruption, parameter isolation, Solid/Ghost exclusions and scene-exit cleanup');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
