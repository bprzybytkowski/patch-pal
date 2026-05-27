import { supabase } from './supabase'

export interface BackupFile {
  version: 1
  exported_at: string
  devices: BackupDevice[]
  sessions: BackupSession[]
}

interface BackupDevice {
  id: string
  name: string
  type: string
  manufacturer: string | null
  notes: string | null
}

interface BackupSessionDevice {
  device_id: string
  sync_role: string
  sync_mode: string | null
  patch_notes: string | null
  sort_order: number
}

interface BackupSessionConnection {
  from_name: string
  to_name: string
  kind: string
  label: string
  sort_order: number
}

interface BackupSession {
  id: string
  title: string
  bpm: number | null
  key_scale: string | null
  ableton_project: string | null
  notes: string | null
  mood_tags: string[]
  forked_from: string | null
  version: number
  created_at: string
  session_devices: BackupSessionDevice[]
  session_connections: BackupSessionConnection[]
}

export async function exportBackup(): Promise<void> {
  const [{ data: devices }, { data: sessions }] = await Promise.all([
    supabase.from('devices').select('id, name, type, manufacturer, notes').order('created_at'),
    supabase
      .from('sessions')
      .select('*, session_devices(device_id, sync_role, sync_mode, patch_notes, sort_order), session_connections(from_name, to_name, kind, label, sort_order)')
      .order('created_at'),
  ])

  const backup: BackupFile = {
    version: 1,
    exported_at: new Date().toISOString(),
    devices: (devices ?? []) as BackupDevice[],
    sessions: (sessions ?? []) as BackupSession[],
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `patchpal-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface ImportResult {
  devicesAdded: number
  sessionsAdded: number
}

const MAX_BACKUP_SIZE = 5 * 1024 * 1024 // 5 MB

export async function importBackup(file: File, userId: string): Promise<ImportResult> {
  if (file.size > MAX_BACKUP_SIZE) {
    throw new Error('Backup file is too large (max 5 MB).')
  }

  const text = await file.text()
  const backup = JSON.parse(text) as BackupFile

  if (!Array.isArray(backup.devices) || !Array.isArray(backup.sessions)) {
    throw new Error('Invalid backup file format.')
  }

  // --- Devices ---
  const { data: existingDevices } = await supabase
    .from('devices')
    .select('id, name')
    .eq('user_id', userId)

  const existingByName = new Map((existingDevices ?? []).map((d) => [d.name as string, d.id as string]))
  const deviceIdMap = new Map<string, string>()
  let devicesAdded = 0

  for (const device of backup.devices) {
    if (existingByName.has(device.name)) {
      deviceIdMap.set(device.id, existingByName.get(device.name)!)
    } else {
      const { data } = await supabase
        .from('devices')
        .insert({ user_id: userId, name: device.name, type: device.type, manufacturer: device.manufacturer, notes: device.notes })
        .select('id')
      if (data?.[0]) {
        deviceIdMap.set(device.id, data[0].id as string)
        devicesAdded++
      }
    }
  }

  // --- Sessions: root first, then forks ---
  const sessionIdMap = new Map<string, string>()
  let sessionsAdded = 0

  const roots = backup.sessions.filter((s) => !s.forked_from)
  const forks = backup.sessions.filter((s) => s.forked_from)

  const insertSession = async (session: BackupSession) => {
    const { data } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        title: session.title,
        bpm: session.bpm,
        key_scale: session.key_scale,
        ableton_project: session.ableton_project,
        notes: session.notes,
        mood_tags: session.mood_tags ?? [],
        forked_from: session.forked_from ? (sessionIdMap.get(session.forked_from) ?? null) : null,
        version: session.version ?? 1,
        created_at: session.created_at,
      })
      .select('id')
    if (!data?.[0]) return
    const newId = data[0].id as string
    sessionIdMap.set(session.id, newId)
    sessionsAdded++

    if (session.session_devices?.length > 0) {
      await supabase.from('session_devices').insert(
        session.session_devices.map((sd, i) => ({
          session_id: newId,
          device_id: deviceIdMap.get(sd.device_id) ?? sd.device_id,
          sync_role: sd.sync_role,
          sync_mode: sd.sync_mode,
          patch_notes: sd.patch_notes,
          sort_order: sd.sort_order ?? i,
        })),
      )
    }

    if (session.session_connections?.length > 0) {
      await supabase.from('session_connections').insert(
        session.session_connections.map((c, i) => ({
          session_id: newId,
          from_name: c.from_name,
          to_name: c.to_name,
          kind: c.kind,
          label: c.label,
          sort_order: c.sort_order ?? i,
        })),
      )
    }
  }

  for (const s of roots) await insertSession(s)
  for (const s of forks) await insertSession(s)

  return { devicesAdded, sessionsAdded }
}
