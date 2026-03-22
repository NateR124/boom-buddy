import { GRID_W } from './grid';
import { CaveConfig } from './caveConfig';

// ===== Deterministic PRNG (splitmix32) =====

export interface RNG {
  state: number;
}

export function createRNG(seed: number): RNG {
  return { state: seed >>> 0 };
}

/** Returns a float in [0, 1). */
export function nextFloat(rng: RNG): number {
  rng.state = (rng.state + 0x9e3779b9) >>> 0;
  let z = rng.state;
  z = ((z ^ (z >>> 16)) * 0x85ebca6b) >>> 0;
  z = ((z ^ (z >>> 13)) * 0xc2b2ae35) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  return z / 4294967296;
}

function nextInt(rng: RNG, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

function pick<T>(rng: RNG, arr: T[]): T {
  return arr[Math.floor(nextFloat(rng) * arr.length)];
}

// ===== Path types =====

export type PathType =
  | 'worm'
  | 'sinusoidal'
  | 'giant-cave'
  | 'slow-grow'
  | 'fast-grow-slow-shrink';

export interface PathSegment {
  startY: number;
  endY: number;
  originX: number;
  type: PathType;
  driftSeed: number;
  baseWidth: number;
}

// ===== Cave plan =====

export interface CavePlan {
  config: CaveConfig;
  paths: PathSegment[];
  generatedUntilY: number;
}

const PATH_TYPES: PathType[] = [
  'worm', 'sinusoidal', 'giant-cave',
  'slow-grow', 'fast-grow-slow-shrink',
];

// Overlap: new paths start this many rows before the parent ends
const OVERLAP_ROWS = 30;

function getMinCenterX(cfg: CaveConfig): number {
  return cfg.wallThickness + 20;
}
function getMaxCenterX(cfg: CaveConfig): number {
  return GRID_W - cfg.wallThickness - 20;
}

export function createCavePlan(config: CaveConfig): CavePlan {
  const plan: CavePlan = {
    config,
    paths: [],
    generatedUntilY: 0,
  };

  const rng = createRNG(config.seed);

  // Two initial paths — left and right
  const centerX = Math.floor(GRID_W / 2);
  const spread = Math.floor(config.trunkBaseWidth * 1.2);

  const leftTrunk: PathSegment = {
    startY: 80,
    endY: 80 + nextInt(rng, 200, config.maxPathLength),
    originX: centerX - spread,
    type: 'worm',
    driftSeed: Math.floor(nextFloat(rng) * 100000),
    baseWidth: config.trunkBaseWidth,
  };

  const rightTrunk: PathSegment = {
    startY: 80,
    endY: 80 + nextInt(rng, 200, config.maxPathLength),
    originX: centerX + spread,
    type: 'worm',
    driftSeed: Math.floor(nextFloat(rng) * 100000),
    baseWidth: config.trunkBaseWidth,
  };

  plan.paths.push(leftTrunk, rightTrunk);
  plan.generatedUntilY = Math.max(leftTrunk.endY, rightTrunk.endY);

  expandPlan(plan, plan.generatedUntilY + 500);

  return plan;
}

export function expandPlan(plan: CavePlan, targetY: number): void {
  const cfg = plan.config;
  if (plan.generatedUntilY >= targetY) return;

  const rng = createRNG(cfg.seed + plan.generatedUntilY * 7919);

  // Step through in branchCheckInterval increments so we check for branches
  // while paths are still alive, not just at their endpoints
  let checkY = plan.generatedUntilY;

  while (checkY < targetY) {
    // Active = paths that contain checkY
    const activePaths = plan.paths.filter(
      p => p.startY <= checkY && p.endY > checkY
    );

    console.log(`[CAVE] checkY=${checkY} activePaths=${activePaths.length} totalPaths=${plan.paths.length}`);
    for (const p of activePaths) {
      console.log(`  active: type=${p.type} startY=${p.startY} endY=${p.endY} originX=${Math.round(p.originX)} remaining=${p.endY - checkY}`);
    }

    if (activePaths.length === 0) {
      // No active paths — force spawn a continuation from the last path
      const lastPath = plan.paths[plan.paths.length - 1];
      const lastX = getPathCenterX(plan, lastPath, lastPath.endY);
      const startY = Math.max(lastPath.startY + 1, lastPath.endY - OVERLAP_ROWS);
      const forced = spawnPath(rng, cfg, startY, lastX);
      plan.paths.push(forced);
      console.log(`  [FORCED] no active paths → spawned ${forced.type} at x=${forced.originX} y=${forced.startY}–${forced.endY}`);
      // Don't skip ahead — re-check at same checkY with new path
      continue;
    }

    // Try branching from each active path (only if under max)
    for (const parent of activePaths) {
      const roll = nextFloat(rng);
      const currentActive = plan.paths.filter(p => p.startY <= checkY && p.endY > checkY).length;
      console.log(`  branch roll=${roll.toFixed(3)} vs chance=${cfg.branchChance} active=${currentActive}/${cfg.maxActivePaths} parentRemaining=${parent.endY - checkY}`);
      if (roll < cfg.branchChance && currentActive < cfg.maxActivePaths) {
        const parentX = getPathCenterX(plan, parent, checkY);
        const parentHW = getPathHalfWidth(plan, parent, checkY);
        const dir = nextFloat(rng) < 0.5 ? -1 : 1;
        const offset = parentHW + nextInt(rng, cfg.branchOffsetMin, cfg.branchOffsetMax);
        const branchX = Math.max(
          getMinCenterX(cfg),
          Math.min(getMaxCenterX(cfg), parentX + dir * offset)
        );
        // Branch starts overlapping with parent for smooth fork
        const branch = spawnPath(rng, cfg, checkY - OVERLAP_ROWS, branchX);
        plan.paths.push(branch);
        console.log(`  [BRANCH] from parent(${parent.type}) → ${branch.type} at x=${branchX} y=${branch.startY}–${branch.endY} (parentHW=${parentHW.toFixed(1)} offset=${offset})`);
      }
    }

    // Ensure continuity: if the furthest-reaching path ends soon, spawn a continuation
    const maxEndY = Math.max(...plan.paths.map(p => p.endY));
    if (maxEndY <= checkY + cfg.minPathLength) {
      const latest = plan.paths.reduce((a, b) => a.endY > b.endY ? a : b);
      const contX = getPathCenterX(plan, latest, latest.endY);
      const startY = Math.max(latest.startY + 1, latest.endY - OVERLAP_ROWS);
      const cont = spawnPath(rng, cfg, startY, contX);
      plan.paths.push(cont);
      console.log(`  [CONTINUITY] maxEndY=${maxEndY} → spawned ${cont.type} at x=${Math.round(contX)} y=${cont.startY}–${cont.endY}`);
    }

    checkY += cfg.branchCheckInterval;
  }

  plan.generatedUntilY = checkY;
}

function spawnPath(rng: RNG, cfg: CaveConfig, startY: number, centerX: number): PathSegment {
  const type = pick(rng, PATH_TYPES);
  const length = nextInt(rng, cfg.minPathLength, cfg.maxPathLength);

  let baseWidth: number;
  switch (type) {
    case 'giant-cave':
      baseWidth = nextInt(rng, cfg.giantCaveWidthMin, cfg.giantCaveWidthMax);
      break;
    case 'worm':
      baseWidth = nextInt(rng, cfg.wormWidthMin, cfg.wormWidthMax);
      break;
    case 'sinusoidal':
      baseWidth = nextInt(rng, cfg.sinusoidalWidthMin, cfg.sinusoidalWidthMax);
      break;
    case 'slow-grow':
      baseWidth = nextInt(rng, cfg.slowGrowWidthMin, cfg.slowGrowWidthMax);
      break;
    case 'fast-grow-slow-shrink':
      baseWidth = nextInt(rng, cfg.fastGrowWidthMin, cfg.fastGrowWidthMax);
      break;
    default:
      baseWidth = 18;
  }

  return {
    startY,
    endY: startY + length,
    originX: centerX,
    type,
    driftSeed: Math.floor(nextFloat(rng) * 100000),
    baseWidth,
  };
}

// ===== Path evaluation (pure math, no state) =====

function driftNoise(seed: number, y: number): number {
  const s1 = Math.sin(y * 0.013 + seed * 1.7) * 0.6;
  const s2 = Math.sin(y * 0.031 + seed * 3.1) * 0.3;
  const s3 = Math.sin(y * 0.007 + seed * 0.3) * 0.4;
  return s1 + s2 + s3;
}

export function getPathCenterX(plan: CavePlan, path: PathSegment, worldGy: number): number {
  const cfg = plan.config;
  const drift = driftNoise(path.driftSeed, worldGy) * cfg.driftAmplitude;
  const x = path.originX + drift;
  return Math.max(getMinCenterX(cfg), Math.min(getMaxCenterX(cfg), x));
}

export function getPathHalfWidth(plan: CavePlan, path: PathSegment, worldGy: number): number {
  const t = (worldGy - path.startY) / Math.max(1, path.endY - path.startY);
  const base = path.baseWidth;

  switch (path.type) {
    case 'worm':
      return base;

    case 'sinusoidal': {
      const osc = Math.sin(worldGy * 0.08 + path.driftSeed) * 0.4;
      return base * (1.0 + osc);
    }

    case 'giant-cave':
      return base * smoothstep(0, 0.05, t) * smoothstep(1, 0.95, t);

    case 'slow-grow':
      return base * (0.3 + 0.7 * t);

    case 'fast-grow-slow-shrink': {
      if (t < 0.2) {
        return base * (t / 0.2);
      }
      return base * (1.0 - 0.6 * ((t - 0.2) / 0.8));
    }

    default:
      return base;
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ===== Query functions =====

export function isInsidePath(plan: CavePlan, worldGx: number, worldGy: number): boolean {
  for (const path of plan.paths) {
    if (worldGy < path.startY || worldGy > path.endY) continue;
    const cx = getPathCenterX(plan, path, worldGy);
    const hw = getPathHalfWidth(plan, path, worldGy);
    if (worldGx >= cx - hw && worldGx <= cx + hw) {
      return true;
    }
  }
  return false;
}
