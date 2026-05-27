import { useThemeStore } from '../store/theme'
import { useMediaQuery } from '../lib/hooks'

interface Props {
  onCamera: () => void
  onGallery: () => void
  onCancel: () => void
}

export function PhotoSourceSheet({ onCamera, onGallery, onCancel }: Props) {
  const theme = useThemeStore((s) => s.theme)
  const isPhone = useMediaQuery('(max-width: 640px)')

  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          zIndex: 41,
          background: 'var(--paper-grad)',
          border: '1px solid rgb(var(--rule-soft))',
          borderBottom: 'none',
          borderRadius: '4px 4px 0 0',
          padding: isPhone ? '20px 24px 72px' : '20px 24px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow:
            theme === 'dark'
              ? '0 -8px 32px rgba(0,0,0,0.5)'
              : '0 -8px 32px rgba(40,30,10,0.15)',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: -4, marginBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgb(var(--rule))' }} />
        </div>

        <span
          className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted"
        >
          Add photo
        </span>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCamera}
            style={{
              flex: 1,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 700,
              padding: '12px 0 11px',
              borderRadius: 2,
              border: '1.5px solid rgb(var(--ink))',
              background: 'transparent',
              color: 'rgb(var(--ink))',
              cursor: 'pointer',
            }}
          >
            Camera
          </button>

          <button
            type="button"
            onClick={onGallery}
            style={{
              flex: 1,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 700,
              padding: '12px 0 11px',
              borderRadius: 2,
              border: '1.5px solid rgb(var(--ink))',
              background: 'transparent',
              color: 'rgb(var(--ink))',
              cursor: 'pointer',
            }}
          >
            Gallery
          </button>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="font-serif italic text-[14px] text-ink-muted"
          style={{ background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          cancel
        </button>
      </div>
    </>
  )
}
