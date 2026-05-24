import type { GameSnapshot, HeroState, TownState } from "@gravity/shared";

type Props = {
  snapshot: GameSnapshot;
  selectedTownId: string | null;
  onTileClick: (x: number, y: number) => void;
  onHeroClick: (heroId: string) => void;
  onTownClick: (townId: string) => void;
};

function heroAt(heroes: GameSnapshot["heroes"], x: number, y: number) {
  return heroes.find((hero) => hero.x === x && hero.y === y);
}

function townAt(towns: GameSnapshot["towns"], x: number, y: number) {
  return towns.find((town) => town.x === x && town.y === y);
}

function resourceAt(resources: GameSnapshot["resources"], x: number, y: number) {
  return resources.find((resource) => resource.x === x && resource.y === y);
}

function heroColor(hero: HeroState, snapshot: GameSnapshot) {
  return snapshot.players.find((player) => player.id === hero.ownerId)?.color ?? "#2959a8";
}

function townColor(town: TownState, snapshot: GameSnapshot) {
  return snapshot.players.find((player) => player.id === town.ownerId)?.color ?? "#d7c7a1";
}

export function AdventureMap({ snapshot, selectedTownId, onTileClick, onHeroClick, onTownClick }: Props) {
  return (
    <div className="map-frame">
      <div
        className="adventure-grid"
        style={{
          gridTemplateColumns: `repeat(${snapshot.map.width}, minmax(0, 1fr))`
        }}
      >
        {snapshot.map.terrain.flatMap((row, y) =>
          row.map((terrain, x) => {
            const hero = heroAt(snapshot.heroes, x, y);
            const town = townAt(snapshot.towns, x, y);
            const resource = resourceAt(snapshot.resources, x, y);
            const active = snapshot.worldState.activeHeroId === hero?.id;
            const selectedTown = selectedTownId === town?.id;

            return (
              <button
                key={`${x}-${y}`}
                className={`tile tile-${terrain}`}
                onClick={() => {
                  if (hero) {
                    onHeroClick(hero.id);
                    return;
                  }
                  if (town) {
                    onTownClick(town.id);
                    return;
                  }
                  onTileClick(x, y);
                }}
              >
                {town ? (
                  <span
                    className={`map-town ${selectedTown ? "selected" : ""}`}
                    style={{ borderColor: townColor(town, snapshot) }}
                    title={town.name}
                  >
                    {town.name.slice(0, 1)}
                  </span>
                ) : null}
                {resource ? (
                  <span className={`map-resource map-resource-${resource.kind}`} title={`${resource.kind} ${resource.amount}`}>
                    {resource.kind.slice(0, 1).toUpperCase()}
                  </span>
                ) : null}
                {hero ? (
                  <span
                    className={`map-hero ${active ? "active" : ""}`}
                    style={{ background: heroColor(hero, snapshot) }}
                    title={`${hero.name} (${hero.movement} move)`}
                  >
                    {hero.name.slice(0, 1)}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
