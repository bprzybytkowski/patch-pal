import { render } from '@testing-library/react'
import { act } from 'react'
import { createMemoryRouter } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { useThemeStore } from './store/theme'
import App from './App'

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('./router', () => ({
  router: createMemoryRouter([{ path: '/*', element: <div /> }]),
}))

beforeEach(() => {
  useAuthStore.setState({ user: null, loading: false })
  useThemeStore.setState({ theme: 'light' })
  document.documentElement.removeAttribute('data-theme')
})

function mockMatchMedia(prefersDark: boolean) {
  const listeners: Array<(e: Partial<MediaQueryListEvent>) => void> = []
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn((_type: string, handler: (e: Partial<MediaQueryListEvent>) => void) => {
      listeners.push(handler)
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  return {
    fireChange: (matches: boolean) => {
      listeners.forEach((h) => h({ matches }))
    },
  }
}

describe('ThemeSync', () => {
  it('sets data-theme to dark when system prefers dark', () => {
    mockMatchMedia(true)
    render(<App />)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('sets data-theme to light when system prefers light', () => {
    mockMatchMedia(false)
    render(<App />)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('updates data-theme to dark when system switches to dark', () => {
    const { fireChange } = mockMatchMedia(false)
    render(<App />)
    expect(document.documentElement.dataset.theme).toBe('light')

    act(() => fireChange(true))

    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('updates data-theme to light when system switches to light', () => {
    const { fireChange } = mockMatchMedia(true)
    render(<App />)
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => fireChange(false))

    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
