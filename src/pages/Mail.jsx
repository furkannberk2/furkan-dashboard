import { useState } from 'react'
import { BACKEND } from '../config'

function Mail() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showMails, setShowMails] = useState(false)

  async function fetchSummary() {
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/api/gmail-summary`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
      setData({ error: 'Bir hata oluştu.' })
    } finally {
      setLoading(false)
    }
  }

  function connectGmail() {
    window.location.href = `${BACKEND}/api/gmail-auth`
  }

  return (
    <div style={{ color: '#fff', maxWidth: '720px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700' }}>Mail Özeti</h2>
        <button onClick={connectGmail} style={{ ...buttonStyle, background: '#222', fontSize: '13px', marginLeft: 'auto' }}>+ Hesap Bağla</button>
        <button onClick={fetchSummary} disabled={loading} style={{ ...buttonStyle, fontSize: '13px' }}>
          {loading ? 'Özetleniyor...' : 'Bugünü Özetle'}
        </button>
      </div>

      {!data && !loading && (
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#555', fontSize: '14px' }}>Önce Gmail hesabını bağla, sonra "Bugünü Özetle" butonuna bas.</p>
        </div>
      )}

      {data?.connected === false && (
        <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#555', fontSize: '14px', marginBottom: '16px' }}>Henüz bağlı bir Gmail hesabı yok.</p>
          <button onClick={connectGmail} style={buttonStyle}>Gmail Bağla</button>
        </div>
      )}

      {data?.error && (
        <div style={{ background: '#2a1a1a', border: '1px solid #f8717133', borderRadius: '12px', padding: '16px', color: '#f87171', fontSize: '14px' }}>
          {data.error}
        </div>
      )}

      {data?.summary && (
        <div>
          {/* Bağlı hesaplar */}
          {data.accounts && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {data.accounts.map(email => (
                <span key={email} style={{ fontSize: '12px', background: '#1a1a1a', border: '1px solid #222', borderRadius: '20px', padding: '4px 12px', color: '#888' }}>📧 {email}</span>
              ))}
            </div>
          )}

          {/* AI Özet */}
          <div style={{ background: '#161616', border: '1px solid #222', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
              Bugünün Özeti {data.mails?.length > 0 && `· ${data.mails.length} mail`}
            </div>
            <div style={{ fontSize: '14px', color: '#ccc', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{data.summary}</div>
          </div>

          {/* Mail listesi (açılır) */}
          {data.mails?.length > 0 && (
            <div>
              <button onClick={() => setShowMails(!showMails)} style={{ background: 'transparent', border: 'none', color: '#666', fontSize: '13px', cursor: 'pointer', marginBottom: '12px' }}>
                {showMails ? '▲ Mailleri gizle' : '▼ Tüm mailleri göster'}
              </button>
              {showMails && data.mails.map((m, i) => (
                <div key={i} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', color: '#ccc', fontWeight: '600' }}>{m.subject}</span>
                    <span style={{ fontSize: '11px', color: '#555' }}>{m.account}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{m.from}</div>
                  <div style={{ fontSize: '12px', color: '#555' }}>{m.snippet}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const buttonStyle = {
  padding: '9px 18px', background: '#6366f1',
  border: 'none', borderRadius: '8px',
  color: '#fff', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap'
}

export default Mail