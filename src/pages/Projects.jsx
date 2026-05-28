import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const COLORS = ['#6366f1', '#f472b6', '#fb923c', '#60a5fa', '#a78bfa', '#6ee7b7', '#fbbf24', '#f87171']
const FREQUENCIES = ['Her gün', 'Haftada 1', 'Haftada 2', 'Haftada 3', 'Ayda 1', 'Ayda 2']

function Projects() {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [routines, setRoutines] = useState([])
  const [tab, setTab] = useState('tasks')

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [newIcon, setNewIcon] = useState('')
  const [showAddProject, setShowAddProject] = useState(false)

  const [newTask, setNewTask] = useState('')
  const [newTaskDate, setNewTaskDate] = useState('')
  const [newRoutine, setNewRoutine] = useState('')
  const [newFrequency, setNewFrequency] = useState('Haftada 1')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchProjects() }, [])
  useEffect(() => { if (selectedProject) fetchProjectDetails(selectedProject.id) }, [selectedProject])

  async function fetchProjects() {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
    if (!error) setProjects(data)
  }

  async function fetchProjectDetails(projectId) {
    const [t, r] = await Promise.all([
      supabase.from('project_tasks').select('*').eq('project_id', projectId).order('date', { ascending: true }),
      supabase.from('project_routines').select('*').eq('project_id', projectId).order('created_at', { ascending: true })
    ])
    if (!t.error) setTasks(t.data)
    if (!r.error) setRoutines(r.data)
  }

  async function addProject() {
    if (!newName.trim()) return
    await supabase.from('projects').insert({ name: newName, color: newColor, icon: newIcon || null, status: 'aktif', progress: 0 })
    setNewName(''); setNewIcon(''); setShowAddProject(false)
    fetchProjects()
  }

  async function updateProject(id, data) {
    await supabase.from('projects').update(data).eq('id', id)
    fetchProjects()
    if (selectedProject?.id === id) setSelectedProject(prev => ({ ...prev, ...data }))
  }

  async function deleteProject(id) {
    await supabase.from('projects').delete().eq('id', id)
    setSelectedProject(null)
    fetchProjects()
  }

  async function addTask() {
    if (!newTask.trim()) return
    await supabase.from('project_tasks').insert({ project_id: selectedProject.id, title: newTask, status: 'todo', date: newTaskDate || null })
    setNewTask(''); setNewTaskDate('')
    fetchProjectDetails(selectedProject.id)
  }

  async function toggleTask(id, status) {
    await supabase.from('project_tasks').update({ status: status === 'todo' ? 'done' : 'todo' }).eq('id', id)
    fetchProjectDetails(selectedProject.id)
  }

  async function deleteTask(id) {
    await supabase.from('project_tasks').delete().eq('id', id)
    fetchProjectDetails(selectedProject.id)
  }

  async function addRoutine() {
    if (!newRoutine.trim()) return
    await supabase.from('project_routines').insert({ project_id: selectedProject.id, title: newRoutine, frequency: newFrequency })
    setNewRoutine('')
    fetchProjectDetails(selectedProject.id)
  }

  async function markRoutineDone(id) {
    await supabase.from('project_routines').update({ last_done: new Date().toISOString() }).eq('id', id)
    fetchProjectDetails(selectedProject.id)
  }

  async function deleteRoutine(id) {
    await supabase.from('project_routines').delete().eq('id', id)
    fetchProjectDetails(selectedProject.id)
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  }

  function getLastDoneLabel(lastDone) {
    if (!lastDone) return 'Hiç yapılmadı'
    const d = new Date(lastDone)
    const diff = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Bugün yapıldı'
    if (diff === 1) return 'Dün yapıldı'
    return `${diff} gün önce`
  }

  function isRoutineOverdue(routine) {
    if (!routine.last_done) return true
    const diff = Math.floor((new Date() - new Date(routine.last_done)) / (1000 * 60 * 60 * 24))
    if (routine.frequency === 'Her gün') return diff >= 1
    if (routine.frequency === 'Haftada 1') return diff >= 7
    if (routine.frequency === 'Haftada 2') return diff >= 4
    if (routine.frequency === 'Haftada 3') return diff >= 3
    if (routine.frequency === 'Ayda 1') return diff >= 30
    if (routine.frequency === 'Ayda 2') return diff >= 15
    return false
  }

  const completedTasks = tasks.filter(t => t.status === 'done').length

  return (
    <div style={{ color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Projeler</h2>
        <button onClick={() => setShowAddProject(true)} style={buttonStyle}>+ Yeni Proje</button>
      </div>

      {/* Proje Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
        {projects.map(p => (
          <div key={p.id} onClick={() => { setSelectedProject(p); setTab('tasks') }} style={{
            background: '#161616', border: '1px solid #222',
            borderTop: `3px solid ${p.color}`,
            borderRadius: '12px', padding: '16px', cursor: 'pointer'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              {p.icon && <span style={{ fontSize: '18px' }}>{p.icon}</span>}
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#fff', flex: 1 }}>{p.name}</span>
              <span style={{ fontSize: '10px', color: p.status === 'aktif' ? '#6ee7b7' : p.status === 'tamamlandı' ? '#6366f1' : '#555', background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px' }}>{p.status}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, background: '#222', borderRadius: '99px', height: '4px' }}>
                <div style={{ width: `${p.progress}%`, height: '4px', borderRadius: '99px', background: p.color }} />
              </div>
              <span style={{ fontSize: '12px', color: '#555' }}>{p.progress}%</span>
            </div>
          </div>
        ))}
      </div>
      {projects.length === 0 && <p style={{ color: '#555', fontSize: '14px', marginTop: '16px' }}>Henüz proje yok.</p>}

      {/* Yeni Proje Modal */}
      {showAddProject && (
        <Modal onClose={() => setShowAddProject(false)}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Yeni Proje</h3>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Proje adı" style={{ ...inputStyle, marginBottom: '10px', width: '100%' }} />
          <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="Emoji (örn. 🎬)" style={{ ...inputStyle, marginBottom: '12px', width: '100%' }} />
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}>Renk</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setNewColor(c)} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: newColor === c ? '3px solid #fff' : '3px solid transparent' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addProject} style={{ ...buttonStyle, flex: 1 }}>Ekle</button>
            <button onClick={() => setShowAddProject(false)} style={{ ...buttonStyle, background: '#333', flex: 1 }}>İptal</button>
          </div>
        </Modal>
      )}

      {/* Proje Detay Modal */}
      {selectedProject && (
        <Modal onClose={() => setSelectedProject(null)} wide>
          {/* Başlık */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            {selectedProject.icon && <span style={{ fontSize: '22px' }}>{selectedProject.icon}</span>}
            <h3 style={{ fontSize: '20px', fontWeight: '700', flex: 1 }}>{selectedProject.name}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="number" min="0" max="100" value={selectedProject.progress}
                onChange={e => updateProject(selectedProject.id, { progress: Number(e.target.value) })}
                style={{ ...inputStyle, width: '60px', flex: 0, fontSize: '13px', textAlign: 'center', padding: '5px 8px' }} />
              <span style={{ fontSize: '12px', color: '#555' }}>%</span>
            </div>
            <select value={selectedProject.status} onChange={e => updateProject(selectedProject.id, { status: e.target.value })} style={{ ...selectStyle, fontSize: '13px', padding: '6px 10px' }}>
              <option value="aktif">Aktif</option>
              <option value="beklemede">Beklemede</option>
              <option value="tamamlandı">Tamamlandı</option>
            </select>
            <button onClick={() => deleteProject(selectedProject.id)} style={{ ...buttonStyle, background: '#2a1a1a', color: '#f87171', fontSize: '12px', padding: '6px 10px' }}>Sil</button>
          </div>

          {/* Progress bar */}
          <div style={{ background: '#222', borderRadius: '99px', height: '5px', marginBottom: '20px' }}>
            <div style={{ width: `${selectedProject.progress}%`, height: '5px', borderRadius: '99px', background: selectedProject.color, transition: 'width 0.3s' }} />
          </div>

          {/* Tab */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {['tasks', 'routines'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '6px 16px', borderRadius: '20px', border: '1px solid',
                borderColor: tab === t ? selectedProject.color : '#2a2a2a',
                background: tab === t ? selectedProject.color : 'transparent',
                color: tab === t ? '#fff' : '#666', fontSize: '13px', cursor: 'pointer'
              }}>
                {t === 'tasks' ? `Görevler ${tasks.length > 0 ? `(${completedTasks}/${tasks.length})` : ''}` : 'Rutinler'}
              </button>
            ))}
          </div>

          {/* Görevler */}
          {tab === 'tasks' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="Görev ekle..." style={{ ...inputStyle, fontSize: '13px' }} />
                <input type="date" value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)} style={{ ...inputStyle, flex: 0, width: '150px', fontSize: '13px' }} />
                <button onClick={addTask} style={{ ...buttonStyle, padding: '8px 14px', fontSize: '13px' }}>Ekle</button>
              </div>
              {tasks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px' }}>
                  <div onClick={() => toggleTask(t.id, t.status)} style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid', borderColor: t.status === 'done' ? selectedProject.color : '#555', background: t.status === 'done' ? selectedProject.color : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.status === 'done' && <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span style={{ fontSize: '13px', color: t.status === 'done' ? '#555' : '#ccc', flex: 1, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                  {t.date && <span style={{ fontSize: '11px', color: t.date < today && t.status !== 'done' ? '#f87171' : '#555' }}>{formatDate(t.date)}</span>}
                  <span onClick={() => deleteTask(t.id)} style={{ color: '#444', cursor: 'pointer', fontSize: '13px' }}>✕</span>
                </div>
              ))}
              {tasks.length === 0 && <p style={{ color: '#555', fontSize: '13px' }}>Görev yok.</p>}
            </div>
          )}

          {/* Rutinler */}
          {tab === 'routines' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input value={newRoutine} onChange={e => setNewRoutine(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRoutine()} placeholder="Rutin ekle..." style={{ ...inputStyle, fontSize: '13px' }} />
                <select value={newFrequency} onChange={e => setNewFrequency(e.target.value)} style={{ ...selectStyle, fontSize: '13px' }}>
                  {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                </select>
                <button onClick={addRoutine} style={{ ...buttonStyle, padding: '8px 14px', fontSize: '13px' }}>Ekle</button>
              </div>
              {routines.map(r => {
                const overdue = isRoutineOverdue(r)
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1a1a1a', border: `1px solid ${overdue ? '#f8717133' : '#222'}`, borderLeft: `3px solid ${overdue ? '#f87171' : '#333'}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', color: '#ccc', marginBottom: '3px' }}>{r.title}</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', background: '#222', borderRadius: '4px', padding: '2px 6px', color: '#666' }}>{r.frequency}</span>
                        <span style={{ fontSize: '11px', color: overdue ? '#f87171' : '#555' }}>{getLastDoneLabel(r.last_done)}</span>
                      </div>
                    </div>
                    <button onClick={() => markRoutineDone(r.id)} style={{ background: '#1e2e1e', border: '1px solid #6ee7b733', borderRadius: '6px', color: '#6ee7b7', fontSize: '12px', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>✓ Yapıldı</button>
                    <span onClick={() => deleteRoutine(r.id)} style={{ color: '#444', cursor: 'pointer', fontSize: '13px' }}>✕</span>
                  </div>
                )
              })}
              {routines.length === 0 && <p style={{ color: '#555', fontSize: '13px' }}>Rutin yok.</p>}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose, wide }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.75)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#161616', border: '1px solid #2a2a2a',
        borderRadius: '16px', padding: '28px',
        width: wide ? '860px' : '420px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto', position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#555', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        {children}
      </div>
    </div>
  )
}

const inputStyle = {
  flex: 1, padding: '9px 12px', background: '#1a1a1a',
  border: '1px solid #2a2a2a', borderRadius: '8px',
  color: '#fff', fontSize: '14px', outline: 'none'
}
const selectStyle = {
  padding: '9px 12px', background: '#1a1a1a',
  border: '1px solid #2a2a2a', borderRadius: '8px',
  color: '#fff', fontSize: '14px', outline: 'none'
}
const buttonStyle = {
  padding: '9px 18px', background: '#6366f1',
  border: 'none', borderRadius: '8px',
  color: '#fff', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap'
}

export default Projects