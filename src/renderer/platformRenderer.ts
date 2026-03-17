import { GpuContext } from './gpu';

interface Platform { x: number; y: number; w: number; h: number; }

interface PlatformRenderData {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  vertexCount: number;
}

const SHADER_CODE = /* wgsl */`
struct Uniforms {
  resolution: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec3f,
};

struct VertexInput {
  @location(0) pos: vec2f,
  @location(1) color: vec3f,
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
  return vec4f(input.color, 1.0);
}
`;

export function createPlatformRenderer(gpu: GpuContext, platforms: Platform[]): PlatformRenderData {
  const { device, format } = gpu;

  const shaderModule = device.createShaderModule({ code: SHADER_CODE });

  const verts: number[] = [];

  // Background gradient sky (full-screen quad split into top/bottom for gradient)
  const W = gpu.canvas.width;
  const H = gpu.canvas.height;
  // Top of sky — dark blue
  pushQuad(verts, 0, 0, W, H * 0.5, [0.05, 0.05, 0.18]);
  // Bottom of sky — slightly lighter, blends to horizon
  pushQuad(verts, 0, H * 0.5, W, H * 0.5, [0.1, 0.08, 0.22]);

  for (const p of platforms) {
    buildPlatformGeometry(verts, p);
  }

  const vertexData = new Float32Array(verts);
  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([W, H, 0, 0]));

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
        arrayStride: 20,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x2' },
          { shaderLocation: 1, offset: 8, format: 'float32x3' },
        ],
      }],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list' },
  });

  return {
    pipeline,
    vertexBuffer,
    uniformBuffer,
    bindGroup,
    vertexCount: verts.length / 5,
  };
}

export function renderPlatforms(pass: GPURenderPassEncoder, data: PlatformRenderData) {
  pass.setPipeline(data.pipeline);
  pass.setBindGroup(0, data.bindGroup);
  pass.setVertexBuffer(0, data.vertexBuffer);
  pass.draw(data.vertexCount);
}

function buildPlatformGeometry(verts: number[], p: Platform) {
  const { x, y, w, h } = p;
  const isMain = h > 20; // main platform is thicker
  const frontDepth = isMain ? 28 : 14;

  // Drop shadow (soft dark area below/behind platform)
  const shadowOff = 4;
  pushQuad(verts, x + shadowOff, y + h + shadowOff, w, frontDepth, [0.03, 0.02, 0.06]);

  // Front face — dirt with vertical gradient (3 bands: light → mid → dark)
  const dirtLight: Color = [0.52, 0.36, 0.18];
  const dirtMid: Color   = [0.42, 0.28, 0.13];
  const dirtDark: Color  = [0.30, 0.20, 0.08];
  const bandH = frontDepth / 3;
  pushQuad(verts, x, y + h, w, bandH, dirtLight);
  pushQuad(verts, x, y + h + bandH, w, bandH, dirtMid);
  pushQuad(verts, x, y + h + bandH * 2, w, bandH, dirtDark);

  // Left edge highlight on front face (bevel effect)
  pushQuad(verts, x, y + h, 3, frontDepth, [0.55, 0.40, 0.22]);
  // Right edge shadow on front face
  pushQuad(verts, x + w - 3, y + h, 3, frontDepth, [0.25, 0.16, 0.07]);

  // Bottom edge of front face (darkest)
  pushQuad(verts, x, y + h + frontDepth - 2, w, 2, [0.18, 0.12, 0.05]);

  // Top face — grass
  const grassBase: Color = [0.30, 0.58, 0.25];
  pushQuad(verts, x, y, w, h, grassBase);

  // Grass highlight strip along the top edge
  pushQuad(verts, x, y, w, Math.min(3, h * 0.4), [0.45, 0.75, 0.35]);

  // Left edge highlight on top face
  pushQuad(verts, x, y, 2, h, [0.40, 0.68, 0.32]);

  // Grass tufts along the top — small triangles poking up
  const tuftSpacing = 18;
  const tuftColor: Color = [0.35, 0.62, 0.28];
  const tuftColorLight: Color = [0.50, 0.78, 0.38];
  for (let tx = x + 8; tx < x + w - 8; tx += tuftSpacing) {
    const tuftH = 4 + Math.sin(tx * 0.7) * 2; // slight variation
    const tuftW = 5;
    // Main tuft
    pushTriangle(verts,
      tx - tuftW, y,
      tx + tuftW, y,
      tx + 1, y - tuftH,
      tuftColor
    );
    // Smaller accent tuft
    pushTriangle(verts,
      tx + 3, y,
      tx + 8, y,
      tx + 6, y - tuftH * 0.6,
      tuftColorLight
    );
  }
}

type Color = [number, number, number];

function pushQuad(verts: number[], x: number, y: number, w: number, h: number, color: Color) {
  const [r, g, b] = color;
  verts.push(x, y, r, g, b);
  verts.push(x + w, y, r, g, b);
  verts.push(x + w, y + h, r, g, b);
  verts.push(x, y, r, g, b);
  verts.push(x + w, y + h, r, g, b);
  verts.push(x, y + h, r, g, b);
}

function pushTriangle(
  verts: number[],
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  color: Color,
) {
  const [r, g, b] = color;
  verts.push(x1, y1, r, g, b);
  verts.push(x2, y2, r, g, b);
  verts.push(x3, y3, r, g, b);
}
