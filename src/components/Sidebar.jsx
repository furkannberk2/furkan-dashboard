import { NavLink } from 'react-router-dom'

function Sidebar() {
  return (
    <nav style={{
      width: '220px', minHeight: '100vh',
      background: '#161616', borderRight: '1px solid #222',
      padding: '24px 16px', display: 'flex',
      flexDirection: 'column', gap: '4px'
    }}>
      <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', marginBottom: '24px' }}>
        Furkan's Dashboard
      </div>
      <NavLink to="/" end style={navStyle}>🏠 Ana Sayfa</NavLink>
      <NavLink to="/habits" style={navStyle}>✅ Alışkanlıklar</NavLink>
      <NavLink to="/tasks" style={navStyle}>📋 Görevler</NavLink>
      <NavLink to="/calories" style={navStyle}>🍎 Kalori</NavLink>
      <NavLink to="/projects" style={navStyle}>📁 Projeler</NavLink>
      <NavLink to="/finance" style={navStyle}>💸 Finans</NavLink>
    </nav>
  )
}

const navStyle = ({ isActive }) => ({
  padding: '10px 12px', borderRadius: '8px',
  textDecoration: 'none', fontSize: '14px',
  color: isActive ? '#fff' : '#666',
  background: isActive ? '#222' : 'transparent',
})

export default Sidebar