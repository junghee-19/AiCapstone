# Detection Time Detail Layout

## Task summary
- Combined the detection time summary and defect detail table into one responsive section.

## Scope
- Changed only the detailed statistics page layout.
- Kept existing statistics calculations, filters, defect bar chart, and fail-rate trend behavior unchanged.

## Changed files
- `frontend/src/pages/DetailedStatsPage.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_detection-time-detail-layout.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Made detection time a compact 2x2 card grid with max, average, min, and sample count.
- Reduced the defect detail table width by placing it beside detection time in the same five-column section.

## Issues
- None.

## Next steps
- Browser에서 detection time 2x2 grid와 defect detail table이 같은 섹션에 들어가는지 시각 확인한다.
