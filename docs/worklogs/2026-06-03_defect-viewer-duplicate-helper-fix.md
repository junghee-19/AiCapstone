# Defect Viewer Duplicate Helper Fix

## Task summary
- Removed duplicate PCB crop helper declarations from `DefectViewer.tsx` that were blocking the frontend build.

## Scope
- Changed only duplicate helper declarations in the inspection detail viewer.
- Kept image crop rendering, dashboard chart sizing, APIs, and inspection behavior unchanged.

## Changed files
- `frontend/src/components/inspection/DefectViewer.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-03_defect-viewer-duplicate-helper-fix.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Kept the first helper implementation and removed the repeated second block.
- Preserved the `isFiducialAlignmentSentinel` comment and function.

## Issues
- 없음.

## Next steps
- Browser에서 dashboard trend chart와 inspection detail modal 화면을 시각 확인한다.
