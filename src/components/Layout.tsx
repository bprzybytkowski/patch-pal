import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { usePostHog } from '@posthog/react'

export default function Layout() {
  const setUser = useAuthStore((s) => s.setUser)
  const navigate = useNavigate()
  const posthog = usePostHog()

  const handleLogout = async () => {
    posthog.capture('user_logged_out')
    posthog.reset()
    await supabase.auth.signOut()
    setUser(null)
    navigate('/auth')
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <nav className="border-b border-zinc-800 px-6 py-3 flex items-center gap-6">
        <NavLink
          to="/sessions"
          className={({ isActive }) =>
            `text-sm font-medium ${isActive ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'}`
          }
        >
          Sessions
        </NavLink>
        <NavLink
          to="/devices"
          className={({ isActive }) =>
            `text-sm font-medium ${isActive ? 'text-zinc-100' : 'text-zinc-400 hover:text-zinc-100'}`
          }
        >
          Devices
        </NavLink>
        <button
          onClick={handleLogout}
          className="ml-auto text-sm text-zinc-400 hover:text-zinc-100"
        >
          Log out
        </button>
      </nav>
      <Outlet />
    </div>
  )
}
