import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

function toYahooSymbol(sym, hint = '') {
  if (!sym) return sym
  if (sym === 'XAU/USD' || sym === 'XAUUSD') return 'GC=F'
  if (sym === 'XAG/USD' || sym === 'XAGUSD') return 'SI=F'
  if (sym.includes('/')) return sym.replace('/', '-')
  if (hint === 'BIST' && !sym.includes('.')) return sym + '.IS'
  return sym
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const { symbols, hints, history } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols gerekli' })

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean)
  const hintList = (hints || '').split(',').map(s => s.trim())
  const wantHistory = history === '1'

  const out = {}

  for (let i = 0; i < symbolList.length; i++) {
    const originalSym = symbolList[i]
    const ySym = toYahooSymbol(originalSym, hintList[i] || '')
    try {
      const q = await yahooFinance.quote(ySym)
      out[originalSym] = {
        close: q.regularMarketPrice ?? 0,
        previous_close: q.regularMarketPreviousClose ?? 0,
        percent_change: q.regularMarketChangePercent ?? 0,
        currency: q.currency || 'USD',
        name: q.longName || q.shortName || originalSym
      }

      // history=1 ise 30 günlük veri + aylık değişim ekle
      if (wantHistory) {
        try {
          const end = new Date()
          const start = new Date()
          start.setDate(start.getDate() - 35)
          const chart = await yahooFinance.chart(ySym, { period1: start, period2: end, interval: '1d' })
          const closes = (chart.quotes || []).map(c => c.close).filter(c => c != null)
          if (closes.length >= 2) {
            const change = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100
            out[originalSym].monthly_change = change.toFixed(2)
            out[originalSym].sparkline = closes
          } else {
            out[originalSym].monthly_change = null
            out[originalSym].sparkline = []
          }
        } catch {
          out[originalSym].monthly_change = null
          out[originalSym].sparkline = []
        }
      }
    } catch (err) {
      out[originalSym] = { close: 0, percent_change: 0, error: err.message }
    }
  }

  res.status(200).json(out)
}