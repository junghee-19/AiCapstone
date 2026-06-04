# Edge Background Guide Worker

## Task summary
- Move preview fiducial guide detection off the MJPEG stream loop so camera frames keep flowing even when guide detection is slower.

## Scope
- Edge camera preview stream guide overlay scheduling.
- No changes to the actual inspection pipeline or capture gate criteria.

## Changed files
- `edge/api/router.py`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_edge-background-guide-worker.md`

## Verification result
- `python -m py_compile edge\api\router.py` succeeded.
- Live camera streaming was not verified in this Windows workspace.

## Decisions made
- The stream loop now schedules fiducial guide refresh work on a daemon thread and immediately draws the last known guide state.
- Only one guide worker can run at a time, and the existing detection interval throttle is preserved.
- Frame delay is allowed, but blocking the preview stream is avoided.

## Issues
- Real `/dev/video0` behavior must be validated on the edge device.

## Next steps
- Run the edge service on the Raspberry Pi and confirm `/edge/camera/stream` keeps updating while guide detection is enabled.
