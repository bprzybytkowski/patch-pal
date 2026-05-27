/**
 * Given a list of connections and two device names, moves the audio-out
 * connection from `oldLastName → OUT` to `newLastName → OUT` when the last
 * device in a session changes due to drag-reordering.
 *
 * Returns the same array reference when nothing changes (no-op cases).
 */
export function updateAudioOutForReorder<
  T extends { fromName: string; toName: string; kind: string; label: string },
>(connections: T[], oldLastName: string, newLastName: string): T[] {
  if (oldLastName === newLastName) return connections

  const hasOldOut = connections.some(
    (c) => c.fromName === oldLastName && c.toName === 'OUT' && c.kind === 'audio',
  )
  if (!hasOldOut) return connections

  const withoutOldOut = connections.filter(
    (c) => !(c.fromName === oldLastName && c.toName === 'OUT' && c.kind === 'audio'),
  )
  const withoutNewOut = withoutOldOut.filter(
    (c) => !(c.fromName === newLastName && c.toName === 'OUT' && c.kind === 'audio'),
  )
  return [
    ...withoutNewOut,
    { fromName: newLastName, toName: 'OUT', kind: 'audio', label: '' } as T,
  ]
}
