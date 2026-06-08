/**
 * 루트 애플리케이션 컴포넌트 (SnowUI 라이트 테마).
 *
 * 레이아웃:
 * ┌─ Sidebar (208px) ─┬─ Header ────────────────────────────┐
 * │  메뉴 4개          │  ┌── <Outlet /> ───────────────────┐│
 * │  대시보드/이력/    │  │  Dashboard / History / ...      ││
 * │  PCB 정보/설정     │  │                                  ││
 * └───────────────────┴──────────────────────────────────────┘
 */

import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Header from '@/components/common/Header'
import Sidebar from '@/components/common/Sidebar'
import DashboardPage from '@/pages/DashboardPage'
import DetailedStatsPage from '@/pages/DetailedStatsPage'
import HistoryPage from '@/pages/HistoryPage'
import BoardReferencePage from '@/pages/BoardReferencePage'
import DatasetImagesPage from '@/pages/DatasetImagesPage'
import SettingsPage from '@/pages/SettingsPage'
import { useTheme } from '@/hooks/useTheme'

export default function App() {
  /* 라이트/다크 테마 (헤더의 테마 버튼으로 토글) */
  const { theme, toggleTheme } = useTheme()

  /* 사이드바 열림/닫힘 상태 (헤더의 토글 버튼으로 제어) */
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex h-screen bg-[#F4F6F8] text-Black-100% overflow-hidden">

      <Sidebar collapsed={!sidebarOpen} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1 overflow-y-auto bg-[#F4F6F8]">
          <Routes>
            <Route path="/"                element={<DashboardPage />} />
            <Route path="/detailed-stats"  element={<DetailedStatsPage />} />
            <Route path="/stats"           element={<Navigate to="/detailed-stats" replace />} />
            <Route path="/history"         element={<HistoryPage />} />
            <Route path="/board-reference" element={<BoardReferencePage />} />

            {/* 라벨링 데이터셋 이미지 */}
            <Route path="/dataset-images" element={<DatasetImagesPage />} />

            {/* 설정 */}
            <Route path="/settings" element={<SettingsPage />} />

            {/* 정의되지 않은 경로는 루트로 리다이렉트 */}
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
