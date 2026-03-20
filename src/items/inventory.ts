import { ItemId, getItemDef, ITEM_DEFS } from './itemTypes';

export interface Inventory {
  stacks: Map<ItemId, number>;
}

export function createInventory(): Inventory {
  return { stacks: new Map() };
}

export function addItem(inv: Inventory, id: ItemId): void {
  inv.stacks.set(id, (inv.stacks.get(id) || 0) + 1);
}

export function getStacks(inv: Inventory, id: ItemId): number {
  return inv.stacks.get(id) || 0;
}

// ===== Inventory UI =====

export interface InventoryUI {
  update(inv: Inventory): void;
}

export function createInventoryUI(): InventoryUI {
  const style = document.createElement('style');
  style.textContent = `
    #inventory-bar {
      position: absolute;
      bottom: 10px;
      left: 10px;
      display: flex;
      gap: 6px;
      pointer-events: none;
      z-index: 10;
    }
    .inv-slot {
      width: 36px;
      height: 36px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      font-size: 20px;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .inv-slot.empty {
      opacity: 0;
      transform: scale(0.5);
    }
    .inv-slot.visible {
      opacity: 1;
      transform: scale(1);
    }
    .inv-count {
      position: absolute;
      top: -4px;
      right: -4px;
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      font-family: monospace;
      font-size: 9px;
      font-weight: bold;
      min-width: 14px;
      height: 14px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
    }
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'inventory-bar';

  // Create a slot for each possible item type
  const slots: Map<ItemId, { el: HTMLElement; countEl: HTMLElement }> = new Map();

  for (const def of ITEM_DEFS) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot empty';
    slot.style.color = def.color;
    slot.textContent = def.symbol;

    const count = document.createElement('div');
    count.className = 'inv-count';
    count.textContent = '0';
    slot.appendChild(count);

    bar.appendChild(slot);
    slots.set(def.id, { el: slot, countEl: count });
  }

  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) {
    wrapper.appendChild(bar);
  }

  return {
    update(inv: Inventory) {
      for (const def of ITEM_DEFS) {
        const n = inv.stacks.get(def.id) || 0;
        const slot = slots.get(def.id)!;
        if (n > 0) {
          slot.el.className = 'inv-slot visible';
          slot.countEl.textContent = String(n);
        } else {
          slot.el.className = 'inv-slot empty';
        }
      }
    },
  };
}
