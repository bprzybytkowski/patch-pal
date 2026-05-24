import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AuthPage from './Auth'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}))

function renderAuth() {
  render(
    <MemoryRouter>
      <AuthPage />
    </MemoryRouter>,
  )
}

describe('Auth page', () => {
  it('renders email and password inputs on sign-in tab', () => {
    renderAuth()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('switching to sign-up tab shows the sign-up form', async () => {
    renderAuth()
    await userEvent.click(screen.getByRole('tab', { name: /sign up/i }))
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
  })

  it('successful sign-up shows email confirmation message', async () => {
    const { supabase } = await import('../lib/supabase')
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as never)

    renderAuth()
    await userEvent.click(screen.getByRole('tab', { name: /sign up/i }))
    await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'securepass')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
    expect(screen.getByText(/confirmation link/i)).toBeInTheDocument()
  })

  it('sign-in failure shows inline error message', async () => {
    const { supabase } = await import('../lib/supabase')
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' } as never,
    })

    renderAuth()
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument()
  })
})
