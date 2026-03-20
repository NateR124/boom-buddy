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
import { createHpBar } from './hpBar';
import { createKillCounter } from './killCounter';
import { damagePlayer, getHealthConfig } from './physics/player';
import { createItemSpawner, spawnItemsForRows, collectItems, cleanupItems } from './items/itemSpawner';
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
  getSpiritBombRadius, getSpiritBombCenterY,
  getCraterRadius,
} from './physics/projectile';
import { InputState } from './input';
import { createCamera, addShake, updateShake, updateCameraScroll } from './camera';
import {
  createEnemySystem, spawnEnemies, updateEnemies,
  damageEnemiesInRadius, damageEnemiesWithProjectiles,
  checkEnemyPlayerCollision, cleanupEnemies,
} from './enemies/enemySystem';

const FIXED_DT = 1 / 60;
const MAX_PARTICLES = 4096;
const DAY_CYCLE = 30;

const SHIFT_THRESHOLD = 40;
const SHIFT_AMOUNT = 30;

async function main() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const fallback = document.getElementById('fallback') as HTMLElement;

  const gpuResult = await initGpu(canvas);
  if (!gpuResult) {
    canvas.style.display = 'none';
    fallback.style.display = 'block';
    return;
  }
  const gpu = gpuResult;

  initInput();

  const debugPanel = createDebugPanel();
  const hpBar = createHpBar();
  const inventoryUI = createInventoryUI();
  const killCounter = createKillCounter();

  // Pause overlay
  const pauseOverlay = document.createElement('div');
  pauseOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:none;align-items:center;justify-content:center;z-index:50;pointer-events:none';
  const pauseText = document.createElement('div');
  pauseText.style.cssText = 'color:#fff;font-family:monospace;font-size:32px;font-weight:bold;text-shadow:0 0 10px rgba(255,255,255,0.5)';
  pauseText.textContent = 'PAUSED';
  pauseOverlay.appendChild(pauseText);
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
    const startY = player.y;
    let hintsFaded = false;

    const terrain = createTerrainGrid();
    const cavePlan = createCavePlan(config);
    generateRows(terrain, 0, GRID_H, cavePlan);

    const itemSpawner = createItemSpawner();
    const inventory = createInventory();
    // Spawn initial items
    spawnItemsForRows(itemSpawner, 80, GRID_H, cavePlan, getItemConfig(), config.seed);

    const cursor = { value: 0 };

    // Clear particle buffer
    particleSys.cpuData.fill(0);
    gpu.device.queue.writeBuffer(particleSys.gpuBuffer, 0, particleSys.cpuData.buffer);

    let accumulator = 0;
    let lastTime = performance.now();
    let gameTime = 0;
    let frameCursorStart = 0;
    let paused = false;

    function tick(input: InputState, dt: number) {
      const prevDead = player.dead;
      updatePlayer(player, input, world, terrain, dt, camera.scrollY);

      if (prevDead && !player.dead) {
        emitRespawnBurst(particleSys.cpuData, MAX_PARTICLES, cursor, player.x, player.y);
      }
      if (!prevDead && player.dead) {
        emitRespawnBurst(particleSys.cpuData, MAX_PARTICLES, cursor, player.x, player.y);
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

      updateCharge(input, player, charge, projectiles, dt, inventory, terrain);

      // Wind Ball: damage enemies near charging bomb
      if (charge.charging && charge.spiritRadius > 0) {
        const ws = getStacks(inventory, 'wind_ball');
        if (ws > 0) {
          const icfg = getItemConfig();
          const wr = charge.spiritRadius * ws * icfg.windBallModifier;
          if (wr > 2) {
            const by = getSpiritBombCenterY(player.y, charge.spiritRadius);
            damageEnemiesInRadius(enemySys, player.x, by, wr);
          }
        }
      }

      if (charge.charging) {
        const norm = getChargeNormalized(charge.chargeTime);
        emitChargeAura(particleSys.cpuData, MAX_PARTICLES, cursor, player.x, player.y, norm);

        if (charge.spiritRadius > 3) {
          const bombY = getSpiritBombCenterY(player.y, charge.spiritRadius);
          emitSpiritBombOrbit(
            particleSys.cpuData, MAX_PARTICLES, cursor,
            player.x, bombY, charge.spiritRadius,
          );
        }
      }

      const hits = updateProjectiles(projectiles, world, terrain, dt, camera.scrollY);

      for (const p of projectiles) {
        if (!p.alive) continue;
        emitProjectileTrail(particleSys.cpuData, MAX_PARTICLES, cursor, p.x, p.y, p.level);
      }

      for (const { proj, carve } of hits) {
        emitImpactExplosion(particleSys.cpuData, MAX_PARTICLES, cursor, proj.x, proj.y, proj.power);
        if (carve.count > 0) {
          emitTerrainDebris(particleSys.cpuData, MAX_PARTICLES, cursor, proj.x, proj.y, carve.count);
        }
        const shakeIntensity = 4 + proj.power * 12;
        const shakeDuration = 0.2 + proj.power * 0.3;
        addShake(camera, shakeIntensity, shakeDuration);
      }

      // Enemies: damage from explosions
      for (const { proj } of hits) {
        const craterR = proj.radius * 1.5;
        damageEnemiesInRadius(enemySys, proj.x, proj.y, craterR);
      }

      // Enemies: flying projectile hits enemy → detonate the bomb
      for (const proj of projectiles) {
        if (!proj.alive) continue;
        const killed = damageEnemiesInRadius(enemySys, proj.x, proj.y, proj.radius);
        if (killed > 0) {
          proj.alive = false;
          const craterR = getCraterRadius(proj);
          const carve = carveExplosion(terrain, proj.x, proj.y, craterR);
          emitImpactExplosion(particleSys.cpuData, MAX_PARTICLES, cursor, proj.x, proj.y, proj.power);
          if (carve.count > 0) {
            emitTerrainDebris(particleSys.cpuData, MAX_PARTICLES, cursor, proj.x, proj.y, carve.count);
          }
          addShake(camera, 4 + proj.power * 12, 0.2 + proj.power * 0.3);
          // Also kill any other enemies caught in the crater
          damageEnemiesInRadius(enemySys, proj.x, proj.y, craterR);
        }
      }

      // Enemy spawning and movement
      spawnEnemies(enemySys, camera.scrollY, gpu.canvas.width, gpu.canvas.height, getEnemyConfig());
      updateEnemies(enemySys, player.x, player.y, dt, getEnemyConfig());

      // Enemy-player collision (damage player)
      const enemyHits = checkEnemyPlayerCollision(enemySys, player.x, player.y, player.w, player.h);
      if (enemyHits > 0) {
        damagePlayer(player, enemyHits * 10);
      }

      cleanupEnemies(enemySys, camera.scrollY, gpu.canvas.height);

      updateShake(camera, dt);

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
        addItem(inventory, id);
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
        clearFrameInput();
        animFrameId = requestAnimationFrame(loop);
        return;
      }

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
        const bombY = getSpiritBombCenterY(player.y, charge.spiritRadius);
        attractors.push({
          x: player.x,
          y: bombY,
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
      uploadTerrainGrid(gpu.device, terrainRenderData, terrain, gameTime, gpu.canvas.width, gpu.canvas.height, terrainCameraX, terrainCameraY, dayPhase, 0, terrain.worldYOffset);
      renderTerrain(pass, terrainRenderData);

      renderPlayer(pass, playerRendererData, gpu.device, player, gameTime, charge.charging, sx, sy);

      const spiritR = charge.charging ? charge.spiritRadius : 0;
      const spiritX = player.x;
      const spiritY = spiritR > 0 ? getSpiritBombCenterY(player.y, spiritR) : player.y;
      const vertOverflow = renderProjectiles(pass, projRenderer, gpu.device, projectiles, spiritX, spiritY, spiritR, gameTime, sx, sy, itemSpawner.items, charge.density, enemySys.enemies);
      overflowWarn.style.opacity = vertOverflow ? '1' : '0';

      updateParticleUniforms(gpu.device, particleSys, gpu.canvas.width, gpu.canvas.height, sx, sy);
      renderParticles(pass, particleSys);

      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);

      // Update HTML overlays
      hpBar.update(player, sx, sy);
      inventoryUI.update(inventory);
      killCounter.update(enemySys.kills);

      animFrameId = requestAnimationFrame(loop);
    }

    animFrameId = requestAnimationFrame(loop);
  }

  debugPanel.onRestart(() => startSession());
  startSession();
}

function updateCharge(input: InputState, player: Player, charge: ChargeState, projectiles: Projectile[], dt: number, inventory: Inventory, terrain: TerrainGrid) {
  if (input.charge && !charge.charging) {
    charge.charging = true;
    charge.chargeTime = 0;
    charge.chargeType = 'spirit';
    charge.spiritRadius = 0;
    charge.density = 0;
  }

  if (charge.charging && input.charge) {
    charge.chargeTime += dt;
    charge.spiritRadius = getSpiritBombRadius(charge.chargeTime);

    // Purple Ball: accumulate density while charging
    const purpleStacks = getStacks(inventory, 'purple_ball');
    if (purpleStacks > 0) {
      const itemCfg = getItemConfig();
      charge.density += purpleStacks * itemCfg.purpleBallDensityRate * dt;
    }

    // Wind Ball: passively destroy terrain around the charging bomb
    const windStacks = getStacks(inventory, 'wind_ball');
    if (windStacks > 0) {
      const itemCfg = getItemConfig();
      const bombY = getSpiritBombCenterY(player.y, charge.spiritRadius);
      const windRadius = charge.spiritRadius * windStacks * itemCfg.windBallModifier;
      if (windRadius > 2) {
        carveExplosion(terrain, player.x, bombY, windRadius, player.y);
      }
    }

    // Self-damage when charging past size threshold
    const hCfg = getHealthConfig();
    if (charge.spiritRadius > hCfg.bombDamageThreshold) {
      damagePlayer(player, hCfg.bombDamagePerSecond * dt);
    }
  }

  if (charge.charging && input.chargeReleased) {
    if (charge.chargeTime > 0.3) {
      const windStacks = getStacks(inventory, 'wind_ball');
      const itemCfg = getItemConfig();
      projectiles.push(fireSpiritBomb(
        charge.chargeTime, charge.spiritRadius,
        player.x, player.y, player.facing,
        charge.density, windStacks, itemCfg.windBallModifier,
      ));
    }
    charge.charging = false;
    charge.chargeTime = 0;
    charge.chargeType = null;
    charge.spiritRadius = 0;
    charge.density = 0;
  }
}

function updateParticleUniforms(device: GPUDevice, ps: { uniformBuffer: GPUBuffer }, w: number, h: number, sx: number, sy: number) {
  device.queue.writeBuffer(ps.uniformBuffer, 0, new Float32Array([w, h, sx, sy]));
}

main();
