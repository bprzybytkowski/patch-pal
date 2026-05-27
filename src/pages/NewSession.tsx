import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { useToastStore } from '../store/toast'
import { type Device } from './Devices'
import { usePostHog } from '@posthog/react'
import { useThemeStore } from '../store/theme'
import { MOOD_COLOR } from '../lib/moodColors'
import SignalFlow, { type CableKind } from '../components/SignalFlow'
import { updateAudioOutForReorder } from '../lib/sessionDevices'
import { ConnectionTypeSheet } from '../components/ConnectionTypeSheet'
import { useConnectionDrawing } from '../lib/hooks'
import { uploadDevicePhoto, deleteDevicePhoto } from '../lib/photos'

const CABLE_KIND_COLORS: Record<CableKind, string> = {
  audio: '#c13b2a',
  midi: 'rgb(var(--ink))',
  sync: 'rgb(var(--ink))',
}

const MOOD_SUGGESTIONS = [
  'dark', 'hypnotic', 'ambient', 'playful', 'broken',
  'noisy', 'experimental', 'melancholic', 'energetic', 'lo-fi',
] as const

interface MetaFields {
  title: string
  bpm: string
  key_scale: string
  ableton_project: string
  notes: string
}

interface SessionConnection {
  fromName: string
  toName: string
  kind: CableKind
  label: string
}

interface ForkState {
  forkedFrom: string
  prefill: MetaFields & { mood_tags?: string[]; devices?: SessionDevice[]; connections?: SessionConnection[] }
}

interface SessionDevice {
  deviceId: string
  syncRole: 'master' | 'slave' | 'standalone'
  syncMode: string
  patchNotes: string
  photoUrl?: string
}

const fieldStyle: React.CSSProperties = {
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

function FieldInput({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

function getDefaultTitle(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Morning Jam'
  if (hour >= 12 && hour < 17) return 'Afternoon Jam'
  if (hour >= 17 && hour < 21) return 'Evening Session'
  return 'Late Night Session'
}

const DRAFT_KEY = 'patchpal_new_session_draft'

interface DraftState {
  fields: MetaFields
  sessionDevices: SessionDevice[]
  sessionConnections: SessionConnection[]
  tags: string[]
}

function loadDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as DraftState) : null
  } catch {
    return null
  }
}

function saveDraft(draft: DraftState) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {}
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

export default function NewSessionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const forkState = location.state as ForkState | null
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const posthog = usePostHog()
  const theme = useThemeStore((s) => s.theme)

  const draftRef = useRef<DraftState | null>(!forkState ? loadDraft() : null)
  const draft = draftRef.current

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<MetaFields>({
    defaultValues: forkState?.prefill ?? draft?.fields ?? { title: getDefaultTitle(), bpm: '', key_scale: '', ableton_project: '', notes: '' },
  })

  const [devices, setDevices] = useState<Device[]>([])
  const [sessionDevices, setSessionDevices] = useState<SessionDevice[]>(
    forkState?.prefill?.devices ?? draft?.sessionDevices ?? [],
  )
  const [sessionConnections, setSessionConnections] = useState<SessionConnection[]>(
    forkState?.prefill?.connections ?? draft?.sessionConnections ?? [],
  )
  const [tags, setTags] = useState<string[]>(forkState?.prefill?.mood_tags ?? draft?.tags ?? [])
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    if (draft) addToast({ message: 'Draft restored', type: 'success' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const formValues = watch()

  useEffect(() => {
    if (forkState) return
    if (!formValues.bpm && !formValues.title) return
    const timer = setTimeout(() => {
      saveDraft({ fields: formValues, sessionDevices, sessionConnections, tags })
    }, 800)
    return () => clearTimeout(timer)
  }, [formValues, sessionDevices, sessionConnections, tags, forkState])

  useEffect(() => {
    supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          const devList = data as Device[]
          setDevices(devList)
          if (!forkState && !draft && devList.length > 0 && devList.length <= 5) {
            setSessionDevices(
              devList.map((d) => ({ deviceId: d.id, syncRole: 'standalone' as const, syncMode: '', patchNotes: '' })),
            )
            const lastDevice = devList[devList.length - 1]
            setSessionConnections([{ fromName: lastDevice.name, toName: 'OUT', kind: 'audio', label: '' }])
          }
        }
      })
  }, [])

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag) || tags.length >= 10) return
    setTags((prev) => [...prev, tag])
  }
  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag))

  const onSubmit = async (values: MetaFields) => {
    try {
      const bpm = values.bpm ? parseInt(values.bpm) : null
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          user_id: user!.id,
          title: values.title.trim(),
          bpm,
          key_scale: values.key_scale.trim() || null,
          ableton_project: values.ableton_project.trim() || null,
          notes: values.notes.trim() || null,
          mood_tags: tags,
          forked_from: forkState?.forkedFrom ?? null,
        })
        .select()
      if (error || !data) {
        addToast({ message: 'Failed to save session. Please try again.', type: 'error' })
        return
      }
      if (sessionDevices.length > 0) {
        const { error: devErr } = await supabase.from('session_devices').insert(
          sessionDevices.map((sd, i) => ({
            session_id: data[0].id,
            device_id: sd.deviceId,
            sync_role: sd.syncRole,
            sync_mode: sd.syncMode || null,
            patch_notes: sd.patchNotes || null,
            photo_url: sd.photoUrl || null,
            sort_order: i,
          })),
        )
        if (devErr) {
          addToast({ message: 'Session saved but devices could not be attached.', type: 'error' })
        }
      }
      if (sessionConnections.length > 0) {
        const { error: connErr } = await supabase.from('session_connections').insert(
          sessionConnections.map((c, i) => ({
            session_id: data[0].id,
            from_name: c.fromName,
            to_name: c.toName,
            kind: c.kind,
            label: c.label,
            sort_order: i,
          })),
        )
        if (connErr) {
          addToast({ message: 'Session saved but signal flow could not be saved.', type: 'error' })
        }
      }
      clearDraft()
      posthog.capture('session_created', {
        session_id: data[0].id,
        has_bpm: bpm !== null,
        has_key_scale: !!values.key_scale.trim(),
        device_count: sessionDevices.length,
        connection_count: sessionConnections.length,
        tag_count: tags.length,
        is_fork: !!forkState?.forkedFrom,
      })
      navigate('/sessions')
    } catch {
      addToast({ message: 'Failed to save session. Check your connection and try again.', type: 'error' })
    }
  }

  return (
    <div className="relative z-10 p-5 sm:p-8 max-w-2xl mx-auto">
      {/* Cream paper form card */}
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
          <h1
            className="font-serif font-semibold text-ink"
            style={{ fontSize: 32, letterSpacing: '-0.01em', lineHeight: 1 }}
          >
            New entry
          </h1>

          {/* Title */}
          <FieldInput label="Title" id="title">
            <input
              id="title"
              style={fieldStyle}
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
              style={{
                ...fieldStyle,
                fontSize: 42,
                fontWeight: 700,
                color: 'rgb(var(--accent))',
                letterSpacing: '-0.02em',
              }}
              {...register('bpm', {
                min: { value: 1, message: 'BPM must be between 1 and 399' },
                max: { value: 399, message: 'BPM must be between 1 and 399' },
              })}
            />
            {errors.bpm && (
              <p className="font-serif italic text-[14px] text-accent">{errors.bpm.message}</p>
            )}
          </FieldInput>

          {/* More options toggle */}
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="self-start font-serif italic text-[13px] text-ink-muted"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {showMore ? '▾ fewer options' : '▸ more options'}
          </button>

          {showMore && (
            <>
              <FieldInput label="Key / Scale" id="key_scale">
                <input
                  id="key_scale"
                  placeholder="e.g. A minor"
                  style={fieldStyle}
                  {...register('key_scale')}
                />
              </FieldInput>

              <FieldInput label="Ableton project" id="ableton_project">
                <input
                  id="ableton_project"
                  placeholder="Project name or path"
                  style={fieldStyle}
                  {...register('ableton_project')}
                />
              </FieldInput>

              <div className="flex flex-col gap-2">
                <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">Mood</span>
                <div className="flex flex-wrap gap-2">
                  {MOOD_SUGGESTIONS.map((s) => {
                    const sel = tags.includes(s)
                    const bg = sel ? (MOOD_COLOR[theme][s] ?? 'rgba(244,211,94,0.85)') : 'transparent'
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => (sel ? removeTag(s) : addTag(s))}
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
              </div>

              <FieldInput label="Field notes" id="notes">
                <textarea
                  id="notes"
                  rows={3}
                  style={{ ...fieldStyle, resize: 'none' }}
                  {...register('notes')}
                />
              </FieldInput>
            </>
          )}

          {/* Devices section */}
          <DevicesSection
            userId={user!.id}
            devices={devices}
            sessionDevices={sessionDevices}
            connections={sessionConnections}
            onAddDevice={(device) => {
              const currentLastDeviceId = sessionDevices[sessionDevices.length - 1]?.deviceId
              const currentLastDevice = currentLastDeviceId
                ? devices.find((d) => d.id === currentLastDeviceId)
                : null
              setSessionDevices((prev) => [
                ...prev,
                { deviceId: device.id, syncRole: 'standalone', syncMode: '', patchNotes: '' },
              ])
              setSessionConnections((prev) => {
                const lastHasOut = currentLastDevice
                  ? prev.some(
                      (c) => c.fromName === currentLastDevice.name && c.toName === 'OUT' && c.kind === 'audio',
                    )
                  : false
                if (sessionDevices.length === 0 || lastHasOut) {
                  const filtered = currentLastDevice
                    ? prev.filter(
                        (c) => !(c.fromName === currentLastDevice.name && c.toName === 'OUT' && c.kind === 'audio'),
                      )
                    : prev
                  return [...filtered, { fromName: device.name, toName: 'OUT', kind: 'audio', label: '' }]
                }
                return prev
              })
            }}
            onAddAllDevices={(devicesToAdd) => {
              const currentLastDeviceId = sessionDevices[sessionDevices.length - 1]?.deviceId
              const currentLastDevice = currentLastDeviceId
                ? devices.find((d) => d.id === currentLastDeviceId)
                : null
              const newLastDevice = devicesToAdd[devicesToAdd.length - 1]
              setSessionDevices((prev) => [
                ...prev,
                ...devicesToAdd.map((d) => ({ deviceId: d.id, syncRole: 'standalone' as const, syncMode: '', patchNotes: '' })),
              ])
              setSessionConnections((prev) => {
                const lastHasOut = currentLastDevice
                  ? prev.some(
                      (c) => c.fromName === currentLastDevice.name && c.toName === 'OUT' && c.kind === 'audio',
                    )
                  : false
                if (sessionDevices.length === 0 || lastHasOut) {
                  const filtered = currentLastDevice
                    ? prev.filter(
                        (c) => !(c.fromName === currentLastDevice.name && c.toName === 'OUT' && c.kind === 'audio'),
                      )
                    : prev
                  return [...filtered, { fromName: newLastDevice.name, toName: 'OUT', kind: 'audio', label: '' }]
                }
                return prev
              })
            }}
            onRemoveDevice={(idx) => {
              const removed = devices.find((d) => d.id === sessionDevices[idx].deviceId)
              if (removed) {
                setSessionConnections((prev) =>
                  prev.filter((c) => c.fromName !== removed.name && c.toName !== removed.name),
                )
              }
              setSessionDevices((prev) => prev.filter((_, i) => i !== idx))
            }}
            onChange={(idx, patch) =>
              setSessionDevices((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
            }
            onReorder={(from, to) => {
              const reordered = arrayMove(sessionDevices, from, to)
              setSessionDevices(reordered)
              const oldLastId = sessionDevices[sessionDevices.length - 1]?.deviceId
              const newLastId = reordered[reordered.length - 1]?.deviceId
              if (oldLastId !== newLastId) {
                const oldLast = devices.find((d) => d.id === oldLastId)
                const newLast = devices.find((d) => d.id === newLastId)
                if (oldLast && newLast) {
                  setSessionConnections((prev) =>
                    updateAudioOutForReorder(prev, oldLast.name, newLast.name),
                  )
                }
              }
            }}
            onAddConnection={(c) => setSessionConnections((prev) => [...prev, c])}
            onRemoveConnection={(idx) => setSessionConnections((prev) => prev.filter((_, i) => i !== idx))}
          />

          {/* Live signal flow preview */}
          {sessionConnections.length > 0 && sessionDevices.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.24em] uppercase text-ink-muted mb-3">
                <span>Signal flow</span>
                <span className="flex-1 h-px bg-rule" />
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
                  devices={sessionDevices
                    .map((sd) => {
                      const d = devices.find((dev) => dev.id === sd.deviceId)
                      if (!d) return null
                      return { name: d.name, role: sd.syncRole, type: d.type, sync: sd.syncMode || null }
                    })
                    .filter(Boolean) as { name: string; role: string; type: string; sync: string | null }[]}
                  connections={sessionConnections.map((c) => ({
                    from: c.fromName,
                    to: c.toName,
                    kind: c.kind,
                    label: c.label,
                  }))}
                  theme={theme}
                  compact
                />
              </div>
            </div>
          )}

          {/* Save / Cancel */}
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
              Save session
            </button>
            <Link
              to="/sessions"
              onClick={clearDraft}
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

const SYNC_ROLES = ['master', 'slave', 'standalone'] as const

function DevicesSection({
  userId,
  devices,
  sessionDevices,
  connections,
  onAddDevice,
  onAddAllDevices,
  onRemoveDevice,
  onChange,
  onReorder,
  onAddConnection,
  onRemoveConnection,
}: {
  userId: string
  devices: Device[]
  sessionDevices: SessionDevice[]
  connections: SessionConnection[]
  onAddDevice: (device: Device) => void
  onAddAllDevices: (devices: Device[]) => void
  onRemoveDevice: (idx: number) => void
  onChange: (idx: number, patch: Partial<SessionDevice>) => void
  onReorder: (from: number, to: number) => void
  onAddConnection: (c: SessionConnection) => void
  onRemoveConnection: (idx: number) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickedIds = new Set(sessionDevices.map((d) => d.deviceId))
  const available = devices.filter((d) => !pickedIds.has(d.id))
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
    const from = sessionDevices.findIndex((sd) => sd.deviceId === active.id)
    const to = sessionDevices.findIndex((sd) => sd.deviceId === over.id)
    if (from !== -1 && to !== -1) onReorder(from, to)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.24em] uppercase text-ink-muted"
      >
        <span>Devices in this session</span>
        <span className="flex-1 h-px bg-rule" />
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={sessionDevices.map((sd) => sd.deviceId)} strategy={verticalListSortingStrategy}>
          {sessionDevices.map((sd, idx) => {
            const device = devices.find((d) => d.id === sd.deviceId)
            if (!device) return null
            const connectionMode =
              armedDevice === device.name ? 'armed' : isArmed ? 'targeting' : 'idle'
            const connectionCount = connections.filter(
              (c) => c.fromName === device.name || c.toName === device.name,
            ).length
            return (
              <DeviceCard
                key={sd.deviceId}
                userId={userId}
                device={device}
                sessionDevice={sd}
                onChange={(patch) => onChange(idx, patch)}
                onRemove={() => onRemoveDevice(idx)}
                connectionMode={connectionMode}
                connectionCount={connectionCount}
                onArm={() => arm(device.name)}
                onConnect={() => complete(device.name)}
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
              onClick={() => onAddAllDevices(available)}
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
          style={{
            background: 'rgba(0,0,0,0.03)',
            border: '1px dashed rgb(var(--rule))',
          }}
        >
          {devices.length === 0 ? (
            <p className="font-serif italic text-[14px] text-ink-soft">
              No gear saved yet.{' '}
              <Link to="/devices" className="text-accent underline">
                Add your devices first →
              </Link>
            </p>
          ) : (
            <select
              className="font-serif text-[14px] text-ink bg-transparent outline-none"
              style={{
                border: 'none',
                borderBottom: '1.5px solid rgb(var(--ink))',
                padding: '6px 0',
              }}
              defaultValue=""
              onChange={(e) => {
                const device = devices.find((d) => d.id === e.target.value)
                if (device) {
                  onAddDevice(device)
                  setPickerOpen(false)
                }
              }}
            >
              <option value="" disabled>Select a device…</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
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

function DeviceCard({
  userId,
  device,
  sessionDevice,
  onChange,
  onRemove,
  connectionMode,
  connectionCount,
  onArm,
  onConnect,
}: {
  userId: string
  device: Device
  sessionDevice: SessionDevice
  onChange: (patch: Partial<SessionDevice>) => void
  onRemove: () => void
  connectionMode: 'idle' | 'armed' | 'targeting'
  connectionCount: number
  onArm: () => void
  onConnect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sessionDevice.deviceId })
  const addToast = useToastStore((s) => s.addToast)
  const [uploading, setUploading] = useState(false)

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadDevicePhoto(file, userId)
      onChange({ photoUrl: url })
    } catch (err) {
      addToast({ message: err instanceof Error ? err.message : 'Upload failed.', type: 'error' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemovePhoto = async () => {
    if (!sessionDevice.photoUrl) return
    onChange({ photoUrl: undefined })
    await deleteDevicePhoto(sessionDevice.photoUrl)
  }

  return (
    <div
      ref={setNodeRef}
      className="relative flex flex-col gap-3 p-3 rounded-[2px]"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        background: connectionMode === 'armed' ? 'rgb(var(--card-active))' : 'rgb(var(--card-active))',
        border: connectionMode === 'armed'
          ? '1.5px solid rgb(var(--ink))'
          : connectionMode === 'targeting'
          ? '1px dashed rgb(var(--ink-muted))'
          : '1px solid rgb(var(--ink))',
        boxShadow: connectionMode === 'armed'
          ? '3px 3px 0 rgba(var(--ink)/0.2)'
          : connectionMode === 'targeting'
          ? 'none'
          : '2px 2px 0 rgba(var(--ink)/0.15)',
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
            {device.name}
          </div>
          <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-ink-muted mt-0.5">
            {device.type.replace(/_/g, ' ')}
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

      {/* Role selector */}
      <div className="flex gap-1.5">
        {SYNC_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            aria-pressed={sessionDevice.syncRole === role}
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
              ...(sessionDevice.syncRole === role
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
        value={sessionDevice.syncMode}
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
        value={sessionDevice.patchNotes}
        onChange={(e) => onChange({ patchNotes: e.target.value })}
      />

      {/* Photo */}
      {sessionDevice.photoUrl ? (
        <div style={{ position: 'relative' }}>
          <img
            src={sessionDevice.photoUrl}
            alt="patch photo"
            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 2, border: '1px dashed rgb(var(--rule))', display: 'block' }}
          />
          <button
            type="button"
            aria-label="Remove photo"
            onClick={handleRemovePhoto}
            style={{ position: 'absolute', top: 4, right: 4, background: 'rgb(var(--paper))', border: '1px solid rgb(var(--rule))', borderRadius: 2, width: 22, height: 22, display: 'grid', placeItems: 'center', cursor: 'pointer', fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: 'rgb(var(--ink-muted))' }}
          >
            ×
          </button>
        </div>
      ) : (
        <label style={{ display: 'block', cursor: uploading ? 'default' : 'pointer' }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={handlePhotoChange} />
          <span style={{ display: 'block', textAlign: 'center', padding: '5px 10px', border: '1px dashed rgb(var(--rule))', borderRadius: 2, fontFamily: '"JetBrains Mono", monospace', fontSize: 8, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgb(var(--ink-muted))', opacity: uploading ? 0.5 : 1 }}>
            {uploading ? 'uploading…' : '⊕ photo'}
          </span>
        </label>
      )}

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
