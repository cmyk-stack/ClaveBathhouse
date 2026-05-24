import { z } from "zod";
import type { AdventureMapDefinition } from "./types";

const terrainSchema = z.enum(["grass", "forest", "dirt", "road", "water", "hill"]);
const pointSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative()
});

const mapSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  terrain: z.array(z.array(terrainSchema)),
  towns: z.array(
    pointSchema.extend({
      id: z.string().min(1),
      name: z.string().min(1),
      ownerId: z.string()
    })
  ),
  heroes: z.array(
    pointSchema.extend({
      id: z.string().min(1),
      name: z.string().min(1),
      ownerId: z.string().min(1)
    })
  ),
  resources: z.array(
    pointSchema.extend({
      id: z.string().min(1),
      kind: z.enum(["gold", "wood", "ore"]),
      amount: z.number().int().positive()
    })
  )
});

export function parseLevelDefinition(input: unknown): AdventureMapDefinition {
  return mapSchema.parse(input) as AdventureMapDefinition;
}
