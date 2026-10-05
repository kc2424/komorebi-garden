# Native visit verification evidence

Verified 2026-10-04 JST with the final simulator build at `/tmp/komorebi-visits-ios/Build/Products/Debug-iphonesimulator/App.app`.

The build was installed in place on both existing simulators. No app uninstall, device erase, content reset, or plant-creation test was run. The installed `public/assets/index-BClmwDb5.js` matched the final build on both devices with SHA-256 `f2770e4b504a6fd14893dd9995a0b6f2e9bf4bf6bbdfa4895e61f2cf88aba9c9`.

## XCTest result

`GardenSmokeTests/testVisitAndReturnPreservesOwnGarden()` passed once on each device with zero failures:

- iPhone 17 Pro, iOS Simulator 26.5, device `6ECF2016-C566-471B-B336-5EB37BB5B3F2`: 23.260 seconds. Result bundle: `/tmp/komorebi-visits-xctest/results/iphone-20261004-2305.xcresult`.
- iPad Pro 11-inch (M5), iOS Simulator 26.5, device `6FDD3057-F02F-43D1-B1E9-5E188D6AB51C`: 23.661 seconds. Result bundle: `/tmp/komorebi-visits-xctest/results/ipad-20261004-2306.xcresult`.

The test opened the existing one-daisy garden, visited the first sample, confirmed that planting and building controls were absent, exercised camera orbit and overview reset, returned to the own garden, and confirmed exactly one daisy both before and after native relaunch.

## Exported evidence index

Each device directory contains the original `xcresulttool export attachments` manifest, four screenshots, and four matching accessibility trees.

| Stage | iPhone screenshot | iPhone accessibility | iPad screenshot | iPad accessibility |
| --- | --- | --- | --- | --- |
| Gallery | `iphone/6E022AFB-AB6C-441E-971F-96B1F5F117DE.png` | `iphone/CE89D57B-75F2-483D-8429-D018DB86DE08.txt` | `ipad/50CEF654-B3A5-4141-AC86-00606421C8A5.png` | `ipad/6A755B1D-EC1E-40D0-B081-EF6E74027DF1.txt` |
| Sample overview | `iphone/24642122-CB1A-412A-8D68-A4525A9721AD.png` | `iphone/55AA1D8E-79BC-41BC-8541-814D81BACB03.txt` | `ipad/8E5A1464-C754-4230-BE5A-8B79AC4CE386.png` | `ipad/80577EF1-1B30-475F-8D97-08C9A562FDA4.txt` |
| Own garden restored | `iphone/51888278-0319-44FC-B6B5-B417B6689D78.png` | `iphone/03F6AFCD-F9A2-47D8-98C5-990895AD20DE.txt` | `ipad/84441405-3E9F-40C5-BF9E-796187E58F52.png` | `ipad/D6F89A38-7E27-4710-B0DE-612B487520EC.txt` |
| Own garden relaunched | `iphone/6AEDE0BC-C65A-4AF1-8E9D-5AF6476AC59E.png` | `iphone/B0FC146B-1B3A-47D0-AE9B-074DAC63417A.txt` | `ipad/DCC0A5AB-D6FC-49B2-8073-A85964988B67.png` | `ipad/C3E7BCAD-3BDC-4FC7-A89F-226F4CDF45D3.txt` |

Visual inspection found no clipped visitor controls. On iPhone, the 44-point header controls and the footer action stay within the 402×874 frame. On iPad, the visitor header, 3D garden, and footer action stay within the 834×1210 frame. The gallery uses expected vertical scrolling on iPhone and shows all three cards in one row on iPad.

## Repeat the visit test

The reusable source is saved in `harness/GardenHarness.xcodeproj` and `harness/GardenUITests/GardenSmokeTests.swift`. Install the desired App into a dedicated device that already contains the single saved daisy, then run only `GardenUITests/GardenSmokeTests/testVisitAndReturnPreservesOwnGarden`. This preserves the existing garden. Do not run the plant-creation method on a populated device.
