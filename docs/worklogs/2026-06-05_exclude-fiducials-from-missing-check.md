# Exclude Fiducials From Missing Check

## Task summary
- Keep fiducial coordinates as reference marks, but exclude them from normal component missing checks.

## Scope
- Edge reference position check target filtering.
- PCB information coordinate display grouping.

## Changed files
- `edge/inference/reference_check.py`
- `frontend/src/pages/BoardReferencePage.tsx`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-05_exclude-fiducials-from-missing-check.md`

## Verification result
- `python -m py_compile edge\inference\reference_check.py edge\main.py` succeeded.
- `cmd /c npm run build` succeeded in `frontend`.
- Reference target count check confirmed fiducials are excluded from missing-check targets.

## Decisions made
- The reference profile may still contain fiducial entries because they are useful as alignment/reference marks.
- Edge missing comparison skips any reference component whose class contains `fiducial`.
- PCB information now separates fiducials into a reference mark section instead of listing them with missing-check component coordinates.

## Issues
- Vite reported the existing chunk-size warning after frontend build.

## Next steps
- Validate on a real inspection that fiducials no longer appear as `MISSING:*` failure reasons.
