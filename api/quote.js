import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

function toYahooSymbol(sym, hint = '') {
  if (!sym) return sym
  if (sym.includes('/')) return sym.replace('/', '-')
  if (hint === 'BIST' && !sym.includes('.')) return sym + '.IS'
  return sym
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { symbols, hints } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols gerekli' })

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean)
  const hintList = (hints || '').split(',').map(s => s.trim())
  const yahooSymbols = symbolList.map((s, i) => toYahooSymbol(s, hintList[i] || ''))

  const out = {}

  for (let i = 0; i < symbolList.length; i++) {
    const originalSym = symbolList[i]
    const ySym = yahooSymbols[i]
    try {
      const q = await yahooFinance.quote(ySym)
      out[originalSym] = {
        close: q.regularMarketPrice ?? 0,
        previous_close: q.regularMarketPreviousClose ?? 0,
        percent_change: q.regularMarketChangePercent ?? 0,
        currency: q.currency || 'USD',
        name: q.longName || q.shortName || originalSym
      }
    } catch (err) {
      out[originalSym] = { close: 0, percent_change: 0, error: err.message }
    }
  }

  res.status(200).json(out)
}

import axios from 'axios'

const KEY = process.env.TWELVE_DATA_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols gerekli' })

  const list = symbols.split(',').map(s => s.trim()).filter(Boolean)
  const out = {}

  await Promise.all(list.map(async sym => {
    try {
      const r = await axios.get('https://api.twelvedata.com/time_series', {
        params: { symbol: sym, interval: '1day', outputsize: 30, apikey: KEY }
      })
      const values = r.data.values || []
      if (values.length >= 2) {
        const latest = parseFloat(values[0].close)
        const oldest = parseFloat(values[values.length - 1].close)
        const change = ((latest - oldest) / oldest) * 100
        out[sym] = { monthly_change: change.toFixed(2) }
      } else {
        out[sym] = { monthly_change: null }
      }
    } catch {
      out[sym] = { monthly_change: null }
    }
  }))

  res.status(200).json(out)
}