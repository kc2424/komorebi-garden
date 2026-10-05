# Android preparation — 2026-09-10

> Chronological environment and test record. The authoritative APK is in the final section. Root subsequently confirmed Xcode26.6 installed at `/Applications/Xcode.app`, but Apple license acceptance and first-launch setup are pending (user asked). Earlier statements that Xcode is absent describe the start of this work. Current acceptance is in [review-resolution-status.md](review-resolution-status.md).

Target: `/Users/0124o/.codex/worktrees/c771/デジタル植物園`

Only isolated user-local dependencies were installed. No global Java, shell profile, app/native project source files changed. No full IDE installed. Dedicated emulator was subsequently installed and booted, as recorded below. User approved Android SDK agreement and tools installation through root agent before SDK download/use/acceptance.

## Verified downloads

- Amazon Corretto 21 arm64 macOS archive, official effective URL: https://corretto.aws/downloads/resources/21.0.12.9.1/amazon-corretto-21.0.12.9.1-macosx-aarch64.tar.gz
- Official/current checksum endpoint: https://corretto.aws/downloads/latest_sha256/amazon-corretto-21-aarch64-macos-jdk.tar.gz
- SHA256 downloaded and expected both: `2c03e806a8fb634b9fa21013f9de43ed4ec7fc6e6487144d2af5e2d4c126dfdd`
- Google Android command-line tools for Mac ARM: https://dl.google.com/android/repository/commandlinetools-mac_arm64-15859902_latest.zip
- Official download page: https://developer.android.com/studio#command-tools
- SHA256 downloaded and expected both: `835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e`
- Tools report sdkmanager 22.0; this release reports sdkmanager deprecated in favor of bundled Android CLI, but commands succeeded.

## Installed and validated

- JAVA_HOME: `/Users/0124o/.cache/komorebi-native/jdk/amazon-corretto-21.jdk/Contents/Home`
- Java / javac: `21.0.12.1`, Corretto `21.0.12.9.1`, binary verified Mach-O arm64.
- ANDROID_HOME: `/Users/0124o/.cache/komorebi-native/android-sdk`
- `platform-tools` 37.0.1; adb 1.0.41 / 37.0.1-15733141 reports Darwin arm64.
- `platforms;android-35` revision 2.
- `build-tools;34.0.0` 34.0.0.
- Accepted only required `android-sdk-license` at sdkmanager install prompt. SDK copies acceptance under isolated SDK `licenses/android-sdk-license`.
- Reviewable exact repository license text: `/Users/0124o/.cache/komorebi-native/evidence/android-sdk-license.txt`.
- Official manifest retained at `/Users/0124o/.cache/komorebi-native/evidence/android-repository2-1.xml`.

## Build status

Debug APK build PASSED: `BUILD SUCCESSFUL in 1m 12s`, 135 tasks executed. Built against pre-existing generated assets, without invoking npm build or cap sync concurrently with Cursor. APK: `/Users/0124o/.codex/worktrees/c771/デジタル植物園/android/app/build/outputs/apk/debug/app-debug.apk`. Root must run final web build + cap sync + APK rebuild after app changes conclude. This build cannot certify new web changes. No app fixes were needed. Non-failing upstream warnings: flatDir metadata, SDK XML schema version, deprecated Filesystem plugin method/Kotlin nullability, Gradle deprecated features.

## iOS remains blocked

Full Xcode and iOS platform/simulator tools are not installed. Existing CommandLineTools alone cannot build iOS. CocoaPods was subsequently installed through Homebrew. No Xcode license acceptance attempted.

## Android emulator ready

- Installed stable emulator 37.1.11.0 build15917651 for macOS arm64 and `system-images;android-35;default;arm64-v8a` revision2.
- Both reference `android-sdk-license`, exactly same license text as existing approved SDK packages; no preview or Google Play image license accepted.
- Public official manifest v3 confirms arm64 emulator archive `emulator-darwin_aarch64-15917651.zip`; installed executable verified Mach-O arm64.
- Dedicated AVD: `/Users/0124o/.cache/komorebi-native/avd/komorebi-test.avd`; Pixel5 profile, no Play Store, no accounts.
- Host acceleration verified: Hypervisor.Framework on macOS26.3.
- Running headless, software SwiftShader GLES3 rendering, 2CPU cores, requested2048MB RAM raised to minimum2560MB by emulator.
- Process spawned via exec session21344; initial PID59133. ADB serial `emulator-5554`.
- Confirmed `sys.boot_completed=1`, Android15/API35, `arm64-v8a`.
- System WebView valid/installed/enabled: `com.android.webview` version124.0.6367.219.
- No app installed and no UI actions performed by this agent.

Start command (after stopping current process only):

```sh
ANDROID_HOME=/Users/0124o/.cache/komorebi-native/android-sdk \
ANDROID_AVD_HOME=/Users/0124o/.cache/komorebi-native/avd \
ANDROID_USER_HOME=/Users/0124o/.cache/komorebi-native/android-user \
/Users/0124o/.cache/komorebi-native/android-sdk/emulator/emulator \
  -avd komorebi-test -no-window -no-audio -no-snapshot -no-boot-anim \
  -memory 2048 -cores 2 -gpu swiftshader -port 5554
```

ADB path: `/Users/0124o/.cache/komorebi-native/android-sdk/platform-tools/adb`.
Stop after verification: `adb -s emulator-5554 emu kill` using above binary.

## CocoaPods preparation

Installed Homebrew official formula `cocoapods`1.17.0 (MIT), dependencies `ruby`4.0.6_1 and `libyaml`0.2.5 from verified Homebrew bottles. Homebrew Ruby is keg-only; no shell profile edits or replacement of `/usr/bin/ruby`. No cap sync/pod install/project edits performed while Cursor works.

Command: `HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1 /opt/homebrew/bin/brew install cocoapods`.

CocoaPods executable: `/opt/homebrew/bin/pod`.

## Native app acceptance — Android emulator (CSS final build, before last auth sign-out change)

Executed actual Android app flow on dedicated AOSP emulator, using UI interactions and WebView CDP on test device only. Application source was not edited by this agent.

Passed:

1. Built native debug APK from supplied synced app assets; first complete native app build11s, final CSS-only rebuild17s.
2. APK installed and launched on emulator-5554; actual onboarding screenshot visually verified.
3. Pushed repository `public/samples/tulip.jpg` into test Gallery. Used **Android native photo picker**, not app sample button. Photo confirmation appeared before any identification action.
4. Started real identification. Pl@ntNet results returned: Tulipa agenensis0.27, Tulipa gesneriana0.19, Tulipa praestans0.06, Tulipa undulatifolia0.03, Tulipa fosteriana0.02. Selected gesneriana and red, saved observation. Native logs observed `https://komorebi-garden.vercel.app/api/identify` through CapacitorHttp. Saved observation source verified `plantnet`.
5. Saved screen primary CTA entered planting with the saved photograph already linked. Native touch selected center soil, native touch confirmed planting. Garden memory sheet displayed exact photograph and Pl@ntNet API attribution.
6. Force-stopped and relaunched app. Garden flower remained; native flower tap reopened same photo/date/source. Stored observation link verified.
7. Updated APK to CSS final bundle `index-TEU_w0AY.js`, `index-Dxsk-hA_.css`, preserved installed app data. To isolate repaired empty-garden CTA, after completing real persistence flow modified **test emulator guest IndexedDB only** to remove placed/stashed flowers while retaining real observation+photo. Empty CTA computed pointer-events:auto; native touch at actual button center opened linked planting flow. This test-fixture step does not count as UI flow/persistence verification; those were completed beforehand.
8. Android Back draft preservation: selected photo through Android picker again, stopped before identification; force-stopped/relaunched app. Draft prompt appeared; actual Android KEYCODE_BACK dismissed it. Actual native touch on 撮る reopened prompt. 再開する returned to photo confirmation. Draft not erased; no automatic identification triggered.
9. Checked application runtime logs for FATAL EXCEPTION scoped to com.komorebi.garden and app ANR: both absent. This does not imply physical-device or production stability certification.

CSS-build APK (root will replace after final auth sign-out fix):

- `/Users/0124o/.codex/worktrees/c771/デジタル植物園/android/app/build/outputs/apk/debug/app-debug.apk`
- Size: 28,954,411bytes
- SHA256: `6c916a8d3e525fafe9a2d8244779ae5cecbebc3298a151c5282a73eb0609baaa`
- apksigner verify passed (v1 and v2); debug APK only, not store-signed release build.

Screenshots in `/tmp/komorebi-android-verification/`:

- `01-onboarding.png` actual first launch.
- `02-gallery.png` actual native photo picker.
- `03-real-identification.png` candidate selection.
- `04-direct-plant.png` saved observation/photo in planting context.
- `05-place-confirm.png` placement confirmation.
- `06-planted.png` successful planting with linked photo memory.
- `07-restart-garden.png` garden persists after force-stop/relaunch.
- `08-restart-photo-revisit.png` same photo revisited after relaunch.
- `09-fixed-empty-cta.png`, `10-fixed-cta-tapped.png` repaired empty CTA native touch verification.
- `11-draft-restart.png`, `12-draft-retained-after-back.png` draft retention after OS back.

Observed UI limitation (recorded; no additional broad audit): Android three-button system navigation overlays bottom edges of app UI. The placement confirm row (`ここに植える` / `やり直す`) intersects OS nav at its bottom edge in05; the main 撮る/庭づくり/記録 container extends behind OS nav in07/09; draft `下書きを破棄` button bottom intersects it in11/12. Verified core buttons remained actionable when touched above nav, but proper native safe-area/insets should be resolved before release. Top status-bar text is white against light onboarding background.

Not verified: physical Android device camera/permissions, actual Android-to-other-device account transfer/SMTP, iOS binary or simulator. iOS still awaits full Xcode. Root handles final auth change and final APK regeneration; no repeated full native flow necessary for auth-only change.

## Final auth-fixed APK — authoritative Android build

- Root-synced final JS asset: `index-CrldvgRR.js` (confirmed in Android packaged index).
- Final assembleDebug: **BUILD SUCCESSFUL in9s**, 135tasks,20executed115up-to-date.
- APK path: `/Users/0124o/.codex/worktrees/c771/デジタル植物園/android/app/build/outputs/apk/debug/app-debug.apk`.
- Final size: **29,428,498bytes**.
- Final SHA256: **09c14aec3ec6636d7c7b1e8e9e5952b11ab9d6a230ef43e2888025e65b61cad6**. This supersedes prior CSS-build hash.
- Final apksigner verification passed.
- adb install-r succeeded; app launched. Existing observation and unfinished draft survived update.
- Opened settings → login in actual app: preparation message displayed; code send button disabled. No email submitted. Screenshot: `/tmp/komorebi-android-verification/13-final-auth-preparing.png`.
- Final launch/log-in-screen smoke: no app FATAL EXCEPTION or ANR (see auth-final-crash-check.json).
- Prior real identification/plant/revisit/restart and Android Back draft scenarios were not needlessly repeated after auth-only change.
- Artifact remains debug APK, verified on Android emulator only; no physical Android device or iOS certification.
- Emulator and this agent's tcp9227 CDP forwarding will be shut down after final check, preserving dedicated AVD disk/test data for future use.

Cleanup confirmed: emulator no longer listed by adb, tcp9227 forwarding absent, initial emulator process exited. Dedicated SDK/JDK/AVD remain for reuse.

## Final 192-test APK — supersedes earlier build hashes

- Latest shared JS: `index-B2IOYjQR.js`; CSS: `index-Dxsk-hA_.css`.
- `assembleDebug`: successful in6s; signature verification passed; expected assets present in APK ZIP.
- Size: 28,953,173bytes.
- SHA256: `776fcfcb12fe5743ab1f5a38a61253531c8a2d6f0fbbab812bec0cc46c99ef25`.
- This final APK received build/signature checks. The real native core-flow evidence above was gathered on prior CSS/auth builds. Latest shared-JS interruption recovery and successful initial identification were verified in the current browser using controlled responses, with zero real API calls for those tests.
- Controlled browser findings: pending identification1 call → reload/resume0 automatic calls → explicit retry1 call; fresh photo autoStart1 call → mocked successful candidate response rendered and loading ended. Browser errors empty, owned sessions closed. These are transport/recovery tests and are not real plant identification evidence.
- Existing real native Pl@ntNet, plant/save/revisit, restart retention, and Android Back evidence remains separately recorded above. Emulator was not restarted for the shared-JS-only final build.

## iOS consent, configuration, build and launch — 2026-09-10

This section supersedes earlier iOS environment/license/build blockers in this chronological record.

- User explicitly authorized Xcode/Apple SDK agreement. `sudo -n xcodebuild -license accept` initially failed because administrator authentication was required; no password was collected in chat. Xcode initially showed its agreement, then moved to What’s New. `xcodebuild -checkFirstLaunchStatus` returned **0**, verified again after the build.
- Xcode26.6(17F113), selected Developer directory `/Applications/Xcode.app/Contents/Developer`. CocoaPods1.17.0; Podfile.lock equals Pods/Manifest.lock.
- `xcodebuild -downloadPlatform iOS -architectureVariant arm64` transferred iOS26.5(23F77), 8.52GB. Registration reported a duplicate runtime entry. `simctl runtime list -v` showed the existing runtime Ready and signature Verified, same official asset path; `simctl runtime scan-and-mount` exposed the usable runtime. No runtime asset was deleted.
- Cursor CLI / Composer2.5 changed only `ios/App/App/Info.plist`, `ios/App/App/PrivacyInfo.xcprivacy`, and `ios/App/App.xcodeproj/project.pbxproj`: Japanese camera/photo read/photo add purpose strings; UserDefaults CA92.1 and FileTimestamp C617.1; manifest included in Resources. Parent/subagent did review and verification only.
- plutil syntax checks passed. App.app includes all three purpose strings, Privacy Manifest, and latest shared `index-B2IOYjQR.js` / `index-Dxsk-hA_.css`. No Web rebuild or broad test repetition for native configuration only.
- Build command: `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/komorebi-ios-derived CODE_SIGNING_ALLOWED=NO build`.
- **BUILD SUCCEEDED**, exit0. Artifact `/tmp/komorebi-ios-derived/Build/Products/Debug-iphonesimulator/App.app`, about29MB, arm64/x86_64. Log `/tmp/komorebi-ios-verification/simulator-build.log`. Warnings concern existing Pods script outputs; no compile failure.
- Dedicated device `Komorebi iOS Test`, iPhone17 Pro, iOS26.5, UDID `32E37EB2-DB6B-4399-802F-F2DEB3698F39`. Boot completed; `simctl install` and `simctl launch com.komorebi.garden` succeeded. Repository `public/samples/tulip.jpg` imported into this test Photos library through `simctl addmedia`. Import is preparation, not evidence of app photo selection.
- Observed initial onboarding and later empty 3D garden. Relaunch after simulator restart again displayed garden. CUA taps returned `noWindowsAvailable`, stale element errors and ScreenCaptureKit -3811. Fresh state/handle/kernel and one Simulator restart did not resolve reliable UI input. Therefore **no iOS photo picker, real identification, planting, photo revisit or record persistence acceptance is claimed**.
- Captured `/tmp/komorebi-ios-verification/01-onboarding.png` and `02-garden-after-relaunch.png`; copied to docs/verification-2026-09-10 as ios-onboarding.png and ios-garden-after-relaunch.png. Onboarding heading overlaps Dynamic Island; recorded for iOS safe-area follow-up. Garden top controls are visually below the status area.
- No Apple account sign-in, physical device, release signature, Developer Program registration, store upload, commit or deployment. Existing SMTP/account-transfer blocker remains.

- Follow-up log scope: last3minutes of process App at fault level yielded one UIKit App Config entry with an unavailable composed message (`<compose failure [shared UUID]>`). It was not diagnosed as an application crash; no blanket fault-free/runtime-stability claim is made.
- Dedicated Komorebi iOS Test simulator shut down after evidence capture, preserving its app/test data. Other simulator devices were left untouched during final cleanup.

## iOS safe-area follow-up — 2026-09-10 09:01 JST

- Previous goal turn: progress (Xcode consent/setup, native configuration, iOS build/launch). This continuation: bounded CSS fix and fresh-device display evidence.
- Correction: original /tmp/komorebi-ios-verification/01-onboarding.png contains photo entry, not onboarding. Repository copy renamed ios-photo-entry.png and references corrected. Do not use that file as onboarding evidence.
- Cursor / Composer2.5 changed only the OnboardingScreen top padding to `calc(1.5rem + env(safe-area-inset-top, 0px))`. Web safe-area0: h1/all button positions and dimensions unchanged; browser errors empty.
- Web build, iOS copy, unsigned Simulator build passed. Latest assets index-C2zu_IsU.js / index-DcdDsiR2.css. App.app output path unchanged.
- New empty-data device Komorebi Onboarding Check, UDID32346FB3-9733-4523-8E92-E98695FCC3CD, iPhone17 Pro/iOS26.5: official CLI bootstatus/install/launch only, no UI taps. Image /tmp/komorebi-ios-verification/onboarding-safe-area-fresh-32346FB3.png (1206x2622), inspected by both agents: full title below Dynamic Island, experience images and all3CTAs visible. Repository copy ios-onboarding-safe-area.png.
- Original test device32E37EB2-DB6B-4399-802F-F2DEB3698F39 reached native photo permission after CUA taps on 撮る and 写真を選ぶ. Purpose description visible. Image03-photo-permission-state.png copied as ios-photo-permission.png. Subsequent CUA calls repeatedly failed with noWindowsAvailable/stale-state errors; no further UI success inferred.
- Used `simctl privacy <dedicated-device> grant photos com.komorebi.garden` for test setup (imported public fixture and stock simulator photos). This terminated the app, then latest App.app installed/relaunched successfully. Not evidence of permission dialog interaction. iOS photo picking, real API identification, planting/revisit remain unverified.
- Latest Android assembleDebug succeeded in51s, exit0. apksigner verify exit0 (META-INF/v1 warnings in output). Packaged current JS/CSS confirmed. APK29427614bytes, SHA2569167627eee6e9f21b461c3de0b394210211ed9f51ad50a0f11652cc79ff929c0, superseding prior hashes. No repeated Android E2E for CSS-only change.
- Current Supabase SMTP switch off; no external changes/mail sent. Provider/domain answer pending.
- Both owned iOS devices shut down, data preserved. Preview PID44221 cwd stillc771/port5186. No commit/deployment.

## 2026-09-10 継続確認: 写真ピッカーの表示

専用端末 `32E37EB2-DB6B-4399-802F-F2DEB3698F39` を起動し、インストール済みの最新Appをlaunch。SimulatorをFit Screenへ調整した後、CUAの実タップで「撮る」→「写真を選ぶ」→iOS写真ピッカーまで進めた。インポート済みの赤いチューリップを一覧に確認。[写真ピッカー証跡](verification-2026-09-10/ios-photo-picker.png)。

チューリップを選ぶクリックは `noWindowsAvailable`。同じ操作対象の再取得・Raise・新しいgetAppでも再現した。Tabによる移動でも選択位置は確認できず、写真選択の完了とは判定しない。アプリのクラッシュや認識失敗を示す証拠ではなく、CUAで操作を完了できない状態。写真選択後の実識別・保存・配置・同じ写真再訪は未確認。

[補助操作の手順](ios-core-flow-manual-check.md)を用意。本人が写真を1回選べれば、以降のアプリ画面からCUA検証の再開を試す。

## iOS観察保存の確認（2026-09-10）

本人の補助操作後、Simulatorで「記録しました」と同じ赤いチューリップ写真・名前・日付を確認。保存は合格。「この花を庭に植える」の自動タップは引き続きCUAの `noWindowsAvailable` で完了しない。次は直接配置→再起動→同じ写真の再訪に限定する。再識別・再保存は行わない。

証跡: [写真確認](verification-2026-09-10/ios-photo-confirm.png)、[Pl@ntNet実候補](verification-2026-09-10/ios-real-identification.png)、[保存完了](verification-2026-09-10/ios-saved-observation.png)。

## iOSコアフロー確認完了（2026-09-10）

本人が「この花を庭に植える」→空き土→「ここに植える」を操作した後、赤いチューリップ1本を実画面で確認。Astraが専用端末32E37EB2-DB6B-4399-802F-F2DEB3698F39のアプリをterminate（exit 0）し、launchで新PID79297を確認（旧PID77237）。再起動後も赤い花が残り、CUAによる花の実タップで同じチューリップ写真・2026年9月10日・Pl@ntNet APIを確認した。

写真選択・実識別・保存・直接配置・プロセス再起動後の再訪という段階1は合格。保存と配置は本人補助、再起動と再訪はAstraが実施した。配置中の仮置きUI文言そのものは今回Astraが目視しておらず、配置結果と明示された写真リンクを最終画面で確認した。物理端末・カメラ撮影・自動引き継ぎ・ストア配布の合格には代用しない。

証跡: [配置結果](verification-2026-09-10/ios-planted-garden.png)、[再起動後の庭](verification-2026-09-10/ios-garden-after-restart.png)、[再起動後の同じ写真](verification-2026-09-10/ios-memory-after-restart.png)。次は段階2の実メールによる自動引き継ぎのみを進める。
