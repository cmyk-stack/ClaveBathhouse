export type Vec2 = {
  x: number;
  y: number;
};

export type MatchPhase = "title" | "lobby" | "countdown" | "playing" | "paused" | "scoreboard";
export type TerrainType = "grass" | "forest" | "dirt" | "road" | "water" | "hill";
export type ResourceKind = "gold" | "wood" | "ore";
export type UnitKind = "peasant" | "archer" | "pikeman";

export interface RoomConfig {
  mapId: string;
  maxPlayers: number;
  seed: number;
}

export interface TilePosition {
  x: number;
  y: number;
}

export interface ResourcePile extends TilePosition {
  id: string;
  kind: ResourceKind;
  amount: number;
}

export interface TownDefinition extends TilePosition {
  id: string;
  name: string;
  ownerId: string | "neutral";
}

export interface HeroDefinition extends TilePosition {
  id: string;
  name: string;
  ownerId: string;
}

export interface AdventureMapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  terrain: TerrainType[][];
  towns: TownDefinition[];
  heroes: HeroDefinition[];
  resources: ResourcePile[];
}

export interface ArmyStack {
  kind: UnitKind;
  count: number;
}

export interface HeroState extends TilePosition {
  id: string;
  ownerId: string;
  name: string;
  movement: number;
  maxMovement: number;
  army: ArmyStack[];
  visitedTownId: string | null;
}

export interface TownState extends TilePosition {
  id: string;
  name: string;
  ownerId: string | "neutral";
  garrison: ArmyStack[];
  recruitment: Record<UnitKind, number>;
  builtThisWeek: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  gold: number;
  wood: number;
  ore: number;
  heroIds: string[];
  townIds: string[];
}

export interface WorldState {
  day: number;
  week: number;
  currentPlayerId: string;
  activeHeroId: string | null;
  message: string;
}

export interface GameSnapshot {
  tick: number;
  matchPhase: MatchPhase;
  map: AdventureMapDefinition;
  players: PlayerState[];
  heroes: HeroState[];
  towns: TownState[];
  resources: ResourcePile[];
  worldState: WorldState;
}

export type SimulationEvent =
  | { type: "hero-moved"; heroId: string; x: number; y: number }
  | { type: "resource-picked"; heroId: string; resourceId: string }
  | { type: "town-captured"; heroId: string; townId: string; ownerId: string }
  | { type: "turn-ended"; playerId: string; nextPlayerId: string }
  | { type: "recruited"; townId: string; unit: UnitKind; count: number };

export type RoomPeer = {
  id: string;
  name: string;
  ready: boolean;
  isHost: boolean;
};

export type NetMessage =
  | { type: "join-room"; roomCode: string; name: string }
  | { type: "create-room"; name: string; config?: Partial<RoomConfig> }
  | { type: "room-state"; roomCode: string; peers: RoomPeer[]; config: RoomConfig; hostId: string; matchPhase: MatchPhase }
  | { type: "peer-ready"; ready: boolean }
  | { type: "start-match" }
  | { type: "input"; playerId: string; payload: unknown }
  | { type: "snapshot"; snapshot: GameSnapshot; events: SimulationEvent[] }
  | { type: "event"; event: SimulationEvent }
  | { type: "pause"; paused: boolean }
  | { type: "rematch" }
  | { type: "disconnect"; peerId: string; reason: string }
  | { type: "host-migrate"; nextHostId: string | null; supported: false }
  | { type: "signal"; targetPeerId: string; fromPeerId: string; payload: RTCSessionDescriptionInit | RTCIceCandidateInit }
  | { type: "error"; message: string };
