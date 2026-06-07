# Reference Orientation Selection

## Task summary
- Reduce false missing IC reports caused by the reference position check selecting the 180-degree orientation from mostly symmetric component matches.

## Scope
- Edge reference orientation selection logic.
- No direction lock, model changes, thresholds, or reference profile data changes.

## Changed files
- `edge/inference/reference_check.py`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_reference-orientation-selection.md`

## Verification result
- `python -m py_compile edge\inference\reference_check.py edge\config\settings.py` succeeded.

## Decisions made
- Directional classes such as `edge_connector_zone`, `model_name_zone`, `g_series_name_zone`, and related name/connector zones now drive normal vs 180-degree orientation selection when detected.
- If no directional signal is available, rotated orientation must be clearly better before it is selected, so symmetric IC or hole layouts do not flip the board direction from a small score difference.

## Issues
- Real edge-device validation is still needed with one normal placement and one physically 180-degree placement.

## Next steps
- Re-run the image that produced `MISSING:ic_chip:expected_at=(1270,858)` and confirm normal orientation is selected.
