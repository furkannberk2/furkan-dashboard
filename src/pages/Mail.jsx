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
    window.location.href = `${BACKEND}/api/gmail-auth?action=connect`
  }

  return (
    <div style={{ color: 'var(--text)', maxWidth: '720px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '12px' }}>Mail Özeti</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={connectGmail} style={{ ...buttonStyle, background: 'var(--bg-item)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '13px' }}>+ Hesap Bağla</button>
          <button onClick={fetchSummary} disabled={loading} style={{ ...buttonStyle, fontSize: '13px', marginLeft: 'auto' }}>
            {loading ? 'Özetleniyor...' : 'Bugünü Özetle'}
          </button>
        </div>
      </div>

      {!data && !loading && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '22px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', fontSize: '14px' }}>Önce Gmail hesabını bağla, sonra "Bugünü Özetle" butonuna bas.</p>
        </div>
      )}

      {data?.connected === false && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '22px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-faint)', fontSize: '14px', marginBottom: '14px' }}>Henüz bağlı bir Gmail hesabı yok.</p>
          <button onClick={connectGmail} style={buttonStyle}>Gmail Bağla</button>
        </div>
      )}

      {data?.error && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '14px', color: 'var(--danger)', fontSize: '14px' }}>
          {data.error}
        </div>
      )}

      {data?.summary && (
        <div>
          {data.accounts && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
              {data.accounts.map(email => (
                <span key={email} style={{ fontSize: '12px', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '20px', padding: '4px 12px', color: 'var(--text-muted)' }}>📧 {email}</span>
              ))}
            </div>
          )}

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px', marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
              Bugünün Özeti {data.mails?.length > 0 && `· ${data.mails.length} mail`}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{data.summary}</div>
          </div>

          {data.mails?.length > 0 && (
            <div>
              <button onClick={() => setShowMails(!showMails)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '13px', cursor: 'pointer', marginBottom: '10px' }}>
                {showMails ? '▲ Mailleri gizle' : '▼ Tüm mailleri göster'}
              </button>
              {showMails && data.mails.map((m, i) => (
                <div key={i} style={{ background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '11px 14px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.subject}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{m.account}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>{m.from}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>{m.snippet}</div>
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
  padding: '9px 16px', background: 'var(--accent)',
  border: 'none', borderRadius: '8px',
  color: '#fff', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap'
}

export default Mail