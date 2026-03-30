/**
 * Screen-space item pickup animation for bat drops.
 *
 * When a bat drops an item, instead of spawning it in world space (where it
 * can scroll off screen), we spawn an HTML element at the bat's screen
 * position that magnetizes toward the player. On arrival the item is added
 * to inventory. The animation runs in screen space (above the game canvas)
 * so it's never clipped by camera scroll.
 */

import { ItemId, getItemDef } from './itemTypes';
import { ItemConfig } from './itemConfig';
import { createRNG, nextFloat, RNG } from '../terrain/cavePlan';
import { Inventory, addItem } from './inventory';
import { HudState } from '../hud';

type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

function rollRarity(rng: RNG, config: ItemConfig): Rarity {
  const roll = nextFloat(rng);
  if (roll < config.commonChance) return 'common';
  if (roll < config.commonChance + config.uncommonChance) return 'uncommon';
  if (roll < config.commonChance + config.uncommonChance + config.rareChance) return 'rare';
  return 'legendary';
}

function rarityToItem(rarity: Rarity, rng: RNG): ItemId {
  switch (rarity) {
    case 'common': return 'purple_ball';
    case 'uncommon': return nextFloat(rng) < 0.5 ? 'wind_ball' : 'white_ball';
    case 'rare': return 'gold_ball';
    case 'legendary': return nextFloat(rng) < 0.15 ? 'extra_life' : 'smiley_face';
  }
}

/** Roll whether a bat drops an item and return its ID (or null). */
export function rollBatDrop(x: number, y: number, config: ItemConfig): ItemId | null {
  if (Math.random() > config.batDropChance) return null;
  const rng = createRNG(Math.floor(x * 7919 + y * 104729));
  const rarity = rollRarity(rng, config);
  return rarityToItem(rarity, rng);
}

/** Active screen-space pickup animation */
interface FlyingPickup {
  el: HTMLElement;
  id: ItemId;
  x: number;  // current screen-space position
  y: number;
  age: number;
}

export interface DropPickupSystem {
  /**
   * Spawn a screen-space pickup at the given screen coordinates.
   * The item will magnetize toward the player and auto-collect.
   */
  spawn(id: ItemId, screenX: number, screenY: number): void;
  /**
   * Call every frame. Moves pickups toward player screen position
   * and collects them on arrival.
   */
  update(
    dt: number,
    playerScreenX: number,
    playerScreenY: number,
    inventory: Inventory,
    hudState: HudState,
    onOneUp?: (screenX: number, screenY: number) => void,
  ): void;
}

export function createDropPickupSystem(): DropPickupSystem {
  const style = document.createElement('style');
  style.textContent = `
    .drop-pickup {
      position: absolute;
      font-size: 18px;
      pointer-events: none;
      user-select: none;
      z-index: 25;
      filter: brightness(1.3);
      transition: none;
    }
  `;
  document.head.appendChild(style);

  const wrapper = document.getElementById('game-wrapper');
  const active: FlyingPickup[] = [];

  return {
    spawn(id: ItemId, screenX: number, screenY: number) {
      if (!wrapper) return;
      const def = getItemDef(id);
      const el = document.createElement('div');
      el.className = 'drop-pickup';
      el.textContent = def.symbol;
      el.style.color = def.color;
      el.style.textShadow = `0 0 8px ${def.color}, 0 0 16px ${def.color}`;
      el.style.left = `${screenX - 9}px`;
      el.style.top = `${screenY - 9}px`;
      wrapper.appendChild(el);

      active.push({ el, id, x: screenX, y: screenY, age: 0 });
    },

    update(dt, playerScreenX, playerScreenY, inventory, hudState, onOneUp) {
      for (let i = active.length - 1; i >= 0; i--) {
        const p = active[i];
        p.age += dt;

        const dx = playerScreenX - p.x;
        const dy = playerScreenY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Accelerate toward player: slow start, then fast
        const speed = 200 + p.age * 800;
        const step = Math.min(speed * dt, dist);

        if (dist < 10) {
          // Collected — add to inventory
          if (p.id === 'extra_life') {
            hudState.lives++;
            if (onOneUp) onOneUp(playerScreenX, playerScreenY);
          } else {
            addItem(inventory, p.id);
          }
          p.el.remove();
          active[i] = active[active.length - 1];
          active.length--;
          continue;
        }

        // Move toward player
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        p.el.style.left = `${p.x - 9}px`;
        p.el.style.top = `${p.y - 9}px`;

        // Pulse glow as it gets closer
        const glow = Math.min(1, p.age * 2);
        p.el.style.opacity = String(0.6 + glow * 0.4);
      }
    },
  };
}
