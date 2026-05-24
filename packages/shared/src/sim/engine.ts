import { DAILY_INCOME, DEFAULT_ROOM_CONFIG, HERO_MOVE_POINTS, RECRUITMENT_GROWTH, UNIT_COST } from "../constants";
import { getLevelById } from "../maps";
import type {
  AdventureMapDefinition,
  GameSnapshot,
  HeroState,
  MatchPhase,
  PlayerState,
  ResourcePile,
  RoomConfig,
  SimulationEvent,
  TownState,
  UnitKind
} from "../types";

export interface SimulationState {
  tick: number;
  phase: MatchPhase;
  map: AdventureMapDefinition;
  players: Map<string, PlayerState>;
  heroes: Map<string, HeroState>;
  towns: Map<string, TownState>;
  resources: Map<string, ResourcePile>;
  currentPlayerOrder: string[];
  currentPlayerIndex: number;
  day: number;
  week: number;
  activeHeroId: string | null;
  message: string;
  events: SimulationEvent[];
}

function createMap(config: RoomConfig) {
  return getLevelById(config.mapId);
}

function colorForIndex(index: number) {
  return ["#2959a8", "#9b2c2c", "#2f855a", "#805ad5"][index] ?? "#2959a8";
}

export function createSimulation(config: Partial<RoomConfig> = {}): SimulationState {
  const roomConfig = { ...DEFAULT_ROOM_CONFIG, ...config };
  const map = createMap(roomConfig);
  return {
    tick: 0,
    phase: "lobby",
    map,
    players: new Map(),
    heroes: new Map(),
    towns: new Map(
      map.towns.map((town) => [
        town.id,
        {
          ...town,
          garrison: [{ kind: "peasant", count: 18 }],
          recruitment: { peasant: 12, archer: 5, pikeman: 4 },
          builtThisWeek: false
        }
      ])
    ),
    resources: new Map(map.resources.map((resource) => [resource.id, { ...resource }])),
    currentPlayerOrder: [],
    currentPlayerIndex: 0,
    day: 1,
    week: 1,
    activeHeroId: null,
    message: "Build your kingdom.",
    events: []
  };
}

export function addPlayer(state: SimulationState, playerId: string, name: string) {
  const playerIndex = state.players.size;
  state.players.set(playerId, {
    id: playerId,
    name,
    color: colorForIndex(playerIndex),
    gold: 2500,
    wood: 8,
    ore: 8,
    heroIds: [],
    townIds: []
  });
}

export function setPhase(state: SimulationState, phase: MatchPhase) {
  state.phase = phase;
  if (phase === "playing") {
    initializeScenario(state);
  }
}

function initializeScenario(state: SimulationState) {
  const playerIds = Array.from(state.players.keys());
  if (playerIds.length === 0) {
    addPlayer(state, "local", "Blue Lord");
  }

  state.currentPlayerOrder = Array.from(state.players.keys());
  state.currentPlayerIndex = 0;

  state.heroes.clear();

  const mapHeroDefinitions = state.map.heroes.slice(0, state.currentPlayerOrder.length);
  state.currentPlayerOrder.forEach((playerId, index) => {
    const player = state.players.get(playerId)!;
    player.heroIds = [];
    player.townIds = [];

    const heroDefinition =
      mapHeroDefinitions[index] ?? {
        id: `hero-${playerId}`,
        ownerId: playerId,
        name: `${player.name.split(" ")[0]} Hero`,
        x: 1 + index,
        y: 1 + index
      };

    const hero: HeroState = {
      ...heroDefinition,
      ownerId: playerId,
      movement: HERO_MOVE_POINTS,
      maxMovement: HERO_MOVE_POINTS,
      army: [
        { kind: "peasant", count: 20 },
        { kind: "archer", count: 6 }
      ],
      visitedTownId: null
    };

    state.heroes.set(hero.id, hero);
    player.heroIds.push(hero.id);
  });

  for (const town of state.towns.values()) {
    if (town.ownerId !== "neutral" && state.players.has(town.ownerId)) {
      state.players.get(town.ownerId)!.townIds.push(town.id);
    }
  }

  state.activeHeroId = state.players.get(state.currentPlayerOrder[0])?.heroIds[0] ?? null;
  state.message = `${state.players.get(state.currentPlayerOrder[0])?.name}'s turn`;
}

function inBounds(map: AdventureMapDefinition, x: number, y: number) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function occupiedByOtherHero(state: SimulationState, heroId: string, x: number, y: number) {
  return Array.from(state.heroes.values()).some((hero) => hero.id !== heroId && hero.x === x && hero.y === y);
}

function updateTownVisit(state: SimulationState, hero: HeroState) {
  const town = Array.from(state.towns.values()).find((entry) => entry.x === hero.x && entry.y === hero.y);
  hero.visitedTownId = town?.id ?? null;
  if (!town) {
    return;
  }

  if (town.ownerId !== hero.ownerId) {
    const previousOwner = town.ownerId;
    town.ownerId = hero.ownerId;
    const newOwner = state.players.get(hero.ownerId)!;
    if (!newOwner.townIds.includes(town.id)) {
      newOwner.townIds.push(town.id);
    }
    if (previousOwner !== "neutral" && state.players.has(previousOwner)) {
      state.players.get(previousOwner)!.townIds = state.players.get(previousOwner)!.townIds.filter((id) => id !== town.id);
    }
    state.events.push({ type: "town-captured", heroId: hero.id, townId: town.id, ownerId: hero.ownerId });
    state.message = `${hero.name} captured ${town.name}.`;
  } else {
    state.message = `${hero.name} visits ${town.name}.`;
  }
}

function pickResource(state: SimulationState, hero: HeroState) {
  const resource = Array.from(state.resources.values()).find((entry) => entry.x === hero.x && entry.y === hero.y);
  if (!resource) {
    return;
  }

  const player = state.players.get(hero.ownerId)!;
  if (resource.kind === "gold") {
    player.gold += resource.amount;
  } else if (resource.kind === "wood") {
    player.wood += resource.amount;
  } else {
    player.ore += resource.amount;
  }

  state.resources.delete(resource.id);
  state.events.push({ type: "resource-picked", heroId: hero.id, resourceId: resource.id });
  state.message = `${hero.name} collected ${resource.amount} ${resource.kind}.`;
}

export function moveHero(state: SimulationState, playerId: string, heroId: string, x: number, y: number) {
  state.events = [];
  const hero = state.heroes.get(heroId);
  if (!hero || hero.ownerId !== playerId) {
    return false;
  }
  if (state.currentPlayerOrder[state.currentPlayerIndex] !== playerId) {
    return false;
  }
  if (hero.movement <= 0) {
    state.message = `${hero.name} is out of movement.`;
    return false;
  }
  if (!inBounds(state.map, x, y) || occupiedByOtherHero(state, hero.id, x, y)) {
    return false;
  }

  const dx = Math.abs(hero.x - x);
  const dy = Math.abs(hero.y - y);
  if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
    return false;
  }

  const terrain = state.map.terrain[y][x];
  if (terrain === "water") {
    state.message = "Your hero cannot cross water yet.";
    return false;
  }

  hero.x = x;
  hero.y = y;
  hero.movement -= terrain === "road" ? 1 : 2;
  hero.movement = Math.max(0, hero.movement);
  state.tick += 1;
  state.events.push({ type: "hero-moved", heroId: hero.id, x, y });
  pickResource(state, hero);
  updateTownVisit(state, hero);
  if (state.events.length === 1) {
    state.message = `${hero.name} moved to ${x}, ${y}.`;
  }
  return true;
}

export function setActiveHero(state: SimulationState, playerId: string, heroId: string) {
  const hero = state.heroes.get(heroId);
  if (!hero || hero.ownerId !== playerId) {
    return false;
  }
  state.activeHeroId = heroId;
  state.message = `${hero.name} is ready.`;
  return true;
}

export function recruitUnits(state: SimulationState, playerId: string, townId: string, unit: UnitKind, count: number) {
  state.events = [];
  const town = state.towns.get(townId);
  const player = state.players.get(playerId);
  if (!town || !player || town.ownerId !== playerId || count <= 0) {
    return false;
  }

  const available = town.recruitment[unit];
  if (available < count) {
    return false;
  }

  const cost = UNIT_COST[unit];
  const totalCost = {
    gold: cost.gold * count,
    wood: cost.wood * count,
    ore: cost.ore * count
  };

  if (player.gold < totalCost.gold || player.wood < totalCost.wood || player.ore < totalCost.ore) {
    state.message = "Not enough resources.";
    return false;
  }

  player.gold -= totalCost.gold;
  player.wood -= totalCost.wood;
  player.ore -= totalCost.ore;
  town.recruitment[unit] -= count;

  const stack = town.garrison.find((entry) => entry.kind === unit);
  if (stack) {
    stack.count += count;
  } else {
    town.garrison.push({ kind: unit, count });
  }

  state.events.push({ type: "recruited", townId, unit, count });
  state.message = `${town.name} recruited ${count} ${unit}.`;
  return true;
}

function applyDailyIncome(state: SimulationState) {
  for (const player of state.players.values()) {
    const townCount = player.townIds.length;
    player.gold += townCount * DAILY_INCOME.townGold;
    player.wood += Math.max(1, Math.floor(townCount / 2)) * DAILY_INCOME.wood;
    player.ore += Math.max(1, Math.floor(townCount / 2)) * DAILY_INCOME.ore;
  }
}

function applyWeeklyGrowth(state: SimulationState) {
  for (const town of state.towns.values()) {
    town.recruitment.peasant += RECRUITMENT_GROWTH.peasant;
    town.recruitment.archer += RECRUITMENT_GROWTH.archer;
    town.recruitment.pikeman += RECRUITMENT_GROWTH.pikeman;
  }
}

export function endTurn(state: SimulationState) {
  state.events = [];
  const currentPlayerId = state.currentPlayerOrder[state.currentPlayerIndex];
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.currentPlayerOrder.length;
  const nextPlayerId = state.currentPlayerOrder[state.currentPlayerIndex];

  if (state.currentPlayerIndex === 0) {
    state.day += 1;
    if (state.day > 7) {
      state.day = 1;
      state.week += 1;
      applyWeeklyGrowth(state);
    }
    applyDailyIncome(state);
    for (const hero of state.heroes.values()) {
      hero.movement = hero.maxMovement;
    }
  }

  state.activeHeroId = state.players.get(nextPlayerId)?.heroIds[0] ?? null;
  state.events.push({ type: "turn-ended", playerId: currentPlayerId, nextPlayerId });
  state.message = `${state.players.get(nextPlayerId)?.name}'s turn`;
  state.tick += 1;
}

export function getSnapshot(state: SimulationState): GameSnapshot {
  return {
    tick: state.tick,
    matchPhase: state.phase,
    map: state.map,
    players: Array.from(state.players.values()).map((player) => ({ ...player, heroIds: [...player.heroIds], townIds: [...player.townIds] })),
    heroes: Array.from(state.heroes.values()).map((hero) => ({ ...hero, army: hero.army.map((stack) => ({ ...stack })) })),
    towns: Array.from(state.towns.values()).map((town) => ({
      ...town,
      garrison: town.garrison.map((stack) => ({ ...stack })),
      recruitment: { ...town.recruitment }
    })),
    resources: Array.from(state.resources.values()).map((resource) => ({ ...resource })),
    worldState: {
      day: state.day,
      week: state.week,
      currentPlayerId: state.currentPlayerOrder[state.currentPlayerIndex] ?? "local",
      activeHeroId: state.activeHeroId,
      message: state.message
    }
  };
}
