// Terrain render shader — fullscreen quad that reads a grid storage buffer
// and outputs colored pixels for each material type.

struct Uniforms {
  resolution: vec2f,
  gridSize: vec2u,
  time: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> grid: array<u32>;

// Fullscreen quad positions (NDC)
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
};

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  var out: VertexOutput;
  out.position = vec4f(QUAD_POS[vertexIndex], 0.0, 1.0);
  return out;
}

// Material constants
const MAT_AIR: u32    = 0u;
const MAT_GRASS: u32  = 1u;
const MAT_DIRT: u32   = 2u;
const MAT_STONE: u32  = 3u;
const MAT_RUBBLE: u32 = 4u;

// Simple hash for per-cell noise
fn hash(p: vec2u) -> f32 {
  let n = p.x * 73u + p.y * 157u + 37u;
  let h = (n ^ (n >> 8u)) * 2654435761u;
  return f32(h & 0xFFFFu) / 65535.0;
}

fn getMaterial(gx: i32, gy: i32) -> u32 {
  if (gx < 0 || gx >= i32(uniforms.gridSize.x) || gy < 0 || gy >= i32(uniforms.gridSize.y)) {
    return MAT_AIR;
  }
  let idx = u32(gy) * uniforms.gridSize.x + u32(gx);
  // 4 cells packed per u32
  let word = grid[idx / 4u];
  let byteOff = (idx % 4u) * 8u;
  return (word >> byteOff) & 0xFFu;
}

fn isAir(gx: i32, gy: i32) -> bool {
  return getMaterial(gx, gy) == MAT_AIR;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let fragPos = input.position.xy;
  let gx = i32(fragPos.x) / 2;
  let gy = i32(fragPos.y) / 2;
  let mat = getMaterial(gx, gy);

  if (mat == MAT_AIR) {
    // Sky gradient
    let t = fragPos.y / uniforms.resolution.y;
    let skyTop = vec3f(0.04, 0.04, 0.12);
    let skyBot = vec3f(0.10, 0.07, 0.20);
    return vec4f(mix(skyTop, skyBot, t), 1.0);
  }

  let noise = hash(vec2u(u32(gx), u32(gy)));

  // Edge detection: darken if adjacent to air
  var edgeFactor = 1.0;
  if (isAir(gx - 1, gy) || isAir(gx + 1, gy) || isAir(gx, gy - 1) || isAir(gx, gy + 1)) {
    edgeFactor = 0.78;
  }

  // Sub-cell variation based on pixel position within the 2x2 cell
  let subX = f32(i32(fragPos.x) % 2);
  let subY = f32(i32(fragPos.y) % 2);
  let subVar = 1.0 - (subX + subY) * 0.015;

  var color = vec3f(0.0);

  if (mat == MAT_GRASS) {
    // Green with brightness variation
    let surfaceHighlight = select(0.0, 0.12, isAir(gx, gy - 1));
    color = vec3f(0.25 + noise * 0.08, 0.52 + noise * 0.10 + surfaceHighlight, 0.20 + noise * 0.06);
  } else if (mat == MAT_DIRT) {
    // Brown — darker deeper (check distance from air above)
    var depth = 0.0;
    for (var dy = 1; dy <= 8; dy++) {
      if (isAir(gx, gy - dy)) {
        depth = f32(dy) / 8.0;
        break;
      }
    }
    if (depth == 0.0) { depth = 1.0; } // deep underground
    let lightBrown = vec3f(0.50, 0.35, 0.16);
    let darkBrown = vec3f(0.28, 0.18, 0.07);
    color = mix(lightBrown, darkBrown, depth) + noise * 0.03;
  } else if (mat == MAT_RUBBLE) {
    // Warm light brown — loose material
    color = vec3f(0.52 + noise * 0.08, 0.38 + noise * 0.06, 0.20 + noise * 0.04);
  } else if (mat == MAT_STONE) {
    // Gray
    color = vec3f(0.40 + noise * 0.06, 0.40 + noise * 0.06, 0.45 + noise * 0.06);
  }

  color *= edgeFactor * subVar;
  return vec4f(color, 1.0);
}
