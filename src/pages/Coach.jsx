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

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 768)
  useEffect(() => {
    const h = () => setM(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

// ---------- ÖZGÜN SVG MASKOT ----------
// state: 'idle' | 'thinking' | 'happy'
function CoachMascot({ state, size = 180 }) {
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <style>{`
        @keyframes mascotBreathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-4px) scale(1.02); } }
        @keyframes mascotSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes mascotPulse { 0%,100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.15); } }
        @keyframes mascotBlink { 0%,90%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        @keyframes mascotBounce { 0%,100% { transform: translateY(0); } 30% { transform: translateY(-10px); } 60% { transform: translateY(-2px); } }
        @keyframes ringRotate { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes sparkFloat { 0%,100% { opacity: 0.6; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-6px); } }

        .m-body-idle { animation: mascotBreathe 3.5s ease-in-out infinite; transform-origin: center; }
        .m-body-thinking { animation: mascotBreathe 1.2s ease-in-out infinite; transform-origin: center; }
        .m-body-happy { animation: mascotBounce 0.7s ease-in-out; transform-origin: center; }

        .m-ring-idle { animation: ringRotate 18s linear infinite; transform-origin: center; }
        .m-ring-thinking { animation: mascotSpin 2.5s linear infinite; transform-origin: center; }
        .m-ring-happy { animation: ringRotate 18s linear infinite; transform-origin: center; }

        .m-glow-idle { animation: mascotPulse 3.5s ease-in-out infinite; transform-origin: center; }
        .m-glow-thinking { animation: mascotPulse 1.2s ease-in-out infinite; transform-origin: center; }
        .m-glow-happy { animation: mascotPulse 0.6s ease-in-out infinite; transform-origin: center; }

        .m-eye-idle { animation: mascotBlink 5s ease-in-out infinite; transform-origin: center; }
        .m-spark { animation: sparkFloat 2.5s ease-in-out infinite; transform-origin: center; }
      `}</style>

      <svg viewBox="0 0 200 200" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="mascotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mascotBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="mascotRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>

        {/* Glow halesi */}
        <circle cx="100" cy="100" r="70" fill="url(#mascotGlow)" className={`m-glow-${state}`} />

        {/* Dönen dış pusula halkası */}
        <g className={`m-ring-${state}`}>
          <circle cx="100" cy="100" r="62" fill="none" stroke="url(#mascotRing)" strokeWidth="2" strokeDasharray="4 8" opacity="0.7" />
          <polygon points="100,32 104,44 96,44" fill="#c4b5fd" />
          <polygon points="100,168 104,156 96,156" fill="#818cf8" />
          <polygon points="32,100 44,96 44,104" fill="#c4b5fd" />
          <polygon points="168,100 156,96 156,104" fill="#818cf8" />
        </g>

        {/* Ana gövde */}
        <g className={`m-body-${state}`}>
          <g className="m-spark" opacity="0.8">
            <path d="M100 50 L104 62 L116 62 L106 70 L110 82 L100 74 L90 82 L94 70 L84 62 L96 62 Z" fill="#ddd6fe" opacity="0.3" />
          </g>

          <circle cx="100" cy="100" r="42" fill="url(#mascotBody)" />
          <circle cx="100" cy="100" r="42" fill="none" stroke="#ddd6fe" strokeWidth="1.5" opacity="0.5" />
          <ellipse cx="86" cy="84" rx="14" ry="10" fill="#fff" opacity="0.25" />

          {state === 'happy' ? (
            <>
              <path d="M82 96 Q88 90 94 96" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M106 96 Q112 90 118 96" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M88 110 Q100 120 112 110" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            </>
          ) : state === 'thinking' ? (
            <>
              <circle cx="88" cy="98" r="4.5" fill="#fff" />
              <circle cx="112" cy="98" r="4.5" fill="#fff" />
              <circle cx="89" cy="96" r="1.5" fill="#6366f1" />
              <circle cx="113" cy="96" r="1.5" fill="#6366f1" />
              <circle cx="100" cy="112" r="3" fill="none" stroke="#fff" strokeWidth="2.5" />
            </>
          ) : (
            <>
              <g className="m-eye-idle">
                <circle cx="88" cy="98" r="5" fill="#fff" />
                <circle cx="112" cy="98" r="5" fill="#fff" />
                <circle cx="89" cy="99" r="2" fill="#6366f1" />
                <circle cx="113" cy="99" r="2" fill="#6366f1" />
              </g>
              <path d="M90 110 Q100 116 110 110" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
            </>
          )}
        </g>

        {state === 'thinking' && (
          <g className="m-ring-thinking">
            <circle cx="100" cy="38" r="3" fill="#c4b5fd" />
          </g>
        )}
      </svg>
    </div>
  )
}

function Coach() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tone, setTone] = useState('motive')
  const [showSettings, setShowSettings] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [mascotState, setMascotState] = useState('idle')
  const scrollRef = useRef(null)

  useEffect(() => { if (user) loadHistory() }, [user])
  useEffect(() => { scrollToBottom() }, [messages, loading])
  useEffect(() => { if (loading) setMascotState('thinking') }, [loading])

  function triggerHappy() {
    setMascotState('happy')
    setTimeout(() => setMascotState('idle'), 1800)
  }

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
        setMascotState('idle')
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant', content: data.reply,
          action_taken: data.actions?.length ? data.actions : null,
          id: 'a-' + Date.now()
        }])
        triggerHappy()
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Bağlantı hatası.', id: 'err-' + Date.now() }])
      setMascotState('idle')
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

  const mascotStatusText = { idle: 'Hazır', thinking: 'Düşünüyor…', happy: 'İşte bu!' }

  return (
    <div style={{ color: 'var(--text)', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', maxWidth: '780px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isMobile && <CoachMascot state={mascotState} size={52} />}
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>Koç</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-faint)', margin: '4px 0 0' }}>Kişisel yaşam koçun</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowSettings(!showSettings)} style={btnGhost}>⚙ Kişilik</button>
            {messages.length > 0 && <button onClick={clearHistory} style={btnGhost}>🗑 Temizle</button>}
          </div>
        </div>

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

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '12px' }}>
          {historyLoaded && messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              {!isMobile && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <CoachMascot state={mascotState} size={120} />
                </div>
              )}
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

      {!isMobile && (
        <div style={{
          width: '260px', flexShrink: 0, position: 'sticky', top: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '30px 16px', textAlign: 'center'
        }}>
          <CoachMascot state={mascotState} size={200} />
          <div style={{ fontSize: '13px', color: 'var(--text-faint)', marginTop: '14px', fontWeight: '500' }}>
            {mascotStatusText[mascotState]}
          </div>
          <div style={{
            marginTop: '20px', padding: '14px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: '12px', width: '100%'
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px', fontWeight: '600' }}>
              İpucu
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
              Bana "yarın spora git görevi ekle" ya da "kalori hedefimi 2200 yap" gibi şeyler söyleyebilirsin. Senin için hallederim.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btnGhost = {
  padding: '7px 12px', background: 'var(--bg-item)', border: '1px solid var(--border)',
  borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap'
}

export default Coach