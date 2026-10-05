# Garden visits iOS verification

Date: 2026-10-04 JST

Result: **passed on iPhone and iPad simulators**.

The final `App.app` was installed over the existing app on both dedicated simulators so their saved one-daisy gardens remained in place. The installed JavaScript asset matched the final build byte-for-byte on both devices.

The dedicated XCTest `GardenSmokeTests/testVisitAndReturnPreservesOwnGarden()` passed with zero failures on:

- iPhone 17 Pro simulator, iOS 26.5
- iPad Pro 11-inch (M5) simulator, iOS 26.5

Confirmed behavior:

- The existing own garden still contained exactly one daisy after the update.
- The outing gallery opened and the first authored sample garden loaded.
- The sample visit showed no planting confirmation or garden-building action.
- Camera orbit and `庭全体を見る` completed without losing the visitor UI.
- `自分の庭へ` returned to the original one-daisy garden.
- Terminating and relaunching the native app still showed exactly the same one daisy.
- Gallery and visitor controls were readable and inside the visible safe area on both screen sizes. No clipping was observed in the screenshots or accessibility frames.

The test did not create another plant, uninstall the app, erase either simulator, or reset application data. Evidence screenshots, accessibility trees, manifests, device identities, durations, and result-bundle paths are indexed in [the native evidence README](verification-2026-10-04/visits/native/README.md).
