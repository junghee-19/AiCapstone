# Detailed Statistics Remove Skipped

## Task summary
- Removed SKIPPED from detailed statistics filtering and result breakdowns.

## Scope
- Changed only the detailed statistics page.
- Excluded SKIPPED logs from statistics calculations on this page.
- Did not change history, dashboard, backend APIs, or persisted inspection data.

## Changed files
- `frontend/src/pages/DetailedStatsPage.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_detailed-statistics-remove-skipped.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Treated detailed statistics as PASS/FAIL-only because SKIPPED is not a valid classification for this view.
- Removed the SKIPPED filter button and removed skipped data from the result pie chart.

## Issues
- None.

## Next steps
- Browser에서 상세 통계 필터와 정상/오류율 차트에 SKIPPED가 표시되지 않는지 시각 확인한다.
