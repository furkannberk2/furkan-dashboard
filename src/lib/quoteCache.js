import { BACKEND } from '../config'

const CACHE_TTL_MS = 15 * 60 * 1000 // 15 dakika
const BATCH_SIZE = 8
const BATCH_INTERVAL_MS = 65 * 1000 // 65 saniye
const CACHE_PREFIX = 'quote:'

let activeFetch = null

function readCacheEntry(symbol) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + symbol)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function isFresh(entry) {
  return entry && (Date.now() - entry.timestamp <= CACHE_TTL_MS)
}

function writeCache(symbol, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + symbol, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {}
}

// Cache'teki tüm sembolleri okur (eski olsa bile)
export function readCachedQuotes(symbols) {
  const result = {}
  symbols.forEach(s => {
    const entry = readCacheEntry(s)
    if (entry?.data) result[s] = entry.data
  })
  return result
}

// Tüm cache'leri "eskimiş" olarak işaretle (veriler durur)
export function staleAllQuotes() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => {
        const raw = localStorage.getItem(k)
        if (!raw) return
        try {
          const obj = JSON.parse(raw)
          obj.timestamp = 0
          localStorage.setItem(k, JSON.stringify(obj))
        } catch {}
      })
  } catch {}
}

// Cache'te olmayan veya eski olanları arka planda parça parça çeker
export async function fetchMissingQuotes(symbols, onUpdate) {
  if (activeFetch) activeFetch.cancelled = true
  const job = { cancelled: false }
  activeFetch = job

  const needsFetch = symbols.filter(s => !isFresh(readCacheEntry(s)))
  if (needsFetch.length === 0) return

  for (let i = 0; i < needsFetch.length; i += BATCH_SIZE) {
    if (job.cancelled) return
    const batch = needsFetch.slice(i, i + BATCH_SIZE)
    try {
      const r = await fetch(`${BACKEND}/api/quote?symbols=${encodeURIComponent(batch.join(','))}`)
      const data = await r.json()
      Object.entries(data).forEach(([sym, val]) => {
        if (val && val.close !== undefined) writeCache(sym, val)
      })
      if (!job.cancelled) onUpdate(readCachedQuotes(symbols))
    } catch (err) {
      console.error('Quote batch failed:', err)
    }
    if (i + BATCH_SIZE < needsFetch.length && !job.cancelled) {
      await new Promise(r => setTimeout(r, BATCH_INTERVAL_MS))
    }
  }
}