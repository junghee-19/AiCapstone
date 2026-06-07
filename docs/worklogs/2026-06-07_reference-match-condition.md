# Reference Match Condition

## Task summary
- Relax reference position pair acceptance so valid same-class overlaps are not rejected only because bbox centers are more than the pixel tolerance apart.

## Scope
- Edge reference position matching condition.
- No direction lock, count suppression, model changes, or reference profile changes.

## Changed files
- `edge/inference/reference_check.py`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_reference-match-condition.md`

## Verification result
- `python -m py_compile edge\inference\reference_check.py edge\config\settings.py` succeeded.

## Decisions made
- Kept class-level one-to-one assignment.
- A same-class detection/reference pair is now accepted when the detection center is inside the expanded expected bbox, the boxes overlap with IoU >= 0.02, or the center distance is within `REFERENCE_MATCH_TOLERANCE_PX`.
- This avoids false missing reports when the restored alignment scale makes component bboxes overlap correctly but their centers exceed the fixed distance tolerance.

## Issues
- The IoU threshold may still need tuning with real normal and 180-degree captures.

## Next steps
- Rebuild/recreate the edge container and rerun the same 180-degree test image.
