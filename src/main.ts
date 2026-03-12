import { initGpu } from './renderer/gpu';
import { initInput, getInput, clearFrameInput } from './input';
import { createWorld } from './physics/world';
import { createPlayer, updatePlayer, Player } from './physics/player';
import { createPlayerRenderer, renderPlayer } from './renderer/playerRenderer';
import { createParticleSystem, uploadParticleRange, uploadAttractors, updateParticlesGPU, renderParticles, AttractorDef } from './renderer/particleRenderer';
import { createProjectileRenderer, renderProjectiles } from './renderer/projectileRenderer';
import { createTerrainRenderer, uploadTerrainGrid, renderTerrain } from './renderer/terrainRenderer';
import { createTerrainGrid } from './terrain/grid';
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

    // Upload terrain grid and render (with camera shake)
    uploadTerrainGrid(gpu.device, terrainRenderData, terrain, gameTime, gpu.canvas.width, gpu.canvas.height, sx, sy);
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

main();
