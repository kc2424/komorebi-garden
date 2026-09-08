# Research adoption — tulip MVP (2026-09-08)

Evidence lives in `claude-research/`. This file records what the **tulip-only MVP** adopted or deferred.

## Adopted

| Research | Decision | Where |
|----------|----------|-------|
| [09-japanese-name-rule.md](../claude-research/09-japanese-name-rule.md) | v3 katakana-first display from `commonNames`; scientific name preserved as ID; Tulipa → generic「チューリップ」label | `src/utils/japaneseName.ts`, `server/plantnet.ts` |
| [10-image-preprocessing.md](../claude-research/10-image-preprocessing.md) | Long edge 1280px, JPEG q90 before `/api/identify` (same pipeline as stored observation photo) | `src/storage/persistence.ts` |
| Tulipa genus boundary | Match genus token only (`/^tulipa/i` first word); no substring | `src/data/tulip.ts` |
| Unknown save |「不明・判別できない」option; error/not-configured defaults to unknown, no preselected tulip; reject-all appended after API candidates | `src/data/identificationCandidates.ts`, `IdentifyScreen.tsx` |
| Real tulip sample | Wikimedia CC BY-SA 4.0 red *Tulipa gesneriana* replaces kikyo mislabel | `public/samples/tulip.jpg`, `docs/asset-credits.md` |
| [03-plantnet-measurement.md](../claude-research/03-plantnet-measurement.md), [04-bench-real-conditions.md](../claude-research/04-bench-real-conditions.md) | Provider `score` shown as「候補スコア」decimal (not「信頼度」%); higher rank does not imply correct identity; user confirmation on every save | `IdentifyScreen.tsx` |

## Deferred (not in tulip MVP scope)

| Research | Reason |
|----------|--------|
| [14-vlm-confidence-layer.md](../claude-research/14-vlm-confidence-layer.md) | VLM rerank layer — n=15 only; **does not prove automatic certainty** in production |
| [08-species-shortlist.md](../claude-research/08-species-shortlist.md) | 50-species curated library — tulip-only garden |
| [12-training-data-availability.md](../claude-research/12-training-data-availability.md) | On-device CNN training — out of scope |
| [13-japanese-name-authority.md](../claude-research/13-japanese-name-authority.md) | Curated authority table for 50 species — tulip uses fixed generic label |

## Correction: VLM 11/11 ≠ auto-confirm

Research 14 reports VLM self-reported `high`+`medium` were 11/11 correct on **n=15 blind bench**, in a **dialogue setting**, with **subjective confidence labels**. That is a rerank experiment signal, not a license to auto-confirm Pl@ntNet top-1 in the app. MVP keeps **user confirmation** for every save.
