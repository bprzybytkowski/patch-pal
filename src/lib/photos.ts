import { supabase } from './supabase'

export const MAX_PHOTO_SIZE = 8 * 1024 * 1024 // 8 MB
const BUCKET = 'patch-photos'

export async function uploadDevicePhoto(file: File, userId: string): Promise<string> {
  if (file.size > MAX_PHOTO_SIZE) throw new Error('Photo is too large (max 8 MB).')
  if (!file.type.startsWith('image/')) throw new Error('Only image files are supported.')

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  if (error) throw new Error('Upload failed. Please try again.')

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export async function deleteDevicePhoto(url: string): Promise<void> {
  const marker = `/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = decodeURIComponent(url.slice(idx + marker.length))
  await supabase.storage.from(BUCKET).remove([path])
}
