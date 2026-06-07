# Pi touchscreen missing dedupe

## Task summary
- Fixed duplicated missing notices on the Pi touchscreen result screen.
- The screen was showing count-based missing notices and position-based missing notices for the same class at the same time.

## Scope
- Limited to Pi touchscreen display logic.
- No changes to edge inference, reference profile, backend payloads, or model settings.

## Changed files
- `pi-touchscreen/app.js`
- `pi-touchscreen/index.html`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_pi-touchscreen-missing-dedupe.md`

## Verification result
- `node --check pi-touchscreen\app.js` passed.

## Decisions made
- Updated `missingPositionOf()` to parse the current position missing format with `nearest_at` and `iou`.
- If a position-based missing exists for a class, count-only notices for the same class are hidden on the touchscreen summary.
- Added a final unique-key filter for summary notices to avoid repeated identical labels.
- Bumped static asset query strings so the touchscreen browser loads the updated JavaScript.

## Issues
- This only deduplicates the Pi touchscreen display. The backend can still include both count-based and position-based missing payloads.

## Next steps
- Redeploy or refresh the Pi touchscreen static files and hard-refresh the browser if the old cached script is still visible.
