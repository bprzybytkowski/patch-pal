import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEVICE_TYPE_BADGE, DEVICE_ICONS, type DeviceType } from './Devices'

interface SessionDeviceRow {
  id: string
  device_id: string
  sync_role: string
  sort_order: number
  devices: {
    id: string
    name: string
    type: DeviceType
  }
}

interface Session {
  id: string
  title: string
  bpm: number | null
  key_scale: string | null
  mood_tags: string[]
  notes: string | null
  created_at: string
  session_devices: SessionDeviceRow[]
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return 'just now'
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('sessions')
      .select('*, session_devices(*, devices(*))')
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setSessions(data as Session[]) })
  }, [])

  const filtered = query
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.notes?.toLowerCase().includes(query.toLowerCase()),
      )
    : sessions

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <span className="text-zinc-100 font-medium">PatchPal</span>
        <div className="flex items-center gap-4">
          <Link to="/devices" className="text-zinc-400 hover:text-zinc-100 text-sm">My gear</Link>
          <Link
            to="/sessions/new"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            New session
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-4">
        <input
          placeholder="Search sessions…"
          className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {sessions.length === 0 && !query && (
          <p className="text-zinc-400 text-sm">
            No sessions yet.{' '}
            <Link to="/sessions/new" className="text-indigo-400 hover:text-indigo-300">
              Log your first jam →
            </Link>
          </p>
        )}

        {sessions.length > 0 && filtered.length === 0 && (
          <p className="text-zinc-400 text-sm">No sessions match your search.</p>
        )}

        {filtered.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  )
}

function SessionCard({ session }: { session: Session }) {
  const visibleTags = session.mood_tags.slice(0, 3)
  const overflow = session.mood_tags.length - 3

  return (
    <Link
      to={`/sessions/${session.id}`}
      className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-zinc-100 text-sm font-medium">{session.title}</span>
        <span className="text-zinc-500 text-xs shrink-0">{formatRelative(session.created_at)}</span>
      </div>

      {(session.bpm !== null || session.key_scale) && (
        <div className="flex items-center gap-2 mt-2">
          {session.bpm !== null && (
            <span className="font-mono text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
              {session.bpm} BPM
            </span>
          )}
          {session.key_scale && (
            <span className="text-xs text-zinc-400">{session.key_scale}</span>
          )}
        </div>
      )}

      {session.mood_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {visibleTags.map((tag) => (
            <span key={tag} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
          {overflow > 0 && (
            <span className="text-xs text-zinc-500">+{overflow} more</span>
          )}
        </div>
      )}

      {session.session_devices.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {session.session_devices.map((sd) => {
            const Icon = DEVICE_ICONS[sd.devices.type]
            return (
              <span
                key={sd.id}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${DEVICE_TYPE_BADGE[sd.devices.type]}`}
              >
                <Icon size={12} />
                {sd.devices.name}
              </span>
            )
          })}
        </div>
      )}
    </Link>
  )
}
