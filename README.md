# こもれび植物園 — 3Dチューリップ庭 MVP

散歩で見つけた植物を観察として残し、チューリップだけを自由に植えられる小さな **3D箱庭** です。

**現行仕様**: [`docs/mvp-3d-brief.md`](docs/mvp-3d-brief.md)  
**旧2D体験版**: [`docs/prototype-brief.md`](docs/prototype-brief.md)（歴史的）

## 起動

```bash
npm install
npm run dev
```

http://127.0.0.1:5173 を開きます。

```bash
npm test          # 単体テスト
npm run build     # 本番ビルド
npm run preview   # ビルドのプレビュー
```

## できること

- **3D庭**: タッチ/マウスで回転。角丸の土タイル、手続きプレースホルダのチューリップ
- **土の編集**: 足す・外す（花は失わず「しまう」）
- **花**: チューリップ解放後、何本でも植える・移す・しまう（観察回数とは独立）
- **観察**: 写真・日付・名前・色（チューリップ）を保存。非対応植物も観察のみ保存
- **識別**: Pl@ntNet API（サーバー経由）。キー未設定時は手動確認フロー（正直に表示）
- **永続化**: localStorage（v1 観察は v2 へ移行、v1 原本は `legacyV1` に保持）

## 植物識別 API

- 調査: [`docs/plantnet-research.md`](docs/plantnet-research.md)
- セットアップ: [`docs/plantnet-setup.md`](docs/plantnet-setup.md)
- 技術リサーチ（Claude Code）: [`claude-research/`](claude-research/README.md) — 写真解析と植物データ照合の調査
- `.env.example` → `.env.local` に `PLANTNET_API_KEY`（**コミットしない**）

キーなしでもサンプル写真・手動選択で全フロー体験可能。実識別はキー設定後。

## Vercel デプロイ

[`docs/vercel-deploy.md`](docs/vercel-deploy.md) — 環境変数・ルーティング・確認手順。

## 3Dモデル差し替え

ユーザー GLB 受け渡し: [`docs/model-handoff.md`](docs/model-handoff.md)

## データ

- 保存キー: `komorebi-garden-v2`
- 旧キー `komorebi-garden-v1` は移行時に読み取りのみ（上書きしない）

## 検証状況

[`docs/mvp-status.md`](docs/mvp-status.md)
