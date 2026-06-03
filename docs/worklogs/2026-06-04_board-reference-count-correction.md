# Board Reference Count Correction

## Task summary
- Corrected the GT-125A normal board reference counts using the updated reference image provided by the user.

## Scope
- Changed only the static normal board reference counts used by the PCB information page.
- Did not change the reference image, detector labels, APIs, or inspection logic.

## Changed files
- `frontend/src/config/boardReference.ts`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_board-reference-count-correction.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Set the normal counts to the visible labels in the updated reference image: mount holes 4, fiducials 2, gold finger rows 2, ICs 8, SMD arrays 2, edge connectors 2.
- Kept the previous worklog file intact and added this correction as a new worklog entry.

## Issues
- None.

## Next steps
- Browser에서 PCB 정보 화면의 정상 클래스 개수가 updated reference image 기준과 맞는지 시각 확인한다.
