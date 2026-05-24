import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { usePostHog } from '@posthog/react'

type Tab = 'signin' | 'signup'
type View = 'form' | 'signed-up' | 'forgot' | 'forgot-sent'
type Fields = { email: string; password: string; confirmPassword: string }

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>('signin')
  const [view, setView] = useState<View>('form')
  const [serverError, setServerError] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSubmitting, setForgotSubmitting] = useState(false)
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const posthog = usePostHog()

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
    setView('forgot-sent')
  }

  const card = 'bg-zinc-900 border border-zinc-800 rounded-lg p-8 w-full max-w-sm'
  const page = 'min-h-screen bg-zinc-950 flex items-center justify-center'

  if (view === 'signed-up') {
    return (
      <div data-testid="auth-page" className={page}>
        <div className={`${card} flex flex-col gap-3`}>
          <h1 className="text-zinc-100 text-lg font-medium">Check your email</h1>
          <p className="text-zinc-400 text-sm">We sent a confirmation link to your inbox. Click it to activate your account and sign in.</p>
        </div>
      </div>
    )
  }

  if (view === 'forgot-sent') {
    return (
      <div data-testid="auth-page" className={page}>
        <div className={`${card} flex flex-col gap-3`}>
          <h1 className="text-zinc-100 text-lg font-medium">Check your email</h1>
          <p className="text-zinc-400 text-sm">We sent a password reset link to your inbox.</p>
          <button
            onClick={() => setView('form')}
            className="text-indigo-400 hover:text-indigo-300 text-sm self-start"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  if (view === 'forgot') {
    return (
      <div data-testid="auth-page" className={page}>
        <div className={card}>
          <h1 className="text-zinc-100 text-lg font-medium mb-6">Reset password</h1>
          <form onSubmit={handleForgot} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1">
              <label htmlFor="forgot-email" className="text-sm text-zinc-400">Email</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>
            {forgotError && <p className="text-xs text-red-400">{forgotError}</p>}
            <button
              type="submit"
              disabled={forgotSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium mt-2 disabled:opacity-50"
            >
              Send reset link
            </button>
          </form>
          <button
            onClick={() => setView('form')}
            className="mt-4 text-zinc-500 hover:text-zinc-300 text-sm"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="auth-page" className={page}>
      <div className={card}>
        <h1 className="text-zinc-100 text-lg font-medium mb-6">PatchPal</h1>

        <div className="flex mb-6 gap-2">
          <button
            role="tab"
            aria-selected={tab === 'signin'}
            onClick={() => switchTab('signin')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium ${
              tab === 'signin' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Sign in
          </button>
          <button
            role="tab"
            aria-selected={tab === 'signup'}
            onClick={() => switchTab('signup')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium ${
              tab === 'signup' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-zinc-400">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm text-zinc-400">Password</label>
              {tab === 'signin' && (
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="password"
              type="password"
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
            {tab === 'signup' && !errors.password && (
              <p className="text-xs text-zinc-500">Choose a strong password you'll remember — at least 8 characters.</p>
            )}
          </div>

          {tab === 'signup' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="confirmPassword" className="text-sm text-zinc-400">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (val) => val === watch('password') || 'Passwords do not match',
                })}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
              )}
            </div>
          )}

          {serverError && <p className="text-xs text-red-400">{serverError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium mt-2 disabled:opacity-50"
          >
            {tab === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
      </div>
    </div>
  )
}
