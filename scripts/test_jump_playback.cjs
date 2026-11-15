const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.ODYSSEY_URL || 'http://127.0.0.1:4183/');
    await page.waitForFunction(() => window.scene?.getObjectByName('AstronautCharacter')?.userData.animation);
    const result = await page.evaluate(async () => {
      const api = await import('/js/astronaut.js');
      const actor = window.scene.getObjectByName('AstronautCharacter');
      const original = window.THREE.AnimationMixer.prototype.update;
      let jumpClip = null;
      window.THREE.AnimationMixer.prototype.update = function(dt) {
        const value = original.call(this, dt);
        if (this.getRoot() === actor.children[0]) {
          jumpClip = this._actions.find(action => action.getClip().name === 'Jumping')?.getClip();
        }
        return value;
      };
      const ground = () => 0;
      const tick = dt => api.updateAstronautPhysics(dt, ground, window.camera, null, false);
      const arcs = [];
      const flights = [];
      try {
        for (const sprint of [false, true]) {
          api.resetAstronautToLander(ground); api.astroPos.set(30, 0, 30);
          window.camera.position.set(30, 3, 40); window.camera.lookAt(30, 1, 30);
          for (let i = 0; i < 30; i++) tick(1 / 60);
          api.setVirtualKey('w', true); api.setVirtualKey('shift', sprint);
          tick(1 / 60);
          const arc = [];
          const flight = [];
          const start = api.astroPos.clone();
          for (let i = 0; i < 160; i++) {
            api.setVirtualKey('space', i === 0 || i === 80);
            // Switch directions and sprint during the takeoff/landing blends.
            api.setVirtualKey('w', i % 9 < 5);
            api.setVirtualKey('d', i % 9 >= 5);
            api.setVirtualKey('shift', i > 65 ? i % 4 === 0 : sprint);
            tick(1 / 60);
            arc.push(api.astroPos.y);
            if (i < 65) flight.push(api.astroPos.clone().sub(start).toArray());
          }
          arcs.push(arc);
          flights.push(flight);
          api.releaseAstronautControls();
        }
      } finally { window.THREE.AnimationMixer.prototype.update = original; }
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync('/assets/models/Astronaut_Animated.glb?v=434ea95f9ad4');
      const source = gltf.animations.find(clip => clip.name === 'Jumping');
      const authoredJumpPreserved = !!jumpClip && jumpClip.duration === source.duration &&
        jumpClip.tracks.length === source.tracks.length && jumpClip.tracks.every((track, index) => {
          const originalTrack = source.tracks[index];
          return track.name === originalTrack.name && track.getInterpolation() === originalTrack.getInterpolation() &&
            track.times.length === originalTrack.times.length && track.values.length === originalTrack.values.length &&
            track.times.every((value, i) => value === originalTrack.times[i]) &&
            track.values.every((value, i) => value === originalTrack.values[i]);
        });
      // Render the real skin through a whole jump, including near camera edges.
      const parent = actor.parent, scene = new window.THREE.Scene();
      scene.background = new window.THREE.Color(0);
      scene.add(actor, new window.THREE.AmbientLight(0xffffff, 2));
      const target = new window.THREE.WebGLRenderTarget(96, 96);
      const camera = new window.THREE.PerspectiveCamera(50, 1, .1, 20);
      const previousTarget = window.renderer.getRenderTarget();
      const pixels = new Uint8Array(96 * 96 * 4), visiblePixels = [];
      try {
        api.resetAstronautToLander(ground); api.astroPos.set(30, 0, 30);
        for (let i = 0; i < 30; i++) tick(1 / 60);
        for (let i = 0; i < 100; i++) {
          api.setVirtualKey('space', i === 0); tick(1 / 60);
          if (i % 4) continue;
          camera.position.copy(api.astroPos).add(new window.THREE.Vector3(0, 1, 3));
          camera.lookAt(api.astroPos.clone().add(new window.THREE.Vector3(i % 8 ? .8 : -.8, .9, 0)));
          window.renderer.setRenderTarget(target); window.renderer.render(scene, camera);
          window.renderer.readRenderTargetPixels(target, 0, 0, 96, 96, pixels);
          let count = 0;
          for (let k = 0; k < pixels.length; k += 4) if (Math.max(pixels[k], pixels[k + 1], pixels[k + 2]) > 25) count++;
          visiblePixels.push(count);
        }
      } finally {
        window.renderer.setRenderTarget(previousTarget); parent.add(actor); target.dispose();
        api.releaseAstronautControls();
      }
      return { authoredJumpPreserved, arcs, flights, visiblePixels };
    });
    assert.equal(result.authoredJumpPreserved, true, 'All original jump keyframes and interpolation must be preserved');
    assert.deepEqual(result.arcs[0], result.arcs[1], 'Walking and sprinting have exactly the same jump height and duration');
    for (let i = 0; i < result.flights[0].length; i++) {
      for (const axis of [0, 2]) assert.ok(Math.abs(result.flights[0][i][axis] * 2 - result.flights[1][i][axis]) < 1e-9,
        'Running retains twice the walking travel speed while airborne');
    }
    assert.ok(result.visiblePixels.every(count => count > 100), 'The animated skin stays rendered during every sampled jump frame near camera edges');
    console.log(`PASS real skin remains visible in ${result.visiblePixels.length} rendered jump frames`);
    console.log('PASS original authored Jumping clip preserved; running jumps retain twice the walking travel speed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
