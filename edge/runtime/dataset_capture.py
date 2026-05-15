"""Dataset image capture helpers kept separate from inspection inference."""

from __future__ import annotations

import asyncio
import logging
import mimetypes
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

from config.settings import settings

logger = logging.getLogger(__name__)

_EDGE_DIR = Path(__file__).resolve().parent.parent
LABEL_CAPTURE_DIR = _EDGE_DIR / "label_captures"


def _clamp_capture_request(count: int, interval_seconds: float) -> tuple[int, float]:
    safe_count = max(1, min(200, int(count)))
    safe_interval = max(0.1, min(60.0, float(interval_seconds)))
    return safe_count, safe_interval


async def capture_labeling_images(
    *,
    count: int = 10,
    interval_seconds: float = 3.0,
) -> dict[str, Any]:
    """
    Capture raw camera frames for labeling datasets.

    This intentionally avoids the inspection pipeline: no YOLO inference, no
    backend result upload, and no inspection DB record.
    """
    safe_count, safe_interval = _clamp_capture_request(count, interval_seconds)

    try:
        import main as main_mod
    except ImportError as e:
        raise RuntimeError("카메라 런타임을 로드할 수 없습니다.") from e

    camera = getattr(main_mod, "camera", None)
    if camera is None:
        raise RuntimeError("카메라가 초기화되지 않아 라벨링 이미지를 촬영할 수 없습니다.")

    session_name = datetime.now().strftime("%Y%m%d_%H%M%S")
    session_dir = LABEL_CAPTURE_DIR / session_name
    session_dir.mkdir(parents=True, exist_ok=True)

    saved: list[str] = []
    uploaded: list[dict[str, Any]] = []
    logger.info(
        "[라벨링캡처] 시작 — count=%d, interval=%.1fs, dir=%s",
        safe_count,
        safe_interval,
        session_dir,
    )

    for index in range(safe_count):
        _frame, path = await asyncio.to_thread(camera.capture_and_save, str(session_dir))
        image_path = Path(path)
        saved.append(image_path.name)
        logger.info("[라벨링캡처] %d/%d 저장: %s", index + 1, safe_count, path)
        uploaded.append(
            await asyncio.to_thread(
                _upload_dataset_image,
                image_path,
                session_name,
                index + 1,
            )
        )

        if index < safe_count - 1:
            await asyncio.sleep(safe_interval)

    return {
        "count": len(saved),
        "requestedCount": safe_count,
        "intervalSeconds": safe_interval,
        "directory": str(session_dir),
        "session": session_name,
        "files": saved,
        "uploaded": uploaded,
    }


def _upload_dataset_image(image_path: Path, session: str, index: int) -> dict[str, Any]:
    url = f"{settings.SERVER_BASE_URL.rstrip('/')}/api/dataset-images"
    content_type, _ = mimetypes.guess_type(image_path.name)
    if not content_type:
        content_type = "image/jpeg"

    with image_path.open("rb") as fp:
        response = requests.post(
            url,
            data={
                "deviceId": settings.EDGE_DEVICE_ID,
                "session": session,
                "index": str(index),
            },
            files={
                "image": (image_path.name, fp, content_type),
            },
            timeout=30,
        )
    response.raise_for_status()
    logger.info("[라벨링캡처] 서버 업로드 완료: %s (%s)", image_path.name, response.status_code)
    return response.json()
