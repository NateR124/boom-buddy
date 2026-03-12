# Boom Buddy

A single-player 2.5D platformer built with WebGPU, featuring GPU compute shader particle effects and destructible terrain. No server, no networking — just a browser game that looks like it shouldn't be running in a tab.

## What's in here

- **Stick figure arena** with joint-based procedural animation (idle, run, jump, fall, spirit charge)
- **Mega Man charge shot** — hold space to charge, 3 power levels, fires horizontally
- **DBZ spirit bomb** — hold up+space, grows above your head, launches at 45°
- **GPU particle system** — compute shader with attractor forces, tangential swirl, exponential damping
- **Destructible terrain** — Noita-style pixel grid, cellular automata rubble settling, crater scaling

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
- **Physics:** Fixed-timestep (60hz) with variable-rate rendering

## Getting Started

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Requires a browser with WebGPU support (Chrome/Edge stable, Firefox 141+, Safari 26+).
