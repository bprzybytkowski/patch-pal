import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { useThemeStore } from '../store/theme'
import { usePostHog } from '@posthog/react'

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useThemeStore()
  return (
    <div
      role="group"
      aria-label="Theme"
      className="flex overflow-hidden rounded-[2px] border border-ink font-mono uppercase"
      style={{ fontSize: compact ? 8 : 9, letterSpacing: compact ? '0.16em' : '0.18em' }}
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className="font-semibold transition-colors"
        style={{
          padding: compact ? '5px 8px' : '6px 9px',
          background: theme === 'light' ? 'rgb(var(--ink))' : 'transparent',
          color: theme === 'light' ? 'rgb(var(--paper))' : 'rgb(var(--ink))',
        }}
      >
        {compact ? '☼' : '☼ Paper'}
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className="font-semibold transition-colors"
        style={{
          padding: compact ? '5px 8px' : '6px 9px',
          background: theme === 'dark' ? 'rgb(var(--ink))' : 'transparent',
          color: theme === 'dark' ? 'rgb(var(--paper))' : 'rgb(var(--ink))',
        }}
      >
        {compact ? '☾' : '☾ Ink'}
      </button>
    </div>
  )
}

export { ThemeToggle }

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
    <div className="relative z-10 min-h-screen">
      {/* Desktop header */}
      <nav className="hidden sm:flex items-end justify-between px-8 py-5 border-b border-rule/60">
        <div className="flex items-baseline gap-3">
          <h1 className="font-serif text-3xl font-semibold tracking-[-0.01em] leading-none text-ink">
            patch-pal
          </h1>
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-ink-muted">
            Studio journal · vol. 02
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <NavLink
            to="/sessions"
            className={({ isActive }) =>
              `font-mono text-[10px] tracking-[0.18em] uppercase font-semibold ${
                isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            Sessions
          </NavLink>
          <NavLink
            to="/devices"
            className={({ isActive }) =>
              `font-mono text-[10px] tracking-[0.18em] uppercase font-semibold ${
                isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            Gear
          </NavLink>
          <button
            onClick={handleLogout}
            className="font-mono text-[9px] tracking-[0.18em] uppercase text-ink-muted hover:text-ink"
          >
            Log out
          </button>
        </div>
      </nav>

      {/* Mobile header */}
      <div className="flex sm:hidden items-center justify-between px-5 py-3 border-b border-rule/60 sticky top-0 z-20 bg-paper/90 backdrop-blur-sm">
        <div>
          <h1 className="font-serif text-2xl font-semibold tracking-[-0.01em] leading-none text-ink">
            patch-pal
          </h1>
          <div className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted mt-0.5">
            Studio journal
          </div>
        </div>
        <ThemeToggle compact />
      </div>

      <Outlet />
    </div>
  )
}
