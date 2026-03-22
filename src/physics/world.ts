import { CANVAS_W, CANVAS_H } from '../gameConfig';

export interface World {
  width: number;
  height: number;
  spawnPoint: { x: number; y: number };
}

export function createWorld(): World {
  const width = CANVAS_W;
  const height = CANVAS_H;

  // Spawn above the surface (SURFACE_ROW=80, each cell=2px → surface at pixel 160)
  const spawnPoint = { x: width / 2, y: 140 };

  return { width, height, spawnPoint };
}
