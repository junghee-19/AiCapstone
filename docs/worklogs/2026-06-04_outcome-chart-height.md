# Outcome Chart Height

## Task summary
- Matched the dashboard inspection outcome card height to the inspection trend card height.

## Scope
- Changed only the dashboard outcome chart card container height.
- Did not change chart data, API calls, labels, colors, or donut sizing.

## Changed files
- `frontend/src/components/dashboard/PassFailChart.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_outcome-chart-height.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Reused the trend chart card height class `min-h-[23rem]` for the outcome chart loading and loaded states.

## Issues
- None.

## Next steps
- Browser에서 dashboard outcome/trend 카드 높이 정렬을 시각 확인한다.
