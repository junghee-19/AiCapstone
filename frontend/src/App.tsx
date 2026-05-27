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

import { Routes, Route, Navigate } from 'react-router-dom'
import Header from '@/components/common/Header'
import Sidebar from '@/components/common/Sidebar'
import DashboardPage from '@/pages/DashboardPage'
import HistoryPage from '@/pages/HistoryPage'
import BoardReferencePage from '@/pages/BoardReferencePage'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-Black-40% text-sm">{title} — 준비 중</p>
    </div>
  )
}

export default function App() {
  return (
    <div className="flex h-screen bg-Background-1 text-Black-100% overflow-hidden">

      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-Background-1">
          <Routes>
            <Route path="/"                element={<DashboardPage />} />
            <Route path="/history"         element={<HistoryPage />} />
            <Route path="/board-reference" element={<BoardReferencePage />} />
            <Route path="/settings"        element={<PlaceholderPage title="설정" />} />
            <Route path="*"                element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
