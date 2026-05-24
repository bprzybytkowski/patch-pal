import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { DEVICE_TYPE_LABELS, DEVICE_TYPE_BADGE, type DeviceType, type Device } from './Devices'

const MOOD_SUGGESTIONS = ['dark', 'hypnotic', 'ambient', 'playful', 'broken', 'noisy', 'experimental', 'melancholic', 'energetic', 'lo-fi'] as const

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

export default function NewSessionPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const forkState = location.state as ForkState | null

  const user = useAuthStore((s) => s.user)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MetaFields>({
    defaultValues: forkState?.prefill ?? { title: '', bpm: '', key_scale: '', ableton_project: '', notes: '' },
  })

  const [devices, setDevices] = useState<Device[]>([])
  const [sessionDevices, setSessionDevices] = useState<SessionDevice[]>(forkState?.prefill?.devices ?? [])
  const [tags, setTags] = useState<string[]>(forkState?.prefill?.mood_tags ?? [])
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    supabase.from('devices').select('*').order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setDevices(data as Device[]) })
  }, [])

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag) || tags.length >= 10) return
    setTags((prev) => [...prev, tag])
  }

  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag))

  const onSubmit = async (values: MetaFields) => {
    const bpm = values.bpm ? parseInt(values.bpm) : null
    const { data } = await supabase.from('sessions').insert({
      user_id: user!.id,
      title: values.title.trim(),
      bpm,
      key_scale: values.key_scale.trim() || null,
      ableton_project: values.ableton_project.trim() || null,
      notes: values.notes.trim() || null,
      mood_tags: tags,
      forked_from: forkState?.forkedFrom ?? null,
    }).select()
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
        }))
      )
    }
    navigate('/sessions')
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 max-w-2xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <h1 className="text-zinc-100 text-lg font-medium">New session</h1>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="title" className="text-xs text-zinc-400">Title</label>
            <input
              id="title"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('title', { required: 'Title is required' })}
            />
            {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="bpm" className="text-xs text-zinc-400">BPM</label>
            <input
              id="bpm"
              type="number"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('bpm', {
                min: { value: 1, message: 'BPM must be between 1 and 399' },
                max: { value: 399, message: 'BPM must be between 1 and 399' },
              })}
            />
            {errors.bpm && <p className="text-xs text-red-400">{errors.bpm.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="key_scale" className="text-xs text-zinc-400">Key / Scale</label>
            <input
              id="key_scale"
              placeholder="e.g. A minor"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('key_scale')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="ableton_project" className="text-xs text-zinc-400">Ableton project</label>
            <input
              id="ableton_project"
              placeholder="Project name or path"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('ableton_project')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="notes" className="text-xs text-zinc-400">Notes</label>
            <textarea
              id="notes"
              rows={3}
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              {...register('notes')}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-zinc-400">Mood tags</span>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded">
                  {tag}
                  <button
                    type="button"
                    aria-label={`remove ${tag}`}
                    onClick={() => removeTag(tag)}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {MOOD_SUGGESTIONS.filter((s) => !tags.includes(s)).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTag(s)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded"
                >
                  {s}
                </button>
              ))}
            </div>
            <input
              placeholder="Add a custom tag"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
        </div>

        <DevicesSection
          devices={devices}
          sessionDevices={sessionDevices}
          onAdd={(device) => setSessionDevices((prev) => [...prev, { deviceId: device.id, syncRole: 'standalone', syncMode: '', patchNotes: '' }])}
          onRemove={(idx) => setSessionDevices((prev) => prev.filter((_, i) => i !== idx))}
          onChange={(idx, patch) => setSessionDevices((prev) => prev.map((d, i) => i === idx ? { ...d, ...patch } : d))}
        />

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Save session
          </button>
          <Link to="/sessions" className="text-zinc-400 hover:text-zinc-100 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

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

  const addDevice = (device: Device) => {
    onAdd(device)
    setPickerOpen(false)
  }

  const pickedIds = new Set(sessionDevices.map((d) => d.deviceId))
  const available = devices.filter((d) => !pickedIds.has(d.id))

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-zinc-100 text-sm font-medium">Devices in this session</h2>

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
          className="text-zinc-400 hover:text-zinc-100 text-sm self-start"
        >
          Add device
        </button>
      )}

      {pickerOpen && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2">
          {devices.length === 0 ? (
            <p className="text-zinc-500 text-sm">
              No gear saved yet.{' '}
              <Link to="/devices" className="text-indigo-400 hover:text-indigo-300">
                Add your devices first →
              </Link>
            </p>
          ) : (
            <select
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              defaultValue=""
              onChange={(e) => {
                const device = devices.find((d) => d.id === e.target.value)
                if (device) addDevice(device)
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
            className="text-zinc-500 hover:text-zinc-400 text-xs self-start"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

const SYNC_ROLES = ['master', 'slave', 'standalone'] as const

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
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3 relative">
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove device"
        className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 text-sm"
      >
        ×
      </button>

      <div className="flex items-center gap-2 flex-wrap pr-6">
        <span className="text-zinc-100 text-sm font-medium">{device.name}</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DEVICE_TYPE_BADGE[device.type as DeviceType]}`}>
          {DEVICE_TYPE_LABELS[device.type as DeviceType]}
        </span>
      </div>

      <div className="flex gap-1">
        {SYNC_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => onChange({ syncRole: role })}
            className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${
              sessionDevice.syncRole === role
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      <input
        placeholder="e.g. SY2, MIDI clock"
        className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        value={sessionDevice.syncMode}
        onChange={(e) => onChange({ syncMode: e.target.value })}
      />

      <textarea
        rows={2}
        placeholder="What were you running? Sounds, patterns, knob positions, anything you'd need to recreate this."
        className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
        value={sessionDevice.patchNotes}
        onChange={(e) => onChange({ patchNotes: e.target.value })}
      />
    </div>
  )
}
