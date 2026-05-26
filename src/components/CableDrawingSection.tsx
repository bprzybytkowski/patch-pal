import { useConnectionDrawing } from '../lib/hooks'
import { ConnectionTypeSheet } from './ConnectionTypeSheet'
import { type CableKind } from './SignalFlow'

const CABLE_KIND_COLORS: Record<CableKind, string> = {
  audio: '#c13b2a',
  midi: 'rgb(var(--ink))',
  sync: 'rgb(var(--ink))',
}

export interface LocalConnection {
  fromName: string
  toName: string
  kind: CableKind
  label: string
}

export function CableDrawingSection({
  deviceNames,
  connections,
  onAdd,
  onRemove,
}: {
  deviceNames: string[]
  connections: LocalConnection[]
  onAdd: (c: LocalConnection) => void
  onRemove: (idx: number) => void
}) {
  const { armedDevice, pending, arm, complete, cancel, dismissPending } = useConnectionDrawing()
  const isArmed = armedDevice !== null

  const handleConfirm = (kind: CableKind, label: string) => {
    if (!pending) return
    onAdd({ fromName: pending.from, toName: pending.to, kind, label })
    dismissPending()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.24em] uppercase text-ink-muted">
        <span>Cables</span>
        <span className="flex-1 h-px bg-rule" />
        <span>
          {connections.length} {connections.length === 1 ? 'cable' : 'cables'}
        </span>
      </div>

      {/* Device tap rows */}
      <div className="flex flex-col gap-1.5">
        {deviceNames.map((name) => {
          const isThisArmed = armedDevice === name
          const connectionCount = connections.filter(
            (c) => c.fromName === name || c.toName === name,
          ).length

          return (
            <button
              key={name}
              type="button"
              aria-label={
                isThisArmed
                  ? `cancel connection from ${name}`
                  : isArmed
                    ? `connect to ${name}`
                    : `start connection from ${name}`
              }
              onClick={() => {
                if (isThisArmed) {
                  cancel()
                } else if (isArmed) {
                  complete(name)
                } else {
                  arm(name)
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                border: isThisArmed
                  ? '1.5px solid rgb(var(--ink))'
                  : isArmed
                    ? '1px dashed rgb(var(--ink-muted))'
                    : '1px solid rgb(var(--rule))',
                borderRadius: 2,
                background: isThisArmed ? 'rgb(var(--card-active))' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span
                className="font-serif text-[15px] text-ink flex-1"
                style={{ fontWeight: isThisArmed ? 600 : 400 }}
              >
                {name}
              </span>
              {connectionCount > 0 && !isThisArmed && (
                <span
                  title={`${connectionCount} cable${connectionCount !== 1 ? 's' : ''}`}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'rgb(var(--ink-muted))',
                    flexShrink: 0,
                  }}
                />
              )}
              {isThisArmed && (
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 8,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgb(var(--ink-muted))',
                  }}
                >
                  from ×
                </span>
              )}
              {isArmed && !isThisArmed && (
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 11,
                    color: 'rgb(var(--ink-muted))',
                    opacity: 0.7,
                  }}
                >
                  →
                </span>
              )}
            </button>
          )
        })}

        {/* OUT terminal — only visible when a device is armed */}
        {isArmed && (
          <button
            type="button"
            aria-label="connect to OUT"
            onClick={() => complete('OUT')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              border: '1px dashed rgb(var(--ink-muted))',
              borderRadius: 2,
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 9,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'rgb(var(--ink-muted))',
              }}
            >
              OUT
            </span>
            <span className="flex-1" />
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                color: 'rgb(var(--ink-muted))',
                opacity: 0.7,
              }}
            >
              →
            </span>
          </button>
        )}
      </div>

      {/* Contextual hint */}
      {!isArmed && connections.length === 0 && (
        <p
          className="font-serif italic text-[13px] text-center"
          style={{ color: 'rgb(var(--ink-muted))', opacity: 0.65 }}
        >
          tap a device to start drawing a cable
        </p>
      )}
      {isArmed && (
        <p
          className="font-mono text-[9px] tracking-[0.16em] uppercase text-center text-ink-muted"
        >
          from: {armedDevice} — tap another device or OUT
        </p>
      )}

      {/* Existing connections list */}
      {connections.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1">
          {connections.map((c, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2"
              style={{
                padding: '7px 10px',
                background: 'rgba(0,0,0,0.025)',
                border: '1px dashed rgb(var(--rule))',
                borderRadius: 2,
              }}
            >
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 8,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: CABLE_KIND_COLORS[c.kind],
                  fontWeight: 700,
                  minWidth: 34,
                }}
              >
                {c.kind}
              </span>
              <span className="font-serif italic text-[13px] text-ink flex-1 truncate">
                {c.fromName} → {c.toName}
              </span>
              {c.label && (
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    color: 'rgb(var(--ink-soft))',
                  }}
                >
                  {c.label}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                aria-label="Remove cable"
                className="font-mono text-[14px] text-ink-muted hover:text-ink ml-1"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {pending && (
        <ConnectionTypeSheet
          pending={pending}
          existingConnections={connections}
          onConfirm={handleConfirm}
          onCancel={dismissPending}
        />
      )}
    </div>
  )
}
