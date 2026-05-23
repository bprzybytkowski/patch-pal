import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import ProtectedRoute from './components/ProtectedRoute'
import RootRedirect from './components/RootRedirect'

const AuthStub = () => <div data-testid="auth-page" />
const SessionsStub = () => <div data-testid="sessions-page" />
const mockUser = { id: 'u1', email: 'a@b.com' } as never

beforeEach(() => {
  useAuthStore.setState({ user: null, loading: false })
})

function renderRoute(initialPath: string) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/auth" element={<AuthStub />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/sessions" element={<SessionsStub />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('root redirect', () => {
  it('unauthenticated user at / lands on auth page', () => {
    renderRoute('/')
    expect(screen.getByTestId('auth-page')).toBeInTheDocument()
  })

  it('authenticated user at / lands on sessions page', () => {
    useAuthStore.setState({ user: mockUser, loading: false })
    renderRoute('/')
    expect(screen.getByTestId('sessions-page')).toBeInTheDocument()
  })
})

describe('protected routes', () => {
  it('unauthenticated access to /sessions shows auth page', () => {
    renderRoute('/sessions')
    expect(screen.getByTestId('auth-page')).toBeInTheDocument()
  })

  it('authenticated access to /sessions shows sessions page', () => {
    useAuthStore.setState({ user: mockUser, loading: false })
    renderRoute('/sessions')
    expect(screen.getByTestId('sessions-page')).toBeInTheDocument()
  })
})
