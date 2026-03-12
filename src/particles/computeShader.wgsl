// Particle compute shader — updates positions, velocities, lifetimes each frame.
// Each particle: pos(2f), vel(2f), color(4f), life(1f), maxLife(1f), size(1f), flags(1f) = 12 floats
//
// Physics model inspired by particle-life simulations:
//   - Exponential velocity damping (smooth deceleration, no jitter)
//   - Piecewise-linear attractor forces (no singularities at r=0)
//   - Tangential force component for organic swirling
//   - Semi-implicit Euler: update velocity first, then integrate position

struct Params {
  dt: f32,
  time: f32,
  gravity: f32,
  count: u32,
};

// Up to 4 point attractors active at once
struct Attractor {
  x: f32,
  y: f32,
  strength: f32,   // radial pull (positive = attract)
  radius: f32,     // max influence distance; force falls linearly to 0
  tangent: f32,    // tangential swirl strength (perpendicular to radial)
  _pad1: f32,
  _pad2: f32,
  _pad3: f32,
};

struct Attractors {
  count: u32,
  _pad0: u32,
  _pad1: u32,
  _pad2: u32,
  data: array<Attractor, 4>,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> particles: array<f32>;
@group(0) @binding(2) var<uniform> attractors: Attractors;

const STRIDE: u32 = 12u;
// Friction constant for exponential damping: v *= exp(-FRICTION * dt)
const FRICTION: f32 = 3.0;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let idx = id.x;
  if (idx >= params.count) {
    return;
  }

  let base = idx * STRIDE;
  let life = particles[base + 8u];

  if (life <= 0.0) {
    return;
  }

  // Read state
  var px = particles[base + 0u];
  var py = particles[base + 1u];
  var vx = particles[base + 2u];
  var vy = particles[base + 3u];
  let flags = bitcast<u32>(particles[base + 11u]);

  // Flag bits:
  // bit 0: apply gravity
  // bit 1: apply damping (exponential friction)
  // bit 2: respond to attractors
  let useGravity = (flags & 1u) != 0u;
  let useDamping = (flags & 2u) != 0u;
  let useAttractors = (flags & 4u) != 0u;

  let dt = params.dt;

  // --- Force accumulation ---

  // Gravity
  if (useGravity) {
    vy += params.gravity * dt;
  }

  // Attractor forces (piecewise linear falloff + tangential swirl)
  if (useAttractors) {
    for (var i = 0u; i < attractors.count; i++) {
      let a = attractors.data[i];
      let dx = a.x - px;
      let dy = a.y - py;
      let dist = sqrt(dx * dx + dy * dy);

      if (dist > 0.5 && dist < a.radius) {
        // Normalized direction toward attractor
        let nx = dx / dist;
        let ny = dy / dist;

        // Piecewise linear: full strength at dist=0, falls to 0 at radius
        let falloff = 1.0 - dist / a.radius;

        // Radial force (toward attractor)
        let radial = a.strength * falloff;
        vx += nx * radial * dt;
        vy += ny * radial * dt;

        // Tangential force (perpendicular, creates swirl)
        // Perpendicular to radial: (-ny, nx)
        let tangential = a.tangent * falloff;
        vx += -ny * tangential * dt;
        vy += nx * tangential * dt;
      }
    }
  }

  // --- Damping (semi-implicit: applied after forces, before position) ---
  if (useDamping) {
    let decay = exp(-FRICTION * dt);
    vx *= decay;
    vy *= decay;
  }

  // --- Position integration (semi-implicit Euler) ---
  px += vx * dt;
  py += vy * dt;

  // --- Lifetime ---
  let newLife = life - dt;
  let maxLife = particles[base + 9u];
  let lifeRatio = max(newLife / maxLife, 0.0);

  // Write back
  particles[base + 0u] = px;
  particles[base + 1u] = py;
  particles[base + 2u] = vx;
  particles[base + 3u] = vy;
  particles[base + 7u] = lifeRatio; // alpha fade
  particles[base + 8u] = newLife;
}
