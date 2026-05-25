import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import { DEVICE_TYPE_LABELS, type DeviceType } from './Devices'
import { usePostHog } from '@posthog/react'
import { useThemeStore } from '../store/theme'
import { useMediaQuery } from '../lib/hooks'
import { MOOD_COLOR } from '../lib/moodColors'
import SignalFlow, { type SignalFlowDevice, type SignalFlowConnection } from '../components/SignalFlow'

const MOOD_SUGGESTIONS = [
  'dark', 'hypnotic', 'ambient', 'playful', 'broken',
  'noisy', 'experimental', 'melancholic', 'energetic', 'lo-fi',
] as const

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

interface SessionDeviceRow {
  id: string
  device_id: string
  sync_role: string
  sync_mode: string | null
  patch_notes: string | null
  sort_order: number
  devices: { id: string; name: string; type: DeviceType }
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
  session_connections: SessionConnection[]
}

interface EditFields {
  title: string
  bpm: string
  key_scale: string
  ableton_project: string
  notes: string
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

function RoleStamp({ role }: { role: string }) {
  const colors =
    role === 'master'
      ? { c: 'rgb(var(--accent))', bg: 'rgb(var(--accent-soft))' }
      : role === 'slave'
      ? { c: '#3a5a2a', bg: '#e6efd4' }
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

function FieldInput({
  label,
  id,
  children,
}: {
  label: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

const fieldInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '1.5px solid rgb(var(--ink))',
  padding: '6px 0',
  fontFamily: '"Spectral", serif',
  fontStyle: 'italic',
  fontSize: 16,
  color: 'rgb(var(--ink))',
  outline: 'none',
  width: '100%',
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const posthog = usePostHog()
  const theme = useThemeStore((s) => s.theme)
  const isMobile = useMediaQuery('(max-width: 640px)')

  const [session, setSession] = useState<Session | null>(null)
  const [parentTitle, setParentTitle] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [isContinue, setIsContinue] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [editConnections, setEditConnections] = useState<{ fromName: string; toName: string; kind: CableKind; label: string }[]>([])

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag) || tags.length >= 10) return
    setTags((prev) => [...prev, tag])
  }
  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag))

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditFields>()

  useEffect(() => {
    supabase
      .from('sessions')
      .select('*, session_devices(*, devices(*))')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        if (!data) return
        const { data: connData } = await supabase
          .from('session_connections')
          .select('*')
          .eq('session_id', id)
          .order('sort_order')
        const s: Session = { ...(data as Session), session_connections: connData ?? [] }
        setSession(s)
        setTags(s.mood_tags)
        if (s.forked_from) {
          supabase
            .from('sessions')
            .select('id, title')
            .eq('id', s.forked_from)
            .single()
            .then(({ data: parent }) => {
              if (parent) setParentTitle((parent as { title: string }).title)
            })
        }
      })
  }, [id])

  const startEdit = (continueMode = false) => {
    if (!session) return
    reset({
      title: session.title,
      bpm: session.bpm?.toString() ?? '',
      key_scale: session.key_scale ?? '',
      ableton_project: session.ableton_project ?? '',
      notes: session.notes ?? '',
    })
    setTags(session.mood_tags)
    setEditConnections(
      (session.session_connections ?? []).map((c) => ({
        fromName: c.from_name,
        toName: c.to_name,
        kind: c.kind,
        label: c.label,
      })),
    )
    setIsContinue(continueMode)
    setEditing(true)
  }

  const cancelEdit = () => {
    setTags(session?.mood_tags ?? [])
    setEditConnections([])
    setIsContinue(false)
    setEditing(false)
  }

  useEffect(() => {
    if (session && (location.state as { continueTake?: boolean } | null)?.continueTake) {
      startEdit(true)
      window.history.replaceState({}, '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const onSave = handleSubmit(async (values) => {
    const nextVersion = isContinue ? (session?.version ?? 1) + 1 : (session?.version ?? 1)
    const { data } = await supabase
      .from('sessions')
      .update({
        title: values.title.trim(),
        bpm: values.bpm ? parseInt(values.bpm) : null,
        key_scale: values.key_scale.trim() || null,
        ableton_project: values.ableton_project.trim() || null,
        notes: values.notes.trim() || null,
        mood_tags: tags,
        version: nextVersion,
      })
      .eq('id', id)
      .select()
    if (!data?.[0]) return

    await supabase.from('session_connections').delete().eq('session_id', id)
    if (editConnections.length > 0) {
      await supabase.from('session_connections').insert(
        editConnections.map((c, i) => ({
          session_id: id,
          from_name: c.fromName,
          to_name: c.toName,
          kind: c.kind,
          label: c.label,
          sort_order: i,
        })),
      )
    }

    posthog.capture('session_updated', { session_id: id })
    setSession((prev) =>
      prev
        ? {
            ...prev,
            ...data[0],
            session_connections: editConnections.map((c, i) => ({
              id: '',
              session_id: id!,
              from_name: c.fromName,
              to_name: c.toName,
              kind: c.kind,
              label: c.label,
              sort_order: i,
            })),
          }
        : prev,
    )
    setEditing(false)
  })

  const handleDelete = async () => {
    if (!window.confirm('Burn this page?')) return
    posthog.capture('session_deleted', { session_id: id })
    await supabase.from('sessions').delete().eq('id', id)
    navigate('/sessions')
  }

  const handleContinue = () => {
    posthog.capture('session_continued', { session_id: id })
    startEdit(true)
  }

  if (!session) return null

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
    <div className="relative z-10 p-5 sm:p-8 max-w-2xl mx-auto">
      {session.forked_from && parentTitle && (
        <Link
          to={`/sessions/${session.forked_from}`}
          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft mb-6"
        >
          ← Continued from: <span className="text-ink ml-1">{parentTitle}</span>
        </Link>
      )}

      {/* Cream paper card */}
      <div
        className="rounded-[4px] p-[28px_30px_28px] sm:p-[36px_38px_32px] overflow-hidden relative"
        style={{
          background: 'linear-gradient(180deg, #fffaee 0%, #faf0d8 100%)',
          boxShadow: theme === 'dark'
            ? '0 1px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.4), 0 30px 60px rgba(0,0,0,0.3)'
            : '0 1px 0 rgba(40,30,10,0.05), 0 10px 24px rgba(80,55,20,0.12), 0 30px 60px rgba(80,55,20,0.08)',
          border: '1px solid rgb(var(--rule-soft))',
        }}
      >
        {editing ? (
          <form onSubmit={onSave} className="flex flex-col gap-5">
            <h2 className="font-serif font-semibold text-[24px] text-ink leading-tight">
              {isContinue ? 'Continue this take' : 'Edit session'}
            </h2>

            <FieldInput label="Title" id="title">
              <input
                id="title"
                style={fieldInputStyle}
                {...register('title', { required: 'Title is required' })}
              />
              {errors.title && (
                <p className="font-serif italic text-[14px] text-accent">{errors.title.message}</p>
              )}
            </FieldInput>

            <FieldInput label="♩= BPM" id="bpm">
              <input
                id="bpm"
                type="number"
                style={{ ...fieldInputStyle, fontSize: 42, fontWeight: 700, color: 'rgb(var(--accent))' }}
                {...register('bpm', {
                  min: { value: 1, message: 'BPM must be between 1 and 399' },
                  max: { value: 399, message: 'BPM must be between 1 and 399' },
                })}
              />
              {errors.bpm && (
                <p className="font-serif italic text-[14px] text-accent">{errors.bpm.message}</p>
              )}
            </FieldInput>

            <FieldInput label="Key / Scale" id="key_scale">
              <input id="key_scale" style={fieldInputStyle} {...register('key_scale')} />
            </FieldInput>

            <FieldInput label="Ableton project" id="ableton_project">
              <input id="ableton_project" style={fieldInputStyle} {...register('ableton_project')} />
            </FieldInput>

            <FieldInput label="Field notes" id="notes">
              <textarea
                id="notes"
                rows={3}
                style={{ ...fieldInputStyle, resize: 'none' }}
                {...register('notes')}
              />
            </FieldInput>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">Mood</span>
              <div className="flex flex-wrap gap-2">
                {MOOD_SUGGESTIONS.map((s) => {
                  const sel = tags.includes(s)
                  const bg = sel
                    ? (MOOD_COLOR[theme][s] ?? 'rgb(var(--tape))')
                    : 'transparent'
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sel ? removeTag(s) : addTag(s)}
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 10,
                        letterSpacing: '0.06em',
                        textTransform: 'lowercase',
                        color: theme === 'dark' ? 'rgb(var(--paper))' : 'rgb(var(--ink))',
                        background: bg,
                        padding: '5px 10px 4px',
                        borderRadius: 12,
                        border: `1px ${sel ? 'solid' : 'dashed'} rgb(var(--ink))`,
                        cursor: 'pointer',
                        opacity: sel ? 1 : 0.65,
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {tags
                  .filter((t) => !MOOD_SUGGESTIONS.includes(t as typeof MOOD_SUGGESTIONS[number]))
                  .map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-soft"
                    >
                      {tag}
                      <button
                        type="button"
                        aria-label={`remove ${tag}`}
                        onClick={() => removeTag(tag)}
                        className="text-ink-muted hover:text-ink"
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
              <input
                placeholder="Add a custom tag"
                style={{ ...fieldInputStyle, fontSize: 14 }}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag(tagInput)
                    setTagInput('')
                  }
                }}
              />
            </div>

            {session.session_devices.length >= 2 && (
              <EditConnectionsSection
                deviceNames={session.session_devices.map((sd) => sd.devices.name)}
                connections={editConnections}
                onAdd={(c) => setEditConnections((prev) => [...prev, c])}
                onRemove={(idx) => setEditConnections((prev) => prev.filter((_, i) => i !== idx))}
              />
            )}

            <div className="flex items-center gap-4 pt-2 border-t border-dashed border-rule">
              <button
                type="submit"
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
                {isContinue ? 'Save take' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="font-serif italic text-[14px] text-ink-soft underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-[22px] relative">
            {/* Page stamp */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
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
                transformOrigin: 'top right',
              }}
            >
              Take · {String(session.version ?? 1).padStart(2, '0')}
            </div>

            {/* Title */}
            <div>
              <h1
                className="font-serif font-semibold text-ink"
                style={{
                  fontSize: isMobile ? 28 : 38,
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                  maxWidth: 380,
                }}
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
                className="flex items-baseline gap-4 pb-1 border-b border-rule flex-wrap"
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
                    <span className="font-mono text-[11px] tracking-[0.22em] uppercase text-ink-muted">
                      Key
                    </span>
                    <span className="font-serif italic text-[22px] text-ink">
                      {session.key_scale}
                    </span>
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
                      <div className="text-center font-serif italic text-[13px] text-ink-soft mt-1.5">
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
                    <RoleStamp role={sd.sync_role} />
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
                onClick={handleContinue}
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
                  width: isMobile ? '100%' : 'auto',
                }}
              >
                Continue this take →
              </button>
              <button
                onClick={startEdit}
                className="font-serif italic text-[14px] text-ink-soft underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                edit
              </button>
              <div className="flex-1" />
              <button
                onClick={handleDelete}
                className="font-serif italic text-[14px] text-accent underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                burn this page
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const CABLE_KINDS: CableKind[] = ['audio', 'midi', 'sync']
const CABLE_KIND_COLORS: Record<CableKind, string> = {
  audio: '#c13b2a',
  midi:  'rgb(var(--ink))',
  sync:  'rgb(var(--ink))',
}

function EditConnectionsSection({
  deviceNames,
  connections,
  onAdd,
  onRemove,
}: {
  deviceNames: string[]
  connections: { fromName: string; toName: string; kind: CableKind; label: string }[]
  onAdd: (c: { fromName: string; toName: string; kind: CableKind; label: string }) => void
  onRemove: (idx: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({
    fromName: deviceNames[0] ?? '',
    toName: deviceNames[1] ?? '',
    kind: 'audio' as CableKind,
    label: '',
  })

  const toOptions = [...deviceNames, 'OUT']

  const confirmAdd = () => {
    if (!draft.fromName || !draft.toName) return
    onAdd({ ...draft, label: draft.label.trim() })
    setDraft({ fromName: deviceNames[0] ?? '', toName: deviceNames[1] ?? '', kind: 'audio', label: '' })
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.24em] uppercase text-ink-muted">
        <span>Cables</span>
        <span className="flex-1 h-px bg-rule" />
        <span>{connections.length} {connections.length === 1 ? 'cable' : 'cables'}</span>
      </div>

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

      {adding ? (
        <div
          className="flex flex-col gap-3 p-3 rounded-[2px]"
          style={{ background: 'rgba(0,0,0,0.03)', border: '1px dashed rgb(var(--rule))' }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">From</span>
              <select
                value={draft.fromName}
                onChange={(e) => setDraft((d) => ({ ...d, fromName: e.target.value }))}
                className="font-serif text-[14px] text-ink bg-transparent outline-none"
                style={{ border: 'none', borderBottom: '1.5px solid rgb(var(--ink))', padding: '4px 0' }}
              >
                {deviceNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">To</span>
              <select
                value={draft.toName}
                onChange={(e) => setDraft((d) => ({ ...d, toName: e.target.value }))}
                className="font-serif text-[14px] text-ink bg-transparent outline-none"
                style={{ border: 'none', borderBottom: '1.5px solid rgb(var(--ink))', padding: '4px 0' }}
              >
                {toOptions.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-1.5">
            {CABLE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, kind: k }))}
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  padding: '4px 8px 3px',
                  borderRadius: 2,
                  border: '1.5px solid',
                  cursor: 'pointer',
                  ...(draft.kind === k
                    ? { background: 'rgb(var(--ink))', color: 'rgb(var(--paper))', borderColor: 'rgb(var(--ink))' }
                    : { background: 'transparent', color: 'rgb(var(--ink-muted))', borderColor: 'rgb(var(--rule))' }),
                }}
              >
                {k}
              </button>
            ))}
          </div>

          <input
            placeholder="Cable label, e.g. stereo out, sy1 audio sync"
            value={draft.label}
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd() } }}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px dashed rgb(var(--ink-muted))',
              padding: '4px 0',
              fontFamily: '"Spectral", serif',
              fontStyle: 'italic',
              fontSize: 14,
              color: 'rgb(var(--ink-soft))',
              outline: 'none',
            }}
          />

          <div className="flex gap-3 items-center">
            <button
              type="button"
              onClick={confirmAdd}
              disabled={draft.fromName === draft.toName}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 700,
                padding: '5px 12px 4px',
                borderRadius: 2,
                border: 'none',
                background: 'rgb(var(--ink))',
                color: 'rgb(var(--paper))',
                cursor: 'pointer',
                opacity: draft.fromName === draft.toName ? 0.4 : 1,
              }}
            >
              Add cable
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="font-serif italic text-[13px] text-ink-muted"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft({ fromName: deviceNames[0] ?? '', toName: deviceNames[1] ?? '', kind: 'audio', label: '' })
            setAdding(true)
          }}
          className="font-serif italic text-[14px] text-ink-soft"
          style={{
            background: 'transparent',
            border: '1px dashed rgb(var(--ink-muted))',
            borderRadius: 2,
            padding: '8px 16px',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'center',
          }}
        >
          ＋ add cable
        </button>
      )}
    </div>
  )
}
