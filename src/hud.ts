import { CANVAS_W } from './gameConfig';

export interface HudState {
  lives: number;
  depth: number;
  kills: number;
  lastLifeAtKills: number; // track last milestone
}

export function createHudState(): HudState {
  return { lives: 3, depth: 0, kills: 0, lastLifeAtKills: 0 };
}

export interface HudUI {
  update(state: HudState): void;
  destroy(): void;
}

export function createHudUI(): HudUI {
  const style = document.createElement('style');
  style.textContent = `
    #hud-bar {
      position: absolute;
      bottom: 8px;
      right: 8px;
      display: flex;
      gap: 0;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      z-index: 10;
    }
    .hud-cell {
      padding: 4px 8px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.15);
      text-shadow: 1px 1px 0 #000;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .hud-cell:first-child { border-radius: 4px 0 0 4px; }
    .hud-cell:last-child { border-radius: 0 4px 4px 0; }
    .hud-icon { opacity: 0.9; }
    .hud-val { min-width: 28px; text-align: right; }
    .hud-lives { color: #44ff44; }
    .hud-depth { color: #88ccff; }
    .hud-kills { color: #ff4444; }
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'hud-bar';

  function makeCell(cls: string, icon: string): { cell: HTMLDivElement; val: HTMLSpanElement } {
    const cell = document.createElement('div');
    cell.className = `hud-cell ${cls}`;
    const ic = document.createElement('span');
    ic.className = 'hud-icon';
    ic.textContent = icon;
    const val = document.createElement('span');
    val.className = 'hud-val';
    cell.appendChild(ic);
    cell.appendChild(val);
    return { cell, val };
  }

  const lives = makeCell('hud-lives', '\u2764');
  const depth = makeCell('hud-depth', '\u25BC');
  const kills = makeCell('hud-kills', '\u2620');

  bar.appendChild(lives.cell);
  bar.appendChild(depth.cell);
  bar.appendChild(kills.cell);

  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) wrapper.appendChild(bar);

  return {
    update(state: HudState) {
      lives.val.textContent = `${state.lives}`;
      depth.val.textContent = `${state.depth}`;
      kills.val.textContent = `${state.kills}`;
    },
    destroy() {
      bar.remove();
      style.remove();
    },
  };
}

/** 1UP popup that floats above the player */
export interface OneUpPopup {
  show(x: number, screenY: number): void;
  destroy(): void;
}

export function createOneUpPopup(): OneUpPopup {
  const style = document.createElement('style');
  style.textContent = `
    .one-up {
      position: absolute;
      color: #44ff44;
      font-family: monospace;
      font-size: 20px;
      font-weight: bold;
      text-shadow: 0 0 8px rgba(68, 255, 68, 0.8), 1px 1px 0 #000;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      z-index: 20;
      animation: oneup-float 1.5s ease-out forwards;
    }
    @keyframes oneup-float {
      0% { opacity: 1; transform: translateY(0) scale(1); }
      60% { opacity: 1; transform: translateY(-40px) scale(1.2); }
      100% { opacity: 0; transform: translateY(-70px) scale(0.8); }
    }
  `;
  document.head.appendChild(style);

  const wrapper = document.getElementById('game-wrapper');

  return {
    show(x: number, screenY: number) {
      if (!wrapper) return;
      const el = document.createElement('div');
      el.className = 'one-up';
      el.textContent = '1UP';
      el.style.left = `${x - 20}px`;
      el.style.top = `${screenY - 30}px`;
      wrapper.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    },
    destroy() {
      style.remove();
      // Clean up any lingering popups
      if (wrapper) {
        wrapper.querySelectorAll('.one-up').forEach(el => el.remove());
      }
    },
  };
}

/** Check if kills milestone grants a life */
export function checkKillMilestone(state: HudState): boolean {
  const milestone = Math.floor(state.kills / 100);
  const lastMilestone = Math.floor(state.lastLifeAtKills / 100);
  if (milestone > lastMilestone && state.kills >= 100) {
    state.lastLifeAtKills = state.kills;
    state.lives++;
    return true;
  }
  return false;
}
