/** 10 biome color themes that cycle every 100 depth levels.
 *  Each biome defines: sky/cave backdrop, dirt (light + dark), bat body + wing colors.
 *  All colors are [r, g, b] in 0–1 range. */

export interface BiomeColors {
  cave: [number, number, number];       // cave background (replaces sky underground)
  dirtLight: [number, number, number];  // surface dirt
  dirtDark: [number, number, number];   // deep dirt
  batBody: [number, number, number];    // bat body
  batWing: [number, number, number];    // bat wing
  batEye: [number, number, number];     // bat eye glow
}

export const BIOMES: BiomeColors[] = [
  { // 0: Classic brown caves
    cave: [0.02, 0.02, 0.04],
    dirtLight: [0.50, 0.35, 0.16], dirtDark: [0.28, 0.18, 0.07],
    batBody: [0.30, 0.10, 0.15], batWing: [0.25, 0.05, 0.10], batEye: [1.0, 0.2, 0.1],
  },
  { // 1: Mossy green depths
    cave: [0.01, 0.04, 0.02],
    dirtLight: [0.30, 0.42, 0.18], dirtDark: [0.12, 0.22, 0.08],
    batBody: [0.15, 0.30, 0.10], batWing: [0.10, 0.25, 0.08], batEye: [0.6, 1.0, 0.3],
  },
  { // 2: Crimson inferno
    cave: [0.06, 0.01, 0.01],
    dirtLight: [0.55, 0.20, 0.12], dirtDark: [0.30, 0.08, 0.05],
    batBody: [0.40, 0.08, 0.08], batWing: [0.35, 0.05, 0.05], batEye: [1.0, 0.6, 0.1],
  },
  { // 3: Frozen ice caverns
    cave: [0.02, 0.04, 0.08],
    dirtLight: [0.45, 0.52, 0.60], dirtDark: [0.20, 0.28, 0.38],
    batBody: [0.20, 0.25, 0.40], batWing: [0.15, 0.20, 0.35], batEye: [0.5, 0.8, 1.0],
  },
  { // 4: Amethyst crystal
    cave: [0.04, 0.01, 0.06],
    dirtLight: [0.42, 0.22, 0.50], dirtDark: [0.22, 0.10, 0.30],
    batBody: [0.35, 0.12, 0.40], batWing: [0.28, 0.08, 0.35], batEye: [0.9, 0.4, 1.0],
  },
  { // 5: Sandy desert ruins
    cave: [0.05, 0.04, 0.02],
    dirtLight: [0.62, 0.52, 0.30], dirtDark: [0.38, 0.30, 0.15],
    batBody: [0.45, 0.35, 0.18], batWing: [0.38, 0.28, 0.12], batEye: [1.0, 0.9, 0.3],
  },
  { // 6: Deep ocean abyss
    cave: [0.01, 0.02, 0.06],
    dirtLight: [0.18, 0.32, 0.45], dirtDark: [0.08, 0.15, 0.28],
    batBody: [0.10, 0.20, 0.35], batWing: [0.08, 0.15, 0.30], batEye: [0.3, 0.8, 0.9],
  },
  { // 7: Volcanic obsidian
    cave: [0.03, 0.01, 0.00],
    dirtLight: [0.25, 0.22, 0.20], dirtDark: [0.10, 0.08, 0.08],
    batBody: [0.15, 0.10, 0.10], batWing: [0.10, 0.06, 0.06], batEye: [1.0, 0.4, 0.0],
  },
  { // 8: Toxic swamp
    cave: [0.02, 0.04, 0.01],
    dirtLight: [0.35, 0.45, 0.15], dirtDark: [0.18, 0.25, 0.05],
    batBody: [0.25, 0.35, 0.08], batWing: [0.20, 0.30, 0.05], batEye: [0.4, 1.0, 0.1],
  },
  { // 9: Void / endgame
    cave: [0.01, 0.00, 0.02],
    dirtLight: [0.20, 0.15, 0.25], dirtDark: [0.08, 0.05, 0.12],
    batBody: [0.18, 0.08, 0.25], batWing: [0.12, 0.05, 0.20], batEye: [0.8, 0.2, 1.0],
  },
];

/** Get blended biome colors for a given depth level.
 *  First 50 of every 100 = solid, next 50 = blend to next. */
export function getBiomeColors(depth: number): BiomeColors {
  const biomeIndex = Math.floor(depth / 25) % BIOMES.length;
  const nextIndex = (biomeIndex + 1) % BIOMES.length;
  const withinBiome = depth % 25;

  if (withinBiome < 12) {
    return BIOMES[biomeIndex];
  }

  // Blend from current to next over depth 12–24
  const t = (withinBiome - 12) / 13;
  const a = BIOMES[biomeIndex];
  const b = BIOMES[nextIndex];
  return {
    cave: lerp3(a.cave, b.cave, t),
    dirtLight: lerp3(a.dirtLight, b.dirtLight, t),
    dirtDark: lerp3(a.dirtDark, b.dirtDark, t),
    batBody: lerp3(a.batBody, b.batBody, t),
    batWing: lerp3(a.batWing, b.batWing, t),
    batEye: lerp3(a.batEye, b.batEye, t),
  };
}

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}
