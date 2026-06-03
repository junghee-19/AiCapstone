# Board Reference Image Update

## Task summary
- Replaced the GT-125A PCB information reference image with the updated screenshot provided by the user.

## Scope
- Changed only the static reference image asset used by the PCB information page.
- Did not change detector labels, APIs, inspection logic, or class count data in this task.

## Changed files
- `frontend/public/board-ref/gt125a_ref.png`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_board-reference-image-update.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Kept the existing public asset path `/board-ref/gt125a_ref.png` so the UI code does not need to change.

## Issues
- None.

## Next steps
- Browser에서 PCB 정보 화면이 교체된 기준 이미지를 표시하는지 시각 확인한다.
