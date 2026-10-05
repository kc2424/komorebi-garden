# 最新基盤へのリリース機能統合 — 実装記録

2026-09-10 (JST)。対象ワークスペース: `/Users/0124o/.codex/worktrees/c771/デジタル植物園`。開始コミット `601b93b`（`codex/garden-viewing-preview`）。参照元のみ: `/Users/0124o/Projects/Concepts/デジタル植物園`（変更なし）。

## 配信元・版

| 項目 | 値 |
|------|-----|
| 統合前 HEAD | `601b93b` — 3D庭 viewing/building、明示 observationIds、CompleteScreen 写真導線 |
| 統合後（未コミット） | 上記 + リリース層（IndexedDB v3、OTP/CAS同期、初回案内、設定、バックアップ、Capacitor）+ 統合レビュー4件の修正 |
| プレビュー URL | `http://127.0.0.1:5186/`（変更なし。5187 は案内しない） |
| Supabase プロジェクト | `ckdwboedxmdphhsyvnli`（komorebi-garden、東京）— マイグレーション・Edge Function は適用済み。本統合ではネットワーク変更なし |

## 統合レビュー修正（2026-09-10 追記）

`docs/release-latest-review.md` の4件 + 5186 再現分（#5）を c771 のみで解消。

| # | 内容 | 対応 |
|---|------|------|
| 1 | 観察保存が IndexedDB 完了前に成功扱い | `saveObservation` / `updateObservation` / `updateObservationMemo` を `await applyState` 化。`App` / `IdentifyScreen` / `ObservationDetailScreen` で失敗時は下書き・フォーム保持、エラー表示、二重送信防止 |
| 2 | バックアップ復元・全削除の同期メタ | `mergeRestoredState` で現在アカウントの `lastSyncedRevision` / `tombstoneRevision` を保持し revision を増やして pending 化。ログイン中オフライン全削除は停止。クラウド削除成功時はサーバー返却 revision / tombstone を保持。他スコープは削除しない |
| 3 | 初回案内にログイン導線 | `OnboardingScreen` に「ログインして引き継ぐ」→ `auth` 画面。既存 v2 データユーザーは従来どおり案内スキップ |
| 4 | 識別・詳細画面の JSX 回帰 | `ObservationDetailScreen` を最新 `ScreenFrame` + journal CSS（`heroMeta` / `metaList` 等）に復元し、表示名・観察日・色・削除を統合。`IdentifyScreen` は `ScreenFrame` ベースを維持（下書き永続化・保存失敗 UI 追加）。3D/カメラ/空/明示リンクは未変更 |
| 5 | App.tsx 旧版ナビ二重表示 | 末尾の旧 `bottomNav`（未定義 CSS）と `hideNav` を除去。`GardenScreen` の「撮る/庭づくり/記録」とヘッダー設定ボタンのみ |
| 6 | 全削除後 reload で tombstone 消失 | `handleWipe` で `replaceState(wiped)` の後に `clearScopeData` していた順序バグを修正。`clearScopeWipeArtifacts` で現スコープの写真・退避・guest legacy のみ削除し、墓標付き空庭を IndexedDB に残す。guest は onboarding リセット、他スコープ/グローバル設定は触らない |

## 主な変更

### 保持した最新庭の挙動

- `garden3d` / `gardenCamera` / `DecorativeSky` / `GardenMemoryPanel` / 配置プレビュー / 花カタログ（tulip・cosmos・pansy）
- `CompleteScreen` の保存写真・日付・サンプル表示と「記録を見る」導線
- `ObservationsScreen` の月別ジャーナルと「撮る」導線
- チューリップのみ `observationIds` による明示リンク（色・種からの推論なし）
- `IdentifyScreen` の provenance 表示・ScreenFrame UI（`onDraftChange` で下書き永続化）

### 移植したリリース層

| 領域 | 内容 |
|------|------|
| 永続化 | localStorage v2 → IndexedDB v3（`localDb` / `imageStore` / `serializableState`）、ユーザー別スコープ |
| 移行 | v1→v2→v3。既存 v2 の `modelType` / `observationIds` を v3 移行で保持 |
| 同期 | `src/sync/*`（Supabase OTP、CAS pull/push、競合 UI、`useAppSession`） |
| UX | 初回案内（体験・庭・ログイン）、写真確認、下書き再開、設定/ヘルプ/プライバシー/データ管理/認証 |
| バックアップ | JSON エクスポート/インポート（画像同梱）、CAS 安全な復元マージ |
| ネイティブ | Capacitor 7.2.0（android/ios プロジェクト、`platform/native.ts`） |
| サーバー資産 | `supabase/`（migrations、delete-account function、verify SQL）— 参照用コピー、再適用なし |

### 初回案内の条件

- `appMeta.onboardingComplete === false` の新規のみ表示
- IndexedDB / localStorage に既存データがあるユーザーは `loadState` 後に庭へ直行し、`onboardingComplete` を自動設定（データ・写真リンクを失わない）
- 案内画面から「植物を見つける」「庭を見てみる」「ログインして引き継ぐ」の3導線

## テスト・ビルド結果（レビュー修正 + #5/#6 後 1回実行）

| コマンド | 結果 |
|----------|------|
| `npm test` | **149 passed**（29 files） |
| `npm run build` | **成功** |
| `npm run verify:api` | **成功** |
| `npx cap sync android` | **成功**（web assets → android） |
| `npx cap copy ios` | **成功**（web assets → ios） |

### 追加・更新した回帰テスト

- `src/test/observationSave.test.ts` — IndexedDB 失敗時に `saveObservation` が `saved: false`、state 未更新
- `src/test/backup.test.ts` — `mergeRestoredState` の CAS 保持、`createWipeState` の tombstone 保持
- `src/test/dataManagementWipe.test.ts` — 全削除後 reload で墓標付き空庭が残ること、`clearScopeData` 後置きによる baseline 消失の回帰、guest legacy v2 非復活
- `src/test/App.test.tsx` — 初回案内にログインボタン、設定は `GardenScreen` ヘッダーから遷移
- `src/test/v2LinksModels.test.ts` — v2 localStorage 移行、IndexedDB 往復、バックアップ、同期シリアライズで `modelType` / `observationIds` 維持
- リリース由来: `sync*.test.ts`, `useAppSession.test.tsx`, `observationDate.test.ts`, onboarding を含む `App.test.tsx`

## 制限・未検証（正直な区分）

| 項目 | 状態 |
|------|------|
| メール OTP / SMTP テンプレート | 実装済み。本番メール配信は未検証（外部設定依存） |
| 別端末 CAS 同期 E2E | 実装済み。2端末実機検証は未実施 |
| Xcode / CocoaPods / Java 17 | ネイティブプロジェクトは同期済み。実機ビルド環境は未検証 |
| Pl@ntNet 本番識別 | キー設定時のみ。未設定時は手動候補（従来どおり） |
| 認証情報 | `.env.example` にプレースホルダのみ。実キーはリポジトリ外 |

## ローカル確認の目安（5186）

1. 既存データ: 再読込後も庭・観察・花リンクが残る
2. 新規（localStorage/IndexedDB 空）: 初回案内 → 体験 / 庭 / ログイン
3. 撮影 → 写真確認 → 識別 → Complete の写真/記録導線（保存失敗時は識別画面に留まる）
4. 設定 → データ管理（バックアップ復元・全削除）/ 認証画面が開く
5. 庭づくり・モデル選択・収納復帰後も `modelType` / リンクが維持

## コミット

ユーザー指示により **コミット・公開なし**（作業ツリーに未コミット変更 + 新規ファイル多数）。
