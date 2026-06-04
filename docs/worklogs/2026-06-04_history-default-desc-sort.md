# History Default Desc Sort

## Task summary
- Changed the inspection history table default sort order to descending.

## Scope
- Changed only the frontend inspection table default ID sort state.
- Did not change backend API ordering, filters, CSV export, or table columns.

## Changed files
- `frontend/src/components/inspection/InspectionTable.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_history-default-desc-sort.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Used descending ID as the default because newer inspections have larger IDs and should appear first in history.
- Kept the existing clickable ID header toggle behavior.

## Issues
- None.

## Next steps
- Browser에서 검사 이력 테이블이 기본 내림차순으로 표시되는지 시각 확인한다.
