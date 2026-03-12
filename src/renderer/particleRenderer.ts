import { GpuContext } from './gpu';
import { PARTICLE_STRIDE } from '../particles/emitter';
import computeShaderCode from '../particles/computeShader.wgsl?raw';
import renderShaderCode from '../particles/renderShader.wgsl?raw';

// Attractor: radial pull + tangential swirl, piecewise linear falloff
export interface AttractorDef {
  x: number;
  y: number;
  strength: number;  // radial pull (positive = attract)
  radius: number;    // max influence distance
  tangent: number;   // tangential swirl strength
}

// GPU layout: count(u32) + 3 padding u32 + 4 attractors * 8 floats = 144 bytes
const MAX_ATTRACTORS = 4;
const ATTRACTOR_BUFFER_SIZE = 16 + MAX_ATTRACTORS * 32; // 16 header + 4*32

export interface ParticleSystem {
  maxParticles: number;
  cpuData: Float32Array;
  gpuBuffer: GPUBuffer;
  computePipeline: GPUComputePipeline;
  computeBindGroup: GPUBindGroup;
  paramBuffer: GPUBuffer;
  attractorBuffer: GPUBuffer;
  renderPipeline: GPURenderPipeline;
  renderBindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
}

export function createParticleSystem(gpu: GpuContext, maxParticles: number): ParticleSystem {
  const { device, format } = gpu;

  const cpuData = new Float32Array(maxParticles * PARTICLE_STRIDE);
  const bufferSize = cpuData.byteLength;

  const gpuBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const paramBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const attractorBuffer = device.createBuffer({
    size: ATTRACTOR_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Compute pipeline
  const computeModule = device.createShaderModule({ code: computeShaderCode });
  const computeBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });

  const computePipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
    compute: { module: computeModule, entryPoint: 'main' },
  });

  const computeBindGroup = device.createBindGroup({
    layout: computeBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: paramBuffer } },
      { binding: 1, resource: { buffer: gpuBuffer } },
      { binding: 2, resource: { buffer: attractorBuffer } },
    ],
  });

  // Render pipeline
  const renderModule = device.createShaderModule({ code: renderShaderCode });

  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([
    gpu.canvas.width, gpu.canvas.height, 0, 0,
  ]));

  const renderBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
    ],
  });

  const renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
    vertex: {
      module: renderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: renderModule,
      entryPoint: 'fs_main',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
        },
      }],
    },
    primitive: { topology: 'triangle-list' },
  });

  const renderBindGroup = device.createBindGroup({
    layout: renderBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: gpuBuffer } },
    ],
  });

  return {
    maxParticles,
    cpuData,
    gpuBuffer,
    computePipeline,
    computeBindGroup,
    paramBuffer,
    attractorBuffer,
    renderPipeline,
    renderBindGroup,
    uniformBuffer,
  };
}

/**
 * Upload only the newly-emitted particle slots to the GPU.
 */
export function uploadParticleRange(
  device: GPUDevice, ps: ParticleSystem,
  startCursor: number, endCursor: number,
) {
  if (endCursor <= startCursor) return;

  const start = startCursor % ps.maxParticles;
  const end = endCursor % ps.maxParticles;
  const bytesPerParticle = PARTICLE_STRIDE * 4;

  if (end > start || endCursor - startCursor >= ps.maxParticles) {
    const from = end > start ? start : 0;
    const to = end > start ? end : ps.maxParticles;
    const byteOffset = from * bytesPerParticle;
    const byteLen = (to - from) * bytesPerParticle;
    device.queue.writeBuffer(ps.gpuBuffer, byteOffset, ps.cpuData.buffer, byteOffset, byteLen);
    if (end <= start && end > 0) {
      device.queue.writeBuffer(ps.gpuBuffer, 0, ps.cpuData.buffer, 0, end * bytesPerParticle);
    }
  } else {
    const byteOffset1 = start * bytesPerParticle;
    const byteLen1 = (ps.maxParticles - start) * bytesPerParticle;
    device.queue.writeBuffer(ps.gpuBuffer, byteOffset1, ps.cpuData.buffer, byteOffset1, byteLen1);
    if (end > 0) {
      device.queue.writeBuffer(ps.gpuBuffer, 0, ps.cpuData.buffer, 0, end * bytesPerParticle);
    }
  }
}

/**
 * Upload attractor definitions to the GPU for this frame.
 */
export function uploadAttractors(device: GPUDevice, ps: ParticleSystem, attractors: AttractorDef[]) {
  const data = new Float32Array(ATTRACTOR_BUFFER_SIZE / 4);
  // Header: count as u32
  const countView = new Uint32Array(data.buffer, 0, 4);
  countView[0] = Math.min(attractors.length, MAX_ATTRACTORS);

  // Attractor data starts at float offset 4 (after 16 byte header)
  for (let i = 0; i < Math.min(attractors.length, MAX_ATTRACTORS); i++) {
    const a = attractors[i];
    const off = 4 + i * 8; // 8 floats per attractor (including padding)
    data[off + 0] = a.x;
    data[off + 1] = a.y;
    data[off + 2] = a.strength;
    data[off + 3] = a.radius;
    data[off + 4] = a.tangent;
    // [5..7] = padding
  }

  device.queue.writeBuffer(ps.attractorBuffer, 0, data);
}

export function updateParticlesGPU(encoder: GPUCommandEncoder, ps: ParticleSystem, device: GPUDevice, dt: number, time: number) {
  device.queue.writeBuffer(ps.paramBuffer, 0, new Float32Array([dt, time, 400, 0]));
  const countBuf = new Uint32Array([ps.maxParticles]);
  device.queue.writeBuffer(ps.paramBuffer, 12, countBuf);

  const pass = encoder.beginComputePass();
  pass.setPipeline(ps.computePipeline);
  pass.setBindGroup(0, ps.computeBindGroup);
  pass.dispatchWorkgroups(Math.ceil(ps.maxParticles / 64));
  pass.end();
}

export function renderParticles(pass: GPURenderPassEncoder, ps: ParticleSystem) {
  pass.setPipeline(ps.renderPipeline);
  pass.setBindGroup(0, ps.renderBindGroup);
  pass.draw(6, ps.maxParticles);
}
