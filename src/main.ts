import { initGpu } from './renderer/gpu';
import { initInput, getInput, clearFrameInput } from './input';
import { createWorld } from './physics/world';
import { createPlayer, updatePlayer, Player } from './physics/player';
import { createPlayerRenderer, renderPlayer } from './renderer/playerRenderer';
import { createParticleSystem, uploadParticleRange, uploadAttractors, updateParticlesGPU, renderParticles, AttractorDef } from './renderer/particleRenderer';
import { createProjectileRenderer, renderProjectiles } from './renderer/projectileRenderer';
import { createTerrainRenderer, uploadTerrainGrid, renderTerrain } from './renderer/terrainRenderer';
import { createTerrainGrid, shiftGridUp, stepAutomata, CELL_SCALE, GRID_H, TerrainGrid, carveExplosion } from './terrain/grid';
import { generateRows } from './terrain/generator';
import { createCavePlan } from './terrain/cavePlan';
import { createDebugPanel } from './debugPanel';
import { carveDigArea, getDigInterval } from './dig';
import { createHpBar } from './hpBar';
import { createHudState, createHudUI, createOneUpPopup, checkKillMilestone, HudState } from './hud';
import { damagePlayer, getHealthConfig } from './physics/player';
import { createItemSpawner, spawnItemsForRows, collectItems, cleanupItems, trySpawnDrop } from './items/itemSpawner';
import { createInventory, addItem, getStacks, createInventoryUI, Inventory } from './items/inventory';
import { getItemConfig, getEnemyConfig } from './debugPanel';
import {
  emitChargeAura, emitProjectileTrail, emitImpactExplosion,
  emitRespawnBurst, emitSpiritBombOrbit, emitTerrainDebris,
} from './particles/emitter';
import {
  Projectile, ChargeState, createChargeState,
  getChargeNormalized,
  fireSpiritBomb, updateProjectiles,
  getSpiritBombRadius, getSpiritBombCenter,
  getCraterRadius, getMaxChargeTime, getPurpleOvercharge,
} from './physics/projectile';
import { InputState } from './input';
import { createCamera, addShake, updateShake, updateCameraScroll } from './camera';
import {
  createEnemySystem, spawnEnemies, updateEnemies,
  damageEnemiesInRadius, knockbackEnemiesInRadius,
  checkEnemyPlayerCollision, cleanupEnemies,
} from './enemies/enemySystem';
import { CANVAS_W, CANVAS_H } from './gameConfig';
import { createDepthCounter } from './depthCounter';
// HUD is imported above (hud.ts)
import { getBiomeColors } from './biomeColors';
import {
  createWinState, checkWinTrigger, updateWinSequence,
  createWinOverlay,
} from './winSequence';

/** Get damage number color based on projectile overcharge (0=orange, 5=deep purple) */
function getBombDmgColor(overcharge: number): string {
  const t = Math.min(overcharge / 5, 1);
  const r = Math.round(255 * (1 - t * 0.37));       // 255 → 160
  const g = Math.round(140 * (1 - t));               // 140 → 0
  const b = Math.round(50 + t * 205);                // 50 → 255
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

const FIXED_DT = 1 / 60;
const MAX_PARTICLES = 4096;
const DAY_CYCLE = 30;

const SHIFT_THRESHOLD = 40;
const SHIFT_AMOUNT = 30;

async function main() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const fallback = document.getElementById('fallback') as HTMLElement;

  const gpuResult = await initGpu(canvas);
  if (!gpuResult) {
    canvas.style.display = 'none';
    fallback.style.display = 'block';
    return;
  }
  const gpu = gpuResult;

  initInput(canvas);

  const debugPanel = createDebugPanel();
  const hpBar = createHpBar();
  const inventoryUI = createInventoryUI();
  const hudUI = createHudUI();
  const oneUpPopup = createOneUpPopup();

  // Pause overlay
  const pauseOverlay = document.createElement('div');
  pauseOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);display:none;flex-direction:column;align-items:center;justify-content:center;z-index:50';

  const pauseStyle = document.createElement('style');
  pauseStyle.textContent = `
    .pause-title { color:#fff;font-family:monospace;font-size:32px;font-weight:bold;text-shadow:0 0 10px rgba(255,255,255,0.5);margin-bottom:36px }
    .orb-row { display:flex;gap:6px;margin-bottom:24px }
    .orb-slot { display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 8px;border-radius:6px;cursor:pointer;pointer-events:auto;transition:background 0.15s,box-shadow 0.15s }
    .orb-slot:hover { background:rgba(255,255,255,0.08) }
    .orb-slot.selected { background:rgba(255,255,255,0.12);box-shadow:0 0 12px rgba(255,255,255,0.2) }
    .orb-icon { font-size:22px;line-height:1 }
    .orb-label { font-family:monospace;font-size:10px;color:#999;white-space:nowrap }
    .orb-detail { display:flex;align-items:center;gap:14px;font-family:monospace;width:280px;min-height:60px }
    .orb-detail-icon { font-size:36px;flex-shrink:0;width:36px;text-align:center }
    .orb-detail-text { font-size:13px;color:#ccc;line-height:1.5;text-align:left }
  `;
  document.head.appendChild(pauseStyle);

  interface OrbInfo {
    symbol: string;
    color: string;
    glow: string;
    shortLabel: string;
    longDesc: string; // HTML
    highlightColor: string;
  }
  const orbs: OrbInfo[] = [
    { symbol: '\u25CF', color: '#a040ff', glow: 'rgba(160,64,255,0.6)', shortLabel: '++Charge', longDesc: 'Increase <hl>max charge</hl> and slightly increases <hl>charge rate</hl>', highlightColor: '#c880ff' },
    { symbol: '\u25CE', color: '#ff8c00', glow: 'rgba(255,140,0,0.6)', shortLabel: '+Passive', longDesc: 'Increases <hl>passive damage while charging</hl> to enemies and terrain', highlightColor: '#ffb840' },
    { symbol: '\u25CB', color: '#ffffff', glow: 'rgba(255,255,255,0.6)', shortLabel: '+Knockback', longDesc: 'Increases <hl>knockback</hl> on yourself and enemies', highlightColor: '#ffffff' },
    { symbol: '\u25C9', color: '#ffd700', glow: 'rgba(255,215,0,0.6)', shortLabel: '+Magnetism', longDesc: '<hl>Attracts other powerups</hl> to you', highlightColor: '#ffe44d' },
    { symbol: '\u2764', color: '#44ff44', glow: 'rgba(68,255,68,0.6)', shortLabel: '+1UP', longDesc: 'Adds <hl>lives</hl>', highlightColor: '#66ff66' },
  ];

  const pauseTitle = document.createElement('div');
  pauseTitle.className = 'pause-title';
  pauseTitle.textContent = 'PAUSED';
  pauseOverlay.appendChild(pauseTitle);

  const orbRow = document.createElement('div');
  orbRow.className = 'orb-row';
  const orbSlots: HTMLDivElement[] = [];
  for (const orb of orbs) {
    const slot = document.createElement('div');
    slot.className = 'orb-slot';
    slot.innerHTML = `<span class="orb-icon" style="color:${orb.color};text-shadow:0 0 6px ${orb.glow}">${orb.symbol}</span><span class="orb-label">${orb.shortLabel}</span>`;
    orbRow.appendChild(slot);
    orbSlots.push(slot);
  }
  pauseOverlay.appendChild(orbRow);

  const detailBox = document.createElement('div');
  detailBox.className = 'orb-detail';
  pauseOverlay.appendChild(detailBox);

  let pauseSelectedOrb = 0;

  function updatePauseSelection() {
    orbSlots.forEach((s, i) => s.classList.toggle('selected', i === pauseSelectedOrb));
    const orb = orbs[pauseSelectedOrb];
    const desc = orb.longDesc.replace(/<hl>/g, `<span style="color:${orb.highlightColor};font-weight:bold">`).replace(/<\/hl>/g, '</span>');
    detailBox.innerHTML = `<span class="orb-detail-icon" style="color:${orb.color};text-shadow:0 0 10px ${orb.glow}">${orb.symbol}</span><span class="orb-detail-text">${desc}</span>`;
  }
  updatePauseSelection();

  // Click to select
  orbSlots.forEach((slot, i) => {
    slot.addEventListener('click', () => { pauseSelectedOrb = i; updatePauseSelection(); });
  });

  const gameWrapper = document.getElementById('game-wrapper');
  if (gameWrapper) gameWrapper.appendChild(pauseOverlay);

  // Vertex overflow warning
  const overflowWarn = document.createElement('div');
  overflowWarn.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);color:#ff4;font-family:monospace;font-size:12px;pointer-events:none;z-index:10;opacity:0;transition:opacity 0.3s';
  overflowWarn.textContent = 'GPU vertex limit reached — some visuals clipped';
  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) wrapper.appendChild(overflowWarn);

  // Renderers are GPU resources that persist across restarts
  const terrainRenderData = createTerrainRenderer(gpu);
  const playerRendererData = createPlayerRenderer(gpu);
  const particleSys = createParticleSystem(gpu, MAX_PARTICLES);
  const projRenderer = createProjectileRenderer(gpu);

  let animFrameId = 0;

  function startSession() {
    // Cancel any existing loop
    if (animFrameId) cancelAnimationFrame(animFrameId);

    const config = debugPanel.getConfig();
    const world = createWorld();
    const player = createPlayer(world.spawnPoint.x, world.spawnPoint.y);
    const charge = createChargeState();
    const projectiles: Projectile[] = [];
    const camera = createCamera();
    const enemySys = createEnemySystem();
    let digTimer = 0;

    // Blast ring visuals
    interface BlastRing { x: number; y: number; maxRadius: number; age: number; strength: number; }
    const blastRings: BlastRing[] = [];
    const startY = player.y;
    const depthCounter = createDepthCounter(startY);
    const hudState = createHudState();
    let hintsFaded = false;
    const winState = createWinState();
    const winOverlay = createWinOverlay();

    const terrain = createTerrainGrid();
    const cavePlan = createCavePlan(config);
    generateRows(terrain, 0, GRID_H, cavePlan);

    const itemSpawner = createItemSpawner();
    const inventory = createInventory();

    // Wire debug panel item charge buttons to inventory
    debugPanel.onItemChange((itemId, delta) => {
      if (delta === -Infinity) {
        inventory.stacks.set(itemId as any, 0);
      } else {
        const current = inventory.stacks.get(itemId as any) || 0;
        inventory.stacks.set(itemId as any, Math.max(0, current + delta));
      }
    });

    // Spawn initial items
    spawnItemsForRows(itemSpawner, 80, GRID_H, cavePlan, getItemConfig(), config.seed);

    // Wire teleport
    debugPanel.onTeleport((depth) => {
      const targetY = startY + depth * CANVAS_H;
      player.x = world.width / 2;
      player.y = targetY;
      player.vx = 0;
      player.vy = 0;
      camera.scrollY = targetY - CANVAS_H * 0.35;
      camera.maxScrollY = camera.scrollY;
      // Regenerate terrain at new position
      const targetGy = Math.floor(targetY / CELL_SCALE);
      terrain.worldYOffset = Math.max(0, targetGy - Math.floor(GRID_H / 2));
      terrain.cells.fill(0);
      generateRows(terrain, terrain.worldYOffset, GRID_H, cavePlan);
    });

    const cursor = { value: 0 };

    // Clear particle buffer
    particleSys.cpuData.fill(0);
    gpu.device.queue.writeBuffer(particleSys.gpuBuffer, 0, particleSys.cpuData.buffer);

    let accumulator = 0;
    let lastTime = performance.now();
    let gameTime = 0;
    let frameCursorStart = 0;
    let paused = false;
    let prevPauseLeft = false;
    let prevPauseRight = false;
    let aimDirX = 0;
    let aimDirY = -1;

    function tick(input: InputState, dt: number) {
      // Win sequence
      const wasPlaying = winState.phase === 'playing';
      checkWinTrigger(winState, depthCounter.getDepth());
      // On first trigger, kill all enemies
      if (wasPlaying && winState.phase !== 'playing') {
        for (const e of enemySys.enemies) e.alive = false;
      }
      if (winState.phase !== 'playing') {
        const shouldReset = updateWinSequence(winState, dt);
        if (shouldReset) {
          winOverlay.destroy();
          startSession();
          return;
        }
        // Don't return — let the rest of tick run so player can still move
      }

      const prevDead = player.dead;
      updatePlayer(player, input, world, terrain, dt, camera.scrollY, camera.maxScrollY);

      if (prevDead && !player.dead) {
        emitRespawnBurst(particleSys.cpuData, MAX_PARTICLES, cursor, player.x, player.y);
      }
      if (!prevDead && player.dead) {
        emitRespawnBurst(particleSys.cpuData, MAX_PARTICLES, cursor, player.x, player.y);
        if (hudState.lives > 0) {
          hudState.lives--;
        }
      }

      if (player.dead) return;

      // Fade key hints after dropping 100 pixels
      if (!hintsFaded && player.y - startY > 100) {
        hintsFaded = true;
        (window as any)._fadeAllHints?.();
      }

      updateCameraScroll(camera, player.y, gpu.canvas.height, dt);

      const screenBottomWorldGy = Math.floor((camera.scrollY + gpu.canvas.height) / CELL_SCALE);
      const bufferBottomWorldGy = terrain.worldYOffset + GRID_H;
      const rowsAhead = bufferBottomWorldGy - screenBottomWorldGy;

      if (rowsAhead < SHIFT_THRESHOLD) {
        const oldBottom = bufferBottomWorldGy;
        shiftGridUp(terrain, SHIFT_AMOUNT);
        generateRows(terrain, oldBottom, SHIFT_AMOUNT, cavePlan);
        spawnItemsForRows(itemSpawner, oldBottom, oldBottom + SHIFT_AMOUNT, cavePlan, getItemConfig(), config.seed);
      }

      for (let i = 0; i < 3; i++) {
        stepAutomata(terrain);
      }

      // Compute aim direction from mouse (screen coords → relative to player screen pos)
      const psx = player.x + camera.shakeX;
      const psy = player.y - camera.scrollY + camera.shakeY;
      const arx = input.mouseX - psx;
      const ary = input.mouseY - psy;
      const arl = Math.sqrt(arx * arx + ary * ary);
      aimDirX = arl > 1 ? arx / arl : 0;
      aimDirY = arl > 1 ? ary / arl : -1;

      updateCharge(input, player, charge, projectiles, dt, inventory, terrain, camera.scrollY, aimDirX, aimDirY);

      // Passive dig: charging bomb slowly carves terrain in aim direction
      if (charge.charging) {
        const glowStacks = getStacks(inventory, 'wind_ball');
        const digInt = getDigInterval(glowStacks);
        digTimer += dt;
        if (digTimer >= digInt) {
          digTimer -= digInt;
          carveDigArea(player, terrain, aimDirX, aimDirY, glowStacks);
        }
      } else {
        digTimer = 0;
      }

      // Wind: damage enemies near charging bomb (25% chance per tick, 4x damage)
      if (charge.charging && charge.spiritRadius > 0 && Math.random() < 0.25) {
        const wbc = getSpiritBombCenter(player.x, player.y, charge.spiritRadius, aimDirX, aimDirY);
        const wDist = Math.sqrt((wbc.x - player.x) ** 2 + (wbc.y - player.y) ** 2) + charge.spiritRadius;
        const ws = getStacks(inventory, 'wind_ball');
        const icfg = getItemConfig();
        const wBonus = charge.spiritRadius * Math.sqrt(ws) * icfg.windBallModifier;
        const wr = wDist + wBonus;
        if (wr > 2) {
          const windDmg = damageEnemiesInRadius(enemySys, wbc.x, wbc.y, wr, 4, '#ffcc66');
          for (const pos of windDmg.killedPositions) {
            trySpawnDrop(itemSpawner, pos.x, pos.y, getItemConfig());
          }
        }
      }

      if (charge.charging) {
        const norm = getChargeNormalized(charge.chargeTime);
        emitChargeAura(particleSys.cpuData, MAX_PARTICLES, cursor, player.x, player.y, norm);

        if (charge.spiritRadius > 3) {
          const bc = getSpiritBombCenter(player.x, player.y, charge.spiritRadius, aimDirX, aimDirY);
          emitSpiritBombOrbit(
            particleSys.cpuData, MAX_PARTICLES, cursor,
            bc.x, bc.y, charge.spiritRadius,
          );
        }
      }

      const hits = updateProjectiles(projectiles, world, terrain, dt, camera.scrollY);

      for (const p of projectiles) {
        if (!p.alive) continue;
        emitProjectileTrail(particleSys.cpuData, MAX_PARTICLES, cursor, p.x, p.y, p.level);
      }

      // Wind stacks boost blast force, radius, and knockback
      const windStacks = getStacks(inventory, 'white_ball');
      const windMult = 0.3 + windStacks * 0.01;

      // Helper: apply explosion knockback to player + enemies
      function blastAll(ex: number, ey: number, power: number, radius: number) {
        // Blast radius has a generous minimum so player always feels it nearby
        const blastRadius = Math.max(radius * 3, radius * 2 * windMult);
        // Power uses sqrt so big bombs don't blast disproportionately harder
        const baseForce = (1500 + Math.sqrt(power) * 500) * windMult;

        // Player knockback
        const pdx = player.x - ex;
        const pdy = player.y - ey;
        const dist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (dist < blastRadius && dist > 1) {
          const falloff = 1 - dist / blastRadius;
          const force = baseForce * falloff;
          player.vx += (pdx / dist) * force;
          player.vy += (pdy / dist) * force;
        }

        // Bat knockback
        knockbackEnemiesInRadius(enemySys, ex, ey, blastRadius, baseForce);

        // Blast ring visual — stronger wind = lower opacity
        const strength = Math.min(windStacks / 10, 1);
        blastRings.push({ x: ex, y: ey, maxRadius: blastRadius, age: 0, strength });
      }

      // Helper: full detonation effect for a projectile
      function detonateProj(proj: Projectile) {
        proj.alive = false;
        const craterR = getCraterRadius(proj);
        const carve = carveExplosion(terrain, proj.x, proj.y, craterR);
        emitImpactExplosion(particleSys.cpuData, MAX_PARTICLES, cursor, proj.x, proj.y, proj.power);
        if (carve.count > 0) {
          emitTerrainDebris(particleSys.cpuData, MAX_PARTICLES, cursor, proj.x, proj.y, carve.count);
        }
        addShake(camera, 4 + proj.power * 12, 0.2 + proj.power * 0.3);
        blastAll(proj.x, proj.y, proj.power, craterR);
        const explosionDmg = Math.max(6, Math.round(proj.power * 30));
        const bombColor = getBombDmgColor(proj.purpleOvercharge * 5);
        const explResult = damageEnemiesInRadius(enemySys, proj.x, proj.y, craterR, explosionDmg, bombColor);
        for (const pos of explResult.killedPositions) {
          trySpawnDrop(itemSpawner, pos.x, pos.y, getItemConfig());
        }
      }

      // Terrain hits
      for (const { proj } of hits) {
        detonateProj(proj);
      }

      // Flying projectile contacts enemy → detonate
      for (const proj of projectiles) {
        if (!proj.alive) continue;
        const contactDmg = Math.max(6, Math.round(proj.power * 20));
        const contactColor = getBombDmgColor(proj.purpleOvercharge * 5);
        const contactResult = damageEnemiesInRadius(enemySys, proj.x, proj.y, proj.radius, contactDmg, contactColor);
        for (const pos of contactResult.killedPositions) {
          trySpawnDrop(itemSpawner, pos.x, pos.y, getItemConfig());
        }
        if (contactResult.hit > 0) {
          detonateProj(proj);
        }
      }

      // Enemy spawning and movement
      spawnEnemies(enemySys, camera.scrollY, gpu.canvas.width, gpu.canvas.height, getEnemyConfig());
      updateEnemies(enemySys, player.x, player.y, dt, getEnemyConfig());

      // Enemy-player collision (damage player)
      const enemyCollision = checkEnemyPlayerCollision(enemySys, player.x, player.y, player.w, player.h);
      if (enemyCollision.hits > 0) {
        damagePlayer(player, enemyCollision.hits * 10);
        for (const pos of enemyCollision.killedPositions) {
          trySpawnDrop(itemSpawner, pos.x, pos.y, getItemConfig());
        }
      }

      cleanupEnemies(enemySys, camera.scrollY, gpu.canvas.height);

      updateShake(camera, dt);

      // Age blast rings
      for (let i = blastRings.length - 1; i >= 0; i--) {
        blastRings[i].age += dt;
        if (blastRings[i].age >= 0.5) blastRings.splice(i, 1);
      }

      // Gold Ball magnetism: pull nearby items toward the player
      const goldStacks = getStacks(inventory, 'gold_ball');
      if (goldStacks > 0) {
        const icfg = getItemConfig();
        const magRadius = icfg.goldBallRadius * goldStacks;
        const magSpeed = icfg.goldBallSpeed * goldStacks;
        for (const wi of itemSpawner.items) {
          if (!wi.alive) continue;
          const dx = player.x - wi.x;
          const dy = player.y - wi.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < magRadius && dist > 1) {
            const pull = magSpeed * dt / dist;
            wi.x += dx * pull;
            wi.y += dy * pull;
          }
        }
      }

      // Item collection
      const collected = collectItems(itemSpawner, player.x, player.y, player.w, player.h);
      for (const id of collected) {
        if (id === 'extra_life') {
          hudState.lives++;
          const sx2 = player.x - gpu.canvas.width / 2;
          oneUpPopup.show(player.x - sx2, player.y - camera.scrollY);
        } else {
          addItem(inventory, id);
        }
      }
      cleanupItems(itemSpawner, camera.scrollY);

      for (let i = projectiles.length - 1; i >= 0; i--) {
        if (!projectiles[i].alive) projectiles.splice(i, 1);
      }
    }

    function loop(now: number) {
      const frameTime = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const input = getInput();

      if (input.pausePressed) {
        paused = !paused;
        pauseOverlay.style.display = paused ? 'flex' : 'none';
        clearFrameInput();
        animFrameId = requestAnimationFrame(loop);
        return;
      }

      if (paused) {
        // A/D to navigate orb selection while paused
        if (input.clickPressed) {
          // Check if click hit an orb slot (handled by DOM click listeners)
        }
        if (input.left && !prevPauseLeft) {
          pauseSelectedOrb = (pauseSelectedOrb - 1 + orbs.length) % orbs.length;
          updatePauseSelection();
        }
        if (input.right && !prevPauseRight) {
          pauseSelectedOrb = (pauseSelectedOrb + 1) % orbs.length;
          updatePauseSelection();
        }
        prevPauseLeft = input.left;
        prevPauseRight = input.right;
        clearFrameInput();
        animFrameId = requestAnimationFrame(loop);
        return;
      }
      prevPauseLeft = false;
      prevPauseRight = false;

      accumulator += frameTime;
      let ticked = false;
      frameCursorStart = cursor.value;

      while (accumulator >= FIXED_DT) {
        tick(input, FIXED_DT);
        accumulator -= FIXED_DT;
        gameTime += FIXED_DT;
        ticked = true;
      }
      if (ticked) clearFrameInput();

      const sx = camera.shakeX;
      const sy = -camera.scrollY + camera.shakeY;

      const terrainCameraX = camera.shakeX;
      const terrainCameraY = -camera.scrollY + terrain.worldYOffset * CELL_SCALE + camera.shakeY;

      if (cursor.value > frameCursorStart) {
        uploadParticleRange(gpu.device, particleSys, frameCursorStart, cursor.value);
      }

      const attractors: AttractorDef[] = [];
      if (charge.charging && charge.spiritRadius > 3) {
        const norm = getChargeNormalized(charge.chargeTime);
        const bc = getSpiritBombCenter(player.x, player.y, charge.spiritRadius, aimDirX, aimDirY);
        attractors.push({
          x: bc.x,
          y: bc.y,
          strength: 400 + norm * 600,
          radius: Math.max(80, charge.spiritRadius * 2.5),
          tangent: 250 + norm * 400,
        });
      }
      uploadAttractors(gpu.device, particleSys, attractors);

      const commandEncoder = gpu.device.createCommandEncoder();

      updateParticlesGPU(commandEncoder, particleSys, gpu.device, FIXED_DT, gameTime);

      const textureView = gpu.context.getCurrentTexture().createView();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0.02, g: 0.02, b: 0.08, a: 1.0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });

      const dayPhase = (gameTime % DAY_CYCLE) / DAY_CYCLE;
      const biome = getBiomeColors(depthCounter.getDepth());
      uploadTerrainGrid(gpu.device, terrainRenderData, terrain, gameTime, gpu.canvas.width, gpu.canvas.height, terrainCameraX, terrainCameraY, dayPhase, 0, terrain.worldYOffset, biome);
      renderTerrain(pass, terrainRenderData);

      renderPlayer(pass, playerRendererData, gpu.device, player, gameTime, charge.charging, sx, sy, aimDirX, aimDirY);

      const spiritR = charge.charging ? charge.spiritRadius : 0;
      const spiritCenter = spiritR > 0
        ? getSpiritBombCenter(player.x, player.y, spiritR, aimDirX, aimDirY)
        : { x: player.x, y: player.y };
      const spiritX = spiritCenter.x;
      const spiritY = spiritCenter.y;
      const chargeOvercharge = charge.charging
        ? getPurpleOvercharge(charge.chargeTime, getStacks(inventory, 'purple_ball'), getItemConfig().purpleBallMaxChargeBonus)
        : 0;
      const digLightData = null;
      const chargeGlowStacks = getStacks(inventory, 'wind_ball');
      const vertOverflow = renderProjectiles(pass, projRenderer, gpu.device, projectiles, spiritX, spiritY, spiritR, gameTime, sx, sy, itemSpawner.items, chargeOvercharge, chargeGlowStacks, enemySys, biome, digLightData, blastRings, winState);
      overflowWarn.style.opacity = vertOverflow ? '1' : '0';

      updateParticleUniforms(gpu.device, particleSys, gpu.canvas.width, gpu.canvas.height, sx, sy);
      renderParticles(pass, particleSys);

      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);

      // Update HTML overlays
      hpBar.update(player, sx, sy);
      inventoryUI.update(inventory);
      depthCounter.update(player.y);

      // Update HUD state
      hudState.depth = depthCounter.getDepth();
      hudState.kills = enemySys.kills;
      // Check kill milestone (every 100 kills = 1UP)
      if (checkKillMilestone(hudState)) {
        oneUpPopup.show(player.x - sx, player.y - sy);
      }
      hudUI.update(hudState);
      winOverlay.update(winState);

      animFrameId = requestAnimationFrame(loop);
    }

    animFrameId = requestAnimationFrame(loop);
  }

  debugPanel.onRestart(() => startSession());
  startSession();
}

function updateCharge(input: InputState, player: Player, charge: ChargeState, projectiles: Projectile[], dt: number, inventory: Inventory, _terrain: TerrainGrid, cameraScrollY: number, aimDirX: number, aimDirY: number) {
  const purpleStacks = getStacks(inventory, 'purple_ball');
  const itemCfg = getItemConfig();
  const maxCharge = getMaxChargeTime(purpleStacks, itemCfg.purpleBallMaxChargeBonus);

  // Hold M1 to charge, release to fire
  if (input.mouseHeld && !charge.charging) {
    // Start charging
    charge.charging = true;
    charge.chargeTime = 0;
    charge.chargeType = 'spirit';
    charge.spiritRadius = 0;
  } else if (input.mouseReleased && charge.charging) {
    // Release — throw toward mouse position
    if (charge.chargeTime > 0.05) {
      const worldTargetX = input.mouseX;
      const worldTargetY = input.mouseY + cameraScrollY;
      const windStacks = getStacks(inventory, 'wind_ball');
      const overcharge = getPurpleOvercharge(charge.chargeTime, purpleStacks, itemCfg.purpleBallMaxChargeBonus);
      const launchPos = getSpiritBombCenter(player.x, player.y, charge.spiritRadius, aimDirX, aimDirY);
      projectiles.push(fireSpiritBomb(
        charge.chargeTime, charge.spiritRadius,
        launchPos.x, launchPos.y,
        worldTargetX, worldTargetY,
        windStacks, itemCfg.windBallModifier,
        overcharge,
      ));
    }
    charge.charging = false;
    charge.chargeTime = 0;
    charge.chargeType = null;
    charge.spiritRadius = 0;
  }

  // Continue charging — purple stacks slightly boost charge rate
  const chargeRate = 1 + purpleStacks * 0.015;
  if (charge.charging) {
    charge.chargeTime += dt * chargeRate;
    // Cap charge time at max (vanilla + purple bonus)
    if (charge.chargeTime > maxCharge) {
      charge.chargeTime = maxCharge;
    }
    charge.spiritRadius = getSpiritBombRadius(charge.chargeTime);

    // Wind is now enemy-damage only (handled in tick above), no terrain carving

    // Self-damage when charging past size threshold
    const hCfg = getHealthConfig();
    if (charge.spiritRadius > hCfg.bombDamageThreshold) {
      damagePlayer(player, hCfg.bombDamagePerSecond * dt);
    }
  }
}

function updateParticleUniforms(device: GPUDevice, ps: { uniformBuffer: GPUBuffer }, w: number, h: number, sx: number, sy: number) {
  device.queue.writeBuffer(ps.uniformBuffer, 0, new Float32Array([w, h, sx, sy]));
}

main();
