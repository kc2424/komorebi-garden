import { DECORATION_CATALOG } from '../data/decorationCatalog';
import { FLOWER_CATALOG } from '../data/flowerCatalog';
import { TULIP_COLORS } from '../data/tulip';
import { GARDEN_LIMITS } from './gardenLimits';
import type {
  GardenDecoration,
  GardenDecorationType,
  GardenModelType,
  GardenPlant,
  GardenState,
  SoilTile,
  TileSurface,
  TulipColor,
} from '../types';

export interface GardenVisit {
  id: string;
  title: string;
  author: string;
  description: string;
  soilTiles: SoilTile[];
  plants: GardenPlant[];
  decorations: GardenDecoration[];
  source: 'sample' | 'invite';
  thumbnail?: string;
}

export const GARDEN_INVITE_MAX_LENGTH = 40_000;

const PREFIX = 'KG1.';
const MAX_TITLE_LENGTH = 40;
const MAX_AUTHOR_LENGTH = 24;
const MAX_TILES = GARDEN_LIMITS.maxTiles;
const MAX_OBJECTS = GARDEN_LIMITS.maxPlacedItems;
const MIN_COORDINATE = GARDEN_LIMITS.minCoordinate;
const MAX_COORDINATE = GARDEN_LIMITS.maxCoordinate;
const MAX_HEIGHT = GARDEN_LIMITS.maxHeight;
const MAX_ROTATION = Math.PI * 2;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;

const surfaces = new Set<TileSurface>(['soil', 'grass', 'stone', 'gravel', 'wood', 'water']);
const models = new Set<GardenModelType>(FLOWER_CATALOG.map((entry) => entry.modelType));
const colors = new Set<TulipColor>(TULIP_COLORS.map((entry) => entry.id));
const decorations = new Set<GardenDecorationType>(DECORATION_CATALOG.map((entry) => entry.type));

interface InviteWire {
  version: 1;
  title: string;
  author: string;
  soilTiles: Array<{
    id: string;
    x: number;
    z: number;
    surface?: TileSurface;
    height?: number;
  }>;
  plants: Array<{
    id: string;
    tileId: string;
    color: TulipColor;
    rotation: number;
    modelType?: GardenModelType;
  }>;
  decorations: Array<{
    id: string;
    tileId: string;
    type: GardenDecorationType;
    rotation: number;
  }>;
}

function friendlyError(message: string): Error {
  return new Error(`招待状を読み込めません。${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function cleanText(value: unknown, label: string, maximum: number, truncate: boolean): string {
  if (typeof value !== 'string') throw friendlyError(`${label}が正しくありません。`);
  const cleaned = value.replace(CONTROL_CHARACTERS, '').trim();
  if (!cleaned) throw friendlyError(`${label}を確認してください。`);
  if (cleaned.length > maximum) {
    if (truncate) return cleaned.slice(0, maximum);
    throw friendlyError(`${label}は${maximum}文字以内にしてください。`);
  }
  return cleaned;
}

function assertIntegerInRange(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw friendlyError(`${label}が庭の範囲外です（${minimum}〜${maximum}）。`);
  }
  return value as number;
}

function assertRotation(value: unknown): number {
  if (!Number.isFinite(value) || Math.abs(value as number) > MAX_ROTATION) {
    throw friendlyError('向きの値が正しくありません。');
  }
  return value as number;
}

function assertIdentifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || value.length > 100) {
    throw friendlyError(`${label}が正しくありません。`);
  }
  return value;
}

function encodeUtf8Base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function hashInvitePayload(invite: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < invite.length; index += 1) {
    hash ^= invite.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `invite-${(hash >>> 0).toString(36)}`;
}

function decodeUtf8Base64Url(value: string): string {
  if (!value || !/^[A-Za-z0-9_-]+$/u.test(value)) throw friendlyError('コードの形式が正しくありません。');
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    const binary = atob(base64 + padding);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw friendlyError('コードが壊れているようです。');
  }
}

function normalizeWire(value: unknown): Omit<GardenVisit, 'id' | 'description' | 'source'> {
  if (!isRecord(value) || !hasOnlyKeys(value, ['version', 'title', 'author', 'soilTiles', 'plants', 'decorations'])) {
    throw friendlyError('対応していないデータが含まれています。');
  }
  if (value.version !== 1) throw friendlyError('このバージョンの招待状には対応していません。');

  const title = cleanText(value.title, '庭の名前', MAX_TITLE_LENGTH, false);
  const author = cleanText(value.author, '作者名', MAX_AUTHOR_LENGTH, false);
  if (!Array.isArray(value.soilTiles) || value.soilTiles.length === 0) {
    throw friendlyError('庭の地面がありません。');
  }
  if (value.soilTiles.length > MAX_TILES) throw friendlyError(`地面は${MAX_TILES}枚までです。`);
  if (!Array.isArray(value.plants) || !Array.isArray(value.decorations)) {
    throw friendlyError('植物または飾りのデータが正しくありません。');
  }
  if (value.plants.length + value.decorations.length > MAX_OBJECTS) {
    throw friendlyError(`植物と飾りは合わせて${MAX_OBJECTS}個までです。`);
  }

  const sourceTileIds = new Set<string>();
  const coordinates = new Set<string>();
  const tileIdMap = new Map<string, string>();
  const soilTiles: SoilTile[] = value.soilTiles.map((raw, index) => {
    if (!isRecord(raw) || !hasOnlyKeys(raw, ['id', 'x', 'z', 'surface', 'height'])) {
      throw friendlyError('地面に対応していない項目があります。');
    }
    const sourceId = assertIdentifier(raw.id, '地面ID');
    if (sourceTileIds.has(sourceId)) throw friendlyError('地面IDが重複しています。');
    sourceTileIds.add(sourceId);
    const x = assertIntegerInRange(raw.x, '地面の横位置', MIN_COORDINATE, MAX_COORDINATE);
    const z = assertIntegerInRange(raw.z, '地面の奥行き', MIN_COORDINATE, MAX_COORDINATE);
    const coordinate = `${x}:${z}`;
    if (coordinates.has(coordinate)) throw friendlyError('同じ位置に地面が重複しています。');
    coordinates.add(coordinate);
    const surface = raw.surface === undefined ? 'grass' : raw.surface;
    if (!surfaces.has(surface as TileSurface)) throw friendlyError('知らない地面の種類が含まれています。');
    const height = raw.height === undefined
      ? 0
      : assertIntegerInRange(raw.height, '地面の高さ', 0, MAX_HEIGHT);
    const id = `visit-tile-${index}`;
    tileIdMap.set(sourceId, id);
    return { id, x, z, surface: surface as TileSurface, height };
  });

  const sourceObjectIds = new Set<string>();
  const occupiedTileIds = new Set<string>();
  const reserveObject = (raw: Record<string, unknown>): string => {
    const sourceId = assertIdentifier(raw.id, '配置物ID');
    if (sourceObjectIds.has(sourceId)) throw friendlyError('配置物IDが重複しています。');
    sourceObjectIds.add(sourceId);
    const sourceTileId = assertIdentifier(raw.tileId, '配置先ID');
    const tileId = tileIdMap.get(sourceTileId);
    if (!tileId) throw friendlyError('配置先の地面が見つかりません。');
    if (occupiedTileIds.has(tileId)) throw friendlyError('1枚の地面には1つだけ配置できます。');
    occupiedTileIds.add(tileId);
    return tileId;
  };

  const plants: GardenPlant[] = value.plants.map((raw, index) => {
    if (!isRecord(raw) || !hasOnlyKeys(raw, ['id', 'tileId', 'color', 'rotation', 'modelType'])) {
      throw friendlyError('植物に対応していない項目があります。写真やメモは招待状に含められません。');
    }
    const tileId = reserveObject(raw);
    const modelType = raw.modelType === undefined ? 'tulip' : raw.modelType;
    if (!models.has(modelType as GardenModelType)) throw friendlyError('知らない植物が含まれています。');
    if (!colors.has(raw.color as TulipColor)) throw friendlyError('知らない花の色が含まれています。');
    return {
      id: `visit-plant-${index}`,
      tileId,
      color: raw.color as TulipColor,
      rotation: assertRotation(raw.rotation),
      modelType: modelType as GardenModelType,
    };
  });

  const normalizedDecorations: GardenDecoration[] = value.decorations.map((raw, index) => {
    if (!isRecord(raw) || !hasOnlyKeys(raw, ['id', 'tileId', 'type', 'rotation'])) {
      throw friendlyError('飾りに対応していない項目があります。');
    }
    const tileId = reserveObject(raw);
    if (!decorations.has(raw.type as GardenDecorationType)) throw friendlyError('知らない飾りが含まれています。');
    return {
      id: `visit-decoration-${index}`,
      tileId,
      type: raw.type as GardenDecorationType,
      rotation: assertRotation(raw.rotation),
    };
  });

  return { title, author, soilTiles, plants, decorations: normalizedDecorations };
}

function toWire(
  state: Pick<GardenState, 'soilTiles' | 'plants' | 'decorations'>,
  title: string,
  author: string,
): InviteWire {
  return {
    version: 1,
    title: cleanText(title || 'わたしの庭', '庭の名前', MAX_TITLE_LENGTH, true),
    author: cleanText(author || '庭の作者', '作者名', MAX_AUTHOR_LENGTH, true),
    soilTiles: state.soilTiles.map(({ id, x, z, surface, height }) => ({ id, x, z, surface, height })),
    plants: state.plants.map(({ id, tileId, color, rotation, modelType }) => ({
      id,
      tileId,
      color,
      rotation: ((rotation % MAX_ROTATION) + MAX_ROTATION) % MAX_ROTATION,
      modelType,
    })),
    decorations: state.decorations.map(({ id, tileId, type, rotation }) => ({
      id,
      tileId,
      type,
      rotation: ((rotation % MAX_ROTATION) + MAX_ROTATION) % MAX_ROTATION,
    })),
  };
}

export function createGardenInvite(
  state: Pick<GardenState, 'soilTiles' | 'plants' | 'decorations'>,
  title: string,
  author: string,
): string {
  const normalized = normalizeWire(toWire(state, title, author));
  const wire = toWire(normalized as Pick<GardenState, 'soilTiles' | 'plants' | 'decorations'>, normalized.title, normalized.author);
  const invite = `${PREFIX}${encodeUtf8Base64Url(JSON.stringify(wire))}`;
  if (invite.length > GARDEN_INVITE_MAX_LENGTH) {
    throw friendlyError('庭が大きすぎて招待状を作れません。');
  }
  return invite;
}

export function parseGardenInvite(input: string): GardenVisit {
  if (input.length > GARDEN_INVITE_MAX_LENGTH) throw friendlyError('コードが長すぎます。');
  const invite = input.trim();
  if (!invite.startsWith(PREFIX)) throw friendlyError('コードは「KG1.」から始まります。');
  const json = decodeUtf8Base64Url(invite.slice(PREFIX.length));
  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch {
    throw friendlyError('コードの内容が壊れているようです。');
  }
  const normalized = normalizeWire(raw);
  return {
    id: hashInvitePayload(invite),
    ...normalized,
    description: '招待状を作った時点の庭です。写真・メモ・その後の変更は含まれません。',
    source: 'invite',
  };
}
