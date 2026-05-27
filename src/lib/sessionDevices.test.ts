import { describe, it, expect } from 'vitest'
import { updateAudioOutForReorder } from './sessionDevices'

type Conn = { fromName: string; toName: string; kind: string; label: string }

const audioOut = (fromName: string): Conn => ({ fromName, toName: 'OUT', kind: 'audio', label: '' })
const midiConn = (from: string, to: string): Conn => ({ fromName: from, toName: to, kind: 'midi', label: 'clock' })

describe('updateAudioOutForReorder', () => {
  it('moves the audio-out connection from old last device to new last device', () => {
    const connections = [audioOut('TB-303')]
    const result = updateAudioOutForReorder(connections, 'TB-303', 'PO-33')
    expect(result).toContainEqual(audioOut('PO-33'))
    expect(result).not.toContainEqual(audioOut('TB-303'))
  })

  it('returns connections unchanged when old last equals new last', () => {
    const connections = [audioOut('TB-303')]
    const result = updateAudioOutForReorder(connections, 'TB-303', 'TB-303')
    expect(result).toBe(connections) // same reference — no allocation
  })

  it('returns connections unchanged when old last device has no audio-out to OUT', () => {
    const connections = [midiConn('OP-1', 'PO-33')]
    const result = updateAudioOutForReorder(connections, 'TB-303', 'PO-33')
    expect(result).toBe(connections)
  })

  it('preserves all other connections when moving the audio-out', () => {
    const midi = midiConn('OP-1', 'PO-33')
    const connections = [midi, audioOut('TB-303')]
    const result = updateAudioOutForReorder(connections, 'TB-303', 'OP-1')
    expect(result).toContainEqual(midi)
    expect(result).toContainEqual(audioOut('OP-1'))
    expect(result).toHaveLength(2)
  })

  it('does not duplicate when new last device already has an audio-out and old last also has one', () => {
    const connections = [audioOut('PO-33'), audioOut('TB-303')]
    const result = updateAudioOutForReorder(connections, 'TB-303', 'PO-33')
    const outFromPO = result.filter((c) => c.fromName === 'PO-33' && c.toName === 'OUT' && c.kind === 'audio')
    expect(outFromPO).toHaveLength(1)
  })
})
