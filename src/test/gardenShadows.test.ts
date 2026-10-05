import { describe, expect, it } from 'vitest';
import { getGardenShadowRevision, type GardenShadowContent } from '../utils/gardenShadows';

const content: GardenShadowContent = {
  soilTiles: [{ id: 'tile-a', x: 0, z: 0 }],
  plants: [{ id: 'plant-a', tileId: 'tile-a', color: 'red', rotation: 0 }],
  decorations: [{ id: 'bench-a', tileId: 'tile-b', type: 'bench', rotation: 0 }],
  editMode: 'view',
  addablePositions: [{ x: 1, z: 0 }],
};

describe('contact shadow content revision', () => {
  it('stays stable for equivalent state and observation or color-only updates', () => {
    const revision = getGardenShadowRevision(content);
    expect(getGardenShadowRevision(structuredClone(content))).toBe(revision);
    expect(getGardenShadowRevision({
      ...content,
      soilTiles: [{ ...content.soilTiles[0], height: 0, surface: 'grass' }],
      plants: [{ ...content.plants[0], modelType: 'tulip', color: 'white', observationIds: ['photo-a'] }],
    })).toBe(revision);
  });

  it('refreshes after terrain shape, height, or surface changes', () => {
    const revision = getGardenShadowRevision(content);
    for (const change of [{ x: 1 }, { z: 1 }, { height: 1 }, { surface: 'water' as const }]) {
      expect(getGardenShadowRevision({ ...content, soilTiles: [{ ...content.soilTiles[0], ...change }] })).not.toBe(revision);
    }
    expect(getGardenShadowRevision({ ...content, soilTiles: [] })).not.toBe(revision);
  });

  it('refreshes after plant and decoration placement, rotation, model changes, or removal', () => {
    const revision = getGardenShadowRevision(content);
    for (const change of [{ tileId: 'tile-b' }, { rotation: Math.PI / 2 }, { modelType: 'cherry' as const }]) {
      expect(getGardenShadowRevision({ ...content, plants: [{ ...content.plants[0], ...change }] })).not.toBe(revision);
    }
    for (const change of [{ tileId: 'tile-a' }, { rotation: Math.PI / 2 }, { type: 'fountain' as const }]) {
      expect(getGardenShadowRevision({ ...content, decorations: [{ ...content.decorations[0], ...change }] })).not.toBe(revision);
    }
    expect(getGardenShadowRevision({ ...content, plants: [] })).not.toBe(revision);
    expect(getGardenShadowRevision({ ...content, decorations: [] })).not.toBe(revision);
  });

  it('clears transient selection and ghost silhouettes when editing changes', () => {
    const revision = getGardenShadowRevision(content);
    expect(getGardenShadowRevision({ ...content, highlightPlantId: 'plant-a' })).not.toBe(revision);
    expect(getGardenShadowRevision({ ...content, editMode: 'add-soil' })).not.toBe(revision);
    const preview = { ...content, pendingPlacementTileId: 'tile-b', pendingPlacementPreview: { modelType: 'allium' as const, rotation: 0 } };
    expect(getGardenShadowRevision(preview)).not.toBe(revision);
    expect(getGardenShadowRevision({ ...preview, pendingPlacementTileId: 'tile-c' })).not.toBe(getGardenShadowRevision(preview));
    expect(getGardenShadowRevision({ ...content, selectedPlantId: 'plant-a' })).toBe(revision);
  });
});
