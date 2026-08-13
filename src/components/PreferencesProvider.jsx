// components/PreferencesProvider.jsx
// Kullanıcı tercihlerini (dil, para birimi, birim, bölge, hafta başı) tek merkezden sağlar.
//
// Mantık:
// - Giriş yapınca user_preferences'tan çeker.
// - Kayıt yoksa: tarayıcı dilinden bölge tahmin eder, o bölgenin varsayılanlarını
//   tabloya yazar ve kullanır (ilk kez oluşturma).
// - Yüklenene kadar güvenli varsayılan (TRY/tr) döner — flicker olmaz, mevcut
//   davranış korunur.
//
// Tüm sayfalar usePreferences() ile okur; ayrı ayrı sorgu atmaz (tek context).

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { guessRegion, getRegionDefaults } from '../utils/regions'
import i18n from '../i18n'

// Güvenli varsayılan — yüklenmeden önce ve hata durumunda kullanılır.
const DEFAULT_PREFS = {
  language: 'tr',
  baseCurrency: 'TRY',
  unitSystem: 'metric',
  region: 'TR',
  weekStart: 1,
  loaded: false,
}

const PreferencesContext = createContext(DEFAULT_PREFS)

// DB satırını (snake_case) hook formatına (camelCase) çevir
function rowToPrefs(row) {
  return {
    language: row.language || 'tr',
    baseCurrency: row.base_currency || 'TRY',
    unitSystem: row.unit_system || 'metric',
    region: row.region || 'TR',
    weekStart: row.week_start ?? 1,
    loaded: true,
  }
}

export function PreferencesProvider({ children }) {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)

  // Dil tercihi değişince arayüz dilini (i18n) senkronize et
  useEffect(() => {
    if (prefs.language && i18n.language !== prefs.language) {
      i18n.changeLanguage(prefs.language)
    }
  }, [prefs.language])

  useEffect(() => {
    if (!user) { setPrefs(DEFAULT_PREFS); return }
    let cancelled = false

    async function load() {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (cancelled) return

        if (data) {
          setPrefs(rowToPrefs(data))
        } else {
          // İlk kez: tarayıcı dilinden bölge tahmin et, varsayılanları yaz
          const region = guessRegion()
          const defaults = getRegionDefaults(region)
          const row = {
            user_id: user.id,
            language: defaults.language,
            base_currency: defaults.base_currency,
            unit_system: defaults.unit_system,
            region: defaults.region,
            week_start: defaults.week_start,
          }
          const { data: inserted } = await supabase
            .from('user_preferences')
            .insert(row)
            .select()
            .maybeSingle()
          if (!cancelled) setPrefs(rowToPrefs(inserted || row))
        }
      } catch (e) {
        console.error('Tercihler yüklenemedi:', e)
        if (!cancelled) setPrefs({ ...DEFAULT_PREFS, loaded: true })
      }
    }

    load()
    return () => { cancelled = true }
  }, [user])

  // Tek bir tercihi güncelle (örn. para birimi değiştir)
  async function updatePreference(key, value) {
    if (!user) return
    // camelCase → snake_case
    const colMap = {
      language: 'language',
      baseCurrency: 'base_currency',
      unitSystem: 'unit_system',
      region: 'region',
      weekStart: 'week_start',
    }
    const col = colMap[key]
    if (!col) return
    setPrefs(prev => ({ ...prev, [key]: value })) // iyimser güncelleme
    try {
      await supabase.from('user_preferences')
        .update({ [col]: value, updated_at: new Date() })
        .eq('user_id', user.id)
    } catch (e) {
      console.error('Tercih güncellenemedi:', e)
    }
  }

  return (
    <PreferencesContext.Provider value={{ ...prefs, updatePreference }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  return useContext(PreferencesContext)
}