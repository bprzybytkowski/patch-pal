import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { useToastStore } from '../store/toast'
import { useThemeStore } from '../store/theme'

interface Fields {
  title: string
  notes: string
}

function getDefaultTitle(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Morning Jam'
  if (hour >= 12 && hour < 17) return 'Afternoon Jam'
  if (hour >= 17 && hour < 21) return 'Evening Session'
  return 'Late Night Session'
}

const fieldStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1.5px solid rgb(var(--ink))',
  padding: '6px 0',
  fontFamily: '"Spectral", serif',
  fontStyle: 'italic',
  color: 'rgb(var(--ink))',
  outline: 'none',
  width: '100%',
}

export default function QuickCapturePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const theme = useThemeStore((s) => s.theme)
  const titleRef = useRef<HTMLInputElement | null>(null)

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Fields>({
    defaultValues: { title: getDefaultTitle(), notes: '' },
  })

  const { ref: registerRef, ...registerRest } = register('title', { required: 'Title is required' })

  const onSubmit = async (values: Fields) => {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user!.id,
        title: values.title.trim(),
        notes: values.notes.trim() || null,
        mood_tags: [],
      })
      .select('id')
      .single()

    if (error || !data) {
      addToast({ message: 'Could not save. Try again.', type: 'error' })
      return
    }

    navigate(`/sessions/${data.id}`, { state: { editing: true } })
  }

  return (
    <div className="relative z-10 p-5 sm:p-8 max-w-lg mx-auto">
      <div
        className="rounded-[4px] p-[28px_30px_28px] sm:p-[36px_38px_32px]"
        style={{
          background: 'var(--paper-grad)',
          boxShadow: theme === 'dark'
            ? '0 1px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.4), 0 30px 60px rgba(0,0,0,0.3)'
            : '0 1px 0 rgba(40,30,10,0.05), 0 10px 24px rgba(80,55,20,0.12), 0 30px 60px rgba(80,55,20,0.08)',
          border: '1px solid rgb(var(--rule-soft))',
        }}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <div>
            <h1
              className="font-serif font-semibold text-ink"
              style={{ fontSize: 32, letterSpacing: '-0.01em', lineHeight: 1 }}
            >
              Quick log
            </h1>
            <p className="font-serif italic text-[14px] text-ink-soft mt-1.5">
              Name it now, flesh it out after.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="title" className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">
              Title
            </label>
            <input
              id="title"
              autoFocus
              style={{ ...fieldStyle, fontSize: 22, fontWeight: 600 }}
              ref={(el) => {
                registerRef(el)
                titleRef.current = el
              }}
              {...registerRest}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              placeholder="What's happening right now…"
              style={{ ...fieldStyle, fontSize: 15, resize: 'none' }}
              {...register('notes')}
            />
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-dashed border-rule">
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: 'rgb(var(--btn-bg))',
                color: 'rgb(var(--btn-text))',
                padding: '10px 18px',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: 700,
                boxShadow: '3px 3px 0 rgb(var(--accent))',
                borderRadius: 2,
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              {isSubmitting ? 'Saving…' : 'Log it →'}
            </button>
            <Link
              to="/sessions"
              className="font-serif italic text-[14px] text-ink-soft underline"
            >
              cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
