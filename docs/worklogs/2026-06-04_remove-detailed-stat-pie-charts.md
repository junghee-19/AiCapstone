# Remove Detailed Stat Pie Charts

## Task summary
- Removed the two pie/donut charts from the detailed statistics page.

## Scope
- Removed the normal/error ratio donut chart.
- Removed the defect type ratio pie chart.
- Kept KPI cards, inspection time cards, defect type bar chart, defect detail table, filters, and fail-rate trend.

## Changed files
- `frontend/src/pages/DetailedStatsPage.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_remove-detailed-stat-pie-charts.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Removed now-unused pie chart imports and resultData construction together with the UI sections.
- Kept ratio information in the defect detail table because it is more compact and easier to compare.

## Issues
- None.

## Next steps
- Browser에서 상세 통계 페이지에 두 pie/donut chart가 제거됐는지 시각 확인한다.
