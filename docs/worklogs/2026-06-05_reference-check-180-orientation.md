# Reference Check 180 Orientation

## Task summary
- Handle PCB captures that are rotated 180 degrees by comparing reference component positions against both normal and swapped-fiducial orientations.

## Scope
- Edge reference-based missing component position check.
- No frontend, backend, or payload schema changes.

## Changed files
- `edge/inference/reference_check.py`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-05_reference-check-180-orientation.md`

## Verification result
- `python -m py_compile edge\inference\reference_check.py edge\main.py` succeeded.
- Direct function simulation could not run because the active global Python environment does not have `pydantic` installed.

## Decisions made
- Fiducials alone cannot disambiguate 180-degree orientation when the two marks are visually equivalent.
- The missing check now evaluates both normal mapping and swapped-fiducial mapping, then chooses the orientation with more matched reference components.
- If match counts tie, the orientation with lower total match distance is selected.
- Candidate-orientation missing logs are debug-level to avoid noisy warnings from the non-selected orientation.

## Issues
- Real edge-device validation is still required with a 180-degree rotated board capture.

## Next steps
- Run one normal capture and one 180-degree rotated capture on the edge device and confirm the selected orientation log and missing overlay positions.
