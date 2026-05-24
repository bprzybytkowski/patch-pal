import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NewSessionPage from './NewSession'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(), auth: { getUser: vi.fn() } } }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockNavigate = vi.fn()
const mockFrom = vi.mocked(supabase.from)

function makeDevicesFetch(devices: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: devices, error: null }),
    }),
  }
}

function makeSaveSession() {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'sess-1' }], error: null }),
    }),
  }
}

function makeSaveSessionDevices() {
  return {
    insert: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
}

function renderNewSession(locationState?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/sessions/new', state: locationState }]}>
      <NewSessionPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFrom.mockReturnValue(makeDevicesFetch() as never)
})

const PO: unknown = { id: 'dev-1', user_id: 'u1', name: 'PO-33', type: 'pocket_operator', manufacturer: null, notes: null, created_at: '' }

describe('New session form', () => {
  it('renders metadata fields and Save session button', async () => {
    renderNewSession()
    expect(await screen.findByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/bpm/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/key \/ scale/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ableton project/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save session/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cancel/i })).toBeInTheDocument()
  })

  it('submitting without a title shows a required error', async () => {
    renderNewSession()
    await screen.findByLabelText(/title/i)
    await userEvent.click(screen.getByRole('button', { name: /save session/i }))
    expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
  })

  it('BPM outside 1–399 shows a validation error', async () => {
    renderNewSession()
    await screen.findByLabelText(/title/i)
    await userEvent.type(screen.getByLabelText(/title/i), 'Jam')
    await userEvent.type(screen.getByLabelText(/bpm/i), '400')
    await userEvent.click(screen.getByRole('button', { name: /save session/i }))
    expect(await screen.findByText(/bpm must be between 1 and 399/i)).toBeInTheDocument()
  })

  it('typing and pressing Enter adds a mood tag pill; clicking × removes it', async () => {
    renderNewSession()
    await screen.findByLabelText(/title/i)
    const tagInput = screen.getByPlaceholderText(/add a mood tag/i)
    await userEvent.type(tagInput, 'dark{Enter}')
    expect(screen.getByText('dark')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /remove dark/i }))
    expect(screen.queryByText('dark')).not.toBeInTheDocument()
  })

  it('tags are stored lowercase and trimmed', async () => {
    renderNewSession()
    await screen.findByLabelText(/title/i)
    await userEvent.type(screen.getByPlaceholderText(/add a mood tag/i), '  DARK  {Enter}')
    expect(screen.getByText('dark')).toBeInTheDocument()
  })

  it('enforces maximum of 10 mood tags', async () => {
    renderNewSession()
    await screen.findByLabelText(/title/i)
    const tagInput = screen.getByPlaceholderText(/add a mood tag/i)
    for (let i = 1; i <= 10; i++) {
      await userEvent.type(tagInput, `tag${i}{Enter}`)
    }
    await userEvent.type(tagInput, 'tag11{Enter}')
    expect(screen.queryByText('tag11')).not.toBeInTheDocument()
  })

  it('Add device button opens inline picker with available devices', async () => {
    mockFrom.mockReturnValue(makeDevicesFetch([PO]) as never)
    renderNewSession()
    await screen.findByLabelText(/title/i)
    await userEvent.click(screen.getByRole('button', { name: /add device/i }))
    expect(await screen.findByRole('option', { name: /PO-33/i })).toBeInTheDocument()
  })

  it('selecting a device from the picker adds a card and closes the picker', async () => {
    mockFrom.mockReturnValue(makeDevicesFetch([PO]) as never)
    renderNewSession()
    await screen.findByLabelText(/title/i)
    await userEvent.click(screen.getByRole('button', { name: /add device/i }))
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'dev-1')
    expect(await screen.findByText('PO-33')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /PO-33/i })).not.toBeInTheDocument()
  })

  it('shows a link to /devices when device roster is empty', async () => {
    renderNewSession()
    await screen.findByLabelText(/title/i)
    await userEvent.click(screen.getByRole('button', { name: /add device/i }))
    expect(await screen.findByText(/no gear saved yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add your devices first/i })).toHaveAttribute('href', '/devices')
  })

  it('device card defaults sync role to Standalone and Remove button removes it', async () => {
    mockFrom.mockReturnValue(makeDevicesFetch([PO]) as never)
    renderNewSession()
    await screen.findByLabelText(/title/i)
    await userEvent.click(screen.getByRole('button', { name: /add device/i }))
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'dev-1')
    await screen.findByText('PO-33')
    const standaloneBtn = screen.getByRole('button', { name: /standalone/i })
    expect(standaloneBtn).toHaveClass('bg-indigo-600')
    await userEvent.click(screen.getByRole('button', { name: /remove device/i }))
    expect(screen.queryByText('PO-33')).not.toBeInTheDocument()
  })

  it('successful save inserts session and redirects to /sessions', async () => {
    mockFrom
      .mockReturnValueOnce(makeDevicesFetch() as never)
      .mockReturnValueOnce(makeSaveSession() as never)
    renderNewSession()
    await userEvent.type(await screen.findByLabelText(/title/i), 'Late night jam')
    await userEvent.click(screen.getByRole('button', { name: /save session/i }))
    await screen.findByRole('button', { name: /save session/i })
    expect(mockNavigate).toHaveBeenCalledWith('/sessions')
  })

  it('saves added devices to session_devices on submit', async () => {
    const saveDevicesMock = { insert: vi.fn().mockResolvedValue({ data: [], error: null }) }
    mockFrom
      .mockReturnValueOnce(makeDevicesFetch([PO]) as never)
      .mockReturnValueOnce(makeSaveSession() as never)
      .mockReturnValueOnce(saveDevicesMock as never)
    renderNewSession()
    await userEvent.type(await screen.findByLabelText(/title/i), 'Test jam')
    await userEvent.click(screen.getByRole('button', { name: /add device/i }))
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'dev-1')
    await userEvent.click(screen.getByRole('button', { name: /save session/i }))
    await screen.findByRole('button', { name: /save session/i })
    expect(saveDevicesMock.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        session_id: 'sess-1',
        device_id: 'dev-1',
        sync_role: 'standalone',
        sort_order: 0,
      }),
    ])
  })

  it('pre-fills fields from fork state', async () => {
    const prefill = { title: 'Forked jam', bpm: '120', key_scale: 'D minor', ableton_project: '', notes: 'original notes' }
    renderNewSession({ forkedFrom: 'sess-0', prefill })
    expect(await screen.findByDisplayValue('Forked jam')).toBeInTheDocument()
    expect(screen.getByDisplayValue('120')).toBeInTheDocument()
    expect(screen.getByDisplayValue('D minor')).toBeInTheDocument()
  })

  it('pre-fills device cards from fork state', async () => {
    mockFrom.mockReturnValue(makeDevicesFetch([PO]) as never)
    const prefill = {
      title: 'Forked jam',
      bpm: '',
      key_scale: '',
      ableton_project: '',
      notes: '',
      devices: [{ deviceId: 'dev-1', syncRole: 'master' as const, syncMode: 'SY2', patchNotes: 'bass patch' }],
    }
    renderNewSession({ forkedFrom: 'sess-0', prefill })
    expect(await screen.findByText('PO-33')).toBeInTheDocument()
    expect(screen.getByDisplayValue('SY2')).toBeInTheDocument()
    expect(screen.getByDisplayValue('bass patch')).toBeInTheDocument()
    const masterBtn = screen.getByRole('button', { name: /master/i })
    expect(masterBtn).toHaveClass('bg-indigo-600')
  })
})
