# Astra review 03 — small final fixes only

Mobile overlap is resolved. Keep the current visual layout and scope. Fix just these residual concrete issues, then tests/build:

1. `normalizePlacements` loops `while(occupied.has(...))` and `findNextGridPosition` returns an already occupied last cell when full. 13+ entries (e.g. repeated known-species placements, currently accepted by shape validator) cause an infinite loop on load. Reject duplicate collection/placement species and malformed cross-record relationships before normalization, and make normalization itself bounded with a defined full-grid outcome (throw an explicit validation error or return a typed error caught by loadState). Never loop until a free cell exists without a capacity bound. Add regression tests for over-capacity placements and duplicates. Do not test this by freezing the actual user's browser.
2. `placementRowLabel` says row 1=手前, row 3=奥, opposite of screen geometry SLOT_Y=[32,60,88]. Correct to row 1=奥, row 3=手前. Keep actual grid coordinates unchanged.
3. `agent-browser a11y --json` on 10-species storybook view reports 5 contrast violations: white text on pink reunion badges (#d4849a), ratio 2.77. Use dark text or darken the badge to meet 4.5:1 in both garden modes. No need to redesign.
4. Photo card label white text on tan gradient is similarly hard to read; set a consistent dark green/brown text with a light opaque plate in photo mode for reliable contrast.

Review docs should report actual tests and build, not infer browser QA. No further features, no deploy, no commit. Astra continues browser flow verification separately.
