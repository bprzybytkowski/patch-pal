import { render } from '@testing-library/react'
import { createMemoryRouter } from 'react-router-dom'
import { useAuthStore } from './store/auth'
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
})

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
  })

  it('renders the theme sync component without errors', () => {
    const { container } = render(<App />)
    expect(container).toBeTruthy()
  })
})
