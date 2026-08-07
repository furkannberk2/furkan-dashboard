// utils/finance.js
// Paylaşılan finansal hesap mantığı — Finance.jsx ve Home.jsx tekrarını bitirir.
// Mimari: her varlık önce USD'ye çevrilir (evrensel ara birim), sonra kullanıcının
// baz para birimine. Hiçbir para birimi ayrıcalıklı değil (TL dahil).

import { goldKeyToGrams } from './regions'

const OUNCE_GRAMS = 31.1035

/**
 * Bir varlığın USD cinsinden değerini hesaplar.
 * rates: { TRY, EUR, GBP, ... } (1 USD = rates.X birim X)
 * quotes: canlı fiyatlar (kripto/stock/altın/gümüş/BIST → close)
 * tefasQuotes: TEFAS fon fiyatları (TL cinsinden)
 */
export function getUSDValue(inv, rates, quotes = {}, tefasQuotes = {}) {
  const qty = Number(inv.quantity) || 0
  if (qty === 0) return 0

  const tryRate = rates?.TRY || 0

  switch (true) {
    // Nakit para birimleri → USD'ye çevir
    case inv.type === 'USD':
      return qty
    case inv.type === 'TRY':
      return tryRate ? qty / tryRate : 0
    case inv.type === 'EUR':
      return rates?.EUR ? qty / rates.EUR : 0
    case inv.type === 'GBP':
      return rates?.GBP ? qty / rates.GBP : 0

    // Gümüş (gram) → ons × XAG (USD)
    case inv.type === 'SILVER_GRAM': {
      const xag = parseFloat(quotes['XAG/USD']?.close || 0)
      return (qty / OUNCE_GRAMS) * xag
    }

    // Altın türevleri → grama çevir, ons × XAU (USD)
    case inv.type?.startsWith('GOLD_'): {
      const xau = parseFloat(quotes['XAU/USD']?.close || 0)
      const grams = inv.type === 'GOLD_GRAM' ? qty : qty * (goldKeyToGrams(inv.type) || 0)
      return (grams / OUNCE_GRAMS) * xau
    }

    // BIST → fiyat TL cinsinden, USD'ye çevir
    case inv.type === 'BIST': {
      const tryPrice = parseFloat(quotes[inv.symbol]?.close || 0)
      return tryRate ? (qty * tryPrice) / tryRate : 0
    }

    // TEFAS → fiyat TL cinsinden, USD'ye çevir
    case inv.type === 'TEFAS_FUND': {
      const tryPrice = parseFloat(tefasQuotes[inv.symbol]?.close || 0)
      return tryRate ? (qty * tryPrice) / tryRate : 0
    }

    // Kripto / ABD hisse → fiyat zaten USD
    case inv.type === 'CRYPTO' || inv.type === 'STOCK': {
      const usdPrice = parseFloat(quotes[inv.symbol]?.close || 0)
      return qty * usdPrice
    }

    default:
      return 0
  }
}

/**
 * USD değerini kullanıcının baz para birimine çevirir.
 * baseCurrency: 'USD' | 'TRY' | 'EUR' | 'GBP' | ...
 */
export function usdToBase(usdValue, baseCurrency, rates) {
  if (!usdValue) return 0
  if (baseCurrency === 'USD') return usdValue
  const rate = rates?.[baseCurrency]
  return rate ? usdValue * rate : 0
}

/**
 * Bir varlığın kullanıcının baz para birimindeki değerini tek adımda verir.
 * (Eski getTRYValue'nun genelleştirilmiş hali. baseCurrency='TRY' iken
 *  sonuç eski davranışla birebir aynıdır.)
 */
export function getBaseCurrencyValue(inv, baseCurrency, rates, quotes = {}, tefasQuotes = {}) {
  const usd = getUSDValue(inv, rates, quotes, tefasQuotes)
  return usdToBase(usd, baseCurrency, rates)
}

/**
 * Günlük değişim yüzdesi (para biriminden bağımsız).
 */
export function getDailyChange(inv, quotes = {}, tefasQuotes = {}) {
  if (inv.type === 'CRYPTO' || inv.type === 'STOCK' || inv.type === 'BIST')
    return parseFloat(quotes[inv.symbol]?.percent_change || 0)
  if (inv.type === 'TEFAS_FUND')
    return parseFloat(tefasQuotes[inv.symbol]?.percent_change || 0)
  if (inv.type === 'SILVER_GRAM')
    return parseFloat(quotes['XAG/USD']?.percent_change || 0)
  if (inv.type?.startsWith('GOLD_'))
    return parseFloat(quotes['XAU/USD']?.percent_change || 0)
  return null
}

/**
 * Bir sabit giderin, mevcut maaş döneminde ödenmesi gerekip gerekmediğini söyler.
 * (Finance.jsx'teki isDueInCurrentCycle mantığı — tek yerde.)
 */
/**
 * Bir sabit gider, mevcut maaş döneminde BUGÜNDEN SONRA (henüz gelmemiş)
 * bir ödemesi varsa true döner.
 * Kural: giderin bir sonraki ödeme tarihi, bugün ile dönem sonu (bir sonraki
 * maaş günü) arasındaysa bakiyeden düşülür. Ödeme günü geçtiyse düşülmez.
 */
export function isDueInCurrentCycle(dueDay, currentDay, payday, now = new Date()) {
  if (!dueDay) return true

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Dönem sonu = bir sonraki maaş günü
  let periodEnd
  if (currentDay < payday) {
    // Henüz bu ayın maaşı gelmedi → dönem bu ayın maaş gününde biter
    periodEnd = new Date(now.getFullYear(), now.getMonth(), payday)
  } else {
    // Maaş geldi → dönem gelecek ayın maaş gününde biter
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, payday)
  }

  // Giderin bir sonraki ödeme tarihi: bugünden sonraki en yakın dueDay
  // Bu ayki dueDay'i dene
  let nextDue = new Date(now.getFullYear(), now.getMonth(), dueDay)
  if (nextDue <= today) {
    // Bu ayki geçti → gelecek ayki
    nextDue = new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
  }

  // Bir sonraki ödeme, bugünden sonra VE dönem sonundan önce/eşitse → düş
  return nextDue > today && nextDue <= periodEnd
}

/**
 * Maaş dönemine kalan gün sayısı.
 */
/**
 * İçinde bulunulan maaş dönemini 'YYYY-MM' olarak döndürür.
 * Dönem, maaş gününden bir sonraki maaş gününe kadardır ve başladığı
 * ayın etiketini taşır.
 * - Bugün maaş gününde veya sonrasındaysa → içinde bulunulan ay
 * - Bugün maaş gününden önceyse → bir önceki ay (hâlâ o dönemdeyiz)
 */
export function getCurrentPeriod(payday, now = new Date()) {
  const currentDay = now.getDate()
  let year = now.getFullYear()
  let month = now.getMonth() // 0-11
  if (currentDay < payday) {
    // Henüz bu ayın maaşı gelmedi → önceki dönemdeyiz
    month -= 1
    if (month < 0) { month = 11; year -= 1 }
  }
  const mm = String(month + 1).padStart(2, '0')
  return `${year}-${mm}`
}

export function getRemainingDays(payday, now = new Date()) {
  const currentDay = now.getDate()
  if (currentDay <= payday) return payday - currentDay + 1
  const nextPay = new Date(now.getFullYear(), now.getMonth() + 1, payday)
  const td = new Date(now.getFullYear(), now.getMonth(), currentDay)
  return Math.round((nextPay - td) / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Günlük harcama limitini hesaplar.
 * baseAmount: gelir veya bakiye (baz para biriminde)
 * totalRecurring: kalan döneme düşen sabit giderler
 * totalVariable: değişken bütçe
 */
export function calcDailyBudget(baseAmount, totalRecurring, totalVariable, payday, now = new Date()) {
  if (!baseAmount || baseAmount <= 0) return 0
  const remainingDays = getRemainingDays(payday, now)
  return Math.round((baseAmount - totalRecurring - totalVariable) / remainingDays)
}