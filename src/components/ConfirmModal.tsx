import { useEffect } from 'react'
import { useThemeStore } from '../store/theme'

interface Props {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-[4px] p-7 flex flex-col gap-5 w-full max-w-sm"
        style={{
          background: 'var(--paper-grad)',
          border: '1px solid rgb(var(--rule-soft))',
          boxShadow: theme === 'dark'
            ? '0 8px 32px rgba(0,0,0,0.5)'
            : '0 8px 32px rgba(80,55,20,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-serif italic text-[15px] text-ink leading-snug">{message}</p>

        <div
          className="flex items-center gap-4 pt-4"
          style={{ borderTop: '1px dashed rgb(var(--rule))' }}
        >
          <button
            autoFocus
            onClick={onConfirm}
            style={{
              background: 'rgb(var(--ink))',
              color: 'rgb(var(--paper))',
              padding: '9px 16px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 700,
              borderRadius: 2,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '2px 2px 0 rgb(var(--accent))',
            }}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="font-serif italic text-[14px] text-ink-soft underline"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            cancel
          </button>
        </div>
      </div>
    </div>
  )
}
