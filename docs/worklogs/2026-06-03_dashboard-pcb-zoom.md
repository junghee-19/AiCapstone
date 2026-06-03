# Dashboard PCB Zoom

## Task summary
- Updated the dashboard inspection result detail image to focus on the PCB area instead of showing the full camera frame.

## Scope
- Changed only frontend result image rendering in the inspection detail viewer.
- Kept inspection data fetching, result filtering, table behavior, downloads, and backend APIs unchanged.

## Changed files
- `frontend/src/components/inspection/DefectViewer.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-03_dashboard-pcb-zoom.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Used fiducial points, defect boxes, and positional missing metadata to estimate the visible PCB crop.
- Rendered the image and overlays in one SVG source-coordinate viewBox so labels and boxes stay aligned after zooming.
- Fell back to the full image when no usable crop points are available.

## Issues
- Browser visual verification was not run in this turn.

## Next steps
- Check a real dashboard result detail with PASS and FAIL samples to confirm the PCB is framed tightly without cutting off edge labels.
