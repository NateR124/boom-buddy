import { CANVAS_H } from './gameConfig';

export interface DepthCounter {
  update(playerY: number): void;
  getDepth(): number;
}

export function createDepthCounter(startY: number): DepthCounter {
  const style = document.createElement('style');
  style.textContent = `
    #depth-counter {
      position: absolute;
      bottom: 10px;
      right: 10px;
      color: #88ccff;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      text-shadow: 0 0 4px rgba(100, 180, 255, 0.5), 1px 1px 0 #000;
      pointer-events: none;
      z-index: 10;
    }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'depth-counter';
  el.textContent = '';

  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) wrapper.appendChild(el);

  let depth = 0;

  return {
    update(playerY: number) {
      const rawDepth = playerY - startY;
      depth = Math.max(0, Math.floor(rawDepth / CANVAS_H));
      el.textContent = `Depth: ${depth}`;
    },
    getDepth() {
      return depth;
    },
  };
}
