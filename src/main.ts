import { initGpu } from './renderer/gpu';
import { initInput, getInput, clearFrameInput } from './input';
import { createWorld } from './physics/world';
import { createPlayer, updatePlayer, Player } from './physics/player';
import { createPlayerRenderer, renderPlayer } from './renderer/playerRenderer';
import { createParticleSystem, uploadParticleRange, uploadAttractors, updateParticlesGPU, renderParticles, AttractorDef } from './renderer/particleRenderer';
import { createProjectileRenderer, renderProjectiles } from './renderer/projectileRenderer';
import { createTerrainRenderer, uploadTerrainGrid, renderTerrain } from './renderer/terrainRenderer';
import { createTerrainGrid, resetTerrainGrid, isSolid, CELL_SCALE } from './terrain/grid';
import {
  emitChargeAura, emitProjectileTrail, emitImpactExplosion,
  emitRespawnBurst, emitSpiritBombOrbit, emitTerrainDebris,
} from './particles/emitter';
import {
  Projectile, ChargeState, createChargeState,
  getChargeNormalized,
  fireSpiritBomb, updateProjectiles,
  getSpiritBombRadius, getSpiritBombCenterY,
} from './physics/projectile';
import { InputState } from './input';
import { createCamera, addShake, updateShake } from './camera';

const FIXED_DT = 1 / 60;
const MAX_PARTICLES = 4096;
const DAY_CYCLE = 30; // seconds for a full day/night cycle

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

  const world = createWorld();
  const player = createPlayer(world.spawnPoint.x, world.spawnPoint.y);
  const charge = createChargeState();
  const projectiles: Projectile[] = [];
  const camera = createCamera();

  // Create terrain grid from platform definitions
  const terrain = createTerrainGrid(world.platforms);

  // Create renderers
  const terrainRenderData = createTerrainRenderer(gpu);
  const playerRendererData = createPlayerRenderer(gpu);
  const particleSys = createParticleSystem(gpu, MAX_PARTICLES);
  const projRenderer = createProjectileRenderer(gpu);

  // Particle emit cursor (ring buffer)
  const cursor = { value: 0 };

  let accumulator = 0;
  let lastTime = performance.now();
  let gameTime = 0;
  let currentDay = 0; // tracks day number for terrain regeneration
  let regenTimer = 0; // counts down after terrain regen for blink effect
  // Track bottom-fall deaths: if 3 in 10 seconds, regenerate terrain
  const bottomFallTimes: number[] = [];
  const BOTTOM_FALL_WINDOW = 10; // seconds
  const BOTTOM_FALL_THRESHOLD = 3;
  // Track which particle slots were written this frame for partial upload
  let frameCursorStart = 0;

  function tick(input: InputState, dt: number) {
    const prevDead = player.dead;
    updatePlayer(player, input, world, terrain, dt);

    // Respawn burst — fires when player transitions from dead to alive
    if (prevDead && !player.dead) {
      emitRespawnBurst(particleSys.cpuData, MAX_PARTICLES, cursor, player.x, player.y);
    }

    // Death burst — fires when player just died
    if (!prevDead && player.dead) {
      emitRespawnBurst(particleSys.cpuData, MAX_PARTICLES, cursor, player.x, player.y);

      // Track bottom-fall deaths for terrain respawn trigger
      if (player.fellOffBottom) {
        bottomFallTimes.push(gameTime);
        // Prune old entries outside the window
        while (bottomFallTimes.length > 0 && bottomFallTimes[0] < gameTime - BOTTOM_FALL_WINDOW) {
          bottomFallTimes.shift();
        }
        if (bottomFallTimes.length >= BOTTOM_FALL_THRESHOLD) {
          bottomFallTimes.length = 0; // reset so it doesn't re-trigger immediately
          resetTerrainGrid(terrain, world.platforms);
          resolvePlayerTerrainRegen(player, terrain);
          addShake(camera, 3, 0.25);
          regenTimer = 1.5;
        }
      }
    }

    if (player.dead) return;

    // Charge logic
    updateCharge(input, player, charge, dt);

    // Spirit bomb charge particles
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

    // Update projectiles (does terrain collision + crater carving)
    const hits = updateProjectiles(projectiles, world, terrain, dt);

    // Projectile trail particles
    for (const p of projectiles) {
      if (!p.alive) continue;
      emitProjectileTrail(particleSys.cpuData, MAX_PARTICLES, cursor, p.x, p.y, p.level);
    }

    // Impact explosions + terrain debris + screen shake
    for (const { proj, carve } of hits) {
      emitImpactExplosion(particleSys.cpuData, MAX_PARTICLES, cursor, proj.x, proj.y, proj.power);
      if (carve.count > 0) {
        emitTerrainDebris(particleSys.cpuData, MAX_PARTICLES, cursor, proj.x, proj.y, carve.count);
      }
      // Screen shake proportional to impact power
      const shakeIntensity = 4 + proj.power * 12;
      const shakeDuration = 0.2 + proj.power * 0.3;
      addShake(camera, shakeIntensity, shakeDuration);
    }

    // Update camera shake
    updateShake(camera, dt);

    // Terrain regeneration at the start of each new day cycle
    const newDay = Math.floor(gameTime / DAY_CYCLE);
    if (newDay > currentDay) {
      currentDay = newDay;
      resetTerrainGrid(terrain, world.platforms);
      // Push player out of regenerated terrain
      resolvePlayerTerrainRegen(player, terrain);
      // Small shake to punctuate the terrain reset
      addShake(camera, 3, 0.25);
      regenTimer = 1.5; // trigger blink effect
    }

    // Tick down regen blink timer
    if (regenTimer > 0) {
      regenTimer = Math.max(0, regenTimer - dt);
    }

    // Clean up dead projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (!projectiles[i].alive) projectiles.splice(i, 1);
    }
  }

  function updateCharge(input: InputState, player: Player, charge: ChargeState, dt: number) {
    if (input.charge && !charge.charging) {
      // Start charging spirit bomb
      charge.charging = true;
      charge.chargeTime = 0;
      charge.chargeType = 'spirit';
      charge.spiritRadius = 0;
    }

    if (charge.charging && input.charge) {
      charge.chargeTime += dt;
      // Area grows at constant rate → radius = sqrt((A₀ + k*t) / π)
      charge.spiritRadius = getSpiritBombRadius(charge.chargeTime);
    }

    if (charge.charging && input.chargeReleased) {
      // Fire!
      if (charge.chargeTime > 0.3) {
        projectiles.push(fireSpiritBomb(charge.chargeTime, charge.spiritRadius, player.x, player.y, player.facing));
      }
      charge.charging = false;
      charge.chargeTime = 0;
      charge.chargeType = null;
      charge.spiritRadius = 0;
    }
  }

  function loop(now: number) {
    const frameTime = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accumulator += frameTime;

    const input = getInput();
    let ticked = false;
    frameCursorStart = cursor.value;

    while (accumulator >= FIXED_DT) {
      tick(input, FIXED_DT);
      accumulator -= FIXED_DT;
      gameTime += FIXED_DT;
      ticked = true;
    }
    if (ticked) clearFrameInput();

    // Camera shake offset for this frame
    const sx = camera.shakeX;
    const sy = camera.shakeY;

    // Upload only newly-emitted particle slots to GPU (avoids resurrecting dead particles)
    if (cursor.value > frameCursorStart) {
      uploadParticleRange(gpu.device, particleSys, frameCursorStart, cursor.value);
    }

    // Build attractor list for this frame
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

    // GPU passes
    const commandEncoder = gpu.device.createCommandEncoder();

    // Compute pass: update particles on GPU
    updateParticlesGPU(commandEncoder, particleSys, gpu.device, FIXED_DT, gameTime);

    // Render pass
    const textureView = gpu.context.getCurrentTexture().createView();
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.02, g: 0.02, b: 0.08, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    // Upload terrain grid and render (with camera shake + day/night phase)
    const dayPhase = (gameTime % DAY_CYCLE) / DAY_CYCLE;
    uploadTerrainGrid(gpu.device, terrainRenderData, terrain, gameTime, gpu.canvas.width, gpu.canvas.height, sx, sy, dayPhase, regenTimer);
    renderTerrain(pass, terrainRenderData);

    // Render player with camera shake offset
    renderPlayer(pass, playerRendererData, gpu.device, player, gameTime, charge.charging, sx, sy);

    // Render projectile shapes with camera shake offset
    const spiritR = charge.charging ? charge.spiritRadius : 0;
    const spiritX = player.x;
    const spiritY = spiritR > 0 ? getSpiritBombCenterY(player.y, spiritR) : player.y;
    renderProjectiles(pass, projRenderer, gpu.device, projectiles, spiritX, spiritY, spiritR, gameTime, sx, sy);

    // Render particles (additive blend, drawn last) — update uniform with camera offset
    updateParticleUniforms(gpu.device, particleSys, gpu.canvas.width, gpu.canvas.height, sx, sy);
    renderParticles(pass, particleSys);

    pass.end();
    gpu.device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

// Helper to update particle render uniform with camera offset
function updateParticleUniforms(device: GPUDevice, ps: { uniformBuffer: GPUBuffer }, w: number, h: number, sx: number, sy: number) {
  device.queue.writeBuffer(ps.uniformBuffer, 0, new Float32Array([w, h, sx, sy]));
}

/**
 * After terrain regeneration, push the player upward if they're clipped into solid terrain.
 * Iteratively moves player up one cell at a time until free.
 */
function resolvePlayerTerrainRegen(player: import('./physics/player').Player, terrain: import('./terrain/grid').TerrainGrid) {
  if (player.dead) return;

  const halfW = player.w / 2;
  const halfH = player.h / 2;
  // Inset by 2px to match collision margins
  const leftG = Math.floor((player.x - halfW + 2) / CELL_SCALE);
  const rightG = Math.floor((player.x + halfW - 2) / CELL_SCALE);

  for (let attempt = 0; attempt < 120; attempt++) {
    const topG = Math.floor((player.y - halfH) / CELL_SCALE);
    const botG = Math.floor((player.y + halfH) / CELL_SCALE);

    let clipped = false;
    for (let gy = topG; gy <= botG && !clipped; gy++) {
      for (let gx = leftG; gx <= rightG && !clipped; gx++) {
        if (isSolid(terrain, gx, gy)) {
          clipped = true;
        }
      }
    }

    if (!clipped) break;
    player.y -= CELL_SCALE; // push up one cell
  }

  player.vy = 0;
}

main();
