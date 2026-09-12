import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../config'

const CATEGORY_KEYS = ['groceries', 'food', 'transport', 'cafe', 'clothing', 'health', 'entertainment', 'subscription', 'bills', 'other']

// onAdded: eklemeden sonra parent'ı tazelemek için opsiyonel callback
export default function MailExpenses({ onAdded }) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState(null) // null=henüz yok, []=bulunamadı
  const [saving, setSaving] = useState(false)

  async function scan() {
    setLoading(true); setItems(null)
    try {
      const res = await fetch(`${BACKEND}/api/gmail-summary?action=expenses&user_id=${user.id}`)
      const data = await res.json()
      if (data.connected === false) {
        setItems([])
      } else {
        // her öğeye seçili=true ekle
        setItems((data.expenses || []).map(e => ({ ...e, selected: true })))
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  function update(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }
  function toggle(idx) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it))
  }

  async function addSelected() {
    const today = new Date().toISOString().split('T')[0]
    const selected = (items || []).filter(it => it.selected && Number(it.amount) > 0)
    if (selected.length === 0) return
    setSaving(true)
    try {
      const rows = selected.map(it => ({
        date: today,
        category: it.category,
        description: it.description || (it.source ? `${t('finance.fromMail')}: ${it.source}` : null),
        amount: Math.round(Number(it.amount)),
        user_id: user.id
      }))
      await supabase.from('daily_expenses').insert(rows)
      setItems(null)
      if (onAdded) onAdded()
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = (items || []).filter(it => it.selected).length

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '15px' }}>📩</span>
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{t('finance.scanMailExpenses')}</span>
        </div>
        {items === null && (
          <button onClick={scan} disabled={loading} style={secondaryBtn}>
            {loading ? t('finance.scanningMails') : t('finance.scanMailExpenses')}
          </button>
        )}
      </div>

      {loading && (
        <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '10px' }}>{t('finance.scanningMails')}</div>
      )}

      {items !== null && items.length === 0 && !loading && (
        <div style={{ fontSize: '12px', color: 'var(--text-faint)', marginTop: '10px' }}>{t('finance.noMailExpenses')}</div>
      )}

      {items !== null && items.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginBottom: '8px' }}>{t('finance.mailExpensesHint')}</div>
          {items.map((it, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-item)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 10px', marginBottom: '6px', opacity: it.selected ? 1 : 0.5 }}>
              <input type="checkbox" checked={it.selected} onChange={() => toggle(idx)} style={{ width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }} />
              <input value={it.description} onChange={e => update(idx, 'description', e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: '13px', padding: '5px 8px', minWidth: 0 }} />
              <select value={it.category} onChange={e => update(idx, 'category', e.target.value)} style={{ ...inputStyle, flex: 0, width: 'auto', fontSize: '12px', padding: '5px 6px', cursor: 'pointer' }}>
                {CATEGORY_KEYS.map(k => <option key={k} value={k}>{t('categories.' + k, { defaultValue: k })}</option>)}
              </select>
              <input type="number" value={it.amount} onChange={e => update(idx, 'amount', e.target.value)} onFocus={e => e.target.select()} style={{ ...inputStyle, flex: 0, width: '64px', fontSize: '12px', padding: '5px 6px', textAlign: 'center' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>₺</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={() => setItems(null)} style={{ ...ghostBtn, flex: 0 }}>{t('common.cancel')}</button>
            <button onClick={addSelected} disabled={saving || selectedCount === 0} style={{ ...primaryBtn, flex: 1, opacity: (saving || selectedCount === 0) ? 0.6 : 1 }}>
              {t('finance.addSelected')} ({selectedCount})
            </button>
          </div>
        </div>
      )}    
    </div>
  )
}

const inputStyle = {
  padding: '9px 12px', background: 'var(--bg-item)',
  border: '1px solid var(--border-strong)', borderRadius: '8px',
  color: 'var(--text)', fontSize: '14px', outline: 'none'
}
const primaryBtn = {
  padding: '9px 15px', background: 'var(--text)', color: 'var(--bg)',
  border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap'
}
const secondaryBtn = {
  padding: '7px 13px', background: 'transparent', color: 'var(--text)',
  border: '1px solid var(--border-strong)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap'
}
const ghostBtn = {
  padding: '9px 14px', background: 'transparent', color: 'var(--text-secondary)',
  border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap'
}