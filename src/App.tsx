import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/auth'
import { router } from './router'

import { ToastContainer } from './components/Toast'

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
    <div className="bg-zinc-950 min-h-screen">
      <RouterProvider router={router} />
      <ToastContainer />
    </div>
  )
}
