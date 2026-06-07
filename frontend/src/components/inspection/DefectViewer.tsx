/**
 * 검사 상세 뷰어 — 보정 전/후 이미지에 피듀셜(F1·F2)과 결함 박스를 오버레이한다.
 */

import { useRef, useState, useEffect, useMemo, type PointerEvent, type ReactNode } from 'react'
import { X, ImageOff, AlertCircle, Download, Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { useInspectionById } from '@/hooks/useInspectionData'
import type { DefectDetail, InspectionLog } from '@/types/inspection'
import {
  defectDisplayName,
  defectColor,
  isNormalComponentType,
  missingPositionOf,
  isCountOnlyMissing,
  missingClassOf,
  missingShortLabel,
  dedupeMissingReasons,
} from '@/types/inspection'

// ── 이미지 로드 전 기본값 (로드 후 naturalWidth/Height 사용) ───────────────
const DEFAULT_REF_WIDTH = 1920
const DEFAULT_REF_HEIGHT = 1080

// 리스트에서 선택한 부품 강조 색 — 부품 자체 색과 무관하게 항상 동일(눈에 잘 띄는 노랑)
const HIGHLIGHT_COLOR = '#facc15'

// 라벨 배경 바 크기용 — 실제 픽셀 폭을 캔버스로 측정한다.
// 글자 수 × 상수 추정은 한글(전각)·긴 라벨에서 틀어져 바가 글씨보다 작아진다.
let _measureCtx: CanvasRenderingContext2D | null = null
function measureTextWidth(text: string, font: string): number {
  if (typeof document !== 'undefined') {
    if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d')
    if (_measureCtx) {
      _measureCtx.font = font
      return _measureCtx.measureText(text).width
    }
  }
  // SSR·캔버스 미지원 폴백: 영문 6.6 / 전각(한글 등) 11px 가정
  let w = 0
  for (const ch of text) w += ch.charCodeAt(0) > 0x2e80 ? 11 : 6.6
  return w
}

/** F1·F2 중심 좌표가 모두 있을 때 화면 픽셀 기준 거리 */
function fiducialDistancePx(log: {
  fiducial1X: number | null
  fiducial1Y: number | null
  fiducial2X: number | null
  fiducial2Y: number | null
}): number | null {
  const { fiducial1X: x1, fiducial1Y: y1, fiducial2X: x2, fiducial2Y: y2 } = log
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null
  return Math.hypot(x2 - x1, y2 - y1)
}

interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isNormalComponent(d: DefectDetail): boolean {
  return isNormalComponentType(d.defectType)
}

/** 리스트 ↔ 오버레이 박스 매칭용 안정 키 (배열 인덱스에 의존하지 않음) */
function defectKey(d: DefectDetail): string {
  return `${d.defectType}|${d.bboxX}|${d.bboxY}|${d.bboxWidth}|${d.bboxHeight}`
}

function zoomedCrop(crop: CropRect, imageSize: { w: number; h: number }, zoom: number): CropRect {
  const imageW = Math.max(1, imageSize.w)
  const imageH = Math.max(1, imageSize.h)
  const safeZoom = clamp(zoom, 1, 4)
  const width = Math.max(1, Math.min(imageW, crop.width / safeZoom))
  const height = Math.max(1, Math.min(imageH, crop.height / safeZoom))
  const cx = crop.x + crop.width / 2
  const cy = crop.y + crop.height / 2
  return {
    x: clamp(cx - width / 2, 0, imageW - width),
    y: clamp(cy - height / 2, 0, imageH - height),
    width,
    height,
  }
}

function panCrop(crop: CropRect, imageSize: { w: number; h: number }, pan: { x: number; y: number }): CropRect {
  const imageW = Math.max(1, imageSize.w)
  const imageH = Math.max(1, imageSize.h)
  return {
    x: clamp(crop.x + pan.x, 0, Math.max(0, imageW - crop.width)),
    y: clamp(crop.y + pan.y, 0, Math.max(0, imageH - crop.height)),
    width: crop.width,
    height: crop.height,
  }
}

function buildPcbCrop(log: InspectionLog, imageSize: { w: number; h: number }): CropRect {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const addBox = (x: number, y: number, w: number, h: number) => {
    if (![x, y, w, h].every(Number.isFinite) || w <= 1 || h <= 1) return
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }

  const addPoint = (x: number | null | undefined, y: number | null | undefined, pad = 46) => {
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return
    addBox(x - pad, y - pad, pad * 2, pad * 2)
  }

  log.defects.forEach((d) => {
    if (!isCountOnlyMissing(d.defectType)) {
      addBox(Number(d.bboxX), Number(d.bboxY), Number(d.bboxWidth), Number(d.bboxHeight))
    }
    const missingPosition = missingPositionOf(d.defectType)
    if (missingPosition) addPoint(missingPosition.x, missingPosition.y, 42)
  })
  addPoint(log.fiducial1X, log.fiducial1Y)
  addPoint(log.fiducial2X, log.fiducial2Y)

  const imageW = Math.max(1, imageSize.w)
  const imageH = Math.max(1, imageSize.h)
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return { x: 0, y: 0, width: imageW, height: imageH }
  }

  const contentW = maxX - minX
  const contentH = maxY - minY
  if (contentW < 40 || contentH < 40) {
    return { x: 0, y: 0, width: imageW, height: imageH }
  }

  const pad = Math.max(38, Math.max(contentW, contentH) * 0.14)
  minX = clamp(minX - pad, 0, imageW)
  minY = clamp(minY - pad, 0, imageH)
  maxX = clamp(maxX + pad, 0, imageW)
  maxY = clamp(maxY + pad, 0, imageH)

  const cropW = Math.max(1, maxX - minX)
  const cropH = Math.max(1, maxY - minY)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const x = clamp(cx - cropW / 2, 0, imageW - cropW)
  const y = clamp(cy - cropH / 2, 0, imageH - cropH)
  return { x, y, width: cropW, height: cropH }
}

/**
 * 엣지 `alignment.compute_alignment`: 피듀셜이 2개 미만이면 angle_error_deg = 999.
 * 이 경우 Stage2(결함) 검사는 실행되지 않으며, 결함 박스 데이터도 없다.
 */
function isFiducialAlignmentSentinel(log: InspectionLog): boolean {
  const a = log.angleErrorDeg
  return a != null && a >= 500
}

// ── 피듀셜/결함 오버레이 ───────────────────────────────────────────────────────

function FiducialMarker({
  x,
  y,
  label,
  confidence,
  scaleX,
  scaleY,
}: {
  x: number
  y: number
  label: string
  confidence: number | null | undefined
  scaleX: number
  scaleY: number
}) {
  const sx = x * scaleX
  const sy = y * scaleY
  const color = '#38bdf8'
  const gap = 5
  const arm = 16
  const cap =
    confidence != null && !Number.isNaN(confidence)
      ? `${label} ${(confidence * 100).toFixed(0)}%`
      : label
  const tw = Math.min(160, Math.max(44, cap.length * 6.2))
  const labelY = sy - 14

  return (
    <g>
      {/* 십자선 — 중앙은 비움 (실제 마크가 보이도록) */}
      <line
        x1={sx - arm}
        y1={sy}
        x2={sx - gap}
        y2={sy}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <line
        x1={sx + gap}
        y1={sy}
        x2={sx + arm}
        y2={sy}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <line
        x1={sx}
        y1={sy - arm}
        x2={sx}
        y2={sy - gap}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <line
        x1={sx}
        y1={sy + gap}
        x2={sx}
        y2={sy + arm}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <circle cx={sx} cy={sy} r={11} fill="none" stroke={color} strokeWidth={1.75} />
      {/* 라벨·신뢰도 — 마크 위쪽으로만 배치 (마크 가리지 않음) */}
      <rect
        x={sx - tw / 2}
        y={labelY - 12}
        width={tw}
        height={14}
        rx={4}
        fill="rgba(15,23,42,0.78)"
        stroke="rgba(56,189,248,0.5)"
        strokeWidth={1}
      />
      <text
        x={sx}
        y={labelY - 1}
        fill="#e0f2fe"
        fontSize={10}
        fontWeight={600}
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
      >
        {cap}
      </text>
      {/* 중심 좌표 (원본 픽셀) — 배경·큰 글자 */}
      <rect
        x={sx - 88}
        y={sy + arm + 2}
        width={176}
        height={28}
        rx={6}
        fill="rgba(15,23,42,0.95)"
        stroke="rgba(56,189,248,0.85)"
        strokeWidth={1.5}
      />
      <text
        x={sx}
        y={sy + arm + 21}
        fill="#f0f9ff"
        fontSize={14}
        fontWeight={700}
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
      >
        {`(${Math.round(x)}, ${Math.round(y)}) px`}
      </text>
    </g>
  )
}

function DefectBox({
  x,
  y,
  w,
  h,
  label,
  confidence,
  color,
  scaleX,
  scaleY,
  highlighted = false,
}: {
  x: number
  y: number
  w: number
  h: number
  label: string
  confidence: number
  color: string
  scaleX: number
  scaleY: number
  highlighted?: boolean
}) {
  const sx = x * scaleX
  const sy = y * scaleY
  const sw = Math.max(1, w * scaleX)
  const sh = Math.max(1, h * scaleY)
  const cap = `${label} ${(confidence * 100).toFixed(0)}%`
  // 실제 글씨 폭 + 좌우 여백(좌 6 / 우 6) — 한글·긴 라벨도 바가 글씨를 다 덮음
  const tw = Math.ceil(measureTextWidth(cap, '700 11px ui-monospace, monospace')) + 12
  const ty = sy > 22 ? sy - 21 : sy + 3
  const haloPad = 7

  return (
    <g>
      {/* 선택 강조 — 부품 색과 무관한 고정 색(HIGHLIGHT_COLOR)으로 글로우 헤일로 + 반투명 채움 */}
      {highlighted && (
        <rect
          x={sx - haloPad}
          y={sy - haloPad}
          width={sw + haloPad * 2}
          height={sh + haloPad * 2}
          rx={4}
          fill={HIGHLIGHT_COLOR}
          fillOpacity={0.2}
          stroke={HIGHLIGHT_COLOR}
          strokeOpacity={0.65}
          strokeWidth={6}
        />
      )}
      <rect
        x={sx}
        y={sy}
        width={sw}
        height={sh}
        rx={2}
        fill="none"
        stroke={highlighted ? HIGHLIGHT_COLOR : color}
        strokeWidth={highlighted ? 3.5 : 2}
      />
      <rect x={sx} y={ty} width={tw} height={17} rx={4} fill="rgba(15,23,42,0.86)" stroke={color} strokeWidth={1.1} />
      <text
        x={sx + 6}
        y={ty + 12}
        fill={color}
        fontSize={11}
        fontWeight={700}
        fontFamily="ui-monospace, monospace"
      >
        {cap}
      </text>
    </g>
  )
}

function MissingBox({
  x,
  y,
  w,
  h,
  label,
  color,
  scaleX,
  scaleY,
}: {
  x: number
  y: number
  w: number
  h: number
  label: string
  color: string
  scaleX: number
  scaleY: number
}) {
  const sx = x * scaleX
  const sy = y * scaleY
  const sw = Math.max(16, w * scaleX)
  const sh = Math.max(16, h * scaleY)
  const cx = sx + sw / 2
  const cy = sy + sh / 2
  const cap = `정상 위치: ${label}`
  // 실제 글씨 폭 + 좌우 여백(좌 7 / 우 7)
  const tw = Math.ceil(measureTextWidth(cap, '800 11px ui-monospace, monospace')) + 14
  const ty = sy > 26 ? sy - 24 : sy + sh + 5

  return (
    <g>
      <rect
        x={sx}
        y={sy}
        width={sw}
        height={sh}
        rx={2}
        fill="rgba(248,113,113,0.16)"
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray="8 5"
      />
      <line x1={sx} y1={sy} x2={sx + sw} y2={sy + sh} stroke={color} strokeWidth={1.8} opacity={0.9} />
      <line x1={sx + sw} y1={sy} x2={sx} y2={sy + sh} stroke={color} strokeWidth={1.8} opacity={0.9} />
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="rgba(255,255,255,0.92)" strokeWidth={1.5} />
      <rect x={sx} y={ty} width={tw} height={19} rx={4} fill="rgba(127,29,29,0.9)" stroke={color} strokeWidth={1.1} />
      <text
        x={sx + 7}
        y={ty + 13}
        fill="#fee2e2"
        fontSize={11}
        fontWeight={800}
        fontFamily="ui-monospace, monospace"
      >
        {cap}
      </text>
    </g>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

interface DefectViewerProps {
  inspectionId: number
  onClose:      () => void
}

/**
 * 캡처 이미지 URL — Spring 백엔드가 제공하는 `imageUrl` 을 그대로 사용한다.
 * 절대 URL이면 그대로, 상대 경로(`/api/inspections/...`)면 axios baseURL 과 결합되어 fetch 됨.
 *
 * 구 이력 (imageUrl 없음, 옛 imagePath 만 존재) 호환은 `/captures/` 경로로 fallback.
 */
function resolveImageSrc(log: InspectionLog | null | undefined): string | null {
  if (!log) return null
  if (log.imageUrl && log.imageUrl.length > 0) return log.imageUrl

  const legacy = log.imagePath
  if (!legacy) return null
  const p = legacy.replace(/\\/g, '/')
  if (p.startsWith('http://') || p.startsWith('https://')) return p
  if (p.startsWith('/captures/')) return p
  if (p.startsWith('captures/')) return `/${p}`
  const idx = p.indexOf('/captures/')
  return idx >= 0 ? p.slice(idx) : p
}

function imageDownloadName(log: InspectionLog): string {
  const rawName = log.imagePath?.replace(/\\/g, '/').split('/').pop()
  if (rawName && rawName.includes('.')) return rawName

  const inspectedAt = log.inspectedAt
    ? new Date(log.inspectedAt).toISOString().replace(/[:.]/g, '-')
    : `inspection-${log.id}`
  return `inspection-${log.id}-${inspectedAt}.jpg`
}

function PanelBadge({ children }: { children: ReactNode }) {
  return (
    <span className="absolute top-2 left-2 z-10 text-[10px] font-semibold uppercase tracking-wide bg-white/90 text-Black-100% px-2 py-0.5 rounded border border-Black-10%">
      {children}
    </span>
  )
}

function OverlayToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const Icon = checked ? Eye : EyeOff
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs font-semibold transition-colors',
        checked
          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700'
          : 'border-Black-10% bg-white text-Black-60% hover:text-Black-100%',
      ].join(' ')}
      aria-pressed={checked}
    >
      <span>{label}</span>
      <Icon size={14} />
    </button>
  )
}

function ZoomButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-md border border-white/20 bg-Black-100%/80 text-white shadow-sm transition-colors hover:bg-Black-80% disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}

export default function DefectViewer({ inspectionId, onClose }: DefectViewerProps) {
  const { data: log, isLoading } = useInspectionById(inspectionId)
  const deskewSrc = resolveImageSrc(log)
  // raw/deskew 비교 패널은 단일 이미지 업로드 흐름으로 통합되며 더 이상 사용하지 않음.
  const rawSrc: string | null = null
  const showSideBySide = false
  const f12DistancePx = log != null ? fiducialDistancePx(log) : null
  const defects = log?.defects ?? []
  const detectedComponents = defects.filter((d) => !d.defectType.startsWith('MISSING:'))
  const normalComponents = detectedComponents.filter(isNormalComponent)
  const defectDetections = detectedComponents.filter((d) => !isNormalComponent(d))
  const missingReasons = defects.filter((d) => d.defectType.startsWith('MISSING:'))
  const displayMissingReasons = dedupeMissingReasons(missingReasons)
  const overlayMissing = missingReasons.filter((d) => !isCountOnlyMissing(d.defectType))
  const [showNormalLabels, setShowNormalLabels] = useState(true)
  const [showDefectLabels, setShowDefectLabels] = useState(true)
  const [showMissingLabels, setShowMissingLabels] = useState(true)
  /* 리스트에서 클릭해 강조 중인 정상 부품 (defectKey) */
  const [selectedComponentKey, setSelectedComponentKey] = useState<string | null>(null)
  const visibleNormalComponents = showNormalLabels ? normalComponents : []
  const visibleDefectDetections = showDefectLabels ? defectDetections : []
  const visibleMissing = showMissingLabels ? overlayMissing : []

  /* 오버레이는 보정 후 이미지 기준 */
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgSize, setImgSize] = useState({ w: DEFAULT_REF_WIDTH, h: DEFAULT_REF_HEIGHT })
  const [refPixels, setRefPixels] = useState({ w: DEFAULT_REF_WIDTH, h: DEFAULT_REF_HEIGHT })
  const [deskewLoadError, setDeskewLoadError] = useState(false)
  const [rawLoadError, setRawLoadError] = useState(false)
  const [imageZoom, setImageZoom] = useState(1)
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({
    pointerX: 0,
    pointerY: 0,
    panX: 0,
    panY: 0,
  })

  useEffect(() => {
    setDeskewLoadError(false)
    setRawLoadError(false)
    setRefPixels({ w: DEFAULT_REF_WIDTH, h: DEFAULT_REF_HEIGHT })
    setImageZoom(1)
    setImagePan({ x: 0, y: 0 })
    setSelectedComponentKey(null)
  }, [inspectionId, deskewSrc, rawSrc])

  /* 이미지가 로드되거나 창 크기가 변경되면 실제 크기 재측정 (보정 후 패널만) */
  useEffect(() => {
    const measure = () => {
      if (imgRef.current) {
        setImgSize({
          w: imgRef.current.clientWidth,
          h: imgRef.current.clientHeight,
        })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [log, showSideBySide])

  /* 픽셀 좌표 → 표시 크기 스케일 비율 */
  const scaleX = imgSize.w / Math.max(1, refPixels.w)
  const scaleY = imgSize.h / Math.max(1, refPixels.h)
  const pcbCrop = useMemo(
    () => (log ? buildPcbCrop(log, refPixels) : { x: 0, y: 0, width: refPixels.w, height: refPixels.h }),
    [log, refPixels]
  )
  const imageViewBox = useMemo(
    () => panCrop(zoomedCrop(pcbCrop, refPixels, imageZoom), refPixels, imagePan),
    [pcbCrop, refPixels, imageZoom, imagePan]
  )

  const beginPan = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    panStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      panX: imagePan.x,
      panY: imagePan.y,
    }
    setIsPanning(true)
  }

  const movePan = (event: PointerEvent<SVGSVGElement>) => {
    if (!isPanning) return
    const rect = event.currentTarget.getBoundingClientRect()
    const unitX = imageViewBox.width / Math.max(1, rect.width)
    const unitY = imageViewBox.height / Math.max(1, rect.height)
    const dx = event.clientX - panStartRef.current.pointerX
    const dy = event.clientY - panStartRef.current.pointerY
    setImagePan({
      x: panStartRef.current.panX - dx * unitX,
      y: panStartRef.current.panY - dy * unitY,
    })
  }

  const endPan = (event: PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsPanning(false)
  }

  const resetImageView = () => {
    setImageZoom(1)
    setImagePan({ x: 0, y: 0 })
  }

  return (
    <div className="flex max-h-[calc(100vh-2rem)] flex-col bg-white rounded-xl overflow-hidden">

      {/* 헤더 바 */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-Black-10%">
        <div className="flex items-center gap-2">
          <AlertCircle size={15} className="text-indigo-400" />
          <span className="text-sm font-semibold text-Black-100%">
            검사 상세 (피듀셜)
            {log && (
              <span className="ml-2 text-xs text-Black-40% font-normal">
                #{log.id} — {log.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}
              </span>
            )}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-Black-4% text-Black-40% hover:text-Black-100% transition-colors"
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>

      {log && isFiducialAlignmentSentinel(log) && (
        <div className="shrink-0 px-4 py-2.5 bg-amber-950/50 border-b border-amber-900/40 text-[11px] text-amber-100/95 leading-relaxed">
          <strong className="text-amber-200">정렬(피듀셜) 단계에서 실패했습니다.</strong> 마크가 2개
          이상 잡히지 않아 기울기 값이 999°로 기록됩니다. 이 상태에서는{' '}
          <strong>결함 검사가 실행되지 않습니다</strong> — 표시할 결함 박스가 없는 것이 정상입니다.
          <span className="text-amber-200/80">
            {' '}
            엣지 <code className="text-amber-300/90">YOLO_FIDUCIAL_CONFIDENCE_THRESHOLD</code>를
            0.2~0.35로 낮추거나, 학습 이미지와 비슷한 밝기·구도로 촬영해 보세요.
          </span>
        </div>
      )}

      {/* 본문 */}
      {isLoading ? (
        /* 로딩 스켈레톤 */
        <div className="h-64 animate-pulse bg-Black-4%/50" />
      ) : !log ? (
        <div className="h-32 flex items-center justify-center text-Black-40% text-sm">
          데이터를 불러올 수 없습니다.
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col lg:flex-row lg:items-stretch gap-0 overflow-hidden">

          {/* 좌: 보정 전 / 우: 보정 후(+오버레이) — 또는 단일 이미지 */}
          <div
            className={
              showSideBySide
                ? 'flex flex-col sm:flex-row flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-Black-10%'
                : 'relative flex-1 min-w-0 lg:min-h-0 overflow-hidden bg-Background-1 min-h-48 border-b lg:border-b-0 lg:border-r border-Black-10%'
            }
          >
            {showSideBySide ? (
              <>
                <div className="relative flex-1 min-w-0 bg-Background-1 border-b sm:border-b-0 sm:border-r border-Black-10%/90">
                  <PanelBadge>보정 전</PanelBadge>
                  {rawSrc && !rawLoadError ? (
                    <img
                      src={rawSrc}
                      alt="촬영 원본"
                      className="w-full h-auto block"
                      onError={() => setRawLoadError(true)}
                    />
                  ) : (
                    <div className="w-full min-h-32 flex flex-col items-center justify-center gap-2 px-4 py-8 bg-white border border-Black-10%/50">
                      <ImageOff size={28} className="text-Black-40%" />
                      <p className="text-xs text-Black-40%">원본 이미지를 불러오지 못했습니다.</p>
                    </div>
                  )}
                </div>
                <div className="relative flex-1 min-w-0 bg-Background-1">
                  <PanelBadge>보정 후 · 피듀셜 + 결함</PanelBadge>
                  {deskewSrc && !deskewLoadError ? (
                    <>
                      <img
                        ref={imgRef}
                        src={deskewSrc}
                        alt="기울기 보정 후"
                        className="w-full h-auto block"
                        onLoad={(e) => {
                          const el = e.currentTarget
                          setRefPixels({
                            w: el.naturalWidth || DEFAULT_REF_WIDTH,
                            h: el.naturalHeight || DEFAULT_REF_HEIGHT,
                          })
                          setImgSize({ w: el.clientWidth, h: el.clientHeight })
                        }}
                        onError={() => setDeskewLoadError(true)}
                      />
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
                      >
                        {log.fiducial1X != null && log.fiducial1Y != null && (
                          <FiducialMarker
                            x={log.fiducial1X}
                            y={log.fiducial1Y}
                            label="F1"
                            confidence={log.fiducial1Confidence ?? null}
                            scaleX={scaleX}
                            scaleY={scaleY}
                          />
                        )}
                        {log.fiducial2X != null && log.fiducial2Y != null && (
                          <FiducialMarker
                            x={log.fiducial2X}
                            y={log.fiducial2Y}
                            label="F2"
                            confidence={log.fiducial2Confidence ?? null}
                            scaleX={scaleX}
                            scaleY={scaleY}
                          />
                        )}
                        {visibleNormalComponents.map((d, i) => (
                          <DefectBox
                            key={`normal-${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}
                            x={d.bboxX}
                            y={d.bboxY}
                            w={d.bboxWidth}
                            h={d.bboxHeight}
                            label={defectDisplayName(d.defectType)}
                            confidence={d.confidence}
                            color={defectColor(d.defectType)}
                            scaleX={scaleX}
                            scaleY={scaleY}
                            highlighted={defectKey(d) === selectedComponentKey}
                          />
                        ))}
                        {visibleDefectDetections.map((d, i) => (
                          <DefectBox
                            key={`defect-${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}
                            x={d.bboxX}
                            y={d.bboxY}
                            w={d.bboxWidth}
                            h={d.bboxHeight}
                            label={defectDisplayName(d.defectType)}
                            confidence={d.confidence}
                            color={defectColor(d.defectType)}
                            scaleX={scaleX}
                            scaleY={scaleY}
                          />
                        ))}
                        {visibleMissing.map((d, i) => (
                          <MissingBox
                            key={`missing-${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}
                            x={d.bboxX}
                            y={d.bboxY}
                            w={d.bboxWidth}
                            h={d.bboxHeight}
                            label={defectDisplayName(missingClassOf(d.defectType))}
                            color={defectColor(d.defectType)}
                            scaleX={scaleX}
                            scaleY={scaleY}
                          />
                        ))}
                      </svg>
                    </>
                  ) : (
                    <div className="w-full aspect-video bg-Black-4%/60 flex flex-col items-center justify-center gap-2 px-4 text-center">
                      <ImageOff size={32} className="text-Black-40%" />
                      <p className="text-xs text-Black-40%">보정 이미지를 불러오지 못했습니다.</p>
                    </div>
                  )}
                </div>
              </>
            ) : deskewSrc && !deskewLoadError ? (
              <div className="relative flex w-full items-center justify-center overflow-hidden bg-Black-100% lg:h-full">
                <div className="absolute right-3 bottom-3 z-20 flex items-center gap-1.5 rounded-lg border border-white/15 bg-Black-100%/45 p-1.5 backdrop-blur">
                  <ZoomButton
                    label="축소"
                    disabled={imageZoom <= 1}
                    onClick={() => setImageZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                  >
                    <ZoomOut size={15} />
                  </ZoomButton>
                  <span className="min-w-11 text-center text-[11px] font-bold tabular-nums text-white">
                    {Math.round(imageZoom * 100)}%
                  </span>
                  <ZoomButton
                    label="확대"
                    disabled={imageZoom >= 4}
                    onClick={() => setImageZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
                  >
                    <ZoomIn size={15} />
                  </ZoomButton>
                  <ZoomButton
                    label="초기화"
                    disabled={imageZoom === 1 && imagePan.x === 0 && imagePan.y === 0}
                    onClick={resetImageView}
                  >
                    <RotateCcw size={14} />
                  </ZoomButton>
                </div>
                <img
                  ref={imgRef}
                  src={deskewSrc}
                  alt="검사 캡처 이미지"
                  className="sr-only"
                  onLoad={(e) => {
                    const el = e.currentTarget
                    setRefPixels({
                      w: el.naturalWidth || DEFAULT_REF_WIDTH,
                      h: el.naturalHeight || DEFAULT_REF_HEIGHT,
                    })
                    setImgSize({
                      w: el.naturalWidth || DEFAULT_REF_WIDTH,
                      h: el.naturalHeight || DEFAULT_REF_HEIGHT,
                    })
                  }}
                  onError={() => setDeskewLoadError(true)}
                />
                <svg
                  className={[
                    'block w-full h-auto max-h-[calc(100vh-9rem)] select-none lg:h-full lg:max-h-full',
                    isPanning ? 'cursor-grabbing' : 'cursor-grab',
                  ].join(' ')}
                  viewBox={`${imageViewBox.x} ${imageViewBox.y} ${imageViewBox.width} ${imageViewBox.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  onPointerDown={beginPan}
                  onPointerMove={movePan}
                  onPointerUp={endPan}
                  onPointerCancel={endPan}
                  style={{ touchAction: 'none' }}
                >
                  <image
                    href={deskewSrc}
                    x={0}
                    y={0}
                    width={refPixels.w}
                    height={refPixels.h}
                    preserveAspectRatio="none"
                  />
                  {log.fiducial1X != null && log.fiducial1Y != null && (
                    <FiducialMarker
                      x={log.fiducial1X}
                      y={log.fiducial1Y}
                      label="F1"
                      confidence={log.fiducial1Confidence ?? null}
                      scaleX={1}
                      scaleY={1}
                    />
                  )}
                  {log.fiducial2X != null && log.fiducial2Y != null && (
                    <FiducialMarker
                      x={log.fiducial2X}
                      y={log.fiducial2Y}
                      label="F2"
                      confidence={log.fiducial2Confidence ?? null}
                      scaleX={1}
                      scaleY={1}
                    />
                  )}
                  {visibleNormalComponents.map((d, i) => (
                    <DefectBox
                      key={`normal-${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}
                      x={d.bboxX}
                      y={d.bboxY}
                      w={d.bboxWidth}
                      h={d.bboxHeight}
                      label={defectDisplayName(d.defectType)}
                      confidence={d.confidence}
                      color={defectColor(d.defectType)}
                      scaleX={1}
                      scaleY={1}
                      highlighted={defectKey(d) === selectedComponentKey}
                    />
                  ))}
                  {visibleDefectDetections.map((d, i) => (
                    <DefectBox
                      key={`defect-${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}
                      x={d.bboxX}
                      y={d.bboxY}
                      w={d.bboxWidth}
                      h={d.bboxHeight}
                      label={defectDisplayName(d.defectType)}
                      confidence={d.confidence}
                      color={defectColor(d.defectType)}
                      scaleX={1}
                      scaleY={1}
                    />
                  ))}
                  {visibleMissing.map((d, i) => (
                    <MissingBox
                      key={`missing-${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}
                      x={d.bboxX}
                      y={d.bboxY}
                      w={d.bboxWidth}
                      h={d.bboxHeight}
                      label={defectDisplayName(missingClassOf(d.defectType))}
                      color={defectColor(d.defectType)}
                      scaleX={1}
                      scaleY={1}
                    />
                  ))}
                </svg>
              </div>
            ) : deskewSrc && deskewLoadError ? (
              <div className="w-full aspect-video bg-Black-4%/60 flex flex-col items-center justify-center gap-2 px-4 text-center">
                <ImageOff size={32} className="text-Black-40%" />
                <p className="text-xs text-Black-40%">캡처 이미지를 불러오지 못했습니다.</p>
                <p className="text-xs text-Black-40%">
                  <code className="text-indigo-300">frontend/vite.config.ts</code>의{' '}
                  <code className="text-indigo-300">/captures</code> 프록시가 Pi IP와 맞는지,
                  Pi에서 <code className="text-indigo-300">uvicorn</code>이 떠 있는지 확인하세요.
                </p>
              </div>
            ) : (
              <div
                ref={imgRef as React.RefObject<HTMLDivElement> as React.RefObject<any>}
                className="w-full aspect-video bg-Black-4%/60 flex flex-col items-center justify-center gap-2"
              >
                <ImageOff size={32} className="text-Black-40%" />
                <p className="text-xs text-Black-40%">캡처 이미지 없음</p>
                <p className="text-xs text-Black-40%">(더미 모드에서는 이미지가 저장되지 않습니다)</p>
              </div>
            )}
          </div>

          {/* 우측: 검사 메타데이터 패널 */}
          <div className="w-full lg:w-52 xl:w-56 border-t lg:border-t-0 lg:border-l border-Black-10% p-4 shrink-0 lg:min-h-0 lg:overflow-y-auto">
            <h3 className="text-xs font-semibold text-Black-40% uppercase tracking-wider mb-3">
              검사 정보
            </h3>

            {deskewSrc && !deskewLoadError && (
              <a
                href={deskewSrc}
                download={imageDownloadName(log)}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-md border border-indigo-500/50 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-500/20 hover:border-indigo-400"
              >
                <Download size={14} />
                원본 이미지 다운로드
              </a>
            )}

            <dl className="space-y-2.5 text-xs">
              <MetaRow label="검사 ID"     value={`#${log.id}`}              />
              <MetaRow label="디바이스"    value={log.deviceId}              />
              <MetaRow label="검사 시각"   value={new Date(log.inspectedAt).toLocaleString('ko-KR')} />
              <MetaRow
                label="촬영 시 기울기"
                value={
                  log.angleErrorDeg == null
                    ? '—'
                    : isFiducialAlignmentSentinel(log)
                      ? `${log.angleErrorDeg.toFixed(2)}° — 피듀셜 2개 미탐지(결함검사 생략)`
                      : `${log.angleErrorDeg.toFixed(2)}° (보정 전)`
                }
              />
              {(log.fiducial1Confidence != null || log.fiducial2Confidence != null) && (
                <MetaRow
                  label="피듀셜 conf"
                  value={[
                    log.fiducial1Confidence != null
                      ? `F1 ${(log.fiducial1Confidence * 100).toFixed(0)}%`
                      : null,
                    log.fiducial2Confidence != null
                      ? `F2 ${(log.fiducial2Confidence * 100).toFixed(0)}%`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              )}
              {log.fiducial1X != null && log.fiducial1Y != null && (
                <MetaCoordRow
                  label="F1 중심 (px)"
                  value={`(${log.fiducial1X}, ${log.fiducial1Y})`}
                />
              )}
              {log.fiducial2X != null && log.fiducial2Y != null && (
                <MetaCoordRow
                  label="F2 중심 (px)"
                  value={`(${log.fiducial2X}, ${log.fiducial2Y})`}
                />
              )}
              {f12DistancePx != null && (
                <MetaRow label="F1–F2 거리" value={`${f12DistancePx.toFixed(1)} px`} />
              )}
              <MetaRow label="추론 시간"   value={log.inferenceTimeMs != null ? `${log.inferenceTimeMs}ms` : '—'} />
              <MetaRow label="총 처리"     value={log.totalTimeMs != null ? `${log.totalTimeMs}ms` : '—'} />
              <MetaRow label="정상 부품"   value={`${normalComponents.length}건`} />
              <MetaRow label="결함"        value={`${defectDetections.length}건`} />
              <MetaRow label="누락"        value={`${displayMissingReasons.length}건`} />
            </dl>
          </div>

          {/* 우측: 검출 데이터 패널 */}
          <div className="w-full lg:w-60 xl:w-64 border-t lg:border-t-0 lg:border-l border-Black-10% p-4 shrink-0 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-xs font-semibold text-Black-40% uppercase tracking-wider">
                검출 데이터
              </h3>
              <span className="text-[11px] font-mono text-Black-40%">
                {detectedComponents.length + displayMissingReasons.length}건
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <OverlayToggle
                label={`정상 ${normalComponents.length}`}
                checked={showNormalLabels}
                onChange={setShowNormalLabels}
              />
              <OverlayToggle
                label={`결함 ${defectDetections.length}`}
                checked={showDefectLabels}
                onChange={setShowDefectLabels}
              />
              <OverlayToggle
                label={`누락 ${displayMissingReasons.length}`}
                checked={showMissingLabels}
                onChange={setShowMissingLabels}
              />
            </div>

            {(defectDetections.length > 0 || displayMissingReasons.length > 0) && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <h4 className="text-[11px] font-semibold text-red-800 mb-1">FAIL 원인</h4>
                <ul className="space-y-1">
                  {defectDetections.map((d, i) => (
                    <li key={`defect-${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`} className="text-[11px] font-medium text-red-800">
                      <div>
                        - {defectDisplayName(d.defectType)}{' '}
                        <span className="font-mono text-red-700">({(d.confidence * 100).toFixed(0)}%)</span>
                      </div>
                    </li>
                  ))}
                  {displayMissingReasons.map((d, i) => (
                    <li key={`${d.defectType}-${i}`} className="text-[11px] font-medium text-red-800">
                      <div>- {missingShortLabel(d.defectType)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {normalComponents.length > 0 ? (
              <div className="border-t border-Black-10% pt-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                <h4 className="text-[11px] font-semibold text-Black-40% uppercase tracking-wider mb-2 shrink-0">
                  정상 부품 좌표
                  <span className="ml-1.5 normal-case font-normal text-Black-40%">— 클릭 시 이미지에서 강조</span>
                </h4>
                <div className="max-h-[60vh] lg:max-h-none lg:flex-1 overflow-y-auto space-y-2 pr-1">
                  {normalComponents.map((d, i) => {
                    const cx = d.bboxX + Math.round(d.bboxWidth / 2)
                    const cy = d.bboxY + Math.round(d.bboxHeight / 2)
                    const color = defectColor(d.defectType)
                    const category = isNormalComponent(d) ? '정상' : '결함'
                    // fiducial 좌표 있으면 부품 중심 → 마크까지 거리 계산
                    const distF1 =
                      log?.fiducial1X != null && log?.fiducial1Y != null
                        ? Math.hypot(cx - log.fiducial1X, cy - log.fiducial1Y)
                        : null
                    const distF2 =
                      log?.fiducial2X != null && log?.fiducial2Y != null
                        ? Math.hypot(cx - log.fiducial2X, cy - log.fiducial2Y)
                        : null
                    const itemKey = defectKey(d)
                    const isSelected = selectedComponentKey === itemKey
                    return (
                      <button
                        type="button"
                        key={`${d.defectType}-${d.bboxX}-${d.bboxY}-${i}`}
                        onClick={() => {
                          setSelectedComponentKey(isSelected ? null : itemKey)
                          if (!isSelected && !showNormalLabels) setShowNormalLabels(true)
                        }}
                        aria-pressed={isSelected}
                        className={[
                          'block w-full text-left rounded-md border px-2.5 py-2 transition-colors',
                          isSelected
                            ? 'border-indigo-400 ring-2 ring-indigo-300 bg-indigo-50'
                            : 'border-Black-10% bg-Background-1/80 hover:border-indigo-300 hover:bg-indigo-50/40',
                        ].join(' ')}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-semibold truncate" style={{ color }}>
                            {i + 1}. {defectDisplayName(d.defectType)}
                          </span>
                          <span className="shrink-0 text-[10px] font-semibold text-Black-40%">
                            {category} · {(d.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-Black-80% leading-relaxed">
                          <div>좌상단: ({d.bboxX}, {d.bboxY})</div>
                          <div>크기: {d.bboxWidth}×{d.bboxHeight}px</div>
                          <div className="text-Black-100%">중심: ({cx}, {cy})</div>
                          {(distF1 != null || distF2 != null) && (
                            <div className="text-Black-100% mt-1">
                              {distF1 != null && <span>F1까지: {distF1.toFixed(1)}px</span>}
                              {distF1 != null && distF2 != null && <span className="mx-1.5 text-Black-40%">|</span>}
                              {distF2 != null && <span>F2까지: {distF2.toFixed(1)}px</span>}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-Black-10% bg-Background-1 px-3 py-4 text-xs text-Black-40% text-center">
                표시할 정상 부품이 없습니다.
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

/** 검사 메타 정보 행 */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-Black-40% shrink-0">{label}</dt>
      <dd className="text-Black-80% font-mono text-right truncate">{value}</dd>
    </div>
  )
}

/** 피듀셜 중심 좌표 — 패널에서 가장 눈에 띄게 (라이트 톤, 반전) */
function MetaCoordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-Black-10% bg-white px-3 py-2.5 shadow-sm">
      <dt className="text-[11px] font-semibold text-sky-600 tracking-wide">{label}</dt>
      <dd className="text-base sm:text-lg font-bold font-mono text-Black-100% tabular-nums tracking-tight break-all">
        {value}
      </dd>
    </div>
  )
}
