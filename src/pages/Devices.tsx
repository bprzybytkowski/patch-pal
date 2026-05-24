import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import posthog from 'posthog-js'
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
  analog_synth: 'Analog synth',
  digital_synth: 'Digital synth',
  drum_machine: 'Drum machine',
  sampler: 'Sampler',
  effects_unit: 'Effects unit',
  other: 'Other',
}

const DEVICE_TYPE_BADGE: Record<DeviceType, string> = {
  pocket_operator: 'bg-indigo-900 text-indigo-300',
  analog_synth: 'bg-amber-900 text-amber-300',
  digital_synth: 'bg-cyan-900 text-cyan-300',
  drum_machine: 'bg-rose-900 text-rose-300',
  sampler: 'bg-violet-900 text-violet-300',
  effects_unit: 'bg-green-900 text-green-300',
  other: 'bg-zinc-800 text-zinc-400',
}

const DEVICE_ICONS: Record<DeviceType, LucideIcon> = {
  pocket_operator: Cpu,
  analog_synth: Sliders,
  digital_synth: Zap,
  drum_machine: Music2,
  sampler: Scissors,
  effects_unit: Wand2,
  other: Box,
}

const DEVICE_TYPES: DeviceType[] = [
  'pocket_operator',
  'analog_synth',
  'digital_synth',
  'drum_machine',
  'sampler',
  'effects_unit',
  'other',
]

interface FormValues {
  name: string
  type: DeviceType
  manufacturer: string
  notes: string
}

function TypeBadge({ type }: { type: DeviceType }) {
  const Icon = DEVICE_ICONS[type]
  return (
    <span
      data-testid="type-badge"
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${DEVICE_TYPE_BADGE[type]}`}
    >
      <Icon size={12} />
      {DEVICE_TYPE_LABELS[type]}
    </span>
  )
}

function DeviceCard({
  device,
  onEdit,
  onDelete,
}: {
  device: Device
  onEdit: (device: Device) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-100 text-sm font-medium">{device.name}</span>
          <TypeBadge type={device.type} />
        </div>
        {device.manufacturer && (
          <span className="text-zinc-400 text-xs">{device.manufacturer}</span>
        )}
        {device.notes && (
          <span className="text-zinc-500 text-xs">{device.notes}</span>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => onEdit(device)}
          className="text-zinc-400 hover:text-zinc-100 text-sm"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(device.id)}
          className="text-red-400 hover:text-red-300 text-sm"
        >
          Delete
        </button>
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
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      name: device.name,
      type: device.type,
      manufacturer: device.manufacturer ?? '',
      notes: device.notes ?? '',
    },
  })

  return (
    <form
      onSubmit={handleSubmit(onSave)}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`edit-name-${device.id}`} className="text-xs text-zinc-400">Name</label>
        <input
          id={`edit-name-${device.id}`}
          className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          {...register('name', { required: true })}
        />
      </div>
      <div className="flex gap-2 mt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-zinc-400 hover:text-zinc-100 text-sm px-3 py-1.5"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { name: '', type: 'pocket_operator', manufacturer: '', notes: '' },
  })

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
    const { data } = await supabase
      .from('devices')
      .insert({
        name: values.name.trim(),
        type: values.type,
        manufacturer: values.manufacturer.trim() || null,
        notes: values.notes.trim() || null,
      })
      .select()
    if (data) {
      setDevices((prev) => [...prev, ...(data as Device[])])
      posthog.capture('device_created', { device_type: values.type })
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
      setDevices((prev) => prev.map((d) => (d.id === deviceId ? (data[0] as Device) : d)))
      setEditingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this device?')) return
    await supabase.from('devices').delete().eq('id', id)
    setDevices((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div data-testid="devices-page" className="min-h-screen bg-zinc-950 p-6 max-w-2xl mx-auto">
      <h1 className="text-zinc-100 text-lg font-medium mb-6">My gear</h1>

      <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6 flex flex-col gap-3">
        <h2 className="text-zinc-100 text-sm font-medium">Add device</h2>
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-xs text-zinc-400">Name</label>
          <input
            id="name"
            className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            {...register('name', { required: true })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="type" className="text-xs text-zinc-400">Type</label>
          <select
            id="type"
            className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            {...register('type', { required: true })}
          >
            {DEVICE_TYPES.map((t) => (
              <option key={t} value={t}>{DEVICE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="manufacturer" className="text-xs text-zinc-400">Manufacturer</label>
          <input
            id="manufacturer"
            className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            {...register('manufacturer')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className="text-xs text-zinc-400">Notes</label>
          <textarea
            id="notes"
            rows={2}
            className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            {...register('notes')}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium self-start disabled:opacity-50"
        >
          Add device
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {devices.length === 0 && (
          <p className="text-zinc-500 text-sm">No devices yet.</p>
        )}
        {devices.map((device) =>
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
              onEdit={(d) => setEditingId(d.id)}
              onDelete={handleDelete}
            />
          ),
        )}
      </div>
    </div>
  )
}
