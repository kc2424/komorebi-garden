const KANA_HIRAGANA = /^[\u3040-\u30FFー・]+$/;
const JAPANESE_ONLY = /^[\u3040-\u30FF\u4E00-\u9FFFー・\s]+$/;

function containsJapanese(text: string): boolean {
  return /[\u3040-\u30FF\u4E00-\u9FFF]/.test(text);
}

/**
 * Pl@ntNet commonNames v3 rule (research 09): katakana/hiragana first in array order,
 * then Japanese-only, then any Japanese-containing name, else scientific fallback.
 * Kana display is not taxonomic verification.
 */
export function pickJapaneseDisplayName(
  commonNames: string[] | undefined,
  scientificFallback: string,
): string {
  if (!commonNames?.length) return scientificFallback;

  for (const name of commonNames) {
    if (KANA_HIRAGANA.test(name)) return name;
  }
  for (const name of commonNames) {
    if (JAPANESE_ONLY.test(name)) return name;
  }
  for (const name of commonNames) {
    if (containsJapanese(name)) return name;
  }
  return scientificFallback;
}
