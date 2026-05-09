"""
Spring Boot 서버 전송 모듈

검사 완료 후 InspectionPacket을 JSON으로 직렬화하여
Spring Boot REST API(POST /api/inspections)로 전송한다.

재시도 로직:
  네트워크 불안정에 대비해 최대 3회 재시도하며,
  재시도 간격은 지수 백오프(1s → 2s → 4s)로 증가한다.
"""

import json
import logging
import mimetypes
import time
from pathlib import Path
from typing import Optional

import requests
from requests.exceptions import ConnectionError, Timeout, RequestException

from config.settings import settings
from models.schemas import InspectionPacket

logger = logging.getLogger(__name__)

# ── 전송 설정 상수 ────────────────────────────────────────────────────────────
MAX_RETRY = 3           # 최대 재시도 횟수
RETRY_BASE_DELAY = 1.0  # 첫 번째 재시도 대기 시간(초), 이후 2배씩 증가
REQUEST_TIMEOUT = 10    # HTTP 요청 타임아웃 (초)


class ServerSender:
    """
    Spring Boot 서버로 검사 결과를 전송하는 클래스.

    싱글턴 패턴은 아니지만 requests.Session을 재사용하여
    Keep-Alive 연결로 반복 전송 시 오버헤드를 줄인다.
    """

    def __init__(self, base_url: str = settings.SERVER_BASE_URL) -> None:
        # POST 엔드포인트 URL 조립
        self.endpoint = f"{base_url.rstrip('/')}/api/inspections"
        # Session 재사용: TCP 연결 유지 (Connection Keep-Alive)
        # multipart 업로드라 Content-Type 은 requests 가 boundary 와 함께 자동 설정.
        self._session = requests.Session()
        self._session.headers.update({
            "Accept":        "application/json",
            "X-Device-Type": "RaspberryPi5-EdgeNode",
        })
        logger.info("[전송] 서버 엔드포인트: %s", self.endpoint)

    # ── 전송 메서드 ───────────────────────────────────────────────────────────

    def send(self, packet: InspectionPacket) -> Optional[dict]:
        """
        InspectionPacket 을 multipart/form-data 로 서버에 POST 전송한다.

        파트 구성:
          - metadata : InspectionPacket camelCase JSON 텍스트 (application/json)
          - image    : 캡처 이미지 바이너리 (선택, image_path 가 실제 파일을 가리킬 때만)

        재시도 로직:
          - ConnectionError / Timeout: 지수 백오프 후 재시도
          - 응답 4xx: 즉시 실패 (재시도 안 함)
          - 응답 5xx: 재시도

        Returns:
            성공 시 서버 응답 JSON, 실패 시 None
        """
        payload = packet.to_server_json()
        logger.info("[전송] 전송 시작 — 디바이스: %s, 결과: %s",
                    packet.device_id, packet.result.value)
        logger.debug("[전송] 페이로드: %s", payload)

        last_exception: Optional[Exception] = None

        for attempt in range(1, MAX_RETRY + 1):
            try:
                multipart = self._build_multipart(packet, payload)
                response = self._session.post(
                    self.endpoint,
                    files=multipart,
                    timeout=REQUEST_TIMEOUT,
                )

                # 4xx 클라이언트 오류 → 재시도 없이 즉시 실패 처리
                if 400 <= response.status_code < 500:
                    logger.error(
                        "[전송] 클라이언트 오류 %d — 재시도 안함: %s",
                        response.status_code, response.text[:200]
                    )
                    return None

                # 5xx 서버 오류 → 재시도
                if response.status_code >= 500:
                    logger.warning(
                        "[전송] 서버 오류 %d (시도 %d/%d): %s",
                        response.status_code, attempt, MAX_RETRY, response.text[:500]
                    )
                    raise RequestException(f"서버 오류: {response.status_code}")

                # 201 Created 성공
                logger.info(
                    "[전송] 성공 (시도 %d/%d) — 응답 코드: %d, 저장 ID: %s",
                    attempt, MAX_RETRY, response.status_code,
                    response.json().get("id", "N/A")
                )
                return response.json()

            except (ConnectionError, Timeout) as e:
                last_exception = e
                logger.warning(
                    "[전송] 연결 실패 (시도 %d/%d): %s",
                    attempt, MAX_RETRY, type(e).__name__
                )

            except RequestException as e:
                last_exception = e
                logger.warning("[전송] 요청 오류 (시도 %d/%d): %s", attempt, MAX_RETRY, e)

            # 마지막 시도가 아니면 지수 백오프 대기
            if attempt < MAX_RETRY:
                delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))  # 1s, 2s, 4s
                logger.info("[전송] %.1f초 후 재시도...", delay)
                time.sleep(delay)

        logger.error(
            "[전송] 최종 실패 — %d회 시도 후 서버에 전달하지 못했습니다. 마지막 오류: %s",
            MAX_RETRY, last_exception
        )
        return None

    def _build_multipart(self, packet: InspectionPacket, payload: dict) -> list[tuple]:
        """
        requests `files` 인자에 넘길 multipart 파트 목록을 만든다.

        - metadata: InspectionPacket camelCase JSON 텍스트 (application/json)
        - image: packet.image_path 가 실제 파일을 가리킬 때만 포함
        """
        parts: list[tuple] = [
            ("metadata", (None, json.dumps(payload, ensure_ascii=False), "application/json")),
        ]

        if packet.image_path:
            img_path = Path(packet.image_path)
            if img_path.is_file():
                content_type, _ = mimetypes.guess_type(img_path.name)
                if not content_type:
                    content_type = "image/jpeg"
                # 파일 핸들은 requests 가 본 요청 후 close 처리.
                parts.append(
                    ("image", (img_path.name, img_path.open("rb"), content_type))
                )
            else:
                logger.warning("[전송] image_path 파일 없음 — 메타데이터만 전송: %s", img_path)

        return parts

    def close(self) -> None:
        """HTTP 세션을 닫는다. 애플리케이션 종료 시 호출."""
        self._session.close()
        logger.info("[전송] HTTP 세션 종료.")

    def __del__(self):
        self.close()


# ── 더미 패킷 생성 유틸리티 (개발/테스트용) ──────────────────────────────────

def create_dummy_packet(
    device_id: str = "RPI5-LINE-A",
    force_fail: bool = False,
    force_pass: bool = False,
) -> InspectionPacket:
    """
    Step 3 테스트용 더미 InspectionPacket을 생성한다.

    실제 카메라/YOLO 없이 서버 연동을 확인할 때 사용.
    main.py의 더미 모드에서 호출된다.

    Args:
        force_fail: True면 무조건 FAIL 결과 생성 (시연용)
        force_pass: True면 무조건 PASS 결과 생성 (시연용)

    Returns:
        더미 검사 결과 패킷
    """
    from datetime import datetime
    from models.schemas import DefectPayload, InspectionResult
    import random

    if force_fail:
        is_pass = False
    elif force_pass:
        is_pass = True
    else:
        # 70% 확률 PASS, 30% 확률 FAIL
        is_pass = random.random() > 0.3
    result = InspectionResult.PASS if is_pass else InspectionResult.FAIL

    defects = []
    if not is_pass:
        # FAIL인 경우 더미 결함 1~2개 생성
        num_defects = random.randint(1, 2)
        defect_types = ["TRACE_OPEN", "METAL_DAMAGE"]
        for i in range(num_defects):
            defects.append(DefectPayload(
                defect_type=random.choice(defect_types),
                confidence=round(random.uniform(0.6, 0.95), 2),
                bbox_x=random.randint(200, 800),
                bbox_y=random.randint(100, 500),
                bbox_width=random.randint(30, 80),
                bbox_height=random.randint(20, 50),
            ))

    return InspectionPacket(
        device_id=device_id,
        result=result,
        fiducial1_x=320, fiducial1_y=240,
        fiducial2_x=960, fiducial2_y=242,
        fiducial1_confidence=round(random.uniform(0.82, 0.96), 3),
        fiducial2_confidence=round(random.uniform(0.82, 0.96), 3),
        angle_error_deg=round(random.uniform(0.1, 1.5), 2),
        inference_time_ms=random.randint(80, 200),
        total_time_ms=random.randint(200, 500),
        # 더미는 실제 파일이 없으므로 경로를 넣지 않음 (대시보드 깨진 이미지 방지)
        image_path=None,
        inspected_at=datetime.now(),
        defects=defects,
    )
