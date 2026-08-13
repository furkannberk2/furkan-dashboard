// src/i18n.js
// react-i18next kurulumu. Dil, PreferencesProvider'daki language ile senkronize edilir
// (bkz. App/PreferencesProvider — dil değişince i18n.changeLanguage çağrılır).

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import tr from './locales/tr.json'
import en from './locales/en.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng: 'tr',            // başlangıç; PreferencesProvider yükleyince güncellenir
    fallbackLng: 'tr',
    interpolation: { escapeValue: false }, // React zaten XSS koruyor
  })

export default i18n