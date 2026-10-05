import type {
  GardenDecoration,
  GardenDecorationType,
  GardenEditMode,
  GardenModelType,
  GardenPlant,
  SoilTile,
} from '../types';

export interface GardenShadowContent {
  soilTiles: SoilTile[];
  plants: GardenPlant[];
  decorations: GardenDecoration[];
  editMode: GardenEditMode;
  plantingFlowActive?: boolean;
  selectedTileId?: string | null;
  selectedPlantId?: string | null;
  selectedDecorationId?: string | null;
  highlightPlantId?: string | null;
  addablePositions: { x: number; z: number }[];
  pendingPlacementTileId?: string | null;
  pendingPlacementPreview?: { modelType: GardenModelType; rotation: number } | null;
  pendingDecorationPreview?: { type: GardenDecorationType; rotation: number } | null;
}

/** Only scene geometry affects the contact-shadow capture; camera and observation metadata do not. */
export function getGardenShadowRevision(content: GardenShadowContent): string {
  return JSON.stringify({
    tiles: content.soilTiles.map((tile) => [tile.id, tile.x, tile.z, tile.surface ?? 'grass', tile.height ?? 0]),
    plants: content.plants.map((plant) => [plant.id, plant.tileId, plant.modelType ?? 'tulip', plant.rotation]),
    decorations: content.decorations.map((decoration) => [decoration.id, decoration.tileId, decoration.type, decoration.rotation]),
    // Selection rings and placement ghosts are rendered into Drei's depth override too.
    selection: [content.selectedTileId ?? null, content.editMode === 'view' ? null : content.selectedPlantId ?? null, content.selectedDecorationId ?? null, content.highlightPlantId ?? null],
    tileHighlights: ['remove-soil', 'raise-terrain', 'lower-terrain', 'add-soil', 'plant', 'place-decoration', 'move'].includes(content.editMode) ? content.editMode : content.plantingFlowActive ? 'plant' : null,
    addedTileGhosts: content.editMode === 'add-soil' ? content.addablePositions.map(({ x, z }) => [x, z]) : [],
    placement: content.pendingPlacementPreview ? [content.pendingPlacementTileId, content.pendingPlacementPreview.modelType, content.pendingPlacementPreview.rotation] : null,
    decorationPlacement: content.pendingDecorationPreview ? [content.pendingPlacementTileId, content.pendingDecorationPreview.type, content.pendingDecorationPreview.rotation] : null,
  });
}
