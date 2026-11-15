const meanings = {
  static: 'Solid refers to an impenetrable, solid object. Used for stationary models with active 1:1 Physics Colliders so characters can collide, jump, and stand on surfaces.',
  ghost: 'Ghost refers to passthrough objects. The 3DGS visual splat renders normally, but the character walks through the model without collision.',
  'stress-analysis': 'Stress analysis models mechanical compression under load, featuring a dynamic pseudocolor gradient indicating relative localized stress.',
  'megas-thermal': 'Thermal expansion simulates thermodynamic volume expansion and contraction, coupled with a relative thermal distribution heatmap.',
  'voronoi-fracture': 'Voronoi Fracture splits 3D Gaussian splat clusters into geometric Voronoi fragments and drives radial dispersal.',
  'plant-wilting': 'Wilting simulates drooping and gravitational bending of upper foliage or structures, proportional to the strength slider.',
  'diffwind-aerodynamics': 'Aerodynamic wind simulation drives dynamic turbulence oscillations across upper Gaussian elements.',
  'physskin-deformation': 'Elastic deformation simulates soft-body skin twisting, stretching, and recoil while preserving base geometry.',
  'magnetic-mpm': 'Magnetic MPM attracts Gaussian particles toward orbiting magnetic flux points, generating dynamic field warping.',
  'enlivening-gs': 'Enlivening GS applies rhythmic organic pulsation, bouncing, and harmonic oscillations resembling breathing or living motion.',
};

export function initPhysicsHelp({ modes, onOpen, onClose }) {
  const button = document.createElement('button');
  button.id = 'btn-physics-help'; button.className = 'physics-help-button'; button.type = 'button'; button.hidden = true;
  button.setAttribute('aria-label', 'Help — Physics Mode Guide');
  button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', 'physics-help-dialog');
  button.innerHTML = '<span aria-hidden="true">?</span><span>Help</span>';
  const dialog = document.createElement('dialog');
  dialog.id = 'physics-help-dialog'; dialog.className = 'physics-help-dialog'; dialog.lang = 'en';
  dialog.setAttribute('aria-labelledby', 'physics-help-title');
  dialog.setAttribute('aria-describedby', 'physics-help-intro');
  dialog.innerHTML = `
    <header class="physics-help-header"><div><span class="physics-help-eyebrow">3DGS · HELP</span>
      <h2 id="physics-help-title">Physics Mode Guide</h2></div>
      <button type="button" id="physics-help-close" aria-label="Close guide">✕</button></header>
    <div class="physics-help-content" tabindex="0" aria-label="Guide Content">
      <p id="physics-help-intro">Overview of physics modes, deformation dynamics, and usage guidelines.</p>
      <section class="physics-help-controls" aria-labelledby="physics-help-controls-title">
        <h3 id="physics-help-controls-title">Mode Selection</h3>
        <p>Approach an object and press <kbd>E</kbd> to inspect and open the physics menu. A cyan outline highlights the selected instance.</p>
        <p><kbd>W</kbd> Up · <kbd>S</kbd> Down · <kbd>Enter</kbd> Select (or click mode name) · <kbd>Q</kbd> Exit</p>
      </section>
      <div class="physics-help-modes">${modes.map(([id, icon, name]) => `
        <article class="physics-help-mode" data-help-mode="${id}">
          <h3><span aria-hidden="true">${icon}</span>${name}</h3><p>${meanings[id]}</p>
        </article>`).join('')}</div>
      <section class="physics-help-glossary" aria-labelledby="physics-help-terms-title">
        <h3 id="physics-help-terms-title">Terminology Glossary</h3>
        <dl>
          <div><dt>3DGS / Gaussian</dt><dd>3D Gaussian Splatting reconstructs volumetric 3D scenes using millions of oriented ellipsoidal splats. Simulation modes dynamically transform these splat coordinates in real time.</dd></div>
          <div><dt>Collider</dt><dd>Discrete collision geometry decoupled from visual splats. The “3DGS + Collider” toggle reveals wireframe collision boundaries for debugging.</dd></div>
          <div><dt>Outline</dt><dd>Cyan boundary highlight indicating the currently selected target object after pressing E.</dd></div>
          <div><dt>Strength</dt><dd>Simulation intensity scale from 0% to 100%. Higher values amplify displacement, frequency, and deformation amplitude.</dd></div>
          <div><dt>Heatmap</dt><dd>Pseudocolor gradient visualizing relative stress or thermal distributions. Enabled in Stress and Thermal modes.</dd></div>
          <div><dt>Pause · Reset · Restore</dt><dd>“Pause” freezes the simulation state; click again to resume. “Reset” restarts the active effect from frame 0. “Restore” re-anchors original splat positions and resets to Solid mode.</dd></div>
        </dl>
      </section>
      <p class="physics-help-note">Active deformation modes act as dynamic visual previews. During preview, characters pass through the deforming model. Switch back to Solid to restore physical collisions.</p>
    </div>
    <footer class="physics-help-footer">Close guide with <kbd>Q</kbd> or <kbd>Esc</kbd></footer>`;
  document.body.append(button, dialog);
  const panel = document.getElementById('v3d-layer-panel');
  const navigation = document.querySelector('.top-nav');
  let active = false, previousOverflow = '';
  function position() {
    if (!active) return;
    const top = (navigation?.getBoundingClientRect().bottom ?? 54) + 12;
    const narrow = innerWidth <= 700;
    const left = narrow ? innerWidth - button.offsetWidth - 16 : (panel?.offsetLeft ?? innerWidth - 20) - button.offsetWidth - 12;
    button.style.left = `${Math.max(12, left)}px`;
    button.style.top = `${Math.max(top, narrow ? top : (panel?.offsetTop ?? top) + 10)}px`;
    document.documentElement.style.setProperty('--physics-help-row-top', `${top}px`);
  }
  function close() { if (dialog.open) dialog.close(); }
  button.addEventListener('click', () => {
    onOpen?.(); previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
    dialog.querySelector('.physics-help-content').scrollTop = 0;
    dialog.querySelector('#physics-help-close').focus({ preventScroll: true });
  });
  dialog.querySelector('#physics-help-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.style.overflow = previousOverflow;
    onClose?.();
    if (active) button.focus({ preventScroll: true });
  });
  // Register before scene shortcuts so reading the guide cannot move the actor
  // or open the object menu behind the native modal dialog.
  window.addEventListener('keydown', event => {
    if (!dialog.open) return;
    event.stopImmediatePropagation();
    if (event.key === 'Tab') {
      const items = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(item => !item.disabled && item.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (event.key === 'Escape' || event.code === 'KeyQ') {
      event.preventDefault(); if (!event.repeat) close();
    }
  }, true);
  window.addEventListener('keyup', event => { if (dialog.open) event.stopImmediatePropagation(); }, true);
  window.addEventListener('resize', position);
  const observer = new ResizeObserver(position);
  if (panel) observer.observe(panel);
  if (navigation) observer.observe(navigation);
  return {
    setActive(value) {
      active = value; button.hidden = !value;
      if (!value) close();
      else position();
    },
  };
}
