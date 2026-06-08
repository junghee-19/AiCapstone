/**
 * 메인 대시보드 페이지
 *
 * 레이아웃 구성:
 * ┌──────────────────────────────────────────────────┐
 * │  헤더 (제목)                                       │
 * │  [StatCard × 4]  전체/합격/불합격/불량률           │
 * ├─────────────────────┬────────────────────────────│
 * │  PassFailChart      │  TrendChart                │
 * │  (도넛 차트)         │  (스택 막대 차트)            │
 * ├─────────────────────┴────────────────────────────│
 * │  FailRateTrendChart (주별 불량률 라인)              │
 * │  InspectionTable    (오늘 검사 이력 실시간 피드)      │
 * └──────────────────────────────────────────────────┘
 */

import { useMemo } from 'react'
import StatCardGroup from '@/components/dashboard/StatCard'
import PassFailChart from '@/components/dashboard/PassFailChart'
import TrendChart from '@/components/dashboard/TrendChart'
import InspectionTable from '@/components/inspection/InspectionTable'
import { useAllInspections } from '@/hooks/useInspectionData'

export default function DashboardPage() {
  /* 오늘(서버 수신일 기준) 검사 이력 — 대시보드 하단 실시간 피드 테이블 */
  const { data: allLogs = [], isLoading } = useAllInspections()

  const todayLogs = useMemo(() => {
    /* 브라우저 로컬 기준 오늘 날짜 (YYYY-MM-DD) */
    const todayStr = new Date().toLocaleDateString('en-CA')
    /* createdAt(서버 수신 시각)은 엣지 시계 오차에 영향받지 않아 '오늘' 판정에 안정적 */
    return allLogs.filter((l) => (l.createdAt ?? '').slice(0, 10) === todayStr)
  }, [allLogs])

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">

      {/* 페이지 제목 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 rounded-xl border border-Black-10% bg-white px-5 py-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-Black-100%">실시간 대시보드</h2>
          <p className="text-xs text-Black-40% mt-0.5">
            검사 이력·통계 자동 갱신 · 이미지 업로드 또는 Edge 디바이스로 PCB 검사
          </p>
        </div>
      </div>

      {/* 1행: 통계 카드 4개 */}
      <StatCardGroup />

      {/* 2행: 도넛 차트 + 트렌드 차트 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <PassFailChart />
        </div>
        <div className="lg:col-span-3">
          <TrendChart />
        </div>
      </div>

      {/* 3행: 실시간 이력 테이블 */}
      <div className="rounded-xl border border-Black-10% bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-Black-100%">오늘 검사 이력</h2>
          <span className="text-xs text-Black-40%">오늘 {todayLogs.length}건</span>
        </div>
        <InspectionTable logs={todayLogs} isLoading={isLoading} />
      </div>
    </div>
  )
}
