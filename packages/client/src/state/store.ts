import {
  DEFAULT_ROOM_CONFIG,
  LEVELS,
  addPlayer,
  createSimulation,
  endTurn,
  getSnapshot,
  moveHero,
  recruitUnits,
  setActiveHero,
  setPhase,
  type GameSnapshot,
  type MatchPhase,
  type ResourceKind,
  type RoomConfig,
  type SimulationState,
  type UnitKind
} from "@gravity/shared";

type Listener = () => void;

export interface AppState {
  matchPhase: MatchPhase;
  roomConfig: RoomConfig;
  snapshot: GameSnapshot;
  selectedTownId: string | null;
}

function makeInitialState(): { sim: SimulationState; snapshot: GameSnapshot } {
  const sim = createSimulation();
  addPlayer(sim, "local", "Blue Lord");
  addPlayer(sim, "enemy", "Red Baron");
  setPhase(sim, "playing");
  return { sim, snapshot: getSnapshot(sim) };
}

export class GameStore {
  private listeners = new Set<Listener>();
  private sim: SimulationState;
  private state: AppState;

  constructor() {
    const initial = makeInitialState();
    this.sim = initial.sim;
    this.state = {
      matchPhase: "playing",
      roomConfig: DEFAULT_ROOM_CONFIG,
      snapshot: initial.snapshot,
      selectedTownId: null
    };
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState() {
    return this.state;
  }

  newGame(mapId: string) {
    this.sim = createSimulation({ mapId });
    addPlayer(this.sim, "local", "Blue Lord");
    addPlayer(this.sim, "enemy", "Red Baron");
    setPhase(this.sim, "playing");
    this.state.roomConfig = { ...this.state.roomConfig, mapId };
    this.state.snapshot = getSnapshot(this.sim);
    this.state.selectedTownId = null;
    this.emit();
  }

  selectHero(heroId: string) {
    const currentPlayerId = this.state.snapshot.worldState.currentPlayerId;
    if (setActiveHero(this.sim, currentPlayerId, heroId)) {
      this.state.selectedTownId = null;
      this.refresh();
    }
  }

  selectTown(townId: string) {
    this.state.selectedTownId = townId;
    this.emit();
  }

  moveActiveHero(x: number, y: number) {
    const currentPlayerId = this.state.snapshot.worldState.currentPlayerId;
    const heroId = this.state.snapshot.worldState.activeHeroId;
    if (!heroId) {
      return;
    }
    if (moveHero(this.sim, currentPlayerId, heroId, x, y)) {
      this.state.selectedTownId = null;
      this.refresh();
    }
  }

  endTurn() {
    endTurn(this.sim);
    this.state.selectedTownId = null;
    this.refresh();
  }

  recruit(unit: UnitKind, count: number) {
    const townId = this.state.selectedTownId;
    if (!townId) {
      return;
    }
    const currentPlayerId = this.state.snapshot.worldState.currentPlayerId;
    if (recruitUnits(this.sim, currentPlayerId, townId, unit, count)) {
      this.refresh();
    }
  }

  getTerrainPalette(): Record<string, string> {
    return {
      grass: "#6f9d4d",
      forest: "#3f6e3b",
      dirt: "#8a6a47",
      road: "#b49a6c",
      water: "#386f93",
      hill: "#8f875c"
    };
  }

  getResourceTotals(): Record<ResourceKind, number> {
    const currentPlayerId = this.state.snapshot.worldState.currentPlayerId;
    const player = this.state.snapshot.players.find((entry) => entry.id === currentPlayerId);
    return {
      gold: player?.gold ?? 0,
      wood: player?.wood ?? 0,
      ore: player?.ore ?? 0
    };
  }

  private refresh() {
    this.state.snapshot = getSnapshot(this.sim);
    this.emit();
  }

  private emit() {
    this.state = { ...this.state };
    this.listeners.forEach((listener) => listener());
  }
}

export const gameStore = new GameStore();
export const availableMaps = LEVELS;
