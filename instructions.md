# WebGPU Platformer

A single-player 2.5D platformer built with WebGPU, featuring compute shader particle effects and destructible terrain. No server, no networking — just a browser game that looks like it shouldn't be running in a tab.

## Vision

A stick figure arena where you charge and fire energy attacks (Mega Man charge shot, DBZ spirit bomb) with particle effects driven by GPU compute shaders, and the terrain crumbles on impact Noita-style. The goal isn't deep gameplay yet — it's a tech demo that *feels* good and *looks* incredible.

## Tech Stack

- **Rendering:** WebGPU (raw API, no framework to start)
- **Shading Language:** WGSL
- **Game Loop:** `requestAnimationFrame` with fixed-timestep physics
- **Build Tool:** Vite (fast dev server, HMR, TypeScript out of the box)
- **Language:** TypeScript

No server. No backend. Opens in a browser and runs.

---

## Project Structure

```
├── src/
│   ├── main.ts                → entry point, canvas setup, game loop
│   ├── input.ts               → keyboard input capture and state
│   ├── renderer/
│   │   ├── gpu.ts             → WebGPU device/context initialization
│   │   ├── platformRenderer.ts → 2.5D platform quad rendering
│   │   ├── playerRenderer.ts  → stick figure rendering + animation
│   │   └── particleRenderer.ts → particle system render pipeline
│   ├── physics/
│   │   ├── world.ts           → stage definition, platform geometry
│   │   ├── player.ts          → player state, movement, collision
│   │   └── projectile.ts      → charge shot / spirit bomb physics
│   ├── particles/
│   │   ├── computeShader.wgsl → GPU compute shader for particle sim
│   │   ├── renderShader.wgsl  → particle render shader (points/quads)
│   │   └── emitter.ts         → emitter configs (charge, explosion, respawn)
│   ├── terrain/
│   │   ├── grid.ts            → pixel grid terrain state (GPU buffer)
│   │   ├── terrainCompute.wgsl → cellular automata terrain sim
│   │   └── destruction.ts     → impact → debris conversion logic
│   └── shaders/
│       ├── platform.wgsl      → vertex/fragment for 2.5D platforms
│       └── player.wgsl        → vertex/fragment for stick figure
│
├── public/
│   └── index.html             → canvas element, minimal shell
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## Game Design

### Stage

A Super Smash Bros-style arena:
- One long main platform spanning most of the screen (ground level)
- Three floating platforms arranged above it (left, center-right, high-center)
- Falling off any edge = respawn
- Stage is bounded by a kill zone below and on the sides

```
         ┌─────┐
         │     │
   ┌─────┘     └──────┐
   │                   │
   └──┐             ┌──┘
      │             │
 ═════╧═════════════╧═════   ← main platform
```

### Player Character

A 2.5D stick figure with joint-based animation:
- **States:** idle, running, jumping, falling, charging, firing
- **Movement:** left/right with acceleration/deceleration (not instant velocity)
- **Jump:** variable height (short press = short hop, long press = full jump)
- **Coyote time:** ~6 frames of grace after walking off an edge where jump still works
- **Jump buffering:** pressing jump within ~6 frames of landing auto-triggers the jump
- **Air control:** reduced horizontal acceleration while airborne

### Controls

| Input | Action |
|---|---|
| A / D or Arrow keys | Move left / right |
| W or Up arrow | Jump (hold for full height) |
| Space (hold) | Charge Mega Man shot (fires on release) |
| Up + Space (hold) | Charge spirit bomb (fires on release) |

### Attacks

**Mega Man Charge Shot**
- Hold space to charge
- Particles swarm around the player, intensifying as charge builds
- Three charge levels: small pellet → medium blast → full charged shot
- Releases in the direction the player is facing
- Travels fast in a straight horizontal line
- On terrain impact: small/medium/large crater depending on charge level

**Spirit Bomb**
- Hold up + space to charge
- Player hovers (if airborne) or stands still (if grounded) during charge
- A glowing sphere grows above the player's head, particles orbiting inward
- Grows slowly — can get very large if you're patient
- On release: launches at 45° downward in the facing direction
- Travel speed inversely proportional to size (bigger = slower)
- On terrain impact: massive crater, debris shower, screen shake

### Respawn

When a player crosses the kill zone boundary:
1. Burst of light particles at the point they fell off
2. Brief pause (~0.5s)
3. Player reappears at a random position above the stage with a short invulnerability flash

---

## Rendering Approach

### 2.5D Platforms

Platforms are rendered as extruded quads — a top face (green/grass) and a front face (brown/dirt) giving a pseudo-3D appearance. Slight shadow on the front face sells the depth. All geometry is simple enough to define as vertex buffers directly — no model loading needed.

### Stick Figure

Joint positions driven by animation state. Each limb is a line segment (or thin quad) rendered with a simple shader. Joints: head (circle), shoulders, elbows, hands, hips, knees, feet. Animation is procedural — no sprite sheets. Running = sinusoidal limb oscillation. Jumping = arms up, legs tucked. Charging = planted stance, arms forward.

### Particle Systems (Compute Shader)

All particles simulated on the GPU via compute shaders. CPU never touches individual particles.

**Pipeline per frame:**
1. Compute pass: update particle positions, velocities, lifetimes
2. Render pass: draw particles as points or small quads with additive blending

**Emitter types:**
- **Charge aura:** particles spawn in a radius around the player, spiral inward, color shifts from blue → white as charge increases
- **Projectile trail:** particles spawn behind a moving projectile, fade and slow over time
- **Impact explosion:** burst of particles at collision point, outward velocity, gravity pulls them down
- **Respawn flash:** radial burst, bright white/yellow, short-lived
- **Spirit bomb orbit:** particles spawned at the sphere's radius, orbit with slight inward drift

### Destructible Terrain (Pixel Grid)

The stage geometry also exists as a 2D pixel grid stored in a GPU buffer. Each cell is a material type (air, dirt, stone, grass). A compute shader runs cellular automata rules each frame:
- Loose dirt/rubble falls if air is below
- Piles accumulate naturally
- Water (if added later) flows sideways and down

When a projectile hits terrain, cells at the impact point convert from solid → rubble in a radius proportional to the attack's power. The rubble then cascades via the automata rules. The visual result is terrain that crumbles and settles naturally.

---

## Game Loop Architecture

```
Fixed timestep physics (e.g., 60hz)
┌──────────────────────────────────────────┐
│  Read input state                        │
│  Update player physics (move, jump, land)│
│  Update projectiles (travel, collision)  │
│  Run terrain automata (compute shader)   │
│  Update particle emitters (compute shader)│
└──────────────────────────────────────────┘

Variable timestep rendering
┌──────────────────────────────────────────┐
│  Render terrain pixel grid               │
│  Render platforms (2.5D quads)           │
│  Render player (stick figure)            │
│  Render particles (additive blend pass)  │
│  Render UI (charge meter, etc.)          │
└──────────────────────────────────────────┘
```

Physics and simulation run at a fixed rate for determinism. Rendering runs as fast as the display allows, interpolating between physics frames for smooth motion.

---

## Build Phases

### Phase 1: Platformer Feel
- [ ] Vite + TypeScript project scaffold
- [ ] Canvas setup with WebGPU device initialization
- [ ] Placeholder rendering (colored rectangles for platforms, circle for player)
- [ ] Player physics: acceleration, gravity, ground detection, platform collision
- [ ] Jump tuning: variable height, coyote time, jump buffering
- [ ] Input system (keyboard state tracking)
- [ ] Kill zone + simple respawn (teleport back, no effects yet)

### Phase 2: WebGPU Rendering
- [ ] 2.5D platform rendering (extruded quads, grass top / dirt front)
- [ ] Stick figure joint-based rendering
- [ ] Procedural animation (idle, run, jump, fall)
- [ ] Camera (static or slight follow — TBD)

### Phase 3: Particle Effects + Attacks
- [ ] Compute shader particle system (spawn, update, render pipeline)
- [ ] Charge aura emitter (attached to player, scales with charge time)
- [ ] Mega Man charge shot (3 charge levels, horizontal projectile)
- [ ] Projectile trail particles
- [ ] Impact explosion particles
- [ ] Respawn burst effect
- [ ] Spirit bomb (growing sphere, orbital particles, slow 45° launch)

### Phase 4: Destructible Terrain
- [ ] Convert platform geometry to pixel grid (GPU buffer)
- [ ] Terrain rendering from pixel grid
- [ ] Cellular automata compute shader (gravity, settling)
- [ ] Projectile → terrain collision (convert cells to rubble on impact)
- [ ] Crater scaling based on attack power
- [ ] Debris particles on impact

### Phase 5: Polish
- [ ] Screen shake on big impacts
- [ ] Additive bloom on energy attacks
- [ ] Sound effects (if desired)
- [ ] Charge meter UI
- [ ] Background (parallax sky, clouds?)

---

## Development

### Prerequisites

- Node.js 18+
- A browser with WebGPU support (Chrome/Edge stable, Firefox 141+, Safari 26+)

### Getting started

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. That's it.

### WebGPU not available?

If your browser doesn't support WebGPU, the game should detect this on init and show a fallback message. For Chrome, WebGPU is enabled by default. For Firefox on Linux, it may still require a flag.

---

## Future Possibilities

- **Multiplayer:** Game loop is structured as `update(inputs, dt)` — this maps cleanly onto a server-authoritative model if we ever want to add networking. Room infrastructure already designed in a separate project.
- **More materials:** Water, lava, ice, explosive barrels — all just new cell types in the terrain automata.
- **More attacks:** Beam (continuous stream), scatter shot, ground pound, etc.
- **AI opponents:** State machine enemy that runs, jumps, and fires — single player target practice.
- **Level editor:** Paint terrain with a brush tool, save/load as JSON.