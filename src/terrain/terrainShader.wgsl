// Terrain render shader — fullscreen quad that reads a grid storage buffer
// and outputs colored pixels for each material type.
// Also renders parallax sky background with stars and drifting clouds.

struct Uniforms {
  resolution: vec2f,
  gridSize: vec2u,
  time: f32,
  cameraX: f32,
  cameraY: f32,
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

// --- Hash functions ---
fn hash(p: vec2u) -> f32 {
  let n = p.x * 73u + p.y * 157u + 37u;
  let h = (n ^ (n >> 8u)) * 2654435761u;
  return f32(h & 0xFFFFu) / 65535.0;
}

fn hash2d(p: vec2f) -> f32 {
  let d = dot(p, vec2f(127.1, 311.7));
  return fract(sin(d) * 43758.5453123);
}

// --- Sky background ---
fn renderSky(fragPos: vec2f) -> vec3f {
  let uv = fragPos / uniforms.resolution;

  // Base gradient: deep navy at top → purple-blue at bottom
  let skyTop = vec3f(0.02, 0.02, 0.08);
  let skyMid = vec3f(0.06, 0.04, 0.14);
  let skyBot = vec3f(0.12, 0.06, 0.22);
  var sky = mix(skyTop, mix(skyMid, skyBot, uv.y), uv.y);

  // Stars — fixed positions, very slow twinkle
  let starUV = floor(fragPos * 0.25) * 4.0; // quantize to grid
  let starHash = hash2d(starUV);
  if (starHash > 0.993) {
    // Bright star
    let twinkle = 0.6 + 0.4 * sin(uniforms.time * 1.5 + starHash * 100.0);
    let brightness = twinkle * (1.0 - uv.y * 0.5); // dimmer near bottom
    let starColor = vec3f(0.8, 0.85, 1.0) * brightness;
    sky += starColor;
  } else if (starHash > 0.985) {
    // Dim star
    let twinkle = 0.3 + 0.2 * sin(uniforms.time * 2.0 + starHash * 50.0);
    let brightness = twinkle * (1.0 - uv.y * 0.7);
    sky += vec3f(0.4, 0.45, 0.6) * brightness;
  }

  // Cloud layer 1 — slow drift
  let cloudUV1 = vec2f(fragPos.x * 0.003 + uniforms.time * 0.008, fragPos.y * 0.006);
  let cloud1 = smoothCloudNoise(cloudUV1);
  let cloudColor1 = vec3f(0.12, 0.08, 0.20) * cloud1 * (1.0 - uv.y * 0.5);

  // Cloud layer 2 — faster, smaller
  let cloudUV2 = vec2f(fragPos.x * 0.005 - uniforms.time * 0.012, fragPos.y * 0.008 + 10.0);
  let cloud2 = smoothCloudNoise(cloudUV2);
  let cloudColor2 = vec3f(0.08, 0.06, 0.16) * cloud2 * (1.0 - uv.y * 0.3);

  sky += cloudColor1 + cloudColor2;
  return sky;
}

fn smoothCloudNoise(uv: vec2f) -> f32 {
  let i = floor(uv);
  let f = fract(uv);
  let u = f * f * (3.0 - 2.0 * f); // smoothstep

  let a = hash2d(i);
  let b = hash2d(i + vec2f(1.0, 0.0));
  let c = hash2d(i + vec2f(0.0, 1.0));
  let d = hash2d(i + vec2f(1.0, 1.0));

  let val = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  // Threshold to create cloud shapes
  return smoothstep(0.35, 0.65, val);
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
  // Apply camera shake offset
  let fragPos = input.position.xy - vec2f(uniforms.cameraX, uniforms.cameraY);
  let gx = i32(fragPos.x) / 2;
  let gy = i32(fragPos.y) / 2;
  let mat = getMaterial(gx, gy);

  if (mat == MAT_AIR) {
    let sky = renderSky(input.position.xy);
    return vec4f(sky, 1.0);
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
    let surfaceHighlight = select(0.0, 0.12, isAir(gx, gy - 1));
    color = vec3f(0.25 + noise * 0.08, 0.52 + noise * 0.10 + surfaceHighlight, 0.20 + noise * 0.06);
  } else if (mat == MAT_DIRT) {
    var depth = 0.0;
    for (var dy = 1; dy <= 8; dy++) {
      if (isAir(gx, gy - dy)) {
        depth = f32(dy) / 8.0;
        break;
      }
    }
    if (depth == 0.0) { depth = 1.0; }
    let lightBrown = vec3f(0.50, 0.35, 0.16);
    let darkBrown = vec3f(0.28, 0.18, 0.07);
    color = mix(lightBrown, darkBrown, depth) + noise * 0.03;
  } else if (mat == MAT_RUBBLE) {
    color = vec3f(0.52 + noise * 0.08, 0.38 + noise * 0.06, 0.20 + noise * 0.04);
  } else if (mat == MAT_STONE) {
    color = vec3f(0.40 + noise * 0.06, 0.40 + noise * 0.06, 0.45 + noise * 0.06);
  }

  color *= edgeFactor * subVar;
  return vec4f(color, 1.0);
}
