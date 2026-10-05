# Simulator用の独立XCTestハーネス

2026-10-04に実行したソースのコピー。アプリのXcode targetには追加せず、インストール済み `com.komorebi.garden` を `XCUIApplication` で操作する。Xcode 27.0 / iOS 26.5 Simulatorで確認済み。実機試験ではない。

一時フォルダが消えても、このディレクトリを任意の場所へコピーして再実行できる。対象Simulatorへ検証したいAppを先にインストールする。下記はこのコピーをリポジトリrootから使う例（UDID・結果名は検証端末に合わせる）。

```sh
xcodebuild test \
  -project docs/verification-2026-10-04/ios-harness/GardenHarness.xcodeproj \
  -scheme GardenSmoke \
  -destination 'platform=iOS Simulator,id=6ECF2016-C566-471B-B336-5EB37BB5B3F2' \
  -derivedDataPath /tmp/komorebi-ios-xctest-rerun/DerivedData \
  -resultBundlePath /tmp/komorebi-ios-xctest-rerun/Focus-NEW.xcresult \
  -only-testing:GardenUITests/GardenSmokeTests/testInspectFocusTransition \
  -parallel-testing-enabled NO \
  CODE_SIGNING_ALLOWED=NO IPHONEOS_DEPLOYMENT_TARGET=15.0 ONLY_ACTIVE_ARCH=YES
```

`testCreatePlantAndPersistOnRelaunch` は空の専用端末用。初回開始→デイジーを配置→保存→再起動を行うため、既存庭で繰り返すと植物が追加される。データの初期化は行わない。

`testInspectFinalSavedPlant` と `testInspectFocusTransition` は今回のsmokeで保存したデイジー1株を前提とし、新たな配置はしない。花のCanvas座標は今回のiPhone / iPadの保存庭と初期全景に合わせてある。異なる庭・画面サイズではタップ座標を調整する必要がある。紹介カードの学名・説明・閉じるボタンと、本文/ボタンの矩形が庭の表示範囲内にあることをassertする。

カメラ試験はtap後の途中画像を9枚記録する。実際の画像間隔はXCTest処理時間を含むため、画像名とログにtap開始からの経過秒を保存する。0.25秒間隔の厳密な目視比較には、別途 `simctl io <UDID> recordVideo` で同時録画した動画のフレームを使った。途中画像の目視は自動assertには含まれない。

今回の試験結果と証跡は [sandbox-expansion-ios-xctest.md](../../sandbox-expansion-ios-xctest.md) を参照。DerivedData、xcresult、App.app、動画原本はこのソースコピーに含めていない。
