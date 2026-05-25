import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { type DeviceType, type Device } from './Devices'
import { usePostHog } from '@posthog/react'
import { useThemeStore } from '../store/theme'
import { MOOD_COLOR } from '../lib/moodColors'

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

interface ForkState {
  forkedFrom: string
  prefill: MetaFields & { mood_tags?: string[]; devices?: SessionDevice[] }
}

interface SessionDevice {
  deviceId: string
  syncRole: 'master' | 'slave' | 'standalone'
  syncMode: string
  patchNotes: string
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

export default function NewSessionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const forkState = location.state as ForkState | null
  const user = useAuthStore((s) => s.user)
  const posthog = usePostHog()
  const theme = useThemeStore((s) => s.theme)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MetaFields>({
    defaultValues: forkState?.prefill ?? { title: '', bpm: '', key_scale: '', ableton_project: '', notes: '' },
  })

  const [devices, setDevices] = useState<Device[]>([])
  const [sessionDevices, setSessionDevices] = useState<SessionDevice[]>(
    forkState?.prefill?.devices ?? [],
  )
  const [tags, setTags] = useState<string[]>(forkState?.prefill?.mood_tags ?? [])

  useEffect(() => {
    supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setDevices(data as Device[])
      })
  }, [])

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag) || tags.length >= 10) return
    setTags((prev) => [...prev, tag])
  }
  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag))

  const onSubmit = async (values: MetaFields) => {
    const bpm = values.bpm ? parseInt(values.bpm) : null
    const { data } = await supabase
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
    if (!data) return
    if (sessionDevices.length > 0) {
      await supabase.from('session_devices').insert(
        sessionDevices.map((sd, i) => ({
          session_id: data[0].id,
          device_id: sd.deviceId,
          sync_role: sd.syncRole,
          sync_mode: sd.syncMode || null,
          patch_notes: sd.patchNotes || null,
          sort_order: i,
        })),
      )
    }
    posthog.capture('session_created', {
      session_id: data[0].id,
      has_bpm: bpm !== null,
      has_key_scale: !!values.key_scale.trim(),
      device_count: sessionDevices.length,
      tag_count: tags.length,
      is_fork: !!forkState?.forkedFrom,
    })
    navigate('/sessions')
  }

  return (
    <div className="relative z-10 p-5 sm:p-8 max-w-2xl mx-auto">
      {/* Cream paper form card */}
      <div
        className="rounded-[4px] p-[28px_30px_28px] sm:p-[36px_38px_32px]"
        style={{
          background: 'linear-gradient(180deg, #fffaee 0%, #faf0d8 100%)',
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

          {/* BPM + Key in 2-col grid */}
          <div className="grid grid-cols-2 gap-5">
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

            <FieldInput label="Key / Scale" id="key_scale">
              <input
                id="key_scale"
                placeholder="e.g. A minor"
                style={fieldStyle}
                {...register('key_scale')}
              />
            </FieldInput>
          </div>

          {/* Ableton project */}
          <FieldInput label="Ableton project" id="ableton_project">
            <input
              id="ableton_project"
              placeholder="Project name or path"
              style={fieldStyle}
              {...register('ableton_project')}
            />
          </FieldInput>

          {/* Mood picker */}
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
          </div>

          {/* Field notes */}
          <FieldInput label="Field notes" id="notes">
            <textarea
              id="notes"
              rows={3}
              style={{ ...fieldStyle, resize: 'none' }}
              {...register('notes')}
            />
          </FieldInput>

          {/* Devices section */}
          <DevicesSection
            devices={devices}
            sessionDevices={sessionDevices}
            onAdd={(device) =>
              setSessionDevices((prev) => [
                ...prev,
                { deviceId: device.id, syncRole: 'standalone', syncMode: '', patchNotes: '' },
              ])
            }
            onRemove={(idx) => setSessionDevices((prev) => prev.filter((_, i) => i !== idx))}
            onChange={(idx, patch) =>
              setSessionDevices((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)))
            }
          />

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
  devices,
  sessionDevices,
  onAdd,
  onRemove,
  onChange,
}: {
  devices: Device[]
  sessionDevices: SessionDevice[]
  onAdd: (device: Device) => void
  onRemove: (idx: number) => void
  onChange: (idx: number, patch: Partial<SessionDevice>) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickedIds = new Set(sessionDevices.map((d) => d.deviceId))
  const available = devices.filter((d) => !pickedIds.has(d.id))

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.24em] uppercase text-ink-muted"
      >
        <span>Devices in this session</span>
        <span className="flex-1 h-px bg-rule" />
      </div>

      {sessionDevices.map((sd, idx) => {
        const device = devices.find((d) => d.id === sd.deviceId)
        if (!device) return null
        return (
          <DeviceCard
            key={sd.deviceId}
            device={device}
            sessionDevice={sd}
            onChange={(patch) => onChange(idx, patch)}
            onRemove={() => onRemove(idx)}
          />
        )
      })}

      {!pickerOpen && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="font-serif italic text-[14px] text-ink-soft self-start"
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
          ＋ add device
        </button>
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
                  onAdd(device)
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
    </div>
  )
}

function DeviceCard({
  device,
  sessionDevice,
  onChange,
  onRemove,
}: {
  device: Device
  sessionDevice: SessionDevice
  onChange: (patch: Partial<SessionDevice>) => void
  onRemove: () => void
}) {
  return (
    <div
      className="relative flex flex-col gap-3 p-3 rounded-[2px]"
      style={{
        background: 'rgb(var(--card-active))',
        border: '1px solid rgb(var(--ink))',
        boxShadow: '2px 2px 0 rgba(var(--ink)/0.15)',
      }}
    >
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove device"
        className="absolute top-2.5 right-2.5 font-mono text-[14px] text-ink-muted hover:text-ink"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        ×
      </button>

      <div className="pr-6">
        <div className="font-serif font-semibold text-[15px] text-ink leading-tight">
          {device.name}
        </div>
        <div className="font-mono text-[9px] tracking-[0.16em] uppercase text-ink-muted mt-0.5">
          {device.type.replace(/_/g, ' ')}
        </div>
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
    </div>
  )
}
