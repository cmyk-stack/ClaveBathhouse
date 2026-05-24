import ashenBorder from "./ashen-border.json";
import emeraldCrossing from "./emerald-crossing.json";
import { parseLevelDefinition } from "../schema";
import type { AdventureMapDefinition } from "../types";

export const LEVELS: AdventureMapDefinition[] = [emeraldCrossing, ashenBorder].map(parseLevelDefinition);

export function getLevelById(id: string): AdventureMapDefinition {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0];
}
