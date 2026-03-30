import { CaveConfig, createDefaultConfig } from './terrain/caveConfig';
import { BombConfig, createDefaultBombConfig } from './physics/bombConfig';
import { setBombConfig } from './physics/projectile';
import { HealthConfig, createDefaultHealthConfig } from './physics/healthConfig';
import { setHealthConfig } from './physics/player';
import { ItemConfig, createDefaultItemConfig } from './items/itemConfig';
import { EnemyConfig, createDefaultEnemyConfig } from './enemies/enemyConfig';

// Module-level configs so they can be read by the game loop
let _itemConfig: ItemConfig = createDefaultItemConfig();
export function getItemConfig(): ItemConfig { return _itemConfig; }

let _enemyConfig: EnemyConfig = createDefaultEnemyConfig();
export function getEnemyConfig(): EnemyConfig { return _enemyConfig; }

export interface DebugPanel {
  element: HTMLElement;
  getConfig(): CaveConfig;
  onRestart(cb: () => void): void;
  onItemChange(cb: (itemId: string, delta: number) => void): void;
  onTeleport(cb: (depth: number) => void): void;
}

interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  source: 'cave' | 'bomb' | 'health' | 'item' | 'enemy';
}

interface Category {
  title: string;
  color: string;
  params: ParamDef[];
  collapsed?: boolean;
  children?: Category[];
}

function cave(key: keyof CaveConfig, label: string, min: number, max: number, step: number): ParamDef {
  return { key, label, min, max, step, source: 'cave' };
}

function bomb(key: keyof BombConfig, label: string, min: number, max: number, step: number): ParamDef {
  return { key, label, min, max, step, source: 'bomb' };
}

function health(key: keyof HealthConfig, label: string, min: number, max: number, step: number): ParamDef {
  return { key, label, min, max, step, source: 'health' };
}

function item(key: keyof ItemConfig, label: string, min: number, max: number, step: number): ParamDef {
  return { key, label, min, max, step, source: 'item' };
}

function enemy(key: keyof EnemyConfig, label: string, min: number, max: number, step: number): ParamDef {
  return { key, label, min, max, step, source: 'enemy' };
}

const CATEGORIES: Category[] = [
  {
    title: 'Cave Generation',
    color: '#6af',
    collapsed: true,
    params: [
      cave('seed', 'Seed', 0, 999999, 1),
      cave('wallThickness', 'Wall Thickness', 1, 20, 1),
    ],
    children: [
      {
        title: 'Path Structure',
        color: '#fa6',
        collapsed: true,
        params: [
          cave('minPathLength', 'Min Length', 20, 500, 10),
          cave('maxPathLength', 'Max Length', 50, 800, 10),
          cave('maxActivePaths', 'Max Active Paths', 1, 10, 1),
          cave('trunkBaseWidth', 'Trunk Width', 8, 60, 1),
          cave('driftAmplitude', 'Drift Amplitude', 0, 150, 5),
        ],
      },
      {
        title: 'Branching',
        color: '#af6',
        collapsed: true,
        params: [
          cave('branchCheckInterval', 'Check Interval', 10, 200, 5),
          cave('branchChance', 'Chance', 0, 1, 0.05),
          cave('branchOffsetMin', 'Offset Min', 10, 100, 5),
          cave('branchOffsetMax', 'Offset Max', 20, 150, 5),
        ],
      },
      {
        title: 'Worm',
        color: '#f6a',
        collapsed: true,
        params: [
          cave('wormWidthMin', 'Width Min', 5, 40, 1),
          cave('wormWidthMax', 'Width Max', 10, 60, 1),
        ],
      },
      {
        title: 'Sinusoidal',
        color: '#a6f',
        collapsed: true,
        params: [
          cave('sinusoidalWidthMin', 'Width Min', 5, 40, 1),
          cave('sinusoidalWidthMax', 'Width Max', 10, 60, 1),
        ],
      },
      {
        title: 'Giant Cave',
        color: '#6fa',
        collapsed: true,
        params: [
          cave('giantCaveWidthMin', 'Width Min', 15, 80, 1),
          cave('giantCaveWidthMax', 'Width Max', 20, 120, 1),
        ],
      },
      {
        title: 'Slow Grow',
        color: '#ff6',
        collapsed: true,
        params: [
          cave('slowGrowWidthMin', 'Width Min', 10, 60, 1),
          cave('slowGrowWidthMax', 'Width Max', 15, 80, 1),
        ],
      },
      {
        title: 'Fast Grow / Slow Shrink',
        color: '#f96',
        collapsed: true,
        params: [
          cave('fastGrowWidthMin', 'Width Min', 10, 60, 1),
          cave('fastGrowWidthMax', 'Width Max', 15, 80, 1),
        ],
      },
      {
        title: 'Environment',
        color: '#6cf',
        collapsed: true,
        params: [
          cave('waterThreshold', 'Water Threshold', 0, 1, 0.05),
        ],
      },
    ],
  },
  {
    title: 'Bomb',
    color: '#f55',
    collapsed: true,
    params: [
      bomb('chargeSpeed', 'Charge Speed', 500, 8000, 100),
      bomb('chargeAcceleration', 'Charge Accel', 0, 3000, 50),
      bomb('fallSpeed', 'Fall Speed', 50, 600, 10),
      bomb('fallSpeedSizeDebuff', 'Size Debuff', 0, 5, 0.1),
    ],
  },
  {
    title: 'Health',
    color: '#4f4',
    collapsed: true,
    params: [
      health('maxHp', 'Max HP', 10, 500, 10),
      health('regenPerSecond', 'Regen / sec', 0, 10, 0.1),
      health('bombDamageThreshold', 'Bomb Dmg Threshold', 10, 5000, 50),
      health('bombDamagePerSecond', 'Bomb Dmg / sec', 1, 50, 1),
    ],
  },
  {
    title: 'Items',
    color: '#e8a',
    collapsed: true,
    params: [
      item('dropRate', 'Drop Rate / 100 rows', 0, 20, 0.5),
      item('commonChance', 'Common %', 0, 1, 0.05),
      item('uncommonChance', 'Uncommon %', 0, 1, 0.05),
      item('rareChance', 'Rare %', 0, 1, 0.05),
      item('legendaryChance', 'Legendary %', 0, 1, 0.05),
      item('purpleBallMaxChargeBonus', 'Purple Max Charge+', 0, 2, 0.05),
      item('windBallModifier', 'Wind Modifier', 0, 2, 0.05),
      item('goldBallRadius', 'Gold Radius/stack', 5, 200, 5),
      item('goldBallSpeed', 'Gold Pull Speed/stack', 5, 200, 5),
      item('batDropChance', 'Bat Drop Chance', 0, 1, 0.05),
    ],
  },
  {
    title: 'Enemies',
    color: '#f44',
    collapsed: true,
    params: [
      enemy('spawnInterval', 'Spawn Interval (px)', 50, 500, 10),
      enemy('baseSpawnChance', 'Base Spawn Chance', 0, 1, 0.05),
      enemy('depthChanceBonus', 'Depth Chance/1000px', 0, 0.5, 0.01),
      enemy('minPerSpawn', 'Min Per Spawn', 0, 5, 1),
      enemy('maxPerSpawn', 'Max Per Spawn', 1, 10, 1),
      enemy('batSpeed', 'Bat Speed', 10, 200, 5),
      enemy('batSpeedPerDepth', 'Speed/Depth', 0, 10, 0.5),
      enemy('batBaseHp', 'Bat Base HP', 1, 50, 1),
      enemy('batHpPerDepth', 'HP/Depth', 0, 5, 0.1),
      enemy('spawnBonusPerDepth', 'Spawn+/Depth', 0, 1, 0.05),
    ],
  },
];

export function createDebugPanel(): DebugPanel {
  const caveConfig = createDefaultConfig();
  const bombCfg = createDefaultBombConfig();
  const healthCfg = createDefaultHealthConfig();
  const itemCfg = createDefaultItemConfig();
  const enemyCfg = createDefaultEnemyConfig();
  _itemConfig = itemCfg;
  _enemyConfig = enemyCfg;
  setBombConfig(bombCfg);
  setHealthConfig(healthCfg);

  const debugEnabled = new URLSearchParams(window.location.search).has('debug');

  // If debug mode is off, return a no-op panel with default configs
  if (!debugEnabled) {
    const dummy = document.createElement('div');
    return {
      element: dummy,
      getConfig() { return { ...caveConfig }; },
      onRestart(_cb) { /* no restart button without debug panel */ },
      onItemChange(_cb) {},
      onTeleport(_cb) {},
    };
  }

  let restartCb: (() => void) | null = null;
  let itemChangeCb: ((itemId: string, delta: number) => void) | null = null;
  let teleportCb: ((depth: number) => void) | null = null;

  const panel = document.createElement('div');
  panel.id = 'debug-panel';
  panel.innerHTML = '<div class="debug-title">Cave Generation</div>';

  const style = document.createElement('style');
  style.textContent = `
    #debug-panel {
      position: fixed;
      top: 0;
      left: 0;
      width: 240px;
      height: 100vh;
      background: rgba(0, 0, 0, 0.85);
      color: #ccc;
      font-family: monospace;
      font-size: 11px;
      overflow-y: auto;
      z-index: 100;
      padding: 8px;
      scrollbar-width: thin;
      scrollbar-color: #444 transparent;
      user-select: none;
      -webkit-user-select: none;
    }
    #debug-panel::-webkit-scrollbar { width: 4px; }
    #debug-panel::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
    .debug-title {
      font-size: 13px;
      font-weight: bold;
      color: #fff;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #333;
    }
    .debug-category {
      margin-bottom: 10px;
    }
    .debug-category-header {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 0;
      border-bottom: 1px solid #222;
      user-select: none;
    }
    .debug-category-header.collapsible {
      cursor: pointer;
    }
    .debug-category-header.collapsible:hover {
      filter: brightness(1.3);
    }
    .debug-toggle {
      display: inline-block;
      width: 12px;
      font-size: 9px;
      transition: transform 0.25s ease;
    }
    .debug-toggle.collapsed {
      transform: rotate(-90deg);
    }
    .debug-category-body {
      overflow: hidden;
      transition: max-height 0.3s ease, opacity 0.25s ease;
    }
    .debug-category-body.collapsed {
      max-height: 0 !important;
      opacity: 0;
    }
    .debug-row {
      margin-bottom: 4px;
      padding-left: 4px;
    }
    .debug-row label {
      display: block;
      color: #888;
      margin-bottom: 1px;
      font-size: 10px;
    }
    .debug-row .debug-input-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .debug-row input[type="range"] {
      flex: 1;
      height: 14px;
    }
    .debug-row .debug-val {
      width: 44px;
      text-align: right;
      font-size: 11px;
    }
    .debug-buttons {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #333;
    }
    .debug-btn {
      width: 100%;
      margin-bottom: 4px;
      padding: 6px;
      color: #fff;
      border: none;
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
    }
    .debug-btn:hover { filter: brightness(1.2); }
    .debug-btn-restart { background: #2a6; }
    .debug-btn-random { background: #66a; }
    .debug-btn-copy { background: #a86; }
    .debug-btn-paste { background: #86a; }
    .debug-item-section {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #333;
    }
    .debug-item-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
    }
    .debug-item-name {
      flex: 1;
      font-size: 10px;
      color: #aaa;
    }
    .debug-item-btn {
      padding: 2px 5px;
      font-size: 9px;
      font-family: monospace;
      border: 1px solid #555;
      border-radius: 2px;
      background: #333;
      color: #ddd;
      cursor: pointer;
    }
    .debug-item-btn:hover { background: #555; }
    .debug-item-btn.zero { background: #633; border-color: #855; }
    @keyframes explode {
      0% { transform: scale(1); filter: brightness(1); }
      30% { transform: scale(1.5); filter: brightness(3) hue-rotate(90deg); }
      60% { transform: scale(2); filter: brightness(5) hue-rotate(180deg); opacity: 0.5; }
      100% { transform: scale(3); filter: brightness(0); opacity: 0; }
    }
    .game-explode {
      animation: explode 1s ease-out forwards;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // Prevent any debug panel element from stealing keyboard focus from the game
  panel.addEventListener('mouseup', () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  const inputs: Record<string, { range: HTMLInputElement; val: HTMLSpanElement }> = {};

  function getVal(p: ParamDef): number {
    if (p.source === 'bomb') return (bombCfg as any)[p.key];
    if (p.source === 'health') return (healthCfg as any)[p.key];
    if (p.source === 'item') return (itemCfg as any)[p.key];
    if (p.source === 'enemy') return (enemyCfg as any)[p.key];
    return (caveConfig as any)[p.key];
  }

  function setVal(p: ParamDef, v: number): void {
    if (p.source === 'bomb') {
      (bombCfg as any)[p.key] = v;
      setBombConfig({ ...bombCfg });
    } else if (p.source === 'health') {
      (healthCfg as any)[p.key] = v;
      setHealthConfig({ ...healthCfg });
    } else if (p.source === 'item') {
      (itemCfg as any)[p.key] = v;
      _itemConfig = { ...itemCfg };
    } else if (p.source === 'enemy') {
      (enemyCfg as any)[p.key] = v;
      _enemyConfig = { ...enemyCfg };
    } else {
      (caveConfig as any)[p.key] = v;
    }
  }

  function buildCategory(cat: Category, depth: number): HTMLElement {
    const section = document.createElement('div');
    section.className = 'debug-category';
    if (depth > 0) section.style.paddingLeft = '8px';

    const isCollapsible = !!cat.collapsed;
    const header = document.createElement('div');
    header.className = 'debug-category-header' + (isCollapsible ? ' collapsible' : '');
    header.style.color = cat.color;

    if (isCollapsible) {
      const toggle = document.createElement('span');
      toggle.className = 'debug-toggle collapsed';
      toggle.textContent = '\u25BC';
      header.appendChild(toggle);
      header.appendChild(document.createTextNode(' ' + cat.title));
    } else {
      header.textContent = cat.title;
    }

    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'debug-category-body' + (cat.collapsed ? ' collapsed' : '');

    for (const p of cat.params) {
      const row = document.createElement('div');
      row.className = 'debug-row';

      const label = document.createElement('label');
      label.textContent = p.label;
      row.appendChild(label);

      const inputRow = document.createElement('div');
      inputRow.className = 'debug-input-row';

      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(p.min);
      range.max = String(p.max);
      range.step = String(p.step);
      range.value = String(getVal(p));
      range.style.accentColor = cat.color;

      const val = document.createElement('span');
      val.className = 'debug-val';
      val.style.color = cat.color;
      val.textContent = formatVal(getVal(p), p.step);

      range.addEventListener('input', () => {
        const v = parseFloat(range.value);
        setVal(p, v);
        val.textContent = formatVal(v, p.step);
      });

      inputRow.appendChild(range);
      inputRow.appendChild(val);
      row.appendChild(inputRow);
      body.appendChild(row);

      inputs[p.key] = { range, val };
    }

    // Render children recursively
    if (cat.children) {
      for (const child of cat.children) {
        body.appendChild(buildCategory(child, depth + 1));
      }
    }

    section.appendChild(body);

    if (!cat.collapsed) {
      body.style.maxHeight = '2000px';
      body.style.opacity = '1';
    }

    if (isCollapsible) {
      header.addEventListener('click', () => {
        const isCollapsed = body.classList.contains('collapsed');
        const toggle = header.querySelector(':scope > .debug-toggle')!;
        if (isCollapsed) {
          body.classList.remove('collapsed');
          body.style.maxHeight = body.scrollHeight + 'px';
          body.style.opacity = '1';
          toggle.classList.remove('collapsed');
        } else {
          body.style.maxHeight = body.scrollHeight + 'px';
          body.offsetHeight;
          body.classList.add('collapsed');
          toggle.classList.add('collapsed');
        }
      });
    }

    return section;
  }

  for (const cat of CATEGORIES) {
    panel.appendChild(buildCategory(cat, 0));
  }

  const btnGroup = document.createElement('div');
  btnGroup.className = 'debug-buttons';

  const restartBtn = document.createElement('button');
  restartBtn.className = 'debug-btn debug-btn-restart';
  restartBtn.textContent = 'Restart';
  restartBtn.addEventListener('click', () => {
    if (restartCb) restartCb();
  });
  btnGroup.appendChild(restartBtn);

  const randomizeBtn = document.createElement('button');
  randomizeBtn.className = 'debug-btn debug-btn-random';
  randomizeBtn.textContent = 'Random Seed + Restart';
  randomizeBtn.addEventListener('click', () => {
    caveConfig.seed = Math.floor(Math.random() * 999999);
    const seedInput = inputs['seed'];
    seedInput.range.value = String(caveConfig.seed);
    seedInput.val.textContent = String(caveConfig.seed);
    if (restartCb) restartCb();
  });
  btnGroup.appendChild(randomizeBtn);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'debug-btn debug-btn-copy';
  copyBtn.textContent = 'Copy Config';
  copyBtn.addEventListener('click', () => {
    const allConfig = {
      cave: { ...caveConfig },
      bomb: { ...bombCfg },
      health: { ...healthCfg },
      item: { ...itemCfg },
      enemy: { ...enemyCfg },
    };
    navigator.clipboard.writeText(JSON.stringify(allConfig, null, 2));
  });
  btnGroup.appendChild(copyBtn);

  const pasteBtn = document.createElement('button');
  pasteBtn.className = 'debug-btn debug-btn-paste';
  pasteBtn.textContent = 'Paste Config';
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (!parsed.cave || !parsed.bomb || !parsed.health || !parsed.item || !parsed.enemy) {
        throw new Error('Invalid config');
      }
      // Apply all configs
      Object.assign(caveConfig, parsed.cave);
      Object.assign(bombCfg, parsed.bomb);
      Object.assign(healthCfg, parsed.health);
      Object.assign(itemCfg, parsed.item);
      Object.assign(enemyCfg, parsed.enemy);
      setBombConfig({ ...bombCfg });
      setHealthConfig({ ...healthCfg });
      _itemConfig = { ...itemCfg };
      _enemyConfig = { ...enemyCfg };
      // Update all sliders to reflect new values
      function syncSliders(cats: Category[]) {
        for (const cat of cats) {
          for (const p of cat.params) {
            const inp = inputs[p.key];
            if (inp) {
              const v = getVal(p);
              inp.range.value = String(v);
              inp.val.textContent = formatVal(v, p.step);
            }
          }
          if (cat.children) syncSliders(cat.children);
        }
      }
      syncSliders(CATEGORIES);
      if (restartCb) restartCb();
    } catch {
      // Invalid config — explode the game window
      const canvas = document.getElementById('game-canvas');
      if (canvas) canvas.classList.add('game-explode');
      const wrapper = document.getElementById('game-wrapper');
      if (wrapper) wrapper.classList.add('game-explode');
      setTimeout(() => {
        if (canvas) canvas.classList.remove('game-explode');
        if (wrapper) wrapper.classList.remove('game-explode');
      }, 1200);
    }
  });
  btnGroup.appendChild(pasteBtn);

  panel.appendChild(btnGroup);

  // Item charges section
  const itemSection = document.createElement('div');
  itemSection.className = 'debug-item-section';
  const itemTitle = document.createElement('div');
  itemTitle.className = 'debug-category-header';
  itemTitle.style.color = '#8cf';
  itemTitle.textContent = 'ITEM CHARGES';
  itemSection.appendChild(itemTitle);

  const itemDefs: { id: string; name: string; color: string }[] = [
    { id: 'purple_ball', name: 'Purple', color: '#a040ff' },
    { id: 'wind_ball', name: 'Glow', color: '#ff8c00' },
    { id: 'white_ball', name: 'Wind', color: '#ffffff' },
    { id: 'gold_ball', name: 'Gold', color: '#ffd700' },
  ];

  for (const item of itemDefs) {
    const row = document.createElement('div');
    row.className = 'debug-item-row';
    const name = document.createElement('span');
    name.className = 'debug-item-name';
    name.style.color = item.color;
    name.textContent = item.name;
    row.appendChild(name);

    for (const delta of [1, 5, 10]) {
      const btn = document.createElement('button');
      btn.className = 'debug-item-btn';
      btn.textContent = '+' + delta;
      btn.addEventListener('click', () => { if (itemChangeCb) itemChangeCb(item.id, delta); });
      row.appendChild(btn);
    }

    const zeroBtn = document.createElement('button');
    zeroBtn.className = 'debug-item-btn zero';
    zeroBtn.textContent = '0';
    zeroBtn.addEventListener('click', () => { if (itemChangeCb) itemChangeCb(item.id, -Infinity); });
    row.appendChild(zeroBtn);

    itemSection.appendChild(row);
  }

  panel.appendChild(itemSection);

  // Teleport section
  const teleportSection = document.createElement('div');
  teleportSection.className = 'debug-item-section';
  const teleportTitle = document.createElement('div');
  teleportTitle.className = 'debug-category-header';
  teleportTitle.style.color = '#f88';
  teleportTitle.textContent = 'TELEPORT';
  teleportSection.appendChild(teleportTitle);

  for (const depth of [99, 295]) {
    const btn = document.createElement('button');
    btn.className = 'debug-btn';
    btn.style.background = '#855';
    btn.textContent = `Go to Depth ${depth}`;
    btn.addEventListener('click', () => { if (teleportCb) teleportCb(depth); });
    teleportSection.appendChild(btn);
  }

  panel.appendChild(teleportSection);
  document.body.appendChild(panel);

  return {
    element: panel,
    getConfig() { return { ...caveConfig }; },
    onRestart(cb) { restartCb = cb; },
    onItemChange(cb) { itemChangeCb = cb; },
    onTeleport(cb) { teleportCb = cb; },
  };
}

function formatVal(v: number, step: number): string {
  if (step >= 1) return String(Math.round(v));
  if (step >= 0.1) return v.toFixed(1);
  return v.toFixed(2);
}
