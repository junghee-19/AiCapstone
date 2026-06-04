# Edge Camera Device Path

## Task summary
- Added explicit camera device path support for edge camera capture.

## Scope
- Added `CAMERA_DEVICE` settings support in the edge runtime.
- Changed camera opening to prefer `/dev/videoN` paths before OpenCV numeric indexes.
- Updated edge env files to document the recommended `/dev/video0` path form.

## Changed files
- `edge/config/settings.py`
- `edge/capture/camera.py`
- `edge/.env`
- `edge/.env.example`
- `docs/worklogs/_index.md`
- `docs/worklogs/2026-06-04_edge-camera-device-path.md`

## Verification result
- `python -m py_compile edge/config/settings.py edge/capture/camera.py` 성공.
- `settings` 런타임 import 검증은 현재 Windows 전역 Python에 `pydantic`이 없어 수행하지 못했다.
- 실제 `/dev/video0` 웹캠 오픈 검증은 이 Windows workspace에서 수행할 수 없다.

## Decisions made
- Kept `CAMERA_DEVICE_INDEX` for backward compatibility.
- Added `CAMERA_DEVICE=/dev/video0` because direct V4L2 device paths avoid ambiguous OpenCV index mapping on Raspberry Pi.
- Kept automatic fallback to common video indexes when no explicit `CAMERA_DEVICE` opens.

## Issues
- Could not verify actual webcam access in this Windows workspace.
- Current global Python environment does not have edge runtime dependencies installed.

## Next steps
- On Raspberry Pi, run edge with `CAMERA_DEVICE=/dev/video0` and confirm the camera opens.
