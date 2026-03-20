// Terrain render shader — fullscreen quad that reads a grid storage buffer
// and outputs colored pixels for each material type.
// Features a full day/night cycle with sun arc, stars, clouds, and terrain lighting.

struct Uniforms {
  resolution: vec2f,
  gridSize: vec2u,
  time: f32,
  cameraX: f32,
  cameraY: f32,
  dayPhase: f32,
  regenTimer: f32, // counts down from ~1.5s after terrain regen, for blink effect
  worldYOffset: u32, // grid rows scrolled off top (for depth calculation)
  _pad0: f32,
  _pad1: f32,
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
const MAT_WATER: u32  = 5u;
const MAT_WALL: u32   = 6u;

const TAU: f32 = 6.28318530718;
const PI: f32  = 3.14159265359;

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

fn hash2d_b(p: vec2f) -> f32 {
  let d = dot(p, vec2f(269.5, 183.3));
  return fract(sin(d) * 28647.8953);
}

// --- Cloud noise ---
fn smoothCloudNoise(uv: vec2f) -> f32 {
  let i = floor(uv);
  let f = fract(uv);
  let u = f * f * (3.0 - 2.0 * f); // smoothstep

  let a = hash2d(i);
  let b = hash2d(i + vec2f(1.0, 0.0));
  let c = hash2d(i + vec2f(0.0, 1.0));
  let d = hash2d(i + vec2f(1.0, 1.0));

  let val = mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  return smoothstep(0.35, 0.65, val);
}

// Layered cloud noise for fluffier shapes
fn cloudFBM(uv: vec2f) -> f32 {
  var val = smoothCloudNoise(uv) * 0.6;
  val += smoothCloudNoise(uv * 2.1 + vec2f(3.7, 1.2)) * 0.25;
  val += smoothCloudNoise(uv * 4.3 + vec2f(7.1, 5.8)) * 0.15;
  return saturate(val);
}

// --- Day/night helper values ---
struct DayInfo {
  sunHeight: f32,    // -1 midnight, +1 noon
  dayFactor: f32,    // 0 at night, 1 during day (smooth)
  nightFactor: f32,  // inverse of dayFactor
  horizonGlow: f32,  // peaks at dawn/dusk
};

fn getDayInfo() -> DayInfo {
  let phase = uniforms.dayPhase;
  let sunHeight = -cos(phase * TAU);

  // Smooth day/night factor
  let dayFactor = smoothstep(-0.15, 0.35, sunHeight);

  // Horizon glow: Gaussian centered at sunHeight=0, only when sun is near horizon
  let horizonGlow = exp(-sunHeight * sunHeight / 0.04) * smoothstep(-0.6, -0.1, sunHeight);

  return DayInfo(sunHeight, dayFactor, 1.0 - dayFactor, horizonGlow);
}

// --- Sky background with day/night cycle ---
fn renderSky(fragPos: vec2f) -> vec3f {
  let uv = fragPos / uniforms.resolution;
  let aspect = uniforms.resolution.x / uniforms.resolution.y;
  let info = getDayInfo();

  // ===== Base sky gradient =====

  // Night palette: deep navy → dark indigo
  let nightTop = vec3f(0.01, 0.01, 0.05);
  let nightMid = vec3f(0.04, 0.03, 0.10);
  let nightBot = vec3f(0.08, 0.04, 0.16);
  let nightSky = mix(nightTop, mix(nightMid, nightBot, uv.y), uv.y);

  // Day palette: rich blue → soft blue
  let dayTop = vec3f(0.15, 0.38, 0.78);
  let dayMid = vec3f(0.32, 0.55, 0.88);
  let dayBot = vec3f(0.52, 0.70, 0.92);
  let daySky = mix(dayTop, mix(dayMid, dayBot, uv.y), uv.y);

  // Blend night → day
  var sky = mix(nightSky, daySky, info.dayFactor);

  // ===== Dawn/dusk warm horizon =====
  // Warm gradient that hugs the lower sky
  let horizonBand = smoothstep(0.2, 0.85, uv.y); // stronger near bottom
  let warmOrange = vec3f(0.95, 0.50, 0.15);
  let warmPink   = vec3f(0.75, 0.32, 0.42);
  let warmPurple = vec3f(0.45, 0.20, 0.50);
  // Vertical blend: purple at top → pink → orange at horizon
  let warmSky = mix(warmPurple, mix(warmPink, warmOrange, horizonBand), horizonBand);
  sky = mix(sky, warmSky, info.horizonGlow * horizonBand * 0.85);

  // Subtle warm wash across entire sky during transition
  sky += vec3f(0.12, 0.04, 0.02) * info.horizonGlow * 0.3;

  // ===== Sun =====
  let phase = uniforms.dayPhase;

  // Sun arcs left→right during day half
  let sunScreenX = 0.5 + 0.38 * sin((phase - 0.5) * TAU);
  // Sun height on screen (low at horizon, high at noon)
  let sunScreenY = 0.12 + (1.0 - saturate(info.sunHeight)) * 0.52;

  let sunPos = vec2f(sunScreenX, sunScreenY);
  let diff = vec2f((uv.x - sunPos.x) * aspect, uv.y - sunPos.y);
  let sunDist = length(diff);

  let sunVisible = smoothstep(-0.08, 0.12, info.sunHeight);

  // Multi-layer sun glow
  let sunCore  = exp(-sunDist * sunDist * 1200.0) * sunVisible;
  let sunInner = exp(-sunDist * sunDist * 200.0)  * sunVisible * 0.7;
  let sunOuter = exp(-sunDist * sunDist * 30.0)   * sunVisible * 0.25;
  let sunAura  = exp(-sunDist * sunDist * 6.0)    * sunVisible * 0.08;

  // Sun color shifts warmer near horizon
  let sunWarmth = 1.0 - smoothstep(0.0, 0.6, info.sunHeight);
  let sunWhite  = vec3f(1.0, 0.98, 0.92);
  let sunYellow = vec3f(1.0, 0.85, 0.45);
  let sunDeep   = vec3f(1.0, 0.55, 0.15);

  sky += sunWhite * sunCore;
  sky += mix(sunYellow, sunDeep, sunWarmth * 0.6) * sunInner;
  sky += mix(vec3f(1.0, 0.8, 0.5), sunDeep, sunWarmth) * sunOuter;
  sky += vec3f(0.8, 0.45, 0.15) * sunAura * info.horizonGlow;

  // ===== Stars =====
  let starUV = floor(fragPos * 0.25) * 4.0; // quantize to grid
  let starHash = hash2d(starUV);

  if (starHash > 0.993) {
    // Bright star — blue-white
    let twinkle = 0.6 + 0.4 * sin(uniforms.time * 1.5 + starHash * 100.0);
    let brightness = twinkle * (1.0 - uv.y * 0.5) * info.nightFactor;
    sky += vec3f(0.85, 0.9, 1.0) * brightness;
  } else if (starHash > 0.985) {
    // Dim star
    let twinkle = 0.3 + 0.2 * sin(uniforms.time * 2.0 + starHash * 50.0);
    let brightness = twinkle * (1.0 - uv.y * 0.7) * info.nightFactor;
    sky += vec3f(0.4, 0.45, 0.65) * brightness;
  } else if (starHash > 0.982) {
    // Faint warm star
    let twinkle = 0.2 + 0.15 * sin(uniforms.time * 1.2 + starHash * 80.0);
    let brightness = twinkle * (1.0 - uv.y * 0.6) * info.nightFactor;
    sky += vec3f(0.6, 0.5, 0.35) * brightness;
  }

  // ===== Clouds =====
  // Cloud layer 1 — large slow drifting
  let cloudUV1 = vec2f(fragPos.x * 0.003 + uniforms.time * 0.008, fragPos.y * 0.006);
  let cloud1 = cloudFBM(cloudUV1);

  // Cloud layer 2 — smaller, faster, opposite drift
  let cloudUV2 = vec2f(fragPos.x * 0.005 - uniforms.time * 0.012, fragPos.y * 0.008 + 10.0);
  let cloud2 = cloudFBM(cloudUV2);

  // Cloud color shifts with time of day
  let cloudNight  = vec3f(0.06, 0.04, 0.12);
  let cloudDay    = vec3f(0.92, 0.93, 0.96);
  let cloudDawn   = vec3f(0.95, 0.55, 0.25);
  let cloudDusk   = vec3f(0.90, 0.45, 0.30);
  let cloudWarm   = mix(cloudDawn, cloudDusk, step(0.5, uniforms.dayPhase));

  var cloudColor1 = mix(cloudNight, cloudDay, info.dayFactor);
  cloudColor1 = mix(cloudColor1, cloudWarm, info.horizonGlow * 0.8);

  var cloudColor2 = mix(cloudNight * 0.7, cloudDay * 0.85, info.dayFactor);
  cloudColor2 = mix(cloudColor2, cloudWarm * 0.75, info.horizonGlow * 0.6);

  // Clouds are more visible during day, subtler at night
  let cloudOpacity = mix(0.2, 0.4, info.dayFactor);
  sky += cloudColor1 * cloud1 * cloudOpacity;
  sky += cloudColor2 * cloud2 * cloudOpacity * 0.6;

  // Cloud rim lighting from sun during dawn/dusk
  sky += cloudWarm * (cloud1 + cloud2) * info.horizonGlow * 0.15;

  return sky;
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

  // Sky uses raw screen position so it stays fixed behind everything
  let screenPos = input.position.xy;

  if (mat == MAT_AIR) {
    let sky = renderSky(screenPos);
    // Fade sky to dark cave background underground
    let worldGy_air = i32(uniforms.worldYOffset) + gy;
    let depthBelow_air = f32(max(worldGy_air - 80, 0)); // 80 = SURFACE_ROW
    let caveFactor = smoothstep(0.0, 60.0, depthBelow_air);
    let caveColor = vec3f(0.02, 0.02, 0.04);
    let finalSky = mix(sky, caveColor, caveFactor);
    return vec4f(finalSky, 1.0);
  }

  if (mat == MAT_WATER) {
    // Translucent blue water with subtle animation
    let sky = renderSky(screenPos);
    let worldGy_w = i32(uniforms.worldYOffset) + gy;
    let depthBelow_w = f32(max(worldGy_w - 80, 0));
    let caveFactor_w = smoothstep(0.0, 60.0, depthBelow_w);
    let caveColor_w = vec3f(0.02, 0.02, 0.04);
    let bgColor = mix(sky, caveColor_w, caveFactor_w);

    let noise_w = hash(vec2u(u32(gx), u32(gy)));
    let wave = 0.5 + 0.5 * sin(uniforms.time * 2.0 + f32(gx) * 0.3 + f32(gy) * 0.2);
    let waterColor = vec3f(0.15 + noise_w * 0.05, 0.30 + wave * 0.08, 0.55 + wave * 0.1);
    // Blend water over background
    let finalWater = mix(bgColor, waterColor, 0.75);
    return vec4f(finalWater, 1.0);
  }

  // --- Day/night terrain lighting ---
  let info = getDayInfo();

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
    let surfaceHighlight = select(0.0, 0.12 + info.dayFactor * 0.08, isAir(gx, gy - 1));
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
  } else if (mat == MAT_WALL) {
    // Dark indestructible wall material
    color = vec3f(0.12 + noise * 0.03, 0.10 + noise * 0.03, 0.14 + noise * 0.03);
  }

  // Depth-based underground darkening
  let worldGy = i32(uniforms.worldYOffset) + gy;
  let surfaceRow = 80; // matches SURFACE_ROW in generator.ts
  let depthBelow = f32(max(worldGy - surfaceRow, 0));
  // 0 at surface, approaches 1 deep underground (smooth over ~200 rows)
  let depthFactor = smoothstep(0.0, 200.0, depthBelow);

  // Day/night brightness, reduced underground
  let dayLight = mix(0.5, 1.0, info.dayFactor * (1.0 - depthFactor * 0.8));

  // Warm tint during dawn/dusk (fades underground)
  let warmTint = vec3f(0.12, 0.04, 0.0) * info.horizonGlow * (1.0 - depthFactor);

  color = color * dayLight + warmTint * dayLight * 0.3;
  color *= edgeFactor * subVar;

  // Extra darkening deep underground
  color *= mix(1.0, 0.45, depthFactor);

  // Terrain regen blink effect — smooth pulse between terrain and sky
  if (uniforms.regenTimer > 0.0) {
    let t = uniforms.regenTimer; // counts down from ~1.5
    let blinkSpeed = 6.0 + t * 10.0; // faster at start, slower as it settles
    // Smooth sine wave 0→1 instead of hard threshold
    let wave = 0.5 + 0.5 * sin(uniforms.time * blinkSpeed * TAU);
    // Fade the blink intensity as timer expires (terrain becomes solid)
    let blinkStrength = smoothstep(0.0, 0.3, t);
    let skyBlend = wave * blinkStrength;

    let sky = renderSky(screenPos);
    color = mix(color, sky, skyBlend);
    // Subtle bright tint on the terrain portion
    color += vec3f(0.15, 0.25, 0.15) * (1.0 - wave) * blinkStrength;
  }

  return vec4f(color, 1.0);
}
