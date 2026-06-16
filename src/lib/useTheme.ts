import { useState, useCallback, useEffect } from 'react'

const LS_KEY = 'nidou_dark_mode'

function readDark(): boolean {
  const stored = localStorage.getItem(LS_KEY)
  if (stored !== null) return stored === 'true'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function useTheme() {
  const [dark, setDark] = useState(readDark)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(LS_KEY, String(dark))
  }, [dark])

  const toggle = useCallback(() => setDark((d) => !d), [])

  return { dark, toggle }
}
