import { useToastStore } from './toast'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('toast store', () => {
  it('addToast adds a toast with id, message, and type', () => {
    useToastStore.getState().addToast({ message: 'Saved!', type: 'success' })
    const { toasts } = useToastStore.getState()
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('Saved!')
    expect(toasts[0].type).toBe('success')
    expect(toasts[0].id).toBeTruthy()
  })

  it('removeToast removes the toast with the given id', () => {
    useToastStore.getState().addToast({ message: 'Hello', type: 'success' })
    const id = useToastStore.getState().toasts[0].id
    useToastStore.getState().removeToast(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('toast auto-removes after 4 seconds', () => {
    vi.useFakeTimers()
    useToastStore.getState().addToast({ message: 'Temp', type: 'success' })
    expect(useToastStore.getState().toasts).toHaveLength(1)
    vi.advanceTimersByTime(4000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
    vi.useRealTimers()
  })
})
