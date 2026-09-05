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
  const [noteInput, setNoteInput] = useState('')

  // Seçili proje değişince not alanını doldur
  useEffect(() => { setNoteInput(selectedProject?.note || '') }, [selectedProject?.id])

  async function saveNote() {
    if (!selectedProject) return
    await updateProject(selectedProject.id, { note: noteInput })
  }
  async function saveDeadline(date) {
    if (!selectedProject) return
    await updateProject(selectedProject.id, { deadline: date || null })
  }

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchProjects() }, [])
  useEffect(() => { if (selectedProject) fetchProjectDetails(selectedProject.id) }, [selectedProject])

  async function fetchProjects() {
    const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
    if (!error) setProjects(data)
  }

  async function fetchProjectDetails(projectId) {
    const [ph, rt] = await Promise.all([
      supabase.from('project_tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
      supabase.from('project_routines').select('*').eq('project_id', projectId).order('created_at', { ascending: true })
    ])
    if (!ph.error) setPhases(ph.data)
    if (!rt.error) setRoutines(rt.data)
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
  const completedPhases = phases.filter(ph => ph.status === 'done').length

  // Sıradaki aşama (ilk tamamlanmamış)
  const nextPhase = phases.find(ph => ph.status !== 'done')

  // Kalan süre (deadline'a göre)
  function getDaysLeft(deadline) {
    if (!deadline) return null
    const diff = Math.ceil((new Date(deadline + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24))
    return diff
  }

  // Tempo: son 7 günde tamamlanan aşama sayısı
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentlyDone = phases.filter(ph => ph.status === 'done' && ph.updated_at && new Date(ph.updated_at) >= weekAgo).length

  return (
    <div style={{ color: 'var(--text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>{t('projects_page.projectsTitle')}</h2>
        <button onClick={() => setShowAddProject(true)} style={primaryBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t('projects_page.newProject')}
        </button>
      </div>

      {projects.length === 0 && <p style={{ color: 'var(--text-faint)', fontSize: '14px', marginTop: '16px' }}>{t('projects_page.noProject')}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px 1fr', gap: '16px', alignItems: 'start' }}>

        {/* SOL: Proje listesi */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projects.map(p => {
            const isSel = selectedProject?.id === p.id
            return (
              <div key={p.id} onClick={() => { setSelectedProject(p); setTab('phases') }} style={{
                background: isSel ? 'var(--bg-card)' : 'var(--bg-item)',
                border: isSel ? `2px solid ${p.color}` : '1px solid var(--border)',
                borderRadius: '12px', padding: '12px 13px', cursor: 'pointer', transition: 'border-color 0.15s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  {p.icon && <span style={{ fontSize: '14px' }}>{p.icon}</span>}
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                </div>
                <div style={{ background: 'var(--bg-soft)', borderRadius: '99px', height: '5px', marginBottom: '6px' }}>
                  <div style={{ width: `${p.progress}%`, height: '5px', borderRadius: '99px', background: p.color }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>{statusLabelT(p.status)}</span>
                  <span>{p.progress}%</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* SAĞ: Seçili proje detayı */}
        {!selectedProject ? (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '48px 24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '14px' }}>
            {t('projects_page.selectProject')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Başlık + durum + sil */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span style={{ width: '11px', height: '11px', borderRadius: '50%', background: selectedProject.color, flexShrink: 0 }} />
                {selectedProject.icon && <span style={{ fontSize: '20px' }}>{selectedProject.icon}</span>}
                <h3 style={{ fontSize: '17px', fontWeight: '600', flex: 1, minWidth: 0 }}>{selectedProject.name}</h3>
                <select value={selectedProject.status} onChange={e => updateProject(selectedProject.id, { status: e.target.value })} style={{ ...selectStyle, fontSize: '12px', padding: '5px 9px' }}>
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{statusLabelT(s.key)}</option>)}
                </select>
                <button onClick={() => deleteProject(selectedProject.id)} style={ghostDangerBtn}>{t('projects_page.delete')}</button>
              </div>

              {/* İstatistik kartları */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '9px' }}>
                <div style={statCard}>
                  <div style={statLabel}>{t('projects_page.progress')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="number" min="0" max="100" value={selectedProject.progress}
                      onChange={e => setProgressManual(Number(e.target.value))}
                      onFocus={e => e.target.select()}
                      style={{ ...statValue, width: '48px', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', padding: 0 }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>%</span>
                  </div>
                  {selectedProject.progress_manual && (
                    <button onClick={resetProgressAuto} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '10px', cursor: 'pointer', padding: '2px 0 0', textAlign: 'left' }}>{t('projects_page.autoCalc')}</button>
                  )}
                </div>
                <div style={statCard}>
                  <div style={statLabel}>{t('projects_page.phasesStat')}</div>
                  <div style={statValue}>{completedPhases}<span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>/{phases.length}</span></div>
                </div>
                <div style={statCard}>
                  <div style={statLabel}>{t('projects_page.tempo')}</div>
                  <div style={statValue}>{recentlyDone}<span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> {t('projects_page.tempoUnit')}</span></div>
                </div>
                <div style={statCard}>
                  <div style={statLabel}>{t('projects_page.daysLeft')}</div>
                  {(() => {
                    const dl = getDaysLeft(selectedProject.deadline)
                    if (dl === null) return <div style={{ ...statValue, fontSize: '13px', color: 'var(--text-faint)' }}>{t('projects_page.noDeadline')}</div>
                    if (dl < 0) return <div style={{ ...statValue, color: 'var(--danger)', fontSize: '15px' }}>{Math.abs(dl)} {t('projects_page.daysLeftUnit')} {t('projects_page.overdueDeadline')}</div>
                    return <div style={statValue}>{dl}<span style={{ color: 'var(--text-muted)', fontSize: '12px' }}> {t('projects_page.daysLeftUnit')}</span></div>
                  })()}
                </div>
              </div>

              {/* Ana ilerleme çubuğu */}
              <div style={{ background: 'var(--bg-soft)', borderRadius: '99px', height: '6px', marginTop: '12px' }}>
                <div style={{ width: `${selectedProject.progress}%`, height: '6px', borderRadius: '99px', background: selectedProject.color, transition: 'width 0.3s' }} />
              </div>

              {/* Sıradaki aşama vurgusu */}
              {nextPhase && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--accent)', fontWeight: '600' }}>{t('projects_page.nextUp')}:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{nextPhase.title}</span>
                </div>
              )}
              {!nextPhase && phases.length > 0 && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--success)' }}>{t('projects_page.allDone')}</div>
              )}
            </div>

            {/* Sekmeler */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {['phases', 'routines'].map(tabKey => (
                <button key={tabKey} onClick={() => setTab(tabKey)} style={{
                  padding: '7px 15px', borderRadius: '8px', border: '1px solid',
                  borderColor: tab === tabKey ? selectedProject.color : 'var(--border)',
                  background: tab === tabKey ? selectedProject.color : 'transparent',
                  color: tab === tabKey ? '#fff' : 'var(--text-dim)', fontSize: '13px', cursor: 'pointer', fontWeight: '500'
                }}>
                  {tabKey === 'phases' ? `${t('projects_page.phases')} ${phases.length > 0 ? `(${completedPhases}/${phases.length})` : ''}` : t('projects_page.routines')}
                </button>
              ))}
            </div>

            {/* İçerik kartı */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px' }}>
              {tab === 'phases' && (
                <div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <input value={newPhase} onChange={e => setNewPhase(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPhase()} placeholder={t('projects_page.addPhase')} style={{ ...inputStyle, fontSize: '13px' }} />
                    <input type="date" value={newPhaseDate} onChange={e => setNewPhaseDate(e.target.value)} style={{ ...inputStyle, flex: isMobile ? 1 : 0, width: isMobile ? 'auto' : '150px', minWidth: '130px', fontSize: '13px' }} />
                    <button onClick={addPhase} style={secondaryBtn}>{t('common.add')}</button>
                  </div>
                  {/* Mini timeline */}
                  {phases.map((ph, i) => {
                    const isDone = ph.status === 'done'
                    const isNext = nextPhase && ph.id === nextPhase.id
                    const isLast = i === phases.length - 1
                    return (
                      <div key={ph.id} style={{ display: 'flex', gap: '11px', alignItems: 'stretch' }}>
                        {/* Timeline çizgisi + nokta */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div onClick={() => togglePhase(ph.id, ph.status)} style={{
                            width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer',
                            border: `2px solid ${isDone ? selectedProject.color : isNext ? 'var(--accent)' : 'var(--text-faint)'}`,
                            background: isDone ? selectedProject.color : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            {isDone && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </div>
                          {!isLast && <div style={{ width: '2px', flex: 1, minHeight: '14px', background: isDone ? selectedProject.color : 'var(--border)' }} />}
                        </div>
                        {/* İçerik */}
                        <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? '0' : '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-faint)', fontWeight: '600', flexShrink: 0 }}>{t('projects_page.phase')} {i + 1}</span>
                            {isNext && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: '600' }}>{t('projects_page.nextUp')}</span>}
                            {ph.date && <span style={{ fontSize: '10px', color: ph.date < today && !isDone ? 'var(--danger)' : 'var(--text-faint)', marginLeft: 'auto', flexShrink: 0 }}>{formatDate(ph.date)}</span>}
                            <span onClick={() => deletePhase(ph.id)} style={{ color: 'var(--text-faded)', cursor: 'pointer', fontSize: '13px', flexShrink: 0, marginLeft: ph.date ? '0' : 'auto' }}>✕</span>
                          </div>
                          <div style={{ fontSize: '13.5px', color: isDone ? 'var(--text-faint)' : 'var(--text-secondary)', textDecoration: isDone ? 'line-through' : 'none', marginTop: '2px' }}>{ph.title}</div>
                        </div>
                      </div>
                    )
                  })}
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
            </div>

            {/* Hedef + Not panelleri */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>{t('projects_page.goal')}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '6px' }}>{t('projects_page.goalDate')}</div>
                <input type="date" value={selectedProject.deadline || ''} onChange={e => saveDeadline(e.target.value)} style={{ ...inputStyle, width: '100%', fontSize: '13px' }} />
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>{t('projects_page.note')}</div>
                <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder={t('projects_page.notePlaceholder')} rows={3}
                  style={{ ...inputStyle, width: '100%', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' }} />
                {noteInput !== (selectedProject.note || '') && (
                  <button onClick={saveNote} style={{ ...secondaryBtn, marginTop: '8px' }}>{t('projects_page.saveNote')}</button>
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Yeni Proje Modal */}
      {showAddProject && (
        <Modal onClose={() => setShowAddProject(false)}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '18px' }}>{t('projects_page.newProject')}</h3>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('projects_page.projectName')} style={{ ...inputStyle, marginBottom: '10px', width: '100%' }} />
          <input value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder={t('projects_page.emojiPlaceholder')} style={{ ...inputStyle, marginBottom: '12px', width: '100%' }} />
          <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '8px' }}>{t('projects_page.color')}</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setNewColor(c)} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: newColor === c ? '3px solid var(--text)' : '3px solid transparent' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAddProject(false)} style={ghostBtn}>{t('common.cancel')}</button>
            <button onClick={addProject} style={primaryBtn}>{t('common.add')}</button>
          </div>
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

// Yeni sofistike buton dili (U2 kararları: 6px köşe, hiyerarşi)
const primaryBtn = {
  padding: '9px 15px', background: 'var(--text)', color: 'var(--bg)',
  border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '500',
  cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px'
}
const secondaryBtn = {
  padding: '9px 14px', background: 'transparent', color: 'var(--text)',
  border: '1px solid var(--border-strong)', borderRadius: '6px', fontSize: '13px',
  cursor: 'pointer', whiteSpace: 'nowrap'
}
const ghostBtn = {
  padding: '9px 14px', background: 'transparent', color: 'var(--text-secondary)',
  border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap'
}
const ghostDangerBtn = {
  padding: '5px 11px', background: 'transparent', color: 'var(--danger)',
  border: '1px solid var(--danger)', borderRadius: '6px', fontSize: '12px',
  cursor: 'pointer', whiteSpace: 'nowrap'
}
const statCard = {
  background: 'var(--bg-item)', borderRadius: '9px', padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: '2px'
}
const statLabel = { fontSize: '11px', color: 'var(--text-muted)' }
const statValue = { fontSize: '18px', fontWeight: '600', color: 'var(--text)' }

export default Projects