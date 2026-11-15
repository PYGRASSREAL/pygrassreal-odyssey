# 🚀 PyGrassReal Odyssey: Space Mission Design Game

[![NASA Space Apps 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026%20Global%20Challenge-0B3D91?style=for-the-badge&logo=nasa&logoColor=white)](https://www.spaceappschallenge.org/)
[![IANA Media Type](https://img.shields.io/badge/IANA%20MIME-model%2Fvnd.pygrassreal.py3s-0284c7?style=for-the-badge)](https://www.iana.org/assignments/media-types/media-types.xhtml)
[![NVIDIA Inception](https://img.shields.io/badge/NVIDIA%20Inception-Program%20Member-76B900?style=for-the-badge&logo=nvidia&logoColor=white)](https://www.nvidia.com/en-us/startups/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=for-the-badge)](LICENSE)

> **Official Entry for NASA International Space Apps Challenge 2026**  
> **Challenge:** *Space Mission Design Game*  
> **Team:** PyGrassReal (Solo — Bangkok, Thailand)  
> **Live Web Application:** [https://pygrassreal.github.io/pygrassreal-odyssey/](https://pygrassreal.github.io/pygrassreal-odyssey/)

---

## 🌌 Overview

Designing a real space mission requires balancing competing engineering demands: payload mass, power constraints, mission budgets, scientific data bandwidth, communication links, and orbital mechanics. For students and enthusiasts, these complex trade-offs often remain abstract.

**PyGrassReal Odyssey** bridges this gap by delivering an interactive, browser-based **Space Mission Simulator & Educational Game**. Players design, manage, and simulate a complete mission from launch to Martian orbit while navigating unpredictable solar events and space debris hazards.

Powered by the **`.py3s` single-container open standard** (officially registered with IANA as `model/vnd.pygrassreal.py3s`), the platform seamlessly unifies dense 3D Gaussian Splatting photorealism with 1:1 solid physics collision geometry and additive manufacturing layers directly in the browser.

---

## ✨ Key Features

1. **Interactive Scrollytelling Timeline (Stages 1 ➡️ 5):**
   - High-fidelity visual storytelling guiding players through mission briefing, launcher selection, orbital transit, and planetary approach.
   - Real-time scrubbing with responsive telemetry HUD.

2. **6 Core Engineering Trade-offs:**
   - **Mass vs. Launch Vehicle:** Balancing payload limits against rocket lift capability.
   - **Power vs. Science Payload:** Managing solar array generation and power draw during eclipse or orientation shifts.
   - **Budget Constraints:** Allocating funds between shielding, communications, and scientific instruments.
   - **Data & Communications:** High-gain antenna alignment and downlink windows to Earth.
   - **Time & Trajectory:** Orbital transit windows and delta-v conservation.

3. **Real-time 3D Simulation with `.py3s`:**
   - **Dual-Layer Architecture:** Simultaneously renders dense radiance fields (`spzData`) and solid collision hulls (`colliderData`).
   - **Debris & Micrometeoroid Impact Test:** Interactive physical collision detection showing real-time subsystem damage when structural shielding is compromised.
   - **Ultra-lightweight:** 90% footprint reduction compared to raw 50–200 MB PLY files (~3–5 MB per asset), loading instantly via client-side WebAssembly and WebGL.

4. **Print 3D Ready (In-Space Manufacturing):**
   - Direct export of spacecraft geometry for 3D printing, mirroring NASA's on-orbit additive manufacturing vision.

---

## 🛰️ NASA Open Data & Resources Utilized

This project leverages authentic open data and scientific reference materials provided by NASA:
- **NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information):** Solar flare and Coronal Mass Ejection (CME) parameters informing in-game space weather hazard events.
- **NASA OSDR (Open Science Data Repository):** Deep space radiation dosage thresholds and biological payload constraints.
- **NASA's Eyes & SPICE Reference Parameters:** Orbital trajectory constraints, delta-v metrics, and planetary distances for realistic orbital navigation.

---

## 🤖 AI & Super Intelligence (SI) Disclosure

In compliance with the **2026 NASA Space Apps Challenge Project Submission Guide**:
- **Generative Media:** Visual concept art was accelerated using ChatGPT (GPT-4o image generation) and transformed into cinematic sequence animations via Omni video processing.
- **Watermarks & Attribution:** All AI-assisted visuals are explicitly watermarked and disclosed in metadata.
- **No NASA Branding:** AI-generated media strictly avoids NASA logos, insignias, or mission identifiers (`14 CFR 1221`).
- **Original Code & Implementation:** The game logic, Three.js 3D rendering pipeline, `.py3s` container codec, and physics hit-testing were designed and implemented specifically for this challenge.

---

## Character controls

The story timeline scrolls through Stages 1–5. Entering Final 3D locks document
scrolling: wheel input zooms the camera and each sidebar can scroll independently.
Use a Stage button to return to the story. Drag/focus autoscroll and incidental
scroll events preserve the 3D camera and active placement preview.
Run `node scripts/test_scene_scroll.cjs` to verify these transitions and image
loading fallbacks against a local server on port 4183 (or set `ODYSSEY_URL`).

Dragging a file from the Asset panel shows a translucent 3DGS placement preview
on the terrain instead of a floating copy of the file card. The preview follows
the cursor, stays outside the outliner/collision/history, and becomes the same
full-opacity model on drop without loading it twice. Leaving the canvas hides it;
Escape, a cancelled drag or leaving 3D disposes it. Files dragged from the desktop
continue through the normal import-on-drop flow.

Run `node scripts/test_asset_placement.cjs` against a local server on port 4183
(or set `ODYSSEY_URL`) to check native dragging, Gaussian shader opacity, terrain
placement, cancellation/loading races and undo/redo.

Use **WASD** to walk at 3.2 m/s. Hold either **Shift** with WASD to sprint at
6.4 m/s with the Running animation; releasing Shift returns to walking. Diagonal
movement keeps the same speed. The on-screen **SHIFT : RUN** button can be held
with the directional controls. Input focus, menu entry and leaving 3D release
movement controls to prevent stuck keys.

**Space** uses the updated Jumping clip from `Astronaut_Animated_V1-5.glb`
(bundled as `assets/models/Astronaut_Animated.glb`). Playback uses the original
authored keyframes with the standard animation fades. It plays once during the
Mars-gravity hop and returns to idle, walking or running on landing.
Press Space again for another hop; holding it does not restart the jump.
Walking retains 3.2 m/s and sprinting retains 6.4 m/s while airborne.

Run `node scripts/test_jump_playback.cjs` against a local server on port 4183
(or set `ODYSSEY_URL`) to verify original jump keyframes, sprint travel speed and
rendered skin visibility.

Confirming a Gaussian physics mode plays the rig's **Magic_Attack** gesture once,
facing the selected object. The character returns to normal movement when the
gesture finishes; walking, sprinting or jumping interrupts it. Selecting another
physics mode restarts the gesture. Mode highlighting, parameter edits, Solid and
Ghost do not trigger it. The physics preview continues after the gesture ends.

## Selected-object physics (E)

The **? Help** button at the top-right of the 3D scene, just left of the outliner,
opens a Thai guide to all ten physics modes, Collider/Outline/Heatmap terminology
and the E/W/S/Enter/Q controls. Close with Q, Escape, the close button or the
backdrop. The guide keeps keyboard focus inside and releases movement controls.

In the 3D simulation, approach an object (within 2.4 m of its visible bounds). An
**E** hint appears above the nearest eligible object. Press **E** to select that
object, outline its actual silhouette, and open a compact context menu beside it.
Approaching, spawning, and ordinary scene selection do not show an outline. The
outline is active only after pressing E (or tapping its floating hint), and clears
when leaving the interaction.
The physical E key also works with a Thai keyboard. Right-click an object's visible
pixels to open the same menu at the pointer, or use the selected object's **3DGS**
button under Transform. Each placed object has its own mode:

- **Solid** enables the asset's collider; **Ghost** lets the astronaut pass through.
- Eight Gaussian deformation previews from Matchanu: Stress, Thermal, Fracture,
  Wilting, Wind, Deformation, Magnetic, and Enlivening.
- Adjust strength, pause/resume, restart, and toggle the Stress/Thermal heatmap.
  **Restore / Solid** restores original Gaussian positions, covariance and colors.
- Choosing a mode closes the menu and places its controls beside the object.
  Controls track camera/object movement, leaving the 3D view interactive.
- **W / S** moves up/down through enabled modes; **Enter** selects the focused mode.
  The menu also has clickable W-up/S-down buttons. **Q** exits the interaction,
  dismissing the menu/parameters and outline while retaining the applied physics.
  **Esc** also exits. E activates the outline and keeps an open menu available.
  Mode changes support **Ctrl+Z / Ctrl+Y**.

Deformation modes are visual previews and suspend that object's collision because
its original collider does not deform. Locked, hidden and deleted models cannot
be edited. Collider visualization remains independent of collision behavior.

Physics setup and per-Gaussian updates run in a module Worker. Transferable frame
buffers are recycled, with one job in flight and only the latest pending input.
Update frequency adapts to compute time; pausing, hiding, leaving 3D, or deleting
an object suspends its work. The 2D timeline leaves the 3D renderer idle. The scene
loop is capped at 60 Hz. Drawing resolution adapts to sustained frame time, between
pixel ratios 0.7 and 1.25 (never exceeding the display ratio). 512-pixel shadows
refresh at 20 Hz. HUD text remains at native CSS resolution.
Static camera/object poses reuse their splat depth order; motion sorts at up to
30 Hz and explicit physics updates force a refresh. Character collision first
rejects distant mesh bounds before precise BVH ray tests. Floating HUD dimensions
use ResizeObserver, and labels only update when changed. Large scene panels use
opaque backgrounds instead of repeatedly blurring the animated canvas.
The selection outline uses a cached half-resolution mask of the actual Gaussian
ellipses and visual meshes, updated at most 30 Hz. Proximity uses cached sampled
bounds rather than scanning every Gaussian each frame. On narrow screens, the
large scene panels temporarily hide while editing object physics.

Animated characters normalize their height and boot origin from the initial
animation pose, then use a small sole sample to maintain terrain contact while
grounded. Model spawn, ground snap and transform reset use visible support points
and the actual terrain height. When terrain loads asynchronously, untouched
placements reattach to it while manual edits are preserved. The grid conforms to
the same terrain surface. The terrain receives object shadows but does not cast
into the local shadow map, preventing a dark rectangular self-shadow footprint.

The standalone physics module is generated from Matchanu's implementation. After
changing that source, regenerate from the parent workspace with
`node pygrassreal-odyssey/scripts/sync_splat_physics.mjs`.
With the static server running on port 4183, run
`node pygrassreal-odyssey/scripts/test_instance_physics.cjs` for browser validation
(or set `ODYSSEY_URL` to another local URL).
Run `node pygrassreal-odyssey/scripts/benchmark_physics.cjs` separately from other
browser tests to compare frame times and main-thread long tasks on the temple asset.
Use `node pygrassreal-odyssey/scripts/test_scene_performance.cjs` to validate collision
filtering, moving geometry, frame pacing, adaptive quality and sorting invalidation.
`node pygrassreal-odyssey/scripts/benchmark_scene.cjs` profiles the normal lander
scene while standing, walking and orbiting, including layout counts and collision
queries. Run browser benchmarks separately for comparable results.
Run `node pygrassreal-odyssey/scripts/test_grounding.cjs` for real animated boot
contact, jump/landing, asynchronous terrain alignment, grid heights and ground-snap
undo/redo checks, with screenshots from low and overhead cameras.
`node pygrassreal-odyssey/scripts/test_character_actions.cjs` verifies actual sprint
distance, animation transitions, both Shift keys, virtual controls, input/focus
guards, spell confirmation, facing, completion, recasting and interruption.

## 🛠️ Technology Stack

- **3D Graphics & Physics:** Three.js, Three-Mesh-BVH, WebGL, WebGPU
- **Spatial Format:** `.py3s` (PyGrassReal 3D Spatial Container)
- **Frontend:** Vanilla JavaScript (ES Modules), HTML5 Canvas, Modern CSS
- **Deployment:** GitHub Pages via GitHub Actions CI/CD

---

## 🚀 Quickstart & Local Development

Clone the repository and serve locally using any standard static file server:

```bash
# Clone the repository
git clone https://github.com/PYGRASSREAL/pygrassreal-odyssey.git
cd pygrassreal-odyssey

# Start a local web server (e.g. Python)
python -m http.server 8000

# Open in browser
# http://localhost:8000
```

---

## 📄 License & Intellectual Property

- **Source Code & Documentation:** Licensed under the [MIT License](LICENSE).
- **Format Specification:** The `.py3s` format is an open standard created by **PyGrassReal AI** (NVIDIA Inception Program Member), registered under IANA MIME `model/vnd.pygrassreal.py3s` and Department of Intellectual Property (DIP) Record No. ว1.001520.

Developed with ❤️ by **[PyGrassReal AI](https://pygrassreal.ai)** for the **NASA Space Apps Challenge 2026**.
