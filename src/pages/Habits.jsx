import { useState, useEffect } from 'react'

const BACKEND = 'http://localhost:3001'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function Habits() {
  const today = new Date()
  const [currentMonthIndex, setCurrentMonthIndex] = useState(today.getMonth())
  const [habits, setHabits] = useState([])
  const [habitNames, setHabitNames] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)
  const [initLoading, setInitLoading] = useState(false)

  const currentDay = today.getMonth() === currentMonthIndex ? today.getDate() : new Date(today.getFullYear(), currentMonthIndex + 1, 0).getDate()
  const daysInMonth = new Date(today.getFullYear(), currentMonthIndex + 1, 0).getDate()
  const isCurrentMonth = currentMonthIndex === today.getMonth()

  useEffect(() => {
    setSelectedDay(null)
    fetchHabits()
  }, [currentMonthIndex])

  async function fetchHabits() {
    setLoading(true)
    try {
      const month = MONTHS[currentMonthIndex]
      const res = await fetch(`${BACKEND}/api/habits?month=${month}`)
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

  async function initMonth() {
    setInitLoading(true)
    try {
      await fetch(`${BACKEND}/api/habits/init-month`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: MONTHS[currentMonthIndex],
          year: today.getFullYear(),
          days: daysInMonth
        })
      })
      fetchHabits()
    } catch (err) {
      console.error(err)
    } finally {
      setInitLoading(false)
    }
  }

  function getPageForDay(day) {
    return habits.find(p => {
      const title = p.properties['Day']?.title?.[0]?.plain_text
      return parseInt(title) === day
    })
  }

  function getMonthStats() {
    const stats = {}
    habitNames.forEach(name => { stats[name] = { done: 0, total: 0 } })
    const maxDay = isCurrentMonth ? today.getDate() : daysInMonth
    habits.forEach(p => {
      const title = p.properties['Day']?.title?.[0]?.plain_text
      const dayNum = parseInt(title)
      if (isNaN(dayNum) || dayNum > maxDay) return
      habitNames.forEach(name => {
        stats[name].total++
        if (p.properties[name]?.checkbox) stats[name].done++
      })
    })
    return stats
  }

  const monthStats = getMonthStats()
  const selectedPage = selectedDay ? getPageForDay(selectedDay) : null
  const maxDay = isCurrentMonth ? today.getDate() : daysInMonth

  return (
    <div style={{ color: '#fff' }}>
      {/* Başlık + ay navigasyonu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Alışkanlıklar</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <button onClick={() => setCurrentMonthIndex(i => Math.max(0, i - 1))} style={navBtnStyle}>‹</button>
          <span style={{ fontSize: '14px', color: '#ccc', minWidth: '80px', textAlign: 'center' }}>{MONTHS_TR[currentMonthIndex]}</span>
          <button onClick={() => setCurrentMonthIndex(i => Math.min(today.getMonth(), i + 1))} style={navBtnStyle} disabled={currentMonthIndex === today.getMonth()}>›</button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#555' }}>Yükleniyor...</p>
      ) : habits.length === 0 ? (
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#555', marginBottom: '16px' }}>{MONTHS_TR[currentMonthIndex]} için henüz veri yok.</p>
          <button onClick={initMonth} disabled={initLoading} style={buttonStyle}>
            {initLoading ? 'Oluşturuluyor...' : `${MONTHS_TR[currentMonthIndex]} ayını başlat`}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Sol: Takvim + Gün Detayı */}
          <div style={{ minWidth: '300px', flex: 1 }}>
            <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                {MONTHS_TR[currentMonthIndex]} {today.getFullYear()}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map(day => {
                  const page = getPageForDay(day)
                  const total = habitNames.length
                  const done = page ? habitNames.filter(n => page.properties[n]?.checkbox).length : 0
                  const isToday = isCurrentMonth && day === today.getDate()
                  const isSelected = day === selectedDay
                  const allDone = done === total && total > 0

                  return (
                    <div key={day} onClick={() => setSelectedDay(day === selectedDay ? null : day)} style={{
                      width: '36px', height: '36px', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', cursor: 'pointer',
                      background: isSelected ? '#6366f1' : allDone ? '#1a2e1a' : '#1a1a1a',
                      border: isToday ? '1px solid #6366f1' : isSelected ? '1px solid #6366f1' : '1px solid #222',
                      color: isSelected ? '#fff' : isToday ? '#6366f1' : '#ccc',
                      position: 'relative'
                    }}>
                      {day}
                      {done > 0 && !isSelected && (
                        <div style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '2px' }}>
                          {Array.from({ length: Math.min(done, 4) }).map((_, i) => (
                            <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: allDone ? '#6ee7b7' : '#fbbf24' }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedDay && selectedPage && (
              <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
                  {selectedDay} {MONTHS_TR[currentMonthIndex]}
                </div>
                {habitNames.map(name => {
                  const checked = selectedPage.properties[name]?.checkbox || false
                  return (
                    <div key={name} onClick={() => toggleHabit(selectedPage.id, name, checked)} style={{
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
                })}
              </div>
            )}
            {selectedDay && !selectedPage && (
              <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '16px' }}>
                <p style={{ color: '#555', fontSize: '14px' }}>{selectedDay}. gün için veri bulunamadı.</p>
              </div>
            )}
          </div>

          {/* Sağ: Aylık Özet */}
          <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '20px', minWidth: '260px', flex: 1 }}>
            <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>
              {MONTHS_TR[currentMonthIndex]} Özeti
            </div>
            {habitNames.map(name => {
              const stat = monthStats[name] || { done: 0, total: 0 }
              const percent = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0
              const color = percent >= 80 ? '#6ee7b7' : percent >= 50 ? '#fbbf24' : '#f87171'
              return (
                <div key={name} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#ccc' }}>{name}</span>
                    <span style={{ fontSize: '12px', color: '#555' }}>{stat.done}/{stat.total} — %{percent}</span>
                  </div>
                  <div style={{ background: '#222', borderRadius: '99px', height: '5px' }}>
                    <div style={{ width: `${percent}%`, height: '5px', borderRadius: '99px', background: color, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const navBtnStyle = {
  background: '#1a1a1a', border: '1px solid #222', borderRadius: '6px',
  color: '#ccc', fontSize: '16px', padding: '4px 10px', cursor: 'pointer'
}

const buttonStyle = {
  padding: '9px 18px', background: '#6366f1', border: 'none',
  borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer'
}

export default Habits