import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { formatCurrency } from '../../utils/currency'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Plus, Edit2, Trash2, AlertTriangle, Info } from 'lucide-react'
import { BudgetCategory, Expense } from '../../types'
import { nanoid } from '../../utils/nanoid'

const PIE_COLORS = [
  '#8b5fb8', '#6b4a96', '#a87fd4', '#3d5fa0', '#1e3a6e',
  '#2e7d52', '#b45309', '#b91c1c', '#64748b',
]

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
  const [contingency, setContingency] = useState(budget?.contingencyPercent ?? 10)

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

  const pieData = budget.categories.map((cat) => ({
    name: cat.name,
    value: cat.plannedAmount,
  }))

  function saveCategory(catId: string) {
    const amount = parseFloat(editAmount)
    if (!isNaN(amount)) {
      dispatch({ type: 'UPDATE_CATEGORY_AMOUNT', categoryId: catId, amount })
    }
    setEditingCategory(null)
  }

  function submitExpense(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(expenseForm.amount)
    if (!expenseForm.label || isNaN(amount) || !expenseForm.categoryId) return

    if (editingExpense) {
      dispatch({
        type: 'EDIT_EXPENSE',
        expenseId: editingExpense.id,
        patch: {
          categoryId: expenseForm.categoryId,
          label: expenseForm.label,
          amount,
          isQuoted: expenseForm.isQuoted,
          notes: expenseForm.notes,
        },
      })
    } else {
      dispatch({
        type: 'ADD_EXPENSE',
        payload: {
          categoryId: expenseForm.categoryId,
          label: expenseForm.label,
          amount,
          isQuoted: expenseForm.isQuoted,
          notes: expenseForm.notes,
        },
      })
    }
    resetExpenseForm()
  }

  function resetExpenseForm() {
    setExpenseForm({ categoryId: '', label: '', amount: '', isQuoted: false, notes: '' })
    setShowExpenseForm(false)
    setEditingExpense(null)
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
              <p className="stat-label">Cost Per Guest</p>
              <p className="stat-value">{formatCurrency(budgetSummary.costPerGuest, event.currency)}</p>
              <p className="stat-sub">Based on {event.guestCount} guests</p>
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
              <p className="card-subtitle">Click edit to adjust planned amounts</p>
            </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="contingency-input" className="text-sm font-medium">
                Contingency Reserve ({contingency}%)
              </label>
              <input
                id="contingency-input"
                type="range"
                min={0}
                max={30}
                value={contingency}
                onChange={(e) => setContingency(Number(e.target.value))}
                onMouseUp={() => {
                  const updated = { ...budget, contingencyPercent: contingency, contingencyAmount: event.budget * (contingency / 100) }
                  dispatch({ type: 'SET_BUDGET_PLAN', payload: updated })
                }}
                style={{ flex: 1 }}
                aria-label={`Contingency reserve: ${contingency}%`}
              />
            </div>
            <p className="text-xs text-muted" style={{ marginTop: '4px' }}>
              Reserve: {budgetSummary ? formatCurrency(budgetSummary.contingencyAmount, event.currency) : '—'} (10% default is industry-recommended)
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: '1rem' }}>Allocation Breakdown</h2>
          <div className="chart-wrapper" aria-hidden="true">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value, event.currency)} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Text alternative for chart */}
          <div className="chart-text-alt">
            <p className="font-medium text-sm">Budget allocation summary:</p>
            <ul style={{ listStyle: 'none', marginTop: '4px' }}>
              {budget.categories.map((cat) => (
                <li key={cat.id} className="text-xs" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{cat.name}</span>
                  <span>{formatCurrency(cat.plannedAmount, event.currency)}</span>
                </li>
              ))}
            </ul>
          </div>
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
          <form onSubmit={submitExpense} style={{ background: 'var(--color-warm-gray-100)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }} aria-label="Add expense form">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required" htmlFor="expense-category">Category</label>
                <select
                  id="expense-category"
                  className="form-select"
                  value={expenseForm.categoryId}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, categoryId: e.target.value }))}
                  required
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
                  className="form-input"
                  value={expenseForm.label}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Florist deposit"
                  required
                  maxLength={120}
                />
              </div>
              <div className="form-group">
                <label className="form-label required" htmlFor="expense-amount">Amount ({event.currency})</label>
                <input
                  id="expense-amount"
                  type="number"
                  className="form-input"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  min={0}
                  step={0.01}
                  required
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
                            onClick={() => dispatch({ type: 'DELETE_EXPENSE', expenseId: expense.id })}
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
