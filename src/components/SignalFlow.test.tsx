import { render, screen } from '@testing-library/react'
import SignalFlow from './SignalFlow'
import type { SignalFlowDevice, SignalFlowConnection } from './SignalFlow'

const SAMPLE_DEVICES: SignalFlowDevice[] = [
  { name: 'OP-1', role: 'master', type: 'digital_synth', sync: 'SY2' },
  { name: 'PO-33', role: 'standalone', type: 'pocket_operator' },
]

const SAMPLE_CONNECTIONS: SignalFlowConnection[] = [
  { from: 'OP-1', to: 'PO-33', kind: 'sync', label: 'clock' },
  { from: 'PO-33', to: 'OUT', kind: 'audio', label: 'main' },
]

describe('SignalFlow', () => {
  it('renders OUT pill, master role stamp, and adjacent cable label', () => {
    render(
      <SignalFlow
        devices={SAMPLE_DEVICES}
        connections={SAMPLE_CONNECTIONS}
        theme="light"
      />,
    )
    expect(screen.getByText(/out/i)).toBeInTheDocument()
    expect(screen.getByText('master')).toBeInTheDocument()
    expect(screen.getByText('clock')).toBeInTheDocument()
  })

  it('renders device names for all supplied devices', () => {
    render(
      <SignalFlow
        devices={SAMPLE_DEVICES}
        connections={SAMPLE_CONNECTIONS}
        theme="light"
      />,
    )
    expect(screen.getByText('OP-1')).toBeInTheDocument()
    expect(screen.getByText('PO-33')).toBeInTheDocument()
  })

  it('renders correctly in dark theme', () => {
    render(
      <SignalFlow
        devices={SAMPLE_DEVICES}
        connections={[]}
        theme="dark"
      />,
    )
    expect(screen.getByText(/out/i)).toBeInTheDocument()
  })
})
