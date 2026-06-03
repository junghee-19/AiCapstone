# Detailed Statistics Defect Filter

## Task summary
- Excluded normal labeling classes from the detailed statistics defect/error aggregation.

## Scope
- Changed only the detailed statistics page aggregation logic.
- Kept missing component statistics included as errors.
- Did not change inspection APIs, history data, detector output, or dashboard statistics.

## Changed files
- `frontend/src/pages/DetailedStatsPage.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_detailed-statistics-defect-filter.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Added an explicit normal-label class filter for `mount_hole`, `fiducial`, `gold_finger_row`, `ic_chip`, `smd_array_block`, and `edge_connector_zone`.
- Kept `MISSING:*` entries before the normal-label filter so missing normal components are still counted as errors.

## Issues
- None.

## Next steps
- Browser에서 상세 통계의 오류 종류 차트에 정상 라벨링 클래스가 제외되는지 시각 확인한다.
