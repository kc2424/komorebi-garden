# バックログ（Claude 担当分）

**更新**: 2026-09-08　**方針**: 上から順に潰す。完了したら ✅ と成果物リンクを書く。

---

## A. 今やる（ユーザーの判断を待たずに進められる）

| # | やること | なぜ今やるか | 状態 |
|---|---|---|---|
| A1 | **対象50種の選定リスト** | 完了 → [08](08-species-shortlist.md) / [`data/species-shortlist.csv`](data/species-shortlist.csv)。50種38科、季節21/11/9/9 | ✅ |
| A2 | **選定種の照合テーブル構築** | 完了 → [`data/species-shortlist.csv`](data/species-shortlist.csv)。**GBIF照合 50/50 EXACT、シノニム解決ゼロ** | ✅ |
| A3 | **和名選択ロジックの検証** | 完了 → [09](09-japanese-name-rule.md)。**72.7% → 99.1%**。仕様確定、Cursorに渡せる | ✅ |
| A4 | **知識層の設計 + サンプル執筆** | 完了 → [07](07-plant-knowledge-sources.md) / [`data/species-knowledge-sample.csv`](data/species-knowledge-sample.csv)。4項目200字の型 + 5種執筆 | ✅ |
| A5 | **画像前処理の実測** | 完了 → [10](10-image-preprocessing.md)。**1280pxで通信量−76%、精度同等** | ✅ |
| A6 | **複数枚送信の効果** | 完了 → [11](11-multi-image-and-synonyms.md)。**効果確認できず＋scoreだけ上がる**。副産物でシノニムの穴を発見・対策済み | ✅ |
| A7 | **VLM確信度レイヤーの検証** | 完了 → [14](14-vlm-confidence-layer.md)。**仮説的中：73%→87%、high/medium は 11/11 正解** | ✅ |
| A8 | **学習データの調達可能性** | 完了 → [12](12-training-data-availability.md)。**300Kは使えない（8/50）が GBIF で足りる（46/50が商用可600枚超）** | ✅ |
| A9 | **和名の権威データ検証** | 完了 → [13](13-japanese-name-authority.md)。**私のキュレーションに4件の誤り**を発見・修正。50/50一致、日本語科名も取得 | ✅ |

## A-完了

**A1〜A9 すべて完了しました（2026-09-08）。**

## B. 今はやらない（理由つき）

| やらないこと | 理由 |
|---|---|
| Pl@ntNet-300K 本体（31.7GB）のダウンロード | Phase 2用。**対象種が決まってから必要な種だけ抜けばよい**。今落としても置き場所を食うだけ |
| オンデバイスモデルの学習 | 学習データはユーザーの訂正が貯まってからのほうが良いものになる（[05 §7](05-recognition-architecture.md)）。今作るのは早い |
| Capacitor 導入・モバイル移行 | 実装であり **Cursor の担当**（[AGENTS.md](../AGENTS.md)）。調査は[05 §6-5](05-recognition-architecture.md)で完了済み |
| `commonNames`・404分岐・`gbifKey`保存 などのコード修正 | すべて**実装 = Cursor の担当**。私は仕様と根拠を出すところまで |
| 種リスト同梱の規約確認（Pl@ntNetへの問い合わせ） | 外部への連絡。**ユーザーの判断が要る** |
| 識別タイミング（その場 / 持ち帰り）の決定 | **ユーザーの判断**。技術ではなく体験設計 |
| 有料プラン・課金設計 | 無料枠100人/日で当面足りる（[05 §2](05-recognition-architecture.md)）。人が増えてから |

## C. ユーザーの判断待ち

1. **識別はその場で即時か、持ち帰って家でか** → オンデバイス化の緊急度が決まる（[05 §9](05-recognition-architecture.md)）
2. A1で出した種リストの承認（何を入れて何を落とすか）
3. Phase 1 の7項目を Cursor に投げるか（[05 §7](05-recognition-architecture.md)）

---

## 制約メモ

- Pl@ntNet 無料枠 **500識別/日**。2026-09-08 は約100消費済み。A5/A6/A7 で追加消費するので配分に注意
- 画像のライセンス: CC BY-NC のものは**リポジトリに保存しない**（評価目的でスクラッチのみ）
