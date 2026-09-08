/** Historical 2D prototype species catalog — used only for v1 migration labels. */
export interface LegacySpecies {
  id: string;
  commonNameJa: string;
  scientificName: string;
  familyName: string;
}

export const LEGACY_SPECIES_CATALOG: LegacySpecies[] = [
  { id: 'species-yamabuki', commonNameJa: '山吹', scientificName: 'Kerria japonica', familyName: 'バラ科' },
  { id: 'species-sakura', commonNameJa: 'ソメイヨシノ', scientificName: 'Prunus × yedoensis', familyName: 'バラ科' },
  { id: 'species-ajisai', commonNameJa: '紫陽花', scientificName: 'Hydrangea macrophylla', familyName: 'アジサイ科' },
  { id: 'species-tsubaki', commonNameJa: '椿', scientificName: 'Camellia japonica', familyName: 'ツバキ科' },
  { id: 'species-kinmokusei', commonNameJa: '金木犀', scientificName: 'Osmanthus fragrans', familyName: 'モクセイ科' },
  { id: 'species-ayame', commonNameJa: 'アヤメ', scientificName: 'Iris sanguinea', familyName: 'アヤメ科' },
  { id: 'species-kikyo', commonNameJa: '桔梗', scientificName: 'Platycodon grandiflorus', familyName: 'キキョウ科' },
  { id: 'species-nadeshiko', commonNameJa: 'ナデシコ', scientificName: 'Dianthus superbus', familyName: 'ナデシコ科' },
  { id: 'species-ume', commonNameJa: '梅', scientificName: 'Prunus mume', familyName: 'バラ科' },
  { id: 'species-fuji', commonNameJa: '藤', scientificName: 'Wisteria floribunda', familyName: 'マメ科' },
];

export function getLegacySpeciesById(id: string): LegacySpecies | undefined {
  return LEGACY_SPECIES_CATALOG.find((s) => s.id === id);
}
