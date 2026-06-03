# Board Reference Detected Label Counts

## Task summary
- Updated the GT-125A normal board reference counts to match the labels currently shown on the normal labeling reference image.

## Scope
- Changed only the static normal board reference count data for the PCB information page.
- Did not change the reference image, detector labels, API behavior, or inspection logic.

## Changed files
- `frontend/src/config/boardReference.ts`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_board-reference-detected-label-counts.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- Kept `mount_hole`, `fiducial`, and `smd_array_block` at their existing counts because they already matched the visible reference labels.
- Changed `gold_finger_row` to 1, `ic_chip` to 2, and `edge_connector_zone` to 2 based on the visible reference image labels.

## Issues
- None.

## Next steps
- Browser에서 PCB 정보 화면의 정상 클래스 개수가 기준 이미지 라벨과 맞는지 시각 확인한다.
