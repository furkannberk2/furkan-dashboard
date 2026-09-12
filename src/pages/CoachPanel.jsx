import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../components/AuthProvider'
import { BACKEND } from '../config'

// Her bağlam için sayfaya özel hızlı öneriler (çeviri anahtarları)
const SUGGESTIONS = {
  general: ['general_s1', 'general_s2', 'general_s3'],
  calories: ['calories_s1', 'calories_s2', 'calories_s3'],
  finance: ['finance_s1', 'finance_s2', 'finance_s3'],
  tasks: ['tasks_s1', 'tasks_s2', 'tasks_s3'],
  projects: ['projects_s1', 'projects_s2', 'projects_s3'],
  habits: ['habits_s1', 'habits_s2', 'habits_s3'],
  stocks: ['stocks_s1', 'stocks_s2', 'stocks_s3'],
  mail: ['mail_s1', 'mail_s2', 'mail_s3']
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

// context: 'general' | 'calories' | 'finance' | ...
// onClose: paneli kapat
export default function CoachPanel({ context = 'general', onClose }) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => { if (user) loadHistory() }, [user, context])
  useEffect(() => { scrollToBottom() }, [messages, loading])

  // ESC ile kapat
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function scrollToBottom() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }

  async function loadHistory() {
    setHistoryLoaded(false)
    try {
      const res = await fetch(`${BACKEND}/api/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'history', user_id: user.id, context })
      })
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (e) { console.error(e) }
    finally { setHistoryLoaded(true) }
  }

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg, id: 'temp-' + Date.now() }])
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/api/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', user_id: user.id, message: msg, context })
      })
      const data = await res.json()
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Hata: ' + data.error, id: 'err-' + Date.now() }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, action_taken: data.actions?.length ? data.actions : null, id: 'a-' + Date.now() }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Bağlantı hatası.', id: 'err-' + Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  async function clearHistory() {
    if (!confirm(t('coach.clearConfirm'))) return
    try {
      await fetch(`${BACKEND}/api/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', user_id: user.id, context })
      })
      setMessages([])
    } catch (e) { console.error(e) }
  }

  const ctxLabel = t('coach.ctx_' + context, { defaultValue: t('coach.ctx_general') })
  const suggestions = SUGGESTIONS[context] || SUGGESTIONS.general

  // Panel konumu: masaüstü sağdan, mobil alttan (%60)
  const panelStyle = isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, height: '60vh', borderTopLeftRadius: '18px', borderTopRightRadius: '18px', zIndex: 1001, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', boxShadow: '0 -8px 30px rgba(0,0,0,0.3)' }
    : { position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px', maxWidth: '90vw', zIndex: 1001, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderLeft: '1px solid var(--border-strong)', boxShadow: '-8px 0 30px rgba(0,0,0,0.2)' }

  return (
    <>
      {/* Arka plan karartma (dışına tıkla = kapat) */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }} />

      <div style={panelStyle}>
        {/* Mobil tutamaç */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-strong)' }} />
          </div>
        )}

        {/* Başlık */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--purple))', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{t('nav.coach', { defaultValue: 'Koç' })}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ctxLabel}</div>
          </div>
          {messages.length > 0 && (
            <button onClick={clearHistory} title={t('coach.clearChat')} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '15px', padding: '4px' }}>🗑</button>
          )}
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '2px 6px' }}>✕</button>
        </div>

        {/* Mesajlar */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          {historyLoaded && messages.length === 0 && (
            <div>
              <div style={{ background: 'var(--bg-item)', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {t('coach.welcomeCtx', { defaultValue: 'Merhaba! Bu sayfa hakkında konuşabilir ya da bir şey ekleyebilirsin.' })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {suggestions.map(sKey => {
                  const label = t('coachSuggestions.' + sKey, { defaultValue: '' })
                  if (!label) return null
                  return (
                    <button key={sKey} onClick={() => send(label)} style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', fontSize: '12.5px', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '10px' }}>
              <div style={{
                maxWidth: '85%', padding: '9px 13px', borderRadius: '13px', fontSize: '13px', lineHeight: '1.55', whiteSpace: 'pre-wrap',
                background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-item)',
                color: m.role === 'user' ? '#fff' : 'var(--text-secondary)',
                border: m.role === 'user' ? 'none' : '1px solid var(--border)'
              }}>
                {m.content}
                {m.action_taken && m.action_taken.length > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: m.role === 'user' ? 'rgba(255,255,255,0.8)' : 'var(--success)' }}>
                    ✓ {m.action_taken.map(a => a.result).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '10px' }}>
              <div style={{ padding: '9px 13px', borderRadius: '13px', fontSize: '13px', background: 'var(--bg-item)', color: 'var(--text-faint)', border: '1px solid var(--border)' }}>{t('coach.thinking')}</div>
            </div>
          )}
        </div>

        {/* Girdi */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={t('coach.askCoach')}
            style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-item)', border: '1px solid var(--border-strong)', borderRadius: '8px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width: '38px', flexShrink: 0, background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: '8px', fontSize: '17px', cursor: 'pointer', opacity: (loading || !input.trim()) ? 0.5 : 1 }}>↑</button>
        </div>
      </div>
    </>
  )
}