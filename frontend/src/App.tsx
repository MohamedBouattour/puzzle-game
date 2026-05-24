import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Heart, Zap, ShieldAlert, Compass, KeyRound, 
  Layers, Eye, Lock, Activity,
  Skull, CheckCircle2, Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Game Types & Interfaces
type TileType = 'INPUT' | 'OUTPUT' | 'HEALTHY' | 'BLOCKED' | 'CORRUPTED' | 'SHARD_CACHE';
type ConnectorType = 'STRAIGHT' | 'CURVE_60' | 'CURVE_120' | 'SPLIT_Y' | 'NONE';
type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

interface GridTile {
  q: number;
  r: number;
  type: TileType;
  connector: ConnectorType;
  rotation: HexDirection;
  isLocked: boolean;
}

interface PlayerAction {
  timestampMs: number;
  actionType: 'PLACE' | 'ROTATE' | 'DELETE' | 'TOOL_SCALPEL' | 'TOOL_SUTURE' | 'TOOL_INJECTOR';
  q: number;
  r: number;
  param?: string | number;
}

interface GameStateSnapshotDto {
  levelId: string;
  seed: number;
  grid: GridTile[];
  actions: PlayerAction[];
  elapsedSeconds: number;
  finalVitality: number;
  finalNeuralLoad: number;
}

interface LevelConfig {
  id: string;
  sectorId: string;
  levelNumber: number;
  seed: number;
  width: number;
  height: number;
  maxNeuralLoad: number;
  baseDecayRate: number;
  allowedScalpels: number;
  allowedSutures: number;
  isShifting: boolean;
}

interface UserProfile {
  id: string;
  username: string;
  bioShards: number;
  activeSectorId: string;
  unlockedSectors: string; // Comma separated
  inventory: Array<{ itemType: string; quantity: number }>;
  upgrades: Array<{ upgradeKey: string; tier: number }>;
  sectorStability: Array<{ sectorId: string; stabilityScore: number }>;
  completedLevelIds?: string[];
}

const SECTORS = [
  { id: 'sector_01', name: 'The Cothon Slums', desc: 'Inner docks and organic waste sectors.' },
  { id: 'sector_02', name: 'Byrsa Citadel', desc: 'Military neuro-rig command center.' },
  { id: 'sector_03', name: 'The Oracle Core', desc: 'Central digital deity synaptic core.' }
];

export default function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<'SPLASH' | 'DASHBOARD' | 'MAP' | 'CHAMBER' | 'UPGRADES' | 'INVENTORY' | 'ORACLE'>('SPLASH');
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Responsiveness States
  const [deviceScale, setDeviceScale] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const mobile = width < 500;
      setIsMobile(mobile);

      if (mobile) {
        setDeviceScale(1);
        return;
      }

      // Design target dimensions
      const targetWidth = 390;
      const targetHeight = 860;
      const verticalPadding = 48; // safe layout padding
      const horizontalPadding = 32;

      const scaleX = width / (targetWidth + horizontalPadding);
      const scaleY = height / (targetHeight + verticalPadding);

      // Fit to screen height & width, capped at 1.0x scale
      const scale = Math.min(scaleX, scaleY, 1.0);
      setDeviceScale(scale);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [activeLevel, setActiveLevel] = useState<LevelConfig | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);

  // Gameplay Live States
  const [grid, setGrid] = useState<GridTile[]>([]);
  const [actions, setActions] = useState<PlayerAction[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [vitality, setVitality] = useState<number>(100);
  const [neuralLoad, setNeuralLoad] = useState<number>(0);
  const [isFreezeActive, setIsFreezeActive] = useState<boolean>(false);
  const [freezeTimeRemaining, setFreezeTimeRemaining] = useState<number>(0);
  const [connectedNodes, setConnectedNodes] = useState<Set<string>>(new Set());
  const [isPathConnected, setIsPathConnected] = useState<boolean>(false);
  const [gameStatus, setGameStatus] = useState<'PLAYING' | 'SUCCESS' | 'FAILED'>('PLAYING');
  const [failReason, setFailReason] = useState<string>('');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isStartupHintActive, setIsStartupHintActive] = useState<boolean>(false);
  const [isHintUnlockedForRun, setIsHintUnlockedForRun] = useState<boolean>(false);
  const [buildType, setBuildType] = useState<ConnectorType>('STRAIGHT');

  // Fetch initial profile and levels
  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.error("Error loading profile", e);
    }
  };

  const fetchLevels = async () => {
    try {
      const res = await fetch('/api/levels');
      if (res.ok) {
        const data = await res.json();
        setLevels(data);
      }
    } catch (e) {
      console.error("Error loading levels", e);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchLevels();
  }, []);

  useEffect(() => {
    if (profile && profile.completedLevelIds && profile.completedLevelIds.length === 0 && tourStep === null) {
      setTourStep(0);
    }
  }, [profile]);

  // Show status triggers
  const triggerNotification = (text: string, type: 'success' | 'error') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Upgrades buying handlers
  const handleBuyUpgrade = async (key: string) => {
    try {
      const res = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upgradeKey: key })
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        triggerNotification(`Upgraded ${key.replace(/_/g, ' ')} successful!`, 'success');
      } else {
        triggerNotification(data.error || "Upgrade failed", 'error');
      }
    } catch (e) {
      triggerNotification("API Connection Error", 'error');
    }
  };

  // Use/Buy diagnostic hint handler
  const handleUseHint = async () => {
    if (isHintUnlockedForRun) {
      setShowHint(true);
      return;
    }

    try {
      const res = await fetch('/api/hint/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        setIsHintUnlockedForRun(true);
        setShowHint(true);
        setIsStartupHintActive(false); // Cancel startup timeout since manual is active
        triggerNotification("Diagnostic guide activated (15 Bio-Shards deducted).", 'success');
      } else {
        triggerNotification(data.error || "Failed to activate diagnostic guide", 'error');
      }
    } catch (e) {
      triggerNotification("API Connection Error", 'error');
    }
  };

  // Restore stability handler
  const handleRestoreStability = async (sectorId: string) => {
    try {
      const res = await fetch('/api/stability/cleanse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectorId })
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile);
        triggerNotification("Sector stabilized successfully!", 'success');
      } else {
        triggerNotification(data.error || "Stabilization failed", 'error');
      }
    } catch (e) {
      triggerNotification("API Connection Error", 'error');
    }
  };

  // Gameplay Grid setup
  const initChamber = (lvl: LevelConfig) => {
    setActiveLevel(lvl);
    setActiveTab('CHAMBER');
    setGameStatus('PLAYING');
    setFailReason('');
    setActions([]);
    setStartTime(Date.now());
    setElapsedSeconds(0);
    setVitality(100);
    setNeuralLoad(0);
    setIsFreezeActive(false);
    setFreezeTimeRemaining(0);
    setIsPathConnected(false);
    setConnectedNodes(new Set());

    const diagUpgrade = profile?.upgrades.find(u => u.upgradeKey === "DIAGNOSTIC_PRECISION");
    const diagTier = diagUpgrade ? diagUpgrade.tier : 0;
    setIsHintUnlockedForRun(diagTier > 0);
    if (diagTier > 0) {
      setShowHint(true);
      setIsStartupHintActive(true);
    } else {
      setShowHint(false);
      setIsStartupHintActive(false);
    }

    // Generate hexagonal matrix (axial layout based on level config)
    const newGrid: GridTile[] = [];
    const size = lvl.width || 5;
    
    const isTutorial = tourStep !== null && lvl.levelNumber === 1;

    for (let q = 0; q < size; q++) {
      for (let r = 0; r < size; r++) {
        let type: TileType = 'HEALTHY';
        let connector: ConnectorType = 'NONE';
        let rotation: HexDirection = 0;
        
        // Define endpoints
        if (q === 0 && r === 0) {
          type = 'INPUT';
        } else if (q === size - 1 && r === size - 1) {
          type = 'OUTPUT';
        } else if (isTutorial) {
          // Pre-populate tutorial layout
          if (q === 1 && r === 0) {
            connector = 'STRAIGHT';
            rotation = 2;
          } else if (q === 2 && r === 0) {
            connector = 'CURVE_120';
            rotation = 3;
          } else if (q === 2 && r === 1) {
            connector = 'STRAIGHT';
            rotation = 0;
          } else if (q === 2 && r === 2) {
            // This is the active piece left as NONE for the player to click!
            connector = 'NONE';
            rotation = 0;
          } else if (q === 2 && r === 3) {
            connector = 'STRAIGHT';
            rotation = 0;
          } else if (q === 2 && r === 4) {
            connector = 'CURVE_120';
            rotation = 0;
          } else if (q === 3 && r === 4) {
            connector = 'STRAIGHT';
            rotation = 2;
          } else {
            // Add a few blocks for visual aesthetic
            if (q === 0 && r === 2) type = 'BLOCKED';
            if (q === 3 && r === 1) type = 'BLOCKED';
          }
        } else {
          // Deterministic hazards using coordinates and seed
          const val = (q * 13 + r * 7 + lvl.seed) % 10;
          if (val === 1 || val === 4) {
            type = 'BLOCKED';
          } else if (val === 2) {
            type = 'CORRUPTED';
          } else if (val === 5) {
            type = 'SHARD_CACHE';
          }
        }

        newGrid.push({
          q,
          r,
          type,
          connector,
          rotation,
          isLocked: false
        });
      }
    }
    setGrid(newGrid);
  };

  // Timer loop for play durations
  useEffect(() => {
    if (activeTab !== 'CHAMBER' || gameStatus !== 'PLAYING' || !activeLevel) return;

    const interval = setInterval(() => {
      const delta = (Date.now() - startTime) / 1000;
      setElapsedSeconds(delta);

      // Handle chemical injector freeze time
      let frozen = false;
      if (isFreezeActive) {
        const remaining = Math.max(0, freezeTimeRemaining - 1);
        setFreezeTimeRemaining(remaining);
        if (remaining <= 0) {
          setIsFreezeActive(false);
        }
        frozen = true;
      }

      // Handle diagnostic startup hint timeout
      if (isStartupHintActive) {
        const diagUpgrade = profile?.upgrades.find(u => u.upgradeKey === "DIAGNOSTIC_PRECISION");
        const diagTier = diagUpgrade ? diagUpgrade.tier : 0;
        if (diagTier === 1 && delta >= 3) {
          setShowHint(false);
          setIsStartupHintActive(false);
        } else if (diagTier === 2 && delta >= 5) {
          setShowHint(false);
          setIsStartupHintActive(false);
        }
      }

      // Calculate vitality decay
      if (!frozen) {
        const sectorStability = profile?.sectorStability.find(s => s.sectorId === activeLevel.sectorId)?.stabilityScore || 100;
        let stabilityPenalty = 1.0;
        if (sectorStability < 30.0) {
          stabilityPenalty = 1.15; // 15% decay speed penalty
        }

        // Corruption multiplier
        const connectedCorrupted = grid.filter(t => t.type === 'CORRUPTED' && connectedNodes.has(`${t.q},${t.r}`)).length;
        const decayMultiplier = 1.0 + connectedCorrupted * 0.25;

        const currentDecay = activeLevel.baseDecayRate * stabilityPenalty * decayMultiplier;
        setVitality(prev => {
          const next = Math.max(0, prev - currentDecay);
          if (next <= 0) {
            setGameStatus('FAILED');
            setFailReason("Subject Vitality depleted to 0%. Brain dead.");
          }
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTab, gameStatus, startTime, isFreezeActive, freezeTimeRemaining, grid, connectedNodes, activeLevel, profile, isStartupHintActive]);

  // Hex directional connectivity offsets
  const HEX_DIRECTIONS = [
    { dq: 0, dr: -1 }, // N
    { dq: 1, dr: -1 }, // NE
    { dq: 1, dr: 0 },  // SE
    { dq: 0, dr: 1 },  // S
    { dq: -1, dr: 1 }, // SW
    { dq: -1, dr: 0 }  // NW
  ];

  const getOpenDirections = (type: ConnectorType, rotation: HexDirection): Set<HexDirection> => {
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
  };

  // Re-calculate load and solve path finding in real-time
  useEffect(() => {
    if (activeTab !== 'CHAMBER' || !activeLevel) return;

    // 1. Calculate Load
    let totalCompLoad = 0;
    for (const tile of grid) {
      if (tile.connector === 'NONE') continue;
      if (tile.connector === 'STRAIGHT') totalCompLoad += 10;
      else if (tile.connector === 'CURVE_60') totalCompLoad += 15;
      else if (tile.connector === 'CURVE_120') totalCompLoad += 20;
      else if (tile.connector === 'SPLIT_Y') totalCompLoad += 30;
    }

    const rotationActions = actions.filter(a => a.actionType === 'ROTATE').length;
    const actionFrictionLoad = rotationActions * 2;
    const finalLoad = totalCompLoad + actionFrictionLoad;
    setNeuralLoad(finalLoad);

    // Dynamic overclock fail
    const maxLoadUpgrade = profile?.upgrades.find(u => u.upgradeKey === "MAX_LOAD_BUFFER");
    const bonusLoadPercent = maxLoadUpgrade ? maxLoadUpgrade.tier * 0.05 : 0;
    const allowedLoad = Math.round(activeLevel.maxNeuralLoad * (1 + bonusLoadPercent));

    if (finalLoad > allowedLoad) {
      setGameStatus('FAILED');
      setFailReason(`Systemic Overclock! Load reached ${finalLoad} MS/Ph (Threshold: ${allowedLoad})`);
      return;
    }

    // 2. Perform graph BFS to check path alignment
    const gridMap = new Map<string, GridTile>();
    let inputNode: GridTile | null = null;
    let outputNode: GridTile | null = null;

    for (const tile of grid) {
      const key = `${tile.q},${tile.r}`;
      gridMap.set(key, tile);
      if (tile.type === 'INPUT') inputNode = tile;
      if (tile.type === 'OUTPUT') outputNode = tile;
    }

    if (!inputNode || !outputNode) return;

    const visited = new Set<string>();
    const queue: GridTile[] = [inputNode];
    visited.add(`${inputNode.q},${inputNode.r}`);

    let connects = false;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.type === 'OUTPUT') {
        connects = true;
      }

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

    setConnectedNodes(visited);
    setIsPathConnected(connects);

  }, [grid, actions, activeTab, activeLevel, profile]);

  // Click handler for grid cells
  const handleTileClick = (q: number, r: number) => {
    if (gameStatus !== 'PLAYING') return;

    const targetIndex = grid.findIndex(t => t.q === q && t.r === r);
    if (targetIndex === -1) return;

    const tile = grid[targetIndex];

    // Default flow: click healthy tile to place or rotate
    if (tile.type === 'BLOCKED' || tile.type === 'INPUT' || tile.type === 'OUTPUT') return;

    const updated = [...grid];

    // Dismantle tool selected
    if (buildType === 'NONE') {
      if (tile.connector !== 'NONE') {
        if (tile.isLocked) {
          triggerNotification("This component is sutured in place.", 'error');
        } else {
          updated[targetIndex] = { ...tile, connector: 'NONE', rotation: 0 };
          setActions(prev => [...prev, { timestampMs: Date.now() - startTime, actionType: 'DELETE', q, r }]);
          triggerNotification("Component dismantled.", 'success');
        }
      }
      setGrid(updated);
      return;
    }

    if (tile.connector === 'NONE') {
      // Place selected connector type
      updated[targetIndex] = { ...tile, connector: buildType, rotation: 0 };
      setActions(prev => [...prev, { timestampMs: Date.now() - startTime, actionType: 'PLACE', q, r, param: buildType }]);
    } else if (tile.isLocked) {
      // Piece locked, ignore clicks
      triggerNotification("This component is sutured in place.", 'error');
    } else if (tile.connector !== buildType) {
      // Swap connector type to currently selected build type, resetting rotation to 0
      updated[targetIndex] = { ...tile, connector: buildType, rotation: 0 };
      setActions(prev => [...prev, { timestampMs: Date.now() - startTime, actionType: 'PLACE', q, r, param: buildType }]);
    } else {
      // Same connector type, rotate it
      const nextRotation = ((tile.rotation + 1) % 6) as HexDirection;
      updated[targetIndex] = { ...tile, rotation: nextRotation };
      setActions(prev => [...prev, { timestampMs: Date.now() - startTime, actionType: 'ROTATE', q, r, param: nextRotation }]);
    }

    setGrid(updated);
  };

  // Touch Gestures for mobile (Long press to delete/dismantle)
  const handleTouchStart = (q: number, r: number) => {
    isLongPressRef.current = false;
    touchTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      handleTileRightClick(q, r);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500ms hold
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    if (isLongPressRef.current) {
      e.preventDefault(); // Prevent standard click on release
      e.stopPropagation();
    }
  };

  const handleTouchMove = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  // Right click handler to instantly delete a connector
  const handleTileRightClick = (q: number, r: number) => {
    if (gameStatus !== 'PLAYING') return;

    const targetIndex = grid.findIndex(t => t.q === q && t.r === r);
    if (targetIndex === -1) return;

    const tile = grid[targetIndex];
    if (tile.type === 'BLOCKED' || tile.type === 'INPUT' || tile.type === 'OUTPUT') return;
    if (tile.connector === 'NONE') return;

    if (tile.isLocked) {
      triggerNotification("This component is sutured in place.", 'error');
      return;
    }

    const updated = [...grid];
    updated[targetIndex] = { ...tile, connector: 'NONE', rotation: 0 };
    setGrid(updated);
    setActions(prev => [...prev, { timestampMs: Date.now() - startTime, actionType: 'DELETE', q, r }]);
    triggerNotification("Component deleted.", 'success');
  };



  // Submit level solution to server for validation
  const handleSubmitSolution = async () => {
    if (!activeLevel) return;

    const snapshot: GameStateSnapshotDto = {
      levelId: activeLevel.id,
      seed: activeLevel.seed,
      grid: grid,
      actions: actions,
      elapsedSeconds: parseFloat(elapsedSeconds.toFixed(2)),
      finalVitality: parseFloat(vitality.toFixed(1)),
      finalNeuralLoad: neuralLoad
    };

    try {
      const res = await fetch('/api/level/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setGameStatus('SUCCESS');
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00c2b2', '#cd7f32', '#8b4513']
        });
        setProfile(data.profile);
      } else {
        setGameStatus('FAILED');
        setFailReason(data.reason || "Server rejected solution validation.");
        if (data.profile) setProfile(data.profile);
      }
    } catch (e) {
      triggerNotification("Validation Server API error", 'error');
    }
  };

  // Auxiliary Hex drawing helper
  const drawHexPath = (cx: number, cy: number, size: number) => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      const x = cx + size * Math.cos(angle);
      const y = cy + size * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  // Dijkstra pathfinder to find optimal path avoiding BLOCKED tiles
  const findPathDijkstra = (currentGrid: GridTile[]): { q: number; r: number }[] | null => {
    const gridMap = new Map<string, GridTile>();
    let inputNode: GridTile | null = null;
    let outputNode: GridTile | null = null;

    for (const tile of currentGrid) {
      gridMap.set(`${tile.q},${tile.r}`, tile);
      if (tile.type === 'INPUT') inputNode = tile;
      if (tile.type === 'OUTPUT') outputNode = tile;
    }

    if (!inputNode || !outputNode) return null;

    interface DijkstraNode {
      q: number;
      r: number;
      dist: number;
      parent: DijkstraNode | null;
    }

    const openSet: DijkstraNode[] = [{ q: inputNode.q, r: inputNode.r, dist: 0, parent: null }];
    const closedSet = new Set<string>();
    let endNode: DijkstraNode | null = null;

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.dist - b.dist);
      const current = openSet.shift()!;
      const currentKey = `${current.q},${current.r}`;

      if (closedSet.has(currentKey)) continue;
      closedSet.add(currentKey);

      if (current.q === outputNode.q && current.r === outputNode.r) {
        endNode = current;
        break;
      }

      for (const dir of HEX_DIRECTIONS) {
        const nextQ = current.q + dir.dq;
        const nextR = current.r + dir.dr;
        const nextKey = `${nextQ},${nextR}`;

        if (closedSet.has(nextKey)) continue;

        const neighbor = gridMap.get(nextKey);
        if (neighbor) {
          let weight = 1;
          if (neighbor.type === 'BLOCKED') weight = 10;
          else if (neighbor.type === 'CORRUPTED') weight = 2;

          const nextDist = current.dist + weight;
          const existingIndex = openSet.findIndex(n => n.q === nextQ && n.r === nextR);

          if (existingIndex !== -1) {
            if (openSet[existingIndex].dist > nextDist) {
              openSet[existingIndex].dist = nextDist;
              openSet[existingIndex].parent = current;
            }
          } else {
            openSet.push({ q: nextQ, r: nextR, dist: nextDist, parent: current });
          }
        }
      }
    }

    if (!endNode) return null;

    const path: { q: number; r: number }[] = [];
    let curr: DijkstraNode | null = endNode;
    while (curr) {
      path.push({ q: curr.q, r: curr.r });
      curr = curr.parent;
    }
    path.reverse();
    return path;
  };

  const getDirectionIndex = (dq: number, dr: number): number => {
    for (let i = 0; i < HEX_DIRECTIONS.length; i++) {
      if (HEX_DIRECTIONS[i].dq === dq && HEX_DIRECTIONS[i].dr === dr) {
        return i;
      }
    }
    return -1;
  };

  const getRequiredConnector = (d1: number, d2: number): { connector: ConnectorType, rotation: HexDirection } | null => {
    if (d1 === -1 || d2 === -1 || d1 === d2) return null;
    const diff = (d2 - d1 + 6) % 6;
    if (diff === 3) {
      return { connector: 'STRAIGHT', rotation: (d1 % 3) as HexDirection };
    } else if (diff === 1 || diff === 5) {
      return { connector: 'CURVE_60', rotation: (diff === 1 ? d1 : d2) as HexDirection };
    } else if (diff === 2 || diff === 4) {
      return { connector: 'CURVE_120', rotation: (diff === 2 ? d1 : d2) as HexDirection };
    }
    return null;
  };

  // Hint calculations
  const pathCoords = useMemo(() => {
    if (!activeLevel || !grid.length) return null;
    return findPathDijkstra(grid);
  }, [grid, activeLevel]);

  const hintMap = useMemo(() => {
    const map = new Map<string, { connector: ConnectorType; rotation: HexDirection }>();
    if (!activeLevel || !grid.length || !pathCoords || pathCoords.length < 3) return map;

    for (let i = 1; i < pathCoords.length - 1; i++) {
      const prev = pathCoords[i - 1];
      const curr = pathCoords[i];
      const next = pathCoords[i + 1];

      const d1 = getDirectionIndex(prev.q - curr.q, prev.r - curr.r);
      const d2 = getDirectionIndex(next.q - curr.q, next.r - curr.r);

      const req = getRequiredConnector(d1, d2);
      if (req) {
        map.set(`${curr.q},${curr.r}`, req);
      }
    }
    return map;
  }, [grid, activeLevel, pathCoords]);

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-[#050505] overflow-hidden select-none touch-manipulation">
      {/* High contrast, weathered Punic bronze device framing or fullscreen mobile container */}
      <div 
        style={isMobile ? {
          width: '100%',
          height: '100%',
          maxHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column'
        } : {
          transform: `scale(${deviceScale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.1s ease-out'
        }}
        className={isMobile 
          ? "relative flex flex-col overflow-hidden bg-[#050505] safe-pb safe-pt" 
          : "relative flex h-[860px] w-[390px] flex-col overflow-hidden bg-[#050505] rounded-3xl border-4 border-[#8b4513] shadow-[0_0_35px_rgba(139,69,19,0.3)]"
        }
      >
        
        {/* Status notification toast */}
        {notification && (
          <div className={`absolute top-14 left-4 right-4 z-50 p-3 rounded text-center border font-data-mono text-xs clipped-btn transition-all duration-300 ${
            notification.type === 'success' 
              ? 'bg-[#002020] border-[#00ffff] text-[#00ffff]' 
              : 'bg-[#300000] border-[#ffb4ab] text-[#ffb4ab]'
          }`}>
            {notification.text}
          </div>
        )}

        {/* Neoclassical Header Bar */}
        <div className="flex h-12 items-center justify-between border-b border-[#8b4513]/40 bg-[#0e0e0e] px-4 shrink-0">
          <div className="flex items-center gap-1">
            <Activity className="h-4 w-4 text-[#00ffff] pulse-energy" />
            <span className="font-data-mono text-[10px] text-[#00ffff] cyan-glow">DOCK_STABLE</span>
          </div>
          <div className="font-headline-sm text-sm italic tracking-widest text-[#cd7f32]">
            BIO-ARCHITECT
          </div>
          <div className="flex items-center gap-1 font-data-mono text-[11px] text-[#cd7f32]">
            <span>{profile?.bioShards || 0}</span>
            <span className="text-[#00ffff] cyan-glow">◆</span>
          </div>
        </div>

        {/* View content switch */}
        <div className={`flex-1 relative flex flex-col px-4 py-3 ${
          activeTab === 'CHAMBER' ? 'overflow-hidden' : 'overflow-y-auto'
        }`}>
          
          {/* VIEW: SPLASH SCREEN */}
          {activeTab === 'SPLASH' && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="relative mb-6 h-36 w-36 items-center justify-center flex">
                {/* Glowing cyan Tanit symbol */}
                <div className="absolute inset-0 rounded-full border border-[#00ffff]/20 animate-ping" />
                <svg viewBox="0 0 100 100" className="h-28 w-28 text-[#00ffff] pulse-energy">
                  {/* Tanit logo */}
                  <circle cx="50" cy="25" r="12" fill="none" stroke="#00c2b2" strokeWidth="4" />
                  <line x1="15" y1="48" x2="85" y2="48" stroke="#00c2b2" strokeWidth="4" strokeLinecap="round" />
                  <path d="M50,48 L15,85 L85,85 Z" fill="none" stroke="#00c2b2" strokeWidth="4" strokeLinejoin="round" />
                </svg>
              </div>

              <h1 className="font-headline-lg text-[#e5e2e1] leading-none mb-1">NEURAL-CARTHAGE</h1>
              <p className="font-label-caps text-[#cd7f32] tracking-[0.2em] text-xs mb-8">BIO-ARCHITECT V1.0</p>
              
              <button 
                onClick={() => setActiveTab('DASHBOARD')}
                className="w-full bg-[#8b4513] border border-[#cd7f32] p-4 text-[#e5e2e1] font-label-caps tracking-widest hover:border-[#00ffff] hover:text-[#00ffff] hover:cyan-glow transition-all duration-300 clipped-btn active:scale-95"
              >
                Infiltrate Cognitive Dock
              </button>
              
              <button 
                onClick={() => {
                  setTourStep(0);
                  setActiveTab('DASHBOARD');
                }}
                className="w-full mt-3 bg-[#131313] border border-[#cd7f32]/50 p-3 text-[#cd7f32] font-label-caps tracking-widest hover:border-[#00ffff] hover:text-[#00ffff] hover:cyan-glow transition-all duration-300 clipped-btn active:scale-95"
              >
                Initiate Operative Training
              </button>
            </div>
          )}

          {/* VIEW: MASTER DASHBOARD */}
          {activeTab === 'DASHBOARD' && (
            <div className="flex flex-col gap-4 py-2">
              <div className="glass-panel p-4 bronze-frame">
                <p className="font-label-caps text-[#cd7f32] mb-1 text-[10px]">Cabanist Operative</p>
                <h2 className="font-headline-md text-white mb-3">cabanist_1</h2>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-[#0e0e0e] border border-[#8b4513]/40 p-2">
                    <p className="font-label-caps text-gray-500 text-[8px]">Bio-Shard reserves</p>
                    <p className="font-data-mono text-[#00ffff] text-sm font-bold">{profile?.bioShards} ◆</p>
                  </div>
                  <div className="bg-[#0e0e0e] border border-[#8b4513]/40 p-2">
                    <p className="font-label-caps text-gray-500 text-[8px]">Current Sector</p>
                    <p className="font-data-mono text-[#cd7f32] text-[10px]">{profile?.activeSectorId.replace(/_/g, ' ').toUpperCase()}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="font-label-caps text-[#cd7f32] text-xs">Active Commands</p>
                
                <button 
                  onClick={() => setActiveTab('MAP')}
                  className="flex items-center justify-between border border-[#8b4513]/40 bg-[#1c1b1b] p-4 hover:border-[#00ffff] text-left transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <Compass className="h-5 w-5 text-[#00ffff]" />
                    <div>
                      <h4 className="font-headline-sm text-sm text-white">Neural Map Selection</h4>
                      <p className="font-body-md text-xs text-gray-400">Launch neuro-splicing operations</p>
                    </div>
                  </div>
                </button>

                <button 
                  onClick={() => setActiveTab('UPGRADES')}
                  className="flex items-center justify-between border border-[#8b4513]/40 bg-[#1c1b1b] p-4 hover:border-[#00ffff] text-left transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <KeyRound className="h-5 w-5 text-[#cd7f32]" />
                    <div>
                      <h4 className="font-headline-sm text-sm text-white">Temple of Tanit</h4>
                      <p className="font-body-md text-xs text-gray-400">Upgrade mechanical cyber-rigs</p>
                    </div>
                  </div>
                </button>



                <button 
                  onClick={() => setActiveTab('ORACLE')}
                  className="flex items-center justify-between border border-[#8b4513]/40 bg-[#1c1b1b] p-4 hover:border-[#00ffff] text-left transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <Eye className="h-5 w-5 text-purple-500" />
                    <div>
                      <h4 className="font-headline-sm text-sm text-white">Oracle Core Decrees</h4>
                      <p className="font-body-md text-xs text-gray-400">Read communications from the Blind Oracle</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* VIEW: NEURAL MAP */}
          {activeTab === 'MAP' && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-white">Sectors of Carthage</h3>
                <button onClick={() => setActiveTab('DASHBOARD')} className="font-label-caps text-[10px] text-gray-400 hover:text-white">Back</button>
              </div>

              {SECTORS.map((sector) => {
                const isSectorUnlocked = profile?.unlockedSectors.includes(sector.id);
                const stability = profile?.sectorStability.find(s => s.sectorId === sector.id)?.stabilityScore || 100;
                const sectorLevels = levels
                  .filter(lvl => lvl.sectorId === sector.id)
                  .sort((a, b) => a.levelNumber - b.levelNumber);

                return (
                  <div key={sector.id} className={`border p-4 glass-panel mb-4 ${
                    isSectorUnlocked ? 'border-[#8b4513]/60' : 'border-gray-800 opacity-50'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-headline-sm text-base text-white">{sector.name}</h4>
                        <p className="font-body-md text-[10px] text-gray-500">{sector.desc}</p>
                      </div>
                      {isSectorUnlocked ? (
                        <div className="text-right">
                          <span className={`font-data-mono text-[10px] ${
                            stability < 30 ? 'text-[#ffb4ab] pulse-energy' : 'text-[#00ffff]'
                          }`}>
                            STABILITY: {stability}%
                          </span>
                        </div>
                      ) : (
                        <Lock className="h-4 w-4 text-gray-600" />
                      )}
                    </div>

                    {isSectorUnlocked && stability < 30.0 && (
                      <div className="bg-[#300000] border border-[#ffb4ab]/40 p-2 mb-3 rounded flex gap-2 items-start">
                        <ShieldAlert className="h-4 w-4 text-[#ffb4ab] shrink-0 mt-0.5" />
                        <p className="font-body-md text-[9px] text-[#ffdad6]">
                          Tissue decay multiplier active! +15% Vitality decay speeds. Cleansing required.
                        </p>
                      </div>
                    )}

                    {isSectorUnlocked && stability < 100 && (
                      <button 
                        onClick={() => handleRestoreStability(sector.id)}
                        className="w-full bg-[#002020] border border-[#00ffff] p-1.5 mb-3 font-label-caps text-[9px] text-[#00ffff]"
                      >
                        Cleanse (150 ◆)
                      </button>
                    )}

                    <div className="flex flex-col gap-2 mt-2">
                      {sectorLevels.map((lvl, idx) => {
                        const isLevelUnlocked = isSectorUnlocked && (
                          idx === 0 || 
                          profile?.completedLevelIds?.includes(sectorLevels[idx - 1].id)
                        );
                        const isCompleted = profile?.completedLevelIds?.includes(lvl.id);

                        return (
                          <div key={lvl.id} className={`flex items-center justify-between p-2 border ${
                            isLevelUnlocked 
                              ? isCompleted ? 'border-[#00ffff]/40 bg-[#002020]/10' : 'border-[#8b4513]/30 bg-[#0c0c0c]' 
                              : 'border-gray-800/40 opacity-40'
                          }`}>
                            <div>
                              <p className="font-data-mono text-[11px] text-white">
                                Level {lvl.levelNumber}: {lvl.isShifting ? 'Shifting Synapse' : `Grid Matrix ${lvl.width}x${lvl.height}`}
                              </p>
                              <p className="font-body-md text-[9px] text-gray-500">
                                Max Load: {lvl.maxNeuralLoad} MS/Ph | Decay: {lvl.baseDecayRate}/s
                              </p>
                            </div>

                            <div className="flex items-center">
                              {isCompleted && (
                                <span className="font-label-caps text-[9px] text-[#00ffff] cyan-glow mr-2">Cleared ◆</span>
                              )}

                              {isLevelUnlocked ? (
                                <button 
                                  onClick={() => initChamber(lvl)}
                                  className="bg-[#8b4513]/40 border border-[#cd7f32] px-3 py-1 font-label-caps text-[9px] text-white hover:border-[#00ffff] hover:text-[#00ffff] transition-all duration-200"
                                >
                                  Stitch
                                </button>
                              ) : (
                                <Lock className="h-3 w-3 text-gray-700 mr-2" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW: SURGERY CHAMBER GRID PUZZLE */}
          {activeTab === 'CHAMBER' && activeLevel && (
            <div className="flex flex-col h-full py-1 justify-between select-none">

              {/* Chamber Navigation Bar */}
              <div className="flex items-center justify-between mb-2">
                <button 
                  onClick={() => setActiveTab('MAP')}
                  className="flex items-center gap-1 bg-[#1c1b1b] border border-[#8b4513]/40 px-3 py-1.5 font-label-caps text-[9px] text-gray-400 hover:border-[#00ffff] hover:text-[#00ffff] transition-all duration-200"
                >
                  ← MAP
                </button>
                <span className="font-data-mono text-[9px] text-[#cd7f32]">
                  LVL {activeLevel.levelNumber} — {activeLevel.sectorId.replace(/_/g, ' ').toUpperCase()}
                </span>
                <button 
                  onClick={() => initChamber(activeLevel)}
                  className="flex items-center gap-1 bg-[#1c1b1b] border border-[#8b4513]/40 px-3 py-1.5 font-label-caps text-[9px] text-gray-400 hover:border-[#ffb4ab] hover:text-[#ffb4ab] transition-all duration-200"
                >
                  ↻ RESTART
                </button>
              </div>

              {/* Telemetry Display */}
              <div className="flex justify-between bg-[#0e0e0e] border border-[#8b4513]/40 p-2 text-center text-[10px]">
                <div>
                  <p className="font-label-caps text-[#cd7f32] text-[8px]">Vitality degradation</p>
                  <p className={`font-data-mono text-sm font-bold flex items-center justify-center gap-1 ${
                    vitality < 25 ? 'text-[#ffb4ab] pulse-energy' : 'text-white'
                  }`}>
                    <Heart className="h-3.5 w-3.5 fill-current text-red-500" />
                    {vitality.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="font-label-caps text-[#cd7f32] text-[8px]">Neural latency load</p>
                  <p className="font-data-mono text-sm font-bold text-[#00ffff] cyan-glow flex items-center justify-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-[#00ffff]" />
                    {neuralLoad} MS/Ph
                  </p>
                </div>
              </div>

              {/* Hexagonal SVG Grid Render */}
              <div className="my-1 flex justify-center items-center flex-1 min-h-[220px] max-h-[380px] border border-[#8b4513]/20 bg-[#070707] relative overflow-hidden">
                
                {/* Overclock failure modal */}
                {gameStatus === 'FAILED' && (
                  <div className="absolute inset-0 z-30 bg-black/90 flex flex-col justify-center items-center p-6 text-center border border-[#ffb4ab]">
                    <Skull className="h-14 w-14 text-red-500 mb-3 animate-bounce" />
                    <h3 className="font-headline-md text-red-400 mb-2">Subject Terminated</h3>
                    <p className="font-body-md text-xs text-gray-400 mb-4">{failReason}</p>
                    <button 
                      onClick={() => initChamber(activeLevel)}
                      className="bg-red-950 border border-red-500 p-2 font-label-caps text-xs text-white hover:bg-red-900 w-full"
                    >
                      Initialize Cleansing Cycle
                    </button>
                    <button 
                      onClick={() => setActiveTab('MAP')}
                      className="font-label-caps text-[9px] text-gray-500 hover:text-white mt-4"
                    >
                      Return to Map
                    </button>
                  </div>
                )}

                {/* Procedure Success modal */}
                {gameStatus === 'SUCCESS' && (
                  <div className="absolute inset-0 z-30 bg-black/95 flex flex-col justify-center items-center p-6 text-center border border-[#00ffff]">
                    <CheckCircle2 className="h-14 w-14 text-[#00ffff] mb-3 animate-pulse" />
                    <h3 className="font-headline-md text-[#00ffff] cyan-glow mb-2">Splicing Verified</h3>
                    <p className="font-body-md text-xs text-gray-400 mb-4">Neural connectivity fully aligned. Implant responsive.</p>
                    <div className="w-full bg-[#0e0e0e] border border-[#8b4513]/40 p-3 mb-6">
                      <p className="font-label-caps text-[9px] text-gray-500">Harvested Bio-Shards</p>
                      <p className="font-data-mono text-xl text-[#00ffff] font-bold">
                        +{50 + Math.round(vitality * 0.5)} ◆
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        fetchProfile();
                        setActiveTab('MAP');
                        if (tourStep !== null) {
                          setTourStep(null); // End the tour!
                        }
                      }}
                      className="bg-[#003737] border border-[#00ffff] p-2 font-label-caps text-xs text-white hover:bg-[#004f4f] w-full"
                    >
                      Exit Chamber
                    </button>
                  </div>
                )}

                {(() => {
                  const size = activeLevel?.width || 5;
                  const hexSize = 27;
                  const padding = 35;
                  const width = hexSize * 1.5 * (size - 1) + hexSize * 2 + padding * 2;
                  const height = hexSize * Math.sqrt(3) * ((size - 1) * 1.5) + hexSize * 2 + padding * 2;
                  const maxDim = Math.max(width, height);
                  const viewBoxString = `-${padding} -${padding} ${maxDim} ${maxDim}`;
                  return (
                    <svg viewBox={viewBoxString} className="w-full h-full select-none">
                      {grid.map((tile) => {
                        // Coordinates conversion for axial spacing
                        const cx = hexSize * 1.5 * tile.q + 40;
                        const cy = hexSize * Math.sqrt(3) * (tile.r + tile.q / 2) + 40;
                        
                        const isConnected = connectedNodes.has(`${tile.q},${tile.r}`);
                        
                        // Style coloring based on type
                        let strokeColor = 'rgba(205,127,50,0.3)'; // base bronze
                        let fillColor = 'rgba(19,19,19,0.7)';
                        
                        if (tile.type === 'INPUT') {
                          strokeColor = '#00c2b2';
                          fillColor = 'rgba(0,194,178,0.1)';
                        } else if (tile.type === 'OUTPUT') {
                          strokeColor = '#00c2b2';
                          fillColor = isPathConnected ? 'rgba(0,194,178,0.15)' : 'rgba(0,194,178,0.03)';
                        } else if (tile.type === 'BLOCKED') {
                          strokeColor = '#8b4513';
                          fillColor = 'rgba(139,69,19,0.2)';
                        } else if (tile.type === 'CORRUPTED') {
                          strokeColor = '#ab0b1c';
                          fillColor = 'rgba(171,11,28,0.1)';
                        } else if (tile.type === 'SHARD_CACHE') {
                          strokeColor = '#ffb779';
                          fillColor = 'rgba(255,183,121,0.05)';
                        }

                        if (tile.isLocked) {
                          strokeColor = '#cd7f32';
                        }

                        return (
                          <g 
                            key={`${tile.q},${tile.r}`} 
                            onClick={() => handleTileClick(tile.q, tile.r)} 
                            onContextMenu={(e) => {
                              e.preventDefault();
                              handleTileRightClick(tile.q, tile.r);
                            }}
                            onTouchStart={() => handleTouchStart(tile.q, tile.r)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchMove}
                            className="cursor-pointer"
                          >
                            {/* Hexagon shape */}
                            <polygon 
                              points={drawHexPath(cx, cy, hexSize)} 
                              fill={fillColor} 
                              stroke={strokeColor} 
                              strokeWidth={tile.isLocked ? 2 : 1}
                            />

                            {/* Ghost/Hint connector overlay */}
                            {showHint && (() => {
                              const hintVal = hintMap.get(`${tile.q},${tile.r}`);
                              if (!hintVal || (tile.connector === hintVal.connector && tile.rotation === hintVal.rotation)) return null;

                              return (
                                <g transform={`rotate(${hintVal.rotation * 60}, ${cx}, ${cy})`} pointerEvents="none" opacity="0.4">
                                  {/* Straight: N-S */}
                                  {hintVal.connector === 'STRAIGHT' && (
                                    <line 
                                      x1={cx} y1={cy - hexSize} 
                                      x2={cx} y2={cy + hexSize} 
                                      stroke="#00c2b2" 
                                      strokeWidth="3.5" 
                                      strokeLinecap="round" 
                                      strokeDasharray="2,2"
                                    />
                                  )}

                                  {/* 60 deg: N to NE */}
                                  {hintVal.connector === 'CURVE_60' && (
                                    <path 
                                      d={`M ${cx} ${cy - hexSize} Q ${cx + 10} ${cy - 10} ${cx + hexSize * Math.cos(-Math.PI/6)} ${cy + hexSize * Math.sin(-Math.PI/6)}`} 
                                      fill="none" 
                                      stroke="#00c2b2" 
                                      strokeWidth="3.5" 
                                      strokeLinecap="round"
                                      strokeDasharray="2,2"
                                    />
                                  )}

                                  {/* 120 deg: N to SE */}
                                  {hintVal.connector === 'CURVE_120' && (
                                    <path 
                                      d={`M ${cx} ${cy - hexSize} Q ${cx + 5} ${cy + 5} ${cx + hexSize * Math.cos(Math.PI/6)} ${cy + hexSize * Math.sin(Math.PI/6)}`} 
                                      fill="none" 
                                      stroke="#00c2b2" 
                                      strokeWidth="3.5" 
                                      strokeLinecap="round"
                                      strokeDasharray="2,2"
                                    />
                                  )}

                                  {/* Split-Y: Inlets N, SE, SW */}
                                  {hintVal.connector === 'SPLIT_Y' && (
                                    <g>
                                      <line 
                                        x1={cx} y1={cy} 
                                        x2={cx} y2={cy - hexSize} 
                                        stroke="#00c2b2" 
                                        strokeWidth="3.5" 
                                        strokeLinecap="round"
                                        strokeDasharray="2,2"
                                      />
                                      <line 
                                        x1={cx} y1={cy} 
                                        x2={cx + hexSize * Math.cos(Math.PI/6)} y2={cy + hexSize * Math.sin(Math.PI/6)} 
                                        stroke="#00c2b2" 
                                        strokeWidth="3.5" 
                                        strokeLinecap="round"
                                        strokeDasharray="2,2"
                                      />
                                      <line 
                                        x1={cx} y1={cy} 
                                        x2={cx + hexSize * Math.cos(5*Math.PI/6)} y2={cy + hexSize * Math.sin(5*Math.PI/6)} 
                                        stroke="#00c2b2" 
                                        strokeWidth="3.5" 
                                        strokeLinecap="round"
                                        strokeDasharray="2,2"
                                      />
                                    </g>
                                  )}
                                </g>
                              );
                            })()}

                            {/* Node Label details */}
                            {tile.type === 'INPUT' && (
                              <text x={cx} y={cy + 4} fill="#00c2b2" textAnchor="middle" className="font-label-caps" fontSize="8">STEM</text>
                            )}
                            {tile.type === 'OUTPUT' && (
                              <text x={cx} y={cy + 4} fill="#00c2b2" textAnchor="middle" className="font-label-caps" fontSize="8">ORGAN</text>
                            )}
                            {tile.type === 'BLOCKED' && (
                              <text x={cx} y={cy + 4} fill="#8b4513" textAnchor="middle" className="font-headline-sm" fontSize="16">☠</text>
                            )}
                            {tile.type === 'CORRUPTED' && !isConnected && (
                              <circle cx={cx} cy={cy} r="4" fill="#ab0b1c" className="animate-pulse" />
                            )}
                            {tile.type === 'SHARD_CACHE' && (
                              <text x={cx} y={cy + 4} fill="#ffb779" textAnchor="middle" fontSize="10">◆</text>
                            )}

                            {/* Connector layout lines */}
                            {tile.connector !== 'NONE' && (
                              <g transform={`rotate(${tile.rotation * 60}, ${cx}, ${cy})`}>
                                
                                {/* Straight: N-S */}
                                {tile.connector === 'STRAIGHT' && (
                                  <line 
                                    x1={cx} y1={cy - hexSize} 
                                    x2={cx} y2={cy + hexSize} 
                                    stroke={isConnected ? '#00c2b2' : '#cd7f32'} 
                                    strokeWidth="4" 
                                    strokeLinecap="round" 
                                    className={isConnected ? "pulse-energy" : ""}
                                  />
                                )}

                                {/* 60 deg: N to NE */}
                                {tile.connector === 'CURVE_60' && (
                                  <path 
                                    d={`M ${cx} ${cy - hexSize} Q ${cx + 10} ${cy - 10} ${cx + hexSize * Math.cos(-Math.PI/6)} ${cy + hexSize * Math.sin(-Math.PI/6)}`} 
                                    fill="none" 
                                    stroke={isConnected ? '#00c2b2' : '#cd7f32'} 
                                    strokeWidth="4" 
                                    strokeLinecap="round"
                                    className={isConnected ? "pulse-energy" : ""}
                                  />
                                )}

                                {/* 120 deg: N to SE */}
                                {tile.connector === 'CURVE_120' && (
                                  <path 
                                    d={`M ${cx} ${cy - hexSize} Q ${cx + 5} ${cy + 5} ${cx + hexSize * Math.cos(Math.PI/6)} ${cy + hexSize * Math.sin(Math.PI/6)}`} 
                                    fill="none" 
                                    stroke={isConnected ? '#00c2b2' : '#cd7f32'} 
                                    strokeWidth="4" 
                                    strokeLinecap="round"
                                    className={isConnected ? "pulse-energy" : ""}
                                  />
                                )}

                                {/* Split-Y: Inlets N, SE, SW */}
                                {tile.connector === 'SPLIT_Y' && (
                                  <g>
                                    <line 
                                      x1={cx} y1={cy} 
                                      x2={cx} y2={cy - hexSize} 
                                      stroke={isConnected ? '#00c2b2' : '#cd7f32'} 
                                      strokeWidth="4" 
                                      strokeLinecap="round"
                                      className={isConnected ? "pulse-energy" : ""}
                                    />
                                    <line 
                                      x1={cx} y1={cy} 
                                      x2={cx + hexSize * Math.cos(Math.PI/6)} y2={cy + hexSize * Math.sin(Math.PI/6)} 
                                      stroke={isConnected ? '#00c2b2' : '#cd7f32'} 
                                      strokeWidth="4" 
                                      strokeLinecap="round"
                                      className={isConnected ? "pulse-energy" : ""}
                                    />
                                    <line 
                                      x1={cx} y1={cy} 
                                      x2={cx + hexSize * Math.cos(5*Math.PI/6)} y2={cy + hexSize * Math.sin(5*Math.PI/6)} 
                                      stroke={isConnected ? '#00c2b2' : '#cd7f32'} 
                                      strokeWidth="4" 
                                      strokeLinecap="round"
                                      className={isConnected ? "pulse-energy" : ""}
                                    />
                                  </g>
                                )}

                              </g>
                            )}
                            {/* Lock indicator */}
                            {tile.isLocked && (
                              <circle cx={cx + 10} cy={cy - 10} r="3" fill="#cd7f32" />
                            )}
                          </g>
                        );
                      })}

                      {showHint && pathCoords && pathCoords.length >= 2 && (
                        <path
                          d={pathCoords.map((coord, idx) => {
                            const cx = 27 * 1.5 * coord.q + 40;
                            const cy = 27 * Math.sqrt(3) * (coord.r + coord.q / 2) + 40;
                            return `${idx === 0 ? 'M' : 'L'} ${cx} ${cy}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#00c2b2"
                          strokeWidth="2.5"
                          strokeDasharray="4,4"
                          strokeLinecap="round"
                          opacity="0.6"
                          className="pulse-energy"
                          pointerEvents="none"
                        />
                      )}
                    </svg>
                  );
                })()}
              </div>

              {/* Chemical injector decay freeze timer display */}
              {isFreezeActive && (
                <div className="bg-[#002020] border border-[#00ffff] p-1.5 mb-2 rounded text-center font-data-mono text-[9px] text-[#00ffff] cyan-glow flex justify-center items-center gap-2">
                  <Activity className="h-3 w-3 animate-pulse" />
                  VITALITY FREEZE ACTIVE: {freezeTimeRemaining}s
                </div>
              )}

              {/* Connector Assembly (Build Selector) */}
              <div className="flex flex-col gap-1 mb-2 border border-[#8b4513]/20 p-2 bg-[#0e0e0e]/60 rounded">
                <div className="font-label-caps text-[8px] text-[#cd7f32] tracking-wider text-center">Selected Connector Blueprint</div>
                <div className="grid grid-cols-4 gap-1">
                  {(['STRAIGHT', 'CURVE_60', 'CURVE_120', 'SPLIT_Y'] as ConnectorType[]).map((type) => {
                    const labelMap: Record<ConnectorType, string> = {
                      'STRAIGHT': 'Straight',
                      'CURVE_60': 'Curve 60°',
                      'CURVE_120': 'Wide Arc',
                      'SPLIT_Y': 'Split Y',
                      'NONE': 'None'
                    };
                    const isSelected = buildType === type;
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          setBuildType(type);
                        }}
                        className={`py-1.5 px-1 border font-label-caps text-[8px] text-center flex flex-col items-center justify-center gap-1 transition-all relative ${
                          isSelected 
                            ? 'bg-[#00ffff]/10 border-[#00ffff] text-[#00ffff] cyan-glow font-bold' 
                            : 'bg-[#131313] border-[#8b4513]/30 text-gray-400 hover:text-white hover:border-[#cd7f32]/50'
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-1 right-1 flex h-1.5 w-1.5 rounded-full bg-[#00c2b2] animate-pulse" />
                        )}
                        {type === 'STRAIGHT' && (
                          <svg width="12" height="12" viewBox="0 0 16 16" className="opacity-80">
                            <line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        )}
                        {type === 'CURVE_60' && (
                          <svg width="12" height="12" viewBox="0 0 16 16" className="opacity-80">
                            <path d="M 8 2 Q 12 6 13 11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        )}
                        {type === 'CURVE_120' && (
                          <svg width="12" height="12" viewBox="0 0 16 16" className="opacity-80">
                            <path d="M 8 2 Q 8 8 13 8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        )}
                        {type === 'SPLIT_Y' && (
                          <svg width="12" height="12" viewBox="0 0 16 16" className="opacity-80">
                            <line x1="8" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                            <line x1="8" y1="8" x2="13" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                            <line x1="8" y1="8" x2="3" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                          </svg>
                        )}
                        <span>{labelMap[type]}</span>
                      </button>
                    );
                  })}
                </div>
                
                {/* Active Blueprint Preview Details Panel */}
                <div className="mt-1.5 p-1.5 border border-[#8b4513]/25 bg-[#050505] rounded flex items-center justify-between text-[8px] font-data-mono text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#00c2b2] font-bold">▶ ACTIVE:</span>
                    <span className="text-white font-bold uppercase">
                      {
                        {
                          'STRAIGHT': 'Straight Line',
                          'CURVE_60': '60° Curve',
                          'CURVE_120': 'Wide Arc',
                          'SPLIT_Y': 'Split Y-Joint',
                          'NONE': 'None'
                        }[buildType]
                      }
                    </span>
                  </div>
                  <div className="text-[#cd7f32] font-bold">
                    +{buildType === 'STRAIGHT' ? 10 : buildType === 'CURVE_60' ? 15 : buildType === 'CURVE_120' ? 20 : buildType === 'SPLIT_Y' ? 30 : 0} MS/Ph
                  </div>
                </div>
              </div>

              {/* Tool Hotbar & Actions */}
              <div className="flex flex-col gap-2">
                {showHint ? (
                  <button 
                    onClick={() => setShowHint(false)}
                    className="bg-[#00ffff]/10 border border-[#00ffff] p-2.5 text-[#00ffff] font-label-caps text-[9px] tracking-wider hover:bg-[#00ffff]/20 transition-all duration-300 rounded active:scale-95 text-center"
                  >
                    Deactivate Diagnostic Guide
                  </button>
                ) : (
                  <button 
                    onClick={handleUseHint}
                    className="bg-[#131313] border border-[#8b4513]/40 p-2.5 text-[#cd7f32] font-label-caps text-[9px] tracking-wider hover:text-white hover:border-[#cd7f32] transition-all duration-300 rounded active:scale-95 flex justify-center items-center gap-2"
                  >
                    <span>Activate Diagnostic Guide</span>
                    <span className="font-data-mono text-[8px] text-[#ffb779]">
                      ({isHintUnlockedForRun ? "FREE" : "15 Bio-Shards"})
                    </span>
                  </button>
                )}

                {isPathConnected ? (
                  <button 
                    onClick={handleSubmitSolution}
                    className="bg-[#003737] border-2 border-[#00ffff] p-3 text-white font-label-caps tracking-widest hover:bg-[#004f4f] cyan-glow transition-all duration-300 clipped-btn active:scale-95"
                  >
                    Trigger Cognitive Synapse
                  </button>
                ) : (
                  <button 
                    disabled
                    className="bg-[#1c1b1b] border border-gray-800 p-3 text-gray-600 font-label-caps tracking-widest cursor-not-allowed opacity-50"
                  >
                    Pathways Misaligned
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VIEW: THE TEMPLE OF TANIT (Upgrades) */}
          {activeTab === 'UPGRADES' && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-white">Temple of Tanit Upgrades</h3>
                <button onClick={() => setActiveTab('DASHBOARD')} className="font-label-caps text-[10px] text-gray-400 hover:text-white">Back</button>
              </div>

              {profile?.upgrades.map((upg) => {
                const upgradeNames: Record<string, string> = {
                  'MAX_LOAD_BUFFER': 'Max Neural Load Buffer',
                  'DIAGNOSTIC_PRECISION': 'Diagnostic Precision',
                  'TOOL_EFFICIENCY': 'Tool Efficiency'
                };
                const upgradeDescs: Record<string, string> = {
                  'MAX_LOAD_BUFFER': 'Increases maximum operational MS/Ph threshold by +5% per tier.',
                  'DIAGNOSTIC_PRECISION': 'Reveals short path visual hints at startup.',
                  'TOOL_EFFICIENCY': 'Reduces friction penalties & increases chemical freeze duration.'
                };

                const cost = 100 * Math.pow(2, upg.tier);
                
                return (
                  <div key={upg.upgradeKey} className="border border-[#8b4513]/40 p-4 glass-panel flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-headline-sm text-sm text-white">{upgradeNames[upg.upgradeKey]}</h4>
                        <span className="font-data-mono text-xs text-[#00ffff]">Tier {upg.tier}/5</span>
                      </div>
                      <p className="font-body-md text-xs text-gray-400 mb-3">{upgradeDescs[upg.upgradeKey]}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#8b4513]/25">
                      <span className="font-data-mono text-[10px] text-gray-500">
                        {upg.tier >= 5 ? 'Maximized' : `Cost: ${cost} ◆`}
                      </span>
                      {upg.tier < 5 ? (
                        <button 
                          onClick={() => handleBuyUpgrade(upg.upgradeKey)}
                          className="bg-[#8b4513] border border-[#cd7f32] px-3 py-1 font-label-caps text-[10px] text-white hover:border-[#00ffff] hover:text-[#00ffff]"
                        >
                          Unlock Next Tier
                        </button>
                      ) : (
                        <span className="font-label-caps text-[9px] text-[#00ffff] cyan-glow">COMPLETE</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}



          {/* VIEW: ORACLE DECREES */}
          {activeTab === 'ORACLE' && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-white">The Oracle Core</h3>
                <button onClick={() => setActiveTab('DASHBOARD')} className="font-label-caps text-[10px] text-gray-400 hover:text-white">Back</button>
              </div>

              <div className="border border-[#8b4513]/40 p-4 bg-[#0e0e0e] scanline relative overflow-hidden flex flex-col gap-3 font-data-mono text-xs text-[#00ffff] cyan-glow min-h-[300px]">
                <p className="border-b border-[#00ffff]/20 pb-2 text-[9px]">DIAGNOSTIC TRANSMISSION // S-ID: 77-TANIT</p>
                
                <p>
                  "Bio-Architect... the central mind has noticed your efforts in the Cothon Slums. But the corrosion is spreading faster than our bronze gears can rotate."
                </p>
                <p>
                  "The Sentinel legionaries in Byrsa Citadel are losing stability. Connect their synaptic networks. Place curves and sutures, and do not let the neural latency overload the implants."
                </p>
                <p>
                  "If stability falls too low, the bio-fluid will coagulate. We will cleanse them, but you must prevent system death at all costs."
                </p>
                <p className="mt-auto border-t border-[#00ffff]/20 pt-2 text-[9px] text-right">TRANSMISSION SECURE // END</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Bar */}
        {activeTab !== 'SPLASH' && activeTab !== 'CHAMBER' && (
          <div className="flex h-14 border-t border-[#8b4513]/40 bg-[#0e0e0e] justify-around items-center">
            <button 
              onClick={() => setActiveTab('DASHBOARD')} 
              className={`flex flex-col items-center gap-0.5 font-label-caps text-[8px] ${
                activeTab === 'DASHBOARD' ? 'text-[#00ffff]' : 'text-gray-500'
              }`}
            >
              <Layers className="h-4.5 w-4.5" />
              <span>DASHBOARD</span>
            </button>
            <button 
              onClick={() => setActiveTab('MAP')} 
              className={`flex flex-col items-center gap-0.5 font-label-caps text-[8px] ${
                activeTab === 'MAP' ? 'text-[#00ffff]' : 'text-gray-500'
              }`}
            >
              <Compass className="h-4.5 w-4.5" />
              <span>MAP</span>
            </button>
            <button 
              onClick={() => setActiveTab('UPGRADES')} 
              className={`flex flex-col items-center gap-0.5 font-label-caps text-[8px] ${
                activeTab === 'UPGRADES' ? 'text-[#00ffff]' : 'text-gray-500'
              }`}
            >
              <KeyRound className="h-4.5 w-4.5" />
              <span>UPGRADES</span>
            </button>
          </div>
        )}

        {/* Guided Tour Overlay Modal */}
        {tourStep !== null && (
          tourStep < 6 ? (
            <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/60 p-4 transition-all duration-300">
              <div className="border border-[#00ffff] bg-[#0e0e0e] p-4 rounded-xl shadow-[0_0_15px_rgba(0,255,255,0.2)] mb-8 flex flex-col gap-3 font-data-mono text-xs text-[#00ffff] cyan-glow relative">
                
                {/* Decorative header */}
                <div className="flex justify-between items-center border-b border-[#00ffff]/20 pb-2 text-[9px] text-[#00ffff]">
                  <span>TRANSMISSION // THE BLIND ORACLE</span>
                  <span>STEP {tourStep + 1} / 6</span>
                </div>

                {/* Tour step text */}
                <p className="font-body-md text-xs text-white leading-relaxed">
                  {tourStep === 0 && "Operative, welcome to the Cognitive Dock of Carthage. I am the Blind Oracle. Our legions bleed, and their neuro-networks decay. Your duty is to splice their cognitive matrices to keep them functional. Note your Bio-Shards (◆) in the header—it is your bio-energy. Let us inspect the sectors."}
                  {tourStep === 1 && "This is the Neural Map. Carthage is split into three sectors. Each sector's stability is vital; failures drop stability, which speeds up decay rates. Cleansing stability requires Bio-Shards. Let us examine our upgrades."}
                  {tourStep === 2 && "At the Temple of Tanit, you can upgrade your cyber-rig's max load buffer and diagnostic precision using Bio-Shards. Let us begin your first neuro-splicing surgery."}
                  {tourStep === 3 && "We are inside the Surgery Chamber. Look at the grid. Your objective is to connect the STEM node (top-left) to the ORGAN node (bottom-right) using connectors. Let us see how we route pathways."}
                  {tourStep === 4 && "Tapping an empty tile places the selected connector blueprint. Note: every connector and rotation increases Neural Load. Exceeding the overclock threshold terminates the patient!"}
                  {tourStep === 5 && "Biological tissue decays in real-time, reducing Vitality. If Vitality hits 0%, the patient dies! Budget your Neural Load and navigate around blocks. I have pre-aligned the grid. Click Next to make the final link."}
                </p>

                {/* Tour controls */}
                <div className="flex justify-between items-center mt-2 border-t border-[#00ffff]/20 pt-2">
                  <button
                    onClick={() => {
                      setTourStep(null);
                      setActiveTab('DASHBOARD');
                    }}
                    className="font-label-caps text-[9px] text-gray-500 hover:text-white"
                  >
                    Skip Tour
                  </button>
                  <div className="flex gap-2">
                    {tourStep > 0 && (
                      <button
                        onClick={() => {
                          const prevStep = tourStep - 1;
                          setTourStep(prevStep);
                          if (prevStep === 0) setActiveTab('DASHBOARD');
                          if (prevStep === 1) setActiveTab('MAP');
                          if (prevStep === 2) setActiveTab('UPGRADES');
                        }}
                        className="bg-gray-900 border border-gray-700 px-3 py-1 font-label-caps text-[9px] text-white hover:border-white"
                      >
                        Back
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const nextStep = tourStep + 1;
                        if (nextStep === 1) setActiveTab('MAP');
                        if (nextStep === 2) setActiveTab('UPGRADES');
                        if (nextStep === 3) {
                          const lvl1 = levels.find(l => l.levelNumber === 1);
                          if (lvl1) {
                            initChamber(lvl1);
                          } else {
                            setActiveTab('CHAMBER');
                          }
                        }
                        setTourStep(nextStep);
                      }}
                      className="bg-[#003737] border border-[#00ffff] px-3 py-1 font-label-caps text-[9px] text-white hover:bg-[#004f4f] hover:cyan-glow"
                    >
                      {tourStep === 5 ? "Start Surgery" : "Next"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Tour step 6 is a minimized overlay at the top of the surgery chamber */
            <div className="absolute top-14 left-4 right-4 z-40 border border-[#00ffff] bg-[#0e0e0e]/95 p-3 rounded-lg shadow-[0_0_15px_rgba(0,255,255,0.3)] flex flex-col gap-2 font-data-mono text-[10px] text-[#00ffff]">
              <div className="flex justify-between items-center border-b border-[#00ffff]/10 pb-1 text-[8px]">
                <span>TUTORIAL DIRECTIVE</span>
                <button onClick={() => setTourStep(null)} className="text-gray-500 hover:text-white">Skip</button>
              </div>
              <p className="text-white font-body-md text-[10px] leading-relaxed">
                Connect the pathway: Tap the empty cell in the middle (<span className="text-[#cd7f32]">q=2, r=2</span>) once to place a straight line, then click the blue <span className="text-[#00ffff] cyan-glow">Trigger Cognitive Synapse</span> button below!
              </p>
            </div>
          )
        )}

      </div>
    </div>
  );
}
export type { TileType, ConnectorType, HexDirection, GridTile, PlayerAction, LevelConfig, UserProfile };
