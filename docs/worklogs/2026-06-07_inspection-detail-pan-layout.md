# Inspection detail pan layout

## Task summary
- Added mouse drag panning to the inspection detail image view.
- Widened the image area by reducing right panel widths and allowing the modal to use more viewport width.

## Scope
- Frontend inspection detail modal only.
- No backend, edge inference, API, or reference matching changes.

## Changed files
- `frontend/src/components/inspection/DefectViewer.tsx`
- `frontend/src/components/inspection/InspectionTable.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_inspection-detail-pan-layout.md`

## Verification result
- `tsc --noEmit` passed using the bundled Node runtime.
- `vite build` passed using the bundled Node runtime.
- Vite reported the existing large chunk warning.

## Decisions made
- Drag panning updates the SVG `viewBox`, so the image and overlays move together.
- Drag behavior matches map-style grab movement: dragging right moves the image content right.
- Reset now returns both zoom and pan to the default view.
- The main detail row uses `items-start` so long right-side panels do not stretch the image panel and create extra lower empty space.

## Issues
- Touch panning is supported through pointer events, but no pinch zoom was added.

## Next steps
- If needed, add wheel zoom centered around the cursor as a separate scoped change.
