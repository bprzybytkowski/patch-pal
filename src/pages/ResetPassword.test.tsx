import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ResetPasswordPage from './ResetPassword'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { updateUser: vi.fn() } },
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockNavigate = vi.fn()

function renderPage() {
  render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

describe('Reset password page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders new password and confirm password fields', () => {
    renderPage()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update password/i })).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('New password'), 'newpass123')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'different')
    await userEvent.click(screen.getByRole('button', { name: /update password/i }))
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
  })

  it('shows error when password is too short', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText('New password'), 'short')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'short')
    await userEvent.click(screen.getByRole('button', { name: /update password/i }))
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('successful update navigates to /sessions', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: { user: {} }, error: null } as never)
    renderPage()
    await userEvent.type(screen.getByLabelText('New password'), 'newpass123')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'newpass123')
    await userEvent.click(screen.getByRole('button', { name: /update password/i }))
    await screen.findByRole('button', { name: /update password/i })
    expect(mockNavigate).toHaveBeenCalledWith('/sessions')
  })

  it('Supabase error is shown in the form', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'Password should be at least 6 characters.' } as never,
    } as never)
    renderPage()
    await userEvent.type(screen.getByLabelText('New password'), 'newpass123')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'newpass123')
    await userEvent.click(screen.getByRole('button', { name: /update password/i }))
    expect(await screen.findByText(/password should be at least 6 characters/i)).toBeInTheDocument()
  })
})
