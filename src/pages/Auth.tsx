import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'

type Tab = 'signin' | 'signup'
type Fields = { email: string; password: string }

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>('signin')
  const [serverError, setServerError] = useState('')
  const [signedUp, setSignedUp] = useState(false)
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<Fields>()

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
      navigate('/sessions')
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setServerError(error.message); return }
      setSignedUp(true)
    }
  }

  if (signedUp) {
    return (
      <div data-testid="auth-page" className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 w-full max-w-sm flex flex-col gap-3">
          <h1 className="text-zinc-100 text-lg font-medium">Check your email</h1>
          <p className="text-zinc-400 text-sm">We sent a confirmation link to your inbox. Click it to activate your account and sign in.</p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="auth-page" className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-zinc-100 text-lg font-medium mb-6">PatchPal</h1>

        <div className="flex mb-6 gap-2">
          <button
            role="tab"
            aria-selected={tab === 'signin'}
            onClick={() => switchTab('signin')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium ${
              tab === 'signin'
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Sign in
          </button>
          <button
            role="tab"
            aria-selected={tab === 'signup'}
            onClick={() => switchTab('signup')}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium ${
              tab === 'signup'
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-zinc-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && (
              <p className="text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm text-zinc-400">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && (
              <p className="text-xs text-red-400">{errors.password.message}</p>
            )}
            {tab === 'signup' && !errors.password && (
              <p className="text-xs text-zinc-500">Choose a strong password you'll remember — at least 8 characters.</p>
            )}
          </div>

          {serverError && (
            <p className="text-xs text-red-400">{serverError}</p>
          )}

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
