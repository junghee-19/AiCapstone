# Inspection detail missing dedupe

## Task summary
- Fixed the inspection detail view counting duplicated missing payloads.
- The UI now deduplicates count-based and position-based missing entries for the same class before showing the missing count.

## Scope
- Frontend inspection detail display only.
- No backend, edge inference, reference matching, or API payload changes.

## Changed files
- `frontend/src/components/inspection/DefectViewer.tsx`
- `frontend/src/types/inspection.ts`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_inspection-detail-missing-dedupe.md`

## Verification result
- `tsc --noEmit` passed using the bundled Node runtime.
- `vite build` passed using the bundled Node runtime.

## Decisions made
- If a class has a position-based missing entry, the count-only missing entry for the same class is hidden in the detail display.
- Missing counts now use the deduplicated display list.
- `defectDisplayName()` now parses the current `nearest_at` position-missing format.

## Issues
- Backend payloads can still include both count-based and position-based missing entries; this change only prevents duplicate display/counting in the frontend detail view.

## Next steps
- Reopen inspection detail #292 and confirm the missing count is based on deduplicated missing classes.
