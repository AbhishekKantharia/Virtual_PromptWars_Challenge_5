import { useEffect, useRef, useState } from 'react'
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
  const mainRef = useRef<HTMLElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const restoreSidebarFocus = useRef(true)
  const firstRender = useRef(true)

  const navigate = (p: Page) => {
    if (p !== page) {
      setPage(p)
      restoreSidebarFocus.current = false
    }
    setSidebarOpen(false)
  }

  useEffect(() => {
    if (!sidebarOpen) return

    const sidebar = sidebarRef.current
    const toggle = toggleRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const getFocusable = () =>
      sidebar
        ? Array.from(
            sidebar.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          )
        : []

    getFocusable()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSidebarOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (!sidebar?.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (restoreSidebarFocus.current && toggle && document.contains(toggle)) {
        toggle.focus()
      }
      restoreSidebarFocus.current = true
    }
  }, [sidebarOpen])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus()
  }, [page])

  return (
    <div className="app-shell">
      {/* Skip-to-content link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Mobile toggle */}
      <button
        ref={toggleRef}
        className="mobile-nav-toggle"
        onClick={() => setSidebarOpen((open) => !open)}
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
        navRef={sidebarRef}
        currentPage={page}
        onNavigate={navigate}
        isOpen={sidebarOpen}
        hasEvent={!!state.event}
      />

      <main className="main-content" id="main-content" tabIndex={-1} ref={mainRef}>
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
