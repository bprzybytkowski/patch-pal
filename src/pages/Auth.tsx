import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { usePostHog } from '@posthog/react'
import { useThemeStore } from '../store/theme'
import BrandMark from '../components/BrandMark'
import { ThemeToggle } from '../components/Layout'

type Tab = 'signin' | 'signup'
type View = 'form' | 'signed-up' | 'forgot' | 'forgot-sent'
type Fields = { email: string; password: string; confirmPassword: string }

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


export default function AuthPage() {
  const [tab, setTab] = useState<Tab>('signin')
  const [view, setView] = useState<View>('form')
  const [serverError, setServerError] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const posthog = usePostHog()
  const { theme } = useThemeStore()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<Fields>({ shouldUnregister: true })

  const switchTab = (next: Tab) => {
    setTab(next)
    setServerError('')
    reset()
  }

  const onSubmit = async ({ email, password }: Fields) => {
    setServerError('')
    if (tab === 'signin') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setServerError(error.message); return }
      setUser(data.user)
      posthog.identify(data.user.id, { email: data.user.email })
      posthog.capture('user_signed_in')
      navigate('/sessions')
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setServerError(error.message); return }
      if (data.user?.identities?.length === 0) {
        setServerError('An account with this email already exists.')
        return
      }
      posthog.capture('user_signed_up', { email })
      setSentEmail(email)
      setView('signed-up')
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail.trim()) return
    setForgotSubmitting(true)
    setForgotError('')
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setForgotSubmitting(false)
    if (error) { setForgotError(error.message); return }
    setSentEmail(forgotEmail.trim())
    setView('forgot-sent')
  }

  const stamp =
    view === 'form' ? 'Vol · 02'
    : view === 'forgot' ? 'Reset'
    : 'Sent'

  const cardShadow =
    theme === 'dark'
      ? '0 1px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.4), 0 30px 60px rgba(0,0,0,0.3)'
      : '0 1px 0 rgba(40,30,10,0.05), 0 10px 24px rgba(80,55,20,0.12), 0 30px 60px rgba(80,55,20,0.08)'

  return (
    <div
      data-testid="auth-page"
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
          {stamp}
        </div>

        {/* ── SIGN IN / SIGN UP FORM ── */}
        {view === 'form' && (
          <>
            <div>
              <h2 className="font-serif text-[30px] font-semibold tracking-[-0.02em] leading-[1.05] text-ink mt-1">
                {tab === 'signup' ? 'Start a new journal' : 'Open the journal'}
              </h2>
              <p className="font-serif italic text-[15px] text-ink-soft leading-[1.5] mt-1.5">
                {tab === 'signup'
                  ? 'Logbook for every patch, every BPM, every fleeting jam.'
                  : 'Pick up where you left off.'}
              </p>
            </div>

            {/* Tab strip */}
            <div style={{ borderBottom: '1.5px solid rgb(var(--ink))' }} className="flex">
              <button
                role="tab"
                aria-selected={tab === 'signin'}
                type="button"
                onClick={() => switchTab('signin')}
                className="flex-1 py-[9px] px-3 font-mono text-[10px] tracking-[0.22em] uppercase font-bold text-center bg-transparent cursor-pointer"
                style={{
                  color: tab === 'signin' ? 'rgb(var(--ink))' : 'rgb(var(--ink-muted))',
                  borderBottom: tab === 'signin' ? '3px solid rgb(var(--accent))' : '3px solid transparent',
                  marginBottom: -1.5,
                }}
              >
                Sign in
              </button>
              <button
                role="tab"
                aria-selected={tab === 'signup'}
                type="button"
                onClick={() => switchTab('signup')}
                className="flex-1 py-[9px] px-3 font-mono text-[10px] tracking-[0.22em] uppercase font-bold text-center bg-transparent cursor-pointer"
                style={{
                  color: tab === 'signup' ? 'rgb(var(--ink))' : 'rgb(var(--ink-muted))',
                  borderBottom: tab === 'signup' ? '3px solid rgb(var(--accent))' : '3px solid transparent',
                  marginBottom: -1.5,
                }}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="contents" noValidate>
              {/* Email */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="email"
                  className="font-mono text-[9px] tracking-[0.24em] uppercase text-ink-muted font-semibold"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="your @ studio"
                  style={FIELD_INPUT}
                  {...register('email', { required: 'Email is required' })}
                />
                {errors.email && (
                  <p className="font-serif italic text-[14px] text-accent">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-baseline">
                  <label
                    htmlFor="password"
                    className="font-mono text-[9px] tracking-[0.24em] uppercase text-ink-muted font-semibold"
                  >
                    Password
                  </label>
                  {tab === 'signin' && (
                    <button
                      type="button"
                      onClick={() => setView('forgot')}
                      className="font-serif italic text-[12px] text-ink-soft underline cursor-pointer bg-transparent"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                  style={FIELD_INPUT}
                  {...register('password', { required: 'Password is required' })}
                />
                {errors.password && (
                  <p className="font-serif italic text-[14px] text-accent">{errors.password.message}</p>
                )}
                {tab === 'signup' && !errors.password && (
                  <p className="font-serif italic text-[12px] text-ink-soft mt-1">
                    At least 8 characters — something you'll remember at 2am.
                  </p>
                )}
              </div>

              {/* Confirm password (signup only) */}
              {tab === 'signup' && (
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="confirmPassword"
                    className="font-mono text-[9px] tracking-[0.24em] uppercase text-ink-muted font-semibold"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder="…again"
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
              )}

              {/* Server error */}
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

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ background: 'rgb(var(--btn-bg))', boxShadow: '3px 3px 0 rgb(var(--accent))' }}
                className="w-full text-btn-text px-[18px] py-[13px] font-mono text-[11px] tracking-[0.22em] uppercase font-bold rounded-[2px] mt-1 disabled:opacity-50 cursor-pointer"
              >
                {tab === 'signin' ? 'Sign in →' : 'Start journaling →'}
              </button>
            </form>

            {/* Bottom line */}
            <div
              style={{ borderTop: '1px dashed rgb(var(--rule))', paddingTop: 14 }}
              className="flex justify-between items-center font-serif italic text-[13.5px] text-ink-soft"
            >
              {tab === 'signin' ? (
                <>
                  <span>First time here?</span>
                  <button
                    type="button"
                    onClick={() => switchTab('signup')}
                    className="font-semibold text-accent underline cursor-pointer bg-transparent"
                  >
                    Start a new journal →
                  </button>
                </>
              ) : (
                <>
                  <span>Already keeping a journal?</span>
                  <button
                    type="button"
                    onClick={() => switchTab('signin')}
                    className="font-semibold text-accent underline cursor-pointer bg-transparent"
                  >
                    Sign in →
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {view === 'forgot' && (
          <>
            <div>
              <h2 className="font-serif text-[30px] font-semibold tracking-[-0.02em] leading-[1.05] text-ink mt-1">
                Lost the key?
              </h2>
              <p className="font-serif italic text-[15px] text-ink-soft leading-[1.5] mt-1.5">
                Type your email — we'll send a one-time link to set a new password.
              </p>
            </div>

            <form onSubmit={handleForgot} className="contents" noValidate>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="forgot-email"
                  className="font-mono text-[9px] tracking-[0.24em] uppercase text-ink-muted font-semibold"
                >
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  style={FIELD_INPUT}
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>

              {forgotError && (
                <div
                  style={{
                    background: 'rgb(var(--accent-soft))',
                    border: '1px solid rgb(var(--accent))',
                    borderRadius: 2,
                    padding: '8px 12px',
                  }}
                  className="font-serif italic text-[13px] text-accent"
                >
                  {forgotError}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotSubmitting}
                style={{ background: 'rgb(var(--btn-bg))', boxShadow: '3px 3px 0 rgb(var(--accent))' }}
                className="w-full text-btn-text px-[18px] py-[13px] font-mono text-[11px] tracking-[0.22em] uppercase font-bold rounded-[2px] mt-1 disabled:opacity-50 cursor-pointer"
              >
                Send reset link →
              </button>
            </form>

            <div
              style={{ borderTop: '1px dashed rgb(var(--rule))', paddingTop: 14 }}
              className="flex justify-between items-center font-serif italic text-[13.5px] text-ink-soft"
            >
              <span>Remembered it?</span>
              <button
                type="button"
                onClick={() => setView('form')}
                className="font-semibold text-accent underline cursor-pointer bg-transparent"
              >
                ← Back to sign in
              </button>
            </div>
          </>
        )}

        {/* ── SIGNED UP / FORGOT SENT ── */}
        {(view === 'signed-up' || view === 'forgot-sent') && (
          <>
            <div className="flex flex-col items-center gap-[14px] pt-[14px] pb-3">
              {/* Icon card */}
              <div
                style={{
                  width: 64, height: 64,
                  display: 'grid', placeItems: 'center',
                  background: 'rgb(var(--card-active))',
                  border: '2px solid rgb(var(--ink))',
                  borderRadius: 4,
                  boxShadow: '3px 3px 0 rgb(var(--accent))',
                  transform: 'rotate(-2deg)',
                }}
              >
                <svg width="34" height="34" viewBox="0 0 32 32">
                  <rect x="3.5" y="7" width="25" height="18" rx="1" fill="none"
                    stroke="rgb(var(--ink))" strokeWidth="2" />
                  <path d="M4 8 L16 18 L28 8" fill="none"
                    stroke="rgb(var(--accent))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="font-serif text-[30px] font-semibold tracking-[-0.02em] leading-[1.05] text-ink text-center">
                Check your inbox
              </h2>
              <p className="font-serif italic text-[15px] text-ink-soft leading-[1.5] text-center max-w-[320px]">
                {view === 'signed-up' ? (
                  <>
                    We sent a confirmation link to{' '}
                    <em className="not-italic font-semibold text-ink">{sentEmail}</em>. Click it to activate your journal.
                  </>
                ) : (
                  <>
                    We sent a password reset link to{' '}
                    <em className="not-italic font-semibold text-ink">{sentEmail}</em>. Use it to set a new password.
                  </>
                )}
              </p>
            </div>

            <div
              style={{ borderTop: '1px dashed rgb(var(--rule))', paddingTop: 14 }}
              className="flex justify-between items-center font-serif italic text-[13.5px] text-ink-soft"
            >
              <span>Didn't arrive?</span>
              <button
                type="button"
                onClick={() =>
                  view === 'signed-up'
                    ? supabase.auth.resend({ type: 'signup', email: sentEmail })
                    : setView('forgot')
                }
                className="font-semibold text-accent underline cursor-pointer bg-transparent"
              >
                {view === 'signed-up' ? 'Resend the link →' : '← Try again'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted text-center relative z-10">
        Made for hardware that forgets · v0.4
      </div>
    </div>
  )
}
