# History Detail Modal PCB Zoom

## Task summary
- Applied PCB-focused image zoom to the inspection detail view opened from the history detail modal.

## Scope
- Changed only the frontend detail image rendering path used by `DefectViewer`.
- Kept inspection table modal behavior, data fetching, filtering, downloads, and backend APIs unchanged.

## Changed files
- `frontend/src/components/inspection/DefectViewer.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-03_history-detail-modal-pcb-zoom.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Used fiducial points, defect boxes, and positional missing metadata to estimate the PCB crop area.
- Rendered the result image and overlays in one SVG source-coordinate viewBox so labels and boxes remain aligned after zooming.
- Kept the full image fallback when no usable crop coordinates are available.

## Issues
- Browser visual verification was not run in this turn.

## Next steps
- Check the history detail modal with real PASS and FAIL samples to confirm the PCB is enlarged and edge labels remain visible.
