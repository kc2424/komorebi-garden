# Astra review 01: finish the prototype

The initial implementation builds, but is not yet accepted. Fix these issues using Composer 2.5. Preserve scope and original documents.

## Functional blockers

1. At 390x844, clicking the first sample photo in Discover shows an image error and cannot progress. Reproduce and fix sample image selection. Use real botanical JPEG photographs for photo-mode and sample selection, not SVGs called photographs.
2. getEffectiveCollections/getEffectiveObservations exclude records where isSample=true. Explicitly registering a sample photo must add it to the personal garden, persist, show the photo, and support rediscovery. Keep source/sample provenance but distinguish preview-only virtual records from actual saved observations.
3. Empty/3/10 previews should be exact standalone sample views (0,3,10), with saved personal records kept intact and restored via 自分の庭. Do not merge user records into previews or show false counts. Virtual sample details must not offer memo/movement actions that report success but do not save anything; allow read-only detail with an honest sample badge. The real personal garden has full memo/movement functionality.
4. Primary discovery CTA is below the fold on 390x844. Make it persistently visible in a bottom action area with safe-area padding, and ensure it doesn't cover content. Initial garden scene should fit the first mobile viewport. Retain a desktop presentation that looks intentional, not a stretched phone form.
5. Remove role=listitem from buttons; retain native button semantics, optionally wrap with list elements. Hide visually hidden file inputs accessibly if custom trigger buttons are used. Ensure navigation focuses each screen title or main element and returns scroll to top. Only use Modal if needed; if used it needs a focus trap and stable callback behavior.
6. Keep save failure typed result and no completion on failure. Avoid persisting inside a React setState updater and never update successful UI state on failed writes. Validate parsed storage shape and handle invalid storage explicitly without silently overwriting it on startup. No speculative migrations or huge framework needed.

## Visual corrections

The 10-species first render is a uniform grid of white cards on a blue/beige gradient, with most of the bottom scene empty. It does not yet feel like a garden. Make B have plants sitting directly on grass, organic visual placement, varied silhouettes/sizes (tree/shrub/flower), readable full names, quiet shadows and minimal labels; no opaque rectangular tile behind every plant. Use a coherent small garden scene as the visual anchor. A should deliberately look different: actual photographs in warm paper/wood specimen cards, carefully composed, with no overflowing labels. Both share the same data.

Astra is preparing a garden backdrop asset; if available use public/art/garden-backdrop.png. If not yet present, keep its integration isolated and report where to attach it. Do not create broken references. Avoid large blue empty sky/tan ground bands and nested cards. Reduce top controls density, keep A/B easy to use, group 0/3/10 under a small 試しに眺める section. Japanese copy stays concise.

## Real photo assets (already researched)

Source lookup data is available at:
- /tmp/digital-garden-photo-sources.json (English article lead images; use all except Kerria japonica, Hydrangea macrophylla, Platycodon grandiflorus)
- /tmp/digital-garden-extra-photo-sources.json (Japanese article lead images for ヤマブキ, アジサイ, キキョウ; use these three replacements)
- /tmp/digital-garden-image-licenses.json (Commons imageinfo with exact image URLs, thumbnail URLs, author, license, attribution and file description pages for all 10 selected photographs)

Use exact verified imageinfo thumbnail URLs to download 10 photos into public/samples/{illustrationId}.jpg. Use curl when fetching; urllib defaults received a 403 whereas curl succeeded. Record source page, creator, license with link, and resize/crop modifications for every photograph in docs/asset-credits.md and provide a small in-app credit view/link. CC BY-SA derived photographs keep the same respective license. No invented URLs or licensing claims. Existing SVGs are no longer needed for photos; keep original plant illustration code separately. Actually verify all 10 real photos load and the 4 samples are selectable.

## Botanical text corrections

- Hydrangea macrophylla is Hydrangeaceae / アジサイ科, not ユキノシタ科. Correct both catalog and candidate data. Source: https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A791637-1
- Iris sanguinea: display アヤメ for clarity; its habitat is relatively dry grassland, not wetland. Source: https://www.pharm.kumamoto-u.ac.jp/yakusodb/detail/003455.php
- Keep these references in a source note in docs; no need for lengthy botanical exposition in the interface.

## Verification

Add focused tests covering actual sample registration -> collection/photo persistence, repeat registration without species-count increase, independent previews preserving user records, save failures without success, memo and placement persistence. Run tests and build. Update README/verification-results to match actual final behavior. Don't claim browser QA you did not perform. Astra will run independent browser QA after your changes. Do not commit or deploy.
