// Particle render shader — draws each particle as a screen-aligned quad (two triangles).
// Uses instancing: 6 vertices per particle (quad), instance index selects particle data.

struct Uniforms {
  resolution: vec2f,
  cameraOffset: vec2f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> particles: array<f32>;

const STRIDE: u32 = 12u;

// Quad corners (two triangles)
const QUAD_POS = array<vec2f, 6>(
  vec2f(-1.0, -1.0),
  vec2f( 1.0, -1.0),
  vec2f( 1.0,  1.0),
  vec2f(-1.0, -1.0),
  vec2f( 1.0,  1.0),
  vec2f(-1.0,  1.0),
);

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  let base = instanceIndex * STRIDE;

  let life = particles[base + 8u];

  var out: VertexOutput;

  // Dead particle — degenerate triangle (off-screen)
  if (life <= 0.0) {
    out.position = vec4f(0.0, 0.0, -2.0, 1.0);
    out.color = vec4f(0.0);
    return out;
  }

  let px = particles[base + 0u];
  let py = particles[base + 1u];
  let size = particles[base + 10u];

  let r = particles[base + 4u];
  let g = particles[base + 5u];
  let b = particles[base + 6u];
  let a = particles[base + 7u];

  let corner = QUAD_POS[vertexIndex % 6u];
  let worldPos = vec2f(px + corner.x * size + uniforms.cameraOffset.x, py + corner.y * size + uniforms.cameraOffset.y);

  let ndc = vec2f(
    (worldPos.x / uniforms.resolution.x) * 2.0 - 1.0,
    1.0 - (worldPos.y / uniforms.resolution.y) * 2.0,
  );

  out.position = vec4f(ndc, 0.0, 1.0);
  out.color = vec4f(r * a, g * a, b * a, a);
  return out;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
