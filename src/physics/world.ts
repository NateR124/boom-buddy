export interface World {
  width: number;
  height: number;
  spawnPoint: { x: number; y: number };
}

export function createWorld(): World {
  const width = 960;
  const height = 540;

  // Spawn above the surface (SURFACE_ROW=80, each cell=2px → surface at pixel 160)
  const spawnPoint = { x: width / 2, y: 140 };

  return { width, height, spawnPoint };
}
