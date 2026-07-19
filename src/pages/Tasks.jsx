import { useAuth } from '../components/AuthProvider'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const PRIORITIES = {
  high: { label: 'Yüksek', color: 'var(--danger)' },
  medium: { label: 'Orta', color: 'var(--warning)' },
  low: { label: 'Düşük', color: 'var(--success)' }
}

const FREQ_DAYS = {
  'Her gün': 1,
  'Haftada 1': 7,
  'Haftada 2': 4,
  'Haftada 3': 3,
  'Ayda 1': 30,
  'Ayda 2': 15
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function generateRoutineDates(routine, start, end) {
  const dates = []
  if (start > end) return dates

  if (routine.frequency === 'Her gün') {
    let cursor = start
    let safety = 100
    while (cursor <= end && safety > 0) {
      dates.push(cursor)
      cursor = addDays(cursor, 1)
      safety--
    }
    return dates
  }

  if (['Haftada 1', 'Haftada 2', 'Haftada 3'].includes(routine.frequency)) {
    const days = (routine.days_of_week || []).map(Number)
    if (days.length === 0) return dates
    let cursor = start
    let safety = 100
    while (cursor <= end && safety > 0) {
      const dow = new Date(cursor + 'T00:00:00').getDay()
      const dowMon = dow === 0 ? 7 : dow
      if (days.includes(dowMon)) dates.push(cursor)
      cursor = addDays(cursor, 1)
      safety--
    }
    return dates
  }

  if (routine.frequency === '2 haftada 1') {
    const days = (routine.days_of_week || []).map(Number)
    const anchor = routine.biweekly_anchor || start
    if (days.length === 0) return dates
    let cursor = start
    let safety = 100
    while (cursor <= end && safety > 0) {
      const dow = new Date(cursor + 'T00:00:00').getDay()
      const dowMon = dow === 0 ? 7 : dow
      const diffDays = Math.floor((new Date(cursor) - new Date(anchor)) / (1000 * 60 * 60 * 24))
      const weekNum = Math.floor(diffDays / 7)
      if (days.includes(dowMon) && weekNum % 2 === 0) dates.push(cursor)
      cursor = addDays(cursor, 1)
      safety--
    }
    return dates
  }

  if (['Ayda 1', 'Ayda 2'].includes(routine.frequency)) {
    const monthDays = (routine.days_of_month || []).map(Number)
    if (monthDays.length === 0) return dates
    let cursor = start
    let safety = 100
    while (cursor <= end && safety > 0) {
      const d = new Date(cursor + 'T00:00:00').getDate()
      if (monthDays.includes(d)) dates.push(cursor)
      cursor = addDays(cursor, 1)
      safety--
    }
    return dates
  }

  return dates
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
  const [projectTasks, setProjectTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [routines, setRoutines] = useState([])
  const [routineLogs, setRoutineLogs] = useState([])
  const [allTasksData, setAllTasksData] = useState([])
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

  useEffect(() => { fetchAll() }, [filter])

  async function fetchAll() {
    const [t, pt, p, r, rl, allT] = await Promise.all([
      buildTaskQuery(),
      supabase.from('project_tasks').select('*'),
      supabase.from('projects').select('*'),
      supabase.from('project_routines').select('*'),
      supabase.from('project_routine_logs').select('*'),
      supabase.from('tasks').select('*').neq('status', 'done')
    ])
    if (!t.error) setTasks(t.data || [])
    if (!pt.error) setProjectTasks(pt.data || [])
    if (!p.error) setProjects(p.data || [])
    if (!r.error) setRoutines(r.data || [])
    if (!rl.error) setRoutineLogs(rl.data || [])
    if (!allT.error) setAllTasksData(allT.data || [])
  }

  async function buildTaskQuery() {
    let query = supabase.from('tasks').select('*').order('day', { ascending: true })
    if (filter === 'today') query = query.eq('day', today)
    if (filter === 'week') query = query.gte('day', getWeekStart()).lte('day', getWeekEnd())
    if (filter === 'month') query = query.gte('day', getMonthStart()).lte('day', getMonthEnd())
    return await query
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
      fetchAll()
    }
  }

  async function toggleTask(item) {
    if (item.source === 'project_task') {
      const newStatus = item.status === 'todo' ? 'done' : 'todo'
      await supabase.from('project_tasks').update({ status: newStatus }).eq('id', item.id)
      const proj = projects.find(p => p.id === item.project_id)
      if (proj && !proj.progress_manual) {
        const { data } = await supabase.from('project_tasks').select('*').eq('project_id', item.project_id)
        if (data) {
          const done = data.filter(d => d.status === 'done').length
          const total = data.length
          const auto = total > 0 ? Math.round((done / total) * 100) : 0
          await supabase.from('projects').update({ progress: auto }).eq('id', item.project_id)
        }
      }
    } else if (item.source === 'routine') {
      const existing = routineLogs.find(l => l.routine_id === item.routine_id && l.date === item.day)
      if (existing) {
        await supabase.from('project_routine_logs').delete().eq('id', existing.id)
      } else {
        await supabase.from('project_routine_logs').insert({
          user_id: user.id,
          routine_id: item.routine_id,
          date: item.day,
          done: true
        })
        await supabase.from('project_routines').update({ last_done: new Date().toISOString() }).eq('id', item.routine_id)
      }
    } else {
      const newStatus = item.status === 'todo' ? 'done' : 'todo'
      await supabase.from('tasks').update({ status: newStatus }).eq('id', item.id)
    }
    fetchAll()
  }

  async function deleteItem(item) {
    if (item.source === 'project_task') {
      await supabase.from('project_tasks').delete().eq('id', item.id)
    } else if (item.source === 'routine') {
      return
    } else {
      await supabase.from('tasks').delete().eq('id', item.id)
    }
    fetchAll()
  }

  function startEdit(item) {
    if (item.source === 'routine') return
    setEditingId(item.id)
    setEditDraft({
      title: item.title,
      day: item.day || item.date,
      priority: item.priority || 'medium',
      note: item.note || '',
      source: item.source
    })
  }

  async function saveEdit() {
    if (editDraft.source === 'project_task') {
      await supabase.from('project_tasks').update({
        title: editDraft.title,
        date: editDraft.day
      }).eq('id', editingId)
    } else {
      await supabase.from('tasks').update({
        title: editDraft.title,
        day: editDraft.day,
        priority: editDraft.priority,
        note: editDraft.note || null
      }).eq('id', editingId)
    }
    setEditingId(null)
    fetchAll()
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
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' })
  }

  function isOverdue(dateStr) { return dateStr < today }

  function getDateRange() {
    if (filter === 'today') return [today, today]
    if (filter === 'week') return [getWeekStart(), getWeekEnd()]
    if (filter === 'month') return [getMonthStart(), getMonthEnd()]
    return [today, addDays(today, 30)]
  }

  function buildAllItems() {
    const [rangeStart, rangeEnd] = getDateRange()
    const items = []

    tasks.forEach(t => {
      items.push({ ...t, source: 'task' })
    })

    projectTasks.forEach(pt => {
      if (!pt.date) return
      if (filter !== 'all' && (pt.date < rangeStart || pt.date > rangeEnd)) return
      const proj = projects.find(p => p.id === pt.project_id)
      items.push({
        ...pt,
        day: pt.date,
        source: 'project_task',
        project: proj,
        priority: 'medium'
      })
    })

    const routineStart = rangeStart > today ? rangeStart : today
    const routineEnd = rangeEnd

    routines.forEach(r => {
      const endDate = r.end_date && r.end_date < routineEnd ? r.end_date : routineEnd
      const matchingDates = generateRoutineDates(r, routineStart, endDate)
      matchingDates.forEach(date => {
        if (date < rangeStart) return
        const log = routineLogs.find(l => l.routine_id === r.id && l.date === date)
        const proj = projects.find(p => p.id === r.project_id)
        items.push({
          id: `routine-${r.id}-${date}`,
          routine_id: r.id,
          title: r.title,
          day: date,
          status: log ? 'done' : 'todo',
          source: 'routine',
          project: proj,
          frequency: r.frequency,
          priority: 'medium'
        })
      })
    })

    return items
  }

  const allItems = buildAllItems()

  // Sağ panel hesaplamaları
  const overdueTasks = allTasksData
    .filter(t => t.day && t.day < today)
    .sort((a, b) => a.day.localeCompare(b.day))

  const upcomingTasks = allTasksData
    .filter(t => t.day && t.day >= today && t.day <= addDays(today, 7))
    .sort((a, b) => a.day.localeCompare(b.day))

  const projectSummaries = projects.map(p => {
    const openPhases = projectTasks.filter(pt => pt.project_id === p.id && pt.status !== 'done').length
    const totalPhases = projectTasks.filter(pt => pt.project_id === p.id).length
    const routineCount = routines.filter(r => r.project_id === p.id && (!r.end_date || r.end_date >= today)).length
    return { ...p, openPhases, totalPhases, routineCount }
  })

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  function sortItems(arr) {
    return [...arr].sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0
      const bDone = b.status === 'done' ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      if (a.day !== b.day) return (a.day || '').localeCompare(b.day || '')
      return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
    })
  }

  function groupByDay(arr) {
    const groups = {}
    arr.forEach(t => {
      const key = t.day || 'no-date'
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    return groups
  }

  const activeItems = allItems.filter(t => t.status !== 'done')
  const doneItems = allItems.filter(t => t.status === 'done')
  const grouped = (filter === 'week' || filter === 'month') ? groupByDay(allItems) : null

  const sharedItemProps = {
    today, onToggle: toggleTask, onDelete: deleteItem,
    onEdit: startEdit, formatDate, isOverdue,
    editingId, editDraft, setEditDraft, saveEdit, cancelEdit
  }

  return (
    <div style={{ color: 'var(--text)', display: 'flex', gap: '20px', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '22px', fontWeight: '700' }}>Görevler</h2>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '20px' }}>
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

        {!grouped && (
          <div>
            {sortItems(activeItems).map(t => (
              <TaskItem key={`${t.source}-${t.id}`} task={t} {...sharedItemProps} />
            ))}
            {activeItems.length === 0 && doneItems.length === 0 && (
              <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Görev yok.</p>
            )}
            {doneItems.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={() => setShowDone(!showDone)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '13px', cursor: 'pointer', marginBottom: '8px' }}
                >
                  {showDone ? '▲' : '▼'} Tamamlananlar ({doneItems.length})
                </button>
                {showDone && sortItems(doneItems).map(t => (
                  <TaskItem key={`${t.source}-${t.id}`} task={t} {...sharedItemProps} />
                ))}
              </div>
            )}
          </div>
        )}

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
                {sortItems(grouped[day]).map(t => (
                  <TaskItem key={`${t.source}-${t.id}`} task={t} {...sharedItemProps} compact />
                ))}
              </div>
            ))}
            {Object.keys(grouped).length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Görev yok.</p>}
          </div>
        )}
      </div>

      <TaskSidebar
        isMobile={isMobile}
        overdueTasks={overdueTasks}
        upcomingTasks={upcomingTasks}
        projectSummaries={projectSummaries}
        formatDate={formatDate}
      />
    </div>
  )
}

function TaskSidebar({ isMobile, overdueTasks, upcomingTasks, projectSummaries, formatDate }) {
  return (
    <div style={{ width: isMobile ? '100%' : '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {projectSummaries.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px', fontWeight: '600' }}>Projeler</div>
          {projectSummaries.map(p => (
            <div key={p.id} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                {p.icon && <span style={{ fontSize: '14px' }}>{p.icon}</span>}
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{p.progress}%</span>
              </div>
              <div style={{ background: 'var(--bg-item)', borderRadius: '99px', height: '4px', marginBottom: '5px' }}>
                <div style={{ width: `${p.progress}%`, height: '4px', borderRadius: '99px', background: p.color }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                {p.openPhases > 0 ? `${p.openPhases} açık aşama` : 'Aşama yok'}
                {p.routineCount > 0 ? ` · ${p.routineCount} rutin` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {overdueTasks.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px', fontWeight: '600' }}>
            Gecikmiş ({overdueTasks.length})
          </div>
          {overdueTasks.slice(0, 6).map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
              <span style={{ fontSize: '11px', color: 'var(--danger)', flexShrink: 0 }}>{formatDate(t.day)}</span>
            </div>
          ))}
          {overdueTasks.length > 6 && <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>+{overdueTasks.length - 6} daha</div>}
        </div>
      )}

      {upcomingTasks.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px', fontWeight: '600' }}>
            Yaklaşan (7 gün)
          </div>
          {upcomingTasks.slice(0, 6).map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-faint)', flexShrink: 0 }}>{formatDate(t.day)}</span>
            </div>
          ))}
          {upcomingTasks.length > 6 && <div style={{ fontSize: '11px', color: 'var(--text-faint)' }}>+{upcomingTasks.length - 6} daha</div>}
        </div>
      )}

      {overdueTasks.length === 0 && upcomingTasks.length === 0 && projectSummaries.length === 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-faint)' }}>Henüz özet yok</span>
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
        style={{ ...selectStyle, fontSize: '13px', paddingLeft: '26px' }}
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
  const isEditing = editingId === task.id && task.source !== 'routine'
  const projectColor = task.project?.color
  const leftBorderColor = task.source === 'task' ? p.color : (projectColor || 'var(--text-faded)')

  if (isEditing) {
    return (
      <div style={{
        marginBottom: '8px',
        background: 'var(--bg-item)',
        border: '1px solid var(--accent)',
        borderLeft: `3px solid ${leftBorderColor}`,
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
          {editDraft.source === 'task' && (
            <PrioritySelect value={editDraft.priority} onChange={v => setEditDraft({ ...editDraft, priority: v })} />
          )}
        </div>
        {editDraft.source === 'task' && (
          <textarea
            value={editDraft.note}
            onChange={e => setEditDraft({ ...editDraft, note: e.target.value })}
            placeholder="Detay..."
            rows={2}
            style={{ ...inputStyle, width: '100%', resize: 'vertical', fontSize: '13px', marginBottom: '8px' }}
          />
        )}
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
      borderLeft: `3px solid ${leftBorderColor}`,
      borderRadius: '8px',
      padding: compact ? '8px 10px' : '11px 14px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          onClick={() => onToggle(task)}
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
            cursor: task.source === 'routine' ? 'default' : 'pointer'
          }}
        >
          {task.title}
        </span>
        {task.project && (
          <span style={{
            fontSize: '10px',
            background: task.project.color + '22',
            color: task.project.color,
            border: `1px solid ${task.project.color}55`,
            borderRadius: '4px',
            padding: '2px 6px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            fontWeight: '600'
          }}>
            {task.project.icon ? task.project.icon + ' ' : ''}{task.project.name}
          </span>
        )}
        {task.source === 'routine' && (
          <span style={{ fontSize: '10px', color: 'var(--text-faint)', flexShrink: 0 }}>🔁</span>
        )}
        {task.source === 'task' && (
          <span title={p.label} style={{ width: '7px', height: '7px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
        )}
        {!compact && (
          <span style={{
            fontSize: '11px',
            color: isOverdue(task.day) && task.status !== 'done' ? 'var(--danger)' : 'var(--text-faint)',
            flexShrink: 0
          }}>
            {formatDate(task.day)}
          </span>
        )}
        {task.source !== 'routine' && (
          <span
            onClick={() => onDelete(task)}
            style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}
          >✕</span>
        )}
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