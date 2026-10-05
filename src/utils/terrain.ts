import type { SoilTile, TileSurface } from '../types';

/** A compact four-level terrace; each saved level is an integer. */
export const MAX_TERRAIN_HEIGHT = 3;
export const TERRAIN_HEIGHT_STEP = 0.32;
export const TILE_SURFACES: readonly TileSurface[] = [
  'grass', 'soil', 'stone', 'gravel', 'wood', 'water',
];

export function normalizeTerrainHeight(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_TERRAIN_HEIGHT, Math.round(value)));
}

/** Local tile surface/root coordinates are added to this world elevation. */
export function getTileElevation(tile: Pick<SoilTile, 'height'> | undefined): number {
  return normalizeTerrainHeight(tile?.height) * TERRAIN_HEIGHT_STEP;
}

export function canChangeTileHeight(
  tile: Pick<SoilTile, 'height'> | undefined,
  delta: number,
): boolean {
  if (!tile || !Number.isFinite(delta) || Math.trunc(delta) === 0) return false;
  const current = normalizeTerrainHeight(tile.height);
  return normalizeTerrainHeight(current + Math.trunc(delta)) !== current;
}
