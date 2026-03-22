import { GpuContext } from './gpu';
import { Projectile } from '../physics/projectile';
import { WorldItem } from '../items/itemSpawner';
import { getItemDef } from '../items/itemTypes';
import { Enemy, EnemySystem, getDamageNumberRenderData } from '../enemies/enemySystem';

interface ProjectileRenderData {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
}

const MAX_VERTS = 16384;

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
) {
  const verts: number[] = [];

  // Dig light glow
  if (digLight) {
    const dlx = digLight.x + cameraX;
    const dly = digLight.y + cameraY;
    const pulse = 0.7 + Math.sin(time * 15) * 0.15;
    // Outer glow
    drawRect(verts, dlx - digLight.w, dly - digLight.h, digLight.w * 2, digLight.h * 2, [1.0, 0.95, 0.7, 0.12 * pulse]);
    // Main light
    drawRect(verts, dlx - digLight.w / 2, dly - digLight.h / 2, digLight.w, digLight.h, [1.0, 0.95, 0.8, 0.5 * pulse]);
    // Bright core
    drawRect(verts, dlx - digLight.w / 4, dly - digLight.h / 4, digLight.w / 2, digLight.h / 2, [1.0, 1.0, 0.95, 0.85 * pulse]);
  }

  // Render active projectiles
  for (const p of projectiles) {
    if (!p.alive) continue;
    drawSpiritBomb(verts, p.x + cameraX, p.y + cameraY, p.radius, time, 1.0, p.purpleOvercharge, p.windStacks);
  }

  // Render spirit bomb charge sphere (above player during charge)
  if (spiritChargeRadius > 0) {
    drawSpiritBomb(verts, spiritChargeX + cameraX, spiritChargeY + cameraY, spiritChargeRadius, time, 0.8, chargePurpleOvercharge, chargeGlowStacks);
  }

  // Render world items
  for (const item of items) {
    if (!item.alive) continue;
    const def = getItemDef(item.id);
    const r = parseInt(def.color.slice(1, 3), 16) / 255;
    const g = parseInt(def.color.slice(3, 5), 16) / 255;
    const b = parseInt(def.color.slice(5, 7), 16) / 255;
    const ix = item.x + cameraX;
    const iy = item.y + cameraY;
    const bobble = Math.sin(time * 3 + item.x * 0.1) * 3;
    const pulse = 6 + Math.sin(time * 4 + item.y * 0.1) * 1.5;
    // Outer glow
    drawCircle(verts, ix, iy + bobble, pulse * 1.8, 10, [r, g, b, 0.15]);
    // Main body
    drawCircle(verts, ix, iy + bobble, pulse, 10, [r, g, b, 0.8]);
    // Bright core
    drawCircle(verts, ix, iy + bobble, pulse * 0.4, 8, [1, 1, 1, 0.6]);
  }

  // Render enemies (bats)
  const enemies = enemySys?.enemies ?? [];
  const bb = batColors ?? { batBody: [0.3, 0.1, 0.15], batWing: [0.25, 0.05, 0.1], batEye: [1.0, 0.2, 0.1] };
  for (const e of enemies) {
    if (!e.alive) continue;
    const ex = e.x + cameraX;
    const ey = e.y + cameraY;
    // Wing flap animation
    const wingPhase = Math.sin(time * 12 + e.x * 0.3) * 0.5 + 0.5;
    const wingSpan = 16 + wingPhase * 8;
    const wingDrop = wingPhase * 6;
    // Body
    drawCircle(verts, ex, ey, 10, 8, [bb.batBody[0], bb.batBody[1], bb.batBody[2], 0.9]);
    // Eyes
    drawCircle(verts, ex - 4, ey - 2, 2.4, 5, [bb.batEye[0], bb.batEye[1], bb.batEye[2], 1.0]);
    drawCircle(verts, ex + 4, ey - 2, 2.4, 5, [bb.batEye[0], bb.batEye[1], bb.batEye[2], 1.0]);
    // Wings (triangles)
    const wc: [number, number, number, number] = [bb.batWing[0], bb.batWing[1], bb.batWing[2], 0.8];
    // Left wing
    verts.push(ex - 6, ey, wc[0], wc[1], wc[2], wc[3]);
    verts.push(ex - 6 - wingSpan, ey - 4 + wingDrop, wc[0], wc[1], wc[2], wc[3]);
    verts.push(ex - 6, ey + 6, wc[0], wc[1], wc[2], wc[3]);
    // Right wing
    verts.push(ex + 6, ey, wc[0], wc[1], wc[2], wc[3]);
    verts.push(ex + 6 + wingSpan, ey - 4 + wingDrop, wc[0], wc[1], wc[2], wc[3]);
    verts.push(ex + 6, ey + 6, wc[0], wc[1], wc[2], wc[3]);

    // HP bar (only show if damaged)
    if (e.hp < e.maxHp) {
      const barW = 24;
      const barH = 3;
      const barY = ey - 16;
      const barX = ex - barW / 2;
      const hpPct = Math.max(0, e.hp / e.maxHp);
      // Background (dark)
      drawRect(verts, barX, barY, barW, barH, [0, 0, 0, 0.6]);
      // Fill (red → green)
      const fr = 1 - hpPct;
      const fg = hpPct;
      drawRect(verts, barX, barY, barW * hpPct, barH, [fr, fg, 0.1, 0.9]);
    }
  }

  // Render damage numbers
  if (enemySys) {
    const dmgNums = getDamageNumberRenderData(enemySys);
    for (const dn of dmgNums) {
      const dx = dn.x + cameraX;
      const dy = dn.y + cameraY;
      drawNumber(verts, dx, dy, dn.amount, dn.alpha);
    }
  }

  // Render blast rings — white expanding ring, stronger wind = less opacity
  if (blastRings) {
    for (const ring of blastRings) {
      const t = ring.age / 0.5; // 0 to 1 over 0.5 seconds
      if (t >= 1) continue;
      // Wind strength scales size, speed (via maxRadius), and opacity toward 1
      const s = ring.strength; // 0 = no wind, 1 = max wind
      const currentR = ring.maxRadius * t;
      const thickness = Math.max(2, ring.maxRadius * 0.08 * (1 - t));
      // Opacity: starts low, wind pushes it closer to 1 (but never reaches)
      const baseAlpha = 0.15 + s * 0.75; // 0.15 at 0 wind, 0.9 at max
      const alpha = baseAlpha * (1 - t);
      if (alpha > 0.01 && currentR > 1) {
        drawRing(verts, ring.x + cameraX, ring.y + cameraY,
          currentR - thickness / 2, currentR + thickness / 2,
          24, [1.0, 1.0, 1.0, alpha]);
      }
    }
  }

  if (verts.length === 0) return false;

  // Clamp to buffer capacity (6 floats per vertex)
  const maxFloats = MAX_VERTS * 6;
  const overflow = verts.length > maxFloats;
  const clampedLen = overflow ? maxFloats : verts.length;

  const vertexData = new Float32Array(verts.slice(0, clampedLen));
  device.queue.writeBuffer(data.vertexBuffer, 0, vertexData);

  pass.setPipeline(data.pipeline);
  pass.setBindGroup(0, data.bindGroup);
  pass.setVertexBuffer(0, data.vertexBuffer);
  pass.draw(clampedLen / 6);

  return overflow;
}

function drawSpiritBomb(verts: number[], x: number, y: number, radius: number, time: number, alpha: number, purpleOvercharge = 0, glowStacks = 0) {
  const pulse = 1 + Math.sin(time * 8) * 0.08;
  const r = radius * pulse;

  // Purple overcharge shifts the bomb from orange → dark purple with white outlines
  const d = Math.min(purpleOvercharge, 1);

  // Glow scale: 0 stacks = tight/small glow, scales up with stacks
  // g goes from 0.4 (tight) to 1.0 (full) over ~10 stacks
  const g = 0.4 + 0.6 * Math.min(glowStacks / 10, 1);

  // Bloom halo — scales with glow
  drawCircle(verts, x, y, r * (1.2 + g * 0.8), 20, [
    1.0 - d * 0.5, 0.4 - d * 0.3, 0.05 + d * 0.5, 0.08 * g * alpha,
  ]);
  // Outer glow — scales with glow
  drawCircle(verts, x, y, r * (0.9 + g * 0.5), 16, [
    0.7 + d * 0.3, 0.5 - d * 0.4, 0.1 + d * 0.7, 0.25 * g * alpha,
  ]);
  // Mid layer
  drawCircle(verts, x, y, r, 14, [
    0.6 - d * 0.3, 0.2 + d * 0.1, 0.8 * d + 0.2 * (1 - d), 0.55 * alpha,
  ]);
  // Inner bright
  drawCircle(verts, x, y, r * 0.65, 12, [
    1.0, 0.9 - d * 0.3, 0.5 + d * 0.5, 0.7 * alpha,
  ]);
  // Core — stays hot white
  drawCircle(verts, x, y, r * 0.35, 10, [1.0, 0.97, 0.9, 0.95 * alpha]);

  // White outline ring at high purple overcharge
  if (d > 0.1) {
    drawRing(verts, x, y, r * 0.95, r * 1.05, 20, [1.0, 1.0, 1.0, d * 0.4 * alpha]);
  }
}

function drawRect(verts: number[], x: number, y: number, w: number, h: number, color: [number, number, number, number]) {
  const [r, g, b, a] = color;
  verts.push(x, y, r, g, b, a);
  verts.push(x + w, y, r, g, b, a);
  verts.push(x + w, y + h, r, g, b, a);
  verts.push(x, y, r, g, b, a);
  verts.push(x + w, y + h, r, g, b, a);
  verts.push(x, y + h, r, g, b, a);
}

// Simple 7-segment-style digit rendering using line segments
const DIGIT_W = 4;
const DIGIT_H = 6;
// Each digit is defined by which of 7 segments are active
// Segments: 0=top, 1=top-right, 2=bot-right, 3=bottom, 4=bot-left, 5=top-left, 6=middle
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

function drawDigit(verts: number[], x: number, y: number, digit: number, color: [number, number, number, number]) {
  const segs = DIGIT_SEGS[digit];
  if (!segs) return;
  const t = 0.8; // segment thickness
  const w = DIGIT_W;
  const h = DIGIT_H / 2;
  // top
  if (segs[0]) drawRect(verts, x, y, w, t, color);
  // top-right
  if (segs[1]) drawRect(verts, x + w - t, y, t, h, color);
  // bot-right
  if (segs[2]) drawRect(verts, x + w - t, y + h, t, h, color);
  // bottom
  if (segs[3]) drawRect(verts, x, y + h * 2 - t, w, t, color);
  // bot-left
  if (segs[4]) drawRect(verts, x, y + h, t, h, color);
  // top-left
  if (segs[5]) drawRect(verts, x, y, t, h, color);
  // middle
  if (segs[6]) drawRect(verts, x, y + h - t / 2, w, t, color);
}

function drawNumber(verts: number[], x: number, y: number, num: number, alpha: number) {
  const str = Math.round(num).toString();
  const totalW = str.length * (DIGIT_W + 1) - 1;
  let cx = x - totalW / 2;
  const color: [number, number, number, number] = [1.0, 0.9, 0.2, alpha];
  for (const ch of str) {
    const d = parseInt(ch);
    if (!isNaN(d)) {
      drawDigit(verts, cx, y, d, color);
    }
    cx += DIGIT_W + 1;
  }
}

function drawRing(verts: number[], cx: number, cy: number, innerR: number, outerR: number, segs: number, color: [number, number, number, number]) {
  const [cr, cg, cb, ca] = color;
  for (let i = 0; i < segs; i++) {
    const a1 = (i / segs) * Math.PI * 2;
    const a2 = ((i + 1) / segs) * Math.PI * 2;
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const c2 = Math.cos(a2), s2 = Math.sin(a2);
    // Two triangles per segment to form a quad
    verts.push(cx + c1 * innerR, cy + s1 * innerR, cr, cg, cb, ca);
    verts.push(cx + c1 * outerR, cy + s1 * outerR, cr, cg, cb, ca);
    verts.push(cx + c2 * outerR, cy + s2 * outerR, cr, cg, cb, ca);
    verts.push(cx + c1 * innerR, cy + s1 * innerR, cr, cg, cb, ca);
    verts.push(cx + c2 * outerR, cy + s2 * outerR, cr, cg, cb, ca);
    verts.push(cx + c2 * innerR, cy + s2 * innerR, cr, cg, cb, ca);
  }
}

function drawCircle(verts: number[], cx: number, cy: number, r: number, segs: number, color: [number, number, number, number]) {
  const [cr, cg, cb, ca] = color;
  for (let i = 0; i < segs; i++) {
    const a1 = (i / segs) * Math.PI * 2;
    const a2 = ((i + 1) / segs) * Math.PI * 2;
    verts.push(cx, cy, cr, cg, cb, ca);
    verts.push(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cr, cg, cb, ca);
    verts.push(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, cr, cg, cb, ca);
  }
}
