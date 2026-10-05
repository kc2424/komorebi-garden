import { describe, expect, it } from 'vitest';
import { DECORATION_CATALOG } from '../data/decorationCatalog';
import { FLOWER_CATALOG } from '../data/flowerCatalog';
import { SHOWCASE_GARDENS } from '../data/showcaseGardens';
import { createGardenInvite, parseGardenInvite } from '../utils/gardenInvite';
import { GARDEN_LIMITS } from '../utils/gardenLimits';

describe('authored showcase gardens', () => {
  it('contains three honest, bounded sample gardens', () => {
    expect(SHOWCASE_GARDENS).toHaveLength(3);
    for (const garden of SHOWCASE_GARDENS) {
      expect(garden.source).toBe('sample');
      expect(garden.author).toBe('こもれび植物園');
      expect(garden.soilTiles.length).toBeLessThanOrEqual(GARDEN_LIMITS.maxTiles);
      expect(garden.plants.length + garden.decorations.length).toBeLessThanOrEqual(
        GARDEN_LIMITS.maxPlacedItems,
      );
      expect(garden.soilTiles.every((tile) =>
        tile.x >= GARDEN_LIMITS.minCoordinate
        && tile.x <= GARDEN_LIMITS.maxCoordinate
        && tile.z >= GARDEN_LIMITS.minCoordinate
        && tile.z <= GARDEN_LIMITS.maxCoordinate
        && (tile.height ?? 0) <= GARDEN_LIMITS.maxHeight)).toBe(true);
    }
  });

  it('uses the expanded 49-tile geometry with all 20 plants and all 12 decorations', () => {
    const hero = SHOWCASE_GARDENS[0]!;
    expect(hero.soilTiles).toHaveLength(49);
    expect(hero.plants).toHaveLength(20);
    expect(hero.decorations).toHaveLength(12);
    expect(new Set(hero.plants.map((plant) => plant.modelType))).toEqual(
      new Set(FLOWER_CATALOG.map((entry) => entry.modelType)),
    );
    expect(new Set(hero.decorations.map((item) => item.type))).toEqual(
      new Set(DECORATION_CATALOG.map((entry) => entry.type)),
    );
    expect(hero.soilTiles.find((tile) => tile.x === -1 && tile.z === -2)?.height).toBe(2);
    expect(hero.thumbnail).toBe('/samples/expanded-garden-example.png');
    const mushroom = hero.decorations.find((item) => item.type === 'mushroom');
    const mushroomTile = hero.soilTiles.find((tile) => tile.id === mushroom?.tileId);
    expect(mushroomTile).toMatchObject({ x: -3, z: -2 });
  });

  it('round-trips every showcase garden through the production invite codec', () => {
    for (const garden of SHOWCASE_GARDENS) {
      const code = createGardenInvite(garden, garden.title, garden.author);
      const visit = parseGardenInvite(code);
      expect(visit.title).toBe(garden.title);
      expect(visit.author).toBe(garden.author);
      expect(visit.soilTiles).toHaveLength(garden.soilTiles.length);
      expect(visit.plants).toHaveLength(garden.plants.length);
      expect(visit.decorations).toHaveLength(garden.decorations.length);
    }
  });

  it('provides the requested 5×5 waterside and 7×7 rose courtyard compositions', () => {
    const waterside = SHOWCASE_GARDENS[1]!;
    const courtyard = SHOWCASE_GARDENS[2]!;
    expect(waterside.soilTiles).toHaveLength(25);
    expect(waterside.plants.filter((plant) => plant.modelType === 'fern')).toHaveLength(2);
    expect(waterside.decorations.filter((item) => item.type === 'bench')).toHaveLength(2);
    expect(waterside.soilTiles.some((tile) => tile.surface === 'water')).toBe(true);
    expect(waterside.soilTiles.some((tile) => tile.surface === 'wood')).toBe(true);
    expect(waterside.thumbnail).toBe('/samples/waterside-garden-example.jpg');
    expect(courtyard.thumbnail).toBe('/samples/courtyard-garden-example.jpg');

    expect(courtyard.soilTiles).toHaveLength(49);
    expect(courtyard.plants.filter((plant) => plant.modelType === 'rose')).toHaveLength(8);
    expect(courtyard.decorations.filter((item) => item.type === 'garden-arch')).toHaveLength(2);
    expect(courtyard.decorations.some((item) => item.type === 'fountain')).toBe(true);
    expect(courtyard.soilTiles.some((tile) => tile.surface === 'gravel')).toBe(true);
  });
});
