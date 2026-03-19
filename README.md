# Boom Buddy

A single-player 2.5D platformer built with WebGPU, featuring GPU compute shader particle effects, destructible terrain, and water physics. No server, no networking — just a browser game that looks like it shouldn't be running in a tab.

## What's in here

- **Stick figure arena** with joint-based procedural animation (idle, run, jump, fall, spirit charge)
- **Mega Man charge shot** — hold space to charge, 3 power levels, fires horizontally
- **DBZ spirit bomb** — hold up+space, grows above your head, launches at 45°
- **GPU particle system** — compute shader with attractor forces, tangential swirl, exponential damping
- **Destructible terrain** — Noita-style pixel grid with crater scaling based on projectile power
- **Cellular automata** — rubble settles under gravity and slides diagonally; water flows, pools, and spreads through cave systems
- **Water physics** — procedurally placed water pockets in deep caves; player swims through water with buoyancy-style slowdown (up to 60% speed reduction)
- **Day/night cycle** — 30-second ambient lighting cycle
- **Infinite descent** — terrain streams in as you fall, no bottom boundary

## Controls

| Input | Action |
|---|---|
| A / D or Arrow keys | Move left / right |
| W or Up arrow | Jump (hold for full height) |
| Space (hold) | Charge Mega Man shot (fires on release) |
| Up + Space (hold) | Charge spirit bomb (fires on release) |

## Tech Stack

- **Rendering:** WebGPU (raw API, no framework)
- **Shading:** WGSL
- **Build:** Vite + TypeScript
- **Physics:** Fixed-timestep (60 Hz) with variable-rate rendering
- **Terrain:** 480×540 cell grid (2×2 px per cell), procedural generation with Perlin-like noise, cellular automata (3 steps/frame)

## Getting Started

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Requires a browser with WebGPU support (Chrome/Edge stable, Firefox 141+, Safari 26+).
