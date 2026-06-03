# History Detail Modal

## Task summary
- 검사 이력 상세 정보를 테이블 내부 확장 행이 아니라 화면 중앙 모달로 표시하도록 이전 취소 작업을 다시 적용했다.

## Scope
- 검사 이력 테이블의 상세 열기/닫기 표시 방식만 수정했다.
- 상세 데이터 조회, 필터, 정렬, 결함 표시 기능은 변경하지 않았다.

## Changed files
- `frontend/src/components/inspection/InspectionTable.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-03_history-detail-modal.md`

## Verification result
- `frontend`에서 `cmd /c npm run build` 성공.
- Vite의 500 kB 초과 chunk 경고는 기존 번들 크기 관련 경고로 확인했다.

## Decisions made
- 상세 패널을 `<tr>` 확장 행에서 분리해 `fixed` 모달 오버레이로 렌더링한다.
- 테이블 레이아웃 재계산 범위를 줄이기 위해 상세 뷰를 테이블 DOM 밖으로 이동했다.
- 배경 클릭과 `DefectViewer`의 닫기 동작으로 모달을 닫도록 유지했다.

## Issues
- 없음.

## Next steps
- 실제 검사 이력 화면에서 상세 열기/닫기 체감 성능을 확인한다.
