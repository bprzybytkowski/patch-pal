import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { supabase } from '../lib/supabase'
import DevicesPage from './Devices'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }))

interface Device {
  id: string
  user_id: string
  name: string
  type: string
  manufacturer: string | null
  notes: string | null
  created_at: string
}

const mockFrom = vi.mocked(supabase.from)

function makeLoadMock(devices: Device[] = []) {
  return {
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: devices, error: null }),
    }),
  }
}

function makeInsertMock(device: Device) {
  return {
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [device], error: null }),
    }),
  }
}

function makeUpdateMock(device: Device) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [device], error: null }),
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

const existingDevice: Device = {
  id: 'dev-1',
  user_id: 'u1',
  name: 'PO-33',
  type: 'pocket_operator',
  manufacturer: 'Teenage Engineering',
  notes: null,
  created_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Devices page', () => {
  it('renders add-device form with Name, Type, and submit button', async () => {
    mockFrom.mockReturnValueOnce(makeLoadMock() as never)
    render(<DevicesPage />)
    expect(await screen.findByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /type/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add device/i })).toBeInTheDocument()
  })

  it('displays fetched devices with name and type badge', async () => {
    mockFrom.mockReturnValueOnce(makeLoadMock([existingDevice]) as never)
    render(<DevicesPage />)
    expect(await screen.findByText('PO-33')).toBeInTheDocument()
    expect(screen.getByTestId('type-badge')).toHaveTextContent('Pocket Operator')
  })

  it('submitting the form adds the new device to the list and resets the form', async () => {
    const newDevice: Device = { ...existingDevice, id: 'dev-2', name: 'Digitakt', type: 'drum_machine', manufacturer: null }
    mockFrom
      .mockReturnValueOnce(makeLoadMock() as never)
      .mockReturnValueOnce(makeInsertMock(newDevice) as never)

    render(<DevicesPage />)
    await screen.findByLabelText(/name/i)

    await userEvent.type(screen.getByLabelText(/name/i), 'Digitakt')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /type/i }), 'drum_machine')
    await userEvent.click(screen.getByRole('button', { name: /add device/i }))

    expect(await screen.findByText('Digitakt')).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toHaveValue('')
  })

  it('clicking Edit on a device shows inline editable fields', async () => {
    mockFrom.mockReturnValueOnce(makeLoadMock([existingDevice]) as never)
    render(<DevicesPage />)

    await userEvent.click(await screen.findByRole('button', { name: /edit/i }))
    expect(screen.getByDisplayValue('PO-33')).toBeInTheDocument()
  })

  it('saving the inline edit updates the device name in the list', async () => {
    const updated = { ...existingDevice, name: 'PO-33 KO' }
    mockFrom
      .mockReturnValueOnce(makeLoadMock([existingDevice]) as never)
      .mockReturnValueOnce(makeUpdateMock(updated) as never)

    render(<DevicesPage />)
    await userEvent.click(await screen.findByRole('button', { name: /edit/i }))

    const nameInput = screen.getByDisplayValue('PO-33')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'PO-33 KO')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(await screen.findByText('PO-33 KO')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('PO-33 KO')).not.toBeInTheDocument()
  })

  it('clicking Delete (confirmed) removes the device from the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockFrom
      .mockReturnValueOnce(makeLoadMock([existingDevice]) as never)
      .mockReturnValueOnce(makeDeleteMock() as never)

    render(<DevicesPage />)
    await userEvent.click(await screen.findByRole('button', { name: /delete/i }))

    expect(await screen.findByText(/no devices/i)).toBeInTheDocument()
  })
})
