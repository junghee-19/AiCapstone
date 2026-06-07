"""
정상 샘플 기준 부품 누락 검증 (위치 기반 Position Check).

흐름:
  1. 정상 샘플 한 장을 등록 → fiducial 2개 + 모든 부품 박스를 JSON 으로 저장
  2. 검사 시:
     - 현재 fiducial 2개 와 레퍼런스 fiducial 2개로 similarity transform 계산
     - 레퍼런스의 각 부품 위치를 현재 이미지 좌표로 변환
     - 변환된 위치 ± tolerance 안에 같은 클래스 검출이 있으면 OK
     - 없으면 MISSING 합성 결함으로 추가하고 FAIL 강제

좌표계가 fiducial 기준으로 정규화되므로 기판이 회전·이동·확대돼도 작동.
"""

from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Optional

from models.schemas import AlignmentResult, BoundingBox, DefectPayload, DetectionItem, InspectionPacket

logger = logging.getLogger(__name__)


def _bbox_to_dict(bbox: BoundingBox) -> dict:
    return {"x": bbox.x, "y": bbox.y, "width": bbox.width, "height": bbox.height}


def save_reference(
    profile_path: Path,
    *,
    device_id: str,
    image_path: Optional[str],
    alignment: AlignmentResult,
    detections: list[DetectionItem],
) -> dict:
    """현재 검사 결과를 정상 샘플 레퍼런스로 저장."""
    if alignment.fiducial1 is None or alignment.fiducial2 is None:
        raise ValueError("fiducial 2개 모두 검출된 상태에서만 레퍼런스로 등록할 수 있습니다.")

    components = []
    for d in detections:
        if "fiducial" in d.defect_type.lower():
            continue  # fiducial 자체는 reference fiducial 로 따로 보관
        components.append({
            "class": d.defect_type,
            "confidence": d.confidence,
            "bbox": _bbox_to_dict(d.bbox),
        })

    payload = {
        "device_id": device_id,
        "image_path": image_path,
        "fiducial1": {
            "x": alignment.fiducial1.center_x,
            "y": alignment.fiducial1.center_y,
        },
        "fiducial2": {
            "x": alignment.fiducial2.center_x,
            "y": alignment.fiducial2.center_y,
        },
        "components": components,
    }

    profile_path.parent.mkdir(parents=True, exist_ok=True)
    profile_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(
        "[레퍼런스] 저장 완료 — %s (fiducial 2개, components %d개)",
        profile_path,
        len(components),
    )
    return payload


def load_reference(profile_path: Path) -> Optional[dict]:
    """저장된 레퍼런스 로드. 파일 없으면 None."""
    if not profile_path.exists():
        return None
    try:
        return json.loads(profile_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error("[레퍼런스] 로드 실패: %s", e)
        return None


def _similarity_transform(
    ref_f1: tuple[float, float],
    ref_f2: tuple[float, float],
    cur_f1: tuple[float, float],
    cur_f2: tuple[float, float],
):
    """
    레퍼런스 좌표 (x, y) 를 현재 이미지 좌표로 변환하는 함수를 반환.

    F1_ref→F1_cur, F2_ref→F2_cur 매핑을 만족하는 similarity
    (translation + rotation + scale) 변환을 닫힌 형태로 계산한다.
    """
    rx1, ry1 = ref_f1
    rx2, ry2 = ref_f2
    cx1, cy1 = cur_f1
    cx2, cy2 = cur_f2

    ref_dx, ref_dy = rx2 - rx1, ry2 - ry1
    cur_dx, cur_dy = cx2 - cx1, cy2 - cy1
    ref_len = math.hypot(ref_dx, ref_dy)
    cur_len = math.hypot(cur_dx, cur_dy)
    if ref_len < 1e-6 or cur_len < 1e-6:
        # 두 fiducial 이 거의 겹친 비정상 — identity 폴백
        return lambda x, y: (x, y)

    scale = cur_len / ref_len
    ref_angle = math.atan2(ref_dy, ref_dx)
    cur_angle = math.atan2(cur_dy, cur_dx)
    delta_angle = cur_angle - ref_angle
    cos_a = math.cos(delta_angle)
    sin_a = math.sin(delta_angle)

    def transform(x: float, y: float) -> tuple[float, float]:
        # 1) 레퍼런스 F1 원점으로 이동
        ox = x - rx1
        oy = y - ry1
        # 2) 회전 + 스케일
        nx = scale * (cos_a * ox - sin_a * oy)
        ny = scale * (sin_a * ox + cos_a * oy)
        # 3) 현재 F1 원점으로 이동
        return nx + cx1, ny + cy1

    return transform


def _transform_bbox(bbox: dict, transform) -> dict[str, float]:
    x = float(bbox.get("x", 0.0))
    y = float(bbox.get("y", 0.0))
    w = float(bbox.get("width", 0.0))
    h = float(bbox.get("height", 0.0))
    points = [
        transform(x, y),
        transform(x + w, y),
        transform(x + w, y + h),
        transform(x, y + h),
    ]
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    return {
        "x": min_x,
        "y": min_y,
        "width": max(1.0, max_x - min_x),
        "height": max(1.0, max_y - min_y),
    }


def _bbox_iou(a: dict[str, float], b: BoundingBox) -> float:
    ax1 = float(a["x"])
    ay1 = float(a["y"])
    ax2 = ax1 + float(a["width"])
    ay2 = ay1 + float(a["height"])
    bx1 = b.x
    by1 = b.y
    bx2 = b.x + b.width
    by2 = b.y + b.height

    inter_w = max(0.0, min(ax2, bx2) - max(ax1, bx1))
    inter_h = max(0.0, min(ay2, by2) - max(ay1, by1))
    inter = inter_w * inter_h
    if inter <= 0:
        return 0.0

    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _center_in_expanded_bbox(detection: DetectionItem, expected_bbox: dict[str, float], tolerance_px: float) -> bool:
    x1 = float(expected_bbox["x"]) - tolerance_px
    y1 = float(expected_bbox["y"]) - tolerance_px
    x2 = float(expected_bbox["x"]) + float(expected_bbox["width"]) + tolerance_px
    y2 = float(expected_bbox["y"]) + float(expected_bbox["height"]) + tolerance_px
    return x1 <= detection.center_x <= x2 and y1 <= detection.center_y <= y2


def _reference_components(reference: dict) -> list[dict]:
    return [
        c for c in reference.get("components", [])
        if "fiducial" not in str(c.get("class", "")).lower()
    ]


def _is_orientation_class(class_name: str) -> bool:
    name = class_name.lower()
    return any(
        key in name
        for key in (
            "model_name",
            "g_series",
            "name_zone",
            "edge_connector",
            "connector_zone",
            "board_id",
        )
    )


def _choose_rotated_orientation(
    *,
    components: list[dict],
    by_class: dict[str, list[DetectionItem]],
    transform,
    transform_180,
    tolerance_px: float,
    normal_matched: int,
    normal_distance: float,
    rotated_matched: int,
    rotated_distance: float,
) -> bool:
    orientation_components = [
        c for c in components
        if _is_orientation_class(str(c.get("class", "")))
    ]
    detected_orientation_components = [
        c for c in orientation_components
        if by_class.get(str(c.get("class", "")).lower())
    ]

    if detected_orientation_components:
        _, normal_dir_matched, normal_dir_distance = _match_reference_components(
            detected_orientation_components,
            by_class,
            transform,
            tolerance_px,
            "normal_direction",
        )
        _, rotated_dir_matched, rotated_dir_distance = _match_reference_components(
            detected_orientation_components,
            by_class,
            transform_180,
            tolerance_px,
            "rotated_180_direction",
        )
        logger.info(
            "[위치검증] orientation 방향성 클래스 점수: normal=%d match, %.1fpx / rotated_180=%d match, %.1fpx",
            normal_dir_matched,
            normal_dir_distance,
            rotated_dir_matched,
            rotated_dir_distance,
        )
        if rotated_dir_matched != normal_dir_matched:
            return rotated_dir_matched > normal_dir_matched
        if rotated_dir_matched > 0 and rotated_dir_distance != normal_dir_distance:
            return rotated_dir_distance < normal_dir_distance

    # 대칭 클래스(IC, hole, SMD array 등)만으로 180도 선택이 뒤집히지 않도록 보수적으로 판단한다.
    if rotated_matched >= normal_matched + 2:
        return True
    if (
        rotated_matched == normal_matched
        and rotated_matched > 0
        and normal_distance > 0
        and rotated_distance < normal_distance * 0.75
    ):
        return True
    return False


def _assign_one_to_one_matches(
    pair_candidates: list[tuple[float, float, int, int]],
) -> dict[int, tuple[int, float, float]]:
    refs = sorted({ref_idx for _, _, ref_idx, _ in pair_candidates})
    dets = sorted({det_idx for _, _, _, det_idx in pair_candidates})

    # Small per-class groups should maximize match cardinality before minimizing distance.
    # If a class unexpectedly produces too many candidates, keep the bounded greedy fallback.
    if len(dets) > 20:
        assigned: dict[int, tuple[int, float, float]] = {}
        used_refs: set[int] = set()
        used_detections: set[int] = set()
        for dist, neg_iou, ref_idx, det_idx in sorted(pair_candidates):
            if ref_idx in used_refs or det_idx in used_detections:
                continue
            used_refs.add(ref_idx)
            used_detections.add(det_idx)
            assigned[ref_idx] = (det_idx, dist, -neg_iou)
        return assigned

    det_to_bit = {det_idx: bit for bit, det_idx in enumerate(dets)}
    candidates_by_ref: dict[int, list[tuple[float, float, int]]] = {
        ref_idx: []
        for ref_idx in refs
    }
    for dist, neg_iou, ref_idx, det_idx in pair_candidates:
        candidates_by_ref.setdefault(ref_idx, []).append((dist, neg_iou, det_idx))
    for candidates in candidates_by_ref.values():
        candidates.sort()

    from functools import lru_cache

    @lru_cache(maxsize=None)
    def best_from(pos: int, used_mask: int) -> tuple[tuple[int, float, float], tuple[tuple[int, int, float, float], ...]]:
        if pos >= len(refs):
            return (0, 0.0, 0.0), ()

        ref_idx = refs[pos]
        best_score, best_pairs = best_from(pos + 1, used_mask)

        for dist, neg_iou, det_idx in candidates_by_ref.get(ref_idx, []):
            bit = 1 << det_to_bit[det_idx]
            if used_mask & bit:
                continue
            next_score, next_pairs = best_from(pos + 1, used_mask | bit)
            iou = -neg_iou
            score = (
                next_score[0] + 1,
                next_score[1] - dist,
                next_score[2] + iou,
            )
            if score > best_score:
                best_score = score
                best_pairs = ((ref_idx, det_idx, dist, iou),) + next_pairs

        return best_score, best_pairs

    _, pairs = best_from(0, 0)
    return {
        ref_idx: (det_idx, dist, iou)
        for ref_idx, det_idx, dist, iou in pairs
    }


def _match_reference_components(
    components: list[dict],
    by_class: dict[str, list[DetectionItem]],
    transform,
    tolerance_px: float,
    orientation_label: str,
) -> tuple[list[DefectPayload], int, float]:
    missing: list[DefectPayload] = []
    matched = 0
    total_distance = 0.0

    refs_by_class: dict[str, list[dict]] = {}
    for idx, ref_comp in enumerate(components):
        cls = str(ref_comp.get("class", "")).lower()
        bbox = ref_comp.get("bbox", {})
        rx = float(bbox.get("x", 0.0)) + float(bbox.get("width", 0.0)) / 2.0
        ry = float(bbox.get("y", 0.0)) + float(bbox.get("height", 0.0)) / 2.0
        ex_x, ex_y = transform(rx, ry)
        expected_bbox = _transform_bbox(bbox, transform)
        refs_by_class.setdefault(cls, []).append({
            "index": idx,
            "component": ref_comp,
            "center": (ex_x, ex_y),
            "expected_bbox": expected_bbox,
        })

    for cls, refs in refs_by_class.items():
        candidates = by_class.get(cls, [])
        pair_candidates: list[tuple[float, float, int, int]] = []
        nearest: dict[int, tuple[float, float, Optional[float], Optional[float]]] = {
            ref_idx: (float("inf"), 0.0, None, None)
            for ref_idx in range(len(refs))
        }

        for ref_idx, ref_data in enumerate(refs):
            ex_x, ex_y = ref_data["center"]
            expected_bbox = ref_data["expected_bbox"]
            for det_idx, d in enumerate(candidates):
                dist = math.hypot(d.center_x - ex_x, d.center_y - ex_y)
                iou = _bbox_iou(expected_bbox, d.bbox)
                if dist < nearest[ref_idx][0]:
                    nearest[ref_idx] = (dist, iou, d.center_x, d.center_y)
                center_in_expected = _center_in_expanded_bbox(d, expected_bbox, tolerance_px)
                location_matches = center_in_expected or iou >= 0.02 or dist <= tolerance_px
                if location_matches:
                    pair_candidates.append((dist, -iou, ref_idx, det_idx))

        assigned = _assign_one_to_one_matches(pair_candidates)

        for ref_idx, ref_data in enumerate(refs):
            ex_x, ex_y = ref_data["center"]
            expected_bbox = ref_data["expected_bbox"]
            ref_comp = ref_data["component"]
            bbox = ref_comp.get("bbox", {})

            if ref_idx in assigned:
                _, best_dist, best_iou = assigned[ref_idx]
                matched += 1
                total_distance += best_dist
                logger.debug(
                    "[reference] matched orientation=%s class=%s expected=(%.0f,%.0f) dist=%.1fpx iou=%.3f",
                    orientation_label,
                    cls,
                    ex_x,
                    ex_y,
                    best_dist,
                    best_iou,
                )
                continue

            nearest_dist, nearest_iou, nearest_x, nearest_y = nearest[ref_idx]
            nearest_at = (
                f"({nearest_x:.0f},{nearest_y:.0f})"
                if nearest_x is not None and nearest_y is not None
                else "none"
            )
            logger.debug(
                "[reference] missing candidate orientation=%s class=%s expected=(%.0f,%.0f), nearest_at=%s nearest=%.1fpx tolerance=%.1fpx iou=%.3f",
                orientation_label, cls, ex_x, ex_y, nearest_at, nearest_dist, tolerance_px, nearest_iou,
            )
            size_w = max(20.0, float(expected_bbox.get("width", bbox.get("width", 30.0))))
            size_h = max(20.0, float(expected_bbox.get("height", bbox.get("height", 30.0))))
            missing.append(DefectPayload(
                defect_type=f"MISSING:{cls}:expected_at=({ex_x:.0f},{ex_y:.0f}),nearest_at={nearest_at},nearest={nearest_dist:.1f}px,iou={nearest_iou:.3f}",
                confidence=1.0,
                bbox_x=max(0.0, float(expected_bbox.get("x", ex_x - size_w / 2.0))),
                bbox_y=max(0.0, float(expected_bbox.get("y", ex_y - size_h / 2.0))),
                bbox_width=size_w,
                bbox_height=size_h,
            ))

    return missing, matched, total_distance


def check_missing_components(
    reference: dict,
    *,
    current_alignment: AlignmentResult,
    current_detections: list[DetectionItem],
    tolerance_px: float,
) -> list[DefectPayload]:
    """
    레퍼런스 부품 위치를 현재 이미지로 투영하고, 매칭되는 검출이 없으면 MISSING 으로 반환.

    Args:
        reference: load_reference() 결과
        current_alignment: 현재 검사의 정렬 정보 (fiducial 2개 필요)
        current_detections: 현재 Stage 2 검출 (fiducial 제외)
        tolerance_px: 매칭 허용 반경 (변환된 좌표 기준)

    Returns:
        MISSING DefectPayload 목록 (없으면 빈 리스트)
    """
    if current_alignment.fiducial1 is None or current_alignment.fiducial2 is None:
        logger.warning("[레퍼런스] 현재 fiducial 부족 — 위치 검증 건너뜀")
        return []

    ref_f1 = (reference["fiducial1"]["x"], reference["fiducial1"]["y"])
    ref_f2 = (reference["fiducial2"]["x"], reference["fiducial2"]["y"])
    cur_f1 = (current_alignment.fiducial1.center_x, current_alignment.fiducial1.center_y)
    cur_f2 = (current_alignment.fiducial2.center_x, current_alignment.fiducial2.center_y)

    transform = _similarity_transform(ref_f1, ref_f2, cur_f1, cur_f2)
    transform_180 = _similarity_transform(ref_f1, ref_f2, cur_f2, cur_f1)

    # ── 디버그 — 변환 + 매칭 후보 풀 출력 ────────────────────────────────
    logger.info(
        "[위치검증][debug] ref_F1=%s ref_F2=%s cur_F1=%s cur_F2=%s",
        ref_f1, ref_f2, cur_f1, cur_f2,
    )
    tx, ty = transform(0.0, 0.0)
    tx1, ty1 = transform(100.0, 0.0)
    logger.info(
        "[위치검증][debug] transform 검증: (0,0)→(%.1f,%.1f), (100,0)→(%.1f,%.1f)",
        tx, ty, tx1, ty1,
    )

    # 같은 클래스의 검출만 매칭 후보 — 클래스별로 묶어두면 빠름
    by_class: dict[str, list[DetectionItem]] = {}
    for d in current_detections:
        cls = d.defect_type.lower()
        if "fiducial" in cls:
            continue
        by_class.setdefault(cls, []).append(d)

    logger.info(
        "[위치검증][debug] current detections by class: %s",
        {k: [(round(d.center_x, 1), round(d.center_y, 1)) for d in v] for k, v in by_class.items()},
    )
    components = _reference_components(reference)
    ref_classes: dict[str, int] = {}
    for c in components:
        cls = str(c["class"]).lower()
        ref_classes[cls] = ref_classes.get(cls, 0) + 1
    logger.info("[위치검증][debug] reference class counts: %s", ref_classes)
    normal_missing, normal_matched, normal_distance = _match_reference_components(
        components,
        by_class,
        transform,
        tolerance_px,
        "normal",
    )
    rotated_missing, rotated_matched, rotated_distance = _match_reference_components(
        components,
        by_class,
        transform_180,
        tolerance_px,
        "rotated_180",
    )
    use_rotated = _choose_rotated_orientation(
        components=components,
        by_class=by_class,
        transform=transform,
        transform_180=transform_180,
        tolerance_px=tolerance_px,
        normal_matched=normal_matched,
        normal_distance=normal_distance,
        rotated_matched=rotated_matched,
        rotated_distance=rotated_distance,
    )
    logger.info(
        "[위치검증] orientation 선택: %s (normal=%d match, %.1fpx / rotated_180=%d match, %.1fpx)",
        "rotated_180" if use_rotated else "normal",
        normal_matched,
        normal_distance,
        rotated_matched,
        rotated_distance,
    )
    return rotated_missing if use_rotated else normal_missing


def packet_components_for_save(packet: InspectionPacket) -> list[DetectionItem]:
    """InspectionPacket.defects → DetectionItem 리스트 (레퍼런스 저장용 변환).

    MISSING 합성 결함과 fiducial 은 제외.
    """
    items: list[DetectionItem] = []
    for d in packet.defects:
        if d.defect_type.startswith("MISSING:"):
            continue
        if "fiducial" in d.defect_type.lower():
            continue
        items.append(DetectionItem(
            defect_type=d.defect_type,
            confidence=d.confidence,
            bbox=BoundingBox(
                x=d.bbox_x, y=d.bbox_y,
                width=d.bbox_width, height=d.bbox_height,
            ),
        ))
    return items
