const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1892, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await page.waitForFunction(() => window.placedInstances?.length > 0);
    await page.evaluate(() => {
      window.jumpToTimeline(.95); window.toggleCameraFollow(); window.selectModel(false);
      window.controls.enableDamping = false;
      window.astroPos.set(1.2, 0, 2.2);
    });
    const check = async selector => {
      const result = await page.locator(selector).evaluate(element => {
        if (element.hidden) return { visible: false };
        const r = element.getBoundingClientRect();
        const overlaps = [...document.querySelectorAll('.top-nav, #v3d-leftpanel, #v3d-wasd-hud, #v3d-layer-panel')].filter(panel => {
          const style = getComputedStyle(panel);
          if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
          const p = panel.getBoundingClientRect();
          return r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top;
        }).map(panel => panel.id || panel.className);
        return { visible: true, overlaps, contained: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + .5 && r.bottom <= innerHeight + .5, rect: r.toJSON() };
      });
      if (result.visible) {
        assert.deepEqual(result.overlaps, [], `${selector} overlaps GUI: ${result.overlaps}`);
        assert.equal(result.contained, true, `${selector} must remain within the viewport`);
      }
      return result;
    };
    let visibleCases = 0;
    for (const targetX of [-7, -5, 0, 5, 7]) {
      await page.evaluate(x => {
        window.camera.position.set(0, 3, 10); window.controls.target.set(x, .8, 0); window.controls.update();
      }, targetX);
      await page.waitForTimeout(160);
      if ((await check('#object-interaction-prompt')).visible) visibleCases++;
      if (targetX === -7) await page.screenshot({ path: path.join(__dirname, '../scratch/interaction-right-edge.png') });
    }
    assert.ok(visibleCases >= 3, 'Hints remain available when an object is partly visible near an edge');
    await page.evaluate(() => {
      document.getElementById('v3d-layer-panel').style.width = '420px';
      document.getElementById('v3d-leftpanel').style.width = '350px';
      window.controls.target.set(-5, .8, 0); window.controls.update();
    });
    await page.waitForTimeout(350);
    await check('#object-interaction-prompt');
    await page.evaluate(() => {
      document.getElementById('v3d-layer-panel').style.width = '';
      document.getElementById('v3d-leftpanel').style.width = '';
      window.controls.target.set(0, .8, 0); window.controls.update();
    });
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForTimeout(350);
    await check('#object-interaction-prompt');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(350);
    await check('#object-interaction-prompt');
    await page.keyboard.press('e');
    await page.locator('#object-physics-menu').waitFor({ state: 'visible' });
    await check('#object-physics-menu');
    await page.locator('[data-physics-mode="stress-analysis"]').click();
    await page.locator('#object-physics-parameters').waitFor({ state: 'visible' });
    await check('#object-physics-parameters');
    await page.screenshot({ path: path.join(__dirname, '../scratch/interaction-mobile-safe.png') });
    await page.keyboard.press('q');
    await page.waitForTimeout(300);
    await check('#object-interaction-prompt');
    await page.setViewportSize({ width: 1892, height: 1000 });
    await page.waitForTimeout(350);
    await page.evaluate(async () => {
      const { openPhysicsMenu } = await import('/js/instancePhysics.js');
      const panel = document.getElementById('v3d-layer-panel').getBoundingClientRect();
      openPhysicsMenu(window.placedInstances[0], { x: panel.left - 4, y: innerHeight - 4 });
    });
    await page.locator('#object-physics-menu').waitFor({ state: 'visible' });
    await check('#object-physics-menu');
    assert.deepEqual(errors, []);
    console.log('PASS scene-only E hints, left/right camera edges, resized panels, narrow/mobile views and context-menu clamping');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
