import type { IdentificationCandidate } from '../types';
import { samplePhotoPath } from './assetCredits';
import { getTulipSampleCandidates } from './identificationCandidates';

export interface SamplePhoto {
  key: string;
  label: string;
  imagePath: string;
  candidates: IdentificationCandidate[];
}

export { getTulipSampleCandidates };

export const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    key: 'sample-tulip',
    label: 'チューリップ（体験用）',
    imagePath: samplePhotoPath('tulip'),
    candidates: getTulipSampleCandidates(),
  },
  {
    key: 'sample-other',
    label: '紫陽花（非チューリップ体験）',
    imagePath: samplePhotoPath('ajisai'),
    candidates: [
      {
        plantType: 'other',
        commonNameJa: '紫陽花',
        scientificName: 'Hydrangea macrophylla',
        familyName: 'アジサイ科',
        trait: '球状の花序。葉は大きく卵形で対生する。',
        isTulipMatch: false,
      },
      {
        plantType: 'other',
        commonNameJa: '桔梗',
        scientificName: 'Platycodon grandiflorus',
        familyName: 'キキョウ科',
        trait: '星形の花。茎が細く直立する。',
        isTulipMatch: false,
      },
      {
        plantType: 'other',
        commonNameJa: '不明・判別できない',
        scientificName: '',
        familyName: '',
        trait: '植物かどうか、または種名が分からない場合に選べます。',
        isTulipMatch: false,
        isUnknownOption: true,
      },
    ],
  },
];

export function getSamplePhoto(key: string): SamplePhoto | undefined {
  return SAMPLE_PHOTOS.find((p) => p.key === key);
}
