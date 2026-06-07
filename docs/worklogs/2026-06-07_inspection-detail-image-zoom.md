# Inspection detail image zoom

## Task summary
- Added zoom controls to the inspection detail image view.
- Controls are positioned at the bottom-right of the image area.

## Scope
- Frontend inspection detail modal only.
- No backend, edge inference, reference matching, or API changes.

## Changed files
- `frontend/src/components/inspection/DefectViewer.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_inspection-detail-image-zoom.md`

## Verification result
- `tsc --noEmit` passed using the bundled Node runtime.
- `vite build` passed using the bundled Node runtime.
- Vite reported the existing large chunk warning.

## Decisions made
- Zoom is implemented by changing the SVG `viewBox`, so the image and overlay labels/boxes zoom together.
- Zoom range is clamped from 100% to 400% in 25% steps.
- The zoom state resets when the selected inspection or image source changes.

## Issues
- Panning was not added because the request only asked for zoom in/out.

## Next steps
- If detailed inspection needs arbitrary navigation after zooming, add drag-to-pan or click-to-focus as a separate scoped change.
