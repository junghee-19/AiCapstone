# Restore Align Reference Fiducials

## Task summary
- Restore the Stage2 alignment reference fiducial coordinates to the earlier image scale used for labeling and successful detection.

## Scope
- Edge alignment reference defaults.
- Edge environment example.
- No detector logic, model weights, thresholds, or runtime `.env` values were changed.

## Changed files
- `edge/config/settings.py`
- `edge/.env.example`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_restore-align-reference-fiducials.md`

## Verification result
- `python -m py_compile edge\config\settings.py` succeeded.

## Decisions made
- Restored `ALIGN_REF_FIDUCIAL1` to `(278, 908)` and `ALIGN_REF_FIDUCIAL2` to `(1528, 202)`.
- Kept the change limited to alignment target coordinates so Stage2 receives an aligned image closer to the labeling/training scale.

## Issues
- The local runtime `edge/.env` can still override these defaults. Pi deployment must ensure the same coordinates are present in `edge/.env` or absent so defaults apply.
- Real edge-device validation is still needed to confirm no board edge is cropped after the larger alignment scale is restored.

## Next steps
- Run one previously successful sample and one current failing sample, compare generated `_aligned` images and Stage2 detections.
