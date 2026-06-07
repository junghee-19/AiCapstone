# Reference cardinality matching

## Task summary
- Investigated inspection #277 IC missing output using the provided original image, inspection payload, `.env.example`, and `reference_profile.gt125a.json`.
- Fixed the 1:1 reference matcher so it prioritizes maximum matched reference count before minimizing distance.

## Scope
- Limited to reference missing-check assignment logic.
- No changes to fiducial alignment coordinates, reference profile data, env defaults, model weights, or frontend rendering.

## Changed files
- `edge/inference/reference_check.py`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-07_reference-cardinality-matching.md`

## Verification result
- `python -m py_compile edge\inference\reference_check.py edge\config\settings.py` passed.
- Compared inspection #277 IC detections against `reference_profile.gt125a.json` projected by F1 `(278, 908)` and F2 `(1528, 202)`.
- Confirmed the payload contains 8 `ic_chip` detections.

## Decisions made
- The previous greedy 1:1 assignment prevented duplicate detection reuse, but it could choose a closer partial assignment and leave one reference unmatched.
- The matcher now chooses the assignment with the highest number of matched references first, then the lowest total distance, then the highest IoU.
- A bounded greedy fallback remains for unexpectedly large per-class candidate sets.

## Issues
- The provided workspace does not currently have an edge virtualenv, so direct module import execution failed due to missing `pydantic`; syntax compilation still passed.
- The top IC reference positions are offset from the current image detections, but the immediate false missing was caused by assignment order.

## Next steps
- Rebuild/recreate the Pi edge container and retest inspection #277 or a fresh normal board capture.
- If top IC boxes are still unstable, regenerate or correct `reference_profile.gt125a.json` from a current aligned normal board image.
