import type { TulipColor } from '../types/index.js';

export const TULIP_COMMON_NAME = 'チューリップ';
export const TULIP_SCIENTIFIC_NAME = 'Tulipa gesneriana';
export const TULIP_FAMILY = 'ユリ科';

export const TULIP_COLORS: { id: TulipColor; label: string; hex: string }[] = [
  { id: 'red', label: '赤', hex: '#e63946' },
  { id: 'yellow', label: '黄', hex: '#f4d35e' },
  { id: 'pink', label: 'ピンク', hex: '#f4a6c8' },
  { id: 'white', label: '白', hex: '#fff8f0' },
  { id: 'purple', label: '紫', hex: '#9b5de5' },
  { id: 'orange', label: 'オレンジ', hex: '#f77f00' },
];

export function tulipColorHex(color: TulipColor): string {
  return TULIP_COLORS.find((c) => c.id === color)?.hex ?? '#e63946';
}

/** Genus-level match only; no substring false positives (e.g. unrelated epithets). */
export function isTulipaScientificName(name: string): boolean {
  const genus = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return genus === 'tulipa' || genus.startsWith('tulipa×');
}

export function defaultTulipColor(): TulipColor {
  return 'red';
}
