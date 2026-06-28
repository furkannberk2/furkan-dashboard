import { useAuth } from '../components/AuthProvider'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const COLORS = ['#6366f1', '#f472b6', '#fb923c', '#60a5fa', '#a78bfa', '#6ee7b7', '#fbbf24', '#f87171']
const FREQUENCIES = ['Her gün', 'Haftada 1', 'Haftada 2', 'Haftada 3', 'Ayda 1', 'Ayda 2']

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

function Projects() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [phases, setPhases] = useState([])
  const [routines, setRoutines] = useState([])
  const [tab, setTab] = useState('phases')

  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [newIcon, setNewIcon] = useState('')
  const [showAddProject, setShowAddProject] = useState(false)

  const [newPhase, setNewPhase] = useState('')
  const [newPhaseDate, setNewPhaseDate] = useState('')
  const [newRoutine, setNewRoutine] = useState('')
  const [newFrequency, setNewFrequency] = useState('Haftada 1')
  const [newRoutineEnd, setNewRoutineEnd] = useState('')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchProjects() }, [])
  useEffect(() => { if (selectedProject) fetchProjectDetails(selectedProject.id) }, [selectedProject])

  async function fetchProjects() {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
    if (!error) setProjects(data)
  }

  async function fetchProjectDetails(projectId) {
    const [t, r] = await Promise.all([
      supabase.from('project_tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('project_routines').select('*').eq('project_id', projectId).order('created_at', { ascending: true })
    ])
    if (!t.error) setPhases(t.data)
    if (!r.error) setRoutines(r.data)
  }

  async function addProject() {
    if (!newName.trim()) return
    await supabase.from('projects').insert({ user_id: user.id, name: newName, color: newColor, icon: newIcon || null, status: 'aktif', progress: 0, progress_manual: false })
    setNewName(''); setNewIcon(''); setShowAddProject(false)
    fetchProjects()
  }

  async function updateProject(id, data) {
    await supabase.from('projects').update(data).eq('id', id)
    fetchProjects()
    if (selectedProject?.id === id) setSelectedProject(prev => ({ ...prev, ...data }))
  }

  async function setProgressManual(value) {
    await updateProject(selectedProject.id, { progress: value, progress_manual: true })
  }

  async function resetProgressAuto() {
    const total = phases.length
    const done = phases.filter(p => p.status === 'done').length
    const auto = total > 0 ? Math.round((done / total) * 100) : 0
    await updateProject(selectedProject.id, { progress: auto, progress_manual: false })
  }

  async function recalcAutoProgress(projectId, list) {
    // selectedProject elle giriliyorsa otomatik hesaplama yapma
    const proj = projects.find(p => p.id === projectId) || selectedProject
    if (proj?.progress_manual) return
    const total = list.length
    const done = list.filter(p => p.status === 'done').length
    const auto = total > 0 ? Math.round((done / total) * 100) : 0
    await supabase.from('projects').update({ progress: auto }).eq('id', projectId)
    fetchProjects()
    if (selectedProject?.id === projectId) setSelectedProject(prev => ({ ...prev, progress: auto }))
  }

  async function deleteProject(id) {
    await supabase.from('projects').delete().eq('id', id)
    setSelectedProject(null)
    fetchProjects()
  }

  async function addPhase() {
    if (!newPhase.trim()) return
    await supabase.from('project_tasks').insert({ user_id: user.id, project_id: selectedProject.id, title: newPhase, status: 'todo', date: newPhaseDate || null })
    setNewPhase(''); setNewPhaseDate('')
    const { data } = await supabase.from('project_tasks').select('*').eq('project_id', selectedProject.id).order('created_at', { ascending: true })
    setPhases(data || [])
    recalcAutoProgress(selectedProject.id, data || [])
  }

  async function togglePhase(id, status) {
    await supabase.from('project_tasks').update({ status: status === 'todo' ? 'done' : 'todo' }).eq('id', id)
    const { data } = await supabase.from('project_tasks').select('*').eq('project_id', selectedProject.id).order('created_at', { ascending: true })
    setPhases(data || [])
    recalcAutoProgress(selectedProject.id, data || [])
  }

  async function deletePhase(id) {
    await supabase.from('project_tasks').delete().eq('id', id)
    const { data } = await supabase.from('project_tasks').select('*').eq('project_id', selectedProject.id).order('created_at', { ascending: true })
    setPhases(data || [])
    recalcAutoProgress(selectedProject.id, data || [])
  }

  async function addRoutine() {
    if (!newRoutine.trim()) return
    await supabase.from('project_routines').insert({
      user_id: user.id,
      project_id: selectedProject.id,
      title: newRoutine,
      frequency: newFrequency,
      end_date: newRoutineEnd || null
    })
    setNewRoutine(''); setNewRoutineEnd('')
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
    if (routine.end_date && routine.end_date < today) return false
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

  const completedPhases = phases.filter(t => t.status === 'done').length

  return (
    <div style={{ color: 'var(--text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Projeler</h2>
        <button onClick={() => setShowAddProject(true)} style={buttonStyle}>+ Yeni Proje</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
        {projects.map(p => (
          <div key={p.id} onClick={() => { setSelectedProject(p); setTab('phases') }} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderTop: `3px solid ${p.color}`,
            borderRadius: '12px', padding: '14px', cursor: 'pointer'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              {p.icon && <span style={{ fontSize: '18px' }}>{p.icon}</span>}
              <span style={{ fontSize: '14.5px', fontWeight: '600', color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
              <span style={{ fontSize: '10px', color: p.status === 'aktif' ? 'var(--success)' : p.status === 'tamamlandı' ? 'var(--accent)' : 'var(--text-faint)', background: 'var(--bg-item)', padding: '2px 6px', borderRadius: '4px' }}>{p.status}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, background: 'var(--bg-item)', borderRadius: '99px', height: '4px' }}>
                <div style={{ width: `${p.progress}%`, height: '4px', borderRadius: '99px', background: p.color }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{p.progress}%</span>
            </div>
          </div>
        ))}
      </div>
      {projects.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '14px', marginTop: '16px' }}>Henüz proje yok.</p>}

      {/* Yeni Proje Modal */}
      {showAddProject && (
        <Modal onClose={() => setShowAddProject(false)}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '18px' }}>Yeni Proje</h3>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Proje adı" style={{ ...inputStyle, marginBottom: '10px', width: '100%' }} />
          <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="Emoji (örn. 🎬)" style={{ ...inputStyle, marginBottom: '12px', width: '100%' }} />
          <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '8px' }}>Renk</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setNewColor(c)} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: newColor === c ? '3px solid var(--text)' : '3px solid transparent' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addProject} style={{ ...buttonStyle, flex: 1 }}>Ekle</button>
            <button onClick={() => setShowAddProject(false)} style={{ ...buttonStyle, background: 'var(--bg-item)', border: '1px solid var(--border)', color: 'var(--text-secondary)', flex: 1 }}>İptal</button>
          </div>
        </Modal>
      )}

      {/* Proje Detay Modal */}
      {selectedProject && (
        <Modal onClose={() => setSelectedProject(null)} wide>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
              {selectedProject.icon && <span style={{ fontSize: '22px' }}>{selectedProject.icon}</span>}
              <h3 style={{ fontSize: '20px', fontWeight: '700', flex: 1, minWidth: 0 }}>{selectedProject.name}</h3>
              <button onClick={() => deleteProject(selectedProject.id)} style={{ ...buttonStyle, background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '12px', padding: '6px 10px' }}>Sil</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="number" min="0" max="100" value={selectedProject.progress}
                  onChange={e => setProgressManual(Number(e.target.value))}
                  style={{ ...inputStyle, width: '60px', flex: 0, fontSize: '13px', textAlign: 'center', padding: '5px 8px' }} />
                <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>%</span>
              </div>
              {selectedProject.progress_manual && (
                <button onClick={resetProgressAuto} style={{ ...buttonStyle, background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-dim)', fontSize: '12px', padding: '5px 10px' }}>
                  Otomatik hesapla
                </button>
              )}
              <select value={selectedProject.status} onChange={e => updateProject(selectedProject.id, { status: e.target.value })} style={{ ...selectStyle, fontSize: '13px', padding: '6px 10px' }}>
                <option value="aktif">Aktif</option>
                <option value="beklemede">Beklemede</option>
                <option value="tamamlandı">Tamamlandı</option>
              </select>
            </div>
            {!selectedProject.progress_manual && phases.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '6px' }}>
                Otomatik: {completedPhases}/{phases.length} aşama tamamlandı
              </div>
            )}
          </div>

          <div style={{ background: 'var(--bg-item)', borderRadius: '99px', height: '5px', marginBottom: '18px' }}>
            <div style={{ width: `${selectedProject.progress}%`, height: '5px', borderRadius: '99px', background: selectedProject.color, transition: 'width 0.3s' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            {['phases', 'routines'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '6px 14px', borderRadius: '20px', border: '1px solid',
                borderColor: tab === t ? selectedProject.color : 'var(--border-strong)',
                background: tab === t ? selectedProject.color : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-dim)', fontSize: '13px', cursor: 'pointer'
              }}>
                {t === 'phases' ? `Aşamalar ${phases.length > 0 ? `(${completedPhases}/${phases.length})` : ''}` : 'Rutinler'}
              </button>
            ))}
          </div>

          {tab === 'phases' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <input value={newPhase} onChange={e => setNewPhase(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPhase()} placeholder="Aşama ekle..." style={{ ...inputStyle, fontSize: '13px' }} />
                <input type="date" value={newPhaseDate} onChange={e => setNewPhaseDate(e.target.value)} style={{ ...inputStyle, flex: isMobile ? 1 : 0, width: isMobile ? 'auto' : '150px', minWidth: '130px', fontSize: '13px' }} />
                <button onClick={addPhase} style={{ ...buttonStyle, padding: '8px 14px', fontSize: '13px' }}>Ekle</button>
              </div>
              {phases.map((t, i) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', marginBottom: '6px' }}>
                  <div onClick={() => togglePhase(t.id, t.status)} style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid', borderColor: t.status === 'done' ? selectedProject.color : 'var(--text-faint)', background: t.status === 'done' ? selectedProject.color : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.status === 'done' && <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-faint)', flexShrink: 0, fontWeight: '600' }}>Aşama {i + 1}</span>
                  <span style={{ fontSize: '13px', color: t.status === 'done' ? 'var(--text-faint)' : 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
                  {t.date && <span style={{ fontSize: '11px', color: t.date < today && t.status !== 'done' ? 'var(--danger)' : 'var(--text-faint)', flexShrink: 0 }}>{formatDate(t.date)}</span>}
                  <span onClick={() => deletePhase(t.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>✕</span>
                </div>
              ))}
              {phases.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '13px' }}>Aşama yok.</p>}
            </div>
          )}

          {tab === 'routines' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input value={newRoutine} onChange={e => setNewRoutine(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRoutine()} placeholder="Rutin ekle..." style={{ ...inputStyle, fontSize: '13px' }} />
                <select value={newFrequency} onChange={e => setNewFrequency(e.target.value)} style={{ ...selectStyle, fontSize: '13px' }}>
                  {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>Bitiş (opsiyonel):</span>
                <input type="date" value={newRoutineEnd} onChange={e => setNewRoutineEnd(e.target.value)} style={{ ...inputStyle, flex: 0, width: '150px', fontSize: '13px' }} />
                <button onClick={addRoutine} style={{ ...buttonStyle, padding: '8px 14px', fontSize: '13px', marginLeft: 'auto' }}>Ekle</button>
              </div>
              {routines.map(r => {
                const overdue = isRoutineOverdue(r)
                const expired = r.end_date && r.end_date < today
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: `1px solid ${overdue ? 'var(--danger)' : 'var(--border)'}`, borderLeft: `3px solid ${expired ? 'var(--text-faded)' : overdue ? 'var(--danger)' : 'var(--text-faded)'}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', opacity: expired ? 0.5 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '3px' }}>{r.title}</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', background: 'var(--bg-card)', borderRadius: '4px', padding: '2px 6px', color: 'var(--text-dim)' }}>{r.frequency}</span>
                        {r.end_date && <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>→ {formatDate(r.end_date)}</span>}
                        <span style={{ fontSize: '11px', color: overdue ? 'var(--danger)' : 'var(--text-faint)' }}>{getLastDoneLabel(r.last_done)}</span>
                        {expired && <span style={{ fontSize: '11px', color: 'var(--text-faded)' }}>· süresi doldu</span>}
                      </div>
                    </div>
                    {!expired && (
                      <button onClick={() => markRoutineDone(r.id)} style={{ background: 'transparent', border: '1px solid var(--success)', borderRadius: '6px', color: 'var(--success)', fontSize: '12px', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>✓ Yapıldı</button>
                    )}
                    <span onClick={() => deleteRoutine(r.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '13px' }}>✕</span>
                  </div>
                )
              })}
              {routines.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '13px' }}>Rutin yok.</p>}
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
      background: 'rgba(0,0,0,0.65)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px'
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
        borderRadius: '16px', padding: '22px',
        width: wide ? '860px' : '420px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto', position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', background: 'transparent', border: 'none', color: 'var(--text-faint)', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        {children}
      </div>
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

export default Projects