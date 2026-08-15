import { useAuth } from '../components/AuthProvider'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

const COLORS = ['#6366f1', '#f472b6', '#fb923c', '#60a5fa', '#a78bfa', '#6ee7b7', '#fbbf24', '#f87171']
const FREQUENCIES = [
  { key: 'daily', label: 'Her gün' },
  { key: 'weekly_1', label: 'Haftada 1' },
  { key: 'weekly_2', label: 'Haftada 2' },
  { key: 'weekly_3', label: 'Haftada 3' },
  { key: 'biweekly_1', label: '2 haftada 1' },
  { key: 'monthly_1', label: 'Ayda 1' },
  { key: 'monthly_2', label: 'Ayda 2' },
]
const freqLabel = (key) => FREQUENCIES.find(f => f.key === key)?.label || key

// Proje durumu anahtar tabanlı: veriye 'key' yazılır, gösterimde 'label'
const STATUSES = [
  { key: 'active', label: 'Aktif' },
  { key: 'paused', label: 'Beklemede' },
  { key: 'completed', label: 'Tamamlandı' },
]
const statusLabel = (key) => STATUSES.find(s => s.key === key)?.label || key
const WEEKDAYS = [
  { v: 1, label: 'Pzt' }, { v: 2, label: 'Sal' }, { v: 3, label: 'Çar' },
  { v: 4, label: 'Per' }, { v: 5, label: 'Cum' }, { v: 6, label: 'Cmt' }, { v: 7, label: 'Paz' }
]
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
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-US' : 'tr-TR'
  const freqLabelT = (key) => t('frequency.' + key, { defaultValue: key })
  const statusLabelT = (key) => t('status.' + key, { defaultValue: key })
  const weekdayLabel = (v) => {
    const keys = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat', 7: 'sun' }
    return t('weekdays.' + keys[v], { defaultValue: v })
  }
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
  const [newFrequency, setNewFrequency] = useState('weekly_1')
  const [newRoutineEnd, setNewRoutineEnd] = useState('')
  const [newRoutineDays, setNewRoutineDays] = useState([])
  const [newRoutineMonthDays, setNewRoutineMonthDays] = useState([])
  const [newBiweeklyAnchor, setNewBiweeklyAnchor] = useState('')

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
    await supabase.from('projects').insert({ user_id: user.id, name: newName, color: newColor, icon: newIcon || null, status: 'active', progress: 0, progress_manual: false })
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
    await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id)
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
    await supabase.from('project_tasks').delete().eq('id', id).eq('user_id', user.id)
    const { data } = await supabase.from('project_tasks').select('*').eq('project_id', selectedProject.id).order('created_at', { ascending: true })
    setPhases(data || [])
    recalcAutoProgress(selectedProject.id, data || [])
  }

async function addRoutine() {
  if (!newRoutine.trim()) return
  const payload = {
    user_id: user.id,
    project_id: selectedProject.id,
    title: newRoutine,
    frequency: newFrequency,
    end_date: newRoutineEnd || null,
    days_of_week: null,
    days_of_month: null,
    biweekly_anchor: null
  }
  if (['weekly_1', 'weekly_2', 'weekly_3'].includes(newFrequency)) {
    payload.days_of_week = newRoutineDays
  }
  if (newFrequency === 'biweekly_1') {
    payload.days_of_week = newRoutineDays
    payload.biweekly_anchor = newBiweeklyAnchor || today
  }
  if (['monthly_1', 'monthly_2'].includes(newFrequency)) {
    payload.days_of_month = newRoutineMonthDays
  }
  await supabase.from('project_routines').insert(payload)
  setNewRoutine(''); setNewRoutineEnd(''); setNewRoutineDays([]); setNewRoutineMonthDays([]); setNewBiweeklyAnchor('')
  fetchProjectDetails(selectedProject.id)
}

  async function markRoutineDone(id) {
    await supabase.from('project_routines').update({ last_done: new Date().toISOString() }).eq('id', id)
    fetchProjectDetails(selectedProject.id)
  }

  async function deleteRoutine(id) {
    await supabase.from('project_routines').delete().eq('id', id).eq('user_id', user.id)
    fetchProjectDetails(selectedProject.id)
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  }

  function getLastDoneLabel(lastDone) {
    if (!lastDone) return t('projects_page.neverDone')
    const d = new Date(lastDone)
    const diff = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24))
    if (diff === 0) return t('projects_page.doneToday')
    if (diff === 1) return t('projects_page.doneYesterday')
    return `${diff} ${t('projects_page.daysAgo')}`
  }

  function isRoutineOverdue(routine) {
    if (routine.end_date && routine.end_date < today) return false
    if (!routine.last_done) return true
    const diff = Math.floor((new Date() - new Date(routine.last_done)) / (1000 * 60 * 60 * 24))
    if (routine.frequency === 'daily') return diff >= 1
    if (routine.frequency === 'weekly_1') return diff >= 7
    if (routine.frequency === 'weekly_2') return diff >= 4
    if (routine.frequency === 'weekly_3') return diff >= 3
    if (routine.frequency === 'monthly_1') return diff >= 30
    if (routine.frequency === 'monthly_2') return diff >= 15
    return false
  }

  function getMaxDays(freq) {
  if (freq === 'weekly_1' || freq === 'biweekly_1') return 1
  if (freq === 'weekly_2') return 2
  if (freq === 'weekly_3') return 3
  if (freq === 'monthly_1') return 1
  if (freq === 'monthly_2') return 2
  return 0
}

function toggleWeekday(v) {
  const max = getMaxDays(newFrequency)
  setNewRoutineDays(prev => {
    if (prev.includes(v)) return prev.filter(x => x !== v)
    if (prev.length >= max) return [...prev.slice(1), v]
    return [...prev, v]
  })
}

function toggleMonthDay(v) {
  const max = getMaxDays(newFrequency)
  setNewRoutineMonthDays(prev => {
    if (prev.includes(v)) return prev.filter(x => x !== v)
    if (prev.length >= max) return [...prev.slice(1), v]
    return [...prev, v]
  })
} 
  const completedPhases = phases.filter(t => t.status === 'done').length

  return (
    <div style={{ color: 'var(--text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>{t('projects_page.projectsTitle')}</h2>
        <button onClick={() => setShowAddProject(true)} style={buttonStyle}>{t('projects_page.addProjectBtn')}</button>
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
              <span style={{ fontSize: '10px', color: p.status === 'active' ? 'var(--success)' : p.status === 'completed' ? 'var(--accent)' : 'var(--text-faint)', background: 'var(--bg-item)', padding: '2px 6px', borderRadius: '4px' }}>{statusLabelT(p.status)}</span>
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
      {projects.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '14px', marginTop: '16px' }}>{t('projects_page.noProject')}</p>}

      {/* Yeni Proje Modal */}
      {showAddProject && (
        <Modal onClose={() => setShowAddProject(false)}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '18px' }}>{t('projects_page.newProject')}</h3>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('projects_page.projectName')} style={{ ...inputStyle, marginBottom: '10px', width: '100%' }} />
          <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder={t('projects_page.emojiPlaceholder')} style={{ ...inputStyle, marginBottom: '12px', width: '100%' }} />
          <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '8px' }}>Renk</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setNewColor(c)} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: newColor === c ? '3px solid var(--text)' : '3px solid transparent' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addProject} style={{ ...buttonStyle, flex: 1 }}>{t('common.add')}</button>
            <button onClick={() => setShowAddProject(false)} style={{ ...buttonStyle, background: 'var(--bg-item)', border: '1px solid var(--border)', color: 'var(--text-secondary)', flex: 1 }}>{t('common.cancel')}</button>
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
              <button onClick={() => deleteProject(selectedProject.id)} style={{ ...buttonStyle, background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '12px', padding: '6px 10px' }}>{t('projects_page.delete')}</button>
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
                  {t('projects_page.autoCalc')}
                </button>
              )}
              <select value={selectedProject.status} onChange={e => updateProject(selectedProject.id, { status: e.target.value })} style={{ ...selectStyle, fontSize: '13px', padding: '6px 10px' }}>
                {STATUSES.map(s => <option key={s.key} value={s.key}>{statusLabelT(s.key)}</option>)}
              </select>
            </div>
            {!selectedProject.progress_manual && phases.length > 0 && (
              <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '6px' }}>
                {t('projects_page.autoDone', { done: completedPhases, total: phases.length })}
              </div>
            )}
          </div>

          <div style={{ background: 'var(--bg-item)', borderRadius: '99px', height: '5px', marginBottom: '18px' }}>
            <div style={{ width: `${selectedProject.progress}%`, height: '5px', borderRadius: '99px', background: selectedProject.color, transition: 'width 0.3s' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
            {['phases', 'routines'].map(tabKey => (
              <button key={tabKey} onClick={() => setTab(tabKey)} style={{
                padding: '6px 14px', borderRadius: '20px', border: '1px solid',
                borderColor: tab === tabKey ? selectedProject.color : 'var(--border-strong)',
                background: tab === tabKey ? selectedProject.color : 'transparent',
                color: tab === tabKey ? '#fff' : 'var(--text-dim)', fontSize: '13px', cursor: 'pointer'
              }}>
                {tabKey === 'phases' ? `${t('projects_page.phases')} ${phases.length > 0 ? `(${completedPhases}/${phases.length})` : ''}` : t('projects_page.routines')}
              </button>
            ))}
          </div>

          {tab === 'phases' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <input value={newPhase} onChange={e => setNewPhase(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPhase()} placeholder={t('projects_page.addPhase')} style={{ ...inputStyle, fontSize: '13px' }} />
                <input type="date" value={newPhaseDate} onChange={e => setNewPhaseDate(e.target.value)} style={{ ...inputStyle, flex: isMobile ? 1 : 0, width: isMobile ? 'auto' : '150px', minWidth: '130px', fontSize: '13px' }} />
                <button onClick={addPhase} style={{ ...buttonStyle, padding: '8px 14px', fontSize: '13px' }}>{t('common.add')}</button>
              </div>
              {phases.map((ph, i) => (
                <div key={ph.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', marginBottom: '6px' }}>
                  <div onClick={() => togglePhase(ph.id, ph.status)} style={{ width: '16px', height: '16px', borderRadius: '4px', border: '2px solid', borderColor: ph.status === 'done' ? selectedProject.color : 'var(--text-faint)', background: ph.status === 'done' ? selectedProject.color : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ph.status === 'done' && <svg width="8" height="6" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-faint)', flexShrink: 0, fontWeight: '600' }}>{t('projects_page.phase')} {i + 1}</span>
                  <span style={{ fontSize: '13px', color: ph.status === 'done' ? 'var(--text-faint)' : 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: ph.status === 'done' ? 'line-through' : 'none' }}>{ph.title}</span>
                  {ph.date && <span style={{ fontSize: '11px', color: ph.date < today && ph.status !== 'done' ? 'var(--danger)' : 'var(--text-faint)', flexShrink: 0 }}>{formatDate(ph.date)}</span>}
                  <span onClick={() => deletePhase(ph.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>✕</span>
                </div>
              ))}
              {phases.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '13px' }}>{t('projects_page.noPhase')}</p>}
            </div>
          )}

{tab === 'routines' && (
  <div>
    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
      <input value={newRoutine} onChange={e => setNewRoutine(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRoutine()} placeholder={t('projects_page.addRoutine')} style={{ ...inputStyle, fontSize: '13px' }} />
      <select value={newFrequency} onChange={e => { setNewFrequency(e.target.value); setNewRoutineDays([]); setNewRoutineMonthDays([]) }} style={{ ...selectStyle, fontSize: '13px' }}>
        {FREQUENCIES.map(f => <option key={f.key} value={f.key}>{freqLabelT(f.key)}</option>)}
      </select>
    </div>

    {/* Haftalık frekanslar için gün seçimi */}
    {(['weekly_1', 'weekly_2', 'weekly_3', 'biweekly_1'].includes(newFrequency)) && (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '6px' }}>
          {t('projects_page.whichDays')} ({newRoutineDays.length}/{getMaxDays(newFrequency)})
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {WEEKDAYS.map(d => (
            <button key={d.v} type="button" onClick={() => toggleWeekday(d.v)} style={{
              padding: '6px 10px', borderRadius: '6px', border: '1px solid',
              borderColor: newRoutineDays.includes(d.v) ? selectedProject.color : 'var(--border-strong)',
              background: newRoutineDays.includes(d.v) ? selectedProject.color : 'transparent',
              color: newRoutineDays.includes(d.v) ? '#fff' : 'var(--text-dim)',
              fontSize: '12px', cursor: 'pointer', minWidth: '40px'
            }}>{weekdayLabel(d.v)}</button>
          ))}
        </div>
        {newFrequency === 'biweekly_1' && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{t('projects_page.startWeek')}</span>
            <input type="date" value={newBiweeklyAnchor} onChange={e => setNewBiweeklyAnchor(e.target.value)} style={{ ...inputStyle, flex: 0, width: '150px', fontSize: '13px' }} />
          </div>
        )}
      </div>
    )}

    {/* Aylık frekanslar için ay günü seçimi */}
    {['monthly_1', 'monthly_2'].includes(newFrequency) && (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '6px' }}>
          {t('projects_page.whichMonthDays')} ({newRoutineMonthDays.length}/{getMaxDays(newFrequency)})
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
            <button key={d} type="button" onClick={() => toggleMonthDay(d)} style={{
              padding: '4px 0', borderRadius: '4px', border: '1px solid',
              borderColor: newRoutineMonthDays.includes(d) ? selectedProject.color : 'var(--border-strong)',
              background: newRoutineMonthDays.includes(d) ? selectedProject.color : 'transparent',
              color: newRoutineMonthDays.includes(d) ? '#fff' : 'var(--text-dim)',
              fontSize: '11px', cursor: 'pointer', width: '28px'
            }}>{d}</button>
          ))}
        </div>
      </div>
    )}

    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{t('projects_page.endOptional')}</span>
      <input type="date" value={newRoutineEnd} onChange={e => setNewRoutineEnd(e.target.value)} style={{ ...inputStyle, flex: 0, width: '150px', fontSize: '13px' }} />
      <button onClick={addRoutine} style={{ ...buttonStyle, padding: '8px 14px', fontSize: '13px', marginLeft: 'auto' }}>{t('common.add')}</button>
    </div>

    {routines.map(r => {
      const overdue = isRoutineOverdue(r)
      const expired = r.end_date && r.end_date < today
      return (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-item)', border: `1px solid ${overdue ? 'var(--danger)' : 'var(--border)'}`, borderLeft: `3px solid ${expired ? 'var(--text-faded)' : overdue ? 'var(--danger)' : 'var(--text-faded)'}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', opacity: expired ? 0.5 : 1 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '3px' }}>{r.title}</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', background: 'var(--bg-card)', borderRadius: '4px', padding: '2px 6px', color: 'var(--text-dim)' }}>{freqLabelT(r.frequency)}</span>
              {r.days_of_week?.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                  {r.days_of_week.map(v => weekdayLabel(v)).join(', ')}
                </span>
              )}
              {r.days_of_month?.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                  {t('projects_page.monthDayOf', { days: r.days_of_month.join(', ') })}
                </span>
              )}
              {r.end_date && <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>→ {formatDate(r.end_date)}</span>}
              <span style={{ fontSize: '11px', color: overdue ? 'var(--danger)' : 'var(--text-faint)' }}>{getLastDoneLabel(r.last_done)}</span>
              {expired && <span style={{ fontSize: '11px', color: 'var(--text-faded)' }}>{t('projects_page.expired')}</span>}
            </div>
          </div>
          {!expired && (
            <button onClick={() => markRoutineDone(r.id)} style={{ background: 'transparent', border: '1px solid var(--success)', borderRadius: '6px', color: 'var(--success)', fontSize: '12px', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{t('projects_page.done')}</button>
          )}
          <span onClick={() => deleteRoutine(r.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '13px' }}>✕</span>
        </div>
      )
    })}
    {routines.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '13px' }}>{t('projects_page.noRoutine')}</p>}
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