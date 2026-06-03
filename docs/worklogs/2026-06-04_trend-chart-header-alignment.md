# Trend Chart Header Alignment

## Task summary
- Aligned the dashboard trend chart header styling with the surrounding dashboard cards.

## Scope
- Changed only the trend chart header layout styling.
- Kept the Inspection Trend, PASS, and FAIL mode button behavior unchanged.
- Did not change data aggregation, routing, APIs, or other chart sections.

## Changed files
- `frontend/src/components/dashboard/TrendChart.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_trend-chart-header-alignment.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Removed the separate gray header band and bottom divider so the card matches the white header style used by nearby dashboard cards.
- Kept the segmented mode control inside the normal card padding.

## Issues
- None.

## Next steps
- Browser에서 trend chart header가 Inspection Outcome 카드 헤더와 자연스럽게 맞는지 시각 확인한다.
