import { describe, it, expect } from 'vitest';
import { mapPlantNetResults, manualCandidates } from '../../server/plantnet';
import { isTulipaScientificName, TULIP_COMMON_NAME } from '../data/tulip';
import { pickJapaneseDisplayName } from '../utils/japaneseName';
import { UNKNOWN_CANDIDATE } from '../data/identificationCandidates';

describe('isTulipaScientificName', () => {
  it('matches Tulipa genus only', () => {
    expect(isTulipaScientificName('Tulipa gesneriana')).toBe(true);
    expect(isTulipaScientificName('Tulipa clusiana')).toBe(true);
    expect(isTulipaScientificName('Tulipa × gesneriana')).toBe(true);
  });

  it('rejects non-Tulipa names without substring false positives', () => {
    expect(isTulipaScientificName('Hydrangea macrophylla')).toBe(false);
    expect(isTulipaScientificName('Notulipa gardenensis')).toBe(false);
    expect(isTulipaScientificName('Genus tulipaoides')).toBe(false);
  });
});

describe('pickJapaneseDisplayName', () => {
  it('prefers katakana in original array order (v3)', () => {
    expect(
      pickJapaneseDisplayName(
        ['Hiro ha-amana', 'アマナ属', 'ヒロハアマナ'],
        'Amana erythronioides',
      ),
    ).toBe('ヒロハアマナ');
  });

  it('falls back to scientific name when no Japanese', () => {
    expect(pickJapaneseDisplayName(['Tsukushi', 'English'], 'Equisetum arvense')).toBe(
      'Equisetum arvense',
    );
  });
});

describe('plantnet mapping', () => {
  it('maps tulip results to tulip plant type with generic label', () => {
    const candidates = mapPlantNetResults([
      {
        score: 0.92,
        species: {
          scientificNameWithoutAuthor: 'Tulipa gesneriana',
          family: { scientificNameWithoutAuthor: 'Liliaceae' },
          commonNames: ['チューリップ', 'Tulip'],
        },
      },
    ]);
    expect(candidates[0].plantType).toBe('tulip');
    expect(candidates[0].commonNameJa).toBe(TULIP_COMMON_NAME);
    expect(candidates[0].isTulipMatch).toBe(true);
    expect(candidates[0].trait).toContain('花弁が6枚');
  });

  it('applies v3 Japanese name for non-tulip species', () => {
    const candidates = mapPlantNetResults([
      {
        score: 0.8,
        species: {
          scientificNameWithoutAuthor: 'Equisetum arvense',
          family: { scientificNameWithoutAuthor: 'Equisetaceae' },
          commonNames: ['Tsukushi', 'スギナ'],
        },
      },
    ]);
    expect(candidates[0].plantType).toBe('other');
    expect(candidates[0].commonNameJa).toBe('スギナ');
    expect(candidates[0].scientificName).toBe('Equisetum arvense');
  });

  it('manual fallback does not preselect tulip', () => {
    const candidates = manualCandidates();
    expect(candidates[0]).toEqual(UNKNOWN_CANDIDATE);
    expect(candidates.some((c) => c.plantType === 'tulip')).toBe(false);
  });
});
