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
export function isDueInCurrentCycle(dueDay, currentDay, payday) {
  if (!dueDay) return true
  if (currentDay <= payday) return dueDay >= currentDay && dueDay <= payday
  return dueDay >= currentDay || dueDay <= payday
}

/**
 * Maaş dönemine kalan gün sayısı.
 */
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