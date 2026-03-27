import { GpuContext } from './gpu';
import { TerrainGrid, GRID_W, GRID_H } from '../terrain/grid';
import shaderCode from '../terrain/terrainShader.wgsl?raw';

export interface TerrainRenderData {
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
  gridBuffer: GPUBuffer;
}

// 4 cells packed per u32
const GRID_BUFFER_SIZE = Math.ceil((GRID_W * GRID_H) / 4) * 4;

// Pre-allocated buffers reused every frame (zero GC)
const packed = new Uint32Array(GRID_BUFFER_SIZE / 4);
const unifBuf = new ArrayBuffer(96);
const unifF32 = new Float32Array(unifBuf);
const unifU32 = new Uint32Array(unifBuf);

export function createTerrainRenderer(gpu: GpuContext): TerrainRenderData {
  const { device, format } = gpu;

  const gridBuffer = device.createBuffer({
    size: GRID_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const uniformBuffer = device.createBuffer({
    size: 96,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shaderModule = device.createShaderModule({ code: shaderCode });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: gridBuffer } },
    ],
  });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });

  return { pipeline, bindGroup, uniformBuffer, gridBuffer };
}

/**
 * Upload the terrain grid to the GPU and update uniforms.
 */
export function uploadTerrainGrid(
  device: GPUDevice,
  data: TerrainRenderData,
  grid: TerrainGrid,
  time: number,
  canvasW: number,
  canvasH: number,
  cameraX = 0,
  cameraY = 0,
  dayPhase = 0,
  regenTimer = 0,
  worldYOffset = 0,
  biomeColors?: { cave: number[]; dirtLight: number[]; dirtDark: number[] },
) {
  // Pack cells: 4 bytes per u32 (reuses module-level packed buffer)
  const cells = grid.cells;
  const totalCells = grid.width * grid.height;
  for (let i = 0; i < totalCells; i += 4) {
    packed[i >> 2] =
      (cells[i] || 0) |
      ((cells[i + 1] || 0) << 8) |
      ((cells[i + 2] || 0) << 16) |
      ((cells[i + 3] || 0) << 24);
  }
  device.queue.writeBuffer(data.gridBuffer, 0, packed.buffer);

  // Reuse module-level uniform buffer
  unifF32[0] = canvasW;
  unifF32[1] = canvasH;
  unifU32[2] = grid.width;
  unifU32[3] = grid.height;
  unifF32[4] = time;
  unifF32[5] = cameraX;
  unifF32[6] = cameraY;
  unifF32[7] = dayPhase;
  unifF32[8] = regenTimer;
  unifU32[9] = worldYOffset;
  const bc = biomeColors ?? { cave: [0.02, 0.02, 0.04], dirtLight: [0.50, 0.35, 0.16], dirtDark: [0.28, 0.18, 0.07] };
  unifF32[12] = bc.cave[0]; unifF32[13] = bc.cave[1]; unifF32[14] = bc.cave[2];
  unifF32[16] = bc.dirtLight[0]; unifF32[17] = bc.dirtLight[1]; unifF32[18] = bc.dirtLight[2];
  unifF32[20] = bc.dirtDark[0]; unifF32[21] = bc.dirtDark[1]; unifF32[22] = bc.dirtDark[2];
  device.queue.writeBuffer(data.uniformBuffer, 0, unifBuf);
}

/**
 * Render the terrain as a fullscreen quad.
 */
export function renderTerrain(pass: GPURenderPassEncoder, data: TerrainRenderData) {
  pass.setPipeline(data.pipeline);
  pass.setBindGroup(0, data.bindGroup);
  pass.draw(6);
}
