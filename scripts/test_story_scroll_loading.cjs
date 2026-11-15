const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const pixel = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      return canvas.toDataURL().split(',')[1];
    }), 'base64');
    await page.addInitScript(() => {
      window.__storyFrames = [];
      const draw = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
        if (this.canvas.id === 'scroll-canvas-layer') window.__storyFrames.push(image.src);
        return draw.call(this, image, ...args);
      };
    });
    // Exercise the actual HTML/CSS/timeline without loading the unrelated 3D engine.
    await page.route('**/js/main.js?*', route => route.fulfill({
      contentType: 'text/javascript',
      body: `import { initTimeline, jumpToTimeline } from './timeline.js';
        window.jumpToTimeline = jumpToTimeline;
        initTimeline();`,
    }));
    const pending = new Map();
    await page.route('**/assets/scroll_webp/**', async route => {
      const key = route.request().url().split('/scroll_webp/')[1];
      await new Promise(resolve => {
        const callbacks = pending.get(key) || [];
        callbacks.push(resolve);
        pending.set(key, callbacks);
      });
      await route.fulfill({ contentType: 'image/png', body: pixel });
    });
    await page.route('**/assets/loops/**', route => route.fulfill({ contentType: 'image/png', body: pixel }));
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.jumpToTimeline === 'function');

    async function release(key) {
      await assert.doesNotReject(async () => {
        const deadline = Date.now() + 4000;
        while (!pending.has(key) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
        assert.ok(pending.has(key), `Current frame ${key} is requested while earlier frames are still loading`);
      });
      for (const resolve of pending.get(key)) resolve();
      pending.delete(key);
    }
    async function expectFrame(key) {
      await page.waitForFunction(key => window.__storyFrames.at(-1)?.endsWith(key), key, { timeout: 4000 });
    }
    async function currentFrame() {
      return page.evaluate(() => {
        const progress = window.scrollY / (document.documentElement.scrollHeight - innerHeight);
        const stage = Math.min(5, Math.floor(progress / .17) + 1);
        const fraction = (progress - (stage - 1) * .17) / .13;
        const frame = Math.min(118, Math.max(0, Math.floor(fraction * 119)));
        return `clip_${String(stage).padStart(2, '0')}/frame_${String(frame).padStart(4, '0')}.webp`;
      });
    }

    await page.locator('#btn-stage-2').click();
    const stage2 = await currentFrame();
    // Verify a later stage can load without waiting for all 119 Stage 1 frames.
    await release(stage2);
    await expectFrame(stage2);

    await page.evaluate(() => window.jumpToTimeline(.23));
    const staleStage2 = await currentFrame();
    await page.locator('#btn-stage-4').click();
    const stage4 = await currentFrame();
    const position = await page.evaluate(() => scrollY);
    await release(staleStage2);
    await release(stage4);
    await expectFrame(stage4);
    assert.equal(await page.evaluate(() => scrollY), position, 'Late frames do not move the document');
    assert.equal(await page.evaluate(key => window.__storyFrames.some(src => src.endsWith(key)), staleStage2), false,
      'An old Stage 2 request cannot paint over Stage 4');

    // Reproduce a quick wheel reversal using native scrolling, then stop.
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, -2800);
    await page.waitForTimeout(150);
    const wheelFrame = await currentFrame();
    await release(wheelFrame);
    await expectFrame(wheelFrame);

    await page.evaluate(() => window.jumpToTimeline(.08));
    const stage1 = await currentFrame();
    await release(stage1);
    await expectFrame(stage1);
    await release('clip_01/frame_0000.webp');
    await page.waitForTimeout(150);
    await expectFrame(stage1);
    assert.equal(await page.evaluate(() => window.__storyFrames.some(src => src.endsWith('clip_01/frame_0000.webp'))), false,
      'The initial image cannot reset a scrolled Stage 1 to its first frame');

    await page.evaluate(() => window.jumpToTimeline(.05));
    const olderStage1 = await currentFrame();
    await page.evaluate(() => window.jumpToTimeline(.10));
    const latestStage1 = await currentFrame();
    await release(latestStage1);
    await expectFrame(latestStage1);
    await release(olderStage1);
    await page.waitForTimeout(150);
    await expectFrame(latestStage1);
    assert.equal(await page.evaluate(key => window.__storyFrames.some(src => src.endsWith(key)), olderStage1), false,
      'An older frame in the same stage cannot replace the latest scroll position');

    await page.evaluate(() => window.jumpToTimeline(.72));
    const beforeLoop = await currentFrame();
    await page.evaluate(() => window.jumpToTimeline(.82));
    await release(beforeLoop);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.getElementById('loop-overlay').classList.contains('active')), true);
    assert.equal(await page.evaluate(key => window.__storyFrames.some(src => src.endsWith(key)), beforeLoop), false,
      'A scrub request that finishes during the loop cannot repaint the story');
    assert.deepEqual(errors, []);
    console.log('PASS priority loading, late frame ordering, native wheel reversal, late first paint, loop transition and stable scroll');
    await page.close();

    // Check the complete app still enters/leaves 3D and restores story scrolling.
    const integrated = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    integrated.on('pageerror', error => errors.push(error.message));
    await integrated.route('**/assets/scroll_webp/**', route => {
      if (route.request().url().includes('clip_03/frame_0000')) return route.abort();
      return route.fulfill({ contentType: 'image/png', body: pixel });
    });
    await integrated.route('**/assets/loops/**', route => route.fulfill({ contentType: 'image/png', body: pixel }));
    await integrated.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await integrated.waitForFunction(() => window.placedInstances?.length > 0);
    await integrated.mouse.move(700, 400);
    for (const distance of [2200, -1400, 3100, -2500, 3600, -2100]) {
      await integrated.mouse.wheel(0, distance);
    }
    await integrated.locator('#btn-stage-2').click();
    await integrated.waitForFunction(() => document.getElementById('btn-stage-2').classList.contains('active'));
    const before = await integrated.evaluate(() => scrollY);
    await integrated.waitForTimeout(300);
    assert.equal(await integrated.evaluate(() => scrollY), before, 'Full app retains the latest selected position');
    await integrated.locator('#btn-stage-3d').click();
    await integrated.waitForFunction(() => document.documentElement.classList.contains('scene-3d-active'));
    await integrated.locator('#btn-stage-2').click();
    await integrated.waitForFunction(() => !document.documentElement.classList.contains('scene-3d-active'));
    await integrated.mouse.move(700, 400);
    await integrated.mouse.wheel(0, -18000);
    await integrated.waitForFunction(() => scrollY === 0 && document.getElementById('btn-stage-1').classList.contains('active'));
    assert.deepEqual(errors, [], 'The complete app tolerates missing frames without script errors');
    console.log('PASS full app rapid scrolling, stage selection, 3D entry/exit, scroll to start and missing frames');
    await integrated.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
