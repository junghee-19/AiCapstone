# Reference One To One Matching

## Task summary
- Change reference position matching to assign detections to expected component positions one-to-one per class.

## Scope
- Edge reference position matching logic.
- No count-based missing suppression, model changes, threshold changes, or direction lock.

## Changed files
- `edge/inference/reference_check.py`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_reference-one-to-one-matching.md`

## Verification result
- `python -m py_compile edge\inference\reference_check.py` succeeded.

## Decisions made
- For each class, all candidate reference/detection pairs are scored by distance and IoU.
- Each detection can be assigned to only one expected reference position.
- Missing defects are generated only for reference positions left unmatched after the one-to-one assignment.

## Issues
- The pair acceptance still depends on `REFERENCE_MATCH_TOLERANCE_PX` and the existing overlap condition, so real edge images should be used to tune tolerance.

## Next steps
- Re-run normal and 180-degree placements and confirm IC boxes are matched to distinct expected IC positions without extra false `MISSING:ic_chip`.
