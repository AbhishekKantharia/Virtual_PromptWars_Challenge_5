import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Recommendation } from '../../types'
import { deriveAssumptions } from '../../engine/recommendations'
import { requestAiRecommendations } from '../../ai/aiClient'
import { formatCurrency } from '../../utils/currency'
import { sanitizeText } from '../../engine/validation'
import { format, parseISO, subDays, isValid } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
  ListPlus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

type CategoryFilter = 'all' | Recommendation['category']

const CATEGORY_LABELS: Record<Recommendation['category'], string> = {
  theme: 'Theme',
  menu: 'Menu',
  activity: 'Activity',
  decoration: 'Decoration',
  entertainment: 'Entertainment',
  logistics: 'Logistics',
}

const IMPACT_LABEL: Record<Recommendation['budgetImpact'], string> = {
  saves: 'Potential saving',
  neutral: 'Neutral impact',
  adds: 'May add cost',
}

export function IdeaStudio() {
  const { state, dispatch, budgetSummary, refreshRecommendations } = useApp()
  const { event, recommendations } = state

  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [addedIds, setAddedIds] = useState<string[]>([])
  const [aiRecs, setAiRecs] = useState<Recommendation[]>([])
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [aiMessage, setAiMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const visible = useMemo(
    () =>
      filter === 'all'
        ? recommendations
        : recommendations.filter((recommendation) => recommendation.category === filter),
    [recommendations, filter]
  )

  if (!event) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <AlertTriangle size={40} aria-hidden="true" />
          <h2>No event yet</h2>
          <p>Create an event first to see personalized planning ideas.</p>
        </div>
      </div>
    )
  }

  const assumptions = deriveAssumptions(event)
  const categories = Array.from(new Set(recommendations.map((rec) => rec.category)))

  function addAsTask(recommendation: Recommendation) {
    if (!event || addedIds.includes(recommendation.id)) return
    const parsedEventDate = parseISO(event.date)
    const suggestion = isValid(parsedEventDate) ? subDays(parsedEventDate, 30) : new Date()
    const today = new Date()
    const due = suggestion < today ? today : suggestion
    dispatch({
      type: 'ADD_TASK',
      payload: {
        title: sanitizeText(`Review idea: ${recommendation.title}`).slice(0, 120),
        description: sanitizeText(recommendation.description).slice(0, 500),
        dueDate: format(due, 'yyyy-MM-dd'),
        priority: 'medium',
        status: 'pending',
        category: 'Ideas',
        dependsOn: [],
        completedAt: undefined,
      },
    })
    setAddedIds((ids) => [...ids, recommendation.id])
    setActionMessage(`Added "${recommendation.title}" to your timeline.`)
  }

  async function enhanceWithAi() {
    if (!event || !budgetSummary || aiState === 'loading') return
    setAiState('loading')
    setAiMessage('')
    const result = await requestAiRecommendations(event, budgetSummary)
    setAiMessage(result.message)
    if (result.ok) {
      setAiRecs(result.recommendations)
      setAiState('done')
    } else {
      setAiState('error')
    }
  }

  function regenerate() {
    refreshRecommendations()
    setAddedIds([])
    setActionMessage('Deterministic ideas refreshed from your current event, budget, and priorities.')
  }

  return (
    <div className="page-content">
      <div className="page-heading">
        <div className="flex items-start justify-between gap-4" style={{ flexWrap: 'wrap' }}>
          <div>
            <h1>AI Idea Studio</h1>
            <p>
              Personalized, explainable suggestions for {event.name}. Generated ideas are starting
              points  -  confirm availability, prices, and dietary safety with real suppliers.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={regenerate}>
            <RefreshCw size={15} aria-hidden="true" /> Refresh ideas
          </button>
        </div>
      </div>

      <div className="alert alert-info" role="note" style={{ marginBottom: '1.5rem' }}>
        <Lightbulb size={16} aria-hidden="true" />
        <div>
          <strong>Demo mode by default.</strong> Deterministic suggestions work with no API key and
          no network request. Optional AI enhancement only runs when you press the button below.
        </div>
      </div>

      {actionMessage && (
        <div className="alert alert-success" role="status" aria-live="polite" style={{ marginBottom: '1rem' }}>
          <CheckCircle size={16} aria-hidden="true" />
          <span>{actionMessage}</span>
        </div>
      )}

      {assumptions.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Clearly Labelled Assumptions</h2>
              <p className="card-subtitle">Missing details we did not silently invent</p>
            </div>
          </div>
          <ul className="assumption-list">
            {assumptions.map((assumption) => (
              <li key={assumption}>
                <Info size={14} aria-hidden="true" />
                <span>{assumption}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="section-grid section-grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <h2 className="card-title">Optional AI Enhancement</h2>
          <p className="card-subtitle" style={{ marginBottom: '1rem' }}>
            Explicit, opt-in request to this app&apos;s server-side AI endpoint. No contact details
            or free-form notes are sent.
          </p>
          <button
            className="btn btn-primary"
            onClick={enhanceWithAi}
            disabled={aiState === 'loading'}
            aria-describedby="ai-privacy-note"
          >
            <Sparkles size={15} aria-hidden="true" />
            {aiState === 'loading' ? 'Requesting suggestions...' : 'Enhance with optional AI'}
          </button>
          <p id="ai-privacy-note" className="text-xs text-muted" style={{ marginTop: '0.75rem' }}>
            Sends event type, date, guest count, budget summary, theme, city, priorities, and dietary
            or accessibility notes. The request fails gracefully to deterministic ideas when no
            provider is configured.
          </p>
          {aiState === 'loading' && (
            <p className="text-sm" role="status" style={{ marginTop: '0.75rem' }}>
              <span className="spinner" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
              Waiting for the optional AI service...
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">How These Ideas Were Chosen</h2>
          <ul className="reason-list">
            <li>Event type: {event.type}</li>
            <li>Guest count: {event.guestCount.toLocaleString()}</li>
            <li>Venue preference: {event.preference}</li>
            <li>Theme: {event.theme || 'not specified'}</li>
            <li>Location: {event.city || 'not specified'}</li>
            <li>Budget status: {budgetSummary?.isOverBudget ? 'over budget' : budgetSummary?.isOverContingency ? 'allocations over budget' : 'within budget'}</li>
            <li>Priorities: {event.priorities.length > 0 ? event.priorities.join(', ') : 'none selected'}</li>
          </ul>
        </div>
      </div>

      {aiMessage && (
        <div
          className={`alert ${aiState === 'error' ? 'alert-warning' : 'alert-success'}`}
          role="status"
          aria-live="polite"
          style={{ marginBottom: '1.5rem' }}
        >
          {aiState === 'error' ? (
            <AlertTriangle size={16} aria-hidden="true" />
          ) : (
            <CheckCircle size={16} aria-hidden="true" />
          )}
          <span>{aiMessage}</span>
        </div>
      )}

      {aiRecs.length > 0 && (
        <section aria-labelledby="ai-suggestions-heading" style={{ marginBottom: '2rem' }}>
          <div className="section-heading-row">
            <div>
              <h2 id="ai-suggestions-heading" className="card-title">
                AI-Generated Suggestions
              </h2>
              <p className="card-subtitle">Unverified model output  -  review before acting</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setAiRecs([])}>
              Dismiss AI ideas
            </button>
          </div>
          <div className="rec-grid">
            {aiRecs.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                currency={event.currency}
                added={addedIds.includes(recommendation.id)}
                onAdd={() => addAsTask(recommendation)}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="deterministic-heading">
        <div className="section-heading-row">
          <div>
            <h2 id="deterministic-heading" className="card-title">
              Deterministic Ideas
            </h2>
            <p className="card-subtitle">Generated locally from your event details  -  no network</p>
          </div>
          <span className="badge badge-navy">{recommendations.length} ideas</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '1rem 0' }}>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
            aria-pressed={filter === 'all'}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              className={`btn btn-sm ${filter === category ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(category)}
              aria-pressed={filter === category}
            >
              {CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="empty-state">
            <Lightbulb size={36} aria-hidden="true" />
            <h3>No ideas in this category</h3>
            <p>Try another category or refresh the ideas after editing your event details.</p>
          </div>
        ) : (
          <div className="rec-grid">
            {visible.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                currency={event.currency}
                added={addedIds.includes(recommendation.id)}
                onAdd={() => addAsTask(recommendation)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

interface RecommendationCardProps {
  recommendation: Recommendation
  currency: string
  added: boolean
  onAdd: () => void
}

function RecommendationCard({ recommendation, currency, added, onAdd }: RecommendationCardProps) {
  return (
    <article
      className={`rec-card budget-${
        recommendation.budgetImpact === 'saves'
          ? 'save'
          : recommendation.budgetImpact === 'adds'
            ? 'add'
            : 'neutral'
      }`}
    >
      <div className="rec-card-top">
        <span className="badge badge-plum">{CATEGORY_LABELS[recommendation.category]}</span>
        <span className={`badge ${recommendation.source === 'ai' ? 'badge-navy' : 'badge-gray'}`}>
          {recommendation.source === 'ai' ? 'AI-generated' : 'Generated locally'}
        </span>
      </div>
      <h3>{recommendation.title}</h3>
      <p className="text-sm" style={{ marginTop: '0.5rem' }}>{recommendation.description}</p>
      <div className="rec-reasoning">
        <strong>Why it fits:</strong> {recommendation.reasoning}
      </div>
      <div className="rec-meta">
        <span>{IMPACT_LABEL[recommendation.budgetImpact]}</span>
        {recommendation.estimatedCost !== undefined && (
          <span>Illustrative: {formatCurrency(recommendation.estimatedCost, currency)}</span>
        )}
        {recommendation.isLowCostAlternative && <span className="badge badge-success">Lower-cost option</span>}
      </div>
      {recommendation.dietaryNote && (
        <p className="rec-note"><strong>Dietary:</strong> {recommendation.dietaryNote}</p>
      )}
      {recommendation.accessibilityNote && (
        <p className="rec-note"><strong>Accessibility:</strong> {recommendation.accessibilityNote}</p>
      )}
      {recommendation.tags.length > 0 && (
        <p className="text-xs text-muted" style={{ marginTop: '0.5rem' }}>
          Tags: {recommendation.tags.join(', ')}
        </p>
      )}
      <button
        className="btn btn-secondary btn-sm"
        onClick={onAdd}
        disabled={added}
        aria-label={added ? `Already added: ${recommendation.title}` : `Add as task: ${recommendation.title}`}
        style={{ marginTop: '0.75rem' }}
      >
        {added ? <CheckCircle size={14} aria-hidden="true" /> : <ListPlus size={14} aria-hidden="true" />}
        {added ? 'Added to timeline' : 'Add as task'}
      </button>
    </article>
  )
}
