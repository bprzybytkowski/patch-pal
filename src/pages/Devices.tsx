import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Box,
  Cpu,
  type LucideIcon,
  Music2,
  Scissors,
  Sliders,
  Wand2,
  Zap,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/auth'
import { usePostHog } from '@posthog/react'
import { useThemeStore } from '../store/theme'

export type DeviceType =
  | 'pocket_operator'
  | 'analog_synth'
  | 'digital_synth'
  | 'drum_machine'
  | 'sampler'
  | 'effects_unit'
  | 'other'

export interface Device {
  id: string
  user_id: string
  name: string
  type: DeviceType
  manufacturer: string | null
  notes: string | null
  created_at: string
}

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  pocket_operator: 'Pocket Operator',
  analog_synth:   'Analog synth',
  digital_synth:  'Digital synth',
  drum_machine:   'Drum machine',
  sampler:        'Sampler',
  effects_unit:   'Effects unit',
  other:          'Other',
}

export const DEVICE_TYPE_BADGE: Record<DeviceType, string> = {
  pocket_operator: 'bg-indigo-900 text-indigo-300',
  analog_synth:    'bg-amber-900 text-amber-300',
  digital_synth:   'bg-cyan-900 text-cyan-300',
  drum_machine:    'bg-rose-900 text-rose-300',
  sampler:         'bg-violet-900 text-violet-300',
  effects_unit:    'bg-green-900 text-green-300',
  other:           'bg-zinc-800 text-zinc-400',
}

export const DEVICE_ICONS: Record<DeviceType, LucideIcon> = {
  pocket_operator: Cpu,
  analog_synth:    Sliders,
  digital_synth:   Zap,
  drum_machine:    Music2,
  sampler:         Scissors,
  effects_unit:    Wand2,
  other:           Box,
}

const DEVICE_TYPES: DeviceType[] = [
  'pocket_operator', 'analog_synth', 'digital_synth', 'drum_machine',
  'sampler', 'effects_unit', 'other',
]

interface FormValues {
  name: string
  type: DeviceType
  manufacturer: string
  notes: string
}

function DeviceCard({
  device,
  isFirst,
  onEdit,
  onDelete,
}: {
  device: Device
  isFirst: boolean
  onEdit: (device: Device) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className="relative rounded-[2px] p-[14px_16px_16px]"
      style={{
        background: 'rgb(var(--card-active))',
        border: '1px solid rgb(var(--ink))',
        boxShadow: '3px 3px 0 rgba(var(--ink)/0.2)',
      }}
    >
      {isFirst && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            left: 16,
            width: 70,
            height: 16,
            background: 'rgba(244,211,94,0.85)',
            borderLeft: '1px solid rgba(120,90,30,0.15)',
            borderRight: '1px solid rgba(120,90,30,0.15)',
            boxShadow: '0 1px 2px rgba(40,30,10,0.18)',
            transform: 'rotate(-2deg)',
          }}
        />
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="font-serif font-semibold text-[18px] text-ink leading-tight">
            {device.name}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">
              {DEVICE_TYPE_LABELS[device.type]}
            </span>
            {device.manufacturer && (
              <>
                <span className="text-rule">·</span>
                <span className="font-mono text-[10px] tracking-[0.12em] text-ink-muted">
                  {device.manufacturer}
                </span>
              </>
            )}
          </div>
          {device.notes && (
            <span className="font-serif italic text-[13px] text-ink-soft mt-1">
              {device.notes}
            </span>
          )}
        </div>
        <div className="flex gap-3 shrink-0 items-start">
          <button
            onClick={() => onEdit(device)}
            className="font-serif italic text-[14px] text-ink-soft underline cursor-pointer"
            style={{ background: 'none', border: 'none' }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(device.id)}
            className="font-serif italic text-[14px] text-accent underline cursor-pointer"
            style={{ background: 'none', border: 'none' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function EditCard({
  device,
  onSave,
  onCancel,
}: {
  device: Device
  onSave: (values: FormValues) => Promise<void>
  onCancel: () => void
}) {
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      name: device.name,
      type: device.type,
      manufacturer: device.manufacturer ?? '',
      notes: device.notes ?? '',
    },
  })
  const selectedType = watch('type')

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

  return (
    <form
      onSubmit={handleSubmit(onSave)}
      className="flex flex-col gap-4 p-[14px_16px_16px] rounded-[2px]"
      style={{
        background: 'rgb(var(--card-active))',
        border: '1px solid rgb(var(--ink))',
        boxShadow: '3px 3px 0 rgba(var(--ink)/0.2)',
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`edit-name-${device.id}`}
          className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted"
        >
          Name
        </label>
        <input
          id={`edit-name-${device.id}`}
          style={fieldStyle}
          {...register('name', { required: true })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">
          Type
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {DEVICE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setValue('type', t)}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '8px 12px',
                borderRadius: 2,
                border: '1.5px solid',
                cursor: 'pointer',
                textAlign: 'left',
                ...(selectedType === t
                  ? {
                      background: 'rgba(244,211,94,0.85)',
                      borderColor: 'rgb(var(--ink))',
                      color: 'rgb(var(--ink))',
                      fontWeight: 700,
                    }
                  : {
                      background: 'transparent',
                      borderColor: 'rgb(var(--ink))',
                      borderStyle: 'dashed',
                      color: 'rgb(var(--ink-muted))',
                      opacity: 0.6,
                    }),
              }}
            >
              {DEVICE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`edit-manufacturer-${device.id}`}
          className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted"
        >
          Manufacturer
        </label>
        <input
          id={`edit-manufacturer-${device.id}`}
          style={fieldStyle}
          {...register('manufacturer')}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`edit-notes-${device.id}`}
          className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted"
        >
          Notes
        </label>
        <textarea
          id={`edit-notes-${device.id}`}
          rows={2}
          style={{ ...fieldStyle, resize: 'none' }}
          {...register('notes')}
        />
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-dashed border-rule">
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            background: 'rgb(var(--btn-bg))',
            color: 'rgb(var(--btn-text))',
            padding: '8px 14px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
            boxShadow: '2px 2px 0 rgb(var(--accent))',
            borderRadius: 2,
            border: 'none',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.5 : 1,
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-serif italic text-[14px] text-ink-soft underline"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          cancel
        </button>
      </div>
    </form>
  )
}

export default function DevicesPage() {
  const user = useAuthStore((s) => s.user)
  const posthog = usePostHog()
  const theme = useThemeStore((s) => s.theme)
  const [devices, setDevices] = useState<Device[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addError, setAddError] = useState('')

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { name: '', type: 'pocket_operator', manufacturer: '', notes: '' },
  })
  const selectedType = watch('type')

  useEffect(() => {
    supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setDevices(data as Device[])
      })
  }, [])

  const handleAdd = handleSubmit(async (values) => {
    setAddError('')
    const { data, error } = await supabase
      .from('devices')
      .insert({
        user_id: user!.id,
        name: values.name.trim(),
        type: values.type,
        manufacturer: values.manufacturer.trim() || null,
        notes: values.notes.trim() || null,
      })
      .select()
    if (error) { setAddError(error.message); return }
    if (data) {
      posthog.capture('device_added', { device_type: values.type })
      setDevices((prev) => [...prev, ...(data as Device[])])
      reset()
    }
  })

  const handleEdit = async (values: FormValues, deviceId: string) => {
    const { data } = await supabase
      .from('devices')
      .update({
        name: values.name.trim(),
        type: values.type,
        manufacturer: values.manufacturer.trim() || null,
        notes: values.notes.trim() || null,
      })
      .eq('id', deviceId)
      .select()
    if (data) {
      posthog.capture('device_updated', { device_id: deviceId, device_type: values.type })
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? (data[0] as Device) : d)))
      setEditingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this device?')) return
    posthog.capture('device_deleted', { device_id: id })
    await supabase.from('devices').delete().eq('id', id)
    setDevices((prev) => prev.filter((d) => d.id !== id))
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

  return (
    <div data-testid="devices-page" className="relative z-10 p-5 sm:p-8 max-w-2xl mx-auto">
      {/* Add device form */}
      <div
        className="rounded-[4px] p-[28px_30px_28px] mb-8"
        style={{
          background: 'var(--paper-grad)',
          boxShadow: theme === 'dark'
            ? '0 1px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.4)'
            : '0 1px 0 rgba(40,30,10,0.05), 0 10px 24px rgba(80,55,20,0.12)',
          border: '1px solid rgb(var(--rule-soft))',
        }}
      >
        <form onSubmit={handleAdd} className="flex flex-col gap-5">
          <h2
            className="font-serif font-semibold text-ink"
            style={{ fontSize: 24, letterSpacing: '-0.01em', lineHeight: 1 }}
          >
            Add device
          </h2>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">
              Name
            </label>
            <input
              id="name"
              style={fieldStyle}
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && (
              <p className="font-serif italic text-[14px] text-accent">{errors.name.message}</p>
            )}
          </div>

          {/* Type grid */}
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">
              Type
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {DEVICE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue('type', t)}
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '8px 12px',
                    borderRadius: 2,
                    border: '1.5px solid',
                    cursor: 'pointer',
                    textAlign: 'left',
                    ...(selectedType === t
                      ? {
                          background: 'rgba(244,211,94,0.85)',
                          borderColor: 'rgb(var(--ink))',
                          color: 'rgb(var(--ink))',
                          fontWeight: 700,
                        }
                      : {
                          background: 'transparent',
                          borderColor: 'rgb(var(--ink))',
                          borderStyle: 'dashed',
                          color: 'rgb(var(--ink-muted))',
                          opacity: 0.6,
                        }),
                  }}
                >
                  {DEVICE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="manufacturer"
              className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted"
            >
              Manufacturer
            </label>
            <input id="manufacturer" style={fieldStyle} {...register('manufacturer')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="dev-notes" className="font-mono text-[9px] tracking-[0.22em] uppercase text-ink-muted">
              Notes
            </label>
            <textarea
              id="dev-notes"
              rows={2}
              style={{ ...fieldStyle, resize: 'none' }}
              {...register('notes')}
            />
          </div>

          {addError && (
            <p className="font-serif italic text-[14px] text-accent">{addError}</p>
          )}

          <div className="pt-2 border-t border-dashed border-rule">
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
              Add device
            </button>
          </div>
        </form>
      </div>

      {/* Device list */}
      <div
        className="flex items-center gap-2.5 font-mono text-[10px] tracking-[0.28em] uppercase text-ink-muted mb-4"
      >
        <span>My gear</span>
        <span className="flex-1 h-px bg-rule" />
        <span>{devices.length} items</span>
      </div>

      <div className="flex flex-col gap-4">
        {devices.length === 0 && (
          <p className="font-serif italic text-[14px] text-ink-muted">No devices yet.</p>
        )}
        {devices.map((device, i) =>
          editingId === device.id ? (
            <EditCard
              key={device.id}
              device={device}
              onSave={(values) => handleEdit(values, device.id)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <DeviceCard
              key={device.id}
              device={device}
              isFirst={i === 0}
              onEdit={(d) => setEditingId(d.id)}
              onDelete={handleDelete}
            />
          ),
        )}
      </div>
    </div>
  )
}
