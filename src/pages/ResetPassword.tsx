import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import { useThemeStore } from '../store/theme'
import BrandMark from '../components/BrandMark'

type Fields = { password: string; confirmPassword: string }

const FIELD_INPUT: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1.5px solid rgb(var(--ink))',
  padding: '8px 0 6px',
  fontFamily: '"Spectral", serif',
  fontStyle: 'italic',
  fontSize: 17,
  color: 'rgb(var(--ink))',
  outline: 'none',
}

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore()
  return (
    <div
      className="flex border border-ink rounded-[2px] overflow-hidden font-mono text-[9px] tracking-[0.18em] uppercase"
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`px-[9px] py-[6px] font-semibold select-none ${
          theme === 'light' ? 'bg-ink text-paper' : 'bg-transparent text-ink'
        }`}
      >
        ☼ Paper
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`px-[9px] py-[6px] font-semibold select-none ${
          theme === 'dark' ? 'bg-ink text-paper' : 'bg-transparent text-ink'
        }`}
      >
        ☾ Ink
      </button>
    </div>
  )
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const { theme } = useThemeStore()

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Fields>({
    shouldUnregister: true,
  })

  const onSubmit = async ({ password }: Fields) => {
    setServerError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setServerError(error.message); return }
    navigate('/sessions')
  }

  const cardShadow =
    theme === 'dark'
      ? '0 1px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.4), 0 30px 60px rgba(0,0,0,0.3)'
      : '0 1px 0 rgba(40,30,10,0.05), 0 10px 24px rgba(80,55,20,0.12), 0 30px 60px rgba(80,55,20,0.08)'

  return (
    <div
      className="min-h-screen flex flex-col items-center pt-14 pb-10 px-4 relative"
      style={{ background: 'var(--page-bg-grad)' }}
    >
      {/* Top bar */}
      <div className="w-full max-w-[920px] flex justify-between items-end mb-7 relative z-10">
        <div className="flex items-center gap-3">
          <BrandMark size={36} />
          <div className="flex flex-col gap-0.5">
            <h1 className="font-serif text-[30px] font-semibold tracking-[-0.01em] leading-none text-ink">
              patch-pal
            </h1>
            <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-ink-muted">
              Studio journal · vol. 02
            </div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Card */}
      <div
        className="w-full max-w-[440px] relative rounded-[4px] border border-rule-soft flex flex-col gap-[18px] z-10"
        style={{ padding: '40px 38px 34px', background: 'var(--paper-grad)', boxShadow: cardShadow }}
      >
        {/* Tape strip */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -8, left: 38, width: 96, height: 16,
            background: theme === 'dark' ? 'rgba(244,211,94,0.55)' : 'rgba(244,211,94,0.85)',
            borderLeft: '1px solid rgba(120,90,30,0.18)',
            borderRight: '1px solid rgba(120,90,30,0.18)',
            transform: 'rotate(-2deg)',
            boxShadow: '0 1px 2px rgba(40,30,10,0.18)',
          }}
        />
        {/* Stamp */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 22, right: 24,
            border: '2px solid rgb(var(--accent))',
            color: 'rgb(var(--accent))',
            padding: '3px 8px 2px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 9,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            fontWeight: 700,
            transform: 'rotate(-8deg)',
            opacity: 0.85,
          }}
        >
          New key
        </div>

        <div>
          <h2 className="font-serif text-[30px] font-semibold tracking-[-0.02em] leading-[1.05] text-ink mt-1">
            Set new password
          </h2>
          <p className="font-serif italic text-[15px] text-ink-soft leading-[1.5] mt-1.5">
            Choose something you'll remember at 2am.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="contents" noValidate>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="password"
              className="font-mono text-[9px] tracking-[0.24em] uppercase text-ink-muted font-semibold"
            >
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              style={FIELD_INPUT}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'At least 8 characters' },
              })}
            />
            {errors.password && (
              <p className="font-serif italic text-[14px] text-accent">{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="confirmPassword"
              className="font-mono text-[9px] tracking-[0.24em] uppercase text-ink-muted font-semibold"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              style={FIELD_INPUT}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (val) => val === watch('password') || 'Passwords do not match',
              })}
            />
            {errors.confirmPassword && (
              <p className="font-serif italic text-[14px] text-accent">{errors.confirmPassword.message}</p>
            )}
          </div>

          {serverError && (
            <div
              style={{
                background: 'rgb(var(--accent-soft))',
                border: '1px solid rgb(var(--accent))',
                borderRadius: 2,
                padding: '8px 12px',
              }}
              className="font-serif italic text-[13px] text-accent"
            >
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{ background: 'rgb(var(--btn-bg))', boxShadow: '3px 3px 0 rgb(var(--accent))' }}
            className="w-full text-btn-text px-[18px] py-[13px] font-mono text-[11px] tracking-[0.22em] uppercase font-bold rounded-[2px] mt-1 disabled:opacity-50 cursor-pointer"
          >
            Update password →
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-6 font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted text-center relative z-10">
        Made for hardware that forgets · v0.4
      </div>
    </div>
  )
}
