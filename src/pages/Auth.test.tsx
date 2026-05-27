import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AuthPage from './Auth'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
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
    expect(screen.getByRole('button', { name: /start journaling/i })).toBeInTheDocument()
  })

  it('successful sign-up shows email confirmation message', async () => {
    const { supabase } = await import('../lib/supabase')
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { identities: [{ id: '1' }] }, session: null },
      error: null,
    } as never)

    renderAuth()
    await userEvent.click(screen.getByRole('tab', { name: /sign up/i }))
    await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'securepass')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'securepass')
    await userEvent.click(screen.getByRole('button', { name: /start journaling/i }))

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument()
    expect(screen.getByText(/confirmation link/i)).toBeInTheDocument()
  })

  it('sign-up with mismatched passwords shows validation error', async () => {
    renderAuth()
    await userEvent.click(screen.getByRole('tab', { name: /sign up/i }))
    await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'securepass')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'different')
    await userEvent.click(screen.getByRole('button', { name: /start journaling/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
  })

  it('sign-up with already registered email shows inbox confirmation (enumeration-safe)', async () => {
    const { supabase } = await import('../lib/supabase')
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    } as never)

    renderAuth()
    await userEvent.click(screen.getByRole('tab', { name: /sign up/i }))
    await userEvent.type(screen.getByLabelText(/email/i), 'existing@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'securepass')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'securepass')
    await userEvent.click(screen.getByRole('button', { name: /start journaling/i }))

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument()
  })

  it('clicking Forgot password shows reset form', async () => {
    renderAuth()
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }))
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('submitting forgot password form shows sent confirmation', async () => {
    const { supabase } = await import('../lib/supabase')
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ data: {}, error: null } as never)

    renderAuth()
    await userEvent.click(screen.getByRole('button', { name: /forgot password/i }))
    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText(/password reset link/i)).toBeInTheDocument()
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
