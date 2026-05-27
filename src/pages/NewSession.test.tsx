import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import * as photos from '../lib/photos'
import NewSessionPage from './NewSession'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(), auth: { getUser: vi.fn() } } }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../store/auth', () => ({ useAuthStore: (sel: (s: { user: { id: string } }) => unknown) => sel({ user: { id: 'user-1' } }) }))
vi.mock('../lib/photos', () => ({
  uploadDevicePhoto: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
  deleteDevicePhoto: vi.fn().mockResolvedValue(undefined),
}))

const mockNavigate = vi.fn()
const mockFrom = vi.mocked(supabase.from)
const mockUploadDevicePhoto = vi.mocked(photos.uploadDevicePhoto)

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

function makeSaveConnections() {
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
    await userEvent.click(screen.getByRole('button', { name: /more options/i }))
    expect(screen.getByLabelText(/key \/ scale/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/daw project/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save session/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /cancel/i })).toBeInTheDocument()
  })

  it('submitting without a title shows a required error', async () => {
    renderNewSession()
    const titleInput = await screen.findByLabelText(/title/i)
    await userEvent.clear(titleInput)
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

  it('renders predefined mood chip buttons', async () => {
    renderNewSession()
    await screen.findByLabelText(/title/i)
    await userEvent.click(screen.getByRole('button', { name: /more options/i }))
    expect(screen.getByRole('button', { name: /^dark$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ambient$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^lo-fi$/i })).toBeInTheDocument()
  })

  it('clicking a mood chip selects it; clicking again deselects it', async () => {
    renderNewSession()
    await screen.findByLabelText(/title/i)
    await userEvent.click(screen.getByRole('button', { name: /more options/i }))
    const darkChip = screen.getByRole('button', { name: /^dark$/i })
    await userEvent.click(darkChip)
    expect(screen.getByRole('button', { name: /^dark$/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^dark$/i }))
    expect(screen.getByRole('button', { name: /^dark$/i })).toBeInTheDocument()
  })

  it('all 10 predefined mood chips are rendered', async () => {
    renderNewSession()
    await screen.findByLabelText(/title/i)
    await userEvent.click(screen.getByRole('button', { name: /more options/i }))
    const moodChips = ['dark', 'hypnotic', 'ambient', 'playful', 'broken', 'noisy', 'experimental', 'melancholic', 'energetic', 'lo-fi']
    for (const chip of moodChips) {
      expect(screen.getByRole('button', { name: new RegExp(`^${chip}$`, 'i') })).toBeInTheDocument()
    }
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
    expect((await screen.findAllByText('PO-33')).length).toBeGreaterThan(0)
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
    expect(await screen.findAllByText('PO-33')).not.toHaveLength(0)
    const standaloneBtn = screen.getByRole('button', { name: /standalone/i })
    expect(standaloneBtn).toHaveAttribute('aria-pressed', 'true')
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
    const saveConnectionsMock = makeSaveConnections()
    mockFrom
      .mockReturnValueOnce(makeDevicesFetch([PO]) as never)
      .mockReturnValueOnce(makeSaveSession() as never)
      .mockReturnValueOnce(saveDevicesMock as never)
      .mockReturnValueOnce(saveConnectionsMock as never)
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
    expect(saveConnectionsMock.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        session_id: 'sess-1',
        from_name: 'PO-33',
        to_name: 'OUT',
        kind: 'audio',
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

  it('device cards have a drag handle', async () => {
    mockFrom.mockReturnValue(makeDevicesFetch([PO]) as never)
    renderNewSession()
    await userEvent.click(screen.getByRole('button', { name: /add device/i }))
    await userEvent.selectOptions(await screen.findByRole('combobox'), 'dev-1')
    expect(await screen.findByRole('button', { name: /drag to reorder/i })).toBeInTheDocument()
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
    expect((await screen.findAllByText('PO-33')).length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('SY2')).toBeInTheDocument()
    expect(screen.getByDisplayValue('bass patch')).toBeInTheDocument()
    const masterBtn = screen.getByRole('button', { name: /master/i })
    expect(masterBtn).toHaveAttribute('aria-pressed', 'true')
  })

  describe('⊕ photo button', () => {
    async function addDevice() {
      // 1 device (≤5) is auto-added to the session on load — no need to open the picker
      mockFrom.mockReturnValue(makeDevicesFetch([PO]) as never)
      renderNewSession()
      await screen.findByRole('button', { name: /⊕ photo/i })
    }

    it('clicking photo button shows sheet with Camera and Gallery options', async () => {
      await addDevice()
      await userEvent.click(screen.getByRole('button', { name: /⊕ photo/i }))
      expect(await screen.findByRole('button', { name: /camera/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /gallery/i })).toBeInTheDocument()
    })

    it('picking Gallery dismisses sheet and uploads via gallery input', async () => {
      await addDevice()
      await userEvent.click(screen.getByRole('button', { name: /⊕ photo/i }))
      await userEvent.click(await screen.findByRole('button', { name: /gallery/i }))
      expect(screen.queryByRole('button', { name: /gallery/i })).not.toBeInTheDocument()
      const file = new File(['img'], 'patch.jpg', { type: 'image/jpeg' })
      const galleryInput = document.querySelector<HTMLInputElement>('input[type="file"]:not([capture])')!
      await userEvent.upload(galleryInput, file)
      expect(mockUploadDevicePhoto).toHaveBeenCalledWith(file, 'user-1')
    })

    it('picking Camera dismisses sheet and uploads via camera input', async () => {
      await addDevice()
      await userEvent.click(screen.getByRole('button', { name: /⊕ photo/i }))
      await userEvent.click(await screen.findByRole('button', { name: /camera/i }))
      expect(screen.queryByRole('button', { name: /camera/i })).not.toBeInTheDocument()
      const file = new File(['img'], 'shot.jpg', { type: 'image/jpeg' })
      const cameraInput = document.querySelector<HTMLInputElement>('input[type="file"][capture]')!
      await userEvent.upload(cameraInput, file)
      expect(mockUploadDevicePhoto).toHaveBeenCalledWith(file, 'user-1')
    })

    it('cancel dismisses sheet without upload', async () => {
      await addDevice()
      await userEvent.click(screen.getByRole('button', { name: /⊕ photo/i }))
      const galleryBtn = await screen.findByRole('button', { name: /gallery/i })
      const sheet = galleryBtn.closest('[style*="position: fixed"]')!
      const cancelBtn = Array.from(sheet.querySelectorAll('button')).find(b => /cancel/i.test(b.textContent ?? ''))!
      await userEvent.click(cancelBtn)
      expect(screen.queryByRole('button', { name: /gallery/i })).not.toBeInTheDocument()
      expect(mockUploadDevicePhoto).not.toHaveBeenCalled()
    })
  })
})
