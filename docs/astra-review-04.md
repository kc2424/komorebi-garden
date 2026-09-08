# Astra review 04 — browser QA of review 03, and the last cosmetic fixes

Independent browser QA of the review 03 build is now done (390x844, Chromium, dev server).
This is the verification round that was pending in `docs/verification-results.md`.

**Result: review 01–03 items are all confirmed fixed. No functional blockers remain.**
Four small issues are left, all cosmetic or copy-level. Fix these, then this prototype is accepted
for the experience review. No new features, no scope change, no deploy, no commit.

## Confirmed fixed (browser-verified, not inferred)

Layout, which was the review 02 acceptance blocker:

- 10 species, both gardens: **zero overlapping bounding boxes** (measured pairwise, all 10 cards).
- Photo cards measure 74–77 x 86–90px; scene 358x439px. Within the review 02 target.
- Nothing clips outside the scene on either side.

Flow and data:

- Sample photo -> candidates -> 登録 -> 庭 -> 詳細 completes. No image error (review 01 #1).
- Sample registration is saved as a personal record with its photo (review 01 #2).
- Rapid triple-tap on 植物園に迎える produced exactly **1** collection and **1** observation.
- Re-registering the same species: 種類数 stays 1, and detail reads
  **発見回数 2回 / 再会回数 1回** — the review 02 #3 semantics are correct.
  First discovery says 新しい植物を発見, second says また会えました / 1回目の再会.
- Reload: memo, photo (data URL), counts, garden mode and placement all persist.
- Previews are standalone (3種類 shows exactly 3) and the note reads
  「あなたの記録（1種類）は保持されています」. Returning to 自分の庭 restored the record
  with memo and placement intact (review 01 #3).

Placement (review 03 #2, review 02 #1):

- Labels are 奥 / 中ほど / 手前, matching SLOT_Y. 手前・右 saved grid (4,3) and the plant
  rendered at 85% x / bottom row of the scene. Selector and screen geometry now agree.
- Ordinary labelled buttons with `aria-pressed`; no `role=gridcell`/`listitem` on buttons.

Error handling (review 02 #4):

- Forced `QuotaExceededError` on registration: stayed on 判定結果, showed a specific message,
  storage unchanged. No false success.
- Forced failure on placement: stayed on the picker, showed the error, placement unchanged.

Contrast and semantics (review 03 #3/#4, review 02 #2):

- No text below 4.5:1 found anywhere on the garden screen.
  Reunion badge is now #5c2438 on #f5dce6; photo nameplate #2d4a3e on opaque ivory.
- Single `main` landmark; garden and preview sections use valid `aria-labelledby`.
- No file inputs in the accessibility tree.
- h1 takes programmatic focus with `outline: none`; button focus rings intact.

Botanical corrections (review 01) are in both catalog and candidate data, with sources in
`docs/botanical-sources.md`: アジサイ科 (not ユキノシタ科), アヤメ, dry grassland.

`normalizePlacements` over-capacity and duplicate rejection is covered by the unit suite
(35 tests pass) and was **not** re-tested in the browser, per the review 03 instruction not to
freeze a live browser on it.

## Remaining fixes

### 1. Photo garden plant names are 11px

`src/components/garden/PhotoGarden.module.css:97` — `.name { font-size: 0.6875rem }`.
Measured 11px on all 10 cards. Review 02 explicitly ruled this out ("No ... 11px essential
labels. Use 12px minimum metadata and 14px normal controls where possible"), and the plant name
is the most essential label in the garden. The storybook garden already uses 13px
(`StorybookGarden.module.css:64`), so the two modes are also inconsistent.

Raise the photo nameplate text to at least 12px, ideally 13px to match the storybook garden.
Keep the opaque ivory plate and the current dark green.

### 2. ソメイヨシノ wraps to a one-character orphan line

At 11px in a 67px plate, ソメイヨシノ is the only name that wraps, breaking as
「ソメイヨシ」/「ノ」. Measured: 2 lines, 29px tall, where every other name is 1 line and 14–15px.
This also makes that one card ~2px taller than its row neighbours, so the row looks misaligned.

It is the longest name in the catalog, so this is the worst case, not an edge case. Fix so the
longest catalog name renders without a single-character orphan — widen the plate to the card
width, allow a slightly tighter letter-spacing, or set a 2-line plate height for every card so
rows stay aligned. Do not truncate the name and do not shrink the text further.

### 3. Tap targets are below the 44px the brief asks for

`企画書`/brief says タップ領域44px以上. Measured heights on the garden screen:

| control | size |
|---|---|
| 図鑑 | 46 x 36 |
| クレジット | 82 x 36 |
| 絵本の庭 / 写真の庭 | 178 x 40 |
| 自分の庭 / 0 / 3 / 10種類 | 57–78 x 36 |

Raise these to 44px of touch height. Padding or a transparent hit area is fine — the visual
pill can stay its current size if 44px looks too heavy in the header.

### 4. The storage error banner follows the user across screens

After a failed save, the banner stays mounted through 庭 -> 図鑑 -> クレジット, where it is no
longer relevant. On the placement picker the same sentence then appears **twice** (global banner
plus the inline picker error).

Clear the global banner on screen navigation, or scope it to the screen that raised it, so the
inline error is the only one on the picker. Keep the message wording and the dismiss control.

## Verification asked for

Re-run `npm test` and `npm run build`, and state the real results. For #1–#3, report the measured
final values (font px, wrap lines, control heights), not a description. Astra will re-check the
390x844 garden after the fix.

Note for the record: `npm` is not on the sandboxed PATH in this environment; it lives at
`/opt/homebrew/bin/npm`. `.claude/launch.json` was added for the dev-server preview and is not
part of the product.

---

## 検証結果（review 04 対応後）

実施日: 2026-09-08 / 実行者: Astra / 環境: Vitest, Vite 6 本番ビルド, Chromium 390x844

実装は Cursor CLI + Composer 2.5 が担当。ただし Composer のプロセスは編集完了後に約19時間半
無進捗のまま停止し、最終的に SIGTERM で終了したため、**Composer 自身によるテスト・ビルド・
報告は行われていない**。以下は Astra 側で実測したもの。

### 自動検証

| コマンド | 結果 |
|---------|------|
| `npm test` | **PASS** — 35 tests |
| `npm run build` | **PASS** |

### 指摘4件（すべて実測値で確認）

| # | 内容 | 実測 |
|---|------|------|
| 1 | 写真の庭の植物名 | 10種すべて **13px**（旧 11px） |
| 2 | ソメイヨシノの孤立行 | 10種すべて **1行**。孤立文字なし |
| 3 | タップ領域 | 図鑑 / クレジット / A・B切替 / プレビュー4種すべて **44px**。CTA 50px |
| 4 | エラーバナー | 画面遷移で消える。配置画面での出現は **1回のみ**（旧2回） |

実装方法（Composer）: `.name` を 0.8125rem 化、`.namePlate` に負マージン＋
`width: calc(100% + 0.75rem)`＋2行分の固定高＋`letter-spacing: -0.025em`、
`GardenScreen.module.css` に `min-height: 44px` を3箇所、`App.tsx` で画面遷移時に
`clearSaveError()` し配置画面ではグローバルバナーを描画しない。

### 回帰確認（review 01〜03 の受け入れ条件）

- **重なりゼロを維持**: 10種のカード矩形・名札矩形とも総当たりで衝突 **0件**。
  名札を広げた影響は出ていない。カード 74–77 x 88–91px。
- 再会意味論: 再登録で種類数 1 のまま、発見回数 2 / 再会回数 1、observations 2 件。
  連打しても重複登録なし。
- 保存失敗: 登録・配置とも画面に留まり、ストレージ無変更。
- コントラスト 4.5:1 未満 **0件**、12px 未満のテキスト **0件**。

### 残る所見（ブロッカーではない）

同一行の名札間の余白が **3–8px** と狭い。現状は衝突していないが余裕が小さいため、
今後カタログに長い和名を追加する場合はここが最初に破綻する。今回は修正不要。

### 制限

- デプロイ・git commit なし
- `.claude/launch.json` は dev サーバープレビュー用で製品外
