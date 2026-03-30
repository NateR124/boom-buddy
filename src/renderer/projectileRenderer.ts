import { GpuContext } from './gpu';
import { Projectile } from '../physics/projectile';
import { WorldItem } from '../items/itemSpawner';
import { getItemDef } from '../items/itemTypes';
import { Enemy, EnemySystem, getDamageNumberRenderData } from '../enemies/enemySystem';
import { WinState, drawBossStatue, getBoomRadius, getStatueMouthPos } from '../winSequence';
import { CANVAS_W, CANVAS_H } from '../gameConfig';

interface ProjectileRenderData {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
}

const MAX_VERTS = 65536;

const SHADER_CODE = /* wgsl */`
struct Uniforms {
  resolution: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

struct VertexInput {
  @location(0) pos: vec2f,
  @location(1) color: vec4f,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let ndc = vec2f(
    (input.pos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (input.pos.y / uniforms.resolution.y) * 2.0,
  );
  out.position = vec4f(ndc, 0.0, 1.0);
  out.color = input.color;
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
`;

export function createProjectileRenderer(gpu: GpuContext): ProjectileRenderData {
  const { device, format } = gpu;
  const shaderModule = device.createShaderModule({ code: SHADER_CODE });

  const vertexBuffer = device.createBuffer({
    size: MAX_VERTS * 24, // 2 pos + 4 color = 6 floats * 4 bytes
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([
    gpu.canvas.width, gpu.canvas.height, 0, 0,
  ]));

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform' },
    }],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 24, // 6 floats
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' },
          { shaderLocation: 1, offset: 8, format: 'float32x4' },
        ],
      }],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
        },
      }],
    },
    primitive: { topology: 'triangle-list' },
  });

  return { pipeline, vertexBuffer, uniformBuffer, bindGroup };
}

// Pre-allocated vertex buffer — reused every frame (zero GC)
const maxFloats = MAX_VERTS * 6;
const vertBuf = new Float32Array(maxFloats);
let vertIdx = 0;

/** Push 6 floats (one vertex) into the pre-allocated buffer */
function v6(x: number, y: number, r: number, g: number, b: number, a: number) {
  if (vertIdx + 6 > maxFloats) return;
  vertBuf[vertIdx++] = x;
  vertBuf[vertIdx++] = y;
  vertBuf[vertIdx++] = r;
  vertBuf[vertIdx++] = g;
  vertBuf[vertIdx++] = b;
  vertBuf[vertIdx++] = a;
}

/** Frustum margin — objects within this many pixels of the viewport are drawn */
const MARGIN = 80;

function onScreen(x: number, y: number, r: number): boolean {
  return x + r > -MARGIN && x - r < CANVAS_W + MARGIN &&
         y + r > -MARGIN && y - r < CANVAS_H + MARGIN;
}

/** Adaptive LOD: fewer segments for small circles */
function lodSegs(r: number, baseSegs: number): number {
  if (r < 2) return 4;
  if (r < 5) return Math.min(baseSegs, 6);
  if (r < 15) return Math.min(baseSegs, 10);
  return baseSegs;
}

export function renderProjectiles(
  pass: GPURenderPassEncoder,
  data: ProjectileRenderData,
  device: GPUDevice,
  projectiles: Projectile[],
  spiritChargeX: number,
  spiritChargeY: number,
  spiritChargeRadius: number,
  time: number,
  cameraX = 0,
  cameraY = 0,
  items: WorldItem[] = [],
  chargePurpleOvercharge = 0,
  chargeGlowStacks = 0,
  enemySys?: EnemySystem,
  batColors?: { batBody: number[]; batWing: number[]; batEye: number[] },
  digLight?: { x: number; y: number; w: number; h: number } | null,
  blastRings?: { x: number; y: number; maxRadius: number; age: number; strength: number }[],
  winState?: WinState,
) {
  vertIdx = 0;

  // Dig light glow
  if (digLight) {
    const dlx = digLight.x + cameraX;
    const dly = digLight.y + cameraY;
    const pulse = 0.7 + Math.sin(time * 15) * 0.15;
    drawRect(dlx - digLight.w, dly - digLight.h, digLight.w * 2, digLight.h * 2, 1.0, 0.95, 0.7, 0.12 * pulse);
    drawRect(dlx - digLight.w / 2, dly - digLight.h / 2, digLight.w, digLight.h, 1.0, 0.95, 0.8, 0.5 * pulse);
    drawRect(dlx - digLight.w / 4, dly - digLight.h / 4, digLight.w / 2, digLight.h / 2, 1.0, 1.0, 0.95, 0.85 * pulse);
  }

  // Render active projectiles
  for (const p of projectiles) {
    if (!p.alive) continue;
    const sx = p.x + cameraX, sy = p.y + cameraY;
    if (onScreen(sx, sy, p.radius * 3)) {
      drawSpiritBomb(sx, sy, p.radius, time, 1.0, p.purpleOvercharge, p.windStacks);
    }
  }

  // Render spirit bomb charge sphere
  if (spiritChargeRadius > 0) {
    drawSpiritBomb(spiritChargeX + cameraX, spiritChargeY + cameraY, spiritChargeRadius, time, 0.8, chargePurpleOvercharge, chargeGlowStacks);
  }

  // Render world items (with frustum culling)
  for (const item of items) {
    if (!item.alive) continue;
    const ix = item.x + cameraX;
    const iy = item.y + cameraY;
    if (!onScreen(ix, iy, 20)) continue;
    const def = getItemDef(item.id);
    const r = parseInt(def.color.slice(1, 3), 16) / 255;
    const g = parseInt(def.color.slice(3, 5), 16) / 255;
    const b = parseInt(def.color.slice(5, 7), 16) / 255;
    const bobble = Math.sin(time * 3 + item.x * 0.1) * 3;
    const pulse = 6 + Math.sin(time * 4 + item.y * 0.1) * 1.5;
    drawCircle(ix, iy + bobble, pulse * 1.8, 10, r, g, b, 0.15);
    drawCircle(ix, iy + bobble, pulse, 10, r, g, b, 0.8);
    drawCircle(ix, iy + bobble, pulse * 0.4, 8, 1, 1, 1, 0.6);
  }

  // Render enemies (bats) with frustum culling
  const enemies = enemySys?.enemies ?? [];
  const bb = batColors ?? { batBody: [0.3, 0.1, 0.15], batWing: [0.25, 0.05, 0.1], batEye: [1.0, 0.2, 0.1] };
  for (const e of enemies) {
    if (!e.alive) continue;
    const ex = e.x + cameraX;
    const ey = e.y + cameraY;
    if (!onScreen(ex, ey, 40)) continue;
    // Wing flap animation
    const wingPhase = Math.sin(time * 12 + e.x * 0.3) * 0.5 + 0.5;
    const wingSpan = 16 + wingPhase * 8;
    const wingDrop = wingPhase * 6;
    // Body
    drawCircle(ex, ey, 10, 8, bb.batBody[0], bb.batBody[1], bb.batBody[2], 0.9);
    // Eyes
    drawCircle(ex - 4, ey - 2, 2.4, 5, bb.batEye[0], bb.batEye[1], bb.batEye[2], 1.0);
    drawCircle(ex + 4, ey - 2, 2.4, 5, bb.batEye[0], bb.batEye[1], bb.batEye[2], 1.0);
    // Wings (triangles)
    const wr = bb.batWing[0], wg = bb.batWing[1], wb = bb.batWing[2], wa = 0.8;
    // Left wing
    v6(ex - 6, ey, wr, wg, wb, wa);
    v6(ex - 6 - wingSpan, ey - 4 + wingDrop, wr, wg, wb, wa);
    v6(ex - 6, ey + 6, wr, wg, wb, wa);
    // Right wing
    v6(ex + 6, ey, wr, wg, wb, wa);
    v6(ex + 6 + wingSpan, ey - 4 + wingDrop, wr, wg, wb, wa);
    v6(ex + 6, ey + 6, wr, wg, wb, wa);

    // HP bar (only show if damaged)
    if (e.hp < e.maxHp) {
      const barW = 24;
      const barH = 3;
      const barY = ey - 16;
      const barX = ex - barW / 2;
      const hpPct = Math.max(0, e.hp / e.maxHp);
      drawRect(barX, barY, barW, barH, 0, 0, 0, 0.6);
      const fr = 1 - hpPct;
      const fg = hpPct;
      drawRect(barX, barY, barW * hpPct, barH, fr, fg, 0.1, 0.9);
    }
  }

  // Render damage numbers
  if (enemySys) {
    const dmgNums = getDamageNumberRenderData(enemySys);
    for (const dn of dmgNums) {
      const dx = dn.x + cameraX;
      const dy = dn.y + cameraY;
      if (onScreen(dx, dy, 30)) {
        drawNumber(dx, dy, dn.amount, dn.alpha, dn.color);
      }
    }
  }

  // Render blast rings
  if (blastRings) {
    for (const ring of blastRings) {
      const t = ring.age / 0.5;
      if (t >= 1) continue;
      const s = ring.strength;
      const currentR = ring.maxRadius * t;
      const thickness = Math.max(2, ring.maxRadius * 0.08 * (1 - t));
      const baseAlpha = 0.15 + s * 0.75;
      const alpha = baseAlpha * (1 - t);
      if (alpha > 0.01 && currentR > 1) {
        const rx = ring.x + cameraX, ry = ring.y + cameraY;
        if (onScreen(rx, ry, currentR + thickness)) {
          drawRing(rx, ry,
            currentR - thickness / 2, currentR + thickness / 2,
            24, 1.0, 1.0, 1.0, alpha);
        }
      }
    }
  }

  // Boss statue + boom phase spirit bomb
  if (winState && winState.triggered) {
    drawBossStatue(v6, cameraX, cameraY, time);
    const boomR = getBoomRadius(winState);
    if (boomR > 0) {
      const mouth = getStatueMouthPos();
      drawSpiritBomb(mouth.x + cameraX, mouth.y + cameraY, boomR, time, 1.0, 5, 10);
    }
  }

  if (vertIdx === 0) return false;

  const overflow = vertIdx >= maxFloats;
  const uploadFloats = Math.min(vertIdx, maxFloats);
  // Upload only the portion we wrote (subarray avoids copy)
  device.queue.writeBuffer(data.vertexBuffer, 0, vertBuf.buffer, 0, uploadFloats * 4);

  pass.setPipeline(data.pipeline);
  pass.setBindGroup(0, data.bindGroup);
  pass.setVertexBuffer(0, data.vertexBuffer);
  pass.draw(uploadFloats / 6);

  return overflow;
}

function drawSpiritBomb(x: number, y: number, radius: number, time: number, alpha: number, purpleOvercharge = 0, glowStacks = 0) {
  const pulse = 1 + Math.sin(time * 8) * 0.08;
  const r = radius * pulse;

  const tier1 = Math.min(purpleOvercharge, 1);
  const tier2 = Math.max(0, Math.min(purpleOvercharge - 1, 1));
  const tier3 = Math.max(0, Math.min(purpleOvercharge - 2, 1));
  const tier4 = Math.max(0, Math.min(purpleOvercharge - 3, 1));
  const tier5 = Math.max(0, Math.min(purpleOvercharge - 4, 1));

  const d = tier1;
  const g = 0.4 + 0.6 * Math.min(glowStacks / 10, 1);

  // === BASE BOMB ===
  drawCircle(x, y, r * (1.2 + g * 0.8), 20,
    1.0 - d * 0.5, 0.4 - d * 0.3, 0.05 + d * 0.5, 0.08 * g * alpha);
  drawCircle(x, y, r * (0.9 + g * 0.5), 16,
    0.7 + d * 0.3, 0.5 - d * 0.4, 0.1 + d * 0.7, 0.25 * g * alpha);
  drawCircle(x, y, r, 14,
    0.6 - d * 0.3, 0.2 + d * 0.1, 0.8 * d + 0.2 * (1 - d), 0.55 * alpha);
  drawCircle(x, y, r * 0.65, 12,
    1.0, 0.9 - d * 0.3, 0.5 + d * 0.5, 0.7 * alpha);
  drawCircle(x, y, r * 0.35, 10, 1.0, 0.97, 0.9, 0.95 * alpha);

  // White outline ring (tier 1)
  if (d > 0.1) {
    drawRing(x, y, r * 0.95, r * 1.05, 20, 1.0, 1.0, 1.0, d * 0.4 * alpha);
  }

  // === TIER 2: LIGHTNING ARCS ===
  if (tier2 > 0) {
    const numBolts = 3 + Math.floor(tier2 * 4);
    for (let i = 0; i < numBolts; i++) {
      const baseAngle = (i / numBolts) * Math.PI * 2 + time * 6;
      const flickerSpeed = 15 + i * 7;
      const flicker = Math.sin(time * flickerSpeed + i * 31) * 0.5 + 0.5;
      if (flicker < 0.3) continue;

      const innerR = r * 0.6;
      const outerR = r * (1.0 + tier2 * 0.3);
      const jag1 = Math.sin(time * 20 + i * 17) * 0.3;
      const jag2 = Math.sin(time * 25 + i * 23) * 0.2;

      const x0 = x + Math.cos(baseAngle) * innerR;
      const y0 = y + Math.sin(baseAngle) * innerR;
      const midAngle = baseAngle + jag1;
      const midR = (innerR + outerR) / 2;
      const x1 = x + Math.cos(midAngle) * midR;
      const y1 = y + Math.sin(midAngle) * midR;
      const endAngle = baseAngle + jag2;
      const x2 = x + Math.cos(endAngle) * outerR;
      const y2 = y + Math.sin(endAngle) * outerR;

      const boltAlpha = tier2 * flicker * 0.8 * alpha;
      const t1 = 1.2;
      v6(x0 - t1, y0, 0.7, 0.7, 1.0, boltAlpha);
      v6(x0 + t1, y0, 0.7, 0.7, 1.0, boltAlpha);
      v6(x1, y1, 0.7, 0.7, 1.0, boltAlpha);
      v6(x1 - t1, y1, 0.7, 0.7, 1.0, boltAlpha);
      v6(x1 + t1, y1, 0.7, 0.7, 1.0, boltAlpha);
      v6(x2, y2, 0.7, 0.7, 1.0, boltAlpha);
    }
  }

  // === TIER 3: ORBITING RINGS ===
  if (tier3 > 0) {
    const ringCount = 1 + Math.floor(tier3);
    for (let ri = 0; ri < ringCount; ri++) {
      const ringAngle = time * (2.5 + ri * 1.5) + ri * Math.PI;
      const tilt = 0.3 + ri * 0.4;
      const ringR = r * (1.1 + tier3 * 0.15);
      const segs = 20;
      const ringAlpha = tier3 * 0.5 * alpha;
      for (let i = 0; i < segs; i++) {
        const a1 = (i / segs) * Math.PI * 2;
        const a2 = ((i + 1) / segs) * Math.PI * 2;
        const rx1 = x + Math.cos(a1 + ringAngle) * ringR;
        const ry1 = y + Math.sin(a1 + ringAngle) * ringR * tilt;
        const rx2 = x + Math.cos(a2 + ringAngle) * ringR;
        const ry2 = y + Math.sin(a2 + ringAngle) * ringR * tilt;
        v6(rx1, ry1, 0.8, 0.5, 1.0, ringAlpha);
        v6(rx2, ry2, 0.8, 0.5, 1.0, ringAlpha);
        v6(x, y, 0.8, 0.5, 1.0, 0);
      }
    }
  }

  // === TIER 4: EVENT HORIZON ===
  if (tier4 > 0) {
    const horizonR = r * (0.3 + tier4 * 0.15);
    const horizonThick = 2 + tier4 * 2;
    drawRing(x, y, horizonR - horizonThick / 2, horizonR + horizonThick / 2, 18,
      0.9, 0.5, 1.0, tier4 * 0.6 * alpha);
    const numDots = 6 + Math.floor(tier4 * 6);
    for (let i = 0; i < numDots; i++) {
      const da = (i / numDots) * Math.PI * 2 + time * (10 + i * 2);
      const wobble = Math.sin(time * 15 + i * 7) * 3;
      const dr = horizonR + wobble;
      const dotSize = 1.0 + tier4 * 0.5;
      drawCircle(x + Math.cos(da) * dr, y + Math.sin(da) * dr,
        dotSize, 5, 1.0, 0.9, 1.0, tier4 * 0.7 * alpha);
    }
    const haloPulse = 0.5 + 0.5 * Math.sin(time * 6);
    drawRing(x, y, r * 1.05, r * 1.05 + 1.5, 16,
      0.7, 0.3, 0.9, tier4 * haloPulse * 0.3 * alpha);
  }

  // === TIER 5: CORONA / RADIATING SPIKES ===
  if (tier5 > 0) {
    const numRays = 8 + Math.floor(tier5 * 8);
    const rayLength = r * (0.5 + tier5 * 0.8);
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 2 + time * 3;
      const rayPulse = 0.5 + 0.5 * Math.sin(time * 10 + i * 4);
      const len = rayLength * (0.6 + rayPulse * 0.4);
      const baseR = r * 0.9;
      const tipX = x + Math.cos(angle) * (baseR + len);
      const tipY = y + Math.sin(angle) * (baseR + len);
      const perpX = -Math.sin(angle) * 2.5;
      const perpY = Math.cos(angle) * 2.5;
      const bx = x + Math.cos(angle) * baseR;
      const by = y + Math.sin(angle) * baseR;
      const rayAlpha = tier5 * rayPulse * 0.6 * alpha;
      v6(bx + perpX, by + perpY, 1.0, 0.85, 0.4, rayAlpha);
      v6(bx - perpX, by - perpY, 1.0, 0.85, 0.4, rayAlpha);
      v6(tipX, tipY, 1.0, 0.85, 0.4, rayAlpha * 0.3);
    }
  }
}

function drawRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number) {
  v6(x, y, r, g, b, a);
  v6(x + w, y, r, g, b, a);
  v6(x + w, y + h, r, g, b, a);
  v6(x, y, r, g, b, a);
  v6(x + w, y + h, r, g, b, a);
  v6(x, y + h, r, g, b, a);
}

// Simple 7-segment-style digit rendering using line segments
const DIGIT_W = 4;
const DIGIT_H = 6;
const DIGIT_SEGS: boolean[][] = [
  [true, true, true, true, true, true, false],   // 0
  [false, true, true, false, false, false, false], // 1
  [true, true, false, true, true, false, true],   // 2
  [true, true, true, true, false, false, true],   // 3
  [false, true, true, false, false, true, true],  // 4
  [true, false, true, true, false, true, true],   // 5
  [true, false, true, true, true, true, true],    // 6
  [true, true, true, false, false, false, false],  // 7
  [true, true, true, true, true, true, true],     // 8
  [true, true, true, true, false, true, true],    // 9
];

function drawDigit(x: number, y: number, digit: number, r: number, g: number, b: number, a: number) {
  const segs = DIGIT_SEGS[digit];
  if (!segs) return;
  const t = 0.8;
  const w = DIGIT_W;
  const h = DIGIT_H / 2;
  if (segs[0]) drawRect(x, y, w, t, r, g, b, a);
  if (segs[1]) drawRect(x + w - t, y, t, h, r, g, b, a);
  if (segs[2]) drawRect(x + w - t, y + h, t, h, r, g, b, a);
  if (segs[3]) drawRect(x, y + h * 2 - t, w, t, r, g, b, a);
  if (segs[4]) drawRect(x, y + h, t, h, r, g, b, a);
  if (segs[5]) drawRect(x, y, t, h, r, g, b, a);
  if (segs[6]) drawRect(x, y + h - t / 2, w, t, r, g, b, a);
}

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

function drawNumber(x: number, y: number, num: number, alpha: number, cssColor = '#ffe633') {
  const str = Math.round(num).toString();
  const totalW = str.length * (DIGIT_W + 1) - 1;
  let cx = x - totalW / 2;
  const [r, g, b] = parseHexColor(cssColor);
  for (const ch of str) {
    const d = parseInt(ch);
    if (!isNaN(d)) {
      drawDigit(cx, y, d, r, g, b, alpha);
    }
    cx += DIGIT_W + 1;
  }
}

function drawRing(cx: number, cy: number, innerR: number, outerR: number, segs: number, cr: number, cg: number, cb: number, ca: number) {
  for (let i = 0; i < segs; i++) {
    const a1 = (i / segs) * Math.PI * 2;
    const a2 = ((i + 1) / segs) * Math.PI * 2;
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const c2 = Math.cos(a2), s2 = Math.sin(a2);
    v6(cx + c1 * innerR, cy + s1 * innerR, cr, cg, cb, ca);
    v6(cx + c1 * outerR, cy + s1 * outerR, cr, cg, cb, ca);
    v6(cx + c2 * outerR, cy + s2 * outerR, cr, cg, cb, ca);
    v6(cx + c1 * innerR, cy + s1 * innerR, cr, cg, cb, ca);
    v6(cx + c2 * outerR, cy + s2 * outerR, cr, cg, cb, ca);
    v6(cx + c2 * innerR, cy + s2 * innerR, cr, cg, cb, ca);
  }
}

function drawCircle(cx: number, cy: number, r: number, baseSegs: number, cr: number, cg: number, cb: number, ca: number) {
  const segs = lodSegs(r, baseSegs);
  for (let i = 0; i < segs; i++) {
    const a1 = (i / segs) * Math.PI * 2;
    const a2 = ((i + 1) / segs) * Math.PI * 2;
    v6(cx, cy, cr, cg, cb, ca);
    v6(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cr, cg, cb, ca);
    v6(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, cr, cg, cb, ca);
  }
}
