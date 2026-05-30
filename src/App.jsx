import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import Projects from './pages/Projects'
import Finance from './pages/Finance'
import Habits from './pages/Habits'
import Calories from './pages/Calories'
import Mail from './pages/Mail'
import Stocks from './pages/Stocks'

function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', minWidth: 0 }}>
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