# 最新基盤でのAstra検証

> この文書は最新基盤への再統合時点の記録。以後の修正・Android実ビルド/操作検証・残条件は [自己レビュー解消ステータス](review-resolution-status.md) を参照。以下の149件・SDK未導入等の記述は当時の状態。

2026-09-10 JST。対象は `/Users/0124o/.codex/worktrees/c771/デジタル植物園`、開始HEAD `601b93b`。旧mainの検証と区別する。

## 配信元

5186はPID44221、cwd=c771をlsofで照合。外部のSupabase環境ファイルと旧環境のPLANTNET_API_KEYだけをプロセスへ渡して起動。識別healthは plantnetConfigured:true。旧mainを配信していた5187/PID34352は停止。キーは出力せず、ソースへ保存していない。

## 実装とレビュー

すべてのアプリ変更はCursor CLI / Composer 2.5に委任。庭の3D、gardenCamera、skyのコードは開始コミットから差分なし。最新CompleteScreen、花見本、viewing/building、明示観察リンクを維持。保存結果のawait、旧ナビ重複、JSX/CSS不一致、全削除後の墓標保持を修正した。全TSXのCSS参照点検で未定義なし、git diff --check成功。

Cursor最終検証は149 tests / 29 files成功、build/verify:api成功、Android cap sync / iOS cap copy成功。AstraはSupabase接続環境を渡したビルドと両OSへのWeb資産コピーも実行。ネイティブのバイナリビルド・実機試験とは区別する。

## ブラウザ検証

ユーザーの保存領域は編集せず、独立したagent-browserセッション、390x844で確認。

1. 統合前の5186でサンプル観察1件、チューリップ1本を明示リンク付きで保存。統合後再読込によりv2→v3へ移行。初回案内なし、同じplant id/modelType/observationIdsと写真を維持。花タップで同じ写真が開きnaturalWidth=960。
2. 新規セッションで初回案内の体験・庭・ログインの3導線を確認。
3. リポジトリのチューリップ実写真をファイル入力から選択（固定候補ボタンではない）。写真確認で再読込→下書き再開→送信前確認へ戻れることを確認。
4. Pl@ntNetを実呼び出しし、候補からTulipa gesnerianaを確認して保存。これは1回のプロバイダー接続試験。写真の同定精度を保証するものではない。保存レコードのidentificationSource=plantnet、isSample=falseを確認。
5. 完了画面→記録へ。写真を表示。メモを変更して保存。JSTの観察日9月10日を保持し、takenAt=createdAtのまま。
6. 庭づくり→花を選ぶ→明示的に観察を関連づけ→仮置き→確定→再読込。花タップから写真・Pl@ntNet表示・保存メモへ再訪できた。
7. 設定→データ管理→写真付きJSONバックアップをダウンロード。別の空のブラウザ領域で復元し、再読込後も花・観察・写真・メモを復元。花タップで写真naturalWidth=960。復元セッションのブラウザerrors配列は空。
8. 編集中のHMRで一時的hideNav未定義エラーが記録されたセッションがある。最終コードでは旧ナビごと除去済み。完了後に作成した復元セッションはエラーなし。
9. アプリ内ブラウザの5186タブでも「撮る/庭づくり/記録」、設定、既存チューリップ/コスモスの表示を確認。ユーザーの既存データをテストデータで上書きしていない。

画面証跡: /tmp/garden-latest-before.png、/tmp/garden-redo-onboarding.png、/tmp/garden-redo-detail.png、/tmp/garden-redo-memory.png、/tmp/garden-redo-restored.png。検証用バックアップ /tmp/garden-redo-backup.json。

## 未完了の外部条件

- Supabase管理画面へのログインは確認できた。ただし認証メール画面は「Set up custom SMTP to edit templates」で、独自SMTPが未設定。実メールOTP認証は未検証。
- 同一アカウントの別端末引き継ぎ、認証付き削除の実E2Eは未検証。手動バックアップの復元を自動同期の証拠に代用しない。
- Xcode本体、Java17/Android SDK等のネイティブ環境と実機試験が必要。Capacitor資産コピーのみを両OS動作合格とは扱わない。
- ストア版の公開識別API、サポート先/掲載資料等は未完了。

今回、Supabaseリソースの重複作成・遠隔DB再適用、コミット、公開はしていない。現段階は最新基盤へのローカル統合とコア操作確認完了であり、ストア公開可能の判定ではない。
