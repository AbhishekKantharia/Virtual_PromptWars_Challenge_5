import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { formatCurrency } from '../../utils/currency'
import { Plus, Edit2, Trash2, AlertTriangle, Info, RefreshCw } from 'lucide-react'
import { BudgetCategory, Expense } from '../../types'
import { sanitizeText, parseMoney } from '../../engine/validation'
import { ConfirmDialog } from '../common/ConfirmDialog'

export function BudgetPlanner() {
  const { state, dispatch, budgetSummary } = useApp()
  const { event, budget } = state

  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    categoryId: '',
    label: '',
    amount: '',
    isQuoted: false,
    notes: '',
  })
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [expenseError, setExpenseError] = useState<{ field: string; message: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [confirmReallocate, setConfirmReallocate] = useState(false)

  if (!event || !budget) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <AlertTriangle size={40} aria-hidden="true" />
          <h2>No event yet</h2>
          <p>Create an event first to access the budget planner.</p>
        </div>
      </div>
    )
  }

  function saveCategory(catId: string) {
    const amount = parseMoney(editAmount)
    if (amount === null) {
      setEditingCategory(null)
      return
    }
    dispatch({ type: 'UPDATE_CATEGORY_AMOUNT', categoryId: catId, amount })
    setEditingCategory(null)
  }

  function submitExpense(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseMoney(expenseForm.amount)
    const label = sanitizeText(expenseForm.label).slice(0, 120)
    const notes = sanitizeText(expenseForm.notes).slice(0, 200)

    if (!expenseForm.categoryId) {
      setExpenseError({
        field: 'categoryId',
        message: 'Choose a budget category before saving this expense.',
      })
      return
    }
    if (label.length < 2) {
      setExpenseError({
        field: 'label',
        message: 'Enter a description of at least 2 characters.',
      })
      return
    }
    if (amount === null || amount <= 0) {
      setExpenseError({ field: 'amount', message: 'Enter an amount greater than zero.' })
      return
    }

    if (editingExpense) {
      dispatch({
        type: 'EDIT_EXPENSE',
        expenseId: editingExpense.id,
        patch: {
          categoryId: expenseForm.categoryId,
          label,
          amount,
          isQuoted: expenseForm.isQuoted,
          notes,
        },
      })
    } else {
      dispatch({
        type: 'ADD_EXPENSE',
        payload: {
          categoryId: expenseForm.categoryId,
          label,
          amount,
          isQuoted: expenseForm.isQuoted,
          notes,
        },
      })
    }
    setExpenseError(null)
    resetExpenseForm()
  }

  function resetExpenseForm() {
    setExpenseForm({ categoryId: '', label: '', amount: '', isQuoted: false, notes: '' })
    setShowExpenseForm(false)
    setEditingExpense(null)
    setExpenseError(null)
  }

  function startEditExpense(expense: Expense) {
    setEditingExpense(expense)
    setExpenseForm({
      categoryId: expense.categoryId,
      label: expense.label,
      amount: String(expense.amount),
      isQuoted: expense.isQuoted,
      notes: expense.notes,
    })
    setShowExpenseForm(true)
  }

  return (
    <div className="page-content">
      <div className="page-heading">
        <h1>Budget Planner</h1>
        <p>Allocate and track spending across event categories. All estimates are illustrative — not verified vendor quotes.</p>
      </div>

      {/* Budget summary */}
      {budgetSummary && (
        <>
          {budgetSummary.isOverBudget && (
            <div className="alert alert-danger" role="alert" style={{ marginBottom: '1rem' }}>
              <AlertTriangle size={16} aria-hidden="true" />
              <div>
                <strong>Over budget</strong> — Actual spending ({formatCurrency(budgetSummary.totalActual, event.currency)}) exceeds total budget ({formatCurrency(budgetSummary.totalBudget, event.currency)}).
              </div>
            </div>
          )}
          {!budgetSummary.isOverBudget && budgetSummary.isOverContingency && (
            <div className="alert alert-warning" role="alert" style={{ marginBottom: '1rem' }}>
              <AlertTriangle size={16} aria-hidden="true" />
              <div>Planned spend plus contingency exceeds budget. Consider adjusting allocations.</div>
            </div>
          )}

          <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="stat-card accent">
              <p className="stat-label">Total Budget</p>
              <p className="stat-value">{formatCurrency(budgetSummary.totalBudget, event.currency)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Total Planned</p>
              <p className="stat-value">{formatCurrency(budgetSummary.totalPlanned, event.currency)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Actual Spent</p>
              <p className={`stat-value ${budgetSummary.isOverBudget ? 'text-danger' : ''}`}>
                {formatCurrency(budgetSummary.totalActual, event.currency)}
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Actual Cost Per Guest</p>
              <p className="stat-value">{formatCurrency(budgetSummary.costPerGuest, event.currency)}</p>
              <p className="stat-sub">
                Planned {formatCurrency(budgetSummary.plannedCostPerGuest, event.currency)} ·{' '}
                {event.guestCount} guests
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Contingency ({budget.contingencyPercent}%)</p>
              <p className="stat-value">{formatCurrency(budgetSummary.contingencyAmount, event.currency)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Remaining</p>
              <p className={`stat-value ${budgetSummary.remainingAfterContingency < 0 ? 'text-danger' : 'text-success'}`}>
                {formatCurrency(budgetSummary.remainingAfterContingency, event.currency)}
              </p>
              <p className="stat-sub">After contingency</p>
            </div>
          </div>
        </>
      )}

      <div className="section-grid section-grid-2">
        {/* Category allocations */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Category Allocations</h2>
              <p className="card-subtitle">
                Click edit to adjust planned amounts. Recalculate applies your event type and
                planning priorities without changing recorded expenses.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setConfirmReallocate(true)}
            >
              <RefreshCw size={14} aria-hidden="true" /> Recalculate from priorities
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {budget.categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                currency={event.currency}
                isEditing={editingCategory === cat.id}
                editAmount={editAmount}
                onEdit={() => { setEditingCategory(cat.id); setEditAmount(String(cat.plannedAmount)) }}
                onSave={() => saveCategory(cat.id)}
                onCancel={() => setEditingCategory(null)}
                onAmountChange={setEditAmount}
              />
            ))}
          </div>

          {/* Contingency */}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-warm-gray-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label htmlFor="contingency-input" className="text-sm font-medium">
                Contingency Reserve ({budget.contingencyPercent}%)
              </label>
              <input
                id="contingency-input"
                type="range"
                min={0}
                max={30}
                step={1}
                value={budget.contingencyPercent}
                onChange={(e) =>
                  dispatch({ type: 'SET_CONTINGENCY', percent: Number(e.target.value) })
                }
                style={{ flex: 1 }}
                aria-describedby="contingency-help"
              />
            </div>
            <p id="contingency-help" className="text-xs text-muted" style={{ marginTop: '4px' }}>
              Reserve: {budgetSummary ? formatCurrency(budgetSummary.contingencyAmount, event.currency) : '—'}.
              Changing the reserve rescales planned category amounts so planned plus reserve stays
              within your total budget. 10% is the default starting point.
            </p>
          </div>
        </div>

        {/* Accessible allocation chart */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>Allocation Breakdown</h2>
          <p className="card-subtitle" style={{ marginBottom: '1rem' }}>
            Share of planned categories. Values are visible as text, not colour alone.
          </p>
          {budgetSummary && budgetSummary.totalPlanned > 0 ? (
            <ul className="allocation-chart" aria-label="Planned budget allocation by category">
              {budget.categories.map((cat) => {
                const percentage = (cat.plannedAmount / budgetSummary.totalPlanned) * 100
                return (
                  <li key={cat.id} className="allocation-row">
                    <span className="allocation-label">{cat.name}</span>
                    <span className="allocation-track" aria-hidden="true">
                      <span
                        className="allocation-fill"
                        style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                      />
                    </span>
                    <span className="allocation-value">
                      {formatCurrency(cat.plannedAmount, event.currency)} ({percentage.toFixed(0)}%)
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">Set category allocations to see the breakdown.</p>
          )}
          <p className="text-xs text-muted" style={{ marginTop: '1rem' }}>
            Illustrative allocations only. Confirm real prices with vendors.
          </p>
        </div>
      </div>

      {/* Expenses */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Expenses</h2>
            <p className="card-subtitle">Track actual costs. Quoted items are vendor-provided; others are estimates.</p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setShowExpenseForm(true); setExpenseForm((f) => ({ ...f, categoryId: budget.categories[0]?.id ?? '' })) }}
          >
            <Plus size={14} aria-hidden="true" /> Add Expense
          </button>
        </div>

        {showExpenseForm && (
          <form
            onSubmit={submitExpense}
            style={{ background: 'var(--color-warm-gray-100)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}
            aria-label={editingExpense ? 'Edit expense form' : 'Add expense form'}
            noValidate
          >
            {expenseError && (
              <div
                id="expense-form-error"
                className="alert alert-danger"
                role="alert"
                style={{ marginBottom: '1rem' }}
              >
                <AlertTriangle size={14} aria-hidden="true" />
                <span>{expenseError.message}</span>
              </div>
            )}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="expense-category">Category</label>
                <select
                  id="expense-category"
                  className={`form-select${expenseError?.field === 'categoryId' ? ' error' : ''}`}
                  value={expenseForm.categoryId}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, categoryId: e.target.value }))}
                  required
                  aria-invalid={expenseError?.field === 'categoryId'}
                  aria-describedby={
                    expenseError?.field === 'categoryId' ? 'expense-form-error' : undefined
                  }
                >
                  <option value="">Select category…</option>
                  {budget.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="expense-label">Description</label>
                <input
                  id="expense-label"
                  type="text"
                  className={`form-input${expenseError?.field === 'label' ? ' error' : ''}`}
                  value={expenseForm.label}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Florist deposit"
                  required
                  maxLength={120}
                  aria-invalid={expenseError?.field === 'label'}
                  aria-describedby={
                    expenseError?.field === 'label' ? 'expense-form-error' : undefined
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="expense-amount">Amount ({event.currency})</label>
                <input
                  id="expense-amount"
                  type="number"
                  className={`form-input${expenseError?.field === 'amount' ? ' error' : ''}`}
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  min={0}
                  step={0.01}
                  required
                  aria-invalid={expenseError?.field === 'amount'}
                  aria-describedby={
                    expenseError?.field === 'amount' ? 'expense-form-error' : undefined
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="expense-notes">Notes</label>
                <input
                  id="expense-notes"
                  type="text"
                  className="form-input"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                  maxLength={200}
                />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', marginTop: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={expenseForm.isQuoted}
                onChange={(e) => setExpenseForm((f) => ({ ...f, isQuoted: e.target.checked }))}
              />
              Vendor-quoted amount (not just an estimate)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                {editingExpense ? 'Save Changes' : 'Add Expense'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={resetExpenseForm}>Cancel</button>
            </div>
          </form>
        )}

        {budget.expenses.length === 0 ? (
          <p className="text-sm text-muted">No expenses recorded yet. Add your first expense above.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" aria-label="Expenses list">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {budget.expenses.map((expense) => {
                  const cat = budget.categories.find((c) => c.id === expense.categoryId)
                  return (
                    <tr key={expense.id}>
                      <td>{cat?.name ?? 'Unknown'}</td>
                      <td>{expense.label}</td>
                      <td>{formatCurrency(expense.amount, event.currency)}</td>
                      <td>
                        <span className={`badge ${expense.isQuoted ? 'badge-success' : 'badge-gray'}`}>
                          {expense.isQuoted ? 'Quoted' : 'Estimate'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => startEditExpense(expense)}
                            aria-label={`Edit expense: ${expense.label}`}
                          >
                            <Edit2 size={13} aria-hidden="true" />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => setDeleteTarget(expense)}
                            aria-label={`Delete expense: ${expense.label}`}
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="alert alert-info" style={{ marginTop: '1rem' }} role="note">
          <Info size={14} aria-hidden="true" />
          <span>All cost estimates are illustrative and should be verified with actual vendors. EventWise AI does not verify vendor pricing.</span>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReallocate}
        title="Recalculate category allocations?"
        description="This replaces the current planned category amounts with defaults based on your event type and planning priorities. Recorded expenses, actual spending, category links, and the contingency percentage stay unchanged."
        confirmLabel="Recalculate allocations"
        onConfirm={() => {
          dispatch({ type: 'REALLOCATE_BUDGET' })
          setConfirmReallocate(false)
        }}
        onCancel={() => setConfirmReallocate(false)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this expense?"
        description={
          deleteTarget
            ? `This removes "${deleteTarget.label}" (${formatCurrency(deleteTarget.amount, event.currency)}) from the budget. Category actual totals will be recalculated. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete expense"
        onConfirm={() => {
          if (deleteTarget) {
            dispatch({ type: 'DELETE_EXPENSE', expenseId: deleteTarget.id })
          }
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

interface CategoryRowProps {
  cat: BudgetCategory
  currency: string
  isEditing: boolean
  editAmount: string
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onAmountChange: (v: string) => void
}

function CategoryRow({ cat, currency, isEditing, editAmount, onEdit, onSave, onCancel, onAmountChange }: CategoryRowProps) {
  const pctUsed = cat.plannedAmount > 0 ? Math.min(100, (cat.actualAmount / cat.plannedAmount) * 100) : 0
  const overSpent = cat.actualAmount > cat.plannedAmount

  return (
    <div style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-warm-gray-100)', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <p className="text-sm font-medium">{cat.name}</p>
          <p className="text-xs text-muted">{cat.description}</p>
        </div>
        {isEditing ? (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="number"
              className="form-input"
              style={{ width: '120px' }}
              value={editAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              min={0}
              aria-label={`Planned amount for ${cat.name}`}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
            />
            <button className="btn btn-primary btn-sm" onClick={onSave}>Save</button>
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <p className="text-sm font-medium">{formatCurrency(cat.actualAmount, currency)}</p>
              <p className="text-xs text-muted">of {formatCurrency(cat.plannedAmount, currency)}</p>
            </div>
            <button
              className="btn btn-ghost btn-icon btn-sm"
              onClick={onEdit}
              aria-label={`Edit planned amount for ${cat.name}`}
            >
              <Edit2 size={13} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {!isEditing && (
        <div style={{ marginTop: '6px' }}>
          <div className="progress-bar-container">
            <div
              className={`progress-bar-fill ${overSpent ? 'danger' : pctUsed >= 80 ? 'warning' : ''}`}
              style={{ width: `${Math.min(100, pctUsed)}%` }}
              role="progressbar"
              aria-valuenow={Math.round(pctUsed)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${cat.name}: ${Math.round(pctUsed)}% of planned budget used`}
            />
          </div>
          {overSpent && (
            <p className="text-xs text-danger" style={{ marginTop: '2px' }}>
              Over by {formatCurrency(cat.actualAmount - cat.plannedAmount, currency)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
