# Vercel デプロイ手順

こもれび植物園（Vite SPA + Node API）を Vercel に載せる手順です。アカウント作成・プロジェクト接続・本番デプロイは Astra が行います。

## 前提

- フロント: `npm run build` → `dist/`（静的 SPA）
- API: `api/health.ts` / `api/identify.ts`（Vercel Node Functions、`server/` の共通ロジックを再利用）
- 秘密情報: `PLANTNET_API_KEY` は **Vercel の Environment Variables にのみ** 設定（Production / Preview どちらでも可）

## 1. リポジトリを Vercel に接続

1. Vercel ダッシュボードで **Import Git Repository**
2. Framework Preset: **Vite**（自動検出）
3. Build Command: `npm run build`（`vercel.json` にも記載）
4. Output Directory: `dist`

## 2. 環境変数

| 名前 | 値 | 公開 |
|------|-----|------|
| `PLANTNET_API_KEY` | Pl@ntNet の API キー | **No**（サーバー関数のみ） |

- ローカル: `.env.example` をコピーして `.env.local` に記入（[plantnet-setup.md](./plantnet-setup.md)）
- Vercel: Project → Settings → Environment Variables に追加
- **フロントの `VITE_` プレフィックスは不要**（キーは `/api/*` 経由のみ）

## 3. ルーティング

- `/api/health` → キー設定状況（`plantnetConfigured`）
- `/api/identify` → POST `{ "imageDataUrl": "data:image/...;base64,..." }`
- その他のパス → `index.html`（SPA リライト、`vercel.json`）

## 4. デプロイ後の確認

```bash
curl -s https://<your-deployment>.vercel.app/api/health
# => {"plantnetConfigured":true,"provider":"plantnet"}

# キー未設定の場合は plantnetConfigured: false（503 は identify のみ）
```

ブラウザで写真を選び、識別候補が返ることを確認。

## 5. ローカル開発（変更なし）

```bash
npm run dev
# http://127.0.0.1:5173 — Vite ミドルウェアが同じ /api/* を提供
```

Vercel 本番では `api/*.ts`、ローカルでは `vite.config.ts` のミドルウェアが同じ `server/handlers` を呼びます。

## 6. アップロード除外

`.vercelignore` で以下を除外:

- `.env*`（`.env.example` 以外）
- `claude-research/`、`docs/`、企画・メタデータ
- テスト・スモークスクリプト

`src/`、`public/`、`server/`、`api/` はデプロイに含まれます。

## 7. デプロイ前チェック（ローカル）

Vercel の Node 関数コンパイラは `moduleResolution: NodeNext` 相当のため、API 依存ツリーは **相対 import に `.js` 拡張子**（TS ソースへの解決）が必須です。

```bash
npm test
npm run build
npm run verify:api   # api/health・api/identify の依存のみ NodeNext で型チェック
```

`verify:api` が通れば、Vercel 側の TS2834/TS2835（拡張子なし import）によるビルド失敗を事前に防げます。

## 制限（現行 MVP）

- 画像: デコード後 **4MB** まで
- Pl@ntNet 呼び出し: **20 秒** タイムアウト
- 認証・DB・追加バックエンドはなし

詳細は [plantnet-setup.md](./plantnet-setup.md) と [mvp-3d-brief.md](./mvp-3d-brief.md)。
# 公開記録 — 2026-09-08

- 本番URL: https://komorebi-garden.vercel.app/
- Vercel: kc2425 / komorebi-garden。GitHub kc2424/komorebi-garden のmainに接続。
- PLANTNET_API_KEYはProduction/PreviewのSecretとして登録。値はコード・文書に保存しない。
- 検証済みコード: b827ac1。本番deployment dpl_8R4PxZList2pjjpWZsbbLmQtPJKq がReady。
- 公開URLのhealth HTTP200とキー設定済みを確認。390×844の隔離ブラウザで実チューリップ写真をファイル入力から送信し、実API候補→確認→観察保存→植栽→再読込を確認。観察1件、植栽1本、識別元plantnetが保持された。
- NodeNextチェック、テスト25件、build成功。初回のNode ESM importエラーは.js指定で修正済み。
- 実端末のカメラ操作はユーザー確認待ち。保存はブラウザ内で、localhostと本番、Macとスマホは別の庭になる。ユーザーの最終3Dモデルは未受領。
