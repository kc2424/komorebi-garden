# 自己レビュー解消ステータス（G1–G5）

2026-09-10 JST。c771 worktree 未コミット統合への実装結果。Astraが要件・レビュー・操作検証を担当し、アプリ修正はCursor CLI / Composer 2.5が実施。

**判定: G1〜G4のローカル修正・検証は完了。AndroidエミュレーターとiOS Simulatorの写真選択→実識別→保存→直接配置→プロセス再起動→同じ写真の再訪を確認済み。iOSの保存・配置は本人の補助操作を含む。Gmail実メール認証とブラウザ別保存領域での写真・花の基本引き継ぎも合格。今回の同期修正のネイティブ反映、実端末間引き継ぎ、物理実機・配布は未完了。全体のリリース完了ではない。**

プレビューは [最新版5186](http://127.0.0.1:5186/)。PID44221のcwdをc771と照合済み。旧mainを配信していない。

関連文書: [要件](review-resolution-requirements.md) / [画面・操作の証跡](review-resolution-verification.md) / [外部条件と次の受け入れ手順](release-external-acceptance.md)。

## 検証サマリー

| チェック | 結果 |
|---------|------|
| `npm test` | **192/192 合格**（認証サービスエラー +8、中断識別 +7、StrictMode回帰 +1を追加） |
| `npm run build` | **合格** |
| `npm run verify:api` | **合格** |
| Capacitor | **Android sync 合格** / iOS web copy 合格 / iOS Pods同期済み（両lockfile一致） |
| Web 390×844 / 320×568 | **合格** — 実識別・直接配置・同じ写真再訪、下書き保護、小画面スクロール |
| Android 15/API35 | **合格** — debug APKビルド・実識別・配置・強制停止後の写真再訪・Android Backで下書き保持 |
| iOS 26.5 Simulator | **コアフロー合格** — 実識別・観察保存・直接配置・プロセス再起動後に同じ写真とPl@ntNet API表示を確認。保存・配置は本人補助 |
| 実メール / 同一アカウント別端末 | **未完了** — SMTP準備待ち |

---

## G1 下書き保護 — 実装済み

**実装**
- 再開モーダルを「再開する」「あとで」「下書きを破棄」に分離。× / Escape / 背景クリック / 「あとで」は `onDismiss` で閉じるのみ（下書き保持）。
- **Android 戻る**: 下書き再開・破棄確認モーダル表示中は `registerBackButton` がモーダルを閉じるだけ（下書き保持）。アプリ終了しない。
- 「下書きを破棄」は二段階確認後のみ `persistDraft(null)`。
- **識別の fresh / resume 分離**: `App` が `identifyAutoStart` を管理。写真確認の「識別を始める」だけ `autoStart=true`。`resumeDraft` は常に `autoStart=false`。
- **中断識別の再開**: `step=identify` かつ `identificationAttempted` 未完了（候補なし）の再開は自動 API 呼び出しなし。中断バナー＋「もう一度識別する」明示操作のみ再送。戻るで写真確認へ（写真・下書き保持）。
- **完了候補の再開**: `identificationAttempted` + 候補ありは復元のみ（自動呼び出しなし）。色・名前・provenance は既存どおり。
- **古い応答の無視**: `IdentifyScreen` のrequest idとmounted状態で応答の反映可否を判定。実アンマウント後の結果は反映せず、StrictModeの疑似cleanupでは初回要求の結果を受け取れる。別写真の下書きを古い結果で上書きしない。
- 保存失敗時の下書き保持は既存挙動を維持。

**確認方法**
- `src/test/draftProtection.test.tsx`（× / Escape / あとで / Android戻る → draft 残存、明示破棄 → draft 消失、**中断 identify 再開→unmount/remount→再開で provider 0回→明示リトライで1回**、**完了候補再開で provider 0回**、**古い in-flight 応答が別写真下書きを上書きしない**）
- `src/test/identifyScreen.test.tsx`（`autoStart` 時のみ初回呼び出し、resume/interrupted UI、リトライ連打防止、stale 応答無視）
- Web実操作で×/Escape/破棄キャンセル後の永続draft保持、確認付き破棄後の消失を確認。Androidの実Backボタンでも案内だけ閉じ、再開で同じ写真に戻る。
- 背景の実クリックでもdraft保持・再案内を確認。識別通信を意図的に未完了にした専用ブラウザーで、再読込→再開は通信0回、明示的な再試行で1回。実APIを呼ばない制御試験と明記。
- React StrictModeのeffect再実行でも、通常識別1回の結果を受け取れる回帰試験が合格。実アンマウント後の古い結果は無視し、写真を上書きしない。

**残条件**
- なし（ローカル受け入れ範囲）

---

## G2 観察から直接配置 — 実装済み

**実装**
- `CompleteScreen` 主CTA「この花を庭に植える」（チューリップかつ未リンク時のみ）。
- **非対応植物**: 主導線を「記録を見る」（primary）、「庭を見る」は secondary。
- `ObservationDetailScreen` に同導線。`enterPlantingFlowForObservation` 等は既存維持。
- 空庭に保存済みの花の名前を明記した配置CTAを表示。実タップ検証で見つけた親のpointer-events継承を修正し、通常のクリック/Android実タップで配置へ進める。

**確認方法**
- `src/test/directPlanting.test.tsx`（非チューリップで記録を見るが先頭 primary）
- 既存 `plantObservationLink.test.ts` / `plantingFlowStore.test.ts` 維持
- Web/Androidとも写真選択→実Pl@ntNet→保存→直接配置→再起動→3Dの花タップで同じ写真へ再訪。Webでは明示リンクID・色・画像srcの一致も確認。
- 配置キャンセルで観察を保持し花が増えないこと、紫陽花の固定サンプルでは記録が主導線で植えるボタンがないことを実操作で確認。
- 観察詳細のCTA→同じ写真/観察IDを保持した仮置きを実操作で確認。「ここに植える」を通常ダブルクリックしても花1本・元観察IDへのリンク1件だけを保存。

**残条件**
- 物理実機での操作はG5の残条件。Web/Androidエミュレーターでの主要操作は合格。

---

## G3 初回体験 — 実装済み

**実装**
- iOS初回案内の上部paddingに `env(safe-area-inset-top, 0px)` を加算。新規iPhone17 Proで見出しの重なり解消を確認。safe-area=0のWebでは位置・寸法が修正前と一致。
- 体験イメージ: `/samples/tulip.jpg`（記録・思い出カード）、`/samples/onboarding-garden-example.png`（実アプリ庭スクリーンショット、object-fit: cover）。
- 主CTA「最初の植物を記録する」。副CTA「庭を見てみる」。
- 既存利用者向け「既にアカウントをお持ちの方」セクションを分離し「ログインして引き継ぐ」を配置。
- 「体験イメージ」ラベル維持。3D本体は未改修。

**確認方法**
- `src/test/App.test.tsx`（体験イメージ・庭例画像・既存利用者セクション）
- 実ブラウザー390×844で画像と主導線を確認。320×568は画面コンテナーをスクロールでき、3つの導線へ到達できる。Android初回表示も確認。

**残条件**
- なし（asset は `public/samples/onboarding-garden-example.png` に同梱）

---

## G4 認証の復帰経路 — 実装済み

**実装**
- `VITE_AUTH_EMAIL_READY` ゲート、宛先固定、再送・宛先変更・戻る、ログイン済み Banner 等は既存維持。
- **再送カウントダウン修正**: `resendCooldown===0` で再初期化していた effect を廃止。deadline ベースのカウントダウンに変更し、60秒経過後は 0 のまま再送可能。再送成功時のみ新 deadline。
- 開発者向け文言「コード送信成功とログイン完了は別の段階です」を削除し、利用者向けの行動可能コピーに置換。
- **ログアウト/同期失敗表示**: `signOut` は `{ ok, error? }` を返し Supabase エラー/例外を日本語の行動可能コピーに変換。`handleSignOut` は signOut 成功後のみ下書き削除・`clearScopeData`・`reload(null)`・session-generation 進行。失敗時は draft/ユーザースコープ/庭を保持しエラーを返す。認証済み `AuthScreen` は `session.syncError`（今すぐ同期失敗）とログアウト失敗 Banner を表示し、失敗時はアカウント画面に留まって再試行可能（`try/finally` で loading 解除）。未同期確認（`needsConfirm`）と成功時の既存挙動は維持。
- **操作別エラー映射**: `mapAuthErrorMessage(error, context)` で send/verify/signout を分岐。`Invalid email address` を OTP 不正に誤変換しない。SMTP/送信失敗は送信失敗コピー、期限切れ/不正コードは再送案内、429 は待機、ネットワークは接続確認、未知エラーは操作別の日本語フォールバック（生の英語を返さない）。

**確認方法**
- `src/test/authScreen.test.tsx`（未準備ブロック、fake timer 60秒→再送1回→失敗後も再送可能→成功後再クールダウン、宛先変更、不正コード、**認証済み syncError 表示、ログアウト失敗→留まる→再試行成功**）— **モック明記**
- `src/test/authService.test.ts`（**モック Supabase 応答から send 不正メール・送信サービス失敗・verify 期限切れ/不正・429/ネットワーク・signOut 返却/例外** を操作別日本語コピーへ変換）
- `src/test/useAppSession.test.tsx`（**signOut 失敗で draft/ユーザースコープ/庭保持、再試行成功でクリーンアップ**）

**残条件（外部）**
- `VITE_AUTH_EMAIL_READY=true` は SMTP 運用準備完了後にデプロイ環境で設定（Astra）。
- 実メール送信・受信の合格判定は G5。ローカル UI モック合格を本番メール合格に代用しない。

---

## G5 自動引き継ぎ/配布検証 — 部分実装

### ネイティブ識別API接続 — 実装済み（ローカル）

**実装**
- `VITE_IDENTIFICATION_API_BASE_URL`（HTTPS origin、例: `https://komorebi-garden.vercel.app`）。
- ネイティブ: `@capacitor/core` の `CapacitorHttp.get` / `CapacitorHttp.post` を `src/platform/identificationApi.ts` で明示使用。
- Web: 従来の same-origin `/api/health` / `/api/identify`（fetch、変更なし）。
- 未設定・非HTTPS・接続失敗時は手動確認へ誘導するエラー表示。サンプル識別は非通信。
- fetch 全体の置換、TLS/CORS 無効化、グローバル fetch パッチは行っていない。

**確認方法**
- `src/test/identificationApi.test.ts`（web same-origin、native CapacitorHttp、未設定、サンプル非通信、接続失敗）
- 公開 API health: Astra 実 GET で `https://komorebi-garden.vercel.app/api/health` → 200、`plantnetConfigured: true`
- Androidの写真ピッカーから実画像を選び、ネイティブHTTP経由の公開 `/api/identify` 接続・Pl@ntNet候補取得を確認。固定サンプル識別を実接続の証拠にしていない。

**ネイティブビルド向け設定**
- Android/iOS ビルド時に `VITE_IDENTIFICATION_API_BASE_URL=https://komorebi-garden.vercel.app` を Astra が接続環境へ渡す必要あり（リポジトリに秘密値は含めない）。

### 同期・配布・外部検証 — 残条件

| 項目 | 状態 |
|------|------|
| 2端末実同期・実メール OTP | **未検証**（SMTP + `VITE_AUTH_EMAIL_READY` 待ち） |
| Android `cap sync` | **成功**（web assets + `onboarding-garden-example.png` → `android/app/src/main/assets/public`） |
| iOS web copy | **成功**（`ios/App/App/public`） |
| iOS Pods | **同期済み** — Podfile.lockとPods/Manifest.lock一致、workspace Appで実ビルド成功 |
| iOS Xcode / Simulator | **同意・初回設定完了** — Xcode26.6、iOS26.5/23F77、署名不要のSimulatorビルド・起動成功 |
| Android Gradle 実ビルド | **成功** — debug APKを専用エミュレーターへインストールして操作確認 |
| JDK21 / Android SDK / エミュレーター | 導入済み。Google SDK規約はユーザーの明示同意後に導入。既存のシェル/Java設定は変更なし |
| CocoaPods | **導入済み** — 1.17.0、`/opt/homebrew/bin/pod` |
| 物理実機 / ストア用署名・配布 | 未検証・未公開 |

**iOSの現在地と残条件**
1. ユーザーがXcode/Apple SDK規約への同意を明示。`xcodebuild -checkFirstLaunchStatus` は **0**。管理者権限が必要なCLI同意は失敗したが、その後GUIの規約画面が閉じ、上記チェックで実際の完了を確認。再度の同意は不要。
2. Cursor / Composer 2.5が用途説明3項目、Preferences/FilesystemのPrivacy ManifestとResources登録だけを追加。最新192テスト版Web資産を保持し、署名不要のSimulatorビルド **BUILD SUCCEEDED**。
3. 専用iPhone17 Pro / iOS26.5でインストール、初回案内、3D庭表示、再起動後の庭表示を確認。自動タップはCUAの `noWindowsAvailable` / ScreenCaptureKit `-3811` 等で失敗し、接続更新・Simulator再起動でも解消しなかった。写真選択→識別→配置→写真再訪は **iOSでは未検証**。初回案内の見出しとDynamic Islandの重なりは、CSS1行の修正と新規端末の実画像で解消を確認。
4. 操作環境復旧後にiOS主要操作を検証し、その後、実機・配布の署名と端末準備に進む。

詳しい手順と合格条件は [release-external-acceptance.md](release-external-acceptance.md) に記録。

**SMTP 本番**
- ローカル UI モック・Supabase 接続のみでは実メール合格扱いにしない。SMTP サービス/独自ドメイン設定は Astra 外部作業。
- 初期費用0円・住所非掲載のGmail SMTP候補を準備し、利用アカウントと資格情報の保存について確認中。SMTP設定・実メールは未完了。`VITE_AUTH_EMAIL_READY` はoffのままで「引き継ぎの準備中」を維持。最新方針は末尾と `email-delivery-setup.md` を参照。

---

## 変更ファイル（主要）

- G1: `src/App.tsx`, `src/components/discover/IdentifyScreen.tsx`, `src/test/draftProtection.test.tsx`, `src/test/identifyScreen.test.tsx`
- G2: `src/components/discover/CompleteScreen.tsx`, `src/test/directPlanting.test.tsx`
- G3: `src/components/onboarding/*`, `public/samples/onboarding-garden-example.png`, `src/test/App.test.tsx`
- G4: `src/sync/authErrors.ts`, `src/sync/authService.ts`, `src/hooks/useAppSession.ts`, `src/components/settings/AuthScreen.tsx`, `src/test/authScreen.test.tsx`, `src/test/authService.test.ts`, `src/test/useAppSession.test.tsx`
- G5: `src/platform/identificationApi.ts`, `src/services/identification.ts`, `.env.example`, `src/vite-env.d.ts`, `src/test/identificationApi.test.ts`

## 今回の対象外・未完了

- コミット / デプロイ / プレビュー5186 再起動
- 3D・カメラ・空の変更
- iOSの写真選択以降の主要操作・物理実機カメラ・ストア版署名/配布
- G5 の SMTP 本番設定・2端末実検証・ストア配布

Androidエミュレーターでは主要操作が通ったが、3ボタンOSナビゲーションと下端UIの余白に調整余地を記録した。物理実機・複数のナビゲーション方式で確認する。無関係な外観改善の追加周回は行わない。

## 最終Android成果物（iOS上端余白の修正を反映）

- APK: `android/app/build/outputs/apk/debug/app-debug.apk`（debug版、ストア配布用ではない）。
- 最終Webバンドル: `index-C2zu_IsU.js`、CSS: `index-DcdDsiR2.css`。
- サイズ: 29,427,614 bytes。
- SHA256: `9167627eee6e9f21b461c3de0b394210211ed9f51ad50a0f11652cc79ff929c0`。
- 192テスト合格時の機能コードに初回案内CSS1行修正を反映。Gradleビルド・署名検証成功。ZIP内の上記バンドルを確認。
- 実エミュレーターの主要操作は先のCSS/認証修正版で実施。「引き継ぎの準備中」と送信無効化、FATAL EXCEPTION/ANRなしも確認済み。今回追加した共通JSの中断再開・通常識別成功は最新版ブラウザーで制御通信試験を実施。192版のAPKではエミュレーター全操作を繰り返していない。
- 検証用エミュレーターは停止し、担当CDP転送を解除済み。SDK/JDK/AVDは再利用用に保持。

環境構築・主要操作・最終APKの詳細: [native-verification-2026-09-10.md](native-verification-2026-09-10.md)。

## iOS成果物（2026-09-10追記）

- アプリ: `/tmp/komorebi-ios-derived/Build/Products/Debug-iphonesimulator/App.app`。Simulator用、arm64/x86_64、約29MB。ストア配布用の署名済みIPAではない。
- ビルドログ: `/tmp/komorebi-ios-verification/simulator-build.log`。
- 成果物のInfo.plistに日本語用途説明3項目、PrivacyInfo.xcprivacyにUserDefaults `CA92.1` / FileTimestamp `C617.1`、public/index.htmlに `index-C2zu_IsU.js` / `index-DcdDsiR2.css` を確認。
- 最初のiOS設定修正ではWebソース変更なし。その後の初回案内CSS1行修正は、Webの位置寸法比較・両OS再ビルド・新規iPhone実表示で確認。機能コードは既存192テスト合格版から変更なし。
- [写真記録の入口](verification-2026-09-10/ios-photo-entry.png) / [再起動後の庭](verification-2026-09-10/ios-garden-after-relaunch.png)。主要操作完了の証跡とは区別する。

## iOS追補の最終確認（2026-09-10 09:01 JST）

- 最新iOS成果物は `index-C2zu_IsU.js` / `index-DcdDsiR2.css` を同梱、再ビルド成功。
- 空データの新規iPhone17 Pro/iOS26.5（32346FB3-9733-4523-8E92-E98695FCC3CD）で初回案内を起動。UIタップなしで撮影し、見出しがDynamic Islandの下、体験イメージと主ボタン3つが見えることを目視確認。[実際の初回案内](verification-2026-09-10/ios-onboarding-safe-area.png)。
- 既存テスト端末で「撮る」→「写真を選ぶ」→[iOS写真許可画面](verification-2026-09-10/ios-photo-permission.png)の用途説明まで確認。後続のCUA入力は不安定で、写真選択以降の主要操作は未検証。
- 専用Simulatorの写真アクセスを `simctl privacy ... grant photos com.komorebi.garden` で設定した。対象はテスト写真のみ。これは試験環境の準備であり、許可ボタンの実操作合格とは数えない。
- 前回のios-onboarding.pngは実画像を再照合すると「花を記録」の入口だった。ios-photo-entry.pngに改名し参照・説明を訂正。初回案内の証拠は今回の新規端末画像。
- この確認時点ではSupabaseのEnable custom SMTP=off。メール送信・設定変更・公開なし。後続の無料方針とユーザー返答は下記に記録。
- 両専用iOS端末は停止、データを保持。プレビュー5186はPID44221/cwd=c771を再照合済み。

## 認証メールの準備方針更新

ユーザーは初期費用0円・住所を載せない方法を指定。ドメイン購入とBrevoの住所登録は行わない。Google連携後の英字氏名入力は本人が完了したが、Brevoの住所必須画面で手続きを中止。現在はGmail SMTP候補を準備し、利用するGmailとアプリパスワードの保存について回答待ち。キー未発行、SMTP保存前、実メールと自動引き継ぎは未完了。[具体的な設定案](email-delivery-setup.md)。

## iOS写真ピッカーの追加確認

専用Simulatorで実タップによる「撮る」→「写真を選ぶ」→ネイティブ写真一覧の表示を確認。取り込んだチューリップ写真が見える。写真を選ぶクリックはCUAの`noWindowsAvailable`で完了せず、選択以降は未確認。[証跡](verification-2026-09-10/ios-photo-picker.png)・[補助操作手順](ios-core-flow-manual-check.md)。

## 作業順の再設定とiOS保存操作の状態（2026-09-10）

ユーザー指示により、直近はiOSの「保存→庭に植える→再起動→同じ写真の再訪」だけを完了させる。これが通るまで認証サービスの調査・設定を並行して広げない。全体の自動引き継ぎ・両OSの要件は維持する。

現行SimulatorのPl@ntNet候補画面とチューリップ写真を再確認。ホームからの再表示、前回有効だったSimulatorメニュー開閉でも、保存ボタンのクリックはCUAの `noWindowsAvailable` により完了できなかった。識別結果は残っている。保存エラーやデータ消失の証拠はなく、保存成功の証拠もない。

次に必要な補助操作は、専用Simulatorの候補画面で「記録を残す」を1回押すこと。その後の画面を再取得して保存・直接配置の確認を再開する。同じ回復操作を繰り返したり、別の外部設定へ移ったりしない。

## iOS観察保存の確認（2026-09-10）

本人の補助操作後、Simulatorで「記録しました」と同じ赤いチューリップ写真・名前・日付を確認。保存は合格。「この花を庭に植える」の自動タップは引き続きCUAの `noWindowsAvailable` で完了しない。次は直接配置→再起動→同じ写真の再訪に限定する。再識別・再保存は行わない。

証跡: [写真確認](verification-2026-09-10/ios-photo-confirm.png)、[Pl@ntNet実候補](verification-2026-09-10/ios-real-identification.png)、[保存完了](verification-2026-09-10/ios-saved-observation.png)。

## iOSコアフロー確認完了（2026-09-10）

本人が「この花を庭に植える」→空き土→「ここに植える」を操作した後、赤いチューリップ1本を実画面で確認。Astraが専用端末32E37EB2-DB6B-4399-802F-F2DEB3698F39のアプリをterminate（exit 0）し、launchで新PID79297を確認（旧PID77237）。再起動後も赤い花が残り、CUAによる花の実タップで同じチューリップ写真・2026年9月10日・Pl@ntNet APIを確認した。

写真選択・実識別・保存・直接配置・プロセス再起動後の再訪という段階1は合格。保存と配置は本人補助、再起動と再訪はAstraが実施した。配置中の仮置きUI文言そのものは今回Astraが目視しておらず、配置結果と明示された写真リンクを最終画面で確認した。物理端末・カメラ撮影・自動引き継ぎ・ストア配布の合格には代用しない。

証跡: [配置結果](verification-2026-09-10/ios-planted-garden.png)、[再起動後の庭](verification-2026-09-10/ios-garden-after-restart.png)、[再起動後の同じ写真](verification-2026-09-10/ios-memory-after-restart.png)。次は段階2の実メールによる自動引き継ぎのみを進める。
# 2026-09-10 10:25 JST 追記：Gmailと基本引き継ぎ

本人了承済みの現在のGmail SMTPを設定し、住所を含まない日本語認証メールを受信。Supabaseの既定8桁OTPを既存UIに合わせて6桁へ設定し、新規・既存ログインが実メールで成功した。

実試験で見つかった自己競合、pull結果の適用、同期中の編集保持をCursor / Composer 2.5で修正。対象回帰38/38とビルド成功。独立したブラウザ領域127.0.0.1:5188とlocalhost:5188で、赤いチューリップ・写真・観察リンクを引き継ぎ、再読み込み後も同じ写真を開けた。検証用サンプル「引き継ぎ確認 9/10」を使用し、クラウドrevision 3、観察1件、花1本、リンク一致も確認。

これはブラウザの基本経路の合格。今回の修正を含むネイティブ再ビルド、実端末間の引き継ぎ、別アカウント切替と削除の実メール試験は残る。既存のネイティブコアフロー合格と区別する。SMTPキー・OTP値は文書に保存しない。詳細は [メール設定](email-delivery-setup.md) と [受け入れ条件](release-external-acceptance.md)。
