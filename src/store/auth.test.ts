import { useAuthStore } from './auth'

beforeEach(() => {
  useAuthStore.setState({ user: null, loading: true })
})

describe('auth store', () => {
  it('has null user and loading true initially', () => {
    const { user, loading } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(loading).toBe(true)
  })

  it('setUser updates user and sets loading false', () => {
    const mockUser = { id: 'u1', email: 'a@b.com' } as never
    useAuthStore.getState().setUser(mockUser)
    const { user, loading } = useAuthStore.getState()
    expect(user).toBe(mockUser)
    expect(loading).toBe(false)
  })
})
