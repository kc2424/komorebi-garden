# Pl@ntNet API — 調査メモ（2026-09-08）

本MVPの単一識別プロバイダとして **Pl@ntNet API** を採用。以下は公式資料に基づく調査。実際の識別呼び出しは API キー設定後に別途検証する。

## 公式ドキュメント

| 項目 | URL |
|------|-----|
| はじめに | https://my.plantnet.org/doc/getting-started/introduction |
| 識別エンドポイント | `POST https://my-api.plantnet.org/v2/identify/{project}?api-key=...` |
| 料金・条件 | https://my.plantnet.org/pricing |
| 利用規約 | https://my.plantnet.org/terms_of_use |
| APIキー設定 | https://my.plantnet.org/settings/api-key |

## 接続概要（資料ベース）

- 1リクエストあたり **1〜5枚** の同一植物画像（`images` + `organs` を multipart で送信）
- 本実装はサーバー側 `/api/identify` が JSON（base64 data URL）を受け取り、サーバーから Pl@ntNet を呼ぶ（キーをフロントに出さない）
- チューリップ判定: 返却 `scientificNameWithoutAuthor` が `Tulipa` 属かどうかで分類。曖昧・別種をチューリップに自動変換しない

## 料金・制限（公式ページ記載、未実測）

| プラン | 内容 |
|--------|------|
| Free | **500 identifications / day**（公式 pricing / terms） |
| Pro | €1,000/年で 200,000 リクエスト枠、超過分は段階課金（公式 pricing） |
| 同時接続 | 最大 20 simultaneous requests（terms） |

※ 上記は 2026-09-08 時点の公式ページ要約。請求・実際の残クォータはアカウントで確認。

## 実装との対応

- キー未設定 → HTTP 503 + `status: not-configured`、手動候補で観察保存可能
- キー設定手順 → [`plantnet-setup.md`](./plantnet-setup.md)
- **本リポジトリでの実識別テスト**: キー未所持のため **未実施**（コード接続のみ実装）
