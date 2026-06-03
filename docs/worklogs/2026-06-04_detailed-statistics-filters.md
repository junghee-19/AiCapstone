# Detailed Statistics Filters

## Task summary
- Added range and result filters to the detailed statistics page.

## Scope
- Added frontend-only filtering to the detailed statistics page.
- Applied filters to every statistics card, chart, and table by computing statistics from filtered inspection logs.
- Did not change backend APIs, inspection history filters, dashboard behavior, or detector logic.

## Changed files
- `frontend/src/pages/DetailedStatsPage.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_detailed-statistics-filters.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Followed the inspection history page pattern: date range filter plus result status filter.
- Included `SKIPPED` in the result filter because detailed statistics already shows skipped counts in summary data.
- Added a reset action to quickly return to all results up to today.

## Issues
- None.

## Next steps
- Browser에서 상세 통계 필터가 카드, 차트, 테이블에 모두 반영되는지 시각 확인한다.
