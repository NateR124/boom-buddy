export interface CaveConfig {
  seed: number;
  wallThickness: number;
  minPathLength: number;
  maxPathLength: number;
  maxActivePaths: number;
  branchCheckInterval: number;
  branchChance: number;
  trunkBaseWidth: number;
  wormWidthMin: number;
  wormWidthMax: number;
  sinusoidalWidthMin: number;
  sinusoidalWidthMax: number;
  giantCaveWidthMin: number;
  giantCaveWidthMax: number;
  slowGrowWidthMin: number;
  slowGrowWidthMax: number;
  fastGrowWidthMin: number;
  fastGrowWidthMax: number;
  branchOffsetMin: number;
  branchOffsetMax: number;
  driftAmplitude: number;
  waterThreshold: number;
}

export function createDefaultConfig(): CaveConfig {
  return {
    seed: Date.now(),
    wallThickness: 5,
    minPathLength: 80,
    maxPathLength: 300,
    maxActivePaths: 4,
    branchCheckInterval: 60,
    branchChance: 0.45,
    trunkBaseWidth: 45,
    wormWidthMin: 44,
    wormWidthMax: 52,
    sinusoidalWidthMin: 46,
    sinusoidalWidthMax: 58,
    giantCaveWidthMin: 65,
    giantCaveWidthMax: 85,
    slowGrowWidthMin: 55,
    slowGrowWidthMax: 70,
    fastGrowWidthMin: 55,
    fastGrowWidthMax: 70,
    branchOffsetMin: 30,
    branchOffsetMax: 80,
    driftAmplitude: 60,
    waterThreshold: 0.55,
  };
}
