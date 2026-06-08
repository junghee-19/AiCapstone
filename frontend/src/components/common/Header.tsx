/**
 * 상단 헤더 (SnowUI 라이트 테마).
 *
 * 좌측: 사이드바 토글·즐겨찾기 아이콘 + breadcrumb (Dashboards / Default)
 * 우측: Search + 테마·기록·전체화면 아이콘 + 라이브 폴링 상태
 *
 * 동작 기능:
 * - 검색   : 검사 이력을 ID/디바이스/결과/결함으로 즉시 검색 (단축키 "/")
 * - 테마   : 라이트/다크 테마 토글
 * - 기록   : 검사 이력 페이지(/history)로 이동
 * - 전체화면: 브라우저 전체화면 토글
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  PanelLeft, Search,
  Sun, Moon, History, Maximize2, Minimize2, Activity, X,
} from 'lucide-react'
import clsx from 'clsx'
import { useStats, useAllInspections } from '@/hooks/useInspectionData'
import { defectDisplayName } from '@/types/inspection'

/** 경로별 breadcrumb 라벨 */
const ROUTE_LABEL: Record<string, string> = {
  '/':                '대시보드',
  '/detailed-stats':  '상세 통계',
  '/stats':           '상세 통계',
  '/history':         '검사 이력',
  '/board-reference': 'PCB 정보',
  '/settings':        '설정',
}

interface HeaderProps {
  /** 사이드바 열림/닫힘을 토글한다 */
  onToggleSidebar?: () => void
  /** 현재 테마 */
  theme?: 'dark' | 'light'
  /** 라이트/다크 테마를 토글한다 */
  onToggleTheme?: () => void
}

/** 시각을 'MM/DD HH:mm:ss' 형식으로 표시 */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function Header({ onToggleSidebar, theme, onToggleTheme }: HeaderProps) {
  const { isFetching, dataUpdatedAt } = useStats()
  const { data: allLogs = [] } = useAllInspections()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const currentLabel = ROUTE_LABEL[pathname] ?? '대시보드'

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('ko-KR')
    : '--:--:--'

  // ── 검색 패널 상태 ──────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  /* 검색 패널이 열리면 입력란에 포커스 */
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  /* 단축키: "/" 로 검색 열기, Esc 로 닫기 */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (e.key === '/' && !typing) {
        e.preventDefault()
        setSearchOpen(true)
      } else if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── 검색 결과 ───────────────────────────────────────────────────────────────
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return allLogs
      .filter((l) =>
        String(l.id).includes(q) ||
        l.deviceId.toLowerCase().includes(q) ||
        l.result.toLowerCase().includes(q) ||
        l.defects.some((d) => defectDisplayName(d.defectType).toLowerCase().includes(q)),
      )
      .slice(0, 8)
  }, [allLogs, query])

  // ── 전체화면 ────────────────────────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  // ── 네비게이션 헬퍼 ─────────────────────────────────────────────────────────
  const goHistory = () => {
    setSearchOpen(false)
    navigate('/history')
  }

  const iconBtn = 'p-1 rounded-xl hover:bg-Black-4% text-Black-100% transition-colors'

  return (
    <header className="relative h-14 px-7 py-5 border-b border-Black-10% flex justify-between items-center bg-white/95 shadow-[0_6px_18px_rgba(28,28,28,0.035)] shrink-0">

      {/* 좌측: 사이드바 토글 + 즐겨찾기 + breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleSidebar}
            className={iconBtn}
            aria-label="사이드바 토글"
          >
            <PanelLeft size={16} />
          </button>
        </div>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs leading-4">
          <span className="px-3 py-1 text-Black-40%">Dashboards</span>
          <span className="text-Black-10%">/</span>
          <span className="px-3 py-1 text-Black-100%">{currentLabel}</span>
        </nav>
      </div>

      {/* 우측: 검색 + 아이콘 + 라이브 인디케이터 */}
      <div className="flex items-center gap-5">

        {/* 검색 (클릭 또는 "/" 로 패널 열기) */}
        <button
          type="button"
          onClick={() => setSearchOpen((prev) => !prev)}
          className="w-40 px-2 py-1 bg-[#F4F6F8] border border-Black-10% rounded-2xl flex items-center gap-2 hover:border-Black-20% transition-colors"
          aria-label="검색"
        >
          <Search size={14} className="text-Black-20%" />
          <span className="flex-1 text-left text-sm text-Black-20% leading-5">Search</span>
          <span className="w-5 text-center text-xs text-Black-20% rounded border border-Black-10% leading-4">/</span>
        </button>

        {/* 아이콘 3개 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className={iconBtn}
            aria-label={theme === 'light' ? '다크 모드' : '라이트 모드'}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <button type="button" onClick={goHistory} className={iconBtn} aria-label="검사 이력">
            <History size={16} />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className={iconBtn}
            aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        {/* 실시간 폴링 인디케이터 (도메인 — PCB 검사 시스템) */}
        <div className="flex items-center gap-2 pl-4 border-l border-Black-10%">
          <span
            className={`w-2 h-2 rounded-full ${
              isFetching ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'
            }`}
          />
          <span className="text-xs text-Black-40%">
            {isFetching ? '갱신 중' : 'LIVE'}
          </span>
          <span className="hidden lg:inline-flex items-center gap-1 text-xs text-Black-40%">
            <Activity size={12} />
            {lastUpdated}
          </span>
        </div>
      </div>

      {/* ── 검색 백드롭 (바깥 클릭 시 닫힘) ────────────────────────────────── */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSearchOpen(false)}
          aria-hidden
        />
      )}

      {/* ── 검색 패널 ──────────────────────────────────────────────────────── */}
      {searchOpen && (
        <div className="absolute right-7 top-full mt-2 z-50 w-96 max-w-[calc(100vw-3.5rem)] bg-white border border-Black-10% rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-Black-10%">
            <Search size={15} className="text-Black-40% shrink-0" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ID · 디바이스 · 결과(PASS/FAIL) · 결함명 검색"
              className="flex-1 bg-transparent text-sm text-Black-100% placeholder:text-Black-20% focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="p-0.5 rounded hover:bg-Black-4% text-Black-40%"
              aria-label="검색 닫기"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {query.trim() === '' ? (
              <p className="px-4 py-6 text-center text-xs text-Black-40%">
                검색어를 입력하세요.
              </p>
            ) : results.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-Black-40%">
                일치하는 검사 이력이 없습니다.
              </p>
            ) : (
              results.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={goHistory}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-Black-4% transition-colors"
                >
                  <span className="text-xs font-mono text-Black-40% w-12 shrink-0">#{log.id}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'text-xs font-semibold',
                          log.result === 'FAIL' ? 'text-red-600'
                            : log.result === 'PASS' ? 'text-emerald-600'
                            : 'text-Black-40%',
                        )}
                      >
                        {log.result}
                      </span>
                      <span className="text-xs text-Black-80% truncate">{log.deviceId}</span>
                    </div>
                    <div className="text-[11px] text-Black-40% truncate">
                      {formatTime(log.inspectedAt)}
                      {log.defects.length > 0 && ` · 결함 ${log.defects.length}건`}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </header>
  )
}
