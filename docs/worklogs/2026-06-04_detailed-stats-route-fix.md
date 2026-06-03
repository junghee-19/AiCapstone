# Detailed Stats Route Fix

## Task summary
- Fixed the detailed statistics sidebar routing to use a clearer dedicated route.

## Scope
- Changed only frontend routing and navigation labels for the detailed statistics page.
- Kept the previous `/stats` route as a redirect for compatibility.
- Did not change page contents, statistics calculations, APIs, or dashboard behavior.

## Changed files
- `frontend/src/App.tsx`
- `frontend/src/components/common/Sidebar.tsx`
- `frontend/src/components/common/Header.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_detailed-stats-route-fix.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Used `/detailed-stats` as the primary route because it matches the menu purpose more clearly than `/stats`.
- Kept `/stats` as a redirect to avoid breaking old links.

## Issues
- None.

## Next steps
- Browser에서 sidebar 상세 통계 버튼이 `/detailed-stats`로 이동하고 `/stats`가 redirect되는지 확인한다.
