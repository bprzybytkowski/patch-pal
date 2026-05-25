export type CableKind = 'midi' | 'sync' | 'audio'

export interface SignalFlowDevice {
  name: string
  role: string
  type: string
  sync?: string | null
}

export interface SignalFlowConnection {
  from: string
  to: string
  kind: CableKind
  label: string
}

const SF_THEME = {
  light: {
    ink:          '#1a1814',
    inkMid:       '#3a3026',
    inkSoft:      '#5a4a30',
    inkMuted:     '#8a6f45',
    paper:        '#fffaee',
    paperBg:      '#fdf6e6',
    rule:         '#d8c69a',
    accent:       '#c13b2a',
    tape:         'rgba(244, 211, 94, 0.85)',
    roleMaster:   { c: '#c13b2a', bg: '#fbe8de' },
    roleSlave:    { c: '#3a5a2a', bg: '#e6efd4' },
    roleSolo:     { c: '#5a4a30', bg: '#ece0c6' },
  },
  dark: {
    ink:          '#f3e8cc',
    inkMid:       '#cbbf9f',
    inkSoft:      '#a89878',
    inkMuted:     '#7a6c4d',
    paper:        '#161f2c',
    paperBg:      '#1d2738',
    rule:         '#33405a',
    accent:       '#ff8568',
    tape:         'rgba(244, 211, 94, 0.55)',
    roleMaster:   { c: '#ff8568', bg: '#3a1f17' },
    roleSlave:    { c: '#a7d188', bg: '#1f2c1a' },
    roleSolo:     { c: '#a89878', bg: '#1f1d18' },
  },
}

const CABLE_KIND_STYLE = {
  light: {
    midi:  { stroke: '#1a1814', dash: '',    label: 'MIDI',  labelColor: '#1a1814', labelBg: '#fffaee' },
    sync:  { stroke: '#1a1814', dash: '5 4', label: 'SYNC',  labelColor: '#1a1814', labelBg: '#fffaee' },
    audio: { stroke: '#c13b2a', dash: '',    label: 'AUDIO', labelColor: '#c13b2a', labelBg: '#fdeee8' },
  },
  dark: {
    midi:  { stroke: '#f3e8cc', dash: '',    label: 'MIDI',  labelColor: '#f3e8cc', labelBg: '#1d2738' },
    sync:  { stroke: '#f3e8cc', dash: '5 4', label: 'SYNC',  labelColor: '#f3e8cc', labelBg: '#1d2738' },
    audio: { stroke: '#ff8568', dash: '',    label: 'AUDIO', labelColor: '#ff8568', labelBg: '#2a1812' },
  },
}

function RoleStamp({ role, theme }: { role: string; theme: 'light' | 'dark' }) {
  const T = SF_THEME[theme]
  const r = role === 'master' ? T.roleMaster : role === 'slave' ? T.roleSlave : T.roleSolo
  return (
    <span
      style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 9,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: r.c,
        background: r.bg,
        border: `1.5px solid ${r.c}`,
        padding: '3px 9px 2px',
        borderRadius: 2,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {role}
    </span>
  )
}

function DeviceRow({
  device,
  theme,
  isFirst,
  isMaster,
  compact,
}: {
  device: SignalFlowDevice
  theme: 'light' | 'dark'
  isFirst: boolean
  isMaster: boolean
  compact: boolean
}) {
  const T = SF_THEME[theme]
  return (
    <div
      style={{
        position: 'relative',
        background: T.paper,
        border: `1px solid ${T.ink}`,
        borderRadius: 3,
        padding: compact ? '12px 14px' : '14px 18px',
        boxShadow: `3px 3px 0 ${isMaster ? T.accent : T.ink}33`,
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        alignItems: 'center',
      }}
    >
      {isFirst && (
        <span
          style={{
            position: 'absolute',
            top: -7,
            left: 22,
            width: 64,
            height: 14,
            background: T.tape,
            borderLeft: '1px solid rgba(120,90,30,0.18)',
            borderRight: '1px solid rgba(120,90,30,0.18)',
            transform: 'rotate(-2deg)',
            boxShadow: '0 1px 2px rgba(40,30,10,0.18)',
          }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: '"Spectral", serif',
            fontSize: compact ? 16 : 19,
            fontWeight: 600,
            color: T.ink,
            lineHeight: 1.15,
            letterSpacing: '-0.005em',
          }}
        >
          {device.name}
        </div>
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 9,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: T.inkMuted,
            marginTop: 4,
          }}
        >
          {device.type.replace(/_/g, ' ')}
          {device.sync && device.sync !== '—' && (
            <>
              {' · '}
              <span style={{ color: T.inkSoft, textTransform: 'none', letterSpacing: '0.08em' }}>
                {device.sync}
              </span>
            </>
          )}
        </div>
      </div>
      <RoleStamp role={device.role} theme={theme} />
    </div>
  )
}

function defaultLabel(conn: SignalFlowConnection): string {
  if (conn.label) return conn.label
  if (conn.kind === 'sync') return 'sync'
  return conn.label
}

function CableConnector({
  conn,
  theme,
}: {
  conn: SignalFlowConnection
  theme: 'light' | 'dark'
}) {
  const style = CABLE_KIND_STYLE[theme][conn.kind] ?? CABLE_KIND_STYLE[theme].midi
  const label = defaultLabel(conn)
  return (
    <div
      style={{
        position: 'relative',
        height: 56,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 60 56"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: 60,
          height: '100%',
          left: 'calc(50% - 30px)',
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <line
          x1="30" y1="0" x2="30" y2="46"
          stroke={style.stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray={style.dash || undefined}
        />
        <path
          d="M22 42 L30 52 L38 42"
          fill="none"
          stroke={style.stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="30" cy="0" r="3" fill={style.stroke} />
      </svg>
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: style.labelBg,
          border: `1px solid ${style.stroke}`,
          borderRadius: 2,
          padding: '3px 9px 2px',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10,
          letterSpacing: '0.06em',
          color: style.labelColor,
          textTransform: 'lowercase',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 8,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: style.labelColor,
            opacity: 0.65,
            fontWeight: 700,
          }}
        >
          {style.label}
        </span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{label}</span>
      </div>
    </div>
  )
}

interface Props {
  devices: SignalFlowDevice[]
  connections: SignalFlowConnection[]
  theme: 'light' | 'dark'
  compact?: boolean
}

export default function SignalFlow({ devices, connections, theme, compact = false }: Props) {
  const kindStyles = CABLE_KIND_STYLE[theme]
  const ordered = [...devices]
  const orderIdx = (name: string) => ordered.findIndex((d) => d.name === name)

  const chainByGap: Record<string | number, SignalFlowConnection> = {}
  const bypass: Array<{ fromIdx: number; toIdx: number; conn: SignalFlowConnection }> = []

  connections.forEach((c) => {
    const fi = orderIdx(c.from)
    const ti = orderIdx(c.to)
    if (c.to === 'OUT') {
      if (c.from === ordered[ordered.length - 1]?.name) {
        chainByGap['out'] = c
      } else {
        bypass.push({ fromIdx: fi, toIdx: ordered.length, conn: c })
      }
      return
    }
    if (fi === -1) return
    if (ti !== -1 && ti - fi === 1 && !chainByGap[fi]) {
      chainByGap[fi] = c
    } else {
      bypass.push({ fromIdx: fi, toIdx: ti === -1 ? ordered.length : ti, conn: c })
    }
  })

  const ROW_H = compact ? 64 : 72
  const GAP_H = 56
  const STEP = ROW_H + GAP_H
  const LANE_W = 24
  const labelWidthFor = (l: string) => l.length * 5.5 + 14
  const maxLabelW = bypass.length ? Math.max(...bypass.map((b) => labelWidthFor(defaultLabel(b.conn)))) : 0
  const lanesW = bypass.length * LANE_W
  const svgW = lanesW + maxLabelW + 24
  const paddingR = bypass.length > 0 ? svgW + 8 : 0

  const totalRows = ordered.length
  const outConnectorH = chainByGap['out'] ? GAP_H : 32
  const outPillH = 40
  const totalH = totalRows * ROW_H + (totalRows - 1) * (chainByGap ? GAP_H : 32) + outConnectorH + outPillH + 20

  return (
    <div style={{ position: 'relative', paddingRight: paddingR }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {ordered.map((d, i) => (
          <div key={d.name}>
            <DeviceRow
              device={d}
              theme={theme}
              isFirst={i === 0}
              isMaster={d.role === 'master'}
              compact={compact}
            />
            {i < ordered.length - 1 && chainByGap[i] && (
              <CableConnector conn={chainByGap[i]} theme={theme} />
            )}
            {i < ordered.length - 1 && !chainByGap[i] && (
              <div style={{ height: 32 }} />
            )}
          </div>
        ))}

        {chainByGap['out'] ? (
          <CableConnector conn={chainByGap['out']} theme={theme} />
        ) : (
          <div style={{ position: 'relative', height: 36, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <svg
              viewBox="0 0 60 36"
              style={{ position: 'absolute', left: 'calc(50% - 30px)', width: 60, height: 36 }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1="30" y1="0" x2="30" y2="26" stroke={kindStyles.audio.stroke} strokeWidth="1.8" strokeLinecap="round" />
              <path d="M22 22 L30 32 L38 22" fill="none" stroke={kindStyles.audio.stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="30" cy="0" r="3" fill={kindStyles.audio.stroke} />
            </svg>
          </div>
        )}

        {(() => {
          const outConn = chainByGap['out']
          const style = outConn ? kindStyles[outConn.kind] : kindStyles.audio
          return (
            <div
              style={{
                alignSelf: 'center',
                border: `1px solid ${style.stroke}`,
                color: style.labelColor,
                background: style.labelBg,
                borderRadius: 2,
                padding: '4px 14px 3px',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 9,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              OUT
            </div>
          )
        })()}
      </div>

      {bypass.length > 0 && (
        <svg
          width={svgW}
          height={totalH}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            pointerEvents: 'none',
            overflow: 'visible',
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          {bypass.map(({ fromIdx, toIdx, conn }, i) => {
            const style = kindStyles[conn.kind] ?? kindStyles.midi
            const laneX = (i + 1) * LANE_W
            const yFrom = fromIdx * STEP + ROW_H / 2
            const yTo = toIdx * STEP + ROW_H / 2
            const path = `M 0 ${yFrom} L ${laneX - 6} ${yFrom} Q ${laneX} ${yFrom}, ${laneX} ${yFrom + 8} L ${laneX} ${yTo - 8} Q ${laneX} ${yTo}, ${laneX - 6} ${yTo} L 0 ${yTo}`
            const connLabel = defaultLabel(conn)
            const lw = labelWidthFor(connLabel)
            return (
              <g key={i}>
                <path
                  d={path}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeDasharray={style.dash || undefined}
                />
                <path
                  d={`M 8 ${yTo - 5} L 0 ${yTo} L 8 ${yTo + 5}`}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="0" cy={yFrom} r="2.5" fill={style.stroke} />
                <g transform={`translate(${laneX + 6}, ${(yFrom + yTo) / 2})`}>
                  <rect
                    x="-3"
                    y="-9"
                    width={lw}
                    height="18"
                    fill={style.labelBg}
                    stroke={style.stroke}
                    strokeWidth="0.8"
                    rx="2"
                  />
                  <text
                    x="4"
                    y="4"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="9"
                    fill={style.stroke}
                  >
                    {connLabel}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
