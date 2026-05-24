import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SessionDetailPage from './SessionDetail'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

const mockFrom = vi.mocked(supabase.from)
const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function makeSessionFetch(session: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: session, error: null }),
      }),
    }),
  }
}

function makeUpdateMock(updated: unknown) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [updated], error: null }),
      }),
    }),
  }
}

function makeDeleteMock() {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }
}

const PO = { id: 'dev-1', name: 'PO-33', type: 'pocket_operator' }

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    title: 'Late night jam',
    bpm: null,
    key_scale: null,
    mood_tags: [],
    notes: null,
    ableton_project: null,
    forked_from: null,
    created_at: '2026-05-21T12:00:00Z',
    updated_at: '2026-05-21T12:00:00Z',
    session_devices: [],
    ...overrides,
  }
}

function renderDetail(id = 'sess-1') {
  render(
    <MemoryRouter initialEntries={[`/sessions/${id}`]}>
      <Routes>
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
        <Route path="/sessions" element={<div>sessions list</div>} />
        <Route path="/sessions/new" element={<div>new session</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Session detail', () => {
  it('fetches and displays the session title', async () => {
    mockFrom.mockReturnValueOnce(makeSessionFetch(makeSession()) as never)
    renderDetail()
    expect(await screen.findByText('Late night jam')).toBeInTheDocument()
  })

  it('shows "Continued from" chip with parent title linking to parent session', async () => {
    const parent = makeSession({ id: 'sess-0', title: 'Original session' })
    const child = makeSession({ forked_from: 'sess-0' })
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(child) as never)
      .mockReturnValueOnce(makeSessionFetch(parent) as never)
    renderDetail()
    await screen.findByText('Late night jam')
    const chip = await screen.findByRole('link', { name: /continued from: original session/i })
    expect(chip).toHaveAttribute('href', '/sessions/sess-0')
  })

  it('Delete with confirm removes the session and redirects to /sessions', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(makeSession()) as never)
      .mockReturnValueOnce(makeDeleteMock() as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /delete session/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/sessions')
  })

  it('Delete with confirm=false does not delete', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockFrom.mockReturnValueOnce(makeSessionFetch(makeSession()) as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /delete session/i }))
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('"Continue from this session" navigates to /sessions/new with fork state', async () => {
    const session = makeSession({
      bpm: 120,
      key_scale: 'A minor',
      mood_tags: ['dark'],
      session_devices: [
        { id: 'sd-1', device_id: 'dev-1', sync_role: 'master', sync_mode: 'SY2', patch_notes: 'bass patch', sort_order: 0, devices: PO },
      ],
    })
    mockFrom.mockReturnValueOnce(makeSessionFetch(session) as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /continue from this session/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/sessions/new', {
      state: {
        forkedFrom: 'sess-1',
        prefill: expect.objectContaining({
          title: 'Late night jam',
          bpm: '120',
          key_scale: 'A minor',
          mood_tags: ['dark'],
          devices: [expect.objectContaining({ deviceId: 'dev-1', syncRole: 'master', syncMode: 'SY2', patchNotes: 'bass patch' })],
        }),
      },
    })
  })

  it('Cancel discards changes and returns to view mode without saving', async () => {
    mockFrom.mockReturnValueOnce(makeSessionFetch(makeSession()) as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
    await userEvent.clear(screen.getByRole('textbox', { name: /title/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Should not be saved')
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText('Late night jam')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /title/i })).not.toBeInTheDocument()
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('Save changes writes updated title to Supabase and returns to view mode', async () => {
    const updated = makeSession({ title: 'Renamed jam' })
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(makeSession()) as never)
      .mockReturnValueOnce(makeUpdateMock(updated) as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
    await userEvent.clear(screen.getByRole('textbox', { name: /title/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Renamed jam')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText('Renamed jam')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
  })

  it('Edit button toggles title and notes to editable inputs', async () => {
    mockFrom.mockReturnValueOnce(makeSessionFetch(makeSession({ notes: 'original notes' })) as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
    expect(screen.getByRole('textbox', { name: /title/i })).toHaveValue('Late night jam')
    expect(screen.getByRole('textbox', { name: /notes/i })).toHaveValue('original notes')
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('displays BPM, notes and linked device in view mode', async () => {
    const session = makeSession({
      bpm: 120,
      notes: 'great session',
      session_devices: [
        { id: 'sd-1', device_id: 'dev-1', sync_role: 'standalone', sync_mode: 'SY2', patch_notes: 'bass patch', sort_order: 0, devices: PO },
      ],
    })
    mockFrom.mockReturnValueOnce(makeSessionFetch(session) as never)
    renderDetail()
    expect(await screen.findByText('120 BPM')).toBeInTheDocument()
    expect(screen.getByText('great session')).toBeInTheDocument()
    expect(screen.getByText('PO-33')).toBeInTheDocument()
    expect(screen.getByText('SY2')).toBeInTheDocument()
    expect(screen.getByText('bass patch')).toBeInTheDocument()
  })
})
