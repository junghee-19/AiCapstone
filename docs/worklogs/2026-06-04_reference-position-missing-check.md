# Reference Position Missing Check

## Task summary
- Strengthen missing normal component detection by checking whether each expected reference component exists at the matching coordinate position.

## Scope
- Edge reference-based missing component validation.
- Coordinate conversion from ROI detections to full aligned image coordinates before position matching.
- No frontend or backend API schema changes.

## Changed files
- `edge/main.py`
- `edge/inference/reference_check.py`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_reference-position-missing-check.md`

## Verification result
- `python -m py_compile edge\main.py edge\inference\reference_check.py` succeeded.
- Live camera/model verification was not run in this Windows workspace.

## Decisions made
- Stage2 detections are offset by `roi_x`/`roi_y` before reference position checking, so ROI-local boxes are compared in the same aligned image coordinate system as the reference.
- Reference component bboxes are transformed into the current coordinate system, then same-class detections must match the expected position using center distance and expected bbox overlap context.
- Missing synthetic defects now use the transformed expected bbox and include nearest distance plus IoU in the defect label.

## Issues
- Matching tolerance still depends on `REFERENCE_MATCH_TOLERANCE_PX`; it should be tuned on the edge device with real captures.

## Next steps
- Enable `REFERENCE_CHECK_ENABLED` with a valid reference profile and run a known-good board plus a board with a removed component to tune tolerance.
