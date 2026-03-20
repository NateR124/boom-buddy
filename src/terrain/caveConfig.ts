export interface CaveConfig {
  seed: number;
  wallThickness: number;
  minPathLength: number;
  maxPathLength: number;
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
    branchCheckInterval: 60,
    branchChance: 0.45,
    trunkBaseWidth: 45,
    wormWidthMin: 34,
    wormWidthMax: 52,
    sinusoidalWidthMin: 36,
    sinusoidalWidthMax: 58,
    giantCaveWidthMin: 55,
    giantCaveWidthMax: 85,
    slowGrowWidthMin: 45,
    slowGrowWidthMax: 70,
    fastGrowWidthMin: 45,
    fastGrowWidthMax: 70,
    branchOffsetMin: 30,
    branchOffsetMax: 80,
    driftAmplitude: 60,
    waterThreshold: 0.55,
  };
}
