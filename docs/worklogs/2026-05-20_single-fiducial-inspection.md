# Single Fiducial Inspection

## Task summary
- Allow edge inspection to continue when only one fiducial mark is detected.
- Expose the active fiducial and defect confidence thresholds in local result payloads.

## Scope
- Edge capture gating, production pipeline gating, alignment fallback, touchscreen result payload, and WebSocket result summary.
- Spring Boot inspection metadata format was not expanded.

## Changed files
- `edge/main.py`
- `edge/inference/alignment.py`
- `edge/runtime/inspection_control.py`
- `edge/runtime/touchscreen_state.py`
- `edge/ws/protocol.py`

## Verification result
- `python -m compileall edge` passed.

## Decisions made
- Zero fiducials still returns `SKIPPED`.
- One fiducial now allows Stage 2 detection.
- One fiducial cannot support two-point alignment, so the pipeline uses the raw full frame for Stage 2.
- Thresholds are shown in local edge result payloads (`thresholds.fiducialConfidence`, `thresholds.defectConfidence`) without changing the server-bound metadata schema.

## Issues
- Hardware/camera runtime behavior was not verified in this workspace.

## Next steps
- Run an edge inspection with a frame where only one fiducial is visible and confirm the touchscreen or WebSocket result includes the threshold values.
