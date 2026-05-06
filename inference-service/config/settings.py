"""
Inference Service 전역 설정 모듈

pydantic-settings를 사용하여 .env 파일 또는 OS 환경변수에서
설정값을 자동으로 로드한다.

사용법:
    from config.settings import settings
    print(settings.YOLO_WEIGHTS_PATH)
"""

from pathlib import Path
from typing import Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# inference-service/config/ → inference-service/.env
_SERVICE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """추론 서비스 전역 설정."""

    # ── 디바이스 식별자 ──────────────────────────────────────────────────────
    DEVICE_ID: str = Field(default="INFERENCE-SERVICE")

    # ── YOLO 모델 ────────────────────────────────────────────────────────────
    # 단일 통합 모델 가중치 (fiducial · context · 결함 모두 포함)
    YOLO_WEIGHTS_PATH: str = Field(default="weights/best.pt")

    # 일반 confidence 임계값 (Stage 전용 값이 None이면 이 값 사용)
    YOLO_CONFIDENCE_THRESHOLD: float = Field(default=0.5, ge=0.0, le=1.0)

    # Stage1 (피듀셜) 임계값 — None이면 일반 임계값 사용
    YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD: Optional[float] = Field(default=None)
    # Stage2 (결함/컨텍스트) 임계값 — 다클래스 PCB는 0.15~0.25 권장
    YOLO_DEFECT_CONFIDENCE_THRESHOLD: Optional[float] = Field(default=0.15)

    # YOLO predict 입력 크기 (학습 imgsz와 일치 권장)
    YOLO_PREDICT_IMGSZ: int = Field(default=1024, ge=320, le=1280)
    # TTA(증강 추론) — 약한 클래스 재현율 소폭↑, 추론 시간↑
    YOLO_PREDICT_AUGMENT: bool = Field(default=False)

    # ── 검사 파이프라인 동작 ─────────────────────────────────────────────────
    # True: Stage 2를 fiducial 사이 ROI가 아니라 deskew 직후 전체 프레임에 수행
    DEFECT_INFER_ON_FULL_DESKEW: bool = Field(default=True)

    # ── FastAPI 서버 ─────────────────────────────────────────────────────────
    SERVICE_PORT: int = Field(default=8000)

    # ── 정렬 / 각도 보정 ─────────────────────────────────────────────────────
    # 피듀셜 2개로 측정한 기울기가 이 각도(°)를 넘으면 SKIPPED (보정 불가)
    MAX_DESKEW_ANGLE_DEG: float = Field(default=45.0)
    # 이보다 작으면 회전 보정 생략 (미세 보간 노이즈 감소)
    MIN_DESKEW_ANGLE_DEG: float = Field(default=0.05)
    MAX_ANGLE_ERROR_DEG: float = Field(default=3.0)

    @field_validator("YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD", "YOLO_DEFECT_CONFIDENCE_THRESHOLD", mode="before")
    @classmethod
    def _empty_conf_to_none(cls, v: object) -> object:
        if v is None or v == "":
            return None
        return v

    @field_validator("YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD", "YOLO_DEFECT_CONFIDENCE_THRESHOLD")
    @classmethod
    def _stage_conf_range(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if not 0.0 <= float(v) <= 1.0:
            raise ValueError("Stage confidence must be between 0.0 and 1.0")
        return float(v)

    def effective_fiducial_confidence(self) -> float:
        if self.YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD is not None:
            return float(self.YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD)
        return float(self.YOLO_CONFIDENCE_THRESHOLD)

    def effective_defect_confidence(self) -> float:
        if self.YOLO_DEFECT_CONFIDENCE_THRESHOLD is not None:
            return float(self.YOLO_DEFECT_CONFIDENCE_THRESHOLD)
        return float(self.YOLO_CONFIDENCE_THRESHOLD)

    model_config = SettingsConfigDict(
        env_file=str(_SERVICE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# 싱글턴
settings = Settings()
