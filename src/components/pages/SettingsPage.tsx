import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { downloadExport, exportStateAsJson } from '../../data/persistence'
import { formatCurrency } from '../../utils/currency'
import { format, parseISO, isValid } from 'date-fns'
import { CheckCircle, Download, HardDrive, Lock, Printer, RotateCcw, Settings } from 'lucide-react'
import type { Page } from '../../App'

interface SettingsPageProps {
  onNavigate: (page: Page) => void
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const { state, dispatch, budgetSummary } = useApp()
  const { event, budget, tasks, vendors } = state
  const [confirmReset, setConfirmReset] = useState(false)
  const [message, setMessage] = useState('')

  const exportJson = useMemo(() => exportStateAsJson(state), [state])
  const storageSize = useMemo(() => new Blob([exportJson]).size, [exportJson])

  function handleExport() {
    downloadExport(state)
    setMessage('JSON export downloaded. It contains your locally stored event plan.')
  }

  function handleReset() {
    dispatch({ type: 'RESET' })
    setConfirmReset(false)
    setMessage('Demo data reset. You can create a new event whenever you are ready.')
    onNavigate('setup')
  }

  return (
    <div className="page-content">
      <div className="page-heading no-print">
        <h1>Event Settings</h1>
        <p>Manage preferences, export your plan, or reset the local demo data.</p>
      </div>

      {message && (
        <div className="alert alert-success no-print" role="status" aria-live="polite" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle size={16} aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      <div className="section-grid section-grid-2 no-print">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Event Preferences</h2>
              <p className="card-subtitle">
                {event ? 'Update dates, guests, budget, priorities, and requirements.' : 'No event has been created yet.'}
              </p>
            </div>
            <Settings size={18} aria-hidden="true" />
          </div>
          {event ? (
            <>
              <dl className="detail-list">
                <div><dt>Event</dt><dd>{event.name}</dd></div>
                <div><dt>Type</dt><dd style={{ textTransform: 'capitalize' }}>{event.type}</dd></div>
                <div><dt>Date</dt><dd>{isValid(parseISO(event.date)) ? format(parseISO(event.date), 'MMMM d, yyyy') : event.date}</dd></div>
                <div><dt>Guests</dt><dd>{event.guestCount.toLocaleString()}</dd></div>
                <div><dt>Budget</dt><dd>{formatCurrency(event.budget, event.currency)}</dd></div>
              </dl>
              <button className="btn btn-primary" onClick={() => onNavigate('setup')} style={{ marginTop: '1rem' }}>
                Edit event preferences
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => onNavigate('setup')}>
              Create an event
            </button>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Export &amp; Print</h2>
              <p className="card-subtitle">A portable JSON copy and a clean printed summary.</p>
            </div>
            <Download size={18} aria-hidden="true" />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleExport} disabled={!event}>
              <Download size={15} aria-hidden="true" /> Export JSON
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => window.print()}
              disabled={!event}
            >
              <Printer size={15} aria-hidden="true" /> Print summary
            </button>
          </div>
          <p className="text-xs text-muted" style={{ marginTop: '0.75rem' }}>
            The export includes event details, budgets, expenses, tasks, vendors, and ideas. Printing
            opens your browser&apos;s print dialog with a summary-only layout.
          </p>
          <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
            Approximate local data size: {(storageSize / 1024).toFixed(1)} KB. Schema version{' '}
            {state.schemaVersion}.
          </p>
        </div>
      </div>

      <div className="card no-print" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Data Storage &amp; Privacy</h2>
            <p className="card-subtitle">Local-first by design</p>
          </div>
          <Lock size={18} aria-hidden="true" />
        </div>
        <ul className="privacy-list">
          <li>
            <HardDrive size={15} aria-hidden="true" />
            <span>
              Your event, budget, tasks, and vendor records are stored in this browser&apos;s
              localStorage. They are not automatically synchronized across devices or browsers.
            </span>
          </li>
          <li>
            <Lock size={15} aria-hidden="true" />
            <span>
              No API keys or credentials are stored in the browser. The deterministic planner never
              sends your data over the network.
            </span>
          </li>
          <li>
            <HardDrive size={15} aria-hidden="true" />
            <span>
              Optional AI ideas are sent only after you press the button in the Idea Studio. The
              request excludes event names, notes, and vendor contact details.
            </span>
          </li>
          <li>
            <Lock size={15} aria-hidden="true" />
            <span>
              Clearing browser storage or pressing reset below removes the local demo data. Export
              first if you want to keep a copy.
            </span>
          </li>
        </ul>
      </div>

      <div className="card no-print" style={{ marginTop: '1.5rem', borderColor: '#fecaca' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title" style={{ color: 'var(--color-danger)' }}>
              Reset Demo Data
            </h2>
            <p className="card-subtitle">
              Permanently removes the event, budget, tasks, vendors, and ideas from this browser.
            </p>
          </div>
          <RotateCcw size={18} aria-hidden="true" style={{ color: 'var(--color-danger)' }} />
        </div>
        <button className="btn btn-danger" onClick={() => setConfirmReset(true)}>
          <RotateCcw size={15} aria-hidden="true" /> Reset local data
        </button>
      </div>

      {event && (
        <section className="print-summary" aria-labelledby="print-summary-title">
          <h1 id="print-summary-title">{event.name}</h1>
          <p>
            {event.type}  |  {event.city || 'Location not specified'}  | {' '}
            {isValid(parseISO(event.date)) ? format(parseISO(event.date), 'MMMM d, yyyy') : event.date}  | {' '}
            {event.guestCount.toLocaleString()} guests
          </p>

          <h2>Budget Summary</h2>
          {budgetSummary ? (
            <>
              <p>
                Total budget {formatCurrency(budgetSummary.totalBudget, event.currency)}  |  Planned{' '}
                {formatCurrency(budgetSummary.totalPlanned, event.currency)}  |  Actual{' '}
                {formatCurrency(budgetSummary.totalActual, event.currency)}  |  Contingency{' '}
                {formatCurrency(budgetSummary.contingencyAmount, event.currency)}
              </p>
              <table className="data-table">
                <caption>Budget categories</caption>
                <thead>
                  <tr><th scope="col">Category</th><th scope="col">Planned</th><th scope="col">Actual</th></tr>
                </thead>
                <tbody>
                  {budget?.categories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                      <td>{formatCurrency(category.plannedAmount, event.currency)}</td>
                      <td>{formatCurrency(category.actualAmount, event.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p>No budget data.</p>
          )}

          <h2>Timeline</h2>
          {tasks.length === 0 ? (
            <p>No tasks recorded.</p>
          ) : (
            <ul>
              {tasks
                .slice()
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .map((task) => (
                  <li key={task.id}>
                    [{task.status === 'complete' ? 'x' : ' '}] {task.dueDate}  -  {task.title} ({task.priority})
                  </li>
                ))}
            </ul>
          )}

          <h2>Vendors</h2>
          {vendors.length === 0 ? (
            <p>No vendors recorded.</p>
          ) : (
            <ul>
              {vendors.map((vendor) => (
                <li key={vendor.id}>
                  {vendor.name}  -  {vendor.category}  -  {vendor.status}  - {' '}
                  {formatCurrency(vendor.quotedCost ?? vendor.estimatedCost, event.currency)}
                  {vendor.isSampleData ? ' (sample data)' : ''}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs">
            Generated by EventWise AI. All costs and sample vendors are illustrative, not verified
            quotes. Confirm all details with real suppliers.
          </p>
        </section>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Reset all local event data?"
        description="This permanently removes the current event, budget, expenses, tasks, vendors, and generated ideas from this browser. It cannot be undone. Export your plan first if you need a copy."
        confirmLabel="Reset everything"
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
