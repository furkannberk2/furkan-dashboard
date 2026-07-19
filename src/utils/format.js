// utils/format.js
// Paylaşılan biçimlendirme yardımcıları — para birimi, tarih, sayı.
// Tüm ₺/tr-TR sabitlerinin yerini alır; kullanıcının dil ve para birimine göre çalışır.

const CURRENCY_SYMBOLS = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CHF: 'CHF ',
  CAD: 'C$',
  AUD: 'A$',
}

// Para birimine göre varsayılan locale (sayı formatı için)
const CURRENCY_LOCALE = {
  TRY: 'tr-TR',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
}

/**
 * Para birimini sembol + yerelleştirilmiş sayı ile biçimlendirir.
 * formatMoney(1234.5, 'TRY') → "₺1.234,5"
 * formatMoney(1234.5, 'USD') → "$1,234.5"
 * locale verilirse onu kullanır, yoksa para birimine göre seçer.
 */
export function formatMoney(amount, currency = 'TRY', opts = {}) {
  const { locale, maximumFractionDigits = 2, minimumFractionDigits = 0, showSymbol = true } = opts
  const num = Number(amount) || 0
  const loc = locale || CURRENCY_LOCALE[currency] || 'en-US'
  const formatted = num.toLocaleString(loc, { maximumFractionDigits, minimumFractionDigits })
  if (!showSymbol) return formatted
  const sym = CURRENCY_SYMBOLS[currency] || (currency + ' ')
  // Çoğu para biriminde sembol önde; birkaç locale'de arkada olabilir ama
  // tutarlılık için önde tutuyoruz (₺100, $100, €100).
  return `${sym}${formatted}`
}

export function currencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || (currency + ' ')
}

/**
 * Sayıyı locale'e göre biçimlendirir (para birimi olmadan).
 */
export function formatNumber(n, locale = 'tr-TR', opts = {}) {
  const num = Number(n) || 0
  return num.toLocaleString(locale, opts)
}

/**
 * Yüzdeyi locale'e göre biçimlendirir.
 * TR: %80 (önde), EN: 80% (arkada)
 */
export function formatPercent(value, locale = 'tr-TR', digits = 1) {
  const num = Number(value) || 0
  const formatted = num.toFixed(digits)
  if (locale.startsWith('tr')) return `%${formatted}`
  return `${formatted}%`
}

/**
 * Tarihi locale'e göre biçimlendirir.
 * dateInput: 'YYYY-MM-DD' string veya Date
 */
export function formatDate(dateInput, locale = 'tr-TR', opts = { day: 'numeric', month: 'short', weekday: 'short' }) {
  if (!dateInput) return ''
  const d = typeof dateInput === 'string'
    ? new Date(dateInput + (dateInput.length === 10 ? 'T00:00:00' : ''))
    : dateInput
  return d.toLocaleDateString(locale, opts)
}

/**
 * Uzun tarih formatı (Home başlığı gibi).
 */
export function formatDateLong(dateInput, locale = 'tr-TR') {
  return formatDate(dateInput, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}