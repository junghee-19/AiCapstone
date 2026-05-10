"""
Inference Service — PCB 비전 추론 전용 FastAPI 서버

역할:
  - 단일 엔드포인트 POST /inspect 제공
  - 이미지 받아 YOLO 추론(Stage1 fiducial → 정렬 → Stage2 결함) 후 InspectionPacket JSON 반환
  - DB 저장·서버 전송 책임 없음 (Spring Boot 호출자가 결과를 저장)

배포:
  - GCP VM 등 클라우드에 도커로 단독 실행
  - Spring Boot 백엔드가 내부 네트워크로 POST /inspect 호출
"""

from __future__ import annotations

import logging
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile

from config.settings import settings
from inference.alignment import (
    compute_alignment,
    crop_inspection_roi_with_offset,
    deskew_image_by_fiducial_angle,
)
from inference.yolo_detector import YoloDetector
from models.schemas import (
    DefectPayload,
    InspectionPacket,
    InspectionResult,
)

# ── 로깅 ──────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


# ── 전역 검출기 ───────────────────────────────────────────────────────────────
detector: Optional[YoloDetector] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작 시 YOLO 모델을 한 번만 로드한다."""
    global detector
    logger.info("=" * 60)
    logger.info("   Inference Service 시작")
    logger.info("=" * 60)

    detector = YoloDetector(
        weights_path=settings.YOLO_WEIGHTS_PATH,
        confidence_threshold=settings.YOLO_CONFIDENCE_THRESHOLD,
    )
    detector.load()
    logger.info("[시작] 모델 로드 완료 — 추론 대기")

    yield

    logger.info("[종료] Inference Service 종료")


app = FastAPI(title="PCB Inference Service", version="1.0.0", lifespan=lifespan)


# ── 헬스체크 ──────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health() -> dict:
    """서비스 헬스체크."""
    return {
        "status": "ok",
        "service": "inference-service",
        "timestamp": datetime.now().isoformat(),
        "model_loaded": detector is not None,
    }


# ── 추론 엔드포인트 ───────────────────────────────────────────────────────────
@app.post("/inspect", tags=["Inspection"])
async def inspect_image(
    image: UploadFile = File(..., description="검사할 PCB 이미지 (.jpg/.png 등)"),
) -> dict:
    """
    이미지를 받아 YOLO 추론을 수행한 뒤 검사 결과를 JSON으로 반환한다.
    호출자(Spring Boot)는 이 결과를 받아 DB에 저장한다.
    """
    if detector is None:
        raise HTTPException(503, "YOLO 모델이 아직 로드되지 않았습니다.")

    raw = await image.read()
    if not raw:
        raise HTTPException(400, "업로드된 파일이 비어 있습니다.")

    arr = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(400, "이미지를 디코딩할 수 없습니다.")

    pipeline_start = time.perf_counter()
    image_name = image.filename or "upload.jpg"
    packet = _run_pipeline(frame, image_name, pipeline_start)
    return packet.to_server_json()


# ── 추론 파이프라인 ───────────────────────────────────────────────────────────
def _run_pipeline(
    frame: np.ndarray,
    image_name: str,
    pipeline_start: float,
) -> InspectionPacket:
    """
    Stage 1: fiducial 검출 → 정렬 판단
    Stage 2: 정렬된 ROI 또는 전체 프레임에서 결함 검출
    결과 InspectionPacket 반환.
    """
    assert detector is not None

    # Stage 1
    fiducials, fid_ms = detector.detect_fiducials(frame)
    alignment = compute_alignment(fiducials)

    f1x = alignment.fiducial1.center_x if alignment.fiducial1 else None
    f1y = alignment.fiducial1.center_y if alignment.fiducial1 else None
    f2x = alignment.fiducial2.center_x if alignment.fiducial2 else None
    f2y = alignment.fiducial2.center_y if alignment.fiducial2 else None
    f1_conf = alignment.fiducial1.confidence if alignment.fiducial1 else None
    f2_conf = alignment.fiducial2.confidence if alignment.fiducial2 else None

    if not alignment.is_aligned:
        logger.warning("[검사] 피듀셜 부족 또는 기울기 한도 초과 → SKIPPED")
        return _build_packet(
            result=InspectionResult.SKIPPED,
            f1x=f1x, f1y=f1y, f2x=f2x, f2y=f2y,
            f1_conf=f1_conf, f2_conf=f2_conf,
            angle_error=alignment.angle_error_deg,
            inference_ms=fid_ms,
            defects=[],
            image_path=image_name,
            pipeline_start=pipeline_start,
        )

    # Deskew
    frame, alignment = deskew_image_by_fiducial_angle(frame, alignment)
    if alignment.fiducial1:
        f1x, f1y = alignment.fiducial1.center_x, alignment.fiducial1.center_y
    if alignment.fiducial2:
        f2x, f2y = alignment.fiducial2.center_x, alignment.fiducial2.center_y

    # Stage 2 — 전체 deskew 프레임 또는 ROI에서 결함 검출
    if getattr(settings, "DEFECT_INFER_ON_FULL_DESKEW", True):
        roi = frame
        roi_x, roi_y = 0, 0
    else:
        roi, roi_x, roi_y = crop_inspection_roi_with_offset(frame, alignment)

    defect_items, defect_ms = detector.detect_defects(roi)

    # ROI 좌표를 전체 프레임 좌표로 변환
    defect_payloads: list[DefectPayload] = []
    for item in defect_items:
        defect_payloads.append(
            DefectPayload(
                defect_type=item.defect_type,
                confidence=round(item.confidence, 4),
                bbox_x=item.bbox.x + roi_x,
                bbox_y=item.bbox.y + roi_y,
                bbox_width=item.bbox.width,
                bbox_height=item.bbox.height,
            )
        )

    # 판정: YOLO 결함 1건 이상이면 FAIL
    has_real_defect = len(defect_payloads) > 0
    result = InspectionResult.FAIL if has_real_defect else InspectionResult.PASS

    logger.info(
        "[검사] 완료 — result=%s, defects=%d, fid_ms=%d, defect_ms=%d",
        result.value, len(defect_payloads), fid_ms, defect_ms,
    )

    return _build_packet(
        result=result,
        f1x=f1x, f1y=f1y, f2x=f2x, f2y=f2y,
        f1_conf=f1_conf, f2_conf=f2_conf,
        angle_error=alignment.angle_error_deg,
        inference_ms=fid_ms + defect_ms,
        defects=defect_payloads,
        image_path=image_name,
        pipeline_start=pipeline_start,
    )


def _build_packet(
    *,
    result: InspectionResult,
    f1x, f1y, f2x, f2y,
    angle_error: float,
    inference_ms: int,
    defects: list[DefectPayload],
    image_path: str,
    pipeline_start: float,
    f1_conf: Optional[float] = None,
    f2_conf: Optional[float] = None,
) -> InspectionPacket:
    """검사 결과를 InspectionPacket으로 조립한다."""
    total_ms = int((time.perf_counter() - pipeline_start) * 1000)
    return InspectionPacket(
        device_id=getattr(settings, "DEVICE_ID", "INFERENCE-SERVICE"),
        result=result,
        fiducial1_x=f1x,
        fiducial1_y=f1y,
        fiducial2_x=f2x,
        fiducial2_y=f2y,
        fiducial1_confidence=f1_conf,
        fiducial2_confidence=f2_conf,
        angle_error_deg=angle_error,
        inference_time_ms=inference_ms,
        total_time_ms=total_ms,
        image_path=image_path,
        inspected_at=datetime.now(),
        defects=defects,
    )


# ── 직접 실행 ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=getattr(settings, "SERVICE_PORT", 8000),
        reload=False,
        log_level="info",
    )
