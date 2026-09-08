# Collaboration

- User preference: Astra / Codex owns product thinking, specifications, review, and verification. Application implementation and fixes are delegated to Cursor CLI with Composer 2.5 (`composer-2.5`).
- Do not silently substitute another model or implement the application in Codex if Cursor is unavailable. Continue independent specification/review work and report the specific blocker.
- Keep `企画書.md` intact. Current authoritative implementation brief: `docs/mvp-3d-brief.md`. `docs/prototype-brief.md` and past reviews describe the earlier 2D prototype and are historical.
- Current phase explicitly includes real plant identification through one provider and a rotatable 3D garden. Keep deployment, accounts and payments out of scope. Distinguish real recognition, manual confirmation and samples honestly; never expose provider keys to the frontend.
- Keep credentials out of project files and logs. Do not publish or commit unless requested.

## Current priority (user update, 2026-09-08)

- Concentrate on one complete core MVP flow: choose/take a plant photo -> identify/learn -> collect it in the personal garden -> revisit the saved plant.
- Astra spends reasoning on core product decisions and blockers only. Implementation remains Cursor CLI / Composer 2.5.
- Do not automatically continue the old cosmetic review lists. Preserve existing changes; defer font, badge, minor layout and peripheral infrastructure polish unless it prevents the core flow.
- Avoid repeated review/fix cycles, broad audits, speculative backend work and duplicate agents. Run appropriate checks once and stop when the agreed core acceptance passes.
- The existing prototype uses sample identification. Do not describe it as real plant recognition; actual identification requires an explicit scope decision and a working provider connection.

## Claude Code research folder

- Claude Code handles background research and knowledge lookups. Results live in `claude-research/` — see [`claude-research/README.md`](claude-research/README.md) for the index.
- That folder holds research only, never specifications. Astra owns decisions; the folder holds the evidence behind them.
- Current entry point for the photo-to-plant matching problem: [`claude-research/00-research-map.md`](claude-research/00-research-map.md).
