# Trend Chart Mode Controls

## Task summary
- Made the dashboard trend chart PASS/FAIL controls functional and separated the control area from the chart area.

## Scope
- Changed only the dashboard trend chart UI and local chart filtering behavior.
- Did not change trend data aggregation, APIs, dashboard routes, or other statistics pages.

## Changed files
- `frontend/src/components/dashboard/TrendChart.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_trend-chart-mode-controls.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Added local chart mode state for all, PASS-only, and FAIL-only views.
- Kept the existing stacked PASS/FAIL view as the default `Inspection Trend` mode.
- Split the controls into a top band with a border so the buttons are visually separate from the chart canvas.

## Issues
- None.

## Next steps
- Browser에서 Inspection Trend, PASS, FAIL 버튼 전환과 분리된 상단 컨트롤 영역을 시각 확인한다.
