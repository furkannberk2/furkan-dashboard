import { useAuth } from './AuthProvider'
import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Home, CheckSquare, ListTodo, Apple, Mail, TrendingUp, FolderKanban, Wallet, Sun, Moon, MoreHorizontal, X } from 'lucide-react'
import { applyTheme, getInitialTheme } from '../theme'

const ALL_ITEMS = [
  { to: '/', label: 'Ana Sayfa', icon: Home, end: true },
  { to: '/tasks', label: 'Görevler', icon: ListTodo },
  { to: '/habits', label: 'Alışkanlıklar', icon: CheckSquare },
  { to: '/finance', label: 'Finans', icon: Wallet },
  { to: '/calories', label: 'Kalori', icon: Apple },
  { to: '/stocks', label: 'Borsa', icon: TrendingUp },
  { to: '/mail', label: 'Mail Özeti', icon: Mail },
  { to: '/projects', label: 'Projeler', icon: FolderKanban },
]

// Bottom nav: ilk 4 + Daha
const BOTTOM_ITEMS = ALL_ITEMS.slice(0, 4)
const EXTRA_ITEMS = ALL_ITEMS.slice(4)

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    function handle() { setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])
  return isMobile
}

function Sidebar() {
  const { signOut } = useAuth()
  const [theme, setTheme] = useState(getInitialTheme())
  const [moreOpen, setMoreOpen] = useState(false)
  const isMobile = useIsMobile()


  
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  if (isMobile) {
    return (
      <>
        {/* Bottom Navigation */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--bg-card)', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-around', alignItems: 'stretch',
          padding: '6px 4px 10px', zIndex: 50
        }}>
          {BOTTOM_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '3px', padding: '6px 4px', textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-dim)',
              fontSize: '10.5px', fontWeight: '500'
            })}>
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)} style={{
            flex: 1, background: 'transparent', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
            padding: '6px 4px', color: 'var(--text-dim)', fontSize: '10.5px',
            fontWeight: '500', cursor: 'pointer'
          }}>
            <MoreHorizontal size={20} strokeWidth={1.8} />
            <span>Daha</span>
          </button>
        </nav>

        {/* "Daha" sheet */}
        {moreOpen && (
          <div onClick={() => setMoreOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
            display: 'flex', alignItems: 'flex-end'
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: '100%', background: 'var(--bg-card)',
              borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
              padding: '20px 16px 28px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>Daha fazla</div>
                <button onClick={() => setMoreOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                {EXTRA_ITEMS.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end} onClick={() => setMoreOpen(false)} style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', borderRadius: '10px',
                    background: isActive ? 'var(--bg-item)' : 'var(--bg-item)',
                    border: '1px solid var(--border)',
                    textDecoration: 'none', fontSize: '13.5px',
                    fontWeight: isActive ? '600' : '500',
                    color: isActive ? 'var(--text)' : 'var(--text-secondary)'
                  })}>
                    {({ isActive }) => (
                      <>
                        <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                        <span>{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>

              <button onClick={toggleTheme} style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: '13.5px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                fontWeight: '500'
              }}>
                {theme === 'dark' ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
                {theme === 'dark' ? 'Aydınlık tema' : 'Karanlık tema'}
              </button>
              <button onClick={() => { signOut(); setMoreOpen(false) }} style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--danger)', fontSize: '13.5px', cursor: 'pointer',
                marginTop: '8px', fontWeight: '500'
              }}>
                Çıkış yap
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  // Desktop sidebar
  return (
    <nav style={{
      width: '232px', minHeight: '100vh',
      background: 'var(--bg-card)', borderRight: '1px solid var(--border)',
      padding: '28px 16px 20px',
      display: 'flex', flexDirection: 'column', gap: '2px',
      position: 'sticky', top: 0, alignSelf: 'flex-start'
    }}>
      <div style={{ padding: '0 8px 28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: '700', fontSize: '14px'
        }}>F</div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', lineHeight: '1.2' }}>Dashboard</div>
          <div style={{ fontSize: '11px', color: 'var(--text-faint)', lineHeight: '1.2', marginTop: '2px' }}>Furkan</div>
        </div>
      </div>

      <div style={{
        fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px',
        color: 'var(--text-faded)', padding: '0 12px 8px', fontWeight: '600'
      }}>Menü</div>

      {ALL_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', gap: '11px',
          padding: '9px 12px', borderRadius: '8px',
          textDecoration: 'none', fontSize: '13.5px',
          fontWeight: isActive ? '600' : '500',
          color: isActive ? 'var(--text)' : 'var(--text-dim)',
          background: isActive ? 'var(--bg-item)' : 'transparent'
        })}>
          {({ isActive }) => (
            <>
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button onClick={signOut} style={{
        marginTop: 'auto', padding: '9px 12px', borderRadius: '8px',
        background: 'transparent', border: 'none',
        color: 'var(--text-dim)', fontSize: '12.5px', cursor: 'pointer',
        textAlign: 'center'
      }}>
        Çıkış yap
      </button>

      <button onClick={toggleTheme} style={{
        padding: '9px 12px', borderRadius: '8px',
        background: 'transparent', border: '1px solid var(--border)',
        color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '8px', fontWeight: '500'
      }}>
        {theme === 'dark' ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
        {theme === 'dark' ? 'Aydınlık' : 'Karanlık'}
      </button>
    </nav>
  )
}

export default Sidebar