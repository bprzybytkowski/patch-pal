import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

interface PendingConnection {
  from: string
  to: string
}

export interface UseConnectionDrawingResult {
  armedDevice: string | null
  pending: PendingConnection | null
  arm: (deviceName: string) => void
  complete: (targetName: string) => void
  cancel: () => void
  dismissPending: () => void
}

export function useConnectionDrawing(): UseConnectionDrawingResult {
  const [armedDevice, setArmedDevice] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingConnection | null>(null)

  const arm = (deviceName: string) => {
    setArmedDevice((prev) => (prev === deviceName ? null : deviceName))
  }

  const complete = (targetName: string) => {
    if (!armedDevice || armedDevice === targetName) return
    setPending({ from: armedDevice, to: targetName })
    setArmedDevice(null)
  }

  const cancel = () => {
    setArmedDevice(null)
  }

  const dismissPending = () => {
    setPending(null)
  }

  return { armedDevice, pending, arm, complete, cancel, dismissPending }
}
