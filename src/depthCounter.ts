import { CANVAS_H } from './gameConfig';

export interface DepthCounter {
  update(playerY: number): void;
  getDepth(): number;
}

export function createDepthCounter(startY: number): DepthCounter {
  let depth = 0;

  return {
    update(playerY: number) {
      const rawDepth = playerY - startY;
      depth = Math.max(0, Math.floor(rawDepth / CANVAS_H));
    },
    getDepth() {
      return depth;
    },
  };
}
