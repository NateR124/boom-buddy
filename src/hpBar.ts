import { Player } from './physics/player';

export interface HpBar {
  update(player: Player, cameraX: number, cameraY: number): void;
}

const FADE_DELAY = 6; // seconds before fading
const FADE_DURATION = 1.5; // seconds to fully fade out

export function createHpBar(): HpBar {
  const style = document.createElement('style');
  style.textContent = `
    #hp-bar-container {
      position: absolute;
      pointer-events: none;
      user-select: none;
      -webkit-user-select: none;
      z-index: 10;
      transition: opacity 0.5s ease;
    }
    #hp-bar-bg {
      width: 40px;
      height: 4px;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      overflow: hidden;
    }
    #hp-bar-fill {
      height: 100%;
      background: #4f4;
      border-radius: 1px;
      transition: width 0.15s ease, background-color 0.3s ease;
    }
  `;
  document.head.appendChild(style);

  const container = document.createElement('div');
  container.id = 'hp-bar-container';
  container.style.opacity = '0';

  const bg = document.createElement('div');
  bg.id = 'hp-bar-bg';

  const fill = document.createElement('div');
  fill.id = 'hp-bar-fill';
  fill.style.width = '100%';

  bg.appendChild(fill);
  container.appendChild(bg);

  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) wrapper.appendChild(container);

  let lastHp = -1;
  let lastDamageTime = -Infinity;
  let gameTimeAcc = 0;

  return {
    update(player: Player, cameraX: number, cameraY: number) {
      gameTimeAcc += 1 / 60; // approximate frame time

      // Detect damage taken
      if (lastHp < 0) lastHp = player.hp;
      if (player.hp < lastHp) {
        lastDamageTime = gameTimeAcc;
      }
      lastHp = player.hp;

      // Position above player
      const screenX = player.x + cameraX;
      const screenY = player.y + cameraY;
      container.style.left = (screenX - 20) + 'px';
      container.style.top = (screenY - 24) + 'px';

      // Fill bar
      const pct = Math.max(0, player.hp / player.maxHp) * 100;
      fill.style.width = pct + '%';

      if (pct > 60) {
        fill.style.backgroundColor = '#4f4';
      } else if (pct > 30) {
        fill.style.backgroundColor = '#fd4';
      } else {
        fill.style.backgroundColor = '#f44';
      }

      // Fade logic
      const timeSinceDamage = gameTimeAcc - lastDamageTime;
      if (timeSinceDamage < FADE_DELAY) {
        container.style.opacity = '1';
      } else {
        const fadeProgress = Math.min((timeSinceDamage - FADE_DELAY) / FADE_DURATION, 1);
        container.style.opacity = String(1 - fadeProgress);
      }
    },
  };
}
