import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function Habits() {
  const { user } = useAuth()
  const today = new Date()
  const [currentMonthIndex, setCurrentMonthIndex] = useState(today.getMonth())
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)
  const [newHabit, setNewHabit] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate()
  const isCurrentMonth = currentMonthIndex === today.getMonth() && currentYear === today.getFullYear()
  const maxDay = isCurrentMonth ? today.getDate() : daysInMonth

  useEffect(() => {
    if (user) {
      setSelectedDay(null)
      fetchAll()
    }
  }, [currentMonthIndex, currentYear, user])

  async function fetchAll() {
    setLoading(true)
    const monthStart = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-01`
    const monthEnd = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const [h, l] = await Promise.all([
      supabase.from('habits').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('habit_logs').select('*').gte('date', monthStart).lte('date', monthEnd)
    ])
    if (!h.error) setHabits(h.data)
    if (!l.error) setLogs(l.data)
    setLoading(false)
  }

  async function addHabit() {
    if (!newHabit.trim()) return
    const maxPos = habits.length > 0 ? Math.max(...habits.map(h => h.position || 0)) : 0
    await supabase.from('habits').insert({
      name: newHabit.trim(),
      position: maxPos + 1,
      user_id: user.id
    })
    setNewHabit('')
    setShowAdd(false)
    fetchAll()
  }

  async function deleteHabit(id) {
    if (!confirm('Bu alışkanlığı ve tüm geçmiş kayıtlarını silmek istediğine emin misin?')) return
    await supabase.from('habits').delete().eq('id', id)
    fetchAll()
  }

  async function toggleLog(habitId, dateStr, currentDone) {
    if (currentDone) {
      // Var, sil
      await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', dateStr)
    } else {
      // Yok, ekle
      await supabase.from('habit_logs').insert({
        habit_id: habitId,
        date: dateStr,
        done: true,
        user_id: user.id
      })
    }
    fetchAll()
  }

  function getDateStr(day) {
    return `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function isHabitDoneOn(habitId, dateStr) {
    return logs.some(l => l.habit_id === habitId && l.date === dateStr && l.done)
  }

  function getDoneCountOn(dateStr) {
    return habits.filter(h => isHabitDoneOn(h.id, dateStr)).length
  }

  function getHabitMonthStats(habitId) {
    let done = 0
    for (let d = 1; d <= maxDay; d++) {
      if (isHabitDoneOn(habitId, getDateStr(d))) done++
    }
    return { done, total: maxDay }
  }

  function navMonth(dir) {
    let newMonth = currentMonthIndex + dir
    let newYear = currentYear
    if (newMonth < 0) { newMonth = 11; newYear-- }
    if (newMonth > 11) { newMonth = 0; newYear++ }
    setCurrentMonthIndex(newMonth)
    setCurrentYear(newYear)
  }

  const canGoNext = !(currentYear === today.getFullYear() && currentMonthIndex === today.getMonth())

  if (loading && habits.length === 0) {
    return <p style={{ color: 'var(--text-faint)' }}>Yükleniyor...</p>
  }

  return (
    <div style={{ color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Alışkanlıklar</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <button onClick={() => navMonth(-1)} style={navBtnStyle}>‹</button>
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)', minWidth: '120px', textAlign: 'center' }}>
            {MONTHS_TR[currentMonthIndex]} {currentYear}
          </span>
          <button onClick={() => navMonth(1)} style={navBtnStyle} disabled={!canGoNext}>›</button>
          <button onClick={() => setShowAdd(true)} style={{ ...buttonStyle, fontSize: '13px', marginLeft: '8px' }}>+ Yeni</button>
        </div>
      </div>

      {habits.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '28px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', marginBottom: '16px', fontSize: '14px' }}>Henüz alışkanlık eklemedin.</p>
          <button onClick={() => setShowAdd(true)} style={buttonStyle}>İlk alışkanlığını ekle</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'flex-start' }}>

          {/* Sol: Takvim + Gün Detayı */}
          <div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                {MONTHS_TR[currentMonthIndex]} {currentYear}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' }}>
                {Array.from({ length: maxDay }, (_, i) => i + 1).map(day => {
                  const dateStr = getDateStr(day)
                  const done = getDoneCountOn(dateStr)
                  const total = habits.length
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

            {selectedDay && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
                  {selectedDay} {MONTHS_TR[currentMonthIndex]}
                </div>
                {habits.map(h => {
                  const dateStr = getDateStr(selectedDay)
                  const checked = isHabitDoneOn(h.id, dateStr)
                  return (
                    <div key={h.id} onClick={() => toggleLog(h.id, dateStr, checked)} style={{
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
                      <span style={{ fontSize: '14px', color: checked ? 'var(--success)' : 'var(--text-secondary)', textDecoration: checked ? 'line-through' : 'none', flex: 1 }}>{h.name}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sağ: Aylık Özet */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
              {MONTHS_TR[currentMonthIndex]} Özeti
            </div>
            {habits.map(h => {
              const stat = getHabitMonthStats(h.id)
              const percent = stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0
              const color = percent >= 80 ? 'var(--success)' : percent >= 50 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div key={h.id} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-faint)', marginLeft: '8px' }}>{stat.done}/{stat.total} · %{percent}</span>
                    <span onClick={() => deleteHabit(h.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '12px', marginLeft: '8px' }}>✕</span>
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

      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
            borderRadius: '16px', padding: '20px', width: '380px', maxWidth: '95vw'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '14px' }}>Yeni Alışkanlık</h3>
            <input
              value={newHabit}
              onChange={e => setNewHabit(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addHabit()}
              placeholder="örn. Su iç (2L), Spor yap..."
              style={{ ...inputStyle, width: '100%', marginBottom: '12px' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={addHabit} style={{ ...buttonStyle, flex: 1 }}>Ekle</button>
              <button onClick={() => setShowAdd(false)} style={{ ...buttonStyle, background: 'var(--bg-item)', border: '1px solid var(--border)', color: 'var(--text-secondary)', flex: 1 }}>İptal</button>
            </div>
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

const inputStyle = {
  padding: '9px 12px', background: 'var(--bg-item)',
  border: '1px solid var(--border-strong)', borderRadius: '8px',
  color: 'var(--text)', fontSize: '14px', outline: 'none'
}

const buttonStyle = {
  padding: '9px 18px', background: 'var(--accent)', border: 'none',
  borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer'
}

export default Habits