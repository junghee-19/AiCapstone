# Detailed Statistics Menu

## Task summary
- Added a new detailed statistics menu and page below Dashboard and above History.

## Scope
- Added a frontend-only statistics page based on existing inspection history data.
- Included common quality statistics sections: inspection time max/average/min, normal/error rate, defect type counts, defect type ratios, and a defect detail table.
- Did not add new backend APIs or change inspection logic.

## Changed files
- `frontend/src/pages/DetailedStatsPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/common/Sidebar.tsx`
- `frontend/src/components/common/Header.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_detailed-statistics-menu.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- `http://localhost:5173/stats`에 HTTP 200 응답 확인.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.
- Browser 시각 검증은 Node REPL 환경에 Playwright가 없어 수행하지 못했다.

## Decisions made
- Created the work on branch `detailed-statistics-menu` because `codex/detailed-statistics-menu` could not be created in the local refs layout.
- Reused `useAllInspections()` and computed the first statistics set on the frontend so each block can be removed or adjusted independently.
- Grouped `MISSING:*` defects by missing class and `ANOMALY:*` defects as one anomaly category to avoid noisy row-per-coordinate statistics.

## Issues
- None.

## Next steps
- Browser에서 상세 통계 메뉴 위치와 `/stats` 화면 레이아웃을 시각 확인한다.
