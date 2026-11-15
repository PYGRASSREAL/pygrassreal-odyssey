const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await page.waitForFunction(() => window.placedInstances?.length > 0);
    await page.evaluate(() => {
      window.jumpToTimeline(0.95); window.toggleCameraFollow(); window.controls.enableDamping = false;
    });
    const collision = await page.evaluate(async () => {
      const { getNearbyColliders, resolveCharacterCollision, getColliderSurfaceHeight } = await import('/js/collisionPhysics.js');
      const T = window.THREE;
      const group = new T.Group();
      const wall = new T.Mesh(new T.BoxGeometry(.2, 3, 4), new T.MeshBasicMaterial({ side: T.DoubleSide }));
      wall.position.y = 1.5; wall.geometry.computeBoundsTree(); group.add(wall);
      const far = new T.Mesh(new T.BoxGeometry(2, 3, 2), wall.material); far.position.set(100, 1.5, 100);
      const previous = new T.Vector3(-.8, 0, 0), next = new T.Vector3(.05, 0, 0);
      const nearby = getNearbyColliders([wall, far], next, previous);
      const resolved = resolveCharacterCollision(next, previous, .4, nearby);
      group.position.x = 20;
      const afterMove = getNearbyColliders([wall, far], next, previous);
      const floor = new T.Mesh(new T.BoxGeometry(6, .2, 6), wall.material);
      floor.position.y = -.1; floor.geometry.computeBoundsTree();
      const floorNear = getNearbyColliders([floor], new T.Vector3(0, .05, 0));
      const height = getColliderSurfaceHeight(0, 0, .05, .2, floorNear);
      return { onlyNear: nearby.length === 1 && nearby[0] === wall, blocked: resolved.x < -.3,
        movedAway: afterMove.length === 0, floor: height, noFar: getNearbyColliders([far], next, previous).length === 0 };
    });
    assert.equal(collision.onlyNear, true); assert.equal(collision.blocked, true);
    assert.equal(collision.movedAway, true); assert.equal(collision.noFar, true); assert.ok(Math.abs(collision.floor) < .001);
    const pacing = await page.evaluate(async () => {
      const { createSceneFrameBudget } = await import('/js/scenePerformance.js');
      let ratio = 1.25;
      const fake = { shadowMap: {}, getPixelRatio: () => ratio, setPixelRatio: value => { ratio = value; } };
      const budget = createSceneFrameBudget(fake);
      budget.reset(1000);
      let renders = 0;
      for (let i = 1; i <= 144; i++) if (budget.shouldRender(1000 + i * 1000 / 144)) renders++;
      for (let i = 0; i <= 90; i++) budget.record(2000 + i * 25, 20);
      return { renders, ratio };
    });
    assert.ok(pacing.renders >= 59 && pacing.renders <= 62, '144-Hz monitors get a bounded 60-Hz scene loop');
    assert.ok(pacing.ratio < 1.25 && pacing.ratio >= .7, 'Sustained slow rendering lowers resolution within its budget');
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      window.__sceneTest = { sorts: 0, renders: 0 };
      const viewer = window.placedInstances[0].splatViewer.viewer;
      const post = viewer.sortWorker.postMessage.bind(viewer.sortWorker);
      viewer.sortWorker.postMessage = (...args) => { if (args[0].sort) window.__sceneTest.sorts++; return post(...args); };
      const render = window.renderer.render.bind(window.renderer);
      window.renderer.render = (...args) => { window.__sceneTest.renders++; return render(...args); };
    });
    await page.waitForTimeout(500);
    const idle = await page.evaluate(() => ({ ...window.__sceneTest }));
    assert.ok(idle.sorts <= 2, `Idle objects should not continually sort (${idle.sorts})`);
    assert.ok(idle.renders > 10 && idle.renders <= 35, `Scene loop stays close to 60 fps (${idle.renders} in 500 ms)`);
    await page.evaluate(() => { window.placedInstances[0].group.position.x += 1; });
    await page.waitForTimeout(120);
    const transformed = await page.evaluate(() => window.__sceneTest.sorts);
    assert.ok(transformed > idle.sorts, 'Moving an object invalidates its depth order');
    await page.evaluate(() => { window.camera.position.x += 1; window.controls.update(); });
    await page.waitForTimeout(120);
    const cameraMoved = await page.evaluate(() => window.__sceneTest.sorts);
    assert.ok(cameraMoved > transformed, 'Moving the camera refreshes sorting');
    await page.evaluate(() => window.placedInstances[0].splatViewer.viewer.runSplatSort(true, true));
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => window.__sceneTest.sorts) > cameraMoved, 'Explicit physics sorts bypass the idle cache');
    await page.evaluate(() => window.jumpToTimeline(.1));
    await page.waitForTimeout(150);
    const stopped = await page.evaluate(() => window.__sceneTest.renders);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__sceneTest.renders), stopped, '2D media does not keep the 3D renderer busy');
    assert.deepEqual(errors, []);
    console.log('PASS collision broad phase, solid walls, floor support, moved colliders, 60-Hz pacing, adaptive quality, idle sort cache, motion/physics invalidation and 2D suspension');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
