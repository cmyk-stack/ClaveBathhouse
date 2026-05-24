import assert from "node:assert/strict";
import sampleMap from "../src/maps/emerald-crossing.json";
import { addPlayer, createSimulation, endTurn, getSnapshot, moveHero, recruitUnits, setPhase } from "../src/sim/engine";
import { parseLevelDefinition } from "../src/schema";

function testLevelValidation() {
  const map = parseLevelDefinition(sampleMap);
  assert.equal(map.width, 12, "map width should parse");
  assert.ok(map.resources.length > 0, "map should contain resources");
}

function testHeroMovement() {
  const sim = createSimulation();
  addPlayer(sim, "local", "Blue");
  addPlayer(sim, "enemy", "Red");
  setPhase(sim, "playing");

  const before = getSnapshot(sim);
  const hero = before.heroes.find((entry) => entry.ownerId === "local")!;
  const moved = moveHero(sim, "local", hero.id, hero.x + 1, hero.y);
  const after = getSnapshot(sim);

  assert.equal(moved, true, "hero should move one tile");
  assert.notEqual(after.heroes.find((entry) => entry.id === hero.id)!.movement, hero.movement, "movement should be spent");
}

function testTurnIncome() {
  const sim = createSimulation();
  addPlayer(sim, "local", "Blue");
  addPlayer(sim, "enemy", "Red");
  setPhase(sim, "playing");

  const startingGold = getSnapshot(sim).players.find((entry) => entry.id === "local")!.gold;
  endTurn(sim);
  endTurn(sim);
  const after = getSnapshot(sim).players.find((entry) => entry.id === "local")!.gold;
  assert.ok(after > startingGold, "daily income should be granted after a full round");
}

function testRecruitment() {
  const sim = createSimulation();
  addPlayer(sim, "local", "Blue");
  addPlayer(sim, "enemy", "Red");
  setPhase(sim, "playing");

  const town = getSnapshot(sim).towns.find((entry) => entry.ownerId === "local")!;
  const recruited = recruitUnits(sim, "local", town.id, "peasant", 5);
  const after = getSnapshot(sim).towns.find((entry) => entry.id === town.id)!;
  assert.equal(recruited, true, "owned town should recruit units");
  assert.ok(after.garrison.some((stack) => stack.kind === "peasant" && stack.count > 18), "garrison should grow");
}

testLevelValidation();
testHeroMovement();
testTurnIncome();
testRecruitment();
console.log("Shared strategy tests passed.");
