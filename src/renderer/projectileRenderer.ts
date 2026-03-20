import { GpuContext } from './gpu';
import { Projectile } from '../physics/projectile';
import { WorldItem } from '../items/itemSpawner';
import { getItemDef } from '../items/itemTypes';
import { Enemy } from '../enemies/enemySystem';

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
  chargeDensity = 0,
  enemies: Enemy[] = [],
) {
  const verts: number[] = [];

  // Render active projectiles
  for (const p of projectiles) {
    if (!p.alive) continue;
    drawSpiritBomb(verts, p.x + cameraX, p.y + cameraY, p.radius, time, 1.0, p.density);
  }

  // Render spirit bomb charge sphere (above player during charge)
  if (spiritChargeRadius > 0) {
    drawSpiritBomb(verts, spiritChargeX + cameraX, spiritChargeY + cameraY, spiritChargeRadius, time, 0.8, chargeDensity);
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
  for (const e of enemies) {
    if (!e.alive) continue;
    const ex = e.x + cameraX;
    const ey = e.y + cameraY;
    // Wing flap animation
    const wingPhase = Math.sin(time * 12 + e.x * 0.3) * 0.5 + 0.5;
    const wingSpan = 8 + wingPhase * 4;
    const wingDrop = wingPhase * 3;
    // Body
    drawCircle(verts, ex, ey, 5, 8, [0.3, 0.1, 0.15, 0.9]);
    // Eyes (red dots)
    drawCircle(verts, ex - 2, ey - 1, 1.2, 5, [1.0, 0.2, 0.1, 1.0]);
    drawCircle(verts, ex + 2, ey - 1, 1.2, 5, [1.0, 0.2, 0.1, 1.0]);
    // Wings (triangles)
    const wc: [number, number, number, number] = [0.25, 0.05, 0.1, 0.8];
    // Left wing
    verts.push(ex - 3, ey, wc[0], wc[1], wc[2], wc[3]);
    verts.push(ex - 3 - wingSpan, ey - 2 + wingDrop, wc[0], wc[1], wc[2], wc[3]);
    verts.push(ex - 3, ey + 3, wc[0], wc[1], wc[2], wc[3]);
    // Right wing
    verts.push(ex + 3, ey, wc[0], wc[1], wc[2], wc[3]);
    verts.push(ex + 3 + wingSpan, ey - 2 + wingDrop, wc[0], wc[1], wc[2], wc[3]);
    verts.push(ex + 3, ey + 3, wc[0], wc[1], wc[2], wc[3]);
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

function drawSpiritBomb(verts: number[], x: number, y: number, radius: number, time: number, alpha: number, density = 0) {
  const pulse = 1 + Math.sin(time * 8) * 0.08;
  const r = radius * pulse;

  // Density shifts the bomb from orange → dark purple with white outlines
  // d is 0 at no density, approaches 1 at high density
  const d = Math.min(density / 10, 1);

  // Bloom halo
  drawCircle(verts, x, y, r * 2.0, 20, [
    1.0 - d * 0.5, 0.4 - d * 0.3, 0.05 + d * 0.5, 0.08 * alpha,
  ]);
  // Outer glow — becomes purple
  drawCircle(verts, x, y, r * 1.4, 16, [
    0.7 + d * 0.3, 0.5 - d * 0.4, 0.1 + d * 0.7, 0.25 * alpha,
  ]);
  // Mid layer — dark purple at high density
  drawCircle(verts, x, y, r, 14, [
    0.6 - d * 0.3, 0.2 + d * 0.1, 0.8 * d + 0.2 * (1 - d), 0.55 * alpha,
  ]);
  // Inner bright — white outline effect at high density
  drawCircle(verts, x, y, r * 0.65, 12, [
    1.0, 0.9 - d * 0.3, 0.5 + d * 0.5, 0.7 * alpha,
  ]);
  // Core — stays hot white
  drawCircle(verts, x, y, r * 0.35, 10, [1.0, 0.97, 0.9, 0.95 * alpha]);

  // White outline ring at high density
  if (d > 0.1) {
    drawRing(verts, x, y, r * 0.95, r * 1.05, 20, [1.0, 1.0, 1.0, d * 0.4 * alpha]);
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
