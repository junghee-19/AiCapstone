/**
 * 검사 이력 페이지
 *
 * 전체 검사 이력을 조회하고 날짜 기간 필터 및 결과(PASS/FAIL) 필터를 제공한다.
 *
 * 기능:
 * - 날짜 범위 선택 (from ~ to)
 * - 결과 필터 버튼 그룹 (전체 / PASS / FAIL)
 * - 총 건수 / 합격 / 불합격 미니 통계
 * - InspectionTable 렌더링 (행 클릭 → DefectViewer)
 */

import { useState, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Search, Filter, Download, Trash2, Loader2, ChevronDown, RotateCcw } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import InspectionTable from '@/components/inspection/InspectionTable'
import { useAllInspections } from '@/hooks/useInspectionData'
import {
  deleteAllInspections,
  deleteInspectionsByPeriod,
} from '@/api/inspectionApi'
import {
  DEFECT_LABEL,
  isNormalComponentType,
  missingClassOf,
  defectColor,
} from '@/types/inspection'
import type { InspectionResultType } from '@/types/inspection'

// ── 결과 필터 버튼 ────────────────────────────────────────────────────────────

type ResultFilter = 'ALL' | InspectionResultType

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface FilterButtonProps {
  label:    string
  value:    ResultFilter
  current:  ResultFilter
  count:    number
  onClick:  (v: ResultFilter) => void
}

function FilterButton({ label, value, current, count, onClick }: FilterButtonProps) {
  const active = value === current
  return (
    <button
      onClick={() => onClick(value)}
      className={clsx(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-Black-4% text-Black-40% hover:text-Black-100% hover:bg-Black-10%'
      )}
    >
      {label}
      <span className={clsx(
        'px-1.5 py-0.5 rounded-full text-xs',
        active ? 'bg-white/30' : 'bg-Black-10%'
      )}>
        {count}
      </span>
    </button>
  )
}

// ── 결함·누락 상세 필터 ───────────────────────────────────────────────────────

/** defects[] 원소를 큰 범주로 분류 */
type DefectCategory = 'DEFECT' | 'MISSING' | 'ANOMALY' | 'NORMAL'

function categorizeDefect(defectType: string): DefectCategory {
  if (defectType.startsWith('MISSING:')) return 'MISSING'
  if (defectType.startsWith('ANOMALY:')) return 'ANOMALY'
  if (isNormalComponentType(defectType)) return 'NORMAL'
  return 'DEFECT'
}

/** 결함 칩을 묶는 그룹 키(한글 라벨) — TRACE_OPEN·trace_open 등을 한 칩으로 합침 */
function defectGroupLabel(defectType: string): string {
  return DEFECT_LABEL[defectType] ?? DEFECT_LABEL[defectType.toUpperCase()] ?? defectType
}

/** 누락 칩 라벨 — 클래스명 → "<부품명> 누락" */
function missingGroupLabel(cls: string): string {
  const korean = DEFECT_LABEL[cls] ?? DEFECT_LABEL[cls.toUpperCase()] ?? cls
  return `${korean} 누락`
}

interface DetailOption {
  key:   string   // 선택 상태 비교용 키
  label: string   // 표시 라벨
  count: number   // 해당 항목을 포함하는 검사 건수
  color: string   // 점 색상
}

interface FilterChipProps {
  option:   DetailOption
  selected: boolean
  onToggle: (key: string) => void
}

function FilterChip({ option, selected, onToggle }: FilterChipProps) {
  return (
    <button
      onClick={() => onToggle(option.key)}
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
        selected
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-Black-4% text-Black-60% border-Black-10% hover:text-Black-100% hover:bg-Black-10%'
      )}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: option.color }} />
      {option.label}
      <span className={clsx('text-[10px]', selected ? 'text-white/70' : 'text-Black-40%')}>
        {option.count}
      </span>
    </button>
  )
}

// ── CSV 다운로드 유틸 ─────────────────────────────────────────────────────────

function downloadCsv(data: ReturnType<typeof useAllInspections>['data']) {
  if (!data?.length) return

  /* CSV 헤더 */
  const header = ['ID', '시각', '디바이스', '결과', '오차(°)', '추론(ms)', '총처리(ms)', '결함수']
  const rows = data.map((l) => [
    l.id,
    new Date(l.inspectedAt).toLocaleString('ko-KR'),
    l.deviceId,
    l.result,
    l.angleErrorDeg?.toFixed(2) ?? '',
    l.inferenceTimeMs ?? '',
    l.totalTimeMs ?? '',
    l.defects.length,
  ])

  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)

  /* 가상 <a> 태그로 다운로드 트리거 */
  const link = document.createElement('a')
  link.href = url
  link.download = `inspection_history_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const queryClient = useQueryClient()
  const { data: allLogs = [], isLoading } = useAllInspections()

  /* 결과 필터 상태 */
  const [resultFilter, setResultFilter] = useState<ResultFilter>('ALL')

  /* 결함·누락 상세 필터 상태 */
  const [detailOpen, setDetailOpen] = useState(false)
  const [selDefects,  setSelDefects]  = useState<Set<string>>(new Set())  // 결함 그룹 라벨
  const [selMissings, setSelMissings] = useState<Set<string>>(new Set())  // 누락 클래스명

  /* Set 토글 헬퍼 */
  const toggleInSet = (
    setter: Dispatch<SetStateAction<Set<string>>>,
    key: string,
  ) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  /* 날짜 범위 필터 상태 (YYYY-MM-DD 형식) */
  const today = getLocalDateString()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState(today)

  /* 기간 삭제 모달 상태 */
  const [periodModalOpen, setPeriodModalOpen] = useState(false)
  const [modalFrom, setModalFrom] = useState('')
  const [modalTo,   setModalTo]   = useState(today)

  // ── 삭제 mutation ───────────────────────────────────────────────────────────

  const invalidateInspections = () =>
    queryClient.invalidateQueries({ queryKey: ['inspections'] })

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllInspections,
    onSuccess: invalidateInspections,
    onError: (e: Error) => window.alert(e.message || '전체 삭제에 실패했습니다.'),
  })

  const deletePeriodMutation = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      deleteInspectionsByPeriod(from, to),
    onSuccess: (res) => {
      invalidateInspections()
      setPeriodModalOpen(false)
      window.alert(`기간 내 ${res.deletedCount}건이 삭제되었습니다.`)
    },
    onError: (e: Error) => window.alert(e.message || '기간 삭제에 실패했습니다.'),
  })

  const handleDeleteAll = () => {
    if (!window.confirm('전체 검사 이력과 결함 기록을 모두 삭제합니다. 계속할까요?')) return
    deleteAllMutation.mutate()
  }

  const openPeriodModal = () => {
    setModalFrom('')
    setModalTo(today)
    setPeriodModalOpen(true)
  }

  const handleConfirmDeletePeriod = () => {
    if (!modalFrom || !modalTo) {
      window.alert('시작일과 종료일을 모두 선택해 주세요.')
      return
    }
    if (modalFrom > modalTo) {
      window.alert('시작일이 종료일보다 늦을 수 없습니다.')
      return
    }
    if (!window.confirm(`${modalFrom} ~ ${modalTo} 기간의 검사 이력을 삭제합니다. 계속할까요?`)) {
      return
    }
    deletePeriodMutation.mutate({
      from: `${modalFrom}T00:00:00`,
      to:   `${modalTo}T23:59:59`,
    })
  }

  /* 데이터에 실제로 존재하는 결함 유형·누락 부품 목록 자동 추출 */
  const { defectOptions, missingOptions } = useMemo(() => {
    const defectMap  = new Map<string, DetailOption>()  // 그룹라벨 → 옵션
    const missingMap = new Map<string, DetailOption>()  // 클래스명 → 옵션

    for (const log of allLogs) {
      /* 한 건 안에서 중복 카운트 방지용 */
      const seenDefects  = new Set<string>()
      const seenMissings = new Set<string>()

      for (const d of log.defects) {
        const cat = categorizeDefect(d.defectType)
        if (cat === 'DEFECT') {
          const label = defectGroupLabel(d.defectType)
          if (!seenDefects.has(label)) {
            seenDefects.add(label)
            const cur = defectMap.get(label)
            if (cur) cur.count += 1
            else defectMap.set(label, { key: label, label, count: 1, color: defectColor(d.defectType) })
          }
        } else if (cat === 'MISSING') {
          const cls = missingClassOf(d.defectType)
          if (!seenMissings.has(cls)) {
            seenMissings.add(cls)
            const cur = missingMap.get(cls)
            if (cur) cur.count += 1
            else missingMap.set(cls, { key: cls, label: missingGroupLabel(cls), count: 1, color: defectColor(d.defectType) })
          }
        }
      }
    }

    const byCountDesc = (a: DetailOption, b: DetailOption) => b.count - a.count
    return {
      defectOptions:  [...defectMap.values()].sort(byCountDesc),
      missingOptions: [...missingMap.values()].sort(byCountDesc),
    }
  }, [allLogs])

  const activeDetailCount = selDefects.size + selMissings.size

  const resetDetailFilter = () => {
    setSelDefects(new Set())
    setSelMissings(new Set())
  }

  /* 필터 적용된 데이터 계산 (useMemo로 불필요한 재연산 방지) */
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      /* 결과 필터 */
      if (resultFilter !== 'ALL' && log.result !== resultFilter) return false

      /* 날짜 범위 필터 */
      const logDate = log.inspectedAt.slice(0, 10)
      if (dateFrom && logDate < dateFrom) return false
      if (dateTo   && logDate > dateTo)   return false

      /* 결함·누락 상세 필터 (선택된 항목 중 하나라도 포함하면 통과 — OR) */
      if (selDefects.size || selMissings.size) {
        const matched = log.defects.some((d) => {
          const cat = categorizeDefect(d.defectType)
          if (cat === 'DEFECT')  return selDefects.has(defectGroupLabel(d.defectType))
          if (cat === 'MISSING') return selMissings.has(missingClassOf(d.defectType))
          return false
        })
        if (!matched) return false
      }

      return true
    })
  }, [allLogs, resultFilter, dateFrom, dateTo, selDefects, selMissings])

  /* 필터 결과 미니 통계 */
  const passCount = filteredLogs.filter((l) => l.result === 'PASS').length
  const failCount = filteredLogs.filter((l) => l.result === 'FAIL').length
  const inspectedCount = passCount + failCount

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">

      {/* 페이지 제목 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-black">검사 이력</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            전체 검사 기록 조회 및 결함 상세 확인 · 보관기간 60일 (자동 삭제)
          </p>
        </div>

        {/* 액션 버튼 그룹: CSV / 기간 삭제 / 전체 삭제 */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => downloadCsv(filteredLogs)}
            className="flex items-center gap-2 px-3 py-2 bg-Color-white hover:bg-Color-1 text-Black-100% border border-Black-10% rounded-lg text-xs font-medium transition-colors"
          >
            <Download size={14} />
            CSV 내보내기
          </button>

          <button
            onClick={openPeriodModal}
            disabled={deletePeriodMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 bg-Color-white hover:bg-red-200 border border-red-200 text-red-500 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {deletePeriodMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {deletePeriodMutation.isPending ? '삭제 중...' : '기간 삭제'}
          </button>

          <button
            onClick={handleDeleteAll}
            disabled={deleteAllMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 bg-Color-white hover:bg-red-700/80 border border-red-600/60 text-red-700/80 hover:text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            {deleteAllMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {deleteAllMutation.isPending ? '삭제 중...' : '전체 삭제'}
          </button>
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="bg-white border border-Black-10% rounded-xl p-4">
        <div className="flex flex-wrap gap-4 items-end">

          {/* 날짜 범위 필터 */}
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-Black-40% shrink-0" />
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-Black-40%">시작일</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || today}
                  className="bg-Black-4% border border-Black-10% text-Black-80% text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <span className="text-Black-40% text-sm mt-4">~</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-Black-40%">종료일</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                  max={today}
                  className="bg-Black-4% border border-Black-10% text-Black-80% text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* 결과 필터 버튼 그룹 */}
          <div className="flex items-center gap-2 ml-auto">
            <Search size={14} className="text-Black-40%" />
            <FilterButton label="전체"  value="ALL"  current={resultFilter} count={allLogs.length}                        onClick={setResultFilter} />
            <FilterButton label="PASS"  value="PASS" current={resultFilter} count={allLogs.filter(l => l.result==='PASS').length} onClick={setResultFilter} />
            <FilterButton label="FAIL"  value="FAIL" current={resultFilter} count={allLogs.filter(l => l.result==='FAIL').length} onClick={setResultFilter} />
          </div>
        </div>

        {/* ── 결함·누락 상세 필터 (토글) ───────────────────────────────────────── */}
        <div className="mt-3 pt-3 border-t border-Black-10%">
          <button
            onClick={() => setDetailOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-Black-60% hover:text-Black-100% transition-colors"
          >
            <ChevronDown
              size={14}
              className={clsx('transition-transform', detailOpen && 'rotate-180')}
            />
            결함·누락 상세 필터
            {activeDetailCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] leading-none">
                {activeDetailCount}
              </span>
            )}
          </button>

          {detailOpen && (
            <div className="mt-3 space-y-3">
              {/* 결함 그룹 */}
              <div>
                <div className="text-xs text-Black-40% mb-1.5">결함</div>
                {defectOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {defectOptions.map((opt) => (
                      <FilterChip
                        key={opt.key}
                        option={opt}
                        selected={selDefects.has(opt.key)}
                        onToggle={(k) => toggleInSet(setSelDefects, k)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-Black-40%">기록된 결함이 없습니다.</p>
                )}
              </div>

              {/* 누락 그룹 */}
              <div>
                <div className="text-xs text-Black-40% mb-1.5">누락</div>
                {missingOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {missingOptions.map((opt) => (
                      <FilterChip
                        key={opt.key}
                        option={opt}
                        selected={selMissings.has(opt.key)}
                        onToggle={(k) => toggleInSet(setSelMissings, k)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-Black-40%">기록된 누락이 없습니다.</p>
                )}
              </div>

              {/* 초기화 */}
              {activeDetailCount > 0 && (
                <button
                  onClick={resetDetailFilter}
                  className="flex items-center gap-1.5 text-xs font-medium text-Black-40% hover:text-Black-100% transition-colors"
                >
                  <RotateCcw size={12} />
                  상세 필터 초기화
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 필터 결과 미니 통계 바 */}
      <div className="flex items-center gap-4 text-xs text-Black-40%">
        <span>
          조회 결과: <span className="text-Black-100% font-semibold">{filteredLogs.length}건</span>
        </span>
        <span>
          합격: <span className="text-emerald-600 font-semibold">{passCount}건</span>
        </span>
        <span>
          불합격: <span className="text-red-600 font-semibold">{failCount}건</span>
        </span>
        {inspectedCount > 0 && (
          <span>
            불량률: <span className="text-yellow-600 font-semibold">
              {((failCount / inspectedCount) * 100).toFixed(2)}%
            </span>
          </span>
        )}
      </div>

      {/* 검사 이력 테이블 */}
      <InspectionTable
        logs={filteredLogs}
        isLoading={isLoading}
      />

      {/* 기간 삭제 모달 — 외부 클릭 시 닫힘 */}
      {periodModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-Black-40% p-4"
          onClick={() => setPeriodModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-Black-10%"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-Black-100% mb-1">기간 삭제</h3>
            <p className="text-xs text-Black-40% mb-4">
              선택한 기간(시작일 00:00 ~ 종료일 23:59)의 검사 이력을 영구 삭제합니다.
            </p>

            <div className="flex items-end gap-3 mb-6">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-Black-40%">시작일</label>
                <input
                  type="date"
                  value={modalFrom}
                  onChange={(e) => setModalFrom(e.target.value)}
                  max={modalTo || today}
                  className="bg-Black-4% border border-Black-10% text-Black-100% text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <span className="text-Black-40% text-sm pb-2">~</span>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-Black-40%">종료일</label>
                <input
                  type="date"
                  value={modalTo}
                  onChange={(e) => setModalTo(e.target.value)}
                  min={modalFrom}
                  max={today}
                  className="bg-Black-4% border border-Black-10% text-Black-100% text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPeriodModalOpen(false)}
                className="px-4 py-2 bg-Black-4% hover:bg-Black-10% text-Black-100% rounded-lg text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePeriod}
                disabled={deletePeriodMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deletePeriodMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {deletePeriodMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
