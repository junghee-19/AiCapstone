import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Activity, AlertTriangle, Bold, CalendarDays, CheckCircle2, Clock3, Filter, Gauge,
} from 'lucide-react'
import { useAllInspections } from '@/hooks/useInspectionData'
import FailRateTrendChart from '@/components/dashboard/FailRateTrendChart'
import { defectColor, defectDisplayName } from '@/types/inspection'
import type { DefectDetail, InspectionLog, InspectionResultType } from '@/types/inspection'

const NORMAL_LABEL_CLASSES = new Set([
  'mount_hole',
  'fiducial',
  'gold_finger_row',
  'ic_chip',
  'smd_array_block',
  'edge_connector_zone',
])

interface DefectStat {
  key: string
  label: string
  count: number
  rate: number
  color: string
}

type ResultFilter = 'ALL' | Exclude<InspectionResultType, 'SKIPPED'>

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMs(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${Math.round(value).toLocaleString()} ms`
}

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return '0.0%'
  return `${value.toFixed(1)}%`
}

function defectGroupOf(defect: DefectDetail): { key: string; label: string; color: string } | null {
  const type = defect.defectType

  if (type.startsWith('MISSING:')) {
    const cls = type.split(':')[1] ?? 'UNKNOWN'
    return {
      key: `MISSING:${cls}`,
      label: `${defectDisplayName(cls)} 누락`,
      color: defectColor(type),
    }
  }

  if (type.startsWith('ANOMALY:')) {
    return {
      key: 'ANOMALY',
      label: '이상 탐지',
      color: defectColor(type),
    }
  }

  if (NORMAL_LABEL_CLASSES.has(type)) return null

  return {
    key: type,
    label: defectDisplayName(type),
    color: defectColor(type),
  }
}

function buildDetailedStats(logs: InspectionLog[]) {
  const passCount = logs.filter((log) => log.result === 'PASS').length
  const failCount = logs.filter((log) => log.result === 'FAIL').length
  const inspectedCount = passCount + failCount

  const inferenceTimes = logs
    .map((log) => log.inferenceTimeMs)
    .filter((value): value is number => value != null && Number.isFinite(value))

  const timeSum = inferenceTimes.reduce((sum, value) => sum + value, 0)
  const avgTime = inferenceTimes.length ? timeSum / inferenceTimes.length : null
  const minTime = inferenceTimes.length ? Math.min(...inferenceTimes) : null
  const maxTime = inferenceTimes.length ? Math.max(...inferenceTimes) : null

  const defectMap = new Map<string, Omit<DefectStat, 'rate'>>()
  logs.forEach((log) => {
    log.defects.forEach((defect) => {
      const group = defectGroupOf(defect)
      if (!group) return
      const current = defectMap.get(group.key)
      if (current) {
        current.count += 1
      } else {
        defectMap.set(group.key, { ...group, count: 1 })
      }
    })
  })

  const totalDefects = Array.from(defectMap.values()).reduce((sum, stat) => sum + stat.count, 0)
  const defectStats: DefectStat[] = Array.from(defectMap.values())
    .map((stat) => ({
      ...stat,
      rate: totalDefects ? (stat.count / totalDefects) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    totalCount: logs.length,
    passCount,
    failCount,
    inspectedCount,
    normalRate: inspectedCount ? (passCount / inspectedCount) * 100 : 0,
    errorRate: inspectedCount ? (failCount / inspectedCount) * 100 : 0,
    avgTime,
    minTime,
    maxTime,
    totalDefects,
    defectStats,
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  bgClass = 'bg-white',
}: {
  icon: typeof Activity
  label: string
  value: string
  hint: string
  bgClass?: string
}) {
  return (
    <div className={`rounded-xl border border-Black-10% ${bgClass} p-4 shadow-sm`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-Black-40%">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-Black-4%">
          <Icon size={16} className="text-Black-80%" />
        </span>
      </div>
      <div className="text-2xl font-bold text-Black-100%">{value}</div>
      <div className="mt-1 text-xs text-Black-40%">{hint}</div>
    </div>
  )
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-Black-40%">
      {label}
    </div>
  )
}

function FilterButton({
  label,
  value,
  current,
  count,
  onClick,
}: {
  label: string
  value: ResultFilter
  current: ResultFilter
  count: number
  onClick: (value: ResultFilter) => void
}) {
  const active = value === current
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={[
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-Black-4% text-Black-40% hover:bg-Black-10% hover:text-Black-100%',
      ].join(' ')}
    >
      {label}
      <span className={active ? 'rounded-full bg-white/30 px-1.5 py-0.5' : 'rounded-full bg-Black-10% px-1.5 py-0.5'}>
        {count}
      </span>
    </button>
  )
}

export default function DetailedStatsPage() {
  const { data: logs = [], isLoading } = useAllInspections()
  const today = getLocalDateString()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(today)
  const [resultFilter, setResultFilter] = useState<ResultFilter>('ALL')

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (log.result === 'SKIPPED') return false
      if (resultFilter !== 'ALL' && log.result !== resultFilter) return false

      const logDate = log.inspectedAt.slice(0, 10)
      if (dateFrom && logDate < dateFrom) return false
      if (dateTo && logDate > dateTo) return false

      return true
    })
  }, [logs, resultFilter, dateFrom, dateTo])

  const stats = useMemo(() => buildDetailedStats(filteredLogs), [filteredLogs])

  const resetFilters = () => {
    setDateFrom('')
    setDateTo(today)
    setResultFilter('ALL')
  }

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="rounded-xl border border-Black-10% bg-white p-6 text-sm text-Black-40%">
          상세 통계를 불러오는 중입니다.
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-Black-100%">상세 통계</h2>
        <p className="text-xs text-Black-40%">
          전체 검사 이력 기준 품질 지표, 검출 시간, 오류 유형 분포를 한 화면에서 확인합니다.
        </p>
      </div>

      <section className="rounded-xl border border-Black-10% bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-Black-40%" />
            <h3 className="text-sm font-semibold text-Black-100%">통계 범위 필터</h3>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-red-800 bg-white px-3 py-1.5 text-xs font-medium text-red-800 transition-colors hover:bg-Black-4% hover:text-Black-100%"
          >
            초기화
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="mb-2 text-Black-40%" />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-Black-40%">시작일</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo || today}
                className="rounded-lg border border-Black-10% bg-Black-4% px-3 py-1.5 text-xs text-Black-80% focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <span className="mb-2 text-sm text-Black-40%">~</span>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-Black-40%">종료일</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom}
                max={today}
                className="rounded-lg border border-Black-10% bg-Black-4% px-3 py-1.5 text-xs text-Black-80% focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <FilterButton label="전체" value="ALL" current={resultFilter} count={logs.filter((log) => log.result !== 'SKIPPED').length} onClick={setResultFilter} />
            <FilterButton label="PASS" value="PASS" current={resultFilter} count={logs.filter((log) => log.result === 'PASS').length} onClick={setResultFilter} />
            <FilterButton label="FAIL" value="FAIL" current={resultFilter} count={logs.filter((log) => log.result === 'FAIL').length} onClick={setResultFilter} />
          </div>
        </div>

        <div className="mt-3 text-xs text-Black-40%">
          필터 적용 결과 <span className="font-semibold text-Black-100%">{filteredLogs.length.toLocaleString()}건</span>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Activity}
          label="전체 검사"
          value={`${stats.totalCount.toLocaleString()}건`}
          hint={`필터 범위 PASS/FAIL ${stats.inspectedCount.toLocaleString()}건`}
          bgClass="bg-[#E3F5FF]"
        />
        <StatCard
          icon={CheckCircle2}
          label="정상률"
          value={formatRate(stats.normalRate)}
          hint={`정상 ${stats.passCount.toLocaleString()}건`}
          bgClass="bg-[#F0F9E8]"
        />
        <StatCard
          icon={AlertTriangle}
          label="오류율"
          value={formatRate(stats.errorRate)}
          hint={`오류 ${stats.failCount.toLocaleString()}건`}
          bgClass="bg-[#FFF4E5]"
        />
        <StatCard
          icon={Gauge}
          label="오류 종류"
          value={`${stats.defectStats.length.toLocaleString()}종`}
          hint={`오류 라벨 ${stats.totalDefects.toLocaleString()}개`}
          bgClass="bg-[#E5ECF6]"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <section className="rounded-xl border border-Black-10% bg-white p-4 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-Black-100%">검출 시간</h3>
              <p className="mt-1 text-xs text-Black-40%">inference time 기준 요약</p>
            </div>
            <Clock3 size={16} className="text-Black-40%" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard icon={Clock3} label="최대 검출 시간" value={formatMs(stats.maxTime)} hint="가장 오래 걸린 검사" />
            <StatCard icon={Clock3} label="평균 검출 시간" value={formatMs(stats.avgTime)} hint="기록된 검출 시간 평균" />
            <StatCard icon={Clock3} label="최소 검출 시간" value={formatMs(stats.minTime)} hint="가장 빠른 검사" />
            <StatCard icon={Activity} label="검출 시간 표본" value={`${stats.inspectedCount.toLocaleString()}건`} hint="PASS/FAIL 검사 기준" />
          </div>
        </section>

        <section className="rounded-xl border border-Black-10% bg-white p-4 shadow-sm xl:col-span-3">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-Black-100%">오류 유형 상세</h3>
            <p className="mt-1 text-xs text-Black-40%">건수와 비율을 함께 표시</p>
          </div>
          <div className="overflow-hidden rounded-lg border border-Black-10%">
            <table className="w-full text-left text-sm">
              <thead className="bg-Black-4% text-xs text-Black-40%">
                <tr>
                  <th className="px-3 py-2 font-medium">오류 종류</th>
                  <th className="px-3 py-2 font-medium">건수</th>
                  <th className="px-3 py-2 font-medium">비율</th>
                </tr>
              </thead>
              <tbody>
                {stats.defectStats.length ? (
                  stats.defectStats.map((stat) => (
                    <tr key={stat.key} className="border-t border-Black-10%">
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stat.color }} />
                          {stat.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-Black-100%">{stat.count.toLocaleString()}</td>
                      <td className="px-3 py-2 text-Black-80%">{formatRate(stat.rate)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-8 text-center text-Black-40%" colSpan={3}>
                      오류 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div>
        <section className="rounded-xl border border-Black-10% bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-Black-100%">오류 종류</h3>
            <p className="mt-1 text-xs text-Black-40%">오류 라벨별 누적 건수</p>
          </div>
          {stats.defectStats.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.defectStats.slice(0, 8)} margin={{ top: 8, right: 12, left: -20, bottom: 18 }}>
                <CartesianGrid stroke="rgba(28, 28, 28, 0.1)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} dy={8} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [`${value}개`, '오류 라벨']}
                  contentStyle={{
                    background: '#FFFFFF',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(28, 28, 28, 0.1)',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                  itemStyle={{
                    color: '#ef4444',
                    fontWeight: 700,
                  }}
                  labelStyle={{
                    color: 'rgba(28, 28, 28, 0.8)',
                    fontSize: 14,
                    fontWeight: 400,
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {stats.defectStats.slice(0, 8).map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyPanel label="오류 데이터가 없습니다." />
          )}
        </section>
      </div>

      <section>
        <FailRateTrendChart />
      </section>
    </div>
  )
}
