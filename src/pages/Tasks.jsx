import { useAuth } from '../components/AuthProvider'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PRIORITIES = {
  high: { label: 'Yüksek', color: 'var(--danger)' },
  medium: { label: 'Orta', color: 'var(--warning)' },
  low: { label: 'Düşük', color: 'var(--success)' }
}

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

function Tasks() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('today')
  const [newTask, setNewTask] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newDetail, setNewDetail] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({})
  const [showDone, setShowDone] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchTasks() }, [filter])

  async function fetchTasks() {
    let query = supabase.from('tasks').select('*').order('day', { ascending: true })
    if (filter === 'today') query = query.eq('day', today)
    if (filter === 'week') query = query.gte('day', getWeekStart()).lte('day', getWeekEnd())
    if (filter === 'month') query = query.gte('day', getMonthStart()).lte('day', getMonthEnd())
    const { data, error } = await query
    if (!error) setTasks(data)
  }

  async function addTask() {
    if (!newTask.trim()) return
    const { error } = await supabase.from('tasks').insert({
      title: newTask, type: 'todo',
      day: newDeadline || today, status: 'todo',
      priority: newPriority,
      note: newDetail || null,
      user_id: user.id
    })
    if (!error) {
      setNewTask(''); setNewDeadline(''); setNewDetail(''); setShowDetail(false); setNewPriority('medium')
      fetchTasks()
    }
  }

  async function toggleTask(id, currentStatus) {
    await supabase.from('tasks').update({ status: currentStatus === 'todo' ? 'done' : 'todo' }).eq('id', id)
    fetchTasks()
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks()
  }

  function startEdit(task) {
    setEditingId(task.id)
    setEditDraft({
      title: task.title,
      day: task.day,
      priority: task.priority || 'medium',
      note: task.note || ''
    })
  }

  async function saveEdit() {
    await supabase.from('tasks').update({
      title: editDraft.title,
      day: editDraft.day,
      priority: editDraft.priority,
      note: editDraft.note || null
    }).eq('id', editingId)
    setEditingId(null)
    fetchTasks()
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  function getWeekStart() {
    const d = new Date(); const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(new Date().setDate(diff)).toISOString().split('T')[0]
  }
  function getWeekEnd() {
    const d = new Date(); const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? 0 : 7)
    return new Date(new Date().setDate(diff)).toISOString().split('T')[0]
  }
  function getMonthStart() {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  }
  function getMonthEnd() {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' })
  }

  function isOverdue(dateStr) { return dateStr < today }

  function groupByDay(tasks) {
    const groups = {}
    tasks.forEach(t => {
      if (!groups[t.day]) groups[t.day] = []
      groups[t.day].push(t)
    })
    return groups
  }

  // Önceliğe göre sırala (yüksek > orta > düşük) + bitmemişler önce
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  function sortTasks(arr) {
    return [...arr].sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0
      const bDone = b.status === 'done' ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
    })
  }

  const activeTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const grouped = (filter === 'week' || filter === 'month') ? groupByDay(tasks) : null

  const sharedItemProps = {
    today, onToggle: toggleTask, onDelete: deleteTask,
    onEdit: startEdit, formatDate, isOverdue,
    editingId, editDraft, setEditDraft, saveEdit, cancelEdit
  }

  return (
    <div style={{ color: 'var(--text)' }}>
      <h2 style={{ marginBottom: '20px', fontSize: '22px', fontWeight: '700' }}>Görevler</h2>

      {/* Görev Ekleme */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '20px', maxWidth: '680px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Görev ekle..."
            style={inputStyle}
          />
          <button onClick={addTask} style={buttonStyle}>Ekle</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={newDeadline}
            onChange={e => setNewDeadline(e.target.value)}
            style={{ ...inputStyle, flex: isMobile ? 1 : 0, width: isMobile ? 'auto' : '160px', minWidth: '140px', fontSize: '13px' }}
          />
          <PrioritySelect value={newPriority} onChange={setNewPriority} />
          <button
            onClick={() => setShowDetail(!showDetail)}
            style={{ ...buttonStyle, background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-dim)', fontSize: '13px', padding: '7px 12px' }}
          >
            {showDetail ? '− Detay' : '+ Detay'}
          </button>
        </div>
        {showDetail && (
          <textarea
            value={newDetail}
            onChange={e => setNewDetail(e.target.value)}
            placeholder="Detay ekle..."
            rows={2}
            style={{ ...inputStyle, width: '100%', resize: 'vertical', marginTop: '8px', fontSize: '13px' }}
          />
        )}
      </div>

      {/* Filtre */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['today', 'week', 'month', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: '20px', border: '1px solid',
            borderColor: filter === f ? 'var(--accent)' : 'var(--border-strong)',
            background: filter === f ? 'var(--accent)' : 'transparent',
            color: filter === f ? '#fff' : 'var(--text-dim)', fontSize: '13px', cursor: 'pointer'
          }}>
            {f === 'today' ? 'Bugün' : f === 'week' ? 'Bu Hafta' : f === 'month' ? 'Bu Ay' : 'Tümü'}
          </button>
        ))}
      </div>

      {/* Bugün & Tümü — liste */}
      {!grouped && (
        <div style={{ maxWidth: '680px' }}>
          {sortTasks(activeTasks).map(t => (
            <TaskItem key={t.id} task={t} {...sharedItemProps} />
          ))}
          {activeTasks.length === 0 && doneTasks.length === 0 && (
            <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Görev yok.</p>
          )}
          {doneTasks.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => setShowDone(!showDone)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '13px', cursor: 'pointer', marginBottom: '8px' }}
              >
                {showDone ? '▲' : '▼'} Tamamlananlar ({doneTasks.length})
              </button>
              {showDone && doneTasks.map(t => (
                <TaskItem key={t.id} task={t} {...sharedItemProps} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hafta & Ay — sütunlar */}
      {grouped && (
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', alignItems: 'flex-start', WebkitOverflowScrolling: 'touch' }}>
          {Object.keys(grouped).sort().map(day => (
            <div key={day} style={{
              minWidth: '240px', maxWidth: '240px',
              background: 'var(--bg-card)',
              border: day === today ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: '12px', padding: '14px'
            }}>
              <div style={{
                fontSize: '11px',
                color: day === today ? 'var(--accent)' : 'var(--text-dim)',
                marginBottom: '12px', fontWeight: '600',
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>
                {formatDate(day)}
              </div>
              {sortTasks(grouped[day]).map(t => (
                <TaskItem key={t.id} task={t} {...sharedItemProps} compact />
              ))}
            </div>
          ))}
          {Object.keys(grouped).length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Görev yok.</p>}
        </div>
      )}
    </div>
  )
}

function PrioritySelect({ value, onChange }) {
  const p = PRIORITIES[value] || PRIORITIES.medium
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{
        position: 'absolute', left: '12px',
        width: '8px', height: '8px', borderRadius: '50%',
        background: p.color, pointerEvents: 'none'
      }} />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          ...selectStyle,
          fontSize: '13px',
          paddingLeft: '26px'
        }}
      >
        <option value="high">Yüksek</option>
        <option value="medium">Orta</option>
        <option value="low">Düşük</option>
      </select>
    </div>
  )
}

function TaskItem({ task, today, onToggle, onDelete, onEdit, formatDate, isOverdue, compact, editingId, editDraft, setEditDraft, saveEdit, cancelEdit }) {
  const p = PRIORITIES[task.priority] || PRIORITIES.medium
  const isEditing = editingId === task.id

  if (isEditing) {
    return (
      <div style={{
        marginBottom: '8px',
        background: 'var(--bg-item)',
        border: '1px solid var(--accent)',
        borderLeft: `3px solid ${p.color}`,
        borderRadius: '8px',
        padding: '11px 14px'
      }}>
        <input
          value={editDraft.title}
          onChange={e => setEditDraft({ ...editDraft, title: e.target.value })}
          style={{ ...inputStyle, width: '100%', marginBottom: '8px' }}
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <input
            type="date"
            value={editDraft.day}
            onChange={e => setEditDraft({ ...editDraft, day: e.target.value })}
            style={{ ...inputStyle, fontSize: '13px', minWidth: '140px', flex: 0 }}
          />
          <PrioritySelect value={editDraft.priority} onChange={v => setEditDraft({ ...editDraft, priority: v })} />
        </div>
        <textarea
          value={editDraft.note}
          onChange={e => setEditDraft({ ...editDraft, note: e.target.value })}
          placeholder="Detay..."
          rows={2}
          style={{ ...inputStyle, width: '100%', resize: 'vertical', fontSize: '13px', marginBottom: '8px' }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={cancelEdit} style={{ ...buttonStyle, background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-dim)', fontSize: '13px', padding: '7px 12px' }}>İptal</button>
          <button onClick={saveEdit} style={{ ...buttonStyle, fontSize: '13px', padding: '7px 14px' }}>Kaydet</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      marginBottom: '8px',
      background: 'var(--bg-item)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${p.color}`,
      borderRadius: '8px',
      padding: compact ? '8px 10px' : '11px 14px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          onClick={() => onToggle(task.id, task.status)}
          style={{
            width: '18px', height: '18px',
            borderRadius: '5px',
            border: '2px solid',
            borderColor: task.status === 'done' ? 'var(--accent)' : 'var(--text-faint)',
            background: task.status === 'done' ? 'var(--accent)' : 'transparent',
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          {task.status === 'done' && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span
          onClick={() => onEdit(task)}
          style={{
            fontSize: '13px',
            color: task.status === 'done' ? 'var(--text-faint)' : 'var(--text-secondary)',
            textDecoration: task.status === 'done' ? 'line-through' : 'none',
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
            cursor: 'pointer'
          }}
        >
          {task.title}
        </span>
        <span
          title={p.label}
          style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: p.color, flexShrink: 0
          }}
        />
        {!compact && (
          <span style={{
            fontSize: '11px',
            color: isOverdue(task.day) && task.status !== 'done' ? 'var(--danger)' : 'var(--text-faint)',
            flexShrink: 0
          }}>
            {formatDate(task.day)}
          </span>
        )}
        <span
          onClick={() => onDelete(task.id)}
          style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}
        >✕</span>
      </div>
      {task.note && (
        <div style={{
          marginTop: '6px', paddingLeft: '28px',
          fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.6'
        }}>
          {task.note}
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  flex: 1, padding: '9px 12px', background: 'var(--bg-item)',
  border: '1px solid var(--border-strong)', borderRadius: '8px',
  color: 'var(--text)', fontSize: '14px', outline: 'none'
}
const selectStyle = {
  padding: '9px 12px', background: 'var(--bg-item)',
  border: '1px solid var(--border-strong)', borderRadius: '8px',
  color: 'var(--text)', fontSize: '14px', outline: 'none'
}
const buttonStyle = {
  padding: '9px 16px', background: 'var(--accent)',
  border: 'none', borderRadius: '8px',
  color: '#fff', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap'
}

export default Tasks