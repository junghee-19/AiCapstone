# Board Reference Component Coordinates

## Task summary
- Show normal reference component coordinate data on the PCB information page.

## Scope
- Frontend PCB information page only.
- Static GT-125A reference component coordinates based on the current board reference image.
- No backend or edge runtime changes.

## Changed files
- `frontend/src/config/boardReference.ts`
- `frontend/src/pages/BoardReferencePage.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_board-reference-component-coordinates.md`

## Verification result
- `cmd /c npm run build` succeeded in `frontend`.
- Vite reported the existing chunk-size warning after build.

## Decisions made
- Added optional `components` data to `BoardReference`.
- Coordinates are displayed as both center point `(cx, cy)` and bbox `x, y, width x height`.
- The coordinate list is shown below the normal class count panel in a scrollable table.

## Issues
- The current coordinate values are static frontend data. If the edge reference profile is regenerated, these values should be synced or loaded from the `/edge/reference` API later.

## Next steps
- Consider wiring PCB information to the live edge reference profile API when the UI needs to reflect runtime reference updates automatically.
