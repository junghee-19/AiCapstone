/**
 * 검사 이력 테이블 컴포넌트
 *
 * 검사 이력 목록을 테이블로 표시하며, 행 클릭 시 DefectViewer를 열어
 * 바운딩박스 상세 정보를 확인할 수 있다.
 *
 * 기능:
 * - PASS/FAIL 뱃지 색상 구분
 * - 결함 종류 태그 (단선, 까짐 등)
 * - 각도 오차 표시
 * - 클릭으로 상세 DefectViewer 연동
 */

import { useMemo, useState, useEffect } from 'react'
import { ChevronDown, AlertCircle, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import type { InspectionLog } from '@/types/inspection'
import {
  defectDisplayName,
  defectColor,
  isNormalComponentType,
  dedupeMissingReasons,
  missingShortLabel,
} from '@/types/inspection'
import DefectViewer from './DefectViewer'

// ── 보조 컴포넌트 ─────────────────────────────────────────────────────────────

/** PASS / FAIL / SKIPPED 결과 뱃지 */
function ResultBadge({ result }: { result: 'PASS' | 'FAIL' | 'SKIPPED' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold',
        result === 'PASS'
          ? 'bg-green-500/15 text-emerald-600 ring-1 ring-green-500/30'
          : result === 'FAIL'
            ? 'bg-red-500/15 text-red-600 ring-1 ring-red-500/30'
            : 'bg-Black-10% text-Black-80% ring-1 ring-Black-10%'
      )}
    >
      {result}
    </span>
  )
}

/** 결함 종류 태그 목록 — 정상 부품 제외, 누락 중복 정리, 클래스별 색상 표시 */
function DefectTags({ defects }: { defects: InspectionLog['defects'] }) {
  // 정상 부품 제외 → 결함/누락만
  const relevant = defects.filter((d) => !isNormalComponentType(d.defectType))
  // 누락은 카운트·위치 두 형태로 중복 기록되므로 누락만 따로 정리 후 결함과 합침
  const missing = relevant.filter((d) => d.defectType.startsWith('MISSING:'))
  const others = relevant.filter((d) => !d.defectType.startsWith('MISSING:'))
  const items = [...others, ...dedupeMissingReasons(missing)]

  const grouped = new Map<
    string,
    { count: number; color: string }
  >()
  items.forEach((d) => {
    // 누락은 좌표·개수 생략하고 "<부품명> 누락"으로만 (예: "IC 누락")
    const label = d.defectType.startsWith('MISSING:')
      ? missingShortLabel(d.defectType)
      : defectDisplayName(d.defectType)
    const prev = grouped.get(label)
    if (prev) {
      prev.count += 1
      return
    }
    grouped.set(label, {
      count: 1,
      color: defectColor(d.defectType),
    })
  })

  if (grouped.size === 0) {
    return <span className="text-xs text-Black-40%">—</span>
  }

  return (
    <div className="flex flex-wrap gap-1">
      {Array.from(grouped.entries()).map(([label, meta]) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: `${meta.color}22`,
            color: meta.color,
          }}
        >
          <AlertCircle size={10} />
          {`${label} X${meta.count}`}
        </span>
      ))}
    </div>
  )
}

/** 날짜/시각 포맷 유틸 */
function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
    time: d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

/** 피듀셜 중심 좌표 (보정 후 기준, 픽셀) — 테이블용 짧은 문자열 */
function formatFiducialCells(log: InspectionLog): string {
  const p1 =
    log.fiducial1X != null && log.fiducial1Y != null
      ? `F1 (${log.fiducial1X}, ${log.fiducial1Y})`
      : null
  const p2 =
    log.fiducial2X != null && log.fiducial2Y != null
      ? `F2 (${log.fiducial2X}, ${log.fiducial2Y})`
      : null
  if (p1 && p2) return `${p1} · ${p2}`
  if (p1) return p1
  if (p2) return p2
  return '—'
}

// ── 스켈레톤 ─────────────────────────────────────────────────────────────────

const TABLE_COL_COUNT = 9

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-Black-10% animate-pulse">
          {Array.from({ length: TABLE_COL_COUNT }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3.5 bg-Black-4% rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

interface InspectionTableProps {
  /** 표시할 검사 이력 데이터 */
  logs: InspectionLog[]
  /** 데이터 로딩 중 여부 */
  isLoading?: boolean
  /** 결과 필터 (undefined이면 전체 표시) */
  resultFilter?: 'PASS' | 'FAIL' | 'SKIPPED' | undefined
}

export default function InspectionTable({
  logs,
  isLoading = false,
  resultFilter,
}: InspectionTableProps) {
  /* 클릭된 검사 ID — DefectViewer 모달에 전달 */
  const [selectedId, setSelectedId] = useState<number | undefined>()

  /* ID 정렬 — 기본 내림차순 (최신 검사 우선) */
  const [idSort, setIdSort] = useState<'asc' | 'desc'>('desc')

  /* 페이지네이션 상태 — 페이지당 개수(10/20)와 현재 페이지(1-based) */
  const [pageSize, setPageSize] = useState<number>(10)
  const [page, setPage]         = useState<number>(1)

  /* 결과 필터 + ID 정렬 적용 */
  const sortedFiltered = useMemo(() => {
    const base = resultFilter
      ? logs.filter((l) => l.result === resultFilter)
      : logs
    return [...base].sort((a, b) => idSort === 'asc' ? a.id - b.id : b.id - a.id)
  }, [logs, resultFilter, idSort])

  const filtered = sortedFiltered

  /* 목록/필터/정렬/페이지크기 변경 시 첫 페이지로 리셋 */
  useEffect(() => {
    setPage(1)
  }, [logs, resultFilter, idSort, pageSize])

  /* 페이지 슬라이싱 — page가 범위를 벗어나면 안전하게 보정 */
  const totalPages   = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage  = Math.min(page, totalPages)
  const startIdx     = (currentPage - 1) * pageSize
  const paged        = filtered.slice(startIdx, startIdx + pageSize)

  /* 현재 페이지 주변 페이지 번호 목록 (최대 5개) */
  const pageWindow = useMemo(() => {
    const span = 5
    let start = Math.max(1, currentPage - 2)
    const end = Math.min(totalPages, start + span - 1)
    start = Math.max(1, end - span + 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [currentPage, totalPages])

  const HEADERS: { key: string; label: string; sortable?: boolean }[] = [
    { key: 'id',         label: 'ID', sortable: true },
    { key: 'time',       label: '시각' },
    { key: 'device',     label: '디바이스' },
    { key: 'result',     label: '결과' },
    { key: 'defects',    label: '결함' },
    { key: 'fiducials',  label: '피듀셜 (px)' },
    { key: 'angle',      label: '오차 (°)' },
    { key: 'inference',  label: '추론 (ms)' },
    { key: 'detail',     label: '' },
  ]

  return (
    <>
      {/* 상단 바 — 우측 상단: 표시 범위 + 페이지당 개수 드롭다운 */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-end gap-3 mb-3 text-xs text-Black-40%">
          <span>
            총 <span className="text-Black-100% font-semibold">{filtered.length}</span>건 중{' '}
            <span className="text-Black-100% font-semibold">
              {startIdx + 1}–{Math.min(startIdx + pageSize, filtered.length)}
            </span>
          </span>
          <label className="flex items-center gap-1.5">
            페이지당
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-Black-4% border border-Black-10% text-Black-80% rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value={10}>10개</option>
              <option value={20}>20개</option>
            </select>
          </label>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-Black-10%">
        <table className="w-full text-sm">
          {/* 헤더 */}
          <thead>
            <tr className="bg-white border border-Black-10% text-left">
              {HEADERS.map((h) => (
                <th
                  key={h.key}
                  className={clsx(
                    'px-4 py-3 text-xs font-semibold text-Black-40% uppercase tracking-wider',
                    h.sortable && 'cursor-pointer select-none hover:text-Black-80%',
                  )}
                  onClick={
                    h.sortable && h.key === 'id'
                      ? () => setIdSort((p) => p === 'asc' ? 'desc' : 'asc')
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {h.label}
                    {h.key === 'id' && (
                      idSort === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* 바디 */}
          <tbody className="divide-y divide-Black-10%">
            {isLoading ? (
              <TableSkeleton />
            ) : filtered.length === 0 ? (
              /* 데이터 없음 */
              <tr>
                <td colSpan={TABLE_COL_COUNT} className="px-4 py-12 text-center text-Black-40% text-sm">
                  검사 이력이 없습니다.
                </td>
              </tr>
            ) : (
              paged.map((log) => {
                const { date, time } = formatDateTime(log.inspectedAt)
                const isOpen = selectedId === log.id
                const toggle = () => setSelectedId(isOpen ? undefined : log.id)
                return (
                  <tr
                    key={log.id}
                    className={clsx(
                      'bg-white hover:bg-Black-4% cursor-pointer transition-colors',
                      isOpen && 'bg-Black-4%'
                    )}
                    onClick={toggle}
                  >
                    {/* ID */}
                    <td className="px-4 py-3 font-mono text-xs text-Black-40%">
                      #{log.id}
                    </td>

                    {/* 시각 */}
                    <td className="px-4 py-3">
                      <p className="text-Black-80% text-xs">{date}</p>
                      <p className="text-Black-40% text-xs font-mono">{time}</p>
                    </td>

                    {/* 디바이스 */}
                    <td className="px-4 py-3 text-xs text-Black-40% font-mono">
                      {log.deviceId}
                    </td>

                    {/* 결과 뱃지 */}
                    <td className="px-4 py-3">
                      <ResultBadge result={log.result} />
                    </td>

                    {/* 결함 태그 */}
                    <td className="px-4 py-3">
                      <DefectTags defects={log.defects} />
                    </td>

                    {/* 피듀셜 중심 좌표 (deskew 후 좌표계) */}
                    <td
                      className="px-4 py-3 text-[11px] text-Black-100% font-mono leading-snug max-w-[14rem]"
                      title="보정 이미지 기준 피듀셜 중심 (px)"
                    >
                      {formatFiducialCells(log)}
                    </td>

                    {/* 오차 각도 */}
                    <td className="px-4 py-3 text-xs text-Black-40% font-mono">
                      {log.angleErrorDeg != null
                        ? `${log.angleErrorDeg.toFixed(2)}°`
                        : '—'}
                    </td>

                    {/* 추론 시간 */}
                    <td className="px-4 py-3 text-xs text-Black-40% font-mono">
                      {log.inferenceTimeMs != null ? `${log.inferenceTimeMs}ms` : '—'}
                    </td>

                    {/* 상세 토글 버튼 */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-label={isOpen ? '상세 닫기' : '상세 열기'}
                        onClick={(e) => { e.stopPropagation(); toggle() }}
                        className="p-1 rounded hover:bg-Black-10% transition-colors"
                      >
                        <ChevronDown
                          size={16}
                          className={clsx(
                            'transition-transform',
                            isOpen ? 'rotate-180 text-indigo-600' : 'text-Black-40%'
                          )}
                        />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지 이동 — 중앙 하단 */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button
            type="button"
            aria-label="이전 페이지"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            className="p-1.5 rounded-lg text-Black-60% hover:bg-Black-10% disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {pageWindow.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              aria-current={p === currentPage ? 'page' : undefined}
              className={clsx(
                'min-w-[2rem] px-2 py-1 rounded-lg text-xs font-medium transition-colors',
                p === currentPage
                  ? 'bg-indigo-600 text-white'
                  : 'text-Black-60% hover:bg-Black-10%'
              )}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            aria-label="다음 페이지"
            disabled={currentPage === totalPages}
            onClick={() => setPage(currentPage + 1)}
            className="p-1.5 rounded-lg text-Black-60% hover:bg-Black-10% disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {selectedId !== undefined && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-Black-40% p-4"
          onClick={() => setSelectedId(undefined)}
        >
          <div
            className="max-h-[calc(100vh-2rem)] w-full max-w-[98vw] overflow-y-auto rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <DefectViewer
              inspectionId={selectedId}
              onClose={() => setSelectedId(undefined)}
            />
          </div>
        </div>
      )}

    </>
  )
}
