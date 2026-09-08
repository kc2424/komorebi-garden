import type { IdentificationCandidate, IdentificationResult } from '../src/types';
import {
  manualCandidates,
  TULIP_TRAIT,
} from '../src/data/identificationCandidates';
import {
  isTulipaScientificName,
  TULIP_COMMON_NAME,
  TULIP_FAMILY,
  TULIP_SCIENTIFIC_NAME,
} from '../src/data/tulip';
import { pickJapaneseDisplayName } from '../src/utils/japaneseName';

export interface PlantNetSpeciesResult {
  score: number;
  species: {
    scientificNameWithoutAuthor: string;
    scientificNameAuthorship?: string;
    genus?: { scientificNameWithoutAuthor: string };
    family?: { scientificNameWithoutAuthor: string };
    commonNames?: string[];
  };
}

export interface PlantNetResponse {
  results?: PlantNetSpeciesResult[];
  remainingIdentificationRequests?: number;
  message?: string;
}

const TRAIT_FALLBACK = '識別候補です。特徴は公式図鑑で確認してください。';

export function mapPlantNetResults(results: PlantNetSpeciesResult[]): IdentificationCandidate[] {
  return results.slice(0, 5).map((item) => {
    const scientific = item.species.scientificNameWithoutAuthor;
    const isTulip = isTulipaScientificName(scientific);
    const commonNameJa = isTulip
      ? TULIP_COMMON_NAME
      : pickJapaneseDisplayName(item.species.commonNames, scientific);

    return {
      plantType: isTulip ? 'tulip' : 'other',
      commonNameJa,
      scientificName: scientific,
      familyName: item.species.family?.scientificNameWithoutAuthor ?? '',
      trait: isTulip ? TULIP_TRAIT : TRAIT_FALLBACK,
      score: item.score,
      isTulipMatch: isTulip,
    };
  });
}

export { manualCandidates };

export function notConfiguredResult(): IdentificationResult {
  return {
    status: 'not-configured',
    candidates: manualCandidates(),
    message:
      '植物識別APIが未設定です。手動で植物名を選んで観察を保存できます。設定手順は docs/plantnet-setup.md を参照してください。',
    provider: 'plantnet',
  };
}

export function errorResult(message: string): IdentificationResult {
  return {
    status: 'error',
    candidates: manualCandidates(),
    message,
    provider: 'plantnet',
  };
}

export function okResult(candidates: IdentificationCandidate[]): IdentificationResult {
  return {
    status: 'ok',
    candidates: candidates.length > 0 ? candidates : manualCandidates(),
    provider: 'plantnet',
  };
}

export async function identifyWithPlantNet(
  apiKey: string,
  imageBuffer: Buffer,
  mimeType: string,
): Promise<IdentificationResult> {
  const project = 'all';
  const url = `https://my-api.plantnet.org/v2/identify/${project}?api-key=${encodeURIComponent(apiKey)}&lang=ja`;

  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: mimeType });
  formData.append('images', blob, 'plant.jpg');
  formData.append('organs', 'auto');

  const response = await fetch(url, { method: 'POST', body: formData });
  const text = await response.text();

  if (!response.ok) {
    return errorResult(`識別APIエラー (${response.status}): ${text.slice(0, 200)}`);
  }

  let json: PlantNetResponse;
  try {
    json = JSON.parse(text) as PlantNetResponse;
  } catch {
    return errorResult('識別APIの応答を解析できませんでした。');
  }

  if (!json.results || json.results.length === 0) {
    return errorResult('識別候補が見つかりませんでした。別の写真をお試しください。');
  }

  return okResult(mapPlantNetResults(json.results));
}

// Re-export for tests that reference tulip constants via manual path
export { TULIP_COMMON_NAME, TULIP_SCIENTIFIC_NAME, TULIP_FAMILY };
