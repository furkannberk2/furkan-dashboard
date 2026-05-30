import { useState, useEffect } from 'react'
import { BACKEND } from '../config'

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
      await fetch(`${BACKEND}/api/habits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: MONTHS[currentMonthIndex],
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
    <div style={{ color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Alışkanlıklar</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <button onClick={() => setCurrentMonthIndex(i => Math.max(0, i - 1))} style={navBtnStyle}>‹</button>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', minWidth: '80px', textAlign: 'center' }}>{MONTHS_TR[currentMonthIndex]}</span>
          <button onClick={() => setCurrentMonthIndex(i => Math.min(today.getMonth(), i + 1))} style={navBtnStyle} disabled={currentMonthIndex === today.getMonth()}>›</button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-faint)' }}>Yükleniyor...</p>
      ) : habits.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', marginBottom: '16px' }}>{MONTHS_TR[currentMonthIndex]} için henüz veri yok.</p>
          <button onClick={initMonth} disabled={initLoading} style={buttonStyle}>
            {initLoading ? 'Oluşturuluyor...' : `${MONTHS_TR[currentMonthIndex]} ayını başlat`}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'flex-start' }}>

          {/* Sol: Takvim + Gün Detayı */}
          <div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                {MONTHS_TR[currentMonthIndex]} {today.getFullYear()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map(day => {
                  const page = getPageForDay(day)
                  const total = habitNames.length
                  const done = page ? habitNames.filter(n => page.properties[n]?.checkbox).length : 0
                  const isToday = isCurrentMonth && day === today.getDate()
                  const isSelected = day === selectedDay
                  const allDone = done === total && total > 0

                  return (
                    <div key={day} onClick={() => setSelectedDay(day === selectedDay ? null : day)} style={{
                      aspectRatio: '1', borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', cursor: 'pointer',
                      background: isSelected ? 'var(--accent)' : allDone ? 'var(--accent-soft)' : 'var(--bg-item)',
                      border: isToday ? '1px solid var(--accent)' : isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: isSelected ? '#fff' : isToday ? 'var(--accent)' : 'var(--text-secondary)',
                      position: 'relative'
                    }}>
                      {day}
                      {done > 0 && !isSelected && (
                        <div style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '2px' }}>
                          {Array.from({ length: Math.min(done, 4) }).map((_, i) => (
                            <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: allDone ? 'var(--success)' : 'var(--warning)' }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedDay && selectedPage && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                  {selectedDay} {MONTHS_TR[currentMonthIndex]}
                </div>
                {habitNames.map(name => {
                  const checked = selectedPage.properties[name]?.checkbox || false
                  return (
                    <div key={name} onClick={() => toggleHabit(selectedPage.id, name, checked)} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)'
                    }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '5px', border: '2px solid',
                        borderColor: checked ? 'var(--success)' : 'var(--text-faded)',
                        background: checked ? 'var(--success)' : 'transparent',
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      <span style={{ fontSize: '14px', color: checked ? 'var(--success)' : 'var(--text-secondary)', textDecoration: checked ? 'line-through' : 'none' }}>{name}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {selectedDay && !selectedPage && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>{selectedDay}. gün için veri bulunamadı.</p>
              </div>
            )}
          </div>

          {/* Sağ: Aylık Özet */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
              {MONTHS_TR[currentMonthIndex]} Özeti
            </div>
            {habitNames.map(name => {
              const stat = monthStats[name] || { done: 0, total: 0 }
              const percent = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0
              const color = percent >= 80 ? 'var(--success)' : percent >= 50 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div key={name} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{stat.done}/{stat.total} · %{percent}</span>
                  </div>
                  <div style={{ background: 'var(--bg-item)', borderRadius: '99px', height: '5px' }}>
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
  background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '6px',
  color: 'var(--text-secondary)', fontSize: '16px', padding: '4px 10px', cursor: 'pointer'
}

const buttonStyle = {
  padding: '9px 18px', background: 'var(--accent)', border: 'none',
  borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer'
}

export default Habits