import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useThemeStore } from '../store/theme'
import { useMediaQuery } from '../lib/hooks'
import { MOOD_COLOR } from '../lib/moodColors'
import { usePostHog } from '@posthog/react'
import SignalFlow, { type SignalFlowDevice, type SignalFlowConnection } from '../components/SignalFlow'
import { DEVICE_TYPE_LABELS, type DeviceType } from './Devices'

interface SessionDeviceRow {
  id: string
  device_id: string
  sync_role: string
  sync_mode: string | null
  patch_notes: string | null
  sort_order: number
  devices: { id: string; name: string; type: DeviceType }
}

export type CableKind = 'midi' | 'sync' | 'audio'

export interface SessionConnection {
  id: string
  session_id: string
  from_name: string
  to_name: string
  kind: CableKind
  label: string
  sort_order: number
}

interface Session {
  id: string
  title: string
  bpm: number | null
  key_scale: string | null
  mood_tags: string[]
  notes: string | null
  ableton_project: string | null
  forked_from: string | null
  version: number
  created_at: string
  session_devices: SessionDeviceRow[]
  session_connections?: SessionConnection[]
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

function MoodSticker({ tag, theme }: { tag: string; theme: 'light' | 'dark' }) {
  const bg = MOOD_COLOR[theme][tag] ?? 'rgb(var(--rule-soft))'
  return (
    <span
      style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 10,
        letterSpacing: '0.06em',
        textTransform: 'lowercase',
        color: theme === 'dark' ? 'rgb(var(--paper))' : 'rgb(var(--ink))',
        background: bg,
        padding: '3px 8px 2px',
        borderRadius: 12,
        border: theme === 'dark' ? '1px solid rgba(0,0,0,0.4)' : '1px solid rgba(40,30,10,0.18)',
        boxShadow: theme === 'dark' ? '1px 1px 0 rgba(0,0,0,0.5)' : '1px 1px 0 rgba(40,30,10,0.12)',
        display: 'inline-block',
        lineHeight: 1,
      }}
    >
      {tag}
    </span>
  )
}

function RoleStamp({ role, theme }: { role: string; theme: 'light' | 'dark' }) {
  const colors =
    role === 'master'
      ? { c: 'rgb(var(--accent))', bg: 'rgb(var(--accent-soft))' }
      : role === 'slave'
      ? theme === 'dark'
        ? { c: '#a7d188', bg: '#1f2c1a' }
        : { c: '#3a5a2a', bg: '#e6efd4' }
      : { c: 'rgb(var(--ink-soft))', bg: 'rgb(var(--rule-soft))' }

  return (
    <span
      style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 9,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        fontWeight: 700,
        color: colors.c,
        background: colors.bg,
        border: `1.5px solid ${colors.c}`,
        padding: '4px 10px 3px',
        borderRadius: 2,
        whiteSpace: 'nowrap',
      }}
    >
      {role}
    </span>
  )
}

function SessionDetailPanel({
  session,
  theme,
  onDelete,
  onEdit,
}: {
  session: Session
  theme: 'light' | 'dark'
  onDelete: () => void
  onEdit: () => void
}) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const connections: SignalFlowConnection[] = (session.session_connections ?? []).map((c) => ({
    from: c.from_name,
    to: c.to_name,
    kind: c.kind,
    label: c.label,
  }))
  const sfDevices: SignalFlowDevice[] = session.session_devices.map((sd) => ({
    name: sd.devices.name,
    role: sd.sync_role,
    type: sd.devices.type,
    sync: sd.sync_mode,
  }))

  return (
    <div className="relative flex flex-col gap-[22px] overflow-hidden">
      {/* Page stamp */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          border: '2px solid rgb(var(--accent))',
          color: 'rgb(var(--accent))',
          padding: '4px 10px',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          fontWeight: 700,
          transform: 'rotate(-8deg)',
          opacity: 0.8,
          zIndex: 1,
          transformOrigin: 'top right',
        }}
      >
        Take · {String(session.version ?? 1).padStart(2, '0')}
      </div>

      {/* Title */}
      <div>
        <h1
          className="font-serif font-semibold text-ink"
          style={{ fontSize: isMobile ? 28 : 38, lineHeight: 1.05, letterSpacing: '-0.02em', maxWidth: 380 }}
        >
          {session.title}
        </h1>
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-ink-muted mt-1.5">
          Logged {formatRelative(session.created_at)}
          {session.ableton_project && ` · ${session.ableton_project}`}
        </div>
      </div>

      {/* BPM hero */}
      {session.bpm !== null && (
        <div
          className="flex items-baseline gap-4 pb-1 border-b border-rule"
          style={{ flexWrap: 'wrap' }}
        >
          <span
            className="font-serif italic text-ink"
            style={{ fontSize: isMobile ? 28 : 36, opacity: 0.5, lineHeight: 1 }}
          >
            ♩=
          </span>
          <span
            className="font-serif italic font-bold text-accent"
            style={{ fontSize: isMobile ? 56 : 86, lineHeight: 1, letterSpacing: '-0.02em' }}
          >
            {session.bpm}
          </span>
          {session.key_scale && (
            <div className="flex flex-col gap-0.5 ml-2">
              <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-ink-muted">Key</span>
              <span className="font-serif italic text-[22px] text-ink">{session.key_scale}</span>
            </div>
          )}
          <div className="flex-1" />
          {session.mood_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {session.mood_tags.map((t) => (
                <MoodSticker key={t} tag={t} theme={theme} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Signal flow */}
      {session.session_devices.length > 0 && (
        <div>
          <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.28em] uppercase text-ink-muted mb-2">
            <span>Signal flow</span>
            <span className="flex-1 h-px bg-rule" />
            <span>{connections.length} cables</span>
          </div>
          <div
            style={{
              background: 'rgba(0,0,0,0.025)',
              border: '1px dashed rgb(var(--rule))',
              borderRadius: 4,
              padding: '14px 16px 10px',
            }}
          >
            <SignalFlow
              devices={sfDevices}
              connections={connections}
              theme={theme}
              compact={isMobile}
            />
            {(() => {
              const master = session.session_devices.find((sd) => sd.sync_role === 'master')
              return master ? (
                <div
                  className="text-center font-serif italic text-[13px] text-ink-soft mt-1.5"
                >
                  {master.devices.name} clocks the rig; FX chain feeds the mixer.
                </div>
              ) : null
            })()}
          </div>
        </div>
      )}

      {/* Gear & patches */}
      {session.session_devices.length > 0 && (
        <div>
          <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.28em] uppercase text-ink-muted mb-2">
            <span>Gear &amp; patches</span>
            <span className="flex-1 h-px bg-rule" />
            <span>{session.session_devices.length} items</span>
          </div>
          {session.session_devices.map((sd, i) => (
            <div
              key={sd.id}
              className="grid gap-3.5 pb-3.5 mb-3.5 border-b border-dashed border-rule last:border-0 last:mb-0 last:pb-0"
              style={{ gridTemplateColumns: '26px 1fr auto', alignItems: 'start' }}
            >
              <div className="font-serif italic font-bold text-[22px] text-accent leading-none">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <div className="font-serif font-semibold text-[18px] text-ink leading-tight">
                  {sd.devices.name}
                </div>
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted mt-0.5">
                  {DEVICE_TYPE_LABELS[sd.devices.type]}
                </div>
                {sd.sync_mode && (
                  <div className="font-mono text-[11px] text-ink-soft mt-2">
                    sync · {sd.sync_mode}
                  </div>
                )}
                {sd.patch_notes && (
                  <div className="font-serif italic text-[14px] text-ink-mid mt-1.5 leading-[1.45]">
                    "{sd.patch_notes}"
                  </div>
                )}
              </div>
              <RoleStamp role={sd.sync_role} theme={theme} />
            </div>
          ))}
        </div>
      )}

      {/* Field notes */}
      {session.notes && (
        <div>
          <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.28em] uppercase text-ink-muted mb-2">
            <span>Field notes</span>
            <span className="flex-1 h-px bg-rule" />
          </div>
          <div
            className="font-serif italic text-[17px] text-ink-mid leading-[1.5]"
            style={{ borderLeft: '3px solid rgb(var(--accent))', paddingLeft: 16 }}
          >
            {session.notes}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center gap-3.5 pt-2 border-t border-dashed border-rule flex-wrap">
        <button
          onClick={onEdit}
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
            cursor: 'pointer',
          }}
        >
          Continue / edit →
        </button>
        <div className="flex-1" />
        <button
          onClick={onDelete}
          className="font-serif italic text-[14px] text-accent underline cursor-pointer"
          style={{ background: 'none', border: 'none' }}
        >
          burn this page
        </button>
      </div>
    </div>
  )
}

function SessionCard({
  session,
  isActive,
  theme,
  onClick,
}: {
  session: Session
  isActive: boolean
  theme: 'light' | 'dark'
  onClick: () => void
}) {
  const firstDeviceNames = session.session_devices
    .slice(0, 3)
    .map((sd) => sd.devices.name.split(' ')[0])
    .join(' + ')

  return (
    <Link
      to={`/sessions/${session.id}`}
      onClick={(e) => { e.preventDefault(); onClick() }}
      className="relative text-left w-full rounded-[2px] p-[14px_16px_16px] transition-all block"
      style={{
        background: isActive ? 'rgb(var(--card-active))' : 'transparent',
        border: `1px solid ${isActive ? 'rgb(var(--ink))' : 'transparent'}`,
        boxShadow: isActive ? '3px 3px 0 rgb(var(--ink))' : 'none',
        transform: isActive ? 'rotate(-0.3deg)' : 'none',
        textDecoration: 'none',
      }}
    >
      {isActive && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            left: 16,
            width: 70,
            height: 16,
            background: theme === 'dark' ? 'rgba(244,211,94,0.55)' : 'rgba(244,211,94,0.85)',
            borderLeft: '1px solid rgba(120,90,30,0.15)',
            borderRight: '1px solid rgba(120,90,30,0.15)',
            boxShadow: '0 1px 2px rgba(40,30,10,0.18)',
            transform: 'rotate(-2deg)',
          }}
        />
      )}
      <div
        className="absolute top-3.5 right-3.5 font-mono text-[9px] tracking-[0.18em] uppercase text-ink-muted"
      >
        {formatRelative(session.created_at)}
      </div>

      <div className="font-serif font-semibold text-[18px] text-ink leading-[1.2] mt-0.5">
        {session.title}
      </div>

      <div className="flex items-baseline gap-2.5 mt-1.5 font-mono text-[11px] text-ink-soft tracking-[0.04em]">
        <span className="font-serif italic font-bold text-[22px] text-accent leading-none">
          {session.bpm}
        </span>
        <span className="font-mono text-[10px] text-ink-muted tracking-[0.2em] ml-0.5">BPM</span>
        {session.key_scale && <span>— {session.key_scale}</span>}
      </div>

      {session.mood_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {session.mood_tags.map((t) => (
            <MoodSticker key={t} tag={t} theme={theme} />
          ))}
        </div>
      )}

      {session.session_devices.length > 0 && (
        <div className="font-mono text-[11px] text-ink-muted tracking-[0.04em] mt-2" style={{ opacity: 0.7 }}>
          {session.session_devices.length} dev. · {firstDeviceNames}
        </div>
      )}
    </Link>
  )
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const theme = useThemeStore((s) => s.theme)
  const navigate = useNavigate()
  const posthog = usePostHog()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isPhone = useMediaQuery('(max-width: 640px)')

  useEffect(() => {
    supabase
      .from('sessions')
      .select('*, session_devices(*, devices(*))')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setSessions(data as Session[])
      })
  }, [])

  useEffect(() => {
    if (sessions.length > 0 && !activeId) {
      setActiveId(sessions[0].id)
    }
  }, [sessions, activeId])

  useEffect(() => {
    if (!activeId) return
    supabase
      .from('sessions')
      .select('*, session_devices(*, devices(*))')
      .eq('id', activeId)
      .single()
      .then(async ({ data }) => {
        if (!data) return
        const { data: connData } = await supabase
          .from('session_connections')
          .select('*')
          .eq('session_id', activeId)
          .order('sort_order')
        setActiveSession({ ...(data as Session), session_connections: connData ?? [] })
      })
  }, [activeId])

  const filtered = query
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          (s.notes?.toLowerCase().includes(query.toLowerCase()) ?? false),
      )
    : sessions

  const handleCardClick = (session: Session) => {
    if (isDesktop) {
      setActiveId(session.id)
    } else {
      navigate(`/sessions/${session.id}`)
    }
  }

  const handleDelete = async () => {
    if (!activeSession) return
    if (!window.confirm('Burn this page?')) return
    posthog.capture('session_deleted', { session_id: activeSession.id })
    await supabase.from('sessions').delete().eq('id', activeSession.id)
    setSessions((prev) => prev.filter((s) => s.id !== activeSession.id))
    const remaining = sessions.filter((s) => s.id !== activeSession.id)
    setActiveId(remaining[0]?.id ?? null)
    setActiveSession(null)
  }

  const handleEdit = () => {
    if (activeSession) navigate(`/sessions/${activeSession.id}`, { state: { editing: true } })
  }

  return (
    <div className="relative z-10">
      {/* Two-column on desktop */}
      <div className="lg:grid" style={{ gridTemplateColumns: '1fr 640px' }}>

        {/* Left: ledger */}
        <section
          className="px-8 py-8 flex flex-col gap-[18px] border-r border-dashed border-rule relative"
          style={{ minHeight: 'calc(100vh - 72px)' }}
        >
          {/* Header row */}
          <div
            className="flex justify-between items-end pb-2.5"
            style={{ borderBottom: '1.5px solid rgb(var(--ink))' }}
          >
            <div className="flex items-baseline gap-2.5 lg:hidden">
              <span className="font-serif font-semibold text-[32px] tracking-[-0.01em] leading-none text-ink">
                patch-pal
              </span>
              <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-ink-muted">
                Studio journal · vol. 02
              </span>
            </div>
            <div className="hidden lg:flex items-baseline gap-2.5">
              <h2 className="font-serif font-semibold text-[24px] tracking-[-0.01em] leading-none text-ink">
                Sessions
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/sessions/new"
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 10,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  background: 'rgb(var(--btn-bg))',
                  color: 'rgb(var(--btn-text))',
                  padding: '8px 12px 7px',
                  borderRadius: 2,
                  boxShadow: '2px 2px 0 rgb(var(--accent))',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                ＋ New entry
              </Link>
            </div>
          </div>

          {/* Search */}
          <input
            placeholder="…search the ledger"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px dashed rgb(var(--ink-muted))',
              padding: '6px 0',
              fontFamily: '"Spectral", serif',
              fontSize: 14,
              fontStyle: 'italic',
              color: 'rgb(var(--ink-soft))',
              outline: 'none',
              width: '100%',
            }}
          />

          {/* Section label */}
          {sessions.length > 0 && (
            <div className="font-mono text-[10px] tracking-[0.24em] uppercase text-ink-muted -mb-1">
              This week · {filtered.length} entries
            </div>
          )}

          {/* Empty state */}
          {sessions.length === 0 && (
            <p className="font-serif italic text-[14px] text-ink-soft">
              No sessions yet.{' '}
              <Link to="/sessions/new" className="text-accent underline">
                Log your first jam →
              </Link>
            </p>
          )}

          {sessions.length > 0 && filtered.length === 0 && (
            <p className="font-serif italic text-[14px] text-ink-muted">
              No sessions match your search.
            </p>
          )}

          {/* Session cards */}
          <div className="flex flex-col gap-4">
            {filtered.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                isActive={session.id === activeId}
                theme={theme}
                onClick={() => handleCardClick(session)}
              />
            ))}
          </div>
        </section>

        {/* Right: session detail (desktop only) */}
        <div className="hidden lg:block">
          {activeSession ? (
            <div
              className="m-8 rounded-[4px] p-[36px_38px_32px] overflow-hidden relative"
              style={{
                background: 'var(--paper-grad)',
                boxShadow: theme === 'dark'
                  ? '0 1px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.4), 0 30px 60px rgba(0,0,0,0.3)'
                  : '0 1px 0 rgba(40,30,10,0.05), 0 10px 24px rgba(80,55,20,0.12), 0 30px 60px rgba(80,55,20,0.08)',
                border: '1px solid rgb(var(--rule-soft))',
              }}
            >
              <SessionDetailPanel
                session={activeSession}
                theme={theme}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            </div>
          ) : (
            <div className="m-8 flex items-center justify-center h-64">
              <p className="font-serif italic text-ink-muted text-[14px]">
                Select a session to view details.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      {isPhone && (
        <Link
          to="/sessions/new"
          className="fixed bottom-[72px] right-5 z-40 flex items-center justify-center"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: 'rgb(var(--btn-bg))',
            color: 'rgb(var(--btn-text))',
            boxShadow: '3px 3px 0 rgb(var(--accent))',
            fontFamily: '"Spectral", serif',
            fontSize: 30,
            fontWeight: 600,
            lineHeight: 0.9,
            textDecoration: 'none',
          }}
        >
          ＋
        </Link>
      )}
    </div>
  )
}
