import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SessionsPage from './Sessions'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.useFakeTimers({ toFake: ['Date'] })
vi.setSystemTime(new Date('2026-05-24T12:00:00Z'))

const mockFrom = vi.mocked(supabase.from)

function makeSessionsFetch(sessions: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: sessions, error: null }),
    }),
  }
}

function makeActiveSessionFetch(session: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: session ? { ...(session as object) } : null,
          error: null,
        }),
      }),
    }),
  }
}

function makeConnectionsFetch(connections: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: connections, error: null }),
      }),
    }),
  }
}

function renderSessions() {
  render(
    <MemoryRouter>
      <SessionsPage />
    </MemoryRouter>,
  )
}

const PO_DEVICE = { id: 'dev-1', name: 'PO-33', type: 'pocket_operator' }

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    title: 'Late night jam',
    bpm: null,
    key_scale: null,
    mood_tags: [],
    notes: null,
    forked_from: null,
    created_at: '2026-05-21T12:00:00Z',
    updated_at: '2026-05-21T12:00:00Z',
    session_devices: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Sessions list', () => {
  it('renders Sessions heading and New entry link', async () => {
    mockFrom.mockReturnValueOnce(makeSessionsFetch() as never)
    renderSessions()
    expect(await screen.findByRole('heading', { name: /sessions/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /new entry/i })).toHaveAttribute('href', '/sessions/new')
  })

  it('clicking a session card links to the session detail', async () => {
    const session = makeSession()
    mockFrom
      .mockReturnValueOnce(makeSessionsFetch([session]) as never)
      .mockReturnValueOnce(makeActiveSessionFetch(session) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderSessions()
    const card = await screen.findByRole('link', { name: /late night jam/i })
    expect(card).toHaveAttribute('href', '/sessions/sess-1')
  })

  it('shows no-results message when search matches nothing', async () => {
    const session = makeSession()
    mockFrom
      .mockReturnValueOnce(makeSessionsFetch([session]) as never)
      .mockReturnValueOnce(makeActiveSessionFetch(session) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderSessions()
    await screen.findByText('Late night jam')
    await userEvent.type(screen.getByPlaceholderText(/search the ledger/i), 'zzznomatch')
    expect(screen.getByText(/no sessions match your search/i)).toBeInTheDocument()
  })

  it('search filters sessions by title and notes', async () => {
    const sessions = [
      makeSession({ id: 'sess-1', title: 'Late night jam', notes: null }),
      makeSession({ id: 'sess-2', title: 'Morning ambient', notes: 'layered pads' }),
    ]
    mockFrom
      .mockReturnValueOnce(makeSessionsFetch(sessions) as never)
      .mockReturnValueOnce(makeActiveSessionFetch(sessions[0]) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderSessions()
    await screen.findByText('Late night jam')

    await userEvent.type(screen.getByPlaceholderText(/search the ledger/i), 'ambient')
    expect(screen.getByText('Morning ambient')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /late night jam/i })).not.toBeInTheDocument()

    await userEvent.clear(screen.getByPlaceholderText(/search the ledger/i))
    await userEvent.type(screen.getByPlaceholderText(/search the ledger/i), 'layered')
    expect(screen.getByText('Morning ambient')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /late night jam/i })).not.toBeInTheDocument()
  })

  it('shows device chips with name for each linked device', async () => {
    const sessionWithDevice = makeSession({
      session_devices: [
        { id: 'sd-1', device_id: 'dev-1', sync_role: 'standalone', sort_order: 0, devices: PO_DEVICE },
      ],
    })
    mockFrom
      .mockReturnValueOnce(makeSessionsFetch([sessionWithDevice]) as never)
      .mockReturnValueOnce(makeActiveSessionFetch(sessionWithDevice) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderSessions()
    expect((await screen.findAllByText('PO-33')).length).toBeGreaterThan(0)
  })

  it('shows all mood tags on card', async () => {
    const session = makeSession({ mood_tags: ['dark', 'hypnotic', 'ambient', 'lo-fi', 'noisy'] })
    mockFrom
      .mockReturnValueOnce(makeSessionsFetch([session]) as never)
      .mockReturnValueOnce(makeActiveSessionFetch(session) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderSessions()
    expect(await screen.findByText('dark')).toBeInTheDocument()
    expect(screen.getByText('hypnotic')).toBeInTheDocument()
    expect(screen.getByText('ambient')).toBeInTheDocument()
    expect(screen.getAllByText('lo-fi').length).toBeGreaterThan(0)
    expect(screen.getAllByText('noisy').length).toBeGreaterThan(0)
  })

  it('shows BPM and key/scale on card when set', async () => {
    const session = makeSession({ bpm: 120, key_scale: 'A minor' })
    mockFrom
      .mockReturnValueOnce(makeSessionsFetch([session]) as never)
      .mockReturnValueOnce(makeActiveSessionFetch(session) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderSessions()
    expect((await screen.findAllByText('120')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/A minor/).length).toBeGreaterThan(0)
  })

  it('renders a session card with title and relative date', async () => {
    const session = makeSession()
    mockFrom
      .mockReturnValueOnce(makeSessionsFetch([session]) as never)
      .mockReturnValueOnce(makeActiveSessionFetch(session) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderSessions()
    expect(await screen.findByText('Late night jam')).toBeInTheDocument()
    expect(screen.getByText('3d ago')).toBeInTheDocument()
  })

  it('shows empty state when there are no sessions', async () => {
    mockFrom.mockReturnValueOnce(makeSessionsFetch() as never)
    renderSessions()
    expect(await screen.findByText(/no sessions yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /log your first jam/i })).toHaveAttribute('href', '/sessions/new')
  })
})
