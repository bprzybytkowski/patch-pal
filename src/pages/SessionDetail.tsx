import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'
import { DEVICE_TYPE_LABELS, DEVICE_TYPE_BADGE, type DeviceType } from './Devices'
import { usePostHog } from '@posthog/react'

const MOOD_SUGGESTIONS = ['dark', 'hypnotic', 'ambient', 'playful', 'broken', 'noisy', 'experimental', 'melancholic', 'energetic', 'lo-fi'] as const

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
  created_at: string
  session_devices: SessionDeviceRow[]
}

interface EditFields {
  title: string
  bpm: string
  key_scale: string
  ableton_project: string
  notes: string
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const posthog = usePostHog()
  const [session, setSession] = useState<Session | null>(null)
  const [parentTitle, setParentTitle] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase()
    if (!tag || tags.includes(tag) || tags.length >= 10) return
    setTags((prev) => [...prev, tag])
  }
  const removeTag = (tag: string) => setTags((prev) => prev.filter((t) => t !== tag))

  const { register, handleSubmit, reset } = useForm<EditFields>()

  useEffect(() => {
    supabase
      .from('sessions')
      .select('*, session_devices(*, devices(*))')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const s = data as Session
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
        }
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
    setEditing(true)
  }

  const cancelEdit = () => {
    setTags(session?.mood_tags ?? [])
    setEditing(false)
  }

  const onSave = handleSubmit(async (values) => {
    const { data } = await supabase
      .from('sessions')
      .update({
        title: values.title.trim(),
        bpm: values.bpm ? parseInt(values.bpm) : null,
        key_scale: values.key_scale.trim() || null,
        ableton_project: values.ableton_project.trim() || null,
        notes: values.notes.trim() || null,
        mood_tags: tags,
      })
      .eq('id', id)
      .select()
    if (data?.[0]) {
      posthog.capture('session_updated', { session_id: id })
      setSession((prev) => prev ? { ...prev, ...data[0] } : prev)
      setEditing(false)
    }
  })

  const handleDelete = async () => {
    if (!window.confirm('Delete this session?')) return
    posthog.capture('session_deleted', { session_id: id })
    await supabase.from('sessions').delete().eq('id', id)
    navigate('/sessions')
  }

  const handleFork = () => {
    if (!session) return
    posthog.capture('session_forked', { source_session_id: session.id })
    navigate('/sessions/new', {
      state: {
        forkedFrom: session.id,
        prefill: {
          title: session.title,
          bpm: session.bpm?.toString() ?? '',
          key_scale: session.key_scale ?? '',
          ableton_project: session.ableton_project ?? '',
          notes: session.notes ?? '',
          mood_tags: session.mood_tags,
          devices: session.session_devices.map((sd) => ({
            deviceId: sd.device_id,
            syncRole: sd.sync_role,
            syncMode: sd.sync_mode ?? '',
            patchNotes: sd.patch_notes ?? '',
          })),
        },
      },
    })
  }

  if (!session) return null

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-6">
      {session.forked_from && parentTitle && (
        <Link
          to={`/sessions/${session.forked_from}`}
          className="inline-flex items-center gap-1 text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 self-start hover:text-zinc-100"
        >
          Continued from: <span className="text-zinc-200 ml-1">{parentTitle}</span>
        </Link>
      )}

      {editing ? (
        <form onSubmit={onSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="title" className="text-xs text-zinc-400">Title</label>
            <input
              id="title"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('title', { required: true })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="bpm" className="text-xs text-zinc-400">BPM</label>
            <input
              id="bpm"
              type="number"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('bpm')}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="key_scale" className="text-xs text-zinc-400">Key / Scale</label>
            <input
              id="key_scale"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              {...register('key_scale')}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ableton_project" className="text-xs text-zinc-400">Ableton project</label>
            <input
              id="ableton_project"
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
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded">
                  {tag}
                  <button type="button" aria-label={`remove ${tag}`} onClick={() => removeTag(tag)} className="text-zinc-500 hover:text-zinc-300">×</button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {MOOD_SUGGESTIONS.filter((s) => !tags.includes(s)).map((s) => (
                <button key={s} type="button" onClick={() => addTag(s)} className="text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded">{s}</button>
              ))}
            </div>
            <input
              placeholder="Add a custom tag"
              className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); setTagInput('') } }}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-zinc-400 hover:text-zinc-100 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <h1 className="text-zinc-100 text-lg font-medium">{session.title}</h1>
            <button
              onClick={startEdit}
              className="text-zinc-400 hover:text-zinc-100 text-sm"
            >
              Edit
            </button>
          </div>

          {session.bpm !== null && (
            <span className="font-mono text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded self-start">
              {session.bpm} BPM
            </span>
          )}
          {session.key_scale && (
            <p className="text-sm text-zinc-400">{session.key_scale}</p>
          )}
          {session.mood_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {session.mood_tags.map((tag) => (
                <span key={tag} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {session.notes && (
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{session.notes}</p>
          )}
          {session.ableton_project && (
            <p className="text-xs text-zinc-400">{session.ableton_project}</p>
          )}
          {session.session_devices.length > 0 && (
            <div className="flex flex-col gap-3">
              {session.session_devices.map((sd) => (
                <div key={sd.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-100 text-sm font-medium">{sd.devices.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${DEVICE_TYPE_BADGE[sd.devices.type]}`}>
                      {DEVICE_TYPE_LABELS[sd.devices.type]}
                    </span>
                  </div>
                  {sd.sync_mode && (
                    <p className="font-mono text-xs text-zinc-400">{sd.sync_mode}</p>
                  )}
                  {sd.patch_notes && (
                    <p className="text-xs text-zinc-400 whitespace-pre-wrap">{sd.patch_notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-4 border-t border-zinc-800">
        <button
          onClick={handleFork}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium self-start"
        >
          Continue from this session
        </button>
        <button
          onClick={handleDelete}
          className="text-red-400 hover:text-red-300 text-sm self-start"
        >
          Delete session
        </button>
      </div>
    </div>
  )
}
