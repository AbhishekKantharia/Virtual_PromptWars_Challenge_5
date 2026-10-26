import { useApp } from '../../context/AppContext'
import { formatCurrency } from '../../utils/currency'
import { format, parseISO, differenceInDays } from 'date-fns'
import {
  AlertTriangle, CheckCircle, Clock, Users, DollarSign, Star, RefreshCw, X
} from 'lucide-react'
import type { Page } from '../../App'

interface DashboardProps {
  onNavigate: (page: Page) => void
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { state, dispatch, budgetSummary, readiness } = useApp()
  const { event, vendors } = state

  if (!event) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <Star size={48} aria-hidden="true" />
          <h2>Welcome to EventWise AI</h2>
          <p>Create your first event to get started with intelligent celebration planning.</p>
          <button className="btn btn-primary btn-lg" onClick={() => onNavigate('setup')}>
            Create Your Event
          </button>
        </div>
      </div>
    )
  }

  const today = new Date()
  const eventDate = parseISO(event.date)
  const daysAway = differenceInDays(eventDate, today)
  const pct = readiness?.completionPercent ?? 0
  const bookedVendors = vendors.filter((v) => v.status === 'booked').length

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-heading">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>{event.name}</h1>
            <p style={{ marginTop: '4px', color: 'var(--color-warm-gray-600)', textTransform: 'capitalize' }}>
              {event.type}  |  {event.city || 'Location TBC'}  |  {event.guestCount} guests
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => onNavigate('setup')}>
            Edit Event
          </button>
        </div>
      </div>

      {/* Readiness banner */}
      {readiness && (
        <div
          className={`alert ${readiness.isReady ? 'alert-success' : readiness.budgetRisk === 'critical' ? 'alert-danger' : 'alert-info'}`}
          role="status"
          aria-live="polite"
          style={{ marginBottom: '1.5rem' }}
        >
          {readiness.isReady ? (
            <CheckCircle size={16} className="alert-icon" aria-hidden="true" />
          ) : (
            <AlertTriangle size={16} className="alert-icon" aria-hidden="true" />
          )}
          <div>
            <strong>
              {readiness.isReady
                ? 'Event is on track!'
                : `${readiness.criticalIncomplete.length} critical task(s) need attention`}
            </strong>
            {readiness.nextActions.length > 0 && (
              <ul style={{ marginTop: '0.25rem', paddingLeft: '1rem', fontSize: '0.85rem' }}>
                {readiness.nextActions.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {state.lastReplan && (
        <div className="alert alert-info" role="status" aria-live="polite" style={{ marginBottom: '1.5rem' }}>
          <RefreshCw size={16} aria-hidden="true" className="alert-icon" />
          <div style={{ flex: 1 }}>
            <strong>Event plan updated.</strong> The following details changed since the previous plan:
            <ul style={{ marginTop: '0.25rem', paddingLeft: '1rem', fontSize: '0.85rem' }}>
              {state.lastReplan.explanations.map((explanation) => (
                <li key={explanation}>{explanation}</li>
              ))}
            </ul>
            {state.lastReplan.tasksPreserved > 0 && (
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {state.lastReplan.tasksPreserved} completed or user-edited task(s) were preserved.
                Vendors and expenses were not discarded.
              </p>
            )}
            {state.lastReplan.tasksAdded > 0 && (
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {state.lastReplan.tasksAdded} new task(s) were added to the timeline.
              </p>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'CLEAR_REPLAN_NOTICE' })}
            aria-label="Dismiss plan update notice"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {readiness && (readiness.overdueTasks.length > 0 || readiness.blockedTasks.length > 0) && (
        <div className="alert alert-warning" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            {readiness.overdueTasks.length > 0 && `${readiness.overdueTasks.length} task(s) are overdue. `}
            {readiness.blockedTasks.length > 0 && `${readiness.blockedTasks.length} task(s) are blocked by unfinished dependencies.`}
          </span>
        </div>
      )}

      {/* KPI stats */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card accent">
          <p className="stat-label">Days Until Event</p>
          <p className="stat-value">{daysAway >= 0 ? daysAway : 'Past'}</p>
          <p className="stat-sub">{format(eventDate, 'MMMM d, yyyy')}</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Task Completion</p>
          <p className="stat-value">{pct}%</p>
          <div className="progress-bar-container" style={{ marginTop: '0.5rem' }}>
            <div
              className={`progress-bar-fill ${pct === 100 ? 'success' : pct > 50 ? '' : 'warning'}`}
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${pct}% tasks complete`}
            />
          </div>
        </div>

        <div className="stat-card">
          <p className="stat-label">Budget Used</p>
          <p className={`stat-value ${budgetSummary?.isOverBudget ? 'text-danger' : ''}`}>
            {budgetSummary ? formatCurrency(budgetSummary.totalActual, event.currency) : ' - '}
          </p>
          <p className="stat-sub">
            of {budgetSummary ? formatCurrency(budgetSummary.totalBudget, event.currency) : ' - '} total
          </p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Booked Vendors</p>
          <p className="stat-value">{bookedVendors}</p>
          <p className="stat-sub">of {vendors.filter(v => v.status !== 'cancelled').length} tracked</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="section-grid section-grid-2">
        {/* Upcoming deadlines */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Upcoming Deadlines</h2>
              <p className="card-subtitle">Next 14 days</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('timeline')}>
              View all
            </button>
          </div>
          {readiness && readiness.upcomingDeadlines.length > 0 ? (
            <ul style={{ listStyle: 'none' }}>
              {readiness.upcomingDeadlines.slice(0, 5).map((task) => {
                const dueIn = differenceInDays(parseISO(task.dueDate), today)
                return (
                  <li key={task.id} className="task-item">
                    <Clock size={14} aria-hidden="true" style={{ color: dueIn <= 3 ? 'var(--color-danger)' : 'var(--color-plum-400)', marginTop: '3px', flexShrink: 0 }} />
                    <div>
                      <p className="task-title">{task.title}</p>
                      <div className="task-meta">
                        <span style={{ color: dueIn <= 3 ? 'var(--color-danger)' : undefined }}>
                          {dueIn === 0 ? 'Due today' : `In ${dueIn} day${dueIn !== 1 ? 's' : ''}`}
                        </span>
                        <span className={`badge badge-${task.priority === 'critical' ? 'danger' : task.priority === 'high' ? 'warning' : 'gray'}`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">No deadlines in the next 14 days.</p>
          )}
        </div>

        {/* Budget summary */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Budget Overview</h2>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('budget')}>
              Manage
            </button>
          </div>
          {budgetSummary ? (
            <>
              {budgetSummary.isOverBudget && (
                <div className="alert alert-danger" style={{ marginBottom: '1rem' }} role="alert">
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span>Over budget by {formatCurrency(budgetSummary.totalActual - budgetSummary.totalBudget, event.currency)}</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {state.budget?.categories.slice(0, 5).map((cat) => {
                  const pctUsed = cat.plannedAmount > 0 ? Math.min(100, (cat.actualAmount / cat.plannedAmount) * 100) : 0
                  return (
                    <div key={cat.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span className="text-sm">{cat.name}</span>
                        <span className="text-sm text-muted">
                          {formatCurrency(cat.actualAmount, event.currency)} / {formatCurrency(cat.plannedAmount, event.currency)}
                        </span>
                      </div>
                      <div className="progress-bar-container">
                        <div
                          className={`progress-bar-fill ${pctUsed >= 100 ? 'danger' : pctUsed >= 80 ? 'warning' : ''}`}
                          style={{ width: `${pctUsed}%` }}
                          role="progressbar"
                          aria-valuenow={Math.round(pctUsed)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${cat.name}: ${Math.round(pctUsed)}% used`}
                        />
                      </div>
                    </div>
                  )
                })}
                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--color-warm-gray-100)' }}>
                  <div className="flex justify-between text-sm">
                    <span>Remaining after contingency</span>
                    <strong className={budgetSummary.remainingAfterContingency < 0 ? 'text-danger' : 'text-success'}>
                      {formatCurrency(budgetSummary.remainingAfterContingency, event.currency)}
                    </strong>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">No budget data yet.</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 className="card-title" style={{ marginBottom: '1rem' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => onNavigate('timeline')}>
            <CheckCircle size={15} aria-hidden="true" /> View Timeline
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('vendors')}>
            <Users size={15} aria-hidden="true" /> Manage Vendors
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('ideas')}>
            <Star size={15} aria-hidden="true" /> Get Ideas
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('budget')}>
            <DollarSign size={15} aria-hidden="true" /> Update Budget
          </button>
        </div>
      </div>
    </div>
  )
}
