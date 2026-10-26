import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { Vendor, VendorStatus } from '../../types'
import { VENDOR_CATEGORIES } from '../../engine/vendors'
import { formatCurrency } from '../../utils/currency'
import { Plus, Edit2, Trash2, AlertTriangle, ExternalLink } from 'lucide-react'

const STATUS_OPTIONS: { value: VendorStatus; label: string }[] = [
  { value: 'researching', label: 'Researching' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'booked', label: 'Booked' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_BADGE: Record<VendorStatus, string> = {
  researching: 'badge-gray',
  contacted: 'badge-navy',
  quoted: 'badge-plum',
  booked: 'badge-success',
  cancelled: 'badge-danger',
}

const emptyVendor: Omit<Vendor, 'id' | 'createdAt' | 'isSampleData'> = {
  name: '',
  category: VENDOR_CATEGORIES[0],
  estimatedCost: 0,
  quotedCost: undefined,
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  status: 'researching',
  notes: '',
  cancellationTerms: '',
  accessibilityInfo: '',
}

export function VendorWorkspace() {
  const { state, dispatch } = useApp()
  const { event, vendors } = state
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<VendorStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [form, setForm] = useState<Omit<Vendor, 'id' | 'createdAt' | 'isSampleData'>>(emptyVendor)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const categories = useMemo(() => {
    const used = new Set(vendors.map((v) => v.category))
    return ['all', ...Array.from(used).sort()]
  }, [vendors])

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false
      if (statusFilter !== 'all' && v.status !== statusFilter) return false
      return true
    })
  }, [vendors, categoryFilter, statusFilter])

  if (!event) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <AlertTriangle size={40} aria-hidden="true" />
          <h2>No event yet</h2>
          <p>Create an event first to manage vendors.</p>
        </div>
      </div>
    )
  }

  function startEdit(vendor: Vendor) {
    setEditingVendor(vendor)
    setForm({
      name: vendor.name,
      category: vendor.category,
      estimatedCost: vendor.estimatedCost,
      quotedCost: vendor.quotedCost,
      contactName: vendor.contactName,
      contactEmail: vendor.contactEmail,
      contactPhone: vendor.contactPhone,
      status: vendor.status,
      notes: vendor.notes,
      cancellationTerms: vendor.cancellationTerms,
      accessibilityInfo: vendor.accessibilityInfo,
    })
    setShowForm(true)
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) return
    if (editingVendor) {
      dispatch({ type: 'EDIT_VENDOR', vendorId: editingVendor.id, patch: form })
    } else {
      dispatch({ type: 'ADD_VENDOR', payload: form })
    }
    resetForm()
  }

  function resetForm() {
    setShowForm(false)
    setEditingVendor(null)
    setForm(emptyVendor)
  }

  function handleDelete(id: string) {
    dispatch({ type: 'DELETE_VENDOR', vendorId: id })
    setConfirmDelete(null)
  }

  const bookedTotal = vendors.filter(v => v.status === 'booked').reduce((s, v) => s + (v.quotedCost ?? v.estimatedCost), 0)

  return (
    <div className="page-content">
      <div className="page-heading">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1>Vendor Workspace</h1>
            <p>{vendors.filter(v => v.status === 'booked').length} booked · {formatCurrency(bookedTotal, event.currency)} committed</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setForm(emptyVendor) }}>
            <Plus size={15} aria-hidden="true" /> Add Vendor
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`btn btn-sm ${categoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCategoryFilter(cat)}
            aria-pressed={categoryFilter === cat}
          >
            {cat === 'all' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--color-plum-200)' }}>
          <h2 className="card-title" style={{ marginBottom: '1rem' }}>
            {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
          </h2>
          {editingVendor?.isSampleData && (
            <div className="alert alert-warning" style={{ marginBottom: '1rem' }} role="note">
              <AlertTriangle size={14} aria-hidden="true" />
              <span>This is a sample vendor. Replace with your real vendor details.</span>
            </div>
          )}
          <form onSubmit={submitForm} aria-label={editingVendor ? 'Edit vendor form' : 'Add vendor form'}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="vendor-name">Vendor Name</label>
                <input
                  id="vendor-name"
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  maxLength={120}
                />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="vendor-category">Category</label>
                <select
                  id="vendor-category"
                  className="form-select"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {VENDOR_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="vendor-est-cost">Estimated Cost ({event.currency})</label>
                <input
                  id="vendor-est-cost"
                  type="number"
                  className="form-input"
                  value={form.estimatedCost}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedCost: parseFloat(e.target.value) || 0 }))}
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="vendor-quoted-cost">Quoted Cost ({event.currency})</label>
                <input
                  id="vendor-quoted-cost"
                  type="number"
                  className="form-input"
                  value={form.quotedCost ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, quotedCost: e.target.value ? parseFloat(e.target.value) : undefined }))}
                  min={0}
                  step={0.01}
                  placeholder="Actual vendor quote"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="vendor-status">Status</label>
                <select
                  id="vendor-status"
                  className="form-select"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as VendorStatus }))}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="vendor-contact-name">Contact Name</label>
                <input
                  id="vendor-contact-name"
                  type="text"
                  className="form-input"
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  maxLength={80}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="vendor-contact-email">Contact Email</label>
                <input
                  id="vendor-contact-email"
                  type="email"
                  className="form-input"
                  value={form.contactEmail}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  maxLength={150}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="vendor-contact-phone">Contact Phone</label>
                <input
                  id="vendor-contact-phone"
                  type="tel"
                  className="form-input"
                  value={form.contactPhone}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  maxLength={30}
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="vendor-cancellation">Cancellation Terms</label>
                <input
                  id="vendor-cancellation"
                  type="text"
                  className="form-input"
                  value={form.cancellationTerms}
                  onChange={(e) => setForm((f) => ({ ...f, cancellationTerms: e.target.value }))}
                  maxLength={300}
                  placeholder="e.g. 30-day notice for full refund"
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="vendor-accessibility">Accessibility Info</label>
                <input
                  id="vendor-accessibility"
                  type="text"
                  className="form-input"
                  value={form.accessibilityInfo}
                  onChange={(e) => setForm((f) => ({ ...f, accessibilityInfo: e.target.value }))}
                  maxLength={300}
                  placeholder="e.g. Wheelchair accessible, hearing loop"
                />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" htmlFor="vendor-notes">Notes</label>
                <textarea
                  id="vendor-notes"
                  className="form-textarea"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  maxLength={500}
                  rows={2}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary btn-sm">{editingVendor ? 'Save' : 'Add Vendor'}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Vendor grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No vendors found</h3>
          <p>Add your first vendor or adjust your filters.</p>
        </div>
      ) : (
        <div className="vendor-grid">
          {filtered.map((vendor) => (
            <article key={vendor.id} className="vendor-card" aria-label={`Vendor: ${vendor.name}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>{vendor.name}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '4px' }}>
                    <span className="badge badge-gray">{vendor.category}</span>
                    <span className={`badge ${STATUS_BADGE[vendor.status]}`}>{vendor.status}</span>
                    {vendor.isSampleData && <span className="sample-label" title="This is sample demonstration data">⚠ Sample</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => startEdit(vendor)}
                    aria-label={`Edit vendor: ${vendor.name}`}
                  >
                    <Edit2 size={13} aria-hidden="true" />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setConfirmDelete(vendor.id)}
                    aria-label={`Delete vendor: ${vendor.name}`}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Costs */}
              <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <p className="text-xs text-muted">Estimated</p>
                  <p className="text-sm font-medium">{formatCurrency(vendor.estimatedCost, event.currency)}</p>
                </div>
                {vendor.quotedCost !== undefined && (
                  <div>
                    <p className="text-xs text-muted">Quoted</p>
                    <p className="text-sm font-medium text-success">{formatCurrency(vendor.quotedCost, event.currency)}</p>
                  </div>
                )}
              </div>

              {/* Contact */}
              {(vendor.contactName || vendor.contactEmail) && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-warm-gray-600)' }}>
                  {vendor.contactName && <p>{vendor.contactName}</p>}
                  {vendor.contactEmail && (
                    <a href={`mailto:${vendor.contactEmail}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {vendor.contactEmail} <ExternalLink size={10} aria-hidden="true" />
                    </a>
                  )}
                  {vendor.contactPhone && <p>{vendor.contactPhone}</p>}
                </div>
              )}

              {/* Accessibility */}
              {vendor.accessibilityInfo && (
                <p className="text-xs" style={{ marginTop: '0.5rem', color: 'var(--color-navy-500)' }}>
                  ♿ {vendor.accessibilityInfo}
                </p>
              )}

              {/* Notes */}
              {vendor.notes && (
                <p className="text-xs text-muted" style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
                  {vendor.notes}
                </p>
              )}

              {/* Confirm delete dialog */}
              {confirmDelete === vendor.id && (
                <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-label" style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--color-danger-bg)', borderRadius: '6px', border: '1px solid #fca5a5' }}>
                  <p id="confirm-delete-label" className="text-sm font-medium text-danger">Remove this vendor?</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(vendor.id)}>Remove</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
