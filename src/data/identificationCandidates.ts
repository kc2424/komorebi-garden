import type { IdentificationCandidate } from '../types';
import {
  TULIP_COMMON_NAME,
  TULIP_FAMILY,
  TULIP_SCIENTIFIC_NAME,
} from './tulip';

export const TULIP_TRAIT =
  '花弁が6枚（外側3枚が大きい）。春に咲く球根植物。色は品種により赤・黄・ピンクなど。';

export const UNKNOWN_CANDIDATE: IdentificationCandidate = {
  plantType: 'other',
  commonNameJa: '不明・判別できない',
  scientificName: '',
  familyName: '',
  trait: '植物かどうか、または種名が分からない場合に選べます。観察のみ保存されます。',
  isTulipMatch: false,
  isUnknownOption: true,
};

export function manualCandidates(): IdentificationCandidate[] {
  return [
    UNKNOWN_CANDIDATE,
    {
      plantType: 'other',
      commonNameJa: 'その他の植物（名前は分かる）',
      scientificName: '',
      familyName: '',
      trait: '庭には植えられませんが、観察として保存できます。',
      isTulipMatch: false,
    },
  ];
}

/** Append reject-all option after API candidates so users can decline every suggestion. */
export function withUnknownOption(candidates: IdentificationCandidate[]): IdentificationCandidate[] {
  if (candidates.some((c) => c.isUnknownOption)) return candidates;
  return [...candidates, UNKNOWN_CANDIDATE];
}

export function getTulipSampleCandidates(): IdentificationCandidate[] {
  return [
    {
      plantType: 'tulip',
      commonNameJa: TULIP_COMMON_NAME,
      scientificName: TULIP_SCIENTIFIC_NAME,
      familyName: TULIP_FAMILY,
      trait: TULIP_TRAIT,
      isTulipMatch: true,
    },
    {
      plantType: 'other',
      commonNameJa: 'スイセン',
      scientificName: 'Narcissus pseudonarcissus',
      familyName: 'ヒガンバナ科',
      trait: '黄色い花弁とトランペット状の副花弁。チューリップより花が小さい。',
      isTulipMatch: false,
    },
    {
      plantType: 'other',
      commonNameJa: 'カーネーション',
      scientificName: 'Dianthus caryophyllus',
      familyName: 'ナデシコ科',
      trait: '花弁の先がギザギザ。茎先に花が咲く。',
      isTulipMatch: false,
    },
    UNKNOWN_CANDIDATE,
  ];
}
