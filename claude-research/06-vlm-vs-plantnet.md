# 06 — 汎用VLM vs Pl@ntNet：ブラインド20枚の直接対決

**結論（先に3行）**

1. **Pl@ntNet の勝ち。「微妙」ではない。** 同じ20枚で、種一致は **Pl@ntNet 16/20 (80%) vs 汎用VLM 15/20 (75%)**。差が決定的に開くのは属レベルで、**Pl@ntNet 19/20 (95%) vs VLM 15/20 (75%)**。しかも Pl@ntNet の種の外し3件は *Veronica polita/persica*、*Acer japonicum/palmatum*、*Artemisia indica/princeps* という**専門家でも写真では割れる近縁種**でした。
2. **VLMが外すときは壊滅的に外す。** ヨモギをキンポウゲ属、カラスウリをホオズキ、ヒカゲノカズラ科をサクラソウ科…と**属も科も違うもの**に飛びます。Pl@ntNet の誤りは「隣の種」、VLM の誤りは「別世界」。散歩アプリでは後者のほうが致命的です。
3. **ただしVLMは1つだけ決定的に優れていた：確信度が正しい。** 自己申告 `high` の9件は **9/9 全問正解**、`medium` 5/8、`low` 1/2、`verylow` 0/1。**[03](03-plantnet-measurement.md)・[04](04-bench-real-conditions.md) で Pl@ntNet の `score` にできなかったことが、VLMの自己申告では成立している。**

**状態**: 完了　**測定日**: 2026-09-08　**消費クォータ**: 20（累計約80 / 500）

---

## 0. なぜこれをやったか

> 「そのプラネット使うの微妙だと思うんだけどな。どうなんだろう?」（ユーザー）

疑いは正当でした。**それまで一度も他と比較していなかった**からです。特に汎用VLM（画像を見て答えるモデル）は完全に未検証でした。

---

## 1. 方法：ブラインドテスト

既存30枚は正解ラベルを先に見てしまっていたため、**新しい写真で汚染のない試験**を組みました。

| 項目 | 内容 |
|---|---|
| 出所 | **GBIF の日本の観察記録**（`country=JP`, `taxonKey=6`, `mediaType=StillImage`）。市民観察写真なので散歩スナップに近い |
| 枚数 | 20枚（重複種なし） |
| ライセンス | CC BY-NC 19件 / CC BY 1件。**評価目的のみ。リポジトリには保存していません** |
| 手続き | 画像をダウンロード → **正解ラベルはファイルに隠したまま表示しない** → VLMが画像だけ見て推定を記録 → その後 Pl@ntNet に同じ20枚 → 最後に正解を開いて採点 |
| Pl@ntNet 構成 | 現行実装と同一（`project=all`, `organs=auto`, `lang=ja`） |

生データ: [`bench/results-2026-09-08-blind20-vlm-vs-plantnet.csv`](bench/results-2026-09-08-blind20-vlm-vs-plantnet.csv)

---

## 2. 結果

| | 種一致 | 属一致 | top-5 |
|---|---|---|---|
| **Pl@ntNet** | **16/20 (80%)** | **19/20 (95%)** | 18/20 (90%) |
| 汎用VLM | 15/20 (75%) | 15/20 (75%) | — |

### 全20枚

| id | 正解（GBIF） | VLM | Pl@ntNet | score |
|---|---|---|---|---|
| B01 | *Artemisia princeps* ヨモギ | ✗ *Ranunculus* sp. | △ *Artemisia indica* | 0.208 |
| B02 | *Allium tuberosum* ニラ | ✅ | ✅ | 0.406 |
| B03 | *Hibiscus schizopetalus* | ✅ | ✅ | 0.850 |
| B04 | *Silene gallica* | ✗ *Dianthus barbatus* | ✅ | 0.870 |
| B05 | *Farfugium japonicum* ツワブキ | ✅ | ✅ | 0.960 |
| B06 | *Allamanda cathartica* | ✅ | ✅ | 0.886 |
| B07 | *Persicaria capitata* ヒメツルソバ | ✅ | ✅ | 0.908 |
| B08 | *Cardiocrinum cordatum* ウバユリ | ✗ *Hemerocallis* sp. | ✅ | 0.904 |
| B09 | *Punica granatum* ザクロ | ✅ | ✅ | **0.087** |
| B10 | *Trichosanthes cucumeroides* カラスウリ | ✗ *Physalis alkekengi* | ✗ *Passiflora caerulea* | 0.397 |
| B11 | *Veronica persica* オオイヌノフグリ | ✅ | △ *Veronica polita* | 0.530 |
| B12 | *Aucuba japonica* アオキ | ✅ | ✅ | 0.447 |
| B13 | *Melia azedarach* センダン | ✅ | ✅ | 0.989 |
| B14 | *Zephyranthes candida* タマスダレ | ✅ | ✅ | 0.762 |
| B15 | *Acer palmatum* イロハモミジ | ✅ | △ *Acer japonicum* | 0.432 |
| B16 | *Sarcandra glabra* センリョウ | ✗ *Ardisia crenata* | ✅ | 0.949 |
| B17 | *Lamium amplexicaule* ホトケノザ | ✅ | ✅ | 0.954 |
| B18 | *Quercus myrsinifolia* シラカシ | ✅ | ✅ | 0.814 |
| B19 | *Rhizophora stylosa* ヤエヤマヒルギ | ✅ | ✅ | 0.541 |
| B20 | *Solanum carolinense* ワルナスビ | ✅ | ✅ | 0.645 |

✅=種一致 / △=属のみ一致 / ✗=属も外れ

---

## 3. 誤りの「質」がまったく違う

これが今回いちばん本質的な発見です。

**Pl@ntNet が種を外した3件（B01, B11, B15）は、すべて同属の近縁種**でした。

- *Veronica polita* ↔ *Veronica persica*（イヌノフグリ ↔ オオイヌノフグリ）
- *Acer japonicum* ↔ *Acer palmatum*（ハウチワカエデ ↔ イロハモミジ）
- *Artemisia indica* ↔ *Artemisia princeps*（ニシヨモギ ↔ ヨモギ）

**写真1枚では専門家でも割れる組**です。「カエデの仲間です」と言えば全部正解になります。

一方 **VLM の誤り5件は、属も科も飛んでいます**。

| 正解 | VLMの答え | 距離 |
|---|---|---|
| *Artemisia princeps*（キク科ヨモギ） | *Ranunculus*（キンポウゲ科） | **別科** |
| *Trichosanthes cucumeroides*（ウリ科カラスウリ） | *Physalis alkekengi*（ナス科ホオズキ） | **別科** |
| *Silene gallica*（ナデシコ科マンテマ） | *Dianthus barbatus*（ナデシコ科） | 同科・別属 |
| *Cardiocrinum cordatum*（ユリ科ウバユリ） | *Hemerocallis*（ススキノキ科） | **別科** |
| *Sarcandra glabra*（センリョウ科） | *Ardisia crenata*（サクラソウ科マンリョウ） | **別科** |

→ **散歩アプリでは VLM の誤り方のほうが危険です。** 「バラ科の何か」まで当たっていれば体験は救えますが、科が違うと救えません。[04](04-bench-real-conditions.md) で設計した属フォールバックが機能するのは、Pl@ntNet の誤り方だからです。

（余談：B16 の *Sarcandra glabra*（センリョウ）を VLM が *Ardisia crenata*（マンリョウ）と答えたのは、**日本人が正月飾りで実際によく取り違える組**でした。人間らしい間違いですが、間違いは間違いです。）

---

## 4. VLM が唯一勝っていること：確信度が正しい

VLM は推定と同時に自己申告の確信度を出しました。その結果：

| 自己申告 | n | 種一致 |
|---|---|---|
| **high** | 9 | **9 / 9（100%）** |
| medium | 8 | 5 / 8（63%） |
| low | 2 | 1 / 2 |
| verylow | 1 | 0 / 1 |

**単調に効いています。** `high` と言ったときは全問正解でした。

対して Pl@ntNet の `score` は、この20枚でも分離しきれていません：

- **正解なのに score 0.087**（B09 ザクロ）
- **不正解なのに score 0.530**（B11）

[03](03-plantnet-measurement.md) の10枚、[04](04-bench-real-conditions.md) の30枚に続き、**3回目の測定でも同じ結論**です。Pl@ntNet の score は確信度として使えません。

### 設計上の含意

**Pl@ntNet の弱点（確信度がない）を、VLM の強み（確信度が正しい）で補える可能性があります。**

```
写真 → Pl@ntNet（種・属の同定は強い） → 候補
                                          ↓
                    VLM に「この候補で合っている?」と問う（確信度が正しい）
                                          ↓
                    高 → 断定してよい / 中〜低 → 属で括って候補提示
```

ただし**これは仮説であり、未検証**です。今回測ったのは「VLM が単独で識別したときの自己申告」であって、「Pl@ntNet の候補を検証させたときの精度」ではありません。またVLM呼び出しはトークン課金なので、全識別に挟むとコストが乗ります。**検証する価値は高い**と考えます。

---

## 5. この結果の限界（正直に）

| 限界 | 内容 |
|---|---|
| **n=20** | 種一致 16 vs 15 の差は、この標本数では**統計的に有意ではありません**。「VLMがPl@ntNetに勝てなかった」までは言えますが、「Pl@ntNetのほうが上」と断言するには足りない |
| **地理の前提が不公平** | VLM は「日本の写真」という文脈を持っていました。Pl@ntNet は `project=all`（全世界）で叩いています。**`k-eastern-asia` を使えば Pl@ntNet はさらに伸びる可能性があります** |
| **画像の渡し方が違う** | VLM には高解像度で渡しました。実アプリでは圧縮した画像を送ります |
| **正解ラベルの信頼性** | GBIF の観察記録は市民科学の同定であり、検証済みではありません |
| **VLMの条件** | 特定の1モデル・1設定での結果です。API経由の別モデルでは異なる可能性があります |

---

## 6. 結論：Pl@ntNet を続投してよい

ユーザーの疑問「Pl@ntNet 使うの微妙では?」に対する答えは、**「微妙ではない。汎用VLMより良かった」**です。

- 種 80% / **属 95%** は、散歩アプリの識別エンジンとして十分
- **誤り方が良い**（隣の種に外れる）ので、属フォールバック設計と噛み合う
- 無料枠 500/日、画像を保存しない、GBIF ID を返す ([05](05-recognition-architecture.md))

**残る弱点は精度ではなく確信度**です。そしてそれは「score で自動確定しない、属で括って候補を見せる」という設計で回避できます。VLMを確信度レイヤーに使う案は、その先の改善候補です。

---

## 次に検証すべきこと

1. **`project=k-eastern-asia` で同じ20枚を再測**（公平な比較になる。効果があれば即採用）
2. **VLM を「Pl@ntNet候補の検証役」に使ったときの精度**（§4の仮説）
3. n を50〜100に増やす

## 出典

| 内容 | 参照 | 取得日 |
|---|---|---|
| ブラインド20枚（GBIF日本の観察記録） | `https://api.gbif.org/v1/occurrence/search?country=JP&taxonKey=6&mediaType=StillImage` | 2026-09-08 |
| 実測生データ | [`bench/results-2026-09-08-blind20-vlm-vs-plantnet.csv`](bench/results-2026-09-08-blind20-vlm-vs-plantnet.csv) | 2026-09-08 |
| 識別 | `POST https://my-api.plantnet.org/v2/identify/all` | 2026-09-08 |

---

## 7. 追試：`k-eastern-asia` は精度を **下げた**（重要）

§5 で挙げた「地理の前提が不公平」を解消するため、**同じ20枚を `project=k-eastern-asia` でも回しました**。

| project | 種一致 | 属一致 | top-5 |
|---|---|---|---|
| **`all`（現行実装）** | **16/20** | 19/20 | **18/20** |
| `k-eastern-asia` | **15/20** | 19/20 | 17/20 |

**良くなるどころか悪化しました。** 変化したのは1枚だけですが、その中身が決定的です。

| id | 正解 | `all` | `k-eastern-asia` |
|---|---|---|---|
| B20 | *Solanum carolinense*（ワルナスビ） | ✅ *Solanum carolinense* **0.645** | ✗ *Solanum lycopersicum*（トマト）**0.006** |

### 原因：地域フローラには帰化植物が入っていない

`k-*` プロジェクトは **POWO（Kew）のチェックリスト + WGSRPD の地理区分**に基づく、いわば「その地域の在来フローラ」です。取得済みの4,937種リスト（[`data/`](data/plantnet-k-eastern-asia-species.csv)）を照合すると：

| 学名 | 和名 | 素性 | k-eastern-asia |
|---|---|---|---|
| *Solanum carolinense* | **ワルナスビ** | 北米原産の帰化植物 | **✗ 収録なし** |
| *Taraxacum officinale* | **セイヨウタンポポ** | ヨーロッパ原産の帰化植物 | **✗ 収録なし** |
| *Erigeron annuus* | ヒメジョオン | 北米原産の帰化 | ○ |
| *Veronica persica* | オオイヌノフグリ | ヨーロッパ原産の帰化 | ○ |
| *Trifolium repens* | シロツメクサ | ヨーロッパ原産の帰化 | ○ |
| *Zephyranthes candida* | タマスダレ | 南米原産の園芸逸出 | ○ |

15種中2種が抜けており、そのうち1つは **セイヨウタンポポ** — 日本の道端でおそらく最も目にする花です。

### 結論：`project=all` のままにする

**このアプリの舞台は「散歩で出会う都市の植物」であり、その相当部分が帰化植物・園芸種・逸出種です。** 在来フローラで絞り込むと、まさに一番出会う植物が候補から消えます。

→ [03](03-plantnet-measurement.md) で保留していた Q1-2（`project` を絞るか）の答えは **「絞らない」**。現行実装が正しい。

（`useful`（栽培・園芸植物 5,549種）はテーマ別プロジェクトなので性質が異なります。園芸品種のカバー用に併用する余地は残りますが、地理フローラは使うべきでない、が結論です。）

生データ: [`bench/results-2026-09-08-blind20-project-compare.csv`](bench/results-2026-09-08-blind20-project-compare.csv)
