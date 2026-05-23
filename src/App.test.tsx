import { render } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)
  })

  it('root element has dark background class', () => {
    const { container } = render(<App />)
    expect(container.firstChild).toHaveClass('bg-zinc-950')
  })
})
