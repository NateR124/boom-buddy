import { initGpu } from './renderer/gpu';
import { initInput, getInput, clearFrameInput } from './input';
import { createWorld } from './physics/world';
import { createPlayer, updatePlayer } from './physics/player';
import { createPlatformRenderer, renderPlatforms } from './renderer/platformRenderer';
import { createPlayerRenderer, renderPlayer } from './renderer/playerRenderer';

const FIXED_DT = 1 / 60; // 60hz physics

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

  // Create renderers
  const platRenderer = createPlatformRenderer(gpu, world.platforms);
  const playerRendererData = createPlayerRenderer(gpu);

  // Game loop state
  let accumulator = 0;
  let lastTime = performance.now();
  let gameTime = 0;

  function loop(now: number) {
    const frameTime = Math.min((now - lastTime) / 1000, 0.1); // cap at 100ms
    lastTime = now;
    accumulator += frameTime;

    // Fixed-timestep physics updates
    // Read input once per frame; only clear one-shot events after at least
    // one physics tick has consumed them. On high-refresh displays some
    // frames have zero ticks — clearing there would eat the press.
    const input = getInput();
    let ticked = false;
    while (accumulator >= FIXED_DT) {
      updatePlayer(player, input, world, FIXED_DT);
      accumulator -= FIXED_DT;
      gameTime += FIXED_DT;
      ticked = true;
    }
    if (ticked) clearFrameInput();

    // Render
    const commandEncoder = gpu.device.createCommandEncoder();
    const textureView = gpu.context.getCurrentTexture().createView();

    const passDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.08, g: 0.08, b: 0.14, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    };

    const pass = commandEncoder.beginRenderPass(passDescriptor);

    // Draw platforms
    renderPlatforms(pass, platRenderer);

    // Draw player
    renderPlayer(pass, playerRendererData, gpu.device, player, gameTime);

    pass.end();
    gpu.device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main();
