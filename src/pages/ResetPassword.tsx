import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'

type Fields = { password: string; confirmPassword: string }

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Fields>({
    shouldUnregister: true,
  })

  const onSubmit = async ({ password }: Fields) => {
    setServerError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setServerError(error.message); return }
    navigate('/sessions')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-zinc-100 text-lg font-medium mb-6">Set new password</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm text-zinc-400">New password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'At least 8 characters' },
              })}
            />
            {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirmPassword" className="text-sm text-zinc-400">Confirm new password</label>
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
            {errors.confirmPassword && <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>}
          </div>

          {serverError && <p className="text-xs text-red-400">{serverError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium mt-2 disabled:opacity-50"
          >
            Update password
          </button>
        </form>
      </div>
    </div>
  )
}
