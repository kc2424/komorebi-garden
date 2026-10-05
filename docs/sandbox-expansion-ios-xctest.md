# iOS SimulatorのXCTest操作確認

2026-10-04 JST。アプリソースを変更せず、`/tmp/komorebi-ios-xctest` に独立したUI-testing targetを作成した。XCTestから `XCUIApplication(bundleIdentifier: "com.komorebi.garden")` でインストール済みアプリを操作する。実機試験ではない。

## iPhone 17 Pro / iOS 26.5

- 専用端末: `Komorebi Sandbox Oct04`、UDID `6ECF2016-C566-471B-B336-5EB37BB5B3F2`。
- Xcode 27.0（27A266a）。テスト対象OSはiOS 26.5（23F77）、arm64。
- アプリ: `/tmp/komorebi-expansion-ios/Build/Products/Debug-iphonesimulator/App.app`。インストール済みbundleとこのAppの `public/index.html` / `Info.plist` のSHA-256が一致した。証跡: `/tmp/komorebi-ios-xctest/app-build-evidence.json`。
- 結果: `Smoke-02.xcresult`、**1 test / 0 failures / Passed**。テスト本体27.993秒、xcodebuild終了コード0。
- 結果JSON: `/tmp/komorebi-ios-xctest/test-summary.json`。実行ログ: `/tmp/komorebi-ios-xctest/run-02.log`。

確認した操作:

1. 初回案内の「庭づくりをはじめる」から編集へ進む。
2. 20種類の植物カタログを読み取り、デイジーを選ぶ。
3. 庭のCanvasを画面比率 `(0.50, 0.30)` でタップし、配置プレビューを表示する。
4. 「ここに植える」を押し、「保存済み」を待つ。
5. 「眺める」→「庭全体を見る」で全景へ戻る。
6. `terminate()` → `launch()` 後に「デイジーの思い出を見る」が残り、初回案内が再表示されないことをassertする。

初回run-01では手順1と20種類の取得に成功した後、選択要素をButtonで探して失敗した。`aria-pressed` のWebボタンはこのiOS AXではSwitchとして公開される。ハーネスを `app.switches["デイジー"]` に合わせたrun-02で手順2〜6が連続して成功した。これはハーネスのセレクタ修正であり、アプリは変更していない。

## iPad Pro 11-inch (M5) / iOS 26.5

- 検証用に新規作成した専用端末: `Komorebi Sandbox iPad Oct04`、UDID `6FDD3057-F02F-43D1-B1E9-5E188D6AB51C`。
- iOS 26.5（23F77）、arm64、12GBモデルのSimulator。同じAppをインストールし、iPhoneで修正した同一Swiftハーネスを使用した。
- 結果: `Smoke-iPad-01.xcresult`、**1 test / 0 failures / Passed**。テスト本体35.022秒、xcodebuild終了コード0。
- 新規端末の初回案内から上記手順1〜6まで、1回の試験で連続して成功した。Canvasの最初の座標 `(0.50, 0.30)` では配置が選ばれず、ハーネス内の次の候補 `(0.45, 0.36)` で有効な仮置きになった。
- アプリ再起動後のデイジーと全景を画面でも確認した。描画はアプリCSSの高さ900px・角丸の庭フレーム内に表示されており、ブラウザの820px確認とは別のネイティブWKWebView操作結果である。
- 結果JSON: `/tmp/komorebi-ios-xctest/test-summary-ipad.json`。ログ: `/tmp/komorebi-ios-xctest/run-ipad-01.log`。全7段階の画面とAX: `/tmp/komorebi-ios-xctest/evidence-ipad/`。
- インストール済みbundleと元Appの `public/index.html` / `Info.plist` のSHA-256一致を `/tmp/komorebi-ios-xctest/app-build-evidence-ipad.json` に保存した。

この初期smokeは作成時に渡されたAppを対象とする。後続のアプリ変更は次節で別途確認する。


## 更新Appの保存継続・紹介カード確認（カメラ修正前）

紹介カード・影更新頻度・新しい初回作例を含む更新Appを両Simulatorに再インストールし、保存済みデイジー1株を保持した。削除・データ初期化・新たな植物配置は行っていない。`testInspectFinalSavedPlant` のみ実行し、学名 `Bellis perennis`、紹介文、閉じる操作と全景復帰を確認した。

- インストール済み `App` 実行ファイル、`Info.plist`、`public/` 全ファイルの計58ファイルで元AppとのSHA-256一致を確認。両端末とも不一致0件。証跡: `/tmp/komorebi-ios-xctest/final-app-asset-evidence.json`。
- iPhone: `Final-iPhone-Stable.xcresult`、1 test / 0 failures、17.764秒。紹介カード表示後5秒と全景操作後3秒を待つ。画面・AX: `/tmp/komorebi-ios-xctest/evidence-final-iphone-stable/`。カード全文と通常サイズのデイジーを目視確認した。
- iPad: `Final-iPad-Stable.xcresult`、1 test / 0 failures、18.061秒。画面・AX: `/tmp/komorebi-ios-xctest/evidence-final-ipad-stable/`。保存継続、紹介カードのAX要素、操作は成功したが、目視ではカード本文が庭フレーム下で切れていた。庭のAX矩形はy155〜1055、カードはy1038〜1210であり、AX存在だけでは見えることを保証できない。UI担当へ具体的な画面と矩形を報告した。
- iPhoneのフォーカス開始直後には、最終位置が正常でも一時的に花へ近づき過ぎるカメラ遷移を記録した。カメラ担当が球面方向・距離の補間へ修正中。

両問題の修正後の結果を次節へ記録する。Simulatorでの操作結果であり、実機性能やFPSの計測ではない。

## 最終修正版の限定再確認

2026-10-04 21:58 JST。カードの庭枠内配置と球面方向・距離によるカメラ補間を含むAppを両端末へ再インストールした。保存済みのデイジーは両方とも1株のまま、初回案内も再表示されなかった。配置試験の再実行やデータ初期化はしていない。

| 対象 | 限定試験 | 結果 | テスト本体時間 |
| --- | --- | --- | --- |
| iPhone 17 Pro | `testInspectFocusTransition` | 1 test / 0 failures | 19.097秒 |
| iPad Pro 11-inch (M5) | `testInspectFinalSavedPlant` | 1 test / 0 failures | 17.197秒 |

両方のxcodebuildは終了コード0、`TEST EXECUTE SUCCEEDED`。各Simulatorの実行ファイル・Info.plist・public assets計58ファイルすべてが最終AppのSHA-256と一致した。最終ハッシュ証跡は `/tmp/komorebi-ios-xctest/camera-final-app-asset-evidence.json`。

- iPhone: XCTestがtap開始から0.442、0.818、1.196、1.565、1.947、2.318、2.696、3.077、3.450秒の画像を保存した。全9枚と安定後画像を目視し、旧遷移の花へ突入する巨大表示がなく、通常のフォーカスへ移ることを確認。`/tmp/komorebi-ios-xctest/evidence-camera-fixed-iphone/`、一覧 `/tmp/komorebi-ios-xctest/iphone-xctest-contact-sheet.png`。
- iPhoneはsimctlで同時録画し、動画17.00〜21.00秒のフォーカス開始前から安定へ近づく範囲を0.25秒間隔・17枚で抽出して目視した。開始直後〜約2秒も花や地面へ突入しない。原本 `/tmp/komorebi-ios-xctest/final-iphone-focus-transition.mp4`、フレーム `/tmp/komorebi-ios-xctest/video-focus-quarter-second/`、一覧 `/tmp/komorebi-ios-xctest/iphone-focus-quarter-second-contact-sheet.png`。これは画像による回帰確認であり、FPS計測ではない。
- iPad: 紹介文と閉じるボタンが庭のAX矩形内にあるassertを追加しpass。カードはy883〜1055へ収まり、旧y1038〜1210から上へ移動した。庭の範囲y155〜1055内で学名・説明・閉じるボタンを目視でき、clippingの解消を確認。`/tmp/komorebi-ios-xctest/evidence-camera-fixed-ipad/final-02-plant-introduction.png`。同フォルダに更新起動と全景復帰の画像・AXもある。

最終結果bundleは `/tmp/komorebi-ios-xctest/CameraFixed-iPhone.xcresult` と `CameraFixed-iPad.xcresult`。同じ一時ディレクトリの `run-camera-fixed-{iphone,ipad}.log` と `test-summary-camera-fixed-{iphone,ipad}.json` に結果を保持する。

再現用のSwift・xcodeproj・共有schemeは [検証用ハーネス](verification-2026-10-04/ios-harness/README.md) にソースのみ保存した。`/tmp`が消えてもこのコピーから再実行できる。実機検証は含まない。

## 証跡と再実行

一時プロジェクト: `/tmp/komorebi-ios-xctest/GardenHarness.xcodeproj`。
Swift試験: `/tmp/komorebi-ios-xctest/GardenUITests/GardenSmokeTests.swift`。

```sh
xcodebuild test \
  -project /tmp/komorebi-ios-xctest/GardenHarness.xcodeproj \
  -scheme GardenSmoke \
  -destination 'platform=iOS Simulator,id=6ECF2016-C566-471B-B336-5EB37BB5B3F2' \
  -derivedDataPath /tmp/komorebi-ios-xctest/DerivedData \
  -resultBundlePath /tmp/komorebi-ios-xctest/Smoke-NEW.xcresult \
  -only-testing:GardenUITests/GardenSmokeTests/testCreatePlantAndPersistOnRelaunch \
  -parallel-testing-enabled NO \
  CODE_SIGNING_ALLOWED=NO IPHONEOS_DEPLOYMENT_TARGET=15.0 ONLY_ACTIVE_ARCH=YES
```

結果bundleの出力先は未作成の名前を指定する。このコマンドは空の庭からの配置を対象にするため、保存済みの庭で繰り返すと植物が追加される。更新Appの確認には同じ `-only-testing` を `GardenUITests/GardenSmokeTests/testInspectFinalSavedPlant` または `GardenUITests/GardenSmokeTests/testInspectFocusTransition` に替え、配置試験を再実行しない。いずれも既存データの初期化は行わない。

7枚のスクリーンショットと各段階のAXツリーをxcresultから書き出した。保存場所: `/tmp/komorebi-ios-xctest/evidence/`。

- `00-onboarding-before-run.png`: 初回案内。
- `02-building-catalog.png`: 20種類のカタログ。
- `03-daisy-selected.png`: 選択後。
- `04-placement-preview.png`: Canvasタップ後の仮置き。
- `05-plant-saved.png`: 「保存済み」。
- `06-overview.png`: 全景へ戻る。
- `07-relaunch-persisted.png`: ネイティブアプリ再起動後の同じ花。

対応する `*-accessibility.txt`、元attachmentsのmanifest、xcresult、xcodebuildログを同じ一時フォルダに保持する。画面証拠はSimulatorの描画であり、物理iPhoneでのGPU負荷・タッチ体感・電池消費の確認は含まない。
