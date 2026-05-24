import type { GameSnapshot, UnitKind } from "@gravity/shared";

type Props = {
  snapshot: GameSnapshot;
  selectedTownId: string | null;
  maps: Array<{ id: string; name: string }>;
  onNewGame: (mapId: string) => void;
  onRecruit: (unit: UnitKind, count: number) => void;
  onEndTurn: () => void;
};

export function SidePanel({ snapshot, selectedTownId, maps, onNewGame, onRecruit, onEndTurn }: Props) {
  const currentPlayer = snapshot.players.find((player) => player.id === snapshot.worldState.currentPlayerId);
  const activeHero = snapshot.heroes.find((hero) => hero.id === snapshot.worldState.activeHeroId);
  const selectedTown = snapshot.towns.find((town) => town.id === selectedTownId);

  return (
    <aside className="panel">
      <div className="eyebrow">Kingdom Screen</div>
      <h1>Heroes of Might and Magic IV-inspired</h1>
      <p className="lede">{snapshot.worldState.message}</p>

      <div className="info-card">
        <div>Player</div>
        <strong>{currentPlayer?.name}</strong>
        <div>Day</div>
        <strong>
          Week {snapshot.worldState.week}, Day {snapshot.worldState.day}
        </strong>
      </div>

      <div className="resources">
        <div>Gold: {currentPlayer?.gold ?? 0}</div>
        <div>Wood: {currentPlayer?.wood ?? 0}</div>
        <div>Ore: {currentPlayer?.ore ?? 0}</div>
      </div>

      <label className="field">
        <span>Scenario</span>
        <select defaultValue={snapshot.map.id} onChange={(event) => onNewGame(event.target.value)}>
          {maps.map((map) => (
            <option key={map.id} value={map.id}>
              {map.name}
            </option>
          ))}
        </select>
      </label>

      <button onClick={onEndTurn}>End Turn</button>

      <section className="detail-card">
        <h2>Active Hero</h2>
        {activeHero ? (
          <>
            <div>{activeHero.name}</div>
            <div>Movement: {activeHero.movement}</div>
            <div>Army: {activeHero.army.map((stack) => `${stack.count} ${stack.kind}`).join(", ")}</div>
          </>
        ) : (
          <div>No hero selected.</div>
        )}
      </section>

      <section className="detail-card">
        <h2>Town</h2>
        {selectedTown ? (
          <>
            <div>{selectedTown.name}</div>
            <div>Owner: {selectedTown.ownerId}</div>
            <div>Garrison: {selectedTown.garrison.map((stack) => `${stack.count} ${stack.kind}`).join(", ")}</div>
            <div className="recruit-row">
              <button className="ghost" onClick={() => onRecruit("peasant", 5)}>
                +5 Peasants
              </button>
              <button className="ghost" onClick={() => onRecruit("archer", 2)}>
                +2 Archers
              </button>
              <button className="ghost" onClick={() => onRecruit("pikeman", 2)}>
                +2 Pikemen
              </button>
            </div>
            <div>Available: P {selectedTown.recruitment.peasant} | A {selectedTown.recruitment.archer} | Pi {selectedTown.recruitment.pikeman}</div>
          </>
        ) : (
          <div>Select a town on the map to inspect it.</div>
        )}
      </section>
    </aside>
  );
}
