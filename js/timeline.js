// =========================================================================
// GRAND 5-STAGE CONTINUOUS SCROLL TIMELINE (1->6, 2->7, 3->8, 4->9, 5->10 -> 3D)
// =========================================================================

export const TIMELINE_STAGES = [
  {
    id: 1,
    title: "STAGE 1: LAUNCH PLATFORM (1 ➡️ 6)",
    scrollClip: 1,
    loopClip: 6,
    loopFile: "assets/loops/loop_clip_06.webp",
    desc: "Clip 01 (Scroll) ➡️ Clip 06 (Gantry Pulse Loop)",
    start: 0.00,
    loopStart: 0.13,
    end: 0.17
  },
  {
    id: 2,
    title: "STAGE 2: ASCEND INTO ORBIT (2 ➡️ 7)",
    scrollClip: 2,
    loopClip: 7,
    loopFile: "assets/loops/loop_clip_07.webp",
    desc: "Clip 02 (Scroll) ➡️ Clip 07 (Earth Orbit Loop)",
    start: 0.17,
    loopStart: 0.30,
    end: 0.34
  },
  {
    id: 3,
    title: "STAGE 3: DEFLECTOR SHIELD (3 ➡️ 8)",
    scrollClip: 3,
    loopClip: 8,
    loopFile: "assets/loops/loop_clip_08.webp",
    desc: "Clip 03 (Scroll) ➡️ Clip 08 (Shield Pulse Loop)",
    start: 0.34,
    loopStart: 0.47,
    end: 0.51
  },
  {
    id: 4,
    title: "STAGE 4: SOLAR PLASMA CRUISE (4 ➡️ 9)",
    scrollClip: 4,
    loopClip: 9,
    loopFile: "assets/loops/loop_clip_09.webp",
    desc: "Clip 04 (Scroll) ➡️ Clip 09 (Interplanetary Laser Loop)",
    start: 0.51,
    loopStart: 0.64,
    end: 0.68
  },
  {
    id: 5,
    title: "STAGE 5: MARS TOUCHDOWN (5 ➡️ 10)",
    scrollClip: 5,
    loopClip: 10,
    loopFile: "assets/loops/loop_clip_10.webp",
    desc: "Clip 05 (Scroll) ➡️ Clip 10 (Mars Canyon Retro Thrusters Loop)",
    start: 0.68,
    loopStart: 0.81,
    end: 0.85
  }
];

const totalFrames = 119;
const stageFramesCache = { 1: [], 2: [], 3: [], 4: [], 5: [] };

let scrollCanvas, scrollCtx, loopOverlay, threejsLayer, v3dTopbar, v3dLeftpanel, v3dWasdHud;
let progressBar, framePosText, statusBadge, hudTitle, hudSequenceText, hudMediaText, hudAstroPos, scrollHint;
let currentPhase = '2d'; // '2d' | '3d'
let onEnter3DCallback = null;
let onLeave3DCallback = null;

export function initTimeline({ onEnter3D, onLeave3D } = {}) {
  onEnter3DCallback = onEnter3D;
  onLeave3DCallback = onLeave3D;

  scrollCanvas = document.getElementById('scroll-canvas-layer');
  scrollCtx = scrollCanvas.getContext('2d');
  loopOverlay = document.getElementById('loop-overlay');
  threejsLayer = document.getElementById('threejs-layer');
  v3dTopbar = document.getElementById('v3d-topbar');
  v3dLeftpanel = document.getElementById('v3d-leftpanel');
  v3dWasdHud = document.getElementById('v3d-wasd-hud');

  progressBar = document.getElementById('hud-progress-bar');
  framePosText = document.getElementById('hud-frame-pos');
  statusBadge = document.getElementById('hud-status-badge');
  hudTitle = document.getElementById('hud-title');
  hudSequenceText = document.getElementById('hud-sequence-text');
  hudMediaText = document.getElementById('hud-media-text');
  hudAstroPos = document.getElementById('hud-astro-pos');
  scrollHint = document.getElementById('scroll-hint');

  window.addEventListener('scroll', onMasterScroll, { passive: true });

  preloadAllStages();
}

export function getCurrentPhase() {
  return currentPhase;
}

export function jumpToTimeline(targetProgress) {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo({ top: maxScroll * targetProgress, behavior: 'smooth' });
}

function preloadAllStages() {
  preloadStage(1, () => {
    renderSpecificFrame(1, 0);
    preloadStage(2, () => {
      preloadStage(3, () => {
        preloadStage(4, () => {
          preloadStage(5, () => {
            console.log("All 5 stages preloaded successfully!");
          });
        });
      });
    });
  });
}

function preloadStage(stageId, onComplete) {
  const arr = stageFramesCache[stageId];
  arr.length = 0;
  const padClip = String(stageId).padStart(2, '0');
  let loaded = 0;

  for (let i = 0; i < totalFrames; i++) {
    const padFrame = String(i).padStart(4, '0');
    const img = new Image();
    img.src = `assets/scroll_webp/clip_${padClip}/frame_${padFrame}.webp`;
    img.onload = () => {
      loaded++;
      if (loaded === totalFrames && onComplete) onComplete();
    };
    arr.push(img);
  }
}

function renderSpecificFrame(clipId, frameIndex) {
  const arr = stageFramesCache[clipId];
  if (arr && arr[frameIndex] && arr[frameIndex].complete) {
    scrollCtx.clearRect(0, 0, scrollCanvas.width, scrollCanvas.height);
    scrollCtx.drawImage(arr[frameIndex], 0, 0, scrollCanvas.width, scrollCanvas.height);
  }
}

function onMasterScroll() {
  const scrollY = window.scrollY;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = Math.min(Math.max(scrollY / (maxScroll || 1), 0), 1);

  if (progressBar) progressBar.style.width = (progress * 100).toFixed(1) + '%';
  if (scrollHint) {
    if (scrollY > 60) scrollHint.style.opacity = '0';
    else scrollHint.style.opacity = '1';
  }

  // -------------------------------------------------------------
  // FINAL PHASE: 3D MARS SIMULATION & WASD CHARACTER (0.85 - 1.00)
  // -------------------------------------------------------------
  if (progress >= 0.85) {
    currentPhase = '3d';
    if (scrollCanvas) scrollCanvas.style.opacity = '0';
    if (loopOverlay) loopOverlay.classList.remove('active');
    if (threejsLayer) threejsLayer.classList.add('active');
    if (v3dTopbar) v3dTopbar.classList.add('active');
    if (v3dLeftpanel) v3dLeftpanel.classList.add('active');
    if (v3dWasdHud) v3dWasdHud.classList.add('active');

    const subProgress = (progress - 0.85) / 0.15;
    if (hudTitle) hudTitle.innerText = "FINAL STAGE: 3D MARS SIMULATION & WALK";
    if (statusBadge) {
      statusBadge.innerText = "WASD WALKING ACTIVE";
      statusBadge.className = "status-pill status-3d";
    }
    if (hudSequenceText) hudSequenceText.innerText = "Interactive Mars Surface + Spacecraft Lander";
    if (hudMediaText) hudMediaText.innerText = "Astronaut Character (WASD Controls Active)";
    if (framePosText) framePosText.innerText = `Final 3D Viewport (${(subProgress * 100).toFixed(1)}%)`;

    document.querySelectorAll('.stage-selector .stage-btn').forEach(b => b.classList.remove('active'));
    const btn3d = document.getElementById('btn-stage-3d');
    if (btn3d) btn3d.classList.add('active');

    if (onEnter3DCallback) onEnter3DCallback();
    return;
  }

  // -------------------------------------------------------------
  // 2D PHASES: STAGES 1, 2, 3, 4, 5 (0.00 - 0.85)
  // -------------------------------------------------------------
  currentPhase = '2d';
  if (threejsLayer) threejsLayer.classList.remove('active');
  if (v3dTopbar) v3dTopbar.classList.remove('active');
  if (v3dLeftpanel) v3dLeftpanel.classList.remove('active');
  if (v3dWasdHud) v3dWasdHud.classList.remove('active');
  if (scrollCanvas) scrollCanvas.style.opacity = '1';

  let activeStage = TIMELINE_STAGES[0];
  for (const st of TIMELINE_STAGES) {
    if (progress >= st.start && progress < st.end) {
      activeStage = st;
      break;
    }
  }

  document.querySelectorAll('.stage-selector .stage-btn').forEach((b, idx) => {
    b.classList.toggle('active', idx + 1 === activeStage.id);
  });
  const btn3d = document.getElementById('btn-stage-3d');
  if (btn3d) btn3d.classList.remove('active');

  if (hudTitle) hudTitle.innerText = activeStage.title;
  if (hudSequenceText) hudSequenceText.innerText = activeStage.desc;

  const scrubRange = activeStage.loopStart - activeStage.start;
  const stageProgress = progress - activeStage.start;

  if (progress < activeStage.loopStart) {
    if (loopOverlay) loopOverlay.classList.remove('active');

    const subFraction = Math.min(Math.max(stageProgress / scrubRange, 0), 1);
    const frameIndex = Math.min(Math.floor(subFraction * totalFrames), totalFrames - 1);
    renderSpecificFrame(activeStage.scrollClip, frameIndex);

    if (statusBadge) {
      statusBadge.innerText = "SCROLL SCRUB";
      statusBadge.className = "status-pill status-scrubbing";
    }
    if (hudMediaText) hudMediaText.innerText = `Clip 0${activeStage.scrollClip} (Scrubbing Frame ${frameIndex} / ${totalFrames - 1})`;
    if (framePosText) framePosText.innerText = `Stage ${activeStage.id} of 5 (${(subFraction * 100).toFixed(1)}%)`;
  } else {
    if (loopOverlay) {
      if (loopOverlay.src.indexOf(activeStage.loopFile) === -1) {
        loopOverlay.src = activeStage.loopFile;
      }
      loopOverlay.classList.add('active');
    }

    if (statusBadge) {
      statusBadge.innerText = `ANIME LOOP: CLIP 0${activeStage.loopClip}`;
      statusBadge.className = "status-pill status-looping";
    }
    if (hudMediaText) hudMediaText.innerText = `Clip 0${activeStage.loopClip} (Infinite Breathing Loop Active)`;
    if (framePosText) framePosText.innerText = `Stage ${activeStage.id} Climax (Looping Seamlessly)`;
  }

  if (onLeave3DCallback) onLeave3DCallback();
}
