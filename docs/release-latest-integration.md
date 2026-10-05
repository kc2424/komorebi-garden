# 最新の庭へのリリース機能統合

2026-09-10。今回の追加機能は古いmain上で作られていた。ユーザーの指示により最新基盤へ統合し直す。

## 正本と作業分担

対象: /Users/0124o/.codex/worktrees/c771/デジタル植物園
開始コミット: 601b93b (codex/garden-viewing-preview)
正しいプレビュー: http://127.0.0.1:5186/。開始時PID29852のcwdを上記と照合済み。
旧実装の参照元: /Users/0124o/Projects/Concepts/デジタル植物園 (main 667f7a1 + 未コミット追加)。参照元は変更しない。
Astraは仕様・レビュー・検証、アプリ実装はCursor CLI / Composer 2.5が担当。

## 統合契約

- 最新の庭のviewing/building、配置プレビュー、モデル選択、収納・復帰、空の時間/雲、カメラ構図、GardenMemoryPanelを維持。garden3d・gardenCamera・sky等を旧版へ戻さない。
- GardenPlantのmodelTypeとobservationIdsを保つ。観察との紐づけは明示IDによる。種や色だけで勝手に紐づけない。v2移行、IndexedDB保存、バックアップ、クラウド往復、収納でも維持する。
- 最新CompleteScreenの保存した観察写真と記録を見る導線、ObservationsScreenの撮影導線を残す。
- 旧実装のrelease-structure-requirements/release-sync-implementationを参照して初回案内、設定、写真確認、下書き、ヘルプ/プライバシー、データ管理、メールOTP、アカウント別保存、CAS同期、両OS Capacitorを移植。App/GardenScreen/useGardenStore/gardenActions/typesを丸ごと旧版に置換しない。
- 初回案内は本当の新規に表示。既存v2データはそのまま庭を再開でき、既存の写真・紐づけを失わない。新規の案内から体験とログインの両方へ進める。
- Supabaseは専用komorebi-garden (ckdwboedxmdphhsyvnli)を作成・DBとFunction適用済み。作成/再適用不要。キーは外部runtime.envからのみ渡す。既存プレビューと同じ5186で提供し、旧5187を案内しない。
- メールテンプレート/SMTP未設定、実OTPと別端末同期、Xcode/Androidビルド環境、本番識別APIは未検証の外部条件。実装済みと稼働検証済みを区別する。

## 受け入れ

最新カメラ・モデル・明示写真リンクの既存テストを保持する。追加機能の既存テストも取り込み、v2のモデル/写真リンクが保存・バックアップ・同期のシリアライズで維持される意味ある回帰テストを追加する。適切なtest/build/verify:apiを1回、必要なら失敗箇所を直して再実行。ブラウザでは同じ5186を使い、最新の庭、写真から保存、花の写真再訪、再読込保存、設定/バックアップを確認。変更前後の配信元と版を最終記録に残す。

公開・コミットは禁止。企画書.mdは変更しない。旧実装の検証記録を最新実装の検証済み証拠にしない。
