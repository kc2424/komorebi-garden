import { describe, expect, it } from 'vitest';
import { DECORATION_CATALOG } from '../data/decorationCatalog';
import { FLOWER_CATALOG } from '../data/flowerCatalog';
import type { GardenState } from '../types';
import {
  createGardenInvite,
  GARDEN_INVITE_MAX_LENGTH,
  parseGardenInvite,
} from '../utils/gardenInvite';

function encodeWire(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `KG1.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')}`;
}

function fullGeometry(): Pick<GardenState, 'soilTiles' | 'plants' | 'decorations'> {
  const soilTiles = Array.from({ length: 40 }, (_, index) => ({
    id: `private-tile-${index}`,
    x: (index % 9) - 4,
    z: Math.floor(index / 9) - 4,
    surface: 'grass' as const,
    height: index % 4,
  }));
  return {
    soilTiles,
    plants: FLOWER_CATALOG.map((entry, index) => ({
      id: `private-plant-${index}`,
      tileId: soilTiles[index]!.id,
      modelType: entry.modelType,
      color: 'red' as const,
      rotation: index / 10,
      observationIds: [`private-photo-${index}`],
    })),
    decorations: DECORATION_CATALOG.map((entry, index) => ({
      id: `private-decoration-${index}`,
      tileId: soilTiles[20 + index]!.id,
      type: entry.type,
      rotation: index / 12,
    })),
  };
}

describe('garden invite codec', () => {
  it('round-trips all 20 plants and 12 decorations without private IDs or photo links', () => {
    const code = createGardenInvite(fullGeometry(), '森の庭\u0000', '作者\u0007');
    const visit = parseGardenInvite(code);

    expect(code.startsWith('KG1.')).toBe(true);
    expect(code.length).toBeLessThanOrEqual(GARDEN_INVITE_MAX_LENGTH);
    expect(visit.title).toBe('森の庭');
    expect(visit.author).toBe('作者');
    expect(new Set(visit.plants.map((plant) => plant.modelType))).toEqual(
      new Set(FLOWER_CATALOG.map((entry) => entry.modelType)),
    );
    expect(new Set(visit.decorations.map((item) => item.type))).toEqual(
      new Set(DECORATION_CATALOG.map((entry) => entry.type)),
    );
    expect(visit.plants.every((plant) => plant.observationIds === undefined)).toBe(true);
    expect(JSON.stringify(visit)).not.toContain('private-');
    expect(JSON.stringify(visit)).not.toContain('photo');
  });

  it('accepts old missing model, surface, and height fields with safe defaults', () => {
    const visit = parseGardenInvite(encodeWire({
      version: 1,
      title: '古い庭',
      author: '作者',
      soilTiles: [{ id: 'old-tile', x: 0, z: 0 }],
      plants: [{ id: 'old-plant', tileId: 'old-tile', color: 'pink', rotation: 0 }],
      decorations: [],
    }));
    expect(visit.soilTiles[0]).toMatchObject({ surface: 'grass', height: 0 });
    expect(visit.plants[0].modelType).toBe('tulip');
  });

  it.each([
    ['malformed base64', 'KG1.%%%'],
    ['future version', encodeWire({ version: 2, title: '庭', author: '作者', soilTiles: [], plants: [], decorations: [] })],
    ['empty garden', encodeWire({ version: 1, title: '庭', author: '作者', soilTiles: [], plants: [], decorations: [] })],
    ['NaN-like rotation', encodeWire({
      version: 1, title: '庭', author: '作者',
      soilTiles: [{ id: 'tile', x: 0, z: 0 }],
      plants: [{ id: 'plant', tileId: 'tile', color: 'red', rotation: null }],
      decorations: [],
    })],
    ['unknown model', encodeWire({
      version: 1, title: '庭', author: '作者',
      soilTiles: [{ id: 'tile', x: 0, z: 0 }],
      plants: [{ id: 'plant', tileId: 'tile', color: 'red', rotation: 0, modelType: 'secret-tree' }],
      decorations: [],
    })],
    ['duplicate coordinates', encodeWire({
      version: 1, title: '庭', author: '作者',
      soilTiles: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 0, z: 0 }],
      plants: [], decorations: [],
    })],
    ['duplicate object IDs', encodeWire({
      version: 1, title: '庭', author: '作者',
      soilTiles: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 1, z: 0 }],
      plants: [
        { id: 'same', tileId: 'a', color: 'red', rotation: 0 },
        { id: 'same', tileId: 'b', color: 'red', rotation: 0 },
      ],
      decorations: [],
    })],
    ['one object per tile', encodeWire({
      version: 1, title: '庭', author: '作者',
      soilTiles: [{ id: 'a', x: 0, z: 0 }],
      plants: [{ id: 'plant', tileId: 'a', color: 'red', rotation: 0 }],
      decorations: [{ id: 'decor', tileId: 'a', type: 'bench', rotation: 0 }],
    })],
    ['unknown private field', encodeWire({
      version: 1, title: '庭', author: '作者',
      soilTiles: [{ id: 'a', x: 0, z: 0 }],
      plants: [{ id: 'plant', tileId: 'a', color: 'red', rotation: 0, observationIds: ['photo'] }],
      decorations: [],
    })],
  ])('rejects %s with a friendly error', (_label, code) => {
    expect(() => parseGardenInvite(code)).toThrow(/招待状を読み込めません/);
  });

  it('rejects oversized input before decoding and refuses out-of-bounds legacy exports', () => {
    expect(() => parseGardenInvite(`KG1.${'a'.repeat(GARDEN_INVITE_MAX_LENGTH)}`)).toThrow(/長すぎ/);
    expect(() => parseGardenInvite(`${' '.repeat(40_001)}KG1.short`)).toThrow(/長すぎ/);
    const geometry = fullGeometry();
    geometry.soilTiles[0] = { ...geometry.soilTiles[0]!, x: -5 };
    expect(() => createGardenInvite(geometry, '庭', '作者')).toThrow(/範囲外/);
  });

  it('assigns stable, distinct invite ids from the full payload hash', () => {
    const geometry = fullGeometry();
    const first = parseGardenInvite(createGardenInvite(geometry, '庭A', '作者'));
    const second = parseGardenInvite(createGardenInvite(geometry, '庭B', '作者'));
    expect(first.id).toBe(parseGardenInvite(createGardenInvite(geometry, '庭A', '作者')).id);
    expect(second.id).not.toBe(first.id);
  });

  it('does not mutate the source garden when creating an invite', () => {
    const geometry = fullGeometry();
    const before = JSON.stringify(geometry);
    createGardenInvite(geometry, '庭', '作者');
    expect(JSON.stringify(geometry)).toBe(before);
  });
});
