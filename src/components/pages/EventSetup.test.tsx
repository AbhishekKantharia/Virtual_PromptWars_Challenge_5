import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventSetup } from './EventSetup'
import { AppProvider } from '../../context/AppContext'

function renderSetup() {
  return render(
    <AppProvider>
      <EventSetup onNavigate={vi.fn()} />
    </AppProvider>
  )
}

describe('EventSetup accessibility and validation', () => {
  it('exposes labelled form fields and accessible validation feedback', async () => {
    const user = userEvent.setup()
    renderSetup()

    expect(screen.getByLabelText('Event Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Event Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Event Date')).toBeInTheDocument()
    expect(screen.getByLabelText('Estimated Guest Count')).toBeInTheDocument()
    expect(screen.getByLabelText('Total Budget')).toBeInTheDocument()
    expect(screen.getByLabelText('Currency')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Planning Priorities/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Create Event & Start Planning/i }))

    const nameField = screen.getByLabelText('Event Name')
    expect(nameField).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByText(/Event name must be at least 2 characters/i).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
  })

  it('accepts a valid event and navigates to the dashboard', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(
      <AppProvider>
        <EventSetup onNavigate={onNavigate} />
      </AppProvider>
    )

    await user.type(screen.getByLabelText('Event Name'), 'A Very Real Test Event')
    await user.click(screen.getByRole('button', { name: /Create Event & Start Planning/i }))

    expect(onNavigate).toHaveBeenCalledWith('dashboard')
  })
})
