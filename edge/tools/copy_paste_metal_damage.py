"""
metal_damage Copy-Paste 증강기.

라벨링한 1장에서 까짐 박스를 잘라내고, 정상 PCB 사진의 PCB 영역에만
랜덤 위치/회전/밝기 변화를 주며 합성한다.
검은 배경에 결함이 붙는 사고를 막기 위해 PCB 마스크를 자동 추출한다.

사용:
    python edge/tools/copy_paste_metal_damage.py \
        --source-image training_data/metal_damage/images/KakaoTalk_Photo_*.jpeg \
        --source-label training_data/metal_damage/labels/4f4e4d0a-KakaoTalk_*.txt \
        --normal-image edge/captures/normal_pcb.jpeg \
        --output training_data/metal_damage_augmented \
        --count 200 \
        --patches-per-image 3
"""

import argparse
import random
from pathlib import Path

import cv2
import numpy as np


def extract_patches(image_path: Path, label_path: Path):
    """라벨 파일을 읽어 박스별 결함 패치 + 박스 절대좌표를 잘라낸다."""
    img = cv2.imread(str(image_path))
    if img is None:
        raise RuntimeError(f"이미지 못 읽음: {image_path}")
    h, w = img.shape[:2]

    patches = []
    src_boxes = []  # 원본 박스 (x1,y1,x2,y2) — 합성 시 겹침 회피용
    with label_path.open() as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            cx, cy, bw, bh = map(float, parts[1:5])
            x1 = max(0, int((cx - bw / 2) * w))
            y1 = max(0, int((cy - bh / 2) * h))
            x2 = min(w, int((cx + bw / 2) * w))
            y2 = min(h, int((cy + bh / 2) * h))
            if x2 <= x1 or y2 <= y1:
                continue
            patch = img[y1:y2, x1:x2].copy()
            patches.append(patch)
            src_boxes.append((x1, y1, x2, y2))
    return patches, src_boxes


def compute_pcb_mask(normal_img: np.ndarray) -> np.ndarray:
    """검은 배경을 제외한 PCB 영역 마스크 (이진).

    PCB 표면은 녹색(G 채널 우세) 또는 금속색, 배경은 무채색 회색/검정 → S 채널이
    명확히 다르다. HSV S 채널 + V 채널 (밝기) 둘 다 본 뒤 OR.
    """
    hsv = cv2.cvtColor(normal_img, cv2.COLOR_BGR2HSV)
    s = hsv[..., 1]
    v = hsv[..., 2]
    # S(채도) 가 일정 이상 = 컬러가 있는 PCB
    _, mask_s = cv2.threshold(s, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # 어두운 그림자 영역은 V 로 보강 컷
    _, mask_v = cv2.threshold(v, 60, 255, cv2.THRESH_BINARY)
    mask = cv2.bitwise_and(mask_s, mask_v)
    # 가장 큰 연결요소만 남기고 구멍 메우기
    kernel = np.ones((25, 25), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    # 가장 큰 컴포넌트만
    n, lbl, stats, _ = cv2.connectedComponentsWithStats(mask)
    if n > 1:
        largest = 1 + int(stats[1:, cv2.CC_STAT_AREA].argmax())
        mask = ((lbl == largest).astype(np.uint8)) * 255
    return mask


def random_pcb_position(mask: np.ndarray, patch_h: int, patch_w: int, max_tries: int = 50):
    """패치 중심이 PCB 영역 안에 들어가는 랜덤 좌표."""
    h, w = mask.shape[:2]
    margin_x = patch_w // 2 + 5
    margin_y = patch_h // 2 + 5
    for _ in range(max_tries):
        cx = random.randint(margin_x, w - margin_x)
        cy = random.randint(margin_y, h - margin_y)
        # 패치 4개 모서리가 모두 PCB 영역인지
        x1, y1 = cx - patch_w // 2, cy - patch_h // 2
        x2, y2 = cx + patch_w // 2, cy + patch_h // 2
        if (mask[y1, x1] > 0 and mask[y1, x2 - 1] > 0
                and mask[y2 - 1, x1] > 0 and mask[y2 - 1, x2 - 1] > 0):
            return cx, cy
    return None


def augment_patch(patch: np.ndarray) -> np.ndarray:
    """패치 회전·밝기·크기 변화. 너무 작으면 어차피 학습 안 되므로 확대 위주."""
    h, w = patch.shape[:2]

    # 1) 확대 위주 (1.2~2.0x). 원본이 작은(40~80px) 박스라 키워야 학습 가능
    scale = random.uniform(1.2, 2.0)
    new_w, new_h = max(8, int(w * scale)), max(8, int(h * scale))
    patch = cv2.resize(patch, (new_w, new_h))

    # 2) 90도 단위 회전 (자연스러움 보장)
    rot = random.choice([0, 1, 2, 3])
    if rot > 0:
        patch = np.rot90(patch, rot).copy()

    # 3) 밝기 (±20)
    delta = random.uniform(-20, 20)
    patch = np.clip(patch.astype(np.int16) + delta, 0, 255).astype(np.uint8)

    return patch


def paste_with_blend(background: np.ndarray, patch: np.ndarray, cx: int, cy: int):
    """결함 텍스처를 살리기 위해 hard copy + 가장자리만 살짝 페이드."""
    ph, pw = patch.shape[:2]
    bh, bw = background.shape[:2]

    x1 = max(0, cx - pw // 2)
    y1 = max(0, cy - ph // 2)
    x2 = min(bw, x1 + pw)
    y2 = min(bh, y1 + ph)
    patch_crop = patch[: y2 - y1, : x2 - x1]

    # 알파 마스크 — 가운데는 1.0(완전 패치), 가장자리 5px 만 페이드
    fade = 5
    ah, aw = y2 - y1, x2 - x1
    alpha = np.ones((ah, aw), dtype=np.float32)
    if ah > 2 * fade and aw > 2 * fade:
        # 가장자리만 cosine 페이드
        for i in range(fade):
            t = (i + 1) / (fade + 1)
            alpha[i, :] = t; alpha[ah - 1 - i, :] = t
            alpha[:, i] = np.minimum(alpha[:, i], t)
            alpha[:, aw - 1 - i] = np.minimum(alpha[:, aw - 1 - i], t)
    alpha = alpha[..., None]

    result = background.copy()
    result[y1:y2, x1:x2] = (
        result[y1:y2, x1:x2].astype(np.float32) * (1 - alpha)
        + patch_crop.astype(np.float32) * alpha
    ).astype(np.uint8)

    return result, (x1, y1, x2, y2)


def boxes_overlap(b1, b2, margin: int = 5) -> bool:
    """두 박스가 겹치는지 (margin 만큼 여유)."""
    return not (
        b1[2] + margin < b2[0]
        or b2[2] + margin < b1[0]
        or b1[3] + margin < b2[1]
        or b2[3] + margin < b1[1]
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-image", required=True, help="라벨링한 결함 사진")
    ap.add_argument("--source-label", required=True, help="해당 YOLO 라벨")
    ap.add_argument("--normal-image", required=True, help="정상 PCB 사진")
    ap.add_argument("--output", required=True, help="출력 폴더")
    ap.add_argument("--count", type=int, default=200, help="생성할 합성 사진 수")
    ap.add_argument("--patches-per-image", type=int, default=3,
                    help="사진당 붙일 결함 박스 수 (랜덤)")
    ap.add_argument("--val-ratio", type=float, default=0.1, help="val 비율 (0~1)")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)

    source_image = Path(args.source_image)
    source_label = Path(args.source_label)
    normal_image = Path(args.normal_image)
    output = Path(args.output)

    print(f"=== Copy-Paste metal_damage 증강 ===")
    print(f"  원본 결함: {source_image.name}")
    print(f"  정상 PCB: {normal_image.name}")
    print(f"  생성 수: {args.count}장 (val {int(args.count * args.val_ratio)}장 포함)")
    print(f"  사진당 결함: 1~{args.patches_per_image}개")

    patches, src_boxes = extract_patches(source_image, source_label)
    print(f"  결함 패치 추출: {len(patches)}개")
    if not patches:
        print("  결함 패치 없음 — 종료")
        return

    normal = cv2.imread(str(normal_image))
    bh, bw = normal.shape[:2]
    pcb_mask = compute_pcb_mask(normal)
    pcb_ratio = (pcb_mask > 0).mean() * 100
    print(f"  PCB 영역: {pcb_ratio:.1f}% (붙일 가능 영역)")

    # source_image == normal_image 일 때 (= 같은 사진을 배경으로 재사용)
    # 원본 박스가 이미 사진에 들어있으므로 합성 라벨에도 포함해야 한다
    same_image = source_image.resolve() == normal_image.resolve()
    if same_image:
        print(f"  source==normal 감지 → 원본 박스 {len(src_boxes)}개를 합성 라벨에 포함")

    # 출력 폴더 — train/val 분리
    for split in ("train", "val"):
        (output / "images" / split).mkdir(parents=True, exist_ok=True)
        (output / "labels" / split).mkdir(parents=True, exist_ok=True)

    n_val = int(args.count * args.val_ratio)
    skipped = 0
    for idx in range(args.count):
        split = "val" if idx < n_val else "train"
        result = normal.copy()
        # 같은 사진 재사용 시 원본 박스부터 회피 목록에 추가
        boxes = list(src_boxes) if same_image else []
        n_patches = random.randint(1, args.patches_per_image)
        added = 0
        for _ in range(n_patches):
            patch = augment_patch(random.choice(patches))
            ph, pw = patch.shape[:2]
            pos = random_pcb_position(pcb_mask, ph, pw)
            if pos is None:
                continue
            cx, cy = pos
            new_box = (cx - pw // 2, cy - ph // 2, cx + pw // 2, cy + ph // 2)
            if any(boxes_overlap(new_box, b) for b in boxes):
                continue
            result, bbox = paste_with_blend(result, patch, cx, cy)
            boxes.append(bbox)
            added += 1

        # 합성한 박스가 0개면 그냥 원본 사진을 복사한 셈이라 스킵
        if added == 0:
            skipped += 1
            continue

        # YOLO 라벨 — 원본 박스 + 새로 합성한 박스 둘 다 포함
        lines = []
        for (x1, y1, x2, y2) in boxes:
            cx_n = ((x1 + x2) / 2) / bw
            cy_n = ((y1 + y2) / 2) / bh
            w_n = (x2 - x1) / bw
            h_n = (y2 - y1) / bh
            lines.append(f"0 {cx_n:.6f} {cy_n:.6f} {w_n:.6f} {h_n:.6f}")

        name = f"synth_{idx:04d}"
        cv2.imwrite(str(output / "images" / split / f"{name}.jpg"), result,
                    [cv2.IMWRITE_JPEG_QUALITY, 92])
        (output / "labels" / split / f"{name}.txt").write_text("\n".join(lines))

    # 원본 라벨링 사진도 학습셋에 포함 (실제 결함이라 매우 중요)
    real_img = cv2.imread(str(source_image))
    h, w = real_img.shape[:2]
    real_lines = []
    with source_label.open() as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            # 첫 번째 열을 0으로 강제 (단일 클래스)
            real_lines.append(f"0 " + " ".join(parts[1:5]))
    cv2.imwrite(str(output / "images" / "train" / "real_001.jpg"), real_img,
                [cv2.IMWRITE_JPEG_QUALITY, 95])
    (output / "labels" / "train" / "real_001.txt").write_text("\n".join(real_lines))

    # data.yaml
    yaml = f"""path: {output.absolute()}
train: images/train
val: images/val

names:
  0: metal_damage
"""
    (output / "data.yaml").write_text(yaml)

    n_train = len(list((output / "images" / "train").glob("*.jpg")))
    n_val_actual = len(list((output / "images" / "val").glob("*.jpg")))
    print(f"\n완료 — 합성 실패(스킵): {skipped}장")
    print(f"  train: {n_train}장 (실제 1장 포함)")
    print(f"  val:   {n_val_actual}장")
    print(f"  data.yaml: {output / 'data.yaml'}")


if __name__ == "__main__":
    main()
