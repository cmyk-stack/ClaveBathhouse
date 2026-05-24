import type { RoomConfig } from "./types";

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  mapId: "emerald-crossing",
  maxPlayers: 2,
  seed: 1337
};

export const HERO_MOVE_POINTS = 8;

export const DAILY_INCOME = {
  townGold: 500,
  wood: 1,
  ore: 1
} as const;

export const RECRUITMENT_GROWTH = {
  peasant: 12,
  archer: 5,
  pikeman: 4
} as const;

export const UNIT_COST = {
  peasant: { gold: 25, wood: 0, ore: 0 },
  archer: { gold: 80, wood: 1, ore: 0 },
  pikeman: { gold: 110, wood: 0, ore: 1 }
} as const;
