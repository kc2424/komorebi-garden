# 自己レビュー解消の操作検証

2026-09-10 JST。AstraによるWeb操作確認と、同一タスク内のAndroid検証担当による実エミュレーター確認。要件: [review-resolution-requirements.md](review-resolution-requirements.md)。総合判定: [review-resolution-status.md](review-resolution-status.md)。

## 対象の照合

- 最新作業領域: `/Users/0124o/.codex/worktrees/c771/デジタル植物園`、開始HEAD `601b93b`。
- `http://127.0.0.1:5186/` のLISTENプロセスはPID44221、cwdも上記c771と一致。
- アプリ内ブラウザーの同じ5186タブに、既存のチューリップ/コスモスと最新の「撮る・庭づくり・記録」が表示されることを確認。ユーザーのデータをテスト用データで上書きしていない。
- テストは独立したagent-browserセッションと専用Androidエミュレーターで実行した。作業後、Webのテストセッションは閉じた。
- アプリ実装はすべてCursor CLI / Composer 2.5。今回の3D・カメラ・空のソースに差分なし。コミット・公開はしていない。

## G1 下書き

Webで写真確認中の下書きを作成→再読込し、再開案内を表示。

| 操作 | 永続データ/画面の結果 |
|---|---|
| ×を押す | draftが残り、再読込で再び案内される |
| Escape | draftが残る |
| 再開案内の外側の背景を実クリック | 案内だけ閉じ、IndexedDBのdraftに写真を保持。「撮る」で案内を再表示 |
| 「下書きを破棄」→確認をキャンセル | draftが残り再開案内へ戻る |
| 「下書きを破棄」→「破棄する」 | draftが消える |

Androidでは写真ピッカーから選択し、送信前確認中にforce-stop→再起動。再開案内でAndroid Backを押すと案内だけが閉じる。その後「撮る」で再び案内され、「再開する」で同じ写真の送信前確認に戻った。

![Android Back後にも残る下書き](verification-2026-09-10/android-draft-retained.png)

「あとで」・保存失敗保持等の回帰は自動試験で扱う。モック試験と上記の実操作を区別する。

### 識別通信中の再起動

完了監査で、通信の結果を受け取る前に再読込すると識別が自動再送される経路を発見した。明示的な新規識別と下書き再開を区別し、結果が未保存の再開では案内と「もう一度識別する」を表示するよう修正。結果が保存済みの再開は候補を復元する。アンマウント後の古い通信結果は、新しい下書きを上書きしない。

専用ブラウザーの `/api/identify` だけを未解決Promiseに置き換え、元のAPIを呼ばない制御試験を実施。通常の写真選択→識別開始で呼出1回・通信中→再読込→監視を再設定→下書きを再開した時点の呼出は0回。明示的に「もう一度識別する」を押すと1回になった。これは再送制御の試験で、実認識試験ではない。

![中断結果の再開で自動再送しない](verification-2026-09-10/web-interrupted-no-resend.png)

React StrictModeの疑似cleanupで最初の応答まで破棄してしまう回帰も修正した。StrictMode下で識別1回→応答反映、実アンマウント後の応答無視の両方を試験した。

修正後の実ブラウザーでも、新しい写真→通常の識別開始1回→制御した正常JSONを返すと候補表示になり、loadingが終了することを確認。呼出は1回のまま、errorsは空。候補名を「制御テストのチューリップ」としたモック試験で、実APIは呼んでいない。テスト用セッションは終了済み。

## G2 保存から直接配置

Webではリポジトリの `public/samples/tulip.jpg` を**写真ファイル選択から**読み込んだ。固定候補のサンプルボタンは使用していない。送信確認後に実Pl@ntNet候補（Tulipa agenensis 0.28等）を受け取り、赤・表示名「朝の赤いチューリップ」で保存した。これはAPI接続の証拠であり、植物種の正答保証ではない。

1. 完了画面に「この花を庭に植える」が主行動として表示される。
2. 主行動を押すと、写真と表示名を保持して土選択へ直接進む。
3. 「完了」で配置を中断すると、観察1件・花0本を保持する。
4. 空庭には「朝の赤いチューリップを庭に植える」が表示され、再撮影を要求しない。
5. 最初の実操作でこのCTAが親の `pointer-events:none` を継承してタップ不能と判明。CursorがCTAだけを `pointer-events:auto` に修正。通常クリックで土選択へ進むことを再確認した。
6. 実ポインターで中央の土を選択→「ここに植える」で、赤いチューリップ1本を保存し、同じ写真の思い出パネルが開いた。
7. 再読込後も同じplant ID・modelType=tulip・color=redを保持。`observationIds[0]` が保存した観察IDと厳密一致。
8. 再読込後に3Dの花を実クリックし、写真を再表示。表示画像のsrcが保存した観察のimageDataUrlと一致し、画像読み込み完了を確認した。

![写真を引き継いだ直接配置](verification-2026-09-10/web-direct-placement.png)

![再読込後の花から同じ写真へ](verification-2026-09-10/web-revisited-photo.png)

非対応側は紫陽花の**固定サンプル**で別途確認した。「サンプル写真・固定候補」を表示し、保存後は「記録を見る」が主行動で、植えるボタンがない。記録画面へ遷移できた。

観察詳細側の導線も別途UI新規サンプル1件を未配置保存して確認。「記録を見る」→観察詳細の「この花を庭に植える」で同じ名前・写真（naturalWidth=960）の仮置きへ進んだ。土を実マウス選択して「ここに植える」を通常ダブルクリックしても花は1本だけ。永続状態で元の観察IDへのリンク1件・観察1件・収納0を確認。実APIは呼んでいない。検証セッションのerrorsは空。

![観察詳細から直接配置](verification-2026-09-10/web-detail-to-plant.png)

AndroidではAndroid 15/API35/arm64の実アプリから写真ピッカーを使用した。実Pl@ntNet候補取得→候補選択→保存→直接配置→土の実タップ→確定→思い出→force-stop→起動→花の実タップ→写真再訪が成功。ネイティブHTTPログで既存公開APIへの接続を確認した。主操作時のFATAL EXCEPTION/ANRなし。

![Androidの実識別結果](verification-2026-09-10/android-real-identification.png)

![Android再起動後の写真再訪](verification-2026-09-10/android-revisited-photo.png)

空庭CTAのAndroid確認だけは、既に保存・再起動保持を確認したテスト端末で空庭状態を用意して実施した。CTAがタップを受け、写真を紐づけた配置へ進むことを確認。状態準備を、保存そのもののE2E証拠には数えない。

## G3 初回案内

390×844で写真→庭→思い出の実画像例、主行動、別セクションの既存利用者ログインを表示。体験イメージと明示し、チューリップのみ観察写真と結びつけて植えられること、コスモス/パンジーはお試し見本と説明。

320×568でも横はみ出しなし。スクロール対象の画面コンテナーを実際にスクロールし、3つのボタンがすべて操作範囲へ入ることを確認した。案内完了後の再読込では庭へ戻る。

![初回案内](verification-2026-09-10/web-onboarding.png)

![小画面でスクロール後の導線](verification-2026-09-10/web-small-screen.png)

## G4 認証

通常プレビューはメール運用準備フラグをoffのまま維持。「引き継ぎの準備中」と表示し、コード送信ボタンは無効。Supabase接続があるだけで引き継ぎ可能とは案内しない。ゲスト記録は使用できる。

認証送信・コード検証・再送はモック試験。60秒経過時に再送が有効化し、1回の再送要求、失敗後の再試行、成功後の待機再開、固定宛先、宛先変更、古い送信結果の無視を試験。実メール到達・2端末同期は未検証。

認証済みのログアウト失敗では、下書き・ユーザー・庭を保持し、アカウント画面にエラーを表示して再試行できることをモック試験で確認。同期失敗も同画面に表示する。

Supabaseのエラー応答を使うサービス層のモック試験も追加。無効なメールアドレスを無効コードと案内する誤り、SMTP送信障害を入力間違いと案内する誤りを修正。期限切れ/無効OTP、429、通信失敗、ログアウトの返却エラー/例外に日本語の復帰案内が返る。未知のエラーは操作別の日本語文言にする。全体の最終自動試験は192件合格。

## ブラウザーエラーと残条件

上記の最終操作セッションでagent-browser `errors` は空。Viteオーバーレイなし。コンソールのThree.js Clock/PCFSoftShadowMap非推奨警告は既存のもので、今回の操作失敗は発生しなかった。

iOSはWeb資産コピーまで。終盤にXcode 26.6が導入されたが、Apple利用規約への同意・初回セットアップ待ち。Androidはdebug APK/エミュレーターの合格で、物理実機やストア版の合格ではない。最終認証修正版APKのビルド・更新インストール・起動・準備中表示も追加確認済み。実メール・自動引き継ぎ・iOSに必要な作業は [外部条件と受け入れ手順](release-external-acceptance.md) に分離した。

継続時の外部状態再確認: SupabaseのSMTP Settingsで「Enable custom SMTP」スイッチがoff、テンプレート画面も「Set up custom SMTP to edit templates」。設定の変更は行わず、確認用タブを閉じた。`xcodebuild -checkFirstLaunchStatus` / `xcrun simctl list devices available` は規約未同意で69。動作中のiOSビルド/初回セットアッププロセスもない。未回答の同意・送信サービス情報を推定して進めない。

## iOS follow-up: build and launch only (2026-09-10)

Xcode/SDK consent and initial setup completed (`-checkFirstLaunchStatus` exit0). Cursor added native purpose strings and Privacy Manifest. Unsigned Simulator build succeeded; installed current192-test app into a dedicated iPhone17 Pro / iOS26.5 device. Initial onboarding and 3D garden, including garden after relaunch, were visually confirmed. CUA input failed with window/ScreenCaptureKit errors even after reconnection and restart; photo selection/identification/planting/revisit remain unverified on iOS. Initial onboarding heading overlaps Dynamic Island. See [native record](native-verification-2026-09-10.md) for exact scope and commands.

- [iOS photo entry](verification-2026-09-10/ios-photo-entry.png)
- [iOS garden after relaunch](verification-2026-09-10/ios-garden-after-relaunch.png)

## iOS追補: 初回案内の上端余白を実表示で確認

CursorによるCSS1行の修正後、空データの新規iPhone17 Pro/iOS26.5で最新アプリを起動。UIタップなしで初回状態を撮影し、見出し全体がDynamic Islandの下、体験イメージと主ボタン3つが見えることを目視確認。safe-area0のWebも修正前後の位置寸法一致。[実際の初回案内](verification-2026-09-10/ios-onboarding-safe-area.png)。

前回のios-onboarding.pngは実際には「花を記録」の入口だったため、ios-photo-entry.pngへ改名・参照訂正。初回案内の証跡には上記の新規端末画像を使う。

既存iOS端末で撮る→写真を選ぶ→[写真許可画面](verification-2026-09-10/ios-photo-permission.png)の用途説明まで確認。後続はCUA接続エラーが続いた。CLIでの写真アクセス事前許可は実UI合格と分け、写真選択・実識別・配置・写真再訪は未検証のまま。
