import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from './components/AuthProvider'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import Projects from './pages/Projects'
import Finance from './pages/Finance'
import Habits from './pages/Habits'
import Calories from './pages/Calories'
import Mail from './pages/Mail'
import Stocks from './pages/Stocks'

function App() {
  const { user, loading } = useAuth()
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    function handle() { setIsMobile(window.innerWidth <= 768) }
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-faint)' }}>
        Yükleniyor...
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{
        flex: 1, minWidth: 0,
        padding: isMobile ? '20px 16px 90px' : '32px',
        overflowY: 'auto'
      }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/calories" element={<Calories />} />
          <Route path="/mail" element={<Mail />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/finance" element={<Finance />} />
        </Routes>
      </main>
    </div>
  )
}

export default App