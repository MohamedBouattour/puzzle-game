export type TileType = 'INPUT' | 'OUTPUT' | 'HEALTHY' | 'BLOCKED' | 'CORRUPTED' | 'SHARD_CACHE';
export type ConnectorType = 'STRAIGHT' | 'CURVE_60' | 'CURVE_120' | 'SPLIT_Y' | 'NONE';
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

export interface GridTile {
  q: number;
  r: number;
  type: TileType;
  connector: ConnectorType;
  rotation: HexDirection;
  isLocked: boolean;
}

export interface PlayerAction {
  timestampMs: number;
  actionType: 'PLACE' | 'ROTATE' | 'DELETE' | 'TOOL_SCALPEL' | 'TOOL_SUTURE' | 'TOOL_INJECTOR';
  q: number;
  r: number;
  param?: string | number;
}

export interface GameStateSnapshotDto {
  levelId: string;
  seed: number;
  grid: GridTile[];
  actions: PlayerAction[];
  elapsedSeconds: number;
  finalVitality: number;
  finalNeuralLoad: number;
}

const HEX_DIRECTIONS = [
  { dq: 0, dr: -1 },
  { dq: 1, dr: -1 },
  { dq: 1, dr: 0 },
  { dq: 0, dr: 1 },
  { dq: -1, dr: 1 },
  { dq: -1, dr: 0 }
];

export function getOpenDirections(type: ConnectorType, rotation: HexDirection): Set<HexDirection> {
  const open = new Set<HexDirection>();
  if (type === 'NONE') return open;

  let localDirs: HexDirection[] = [];
  switch (type) {
    case 'STRAIGHT':
      localDirs = [0, 3];
      break;
    case 'CURVE_60':
      localDirs = [0, 1];
      break;
    case 'CURVE_120':
      localDirs = [0, 2];
      break;
    case 'SPLIT_Y':
      localDirs = [0, 2, 4];
      break;
  }

  for (const dir of localDirs) {
    const rotated = ((dir + rotation) % 6) as HexDirection;
    open.add(rotated);
  }
  return open;
}

export function validateSolution(
  snapshot: GameStateSnapshotDto,
  config: { maxNeuralLoad: number; baseDecayRate: number; allowedScalpels: number; allowedSutures: number }
): { isValid: boolean; reason?: string } {
  
  let lastTime = 0;
  let scalpelsUsed = 0;
  let suturesUsed = 0;
  let injectorFreezes = 0;

  for (const action of snapshot.actions) {
    if (action.timestampMs < lastTime) {
      return { isValid: false, reason: 'Chronological timeline mismatch in player logs.' };
    }
    lastTime = action.timestampMs;

    if (action.actionType === 'TOOL_SCALPEL') scalpelsUsed++;
    if (action.actionType === 'TOOL_SUTURE') suturesUsed++;
    if (action.actionType === 'TOOL_INJECTOR') injectorFreezes++;
  }

  if (scalpelsUsed > config.allowedScalpels) {
    return { isValid: false, reason: `Excessive Laser Scalpel uses: ${scalpelsUsed} > limit of ${config.allowedScalpels}` };
  }
  if (suturesUsed > config.allowedSutures) {
    return { isValid: false, reason: `Excessive Suture Needle locks: ${suturesUsed} > limit of ${config.allowedSutures}` };
  }

  const gridMap = new Map<string, GridTile>();
  let inputNode: GridTile | null = null;
  let outputNode: GridTile | null = null;

  for (const tile of snapshot.grid) {
    const key = `${tile.q},${tile.r}`;
    gridMap.set(key, tile);
    if (tile.type === 'INPUT') inputNode = tile;
    if (tile.type === 'OUTPUT') outputNode = tile;
  }

  if (!inputNode || !outputNode) {
    return { isValid: false, reason: 'Input Stem or Output Organ Node missing in grid matrix.' };
  }

  let calculatedLoad = 0;
  for (const tile of snapshot.grid) {
    if (tile.connector === 'NONE') continue;
    
    if (tile.connector === 'STRAIGHT') calculatedLoad += 10;
    else if (tile.connector === 'CURVE_60') calculatedLoad += 15;
    else if (tile.connector === 'CURVE_120') calculatedLoad += 20;
    else if (tile.connector === 'SPLIT_Y') calculatedLoad += 30;
  }

  const rotationsCount = snapshot.actions.filter(a => a.actionType === 'ROTATE').length;
  calculatedLoad += rotationsCount * 2;

  if (calculatedLoad !== snapshot.finalNeuralLoad) {
    return { isValid: false, reason: `Neural Load mismatch. Reported: ${snapshot.finalNeuralLoad}, Calculated: ${calculatedLoad}` };
  }

  if (calculatedLoad > config.maxNeuralLoad) {
    return { isValid: false, reason: `Neural Load exceeds overclock threshold: ${calculatedLoad} > limit of ${config.maxNeuralLoad}` };
  }

  const activePlayDuration = snapshot.elapsedSeconds;
  const freezeCreditsDuration = injectorFreezes * 5.0;
  const decayingDuration = Math.max(0, activePlayDuration - freezeCreditsDuration);
  
  const corruptionWeight = 0.25;
  let corruptionMultiplier = 1.0;

  const visited = new Set<string>();
  const queue: GridTile[] = [inputNode];
  visited.add(`${inputNode.q},${inputNode.r}`);

  let pathConnectsToOutput = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.type === 'OUTPUT') {
      pathConnectsToOutput = true;
    }
    if (current.type === 'CORRUPTED') {
      corruptionMultiplier += corruptionWeight;
    }

    const currentKey = `${current.q},${current.r}`;
    const openDirs = getOpenDirections(current.connector, current.rotation);

    if (current.type === 'INPUT') {
      for (let i = 0; i < 6; i++) openDirs.add(i as HexDirection);
    }

    for (const dirIndex of openDirs) {
      const dir = HEX_DIRECTIONS[dirIndex];
      const nextQ = current.q + dir.dq;
      const nextR = current.r + dir.dr;
      const nextKey = `${nextQ},${nextR}`;

      if (visited.has(nextKey)) continue;

      const neighbor = gridMap.get(nextKey);
      if (neighbor) {
        if (neighbor.type === 'OUTPUT') {
          visited.add(nextKey);
          queue.push(neighbor);
          continue;
        }

        const neighborOpenDirs = getOpenDirections(neighbor.connector, neighbor.rotation);
        const inverseDir = ((dirIndex + 3) % 6) as HexDirection;

        if (neighborOpenDirs.has(inverseDir)) {
          visited.add(nextKey);
          queue.push(neighbor);
        }
      }
    }
  }

  const baseDecay = config.baseDecayRate * decayingDuration;
  const totalDecay = baseDecay * corruptionMultiplier;
  const calculatedVitality = Math.max(0, 100 - totalDecay);

  if (calculatedVitality <= 0) {
    return { isValid: false, reason: `Subject Vitality depleted to 0% during procedure.` };
  }

  if (Math.abs(calculatedVitality - snapshot.finalVitality) > 1.5) {
    return { isValid: false, reason: `Vitality mismatch. Client reported ${snapshot.finalVitality}%, Server calculated ${calculatedVitality}%` };
  }

  if (!pathConnectsToOutput) {
    return { isValid: false, reason: 'No closed, continuous pathway connects Input Stem to Target Organ.' };
  }

  return { isValid: true };
}
