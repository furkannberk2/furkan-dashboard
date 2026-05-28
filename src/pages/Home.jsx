import { useState, useEffect } from 'react'
import { BACKEND } from '../config'

function Home() {
  const [habits, setHabits] = useState([])
  const [habitNames, setHabitNames] = useState([])
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const currentDay = today.getDate()
  const currentMonth = today.toLocaleString('en-US', { month: 'long' })

  useEffect(() => { fetchHabits() }, [])

  async function fetchHabits() {
    try {
      const res = await fetch(`${BACKEND}/api/habits?month=${currentMonth}`)
      const data = await res.json()
      const pages = data.results || []
      setHabits(pages)
      if (pages.length > 0) {
        const props = pages[0].properties
        const names = Object.keys(props).filter(k => props[k].type === 'checkbox')
        setHabitNames(names)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function toggleHabit(pageId, habitName, currentValue) {
    await fetch(`${BACKEND}/api/habits/${pageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property: habitName, value: !currentValue })
    })
    fetchHabits()
  }

  function getTodayPage() {
    return habits.find(p => {
      const title = p.properties['Day']?.title?.[0]?.plain_text
      return parseInt(title) === currentDay
    })
  }

  const todayPage = getTodayPage()

  if (loading) return <div style={{ color: '#555' }}>Yükleniyor...</div>

  return (
    <div style={{ color: '#fff' }}>
      <h2 style={{ marginBottom: '24px', fontSize: '22px', fontWeight: '700' }}>
        {today.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </h2>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '20px', minWidth: '280px', maxWidth: '340px' }}>
          <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>Bugünün Alışkanlıkları</div>
          {todayPage ? (
            habitNames.map(name => {
              const checked = todayPage.properties[name]?.checkbox || false
              return (
                <div key={name} onClick={() => toggleHabit(todayPage.id, name, checked)} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid #1a1a1a'
                }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '5px', border: '2px solid',
                    borderColor: checked ? '#6ee7b7' : '#444',
                    background: checked ? '#6ee7b7' : 'transparent',
                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span style={{ fontSize: '14px', color: checked ? '#6ee7b7' : '#ccc', textDecoration: checked ? 'line-through' : 'none' }}>{name}</span>
                </div>
              )
            })
          ) : (
            <p style={{ color: '#555', fontSize: '14px' }}>Bugün için veri bulunamadı.</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Home