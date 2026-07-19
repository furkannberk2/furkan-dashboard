import { useAuth } from '../components/AuthProvider'
import { useState, useEffect, useRef } from 'react'
import { BACKEND } from '../config'

const TONES = [
  { key: 'motive', label: '💪 Motive Edici', desc: 'Enerjik antrenör' },
  { key: 'sakin', label: '🧘 Sakin', desc: 'Bilge mentor' },
  { key: 'direkt', label: '🎯 Direkt', desc: 'Net ve veri odaklı' }
]

const SUGGESTIONS = [
  'Bugün nasıl gidiyorum?',
  'Bu ay finansal durumum nasıl?',
  'Bana bugün için bir plan yap',
  'Hangi alışkanlıkları kaçırdım?'
]

function Coach() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tone, setTone] = useState('motive')
  const [showSettings, setShowSettings] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => { if (user) loadHistory() }, [user])
  useEffect(() => { scrollToBottom() }, [messages, loading])

  function scrollToBottom() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }

  async function loadHistory() {
    try {
      const res = await fetch(`${BACKEND}/api/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'history', user_id: user.id })
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
    // Kullanıcı mesajını hemen göster
    setMessages(prev => [...prev, { role: 'user', content: msg, id: 'temp-' + Date.now() }])
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/api/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', user_id: user.id, message: msg })
      })
      const data = await res.json()
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Bir hata oldu: ' + data.error, id: 'err-' + Date.now() }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant', content: data.reply,
          action_taken: data.actions?.length ? data.actions : null,
          id: 'a-' + Date.now()
        }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Bağlantı hatası.', id: 'err-' + Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  async function changeTone(newTone) {
    setTone(newTone)
    try {
      await fetch(`${BACKEND}/api/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_tone', user_id: user.id, tone: newTone })
      })
    } catch (e) { console.error(e) }
  }

  async function clearHistory() {
    if (!confirm('Tüm sohbet geçmişi silinecek. Emin misin?')) return
    try {
      await fetch(`${BACKEND}/api/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', user_id: user.id })
      })
      setMessages([])
    } catch (e) { console.error(e) }
  }

  return (
    <div style={{ color: 'var(--text)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', maxWidth: '780px' }}>
      {/* Başlık */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Koç</h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-faint)', margin: '4px 0 0' }}>Kişisel yaşam koçun — verilerini görür, yol gösterir, aksiyon alır.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowSettings(!showSettings)} style={{ ...btnGhost }}>⚙ Kişilik</button>
          {messages.length > 0 && <button onClick={clearHistory} style={{ ...btnGhost }}>🗑 Temizle</button>}
        </div>
      </div>

      {/* Kişilik ayarı */}
      {showSettings && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginBottom: '10px' }}>Koçun kişiliği:</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {TONES.map(t => (
              <button key={t.key} onClick={() => changeTone(t.key)} style={{
                padding: '8px 14px', borderRadius: '8px', border: '1px solid',
                borderColor: tone === t.key ? 'var(--accent)' : 'var(--border-strong)',
                background: tone === t.key ? 'var(--accent)' : 'transparent',
                color: tone === t.key ? '#fff' : 'var(--text-dim)', cursor: 'pointer',
                fontSize: '13px', textAlign: 'left'
              }}>
                <div style={{ fontWeight: '600' }}>{t.label}</div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mesajlar */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '12px' }}>
        {historyLoaded && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🧭</div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Merhaba! Ben senin kişisel koçunum. Sana nasıl yardımcı olabilirim?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px', margin: '0 auto' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', textAlign: 'left'
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} style={{
            display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: '12px'
          }}>
            <div style={{
              maxWidth: '85%',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
              color: m.role === 'user' ? '#fff' : 'var(--text-secondary)',
              borderRadius: '14px', padding: '11px 14px',
              fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap'
            }}>
              {m.content}
              {m.action_taken && m.action_taken.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                  {m.action_taken.map((a, i) => (
                    <div key={i} style={{ fontSize: '11.5px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      ✓ {a.result}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '11px 16px', color: 'var(--text-faint)', fontSize: '14px' }}>
              düşünüyor…
            </div>
          </div>
        )}
      </div>

      {/* Girdi */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Koçuna bir şey sor..."
          disabled={loading}
          style={{
            flex: 1, padding: '12px 14px', background: 'var(--bg-item)',
            border: '1px solid var(--border-strong)', borderRadius: '10px',
            color: 'var(--text)', fontSize: '14px', outline: 'none'
          }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{
          padding: '12px 20px', background: 'var(--accent)', border: 'none',
          borderRadius: '10px', color: '#fff', fontSize: '14px', cursor: 'pointer',
          opacity: loading || !input.trim() ? 0.5 : 1
        }}>Gönder</button>
      </div>
    </div>
  )
}

const btnGhost = {
  padding: '7px 12px', background: 'var(--bg-item)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap'
}

export default Coach