import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { DEVICE_TYPE_LABELS, type Device, type DeviceType } from './Devices'
import { usePostHog } from '@posthog/react'
import { useThemeStore } from '../store/theme'
import { useMediaQuery, useConnectionDrawing } from '../lib/hooks'
import { MOOD_COLOR } from '../lib/moodColors'
import SignalFlow, { type SignalFlowDevice, type SignalFlowConnection } from '../components/SignalFlow'
import { ConnectionTypeSheet } from '../components/ConnectionTypeSheet'
import { useAuthStore } from '../store/auth'
import { useToastStore } from '../store/toast'
import { ConfirmModal } from '../components/ConfirmModal'

const CABLE_KIND_COLORS: Record<CableKind, string> = {
  audio: '#c13b2a',
  midi: 'rgb(var(--ink))',
  sync: 'rgb(var(--ink))',
}

const MOOD_SUGGESTIONS = [
  'dark', 'hypnotic', 'ambient', 'playful', 'broken',
  'noisy', 'experimental', 'melancholic', 'energetic', 'lo-fi',
] as const

import { type CableKind } from '../components/SignalFlow'

export type { CableKind }

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

interface EditDevice {
  deviceId: string
  syncRole: string
  syncMode: string
  patchNotes: string
  device: { id: string; name: string; type: DeviceType }
}

const SYNC_ROLES = ['master', 'slave', 'standalone'] as const

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
        color: 'rgb(var(--ink))',
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
  const user = useAuthStore((s) => s.user)

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [nextTakeId, setNextTakeId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const addToast = useToastStore((s) => s.addToast)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [editConnections, setEditConnections] = useState<{ fromName: string; toName: string; kind: CableKind; label: string }[]>([])
  const [editDevices, setEditDevices] = useState<EditDevice[]>([])
  const [allDevices, setAllDevices] = useState<Device[]>([])

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
      .then(async ({ data, error }) => {
        if (error || !data) { setFetchError(true); setLoading(false); return }
        const { data: connData } = await supabase
          .from('session_connections')
          .select('*')
          .eq('session_id', id)
          .order('sort_order')
        const raw = data as Session
        const s: Session = {
          ...raw,
          session_devices: [...(raw.session_devices ?? [])].sort((a, b) => a.sort_order - b.sort_order),
          session_connections: connData ?? [],
        }
        setSession(s)
        setTags(s.mood_tags)
        setNextTakeId(null)
        setLoading(false)
        supabase
          .from('sessions')
          .select('id')
          .eq('forked_from', id!)
          .maybeSingle()
          .then(({ data: child }) => {
            if (child) setNextTakeId((child as { id: string }).id)
          })
      })
  }, [id])

  const startEdit = () => {
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
    setEditDevices(
      session.session_devices.map((sd) => ({
        deviceId: sd.device_id,
        syncRole: sd.sync_role,
        syncMode: sd.sync_mode ?? '',
        patchNotes: sd.patch_notes ?? '',
        device: sd.devices,
      })),
    )
    supabase.from('devices').select('*').eq('user_id', user!.id).then(({ data, error }) => {
      if (error) { addToast({ message: 'Could not load devices for editing.', type: 'error' }); return }
      setAllDevices((data as Device[]) ?? [])
    })
    setEditing(true)
  }

  useEffect(() => {
    if (!session) return
    const state = location.state as { editing?: boolean } | null
    if (state?.editing) {
      startEdit()
      navigate(location.pathname, { replace: true, state: null })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const buildConnectionRows = (sessionId: string) =>
    editConnections.map((c, i) => ({
      session_id: sessionId,
      from_name: c.fromName,
      to_name: c.toName,
      kind: c.kind,
      label: c.label,
      sort_order: i,
    }))

  const onSaveChanges = handleSubmit(async (values) => {
    const updatedFields = {
      title: values.title.trim(),
      bpm: values.bpm ? parseInt(values.bpm) : null,
      key_scale: values.key_scale.trim() || null,
      ableton_project: values.ableton_project.trim() || null,
      notes: values.notes.trim() || null,
      mood_tags: tags,
      version: session?.version ?? 1,
    }
    const { error } = await supabase.from('sessions').update(updatedFields).eq('id', id)
    if (error) { addToast({ message: 'Could not save changes. Try again.', type: 'error' }); return }

    const { error: connDelErr } = await supabase.from('session_connections').delete().eq('session_id', id)
    if (connDelErr) { addToast({ message: 'Saved session but could not update signal flow.', type: 'error' }) }
    else if (editConnections.length > 0) {
      const { error: connInsErr } = await supabase.from('session_connections').insert(buildConnectionRows(id!))
      if (connInsErr) addToast({ message: 'Saved session but could not update signal flow.', type: 'error' })
    }

    const { error: devDelErr } = await supabase.from('session_devices').delete().eq('session_id', id)
    if (devDelErr) { addToast({ message: 'Saved session but could not update devices.', type: 'error' }) }
    else if (editDevices.length > 0) {
      const { error: devInsErr } = await supabase.from('session_devices').insert(
        editDevices.map((ed, i) => ({
          session_id: id,
          device_id: ed.deviceId,
          sync_role: ed.syncRole,
          sync_mode: ed.syncMode || null,
          patch_notes: ed.patchNotes || null,
          sort_order: i,
        })),
      )
      if (devInsErr) addToast({ message: 'Saved session but could not update devices.', type: 'error' })
    }

    posthog.capture('session_updated', { session_id: id })
    setSession((prev) =>
      prev
        ? {
            ...prev,
            ...updatedFields,
            session_devices: editDevices.map((ed, i) => ({
              id: '',
              device_id: ed.deviceId,
              sync_role: ed.syncRole,
              sync_mode: ed.syncMode || null,
              patch_notes: ed.patchNotes || null,
              sort_order: i,
              devices: ed.device,
            })),
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

  const onSaveAsNewTake = handleSubmit(async (values) => {
    if (!user || !session) return
    const { data: newRows, error: forkErr } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        title: values.title.trim(),
        bpm: values.bpm ? parseInt(values.bpm) : null,
        key_scale: values.key_scale.trim() || null,
        ableton_project: values.ableton_project.trim() || null,
        notes: values.notes.trim() || null,
        mood_tags: tags,
        forked_from: id,
        version: (session.version ?? 1) + 1,
      })
      .select()
    if (forkErr || !newRows?.[0]) { addToast({ message: 'Could not save new take. Try again.', type: 'error' }); return }
    const newId = newRows[0].id

    if (editDevices.length > 0) {
      const { error: devErr } = await supabase.from('session_devices').insert(
        editDevices.map((ed, i) => ({
          session_id: newId,
          device_id: ed.deviceId,
          sync_role: ed.syncRole,
          sync_mode: ed.syncMode || null,
          patch_notes: ed.patchNotes || null,
          sort_order: i,
        })),
      )
      if (devErr) addToast({ message: 'Saved new take but could not attach devices.', type: 'error' })
    }
    if (editConnections.length > 0) {
      const { error: connErr } = await supabase.from('session_connections').insert(buildConnectionRows(newId))
      if (connErr) addToast({ message: 'Saved new take but could not attach signal flow.', type: 'error' })
    }

    posthog.capture('session_created', { session_id: newId, is_fork: true })
    setEditing(false)
    setSession(null)
    navigate(`/sessions/${newId}`)
  })

  const handleDelete = async () => {
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) { addToast({ message: 'Could not delete session. Try again.', type: 'error' }); setConfirmingDelete(false); return }
    posthog.capture('session_deleted', { session_id: id })
    navigate('/sessions')
  }

  if (loading) return (
    <div className="relative z-10 p-5 sm:p-8 max-w-2xl mx-auto">
      <p className="font-serif italic text-[14px] text-ink-muted">Loading…</p>
    </div>
  )

  if (fetchError) return (
    <div className="relative z-10 p-5 sm:p-8 max-w-2xl mx-auto">
      <p className="font-serif italic text-[14px] text-accent">
        Could not load this session. Check your connection and{' '}
        <button onClick={() => window.location.reload()} className="underline" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
          refresh
        </button>.
      </p>
    </div>
  )

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
      {confirmingDelete && (
        <ConfirmModal
          message="Burn this page? This session will be permanently deleted."
          confirmLabel="Burn it"
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
      {/* Cream paper card */}
      <div
        className="rounded-[4px] p-[28px_30px_28px] sm:p-[36px_38px_32px] overflow-hidden relative"
        style={{
          background: 'var(--paper-grad)',
          boxShadow: theme === 'dark'
            ? '0 1px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.4), 0 30px 60px rgba(0,0,0,0.3)'
            : '0 1px 0 rgba(40,30,10,0.05), 0 10px 24px rgba(80,55,20,0.12), 0 30px 60px rgba(80,55,20,0.08)',
          border: '1px solid rgb(var(--rule-soft))',
        }}
      >
        {/* Take navigation */}
        {(session.forked_from || nextTakeId) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            {session.forked_from ? (
              <button
                onClick={() => navigate(`/sessions/${session.forked_from}`)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  color: 'rgb(var(--ink-muted))',
                  padding: 0,
                }}
              >
                ← prev take
              </button>
            ) : <span />}
            {nextTakeId ? (
              <button
                onClick={() => navigate(`/sessions/${nextTakeId}`)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  color: 'rgb(var(--ink-muted))',
                  padding: 0,
                }}
              >
                next take →
              </button>
            ) : <span />}
          </div>
        )}

        {editing ? (
          <form className="flex flex-col gap-5">
            <h2 className="font-serif font-semibold text-[24px] text-ink leading-tight">
              Edit session
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
                        color: 'rgb(var(--ink))',
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

            <EditDevicesSection
              allDevices={allDevices}
              editDevices={editDevices}
              connections={editConnections}
              onAdd={(device) => setEditDevices((prev) => [
                ...prev,
                { deviceId: device.id, syncRole: 'standalone', syncMode: '', patchNotes: '', device: { id: device.id, name: device.name, type: device.type } },
              ])}
              onAddAll={(devicesToAdd) => setEditDevices((prev) => [
                ...prev,
                ...devicesToAdd.map((d) => ({ deviceId: d.id, syncRole: 'standalone' as const, syncMode: '', patchNotes: '', device: { id: d.id, name: d.name, type: d.type } })),
              ])}
              onRemove={(idx) => setEditDevices((prev) => prev.filter((_, i) => i !== idx))}
              onChange={(idx, patch) => setEditDevices((prev) => prev.map((ed, i) => i === idx ? { ...ed, ...patch } : ed))}
              onReorder={(from, to) => setEditDevices((prev) => arrayMove(prev, from, to))}
              onAddConnection={(c) => setEditConnections((prev) => [...prev, c])}
              onRemoveConnection={(idx) => setEditConnections((prev) => prev.filter((_, i) => i !== idx))}
            />

            <div className="flex items-center gap-4 pt-2 border-t border-dashed border-rule">
              <button
                type="button"
                onClick={onSaveAsNewTake}
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
                Save as a new take →
              </button>
              <button
                type="button"
                onClick={onSaveChanges}
                className="font-serif italic text-[14px] text-ink-soft underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                save changes
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="font-serif italic text-[14px] text-ink-muted underline"
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
                onClick={startEdit}
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
                Continue / edit →
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setConfirmingDelete(true)}
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

function GripDots() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="2" cy="2" r="1.5" />
      <circle cx="8" cy="2" r="1.5" />
      <circle cx="2" cy="7" r="1.5" />
      <circle cx="8" cy="7" r="1.5" />
      <circle cx="2" cy="12" r="1.5" />
      <circle cx="8" cy="12" r="1.5" />
    </svg>
  )
}

function EditDeviceCard({
  editDevice,
  onChange,
  onRemove,
  connectionMode,
  connectionCount,
  onArm,
  onConnect,
}: {
  editDevice: EditDevice
  onChange: (patch: Partial<Omit<EditDevice, 'deviceId' | 'device'>>) => void
  onRemove: () => void
  connectionMode: 'idle' | 'armed' | 'targeting'
  connectionCount: number
  onArm: () => void
  onConnect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: editDevice.deviceId })

  return (
    <div
      ref={setNodeRef}
      className="relative flex flex-col gap-3 p-3 rounded-[2px]"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        background: 'rgba(0,0,0,0.03)',
        border: connectionMode === 'armed'
          ? '1.5px solid rgb(var(--ink))'
          : connectionMode === 'targeting'
          ? '1px dashed rgb(var(--ink-muted))'
          : '1px solid rgb(var(--ink))',
        boxShadow: connectionMode === 'armed'
          ? '3px 3px 0 rgba(var(--ink)/0.15)'
          : connectionMode === 'targeting'
          ? 'none'
          : '2px 2px 0 rgba(var(--ink)/0.1)',
      }}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label="Drag to reorder"
        className="absolute top-2.5 left-2"
        style={{ background: 'none', border: 'none', cursor: 'grab', padding: '2px 4px', color: 'rgb(var(--ink-muted))', touchAction: 'none' }}
      >
        <GripDots />
      </button>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove device"
        className="absolute top-2.5 right-2.5 font-mono text-[14px] text-ink-muted hover:text-ink"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        ×
      </button>

      <div className="px-6 flex items-center justify-between">
        <div>
          <div className="font-serif font-semibold text-[15px] text-ink leading-tight">
            {editDevice.device.name}
          </div>
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-ink-muted mt-0.5">
            {editDevice.device.type.replace(/_/g, ' ')}
          </div>
        </div>
        {connectionMode === 'idle' && connectionCount > 0 && (
          <span
            title={`${connectionCount} cable${connectionCount !== 1 ? 's' : ''}`}
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgb(var(--ink-muted))', flexShrink: 0, marginRight: 4 }}
          />
        )}
        {connectionMode === 'armed' && (
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgb(var(--ink-muted))' }}>
            from
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        {SYNC_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            aria-pressed={editDevice.syncRole === role}
            onClick={() => onChange({ syncRole: role })}
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
              ...(editDevice.syncRole === role
                ? { background: 'rgb(var(--ink))', color: 'rgb(var(--paper))', borderColor: 'rgb(var(--ink))' }
                : { background: 'transparent', color: 'rgb(var(--ink-muted))', borderColor: 'rgb(var(--rule))' }),
            }}
          >
            {role}
          </button>
        ))}
      </div>

      <input
        placeholder="e.g. SY2, MIDI clock"
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
        value={editDevice.syncMode}
        onChange={(e) => onChange({ syncMode: e.target.value })}
      />

      <textarea
        rows={2}
        placeholder="Patch notes, sounds, settings…"
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
          resize: 'none',
        }}
        value={editDevice.patchNotes}
        onChange={(e) => onChange({ patchNotes: e.target.value })}
      />

      {/* Connection strip */}
      <button
        type="button"
        onClick={connectionMode === 'armed' ? onArm : connectionMode === 'targeting' ? onConnect : onArm}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '6px 10px',
          margin: '0 -3px -3px',
          border: 'none',
          borderTop: connectionMode === 'targeting'
            ? '1px solid rgb(var(--ink-muted))'
            : '1px dashed rgb(var(--rule))',
          borderRadius: '0 0 2px 2px',
          background: connectionMode === 'targeting' ? 'rgba(var(--ink)/0.04)' : 'transparent',
          cursor: 'pointer',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 8,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: connectionMode === 'targeting' ? 'rgb(var(--ink))' : 'rgb(var(--ink-muted))',
          fontWeight: connectionMode === 'targeting' ? 700 : 400,
        }}
      >
        {connectionMode === 'idle' && '⟶ wire'}
        {connectionMode === 'armed' && 'cancel ×'}
        {connectionMode === 'targeting' && '→ connect here'}
      </button>
    </div>
  )
}

function EditDevicesSection({
  allDevices,
  editDevices,
  connections,
  onAdd,
  onAddAll,
  onRemove,
  onChange,
  onReorder,
  onAddConnection,
  onRemoveConnection,
}: {
  allDevices: Device[]
  editDevices: EditDevice[]
  connections: { fromName: string; toName: string; kind: CableKind; label: string }[]
  onAdd: (device: Device) => void
  onAddAll: (devices: Device[]) => void
  onRemove: (idx: number) => void
  onChange: (idx: number, patch: Partial<Omit<EditDevice, 'deviceId' | 'device'>>) => void
  onReorder: (from: number, to: number) => void
  onAddConnection: (c: { fromName: string; toName: string; kind: CableKind; label: string }) => void
  onRemoveConnection: (idx: number) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickedIds = new Set(editDevices.map((ed) => ed.deviceId))
  const available = allDevices.filter((d) => !pickedIds.has(d.id))
  const { armedDevice, pending, arm, complete, cancel: cancelArm, dismissPending } = useConnectionDrawing()
  const isArmed = armedDevice !== null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )

  const handleConfirm = (kinds: CableKind[], label: string) => {
    if (!pending) return
    for (const kind of kinds) {
      onAddConnection({ fromName: pending.from, toName: pending.to, kind, label })
    }
    dismissPending()
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = editDevices.findIndex((ed) => ed.deviceId === active.id)
    const to = editDevices.findIndex((ed) => ed.deviceId === over.id)
    if (from !== -1 && to !== -1) onReorder(from, to)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.24em] uppercase text-ink-muted">
        <span>Devices in this session</span>
        <span className="flex-1 h-px bg-rule" />
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={editDevices.map((ed) => ed.deviceId)} strategy={verticalListSortingStrategy}>
          {editDevices.map((ed, idx) => {
            const connectionMode =
              armedDevice === ed.device.name ? 'armed' : isArmed ? 'targeting' : 'idle'
            const connectionCount = connections.filter(
              (c) => c.fromName === ed.device.name || c.toName === ed.device.name,
            ).length
            return (
              <EditDeviceCard
                key={ed.deviceId}
                editDevice={ed}
                onChange={(patch) => onChange(idx, patch)}
                onRemove={() => onRemove(idx)}
                connectionMode={connectionMode}
                connectionCount={connectionCount}
                onArm={() => arm(ed.device.name)}
                onConnect={() => complete(ed.device.name)}
              />
            )
          })}
        </SortableContext>
      </DndContext>

      {/* OUT terminal — only visible when a device is armed */}
      {isArmed && (
        <button
          type="button"
          onClick={() => complete('OUT')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            border: '1px dashed rgb(var(--ink-muted))',
            borderRadius: 2,
            background: 'transparent',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 9,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
            color: 'rgb(var(--ink-muted))',
          }}>
            OUT
          </span>
          <span className="flex-1" />
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: 'rgb(var(--ink-muted))', opacity: 0.7 }}>
            →
          </span>
        </button>
      )}

      {/* Cable list */}
      {connections.length > 0 && (
        <div className="flex flex-col gap-1">
          {connections.map((c, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2"
              style={{
                padding: '5px 10px',
                background: 'rgba(0,0,0,0.02)',
                border: '1px dashed rgb(var(--rule))',
                borderRadius: 2,
              }}
            >
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 8,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: CABLE_KIND_COLORS[c.kind],
                fontWeight: 700,
                minWidth: 34,
              }}>
                {c.kind}
              </span>
              <span className="font-serif italic text-[12px] text-ink flex-1 truncate">
                {c.fromName} → {c.toName}
              </span>
              {c.label && (
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: 'rgb(var(--ink-soft))' }}>
                  {c.label}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemoveConnection(idx)}
                aria-label="Remove cable"
                className="font-mono text-[13px] text-ink-muted hover:text-ink ml-1"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {!pickerOpen && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="font-serif italic text-[14px] text-ink-soft"
            style={{
              background: 'transparent',
              border: '1px dashed rgb(var(--ink-muted))',
              borderRadius: 2,
              padding: '8px 16px',
              cursor: 'pointer',
              flex: 1,
              textAlign: 'center',
            }}
          >
            ＋ add device
          </button>
          {available.length > 1 && (
            <button
              type="button"
              onClick={() => onAddAll(available)}
              className="font-serif italic text-[14px] text-ink-soft"
              style={{
                background: 'transparent',
                border: '1px dashed rgb(var(--ink-muted))',
                borderRadius: 2,
                padding: '8px 16px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ＋ add all ({available.length})
            </button>
          )}
        </div>
      )}

      {pickerOpen && (
        <div
          className="flex flex-col gap-2 p-3 rounded-[2px]"
          style={{ background: 'rgba(0,0,0,0.03)', border: '1px dashed rgb(var(--rule))' }}
        >
          {allDevices.length === 0 ? (
            <p className="font-serif italic text-[14px] text-ink-soft">
              No gear saved yet.{' '}
              <Link to="/devices" className="text-accent underline">
                Add your devices first →
              </Link>
            </p>
          ) : available.length === 0 ? (
            <p className="font-serif italic text-[14px] text-ink-soft">All your devices are already in this session.</p>
          ) : (
            <select
              className="font-serif text-[14px] text-ink bg-transparent outline-none"
              style={{ border: 'none', borderBottom: '1.5px solid rgb(var(--ink))', padding: '6px 0' }}
              defaultValue=""
              onChange={(e) => {
                const device = allDevices.find((d) => d.id === e.target.value)
                if (device) { onAdd(device); setPickerOpen(false) }
              }}
            >
              <option value="" disabled>Select a device…</option>
              {available.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="font-serif italic text-[13px] text-ink-muted self-start"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            cancel
          </button>
        </div>
      )}

      {pending && (
        <ConnectionTypeSheet
          pending={pending}
          existingConnections={connections}
          onConfirm={handleConfirm}
          onCancel={() => { dismissPending(); cancelArm() }}
        />
      )}
    </div>
  )
}


