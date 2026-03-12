export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface World {
  platforms: Platform[];
  killZone: { left: number; right: number; bottom: number; top: number };
  spawnPoint: { x: number; y: number };
  width: number;
  height: number;
}

export function createWorld(): World {
  const width = 960;
  const height = 540;

  // Smash Bros-style stage layout
  const platforms: Platform[] = [
    // Main ground platform
    { x: 130, y: 380, w: 700, h: 32 },
    // Left floating platform (50px inset from main left edge)
    { x: 180, y: 270, w: 160, h: 16 },
    // Right floating platform (mirrored: 50px inset from main right edge)
    { x: 620, y: 270, w: 160, h: 16 },
    // High center platform
    { x: 370, y: 170, w: 140, h: 16 },
  ];

  const killZone = {
    left: -100,
    right: width + 100,
    bottom: height + 100,
    top: -200,
  };

  const spawnPoint = { x: width / 2, y: 200 };

  return { platforms, killZone, spawnPoint, width, height };
}
