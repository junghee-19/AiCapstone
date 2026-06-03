# Dashboard Statistics Separation

## Task summary
- Separated dashboard and detailed statistics responsibilities more clearly.

## Scope
- Removed the longer-term fail rate trend chart from the dashboard.
- Moved the fail rate trend chart into the detailed statistics page.
- Did not change chart internals, backend APIs, inspection data, or route structure.

## Changed files
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/DetailedStatsPage.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_dashboard-statistics-separation.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Kept Dashboard focused on live operating status: summary cards, current pass/fail, recent 24-hour trend, and recent inspections.
- Kept Detailed Statistics focused on analysis: filtered statistics, defect distribution, defect ratios, and longer-term fail-rate trend.

## Issues
- None.

## Next steps
- Browser에서 dashboard와 detailed statistics 페이지의 정보 역할이 명확히 분리되어 보이는지 시각 확인한다.
