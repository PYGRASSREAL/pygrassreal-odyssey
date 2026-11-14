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
