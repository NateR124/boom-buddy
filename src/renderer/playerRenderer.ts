import { GpuContext } from './gpu';
import { Player } from '../physics/player';

interface PlayerRenderData {
  pipeline: GPURenderPipeline;
  vertexBuffer: GPUBuffer;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
}

const MAX_VERTS = 1024;

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

// Joint positions relative to player center (0,0)
interface Skeleton {
  head: Vec2;
  neck: Vec2;
  shoulderL: Vec2;
  shoulderR: Vec2;
  elbowL: Vec2;
  elbowR: Vec2;
  handL: Vec2;
  handR: Vec2;
  hip: Vec2;
  hipL: Vec2;
  hipR: Vec2;
  kneeL: Vec2;
  kneeR: Vec2;
  footL: Vec2;
  footR: Vec2;
}

type Vec2 = [number, number];

// Body proportions
const HEAD_R = 6;
const NECK_Y = -13;
const SHOULDER_Y = -9;
const SHOULDER_W = 5;
const UPPER_ARM = 10;
const LOWER_ARM = 9;
const HIP_Y = 6;
const HIP_W = 4;
const UPPER_LEG = 10;
const LOWER_LEG = 10;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getPose(player: Player, time: number): Skeleton {
  const f = player.facing; // 1 = right, -1 = left
  const speed = Math.abs(player.vx);
  const vy = player.vy;
  const grounded = player.grounded;

  // Body turn: shift shoulders/hips to show facing direction.
  // "Front" side (facing dir) is narrower, "back" side is wider — 3/4 view effect.
  const turnOffset = f * 2; // subtle horizontal shift
  const frontShrink = 0.5;  // front limbs closer to center
  const backExpand = 1.3;   // back limbs further from center

  // L side = left on screen, R side = right on screen
  // When facing right (f=1): L is back, R is front
  // When facing left (f=-1): L is front, R is back
  const lScale = f === 1 ? backExpand : frontShrink;
  const rScale = f === 1 ? frontShrink : backExpand;

  const skel: Skeleton = {
    head: [turnOffset * 0.5, -18],
    neck: [turnOffset * 0.3, NECK_Y],
    shoulderL: [-SHOULDER_W * lScale + turnOffset, SHOULDER_Y],
    shoulderR: [SHOULDER_W * rScale + turnOffset, SHOULDER_Y],
    elbowL: [-SHOULDER_W * lScale - 4 + turnOffset, SHOULDER_Y + 8],
    elbowR: [SHOULDER_W * rScale + 4 + turnOffset, SHOULDER_Y + 8],
    handL: [-SHOULDER_W * lScale - 2 + turnOffset, SHOULDER_Y + 16],
    handR: [SHOULDER_W * rScale + 2 + turnOffset, SHOULDER_Y + 16],
    hip: [turnOffset * 0.2, HIP_Y],
    hipL: [-HIP_W * lScale + turnOffset * 0.2, HIP_Y],
    hipR: [HIP_W * rScale + turnOffset * 0.2, HIP_Y],
    kneeL: [-HIP_W * lScale - 1 + turnOffset * 0.2, HIP_Y + UPPER_LEG],
    kneeR: [HIP_W * rScale + 1 + turnOffset * 0.2, HIP_Y + UPPER_LEG],
    footL: [-HIP_W * lScale + turnOffset * 0.2, HIP_Y + UPPER_LEG + LOWER_LEG],
    footR: [HIP_W * rScale + turnOffset * 0.2, HIP_Y + UPPER_LEG + LOWER_LEG],
  };

  if (!grounded && vy < -50) {
    applyJumpRise(skel, f);
  } else if (!grounded && vy > 50) {
    applyFalling(skel, f);
  } else if (!grounded) {
    const t = (vy + 50) / 100;
    applyJumpApex(skel, f, Math.max(0, Math.min(1, t)));
  } else if (speed > 20) {
    applyRunning(skel, f, time, speed);
  } else {
    applyIdle(skel, f, time);
  }

  return skel;
}

function applyIdle(s: Skeleton, facing: number, time: number) {
  // Gentle breathing bob
  const breathe = Math.sin(time * 2.5) * 1.2;
  s.head[1] += breathe;
  s.neck[1] += breathe;
  s.shoulderL[1] += breathe * 0.8;
  s.shoulderR[1] += breathe * 0.8;

  // Front arm rests slightly forward, back arm hangs
  // When facing right: R is front arm
  const sway = Math.sin(time * 1.5) * 0.8;
  if (facing === 1) {
    // Right arm (front) — slightly forward and relaxed
    s.elbowR[0] += 2;
    s.handR[0] += 3;
    s.handR[1] -= 1;
    // Left arm (back) — hangs naturally
    s.elbowL[0] += sway;
    s.handL[0] += sway;
  } else {
    // Left arm (front)
    s.elbowL[0] -= 2;
    s.handL[0] -= 3;
    s.handL[1] -= 1;
    // Right arm (back)
    s.elbowR[0] -= sway;
    s.handR[0] -= sway;
  }
}

function applyRunning(s: Skeleton, facing: number, time: number, speed: number) {
  const freq = 10 + (speed / 300) * 4;
  const phase = time * freq;
  const sin = Math.sin(phase);
  const cos = Math.cos(phase);

  // Lean torso in facing direction
  const lean = facing * 3.5;
  s.head[0] += lean;
  s.neck[0] += lean * 0.8;
  s.shoulderL[0] += lean * 0.5;
  s.shoulderR[0] += lean * 0.5;

  // Torso bob
  const bob = Math.abs(Math.sin(phase)) * 1.5;
  s.head[1] -= bob;
  s.neck[1] -= bob;

  // Legs swing in facing direction (not screen-relative)
  const legFwd = facing * sin * 11;
  const kneeUp = Math.max(0, -cos) * 6;

  // Front leg (leads the stride in facing direction)
  s.kneeL[0] = s.hipL[0] + legFwd;
  s.kneeL[1] = s.hipL[1] + UPPER_LEG - kneeUp;
  s.footL[0] = s.hipL[0] + legFwd * 1.3;
  s.footL[1] = s.kneeL[1] + LOWER_LEG - Math.max(0, -sin) * 4;

  // Back leg (opposite phase)
  s.kneeR[0] = s.hipR[0] - legFwd;
  s.kneeR[1] = s.hipR[1] + UPPER_LEG - Math.max(0, cos) * 6;
  s.footR[0] = s.hipR[0] - legFwd * 1.3;
  s.footR[1] = s.kneeR[1] + LOWER_LEG - Math.max(0, sin) * 4;

  // Arms pump in facing direction (opposite to legs)
  const armFwd = -facing * sin * 9;
  s.elbowL[0] = s.shoulderL[0] + armFwd * 0.5;
  s.elbowL[1] = s.shoulderL[1] + 5 - Math.abs(armFwd) * 0.3;
  s.handL[0] = s.shoulderL[0] + armFwd;
  s.handL[1] = s.elbowL[1] + 5;

  s.elbowR[0] = s.shoulderR[0] - armFwd * 0.5;
  s.elbowR[1] = s.shoulderR[1] + 5 - Math.abs(armFwd) * 0.3;
  s.handR[0] = s.shoulderR[0] - armFwd;
  s.handR[1] = s.elbowR[1] + 5;
}

function applyJumpRise(s: Skeleton, facing: number) {
  // Mario-style asymmetric jump: leading arm punches UP, trailing arm sweeps back/down.
  // "Leading" = the side we're facing toward.
  // When facing right (1): R is leading, L is trailing
  // When facing left (-1): L is leading, R is trailing

  // Leading arm — fist pump upward
  const leadShoulder = facing === 1 ? 'shoulderR' : 'shoulderL';
  const leadElbow = facing === 1 ? 'elbowR' : 'elbowL';
  const leadHand = facing === 1 ? 'handR' : 'handL';
  s[leadElbow][0] = s[leadShoulder][0] + facing * 2;
  s[leadElbow][1] = s[leadShoulder][1] - 8;
  s[leadHand][0] = s[leadShoulder][0] + facing * 3;
  s[leadHand][1] = s[leadShoulder][1] - 16;

  // Trailing arm — swept back and down
  const trailShoulder = facing === 1 ? 'shoulderL' : 'shoulderR';
  const trailElbow = facing === 1 ? 'elbowL' : 'elbowR';
  const trailHand = facing === 1 ? 'handL' : 'handR';
  s[trailElbow][0] = s[trailShoulder][0] - facing * 4;
  s[trailElbow][1] = s[trailShoulder][1] + 4;
  s[trailHand][0] = s[trailShoulder][0] - facing * 8;
  s[trailHand][1] = s[trailShoulder][1] + 8;

  // Leading leg — kicked forward and bent
  const leadHip = facing === 1 ? 'hipR' : 'hipL';
  const leadKnee = facing === 1 ? 'kneeR' : 'kneeL';
  const leadFoot = facing === 1 ? 'footR' : 'footL';
  s[leadKnee][0] = s[leadHip][0] + facing * 5;
  s[leadKnee][1] = s[leadHip][1] + 6;
  s[leadFoot][0] = s[leadHip][0] + facing * 3;
  s[leadFoot][1] = s[leadHip][1] + 14;

  // Trailing leg — stretched back behind
  const trailHip = facing === 1 ? 'hipL' : 'hipR';
  const trailKnee = facing === 1 ? 'kneeL' : 'kneeR';
  const trailFoot = facing === 1 ? 'footL' : 'footR';
  s[trailKnee][0] = s[trailHip][0] - facing * 4;
  s[trailKnee][1] = s[trailHip][1] + 8;
  s[trailFoot][0] = s[trailHip][0] - facing * 7;
  s[trailFoot][1] = s[trailHip][1] + 14;
}

function applyFalling(s: Skeleton, facing: number) {
  // Leading arm reaches forward/up (bracing), trailing arm trails behind
  const leadShoulder = facing === 1 ? 'shoulderR' : 'shoulderL';
  const leadElbow = facing === 1 ? 'elbowR' : 'elbowL';
  const leadHand = facing === 1 ? 'handR' : 'handL';
  s[leadElbow][0] = s[leadShoulder][0] + facing * 6;
  s[leadElbow][1] = s[leadShoulder][1] - 2;
  s[leadHand][0] = s[leadShoulder][0] + facing * 12;
  s[leadHand][1] = s[leadShoulder][1] - 3;

  const trailShoulder = facing === 1 ? 'shoulderL' : 'shoulderR';
  const trailElbow = facing === 1 ? 'elbowL' : 'elbowR';
  const trailHand = facing === 1 ? 'handL' : 'handR';
  s[trailElbow][0] = s[trailShoulder][0] - facing * 5;
  s[trailElbow][1] = s[trailShoulder][1] + 3;
  s[trailHand][0] = s[trailShoulder][0] - facing * 10;
  s[trailHand][1] = s[trailShoulder][1] + 1;

  // Legs dangle — leading leg slightly forward, trailing leg back
  const leadHip = facing === 1 ? 'hipR' : 'hipL';
  const leadKnee = facing === 1 ? 'kneeR' : 'kneeL';
  const leadFoot = facing === 1 ? 'footR' : 'footL';
  s[leadKnee][0] = s[leadHip][0] + facing * 2;
  s[leadKnee][1] = s[leadHip][1] + UPPER_LEG + 1;
  s[leadFoot][0] = s[leadHip][0] + facing * 1;
  s[leadFoot][1] = s[leadKnee][1] + LOWER_LEG + 2;

  const trailHip = facing === 1 ? 'hipL' : 'hipR';
  const trailKnee = facing === 1 ? 'kneeL' : 'kneeR';
  const trailFoot = facing === 1 ? 'footL' : 'footR';
  s[trailKnee][0] = s[trailHip][0] - facing * 3;
  s[trailKnee][1] = s[trailHip][1] + UPPER_LEG;
  s[trailFoot][0] = s[trailHip][0] - facing * 4;
  s[trailFoot][1] = s[trailKnee][1] + LOWER_LEG;
}

function applyJumpApex(s: Skeleton, facing: number, t: number) {
  // Blend: t=0 is fully jump-rise, t=1 is fully falling
  const rise = {} as Skeleton;
  const fall = {} as Skeleton;
  Object.assign(rise, s);
  Object.assign(fall, s);
  // Deep copy arrays
  for (const key of Object.keys(s) as (keyof Skeleton)[]) {
    rise[key] = [...s[key]] as Vec2;
    fall[key] = [...s[key]] as Vec2;
  }
  applyJumpRise(rise, facing);
  applyFalling(fall, facing);

  for (const key of Object.keys(s) as (keyof Skeleton)[]) {
    s[key][0] = lerp(rise[key][0], fall[key][0], t);
    s[key][1] = lerp(rise[key][1], fall[key][1], t);
  }
}

export function createPlayerRenderer(gpu: GpuContext): PlayerRenderData {
  const { device, format } = gpu;

  const shaderModule = device.createShaderModule({ code: SHADER_CODE });

  const vertexBuffer = device.createBuffer({
    size: MAX_VERTS * 20,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([
    gpu.canvas.width, gpu.canvas.height, 0, 0
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

  return { pipeline, vertexBuffer, uniformBuffer, bindGroup };
}

type Color = [number, number, number];

export function renderPlayer(
  pass: GPURenderPassEncoder,
  data: PlayerRenderData,
  device: GPUDevice,
  player: Player,
  time: number,
) {
  if (player.dead) return;

  // Invulnerability flash
  if (player.invulnTimer > 0 && Math.floor(time * 10) % 2 === 0) return;

  const verts: number[] = [];
  const cx = player.x;
  const cy = player.y;

  const skel = getPose(player, time);

  const bodyColor: Color = [0.95, 0.95, 0.95];
  const jointColor: Color = [0.7, 0.8, 0.9];

  // -- Limbs (draw behind body) --
  // Left arm: shoulder → elbow → hand
  drawLimb(verts, cx, cy, skel.shoulderL, skel.elbowL, skel.handL, 2.2, bodyColor, jointColor);
  // Left leg: hip → knee → foot
  drawLimb(verts, cx, cy, skel.hipL, skel.kneeL, skel.footL, 2.5, bodyColor, jointColor);
  // Right leg
  drawLimb(verts, cx, cy, skel.hipR, skel.kneeR, skel.footR, 2.5, bodyColor, jointColor);
  // Right arm
  drawLimb(verts, cx, cy, skel.shoulderR, skel.elbowR, skel.handR, 2.2, bodyColor, jointColor);

  // -- Torso --
  pushLine(verts, cx + skel.neck[0], cy + skel.neck[1], cx + skel.hip[0], cy + skel.hip[1], 3, bodyColor);

  // Shoulder bar
  pushLine(verts,
    cx + skel.shoulderL[0], cy + skel.shoulderL[1],
    cx + skel.shoulderR[0], cy + skel.shoulderR[1],
    2.5, bodyColor
  );

  // -- Head --
  const headX = cx + skel.head[0];
  const headY = cy + skel.head[1];
  drawCircle(verts, headX, headY, HEAD_R, 10, bodyColor);

  // Eyes
  const eyeOffX = player.facing * 3;
  drawCircle(verts, headX + eyeOffX, headY - 1, 1.5, 6, [0.3, 0.7, 1.0]);

  // Joint dots at knees and elbows
  for (const joint of [skel.elbowL, skel.elbowR, skel.kneeL, skel.kneeR]) {
    drawCircle(verts, cx + joint[0], cy + joint[1], 1.8, 6, jointColor);
  }

  const vertexData = new Float32Array(verts);
  device.queue.writeBuffer(data.vertexBuffer, 0, vertexData);

  pass.setPipeline(data.pipeline);
  pass.setBindGroup(0, data.bindGroup);
  pass.setVertexBuffer(0, data.vertexBuffer);
  pass.draw(verts.length / 5);
}

function drawLimb(
  verts: number[],
  cx: number, cy: number,
  joint1: Vec2, joint2: Vec2, joint3: Vec2,
  thickness: number,
  color: Color,
  _jointColor: Color,
) {
  pushLine(verts,
    cx + joint1[0], cy + joint1[1],
    cx + joint2[0], cy + joint2[1],
    thickness, color
  );
  pushLine(verts,
    cx + joint2[0], cy + joint2[1],
    cx + joint3[0], cy + joint3[1],
    thickness * 0.85, color
  );
}

function drawCircle(verts: number[], cx: number, cy: number, r: number, segs: number, color: Color) {
  for (let i = 0; i < segs; i++) {
    const a1 = (i / segs) * Math.PI * 2;
    const a2 = ((i + 1) / segs) * Math.PI * 2;
    pushTriangleRaw(verts,
      cx, cy,
      cx + Math.cos(a1) * r, cy + Math.sin(a1) * r,
      cx + Math.cos(a2) * r, cy + Math.sin(a2) * r,
      color
    );
  }
}

function pushTriangleRaw(
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

function pushLine(
  verts: number[],
  x1: number, y1: number,
  x2: number, y2: number,
  thickness: number,
  color: Color,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const nx = (-dy / len) * thickness * 0.5;
  const ny = (dx / len) * thickness * 0.5;

  const [r, g, b] = color;
  verts.push(x1 + nx, y1 + ny, r, g, b);
  verts.push(x1 - nx, y1 - ny, r, g, b);
  verts.push(x2 + nx, y2 + ny, r, g, b);

  verts.push(x1 - nx, y1 - ny, r, g, b);
  verts.push(x2 - nx, y2 - ny, r, g, b);
  verts.push(x2 + nx, y2 + ny, r, g, b);
}
