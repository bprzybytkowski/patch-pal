import { useState, useEffect } from 'react'
import { useThemeStore } from '../store/theme'
import { type CableKind } from './SignalFlow'

const CABLE_KINDS: CableKind[] = ['audio', 'midi', 'sync']

interface Props {
  pending: { from: string; to: string }
  existingConnections: { fromName: string; toName: string; kind: CableKind }[]
  onConfirm: (kinds: CableKind[], label: string) => void
  onCancel: () => void
}

export function ConnectionTypeSheet({ pending, existingConnections, onConfirm, onCancel }: Props) {
  const theme = useThemeStore((s) => s.theme)

  const usedKinds = new Set(
    existingConnections
      .filter((c) => c.fromName === pending.from && c.toName === pending.to)
      .map((c) => c.kind),
  )
  const availableKinds = CABLE_KINDS.filter((k) => !usedKinds.has(k))

  const [kinds, setKinds] = useState<Set<CableKind>>(
    () => new Set(availableKinds.slice(0, 1)),
  )
  const [label, setLabel] = useState('')

  useEffect(() => {
    setKinds((prev) => {
      const filtered = new Set([...prev].filter((k) => availableKinds.includes(k)))
      return filtered.size > 0 ? filtered : new Set(availableKinds.slice(0, 1))
    })
  }, [availableKinds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleKind = (k: CableKind) => {
    if (usedKinds.has(k)) return
    setKinds((prev) => {
      const next = new Set(prev)
      if (next.has(k)) {
        next.delete(k)
      } else {
        next.add(k)
      }
      return next
    })
  }

  const selectedKinds = [...kinds].filter((k) => availableKinds.includes(k))
  const canConfirm = selectedKinds.length > 0

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(selectedKinds, label.trim())
    setLabel('')
  }

  const addLabel = selectedKinds.length > 1 ? 'ADD CABLES' : 'ADD CABLE'

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
          padding: '20px 24px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
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

        <div>
          <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">
            Connect
          </span>
          <div
            className="font-serif text-ink mt-1"
            style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}
          >
            {pending.from} → {pending.to}
          </div>
        </div>

        {availableKinds.length === 0 ? (
          <p className="font-serif italic text-[14px] text-ink-muted">
            All cable types are already connected between these two devices.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              {CABLE_KINDS.map((k) => {
                const disabled = usedKinds.has(k)
                const active = kinds.has(k) && !disabled
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleKind(k)}
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      padding: '12px 0 11px',
                      borderRadius: 2,
                      border: '1.5px solid',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      flex: 1,
                      opacity: disabled ? 0.25 : 1,
                      ...(active
                        ? {
                            background: 'rgb(var(--ink))',
                            color: 'rgb(var(--paper))',
                            borderColor: 'rgb(var(--ink))',
                          }
                        : {
                            background: 'transparent',
                            color: 'rgb(var(--ink-muted))',
                            borderColor: 'rgb(var(--rule))',
                          }),
                    }}
                  >
                    {k}
                  </button>
                )
              })}
            </div>

            <input
              placeholder="Cable label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleConfirm()
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: '1px dashed rgb(var(--ink-muted))',
                padding: '8px 0',
                fontFamily: '"Spectral", serif',
                fontStyle: 'italic',
                fontSize: 16,
                color: 'rgb(var(--ink-soft))',
                outline: 'none',
              }}
            />

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 11,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  padding: '10px 20px 9px',
                  borderRadius: 2,
                  border: 'none',
                  background: 'rgb(var(--ink))',
                  color: 'rgb(var(--paper))',
                  cursor: canConfirm ? 'pointer' : 'not-allowed',
                  opacity: canConfirm ? 1 : 0.4,
                  boxShadow: canConfirm ? '3px 3px 0 rgb(var(--accent))' : 'none',
                }}
              >
                {addLabel}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="font-serif italic text-[14px] text-ink-muted"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                cancel
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
