# Missing Component Normal Position Overlay

## Task summary
- Show the expected normal position for missing components in the inspection detail viewer.

## Scope
- Frontend inspection detail overlay and missing reason panel.
- No backend or edge payload schema changes.

## Changed files
- `frontend/src/components/inspection/DefectViewer.tsx`
- `frontend/src/types/inspection.ts`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_missing-component-normal-position-overlay.md`

## Verification result
- `cmd /c npm run build` succeeded in `frontend`.
- Vite reported the existing chunk-size warning after build.

## Decisions made
- Position-based `MISSING:*` defects are now rendered as dashed red expected-location boxes on the inspection image.
- Count-only missing defects remain in the reason list only because they do not have a concrete position.
- The FAIL reason panel now includes expected center coordinates and bbox values for position-based missing defects.
- `defectDisplayName` now accepts the newer missing label suffix containing `iou=...`.

## Issues
- Visual verification with a real missing-component inspection record was not performed in this workspace.

## Next steps
- Run one edge inspection with a removed component and confirm the dashed box is centered on the expected normal position.
