import { Player } from './physics/player';

export interface HpBar {
  update(player: Player): void;
}

export function createHpBar(): HpBar {
  const style = document.createElement('style');
  style.textContent = `
    #hp-bar-container {
      position: absolute;
      top: 10px;
      left: 10px;
      width: 140px;
      pointer-events: none;
      z-index: 10;
    }
    #hp-bar-bg {
      width: 100%;
      height: 10px;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 3px;
      overflow: hidden;
    }
    #hp-bar-fill {
      height: 100%;
      background: #4f4;
      border-radius: 2px;
      transition: width 0.15s ease, background-color 0.3s ease;
    }
    #hp-bar-text {
      font-family: monospace;
      font-size: 9px;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 2px;
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.id = 'hp-bar-container';

  const bg = document.createElement('div');
  bg.id = 'hp-bar-bg';

  const fill = document.createElement('div');
  fill.id = 'hp-bar-fill';
  fill.style.width = '100%';

  const text = document.createElement('div');
  text.id = 'hp-bar-text';
  text.textContent = '100 / 100';

  bg.appendChild(fill);
  container.appendChild(bg);
  container.appendChild(text);

  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) {
    wrapper.appendChild(container);
  }

  return {
    update(player: Player) {
      const pct = Math.max(0, player.hp / player.maxHp) * 100;
      fill.style.width = pct + '%';

      // Color shifts: green > yellow > red
      if (pct > 60) {
        fill.style.backgroundColor = '#4f4';
      } else if (pct > 30) {
        fill.style.backgroundColor = '#fd4';
      } else {
        fill.style.backgroundColor = '#f44';
      }

      text.textContent = Math.ceil(player.hp) + ' / ' + player.maxHp;
    },
  };
}
