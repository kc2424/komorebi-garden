# Sandbox expansion: camera and mobile acceptance

Verified 2026-10-04 against the entire active c771 working tree served at http://127.0.0.1:5186/. Browser session `expansion-phone` was isolated from the desktop/native verification. No publication or commit performed.

## Implemented behavior

- Viewing initially shows the whole garden from a deterministic diagonal. Neither the first plant nor the last admired plant silently becomes the focus.
- The always-available 全景 control closes an open memory/introduction card, clears remembered focus, and resets a manually orbited view. Plant focus occurs on intentional selection. Orbit remains available during focus.
- Whole-garden fitting accounts for terrain elevation, plant/decor height and the measured building tray. Tile objects and placement previews use the elevation of their tile.
- Twenty plants and twelve decorations use static thumbnail images, category filters and search. Plant search accepts Hiragana input for Katakana names. No per-item WebGL contexts are created.
- Ground controls expose six surfaces and raising/lowering from level 0 to 3. Occupied plants and decorations route terrain-tool taps to their supporting tile.
- Plants without a linked observation show a compact introduction: name, static thumbnail, scientific name and short catalog description. At 390×844 the sample card measured 152px tall. Camera positioning uses its measured height. Existing photo-memory panels and explicit observationIds resolution remain on their existing path.

## Focused checks

The initial camera, catalog, UI and App suite passed 26/26. After the introduction-card change, the affected camera, memory panel, memory navigation and garden UI suite passed 26/26 (15 + 3 + 4 + 4). New regression coverage confirms unrelated observations do not become a sandbox plant photo, explicitly linked photos still render, and a tall plant on level-three terrain stays between the header and compact card at 320×568 and 390×844.

Final complete test/build/API checks are owned by the root integration pass; this record does not substitute for them.

## Actual browser flow

At 390×844, from fresh onboarding and without a photo/account:

1. Opened the catalog; filtered 木 to the two trees; chose サクラ.
2. Tapped a garden tile, rotated its placement preview and confirmed planting.
3. Selected 高くする and tapped the planted tree itself three times. Its supporting center tile reached height 3. The tree retained the same ID, rotation and tile link.
4. Used 取り消す to return to height 2, then やり直す to restore height 3.
5. Filtered decorations to 水辺, chose 小さな噴水, tapped an empty tile and confirmed placement.
6. Switched to viewing and reloaded. IndexedDB readback confirmed the same cherry ID/rotation at soil-0-0, height 3, plus the fountain at soil-1-1.
7. Tapped the actual tree in the canvas and read its introduction card. Whole-garden fitting and the tree's raised base remained visible.

At 320×568:

- The introduction name and description remained readable; its close button and the global 全景 button remained available.
- Dragged the focused garden, then pressed 全景. The introduction closed and the entire raised garden returned to the diagonal overview.
- Opened the plant catalog, searched しだ, selected the single シダ result, and confirmed the compact selected-plant controls and visible garden.
- `document.documentElement.scrollWidth === innerWidth === 320`; the page contained one canvas. The final browser `errors` report was empty.

No further runtime change was required by this mobile pass. Code handed back for final integration/native rebuild.

## Evidence

- [390px introduction](verification-2026-10-04/expanded-mobile-390-introduction.png)
- [320px introduction](verification-2026-10-04/expanded-mobile-320-introduction.png)
- [320px Home after manual orbit](verification-2026-10-04/expanded-mobile-320-home.png)

## Native-discovered fixes (final integration follow-up)

Native iPhone evidence showed an oversized flower during the overview-to-opposite-side-daisy transition; after five seconds it converged to the correct final pose. The cause was independent straight-line interpolation of camera position and target, collapsing their separation while crossing to the opposite side. `stepCameraPose` now interpolates the moving target plus relative radius, elevation and shortest azimuth. The final poses and manual controls are unchanged. The exact opposite-side scenario failed its radius bound before the fix and passes afterward. All intermediate frames are checked at 60, 15 and 5 fps for a radius no smaller than either endpoint and projected flower height below 350 CSS pixels. The focused camera/UI suite passes 22/22 (18 + 4).

Native iPad evidence also exposed a clipped introduction card: the 900px garden frame ended at viewport y1055, but the fixed card anchored to the full viewport bottom at y1210. The panel now uses absolute positioning in the garden overlay, for both introductions and existing photo memories. Actual browser verification at the matching 834×1210 viewport confirmed garden bounds y155..1055 and card bounds y903..1055, with its text and close button fully visible. The daisy was placed and selected using actual canvas clicks. Browser errors remained empty.

- [iPad-sized frame with complete card](verification-2026-10-04/expanded-ipad-card-fixed.png)

Final native binary rebuild and screenshots are handled by the root/native verification pass after these two runtime fixes.
