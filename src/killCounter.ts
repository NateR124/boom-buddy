export interface KillCounter {
  update(kills: number): void;
}

export function createKillCounter(): KillCounter {
  const style = document.createElement('style');
  style.textContent = `
    #kill-counter {
      position: absolute;
      top: 10px;
      right: 10px;
      color: #ff4444;
      font-family: monospace;
      font-size: 16px;
      font-weight: bold;
      text-shadow: 0 0 4px rgba(255, 0, 0, 0.5), 1px 1px 0 #000;
      pointer-events: none;
      user-select: none;
      z-index: 10;
    }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'kill-counter';
  el.textContent = '';

  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) wrapper.appendChild(el);

  return {
    update(kills: number) {
      el.textContent = kills > 0 ? `Kills: ${kills}` : '';
    },
  };
}
