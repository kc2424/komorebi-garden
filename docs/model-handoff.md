# 3Dチューリップモデル受け渡し仕様

ユーザー制作の GLB を後から差し替えるための最小仕様。

## ファイル形式

- **GLB**（推奨）または GLTF + バイナリ
- 配置先（予定）: `public/models/tulip.glb`

## 座標・スケール

| 項目 | 値 |
|------|-----|
| 1土タイル | 1m × 1m（アプリ内 `TILE_SIZE = 1`） |
| 原点 | 花の **根元（土表面）** を `(0, 0, 0)` |
| 上方向 | +Y |
| 推奨高さ | 茎下〜花弁上 約 **0.45〜0.55** ユニット |
| 水平占有 | 直径 0.3 ユニット以内（隣の花と重ならない） |

## 色の変更

- 仮モデルは `TulipColor`（red / yellow / pink / white / purple / orange）でマテリアル色を差し替え
- 本モデルでは **花弁メッシュ名 `petal` または `Petals`** を持つ場合、アプリが `mesh.material.color` を設定
- 茎・葉は緑固定でよい

## 差し替え手順（実装側）

1. `public/models/tulip.glb` を置く
2. `src/components/garden3d/TulipModel.tsx`（未作成）で `useGLTF` 読み込み
3. `Garden3DCanvas` の `TulipMesh` を GLB 版に切替フラグで置換

現状は **手続きプレースホルダ**（`ProceduralMeshes.tsx` の `TulipMesh`）で体験検証可能。
