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
  it('renders PatchPal header with New session and My gear links', async () => {
    mockFrom.mockReturnValueOnce(makeSessionsFetch() as never)
    renderSessions()
    expect(await screen.findByText('PatchPal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /new session/i })).toHaveAttribute('href', '/sessions/new')
    expect(screen.getByRole('link', { name: /my gear/i })).toHaveAttribute('href', '/devices')
  })

  it('clicking a session card links to the session detail', async () => {
    mockFrom.mockReturnValueOnce(makeSessionsFetch([makeSession()]) as never)
    renderSessions()
    const card = await screen.findByRole('link', { name: /late night jam/i })
    expect(card).toHaveAttribute('href', '/sessions/sess-1')
  })

  it('shows no-results message when search matches nothing', async () => {
    mockFrom.mockReturnValueOnce(makeSessionsFetch([makeSession()]) as never)
    renderSessions()
    await screen.findByText('Late night jam')
    await userEvent.type(screen.getByPlaceholderText(/search sessions/i), 'zzznomatch')
    expect(screen.getByText(/no sessions match your search/i)).toBeInTheDocument()
  })

  it('search filters sessions by title and notes', async () => {
    const sessions = [
      makeSession({ id: 'sess-1', title: 'Late night jam', notes: null }),
      makeSession({ id: 'sess-2', title: 'Morning ambient', notes: 'layered pads' }),
    ]
    mockFrom.mockReturnValueOnce(makeSessionsFetch(sessions) as never)
    renderSessions()
    await screen.findByText('Late night jam')

    await userEvent.type(screen.getByPlaceholderText(/search sessions/i), 'ambient')
    expect(screen.getByText('Morning ambient')).toBeInTheDocument()
    expect(screen.queryByText('Late night jam')).not.toBeInTheDocument()

    await userEvent.clear(screen.getByPlaceholderText(/search sessions/i))
    await userEvent.type(screen.getByPlaceholderText(/search sessions/i), 'layered')
    expect(screen.getByText('Morning ambient')).toBeInTheDocument()
    expect(screen.queryByText('Late night jam')).not.toBeInTheDocument()
  })

  it('shows device chips with name for each linked device', async () => {
    const sessionWithDevice = makeSession({
      session_devices: [
        { id: 'sd-1', device_id: 'dev-1', sync_role: 'standalone', sort_order: 0, devices: PO_DEVICE },
      ],
    })
    mockFrom.mockReturnValueOnce(makeSessionsFetch([sessionWithDevice]) as never)
    renderSessions()
    expect(await screen.findByText('PO-33')).toBeInTheDocument()
  })

  it('shows up to 3 mood tag pills and an overflow count', async () => {
    mockFrom.mockReturnValueOnce(
      makeSessionsFetch([makeSession({ mood_tags: ['dark', 'hypnotic', 'ambient', 'lo-fi', 'noisy'] })]) as never,
    )
    renderSessions()
    expect(await screen.findByText('dark')).toBeInTheDocument()
    expect(screen.getByText('hypnotic')).toBeInTheDocument()
    expect(screen.getByText('ambient')).toBeInTheDocument()
    expect(screen.queryByText('lo-fi')).not.toBeInTheDocument()
    expect(screen.getByText('+2 more')).toBeInTheDocument()
  })

  it('shows BPM badge and key/scale on card when set', async () => {
    mockFrom.mockReturnValueOnce(
      makeSessionsFetch([makeSession({ bpm: 120, key_scale: 'A minor' })]) as never,
    )
    renderSessions()
    expect(await screen.findByText('120 BPM')).toBeInTheDocument()
    expect(screen.getByText('A minor')).toBeInTheDocument()
  })

  it('renders a session card with title and relative date', async () => {
    mockFrom.mockReturnValueOnce(makeSessionsFetch([makeSession()]) as never)
    renderSessions()
    expect(await screen.findByText('Late night jam')).toBeInTheDocument()
    expect(screen.getByText('3 days ago')).toBeInTheDocument()
  })

  it('shows empty state when there are no sessions', async () => {
    mockFrom.mockReturnValueOnce(makeSessionsFetch() as never)
    renderSessions()
    expect(await screen.findByText(/no sessions yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /log your first jam/i })).toHaveAttribute('href', '/sessions/new')
  })
})
