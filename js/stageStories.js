/* =========================================================================
   PyGrassReal Odyssey - Stage Mission Stories & HUD Telemetry Data
   Reactive Story Text, Comparison Metrics & Format Advantages (All-English)
   ========================================================================= */

    const STAGE_STORIES = {
      1: {
        stageBadge: "STAGE 1 OF 5",
        clips: "Clip 01 ➡️ 06",
        constraint: "⚖️ Mass vs Budget",
        title: "🚀 STAGE 1: LAUNCH PLATFORM & DEHYDRATED SEED",
        theme: "Mass & Budget Trade-Off (Payload Mass vs Mission Budget)",
        desc: "Prior to orbital launch, every gram of payload and every byte of telemetry carries exponential costs. The .py3s format initiates in Dehydrated Seed mode (0x4000), storing only foundational parametric coefficients and structural anchors. This compresses the asset down to an ultra-compact 53 KB – 3.2 MB, saving over 97% bandwidth.",
        compareTitle: "Why .py3s Wins at Launch Platform?",
        mineLabel: "🌟 .py3s (Dehydrated Seed):",
        mineVal: "53 KB – 3.2 MB (>97% Bandwidth Saved)",
        theirsLabel: "❌ Legacy Inria PLY:",
        theirsVal: "120 – 500+ MB (Exceeds Payload Limit)",
        chip1: { lbl: "Payload Size", val: "3.2 MB", cls: "cyan" },
        chip2: { lbl: "Bandwidth Saved", val: "97.6%", cls: "green" },
        chip3: { lbl: "PLY Penalty", val: "Heavy (>100MB)", cls: "red" }
      },
      2: {
        stageBadge: "STAGE 2 OF 5",
        clips: "Clip 02 ➡️ 07",
        constraint: "⚡ Power vs Science",
        title: "🛰️ STAGE 2: ORBIT INSERTION & 12ms HYDRATION",
        theme: "Power Budget & Solar Generation (Electrical Bus Limits)",
        desc: "Deploying solar arrays in low Earth orbit initiates scientific power generation. Similarly, .py3s activates via zero-server Runtime Client Hydration in just 12 milliseconds (0x8000) directly on the client's browser, eliminating expensive server-side GPU instances and maintaining zero frame drops.",
        compareTitle: "Why .py3s Wins in Orbit Insertion?",
        mineLabel: "🌟 .py3s Web Hydration:",
        mineVal: "12 ms in RAM (Zero Server GPU Cost)",
        theirsLabel: "❌ Standard PLY / CAD:",
        theirsVal: "2,000 – 5,000 ms (High Lag / FPS Drop)",
        chip1: { lbl: "Hydrate Time", val: "12 ms", cls: "green" },
        chip2: { lbl: "Server Cost", val: "$0 (Static)", cls: "cyan" },
        chip3: { lbl: "Lag Latency", val: "Zero Lag", cls: "green" }
      },
      3: {
        stageBadge: "STAGE 3 OF 5",
        clips: "Clip 03 ➡️ 08",
        constraint: "☄️ DONKI CME & Debris",
        title: "🛡️ STAGE 3: SOLAR PLASMA & 1:1 PHYSICS COLLIDER",
        theme: "NASA DONKI Space Weather Hazard (Solar Flare & Orbital Debris)",
        desc: "When coronal mass ejections (CME) and micro-meteoroids strike the shield perimeter, conventional 3D Gaussian Splats fail as non-tangible ghost clouds. In contrast, .py3s embeds a dual-layer 1:1 Mesh Collider, executing real-time debris collision tests in 0.07ms with anti-penetration physics.",
        compareTitle: "Why .py3s Wins in Shield Deflection?",
        mineLabel: "🌟 .py3s Dual-Layer:",
        mineVal: "1:1 Mesh Collider + Raycast 0.07ms",
        theirsLabel: "❌ Global 3DGS (Inria/SPZ):",
        theirsVal: "No Physics, Ghost Passthrough",
        chip1: { lbl: "Collider Query", val: "0.07 ms (BVH)", cls: "green" },
        chip2: { lbl: "Impact Test", val: "60 FPS Real-time", cls: "cyan" },
        chip3: { lbl: "Capsule Walk", val: "100% Solid", cls: "green" }
      },
      4: {
        stageBadge: "STAGE 4 OF 5",
        clips: "Clip 04 ➡️ 09",
        constraint: "📡 DSN 1 kbps Bandwidth",
        title: "📡 STAGE 4: INTERPLANETARY TELEMETRY & DSN",
        theme: "Deep Space Radio Bottleneck (Interplanetary Bandwidth Limits)",
        desc: "Transmitting telemetry across 400 million kilometers from Mars back to Earth operates over direct-to-Earth radio at a bottleneck of 0.5–3 kbps with a strict 100–250 MB daily quota. While legacy 120MB PLY files require 11 days of continuous transmission, .py3s (Seed) finishes in 40 seconds to 7 minutes, saving 99% spacecraft battery.",
        compareTitle: "Why .py3s Wins in Deep Space Telemetry?",
        mineLabel: "🌟 .py3s Deep Space Link:",
        mineVal: "40s – 7 Min (< 1.2% Daily Quota)",
        theirsLabel: "❌ Legacy PLY (120 MB):",
        theirsVal: "11 Days 2 Hours (Battery Depletion)",
        chip1: { lbl: "Transfer Time", val: "7 Min (Seed 40s)", cls: "green" },
        chip2: { lbl: "Battery Burn", val: "-99.2% Burn", cls: "cyan" },
        chip3: { lbl: "Daily Cap Used", val: "< 1.2% Total", cls: "green" }
      },
      5: {
        stageBadge: "STAGE 5 OF 5",
        clips: "Clip 05 ➡️ 10",
        constraint: "🏆 Victory: Rank S",
        title: "🔴 STAGE 5: MARS TOUCHDOWN & STEM 3D PRINTING",
        theme: "Mission Accomplished Rank S & Physical Fabrication",
        desc: "The spacecraft executes a powered descent landing onto the Martian surface. Beyond digital rendering, .py3s embeds a watertight solid 3MF model, enabling 1-click zero-second 3D printing in classrooms worldwide, validated with official IANA MIME registration (model/vnd.pygrassreal.py3s) and CRC-32 checksums.",
        compareTitle: "Why .py3s Wins in Touchdown & 3D Printing?",
        mineLabel: "🌟 .py3s 3-in-1 Container:",
        mineVal: "Watertight 3MF Solid + 0s Print Export",
        theirsLabel: "❌ Standard 3DGS:",
        theirsVal: "Unprintable Pure Point Cloud",
        chip1: { lbl: "3D Print Ready", val: "0.00s Export", cls: "green" },
        chip2: { lbl: "IANA Standard", val: "Approved", cls: "cyan" },
        chip3: { lbl: "Integrity", val: "CRC-32 Verified", cls: "green" }
      }
    };

    let currentStageId = null;
    function resetCurrentStageId() {
      currentStageId = null;
    }
    window.resetCurrentStageId = resetCurrentStageId;

    function updateStageStory(stageId, force = false) {
      if (!STAGE_STORIES[stageId]) return;
      if (stageId === currentStageId && !force) return;
      currentStageId = stageId;
      const data = STAGE_STORIES[stageId];

      const badge = document.getElementById('stg-badge');
      const clips = document.getElementById('stg-clips');
      const constraint = document.getElementById('stg-constraint');
      const title = document.getElementById('stg-title');
      const theme = document.getElementById('stg-theme');
      const desc = document.getElementById('stg-desc');

      // Update Stage Overlay top-left title (strip emoji per user preference)
      const cleanTitle = data.title.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').trim();
      const cinTitle = document.getElementById('cin-stage-title');
      const cinTheme = document.getElementById('cin-stage-theme');
      if (cinTitle) cinTitle.innerText = cleanTitle;
      if (cinTheme) cinTheme.innerText = data.theme;

      const cmpTitle = document.getElementById('cmp-title');
      const mineLabel = document.getElementById('cmp-mine-label');
      const mineVal = document.getElementById('cmp-mine-val');
      const theirsLabel = document.getElementById('cmp-theirs-label');
      const theirsVal = document.getElementById('cmp-theirs-val');

      const chip1Lbl = document.getElementById('chip-1-lbl');
      const chip1Val = document.getElementById('chip-1-val');
      const chip2Lbl = document.getElementById('chip-2-lbl');
      const chip2Val = document.getElementById('chip-2-val');
      const chip3Lbl = document.getElementById('chip-3-lbl');
      const chip3Val = document.getElementById('chip-3-val');


      if (badge) badge.innerText = data.stageBadge;
      if (clips) clips.innerText = data.clips;
      if (constraint) constraint.innerText = data.constraint;
      if (title) title.innerText = cleanTitle;
      if (theme) theme.innerText = data.theme;
      if (desc) desc.innerText = data.desc;

      if (cmpTitle) cmpTitle.innerText = data.compareTitle;
      if (mineLabel) mineLabel.innerText = data.mineLabel;
      if (mineVal) mineVal.innerText = data.mineVal;
      if (theirsLabel) theirsLabel.innerText = data.theirsLabel;
      if (theirsVal) theirsVal.innerText = data.theirsVal;

      if (chip1Lbl) chip1Lbl.innerText = data.chip1.lbl;
      if (chip1Val) { chip1Val.innerText = data.chip1.val; chip1Val.className = 'chip-val ' + data.chip1.cls; }
      if (chip2Lbl) chip2Lbl.innerText = data.chip2.lbl;
      if (chip2Val) { chip2Val.innerText = data.chip2.val; chip2Val.className = 'chip-val ' + data.chip2.cls; }
      if (chip3Lbl) chip3Lbl.innerText = data.chip3.lbl;
      if (chip3Val) { chip3Val.innerText = data.chip3.val; chip3Val.className = 'chip-val ' + data.chip3.cls; }
    }
    window.updateStageStory = updateStageStory;
