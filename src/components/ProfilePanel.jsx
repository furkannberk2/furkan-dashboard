// components/ProfilePanel.jsx
// Sağdan açılan profil/tercihler paneli.
// Bölge, para birimi, dil, birim sistemi ayarlanır.
// Bölge değişince diğerleri otomatik önerilir ama kullanıcı override edebilir.

import { createPortal } from 'react-dom'
import { useAuth } from './AuthProvider'
import { usePreferences } from './PreferencesProvider'
import { getRegionDefaults, REGIONS } from '../utils/regions'

const CURRENCIES = [
  { code: 'TRY', label: '₺ Türk Lirası' },
  { code: 'USD', label: '$ ABD Doları' },
  { code: 'EUR', label: '€ Euro' },
  { code: 'GBP', label: '£ İngiliz Sterlini' },
  { code: 'INR', label: '₹ Hindistan Rupisi' },
  { code: 'JPY', label: '¥ Japon Yeni' },
  { code: 'CHF', label: 'CHF İsviçre Frangı' },
  { code: 'CAD', label: 'C$ Kanada Doları' },
  { code: 'AUD', label: 'A$ Avustralya Doları' },
  { code: 'AED', label: 'AED BAE Dirhemi' },
  { code: 'SAR', label: 'SAR Suudi Riyali' },
  { code: 'CNY', label: '¥ Çin Yuanı' },
]

const LANGUAGES = [
  { code: 'tr', label: 'Türkçe' },
  { code: 'en', label: 'English' },
]

const REGION_LABELS = {
  TR: '🇹🇷 Türkiye',
  US: '🇺🇸 Amerika',
  IN: '🇮🇳 Hindistan',
  _default: '🌍 Diğer / Genel',
}

const UNIT_SYSTEMS = [
  { code: 'metric', label: 'Metrik (gram, kg, kcal)' },
  { code: 'imperial', label: 'İmperial (oz, lb)' },
]

function ProfilePanel({ open, onClose }) {
  const { user, signOut } = useAuth()
  const prefs = usePreferences()

  if (!open) return null

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || user?.email?.split('@')[0] || 'Kullanıcı'

  // Bölge değişince: o bölgenin varsayılanlarını uygula (kullanıcı sonra override edebilir)
  function handleRegionChange(regionCode) {
    const defaults = getRegionDefaults(regionCode)
    prefs.updatePreference('region', regionCode)
    prefs.updatePreference('baseCurrency', defaults.base_currency)
    prefs.updatePreference('language', defaults.language)
    prefs.updatePreference('unitSystem', defaults.unit_system)
    prefs.updatePreference('weekStart', defaults.week_start)
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
        display: 'flex', justifyContent: 'flex-end'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '380px', maxWidth: '90vw', height: '100%',
          background: 'var(--bg-card)', borderLeft: '1px solid var(--border-strong)',
          padding: '24px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '22px'
        }}
      >
        {/* Başlık */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Profil</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Kullanıcı bilgisi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: '700', fontSize: '18px'
          }}>
            {firstName[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{firstName}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border)' }} />

        {/* Tercihler */}
        <div style={{ fontSize: '11px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: '600' }}>
          Tercihler
        </div>

        {/* Bölge */}
        <Field label="Bölge" hint="Bölge seçince para birimi, dil ve birim otomatik ayarlanır.">
          <select value={prefs.region} onChange={e => handleRegionChange(e.target.value)} style={selectStyle}>
            {Object.keys(REGIONS).map(code => (
              <option key={code} value={code}>{REGION_LABELS[code] || code}</option>
            ))}
          </select>
        </Field>

        {/* Para birimi */}
        <Field label="Ana Para Birimi" hint="Portföy ve finans değerleri bu birimde gösterilir.">
          <select value={prefs.baseCurrency} onChange={e => prefs.updatePreference('baseCurrency', e.target.value)} style={selectStyle}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>

        {/* Dil */}
        <Field label="Dil">
          <select value={prefs.language} onChange={e => prefs.updatePreference('language', e.target.value)} style={selectStyle}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </Field>

        {/* Birim sistemi */}
        <Field label="Birim Sistemi">
          <select value={prefs.unitSystem} onChange={e => prefs.updatePreference('unitSystem', e.target.value)} style={selectStyle}>
            {UNIT_SYSTEMS.map(u => <option key={u.code} value={u.code}>{u.label}</option>)}
          </select>
        </Field>

        <div style={{ flex: 1 }} />

        {/* Çıkış */}
        <button onClick={signOut} style={{
          padding: '11px', borderRadius: '10px', background: 'transparent',
          border: '1px solid var(--border-strong)', color: 'var(--danger)',
          fontSize: '14px', cursor: 'pointer', fontWeight: '500'
        }}>
          Çıkış yap
        </button>
      </div>
    </div>,
    document.body
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '6px' }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '5px', lineHeight: '1.5' }}>{hint}</div>}
    </div>
  )
}

const selectStyle = {
  width: '100%', padding: '10px 12px', background: 'var(--bg-item)',
  border: '1px solid var(--border-strong)', borderRadius: '8px',
  color: 'var(--text)', fontSize: '14px', outline: 'none', cursor: 'pointer'
}

export default ProfilePanel