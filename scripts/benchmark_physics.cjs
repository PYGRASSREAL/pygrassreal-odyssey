const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await page.waitForFunction(() => window.placedInstances?.length > 0);
    // The initial lander releases the existing spawn lock after 250 ms.
    await page.waitForTimeout(300);
    await page.evaluate(async () => {
      window.jumpToTimeline(0.95);
      window.__benchInst = await window.spawnModelInstance('asset_temple_gate', new window.THREE.Vector3(1, -0.05, 0));
    });
    await page.waitForTimeout(800);
    const cpu = await page.evaluate(async () => {
      const { createSplatPhysicsSession } = await import('/js/splatPhysics.js');
      const inst = window.__benchInst;
      inst.group.updateMatrixWorld(true);
      const start = performance.now();
      const session = createSplatPhysicsSession(inst.splatViewer.viewer, 'stress-analysis', inst.splatViewer.splatMesh.matrixWorld);
      const setupMs = performance.now() - start;
      const times = [];
      for (let i = 0; i < 10; i++) {
        const begin = performance.now(); session.update(i * 0.1 + 1, 0.65, true); times.push(performance.now() - begin);
      }
      session.dispose();
      times.sort((a, b) => a - b);
      return { count: session.count, setupMs, medianUpdateMs: times[5], worstUpdateMs: times.at(-1) };
    });
    const measure = () => page.evaluate(() => new Promise(resolve => {
      const frames = [], longTasks = [];
      const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.duration)));
      observer.observe({ type: 'longtask' });
      let last = performance.now(), start = last;
      const tick = now => {
        frames.push(now - last); last = now;
        if (now - start < 3500) { requestAnimationFrame(tick); return; }
        observer.disconnect(); frames.sort((a, b) => a - b);
        resolve({ fps: Math.round(frames.length * 1000 / (now - start)), medianFrameMs: frames[Math.floor(frames.length / 2)],
          p95FrameMs: frames[Math.floor(frames.length * 0.95)], longTasks: longTasks.length, worstTaskMs: Math.max(0, ...longTasks) });
      };
      requestAnimationFrame(tick);
    }));
    const solid = await measure();
    const applyMs = await page.evaluate(async () => {
      const { applyInstancePhysics } = await import('/js/instancePhysics.js');
      window.__benchRest = window.__benchInst.splatViewer.viewer.splatMesh.splatDataTextures.baseData.centers.slice();
      const start = performance.now();
      applyInstancePhysics(window.__benchInst, { mode: 'stress-analysis' });
      return performance.now() - start;
    });
    await page.waitForFunction(() => window.__benchInst.splatViewer.viewer.splatMesh.splatDataTextures.baseData.centers.some((v, i) => Math.abs(v - window.__benchRest[i]) > 1e-5));
    await page.waitForTimeout(600);
    const stress = await measure();
    const result = { cpu, applyMs, solid, stress, errors };
    console.log(JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(__dirname, '../scratch', process.env.BENCH_OUTPUT || 'physics-benchmark.json'), JSON.stringify(result, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
