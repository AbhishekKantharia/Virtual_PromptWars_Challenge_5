import React, { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './components/pages/Dashboard'
import { EventSetup } from './components/pages/EventSetup'
import { BudgetPlanner } from './components/pages/BudgetPlanner'
import { Timeline } from './components/pages/Timeline'
import { VendorWorkspace } from './components/pages/VendorWorkspace'
import { IdeaStudio } from './components/pages/IdeaStudio'
import { SettingsPage } from './components/pages/SettingsPage'
import { Menu, X } from 'lucide-react'

export type Page = 'dashboard' | 'setup' | 'budget' | 'timeline' | 'vendors' | 'ideas' | 'settings'

function AppInner() {
  const { state } = useApp()
  const [page, setPage] = useState<Page>(state.event ? 'dashboard' : 'setup')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigate = (p: Page) => {
    setPage(p)
    setSidebarOpen(false)
  }

  return (
    <div className="app-shell">
      {/* Skip-to-content link for keyboard users */}
      <a href="#main-content" className="sr-only" style={{ position: 'fixed', top: 0, left: 0, zIndex: 999 }}>
        Skip to main content
      </a>

      {/* Mobile toggle */}
      <button
        className="mobile-nav-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={sidebarOpen}
        aria-controls="sidebar-nav"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 90 }}
        />
      )}

      <Sidebar
        id="sidebar-nav"
        currentPage={page}
        onNavigate={navigate}
        isOpen={sidebarOpen}
        hasEvent={!!state.event}
      />

      <main className="main-content" id="main-content" tabIndex={-1}>
        {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
        {page === 'setup' && <EventSetup onNavigate={navigate} />}
        {page === 'budget' && <BudgetPlanner />}
        {page === 'timeline' && <Timeline />}
        {page === 'vendors' && <VendorWorkspace />}
        {page === 'ideas' && <IdeaStudio />}
        {page === 'settings' && <SettingsPage onNavigate={navigate} />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
