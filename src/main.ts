import { initGpu } from './renderer/gpu';
import { initInput, getInput, clearFrameInput } from './input';
import { createWorld } from './physics/world';
import { createPlayer, updatePlayer, Player } from './physics/player';
import { createPlatformRenderer, renderPlatforms } from './renderer/platformRenderer';
import { createPlayerRenderer, renderPlayer } from './renderer/playerRenderer';
import { createParticleSystem, uploadParticleRange, uploadAttractors, updateParticlesGPU, renderParticles, AttractorDef } from './renderer/particleRenderer';
import { createProjectileRenderer, renderProjectiles } from './renderer/projectileRenderer';
import {
  emitChargeAura, emitProjectileTrail, emitImpactExplosion,
  emitRespawnBurst, emitSpiritBombOrbit,
} from './particles/emitter';
import {
  Projectile, ChargeState, createChargeState,
  getChargeNormalized,
  fireChargeShot, fireSpiritBomb, updateProjectiles,
} from './physics/projectile';
import { InputState } from './input';

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

  // Create renderers
  const platRenderer = createPlatformRenderer(gpu, world.platforms);
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
    updatePlayer(player, input, world, dt);

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

    // Charge aura particles
    if (charge.charging) {
      const norm = getChargeNormalized(charge.chargeTime);
      emitChargeAura(particleSys.cpuData, MAX_PARTICLES, cursor, player.x, player.y, norm);


      // Spirit bomb orbit particles
      if (charge.chargeType === 'spirit' && charge.spiritRadius > 3) {
        emitSpiritBombOrbit(
          particleSys.cpuData, MAX_PARTICLES, cursor,
          player.x, player.y - 30, charge.spiritRadius,
        );
  
      }
    }

    // Update projectiles
    const hitProjectiles = updateProjectiles(projectiles, world, dt);

    // Projectile trail particles
    for (const p of projectiles) {
      if (!p.alive) continue;
      emitProjectileTrail(particleSys.cpuData, MAX_PARTICLES, cursor, p.x, p.y, p.level);

    }

    // Impact explosions
    for (const p of hitProjectiles) {
      emitImpactExplosion(particleSys.cpuData, MAX_PARTICLES, cursor, p.x, p.y, p.power);

    }

    // Clean up dead projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (!projectiles[i].alive) projectiles.splice(i, 1);
    }
  }

  function updateCharge(input: InputState, player: Player, charge: ChargeState, dt: number) {
    if (input.charge && !charge.charging) {
      // Start charging
      charge.charging = true;
      charge.chargeTime = 0;
      charge.chargeType = input.up ? 'spirit' : 'mega';
      charge.spiritRadius = 0;
    }

    if (charge.charging && input.charge) {
      charge.chargeTime += dt;
      if (charge.chargeType === 'spirit') {
        // Spirit bomb grows over time
        charge.spiritRadius = Math.min(5 + charge.chargeTime * 15, 40);
      }
    }

    if (charge.charging && input.chargeReleased) {
      // Fire!
      if (charge.chargeType === 'mega' && charge.chargeTime > 0.05) {
        projectiles.push(fireChargeShot(charge.chargeTime, player.x, player.y, player.facing));
      } else if (charge.chargeType === 'spirit' && charge.chargeTime > 0.3) {
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

    // Upload only newly-emitted particle slots to GPU (avoids resurrecting dead particles)
    if (cursor.value > frameCursorStart) {
      uploadParticleRange(gpu.device, particleSys, frameCursorStart, cursor.value);
    }

    // Build attractor list for this frame
    const attractors: AttractorDef[] = [];
    if (charge.charging) {
      // Player charge aura attractor — pulls particles inward with swirl
      const norm = getChargeNormalized(charge.chargeTime);
      attractors.push({
        x: player.x,
        y: player.y,
        strength: 300 + norm * 500,  // stronger pull as charge builds
        radius: 80,
        tangent: 200 + norm * 300,   // swirl intensifies with charge
      });

      // Spirit bomb attractor (separate from player)
      if (charge.chargeType === 'spirit' && charge.spiritRadius > 3) {
        attractors.push({
          x: player.x,
          y: player.y - 30,
          strength: 400,
          radius: charge.spiritRadius * 2.5,
          tangent: 350,
        });
      }
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
        clearValue: { r: 0.08, g: 0.08, b: 0.14, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    renderPlatforms(pass, platRenderer);
    renderPlayer(pass, playerRendererData, gpu.device, player, gameTime);

    // Render projectile shapes
    const spiritX = player.x;
    const spiritY = player.y - 30;
    const spiritR = (charge.charging && charge.chargeType === 'spirit') ? charge.spiritRadius : 0;
    renderProjectiles(pass, projRenderer, gpu.device, projectiles, spiritX, spiritY, spiritR, gameTime);

    // Render particles (additive blend, drawn last)
    renderParticles(pass, particleSys);

    pass.end();
    gpu.device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main();
