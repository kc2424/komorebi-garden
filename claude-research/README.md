# Claude Code リサーチ結果

このフォルダは **Claude Code が担当した調査・知識まとめの置き場**です。

- 実装・製品仕様は Astra / Cursor 側（`docs/`）が持ちます。ここは **調べ物の結果だけ**を置きます。
- ここのファイルは仕様書ではありません。決定は Astra 側で行い、その根拠としてここを参照します。

## 使い方

- 「あの件どう調べたっけ？」→ 下の一覧を見る
- 新しく調べてほしいことがあれば「Claude、○○調べて」と言えば、`_template.md` に沿って 1問1ファイルで追加します
- 各ファイルは **冒頭3行に結論**。詳細は下に続きます

## 一覧

| # | ファイル | 何を調べたか | 状態 | 更新 |
|---|---------|-------------|------|------|
| 00 | [research-map.md](00-research-map.md) | 写真→植物照合の技術的な問題分解と、リサーチの進め方 | 設計済 | 2026-09-08 |
| 01 | [identification-providers.md](01-identification-providers.md) | 識別層：どのAPI/モデルで写真から学名を出すか | 完了（実測未） | 2026-09-08 |
| 02 | [taxonomy-backbone.md](02-taxonomy-backbone.md) | 照合層：学名の正規化・シノニム解決・自前DBとの突合キー | 完了 | 2026-09-08 |
| 03 | [plantnet-measurement.md](03-plantnet-measurement.md) | Pl@ntNet 実測①：サンプル10枚×3構成。精度・score分布・実バグ | 完了 | 2026-09-08 |
| 04 | [bench-real-conditions.md](04-bench-real-conditions.md) | **本番ベンチ30枚**：種63%/属88%、閾値の実効性、404棄却 | 完了 | 2026-09-08 |
| 05 | [recognition-architecture.md](05-recognition-architecture.md) | **画像認識アーキテクチャ決定文書**：コスト・オンデバイス・モバイル移行 | 完了 | 2026-09-08 |
| 06 | [vlm-vs-plantnet.md](06-vlm-vs-plantnet.md) | **汎用VLMとの直接対決**（ブラインド20枚）。Pl@ntNet続投の根拠 | 完了 | 2026-09-08 |
| 07 | [plant-knowledge-sources.md](07-plant-knowledge-sources.md) | 知識層の設計（4項目200字）+ サンプル5種執筆 | 完了 | 2026-09-08 |
| 14 | [vlm-confidence-layer.md](14-vlm-confidence-layer.md) | **VLMを確信度レイヤーに**：73%→87%、high/medium は11/11正解 | 完了 | 2026-09-08 |
| 13 | [japanese-name-authority.md](13-japanese-name-authority.md) | **和名の権威検証**。自前キュレーションの誤り4件を発見・修正、50/50一致 | 完了 | 2026-09-08 |
| 12 | [training-data-availability.md](12-training-data-availability.md) | **オンデバイス学習データ**：300Kは使えず、GBIFで足りる（商用可446,874枚） | 完了 | 2026-09-08 |
| 11 | [multi-image-and-synonyms.md](11-multi-image-and-synonyms.md) | 複数枚送信の効果（なし）と**シノニムの穴**（対策済み、照合キー1,814個） | 完了 | 2026-09-08 |
| 10 | [image-preprocessing.md](10-image-preprocessing.md) | **画像前処理の実測**。長辺1280px/q90 で通信量−76%、精度同等 | 完了 | 2026-09-08 |
| 09 | [japanese-name-rule.md](09-japanese-name-rule.md) | **和名選択ルール**（実装仕様）。72.7%→99.1%。4,937種で全数検証 | 完了 | 2026-09-08 |
| 08 | [species-shortlist.md](08-species-shortlist.md) | **対象50種の選定**（GBIF実測の遭遇頻度＋季節分散）。GBIF照合50/50 | 完了 | 2026-09-08 |

## 決まっていること（2026-09-08 ユーザー判断）

- **対象種数**: 厳選30〜50種を丁寧に。未収録種は属/科フォールバック + 観察のみ保存
- **特徴テキスト**: 自前キュレーション主体
- **識別プロバイダ**: 他社比較を経て判断する（→ 01 の結論は Pl@ntNet 続投）
- **最終形はモバイルアプリ**（→ 05。Capacitor が既存資産の観点で有利、オンデバイス識別が現実的な選択肢に）

## 未決（朝いちで判断が要る）

1. **識別はその場で即時か、持ち帰って後でか** — オンデバイス化の緊急度が決まる（→ [05 §9](05-recognition-architecture.md)）

## 補助データ

- [`data/plantnet-k-eastern-asia-species.csv`](data/plantnet-k-eastern-asia-species.csv) — 東アジア4,937種。GBIF ID 99.8%、日本語名 81.8%、640KB
- [`data/species-shortlist.csv`](data/species-shortlist.csv) — **対象50種**。gbifKey/genusKey/familyKey + **シノニムキー1,764個**つき（照合キー計1,814）
- [`data/species-photo-availability.csv`](data/species-photo-availability.csv) — 50種の学習用写真の入手可能枚数（世界/日本/商用可）
- [`data/species-knowledge-sample.csv`](data/species-knowledge-sample.csv) — 図鑑テキストのサンプル5種（書式の叩き台）
- [`TODO.md`](TODO.md) — バックログ（今やる / 今やらない / 判断待ち）

## 補助

- [`_template.md`](_template.md) — 調査ファイルの書式
- [`bench/`](bench/) — 精度を実測するための写真ベンチ（[README](bench/README.md) / [CREDITS](bench/CREDITS.md) / [labels.csv](bench/labels.csv)）

## 原則

1. **決定に効く問いだけ調べる。** 答えが出ても何も変わらない問いは捨てる
2. **一次情報を優先。** 公式ドキュメント／利用規約。ブログ・記事は補助扱い
3. **数字には必ず出典と取得日。** API仕様も料金も変わる
4. **実測できるものは実測する。** カタログスペックの比較だけで精度の話をしない
