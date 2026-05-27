import { act, render, screen } from '@testing-library/react'
import { useToastStore } from '../store/toast'
import { ToastContainer } from './Toast'

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

describe('ToastContainer', () => {
  it('renders toasts from the store', () => {
    act(() => {
      useToastStore.getState().addToast({ message: 'Session saved', type: 'success' })
    })
    render(<ToastContainer />)
    expect(screen.getByText('Session saved')).toBeInTheDocument()
  })

  it('shows at most 3 toasts when store has more', () => {
    act(() => {
      useToastStore.getState().addToast({ message: 'Toast 1', type: 'success' })
      useToastStore.getState().addToast({ message: 'Toast 2', type: 'success' })
      useToastStore.getState().addToast({ message: 'Toast 3', type: 'success' })
      useToastStore.getState().addToast({ message: 'Toast 4', type: 'success' })
    })
    render(<ToastContainer />)
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument()
    expect(screen.getByText('Toast 2')).toBeInTheDocument()
    expect(screen.getByText('Toast 3')).toBeInTheDocument()
    expect(screen.getByText('Toast 4')).toBeInTheDocument()
  })

  it('success toast has muted left border', () => {
    act(() => {
      useToastStore.getState().addToast({ message: 'OK', type: 'success' })
    })
    render(<ToastContainer />)
    const toast = screen.getByText('OK').closest('[data-type]')
    expect(toast).toHaveAttribute('data-type', 'success')
    expect(toast?.className).toContain('border-l-ink-muted')
  })

  it('error toast has accent left border', () => {
    act(() => {
      useToastStore.getState().addToast({ message: 'Oops', type: 'error' })
    })
    render(<ToastContainer />)
    const toast = screen.getByText('Oops').closest('[data-type]')
    expect(toast).toHaveAttribute('data-type', 'error')
    expect(toast?.className).toContain('border-l-accent')
  })
})
