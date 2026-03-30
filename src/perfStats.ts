/**
 * Lightweight performance stats overlay.
 * Shows FPS, frame time, and game entity counts.
 * Toggle visibility with F3.
 */

export interface PerfStats {
  /** Call once per frame with current entity counts */
  update(counts: {
    enemies: number;
    projectiles: number;
    damageNumbers: number;
    items: number;
    vertOverflow: boolean;
  }): void;
  element: HTMLElement;
}

export function createPerfStats(): PerfStats {
  const el = document.createElement('div');
  el.id = 'perf-stats';
  el.style.cssText = [
    'position:absolute',
    'bottom:36px',
    'right:4px',
    'font-family:monospace',
    'font-size:10px',
    'line-height:1.4',
    'color:#8f8',
    'background:rgba(0,0,0,0.55)',
    'padding:3px 6px',
    'border-radius:3px',
    'pointer-events:none',
    'z-index:20',
    'white-space:pre',
    'display:none',
  ].join(';');

  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) wrapper.appendChild(el);

  // Toggle with F3
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      e.preventDefault();
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
  });

  // FPS tracking
  let frames = 0;
  let lastFpsTime = performance.now();
  let fps = 0;
  let frameTimeMs = 0;
  let lastFrameTime = performance.now();

  // Memory (if available)
  const perfMemory = (performance as any).memory;

  return {
    element: el,
    update(counts) {
      const now = performance.now();

      // Frame time
      frameTimeMs = now - lastFrameTime;
      lastFrameTime = now;

      // FPS (sampled every 500ms)
      frames++;
      const elapsed = now - lastFpsTime;
      if (elapsed >= 500) {
        fps = Math.round((frames / elapsed) * 1000);
        frames = 0;
        lastFpsTime = now;
      }

      if (el.style.display === 'none') return;

      let text = `FPS: ${fps}  (${frameTimeMs.toFixed(1)}ms)`;
      text += `\nEnemies: ${counts.enemies}`;
      text += `\nProjectiles: ${counts.projectiles}`;
      text += `\nDmg#: ${counts.damageNumbers}`;
      text += `\nItems: ${counts.items}`;
      if (counts.vertOverflow) {
        text += `\n⚠ VERT OVERFLOW`;
      }

      if (perfMemory) {
        const mb = (perfMemory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
        text += `\nHeap: ${mb}MB`;
      }

      el.textContent = text;
    },
  };
}
