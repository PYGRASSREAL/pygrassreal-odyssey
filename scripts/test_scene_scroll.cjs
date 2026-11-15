const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1892, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const pixel = Buffer.from(await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = c.height = 1;
      return c.toDataURL().split(',')[1];
    }), 'base64');
    let loadedStage5 = false;
    await page.route('**/assets/scroll_webp/**', route => {
      if (route.request().url().includes('clip_05')) loadedStage5 = true;
      if (route.request().url().includes('clip_03/frame_0000')) return route.abort();
      return route.fulfill({ contentType: 'image/png', body: pixel });
    });
    await page.route('**/assets/loops/**', route => route.fulfill({ contentType: 'image/png', body: pixel }));
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await page.waitForFunction(() => window.placedInstances?.length > 0);
    await page.evaluate(async () => {
      const resource = performance.getEntriesByType('resource').find(r => /\/js\/timeline\.js/.test(r.name));
      window.__timeline = await import(resource.name);
    });
    await page.mouse.move(800, 600); await page.mouse.wheel(0, 2300);
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => window.scrollY > 500), 'Story stages retain native scrolling');
    assert.equal(await page.evaluate(() => window.__timeline.getCurrentPhase()), '2d');
    await page.locator('#btn-stage-3d').click();
    await page.waitForFunction(() => window.__timeline.getCurrentPhase() === '3d' &&
      Math.abs(document.getElementById('threejs-canvas').getBoundingClientRect().top) < .5);
    await page.evaluate(() => {
      window.__resetCount = 0;
      const reset = window.reset3DCamera;
      window.reset3DCamera = (...args) => { window.__resetCount++; return reset(...args); };
      window.controls.enableDamping = false;
    });
    const scroll = await page.evaluate(() => window.scrollY);
    const beforeZoom = await page.evaluate(() => window.camera.position.distanceTo(window.controls.target));
    await page.mouse.move(850, 600); await page.mouse.wheel(0, -300); await page.waitForTimeout(250);
    const afterZoom = await page.evaluate(() => window.camera.position.distanceTo(window.controls.target));
    assert.ok(afterZoom < beforeZoom, 'Wheel still zooms the 3D camera');
    await page.mouse.move(1790, 230); await page.mouse.wheel(0, -18000); await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__timeline.getCurrentPhase()), '3d');
    assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - scroll) <= 1, 'Panel wheel does not navigate the timeline');
    await page.evaluate(() => {
      for (let i = 0; i < 8; i++) window.dispatchEvent(new Event('scroll'));
      window.scrollTo(0, 0); // Simulate browser focus/drag autoscroll.
    });
    await page.waitForFunction(y => Math.abs(window.scrollY - y) <= 1, scroll);
    assert.equal(await page.evaluate(() => window.__resetCount), 0, 'Incidental scroll never resets the scene camera');
    await page.evaluate(() => {
      const content = document.createElement('div'); content.id = 'scroll-test-content';
      content.style.cssText = 'height:4000px;flex-shrink:0';
      document.getElementById('v3d-layer-panel').append(content);
    });
    await page.mouse.move(1790, 230); await page.mouse.wheel(0, 500); await page.waitForTimeout(150);
    assert.ok(await page.locator('#v3d-layer-panel').evaluate(el => el.scrollTop > 0), 'Panel content remains scrollable');
    await page.evaluate(() => document.getElementById('scroll-test-content').remove());
    await page.locator('#btn-physics-help').click(); await page.keyboard.press('q');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('scene-3d-active')), true, 'Closing Help preserves the 3D scroll lock');
    await page.setViewportSize({ width: 1600, height: 800 });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__timeline.getCurrentPhase()), '3d');
    assert.equal(await page.evaluate(() => window.__resetCount), 0);
    await page.locator('#btn-stage-2').click();
    await page.waitForFunction(() => window.__timeline.getCurrentPhase() === '2d');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('scene-3d-active')), false);
    await page.mouse.move(800, 500); await page.mouse.wheel(0, -18000); await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'Stage navigation restores normal story scrolling');
    await page.evaluate(() => window.jumpToTimeline(.34));
    await page.waitForTimeout(300);
    assert.ok(loadedStage5, 'A missing frame does not halt later stage preloading');
    assert.deepEqual(errors, [], 'Missing story frames do not throw canvas errors');
    console.log('PASS 2D story scroll, 3D wheel zoom, panel scrolling, drag/focus scroll guard, stable camera, Help, resize, stage exit and missing frames');
    await page.close();
    const delayed = await browser.newPage();
    delayed.on('pageerror', error => errors.push(error.message));
    await delayed.addInitScript(() => {
      window.__storyFrames = [];
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
        if (this.canvas.id === 'scroll-canvas-layer') window.__storyFrames.push(image.src || '');
        return draw.call(this, image, ...args);
      };
    });
    let releaseStage1;
    const gate = new Promise(resolve => { releaseStage1 = resolve; });
    await delayed.route('**/assets/scroll_webp/**', async route => {
      if (route.request().url().includes('clip_01')) await gate;
      return route.fulfill({ contentType: 'image/png', body: pixel });
    });
    await delayed.route('**/assets/loops/**', route => route.fulfill({ contentType: 'image/png', body: pixel }));
    await delayed.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/', { waitUntil: 'domcontentloaded' });
    await delayed.waitForFunction(() => typeof window.jumpToTimeline === 'function');
    await delayed.evaluate(() => window.jumpToTimeline(.35));
    releaseStage1();
    await delayed.waitForFunction(() => window.__storyFrames.some(src => src.includes('clip_03')));
    assert.equal(await delayed.evaluate(() => window.__storyFrames.some(src => src.includes('clip_01'))), false,
      'A late Stage 1 image cannot replace a different selected story stage');
    assert.deepEqual(errors, []);
    console.log('PASS delayed Stage 1 loading respects the currently selected stage');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
