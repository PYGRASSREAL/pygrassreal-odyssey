const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 945 }, deviceScaleFactor: 1.5 });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR:', error.message); });
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) console.error('PAGE CONSOLE:', message.text()); });
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await page.waitForFunction(() => window.placedInstances?.length > 0);
    await page.evaluate(() => { window.jumpToTimeline(0.95); window.reset3DCamera(); });
    await page.waitForTimeout(800);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Profiler.enable');
    if (process.env.CPU_SLOWDOWN) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU_SLOWDOWN) });
    await page.evaluate(() => {
      window.__sceneBench = { rays: 0, rayMs: 0, sorts: 0, renders: 0 };
      const originalRaycast = window.THREE.Raycaster.prototype.intersectObjects;
      window.THREE.Raycaster.prototype.intersectObjects = function(...args) {
        const start = performance.now();
        const result = originalRaycast.apply(this, args);
        window.__sceneBench.rays++; window.__sceneBench.rayMs += performance.now() - start;
        return result;
      };
      for (const inst of window.placedInstances) {
        const worker = inst.splatViewer?.viewer?.sortWorker;
        if (!worker) continue;
        const post = worker.postMessage.bind(worker);
        worker.postMessage = (...args) => { if (args[0].sort) window.__sceneBench.sorts++; return post(...args); };
      }
      const render = window.renderer.render.bind(window.renderer);
      window.renderer.render = (...args) => { window.__sceneBench.renders++; return render(...args); };
    });
    const results = {};
    for (const mode of ['idle', 'walk', 'orbit']) {
      const before = (await cdp.send('Performance.getMetrics')).metrics;
      await cdp.send('Profiler.start');
      const sample = await page.evaluate(mode => new Promise(resolve => {
        const initial = { ...window.__sceneBench };
        const frames = [], longTasks = [];
        const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.duration)));
        observer.observe({ type: 'longtask' });
        if (mode === 'walk') window.setVirtualKey('w', true);
        if (mode === 'orbit') window.toggleCameraFollow();
        let start = performance.now(), last = start;
        const tick = now => {
          frames.push(now - last); last = now;
          if (mode === 'orbit') {
            const angle = (now - start) * 0.0002;
            window.camera.position.set(window.controls.target.x + Math.sin(angle) * 6, 3.5, window.controls.target.z + Math.cos(angle) * 6);
            window.controls.update();
          }
          if (now - start < 3500) { requestAnimationFrame(tick); return; }
          observer.disconnect(); window.setVirtualKey('w', false);
          frames.sort((a, b) => a - b);
          const elapsed = now - start;
          resolve({ displayFps: Math.round(frames.length * 1000 / elapsed), renderFps: Math.round((window.__sceneBench.renders - initial.renders) * 1000 / elapsed),
            medianFrameMs: frames[Math.floor(frames.length / 2)], p95FrameMs: frames[Math.floor(frames.length * .95)],
            longTasks: longTasks.length, worstTaskMs: Math.max(0, ...longTasks),
            rays: window.__sceneBench.rays - initial.rays, rayMs: Math.round(window.__sceneBench.rayMs - initial.rayMs),
            sorts: window.__sceneBench.sorts - initial.sorts, pixelRatio: window.renderer.getPixelRatio() });
        };
        requestAnimationFrame(tick);
      }), mode);
      const { profile } = await cdp.send('Profiler.stop');
      const after = (await cdp.send('Performance.getMetrics')).metrics;
      const diff = name => Math.round(((after.find(m => m.name === name)?.value || 0) - (before.find(m => m.name === name)?.value || 0)) * 1000) / 1000;
      const nodes = new Map(profile.nodes.map(node => [node.id, node]));
      const self = new Map();
      profile.samples?.forEach((id, i) => {
        const node = nodes.get(id), name = node.callFrame.functionName || '(anonymous)';
        const key = `${name} (${node.callFrame.url.split('/').at(-1) || 'native'})`;
        self.set(key, (self.get(key) || 0) + (profile.timeDeltas[i] || 0));
      });
      results[mode] = { ...sample, layouts: diff('LayoutCount'), layoutSeconds: diff('LayoutDuration'), scriptSeconds: diff('ScriptDuration'),
        topSelfMs: [...self].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, microseconds]) => [name, Math.round(microseconds / 1000)]) };
    }
    const result = { viewport: '1680x945 @1.5x', cpuSlowdown: Number(process.env.CPU_SLOWDOWN || 1), results, errors };
    console.log(JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(__dirname, '../scratch', process.env.BENCH_OUTPUT || 'scene-benchmark.json'), JSON.stringify(result, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
