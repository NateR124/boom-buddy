import { GpuContext } from './gpu';
import { Projectile } from '../physics/projectile';

interface ProjectileRenderData {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
}

const MAX_VERTS = 2048;

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
) {
  const verts: number[] = [];

  // Render active projectiles
  for (const p of projectiles) {
    if (!p.alive) continue;
    drawSpiritBomb(verts, p.x + cameraX, p.y + cameraY, p.radius, time, 1.0);
  }

  // Render spirit bomb charge sphere (above player during charge)
  if (spiritChargeRadius > 0) {
    drawSpiritBomb(verts, spiritChargeX + cameraX, spiritChargeY + cameraY, spiritChargeRadius, time, 0.8);
  }

  if (verts.length === 0) return;

  const vertexData = new Float32Array(verts);
  device.queue.writeBuffer(data.vertexBuffer, 0, vertexData);

  pass.setPipeline(data.pipeline);
  pass.setBindGroup(0, data.bindGroup);
  pass.setVertexBuffer(0, data.vertexBuffer);
  pass.draw(verts.length / 6);
}

function drawSpiritBomb(verts: number[], x: number, y: number, radius: number, time: number, alpha: number) {
  const pulse = 1 + Math.sin(time * 8) * 0.08;
  const r = radius * pulse;

  // Bloom halo — very large, very faint (additive blending makes it glow)
  drawCircle(verts, x, y, r * 2.0, 20, [1.0, 0.4, 0.05, 0.08 * alpha]);
  // Outer glow
  drawCircle(verts, x, y, r * 1.4, 16, [1.0, 0.5, 0.1, 0.25 * alpha]);
  // Mid layer
  drawCircle(verts, x, y, r, 14, [1.0, 0.7, 0.2, 0.55 * alpha]);
  // Inner bright
  drawCircle(verts, x, y, r * 0.65, 12, [1.0, 0.9, 0.5, 0.7 * alpha]);
  // Core — hot white
  drawCircle(verts, x, y, r * 0.35, 10, [1.0, 0.97, 0.9, 0.95 * alpha]);
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
