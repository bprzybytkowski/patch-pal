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

// Spacing between parallel cable lines
const ADJ_LINE_SPACING = 10  // adjacent (between device rows)
const BYP_LINE_SPACING = 5   // bypass (side SVG)

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
  return conn.label
}

// Renders 1–N parallel cables between two adjacent device rows
function CableConnectorGroup({
  conns,
  theme,
}: {
  conns: SignalFlowConnection[]
  theme: 'light' | 'dark'
}) {
  const H = 56
  const n = conns.length
  const spread = (n - 1) * ADJ_LINE_SPACING
  const svgW = Math.max(60, spread + 60)
  const cx = svgW / 2

  return (
    <div
      style={{
        position: 'relative',
        height: H,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        viewBox={`0 0 ${svgW} ${H}`}
        style={{
          position: 'absolute',
          top: 0,
          left: `calc(50% - ${svgW / 2}px)`,
          width: svgW,
          height: H,
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {conns.map((conn, idx) => {
          const style = CABLE_KIND_STYLE[theme][conn.kind]
          const x = cx + (idx - (n - 1) / 2) * ADJ_LINE_SPACING
          return (
            <g key={conn.kind}>
              <circle cx={x} cy={0} r={3} fill={style.stroke} />
              <line
                x1={x} y1={0} x2={x} y2={46}
                stroke={style.stroke}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeDasharray={style.dash || undefined}
              />
              <path
                d={`M${x - 8} 42 L${x} 52 L${x + 8} 42`}
                fill="none"
                stroke={style.stroke}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )
        })}
      </svg>

      {/* Label pills – horizontal row */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 4 }}>
        {conns.map((conn) => {
          const style = CABLE_KIND_STYLE[theme][conn.kind]
          const label = defaultLabel(conn)
          return (
            <div
              key={conn.kind}
              style={{
                background: style.labelBg,
                border: `1px solid ${style.stroke}`,
                borderRadius: 2,
                padding: '3px 8px 2px',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 9,
                letterSpacing: '0.18em',
                color: style.labelColor,
                textTransform: 'uppercase',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {style.label}
              {label && (
                <>
                  <span style={{ opacity: 0.35 }}>·</span>
                  <span style={{ textTransform: 'lowercase', letterSpacing: '0.04em', fontWeight: 400 }}>
                    {label}
                  </span>
                </>
              )}
            </div>
          )
        })}
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

  const chainByGap: Record<number, SignalFlowConnection[]> = {}
  let outConn: SignalFlowConnection | null = null
  const bypass: Array<{ fromIdx: number; toIdx: number; conn: SignalFlowConnection }> = []

  connections.forEach((c) => {
    const fi = orderIdx(c.from)
    const ti = orderIdx(c.to)
    if (c.to === 'OUT') {
      if (c.from === ordered[ordered.length - 1]?.name) {
        if (!outConn) outConn = c
      } else {
        bypass.push({ fromIdx: fi, toIdx: ordered.length, conn: c })
      }
      return
    }
    if (fi === -1) return
    if (ti !== -1 && ti - fi === 1) {
      if (!chainByGap[fi]) chainByGap[fi] = []
      chainByGap[fi].push(c)
    } else {
      bypass.push({ fromIdx: fi, toIdx: ti === -1 ? ordered.length : ti, conn: c })
    }
  })

  // Group bypass connections by (fromIdx, toIdx) so parallel cables share a lane
  const bypassGroupMap = new Map<string, { fromIdx: number; toIdx: number; conns: SignalFlowConnection[] }>()
  bypass.forEach(({ fromIdx, toIdx, conn }) => {
    const key = `${fromIdx}:${toIdx}`
    if (!bypassGroupMap.has(key)) bypassGroupMap.set(key, { fromIdx, toIdx, conns: [] })
    bypassGroupMap.get(key)!.conns.push(conn)
  })
  const bypassGroups = [...bypassGroupMap.values()]

  const ROW_H = compact ? 64 : 72
  const GAP_H = 56
  const LANE_W = 24

  // Label width for a bypass cable (kind label + optional custom label)
  const bypassLabelW = (conn: SignalFlowConnection): number => {
    const k = kindStyles[conn.kind] ?? kindStyles.midi
    const custom = defaultLabel(conn)
    return k.label.length * 5.5 + 14 + (custom ? 5.5 + custom.length * 5.5 : 0)
  }

  const maxLabelW = bypassGroups.length
    ? Math.max(...bypassGroups.flatMap((g) => g.conns.map(bypassLabelW)))
    : 0
  // Extra horizontal room needed for the widest group of parallel lines
  const maxGroupExtraW = bypassGroups.length
    ? Math.max(...bypassGroups.map((g) => Math.floor((g.conns.length - 1) / 2) * BYP_LINE_SPACING))
    : 0
  const lanesW = bypassGroups.length * LANE_W
  const svgW = lanesW + maxGroupExtraW + maxLabelW + 24
  const paddingR = bypassGroups.length > 0 ? svgW + 8 : 0

  // Compute actual Y tops/centers based on real gap heights (parallel = single GAP_H per pair)
  const deviceTops: number[] = []
  let _yAcc = 0
  for (let i = 0; i < ordered.length; i++) {
    deviceTops.push(_yAcc)
    _yAcc += ROW_H
    if (i < ordered.length - 1) _yAcc += chainByGap[i] ? GAP_H : 32
  }
  const outConnectorH = 40
  const outPillH = 28
  const outPillTop = _yAcc + outConnectorH
  const deviceYCenter = (i: number) => deviceTops[i] + ROW_H / 2
  const outPillYCenter = outPillTop + outPillH / 2
  const totalH = outPillTop + outPillH + 16
  const outKind: CableKind = (outConn as SignalFlowConnection | null)?.kind ?? 'audio'
  const outStyle = kindStyles[outKind]
  const outConnectorSection = (
    <>
      <div style={{ position: 'relative', height: outConnectorH, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <svg
          viewBox={`0 0 60 ${outConnectorH}`}
          style={{ position: 'absolute', left: 'calc(50% - 30px)', width: 60, height: outConnectorH }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <line x1="30" y1="0" x2="30" y2={outConnectorH - 10} stroke={outStyle.stroke} strokeWidth="1.8" strokeLinecap="round" strokeDasharray={outStyle.dash || undefined} />
          <path d={`M22 ${outConnectorH - 14} L30 ${outConnectorH - 4} L38 ${outConnectorH - 14}`} fill="none" stroke={outStyle.stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="30" cy="0" r="3" fill={outStyle.stroke} />
        </svg>
      </div>
      <div
        style={{
          alignSelf: 'center',
          border: `1px solid ${outStyle.stroke}`,
          color: outStyle.labelColor,
          background: outStyle.labelBg,
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
    </>
  )

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
            {i < ordered.length - 1 && (
              chainByGap[i]
                ? <CableConnectorGroup conns={chainByGap[i]} theme={theme} />
                : <div style={{ height: 32 }} />
            )}
          </div>
        ))}

        {outConnectorSection}
      </div>

      {bypassGroups.length > 0 && (
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
          {bypassGroups.map(({ fromIdx, toIdx, conns: gConns }, gi) => {
            const laneX = (gi + 1) * LANE_W
            const yFrom = deviceYCenter(fromIdx)
            const yTo = toIdx < ordered.length ? deviceYCenter(toIdx) : outPillYCenter
            const midY = (yFrom + yTo) / 2
            const n = gConns.length

            // Stacked label geometry
            const labelRowH = 17
            const totalLH = n * labelRowH
            const labelTopY = midY - totalLH / 2
            const rightmostX = laneX + ((n - 1) / 2) * BYP_LINE_SPACING
            const labelX = rightmostX + 8

            return (
              <g key={gi}>
                {gConns.map((conn, ci) => {
                  const style = kindStyles[conn.kind] ?? kindStyles.midi
                  const x = laneX + (ci - (n - 1) / 2) * BYP_LINE_SPACING
                  const path = `M 0 ${yFrom} L ${x - 6} ${yFrom} Q ${x} ${yFrom}, ${x} ${yFrom + 8} L ${x} ${yTo - 8} Q ${x} ${yTo}, ${x - 6} ${yTo} L 0 ${yTo}`
                  const custom = defaultLabel(conn)
                  const displayText = custom ? `${style.label} · ${custom}` : style.label
                  const lw = bypassLabelW(conn)
                  const rowY = labelTopY + ci * labelRowH

                  return (
                    <g key={conn.kind}>
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
                      {/* Label row */}
                      <rect
                        x={labelX - 3}
                        y={rowY}
                        width={lw}
                        height={labelRowH - 2}
                        fill={style.labelBg}
                        stroke={style.stroke}
                        strokeWidth="0.8"
                        rx="2"
                      />
                      <text
                        x={labelX + 1}
                        y={rowY + labelRowH - 6}
                        fontFamily="JetBrains Mono, monospace"
                        fontSize="8"
                        fontWeight="600"
                        fill={style.labelColor}
                        letterSpacing="0.14em"
                      >
                        {displayText}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
