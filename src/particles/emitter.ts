// Particle data layout (12 floats per particle):
// [0]  px       - position x
// [1]  py       - position y
// [2]  vx       - velocity x
// [3]  vy       - velocity y
// [4]  r        - color red
// [5]  g        - color green
// [6]  b        - color blue
// [7]  a        - color alpha (managed by compute shader)
// [8]  life     - remaining life in seconds
// [9]  maxLife  - initial life (for fade ratio)
// [10] size     - render size in pixels
// [11] flags    - bitfield: bit0=gravity, bit1=damping, bit2=attractors

export const PARTICLE_STRIDE = 12;

export interface EmitParams {
  x: number;
  y: number;
  count: number;
  spread?: number;
  speedMin: number;
  speedMax: number;
  angleMin: number;
  angleMax: number;
  lifeMin: number;
  lifeMax: number;
  sizeMin: number;
  sizeMax: number;
  color: [number, number, number];
  colorVar?: number;
  gravity?: boolean;
  damping?: boolean;
  attractors?: boolean;  // respond to GPU attractor forces
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function flagsToFloat(flags: number): number {
  const buf = new ArrayBuffer(4);
  new Uint32Array(buf)[0] = flags;
  return new Float32Array(buf)[0];
}

export function emitParticles(
  data: Float32Array,
  maxParticles: number,
  cursor: { value: number },
  params: EmitParams,
): void {
  const flagBits =
    (params.gravity ? 1 : 0) |
    (params.damping ? 2 : 0) |
    (params.attractors ? 4 : 0);
  const flagsAsFloat = flagsToFloat(flagBits);

  for (let i = 0; i < params.count; i++) {
    const idx = cursor.value % maxParticles;
    cursor.value++;
    const base = idx * PARTICLE_STRIDE;

    const spreadX = params.spread ? rand(-params.spread, params.spread) : 0;
    const spreadY = params.spread ? rand(-params.spread, params.spread) : 0;

    const angle = rand(params.angleMin, params.angleMax);
    const speed = rand(params.speedMin, params.speedMax);

    const cv = params.colorVar ?? 0;
    const r = Math.max(0, Math.min(1, params.color[0] + rand(-cv, cv)));
    const g = Math.max(0, Math.min(1, params.color[1] + rand(-cv, cv)));
    const b = Math.max(0, Math.min(1, params.color[2] + rand(-cv, cv)));

    const life = rand(params.lifeMin, params.lifeMax);

    data[base + 0] = params.x + spreadX;
    data[base + 1] = params.y + spreadY;
    data[base + 2] = Math.cos(angle) * speed;
    data[base + 3] = Math.sin(angle) * speed;
    data[base + 4] = r;
    data[base + 5] = g;
    data[base + 6] = b;
    data[base + 7] = 1.0;
    data[base + 8] = life;
    data[base + 9] = life;
    data[base + 10] = rand(params.sizeMin, params.sizeMax);
    data[base + 11] = flagsAsFloat;
  }
}

// --- Preset emitters ---

export function emitChargeAura(
  data: Float32Array, max: number, cursor: { value: number },
  px: number, py: number, chargeLevel: number,
) {
  // Spawn particles in a ring around the player with minimal initial velocity.
  // The GPU attractor forces will pull them inward with tangential swirl.
  const count = Math.floor(2 + chargeLevel * 4);
  const radius = 35 + (1 - chargeLevel) * 25;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * (0.7 + Math.random() * 0.3);
    const ox = Math.cos(angle) * dist;
    const oy = Math.sin(angle) * dist;

    const t = chargeLevel;
    const r = 0.3 + t * 0.7;
    const g = 0.5 + t * 0.5;
    const b = 1.0;

    // Small random initial velocity — the attractor does the real work
    emitParticles(data, max, cursor, {
      x: px + ox, y: py + oy,
      count: 1,
      speedMin: 5, speedMax: 20,
      angleMin: 0, angleMax: Math.PI * 2,
      lifeMin: 0.4, lifeMax: 0.8,
      sizeMin: 1.5 + chargeLevel * 1.5, sizeMax: 2.5 + chargeLevel * 2,
      color: [r, g, b],
      colorVar: 0.08,
      damping: true,
      attractors: true,
    });
  }
}

export function emitProjectileTrail(
  data: Float32Array, max: number, cursor: { value: number },
  px: number, py: number, level: number,
) {
  const count = 1 + level;
  emitParticles(data, max, cursor, {
    x: px, y: py,
    count,
    spread: 3 + level * 2,
    speedMin: 10, speedMax: 40,
    angleMin: 0, angleMax: Math.PI * 2,
    lifeMin: 0.15, lifeMax: 0.35,
    sizeMin: 1.5, sizeMax: 3 + level,
    color: [0.4 + level * 0.2, 0.6 + level * 0.15, 1.0],
    colorVar: 0.05,
    damping: true,
  });
}

export function emitImpactExplosion(
  data: Float32Array, max: number, cursor: { value: number },
  px: number, py: number, power: number,
) {
  const count = Math.floor(20 + power * 40);
  emitParticles(data, max, cursor, {
    x: px, y: py,
    count,
    spread: 4,
    speedMin: 80, speedMax: 250 + power * 150,
    angleMin: 0, angleMax: Math.PI * 2,
    lifeMin: 0.3, lifeMax: 0.8 + power * 0.4,
    sizeMin: 2, sizeMax: 4 + power * 3,
    color: [1.0, 0.7, 0.3],
    colorVar: 0.15,
    gravity: true,
    damping: true,
  });
}

export function emitRespawnBurst(
  data: Float32Array, max: number, cursor: { value: number },
  px: number, py: number,
) {
  emitParticles(data, max, cursor, {
    x: px, y: py,
    count: 40,
    speedMin: 100, speedMax: 300,
    angleMin: 0, angleMax: Math.PI * 2,
    lifeMin: 0.2, lifeMax: 0.5,
    sizeMin: 2, sizeMax: 5,
    color: [1.0, 0.95, 0.7],
    colorVar: 0.1,
    damping: true,
  });
}

export function emitSpiritBombOrbit(
  data: Float32Array, max: number, cursor: { value: number },
  bx: number, by: number, radius: number,
) {
  // Spawn at the sphere's edge — the GPU attractor handles the orbit + inward drift
  const angle = Math.random() * Math.PI * 2;
  const dist = radius * (1.0 + Math.random() * 0.4);
  const ox = Math.cos(angle) * dist;
  const oy = Math.sin(angle) * dist;

  emitParticles(data, max, cursor, {
    x: bx + ox, y: by + oy,
    count: 2,
    speedMin: 5, speedMax: 15,
    angleMin: 0, angleMax: Math.PI * 2,
    lifeMin: 0.4, lifeMax: 0.7,
    sizeMin: 2, sizeMax: 4,
    color: [1.0, 0.7, 0.25],
    colorVar: 0.1,
    damping: true,
    attractors: true,
  });
}

export function emitTerrainDebris(
  data: Float32Array, max: number, cursor: { value: number },
  px: number, py: number, cellCount: number,
) {
  // Scale particle count with crater size, cap to avoid flooding
  const count = Math.min(Math.floor(8 + cellCount * 0.4), 60);
  const speed = 60 + Math.min(cellCount, 100) * 1.5;

  // Mix of dirt-brown and grass-green particles
  emitParticles(data, max, cursor, {
    x: px, y: py,
    count: Math.floor(count * 0.7),
    spread: 6,
    speedMin: speed * 0.4, speedMax: speed,
    angleMin: -Math.PI, angleMax: 0, // upward hemisphere
    lifeMin: 0.3, lifeMax: 0.9,
    sizeMin: 2, sizeMax: 5,
    color: [0.45, 0.30, 0.14],
    colorVar: 0.1,
    gravity: true,
    damping: true,
  });

  emitParticles(data, max, cursor, {
    x: px, y: py,
    count: Math.floor(count * 0.3),
    spread: 4,
    speedMin: speed * 0.5, speedMax: speed * 1.2,
    angleMin: -Math.PI, angleMax: 0,
    lifeMin: 0.2, lifeMax: 0.6,
    sizeMin: 1.5, sizeMax: 3.5,
    color: [0.28, 0.50, 0.22],
    colorVar: 0.08,
    gravity: true,
    damping: true,
  });
}
