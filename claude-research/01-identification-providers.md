# 01 — 識別層：どのAPI/モデルで写真から学名を出すか

**結論（先に3行）**

1. **Pl@ntNet 続投が妥当。** 無料枠 500識別/日・商用利用可で、対抗馬に乗り換える理由が見つからなかった。iNaturalist はフル識別モデルを third-party に公開していないため**選択肢から外れる**。Plant.id (Kindwise) は無料枠が確認できず従量課金（€0.05→€0.01/識別）。
2. **現行実装は Pl@ntNet の性能を出し切っていない。** 1枚・`organs=auto`・`project=all` で呼んでいるが、公式仕様では **最大5枚・器官指定・プロジェクト絞り込み**が精度に効く。ここを詰めるのが乗り換え検討より先。
3. **画像前処理の指針が公式に明記されている**：サーバ側で長辺1280pxにリサイズされる／**800×800px 未満は性能保証なし**／JPEG品質90%推奨。現行の base64 送信はこれに合わせて見直す価値がある。

**状態**: 完了（実測は未実施）　**更新**: 2026-09-08

---

## 何を決めるための調査か

- Pl@ntNet を続投するか、乗り換えるか
- 続投するなら、現行の呼び出しパラメータをどう変えれば精度が上がるか
- 撮影UI（「花を撮って」「葉も撮る？」）を作る価値があるか

---

## 1. プロバイダ比較

| | Pl@ntNet | Plant.id (Kindwise) | iNaturalist CV | 汎用VLM (Claude/Gemini等) | オンデバイス |
|---|---|---|---|---|---|
| 植物特化 | ○ | ○ | ○ | × | 実装次第 |
| 無料枠 | **500識別/日・€0** | 未確認（要検証） | — | 従量 | 無料 |
| 有料 | Pro €1,000/年〜、€0.005〜0.002/識別 | €0.05〜0.01/識別（購入量による） | — | トークン課金 | — |
| 商用利用 | Free でも可 | 可 | **不可に近い**（下記） | 可 | 可 |
| 学名の返却 | ○ + **GBIF ID / POWO ID** | ○ | ○ | 断定は不得手 | モデル次第 |
| 器官指定 | ○（最大5枚） | ○ | — | — | — |
| 地域フローラ絞込 | ○（`project`） | — | — | — | — |
| 判定 | **続投** | 保留（比較用） | **除外** | 補助用途のみ | 将来検討 |

### iNaturalist を除外する理由

- フル種同定モデルは **third-party に公開されていない**。all-rights-reserved 写真を含む学習データの権利上の理由。公開されているのは約500分類群の "small" モデルのみ
- 利用規約：iNaturalist のデータを **商用目的の AI/ML 学習に使うことを禁止**
- API は 100 req/分（推奨60）・1万req/日にスロットル

→ 「散歩アプリの識別エンジン」としては使えない。**観察記録の投稿先**としてなら別の話だが、それは今回の範囲外。

### 汎用VLM の位置づけ

種名の断定には向かないが、**別の役割**なら有効：

- 「写っているのは花か葉か株全体か」の判定（= `organs` の自動決定）
- 「非植物画像の門前払い」
- 学名が確定した後の**和名解説文の下書き**（③知識層。ただし出典必須・要レビュー）

識別そのものの代替ではなく、Pl@ntNet の前後に挟む補助として検討する価値がある。

---

## 2. Pl@ntNet の仕様（公式ドキュメントより）

### エンドポイント

```
POST https://my-api.plantnet.org/v2/identify/{project}?api-key=...
```

| パラメータ | 内容 | 現行実装 |
|---|---|---|
| `images` | JPG/PNG、**最大5枚**、POST合計 50MB以下。同一個体であること | 1枚 |
| `organs` | `leaf` / `flower` / `fruit` / `bark` / `auto`。**画像枚数と値の数が一致必須**、順番で対応 | `auto` |
| `project` | フローラ（後述）。既定 `all` | `all` |
| `lang` | 常用名の言語 | `ja` |
| `nb-results` | 返す候補数（1以上） | 未指定 |
| `no-reject` | 非植物画像の棄却を無効化 | 未指定 |
| `detailed` | **科/属レベルの追加結果**を含める | 未指定 |
| `include-related-images` | 類似画像を返す | 未指定 |
| `type=legacy` | 旧モデル（非推奨） | 未使用 |

### レスポンス

- `results[]` … `score`（0〜1）、`species{ scientificName, commonNames[], genus, family }`、**`gbif{id}`**、**`powo{id}`**
- `bestMatch` … 第1候補の完全な種名
- `predictedOrgans` … 画像ごとの器官推定
- `remainingIdentificationRequests` … 当日の残クォータ

> **`gbif.id` が返る**のが今回いちばん重要な発見。→ [02-taxonomy-backbone.md](02-taxonomy-backbone.md)

### 画像の扱い（公式FAQ）

- サーバ側で**長辺1280pxにリサイズ**される
- **800×800px 未満は識別性能を保証しない**
- JPEG 品質90%を推奨
- 複数枚送ると結果が改善する
- モデルは InceptionV3、約2ヶ月ごとに更新（非回帰テストあり）

→ **Q1-6 の答え**：クライアント側で長辺1280px・JPEG q90 にリサイズしてから送るのが最適。それ以上大きく送っても精度は上がらず、通信量とレスポンス時間だけ悪化する。800px を下回らないよう注意。

### プロジェクト（フローラ）

- `GET /v2/projects` で一覧。`lang` のほか **`lat`/`lon` で近い順に絞れる**
- `k-*` は "Kew-TDWG (KT)" プロジェクト。POWO チェックリスト + WGSRPD level 2 の地理区分に基づく。`k-world-flora` は全KTの和集合
- テーマ別：**`useful`（Useful plants — Cultivated and ornamental plants）**、`weeds`、`invasion`、`crops`、`prota` など
- KT プロジェクトを使うと legacy より精度が上がる、と公式が明記

→ **Q1-2 に関する示唆**：公園や道端の**園芸品種**は `useful`（栽培・園芸植物）が効く可能性が高い。日本を含む地理プロジェクトの正確なIDは `/v2/projects` を叩かないと確定できない（**要APIキー、未実施**）。

### 料金（2026-09-08 時点、公式 pricing）

| プラン | 価格 | 内容 |
|---|---|---|
| Free | €0 | **500 identifications/day**。商用利用可 |
| Pro | €1,000/年〜 | 識別量に応じて €0.005 / €0.004 / €0.003 / €0.002 per identification（≤3M / >3M / >30M / >300M 件/年） |
| Non-Profit | €0 | 500/日超やバースト利用は申請制。**"powered by Pl@ntNet" ロゴ表示が必須** |

→ **Q1-4 の答え**：個人利用・小規模公開なら Free の 500/日 で十分。同一写真の再識別をキャッシュすれば実質さらに余裕がある。Pro への移行は 500/日 を恒常的に超えてから考えればよい。

---

## 3. 現行実装に対する具体的な改善候補

`server/plantnet.ts` の現状に対して：

| # | 改善 | 効果 | 根拠 |
|---|---|---|---|
| A | クライアントで長辺1280px・JPEG q90 にリサイズしてから送る | 通信量とレイテンシ削減。精度は落ちない | 公式FAQ |
| B | `organs` を指定できるようにする（撮影UIで「花／葉／実／樹皮」を選ばせる） | 精度向上が見込める | 公式仕様 |
| C | 複数枚（最大5枚）送信に対応 | 「複数枚で結果が改善」と公式が明記 | 公式FAQ |
| D | `project` を `all` から絞る（`useful` や日本を含むKTプロジェクト） | 園芸品種の当たりが改善する可能性 | 公式仕様 |
| E | `detailed=true` を試す | 科・属レベルの候補が取れ、フォールバックUXに使える | 公式仕様 |
| F | `results[].gbif.id` を保存する | ②照合層が整数マッチで済むようになる | → 02 |

> これらは**実装提案ではなく調査結果**です。採否は Astra の判断。

---

## 4. わからなかったこと / 次に必要なこと

- **`/v2/projects` の実際の一覧**（日本を含む KT プロジェクトのID）→ APIキーが要る
- `organs` の値に `habit`（株全体）や `other` が含まれるか（ドキュメントページからは `leaf/flower/fruit/bark/auto` のみ確認）
- `lang=ja` で **日本語の常用名がどれだけ返るか**（和名が薄い可能性が高い。→ 02 で別途調達が必要と判断）
- Free プランの同時接続上限（`docs/plantnet-research.md` は terms から「20 simultaneous」としているが、pricing ページには記載なし）
- Plant.id (Kindwise) の無料トライアル枠の有無
- **精度の実測**（top-1 / top-5 / 属レベル正解率 / score分布）→ [bench/](bench/README.md) と APIキーが必要

---

## 出典

| 内容 | URL | 取得日 |
|---|---|---|
| identify エンドポイント仕様 | https://my.plantnet.org/doc/api/identify | 2026-09-08 |
| FAQ（画像サイズ・モデル） | https://my.plantnet.org/doc/getting-started/faq | 2026-09-08 |
| 料金 | https://my.plantnet.org/pricing | 2026-09-08 |
| Kew/TDWG フローラ | https://my.plantnet.org/doc/references/newfloras | 2026-09-08 |
| taxonomy 関連ルート | https://my.plantnet.org/doc/api/taxonomy | 2026-09-08 |
| Kindwise 料金 | https://www.kindwise.com/pricing | 2026-09-08 |
| iNaturalist API リファレンス／利用規約 | https://www.inaturalist.org/pages/api+reference , https://www.inaturalist.org/pages/terms | 2026-09-08 |
| iNaturalist 公開モデルの範囲 | https://github.com/inaturalist/inatVisionAPI | 2026-09-08 |

---

## 追記（2026-09-08 実測後の訂正）

§3 の改善候補のうち **D（`project` を絞る）は取り下げます。**

- ブラインド20枚での実測で、`k-eastern-asia` は `all` より**精度が下がりました**（種 15/20 vs 16/20）
- 原因は、`k-*` が POWO の**在来フローラ**チェックリストであり、**セイヨウタンポポ・ワルナスビといった帰化植物が収録されていない**こと
- 散歩アプリの被写体は帰化植物・園芸種が多いため、地理フローラで絞ると逆効果
- → **`project=all` を維持する。** 詳細は [06 §7](06-vlm-vs-plantnet.md)

また **B（`organs` 指定）も効果が確認できていません**（[03](03-plantnet-measurement.md) §2）。残る有効な改善候補は **A（前処理）・C（複数枚）・E（`detailed`）・F（`gbif.id` 保存）** です。

そして [06](06-vlm-vs-plantnet.md) で汎用VLMとの直接対決を行い、**Pl@ntNet 続投の結論が実測で裏付けられました**。
