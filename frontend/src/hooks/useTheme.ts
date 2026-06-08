/**
 * 다크/라이트 테마 토글 훅
 *
 * localStorage('aicapstone:theme')에 'dark' | 'light'를 저장하고
 * <body>에 'theme-dark' 클래스를 토글하여 index.css의 다크 오버라이드를 적용한다.
 *
 * 기본값: 'light' (SnowUI 라이트 테마)
 */

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'aicapstone:theme'

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'dark' ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)

  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark')
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))

  return { theme, toggleTheme }
}
