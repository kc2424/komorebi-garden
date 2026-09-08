# Pl@ntNet API セットアップ

## 1. APIキーを取得

1. https://my.plantnet.org でアカウント作成
2. https://my.plantnet.org/settings/api-key で API キーを発行

## 2. ローカル環境変数

```bash
cp .env.example .env.local
# .env.local を編集（このファイルは git に含めない）
PLANTNET_API_KEY=your-key-here
```

Vite 開発サーバー起動時に環境変数を読み込む:

```bash
npm run dev
```

`vite.config.ts` が `.env.local` をサーバー側に読み込みます。設定後は起動済みサーバーを再起動してください。キーをチャットやコマンド履歴に貼る必要はありません。

## 3. 動作確認

```bash
curl -s http://127.0.0.1:5173/api/health
# => {"plantnetConfigured":true,"provider":"plantnet"}
```

ブラウザで写真を選び、「Pl@ntNet API による識別候補」と表示されれば接続成功。

## 4. Vercel 本番

Vercel の環境変数に同じ `PLANTNET_API_KEY` を設定（サーバー関数のみ）。手順は [`docs/vercel-deploy.md`](./vercel-deploy.md)。

## 5. 注意

- キーをフロントエンドのソースや README に書かない
- Free 枠は 500 回/日（公式）。開発中はサンプル写真で体験可能
- CORS 公開は不要（サーバー経由のみ）
