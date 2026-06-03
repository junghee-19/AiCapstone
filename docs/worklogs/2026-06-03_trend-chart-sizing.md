# Trend Chart Sizing

## Task summary
- Adjusted the dashboard inspection trend chart sizing so the chart content and x-axis labels are not clipped inside the card.

## Scope
- Changed only the dashboard `TrendChart` layout sizing and chart margins.
- Did not change chart data, filtering, API calls, or graph behavior.

## Changed files
- `frontend/src/components/dashboard/TrendChart.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-03_trend-chart-sizing.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 실행.
- Build failed because `frontend/src/components/inspection/DefectViewer.tsx` currently has duplicate helper function declarations unrelated to this chart sizing change.

## Decisions made
- Replaced the fixed `h-80` card height with `min-h-[23rem]` so inner header, padding, and chart can fit.
- Increased the chart canvas height from `248` to `260`.
- Added bottom chart margin so the x-axis tick labels have enough space.

## Issues
- Existing `DefectViewer.tsx` duplicate declarations block a full frontend build.

## Next steps
- Remove the duplicate `DefectViewer.tsx` helper declarations, then rerun `cmd /c npm run build`.
