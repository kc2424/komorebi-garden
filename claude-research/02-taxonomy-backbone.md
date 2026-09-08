# 02 — 照合層：識別結果を自前の植物データに突き合わせる

**結論（先に3行）**

1. **文字列で照合してはいけない。整数で照合できる。** Pl@ntNet の identify レスポンスは各候補に **`gbif.id`（GBIF usageKey）** を含む。自前の30〜50種にこの ID を持たせておけば、照合は「学名の文字列比較」ではなく **整数の一致判定**になり、表記ゆれ・命名者・シノニム・雑種記号（`×` と `x`）の問題が**丸ごと消える**。
2. 自前データの GBIF ID は **`https://api.gbif.org/v1/species/match`（無認証・無料）で開発時に1回引くだけ**でよい。実行時にネットワークを増やす必要はない。シノニムは `acceptedUsageKey` で受容名に寄せられる。
3. **和名（日本語名）は GBIF からは取れない。** ソメイヨシノで実測したところ、GBIF の vernacularNames に日本語エントリは0件（英・仏・独・中・韓のみ）。**和名は自前で持つのが正解**で、スコープが30〜50種ならこれは負担にならない。

**状態**: 完了（設計判断の材料が揃った）　**更新**: 2026-09-08

---

## 何を決めるための調査か

- 自前の30〜50種テーブルの**主キーを何にするか**（後から変えると一番高くつく）
- 学名の表記ゆれ・シノニムをどう吸収するか
- 種で当たらなかったときのフォールバックをどう作るか
- 和名をどこから調達するか

---

## 1. 何が問題だったか

識別APIが返す学名は、そのままでは自前テーブルのキーと一致しない：

| 問題 | 例 |
|---|---|
| 雑種記号の表記ゆれ | `Prunus × yedoensis` / `Prunus x yedoensis` / `Prunus yedoensis` |
| 命名者付き | `Tulipa gesneriana L.` |
| シノニム（異名） | 旧学名で返る、または自前が旧学名 |
| 階級のズレ | `Tulipa`（属止まり）、`Hydrangea macrophylla f. macrophylla`（品種） |
| 園芸品種 | `Tulipa 'Apeldoorn'` |

現行実装の `isTulipaScientificName()` は「小文字化して `tulipa` で始まるか」という文字列判定で、これは**チューリップ1属だから成立しているだけ**。30〜50種に広げた瞬間に破綻する。

---

## 2. 解決策：GBIF usageKey を主キーにする

### 発見

Pl@ntNet の identify レスポンスの各 `results[]` には以下が含まれる（公式仕様）：

```
results[].gbif.id   ← GBIF の usageKey
results[].powo.id   ← Plants of the World Online の ID
```

つまり**識別プロバイダの側が、既に世界標準の分類バックボーンへの参照を返してくれている**。

### 照合の流れ

```
写真 → Pl@ntNet → results[0].gbif.id = 3021335
                            ↓
              自前テーブルを gbifKey で引く（整数の一致）
                            ↓
              { 和名: "ソメイヨシノ", 科: "バラ科", 特徴: "…" }
```

**文字列正規化のコードは1行も要らない。**

### 自前テーブルの作り方（開発時に1回）

GBIF の名前照合APIは**無認証・無料**で叩ける。実測：

```bash
curl 'https://api.gbif.org/v1/species/match?name=Prunus%20x%20yedoensis&verbose=true'
```

```json
{
  "usageKey": 3021335,
  "scientificName": "Prunus × yedoensis Matsum.",
  "canonicalName": "Prunus yedoensis",
  "rank": "SPECIES",
  "status": "ACCEPTED",
  "confidence": 99,
  "matchType": "EXACT",
  "family": "Rosaceae",  "familyKey": 5015,
  "genus": "Prunus",     "genusKey": 3020559,
  "speciesKey": 3021335,
  "order": "Rosales",    "class": "Magnoliopsida"
}
```

**`x` と書いても `×` の正式名に EXACT で当たる（confidence 99）。** 表記ゆれはGBIF側が吸収している。

シノニムも解決される。実測：

```bash
curl 'https://api.gbif.org/v1/species/match?name=Hydrangea%20macrophylla%20f.%20macrophylla'
```

```json
{
  "matchType": "EXACT",
  "status": "SYNONYM",
  "confidence": 96,
  "usageKey": 7318998,
  "acceptedUsageKey": 2985994,
  "rank": "VARIETY",
  "canonicalName": "Hydrangea macrophylla macrophylla"
}
```

→ `status: "SYNONYM"` のときは `acceptedUsageKey` を採用する、というルールだけあればよい。

### Pl@ntNet 側にも同等の機能がある

`GET /v2/projects/{project}/species/align?name=...&synonyms=true` が、名前を正規化して **GBIF / POWO / IUCN / EOL / GRIN の各IDを返す**。
また `GET /v2/projects/{project}/species`（ページング可）で**プロジェクト内の全種を GBIF ID 付きで列挙**できる。

→ 自前30〜50種のIDを埋めるのに、GBIF と Pl@ntNet のどちらを使ってもよい。**GBIF の方が無認証で叩ける分いま試しやすい**（実際この調査は GBIF で実測した）。

---

## 3. フォールバック設計（Q2-4 の答え）

GBIF の match レスポンスは `speciesKey` / `genusKey` / `familyKey` を**同時に返す**。自前テーブルにこの3つを持たせておけば、3段階のフォールバックが自然に書ける：

| 段階 | 判定 | 表示イメージ |
|---|---|---|
| 1. 種が一致 | `gbif.id` が自前テーブルにある | 「ソメイヨシノ。バラ科。3〜4月、葉より先に花が…」 |
| 2. 属が一致 | `genusKey` が一致 | 「サクラの仲間（*Prunus*）のようです」 |
| 3. 科が一致 | `familyKey` が一致 | 「バラ科の植物のようです」 |
| 4. どれも外れ | — | 「この植物はまだ図鑑にありません。観察として記録しますか？」 |

**30〜50種スコープでは 4 が頻繁に起きる**（散歩で出会う植物の大半は収録外）。ここを「失敗」ではなく「まだ見ぬ植物」として気持ちよく見せる設計が、体験の分かれ目になる。→ Q4-2

なお Pl@ntNet の `detailed=true` は科/属レベルの追加結果を返すので、段階2・3の材料としても使える（**未検証**）。

---

## 4. 和名（日本語名）をどこから取るか

### GBIF からは取れない — 実測で確認

`https://api.gbif.org/v1/species/3021335/vernacularNames`（ソメイヨシノ）を叩いた結果、**日本語（`jpn`）のエントリは0件**。仏語・英語・独語・中国語・韓国語のみ。

→ **GBIF を和名の供給源にする設計は成立しない。**

### 選択肢

| 出所 | 内容 | 判断 |
|---|---|---|
| **自前で書く** | 30〜50種なら現実的。表記も世界観も完全にコントロールできる | **推奨**（スコープの決定と整合） |
| Pl@ntNet `lang=ja` の `commonNames` | 日本語がどれだけ返るか未検証。薄い可能性が高い | 補助・答え合わせ用 |
| 維管束植物和名チェックリスト ver.1.10 | 山ノ内崇志・首藤光太郎・大澤剛士・米倉浩司・加藤将・志賀隆（2019）。JBIF（GBIF日本ノード）公開。Excel(.xlsx) 約5.5MB。『改訂新版 日本の野生植物』『Green List』『YList』等が典拠。**標準和名の権威**として使える | **答え合わせの一次資料として推奨**。ライセンス条件は**要確認**、引用時はバージョン併記が推奨されている |
| YList（ylist.info） | 日本産植物の和名-学名インデックス。APIは無く、過度なアクセスは非推奨 | 人手での確認用 |
| Wikidata | 学名から各言語名へのハブ。構造化されている | 未調査。自動化するなら候補 |

→ **和名は自前で書き、維管束植物和名チェックリストで答え合わせする**のが、品質・コスト・ライセンスのバランスが最も良い。既に `docs/botanical-sources.md` で「アジサイ科への修正」を出典付きで直した実績があり、この運用と地続き。

---

## 5. 推奨するデータ構造（案）

> 実装仕様ではなく、調査から導かれる形の提案です。採否は Astra の判断。

自前30〜50種の1件が持つべき情報：

| フィールド | 例 | 出所 |
|---|---|---|
| `gbifKey` | `3021335` | GBIF match（開発時に1回） |
| `genusKey` / `familyKey` | `3020559` / `5015` | 同上 |
| `scientificName` | `Prunus × yedoensis` | 同上 |
| `commonNameJa` | `ソメイヨシノ` | **自前**（和名チェックリストで検証） |
| `familyNameJa` | `バラ科` | **自前**（同上） |
| `trait` / `season` / `story` | 「葉より先に花が咲く」等 | **自前キュレーション** |
| `synonymKeys[]` | 旧学名の usageKey 群 | GBIF（任意。`acceptedUsageKey` 解決で代替可） |

保存する観察レコード側にも `gbifKey` を残しておくと、後から図鑑テキストを増補したときに**既存の観察が自動で豊かになる**。逆に和名文字列だけで保存すると、後から紐づけ直せない。

---

## 6. わからなかったこと / 次に必要なこと

- Pl@ntNet が `gbif.id` を**返さないケース**の頻度（属止まりの結果、新しい分類群など）→ 実測が必要
- `lang=ja` での `commonNames` の日本語充足率 → APIキーが必要
- 維管束植物和名チェックリストの**正式なライセンス条項**（gbif.jp のページが 403 で直接取得できず、二次情報のみ）
- Wikidata 経由で和名を自動取得できるか（③知識層の調査で扱う）

---

## 出典

| 内容 | URL | 取得日 |
|---|---|---|
| Pl@ntNet identify レスポンス（gbif/powo ID） | https://my.plantnet.org/doc/api/identify | 2026-09-08 |
| Pl@ntNet taxonomy ルート（species/align） | https://my.plantnet.org/doc/api/taxonomy | 2026-09-08 |
| GBIF 名前照合（実測） | https://api.gbif.org/v1/species/match?name=Prunus%20x%20yedoensis&verbose=true | 2026-09-08 |
| GBIF シノニム解決（実測） | https://api.gbif.org/v1/species/match?name=Hydrangea%20macrophylla%20f.%20macrophylla | 2026-09-08 |
| GBIF 常用名に日本語なし（実測） | https://api.gbif.org/v1/species/3021335/vernacularNames | 2026-09-08 |
| 維管束植物和名チェックリスト ver.1.10 | https://gbif.jp/activities/checklist/wamei_checklist_110/ （403のため二次情報: https://wetlands.info/tools/plantsdb/nameconv/ ） | 2026-09-08 |
| YList | http://ylist.info/ | 2026-09-08 |

---

## 追記：整数照合の穴（2026-09-08、[11](11-multi-image-and-synonyms.md)）

本書は「`gbif.id` を整数比較するだけでよい」としましたが、**不十分でした。**

**Pl@ntNet が返す `gbif.id` は、受容名のキーとは限りません。** 同じビワの写真で、1枚送ると *Rhaphiolepis bibas*（受容名, 10786206）、2枚送ると *Eriobotrya japonica*（シノニム, 3024146）が返りました。

→ 自前テーブルに**シノニムのキーも全部入れる**必要があります。[08](08-species-shortlist.md) の50種では実施済みで、照合キーは **1,814個**（受容名50 + シノニム1,764）になりました。ナズナ1種だけで508個のシノニムがあります。

なお §5 の「`species/align` でも正規化できる」も誤りで、**align は Pro 専用**です（[05 §10](05-recognition-architecture.md)）。GBIF の `species/match` は無認証・無料で使えるので、そちらを使ってください。
