import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import * as photos from '../lib/photos'
import { useSortable } from '@dnd-kit/sortable'
import SessionDetailPage from './SessionDetail'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('../lib/photos', () => ({
  uploadDevicePhoto: vi.fn().mockResolvedValue('https://example.com/photo.jpg'),
  deleteDevicePhoto: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../store/auth', () => ({
  useAuthStore: (sel: (s: { user: { id: string } }) => unknown) => sel({ user: { id: 'user-1' } }),
}))
vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>()
  return {
    ...actual,
    useSortable: vi.fn().mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
    }),
  }
})

const mockUploadDevicePhoto = vi.mocked(photos.uploadDevicePhoto)

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

function makeConnectionsFetch(connections: unknown[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: connections, error: null }),
      }),
    }),
  }
}

function makeDefaultFromMock() {
  const eqReturn = Object.assign(
    Promise.resolve({ data: null, error: null }),
    {
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
  )
  return {
    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqReturn) }),
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null })) }),
    delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null })) }),
    insert: vi.fn().mockResolvedValue({ data: [], error: null }),
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
  mockFrom.mockReturnValue(makeDefaultFromMock() as never)
})

describe('Session detail', () => {
  it('fetches and displays the session title', async () => {
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(makeSession()) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderDetail()
    expect(await screen.findByText('Late night jam')).toBeInTheDocument()
  })

  it('Delete with confirm removes the session and redirects to /sessions', async () => {
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(makeSession()) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /burn this page/i }))
    await userEvent.click(await screen.findByRole('button', { name: /burn it/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/sessions')
  })

  it('Delete with cancel does not delete', async () => {
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(makeSession()) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /burn this page/i }))
    await userEvent.click(await screen.findByRole('button', { name: /cancel/i }))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('Cancel discards changes and returns to view mode without saving', async () => {
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(makeSession()) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
    await userEvent.clear(screen.getByRole('textbox', { name: /title/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Should not be saved')
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.getByText('Late night jam')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /title/i })).not.toBeInTheDocument()
  })

  it('Save changes writes updated title to Supabase and returns to view mode', async () => {
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(makeSession()) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
    await userEvent.clear(screen.getByRole('textbox', { name: /title/i }))
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Renamed jam')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText('Renamed jam')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument()
  })

  it('Edit button toggles title and notes to editable inputs', async () => {
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(makeSession({ notes: 'original notes' })) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
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
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(session) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderDetail()
    expect(await screen.findByText('120')).toBeInTheDocument()
    expect(screen.getByText('great session')).toBeInTheDocument()
    expect((await screen.findAllByText('PO-33')).length).toBeGreaterThan(0)
    expect(screen.getByText('SY2')).toBeInTheDocument()
    expect(screen.getByText('"bass patch"')).toBeInTheDocument()
  })

  it('session_devices are displayed sorted by sort_order', async () => {
    const TB303 = { id: 'dev-2', name: 'TB-303', type: 'analog_synth' }
    const session = makeSession({
      session_devices: [
        { id: 'sd-2', device_id: 'dev-2', sync_role: 'standalone', sync_mode: null, patch_notes: null, sort_order: 1, devices: TB303 },
        { id: 'sd-1', device_id: 'dev-1', sync_role: 'standalone', sync_mode: null, patch_notes: null, sort_order: 0, devices: PO },
      ],
    })
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(session) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderDetail()
    await screen.findAllByText('PO-33')
    const po = screen.getAllByText('PO-33')[0]
    const tb = screen.getAllByText('TB-303')[0]
    expect(po.compareDocumentPosition(tb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('edit device cards have a drag handle', async () => {
    const session = makeSession({
      session_devices: [
        { id: 'sd-1', device_id: 'dev-1', sync_role: 'standalone', sync_mode: null, patch_notes: null, sort_order: 0, devices: PO },
      ],
    })
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(session) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
    expect(await screen.findByRole('button', { name: /drag to reorder/i })).toBeInTheDocument()
  })

  function makeSessionWithDevice() {
    return makeSession({
      session_devices: [
        { id: 'sd-1', device_id: 'dev-1', sync_role: 'standalone', sync_mode: null, patch_notes: null, sort_order: 0, devices: PO },
      ],
    })
  }

  async function openEditWithDevice() {
    mockFrom
      .mockReturnValueOnce(makeSessionFetch(makeSessionWithDevice()) as never)
      .mockReturnValueOnce(makeConnectionsFetch() as never)
    renderDetail()
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
  }

  describe('⊕ photo button', () => {
    it('clicking photo button shows sheet with Camera and Gallery options', async () => {
      await openEditWithDevice()
      await userEvent.click(await screen.findByRole('button', { name: /⊕ photo/i }))
      expect(await screen.findByRole('button', { name: /camera/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /gallery/i })).toBeInTheDocument()
    })

    it('picking Gallery dismisses sheet and uploads via gallery input', async () => {
      await openEditWithDevice()
      await userEvent.click(await screen.findByRole('button', { name: /⊕ photo/i }))
      await userEvent.click(await screen.findByRole('button', { name: /gallery/i }))
      expect(screen.queryByRole('button', { name: /gallery/i })).not.toBeInTheDocument()
      const file = new File(['img'], 'patch.jpg', { type: 'image/jpeg' })
      const galleryInput = document.querySelector<HTMLInputElement>('input[type="file"]:not([capture])')!
      await userEvent.upload(galleryInput, file)
      expect(mockUploadDevicePhoto).toHaveBeenCalledWith(file, 'user-1')
    })

    it('picking Camera dismisses sheet and uploads via camera input', async () => {
      await openEditWithDevice()
      await userEvent.click(await screen.findByRole('button', { name: /⊕ photo/i }))
      await userEvent.click(await screen.findByRole('button', { name: /camera/i }))
      expect(screen.queryByRole('button', { name: /camera/i })).not.toBeInTheDocument()
      const file = new File(['img'], 'shot.jpg', { type: 'image/jpeg' })
      const cameraInput = document.querySelector<HTMLInputElement>('input[type="file"][capture]')!
      await userEvent.upload(cameraInput, file)
      expect(mockUploadDevicePhoto).toHaveBeenCalledWith(file, 'user-1')
    })

    it('cancel dismisses sheet without upload', async () => {
      await openEditWithDevice()
      await userEvent.click(await screen.findByRole('button', { name: /⊕ photo/i }))
      // Find cancel button inside the sheet (after sheet appears)
      const galleryBtn = await screen.findByRole('button', { name: /gallery/i })
      const sheet = galleryBtn.closest('[style*="position: fixed"]')!
      const cancelBtn = Array.from(sheet.querySelectorAll('button')).find(b => /cancel/i.test(b.textContent ?? ''))!
      await userEvent.click(cancelBtn)
      expect(screen.queryByRole('button', { name: /gallery/i })).not.toBeInTheDocument()
      expect(mockUploadDevicePhoto).not.toHaveBeenCalled()
    })
  })

  describe('device card drag transform', () => {
    const scalingTransform = {
      attributes: {} as never,
      listeners: {} as never,
      setNodeRef: () => {},
      transform: { x: 0, y: 20, scaleX: 1.1, scaleY: 0.9 },
      transition: 'transform 250ms ease',
    } as unknown as ReturnType<typeof useSortable>

    const nullTransform = {
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
    } as unknown as ReturnType<typeof useSortable>

    beforeEach(() => {
      vi.mocked(useSortable).mockReturnValue(scalingTransform)
    })

    afterEach(() => {
      vi.mocked(useSortable).mockReturnValue(nullTransform)
    })

    it('applies translate-only transform (no scale distortion during drag)', async () => {
      const session = makeSession({
        session_devices: [
          { id: 'sd-1', device_id: 'dev-1', sync_role: 'standalone', sync_mode: null, patch_notes: null, sort_order: 0, devices: PO },
        ],
      })
      mockFrom
        .mockReturnValueOnce(makeSessionFetch(session) as never)
        .mockReturnValueOnce(makeConnectionsFetch() as never)
      renderDetail()
      await userEvent.click(await screen.findByRole('button', { name: /edit/i }))

      // The sortable card div should apply only translate, not scale
      await screen.findByText('PO-33')
      const card = document.querySelector<HTMLElement>('[style*="translate3d"]')
      expect(card).not.toBeNull()
      expect(card!.style.transform).not.toMatch(/scale/i)
    })
  })
})
