import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { EventDetails, ValidationError } from '../../types'
import { validateEventDetails, sanitizeText, isShortNotice } from '../../engine/validation'
import { CURRENCY_OPTIONS } from '../../utils/currency'
import { format, addMonths } from 'date-fns'
import { nanoid } from '../../utils/nanoid'
import { AlertTriangle, CheckCircle, Info } from 'lucide-react'
import type { Page } from '../../App'

interface EventSetupProps {
  onNavigate: (page: Page) => void
}

const EVENT_TYPE_OPTIONS = [
  { value: 'wedding', label: '💍 Wedding' },
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'community', label: '🌟 Community Event' },
]

const PRIORITY_OPTIONS = [
  'Photography', 'Catering quality', 'Entertainment', 'Decoration',
  'Guest comfort', 'Budget savings', 'Unique experience', 'Accessibility',
]

const defaultDate = format(addMonths(new Date(), 6), 'yyyy-MM-dd')

export function EventSetup({ onNavigate }: EventSetupProps) {
  const { state, dispatch } = useApp()
  const existing = state.event

  const [form, setForm] = useState<Partial<EventDetails>>(
    existing ?? {
      name: '',
      type: 'wedding',
      date: defaultDate,
      city: '',
      guestCount: 50,
      budget: 10000,
      currency: 'USD',
      preference: 'flexible',
      theme: '',
      dietaryRequirements: '',
      accessibilityNeeds: '',
      priorities: [],
      notes: '',
    }
  )
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [submitted, setSubmitted] = useState(false)

  const isEditing = !!existing

  function fieldError(field: string) {
    return errors.find((e) => e.field === field)?.message
  }

  function handleChange(field: keyof EventDetails, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (submitted) {
      // Re-validate on change after first submission
      const result = validateEventDetails({ ...form, [field]: value })
      setErrors(result.errors)
    }
  }

  function togglePriority(p: string) {
    setForm((prev) => {
      const priorities = prev.priorities ?? []
      return {
        ...prev,
        priorities: priorities.includes(p)
          ? priorities.filter((x) => x !== p)
          : [...priorities, p],
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const result = validateEventDetails(form)
    setErrors(result.errors)
    if (!result.valid) return

    const now = new Date().toISOString()
    const eventData: EventDetails = {
      id: existing?.id ?? nanoid(),
      name: sanitizeText(form.name ?? ''),
      type: form.type!,
      date: form.date!,
      city: sanitizeText(form.city ?? ''),
      guestCount: Number(form.guestCount),
      budget: Number(form.budget),
      currency: form.currency!,
      preference: form.preference!,
      theme: sanitizeText(form.theme ?? ''),
      dietaryRequirements: sanitizeText(form.dietaryRequirements ?? ''),
      accessibilityNeeds: sanitizeText(form.accessibilityNeeds ?? ''),
      priorities: form.priorities ?? [],
      notes: sanitizeText(form.notes ?? ''),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    if (isEditing) {
      dispatch({ type: 'UPDATE_EVENT', payload: eventData })
    } else {
      dispatch({ type: 'CREATE_EVENT', payload: eventData })
    }
    onNavigate('dashboard')
  }

  const shortNotice = form.date ? isShortNotice(form.date, 30) : false
  const veryShortNotice = form.date ? isShortNotice(form.date, 7) : false

  return (
    <div className="page-content">
      <div className="page-heading">
        <h1>{isEditing ? 'Edit Event Details' : 'Create Your Event'}</h1>
        <p>Fill in your event details to generate a personalised planning workspace.</p>
      </div>

      {isEditing && (
        <div className="alert alert-info" role="note" style={{ marginBottom: '1.5rem' }}>
          <Info size={16} className="alert-icon" aria-hidden="true" />
          <div>
            <strong>Editing your event</strong> — Changing the date, type, or budget will update your timeline and budget allocations. Completed tasks and vendor data will be preserved.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate aria-label="Event creation form">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Event Basics</h2>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label required" htmlFor="event-name">Event Name</label>
              <input
                id="event-name"
                type="text"
                className={`form-input${fieldError('name') ? ' error' : ''}`}
                value={form.name ?? ''}
                onChange={(e) => handleChange('name', e.target.value)}
                maxLength={120}
                placeholder="e.g. Sarah & James's Wedding"
                aria-describedby={fieldError('name') ? 'event-name-error' : 'event-name-hint'}
                aria-required="true"
                aria-invalid={!!fieldError('name')}
              />
              {fieldError('name') ? (
                <span id="event-name-error" className="form-error" role="alert">
                  <AlertTriangle size={12} aria-hidden="true" /> {fieldError('name')}
                </span>
              ) : (
                <span id="event-name-hint" className="form-hint">2–120 characters</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="event-type">Event Type</label>
              <select
                id="event-type"
                className={`form-select${fieldError('type') ? ' error' : ''}`}
                value={form.type ?? ''}
                onChange={(e) => handleChange('type', e.target.value)}
                aria-required="true"
                aria-invalid={!!fieldError('type')}
                aria-describedby={fieldError('type') ? 'event-type-error' : undefined}
              >
                {EVENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {fieldError('type') && (
                <span id="event-type-error" className="form-error" role="alert">
                  <AlertTriangle size={12} aria-hidden="true" /> {fieldError('type')}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="event-date">Event Date</label>
              <input
                id="event-date"
                type="date"
                className={`form-input${fieldError('date') ? ' error' : ''}`}
                value={form.date ?? ''}
                onChange={(e) => handleChange('date', e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                aria-required="true"
                aria-invalid={!!fieldError('date')}
                aria-describedby="event-date-desc"
              />
              <span id="event-date-desc" className="form-hint">
                {veryShortNotice && <span className="text-danger">⚠ Very short notice — some tasks may be skipped</span>}
                {!veryShortNotice && shortNotice && <span className="text-warning">⚠ Short notice — timeline will be condensed</span>}
                {!shortNotice && 'YYYY-MM-DD format'}
              </span>
              {fieldError('date') && (
                <span className="form-error" role="alert">
                  <AlertTriangle size={12} aria-hidden="true" /> {fieldError('date')}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="event-city">City / Venue (optional)</label>
              <input
                id="event-city"
                type="text"
                className="form-input"
                value={form.city ?? ''}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="e.g. New York, NY"
                maxLength={100}
              />
            </div>
          </div>

          <div className="form-grid" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label className="form-label required" htmlFor="event-guests">Estimated Guest Count</label>
              <input
                id="event-guests"
                type="number"
                className={`form-input${fieldError('guestCount') ? ' error' : ''}`}
                value={form.guestCount ?? ''}
                onChange={(e) => handleChange('guestCount', parseInt(e.target.value) || 0)}
                min={1}
                max={50000}
                aria-required="true"
                aria-invalid={!!fieldError('guestCount')}
              />
              {fieldError('guestCount') && (
                <span className="form-error" role="alert">
                  <AlertTriangle size={12} aria-hidden="true" /> {fieldError('guestCount')}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="event-preference">Venue Preference</label>
              <select
                id="event-preference"
                className="form-select"
                value={form.preference ?? 'flexible'}
                onChange={(e) => handleChange('preference', e.target.value)}
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="event-budget">Total Budget</label>
              <input
                id="event-budget"
                type="number"
                className={`form-input${fieldError('budget') ? ' error' : ''}`}
                value={form.budget ?? ''}
                onChange={(e) => handleChange('budget', parseFloat(e.target.value) || 0)}
                min={0}
                step={100}
                aria-required="true"
                aria-invalid={!!fieldError('budget')}
              />
              {fieldError('budget') && (
                <span className="form-error" role="alert">
                  <AlertTriangle size={12} aria-hidden="true" /> {fieldError('budget')}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label required" htmlFor="event-currency">Currency</label>
              <select
                id="event-currency"
                className="form-select"
                value={form.currency ?? 'USD'}
                onChange={(e) => handleChange('currency', e.target.value)}
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Style & Preferences */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Style & Preferences</h2>
              <p className="card-subtitle">Help us personalise your recommendations</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor="event-theme">Preferred Theme or Style</label>
              <input
                id="event-theme"
                type="text"
                className="form-input"
                value={form.theme ?? ''}
                onChange={(e) => handleChange('theme', e.target.value)}
                placeholder="e.g. Rustic garden, Modern minimalist, Tropical fiesta"
                maxLength={200}
              />
              <span className="form-hint">Optional — helps generate targeted suggestions</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="event-dietary">Dietary Requirements</label>
              <textarea
                id="event-dietary"
                className="form-textarea"
                value={form.dietaryRequirements ?? ''}
                onChange={(e) => handleChange('dietaryRequirements', e.target.value)}
                placeholder="e.g. Vegan options needed, gluten-free for 10 guests, nut allergy"
                maxLength={500}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="event-accessibility">Accessibility Needs</label>
              <textarea
                id="event-accessibility"
                className="form-textarea"
                value={form.accessibilityNeeds ?? ''}
                onChange={(e) => handleChange('accessibilityNeeds', e.target.value)}
                placeholder="e.g. Wheelchair access required, hearing loop, step-free entry"
                maxLength={500}
                rows={3}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <fieldset>
              <legend className="form-label">Planning Priorities (select all that apply)</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {PRIORITY_OPTIONS.map((p) => {
                  const checked = (form.priorities ?? []).includes(p)
                  return (
                    <label
                      key={p}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '999px',
                        border: `1px solid ${checked ? 'var(--color-plum-400)' : 'var(--color-warm-gray-200)'}`,
                        background: checked ? 'var(--color-plum-50)' : '#fff',
                        color: checked ? 'var(--color-plum-700)' : 'var(--color-warm-gray-600)',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: checked ? 500 : 400,
                        transition: 'all 150ms ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePriority(p)}
                        className="sr-only"
                      />
                      {checked && <CheckCircle size={12} aria-hidden="true" />}
                      {p}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="form-label" htmlFor="event-notes">Notes & Special Requests</label>
            <textarea
              id="event-notes"
              className="form-textarea"
              value={form.notes ?? ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Anything else we should know — cultural traditions, surprises, specific requests"
              maxLength={1000}
              rows={3}
            />
          </div>
        </div>

        {/* Error summary */}
        {submitted && errors.length > 0 && (
          <div
            className="alert alert-danger"
            role="alert"
            aria-live="polite"
            style={{ marginTop: '1.5rem' }}
          >
            <AlertTriangle size={16} className="alert-icon" aria-hidden="true" />
            <div>
              <strong>Please fix the following errors:</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
                {errors.map((e) => (
                  <li key={e.field}>{e.message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          {isEditing && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onNavigate('dashboard')}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-lg">
            {isEditing ? 'Save Changes' : 'Create Event & Start Planning'}
          </button>
        </div>

        <p className="text-xs text-muted" style={{ marginTop: '1rem', textAlign: 'right' }}>
          <Info size={12} aria-hidden="true" style={{ display: 'inline', marginRight: '4px' }} />
          Your data is stored only in this browser. See Settings for export and privacy info.
        </p>
      </form>
    </div>
  )
}
