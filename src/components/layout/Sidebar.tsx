import React from 'react'
import { Page } from '../../App'
import {
  LayoutDashboard, CalendarDays, DollarSign, CheckSquare,
  Users, Lightbulb, Settings, Star
} from 'lucide-react'

interface SidebarProps {
  id: string
  currentPage: Page
  onNavigate: (page: Page) => void
  isOpen: boolean
  hasEvent: boolean
}

const NAV_ITEMS: { page: Page; label: string; icon: React.ReactNode; requiresEvent?: boolean }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { page: 'setup', label: 'Event Setup', icon: <CalendarDays size={16} /> },
  { page: 'budget', label: 'Budget Planner', icon: <DollarSign size={16} />, requiresEvent: true },
  { page: 'timeline', label: 'Timeline', icon: <CheckSquare size={16} />, requiresEvent: true },
  { page: 'vendors', label: 'Vendors', icon: <Users size={16} />, requiresEvent: true },
  { page: 'ideas', label: 'AI Idea Studio', icon: <Lightbulb size={16} />, requiresEvent: true },
  { page: 'settings', label: 'Settings', icon: <Settings size={16} /> },
]

export function Sidebar({ id, currentPage, onNavigate, isOpen, hasEvent }: SidebarProps) {
  return (
    <nav
      id={id}
      className={`sidebar${isOpen ? ' open' : ''}`}
      aria-label="Main navigation"
    >
      <div className="sidebar-logo" aria-label="EventWise AI">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Star size={20} style={{ color: '#a87fd4' }} aria-hidden="true" />
          <h1>EventWise AI</h1>
        </div>
        <p className="logo-sub">Intelligent Celebration Planner</p>
      </div>

      <div className="sidebar-nav">
        <ul style={{ listStyle: 'none' }}>
          {NAV_ITEMS.map(({ page, label, icon, requiresEvent }) => {
            const disabled = requiresEvent && !hasEvent
            return (
              <li key={page}>
                <button
                  className={`nav-item${currentPage === page ? ' active' : ''}`}
                  onClick={() => !disabled && onNavigate(page)}
                  aria-current={currentPage === page ? 'page' : undefined}
                  disabled={disabled}
                  title={disabled ? 'Create an event first' : undefined}
                  style={{ opacity: disabled ? 0.4 : 1 }}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="sidebar-footer">
        <p>Demo mode  -  data stored locally</p>
        <p style={{ marginTop: '4px' }}>Not synced across devices</p>
      </div>
    </nav>
  )
}
