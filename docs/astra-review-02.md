# Astra review 02 — final usability corrections

Browser QA confirmed sample JPEG registration, photo persistence after reload, memo persistence, and position persistence. All 10 photo assets load. Keep these working. The prototype still needs the following concrete corrections; implement them, then run focused checks/build. Do not expand product scope.

## 1. The garden layouts still overlap and truncate

See /tmp/komorebi-round1-10.png and /tmp/komorebi-round1-photo10.png (390x844). Photo mode is currently an overlapping pile of photos with plants off the left/right edges; the 7-in-one-row ORGANIC_SLOTS layout cannot work at this width. B labels are 11px and collide. This is an acceptance blocker.

Use a bounded layout with space allocated to each plant, no collisions or clipping. A concrete feasible direction is 4 columns x 3 rows (12 places sufficient for the current 10-species catalog), around x=15/38/62/85%, y=32/60/88%, and a scene around 420–460px tall at 390x844. Keep slight offsets/rotations only within each safe slot. Photo cards ~68–74px wide and at most ~95px high, full name allowed to wrap. B: plant size varies by SPECIES kind (tree/shrub/flower), not by arbitrary slot kind. Labels should be ~13–14px with a small opaque ivory nameplate for legible contrast; never tiny green text directly on a busy photograph. 3-sample preview should look balanced rather than all grouped on one edge. A can use a restrained paper/wood garden display background to make the photographic composition intentionally different from B.

You may reduce the placement grid to 4x3 for this prototype. If doing so, gracefully remap any existing valid saved rows 4/5 into unoccupied in-bounds places without deleting observations/collections; don't discard personal data. The placement selector must spatially match the displayed garden: selecting right/bottom must move the plant right/bottom. Currently grid (4,3) maps to an arbitrary upper/middle slot, which is confusing.

## 2. Readability and semantics

- The currently focused h1 draws an ugly full rectangular outline on initial load. Keep programmatic screen heading focus for assistive tech, but suppress the outline for noninteractive heading focus; preserve all keyboard button/input focus indicators.
- Top-right button labelled 写真 actually opens attribution. Rename it 素材 or クレジット with an accessible label that explains its purpose.
- Set a main landmark and use a valid named region for the garden (instead of aria-label on role-less div).
- Automated axe inspection found active preview button contrast 4.29 and preview note contrast 3.94. Darken text/adjust surface to at least 4.5:1. No 9px reunion badges or 11px essential labels. Use 12px minimum metadata and 14px normal controls where possible.
- The file inputs still appear as redundant unnamed file buttons in the accessibility snapshot; if custom trigger buttons are used, hide the actual file input with hidden/display:none and invoke it from the labelled button, keeping actual file selection working.
- For placement use ordinary labelled buttons in a group or implement a complete grid; current gridcell role on buttons without rows loses button semantics.

## 3. Reunion count semantics

Detail labels foundCount as 再会回数, so the first discovery says 1 reunion. Display 発見回数 = foundCount and/or 再会回数 = max(0, foundCount-1) consistently. Badge wording must also be correct.

## 4. Remaining error handling

- PlacementScreen calls onBack unconditionally after movePlacement; on storage failure stay on the picker and show error, only return on success.
- isValidGardenState validates arrays only, not entries; {collections:[null]} passes and crashes. Validate records' fields, known species IDs, number bounds and enum values before treating storage as usable. Keep unreadable storage intact and block overwriting until explicit recovery (no need to add a deletion/recovery feature in this prototype; allow read-only previews with the error message).
- Check loading/cancel behavior: async image decoding must not unexpectedly navigate back to identification after user cancels, and pending actions should not allow multiple simultaneous image requests.

## 5. Tests and final report

Tests should exercise hook/action behavior, not only save/load preconstructed data. Cover sample registration, repeated registration, memo/placement persistence, failed registration/placement, and malformed entries. Confirm build. Keep documentation honest. Astra will re-run browser flows and mobile screenshots, no need for you to claim that QA. No commit or deployment.
