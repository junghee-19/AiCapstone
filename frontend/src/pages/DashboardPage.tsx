/**
 * 메인 대시보드 페이지
 *
 * 레이아웃 구성:
 * ┌──────────────────────────────────────────────────┐
 * │  [StatCard × 4]  전체/합격/불합격/불량률           │
 * ├─────────────────────┬────────────────────────────│
 * │  PassFailChart      │  TrendChart                │
 * │  (도넛 차트)          │  (스택 막대 차트)            │
 * ├─────────────────────┴────────────────────────────│
 * │  InspectionTable  (최근 15건 실시간 피드)           │
 * └──────────────────────────────────────────────────┘
 */

import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, FolderOpen, Loader2, Trash2 } from 'lucide-react'
import StatCardGroup from '@/components/dashboard/StatCard'
import PassFailChart from '@/components/dashboard/PassFailChart'
import FailRateTrendChart from '@/components/dashboard/FailRateTrendChart'
import TrendChart from '@/components/dashboard/TrendChart'
import InspectionTable from '@/components/inspection/InspectionTable'
import { deleteAllInspections, inspectImage } from '@/api/inspectionApi'
import { useRecentInspections } from '@/hooks/useInspectionData'

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  /* 최근 15건 — 대시보드 하단 실시간 피드 테이블 */
  const { data: recentLogs = [], isLoading } = useRecentInspections(15)

  const invalidateInspections = () => {
    queryClient.invalidateQueries({ queryKey: ['inspections'] })
  }

  // 업로드 검사 — 파일 업로드 → Spring → inference-service → DB 저장
  const uploadInspectMutation = useMutation({
    mutationFn: inspectImage,
    onSuccess: (data) => {
      setActionMsg({ type: 'ok', text: `검사 완료 — 결과: ${data.result}` })
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      invalidateInspections()
    },
    onError: (e: Error) => {
      setActionMsg({ type: 'err', text: e.message || '업로드 검사 실패' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAllInspections,
    onSuccess: () => {
      setActionMsg({ type: 'ok', text: '검사 이력이 모두 삭제되었습니다.' })
      invalidateInspections()
    },
    onError: (e: Error) => {
      setActionMsg({ type: 'err', text: e.message || '삭제 실패' })
    },
  })

  // 지금 검사 — 카메라/소켓 기반 (API 미연결 상태)
  const handleInstantInspectClick = () => {
    setActionMsg({
      type: 'err',
      text: '지금 검사 기능은 아직 준비 중입니다. 업로드 검사를 사용해주세요.',
    })
  }

  const handleDeleteHistory = () => {
    if (
      !window.confirm(
        '저장된 검사 이력과 결함 기록을 모두 삭제합니다. 계속할까요?'
      )
    ) {
      return
    }
    deleteMutation.mutate()
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">

      {/* 페이지 제목 + 액션 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">실시간 대시보드</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            검사 이력·통계 자동 갱신 · 이미지 업로드로 PCB 검사 가능
          </p>
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 min-w-[min(100%,280px)]">
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={handleInstantInspectClick}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
            >
              <Camera size={16} />
              지금 검사
            </button>
            <button
              type="button"
              onClick={handleDeleteHistory}
              disabled={deleteMutation.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-red-950/80 border border-gray-700 hover:border-red-900 text-gray-200 disabled:opacity-50 transition-colors"
            >
              {deleteMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              이력 전체 삭제
            </button>
          </div>

          {/* 업로드 검사 — 파일 선택 + 업로드 검사 버튼 */}
          <div className="flex flex-col gap-2 w-full sm:max-w-md">
            <label className="text-[11px] text-gray-500 font-medium uppercase tracking-wide block">
              로컬 이미지 업로드로 검사
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.bmp,.webp,image/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-gray-300 file:mr-2 file:px-2 file:py-1.5 file:rounded-md file:border-0 file:bg-gray-800 file:text-gray-200"
              />
              <button
                type="button"
                onClick={() => {
                  if (!uploadFile) return
                  setActionMsg(null)
                  uploadInspectMutation.mutate(uploadFile)
                }}
                disabled={!uploadFile || uploadInspectMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white transition-colors"
              >
                {uploadInspectMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FolderOpen size={16} />
                )}
                업로드 검사
              </button>
            </div>
            <p className="text-[11px] text-gray-600 leading-snug">
              업로드 이미지는 백엔드를 거쳐 inference-service에서 검사됩니다.
            </p>
          </div>
        </div>
      </div>

      {actionMsg && (
        <p
          className={
            actionMsg.type === 'ok'
              ? 'text-xs text-emerald-400/90'
              : 'text-xs text-red-400/90'
          }
        >
          {actionMsg.text}
        </p>
      )}

      {/* 1행: 통계 카드 4개 */}
      <StatCardGroup />

      {/* 2행: 도넛 차트 + 트렌드 차트 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* PassFailChart: 2/5 너비 */}
        <div className="lg:col-span-2">
          <PassFailChart />
        </div>
        {/* TrendChart: 3/5 너비 */}
        <div className="lg:col-span-3">
          <TrendChart />
        </div>
      </div>

      <div>
        <FailRateTrendChart />
      </div>

      {/* 3행: 실시간 이력 테이블 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">최근 검사 이력</h2>
          <span className="text-xs text-gray-500">최근 15건</span>
        </div>
        <InspectionTable logs={recentLogs} isLoading={isLoading} />
      </div>
    </div>
  )
}
