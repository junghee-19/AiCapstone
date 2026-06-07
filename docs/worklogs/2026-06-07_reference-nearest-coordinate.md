# Reference Nearest Coordinate

## Task summary
- Include the closest detected component coordinate in position-check missing diagnostics.

## Scope
- Edge reference missing labels and debug logs.
- No matching policy, model, threshold, or reference profile changes.

## Changed files
- `edge/inference/reference_check.py`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_reference-nearest-coordinate.md`

## Verification result
- `python -m py_compile edge\inference\reference_check.py edge\config\settings.py` succeeded.

## Decisions made
- `MISSING:*` labels now include `nearest_at=(x,y)` when a same-class detection exists.
- Debug logs now show expected coordinate, closest detected coordinate, distance, tolerance, and IoU.

## Issues
- If no same-class detection exists, `nearest_at=none` is reported.

## Next steps
- Re-run the failing normal/180-degree captures and compare `expected_at` vs `nearest_at` in the displayed label or logs.
