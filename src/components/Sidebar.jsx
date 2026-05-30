import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { Home, CheckSquare, ListTodo, Apple, Mail, TrendingUp, FolderKanban, Wallet, Sun, Moon } from 'lucide-react'
import { applyTheme, getInitialTheme } from '../theme'

const NAV_ITEMS = [
  { to: '/', label: 'Ana Sayfa', icon: Home, end: true },
  { to: '/habits', label: 'Alışkanlıklar', icon: CheckSquare },
  { to: '/tasks', label: 'Görevler', icon: ListTodo },
  { to: '/calories', label: 'Kalori', icon: Apple },
  { to: '/mail', label: 'Mail Özeti', icon: Mail },
  { to: '/stocks', label: 'Borsa', icon: TrendingUp },
  { to: '/projects', label: 'Projeler', icon: FolderKanban },
  { to: '/finance', label: 'Finans', icon: Wallet },
]

function Sidebar() {
  const [theme, setTheme] = useState(getInitialTheme())

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  return (
    <nav style={{
      width: '232px',
      minHeight: '100vh',
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)',
      padding: '28px 16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      position: 'sticky',
      top: 0,
      alignSelf: 'flex-start'
    }}>
      {/* Logo / brand */}
      <div style={{
        padding: '0 8px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: '700', fontSize: '14px',
          fontFamily: 'system-ui'
        }}>F</div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', lineHeight: '1.2' }}>
            Dashboard
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-faint)', lineHeight: '1.2', marginTop: '2px' }}>
            Furkan
          </div>
        </div>
      </div>

      {/* Section label */}
      <div style={{
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: 'var(--text-faded)',
        padding: '0 12px 8px',
        fontWeight: '600'
      }}>
        Menü
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          padding: '9px 12px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '13.5px',
          fontWeight: isActive ? '600' : '500',
          color: isActive ? 'var(--text)' : 'var(--text-dim)',
          background: isActive ? 'var(--bg-item)' : 'transparent',
          transition: 'background 0.15s, color 0.15s'
        })}>
          {({ isActive }) => (
            <>
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}

      {/* Theme toggle */}
      <button onClick={toggleTheme} style={{
        marginTop: 'auto',
        padding: '9px 12px',
        borderRadius: '8px',
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
        fontSize: '13px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: '500',
        transition: 'background 0.15s'
      }}>
        {theme === 'dark' ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
        {theme === 'dark' ? 'Aydınlık' : 'Karanlık'}
      </button>
    </nav>
  )
}

export default Sidebar