import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import posthog from 'posthog-js'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/auth'
import { router } from './router'
import { ToastContainer } from './components/Toast'

export default function App() {
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setUser(user)
      if (!user) posthog.reset()
    })
    return () => subscription.unsubscribe()
  }, [setUser])

  return (
    <div className="bg-zinc-950 min-h-screen">
      <RouterProvider router={router} />
      <ToastContainer />
    </div>
  )
}
