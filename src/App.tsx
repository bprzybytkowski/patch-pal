import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/auth'
import { useThemeStore } from './store/theme'
import { router } from './router'
import { ToastContainer } from './components/Toast'

function ThemeSync() {
  const { theme, setTheme } = useThemeStore((s) => ({ theme: s.theme, setTheme: s.setTheme }))

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    setTheme(mql.matches ? 'dark' : 'light')
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [setTheme])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return null
}

export default function App() {
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') router.navigate('/reset-password')
    })
    return () => subscription.unsubscribe()
  }, [setUser])

  return (
    <>
      <ThemeSync />
      <RouterProvider router={router} />
      <ToastContainer />
    </>
  )
}
